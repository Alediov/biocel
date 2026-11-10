// Gráficos em PNG para o relatório (desenhados num canvas, sem bibliotecas): colunas, barras e mapa.
import { MAPAS } from "./mapas.js";
import { norm } from "./previsao.js";
import { caixaDasFormas } from "./mapa.js";

const COR = "#0E9F87", COR2 = "#2D6CDF", TINTA = "#1F2D36", TINTA2 = "#5B6F7C", GRADE = "#E3EAEE";
const FONTE = "Arial, Helvetica, sans-serif";
// escala da resolução: 1 no relatório; 2 nas "Figuras para o artigo" (o desenho é o mesmo, com o dobro de pixels)
let ESCALA = 1;
export function definirEscala(k) { ESCALA = k || 1; }
function tela(w, h) {
  const W = Math.round(w * ESCALA), H = Math.round(h * ESCALA);
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
  const cx = c.getContext("2d"); cx.scale(ESCALA, ESCALA); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);
  return [c, cx];
}
async function png(c) {
  const blob = c.convertToBlob ? await c.convertToBlob({ type: "image/png" }) : await new Promise(ok => c.toBlob(ok, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
function cortar(cx, t, max) { if (cx.measureText(t).width <= max) return t; while (t.length > 1 && cx.measureText(t + "…").width > max) t = t.slice(0, -1); return t + "…"; }

/** Colunas (ex.: atendimentos por mês). itens: [[rótulo, valor]]. */
export async function colunas(itens, { w = 1600, h = 800, cor = COR } = {}) {
  const [c, cx] = tela(w, h), m = { e: 90, d: 30, t: 50, b: 110 }, max = Math.max(1, ...itens.map(i => i[1]));
  const passo = Math.pow(10, Math.floor(Math.log10(max))), topo = Math.ceil(max / passo) * passo, ah = h - m.t - m.b, aw = w - m.e - m.d;
  cx.font = `26px ${FONTE}`; cx.textAlign = "right"; cx.textBaseline = "middle";
  for (let k = 0; k <= 4; k++) { const v = topo * k / 4, y = m.t + ah - ah * k / 4; cx.strokeStyle = GRADE; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(m.e, y); cx.lineTo(w - m.d, y); cx.stroke(); cx.fillStyle = TINTA2; cx.fillText(fmt(Math.round(v)), m.e - 14, y); }
  const bw = aw / Math.max(1, itens.length), larg = Math.min(110, bw * 0.66);
  itens.forEach(([r, v], i) => {
    const x = m.e + bw * i + (bw - larg) / 2, bh = ah * v / topo, y = m.t + ah - bh;
    cx.fillStyle = cor; cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, larg, bh, [8, 8, 0, 0]) : cx.rect(x, y, larg, bh); cx.fill();
    cx.fillStyle = TINTA; cx.textAlign = "center"; cx.textBaseline = "bottom"; cx.font = `bold 26px ${FONTE}`; cx.fillText(fmt(v), x + larg / 2, y - 8);
    cx.save(); cx.translate(x + larg / 2, m.t + ah + 18); if (itens.length > 8) cx.rotate(-Math.PI / 5);
    cx.textAlign = itens.length > 8 ? "right" : "center"; cx.textBaseline = "top"; cx.font = `26px ${FONTE}`; cx.fillStyle = TINTA2; cx.fillText(cortar(cx, r, 220), 0, 0); cx.restore();
  });
  return { png: await png(c), w, h };
}

/** Barras deitadas (categorias com nomes longos). itens: [[rótulo, valor]]; `total` mostra a %. */
export async function barras(itens, { w = 1600, total = 0, cor = COR } = {}) {
  const lh = 64, h = 40 + itens.length * lh, [c, cx] = tela(w, h), rot = 620, max = Math.max(1, ...itens.map(i => i[1]));
  itens.forEach(([r, v], i) => {
    const y = 20 + i * lh, bw = (w - rot - 260) * v / max;
    cx.font = `27px ${FONTE}`; cx.fillStyle = TINTA; cx.textAlign = "right"; cx.textBaseline = "middle"; cx.fillText(cortar(cx, r, rot - 30), rot - 20, y + lh / 2 - 4);
    cx.fillStyle = "#EEF3F5"; cx.fillRect(rot, y + 12, w - rot - 260, lh - 32);
    cx.fillStyle = cor; cx.fillRect(rot, y + 12, Math.max(3, bw), lh - 32);
    cx.textAlign = "left"; cx.font = `bold 27px ${FONTE}`; cx.fillStyle = TINTA;
    cx.fillText(`${fmt(v)}${total ? `  (${(100 * v / total).toFixed(1).replace(".", ",")}%)` : ""}`, rot + Math.max(3, bw) + 14, y + lh / 2 - 4);
  });
  return { png: await png(c), w, h };
}

/** Mapa coropleto (bairros, distritos ou Paraná) com legenda. cont: Map(nome normalizado → n). */
export async function mapa(vista, cont, { w = 1600, perto = vista === "parana", legenda = "Atendimentos:", casas = 0 } = {}) {
  const m = MAPAS[vista], cx0 = perto ? caixaDasFormas(m, cont) : null; // [x, y, largura, altura] da região com 90% das fichas
  const [bx, by, bw, bh] = cx0 || [0, 0, m.w, m.h];
  const esc = (w - 80) / bw, hMapa = bh * esc, h = Math.round(hMapa + 150), [c, cx] = tela(w, h);
  const max = Math.max(1, ...cont.values()), CORES = ["#EEF3F5", "#C9EDE5", "#93DCCB", "#5CC8B0", "#2BAF92", "#0B7F6C"];
  const nivel = (v) => !v ? 0 : Math.max(1, Math.ceil(Math.sqrt(v / max) * 5));
  cx.save(); cx.beginPath(); cx.rect(40, 20, w - 80, hMapa); cx.clip(); cx.translate(40, 20); cx.scale(esc, esc); cx.translate(-bx, -by); cx.lineJoin = "round";
  const rotulos = [];
  for (const [nome, d] of m.itens) {
    const v = cont.get(norm(nome)) || 0, p = new Path2D(d);
    cx.fillStyle = CORES[nivel(v)]; cx.fill(p); cx.strokeStyle = "#fff"; cx.lineWidth = 2.2 / esc * 1.5; cx.stroke(p);
    if (v && (vista !== "parana" || cx0)) { const ns = d.match(/-?\d+/g).map(Number); let sx = 0, sy = 0; for (let i = 0; i < ns.length; i += 2) { sx += ns[i]; sy += ns[i + 1]; } rotulos.push([sx / (ns.length / 2), sy / (ns.length / 2), v]); }
  }
  cx.restore();
  cx.font = `bold 24px ${FONTE}`; cx.textAlign = "center"; cx.textBaseline = "middle";
  const fv = (v) => casas ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) : fmt(v);
  for (const [x, y, v] of rotulos) { const X = 40 + (x - bx) * esc, Y = 20 + (y - by) * esc; if (X < 40 || X > w - 40 || Y < 20 || Y > 20 + hMapa) continue; cx.lineWidth = 6; cx.strokeStyle = "rgba(255,255,255,.85)"; cx.strokeText(fv(v), X, Y); cx.fillStyle = TINTA; cx.fillText(fv(v), X, Y); }
  // legenda
  const ly = hMapa + 70; cx.font = `24px ${FONTE}`; cx.textAlign = "left"; cx.fillStyle = TINTA2; cx.fillText(legenda, 40, ly);
  const lx = 40 + cx.measureText(legenda).width + 24;
  CORES.forEach((cor, i) => { cx.fillStyle = cor; cx.fillRect(lx + i * 110, ly - 18, 100, 36); });
  cx.fillStyle = TINTA2; cx.fillText("0", lx + 6, ly + 44); cx.textAlign = "right"; cx.fillText(fv(max), lx + 6 * 110 - 10, ly + 44);
  return { png: await png(c), w, h };
}
export const COR_PRINCIPAL = COR, COR_SEGUNDA = COR2;

// ---------------- formas do mapa (pontos dentro, contornos) ----------------
const anelDe = (d) => d.split("M").filter(Boolean).map(p => { const ns = p.replace("Z", "").trim().split(/\s+/).map(Number), a = []; for (let i = 0; i < ns.length; i += 2) a.push([ns[i], ns[i + 1]]); return a; });
function dentro(aneis, x, y) { // par-ímpar em todos os anéis (buracos incluídos)
  let c = false;
  for (const a of aneis) for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i], [xj, yj] = a[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** Pontos sorteados (com semente fixa) dentro de uma forma do mapa, em coordenadas do quadro. */
export function pontosNaForma(d, n, semente = 1) {
  const aneis = anelDe(d); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const a of aneis) for (const [x, y] of a) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let s = (semente * 2654435761) >>> 0 || 1; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const out = [];
  for (let t = 0; out.length < n && t < n * 200; t++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (dentro(aneis, x, y)) out.push([x, y]); }
  return out;
}

/**
 * Densidade de Kernel (quártico, como no ArcGIS) sobre o mapa `vista`. pontos: [[x, y]] no quadro do mapa;
 * raio em km; kmUn: km por unidade do quadro; clinica: [x, y] opcional. Legenda em atendimentos por km².
 */
export async function kernel(vista, pontos, raio, kmUn, { w = 1600, clinica = null } = {}) {
  const m = MAPAS[vista], esc = (w - 80) / m.w, hMapa = m.h * esc, h = Math.round(hMapa + 170), [c, cx] = tela(w, h);
  const passo = 4, gw = Math.ceil((w - 80) / passo), gh = Math.ceil(hMapa / passo), D = new Float32Array(gw * gh);
  const rU = raio / kmUn, rPx = rU * esc, k = 3 / (Math.PI * raio * raio);
  for (const [x, y] of pontos) {
    const px = x * esc, py = y * esc, i0 = Math.max(0, Math.floor((px - rPx) / passo)), i1 = Math.min(gw - 1, Math.ceil((px + rPx) / passo)), j0 = Math.max(0, Math.floor((py - rPx) / passo)), j1 = Math.min(gh - 1, Math.ceil((py + rPx) / passo));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dd = ((i * passo + passo / 2 - px) ** 2 + (j * passo + passo / 2 - py) ** 2) / (rPx * rPx);
      if (dd < 1) D[j * gw + i] += k * (1 - dd) ** 2;
    }
  }
  let max = 0; for (const v of D) if (v > max) max = v;
  const CORES = ["#FFF1C9", "#FFD27F", "#F9A24B", "#E8692E", "#B83A1E"];
  cx.save(); cx.translate(40, 20);
  cx.scale(esc, esc); for (const [, d] of m.itens) { const p = new Path2D(d); cx.fillStyle = "#F1F4F6"; cx.fill(p); } cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.translate(40, 20);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const v = D[j * gw + i]; if (!max || v < max * 0.04) continue;
    cx.fillStyle = CORES[Math.min(4, Math.floor(v / max * 5))]; cx.fillRect(i * passo, j * passo, passo, passo);
  }
  cx.scale(esc, esc); cx.lineJoin = "round"; cx.strokeStyle = "rgba(91,111,124,.55)"; cx.lineWidth = 1.4 / esc;
  for (const [, d] of m.itens) cx.stroke(new Path2D(d));
  cx.restore();
  if (clinica) { const X = 40 + clinica[0] * esc, Y = 20 + clinica[1] * esc; cx.fillStyle = TINTA; cx.strokeStyle = "#fff"; cx.lineWidth = 4; cx.beginPath(); cx.arc(X, Y, 11, 0, 7); cx.fill(); cx.stroke(); cx.font = `bold 24px ${FONTE}`; cx.textAlign = "left"; cx.textBaseline = "middle"; cx.lineWidth = 6; cx.strokeText("Clínica", X + 16, Y); cx.fillText("Clínica", X + 16, Y); }
  // escala (1 ou 2 km) e legenda
  const km = (w - 80) * kmUn / esc > 12 ? 2 : 1, barra = km / kmUn * esc, ly = hMapa + 60;
  cx.fillStyle = TINTA; cx.fillRect(w - 60 - barra, ly - 4, barra, 8); cx.font = `22px ${FONTE}`; cx.textAlign = "center"; cx.textBaseline = "top"; cx.fillText(`${km} km`, w - 60 - barra / 2, ly + 10);
  cx.textAlign = "left"; cx.textBaseline = "middle"; cx.font = `24px ${FONTE}`; cx.fillStyle = TINTA2; cx.fillText("Atendimentos por km²:", 40, ly);
  const lx = 300; CORES.forEach((cor, i) => { cx.fillStyle = cor; cx.fillRect(lx + i * 100, ly - 18, 92, 36); });
  const f1 = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 });
  cx.fillStyle = TINTA2; cx.textAlign = "left"; cx.fillText(f1(max * 0.04), lx, ly + 44); cx.textAlign = "right"; cx.fillText(f1(max), lx + 5 * 100 - 8, ly + 44);
  return { png: await png(c), w, h, max };
}

