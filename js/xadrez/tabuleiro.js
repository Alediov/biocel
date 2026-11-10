// Tabuleiro do Xadrez do Órbita: desenho, toque para mover (tocar a peça e depois a casa) e arrastar, pontos nos
// lances possíveis, último lance, xeque, setas e escolha da promoção. As regras ficam com quem usa (chess.js, chessops):
// o tabuleiro só pergunta os lances legais de uma casa (`legais`) e avisa o lance escolhido (`aoMover`).
//
// Pedidos do Alediov de 26/10/2026:
// - desenhar a qualquer momento: SEGURAR uma casa e arrastar até outra traça uma seta; segurar e soltar na mesma casa
//   pinta a casa. Repetir a mesma seta (ou casa) troca a cor: verde → vermelha → azul → amarela → some. Com mouse,
//   o botão direito desenha na hora. Os desenhos somem quando alguém joga.
// - aparência (tabuleiro em cor ou textura, conjunto de peças 2D ou 2.5D, coordenadas): `definirVisual`, guardada
//   pela tela; as peças 2.5D (as do modo 3D do lichess) são mais altas que a casa e passam dela para cima.
// - "frente a frente" (o tablet deitado na mesa, um jogador de cada lado): as peças de quem está em cima ficam viradas.
// - barra de anotações embaixo do tabuleiro (segundo pedido do dia: "um lápis e uma lixeira para desenhar as setas"):
//   o lápis liga o modo desenho e mostra as 4 cores; nele, arrastar de uma casa a outra faz a seta da cor escolhida e
//   tocar numa casa pinta (de novo com a mesma cor, despinta), sem mexer peças; a lixeira apaga as anotações dele (as
//   setas do app, como a do lance guiado, ficam); o lápis de novo sai do modo. O segurar continua valendo. Fora do modo
//   desenho, as anotações somem quando alguém joga (como no lichess); com o lápis ligado, elas ficam quando alguém joga
//   (ele está analisando: o computador pode responder sem apagar o raciocínio), mas somem numa posição nova (o passo
//   seguinte da lição ou o próximo problema, que chegam sem `ultimo`).
// Pedidos do Alediov de 06/11/2026:
// - mais cores (cores.js): as 4 de sempre, o arco-íris (o desenho muda de cor sozinho; parado com "reduzir movimento",
//   um degradê) e até 4 cores dele, pelo "+" (círculo cromático ou código #RRGGBB/#RGB); segurar uma cor dele a tira.
//   As setas são um grupo (traço + ponta desenhada aqui, sem <marker>) com a cor em `color`: qualquer cor serve, e a
//   transparência é do grupo inteiro (o traço não escurece debaixo da ponta).
// - seta do cavalo: entre casas a um salto de cavalo a seta é um "L" (como no chess.com). A perna longa vem primeiro,
//   a não ser que o dedo tenha passado claramente pelo outro canto (o traço do arrasto é guardado e comparado com os
//   dois cantos possíveis). A seta guarda `forma` ("longa" | "curta"); `forma: "reta"` desenha reta.
// - promoção: a escolha da peça fica na tela até ele escolher. Ela sumia porque o próprio toque que fazia o lance
//   (o toque na casa da promoção) gerava, no celular, o "click" logo depois, já em cima do fundo escuro do menu, e
//   qualquer clique fora dos botões cancelava; além disso, tocar no menu também chegava ao tabuleiro (que podia
//   selecionar outra peça e prender o dedo nele). Agora o menu só aceita um toque que comece nele, tocar fora não fecha,
//   o tabuleiro não reage enquanto ele está aberto, e o X desfaz o lance. Só uma posição nova (Voltar, tempo esgotado)
//   ou o tabuleiro bloqueado fecham o menu.
// Peças cburnett por padrão (app/xadrez-pecas.css); os outros conjuntos em app/vendor/pecas/pecas.css.
//
// Desempenho (26/10/2026, "as lições estão bem travadas"): o retângulo do tabuleiro é lido uma vez por gesto (não a
// cada movimento do dedo) e a casa "sobre" do arrasto é um elemento só, reaproveitado.

import { CORES, FIXAS, NOMES, ARCO, MAX_PROPRIAS, hexDe, ehPropria, coresProprias, adicionarPropria, tirarPropria, corDoHex, ouvirCores, abrirSeletorCor } from "./cores.js";
export { definirCoresProprias, aoMudarCores, coresProprias, MAX_PROPRIAS } from "./cores.js";

const ARQ = "abcdefgh";
const casaXY = (c, branco) => { const f = ARQ.indexOf(c[0]), r = +c[1] - 1; return branco ? [f, 7 - r] : [7 - f, r]; };
const CORES_DESENHO = FIXAS; // o ciclo do segurar: verde → vermelha → azul → amarela → some
const SEGURAR_MS = 380;
const SEGURAR_COR_MS = 480; // segurar uma cor própria na barra: tirar
const reduzir = () => !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const n3 = (v) => +v.toFixed(3);
let corLapis = "verde"; // a cor escolhida no lápis (vale para todos os tabuleiros enquanto o app está aberto)
const SVG_LAPIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5 4 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 7l3.5 3.5" stroke="currentColor" stroke-width="2"/></svg>';
const SVG_DESFAZER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4.5 9.5 9 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 9.5H14a5.5 5.5 0 010 11h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SVG_LIXEIRA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.2a1.6 1.6 0 001.6 1.3h5.8a1.6 1.6 0 001.6-1.3l1-12.2M10 10.5v6M14 10.5v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SVG_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const ehCavalo = (dx, dy) => (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);

/**
 * O caminho de uma seta, em casas (0 a 8) na tela: [[x, y], …] do centro de `de` até a ponta, e a forma usada.
 * Entre casas a um salto de cavalo, um "L": "longa" (perna de 2 casas primeiro) ou "curta"; nas outras, reta.
 */
