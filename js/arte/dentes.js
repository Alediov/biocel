// Companheiros-dente em SVG (Moli e a turma). Todos aceitam humor: feliz | triste | uau | neutro, e marcam os olhos
// com a classe "olhos" para piscar.
// Desde 25/10/2026 (caminho 1 do design, guia em docs/guia-de-estilo.md) são "montados em partes" para animar:
// .ch-braco.esq / .ch-braco.dir (bracinhos com o ombro como eixo, atrás do corpo) e .ch-rosto (olhos e boca, que
// olham para os lados). As animações ficam no CSS (estilo.css, "personagens em partes", e arte.css): parado (respira,
// pisca, olha, balança os braços), .reage-certo (pula com os braços para cima), .reage-errado (treme e murcha), .acena
// e .comemora. Desde 26/10/2026 (guia v2, arte/kit.js): volume em dois tons, rosto novo, acessórios refeitos com
// sombra e brilho, e acessórios que se mexem (capa, pontas da bandana, laço, faíscas).
import { CHAPEUS, caixaComChapeu } from "./humano.js";
import { T, vol, volE, brilho, luzinha, chao, rosto as rostoKit, faisca, parte, sombraDe, mistura } from "./kit.js";

// ombros (esquerdo e direito) de cada forma: de onde saem os bracinhos
const OMBRO = { molar: [[21, 70], [99, 70]], incisivo: [[33, 60], [87, 60]], canino: [[35, 62], [85, 62]], premolar: [[27, 66], [93, 66]], leite: [[31, 70], [89, 70]], implante: [[25, 56], [95, 56]] };
function bracos(tipo, cor) {
  const [[lx, ly], [rx, ry]] = OMBRO[tipo] || OMBRO.molar;
  const sb = sombraDe(cor);
  const braco = (x, y, lado) => {
    const d = `M${x} ${y} q${lado * 9} 5 ${lado * 11} 16`;
    // contorno grosso + recheio na cor do esmalte: um braço "de massinha" com a mão redonda na ponta
    return `<g class="ch-braco ${lado < 0 ? "esq" : "dir"}" style="transform-origin:${x}px ${y}px"><path d="${d}" stroke="${T}" stroke-width="10" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${lado < 0 ? sb : cor}" stroke-width="4.4" stroke-linecap="round" fill="none"/><circle cx="${x + lado * 11}" cy="${y + 16}" r="1.3" fill="#fff" opacity="${lado < 0 ? 0.5 : 0.9}"/></g>`;
  };
  return braco(lx, ly, -1) + braco(rx, ry, 1);
}
// onde fica o topo de cada forma (para pôr chapéus de evento)
const TOPO = { molar: [26, 1.35], incisivo: [32, 1.2], canino: [20, 1.05], premolar: [30, 1.25], leite: [40, 1.2], implante: [28, 1.35] };

const CORPOS = {
  molar: "M18 60 C14 30 30 14 44 20 C52 12 68 12 76 20 C90 14 106 30 102 60 C100 75 96 82 92 88 L90 112 C88 122 76 122 74 112 L70 93 C64 89 56 89 50 93 L46 112 C44 122 32 122 30 112 L28 88 C24 82 20 75 18 60Z",
  incisivo: "M30 34 C30 16 90 16 90 34 L86 80 C84 90 72 94 60 94 C48 94 36 90 34 80 Z M50 92 L54 120 Q60 126 66 120 L70 92 Z",
  canino: "M32 50 C30 30 50 14 60 6 C70 14 90 30 88 50 L84 84 C80 94 70 96 60 96 C50 96 40 94 36 84 Z M50 94 L56 124 Q60 128 64 124 L70 94 Z",
  premolar: "M24 56 C20 30 36 18 46 24 C52 16 68 16 74 24 C84 18 100 30 96 56 C94 72 90 82 86 88 L80 114 C78 122 70 122 68 114 L62 92 L58 92 L52 114 C50 122 42 122 40 114 L34 88 C30 82 26 72 24 56Z",
  leite: "M28 64 C24 40 38 30 48 34 C54 28 66 28 72 34 C82 30 96 40 92 64 C90 78 86 86 80 90 L78 104 C76 110 70 110 68 104 L64 92 C62 90 58 90 56 92 L52 104 C50 110 44 110 42 104 L40 90 C34 86 30 78 28 64Z",
  implante: "M22 52 C18 28 34 16 46 22 C54 14 66 14 74 22 C86 16 102 28 98 52 C96 66 90 74 84 78 L36 78 C30 74 24 66 22 52Z",
};
// brilhos de cada forma: um traço largo do lado da luz e um pontinho
const BRILHO = {
  molar: ["M90 40 C96 52 94 66 88 76", [84, 28]],
  incisivo: ["M80 36 C84 48 84 62 80 72", [76, 28]],
  canino: ["M72 34 C80 44 82 58 78 70", [66, 20]],
  premolar: ["M86 40 C92 52 90 66 84 76", [80, 30]],
  leite: ["M82 48 C86 58 84 70 80 78", [76, 40]],
  implante: ["M86 36 C92 46 90 58 84 66", [80, 28]],
};
/** Compatível com o rosto antigo (bichos.js usa): rosto(humor, { y, dx, cx, cilios, semBoca }). */
export function rosto(humor, { cilios = false, y = 52, dx = 14, cor = T, cx = 60, semBoca = false, boca, by = null } = {}) {
  return rostoKit(humor, { cilios, y, dx, cor, cx, by, boca: semBoca ? "sem" : boca || "sorriso" });
}

