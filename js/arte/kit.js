// Kit de desenho do Órbita (guia de estilo v2, docs/guia-de-estilo.md; pedido do Alediov, 26/10/2026: "atualize o
// gráfico de todas as cartas, plantas e demais personagens ou decorações… deixe tudo perfeito… adicione animações").
// O que todos os desenhos repetem mora aqui:
// - a tinta (#1B2340) e os traços;
// - o VOLUME em dois tons: o corpo pintado com a cor de sombra e, por cima, a cor base deslocada para cima e para a
//   direita (de onde vem a luz), recortada pelo próprio corpo: sobra uma meia-lua de sombra embaixo à esquerda, chapada,
//   sem degradê (como nos desenhos do Duolingo); `vol`, `volE`, `volR`;
// - o brilho (traço branco largo) e o pontinho de luz;
// - os rostos (olhos com dois brilhos, sobrancelhas que mudam com o humor, boca com língua; sem bochechas rosadas);
// - as partes animadas (`parte`): grupos com o eixo no lugar certo, que o CSS (arte.css) mexe quando o desenho está
//   `.vivo`: orelhas, caudas, asas, nadadeiras, tentáculos, faíscas, bolhas…
// Os ids (clipPath) são únicos por desenho (`uid`): o mesmo personagem aparece várias vezes na mesma tela.

export const T = "#1B2340";
let seq = 0;
/** Um id único por desenho. */
export const uid = (p = "k") => `${p}${(++seq).toString(36)}`;
export const traco = (w = 3.5, cor = T) => `stroke="${cor}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
export const S = traco(3.5), S3 = traco(3), S2 = traco(2.4), S1 = traco(1.6);
const f2 = (n) => +(+n).toFixed(2);

// ---------------------------------------------------------------- cores
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const ehHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
/** A cor da sombra: a cor "multiplicada" por um azul-lilás claro (sombra fria, como nos desenhos animados). */
export function sombraDe(cor, f = 1) {
  if (!ehHex(cor)) return "rgba(27,35,64,.18)";
  const tinta = [0.8, 0.83, 0.95].map(v => 1 - (1 - v) * f);
  return "#" + hexRgb(cor).map((v, i) => Math.round(v * tinta[i]).toString(16).padStart(2, "0")).join("");
}
/** A cor de luz: a cor "clareada" por um branco morno. */
export function luzDe(cor, f = 1) {
  if (!ehHex(cor)) return "rgba(255,255,255,.35)";
  const m = [0.38, 0.36, 0.28].map(v => v * f);
  return "#" + hexRgb(cor).map((v, i) => Math.round(255 - (255 - v) * (1 - m[i])).toString(16).padStart(2, "0")).join("");
}
/** Mistura duas cores (t = 0: a, t = 1: b). */
export function mistura(a, b, t = 0.5) {
  if (!ehHex(a) || !ehHex(b)) return a;
  const x = hexRgb(a), y = hexRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- formas com volume
export const pElipse = (cx, cy, rx, ry = rx) => `M${f2(cx - rx)} ${f2(cy)}a${f2(rx)} ${f2(ry)} 0 1 0 ${f2(2 * rx)} 0a${f2(rx)} ${f2(ry)} 0 1 0 ${f2(-2 * rx)} 0Z`;
export const pRet = (x, y, w, h, r = 0) => {
  r = Math.min(r, w / 2, h / 2);
  return r ? `M${f2(x + r)} ${f2(y)}H${f2(x + w - r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + w)} ${f2(y + r)}V${f2(y + h - r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + w - r)} ${f2(y + h)}H${f2(x + r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x)} ${f2(y + h - r)}V${f2(y + r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x + r)} ${f2(y)}Z`
    : `M${f2(x)} ${f2(y)}H${f2(x + w)}V${f2(y + h)}H${f2(x)}Z`;
};
/**
 * Um corpo com volume: sombra chapada embaixo à esquerda (a base deslocada `k` na direção da luz, `ang` graus) e o
 * contorno. `sombra`: outra cor de sombra; `contorno`: espessura (0 = sem); `extra`: atributos do contorno;
 * `luz`: uma segunda camada mais clara (meia-lua em cima à direita, para metais, vidros e frutas).
 */
export function vol(d, cor, { k = 5, ang = 40, sombra = null, contorno = 3.5, extra = "", luz = null, op = null, classe = "" } = {}) {
  const id = uid("v"), sb = sombra || sombraDe(cor);
  const dx = f2(k * Math.cos((ang * Math.PI) / 180)), dy = f2(-k * Math.sin((ang * Math.PI) / 180));
  const opa = op != null ? ` fill-opacity="${op}"` : "";
  if (!ehHex(cor) && !sombra) {
    // cor em degradê (url(#…)): a base inteira e, por cima, a meia-lua de sombra translúcida (máscara)
    return `<g${classe ? ` class="${classe}"` : ""}><path d="${d}" fill="${cor}"${opa}/><mask id="${id}"><path d="${d}" fill="#fff"/><path d="${d}" fill="#000" transform="translate(${dx} ${dy})"/></mask><path d="${d}" fill="rgba(27,35,64,.2)" mask="url(#${id})"/>${contorno ? `<path d="${d}" fill="none" ${traco(contorno)} ${extra}/>` : ""}</g>`;
  }
  const camadaLuz = luz ? `<path d="${d}" fill="${luz === true ? luzDe(cor) : luz}" transform="translate(${f2(dx * 1.9)} ${f2(dy * 1.9)})"${opa}/><path d="${d}" fill="${cor}" transform="translate(${f2(dx * 0.35)} ${f2(dy * 0.35)})"${opa}/>` : "";
  return `<g${classe ? ` class="${classe}"` : ""}><clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${sb}"${opa}/><g clip-path="url(#${id})">${luz ? `<path d="${d}" fill="${cor}" transform="translate(${dx} ${dy})"${opa}/>${camadaLuz}` : `<path d="${d}" fill="${cor}" transform="translate(${dx} ${dy})"${opa}/>`}</g>${contorno ? `<path d="${d}" fill="none" ${traco(contorno)} ${extra}/>` : ""}</g>`;
}
/**
 * Várias formas que viram uma só (nuvem, cabelo cacheado, copa de árvore, espuma): o contorno só por fora (desenhado
 * por baixo, com o dobro da espessura) e o volume recortado pela união. `d`: os caminhos juntos, todos no mesmo sentido.
 */
