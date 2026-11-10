// Companheiros que não são dentes nem pessoas: instrumentos com carinha, bichos dentuços, criaturas de fantasia e
// micróbios. Mesmo traço do Moli e o mesmo enquadramento dos dentes (viewBox -4 -10 128 142, chão em y 128).
// humor: feliz | triste | uau | neutro. Os olhos ficam em <g class="olhos"> para piscar.
// Desde 26/10/2026 (guia v2, arte/kit.js): volume em dois tons, rosto novo, bracinhos nos instrumentos (os mesmos dos
// dentes: acenam e comemoram) e partes que se mexem (arte.css): orelhas, caudas, asas, nadadeiras, tentáculos,
// tromba, a hélice da turbina, bolhas no tubete, o reflexo no espelho, a gosma que balança, a auréola do mutans…
import { CHAPEUS, caixaComChapeu } from "./humano.js";
import { fase } from "./dentes.js";
import { T, S, S2, traco, vol, volE, volR, pElipse, brilho, luzinha, chao, rosto, faisca, estrela, bolha, parte, braco, tubo, sombraDe, uid } from "./kit.js";

const rf = (h, y, o = {}) => rosto(h, { y, ...o });
const semBoca = (h, y, o = {}) => rosto(h, { y, boca: "sem", ...o });
/** Boquinha avulsa (para focinhos): sorriso pequeno com língua, ou triste, ou "o". */
function boquinha(h, cx, cy, k = 1) {
  if (h === "triste") return `<path d="M${cx - 6 * k} ${cy + 4 * k} Q${cx} ${cy - 1.5 * k} ${cx + 6 * k} ${cy + 4 * k}" fill="none" stroke="${T}" stroke-width="${2.8 * k}" stroke-linecap="round"/>`;
  if (h === "uau") return `<ellipse cx="${cx}" cy="${cy + 2 * k}" rx="${3.6 * k}" ry="${4.4 * k}" fill="${T}"/>`;
  if (h === "neutro") return `<path d="M${cx - 5 * k} ${cy + 1.5 * k} Q${cx} ${cy + 3.5 * k} ${cx + 5 * k} ${cy + 1.5 * k}" fill="none" stroke="${T}" stroke-width="${2.6 * k}" stroke-linecap="round"/>`;
  return `<path d="M${cx - 7 * k} ${cy} Q${cx} ${cy + 9 * k} ${cx + 7 * k} ${cy}Z" fill="${T}"/><path d="M${cx - 3.6 * k} ${cy + 4.2 * k} Q${cx} ${cy + 7 * k} ${cx + 3.6 * k} ${cy + 4.2 * k} Q${cx} ${cy + 2.4 * k} ${cx - 3.6 * k} ${cy + 4.2 * k}Z" fill="#FF8FA3"/>`;
}
/** Rosto pequeno (lesma): o rosto do kit em escala menor. */
const carinhaBicho = (h, cx, cy) => rosto(h, { cx, y: cy, dx: 9, k: 0.72 });
/** Olhinhos miúdos (o rato-toupeira-pelado quase não enxerga). */
function miudinhos(h, cx, y) {
  const olho = (x) => h === "triste" ? `<path d="M${x - 3} ${y + 1} q3 -3 6 0" stroke="${T}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : `<ellipse cx="${x}" cy="${y}" rx="${h === "uau" ? 2.6 : 2.1}" ry="${h === "uau" ? 3 : 1.6}" fill="${T}"/>`;
  return `<g class="olhos">${olho(cx - 13)}${olho(cx + 13)}</g>${h === "uau" ? `<ellipse cx="${cx}" cy="${y + 50}" rx="3" ry="3.4" fill="${T}"/>` : ""}`;
}
const metal = (d, o = {}) => vol(d, "#C3CBD8", { k: 3, luz: true, ...o });
const r2 = (n) => +n.toFixed(2);

/**
 * Boca de tubarão (Tubarão Troca-Troca e Megalodonte; pedido do Alediov, 26/10/2026: a barriga branca se confundia
 * com a boca, "deixe apenas uma"): a ÚNICA parte branca do rosto são os dentes, dentro de uma boca só, toda sobre o
 * corpo. (x0..x1, y0): os cantos; `meio`: quanto o lábio de cima desce no meio; `fundo`: quanto o de baixo desce.
 * Feliz: sorriso aberto com fileira de cima e de baixo e a língua; uau: boca redonda com dentinhos em volta;
 * triste: boca fechada para baixo com duas pontas de dente; neutro: fechada, com a fileira de dentes à mostra.
 */
function bocaTubarao(h, { x0, x1, y0, meio = 10, fundo = 30, nCima = 9, nBaixo = 5, dente = 5.6, escura = "#8E1B2A" }) {
  const cx = (x0 + x1) / 2, L = x1 - x0;
  const cima = (u) => [x0 + L * u, y0 + 2 * meio * u * (1 - u)];
  const baixo = (u) => [x0 + L * u, y0 + 2 * fundo * u * (1 - u)];
  const tri = (pt, larg, alt, dir) => `M${r2(pt[0] - larg)} ${r2(pt[1])}L${r2(pt[0])} ${r2(pt[1] + dir * alt)}L${r2(pt[0] + larg)} ${r2(pt[1])}Z`;
  if (h === "triste") {
    const yb = y0 + meio + 6, c1 = [cx - L * 0.2, yb + 1.4], c2 = [cx + L * 0.2, yb + 1.4];
    return `<path d="${tri(c1, 3.8, 6.6, 1)}${tri(c2, 3.8, 6.6, 1)}" fill="#fff" stroke="${T}" stroke-width="1.5" stroke-linejoin="round"/><path d="M${r2(cx - L * 0.32)} ${r2(yb + 5)}Q${cx} ${r2(yb - 5)} ${r2(cx + L * 0.32)} ${r2(yb + 5)}" fill="none" stroke="${T}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  if (h === "uau") {
    const ry = fundo * 0.42, rx = L * 0.2, cy = y0 + meio + ry * 0.7, id = uid("bt");
    const dentes = [-0.55, -0.18, 0.18, 0.55].map(t => tri([cx + t * rx * 1.4, cy - ry * Math.sqrt(1 - Math.min(0.95, (t * 1.4) ** 2))], 2.6, 4.4, 1)).join("");
    return `<clipPath id="${id}"><ellipse cx="${cx}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}"/></clipPath><ellipse cx="${cx}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${escura}"/><g clip-path="url(#${id})"><ellipse cx="${cx}" cy="${r2(cy + ry * 0.75)}" rx="${r2(rx * 0.7)}" ry="${r2(ry * 0.45)}" fill="#FF8FA3"/><path d="${dentes}" fill="#fff" stroke="${T}" stroke-width="1.3" stroke-linejoin="round"/></g><ellipse cx="${cx}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="none" stroke="${T}" stroke-width="2.6"/>`;
  }
  const larg = (L * 0.86) / nCima / 2;
  const fileiraCima = Array.from({ length: nCima }, (_, i) => tri(cima(0.07 + (0.86 * (i + 0.5)) / nCima), larg, dente, 1)).join("");
  if (h === "neutro") {
    // fechada: o lábio é uma linha e poucos dentes (maiores) aparecem logo abaixo dela
    const n = Math.ceil(nCima / 2), lg = (L * 0.6) / n / 2;
    const poucos = Array.from({ length: n }, (_, i) => tri(cima(0.2 + (0.6 * (i + 0.5)) / n), lg, dente, 1)).join("");
    return `<path d="${poucos}" fill="#fff" stroke="${T}" stroke-width="1.4" stroke-linejoin="round"/><path d="M${x0} ${y0}Q${cx} ${r2(y0 + 2 * meio)} ${x1} ${y0}" fill="none" stroke="${T}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  const id = uid("bt"), boca = `M${x0} ${y0}Q${cx} ${r2(y0 + 2 * meio)} ${x1} ${y0}Q${cx} ${r2(y0 + 2 * fundo)} ${x0} ${y0}Z`;
  const larg2 = (L * 0.5) / nBaixo / 2;
  const fileiraBaixo = Array.from({ length: nBaixo }, (_, i) => tri(baixo(0.25 + (0.5 * (i + 0.5)) / nBaixo), larg2, dente * 0.85, -1)).join("");
  return `<clipPath id="${id}"><path d="${boca}"/></clipPath><path d="${boca}" fill="${escura}"/><g clip-path="url(#${id})"><ellipse cx="${cx}" cy="${r2(y0 + fundo * 0.5 + 2)}" rx="${r2(L * 0.2)}" ry="${r2(fundo * 0.16)}" fill="#FF8FA3"/><path d="${fileiraCima}" fill="#fff" stroke="${T}" stroke-width="1.4" stroke-linejoin="round"/><path d="${fileiraBaixo}" fill="#F4F6FB" stroke="${T}" stroke-width="1.2" stroke-linejoin="round"/></g><path d="${boca}" fill="none" stroke="${T}" stroke-width="2.6" stroke-linejoin="round"/>`;
}

/**
 * Boca do dragão (Sisorath Filhote; pedido do Alediov, 26/10/2026: os chifres e os dentes pareciam desconexos):
 * as duas presas saem do lábio de cima, DENTRO da boca, e a boca fica inteira na cabeça.
 */
function bocaDragao(h, cx, y) {
  const presa = (x, yy, alt = 4.6) => `M${r2(x - 2.4)} ${r2(yy)}L${r2(x)} ${r2(yy + alt)}L${r2(x + 2.4)} ${r2(yy)}Z`;
  if (h === "triste") return `<path d="M${cx - 9} ${y + 7}Q${cx} ${y - 1} ${cx + 9} ${y + 7}" fill="none" stroke="${T}" stroke-width="3.2" stroke-linecap="round"/><path d="${presa(cx - 4.6, y + 3.6, 3.6)}${presa(cx + 4.6, y + 3.6, 3.6)}" fill="#fff" stroke="${T}" stroke-width="1.4" stroke-linejoin="round"/>`;
  if (h === "uau") {
    const id = uid("bd");
    return `<clipPath id="${id}"><ellipse cx="${cx}" cy="${y + 5}" rx="6.4" ry="7.4"/></clipPath><ellipse cx="${cx}" cy="${y + 5}" rx="6.4" ry="7.4" fill="${T}"/><g clip-path="url(#${id})"><ellipse cx="${cx}" cy="${y + 10}" rx="4" ry="2.8" fill="#FF8FA3"/><path d="${presa(cx - 3.2, y - 2.6, 4.4)}${presa(cx + 3.2, y - 2.6, 4.4)}" fill="#fff" stroke="${T}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
  }
  if (h === "neutro") return `<path d="M${cx - 9} ${y + 3}Q${cx} ${y + 6.5} ${cx + 9} ${y + 3}" fill="none" stroke="${T}" stroke-width="3.2" stroke-linecap="round"/><path d="${presa(cx - 5, y + 4.2, 3.8)}${presa(cx + 5, y + 4.2, 3.8)}" fill="#fff" stroke="${T}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const id = uid("bd"), boca = `M${cx - 11} ${y - 1}Q${cx} ${y + 16} ${cx + 11} ${y - 1}Z`;
  return `<clipPath id="${id}"><path d="${boca}"/></clipPath><path d="${boca}" fill="${T}"/><g clip-path="url(#${id})"><path d="M${cx - 6.4} ${y + 6.6}Q${cx} ${y + 12} ${cx + 6.4} ${y + 6.6}Q${cx} ${y + 3.6} ${cx - 6.4} ${y + 6.6}Z" fill="#FF8FA3"/><path d="${presa(cx - 6.2, y - 1.4, 5)}${presa(cx + 6.2, y - 1.4, 5)}" fill="#fff" stroke="${T}" stroke-width="1.3" stroke-linejoin="round"/></g>`;
}

/**
 * Chifre do Sisorath Filhote: curvo, com anéis, e a base DENTRO da cabeça (é desenhado antes dela, então a cabeça
 * cobre a raiz e o chifre nasce dela). lado: -1 esquerdo, 1 direito.
 */
function chifre(lado) {
  const X = (x) => (lado < 0 ? x : 120 - x);
  const d = `M${X(31)} 41 C${X(26)} 30 ${X(22)} 18 ${X(24)} 4 C${X(32)} 14 ${X(42)} 22 ${X(47)} 35Z`;
  return `${vol(d, "#F4E6C8", { k: 1.6, contorno: 2.6, sombra: "#D9C39A" })}<path d="M${X(25.5)} 25 Q${X(31)} 27.5 ${X(37)} 23 M${X(23.5)} 14 Q${X(27)} 15.5 ${X(30.5)} 12" stroke="#C9AE7E" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
}
/** Boca do pacu (dentes de gente, a graça dele): a língua fica dentro da boca, recortada por ela. */
function bocaPacu() {
  const id = uid("bp"), boca = "M34 84 Q56 108 78 84 Z";
  return `<clipPath id="${id}"><path d="${boca}"/></clipPath><path d="${boca}" fill="${T}"/><g clip-path="url(#${id})"><ellipse cx="56" cy="95.5" rx="10" ry="4" fill="#FF8FA3"/></g><path d="${boca}" fill="none" stroke="${T}" stroke-width="2" stroke-linejoin="round"/>
    ${[38, 45, 52, 59, 66, 73].map((x, i) => `<rect x="${x - 2.6}" y="${84 + (i === 0 || i === 5 ? 1.2 : 0)}" width="6.2" height="${i === 0 || i === 5 ? 5.2 : 6.4}" rx="1.6" fill="#FFFDF6" stroke="${T}" stroke-width="1.4"/>`).join("")}`;
}
const PACU = "M8 76 C8 46 32 28 62 28 C90 28 104 50 104 76 C104 104 86 122 58 122 C30 122 8 104 8 76Z";
/** Barriga do pacu: a parte de baixo do corpo, recortada pelo contorno dele (antes era uma meia-lua que parecia boca). */
function barrigaPacu() {
  const c1 = uid("bp"), c2 = uid("bp"), d = "M0 103 Q56 117 112 101 V130 H0Z", cor = "#F2A65A";
  return `<clipPath id="${c1}"><path d="${PACU}"/></clipPath><clipPath id="${c2}"><path d="${d}"/></clipPath><g clip-path="url(#${c1})"><path d="${d}" fill="${sombraDe(cor)}"/><g clip-path="url(#${c2})"><path d="${PACU}" fill="${cor}" transform="translate(2.6 -3)"/></g><path d="M0 103 Q56 117 112 101" fill="none" stroke="${T}" stroke-width="2.6"/></g><path d="${PACU}" fill="none" ${S}/>`;
}
/** Boca da lesma: a rádula (a "língua" de dentinhos da lesma) fica DENTRO da boca e pulsa. */
function bocaLesma(h, cx, y) {
  if (h === "triste") return `<path d="M${cx - 5} ${y + 4} Q${cx} ${y} ${cx + 5} ${y + 4}" fill="none" stroke="${T}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (h === "neutro") return `<path d="M${cx - 5} ${y + 1.6} Q${cx} ${y + 3.4} ${cx + 5} ${y + 1.6}" fill="none" stroke="${T}" stroke-width="2.4" stroke-linecap="round"/>`;
  const id = uid("bl"), boca = h === "uau" ? pElipse(cx, y + 3.4, 4.2, 5) : `M${cx - 7.4} ${y}Q${cx} ${y + 12} ${cx + 7.4} ${y}Z`;
  const radula = parte("pa-pulsa", cx, y + 6, `<rect x="${cx - 5.4}" y="${y + 4.4}" width="10.8" height="4" rx="2" fill="#FFB3C8"/><path d="M${cx - 4} ${y + 6.4} h8" stroke="#fff" stroke-width="1.2" stroke-dasharray="1 1.1"/>`);
  return `<clipPath id="${id}"><path d="${boca}"/></clipPath><path d="${boca}" fill="${T}"/><g clip-path="url(#${id})">${radula}</g>`;
}

/** A presa do narval: um cone em espiral (é um canino!). */
function presaEspiral() {
  const B = [63, 31], P = [99, -2], v = [P[0] - B[0], P[1] - B[1]], L = Math.hypot(v[0], v[1]), u = [v[0] / L, v[1] / L], n = [-u[1], u[0]], r = (x) => +x.toFixed(2);
  const pt = (t, s) => { const hw = 5.2 * (1 - t); return [B[0] + v[0] * t + n[0] * hw * s, B[1] + v[1] * t + n[1] * hw * s]; };
  const a = pt(0, -1), b = pt(0, 1);
  let sulcos = "";
  for (const t of [0.16, 0.32, 0.48, 0.64, 0.8]) { const p1 = pt(t, -0.85), p2 = pt(t + 0.07, 0.85); sulcos += `M${r(p1[0])} ${r(p1[1])}L${r(p2[0])} ${r(p2[1])}`; }
  return vol(`M${r(a[0])} ${r(a[1])}L${P[0]} ${P[1]}L${r(b[0])} ${r(b[1])}Z`, "#FFF8EC", { k: 1.6, contorno: 2.6, sombra: "#E3D3B0" }) + `<path d="${sulcos}" stroke="#C9B48A" stroke-width="1.8" stroke-linecap="round"/>`;
}

// Cada desenho: (humor) => SVG interno. TOPO: [y do topo da cabeça, escala do chapéu de evento].
export const TOPO_BICHO = {
  escovinha: [8, 0.85], fiona: [30, 1.15], pastinha: [16, 0.75], espelhinho: [14, 1], carpule: [26, 0.9], tubetinho: [8, 0.95], turbina: [16, 0.8],
  castor: [26, 1.15], hipo: [22, 1.1], capivara: [24, 1.1], tubarao: [24, 1.1], morsa: [24, 1.15], narval: [24, 1.15], polvo: [14, 1.2], mamute: [16, 1.2],
  unicornio: [18, 1.05], sisorath: [22, 1.1], gosminha: [30, 1.05], golem: [10, 1.1], mutans: [30, 0.9],
  sondinha: [36, 0.85], coelho: [30, 1.05], amoxi: [12, 0.9], pacu: [26, 1.15], cureta: [36, 0.85], ficha: [16, 1.05], lesma: [36, 1.05],
  ourico: [26, 1.15], megalodonte: [22, 1.15], rato: [32, 1.1],
};

export const BICHOS = {
  // ---------------- instrumentos ----------------
  escovinha: (h) => {
    const c = "#7FD6F5";
    return `${chao(60, 128, 24)}
    ${braco(41, 80, -1, c)}${braco(79, 80, 1, c)}
    ${volR(40, 46, 40, 80, 18, c, { k: 5 })}
    <rect x="46" y="52" width="28" height="7" rx="3.5" fill="#4FB3D9"/>
    ${volR(46, 101, 28, 19, 8, "#4FB3D9", { k: 2, contorno: 2.4 })}<path d="M52 107 h16 M52 113 h16" stroke="#2E86B8" stroke-width="2" stroke-linecap="round"/>
    ${parte("pa-balanca", 60, 26, Array.from({ length: 6 }, (_, i) => volR(33 + i * 9.4, 6, 8, 22, 4, i % 2 ? "#BFF0FF" : "#FF9EC2", { k: 1.6, contorno: 2.2 })).join(""))}
    ${volR(30, 24, 60, 24, 9, "#F4F6FB", { k: 3 })}
    <path d="M37 4 C42 -3 57 -3 60 4 C63 -3 78 -3 83 5" fill="none" stroke="${T}" stroke-width="10" stroke-linecap="round"/>
    <path d="M37 4 C42 -3 57 -3 60 4 C63 -3 78 -3 83 5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
    <path d="M41 2 C45 -1 54 -1 57 2 M64 2 C68 -1 76 -1 79 3" fill="none" stroke="#7FD6F5" stroke-width="2.2" stroke-linecap="round"/>
    ${bolha(44, -2, 2.2, 0)}${bolha(76, -3, 1.8, 1.1)}${bolha(60, -4, 1.4, 1.9)}
    ${brilho("M76.5 63 v30", 4.4)}${rf(h, 74, { dx: 11, k: 0.9 })}`;
  },
  fiona: (h) => {
    const c = "#9BE3B8";
    return `${chao(60, 128, 36)}
    ${parte("pa-balanca", 60, 34, tubo("M60 34 C58 12 84 0 96 12 C106 22 96 38 84 30", "#FFFFFF", { w: 3.4, contorno: 1.9, sombra: "#CFE9DA" }))}
    ${braco(24, 84, -1, c)}${braco(96, 84, 1, c)}
    ${volR(22, 34, 76, 90, 30, c, { k: 6 })}
    <path d="M27 49 Q60 38 93 49" fill="none" stroke="#4DB07A" stroke-width="3" stroke-linecap="round"/>
    ${volR(39, 103, 42, 15, 7, "#FFFFFF", { k: 2, contorno: 2.2 })}<path d="M45 110.5 q4 -4 8 0 t8 0 t8 0 t8 0" stroke="#4DB07A" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${metal("M52 28 h16 a3 3 0 0 1 3 3 v6 h-22 v-6 a3 3 0 0 1 3 -3z", { contorno: 2.4, k: 1.6 })}
    ${brilho("M86 54 q4 16 0 32")}${luzinha(84, 46, 2.2)}${rf(h, 68, { cilios: true })}`;
  },
  pastinha: (h) => `${chao(60, 128, 36)}
    ${braco(36, 72, -1, "#F4F6FB")}${braco(84, 72, 1, "#F4F6FB")}
    ${vol("M44 26 H76 L92 108 H28 Z", "#F4F6FB", { k: 5 })}
    <path d="M34.63 74 H85.37 L89.27 94 H30.73Z" fill="#2F6BFF"/><path d="M32.9 84 H87.1" stroke="#7FD6F5" stroke-width="4"/>
    <path d="M34.63 74 H85.37 M30.73 94 H89.27" stroke="${T}" stroke-width="2" opacity=".35"/>
    ${volR(24, 106, 72, 18, 4, "#DDE2EE", { k: 2 })}<path d="M32 110 v10 M40 110 v10 M48 110 v10 M56 110 v10 M64 110 v10 M72 110 v10 M80 110 v10 M88 110 v10" stroke="#9AA3C7" stroke-width="2"/>
    ${volR(47, 2, 26, 24, 5, "#E0434A", { k: 2.4 })}<path d="M52 9 h16 M52 15 h16 M52 21 h16" stroke="#A3232A" stroke-width="2"/>
    ${faisca(16, 44, 5, "#BFF0FF", 0)}${faisca(104, 52, 4, "#BFF0FF", 1)}${faisca(98, 22, 3, "#FFFFFF", 1.8)}
    ${brilho("M76 55 l2.6 13", 4)}${luzinha(69, 30, 2)}${rf(h, 44, { dx: 11 })}`,
  espelhinho: (h) => {
    const id = uid("e");
    return `${chao(60, 128, 18)}
    ${metal("M54 76 h12 v46 a6 6 0 0 1 -12 0z", { k: 2 })}<path d="M55 92 h10 M55 100 h10 M55 108 h10 M55 116 h10" stroke="#7F8AA3" stroke-width="2"/>
    ${braco(28, 58, -1, "#9AA3C7")}${braco(92, 58, 1, "#9AA3C7")}
    ${volE(60, 44, 36, 36, "#9AA3C7", { k: 4, luz: true })}
    <clipPath id="${id}"><circle cx="60" cy="44" r="28"/></clipPath>
    <circle cx="60" cy="44" r="28" fill="#DCEFFF"/>
    <g clip-path="url(#${id})"><path d="M32 70 Q60 80 88 70 V80 H32Z" fill="#C5E3FA"/>${parte("pa-varre", 60, 44, `<path d="M52 4 L64 4 L46 84 L34 84Z" fill="#fff" opacity=".75"/>`)}</g>
    <circle cx="60" cy="44" r="28" fill="none" ${S2}/>
    ${brilho("M40 34 Q48 20 62 18", 6, 0.9)}${rf(h, 46, { dx: 12 })}`;
  },
  carpule: (h) => {
    const id = uid("c");
    return `${chao(60, 128, 24)}
    <circle cx="60" cy="8" r="12" fill="none" stroke="${T}" stroke-width="8"/><circle cx="60" cy="8" r="12" fill="none" stroke="#C3CBD8" stroke-width="4"/><path d="M66 0 a10 10 0 0 1 4 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${metal("M57 18 h6 v14 h-6z", { contorno: 2.4, k: 1 })}
    ${volE(33, 34, 14, 6, "#C3CBD8", { k: 1.6, luz: true })}${volE(87, 34, 14, 6, "#C3CBD8", { k: 1.6, luz: true })}
    ${braco(37, 62, -1, "#D5DCE6")}${braco(83, 62, 1, "#D5DCE6")}
    ${volR(36, 30, 48, 80, 12, "#D5DCE6", { k: 4, luz: true })}
    <clipPath id="${id}"><rect x="45" y="78" width="30" height="26" rx="6"/></clipPath>
    <rect x="45" y="78" width="30" height="26" rx="6" fill="#EAF6FF"/>
    <g clip-path="url(#${id})"><rect x="45" y="86" width="30" height="18" fill="#BFE6FF"/><rect x="45" y="82" width="30" height="4" fill="#D93A3A"/>${bolha(54, 100, 1.6, 0)}${bolha(64, 102, 1.2, 1.3)}</g>
    <rect x="45" y="78" width="30" height="26" rx="6" fill="none" ${S2}/>
    ${volR(54, 108, 12, 18, 3, "#2F6BFF", { k: 1.4, contorno: 2.4 })}
    ${brilho("M79.6 40 v30", 3.6)}${rf(h, 50, { dx: 11 })}`;
  },
  tubetinho: (h) => {
    const id = uid("t");
    return `${chao(60, 128, 28)}
    ${metal("M44 -2 h32 a4 4 0 0 1 4 4 v10 h-40 v-10 a4 4 0 0 1 4 -4z", { k: 1.6 })}
    ${braco(35, 68, -1, "#EAF6FF")}${braco(85, 68, 1, "#EAF6FF")}
    ${volR(34, 10, 52, 110, 16, "#EAF6FF", { k: 4, sombra: "#C8DDF2" })}
    <clipPath id="${id}"><rect x="38" y="44" width="44" height="72" rx="12"/></clipPath>
    <g clip-path="url(#${id})"><rect x="38" y="44" width="44" height="72" fill="#BFE6FF"/><path d="M38 50 q11 -5 22 0 t22 0 V44 H38Z" fill="#DCF1FF"/>${bolha(46, 104, 2.2, 0)}${bolha(70, 110, 1.6, 0.9)}${bolha(58, 96, 1.4, 1.7)}${bolha(76, 92, 1.8, 2.3)}</g>
    <rect x="34.6" y="28" width="50.8" height="12" fill="#D93A3A" stroke="${T}" stroke-width="2.4"/><path d="M38 31.5 h14" stroke="#fff" stroke-width="2" opacity=".6" stroke-linecap="round"/>
    ${volR(38, 106, 44, 14, 5, "#3A3F52", { k: 2, contorno: 2.4 })}
    <rect x="34" y="10" width="52" height="110" rx="16" fill="none" ${S}/>
    ${brilho("M79 20 v80", 4)}${luzinha(79, 15, 1.8)}${rf(h, 68, { dx: 11 })}`;
  },
  turbina: (h) => `${chao(60, 128, 24)}
    ${parte("pa-pulsa", 60, 4, `${vol("M60 -6 l5 10 h-10z", "#F2B33D", { k: 1, contorno: 2.2 })}`)}
    ${metal("M57 2 h6 v12 h-6z", { contorno: 2.2, k: 1 })}
    ${volE(60, 30, 20, 20, "#D5DCE6", { k: 3, luz: true })}
    ${parte("pa-gira", 60, 30, `<circle cx="60" cy="30" r="9" fill="#9AA3C7" ${S2}/><path d="M60 22 v16 M52 30 h16 M54.3 24.3 l11.4 11.4 M65.7 24.3 l-11.4 11.4" stroke="#6F7890" stroke-width="2" stroke-linecap="round"/>`)}
    ${[[22, 22, -9, -7, 0], [98, 22, 9, -7, 0.4], [18, 30, -10, 2, 0.8], [102, 30, 10, 2, 0.2], [26, 14, -6, -10, 0.6], [94, 14, 6, -10, 1]].map(([x, y, sx, sy, d]) => `<circle class="pa pa-spray" cx="${x}" cy="${y}" r="2.6" fill="#7FD6F5" stroke="${T}" stroke-width="1" style="transform-origin:${x}px ${y}px;--sx:${sx}px;--sy:${sy}px;--pd:${d}s"/>`).join("")}
    ${braco(42, 68, -1, "#C3CBD8")}${braco(78, 68, 1, "#C3CBD8")}
    ${vol("M40 46 Q60 40 80 46 L76 124 H44 Z", "#C3CBD8", { k: 4, luz: true })}
    <path d="M44.5 100 h31 M45 108 h30 M45.5 116 h29" stroke="#8F9AB5" stroke-width="2.6" stroke-linecap="round"/>
    ${parte("pa-luz", 60, 80, `<path d="M30 70 h-12 M30 80 h-16 M30 90 h-10 M90 70 h12 M90 80 h16 M90 90 h10" stroke="#7FD6F5" stroke-width="3" stroke-linecap="round"/>`)}
    ${brilho("M73 77 l-1 16", 4)}${rf(h, 66, { dx: 11 })}`,

  // ---------------- bichos dentuços ----------------
  castor: (h) => `${chao(60, 128, 40)}
    ${parte("pa-cauda", 84, 104, `<g transform="rotate(25 96 104)">${volE(96, 104, 16, 24, "#6E4223", { k: 3 })}<path d="M86 92 l20 24 M90 86 l16 20 M84 100 l22 8 M88 112 l14 -14" stroke="#4A2C16" stroke-width="1.8" opacity=".8"/></g>`)}
    ${parte("pa-orelha e", 36, 36, `${volE(32, 30, 10, 10, "#8A5A3B", { k: 2.4 })}<circle cx="32" cy="30" r="4.5" fill="#6E4223"/>`)}
    ${parte("pa-orelha d", 84, 36, `${volE(88, 30, 10, 10, "#8A5A3B", { k: 2.4 })}<circle cx="88" cy="30" r="4.5" fill="#6E4223"/>`)}
    ${braco(26, 92, -1, "#A8714C")}${braco(94, 92, 1, "#A8714C")}
    ${volE(60, 72, 40, 50, "#A8714C", { k: 6 })}
    ${volE(60, 102, 24, 18, "#C99A74", { k: 2, contorno: 0 })}
    ${volE(60, 74, 22, 16, "#E8C3A8", { k: 2.4, contorno: 2.4 })}
    ${volE(60, 66, 7, 5, T, { k: 1, contorno: 0 })}${luzinha(62, 64.5, 1.5)}
    ${h === "triste" ? `<path d="M47 82 Q60 74 73 82" stroke="${T}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : ""}
    <path d="M42 72 h-10 M43 77 h-10 M78 72 h10 M77 77 h10" stroke="#6E4223" stroke-width="1.6" stroke-linecap="round"/>
    ${volR(51.5, 78, 8.5, 14, 2, "#F28A1E", { k: 1.4, contorno: 2.2, sombra: "#C8661A" })}${volR(60, 78, 8.5, 14, 2, "#F28A1E", { k: 1.4, contorno: 2.2, sombra: "#C8661A" })}
    <path d="M54 80 v6 M62.5 80 v6" stroke="#FFC48A" stroke-width="1.6" stroke-linecap="round"/>
    ${brilho("M84 40 q8 14 6 30")}${luzinha(80, 34, 2.2)}${semBoca(h, 50, { dx: 15 })}`,
  hipo: (h) => `${chao(60, 128, 44)}
    ${parte("pa-orelha e", 38, 30, `${volE(34, 26, 8, 8, "#8F86C9", { k: 2 })}<circle cx="34" cy="26" r="3.6" fill="#E9A3C8"/>`)}
    ${parte("pa-orelha d", 82, 30, `${volE(86, 26, 8, 8, "#8F86C9", { k: 2 })}<circle cx="86" cy="26" r="3.6" fill="#E9A3C8"/>`)}
    ${volE(60, 52, 36, 32, "#A9A0D6", { k: 5 })}
    ${volE(60, 94, 48, 30, "#BDB5E4", { k: 5 })}
    ${volE(44, 82, 4.4, 5.2, "#6E64A8", { k: 1, contorno: 0 })}${volE(76, 82, 4.4, 5.2, "#6E64A8", { k: 1, contorno: 0 })}
    ${h === "triste" ? `<path d="M34 108 Q60 96 86 108" fill="none" stroke="${T}" stroke-width="3" stroke-linecap="round"/>` : h === "uau" ? `<ellipse cx="60" cy="104" rx="12" ry="9" fill="${T}"/><ellipse cx="60" cy="108" rx="7" ry="3.6" fill="#FF8FA3"/>` : `<path d="M30 100 Q60 118 90 100" fill="none" stroke="${T}" stroke-width="3" stroke-linecap="round"/>`}
    ${vol("M40 104 l3.2 -11 l4.6 12 Z", "#FFFFFF", { k: 1, contorno: 2.2 })}${vol("M80 104 l-3.2 -11 l-4.6 12 Z", "#FFFFFF", { k: 1, contorno: 2.2 })}
    ${brilho("M34 42 q2 -12 12 -16")}${brilho("M88 84 q4 8 2 16", 4, 0.7)}${semBoca(h, 50, { dx: 14 })}`,
  capivara: (h) => `${chao(60, 128, 42)}
    ${parte("pa-orelha e", 38, 36, volE(34, 30, 7, 9, "#8A5A3B", { k: 1.6 }))}
    ${parte("pa-orelha d", 82, 36, volE(86, 30, 7, 9, "#8A5A3B", { k: 1.6 }))}
    ${braco(25, 96, -1, "#B07A4F")}${braco(95, 96, 1, "#B07A4F")}
    ${vol("M22 60 C22 30 40 22 60 22 C80 22 98 30 98 60 L96 112 C94 124 26 124 24 112 Z", "#B07A4F", { k: 6 })}
    ${volR(34, 64, 52, 40, 18, "#8A5A3B", { k: 3 })}
    <ellipse cx="50" cy="74" rx="3.6" ry="2.6" fill="${T}"/><ellipse cx="70" cy="74" rx="3.6" ry="2.6" fill="${T}"/>
    ${h === "triste" ? `<path d="M53 92 Q60 88 67 92" fill="none" stroke="${T}" stroke-width="2.5" stroke-linecap="round"/>` : `<path d="M53 89 Q60 94 67 89" fill="none" stroke="${T}" stroke-width="2.5" stroke-linecap="round"/>`}
    <rect x="56" y="92" width="4" height="6" fill="#fff" ${traco(1.8)}/><rect x="60" y="92" width="4" height="6" fill="#fff" ${traco(1.8)}/>
    ${parte("pa-flutua", 60, 26, `${volE(60, 14, 12, 12, "#FF9A2E", { k: 2.6 })}<circle cx="56" cy="11" r="1" fill="#E07A10"/><circle cx="63" cy="17" r="1" fill="#E07A10"/>${luzinha(64, 8, 2)}${vol("M60 2 q4 -6 10 -4 q-4 6 -10 4", "#4CAF6E", { k: 1, contorno: 2 })}`)}
    ${brilho("M86 38 q6 10 6 24", 4.5)}${semBoca(h === "feliz" ? "neutro" : h, 46, { dx: 16 })}`,
  tubarao: (h) => `${chao(60, 128, 40)}
    ${parte("pa-nadadeira e", 22, 82, vol("M22 82 L4 70 L10 98 Z", "#5C8DD6", { k: 2 }))}
    ${parte("pa-nadadeira d", 98, 82, vol("M98 82 L116 70 L110 98 Z", "#5C8DD6", { k: 2 }))}
    ${vol("M60 0 L72 26 C96 30 104 56 102 80 C100 108 82 124 60 124 C38 124 20 108 18 80 C16 56 24 30 48 26 Z", "#7FA6E0", { k: 6 })}
    <path d="M24 60 q-3 6 0 12 M28 58 q-3 6 0 12 M96 60 q3 6 0 12 M92 58 q3 6 0 12" stroke="#4A6FB0" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${bocaTubarao(h, { x0: 30, x1: 90, y0: 74, meio: 6, fundo: 30, nCima: 9, nBaixo: 5, dente: 6.6 })}
    ${bolha(108, 30, 2.6, 0, "#DCEFFF")}${bolha(112, 18, 1.8, 1.2, "#DCEFFF")}
    ${brilho("M78 34 q12 8 16 22")}${luzinha(70, 26, 2)}${semBoca(h, 56, { dx: 15 })}`,
  morsa: (h) => `${chao(60, 128, 44)}
    ${parte("pa-nadadeira e", 30, 108, volE(22, 112, 16, 8, "#7A4B26", { k: 2 }))}
    ${parte("pa-nadadeira d", 90, 108, volE(98, 112, 16, 8, "#7A4B26", { k: 2 }))}
    ${vol("M18 72 C18 34 38 22 60 22 C82 22 102 34 102 72 C102 104 86 120 60 120 C34 120 18 104 18 72Z", "#B07A4F", { k: 6 })}
    ${vol("M48 84 C46 100 44 112 46 124 L52 124 C52 110 54 98 56 88 Z", "#FFF8EC", { k: 1.4, contorno: 2.2 })}${vol("M72 84 C74 100 76 112 74 124 L68 124 C68 110 66 98 64 88 Z", "#FFF8EC", { k: 1.4, contorno: 2.2 })}
    ${volE(48, 78, 14, 11, "#E8C3A8", { k: 2, contorno: 2.4 })}${volE(72, 78, 14, 11, "#E8C3A8", { k: 2, contorno: 2.4 })}
    ${volE(60, 68, 6.5, 4.5, T, { k: 1, contorno: 0 })}${luzinha(62, 66.5, 1.4)}
    <g fill="#8A5A3B"><circle cx="42" cy="76" r="1.5"/><circle cx="48" cy="82" r="1.5"/><circle cx="40" cy="83" r="1.5"/><circle cx="78" cy="76" r="1.5"/><circle cx="72" cy="82" r="1.5"/><circle cx="80" cy="83" r="1.5"/></g>
    <path d="M36 78 h-10 M36 84 l-9 3 M84 78 h10 M84 84 l9 3" stroke="#6E4223" stroke-width="1.6" stroke-linecap="round"/>
    ${brilho("M84 40 q10 10 12 26")}${luzinha(78, 32, 2.2)}${semBoca(h, 50, { dx: 15 })}`,
  narval: (h) => `${chao(60, 128, 42)}
    ${presaEspiral()}
    ${faisca(104, 4, 4.4, "#FFF3B0", 0)}
    ${parte("pa-nadadeira e", 18, 100, vol("M18 100 L2 90 L8 116 Z", "#6F9BD1", { k: 2 }))}
    ${parte("pa-nadadeira d", 102, 100, vol("M102 100 L118 90 L112 116 Z", "#6F9BD1", { k: 2 }))}
    ${vol("M16 78 C16 40 36 26 60 26 C84 26 104 40 104 78 C104 108 84 124 60 124 C36 124 16 108 16 78Z", "#8FB6E8", { k: 6 })}
    <g fill="#6F9BD1"><circle cx="34" cy="48" r="3"/><circle cx="84" cy="44" r="2.5"/><circle cx="92" cy="60" r="3"/><circle cx="28" cy="64" r="2"/><circle cx="40" cy="36" r="1.6"/></g>
    ${bolha(10, 40, 2.2, 0.4, "#DCEFFF")}${bolha(16, 26, 1.6, 1.6, "#DCEFFF")}
    ${brilho("M82 36 q12 8 14 22")}${luzinha(74, 32, 2.2)}${rf(h, 66, { dx: 15 })}`,
  polvo: (h) => {
    const tent = (x, d, i) => parte("pa-tentaculo", x, 84, `${tubo(`M${x} 84 C${x - 6 * d} 100 ${x + 10 * d} 108 ${x - 2 * d} 122 C${x - 10 * d} 126 ${x - 14 * d} 118 ${x - 8 * d} 114`, "#EE93D0", { w: 7.5, contorno: 2.4 })}<circle cx="${x + 1 * d}" cy="102" r="1.3" fill="#FFD6EE"/><circle cx="${x + 2 * d}" cy="112" r="1.3" fill="#FFD6EE"/>`, i * 0.3);
    return `${chao(60, 128, 44)}
    ${[[20, 1], [34, 1], [48, 1], [72, -1], [86, -1], [100, -1]].map(([x, d], i) => tent(x, d, i)).join("")}
    ${parte("pa-tentaculo", 14, 74, `${tubo("M8 74 C-2 62 2 50 10 48", "#EE93D0", { w: 7.5, contorno: 2.4 })}${volR(4, 16, 8, 34, 4, "#7FD6F5", { k: 1.4, contorno: 2.2 })}${Array.from({ length: 4 }, (_, i) => `<rect x="${1 + i * 3.4}" y="4" width="3" height="10" rx="1.5" fill="${i % 2 ? "#BFF0FF" : "#FF9EC2"}" ${traco(1.4)}/>`).join("")}`, 0.5)}
    ${parte("pa-tentaculo", 106, 74, `${tubo("M112 74 C122 62 118 50 110 48", "#EE93D0", { w: 7.5, contorno: 2.4 })}${vol("M104 30 h12 v4 l2 4 v12 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 1 -4 -4 v-12 l2 -4z", "#9BE3B8", { k: 1.6, contorno: 2.2 })}<rect x="104" y="24" width="12" height="7" rx="2" fill="#2F6BFF" ${traco(2)}/><path d="M106 42 h8" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`, 1.1)}
    ${vol("M18 80 C12 36 34 14 60 14 C86 14 108 36 102 80 C96 92 24 92 18 80Z", "#F29BD6", { k: 6 })}
    <g fill="#D66BB5"><circle cx="38" cy="36" r="4"/><circle cx="82" cy="32" r="3"/><circle cx="88" cy="50" r="2.5"/><circle cx="28" cy="58" r="2"/></g>
    ${brilho("M80 26 q12 8 14 22")}${luzinha(72, 22, 2.2)}${rf(h, 56, { dx: 15 })}`;
  },
  mamute: (h) => `${chao(60, 128, 46)}
    ${parte("pa-orelha e", 30, 48, volE(18, 62, 16, 26, "#8A5A3B", { k: 3 }))}
    ${parte("pa-orelha d", 90, 48, volE(102, 62, 16, 26, "#8A5A3B", { k: 3 }))}
    ${vol("M24 60 C22 28 40 12 60 12 C80 12 98 28 96 60 C96 84 82 96 60 96 C38 96 24 84 24 60Z", "#A8714C", { k: 6 })}
    ${vol("M34 24 l4 -11 l4 8 l5 -13 l4 10 l5 -13 l4 12 l5 -11 l4 10 l5 -9 l4 11 C70 26 50 26 34 24Z", "#7A4B26", { k: 1.4, contorno: 2.2 })}
    ${vol("M42 86 C30 106 34 124 52 122 C40 112 42 100 50 90 Z", "#FFF8EC", { k: 1.4, contorno: 2.4 })}${vol("M78 86 C90 106 86 124 68 122 C80 112 78 100 70 90 Z", "#FFF8EC", { k: 1.4, contorno: 2.4 })}
    ${parte("pa-tromba", 60, 72, `${tubo("M60 70 C60 88 58 100 56 108 C53 118 60 124 67 120 C72 117 71 110 66 110", "#A8714C", { w: 11, contorno: 2.8 })}<path d="M54.5 82 h10 M54 92 h9.5 M52.5 101 h9" stroke="#7A4B26" stroke-width="2" stroke-linecap="round"/>`)}
    ${faisca(8, 12, 5, "#DCEFFF", 0)}${faisca(110, 20, 4, "#FFFFFF", 0.8)}${faisca(112, 96, 3.4, "#DCEFFF", 1.6)}
    ${brilho("M82 32 q8 10 8 22")}${luzinha(76, 26, 2.2)}${semBoca(h, 54, { dx: 15 })}`,

  // ---------------- fantasia ----------------
  unicornio: (h) => {
    const crina = ["#FF9EC2", "#FFE08A", "#9BE3B8", "#A78BFA"];
    return `${chao(60, 128, 40)}
    ${parte("pa-cabelo", 30, 40, [0, 1, 2, 3].map(i => vol(`M${24 - i * 3} ${44 + i * 16} C${10 - i * 2} ${62 + i * 16} ${14 - i} ${80 + i * 12} ${26 - i} ${92 + i * 8} C${22 - i} ${78 + i * 12} ${26 - i} ${64 + i * 14} ${32 - i} ${52 + i * 14}Z`, crina[i], { k: 2, contorno: 2.4 })).join(""))}
    ${parte("pa-cabelo", 90, 40, [0, 1, 2, 3].map(i => vol(`M${96 + i * 3} ${44 + i * 16} C${110 + i * 2} ${62 + i * 16} ${106 + i} ${80 + i * 12} ${94 + i} ${92 + i * 8} C${98 + i} ${78 + i * 12} ${94 + i} ${64 + i * 14} ${88 + i} ${52 + i * 14}Z`, crina[(i + 2) % 4], { k: 2, contorno: 2.4 })).join(""), 0.6)}
    ${parte("pa-orelha e", 38, 22, vol("M34 22 L30 2 L46 16 Z", "#FFFFFF", { k: 1.6 }) + `<path d="M35 16 L33 8 L41 15Z" fill="#FFC9DE"/>`)}
    ${parte("pa-orelha d", 82, 22, vol("M86 22 L90 2 L74 16 Z", "#FFFFFF", { k: 1.6 }) + `<path d="M85 16 L87 8 L79 15Z" fill="#FFC9DE"/>`)}
    ${vol("M24 56 C24 30 40 20 60 20 C80 20 96 30 96 56 L94 92 C94 112 80 122 60 122 C40 122 26 112 26 92 Z", "#FFFFFF", { k: 6 })}
    ${[0, 1, 2, 3].map(i => vol(`M${40 + i * 10} 24 C${42 + i * 10} 14 ${50 + i * 10} 12 ${52 + i * 10} 22 C${48 + i * 10} 28 ${44 + i * 10} 30 ${40 + i * 10} 24Z`, crina[i], { k: 1.2, contorno: 2.2 })).join("")}
    ${vol("M60 -8 L69 24 L51 24 Z", "#BFF0FF", { k: 1.6, luz: true })}<path d="M55 16 l12 -3 M57 8 l8 -2 M58.5 1 l4 -1" stroke="#4FB3D9" stroke-width="2" stroke-linecap="round"/>
    ${faisca(74, -4, 4.4, "#FFFFFF", 0)}
    ${volE(60, 98, 24, 16, "#FFE1EC", { k: 2, contorno: 2.4 })}<ellipse cx="51" cy="98" rx="3" ry="4" fill="#D66B8F"/><ellipse cx="69" cy="98" rx="3" ry="4" fill="#D66B8F"/>
    ${faisca(12, 10, 5, "#FFE08A", 0.3)}${faisca(110, 34, 4, "#BFF0FF", 1.1)}${faisca(106, 6, 3, "#FFE08A", 1.8)}
    ${brilho("M84 36 q8 12 8 26")}${rf(h, 62, { cilios: true, boca: "sem", dx: 15 })}
    ${h === "triste" ? `<path d="M54 110 Q60 106 66 110" fill="none" stroke="${T}" stroke-width="2.5" stroke-linecap="round"/>` : h === "uau" ? `<ellipse cx="60" cy="108.4" rx="3.2" ry="3.6" fill="${T}"/>` : `<path d="M53 107 Q60 113 67 107" fill="none" stroke="${T}" stroke-width="2.5" stroke-linecap="round"/>`}`;
  },
  sisorath: (h) => `${chao(60, 128, 40)}
    ${parte("pa-asa e", 36, 66, vol("M30 70 C10 56 4 34 10 24 C18 34 26 38 34 40 C30 30 32 22 38 18 C42 30 46 38 50 48 Z", "#A3232A", { k: 2.4 }) + `<path d="M14 30 C22 44 30 52 40 58 M34 24 C36 36 40 46 44 54" stroke="#7A1418" stroke-width="2" fill="none" stroke-linecap="round"/>`)}
    ${parte("pa-asa d", 84, 66, vol("M90 70 C110 56 116 34 110 24 C102 34 94 38 86 40 C90 30 88 22 82 18 C78 30 74 38 70 48 Z", "#A3232A", { k: 2.4 }) + `<path d="M106 30 C98 44 90 52 80 58 M86 24 C84 36 80 46 76 54" stroke="#7A1418" stroke-width="2" fill="none" stroke-linecap="round"/>`)}
    ${parte("pa-cauda", 88, 112, `${vol("M88 108 C106 112 112 98 106 90 C114 92 118 104 110 114 C102 122 92 118 86 114 Z", "#E0434A", { k: 2, contorno: 2.4 })}${vol("M104 88 l9 -4 l-3 9z", "#FFC24B", { k: 1, contorno: 2 })}`)}
    ${vol("M30 120 C24 92 34 74 60 72 C86 74 96 92 90 120 Z", "#E0434A", { k: 5 })}
    ${vol("M46 120 C46 102 52 92 60 90 C68 92 74 102 74 120 Z", "#FFC24B", { k: 2, contorno: 2.4 })}<path d="M50 102 h20 M48 112 h24" stroke="#E0A512" stroke-width="2.4" stroke-linecap="round"/>
    ${vol("M47 40 L51 19 L56 30 L60 14 L64 30 L69 19 L73 40 Z", "#B52A31", { k: 1.4, contorno: 2.4 })}
    ${chifre(-1)}${chifre(1)}
    ${vol("M22 52 C22 24 98 24 98 52 C98 72 82 82 60 82 C38 82 22 72 22 52Z", "#E0434A", { k: 5 })}
    ${[0, 0.9].map((d, i) => `<circle class="pa pa-sobe" cx="${104 + i * 4}" cy="${26 - i * 6}" r="${4 - i}" fill="#C9D3E3" opacity=".9" style="transform-origin:${104 + i * 4}px ${26 - i * 6}px;--pd:${d}s"/>`).join("")}
    ${brilho("M80 34 q10 6 12 18")}${luzinha(72, 30, 2.2)}${semBoca(h, 50, { dx: 15 })}${bocaDragao(h, 60, 64)}`,
  gosminha: (h) => `${chao(60, 128, 40)}
    ${parte("pa-gelatina", 60, 116, `${vol("M18 116 C10 116 12 98 18 88 C18 54 36 30 60 30 C84 30 102 54 102 88 C108 98 110 116 100 116 C94 116 94 108 88 110 C84 120 72 122 68 114 C64 120 52 122 50 114 C44 120 30 122 28 112 C24 118 20 116 18 116Z", "#7FD6A0", { k: 6, op: 0.95 })}
      <circle cx="40" cy="96" r="4" fill="#BFF5D3" opacity=".8"/><circle cx="76" cy="100" r="2.6" fill="#BFF5D3" opacity=".8"/><circle cx="86" cy="62" r="5" fill="#BFF5D3"/><circle cx="92" cy="74" r="3" fill="#BFF5D3"/>
      ${brilho("M78 42 q12 8 16 24")}${rf(h, 74, { dx: 15 })}`)}
    ${parte("pa-folha", 60, 30, vol("M58 30 C56 20 62 12 70 12 C66 18 66 24 64 30Z", "#4CAF6E", { k: 1.4, contorno: 2.2 }))}
    <path class="pa pa-gota" d="M34 116 q3 5 0 8 q-3 -3 0 -8z" fill="#7FD6A0" stroke="${T}" stroke-width="1.6" style="transform-origin:34px 116px;--pd:.4s"/>
    <path class="pa pa-gota" d="M84 118 q3 5 0 8 q-3 -3 0 -8z" fill="#7FD6A0" stroke="${T}" stroke-width="1.6" style="transform-origin:84px 118px;--pd:1.8s"/>`,
  golem: (h) => `${chao(60, 128, 46)}
    <g class="ch-braco esq" style="transform-origin:16px 58px">${volR(2, 56, 24, 44, 10, "#E6E2DA", { k: 3 })}${volR(0, 94, 28, 22, 9, "#F4F2EE", { k: 2 })}<path d="M8 66 l6 6 M6 104 l8 -4" stroke="#B9B3A6" stroke-width="2.2" stroke-linecap="round"/></g>
    <g class="ch-braco dir" style="transform-origin:104px 58px">${volR(94, 56, 24, 44, 10, "#E6E2DA", { k: 3 })}${volR(92, 94, 28, 22, 9, "#F4F2EE", { k: 2 })}<path d="M110 70 l-6 6 M112 104 l-8 -4" stroke="#B9B3A6" stroke-width="2.2" stroke-linecap="round"/></g>
    ${vol("M24 50 H96 L100 116 C100 124 20 124 20 116 Z", "#F4F2EE", { k: 5 })}
    ${parte("pa-luz", 60, 85, `<circle cx="60" cy="85" r="20" fill="#7FD6F5" opacity=".3"/>`)}
    ${vol("M60 70 L72 84 L60 100 L48 84 Z", "#7FD6F5", { k: 2, luz: true })}<path d="M60 70 V100 M48 84 H72" stroke="#4FB3D9" stroke-width="2"/>
    <path d="M30 64 l8 6 M88 104 l-6 -8 l-6 4 M34 104 l6 -6" stroke="#B9B3A6" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${volR(32, 8, 56, 48, 12, "#FFFDF7", { k: 4 })}
    <path d="M36 13 l4 6 M84 46 l-4 -4" stroke="#B9B3A6" stroke-width="2.2" stroke-linecap="round"/>
    ${brilho("M82 16 v12", 4)}${rf(h, 28, { dx: 12 })}`,
  mutans: (h) => `${chao(60, 128, 44)}
    ${parte("pa-asa e", 34, 60, vol("M30 62 C14 52 6 38 12 32 C22 34 30 46 36 56 Z", "#FFFFFF", { k: 1.6, contorno: 2.4 }) + `<path d="M16 38 C22 44 26 48 30 54" stroke="#C9D3E3" stroke-width="1.8" fill="none" stroke-linecap="round"/>`)}
    ${parte("pa-asa d", 86, 60, vol("M90 62 C106 52 114 38 108 32 C98 34 90 46 84 56 Z", "#FFFFFF", { k: 1.6, contorno: 2.4 }) + `<path d="M104 38 C98 44 94 48 90 54" stroke="#C9D3E3" stroke-width="1.8" fill="none" stroke-linecap="round"/>`)}
    ${parte("pa-aureola", 60, 18, `<ellipse cx="60" cy="18" rx="16" ry="5" fill="none" stroke="${T}" stroke-width="6.5"/><ellipse cx="60" cy="18" rx="16" ry="5" fill="none" stroke="#FFC24B" stroke-width="3.2"/><path d="M52 15 q6 -2 12 -1" stroke="#FFF3B0" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}
    ${volE(20, 96, 16, 16, "#B7DB72", { k: 3 })}${volE(100, 96, 16, 16, "#B7DB72", { k: 3 })}
    <circle cx="20" cy="96" r="5" fill="#9AC756"/><circle cx="100" cy="96" r="5" fill="#9AC756"/>
    ${volE(60, 74, 40, 40, "#C8E68A", { k: 6 })}
    <g fill="#A8CF62"><circle cx="34" cy="60" r="4"/><circle cx="88" cy="58" r="3"/><circle cx="84" cy="96" r="4"/><circle cx="40" cy="98" r="2.6"/></g>
    <path d="M36 92 q-4 6 -8 6 M84 92 q4 6 8 6" stroke="${T}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${brilho("M78 44 q12 8 14 22")}${luzinha(70, 40, 2.2)}${rf(h, 70, { dx: 14 })}`,
  // ---------------- terceira leva (26/10/2026) ----------------
  sondinha: (h) => {
    const c = "#C3CBD8";
    return `${chao(60, 128, 22)}
    ${tubo("M60 42 V24 Q60 14 70 10 L84 2", c, { w: 3.6, contorno: 2.4 })}
    <path d="M77.4 5.8 l2.4 -1.4 M72.2 8.8 l2.4 -1.4" stroke="#2F6BFF" stroke-width="3.8"/>
    ${braco(43, 78, -1, c)}${braco(77, 78, 1, c)}
    ${volR(42, 40, 36, 84, 14, c, { k: 4, luz: true })}
    ${[47, 52, 57].map(y => `<path d="M43.6 ${y} h32.8" stroke="#2F6BFF" stroke-width="2.6"/>`).join("")}
    <path d="M46 102 l8 8 M54 102 l8 8 M62 102 l8 8 M47 111 l7 7 M54 111 l8 8 M62 111 l7 7 M46 110 l8 -8 M54 110 l8 -8 M62 110 l8 -8 M47 118 l7 -7 M54 119 l8 -8 M62 119 l7 -7" stroke="#8F9AB5" stroke-width="1.4"/>
    ${brilho("M74 86 v12", 3.6)}${faisca(92, 6, 3.6, "#BFF0FF", 0.4)}${rf(h, 73, { dx: 11 })}`;
  },
  coelho: (h) => {
    const c = "#F4F2EE";
    return `${chao(60, 128, 38)}
    ${parte("pa-orelha e", 46, 34, `${vol("M40 34 C32 14 34 -6 44 -6 C52 -6 54 12 52 32Z", c, { k: 2, contorno: 3.2 })}<path d="M43 28 C39 14 40 0 44 0 C48 0 49 14 48 28Z" fill="#FFB3C8"/>`)}
    ${parte("pa-orelha d", 74, 34, `${vol("M68 32 C66 12 68 -6 76 -6 C86 -6 88 14 80 34Z", c, { k: 2, contorno: 3.2 })}<path d="M72 28 C71 14 72 0 76 0 C80 0 81 14 77 28Z" fill="#FFB3C8"/>`, 0.4)}
    ${volE(98, 104, 10, 10, "#FFFFFF", { k: 1.4, contorno: 3 })}
    ${braco(26, 90, -1, c)}${braco(94, 90, 1, c)}
    ${vol("M20 78 C20 44 38 30 60 30 C82 30 100 44 100 78 C100 108 84 124 60 124 C36 124 20 108 20 78Z", c, { k: 6 })}
    ${volE(60, 109, 22, 11, "#FFFFFF", { k: 1.4, contorno: 0, sombra: "#E8E4DC" })}
    ${vol("M55 72 L65 72 L60 78Z", "#FF8FA3", { k: 0.6, contorno: 2 })}
    <path d="M60 78 V82 ${h === "triste" ? "M60 82 Q55 80 51 85.5 M60 82 Q65 80 69 85.5" : "M60 82 Q55 86 50 82 M60 82 Q65 86 70 82"}" stroke="${T}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${volR(54.5, 83, 5.5, 9, 1.6, "#FFFFFF", { k: 0.6, contorno: 2 })}${volR(60, 83, 5.5, 9, 1.6, "#FFFFFF", { k: 0.6, contorno: 2 })}
    <path d="M40 74 h-12 M40 79 l-11 3 M80 74 h12 M80 79 l11 3" stroke="#9AA3C7" stroke-width="1.6" stroke-linecap="round"/>
    ${brilho("M84 46 q8 10 8 24")}${luzinha(78, 40, 2.2)}${semBoca(h, 58, { dx: 15 })}`;
  },
  amoxi: (h) => `${chao(60, 128, 24)}
    ${braco(38, 74, -1, "#E0434A")}${braco(82, 74, 1, "#FFD23F")}
    ${vol("M36 70 V40 a24 24 0 0 1 48 0 V70Z", "#E0434A", { k: 5 })}${vol("M36 70 V100 a24 24 0 0 0 48 0 V70Z", "#FFD23F", { k: 5 })}
    <path d="M36 70 H84" stroke="${T}" stroke-width="3"/><path d="M38 66 H82" stroke="#fff" stroke-width="1.6" opacity=".35"/>
    ${brilho("M76 26 q4 6 4 18", 4)}${luzinha(70, 22, 2.2)}
    ${[[22, 40, 0], [98, 30, 1.2], [100, 96, 2.1]].map(([x, y, d]) => bolha(x, y, 2.2, d, "#FFE7A3")).join("")}
    ${rf(h, 42, { dx: 11 })}`,
  pacu: (h) => `${chao(60, 128, 40)}
    ${parte("pa-cauda", 98, 76, vol("M96 76 L120 56 L116 78 L120 98Z", "#5E6B85", { k: 2 }))}
    ${parte("pa-nadadeira e", 30, 90, vol("M32 88 L14 104 L36 100Z", "#F2A65A", { k: 1.4 }))}
    ${vol("M60 28 L74 10 L78 32Z", "#5E6B85", { k: 1.6 })}
    ${vol(PACU, "#7D8CA8", { k: 6 })}${barrigaPacu()}
    <g fill="#5E6B85"><circle cx="30" cy="54" r="2"/><circle cx="84" cy="50" r="2.4"/><circle cx="90" cy="64" r="1.8"/></g>
    ${h === "triste" ? `<path d="M40 93 Q56 83 72 93" fill="none" stroke="${T}" stroke-width="3" stroke-linecap="round"/>` : bocaPacu()}
    ${bolha(110, 30, 2.6, 0, "#DCEFFF")}${bolha(114, 18, 1.8, 1.2, "#DCEFFF")}
    ${brilho("M82 38 q10 8 12 20")}${luzinha(74, 34, 2.2)}${semBoca(h, 62, { dx: 16 })}`,
  cureta: (h) => {
    const c = "#7FD6A0";
    return `${chao(60, 128, 22)}
    ${tubo("M60 42 V26 Q60 14 72 12 Q84 10 84 2 Q84 -4 78 -4", "#C3CBD8", { w: 3.6, contorno: 2.4 })}
    ${parte("pa-luz", 80, -2, `<circle cx="80" cy="-2" r="4.4" fill="#fff" opacity=".8"/>`)}
    ${braco(43, 78, -1, c)}${braco(77, 78, 1, c)}
    ${volR(42, 40, 36, 84, 14, c, { k: 4 })}
    ${[100, 108, 116].map(y => `<path d="M44 ${y} l32 -6" stroke="#4FB07A" stroke-width="2.2"/>`).join("")}
    <path d="M44 49 h32" stroke="#4FB07A" stroke-width="2"/>
    ${brilho("M74 79 v12", 3.6)}${rf(h, 66, { dx: 11 })}`;
  },
  ficha: (h) => `${chao(60, 128, 34)}
    ${braco(25, 80, -1, "#FFFFFF")}${braco(95, 80, 1, "#FFFFFF")}
    ${vol("M24 16 H84 L96 28 V122 H24Z", "#FFFFFF", { k: 4, sombra: "#DCE2EE" })}
    <path d="M84 16 V28 H96" fill="#E4E9F4" stroke="${T}" stroke-width="2.6" stroke-linejoin="round"/>
    <rect x="26" y="18" width="56" height="12" fill="#2F6BFF"/><path d="M30 24 h18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${31 + i * 8}" y="88" width="6.4" height="9" rx="1" fill="#fff" stroke="#9AA3C7" stroke-width="1.4"/>`).join("")}
    <path d="M31 104 h56 M31 112 h40" stroke="#C9D2DE" stroke-width="2.4" stroke-linecap="round"/>
    ${parte("pa-pulsa", 92, 104, `<circle cx="92" cy="108" r="6" fill="#1E9E5E" stroke="${T}" stroke-width="2"/><path d="M89 108 l2.4 2.4 l4 -4.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)}
    ${rf(h, 54, { dx: 13 })}`,
  lesma: (h) => `${chao(60, 128, 46)}
    <path d="M2 124 Q30 118 58 124" stroke="#BFF0D9" stroke-width="5" stroke-linecap="round" opacity=".8"/>
    ${parte("pa-orelha e", 26, 60, `${tubo("M26 62 Q22 44 16 34", "#9BE3B8", { w: 3.4, contorno: 2.2 })}${volE(15, 32, 4.4, 4.4, "#9BE3B8", { k: 0.6, contorno: 2.2 })}`)}
    ${parte("pa-orelha d", 40, 60, `${tubo("M38 60 Q40 42 44 30", "#9BE3B8", { w: 3.4, contorno: 2.2 })}${volE(45, 28, 4.4, 4.4, "#9BE3B8", { k: 0.6, contorno: 2.2 })}`, 0.5)}
    ${vol("M8 120 C6 100 16 70 32 62 C46 56 50 76 54 96 C58 108 80 112 112 112 C116 118 112 124 104 124 H18 C12 124 8 124 8 120Z", "#9BE3B8", { k: 4 })}
    ${parte("pa-balanca", 82, 110, `${volE(80, 76, 32, 34, "#C98A5A", { k: 4, luz: true })}<path d="M80 76 m-2 0 a4 4 0 1 1 6 3 a9 9 0 1 1 -14 -9 a15 15 0 1 1 22 16 a22 22 0 1 1 -32 -22" fill="none" stroke="#8A5A3B" stroke-width="3" stroke-linecap="round"/>${brilho("M98 54 q8 10 8 22", 4)}`)}
    ${rosto(h, { cx: 32, y: 84, dx: 9, k: 0.72, boca: "sem" })}${bocaLesma(h, 32, 95)}
    ${faisca(14, 82, 3.6, "#FFE08A", 0.3)}`,
  ourico: (h) => `${chao(60, 128, 42)}
    ${Array.from({ length: 22 }, (_, i) => { const a = (i * Math.PI * 2) / 22 - Math.PI / 2, r1 = 34, r2 = 52 + (i % 2) * 6, x1 = 60 + Math.cos(a) * r1, y1 = 76 + Math.sin(a) * r1, x2 = 60 + Math.cos(a) * r2, y2 = 76 + Math.sin(a) * r2; return parte("pa-espinho", x1, y1, tubo(`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`, i % 3 ? "#B48CF2" : "#9B6BE8", { w: 3.2, contorno: 2 }), (i % 5) * 0.3); }).join("")}
    ${volE(60, 76, 38, 38, "#8B5CF6", { k: 6 })}
    <g fill="#B48CF2">${[[40, 56], [80, 54], [86, 82], [36, 90], [60, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join("")}</g>
    ${[0, 72, 144, 216, 288].map(a => { const r = (a - 90) * Math.PI / 180, x = 60 + Math.cos(r) * 6, y = 98 + Math.sin(r) * 6; return `<path d="M60 98 L${(x + Math.cos(r + 1.57) * 3).toFixed(1)} ${(y + Math.sin(r + 1.57) * 3).toFixed(1)} L${(60 + Math.cos(r) * 10).toFixed(1)} ${(98 + Math.sin(r) * 10).toFixed(1)} L${(x - Math.cos(r + 1.57) * 3).toFixed(1)} ${(y - Math.sin(r + 1.57) * 3).toFixed(1)}Z" fill="#FFFDF6" stroke="${T}" stroke-width="1.6" stroke-linejoin="round"/>`; }).join("")}
    ${brilho("M80 50 q10 8 12 22")}${luzinha(74, 46, 2.2)}${semBoca(h, 72, { dx: 14 })}`,
  megalodonte: (h) => `${chao(60, 128, 46)}
    ${parte("pa-nadadeira e", 18, 84, vol("M20 84 L-2 70 L6 104 Z", "#4F6283", { k: 2 }))}
    ${parte("pa-nadadeira d", 102, 84, vol("M100 84 L122 70 L114 104 Z", "#4F6283", { k: 2 }))}
    ${vol("M60 -4 L76 24 C102 30 112 58 110 82 C108 110 88 126 60 126 C32 126 12 110 10 82 C8 58 18 30 44 24 Z", "#6F86A8", { k: 6 })}
    <path d="M24 40 l8 6 M30 34 l6 8" stroke="#4F6283" stroke-width="2.6" stroke-linecap="round"/>
    ${bocaTubarao(h, { x0: 22, x1: 98, y0: 76, meio: 7, fundo: 34, nCima: 11, nBaixo: 6, dente: 8.4, escura: "#7A1418" })}
    ${faisca(8, 20, 5, "#FFE08A", 0)}${faisca(112, 28, 4, "#BFF0FF", 0.9)}${faisca(110, 110, 3, "#FFE08A", 1.7)}
    ${brilho("M80 34 q12 8 16 22")}${luzinha(72, 26, 2.4)}${semBoca(h, 56, { dx: 16 })}`,
  rato: (h) => `${chao(60, 128, 40)}
    ${parte("pa-cauda", 96, 110, tubo("M96 112 Q112 110 116 96", "#F2B8AC", { w: 4, contorno: 2.2 }))}
    ${braco(28, 98, -1, "#F6C3B7")}${braco(92, 98, 1, "#F6C3B7")}
    ${vol("M20 82 C18 50 38 34 60 34 C82 34 102 50 100 82 C100 110 84 124 60 124 C36 124 20 110 20 82Z", "#F6C3B7", { k: 6 })}
    <path d="M30 60 q6 -4 12 0 M78 60 q6 -4 12 0 M28 96 q8 4 14 0 M78 96 q8 4 14 0 M44 112 q8 3 16 0" stroke="#E39E90" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${volE(60, 78, 16, 11, "#F9D3CA", { k: 1, contorno: 2.4 })}${volE(60, 72, 4, 3, "#E07B8A", { k: 0.4, contorno: 1.4 })}
    ${vol("M52 80 h7.2 v22 q-3.6 4 -7.2 0z", "#FFF3B0", { k: 1, contorno: 2.2, sombra: "#E8CF7A" })}${vol("M60.8 80 h7.2 v22 q-3.6 4 -7.2 0z", "#FFF3B0", { k: 1, contorno: 2.2, sombra: "#E8CF7A" })}
    <path d="M40 76 h-12 M40 81 l-11 3 M80 76 h12 M80 81 l11 3" stroke="#C98A7E" stroke-width="1.4" stroke-linecap="round"/>
    ${faisca(14, 30, 4.4, "#FFE08A", 0.2)}${faisca(108, 40, 3.6, "#FFE08A", 1.1)}
    ${brilho("M84 44 q8 10 8 22")}${luzinha(78, 40, 2.2)}${miudinhos(h, 60, 56)}`,

};

/** Desenha um companheiro desta família. tipo: chave de BICHOS. */
export function bicho(tipo, { humor = "feliz", classe = "", nome = "Companheiro", chapeu = null } = {}) {
  const corpo = (BICHOS[tipo] || BICHOS.gosminha)(humor);
  const [topo, esc] = TOPO_BICHO[tipo] || [20, 1];
  const hat = chapeu && CHAPEUS[chapeu] ? `<g transform="translate(60 ${topo}) scale(${esc}) translate(-60 -44)">${CHAPEUS[chapeu]()}</g>` : "";
  return `<svg class="dente bicho ${classe}" viewBox="${hat ? caixaComChapeu(chapeu, topo, esc) : "-4 -10 128 142"}" role="img" aria-label="${nome}" style="${fase(nome)}">${corpo}${hat}</svg>`;
}
export { estrela, pElipse, sombraDe, S };