/** Mapa do LISA: quadrantes significativos por forma. quad: Map(índice → quadrante); indices: formas mostradas. */
export const CORES_LISA = { "Alto-Alto": "#E34948", "Baixo-Baixo": "#2A78D6", "Alto-Baixo": "#F2A7A6", "Baixo-Alto": "#A9C9F0" };
export async function lisa(vista, quad, { w = 1600, indices = null, rotulos = false } = {}) {
  const m = MAPAS[vista], usar = indices ? new Set(indices) : null;
  let bx = 0, by = 0, bw = m.w, bh = m.h;
  if (usar) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; m.itens.forEach(([, d], i) => { if (!usar.has(i)) return; const ns = d.match(/-?\d+/g).map(Number); for (let k = 0; k < ns.length; k += 2) { x0 = Math.min(x0, ns[k]); x1 = Math.max(x1, ns[k]); y0 = Math.min(y0, ns[k + 1]); y1 = Math.max(y1, ns[k + 1]); } }); bx = x0 - 10; by = y0 - 10; bw = x1 - x0 + 20; bh = y1 - y0 + 20; }
  const esc = (w - 80) / bw, hMapa = bh * esc, h = Math.round(hMapa + 140), [c, cx] = tela(w, h);
  cx.save(); cx.beginPath(); cx.rect(40, 20, w - 80, hMapa); cx.clip(); cx.translate(40, 20); cx.scale(esc, esc); cx.translate(-bx, -by); cx.lineJoin = "round";
  m.itens.forEach(([, d], i) => { const p = new Path2D(d), dentroR = !usar || usar.has(i); cx.fillStyle = !dentroR ? "#FAFBFC" : CORES_LISA[quad.get(i)] || "#E3EAEE"; cx.fill(p); cx.strokeStyle = "#fff"; cx.lineWidth = 2.4 / esc; cx.stroke(p); });
  cx.restore();
  if (rotulos) { cx.font = `20px ${FONTE}`; cx.textAlign = "center"; cx.textBaseline = "middle"; m.itens.forEach(([nome, d], i) => { if (!quad.get(i)) return; const ns = d.match(/-?\d+/g).map(Number); let sx = 0, sy = 0; for (let k = 0; k < ns.length; k += 2) { sx += ns[k]; sy += ns[k + 1]; } const X = 40 + (sx / (ns.length / 2) - bx) * esc, Y = 20 + (sy / (ns.length / 2) - by) * esc; cx.lineWidth = 5; cx.strokeStyle = "rgba(255,255,255,.9)"; cx.strokeText(nome, X, Y); cx.fillStyle = TINTA; cx.fillText(nome, X, Y); }); }
  const ly = hMapa + 70; let lx = 40; cx.font = `24px ${FONTE}`; cx.textAlign = "left"; cx.textBaseline = "middle";
  for (const [nome, cor] of [...Object.entries(CORES_LISA), ["Não significativo", "#E3EAEE"]]) { cx.fillStyle = cor; cx.fillRect(lx, ly - 16, 40, 32); cx.fillStyle = TINTA2; cx.fillText(nome, lx + 50, ly); lx += 50 + cx.measureText(nome).width + 40; }
  return { png: await png(c), w, h };
}

