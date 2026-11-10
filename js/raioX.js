// Raio X da prova (pedido do Alediov, 25/10/2026): para cada avaliação próxima com `recorte` (prefixos dos ids das
// unidades, vindos do pacote `agenda`), o domínio unidade a unidade: acerto na 1ª tentativa, quantas questões já
// estão firmes na revisão espaçada (caixa ≥ 3) e o que ainda não foi visto; a "prontidão" junta tudo, e "Treinar os
// pontos fracos" monta uma sessão com as questões das unidades mais fracas. Também o "Erros da semana" (o treino de
// domingo, com bônus uma vez por semana). Mostrado no Treino; a aba Provas da trilha mostra a prontidão.
import { E, hojeISO, somaDias } from "./estado.js";
import { escapar } from "./ui.js";

let titulos = null;
export async function titulosUnidades() {
  if (titulos) return titulos;
  try { titulos = await (await fetch("dados/unidades.json")).json(); } catch { titulos = {}; }
  return titulos;
}
const unidadeDe = (id = "") => id.match(/^[a-z]\d\d-\d\d/)?.[0] || (id.startsWith("metep") ? "metep" : id.startsWith("ev-sb") ? "seminário" : id.split("-")[0]);
const NOMES_ESPECIAIS = { metep: "Notas de METEP (plano de ensino e bibliografia)", "seminário": "Seminário de biópsia", semio: "Notas de Semiologia" };
const casa = (id, recorte) => recorte.some(p => id.startsWith(p));

/** Primeira tentativa de cada questão (a mais recente), de todas as respostas guardadas. */
export function primeiras() {
  const m = new Map();
  for (const lista of Object.values(E().respostas || {})) for (const r of lista) if (r.tentativa === 1) m.set(r.id, r);
  return m;
}

/** Domínio de uma avaliação: { unidades: [{ id, nome, total, vistas, acerto, firmes, nota }], prontidao, faltam }. */
export async function raioX(av, banco) {
  const T = await titulosUnidades(), est = E(), prim = primeiras();
  const por = new Map();
  for (const [id] of banco) {
    if (!casa(id, av.recorte)) continue;
    const u = unidadeDe(id), o = por.get(u) || { id: u, ids: [], total: 0, vistas: 0, certas: 0, firmes: 0 };
    o.total++; o.ids.push(id);
    const r = prim.get(id); if (r) { o.vistas++; if (r.acertou) o.certas++; }
    if ((est.srs?.[id]?.caixa || 0) >= 3) o.firmes++;
    por.set(u, o);
  }
  const unidades = [...por.values()].map(o => {
    const acerto = o.vistas ? o.certas / o.vistas : null, cobertura = o.vistas / o.total, firmeza = o.firmes / o.total;
    // nota de 0 a 1: acerto pesa mais, mas só vale para o que já foi visto
    const nota = o.vistas ? 0.55 * acerto * cobertura + 0.45 * firmeza : 0;
    return { ...o, nome: T[o.id] || NOMES_ESPECIAIS[o.id] || o.id, acerto, cobertura, firmeza, nota };
  }).sort((a, b) => a.id.localeCompare(b.id));
  // unidades do recorte que ainda não apareceram na trilha (pelos títulos dos livros)
  const faltam = Object.keys(T).filter(u => !por.has(u) && av.recorte.some(p => u.startsWith(p)));
  const prontidao = unidades.length ? unidades.reduce((s, u) => s + u.nota, 0) / (unidades.length + faltam.length) : 0;
  const estudado = unidades.length ? unidades.reduce((s, u) => s + u.nota, 0) / unidades.length : 0;
  return { unidades, prontidao, estudado, faltam: faltam.map(u => ({ id: u, nome: T[u] })) };
}

/** Questões para treinar os pontos fracos: as unidades de nota mais baixa, primeiro as erradas e as não vistas. */
export function pontosFracos(rx, banco, n = 12) {
  const est = E(), prim = primeiras(), out = [];
  const fracas = [...rx.unidades].sort((a, b) => a.nota - b.nota);
  const peso = (id) => { const s = est.srs?.[id], r = prim.get(id); return (r && !r.acertou ? 3 : 0) + (!r ? 2 : 0) + (s ? 3 - Math.min(3, s.caixa) : 1) + Math.random(); };
  for (let volta = 0; out.length < n && volta < 4; volta++) {
    for (const u of fracas) {
      const cand = u.ids.filter(id => !out.includes(id) && banco.get(id)?.tipo !== "resumo").sort((a, b) => peso(b) - peso(a));
      out.push(...cand.slice(0, volta === 0 ? 3 : 2));
      if (out.length >= n) break;
    }
  }
  return out.slice(0, n);
}

/** Questões erradas na 1ª tentativa nos últimos 7 dias (as mais recentes primeiro). */
export function errosDaSemana(banco, n = 15) {
  const hoje = hojeISO(), ids = [];
  for (let i = 0; i < 7; i++) {
    for (const r of [...(E().respostas?.[somaDias(hoje, -i)] || [])].reverse()) {
      if (r.tentativa === 1 && !r.acertou && banco.has(r.id) && !ids.includes(r.id)) ids.push(r.id);
    }
  }
  return ids.slice(0, n);
}

export const corDaNota = (x) => (x >= 0.7 ? "bom" : x >= 0.45 ? "medio" : "fraco");
export const pctTxt = (x) => `${Math.round((x || 0) * 100)}%`;

/** HTML de uma linha por unidade (para o Treino). */
export function linhasUnidades(rx) {
  return rx.unidades.map(u => `<li class="rx-u ${u.vistas ? corDaNota(u.nota) : "nunca"}"><div class="rx-u-topo"><span><small>${escapar(u.id)}</small> ${escapar(u.nome)}</span><b>${u.vistas ? pctTxt(u.nota) : "–"}</b></div>
    <div class="rx-barra"><i style="width:${Math.round(u.nota * 100)}%"></i></div>
    <small>${u.vistas ? `${u.vistas} de ${u.total} vistas · ${pctTxt(u.acerto)} de acerto · ${u.firmes} firmes` : `${u.total} questões ainda não vistas`}</small></li>`).join("")
    + (rx.faltam.length ? `<li class="rx-u nunca rx-faltam"><div class="rx-u-topo"><span>Ainda não chegaram na trilha</span><b>${rx.faltam.length}</b></div><small>${rx.faltam.slice(0, 8).map(u => escapar(`${u.id} ${u.nome || ""}`)).join(" · ")}${rx.faltam.length > 8 ? " …" : ""}</small></li>` : "");
}
