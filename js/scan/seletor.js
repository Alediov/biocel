// Menus de seleção no estilo do app (pedido do Alediov, 24/10/2026: o pop-up nativo do Android destoava).
// Um só ouvinte no documento intercepta o toque, o clique e o teclado de QUALQUER <select> (do OdontoLearn, do
// OdontoScan e do OdontoScan.html do notebook) e abre uma folha própria: no celular, de baixo para cima; em tela
// larga com mouse, um menu logo abaixo do campo. A escolha muda o valor e dispara "input" e "change", então o
// código que já ouvia o select continua igual. Mora em scan/ para entrar também no OdontoScan.html.
let ligado = false, aberto = null;

export function ligarSeletores() {
  if (ligado || typeof document === "undefined") return;
  ligado = true;
  estilo();
  const alvo = (e) => {
    const s = e.target?.closest?.("select");
    return s && !s.multiple && !s.disabled && !(s.size > 1) && !s.dataset.nativo ? s : null;
  };
  let toque = null;
  document.addEventListener("touchstart", (e) => {
    const s = alvo(e);
    toque = s ? { s, x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { capture: true, passive: true });
  document.addEventListener("touchend", (e) => {
    const s = alvo(e);
    if (!s || toque?.s !== s) return;
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - toque.x, t.clientY - toque.y) > 10) return; // foi rolagem, não toque
    e.preventDefault();
    abrir(s, "toque");
  }, { capture: true, passive: false });
  document.addEventListener("mousedown", (e) => {
    const s = alvo(e);
    if (!s || e.button !== 0) return;
    e.preventDefault();
    abrir(s, "mouse");
  }, true);
  document.addEventListener("click", (e) => { if (alvo(e)) e.preventDefault(); }, true);
  document.addEventListener("keydown", (e) => {
    const s = alvo(e);
    if (s && (e.key === " " || e.key === "Enter" || e.key === "F4" || (e.altKey && /^Arrow(Down|Up)$/.test(e.key)))) { e.preventDefault(); abrir(s, "teclado"); }
  }, true);
}

function rotuloDe(s) {
  const direto = s.getAttribute("aria-label") || s.title || (s.id && document.querySelector(`label[for="${CSS.escape(s.id)}"]`)?.textContent);
  if (direto) return direto.trim();
  const lab = s.closest("label");
  if (lab) {
    const c = lab.cloneNode(true);
    c.querySelectorAll("select, input, textarea, button, small, .dica").forEach(x => x.remove());
    const t = c.textContent.replace(/\s+/g, " ").trim();
    if (t && t.length <= 60) return t;
  }
  const ant = s.previousElementSibling;
  const t = ant && !ant.matches("select, input, textarea") ? ant.textContent.replace(/\s+/g, " ").trim() : "";
  return t.length <= 60 ? t : "";
}

// cores do lugar de onde veio o select: as do OdontoScan dentro dele, as do app no resto
function cores(s) {
  const cs = getComputedStyle(s), v = (n) => cs.getPropertyValue(n).trim();
  const os = !!v("--os-sup");
  const par = os
    ? { sup: v("--os-sup"), sup2: v("--os-sup2"), tinta: v("--os-tinta"), tinta2: v("--os-tinta2"), linha: v("--os-linha"), acento: v("--os-acento"), suave: v("--os-acento-suave"), texto: v("--os-acento") }
    : { sup: v("--superficie"), sup2: v("--superficie-2"), tinta: v("--tinta"), tinta2: v("--tinta-2"), linha: v("--linha"), acento: v("--acento"), suave: v("--acento-suave"), texto: v("--acento-texto") };
  const padrao = { sup: "#fff", sup2: "#eef1f6", tinta: "#1b2340", tinta2: "#5a6386", linha: "#dde2ee", acento: "#2f6bff", suave: "#e4ecff", texto: "#1c4bc4" };
  let css = `font-family:${cs.fontFamily};`;
  for (const k of Object.keys(padrao)) css += `--s-${k}:${par[k] || padrao[k]};`;
  return css;
}

