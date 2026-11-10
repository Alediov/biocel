// Visor das lâminas digitais (.vmic): canvas próprio, em tela cheia por cima dos Estudos (z 30: acima da camada dos
// jogos, abaixo do #modal). Pirâmide Deep Zoom: desenha primeiro o nível de base (a lâmina inteira com ~1.000 px, que
// carrega ao abrir e nunca sai da memória), depois os níveis intermediários que já estiverem na memória e por cima o
// nível certo para o zoom; só pede os tiles visíveis (+ uma volta), do centro para fora, em lotes (no Android, um lote =
// uma chamada ao plugin). Os tiles decodificados (ImageBitmap) ficam num LRU com teto pela memória do aparelho.
// Bordas dos tiles arredondadas em pixels do aparelho (sem frestas entre eles). Gestos: arrastar, pinça, roda do mouse
// e toque duplo em volta do dedo; mapa da lâmina com o retângulo da vista; régua em µm (PixelPerMicron) e o aumento
// aproximado (vmic.js aumentoNaTela: 0,25 µm/px = 40×; acima da escala 1, "zoom digital").
// A camada fica fora do zoom do tablet (tablet.js): as contas do ponteiro dividem pela razão retângulo ÷ offsetWidth,
// como os outros canvas do app, e valem com ou sem zoom.
import { escapar, toast, formulario, modal } from "../ui.js";
import { extra } from "../dados.js";
import { tamanhoDoNivel, tilesDoNivel, aumentoNaTela } from "./vmic.js";
import { uidDe, tituloDe } from "./fontes.js";
import * as R from "./registro.js";

let cssP = null;
/** Põe o laminas.css (uma vez); resolve quando ele carregou (o visor mede o palco logo depois). */
export function garantirCSS() {
  return (cssP ??= new Promise((ok) => {
    if (document.querySelector('link[href="laminas.css"]')) return ok();
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "laminas.css";
    l.onload = l.onerror = () => ok();
    document.head.append(l);
    setTimeout(ok, 3000);
  }));
}

const CH_VISTA = "orbita.laminas.vista.";
const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
// cores da caneta e das setas (fortes sobre o rosa e o roxo do H&E; com contorno claro)
const CORES = [["#111318", "Preto"], ["#2F6BFF", "Azul"], ["#12A150", "Verde"], ["#FFC400", "Amarelo"]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n, c = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: 0 });

/** Rótulo da lesão (id do Treino de Lâminas ou texto livre). */
export function nomeLesao(D, lesao) {
  if (!lesao) return "";
  const l = [...(D?.lesoes || []), ...(D?.parecidas || [])].find(x => x.id === lesao);
  return l ? l.nome : lesao;
}

