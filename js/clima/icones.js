// Ícones do tempo do Clima (desenhados à mão, viewBox 64×64): sol, lua, parcial, parcial-noite, nublado, neblina, garoa,
// chuva, chuva-forte, tempestade e neve. Animados por SMIL dentro do próprio SVG (servem na Home, no Clima e nos widgets,
// sem depender de CSS); com `animado: false` (reduzir movimento, widgets) ficam parados. As nuvens têm contorno, para
// não sumirem no papel de parede claro (widget transparente).
let n = 0;
const NUVEM = "M21 47H45A8 8 0 0 0 46.5 31.2A12 12 0 0 0 24 27.5A9.5 9.5 0 0 0 21 47Z";

export function svgTempo(tipo, { animado = true, classe = "" } = {}) {
  const k = `tp${++n}`, a = animado;
  const defs = `<defs>
    <radialGradient id="s${k}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".55" stop-color="#FFC93C"/><stop offset="1" stop-color="#FF9F1C"/></radialGradient>
    <linearGradient id="n${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE5F2"/></linearGradient>
    <linearGradient id="e${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9AA8C2"/><stop offset="1" stop-color="#6B7A99"/></linearGradient>
    <linearGradient id="l${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFBEA"/><stop offset="1" stop-color="#D9DDF5"/></linearGradient>
  </defs>`;
  const girar = (dur, cx = 32, cy = 32) => a ? `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>` : "";
  const boiar = (dx, dur, atraso = 0) => a ? `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} 0;0 0" dur="${dur}s" begin="-${atraso}s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>` : "";
  const sol = (cx, cy, r, raio1, raio2) => `<g>${girar(30, cx, cy)}${Array.from({ length: 8 }, (_, i) => {
    const t = (i * Math.PI) / 4, x1 = cx + Math.cos(t) * raio1, y1 = cy + Math.sin(t) * raio1, x2 = cx + Math.cos(t) * raio2, y2 = cy + Math.sin(t) * raio2;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#FFB627" stroke-width="3.2" stroke-linecap="round"/>`; }).join("")}</g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#s${k})" stroke="#F29B0C" stroke-width="1.2"/>
    <ellipse cx="${cx - r * .35}" cy="${cy - r * .4}" rx="${r * .32}" ry="${r * .2}" fill="#fff" opacity=".55" transform="rotate(-30 ${cx - r * .35} ${cy - r * .4})"/>`;
  const lua = (cx, cy, r) => `<path d="M${cx + r * .35} ${cy - r}A${r} ${r} 0 1 0 ${cx + r} ${cy + r * .35}A${r * .78} ${r * .78} 0 0 1 ${cx + r * .35} ${cy - r}Z" fill="url(#l${k})" stroke="#AEB6DA" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="${cx - r * .25}" cy="${cy + r * .15}" r="${r * .12}" fill="#C9CEEB"/><circle cx="${cx + r * .12}" cy="${cy + r * .5}" r="${r * .08}" fill="#C9CEEB"/>`;
  const estrela = (x, y, s, atraso) => `<path d="M${x} ${y - s}L${x + s * .3} ${y - s * .3}L${x + s} ${y}L${x + s * .3} ${y + s * .3}L${x} ${y + s}L${x - s * .3} ${y + s * .3}L${x - s} ${y}L${x - s * .3} ${y - s * .3}Z" fill="#FFF3B0">${a ? `<animate attributeName="opacity" values="1;.25;1" dur="2.6s" begin="-${atraso}s" repeatCount="indefinite"/>` : ""}</path>`;
  const nuvem = (escura = false, tf = "", mexe = 0) => `<g transform="${tf}"><g>${mexe ? boiar(mexe, 6) : ""}<path d="${NUVEM}" fill="url(#${escura ? "e" : "n"}${k})" stroke="${escura ? "#4E5B78" : "#9AABC6"}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M27 31.5A8 8 0 0 1 36.5 27" fill="none" stroke="#fff" stroke-opacity="${escura ? .35 : .9}" stroke-width="1.8" stroke-linecap="round"/></g></g>`;
  const gotas = (xs, cor = "#3D8BFF", comp = 6, dur = 0.9) => xs.map(([x, y], i) => `<line x1="${x}" y1="${y}" x2="${x - 2}" y2="${y + comp}" stroke="${cor}" stroke-width="2.6" stroke-linecap="round">${a ? `<animateTransform attributeName="transform" type="translate" values="0 -3;-2 6" dur="${dur}s" begin="-${(i * dur / xs.length).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur="${dur}s" begin="-${(i * dur / xs.length).toFixed(2)}s" repeatCount="indefinite"/>` : ""}</line>`).join("");
  const flocos = (xs) => xs.map(([x, y], i) => `<g>${a ? `<animateTransform attributeName="transform" type="translate" values="0 -3;1.5 3;0 8" dur="2.4s" begin="-${(i * .6).toFixed(1)}s" repeatCount="indefinite"/>` : ""}<path d="M${x} ${y - 3.2}V${y + 3.2}M${x - 2.8} ${y - 1.6}L${x + 2.8} ${y + 1.6}M${x - 2.8} ${y + 1.6}L${x + 2.8} ${y - 1.6}" stroke="#7FB2FF" stroke-width="1.8" stroke-linecap="round"/></g>`).join("");
  const nevoa = () => [[16, 50, 32], [12, 55, 36], [20, 60, 26]].map(([x, y, w], i) => `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="#A7B4CB" stroke-width="3" stroke-linecap="round">${a ? `<animateTransform attributeName="transform" type="translate" values="0 0;${i % 2 ? -4 : 4} 0;0 0" dur="${4 + i}s" repeatCount="indefinite"/>` : ""}</line>`).join("");
  const raio = () => `<path d="M33 41L26 53H32L29 62L39 48H33L36 41Z" fill="#FFD43B" stroke="#E8A400" stroke-width="1" stroke-linejoin="round">${a ? `<animate attributeName="opacity" values="1;1;.15;1;.15;1;1" keyTimes="0;.55;.6;.66;.7;.76;1" dur="2.8s" repeatCount="indefinite"/>` : ""}</path>`;
  let corpo;
  switch (tipo) {
    case "sol": corpo = sol(32, 32, 12, 17, 23); break;
    case "lua": corpo = `${estrela(48, 15, 3.4, 0)}${estrela(14, 46, 2.6, 1.2)}${estrela(52, 44, 2, 2)}${lua(30, 34, 15)}`; break;
    case "parcial": corpo = `${sol(24, 24, 9.5, 13.5, 18)}${nuvem(false, "translate(6 7) scale(.9)", 2.5)}`; break;
    case "parcial-noite": corpo = `${estrela(52, 12, 2.6, .5)}${lua(25, 23, 11)}${nuvem(false, "translate(6 7) scale(.9)", 2.5)}`; break;
    case "nublado": corpo = `${nuvem(true, "translate(12 -8) scale(.75)", -2)}${nuvem(false, "translate(-2 4)", 2)}`; break;
    case "neblina": corpo = `${nuvem(false, "translate(0 -6)")}${nevoa()}`; break;
    case "garoa": corpo = `${nuvem(false, "translate(0 -7)")}${gotas([[24, 46], [33, 48], [42, 46]], "#5AA2FF", 3.5, 1.3)}`; break;
    case "chuva": corpo = `${nuvem(false, "translate(0 -7)")}${gotas([[23, 45], [32, 48], [41, 45]])}`; break;
    case "chuva-forte": corpo = `${nuvem(true, "translate(0 -8)")}${gotas([[19, 44], [26, 47], [33, 44], [40, 47], [47, 44]], "#2F6BFF", 8, .7)}`; break;
    case "tempestade": corpo = `${nuvem(true, "translate(0 -9)")}${gotas([[20, 45], [45, 45]], "#2F6BFF", 7, .8)}${raio()}`; break;
    case "neve": corpo = `${nuvem(false, "translate(0 -7)")}${flocos([[23, 49], [33, 52], [43, 49]])}`; break;
    default: corpo = nuvem(false, "translate(0 -2)");
  }
  return `<svg class="tp-ico ${classe}" viewBox="0 0 64 64" aria-hidden="true">${defs}${corpo}</svg>`;
}

