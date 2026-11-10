// Leitura de partidas para o tabuleiro de análise do Xadrez (pedido do Alediov, 03/11/2026: "importar uma partida:
// colar PGN do chess.com ou do lichess, ou FEN"). Sem DOM: testado no node (tools/xadrez/teste_pgn.mjs).
//
// - `separarPartidas`: um texto com várias partidas vira uma lista (cada uma com os seus cabeçalhos e lances).
// - `lerPGN`: cabeçalhos [Tag "valor"] e os lances em SAN. Ignora comentários { … } e ; até o fim da linha (o
//   [%clk …] do chess.com e o [%eval …] do lichess vêm neles), linhas de escape (%), variantes entre parênteses
//   (mesmo aninhadas), NAGs ($1), números de lance (1. e 1...), as marcas !, ?, !!, ?!, "e.p." e o resultado.
// - `abrirPartida`: PGN ou FEN → { fen0, sans, tags, resultado, parou }, conferindo cada lance pelo chess.js; um lance
//   impossível para a leitura ali (`parou` diz qual e por quê) e o que veio antes fica. Lances escritos em português
//   (Cf3, Dxd8, Tb1, Rg1) também valem quando a partida não abre em inglês.
// - `ehFEN` / `completarFEN`: uma posição (as 4 primeiras partes bastam; as que faltam viram "- - 0 1").
// - `montarPGN`: o PGN de volta (para copiar a análise).
import { Chess, validateFen } from "../../vendor/chess.js";

const RESULTADOS = new Set(["1-0", "0-1", "1/2-1/2", "½-½", "*"]);
const INICIAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Tira comentários, linhas de escape e variantes; devolve { tags, corpo } de UMA partida. */
function limpar(txt) {
  const tags = {};
  let corpo = "", i = 0, prof = 0;
  const s = String(txt).replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i];
    // linha de escape: % no começo da linha
    if (c === "%" && (i === 0 || s[i - 1] === "\n")) { const f = s.indexOf("\n", i); i = f < 0 ? s.length : f + 1; continue; }
    if (c === "{") { const f = s.indexOf("}", i); i = f < 0 ? s.length : f + 1; corpo += " "; continue; }
    if (c === ";") { const f = s.indexOf("\n", i); i = f < 0 ? s.length : f + 1; corpo += " "; continue; }
    if (c === "(") { prof++; i++; corpo += " "; continue; }
    if (c === ")") { if (prof) prof--; i++; corpo += " "; continue; }
    if (prof) { i++; continue; }
    if (c === "[") {
      // cabeçalho [Nome "valor"] (aspas com \" dentro); um [ solto vira espaço
      const m = /^\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/.exec(s.slice(i, i + 2000));
      if (m) { tags[m[1]] = m[2].replace(/\\(.)/g, "$1"); i += m[0].length; continue; }
      const f = s.indexOf("]", i); i = f < 0 ? s.length : f + 1; corpo += " "; continue;
    }
    corpo += c; i++;
  }
  return { tags, corpo };
}

/** Os "pedaços" do corpo: lances, números e resultado. */
function fichas(corpo) {
  return corpo.replace(/\$\d+/g, " ").replace(/(\d+)\s*\.(\s*\.)*/g, " $1. ").split(/\s+/).filter(Boolean);
}