/** Pirâmide etária: faixas (de baixo para cima) × sexo. */
export async function piramide({ faixas, M, F }, { w = 1600 } = {}) {
  const lh = 62, topo = 70, h = topo + faixas.length * lh + 70, [c, cx] = tela(w, h), meio = w / 2, rot = 150, max = Math.max(1, ...M, ...F), larg = meio - rot / 2 - 130;
  const CM = "#2A78D6", CF = "#EB6834";
  cx.font = `bold 26px ${FONTE}`; cx.textBaseline = "middle"; cx.textAlign = "right"; cx.fillStyle = TINTA; cx.fillText("Masculino", meio - rot / 2 - 10, 30); cx.textAlign = "left"; cx.fillText("Feminino", meio + rot / 2 + 10, 30);
  faixas.forEach((fx, k) => {
    const y = topo + (faixas.length - 1 - k) * lh, bm = larg * M[k] / max, bf = larg * F[k] / max;
    cx.fillStyle = CM; cx.beginPath(); cx.roundRect ? cx.roundRect(meio - rot / 2 - bm, y + 8, bm, lh - 16, [4, 0, 0, 4]) : cx.rect(meio - rot / 2 - bm, y + 8, bm, lh - 16); cx.fill();
    cx.fillStyle = CF; cx.beginPath(); cx.roundRect ? cx.roundRect(meio + rot / 2, y + 8, bf, lh - 16, [0, 4, 4, 0]) : cx.rect(meio + rot / 2, y + 8, bf, lh - 16); cx.fill();
    cx.font = `24px ${FONTE}`; cx.fillStyle = TINTA2; cx.textAlign = "center"; cx.fillText(fx, meio, y + lh / 2);
    cx.fillStyle = TINTA; cx.font = `bold 24px ${FONTE}`; cx.textAlign = "right"; cx.fillText(fmt(M[k]), meio - rot / 2 - bm - 10, y + lh / 2); cx.textAlign = "left"; cx.fillText(fmt(F[k]), meio + rot / 2 + bf + 10, y + lh / 2);
  });
  cx.font = `22px ${FONTE}`; cx.fillStyle = TINTA2; cx.textAlign = "center"; cx.fillText("Idade (anos) · atendimentos", meio, h - 28);
  return { png: await png(c), w, h };
}

