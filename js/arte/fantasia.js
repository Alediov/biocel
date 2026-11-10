// Criaturas de fantasia para os jogos de aventura (Defesa do Sorriso e Masmorra do Siso), no traço dos companheiros
// (guia v2, arte/kit.js): contorno grosso, volume em dois tons, brilho e olhos expressivos. Viram imagens (canvas),
// então não têm partes animadas: quem mexe é o jogo.
import { T, vol, volE, volR, volU, circulos, sombraDe, brilho, luzinha } from "./kit.js";

const svg = (corpo, vb = "0 0 100 100") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${corpo}</svg>`;
const chao = (cx, cy, rx, ry = 5, op = 0.16) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${T}" opacity="${op}"/>`;

/** Olhos de vilão (ou assustados) e boca. boca: dentes | presas | o | linha. */
function olhos(cx, cy, k = 1, { bravo = true, boca = "dentes", iris = T } = {}) {
  const dx = 9 * k, f = (n) => +n.toFixed(2);
  let o = "";
  for (const s of [-1, 1]) {
    const x = cx + s * dx;
    o += `<ellipse cx="${f(x)}" cy="${f(cy)}" rx="${f(5.4 * k)}" ry="${f(6 * k)}" fill="#fff" stroke="${T}" stroke-width="${f(2.4 * k)}"/><ellipse cx="${f(x - s * 0.9 * k)}" cy="${f(cy + 1.2 * k)}" rx="${f(2.8 * k)}" ry="${f(3.2 * k)}" fill="${iris}"/><circle cx="${f(x - s * 0.9 * k + 1 * k)}" cy="${f(cy - 0.2 * k)}" r="${f(1 * k)}" fill="#fff"/>`;
    if (bravo) o += `<path d="M${f(x - s * 6 * k)} ${f(cy - 6 * k)} L${f(x + s * 6.4 * k)} ${f(cy - 11 * k)}" stroke="${T}" stroke-width="${f(3.4 * k)}" stroke-linecap="round"/>`;
  }
  const by = cy + 10.4 * k;
  if (boca === "dentes") o += `<path d="M${f(cx - 8.4 * k)} ${f(by)} Q${f(cx)} ${f(by + 8 * k)} ${f(cx + 8.4 * k)} ${f(by)} Z" fill="${T}" stroke="${T}" stroke-width="${f(1.2 * k)}" stroke-linejoin="round"/><path d="M${f(cx - 5.4 * k)} ${f(by + 0.6 * k)} l${f(2 * k)} ${f(3.2 * k)} l${f(2 * k)} ${f(-3.2 * k)}Z M${f(cx + 1.4 * k)} ${f(by + 0.6 * k)} l${f(2 * k)} ${f(3.2 * k)} l${f(2 * k)} ${f(-3.2 * k)}Z" fill="#fff"/>`;
  else if (boca === "presas") o += `<path d="M${f(cx - 8 * k)} ${f(by + 2 * k)} Q${f(cx)} ${f(by - 1 * k)} ${f(cx + 8 * k)} ${f(by + 2 * k)}" stroke="${T}" stroke-width="${f(2.6 * k)}" fill="none" stroke-linecap="round"/><path d="M${f(cx - 5 * k)} ${f(by + 1 * k)} l${f(1.4 * k)} ${f(4.4 * k)} l${f(1.4 * k)} ${f(-4.4 * k)}Z M${f(cx + 2.2 * k)} ${f(by + 1 * k)} l${f(1.4 * k)} ${f(4.4 * k)} l${f(1.4 * k)} ${f(-4.4 * k)}Z" fill="#fff" stroke="${T}" stroke-width="${f(1 * k)}" stroke-linejoin="round"/>`;
  else if (boca === "o") o += `<ellipse cx="${f(cx)}" cy="${f(by + 2.4 * k)}" rx="${f(3.4 * k)}" ry="${f(4.2 * k)}" fill="${T}"/>`;
  else if (boca !== "sem") o += `<path d="M${f(cx - 6 * k)} ${f(by + 2 * k)} Q${f(cx)} ${f(by - 2 * k)} ${f(cx + 6 * k)} ${f(by + 2 * k)}" stroke="${T}" stroke-width="${f(2.8 * k)}" fill="none" stroke-linecap="round"/>`;
  return `<g class="olhos">${o}</g>`;
}

