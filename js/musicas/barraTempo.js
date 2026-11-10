// Barra de tempo da tela Tocando (pedido do Alediov, 24/10/2026: "o cursor está muito simples"). O trecho já tocado
// é uma onda nas cores da capa, que anda enquanto a música toca e se acalma até virar linha reta na pausa; o cursor é
// uma pílula com um halo que pulsa e solta bolhinhas (as do tubete, como no fundo das Músicas). Entre uma notícia e
// outra do tocador (a cada ~0,7 s) o ponto é interpolado, então o cursor desliza em vez de pular. Por cima fica o
// <input type="range"> invisível, que é quem recebe o toque e o arrastar (e o leitor de tela). Com "reduzir
// movimento", a linha fica reta, sem bolhas nem pulso.

const MENOS_MOVIMENTO = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Liga a barra animada a um `.mu-t-trilho` que já tem o input range. Devolve { atualizar, cores, arrastando }. */
export function barraTempo(trilho, input, { formatar = (ms) => String(ms) } = {}) {
  const cv = document.createElement("canvas"); cv.className = "mu-t-onda"; cv.setAttribute("aria-hidden", "true");
  const balao = document.createElement("b"); balao.className = "mu-t-balao"; balao.hidden = true;
  trilho.prepend(cv); trilho.append(balao);
  const g = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  const medir = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1); // 2 basta para a linha e pesa bem menos que 3
    if (trilho.clientWidth) dpr *= Math.min(1.5, Math.max(1, trilho.getBoundingClientRect().width / trilho.clientWidth)); // zoom do tablet
    W = trilho.clientWidth; H = trilho.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  };
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(medir) : null;
  ro?.observe(trilho); medir();

  // estado do tocador e o que está na tela
  let base = 0, t0 = performance.now(), dur = 0, tocando = false, mostrado = 0;
  let amp = 0, fase = 0, pulso = 0, ultimoQuadro = performance.now(), ultimaBolha = 0, arrastando = false, cresce = 0;
  let c1 = "rgb(120,140,255)", c2 = "rgb(180,120,255)", fundoTrilho = "rgba(128,128,128,.25)";
  const bolhas = [];
  let rodando = false;

  const previsto = () => Math.min(dur || Infinity, base + (tocando ? performance.now() - t0 : 0));
  const pad = 10, cy = () => H - 15;
  const xDe = (p) => pad + (W - 2 * pad) * p;

  function desenhar(agora) {
    const dt = Math.min(64, agora - ultimoQuadro); ultimoQuadro = agora;
    const calmo = MENOS_MOVIMENTO();
    // ponto: arrastando, o do dedo; senão, o previsto, alcançado devagar (sem saltos para trás)
    const alvo = arrastando ? +input.value : previsto();
    mostrado = Math.abs(alvo - mostrado) > 2500 || arrastando ? alvo : mostrado + (alvo - mostrado) * Math.min(1, dt / 120);
    const p = dur > 0 ? Math.max(0, Math.min(1, mostrado / dur)) : 0;
    amp += ((tocando && !calmo ? 1 : 0) - amp) * Math.min(1, dt / 260);
    cresce += ((arrastando ? 1 : 0) - cresce) * Math.min(1, dt / 90);
    if (!calmo) { fase += dt * 0.0042 * (0.25 + amp); pulso = (pulso + dt / 1700) % 1; }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const y0 = cy(), xp = xDe(p), fim = W - pad;
    g.lineCap = "round";
    // o que falta tocar: linha fina e apagada
    if (fim - xp > 8) {
      g.strokeStyle = fundoTrilho; g.lineWidth = 4;
      g.beginPath(); g.moveTo(Math.min(fim, xp + 9), y0); g.lineTo(fim, y0); g.stroke();
    }
    // o que já tocou: a onda (some perto das pontas para encostar reta no cursor)
    if (xp - pad > 1) {
      const gr = g.createLinearGradient(pad, 0, Math.max(pad + 1, xp), 0);
      gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.strokeStyle = gr; g.lineWidth = 4.2;
      g.beginPath();
      const A = 3.4 * amp, lambda = 26;
      for (let x = pad; x <= xp - 6; x += 1.5) {
        const borda = Math.min(1, (x - pad) / 14, (xp - 6 - x) / 14);
        const y = y0 + A * Math.max(0, borda) * Math.sin((x / lambda) * 2 * Math.PI - fase);
        if (x === pad) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineTo(Math.max(pad, xp - 6), y0);
      g.stroke();
    }
    // bolhinhas que sobem do cursor enquanto toca
    if (!calmo && tocando && agora - ultimaBolha > 380 && p > 0) {
      ultimaBolha = agora;
      bolhas.push({ x: xp + (Math.random() * 10 - 5), y: y0 - 6, r: 1.6 + Math.random() * 2.6, vida: 0, dur: 900 + Math.random() * 700, dx: Math.random() * 10 - 5 });
    }
    for (let i = bolhas.length - 1; i >= 0; i--) {
      const b = bolhas[i]; b.vida += dt;
      const k = b.vida / b.dur;
      if (k >= 1) { bolhas.splice(i, 1); continue; }
      g.globalAlpha = (1 - k) * 0.85;
      g.strokeStyle = c2; g.lineWidth = 1.2;
      g.beginPath(); g.arc(b.x + b.dx * k, b.y - k * (y0 - 16), b.r * (1 + k * 0.4), 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    // halo que pulsa (tocando) e o cursor: uma pílula em pé, que cresce ao arrastar
    if (!calmo && amp > 0.05) {
      const r = 9 + 9 * pulso;
      g.fillStyle = c2; g.globalAlpha = 0.32 * (1 - pulso) * amp;
      g.beginPath(); g.arc(xp, y0, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    if (cresce > 0.02) { g.fillStyle = c2; g.globalAlpha = 0.18 * cresce; g.beginPath(); g.arc(xp, y0, 17, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    const lw = 6 + 3 * cresce, lh = 20 + 8 * cresce;
    // brilho em volta do cursor com círculos translúcidos (o shadowBlur do canvas pesa a cada quadro)
    g.fillStyle = c2; g.globalAlpha = 0.16; g.beginPath(); g.arc(xp, y0, 10 + 3 * cresce, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.fillStyle = c2;
    redondo(g, xp - lw / 2, y0 - lh / 2, lw, lh, lw / 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.9)";
    redondo(g, xp - 1, y0 - lh / 2 + 4, 2, lh - 8, 1); g.fill();
    // balão com o tempo, ao arrastar
    // só mexe no DOM quando muda (escrever o mesmo valor a cada quadro também recalcula o estilo)
    if (arrastando) { const tx = formatar(+input.value), l = `${Math.round(xp)}px`; if (balao.hidden) balao.hidden = false; if (balao.textContent !== tx) balao.textContent = tx; if (balao.style.left !== l) balao.style.left = l; }
    else if (!balao.hidden) balao.hidden = true;
    // parado de vez (pausa, onda assentada, sem bolhas nem dedo): o laço para até a próxima notícia do tocador
    return !tocando && !arrastando && amp < 0.01 && cresce < 0.01 && !bolhas.length && Math.abs(alvo - mostrado) < 5;
  }
  let ultimoDesenho = 0;
  function quadro(agora) {
    if (!trilho.isConnected || trilho.offsetParent === null) { rodando = false; return; }
    if (!W) medir();
    // 30 quadros por segundo bastam para a onda; com o dedo, todos
    if (!arrastando && agora - ultimoDesenho < 31) { requestAnimationFrame(quadro); return; }
    ultimoDesenho = agora;
    if (desenhar(agora)) { rodando = false; return; }
    requestAnimationFrame(quadro);
  }
  function iniciar() { if (rodando) return; rodando = true; ultimoQuadro = performance.now(); requestAnimationFrame(quadro); }

  // ao soltar, o cursor fica onde o dedo deixou; por 1,5 s as notícias do tocador com o ponto antigo são ignoradas
  // (ele ainda não tinha pulado), para o cursor não voltar e ir de novo
  let soltouEm = 0, alvoSolto = 0;
  const soltar = () => {
    if (!arrastando) return;
    arrastando = false; base = alvoSolto = +input.value; t0 = performance.now(); mostrado = base; soltouEm = t0;
  };
  input.addEventListener("input", () => { arrastando = true; iniciar(); });
  input.addEventListener("change", soltar);
  input.addEventListener("pointerup", soltar);
  input.addEventListener("pointercancel", soltar);

  return {
    /** O que o tocador disse agora. */
    atualizar({ posicao = 0, duracao = 0, tocando: t = false } = {}) {
      const agora = performance.now();
      dur = duracao; tocando = !!t;
      if (arrastando || (agora - soltouEm < 1500 && Math.abs(posicao - alvoSolto) > 2000)) { iniciar(); return; }
      base = posicao; t0 = agora;
      iniciar();
    },
    /** Cores da capa (a onda vai de c1 para c2; `trilho` é a cor do que falta). */
    cores(a, b, trilhoCor) { if (a) c1 = a; if (b) c2 = b; if (trilhoCor) fundoTrilho = trilhoCor; iniciar(); },
    get arrastando() { return arrastando; },
  };
}

function redondo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