export function volU(d, cor, { k = 5, ang = 40, sombra = null, contorno = 3.5, op = null, classe = "" } = {}) {
  const id = uid("u"), sb = sombra || sombraDe(cor);
  const dx = f2(k * Math.cos((ang * Math.PI) / 180)), dy = f2(-k * Math.sin((ang * Math.PI) / 180));
  const opa = op != null ? ` fill-opacity="${op}"` : "";
  const fora = contorno ? `<path d="${d}" fill="${T}" stroke="${T}" stroke-width="${f2(contorno * 2)}" stroke-linejoin="round"/>` : "";
  if (!ehHex(cor) && !sombra) return `<g${classe ? ` class="${classe}"` : ""}>${fora}<path d="${d}" fill="${cor}"/><mask id="${id}"><path d="${d}" fill="#fff"/><path d="${d}" fill="#000" transform="translate(${dx} ${dy})"/></mask><path d="${d}" fill="rgba(27,35,64,.2)" mask="url(#${id})"/></g>`;
  return `<g${classe ? ` class="${classe}"` : ""}>${fora}<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${sb}"${opa}/><g clip-path="url(#${id})"><path d="${d}" fill="${cor}" transform="translate(${dx} ${dy})"${opa}/></g></g>`;
}
/** Círculos (cx, cy, r) num caminho só, para `volU`. */
export const circulos = (lista) => lista.map(([x, y, r, ry]) => pElipse(x, y, r, ry ?? r)).join("");
export const volE = (cx, cy, rx, ry, cor, o = {}) => vol(pElipse(cx, cy, rx, ry), cor, o);
export const volR = (x, y, w, h, r, cor, o = {}) => vol(pRet(x, y, w, h, r), cor, o);
// ---------------------------------------------------------------- luz e chão
/** O brilho: traço branco largo (em cima à direita, do lado da luz). */
export const brilho = (d, w = 5, op = 0.85) => `<path d="${d}" stroke="#fff" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${op}"/>`;
/** Pontinho de luz. */
export const luzinha = (x, y, r = 2.4, op = 0.95) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${op}"/>`;
/** Sombra no chão. */
export const chao = (cx, cy, rx, ry = 4, op = 0.13) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${T}" opacity="${op}"/>`;

