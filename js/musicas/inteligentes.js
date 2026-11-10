// Playlists inteligentes (fase 2 do plano das Músicas, 24/10/2026): regras para incluir (todas ou qualquer uma),
// regras para EXCLUIR (basta uma bater: tag interna, artista, gênero…), músicas tiradas à mão (`fora`), limite
// (músicas ou minutos) e ordem. A playlist guarda só as regras; as músicas são calculadas na hora.
import { temTag } from "./tagsInternas.js";

const sem = (s) => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const DIA = 86400000;

/** Campos das regras: rótulo, operações e tipo do valor (estrelas, texto, numero, dias, tag, formato, playlist ou nenhum). */
export const CAMPOS = {
  estrelas: { nome: "Estrelas", valor: "estrelas", ops: { ">=": "no mínimo", "<=": "no máximo", "=": "exatamente", sem: "sem estrelas" } },
  favorita: { nome: "Favorita (coração)", valor: "nenhum", ops: { sim: "é favorita", nao: "não é favorita" } },
  tag: { nome: "Tag interna", valor: "tag", ops: { tem: "tem", naoTem: "não tem" } },
  grupoTag: { nome: "Grupo de tags", valor: "grupoTag", ops: { tem: "tem tag de", naoTem: "não tem tag de" } },
  artista: { nome: "Artista", valor: "texto", prever: "artista", ops: { e: "é", naoE: "não é", contem: "contém" } },
  titulo: { nome: "Título", valor: "texto", ops: { contem: "contém", naoContem: "não contém", comeca: "começa com" } },
  genero: { nome: "Gênero", valor: "texto", prever: "genero", ops: { e: "é", naoE: "não é", contem: "contém" } },
  clima: { nome: "Clima (pelo som)", valor: "clima", ops: { tem: "é", naoTem: "não é" } },
  ano: { nome: "Ano", valor: "numero", ops: { ">=": "a partir de", "<=": "até", "=": "igual a" } },
  tocadas: { nome: "Vezes tocada", valor: "numero", ops: { ">=": "no mínimo", "<=": "no máximo", "=": "exatamente" } },
  puladas: { nome: "Vezes pulada", valor: "numero", ops: { ">=": "no mínimo", "<=": "no máximo" } },
  ultimaVez: { nome: "Última vez tocada", valor: "dias", ops: { haMais: "há mais de", haMenos: "há menos de", nunca: "nunca tocada" } },
  adicionada: { nome: "Adicionada", valor: "dias", ops: { ultimos: "nos últimos", haMais: "há mais de" } },
  duracao: { nome: "Duração (min)", valor: "numero", ops: { ">=": "no mínimo", "<=": "no máximo" } },
  formato: { nome: "Formato", valor: "formato", ops: { e: "é", naoE: "não é" } },
  playlist: { nome: "Playlist", valor: "playlist", ops: { em: "está em", naoEm: "não está em" } },
};
export const FORMATOS = ["mp3", "flac", "m4a", "ogg", "opus", "wav", "aac"];
export const ORDENS_INTELIGENTE = {
  titulo: "Título", artista: "Artista", nota: "Estrelas", tocadas: "Mais tocadas", menosTocadas: "Menos tocadas",
  recentes: "Adicionadas por último", esquecidas: "Tocadas há mais tempo", puladas: "Mais puladas", aleatoria: "Sorteio do dia",
};

export const novaRegra = (campo = "estrelas") => {
  const c = CAMPOS[campo];
  return { campo, op: Object.keys(c.ops)[0], valor: c.valor === "estrelas" ? 8 : c.valor === "dias" ? 30 : c.valor === "numero" ? 1 : c.valor === "formato" ? "flac" : "" };
};

const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const comparar = (a, op, b) => (op === ">=" ? a >= b : op === "<=" ? a <= b : a === b);

