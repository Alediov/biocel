// A música do dia da Eva (pedido do Alediov, 05/11/2026: "recomendar uma música por dia"): uma música da biblioteca
// dele (as Músicas, IndexedDB deste aparelho), a mesma o dia todo (sorteada pela data), puxando as boas que andam
// esquecidas, as favoritas, as 5 estrelas e um pouco de descoberta; o clima da música combina com a hora (como o
// "Seu dia", musicas/seuDia.js) e nada que ela já escolheu nos últimos 30 dias. "Outra" troca uma vez por dia.
// O título e o artista vão para o chat e para E().eva.musicas, mas NUNCA para a API (api.js pula `tipo: "musica"`).
// `escolherMusica` e `porqueDe` são puros (node tools/teste_eva.mjs); o resto lê o app por imports dinâmicos.
import { rng } from "./falas.js";

const DIA = 864e5;
export const DIAS_SEM_REPETIR = 30, GUARDAR_DIAS = 60;
const CLIMA_HORA = (h) => (h < 12 ? ["Animada", "Dançante"] : h < 18 ? ["Animada", "Romântica", "Dançante"] : ["Calma", "Melancólica", "Romântica"]);
const climasDe = (f) => (Array.isArray(f.clima) ? f.clima : [f.clima]).filter(Boolean);
const ehVersaoFeita = (f) => /\((?:[^()]*\b)?(sped up|slowed)\)\s*$/i.test(f.titulo || "");

/** O motivo da escolha, em palavras (o mais forte primeiro). → { tipo, texto } */
export function porqueDe(f, agora) {
  const dias = f.ultimaVez ? Math.floor((agora - f.ultimaVez) / DIA) : null;
  if ((f.nota || 0) >= 10 && dias != null && dias >= 14) return { tipo: "esquecida5", texto: `Uma das suas 5 estrelas, e faz ${semanas(dias)} que você não ouve.` };
  if ((f.nota || 0) >= 8 && dias != null && dias >= 14) return { tipo: "esquecida", texto: `Faz ${semanas(dias)} que você não ouve.` };
  if ((f.nota || 0) >= 10) return { tipo: "cinco", texto: "Uma das suas 5 estrelas." };
  if (f.fav) return { tipo: "fav", texto: "Uma das suas favoritas." };
  if (f.adicionadaEm && agora - f.adicionadaEm < 30 * DIA && (f.tocadas || 0) <= 2) return { tipo: "nova", texto: "Chegou faz pouco e você quase não ouviu." };
  if (!f.nota && (f.tocadas || 0) <= 1) return { tipo: "descobrir", texto: "Ainda não tem estrelas: depois me conta quantas ela merece." };
  if (dias != null && dias >= 30) return { tipo: "antiga", texto: `Faz ${semanas(dias)} que ela não toca.` };
  if ((f.nota || 0) >= 8) return { tipo: "boa", texto: "Você deu nota alta para ela." };
  return { tipo: "acaso", texto: "Achei que combinava com hoje." };
}
function semanas(dias) {
  if (dias >= 60) { const m = Math.floor(dias / 30); return `${m} meses`; }
  const s = Math.max(2, Math.floor(dias / 7));
  return `${s} semanas`;
}

/**
 * Escolhe a música do dia `data` (AAAA-MM-DD) entre `faixas` (as da biblioteca). o: { hora (para o clima), recentes
 * (ids escolhidos nos últimos 30 dias), troca (0 = a do dia; 1 = a do "Outra"), fora (ids que não podem: a anterior),
 * agora (ms) }. → { faixa, porque } ou null (biblioteca vazia). Estável: os mesmos dados dão a mesma música.
 */
export function escolherMusica(faixas, data, o = {}) {
  const agora = o.agora ?? new Date(data + "T12:00").getTime();
  const r = rng(`eva|musica|${data}|${o.troca || 0}`), climas = CLIMA_HORA(o.hora ?? 18);
  const recentes = new Set(o.recentes || []), fora = new Set(o.fora || []);
  let lista = (faixas || []).filter(f => f && f.id && !f.entrada && !fora.has(f.id) && (f.puladas || 0) <= (f.tocadas || 0) + 2);
  const semRecentes = lista.filter(f => !recentes.has(f.id));
  if (semRecentes.length) lista = semRecentes;
  if (!lista.length) return null;
  const nota = (f) => {
    const dias = f.ultimaVez ? (agora - f.ultimaVez) / DIA : 999;
    let s = r() * 0.9;
    if ((f.nota || 0) >= 8 && dias > 14) s += 1;
    if (f.fav) s += 0.6;
    if ((f.nota || 0) >= 10) s += 0.3;
    if (f.adicionadaEm && agora - f.adicionadaEm < 30 * DIA && (f.tocadas || 0) <= 2) s += 0.5;
    if (!f.nota && (f.tocadas || 0) <= 1) s += 0.35;
    if (climasDe(f).some(c => climas.includes(c))) s += 0.35;
    if (dias < 2) s -= 1;
    if (ehVersaoFeita(f)) s -= 0.15;
    return s;
  };
  const [melhor] = lista.map(f => [nota(f), f]).sort((a, b) => b[0] - a[0] || String(a[1].id).localeCompare(String(b[1].id)));
  const faixa = melhor[1];
  return { faixa, porque: porqueDe(faixa, agora) };
}

