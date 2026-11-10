// Tabelas cruzadas do Painel: duas variáveis das fichas (linhas × colunas), com totais, porcentagens e o teste
// qui-quadrado de independência. Quando uma das variáveis é de procedimento, a unidade é o procedimento.
import { procedimento, procDe, idadeNaData, ehPIC } from "./processar.js";
import { ehCascavel } from "./previsao.js";

const faixa = (i) => i == null || isNaN(i) ? null : i <= 12 ? "0 a 12" : i <= 17 ? "13 a 17" : i <= 39 ? "18 a 39" : i <= 59 ? "40 a 59" : "60 ou mais";
const idadeDe = (r) => idadeNaData(r.nascimento, r.data) ?? (r.idadeEscrita === "" || r.idadeEscrita == null ? null : +r.idadeEscrita);
// grupos da tabela SIGTAP pelo começo do código
const AREAS = [["0101", "Prevenção"], ["0301", "Consulta"], ["02", "Diagnóstico (biópsia, radiografia)"], ["030701", "Dentística"], ["030702", "Endodontia"],
  ["030703", "Periodontia"], ["030704", "Prótese e ortodontia (clínica)"], ["04", "Cirurgia"], ["07", "Prótese e aparelhos (laboratório)"]];
export const areaDoProcedimento = (cod) => { const d = procedimento(cod).digitos; return (AREAS.find(([p]) => d.startsWith(p)) || [, "Outros"])[1]; };

/** Variáveis: [id, nome, função (r, f) → valor ou lista de valores (procedimentos), ordem fixa opcional]. */
export const VARIAVEIS = [
  ["faixa", "Faixa etária", (r) => faixa(idadeDe(r)), ["0 a 12", "13 a 17", "18 a 39", "40 a 59", "60 ou mais"]],
  ["sexo", "Sexo", (r) => r.sexo || null],
  ["tipo", "Tipo de atendimento", (r) => r.urgencia ? "Urgência" : r.primeira ? "1ª consulta" : r.retorno ? "Retorno" : "Não marcado", ["Urgência", "1ª consulta", "Retorno", "Não marcado"]],
  ["clinica", "Clínica", (r) => r.clinica || null],
  ["mes", "Mês", (r) => r.data ? r.data.slice(0, 7) : null],
  ["origem", "Origem", (r) => ehPIC(r) ? "Institucional (PIC)" : !r.municipio ? null : ehCascavel(r.municipio) ? "Cascavel" : / - [A-Z]{2}$/.test(r.municipio) && !/ - PR$/.test(r.municipio) ? "Outro estado" : "Outro município do PR", ["Cascavel", "Outro município do PR", "Outro estado", "Institucional (PIC)"]],
  ["cor", "Cor", (r) => r.cor || null],
  ["area", "Área do procedimento", (r) => (r.procedimentos || []).map(q => areaDoProcedimento(q.codigo)), AREAS.map(a => a[1]).concat("Outros"), true],
  ["proc", "Procedimento", (r) => (r.procedimentos || []).map(q => { const p = procDe(q, r); return p.nome || `código ${p.codigo}`; }), null, true],
];
const MAX_CAT = 8; // categorias demais viram "Outras"

