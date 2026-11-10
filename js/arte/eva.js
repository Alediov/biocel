// A Eva, companheira de rotina e estudos (plano em docs/plano-eva.md). Desenho próprio no kit da arte v2, a partir da
// versão "A" escolhida pelo Alediov em 04/11/2026: cabelo branco médio com a franja de lado volumosa, óculos redondos
// lilás, pele clara, olhos violeta e moletom lilás com capuz. Rosto numa superfície só, sem bochechas rosadas.
// eva({ humor }) → SVG 120×120 com a classe `h-<humor>` (as animações de cada humor ficam em arte.css, bloco "Eva").
// Humores em HUMORES. Partes que se mexem dentro de .vivo/.anima: cabeça, cabelo, olhar, piscar e, por humor, os
// emojis 3D (👋 💪 🎉 📖 ☕ ❓), o confete, o vapor, os pontinhos do pensamento e a boca que fala.
import { T, uid, vol, volE, volR, sombraDe, luzDe, faisca, estrela5, parte, brilho } from "./kit.js";

export const EVA = {
  pele: "#FDE5D4", cabelo: "#F5F4FA", olhos: "#8B5CF6", oculos: "#7C5CE0", moletom: "#A98BFA", capuz: "#9372F0",
  cordao: "#FFFFFF", fundo: "#ECE5FF", estrela: "#B79CFF",
};
export const HUMORES = ["normal", "feliz", "orgulhosa", "surpresa", "preocupada", "cobrando", "piscadinha", "dormindo", "pensativa",
  "rindo", "animada", "acenando", "determinada", "confusa", "saudade", "cansada", "estudando", "comemorando", "falando"];

const OL = 49, OR = 71, OY = 58;
const f = (n) => +n.toFixed(2);

// ---------- olhos ----------
function aberto(x, iris, { k = 1, dx = 0, dy = 0, lado = 1, estrela = false } = {}) {
  const rx = 4.4 * k, ry = 5.6 * k, ix = x + dx * 0.6, iy = OY + 0.7 * k + dy * 0.6;
  return `<ellipse cx="${x}" cy="${OY}" rx="${f(rx)}" ry="${f(ry)}" fill="${T}"/>`
    + `<ellipse cx="${f(ix)}" cy="${f(iy)}" rx="${f(rx * 0.72)}" ry="${f(ry * 0.7)}" fill="${iris}"/>`
    + `<ellipse cx="${f(ix)}" cy="${f(iy + 1.5 * k)}" rx="${f(rx * 0.5)}" ry="${f(ry * 0.32)}" fill="${luzDe(iris, 1.3)}" opacity=".8"/>`
    + `<ellipse cx="${f(ix)}" cy="${f(iy)}" rx="${f(rx * 0.34)}" ry="${f(ry * 0.36)}" fill="${T}"/>`
    + (estrela ? estrela5(f(ix + 1.2 * k), f(iy - 1.8 * k), 2.6 * k, "#fff", { contorno: 0, interno: 0.42 }) : `<circle cx="${f(ix + 1.5 * k)}" cy="${f(iy - 2.2 * k)}" r="${f(1.7 * k)}" fill="#fff"/>`)
    + `<circle cx="${f(ix - 1.4 * k)}" cy="${f(iy + 2.1 * k)}" r="${f(0.75 * k)}" fill="#fff" opacity=".9"/>`
    + `<path d="M${f(x + lado * (rx - 0.6))} ${f(OY - ry * 0.62)} l${2.4 * lado} -1.8" stroke="${T}" stroke-width="1.7" stroke-linecap="round"/>`;
}
const fechadoFeliz = (x) => `<path d="M${x - 4.8} ${OY + 1.4} Q${x} ${OY - 4.4} ${x + 4.8} ${OY + 1.4}" stroke="${T}" stroke-width="2.7" fill="none" stroke-linecap="round"/>`;
const fechadoSono = (x, lado) => `<path d="M${x - 4.6} ${OY} Q${x} ${OY + 3.8} ${x + 4.6} ${OY}" stroke="${T}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M${x + lado * 4.4} ${OY + 0.6} l${lado * 1.8} 1.2" stroke="${T}" stroke-width="1.5" stroke-linecap="round"/>`;
// pálpebra que corta o olho por cima (meio fechado, cansado ou desconfiado): `y` é a altura da pálpebra
function cortado(x, iris, y, { inclina = 0, lado = 1 } = {}) {
  const c = uid("ev"), y1 = y - inclina * lado, y2 = y + inclina * lado;
  const lid = `M${x - 6} ${f(y1)} L${x + 6} ${f(y2)}`;
  return `<clipPath id="${c}"><path d="${lid} L${x + 6} ${OY + 9} L${x - 6} ${OY + 9}Z"/></clipPath>`
    + `<g clip-path="url(#${c})">${aberto(x, iris, { lado })}</g>`
    + `<path d="M${x - 5} ${f(y1 + (y2 - y1) * 0.08)} L${x + 5} ${f(y2 - (y2 - y1) * 0.08)}" stroke="${T}" stroke-width="2.5" stroke-linecap="round"/>`;
}

