// Finanças → Testes (pedido do Alediov, 02/11/2026: "copy trading de criptomoedas… copiar as operações com um atraso";
// escolhas dele: Hyperliquid, várias alavancagens, tudo só simulação). Lê o `resumo.json` do ramo órfão `mercado`, que o
// workflow "Testes de mercado" (tools/mercado/, a cada 2 h) grava. Desde 22h27 (ele achou difícil de entender), 4 abas
// em linguagem simples: Como está indo, Quem copiamos, Jeitos de copiar e O que aconteceu (testes/subabas.js), o botão
// Como funciona no alto, o "?" em cada termo técnico (comum.js `q`/`ligarAjuda`) e a tela da carteira em 4 partes
// (testes/carteira.js). As contas ficam em testes/calculo.js (teste: node tools/mercado/teste_app.mjs).
// Desde 03/11/2026 (docs/plano-testes-mercado-2.md) a aba tem uma faixa de chips logo abaixo do aviso: Placar (o começo,
// testes/placar.js) · Copy trading (as 4 abas de antes, sem mudança) · as outras formas no papel que têm dados (Cofres,
// Funding, Robôs…, testes/formas.js; dados do ramo `papel` do orbita-testes). A escolha fica em `orbita.testes.forma`;
// deslizar o dedo troca a forma (nas pontas, a aba das Finanças).
// Nada aqui mexe em dinheiro.
import { icone } from "../icones.js";
import { toast, escapar } from "../ui.js";
import * as D from "./testes/dados.js";
import * as K from "./testes/calculo.js";
import { sel, guardarSel, AVISO, quando, ligarAjuda } from "./testes/comum.js";
import * as S from "./testes/subabas.js";
import { telaCarteira } from "./testes/carteira.js";
import * as F from "./testes/formas.js";
import { telaPlacar } from "./testes/placar.js";
import * as O from "./testes/oculto.js";

export const carregar = D.carregar;
const VISTO = "orbita.testes.visto";
// 09/11/2026: a 5ª parte, Mais testes (o teste fora da amostra, As 5 melhores, o Consenso, Só robôs × Só pessoas e
// parar de copiar quem afunda; S.telaMais).
const SUBS = [["indo", "Como está indo", "📊"], ["quem", "Quem copiamos", "👥"], ["jeitos", "Jeitos de copiar", "🧮"], ["mais", "Mais testes", "🔬"], ["aconteceu", "O que aconteceu", "📋"]];
const TELAS = { indo: S.telaIndo, quem: S.telaQuem, jeitos: S.telaJeitos, mais: S.telaMais, aconteceu: S.telaAconteceu };
const CHAVE_FORMA = "orbita.testes.forma";
let aberta = null, raiz = null, antes, rolarTopo = false, como = false, forma = "placar", opcoes = {}, entrada = 0;
const lerForma = () => { try { return localStorage.getItem(CHAVE_FORMA) || "placar"; } catch { return "placar"; } };
const guardarForma = () => { try { localStorage.setItem(CHAVE_FORMA, forma); } catch { /* */ } };
const papelVelho = () => { const P = D.estadoPapel(); return !P.dados || Date.now() - P.lidoEm > 10 * 60e3; };

/** Quantas carteiras estão à frente do CDI (ao vivo, desde o início, numa combinação). */
export function aFrenteDoCdi(d = D.doAparelho(), k = "3x1") {
  if (!d?.carteiras?.length) return null;
  return { n: K.placar(d, k, { modo: "vivo", periodo: "tudo" }).cdi, de: d.carteiras.length };
}

/** O cartão dos Testes no Início das Finanças (um só): as formas à frente do CDI (o copy trading conta como uma, pela
 *  carteira de carteiras em 3× · 1 min) e as carteiras copiadas. Só com dados; `aoAbrir` vai para a aba. */
