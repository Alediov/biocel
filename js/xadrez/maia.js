// Adversário "humano" (pedido do Alediov, 25/10/2026): as redes Maia (CSSLab, Universidade de Toronto; GPL-3.0),
// treinadas para prever o lance que um jogador de certo rating do Lichess faria. Rodam aqui mesmo, sem biblioteca:
// a rede é pequena (6 blocos residuais com squeeze-and-excitation, 64 filtros, tabuleiro 8×8), ~37 milhões de
// multiplicações por lance, poucos décimos de segundo no celular. Pesos em app/vendor/maia/ (float16, com a
// normalização em lote embutida), exportados por tools/xadrez/maia_exportar.py; mapa da política igual ao do lc0.
// Entrada: 112 planos (as 8 últimas posições do ponto de vista de quem joga, 13 planos cada, + roque, vez, regra dos
// 50 lances e um plano de uns). Saída: 80×64 → 1.858 jogadas (rei "captura" a torre no roque; promoção a cavalo
// é a jogada sem letra).
import { Chess } from "../../vendor/chess.js";

export const ELOS = [1100, 1500, 1900];
const PECAS = "pnbrqk";
let mapa = null;
const redes = new Map();

function f16(h) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * Math.pow(2, e - 15) * (1 + f / 1024);
}
async function carregarMapa() {
  if (!mapa) { mapa = (async () => (await fetch(new URL("../../vendor/maia/mapa.json", import.meta.url))).json())(); mapa.catch(() => (mapa = null)); }
  return mapa;
}
async function carregar(elo) {
  if (redes.has(elo)) return redes.get(elo);
  const p = (async () => {
    const buf = await (await fetch(new URL(`../../vendor/maia/maia-${elo}.bin`, import.meta.url))).arrayBuffer();
    const u = new Uint16Array(buf), d = new Float32Array(u.length);
    for (let i = 0; i < u.length; i++) d[i] = f16(u[i]);
    let o = 0;
    const tira = (n) => { const a = d.subarray(o, o + n); o += n; return a; };
    const conv = (cin, cout) => ({ w: tira(cout * cin * 9), b: tira(cout), cin, cout });
    const R = { entrada: conv(112, 64), blocos: [] };
    for (let i = 0; i < 6; i++) R.blocos.push({ c1: conv(64, 64), c2: conv(64, 64), w1: tira(8 * 64), b1: tira(8), w2: tira(128 * 8), b2: tira(128) });
    R.pol1 = conv(64, 64); R.pol = conv(64, 80);
    if (o !== d.length) throw new Error("rede Maia com tamanho inesperado");
    return R;
  })();
  redes.set(elo, p);
  p.catch(() => redes.delete(elo));
  return p;
}

// A conta da rede (~37 milhões de multiplicações) roda num Worker (este mesmo arquivo, como módulo), para não travar a
// tela enquanto a Maia "pensa" (26/10/2026: no celular eram ~0,5 s com a thread principal parada). Sem Worker (node,
// testes) ou se ele falhar, roda aqui mesmo.
const NO_WORKER = typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope;
if (NO_WORKER) {
  self.onmessage = async (e) => {
    const { id, elo, planos: P } = e.data;
    try { const saida = avancar(await carregar(elo), P); self.postMessage({ id, saida }, [saida.buffer]); }
    catch (err) { self.postMessage({ id, erro: String(err?.message || err) }); }
  };
}
let trab = null, trabFalhou = false, proxId = 1;
const pendentes = new Map();
function rodarRede(elo, P) {
  if (NO_WORKER || trabFalhou || typeof Worker === "undefined") return carregar(elo).then(R => avancar(R, P));
  if (!trab) {
    try {
      trab = new Worker(new URL("./maia.js", import.meta.url), { type: "module" });
      trab.onmessage = (e) => { const p = pendentes.get(e.data.id); if (!p) return; pendentes.delete(e.data.id); if (e.data.erro) p.falhar(e.data.erro); else p.ok(e.data.saida); };
      trab.onerror = (e) => { e.preventDefault?.(); console.warn("Maia: Worker falhou, rodando na tela", e.message || ""); trabFalhou = true; trab?.terminate(); trab = null; const ps = [...pendentes.values()]; pendentes.clear(); for (const p of ps) p.aqui(); };
    } catch { trabFalhou = true; return carregar(elo).then(R => avancar(R, P)); }
  }
  return new Promise((ok, rej) => {
    const id = proxId++;
    const aqui = () => carregar(elo).then(R => ok(avancar(R, P)), rej);
    pendentes.set(id, { ok, aqui, falhar: (m) => { console.warn("Maia (Worker):", m); aqui(); } });
    trab.postMessage({ id, elo, planos: P }); // copiado (28 KB): se o Worker falhar, a conta refaz aqui com os mesmos planos
  });
}
/** Carrega a rede de antemão (ao abrir uma partida), para o 1º lance não demorar. */
export function prepararMaia(elo = 1500) { carregarMapa().catch(() => {}); if (NO_WORKER || trabFalhou || typeof Worker === "undefined") return; rodarRede(elo, new Float32Array(112 * 64)).catch(() => {}); }