function olhos(h, iris) {
  const par = (fn) => fn(OL, -1) + fn(OR, 1);
  let o;
  switch (h) {
    case "orgulhosa": case "feliz": o = h === "orgulhosa" ? par(fechadoFeliz) : par((x, s) => aberto(x, iris, { lado: s, dy: -0.4 })); break;
    case "surpresa": o = par((x, s) => aberto(x, iris, { k: 1.16, lado: s })); break;
    case "preocupada": o = par((x, s) => cortado(x, iris, OY - 2.4, { inclina: -1.6, lado: s })); break;
    case "cobrando": o = cortado(OL, iris, OY - 1, { lado: -1 }) + aberto(OR, iris, { lado: 1 }); break;
    case "piscadinha": o = aberto(OL, iris, { lado: -1 }) + fechadoFeliz(OR); break;
    case "dormindo": o = par(fechadoSono); break;
    case "pensativa": o = par((x, s) => aberto(x, iris, { lado: s, dx: 1.2, dy: -1.6 })); break;
    case "rindo": case "comemorando": o = par(fechadoFeliz); break;
    case "animada": o = par((x, s) => aberto(x, iris, { lado: s, k: 1.08, estrela: true })); break;
    case "acenando": case "falando": case "determinada": o = par((x, s) => aberto(x, iris, { lado: s })); break;
    case "confusa": o = aberto(OL, iris, { lado: -1, dx: -1.4 }) + cortado(OR, iris, OY - 1.4, { lado: 1, inclina: 0.8 }); break;
    case "saudade": case "estudando": o = par((x, s) => aberto(x, iris, { lado: s, dy: 2.2, dx: h === "saudade" ? -0.8 : 0 })); break;
    case "cansada": o = par((x, s) => cortado(x, iris, OY - 0.2, { lado: s })) + `<path d="M44.6 65.4 q4.4 1.6 8.8 0 M66.6 65.4 q4.4 1.6 8.8 0" stroke="#C9B8E8" stroke-width="1.4" fill="none" stroke-linecap="round"/>`; break;
    default: o = par((x, s) => aberto(x, iris, { lado: s }));
  }
  const pisca = !["orgulhosa", "dormindo", "piscadinha", "rindo", "comemorando"].includes(h);
  return parte("pa-olhar", 60, OY, `<g class="${pisca ? "olhos" : ""}">${o}</g>`);
}

