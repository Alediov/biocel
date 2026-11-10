// Capas desenhadas da Leitura (pedido do Alediov, 02/11/2026: "melhore os ícones dos livros na aba de Leitura").
// Cada livro tem um desenho próprio no traço da arte v2 (arte/kit.js: volume em dois tons, contorno na tinta T,
// brilho do lado da luz) e um padrão de fundo leve, sobre o degradê das cores do livro:
//   Malamed: a seringa carpule com o tubete · Andrade: cápsulas e comprimidos · Neville: o microscópio com a lâmina
//   corada · Lindhe: o dente na gengiva com a sonda milimetrada · Burket: a boca vista pela lupa · a novel: a espada e
//   a janela de sistema. As Histórias do Claude têm o céu e o "D" (capaHistoria, em telaLeitura.js) com o enfeite
//   de cada uma (`emblema`).
// Os ids (clipPath) são únicos a cada desenho (uid): a mesma capa aparece mais de uma vez na tela.
import { T, uid, vol, volE, volR, tubo, brilho, luzinha, estrela, pElipse } from "../arte/kit.js";

const METAL = "#E3E9F3", ACO = "#B9C4D8", ESCURO = "#56658A";

function seringa() {
  // desenhada deitada e girada; a gota fica fora do grupo, na ponta da agulha já girada
  const corpo = `<g transform="rotate(-36 50 52)">
    ${tubo(pElipse(13, 52, 5.5, 5.5), ACO, { w: 3.6, contorno: 2.2 })}
    ${volR(17, 49.5, 12, 5, 1.5, ACO, { contorno: 2.4, k: 2 })}
    ${volR(25.5, 39, 6, 26, 2.5, ACO, { contorno: 2.6, k: 2 })}
    ${volR(29, 43, 39, 18, 4, METAL, { luz: true, contorno: 3, k: 3 })}
    <rect x="34" y="46.5" width="29" height="11" rx="3" fill="#8FD3FA" ${`stroke="${T}" stroke-width="2"`}/>
    <rect x="34" y="46.5" width="6" height="11" rx="2" fill="#E0525B" stroke="${T}" stroke-width="2"/>
    ${brilho("M44 49.5 H58", 2.2, 0.9)}
    ${volR(68, 47, 8, 10, 2, "#7FA6D9", { contorno: 2.6, k: 2 })}
    <path d="M76 52 H96" stroke="${T}" stroke-width="3.4" stroke-linecap="round"/><path d="M76 52 H96" stroke="#E6EBF3" stroke-width="1.4" stroke-linecap="round"/>
  </g>`;
  const gota = `<path d="M86.8 28 C90.6 33.6 90.8 37.6 86.8 37.8 C82.8 37.6 83 33.6 86.8 28Z" fill="#8FD3FA" stroke="${T}" stroke-width="2" stroke-linejoin="round"/>${luzinha(88, 34.2, 1)}`;
  return corpo + gota + estrela(20, 22, 5) + estrela(80, 80, 3.6, "#fff");
}

function capsulas() {
  const metade = (x, y, w, h) => { const r = h / 2, m = x + w / 2; return `M${m} ${y}H${x + r}A${r} ${r} 0 0 0 ${x + r} ${y + h}H${m}Z`; };
  const caps = (x, y, w, h, cor, rot, cx, cy) => `<g transform="rotate(${rot} ${cx} ${cy})">
    ${volR(x, y, w, h, h / 2, "#FFF6EC", { contorno: 0, k: 3, luz: true })}
    ${vol(metade(x, y, w, h), cor, { contorno: 0, k: 3 })}
    <path d="M${x + w / 2} ${y}V${y + h}" stroke="${T}" stroke-width="2.2"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="none" stroke="${T}" stroke-width="3" />
    ${brilho(`M${x + w / 2 + 5} ${y + 5} H${x + w - h / 2}`, 2.6, 0.8)}</g>`;
  return caps(16, 36, 62, 22, "#FF8A4C", -28, 47, 47)
    + caps(52, 62, 34, 13, "#7C9CFF", 20, 69, 68.5)
    + volE(27, 76, 11, 11, "#FFFFFF", { contorno: 2.8, k: 3 }) + `<path d="M19 76 H35" stroke="${T}" stroke-width="2" stroke-linecap="round"/>`
    + volE(76, 24, 7, 7, "#7FD1AE", { contorno: 2.4, k: 2 }) + luzinha(78.5, 21.5, 1.4)
    + estrela(30, 18, 4.4) + estrela(88, 46, 3.4, "#fff");
}

