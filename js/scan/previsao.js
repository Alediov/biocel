// Previsões de texto do OdontoScan: município, bairro (Cascavel) e clínica.
// O texto digitado (ou lido da ficha, com abreviações como "Cvel" e "Jd") é comparado com as listas;
// a ordem junta a semelhança, o quanto aquele valor já foi usado e, nos municípios, a distância de Cascavel.
import { MUNICIPIOS, BAIRROS, RUAS, SUBBAIRROS, DISTRITOS } from "./lugares.js";

export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ABREV = {
  sta: "santa", sto: "santo", s: "sao", sr: "senhor", sra: "senhora", nsa: "nossa", ns: "nossa", n: "nossa",
  pq: "parque", pque: "parque", jd: "jardim", jdm: "jardim", jar: "jardim", vl: "vila", res: "residencial", resid: "residencial",
  cj: "conjunto", conj: "conjunto", hab: "habitacional", habit: "habitacional", cond: "condominio", lot: "loteamento", lt: "loteamento", cvel: "cascavel", cvl: "cascavel", cv: "cascavel", cac: "cascavel",
  fco: "francisco", gal: "general", pres: "presidente", mal: "marechal", dr: "doutor", eng: "engenheiro", prof: "professor",
  univ: "universitario", sj: "sao joao", sm: "sao miguel", fz: "foz", reg: "regiao", doeste: "d oeste",
};
const expandir = (t) => norm(t).split(" ").filter(Boolean).map(p => ABREV[p] || p).join(" ");

