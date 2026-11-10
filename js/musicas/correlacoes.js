// "Você e a música" (pedido do Alediov, 04/11/2026: "estatísticas de volume, de clima, de horários e de correlações com a
// agenda das músicas que ouço… ver se há correlações, como, em dias cansativos, ouvir músicas com volumes mais altos").
// Contas puras (sem DOM, sem estado), testadas no node: tools/musicas/teste_correlacoes.mjs.
//
// Regras das frases (honestas, sem concluir causa):
// - Comparação de dois grupos de DIAS (ex.: corridos × livres): só vira frase com pelo menos MIN_DIAS dias de cada lado
//   e uma diferença relevante (DIFERENCA por medida); com menos dias, "ainda poucos dias"; com diferença pequena,
//   "sem diferença clara". A frase diz as duas médias e quantos dias há de cada lado.
// - Relação entre duas medidas contínuas por dia (ex.: horas fora de casa × volume): correlação de Spearman (pelos
//   postos, com empates pela média), só com MIN_PARES dias e |ρ| ≥ 0,3; a frase diz "relação fraca/moderada/forte" e n.

export const MIN_DIAS = 5, MIN_PARES = 10, RHO_MIN = 0.3;
export const DIA_MS = 86400000;
/** Energia do clima das músicas (genero.js CLIMAS). */
export const ENERGIA_CLIMA = { Animada: "alta", Agressiva: "alta", "Dançante": "alta", Calma: "baixa", "Melancólica": "baixa", "Romântica": "baixa" };
export const CLIMAS_ORDEM = ["Animada", "Dançante", "Agressiva", "Romântica", "Calma", "Melancólica"];
export const SAIDAS = { fone: "Fone com fio", bluetooth: "Bluetooth", "alto-falante": "Alto-falante", carro: "Carro", outro: "Outra saída", navegador: "Navegador" };