// ---------------------------------------------------------------- enfeites
export const estrela = (x, y, r = 5, cor = "#FFE08A", classe = "") => `<path${classe ? ` class="${classe}" style="transform-origin:${x}px ${y}px"` : ""} d="M${x} ${f2(y - r)}L${f2(x + r * 0.3)} ${f2(y - r * 0.3)}L${f2(x + r)} ${y}L${f2(x + r * 0.3)} ${f2(y + r * 0.3)}L${x} ${f2(y + r)}L${f2(x - r * 0.3)} ${f2(y + r * 0.3)}L${f2(x - r)} ${y}L${f2(x - r * 0.3)} ${f2(y - r * 0.3)}Z" fill="${cor}"/>`;
/** Faísca que pisca (classe pa-faisca: só anima quando o desenho está vivo). `atraso` em segundos. */
export const faisca = (x, y, r = 5, cor = "#FFE08A", atraso = 0) => `<g class="pa pa-faisca" style="transform-origin:${x}px ${y}px;--pd:${atraso}s">${estrela(x, y, r, cor)}</g>`;
/** Estrela de cinco pontas com contorno. */
export function estrela5(cx, cy, r, cor, { contorno = 2, interno = 0.45 } = {}) {
  let d = "";
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * interno : r; d += `${i ? "L" : "M"}${f2(cx + Math.cos(a) * rr)} ${f2(cy + Math.sin(a) * rr)}`; }
  return `<path d="${d}Z" fill="${cor}" ${contorno ? traco(contorno) : ""}/>`;
}
/** Bolhas que sobem (pa-bolha). */
export const bolha = (x, y, r = 2.4, atraso = 0, cor = "#fff") => `<circle class="pa pa-bolha" cx="${x}" cy="${y}" r="${r}" fill="${cor}" opacity=".85" style="transform-origin:${x}px ${y}px;--pd:${atraso}s"/>`;

/**
 * Bracinho "de massinha" (o mesmo dos dentes): contorno grosso e recheio na cor do corpo, com o ombro como eixo
 * (classes .ch-braco.esq/.dir: acenam, comemoram e murcham com as reações). lado: -1 esquerdo, 1 direito.
 */
export function braco(x, y, lado, cor, { dx = 11, dy = 16, curva = 9, w = 10 } = {}) {
  const d = `M${x} ${y} q${lado * curva} ${f2(dy * 0.31)} ${lado * dx} ${dy}`;
  return `<g class="ch-braco ${lado < 0 ? "esq" : "dir"}" style="transform-origin:${x}px ${y}px"><path d="${d}" stroke="${T}" stroke-width="${w}" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${lado < 0 ? sombraDe(cor) : cor}" stroke-width="${f2(w * 0.44)}" stroke-linecap="round" fill="none"/><circle cx="${x + lado * dx}" cy="${y + dy}" r="1.3" fill="#fff" opacity="${lado < 0 ? 0.5 : 0.9}"/></g>`;
}

/**
 * Um tubo com volume (tentáculo, tromba, caule, fio, alça): contorno, sombra e a cor base mais fina, puxada para o
 * lado da luz. `w`: largura por dentro do contorno.
 */