function levenshtein(a, b) {
  if (a === b) return 0;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const at = [i];
    for (let j = 1; j <= b.length; j++) at[j] = Math.min(ant[j] + 1, at[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = at;
  }
  return ant[b.length];
}
/** Semelhança de 0 a 1000 entre o texto digitado (já normalizado) e um candidato (normalizado). */
export function semelhanca(q, c) {
  if (!q) return 1;
  if (q === c) return 1000;
  if (c.startsWith(q)) return 900 - Math.min(80, c.length - q.length);
  const qt = q.split(" "), ct = c.split(" ");
  let j = 0;
  for (const p of qt) { while (j < ct.length && !ct[j].startsWith(p)) j++; if (j++ >= ct.length) { j = -1; break; } }
  if (j !== -1) return 800 - Math.min(80, c.length - q.length);
  if (c.includes(q)) return 700;
  // letras na ordem, começando pela mesma ("cvel" → "cascavel")
  const qs = q.replace(/ /g, ""), cs = c.replace(/ /g, "");
  if (qs.length >= 2 && qs[0] === cs[0]) {
    let k = 0, fim = 0;
    for (let i = 0; i < cs.length && k < qs.length; i++) if (cs[i] === qs[k]) { k++; fim = i; }
    if (k === qs.length) return 500 + Math.round(100 * qs.length / (fim + 1)) + (fim === cs.length - 1 ? 30 : 0);
  }
  if (q.length >= 3 && (q[0] === c[0] || q[1] === c[1])) {
    const pedaco = c.slice(0, Math.max(q.length, Math.min(c.length, q.length + 2)));
    const r = 1 - Math.min(levenshtein(q, c), levenshtein(q, pedaco) + 1) / Math.max(q.length, 3);
    if (r >= 0.5) return 300 + Math.round(r * 200);
  }
  return 0;
}

// ---------------- listas ----------------
const MUN = MUNICIPIOS.split("\n").map((l, i) => { const [nome, uf] = l.split("|"); return { nome, uf, n: norm(nome), rank: i }; });
// rua → bairros por onde passa (o 1º é o do GeoCascavel; os outros, do OpenStreetMap)
const RUA = new Map(RUAS.split("\n").map(l => { const [r, is] = l.split("|"); return [r, is.split(",").map(i => BAIRROS[+i])]; }));
// a mesma rua sem os títulos ("presidente tancredo neves" → "tancredo neves"), quando não há outra igual
const TITULOS = /^((presidente|doutor|doutora|general|marechal|coronel|capitao|tenente|major|sargento|brigadeiro|almirante|professor|professora|padre|frei|dom|dona|senador|deputado|governador|prefeito|vereador|engenheiro|ministro|monsenhor|irma|santa|santo|sao|nossa senhora|pioneiro|pioneira|comendador|desembargador|juiz|cabo|soldado|visconde|barao|conde|duque|princesa|imperatriz|maestro|poeta|jornalista|vice|bispo|madre|irmao|beato|beata) )+/;
const RUA_CURTA = new Map();
for (const r of RUA.keys()) { const c = r.replace(TITULOS, ""); if (c !== r && c.includes(" ")) RUA_CURTA.set(c, RUA_CURTA.has(c) ? null : r); }
// a mesma rua com e sem o título (GeoCascavel "presidente tancredo neves", OSM "tancredo neves"): junta os bairros
for (const [c, r] of RUA_CURTA) if (r && RUA.has(c)) { const u = [...new Set([...RUA.get(r), ...RUA.get(c)])]; RUA.set(r, u); RUA.set(c, u); }
// sub-bairros (jardins, loteamentos, conjuntos e condomínios do OSM) → bairro; mais os aprendidos nas revisões
const SUB = new Map(SUBBAIRROS.split("\n").filter(Boolean).map(l => { const [n, i] = l.split("|"); return [n, BAIRROS[+i]]; }));
const APRENDIDO = new Map();
// bairros com mais ruas vêm antes quando nada foi digitado; áreas rurais e distritos por último
const NRUAS = {}; for (const b of RUA.values()) NRUAS[b[0]] = (NRUAS[b[0]] || 0) + 1;
const BAI = BAIRROS.map(nome => ({ nome, n: norm(nome), peso: /^(area rural|distritos|chacaras)$/.test(norm(nome)) ? 0 : Math.min(30, Math.round((NRUAS[nome] || 0) / 4)) }));

/** Nome do município como vai para a planilha: só o nome no Paraná, "Nome - UF" fora dele. */
export const rotuloMunicipio = (m) => m.uf === "PR" ? m.nome : `${m.nome} - ${m.uf}`;
export const ehCascavel = (t) => norm(t) === "cascavel";

/** Separa "Lapa - PR", "Lapa/PR", "Joinville SC" em nome e UF. */
function separarUf(texto) {
  const m = String(texto || "").trim().match(/^(.*?)[\s\-–/,(]+([A-Za-z]{2})\)?$/);
  const ufs = new Set(MUN.map(x => x.uf));
  if (m && ufs.has(m[2].toUpperCase())) return [m[1], m[2].toUpperCase()];
  return [texto, null];
}

const GENERICOS = /^(jardim|vila|loteamento|residencial|conjunto|bairro|condominio) /;
function ranquear(lista, texto, extra, limite) {
  const q = expandir(texto), q2 = GENERICOS.test(q) ? q.replace(GENERICOS, "") : null;
  const out = [];
  for (const it of lista) {
    const s = Math.max(semelhanca(q, it.n), q2 ? semelhanca(q2, it.n) - 30 : 0);
    if (s > 0) out.push({ it, s: s + extra(it, s) });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limite);
}
const usoDe = (uso, nome) => uso?.get(norm(nome)) || 0;

/** Municípios mais prováveis para o texto. `uso`: Map(nome normalizado → vezes usado nas fichas). */
export function sugerirMunicipios(texto, uso, limite = 6) {
  const [nome, uf] = separarUf(texto);
  const lista = uf ? MUN.filter(m => m.uf === uf) : MUN;
  return ranquear(lista, nome, (m) => Math.min(150, 40 * usoDe(uso, rotuloMunicipio(m))) + Math.round(90 * Math.exp(-m.rank / 60)) + (m.uf === "PR" ? 20 : 0), limite)
    .map(({ it, s }) => ({ valor: rotuloMunicipio(it), pontos: s }));
}

/** Bairros de Cascavel mais prováveis; `bairroDaRua` (se houver) vem primeiro. Valores já usados que não estão na lista também entram. */
export function sugerirBairros(texto, uso, bairroDaRua = null, limite = 6) {
  // bairroDaRua: o bairro da rua ou a lista dos bairros por onde ela passa (o 1º é o principal)
  const daRua = Array.isArray(bairroDaRua) ? bairroDaRua : bairroDaRua ? [bairroDaRua] : [];
  const bonus = (nome) => { const i = daRua.indexOf(nome); return i < 0 ? 0 : i === 0 ? 400 : 300; };
  const extras = [...(uso?.keys() || [])].filter(n => !BAI.some(b => b.n === n)).map(n => ({ nome: uso.nomes?.get(n) || n, n }));
  const r = ranquear([...BAI, ...extras], texto, (b) => Math.min(150, 40 * usoDe(uso, b.nome)) + (b.peso || 0) + bonus(b.nome), limite)
    .map(({ it, s }) => ({ valor: it.nome, pontos: s, pelaRua: daRua.includes(it.nome) }));
  // sem nada digitado, os bairros da rua vêm primeiro
  if (!norm(texto)) {
    for (const b of [...daRua].reverse()) { const i = r.findIndex(x => x.valor === b); if (i >= 0) r.splice(i, 1); r.unshift({ valor: b, pontos: 1000, pelaRua: true }); }
  } else if (daRua[0] && !r.some(x => x.valor === daRua[0])) r.unshift({ valor: daRua[0], pontos: 1000, pelaRua: true });
  return r.slice(0, limite);
}

/** Clínicas (nomes da tabela e nomes já usados, como o do professor que atendeu). */
export function sugerirTexto(texto, opcoes, uso, limite = 6, bonus = () => 0) {
  const lista = [...new Set([...opcoes, ...(uso?.nomes?.values() || [])])].map(nome => ({ nome, n: norm(nome) }));
  return ranquear(lista, texto, (o) => Math.min(150, 40 * usoDe(uso, o.nome)) + bonus(o.nome), limite).map(({ it, s }) => ({ valor: it.nome, pontos: s }));
}

const TIPO_RUA = /^(rua|r|avenida|av|aven|travessa|trav|tv|estrada|estr|est|rodovia|rod|alameda|al|praca|pc|pca|via|linha)\s+/;
/**
 * Os bairros por onde uma rua de Cascavel passa (sem "Rua", "Av."; sem número): `bairros[0]` é o do GeoCascavel e os
 * outros vêm do OpenStreetMap; `exata` diz se o nome bateu inteiro (senão, foi pela semelhança, ≥ 85%). null se não achou.
 */
export function bairrosDaRua(rua) {
  const r = expandir(norm(rua).replace(TIPO_RUA, "").replace(/\s+(n|no|num|numero)?\s*\d+.*$/, "").replace(/\s+(n|no|num|numero|s n|sn)$/, "")).trim();
  if (!r) return null;
  if (RUA.has(r)) return { bairros: RUA.get(r), exata: true };
  const curta = r.replace(TITULOS, ""), k = RUA_CURTA.get(curta) || RUA_CURTA.get(r);
  if (k) return { bairros: RUA.get(k), exata: true };
  if (curta !== r && RUA.has(curta)) return { bairros: RUA.get(curta), exata: true };
  let melhor = null, mel = 0;
  for (const [nome, bairros] of RUA) {
    if (Math.abs(nome.length - r.length) > 3) continue;
    const s = 1 - levenshtein(r, nome) / Math.max(r.length, nome.length);
    if (s > mel) { mel = s; melhor = bairros; }
  }
  return mel >= 0.85 ? { bairros: melhor, exata: false } : null;
}
/** O bairro principal de uma rua (o do GeoCascavel), para as previsões. */
export const bairroDaRua = (rua) => bairrosDaRua(rua)?.bairros[0] || null;

const SEM_GENERICO = (k) => k.replace(/^(conjunto habitacional|condominio residencial|jardim|parque|vila|residencial|conjunto|loteamento|condominio|bairro|chacaras|chacara) /, "");
/** Sub-bairro (jardim, loteamento, conjunto, condomínio) → o bairro onde fica, pelo OSM ou pelas revisões. null se não souber. */
export function bairroDoSubBairro(texto) {
  const k = expandir(texto);
  if (!k) return null;
  for (const m of [APRENDIDO, SUB]) {
    if (m.has(k)) return m.get(k);
    const c = SEM_GENERICO(k);
    for (const [n, b] of m) if (SEM_GENERICO(n) === c) return b;
  }
  return null;
}
/**
 * Aprende com as fichas revisadas: o bairro escrito (lido) que não é bairro oficial e que, na revisão, virou um bairro
 * oficial (ex.: "Jd. Gramado" → Cancelli). Fica valendo o bairro mais usado para cada nome.
 */
export function aprenderSubBairros(fichas) {
  const cont = new Map();
  for (const f of fichas) {
    const lido = f.leitura?.endereco?.bairro, rev = f.revisao?.bairro;
    if (!lido || !rev || !(f.etapa === "revisada" || f.revisadaEm) || !BAI.some(b => b.nome === rev)) continue;
    const k = expandir(lido);
    if (!k || BAI.some(b => b.n === k) || bairroOficial(lido).exato) continue;
    const m = cont.get(k) || new Map(); m.set(rev, (m.get(rev) || 0) + 1); cont.set(k, m);
  }
  APRENDIDO.clear();
  for (const [k, m] of cont) APRENDIDO.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0]);
}

