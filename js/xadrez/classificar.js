// Classificação dos lances como no chess.com (pedido do Alediov, 02/11/2026): Brilhante !!, Ótimo !, Melhor ★,
// Excelente, Bom, Livro 📖, Imprecisão ?!, Erro ?, Capivarada ??.
// A régua é a queda na chance de vencer de quem jogou (a fórmula do lichess, a mesma da precisão das partidas):
// melhor = o lance do motor (ou perda < 0,5 ponto); excelente ≤ 2; bom ≤ 5; imprecisão ≤ 10; erro ≤ 20; capivarada > 20.
// Ótimo: o melhor lance quando o 2º melhor perde 15 pontos ou mais (o único lance bom). Brilhante: um lance bom
// (melhor ou excelente) que entrega uma peça (cavalo, bispo, torre ou dama numa casa atacada, sem defesa ou atacada por
// peça mais barata) sem deixar a posição perdida (chance ≥ 35%) e sem já estar ganha de qualquer jeito (< 97%).
import { Chess } from "../../vendor/chess.js";
import { chanceBrancas } from "./tabuleiro.js";
import * as M from "./motor.js";

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
/** A nota (centipeões) do lado de quem joga: mate vira ±(10000 − n). */
export const notaDe = (r) => (r?.mate != null ? (r.mate > 0 ? 10000 - r.mate : -10000 - r.mate) : r?.cp ?? 0);
/** { cp } ou { mate } do lado das BRANCAS, a partir de uma análise feita na vez de `vez`. */
export const avBrancas = (r, vez) => {
  const s = vez === "w" ? 1 : -1;
  return r?.mate != null && r.mate !== 0 ? { mate: s * r.mate } : { cp: s * (r?.cp ?? 0) };
};
/** Avaliação do repertório (número do montar_repertorio.mjs, do lado das brancas) → { cp } ou { mate }. */
export const avDoNumero = (v) => (Math.abs(v) > 9000 ? { mate: v > 0 ? 10000 - v : -10000 - v } : { cp: v });

function entrega(fenDepois, para) {
  const g = new Chess(fenDepois), p = g.get(para);
  if (!p || p.type === "p" || p.type === "k") return false;
  const outro = p.color === "w" ? "b" : "w";
  const atac = g.attackers(para, outro);
  if (!atac.length) return false;
  const def = g.attackers(para, p.color);
  const menor = Math.min(...atac.map(c => VAL[g.get(c)?.type] || 9));
  return !def.length || menor < VAL[p.type];
}
/**
 * Classifica um lance. `antes`: a análise da posição antes (multipv 2, do lado de quem joga); `depois`: a análise da
 * posição depois (do lado do adversário); `uci` o lance jogado; `fenDepois` para ver se é uma entrega de peça.
 * Devolve { tipo, perda (pontos de chance), melhor (uci) }.
 */
export function classificar({ antes, depois, uci, fenDepois }) {
  const a = notaDe(antes), d = -notaDe(depois);
  const wa = chanceBrancas(a), wd = chanceBrancas(d), perda = Math.max(0, wa - wd);
  const ehMelhor = uci === antes?.melhor || perda < 0.5;
  let tipo = ehMelhor ? "melhor" : perda <= 2 ? "excelente" : perda <= 5 ? "bom" : perda <= 10 ? "imprecisao" : perda <= 20 ? "erro" : "capivarada";
  if (ehMelhor || perda <= 2) {
    const seg = antes?.linhas?.[1];
    if (fenDepois && wd >= 35 && wd < 97 && entrega(fenDepois, uci.slice(2, 4))) tipo = "brilhante";
    else if (ehMelhor && seg && wa - chanceBrancas(notaDe(seg)) >= 15 && wa < 97) tipo = "otimo";
  }
  return { tipo, perda, melhor: antes?.melhor || null };
}
/** Analisa e classifica um lance jogado em `fen` (uci), com o Stockfish do app. */
export async function avaliarLance(fen, uci, { prof = 11 } = {}) {
  const antes = await M.analisar(fen, { prof, multipv: 2 });
  const g = new Chess(fen), mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  const depois = g.isGameOver() ? { cp: g.isCheckmate() ? null : 0, mate: g.isCheckmate() ? 0 : null } : await M.analisar(g.fen(), { prof });
  if (g.isCheckmate()) { depois.mate = null; depois.cp = -10000; }
  const c = classificar({ antes, depois, uci, fenDepois: g.fen() });
  return { ...c, mv, antes, depois, av: avBrancas(depois, g.turn()) };
}

/**
 * Precisão de um lance (0 a 100) pela queda na chance de vencer de quem jogou (`wa` antes, `wd` depois, de 0 a 100):
 * a fórmula do lichess, a mesma das partidas contra o computador (analisarPartida).
 */
export const precisaoLance = (wa, wd) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, wa - wd)) - 3.1669));
/**
 * Precisão de cada lado numa partida analisada (tabuleiro de análise, 03/11/2026). `notas`: a nota de cada posição do
 * lado das brancas (centipeões; mate = ±(10000 − n)), da inicial à final; `cores`: quem jogou cada lance ("w"/"b").
 * Lances sem as duas notas ficam de fora. Devolve { w, b } (média dos lances, arredondada; null sem lances).
 */
export function precisaoDaPartida(notas, cores) {
  const soma = { w: 0, b: 0 }, n = { w: 0, b: 0 };
  cores.forEach((c, i) => {
    const a = notas[i], d = notas[i + 1];
    if (a == null || d == null) return;
    const s = c === "w" ? 1 : -1;
    soma[c] += precisaoLance(chanceBrancas(s * a), chanceBrancas(s * d)); n[c]++;
  });
  return { w: n.w ? Math.round(soma.w / n.w) : null, b: n.b ? Math.round(soma.b / n.b) : null };
}