/** Monta a tabela: { linhas, colunas, n[i][j], totLin, totCol, total, unidade, semValor }. */
export function cruzar(revisoes, idLin, idCol) {
  const vl = VARIAVEIS.find(v => v[0] === idLin), vc = VARIAVEIS.find(v => v[0] === idCol);
  const pares = [];
  let semValor = 0;
  for (const r of revisoes) {
    const a = vl[2](r), b = vc[2](r);
    const as = Array.isArray(a) ? a : [a], bs = Array.isArray(b) ? b : [b];
    if (Array.isArray(a) && Array.isArray(b) && vl !== vc) { // duas de procedimento: casa um a um
      as.forEach((x, i) => { if (x != null && bs[i] != null) pares.push([x, bs[i]]); else semValor++; });
      continue;
    }
    let algum = false;
    for (const x of as) for (const y of bs) if (x != null && y != null) { pares.push([x, y]); algum = true; }
    if (!algum) semValor++;
  }
  const categorias = (pos, v) => {
    const cont = new Map(); pares.forEach(p => cont.set(p[pos], (cont.get(p[pos]) || 0) + 1));
    let cats = v[3] ? v[3].filter(c => cont.has(c)) : [...cont.keys()].sort((x, y) => v[0] === "mes" ? x.localeCompare(y) : cont.get(y) - cont.get(x));
    if (!v[3] && v[0] !== "mes" && cats.length > MAX_CAT) cats = [...cats.slice(0, MAX_CAT - 1), "Outras"];
    const outras = new Set(cats.includes("Outras") ? [...cont.keys()].filter(c => !cats.slice(0, -1).includes(c)) : []);
    return { cats, mapa: (c) => outras.has(c) ? "Outras" : c };
  };
  const L = categorias(0, vl), C = categorias(1, vc);
  const n = L.cats.map(() => C.cats.map(() => 0));
  for (const [x, y] of pares) { const i = L.cats.indexOf(L.mapa(x)), j = C.cats.indexOf(C.mapa(y)); if (i >= 0 && j >= 0) n[i][j]++; }
  const totLin = n.map(l => l.reduce((a, b) => a + b, 0)), totCol = C.cats.map((_, j) => n.reduce((a, l) => a + l[j], 0)), total = totLin.reduce((a, b) => a + b, 0);
  return { linhas: L.cats, colunas: C.cats, n, totLin, totCol, total, unidade: vl[4] || vc[4] ? "procedimentos" : "atendimentos", semValor, nomeLin: vl[1], nomeCol: vc[1] };
}

// ---------- qui-quadrado ----------
function gamaLn(x) { // Lanczos
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015; for (const c of g) ser += c / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function gamaQ(a, x) { // 1 − P(a, x), gama incompleta regularizada superior
  if (x <= 0) return 1;
  if (x < a + 1) { let soma = 1 / a, d = soma, ap = a; for (let n = 0; n < 500; n++) { ap++; d *= x / ap; soma += d; if (Math.abs(d) < Math.abs(soma) * 1e-12) break; } return 1 - soma * Math.exp(-x + a * Math.log(x) - gamaLn(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; }
  return Math.exp(-x + a * Math.log(x) - gamaLn(a)) * h;
}
/** { qui2, gl, p, baixos } ou null (tabela pequena demais). `baixos`: % de células com esperado < 5. */
export function quiQuadrado(t) {
  const li = t.totLin.map((v, i) => v ? i : -1).filter(i => i >= 0), co = t.totCol.map((v, j) => v ? j : -1).filter(j => j >= 0);
  if (li.length < 2 || co.length < 2 || !t.total) return null;
  let qui2 = 0, baixos = 0;
  for (const i of li) for (const j of co) { const e = t.totLin[i] * t.totCol[j] / t.total; if (e < 5) baixos++; qui2 += (t.n[i][j] - e) ** 2 / e; }
  const gl = (li.length - 1) * (co.length - 1);
  return { qui2, gl, p: gamaQ(gl / 2, qui2 / 2), baixos: baixos / (li.length * co.length) };
}

/** Texto separado por tabulação, para colar no Excel ou no Word. */
export function tsv(t, modo) {
  const pc = (v, b) => b ? `${(100 * v / b).toFixed(1).replace(".", ",")}%` : "";
  const cel = (i, j) => modo === "lin" ? pc(t.n[i][j], t.totLin[i]) : modo === "col" ? pc(t.n[i][j], t.totCol[j]) : t.n[i][j];
  const linhas = [[`${t.nomeLin} \\ ${t.nomeCol}`, ...t.colunas, "Total"].join("\t")];
  t.linhas.forEach((l, i) => linhas.push([l, ...t.colunas.map((_, j) => cel(i, j)), modo === "col" ? pc(t.totLin[i], t.total) : t.totLin[i]].join("\t")));
  linhas.push(["Total", ...t.totCol.map(v => modo === "lin" ? pc(v, t.total) : v), t.total].join("\t"));
  return linhas.join("\n");
}
