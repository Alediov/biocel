// Partículas do fundo (02/11/2026, pedido do Alediov: "adicione outras partículas para colocar no fundo, além das
// bolhas, como corações, estrelas, triângulos… quero poder escolher quais partículas estarão ativas, podendo ativar até
// mesmo todas. Porém, a quantidade não mudará, apenas quais aparecerão"). Generaliza as bolhas do tubete (antes só em
// scan/visual.js): um canvas atrás do conteúdo, o MESMO número de partículas (11 no celular, 18 no resto) e o mesmo
// custo (cada forma é um sprite desenhado uma vez por cor e tamanho; o quadro só copia sprites, ~30 por segundo).
// Os tipos escolhidos se revezam entre as partículas: com 3 tipos, cada um é ~1/3 delas.
// Sem dependências: vai no app (aparencia.js, scan/visual.js) e no OdontoScan.html (tools/montar_odontoscan.py).
// Respeita "reduzir movimento" (nada anda) e para com a aba escondida ou com a área coberta (`ativo()`).

export const reduzido = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const escuroMQ = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
/** Tema AMOLED pelo tema do app (data-tema no <html>) ou, sem ele, pelo do sistema. */
export function temaEscuro() {
  const t = document.documentElement.dataset.tema;
  return t === "escuro" || (t !== "claro" && escuroMQ());
}