/** Convolução 3×3 com borda zero: entrada [cin][64] → saída [cout][64]. */
function conv3(x, L, relu) {
  const { w, b, cin, cout } = L, out = new Float32Array(cout * 64);
  for (let o = 0; o < cout; o++) {
    const y = out.subarray(o * 64, o * 64 + 64);
    y.fill(b[o]);
    for (let c = 0; c < cin; c++) {
      const xc = c * 64, k = (o * cin + c) * 9;
      for (let kh = 0; kh < 3; kh++) for (let kw = 0; kw < 3; kw++) {
        const p = w[k + kh * 3 + kw]; if (p === 0) continue;
        const dr = kh - 1, df = kw - 1;
        const r0 = Math.max(0, -dr), r1 = Math.min(8, 8 - dr), f0 = Math.max(0, -df), f1 = Math.min(8, 8 - df);
        for (let r = r0; r < r1; r++) {
          const base = r * 8, src = xc + (r + dr) * 8 + df;
          for (let f = f0; f < f1; f++) y[base + f] += p * x[src + f];
        }
      }
    }
    if (relu) for (let i = 0; i < 64; i++) if (y[i] < 0) y[i] = 0;
  }
  return out;
}

function avancar(R, planos) {
  let x = conv3(planos, R.entrada, true);
  for (const B of R.blocos) {
    const y = conv3(conv3(x, B.c1, true), B.c2, false);
    const pool = new Float32Array(64);
    for (let c = 0; c < 64; c++) { let s = 0; for (let i = 0; i < 64; i++) s += y[c * 64 + i]; pool[c] = s / 64; }
    const h = new Float32Array(8);
    for (let j = 0; j < 8; j++) { let s = B.b1[j]; for (let c = 0; c < 64; c++) s += B.w1[j * 64 + c] * pool[c]; h[j] = s > 0 ? s : 0; }
    const g = new Float32Array(128);
    for (let j = 0; j < 128; j++) { let s = B.b2[j]; for (let k = 0; k < 8; k++) s += B.w2[j * 8 + k] * h[k]; g[j] = s; }
    const nx = new Float32Array(64 * 64);
    for (let c = 0; c < 64; c++) {
      const sg = 1 / (1 + Math.exp(-g[c])), bt = g[64 + c];
      for (let i = 0; i < 64; i++) { const v = sg * y[c * 64 + i] + bt + x[c * 64 + i]; nx[c * 64 + i] = v > 0 ? v : 0; }
    }
    x = nx;
  }
  return conv3(conv3(x, R.pol1, true), R.pol, false);
}

const quadrado = (sq) => (sq.charCodeAt(1) - 49) * 8 + (sq.charCodeAt(0) - 97); // a1 = 0