// sobrancelhas finas, num lilás acinzentado (o cabelo é branco)
function sobrancelhas(h) {
  const cor = "#A79CC6", p = (d) => `<path d="${d}" stroke="${cor}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
  switch (h) {
    case "surpresa": return p("M43.5 46.4 Q49 42 54.5 45.4 M65.5 45.4 Q71 42 76.5 46.4");
    case "preocupada": return p("M44 49.6 Q49 48.6 54 46.4 M66 46.4 Q71 48.6 76 49.6");
    case "cobrando": return p("M44 50.6 Q49 50 54.4 51 M65.6 46.6 Q71 42.6 76.4 46");
    case "pensativa": return p("M44 49.6 Q49 47.4 54 49 M66 47.4 Q71 45 76 47.6");
    case "dormindo": return p("M44.4 51.4 Q49 50 53.6 51.4 M66.4 51.4 Q71 50 75.6 51.4");
    case "rindo": case "comemorando": case "animada": case "acenando": return p("M43.6 47.6 Q49 44.6 54.4 47.4 M65.6 47.4 Q71 44.6 76.4 47.6");
    case "determinada": return p("M44 47.4 Q49 48.6 54.6 50.8 M65.4 50.8 Q71 48.6 76 47.4");
    case "confusa": return p("M43.6 46.4 Q49 43 54.4 46 M65.6 50.4 Q71 50 76.4 50.8");
    case "saudade": return p("M44 49.4 Q49 48.6 54 46.8 M66 46.8 Q71 48.6 76 49.4");
    case "cansada": return p("M44.4 50.8 Q49 49.8 53.6 50.6 M66.4 50.6 Q71 49.8 75.6 50.8");
    default: return p("M44 49.4 Q49 46.8 54 49 M66 49 Q71 46.8 76 49.4");
  }
}

function boca(h) {
  const T2 = `stroke="${T}" stroke-width="2.6" fill="none" stroke-linecap="round"`;
  const aberta = (larg = 8.5, fundo = 79) => `<path d="M${60 - larg} 69.8 Q60 ${fundo} ${60 + larg} 69.8 Q60 71.6 ${60 - larg} 69.8Z" fill="${T}" stroke="${T}" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<path d="M${60 - larg * 0.5} ${fundo - 4.4} Q60 ${fundo - 1.6} ${60 + larg * 0.5} ${fundo - 4.4} Q60 ${fundo - 6.4} ${60 - larg * 0.5} ${fundo - 4.4}Z" fill="#FF8FA3"/>`;
  switch (h) {
    case "feliz": return aberta(8.4, 78.6);
    case "orgulhosa": return aberta(9.4, 80);
    case "surpresa": return `<ellipse cx="60" cy="73" rx="3.6" ry="4.4" fill="${T}"/><ellipse cx="60" cy="75.4" rx="2.2" ry="1.3" fill="#FF8FA3"/>`;
    case "preocupada": return `<path d="M54 74.6 Q57 72 60 73.4 Q63 72 66 74.6" ${T2}/>`;
    case "cobrando": return `<path d="M54 72.4 Q60 72.8 65 70.6" ${T2}/>`;
    case "piscadinha": return `<path d="M52.6 70 Q60 77.6 67.4 70" ${T2}/><path d="M64.6 73.4 q2.2 2.4 0.2 4.4 q-1.8 -1.6 -0.2 -4.4Z" fill="#FF8FA3" stroke="${T}" stroke-width="1.2"/>`;
    case "dormindo": return `<ellipse cx="60" cy="73.2" rx="2.2" ry="1.8" fill="${T}"/>`;
    case "pensativa": return `<path d="M56 73 Q60 71.6 64.6 72.6" ${T2}/>`;
    case "rindo": case "comemorando": return aberta(10, 81.4);
    case "animada": return aberta(9, 80);
    case "acenando": return aberta(7.4, 77.4);
    case "determinada": return `<path d="M54 71.2 Q60 74.8 66 71.2" ${T2}/><path d="M64.6 70.4 l2.4 -1" ${T2}/>`;
    case "confusa": return `<path d="M53.6 72.8 q2.2 -2 4.4 0 q2.2 2 4.4 0 q2.2 -2 4.4 0" ${T2}/>`;
    case "saudade": return `<path d="M55 72 Q60 74.4 65 72" ${T2}/>`;
    case "cansada": return `<path d="M55.4 73.4 Q60 71.8 64.6 73.4" ${T2}/>`;
    case "estudando": return `<path d="M56.4 72.6 Q60 73.8 63.6 72.6" ${T2}/>`;
    case "falando": return `<g class="eva-boca-a">${aberta(6.4, 77)}</g><g class="eva-boca-b"><path d="M53.4 70.6 Q60 76 66.6 70.6" ${T2}/></g>`;
    default: return `<path d="M53 70.4 Q60 76.6 67 70.4" ${T2}/>`;
  }
}

// ---------- cabelo ----------
// atrás: médio, até os ombros, com as pontas em camadas
const CABELO_TRAS = "M31 50 C26.4 66 27 80 29.6 91.6 L33.6 87.4 L36.4 93.6 L40.6 88.6 L44 91 L76 91 L79.4 88.6 L83.6 93.6 L86.4 87.4 L90.4 91.6 C93 80 93.6 66 89 50 Z";
// a cabeça de cabelo (cheia, passa um pouco da cabeça) e a mecha da franja de lado, que cai até o olho esquerdo
// a mecha que cai sobre a orelha direita faz parte da mesma forma (antes era um pedaço solto, 04/11/2026)
const FRENTE = "M31 64 C25 36 42 16.5 61 17 C81 17.5 97 31 89 64 C88.6 67 87.2 70 85.4 72 C84.6 63 83 54.4 79.6 46.8 C77.2 41.4 72 37.8 66 36.4 C62.4 35.6 59 35.6 56 36 C46 38 38 45 33.5 53 C32.2 57 31.4 60.5 31 64Z";
const MECHA = "M83 27 C69 28 55 34 45 42.6 C38.6 48 35 54 34.2 61.6 C37.4 57 41 52.8 46.4 50 C53.4 46.6 61 45.6 67.8 43.4 C75 41 80.4 36 83 27Z";
const FIOS = "M76 31.6 C66 33.6 55 38.6 47 45.6 M79.6 35.4 C70.4 39 60.4 41.8 52 46.4 M70 20.6 C60 22.6 49 28.6 41 38 M86 38 C88 44 89 50 89 56";
// presilha de estrela lilás (o céu do Órbita)
const presilha = (cor) => `${estrela5(80.4, 35.4, 5.4, cor, { contorno: 1.8 })}<circle cx="79" cy="33.6" r="1.1" fill="#fff" opacity=".85"/>`;

function oculos(cor) {
  const lente = (x) => `<circle cx="${x}" cy="58" r="8.2" fill="#E8DEFF" fill-opacity=".22" stroke="${cor}" stroke-width="2.4"/><path d="M${x + 2.4} ${52.6} q3.6 1.6 4.6 5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".75"/>`;
  return `<g>${lente(49)}${lente(71)}<path d="M57.2 57 Q60 54.8 62.8 57 M40.8 56 h-5.6 M79.2 56 h5.6" stroke="${cor}" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`;
}