const ouro = (d, o = {}) => vol(d, "#F2B33D", { k: 2.4, sombra: "#C98A12", luz: "#FFE08A", contorno: 2.6, ...o });
const ACESS = {
  laco: () => parte("pa-laco", 60, 14, `${vol("M60 14 C52 6 44 0 40 6 C37 12 41 22 48 22 C53 22 57 18 60 14Z", "#F07BB0", { k: 2.5, contorno: 2.5 })}${vol("M60 14 C68 6 76 0 80 6 C83 12 79 22 72 22 C67 22 63 18 60 14Z", "#F07BB0", { k: 2.5, contorno: 2.5 })}<path d="M46 10 C49 12 51 14 52 17 M74 10 C71 12 69 14 68 17" stroke="#C9457F" stroke-width="1.6" fill="none" stroke-linecap="round"/>${volE(60, 14, 5.5, 5, "#E2557A", { k: 1.6, contorno: 2.2 })}${luzinha(61.5, 12, 1.4)}`),
  escuros: () => `<g><path d="M28 43 h26 l-2.4 11 q-10.6 6 -21.2 0z M66 43 h26 l-2.4 11 q-10.6 6 -21.2 0z" fill="${T}"/><path d="M54 46 h12" stroke="${T}" stroke-width="3.2"/><path d="M33 46.5 l6 -1.6 M36 51 l9 -3 M71 46.5 l6 -1.6 M74 51 l9 -3" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".55"/><path d="M28 43 h-6 M92 43 h6" stroke="${T}" stroke-width="3" stroke-linecap="round"/></g>`,
  redondos: () => `<g><circle cx="46" cy="52" r="10.5" fill="#CFEFFF" fill-opacity=".38" stroke="#B07508" stroke-width="3.2"/><circle cx="74" cy="52" r="10.5" fill="#CFEFFF" fill-opacity=".38" stroke="#B07508" stroke-width="3.2"/><path d="M56.5 51 q3.5 -2.4 7 0" stroke="#B07508" stroke-width="3" fill="none"/><path d="M40 48 q3 -4 8 -4.4 M68 48 q3 -4 8 -4.4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"/><path d="M35.5 50 l-6 -2 M84.5 50 l6 -2" stroke="#B07508" stroke-width="2.6" stroke-linecap="round"/></g>`,
  coque_branco: () => `<g>${volE(60, 11, 11, 10, "#F4F2EE", { k: 2.6, contorno: 2.5 })}<path d="M53 7 q6 -4 13 1 M52 13 q8 4 16 0" stroke="#C9C4BA" stroke-width="1.8" fill="none" stroke-linecap="round"/>${luzinha(64, 6, 1.8)}<path d="M42 23 Q60 13 78 23" fill="none" stroke="#E6E2DA" stroke-width="5.5" stroke-linecap="round"/><path d="M48 20 l2 4 M60 17.5 v4 M72 20 l-2 4" stroke="#C9C4BA" stroke-width="1.4" stroke-linecap="round"/></g>`,
  chupeta: () => `<g>${volE(60, 74, 11, 6.5, "#7FD6F5", { k: 2, contorno: 2.4 })}<circle cx="60" cy="82" r="5.5" fill="none" stroke="${T}" stroke-width="5"/><circle cx="60" cy="82" r="5.5" fill="none" stroke="#FFC24B" stroke-width="2.6"/>${volE(60, 72, 3.6, 3, "#FFFFFF", { k: 1, contorno: 1.8 })}${luzinha(66, 71.5, 1.5)}</g>`,
  babador: () => `<g>${vol("M36 82 Q60 98 84 82 L82 94 Q60 108 38 94Z", "#FFE1EC", { k: 2.4, contorno: 2.4 })}<path d="M40 85 Q60 99 80 85" stroke="#F07BB0" stroke-width="1.8" fill="none" stroke-dasharray="1 4" stroke-linecap="round"/><circle cx="50" cy="95" r="1.8" fill="#F07BB0"/><circle cx="60" cy="98" r="1.8" fill="#F07BB0"/><circle cx="70" cy="95" r="1.8" fill="#F07BB0"/></g>`,
  rosca: () => `<g>${vol("M44 78 L76 78 L74 86 L76 88 L72 96 L74 98 L70 106 L72 108 L66 116 L68 118 L60 128 L52 118 L54 116 L48 108 L50 106 L46 98 L48 96 L44 88 L46 86Z", "#B9C2D0", { k: 3, luz: true, contorno: 2.4 })}<path d="M45 87 H75 M47 97 H73 M49 107 H71 M53 117 H67" stroke="#7F8AA3" stroke-width="2" stroke-linecap="round"/><path d="M68 82 l-4 30" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/></g>`,
  brincos: () => `<g>${volE(22, 63, 4, 4, "#F2B33D", { k: 1.4, contorno: 1.6, sombra: "#C98A12" })}${volE(98, 63, 4, 4, "#F2B33D", { k: 1.4, contorno: 1.6, sombra: "#C98A12" })}${luzinha(23.4, 61.6, 1.1)}${luzinha(99.4, 61.6, 1.1)}</g>`,
  coroa_real: () => `<g>${ouro("M34 22 L37 -2 L49 11 L60 -7 L71 11 L83 -2 L86 22Z", { k: 3, contorno: 3 })}<path d="M35 16 H85" stroke="#C98A12" stroke-width="2.2"/>${volE(60, 9, 4.4, 4.4, "#E0434A", { k: 1.4, contorno: 1.8 })}${volE(44, 15, 3, 3, "#7FD6F5", { k: 1, contorno: 1.5 })}${volE(76, 15, 3, 3, "#7FD6F5", { k: 1, contorno: 1.5 })}${luzinha(61.4, 7.6, 1.3)}<circle cx="37" cy="-2" r="2.6" fill="#FFE08A" stroke="${T}" stroke-width="1.6"/><circle cx="60" cy="-7" r="2.6" fill="#FFE08A" stroke="${T}" stroke-width="1.6"/><circle cx="83" cy="-2" r="2.6" fill="#FFE08A" stroke="${T}" stroke-width="1.6"/>${faisca(92, 2, 4, "#FFE08A", 0.4)}</g>`,
  capa_real: () => parte("pa-capa", 60, 40, `${vol("M24 40 Q4 96 16 128 L104 128 Q116 96 96 40 Z", "#8B5CF6", { k: 6, contorno: 3 })}<path d="M30 60 Q24 92 30 120 M90 60 Q96 92 90 120" stroke="#6B3FD8" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>${vol("M14 120 Q60 132 106 120 L106 129 Q60 140 14 129Z", "#FAFAF7", { k: 2, contorno: 2.6 })}<path d="M26 126 l2 3 l2 -3 M46 129 l2 3 l2 -3 M70 129 l2 3 l2 -3 M90 126 l2 3 l2 -3" stroke="${T}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`),
  bandana: () => `<g>${vol("M24 34 Q60 12 96 34 L94 43 Q60 22 26 43Z", "#E0434A", { k: 2.6, contorno: 2.5 })}${parte("pa-pontas", 96, 38, `${vol("M95 37 l15 -8 l-3 11 l9 5 l-17 2z", "#E0434A", { k: 2, contorno: 2.2 })}`)}<circle cx="42" cy="30.5" r="2.1" fill="#fff"/><circle cx="60" cy="25.5" r="2.1" fill="#fff"/><circle cx="78" cy="30.5" r="2.1" fill="#fff"/><circle cx="51" cy="28" r="1.2" fill="#fff" opacity=".8"/><circle cx="69" cy="28" r="1.2" fill="#fff" opacity=".8"/></g>`,
  curativo: () => `<g transform="translate(3 5) rotate(-25 88 76)">${vol("M76 71 h24 a5 5 0 0 1 0 10 h-24 a5 5 0 0 1 0 -10z", "#F6CBA7", { k: 1.6, contorno: 2 })}<rect x="84" y="72.2" width="8" height="7.6" rx="1.5" fill="#E6A97C"/><circle cx="79.5" cy="74" r=".9" fill="#C98A5E"/><circle cx="79.5" cy="78" r=".9" fill="#C98A5E"/><circle cx="96.5" cy="74" r=".9" fill="#C98A5E"/><circle cx="96.5" cy="78" r=".9" fill="#C98A5E"/></g>`,
  monoculo: () => `<g><circle cx="74" cy="52" r="10.5" fill="#CFEFFF" fill-opacity=".38" stroke="#B07508" stroke-width="3.2"/><path d="M68 48 q3 -4 8 -4.4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>${parte("pa-corrente", 84, 56, `<path d="M84 56 Q92 72 84 90" stroke="#B07508" stroke-width="1.8" fill="none" stroke-dasharray="2.4 1.6"/>`)}</g>`,
  bigode: () => `${vol("M60 64 C54 57 42 57 37 64 C33 69 36 74 41 72 C44 68 51 68 60 67 C69 68 76 68 79 72 C84 74 87 69 83 64 C78 57 66 57 60 64Z", "#8A5A3B", { k: 1.8, contorno: 2.2 })}`,
  brilho: () => `${faisca(10, 30, 6, "#FFE08A", 0)}${faisca(108, 42, 4.5, "#FFE08A", 0.9)}${faisca(104, 10, 3.4, "#BFF0FF", 1.6)}`,
};

