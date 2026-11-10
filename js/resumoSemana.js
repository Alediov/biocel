// Resumo da semana (pedido do Alediov, 25/10/2026): na 1ª abertura de cada semana (segunda a domingo), um resumo
// da semana que passou em todas as áreas (XP, lições, dias, acerto, leitura, xadrez, foco, caderno, simulados,
// liga), comparado com a anterior, e o que vem na semana nova (provas e eventos). Também pelo Perfil.
import { E, salvar, hojeISO, somaDias } from "./estado.js";
import { modal, escapar, dataBR } from "./ui.js";
import { semanaDe, DIVISOES } from "./liga.js";
import { extra } from "./dados.js";
import { sessoesDe } from "./agenda.js";

const dias = (seg) => Array.from({ length: 7 }, (_, i) => somaDias(seg, i));

export async function resumoDaSemana(seg) {
  const e = E(), ds = dias(seg);
  let xp = 0, licoes = 0, diasEst = 0, n = 0, certas = 0, leituraMin = 0, xadrezMin = 0, focoMin = 0;
  for (const d of ds) {
    const di = e.diario?.[d];
    xp += di?.xp || 0; licoes += di?.licoes?.length || 0;
    if (di?.licoes?.length || di?.xp > 0) diasEst++;
    for (const r of e.respostas?.[d] || []) if (r.tentativa === 1) { n++; if (r.acertou) certas++; }
    leituraMin += (e.leitura?.dias?.[d] || 0) / 60;
    xadrezMin += (e.xadrez?.dias?.[d] || 0) / 60;
    focoMin += e.foco?.dias?.[d] || 0;
  }
  const lidas = Object.values(e.leitura?.lidas || {}).filter(v => { const q = typeof v === "string" ? v : v?.em || v?.data; return q && q >= seg && q <= ds[6]; }).length;
  const caderno = (e.caderno?.registros || []).filter(r => r.data >= seg && r.data <= ds[6]);
  const sims = [];
  for (const d of ds) { const c = await extra(`cor:${d}`).catch(() => null); if (c?.nota != null) sims.push(c.nota); }
  const liga = (e.liga?.historico || []).find(h => h.semana === seg);
  let xpAnt = 0; for (const d of dias(somaDias(seg, -7))) xpAnt += e.diario?.[d]?.xp || 0;
  // melhor dia
  const melhor = ds.map(d => [d, e.diario?.[d]?.xp || 0]).sort((a, b) => b[1] - a[1])[0];
  return { seg, fim: ds[6], xp, xpAnt, licoes, diasEst, acerto: n ? certas / n : null, questoes: n, leituraMin, lidas, xadrezMin, focoMin, caderno, sims, liga, melhor, ofensiva: e.ofensiva?.atual || 0 };
}

