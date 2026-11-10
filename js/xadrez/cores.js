// Cores das anotações do tabuleiro (pedido do Alediov, 06/11/2026: "mais cores nos desenhos").
// - as 4 de sempre (verde, vermelha, azul, amarela), o arco-íris (muda de cor sozinho) e até MAX_PROPRIAS cores dele,
//   acrescentadas pelo círculo cromático (matiz × saturação, com o brilho embaixo) ou pelo código (#RRGGBB ou #RGB);
// - limite de 4 próprias (8 cores lisas ao todo): mais que isso as setas meio transparentes por cima das casas claras e
//   escuras deixam de se distinguir, e a barra ainda cabe numa linha no tablet (no celular ela rola para o lado);
// - as próprias ficam em x.cfg.coresDesenho (a tela de Xadrez guarda por `aoMudarCores`).

export const CORES = { verde: "#15781B", vermelha: "#CC3333", azul: "#2A6FDB", amarela: "#E0A100" };
export const FIXAS = Object.keys(CORES);
export const NOMES = { verde: "Verde", vermelha: "Vermelha", azul: "Azul", amarela: "Amarela", arco: "Arco-íris" };
export const ARCO = "arco";
export const MAX_PROPRIAS = 4;

/** "#abc", "abc", "#AABBCC" → "#aabbcc"; o que não for código de cor → null. */
export function lerHex(txt) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(txt ?? "").trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = [...h].map(c => c + c).join("");
  return "#" + h;
}
/** O código da cor de um desenho ("verde", "#aabbcc"); o arco-íris e o desconhecido → null. */
export const hexDe = (cor) => CORES[cor] || (typeof cor === "string" && cor[0] === "#" ? lerHex(cor) : null);
export const ehPropria = (cor) => typeof cor === "string" && cor[0] === "#";