/** "Fase" de cada companheiro: um atraso diferente para os desenhos iguais não mexerem todos juntos. */
export const fase = (nome = "") => { let h = 7; for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `--fase:-${(h % 4000) / 1000}s`; };

/** tipo: molar|incisivo|canino|premolar|leite|implante; opts: humor, cor (esmalte), acessorios, cilios */
export function dente(tipo, { humor = "feliz", classe = "", cor = "#FFFFFF", brilho: corBrilho = null, acessorios = [], cilios = false, nome = "Companheiro", chapeu = null } = {}) {
  const tras = acessorios.filter(a => a === "capa_real").map(a => ACESS[a]()).join("");
  const frente = acessorios.filter(a => a !== "capa_real" && !(chapeu && ["laco", "coroa_real", "coque_branco", "bandana"].includes(a))).map(a => (ACESS[a] ? ACESS[a]() : "")).join("");
  const [topo, esc] = TOPO[tipo] || TOPO.molar;
  const hat = chapeu && CHAPEUS[chapeu] ? `<g transform="translate(60 ${topo}) scale(${esc}) translate(-60 -44)">${CHAPEUS[chapeu]()}</g>` : "";
  const y = tipo === "canino" ? 56 : tipo === "leite" ? 58 : tipo === "implante" ? 46 : 52;
  const [db, [px, py]] = BRILHO[tipo] || BRILHO.molar;
  const sombra = corBrilho ? mistura(corBrilho, sombraDe(cor), 0.55) : sombraDe(cor);
  return `<svg class="dente ${classe}" viewBox="${hat ? caixaComChapeu(chapeu, topo, esc) : "-4 -10 128 142"}" role="img" aria-label="${nome}" style="${fase(nome)}">
    ${chao(60, 128, 34, 4)}
    ${tras}
    ${tipo === "implante" ? ACESS.rosca() : ""}
    ${bracos(tipo, cor)}
    ${vol(CORPOS[tipo], cor, { k: 6, sombra })}
    ${brilho(db, 6, 0.9)}${luzinha(px, py, 2.6)}
    <g class="ch-rosto">${rosto(humor, { cilios, y, by: acessorios.includes("bigode") ? y + 20 : null })}</g>
    ${frente}
    ${hat}
  </svg>`;
}