export const TIPOS = ["sol", "lua", "parcial", "parcial-noite", "nublado", "neblina", "garoa", "chuva", "chuva-forte", "tempestade", "neve"];

/** O logo do Clima, na família dos outros (quadrado com degradê e a órbita ao fundo): o sol atrás de uma nuvem. */
export const LOGO_CLIMA = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="clg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#62D8F5"/><stop offset="1" stop-color="#1C78C8"/></linearGradient><linearGradient id="clb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="clc"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath><radialGradient id="cls" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".6" stop-color="#FFC93C"/><stop offset="1" stop-color="#FF9F1C"/></radialGradient></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#clg)"/><g clip-path="url(#clc)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="42.6" cy="17.2" r="1.9" fill="#E0F7FF" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#clb)"/><g stroke="#FFD45E" stroke-width="2" stroke-linecap="round"><path d="M19 8.6v2.6M19 26.8v2.6M8.6 19h2.6M26.8 19h2.6M11.6 11.6l1.8 1.8M24.6 24.6l1.8 1.8M11.6 26.4l1.8-1.8M24.6 13.4l1.8-1.8"/></g><circle cx="19" cy="19" r="6.4" fill="url(#cls)"/><path d="M17.2 37.5h17.6a6 6 0 0 0 .9-11.9 8.6 8.6 0 0 0-16.2-2.1 6.9 6.9 0 0 0-2.3 14z" fill="#fff" stroke="#1C78C8" stroke-opacity=".25" stroke-width="1"/><path d="M21.5 27.2a5.6 5.6 0 0 1 6.4-3" fill="none" stroke="#BFE7FA" stroke-width="1.5" stroke-linecap="round"/></svg>`;