// Larguras mesiodistais aproximadas (mm) de cada dente e o tipo, para o odontograma desenhado.
const LARG = { 1: 8.5, 2: 6.5, 3: 7.5, 4: 7, 5: 6.5, 6: 10, 7: 9, 8: 8.5 }, LARG_INF = { 1: 5, 2: 5.5, 3: 7, 4: 7, 5: 7, 6: 11, 7: 10.5, 8: 10 };
const LARG_DEC = { 1: 6.5, 2: 5, 3: 7, 4: 7, 5: 9 }, LARG_DEC_INF = { 1: 4, 2: 4.5, 3: 5, 4: 7.5, 5: 9.5 };
function tipoDente(d) {
  const q = Math.floor(d / 10), n = d % 10, dec = q >= 5;
  const tipo = dec ? (n <= 2 ? "inc" : n === 3 ? "can" : "mol") : (n <= 2 ? "inc" : n === 3 ? "can" : n <= 5 ? "pre" : "mol");
  const sup = q === 1 || q === 2 || q === 5 || q === 6;
  const larg = (dec ? (sup ? LARG_DEC : LARG_DEC_INF) : (sup ? LARG : LARG_INF))[n];
  const raizes = tipo === "mol" ? (sup && !dec ? 3 : 2) : (sup && n === 4 && !dec ? 2 : 1);
  return { tipo, sup, dec, larg, raizes };
}
/** Desenha um dente em vista vestibular na caixa (x, y, w, h): coroa para o meio da boca, raízes para fora. */
function desenharDente(cx, d, x, y, w, h, corCoroa, corRaiz, borda) {
  const t = tipoDente(d), hc = h * (t.dec ? 0.46 : 0.4), hr = h - hc;
  cx.save();
  // eixo canônico: coroa em cima (y de 0 a hc), raízes embaixo; os superiores viram de ponta-cabeça
  if (t.sup) { cx.translate(x, y + h); cx.scale(1, -1); } else cx.translate(x, y);
  const cerv = t.tipo === "mol" ? 0.12 : t.tipo === "inc" ? 0.2 : 0.18; // quanto a coroa estreita no colo
  const xl = w * cerv, xr = w * (1 - cerv);
  // raízes
  const raiz = (a, b, ax, comp) => {
    const p = new Path2D();
    p.moveTo(a, hc - 2);
    p.quadraticCurveTo(a - w * 0.02, hc + comp * 0.55, ax - w * 0.05, hc + comp * 0.94);
    p.quadraticCurveTo(ax, hc + comp * 1.02, ax + w * 0.05, hc + comp * 0.94);
    p.quadraticCurveTo(b + w * 0.02, hc + comp * 0.55, b, hc - 2);
    p.closePath(); return p;
  };
  const raizes = [];
  if (t.raizes === 1) raizes.push(raiz(xl + w * 0.04, xr - w * 0.04, w / 2, hr * (t.tipo === "can" ? 1 : 0.9)));
  else {
    const m = w / 2, abre = t.dec ? 0.16 : 0.06; // decíduos: raízes abertas
    raizes.push(raiz(xl, m - w * 0.04, xl + w * (0.14 - abre), hr * 0.92));
    raizes.push(raiz(m + w * 0.04, xr, xr - w * (0.14 - abre), hr * 0.86));
    if (t.raizes === 3) raizes.push(raiz(m - w * 0.12, m + w * 0.12, m, hr * 0.98)); // palatina, por trás
  }
  for (const r of raizes.reverse()) { cx.fillStyle = corRaiz; cx.fill(r); cx.strokeStyle = borda; cx.lineWidth = 2; cx.stroke(r); }
  // coroa: lados abaulados, perfil oclusal pelo tipo (borda reta, ponta, uma ou duas cúspides)
  const c = new Path2D(), top = hc * 0.1;
  c.moveTo(xl, hc);
  c.bezierCurveTo(w * 0.02, hc * 0.72, -w * 0.01, hc * 0.3, w * 0.08, top + hc * 0.05);
  if (t.tipo === "inc") { c.quadraticCurveTo(w * 0.5, top - hc * 0.04, w * 0.92, top + hc * 0.05); }
  else if (t.tipo === "can") { c.lineTo(w * 0.5, 0); c.lineTo(w * 0.92, top + hc * 0.05); }
  else if (t.tipo === "pre") { c.quadraticCurveTo(w * 0.3, top - hc * 0.02, w * 0.5, 0); c.quadraticCurveTo(w * 0.7, top - hc * 0.02, w * 0.92, top + hc * 0.05); }
  else { c.quadraticCurveTo(w * 0.17, 0, w * 0.3, 0); c.quadraticCurveTo(w * 0.5, top * 1.6, w * 0.7, 0); c.quadraticCurveTo(w * 0.83, 0, w * 0.92, top + hc * 0.05); }
  c.bezierCurveTo(w * 1.01, hc * 0.3, w * 0.98, hc * 0.72, xr, hc);
  c.closePath();
  cx.fillStyle = corCoroa; cx.fill(c); cx.strokeStyle = borda; cx.lineWidth = 2.5; cx.stroke(c);
  // linha do colo
  cx.strokeStyle = borda; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(xl, hc); cx.quadraticCurveTo(w / 2, hc + hc * 0.06, xr, hc); cx.stroke();
  cx.restore();
  return { coroaY: t.sup ? y + h - hc : y, hc };
}