export function caminhoSeta([a, b], [c, d], forma) {
  const x1 = a + .5, y1 = b + .5, x2 = c + .5, y2 = d + .5, dx = c - a, dy = d - b;
  const pts = [[x1, y1]];
  let f = "reta";
  if (ehCavalo(dx, dy) && forma !== "reta") {
    f = forma === "curta" ? "curta" : "longa";
    const xPrimeiro = (f === "longa") === (Math.abs(dx) === 2);
    pts.push(xPrimeiro ? [x2, y1] : [x1, y2]);
  }
  return { pts, fim: [x2, y2], forma: f };
}
/**
 * Qual "L" o traço do dedo pediu: o canto do lado por onde ele passou claramente mais longe da reta entre as casas
 * (cada canto fica a ~0,9 casa dela, um de cada lado). Sem informação clara, a perna longa primeiro.
 * `pts`: pontos do arrasto em casas (0 a 8) na tela.
 */
export function formaDoTraco(pts, [a, b], [c, d]) {
  if (!ehCavalo(c - a, d - b)) return null;
  const { pts: [ini, canto], fim } = caminhoSeta([a, b], [c, d], "longa");
  const vx = fim[0] - ini[0], vy = fim[1] - ini[1], L2 = vx * vx + vy * vy, L = Math.sqrt(L2);
  const lado = (p) => (vx * (p[1] - ini[1]) - vy * (p[0] - ini[0])) / L; // distância com sinal até a reta
  const ladoLonga = Math.sign(lado(canto));
  let longa = 0, curta = 0;
  for (const p of pts || []) {
    const t = ((p[0] - ini[0]) * vx + (p[1] - ini[1]) * vy) / L2;
    if (t < .15 || t > .85) continue; // perto das casas o dedo ainda está "dentro" delas
    const s = lado(p);
    if (s * ladoLonga > 0) longa = Math.max(longa, Math.abs(s)); else curta = Math.max(curta, Math.abs(s));
  }
  return curta > .3 && curta > longa + .1 ? "curta" : "longa";
}

// aparência de todos os tabuleiros (a tela de Xadrez chama definirVisual com o que ele escolheu)
let VISUAL = { tabuleiro: "marrom", pecas: "cburnett", coords: true, lances: true };
const vivos = new Set();
export function definirVisual(v) { VISUAL = { ...VISUAL, ...v }; for (const t of vivos) if (t.el.isConnected) t.aplicar(); else vivos.delete(t); }
export const visualAtual = () => ({ ...VISUAL });
/** As classes da aparência (para mostrar peças fora do tabuleiro com o mesmo conjunto: mão do crazyhouse, prévia). */
export function classesVisual(v = VISUAL) {
  const p = v.pecas || "cburnett", t = v.tabuleiro || "marrom";
  return [p.startsWith("3d-") ? `pecas-3d pc3-${p.slice(3)}` : p === "cburnett" ? "" : `pc-${p}`, t.startsWith("tx-") ? `tb-${t.slice(3)} tb-textura` : `tb-cor-${t}`].join(" ");
}

/**
 * @param {HTMLElement} el
 * @param {{ orientacao?: "w"|"b", legais?: (casa:string)=>{to:string, promotion?:string}[], aoMover?: (de, para, promo)=>any, podeMexer?: (cor)=>boolean, aoTocar?: (casa)=>boolean, ferramentas?: boolean, barraDepois?: Element }} o
 * `ferramentas: false` tira a barra de anotações (lápis, cores e lixeira); `barraDepois` diz depois de qual elemento
 * ela entra (padrão: logo depois do tabuleiro).
 */
