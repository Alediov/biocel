// Regras "sem xeque" para as variantes Neblina (fog of war) e Pato (duck chess), que o chessops não tem
// (pedido do Alediov, 26/10/2026: as variantes do Chess.com para jogar com os amigos no tablet). Um gerador de lances
// simples: as peças andam como no xadrez normal, mas não existe xeque, então o rei pode ficar atacado e quem captura o
// rei vence. No Pato, o pato ocupa uma casa: ninguém passa por ele nem o captura.
// Casas de 0 (a1) a 63 (h8); peças como no FEN (maiúscula = brancas).

const ARQ = "abcdefgh";
export const nomeCasa = (i) => ARQ[i % 8] + (Math.floor(i / 8) + 1);
export const indice = (c) => ARQ.indexOf(c[0]) + (+c[1] - 1) * 8;
const corDe = (p) => (p ? (p === p.toUpperCase() ? "w" : "b") : null);
const DIR_CAV = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const DIR_REI = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIR_TORRE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIR_BISPO = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const FEN_INICIAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export class Simples {
  constructor(fen = FEN_INICIAL) {
    const [pos, vez, roque, ep, meio, cheio] = fen.split(" ");
    this.casas = Array(64).fill(null);
    pos.split("/").forEach((linha, r) => { let f = 0; for (const ch of linha) { if (/\d/.test(ch)) f += +ch; else { this.casas[(7 - r) * 8 + f] = ch; f++; } } });
    this.vez = vez || "w"; this.roque = roque && roque !== "-" ? roque : ""; this.ep = ep && ep !== "-" ? indice(ep) : -1;
    this.meio = +meio || 0; this.cheio = +cheio || 1; this.pato = -1;
  }
  clone() { const c = Object.create(Simples.prototype); Object.assign(c, this, { casas: [...this.casas] }); return c; }
  livre(i) { return !this.casas[i] && i !== this.pato; }
  /** Os lances de uma casa (sem xeque: o rei pode ficar atacado). */
  lances(de) {
    const p = this.casas[de], cor = corDe(p);
    if (!p || cor !== this.vez) return [];
    const out = [], f0 = de % 8, r0 = Math.floor(de / 8), t = p.toLowerCase();
    const em = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);
    const alvo = (i) => i >= 0 && i !== this.pato && corDe(this.casas[i]) !== cor;
    const add = (para, extra = {}) => out.push({ de, para, ...extra });
    if (t === "n" || t === "k") {
      for (const [df, dr] of t === "n" ? DIR_CAV : DIR_REI) { const i = em(f0 + df, r0 + dr); if (alvo(i)) add(i); }
      if (t === "k") {
        const base = cor === "w" ? 0 : 56, [K, Q] = cor === "w" ? ["K", "Q"] : ["k", "q"], torre = cor === "w" ? "R" : "r";
        if (de === base + 4) {
          if (this.roque.includes(K) && this.casas[base + 7] === torre && this.livre(base + 5) && this.livre(base + 6)) add(base + 6, { roque: "K" });
          if (this.roque.includes(Q) && this.casas[base] === torre && this.livre(base + 1) && this.livre(base + 2) && this.livre(base + 3)) add(base + 2, { roque: "Q" });
        }
      }
    } else if (t === "p") {
      const d = cor === "w" ? 1 : -1, ini = cor === "w" ? 1 : 6, ult = cor === "w" ? 7 : 0;
      const promo = (i) => (Math.floor(i / 8) === ult ? ["q", "r", "b", "n"].forEach(pr => add(i, { promo: pr })) : add(i));
      const um = em(f0, r0 + d);
      if (um >= 0 && this.livre(um)) {
        promo(um);
        const dois = em(f0, r0 + 2 * d);
        if (r0 === ini && dois >= 0 && this.livre(dois)) add(dois, { duplo: true });
      }
      for (const df of [-1, 1]) {
        const i = em(f0 + df, r0 + d); if (i < 0 || i === this.pato) continue;
        if (this.casas[i] && corDe(this.casas[i]) !== cor) promo(i);
        else if (i === this.ep) add(i, { ep: true });
      }
    } else {
      const dirs = t === "r" ? DIR_TORRE : t === "b" ? DIR_BISPO : [...DIR_TORRE, ...DIR_BISPO];
      for (const [df, dr] of dirs) {
        for (let k = 1; k < 8; k++) {
          const i = em(f0 + df * k, r0 + dr * k); if (i < 0 || i === this.pato) break;
          if (!this.casas[i]) { add(i); continue; }
          if (corDe(this.casas[i]) !== cor) add(i);
          break;
        }
      }
    }
    return out;
  }
  todos() { const out = []; for (let i = 0; i < 64; i++) if (corDe(this.casas[i]) === this.vez) out.push(...this.lances(i)); return out; }
  /** Joga um lance (de `lances`). Devolve { capturada, rei } (rei: a cor do rei capturado). */
  jogar(m) {
    const p = this.casas[m.de], cor = corDe(p);
    let capturada = this.casas[m.para];
    if (m.ep) { const c = m.para + (cor === "w" ? -8 : 8); capturada = this.casas[c]; this.casas[c] = null; }
    this.casas[m.para] = m.promo ? (cor === "w" ? m.promo.toUpperCase() : m.promo) : p;
    this.casas[m.de] = null;
    if (m.roque) {
      const base = cor === "w" ? 0 : 56, torre = cor === "w" ? "R" : "r";
      if (m.roque === "K") { this.casas[base + 7] = null; this.casas[base + 5] = torre; } else { this.casas[base] = null; this.casas[base + 3] = torre; }
    }
    // direitos de roque
    const tira = (s) => (this.roque = this.roque.replace(s, ""));
    if (p === "K") { tira("K"); tira("Q"); } if (p === "k") { tira("k"); tira("q"); }
    for (const [casa, s] of [[0, "Q"], [7, "K"], [56, "q"], [63, "k"]]) if (m.de === casa || m.para === casa) tira(s);
    this.ep = m.duplo ? (m.de + m.para) / 2 : -1;
    this.meio = capturada || p.toLowerCase() === "p" ? 0 : this.meio + 1;
    if (cor === "b") this.cheio++;
    this.vez = cor === "w" ? "b" : "w";
    return { capturada, rei: capturada && capturada.toLowerCase() === "k" ? corDe(capturada) : null };
  }
  fen() {
    const linhas = [];
    for (let r = 7; r >= 0; r--) { let s = "", v = 0; for (let f = 0; f < 8; f++) { const p = this.casas[r * 8 + f]; if (!p) v++; else { if (v) s += v; v = 0; s += p; } } if (v) s += v; linhas.push(s); }
    return `${linhas.join("/")} ${this.vez} ${this.roque || "-"} ${this.ep >= 0 ? nomeCasa(this.ep) : "-"} ${this.meio} ${this.cheio}`;
  }
  /** Neblina: as casas que `cor` enxerga (as suas peças e as casas para onde elas podem ir). */
  visiveis(cor) {
    const vis = new Set(), salvo = this.vez;
    this.vez = cor;
    for (let i = 0; i < 64; i++) if (corDe(this.casas[i]) === cor) { vis.add(i); for (const m of this.lances(i)) vis.add(m.para); }
    this.vez = salvo;
    return vis;
  }
}
