// Plantas do Jardim, no traço dos companheiros (guia v2, arte/kit.js): vaso com volume (a cor do vaso diz a
// raridade: barro, azul, roxo e dourado), terra, planta com carinha e partes que se mexem quando o desenho está .vivo
// (a planta balança, as folhas tremem, pétalas giram, sementes voam, gotas pingam, faíscas piscam…).
// humor: feliz | sede (murcha, terra seca, sem balançar) | uau (pronta para colher: brilha).
// crescimento (0 a 1, opcional): a planta cresce no vaso até ficar pronta.
import { T, uid, vol, volE, volR, volU, circulos, sombraDe, mistura, faisca, estrela5, parte, brilho, luzinha, tubo, carinha } from "./kit.js";
import { PLANTAS } from "../jardim.js";

const f2 = (n) => +(+n).toFixed(2);
const rad = (d) => (d * Math.PI) / 180;
/** Gira os pontos de um caminho com comandos absolutos M, L, Q, C e Z (para o volume não girar junto). */
function girar(d, cx, cy, ang) {
  const a = rad(ang), c = Math.cos(a), s = Math.sin(a);
  return d.replace(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g, (_, x, y) => { const dx = +x - cx, dy = +y - cy; return `${f2(cx + dx * c - dy * s)} ${f2(cy + dx * s + dy * c)}`; });
}
/** Folha: base (bx, by), direção (0 = para cima, sentido horário), comprimento e meia-largura. */
function folhaD(bx, by, ang, comp, larg, curva = 0) {
  const a = rad(ang - 90), ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const tx = bx + ux * comp, ty = by + uy * comp, mx = bx + ux * comp * 0.5 + nx * curva, my = by + uy * comp * 0.5 + ny * curva;
  return `M${f2(bx)} ${f2(by)}Q${f2(mx + nx * larg)} ${f2(my + ny * larg)} ${f2(tx)} ${f2(ty)}Q${f2(mx - nx * larg)} ${f2(my - ny * larg)} ${f2(bx)} ${f2(by)}Z`;
}
function folha(bx, by, ang, comp, larg, cor = "#7FD6A0", { atraso = 0, anima = true, nervura = true, curva = 0 } = {}) {
  const a = rad(ang - 90), tx = bx + Math.cos(a) * comp * 0.74, ty = by + Math.sin(a) * comp * 0.74;
  const corpo = vol(folhaD(bx, by, ang, comp, larg, curva), cor, { k: 1.5, contorno: 2.1 }) + (nervura ? `<path d="M${f2(bx)} ${f2(by)}L${f2(tx)} ${f2(ty)}" stroke="${sombraDe(cor, 1.3)}" stroke-width="1.3" stroke-linecap="round"/>` : "");
  return anima ? parte("pa-folha", bx, by, corpo, atraso) : corpo;
}
/** Elipse girada (pétala) como caminho. */
function pElipseRot(cx, cy, rx, ry, rot) {
  const r = rad(rot), c = Math.cos(r), s = Math.sin(r);
  return `M${f2(cx - rx * c)} ${f2(cy - rx * s)}A${rx} ${ry} ${rot} 1 0 ${f2(cx + rx * c)} ${f2(cy + rx * s)}A${rx} ${ry} ${rot} 1 0 ${f2(cx - rx * c)} ${f2(cy - rx * s)}Z`;
}
/** n pétalas em volta de (cx, cy), a uma distância, cada uma com volume. */
function petalas(cx, cy, n, larg, comp, dist, cor, { k = 1.1, contorno = 1.9, rot0 = 0 } = {}) {
  let s = "";
  for (let i = 0; i < n; i++) { const ang = rot0 + (i * 360) / n, a = rad(ang - 90); s += vol(pElipseRot(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, comp, larg, ang - 90), cor, { k, contorno }); }
  return s;
}
const caule = (d, cor = "#4CAF6E", w = 3.4) => tubo(d, cor, { w, contorno: 2.1 });
const tronco = (d, cor = "#A8714C", w = 5) => tubo(d, cor, { w, contorno: 2.4 });
const sobe = (x, y, conteudo, atraso = 0) => `<g class="pa pa-sobe" style="transform-origin:${x}px ${y}px;--pd:${atraso}s">${conteudo}</g>`;
const nota = (x, y, cor = "#7C6CF0") => `<path d="M${x} ${y} v-7 l5 -1.6 v6" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="${x - 1.4}" cy="${y}" rx="2" ry="1.5" fill="${cor}"/><ellipse cx="${x + 3.6}" cy="${y - 1.6}" rx="2" ry="1.5" fill="${cor}"/>`;
/** Só os olhos de uma carinha (a carnívora: a boca dela é a armadilha). */
const soOlhos = (c) => c.slice(0, c.indexOf("</g>") + 4);
const coracaoTrevo = "M50 36 C44 31 36 27 38 20 C40 14 48 15 50 20 C52 15 60 14 62 20 C64 27 56 31 50 36Z";

