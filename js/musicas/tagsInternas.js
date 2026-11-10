// Tags internas das Músicas (pedido do Alediov, 24/10/2026). Dois tipos:
// - de VERSÃO: saem sozinhas dos parênteses do título: Acapella, Acoustic, Live, Orchestral, Remake, Sped Up, Slowed e
//   Instrumental, mais as que ele criar (Remix…). Formato (pedido do Alediov, 24/10/2026): dentro dos parênteses, as
//   versões vão juntas, SEM vírgula, e Instrumental é sempre a última ("Estrondo (Orchestral Instrumental)" está em
//   Orchestral e em Instrumental); a vírgula separa a desambiguação, que vem SEMPRE primeiro: o artista original ou quem
//   participou ("Lua (Anny, Sped Up)", "Estrelas (Kuro)", "Estrelas (Slow)").
// - de GRUPO: postas à mão, como "ブルーロック (Blue Lock)"; ficam na faixa (`faixa.tags`) e DENTRO do arquivo
//   (campo CUSTOM4, "ORBITA_TAGS=…", Etiquetas.java), para sobreviverem a apagar os dados do app.

// na ordem em que aparecem no título (as criadas por ele entram antes de Sped Up; Instrumental sempre por último).
// Remake vem SEMPRE primeiro nos parênteses (pedido do Alediov, 02/11/2026: "facilitaria a busca depois"): buscar
// "Lua (Remake" acha todas as versões do remake. Sem desambiguação, junto das outras: "Lua (Remake Sped Up)"; com
// ela, num pedaço só dele antes da vírgula: "Lua (Remake, Anny, Sped Up)" (formatarTitulo).
import { padronizarTitulo } from "./titulos.js";

export const VERSOES_FIXAS = [
  { nome: "Remake", sinonimos: ["remake"] },
  { nome: "Live", sinonimos: ["live"] },
  { nome: "Acoustic", sinonimos: ["acoustic"] },
  { nome: "Acapella", sinonimos: ["acapella", "a cappella", "a capella", "acappella"] },
  { nome: "Orchestral", sinonimos: ["orchestral"] },
  { nome: "Sped Up", sinonimos: ["sped up", "speed up", "sped-up", "spedup", "sped up + reverb", "sped up & reverb"] },
  { nome: "Slowed", sinonimos: ["slowed", "slowed + reverb", "slowed & reverb", "slowed and reverb", "slowed down", "slowed + reverbed"] },
  { nome: "Instrumental", sinonimos: ["instrumental", "inst.", "inst"] },
];
const ANTES_DE_SPED_UP = VERSOES_FIXAS.findIndex(v => v.nome === "Sped Up");
// versões que o próprio Alediov faz no editor (uma música com elas não ganha outra versão Sped Up)
export const VERSOES_FEITAS = ["Sped Up", "Slowed", "Editada"];

const sem = (s) => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
export const normTag = sem;

/** Versões em uso: as fixas + as criadas (cfg). */
export function listaVersoes(criadas = []) {
  const l = VERSOES_FIXAS.map(v => ({ ...v, fixa: true }));
  const novas = [];
  for (const c of criadas || []) if (c?.nome && !l.some(v => sem(v.nome) === sem(c.nome)) && !novas.some(v => sem(v.nome) === sem(c.nome))) novas.push({ nome: c.nome, sinonimos: [sem(c.nome), ...(c.sinonimos || []).map(sem)], fixa: false });
  l.splice(ANTES_DE_SPED_UP, 0, ...novas);
  return l;
}
let versoesAtuais = listaVersoes();
export const definirVersoes = (criadas) => { versoesAtuais = listaVersoes(criadas); cacheTitulo.clear(); };
export const versoes = () => versoesAtuais;

function versaoDe(parte) {
  const p = sem(parte);
  for (const v of versoesAtuais) if (sem(v.nome) === p || v.sinonimos.includes(p)) return v.nome;
  if (p === "editada") return "Editada";
  return null;
}
/** Um pedaço sem vírgula feito só de versões ("Orchestral Instrumental", "Sped Up") → ["Orchestral", "Instrumental"]; senão null. */
function versoesDoPedaco(pedaco) {
  const w = pedaco.trim().split(/\s+/), out = [];
  for (let i = 0; i < w.length;) {
    let achou = null;
    for (let n = Math.min(4, w.length - i); n >= 1 && !achou; n--) { const v = versaoDe(w.slice(i, i + n).join(" ")); if (v) achou = [v, n]; }
    if (!achou) return null;
    if (!out.includes(achou[0])) out.push(achou[0]);
    i += achou[1];
  }
  return out.length ? out : null;
}
/** A ordem das versões dentro dos parênteses (Instrumental por último). */
export function ordenarVersoes(l) {
  const pos = (v) => { const i = versoesAtuais.findIndex(x => x.nome === v); return v === "Instrumental" ? 999 : v === "Editada" ? 998 : i < 0 ? 500 : i; };
  return [...new Set(l)].sort((a, b) => pos(a) - pos(b));
}