// ---------------------------------------------------------------- as cores dele (valem para todos os tabuleiros)
let proprias = [];
let aoMudar = null;
const ouvintes = new Set();
const avisar = () => { for (const f of ouvintes) f(); };
export const coresProprias = () => [...proprias];
/** A tela chama com o que está guardado (x.cfg.coresDesenho); repete, inválidas e o excesso saem. */
export function definirCoresProprias(l) {
  const out = [];
  for (const c of Array.isArray(l) ? l : []) { const h = lerHex(c); if (h && !out.includes(h) && !Object.values(CORES).some(f => f.toLowerCase() === h)) out.push(h); }
  proprias = out.slice(0, MAX_PROPRIAS);
  avisar();
}
export function aoMudarCores(fn) { aoMudar = fn; }
export function ouvirCores(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
/** "ok" (acrescentou), "existe" (já estava: é só escolher) ou "cheia" (limite). */
export function adicionarPropria(hex) {
  const h = lerHex(hex); if (!h) return "invalida";
  if (proprias.includes(h) || Object.values(CORES).some(f => f.toLowerCase() === h)) return "existe";
  if (proprias.length >= MAX_PROPRIAS) return "cheia";
  proprias.push(h); aoMudar?.(coresProprias()); avisar();
  return "ok";
}
export function tirarPropria(hex) {
  const h = lerHex(hex), i = proprias.indexOf(h); if (i < 0) return false;
  proprias.splice(i, 1); aoMudar?.(coresProprias()); avisar();
  return true;
}
/** A cor da barra que corresponde a um código (fixa pelo nome, própria pelo código). */
export const corDoHex = (h) => FIXAS.find(k => CORES[k].toLowerCase() === h) || h;

// ---------------------------------------------------------------- HSV (o círculo: matiz no ângulo, saturação no raio)
export function hsvParaHex(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return "#" + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
export function hexParaHsv(hex) {
  const h6 = lerHex(hex); if (!h6) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h6.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}

const SVG_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

/**
 * O círculo cromático para uma cor nova: arrastar no círculo escolhe matiz e saturação; a barra embaixo, o brilho;
 * ou digitar o código. `aoAdicionar(hex)` devolve o resultado de `adicionarPropria`.
 */
export function abrirSeletorCor({ inicial = "#8e24aa", aoAdicionar } = {}) {
  document.querySelector(".xz-cf-fundo")?.remove();
  let hsv = hexParaHsv(inicial) || { h: 290, s: .8, v: .67 };
  const fundo = document.createElement("div");
  fundo.className = "xz-cf-fundo";
  const cheia = () => proprias.length >= MAX_PROPRIAS;
  fundo.innerHTML = `<div class="xz-cf" role="dialog" aria-label="Nova cor">
    <div class="xz-cf-topo"><b>Nova cor</b><button type="button" class="xz-cf-x" aria-label="Fechar">${SVG_X}</button></div>
    <div class="xz-cf-roda"><canvas></canvas><i class="xz-cf-mira"></i></div>
    <label class="xz-cf-luz"><span>Brilho</span><input type="range" min="25" max="100" step="1"></label>
    <div class="xz-cf-linha"><i class="xz-cf-amostra"></i><input class="xz-cf-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Código da cor (#RRGGBB)"><button type="button" class="botao xz-cf-ok">Adicionar</button></div>
    <p class="xz-cf-aviso" hidden></p>
  </div>`;
  document.body.append(fundo);
  const $ = (s) => fundo.querySelector(s);
  const cv = $("canvas"), mira = $(".xz-cf-mira"), luz = $(".xz-cf-luz input"), hexEl = $(".xz-cf-hex"), amostra = $(".xz-cf-amostra"), ok = $(".xz-cf-ok"), aviso = $(".xz-cf-aviso");
  const fechar = () => { fundo.remove(); document.removeEventListener("keydown", tecla, true); };
  const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); fechar(); } };
  document.addEventListener("keydown", tecla, true);

  // o círculo, pixel a pixel (a conta é a mesma da escolha: o que se vê é o que se pega)
  let vDesenhado = -1;
  function desenharRoda() {
    if (vDesenhado === hsv.v && cv.width) return;
    vDesenhado = hsv.v;
    const lado = Math.round((cv.getBoundingClientRect().width || 220) * Math.min(2, window.devicePixelRatio || 1)) || 440;
    cv.width = cv.height = lado;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(lado, lado), d = img.data, r = lado / 2;
    for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
      const dx = x + .5 - r, dy = y + .5 - r, dist = Math.hypot(dx, dy) / r;
      if (dist > 1.01) continue;
      const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s = Math.min(1, dist);
      const f = (n) => { const k = (n + h / 60) % 6; return hsv.v - hsv.v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
      const i = (y * lado + x) * 4;
      d[i] = f(5) * 255; d[i + 1] = f(3) * 255; d[i + 2] = f(1) * 255;
      d[i + 3] = 255 * Math.max(0, Math.min(1, (1.01 - dist) * r / 1.5)); // a borda sem serrilhado
    }
    ctx.putImageData(img, 0, 0);
  }
  function pintar({ deTexto = false } = {}) {
    const hex = (deTexto && lerHex(hexEl.value)) || hsvParaHex(hsv.h, hsv.s, hsv.v);
    desenharRoda();
    const a = hsv.h * Math.PI / 180;
    mira.style.left = `${50 + Math.cos(a) * hsv.s * 50}%`; mira.style.top = `${50 + Math.sin(a) * hsv.s * 50}%`;
    mira.style.background = hex;
    luz.value = String(Math.round(hsv.v * 100));
    luz.style.setProperty("--topo", hsvParaHex(hsv.h, hsv.s, 1));
    amostra.style.background = hex;
    if (!deTexto) { hexEl.value = hex.toUpperCase(); hexEl.classList.remove("errado"); }
    const c = cheia(), existe = proprias.includes(hex) || Object.values(CORES).some(f => f.toLowerCase() === hex);
    ok.textContent = existe ? "Usar" : "Adicionar";
    ok.disabled = (c && !existe) || hexEl.classList.contains("errado");
    aviso.hidden = !(c && !existe);
    aviso.textContent = `Limite de ${MAX_PROPRIAS} cores próprias. Segure uma delas na barra para tirar.`;
  }
  // arrastar no círculo
  const doPonto = (e) => {
    const r = cv.getBoundingClientRect(); // vale com o zoom do tablet: tudo em fração do círculo
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    hsv = { ...hsv, h: (Math.atan2(ny, nx) * 180 / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(nx, ny)) };
    pintar();
  };
  const roda = $(".xz-cf-roda");
  roda.addEventListener("pointerdown", (e) => { e.preventDefault(); try { roda.setPointerCapture(e.pointerId); } catch { /* */ } roda._arr = true; doPonto(e); });
  roda.addEventListener("pointermove", (e) => { if (roda._arr) doPonto(e); });
  const parar = () => { roda._arr = false; };
  roda.addEventListener("pointerup", parar); roda.addEventListener("pointercancel", parar);
  luz.addEventListener("input", () => { hsv = { ...hsv, v: +luz.value / 100 }; pintar(); });
  hexEl.addEventListener("input", () => {
    const h = lerHex(hexEl.value);
    hexEl.classList.toggle("errado", !h);
    if (h) { hsv = hexParaHsv(h); pintar({ deTexto: true }); } else { ok.disabled = true; amostra.style.background = "transparent"; }
  });
  hexEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !ok.disabled) ok.click(); });
  ok.addEventListener("click", () => {
    const h = lerHex(hexEl.value) || hsvParaHex(hsv.h, hsv.s, hsv.v);
    const r = aoAdicionar?.(h);
    if (r === "cheia") { pintar(); return; }
    fechar();
  });
  $(".xz-cf-x").onclick = fechar;
  fundo.addEventListener("pointerdown", (e) => { if (e.target === fundo) fundo._fora = true; });
  fundo.addEventListener("click", (e) => { if (e.target === fundo && fundo._fora) fechar(); fundo._fora = false; });
  pintar();
  return { el: fundo, fechar };
}