/** Os 112 planos de entrada a partir da partida (chess.js com o histórico). */
function planos(jogo) {
  const P = new Float32Array(112 * 64);
  const hist = jogo.history({ verbose: true });
  const preto = jogo.turn() === "b";
  // posições: a atual e as anteriores (até 7), refeitas a partir dos FENs do histórico
  const fens = [jogo.fen()];
  for (let i = hist.length - 1; i >= 0 && fens.length < 8; i--) fens.push(hist[i].before);
  const chave = (f) => f.split(" ").slice(0, 4).join(" ");
  const vistas = new Map();
  for (const m of hist) { const k = chave(m.before); vistas.set(k, (vistas.get(k) || 0) + 1); }
  fens.forEach((fen, i) => {
    const base = i * 13, linhas = fen.split(" ")[0].split("/");
    for (let ri = 0; ri < 8; ri++) {
      let f = 0;
      for (const ch of linhas[ri]) {
        if (ch >= "1" && ch <= "8") { f += +ch; continue; }
        const branca = ch === ch.toUpperCase(), t = PECAS.indexOf(ch.toLowerCase());
        const nosso = branca !== preto, rank = 7 - ri, r = preto ? 7 - rank : rank;
        P[(base + (nosso ? 0 : 6) + t) * 64 + r * 8 + f] = 1;
        f++;
      }
    }
    // repetição: a posição já apareceu antes
    const ocorr = (vistas.get(chave(fen)) || 0) - (i === 0 ? 0 : 1);
    if (ocorr >= 1) P.fill(1, (base + 12) * 64, (base + 13) * 64);
  });
  const [, , roque, , r50] = jogo.fen().split(" ");
  const nos = preto ? ["k", "q"] : ["K", "Q"], eles = preto ? ["K", "Q"] : ["k", "q"];
  const tudo = (pl, v = 1) => P.fill(v, pl * 64, pl * 64 + 64);
  if (roque.includes(nos[1])) tudo(104);
  if (roque.includes(nos[0])) tudo(105);
  if (roque.includes(eles[1])) tudo(106);
  if (roque.includes(eles[0])) tudo(107);
  if (preto) tudo(108);
  tudo(109, +r50 || 0);
  tudo(111);
  return P;
}

/** Probabilidade de cada lance legal, como a rede do rating escolhido o jogaria: [{ lan, san, p }]. */
export async function politica(jogo, elo = 1500) {
  const [saida, M] = await Promise.all([rodarRede(elo, planos(jogo)), carregarMapa()]);
  const logit = new Float32Array(1858).fill(-1e9);
  for (let e = 0; e < M.conv.length; e++) { const k = M.conv[e]; if (k >= 0) logit[k] = saida[e]; }
  const indice = M.indice ||= new Map(M.jogadas.map((m, i) => [m, i]));
  const preto = jogo.turn() === "b";
  const vira = (sq) => sq[0] + (9 - +sq[1]);
  const lances = jogo.moves({ verbose: true }).map(m => {
    let de = m.from, para = m.to;
    if (m.flags.includes("k")) para = m.color === "w" ? "h1" : "h8";
    if (m.flags.includes("q")) para = m.color === "w" ? "a1" : "a8";
    if (preto) { de = vira(de); para = vira(para); }
    const promo = m.promotion && m.promotion !== "n" ? m.promotion : "";
    const k = indice.get(de + para + promo);
    return { lan: m.from + m.to + (m.promotion || ""), san: m.san, l: k == null ? -1e9 : logit[k] };
  });
  const mx = Math.max(...lances.map(x => x.l));
  let soma = 0; for (const x of lances) { x.p = Math.exp(x.l - mx); soma += x.p; }
  for (const x of lances) { x.p /= soma; delete x.l; }
  return lances.sort((a, b) => b.p - a.p);
}

/** O lance da Maia: o mais provável, ou sorteado pela probabilidade (variar = true, com temperatura). */
export async function lanceMaia(jogo, elo = 1500, { variar = true, temperatura = 1 } = {}) {
  const pol = await politica(jogo, elo);
  if (!pol.length) return null;
  if (!variar) return pol[0];
  const w = pol.map(x => Math.pow(x.p, 1 / temperatura)), s = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * s;
  for (let i = 0; i < pol.length; i++) { r -= w[i]; if (r <= 0) return pol[i]; }
  return pol[0];
}

/** Para testar: lances a partir de um FEN e de uma lista de lances. */
export function jogoDe(fen, lances = []) { const j = new Chess(fen || undefined); for (const m of lances) j.move(m); return j; }
