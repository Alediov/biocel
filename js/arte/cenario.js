// Objetos do cenário da trilha: pequenos personagens no traço dos companheiros (guia v2, arte/kit.js: volume em dois
// tons, contorno, brilho e carinha com dois brilhos nos olhos). Cada um aceita humor: feliz | uau | sono.
// Partes que se mexem (arte.css, o <svg> já sai .vivo): gotas que pingam, bolhas, vapor, luz que pulsa, zzz, pulsos do
// nervo, fio que balança… Temas por disciplina: Anestesiologia, Patologia, noite, Farmacologia, Periodontia (LAPERIO),
// Semiologia, eventos, geral e Xadrez.
import { T, vol, volE, volR, volU, circulos, sombraDe, chao, brilho, luzinha, faisca, estrela5, parte, bolha, tubo, carinha } from "./kit.js";

/** Carinha (o nome antigo continua valendo). */
export const cara = carinha;
const sombra = (cx = 50, rx = 26) => chao(cx, 95, rx, 3.5, 0.13);
const gota = (x, y, cor = "#7FD6F5", atraso = 0) => `<g class="pa pa-gota" style="transform-origin:${x}px ${y}px;--pd:${atraso}s"><path d="M${x} ${y - 4} q3.2 5 0 8 q-3.2 -3 0 -8z" fill="${cor}" stroke="${T}" stroke-width="1.4"/></g>`;
const sobe = (x, y, conteudo, atraso = 0) => `<g class="pa pa-sobe" style="transform-origin:${x}px ${y}px;--pd:${atraso}s">${conteudo}</g>`;
const zzz = (x, y) => `${sobe(x, y, `<text x="${x}" y="${y}" font-family="Bricolage, sans-serif" font-weight="800" font-size="12" fill="#9FB6F5">z</text>`, 0)}${sobe(x + 8, y - 9, `<text x="${x + 8}" y="${y - 9}" font-family="Bricolage, sans-serif" font-weight="800" font-size="9" fill="#9FB6F5">z</text>`, 1.2)}`;
const CORES_TUBETE = ["#2F6BFF", "#D93A3A", "#C98A0C", "#8A5A3B", "#3A3F52"];
const metal = "#C3CBD8";
const base = (cor) => `${vol("M28 91 H72 Q77 91 77 85 Q77 78 68 77 H32 Q23 78 23 85 Q23 91 28 91Z", cor, { k: 1.6, contorno: 3.2 })}`;

