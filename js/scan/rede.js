// Rede pequena de dígitos manuscritos (2 convoluções + 2 densas), executada em JS puro.
// Pesos int8 por camada (pesos.js). Ordem dos tensores igual à do Keras: [kh, kw, entrada, saída] e HWC.
import { PESOS } from "./pesos.js";

let camadas = null;
function carregar() {
  if (camadas) return camadas;
  camadas = PESOS.map(c => {
    const bin = atob(c.w), q = new Int8Array(bin.length);
    for (let i = 0; i < bin.length; i++) q[i] = (bin.charCodeAt(i) << 24) >> 24;
    const w = new Float32Array(q.length); for (let i = 0; i < q.length; i++) w[i] = q[i] * c.esc;
    return { forma: c.forma, w, b: Float32Array.from(c.b) };
  });
  return camadas;
}

function conv(x, H, W, C, { forma: [kh, kw, , F], w, b }) {
  const Ho = H - kh + 1, Wo = W - kw + 1, out = new Float32Array(Ho * Wo * F);
  for (let y = 0; y < Ho; y++) for (let xx = 0; xx < Wo; xx++) {
    const o = (y * Wo + xx) * F;
    for (let f = 0; f < F; f++) out[o + f] = b[f];
    for (let i = 0; i < kh; i++) for (let j = 0; j < kw; j++) {
      const pi = ((y + i) * W + xx + j) * C, wi = (i * kw + j) * C * F;
      for (let c = 0; c < C; c++) {
        const v = x[pi + c]; if (!v) continue;
        const wo = wi + c * F;
        for (let f = 0; f < F; f++) out[o + f] += v * w[wo + f];
      }
    }
    for (let f = 0; f < F; f++) if (out[o + f] < 0) out[o + f] = 0;
  }
  return [out, Ho, Wo, F];
}
function pool(x, H, W, C) {
  const Ho = H >> 1, Wo = W >> 1, out = new Float32Array(Ho * Wo * C);
  for (let y = 0; y < Ho; y++) for (let xx = 0; xx < Wo; xx++) for (let c = 0; c < C; c++) {
    const a = (i, j) => x[((2 * y + i) * W + 2 * xx + j) * C + c];
    out[(y * Wo + xx) * C + c] = Math.max(a(0, 0), a(0, 1), a(1, 0), a(1, 1));
  }
  return [out, Ho, Wo, C];
}
function densa(x, { forma: [ni, no], w, b }, relu) {
  const out = Float32Array.from(b);
  for (let i = 0; i < ni; i++) { const v = x[i]; if (!v) continue; const o = i * no; for (let j = 0; j < no; j++) out[j] += v * w[o + j]; }
  if (relu) for (let j = 0; j < no; j++) if (out[j] < 0) out[j] = 0;
  return out;
}

/** Probabilidades dos 10 dígitos para uma imagem 28×28 (0 = fundo, 1 = tinta). */
export function preverDigito(x28) {
  const L = carregar();
  let [x, H, W, C] = conv(x28, 28, 28, 1, L[0]);
  [x, H, W, C] = pool(x, H, W, C);
  [x, H, W, C] = conv(x, H, W, C, L[1]);
  [x, H, W, C] = pool(x, H, W, C);
  x = densa(x, L[2], true);
  const z = densa(x, L[3], false), mx = Math.max(...z), e = z.map(v => Math.exp(v - mx)), s = e.reduce((a, b) => a + b, 0);
  return Array.from(e, v => v / s);
}