// ---------- emojis (ícones 3D do app, app/icones/) que completam a reação; as mãos desenhadas saíram (04/11/2026) ----------
const emoji = (slug, x, y, t = 24, classe = "eva-emoji") => `<g class="${classe}" style="transform-origin:${x}px ${y}px"><image href="icones/${slug}.png" x="${x - t / 2}" y="${y - t / 2}" width="${t}" height="${t}"/></g>`;
const CONFETE = ["#FFE08A", "#7FD6F5", "#F07BB0", "#8CE0B0", "#B79CFF"];
const confete = () => [[18, 22], [32, 12], [92, 14], [104, 30], [12, 46], [108, 50], [26, 34], [86, 6]].map(([x, y], i) =>
  `<g class="pa pa-cai" style="transform-origin:${x}px ${y}px;--pd:${(i * 0.45).toFixed(2)}s"><rect x="${x - 2}" y="${y - 1.2}" width="4" height="2.4" rx=".6" fill="${CONFETE[i % 5]}" transform="rotate(${i * 37} ${x} ${y})"/></g>`).join("");
const pontos = () => [99.4, 103, 106.6].map((x, i) => `<circle class="eva-ponto" style="--pd:${i * 0.22}s" cx="${x}" cy="17" r="1.25" fill="${T}"/>`).join("");