export function diaDe(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Os climas de uma faixa (genero.js `climaDe` devolve uma lista de 1 ou 2; aceita também um nome só). */
export const climasDe = (f) => (Array.isArray(f?.clima) ? f.clima : f?.clima ? [f.clima] : []).filter(c => typeof c === "string" && c);
/** A hora "do meio" da reprodução (o histórico anota o fim). */
export const meioDe = (r) => (r.em || 0) - Math.min(r.dur || 0, 20 * 60000) / 2;

/**
 * Junta as reproduções por dia. `faixas`: Map id → faixa (para `loud` e `clima`, que valem também para o histórico
 * antigo). Devolve Map dia → { dia, min, toc, pul, volS, volN, loudS, loudW, climas {nome: min}, horas [24 min],
 * saidas {s: n}, chuvaMin, secoMin, tS, tN, ms (o 1º instante) }.
 */
export function porDia(reps, faixas = new Map()) {
  const out = new Map();
  for (const r of reps) {
    const meio = meioDe(r), dia = diaDe(meio);
    let d = out.get(dia);
    if (!d) out.set(dia, d = { dia, min: 0, toc: 0, pul: 0, volS: 0, volN: 0, loudS: 0, loudW: 0, climas: {}, horas: Array(24).fill(0), saidas: {}, chuvaMin: 0, secoMin: 0, tS: 0, tN: 0, ms: meio });
    const f = faixas.get?.(r.id);
    if (typeof r.vol === "number") { d.volS += r.vol; d.volN++; }
    if (r.saida) d.saidas[r.saida] = (d.saidas[r.saida] || 0) + 1;
    if (r.tipo === "pulada") { d.pul++; continue; }
    if (r.tipo !== "tocada") continue;
    const m = (r.dur || f?.duracao || 0) / 60000;
    d.toc++; d.min += m;
    d.horas[new Date(meio).getHours()] += m;
    if (f && typeof f.loud === "number" && f.loud > -60) { d.loudS += f.loud * Math.max(m, 0.5); d.loudW += Math.max(m, 0.5); }
    const cl = climasDe(f); for (const c of cl) d.climas[c] = (d.climas[c] || 0) + m / cl.length; // dois climas: metade para cada
    if (r.tempo) { if (r.tempo.chuva) d.chuvaMin += m; else d.secoMin += m; if (typeof r.tempo.t === "number") { d.tS += r.tempo.t; d.tN++; } }
  }
  return out;
}

// medidas por dia (null quando não há como medir)
export const MEDIDAS = {
  volume: { nome: "volume do aparelho", valor: (d) => (d.volN ? d.volS / d.volN : null), fmt: (v) => `${Math.round(v * 100)}%`, dif: 0.05 },
  minutos: { nome: "tempo ouvindo", valor: (d) => (d.toc ? d.min : null), fmt: (v) => horasTx(v), dif: (a, b) => Math.max(10, 0.2 * Math.max(a, b)) },
  intensidade: { nome: "intensidade das músicas", valor: (d) => (d.loudW ? d.loudS / d.loudW : null), fmt: (v) => intensidadeTx(v), dif: 1 },
  agitadas: { nome: "músicas agitadas", valor: (d) => fracaoClima(d, "alta"), fmt: (v) => `${Math.round(v * 100)}%`, dif: 0.1 },
  calmas: { nome: "músicas calmas", valor: (d) => fracaoClima(d, "baixa"), fmt: (v) => `${Math.round(v * 100)}%`, dif: 0.1 },
  agressivas: { nome: "músicas Agressivas", valor: (d) => fracaoClima(d, "Agressiva"), fmt: (v) => `${Math.round(v * 100)}%`, dif: 0.08 },
  puladas: { nome: "puladas", valor: (d) => (d.toc + d.pul >= 3 ? d.pul / (d.toc + d.pul) : null), fmt: (v) => `${Math.round(v * 100)}%`, dif: 0.08 },
};
export function fracaoClima(d, energia) {
  let tot = 0, x = 0;
  // `energia`: "alta" | "baixa" (os climas daquela energia) ou o nome de um clima
  for (const [c, m] of Object.entries(d.climas || {})) { if (!ENERGIA_CLIMA[c]) continue; tot += m; if (ENERGIA_CLIMA[c] === energia || c === energia) x += m; }
  return tot >= 3 ? x / tot : null;
}
export function horasTx(min) { const m = Math.round(min); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`; }
/** A intensidade (aproximação de LUFS do volume.js) em palavras. */
export function intensidadeTx(l) {
  const n = l >= -9 ? "muito forte" : l >= -12 ? "forte" : l >= -16 ? "média" : "suave";
  return `${n} (${String(Math.round(l * 10) / 10).replace(".", ",")} dB)`;
}
export const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);

/**
 * Compara dois grupos de dias. `grupo(d)` → "a" | "b" | null; `medida`: chave de MEDIDAS (ou {valor, dif}).
 * Devolve { a: {n, media}, b: {n, media}, dif, situacao: "ok" | "poucos" | "parecido" }.
 */
export function comparar(dias, grupo, medida, { minDias = MIN_DIAS } = {}) {
  const M = typeof medida === "string" ? MEDIDAS[medida] : medida;
  const va = [], vb = [];
  for (const d of dias) {
    const g = grupo(d); if (g !== "a" && g !== "b") continue;
    const v = M.valor(d); if (v == null || !Number.isFinite(v)) continue;
    (g === "a" ? va : vb).push(v);
  }
  const a = { n: va.length, media: media(va) }, b = { n: vb.length, media: media(vb) };
  if (a.n < minDias || b.n < minDias) return { a, b, dif: null, situacao: "poucos" };
  const dif = a.media - b.media, lim = typeof M.dif === "function" ? M.dif(a.media, b.media) : M.dif;
  return { a, b, dif, situacao: Math.abs(dif) >= lim ? "ok" : "parecido" };
}

/** Postos com empates pela média (1 = o menor). */
export function postos(x) {
  const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = Array(x.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const p = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = p;
    i = j + 1;
  }
  return r;
}
function pearson(x, y) {
  const n = x.length, mx = media(x), my = media(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
/** Correlação de Spearman (ρ entre −1 e 1) dos pares em que os dois existem: { rho, n }. */
export function spearman(x, y) {
  const px = [], py = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] != null && y[i] != null && Number.isFinite(x[i]) && Number.isFinite(y[i])) { px.push(x[i]); py.push(y[i]); }
  if (px.length < 3) return { rho: null, n: px.length };
  return { rho: pearson(postos(px), postos(py)), n: px.length };
}
export const forcaTx = (rho) => (Math.abs(rho) >= 0.5 ? "forte" : Math.abs(rho) >= RHO_MIN ? "moderada" : "fraca");

// ---------- as frases ----------
const GRUPOS = [
  { id: "tam", a: "corridos", b: "livres", rotulo: "Dias corridos × livres", grupo: (d) => (d.tam === "corrido" ? "a" : d.tam === "livre" ? "b" : null), qual: "Nos dias corridos", outro: "nos livres" },
  { id: "prova", a: "com prova", b: "sem prova", rotulo: "Prova no dia ou no seguinte", grupo: (d) => (d.prova == null ? null : d.prova ? "a" : "b"), qual: "Nos dias com prova (no dia ou no seguinte)", outro: "nos outros" },
  { id: "huop", a: "com HUOP ou CEO", b: "sem", rotulo: "HUOP ou CEO", grupo: (d) => (d.huopCeo == null ? null : d.huopCeo ? "a" : "b"), qual: "Nos dias de HUOP ou CEO", outro: "nos outros" },
  { id: "chuva", a: "com chuva", b: "sem chuva", rotulo: "Ouvindo com chuva × sem chuva", grupo: (d) => (d.chuvaMin + d.secoMin < 5 ? null : d.chuvaMin > d.secoMin ? "a" : "b"), qual: "Nos dias em que você ouviu com chuva lá fora", outro: "sem chuva" },
  { id: "frio", a: "frios", b: "quentes", rotulo: "Frio × calor lá fora", grupo: (d) => (!d.tN ? null : d.tS / d.tN < 18 ? "a" : d.tS / d.tN >= 25 ? "b" : null), qual: "Nos dias frios (menos de 18°)", outro: "nos quentes (25° ou mais)" },
  { id: "humorTenso", a: "tensos", b: "outros", rotulo: "Humor agitado e desagradável", grupo: (d) => (!d.humor ? null : d.humor.quadrante === "alta-desagradavel" ? "a" : "b"), qual: "Nos dias de humor agitado e desagradável (😰 😠 😤 😟)", outro: "nos outros dias com humor anotado" },
  { id: "humorBaixo", a: "pra baixo", b: "outros", rotulo: "Humor parado e desagradável", grupo: (d) => (!d.humor ? null : d.humor.quadrante === "baixa-desagradavel" ? "a" : "b"), qual: "Nos dias de humor parado e desagradável (😔 😞 😩 😶)", outro: "nos outros dias com humor anotado" },
  { id: "humorEnergia", a: "energia alta", b: "energia baixa", rotulo: "Humor com energia alta × baixa", grupo: (d) => (!d.humor ? null : d.humor.energia === "alta" ? "a" : "b"), qual: "Nos dias de humor com energia alta", outro: "nos de energia baixa" },
];
// que medidas olhar em cada grupo
const MEDIDAS_GRUPO = {
  tam: ["volume", "intensidade", "minutos", "agitadas", "puladas"], prova: ["volume", "intensidade", "minutos", "agitadas"],
  huop: ["volume", "minutos"], chuva: ["calmas", "volume"], frio: ["calmas", "volume"],
  humorTenso: ["volume", "agressivas", "agitadas", "intensidade", "puladas"], humorBaixo: ["volume", "calmas", "minutos"], humorEnergia: ["agitadas", "volume"],
};
const RELACOES = [
  { id: "fora-volume", x: "horasFora", y: "volume", xNome: "tempo fora de casa", texto: (s) => `Quanto mais tempo fora de casa no dia, ${s > 0 ? "mais alto" : "mais baixo"} o volume com que você ouviu` },
  { id: "fora-intens", x: "horasFora", y: "intensidade", xNome: "tempo fora de casa", texto: (s) => `Quanto mais tempo fora de casa, ${s > 0 ? "mais fortes" : "mais suaves"} as músicas que você escolheu` },
  { id: "fora-min", x: "horasFora", y: "minutos", xNome: "tempo fora de casa", texto: (s) => `Quanto mais tempo fora de casa, ${s > 0 ? "mais" : "menos"} tempo ouvindo` },
  { id: "chegada-volume", x: "chegada", y: "volume", xNome: "hora de chegar em casa", texto: (s) => `Quanto mais tarde você chegou em casa, ${s > 0 ? "mais alto" : "mais baixo"} o volume` },
];
const valorX = (d, k) => (k === "horasFora" ? (d.nPres ? d.horasFora : null) : k === "chegada" ? (d.chegada ?? null) : null);

/**
 * As frases. `dias`: lista de dias com os campos de porDia + os da Agenda e do humor ({ tam, prova, huopCeo, horasFora,
 * nPres, chegada, humor }). Devolve { frases: [{ id, texto, n }], parecidos: [{ id, texto }], poucos: [{ id, texto }] }.
 */
export function frases(dias) {
  const out = { frases: [], parecidos: [], poucos: [] };
  for (const G of GRUPOS) {
    for (const k of MEDIDAS_GRUPO[G.id]) {
      const M = MEDIDAS[k], c = comparar(dias, G.grupo, k), id = `${G.id}:${k}`;
      const nTx = `(${c.a.n} e ${c.b.n} ${c.a.n + c.b.n === 1 ? "dia" : "dias"})`;
      if (c.situacao === "poucos") { out.poucos.push({ id, texto: `${G.rotulo} · ${M.nome}: ${c.a.n} ${G.a} e ${c.b.n} ${G.b}; precisa de ${MIN_DIAS} de cada`, falta: Math.max(0, MIN_DIAS - c.a.n) + Math.max(0, MIN_DIAS - c.b.n) }); continue; }
      if (c.situacao === "parecido") { out.parecidos.push({ id, texto: `${G.rotulo}: ${M.nome} parecido (${M.fmt(c.a.media)} e ${M.fmt(c.b.media)}) ${nTx}` }); continue; }
      const verbo = k === "volume" ? `você ouviu com o volume em ${M.fmt(c.a.media)} em média; ${G.outro}, ${M.fmt(c.b.media)}`
        : k === "minutos" ? `você ouviu ${M.fmt(c.a.media)} por dia em média; ${G.outro}, ${M.fmt(c.b.media)}`
        : k === "intensidade" ? `as músicas foram de intensidade ${M.fmt(c.a.media)}; ${G.outro}, ${M.fmt(c.b.media)}`
        : k === "puladas" ? `você pulou ${M.fmt(c.a.media)} das músicas; ${G.outro}, ${M.fmt(c.b.media)}`
        : `${M.fmt(c.a.media)} do que você ouviu foram ${M.nome}; ${G.outro}, ${M.fmt(c.b.media)}`;
      out.frases.push({ id, texto: `${G.qual}, ${verbo} ${nTx}.`, n: c.a.n + c.b.n, forca: Math.abs(c.dif) / (typeof M.dif === "function" ? M.dif(c.a.media, c.b.media) : M.dif) });
    }
  }
  for (const R of RELACOES) {
    const xs = dias.map(d => valorX(d, R.x)), ys = dias.map(d => MEDIDAS[R.y].valor(d));
    const { rho, n } = spearman(xs, ys), id = `rel:${R.id}`;
    if (n < MIN_PARES || rho == null) { out.poucos.push({ id, texto: `${maiuscula(R.xNome)} × ${MEDIDAS[R.y].nome}: ${n} ${n === 1 ? "dia" : "dias"}; precisa de ${MIN_PARES}`, falta: MIN_PARES - n }); continue; }
    if (Math.abs(rho) < RHO_MIN) { out.parecidos.push({ id, texto: `${maiuscula(R.xNome)} × ${MEDIDAS[R.y].nome}: quase nenhuma relação (${n} dias)` }); continue; }
    out.frases.push({ id, texto: `${R.texto(Math.sign(rho))} (relação ${forcaTx(rho)}, ${n} dias).`, n, forca: Math.abs(rho) / RHO_MIN, rho });
  }
  out.frases.sort((a, b) => b.forca - a.forca);
  out.poucos.sort((a, b) => a.falta - b.falta);
  return out;
}
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ---------- agrupamentos para os gráficos ----------
/** Minutos por dia da semana (0 = domingo) × hora. */
export function mapaHoraDia(reps, faixas = new Map()) {
  const m = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of reps) {
    if (r.tipo !== "tocada") continue;
    const t = new Date(meioDe(r)), min = (r.dur || faixas.get?.(r.id)?.duracao || 0) / 60000;
    m[t.getDay()][t.getHours()] += min;
  }
  return m;
}
/** Distribuição do volume (10 faixas de 10%) das reproduções que têm volume. */
export function distribuicaoVolume(reps) {
  const b = Array(10).fill(0);
  for (const r of reps) if (typeof r.vol === "number") b[Math.min(9, Math.floor(r.vol * 10))]++;
  return b;
}
/** Por saída: [{ saida, n, vol (média), min }], da mais usada à menos. */
export function porSaida(reps, faixas = new Map()) {
  const c = new Map();
  for (const r of reps) {
    if (!r.saida) continue;
    const x = c.get(r.saida) || { saida: r.saida, n: 0, volS: 0, volN: 0, min: 0 };
    x.n++; if (typeof r.vol === "number") { x.volS += r.vol; x.volN++; }
    if (r.tipo === "tocada") x.min += (r.dur || faixas.get?.(r.id)?.duracao || 0) / 60000;
    c.set(r.saida, x);
  }
  return [...c.values()].map(x => ({ saida: x.saida, n: x.n, vol: x.volN ? x.volS / x.volN : null, min: x.min })).sort((a, b) => b.n - a.n);
}
/** Média por hora (24) de uma medida por reprodução (`valor(r, faixa)` → número ou null). */
export function mediaPorHora(reps, valor, faixas = new Map()) {
  const s = Array(24).fill(0), n = Array(24).fill(0);
  for (const r of reps) { const v = valor(r, faixas.get?.(r.id)); if (v == null || !Number.isFinite(v)) continue; const h = new Date(meioDe(r)).getHours(); s[h] += v; n[h]++; }
  return s.map((x, i) => (n[i] ? x / n[i] : null));
}
/** Semana (segunda) de um dia. */
export function semanaDe(dia) {
  const d = new Date(dia + "T12:00:00"), k = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - k);
  return diaDe(+d);
}
/** Minutos de cada clima por um agrupador da reprodução (`chave(r)` → string). Devolve Map chave → {clima: min, total}. */
export function climaPor(reps, faixas, chave) {
  const out = new Map();
  for (const r of reps) {
    if (r.tipo !== "tocada") continue;
    const f = faixas.get?.(r.id), cl = climasDe(f); if (!cl.length) continue;
    const k = chave(r); if (k == null) continue;
    const m = (r.dur || f.duracao || 0) / 60000, x = out.get(k) || { total: 0 };
    for (const c of cl) x[c] = (x[c] || 0) + m / cl.length;
    x.total += m; out.set(k, x);
  }
  return out;
}
/** Período do dia de uma hora: madrugada, manhã, tarde, noite. */
export const periodoDe = (h) => (h < 6 ? "Madrugada" : h < 12 ? "Manhã" : h < 18 ? "Tarde" : "Noite");
export const PERIODOS = ["Madrugada", "Manhã", "Tarde", "Noite"];