function abrir(s, modo) {
  if (aberto) { if (aberto.s === s) return; fechar(); }
  const largo = modo !== "toque" && matchMedia("(min-width: 700px)").matches;
  const fundo = document.createElement("div");
  fundo.className = `sel-fundo ${largo ? "ancorado" : ""}`;
  const folha = document.createElement("div");
  folha.className = "sel-folha"; folha.setAttribute("role", "listbox");
  folha.style.cssText = cores(s);
  const titulo = rotuloDe(s);
  if (!largo) folha.innerHTML = `<div class="sel-alca"></div>`;
  if (titulo && !largo) { const h = document.createElement("div"); h.className = "sel-titulo"; h.textContent = titulo; folha.append(h); }
  const lista = document.createElement("div"); lista.className = "sel-lista";
  const botoes = [];
  const opcao = (o) => {
    if (o.hidden) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "sel-op"; b.setAttribute("role", "option");
    const sel = o.index === s.selectedIndex;
    if (sel) { b.classList.add("sel"); b.setAttribute("aria-selected", "true"); }
    b.disabled = o.disabled;
    b.innerHTML = `<span></span><i aria-hidden="true">${sel ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ""}</i>`;
    b.firstChild.textContent = o.label || o.textContent;
    b.onclick = () => escolher(s, o.index);
    lista.append(b); botoes.push(b);
  };
  for (const el of s.children) {
    if (el.tagName === "OPTGROUP") {
      const g = document.createElement("div"); g.className = "sel-grupo"; g.textContent = el.label; lista.append(g);
      for (const o of el.children) opcao(o);
    } else if (el.tagName === "OPTION") opcao(el);
  }
  folha.append(lista); fundo.append(folha);
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });
  fundo.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); fechar(true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const ativos = botoes.filter(b => !b.disabled), i = ativos.indexOf(document.activeElement);
      const j = e.key === "Home" ? 0 : e.key === "End" ? ativos.length - 1 : Math.max(0, Math.min(ativos.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
      ativos[j]?.focus();
    }
  });
  document.body.append(fundo);
  if (largo) {
    const r = s.getBoundingClientRect(), alt = Math.min(360, innerHeight * 0.6);
    const abaixo = innerHeight - r.bottom - 12 >= Math.min(alt, folha.scrollHeight) || r.top < innerHeight / 2;
    folha.style.left = `${Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, 220) - 8))}px`;
    folha.style.width = `${Math.max(r.width, 220)}px`;
    folha.style.maxHeight = `${Math.max(140, abaixo ? innerHeight - r.bottom - 14 : r.top - 14)}px`;
    if (abaixo) folha.style.top = `${r.bottom + 6}px`; else folha.style.bottom = `${innerHeight - r.top + 6}px`;
  }
  aberto = { s, fundo };
  const atual = lista.querySelector(".sel");
  requestAnimationFrame(() => {
    fundo.classList.add("aberto");
    atual?.scrollIntoView({ block: "center" });
    (atual && !atual.disabled ? atual : botoes.find(b => !b.disabled))?.focus({ preventScroll: true });
  });
}

function escolher(s, i) {
  const mudou = s.selectedIndex !== i;
  fechar(true);
  if (!mudou) return;
  s.selectedIndex = i;
  s.dispatchEvent(new Event("input", { bubbles: true }));
  s.dispatchEvent(new Event("change", { bubbles: true }));
}

function fechar(focar = false) {
  if (!aberto) return;
  const { s, fundo } = aberto;
  aberto = null;
  fundo.classList.remove("aberto"); fundo.classList.add("saindo");
  setTimeout(() => fundo.remove(), 200);
  if (focar && !matchMedia("(pointer: coarse)").matches) s.focus({ preventScroll: true });
}

function estilo() {
  if (document.getElementById("sel-estilo")) return;
  const st = document.createElement("style");
  st.id = "sel-estilo";
  st.textContent = `
.sel-fundo { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0); transition: background .2s; display: flex; align-items: flex-end; justify-content: center; }
.sel-fundo.aberto { background: rgba(0,0,0,.5); }
.sel-fundo.ancorado, .sel-fundo.ancorado.aberto { background: transparent; display: block; }
.sel-folha { width: 100%; max-width: 560px; max-height: min(72vh, 620px); display: flex; flex-direction: column; background: var(--s-sup); color: var(--s-tinta);
  border-radius: 24px 24px 0 0; border: 1px solid var(--s-linha); border-bottom: 0; padding: 6px 12px calc(12px + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 40px rgba(0,0,0,.35); transform: translateY(100%); transition: transform .24s cubic-bezier(.2,.8,.2,1); }
.sel-fundo.aberto .sel-folha { transform: none; }
.sel-fundo.ancorado .sel-folha { position: fixed; max-width: none; border-radius: 16px; border-bottom: 1px solid var(--s-linha); padding: 6px;
  box-shadow: 0 12px 36px rgba(0,0,0,.28); transform: translateY(-6px); opacity: 0; transition: transform .16s, opacity .16s; }
.sel-fundo.ancorado.aberto .sel-folha { transform: none; opacity: 1; }
.sel-alca { width: 40px; height: 5px; border-radius: 3px; background: var(--s-linha); margin: 4px auto 10px; flex: none; }
.sel-titulo { font-weight: 700; font-size: 15px; color: var(--s-tinta2); padding: 0 8px 10px; flex: none; }
.sel-lista { overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 4px; }
.sel-grupo { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--s-tinta2); padding: 10px 10px 2px; }
.sel-op { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 50px; padding: 12px 14px; border: 0; border-radius: 14px; background: transparent;
  color: inherit; font: inherit; font-size: 16px; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.sel-fundo.ancorado .sel-op { min-height: 40px; padding: 9px 12px; font-size: 15px; border-radius: 10px; }
.sel-op span { flex: 1; }
.sel-op i { width: 22px; height: 22px; flex: none; color: var(--s-texto); }
.sel-op i svg { width: 22px; height: 22px; display: block; }
@media (hover: hover) { .sel-op:hover { background: var(--s-sup2); } }
.sel-op:focus-visible { background: var(--s-sup2); outline: none; }
.sel-op:active { background: var(--s-sup2); }
.sel-op.sel { background: var(--s-suave); color: var(--s-texto); font-weight: 700; }
.sel-op:disabled { opacity: .45; cursor: default; }
@media (prefers-reduced-motion: reduce) { .sel-fundo, .sel-folha { transition: none !important; } }
`;
  document.head.append(st);
}