/** Odontograma de calor desenhado: os dentes em vista vestibular, pintados pelo número de procedimentos (FDI). */
export async function odontograma(cont, { w = 1800 } = {}) {
  const max = Math.max(1, ...cont.values());
  const ESC = ["#F4F7F9", "#D7F3EC", "#A5E3D3", "#5CC8B0", "#1E9E84", "#0B6F5E"];
  const nivel = (v) => (!v ? 0 : Math.max(1, Math.ceil(Math.sqrt(v / max) * 5)));
  const RAIZ = ["#FBFCFD", "#EEF9F6", "#DDF2EC", "#C8EAE0", "#B4E0D3", "#A2D6C6"];
  const arcada = (dentes, sup, dec) => dentes.map(d => tipoDente(d).larg);
  const linhas = [
    { dentes: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], sup: true },
    { dentes: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38], sup: false },
    { dentes: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65], sup: true, dec: true },
    { dentes: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75], sup: false, dec: true },
  ];
  const marg = 60, gap = 6, meio = 30;
  const totalPerm = arcada(linhas[0].dentes).reduce((a, b) => a + b, 0);
  const k = (w - 2 * marg - meio - 15 * gap) / totalPerm; // px por mm
  const hPerm = 23 * k, hDec = 16 * k, faixaNum = 64;
  const h = 70 + hPerm * 2 + faixaNum + 90 + hDec * 2 + faixaNum + 120;
  const [c, cx] = tela(w, h);
  const desenharLinha = (L, y0, alt) => {
    const larguras = L.dentes.map(d => tipoDente(d).larg * k), tot = larguras.reduce((a, b) => a + b, 0) + gap * (L.dentes.length - 1) + meio;
    let x = (w - tot) / 2;
    L.dentes.forEach((d, i) => {
      if (i === L.dentes.length / 2) x += meio;
      const v = cont.get(String(d)) || 0, n = nivel(v), lw = larguras[i];
      const r = desenharDente(cx, d, x, y0, lw, alt, ESC[n], RAIZ[n], n >= 4 ? "#0A5A4C" : "#8FA6B2");
      // número de procedimentos na coroa e o número do dente perto do meio da boca
      const cyCoroa = L.sup ? y0 + alt - r.hc / 2 : y0 + r.hc / 2;
      if (v) { cx.font = `bold ${Math.round(Math.min(30, lw * 0.42))}px ${FONTE}`; cx.fillStyle = n >= 4 ? "#fff" : TINTA; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(fmt(v), x + lw / 2, cyCoroa + (L.sup ? 3 : -3)); }
      cx.font = `${Math.round(Math.min(22, lw * 0.36))}px ${FONTE}`; cx.fillStyle = TINTA2; cx.textAlign = "center"; cx.textBaseline = L.sup ? "top" : "bottom";
      cx.fillText(String(d), x + lw / 2, L.sup ? y0 + alt + 6 : y0 - 6);
      x += lw + gap;
    });
  };
  cx.font = `bold 26px ${FONTE}`; cx.fillStyle = TINTA; cx.textAlign = "left"; cx.textBaseline = "middle"; cx.fillText("Dentes permanentes", marg, 32);
  let y = 60;
  desenharLinha(linhas[0], y, hPerm); y += hPerm + faixaNum; desenharLinha(linhas[1], y, hPerm); y += hPerm;
  cx.strokeStyle = "#B7C6CE"; cx.lineWidth = 2; cx.setLineDash([6, 6]); cx.beginPath(); cx.moveTo(w / 2, 50); cx.lineTo(w / 2, y + 10); cx.stroke(); cx.setLineDash([]);
  y += 50; cx.font = `bold 26px ${FONTE}`; cx.fillStyle = TINTA; cx.textAlign = "left"; cx.fillText("Dentes decíduos", marg, y); y += 28;
  const y1 = y; desenharLinha(linhas[2], y, hDec); y += hDec + faixaNum; desenharLinha(linhas[3], y, hDec); y += hDec;
  cx.strokeStyle = "#B7C6CE"; cx.setLineDash([6, 6]); cx.beginPath(); cx.moveTo(w / 2, y1 - 6); cx.lineTo(w / 2, y + 10); cx.stroke(); cx.setLineDash([]);
  // legenda da escala
  const ly = h - 60, lw = 70, lx = (w - ESC.length * lw) / 2;
  cx.font = `22px ${FONTE}`; cx.textBaseline = "middle"; cx.fillStyle = TINTA2; cx.textAlign = "right"; cx.fillText("Procedimentos por dente:", lx - 16, ly + 14);
  ESC.forEach((col, i) => { cx.fillStyle = col; cx.fillRect(lx + i * lw, ly, lw, 28); cx.strokeStyle = "#C9D6DD"; cx.strokeRect(lx + i * lw, ly, lw, 28); });
  cx.fillStyle = TINTA2; cx.textAlign = "left"; cx.fillText(`0 a ${fmt(max)} · lado direito do paciente à esquerda`, lx + ESC.length * lw + 16, ly + 14);
  return { png: await png(c), w, h };
}