export function criarTabuleiro(el, o = {}) {
  // as funções (legais, aoMover, podeMexer, aoTocar) podem ser trocadas depois em `tab._f`
  const F = () => ({ ...o, ...(api._f || {}) });
  let orient = o.orientacao || "w", pecas = new Map(), sel = null, ultimo = null, xeque = null, setas = [], marcas = new Map(), bloqueado = false, vez = "w";
  let frente = false, extras = new Map(), neblina = new Set(), fenAtual = "";
  const desenhos = { setas: new Map(), casas: new Map() }; // "e2e4" → { cor, forma }, "e4" → cor
  // desfazer (pedido do Alediov, 04/11/2026: apagar só o último desenho): cada mudança guarda como estava antes;
  // a lixeira também (desfazer depois dela traz tudo de volta). Zera quando os desenhos somem com um lance.
  const historico = [];
  const MAX_HIST = 60;
  const anotarHist = (h) => { historico.push(h); if (historico.length > MAX_HIST) historico.shift(); };
  el.classList.add("xz-tab");
  el.innerHTML = `<div class="xz-casas"></div><div class="xz-marcas"></div><div class="xz-pecas"></div><svg class="xz-setas" viewBox="0 0 8 8"></svg><div class="xz-coords"></div>`;
  const casasEl = el.querySelector(".xz-casas"), pecasEl = el.querySelector(".xz-pecas"), marcasEl = el.querySelector(".xz-marcas"), setasEl = el.querySelector(".xz-setas"), coordsEl = el.querySelector(".xz-coords");
  for (let i = 0; i < 64; i++) { const c = document.createElement("i"); c.className = (Math.floor(i / 8) + i) % 2 ? "esc" : "cla"; casasEl.append(c); }

  const xy = (casa) => casaXY(casa, orient === "w");
  const pos = (casa) => { const [x, y] = xy(casa); return `translate(${x * 100}%, ${y * 100}%)`; };
  const posT = (casa, dx = 0, dy = 0) => { const [x, y] = xy(casa); return dx || dy ? `calc(${x * 100}% + ${dx}px) calc(${y * 100}% + ${dy}px)` : `${x * 100}% ${y * 100}%`; };
  // a peça no lugar: posição (translate), giro (frente a frente) e, nas peças 2.5D, a de baixo por cima da de cima
  function colocar(e, casa, dx = 0, dy = 0) {
    e.style.translate = posT(casa, dx, dy);
    e.style.rotate = frente && e.dataset.p && e.dataset.p[0] !== orient ? "180deg" : "";
    e.style.zIndex = String(2 + xy(casa)[1]);
  }
  function coords() {
    const fs = orient === "w" ? ARQ : [...ARQ].reverse().join(""), rs = orient === "w" ? "87654321" : "12345678";
    coordsEl.innerHTML = [...fs].map((f, i) => `<b class="f" style="left:${i * 12.5}%">${f}</b>`).join("") + [...rs].map((r, i) => `<b class="r" style="top:${i * 12.5}%">${r}</b>`).join("");
  }
  // a cor de uma casa pintada ou seta: as fixas pela classe, as dele pelo código, o arco-íris pela classe (animada)
  const classeCor = (cor) => (cor === ARCO ? ARCO : CORES[cor] ? cor : "propria");
  function marcar() {
    marcasEl.innerHTML = "";
    const add = (casa, cls, cor) => { const m = document.createElement("i"); m.className = cls; m.style.transform = pos(casa); if (cor) m.style.background = cor; marcasEl.append(m); };
    for (const [casa, cor] of desenhos.casas) add(casa, `pint ${classeCor(cor)}`, ehPropria(cor) ? hexDe(cor) : null);
    if (ultimo) { add(ultimo[0], "ult"); if (ultimo[1] !== ultimo[0]) add(ultimo[1], "ult"); }
    if (xeque) add(xeque, "xeque");
    for (const [casa, cls] of marcas) add(casa, cls);
    for (const casa of neblina) add(casa, "neblina");
    if (sel) {
      add(sel, "sel");
      if (VISUAL.lances !== false) for (const m of F().legais?.(sel) || []) add(m.to, pecas.has(m.to) ? "alvo captura" : "alvo");
    }
    marcarArco();
  }
  // o arco-íris: a cor anda numa propriedade (--arco) do tabuleiro, então tudo o que é arco-íris muda junto e não
  // recomeça quando as setas são redesenhadas; só anima enquanto há algo arco-íris (ou o lápis está nele)
  let previaArco = false;
  function marcarArco() {
    const tem = previaArco || (modoDesenho && corLapis === ARCO) || [...desenhos.casas.values()].includes(ARCO)
      || [...desenhos.setas.values()].some(v => v.cor === ARCO) || setas.some(v => v.cor === ARCO);
    el.classList.toggle("tem-arco", tem);
  }
  const uid = Math.random().toString(36).slice(2, 7);
  // a seta: traço (reto ou em "L") e a ponta, num grupo com a cor em `color` (medidas iguais às das setas antigas:
  // traço de 0,16 casa, ponta de 0,64 que termina 0,09 antes do centro da casa)
  const PONTA = .64, LARG = .32, ANTES = .09, ARCO_CORES = ["#E53935", "#FB8C00", "#FDD835", "#43A047", "#1E88E5", "#8E24AA"];
  let nGrad = 0;
  function seta({ de, para, cor = "verde", forma }, extra = "") {
    if (!de || !para) return "";
    const { pts, fim, forma: f } = caminhoSeta(xy(de), xy(para), forma);
    const [px, py] = pts[pts.length - 1], L = Math.hypot(fim[0] - px, fim[1] - py) || 1, ux = (fim[0] - px) / L, uy = (fim[1] - py) / L;
    const tx = fim[0] - ux * ANTES, ty = fim[1] - uy * ANTES, bx = tx - ux * PONTA, by = ty - uy * PONTA;
    const linha = [...pts, [tx - ux * (PONTA - .05), ty - uy * (PONTA - .05)]].map(([x, y], i) => `${i ? "L" : "M"}${n3(x)},${n3(y)}`).join(" ");
    const ponta = `M${n3(tx)},${n3(ty)} L${n3(bx + uy * LARG)},${n3(by - ux * LARG)} L${n3(bx - uy * LARG)},${n3(by + ux * LARG)} Z`;
    // "reduzir movimento": o arco-íris parado, num degradê do começo à ponta da própria seta
    const fixo = cor === ARCO && reduzir(), gid = `xz-${uid}-arco-${++nGrad}`;
    const tinta = fixo ? `url(#${gid})` : "currentColor";
    const grad = fixo ? `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${n3(pts[0][0])}" y1="${n3(pts[0][1])}" x2="${n3(tx)}" y2="${n3(ty)}">${ARCO_CORES.map((c, i) => `<stop offset="${(i / (ARCO_CORES.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join("")}</linearGradient>` : "";
    const estilo = ehPropria(cor) ? ` style="color:${hexDe(cor)}"` : "";
    return `<g class="seta ${classeCor(cor)} ${extra}"${estilo} data-forma="${f}" data-de="${de}" data-para="${para}">${grad}<path d="${linha}" fill="none" stroke="${tinta}" stroke-width=".16" stroke-linecap="round" stroke-linejoin="round"/><path d="${ponta}" fill="${tinta}"/></g>`;
  }
  function desenharSetas(previa = null) {
    const minhas = [...desenhos.setas].map(([k, v]) => ({ de: k.slice(0, 2), para: k.slice(2, 4), ...v }));
    previaArco = previa?.cor === ARCO;
    nGrad = 0;
    setasEl.innerHTML = setas.map(v => seta(v)).join("") + minhas.map(v => seta(v, "usuario")).join("") + (previa ? seta(previa, "usuario previa") : "");
    marcarArco();
  }
  function desenharExtras() {
    el.querySelectorAll(".xz-extra").forEach(x => x.remove());
    for (const [casa, tipo] of extras) {
      const e = document.createElement("div"); e.className = `xz-extra ${tipo}`; e.style.translate = posT(casa); e.style.zIndex = String(2 + xy(casa)[1]);
      if (tipo === "pato") e.innerHTML = PATO;
      pecasEl.append(e);
    }
  }

  /** Mostra uma posição. `fen`, o último lance [de, para] e a casa do rei em xeque. */
  function posicao(fen, { ultimo: u = null, xeque: x = null } = {}) {
    ultimo = u; xeque = x; sel = null;
    // alguém jogou (a posição das peças mudou): os desenhos somem, como no lichess
    const placa = fen.split(" ")[0];
    // (com o lápis ligado, ficam enquanto for um lance; numa posição nova, sem `ultimo`, somem sempre)
    if (fenAtual && placa !== fenAtual && (!modoDesenho || !u)) { desenhos.setas.clear(); desenhos.casas.clear(); historico.length = 0; pintarBarra(); }
    // a posição mudou por fora (Voltar, partida nova) com a escolha da promoção aberta: o lance não vale mais
    if (promo && fenAtual && placa !== fenAtual) fecharPromo(null);
    fenAtual = placa;
    const partes = placa.split("/"), novas = new Map();
    vez = fen.split(" ")[1] || "w";
    partes.forEach((linha, r) => { let f = 0; for (const ch of linha) { if (/\d/.test(ch)) f += +ch; else { novas.set(ARQ[f] + (8 - r), (ch === ch.toUpperCase() ? "w" : "b") + ch.toLowerCase()); f++; } } });
    // reaproveita os elementos das peças que só mudaram de casa (animação)
    const antigas = [...pecasEl.querySelectorAll(".xz-p")], livres = new Map();
    for (const e of antigas) { const k = e.dataset.p; (livres.get(k) || livres.set(k, []).get(k)).push(e); }
    const usados = new Set(), mapa = new Map();
    for (const [casa, p] of novas) {
      const e = (livres.get(p) || []).find(x => x.dataset.c === casa && !usados.has(x));
      if (e) { usados.add(e); mapa.set(casa, e); }
    }
    for (const [casa, p] of novas) {
      if (mapa.has(casa)) continue;
      const cand = (livres.get(p) || []).filter(x => !usados.has(x));
      let e = null, melhor = 99;
      for (const x of cand) { const [a, b] = casaXY(x.dataset.c, true), [c2, d] = casaXY(casa, true), dist = Math.abs(a - c2) + Math.abs(b - d); if (dist < melhor) { melhor = dist; e = x; } }
      if (!e) { e = document.createElement("div"); e.className = `xz-p ${p}`; e.dataset.p = p; e.dataset.c = casa; colocar(e, casa); e.style.opacity = "0"; pecasEl.append(e); requestAnimationFrame(() => (e.style.opacity = "")); }
      usados.add(e); mapa.set(casa, e);
    }
    for (const e of antigas) if (!usados.has(e)) { e.style.opacity = "0"; setTimeout(() => e.remove(), 180); }
    for (const [casa, e] of mapa) { e.dataset.c = casa; colocar(e, casa); }
    pecas = novas;
    marcar(); desenharSetas(); desenharExtras();
  }

  // ---------------- interação
  let arr = null; // arrastando: { casa, el, x0, y0, moveu }
  let des = null; // desenhando: { de, ate, cor, pts: o traço do dedo em casas, para a seta do cavalo }
  let promo = null; // a escolha da promoção aberta: { box, ok }
  let segurar = null; // timer do segurar
  let modoDesenho = false; // o lápis da barra
  let ret = null; // o retângulo do tabuleiro, lido uma vez por gesto
  // o ponto em casas (0 a 8) na tela, para o traço do desenho
  const pontoEmCasas = (x, y) => { const r = ret || el.getBoundingClientRect(); return [(x - r.left) / (r.width / 8), (y - r.top) / (r.height / 8)]; };
  const casaDoPonto = (x, y) => {
    const r = ret || el.getBoundingClientRect(), f = Math.floor((x - r.left) / (r.width / 8)), l = Math.floor((y - r.top) / (r.height / 8));
    if (f < 0 || f > 7 || l < 0 || l > 7) return null;
    return orient === "w" ? ARQ[f] + (8 - l) : ARQ[7 - f] + (l + 1);
  };
  // px da tela → px do tabuleiro (o zoom do tablet)
  const kz = () => { const w = el.offsetWidth; return w ? (ret || el.getBoundingClientRect()).width / w : 1; };
  let sobreEl = null; // a casa sob a peça arrastada
  const sobre = (c) => {
    if (!c) { sobreEl?.remove(); return; }
    if (!sobreEl) { sobreEl = document.createElement("i"); sobreEl.className = "sobre"; }
    sobreEl.style.transform = pos(c); if (sobreEl.parentNode !== marcasEl) marcasEl.append(sobreEl);
  };
  const minha = (casa) => { const p = pecas.get(casa); return p && p[0] === vez && (F().podeMexer?.(p[0]) ?? true); };
  async function tentar(de, para) {
    const ls = (F().legais?.(de) || []).filter(m => m.to === para);
    if (!ls.length) return false;
    let promo;
    if (ls.some(m => m.promotion)) { promo = await escolherPromocao(para, pecas.get(de)[0]); if (!promo) return false; }
    sel = null; marcar();
    await F().aoMover?.(de, para, promo);
    return true;
  }
  const proxCor = (atual) => { const i = CORES_DESENHO.indexOf(atual); return i < 0 ? CORES_DESENHO[0] : CORES_DESENHO[i + 1] || null; };
  // com a cor do lápis: põe essa cor (ou tira, se já era ela); sem (o segurar): passa à próxima cor do ciclo
  const novaCor = (atual, cor) => (cor ? (atual === cor ? null : cor) : proxCor(atual));
  function terminarDesenho(ate) {
    const d = des; des = null;
    if (!d) return;
    if (!ate) { desenharSetas(); return; }
    if (ate === d.de) { const antes = desenhos.casas.get(ate), c = novaCor(antes, d.cor); anotarHist({ mapa: "casas", k: ate, antes }); if (c) desenhos.casas.set(ate, c); else desenhos.casas.delete(ate); marcar(); }
    else {
      const k = d.de + ate, antes = desenhos.setas.get(k), c = novaCor(antes?.cor, d.cor), forma = formaDoTraco(d.pts, xy(d.de), xy(ate));
      anotarHist({ mapa: "setas", k, antes });
      if (c) desenhos.setas.set(k, forma ? { cor: c, forma } : { cor: c }); else desenhos.setas.delete(k);
    }
    desenharSetas(); pintarBarra();
  }
  function comecarDesenho(casa, cor = null, ponto = null) {
    clearTimeout(segurar?.t); segurar = null;
    if (arr) { // cancela o arrasto da peça
      const a = arr; arr = null; a.el.classList.remove("arrastando"); colocar(a.el, a.casa);
      sobre(null);
    }
    sel = null; marcar();
    des = { de: casa, ate: casa, cor, pts: ponto ? [ponto] : [] };
    if (!cor) navigator.vibrate?.(12);
    el.classList.add("desenhando");
  }
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  const capturar = (id) => { try { el.setPointerCapture(id); } catch { /* o dedo já saiu */ } };
  el.addEventListener("pointerdown", (e) => {
    if (promo) return; // com a escolha da promoção aberta, o tabuleiro não reage
    ret = el.getBoundingClientRect();
    const casa = casaDoPonto(e.clientX, e.clientY); if (!casa) return;
    const p0 = pontoEmCasas(e.clientX, e.clientY);
    if (e.button === 2) { comecarDesenho(casa, modoDesenho ? corLapis : null, p0); capturar(e.pointerId); return; } // botão direito: desenha na hora
    if (e.button > 0) return;
    // lápis ligado: tocar e arrastar só desenha (não mexe peças), mesmo com o tabuleiro bloqueado
    if (modoDesenho) { clearTimeout(segurar?.t); segurar = null; comecarDesenho(casa, corLapis, p0); capturar(e.pointerId); return; }
    // segurar (sem mexer) começa um desenho, mesmo com o tabuleiro bloqueado
    clearTimeout(segurar?.t);
    segurar = { x0: e.clientX, y0: e.clientY, t: setTimeout(() => { if (!arr || !arr.moveu) { comecarDesenho(casa, null, p0); capturar(e.pointerId); } }, SEGURAR_MS) };
    if (bloqueado) return;
    if (F().aoTocar?.(casa)) { clearTimeout(segurar.t); segurar = null; return; }
    if (sel && sel !== casa && !minha(casa)) { const de = sel; tentar(de, casa).then(ok => { if (!ok) { sel = null; marcar(); } }); return; }
    if (!minha(casa)) { sel = null; marcar(); return; }
    sel = casa; marcar();
    const pe = [...pecasEl.querySelectorAll(".xz-p")].find(x => x.dataset.c === casa);
    if (pe) { arr = { casa, el: pe, x0: e.clientX, y0: e.clientY, moveu: false }; capturar(e.pointerId); }
  });
  el.addEventListener("pointermove", (e) => {
    if (segurar && Math.hypot(e.clientX - segurar.x0, e.clientY - segurar.y0) > 9) { clearTimeout(segurar.t); segurar = null; }
    if (des) {
      des.pts.push(pontoEmCasas(e.clientX, e.clientY));
      if (des.pts.length > 400) des.pts.splice(1, 1);
      const c = casaDoPonto(e.clientX, e.clientY), forma = c && c !== des.de ? formaDoTraco(des.pts, xy(des.de), xy(c)) : null;
      // a prévia muda quando muda a casa ou, no cavalo, o "L" pedido pelo traço
      if (c && (c !== des.ate || forma !== des.formaPrevia)) { des.ate = c; des.formaPrevia = forma; desenharSetas(c !== des.de ? { de: des.de, para: c, cor: des.cor || "verde", ...(forma ? { forma } : {}) } : null); }
      return;
    }
    if (!arr) return;
    const k = kz(), dx = (e.clientX - arr.x0) / k, dy = (e.clientY - arr.y0) / k;
    if (!arr.moveu && Math.hypot(dx, dy) < 6) return;
    arr.moveu = true;
    arr.el.classList.add("arrastando");
    colocar(arr.el, arr.casa, dx, dy); arr.el.style.zIndex = "30";
    sobre(casaDoPonto(e.clientX, e.clientY));
  });
  const soltar = async (e) => {
    clearTimeout(segurar?.t); segurar = null;
    if (des) { el.classList.remove("desenhando"); if (e.type !== "pointercancel") des.pts.push(pontoEmCasas(e.clientX, e.clientY)); terminarDesenho(e.type === "pointercancel" ? null : casaDoPonto(e.clientX, e.clientY)); ret = null; return; }
    if (!arr) { ret = null; return; }
    const a = arr; arr = null;
    a.el.classList.remove("arrastando");
    sobre(null);
    if (!a.moveu) return; // foi um toque: fica selecionada
    const c = casaDoPonto(e.clientX, e.clientY);
    a.el.style.transition = "none"; colocar(a.el, a.casa); void a.el.offsetWidth; a.el.style.transition = "";
    ret = null;
    if (c && c !== a.casa) { if (!(await tentar(a.casa, c))) { sel = null; marcar(); } }
  };
  el.addEventListener("pointerup", soltar); el.addEventListener("pointercancel", soltar);

  // a escolha da peça na promoção: fica até ele escolher (ou tocar no X, que desfaz o lance)
  const NOMES_PROMO = { q: "Dama", r: "Torre", b: "Bispo", n: "Cavalo" };
  function fecharPromo(v = null) { if (!promo) return; const p = promo; promo = null; p.box.remove(); p.ok(v); }
  function escolherPromocao(casa, cor) {
    fecharPromo(null);
    return new Promise(ok => {
      const box = document.createElement("div"); box.className = "xz-promo";
      if (frente && cor !== orient) box.style.rotate = "180deg";
      box.innerHTML = `<div class="xz-promo-pecas" role="group" aria-label="Promover a">${["q", "r", "b", "n"].map(p => `<button type="button" data-p="${p}" aria-label="${NOMES_PROMO[p]}"><i class="xz-p ${cor}${p}"></i></button>`).join("")}</div>`
        + `<button type="button" class="xz-promo-x" aria-label="Desfazer o lance" title="Desfazer o lance">${SVG_X}</button>`;
      // só vale um toque que COMEÇA no menu: o "click" que o celular solta logo depois do toque que fez o lance cai em
      // cima do menu recém-aberto e antes o cancelava (teclado: click com detail 0)
      let armado = false;
      box.addEventListener("pointerdown", (e) => { e.stopPropagation(); armado = true; });
      box.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); });
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!armado && e.detail !== 0) return;
        const b = e.target.closest("button"); if (!b) return; // tocar fora das peças não fecha
        fecharPromo(b.classList.contains("xz-promo-x") ? null : b.dataset.p);
      });
      el.append(box);
      promo = { box, ok };
    });
  }

  // ---------------- barra de anotações (lápis, cores e lixeira)
  let barra = null;
  const temDesenhos = () => desenhos.setas.size + desenhos.casas.size > 0;
  function pintarBarra() {
    // a cor do lápis pode ter sido tirada (aqui ou noutro tabuleiro)
    if (ehPropria(corLapis) && !coresProprias().includes(corLapis)) corLapis = "verde";
    el.classList.toggle("modo-desenho", modoDesenho);
    el.dataset.corLapis = ehPropria(corLapis) ? "propria" : corLapis;
    el.style.setProperty("--cor-lapis", corLapis === ARCO ? "var(--arco)" : hexDe(corLapis));
    marcarArco();
    if (!barra) return;
    barra.classList.toggle("ligado", modoDesenho);
    barra.querySelector(".xz-lapis").setAttribute("aria-pressed", String(modoDesenho));
    barra.querySelectorAll(".xz-cores button").forEach(b => { b.classList.toggle("on", b.dataset.cor === corLapis); b.setAttribute("aria-pressed", String(b.dataset.cor === corLapis)); b.tabIndex = modoDesenho ? 0 : -1; });
    barra.querySelector(".xz-lixeira").disabled = !temDesenhos();
    barra.querySelector(".xz-desfazer").disabled = !historico.length;
  }
  // as cores da barra: as 4 de sempre, o arco-íris, as dele e o "+" (sempre aparece: cheio, ele explica o limite)
  function htmlCores() {
    const chip = (c, cls, rot) => `<button type="button" class="xz-cor ${cls}" data-cor="${c}" style="--c:${hexDe(c) || "#888"}" aria-label="${rot}" title="${rot}"></button>`;
    const pr = coresProprias();
    return FIXAS.map(c => chip(c, c, NOMES[c])).join("") + chip(ARCO, ARCO, NOMES.arco)
      + pr.map(h => chip(h, "propria", `Cor ${h.toUpperCase()} (segure para tirar)`)).join("")
      + `<button type="button" class="xz-cor-mais${pr.length >= MAX_PROPRIAS ? " cheia" : ""}" aria-label="Nova cor" title="Nova cor"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>`;
  }
  function pintarCores() { if (!barra) return; barra.querySelector(".xz-cores").innerHTML = htmlCores(); pintarBarra(); }
  function escolherCor(c) {
    corLapis = c; if (!modoDesenho) ligarDesenho(true); else pintarBarra();
    barra?.querySelector(`.xz-cores [data-cor="${c}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  // segurar uma cor dele: um balão com "Tirar esta cor"
  function menuTirar(b) {
    document.querySelector(".xz-cor-menu")?.remove();
    const r = b.getBoundingClientRect(), hex = b.dataset.cor;
    const m = document.createElement("div"); m.className = "xz-cor-menu";
    m.innerHTML = `<i style="background:${hex}"></i><button type="button">Tirar esta cor</button>`;
    m.style.left = `${r.left + r.width / 2}px`; m.style.top = `${r.top - 8}px`;
    document.body.append(m);
    const fora = (e) => { if (!m.contains(e.target)) fechar(); };
    const fechar = () => { m.remove(); document.removeEventListener("pointerdown", fora, true); };
    setTimeout(() => document.addEventListener("pointerdown", fora, true), 0);
    m.querySelector("button").onclick = () => { fechar(); tirarPropria(hex); navigator.vibrate?.(10); };
    navigator.vibrate?.(15);
  }
  function ligarDesenho(b) {
    modoDesenho = b;
    if (b) { sel = null; marcar(); }
    pintarBarra();
  }
  if (o.ferramentas !== false) {
    barra = document.createElement("div");
    barra.className = "xz-ferr";
    barra.innerHTML = `<span class="xz-cores" role="group" aria-label="Cor das anotações">${htmlCores()}</span>`
      + `<button type="button" class="xz-desfazer" aria-label="Desfazer a última anotação" title="Desfazer a última anotação">${SVG_DESFAZER}</button>`
      + `<button type="button" class="xz-lixeira" aria-label="Apagar as anotações" title="Apagar as anotações">${SVG_LIXEIRA}</button>`
      + `<button type="button" class="xz-lapis" aria-pressed="false" aria-label="Desenhar setas e pintar casas" title="Desenhar setas e pintar casas">${SVG_LAPIS}</button>`;
    (o.barraDepois || el).after(barra);
    let segCor = null, semClique = false;
    barra.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".xz-cor.propria"); if (!b) return;
      clearTimeout(segCor?.t);
      segCor = { x0: e.clientX, y0: e.clientY, t: setTimeout(() => { segCor = null; semClique = true; menuTirar(b); }, SEGURAR_COR_MS) };
    });
    const largar = () => { clearTimeout(segCor?.t); segCor = null; };
    barra.addEventListener("pointermove", (e) => { if (segCor && Math.hypot(e.clientX - segCor.x0, e.clientY - segCor.y0) > 8) largar(); });
    barra.addEventListener("pointerup", largar); barra.addEventListener("pointercancel", largar);
    barra.addEventListener("contextmenu", (e) => { const b = e.target.closest(".xz-cor.propria"); if (!b) return; e.preventDefault(); largar(); semClique = true; menuTirar(b); });
    barra.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (semClique) { semClique = false; return; } // o clique que vem depois de segurar uma cor
      navigator.vibrate?.(6);
      if (b.classList.contains("xz-lapis")) ligarDesenho(!modoDesenho);
      else if (b.classList.contains("xz-desfazer")) { api.desfazerDesenho(); b.classList.remove("volta"); void b.offsetWidth; b.classList.add("volta"); }
      else if (b.classList.contains("xz-lixeira")) { api.limparDesenhos(); b.classList.remove("varre"); void b.offsetWidth; b.classList.add("varre"); }
      else if (b.classList.contains("xz-cor-mais")) abrirSeletorCor({ inicial: ["#8e24aa", "#ff7043", "#00acc1", "#ec407a", "#7cb342"].find(c => !coresProprias().includes(c)) || "#8e24aa", aoAdicionar: (hex) => { const r = adicionarPropria(hex); if (r === "ok" || r === "existe") escolherCor(corDoHex(hex)); return r; } });
      else if (b.dataset.cor) escolherCor(b.dataset.cor);
    });
    const parar = ouvirCores(() => { if (!el.isConnected) { parar(); return; } pintarCores(); });
    // a barra acompanha a largura do tabuleiro (no tablet deitado, ela fica na coluna da direita: xadrez.css)
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { const w = el.offsetWidth; if (w) barra.style.setProperty("--lado", `${w}px`); }).observe(el);
    pintarBarra();
  }

  function aplicar() {
    el.className = el.className.split(" ").filter(c => !/^(tb-|pc-|pc3-|pecas-3d|sem-coords)/.test(c)).join(" ");
    el.classList.add(...classesVisual().split(" ").filter(Boolean));
    el.classList.toggle("sem-coords", VISUAL.coords === false);
  }
  // ---------------- barra de avaliação e ícone da classificação do lance (pedido do Alediov, 02/11/2026: "uma barra de
  // avaliação durante os treinos de aberturas… os indicadores do chess.com de dúvida, acerto, de melhor jogada")
  let barraAv = null, ultAv = null, seloEl = null, ultSelo = null;
  function pintarBarraAv() {
    if (!barraAv || !ultAv) return;
    const { cp = 0, mate = null, fim = null } = ultAv;
    let frac, txt;
    // partida terminada (tabuleiro de análise, 03/11/2026): "w" (brancas venceram), "b" ou "=" (empate)
    if (fim) { frac = fim === "w" ? 1 : fim === "b" ? 0 : 0.5; txt = fim === "w" ? "1-0" : fim === "b" ? "0-1" : "½"; }
    else if (mate != null && mate !== 0) { frac = mate > 0 ? 1 : 0; txt = `M${Math.abs(mate)}`; }
    else { frac = chanceBrancas(cp) / 100; const v = Math.abs(cp) / 100; txt = v >= 10 ? Math.round(v) + "" : v.toFixed(1).replace(".", ","); }
    barraAv.style.setProperty("--b", String(Math.max(0.03, Math.min(0.97, frac))));
    barraAv.classList.toggle("preta", orient === "b");
    const b = barraAv.querySelector("b");
    b.textContent = txt;
    b.className = frac >= 0.5 ? "br" : "pr"; // o número fica do lado de quem está melhor
    barraAv.title = `Avaliação: ${frac >= 0.5 ? "brancas" : "pretas"} ${txt}`;
  }
  function pintarSelo() {
    if (!seloEl) return;
    if (!ultSelo) { seloEl.innerHTML = ""; return; }
    const [x, y] = xy(ultSelo.casa), info = SELOS[ultSelo.tipo] || SELOS.livro;
    seloEl.innerHTML = `<i class="xz-selo ${ultSelo.tipo}" style="left:calc(${(x + 1) * 12.5}% - var(--tam-selo) * .8);top:calc(${y * 12.5}% - var(--tam-selo) * .2)" title="${info.nome}">${info.svg}</i>`;
  }
  coords();
  const api = {
    el, aplicar,
    posicao,
    /**
     * A barra de avaliação ao lado do tabuleiro: { cp } (centipeões, do lado das brancas) ou { mate } (+ brancas dão
     * mate, − pretas) ou { fim: "w" | "b" | "=" } (partida acabada). `false` tira a barra.
     */
    avaliacao(av) {
      if (av === false) { barraAv?.remove(); barraAv = null; ultAv = null; el.classList.remove("com-barra"); return; }
      if (!barraAv) { barraAv = document.createElement("div"); barraAv.className = "xz-barra-av"; barraAv.innerHTML = "<i></i><b></b>"; el.append(barraAv); el.classList.add("com-barra"); }
      if (av) { ultAv = av; pintarBarraAv(); }
    },
    /** O ícone da classificação no canto da casa do último lance (tipos de SELOS); null apaga. */
    selo(casa, tipo) {
      if (!seloEl) { seloEl = document.createElement("div"); seloEl.className = "xz-selos"; el.append(seloEl); }
      ultSelo = casa ? { casa, tipo } : null; pintarSelo();
    },
    virar(c) {
      orient = c || (orient === "w" ? "b" : "w"); coords();
      for (const e of pecasEl.querySelectorAll(".xz-p")) colocar(e, e.dataset.c);
      marcar(); desenharSetas(); desenharExtras(); pintarBarraAv(); pintarSelo();
    },
    get orientacao() { return orient; },
    /** Frente a frente: as peças de quem fica em cima viradas para ele. */
    frenteAFrente(b = true) { frente = b; el.classList.toggle("frente", b); for (const e of pecasEl.querySelectorAll(".xz-p")) colocar(e, e.dataset.c); },
    /** As setas do app: [{ de, para, cor, forma? }] (cor: "verde", "vermelha", "azul", "amarela", "arco" ou "#rrggbb";
     *  entre casas a um salto de cavalo, um "L" com a perna longa primeiro, a não ser que `forma` diga "curta" ou "reta"). */
    setas(l = []) { setas = l; desenharSetas(); },
    /** Marca casas: objeto { casa: "certo" | "errado" | "dica" | "explode" }. */
    marcas(m = {}) { marcas = new Map(Object.entries(m)); marcar(); },
    /** Peças que não são do jogo (o pato): { casa: "pato" }. */
    extras(m = {}) { extras = new Map(Object.entries(m)); desenharExtras(); },
    /** Neblina: as casas que não se veem. */
    neblina(l = []) { neblina = new Set(l); marcar(); },
    limparDesenhos() {
      if (temDesenhos()) anotarHist({ tudo: { setas: new Map(desenhos.setas), casas: new Map(desenhos.casas) } });
      desenhos.setas.clear(); desenhos.casas.clear(); marcar(); desenharSetas(); pintarBarra();
    },
    /** Desfaz a última anotação (ou a lixeira). Devolve false se não havia o que desfazer. */
    desfazerDesenho() {
      const h = historico.pop(); if (!h) return false;
      if (h.tudo) { desenhos.setas = h.tudo.setas; desenhos.casas = h.tudo.casas; }
      else if (h.antes) desenhos[h.mapa].set(h.k, h.antes); else desenhos[h.mapa].delete(h.k);
      marcar(); desenharSetas(); pintarBarra(); return true;
    },
    /** O lápis da barra (modo desenho): ligar, desligar ou saber. */
    desenho(b) { if (b != null) ligarDesenho(!!b); return modoDesenho; },
    /** A barra de anotações (para esconder ou mudar de lugar). */
    get barra() { return barra; },
    bloquear(b = true) { bloqueado = b; if (b) { fecharPromo(null); sel = null; marcar(); } },
    /** A escolha da promoção está aberta? (para o teste) */
    get promovendo() { return !!promo; },
    tremer() { el.classList.remove("treme"); void el.offsetWidth; el.classList.add("treme"); },
    /** Explosão (Atômico): um clarão nas casas. */
    explodir(casas) {
      for (const c of casas) { const m = document.createElement("i"); m.className = "explosao"; m.style.transform = pos(c); marcasEl.append(m); setTimeout(() => m.remove(), 700); }
    },
  };
  aplicar();
  vivos.add(api);
  return api;
}

/** A chance de vencer das brancas (0 a 100) pela avaliação em centipeões (a fórmula do lichess). */
export const chanceBrancas = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp)))) - 1);
// os ícones da classificação dos lances, nas cores do chess.com
const T = (t) => `<svg viewBox="0 0 24 24"><text x="12" y="16.6" text-anchor="middle" font-size="${t.length > 1 ? 12.5 : 15}" font-weight="900" font-family="system-ui, sans-serif" fill="#fff">${t}</text></svg>`;
export const SELOS = {
  brilhante: { nome: "Brilhante", curto: "!!", svg: T("!!") },
  otimo: { nome: "Ótimo", curto: "!", svg: T("!") },
  melhor: { nome: "Melhor", curto: "★", svg: '<svg viewBox="0 0 24 24"><path d="M12 4.2l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z" fill="#fff"/></svg>' },
  excelente: { nome: "Excelente", curto: "👍", svg: '<svg viewBox="0 0 24 24"><path d="M7 11v8H5v-8h2zm2 8V11l3.5-5.5c.9.1 1.5.8 1.4 1.7L13.5 10H18c1 0 1.7.9 1.5 1.9l-1.2 5.6c-.2.9-.9 1.5-1.8 1.5H9z" fill="#fff"/></svg>' },
  bom: { nome: "Bom", curto: "✓", svg: '<svg viewBox="0 0 24 24"><path d="M6.5 12.5l3.6 3.6L17.5 8.6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  livro: { nome: "Livro (teoria)", curto: "📖", svg: '<svg viewBox="0 0 24 24"><path d="M5 6.5c2.5-.9 4.7-.6 6.5.8v10.4c-1.8-1.2-4-1.5-6.5-.7V6.5zm14 0c-2.5-.9-4.7-.6-6.5.8v10.4c1.8-1.2 4-1.5 6.5-.7V6.5z" fill="#fff"/></svg>' },
  imprecisao: { nome: "Imprecisão", curto: "?!", svg: T("?!") },
  erro: { nome: "Erro", curto: "?", svg: T("?") },
  capivarada: { nome: "Capivarada", curto: "??", svg: T("??") },
};

export const PATO =`<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="86" rx="30" ry="6" fill="#000" opacity=".18"/><path d="M22 62 C20 44 34 38 46 42 C44 26 54 14 66 16 C78 18 82 30 76 40 L90 42 C88 50 80 52 72 50 C80 66 70 84 48 84 C30 84 22 74 22 62Z" fill="#FFD43B" stroke="#1B2340" stroke-width="4" stroke-linejoin="round"/><path d="M76 40 L92 41 C90 48 82 50 74 48Z" fill="#F08A3C" stroke="#1B2340" stroke-width="3" stroke-linejoin="round"/><circle cx="64" cy="30" r="4" fill="#1B2340"/><path d="M34 60 C42 66 52 64 58 58" stroke="#1B2340" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`;
