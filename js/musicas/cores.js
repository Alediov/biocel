// Cores da capa para a tela Tocando (pedido do Alediov, 24/10/2026: "deixar o player mais bonito, usando cores da capa").
// Tira três cores da imagem (a que mais aparece, a mais viva e uma segunda viva de outro matiz) e a cor de destaque,
// ajustada para ler bem no tema (clara no escuro, escura no claro), mais a cor do texto em cima dela.

const hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const rgbDe = ([h, s, l]) => {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map(x => Math.round(x * 255));
};
export const css = ([r, g, b], a = 1) => (a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`);
const luminancia = ([r, g, b]) => { const c = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b); };
/** O fundo é escuro? */
export const ehEscura = (rgb) => !!rgb && luminancia(rgb) < 0.2;
const distMatiz = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Cor "#rrggbb", "#rgb" ou "rgb(…)" → [r, g, b]. */
export function lerCor(txt) {
  const t = String(txt || "").trim();
  let m = t.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = t.match(/^#([0-9a-f]{6})/i);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = t.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return [+m[1], +m[2], +m[3]].map(Math.round);
  m = t.match(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (m) return rgbDe([+m[1], +m[2] / 100, +m[3] / 100]);
  return null;
}

/** Três cores da imagem: { dominante, viva, segunda } em [r, g, b]. */
export async function paletaDaImagem(url) {
  const img = new Image(); img.src = url; await img.decode();
  const N = 40, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N);
  const d = g.getImageData(0, 0, N, N).data;
  // baldes por matiz (12), saturação (baixa/alta) e claridade (4)
  const baldes = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const rgb = [d[i], d[i + 1], d[i + 2]], [h, s, l] = hsl(rgb);
    const k = s < 0.18 ? `c${Math.min(3, Math.floor(l * 4))}` : `${Math.floor(h / 30)}|${s > 0.5 ? 1 : 0}|${Math.min(3, Math.floor(l * 4))}`;
    let b = baldes.get(k); if (!b) baldes.set(k, b = { n: 0, r: 0, g: 0, b: 0 });
    b.n++; b.r += rgb[0]; b.g += rgb[1]; b.b += rgb[2];
  }
  const l = [...baldes.values()].map(b => { const rgb = [b.r / b.n, b.g / b.n, b.b / b.n].map(Math.round); const [h, s, li] = hsl(rgb); return { rgb, n: b.n, h, s, l: li }; });
  if (!l.length) return null;
  const dominante = l.reduce((a, b) => (b.n > a.n ? b : a));
  // viva: saturada, nem muito escura nem muito clara, e que apareça um pouco
  const nota = (x) => Math.sqrt(x.n) * x.s * (1 - Math.min(1, Math.abs(x.l - 0.55) * 1.7));
  const vivas = l.filter(x => x.s > 0.22 && x.n >= 4).sort((a, b) => nota(b) - nota(a));
  const viva = vivas[0] || dominante;
  const segunda = vivas.find(x => distMatiz(x.h, viva.h) > 35) || vivas[1] || dominante;
  return { dominante: dominante.rgb, viva: viva.rgb, segunda: segunda.rgb };
}

/** Uma cor só (capa sem imagem) vira paleta: ela, uma mais escura e outra com o matiz ao lado. */
export function paletaDeCor(rgb) {
  const [h, s, l] = hsl(rgb);
  return { dominante: rgbDe([h, s, Math.max(0.15, l * 0.6)]), viva: rgb, segunda: rgbDe([(h + 40) % 360, Math.min(1, s * 1.1), l]) };
}

/** Destaque que lê bem sobre o fundo (`escuro`: tema escuro) e o texto que vai em cima dele. */
export function destaque(rgb, escuro) {
  let [h, s, l] = hsl(rgb);
  s = s < 0.12 ? s : Math.min(0.95, Math.max(0.5, s));
  l = escuro ? Math.max(0.62, Math.min(0.8, l)) : Math.min(0.42, Math.max(0.28, l));
  const cor = rgbDe([h, s, l]);
  return { cor, sobre: luminancia(cor) > 0.36 ? [16, 18, 24] : [255, 255, 255] };
}
/** A mesma cor, mais forte para o fundo (sem deixar branco nem preto puro). */
export function paraFundo(rgb, escuro) {
  const [h, s, l] = hsl(rgb);
  return rgbDe([h, Math.min(0.9, s * 1.15), escuro ? Math.max(0.28, Math.min(0.55, l)) : Math.max(0.55, Math.min(0.78, l))]);
}
