// Xadrez para 4 jogadores (pedido do Alediov, 26/10/2026: "adicione também o xadrez para 4 jogadores e, se possível,
// algumas variações já criadas aplicadas a esse modo"), no tabuleiro do Chess.com: 14 × 14 sem os cantos de 3 × 3.
// Vermelho embaixo, Azul à esquerda, Amarelo em cima e Verde à direita, jogando nessa ordem (sentido horário).
// Modos: Todos contra todos (pontos do Chess.com), Duplas (Vermelho e Amarelo contra Azul e Verde), Rei do Morro,
// Três Xeques e Pato. Cada lugar pode ser uma pessoa ou o computador (um jogador simples, de um lance só), e o
// tabuleiro pode ficar fixo, girar para quem joga ou ficar como numa mesa (as peças de cada um viradas para ele).
// Regras próprias (o chess.js e o chessops são só de 2 jogadores): sem en passant; o peão promove a dama.
import { E, salvar } from "../estado.js";
import { toast, escapar, confete } from "../ui.js";
import { tocar, vibrar } from "../sons.js";
import { icone } from "../icones.js";
import { PATO, visualAtual } from "./tabuleiro.js";

const N = 14;
export const JOGADORES4 = [
  { nome: "Vermelho", cor: "#D8473D" },
  { nome: "Azul", cor: "#3C7DD9" },
  { nome: "Amarelo", cor: "#E9B623" },
  { nome: "Verde", cor: "#3AA35B" },
];
const MORTO = "#A6A6A6";
export const MODOS4 = [
  { id: "todos", nome: "Todos contra todos", icone: "⚔️", regra: "Cada um por si, valendo pontos como no Chess.com: capturar vale o que a peça vale (peão 1, cavalo 3, bispo 5, torre 5, dama 9; dama promovida, 1), dar mate vale 20 e quem fica afogado ganha 20 e sai. Quem sai deixa as peças cinzas no tabuleiro (valem 0). Quando só sobra um, vence quem tiver mais pontos. O peão promove a dama no meio do tabuleiro (8ª fileira)." },
  { id: "duplas", nome: "Duplas", icone: "🤝", regra: "Vermelho e Amarelo contra Azul e Verde: os parceiros ficam de frente e não se capturam. A dupla que der o primeiro mate vence. O peão promove na 11ª fileira." },
  { id: "morro", nome: "Rei do Morro", icone: "⛰️", regra: "Todos contra todos, com os pontos de sempre, mas quem levar o rei a uma das 4 casas do centro vence na hora." },
  { id: "tresXeques", nome: "Três Xeques", icone: "3️⃣", regra: "Todos contra todos: quem levar o 3º xeque sai (e quem deu ganha 20 pontos). O mate e os pontos das capturas valem como sempre." },
  { id: "pato", nome: "Pato", icone: "🦆", regra: "Depois de cada lance, ponha o pato numa casa vazia: ele bloqueia todo mundo. Não há xeque: capturar o rei tira o jogador (20 pontos). Quando só sobra um, vence quem tiver mais pontos." },
];
export const GIROS4 = [["mesa", "Mesa"], ["girar", "Girar para quem joga"], ["fixo", "Fixo"]];
const VAL = { p: 1, n: 3, b: 5, r: 5, q: 9, k: 0 };
const FRENTE = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const ANG_GIRAR = [0, -90, 180, 90]; // gira o tabuleiro para o lado de cada um ficar embaixo
const ANG_MESA = [0, 90, 180, -90]; // as peças de cada um viradas para ele
export const dentro = (f, r) => f >= 0 && f < N && r >= 0 && r < N && !((f < 3 || f > 10) && (r < 3 || r > 10));
const idx = (f, r) => r * N + f;
const fr = (i) => [i % N, Math.floor(i / N)];
/** Casa (f, r) da posição local (x da esquerda para a direita de quem joga, y a partir da sua 1ª fileira). */
const global = (c, x, y) => [[3 + x, y], [y, 10 - x], [10 - x, 13 - y], [13 - y, 3 + x]][c];
const progresso = (c, f, r) => [r, f, 13 - r, 13 - f][c];
const FILA = ["r", "n", "b", "q", "k", "b", "n", "r"];
const CENTRO = new Set([idx(6, 6), idx(7, 6), idx(6, 7), idx(7, 7)]);
const COLS = "abcdefghijklmn";
export const nomeCasa4 = (i) => { const [f, r] = fr(i); return COLS[f] + (r + 1); };
const LETRA = { p: "", n: "C", b: "B", r: "T", q: "D", k: "R" };

