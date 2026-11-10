// Cenário da trilha: caminho pontilhado ligando as lições, manchas de cor,
// enfeites e objetos do tema da matéria. Tocar num objeto mostra uma frase do
// conteúdo do dia; o primeiro toque do dia em cada objeto rende moedas.
import { E, salvar, hojeISO } from "./estado.js";
import { OBJETOS, TEMAS, objetoSVG, ENFEITES } from "./arte/cenario.js";
import { formatarResumo } from "./exercicios.js";
import { icone } from "./icones.js";
import { tocar, vibrar } from "./sons.js";
import { escapar } from "./ui.js";

function gerador(semente) {
  let h = 2166136261;
  for (const ch of semente) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const embaralhar = (a, r) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function temaDaSessao(dia, periodo, sessao = null) {
  if (periodo === "noite") return "noite";
  if (periodo === "evento") return "evento";
  if (periodo === "tarde") return "patologia";
  const pelaDisciplina = (d) => /farmac/i.test(d) ? "farmaco" : /periodont|laperio/i.test(d) ? "perio" : /semiolog/i.test(d) ? "semio" : /anest/i.test(d) ? "anestesio" : /patol/i.test(d) ? "patologia" : "geral";
  if (periodo === "extra") return pelaDisciplina((sessao || dia.sessoes?.find(s => s.periodo === "extra"))?.disciplina || "Farmacologia");
  return pelaDisciplina(dia.disciplina || "");
}

/** Frases que os objetos "contam": só os resumos do dia (a noite usa os resumos da manhã e da tarde). */
function frasesDaSessao(dia, sessao, periodo) {
  const sessoes = periodo === "noite" || periodo === "evento" ? (dia.sessoes || [sessao]) : [sessao];
  const out = [];
  for (const s of sessoes) for (const l of s.licoes || []) for (const ex of l.exercicios || [])
    if (ex.tipo === "resumo") out.push(...(ex.frases || []).map(f => formatarResumo(f)));
  return out;
}

const DIAS_FALAS = ["Bora, falta pouco!", "Cada lição é um passo rumo à residência.", "Revisar hoje é lembrar na prova.", "Respira, estuda, conquista."];

function estadoCenario() {
  const est = E(), hoje = hojeISO();
  if (est.cenario?.dia !== hoje) est.cenario = { dia: hoje, tocados: [] };
  return est.cenario;
}

let balaoAberto = null;
function fecharBalao() { balaoAberto?.remove(); balaoAberto = null; }

/**
 * Decora um caminho já colocado na tela.
 * opts: { dia, sessao, periodo, atualIdx, feito(id), aoGanhar() }
 */
export function decorarCaminho(cam, opts) {
  const fazer = () => { if (cam.isConnected) desenhar(cam, opts); };
  if (document.fonts?.status === "loaded") requestAnimationFrame(fazer);
  else document.fonts.ready.then(() => requestAnimationFrame(fazer));
}

function desenhar(cam, { dia, sessao, periodo, atualIdx = -1, feito = () => false, aoGanhar = () => {}, enfeitesEvento = null, tema: temaDado = null, semente = null, frases: frasesDadas = null }) {
  cam.querySelector(".cenario")?.remove();
  cam.querySelectorAll(".obj-cenario").forEach(o => o.remove());
  const cr = cam.getBoundingClientRect();
  if (!cr.width) return;
  // com o zoom do tablet (tablet.js), getBoundingClientRect vem aumentado e o left/top dos objetos, não: divide por kz
  const kz = cr.width / (cam.offsetWidth || cr.width) || 1;
  const W = cr.width / kz, H = cr.height / kz, meio = W / 2;
  const nos = [...cam.querySelectorAll(".no")];
  const pts = nos.map(n => {
    const b = n.getBoundingClientRect(), rot = n.parentElement.querySelector(".rotulo-no")?.getBoundingClientRect();
    return { x: (b.left + b.width / 2 - cr.left) / kz, y: (b.top + b.height / 2 - cr.top) / kz, topo: (b.top - cr.top) / kz - 8, base: ((rot ? rot.bottom : b.bottom) - cr.top) / kz + 10, feito: n.classList.contains("feito") };
  });
  if (!pts.length) return;
  const temaK = temaDado || temaDaSessao(dia, periodo, sessao);
  const tema = TEMAS[temaK];
  const sem = semente || `${dia.data}|${periodo}`;
  const r = gerador(sem);

  // ---- fundo: manchas, caminho e enfeites ----
  const fundo = document.createElement("div"); fundo.className = `cenario tema-${temaK}`;
  fundo.insertAdjacentHTML("beforeend", ceu(periodo, W, H, r));
  let manchas = "";
  for (let i = 0; i < 4; i++) {
    const cx = (i % 2 ? W * (0.72 + r() * 0.25) : W * (0.03 + r() * 0.25)), cy = H * (0.12 + i * 0.24 + r() * 0.08);
    manchas += `<ellipse class="mancha" cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(70 + r() * 50).toFixed(0)}" ry="${(46 + r() * 34).toFixed(0)}" fill="${tema.cores[i % tema.cores.length]}" transform="rotate(${(r() * 40 - 20).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
  }
  fundo.querySelector(".ceu").insertAdjacentHTML("beforeend", `<svg class="par" data-f=".12" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${manchas}</svg>`);
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  const seg = (a, b) => { const dy = (b.y - a.y) / 2; return `M${a.x} ${a.y} C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`; };
  const sai = (p) => ({ x: p.x, y: p.base }), entra = (p) => ({ x: p.x, y: p.topo });
  svg += `<path class="trilho" d="${seg({ x: meio, y: Math.max(8, pts[0].topo - 50) }, entra(pts[0]))}"/>`;
  for (let i = 0; i < pts.length - 1; i++) svg += `<path class="trilho ${pts[i].feito && pts[i + 1].feito ? "feito" : pts[i].feito ? "meio" : ""}" d="${seg(sai(pts[i]), entra(pts[i + 1]))}"/>`;
  svg += `</svg>`;
  fundo.insertAdjacentHTML("beforeend", svg);

  // enfeites longe dos nós
  const ocupados = pts.map(p => ({ x: p.x, y: p.y, raio: 66 }));
  const tipos = Object.keys(ENFEITES), coresEnf = ["#FFC24B", "#7FD6F5", "#F7A8C8", "#A78BFA", "#7FD6A0"];
  for (let i = 0, tent = 0; i < 9 && tent < 60; tent++) {
    const x = 10 + r() * (W - 20), y = 10 + r() * (H - 20);
    if (ocupados.some(o => Math.hypot(o.x - x, o.y - y) < o.raio)) continue;
    const tam = 9 + r() * 9, tp = tipos[Math.floor(r() * tipos.length)];
    const e = document.createElement("div"); e.className = "enfeite";
    e.style.cssText = `left:${x - tam / 2}px;top:${y - tam / 2}px;width:${tam}px;height:${tam}px;animation-delay:${(-r() * 4).toFixed(2)}s`;
    e.innerHTML = ENFEITES[tp](coresEnf[Math.floor(r() * coresEnf.length)]);
    fundo.append(e); ocupados.push({ x, y, raio: 26 }); i++;
  }
  // enfeites do evento sazonal (ícones 3D)
  for (let i = 0, tent = 0; enfeitesEvento && i < 3 && tent < 40; tent++) {
    const x = 20 + r() * (W - 40), y = 20 + r() * (H - 40);
    if (ocupados.some(o => Math.hypot(o.x - x, o.y - y) < o.raio + 10)) continue;
    const e = document.createElement("div"); e.className = "enfeite-ev";
    e.style.cssText = `left:${x - 17}px;top:${y - 17}px;animation-delay:${(-r() * 3).toFixed(2)}s;transform:rotate(${(r() * 30 - 15).toFixed(0)}deg)`;
    e.innerHTML = icone(enfeitesEvento[i % enfeitesEvento.length], "ico3d");
    fundo.append(e); ocupados.push({ x, y, raio: 34 }); i++;
  }
  cam.prepend(fundo);
  const rolagem = cam.closest(".xz-tela") || document.getElementById("tela");
  ligarParallax(rolagem); parallax(rolagem);

  // ---- objetos tocáveis, do lado oposto ao nó ----
  const frases = frasesDadas || frasesDaSessao(dia, sessao, periodo);
  let ordemFrases = embaralhar(frases.map((_, i) => i), r), proxFrase = 0;
  const ids = embaralhar(tema.objetos, r);
  const st = estadoCenario();
  const candidatos = pts.map((_, i) => i).filter(i => i !== atualIdx);
  const achadoIdx = candidatos.length ? candidatos[Math.floor(r() * candidatos.length)] : -1;
  let k = 0;
  pts.forEach((p, i) => {
    if (i === atualIdx) return;
    let lado = p.x > meio + 10 ? -1 : p.x < meio - 10 ? 1 : (r() < 0.5 ? -1 : 1);
    const id = ids[k++ % ids.length], tam = 74;
    const x = Math.min(W - tam / 2 - 2, Math.max(tam / 2 + 2, meio + lado * (p.x === meio || Math.abs(p.x - meio) < 10 ? 112 : 104)));
    const y = p.y + (r() * 24 - 6);
    const chave = `${sem}|${i}`;
    const achado = i === achadoIdx;
    const o = document.createElement("button");
    o.className = `obj-cenario ${achado && !st.tocados.includes(chave) ? "achado" : ""}`;
    o.style.cssText = `left:${x - tam / 2}px;top:${y - tam / 2}px;width:${tam}px;height:${tam}px;animation-delay:${(-r() * 3).toFixed(2)}s`;
    o.setAttribute("aria-label", OBJETOS[id].nome);
    const variante = Math.floor(r() * 5);
    o.innerHTML = objetoSVG(id, variante);
    o.style.setProperty("--d", `${(-r() * 5).toFixed(2)}s`);
    o.onclick = (ev) => {
      ev.stopPropagation();
      o.classList.remove("tocado"); void o.offsetWidth; o.classList.add("tocado");
      o.innerHTML = objetoSVG(id, variante, "uau");
      clearTimeout(o._t); o._t = setTimeout(() => { o.innerHTML = objetoSVG(id, variante); }, 1100);
      tocar("par"); vibrar(12);
      // frase
      let html;
      if (frases.length) { html = frases[ordemFrases[proxFrase++ % ordemFrases.length]]; }
      else html = escapar(DIAS_FALAS[Math.floor(Math.random() * DIAS_FALAS.length)]);
      mostrarBalao(cam, o, `<b>${escapar(OBJETOS[id].nome)}</b><br>${html}`);
      // recompensa do dia
      const s = estadoCenario();
      if (!s.tocados.includes(chave)) {
        s.tocados.push(chave);
        const qtd = achado ? 5 : 1;
        E().moedas += qtd; salvar(); aoGanhar();
        if (achado) { tocar("moeda"); o.classList.remove("achado"); }
        const g = document.createElement("div"); g.className = `ganho-flutua ${achado ? "grande" : ""}`;
        g.innerHTML = `+${qtd} ${icone("🪙", "ico-inline")}`;
        g.style.cssText = `left:${x - 30}px;top:${y - 50}px`;
        cam.append(g); setTimeout(() => g.remove(), 1300);
      }
    };
    cam.append(o);
  });
}

// ---------- céu por período + parallax ----------
const NUVEM = (x, y, k, cls = "") => `<g class="nuvem ${cls}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${k.toFixed(2)})"><path d="M10 34 C0 34 0 20 12 20 C12 8 30 4 36 14 C42 4 62 8 60 22 C72 20 74 34 62 34 Z"/></g>`;
function ceu(periodo, W, H, r) {
  const per = periodo === "extra" ? "evento" : ["tarde", "noite", "evento"].includes(periodo) ? periodo : "manha";
  let itens = "";
  if (per === "noite") {
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = r() * Math.min(H, 520), t = 1 + r() * 2.2;
      itens += `<circle class="estrela-ceu" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${t.toFixed(1)}" style="animation-delay:${(-r() * 4).toFixed(2)}s"/>`;
    }
    itens += `<g class="astro-ceu lua-ceu" transform="translate(${(W - 70).toFixed(0)} 38)"><path d="M6 -24 A24 24 0 1 0 22 10 A19 19 0 1 1 6 -24 Z"/></g>`;
  } else {
    const sx = per === "manha" ? W - 64 : 58, sy = per === "manha" ? 30 : 46;
    itens += `<g class="astro-ceu" transform="translate(${sx} ${sy})"><g class="sol-ceu">${Array.from({ length: 10 }, (_, i) => `<path class="raio-sol" d="M0 -34 L5 -46 L-5 -46 Z" transform="rotate(${i * 36})"/>`).join("")}<circle r="26"/></g></g>`;
    for (let i = 0; i < 4; i++) itens += NUVEM(r() * (W - 80), 16 + i * 70 + r() * 30, 0.6 + r() * 0.6, i % 2 ? "lenta" : "");
  }
  const colinas = `<svg class="colinas" viewBox="0 0 400 60" preserveAspectRatio="none"><path class="c1" d="M0 40 C60 10 120 14 180 34 C240 54 300 18 400 30 V60 H0Z"/><path class="c2" d="M0 50 C80 30 160 40 220 50 C280 60 340 36 400 44 V60 H0Z"/></svg>`;
  return `<div class="ceu ceu-${per}"><svg class="ceu-itens par" data-f=".35" width="${W}" height="${Math.min(H, 560)}" viewBox="0 0 ${W} ${Math.min(H, 560)}">${itens}</svg>${colinas}</div>`;
}
const ouvindo = new WeakSet();
function parallax(tela) {
  if (!tela || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const topoTela = tela.getBoundingClientRect().top;
  for (const el of tela.querySelectorAll(".par")) {
    const cam = el.closest(".caminho"); if (!cam) continue;
    const k = cam.getBoundingClientRect().width / (cam.offsetWidth || 1) || 1;
    const top = (cam.getBoundingClientRect().top - topoTela) / k;
    el.style.transform = `translateY(${(Math.max(0, -top) * +el.dataset.f).toFixed(1)}px)`;
  }
}
function ligarParallax(tela) {
  if (!tela || ouvindo.has(tela)) return;
  ouvindo.add(tela);
  let pedido = 0;
  tela.addEventListener("scroll", () => { if (!pedido) pedido = requestAnimationFrame(() => { pedido = 0; parallax(tela); }); }, { passive: true });
}

function mostrarBalao(cam, alvo, html) {
  fecharBalao();
  const b = document.createElement("div"); b.className = "balao-obj";
  b.innerHTML = html;
  cam.append(b);
  const W = cam.clientWidth, ox = alvo.offsetLeft + alvo.offsetWidth / 2, larg = Math.min(250, W - 16);
  b.style.width = `${larg}px`;
  b.style.left = `${Math.max(8, Math.min(W - larg - 8, ox - larg / 2))}px`;
  b.style.setProperty("--seta", `${ox - Math.max(8, Math.min(W - larg - 8, ox - larg / 2))}px`);
  const h = b.offsetHeight, topo = alvo.offsetTop - h - 12;
  if (topo < 0) { b.style.top = `${alvo.offsetTop + alvo.offsetHeight + 10}px`; b.classList.add("abaixo"); }
  else b.style.top = `${topo}px`;
  balaoAberto = b;
  const fechar = () => { if (balaoAberto === b) fecharBalao(); };
  b.onclick = fechar;
  setTimeout(fechar, 6500);
}
document.addEventListener("pointerdown", (e) => { if (balaoAberto && !e.target.closest(".balao-obj, .obj-cenario")) fecharBalao(); }, true);