/** Normaliza o município lido: devolve o nome oficial quando a semelhança é alta, senão o texto como escrito. */
export function municipioOficial(texto) {
  if (!texto) return "";
  const s = sugerirMunicipios(texto, null, 2);
  if (s[0] && (s[0].pontos >= 700 || (s[0].pontos >= 500 && (!s[1] || s[0].pontos - s[1].pontos >= 40)))) return s[0].valor;
  return String(texto).trim();
}
/**
 * Distrito de Cascavel escrito no campo Município (ex.: "Juvinópolis", "Dist. Rio do Salto - Cascavel"): devolve o nome
 * do distrito, ou null. Se o nome também for de um município do Paraná, fica o município (não é distrito).
 */
export function distritoComoMunicipio(texto) {
  if (!texto || ehCascavel(texto)) return null;
  const limpa = (t) => norm(t).replace(/\b(distrito|dist|de|do|da|cascavel|pr)\b/g, " ").replace(/\s+/g, " ").trim();
  const k = limpa(texto);
  if (!k) return null;
  let achou = null;
  for (const d of DISTRITOS) {
    const n = limpa(d);
    if (n === k || (k.length >= 6 && 1 - levenshtein(k, n) / Math.max(k.length, n.length) >= 0.85)) { achou = d; break; }
  }
  if (!achou) return null;
  const mun = MUN.find(m => m.n === norm(texto).replace(/\s+(pr|parana)$/, "") && m.uf === "PR");
  return mun ? null : achou;
}