/** Abre o visor. `item`: o arquivo (nome, tamanho) para a folha de informações. → { fechar, api } */
/** `vista`: { cx, cy, s } para começar num ponto (o "Ver na lâmina" do treino com os campos). */
export async function abrirVisor(slide, { item = null, aoFechar = null, vista = null } = {}) {
  await garantirCSS();
  const D = await extra("jogo:laminas").catch(() => null);
  const info = slide.info, uid = uidDe(info);
  const W = info.largura, H = info.altura, NM = info.nivelMax, TS = info.tile, OV = info.overlap, PPM = info.pxPorMicron;
  const LB = clamp(NM - Math.max(0, Math.ceil(Math.log2(Math.max(W, H) / 1024))), 0, NM); // nível de base (~1.000 px)
  const mem = navigator.deviceMemory || 4;
  const TETO = mem >= 8 ? 420 : mem >= 4 ? 260 : 160; // tiles na memória (~256 KB cada)

  const ov = document.createElement("div"); ov.className = "vm-camada";
  ov.innerHTML = `
    <div class="vm-topo">
      <button class="vm-bt vm-fechar" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <button class="vm-titulo" aria-label="Informações da lâmina"><b></b><small></small></button>
      <button class="vm-bt vm-mapa-bt ativo" aria-label="Mostrar ou esconder o mapa"><svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><rect x="11" y="9" width="6" height="5"/></svg></button>
      <button class="vm-bt vm-info" aria-label="Informações"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg></button>
    </div>
    <div class="vm-palco">
      <canvas class="vm-tela"></canvas>
      <div class="vm-marcas"></div>
      <div class="vm-aviso" hidden></div>
      <div class="vm-carregando" hidden></div>
      <div class="vm-escala"><span class="vm-aum"></span><div class="vm-regua"><i></i><span></span></div></div>
      <div class="vm-mapa"><canvas></canvas><i></i></div>
      <div class="vm-balao" hidden></div>
      <div class="vm-ferr" hidden>
        <button data-f="traco" class="ativo" aria-label="Caneta" title="Caneta"><svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 7l3 3"/></svg></button>
        <button data-f="seta" aria-label="Seta" title="Seta"><svg viewBox="0 0 24 24"><path d="M5 19L19 5M10 5h9v9"/></svg></button>
        <button data-f="borracha" aria-label="Borracha" title="Borracha"><svg viewBox="0 0 24 24"><path d="M8 20h12M5 15l8-9 6 6-7 8H9z"/></svg></button>
        <span class="vm-sep"></span>
        ${CORES.map(([c, n], i) => `<button data-cor="${i}" class="vm-cor ${i ? "" : "ativo"}" style="--c:${c}" aria-label="${n}" title="${n}"></button>`).join("")}
        <span class="vm-sep"></span>
        <button data-f="dedo" aria-label="O dedo desenha ou move" title="O dedo desenha ou move"><svg viewBox="0 0 24 24"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 13a1.5 1.5 0 0 1 2.5-1.5L8 13"/></svg></button>
        <button data-f="desfazer" aria-label="Desfazer" title="Desfazer"><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg></button>
        <button data-f="limpar" aria-label="Apagar todos os desenhos" title="Apagar todos os desenhos"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      </div>
    </div>
    <div class="vm-barra">
      <button data-a="inteira"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span>Inteira</span></button>
      <button data-a="menos"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M8 11h6M16 16l4 4"/></svg><span>Afastar</span></button>
      <button data-a="mais"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M8 11h6M11 8v6M16 16l4 4"/></svg><span>Aproximar</span></button>
      <button data-a="marcar"><svg viewBox="0 0 24 24"><path d="M12 21s-6-5.7-6-10.5a6 6 0 0 1 12 0C18 15.3 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/></svg><span>Marcar</span></button>
      <button data-a="lista"><svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg><span>Marcações</span><em class="vm-n"></em></button>
      <button data-a="desenhar"><svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 7l3 3"/></svg><span>Desenhar</span></button>
    </div>
    <div class="vm-folha" hidden></div>`;
  document.body.append(ov);
  const $ = (s) => ov.querySelector(s);
  const palco = $(".vm-palco"), tela = $(".vm-tela"), ctx = tela.getContext("2d");
  const marcasEl = $(".vm-marcas"), mapaEl = $(".vm-mapa"), mapaCv = mapaEl.querySelector("canvas"), mapaJan = mapaEl.querySelector("i");
  const folha = $(".vm-folha"), balao = $(".vm-balao"), aviso = $(".vm-aviso"), carregando = $(".vm-carregando");

  // ---------------------------------------------------------------- vista
  let vw = 1, vh = 1, dpr = 1, sFit = 0.05;
  let cx = W / 2, cy = H / 2, s = 0.05;
  const sMax = 2.5;
  const sMin = () => sFit * 0.6;
  function limitar() { s = clamp(s, sMin(), sMax); cx = clamp(cx, 0, W); cy = clamp(cy, 0, H); }
  function medir() {
    const w = palco.offsetWidth || 1, h = palco.offsetHeight || 1;
    dpr = Math.min(devicePixelRatio || 1, 2);
    vw = w; vh = h;
    tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr);
    sFit = Math.min(w / W, h / H) * 0.94;
  }
  const paraImg = (px, py) => [cx + (px - vw / 2) / s, cy + (py - vh / 2) / s];
  const paraTela = (ix, iy) => [(ix - cx) * s + vw / 2, (iy - cy) * s + vh / 2];

  // ---------------------------------------------------------------- tiles
  const cache = new Map(); // "L/x/y" → ImageBitmap (LRU; o nível de base não sai)
  const pendentes = new Set(), vazios = new Set();
  let fila = [], emVoo = 0, falhas = 0, fechado = false;
  const chave = (L, x, y) => `${L}/${x}/${y}`;
  function usar(k) { const b = cache.get(k); if (b) { cache.delete(k); cache.set(k, b); } return b; }
  function guardarTile(k, L, bmp) {
    cache.set(k, bmp);
    if (cache.size <= TETO) return;
    for (const [kk, b] of cache) {
      if (cache.size <= TETO) break;
      if (+kk.split("/")[0] <= LB) continue;
      b.close?.(); cache.delete(kk);
    }
  }
  function visiveis(L, margem = 0) {
    const k = 2 ** (NM - L), span = TS * k;
    const [cols, lins] = tilesDoNivel(info, L);
    const x0 = cx - vw / 2 / s, x1 = cx + vw / 2 / s, y0 = cy - vh / 2 / s, y1 = cy + vh / 2 / s;
    const tx0 = clamp(Math.floor(x0 / span) - margem, 0, cols - 1), tx1 = clamp(Math.floor(x1 / span) + margem, 0, cols - 1);
    const ty0 = clamp(Math.floor(y0 / span) - margem, 0, lins - 1), ty1 = clamp(Math.floor(y1 / span) + margem, 0, lins - 1);
    if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) return [];
    const out = [];
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) out.push([L, x, y]);
    return out;
  }
  function nivelAlvo() { return clamp(NM + Math.ceil(Math.log2(s * dpr) - 0.15), Math.min(LB, NM), NM); }
  function pedir(lista) {
    const ccx = cx, ccy = cy;
    const dist = ([L, x, y]) => { const k = 2 ** (NM - L) * TS; return Math.hypot((x + 0.5) * k - ccx, (y + 0.5) * k - ccy) / k; };
    // o nível de base primeiro (é o fundo de tudo e o mapa), depois do centro para fora
    const vistos = new Set();
    fila = lista.filter(t => { const k = chave(...t); if (vistos.has(k)) return false; vistos.add(k); return !cache.has(k) && !pendentes.has(k) && !vazios.has(k); })
      .sort((a, b) => (b[0] === LB ? 1 : 0) - (a[0] === LB ? 1 : 0) || dist(a) - dist(b));
    carregar();
  }
  function carregar() {
    while (!fechado && emVoo < 2 && fila.length) {
      const lote = fila.splice(0, 24); emVoo++;
      for (const t of lote) pendentes.add(chave(...t));
      Promise.all(lote.map(async (t) => {
        const k = chave(...t);
        try {
          const b = await slide.tile(...t);
          if (!b) { vazios.add(k); return; }
          const bmp = await createImageBitmap(b);
          if (fechado || cache.has(k)) { bmp.close?.(); return; }
          guardarTile(k, t[0], bmp);
        } catch (e) {
          vazios.add(k); falhas++;
          if (falhas === 3) mostrarAviso("Alguns pedaços da lâmina não abriram. O arquivo pode estar incompleto.");
        } finally { pendentes.delete(k); }
      })).finally(() => { emVoo--; sujo(); carregar(); });
    }
    carregando.hidden = !(emVoo || fila.length);
  }

  // ---------------------------------------------------------------- desenho
  let quadro = 0;
  function sujo() { if (!quadro && !fechado) quadro = requestAnimationFrame(desenhar); }
  const X = (ix) => Math.round(((ix - cx) * s + vw / 2) * dpr);
  const Y = (iy) => Math.round(((iy - cy) * s + vh / 2) * dpr);
  function porTile([L, x, y], bmp) {
    const k = 2 ** (NM - L);
    const lx = x * TS - (x ? OV : 0), ly = y * TS - (y ? OV : 0);
    const x0 = X(lx * k), y0 = Y(ly * k), x1 = X((lx + bmp.width) * k), y1 = Y((ly + bmp.height) * k);
    if (x1 > x0 && y1 > y0) ctx.drawImage(bmp, x0, y0, x1 - x0, y1 - y0);
  }
  function desenhar() {
    quadro = 0;
    if (fechado) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = s * dpr < 1 ? "high" : "medium";
    // a lâmina (vidro) em branco por baixo de tudo
    ctx.fillStyle = "#fff";
    ctx.fillRect(X(0), Y(0), X(W) - X(0), Y(H) - Y(0));
    const La = nivelAlvo();
    const alvo = visiveis(La);
    const faltam = alvo.filter(t => !cache.has(chave(...t)));
    if (faltam.length) {
      for (let L = Math.min(LB, La); L < La; L++) {
        const base = L === Math.min(LB, La);
        for (const t of visiveis(L)) { const b = base ? cache.get(chave(...t)) : usar(chave(...t)); if (b) porTile(t, b); }
      }
    }
    for (const t of alvo) { const b = usar(chave(...t)); if (b) porTile(t, b); }
    desenharDesenhos();
    // pede: o alvo visível, uma volta em torno, e o nível de base se ainda faltar
    const pedidos = [...faltam, ...visiveis(La, 1).filter(t => !cache.has(chave(...t)))];
    if (La > LB) for (const t of visiveis(LB)) if (!cache.has(chave(...t))) pedidos.push(t);
    if (!mapaPronto) { // o mapa precisa do nível de base inteiro (com a vista guardada, ele não está todo na tela)
      const [cols, lins] = tilesDoNivel(info, LB);
      for (let y = 0; y < lins; y++) for (let x = 0; x < cols; x++) if (!cache.has(chave(LB, x, y))) pedidos.push([LB, x, y]);
    }
    pedir(pedidos);
    posicionarMarcas();
    atualizarEscala();
    atualizarMapa();
  }

  // ---------------------------------------------------------------- mapa (a lâmina inteira, pelo nível de base)
  let mapaPronto = false;
  const MAPA_LADO = 132;
  const mapaW = W >= H ? MAPA_LADO : Math.round(MAPA_LADO * W / H), mapaH = W >= H ? Math.round(MAPA_LADO * H / W) : MAPA_LADO;
  mapaEl.style.width = `${mapaW}px`; mapaEl.style.height = `${mapaH}px`;
  function montarMapa() {
    const [cols, lins] = tilesDoNivel(info, LB);
    const todos = [];
    for (let y = 0; y < lins; y++) for (let x = 0; x < cols; x++) todos.push([LB, x, y]);
    if (!todos.every(t => cache.has(chave(...t)) || vazios.has(chave(...t)))) return false;
    const k = Math.min(2, devicePixelRatio || 1);
    mapaCv.width = Math.round(mapaW * k); mapaCv.height = Math.round(mapaH * k);
    const g = mapaCv.getContext("2d"), [lw] = tamanhoDoNivel(info, LB), e = mapaCv.width / lw;
    g.fillStyle = "#fff"; g.fillRect(0, 0, mapaCv.width, mapaCv.height);
    for (const t of todos) {
      const b = cache.get(chave(...t)); if (!b) continue;
      const lx = t[1] * TS - (t[1] ? OV : 0), ly = t[2] * TS - (t[2] ? OV : 0);
      g.drawImage(b, Math.round(lx * e), Math.round(ly * e), Math.ceil(b.width * e), Math.ceil(b.height * e));
    }
    return true;
  }
  function atualizarMapa() {
    if (!mapaPronto) mapaPronto = montarMapa();
    const x0 = (cx - vw / 2 / s) / W, x1 = (cx + vw / 2 / s) / W, y0 = (cy - vh / 2 / s) / H, y1 = (cy + vh / 2 / s) / H;
    const cl = (v) => clamp(v, 0, 1);
    mapaJan.style.left = `${cl(x0) * mapaW}px`; mapaJan.style.top = `${cl(y0) * mapaH}px`;
    mapaJan.style.width = `${Math.max(3, (cl(x1) - cl(x0)) * mapaW)}px`; mapaJan.style.height = `${Math.max(3, (cl(y1) - cl(y0)) * mapaH)}px`;
    mapaEl.classList.toggle("inteira", x0 <= 0.001 && y0 <= 0.001 && x1 >= 0.999 && y1 >= 0.999);
  }
  function irPeloMapa(e) {
    const r = mapaEl.getBoundingClientRect();
    cx = clamp((e.clientX - r.left) / r.width, 0, 1) * W; cy = clamp((e.clientY - r.top) / r.height, 0, 1) * H;
    limitar(); sujo();
  }
  mapaEl.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); try { mapaEl.setPointerCapture(e.pointerId); } catch { /* sem captura */ } parar(); irPeloMapa(e); });
  mapaEl.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "touch") { e.stopPropagation(); if (mapaEl.hasPointerCapture?.(e.pointerId)) irPeloMapa(e); } });

  // ---------------------------------------------------------------- régua e aumento
  const regua = $(".vm-regua"), reguaI = regua.querySelector("i"), reguaT = regua.querySelector("span"), aumEl = $(".vm-aum");
  function atualizarEscala() {
    if (!PPM) { regua.hidden = true; aumEl.textContent = ""; return; }
    const umPorPx = 1 / (PPM * s), ideal = 100 * umPorPx; // µm em 100 px da tela
    const p = 10 ** Math.floor(Math.log10(ideal));
    const v = [1, 2, 5, 10].map(m => m * p).reduce((a, b) => (Math.abs(Math.log(b / ideal)) < Math.abs(Math.log(a / ideal)) ? b : a));
    reguaI.style.width = `${Math.round(v / umPorPx)}px`;
    reguaT.textContent = v >= 1000 ? `${fmt(v / 1000, 1)} mm` : `${fmt(v, v < 1 ? 1 : 0)} µm`;
    const a = aumentoNaTela(PPM, s);
    aumEl.textContent = `≈ ${a < 2 ? fmt(a, 1) : fmt(Math.round(a))}×${s > 1.02 ? " (zoom digital)" : ""}`;
  }

  // ---------------------------------------------------------------- marcadores
  let marcando = false;
  function desenharMarcas() {
    marcasEl.innerHTML = "";
    R.marcadoresDe(uid).forEach((m, i) => {
      const b = document.createElement("button"); b.className = "vm-pino"; b.dataset.id = m.id; b.textContent = i + 1;
      b.title = m.texto || "";
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.onclick = (e) => { e.stopPropagation(); mostrarBalao(m.id); };
      marcasEl.append(b);
    });
    const n = R.marcadoresDe(uid).length;
    $(".vm-n").textContent = n ? n : "";
    posicionarMarcas();
  }
  function posicionarMarcas() {
    const lista = R.marcadoresDe(uid), por = new Map(lista.map(m => [m.id, m]));
    for (const b of marcasEl.children) {
      const m = por.get(b.dataset.id); if (!m) continue;
      const [px, py] = paraTela(m.x, m.y);
      const fora = px < -20 || py < -20 || px > vw + 20 || py > vh + 20;
      b.hidden = fora;
      if (!fora) b.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    }
  }
  async function novoMarcador(px, py) {
    const [ix, iy] = paraImg(px, py);
    if (ix < 0 || iy < 0 || ix > W || iy > H) return toast("Marque um ponto dentro da lâmina.");
    ligarMarcar(false);
    const r = await formulario({ titulo: "Nova marcação", campos: [{ id: "texto", rotulo: "O que é este ponto?", placeholder: "Ex.: fenda acima da camada basal", valor: "" }], botoes: [{ texto: "Marcar", acao: "ok" }] });
    if (!r) return;
    const m = R.marcar(uid, { x: ix, y: iy, texto: r.texto });
    desenharMarcas(); mostrarBalao(m.id);
  }
  function ligarMarcar(v) {
    marcando = v;
    if (v && desenhando) ligarDesenho(false);
    $('[data-a="marcar"]').classList.toggle("ativo", v);
    palco.classList.toggle("marcando", v);
    if (v) mostrarAviso("Toque no ponto que quer marcar.", 0); else esconderAviso();
  }
  function mostrarBalao(id) {
    const lista = R.marcadoresDe(uid), i = lista.findIndex(m => m.id === id), m = lista[i];
    if (!m) { balao.hidden = true; return; }
    balao.innerHTML = `<b>${i + 1}</b><p>${escapar(m.texto || "(sem texto)")}</p><button data-b="editar">Editar</button><button data-b="apagar">Apagar</button><button data-b="x" aria-label="Fechar">×</button>`;
    balao.hidden = false;
    balao.querySelector('[data-b="x"]').onclick = () => (balao.hidden = true);
    balao.querySelector('[data-b="editar"]').onclick = async () => {
      const r = await formulario({ titulo: `Marcação ${i + 1}`, campos: [{ id: "texto", rotulo: "Texto", valor: m.texto || "" }] });
      if (r) { R.editarMarcador(uid, id, r.texto); desenharMarcas(); mostrarBalao(id); }
    };
    balao.querySelector('[data-b="apagar"]').onclick = () => { R.apagarMarcador(uid, id); balao.hidden = true; desenharMarcas(); if (!folha.hidden && folha.dataset.f === "lista") abrirLista(); };
  }
  // ---------------------------------------------------------------- desenhos (caneta e setas)
  // Como a caneta das lições (ferramentasLicao.js): caneta e mouse desenham; o dedo desenha até o app ver uma caneta
  // (orbita.viuCaneta) e depois move a lâmina, a não ser que ✋ diga o contrário (orbita.dedoDesenha, as mesmas chaves).
  // Dois dedos sempre aproximam. Os pontos ficam em pixels da imagem cheia (registro.js), a linha tem largura fixa na tela.
  let desenhando = false, ferramenta = "traco", corI = 0, atual = null;
  const feitos = []; // ids desenhados nesta vez (Desfazer)
  const lsLer = (k, p) => { try { const v = localStorage.getItem(k); return v == null ? p : JSON.parse(v); } catch { return p; } };
  const lsGravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
  const viuCaneta = () => lsLer("orbita.viuCaneta", false);
  const dedoDesenha = () => { const v = lsLer("orbita.dedoDesenha", null); return v == null ? !viuCaneta() : v; };
  const ferr = $(".vm-ferr");
  function pintarFerr() {
    ferr.querySelectorAll("[data-f=traco],[data-f=seta],[data-f=borracha]").forEach(b => b.classList.toggle("ativo", b.dataset.f === ferramenta));
    ferr.querySelectorAll(".vm-cor").forEach(b => b.classList.toggle("ativo", +b.dataset.cor === corI && ferramenta !== "borracha"));
    ferr.querySelector("[data-f=dedo]").classList.toggle("ativo", dedoDesenha());
  }
  function ligarDesenho(v) {
    desenhando = v; atual = null;
    if (v && marcando) ligarMarcar(false);
    $('[data-a="desenhar"]').classList.toggle("ativo", v);
    palco.classList.toggle("desenhando", v);
    ferr.hidden = !v; balao.hidden = true;
    if (v) { pintarFerr(); mostrarAviso(dedoDesenha() ? "Desenhe com o dedo ou a caneta. Dois dedos aproximam." : "Desenhe com a caneta. O dedo move a lâmina.", 2600); }
    sujo();
  }
  ferr.addEventListener("pointerdown", (e) => e.stopPropagation());
  ferr.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.cor != null) { corI = +b.dataset.cor; if (ferramenta === "borracha") ferramenta = "traco"; }
    else if (["traco", "seta", "borracha"].includes(b.dataset.f)) ferramenta = b.dataset.f;
    else if (b.dataset.f === "dedo") { lsGravar("orbita.dedoDesenha", !dedoDesenha()); mostrarAviso(dedoDesenha() ? "O dedo desenha." : "O dedo move a lâmina.", 1800); }
    else if (b.dataset.f === "desfazer") {
      const id = feitos.pop();
      if (id && R.desenhosDe(uid).some(d => d.id === id)) R.apagarDesenho(uid, id); else toast("Nada para desfazer.");
      sujo();
    } else if (b.dataset.f === "limpar") {
      if (!R.desenhosDe(uid).length) return toast("Não há desenhos nesta lâmina.");
      const ok = await modal({ titulo: "Apagar todos os desenhos?", texto: "As setas e os traços desta lâmina saem nos dois aparelhos.", botoes: [{ texto: "Apagar todos", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] });
      if (ok) { R.limparDesenhos(uid); feitos.length = 0; sujo(); }
    }
    pintarFerr();
  });
  const podeDesenhar = (e) => desenhando && (e.pointerType === "pen" || e.pointerType === "mouse" || (e.pointerType === "touch" && dedoDesenha()));
  function apagarNoPonto(px, py) {
    const lista = R.desenhosDe(uid);
    for (let k = lista.length - 1; k >= 0; k--) {
      const d = lista[k], p = d.pts;
      for (let i = 0; i + 1 < p.length; i += 2) {
        const [ax, ay] = paraTela(p[i], p[i + 1]), [bx, by] = i + 3 < p.length ? paraTela(p[i + 2], p[i + 3]) : [ax, ay];
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const t = L2 ? clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1) : 0;
        if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < 14) { R.apagarDesenho(uid, d.id); sujo(); return true; }
      }
    }
    return false;
  }
  function comecarDesenho(e, p) {
    if (e.pointerType === "pen" && !viuCaneta()) { lsGravar("orbita.viuCaneta", true); pintarFerr(); }
    atual = { id: e.pointerId, tipo: ferramenta, cor: CORES[corI][0], pts: [...paraImg(p[0], p[1])], tela: p };
    if (ferramenta === "borracha") apagarNoPonto(p[0], p[1]);
  }
  function moverDesenho(p) {
    if (atual.tipo === "borracha") { apagarNoPonto(p[0], p[1]); return; }
    if (Math.hypot(p[0] - atual.tela[0], p[1] - atual.tela[1]) < 2) return;
    atual.tela = p;
    const [ix, iy] = paraImg(p[0], p[1]);
    if (atual.tipo === "seta") atual.pts = [atual.pts[0], atual.pts[1], ix, iy];
    else if (atual.pts.length < 4000) atual.pts.push(ix, iy);
    sujo();
  }
  function terminarDesenho() {
    const a = atual; atual = null;
    if (!a || a.tipo === "borracha") return sujo();
    const [x0, y0] = paraTela(a.pts[0], a.pts[1]), [x1, y1] = paraTela(a.pts[a.pts.length - 2], a.pts[a.pts.length - 1]);
    if (a.tipo === "seta" && Math.hypot(x1 - x0, y1 - y0) < 12) { toast("Arraste da ponta de trás até onde a seta aponta."); return sujo(); }
    if (a.tipo === "traco" && a.pts.length === 2) a.pts.push(a.pts[0] + 0.5 / s, a.pts[1]); // um toque vira um ponto
    const d = R.guardarDesenho(uid, a, 0.8 / s); // tolerância de ~1 px da tela no zoom em que foi feito
    if (!d) toast(`Esta lâmina já tem ${R.MAX_DESENHOS} desenhos. Apague alguns.`); else feitos.push(d.id);
    sujo();
  }
  function tracarCaminho(pts) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) { const x = ((pts[i] - cx) * s + vw / 2) * dpr, y = ((pts[i + 1] - cy) * s + vh / 2) * dpr; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  }
  function porDesenho(d) {
    const p = d.pts; if (!p || p.length < 4) return;
    const lw = 3 * dpr;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    let ponta = null;
    if (d.tipo === "seta") {
      const x0 = ((p[0] - cx) * s + vw / 2) * dpr, y0 = ((p[1] - cy) * s + vh / 2) * dpr, x1 = ((p[2] - cx) * s + vw / 2) * dpr, y1 = ((p[3] - cy) * s + vh / 2) * dpr;
      const ang = Math.atan2(y1 - y0, x1 - x0), t = 15 * dpr;
      ponta = [[x1, y1], [x1 - t * Math.cos(ang - 0.45), y1 - t * Math.sin(ang - 0.45)], [x1 - t * Math.cos(ang + 0.45), y1 - t * Math.sin(ang + 0.45)]];
      const recuo = Math.min(t * 0.7, Math.hypot(x1 - x0, y1 - y0));
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - recuo * Math.cos(ang), y1 - recuo * Math.sin(ang));
    } else tracarCaminho(p);
    const contorno = d.cor === CORES[0][0] ? "rgba(255,255,255,.75)" : "rgba(0,0,0,.45)";
    ctx.strokeStyle = contorno; ctx.lineWidth = lw + 2.5 * dpr; ctx.stroke();
    ctx.strokeStyle = d.cor; ctx.lineWidth = lw; ctx.stroke();
    if (ponta) {
      ctx.beginPath(); ctx.moveTo(...ponta[0]); ctx.lineTo(...ponta[1]); ctx.lineTo(...ponta[2]); ctx.closePath();
      ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = contorno; ctx.stroke(); ctx.fillStyle = d.cor; ctx.fill();
    }
  }
  function desenharDesenhos() {
    for (const d of R.desenhosDe(uid)) porDesenho(d);
    if (atual && atual.tipo !== "borracha" && atual.pts.length >= 4) porDesenho(atual);
  }

  function irPara(ix, iy, sNovo = s) { animar({ cx: ix, cy: iy, s: sNovo }); }

  // ---------------------------------------------------------------- avisos
  let avisoT = 0;
  function mostrarAviso(t, ms = 3500) { aviso.textContent = t; aviso.hidden = false; clearTimeout(avisoT); if (ms) avisoT = setTimeout(esconderAviso, ms); }
  function esconderAviso() { aviso.hidden = true; }

  // ---------------------------------------------------------------- animação e inércia
  let anim = 0;
  function parar() { cancelAnimationFrame(anim); anim = 0; }
  function animar(alvo, ms = 260) {
    parar();
    const a = { cx, cy, s }, t0 = performance.now();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) ms = 1;
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / ms), e = 1 - (1 - p) ** 3;
      s = Math.exp(Math.log(a.s) + (Math.log(alvo.s) - Math.log(a.s)) * e);
      cx = a.cx + (alvo.cx - a.cx) * e; cy = a.cy + (alvo.cy - a.cy) * e;
      limitar(); sujo();
      anim = p < 1 ? requestAnimationFrame(passo) : 0;
    };
    anim = requestAnimationFrame(passo);
  }
  function zoomEm(px, py, f, animado = false) {
    const [ix, iy] = paraImg(px, py);
    const s2 = clamp(s * f, sMin(), sMax);
    const ncx = ix - (px - vw / 2) / s2, ncy = iy - (py - vh / 2) / s2;
    if (animado) animar({ cx: ncx, cy: ncy, s: s2 }); else { s = s2; cx = ncx; cy = ncy; limitar(); sujo(); }
  }
  function inteira() { animar({ cx: W / 2, cy: H / 2, s: sFit }); }

  // ---------------------------------------------------------------- gestos
  const ptrs = new Map();
  let pinca = null, toque = null, ultimoToque = null, vel = [0, 0], ultMov = null;
  const local = (e) => { const r = palco.getBoundingClientRect(), k = palco.offsetWidth ? r.width / palco.offsetWidth : 1; return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; };
  palco.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    parar(); balao.hidden = true;
    try { palco.setPointerCapture(e.pointerId); } catch { /* ponteiro sintético ou já solto */ }
    const p = local(e);
    if (!atual && !ptrs.size && podeDesenhar(e)) { comecarDesenho(e, p); return; }
    if (atual && e.pointerType === "touch" && atual.id !== e.pointerId) { // o 2º dedo: desiste do traço e vira pinça
      const t = atual.tela; ptrs.set(atual.id, t); atual = null; sujo();
    } else if (atual) return;
    ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) { toque = { x: p[0], y: p[1], t: performance.now(), moveu: false }; ultMov = { p, t: performance.now() }; vel = [0, 0]; }
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s0: s, img: paraImg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
      toque = null;
    }
  });
  palco.addEventListener("pointermove", (e) => {
    if (atual && atual.id === e.pointerId) { moverDesenho(local(e)); return; }
    if (!ptrs.has(e.pointerId)) return;
    const p = local(e), ant = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, p);
    if (ptrs.size >= 2 && pinca) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      s = clamp(pinca.s0 * d / pinca.d, sMin(), sMax);
      cx = pinca.img[0] - (mx - vw / 2) / s; cy = pinca.img[1] - (my - vh / 2) / s;
      limitar(); sujo();
      return;
    }
    if (ptrs.size === 1) {
      const dx = p[0] - ant[0], dy = p[1] - ant[1];
      if (toque && Math.hypot(p[0] - toque.x, p[1] - toque.y) > 8) toque.moveu = true;
      if (toque && !toque.moveu) return;
      cx -= dx / s; cy -= dy / s; limitar(); sujo();
      const t = performance.now(), dt = Math.max(1, t - ultMov.t);
      vel = [0.8 * (p[0] - ultMov.p[0]) / dt + 0.2 * vel[0], 0.8 * (p[1] - ultMov.p[1]) / dt + 0.2 * vel[1]];
      ultMov = { p, t };
    }
  });
  function soltar(e) {
    if (atual && atual.id === e.pointerId) { if (e.type === "pointercancel") { atual = null; sujo(); } else terminarDesenho(); return; }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1 && pinca) { // da pinça para um dedo: continua arrastando de onde está
      pinca = null; const p = [...ptrs.values()][0]; toque = { x: p[0], y: p[1], t: 0, moveu: true }; ultMov = { p, t: performance.now() }; vel = [0, 0];
      return;
    }
    if (ptrs.size) return;
    pinca = null;
    if (e.type === "pointercancel") { toque = null; return; }
    const p = local(e), agora = performance.now();
    if (toque && !toque.moveu && agora - toque.t < 400) {
      if (marcando) { novoMarcador(p[0], p[1]); toque = null; return; }
      if (ultimoToque && agora - ultimoToque.t < 320 && Math.hypot(p[0] - ultimoToque.x, p[1] - ultimoToque.y) < 30) {
        ultimoToque = null; zoomEm(p[0], p[1], 2, true);
      } else ultimoToque = { x: p[0], y: p[1], t: agora };
    } else if (toque?.moveu && agora - (ultMov?.t || 0) < 80 && Math.hypot(...vel) > 0.25 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let [vx, vy] = vel, t0 = agora; // inércia
      const passo = (t) => {
        const dt = t - t0; t0 = t;
        cx -= vx * dt / s; cy -= vy * dt / s; limitar(); sujo();
        vx *= Math.pow(0.94, dt / 16); vy *= Math.pow(0.94, dt / 16);
        anim = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(passo) : 0;
      };
      anim = requestAnimationFrame(passo);
    }
    toque = null;
  }
  palco.addEventListener("pointerup", soltar);
  palco.addEventListener("pointercancel", soltar);
  palco.addEventListener("wheel", (e) => {
    e.preventDefault(); parar();
    const [px, py] = local(e);
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoomEm(px, py, Math.exp(-clamp(d, -300, 300) * 0.0018));
  }, { passive: false });
  palco.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------------------------------------------------------------- barra
  ov.querySelector(".vm-barra").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const a = b.dataset.a;
    if (a === "inteira") inteira();
    else if (a === "mais") zoomEm(vw / 2, vh / 2, 2, true);
    else if (a === "menos") zoomEm(vw / 2, vh / 2, 0.5, true);
    else if (a === "marcar") ligarMarcar(!marcando);
    else if (a === "lista") (folha.hidden || folha.dataset.f !== "lista" ? abrirLista() : fecharFolha());
    else if (a === "desenhar") ligarDesenho(!desenhando);
  });

  // ---------------------------------------------------------------- folhas (marcações e informações)
  function fecharFolha() { folha.hidden = true; folha.innerHTML = ""; folha.dataset.f = ""; folha.oninput = null; }
  for (const el of [balao, folha]) el.addEventListener("pointerdown", (e) => e.stopPropagation());
  function abrirLista() {
    const lista = R.marcadoresDe(uid);
    folha.dataset.f = "lista"; folha.hidden = false;
    folha.innerHTML = `<div class="vm-f-cab"><b>Marcações</b><button class="vm-f-x" aria-label="Fechar">×</button></div>
      ${lista.length ? `<ol class="vm-lista">${lista.map((m, i) => `<li data-id="${m.id}"><span class="vm-l-n">${i + 1}</span><span class="vm-l-t">${escapar(m.texto || "(sem texto)")}</span><button data-l="ir">Ir</button><button data-l="apagar" aria-label="Apagar">×</button></li>`).join("")}</ol>`
        : `<p class="vm-vazio">Nenhuma marcação ainda. Toque em <b>Marcar</b> e depois no ponto da lâmina.</p>`}`;
    folha.querySelector(".vm-f-x").onclick = fecharFolha;
    folha.querySelectorAll(".vm-lista li").forEach(li => {
      const m = lista.find(x => x.id === li.dataset.id);
      li.querySelector('[data-l="ir"]').onclick = () => { fecharFolha(); irPara(m.x, m.y, Math.max(s, Math.min(1, sFit * 8))); mostrarBalao(m.id); };
      li.querySelector('[data-l="apagar"]').onclick = async () => {
        const ok = await modal({ titulo: "Apagar a marcação?", texto: m.texto || "", botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] });
        if (ok) { R.apagarMarcador(uid, m.id); desenharMarcas(); abrirLista(); }
      };
    });
  }
  function abrirInfo() {
    const d = R.dadosDe(uid) || {};
    const opcoes = (l) => l.map(x => `<option value="${escapar(x.id)}" ${d.lesao === x.id ? "selected" : ""}>${escapar(x.nome)}</option>`).join("");
    const conhecida = [...(D?.lesoes || []), ...(D?.parecidas || [])].some(x => x.id === d.lesao);
    const livre = d.lesao && !conhecida;
    const umPx = PPM ? 1 / PPM : null;
    const data = info.data ? new Date(info.data) : null;
    folha.dataset.f = "info"; folha.hidden = false;
    folha.innerHTML = `<div class="vm-f-cab"><b>Sobre a lâmina</b><button class="vm-f-x" aria-label="Fechar">×</button></div>
      <label class="vm-campo"><span>Nome</span><input name="nome" maxlength="80" value="${escapar(d.nome || "")}" placeholder="${escapar((item ? tituloDe(item) : "") || info.nome || "Lâmina")}"></label>
      <label class="vm-campo"><span>Lesão</span><select name="lesao">
        <option value="">Nenhuma</option>
        ${D?.lesoes?.length ? `<optgroup label="Da prova prática">${opcoes(D.lesoes)}</optgroup>` : ""}
        ${D?.parecidas?.length ? `<optgroup label="Parecidas">${opcoes(D.parecidas)}</optgroup>` : ""}
        <option value="__outra" ${livre ? "selected" : ""}>Outra (escrever)</option></select></label>
      <label class="vm-campo" data-outra ${livre ? "" : "hidden"}><span>Qual lesão?</span><input name="outra" maxlength="80" value="${escapar(livre ? d.lesao : "")}" placeholder="Ex.: Pênfigo vulgar"></label>
      <label class="vm-campo"><span>Anotações</span><textarea name="notas" rows="3" maxlength="2000" placeholder="O que ver nesta lâmina, o que o professor falou…">${escapar(d.notas || "")}</textarea></label>
      <p class="vm-sinc">O nome, a lesão, as anotações e as marcações vão para o outro aparelho; o arquivo fica só aqui.</p>
      <dl class="vm-dados">
        ${info.nome ? `<dt>Nome no arquivo</dt><dd>${escapar(info.nome)}</dd>` : ""}
        ${data && !isNaN(data) ? `<dt>Escaneada em</dt><dd>${data.toLocaleDateString("pt-BR")}</dd>` : ""}
        <dt>Tamanho</dt><dd>${fmt(W)} × ${fmt(H)} pixels${PPM ? ` · ${fmt(W / PPM / 1000, 1)} × ${fmt(H / PPM / 1000, 1)} mm` : ""}</dd>
        ${umPx ? `<dt>Resolução</dt><dd>${fmt(umPx, 3)} µm por pixel (≈ ${fmt(Math.round(aumentoNaTela(PPM, 1)))}× sem zoom digital)</dd>` : ""}
        ${info.objetiva || info.aumentoObjetiva ? `<dt>Objetiva do escâner</dt><dd>${escapar(info.objetiva || `${info.aumentoObjetiva}×`)}${info.tubo ? ` · lente do tubo ${fmt(info.tubo, 2)}×` : ""}</dd>` : ""}
        ${item ? `<dt>Arquivo</dt><dd>${escapar(item.caminho || item.nome)} · ${fmt(item.tamanho / 1048576, 0)} MB</dd>` : ""}
      </dl>
      <figure class="vm-overview"><img alt="A lâmina inteira com a etiqueta"><figcaption>A lâmina inteira, como saiu do escâner (o retângulo vermelho é a parte escaneada).</figcaption></figure>`;
    folha.querySelector(".vm-f-x").onclick = fecharFolha;
    slide.overview().then(b => { if (b && folha.dataset.f === "info") { const u = URL.createObjectURL(b); const img = folha.querySelector(".vm-overview img"); img.onload = () => URL.revokeObjectURL(u); img.src = u; } else folha.querySelector(".vm-overview")?.remove(); }).catch(() => folha.querySelector(".vm-overview")?.remove());
    const sel = folha.querySelector('[name="lesao"]'), outra = folha.querySelector("[data-outra]");
    let t = 0;
    const gravar = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const v = sel.value === "__outra" ? folha.querySelector('[name="outra"]').value.trim() : sel.value;
        R.mudar(uid, { nome: folha.querySelector('[name="nome"]').value.trim(), lesao: v, notas: folha.querySelector('[name="notas"]').value.trim() });
        titulo();
      }, 350);
    };
    sel.onchange = () => { outra.hidden = sel.value !== "__outra"; if (!outra.hidden) outra.querySelector("input").focus(); gravar(); };
    folha.oninput = gravar;
  }
  $(".vm-info").onclick = $(".vm-titulo").onclick = () => (folha.dataset.f === "info" ? fecharFolha() : abrirInfo());

  function titulo() {
    const d = R.dadosDe(uid) || {};
    $(".vm-titulo b").textContent = d.nome || (item ? tituloDe(item) : "") || info.nome || "Lâmina";
    $(".vm-titulo small").textContent = d.lesao ? nomeLesao(D, d.lesao) : "Toque para dar o nome e a lesão";
  }

  // ---------------------------------------------------------------- abrir e fechar
  function teclas(e) {
    if (e.target.closest?.("input, textarea, select")) return;
    if (e.key === "Escape") { if (!folha.hidden) fecharFolha(); else if (marcando) ligarMarcar(false); else if (desenhando) ligarDesenho(false); else fechar(); }
    else if (e.key === "+" || e.key === "=") zoomEm(vw / 2, vh / 2, 1.6, true);
    else if (e.key === "-") zoomEm(vw / 2, vh / 2, 1 / 1.6, true);
    else if (e.key.startsWith("Arrow")) { const d = 120 / s; if (e.key === "ArrowLeft") cx -= d; if (e.key === "ArrowRight") cx += d; if (e.key === "ArrowUp") cy -= d; if (e.key === "ArrowDown") cy += d; limitar(); sujo(); }
    else return;
    e.preventDefault();
  }
  document.addEventListener("keydown", teclas);
  const obs = new ResizeObserver(() => { const eraFit = Math.abs(s - sFit) / sFit < 0.02; medir(); if (eraFit) s = sFit; limitar(); sujo(); });
  function fechar() {
    if (fechado) return;
    fechado = true; parar(); cancelAnimationFrame(quadro);
    gravarLS(CH_VISTA + uid, { cx: Math.round(cx), cy: Math.round(cy), s: +s.toFixed(5) });
    document.removeEventListener("keydown", teclas); obs.disconnect();
    for (const b of cache.values()) b.close?.();
    cache.clear(); ov.remove();
    aoFechar?.();
  }
  $(".vm-fechar").onclick = fechar;
  $(".vm-mapa-bt").onclick = (e) => { const b = e.currentTarget; b.classList.toggle("ativo"); mapaEl.hidden = !b.classList.contains("ativo"); };

  medir();
  const v = vista || lerLS(CH_VISTA + uid);
  if (v && v.s > 0) { cx = v.cx; cy = v.cy; s = v.s; } else s = sFit;
  limitar();
  obs.observe(palco);
  titulo(); desenharMarcas(); sujo();
  // a API serve aos testes (e ao Treino, para ir a um ponto)
  const api = {
    fechar, uid,
    get vista() { return { cx, cy, s, sFit, nivel: nivelAlvo(), base: LB, tiles: cache.size, pendentes: pendentes.size + fila.length } },
    zoomEm, inteira, irPara, marcarEm: novoMarcador, ligarMarcar, ligarDesenho, abrirInfo, abrirLista, fecharFolha, paraTela,
    pronto: async (ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 60)); if (!emVoo && !fila.length && !quadro) return true; } return false; },
  };
  ov._visor = api;
  return api;
}
