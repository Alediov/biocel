// "Treino com as suas lâminas" (pedido do Alediov, 03/11/2026): campos sorteados das lâminas digitais DELE que estão
// ligadas a uma lesão. Cada pergunta mostra um campo com tecido de verdade (o fundo branco do vidro é recusado pela
// miniatura do nível de base: fração de pixels com cor ou escuros), num aumento sorteado (≈ 4×, 10× ou 20×; às vezes
// em volta de uma marcação dele), girado ou espelhado como no Treino de Lâminas; ele escolhe a lesão entre as das
// lâminas dele e as "parecidas" de extras/jogos/laminas.json. Depois de responder, "Ver na lâmina" abre o visor
// exatamente ali. Acertos por lesão em E().laminas.campos (registro.js anotarCampo) e, para as 5 lesões da prova, também
// nas barras do Treino de Lâminas (anotarTreino, de jogos/laminas.js). As funções do jogo (terminar…) vêm por parâmetro,
// para este módulo não importar o jogos.js (que importa o laminas.js).
import { escapar, toast } from "../ui.js";
import { tocar, vibrar } from "../sons.js";
import { embaralhar } from "../exercicios.js";
import * as F from "./fontes.js";
import * as R from "./registro.js";
import { abrirVisor, garantirCSS, nomeLesao } from "./visor.js";
import { tilesDoNivel, aumentoNaTela } from "./vmic.js";

export const AUMENTOS = [4, 10, 20];
export const MIN_TECIDO = 0.5; // fração mínima de tecido no campo
const PERGUNTAS = 6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** É tecido? (corado: saturação; ou escuro: núcleos). O vidro é quase branco e cinza. */
export function ehTecido(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return (mx - mn > 28 && lum < 236) || lum < 165;
}

/** Fração de tecido no retângulo (px da imagem cheia) pela miniatura `base` { data, w, h, k } (k = px da miniatura por px). */
export function fracaoTecido(base, x0, y0, w, h) {
  const a = clamp(Math.floor(x0 * base.k), 0, base.w - 1), b = clamp(Math.floor(y0 * base.k), 0, base.h - 1);
  const c = clamp(Math.ceil((x0 + w) * base.k), a + 1, base.w), d = clamp(Math.ceil((y0 + h) * base.k), b + 1, base.h);
  const passo = Math.max(1, Math.floor(Math.min(c - a, d - b) / 24));
  let t = 0, n = 0;
  for (let y = b; y < d; y += passo) for (let x = a; x < c; x += passo) {
    const i = (y * base.w + x) * 4; n++;
    if (ehTecido(base.data[i], base.data[i + 1], base.data[i + 2])) t++;
  }
  return n ? t / n : 0;
}

/** Sorteia um campo com tecido: { cx, cy, s, aum, tecido, giro, espelho }. `vw`/`vh`: tamanho do quadro em px da tela. */
export function sortearCampo(info, base, vw, vh, marcadores = [], rnd = Math.random) {
  const W = info.largura, H = info.altura, PPM = info.pxPorMicron;
  const aum = AUMENTOS[Math.floor(rnd() * AUMENTOS.length)];
  let s = PPM ? aum / (10 * PPM) : [0.1, 0.25, 0.5][AUMENTOS.indexOf(aum)];
  s = clamp(s, Math.max(vw / W, vh / H), 1); // o campo cabe na lâmina e não passa da resolução cheia
  const hw = vw / 2 / s, hh = vh / 2 / s;
  let melhor = null;
  for (let k = 0; k < 60; k++) {
    let cx, cy;
    if (marcadores.length && rnd() < 0.4) { const m = marcadores[Math.floor(rnd() * marcadores.length)]; cx = m.x + (rnd() - 0.5) * hw; cy = m.y + (rnd() - 0.5) * hh; }
    else { cx = hw + rnd() * Math.max(0, W - 2 * hw); cy = hh + rnd() * Math.max(0, H - 2 * hh); }
    cx = clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)); cy = clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2));
    const t = fracaoTecido(base, cx - hw, cy - hh, 2 * hw, 2 * hh);
    if (!melhor || t > melhor.tecido) melhor = { cx, cy, tecido: t };
    if (t >= MIN_TECIDO && k >= 2) break;
  }
  return { ...melhor, s, aum: PPM ? aumentoNaTela(PPM, s) : null, giro: rnd() < 0.5 ? 180 : 0, espelho: rnd() < 0.5 };
}