export class Quatro {
  constructor(modo = "todos") {
    this.modo = modo; this.semXeque = modo === "pato";
    this.casas = Array(N * N).fill(null);
    for (let c = 0; c < 4; c++) for (let x = 0; x < 8; x++) {
      this.casas[idx(...global(c, x, 0))] = { c, t: FILA[x] };
      this.casas[idx(...global(c, x, 1))] = { c, t: "p" };
    }
    this.vez = 0; this.ativos = [true, true, true, true]; this.pontos = [0, 0, 0, 0]; this.xeques = [0, 0, 0, 0];
    this.roque = [0, 1, 2, 3].map(() => ({ curto: true, longo: true }));
    this.pato = -1; this.fase = "lance"; this.ultimo = null; this.fim = null; this.lances = 0; this.motivos = [null, null, null, null];
    this.ultimoJogador = null; this.sans = [];
  }
  estado() { const { casas, vez, ativos, pontos, xeques, roque, pato, fase, ultimo, fim, lances, motivos, ultimoJogador, sans } = this; return JSON.stringify({ casas, vez, ativos, pontos, xeques, roque, pato, fase, ultimo, fim, lances, motivos, ultimoJogador, sans }); }
  restaurar(s) { Object.assign(this, JSON.parse(s)); }
  parceiro(a, b) { return this.modo === "duplas" && a !== b && a % 2 === b % 2; }
  inimigo(a, b) { return a !== b && !this.parceiro(a, b); }
  promoLinha() { return this.modo === "duplas" ? 10 : 7; }
  rei(c) { return this.casas.findIndex(p => p && p.c === c && p.t === "k" && !p.morto); }
  livre(i) { return !this.casas[i] && i !== this.pato; }
  /** A peça em j ataca a casa i? (peças cinzas não atacam) */
  ataca(j, i) {
    const p = this.casas[j]; if (!p || p.morto) return false;
    const [f0, r0] = fr(j), [f1, r1] = fr(i), df = f1 - f0, dr = r1 - r0;
    if (!df && !dr) return false;
    if (p.t === "p") { const [a, b] = FRENTE[p.c]; return a ? df === a && Math.abs(dr) === 1 : dr === b && Math.abs(df) === 1; }
    if (p.t === "n") return (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
    if (p.t === "k") return Math.abs(df) <= 1 && Math.abs(dr) <= 1;
    const reto = !df || !dr, diag = Math.abs(df) === Math.abs(dr);
    if ((p.t === "r" && !reto) || (p.t === "b" && !diag) || (p.t === "q" && !reto && !diag)) return false;
    const sf = Math.sign(df), sr = Math.sign(dr);
    for (let f = f0 + sf, r = r0 + sr; f !== f1 || r !== r1; f += sf, r += sr) { const k = idx(f, r); if (!dentro(f, r) || this.casas[k] || k === this.pato) return false; }
    return true;
  }
  atacantes(i, filtro) { const out = []; for (let j = 0; j < N * N; j++) { const p = this.casas[j]; if (p && !p.morto && filtro(p.c) && this.ataca(j, i)) out.push(p.c); } return out; }
  quemDaXeque(c) { const k = this.rei(c); return k < 0 ? [] : [...new Set(this.atacantes(k, (o) => this.ativos[o] && this.inimigo(o, c)))]; }
  emXeque(c) { return !this.semXeque && this.quemDaXeque(c).length > 0; }
  pseudo(i) {
    const p = this.casas[i]; if (!p || p.morto) return [];
    const c = p.c, [f0, r0] = fr(i), out = [];
    const pode = (k) => { const q = this.casas[k]; return k !== this.pato && (!q || (q.c !== c && !(this.parceiro(q.c, c) && !q.morto))); };
    const add = (k, extra = {}) => out.push({ de: i, para: k, ...extra });
    if (p.t === "p") {
      const [a, b] = FRENTE[c], f1 = f0 + a, r1 = r0 + b;
      if (dentro(f1, r1) && this.livre(idx(f1, r1))) {
        add(idx(f1, r1));
        const f2 = f1 + a, r2 = r1 + b;
        if (progresso(c, f0, r0) === 1 && dentro(f2, r2) && this.livre(idx(f2, r2))) add(idx(f2, r2));
      }
      for (const s of [-1, 1]) {
        const fc = f0 + a + (a ? 0 : s), rc = r0 + b + (b ? 0 : s);
        if (!dentro(fc, rc)) continue;
        const k = idx(fc, rc);
        if (this.casas[k] && pode(k)) add(k);
      }
    } else if (p.t === "n" || p.t === "k") {
      const ds = p.t === "n" ? [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] : [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      for (const [df, dr] of ds) { const f = f0 + df, r = r0 + dr; if (dentro(f, r) && pode(idx(f, r))) add(idx(f, r)); }
      if (p.t === "k") this.roques(c, i, add);
    } else {
      const reto = [[1, 0], [-1, 0], [0, 1], [0, -1]], diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [df, dr] of p.t === "r" ? reto : p.t === "b" ? diag : [...reto, ...diag]) {
        for (let k = 1; k < N; k++) {
          const f = f0 + df * k, r = r0 + dr * k; if (!dentro(f, r)) break;
          const j = idx(f, r); if (j === this.pato) break;
          if (!this.casas[j]) { add(j); continue; }
          if (pode(j)) add(j);
          break;
        }
      }
    }
    return out;
  }
  roques(c, i, add) {
    const g = (x) => idx(...global(c, x, 0));
    if (i !== g(4)) return;
    const R = this.roque[c];
    if (!R.curto && !R.longo) return;
    const atacada = (k) => !this.semXeque && this.atacantes(k, (o) => this.ativos[o] && this.inimigo(o, c)).length > 0;
    if (atacada(i)) return;
    const torre = (x) => { const q = this.casas[g(x)]; return q && q.c === c && q.t === "r" && !q.morto; };
    if (R.curto && torre(7) && this.livre(g(5)) && this.livre(g(6)) && !atacada(g(5)) && !atacada(g(6))) add(g(6), { roque: "curto" });
    if (R.longo && torre(0) && [1, 2, 3].every(x => this.livre(g(x))) && !atacada(g(3)) && !atacada(g(2))) add(g(2), { roque: "longo" });
  }
  /** Os lances legais da peça na casa i (de quem tem a vez). */
  legaisDe(i) {
    const p = this.casas[i];
    if (!p || p.morto || p.c !== this.vez || this.fim || this.fase !== "lance") return [];
    const ms = this.pseudo(i);
    if (this.semXeque) return ms;
    return ms.filter(m => {
      const salvo = this.casas.slice();
      this.casas[m.para] = p; this.casas[m.de] = null;
      if (m.roque) this.moverTorre(p.c, m.roque);
      const ok = this.quemDaXeque(p.c).length === 0;
      this.casas = salvo;
      return ok;
    });
  }
  legais(c = this.vez) {
    const v = this.vez, f = this.fase; this.vez = c; this.fase = "lance";
    const out = [];
    for (let i = 0; i < N * N; i++) { const p = this.casas[i]; if (p && p.c === c && !p.morto) out.push(...this.legaisDe(i)); }
    this.vez = v; this.fase = f;
    return out;
  }
  moverTorre(c, lado) {
    const g = (x) => idx(...global(c, x, 0));
    const [de, para] = lado === "curto" ? [g(7), g(5)] : [g(0), g(3)];
    this.casas[para] = this.casas[de]; this.casas[de] = null;
  }
  eliminar(c, motivo) {
    if (!this.ativos[c]) return;
    this.ativos[c] = false; this.motivos[c] = motivo;
    this.casas = this.casas.map(p => (p && p.c === c ? { ...p, morto: true } : p));
  }
  vivos() { return [0, 1, 2, 3].filter(c => this.ativos[c]); }
  /** Joga um lance (de `legaisDe`). Devolve { capturada, pontos, eliminou: [cores] }. */
  mover(m) {
    const c = this.vez, p = this.casas[m.de], alvo = this.casas[m.para];
    const res = { capturada: alvo, pontos: 0, eliminou: [] };
    const san = `${LETRA[p.t]}${alvo ? "x" : ""}${nomeCasa4(m.para)}`;
    this.casas[m.de] = null;
    if (alvo && !alvo.morto) {
      if (alvo.t === "k") { this.pontos[c] += 20; res.pontos += 20; this.eliminar(alvo.c, `teve o rei capturado por ${JOGADORES4[c].nome}`); res.eliminou.push(alvo.c); }
      else { const v = alvo.prom ? 1 : VAL[alvo.t]; if (this.modo !== "duplas") { this.pontos[c] += v; res.pontos += v; } }
    }
    this.casas[m.para] = p;
    if (m.roque) this.moverTorre(c, m.roque);
    if (p.t === "k") this.roque[c] = { curto: false, longo: false };
    for (let o = 0; o < 4; o++) { const g0 = idx(...global(o, 0, 0)), g7 = idx(...global(o, 7, 0)); if ([m.de, m.para].includes(g0)) this.roque[o].longo = false; if ([m.de, m.para].includes(g7)) this.roque[o].curto = false; }
    if (p.t === "p" && progresso(c, ...fr(m.para)) >= this.promoLinha()) { this.casas[m.para] = { c, t: "q", prom: true }; res.promoveu = true; }
    this.ultimo = [m.de, m.para]; this.lances++; this.ultimoJogador = c;
    this.sans.push({ c, san: m.roque ? (m.roque === "curto" ? "O-O" : "O-O-O") : san + (res.promoveu ? "=D" : "") });
    // regras dos modos
    if (this.modo === "duplas" && res.eliminou.length) { this.fim = { time: c % 2, motivo: `${JOGADORES4[c].nome} capturou o rei de ${JOGADORES4[res.eliminou[0]].nome}` }; return res; }
    if (this.modo === "morro" && p.t === "k" && CENTRO.has(m.para)) { this.fim = { vencedor: c, motivo: `${JOGADORES4[c].nome} levou o rei ao centro` }; return res; }
    if (this.modo === "tresXeques") {
      for (const o of this.vivos()) {
        if (!this.inimigo(c, o)) continue;
        const k = this.rei(o);
        if (k >= 0 && this.atacantes(k, (x) => x === c).length) {
          this.xeques[o]++; res.xeque = true;
          if (this.xeques[o] >= 3) { this.pontos[c] += 20; res.pontos += 20; this.eliminar(o, `levou o 3º xeque de ${JOGADORES4[c].nome}`); res.eliminou.push(o); }
        }
      }
    }
    if (this.semXeque && !this.fimPorSobra()) { this.fase = "pato"; return res; }
    this.passar(res);
    return res;
  }
  /** Pato: põe o pato numa casa vazia (que não seja a dele) e passa a vez. */
  porPato(i) {
    const [f, r] = fr(i);
    if (this.fase !== "pato" || !dentro(f, r) || this.casas[i] || i === this.pato) return false;
    this.pato = i; this.passar();
    return true;
  }
  /** Desistência (ou o "sair" de alguém). */
  desistir(c) {
    if (this.fim || !this.ativos[c]) return;
    if (this.modo === "duplas") { this.eliminar(c, "desistiu"); this.fim = { time: 1 - (c % 2), motivo: `${JOGADORES4[c].nome} desistiu` }; return; }
    this.eliminar(c, "desistiu");
    if (this.vez === c) this.passar(); else this.fimPorSobra();
  }
  encerrar() { if (!this.fim) this.fim = { ranking: true, motivo: "Partida encerrada pelos pontos" }; }
  fimPorSobra() {
    if (this.fim) return true;
    const v = this.vivos();
    if (this.modo !== "duplas" && v.length <= 1) { this.fim = { ranking: true, motivo: v.length ? `Só sobrou ${JOGADORES4[v[0]].nome}` : "Todos saíram" }; return true; }
    return false;
  }
  /** Passa a vez; quem não tiver lances sai (mate ou afogamento). */
  passar(res = { eliminou: [] }) {
    this.fase = "lance";
    for (let volta = 0; volta < 8; volta++) {
      if (this.fimPorSobra()) return;
      let o = this.vez;
      for (let k = 1; k <= 4; k++) { o = (this.vez + k) % 4; if (this.ativos[o]) break; }
      this.vez = o;
      if (this.legais(o).length) return;
      const xq = this.semXeque ? [] : this.quemDaXeque(o);
      if (xq.length) {
        const ganha = xq.includes(this.ultimoJogador) ? this.ultimoJogador : xq[0];
        if (this.modo === "duplas") { this.fim = { time: ganha % 2, motivo: `${JOGADORES4[ganha].nome} deu mate em ${JOGADORES4[o].nome}` }; return; }
        this.pontos[ganha] += 20; this.eliminar(o, `levou mate de ${JOGADORES4[ganha].nome}`);
      } else {
        if (this.modo === "duplas") { this.fim = { empate: true, motivo: `${JOGADORES4[o].nome} ficou afogado` }; return; }
        this.pontos[o] += 20; this.eliminar(o, "ficou afogado (+20)");
      }
      res.eliminou?.push(o);
    }
  }
  /** A ordem final: vencedor (ou dupla) e a classificação pelos pontos. */
  classificacao() {
    const ordem = [0, 1, 2, 3].sort((a, b) => (this.fim?.vencedor === b) - (this.fim?.vencedor === a) || this.pontos[b] - this.pontos[a] || this.ativos[b] - this.ativos[a]);
    return ordem;
  }
  /** Um lance para o computador: guloso, de um lance, com um pouco de acaso (bom para completar a mesa). */
  lanceBot() {
    const c = this.vez, ms = this.legais(c);
    if (!ms.length) return null;
    const VB = { p: 1, n: 3, b: 4, r: 5, q: 9, k: 30 };
    let melhor = null, nota = -Infinity;
    for (const m of ms) {
      const p = this.casas[m.de], alvo = this.casas[m.para];
      let v = Math.random() * 1.6;
      if (alvo && !alvo.morto) v += (alvo.t === "k" ? 300 : alvo.prom ? 1.5 : VB[alvo.t]) * 10;
      else if (alvo) v += 0.8;
      const salvo = this.casas.slice();
      this.casas[m.para] = p; this.casas[m.de] = null;
      if (m.roque) { this.moverTorre(c, m.roque); v += 2.5; }
      const atk = this.atacantes(m.para, (o) => this.ativos[o] && this.inimigo(o, c)).length;
      if (atk) { const def = this.atacantes(m.para, (o) => o === c || this.parceiro(o, c)).length; v -= VB[p.t] * (def ? 5 : 9.5); }
      for (const o of this.vivos()) { if (!this.inimigo(c, o)) continue; const k = this.rei(o); if (k >= 0 && this.ataca(m.para, k)) v += 3; }
      if (this.modo === "morro" && p.t === "k" && CENTRO.has(m.para)) v += 1000;
      if (p.t === "p") { v += 0.5; if (progresso(c, ...fr(m.para)) >= this.promoLinha()) v += 60; }
      const [f, r] = fr(m.para); v -= (Math.abs(f - 6.5) + Math.abs(r - 6.5)) * 0.06;
      this.casas = salvo;
      if (v > nota) { nota = v; melhor = m; }
    }
    return melhor;
  }
  casaParaPatoBot() {
    // perto do rei de quem joga depois (atrapalha), ou uma casa vazia qualquer do meio
    let o = this.vez; for (let k = 1; k <= 4; k++) { o = (this.vez + k) % 4; if (this.ativos[o]) break; }
    const k = this.rei(o), livres = [];
    for (let i = 0; i < N * N; i++) { const [f, r] = fr(i); if (dentro(f, r) && !this.casas[i] && i !== this.pato) livres.push(i); }
    if (k >= 0) { const [kf, kr] = fr(k); const perto = livres.filter(i => { const [f, r] = fr(i); return Math.max(Math.abs(f - kf), Math.abs(r - kr)) === 1; }); if (perto.length && Math.random() < 0.7) return perto[Math.floor(Math.random() * perto.length)]; }
    const meio = livres.filter(i => { const [f, r] = fr(i); return f >= 3 && f <= 10 && r >= 3 && r <= 10; });
    const l = meio.length ? meio : livres;
    return l[Math.floor(Math.random() * l.length)];
  }
}

// ---------------------------------------------------------------- peças nas 4 cores (as cburnett, pintadas)
const SVG = {
  p: '<path fill="COR" stroke="#000" stroke-linecap="round" stroke-width="1.5" d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>',
  n: '<g fill="none" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path fill="COR" d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path fill="COR" d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/><path fill="#000" d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0m5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5"/></g>',
  b: '<g fill="none" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><g fill="COR" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path stroke-linejoin="miter" d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5"/></g>',
  r: '<g fill="COR" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path stroke-linecap="butt" d="M9 39h27v-3H9zm3-3v-4h21v4zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/><path d="m34 14-3 3H14l-3-3"/><path stroke-linecap="butt" stroke-linejoin="miter" d="M31 17v12.5H14V17"/><path d="m31 29.5 1.5 2.5h-20l1.5-2.5"/><path fill="none" stroke-linejoin="miter" d="M11 14h23"/></g>',
  q: '<g fill="COR" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0m16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0M16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0"/><path stroke-linecap="butt" d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14z"/><path stroke-linecap="butt" d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><path fill="none" d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0"/></g>',
  k: '<g fill="none" fill-rule="evenodd" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path stroke-linejoin="miter" d="M22.5 11.63V6M20 8h5"/><path fill="COR" stroke-linecap="butt" stroke-linejoin="miter" d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path fill="COR" d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g>',
};
let estiloPronto = false;
function prepararPecas() {
  if (estiloPronto) return; estiloPronto = true;
  const css = [];
  [...JOGADORES4.map(j => j.cor), MORTO].forEach((cor, c) => {
    for (const [t, corpo] of Object.entries(SVG)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${corpo.replaceAll("COR", cor)}</svg>`;
      css.push(`.q4-p.c${c === 4 ? "m" : c}.${t}{background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`);
    }
  });
  const st = document.createElement("style"); st.id = "q4-pecas"; st.textContent = css.join("\n"); document.head.append(st);
}
/** Uma peça desenhada fora do tabuleiro (prévia, capturas). */
export const peca4 = (c, t) => { prepararPecas(); return `<i class="q4-p c${c} ${t}"></i>`; };

// ---------------------------------------------------------------- configuração e partida
export function cfgQuatro() {
  const x = E().xadrez;
  x.quatro ||= {};
  const q = x.quatro;
  for (const [k, v] of Object.entries({ modo: "todos", giro: "mesa", nomes: ["Você", "Jogador 2", "Jogador 3", "Jogador 4"], bots: [false, false, false, false], partidas: [] })) if (!(k in q)) q[k] = v;
  return q;
}

/** A tela de configurar (dentro da aba Jogar). `ctx`: { camada, I, aoSair } */
export function telaQuatro(t, ctx) {
  prepararPecas();
  const q = cfgQuatro(), m = MODOS4.find(y => y.id === q.modo) || MODOS4[0];
  const ultimas = q.partidas.slice(-6).reverse();
  t.innerHTML = `<div class="xz-cartao q4-cfg">
      <h2>Quatro jogadores</h2>
      <p class="xz-dica-g">O tabuleiro em cruz do Chess.com, com 4 exércitos. Ponha o tablet no meio da mesa; cada lugar pode ser uma pessoa ou o computador.</p>
      <label class="xz-rotulo">Modo</label>
      <div class="xz-variantes">${MODOS4.map(y => `<button data-m="${y.id}" class="${y.id === m.id ? "on" : ""}">${icone(y.icone, "ico3d")}<b>${escapar(y.nome)}</b></button>`).join("")}</div>
      <p class="xz-regra"><b>${escapar(m.nome)}:</b> ${escapar(m.regra)}</p>
      <label class="xz-rotulo">Jogadores</label>
      <div class="q4-lugares">${JOGADORES4.map((j, c) => `<div class="q4-lugar ${m.id === "duplas" ? `dupla${c % 2}` : ""}"><span class="q4-amostra">${peca4(c, "k")}</span><label><small>${j.nome}${m.id === "duplas" ? ` · dupla ${c % 2 ? "Azul & Verde" : "Vermelho & Amarelo"}` : ""}</small><input data-n="${c}" maxlength="14" value="${escapar(q.nomes[c])}" ${q.bots[c] ? "disabled" : ""}></label><button class="q4-bot ${q.bots[c] ? "on" : ""}" data-b="${c}">${q.bots[c] ? "🤖 Computador" : "🙂 Pessoa"}</button></div>`).join("")}</div>
      <label class="xz-rotulo">O tablet</label>
      <div class="xz-seg" data-k="giro">${GIROS4.map(([k, n]) => `<button data-v="${k}" class="${q.giro === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <p class="xz-dica-g">${{ mesa: "O tablet deitado no meio da mesa: as peças de cada um ficam viradas para quem as joga.", girar: "O tabuleiro gira a cada lance para que quem joga fique embaixo (bom para passar o tablet).", fixo: "O tabuleiro parado, com o Vermelho embaixo." }[q.giro]}</p>
      <button class="botao xz-jogar">Começar</button></div>
    ${ultimas.length ? `<h3 class="xz-sec">Últimas partidas de 4</h3><div class="xz-partidas">${ultimas.map(p => `<div><span class="xz-r v">${escapar(p.vencedor || "Empate")}</span><span>${escapar(MODOS4.find(y => y.id === p.modo)?.nome || p.modo)} · ${escapar(p.motivo || "")}</span><small>${new Date(p.data).toLocaleDateString("pt-BR")}</small></div>`).join("")}</div>` : ""}`;
  t.querySelectorAll("[data-m]").forEach(b => (b.onclick = () => { q.modo = b.dataset.m; salvar(); telaQuatro(t, ctx); }));
  t.querySelectorAll("[data-n]").forEach(i => (i.oninput = () => { q.nomes[+i.dataset.n] = i.value.trim() || `Jogador ${+i.dataset.n + 1}`; salvar(); }));
  t.querySelectorAll("[data-b]").forEach(b => (b.onclick = () => { const c = +b.dataset.b; q.bots[c] = !q.bots[c]; if (q.bots.every(Boolean)) { q.bots[c] = false; toast("Pelo menos um lugar fica com uma pessoa."); } salvar(); telaQuatro(t, ctx); }));
  t.querySelectorAll('[data-k="giro"] button').forEach(b => (b.onclick = () => { q.giro = b.dataset.v; salvar(); telaQuatro(t, ctx); }));
  t.querySelector(".xz-jogar").onclick = () => jogarQuatro(ctx);
}

export function jogarQuatro(ctx) {
  prepararPecas();
  const q = cfgQuatro(), modo = q.modo, m = MODOS4.find(y => y.id === modo) || MODOS4[0];
  const nomes = q.nomes.map((n, c) => (q.bots[c] ? `🤖 ${JOGADORES4[c].nome}` : n));
  const bot = [...q.bots];
  let jogo = new Quatro(modo), giro = q.giro, sel = null, alvos = [], pilha = [], pensando = false;
  const v = visualAtual(), tb = String(v.tabuleiro || "marrom").startsWith("tx-") ? "marrom" : v.tabuleiro || "marrom";
  const ov = ctx.camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Sair">${ctx.I.fechar}</button><span class="xz-p-tit">${escapar(m.icone + " " + m.nome)} · 4 jogadores</span><button class="xz-s-info" aria-label="Regras">?</button></div>
    <div class="q4-jogs"></div>
    <div class="xz-s-tab"><div class="xz-tab xz-q4 tb-cor-${tb}"><div class="q4-grade"></div></div></div>
    <div class="q4-vez"></div><div class="xz-lances q4-lances"></div><div class="xz-s-nota"></div>
    <div class="xz-p-bts"><button data-a="voltar">${ctx.I.desfazer}<span>Voltar</span></button><button data-a="giro">${ctx.I.virar}<span>Tabuleiro</span></button><button data-a="desistir"><b>🏳️</b><span>Desistir</span></button><button data-a="encerrar"><b>🏁</b><span>Encerrar</span></button></div>`, `partida quatro amigo`);
  const grade = ov.querySelector(".q4-grade"), nota = ov.querySelector(".xz-s-nota"), quadro = ov.querySelector(".xz-q4");
  const celulas = [];
  for (let r = N - 1; r >= 0; r--) for (let f = 0; f < N; f++) {
    const c = document.createElement("i"), i = idx(f, r);
    c.className = "q4-c"; c.dataset.i = i;
    if (!dentro(f, r)) c.classList.add("fora");
    grade.append(c); celulas[i] = c;
  }
  const angTab = () => (giro === "girar" ? ANG_GIRAR[ultimoHumano()] : 0);
  let humanoVisto = 0;
  const ultimoHumano = () => { if (!bot[jogo.vez]) humanoVisto = jogo.vez; return humanoVisto; };
  function mostrar() {
    const a = angTab();
    grade.style.rotate = `${a}deg`;
    const xq = new Set();
    if (!jogo.semXeque) for (const c of jogo.vivos()) if (jogo.emXeque(c)) xq.add(jogo.rei(c));
    const alvoSet = new Map(alvos.map(mv => [mv.para, mv]));
    for (let i = 0; i < N * N; i++) {
      const cel = celulas[i]; if (!cel || cel.classList.contains("fora")) continue;
      const [f, r] = fr(i), p = jogo.casas[i];
      let cls = `q4-c ${(f + r) % 2 ? "cla" : "esc"}`;
      if (jogo.ultimo?.includes(i)) cls += " ult";
      if (sel === i) cls += " sel";
      if (alvoSet.has(i)) cls += p ? " alvo captura" : " alvo";
      if (xq.has(i)) cls += " xeque";
      if (modo === "morro" && CENTRO.has(i)) cls += " morro";
      if (jogo.fase === "pato" && !p && i !== jogo.pato) cls += " pato-alvo";
      cel.className = cls;
      if (i === jogo.pato) cel.innerHTML = `<span class="q4-pato" style="rotate:${-a}deg">${PATO}</span>`;
      else if (p) {
        const rot = giro === "mesa" ? ANG_MESA[p.c] : -a;
        cel.innerHTML = `<b class="q4-p c${p.morto ? "m" : p.c} ${p.t} ${p.prom ? "prom" : ""}" style="rotate:${rot}deg"></b>`;
      } else cel.innerHTML = "";
    }
    // os jogadores
    const vivos = jogo.vivos();
    ov.querySelector(".q4-jogs").innerHTML = [0, 1, 2, 3].map(c => {
      const ativo = !jogo.fim && jogo.vez === c, fora = !jogo.ativos[c];
      const status = fora ? (jogo.motivos[c] || "fora") : ativo ? (jogo.fase === "pato" ? "põe o pato 🦆" : "a vez") : jogo.emXeque(c) ? "em xeque" : "";
      const extra = modo === "duplas" ? "" : `<b class="q4-pts">${jogo.pontos[c]}</b>`;
      return `<div class="q4-jog ${ativo ? "ativo" : ""} ${fora ? "fora" : ""}" style="--cor:${JOGADORES4[c].cor}"><span class="q4-bola"></span><span class="q4-jn"><b>${escapar(nomes[c])}</b><small>${escapar(status || (modo === "duplas" ? `dupla ${c % 2 ? "Azul & Verde" : "Vermelho & Amarelo"}` : ""))}${modo === "tresXeques" && !fora ? ` · ${3 - jogo.xeques[c]} ${3 - jogo.xeques[c] === 1 ? "xeque" : "xeques"} para sair` : ""}</small></span>${extra}</div>`;
    }).join("");
    const vez = ov.querySelector(".q4-vez");
    if (jogo.fim) vez.innerHTML = "";
    else {
      vez.innerHTML = `<span style="--cor:${JOGADORES4[jogo.vez].cor}">${jogo.fase === "pato" ? "Ponha o pato" : "Vez de"} <b>${escapar(nomes[jogo.vez])}</b>${bot[jogo.vez] ? " · pensando…" : ""}</span>`;
      vez.style.rotate = giro === "mesa" && jogo.vez === 2 ? "180deg" : ""; // na mesa, o aviso fica virado para quem está do outro lado
    }
    const lancesEl = ov.querySelector(".q4-lances");
    lancesEl.innerHTML = jogo.sans.map(s => `<span style="--cor:${JOGADORES4[s.c].cor}" class="q4-lance">${escapar(s.san)}</span>`).join(" ");
    lancesEl.scrollLeft = lancesEl.scrollWidth;
    void vivos;
  }
  function depois(res) {
    sel = null; alvos = [];
    if (res?.eliminou?.length) { tocar("errado"); vibrar(80); for (const c of res.eliminou) toast(`${nomes[c]} saiu: ${jogo.motivos[c] || ""}`); }
    else tocar(res?.capturada ? "certo" : "toque");
    if (jogo.fim) return terminar();
    mostrar();
    if (bot[jogo.vez]) vezDoBot();
  }
  function vezDoBot() {
    if (pensando || jogo.fim || !bot[jogo.vez]) return;
    pensando = true;
    setTimeout(() => {
      pensando = false;
      if (!ov.isConnected || jogo.fim || !bot[jogo.vez]) return;
      if (jogo.fase === "pato") { jogo.porPato(jogo.casaParaPatoBot()); return depois({}); }
      const mv = jogo.lanceBot();
      if (!mv) { jogo.passar(); return depois({}); }
      pilha.push(jogo.estado());
      const res = jogo.mover(mv);
      if (jogo.fase === "pato" && !jogo.fim) { mostrar(); setTimeout(() => { if (!ov.isConnected) return; jogo.porPato(jogo.casaParaPatoBot()); depois(res); }, 380); return; }
      depois(res);
    }, 520 + Math.random() * 380);
  }
  function tocarCasa(i) {
    if (jogo.fim || bot[jogo.vez] || pensando) return;
    if (jogo.fase === "pato") {
      pilha.push(jogo.estado());
      if (jogo.porPato(i)) return depois({});
      pilha.pop(); quadro.classList.remove("treme"); void quadro.offsetWidth; quadro.classList.add("treme"); return;
    }
    const mv = alvos.find(a => a.para === i);
    if (sel != null && mv) { pilha.push(jogo.estado()); return depois(jogo.mover(mv)); }
    const p = jogo.casas[i];
    if (p && !p.morto && p.c === jogo.vez) { sel = i; alvos = jogo.legaisDe(i); if (!alvos.length) toast("Essa peça não tem lances agora."); tocar("toque"); }
    else { sel = null; alvos = []; }
    mostrar();
  }
  grade.addEventListener("click", (e) => { const c = e.target.closest(".q4-c"); if (c && !c.classList.contains("fora")) tocarCasa(+c.dataset.i); });
  function terminar() {
    sel = null; alvos = [];
    mostrar();
    const f = jogo.fim, ordem = jogo.classificacao();
    let titulo, vencedor;
    if (f.empate) { titulo = "Empate"; vencedor = null; }
    else if (f.time != null) { vencedor = f.time ? `${nomes[1]} & ${nomes[3]}` : `${nomes[0]} & ${nomes[2]}`; titulo = `${vencedor} venceram!`; }
    else { const v0 = f.vencedor ?? ordem[0]; vencedor = nomes[v0]; titulo = `${vencedor} venceu!`; }
    q.partidas.push({ data: new Date().toISOString(), modo, vencedor, motivo: f.motivo, pontos: [...jogo.pontos], nomes, lances: jogo.lances });
    q.partidas = q.partidas.slice(-100); salvar();
    tocar(vencedor ? "fim" : "toque"); if (vencedor) confete?.();
    nota.innerHTML = `<div class="xz-res ok"><b>${escapar(titulo)}</b><p>${escapar(f.motivo)} · ${jogo.lances} lances</p>
      ${modo !== "duplas" ? `<ol class="q4-rank">${ordem.map(c => `<li style="--cor:${JOGADORES4[c].cor}"><span class="q4-bola"></span>${escapar(nomes[c])}<b>${jogo.pontos[c]} pts</b></li>`).join("")}</ol>` : ""}
      <div class="xz-confirma"><button class="botao secundario" data-r="sair">Sair</button><button class="botao" data-r="de-novo">Jogar de novo</button></div></div>`;
    nota.querySelector('[data-r="de-novo"]').onclick = () => { ov.remove(); jogarQuatro(ctx); };
    nota.querySelector('[data-r="sair"]').onclick = () => { ov.remove(); ctx.aoSair?.(); };
  }
  function confirmar(texto, sim) {
    nota.innerHTML = `<div class="xz-res"><b>${escapar(texto)}</b><div class="xz-confirma"><button class="botao secundario" data-r="0">Não</button><button class="botao" data-r="1">Sim</button></div></div>`;
    nota.querySelectorAll("[data-r]").forEach(b => (b.onclick = () => { nota.innerHTML = ""; if (b.dataset.r === "1") sim(); }));
  }
  ov.querySelector(".xz-s-fechar").onclick = () => { ov.remove(); ctx.aoSair?.(); };
  ov.querySelector(".xz-s-info").onclick = () => { nota.innerHTML = `<div class="xz-res"><b>${escapar(m.icone + " " + m.nome)}</b><p>${escapar(m.regra)}</p><p class="xz-dica-g">Toque numa peça de quem tem a vez e depois na casa. Sem en passant; o peão sempre promove a dama. O roque vale como no xadrez normal, para os dois lados.</p></div>`; };
  ov.querySelector(".xz-p-bts").addEventListener("click", (e) => {
    const a = e.target.closest("button")?.dataset.a; if (!a) return;
    if (a === "voltar" && !jogo.fim && !pensando) {
      // volta até o último lance de uma pessoa
      if (!pilha.length) return;
      do { jogo.restaurar(pilha.pop()); } while (pilha.length && bot[jogo.vez]);
      sel = null; alvos = []; nota.innerHTML = ""; mostrar();
      if (bot[jogo.vez]) vezDoBot();
    }
    if (a === "giro") { const ord = GIROS4.map(g => g[0]); giro = ord[(ord.indexOf(giro) + 1) % ord.length]; toast(`Tabuleiro: ${GIROS4.find(g => g[0] === giro)[1]}`); mostrar(); }
    if (a === "desistir" && !jogo.fim) { const c = jogo.vez; if (bot[c]) return; confirmar(`${nomes[c]} desiste?`, () => { pilha.push(jogo.estado()); jogo.desistir(c); depois({ eliminou: [c] }); }); }
    if (a === "encerrar" && !jogo.fim) confirmar(modo === "duplas" ? "Encerrar a partida empatada?" : "Encerrar agora e decidir pelos pontos?", () => { if (modo === "duplas") jogo.fim = { empate: true, motivo: "Empate combinado" }; else jogo.encerrar(); terminar(); });
  });
  mostrar();
  if (bot[jogo.vez]) vezDoBot();
}
