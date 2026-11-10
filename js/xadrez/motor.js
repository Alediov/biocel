// Stockfish 19 (lite, uma thread; Stockfish.js de Nathan Rugg, GPL-3.0) num Worker, falando UCI. Funciona offline:
// app/vendor/stockfish/stockfish-19-lite-single.js + .wasm (~1,8 MB).
// Níveis 1 a 8 para jogar: os mais fracos imitam um iniciante (escolhem entre vários lances bons e ruins, e às vezes
// deixam peça); do 3 em diante usam o "Skill Level" do Stockfish com profundidade limitada.

export const NIVEIS = [
  { n: 1, nome: "Nível 1", elo: "~400", prof: 1, multipv: 10, acaso: 0.45 },
  { n: 2, nome: "Nível 2", elo: "~600", prof: 2, multipv: 8, acaso: 0.25 },
  { n: 3, nome: "Nível 3", elo: "~800", skill: 0, prof: 3, multipv: 5, acaso: 0.12 },
  { n: 4, nome: "Nível 4", elo: "~1000", skill: 3, prof: 5 },
  { n: 5, nome: "Nível 5", elo: "~1200", skill: 6, prof: 7 },
  { n: 6, nome: "Nível 6", elo: "~1500", skill: 10, prof: 9 },
  { n: 7, nome: "Nível 7", elo: "~1800", skill: 15, prof: 12 },
  { n: 8, nome: "Máximo", elo: "2500+", skill: 20, prof: 18, tempo: 1500 },
];

let worker = null, pronto = null, ouvintes = [];
function enviar(c) { worker.postMessage(c); }
function esperar(teste, aoLinha) {
  return new Promise(ok => {
    const f = (l) => { aoLinha?.(l); if (teste(l)) { ouvintes = ouvintes.filter(x => x !== f); ok(l); } };
    ouvintes.push(f);
  });
}
export function iniciar() {
  if (pronto) return pronto;
  worker = new Worker(new URL("../../vendor/stockfish/stockfish-19-lite-single.js", import.meta.url));
  worker.onmessage = (e) => { const l = String(e.data); for (const f of [...ouvintes]) f(l); };
  pronto = (async () => {
    enviar("uci"); await esperar(l => l === "uciok");
    enviar("isready"); await esperar(l => l === "readyok");
  })();
  return pronto;
}
let fila = Promise.resolve();
const emFila = (fn) => (fila = fila.then(fn, fn));

let rodando = null; // o `sinal` da análise que está no motor agora (cancelar)
/**
 * Analisa a posição: { melhor, cp, mate, pv, linhas: [{ lance, cp, mate }], prof } (do ponto de vista de quem joga).
 * Tabuleiro de análise (03/11/2026): `aoInfo(r)` recebe o resultado parcial a cada profundidade (o mesmo formato) e
 * `sinal` (um objeto qualquer) permite `cancelar(sinal)`: se ainda não começou, nem começa (devolve null); se está
 * rodando, o motor para e devolve o que já tinha (com `sinal.parado`).
 */
export function analisar(fen, { prof = 12, multipv = 1, tempo = null, skill = 20, aoInfo = null, sinal = null } = {}) {
  return emFila(async () => {
    if (sinal?.parado) return null;
    await iniciar();
    if (sinal?.parado) return null;
    enviar("ucinewgame");
    enviar(`setoption name Skill Level value ${skill}`);
    enviar(`setoption name MultiPV value ${multipv}`);
    enviar("isready"); await esperar(l => l === "readyok");
    enviar(`position fen ${fen}`);
    const linhas = new Map();
    let profAtual = 0;
    const montar = (melhor) => {
      const l = [...linhas.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]);
      return { melhor: melhor || l[0]?.lance || null, cp: l[0]?.cp ?? null, mate: l[0]?.mate ?? null, pv: l[0]?.pv || [], linhas: l, prof: profAtual };
    };
    const prom = esperar(l => l.startsWith("bestmove"), (l) => {
      if (!l.startsWith("info") || !l.includes(" pv ") || / (upper|lower)bound/.test(l)) return;
      const k = +(l.match(/ multipv (\d+)/)?.[1] || 1);
      const cp = l.match(/ score cp (-?\d+)/), mt = l.match(/ score mate (-?\d+)/);
      linhas.set(k, { lance: l.split(" pv ")[1].split(" ")[0], pv: l.split(" pv ")[1].split(" "), cp: cp ? +cp[1] : null, mate: mt ? +mt[1] : null });
      if (k === 1) profAtual = +(l.match(/ depth (\d+)/)?.[1] || profAtual);
      if (aoInfo && (k === multipv || k === linhas.size) && !sinal?.parado) { try { aoInfo(montar()); } catch (e) { console.warn(e); } }
    });
    rodando = sinal;
    enviar(tempo ? `go depth ${prof} movetime ${tempo}` : `go depth ${prof}`);
    const fim = await prom;
    rodando = null;
    const melhor = fim.split(" ")[1];
    return montar(melhor && melhor !== "(none)" ? melhor : null);
  });
}
/** Para a análise de `sinal` (veja `analisar`). */
export function cancelar(sinal) {
  if (!sinal) return;
  sinal.parado = true;
  if (rodando === sinal && worker) enviar("stop");
}

/** O lance do computador no nível escolhido (UCI, como "e2e4"). */
export async function lanceDoNivel(fen, n) {
  const nv = NIVEIS.find(x => x.n === n) || NIVEIS[3];
  const r = await analisar(fen, { prof: nv.prof, multipv: nv.multipv || 1, skill: nv.skill ?? 0, tempo: nv.tempo || null });
  if (!nv.multipv || r.linhas.length < 2) return r.melhor;
  // iniciante: às vezes pega um lance pior; quanto menor o nível, mais "acaso"
  if (Math.random() < nv.acaso) return r.linhas[Math.floor(Math.random() * r.linhas.length)].lance;
  // senão, sorteia entre os 3 melhores com pesos 60/25/15
  const t = Math.random(), i = t < 0.6 ? 0 : t < 0.85 ? 1 : 2;
  return (r.linhas[Math.min(i, r.linhas.length - 1)] || r.linhas[0]).lance;
}
export function parar() { if (worker) enviar("stop"); }
