// Efeitos visuais do OdontoScan: números que contam, indicador deslizante das abas, confete e carimbo.
// Sem dependências (vai também no OdontoScan.html do notebook). Tudo respeita "reduzir movimento" do sistema.
const reduzido = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");

/** Número que conta até o valor. `id` liga o mesmo número entre telas/atualizações: conta a partir do valor anterior. */
export const num = (v, id = "") => `<b data-conta="${+v || 0}"${id ? ` data-conta-id="${id}"` : ""}>${fmt(v)}</b>`;
const ultimos = new Map();
export function contarNumeros(raiz) {
  raiz.querySelectorAll("[data-conta]").forEach(el => {
    const fim = +el.dataset.conta, id = el.dataset.contaId;
    const ini = id && ultimos.has(id) ? ultimos.get(id) : 0;
    if (id) ultimos.set(id, fim);
    if (reduzido() || ini === fim) { el.textContent = fmt(fim); return; }
    const dur = Math.min(1100, 450 + Math.log10(Math.abs(fim - ini) + 1) * 220), t0 = performance.now();
    el.textContent = fmt(ini);
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(ini + (fim - ini) * e));
      if (p < 1 && el.isConnected) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

/** Pílula que desliza até a aba ativa. */
export function moverIndicador(nav) {
  const ind = nav?.querySelector(".os-abas-ind"), on = nav?.querySelector("button.on");
  if (!ind || !on) return;
  ind.style.width = `${on.offsetWidth}px`;
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
  ind.style.opacity = 1;
}

/** Chuva de confete (ao terminar uma importação, ao revisar a última ficha…). */
export function confete(raiz, n = 90) {
  if (reduzido() || !raiz) return;
  const cv = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.className = "os-confete";
  const W = raiz.clientWidth || innerWidth, H = raiz.clientHeight || innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  raiz.append(cv);
  const cx = cv.getContext("2d"); cx.scale(dpr, dpr);
  const cores = ["#2BC8A9", "#6E9BFF", "#F0B454", "#FF7A70", "#9B6BDF", "#4FD08A", "#5BD8F0"];
  const ps = Array.from({ length: n }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.42, vx: (Math.random() - 0.5) * 9, vy: -6 - Math.random() * 9,
    r: 4 + Math.random() * 5, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.35, cor: cores[(Math.random() * cores.length) | 0], forma: Math.random() < 0.35,
  }));
  const t0 = performance.now();
  const quadro = (t) => {
    const dt = t - t0;
    cx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.globalAlpha = Math.max(0, 1 - dt / 2200); cx.fillStyle = p.cor;
      if (p.forma) { cx.beginPath(); cx.arc(0, 0, p.r * 0.6, 0, 7); cx.fill(); } else cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      cx.restore();
    }
    if (dt < 2200) requestAnimationFrame(quadro); else cv.remove();
  };
  requestAnimationFrame(quadro);
}

/** Carimbo "Revisada" sobre um elemento (a cópia da ficha), antes de passar para a próxima. */
export function carimbar(el, texto = "Revisada") {
  if (!el || reduzido()) return Promise.resolve();
  const c = document.createElement("span");
  c.className = "os-carimbo"; c.textContent = texto;
  el.append(c);
  return new Promise(ok => setTimeout(() => { c.remove(); ok(); }, 650));
}