/** Um SAN sem as marcas de comentário (!, ?, ⩲…) e sem o "e.p."; "0-0" vira "O-O". "" se não parece um lance. */
export function limparSAN(t) {
  let s = String(t).trim().replace(/e\.p\.?$/i, "").replace(/[!?⁉⁈‼]+$/g, "").replace(/[+#]+[!?]*$/, (m) => m.replace(/[!?]/g, ""));
  s = s.replace(/^0-0-0/, "O-O-O").replace(/^0-0/, "O-O").replace(/^o-o-o/, "O-O-O").replace(/^o-o/, "O-O");
  if (/^\d+\.$/.test(s) || RESULTADOS.has(s) || !s) return "";
  if (!/^([KQRBNPKDTC]?[a-h]?[1-8]?x?[a-h][1-8](=?[QRBNDTC])?|O-O(-O)?)[+#]?$/.test(s)) return "";
  return s;
}

/** Separa um texto com várias partidas: uma nova começa num cabeçalho que vem depois de lances. */
export function separarPartidas(texto) {
  const s = String(texto || "").replace(/\r\n?/g, "\n");
  const out = [];
  let atual = "", temLances = false;
  for (const linha of s.split("\n")) {
    const t = linha.trim();
    if (/^\[\s*[A-Za-z0-9_]+\s+"/.test(t) && temLances) { out.push(atual); atual = ""; temLances = false; }
    atual += linha + "\n";
    if (t && !/^\[/.test(t) && !/^%/.test(t)) temLances = true;
  }
  if (atual.trim()) out.push(atual);
  return out.filter(p => p.trim());
}

/** Lê a primeira partida de um PGN: { tags, lances (SAN como escritos, limpos), resultado }. */
export function lerPGN(texto) {
  const { tags, corpo } = limpar(separarPartidas(texto)[0] || "");
  const lances = [];
  let resultado = tags.Result && RESULTADOS.has(tags.Result) ? tags.Result : null;
  for (const f of fichas(corpo)) {
    if (RESULTADOS.has(f)) { resultado = f === "½-½" ? "1/2-1/2" : f; break; }
    if (/^\d+\.$/.test(f) || /^\.+$/.test(f) || /^e\.p\.?$/i.test(f) || /^[!?]+$/.test(f)) continue;
    const s = limparSAN(f);
    if (s) lances.push(s);
    else if (f === "--" || f === "Z0") break; // lance nulo: não dá para seguir
  }
  return { tags, lances, resultado };
}

/** Parece uma posição FEN (as casas com 8 fileiras e, opcional, a vez)? */
export function ehFEN(texto) {
  const p = String(texto || "").trim().split(/\s+/);
  return p.length <= 6 && /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8}$/.test(p[0]) && (!p[1] || /^[wb]$/.test(p[1]));
}
/** Completa as partes que faltam ("- - 0 1"); devolve null se a posição não vale. */
export function completarFEN(texto) {
  const p = String(texto || "").trim().split(/\s+/);
  const pad = ["", "w", "-", "-", "0", "1"];
  for (let i = p.length; i < 6; i++) p[i] = pad[i];
  // roque que não combina com as peças (muito comum em FEN digitada): fica só o que ainda é possível
  const casas = {}, fil = p[0].split("/");
  fil.forEach((f, r) => { let c = 0; for (const ch of f) { if (/\d/.test(ch)) c += +ch; else { casas["abcdefgh"[c] + (8 - r)] = ch; c++; } } });
  const pode = { K: casas.e1 === "K" && casas.h1 === "R", Q: casas.e1 === "K" && casas.a1 === "R", k: casas.e8 === "k" && casas.h8 === "r", q: casas.e8 === "k" && casas.a8 === "r" };
  p[2] = [...(p[2] === "-" ? "" : p[2])].filter(ch => pode[ch]).join("") || "-";
  if (p[3] !== "-" && !/^[a-h][36]$/.test(p[3])) p[3] = "-";
  const fen = p.slice(0, 6).join(" ");
  if (!validateFen(fen).ok) return null;
  try { new Chess(fen); } catch { return null; }
  return fen;
}

// letras das peças em português → inglês (só quando a partida não abre em inglês: o "R" é rei aqui e torre lá)
const DE_PT = { R: "K", D: "Q", T: "R", C: "N", B: "B" };
const sanDePT = (s) => s.replace(/^[RDTCB](?=[a-h1-8x])/, (p) => DE_PT[p]).replace(/=([DTCB])/, (_, p) => "=" + DE_PT[p]);
function jogar(fen0, lances, traduzir) {
  const g = new Chess(fen0), sans = [];
  for (let i = 0; i < lances.length; i++) {
    const s = traduzir ? sanDePT(lances[i]) : lances[i];
    let mv = null;
    try { mv = g.move(s, { strict: false }); } catch { mv = null; }
    if (!mv) {
      const n = Math.floor((g.moveNumber ? g.moveNumber() : i / 2 + 1));
      return { sans, parou: { indice: i, san: lances[i], numero: `${n}${g.turn() === "w" ? "." : "..."}`, motivo: g.isGameOver() ? "a partida já tinha acabado" : "o lance não é possível nessa posição" } };
    }
    sans.push(mv.san);
  }
  return { sans, parou: null };
}

/**
 * Abre um texto colado: FEN (só a posição) ou PGN. Devolve { tipo, fen0, sans, tags, resultado, parou } ou
 * { erro } quando não há nada reconhecível.
 */
export function abrirPartida(texto) {
  const t = String(texto || "").trim();
  if (!t) return { erro: "Cole um PGN ou uma posição FEN." };
  if (ehFEN(t)) {
    const fen = completarFEN(t);
    return fen ? { tipo: "fen", fen0: fen, sans: [], tags: {}, resultado: null, parou: null } : { erro: "Essa posição não vale (confira os reis e a vez de jogar)." };
  }
  const { tags, lances, resultado } = lerPGN(t);
  let fen0 = INICIAL;
  if (tags.FEN) { const f = completarFEN(tags.FEN); if (!f) return { erro: "A posição inicial (FEN) do PGN não vale." }; fen0 = f; }
  if (!lances.length) return Object.keys(tags).length || resultado ? { tipo: "pgn", fen0, sans: [], tags, resultado, parou: null } : { erro: "Não achei lances nem posição no texto colado." };
  let r = jogar(fen0, lances, false);
  if (r.parou && r.parou.indice < lances.length) {
    const pt = jogar(fen0, lances, true);
    if (pt.sans.length > r.sans.length) r = pt;
  }
  return { tipo: "pgn", fen0, sans: r.sans, tags, resultado, parou: r.parou };
}

/** O PGN de uma partida (cabeçalhos, a posição inicial se não for a normal, os lances numerados e o resultado). */
export function montarPGN({ tags = {}, fen0 = INICIAL, sans = [], resultado = "*" } = {}) {
  const t = { Event: "Análise no Órbita", Site: "?", Date: "????.??.??", Round: "?", White: "?", Black: "?", Result: resultado || "*", ...tags };
  t.Result = resultado || t.Result || "*";
  if (fen0 && fen0 !== INICIAL) { t.SetUp = "1"; t.FEN = fen0; } else { delete t.SetUp; delete t.FEN; }
  const cab = Object.entries(t).map(([k, v]) => `[${k} "${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`).join("\n");
  const g = new Chess(fen0);
  let n = g.moveNumber(), vez = g.turn(), txt = "";
  sans.forEach((s, i) => {
    if (vez === "w") txt += `${n}. `; else if (i === 0) txt += `${n}... `;
    txt += s + " ";
    if (vez === "b") n++;
    vez = vez === "w" ? "b" : "w";
  });
  // quebra em linhas de até 80 caracteres
  const linhas = [];
  let l = "";
  for (const p of (txt + t.Result).split(" ")) { if ((l + " " + p).trim().length > 80) { linhas.push(l.trim()); l = p; } else l += " " + p; }
  if (l.trim()) linhas.push(l.trim());
  return `${cab}\n\n${linhas.join("\n")}\n`;
}

/** Um nome curto para a lista das partidas salvas: "Brancas × Pretas", o evento ou a abertura. */
export function nomeDaPartida(tags = {}, alternativa = "Partida") {
  const b = tags.White && tags.White !== "?" ? tags.White : "", p = tags.Black && tags.Black !== "?" ? tags.Black : "";
  if (b || p) return `${b || "?"} × ${p || "?"}`;
  return tags.Event && tags.Event !== "?" ? tags.Event : alternativa;
}
export { INICIAL };
