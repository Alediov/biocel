// Peças capturadas e o placar de material (pedido do Alediov, 26/10/2026): ao lado de cada jogador, as peças que ele
// já tomou do outro e, no lado que está na frente, "+N" pela conta clássica (peão 1, cavalo 3, bispo 3, torre 5,
// dama 9). Tudo sai da posição (FEN): o que falta do conjunto inicial do adversário foi capturado; uma peça a mais que
// o inicial (promoção) conta como um peão que virou outra coisa, então não aparece como peão capturado.
export const VALOR = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const INICIAL = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const ORDEM = ["q", "r", "b", "n", "p"];

/** { capt: { w: ["q", "p", …] (peças pretas que as brancas tomaram), b: […] }, pontos: { w, b }, saldo: w − b } */
export function materialDe(fen) {
  const cont = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of String(fen).split(" ")[0]) {
    const t = ch.toLowerCase();
    if (!(t in VALOR)) continue;
    cont[ch === t ? "b" : "w"][t]++;
  }
  const capt = { w: [], b: [] }, pontos = { w: 0, b: 0 };
  for (const c of ["w", "b"]) {
    const o = c === "w" ? "b" : "w";
    let promovidos = 0;
    for (const t of ORDEM) if (t !== "p") promovidos += Math.max(0, cont[o][t] - INICIAL[t]);
    for (const t of ORDEM) {
      const falta = t === "p" ? Math.max(0, INICIAL.p - cont[o].p - promovidos) : Math.max(0, INICIAL[t] - cont[o][t]);
      for (let k = 0; k < falta; k++) capt[c].push(t);
    }
    for (const t of ORDEM) pontos[c] += cont[c][t] * VALOR[t];
  }
  return { capt, pontos, saldo: pontos.w - pontos.b };
}

/** HTML das capturadas de `cor` (as peças do outro, agrupadas por tipo) e o "+N" se ela está na frente. */
export function htmlMaterial(m, cor, classes = "") {
  const o = cor === "w" ? "b" : "w", lista = m.capt[cor];
  const d = cor === "w" ? m.saldo : -m.saldo;
  const grupos = ORDEM.map(t => lista.filter(x => x === t)).filter(g => g.length);
  return `<span class="xz-mat ${classes}" aria-label="Capturadas: ${lista.length}${d > 0 ? `, +${d}` : ""}">${grupos.map(g => `<span class="xz-mat-g">${g.map(t => `<i class="xz-p ${o}${t}"></i>`).join("")}</span>`).join("")}${d > 0 ? `<b>+${d}</b>` : ""}</span>`;
}

// variantes em que a conta não faz sentido (a captura vai para a mão, um lado tem só peões, perder peças é bom, ninguém
// captura, ou a neblina esconderia o que o outro tem)
export const SEM_MATERIAL = new Set(["crazyhouse", "horda", "perdeGanha", "corrida", "neblina"]);