export function tubo(d, cor, { w = 8, contorno = 2.6, sombra = null, ang = 40, fill = "none" } = {}) {
  const k = w * 0.16, dx = f2(k * Math.cos((ang * Math.PI) / 180)), dy = f2(-k * Math.sin((ang * Math.PI) / 180));
  return `<path d="${d}" fill="${fill}" stroke="${T}" stroke-width="${f2(w + 2 * contorno)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${sombra || sombraDe(cor)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${cor}" stroke-width="${f2(w * 0.66)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${dx} ${dy})"/>`;
}

/** Uma parte animável: o CSS (arte.css) mexe nas classes pa-* com o eixo em (ox, oy). `atraso` em segundos. */
export const parte = (classe, ox, oy, conteudo, atraso = 0) => `<g class="pa ${classe}" style="transform-origin:${f2(ox)}px ${f2(oy)}px${atraso ? `;--pd:${atraso}s` : ""}">${conteudo}</g>`;

// ---------------------------------------------------------------- rostos
/**
 * Carinha pequena (plantas e objetos do cenário), no traço novo: olhos com dois brilhos, boca com língua.
 * humor: feliz | uau | neutro | sono | sede | triste | piscando. `k`: escala (1 ≈ olhos de 5,8 × 7,6).
 */
export function carinha(cx, cy, k = 1, humor = "feliz") {
  const dx = 7 * k, q = (n) => f2(n * k);
  let olhos, boca;
  const aberto = (x, ry) => `<ellipse cx="${f2(x)}" cy="${cy}" rx="${q(2.9)}" ry="${f2(ry)}" fill="${T}"/><circle cx="${f2(x + 1.1 * k)}" cy="${f2(cy - 1.5 * k)}" r="${q(1.15)}" fill="#fff"/><circle cx="${f2(x - 0.9 * k)}" cy="${f2(cy + 1.5 * k)}" r="${q(0.55)}" fill="#fff" opacity=".85"/>`;
  if (humor === "sede" || humor === "triste") {
    olhos = [cx - dx, cx + dx].map((x, i) => `<path d="M${f2(x - 3 * k)} ${f2(cy + (i ? -0.6 : 0.6) * k)} L${f2(x + 3 * k)} ${f2(cy + (i ? 0.6 : -0.6) * k)}" stroke="${T}" stroke-width="${q(1.6)}" stroke-linecap="round"/><path d="M${f2(x - 2.6 * k)} ${f2(cy + 0.4 * k)} a${q(2.6)} ${q(2.6)} 0 0 0 ${q(5.2)} 0" fill="${T}"/>`).join("");
    boca = `<path d="M${f2(cx - 4 * k)} ${f2(cy + 9 * k)} Q${cx} ${f2(cy + 5.4 * k)} ${f2(cx + 4 * k)} ${f2(cy + 9 * k)}" stroke="${T}" stroke-width="${q(2)}" fill="none" stroke-linecap="round"/><path d="M${f2(cx + dx + 3.4 * k)} ${f2(cy + 1.6 * k)} q${q(1.7)} ${q(3)} 0 ${q(4.4)} q${q(-1.7)} ${q(-1.4)} 0 ${q(-4.4)}z" fill="#8FD3FA" stroke="${T}" stroke-width="${q(0.7)}"/>`;
  } else if (humor === "sono") {
    olhos = `<path d="M${f2(cx - dx - 3 * k)} ${cy} q${q(3)} ${q(2.6)} ${q(6)} 0 M${f2(cx + dx - 3 * k)} ${cy} q${q(3)} ${q(2.6)} ${q(6)} 0" stroke="${T}" stroke-width="${q(2.3)}" fill="none" stroke-linecap="round"/>`;
    boca = `<ellipse cx="${cx}" cy="${f2(cy + 7 * k)}" rx="${q(2)}" ry="${q(1.6)}" fill="${T}"/>`;
  } else if (humor === "piscando") {
    olhos = aberto(cx - dx, 3.8 * k) + `<path d="M${f2(cx + dx - 3 * k)} ${f2(cy + 1 * k)} q${q(3)} ${q(-3)} ${q(6)} 0" stroke="${T}" stroke-width="${q(2.3)}" fill="none" stroke-linecap="round"/>`;
    boca = `<path d="M${f2(cx - 5 * k)} ${f2(cy + 5 * k)} Q${cx} ${f2(cy + 12 * k)} ${f2(cx + 5 * k)} ${f2(cy + 5 * k)} Z" fill="${T}"/><path d="M${f2(cx - 2.6 * k)} ${f2(cy + 8.6 * k)} Q${cx} ${f2(cy + 10.6 * k)} ${f2(cx + 2.6 * k)} ${f2(cy + 8.6 * k)} Q${cx} ${f2(cy + 7.4 * k)} ${f2(cx - 2.6 * k)} ${f2(cy + 8.6 * k)}Z" fill="#FF8FA3"/>`;
  } else {
    const ry = (humor === "uau" ? 4.4 : 3.8) * k;
    olhos = aberto(cx - dx, ry) + aberto(cx + dx, ry);
    boca = humor === "uau"
      ? `<ellipse cx="${cx}" cy="${f2(cy + 7.4 * k)}" rx="${q(3)}" ry="${q(3.8)}" fill="${T}"/><ellipse cx="${cx}" cy="${f2(cy + 9.4 * k)}" rx="${q(1.8)}" ry="${q(1.2)}" fill="#FF8FA3"/>`
      : humor === "neutro" ? `<path d="M${f2(cx - 3.6 * k)} ${f2(cy + 7 * k)} Q${cx} ${f2(cy + 8.6 * k)} ${f2(cx + 3.6 * k)} ${f2(cy + 7 * k)}" stroke="${T}" stroke-width="${q(2)}" fill="none" stroke-linecap="round"/>`
      : `<path d="M${f2(cx - 5 * k)} ${f2(cy + 5 * k)} Q${cx} ${f2(cy + 12 * k)} ${f2(cx + 5 * k)} ${f2(cy + 5 * k)} Z" fill="${T}"/><path d="M${f2(cx - 2.6 * k)} ${f2(cy + 8.6 * k)} Q${cx} ${f2(cy + 10.6 * k)} ${f2(cx + 2.6 * k)} ${f2(cy + 8.6 * k)} Q${cx} ${f2(cy + 7.4 * k)} ${f2(cx - 2.6 * k)} ${f2(cy + 8.6 * k)}Z" fill="#FF8FA3"/>`;
  }
  return `<g class="olhos">${olhos}</g>${boca}`;
}
/**
 * Olhos e boca no traço novo. humor: feliz | triste | uau | neutro | sono | sede | bravo | piscando.
 * `k`: escala (1 = os olhos dos dentes, 5,6 × 7,2); `dx`: meia distância entre os olhos; `y`: altura dos olhos;
 * `iris`: cor da íris (pessoas); `cilios`; `sobrancelhas` (padrão: só quando o humor pede); `boca`: "sorriso" (padrão),
 * "dentes" (sorriso com os dentinhos de cima), "fechada", "sem".
 */
