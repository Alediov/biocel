// Variantes do xadrez para jogar com os amigos no tablet (pedido do Alediov, 26/10/2026: "aqueles minijogos do
// Chess.com"). As regras vêm do chessops (Niklas Fiekas, GPL-3.0, app/vendor/chessops/), o mesmo do lichess, para o
// clássico, 960, Rei do Morro, Três Xeques, Atômico, Crazyhouse, Horda, Perde-Ganha e Corrida de Reis; Neblina e Pato,
// que não têm xeque, usam o gerador próprio de simples.js. `Partida` dá a mesma interface para todas.
import { defaultPosition, setupPosition } from "../../vendor/chessops/variant.js";
import { parseFen, makeFen } from "../../vendor/chessops/fen.js";
import { parseSquare, makeSquare } from "../../vendor/chessops/util.js";
import { makeSan } from "../../vendor/chessops/san.js";
import { Simples, nomeCasa, indice, FEN_INICIAL } from "./simples.js";

export const VARIANTES = [
  { id: "classico", nome: "Clássico", icone: "♟️", regra: "O xadrez de sempre." },
  { id: "960", nome: "Xadrez 960", icone: "🎲", regra: "As peças da última fileira começam sorteadas (iguais para os dois lados): nada de abertura decorada. O roque leva o rei para a coluna g ou c, como no normal." },
  { id: "reiDoMorro", nome: "Rei do Morro", icone: "⛰️", regra: "Além do mate, vence quem levar o rei a uma das 4 casas do centro (d4, e4, d5 ou e5)." },
  { id: "tresXeques", nome: "Três Xeques", icone: "3️⃣", regra: "Vence quem der 3 xeques (ou mate). Cuidado com o rei exposto!" },
  { id: "atomico", nome: "Atômico", icone: "💥", regra: "Toda captura explode: somem a peça que capturou e todas em volta, menos os peões. Vence quem explodir o rei do outro." },
  { id: "crazyhouse", nome: "Crazyhouse", icone: "🏠", regra: "A peça que você captura vai para a sua mão e, no lugar de um lance, pode ser posta em qualquer casa vazia." },
  { id: "horda", nome: "Horda", icone: "🐜", regra: "As brancas têm 36 peões e nenhum rei. As pretas vencem capturando todos; as brancas, dando mate." },
  { id: "perdeGanha", nome: "Perde-Ganha", icone: "🎁", regra: "Capturar é obrigatório, o rei é uma peça comum e vence quem ficar sem peças (ou sem lances)." },
  { id: "corrida", nome: "Corrida de Reis", icone: "🏁", regra: "Ninguém pode dar xeque. Vence quem levar o rei à 8ª fileira primeiro (se as pretas chegarem logo depois, empata)." },
  { id: "neblina", nome: "Neblina", icone: "🌫️", regra: "Você só vê as suas peças e as casas aonde elas podem ir. Não há xeque: vence quem capturar o rei. Passe o tablet entre os lances." },
  { id: "pato", nome: "Pato", icone: "🦆", regra: "Depois de cada lance, ponha o pato numa casa vazia: ele bloqueia as duas cores. Não há xeque: vence quem capturar o rei (sem lances, você vence)." },
];
const REGRAS = { classico: "chess", 960: "chess", reiDoMorro: "kingofthehill", tresXeques: "3check", atomico: "atomic", crazyhouse: "crazyhouse", horda: "horde", perdeGanha: "antichess", corrida: "racingkings" };
const PAPEL = { q: "queen", r: "rook", b: "bishop", n: "knight", k: "king", p: "pawn" }, LETRA = Object.fromEntries(Object.entries(PAPEL).map(([k, v]) => [v, k]));
const cor = (c) => (c === "white" ? "w" : "b");

/** Uma posição inicial do Xadrez 960 (bispos em cores diferentes, rei entre as torres). */
export function fen960(n = Math.floor(Math.random() * 960)) {
  const f = Array(8).fill(null), livres = () => f.map((x, i) => (x ? -1 : i)).filter(i => i >= 0);
  f[(n % 4) * 2 + 1] = "b"; n = Math.floor(n / 4);
  f[(n % 4) * 2] = "b"; n = Math.floor(n / 4);
  f[livres()[n % 6]] = "q"; n = Math.floor(n / 6);
  const KN = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]][n];
  const l = livres(); f[l[KN[0]]] = "n"; f[l[KN[1]]] = "n";
  const r = livres(); f[r[0]] = "r"; f[r[1]] = "k"; f[r[2]] = "r";
  const fila = f.join(""), arq = "abcdefgh", ts = [r[0], r[2]].map(i => arq[i]);
  return `${fila}/pppppppp/8/8/8/8/PPPPPPPP/${fila.toUpperCase()} w ${ts[1].toUpperCase()}${ts[0].toUpperCase()}${ts[1]}${ts[0]} - 0 1`;
}

