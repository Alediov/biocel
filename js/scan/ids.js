// Identificadores: dígitos verificadores, correção pela busca mais provável e códigos pseudônimos (HMAC).

export function cpfValido(d) {
  if (d.length !== 11 || d.every(x => x === d[0])) return false;
  for (const n of [9, 10]) {
    let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i);
    if ((s * 10) % 11 % 10 !== d[n]) return false;
  }
  return true;
}
export function cnsValido(d) {
  if (d.length !== 15 || ![1, 2, 7, 8, 9].includes(d[0])) return false;
  let s = 0; for (let i = 0; i < 15; i++) s += d[i] * (15 - i);
  return s % 11 === 0;
}
export const VALIDADOR = { cpf: cpfValido, cns: cnsValido };

/** Combinação mais provável que passa no dígito verificador (busca do melhor primeiro).
 *  Devolve { digitos, conf } com conf = P(escolhida) / P(leitura crua); 1 = a leitura crua já era válida. */
export function melhorValido(probs, valido, limite = 20000) {
  const n = probs.length;
  if (!n) return null;
  const L = probs.map(p => p.map(v => -Math.log(Math.max(v, 1e-6))));
  const ordem = L.map(l => l.map((v, i) => i).sort((a, b) => l[a] - l[b]));
  const custo = (k) => k.reduce((s, ki, i) => s + L[i][ordem[i][ki]], 0);
  const ini = new Array(n).fill(0), c0 = custo(ini);
  const heap = [[c0, ini]], vistos = new Set([ini.join(",")]);
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], ult = heap.pop(); if (heap.length) { heap[0] = ult; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length && limite--) {
    const [c, k] = pop();
    const d = k.map((ki, i) => ordem[i][ki]);
    if (valido(d)) return { digitos: d, conf: Math.exp(c0 - c) };
    for (let i = 0; i < n; i++) if (k[i] < 9) {
      const k2 = k.slice(); k2[i]++;
      const chave = k2.join(","); if (!vistos.has(chave)) { vistos.add(chave); push([custo(k2), k2]); }
    }
  }
  return null;
}

// ---------------- códigos pseudônimos ----------------
const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
export async function novaChave() {
  const k = crypto.getRandomValues(new Uint8Array(32));
  return hex(k.buffer);
}
const cacheChaves = new Map();
async function chaveHmac(chaveHex) {
  if (!cacheChaves.has(chaveHex)) {
    const bytes = new Uint8Array(chaveHex.match(/../g).map(h => parseInt(h, 16)));
    cacheChaves.set(chaveHex, await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
  }
  return cacheChaves.get(chaveHex);
}
export const normalizarNome = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
/** Código estável e não reversível sem a chave: mesmo valor → mesmo código. */
export async function codigo(chaveHex, tipo, valor) {
  const sig = await crypto.subtle.sign("HMAC", await chaveHmac(chaveHex), enc.encode(`${tipo}:${valor}`));
  const prefixo = { cpf: "P", cns: "P", prontuario: "P", aluno: "A", professor: "D" }[tipo] || "X";
  return `${prefixo}-${hex(sig).slice(0, 10).toUpperCase()}`;
}
