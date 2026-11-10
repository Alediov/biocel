// Movimento da interface: transição entre telas, números que contam, ícones de XP, moedas e
// gemas voando até o contador do topo, e utilidades para as comemorações.
// Respeita "reduzir movimento" do sistema (aí só troca os números, sem voo).
const reduzido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- último toque: de onde os ganhos saem voando ----------
let ultimoToque = { x: innerWidth / 2, y: innerHeight * 0.6, t: 0 };
document.addEventListener("pointerdown", (e) => { ultimoToque = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);

// ---------- números que contam ----------
const tweens = new WeakMap();
/** Anima o texto de `el` do valor mostrado até `novo`. */
export function contarNumero(el, novo, { ms = 650, prefixo = "", sufixo = "", atraso = 0 } = {}) {
  if (!el) return;
  const atual = parseInt(String(el.dataset.valor ?? el.textContent).replace(/\D/g, ""), 10);
  const de = Number.isFinite(atual) ? atual : 0;
  el.dataset.valor = novo;
  cancelAnimationFrame(tweens.get(el));
  if (reduzido() || de === novo) { el.textContent = `${prefixo}${novo}${sufixo}`; return; }
  const ini = performance.now() + atraso;
  const passo = (agora) => {
    const p = Math.min(1, Math.max(0, (agora - ini) / ms)), e = 1 - (1 - p) ** 3;
    el.textContent = `${prefixo}${Math.round(de + (novo - de) * e)}${sufixo}`;
    if (p < 1) tweens.set(el, requestAnimationFrame(passo));
  };
  tweens.set(el, requestAnimationFrame(passo));
}

// ---------- voo até o topo ----------
const ICONES = {
  xp: `<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#F2A922" stroke="#1B2340" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  moedas: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#F2B33D" stroke="#1B2340" stroke-width="1.6"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff" stroke-width="1.4" opacity=".7"/></svg>`,
  gemas: `<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#4FD1E8" stroke="#1B2340" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};
/** Faz `n` ícones voarem de `origem` (ou do último toque) até o chip `alvo`. Resolve na chegada do primeiro. */
export function voarAte(tipo, alvo, quantidade, origem = null) {
  return new Promise((ok) => {
    if (!alvo || reduzido()) return ok();
    const fim = alvo.getBoundingClientRect();
    if (!fim.width) return ok();
    const o = origem || (Date.now() - ultimoToque.t < 5000 ? ultimoToque : { x: innerWidth / 2, y: innerHeight * 0.6 });
    const n = Math.max(1, Math.min(8, Math.ceil(Math.log2(quantidade + 1) * 1.6)));
    const fx = fim.left + fim.width * 0.28, fy = fim.top + fim.height / 2;
    let chegou = false;
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div"); d.className = "voo-ganho"; d.innerHTML = ICONES[tipo];
      document.body.append(d);
      const ang = Math.random() * Math.PI * 2, r = 18 + Math.random() * 30;
      const sx = o.x + Math.cos(ang) * r, sy = o.y + Math.sin(ang) * r;
      const mx = (sx + fx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, fy) - 40 - Math.random() * 60;
      const anim = d.animate([
        { transform: `translate(${o.x - 11}px, ${o.y - 11}px) scale(.3)`, opacity: 0 },
        { transform: `translate(${sx - 11}px, ${sy - 11}px) scale(1.15)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${mx - 11}px, ${my - 11}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${fx - 11}px, ${fy - 11}px) scale(.7)`, opacity: 0.9 },
      ], { duration: 820 + i * 45, delay: i * 55, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "forwards" });
      anim.onfinish = () => {
        d.remove();
        alvo.classList.remove("pulsa-chip"); void alvo.offsetWidth; alvo.classList.add("pulsa-chip");
        if (!chegou) { chegou = true; ok(); }
      };
    }
    setTimeout(() => { if (!chegou) { chegou = true; ok(); } }, 1600);
  });
}

// ---------- transição entre telas ----------
// a ordem segue a barra de abas (a versão Demo tem menos abas)
const ORDEM_PADRAO = ["trilha", "agenda", "disciplinas", "curriculo", "colecao", "loja", "perfil"];
const ordem = () => { const d = [...document.querySelectorAll("#abas .aba")].map(b => b.dataset.aba); return d.length ? d : ORDEM_PADRAO; };
const PAI = { treino: "trilha", jogos: "trilha", eventos: "trilha", jardim: "trilha", liga: "trilha", desempenho: "perfil", disciplina: "disciplinas" };
let telaAnterior = null;
export function transicaoTela(aba) {
  const t = document.getElementById("tela"), ant = telaAnterior;
  telaAnterior = aba;
  if (!ant || ant === aba || reduzido()) return;
  let dir;
  if (PAI[aba] && PAI[aba] !== PAI[ant]) dir = 1;            // entrando numa subtela
  else if (PAI[ant] === aba) dir = -1;                         // voltando para a tela-mãe
  else dir = Math.sign(ordem().indexOf(PAI[aba] || aba) - ordem().indexOf(PAI[ant] || ant)) || 1;
  t.style.setProperty("--dx", `${dir * 28}px`);
  t.classList.remove("entra"); void t.offsetWidth; t.classList.add("entra");
}

/** Revela os filhos de `raiz` em sequência (classe .surge-item com atraso). */
export function revelarEmSequencia(elementos, { passo = 70, inicio = 0 } = {}) {
  if (reduzido()) return;
  [...elementos].forEach((e, i) => { e.style.animationDelay = `${inicio + i * passo}ms`; e.classList.add("surge-item"); });
}

/** Ao trocar de tela: os blocos (cartões, faixas, nós da trilha…) entram em sequência.
 *  Observa a tela por um instante porque algumas telas são montadas de forma assíncrona. */
const SEL_ENTRADA = ".cartao, .item-loja, .carta, .atalho, .vaso, .slot-bau, .faixa, .no-wrap, .ev-cartao, .faixa-liga, .evento-sazonal, .aviso-dia, .secao, .faixa-escolha, .faixa-temporada";
let obsEntrada = null;
export function animarEntradaTela() {
  if (reduzido()) return;
  const t = document.getElementById("tela"); if (!t) return;
  obsEntrada?.disconnect();
  let n = 0;
  const alturaVisivel = window.innerHeight + 120;
  const aplicar = (el) => {
    if (n >= 22 || el.classList.contains("entra-suave") || el.parentElement?.closest(".entra-suave")) return;
    if (el.getBoundingClientRect().top > alturaVisivel) return; // fora da tela: aparece sem atraso
    if (getComputedStyle(el).animationName !== "none") return;  // já tem animação própria
    el.style.setProperty("--atraso", `${Math.min(n, 14) * 45}ms`);
    el.classList.add("entra-suave");
    el.addEventListener("animationend", () => el.classList.remove("entra-suave"), { once: true });
    n++;
  };
  t.querySelectorAll(SEL_ENTRADA).forEach(aplicar);
  obsEntrada = new MutationObserver((ms) => {
    for (const m of ms) for (const no of m.addedNodes) {
      if (no.nodeType !== 1) continue;
      if (no.matches(SEL_ENTRADA)) aplicar(no);
      no.querySelectorAll?.(SEL_ENTRADA).forEach(aplicar);
    }
  });
  obsEntrada.observe(t, { childList: true, subtree: true });
  setTimeout(() => { obsEntrada?.disconnect(); obsEntrada = null; }, 1200);
}

// ---------- deslizar o dedo para trocar de aba ----------
// Esquerda → próxima aba; direita → aba anterior (na ordem da barra de baixo).
// A tela acompanha o dedo um pouco; abaixo do limite, volta ao lugar.
export function ativarDeslizeAbas(irPara) {
  const abaAtual = () => telaAnterior || "trilha";
  const t = document.getElementById("tela"); if (!t) return;
  let x0 = 0, y0 = 0, t0 = 0, modo = null, dx = 0;
  const bloqueado = () => !document.getElementById("modal").hidden || !document.getElementById("camada-licao").hidden
    || document.querySelector(".jogo-camada, .camada-scan, .painel-topo:not(.saindo), .pergunta-rapida");
  const rolaDoLado = (el) => {
    for (let e = el; e && e !== t; e = e.parentElement) {
      if (e.matches?.("input, textarea, select, [data-sem-deslize]")) return true;
      const ox = getComputedStyle(e).overflowX;
      if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 2) return true;
    }
    return false;
  };
  const limpar = (animar) => {
    if (animar && !reduzido()) {
      t.style.transition = "transform .22s cubic-bezier(.2,.8,.3,1), opacity .22s";
      setTimeout(() => { t.style.transition = ""; }, 240);
    }
    t.style.transform = ""; t.style.opacity = "";
  };
  t.addEventListener("touchstart", (e) => {
    modo = null; dx = 0;
    if (e.touches.length !== 1 || bloqueado()) { modo = "nada"; return; }
    const p = e.touches[0];
    if (p.clientX < 22 || p.clientX > innerWidth - 22 || rolaDoLado(e.target)) { modo = "nada"; return; } // bordas: gesto de voltar do Android
    x0 = p.clientX; y0 = p.clientY; t0 = Date.now();
  }, { passive: true });
  t.addEventListener("touchmove", (e) => {
    if (modo === "nada" || e.touches.length !== 1) return;
    const p = e.touches[0], ddx = p.clientX - x0, ddy = p.clientY - y0;
    if (!modo) {
      if (Math.abs(ddx) < 12 && Math.abs(ddy) < 12) return;
      modo = Math.abs(ddx) > Math.abs(ddy) * 1.4 ? "lado" : "nada";
      if (modo === "nada") return;
    }
    dx = ddx;
    if (reduzido()) return;
    const i = ordem().indexOf(PAI[abaAtual()] || abaAtual());
    const naPonta = !(dx > 0 && PAI[abaAtual()]) && ((dx > 0 && i <= 0) || (dx < 0 && i >= ordem().length - 1));
    const des = dx * (naPonta ? 0.12 : 0.35);
    t.style.transform = `translateX(${des}px)`; t.style.opacity = String(1 - Math.min(0.35, Math.abs(des) / 300));
  }, { passive: true });
  const fim = () => {
    if (modo !== "lado") { modo = null; return; }
    modo = null;
    const rapido = Date.now() - t0 < 300 && Math.abs(dx) > 40;
    const i = ordem().indexOf(PAI[abaAtual()] || abaAtual());
    const vai = Math.abs(dx) > Math.min(110, innerWidth * 0.28) || rapido;
    // numa subtela (Jogos, Jardim, Desempenho…), deslizar para a direita volta para a tela-mãe
    const alvo = !vai ? null : dx > 0 && PAI[abaAtual()] ? PAI[abaAtual()] : ordem()[i + (dx < 0 ? 1 : -1)];
    if (!alvo) return limpar(true);
    limpar(false);
    irPara(alvo);
  };
  t.addEventListener("touchend", fim, { passive: true });
  t.addEventListener("touchcancel", () => { modo = null; limpar(true); }, { passive: true });
}

/**
 * Microinterações (caminho 1 do design, 25/10/2026): um toque leve de vibração (6 ms) ao apertar botões, opções e
 * nós da trilha (se a vibração estiver ligada no Perfil) e o "aperto" visual no CSS (.botao, .opcao, cartões).
 */
export function ligarMicrointeracoes(podeVibrar = () => true) {
  let ultimo = 0;
  document.addEventListener("pointerdown", (e) => {
    const alvo = e.target.closest?.(".botao:not(:disabled), .opcao:not(:disabled), .no:not(.bloqueado), .aba, .abas-trilha button, .xz-abas button, .mu-abas button");
    if (!alvo || !navigator.vibrate || !podeVibrar()) return;
    const agora = Date.now(); if (agora - ultimo < 60) return; ultimo = agora;
    try { navigator.vibrate(6); } catch { /* sem vibração */ }
  }, { passive: true, capture: true });
}