// O cavalo é a única peça de perfil (03/11/2026, pedido do Alediov: dois olhos e uma boca de um lado só ficavam
// estranhos): um olho só, o do lado que se vê, e a boca no focinho, acompanhando a curva de baixo dele, tudo na mesma
// superfície da cabeça (guia de estilo: "boca num pedaço só").
function rostoDePerfil(h) {
  const x = 46.5, y = 28.5;
  const olho = h === "sono"
    ? `<path d="M${x - 3.6} ${y + 0.4} q3.6 3 7.2 0" stroke="${T}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${x}" cy="${y}" rx="3.3" ry="${h === "uau" ? 5 : 4.3}" fill="${T}"/><circle cx="${x + 1.3}" cy="${y - 1.8}" r="1.35" fill="#fff"/><circle cx="${x - 1}" cy="${y + 1.8}" r="0.65" fill="#fff" opacity=".85"/>`;
  const boca = h === "uau"
    ? `<ellipse cx="29.4" cy="48" rx="2.2" ry="2.6" fill="${T}"/><ellipse cx="29.5" cy="49.3" rx="1.3" ry="0.8" fill="#FF8FA3"/>`
    : h === "sono" ? `<path d="M25.4 48.2 Q28.6 49.4 31.6 48.4" stroke="${T}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<path d="M25.4 46.8 Q28 50.4 33.4 48.6" stroke="${T}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
  return `<g class="olhos">${olho}</g>${boca}`;
}

export const OBJETOS = {
  // ---------- Anestesiologia ----------
  seringa: {
    nome: "Seringa carpule",
    svg: (v, h) => `${sombra(50, 34)}<g transform="rotate(-24 50 54)">
      <circle cx="12" cy="54" r="8" fill="none" stroke="${T}" stroke-width="7"/><circle cx="12" cy="54" r="8" fill="none" stroke="${metal}" stroke-width="3.4"/>
      ${volR(20, 51, 10, 6, 1.4, metal, { k: 1, contorno: 2.4, luz: true })}
      ${volR(29, 38, 50, 32, 9, "#E9EEF6", { k: 2.4, contorno: 3.4, luz: true })}
      ${volR(57, 44.6, 16, 19, 4, "#EAF6FF", { k: 1, contorno: 2.2 })}<rect x="58.2" y="48.6" width="13.6" height="5" fill="${CORES_TUBETE[v % CORES_TUBETE.length]}"/>${bolha(64, 60, 1.4, 0, "#BFE6FF")}
      ${volR(79, 47, 7, 14, 1.4, metal, { k: 0.8, contorno: 2.4 })}
      <path d="M86 54 h13" stroke="${T}" stroke-width="2.8" stroke-linecap="round"/><path d="M86 54 h12" stroke="#E9EEF6" stroke-width="1" stroke-linecap="round"/>
      ${brilho("M34 44 h14", 3)}${carinha(44, 52, 0.8, h)}
    </g>${gota(95, 26, "#7FD6F5", 0.3)}`,
  },
  tubete: {
    nome: "Tubete",
    svg: (v = 0, h) => `${sombra(50, 20)}
      ${volR(37, 5, 26, 11, 4, metal, { k: 1.2, contorno: 3.2, luz: true })}
      ${volR(32, 14, 36, 74, 10, "#EAF6FF", { k: 2.4, contorno: 3.4, sombra: "#C8DDF2" })}
      <rect x="35.6" y="36" width="28.8" height="40" rx="5" fill="#BFE6FF" opacity=".75"/>${bolha(42, 70, 1.8, 0, "#fff")}${bolha(57, 66, 1.4, 1, "#fff")}${bolha(50, 72, 1.2, 1.8, "#fff")}
      <rect x="33.8" y="21" width="32.4" height="9" fill="${CORES_TUBETE[v % CORES_TUBETE.length]}"/><path d="M36 23.6 h10" stroke="#fff" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>
      ${volR(34, 76, 32, 12, 4, "#5C6680", { k: 1, contorno: 3.2 })}
      ${brilho("M61 38 v26", 3.4)}${carinha(50, 50, 0.85, h)}`,
  },
  ampola: {
    nome: "Frasco de anestésico",
    svg: (v, h) => `${sombra(50, 24)}
      ${volR(39, 6, 22, 11, 3, "#E0434A", { k: 1.2, contorno: 3.2 })}
      ${vol("M42 17 h16 v8 q16 6 16 22 v36 q0 7 -7 7 h-34 q-7 0 -7 -7 v-36 q0 -16 16 -22z", "#EAF6FF", { k: 2.4, contorno: 3.4, sombra: "#C8DDF2" })}
      <path d="M27.6 66 h44.8 v17 q0 6 -6 6 h-32.8 q-6 0 -6 -6z" fill="#BFE6FF" opacity=".7"/>${bolha(36, 84, 1.6, 0.4, "#fff")}${bolha(64, 82, 1.3, 1.5, "#fff")}
      ${volR(30, 50, 40, 27, 5, "#FFFFFF", { k: 1, contorno: 2.4, sombra: "#E4E9F4" })}<path d="M34 72 h18" stroke="#2F6BFF" stroke-width="2.2" stroke-linecap="round"/>
      ${brilho("M67 34 q3 6 3 12", 3.4)}${carinha(50, 60, 0.85, h)}`,
  },
  nervo: {
    nome: "Nervo trigêmeo",
    svg: (v, h) => `${sombra(50, 22)}
      ${tubo("M50 94 C50 78 48 70 48 62", "#F2C94C", { w: 6.4, contorno: 2.8 })}${tubo("M42 54 C34 46 24 36 12 30", "#F2C94C", { w: 6, contorno: 2.8 })}${tubo("M58 52 C66 44 76 40 88 36", "#F2C94C", { w: 6, contorno: 2.8 })}${tubo("M60 62 C68 64 76 68 86 76", "#F2C94C", { w: 6, contorno: 2.8 })}
      ${volE(50, 56, 17, 13, "#F7D774", { k: 2, contorno: 3.4 })}
      ${brilho("M40 50 q4 -5 10 -5", 3)}
      ${[[12, 30, 0], [88, 36, 0.6], [86, 76, 1.2]].map(([x, y, d]) => parte("pa-pulsa", x, y, `<circle cx="${x}" cy="${y}" r="5" fill="#FFF3C4" stroke="${T}" stroke-width="2.4"/><circle cx="${x - 1.2}" cy="${y - 1.4}" r="1.3" fill="#fff"/>`, d)).join("")}
      ${carinha(50, 54, 0.72, h)}`,
  },
  // ---------- Patologia ----------
  microscopio: {
    nome: "Microscópio",
    svg: (v, h) => `${sombra(50, 30)}
      ${vol("M20 84 h50 q6 0 6 6 v3 h-62 v-3 q0 -6 6 -6z", "#5C6680", { k: 1.4, contorno: 3.2 })}
      ${tubo("M64 86 v-14 q9 -12 2 -30 l-5 -8", "#8F9CC2", { w: 6, contorno: 2.8 })}
      ${tubo("M28 68 h36", "#C9D3E3", { w: 5, contorno: 2.6 })}
      ${parte("pa-luz", 43, 64, `<ellipse cx="43" cy="64.6" rx="10" ry="2.4" fill="#FFF3B0" opacity=".8"/>`)}
      ${volR(34, 61.4, 18, 4.4, 1.5, "#BFE6FF", { k: 0.6, contorno: 2 })}
      <g transform="rotate(-22 44 36)">${volR(32, 16, 26, 40, 8, "#E9EEF6", { k: 2, contorno: 3.2, luz: true })}${volR(34, 7, 22, 11, 4, "#5C6680", { k: 1, contorno: 3 })}${volR(39, 55, 12, 7, 1, "#5C6680", { k: 0.6, contorno: 2.4 })}${brilho("M53 22 v10", 3)}${carinha(45, 34, 0.7, h)}</g>
      ${volE(72, 58, 5.6, 5.6, "#C9D3E3", { k: 0.8, contorno: 2.4 })}`,
  },
  lamina: {
    nome: "Lâmina histológica",
    svg: (v, h) => `${sombra(50, 36)}<g transform="rotate(-10 50 58)">
      ${volR(6, 38, 88, 36, 5, "#EAF6FF", { k: 1.6, contorno: 3.2, sombra: "#C8DDF2" })}
      ${volR(9, 41, 20, 30, 2, "#FFFFFF", { k: 0.6, contorno: 1.8 })}<path d="M13 50 h12 M13 57 h8" stroke="#9AA3C7" stroke-width="2.6" stroke-linecap="round"/>
      ${volE(62, 56, 24, 14, "#F7A8C8", { k: 1.4, contorno: 2.4, sombra: "#E383AE" })}
      <g fill="#7B4FC9"><circle cx="44" cy="52" r="2.4"/><circle cx="80" cy="60" r="2.4"/><circle cx="78" cy="49" r="2"/><circle cx="50" cy="63" r="1.8"/><circle cx="72" cy="66" r="1.8"/></g>
      ${parte("pa-varre", 50, 56, `<path d="M44 40 L52 40 L40 72 L32 72Z" fill="#fff" opacity=".7"/>`)}
      ${brilho("M36 43 l8 -2", 3)}${carinha(62, 54, 0.72, h)}
    </g>`,
  },
  celula: {
    nome: "Célula",
    svg: (v, h) => `${sombra(50, 28)}
      ${parte("pa-gelatina", 50, 90, `${vol("M50 10 C74 8 92 28 90 50 C88 76 70 90 48 88 C24 86 8 68 10 47 C12 26 28 11 50 10Z", "#FFD3E6", { k: 3, contorno: 3.4 })}
      ${volE(68, 34, 11, 11, "#A78BFA", { k: 1.4, contorno: 2.6 })}<circle cx="71" cy="31" r="3.5" fill="#6B4FD8"/>
      ${vol("M18 64 q6 -6 13 -1 q-6 6 -13 1z", "#FFB36B", { k: 0.6, contorno: 2 })}${vol("M68 72 q6 -7 13 -1 q-6 6 -13 1z", "#FFB36B", { k: 0.6, contorno: 2 })}
      <circle cx="28" cy="34" r="2.4" fill="#E2557A"/><circle cx="62" cy="80" r="2" fill="#E2557A"/><circle cx="36" cy="78" r="1.6" fill="#E2557A"/>
      ${brilho("M22 26 q8 -7 16 -8", 3.4)}${carinha(44, 56, 1, h)}`)}`,
  },
  osso: {
    nome: "Osso",
    svg: (v, h) => `${sombra(50, 32)}<g transform="rotate(-24 50 52)">
      ${volU(circulos([[28, 34, 10], [34, 24, 10], [66, 76, 10], [72, 66, 10]]) + "M26.5 33 L64.5 75 L73.5 67 L35.5 25Z", "#FFF8EC", { k: 2, contorno: 3.2, sombra: "#EADBC0" })}
      ${brilho("M28 28 q2 -4 6 -4", 3)}${carinha(50, 50, 0.78, h)}
    </g>`,
  },
  petri: {
    nome: "Placa de Petri",
    svg: (v, h) => `${sombra(50, 36)}
      ${volE(50, 66, 40, 19, "#D6EBFF", { k: 1, contorno: 3.2 })}
      ${volE(50, 58, 40, 19, "#EAF6FF", { k: 1.4, contorno: 3.2, sombra: "#C8DDF2" })}
      <ellipse cx="50" cy="60" rx="32" ry="13" fill="#FFF2B8" stroke="#E0B23C" stroke-width="2.4"/>
      ${[[28, 60, 3.6, "#7FD6A0", 0], [72, 62, 4.6, "#F7A8C8", 0.7], [68, 53, 2.6, "#A78BFA", 1.4], [36, 66, 2.2, "#FFB36B", 2]].map(([x, y, r, c, d]) => parte("pa-pulsa", x, y, `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${T}" stroke-width="1.6"/>`, d)).join("")}
      ${brilho("M20 50 q6 -8 18 -10", 3.4)}${carinha(50, 57, 0.75, h)}`,
  },
  // ---------- Noite ----------
  lua: {
    nome: "Lua",
    svg: (v, h) => `${parte("pa-luz", 50, 50, `<circle cx="50" cy="50" r="44" fill="#FFE08A" opacity=".22"/>`)}
      ${volE(50, 52, 32, 32, "#FFE9A8", { k: 3, contorno: 3.4 })}
      <circle cx="34" cy="40" r="5" fill="#F7D774"/><circle cx="66" cy="70" r="4" fill="#F7D774"/><circle cx="70" cy="38" r="3" fill="#F7D774"/>
      <path d="M74 30 q8 20 -6 38" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".8"/>
      ${vol("M34 22 Q50 2 70 22 Q60 16 50 22 Q42 18 34 22Z", "#5B54D6", { k: 1, contorno: 2.4 })}${parte("pa-balanca", 72, 20, volE(74, 20, 4.6, 4.6, "#FFFFFF", { k: 0.8, contorno: 2.2 }))}
      ${carinha(50, 54, 1, h === "feliz" ? "sono" : h)}${h === "uau" ? "" : zzz(80, 40)}${faisca(14, 22, 3.4, "#FFE08A", 0.4)}${faisca(90, 76, 2.6, "#FFF3B0", 1.5)}`,
  },
  livro: {
    nome: "Livro",
    svg: (v, h) => `${sombra(50, 30)}
      ${volR(26, 14, 52, 76, 5, "#FFFFFF", { k: 1, contorno: 3.2, sombra: "#E4E9F4" })}<path d="M30 20 h44 M30 26 h44 M30 32 h44" stroke="#E4E9F4" stroke-width="1.4"/>
      ${volR(22, 10, 52, 76, 6, "#5C8DD6", { k: 2.4, contorno: 3.4 })}
      <path d="M30 10 v76" stroke="${T}" stroke-width="2.4" opacity=".35"/>
      ${volR(36, 20, 30, 10, 3, "#FFFFFF", { k: 0.6, contorno: 0 })}<path d="M40 25 h18" stroke="#9AA3C7" stroke-width="2" stroke-linecap="round"/>
      ${parte("pa-balanca", 74, 18, vol("M70 18 v16 l4 -3 l4 3 v-16z", "#E0434A", { k: 0.6, contorno: 2.2 }))}
      ${brilho("M27 18 v20", 3)}<circle cx="51" cy="56" r="17" fill="#fff" opacity=".2"/>${carinha(51, 54, 0.95, h)}`,
  },
  abajur: {
    nome: "Luminária",
    svg: (v, h) => `${parte("pa-luz", 50, 70, `<path d="M28 46 L8 94 H92 L72 46Z" fill="#FFE08A" opacity=".32"/>`)}
      ${sombra(50, 20)}
      ${vol("M28 12 H72 L84 46 H16Z", "#F08A3C", { k: 2.4, contorno: 3.4 })}<path d="M22 40 H78" stroke="#C9682A" stroke-width="2"/>
      ${tubo("M50 46 V84", "#C9D3E3", { w: 3, contorno: 1.8 })}
      ${vol("M32 84 H68 Q73 84 73 91 H27 Q27 84 32 84Z", "#5C6680", { k: 1, contorno: 3.2 })}
      ${brilho("M68 18 L74 38", 3.4)}${carinha(50, 28, 0.85, h)}`,
  },
  cafe: {
    nome: "Café",
    svg: (v, h) => `${sombra(46, 26)}
      ${[[36, 26, 0], [48, 24, 0.8], [60, 26, 1.6]].map(([x, y, d]) => sobe(x, y, `<path d="M${x} ${y} q-5 -6 0 -12" stroke="#B9C2D0" stroke-width="3" fill="none" stroke-linecap="round"/>`, d)).join("")}
      ${tubo("M70 42 Q88 42 88 57 Q88 70 70 68", "#FFFFFF", { w: 4, contorno: 2.4, sombra: "#E4E9F4" })}
      ${vol("M20 32 H72 V74 Q72 90 56 90 H36 Q20 90 20 74Z", "#FFFFFF", { k: 2.4, contorno: 3.4, sombra: "#E4E9F4" })}
      <ellipse cx="46" cy="35" rx="23" ry="3.4" fill="#8A5A3B"/><path d="M34 34.6 q8 -1.6 14 0" stroke="#B07A4F" stroke-width="1.2" fill="none"/>
      <path d="M20.6 46 H71.4" stroke="#5C8DD6" stroke-width="5"/>
      ${brilho("M64 52 v18", 3.4)}${carinha(46, 64, 0.95, h)}`,
  },
  broto: {
    nome: "Plantinha",
    svg: (v, h) => `${sombra(50, 22)}
      ${tubo("M50 56 V34", "#4CAF6E", { w: 3, contorno: 2.2 })}
      ${parte("pa-folha", 50, 40, vol("M50 40 Q28 38 24 18 Q46 18 50 40Z", "#7FD6A0", { k: 1.4, contorno: 3 }))}
      ${parte("pa-folha", 50, 34, vol("M50 34 Q68 28 78 10 Q56 8 50 34Z", "#4CAF6E", { k: 1.4, contorno: 3 }), 0.7)}
      ${vol("M28 58 H72 L65 92 H35Z", "#F08A3C", { k: 2, contorno: 3.2 })}${volR(25, 54, 50, 10, 3, "#E8742A", { k: 1, contorno: 3.2 })}
      ${carinha(50, 76, 0.82, h)}`,
  },
  // ---------- gerais ----------
  escova: {
    nome: "Escova de dentes",
    svg: (v, h) => `${sombra(50, 36)}<g transform="rotate(-26 50 56)">
      ${volR(2, 44, 68, 23, 11.5, "#5C8DD6", { k: 2, contorno: 3.4 })}
      ${volR(66, 47, 28, 11, 4, "#E9EEF6", { k: 1, contorno: 3.2 })}
      ${[70, 75, 80, 85, 90].map((x, i) => tubo(`M${x} 47 v-${13 + (i % 2)}`, i % 2 ? "#FF9EC2" : "#7FD6F5", { w: 2.6, contorno: 1.4 })).join("")}
      ${bolha(74, 28, 2.2, 0)}${bolha(84, 26, 1.6, 1)}
      ${brilho("M10 49 h16", 3)}${carinha(38, 54, 0.78, h)}
    </g>`,
  },
  // ---------- Farmacologia ----------
  capsula: {
    nome: "Cápsula",
    svg: (v, h) => `${sombra(50, 30)}${parte("pa-flutua", 50, 50, `<g transform="rotate(-28 50 52)">
      ${vol("M50 30 H70 a20 20 0 0 1 0 40 H50Z", "#F2F4FA", { k: 1.6, contorno: 3.4, sombra: "#D6DCE8" })}${vol("M50 30 H30 a20 20 0 0 0 0 40 H50Z", ["#E0434A", "#5C8DD6", "#2FA37A", "#F2B33D", "#8B5CF6"][v % 5], { k: 2, contorno: 3.4 })}
      <path d="M50 30 V70" stroke="${T}" stroke-width="2.4"/>${brilho("M24 40 q4 -5 12 -6", 3)}${brilho("M66 35 h8", 2.6, 0.7)}
      ${carinha(64, 48, 0.72, h)}</g>`)}
      ${faisca(84, 22, 3.2, "#FFE08A", 0.5)}`,
  },
  xarope: {
    nome: "Xarope",
    svg: (v, h) => `${sombra(50, 24)}
      ${volR(36, 5, 28, 12, 3, "#F2F4FA", { k: 1, contorno: 3.2, sombra: "#D6DCE8" })}<path d="M40 9 v6 M46 9 v6 M52 9 v6 M58 9 v6" stroke="#C9D2DE" stroke-width="1.4"/>
      ${vol("M40 17 h20 v6 q14 4 14 18 v42 q0 7 -7 7 h-34 q-7 0 -7 -7 v-42 q0 -14 14 -18z", "#C8662A", { k: 2.4, contorno: 3.4, op: 0.95 })}
      ${volR(30, 48, 40, 28, 4, "#FFFFFF", { k: 1, contorno: 2.4, sombra: "#E4E9F4" })}<path d="M35 70 h14" stroke="#E0434A" stroke-width="2.2" stroke-linecap="round"/>
      ${brilho("M67 32 v12", 3)}${carinha(50, 58, 0.8, h)}${gota(78, 30, "#E07A3A", 0.6)}`,
  },
  receita: {
    nome: "Receituário",
    svg: (v, h) => `${sombra(50, 30)}<g transform="rotate(-6 50 52)">
      ${volR(22, 10, 56, 80, 4, "#FFFFFF", { k: 1.4, contorno: 3.4, sombra: "#E4E9F4" })}
      <text x="29" y="32" font-family="Bricolage, sans-serif" font-weight="800" font-size="16" fill="#2F6BFF">Rx</text>
      <path d="M30 70 h40 M30 77 h34 M30 84 h24" stroke="#C9D2DE" stroke-width="2.2" stroke-linecap="round"/>
      ${carinha(55, 46, 0.85, h)}</g>
      ${parte("pa-balanca", 82, 74, `${tubo("M72 88 L90 54", "#5C8DD6", { w: 4, contorno: 2.2 })}<path d="M72 88 l-2 5 l4 -2z" fill="${T}"/>`)}`,
  },
  // ---------- Periodontia (LAPERIO) ----------
  sonda: {
    nome: "Sonda periodontal",
    svg: (v, h) => `${sombra(50, 34)}<g transform="rotate(-30 50 54)">
      ${volR(4, 44, 56, 20, 9, "#C3CBD8", { k: 1.6, contorno: 3.4, luz: true })}<path d="M10 46.4 v15.2 M15 46 v16 M20 46 v16 M44 46 v16 M49 46 v16 M54 46 v16" stroke="#8F9AB5" stroke-width="1.4"/>
      ${tubo("M60 54 H78 Q86 54 88 46 L90 30", metal, { w: 3.4, contorno: 2.2 })}
      <path d="M88.9 42 l.6 -3.4 M89.6 36 l.4 -2.6" stroke="#2F6BFF" stroke-width="3.4" stroke-linecap="butt"/>
      ${carinha(32, 52, 0.7, h)}</g>${faisca(78, 14, 3, "#BFF0FF", 0.4)}`,
  },
  cureta: {
    nome: "Cureta Gracey",
    svg: (v, h) => `${sombra(50, 34)}<g transform="rotate(28 50 54)">
      ${volR(4, 46, 58, 18, 8, "#7FD6A0", { k: 1.6, contorno: 3.4 })}<path d="M9 49 l6 12 M15 49 l6 12 M43 49 l6 12 M49 49 l6 12" stroke="#4FB07A" stroke-width="1.4"/>
      ${tubo("M62 55 H76 Q84 55 86 48 Q88 40 82 38", metal, { w: 3.2, contorno: 2.2 })}
      ${parte("pa-luz", 83, 40, `<circle cx="83" cy="40" r="4.4" fill="#fff" opacity=".7"/>`)}
      ${carinha(32, 53, 0.7, h)}</g>`,
  },
  gengiva: {
    nome: "Gengiva saudável",
    svg: (v, h) => `${sombra(50, 30)}
      ${vol("M30 12 C30 4 40 2 50 6 C60 2 70 4 70 12 C72 26 66 36 64 46 L36 46 C34 36 28 26 30 12Z", "#FFFFFF", { k: 2.4, contorno: 3.4 })}
      ${vol("M14 52 Q22 36 32 42 Q41 30 50 40 Q59 30 68 42 Q78 36 86 52 V86 Q86 92 80 92 H20 Q14 92 14 86Z", "#F59AB0", { k: 2.4, contorno: 3.4 })}
      <path d="M22 66 q6 -3 12 0 M66 64 q6 -3 12 0 M40 80 q10 -3 20 0" stroke="#E07B96" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${brilho("M62 12 q4 8 2 18", 3.4)}${carinha(50, 22, 0.7, h)}${faisca(88, 22, 3.4, "#FFFFFF", 0)}${faisca(12, 30, 2.6, "#BFF0FF", 1.1)}`,
  },
  fio: {
    nome: "Fio dental",
    svg: (v, h) => `${sombra(50, 26)}
      ${parte("pa-balanca", 64, 26, `<path d="M64 26 C70 10 88 8 90 22 C92 34 80 36 78 28" fill="none" stroke="${T}" stroke-width="4.6" stroke-linecap="round"/><path d="M64 26 C70 10 88 8 90 22 C92 34 80 36 78 28" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>`)}
      ${volE(50, 58, 30, 30, "#9BE3B8", { k: 2.6, contorno: 3.4 })}${volE(50, 58, 21, 21, "#C9F2D9", { k: 1, contorno: 2.2 })}
      ${volR(58, 22, 12, 9, 2, metal, { k: 0.8, contorno: 2.4 })}
      ${brilho("M70 40 q6 8 6 18", 3.4)}${carinha(50, 56, 0.85, h)}`,
  },
  // ---------- Semiologia ----------
  termometro: {
    nome: "Termômetro",
    svg: (v, h) => `${sombra(50, 22)}<g transform="rotate(-14 50 54)">
      ${vol("M40 10 a10 10 0 0 1 20 0 V72 a10 10 0 0 1 -20 0Z", "#F2F4FA", { k: 1.6, contorno: 3.4, sombra: "#D6DCE8" })}
      ${volR(41.6, 18, 16.8, 24, 3, "#BFF0C8", { k: 0.6, contorno: 2.2 })}<text x="50" y="33" text-anchor="middle" font-family="Bricolage, sans-serif" font-weight="800" font-size="6.4" fill="#1E7A46">36,5</text>
      ${tubo("M50 76 V88", metal, { w: 3.6, contorno: 2.2 })}
      ${carinha(50, 56, 0.7, h)}</g>${parte("pa-pulsa", 74, 18, `<circle cx="74" cy="18" r="3" fill="#7FD6A0" stroke="${T}" stroke-width="1.4"/>`)}`,
  },
  lanterna: {
    nome: "Lanterna clínica",
    svg: (v, h) => `${parte("pa-luz", 70, 26, `<path d="M70 32 L98 4 L98 44Z" fill="#FFF3B0" opacity=".55"/>`)}
      ${sombra(46, 30)}<g transform="rotate(-38 50 56)">
      ${volR(14, 46, 54, 18, 8, "#5C8DD6", { k: 1.6, contorno: 3.4 })}${volR(66, 44, 12, 22, 3, metal, { k: 0.8, contorno: 3 })}
      <path d="M20 46 h2 v-6 h6 v6" fill="none" stroke="${T}" stroke-width="2.4" stroke-linejoin="round"/>
      ${carinha(40, 54, 0.72, h)}</g>`,
  },
  estetoscopio: {
    nome: "Estetoscópio",
    svg: (v, h) => `${sombra(50, 30)}
      ${parte("pa-balanca", 50, 20, `${tubo("M28 14 C24 40 40 56 50 58 C60 56 76 40 72 14", "#3A3F52", { w: 3.6, contorno: 2 })}${tubo("M50 58 V70", "#3A3F52", { w: 3.6, contorno: 2 })}${volE(28, 12, 4, 4, metal, { k: 0.6, contorno: 2 })}${volE(72, 12, 4, 4, metal, { k: 0.6, contorno: 2 })}`)}
      ${volE(50, 78, 15, 15, metal, { k: 2, contorno: 3.4, luz: true })}${volE(50, 78, 10, 10, "#E9EEF6", { k: 0.8, contorno: 2 })}
      ${carinha(50, 77, 0.6, h)}`,
  },
  prancheta: {
    nome: "Prancheta da anamnese",
    svg: (v, h) => `${sombra(50, 30)}
      ${volR(20, 12, 60, 80, 6, "#C9935F", { k: 2, contorno: 3.4 })}${volR(26, 20, 48, 66, 2, "#FFFFFF", { k: 1, contorno: 2.4, sombra: "#E4E9F4" })}
      ${volR(38, 6, 24, 12, 4, metal, { k: 0.8, contorno: 3, luz: true })}
      ${[0, 1, 2].map(i => `<rect x="31" y="${48 + i * 11}" width="6" height="6" rx="1.4" fill="#fff" stroke="${T}" stroke-width="1.6"/><path d="M41 ${51 + i * 11} h26" stroke="#C9D2DE" stroke-width="2.2" stroke-linecap="round"/>${parte("pa-pulsa", 34, 51 + i * 11, `<path d="M32 ${51 + i * 11} l2 2 l4 -5" stroke="#1E9E5E" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`, i * 0.5)}`).join("")}
      ${carinha(50, 32, 0.75, h)}`,
  },
  espelho: {
    nome: "Espelho clínico",
    svg: (v, h) => `${sombra(50, 20)}
      ${tubo("M50 56 V92", metal, { w: 6, contorno: 2.6 })}<path d="M47.6 70 h4.8 M47.6 76 h4.8 M47.6 82 h4.8" stroke="#8F9AB5" stroke-width="1.4"/>
      ${volE(50, 34, 26, 26, "#9AA3C7", { k: 2, contorno: 3.4, luz: true })}<circle cx="50" cy="34" r="20" fill="#DCEFFF" stroke="${T}" stroke-width="2.2"/>
      ${parte("pa-varre", 50, 34, `<path d="M46 16 L54 16 L42 52 L34 52Z" fill="#fff" opacity=".75"/>`)}
      ${carinha(50, 33, 0.8, h)}`,
  },
  // ---------- Xadrez (a trilha da área Xadrez) ----------
  peao: {
    nome: "Peão",
    svg: (v, h) => `${sombra(50, 26)}${base("#F4EBDD")}
      ${vol("M36 77 Q41 62 42 53 H58 Q59 62 64 77Z", "#F4EBDD", { k: 1.6, contorno: 3.4 })}
      ${volR(35, 45, 30, 9, 4.5, "#5C8DD6", { k: 1, contorno: 3.2 })}
      ${volE(50, 30, 17, 17, "#F4EBDD", { k: 2.4, contorno: 3.4 })}
      ${brilho("M60 21 q4 6 2 13", 3.4)}${carinha(50, 30, 0.82, h)}`,
  },
  torre: {
    nome: "Torre",
    svg: (v, h) => `${sombra(50, 28)}${base("#F4EBDD")}
      ${vol("M32 77 L35 44 H65 L68 77Z", "#F4EBDD", { k: 2, contorno: 3.4 })}
      ${vol("M27 45 V22 H38 V30 H45 V22 H55 V30 H62 V22 H73 V45Z", "#5C8DD6", { k: 1.6, contorno: 3.4 })}
      ${brilho("M61 50 L63 70", 3.4)}${carinha(50, 59, 0.85, h)}`,
  },
  cavalo: {
    nome: "Cavalo",
    svg: (v, h) => `${sombra(50, 28)}${base("#F4EBDD")}
      ${vol("M36 77 C34 66 38 58 46 52 C39 54 31 55 25 51 C20 46 24 38 31 34 C35 24 43 15 55 13 L59 5 L64 14 C75 20 80 37 75 53 C72 63 67 70 67 77 Z", "#F4EBDD", { k: 2.4, contorno: 3.4 })}
      ${parte("pa-cabelo", 64, 14, `<path d="M62 15 C72 23 76 37 72 52" stroke="${T}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M62 15 C72 23 76 37 72 52" stroke="#5C8DD6" stroke-width="5" fill="none" stroke-linecap="round"/>`)}
      <circle cx="28.4" cy="42.6" r="1.7" fill="${T}"/>
      ${brilho("M44 20 q-7 5 -9 12", 3)}${rostoDePerfil(h)}`,
  },
  rei: {
    nome: "Rei",
    svg: (v, h) => `${sombra(50, 28)}
      ${tubo("M50 4 V22 M42 12 H58", "#F2B33D", { w: 3.4, contorno: 2.4 })}${faisca(64, 6, 3, "#FFF3B0", 0.3)}
      ${base("#F4EBDD")}${vol("M34 77 Q39 60 40 50 H60 Q61 60 66 77Z", "#F4EBDD", { k: 1.6, contorno: 3.4 })}
      ${vol("M30 50 Q26 26 50 24 Q74 26 70 50Z", "#FFD66B", { k: 2.4, contorno: 3.4 })}
      ${volR(31, 46, 38, 8, 4, "#5C8DD6", { k: 1, contorno: 3.2 })}
      ${brilho("M63 30 q3 5 2 10", 3)}${carinha(50, 34, 0.8, h)}`,
  },
  relogio: {
    nome: "Relógio de xadrez",
    svg: (v, h) => {
      const ry = h === "uau" ? 5 : h === "sono" ? 0.8 : 4;
      return `${sombra(50, 36)}
      ${parte("pa-pulsa", 33, 30, volR(26, 26, 15, 9, 3, "#E0434A", { k: 0.8, contorno: 2.4 }))}${volR(60, 29, 15, 6, 3, "#F2B33D", { k: 0.6, contorno: 2.4 })}
      ${volR(12, 34, 76, 52, 10, "#8A5A3B", { k: 2.4, contorno: 3.4 })}
      ${brilho("M64 42 h18", 3)}
      ${volE(33, 58, 14, 14, "#FFFFFF", { k: 1.2, contorno: 3.2, sombra: "#E4E9F4" })}${volE(67, 58, 14, 14, "#FFFFFF", { k: 1.2, contorno: 3.2, sombra: "#E4E9F4" })}
      <g class="olhos"><ellipse cx="34" cy="58" rx="3.2" ry="${ry}" fill="${T}"/><ellipse cx="68" cy="58" rx="3.2" ry="${ry}" fill="${T}"/>${ry > 1 ? `<circle cx="35.2" cy="56.4" r="1.2" fill="#fff"/><circle cx="69.2" cy="56.4" r="1.2" fill="#fff"/>` : ""}</g>
      <path d="M33 47 v3 M67 47 v3" stroke="${T}" stroke-width="2.2" stroke-linecap="round"/>
      ${h === "uau" ? `<ellipse cx="50" cy="78" rx="3.4" ry="3.6" fill="${T}"/>` : `<path d="M44 76 Q50 82 56 76" stroke="${T}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`}`;
    },
  },
  tabuleiro: {
    nome: "Tabuleiro",
    svg: (v, h) => {
      let casas = "";
      for (let l = 0; l < 4; l++) for (let c = 0; c < 4; c++) if ((l + c) % 2 === 0) casas += `<rect x="${20 + c * 15}" y="${31 + l * 13}" width="15" height="13" fill="#F0D9B5"/>`;
      return `${sombra(50, 38)}<g transform="rotate(-8 50 58)">
      ${volR(14, 25, 72, 64, 8, "#B58863", { k: 2, contorno: 3.4 })}
      ${casas}
      <rect x="20" y="31" width="60" height="52" fill="none" stroke="${T}" stroke-width="2" opacity=".4"/>
      ${volE(50, 58, 16, 16, "#F7E7CC", { k: 1.2, contorno: 2.6, sombra: "#E3CDA6" })}
      ${carinha(50, 56, 0.85, h)}</g>`;
    },
  },
};

export const TEMAS = {
  anestesio: { objetos: ["seringa", "tubete", "ampola", "nervo", "escova"], cores: ["#CFE0FF", "#D9F2FF", "#E4ECFF"] },
  patologia: { objetos: ["microscopio", "lamina", "celula", "osso", "petri"], cores: ["#FFE1CC", "#FFE9D6", "#FCE3EC"] },
  noite: { objetos: ["lua", "livro", "abajur", "cafe", "broto"], cores: ["#DCD8FF", "#E6E2FF", "#D6E2FF"] },
  evento: { objetos: ["livro", "cafe", "broto", "prancheta", "escova"], cores: ["#D7F5E8", "#E4F7EF", "#DDF5EC"] },
  geral: { objetos: ["escova", "broto", "livro", "tubete", "celula"], cores: ["#E4ECFF", "#DDF5EC", "#FFF2D6"] },
  farmaco: { objetos: ["capsula", "xarope", "receita", "ampola", "livro"], cores: ["#D3F3E6", "#E2F7EE", "#E9F1FF"] },
  perio: { objetos: ["sonda", "cureta", "gengiva", "fio", "escova"], cores: ["#FFDCE5", "#FFE9EE", "#E2F5EA"] },
  semio: { objetos: ["termometro", "lanterna", "estetoscopio", "prancheta", "espelho"], cores: ["#DCEEFF", "#E2F6F3", "#F1E8FF"] },
  xadrez: { objetos: ["peao", "cavalo", "torre", "rei", "relogio", "tabuleiro"], cores: ["#E9DDFF", "#F5E6CC", "#DDEBFF"] },
};

export function objetoSVG(id, variante = 0, humor = "feliz") {
  const o = OBJETOS[id] || OBJETOS.livro;
  return `<svg viewBox="0 0 100 100" class="obj-svg obj-${id} vivo" aria-hidden="true">${o.svg(variante, humor)}</svg>`;
}

// ---------- enfeites (pontinhos que cintilam no fundo da trilha) ----------
export const ENFEITES = {
  brilho: (cor) => `<svg viewBox="0 0 20 20"><path d="M10 1 l2.2 6.8 l6.8 2.2 l-6.8 2.2 l-2.2 6.8 l-2.2 -6.8 l-6.8 -2.2 l6.8 -2.2z" fill="${cor}"/></svg>`,
  bolinha: (cor) => `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="${cor}"/><circle cx="12" cy="8" r="1.8" fill="#fff" opacity=".7"/></svg>`,
  cruz: (cor) => `<svg viewBox="0 0 20 20"><path d="M10 3 v14 M3 10 h14" stroke="${cor}" stroke-width="4" stroke-linecap="round"/></svg>`,
  anel: (cor) => `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="none" stroke="${cor}" stroke-width="3"/></svg>`,
  coracao: (cor) => `<svg viewBox="0 0 20 20"><path d="M10 17 C2 11 2 4 7 4 C9 4 10 6 10 6 C10 6 11 4 13 4 C18 4 18 11 10 17Z" fill="${cor}"/></svg>`,
  dentinho: (cor) => `<svg viewBox="0 0 20 20"><path d="M3 6 C3 2 7 2 10 4 C13 2 17 2 17 6 C17 10 15 12 14 17 C13.4 19 12 19 11.6 17 L10 13 L8.4 17 C8 19 6.6 19 6 17 C5 12 3 10 3 6Z" fill="${cor}"/></svg>`,
  estrela: (cor) => `<svg viewBox="0 0 20 20"><path d="M10 1.5 L12.4 7 L18.3 7.4 L13.8 11.3 L15.2 17.2 L10 14 L4.8 17.2 L6.2 11.3 L1.7 7.4 L7.6 7Z" fill="${cor}"/></svg>`,
};