// ---------- extras do humor (atrás do corpo: `fundo`; na frente: `frente`) ----------
function extrasDoHumor(h, c) {
  const nada = { fundo: "", frente: "" };
  switch (h) {
    case "orgulhosa": return { fundo: "", frente: faisca(24, 30, 3.6, "#FFE08A", 0) + faisca(98, 26, 3, "#FFE08A", 0.7) + faisca(102, 56, 2.4, "#B79CFF", 1.3) };
    case "animada": return { fundo: "", frente: faisca(20, 38, 3.2, "#FFE08A", 0) + faisca(100, 30, 3.6, "#B79CFF", 0.5) + faisca(104, 64, 2.6, "#FFE08A", 1) + faisca(16, 70, 2.2, "#7FD6F5", 1.4) };
    case "dormindo": return { fundo: "", frente: [["z", 88, 30, 7, 0], ["z", 96, 21, 5.6, 0.5], ["z", 102, 13, 4.4, 1]].map(([t, x, y, s, a]) =>
      `<g class="pa pa-sobe" style="transform-origin:${x}px ${y}px;--pd:${a}s"><text x="${x}" y="${y}" font-size="${s * 1.6}" font-weight="800" fill="#7C5CE0" font-family="system-ui,sans-serif">${t}</text></g>`).join("") };
    case "preocupada": return { fundo: "", frente: `<g class="eva-gota"><path d="M86 46 q2.6 4.4 0 7 q-2.6 -2.6 0 -7Z" fill="#8FD3FA" stroke="${T}" stroke-width="1.1"/></g>` };
    case "cobrando": return { fundo: "", frente: `<g class="pa pa-balanca" style="transform-origin:94px 30px"><g transform="translate(94 22)">${volR(-6, -8, 12, 16, 4, "#FFE08A", { k: 0.6, contorno: 1.8 })}<path d="M0 -4.4 v5.6" stroke="${T}" stroke-width="2.6" stroke-linecap="round"/><circle cx="0" cy="4.6" r="1.4" fill="${T}"/></g></g>` };
    case "pensativa": return { fundo: "", frente: `<circle cx="90" cy="36" r="2" fill="#fff" stroke="${T}" stroke-width="1.2"/><circle cx="95" cy="28" r="3" fill="#fff" stroke="${T}" stroke-width="1.2"/>${volE(103, 17, 8, 6.4, "#FFFFFF", { k: 0.6, contorno: 1.4 })}${pontos()}` };
    case "confusa": return { fundo: "", frente: emoji("red-question-mark", 98, 24, 20, "eva-emoji eva-balanca") };
    case "rindo": return { fundo: "", frente: `<g class="eva-ri"><path d="M24 46 q-4 4 -2 9 M20 42 q-5 5 -3 12 M96 46 q4 4 2 9 M100 42 q5 5 3 12" stroke="#B79CFF" stroke-width="2" fill="none" stroke-linecap="round"/></g>` };
    case "acenando": return { fundo: "", frente: emoji("waving-hand", 99, 78, 26, "eva-emoji eva-aceno") };
    case "determinada": return { fundo: "", frente: emoji("flexed-biceps", 99, 80, 26, "eva-emoji eva-soco") + faisca(110, 64, 2.6, "#FFE08A", 0.3) };
    case "comemorando": return { fundo: confete(), frente: emoji("party-popper", 20, 24, 24, "eva-emoji eva-viva") + emoji("partying-face", 101, 22, 18, "eva-emoji eva-viva dir") };
    case "estudando": return { fundo: "", frente: emoji("open-book", 60, 108, 28, "eva-emoji eva-livro") };
    case "cansada": return { fundo: "", frente: emoji("hot-beverage", 98, 98, 24, "eva-emoji") + [0, 0.9].map((a, i) => `<g class="pa pa-sobe" style="transform-origin:${95 + i * 6}px 84px;--pd:${a}s"><path d="M${95 + i * 6} 86 q-2 -3 0 -6 q2 -3 0 -6" stroke="#C9B8E8" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`).join("") };
    default: return nada;
  }
}

// ---------- corpo: moletom com capuz e o planetinha do Órbita no peito ----------
function moletom(c) {
  const tronco = vol("M16 121 C18 96 38 86 60 86 C82 86 102 96 104 121Z", c.moletom, { k: 4, contorno: 2.6 });
  const capuz = vol("M34 100 C30.6 90 42 83.6 52 84 L68 84 C78 83.6 89.4 90 86 100 C80 95.6 70 94.6 60 94.6 C50 94.6 40 95.6 34 100Z", c.capuz, { k: 1.6, contorno: 2.4 });
  const gola = vol("M41.6 93.8 C45.6 103.4 74.4 103.4 78.4 93.8 C72.4 97.6 47.6 97.6 41.6 93.8Z", sombraDe(c.moletom, 0.8), { k: 1.2, contorno: 2 });
  const cordao = (x, y2) => `<path d="M${x} 99.6 Q${x + (x < 60 ? -1 : 1)} ${(99.6 + y2) / 2} ${x} ${y2}" stroke="${c.cordao}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="${x}" cy="${y2 + 1}" r="1.7" fill="${c.cordao}"/>`;
  const planeta = `<g transform="translate(78 109)"><ellipse rx="6.2" ry="1.8" fill="none" stroke="#FFE08A" stroke-width="1.6" transform="rotate(-18)"/><circle r="3.6" fill="#fff" stroke="${T}" stroke-width="1.4"/><path d="M-5.8 1.2 Q0 3.2 5.8 -2.6" stroke="#FFE08A" stroke-width="1.6" fill="none" transform="rotate(0)"/></g>`;
  // o corpo sobe 5,4 (o pescoço fica curto): o capuz atrás, o tronco, depois o pescoço (eva) e por cima a gola
  const sobe = (x) => `<g transform="translate(0 -5.4)">${x}</g>`;
  return { capuz: sobe(capuz), tronco, frente: sobe(gola + cordao(54, 110.8) + cordao(66, 112) + planeta) + `<path d="M42 119 Q60 116.4 78 119" stroke="${T}" stroke-width="1.4" fill="none" opacity=".25"/>` };
}

