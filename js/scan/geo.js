// Geoprocessamento do Relatório da IC (sem DOM): localização aproximada de cada atendimento (centro do bairro, do
// distrito ou do município, porque o endereço não tem número), distância até a clínica, raio de cobertura,
// taxas por habitante (Censo 2022), autocorrelação espacial (Moran global e LISA, com taxas suavizadas por Bayes
// empírico) e os pontos para a densidade de Kernel. Tudo agregado.
import { MAPAS, GEO } from "./mapas.js";
export { GEO };
import { norm, ehCascavel } from "./previsao.js";
import { ehPIC } from "./processar.js";

// Clínica de Odontologia da Unioeste, campus de Cascavel (Rua Universitária, 2069)
export const CLINICA = { lon: -53.451, lat: -24.988 };

const IDX = {};
for (const camada of Object.keys(MAPAS)) IDX[camada] = new Map(MAPAS[camada].itens.map(([nome], i) => [norm(nome), i]));
export const item = (camada, i) => { const g = GEO[camada].itens[i]; return { nome: MAPAS[camada].itens[i][0], cod: g[0], lon: g[1], lat: g[2], area: g[3], viz: g[4], rg: g[5], pop: g[6] ?? null, favela: g[7] ?? null }; };
export const indiceDe = (camada, nome) => IDX[camada].get(norm(nome));

/** Onde fica o atendimento: { camada, i, nivel } (bairro, distrito ou município) ou null. */
export function local(r) {
  if (ehPIC(r)) return { institucional: true }; // PIC: atendimento institucional, fora das análises espaciais
  const mun = r.municipio || "";
  if (!mun) return null;
  if (/ - [A-Z]{2}$/.test(mun) && !/ - PR$/.test(mun)) return { fora: true };
  if (ehCascavel(mun)) {
    const b = norm(r.bairro);
    if (IDX.bairros.has(b)) return { camada: "bairros", i: IDX.bairros.get(b), nivel: "bairro" };
    if (IDX.distritos.has(b) && b !== norm("Sede Administrativa")) return { camada: "distritos", i: IDX.distritos.get(b), nivel: "distrito" };
    return { camada: "parana", i: IDX.parana.get(norm("Cascavel")), nivel: "cidade" }; // Cascavel sem bairro: só o município
  }
  const i = IDX.parana.get(norm(mun.replace(/ - PR$/, "")));
  return i == null ? null : { camada: "parana", i, nivel: "municipio" };
}