const min = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}` : `${Math.round(m)} min`);

export function htmlResumo(r) {
  const delta = r.xpAnt ? Math.round(((r.xp - r.xpAnt) / r.xpAnt) * 100) : null;
  const itens = [
    ["⚡", `${r.xp.toLocaleString("pt-BR")} XP`, delta == null ? "" : `${delta >= 0 ? "+" : ""}${delta}% que a semana anterior`],
    ["📚", `${r.licoes} lições`, `${r.diasEst} de 7 dias estudados${r.melhor?.[1] ? ` · melhor dia: ${dataBR(r.melhor[0], { weekday: "long" })}` : ""}`],
    r.questoes ? ["🎯", `${Math.round(r.acerto * 100)}% de acerto`, `${r.questoes} questões na 1ª tentativa`] : null,
    ["🔥", `${r.ofensiva} dias de ofensiva`, ""],
    r.leituraMin >= 1 ? ["📖", `${min(r.leituraMin)} de leitura`, r.lidas ? `${r.lidas} unidades concluídas` : ""] : null,
    r.xadrezMin >= 1 ? ["♟️", `${min(r.xadrezMin)} de xadrez`, "aberturas e problemas"] : null,
    r.focoMin >= 1 ? ["⏱️", `${min(r.focoMin)} em modo foco`, ""] : null,
    r.caderno.length ? ["📓", `${r.caderno.length} registro${r.caderno.length > 1 ? "s" : ""} no caderno clínico`, `${r.caderno.reduce((s, x) => s + (x.procs || []).filter(p => p.papel === "fiz").reduce((a, p) => a + (p.n || 1), 0), 0)} procedimentos feitos`] : null,
    r.sims.length ? ["📝", `${r.sims.length} ${r.sims.length > 1 ? "cadernos e simulados corrigidos" : "caderno ou simulado corrigido"}`, `média ${(r.sims.reduce((a, b) => a + b, 0) / r.sims.length).toFixed(1).replace(".", ",")}`] : null,
    r.liga ? ["🏆", `${r.liga.posicao}º na liga ${DIVISOES[r.liga.divisao]?.nome || ""}`, r.liga.resultado === "sobe" ? "subiu de divisão" : r.liga.resultado === "desce" ? "desceu de divisão" : "ficou na divisão"] : null,
  ].filter(Boolean);
  return `<div class="rs"><p class="rs-per">${dataBR(r.seg)} a ${dataBR(r.fim)}</p>${itens.map(([ic, b, s]) => `<div class="rs-it"><span>${ic}</span><div><b>${escapar(b)}</b>${s ? `<small>${escapar(s)}</small>` : ""}</div></div>`).join("")}${proximaSemana()}</div>`;
}

function proximaSemana() {
  const hoje = hojeISO(), fim = somaDias(semanaDe(hoje), 6);
  const provas = (E().avaliacoes || []).filter(a => a.data >= hoje && a.data <= fim).sort((a, b) => a.data.localeCompare(b.data));
  const evs = (E().agenda?.eventosOnline || []).flatMap(sessoesDe).filter(x => x.data >= hoje && x.data <= fim).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
  if (!provas.length && !evs.length) return "";
  return `<h4 class="rs-h">Nesta semana</h4>${provas.map(a => `<div class="rs-pr"><b>${dataBR(a.data, { weekday: "short", day: "2-digit", month: "2-digit" })}</b> ${escapar(a.disciplina || a.titulo)}<small>${escapar(a.titulo || "")}</small></div>`).join("")}${evs.map(x => `<div class="rs-pr"><b>${dataBR(x.data, { weekday: "short", day: "2-digit", month: "2-digit" })}</b> ${escapar(x.nome)}<small>evento${x.modalidade === "online" ? " online" : ""}${x.n > 1 ? `, dia ${x.i + 1} de ${x.n}` : ""}</small></div>`).join("")}`;
}

/** Na 1ª abertura da semana: mostra o resumo da anterior (se teve alguma coisa). */
export async function avisoSemana() {
  const e = E(), seg = semanaDe(hojeISO()), ant = somaDias(seg, -7);
  if (e.resumoSemanaVisto === seg) return;
  const primeira = !e.resumoSemanaVisto;
  e.resumoSemanaVisto = seg; salvar();
  if (primeira) return; // na instalação, não mostra
  const r = await resumoDaSemana(ant);
  if (!r.xp && !r.licoes && !r.leituraMin) return;
  await modal({ titulo: "Sua semana", html: htmlResumo(r), botoes: [{ texto: "Bora para a próxima", valor: true }] });
}

/** Pelo Perfil: a semana passada (ou a atual, até agora). */
export async function verResumo(atual = false) {
  const seg = semanaDe(hojeISO()), r = await resumoDaSemana(atual ? seg : somaDias(seg, -7));
  await modal({ titulo: atual ? "Esta semana até agora" : "Semana passada", html: htmlResumo(r), botoes: [{ texto: "Fechar", valor: true }] });
}