/** Uma regra bate com a faixa? `ctx`: { agora, playlists: Map id → Set de ids, categorias: Map grupo → Set de tags }. */
export function bate(f, r, ctx) {
  const v = r.valor;
  switch (r.campo) {
    case "estrelas": return r.op === "sem" ? !f.nota : !!f.nota && comparar(f.nota || 0, r.op, num(v));
    case "favorita": return r.op === "sim" ? !!f.fav : !f.fav;
    case "tag": { if (!v) return r.op !== "tem"; const t = temTag(f, v); return r.op === "tem" ? t : !t; }
    case "clima": { const t = (f.clima || []).includes(v); return r.op === "tem" ? t : !t; }
    case "grupoTag": { const s = ctx.categorias?.get(sem(v)); const t = !!s && (f.tags || []).some(x => s.has(sem(x))); return r.op === "tem" ? t : !t; }
    case "artista": case "titulo": case "genero": {
      const a = sem(f[r.campo]), b = sem(v);
      if (r.op === "e") return a === b;
      if (r.op === "naoE") return a !== b;
      if (r.op === "contem") return a.includes(b);
      if (r.op === "naoContem") return !a.includes(b);
      if (r.op === "comeca") return a.startsWith(b);
      return false;
    }
    case "ano": return !!f.ano && comparar(num(f.ano), r.op, num(v));
    case "tocadas": return comparar(f.tocadas || 0, r.op, num(v));
    case "puladas": return comparar(f.puladas || 0, r.op, num(v));
    case "duracao": return comparar((f.duracao || 0) / 60000, r.op, num(v));
    case "ultimaVez":
      if (r.op === "nunca") return !f.ultimaVez && !f.tocadas;
      if (!f.ultimaVez) return r.op === "haMais";
      return r.op === "haMais" ? ctx.agora - f.ultimaVez > num(v) * DIA : ctx.agora - f.ultimaVez <= num(v) * DIA;
    case "adicionada": { const d = ctx.agora - (f.adicionadaEm || 0); return r.op === "ultimos" ? d <= num(v) * DIA : d > num(v) * DIA; }
    case "formato": return r.op === "e" ? f.formato === v : f.formato !== v;
    case "playlist": { const s = ctx.playlists?.get(v); const em = !!s?.has(f.id); return r.op === "em" ? em : !em; }
    default: return true;
  }
}