export class Partida {
  constructor(variante = "classico", { fen = null } = {}) {
    this.variante = variante;
    this.simples = variante === "neblina" || variante === "pato";
    this.hist = []; this.sans = []; this.chaves = []; this.ultimos = [];
    if (this.simples) { this.s = new Simples(fen || FEN_INICIAL); this.fase = "lance"; }
    else {
      const regras = REGRAS[variante] || "chess";
      const inicial = fen || (variante === "960" ? fen960() : null);
      this.pos = inicial ? setupPosition(regras, parseFen(inicial).unwrap()).unwrap() : defaultPosition(regras);
      this.chaves.push(this.chave());
    }
    this.inicial = this.fen();
  }
  get vez() { return this.simples ? (this.fase === "pato" ? this.patoDe : this.s.vez) : cor(this.pos.turn); }
  fen() { return this.simples ? this.s.fen() : makeFen(this.pos.toSetup()); }
  chave() { return this.fen().split(" ").slice(0, 4).join(" "); }
  /** O FEN para o tabuleiro; na Neblina, só o que `visao` enxerga. */
  fenTela(visao = null) {
    if (!this.simples) return this.fen().replace(/\[[^\]]*\]/, "");
    if (this.variante !== "neblina" || !visao) return this.s.fen();
    const vis = this.s.visiveis(visao), c = this.s.clone();
    for (let i = 0; i < 64; i++) if (c.casas[i] && !vis.has(i)) c.casas[i] = null;
    return c.fen();
  }
  /** Casas que `visao` não enxerga (Neblina). */
  neblina(visao) {
    if (this.variante !== "neblina") return [];
    const vis = this.s.visiveis(visao), out = [];
    for (let i = 0; i < 64; i++) if (!vis.has(i)) out.push(nomeCasa(i));
    return out;
  }
  /** Lances de uma casa, no formato do tabuleiro: [{ to, promotion }]. */
  legais(casa) {
    if (this.fim()) return [];
    if (this.simples) {
      if (this.fase !== "lance") return [];
      const ls = this.s.lances(indice(casa)), vistos = new Set(), out = [];
      for (const m of ls) { const k = nomeCasa(m.para); if (vistos.has(k)) continue; vistos.add(k); out.push({ to: k, promotion: m.promo ? "q" : undefined }); }
      return out;
    }
    return [...this.mapaDestinos(casa).keys()].map(to => ({ to, promotion: this.ehPromocao(casa, to) ? "q" : undefined }));
  }
  ehPromocao(de, para) {
    const p = this.pos.board.get(parseSquare(de));
    return p?.role === "pawn" && (para[1] === "8" || para[1] === "1");
  }
  /** casa mostrada → casa real (o roque, no chessops, é o rei "capturando" a própria torre). */
  mapaDestinos(casa) {
    const sq = parseSquare(casa), m = new Map(), p = this.pos.board.get(sq);
    if (!p) return m;
    for (const d of this.pos.dests(sq)) {
      const alvo = this.pos.board.get(d);
      if (p.role === "king" && alvo && alvo.color === p.color && alvo.role === "rook") {
        const lado = d > sq ? 6 : 2, destino = (sq & ~7) | lado;
        if (destino !== sq && !m.has(makeSquare(destino))) m.set(makeSquare(destino), d);
        if (this.variante === "960") m.set(makeSquare(d), d); // no 960 também vale tocar a torre
      } else m.set(makeSquare(d), d);
    }
    return m;
  }
  /** Joga. Devolve { san, capturou, explodiu: [casas] } ou null se não for lance legal. */
  mover(de, para, promo) {
    if (this.fim()) return null;
    if (this.simples) {
      if (this.fase !== "lance") return null;
      const m = this.s.lances(indice(de)).find(x => nomeCasa(x.para) === para && (!x.promo || x.promo === (promo || "q")));
      if (!m) return null;
      this.hist.push({ s: this.s.clone(), fase: this.fase, patoDe: this.patoDe });
      const p = this.s.casas[m.de], cap = this.s.casas[m.para] || m.ep;
      const r = this.s.jogar(m);
      let san = m.roque ? (m.roque === "K" ? "O-O" : "O-O-O") : (p.toLowerCase() === "p" ? (cap ? de[0] : "") : p.toUpperCase()) + (cap ? "x" : "") + para + (m.promo ? "=" + m.promo.toUpperCase() : "");
      if (r.rei) san += "#";
      this.sans.push(san); this.ultimos.push([de, para]);
      this.reiCapturado = r.rei;
      if (this.variante === "pato" && !r.rei) { this.fase = "pato"; this.patoDe = r.rei ? null : (p === p.toUpperCase() ? "w" : "b"); }
      return { san, capturou: !!cap, explodiu: [] };
    }
    const real = this.mapaDestinos(de).get(para);
    if (real === undefined) return null;
    const mv = { from: parseSquare(de), to: real };
    if (this.ehPromocao(de, para)) mv.promotion = PAPEL[promo || "q"];
    if (!this.pos.isLegal(mv)) return null;
    const antes = this.pos.clone(), san = makeSan(this.pos, mv);
    const capturou = !!this.pos.board.get(real) && this.pos.board.get(real).color !== this.pos.turn || (this.pos.board.get(mv.from)?.role === "pawn" && real === this.pos.epSquare);
    this.hist.push({ pos: antes });
    this.pos.play(mv);
    this.sans.push(san); this.chaves.push(this.chave()); this.ultimos.push([de, para]);
    let explodiu = [];
    if (this.variante === "atomico" && capturou) for (const sq of antes.board.occupied) if (!this.pos.board.get(sq) && sq !== mv.from) explodiu.push(makeSquare(sq));
    return { san, capturou, explodiu };
  }
  /** Pato: põe o pato numa casa vazia (diferente da de antes). */
  porPato(casa) {
    if (this.variante !== "pato" || this.fase !== "pato") return false;
    const i = indice(casa);
    if (this.s.casas[i] || i === this.s.pato) return false;
    this.s.pato = i; this.fase = "lance"; this.sans[this.sans.length - 1] += ` 🦆${casa}`;
    return true;
  }
  get pato() { return this.simples && this.s.pato >= 0 ? nomeCasa(this.s.pato) : null; }
  /** Crazyhouse: o que cada lado tem na mão. */
  bolso(c) {
    if (this.variante !== "crazyhouse" || !this.pos.pockets) return {};
    const m = this.pos.pockets[c === "w" ? "white" : "black"], out = {};
    for (const r of ["queen", "rook", "bishop", "knight", "pawn"]) if (m[r]) out[LETRA[r]] = m[r];
    return out;
  }
  destinosSoltar(letra) {
    if (this.variante !== "crazyhouse" || this.fim()) return [];
    const role = PAPEL[letra];
    return [...this.pos.dropDests()].filter(sq => this.pos.isLegal({ role, to: sq })).map(makeSquare);
  }
  soltar(letra, casa) {
    const mv = { role: PAPEL[letra], to: parseSquare(casa) };
    if (!this.pos.isLegal(mv)) return null;
    const san = makeSan(this.pos, mv);
    this.hist.push({ pos: this.pos.clone() });
    this.pos.play(mv); this.sans.push(san); this.chaves.push(this.chave()); this.ultimos.push([casa, casa]);
    return { san, capturou: false, explodiu: [] };
  }
  /** A casa do rei em xeque (para marcar), ou null. */
  xeque() {
    if (this.simples || !this.pos.isCheck()) return null;
    const k = this.pos.board.kingOf(this.pos.turn);
    return k === undefined ? null : makeSquare(k);
  }
  /** Três Xeques: quantos xeques cada lado ainda precisa dar. */
  xequesQueFaltam() {
    const r = this.pos?.remainingChecks;
    return r ? { w: r.white, b: r.black } : null;
  }
  /** [de, para] do último lance (para marcar no tabuleiro). */
  ultimo() { return this.ultimos[this.ultimos.length - 1] || null; }
  /** Fim de jogo: { vencedor: "w" | "b" | null, motivo } ou null. */
  fim() {
    if (this.simples) {
      if (this.reiCapturado) { const v = this.reiCapturado === "w" ? "b" : "w"; return { vencedor: v, motivo: "Rei capturado" }; }
      if (this.fase === "lance" && !this.s.todos().length) return this.variante === "pato" ? { vencedor: this.s.vez, motivo: "Sem lances: no Pato, quem fica sem lances vence" } : { vencedor: null, motivo: "Sem lances" };
      if (this.s.meio >= 100) return { vencedor: null, motivo: "50 lances sem captura nem peão" };
      return null;
    }
    const p = this.pos, o = p.outcome();
    if (o) {
      const vencedor = o.winner ? cor(o.winner) : null;
      let motivo = "Fim de jogo";
      if (p.isVariantEnd()) motivo = { reiDoMorro: "O rei chegou ao centro", tresXeques: "Três xeques", atomico: "O rei explodiu", horda: "A horda foi capturada", perdeGanha: "Ficou sem peças", corrida: vencedor ? "O rei chegou à 8ª fileira" : "Os dois reis chegaram" }[this.variante] || motivo;
      else if (p.isCheckmate()) motivo = "Xeque-mate";
      else if (p.isStalemate()) motivo = this.variante === "perdeGanha" ? "Sem lances" : "Afogamento";
      else if (p.isInsufficientMaterial()) motivo = "Material insuficiente";
      return { vencedor, motivo };
    }
    const k = this.chave();
    if (this.chaves.filter(x => x === k).length >= 3) return { vencedor: null, motivo: "Repetição" };
    if (p.halfmoves >= 100) return { vencedor: null, motivo: "50 lances sem captura nem peão" };
    return null;
  }
  desfazer() {
    const h = this.hist.pop(); if (!h) return false;
    if (this.simples) { this.s = h.s; this.fase = h.fase; this.patoDe = h.patoDe; this.reiCapturado = null; }
    else { this.pos = h.pos; this.chaves.pop(); }
    this.sans.pop(); this.ultimos.pop();
    return true;
  }
}