export function distanciaKm(a, b) {
  const R = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const quantil = (v, q) => { if (!v.length) return null; const p = (v.length - 1) * q, a = Math.floor(p), b = Math.ceil(p); return v[a] + (v[b] - v[a]) * (p - a); };
export const FAIXAS_KM = [[2, "até 2 km"], [5, "2 a 5 km"], [10, "5 a 10 km"], [25, "10 a 25 km"], [50, "25 a 50 km"], [100, "50 a 100 km"], [Infinity, "mais de 100 km"]];

/**
 * Distância (em linha reta) de cada atendimento até a clínica, pelo centro do bairro (Cascavel), do distrito ou do
 * município. Cascavel sem bairro fica de fora (o centro do município não diz onde a pessoa mora).
 */
export function distancias(rs) {
  const km = [], nivel = { bairro: 0, distrito: 0, municipio: 0, cidade: 0, fora: 0, sem: 0, institucional: 0 };
  for (const r of rs) {
    const l = local(r);
    if (!l) { nivel.sem++; continue; }
    if (l.fora) { nivel.fora++; continue; }
    if (l.institucional) { nivel.institucional++; continue; }
    nivel[l.nivel]++;
    if (l.nivel === "cidade") continue;
    km.push(distanciaKm(CLINICA, item(l.camada, l.i)));
  }
  km.sort((a, b) => a - b);
  const faixas = FAIXAS_KM.map(([lim, nome], k) => [nome, km.filter(d => d <= lim && (k === 0 || d > FAIXAS_KM[k - 1][0])).length]);
  return { km, n: km.length, nivel, mediana: quantil(km, 0.5), raio50: quantil(km, 0.5), raio75: quantil(km, 0.75), raio90: quantil(km, 0.9), ate5: km.filter(d => d <= 5).length, faixas };
}

// ---------------- taxas ----------------
/** Atendimentos por camada: Map(índice → n). */
export function contarPorCamada(rs, camada) {
  const m = new Map();
  for (const r of rs) { const l = local(r); if (l && l.camada === camada) m.set(l.i, (m.get(l.i) || 0) + 1); }
  return m;
}
/** Taxa por `por` habitantes em cada forma com população: [{ i, nome, n, pop, taxa }]. */
export function taxas(rs, camada, por = 1000) {
  const cont = camada === "parana" ? contarMunicipios(rs) : contarPorCamada(rs, camada);
  return GEO[camada].itens.map((g, i) => ({ i, nome: MAPAS[camada].itens[i][0], n: cont.get(i) || 0, pop: g[6] || null, taxa: g[6] ? por * (cont.get(i) || 0) / g[6] : null }));
}
// no mapa do Paraná, Cascavel conta inteira (com ou sem bairro)
function contarMunicipios(rs) {
  const m = new Map();
  for (const r of rs) {
    const mun = r.municipio || ""; if (!mun || ehPIC(r) || (/ - [A-Z]{2}$/.test(mun) && !/ - PR$/.test(mun))) continue;
    const i = IDX.parana.get(norm(ehCascavel(mun) ? "Cascavel" : mun.replace(/ - PR$/, "")));
    if (i != null) m.set(i, (m.get(i) || 0) + 1);
  }
  return m;
}
/** Bayes empírico global (Marshall, 1991): suaviza taxas de áreas com pouca população. n, p: listas. */
export function bayesEmpirico(n, p) {
  const P = p.reduce((a, b) => a + b, 0), N = n.reduce((a, b) => a + b, 0), b = N / P, pm = P / p.length;
  const s2 = p.reduce((s, pi, k) => s + pi * (n[k] / pi - b) ** 2, 0) / P;
  const a = Math.max(0, s2 - b / pm);
  return p.map((pi, k) => { const r = n[k] / pi, w = a / (a + b / pi); return isFinite(w) ? b + w * (r - b) : b; });
}

// ---------------- Moran global e local (LISA) ----------------
function aleatorio(semente = 7) { let s = semente >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
/**
 * Moran com matriz de vizinhança por fronteira (rook, linhas padronizadas). `valores`: número por forma (null fica
 * de fora); `viz`: vizinhos (índices). Pseudo-p por 999 permutações (condicionais, no local).
 * Devolve { I, esperado, p, z, n, locais: [{ Ii, p, quadrante: "Alto-Alto" | "Baixo-Baixo" | "Alto-Baixo" | "Baixo-Alto" | null }] }.
 */
export function moran(valores, viz, { permutacoes = 999, semente = 7 } = {}) {
  const ids = valores.map((v, i) => v == null || !isFinite(v) ? -1 : i).filter(i => i >= 0);
  const pos = new Map(ids.map((i, k) => [i, k])), n = ids.length;
  if (n < 5) return null;
  const x = ids.map(i => valores[i]), media = x.reduce((a, b) => a + b, 0) / n, z = x.map(v => v - media);
  const m2 = z.reduce((s, v) => s + v * v, 0) / n;
  if (!m2 || m2 < 1e-12 * (media * media + 1e-12)) return null; // sem variação (ex.: Bayes empírico levou todos à média)
  const W = ids.map(i => viz[i].map(j => pos.get(j)).filter(j => j != null));
  const lag = (zz, k) => W[k].length ? W[k].reduce((s, j) => s + zz[j], 0) / W[k].length : 0;
  const S0 = W.filter(w => w.length).length;
  const calcI = (zz) => { let s = 0; for (let k = 0; k < n; k++) if (W[k].length) s += zz[k] * lag(zz, k); return (n / S0) * s / (n * m2); };
  const I = calcI(z), rnd = aleatorio(semente);
  const sims = [];
  const zz = z.slice();
  for (let t = 0; t < permutacoes; t++) {
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [zz[k], zz[j]] = [zz[j], zz[k]]; }
    sims.push(calcI(zz));
  }
  const ms = sims.reduce((a, b) => a + b, 0) / sims.length, ds = Math.sqrt(sims.reduce((s, v) => s + (v - ms) ** 2, 0) / (sims.length - 1));
  // locais
  const locais = valores.map(() => null), m2l = m2 * n / (n - 1); // como no PySAL (esda.Moran_Local)
  for (let k = 0; k < n; k++) {
    if (!W[k].length) continue;
    const Ii = (z[k] / m2l) * lag(z, k), viz_k = W[k].length, outros = z.filter((_, j) => j !== k);
    let extremos = 0;
    for (let t = 0; t < permutacoes; t++) {
      let s = 0; const usados = new Set();
      for (let q = 0; q < viz_k; q++) { let j; do { j = Math.floor(rnd() * outros.length); } while (usados.has(j)); usados.add(j); s += outros[j]; }
      const Is = (z[k] / m2l) * (s / viz_k);
      if (Ii >= 0 ? Is >= Ii : Is <= Ii) extremos++;
    }
    const p = (extremos + 1) / (permutacoes + 1), l = lag(z, k);
    const quadrante = p < 0.05 ? (z[k] > 0 && l > 0 ? "Alto-Alto" : z[k] < 0 && l < 0 ? "Baixo-Baixo" : z[k] > 0 ? "Alto-Baixo" : "Baixo-Alto") : null;
    locais[ids[k]] = { Ii, p, quadrante };
  }
  // pseudo-p como no GeoDa: proporção das permutações tão ou mais extremas, do lado em que I caiu
  const extremosI = sims.filter(v => I >= ms ? v >= I : v <= I).length;
  return { I, esperado: -1 / (n - 1), p: (extremosI + 1) / (permutacoes + 1), z: ds ? (I - ms) / ds : null, n, locais, permutacoes };
}
/** Formas da região intermediária de Cascavel (IBGE) no mapa do Paraná: índices. */
export const regiaoCascavel = () => GEO.parana.itens.map((g, i) => g[5] === "Cascavel" ? i : -1).filter(i => i >= 0);
/** Vizinhos restritos a um conjunto de índices (para analisar só uma região). */
export const vizinhosEm = (camada, conjunto) => { const s = new Set(conjunto); return GEO[camada].itens.map((g, i) => s.has(i) ? g[4].filter(j => s.has(j)) : []); };

// ---------------- Kernel ----------------
/** km por unidade do quadro do mapa (as coordenadas do mapas.js). */
export const kmPorUnidade = (camada) => 111.32 / GEO[camada].proj[3];
/** Lon/lat → coordenadas do quadro do mapa. */
export function projetar(camada, lon, lat) { const [k, x0, y0, esc] = GEO[camada].proj; return [(lon * k - x0) * esc, (-lat - y0) * esc]; }
export function desprojetar(camada, x, y) { const [k, x0, y0, esc] = GEO[camada].proj; return [(x / esc + x0) / k, -(y / esc + y0)]; }
/**
 * Raio do Kernel (km) pela regra usada no ArcGIS (Silverman adaptada): 0,9 · min(DP, √(1/ln 2) · Dm) · n^−0,2,
 * com DP a distância-padrão e Dm a mediana das distâncias ao centro médio. Limitado entre 0,5 e 3 km.
 */
export function raioKernel(pts, kmUn) {
  const n = pts.length; if (n < 2) return 1;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  const d = pts.map(([x, y]) => Math.hypot(x - mx, y - my) * kmUn).sort((a, b) => a - b);
  const dp = Math.sqrt(d.reduce((s, v) => s + v * v, 0) / n), dm = d[Math.floor(n / 2)];
  return Math.min(3, Math.max(0.5, 0.9 * Math.min(dp, Math.sqrt(1 / Math.LN2) * dm) * Math.pow(n, -0.2)));
}
