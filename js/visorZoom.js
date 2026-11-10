// Visor de imagem com zoom, um só para as lições e os jogos (pedido do Alediov, 09/11/2026: "ao abrir as imagens dos
// exercícios, poder aproximar e afastar"). A ideia é a do zoom da Leitura (.le-zoom): pinça, arrastar quando ampliada,
// toque duplo (ou duplo clique) aproxima no ponto e volta, roda do mouse aproxima onde está o cursor, + e − na tela e no
// teclado, 0 volta, Esc fecha. Conta em px da tela: a camada fica no <body>, fora do zoom do tablet (html.tablet só
// aplica zoom em #app, lição, modais…), então o dedo e a imagem andam juntos.
//
// Opções: `classe` (a mais na camada), `legenda` (texto), `legendaHtml`, `clara` (fundo claro, para figuras de livro com fundo branco), `orienta`
// (transformação CSS que a imagem já tinha, como girar/espelhar no Treino de Lâminas), `travado` + `quadro`
// {razao, transform, cobrir}: mostra a imagem EXATAMENTE como no exercício (o recorte ampliado do modo difícil),
// maior, sem zoom, porque ali o aumento é o próprio exercício.
const MAX = 8;

/** Abre o visor. Devolve { fechar, el }. */
export function abrirVisor(src, o = {}) {
  document.querySelector(".vz")?.remove();
  const z = document.createElement("div");
  z.className = `vz ${o.clara ? "clara" : ""} ${o.travado ? "travado" : ""} ${o.classe || ""}`;
  z.setAttribute("role", "dialog"); z.setAttribute("aria-label", "Imagem ampliada");
  const leg = o.legendaHtml || (o.legenda ? escapar(o.legenda) : "");
  z.innerHTML = `<div class="vz-area"><div class="vz-palco"><div class="vz-giro"><img alt="" draggable="false"></div></div></div>
    ${leg ? `<p class="vz-leg">${leg}</p>` : ""}
    <button class="vz-x" type="button" aria-label="Fechar">×</button>
    ${o.travado ? `<p class="vz-aviso">Neste exercício a imagem fica neste aumento</p>` : `<div class="vz-ctl"><button type="button" data-z="-" aria-label="Afastar">−</button><button type="button" data-z="0" aria-label="Tamanho normal" class="vz-nivel">1×</button><button type="button" data-z="+" aria-label="Aproximar">+</button></div>`}`;
  const area = z.querySelector(".vz-area"), palco = z.querySelector(".vz-palco"), giro = z.querySelector(".vz-giro"), im = z.querySelector("img");
  im.src = src;
  if (o.orienta) giro.style.transform = o.orienta;
  if (o.travado && o.quadro) { // o mesmo recorte do exercício, num quadro da mesma proporção
    const razao = o.quadro.razao || 1;
    palco.classList.add("vz-quadro"); palco.style.aspectRatio = String(razao); palco.style.width = `min(96vw, calc((100vh - 140px) * ${razao.toFixed(4)}))`;
    giro.style.transform = ""; im.style.objectFit = o.quadro.cobrir ? "cover" : "contain";
    im.style.transformOrigin = "50% 50%"; im.style.transform = o.quadro.transform || "";
  }
  document.body.append(z);
  requestAnimationFrame(() => z.classList.add("aberto"));

  let esc = 1, tx = 0, ty = 0;
  const nivel = z.querySelector(".vz-nivel");
  const aplicar = (suave) => {
    palco.style.transition = suave ? "transform .2s ease" : "none";
    palco.style.transform = `translate(${tx}px, ${ty}px) scale(${esc})`;
    z.classList.toggle("ampliada", esc > 1.01);
    if (nivel) nivel.textContent = `${esc < 1.95 ? esc.toFixed(1).replace(".0", "") : Math.round(esc)}×`;
    z.dataset.esc = esc.toFixed(2);
  };
  const limitar = () => {
    const r = area.getBoundingClientRect(), w = palco.offsetWidth * esc, h = palco.offsetHeight * esc;
    const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (h - r.height) / 2);
    tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
    if (esc <= 1.01) { esc = 1; tx = 0; ty = 0; }
  };
  /** Muda a escala mantendo parado o ponto (cx, cy) da tela. */
  const escalar = (nova, cx, cy, suave = true) => {
    nova = Math.max(1, Math.min(MAX, nova));
    const r = area.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2), py = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
    tx = px - (px - tx) * (nova / esc); ty = py - (py - ty) * (nova / esc); esc = nova;
    limitar(); aplicar(suave);
  };
  // pelo ponto, não pelo alvo: com o dedo capturado, o clique chega na área
  const naImagem = (e) => { const r = (o.travado ? palco : im).getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  const alternar = (cx, cy) => (esc > 1.01 ? escalar(1, cx, cy) : escalar(2.6, cx, cy));

  if (!o.travado) {
    const pts = new Map(); let ini = null, ultimoToque = 0, mexeu = false;
    area.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      area.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        mexeu = false;
        const agora = Date.now();
        if (e.pointerType !== "mouse" && agora - ultimoToque < 300) { alternar(e.clientX, e.clientY); ultimoToque = 0; ini = null; return; }
        ultimoToque = agora;
      }
      ini = { esc, tx, ty, pts: [...pts.values()].map(p => ({ ...p })) };
    });
    area.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId) || !ini) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = [...pts.values()];
      if (p.length >= 2 && ini.pts.length >= 2) {
        const d0 = Math.hypot(ini.pts[0].x - ini.pts[1].x, ini.pts[0].y - ini.pts[1].y), d1 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        const r = area.getBoundingClientRect(), c0x = (ini.pts[0].x + ini.pts[1].x) / 2 - (r.left + r.width / 2), c0y = (ini.pts[0].y + ini.pts[1].y) / 2 - (r.top + r.height / 2);
        const c1x = (p[0].x + p[1].x) / 2 - (r.left + r.width / 2), c1y = (p[0].y + p[1].y) / 2 - (r.top + r.height / 2);
        esc = Math.max(1, Math.min(MAX, ini.esc * d1 / Math.max(1, d0)));
        const k = esc / ini.esc; // o ponto entre os dedos fica sob os dedos
        tx = c1x - (c0x - ini.tx) * k; ty = c1y - (c0y - ini.ty) * k;
        mexeu = true;
      } else if (esc > 1) {
        tx = ini.tx + p[0].x - ini.pts[0].x; ty = ini.ty + p[0].y - ini.pts[0].y;
        if (Math.abs(p[0].x - ini.pts[0].x) + Math.abs(p[0].y - ini.pts[0].y) > 6) mexeu = true;
      }
      limitar(); aplicar(false);
    });
    const soltar = (e) => { pts.delete(e.pointerId); ini = pts.size ? { esc, tx, ty, pts: [...pts.values()].map(p => ({ ...p })) } : null; limitar(); aplicar(true); };
    area.addEventListener("pointerup", soltar); area.addEventListener("pointercancel", soltar);
    area.addEventListener("dblclick", (e) => alternar(e.clientX, e.clientY));
    area.addEventListener("wheel", (e) => { e.preventDefault(); escalar(esc * (e.deltaY < 0 ? 1.18 : 0.85), e.clientX, e.clientY, false); }, { passive: false });
    // tocar fora da imagem (sem arrastar), com ela no tamanho normal, fecha
    area.addEventListener("click", (e) => { if (!mexeu && esc <= 1.01 && !naImagem(e)) fechar(); });
    z.querySelectorAll(".vz-ctl button").forEach(b => (b.onclick = () => {
      const q = b.dataset.z; escalar(q === "+" ? esc * 1.5 : q === "-" ? esc / 1.5 : 1);
    }));
  } else {
    area.addEventListener("click", (e) => { if (!naImagem(e)) fechar(); });
  }
  const tecla = (e) => {
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
    else if (o.travado) return;
    else if (e.key === "+" || e.key === "=") escalar(esc * 1.5);
    else if (e.key === "-") escalar(esc / 1.5);
    else if (e.key === "0") escalar(1);
  };
  document.addEventListener("keydown", tecla);
  function fechar() {
    document.removeEventListener("keydown", tecla);
    z.classList.remove("aberto");
    setTimeout(() => z.remove(), 200);
  }
  z.querySelector(".vz-x").onclick = fechar;
  aplicar(false);
  return { fechar, el: z };
}

function escapar(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