export function cartaoInicio(el, aoAbrir) {
  const d = D.doAparelho(), { lidoEm } = D.estado();
  if (!d || Date.now() - lidoEm > 10 * 60e3) D.carregar().then((n) => { if (!d && n) window.dispatchEvent(new Event("oq-financas")); });
  const p = D.papelDoAparelho();
  if (papelVelho()) D.carregarPapel().then((n) => { if (!p && n) window.dispatchEvent(new Event("oq-financas")); });
  const temCopia = !!d?.carteiras?.length, fp = p ? F.formasAFrente(p) : { n: 0, de: 0 };
  if (!temCopia && !fp.de) return;
  const f = temCopia ? aFrenteDoCdi(d, "3x1") : null, rc = temCopia ? S.resumoCopia(d, "3x1") : null;
  const nF = fp.n + (rc?.frente ? 1 : 0), deF = fp.de + (temCopia ? 1 : 0);
  const titulo = fp.de ? `Testes: ${nF} de ${deF} formas à frente do CDI` : `Testes: ${f.n} ${f.n === 1 ? "carteira" : "carteiras"} à frente do CDI`;
  const atr = [temCopia && D.atraso(d) != null ? D.atraso(d) : null, p && D.atraso(p, "papel") != null ? D.atraso(p, "papel") : null].filter(x => x != null);
  const sub = [fp.de && temCopia ? `copy trading: ${f.n} de ${f.de} carteiras` : temCopia ? `de ${f.de} copiadas no papel · 3× e 1 min` : null, "saldo fictício"].filter(Boolean).join(" · ");
  const b = document.createElement("button"); b.className = "fi-linha-link fi-ts-inicio";
  b.innerHTML = `${icone("🧪", "ico3d")}<span><b>${titulo}</b><small>${atr.length ? `<b class="fi-ts-atrasado">sem dados novos há ${Math.max(...atr)} h</b> · ` : ""}${sub}</small></span><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  b.onclick = aoAbrir;
  el.append(b);
}

/** A aba Testes: monta num invólucro próprio (o desenhar das Finanças move os nós; o invólucro continua o mesmo).
 *  `opts.aoLado(dir)`: deslizar além da primeira ou da última forma vai para a aba vizinha das Finanças. */
export function telaTestes(el, opts = {}) {
  raiz = document.createElement("div"); raiz.className = "fi-testes";
  opcoes = opts; forma = lerForma();
  // trocar de parte pela barra de baixo começa a parte nova do alto (antes da troca: o clique do botão redesenha)
  if (opts.barra && !opts.barra.dataset.ligada) { opts.barra.dataset.ligada = ""; opts.barra.addEventListener("click", (e) => { if (e.target.closest("button")) rolarTopo = true; }, true); }
  ligarAjuda(raiz);
  ligarDeslizeFormas(raiz);
  O.vigiar(raiz, () => forma); // com o olho fechado, o que entrar depois (a explicação do "?"…) também se oculta
  el.append(raiz);
  desenhar();
  const { dados, lidoEm } = D.estado(), r = raiz;
  if (!dados || Date.now() - lidoEm > 10 * 60e3) D.carregar().then(() => { if (r === raiz && r.isConnected) desenhar(); });
  if (papelVelho()) D.carregarPapel().then(() => { if (r === raiz && r.isConnected) desenhar(); });
  if (!D.estadoPapel().dados) desenhar(); // mostra o "Buscando…" das outras formas
}

/** As novidades comparam com a visita anterior: a marca dela é lida uma vez por sessão e a de agora é guardada. */
function marcarVisita(d) {
  if (antes !== undefined) return;
  try { antes = JSON.parse(localStorage.getItem(VISTO) || "null"); } catch { antes = null; }
  try { localStorage.setItem(VISTO, JSON.stringify(K.marca(d))); } catch { /* */ }
}

function rodape(el) {
  const { dados: d, carregando, erro } = D.estado();
  const s = document.createElement("div"); s.className = "fi-ts-rodape";
  const rd = d?.rodada;
  s.innerHTML = `<p class="fi-dica">Atualizado em ${d ? quando(d.agora) : "—"}${rd ? ` · ${rd.operacoes} ${rd.operacoes === 1 ? "operação nova" : "operações novas"} na rodada` : ""}${rd?.erros?.length ? ` · ${rd.erros.length} ${rd.erros.length === 1 ? "erro" : "erros"}` : ""} · ${d?.config?.frequencia || "a cada 2 h"}${d?.funil?.semana != null ? ` · ${d.funil.semana} analisadas em 7 dias` : ""}.${erro ? ` <b>${erro}</b>` : ""}</p>`;
  s.append(botaoBuscar(carregando, () => D.carregar({ forcar: true }), () => D.estado().erro));
  el.append(s);
}
/** O rodapé das outras formas (a rodada da forma aberta) e o do Placar (as duas fontes). */
function rodapePapel(el) {
  const P = D.estadoPapel(), p = P.dados, f = p?.formas?.[forma], rd = f?.rodada;
  const s = document.createElement("div"); s.className = "fi-ts-rodape";
  s.innerHTML = `<p class="fi-dica">Atualizado em ${f?.agora || p?.agora ? quando(f?.agora || p.agora) : "—"}${rd?.pedidos != null ? ` · ${rd.pedidos} pedidos em ${Math.round(rd.segundos || 0)} s` : ""}${rd?.erros?.length ? ` · ${rd.erros.length} ${rd.erros.length === 1 ? "erro" : "erros"}` : ""} · ${f?.config?.frequencia || "a cada 6 h"}.${P.erro ? ` <b>${P.erro}</b>` : ""}</p>`;
  s.append(botaoBuscar(P.carregando, () => D.carregarPapel({ forcar: true }), () => D.estadoPapel().erro));
  el.append(s);
}
function rodapePlacar(el) {
  const d = D.estado().dados, P = D.estadoPapel();
  const s = document.createElement("div"); s.className = "fi-ts-rodape";
  s.innerHTML = `<p class="fi-dica">Copy trading: ${d ? quando(d.agora) : "—"} (${d?.config?.frequencia || "a cada 2 h"}) · outras formas: ${P.dados ? quando(P.dados.agora) : "—"} (a cada 6 h).${D.estado().erro ? ` <b>${D.estado().erro}</b>` : ""}${P.erro ? ` <b>${P.erro}</b>` : ""}</p>`;
  s.append(botaoBuscar(D.estado().carregando || P.carregando, () => Promise.all([D.carregar({ forcar: true }), D.carregarPapel({ forcar: true })]), () => D.estado().erro || D.estadoPapel().erro));
  el.append(s);
}
function botaoBuscar(carregando, buscar, erro) {
  const b = document.createElement("button"); b.className = "botao secundario fi-ts-atualizar"; b.textContent = carregando ? "Buscando…" : "Buscar de novo";
  b.onclick = async () => { b.disabled = true; b.textContent = "Buscando…"; await buscar(); const e = erro(); if (e) toast(e, 4000); desenhar(); };
  return b;
}

/** Os dados pararam de chegar: a rodada mais nova é de N horas atrás (D.ATRASO_H). */
export function avisoAtraso(el, d, tipo = "mercado") {
  const h = D.atraso(d, tipo);
  if (h == null) return;
  const t = h >= 48 ? `${Math.floor(h / 24)} dias` : `${h} h`;
  el.insertAdjacentHTML("beforeend", `<p class="fi-ts-atraso" role="alert">${icone("⚠️", "ico-inline")} <b>Sem dados novos há ${t}.</b> O GitHub às vezes atrasa ou pula os horários agendados; se passar de um dia, os testes podem ter parado (workflows do repositório orbita-testes).</p>`);
}

/** Os chips na ordem: Placar, Copy trading e as formas com dados. */
function chipsDe(p) { return ["placar", "copia", ...F.formasPresentes(p)]; }
const NOME_CHIP = (p, k) => (k === "placar" ? "Placar" : k === "copia" ? "Copy trading" : F.nomeForma(p, k));

/** As partes da tela aberta (Como está indo / Versões / O que aconteceu… de cada forma, as 4 abas da cópia ou as partes
 *  da carteira, todas `.fi-ts-subs`) vão para a barra fixa embaixo, logo acima das abas das Finanças (09/11/2026, pedido
 *  do Alediov: "o menu de trocar de abas na parte de baixo"); sem `opcoes.barra` (ou sem partes), ficam onde estão. */
function porNaBarra() {
  const b = opcoes.barra;
  if (!b || !raiz) return;
  const ch = raiz.querySelector(".fi-ts-subs");
  if (ch) { ch.setAttribute("role", "tablist"); ch.querySelectorAll("button").forEach(x => { x.setAttribute("role", "tab"); x.setAttribute("aria-selected", String(x.classList.contains("on"))); }); }
  if (ch) b.replaceChildren(ch); else b.replaceChildren();
}

function desenhar() {
  if (O.estaOculto()) O.prepararRotulos(D.estado().dados, D.estadoPapel().dados);
  desenharTela();
  porNaBarra();
  if (!raiz) return;
  // o olho (09/11/2026): no alto de toda tela da aba (na carteira e no Como funciona, numa linha própria)
  if (!raiz.querySelector(".fi-ts-olho")) { const l = document.createElement("div"); l.className = "fi-ts-olho-linha"; l.append(O.botaoOlho(desenhar)); raiz.prepend(l); }
  raiz.toggleAttribute("data-oculto", O.estaOculto());
  if (O.estaOculto()) { O.ocultarEm(raiz, forma); O.ocultarEm(opcoes.barra, forma); }
}
function desenharTela() {
  if (!raiz) return;
  const { dados: d, carregando, erro } = D.estado(), P = D.estadoPapel(), p = P.dados;
  raiz.innerHTML = "";
  if (d) marcarVisita(d);
  const ctx = { d, antes, redesenhar: desenhar, rodape,
    abrir: (e) => { aberta = e; rolarTopo = true; desenhar(); }, fechar: () => { aberta = null; rolarTopo = true; desenhar(); },
    fecharComo: () => { como = false; rolarTopo = true; desenhar(); } };
  const lista = chipsDe(p);
  if (!lista.includes(forma) && !P.carregando) forma = "placar";
  if (forma === "copia" && aberta && d) {
    const c = d.carteiras.find(x => x.endereco === aberta);
    if (c) { delete raiz.dataset.semDeslize; telaCarteira(raiz, ctx, c); topo(); return; }
    aberta = null;
  }
  if (forma === "copia" && como && d) { delete raiz.dataset.semDeslize; S.telaComo(raiz, ctx); topo(); return; }
  raiz.dataset.semDeslize = ""; // o deslizar daqui troca a forma (ligarDeslizeFormas), não a aba das Finanças
  const topoAba = document.createElement("div"); topoAba.className = "fi-ts-topo";
  topoAba.innerHTML = `<p class="fi-ts-aviso" role="note">${icone("🧪", "ico-inline")} ${AVISO}</p>`;
  topoAba.append(O.botaoOlho(desenhar));
  if (d && forma === "copia") {
    const b = document.createElement("button"); b.className = "fi-ts-como-btn"; b.innerHTML = `${icone("💡", "ico-inline")}<span>Como funciona</span>`;
    b.onclick = () => { como = true; rolarTopo = true; desenhar(); };
    topoAba.append(b);
  }
  raiz.append(topoAba);
  const ch = document.createElement("div"); ch.className = "fi-ts-formas"; ch.setAttribute("role", "tablist"); ch.setAttribute("aria-label", "Formas de testar");
  ch.innerHTML = lista.map(k => `<button role="tab" data-forma="${k}" aria-selected="${k === forma}" class="${k === forma ? "on" : ""}">${icone(F.ICONE_FORMA[k] || "🧪", "ico-inline")}<span>${escapar(NOME_CHIP(p, k))}</span></button>`).join("")
    + (P.carregando && !p ? `<span class="fi-ts-formas-busca">buscando…</span>` : "");
  ch.querySelectorAll("button").forEach(b => (b.onclick = () => irForma(b.dataset.forma)));
  raiz.append(ch);
  requestAnimationFrame(() => { const on = ch.querySelector(".on"); if (on && ch.scrollWidth > ch.clientWidth) ch.scrollLeft = Math.max(0, on.offsetLeft - (ch.clientWidth - on.offsetWidth) / 2); });
  const corpo = document.createElement("div"); corpo.className = "fi-ts-corpo";
  if (entrada && !matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) corpo.classList.add(entrada > 0 ? "entra-d" : "entra-e");
  entrada = 0;
  raiz.append(corpo);
  if (forma === "placar") {
    if (d?.exemplo || p?.exemplo) corpo.insertAdjacentHTML("beforeend", `<p class="fi-ts-exemplo">Dados de exemplo (mercado de mentira).</p>`);
    if (d) avisoAtraso(corpo, d);
    if (p) avisoAtraso(corpo, p, "papel");
    telaPlacar(corpo, { d, p, abrirForma: irForma, rodape: rodapePlacar, carregandoPapel: P.carregando, erroPapel: P.erro });
  } else if (forma === "copia") corpoCopia(corpo, ctx, { d, carregando, erro });
  else if (p?.formas?.[forma]) {
    if (p.exemplo) corpo.insertAdjacentHTML("beforeend", `<p class="fi-ts-exemplo">Dados de exemplo (mercado de mentira).</p>`);
    F.telaForma(corpo, { p, k: forma, redesenhar: desenhar, avisoAtraso: (el) => avisoAtraso(el, p, "papel"), rodape: rodapePapel });
  } else corpo.insertAdjacentHTML("beforeend", `<p class="fi-dica">Buscando os testes…</p>`);
  topo();
}
/** O copy trading: exatamente o de antes (as 4 abas). */
function corpoCopia(el, ctx, { d, carregando, erro }) {
  if (!d) {
    el.insertAdjacentHTML("beforeend", `<p class="fi-dica">${carregando ? "Buscando os testes…" : (erro || "Sem dados dos testes ainda.")}</p>`);
    if (!carregando) rodape(el);
    return;
  }
  if (d.exemplo) el.insertAdjacentHTML("beforeend", `<p class="fi-ts-exemplo">Dados de exemplo (mercado de mentira).</p>`);
  avisoAtraso(el, d);
  if (!TELAS[sel.sub]) sel.sub = "indo";
  const ch = document.createElement("div"); ch.className = "fi-ts-subs fi-ts-subs4"; ch.dataset.semDeslize = "";
  ch.innerHTML = SUBS.map(([k, n, e]) => `<button data-sub="${k}" class="${sel.sub === k ? "on" : ""}">${icone(e, "ico3d")}<span>${n}</span></button>`).join("");
  ch.querySelectorAll("button").forEach(b => (b.onclick = () => { sel.sub = b.dataset.sub; guardarSel(); navigator.vibrate?.(6); desenhar(); }));
  el.append(ch);
  TELAS[sel.sub](el, ctx);
}
function topo() { if (rolarTopo) { rolarTopo = false; raiz.closest(".fi-tela")?.scrollTo?.(0, 0); } }

/** Troca a forma (pelo chip, pelo Placar ou pelo deslizar). */
export function irForma(k, dir = 0) {
  if (!k || k === forma) return;
  const l = chipsDe(D.estadoPapel().dados);
  entrada = dir || Math.sign(l.indexOf(k) - l.indexOf(forma));
  forma = k; aberta = null; como = false; guardarForma(); rolarTopo = true;
  navigator.vibrate?.(6);
  desenhar();
}

/** Deslizar o dedo na aba troca a forma, como as abas das Finanças (que ficam de fora: `data-sem-deslize` na raiz);
 *  além da primeira ou da última, vai para a aba vizinha das Finanças (`opcoes.aoLado`). */
function ligarDeslizeFormas(el) {
  let x0 = 0, y0 = 0, modo = null, dx = 0, kz = 1, rastro = [];
  const lateral = (alvo) => {
    for (let e = alvo; e && e !== el; e = e.parentElement) {
      if (e.matches?.("input, textarea, select, svg.fi-graf, [data-sem-deslize]")) return true;
      const ox = getComputedStyle(e).overflowX;
      if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 2) return true;
    }
    return false;
  };
  const listaAberta = () => el.dataset.semDeslize != null && !document.querySelector(".fi-folha-fundo");
  const largura = () => innerWidth / kz;
  const soltar = () => { el.style.transition = "transform .25s ease, opacity .25s"; el.style.transform = ""; el.style.opacity = ""; setTimeout(() => { el.style.transition = ""; }, 260); };
  el.addEventListener("touchstart", (e) => {
    modo = null; dx = 0; rastro = [];
    if (e.touches.length !== 1 || !listaAberta()) { modo = "nada"; return; }
    const p = e.touches[0];
    if (p.clientX < 20 || p.clientX > innerWidth - 20 || lateral(e.target)) { modo = "nada"; return; }
    kz = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
    x0 = p.clientX / kz; y0 = p.clientY / kz; rastro = [[performance.now(), x0]];
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (modo === "nada" || e.touches.length !== 1) return;
    const p = e.touches[0], ddx = p.clientX / kz - x0, ddy = p.clientY / kz - y0;
    if (!modo) { if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return; modo = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? "lado" : "nada"; if (modo === "nada") return; }
    rastro.push([performance.now(), p.clientX / kz]); if (rastro.length > 12) rastro.shift();
    dx = ddx;
    if (matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    el.style.transform = `translateX(${dx * 0.6}px)`; el.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / (largura() * 1.6)));
  }, { passive: true });
  el.addEventListener("touchend", () => {
    if (modo !== "lado") { modo = null; return; }
    modo = null;
    const [tf, xf] = rastro[rastro.length - 1], ref = rastro.find(([tt]) => tf - tt <= 120) || rastro[0];
    const vel = (xf - ref[1]) / Math.max(16, tf - ref[0]), dir = dx < 0 ? 1 : -1;
    const vai = Math.abs(dx) > Math.min(120, largura() * 0.3) || (Math.abs(vel) > 0.3 && Math.abs(dx) >= 28 && Math.sign(vel) === Math.sign(dx));
    el.style.transition = ""; el.style.transform = ""; el.style.opacity = "";
    if (!vai) return soltar();
    const l = chipsDe(D.estadoPapel().dados), alvo = l[l.indexOf(forma) + dir];
    if (alvo) irForma(alvo, dir); else opcoes.aoLado?.(dir);
  });
  el.addEventListener("touchcancel", () => { if (modo === "lado") soltar(); modo = null; });
}
