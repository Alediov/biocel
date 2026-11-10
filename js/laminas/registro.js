// Dados das lâminas digitais que SINCRONIZAM entre o celular e o tablet (sincronia.js + juntar.js), pela chave UID do
// .vmic (a mesma lâmina nos dois aparelhos divide os dados): E().laminasDigitais[uid] = { nome, lesao, notas,
// marcadores: [{ id, x, y, texto, em }] } (x e y em pixels da imagem cheia; lesao = id de extras/jogos/laminas.json
// ou um texto livre).
// O registro da lâmina NÃO tem `em` de propósito: com `em`, o juntar.js ficaria com o registro mais novo inteiro e
// perderia a marcação feita no outro aparelho. Assim cada campo junta sozinho (texto: o aparelho que mudou por último;
// a lista de marcadores: une os dois lados, respeitando os apagados, e cada marcador tem o seu `em`).
import { E, salvar } from "../estado.js";

export const LD = () => (E().laminasDigitais ??= {});
export const dadosDe = (uid) => LD()[uid] || null;
function garantir(uid) { const r = (LD()[uid] ??= {}); r.marcadores ??= []; return r; }

export function nomeDe(uid, padrao = "Lâmina") { return LD()[uid]?.nome || padrao; }

/** Muda nome, lesão ou notas ("" apaga o campo). */
export function mudar(uid, campos) {
  const r = garantir(uid);
  for (const [k, v] of Object.entries(campos)) { if (v === "" || v == null) delete r[k]; else r[k] = v; }
  salvar();
}

const novoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Os marcadores, um por id (se o mesmo foi editado nos dois aparelhos, fica o mais novo), na ordem em que foram feitos. */
export function marcadoresDe(uid) {
  const por = new Map();
  for (const m of LD()[uid]?.marcadores || []) { const a = por.get(m.id); if (!a || (m.em || "") > (a.em || "")) por.set(m.id, m); }
  return [...por.values()].sort((a, b) => (a.criado || a.em || "").localeCompare(b.criado || b.em || ""));
}

export function marcar(uid, { x, y, texto }) {
  const r = garantir(uid), em = new Date().toISOString();
  const m = { id: novoId(), x: Math.round(x), y: Math.round(y), texto: String(texto || "").slice(0, 200), em, criado: em };
  r.marcadores.push(m); salvar();
  return m;
}
export function editarMarcador(uid, id, texto) {
  const r = garantir(uid), a = marcadoresDe(uid).find(m => m.id === id);
  if (!a) return;
  r.marcadores = r.marcadores.filter(m => m.id !== id);
  r.marcadores.push({ ...a, texto: String(texto || "").slice(0, 200), em: new Date().toISOString() });
  salvar();
}
export function apagarMarcador(uid, id) {
  const r = garantir(uid);
  r.marcadores = r.marcadores.filter(m => m.id !== id); salvar();
}

/** As lâminas (UIDs) ligadas a uma lesão do Treino de Lâminas. */
export const laminasDaLesao = (lesao) => Object.entries(LD()).filter(([, r]) => r?.lesao === lesao).map(([uid]) => uid);

// ---------------------------------------------------------------- desenhos (setas e traços da caneta)
// E().laminasDigitais[uid].desenhos = [{ id, tipo: "traco" | "seta", cor, pts: [x0, y0, x1, y1, …], em }]: pontos inteiros
// em pixels da imagem cheia (ficam presos ao tecido em qualquer zoom), traços simplificados (Douglas-Peucker) e com teto,
// para o estado sincronizado não crescer: no máximo MAX_PONTOS por traço e MAX_DESENHOS por lâmina.
export const MAX_PONTOS = 240, MAX_DESENHOS = 200;

/** Douglas-Peucker num [x, y, x, y, …] com a tolerância em pixels da imagem. */
export function simplificar(pts, tol) {
  const n = pts.length / 2;
  if (n <= 2) return pts.slice();
  const manter = new Uint8Array(n); manter[0] = manter[n - 1] = 1;
  const pilha = [[0, n - 1]];
  while (pilha.length) {
    const [a, b] = pilha.pop();
    const ax = pts[2 * a], ay = pts[2 * a + 1], bx = pts[2 * b], by = pts[2 * b + 1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let mx = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[2 * i] - dx * pts[2 * i + 1] + bx * ay - by * ax) / L;
      if (d > mx) { mx = d; mi = i; }
    }
    if (mx > tol) { manter[mi] = 1; pilha.push([a, mi], [mi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (manter[i]) out.push(pts[2 * i], pts[2 * i + 1]);
  return out;
}

export function desenhosDe(uid) {
  const por = new Map();
  for (const d of LD()[uid]?.desenhos || []) { const a = por.get(d.id); if (!a || (d.em || "") > (a.em || "")) por.set(d.id, d); }
  return [...por.values()].sort((a, b) => (a.em || "").localeCompare(b.em || ""));
}

/** Guarda um desenho; `tol`: tolerância da simplificação (px da imagem). → o desenho, ou null se passou do teto. */
export function guardarDesenho(uid, { tipo, cor, pts }, tol = 1) {
  const r = garantir(uid);
  r.desenhos ??= [];
  if (desenhosDe(uid).length >= MAX_DESENHOS) return null;
  let p = tipo === "seta" ? [pts[0], pts[1], pts[pts.length - 2], pts[pts.length - 1]] : simplificar(pts, tol);
  for (let t = tol * 2; p.length / 2 > MAX_PONTOS; t *= 2) p = simplificar(pts, t);
  const d = { id: novoId().replace(/^m/, "d"), tipo: tipo === "seta" ? "seta" : "traco", cor: String(cor).slice(0, 9), pts: p.map(Math.round), em: new Date().toISOString() };
  r.desenhos.push(d); salvar();
  return d;
}
export function apagarDesenho(uid, id) {
  const r = garantir(uid);
  r.desenhos = (r.desenhos || []).filter(d => d.id !== id); salvar();
}
export function limparDesenhos(uid) { const r = garantir(uid); r.desenhos = []; salvar(); }

// ---------------------------------------------------------------- treino com os campos das lâminas (quiz.js)
// E().laminas.campos[lesao] = { c, e, ult }: acertos e erros por lesão nos campos sorteados das lâminas dele. Sem `em`
// de propósito: assim o juntar.js SOMA o que cada aparelho acertou (com `em`, ficaria só o registro mais novo).
export function anotarCampo(lesao, certo) {
  const l = (E().laminas ??= {}), c = (l.campos ??= {});
  const r = (c[lesao] ??= { c: 0, e: 0 });
  r[certo ? "c" : "e"]++; r.ult = new Date().toISOString().slice(0, 10);
  salvar();
}
export const camposDe = (lesao) => E().laminas?.campos?.[lesao] || { c: 0, e: 0 };
