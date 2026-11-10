// Personagens humanos em SVG, montados por partes: o avatar do Perfil e as cartas de gente (e de fantasia).
// Guia v2 (26/10/2026, arte/kit.js): contorno na cabeça, no cabelo e na roupa, volume em dois tons, olhos com íris e
// dois brilhos, e partes que se mexem quando o desenho está .vivo: a cabeça balança de leve (o cabelo de trás vai
// junto e ainda balança sozinho), os olhos piscam e olham para os lados, e os chapéus e extras têm as suas partes
// (hélice, pompom, orelhas de coelho, borla do capelo, plumas, asas, varinha…). Os degradês têm ids próprios em cada
// desenho (a mesma pessoa aparece várias vezes numa tela, e um id repetido some quando o 1º desenho está escondido).
import { T, uid, traco, vol, volE, volR, volU, circulos, pRet, sombraDe, luzDe, faisca, estrela5, parte, brilho, luzinha, tubo } from "./kit.js";

export const PELES = { p1: "#FDE3CF", p2: "#F6CBA7", p3: "#E6A97C", p4: "#C88654", p5: "#9A6038", p6: "#6B3F24" };
export const CORES_CABELO = {
  preto: "#1E1A1A", castanho: "#5A3521", mel: "#9A6233", loiro: "#E8C163", ruivo: "#C2502A", grisalho: "#B9BCC4",
  rosa: "#F07BB0", azul: "#3F7FE0", roxo: "#8B5CF6", verde: "#2FA37A", branco: "#F4F2EE",
  arcoiris: "url(#arco)",
};
export const CORES_OLHOS = { castanho: "#5A3521", preto: "#1E1A1A", verde: "#2F8F5B", azul: "#2F6BD9", mel: "#B27A2A", violeta: "#8B5CF6", rubi: "#D03A55" };
export const FUNDOS = { azul: "#DCE8FF", rosa: "#FFE1EC", menta: "#DDF6E8", areia: "#FFF1D6", lilas: "#ECE5FF", cinza: "#E9ECF2", dentinhos: "#DDF3EE", noite: "#1F2547", aurora: "url(#fundo-aurora)", por_do_sol: "url(#fundo-por-do-sol)", galaxia: "url(#fundo-galaxia)" };
export const ROUPAS_COR = { branco: "#FFFFFF", azul: "#3F7FE0", verde: "#2FA37A", vinho: "#8E2C48", rosa: "#F07BB0", preto: "#2A2F45", lilas: "#A78BFA", dourado: "url(#ouro)" };