const cacheTitulo = new Map();
/**
 * "Estrondo (Steve, Orchestral Instrumental)" → { base: "Estrondo", extras: ["Steve"], versoes: ["Orchestral", "Instrumental"],
 * partes: ["Steve", "Orchestral", "Instrumental"] }. Lê os grupos entre parênteses ou colchetes do fim (um ou vários) e um
 * " - Sped Up" no fim; cada pedaço entre vírgulas é ou só de versões (juntas, sem vírgula) ou desambiguação (extras).
 */
export function analisarTitulo(titulo) {
  const t = String(titulo || "").replace(/\s+/g, " ").trim();
  if (cacheTitulo.has(t)) return cacheTitulo.get(t);
  let base = t;
  const grupos = [];
  for (;;) {
    const m = base.match(/\s*[([]([^()[\]]*)[)\]]\s*$/);
    if (!m || m.index === 0) break;
    grupos.unshift(m[1]);
    base = base.slice(0, m.index).trim();
  }
  const tr = base.match(/\s+-\s+([^-]+)$/);
  if (tr && versoesDoPedaco(tr[1])) { grupos.push(tr[1]); base = base.slice(0, tr.index).trim(); }
  let versoesT = [];
  const extras = [];
  for (const g of grupos) for (const pedaco of g.split(/\s*,\s*/)) {
    const p = pedaco.trim(); if (!p) continue;
    const vs = versoesDoPedaco(p);
    if (vs) versoesT.push(...vs); else extras.push(p);
  }
  versoesT = ordenarVersoes(versoesT);
  const r = { base: base || t, partes: [...extras, ...versoesT], versoes: versoesT, extras };
  if (cacheTitulo.size > 5000) cacheTitulo.clear();
  cacheTitulo.set(t, r);
  return r;
}

/** Chave para comparar títulos sem ligar para a ordem dentro dos parênteses: "estrelas|kuro,sped up". */
export function chaveConjunto(titulo) { const a = analisarTitulo(titulo); return `${sem(a.base)}|${a.partes.map(sem).sort().join(",")}`; }

/** Junta no formato do Alediov: base + "(desambiguação, Versões Juntas Instrumental)"; o Remake vai na frente de tudo:
 *  "(Remake Sped Up)" sem desambiguação e "(Remake, Kuro, Sped Up)" com ela. */
export function formatarTitulo(base, extras = [], versoesL = []) {
  let vs = ordenarVersoes(versoesL);
  const frente = extras.length && vs.includes("Remake") ? ["Remake"] : [];
  if (frente.length) vs = vs.filter(v => v !== "Remake");
  const dentro = [...frente, ...extras, ...(vs.length ? [vs.join(" ")] : [])];
  return dentro.length ? `${base} (${dentro.join(", ")})` : base;
}
/** Junta uma lista misturada (desambiguação e versões): as versões vão para o fim, juntas. */
export function montarTitulo(base, partes) {
  const ex = [], vs = [];
  for (const p of partes) { const v = versaoDe(p); if (v) vs.push(v); else ex.push(p); }
  return formatarTitulo(base, ex, vs);
}

/** Tags de versão de um título (pelos parênteses). */
export const versoesDoTitulo = (titulo) => analisarTitulo(titulo).versoes.filter(v => v !== "Editada");

/** Todas as tags de uma faixa: as de versão (pelo título) e as de grupo (à mão). */
export function tagsDaFaixa(f) {
  return { versoes: versoesDoTitulo(f?.titulo), grupos: (f?.tags || []).slice() };
}
export const temTag = (f, nome) => { const n = sem(nome); return versoesDoTitulo(f?.titulo).some(v => sem(v) === n) || (f?.tags || []).some(t => sem(t) === n); };

// ---- no arquivo: "ORBITA_TAGS=Tag 1;Tag 2" ----
export const PREFIXO_ARQUIVO = "ORBITA_TAGS=";
export const tagsParaArquivo = (lista) => (lista?.length ? PREFIXO_ARQUIVO + lista.map(t => t.replace(/;/g, ",")).join(";") : "");
export function tagsDoArquivo(txt) {
  if (!txt || !String(txt).startsWith(PREFIXO_ARQUIVO)) return [];
  return String(txt).slice(PREFIXO_ARQUIVO.length).split(";").map(s => s.trim()).filter(Boolean);
}

/** Uma cor estável para cada tag. */
export function corDaTag(nome) {
  let h = 0; for (const c of nome || "?") h = (h * 33 + c.codePointAt(0)) >>> 0;
  return `hsl(${h % 360} 62% 50%)`;
}

/** O título no padrão do Alediov: palavras (titulos.js) e parênteses (Remake primeiro, depois a desambiguação, as outras
 *  versões juntas e Instrumental por último). */
export function tituloNoPadrao(titulo) {
  const t = padronizarTitulo(titulo);
  if (!t) return t;
  const a = analisarTitulo(t);
  return a.versoes.length ? formatarTitulo(a.base, a.extras, a.versoes) : t;
}