// ---------- as formas (caixa de -50 a 50; `traco`: só o contorno) ----------
const estrela = (pontas, fora, dentro) => {
  let d = "";
  for (let i = 0; i < pontas * 2; i++) {
    const r = i % 2 ? dentro : fora, a = -Math.PI / 2 + (i * Math.PI) / pontas;
    d += `${i ? "L" : "M"}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }
  return d + "Z";
};
const floco = () => {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a), p = (x, y) => `${(x * c - y * s).toFixed(1)} ${(x * s + y * c).toFixed(1)}`;
    d += `M0 0L${p(0, -44)}M${p(0, -26)}L${p(-12, -36)}M${p(0, -26)}L${p(12, -36)}`;
  }
  return d;
};
const CORES = ["#2BC8A9", "#5BD8F0", "#6E9BFF", "#9B8CFF"];
/** Os tipos: `partes` (d do SVG; também desenhadas no Path2D), `cores`, `mov` ("sobe" | "cai"), `gira` (rad/s; null =
 *  só balança), `pisca`, `tam` (escala do raio). As bolhas são o sprite antigo do tubete. */
export const PARTICULAS = [
  { id: "bolhas", nome: "Bolhas", cores: CORES },
  { id: "coracoes", nome: "Corações", cores: ["#FF6B9A", "#FF8FB8", "#C77DFF", "#FF7A70"], balanca: 0.25,
    partes: [{ d: "M0 40C-30 20-48 4-48-15C-48-33-31-44-16-40C-8-38-3-32 0-26C3-32 8-38 16-40C31-44 48-33 48-15C48 4 30 20 0 40Z" }] },
  { id: "estrelas", nome: "Estrelas", cores: ["#FFC24B", "#FFD86B", "#5BD8F0", "#9B8CFF"], gira: 0.35, pisca: true, partes: [{ d: estrela(5, 50, 22) }] },
  { id: "faiscas", nome: "Faíscas", cores: ["#FFD86B", "#FFFFFF", "#5BD8F0", "#FF8FB8"], gira: 0.2, pisca: true, tam: 0.8,
    partes: [{ d: "M0-50C4-12 12-4 50 0C12 4 4 12 0 50C-4 12-12 4-50 0C-12-4-4-12 0-50Z" }] },
  { id: "triangulos", nome: "Triângulos", cores: CORES, gira: 0.6, partes: [{ d: "M0-46L44 34L-44 34Z" }] },
  { id: "aneis", nome: "Anéis", cores: CORES, partes: [{ d: "M0-44A44 44 0 1 1 0 44A44 44 0 1 1 0-44ZM0-28A28 28 0 1 0 0 28A28 28 0 1 0 0-28Z" }] },
  { id: "losangos", nome: "Losangos", cores: ["#9B8CFF", "#6E9BFF", "#FF8FB8", "#2BC8A9"], gira: 0.4, partes: [{ d: "M0-50L34 0L0 50L-34 0Z" }] },
  { id: "notas", nome: "Notas", cores: ["#FF7AB8", "#9B8CFF", "#5BD8F0", "#2BC8A9"], balanca: 0.3, tam: 0.9,
    partes: [{ d: "M-12 16C2 12 12 20 9 31C6 42-8 48-22 45C-36 42-40 30-30 22C-26 19-19 17-12 16ZM2-46L12-46L12 30L2 30ZM12-46C28-38 40-26 34-6C32-20 24-26 12-28Z" }] },
  { id: "dentes", nome: "Dentinhos", cores: CORES, balanca: 0.2,
    partes: [{ d: "M-30-40C-42-40-48-28-46-14C-44 2-36 10-32 26C-29 40-24 48-18 48C-10 48-9 30-4 20C-2 16 2 16 4 20C9 30 10 48 18 48C24 48 29 40 32 26C36 10 44 2 46-14C48-28 42-40 30-40C18-40 12-34 0-34C-12-34-18-40-30-40Z" },
      { d: "M-17-12A5 5 0 1 0-17-2A5 5 0 1 0-17-12ZM17-12A5 5 0 1 0 17-2A5 5 0 1 0 17-12ZM-8 6Q0 13 8 6", olhos: true }] },
  { id: "folhas", nome: "Folhas", cores: ["#4FD08A", "#2BC8A9", "#9BD35A", "#5FD1A0"], mov: "cai", balanca: 0.7,
    partes: [{ d: "M0-50C30-30 34 10 0 50C-34 10-30-30 0-50Z" }, { d: "M0-38L0 44", traco: true }] },
  { id: "flocos", nome: "Flocos", cores: ["#5BD8F0", "#6E9BFF", "#9B8CFF", "#B9C7FF"], mov: "cai", gira: 0.3, tam: 0.9, partes: [{ d: floco(), traco: true, so: true }] },
  { id: "planetas", nome: "Planetas", cores: ["#FFB27A", "#9B8CFF", "#5BD8F0", "#FF7AB8"], balanca: 0.15,
    partes: [{ d: "M0-24A24 24 0 1 1 0 24A24 24 0 1 1 0-24Z" }, { d: "M-48 8C-56 22 18 14 46-6C62-18 50-26 26-20", traco: true, so: true }] },
];
const TIPO = Object.fromEntries(PARTICULAS.map(t => [t.id, t]));
export const TIPOS_PADRAO = ["bolhas"];
/** Só os tipos que existem (na ordem da lista); vazio vira o padrão. */
export function tiposValidos(t) {
  const set = new Set(Array.isArray(t) ? t : typeof t === "string" ? t.split(",") : []);
  const ok = PARTICULAS.map(p => p.id).filter(id => set.has(id));
  return ok.length ? ok : [...TIPOS_PADRAO];
}

/** Um ícone SVG do tipo (para a folha da Aparência), em `currentColor`. */
export function svgParticula(id) {
  const t = TIPO[id]; if (!t) return "";
  if (!t.partes) return `<svg viewBox="-56 -56 112 112" aria-hidden="true"><circle r="44" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="7"/><ellipse cx="-17" cy="-19" rx="11" ry="6" transform="rotate(-40 -17 -19)" fill="#fff" fill-opacity=".8"/></svg>`;
  return `<svg viewBox="-56 -56 112 112" aria-hidden="true">${t.partes.map(p => p.traco
    ? `<path d="${p.d}" fill="none" stroke="currentColor" stroke-width="${p.so ? 8 : 6}" stroke-linecap="round" stroke-linejoin="round"/>`
    : p.olhos ? `<path d="${p.d}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`
      : `<path d="${p.d}" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="6" stroke-linejoin="round" fill-rule="evenodd"/>`).join("")}</svg>`;
}

// ---------- sprites ----------
const hexA = (cor, a) => `${cor}${Math.max(0, Math.min(255, Math.round(a * 255))).toString(16).padStart(2, "0")}`;
function spriteBolha(cor, r, amoled) {
  const s = Math.ceil(r * 2 + 4), c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d"), m = s / 2;
  const g = x.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.05, m, m, r);
  g.addColorStop(0, `${cor}${amoled ? "38" : "22"}`); g.addColorStop(0.62, `${cor}0c`); g.addColorStop(0.9, `${cor}${amoled ? "55" : "30"}`); g.addColorStop(1, `${cor}00`);
  x.fillStyle = g; x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.fill();
  x.fillStyle = `rgba(255,255,255,${amoled ? 0.32 : 0.55})`; // reflexo
  x.beginPath(); x.ellipse(m - r * 0.38, m - r * 0.42, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2); x.fill();
  return c;
}
const caminhos = new Map();
const caminho = (d) => { let p = caminhos.get(d); if (!p) { p = new Path2D(d); caminhos.set(d, p); } return p; };
/** Uma forma no estilo das bolhas: miolo translúcido, borda mais forte e um brilho em cima. */
function spriteForma(t, cor, r, amoled) {
  const s = Math.ceil(r * 2 + 4), c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d"), k = r / 50;
  x.translate(s / 2, s / 2); x.scale(k, k);
  x.lineJoin = "round"; x.lineCap = "round";
  const lw = Math.max(1.1, r * 0.08) / k; // ~1 px nas pequenas, mais grossa nas grandes
  for (const p of t.partes) {
    const path = caminho(p.d);
    if (p.traco || p.olhos) {
      x.lineWidth = p.so ? lw * 1.5 : p.olhos ? lw * 1.1 : lw;
      x.strokeStyle = hexA(cor, p.olhos ? (amoled ? 0.55 : 0.6) : amoled ? 0.62 : 0.5);
      x.stroke(path);
      continue;
    }
    const g = x.createRadialGradient(-18, -20, 2, 0, 0, 56);
    g.addColorStop(0, hexA(cor, amoled ? 0.3 : 0.2)); g.addColorStop(0.65, hexA(cor, amoled ? 0.12 : 0.07)); g.addColorStop(1, hexA(cor, amoled ? 0.28 : 0.18));
    x.fillStyle = g; x.fill(path, "evenodd");
    x.lineWidth = lw; x.strokeStyle = hexA(cor, amoled ? 0.55 : 0.42); x.stroke(path);
    // brilho
    x.save(); x.clip(path, "evenodd");
    x.fillStyle = `rgba(255,255,255,${amoled ? 0.26 : 0.5})`;
    x.beginPath(); x.ellipse(-17, -20, 13, 7, -0.7, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  return c;
}
const RAIOS = [8, 16, 28, 40];
const faixa = (r) => (r < 10 ? 0 : r < 18 ? 1 : r < 30 ? 2 : 3);

/** Tira o canvas de partículas de `raiz`. */
export function desligarParticulas(raiz) { raiz?.querySelectorAll(":scope > .os-bolhas, :scope > .orb-bolhas").forEach(c => { c._parar?.(); c.remove(); }); }

/**
 * Liga as partículas em `raiz` (um canvas fixo atrás do conteúdo: o CSS da classe põe z-index -1). `tipos`: ids de
 * PARTICULAS; `ativo()`: se a área está à vista (senão o quadro não é desenhado); `escuro()`: tema AMOLED.
 * Chamar de novo com os mesmos tipos não recomeça (o canvas fica).
 */
export function ligarParticulas(raiz, { ativo = null, classe = "orb-bolhas", tipos = TIPOS_PADRAO, escuro = null } = {}) {
  if (!raiz) return null;
  const lista = tiposValidos(tipos), chave = lista.join(",");
  const velho = raiz.querySelector(`:scope > .${classe}`);
  if (velho && velho.dataset.tipos === chave) { velho._ativo = ativo; return velho; }
  desligarParticulas(raiz);
  const cv = document.createElement("canvas");
  cv.className = classe; cv.setAttribute("aria-hidden", "true"); cv.dataset.tipos = chave; cv._ativo = ativo;
  raiz.prepend(cv);
  if (reduzido()) return cv; // fundo parado: o degradê do CSS basta
  const cx = cv.getContext("2d");
  const celular = matchMedia("(pointer: coarse)").matches && innerWidth < 700;
  const N = celular ? 11 : 18, dpr = Math.min(1.5, devicePixelRatio || 1);
  const eEscuro = escuro || (() => raiz.classList.contains("os-amoled") || temaEscuro());
  let W = 0, H = 0, amoled = null, sprites = {}, ps = [], ult = 0, rodando = false, vez = Math.floor(Math.random() * lista.length);
  const proximo = () => lista[vez++ % lista.length]; // os tipos se revezam: a mesma quantidade de cada
  const novo = (y, tipo = proximo()) => {
    const t = TIPO[tipo], cai = t.mov === "cai";
    const r = (5 + Math.pow(Math.random(), 2.2) * (celular ? 26 : 34)) * (t.tam || 1);
    const g = t.gira ? (Math.random() < 0.5 ? -1 : 1) * t.gira * (0.5 + Math.random()) : 0;
    return { t: tipo, cai, x: Math.random() * W, y: y ?? (cai ? -r * 2 - Math.random() * H * 0.3 : H + r + Math.random() * H * 0.3), r,
      v: (6 + 22 / Math.sqrt(r) + Math.random() * 6) * (cai ? 0.8 : 1), f: Math.random() * 6.28, a: (6 + Math.random() * 14) * (cai ? 1.6 : 1),
      c: (Math.random() * 4) | 0, s: 0.6 + Math.random() * 0.9, rot: Math.random() * 6.28, g, bal: t.balanca || 0, pisca: !!t.pisca };
  };
  const medir = () => {
    const w = raiz.clientWidth || innerWidth, h = raiz.clientHeight || innerHeight;
    if (w === W && h === H) return;
    const primeira = !W; W = w; H = h;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (primeira) ps = Array.from({ length: N }, () => novo(Math.random() * H));
  };
  const prepararSprites = () => {
    const a = !!eEscuro();
    if (a === amoled) return;
    amoled = a; sprites = {};
    for (const id of lista) { const t = TIPO[id]; sprites[id] = t.cores.map(c => RAIOS.map(r => (t.partes ? spriteForma(t, c, r, a) : spriteBolha(c, r, a)))); }
  };
  const quadro = (tm) => {
    if (!cv.isConnected || document.hidden) { rodando = false; return; }
    requestAnimationFrame(quadro);
    if (tm - ult < 33) return; // ~30 quadros por segundo
    const at = cv._ativo;
    if (at ? !at() : document.querySelector(".camada-home")) { ult = tm; return; } // coberta (a Home ou outra área por cima)
    const dt = Math.min(0.1, (tm - ult) / 1000 || 0.033); ult = tm;
    medir(); prepararSprites();
    const pressa = raiz.classList.contains("importando") ? 3.2 : 1;
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.f += dt * p.s;
      if (p.cai) { p.y += p.v * dt * pressa; if (p.y > H + p.r * 2) Object.assign(p, novo()); }
      else { p.y -= p.v * dt * pressa; if (p.y < -p.r * 2) Object.assign(p, novo()); }
      const x = p.x + Math.sin(p.f) * p.a, img = sprites[p.t][p.c][faixa(p.r)];
      // some aos poucos perto da borda para onde vai
      let al = p.cai ? Math.min(1, (H - p.y + p.r) / (H * 0.25)) : Math.min(1, (p.y + p.r) / (H * 0.25));
      if (p.pisca) al *= 0.55 + 0.45 * Math.sin(p.f * 2.3 + p.rot);
      cx.globalAlpha = Math.max(0, al);
      if (p.g || p.bal) {
        p.rot += p.g * dt;
        const ang = p.g ? p.rot : Math.sin(p.f * 0.9) * p.bal, co = Math.cos(ang) * dpr, si = Math.sin(ang) * dpr;
        cx.setTransform(co, si, -si, co, x * dpr, p.y * dpr);
        cx.drawImage(img, -p.r, -p.r, p.r * 2, p.r * 2);
      } else {
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx.drawImage(img, x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }
    cx.globalAlpha = 1;
  };
  const iniciar = () => { if (rodando || !cv.isConnected) return; rodando = true; ult = 0; requestAnimationFrame(quadro); };
  const aoVoltar = () => { if (!cv.isConnected) return document.removeEventListener("visibilitychange", aoVoltar); if (!document.hidden) iniciar(); };
  document.addEventListener("visibilitychange", aoVoltar);
  cv._parar = () => document.removeEventListener("visibilitychange", aoVoltar);
  iniciar();
  return cv;
}