function escurece(hex, f = 0.82) {
  if (!hex.startsWith("#")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * f));
  return `#${c.map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------- degradês (ids próprios a cada desenho) ----------
const GRADS = {
  arco: (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F07BB0"/><stop offset=".35" stop-color="#FFE08A"/><stop offset=".65" stop-color="#7FD6F5"/><stop offset="1" stop-color="#A78BFA"/></linearGradient>`,
  ouro: (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE7A3"/><stop offset="1" stop-color="#E09A12"/></linearGradient>`,
  "fundo-aurora": (id) => `<radialGradient id="${id}" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#FFE1EC"/><stop offset=".5" stop-color="#DCE8FF"/><stop offset="1" stop-color="#C9F2E3"/></radialGradient>`,
  "fundo-galaxia": (id) => `<radialGradient id="${id}" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#6B4FD8"/><stop offset=".6" stop-color="#2A2466"/><stop offset="1" stop-color="#121535"/></radialGradient>`,
  "fundo-por-do-sol": (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD27A"/><stop offset=".5" stop-color="#FF9E9E"/><stop offset="1" stop-color="#B58BF0"/></linearGradient>`,
};
function tintas() {
  const usados = {};
  const cor = (c) => { const m = /^url\(#([\w-]+)\)$/.exec(c || ""); if (!m || !GRADS[m[1]]) return c; usados[m[1]] ??= uid("g"); return `url(#${usados[m[1]]})`; };
  const defs = () => { const ks = Object.keys(usados); return ks.length ? `<defs>${ks.map(k => GRADS[k](usados[k])).join("")}</defs>` : ""; };
  return { cor, defs };
}

// ---------- cabelo: { tras, frente, brilho } (caminhos; o desenho põe volume e contorno) ----------
const FRENTE_COQUE = "M35 55 C32 32 48 25 61 25 C76 25 89 33 85 55 C82 44 72 36 60 36 C48 36 39 44 35 55Z";
const tranca = (x0, x1) => Array.from({ length: 6 }, (_, i) => { const t = i / 5; return [x0 + (x1 - x0) * t, 60 + i * 8.6, 5.6, 6]; });
// franja de lado volumosa: a cabeça de cabelo cheia (passa um pouco da cabeça) e a mecha que cai na testa, por cima
const FRENTE_LATERAL = "M31 64 C25 36 42 17 61 17.5 C81 18 97 31 89 64 C88.5 56 87 49 84 44 C77 36.5 66 34.5 56 36 C46 38 38 45 33.5 53 C32.2 57 31.4 60.5 31 64Z";
const MECHA_LATERAL = "M82 28 C69 29 55 35 45 43 C39 48 35.5 53.5 34.6 60.5 C37.5 56.5 41 52.6 46 50 C53 46.6 61 46 67.5 43.6 C74.5 41 79.5 36.5 82 28Z";
const FIOS_LATERAL = "M76 32 C66 34 55 39 47 46 M79 35.5 C70 39 60 42 52 46.4 M70 21 C60 23 49 29 41 38";
const FRANJA_RETA = "M33 62 C29 31 48 21 61 22 C78 22 93 33 87 62 C86.5 55 85.6 50 84.6 45.5 Q82.5 42.8 80 46.6 Q77.6 43 74.8 47 Q72 43.2 69 47.2 Q66 43.4 63 47.2 Q60 43.4 57 47.2 Q54 43.4 51 47.2 Q48 43.2 45.2 47 Q42.4 43 40 46.6 Q37.6 42.8 35.4 45.5 C34.3 50 33.6 55 33 62Z";
const FIOS_RETA = "M47 26 Q45.5 35 48.5 44.6 M60 24 Q59.4 34 60 44.8 M73 26 Q74.5 35 71.6 44.6";
const CABELOS = {
  curto: { frente: "M35 55 C31 31 48 22 61 23 C77 23 90 34 85 56 C81 45 72 38 59 39 C48 40 40 46 35 55Z", brilho: "M66 28 Q77 31 81 41" },
  medio: { tras: "M33 52 C30 72 32 86 38 92 L82 92 C88 86 90 72 87 52 Z", frente: "M34 58 C30 32 48 22 61 23 C78 23 92 34 86 60 C84 50 80 44 74 41 C70 47 60 49 48 45 C42 48 37 52 34 58Z", brilho: "M67 28 Q78 31 83 43", balanca: true },
  longo: { tras: "M32 50 C26 80 28 104 34 114 L86 114 C92 104 94 80 88 50 Z", frente: "M34 60 C30 32 48 22 61 23 C78 23 92 34 86 60 C82 46 72 40 62 37 C58 44 48 48 38 50 C36 53 35 56 34 60Z", brilho: "M67 28 Q78 31 83 43", balanca: true },
  longo_ondulado: { tras: "M32 48 C22 70 30 84 26 98 C30 108 36 114 44 114 L76 114 C84 114 90 108 94 98 C90 84 98 70 88 48 Z", frente: "M34 60 C28 30 50 20 64 24 C80 26 94 40 86 62 C82 50 74 42 64 40 C58 46 44 50 34 60Z", brilho: "M68 28 Q79 32 84 44", balanca: true },
  franja: { tras: "M31 52 C28 70 30 84 36 90 L84 90 C90 84 92 70 89 52 Z", frente: "M33 56 C30 30 48 22 61 23 C78 23 92 32 87 56 L87 49 L33 49 Z", brilho: "M66 28 Q78 30 83 40", balanca: true },
  cacheado: { frenteU: [[38, 44, 9], [42, 34, 9], [50, 27, 9], [60, 24, 9], [70, 27, 9], [78, 34, 9], [82, 44, 9], [86, 54, 8], [34, 54, 8]], cachos: true },
  afro: { trasU: [[60, 40, 30], [34, 52, 13], [86, 52, 13], [39, 25, 13], [81, 25, 13], [60, 15, 13], [28, 39, 11], [92, 39, 11]], frente: "M36 50 C36 34 48 28 60 28 C72 28 84 34 84 50 C78 42 70 39 60 39 C50 39 42 42 36 50Z", cachos: true },
  ondulado: { frente: "M34 56 C30 36 42 24 56 24 C60 20 70 21 74 25 C84 28 90 40 86 56 C84 50 82 46 78 44 C76 48 70 48 68 44 C64 48 58 48 56 44 C52 48 46 48 44 44 C40 46 36 50 34 56Z", brilho: "M70 28 Q79 31 82 39" },
  coque: { trasE: [[60, 20, 11]], frente: FRENTE_COQUE, brilho: "M67 30 Q77 33 81 42" },
  rabo: { tras: "M80 40 C100 46 102 74 92 92 C88 80 86 66 80 56 Z", frente: FRENTE_COQUE, brilho: "M67 30 Q77 33 81 42", balanca: true },
  trancas: { trasU: [...tranca(38, 40), ...tranca(82, 80)], frente: "M35 56 C32 32 48 24 61 24 C76 24 89 33 85 56 C82 45 72 37 60 37 C48 37 39 45 35 56Z", risca: true, lacos: true, balanca: true },
  coquinhos: { trasE: [[38, 26, 10], [82, 26, 10]], frente: FRENTE_COQUE, brilho: "M67 30 Q77 33 81 42" },
  moicano: { frente: "M52 44 C50 26 56 12 60 10 C64 12 70 26 68 44 C64 40 56 40 52 44Z", lados: "M38 52 C38 40 44 34 50 32 L50 40 C44 42 40 46 38 52Z M82 52 C82 40 76 34 70 32 L70 40 C76 42 80 46 82 52Z" },
  raspado: { raspado: "M36 50 C36 32 50 26 60 26 C72 26 84 32 84 50 C78 42 70 38 60 38 C50 38 42 42 36 50Z" },
  careca: { careca: true },
  // com franja (desenhados para a Eva, 04/11/2026; fora do catálogo do avatar): `fios` são as divisões das mechas
  lateral_medio: { tras: "M30 50 C25 72 28 92 35 100 L85 100 C92 92 95 72 90 50 Z", frente: FRENTE_LATERAL, mecha: MECHA_LATERAL, fios: FIOS_LATERAL, brilho: "M71 25 Q80 28 84 35", balanca: true },
  lateral_longo: { tras: "M30 50 C24 80 27 104 33 114 L87 114 C93 104 96 80 90 50 Z", frente: FRENTE_LATERAL, mecha: MECHA_LATERAL, fios: FIOS_LATERAL, brilho: "M71 25 Q80 28 84 35", balanca: true },
  lateral_ondulado: { tras: "M31 48 C21 70 29 84 25 98 C29 108 35 114 43 114 L77 114 C85 114 91 108 95 98 C91 84 99 70 89 48 Z", frente: FRENTE_LATERAL, mecha: MECHA_LATERAL, fios: FIOS_LATERAL, brilho: "M71 25 Q80 28 84 35", balanca: true },
  franja_reta: { tras: "M32 50 C26 80 28 104 34 114 L86 114 C92 104 94 80 88 50 Z", frente: FRANJA_RETA, fios: FIOS_RETA, brilho: "M67 27 Q77 29 82 35", balanca: true },
  franja_cortina: { tras: "M32 48 C22 70 30 84 26 98 C30 108 36 114 44 114 L76 114 C84 114 90 108 94 98 C90 84 98 70 88 48 Z", frente: "M33 64 C29 31 48 21 61 22 C78 22 93 33 87 64 C86 55 84 47 77 43 C70 40 64 37 61 31 C57 37 51 40 44 43 C37 47 34 55 33 64Z", fios: "M61 31 Q66 38 76 42 M61 31 Q56 38 46 42 M73 27 Q80 33 83 44 M49 27 Q42 33 38 44", brilho: "M68 26 Q76 28 80 33", balanca: true },
  franja_lateral: { tras: "M33 52 C30 72 32 86 38 92 L82 92 C88 86 90 72 87 52 Z", frente: "M33 62 C29 31 48 21 61 22 C78 22 93 33 87 62 C86 55 85 49 83 45 C76 41 67 39 58 41.5 C50 44 43 48 37 50.5 C35 54 33.8 58 33 62Z", fios: "M78 27 Q70 34 58 41.5 M70 24 Q60 31 46 46 M83 33 Q78 37 70 40", brilho: "M70 26 Q78 28 82 33", balanca: true },
  franja_coque: { trasE: [[60, 18, 10]], frente: FRANJA_RETA, fios: FIOS_RETA, brilho: "M67 27 Q77 29 82 35", balanca: true },
};
export const ESTILOS_CABELO = {
  curto: "Curto", medio: "Médio", longo: "Longo liso", longo_ondulado: "Longo ondulado", franja: "Chanel com franja", cacheado: "Cacheado",
  afro: "Black power", ondulado: "Curto ondulado", coque: "Coque", rabo: "Rabo de cavalo", trancas: "Tranças", coquinhos: "Dois coquinhos",
  moicano: "Moicano", raspado: "Raspado", careca: "Careca",
};

// ---------- olhos ----------
const OL = 49, OR = 71, OY = 58;
function olhoAberto(x, iris, k = 1) {
  const rx = 4.3 * k, ry = 5.4 * k, f = (n) => +n.toFixed(2);
  return `<ellipse cx="${x}" cy="${OY}" rx="${f(rx)}" ry="${f(ry)}" fill="${T}"/><ellipse cx="${x}" cy="${f(OY + 0.7 * k)}" rx="${f(rx * 0.7)}" ry="${f(ry * 0.68)}" fill="${iris}"/><ellipse cx="${x}" cy="${f(OY + 1 * k)}" rx="${f(rx * 0.36)}" ry="${f(ry * 0.38)}" fill="${T}"/><circle cx="${f(x + 1.5 * k)}" cy="${f(OY - 2 * k)}" r="${f(1.65 * k)}" fill="#fff"/><circle cx="${f(x - 1.4 * k)}" cy="${f(OY + 2.2 * k)}" r="${f(0.75 * k)}" fill="#fff" opacity=".85"/>`;
}
const arquinho = (x) => `<path d="M${x - 4.8} ${OY + 1.2} q4.8 -5.4 9.6 0" stroke="${T}" stroke-width="2.7" fill="none" stroke-linecap="round"/>`;
function olhoTriste(x, iris, fora) {
  const c = uid("p"), ya = OY - 2.6, yb = OY - 0.2;
  const lid = `M${x - 5.6} ${fora < 0 ? yb : ya}L${x + 5.6} ${fora < 0 ? ya : yb}`;
  return `<clipPath id="${c}"><path d="${lid}L${x + 6} ${OY + 8}L${x - 6} ${OY + 8}Z"/></clipPath><g clip-path="url(#${c})"><ellipse cx="${x}" cy="${OY + 0.6}" rx="4.2" ry="5" fill="${T}"/><ellipse cx="${x}" cy="${OY + 1.4}" rx="2.9" ry="3.3" fill="${iris}"/><ellipse cx="${x}" cy="${OY + 1.6}" rx="1.5" ry="1.8" fill="${T}"/><circle cx="${x + 1.4}" cy="${OY - 0.2}" r="1.2" fill="#fff"/></g><path d="${lid}" stroke="${T}" stroke-width="2.3" stroke-linecap="round"/>`;
}
function olhos(tipo, cor, humor) {
  const t = humor === "triste" ? "triste" : humor === "uau" ? "grandes" : humor === "feliz" && tipo === "serio" ? "normal" : tipo;
  const par = (fn) => fn(OL, -1) + fn(OR, 1);
  let o;
  switch (t) {
    case "felizes": o = par(arquinho); break;
    case "grandes": o = par(x => olhoAberto(x, cor, 1.2)); break;
    case "cilios": o = par((x, s) => olhoAberto(x, cor) + `<path d="M${x + s * 3.6} ${OY - 4} l${s * 2.8} -2.4 M${x + s * 4.4} ${OY - 1.2} l${s * 3.2} -0.8" stroke="${T}" stroke-width="1.7" stroke-linecap="round"/>`); break;
    case "serio": o = par(x => { const c = uid("p"); return `<clipPath id="${c}"><rect x="${x - 6}" y="${OY - 1.6}" width="12" height="9"/></clipPath><g clip-path="url(#${c})">${olhoAberto(x, cor)}</g><path d="M${x - 5} ${OY - 1.6} h10" stroke="${T}" stroke-width="2.4" stroke-linecap="round"/>`; }); break;
    case "piscando": o = olhoAberto(OL, cor) + arquinho(OR); break;
    case "triste": o = par((x, s) => olhoTriste(x, cor, s)) + `<path d="M${OR + 5} ${OY + 4.6}q2.4 4 0 6.4q-2.4 -2.4 0 -6.4Z" fill="#8FD3FA" stroke="${T}" stroke-width="1.1"/><circle cx="${OR + 4.6}" cy="${OY + 9}" r=".8" fill="#fff"/>`; break;
    default: o = par(x => olhoAberto(x, cor));
  }
  // os olhos olham para os lados (pa-olhar) e piscam (.olhos, estilo.css)
  return parte("pa-olhar", 60, OY, `<g class="olhos">${o}</g>`);
}
export const TIPOS_OLHOS = { normal: "Normais", grandes: "Grandes e brilhantes", cilios: "Com cílios", felizes: "Sorridentes", piscando: "Piscadinha", serio: "Sério" };

function sobrancelhas(tipo, cor, humor) {
  const w = tipo === "grossa" ? 3.6 : 2.5;
  const p = (d, ww = w) => `<path d="${d}" stroke="${cor}" stroke-width="${ww}" fill="none" stroke-linecap="round"/>`;
  if (humor === "triste") return p("M44 50.5 L54 47.6 M66 47.6 L76 50.5", w);
  if (humor === "uau") return p("M43.5 47 Q49 42.5 54.5 46 M65.5 46 Q71 42.5 76.5 47", w);
  if (tipo === "arqueada") return p("M43 51 Q49 46 55 50 M65 50 Q71 46 77 51");
  return p("M44 50 Q49 47.6 54 50 M66 50 Q71 47.6 76 50");
}

function boca(tipo, humor) {
  const t = humor === "triste" ? "triste" : humor === "uau" ? "o" : humor === "neutro" && ["sorrisao", "lingua", "aparelho"].includes(tipo) ? "sorriso" : tipo;
  const aberta = `<path d="M50.5 69.6 Q60 81.5 69.5 69.6 Z" fill="${T}" stroke="${T}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const dentes = `<path d="M52.6 70.3 Q60 72.6 67.4 70.3 L66.8 72.6 Q60 74.6 53.2 72.6Z" fill="#fff"/>`;
  const lingua = `<path d="M55 76.2 Q60 79.6 65 76.2 Q60 73.8 55 76.2Z" fill="#FF8FA3"/>`;
  switch (t) {
    case "sorrisao": return aberta + lingua + dentes;
    case "aparelho": return aberta + lingua + dentes + `<path d="M53.4 71.6 Q60 73.6 66.6 71.6" stroke="#8C97AB" stroke-width="1.2" fill="none"/>${[55.6, 58.8, 61.2, 64.4].map(x => `<rect x="${x - 0.9}" y="${71.6 + (Math.abs(x - 60) < 2 ? 0.6 : 0.2)}" width="1.8" height="1.6" rx=".3" fill="#C9D2DE" stroke="#8C97AB" stroke-width=".5"/>`).join("")}`;
    case "lingua": return aberta + `<path d="M55.4 74 Q55 83 60 83.4 Q65 83 64.6 74 Q60 72.4 55.4 74Z" fill="#FF8FA3" stroke="${T}" stroke-width="1.6"/><path d="M60 75.5 v4.5" stroke="#E86F86" stroke-width="1.2" stroke-linecap="round"/>`;
    case "neutro": return `<path d="M54 72 Q60 73 66 72" stroke="${T}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    case "sorrisinho": return `<path d="M53 71 Q60 75.4 67 68.8" stroke="${T}" stroke-width="2.7" fill="none" stroke-linecap="round"/>`;
    case "triste": return `<path d="M53 75.5 Q60 69 67 75.5" stroke="${T}" stroke-width="2.7" fill="none" stroke-linecap="round"/>`;
    case "o": return `<ellipse cx="60" cy="73.2" rx="4.2" ry="4.8" fill="${T}"/><ellipse cx="60" cy="75.8" rx="2.6" ry="1.5" fill="#FF8FA3"/>`;
    case "batom": return `<path d="M51.5 71 Q56 67.6 60 69.6 Q64 67.6 68.5 71 Q64 76.4 60 76.4 Q56 76.4 51.5 71Z" fill="#E2557A" stroke="#A3284A" stroke-width="1.2" stroke-linejoin="round"/><path d="M52.6 71.2 Q60 73.2 67.4 71.2" stroke="#A3284A" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M62.6 73.6 q2 -.3 3 -1.4" stroke="#fff" stroke-width="1.1" opacity=".7" stroke-linecap="round"/>`;
    default: return `<path d="M52 70 Q60 77.4 68 70" stroke="${T}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  }
}
export const TIPOS_BOCA = { sorriso: "Sorriso", sorrisao: "Sorrisão", sorrisinho: "Sorriso de canto", lingua: "Língua de fora", aparelho: "Com aparelho", batom: "Batom", neutro: "Neutra" };

const BIGODE = "M50 67.4 Q55 63.6 60 65.8 Q65 63.6 70 67.4 Q65 69.4 60 68.2 Q55 69.4 50 67.4Z";
// A barba sai em duas partes (26/10/2026, pedido do Alediov: boca nenhuma em cima de dois pedaços diferentes): o
// queixo (cavanhaque/barba cheia, com a abertura da boca mais funda, para nenhuma boca encostar nela) vai por baixo
// da boca e o bigode por cima, como um bigode de verdade sobre o lábio.
const BARBAS = {
  nenhuma: () => ["", ""],
  bigode: (c) => ["", vol(BIGODE, c, { k: 1, contorno: 1.6 })],
  cavanhaque: (c) => [vol("M54.6 80.2 Q60 89.6 65.4 80.2 Q60 82.4 54.6 80.2Z", c, { k: 1.2, contorno: 1.8 }), vol(BIGODE, c, { k: 1, contorno: 1.6 })],
  barba: (c) => [vol("M36 60 C37 80 48 90 60 90 C72 90 83 80 84 60 C80 71 77 78 69 80 Q60 83 51 80 C43 78 40 71 36 60Z", c, { k: 2.6, contorno: 2.4 }), vol(BIGODE, c, { k: 1, contorno: 1.6 })],
};
export const TIPOS_BARBA = { nenhuma: "Sem barba", bigode: "Bigode", cavanhaque: "Cavanhaque", barba: "Barba cheia" };

// ---------- roupas ----------
const TRONCO = "M16 121 C18 99 38 90 60 90 C82 90 102 99 104 121Z";
const tronco = (c, o = {}) => vol(TRONCO, c, { k: 4, contorno: 2.6, ...o });
const ROUPAS = {
  jaleco: (c) => `${tronco("#FFFFFF")}<path d="M50 90.6 L60 108 L70 90.6 Q60 94 50 90.6Z" fill="${c === "#FFFFFF" ? "#7FB2FF" : c}" stroke="${T}" stroke-width="2" stroke-linejoin="round"/><path d="M50 91 L42 121 M70 91 L78 121" stroke="${T}" stroke-width="2"/>${vol("M50 90.6 L56 104 L45.6 104Z", "#EEF2F8", { k: 1, contorno: 1.8 })}${vol("M70 90.6 L64 104 L74.4 104Z", "#EEF2F8", { k: 1, contorno: 1.8 })}${volR(78, 104, 10, 8.6, 2, "#EAF2FF", { k: 1, contorno: 1.6 })}<path d="M82 99.6 v8" stroke="#2F6BFF" stroke-width="2.2" stroke-linecap="round"/><circle cx="82" cy="99.4" r="1.4" fill="#2F6BFF"/>`,
  scrub: (c) => `${tronco(c)}<path d="M48 90.6 L60 106 L72 90.6" fill="${sombraDe(c)}" stroke="${T}" stroke-width="2.2" stroke-linejoin="round"/><rect x="70" y="106" width="12" height="9" rx="2" fill="none" stroke="${T}" stroke-width="1.6" opacity=".55"/><path d="M73 106 v-3" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`,
  moletom: (c) => `${tronco(c)}${vol("M40 92 C44 104 76 104 80 92 C74 96 46 96 40 92Z", c, { k: 1.4, contorno: 2 })}<path d="M54 99 v12 M66 99 v12" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="54" cy="111.6" r="1.6" fill="#fff"/><circle cx="66" cy="111.6" r="1.6" fill="#fff"/><path d="M44 116 h32" stroke="${T}" stroke-width="1.6" opacity=".35"/>`,
  camiseta: (c) => `${tronco(c)}<path d="M50 90.6 Q60 98 70 90.6" fill="none" stroke="${T}" stroke-width="2.2"/><path d="M84 106 l4 10" stroke="${T}" stroke-width="1.6" opacity=".3" stroke-linecap="round"/>`,
  vestido: (c) => `${tronco(c)}<path d="M46 92 Q60 102 74 92" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><circle cx="60" cy="106" r="3" fill="#fff" stroke="${T}" stroke-width="1.2"/><circle cx="60" cy="114.6" r="2.4" fill="#fff" opacity=".8"/>`,
  capa_maga: (c) => `${vol("M10 121 C14 96 36 86 60 86 C84 86 106 96 110 121Z", c, { k: 4, contorno: 2.6 })}<path d="M44 88.6 L60 104 L76 88.6" fill="#F2B33D" stroke="${T}" stroke-width="2" stroke-linejoin="round"/>${volE(60, 104, 4.4, 4.4, "#F2B33D", { k: 1, contorno: 2, luz: true })}${faisca(24, 108, 3, "#FFE08A", 0.7)}${faisca(96, 112, 2.6, "#FFE08A", 1.6)}`,
  avental_chumbo: (c) => `${tronco(c)}${vol("M38 121 C38 104 44 97 50 95 L70 95 C76 97 82 104 82 121Z", "#5E6B85", { k: 2, contorno: 2.4 })}${vol("M47 90.4 Q60 99 73 90.4 L74 95.6 Q60 104 46 95.6Z", "#5E6B85", { k: 1.2, contorno: 2.2 })}<circle cx="60" cy="111" r="6.4" fill="#FFD23F" stroke="${T}" stroke-width="1.6"/><path d="M60 111 L56.6 105.6 A6.4 6.4 0 0 1 63.4 105.6Z M60 111 L66.4 111.6 A6.4 6.4 0 0 1 63 116.6Z M60 111 L57 116.6 A6.4 6.4 0 0 1 53.6 111.6Z" fill="${T}"/><circle cx="60" cy="111" r="1.6" fill="#FFD23F" stroke="${T}" stroke-width="1"/>`,
};
export const TIPOS_ROUPA = { jaleco: "Jaleco", scrub: "Pijama cirúrgico", moletom: "Moletom", camiseta: "Camiseta", vestido: "Vestido", avental_chumbo: "Avental de chumbo", capa_maga: "Manto de mago" };

// ---------- chapéus e acessórios (no sistema do rosto: a aba fica por volta de y 40) ----------
const flor = (x, y, c, r = 5) => `${volU(circulos([0, 72, 144, 216, 288].map(a => [x + Math.cos((a - 90) * Math.PI / 180) * r * 0.62, y + Math.sin((a - 90) * Math.PI / 180) * r * 0.62, r * 0.56])), c, { k: 1, contorno: 1.4 })}<circle cx="${x}" cy="${y}" r="${(r * 0.36).toFixed(2)}" fill="#FFE08A" stroke="${T}" stroke-width="1"/>`;
const nota = (x, y, atraso) => `<g class="pa pa-sobe" style="transform-origin:${x}px ${y}px;--pd:${atraso}s"><path d="M${x} ${y} v-9 l6 -2 v8" fill="none" stroke="${T}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="${x - 1.8}" cy="${y}" rx="2.4" ry="1.8" fill="${T}"/><ellipse cx="${x + 4.2}" cy="${y - 2}" rx="2.4" ry="1.8" fill="${T}"/></g>`;
export const CHAPEUS = {
  nenhum: () => "",
  // ----- exclusivos de eventos -----
  helice: () => `<g>${vol("M35 45 C32 20 88 20 85 45 C74 39 46 39 35 45Z", "#7FD6F5", { k: 2.6, contorno: 2.5 })}<path d="M60 24 C60 30 60 38 60 42.4 M47 27 C49 33 50 38 50 42.4 M73 27 C71 33 70 38 70 42.4" stroke="#F07BB0" stroke-width="3" fill="none"/>${vol("M82 42.6 C90 40 100 41.6 105 46 C97 48.6 89 48 82.6 46.6Z", "#FFC24B", { k: 1, contorno: 2.2 })}<path d="M60 24 v-8" stroke="${T}" stroke-width="2.6" stroke-linecap="round"/>${parte("pa-helice", 60, 15, vol("M60 15 L44 11 Q41.6 15 46 17.4Z M60 15 L76 19 Q78.4 15 74 12.6Z", "#FFC24B", { k: 1, contorno: 2 }))}${volE(60, 15, 3.2, 3.2, "#E0434A", { k: 0.8, contorno: 1.8 })}${brilho("M70 27 q6 3 8 9", 2.6, 0.6)}</g>`,
  touca_dente: () => `<g>${vol("M33 46 C30 18 90 18 87 46 C78 38 42 38 33 46Z", "#7FB8F0", { k: 2.6, contorno: 2.5 })}<g fill="#fff" opacity=".45"><circle cx="40" cy="36" r="1.4"/><circle cx="80" cy="36" r="1.4"/><circle cx="46" cy="27" r="1.4"/><circle cx="74" cy="27" r="1.4"/></g>${vol("M53 24 c0 -4 4 -5 7 -3 c3 -2 7 -1 7 3 c0 4 -2 6 -3 10 c-1 2 -2 2 -3 0 l-1 -3 l-1 3 c-1 2 -2 2 -3 0 c-1 -4 -3 -6 -3 -10z", "#FFFFFF", { k: 1, contorno: 1.8 })}${faisca(70, 20, 2.6, "#FFFFFF", 0.4)}</g>`,
  bruxa: () => `<g>${volE(60, 42, 36, 7, "#3A2D70", { k: 1.6, contorno: 2.5 })}${vol("M44 41 L58 2 Q62 -2 64 4 L80 22 L74 24 L76 41 Q60 45 44 41Z", "#4B3A8C", { k: 2.6, contorno: 2.5 })}${vol("M46.4 34 Q60 37 75.8 34 L76 41 Q60 45 44 41Z", "#F28A1E", { k: 1, contorno: 2 })}${volR(56.6, 35.2, 7, 6.6, 1.2, "#FFE08A", { k: 0.6, contorno: 1.4 })}${faisca(67, 17, 3.4, "#FFE08A", 0)}${faisca(86, 30, 2.4, "#C9B8FF", 1.2)}</g>`,
  festa: () => { const id = uid("f"); return `<g><clipPath id="${id}"><path d="M45 40 L62 6 L77 40 Z"/></clipPath>${vol("M45 40 L62 6 L77 40 Z", "#F07BB0", { k: 2, contorno: 0 })}<g clip-path="url(#${id})"><path d="M44 22 L80 30 M42 33 L80 41" stroke="#FFE08A" stroke-width="5"/></g><path d="M45 40 L62 6 L77 40 Z" fill="none" ${traco(2.5)}/><path d="M45 40 Q61 44 77 40" fill="none" stroke="${T}" stroke-width="2.5"/>${parte("pa-pulsa", 62, 6, volE(62, 5.6, 4.6, 4.6, "#7FD6F5", { k: 1.2, contorno: 2 }))}${faisca(40, 14, 2.6, "#FFE08A", 0.5)}${faisca(84, 10, 2.2, "#FF9EC2", 1.3)}</g>`; },
  gorro: () => `<g>${vol("M36 40 C38 14 68 4 86 18 C94 24 96 34 92 40 C88 32 82 28 78 30 L82 40Z", "#E0434A", { k: 2.6, contorno: 2.5 })}${volR(32, 36, 56, 11, 5.5, "#FFFFFF", { k: 1.4, contorno: 2.5 })}${parte("pa-flutua", 93, 36, volE(93, 42, 6.5, 6.5, "#FFFFFF", { k: 1.4, contorno: 2.5 }))}${brilho("M50 22 q8 -6 18 -6", 2.4, 0.5)}</g>`,
  cartola: () => `<g>${volE(60, 41, 30, 6, "#2A2F45", { k: 1.4, contorno: 2.5, sombra: "#1B1F33" })}${volR(43, 6, 34, 35, 4, "#2A2F45", { k: 2, contorno: 2.5, sombra: "#1B1F33" })}<rect x="43" y="28" width="34" height="7" fill="#F2B33D" stroke="${T}" stroke-width="1.6"/><path d="M48 12 v12" stroke="#fff" stroke-width="2.5" opacity=".35" stroke-linecap="round"/>${faisca(86, 12, 4.4, "#FFE08A", 0)}${faisca(34, 22, 2.8, "#FFE08A", 1.1)}</g>`,
  plumas: () => `<g>${[[35, 25, "#F07BB0", -40], [45, 16, "#FFC24B", -22], [60, 12, "#7FD6A0", 0], [75, 16, "#7FD6F5", 22], [85, 25, "#A78BFA", 40]].map(([x, y, c, r], i) => parte("pa-folha", 60 + (x - 60) * 0.35, 36, `<g transform="rotate(${r} ${x} ${y})">${volE(x, y, 6, 13, c, { k: 1.4, contorno: 2 })}<path d="M${x} ${y - 10} V${y + 11}" stroke="${sombraDe(c)}" stroke-width="1.4"/></g>`, i * 0.25)).join("")}<path d="M34 40 C42 30 78 30 86 40" fill="none" stroke="${T}" stroke-width="8.4" stroke-linecap="round"/><path d="M34 40 C42 30 78 30 86 40" fill="none" stroke="#F2B33D" stroke-width="5" stroke-linecap="round"/><path d="M34 40 C42 30 78 30 86 40" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="1 5" stroke-linecap="round" opacity=".8"/>${volE(60, 31, 4.2, 4.2, "#E0434A", { k: 1, contorno: 1.8, luz: true })}</g>`,
  coelho: () => `<g>${parte("pa-orelha e", 48, 36, vol("M44 36 C36 20 38 2 46 2 C54 2 54 20 52 34Z", "#FFFFFF", { k: 1.6, contorno: 2.4 }) + `<path d="M46 30 C42 20 43 9 46 8 C50 9 50 20 49 30Z" fill="#FFB3C8"/>`)}${parte("pa-orelha d", 72, 36, vol("M68 34 C66 20 66 2 74 2 C82 2 84 20 76 36Z", "#FFFFFF", { k: 1.6, contorno: 2.4 }) + `<path d="M71 30 C70 20 70 9 74 8 C77 9 78 20 74 30Z" fill="#FFB3C8"/>`, 0.3)}<path d="M36 40 C42 30 78 30 84 40" fill="none" stroke="${T}" stroke-width="7" stroke-linecap="round"/><path d="M36 40 C42 30 78 30 84 40" fill="none" stroke="#F07BB0" stroke-width="3.6" stroke-linecap="round"/></g>`,
  palha: () => `<g>${volE(60, 40, 40, 8, "#F2D18A", { k: 1.6, contorno: 2.5 })}${vol("M40 39 C40 16 80 16 80 39Z", "#F7DFA2", { k: 2, contorno: 2.5 })}<path d="M41 32 H79" stroke="#E0434A" stroke-width="5"/><path d="M41 29.6 H79 M41 34.4 H79" stroke="${T}" stroke-width="1.2" opacity=".5"/><path d="M26 41 l-4 4 M94 41 l4 4 M34 45 l-2 4 M86 45 l2 4 M46 46 l-1 4 M74 46 l1 4" stroke="#C9A24F" stroke-width="2" stroke-linecap="round"/>${volR(66, 20, 7, 7, 0.6, "#7FD6F5", { k: 0.8, contorno: 1.5 })}<path d="M67.4 21.4 l4.2 4.2 M71.6 21.4 l-4.2 4.2" stroke="#4FB3D9" stroke-width="1" opacity=".8"/><path d="M46 26 q2 -5 6 -7 M54 22 q2 -2 4 -3" stroke="#C9A24F" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`,
  capelo: () => `<g>${vol("M40 27 v9 c0 6 40 6 40 0 v-9 L60 34Z", "#2B3557", { k: 1.6, contorno: 2.4, sombra: "#1C2440" })}${vol("M60 8 L100 21 L60 34 L20 21Z", "#2B3557", { k: 1.4, contorno: 2.4, sombra: "#1C2440" })}<path d="M60 10.6 L92 21" stroke="#fff" stroke-width="1.8" opacity=".25" stroke-linecap="round"/>${parte("pa-balanca", 96, 22, `<path d="M60 21 L96 22 V36" fill="none" stroke="#F2A922" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>${vol("M92.6 36 h6.8 l1.6 9 h-10Z", "#F2A922", { k: 0.8, contorno: 1.6 })}<path d="M93.4 39 v5.4 M96 39 v5.6 M98.6 39 v5.4" stroke="#C47F0E" stroke-width="1"/>`)}${volE(60, 21, 2.6, 2.6, "#F2A922", { k: 0.6, contorno: 1.4 })}</g>`,
  touca: () => `<g>${vol("M33 46 C30 18 90 18 87 46 C78 38 42 38 33 46Z", "#5FB4E8", { k: 2.6, contorno: 2.5 })}<path d="M44 30 l5 5 M58 26 l5 5 M72 30 l5 5 M50 38 l3 3 M66 37 l3 3" stroke="#fff" stroke-width="2" opacity=".55" stroke-linecap="round"/><path d="M34 44.4 Q60 36 86 44.4" stroke="${sombraDe("#5FB4E8")}" stroke-width="2" fill="none"/></g>`,
  bone: () => `<g>${vol("M34 44 C32 20 88 20 86 44 Z", "#E0434A", { k: 2.4, contorno: 2.5 })}<path d="M60 22 v20 M46 25 q4 8 4 17 M74 25 q-4 8 -4 17" stroke="${sombraDe("#E0434A")}" stroke-width="1.6" fill="none"/>${vol("M34 44 C50 40 90 40 104 46 C96 50 70 48 34 48Z", "#B32D33", { k: 1, contorno: 2.5 })}${volE(60, 22.6, 3, 3, "#B32D33", { k: 0.6, contorno: 1.6 })}${brilho("M68 26 q7 3 10 10", 2.4, 0.5)}</g>`,
  coroa: () => `<g>${vol("M38 36 L41 14 L52 26 L60 10 L68 26 L79 14 L82 36Z", "#F2B33D", { k: 2, contorno: 2.5, luz: true })}<path d="M39 31 H81" stroke="#C47F0E" stroke-width="1.6"/>${volE(60, 26, 3.4, 3.4, "#E0434A", { k: 0.8, contorno: 1.6 })}${volE(48, 31.6, 2.2, 2.2, "#7FD6F5", { k: 0.6, contorno: 1.3 })}${volE(72, 31.6, 2.2, 2.2, "#7FD6A0", { k: 0.6, contorno: 1.3 })}${luzinha(41, 14, 1.6)}${luzinha(60, 10, 1.6)}${luzinha(79, 14, 1.6)}${faisca(86, 16, 3.6, "#FFF3B0", 0.3)}</g>`,
  diamante: () => `<g>${vol("M36 36 L40 10 L52 24 L60 6 L68 24 L80 10 L84 36Z", "#BFF0FF", { k: 2, contorno: 2.5, luz: true })}<path d="M40 10 L52 36 M60 6 L60 36 M80 10 L68 36 M46 18 L44 36 M74 18 L76 36" stroke="#7FD6F5" stroke-width="1.6"/><path d="M57 20 l3 -4 l3 4 l-3 4z" fill="#fff"/>${faisca(32, 14, 3.6, "#FFFFFF", 0)}${faisca(88, 22, 4, "#BFF0FF", 0.9)}${faisca(60, -2, 3, "#FFFFFF", 1.7)}</g>`,
  aureola: () => parte("pa-aureola", 60, 14, `<ellipse cx="60" cy="14" rx="24" ry="6" fill="none" stroke="${T}" stroke-width="8"/><ellipse cx="60" cy="14" rx="24" ry="6" fill="none" stroke="#FFE08A" stroke-width="4.6"/><path d="M42 11.6 Q52 8 64 8.4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>${faisca(88, 8, 3, "#FFF3B0", 0.6)}`),
  mago: () => `<g>${vol("M30 40 C46 34 74 34 90 40 L66 2 C62 0 58 0 56 4Z", "#5B54D6", { k: 2.6, contorno: 2.5 })}${vol("M24 42 C44 34 76 34 96 42 C80 48 40 48 24 42Z", "#3A34A3", { k: 1.2, contorno: 2.5 })}${estrela5(60, 21, 6, "#FFE08A", { contorno: 1.6 })}<circle cx="69" cy="12" r="1.6" fill="#FFE08A"/><circle cx="50" cy="31" r="1.4" fill="#FFE08A"/>${faisca(76, 26, 3, "#FFE08A", 0.4)}${faisca(44, 18, 2.6, "#FFFFFF", 1.4)}</g>`,
  laco: () => parte("pa-laco", 60, 26, `${vol("M60 26 L42 16 Q36 26 42 36 Z M60 26 L78 16 Q84 26 78 36 Z", "#F07BB0", { k: 1.6, contorno: 2.2 })}<path d="M47 22 Q45 26 47 30 M73 22 Q75 26 73 30" stroke="#C94E86" stroke-width="1.4" fill="none" stroke-linecap="round"/>${volE(60, 26, 5, 5, "#E2557A", { k: 1, contorno: 2 })}`),
  flores: () => `<g><path d="M34 40 C42 28 78 28 86 40" fill="none" stroke="${T}" stroke-width="5" stroke-linecap="round"/><path d="M34 40 C42 28 78 28 86 40" fill="none" stroke="#4CAF6E" stroke-width="2.4" stroke-linecap="round"/>${vol("M44 32 q-6 -4 -10 0 q5 4 10 0z M76 32 q6 -4 10 0 q-5 4 -10 0z", "#7FD6A0", { k: 0.6, contorno: 1.4 })}${[[40, 34, "#F07BB0"], [50, 27, "#FFE08A"], [60, 24, "#A78BFA"], [70, 27, "#7FD6F5"], [80, 34, "#F07BB0"]].map(([x, y, c], i) => parte("pa-pulsa", x, y, flor(x, y, c, 5.6), i * 0.35)).join("")}</g>`,
  gatinho: () => `<g>${parte("pa-orelha e", 45, 36, vol("M36 40 L40 16 L54 30Z", "#2A2F45", { k: 1.4, contorno: 2.2, sombra: "#1B1F33" }) + `<path d="M41.4 23 L45 31.6 L49.6 29.6Z" fill="#F07BB0"/>`)}${parte("pa-orelha d", 75, 36, vol("M84 40 L80 16 L66 30Z", "#2A2F45", { k: 1.4, contorno: 2.2, sombra: "#1B1F33" }) + `<path d="M78.6 23 L75 31.6 L70.4 29.6Z" fill="#F07BB0"/>`, 0.5)}<path d="M34 42 C40 26 80 26 86 42" fill="none" stroke="${T}" stroke-width="5.4" stroke-linecap="round"/><path d="M34 42 C40 26 80 26 86 42" fill="none" stroke="#2A2F45" stroke-width="2.6" stroke-linecap="round"/></g>`,
  tiara: () => `<g><path d="M38 34 C46 26 74 26 82 34" fill="none" stroke="${T}" stroke-width="5.6" stroke-linecap="round"/><path d="M38 34 C46 26 74 26 82 34" fill="none" stroke="#F2B33D" stroke-width="2.8" stroke-linecap="round"/>${vol("M52 29 L56 19 L60 26 L64 19 L68 29 Q60 27 52 29Z", "#FFE08A", { k: 0.8, contorno: 1.8 })}${volE(60, 24, 2.6, 2.6, "#7FD6F5", { k: 0.6, contorno: 1.3 })}${faisca(66, 15, 3, "#FFFFFF", 0.2)}</g>`,
  fones: () => `<g>${tubo("M34 52 C32 20 88 20 86 52", "#3A3F52", { w: 4.6, contorno: 2.2 })}${volR(26, 47, 13, 20, 6, "#F07BB0", { k: 1.6, contorno: 2.4 })}${volR(81, 47, 13, 20, 6, "#F07BB0", { k: 1.6, contorno: 2.4 })}<path d="M30 52 v10 M90 52 v10" stroke="#fff" stroke-width="1.8" opacity=".6" stroke-linecap="round"/>${nota(100, 28, 0)}${nota(16, 34, 1.3)}</g>`,
  boina: () => `<g>${vol("M33 41 C28 27 48 19 64 21 C82 22 94 31 88 41 C76 45 46 45 33 41Z", "#C2502A", { k: 2.4, contorno: 2.5 })}<path d="M37 40.6 C50 43 72 43 85 40.6" stroke="${sombraDe("#C2502A")}" stroke-width="2" fill="none"/>${volR(61, 15, 4, 7, 2, "#C2502A", { k: 0.6, contorno: 1.8 })}${brilho("M66 25 q9 1 15 7", 2.4, 0.4)}</g>`,
};
/** Quanto cada chapéu sobe acima da aba (y 44), com as faíscas: os dentes e bichos abrem espaço em cima para ele. */
export const ALTURA_CHAPEU = { helice: 34, touca_dente: 27, bruxa: 46, festa: 43, gorro: 35, cartola: 38, plumas: 45, coelho: 42, palha: 25, capelo: 36, touca: 22, bone: 20, coroa: 34, diamante: 49, aureola: 39, mago: 44, laco: 28, flores: 26, gatinho: 28, tiara: 32, fones: 37, boina: 29 };
/** viewBox de um personagem (padrão -4 -10 128 142) com espaço para o chapéu posto em (60, topo) na escala esc. */
export function caixaComChapeu(chapeu, topo, esc) {
  const alto = topo - (ALTURA_CHAPEU[chapeu] ?? 40) * esc, falta = Math.max(0, -11 - alto);
  if (!falta) return "-4 -10 128 142";
  const h = 142 + falta, w = (128 * h) / 142, f = (n) => +n.toFixed(2);
  return `${f(-4 - (w - 128) / 2)} ${f(-10 - falta)} ${f(w)} ${f(h)}`;
}
export const TIPOS_CHAPEU = { helice: "Boné de hélice", touca_dente: "Touca do dentista", bruxa: "Chapéu de bruxa", festa: "Chapéu de festa", gorro: "Gorro de Natal", cartola: "Cartola de Réveillon", plumas: "Plumas de Carnaval", coelho: "Orelhas de coelho", palha: "Chapéu de palha", nenhum: "Nenhum", laco: "Laço", flores: "Coroa de flores", tiara: "Tiara", gatinho: "Orelhas de gato", bone: "Boné", touca: "Touca cirúrgica", boina: "Boina", fones: "Fones de ouvido", capelo: "Capelo de formatura", coroa: "Coroa de ouro", mago: "Chapéu de mago", aureola: "Auréola", diamante: "Coroa de diamante" };

const lente = (x, y) => `<path d="M${x - 4} ${y + 2} l5 -6" stroke="#fff" stroke-width="1.6" opacity=".7" stroke-linecap="round"/>`;
const ROSTO = {
  nenhum: () => "",
  oculos: () => `<g><rect x="40" y="52" width="18" height="13" rx="5" fill="#BFE6FF" fill-opacity=".3" stroke="${T}" stroke-width="2.4"/><rect x="62" y="52" width="18" height="13" rx="5" fill="#BFE6FF" fill-opacity=".3" stroke="${T}" stroke-width="2.4"/>${lente(47, 58)}${lente(69, 58)}<path d="M58 57 h4 M40 57 h-4 M80 57 h4" stroke="${T}" stroke-width="2.4" stroke-linecap="round"/></g>`,
  redondos: (c = {}, a = c.corOculos || "#B07508") => `<g><circle cx="49" cy="58" r="8" fill="#BFE6FF" fill-opacity=".28" stroke="${a}" stroke-width="2.3"/><circle cx="71" cy="58" r="8" fill="#BFE6FF" fill-opacity=".28" stroke="${a}" stroke-width="2.3"/>${lente(48, 58)}${lente(70, 58)}<path d="M57 57 Q60 55 63 57 M41 56 h-5 M79 56 h5" stroke="${a}" stroke-width="2.3" fill="none" stroke-linecap="round"/></g>`,
  escuros: () => `<g>${vol("M38 52 h20 l-2 10 q-8 4 -16 0z M62 52 h20 l-2 10 q-8 4 -16 0z", "#2A2F45", { k: 1.2, contorno: 1.8, sombra: T })}<path d="M58 54 h4 M38 53 h-3 M82 53 h3" stroke="${T}" stroke-width="2.4" stroke-linecap="round"/><path d="M42 55 l4 4 M66 55 l4 4" stroke="#fff" stroke-width="1.8" opacity=".55" stroke-linecap="round"/><path d="M48 54 l2 2 M72 54 l2 2" stroke="#fff" stroke-width="1.4" opacity=".4" stroke-linecap="round"/></g>`,
  lupas: () => `<g><path d="M36 52 h48" stroke="${T}" stroke-width="2.6" stroke-linecap="round"/>${volE(49, 58, 7, 7, "#3A3F52", { k: 1, contorno: 2, sombra: T })}${volE(71, 58, 7, 7, "#3A3F52", { k: 1, contorno: 2, sombra: T })}<circle cx="49" cy="58" r="4" fill="#7FD6F5"/><circle cx="71" cy="58" r="4" fill="#7FD6F5"/><circle cx="47.8" cy="56.6" r="1.4" fill="#fff"/><circle cx="69.8" cy="56.6" r="1.4" fill="#fff"/></g>`,
  mascara: () => `<g>${vol("M40 64 Q60 58 80 64 L78 80 Q60 90 42 80Z", "#F4F6FA", { k: 1.6, contorno: 2.2, sombra: "#D6DCE8" })}<path d="M40 66 L33 60 M80 66 L87 60" stroke="${T}" stroke-width="1.8" stroke-linecap="round"/><path d="M46 70 Q60 67 74 70 M45 75 Q60 72.6 75 75 M47 80 Q60 77.6 73 80" stroke="#C9D2E2" stroke-width="1.5" fill="none"/></g>`,
  viseira: () => `<g><path d="M34 46 Q60 40 86 46 L84 86 Q60 93 36 86Z" fill="#CFEFFF" fill-opacity=".26" stroke="#7FC8E8" stroke-width="2"/><path d="M40 52 L48 84 M72 46 L80 62" stroke="#fff" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>${vol("M33 41 Q60 34 87 41 L87 47 Q60 40 33 47Z", "#2F6BFF", { k: 0.8, contorno: 2 })}</g>`,
};
export const TIPOS_ROSTO = { nenhum: "Nada", oculos: "Óculos", redondos: "Óculos redondos", escuros: "Óculos escuros", mascara: "Máscara cirúrgica", viseira: "Protetor facial", lupas: "Lupas cirúrgicas" };

// extras de fantasia (só para cartas)
const EXTRAS = {
  asas: () => `${parte("pa-asa e", 42, 88, vol("M40 92 C14 80 4 52 18 42 C30 36 40 62 42 88Z", "#E9F7FF", { k: 2.4, contorno: 2.2, op: 0.95, sombra: "#BFE3F5" }) + `<path d="M20 48 C26 62 32 74 38 86 M14 58 C22 68 30 78 38 88" stroke="#9FD9F5" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}${parte("pa-asa d", 78, 88, vol("M80 92 C106 80 116 52 102 42 C90 36 80 62 78 88Z", "#E9F7FF", { k: 2.4, contorno: 2.2, op: 0.95, sombra: "#BFE3F5" }) + `<path d="M100 48 C94 62 88 74 82 86 M106 58 C98 68 90 78 82 88" stroke="#9FD9F5" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}`,
  varinha: () => `<g>${tubo("M92 118 L105 84", "#8A5A3B", { w: 3.4, contorno: 2 })}${parte("pa-pulsa", 106, 74, estrela5(106, 74, 9, "#FFE08A", { contorno: 2 }) + luzinha(104, 71, 1.6))}${faisca(116, 64, 3.4, "#FFE08A", 0.3)}${faisca(96, 62, 2.6, "#FFFFFF", 1.1)}</g>`,
  brilhos: () => `${faisca(16, 32, 5.6, "#FFE08A", 0)}${faisca(103, 22, 4.4, "#FFE08A", 0.8)}${faisca(98, 70, 2.6, "#FFF3B0", 1.6)}${faisca(22, 68, 2.4, "#FFF3B0", 2.2)}`,
  livro: () => `<g transform="rotate(-12 88 107)">${volR(76, 98, 24, 18, 2, "#E0434A", { k: 1.4, contorno: 2 })}<path d="M78 113.4 h20" stroke="#fff" stroke-width="2.2"/><path d="M80 102 h16" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M80 106 h10" stroke="#fff" stroke-width="1.6" opacity=".6" stroke-linecap="round"/></g>`,
  sonda: () => `<g>${tubo("M90 118 L104 86", "#7FD6A0", { w: 5, contorno: 2.2 })}${tubo("M104 86 L108 76 Q110 70 106 66", "#C3CBD8", { w: 2.2, contorno: 1.6 })}<path d="M107.6 74 l.8 -2.2 M108.6 70.4 l.6 -1.6" stroke="#2F6BFF" stroke-width="2.2"/>${faisca(114, 62, 2.8, "#BFF0FF", 0.5)}</g>`,
  estetoscopio: () => `${tubo("M46 92 C42 104 50 112 60 112 C70 112 78 104 74 92", "#3A3F52", { w: 2.6, contorno: 1.6 })}${volE(60, 113, 4.4, 4.4, "#C3CBD8", { k: 1, contorno: 2, luz: true })}`,
};

// ---------- fundos ----------
function fundoSVG(id, cor) {
  const c = FUNDOS[id] || id;
  let s = `<circle cx="60" cy="60" r="60" fill="${cor(c)}"/>`;
  if (/^#/.test(c) && id !== "noite") s += `<circle cx="60" cy="54" r="38" fill="${luzDe(c, 1.4)}" opacity=".55"/>`;
  if (id === "noite") s += `<path d="M24 30 a10 10 0 1 0 12 -12 a8 8 0 1 1 -12 12z" fill="#FFE08A" opacity=".9"/>${faisca(96, 26, 3, "#FFFFFF", 0)}${faisca(104, 52, 2, "#FFFFFF", 1.2)}${faisca(16, 58, 2.4, "#FFFFFF", 2)}`;
  if (id === "galaxia") s += `${faisca(22, 28, 3, "#FFFFFF", 0)}${faisca(98, 22, 2.4, "#FFE08A", 0.9)}${faisca(104, 60, 2, "#FFFFFF", 1.7)}${faisca(14, 70, 2, "#C9B8FF", 2.3)}<circle cx="34" cy="16" r="1" fill="#fff"/><circle cx="88" cy="40" r="1" fill="#fff"/><circle cx="20" cy="46" r="1" fill="#fff" opacity=".7"/>`;
  if (id === "por_do_sol") s += `<circle cx="26" cy="32" r="10" fill="#FFF3B0" opacity=".9"/><path d="M76 24 q6 -4 12 0 q6 -4 12 0" stroke="#fff" stroke-width="2.4" fill="none" opacity=".6" stroke-linecap="round"/>`;
  if (id === "dentinhos") s += `<g fill="#fff" stroke="#9ED6C8" stroke-width="2.4">${[[20, 28, -12], [98, 22, 10], [104, 62, -8], [14, 66, 14], [36, 10, 6], [84, 8, -14]].map(([x, y, r]) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(.42)" d="M-10 -8 C-10 -14 -4 -14 0 -11 C4 -14 10 -14 10 -8 C10 -2 7 2 6 8 C5 13 2 13 1 8 L0 4 L-1 8 C-2 13 -5 13 -6 8 C-7 2 -10 -2 -10 -8Z"/>`).join("")}</g>`;
  if (id === "aurora") s += `${faisca(20, 30, 2.6, "#FFFFFF", 0.4)}${faisca(100, 26, 2.2, "#FFFFFF", 1.5)}`;
  return s;
}

export const PADRAO = { pele: "p2", cabelo: "curto", corCabelo: "castanho", olhos: "normal", corOlhos: "castanho", sobrancelha: "suave", boca: "sorriso", barba: "nenhuma", roupa: "jaleco", corRoupa: "azul", chapeu: "nenhum", rosto: "nenhum", fundo: "azul" };

/** Desenha um humano. cfg: partes; humor: feliz|triste|uau|neutro (sobrepõe olhos e boca). */
export function humano(cfg = {}, { humor = null, classe = "", extras = [], semFundo = false } = {}) {
  const c = { ...PADRAO, ...cfg };
  const { cor, defs } = tintas();
  const pele = PELES[c.pele] || c.pele, sombra = sombraDe(pele, 0.8);
  const corBruta = CORES_CABELO[c.corCabelo] || c.corCabelo, corC = cor(corBruta), corSolida = corBruta.startsWith("url") ? "#8B5CF6" : corBruta;
  const corBrow = escurece(corSolida, 0.75);
  const cab = CABELOS[c.cabelo] || CABELOS.curto;
  const corR = cor(ROUPAS_COR[c.corRoupa] || c.corRoupa);
  const ex = (k) => (extras.includes(k) && EXTRAS[k] ? EXTRAS[k]() : "");
  const cabeca = (conteudo) => parte("pa-cabeca", 60, 88, conteudo);
  // cabelo de trás (com o seu balanço) e da frente
  let tras = "";
  if (cab.tras) tras = vol(cab.tras, corC, { k: 4, contorno: 2.6 });
  if (cab.trasE) tras = cab.trasE.map(([x, y, r]) => volE(x, y, r, r, corC, { k: 2.4, contorno: 2.6 })).join("");
  if (cab.trasU) tras = volU(circulos(cab.trasU), corC, { k: cab.cachos ? 4 : 2.4, contorno: 2.6 });
  if (cab.lacos) tras += [[40, 108], [80, 108]].map(([x, y]) => volE(x, y, 3.4, 2.6, "#F07BB0", { k: 0.6, contorno: 1.6 })).join("");
  if (tras && cab.balanca) tras = parte("pa-cabelo", 60, 40, tras);
  let frente = "";
  if (cab.frente) frente = vol(cab.frente, corC, { k: 3, contorno: 2.6 });
  if (cab.frenteU) frente = volU(circulos(cab.frenteU), corC, { k: 3, contorno: 2.6 });
  if (cab.lados) frente += `<path d="${cab.lados}" fill="${corC}" opacity=".5"/>`;
  const idCab = uid("h"), clipCab = `<clipPath id="${idCab}"><ellipse cx="60" cy="57" rx="23" ry="25"/></clipPath>`;
  // a sombra que a franja faz na testa (a forma da frente, um pouco abaixo, recortada pela cabeça)
  const formaFrente = cab.frente || (cab.frenteU && circulos(cab.frenteU));
  const sombraTesta = formaFrente ? `${clipCab}<g clip-path="url(#${idCab})"><path d="${formaFrente}" fill="${sombra}" transform="translate(-1.2 2.8)"/></g>` : "";
  if (cab.raspado) frente = `${sombraTesta ? "" : clipCab}<g clip-path="url(#${idCab})"><path d="${cab.raspado}" fill="${corC}" opacity=".62"/><path d="${cab.raspado}" fill="none" stroke="${corC}" stroke-width="1.4" stroke-dasharray=".1 2.6" stroke-linecap="round" opacity=".7"/></g>`;
  if (cab.mecha) frente += vol(cab.mecha, corC, { k: 2.2, contorno: 2.4 });
  if (cab.fios) frente += `<path d="${cab.fios}" stroke="${sombraDe(corSolida, 1.2)}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".75"/>`;
  if (c.enfeite === "estrela") frente += estrela5(80, 37, 5.2, "#B79CFF", { contorno: 1.8 }) + `<circle cx="78.6" cy="35.4" r="1" fill="#fff" opacity=".8"/>`;
  if (cab.risca) frente += `<path d="M60 25 L60 37" stroke="${sombraDe(corSolida)}" stroke-width="2" stroke-linecap="round"/>`;
  if (cab.brilho) frente += `<path d="${cab.brilho}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="${["branco", "loiro", "grisalho"].includes(c.corCabelo) ? 0.6 : 0.3}"/>`;
  if (cab.cachos) frente += `<g fill="#fff" opacity=".28"><circle cx="70" cy="25" r="2.2"/><circle cx="78" cy="32" r="1.6"/></g>`;
  if (cab.careca) frente = `<path d="M66 34 Q76 36 80 44" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>`;
  const rostoAc = c.rosto === "mascara" ? "" : boca(c.boca, humor);
  const barba = (BARBAS[c.barba] || BARBAS.nenhuma)(corSolida);
  const corpo = `
    ${ex("asas")}${ex("brilhos")}
    ${tras ? cabeca(tras) : ""}
    ${vol("M51 70 h18 v20 q-9 6 -18 0z", sombra, { k: 0, contorno: 2.4 })}
    ${(ROUPAS[c.roupa] || ROUPAS.jaleco)(corR)}
    ${ex("estetoscopio")}
    ${cabeca(`
      ${volE(36, 60, 5.6, 6.4, pele, { k: 1.4, contorno: 2.4, sombra })}${volE(84, 60, 5.6, 6.4, pele, { k: 1.4, contorno: 2.4, sombra })}
      <path d="M33.4 57.4 q2.6 2.6 0 5.2 M86.6 57.4 q-2.6 2.6 0 5.2" stroke="${sombra}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      ${volE(60, 57, 24, 26, pele, { k: 3.2, contorno: 2.8, sombra })}
      <path d="M60.6 61.6 q-2.6 4 1 5.2" stroke="${sombraDe(pele, 1.3)}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      ${olhos(c.olhos, CORES_OLHOS[c.corOlhos] || c.corOlhos, humor)}
      ${sobrancelhas(c.sobrancelha, corBrow, humor)}
      ${barba[0]}
      ${rostoAc}
      ${barba[1]}
      ${sombraTesta}${frente}
      ${(ROSTO[c.rosto] || ROSTO.nenhum)(c)}
      ${(CHAPEUS[c.chapeu] || CHAPEUS.nenhum)()}`)}
    ${ex("varinha")}${ex("livro")}${ex("sonda")}`;
  return `<svg class="humano ${classe}" viewBox="0 0 120 120" role="img" aria-label="Personagem" style="${fasePessoa(c)}">${semFundo ? "" : fundoSVG(c.fundo, cor)}${corpo}${defs()}</svg>`;
}
const fasePessoa = (c) => { let h = 11; for (const v of Object.values(c)) for (const ch of String(v)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `--fase:-${(h % 5000) / 1000}s`; };

// ---------- catálogo do avatar (preço 0 = grátis) ----------
const g = (preco) => ({ preco, moeda: "gemas" }), m = (preco) => ({ preco, moeda: "moedas" }), gratis = { preco: 0 };
const ev = (evento) => ({ preco: 150, moeda: "evento", evento });
export const CATALOGO = {
  pele: { titulo: "Tom de pele", itens: Object.fromEntries(Object.keys(PELES).map(k => [k, { nome: "", ...gratis, cor: PELES[k] }])) },
  cabelo: { titulo: "Cabelo", itens: { curto: gratis, medio: gratis, longo: gratis, franja: gratis, ondulado: gratis, careca: gratis, cacheado: m(60), coque: m(60), rabo: m(60), trancas: m(90), longo_ondulado: m(90), afro: m(90), coquinhos: m(120), moicano: m(120), raspado: gratis } },
  corCabelo: { titulo: "Cor do cabelo", itens: { preto: gratis, castanho: gratis, mel: gratis, loiro: gratis, ruivo: gratis, grisalho: gratis, rosa: m(80), azul: m(80), roxo: m(80), verde: m(80), branco: g(10), arcoiris: g(30) } },
  olhos: { titulo: "Olhos", itens: { normal: gratis, grandes: gratis, cilios: gratis, felizes: m(40), piscando: m(60), serio: m(40) } },
  corOlhos: { titulo: "Cor dos olhos", itens: { castanho: gratis, preto: gratis, verde: gratis, azul: gratis, mel: gratis, violeta: g(12), rubi: g(12) } },
  sobrancelha: { titulo: "Sobrancelhas", itens: { suave: gratis, grossa: gratis, arqueada: gratis } },
  boca: { titulo: "Sorriso", itens: { sorriso: gratis, sorrisao: gratis, sorrisinho: m(40), lingua: m(60), aparelho: m(100), batom: m(80), neutro: gratis } },
  barba: { titulo: "Barba", itens: { nenhuma: gratis, bigode: m(50), cavanhaque: m(70), barba: m(90) } },
  roupa: { titulo: "Roupa", itens: { jaleco: gratis, scrub: gratis, camiseta: gratis, moletom: m(100), vestido: m(120), avental_chumbo: m(150), capa_maga: g(25) } },
  corRoupa: { titulo: "Cor da roupa", itens: { azul: gratis, branco: gratis, verde: gratis, vinho: m(60), rosa: m(60), preto: m(60), lilas: m(80), dourado: g(20) } },
  chapeu: { titulo: "Chapéu", itens: { nenhum: gratis, laco: m(80), flores: m(120), tiara: m(150), gatinho: m(150), bone: m(100), boina: m(90), fones: m(120), touca: m(60), capelo: m(120), coroa: m(200), mago: g(25), aureola: g(25), diamante: g(45),
    helice: ev("criancas"), touca_dente: ev("dentista"), bruxa: ev("halloween"), festa: ev("aniversario"), gorro: ev("natal"), cartola: ev("ano_novo"), plumas: ev("carnaval"), coelho: ev("pascoa"), palha: ev("junina") } },
  rosto: { titulo: "Acessório do rosto", itens: { nenhum: gratis, oculos: m(80), redondos: m(100), escuros: m(120), mascara: m(70), viseira: m(90), lupas: g(30) } },
  fundo: { titulo: "Fundo", itens: { azul: gratis, rosa: gratis, menta: gratis, areia: gratis, lilas: m(50), cinza: gratis, dentinhos: m(60), noite: m(80), aurora: g(15), por_do_sol: g(15), galaxia: g(25) } },
};
export const NOMES_ITENS = { ...ESTILOS_CABELO, ...TIPOS_OLHOS, ...TIPOS_BOCA, ...TIPOS_BARBA, ...TIPOS_ROUPA, ...TIPOS_CHAPEU, ...TIPOS_ROSTO,
  suave: "Suaves", grossa: "Grossas", arqueada: "Arqueadas" };