/** Desenha o campo (centro cx, cy na escala s) numa imagem de vw × vh px da tela. → Blob JPEG */
export async function imagemDoCampo(slide, { cx, cy, s }, vw, vh) {
  const i = slide.info, NM = i.nivelMax, TS = i.tile, OV = i.overlap;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const c = document.createElement("canvas"); c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr);
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  const L = clamp(NM + Math.ceil(Math.log2(s * dpr) - 0.15), 0, NM), k = 2 ** (NM - L), span = TS * k;
  const [cols, lins] = tilesDoNivel(i, L);
  const x0 = cx - vw / 2 / s, y0 = cy - vh / 2 / s, x1 = cx + vw / 2 / s, y1 = cy + vh / 2 / s;
  const X = (ix) => Math.round(((ix - cx) * s + vw / 2) * dpr), Y = (iy) => Math.round(((iy - cy) * s + vh / 2) * dpr);
  const pedidos = [];
  for (let ty = clamp(Math.floor(y0 / span), 0, lins - 1); ty <= clamp(Math.floor(y1 / span), 0, lins - 1); ty++)
    for (let tx = clamp(Math.floor(x0 / span), 0, cols - 1); tx <= clamp(Math.floor(x1 / span), 0, cols - 1); tx++)
      pedidos.push(slide.tile(L, tx, ty).then(b => (b ? createImageBitmap(b) : null)).then(bmp => {
        if (!bmp) return;
        const lx = tx * TS - (tx ? OV : 0), ly = ty * TS - (ty ? OV : 0);
        const a = X(lx * k), b = Y(ly * k);
        g.drawImage(bmp, a, b, X((lx + bmp.width) * k) - a, Y((ly + bmp.height) * k) - b); bmp.close?.();
      }).catch(() => {}));
  await Promise.all(pedidos);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.9));
}

/** As lâminas deste aparelho ligadas a uma lesão: [{ it, uid, lesao, nome }] (uma por UID). */
export async function laminasLigadas() {
  const { itens } = await F.listar();
  const out = [], vistos = new Set();
  for (const it of itens) {
    const res = await F.pegar(`res:${it.chave}`) || await F.resumo(it).catch(() => null);
    const d = res && R.dadosDe(res.uid);
    if (!d?.lesao || vistos.has(res.uid)) continue;
    vistos.add(res.uid);
    out.push({ it, uid: res.uid, lesao: d.lesao, nome: d.nome || F.tituloDe(it) || res.nome });
  }
  return out;
}

/** As opções de uma pergunta: a certa, as lesões das lâminas dele, as parecidas dela e, para completar, as da prova. */
export function opcoesPara(certa, lesoesDele, D, n = 4) {
  const rel = new Set();
  const doJson = (id) => [...(D?.lesoes || []), ...(D?.parecidas || [])].find(x => x.id === id);
  for (const p of D?.parecidas || []) if (p.parece === certa) rel.add(p.id);
  const c = doJson(certa); if (c?.parece) rel.add(c.parece);
  const ordem = [...embaralhar(lesoesDele.filter(x => x !== certa)), ...embaralhar([...rel]), ...embaralhar((D?.lesoes || []).map(x => x.id))];
  const out = [certa];
  for (const x of ordem) { if (out.length >= n) break; if (!out.includes(x)) out.push(x); }
  return embaralhar(out);
}

/**
 * O treino, em `cam.corpo`. `ops`: { D, voltar, terminar(pontos, resumoHtml), anotarTreino(lesao, certo), abrirBiblioteca }.
 */
