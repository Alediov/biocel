// Ajuste à mão: você arrasta os 4 cantos do quadro impresso da ficha sobre a foto, e o app endireita a partir deles.
// A conferência pelo modelo continua valendo (visao.js): se a impressão não cair no lugar, a ficha não segue.
import { palpiteCantos } from "./visao.js";

const NOMES = ["1", "2", "3", "4"];
// mini ficha mostrando onde fica cada número (1: canto do logotipo do SUS)
const MAPA = `<svg viewBox="0 0 92 68" class="aj-mapa" aria-hidden="true"><rect x="6" y="6" width="80" height="56" rx="3" fill="#fff" stroke="#2D9CDB" stroke-width="2"/>
<rect x="12" y="11" width="9" height="9" fill="#2D9CDB"/><path d="M24 15h26M58 12h22M58 17h22" stroke="#2D9CDB" stroke-width="2.4"/><path d="M58 26h22M58 33h22M58 40h22M58 47h22M58 54h22" stroke="#8CC6E8" stroke-width="2"/>
${[[6, 6], [86, 6], [86, 62], [6, 62]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="6.5" fill="var(--os-acento)"/><text x="${x}" y="${y + 3.2}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${i + 1}</text>`).join("")}</svg>`;

/**
 * Abre o editor. `aoEndireitar(cantos)` (cantos na foto reduzida a 3000 px) devolve { ok, msg }: com ok, fecha.
 */
export async function abrirAjuste(raiz, { arquivo, nome, aoEndireitar }) {
  const d = document.createElement("div");
  d.className = "os-ajuste";
  d.innerHTML = `<header><button class="os-link" data-acao="fechar">Cancelar</button><b>Ajustar à mão</b><span></span></header>
    <div class="aj-palco"><div class="aj-quadro"><img alt="Foto da ficha"><svg class="aj-linhas"><polygon/></svg>${NOMES.map((n, i) => `<button class="aj-canto" data-i="${i}" aria-label="Canto ${n}">${n}</button>`).join("")}</div>
      <canvas class="aj-lente" width="150" height="150" hidden></canvas><p class="aj-carregando">Abrindo a foto…</p></div>
    <footer><div class="aj-ajuda">${MAPA}<p>Arraste cada número até o canto do <b>quadro impresso</b>: o <b>1</b> no canto do logotipo do SUS, depois em sentido horário. ${nome ? `<small>${nome.replace(/[<>&]/g, "")}</small>` : ""}</p></div>
      <p class="aj-erro" hidden></p>
      <div class="os-botoes"><button class="os-botao sec" data-acao="girar" title="Gira a numeração dos cantos (foto de lado ou de ponta-cabeça)">Girar números</button><button class="os-botao" data-acao="ok" disabled>Endireitar</button></div></footer>`;
  raiz.append(d);
  let ajustarTamanho = () => {};
  const fechar = () => { removeEventListener("resize", ajustarTamanho); d.classList.add("saindo"); setTimeout(() => d.remove(), 200); URL.revokeObjectURL(img.src); };
  d.querySelector('[data-acao="fechar"]').onclick = fechar;
  const img = d.querySelector("img"), quadro = d.querySelector(".aj-quadro"), poli = d.querySelector("polygon"), lente = d.querySelector(".aj-lente"), erro = d.querySelector(".aj-erro");
  img.src = URL.createObjectURL(arquivo);
  await img.decode().catch(() => {});
  let palpite;
  try { palpite = await palpiteCantos(arquivo); } catch (e) { d.querySelector(".aj-carregando").textContent = `Não consegui abrir a foto: ${e.message}`; return; }
  d.querySelector(".aj-carregando").remove();
  const { W, H } = palpite;
  let cantos = palpite.cantos.map(p => [...p]);
  // a imagem é mostrada inteira no palco; as contas são na foto reduzida (W×H)
  const escala = () => quadro.clientWidth / W;
  ajustarTamanho = () => {
    const palco = d.querySelector(".aj-palco"), mw = palco.clientWidth - 24, mh = palco.clientHeight - 24, k = Math.min(mw / W, mh / H);
    quadro.style.width = `${W * k}px`; quadro.style.height = `${H * k}px`;
    desenhar();
  };
  const desenhar = () => {
    const k = escala();
    d.querySelectorAll(".aj-canto").forEach((b, i) => { b.style.left = `${cantos[i][0] * k}px`; b.style.top = `${cantos[i][1] * k}px`; });
    poli.setAttribute("points", cantos.map(([x, y]) => `${x * k},${y * k}`).join(" "));
  };
  const lenteEm = (x, y, cx, cy) => {
    const c = lente.getContext("2d"), z = 3, r = 75, sx = img.naturalWidth / W;
    lente.hidden = false;
    // a lente fica no canto oposto ao dedo
    lente.style.left = cx < innerWidth / 2 ? "auto" : "12px"; lente.style.right = cx < innerWidth / 2 ? "12px" : "auto";
    c.clearRect(0, 0, 150, 150);
    c.save(); c.beginPath(); c.arc(r, r, r, 0, 7); c.clip();
    c.fillStyle = "#fff"; c.fillRect(0, 0, 150, 150);
    const lado = ((150 / z) / escala()) * sx; // pedaço da foto original mostrado (50 px da tela, aumentado 3×)
    c.drawImage(img, x * sx - lado / 2, y * sx - lado / 2, lado, lado, 0, 0, 150, 150);
    c.restore();
    c.strokeStyle = "#0E9F87"; c.lineWidth = 2; c.beginPath(); c.moveTo(r - 14, r); c.lineTo(r + 14, r); c.moveTo(r, r - 14); c.lineTo(r, r + 14); c.stroke();
  };
  d.querySelectorAll(".aj-canto").forEach((b, i) => {
    b.onpointerdown = (e) => {
      e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add("pega");
      const r0 = quadro.getBoundingClientRect();
      const mover = (ev) => {
        const k = escala(), x = Math.max(0, Math.min(W, (ev.clientX - r0.left) / k)), y = Math.max(0, Math.min(H, (ev.clientY - r0.top) / k));
        cantos[i] = [x, y]; desenhar(); lenteEm(x, y, ev.clientX, ev.clientY);
      };
      mover(e);
      b.onpointermove = mover;
      b.onpointerup = b.onpointercancel = () => { b.onpointermove = null; b.classList.remove("pega"); lente.hidden = true; };
    };
  });
  d.querySelector('[data-acao="girar"]').onclick = () => { cantos = [cantos[3], cantos[0], cantos[1], cantos[2]]; desenhar(); };
  const ok = d.querySelector('[data-acao="ok"]');
  ok.disabled = false;
  ok.onclick = async () => {
    ok.disabled = true; ok.textContent = "Endireitando…"; erro.hidden = true;
    let r;
    try { r = await aoEndireitar(cantos.map(p => [...p])); } catch (e) { r = { ok: false, msg: e.message }; }
    ok.disabled = false; ok.textContent = "Endireitar";
    if (r?.ok) fechar(); else { erro.textContent = r?.msg || "Não deu certo."; erro.hidden = false; }
  };
  addEventListener("resize", ajustarTamanho);
  requestAnimationFrame(ajustarTamanho);
}