function microscopio() {
  const tubo1 = `<g transform="rotate(26 46 36)">
    ${volR(39.5, 50, 9, 9, 2, ESCURO, { contorno: 2.6, k: 2 })}
    ${volR(37, 17, 14, 35, 4, METAL, { luz: true, contorno: 3, k: 3 })}
    ${volR(39, 7, 10, 11, 3, ESCURO, { contorno: 2.6, k: 2 })}
    ${brilho("M47 22 V44", 2.4, 0.85)}</g>`;
  const celula = (x, y, r, n) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFB3CF" stroke="${T}" stroke-width="2"/><circle cx="${x + r * 0.2}" cy="${y - r * 0.1}" r="${n}" fill="#7B4BB0"/>`;
  return tubo("M70 84 V66 Q70 40 52 31", "#7D8DB0", { w: 9, contorno: 2.6 })
    + volR(18, 82, 64, 10, 5, ESCURO, { contorno: 3, k: 3 })
    + volE(52, 77, 6, 3.4, "#FFE08A", { contorno: 2.2, k: 1.5 })
    + volR(24, 63, 52, 7, 3, ESCURO, { contorno: 3, k: 2.5 })
    + `<rect x="32" y="59.6" width="30" height="4" rx="1" fill="#E9F4FF" stroke="${T}" stroke-width="1.8"/><ellipse cx="47" cy="61.6" rx="5" ry="1.3" fill="#E25C9A"/>`
    + tubo1 + volE(70, 58, 5, 5, ACO, { contorno: 2.4, k: 2 })
    + celula(80, 20, 7.5, 3) + celula(90, 36, 5, 2) + celula(70, 9, 4, 1.6);
}

function denteSonda() {
  const dente = "M30 32 Q29 17 41 17 Q45.5 21 50 17.5 Q54.5 21 59 17 Q71 17 70 32 L67 54 Q65 72 59.5 86 Q55.5 90 53.6 83 L51 66 Q50 62 49 66 L46.4 83 Q44.5 90 40.5 86 Q35 72 33 54 Z";
  const gengiva = "M14 62 Q22 49 34 53 Q50 60 66 53 Q78 49 86 62 L86 94 Q50 99 14 94Z";
  let marcas = "";
  for (let i = 0; i < 4; i++) { const t = 0.18 + i * 0.13, x = 90 - 26 * t, y = 8 + 52 * t; marcas += `<path d="M${(x - 2.4).toFixed(1)} ${(y - 1.2).toFixed(1)} L${(x + 2.4).toFixed(1)} ${(y + 1.2).toFixed(1)}" stroke="${T}" stroke-width="2.4" stroke-linecap="round"/>`; }
  return vol(dente, "#FFFFFF", { contorno: 3, k: 4 }) + brilho("M58 22 Q64 22 64 30", 3, 0.9)
    + vol(gengiva, "#F27A93", { contorno: 3, k: 4 }) + brilho("M70 58 Q78 55 82 61", 2.4, 0.55)
    + tubo("M90 8 L64 60", ACO, { w: 3.2, contorno: 2 }) + marcas
    + tubo("M97 -6 L89 10", ESCURO, { w: 7, contorno: 2.4 })
    + estrela(16, 26, 4.6) + estrela(82, 34, 3, "#fff");
}

function bocaLupa() {
  const labios = "M12 46 Q28 28 41 35 Q50 30 59 35 Q72 28 88 46 Q72 74 50 76 Q28 74 12 46Z";
  const dentro = "M21 47 Q50 39 79 47 Q67 64 50 65.5 Q33 64 21 47Z";
  const lente = uid("lt");
  return vol(labios, "#E8566F", { contorno: 3, k: 4 })
    + `<path d="${dentro}" fill="#6B1E36" stroke="${T}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<path d="M25 47 Q50 40.5 75 47 L73 51 Q50 45.5 27 51Z" fill="#fff" stroke="${T}" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<ellipse cx="50" cy="59" rx="13" ry="5" fill="#FF8FA3"/>`
    + brilho("M62 34.5 Q72 33 79 39", 2.6, 0.7)
    + tubo("M80 80 L93 93", ESCURO, { w: 7, contorno: 2.4 })
    + `<clipPath id="${lente}"><circle cx="68" cy="66" r="14"/></clipPath><g clip-path="url(#${lente})"><rect x="50" y="48" width="36" height="36" fill="#fff" opacity=".28"/><circle cx="70" cy="62" r="3.2" fill="#F6F0C8" stroke="${T}" stroke-width="1.4"/></g>`
    + tubo(pElipse(68, 66, 14, 14), "#E2A33B", { w: 4.6, contorno: 2.4 })
    + brilho("M60 58 Q63 54 68 54", 2.6, 0.9)
    + estrela(20, 22, 4.6) + estrela(86, 18, 3.4, "#fff");
}