// ---------------------------------------------------------------- no app
/** O registro guardado da música de `data` (E().eva.musicas[data]) ou null. */
export const registro = (EVv, data) => EVv.musicas?.[data] || null;
/** Os ids escolhidos nos 30 dias antes de `data` (para não repetir). */
export function recentesDe(musicas = {}, data) {
  const corte = new Date(data + "T12:00"); corte.setDate(corte.getDate() - DIAS_SEM_REPETIR);
  const c = corte.toISOString().slice(0, 10);
  return Object.entries(musicas).filter(([d]) => d >= c && d < data).flatMap(([, m]) => [m.id, ...(m.antes || [])]).filter(Boolean);
}

/** As faixas da biblioteca deste aparelho (vazio se as Músicas nunca foram abertas aqui). */
export async function faixasDaBiblioteca() {
  try { const BD = await import("../musicas/banco.js"); return (await BD.todasFaixas()) || []; } catch { return []; }
}
/** A biblioteca tem músicas neste aparelho? (guardado em localStorage para o plano saber sem abrir o banco) */
const CHAVE_TEM = "orbita.eva.temMusicas";
export function temBibliotecaGuardado() { try { return localStorage.getItem(CHAVE_TEM) === "1"; } catch { return false; } }
export function anotarBiblioteca(n) { try { localStorage.setItem(CHAVE_TEM, n > 0 ? "1" : "0"); } catch { /* */ } }

/**
 * A música do dia de hoje (guardada em E().eva.musicas, sincroniza pelo `em`). Escolhe se ainda não existe; com
 * `trocar`, a do "Outra" (uma vez por dia). → { id, titulo, artista, porque, troca, em } ou null (sem biblioteca).
 */
export async function musicaDeHoje({ data, hora, trocar = false } = {}) {
  const [ES, EV] = await Promise.all([import("../estado.js"), import("./eva.js")]);
  const v = EV.EV(), hoje = data || ES.hojeISO();
  v.musicas ||= {};
  const atual = v.musicas[hoje];
  if (atual && !trocar) return atual;
  if (atual && trocar && (atual.troca || 0) >= 1) return atual;
  const fs = await faixasDaBiblioteca();
  anotarBiblioteca(fs.length);
  if (!fs.length) return null;
  const esc = escolherMusica(fs, hoje, { hora: hora ?? new Date().getHours(), recentes: recentesDe(v.musicas, hoje), troca: trocar ? 1 : 0, fora: atual ? [atual.id] : [], agora: Date.now() });
  if (!esc) return atual || null;
  const f = esc.faixa;
  v.musicas[hoje] = { id: f.id, titulo: f.titulo || "Sem título", artista: f.artista || "Artista desconhecido", porque: esc.porque.texto, troca: trocar ? 1 : 0, ...(atual ? { antes: [atual.id] } : {}), em: new Date().toISOString() };
  // guarda só os últimos 60 dias
  const corte = new Date(hoje + "T12:00"); corte.setDate(corte.getDate() - GUARDAR_DIAS);
  for (const d of Object.keys(v.musicas)) if (d < corte.toISOString().slice(0, 10)) delete v.musicas[d];
  ES.salvar();
  return v.musicas[hoje];
}

/** Toca a música (pelo motor das Músicas). → "tocando" | "abrir" (precisa abrir as Músicas) | "sumiu" */
export async function tocar(id) {
  const [M, BD] = await Promise.all([import("../musicas/motor.js"), import("../musicas/banco.js")]);
  const f = await BD.pegarFaixa(id);
  if (!f) return "sumiu";
  try {
    const e = await M.motor.tocar([f], 0, { aleatorio: false, repetir: "nao" });
    BD.gravarCfg("fila", { ids: [f.id], base: [f.id], aleatorio: false, atual: f.id }).catch(() => {});
    if (M.motor.nativo || e?.querTocar || e?.tocando) return "tocando";
  } catch (e) { console.warn("Eva: tocar a música do dia", e?.message); }
  return "abrir";
}
/** A capa pequena (data URL) ou "". */
export async function capa(id) {
  try {
    const [B, BD] = await Promise.all([import("../musicas/biblioteca.js"), import("../musicas/banco.js")]);
    const f = await BD.pegarFaixa(id);
    return f ? await B.capaDe(f, "mini") : "";
  } catch { return ""; }
}