/** Patas de aranha (4 de cada lado), com contorno; `passo` 0/1 alterna as patas para o andar do jogo. */
function pernas(cx, cy, passo, cor, w, k = 1) {
  const f = (n) => +n.toFixed(1);
  let o = "";
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const sobe = ((i + (s > 0 ? 1 : 0) + passo) % 2) * 4;
    const x0 = cx + s * 8 * k, y0 = cy + (-6 + i * 5) * k;
    const xj = cx + s * (26 + i * 2) * k, yj = cy + (-18 + i * 9 - sobe) * k;
    const xp = cx + s * (36 + i * 3) * k, yp = cy + (4 + i * 8 - sobe / 2) * k;
    const d = `M${f(x0)} ${f(y0)} Q${f(xj)} ${f(yj - 6 * k)} ${f(xp)} ${f(yp)}`;
    o += `<path d="${d}" stroke="${T}" stroke-width="${f(w + 3)}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${cor}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  }
  return o;
}

export const CRIATURAS = {
  gosma: (cor = "#7FD6A0", esc = "#3E9E66") => svg(`${chao(50, 92, 34)}
    ${vol("M14 84 C10 60 24 30 50 28 C76 30 90 60 86 84 C80 92 20 92 14 84Z", cor, { k: 5, contorno: 3.6, op: 0.95 })}
    ${vol("M22 82 c2 7 9 7 11 0 M60 84 c2 7 9 7 11 0", cor, { k: 1, contorno: 2.4 })}
    <circle cx="70" cy="66" r="5.4" fill="${esc}" opacity=".55"/><circle cx="32" cy="70" r="3.2" fill="${esc}" opacity=".55"/><circle cx="60" cy="40" r="2.4" fill="#fff" opacity=".5"/>
    ${brilho("M26 52 q4 -12 16 -16", 4.6, 0.85)}${luzinha(46, 34, 2.2)}
    ${olhos(50, 56, 1)}`),
  reiGosma: () => svg(`${chao(50, 93, 40)}
    ${vol("M8 86 C4 56 22 30 50 30 C78 30 96 56 92 86 C84 94 16 94 8 86Z", "#B69CF7", { k: 5.4, contorno: 3.8, op: 0.96 })}
    ${vol("M30 32 L33 12 L42 24 L50 6 L58 24 L67 12 L70 32 Q50 36 30 32Z", "#F2B33D", { k: 2, contorno: 3.4, luz: true })}${volE(50, 20, 3.6, 3.6, "#E0434A", { k: 0.8, contorno: 1.8 })}${luzinha(33, 12, 1.6)}${luzinha(67, 12, 1.6)}
    <circle cx="74" cy="70" r="6.4" fill="#6B4FD8" opacity=".45"/><circle cx="24" cy="74" r="4.4" fill="#6B4FD8" opacity=".45"/>
    ${brilho("M20 56 q4 -14 18 -18", 5, 0.85)}
    ${olhos(50, 58, 1.25)}`),
  morcego: (asa = 0) => svg(`${chao(50, 92, 18, 4, 0.12)}
    ${vol(asa ? "M40 50 C26 30 10 34 4 44 C12 44 14 52 20 54 C24 50 30 54 32 58Z M60 50 C74 30 90 34 96 44 C88 44 86 52 80 54 C76 50 70 54 68 58Z" : "M40 52 C24 56 10 68 6 78 C14 74 18 80 24 78 C26 72 32 72 34 66Z M60 52 C76 56 90 68 94 78 C86 74 82 80 76 78 C74 72 68 72 66 66Z", "#5B54D6", { k: 2, contorno: 3.4 })}
    ${vol("M34 36 L36 16 L45 30Z M66 36 L64 16 L55 30Z", "#7C6CF0", { k: 1.2, contorno: 2.6 })}<path d="M37 30 L37.6 22 L41 28Z M63 30 L62.4 22 L59 28Z" fill="#F7A8C8"/>
    ${volE(50, 52, 20, 20, "#7C6CF0", { k: 3.4, contorno: 3.6 })}
    ${brilho("M58 38 q6 3 8 10", 3, 0.75)}
    ${olhos(50, 50, 0.8, { boca: "presas" })}`),
  golem: () => svg(`${chao(50, 93, 34)}
    ${vol("M18 88 L14 52 L26 26 L50 18 L74 26 L86 52 L82 88 Z", "#9AA3B8", { k: 4, contorno: 3.6 })}
    <path d="M26 26 L31 40 L26 58 M74 26 L69 42 L74 60 M44 80 L56 74" stroke="#6F7890" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${vol("M22 30 q10 -8 20 -6 q-6 6 -18 10z", "#7FD6A0", { k: 1, contorno: 2.4 })}${vol("M60 22 q12 0 18 8 q-10 0 -18 -4z", "#7FD6A0", { k: 1, contorno: 2.4 })}
    <rect x="31" y="41.5" width="38" height="16" rx="6" fill="#6F7890" opacity=".35"/>
    ${brilho("M70 34 l6 14", 3.2, 0.6)}
    ${olhos(50, 50, 0.95, { boca: "linha", iris: "#E0434A" })}`),
  fantasma: () => svg(`${chao(50, 94, 20, 4, 0.1)}
    ${vol("M22 84 L22 44 C22 22 78 22 78 44 L78 84 L70 78 L62 86 L54 78 L46 86 L38 78 L30 86 Z", "#F4F2FF", { k: 3.4, contorno: 3.6, sombra: "#D6D2F2", op: 0.96 })}
    ${brilho("M30 40 q4 -10 14 -12", 4, 0.9)}
    ${olhos(50, 52, 0.9, { bravo: false, boca: "o" })}`),
  goblin: () => svg(`${chao(50, 93, 26)}
    ${vol("M24 46 L2 30 L10 52 Z M76 46 L98 30 L90 52 Z", "#7BC96F", { k: 1.4, contorno: 3.2 })}<path d="M20 44 L8 36 L12 48Z M80 44 L92 36 L88 48Z" fill="#E59AA8" opacity=".55"/>
    ${vol("M28 86 C24 70 28 60 50 60 C72 60 76 70 72 86 Z", "#8A5A3B", { k: 2.4, contorno: 3.4 })}<path d="M40 64 L50 74 L60 64" stroke="#5C3A1E" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${volE(50, 46, 26, 26, "#7BC96F", { k: 4, contorno: 3.6 })}
    ${vol("M30 28 Q50 10 70 28 Q60 22 50 24 Q40 22 30 28Z", "#5C3A1E", { k: 1, contorno: 2.4 })}
    ${brilho("M62 30 q6 4 8 12", 3.4, 0.7)}
    ${olhos(50, 46, 1, { iris: "#C2502A" })}`),
  cogumelo: () => svg(`${chao(50, 93, 24)}
    ${vol("M34 90 C32 74 34 60 36 54 L64 54 C66 60 68 74 66 90 Z", "#FFF3DC", { k: 2, contorno: 3.4 })}
    ${vol("M10 56 C10 26 90 26 90 56 C76 62 24 62 10 56Z", "#E0434A", { k: 3, contorno: 3.6 })}
    ${volE(32, 40, 6, 5.4, "#FFFFFF", { k: 0.8, contorno: 0 })}${volE(56, 33, 5, 4.4, "#FFFFFF", { k: 0.8, contorno: 0 })}${volE(74, 46, 4, 3.6, "#FFFFFF", { k: 0.6, contorno: 0 })}
    ${brilho("M20 44 q4 -10 14 -13", 3.2, 0.6)}
    ${olhos(50, 73, 0.8, { boca: "o" })}`),
  dragao: () => svg(`${chao(60, 112, 44, 6, 0.18)}
    ${vol("M30 60 C8 40 0 20 6 8 C16 22 26 26 36 30 C30 18 32 10 38 4 C42 18 48 26 52 36 Z", "#A3232A", { k: 2.4, contorno: 3.6 })}
    ${vol("M90 60 C112 40 120 20 114 8 C104 22 94 26 84 30 C90 18 88 10 82 4 C78 18 72 26 68 36 Z", "#A3232A", { k: 2.4, contorno: 3.6 })}
    <path d="M10 14 C18 26 28 34 40 40 M110 14 C102 26 92 34 80 40" stroke="#7A1418" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${vol("M28 106 C20 80 30 50 60 46 C90 50 100 80 92 106 Z", "#E0434A", { k: 4, contorno: 3.6 })}
    ${vol("M44 106 C44 86 50 74 60 72 C70 74 76 86 76 106 Z", "#FFC24B", { k: 1.6, contorno: 2.6 })}
    <path d="M50 82 h20 M48 92 h24 M47 101 h26" stroke="#E0A512" stroke-width="2.5" stroke-linecap="round"/>
    ${[1, -1].map(l => { const X = (x) => (l > 0 ? x : 120 - x); return `${vol(`M${X(33)} 40 C${X(26)} 30 ${X(20)} 20 ${X(18)} 7 C${X(28)} 12 ${X(40)} 18 ${X(47)} 33Z`, "#F4E6C8", { k: 1.4, contorno: 3.2, sombra: "#D9C39A" })}<path d="M${X(25)} 23.4 Q${X(31)} 25.6 ${X(36.4)} 21.4 M${X(20.6)} 14 Q${X(24.6)} 15.6 ${X(28.4)} 12.6" stroke="#C9AE7E" stroke-width="1.8" fill="none" stroke-linecap="round"/>`; }).join("")}
    ${vol("M24 46 C24 18 96 18 96 46 C96 64 80 72 60 72 C40 72 24 64 24 46Z", "#E0434A", { k: 4, contorno: 3.6 })}
    ${volE(60, 57, 20, 12, "#F07B6E", { k: 1.4, contorno: 2.6 })}<ellipse cx="53" cy="52.4" rx="2.4" ry="3" fill="${T}"/><ellipse cx="67" cy="52.4" rx="2.4" ry="3" fill="${T}"/>
    <path d="M50.6 62.4 l2 4 l2 -4 M65.4 62.4 l2 4 l2 -4" fill="#fff" stroke="${T}" stroke-width="1.5" stroke-linejoin="round"/><path d="M47 61 Q60 67.4 73 61" fill="none" stroke="${T}" stroke-width="2.6" stroke-linecap="round"/>
    ${brilho("M80 30 q8 6 10 16", 4, 0.7)}
    ${olhos(60, 38, 1.1, { boca: "sem", iris: "#F2B33D" })}`, "0 0 120 120"),
  // ---- Cripta (04/11/2026): aranhas, esqueleto arqueiro e os chefes Aracna e o Lich do Tártaro. O rosto fica numa
  // superfície só (cabeça da aranha, crânio do esqueleto, rosto do lich): nada cruza uma divisa de cor.
  aranha: (passo = 0) => svg(`${chao(50, 92, 30, 4, 0.14)}
    ${pernas(50, 62, passo, "#3B2F73", 3.4, 1)}
    ${volE(50, 44, 22, 18, "#5B4FC4", { k: 3, contorno: 3.4 })}<path d="M42 34 L50 42 L58 34 M44 48 L50 54 L56 48" stroke="#F2B33D" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${volE(50, 66, 19, 16, "#7C6CF0", { k: 3, contorno: 3.4 })}
    ${brilho("M38 34 q4 -6 10 -7", 3, 0.7)}
    ${olhos(50, 63, 0.72, { boca: "presas", iris: "#E0434A" })}`),
  aranhaRainha: () => svg(`${chao(60, 112, 46, 6, 0.18)}
    ${pernas(60, 76, 0, "#2E2560", 4.4, 1.12)}
    ${volE(60, 50, 34, 28, "#4B3FA8", { k: 4, contorno: 3.8 })}
    ${vol("M48 34 L72 34 L62 50 L72 66 L48 66 L58 50 Z", "#F2B33D", { k: 1.6, contorno: 2.6, luz: true })}
    ${volE(60, 84, 26, 21, "#7C6CF0", { k: 3.4, contorno: 3.6 })}
    ${vol("M42 68 L45 52 L53 62 L60 48 L67 62 L75 52 L78 68 Q60 72 42 68Z", "#F2B33D", { k: 1.8, contorno: 3.2, luz: true })}${volE(60, 58, 3, 3, "#E879F9", { k: 0.6, contorno: 1.6 })}${luzinha(45, 52, 1.4)}${luzinha(75, 52, 1.4)}
    ${brilho("M34 40 q6 -10 18 -13", 4, 0.7)}
    ${olhos(60, 83, 0.92, { boca: "presas", iris: "#E0434A" })}`, "0 0 120 120"),
  esqueleto: () => svg(`${chao(50, 93, 22)}
    <path d="M78 30 Q96 56 78 84" stroke="#8A5A3B" stroke-width="4.4" fill="none" stroke-linecap="round"/><path d="M78 30 L78 84" stroke="#F4EFE1" stroke-width="1.6"/>
    ${volR(36, 64, 28, 24, 9, "#E8E1CC", { k: 2.4, contorno: 3.2 })}<path d="M42 70 h16 M41 76 h18 M42 82 h16" stroke="#B9AE8E" stroke-width="2.4" stroke-linecap="round"/>
    ${vol("M28 42 C28 16 72 16 72 42 C72 54 67 59 63 61 L63 66 L37 66 L37 61 C33 59 28 54 28 42Z", "#F4EFE1", { k: 3.4, contorno: 3.6, sombra: "#CFC6AE" })}
    <path d="M34 30 L40 34 M66 30 L60 34" stroke="#CFC6AE" stroke-width="2" stroke-linecap="round"/>
    ${brilho("M36 26 q4 -6 12 -8", 3.4, 0.8)}
    ${olhos(50, 40, 0.82, { boca: "dentes", iris: "#4FD1E8" })}`),
  lich: () => svg(`${chao(60, 112, 40, 6, 0.18)}
    <path d="M98 22 L98 108" stroke="#6B4A2E" stroke-width="5" stroke-linecap="round"/>${volE(98, 18, 9, 9, "#7FF5C8", { k: 2, contorno: 3, luz: true })}${luzinha(95, 14, 2)}
    ${vol("M26 108 C24 80 30 54 40 40 L80 40 C90 54 96 80 94 108 Z", "#5B3FA8", { k: 4, contorno: 3.8 })}
    <path d="M60 66 L60 106 M44 76 L40 106 M76 76 L80 106" stroke="#46308A" stroke-width="2.6" stroke-linecap="round"/>
    ${vol("M30 56 C26 26 42 10 60 10 C78 10 94 26 90 56 C84 64 36 64 30 56Z", "#6B4FC8", { k: 4, contorno: 3.8 })}
    ${volE(60, 44, 20, 17, "#EDE7D6", { k: 2.6, contorno: 3.2, sombra: "#C9C0A8" })}
    ${vol("M40 24 L44 8 L52 18 L60 2 L68 18 L76 8 L80 24 Q60 30 40 24Z", "#E8D9A8", { k: 1.8, contorno: 3.2, luz: true })}${volE(60, 17, 3, 3, "#7FF5C8", { k: 0.6, contorno: 1.6 })}
    ${brilho("M38 34 q2 -12 12 -18", 3.6, 0.6)}
    ${olhos(60, 42, 0.86, { boca: "presas", iris: "#2FBF8F" })}`, "0 0 120 120"),
  cristal: (rachado = false) => svg(`${chao(50, 93, 26)}
    ${vol("M50 6 L78 34 L68 88 L32 88 L22 34 Z", rachado ? "#9AA3C7" : "#7FD6F5", { k: 3, contorno: 3.6, luz: !rachado })}
    <path d="M50 6 L50 46 M22 34 L50 46 L78 34" stroke="${rachado ? "#6F7890" : "#4FB3D9"}" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    ${rachado ? `<path d="M40 20 L48 40 L38 52 L46 70" stroke="${T}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : `${brilho("M34 32 l8 -14", 4)}${luzinha(62, 22, 2.2)}`}
    ${olhos(50, 58, 0.75, { bravo: false, boca: rachado ? "linha" : "o" })}`),
};

export function imagem(svgTexto) {
  const i = new Image();
  i.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTexto);
  return i;
}