export async function treinoComLaminas(cam, ops = {}) {
  await garantirCSS();
  const { D, voltar } = ops;
  cam.info.textContent = "";
  cam.corpo.scrollTop = 0;
  cam.corpo.innerHTML = `<div class="lam"><p class="lam-nota">Preparando os campos das suas lâminas…</p></div>`;
  const lams = await laminasLigadas();
  if (!lams.length) {
    cam.corpo.innerHTML = `<div class="lam">${voltar ? `<button class="lam-voltar">‹ Voltar</button>` : ""}<h2>Treino com as suas lâminas</h2>
      <div class="ld-vazio"><p>Para treinar com as suas lâminas, abra uma lâmina digital, toque no nome dela lá em cima e escolha a lesão. Só as lâminas ligadas a uma lesão (e que estão neste aparelho) entram no treino.</p></div>
      ${ops.abrirBiblioteca ? `<button class="botao" data-b="bib">Abrir as lâminas digitais</button>` : ""}</div>`;
    cam.corpo.querySelector(".lam-voltar")?.addEventListener("click", voltar);
    cam.corpo.querySelector('[data-b="bib"]')?.addEventListener("click", ops.abrirBiblioteca);
    return;
  }
  const lesoesDele = [...new Set(lams.map(l => l.lesao))];
  const prontas = new Map(); // uid → { slide, base }
  async function preparar(l) {
    if (prontas.has(l.uid)) return prontas.get(l.uid);
    const slide = await F.abrir(l.it);
    const c = await F.miniaturaTecido(slide, 1024);
    const base = { data: c.getContext("2d").getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, k: c.width / slide.info.largura };
    const p = { slide, base };
    prontas.set(l.uid, p);
    return p;
  }
  // a ordem: cada lâmina pelo menos uma vez; as lesões que ele mais erra aparecem mais
  const peso = (l) => { const r = R.camposDe(l.lesao); return 1 + 2 * r.e / (r.c + r.e + 1) + Math.random(); };
  const sorteio = [];
  while (sorteio.length < PERGUNTAS) sorteio.push(...embaralhar(lams).sort((a, b) => peso(b) - peso(a)));
  const lista = sorteio.slice(0, PERGUNTAS);
  let i = 0, pontos = 0, acertos = 0;
  const resumo = [];
  const urls = [];

  async function proxima() {
    if (i >= lista.length) return fim();
    const l = lista[i];
    cam.info.textContent = `${i + 1}/${lista.length}`;
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam lam-q"><p class="lam-perg">Que lesão é esta?</p>
      <div class="lam-vista ld-campo carregando"><img alt=""><span class="lam-aum"></span></div>
      <div class="opcoes lam-ops"></div><div class="ld-fb"></div></div>`;
    const raiz = cam.corpo.firstChild, box = raiz.querySelector(".ld-campo"), img = box.querySelector("img");
    let campo, p;
    try {
      p = await preparar(l);
      const vw = Math.max(200, Math.round(box.offsetWidth || 360)), vh = Math.round(vw * 2 / 3);
      campo = sortearCampo(p.slide.info, p.base, vw, vh, R.marcadoresDe(l.uid));
      const blob = await imagemDoCampo(p.slide, campo, vw, vh);
      const u = URL.createObjectURL(blob); urls.push(u);
      img.style.transform = `rotate(${campo.giro}deg) scaleX(${campo.espelho ? -1 : 1})`;
      img.src = u;
      box.dataset.tecido = campo.tecido.toFixed(2);
      box.querySelector(".lam-aum").textContent = campo.aum ? `≈ ${Math.round(campo.aum)}×` : "";
    } catch (e) {
      toast(String(e?.message || "Esta lâmina não abriu."));
      i++; return proxima();
    } finally { box.classList.remove("carregando"); }
    const ops2 = raiz.querySelector(".lam-ops"), fb = raiz.querySelector(".ld-fb");
    for (const id of opcoesPara(l.lesao, lesoesDele, D)) {
      const b = document.createElement("button"); b.className = "opcao"; b.textContent = nomeLesao(D, id); b.dataset.id = id;
      b.onclick = () => {
        const certo = id === l.lesao;
        ops2.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.dataset.id === l.lesao) x.classList.add("correta"); });
        if (!certo) { b.classList.add("incorreta"); vibrar?.(60); }
        tocar(certo ? "certo" : "errado");
        R.anotarCampo(l.lesao, certo); ops.anotarTreino?.(l.lesao, certo);
        if (certo) { pontos += 10; acertos++; }
        resumo.push({ l, certo, aum: campo.aum });
        fb.innerHTML = `<div class="lam-fb ${certo ? "ok" : "erro"}"><b>${certo ? "Isso!" : `Era: ${escapar(nomeLesao(D, l.lesao))}`}</b>
          <p>Lâmina: ${escapar(l.nome)}${campo.aum ? ` · ≈ ${Math.round(campo.aum)}×` : ""}${campo.giro || campo.espelho ? " · a imagem veio girada ou espelhada" : ""}</p></div>
          <div class="ld-fb-bts"><button class="botao secundario" data-b="ver">Ver na lâmina</button><button class="botao" data-b="prox">${i + 1 < lista.length ? "Próxima" : "Ver resultado"}</button></div>`;
        fb.querySelector('[data-b="ver"]').onclick = () => abrirVisor(p.slide, { item: l.it, vista: { cx: campo.cx, cy: campo.cy, s: campo.s } }).catch(e => toast(String(e?.message || e)));
        fb.querySelector('[data-b="prox"]').onclick = () => { i++; proxima(); };
        fb.scrollIntoView({ behavior: "smooth", block: "end" });
      };
      ops2.append(b);
    }
  }
  function fim() {
    for (const u of urls) URL.revokeObjectURL(u);
    const linhas = resumo.map(r => `<li><span>${escapar(nomeLesao(D, r.l.lesao))}<small>${escapar(r.l.nome)}${r.aum ? ` · ≈ ${Math.round(r.aum)}×` : ""}</small></span><b>${r.certo ? `<i class="ok">✓</i>` : `<i class="erro">✗</i>`}</b></li>`).join("");
    const html = `<p class="sub">${acertos} de ${resumo.length} campos das suas lâminas.</p><ul class="mira-resumo">${linhas}</ul>`;
    if (ops.terminar) return ops.terminar(pontos, html);
    cam.corpo.innerHTML = `<div class="lam">${html}</div>`;
  }
  proxima();
}