/** Fluxograma de inclusão: etapas [[texto, n]] na coluna principal e exclusões [[texto, n]] ao lado, entre as etapas. */
export async function fluxograma(etapas, exclusoes, { w = 1600 } = {}) {
  const bh = 110, gapY = 70, h = 40 + etapas.length * bh + (etapas.length - 1) * gapY + 40, [c, cx] = tela(w, h), bw = 620, x0 = 60;
  const caixa = (x, y, ww, hh, texto, n, fundo, borda) => {
    cx.fillStyle = fundo; cx.strokeStyle = borda; cx.lineWidth = 3; cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, ww, hh, 14) : cx.rect(x, y, ww, hh); cx.fill(); cx.stroke();
    cx.fillStyle = TINTA; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.font = `26px ${FONTE}`; cx.fillText(cortar(cx, texto, ww - 30), x + ww / 2, y + hh / 2 - 18);
    cx.font = `bold 32px ${FONTE}`; cx.fillText(`n = ${fmt(n)}`, x + ww / 2, y + hh / 2 + 22);
  };
  etapas.forEach(([t, n], k) => {
    const y = 40 + k * (bh + gapY);
    caixa(x0, y, bw, bh, t, n, "#EAF7F3", COR);
    if (k < etapas.length - 1) {
      const ya = y + bh, yb = y + bh + gapY, xm = x0 + bw / 2;
      cx.strokeStyle = TINTA2; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(xm, ya); cx.lineTo(xm, yb - 6); cx.stroke();
      cx.fillStyle = TINTA2; cx.beginPath(); cx.moveTo(xm - 10, yb - 16); cx.lineTo(xm + 10, yb - 16); cx.lineTo(xm, yb - 2); cx.fill();
      const ex = exclusoes[k];
      if (ex && ex[1]) {
        const ex0 = x0 + bw + 110, ey = ya + gapY / 2 - 50;
        cx.strokeStyle = TINTA2; cx.beginPath(); cx.moveTo(xm, ya + gapY / 2); cx.lineTo(ex0 - 6, ya + gapY / 2); cx.stroke();
        cx.fillStyle = TINTA2; cx.beginPath(); cx.moveTo(ex0 - 16, ya + gapY / 2 - 10); cx.lineTo(ex0 - 16, ya + gapY / 2 + 10); cx.lineTo(ex0 - 2, ya + gapY / 2); cx.fill();
        caixa(ex0, ey, w - ex0 - 40, 100, ex[0], ex[1], "#FBF1F0", "#D2433B");
      }
    }
  });
  return { png: await png(c), w, h };
}