export const DESENHOS = {
  girassol: (h) => `${caule("M50 68 Q47 54 50 40")}${folha(49, 60, -62, 16, 6)}${folha(50, 56, 60, 15, 5.6, "#4CAF6E", { atraso: 0.6 })}
    ${parte("pa-gira-lento", 50, 30, petalas(50, 30, 12, 4.8, 9.6, 15.4, "#FFC24B"))}
    ${volE(50, 30, 13, 13, "#8A5A3B", { k: 2, contorno: 2.8 })}<g fill="#6E4223">${[[-6, -7], [0, -9], [6, -7], [-9, -1], [9, -1], [-6, 6], [6, 6], [0, 9]].map(([x, y]) => `<circle cx="${50 + x}" cy="${30 + y}" r="1.1"/>`).join("")}</g>
    ${carinha(50, 29, 0.7, h)}`,
  trevo: (h) => `${caule("M50 68 Q52 52 50 38")}${folha(51, 58, 50, 12, 4.6, "#4CAF6E")}
    ${parte("pa-balanca", 50, 36, [0, 90, 180, 270].map(r => vol(girar(coracaoTrevo, 50, 36, r + 45), r % 180 ? "#5BBF7A" : "#4CAF6E", { k: 1.6, contorno: 2.1 })).join("") + `<path d="M50 36 L41 27 M50 36 L59 27 M50 36 L59 45 M50 36 L41 45" stroke="#3E9E66" stroke-width="1.4" stroke-linecap="round"/>`)}
    ${volE(50, 36, 11, 11, "#9BE3B8", { k: 1.6, contorno: 2.6 })}${carinha(50, 35, 0.6, h)}${faisca(80, 22, 3.6, "#FFE08A", 0.3)}`,
  cacto: (h) => `${vol("M38 50 H30 C24 50 24 38 30 38 V44 H38Z", "#5BBF7A", { k: 1.4, contorno: 2.4 })}${vol("M62 44 H70 C76 44 76 30 70 30 V36 H62Z", "#5BBF7A", { k: 1.4, contorno: 2.4 })}
    ${vol("M38 70 V30 C38 16 62 16 62 30 V70 Z", "#5BBF7A", { k: 2.4, contorno: 2.8 })}<path d="M44 24 V68 M56 24 V68" stroke="#45A866" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M42 28 l-3 -2 M58 28 l3 -2 M41 58 l-3 1 M59 58 l3 1 M41 44 l-3 0 M59 44 l3 0 M28 41 l-3 -1 M73 33 l3 -1" stroke="${T}" stroke-width="1.6" stroke-linecap="round"/>
    ${parte("pa-pulsa", 50, 17, `${petalas(50, 14, 5, 2.6, 4.4, 4, "#F07BB0", { contorno: 1.6 })}<circle cx="50" cy="14" r="2.2" fill="#FFE08A" stroke="${T}" stroke-width="1.2"/>`)}
    ${brilho("M56.5 28 v14", 2.6, 0.7)}${carinha(50, 42, 0.78, h)}`,
  hortela: (h) => `${caule("M50 68 Q52 52 50 40", "#3E9E66")}${folha(50, 64, -64, 15, 6, "#9BE3B8")}${folha(50, 62, 64, 15, 6, "#9BE3B8", { atraso: 0.5 })}${folha(50, 50, -48, 14, 5.4, "#7FD6A0", { atraso: 1 })}${folha(50, 50, 50, 14, 5.4, "#7FD6A0", { atraso: 1.4 })}
    ${vol("M50 16 C64 16 70 28 66 38 C62 46 38 46 34 38 C30 28 36 16 50 16Z", "#B6F0CF", { k: 2.4, contorno: 2.8 })}<path d="M50 18.6 V22.4 M38.4 24 l4 2.6 M61.6 24 l-4 2.6 M35.4 33 l5 .4 M64.6 33 l-5 .4 M40 41 l3.4 -2 M60 41 l-3.4 -2" stroke="#7FD6A0" stroke-width="1.4" stroke-linecap="round"/>
    ${brilho("M40 24 q4 -5 10 -5", 2.6, 0.75)}${carinha(50, 30, 0.7, h)}${faisca(22, 22, 3.4, "#BFF0FF", 0.2)}${faisca(80, 14, 2.8, "#BFF0FF", 1.3)}`,
  cogumelo: (h) => `${parte("pa-luz", 50, 34, `<circle cx="50" cy="34" r="32" fill="#BFF0FF" opacity=".22"/>`)}
    ${vol("M40 70 C38 58 40 46 42 40 L58 40 C60 46 62 58 60 70 Z", "#FFF3DC", { k: 1.6, contorno: 2.6 })}
    <g transform="translate(0 -4)">${vol("M18 46 C18 16 82 16 82 46 C70 52 30 52 18 46Z", "#7C6CF0", { k: 2.6, contorno: 2.8 })}
    ${volE(34, 32, 5, 4.4, "#BFF0FF", { k: 0.8, contorno: 0 })}${volE(56, 25, 4, 3.4, "#BFF0FF", { k: 0.8, contorno: 0 })}${volE(70, 38, 3.4, 3, "#BFF0FF", { k: 0.8, contorno: 0 })}${volE(44, 42, 2.6, 2.2, "#BFF0FF", { k: 0.6, contorno: 0 })}
    ${brilho("M28 34 q4 -10 14 -13", 2.6, 0.55)}</g>${carinha(50, 53.6, 0.6, h)}
    ${[[28, 20, 0], [72, 16, 1.1], [62, 8, 2]].map(([x, y, d]) => sobe(x, y, `<circle cx="${x}" cy="${y}" r="1.6" fill="#BFF0FF" stroke="#7C6CF0" stroke-width=".8"/>`, d)).join("")}`,
  rosa: (h) => `${caule("M50 68 Q47 54 50 40", "#3E9E66")}${folha(49, 58, -60, 14, 5.6, "#4CAF6E")}${folha(50, 52, 58, 12, 4.8, "#4CAF6E", { atraso: 0.7 })}<path d="M48 62 l-3 -1 M51 48 l3 -1" stroke="${T}" stroke-width="1.4" stroke-linecap="round"/>
    ${parte("pa-chama", 50, 14, vol("M40 14 q3 -9 7 -2 q3 -11 6 -1 q4 -8 7 3 q-10 3 -20 0z", "#FFC24B", { k: 1, contorno: 1.8 }))}
    ${vol("M50 12 C70 12 74 30 66 40 C60 46 40 46 34 40 C26 30 30 12 50 12Z", "#E0434A", { k: 2.4, contorno: 2.8 })}
    <path d="M41 17.6 C45 22.6 55 22.6 59 17.6 M34.4 27 C35.6 34.6 39 39 43.4 40.6 M65.6 27 C64.4 34.6 61 39 56.6 40.6" stroke="#A3232A" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${brilho("M60 18 q5 4 5 10", 2.4, 0.6)}${carinha(50, 29, 0.6, h)}`,
  tulipa: (h) => `${caule("M50 68 Q52 54 50 42")}${folha(50, 66, -24, 22, 6, "#7FD6A0", { curva: -2 })}${folha(50, 64, 30, 18, 5, "#4CAF6E", { atraso: 0.8 })}
    ${vol("M32 22 L40 30 L50 16 L60 30 L68 22 L66 40 C62 50 38 50 34 40 Z", "url(#__tulipa)", { k: 2, contorno: 2.8 })}
    ${vol("M40.6 30.4 L50 17.4 L59.4 30.4 L57.6 45.4 C54 48 46 48 42.4 45.4 Z", "#FFF1C2", { k: 1.4, contorno: 2, sombra: "#F2D98E" })}${carinha(50, 35, 0.6, h)}`,
  lua: (h) => `${caule("M50 68 Q47 56 50 44", "#5B54D6")}${folha(49, 62, -58, 13, 5, "#A78BFA")}${folha(50, 58, 60, 13, 5, "#7C6CF0", { atraso: 0.6 })}
    ${parte("pa-gira-lento", 50, 30, petalas(50, 30, 6, 6.4, 11.6, 14, "#DCD8FF"))}
    ${volE(50, 30, 12, 12, "#FFE9A8", { k: 1.6, contorno: 2.8 })}<path d="M55.4 19.3 A12 12 0 0 1 55.4 40.7 A13 13 0 0 0 55.4 19.3Z" fill="#F7D774"/>
    ${faisca(20, 16, 3.4, "#FFE08A", 0)}${faisca(82, 10, 4, "#FFE08A", 1)}${faisca(86, 40, 2.4, "#FFF3B0", 1.8)}${carinha(47, 30, 0.55, h === "feliz" ? "sono" : h)}`,
  mandragora: (h) => `${parte("pa-folha", 50, 28, vol("M30 26 q10 -20 20 -6 q10 -18 20 4 q-8 4 -20 2 q-10 4 -20 0z", "#4CAF6E", { k: 1.6, contorno: 2.4 }) + `<path d="M50 20 V27 M40 16 l4 9 M60 14 l-4 11" stroke="#3E9E66" stroke-width="1.4" stroke-linecap="round"/>`)}
    ${tubo("M38 66 l-5 7", "#E8C49A", { w: 3.6, contorno: 2 })}${tubo("M62 66 l5 7", "#E8C49A", { w: 3.6, contorno: 2 })}
    ${parte("pa-pulo", 50, 70, `${vol("M32 70 C26 48 34 28 50 28 C66 28 74 48 68 70 Z", "#E8C49A", { k: 2.4, contorno: 2.8 })}<path d="M38 50 q3 2 6 0 M58 58 q3 2 5 0" stroke="#C49A6C" stroke-width="1.6" fill="none" stroke-linecap="round"/>${brilho("M60 36 v10", 2.6, 0.7)}${carinha(50, 46, 0.8, h === "feliz" ? "uau" : h)}`)}
    ${sobe(78, 30, nota(78, 30), 0)}${sobe(20, 36, nota(20, 36, "#F07BB0"), 1.2)}`,
  carnivora: (h) => `${caule("M50 68 Q48 60 50 50", "#3E9E66")}${folha(50, 66, -58, 14, 5.6, "#4CAF6E")}${folha(50, 66, 58, 14, 5.6, "#4CAF6E", { atraso: 0.5 })}
    ${vol("M22 36 C30 56 70 56 78 36 C70 40 30 40 22 36Z", "#E0434A", { k: 1.6, contorno: 2.6 })}<path d="M30 39 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5" fill="#fff" stroke="${T}" stroke-width="1.4" stroke-linejoin="round"/>
    ${parte("pa-morde", 22, 35, `${vol("M22 34 C22 12 78 12 78 34 C70 30 30 30 22 34Z", "#7BC96F", { k: 2, contorno: 2.8 })}<path d="M28 33 l4 5 l4 -5 l4 5 l4 -5 l4 5 l4 -5 l4 5 l4 -5 l4 5 l4 -5 l4 5" fill="#fff" stroke="${T}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="36" cy="20" r="2.6" fill="#E0434A"/><circle cx="62" cy="18" r="2.2" fill="#E0434A"/>${brilho("M64 18 q5 3 7 9", 2.4, 0.55)}${soOlhos(carinha(50, 23, 0.55, h))}`)}
    ${parte("pa-voa", 50, 26, `<g transform="translate(84 18)"><ellipse cx="0" cy="0" rx="2.6" ry="2" fill="${T}"/><ellipse cx="-1.6" cy="-2.6" rx="1.8" ry="1.2" fill="#DCEFFF" stroke="${T}" stroke-width=".8"/><ellipse cx="1.4" cy="-2.6" rx="1.8" ry="1.2" fill="#DCEFFF" stroke="${T}" stroke-width=".8"/></g>`)}`,
  cristal: (h) => `${tronco("M50 72 V54", "#8A5A3B", 4)}
    ${vol("M20 46 L34 14 L50 6 L66 14 L80 46 L62 56 L38 56 Z", "#BFF0FF", { k: 2.4, contorno: 2.8, luz: true })}
    <path d="M34 14 L42 32 L50 6 L58 32 L66 14 M20 46 L42 32 L38 56 M80 46 L58 32 L62 56 M42 32 H58" stroke="#7FD6F5" stroke-width="1.8" fill="none" stroke-linejoin="round"/>
    ${parte("pa-luz", 50, 30, `<path d="M42 32 L50 6 L58 32Z" fill="#fff" opacity=".45"/>`)}
    ${faisca(26, 10, 3.6, "#FFE08A", 0)}${faisca(80, 8, 3, "#FFFFFF", 0.9)}${faisca(84, 52, 2.6, "#BFF0FF", 1.7)}${brilho("M28 40 l8 -18", 2.6, 0.8)}${carinha(50, 40, 0.62, h)}`,
  fenix: (h) => `${caule("M50 68 Q47 56 50 46", "#A3232A")}${folha(49, 62, -60, 14, 5.4, "#FF7A1A")}${folha(50, 60, 60, 14, 5.4, "#FFC24B", { atraso: 0.6 })}
    ${parte("pa-chama", 50, 46, `${vol("M50 46 C30 44 18 26 22 8 C30 18 36 20 40 18 C38 10 42 4 50 0 C58 4 62 10 60 18 C64 20 70 18 78 8 C82 26 70 44 50 46Z", "#FF7A1A", { k: 2, contorno: 2.8 })}<path d="M50 42 C38 40 32 30 34 20 C40 26 44 26 46 24 C46 18 48 14 50 12 C52 14 54 18 54 24 C56 26 60 26 66 20 C68 30 62 40 50 42Z" fill="#FFC24B"/><path d="M50 41 C42 40 39 34 40 27.6 C44 29 47 27 50 21 C53 27 56 29 60 27.6 C61 34 58 40 50 41Z" fill="#FFF3B0"/>`)}
    ${[[30, 12, 0], [70, 8, 0.9], [56, 4, 1.7]].map(([x, y, d]) => sobe(x, y, `<circle cx="${x}" cy="${y}" r="1.6" fill="#FFC24B"/>`, d)).join("")}${carinha(50, 32.6, 0.58, h)}`,
  margarida: (h) => `${caule("M50 68 Q48 54 46 42")}${folha(49, 62, -58, 14, 5, "#7FD6A0")}${folha(49, 58, 56, 13, 4.6, "#4CAF6E", { atraso: 0.5 })}
    ${parte("pa-balanca", 54, 54, `${caule("M50 56 Q62 48 72 32", "#4CAF6E", 2.6)}${petalas(74, 27, 8, 2.6, 5.2, 6.4, "#FFFFFF", { contorno: 1.5 })}${volE(74, 27, 3.8, 3.8, "#FFC24B", { k: 0.8, contorno: 1.6 })}`)}
    ${petalas(46, 30, 12, 4.4, 9.4, 14, "#FFFFFF")}${volE(46, 30, 10.4, 10.4, "#FFC24B", { k: 1.6, contorno: 2.6 })}${carinha(46, 29, 0.6, h)}`,
  bambu: (h) => `${[[30, 22, "#8FCF6A", 7, 0.4], [70, 30, "#8FCF6A", 7, 0.9], [50, 6, "#A6DB7E", 10, 0]].map(([x, y, c, w, d]) => parte("pa-balanca", x, 70, `${volR(x - w, y, 2 * w, 70 - y, 5, c, { k: 1.6, contorno: 2.6 })}${Array.from({ length: Math.floor((70 - y) / 14) }, (_, i) => (x === 50 && i === 1) ? "" : `<path d="M${x - w + 1} ${y + 14 * (i + 1)} h${2 * w - 2}" stroke="${T}" stroke-width="2"/><path d="M${x - w + 2} ${y + 14 * (i + 1) - 2.4} h${2 * w - 4}" stroke="#fff" stroke-width="1.4" opacity=".5"/>`).join("")}`, d)).join("")}
    ${folha(57, 16, 70, 18, 4.4, "#4CAF6E")}${folha(25, 32, -72, 16, 4, "#4CAF6E", { atraso: 0.8 })}${folha(75, 42, 66, 14, 3.6, "#5BBF7A", { atraso: 1.4 })}
    ${brilho("M43 10 v12", 2.4, 0.7)}${carinha(50, 34, 0.62, h)}`,
  babosa: (h) => `${[-58, -34, -12, 12, 34, 58].map((r, i) => parte("pa-folha", 50, 70, vol(girar(`M50 70 C44 50 46 26 50 ${i % 2 ? 14 : 8} C54 26 56 50 50 70Z`, 50, 70, r), i % 2 ? "#6FBF8A" : "#86D19D", { k: 1.4, contorno: 2.1 }), i * 0.25)).join("")}
    ${vol("M50 70 C34 52 36 22 50 4 C64 22 66 52 50 70Z", "#9BE3B8", { k: 2.2, contorno: 2.8 })}
    <path d="M40 26 l-3 1 M38 36 l-3 1 M38 46 l-3 1 M60 26 l3 1 M62 36 l3 1 M62 46 l3 1" stroke="${T}" stroke-width="1.6" stroke-linecap="round"/>${brilho("M55 18 q4 8 4 18", 2.4, 0.6)}${carinha(50, 42, 0.68, h)}`,
  cravo: (h) => `${tronco("M50 68 Q50 50 50 34", "#8A5A3B", 3.4)}${tronco("M50 50 Q38 44 28 30", "#8A5A3B", 2.8)}${tronco("M50 46 Q62 40 74 26", "#8A5A3B", 2.8)}${folha(50, 60, -60, 14, 5.4, "#4CAF6E")}${folha(50, 62, 58, 14, 5.4, "#4CAF6E", { atraso: 0.5 })}
    ${[[28, 26, 0], [74, 22, 0.6]].map(([x, y, d]) => parte("pa-pulsa", x, y, `${vol(`M${x - 5} ${y} L${x} ${y - 9} L${x + 5} ${y} L${x} ${y + 3}Z`, "#C2502A", { k: 1, contorno: 1.8 })}${volE(x, y - 4, 4, 4, "#F28AA0", { k: 0.8, contorno: 1.8 })}`, d)).join("")}
    ${vol("M34 30 L50 4 L66 30 L50 40Z", "#A8582E", { k: 2, contorno: 2.8 })}${volE(50, 12, 7, 7, "#F28AA0", { k: 1.2, contorno: 2.2 })}${carinha(50, 26, 0.6, h)}`,
  camomila: (h) => `${caule("M50 68 Q49 54 50 38")}${caule("M50 60 Q36 54 26 40", "#4CAF6E", 2.6)}${caule("M50 58 Q64 52 76 42", "#4CAF6E", 2.6)}${folha(50, 66, -40, 14, 4.6, "#9BE3B8")}
    ${parte("pa-balanca", 26, 46, `${petalas(26, 38, 9, 2.2, 4.6, 6.2, "#FFFFFF", { contorno: 1.3 })}${volE(26, 38, 3.6, 3.6, "#FFC24B", { k: 0.6, contorno: 1.4 })}`)}
    ${parte("pa-balanca", 76, 48, `${petalas(76, 40, 9, 2.2, 4.6, 6.2, "#FFFFFF", { contorno: 1.3 })}${volE(76, 40, 3.6, 3.6, "#FFC24B", { k: 0.6, contorno: 1.4 })}`, 0.8)}
    ${petalas(50, 28, 14, 3.6, 8.4, 13.4, "#FFFFFF")}${vol("M38 30 C38 16 62 16 62 30 C62 36 38 36 38 30Z", "#FFC24B", { k: 1.6, contorno: 2.6 })}${carinha(50, 26, 0.5, h === "feliz" ? "sono" : h)}
    ${h === "sede" ? "" : `${sobe(66, 14, `<text x="66" y="14" font-size="8" font-weight="800" fill="#7C6CF0">z</text>`, 0)}${sobe(72, 8, `<text x="72" y="8" font-size="6" font-weight="800" fill="#7C6CF0">z</text>`, 1.1)}`}`,
  roma: (h) => `${tronco("M50 68 Q50 60 50 54", "#8A5A3B", 3.4)}${folha(50, 62, -60, 15, 5.4)}${folha(50, 60, 60, 15, 5.4, "#4CAF6E", { atraso: 0.5 })}${folha(40, 20, -64, 12, 4.4, "#4CAF6E")}${folha(60, 20, 62, 12, 4.4, "#7FD6A0", { atraso: 0.9 })}
    ${volE(50, 36, 20, 20, "#D93A3A", { k: 2.6, contorno: 2.8, luz: true })}${vol("M42 16 L44 10 L48 15 L50 8 L52 15 L56 10 L58 16Z", "#A3232A", { k: 1, contorno: 2 })}
    <g fill="#FF8FA3" stroke="#A3232A" stroke-width=".6"><circle cx="61" cy="44" r="2"/><circle cx="65" cy="38" r="2"/><circle cx="58" cy="50" r="1.8"/><circle cx="65" cy="48" r="1.6"/></g>
    ${brilho("M37 30 q2 -8 9 -11", 2.6, 0.75)}${carinha(47, 36, 0.6, h)}${faisca(70, 12, 3, "#FFE08A", 0.4)}`,
  bonsai: (h) => `${tronco("M48 70 C46 58 56 54 54 44 C52 36 42 34 44 26", "#A8714C", 5.4)}${tronco("M54 46 C62 42 68 44 72 40", "#A8714C", 3)}
    ${parte("pa-folha", 46, 30, volU(circulos([[30, 26, 9], [40, 18, 10], [54, 16, 10], [64, 22, 9], [46, 28, 9], [24, 30, 6]]), "#5BBF7A", { k: 2, contorno: 2.6 }))}
    ${parte("pa-folha", 70, 42, volU(circulos([[66, 42, 6.4], [74, 38, 6.4], [80, 43, 5]]), "#7FD6A0", { k: 1.4, contorno: 2.4 }), 0.8)}
    ${brilho("M32 20 q6 -7 14 -7", 2.4, 0.6)}${carinha(46, 22, 0.58, h)}`,
  dentedeleao: (h) => `${caule("M50 68 Q49 56 50 44")}
    ${vol("M50 66 l-14 -4 l6 -2 l-10 -4 l8 -1 l-8 -6 l14 6 Z", "#4CAF6E", { k: 1, contorno: 2 })}${vol("M50 66 l14 -4 l-6 -2 l10 -4 l-8 -1 l8 -6 l-14 6 Z", "#4CAF6E", { k: 1, contorno: 2 })}
    ${volE(50, 28, 21, 21, "#FFFFFF", { k: 1.6, contorno: 2.6, sombra: "#E4E8F2" })}
    ${Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8; return `<path d="M${f2(50 + Math.cos(a) * 11)} ${f2(28 + Math.sin(a) * 11)} L${f2(50 + Math.cos(a) * 19)} ${f2(28 + Math.sin(a) * 19)}" stroke="#C9D1E3" stroke-width="1.4"/><circle cx="${f2(50 + Math.cos(a) * 19)}" cy="${f2(28 + Math.sin(a) * 19)}" r="1.5" fill="#C9D1E3"/>`; }).join("")}
    ${[[80, 14, 0], [86, 28, 1.3], [16, 16, 2.4]].map(([x, y, d]) => `<g class="pa pa-semente" style="transform-origin:${x}px ${y}px;--pd:${d}s"><path d="M${x} ${y} l3 6 M${x} ${y} l-3 -1 M${x} ${y} l1 -3 M${x} ${y} l3 -2" stroke="#9AA3C7" stroke-width="1.3" stroke-linecap="round"/><circle cx="${x + 3}" cy="${y + 6}" r="1" fill="#8A5A3B"/></g>`).join("")}
    ${carinha(50, 27, 0.65, h === "feliz" ? "uau" : h)}`,
  vitoria: (h) => `${[0, 1.6].map(d => `<ellipse class="pa pa-onda" cx="50" cy="62" rx="46" ry="12" fill="none" stroke="#7FD6F5" stroke-width="1.6" style="transform-origin:50px 62px;--pd:${d}s"/>`).join("")}
    ${vol("M6 62 A44 11 0 1 0 94 62 A44 11 0 1 0 6 62Z M50 62 L60 52 L52 51Z", "#4CAF6E", { k: 1.6, contorno: 2.6 })}<path d="M10 61 Q50 76 90 61" fill="none" stroke="#2F8F5B" stroke-width="2.6"/>
    <path d="M50 62 L50 53 M50 62 L28 67 M50 62 L72 67 M50 62 L18 61 M50 62 L82 61" stroke="#2F8F5B" stroke-width="1.6" stroke-linecap="round"/>
    ${petalas(50, 42, 9, 4, 10, 8, "#FFC9DE", { rot0: 20 })}${[-50, -25, 0, 25, 50].map(r => vol(girar("M50 50 C42 40 44 22 50 14 C56 22 58 40 50 50Z", 50, 50, r), r ? "#FFE1EC" : "#FFFFFF", { k: 1.2, contorno: 2 })).join("")}
    ${volE(50, 40, 9.6, 9.6, "#FFE08A", { k: 1.4, contorno: 2.6 })}${carinha(50, 39, 0.5, h)}`,
  orquidea: (h) => `${caule("M50 68 Q52 56 48 44", "#3E9E66")}${folha(50, 68, -58, 18, 6, "#4CAF6E", { curva: 2 })}${folha(50, 68, 60, 18, 6, "#4CAF6E", { curva: -2, atraso: 0.6 })}
    ${petalas(50, 30, 5, 5.4, 12.6, 12, "#C9B8FF", { rot0: 0 })}
    ${vol("M40 34 C40 50 60 50 60 34 L50 40 Z", "#8B5CF6", { k: 1.4, contorno: 2.6 })}${vol("M46 38 L50 46 L54 38 L50 41Z", "#BFF0FF", { k: 0.6, contorno: 1.6 })}
    ${volE(50, 30, 8, 8, "#F4ECFF", { k: 1, contorno: 2.2 })}
    ${faisca(16, 14, 3.4, "#FFE08A", 0)}${faisca(84, 10, 2.8, "#BFF0FF", 0.8)}${faisca(86, 46, 2.6, "#FFE08A", 1.6)}${carinha(50, 29, 0.42, h)}`,
  ipe: (h) => `${tronco("M50 70 V44 M50 52 L36 40 M50 48 L64 36", "#8A5A3B", 4.6)}
    ${parte("pa-folha", 50, 44, volU(circulos([[24, 30, 12], [36, 18, 13], [52, 14, 14], [68, 18, 12], [80, 30, 11], [66, 38, 12], [46, 38, 13], [30, 40, 10], [56, 27, 10], [38, 30, 9]]), "#FFC93C", { k: 2.2, contorno: 2.8 }) + `<g fill="#F2A922">${[[26, 24], [40, 14], [58, 12], [74, 22], [82, 34], [22, 38], [66, 42], [36, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.8"/>`).join("")}</g>${brilho("M26 24 q6 -10 16 -12", 2.6, 0.6)}${carinha(52, 30, 0.6, h)}`)}
    ${[[20, 52, 0], [76, 54, 1.4], [44, 56, 2.6]].map(([x, y, d]) => `<g class="pa pa-cai" style="transform-origin:${x}px ${y}px;--pd:${d}s"><path d="M${x} ${y} l2.4 -2.4 l2.4 2.4 l-2.4 2.4z" fill="#FFC93C" stroke="${T}" stroke-width=".9"/></g>`).join("")}`,
  lotus: (h) => `${parte("pa-luz", 50, 36, `<circle cx="50" cy="36" r="32" fill="#FFE08A" opacity=".26"/>`)}
    ${vol("M20 64 A30 6 0 1 0 80 64 A30 6 0 1 0 20 64Z", "#4CAF6E", { k: 1, contorno: 2 })}
    ${[-70, -40, 40, 70].map(r => vol(girar("M50 60 C38 48 40 26 50 16 C60 26 62 48 50 60Z", 50, 60, r), "#F7A8CB", { k: 1.4, contorno: 2 })).join("")}
    ${[-22, 22].map(r => vol(girar("M50 58 C40 46 42 24 50 12 C58 24 60 46 50 58Z", 50, 58, r), "#FFC9DE", { k: 1.4, contorno: 2 })).join("")}
    ${vol("M50 58 C38 44 39 20 50 6 C61 20 62 44 50 58Z", "#FFE1EC", { k: 1.8, contorno: 2.6 })}
    ${faisca(18, 16, 3.4, "#FFE08A", 0)}${faisca(82, 12, 3.4, "#FFE08A", 0.9)}${faisca(88, 34, 2.4, "#FFF3B0", 1.7)}${carinha(50, 36, 0.5, h)}`,
  dragoeiro: (h) => `${tronco("M50 70 V40 M50 44 L30 30 M50 44 L70 30 M50 40 L50 24", "#B9A48A", 4.6)}
    ${parte("pa-folha", 50, 30, [[30, 28], [70, 28], [50, 20]].map(([x, y]) => Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i * Math.PI) / 8; return tubo(`M${x} ${y} l${Math.round(Math.cos(a) * 18)} ${Math.round(Math.sin(a) * 14)}`, "#5BBF7A", { w: 2.4, contorno: 1.4 }); }).join("")).join(""))}
    ${volR(40, 42, 20, 30, 8, "#B9A48A", { k: 1.6, contorno: 2.6 })}<path d="M44 50 q3 2 6 0 M52 62 q3 2 5 0" stroke="#9A8468" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    ${vol("M34 50 q-2 6 0 9 q3 -3 0 -9z", "#E0434A", { k: 0.6, contorno: 1.6 })}${vol("M64 52 l4 -4 l4 4 l-4 4z", "#E0434A", { k: 0.6, contorno: 1.6 })}
    <path class="pa pa-gota" d="M41 64 q2.4 4 0 6 q-2.4 -2 0 -6z" fill="#E0434A" stroke="${T}" stroke-width=".9" style="transform-origin:41px 64px;--pd:.6s"/>${carinha(50, 54, 0.55, h)}`,
  // ----- terceira leva (26/10/2026): plantas que a odontologia usa -----
  malva: (h) => `${caule("M50 68 Q48 54 50 42", "#3E9E66")}${folha(49, 62, -60, 15, 7, "#5BBF7A")}${folha(50, 58, 60, 14, 6.4, "#4CAF6E", { atraso: 0.6 })}
    ${parte("pa-balanca", 72, 52, `${caule("M52 54 Q64 46 74 34", "#3E9E66", 2.4)}${petalas(76, 30, 5, 3.4, 5.6, 5, "#D58BE0", { contorno: 1.4 })}<circle cx="76" cy="30" r="2" fill="#FFF3B0" stroke="${T}" stroke-width="1"/>`)}
    ${petalas(48, 28, 5, 7.4, 11.4, 10, "#D58BE0", { rot0: 0 })}${[0, 72, 144, 216, 288].map(a => { const r = rad(a - 90); return `<path d="M${f2(48 + Math.cos(r) * 5)} ${f2(28 + Math.sin(r) * 5)} L${f2(48 + Math.cos(r) * 15)} ${f2(28 + Math.sin(r) * 15)}" stroke="#9B4FB0" stroke-width="1.2" stroke-linecap="round"/>`; }).join("")}
    ${volE(48, 28, 6.4, 6.4, "#FFF3B0", { k: 0.8, contorno: 2 })}${carinha(48, 27, 0.42, h)}
    ${parte("pa-voa", 48, 24, `<g transform="translate(18 18)"><ellipse cx="0" cy="0" rx="3.6" ry="2.8" fill="#FFC24B" stroke="${T}" stroke-width="1"/><path d="M-1 -2.6 v5.2 M1.4 -2.6 v5.2" stroke="${T}" stroke-width="1.1"/><ellipse cx="-1" cy="-3.6" rx="2.2" ry="1.6" fill="#DCEFFF" stroke="${T}" stroke-width=".8"/><ellipse cx="1.6" cy="-3.6" rx="2.2" ry="1.6" fill="#DCEFFF" stroke="${T}" stroke-width=".8"/></g>`)}`,
  jua: (h) => `${tronco("M50 70 C50 62 47 56 48 46 M48 54 C42 50 36 48 32 42 M49 50 C56 46 62 44 66 38", "#7A5236", 4.6)}<path d="M48 66 q2 -3 0 -6" stroke="#5A3A22" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    ${parte("pa-folha", 50, 40, `${volU(circulos([[26, 32, 10], [36, 21, 11], [50, 15, 12], [64, 21, 11], [74, 32, 10], [62, 36, 11], [38, 36, 11], [50, 30, 12]]), "#4CAF6E", { k: 2.2, contorno: 2.6 })}${[[28, 28], [36, 16], [66, 18], [72, 32], [60, 40], [40, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#F2C94C" stroke="${T}" stroke-width=".9"/><circle cx="${x + 0.8}" cy="${y - 0.8}" r=".7" fill="#fff"/>`).join("")}${brilho("M30 22 q6 -8 14 -9", 2.4, 0.55)}${carinha(50, 27, 0.62, h)}`)}`,
  aroeira: (h) => `${tronco("M50 70 Q50 60 50 52", "#8A5A3B", 3.6)}
    ${parte("pa-folha", 50, 50, `${[[-70, 22, 46], [-40, 26, 32], [40, 74, 32], [70, 78, 46]].map(([a, x, y]) => [0, 1, 2].map(i => folha(x + Math.cos(rad(a - 90)) * i * 4, y + Math.sin(rad(a - 90)) * i * 4, a + (i % 2 ? 50 : -50), 7, 2.6, "#5BBF7A", { anima: false, nervura: false })).join("")).join("")}${volU(circulos([[34, 38, 11], [46, 28, 12], [58, 28, 12], [68, 38, 11], [52, 42, 12], [40, 46, 9], [64, 46, 9]]), "#5BBF7A", { k: 2, contorno: 2.6 })}${carinha(52, 38, 0.62, h)}`)}
    ${[[34, 22, 0], [66, 20, 0.6], [50, 13, 1.2]].map(([x, y, d]) => parte("pa-balanca", x, y - 4, `${tubo(`M${x} ${y - 4} q1 3 0 5`, "#8A5A3B", { w: 1.2, contorno: 1 })}${volU(circulos([[x - 3, y + 2, 2.4], [x + 2, y + 2, 2.4], [x, y + 5.4, 2.4], [x - 4, y + 6, 2.2], [x + 4, y + 6, 2.2]]), "#E0435A", { k: 0.8, contorno: 1.6 })}<circle cx="${x - 3.6}" cy="${y + 1.2}" r=".7" fill="#fff"/><circle cx="${x + 1.4}" cy="${y + 1.2}" r=".7" fill="#fff"/>`, d)).join("")}`,
  copaiba: (h) => `${tronco("M50 46 L36 32 M50 42 L64 28", "#8A5A3B", 5)}
    ${parte("pa-folha", 50, 32, volU(circulos([[28, 24, 11], [40, 14, 12], [58, 12, 12], [72, 22, 11], [64, 30, 10], [38, 30, 10], [50, 22, 11]]), "#3E9E66", { k: 2.2, contorno: 2.6 }) + brilho("M32 18 q6 -8 14 -8", 2.4, 0.55))}
    ${vol("M41 72 C42 60 41 48 44 38 H56 C59 48 58 60 59 72Z", "#8A5A3B", { k: 1.6, contorno: 2.6 })}<path d="M46 44 q2 3 0 6 M54 60 q-2 3 0 6" stroke="#6E4223" stroke-width="1.3" fill="none" stroke-linecap="round"/>${carinha(50, 50, 0.5, h)}
    ${volR(57, 55, 8, 3.4, 1.4, "#C3CBD8", { k: 0.8, contorno: 1.5 })}
    <g class="pa pa-gota" style="transform-origin:64px 59px;--pd:.3s">${vol("M64 58.4 q3 5 0 8 q-3 -3 0 -8z", "#F2A922", { k: 0.6, contorno: 1.2 })}</g>`,
  jabuticabeira: (h) => `${tronco("M50 44 C44 40 40 34 36 26 M50 40 C58 36 62 32 66 24", "#9A7B5C", 5)}
    ${parte("pa-folha", 50, 24, volU(circulos([[30, 20, 10], [42, 12, 11], [58, 11, 11], [70, 18, 10], [50, 20, 10]]), "#4CAF6E", { k: 2, contorno: 2.6 }) + brilho("M32 15 q6 -7 13 -8", 2.4, 0.55))}
    ${vol("M40 72 C41 60 40 48 43 38 H57 C60 48 59 60 60 72Z", "#9A7B5C", { k: 1.6, contorno: 2.6 })}
    ${[[41.6, 66], [58.4, 64], [41.2, 50], [58.8, 47], [44, 42.6], [55.4, 41], [38, 32], [40, 26], [62, 30], [64, 24], [46, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#3B1F4A" stroke="${T}" stroke-width="1"/><circle cx="${x + 1}" cy="${y - 1}" r=".9" fill="#fff" opacity=".9"/>`).join("")}
    ${faisca(80, 40, 3, "#FFFFFF", 0.4)}${faisca(20, 46, 2.4, "#FFFFFF", 1.4)}${carinha(50, 53, 0.5, h)}`,
};

// ----- vasos: a cor diz a raridade -----
const VASOS = {
  comum: { cor: "#E8742A", aro: "#B95C1C" },
  rara: { cor: "#3F8FD8", aro: "#2D6EB0", faixa: "#FFFFFF" },
  epica: { cor: "#8B5CF6", aro: "#6A3FD4", estrelas: true },
  lendaria: { cor: "#F2B33D", aro: "#D18A12", gemas: true },
};
function vaso(rar, seco, cor) {
  const v = VASOS[rar] || VASOS.comum, c = cor || v.cor;
  const terra = seco ? "#B98D63" : "#6B4226";
  return `<ellipse cx="50" cy="96" rx="24" ry="3.4" fill="${T}" opacity=".15"/>
    ${vol("M29 69 Q50 58 71 69Z", terra, { k: 1, contorno: 2.4 })}${seco ? `<path d="M40 66.6 l3 1.6 l2 -1.2 M56 65.6 l2 1.6 l3 -1" stroke="#8A6440" stroke-width="1" fill="none" stroke-linecap="round"/>` : `<circle cx="42" cy="66.6" r=".9" fill="#8A5A3B"/><circle cx="58" cy="66" r=".8" fill="#8A5A3B"/>`}
    ${vol("M30 74 H70 L65.5 95 H34.5 Z", c, { k: 2.2, contorno: 3 })}
    ${v.faixa ? `<path d="M31.4 82 H68.6" stroke="${v.faixa}" stroke-width="2.6"/><path d="M32.6 87.6 H67.4" stroke="${v.faixa}" stroke-width="1.4" stroke-dasharray="2 3" opacity=".9"/>` : ""}
    ${v.estrelas ? `${estrela5(42, 85, 3.2, "#FFE08A", { contorno: 1 })}${estrela5(57, 88, 2.4, "#FFE08A", { contorno: 1 })}<circle cx="62" cy="81" r="1" fill="#fff"/>` : ""}
    ${volR(26, 67.5, 48, 9.5, 3.5, v.aro, { k: 1.4, contorno: 3 })}
    ${v.gemas ? `${volE(38, 72.2, 2.2, 2.2, "#E0434A", { k: 0.5, contorno: 1.2 })}${volE(50, 72.2, 2.4, 2.4, "#7FD6F5", { k: 0.5, contorno: 1.2 })}${volE(62, 72.2, 2.2, 2.2, "#7FD6A0", { k: 0.5, contorno: 1.2 })}` : ""}
    <path d="M30 70.2 H44" stroke="#fff" stroke-width="1.6" opacity=".45" stroke-linecap="round"/><path d="M63 77 L60.6 92" stroke="#fff" stroke-width="2" opacity=".3" stroke-linecap="round"/>`;
}

const DEGRADES = {
  __tulipa: (id) => `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#F07BB0"/><stop offset=".35" stop-color="#FFE08A"/><stop offset=".7" stop-color="#7FD6F5"/><stop offset="1" stop-color="#A78BFA"/></linearGradient>`,
};