// sorteio do dia: a mesma ordem durante o dia (não muda a cada vez que a tela é desenhada)
function semente(txt) { let h = 2166136261; for (const c of txt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function sorteio(lista, chave) {
  let s = semente(chave);
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const l = lista.slice();
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

/** Ordena; `porTitulo` vem da biblioteca. */
export function ordenar(lista, ordem, porTitulo, chave = "") {
  const l = lista.slice();
  const fn = {
    titulo: porTitulo,
    artista: (a, b) => a.artista.localeCompare(b.artista, "pt-BR", { sensitivity: "base" }) || porTitulo(a, b),
    nota: (a, b) => (b.nota || 0) - (a.nota || 0) || porTitulo(a, b),
    tocadas: (a, b) => (b.tocadas || 0) - (a.tocadas || 0) || porTitulo(a, b),
    menosTocadas: (a, b) => (a.tocadas || 0) - (b.tocadas || 0) || porTitulo(a, b),
    recentes: (a, b) => (b.adicionadaEm || 0) - (a.adicionadaEm || 0) || porTitulo(a, b),
    esquecidas: (a, b) => (a.ultimaVez || 0) - (b.ultimaVez || 0) || porTitulo(a, b),
    puladas: (a, b) => (b.puladas || 0) - (a.puladas || 0) || porTitulo(a, b),
  }[ordem];
  if (ordem === "aleatoria") return sorteio(l, `${chave}|${new Date().toDateString()}`);
  return l.sort(fn || porTitulo);
}

/** As músicas de uma playlist inteligente. */
export function calcular(pl, faixas, { porTitulo, playlists = new Map(), categorias = new Map(), agora = Date.now() } = {}) {
  const R = pl.regras || {}, inc = R.incluir || [], exc = R.excluir || [], fora = new Set(pl.fora || []);
  const ctx = { agora, playlists, categorias };
  let l = faixas.filter(f => {
    if (fora.has(f.id)) return false;
    if (inc.length) { const ok = R.modo === "qualquer" ? inc.some(r => bate(f, r, ctx)) : inc.every(r => bate(f, r, ctx)); if (!ok) return false; }
    return !exc.some(r => bate(f, r, ctx));
  });
  l = ordenar(l, pl.ordem || "titulo", porTitulo, pl.id || "");
  if (pl.limite > 0) {
    if (pl.limiteTipo === "minutos") { let t = 0; const out = []; for (const f of l) { if (t + (f.duracao || 0) > pl.limite * 60000 && out.length) break; out.push(f); t += f.duracao || 0; } l = out; }
    else l = l.slice(0, pl.limite);
  }
  return l;
}

const nomeEstrelas = (n) => `${String(n / 2).replace(".", ",")}★`;
/** Resumo curto das regras, para o subtítulo ("5★ · sem Sped Up"). */
export function resumo(pl, nomesPlaylists = new Map()) {
  const R = pl.regras || {};
  const t = (r) => {
    const c = CAMPOS[r.campo]; if (!c) return "";
    if (r.campo === "estrelas") return r.op === "sem" ? "sem estrelas" : r.op === "=" ? nomeEstrelas(r.valor) : `${r.op === ">=" ? "≥" : "≤"} ${nomeEstrelas(r.valor)}`;
    if (r.campo === "favorita") return r.op === "sim" ? "favoritas" : "não favoritas";
    if (r.campo === "tag") return r.op === "tem" ? r.valor : `sem ${r.valor}`;
    if (r.campo === "grupoTag") return r.op === "tem" ? `de ${r.valor}` : `sem ${r.valor}`;
    if (r.campo === "clima") return r.op === "tem" ? r.valor.toLowerCase() : `sem ${r.valor.toLowerCase()}`;
    if (r.campo === "ultimaVez") return r.op === "nunca" ? "nunca tocadas" : `tocada ${c.ops[r.op]} ${r.valor} dias`;
    if (r.campo === "adicionada") return `adicionada ${c.ops[r.op]} ${r.valor} dias`;
    if (r.campo === "playlist") return `${c.ops[r.op]} ${nomesPlaylists.get(r.valor) || "playlist"}`;
    return `${c.nome.toLowerCase()} ${c.ops[r.op]} ${r.valor}`;
  };
  // exclusões em português corrente: "sem Sped Up", "sem Steve", "sem as favoritas", "exceto gênero contém rock"
  const ex = (r) => {
    if ((r.campo === "tag" || r.campo === "grupoTag") && r.op === "tem") return `sem ${r.valor}`;
    if ((r.campo === "artista" || r.campo === "genero") && r.op === "e") return `sem ${r.valor}`;
    if (r.campo === "favorita") return r.op === "sim" ? "sem as favoritas" : "só favoritas";
    if (r.campo === "playlist" && r.op === "em") return `sem as de ${nomesPlaylists.get(r.valor) || "outra playlist"}`;
    const x = t(r); return x ? `exceto ${x}` : "";
  };
  const inc = (R.incluir || []).map(t).filter(Boolean), exc = (R.excluir || []).map(ex).filter(Boolean);
  const partes = [inc.length ? inc.join(R.modo === "qualquer" ? " ou " : " · ") : "todas as músicas", ...exc];
  if (pl.limite > 0) partes.push(`até ${pl.limite} ${pl.limiteTipo === "minutos" ? "min" : "músicas"}`);
  return partes.join(" · ");
}

/** Modelos prontos (o plano: 5 estrelas, 4+, 4+ esquecidas, nunca tocadas, recentes, mais puladas…). */
export const MODELOS = [
  { nome: "5 Estrelas", regras: { modo: "todas", incluir: [{ campo: "estrelas", op: "=", valor: 10 }], excluir: [] }, ordem: "aleatoria" },
  { nome: "4 Estrelas ou Mais", regras: { modo: "todas", incluir: [{ campo: "estrelas", op: ">=", valor: 8 }], excluir: [] }, ordem: "aleatoria" },
  { nome: "Boas & Esquecidas", regras: { modo: "todas", incluir: [{ campo: "estrelas", op: ">=", valor: 8 }, { campo: "ultimaVez", op: "haMais", valor: 30 }], excluir: [] }, ordem: "esquecidas" },
  { nome: "Nunca Tocadas", regras: { modo: "todas", incluir: [{ campo: "ultimaVez", op: "nunca", valor: 0 }], excluir: [] }, ordem: "recentes" },
  { nome: "Chegaram Agora", regras: { modo: "todas", incluir: [{ campo: "adicionada", op: "ultimos", valor: 30 }], excluir: [] }, ordem: "recentes" },
  { nome: "Mais Puladas", regras: { modo: "todas", incluir: [{ campo: "puladas", op: ">=", valor: 3 }], excluir: [] }, ordem: "puladas", limite: 50 },
  { nome: "Só Sped Up", regras: { modo: "todas", incluir: [{ campo: "tag", op: "tem", valor: "Sped Up" }], excluir: [] }, ordem: "aleatoria" },
  { nome: "Originais", regras: { modo: "todas", incluir: [], excluir: [{ campo: "tag", op: "tem", valor: "Sped Up" }, { campo: "tag", op: "tem", valor: "Slowed" }, { campo: "tag", op: "tem", valor: "Instrumental" }] }, ordem: "titulo" },
];