/** Desenha a Eva. o: { humor, semFundo, classe, cores, capuz } (cores sobrepõe EVA, para variações e testes). */
export function eva({ humor = "normal", semFundo = false, classe = "", cores = {}, capuz = true } = {}) {
  const c = { ...EVA, ...cores }, h = HUMORES.includes(humor) ? humor : "normal";
  const sombraPele = sombraDe(c.pele, 0.8);
  const tras = parte("pa-cabelo", 60, 40, vol(CABELO_TRAS, c.cabelo, { k: 4, contorno: 2.6 }));
  const roupa = moletom(c);
  const pescoco = vol("M52.4 70 h15.2 v23 q-7.6 3 -15.2 0z", c.pele, { k: 0, contorno: 2.4 }) + `<path d="M52.6 81 Q60 87.4 67.4 81 L67.4 77 L52.6 77Z" fill="${sombraPele}"/>`;
  const idCab = uid("ev"), clip = `<clipPath id="${idCab}"><ellipse cx="60" cy="57" rx="23" ry="25"/></clipPath>`;
  const sombraTesta = `${clip}<g clip-path="url(#${idCab})"><path d="${FRENTE}" fill="${sombraPele}" transform="translate(-1.2 2.8)"/><path d="${MECHA}" fill="${sombraPele}" transform="translate(-0.8 2.6)"/></g>`;
  const corFio = sombraDe(c.cabelo, 1.4);
  const frente = vol(FRENTE, c.cabelo, { k: 3, contorno: 2.6 }) + vol(MECHA, c.cabelo, { k: 2.2, contorno: 2.4 })
    + `<path d="${FIOS}" stroke="${corFio}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".8"/>`
    + brilho("M68 22.6 Q78 24.6 84 31", 2.6, 0.55);
  const cabeca = parte("pa-cabeca", 60, 88, `
    ${volE(36.4, 60, 5.4, 6.2, c.pele, { k: 1.4, contorno: 2.4, sombra: sombraPele })}${volE(83.6, 60, 5.4, 6.2, c.pele, { k: 1.4, contorno: 2.4, sombra: sombraPele })}
    ${vol("M36 52 C36 36 47 31 60 31 C73 31 84 36 84 52 C84 70 74 82.6 60 82.6 C46 82.6 36 70 36 52Z", c.pele, { k: 3, contorno: 2.8, sombra: sombraPele })}
    <path d="M60.4 62 q-2.2 3.4 0.8 4.4" stroke="${sombraDe(c.pele, 1.4)}" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${olhos(h, c.olhos)}${sobrancelhas(h)}${boca(h)}
    ${sombraTesta}${oculos(c.oculos)}${frente}
    ${presilha(c.estrela)}`);
  const ex = extrasDoHumor(h, c);
  const fundo = semFundo ? "" : `<circle cx="60" cy="60" r="60" fill="${c.fundo}"/><circle cx="60" cy="54" r="38" fill="${luzDe(c.fundo, 1.4)}" opacity=".55"/>${faisca(18, 40, 2.4, "#FFFFFF", 0.3)}${faisca(102, 74, 2, "#FFFFFF", 1.4)}`;
  return `<svg class="humano eva h-${h} ${classe}" viewBox="0 0 120 120" role="img" aria-label="Eva">${fundo}${ex.fundo}<g class="eva-corpo">${tras}${capuz ? roupa.capuz : ""}${roupa.tronco}${pescoco}${roupa.frente}${cabeca}${ex.frente}</g></svg>`;
}