/** Uma planta no vaso. humor: feliz | sede | uau; crescimento: 0 a 1 (a planta encolhe no começo). */
export function plantaSVG(id, { humor = "feliz", vasoCor, classe = "", crescimento = 1, raridade } = {}) {
  let corpo = (DESENHOS[id] || DESENHOS.girassol)(humor);
  // degradês com id próprio
  let defs = "";
  corpo = corpo.replace(/url\(#(__\w+)\)/g, (_, k) => { const novo = uid("pd"); defs += DEGRADES[k] ? DEGRADES[k](novo) : ""; return `url(#${novo})`; });
  const rar = raridade || PLANTAS[id]?.raridade || "comum";
  const seca = humor === "sede", pronta = humor === "uau";
  const esc = Math.max(0.5, Math.min(1, 0.55 + 0.45 * crescimento));
  const cresce = esc < 1 ? ` transform="translate(50 68) scale(${f2(esc)}) translate(-50 -68)"` : "";
  const planta = seca
    ? `<g transform="rotate(-9 50 68)" opacity=".88">${corpo}</g>`
    : parte("pa-planta", 50, 68, corpo);
  const brilhos = pronta ? `${parte("pa-luz", 50, 36, `<circle cx="50" cy="38" r="36" fill="#FFE08A" opacity=".22"/>`)}${faisca(14, 30, 4, "#FFE08A", 0)}${faisca(88, 22, 4.6, "#FFE08A", 0.8)}${faisca(84, 58, 3, "#FFF3B0", 1.6)}` : "";
  const gota = seca ? `<g class="pa pa-sobe" style="transform-origin:22px 40px"><path d="M22 34 q3 5 0 8 q-3 -3 0 -8z" fill="#8FD3FA" stroke="${T}" stroke-width=".9"/></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="planta ${classe}" viewBox="0 0 100 100" style="--fase:-${((id.length * 0.37) % 3).toFixed(2)}s">${defs ? `<defs>${defs}</defs>` : ""}${brilhos}<g${cresce}>${planta}</g>${gota}${vaso(rar, seca, vasoCor)}</svg>`;
}