/** Normaliza o bairro lido (Cascavel): nome do GeoCascavel quando a semelhança é alta; `confiavel` diz se achou. */
// `exato`: escrito igual ao nome oficial (só sem acento ou com abreviação); `confiavel` também aceita erro pequeno de
// escrita e "Jardim"/"Jd." antes do nome oficial inteiro (ex.: "Jd. Universitário"), mas não um pedaço do nome
// ("Jardim Tropical" não é "Recanto Tropical": é sub-bairro)
export function bairroOficial(texto) {
  if (!texto) return { valor: "", confiavel: true, exato: true };
  const q = expandir(texto), q2 = GENERICOS.test(q) ? q.replace(GENERICOS, "") : null;
  const parecido = (a, b) => a.length >= 6 && Math.abs(a.length - b.length) <= 2 && 1 - levenshtein(a, b) / Math.max(a.length, b.length) >= 0.85;
  const r = BAI.map(b => ({ b, s: Math.max(semelhanca(q, b.n), q2 && q2 === b.n ? 990 : 0, parecido(q, b.n) ? 760 : 0) })).filter(x => x.s >= 700).sort((a, b) => b.s - a.s);
  if (r[0] && (!r[1] || r[0].s > r[1].s)) return { valor: r[0].b.nome, confiavel: true, exato: r[0].s === 1000 };
  return { valor: String(texto).trim(), confiavel: false, exato: false };
}

/** Conta quantas vezes cada valor foi usado nas fichas revisadas (para as previsões aprenderem). */
export function contarUso(valores) {
  const m = new Map(); m.nomes = new Map();
  for (const v of valores) { const k = norm(v); if (!k) continue; m.set(k, (m.get(k) || 0) + 1); if (!m.nomes.has(k)) m.nomes.set(k, String(v).trim()); }
  return m;
}