function espadaJanela() {
  const janela = `<rect x="10" y="16" width="60" height="44" rx="7" fill="#26306E" fill-opacity=".92" stroke="#9DB4FF" stroke-width="2.6"/>
    <path d="M10 27 H70" stroke="#9DB4FF" stroke-width="2"/><circle cx="17" cy="21.6" r="1.8" fill="#9DB4FF"/>
    <path d="M18 36 H48 M18 44 H56 M18 52 H40" stroke="#C9D6FF" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <circle cx="60" cy="46" r="6" fill="#E2A33B" stroke="${T}" stroke-width="1.8"/><path d="M60 42.6 V46.4" stroke="${T}" stroke-width="2" stroke-linecap="round"/><circle cx="60" cy="49" r="1.1" fill="${T}"/>`;
  const espada = `<g transform="rotate(28 64 60)">
    ${vol("M60.5 6 L67.5 6 L67.5 66 L64 73 L60.5 66Z", METAL, { luz: true, contorno: 3, k: 3 })}
    ${brilho("M65.6 12 V60", 1.8, 0.95)}
    ${volR(51, 69, 26, 7, 3.5, "#E2A33B", { contorno: 3, k: 2 })}
    ${volR(60.5, 75.5, 7, 15, 2.5, "#5B3A8C", { contorno: 2.6, k: 2 })}
    ${volE(64, 94, 4.4, 4.4, "#E2A33B", { contorno: 2.4, k: 1.6 })}</g>`;
  return janela + espada + estrela(86, 20, 5, "#C9D6FF") + estrela(22, 76, 4) + estrela(88, 74, 3, "#fff");
}

const ARTE = { malamed: seringa, andrade: capsulas, neville: microscopio, lindhe: denteSonda, burket: bocaLupa, hunter: espadaJanela };

// padrões de fundo (bem leves): pontos, cruzes, células, ondas, círculos, linhas de velocidade
function padrao(chave) {
  const p = [];
  const cor = `fill="#fff"`;
  if (chave === "malamed") for (let y = 8; y < 150; y += 14) for (let x = (y / 14) % 2 ? 6 : 13; x < 100; x += 14) p.push(`<circle cx="${x}" cy="${y}" r="1.3" ${cor}/>`);
  else if (chave === "andrade") for (let y = 10; y < 150; y += 18) for (let x = (y / 18) % 2 ? 8 : 17; x < 100; x += 18) p.push(`<path d="M${x - 2.6} ${y}H${x + 2.6}M${x} ${y - 2.6}V${y + 2.6}" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>`);
  else if (chave === "neville") for (let y = 6; y < 150; y += 16) for (let x = (y / 16) % 2 ? 4 : 12; x < 100; x += 16) p.push(`<circle cx="${x}" cy="${y}" r="5.4" fill="none" stroke="#fff" stroke-width="1"/><circle cx="${x + 1}" cy="${y}" r="1.6" ${cor}/>`);
  else if (chave === "lindhe") for (let y = 10; y < 150; y += 13) p.push(`<path d="M-4 ${y} q8 -5 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#fff" stroke-width="1.1"/>`);
  else if (chave === "burket") for (const [x, y] of [[88, 18], [10, 128], [92, 132]]) for (let r = 6; r < 40; r += 7) p.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="1"/>`);
  else if (chave === "hunter") for (let i = 0; i < 9; i++) p.push(`<path d="M${-20 + i * 16} 150 L${30 + i * 16} 0" stroke="#fff" stroke-width="${i % 3 ? 0.8 : 1.6}"/>`);
  return p.length ? `<svg class="le-capa-padrao" viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${p.join("")}</svg>` : "";
}

/** O desenho da capa (SVG) e o padrão de fundo de um livro ou novel; "" se não houver desenho próprio. */
export function arteDaCapa(chave) {
  const f = ARTE[chave];
  if (!f) return { arte: "", fundo: "" };
  return { arte: `<svg class="le-capa-arte" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="52" r="44" fill="#fff" opacity=".1"/>${f()}</svg>`, fundo: padrao(chave) };
}

/** Os enfeites do céu das Histórias do Claude, por história (`emblema`): "lua" (entreter) ou "lupa" (ensinar). */
export function ceuDaHistoria(emblema) {
  if (emblema === "lupa") {
    // cruzes no lugar das estrelas e o traçado de um batimento embaixo; a lupa em volta do "D" é do CSS (.emb-lupa
    // .le-hist-d), para acompanhar a letra em qualquer tamanho de capa
    const cruzes = [[12, 30, 3], [88, 26, 2.4], [91, 60, 2], [9, 64, 2.2], [89, 92, 2.6], [11, 96, 2]];
    return cruzes.map(([x, y, r]) => `<path class="cruz" d="M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}"/>`).join("")
      + `<path class="ecg" d="M0 116 H30 L34 111 L38 122 L43 106 L48 128 L52 116 H100"/>`;
  }
  const estrelas = [[14, 18, 1.1], [30, 9, .7], [52, 22, .9], [80, 12, 1.2], [90, 34, .7], [9, 44, .8], [70, 46, .6], [22, 70, .7], [86, 74, 1], [12, 104, .9], [93, 112, .7], [40, 128, .6]];
  return estrelas.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")
    + `<path class="lua" d="M80 38a8 8 0 1 0 7 11.5 6.2 6.2 0 1 1-7-11.5z"/>`
    + `<ellipse class="anel" cx="50" cy="78" rx="38" ry="11" transform="rotate(-14 50 78)"/>`;
}