export function rosto(humor = "feliz", { cx = 60, y = 52, dx = 14, k = 1, cor = T, iris = null, cilios = false, sobrancelhas = null, boca = "sorriso", lingua = "#FF8FA3", by = null } = {}) {
  const L = cx - dx, R = cx + dx, q = (n) => f2(n * k);
  let o = "";
  const aberto = (x, grande) => {
    const rx = q(grande ? 6.3 : 5.6), ry = q(grande ? 8.2 : 7.2);
    let s = `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${cor}"/>`;
    if (iris) s += `<ellipse cx="${x}" cy="${f2(y + q(0.9))}" rx="${f2(rx * 0.66)}" ry="${f2(ry * 0.64)}" fill="${iris}"/><ellipse cx="${x}" cy="${f2(y + q(1.2))}" rx="${f2(rx * 0.34)}" ry="${f2(ry * 0.36)}" fill="${cor}"/>`;
    return s + `<circle cx="${f2(x + q(2))}" cy="${f2(y - q(2.7))}" r="${q(2.25)}" fill="#fff"/><circle cx="${f2(x - q(1.8))}" cy="${f2(y + q(3))}" r="${q(1.05)}" fill="#fff" opacity=".85"/>`;
  };
  const arco = (x, para) => `<path d="M${f2(x - q(6))} ${f2(y + (para === "baixo" ? 0 : q(1.5)))}q${q(6)} ${q(para === "baixo" ? 5.5 : -5.5)} ${q(12)} 0" stroke="${cor}" stroke-width="${q(3.4)}" fill="none" stroke-linecap="round"/>`;
  const h = humor;
  if (h === "triste" || h === "sede") {
    // olhos abertos com a pálpebra caída (mais baixa do lado de fora) e uma lágrima
    o = [L, R].map((x, i) => {
      const c = uid("p"), fora = i ? 1 : -1, yc = f2(y + q(1)), ya = f2(y - q(2.2)), yb2 = f2(y - q(0.2));
      const lid = `M${f2(x - q(7))} ${fora < 0 ? yb2 : ya}L${f2(x + q(7))} ${fora < 0 ? ya : yb2}`;
      return `<clipPath id="${c}"><path d="${lid}L${f2(x + q(7))} ${f2(y + q(10))}L${f2(x - q(7))} ${f2(y + q(10))}Z"/></clipPath><g clip-path="url(#${c})"><ellipse cx="${x}" cy="${yc}" rx="${q(5)}" ry="${q(6)}" fill="${cor}"/><circle cx="${f2(x + q(1.6))}" cy="${f2(y + q(0.6))}" r="${q(1.5)}" fill="#fff"/></g><path d="${lid}" stroke="${cor}" stroke-width="${q(2.6)}" stroke-linecap="round"/>`;
    }).join("");
    o += `<path d="M${f2(R + q(5.5))} ${f2(y + q(5.5))}q${q(2.8)} ${q(4.6)} 0 ${q(7.4)}q${q(-2.8)} ${q(-2.8)} 0 ${q(-7.4)}Z" fill="#8FD3FA" stroke="${cor}" stroke-width="${q(1.2)}"/><circle cx="${f2(R + q(5))}" cy="${f2(y + q(10.4))}" r="${q(0.9)}" fill="#fff"/>`;
  } else if (h === "sono") o = arco(L, "baixo") + arco(R, "baixo");
  else if (h === "piscando") o = aberto(L, false) + arco(R, "cima");
  else o = aberto(L, h === "uau") + aberto(R, h === "uau");
  if (cilios && !["sono", "piscando"].includes(h)) o += `<path d="M${f2(L - q(5.5))} ${f2(y - q(4.5))}l${q(-4)} ${q(-3)}M${f2(L - q(6.2))} ${f2(y - q(0.8))}l${q(-4.2)} ${q(-1)}M${f2(R + q(5.5))} ${f2(y - q(4.5))}l${q(4)} ${q(-3)}M${f2(R + q(6.2))} ${f2(y - q(0.8))}l${q(4.2)} ${q(-1)}" stroke="${cor}" stroke-width="${q(2)}" stroke-linecap="round"/>`;
  // sobrancelhas: só quando ajudam a ler o humor
  const sob = sobrancelhas ?? ["triste", "sede", "uau", "bravo"].includes(h);
  let s = "";
  if (sob) {
    const yb = y - q(11.5);
    if (h === "triste" || h === "sede") s = `<path d="M${f2(L - q(6))} ${f2(yb + q(2.5))}L${f2(L + q(5))} ${f2(yb - q(0.5))}M${f2(R + q(6))} ${f2(yb + q(2.5))}L${f2(R - q(5))} ${f2(yb - q(0.5))}" stroke="${cor}" stroke-width="${q(2.6)}" stroke-linecap="round"/>`;
    else if (h === "uau") s = `<path d="M${f2(L - q(5.5))} ${f2(yb)}q${q(5.5)} ${q(-4.5)} ${q(11)} 0M${f2(R - q(5.5))} ${f2(yb)}q${q(5.5)} ${q(-4.5)} ${q(11)} 0" stroke="${cor}" stroke-width="${q(2.6)}" fill="none" stroke-linecap="round"/>`;
    else if (h === "bravo") s = `<path d="M${f2(L - q(6.5))} ${f2(yb - q(1.5))}L${f2(L + q(5.5))} ${f2(yb + q(3))}M${f2(R + q(6.5))} ${f2(yb - q(1.5))}L${f2(R - q(5.5))} ${f2(yb + q(3))}" stroke="${cor}" stroke-width="${q(3.2)}" stroke-linecap="round"/>`;
    else s = `<path d="M${f2(L - q(5))} ${f2(yb + q(0.5))}q${q(5)} ${q(-2.4)} ${q(10)} 0M${f2(R - q(5))} ${f2(yb + q(0.5))}q${q(5)} ${q(-2.4)} ${q(10)} 0" stroke="${cor}" stroke-width="${q(2.4)}" fill="none" stroke-linecap="round"/>`;
  }
  // boca
  const b = by != null ? by : y + q(14);
  let m = "";
  if (boca !== "sem") {
    if (h === "triste" || h === "sede") m = `<path d="M${f2(cx - q(8.5))} ${f2(b + q(7))}Q${cx} ${f2(b - q(1.5))} ${f2(cx + q(8.5))} ${f2(b + q(7))}" fill="none" stroke="${cor}" stroke-width="${q(3.3)}" stroke-linecap="round"/>`;
    else if (h === "uau") m = `<ellipse cx="${cx}" cy="${f2(b + q(4.5))}" rx="${q(6)}" ry="${q(7.4)}" fill="${cor}"/><ellipse cx="${cx}" cy="${f2(b + q(8))}" rx="${q(3.6)}" ry="${q(2.6)}" fill="${lingua}"/>`;
    else if (h === "sono") m = `<ellipse cx="${cx}" cy="${f2(b + q(4))}" rx="${q(3)}" ry="${q(2.4)}" fill="${cor}"/>`;
    else if (h === "neutro" || boca === "fechada") m = `<path d="M${f2(cx - q(8))} ${f2(b + q(3))}Q${cx} ${f2(b + q(6.5))} ${f2(cx + q(8))} ${f2(b + q(3))}" fill="none" stroke="${cor}" stroke-width="${q(3.3)}" stroke-linecap="round"/>`;
    else if (h === "bravo") m = `<path d="M${f2(cx - q(8))} ${f2(b + q(6))}Q${cx} ${f2(b + q(1))} ${f2(cx + q(8))} ${f2(b + q(6))}Z" fill="${cor}"/>`;
    else {
      m = `<path d="M${f2(cx - q(11))} ${f2(b - q(1))}Q${cx} ${f2(b + q(16))} ${f2(cx + q(11))} ${f2(b - q(1))}Z" fill="${cor}"/><path d="M${f2(cx - q(6.4))} ${f2(b + q(6.6))}Q${cx} ${f2(b + q(12))} ${f2(cx + q(6.4))} ${f2(b + q(6.6))}Q${cx} ${f2(b + q(3.6))} ${f2(cx - q(6.4))} ${f2(b + q(6.6))}Z" fill="${lingua}"/>`;
      if (boca === "dentes") m += `<path d="M${f2(cx - q(8.6))} ${f2(b + q(0.2))}Q${cx} ${f2(b + q(2.6))} ${f2(cx + q(8.6))} ${f2(b + q(0.2))}L${f2(cx + q(7.6))} ${f2(b + q(2.8))}Q${cx} ${f2(b + q(5))} ${f2(cx - q(7.6))} ${f2(b + q(2.8))}Z" fill="#fff"/>`;
    }
  }
  return `<g class="olhos">${o}</g>${s}${m}`;
}
