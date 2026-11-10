// Finanças (6ª área do Órbita, config.area "financas"; pedido do Alediov em 27/10/2026: "controle de todo o meu dinheiro
// da forma mais automatizada possível. Vamos por partes"). Abas: Mês (o mês: entradas previstas × recebidas, gastos por
// categoria com o limite e o que ainda dá para gastar), Extrato (os lançamentos), Orçamento (limites por categoria com a
// sugestão do app, quanto guardar e as entradas fixas), Automações (Check-ins, Farms e Ping-Pong; na fase 1 só o Slice,
// com a saúde da macro e o "Conectar o MacroDroid") e Gráficos (entradas × saídas e gastos por categoria dos últimos
// meses). As contas estão em contas.js; a leitura da issue do MacroDroid e a cotação, em ponte.js. Atalhos de um toque
// (27/10/2026): "Almoço" (Comida) e "Recarreguei" (Transporte, com a estimativa das passagens pela Agenda).
// Estado em E().financas (sincroniza entre aparelhos como o resto).
import { E, salvar, hojeISO } from "../estado.js";
import { toast, escapar, modal } from "../ui.js";
import { tocar } from "../sons.js";
import { icone } from "../icones.js";
import { ligarTeclado, dataIso, dataBr } from "../scan/teclado.js";
import * as C from "./contas.js";
import * as P from "./ponte.js";
import * as TS from "./testes.js";

const F = P.financas;
let ouvindo = false, raiz = null, opts = {}, aba = "inicio", sub = null, voltarPara = null, mes = C.mesDe(hojeISO()), filtro = { tipo: "tudo", cat: "" }, tecl = null, geracao = 0;
const $ = (s, r = raiz) => r?.querySelector(s);
const menosMov = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// abas (pedido do Alediov, 30/10/2026: "ainda não me agrada"; escolha dele): o resumo, os gastos do mês (com o extrato,
// os limites e os gráficos dos meses), o rendimento (Ping-Pong, testes e projeção) e as macros
// Testes (02/11/2026): a cópia de carteiras da Hyperliquid no papel, numa aba própria depois de Rendimento (financas/testes.js)
const ABAS = [["inicio", "Início", "🏠"], ["gastos", "Gastos", "🧾"], ["rendimento", "Rendimento", "📈"], ["testes", "Testes", "🧪"], ["auto", "Automações", "🤖"]];
const ABA_ANTIGA = { mes: "inicio", extrato: "gastos", orcamento: "gastos", graficos: "gastos" };
const ORDEM = ABAS.map(a => a[0]);
const ICONES_CAT = ["🧰", "🎓", "🎫", "🏷️", "📚", "🧪", "🦷", "💊", "🍽️", "☕", "🚌", "🏠", "📱", "🛒", "💳", "🎮", "🎁", "💡", "🎒", "🎨", "🤝", "✏️", "💵", "🪙", "🏦", "💸", "🏓", "⛏️"];

const I = {
  ant: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  prox: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  ler: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 01-14.3 4.9M4 12A8 8 0 0118.3 7.1M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="16" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="10" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="2.1"/></svg>',
  copiar: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  voltar: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pontos: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
};

// ---------------------------------------------------------------- área
export async function abrirTelaFinancas(el, o = {}) {
  raiz = el; opts = o;
  raiz.classList.add("fi");
  cobrirFundo(el);
  raiz.innerHTML = `
    <header class="fi-topo">
      <button class="fi-area" aria-label="Trocar de área"><span class="fi-logo">${o.logo || ""}</span><span><b>Finanças</b><small>Trocar de Área ▾</small></span></button>
      <span class="fi-sinc" hidden>lendo…</span>
      <button class="fi-icone" data-acao="ler" aria-label="Ler as automações agora">${I.ler}</button>
      <button class="fi-icone" data-acao="ajustes" aria-label="Ajustes das Finanças">${I.ajustes}</button>
    </header>
    <main class="fi-tela"></main>
    <footer class="fi-baixo">
      <div class="fi-subbarra" role="tablist" aria-label="Partes"></div>
      <nav class="fi-abas" aria-label="Abas das Finanças">${ABAS.map(([k, n, ico]) => `<button data-aba="${k}">${icone(ico, "ico3d")}<span>${n}</span></button>`).join("")}<i class="fi-abas-ind" aria-hidden="true"></i></nav>
    </footer>
    <button class="fi-novo" aria-label="Novo lançamento">${I.mais}</button>`;
  // as abas ficam embaixo (09/11/2026, pedido do Alediov: como as dos Estudos); o "+" e o Desfazer sobem a altura da barra
  // (`--fi-baixo`), que muda quando os Testes põem a barra das partes por cima (`.fi-subbarra`)
  const baixo = raiz.querySelector(".fi-baixo"), medir = () => raiz.style.setProperty("--fi-baixo", `${baixo.offsetHeight}px`);
  if (typeof ResizeObserver === "function") new ResizeObserver(medir).observe(baixo);
  medir();
  if (!document.querySelector('link[href="scan.css"]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "scan.css"; document.head.append(l); } // o teclado próprio
  tecl = ligarTeclado(raiz, raiz);
  // a altura do teclado próprio (numérico ou de texto), para a folha caber acima dele
  // (`fi-tec` sai 0,4 s depois do teclado: o toque que o fechou não pode cair no fundo da folha, que a fecharia)
  let tTec = null;
  new MutationObserver(() => {
    const aberto = raiz.classList.contains("com-teclado");
    clearTimeout(tTec);
    if (!aberto) { if (raiz.classList.contains("fi-tec")) tTec = setTimeout(() => raiz.classList.remove("fi-tec"), 400); return; }
    if (!raiz.classList.contains("fi-tec")) raiz.classList.add("fi-tec");
    requestAnimationFrame(() => {
      const t = raiz.querySelector(".os-teclado");
      if (t && !t.hidden) raiz.style.setProperty("--fi-tec", `${Math.round(t.getBoundingClientRect().height / ((raiz.getBoundingClientRect().width / raiz.offsetWidth) || 1))}px`);
      const lab = raiz.querySelector(".fi-folha .ot-ativo")?.closest("label"), fo = lab?.closest(".fi-folha");
      if (lab && fo) { const a = lab.getBoundingClientRect(), b = fo.getBoundingClientRect(); if (a.bottom > b.bottom - 8 || a.top < b.top) fo.scrollTop += a.top - b.top - 60; }
    });
  }).observe(raiz, { attributes: true, attributeFilter: ["class"] });
  $(".fi-area").onclick = () => opts.aoTrocarArea?.();
  $('[data-acao="ajustes"]').onclick = folhaAjustes;
  $('[data-acao="ler"]').onclick = () => lerAgora(true);
  $(".fi-novo").onclick = () => editarLancamento(null);
  raiz.querySelectorAll(".fi-abas button").forEach(b => (b.onclick = () => irAba(b.dataset.aba)));
  ligarDeslize();
  if (!ouvindo) { // uma vez só (a área pode abrir e fechar várias vezes)
    ouvindo = true;
    window.addEventListener("oq-financas", () => { if (raiz?.isConnected && !document.querySelector(".fi-folha-fundo") && !raiz.classList.contains("com-teclado")) desenhar(false); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && raiz?.isConnected) setTimeout(() => lerAgora(false), 3000); });
  }
  F(); salvar();
  await desenhar();
  lerAgora(false);
}
/** Lê as automações (issue do MacroDroid) e a cotação; `forcar`: o botão do topo e o "Ler agora". */
async function lerAgora(forcar) {
  const s = $(".fi-sinc");
  if (!F().ponte?.issue) { if (forcar) { sub = "conectar"; aba = "auto"; desenhar(); } return; }
  if (s) s.hidden = false;
  const r = await P.lerColetas({ forcar });
  if (s) s.hidden = true;
  P.buscarCotacao().catch(() => {});
  if (!forcar) return;
  if (r.erro) toast(r.erro, 4000);
  else if (r.pulou === "offline") toast("Sem internet ou sem o token do app agora.");
  else toast(r.novos ? `${r.novos} ${r.novos === 1 ? "registro novo" : "registros novos"} das macros` : "Nada novo das macros");
}
// o que fica coberto não pinta nem anima (como no Xadrez): `fi-cobre` no <html> esconde os Estudos atrás das Finanças
function cobrirFundo(el) {
  const html = document.documentElement;
  const ver = () => {
    const viva = el.isConnected && el.style.opacity !== "0";
    html.classList.toggle("fi-cobre", viva);
    if (!el.isConnected) { obs1.disconnect(); obs2.disconnect(); }
  };
  const obs1 = new MutationObserver(ver), obs2 = new MutationObserver(ver);
  obs1.observe(document.body, { childList: true });
  obs2.observe(el, { attributes: true, attributeFilter: ["style"] });
  ver();
}

function irAba(nova) {
  const i = ORDEM.indexOf(aba), j = ORDEM.indexOf(nova);
  aba = nova; sub = null; voltarPara = null; tocar("toque");
  desenhar(true, j === i ? 0 : j > i ? 1 : -1);
}
function moverIndicador(de = null, para = null, k = 0) {
  const nav = $(".fi-abas"), ind = $(".fi-abas-ind"); if (!ind) return;
  if (de && para) {
    ind.style.transition = "none";
    ind.style.transform = `translateX(${de.offsetLeft + (para.offsetLeft - de.offsetLeft) * k}px)`;
    ind.style.width = `${de.offsetWidth + (para.offsetWidth - de.offsetWidth) * k}px`; return;
  }
  const b = nav.querySelector("button.on"); if (!b) return;
  ind.style.transition = ind.style.width ? "" : "none";
  ind.style.transform = `translateX(${b.offsetLeft}px)`; ind.style.width = `${b.offsetWidth}px`;
}

async function desenhar(topo = true, dir = 0) {
  if (!raiz) return;
  const g = ++geracao;
  raiz.querySelectorAll(".fi-abas button").forEach(b => b.classList.toggle("on", b.dataset.aba === aba));
  moverIndicador();
  const t = $(".fi-tela"), alvo = document.createElement("div"), rol = t.scrollTop, barra = $(".fi-subbarra");
  barra.replaceChildren(); // só os Testes põem as partes aqui (testes.js `opts.barra`)
  $(".fi-novo").hidden = !!sub || !["inicio", "gastos"].includes(aba);
  try {
    if (sub && C.FONTES[sub]) telaFonte(alvo, sub);
    else if (sub === "conectar") telaConectar(alvo);
    else if (sub === "dinheiro") telaDinheiro(alvo);
    else if (sub === "orcamento") telaOrcamento(alvo);
    else if (aba === "gastos") telaGastos(alvo);
    else if (aba === "rendimento") telaRendimento(alvo);
    else if (aba === "testes") TS.telaTestes(alvo, { barra, aoLado: (d) => { const a = ORDEM[ORDEM.indexOf("testes") + d]; if (a) irAba(a); } });
    else if (aba === "auto") telaAuto(alvo);
    else telaInicio(alvo);
  } catch (e) { console.error(e); alvo.innerHTML = `<p class="fi-vazio">${escapar(e.message || String(e))}</p>`; }
  if (g !== geracao) return;
  t.replaceChildren(...alvo.childNodes);
  tecl?.preparar(t);
  P.enviarAoWidget(); // o widget "Seu dinheiro" acompanha (só manda se mudou)
  t.scrollTop = topo ? 0 : rol;
  if (dir && !menosMov()) { t.classList.remove("entra-d", "entra-e"); void t.offsetWidth; t.classList.add(dir > 0 ? "entra-d" : "entra-e"); }
}

// deslizar o dedo troca de aba (como nas Músicas e no Scanner); numa subtela, para a direita volta
function ligarDeslize() {
  const t = $(".fi-tela");
  let x0 = 0, y0 = 0, modo = null, dx = 0, kz = 1, rastro = [];
  const destino = (d) => sub ? (d < 0 ? "voltar" : null) : ORDEM[ORDEM.indexOf(aba) + d] || null;
  const bloqueado = () => raiz.classList.contains("com-teclado") || document.querySelector(".fi-folha-fundo");
  const lateral = (el) => { for (let e = el; e && e !== t; e = e.parentElement) { if (e.matches?.("input, textarea, select, svg.fi-graf, [data-sem-deslize]")) return true; const ox = getComputedStyle(e).overflowX; if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 2) return true; } return false; };
  const volta = () => { moverIndicador(); t.style.transition = "transform .3s cubic-bezier(.3,1.3,.5,1), opacity .3s"; t.style.transform = ""; t.style.opacity = ""; setTimeout(() => (t.style.transition = ""), 320); };
  t.addEventListener("touchstart", (e) => {
    modo = null; dx = 0; rastro = [];
    if (e.touches.length !== 1 || bloqueado()) { modo = "nada"; return; }
    const p = e.touches[0];
    if (p.clientX < 20 || p.clientX > innerWidth - 20 || lateral(e.target)) { modo = "nada"; return; }
    kz = t.getBoundingClientRect().width / (t.offsetWidth || 1) || 1;
    x0 = p.clientX / kz; y0 = p.clientY / kz; rastro = [[performance.now(), x0]];
  }, { passive: true });
  t.addEventListener("touchmove", (e) => {
    if (modo === "nada" || e.touches.length !== 1) return;
    const p = e.touches[0], ddx = p.clientX / kz - x0, ddy = p.clientY / kz - y0;
    if (!modo) { if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return; modo = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? "lado" : "nada"; if (modo === "nada") return; }
    rastro.push([performance.now(), p.clientX / kz]); if (rastro.length > 12) rastro.shift();
    dx = ddx;
    if (menosMov()) return;
    const alvo = destino(dx < 0 ? 1 : -1);
    const des = alvo ? dx : Math.sign(dx) * Math.pow(Math.abs(dx), 0.72);
    t.style.transform = `translateX(${des}px)`; t.style.opacity = String(1 - Math.min(0.45, Math.abs(des) / ((innerWidth / kz) * 1.4)));
    if (alvo && alvo !== "voltar") { const nav = $(".fi-abas"); moverIndicador(nav.querySelector(`[data-aba="${aba}"]`), nav.querySelector(`[data-aba="${alvo}"]`), Math.min(1, Math.abs(dx) / ((innerWidth / kz) * 0.6))); }
  }, { passive: true });
  t.addEventListener("touchend", () => {
    if (modo !== "lado") { modo = null; return; }
    modo = null;
    const [tf, xf] = rastro[rastro.length - 1], ref = rastro.find(([tt]) => tf - tt <= 120) || rastro[0];
    const vel = (xf - ref[1]) / Math.max(16, tf - ref[0]), dir = dx < 0 ? 1 : -1, alvo = destino(dir);
    const vai = alvo && (Math.abs(dx) > Math.min(120, (innerWidth / kz) * 0.3) || (Math.abs(vel) > 0.3 && Math.abs(dx) >= 28 && Math.sign(vel) === Math.sign(dx)));
    t.style.transition = ""; t.style.transform = ""; t.style.opacity = "";
    if (!vai) return volta();
    if (alvo === "voltar") { sub = voltarPara; voltarPara = null; desenhar(true, -1); } else irAba(alvo);
  });
  t.addEventListener("touchcancel", () => { if (modo === "lado") volta(); modo = null; });
}

// ---------------------------------------------------------------- pedaços comuns
const ico = (e) => icone(e, "ico3d");
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const cat = (id) => F().categorias[id] || { nome: "Sem categoria", icone: "🏷️", cor: 8 };
const dataCurta = (dia) => new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const diaLongo = (dia) => new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
function navMes(el, rotulo = "") {
  const n = document.createElement("div"); n.className = "fi-mesnav";
  const atual = C.mesDe(hojeISO());
  n.innerHTML = `<button class="fi-icone" data-d="-1" aria-label="Mês anterior">${I.ant}</button><div><b>${maiuscula(C.nomeMes(mes))}</b>${rotulo ? `<small>${rotulo}</small>` : mes === atual ? "<small>este mês</small>" : `<small class="link">voltar para ${C.nomeMes(atual, { ano: false })}</small>`}</div><button class="fi-icone" data-d="1" aria-label="Próximo mês">${I.prox}</button>`;
  n.querySelectorAll("[data-d]").forEach(b => (b.onclick = () => { mes = C.somaMes(mes, +b.dataset.d); tocar("toque"); desenhar(false); }));
  n.querySelector(".link")?.addEventListener("click", () => { mes = atual; desenhar(false); });
  el.append(n);
}
function secao(el, titulo, extra = "") {
  const s = document.createElement("section"); s.className = "fi-sec";
  s.innerHTML = `<div class="fi-sec-cab"><h3>${titulo}</h3>${extra}</div>`;
  el.append(s); return s;
}
const barra = (p, cls = "") => `<span class="fi-barra ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></i></span>`;
const estadoP = (p) => p == null ? "" : p > 1 ? "passou" : p >= 0.8 ? "perto" : "";
function linhaLanc(l) {
  const c = cat(l.cat), b = document.createElement("button"); b.className = `fi-lanc ${l.tipo}`;
  b.innerHTML = `<span class="fi-lanc-ico c${c.cor || 8}">${ico(c.icone)}</span><span class="fi-lanc-tx"><b>${escapar(l.desc || c.nome)}</b><small>${escapar(c.nome)}${l.forma ? ` · ${escapar(l.forma)}` : ""}${l.saque ? " · saque" : ""}</small></span><span class="fi-lanc-v">${C.reais(l.tipo === "saida" ? -l.valor : l.valor, { sinal: true })}</span>`;
  b.onclick = () => editarLancamento(l.id);
  return b;
}
async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); }
  catch { const ta = document.createElement("textarea"); ta.value = txt; document.body.append(ta); ta.select(); try { document.execCommand("copy"); } catch { /* */ } ta.remove(); }
  toast("Copiado"); navigator.vibrate?.(8);
}

// ---------------------------------------------------------------- Início
// o resumo: o dinheiro dele e quanto rende, o que ainda dá para gastar, os atalhos, o que precisa de atenção
function telaInicio(el) {
  const f = F(), hoje = hojeISO(), atual = C.mesDe(hoje), r = C.resumoMes(f, atual, hoje), cot = C.cotacao(f, hoje);
  mes = atual;
  // o dinheiro parado fora do Render (03/11/2026): com ele, o "Para conferir" sobe para o alto, antes de tudo
  const parados = C.dinheiroParado(f), alto = document.createElement("div");
  el.append(alto);
  heroiDinheiro(el, f, hoje, cot);
  heroiMes(el, r, atual);
  atalhos(el); cartaoPassagens(el);
  // o que precisa de atenção: entradas que já deviam ter chegado, saídas fixas a pagar (ou sem valor) e macros com erro
  const pend = [...r.pendentes, ...r.fixasSai.filter(x => !x.lanc && !x.pulou && (x.devida || x.semValor))];
  const falhas = [...C.FONTES_SAUDE, "pingpong", "orquestrador"].map(fo => ({ fo, sd: C.saude(f, fo, hoje) }))
    .filter(({ fo, sd }) => ["erro", "incompleta"].includes(sd.estado) || (sd.estado === "faltou" && fo !== "pingpong"));
  if (pend.length || falhas.length || parados.length) {
    const sp = secao(parados.length ? alto : el, "Para conferir");
    for (const p of parados) sp.append(cartaoParado(f, p));
    // "Conferi as Finanças" (pedido do Alediov, 02/11/2026): marca o DIA como conferido (o que deu errado ele viu e o
    // que havia para fazer ele fez), sem mudar a situação das macros; tira o item do Meu dia de hoje
    sp.append(blocoConferir(f, hoje));
    for (const fx of pend) sp.append(linhaFixa(fx));
    for (const { fo, sd } of falhas) {
      const b = document.createElement("button"); b.className = "fi-linha-link fi-pend-macro";
      const [e, txt] = ROT_SAUDE[sd.estado];
      b.innerHTML = `${ico(e)}<span>${escapar(C.nomeFonte(fo))}: ${txt.toLowerCase()}<small>${escapar(sd.deHoje[0]?.etapa ? `na etapa ${sd.deHoje[0].etapa}` : "veja o registro da macro")}</small></span>${I.prox}`;
      b.onclick = () => { aba = "auto"; sub = fo; desenhar(); };
      sp.append(b);
    }
  }
  TS.cartaoInicio(el, () => irAba("testes")); // "Testes: N carteiras à frente do CDI" (só com dados)
  // últimos lançamentos
  const ls = C.lancamentos(f, atual).slice(0, 4);
  const su = secao(el, "Últimos lançamentos", ls.length ? `<button class="fi-link" data-a="ver">Ver os gastos</button>` : "");
  su.querySelector('[data-a="ver"]')?.addEventListener("click", () => irAba("gastos"));
  if (!ls.length) su.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nada lançado em ${C.nomeMes(atual, { ano: false })}. Toque no <b>+</b> para lançar um gasto ou uma entrada.</p>`);
  ls.forEach(l => su.append(linhaLanc(l)));
}

/** O dinheiro parado fora do Render (contas.js `dinheiroParado`): quanto, onde e desde quando, com "Ver o Ping-Pong" e
 *  "Já resolvi" (tira o aviso daquele episódio aqui, no Meu dia e na conferência das 7h15 do Android). */
function cartaoParado(f, p) {
  const t = C.textoParado(p), d = document.createElement("div");
  d.className = "fi-parado"; d.dataset.chave = p.chave; d.setAttribute("role", "alert");
  d.innerHTML = `<span class="fi-parado-l">${ico("💸")}<span><b>${escapar(t.titulo)}</b><small>${escapar(t.texto)}</small></span></span>
    <span class="fi-parado-bts"><button class="botao" data-a="ver">Ver o Ping-Pong</button><button class="botao secundario" data-a="resolvi">Já resolvi</button></span>`;
  d.querySelector('[data-a="ver"]').onclick = () => { aba = "auto"; sub = "pingpong"; voltarPara = null; desenhar(); };
  d.querySelector('[data-a="resolvi"]').onclick = async () => {
    if (!(await modal({ titulo: "Já resolveu?", texto: `${t.curto}: o aviso some daqui, do Meu dia e da conferência da manhã. Se o dinheiro ainda não voltou ao Render, deixe o aviso.`, botoes: [{ texto: "Já resolvi", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] }))) return;
    C.ignorarParado(f, p.chave); salvar(); P.configurarNativo(true);
    window.dispatchEvent(new Event("oq-topo")); desenhar(false); toast("Aviso tirado");
  };
  return d;
}

/** "Conferi as Finanças" do dia, ou a conferência feita (com Desfazer); avisa quando algo novo deu errado depois. */
function blocoConferir(f, hoje) {
  const c = C.conferenciaDoDia(f, hoje), ok = C.financasConferidas(f, hoje), novos = c ? C.problemasDepois(f, hoje, c.em) : [];
  const d = document.createElement("div"); d.className = `fi-conferir${ok ? " ok" : ""}`;
  if (ok) {
    d.innerHTML = `${ico("✅")}<span><b>Conferido hoje às ${hora(c.em)}</b><small>O aviso saiu do Meu dia. As macros continuam com a situação delas.</small></span><button class="fi-link" data-a="desconferir">Desfazer</button>`;
    d.querySelector('[data-a="desconferir"]').onclick = () => { C.conferirFinancas(f, hoje, true); salvar(); window.dispatchEvent(new Event("oq-topo")); desenhar(false); toast("Conferência desfeita"); };
    return d;
  }
  d.innerHTML = `<button class="fi-linha-link fi-conferi" data-a="conferi-dia">${ico("📋")}<span>Conferi as Finanças<small>${novos.length ? `${escapar([...new Set(novos.map(x => C.nomeFonte(x.fonte)))].join(", "))}: deu erro depois da conferência das ${hora(c.em)}` : "vi o que deu errado e fiz o que havia para fazer; tira o aviso do Meu dia de hoje"}</small></span>${I.ok}</button>`;
  d.querySelector('[data-a="conferi-dia"]').onclick = () => { C.conferirFinancas(f, hoje); salvar(); tocar("moeda"); window.dispatchEvent(new Event("oq-topo")); desenhar(false); toast("Finanças conferidas hoje"); };
  return d;
}

/** O cartão grande do dinheiro dele: o total, onde está e quanto rende por dia. */
function heroiDinheiro(el, f, hoje, cot) {
  const d = C.seuDinheiro(f, hoje, cot), rd = C.rendimento(f, hoje), pp = d?.pingpong;
  const b = document.createElement("button"); b.className = `fi-heroi fi-heroi-din${pp?.onde.alerta ? " alerta" : ""}`;
  const partes = d ? d.lugares.filter(l => l.valor != null).map(l => `${l.nome} ${C.reais(l.valor, { curto: true })}`).join(" · ") : "";
  const rende = rd.porDia != null ? `<span class="fi-rende">${icone("📈", "ico-inline")} +${C.reais(rd.porDia)}/dia${rd.taxaAno ? ` · ${(rd.taxaAno * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% ao ano` : ""}</span>` : `<span class="fi-rende fraco">medindo o rendimento</span>`;
  b.innerHTML = `<small>Seu dinheiro</small><strong>${d ? C.reais(d.total) : "—"}</strong>${rende}
    <p>${d ? `${escapar(partes)}${pp ? ` · ${escapar(pp.onde.txt)}` : ""}` : "Aparece com a próxima ida do Ping-Pong, ou informe a Bipa e a ZBD."}${pp?.onde.alerta ? `<br>⚠️ ${escapar(pp.onde.alerta)}` : ""}</p>`;
  b.onclick = () => { sub = "dinheiro"; desenhar(); };
  el.append(b);
}

/** O "ainda pode gastar" do mês (ou o que sobrou, num mês passado). */
function heroiMes(el, r, m) {
  const atual = C.mesDe(hojeISO()), passado = m < atual, futuro = m > atual;
  const disp = Math.max(0, r.rendaPrevista - r.guardar - r.aPagarFixas);
  const h = document.createElement("section"); h.className = `fi-heroi ${r.podeGastar < 0 ? "neg" : ""}`;
  const grande = passado ? r.naMao : r.podeGastar;
  h.innerHTML = `<small>${passado ? `Sobrou em ${C.nomeMes(m, { ano: false })}` : futuro ? `Vai poder gastar em ${C.nomeMes(m, { ano: false })}` : "Ainda pode gastar este mês"}</small>
    <strong>${C.reais(grande)}</strong>
    ${barra(disp ? r.gastos / disp : r.gastos ? 1 : 0, r.gastos > disp ? "passou" : r.gastos > disp * 0.8 ? "perto" : "")}
    <p>${r.rendaPrevista ? `Gastou <b>${C.reais(r.gastos)}</b> de ${C.reais(disp)}${r.guardar ? ` · guardar ${C.reais(r.guardar)} (${r.reservaPct}%)` : ""}${r.aPagarFixas ? ` · fixas a pagar ${C.reais(r.aPagarFixas)}` : ""}` : "Sem renda neste mês: as entradas fixas começam em novembro (ajuste em Gastos → Limites e fixas)."}</p>
    <div class="fi-heroi-num"><span><small>Renda prevista</small><b>${C.reais(r.rendaPrevista)}</b></span><span><small>Recebido</small><b>${C.reais(r.recebido)}</b></span><span><small>Na conta</small><b>${C.reais(r.naMao)}</b></span></div>`;
  el.append(h);
}

/** Uma entrada ou saída fixa do mês, com Recebi/Paguei (ou o menu). */
function linhaFixa(fx) {
  const sai = fx.tipo === "saida", d = document.createElement("div");
  d.className = `fi-fixa ${sai ? "saida" : ""} ${fx.lanc ? "ok" : fx.pulou ? "pulou" : fx.devida || fx.semValor ? "devida" : ""}`;
  const quando = fx.dia ? `dia ${fx.dia}` : "sem dia certo";
  const feito = sai ? "pago" : "recebido";
  d.innerHTML = `<span class="fi-lanc-ico c${cat(fx.cat).cor}">${ico(fx.icone || cat(fx.cat).icone)}</span>
    <span class="fi-lanc-tx"><b>${escapar(fx.nome)}</b><small>${fx.lanc ? `${feito} em ${dataCurta(fx.lanc.data)}${fx.valor && fx.lanc.valor !== fx.valor ? ` (previsto ${C.reais(fx.valor, { curto: true })})` : ""}` : fx.pulou ? (sai ? "não teve este mês" : "não veio este mês") : fx.semValor ? "toque para pôr o valor" : `${sai ? "a pagar" : "previsto"} · ${quando}${fx.devida ? (sai ? " · já pagou?" : " · já chegou?") : ""}`}</small></span>
    <span class="fi-lanc-v">${fx.semValor && !fx.lanc ? "—" : C.reais(sai ? -(fx.lanc ? fx.lanc.valor : fx.valor) : fx.lanc ? fx.lanc.valor : fx.valor, { curto: !fx.lanc, sinal: sai })}</span>
    ${fx.lanc || fx.pulou ? `<button class="fi-icone mini" data-a="menu" aria-label="Opções de ${escapar(fx.nome)}">${I.pontos}</button>` : fx.semValor ? `<button class="botao mini secundario" data-a="valor">Pôr o valor</button>` : `<button class="botao mini" data-a="recebi">${sai ? "Paguei" : "Recebi"}</button>`}`;
  d.querySelector('[data-a="recebi"]')?.addEventListener("click", () => receberFixa(fx));
  d.querySelector('[data-a="valor"]')?.addEventListener("click", () => editarFixa(fx.id));
  d.querySelector('[data-a="menu"]')?.addEventListener("click", () => menuFixa(fx));
  if (fx.semValor && !fx.lanc) d.querySelector(".fi-lanc-tx").onclick = () => editarFixa(fx.id);
  else if (!fx.lanc && !fx.pulou) d.querySelector(".fi-lanc-tx").onclick = () => menuFixa(fx);
  else if (fx.lanc) d.querySelector(".fi-lanc-tx").onclick = () => editarLancamento(fx.lanc.id);
  return d;
}

// ---------------------------------------------------------------- Gastos
// o mês: totais, por categoria com o limite, as fixas, o extrato (com filtro) e os últimos 6 meses
function telaGastos(el) {
  const f = F(), hoje = hojeISO(), r = C.resumoMes(f, mes, hoje);
  navMes(el);
  const ent = r.entradas.reduce((t, l) => t + l.valor, 0), sai = r.gastos;
  el.insertAdjacentHTML("beforeend", `<div class="fi-totais"><span class="ent"><small>Entradas</small><b>${C.reais(ent)}</b></span><span class="sai"><small>Saídas</small><b>${C.reais(sai)}</b></span><span><small>Saldo</small><b class="${ent - sai < 0 ? "fi-neg" : ""}">${C.reais(ent - sai)}</b></span></div>`);
  if (mes !== C.mesDe(hoje)) heroiMes(el, r, mes);
  // por categoria, com o limite
  const sg = secao(el, "Por categoria", `<button class="fi-link" data-a="limites">Limites e fixas</button>`);
  sg.querySelector('[data-a="limites"]').onclick = () => { sub = "orcamento"; desenhar(); };
  for (const c of r.porCategoria) {
    if (!c.gasto && c.limite == null) continue;
    const d = document.createElement("button"); d.className = `fi-cat ${estadoP(c.p)}`;
    const resto = c.limite == null ? "sem limite" : c.resta >= 0 ? `ainda pode ${C.reais(c.resta)}` : `passou ${C.reais(-c.resta)}`;
    d.innerHTML = `<span class="fi-lanc-ico c${c.cor || 8}">${ico(c.icone)}</span><span class="fi-cat-tx"><span class="fi-cat-l"><b>${escapar(c.nome)}</b><span>${C.reais(c.gasto)}${c.limite != null ? `<small> de ${C.reais(c.limite, { curto: true })}</small>` : ""}</span></span>
      ${c.limite != null ? barra(c.p, estadoP(c.p)) : ""}<small class="fi-cat-resto">${c.p > 1 ? "⚠️ " : ""}${resto}</small></span>`;
    d.onclick = () => { filtro = { tipo: "saida", cat: c.id === "_sem" ? "" : c.id }; desenhar(false); setTimeout(() => $(".fi-filtro")?.scrollIntoView({ behavior: menosMov() ? "auto" : "smooth", block: "start" }), 60); };
    sg.append(d);
  }
  if (r.porCategoria.every(c => c.limite == null)) {
    const b = document.createElement("button"); b.className = "fi-convite";
    b.innerHTML = `${ico("🎯")}<span><b>Defina os limites do mês</b><small>O app sugere pela renda prevista; você ajusta.</small></span>${I.prox}`;
    b.onclick = () => { sub = "orcamento"; desenhar(); };
    sg.append(b);
  } else if (!r.porCategoria.some(c => c.gasto || c.limite != null)) sg.insertAdjacentHTML("beforeend", `<p class="fi-dica">Sem gastos neste mês.</p>`);
  // as fixas do mês (entradas e saídas), as outras entradas e o que está a receber dos check-ins
  const fixas = [...r.fixas, ...r.fixasSai];
  const sf = secao(el, "Fixas do mês", `<small>${C.reais(r.recebido)} de ${C.reais(r.rendaPrevista)} recebidos</small>`);
  fixas.forEach(fx => sf.append(linhaFixa(fx)));
  if (!fixas.length) sf.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nenhuma fixa neste mês.</p>`);
  for (const a of r.aReceber) {
    const b = document.createElement("button"); b.className = "fi-linha-link areceber";
    b.innerHTML = `${ico("🪙")}<span>${escapar(C.nomeFonte(a.fonte))}: a receber até o saque<small>${C.naUnidade(a.valor, a.un, { sinal: true })} no mês</small></span><b>≈ ${C.reais(a.brl)}</b>`;
    b.onclick = () => { aba = "auto"; sub = a.fonte; desenhar(); };
    sf.append(b);
  }
  // o extrato do mês
  const se = secao(el, "Lançamentos");
  atalhos(se, true);
  const fil = document.createElement("div"); fil.className = "fi-filtro";
  const cats = C.categorias(f, filtro.tipo === "tudo" ? null : filtro.tipo);
  fil.innerHTML = `<div class="fi-seg">${[["tudo", "Tudo"], ["saida", "Saídas"], ["entrada", "Entradas"]].map(([k, n]) => `<button data-t="${k}" class="${filtro.tipo === k ? "on" : ""}">${n}</button>`).join("")}</div>
    <select aria-label="Categoria"><option value="">Todas as categorias</option>${cats.map(c => `<option value="${c.id}" ${filtro.cat === c.id ? "selected" : ""}>${escapar(c.nome)}</option>`).join("")}</select>`;
  fil.querySelectorAll("[data-t]").forEach(b => (b.onclick = () => { filtro = { tipo: b.dataset.t, cat: "" }; desenhar(false); }));
  fil.querySelector("select").onchange = (e) => { filtro.cat = e.target.value; desenhar(false); };
  se.append(fil);
  let ls = C.lancamentos(f, mes);
  if (filtro.tipo !== "tudo") ls = ls.filter(l => l.tipo === filtro.tipo);
  if (filtro.cat) ls = ls.filter(l => l.cat === filtro.cat);
  if (!ls.length) se.insertAdjacentHTML("beforeend", `<div class="fi-vazio">${ico("🧾")}<p>Nenhum lançamento ${filtro.tipo === "tudo" && !filtro.cat ? `em ${C.nomeMes(mes, { ano: false })}` : "com esse filtro"}.</p></div>`);
  let dia = null, grupo = null;
  for (const l of ls) {
    if (l.data !== dia) {
      dia = l.data; grupo = document.createElement("div"); grupo.className = "fi-dia";
      const doDia = ls.filter(x => x.data === dia), sd = doDia.reduce((t, x) => t + (x.tipo === "saida" ? -x.valor : x.valor), 0);
      grupo.innerHTML = `<div class="fi-dia-cab"><span>${maiuscula(diaLongo(dia))}</span><small>${C.reais(sd, { sinal: true })}</small></div>`;
      se.append(grupo);
    }
    grupo.append(linhaLanc(l));
  }
  // os últimos 6 meses
  const h = C.historico(f, mes, 6, hoje);
  if (h.some(x => x.entradas || x.saidas)) {
    const s6 = secao(el, "Últimos 6 meses");
    s6.append(graficoBarras(h));
    const cs = C.categorias(f, "saida").filter(c => h.some(x => x.porCat[c.id]));
    const outras = h.some(x => Object.keys(x.porCat).some(k => !cs.find(c => c.id === k)));
    if (cs.length || outras) s6.append(graficoPilhas(h, cs, outras));
    s6.insertAdjacentHTML("beforeend", `<div class="fi-tabela" role="table"><div role="row" class="cab"><span>Mês</span><span>Entradas</span><span>Saídas</span><span>Saldo</span></div>${h.map(x => `<div role="row" class="${x.atual ? "atual" : ""}"><span>${C.nomeMes(x.mes, { ano: false, curto: true })}</span><span>${C.reais(x.entradas, { curto: true })}</span><span>${C.reais(x.saidas, { curto: true })}</span><span class="${x.saldo < 0 ? "fi-neg" : ""}">${C.reais(x.saldo, { curto: true })}</span></div>`).join("")}</div>`);
  }
}

// ---------------------------------------------------------------- Rendimento
// quanto o Ping-Pong rende (medido), de onde vem, a verba de testes e quanto ele terá em alguns anos
const NOME_LUGAR = { render: "Render do ARQ", 99: "99Pay", mp: "Mercado Pago", ast: "AstroPay" };
const pctTxt = (x) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
function telaRendimento(el) {
  const f = F(), hoje = hojeISO(), cot = C.cotacao(f, hoje), rd = C.rendimento(f, hoje), bp = C.bipa(f, hoje, cot);
  const h = document.createElement("section"); h.className = "fi-heroi fi-heroi-rend";
  h.innerHTML = `<small>O Ping-Pong rende por dia</small><strong>${rd.porDia != null ? `≈ ${C.reais(rd.porDia)}` : "—"}</strong>
    <p>${rd.porDia == null ? "Medindo: o rendimento aparece depois de algumas idas e voltas com as macros novas (cada ida diz quanto tirou do Render; cada volta, quanto rendeu no banco)." : `${rd.medindo ? "Primeiros dias da medida: o número ainda vai mudar. " : ""}Média de ${Math.max(1, Math.round(rd.dias))} ${Math.round(rd.dias) === 1 ? "dia" : "dias"} sobre ${C.reais(rd.saldo || 0)}.`}</p>
    <div class="fi-heroi-num"><span><small>Por mês</small><b>${rd.porMes != null ? `≈ ${C.reais(rd.porMes)}` : "—"}</b></span><span><small>Por ano</small><b>${rd.porAno != null ? `≈ ${C.reais(rd.porAno)}` : "—"}</b></span><span><small>Taxa</small><b>${rd.taxaAno ? `${pctTxt(rd.taxaAno)} a.a.` : "—"}</b></span></div>`;
  el.append(h);
  // de onde vem
  const lugares = Object.entries(rd.porLugar).sort((a, b) => b[1] - a[1]), mx = Math.max(0.01, ...lugares.map(x => x[1]));
  const sl = secao(el, "De onde vem", `<small>últimos 30 dias · ${C.reais(Object.values(rd.porLugar).reduce((t, v) => t + v, 0))}</small>`);
  if (!lugares.length) sl.insertAdjacentHTML("beforeend", `<p class="fi-dica">Ainda sem rendimento medido. O Render conta entre uma ida e a seguinte; 99, MP e AST, pelo que sobra no banco depois das devoluções (o rendimento dos ciclos passados), que a volta manda ao ARQ.</p>`);
  for (const [k, v] of lugares) sl.insertAdjacentHTML("beforeend", `<div class="fi-cat"><span class="fi-cat-tx"><span class="fi-cat-l"><b>${escapar(NOME_LUGAR[k] || k)}</b><span>${C.reais(v)}</span></span>${barra(v / mx)}</span></div>`);
  if (bp) sl.insertAdjacentHTML("beforeend", `<p class="fi-dica">${icone("🐷", "ico-inline")} Fora do Ping-Pong, a Bipa rende ${bp.satsDia} sats por dia (≈ ${C.reais(cot.btc ? (bp.satsDia / 1e8) * cot.btc : 0)}/dia pelo bitcoin de hoje).</p>`);
  if (rd.serie.length >= 2) sl.append(graficoSaldo(rd.serie, "brl", "rendimento por dia"));
  // a verba de testes
  const st = secao(el, `Verba de testes · ${rd.testes.pct}%`, `<button class="fi-link" data-a="pct">Mudar</button>`);
  st.insertAdjacentHTML("beforeend", `<div class="fi-tiles"><span><small>Este mês</small><b>${C.reais(rd.testes.noMes)}</b><small>${rd.testes.pct}% do que rendeu</small></span><span><small>Desde o começo</small><b>${C.reais(rd.testes.total)}</b><small>${rd.desde ? `desde ${dataCurta(C.diaLocal(rd.desde))}` : "—"}</small></span><span><small>Por mês, no ritmo</small><b>${rd.porMes != null ? `≈ ${C.reais(rd.porMes * rd.testes.pct / 100)}` : "—"}</b><small>para trading e afins</small></span></div>
    <p class="fi-dica">Uma parte pequena do rendimento, para testar mercados arriscados sem mexer no resto. A projeção abaixo já conta sem ela.</p>`);
  st.querySelector('[data-a="pct"]').onclick = mudarTestes;
  // a projeção
  const pj = C.projecao(f, hoje);
  const sp = secao(el, "Quanto você terá", pj ? `<button class="fi-link" data-a="taxa">${pj.manual ? "Taxa à mão" : "Outra taxa"}</button>` : "");
  if (!pj) {
    sp.insertAdjacentHTML("beforeend", `<p class="fi-dica">A projeção usa a taxa medida do Ping-Pong. Enquanto ela não sai, dá para informar uma taxa (ao ano).</p>`);
    const b = document.createElement("button"); b.className = "fi-linha-link"; b.innerHTML = `${ico("📈")}<span>Informar uma taxa<small>por exemplo, a do CDI</small></span>${I.prox}`;
    b.onclick = mudarTaxa; sp.append(b);
  } else {
    sp.querySelector('[data-a="taxa"]').onclick = mudarTaxa;
    sp.append(graficoProjecao(pj));
    sp.insertAdjacentHTML("beforeend", `<div class="fi-tabela fi-proj-tab" role="table" style="--n:${pj.cenarios.length}"><div role="row" class="cab"><span>Em</span>${pj.cenarios.map((c, i) => `<span><i class="fi-proj-cor p${i + 1}"></i>${escapar(c.nome.replace(/^No ritmo dos últimos meses$/, "No ritmo atual").replace(/^Guardando /, "Guardando "))}</span>`).join("")}</div>
      ${[1, 2, 5, 10].map(a => `<div role="row"><span>${a} ${a === 1 ? "ano" : "anos"}</span>${pj.cenarios.map(c => `<span>${C.reais(c.em[a], { curto: true })}</span>`).join("")}</div>`).join("")}</div>
      <p class="fi-dica">Começa em ${C.reais(pj.P0)} (Ping-Pong, Bipa e ZBD) e rende ${pctTxt(pj.taxa)} ao ano (${pj.manual ? "a taxa que você informou" : "a medida"}), menos os ${pj.testesPct}% dos testes. ${pj.cenarios.map(c => c.aporte ? `${c.nome}: ${C.reais(c.aporte, { sinal: true })}/mês.` : "").filter(Boolean).join(" ")} Em reais de hoje, sem a inflação; os juros e o seu ritmo mudam, então é uma estimativa.</p>`);
  }
  // o dinheiro ao longo do tempo
  // a evolução desde 1º/11/2026 (a mesma do widget "Seu dinheiro")
  const ev = C.evolucao(f, hoje, cot);
  const sh = secao(el, "Seu dinheiro desde 1º/11", `<button class="fi-link" data-a="onde">Onde está</button>`);
  sh.querySelector('[data-a="onde"]').onclick = () => { sub = "dinheiro"; voltarPara = null; desenhar(); };
  if (ev?.serie.length >= 2) {
    sh.insertAdjacentHTML("beforeend", `<p class="fi-dica">${C.reais(ev.variacao, { sinal: true })} desde ${dataCurta(ev.desde)}.</p>`);
    sh.append(graficoSaldo(ev.serie, "brl", "seu dinheiro", { zero: false }));
  } else sh.insertAdjacentHTML("beforeend", `<p class="fi-dica">${ev?.comecou ? "O gráfico enche a cada leitura do Ping-Pong." : "O gráfico começa em 1º de novembro, quando as fixas e o Ping-Pong já estiverem rodando. O mesmo gráfico está no widget \"Seu dinheiro\" (segure na tela inicial → Widgets → Órbita)."}</p>`);
}
function mudarTestes() {
  const f = F(), corpo = document.createElement("div"); corpo.className = "fi-form";
  const v0 = C.testesPct(f);
  corpo.innerHTML = `<p class="fi-dica">Quanto do rendimento vai para testes (trading, mercados arriscados).</p>
    <div class="fi-reserva" data-sem-deslize><input type="range" min="0" max="20" step="1" value="${v0}" aria-label="Verba de testes (%)"><output>${v0}%</output></div>
    <div class="fi-bts"><button type="button" class="botao" data-a="ok">Salvar</button></div>`;
  const rg = corpo.querySelector("input"), pintar = () => rg.style.setProperty("--fi-pct", `${(+rg.value / 20) * 100}%`);
  pintar(); rg.oninput = () => { pintar(); corpo.querySelector("output").textContent = `${rg.value}%`; };
  const { fechar } = folha("Verba de testes", corpo);
  corpo.querySelector('[data-a="ok"]').onclick = () => { f.ajustes = { ...f.ajustes, testesPct: +rg.value, em: new Date().toISOString() }; salvar(); fechar(); desenhar(false); };
}
function mudarTaxa() {
  const f = F(), corpo = document.createElement("div"); corpo.className = "fi-form";
  const rd = C.rendimento(f, hojeISO());
  corpo.innerHTML = `<p class="fi-dica">${rd.taxaAno ? `A medida no Ping-Pong é ${pctTxt(rd.taxaAno)} ao ano. ` : ""}Informe outra taxa ao ano para a projeção, ou deixe vazio para usar a medida.</p>
    <label class="fi-campo"><small>Taxa ao ano (%)</small><input data-teclado="dinheiro" aria-label="Taxa ao ano" value="${f.ajustes?.taxaManual ? C.paraCampo(f.ajustes.taxaManual) : ""}" placeholder="a medida"></label>
    <div class="fi-bts"><button type="button" class="botao" data-a="ok">Salvar</button></div>`;
  const { fechar } = folha("Taxa da projeção", corpo);
  const ok = () => { const v = C.deCampo(corpo.querySelector("input").value); f.ajustes = { ...f.ajustes, taxaManual: v > 0 && v < 100 ? v : null, em: new Date().toISOString() }; salvar(); fechar(); desenhar(false); };
  tecl.configurar({ aoConcluir: ok, rotuloConcluir: "Salvar" });
  corpo.querySelector('[data-a="ok"]').onclick = ok;
}
/** As linhas da projeção (um cenário por cor), ano a ano; tocar mostra os valores daquele ano. */
function graficoProjecao(pj) {
  const W = 340, H = 180, m = { e: 8, d: 8, c: 12, b: 22 }, n = pj.anos * 12;
  const mx = Math.max(1, ...pj.cenarios.flatMap(c => c.meses.map(x => x.v))), mn = Math.min(...pj.cenarios.flatMap(c => c.meses.map(x => x.v)), pj.P0) * 0.9;
  const x = (k) => m.e + (k / n) * (W - m.e - m.d), y = (v) => m.c + (1 - (v - mn) / (mx - mn || 1)) * (H - m.c - m.b);
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa";
  caixa.innerHTML = `<div class="fi-legenda">${pj.cenarios.map((c, i) => `<span><i class="fi-proj-cor p${i + 1}"></i>${escapar(c.nome)}</span>`).join("")}</div>
    <svg class="fi-graf fi-proj" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção do seu dinheiro em ${pj.anos} anos">
    <line x1="${m.e}" x2="${W - m.d}" y1="${H - m.b}" y2="${H - m.b}" class="eixo"/>
    ${Array.from({ length: pj.anos + 1 }, (_, a) => a % (pj.anos > 5 ? 2 : 1) === 0 ? `<text x="${x(a * 12)}" y="${H - 6}" class="rot" text-anchor="${a === 0 ? "start" : a === pj.anos ? "end" : "middle"}">${a ? `${a}a` : "hoje"}</text>` : "").join("")}
    ${pj.cenarios.map((c, i) => `<path class="linha p${i + 1}" d="M${c.meses.filter(q => q.m % 3 === 0).map(q => `${x(q.m).toFixed(1)},${y(q.v).toFixed(1)}`).join(" L")}"/>`).join("")}
    <line class="cursor" x1="0" x2="0" y1="${m.c}" y2="${H - m.b}" hidden/>
  </svg><p class="fi-graf-info">Toque no gráfico para ver um ano</p>`;
  const svg = caixa.querySelector("svg"), info = caixa.querySelector(".fi-graf-info"), cur = caixa.querySelector(".cursor");
  const mostrar = (ev) => {
    const r = svg.getBoundingClientRect(), k = Math.max(1, Math.min(pj.anos, Math.round(((ev.clientX - r.left) / r.width * W - m.e) / (W - m.e - m.d) * pj.anos)));
    cur.hidden = false; cur.setAttribute("x1", x(k * 12)); cur.setAttribute("x2", x(k * 12));
    info.innerHTML = `<b>Em ${k} ${k === 1 ? "ano" : "anos"}</b>: ${pj.cenarios.map(c => `${escapar(c.nome)} ${C.reais(c.meses[k * 12].v)}`).join(" · ")}`;
  };
  svg.addEventListener("pointerdown", mostrar); svg.addEventListener("pointermove", (e) => { if (e.buttons) mostrar(e); });
  return caixa;
}

/** "Atualizar a Bipa": o que o app dela mostra em R$ e quanto rende por dia (sats). */
function atualizarBipaAMao() {
  const f = F(), hoje = hojeISO(), cot = C.cotacao(f, hoje), bp = C.bipa(f, hoje, cot);
  const corpo = document.createElement("div"); corpo.className = "fi-form";
  corpo.innerHTML = `<p class="fi-dica">O que o cofrinho de bitcoin da Bipa mostra agora.${bp ? ` O app estima <b>${C.reais(bp.valor)}</b>.` : ""} Como o cofrinho é em bitcoin, o app guarda em sats e acompanha a cotação. Ele rende 70% do CDI em sats: os sats de hoje viram a taxa, e o rendimento cresce junto com o saldo.</p>
    <label class="fi-campo"><small>Valor na Bipa (R$)</small><input data-teclado="dinheiro" aria-label="Valor na Bipa" value="${bp ? C.paraCampo(bp.valor) : ""}" placeholder="0,00"></label>
    <label class="fi-campo"><small>Quanto rendeu hoje (sats)</small><input data-teclado="num" data-max="4" aria-label="Rende por dia em sats" value="${f.bipa?.satsDia ?? C.BIPA_SATS_DIA}"></label>
    <div class="fi-bts"><button type="button" class="botao" data-a="ok">Salvar</button></div>`;
  const { fechar } = folha("Atualizar a Bipa", corpo);
  const ok = () => {
    const brl = C.deCampo(corpo.querySelector('[aria-label="Valor na Bipa"]').value);
    const sd = parseInt(corpo.querySelector('[aria-label="Rende por dia em sats"]').value, 10);
    if (!(brl >= 0) || !corpo.querySelector('[aria-label="Valor na Bipa"]').value) { toast("Escreva o valor em R$."); return; }
    C.atualizarBipa(f, hoje, { brl, satsDia: Number.isFinite(sd) ? sd : null }, cot.btc || null);
    salvar(); fechar(); desenhar(false); toast("Bipa atualizada");
  };
  tecl.configurar({ aoConcluir: ok, rotuloConcluir: "Salvar" });
  corpo.querySelector('[data-a="ok"]').onclick = ok;
}

// Seu dinheiro (pedido do Alediov, 30/10/2026): o total e cada lugar (Ping-Pong, Bipa, ZBD); o dinheiro físico fica de
// fora até virar digital.
function telaDinheiro(el) {
  const f = F(), hoje = hojeISO(), cot = C.cotacao(f, hoje), d = C.seuDinheiro(f, hoje, cot);
  cabSub(el, "Seu dinheiro", "Ping-Pong, Bipa e ZBD", nomeAba());
  el.insertAdjacentHTML("beforeend", `<div class="fi-saldo fi-din-total"><strong>${d ? C.reais(d.total) : "—"}</strong><span>${d && !d.temTudo ? "falta informar algum lugar" : "somando os três lugares"}</span></div>`);
  const s = secao(el, "Onde está");
  for (const l of C.LUGARES) {
    const x = d?.lugares.find(y => y.id === l.id), v = x?.info, b = document.createElement("button");
    b.className = `fi-linha-link fi-lugar${l.id === "pingpong" && v?.onde.alerta ? " alerta" : ""}`; b.dataset.lugar = l.id;
    let det = l.desc;
    if (l.id === "pingpong") det = v ? `${v.onde.txt} · lido ${quandoFoi(v.em)}${v.onde.alerta ? ` · ⚠️ ${v.onde.alerta}` : ""}` : "aparece na próxima ida do Ping-Pong";
    else if (l.id === "bipa") det = v ? `${v.estimado ? `informado ${C.reais(v.informado)} em ${dataCurta(v.dia)}${v.rendeu ? ` + ${C.reais(v.rendeu)} de rendimento (${v.satsDia} sats/dia)` : ""}${v.saques ? ` + ${v.saques === 1 ? "1 saque lançado" : `${v.saques} saques lançados`} (${C.reais(v.extra)})` : ""}` : `informado em ${dataCurta(v.dia)}`}` : "toque para informar o valor do cofrinho";
    else if (l.id === "zbd") det = v ? `${C.naUnidade(v.sats, "sats")} em ${dataCurta(v.dia)}${v.semCotacao ? " · sem a cotação do bitcoin" : ""} · sacar depois de ${C.reais(f.fontes?.zbd?.minimoSaque || C.MINIMO_ZBD_REAIS, { curto: true })}` : "toque para informar o saldo em sats";
    b.innerHTML = `${ico(l.icone)}<span>${l.nome}<small>${escapar(det)}</small></span><b>${x?.valor != null ? `${l.id !== "pingpong" && (v?.estimado || l.id === "zbd") ? "≈ " : ""}${C.reais(x.valor)}` : "—"}</b>${I.prox}`;
    b.onclick = () => {
      if (l.id === "bipa") atualizarBipaAMao();
      else if (l.id === "zbd" && !v) atualizarFonteAMao("zbd", C.resumoFonte(f, "zbd", hoje, cot));
      else { voltarPara = "dinheiro"; sub = l.id; desenhar(); }
    };
    s.append(b);
  }
  if (d?.lugares.find(l => l.id === "bipa")?.valor != null) {
    const ab = document.createElement("button"); ab.className = "fi-linha-link fi-amao"; ab.dataset.a = "bipa";
    ab.innerHTML = `${ico("✏️")}<span>Atualizar a Bipa<small>o valor do cofrinho e quanto rende por dia</small></span>${I.prox}`;
    ab.onclick = atualizarBipaAMao; s.append(ab);
  }
  s.insertAdjacentHTML("beforeend", `<p class="fi-dica">${icone("💵", "ico-inline")} O dinheiro físico (o da Vó) só entra quando virar digital: marque "Recebi" na entrada fixa quando depositar. Os saques do Slice, do EarnApp e da ZBD lançados aqui entram na Bipa até você atualizar o valor dela. Bipa e ZBD vão pelo bitcoin ${cot.btc ? `de ${C.reais(cot.btc, { curto: true })}` : "(sem cotação ainda)"}.</p>`);
  if (d?.serie.length >= 2) secao(el, "Nos últimos dias", `<small>a cada leitura do Ping-Pong</small>`).append(graficoSaldo(d.serie, "brl", "seu dinheiro", { zero: false }));
}

async function receberFixa(fx) {
  const hoje = hojeISO(), noMes = C.mesDe(hoje) === mes ? hoje : fx.dia ? `${mes}-${String(Math.min(fx.dia, C.diasNoMes(mes))).padStart(2, "0")}` : `${mes}-01`;
  const sai = fx.tipo === "saida";
  editarLancamento(null, { tipo: sai ? "saida" : "entrada", valor: fx.valor || 0, cat: fx.cat, desc: fx.nome, data: noMes, forma: sai ? "Crédito" : "Pix", fixa: fx.id, ref: mes });
}
async function menuFixa(fx) {
  const f = F(), chave = `${mes}|${fx.id}`;
  const sai = fx.tipo === "saida";
  const botoes = fx.lanc ? [{ texto: "Ver o lançamento", valor: "ver" }, { texto: sai ? "Desfazer o pagamento" : "Desfazer o recebimento", valor: "desfazer", classe: "secundario" }]
    : fx.pulou ? [{ texto: sai ? "Teve, sim: lançar" : "Veio, sim: lançar", valor: "recebi" }, { texto: "Voltar a esperar", valor: "esperar", classe: "secundario" }]
    : [{ texto: sai ? "Paguei" : "Recebi", valor: "recebi" }, { texto: sai ? "Não teve este mês" : "Não veio este mês", valor: "pular", classe: "secundario" }, { texto: sai ? "Editar a saída fixa" : "Editar a entrada fixa", valor: "editar", classe: "secundario" }];
  const v = await modal({ titulo: fx.nome, texto: `${sai ? "A pagar" : "Previsto"}: ${fx.valor ? C.reais(fx.valor) : "sem valor"} ${fx.dia ? `por volta do dia ${fx.dia}` : "(sem dia certo: só fica para conferir no fim do mês)"}.`, botoes: [...botoes, { texto: "Fechar", valor: null, classe: "secundario" }] });
  if (v === "ver") editarLancamento(fx.lanc.id);
  else if (v === "desfazer") { f.lanc[fx.lanc.id] = { ...fx.lanc, apagado: true, em: new Date().toISOString() }; salvar(); desenhar(false); }
  else if (v === "recebi") { delete f.pulos[chave]; receberFixa(fx); }
  else if (v === "pular") { f.pulos[chave] = { em: new Date().toISOString() }; salvar(); desenhar(false); }
  else if (v === "esperar") { delete f.pulos[chave]; salvar(); desenhar(false); }
  else if (v === "editar") editarFixa(fx.id);
}

// ---------------------------------------------------------------- folha (embaixo) e o editor de lançamento
function folha(titulo, corpo, { classe = "" } = {}) {
  const fundo = document.createElement("div"); fundo.className = "fi-folha-fundo";
  const fo = document.createElement("div"); fo.className = `fi-folha ${classe}`; fo.setAttribute("role", "dialog"); fo.setAttribute("aria-label", titulo);
  fo.innerHTML = `<div class="fi-folha-alca"></div><h3>${escapar(titulo)}</h3>`;
  fo.append(corpo); fundo.append(fo); raiz.append(fundo);
  requestAnimationFrame(() => fundo.classList.add("aberto"));
  tecl?.preparar(fo);
  const fechar = () => { tecl?.fechar(); fundo.classList.remove("aberto"); setTimeout(() => fundo.remove(), menosMov() ? 0 : 220); };
  fundo.onclick = (e) => { if (e.target === fundo && !raiz.classList.contains("fi-tec")) fechar(); };
  return { fundo, fo, fechar };
}

/** Novo lançamento (id null) ou edição. `pre`: valores iniciais (Recebi da entrada fixa, saque do Slice). */
function editarLancamento(id, pre = {}) {
  const f = F(), antigo = id ? f.lanc[id] : null;
  const l = { tipo: "saida", valor: 0, data: hojeISO(), cat: "", desc: "", forma: "Pix", ...(antigo || pre) };
  if (!antigo && !pre.tipo && C.mesDe(hojeISO()) !== mes) l.data = `${mes}-01`;
  const corpo = document.createElement("div"); corpo.className = "fi-form";
  const desenharCats = () => {
    const cs = C.categorias(f, l.tipo);
    if (!cs.some(c => c.id === l.cat)) l.cat = cs[0]?.id || "";
    corpo.querySelector(".fi-chips").innerHTML = cs.map(c => `<button type="button" data-c="${c.id}" class="${c.id === l.cat ? "on" : ""}">${icone(c.icone, "ico-inline")}${escapar(c.nome)}</button>`).join("");
    corpo.querySelectorAll(".fi-chips button").forEach(b => (b.onclick = () => { l.cat = b.dataset.c; corpo.querySelectorAll(".fi-chips button").forEach(x => x.classList.toggle("on", x === b)); }));
  };
  corpo.innerHTML = `<div class="fi-seg grande">${[["saida", "Saída"], ["entrada", "Entrada"]].map(([k, n]) => `<button type="button" data-t="${k}" class="${l.tipo === k ? "on" : ""}">${n}</button>`).join("")}</div>
    <label class="fi-valor"><span>R$</span><input data-teclado="dinheiro" aria-label="Valor" value="${C.paraCampo(l.valor)}" placeholder="0,00"></label>
    <div class="fi-chips" role="group" aria-label="Categoria"></div>
    <label class="fi-campo"><small>Descrição</small><input data-teclado="texto" data-prever="desc" aria-label="Descrição" maxlength="80" value="${escapar(l.desc || "")}" placeholder="Ex.: luvas, inscrição do congresso…"></label>
    <div class="fi-duas"><label class="fi-campo"><small>Data</small><input data-teclado="data" aria-label="Data" value="${dataBr(l.data)}"></label>
    <label class="fi-campo"><small>Forma</small><select aria-label="Forma de pagamento">${C.FORMAS.map(x => `<option ${x === l.forma ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
    ${l.saque ? `<p class="fi-dica">${ico("🪙")} Saque do Slice de ${l.saque.sats ? C.naUnidade(l.saque.sats, "sats") : C.dolares(l.saque.usd)} (${dataCurta(l.saque.chave.split("|")[1])}).</p>` : ""}
    ${l.recarga ? `<p class="fi-dica">${ico("🚌")} Recarga do cartão: ${l.recarga.passagens} passagens. A estimativa das passagens conta a partir dela.</p>` : ""}
    ${l.fixa ? `<p class="fi-dica">${f.fixas[l.fixa]?.tipo === "saida" ? "Saída" : "Entrada"} fixa: ${escapar(f.fixas[l.fixa]?.nome || "")} de ${C.nomeMes(l.ref || C.mesDe(l.data))}.</p>` : ""}
    <div class="fi-bts"><button type="button" class="botao" data-a="salvar">${antigo ? "Salvar" : "Lançar"}</button>${antigo ? `<button type="button" class="botao secundario" data-a="apagar">Apagar</button>` : ""}</div>`;
  desenharCats();
  corpo.querySelectorAll(".fi-seg [data-t]").forEach(b => (b.onclick = () => { l.tipo = b.dataset.t; corpo.querySelectorAll(".fi-seg [data-t]").forEach(x => x.classList.toggle("on", x === b)); desenharCats(); }));
  const { fechar } = folha(antigo ? "Editar lançamento" : pre.fixa ? (pre.tipo === "saida" ? "Paguei" : "Recebi") : "Novo lançamento", corpo, { classe: "lanc" });
  tecl.configurar({ aoConcluir: () => salvarL(), rotuloConcluir: antigo ? "Salvar" : "Lançar", prever: (el) => {
    const q = el.value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return C.descricoesUsadas(f, l.cat).concat(C.descricoesUsadas(f)).filter((d, i, a) => a.indexOf(d) === i)
      .filter(d => !q || d.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)).slice(0, 6).map(valor => ({ valor }));
  } });
  // novo lançamento no celular: o teclado de dinheiro já abre (como um toque no valor)
  if (!antigo && !l.valor && matchMedia("(pointer: coarse)").matches) setTimeout(() => {
    const v = corpo.querySelector('[data-teclado="dinheiro"]'); if (!v?.isConnected) return;
    v.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" })); v.focus({ preventScroll: true }); v.click();
  }, 280);
  const salvarL = () => {
    const valor = C.deCampo(corpo.querySelector('[data-teclado="dinheiro"]').value);
    const data = dataIso(corpo.querySelector('[data-teclado="data"]').value);
    if (!(valor > 0)) { toast("Falta o valor."); return; }
    if (!data) { toast("A data está incompleta ou não existe."); return; }
    if (!l.cat) { toast("Escolha a categoria."); return; }
    const novoId = antigo?.id || C.novoId();
    const r0 = l.tipo === "saida" ? C.resumoMes(f, C.mesDe(data), hojeISO()).porCategoria.find(c => c.id === l.cat) : null;
    const reg = { ...(antigo || {}), id: novoId, tipo: l.tipo, valor, data, cat: l.cat, desc: corpo.querySelector('[data-prever="desc"]').value.trim().slice(0, 80),
      forma: corpo.querySelector("select").value, ...(l.fixa ? { fixa: l.fixa, ref: l.ref || C.mesDe(data) } : {}), ...(l.saque ? { saque: l.saque } : {}), em: new Date().toISOString() };
    delete reg.apagado;
    if (reg.recarga && reg.cat !== antigo?.cat) delete reg.recarga; // tirou da categoria: deixa de ser a recarga das passagens
    f.lanc[novoId] = reg; salvar(); tocar("moeda"); fechar();
    // aviso do orçamento ao chegar a 80% e ao passar do limite (no lugar do "lançado")
    const antes = r0 ? r0.gasto - (antigo && antigo.cat === l.cat && antigo.tipo === "saida" && C.mesDe(antigo.data) === C.mesDe(data) ? antigo.valor : 0) : 0;
    const avisou = !!avisoOrcamento(r0, antes, valor, data);
    if (!antigo && !avisou) toast(l.tipo === "saida" ? `Gasto de ${C.reais(valor)} lançado` : `Entrada de ${C.reais(valor)} lançada`);
    mes = C.mesDe(data);
    desenhar(false);
  };
  corpo.querySelector('[data-a="salvar"]').onclick = salvarL;
  corpo.querySelector('[data-a="apagar"]')?.addEventListener("click", async () => {
    if (!(await modal({ titulo: "Apagar este lançamento?", texto: `${antigo.desc || cat(antigo.cat).nome}: ${C.reais(antigo.valor)}`, botoes: [{ texto: "Apagar", valor: true, classe: "errado" }, { texto: "Cancelar", valor: false, classe: "secundario" }] }))) return;
    f.lanc[antigo.id] = { ...antigo, apagado: true, em: new Date().toISOString() }; salvar(); fechar(); desenhar(false);
  });
}

/** Aviso do orçamento (80%: um toast; passou: um modal). `r0`: a categoria no resumo do mês antes do gasto. Devolve
 *  "80", "100" ou null; com `mostrar80: false`, o de 80% fica para quem chamou (a barra do Desfazer). */
function avisoOrcamento(r0, antes, valor, data, { mostrar80 = true } = {}) {
  if (!r0?.limite) return null;
  const a = C.alertaOrcamento(antes, antes + valor, r0.limite);
  if (a === "100") modal({ titulo: `${r0.nome}: passou do limite`, texto: `Gastou ${C.reais(antes + valor)} de ${C.reais(r0.limite)} em ${C.nomeMes(C.mesDe(data), { ano: false })}. Dá para tirar de outra categoria no Orçamento.` });
  else if (a === "80" && mostrar80) toast(`${r0.nome}: ${Math.round((antes + valor) / r0.limite * 100)}% do limite do mês. Restam ${C.reais(r0.limite - antes - valor)}.`, 4200);
  return a;
}

// ---------------------------------------------------------------- atalhos de um toque: almoço e recarga das passagens
// (pedido do Alediov, 27/10/2026: o almoço sai no cartão, R$ 4; o cartão de passagens se recarrega quando está quase
// acabando, R$ 47 = 20 passagens). Um toque lança a saída de hoje; a barra embaixo desfaz (ou apaga pelo extrato).
const vivo = (id) => { const c = F().categorias[id]; return c && !c.apagada; };
function atalhos(el, compacto = false) {
  const f = F(), rc = C.recarga(f), tem = { almoco: vivo("comida"), recarga: vivo("transporte") };
  if (!tem.almoco && !tem.recarga) return;
  const d = document.createElement("div"); d.className = `fi-rapidos ${compacto ? "compacto" : ""}`;
  d.innerHTML = `${tem.almoco ? `<button class="fi-rapido c${cat("comida").cor}" data-r="almoco" aria-label="Almoço · ${C.reais(C.almoco(f), { curto: true })}: lançar hoje">${ico(cat("comida").icone)}<span><b>Almoço</b><small>${C.reais(C.almoco(f), { curto: true })}</small></span></button>` : ""}
    ${tem.recarga ? `<button class="fi-rapido c${cat("transporte").cor}" data-r="recarga" aria-label="Recarreguei · ${C.reais(rc.valor, { curto: true })} (${rc.passagens} passagens): lançar hoje">${ico(cat("transporte").icone)}<span><b>Recarreguei</b><small>${C.reais(rc.valor, { curto: true })} · ${rc.passagens} passagens</small></span></button>` : ""}`;
  d.querySelectorAll("[data-r]").forEach(b => (b.onclick = () => {
    if (b.disabled) return;
    b.disabled = true; setTimeout(() => (b.disabled = false), 900); // dois toques sem querer não lançam dois almoços
    lancarRapido(b.dataset.r);
  }));
  el.append(d);
}
function lancarRapido(qual) {
  const f = F(), hoje = hojeISO(), catId = qual === "almoco" ? "comida" : "transporte";
  if (!vivo(catId)) { toast("A categoria foi apagada no Orçamento."); return; }
  const rc = C.recarga(f), valor = qual === "almoco" ? C.almoco(f) : rc.valor;
  const r0 = C.resumoMes(f, C.mesDe(hoje), hoje).porCategoria.find(c => c.id === catId);
  const id = C.novoId();
  f.lanc[id] = { id, tipo: "saida", valor, data: hoje, cat: catId, desc: qual === "almoco" ? "Almoço" : `Recarga do cartão (${rc.passagens} passagens)`, forma: qual === "almoco" ? "Crédito" : "Pix",
    rapido: qual, ...(qual === "recarga" ? { recarga: { passagens: rc.passagens } } : {}), em: new Date().toISOString() };
  salvar(); tocar("moeda"); navigator.vibrate?.(8);
  mes = C.mesDe(hoje);
  desenhar(false);
  const a = avisoOrcamento(r0, r0?.gasto || 0, valor, hoje, { mostrar80: false });
  const pp = qual === "recarga" ? P.passagensHoje() : null;
  const txt = qual === "almoco" ? `Almoço de ${C.reais(valor)} lançado` : `Recarga de ${C.reais(valor)} lançada: ≈ ${pp?.restam ?? rc.passagens} passagens${pp?.antes ? ` (${pp.antes} que sobravam + ${rc.passagens})` : ""}`;
  barraDesfazer(a === "80" ? `${txt} · ${r0.nome} em ${Math.round((r0.gasto + valor) / r0.limite * 100)}% do limite` : txt, () => {
    const l = f.lanc[id]; if (!l || l.apagado) return;
    f.lanc[id] = { ...l, apagado: true, em: new Date().toISOString() }; salvar(); desenhar(false); toast("Desfeito");
  });
}
let tDesfazer = null;
function barraDesfazer(texto, aoDesfazer) {
  raiz.querySelector(".fi-desfazer")?.remove(); clearTimeout(tDesfazer);
  const b = document.createElement("div"); b.className = "fi-desfazer"; b.setAttribute("role", "status");
  b.innerHTML = `<span>${escapar(texto)}</span><button type="button">Desfazer</button>`;
  const some = () => { b.classList.add("sai"); setTimeout(() => b.remove(), menosMov() ? 0 : 200); };
  b.querySelector("button").onclick = () => { clearTimeout(tDesfazer); some(); aoDesfazer(); };
  raiz.append(b);
  tDesfazer = setTimeout(some, 6000);
}

/** As passagens que sobram no cartão (estimativa pela Agenda), com Corrigir. Destaque quando estão acabando. */
function cartaoPassagens(el) {
  if (!vivo("transporte")) return;
  const p = P.passagensHoje(), alerta = C.precisaRecarregar(p);
  const d = document.createElement("div"); d.className = `fi-passe ${alerta ? "alerta" : ""} ${p ? "" : "vazio"}`;
  const plural = (n) => `${n} ${n === 1 ? "passagem" : "passagens"}`;
  const quando = !p ? "" : p.restam < 2 ? (p.faltaEm ? `acabaram: recarregue antes de ${diaLongo(p.faltaEm)}` : "acabaram (sem aula à vista na Agenda)")
    : p.ate ? `dá até ${diaLongo(p.ate)}` : "sem aula à vista na Agenda";
  const desde = p ? (p.base.tipo === "recarga" ? `desde a recarga de ${dataCurta(p.base.dia)}${p.antes ? ` (${p.antes} que sobravam + ${p.base.qtd})` : ""}` : `desde a correção de ${dataCurta(p.base.dia)}`) : "";
  d.innerHTML = `<span class="fi-lanc-ico c${cat("transporte").cor}">${ico(alerta ? "⚠️" : "🚌")}</span>
    <span class="fi-lanc-tx">${alerta ? `<em>Recarregar o cartão de passagens</em>` : ""}<b>${p ? `≈ ${plural(p.restam)} · ${quando}` : "Passagens no cartão"}</b>
      <small>${p ? `Estimativa: ${P.temAgenda() ? "2 por dia com aula ou atividade na Agenda" : "2 por dia de segunda a sexta (sem Agenda)"}, ${desde}.` : "Toque em Recarreguei na próxima recarga, ou em Corrigir para dizer quantas sobram agora."}</small></span>
    <button class="botao mini secundario" data-a="corrigir">Corrigir</button>`;
  d.querySelector('[data-a="corrigir"]').onclick = () => corrigirPassagens(p);
  el.append(d);
}
function corrigirPassagens(p) {
  const f = F(), hoje = hojeISO(), temHoje = P.diaPresencial(hoje), cedo = new Date().getHours() < 12;
  let contaHoje = temHoje && cedo;
  const corpo = document.createElement("div"); corpo.className = "fi-form";
  corpo.innerHTML = `<p class="fi-dica">${p ? `O app estima <b>≈ ${p.restam}</b>. ` : ""}Diga quantas passagens sobram de verdade no cartão: a conta segue daqui (2 por dia com aula ou atividade, e cada recarga soma às que sobram).</p>
    <label class="fi-campo"><small>Passagens no cartão agora</small><input data-teclado="num" data-max="3" aria-label="Passagens no cartão agora" value="${p ? p.restam : ""}"></label>
    ${temHoje ? `<div class="fi-seg" role="group" aria-label="As de hoje">${[["ja", "Já usei as de hoje"], ["vou", "Ainda vou usar as de hoje"]].map(([k, n]) => `<button type="button" data-h="${k}" class="${(k === "vou") === contaHoje ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}
    <div class="fi-bts"><button type="button" class="botao" data-a="ok">Salvar</button></div>`;
  corpo.querySelectorAll("[data-h]").forEach(b => (b.onclick = () => { contaHoje = b.dataset.h === "vou"; corpo.querySelectorAll("[data-h]").forEach(x => x.classList.toggle("on", x === b)); }));
  const { fechar } = folha("Corrigir as passagens", corpo);
  const ok = () => {
    const n = parseInt(corpo.querySelector("input").value, 10);
    if (!(n >= 0) || n > 500) { toast("Escreva quantas passagens sobram (0 a 500)."); return; }
    f.passagens = { restam: n, dia: hoje, contaHoje: temHoje && contaHoje, em: new Date().toISOString() };
    salvar(); fechar(); desenhar(false); toast("Passagens corrigidas");
  };
  tecl.configurar({ aoConcluir: ok, rotuloConcluir: "Salvar" });
  corpo.querySelector('[data-a="ok"]').onclick = ok;
}

// ---------------------------------------------------------------- Orçamento
function telaOrcamento(el) {
  const f = F(), hoje = hojeISO(), r = C.resumoMes(f, mes, hoje), sug = C.sugerirOrcamento(f, mes, hoje, { diasAula: P.diasDeAulaDoMes(mes) });
  cabSub(el, "Limites e fixas", "quanto guardar, o limite de cada categoria e as entradas e saídas fixas", "Gastos");
  navMes(el, "a sugestão usa a renda e as aulas deste mês");
  // guardar (0 a 50%; padrão 20%: "é bom guardar mais")
  const sr = secao(el, "Guardar todo mês", `<small data-guardar>${C.reais(r.guardar)} em ${C.nomeMes(mes, { ano: false })}</small>`);
  sr.insertAdjacentHTML("beforeend", `<div class="fi-reserva" data-sem-deslize><input type="range" min="0" max="${C.RESERVA_MAX}" step="5" value="${r.reservaPct}" aria-label="Quanto guardar da renda prevista (%)"><output>${r.reservaPct}%</output></div>
    <div class="fi-reserva-marcas" aria-hidden="true">${[0, 10, 20, 30, 40, 50].map(p => `<span>${p}%</span>`).join("")}</div>
    <p class="fi-dica">Sai da renda prevista antes do "pode gastar". O app sugere ${C.RESERVA_PADRAO}%.</p>`);
  const rg = sr.querySelector("input[type=range]"), pintar = () => rg.style.setProperty("--fi-pct", `${(+rg.value / C.RESERVA_MAX) * 100}%`);
  pintar();
  rg.oninput = () => { pintar(); sr.querySelector("output").textContent = `${rg.value}%`; sr.querySelector("[data-guardar]").textContent = `${C.reais(Math.round(r.rendaPrevista * +rg.value) / 100)} em ${C.nomeMes(mes, { ano: false })}`; };
  rg.onchange = () => { f.ajustes = { ...f.ajustes, reservaPct: +rg.value, reservaManual: true, em: new Date().toISOString() }; salvar(); desenhar(false); };
  // limites
  const somaLim = C.categorias(f, "saida").reduce((t, c) => t + (c.limite || 0), 0);
  const sl = secao(el, "Limites por categoria", `<button class="fi-link" data-a="sugerir">Usar a sugestão</button>`);
  const cu = sug.custo;
  sl.insertAdjacentHTML("beforeend", `<p class="fi-dica">Para gastar sobram <b>${C.reais(sug.base)}</b> (renda prevista ${C.reais(sug.renda)} − guardar ${C.reais(sug.guardar)}). Nos limites: <b class="${somaLim > sug.base ? "fi-neg" : ""}">${C.reais(somaLim)}</b>.</p>
    <p class="fi-dica">Na sugestão, Comida e Transporte vêm de uma conta: <b>${cu.dias} ${cu.dias === 1 ? "dia" : "dias"} de aula</b> ${sug.padrao ? "(sem Agenda: 22)" : `em ${C.nomeMes(mes, { ano: false })} na Agenda`}; o resto (${C.reais(sug.resto)}) vai pelos pesos das outras.</p>`);
  for (const c of C.categorias(f, "saida")) {
    const d = document.createElement("div"); d.className = "fi-lim";
    const g = r.porCategoria.find(x => x.id === c.id);
    d.innerHTML = `<button class="fi-lanc-ico c${c.cor}" data-a="cat" aria-label="Editar ${escapar(c.nome)}">${ico(c.icone)}</button>
      <span class="fi-lanc-tx"><b>${escapar(c.nome)}</b><small>sugestão ${C.reais(sug.limites[c.id] ?? 0, { curto: true })}${C.calculoDe(c.id) === "almoco" ? ` (${cu.dias} × ${C.reais(cu.almoco, { curto: true })})` : C.calculoDe(c.id) === "passagens" ? ` (${cu.recargas} ${cu.recargas === 1 ? "recarga" : "recargas"})` : ""}${g?.gasto ? ` · gastou ${C.reais(g.gasto, { curto: true })}` : ""}</small></span>
      <label class="fi-lim-v"><span>R$</span><input data-teclado="dinheiro" aria-label="Limite de ${escapar(c.nome)}" value="${C.paraCampo(c.limite)}" placeholder="sem"></label>`;
    d.querySelector('[data-a="cat"]').onclick = () => editarCategoria(c.id);
    let t = null;
    d.querySelector("input").addEventListener("input", (e) => {
      clearTimeout(t); t = setTimeout(() => { const v = C.deCampo(e.target.value); f.categorias[c.id] = { ...f.categorias[c.id], limite: v > 0 ? v : null, em: new Date().toISOString() }; salvar(); }, 500);
    });
    sl.append(d);
  }
  const nova = document.createElement("button"); nova.className = "fi-linha-link"; nova.innerHTML = `${ico("🏷️")}<span>Nova categoria de gasto</span>${I.mais}`;
  nova.onclick = () => editarCategoria(null, "saida"); sl.append(nova);
  sl.querySelector('[data-a="sugerir"]').onclick = async () => {
    const linhas = C.categorias(f, "saida").map(c => `${c.nome}: ${C.reais(sug.limites[c.id] ?? 0, { curto: true })}${C.calculoDe(c.id) === "almoco" ? ` (almoço × ${cu.dias} dias de aula)` : C.calculoDe(c.id) === "passagens" ? ` (${cu.passagens} passagens: ${cu.recargas} × ${C.reais(cu.recarga.valor, { curto: true })})` : ""}`).join("\n");
    if (!(await modal({ titulo: "Usar a sugestão do app?", texto: `Pela renda prevista de ${C.nomeMes(mes, { ano: false })} (${C.reais(sug.renda)}), guardando ${C.reais(sug.guardar)}:\n\n${linhas}\n\nDepois é só ajustar cada um.`, botoes: [{ texto: "Usar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] }))) return;
    const agora = new Date().toISOString();
    for (const c of C.categorias(f, "saida")) f.categorias[c.id] = { ...f.categorias[c.id], limite: sug.limites[c.id] || null, em: agora };
    salvar(); desenhar(false); toast("Limites ajustados pela sugestão");
  };
  // almoço e passagens (os atalhos de um toque e a conta da sugestão)
  const sa = secao(el, "Almoço e passagens", `<small>${cu.dias} dias de aula em ${C.nomeMes(mes, { ano: false })}</small>`);
  const rc = C.recarga(f);
  const campoV = (k, rot, dica, v, pre = "R$") => `<div class="fi-lim"><span class="fi-lanc-tx"><b>${rot}</b><small>${dica}</small></span><label class="fi-lim-v">${pre ? `<span>${pre}</span>` : ""}<input ${pre ? `data-teclado="dinheiro"` : `data-teclado="num" data-max="3"`} data-k="${k}" aria-label="${rot}" value="${pre ? C.paraCampo(v) : v}"></label></div>`;
  sa.insertAdjacentHTML("beforeend", `${campoV("almoco", "Almoço", "um toque em Almoço lança este valor em Comida", C.almoco(f))}
    ${campoV("recargaValor", "Recarga do cartão", "um toque em Recarreguei lança este valor em Transporte", rc.valor)}
    ${campoV("recargaPassagens", "Passagens por recarga", "2 por dia com aula ou atividade na Agenda", rc.passagens, "")}`);
  sa.querySelectorAll("input[data-k]").forEach(i => {
    let t = null;
    i.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => {
      const v = i.dataset.teclado === "dinheiro" ? C.deCampo(i.value) : parseInt(i.value, 10);
      f.ajustes = { ...f.ajustes, [i.dataset.k]: v > 0 ? v : null, em: new Date().toISOString() }; salvar();
    }, 600); });
  });
  // entradas fixas
  const sf = secao(el, "Entradas e saídas fixas", `<small>+${C.reais(r.fixas.reduce((t, x) => t + x.previsto, 0), { curto: true })} · −${C.reais(r.fixasSai.reduce((t, x) => t + x.previsto, 0), { curto: true })} em ${C.nomeMes(mes, { ano: false })}</small>`);
  for (const fx of Object.values(f.fixas).filter(x => !x.apagada).sort((a, b) => (a.tipo === "saida") - (b.tipo === "saida") || (a.ordem || 99) - (b.ordem || 99))) {
    const sai = fx.tipo === "saida", b = document.createElement("button"); b.className = `fi-lanc ${sai ? "saida" : "entrada"} ${fx.ativa === false ? "desligada" : ""}`;
    const periodo = `${fx.desde ? `desde ${C.nomeMes(fx.desde, { curto: true })}` : ""}${fx.ate ? ` até ${C.nomeMes(fx.ate, { curto: true })}` : ""}`;
    b.innerHTML = `<span class="fi-lanc-ico c${cat(fx.cat).cor}">${ico(fx.icone || cat(fx.cat).icone)}</span><span class="fi-lanc-tx"><b>${escapar(fx.nome)}</b><small>${sai ? "saída · " : ""}${fx.dia ? `por volta do dia ${fx.dia}` : "sem dia certo"}${periodo ? ` · ${periodo}` : ""}${fx.ativa === false ? " · pausada" : ""}</small></span><span class="fi-lanc-v">${fx.valor ? C.reais(sai ? -fx.valor : fx.valor, { curto: true, sinal: sai }) : "pôr o valor"}</span>`;
    b.onclick = () => editarFixa(fx.id); sf.append(b);
  }
  const nf = document.createElement("button"); nf.className = "fi-linha-link"; nf.innerHTML = `${ico("💵")}<span>Nova entrada fixa</span>${I.mais}`;
  nf.onclick = () => editarFixa(null); sf.append(nf);
  const ns = document.createElement("button"); ns.className = "fi-linha-link"; ns.innerHTML = `${ico("🔁")}<span>Nova saída fixa<small>assinaturas, mensalidades…</small></span>${I.mais}`;
  ns.onclick = () => editarFixa(null, "saida"); sf.append(ns);
  // categorias de entrada
  const sc = secao(el, "Categorias de entrada");
  const ch = document.createElement("div"); ch.className = "fi-chips leitura";
  ch.innerHTML = C.categorias(f, "entrada").map(c => `<button data-c="${c.id}">${icone(c.icone, "ico-inline")}${escapar(c.nome)}</button>`).join("") + `<button data-c="">+ Nova</button>`;
  ch.querySelectorAll("button").forEach(b => (b.onclick = () => editarCategoria(b.dataset.c || null, "entrada")));
  sc.append(ch);
}

function editarCategoria(id, tipo = "saida") {
  const f = F(), c = id ? f.categorias[id] : { nome: "", icone: tipo === "saida" ? "🏷️" : "💵", tipo, cor: 1 + (Object.keys(f.categorias).length % C.CORES) };
  let icoSel = c.icone, corSel = c.cor;
  const corpo = document.createElement("div"); corpo.className = "fi-form";
  corpo.innerHTML = `<label class="fi-campo"><small>Nome</small><input data-teclado="texto" aria-label="Nome da categoria" maxlength="30" value="${escapar(c.nome)}"></label>
    <small class="fi-rot">Ícone</small><div class="fi-icones">${ICONES_CAT.map(e => `<button type="button" data-e="${e}" class="${e === icoSel ? "on" : ""}">${icone(e, "ico3d")}</button>`).join("")}</div>
    <small class="fi-rot">Cor</small><div class="fi-cores">${Array.from({ length: C.CORES }, (_, i) => `<button type="button" class="c${i + 1} ${i + 1 === corSel ? "on" : ""}" data-c="${i + 1}" aria-label="Cor ${i + 1}"></button>`).join("")}</div>
    <div class="fi-bts"><button type="button" class="botao" data-a="salvar">${id ? "Salvar" : "Criar"}</button>${id ? `<button type="button" class="botao secundario" data-a="apagar">Apagar a categoria</button>` : ""}</div>`;
  corpo.querySelectorAll(".fi-icones button").forEach(b => (b.onclick = () => { icoSel = b.dataset.e; corpo.querySelectorAll(".fi-icones button").forEach(x => x.classList.toggle("on", x === b)); }));
  corpo.querySelectorAll(".fi-cores button").forEach(b => (b.onclick = () => { corSel = +b.dataset.c; corpo.querySelectorAll(".fi-cores button").forEach(x => x.classList.toggle("on", x === b)); }));
  const { fechar } = folha(id ? `Categoria: ${c.nome}` : tipo === "saida" ? "Nova categoria de gasto" : "Nova categoria de entrada", corpo);
  tecl.configurar({ aoConcluir: () => {} , rotuloConcluir: "OK" });
  corpo.querySelector('[data-a="salvar"]').onclick = () => {
    const nome = corpo.querySelector("input").value.trim();
    if (!nome) { toast("Dê um nome à categoria."); return; }
    const nid = id || nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || C.novoId("c");
    if (!id && f.categorias[nid] && !f.categorias[nid].apagada) { toast("Já existe uma categoria com esse nome."); return; }
    const ordem = id ? c.ordem : 1 + Math.max(0, ...C.categorias(f, c.tipo).map(x => x.ordem || 0));
    f.categorias[nid] = { ...(f.categorias[nid] || {}), ...c, id: nid, nome, icone: icoSel, cor: corSel, ordem, apagada: false, limite: c.limite ?? null, em: new Date().toISOString() };
    salvar(); fechar(); desenhar(false);
  };
  corpo.querySelector('[data-a="apagar"]')?.addEventListener("click", async () => {
    const n = C.lancamentos(f).filter(l => l.cat === id).length;
    if (!(await modal({ titulo: `Apagar ${c.nome}?`, texto: n ? `Os ${n} lançamentos dela continuam, como "Sem categoria".` : "Ela não tem lançamentos.", botoes: [{ texto: "Apagar", valor: true, classe: "errado" }, { texto: "Cancelar", valor: false, classe: "secundario" }] }))) return;
    f.categorias[id] = { ...c, apagada: true, em: new Date().toISOString() }; salvar(); fechar(); desenhar(false);
  });
}

function editarFixa(id, tipoNovo = "entrada") {
  const f = F(), fx = id ? f.fixas[id] : tipoNovo === "saida" ? { tipo: "saida", nome: "", valor: 0, dia: null, desde: C.mesDe(hojeISO()), ate: null, cat: "assinaturas", icone: "🔁", ativa: true }
    : { nome: "", valor: 0, dia: null, desde: C.mesDe(hojeISO()), ate: null, cat: "familia", icone: "💵", ativa: true };
  const sai = fx.tipo === "saida", tipo = sai ? "saida" : "entrada";
  const meses = []; for (let k = -12; k <= 24; k++) meses.push(C.somaMes(C.mesDe(hojeISO()), k));
  const opMes = (sel, vazio) => `${vazio ? `<option value="">${vazio}</option>` : ""}${meses.map(m => `<option value="${m}" ${m === sel ? "selected" : ""}>${C.nomeMes(m, { curto: true })}</option>`).join("")}`;
  const corpo = document.createElement("div"); corpo.className = "fi-form";
  corpo.innerHTML = `<label class="fi-campo"><small>Nome</small><input data-teclado="texto" aria-label="Nome da entrada" maxlength="30" value="${escapar(fx.nome)}" placeholder="${sai ? "Ex.: Assinatura do Claude" : "Ex.: Mãe, Bolsa…"}"></label>
    <label class="fi-valor"><span>R$</span><input data-teclado="dinheiro" aria-label="Valor previsto" value="${C.paraCampo(fx.valor)}" placeholder="0,00"></label>
    <div class="fi-duas"><label class="fi-campo"><small>Dia previsto (opcional)</small><input data-teclado="num" data-max="2" aria-label="Dia do mês (opcional; vazio = sem dia certo)" value="${fx.dia || ""}" placeholder="varia (sem dia certo)"></label>
    <label class="fi-campo"><small>Categoria</small><select aria-label="Categoria">${C.categorias(f, tipo).map(c => `<option value="${c.id}" ${c.id === fx.cat ? "selected" : ""}>${escapar(c.nome)}</option>`).join("")}</select></label></div>
    <div class="fi-duas"><label class="fi-campo"><small>A partir de</small><select data-k="desde" aria-label="A partir de">${opMes(fx.desde, "sempre")}</select></label>
    <label class="fi-campo"><small>Até</small><select data-k="ate" aria-label="Até">${opMes(fx.ate, "sem fim")}</select></label></div>
    <label class="fi-troca"><input type="checkbox" ${fx.ativa !== false ? "checked" : ""}><span>${sai ? "Ativa (sai do \"pode gastar\" até ser paga)" : "Ativa (entra na renda prevista)"}</span></label>
    <div class="fi-bts"><button type="button" class="botao" data-a="salvar">${id ? "Salvar" : "Criar"}</button>${id ? `<button type="button" class="botao secundario" data-a="apagar">Apagar</button>` : ""}</div>`;
  const { fechar } = folha(id ? fx.nome : sai ? "Nova saída fixa" : "Nova entrada fixa", corpo);
  tecl.configurar({ rotuloConcluir: "OK" });
  corpo.querySelector('[data-a="salvar"]').onclick = () => {
    const nome = corpo.querySelector('[aria-label="Nome da entrada"]').value.trim(), valor = C.deCampo(corpo.querySelector('[data-teclado="dinheiro"]').value);
    const dia = parseInt(corpo.querySelector('[data-teclado="num"]').value, 10);
    if (!nome) { toast("Dê um nome à entrada."); return; }
    if (!(valor > 0)) { toast("Falta o valor previsto."); return; }
    if (dia && (dia < 1 || dia > 31)) { toast("O dia vai de 1 a 31."); return; }
    const nid = id || C.novoId("f"), catId = corpo.querySelector('[aria-label="Categoria"]').value;
    f.fixas[nid] = { ...fx, id: nid, tipo, nome, valor, dia: dia || null, cat: catId, icone: id ? fx.icone : C.categorias(f, tipo).find(c => c.id === catId)?.icone || "💵",
      desde: corpo.querySelector('[data-k="desde"]').value || null, ate: corpo.querySelector('[data-k="ate"]').value || null, ativa: corpo.querySelector(".fi-troca input").checked,
      ordem: fx.ordem || 1 + Math.max(0, ...Object.values(f.fixas).map(x => x.ordem || 0)), apagada: false, em: new Date().toISOString() };
    salvar(); fechar(); desenhar(false);
  };
  corpo.querySelector('[data-a="apagar"]')?.addEventListener("click", async () => {
    if (!(await modal({ titulo: `Apagar ${fx.nome}?`, texto: sai ? "Os pagamentos já lançados continuam no extrato." : "Os recebimentos já lançados continuam no extrato.", botoes: [{ texto: "Apagar", valor: true, classe: "errado" }, { texto: "Cancelar", valor: false, classe: "secundario" }] }))) return;
    f.fixas[id] = { ...fx, apagada: true, em: new Date().toISOString() }; salvar(); fechar(); desenhar(false);
  });
}

// ---------------------------------------------------------------- Automações
const ROT_SAUDE = {
  ok: ["✅", "Rodou hoje", "ok"], andamento: ["⏳", "Rodando agora", "andamento"], incompleta: ["⚠️", "Parou no meio hoje", "erro"], erro: ["❌", "Deu erro hoje", "erro"],
  faltou: ["⚠️", "Não rodou hoje", "erro"], aguardando: ["⏳", "Aguardando liberar", "andamento"], cedo: ["🌙", "Ainda não rodou hoje", ""], nunca: ["🔗", "Sem notícias da macro", ""],
};
const ROT_EXEC = { ok: "ok", erro: "erro", incompleta: "parou", andamento: "rodando", aguardando: "aguardando" };
/** "Leva ~4 min" / "Leva menos de 1 min" pela mediana das últimas execuções (contas.js `duracaoTipica`). */
const levaTxt = (min, maiuscula = true) => min == null ? "" : `${maiuscula ? "L" : "l"}eva ${min < 1 ? "" : "~"}${C.textoDuracao(min)}`;
function telaAuto(el) {
  const f = F(), hoje = hojeISO();
  // a ponte
  const pt = document.createElement("button"); pt.className = `fi-ponte ${f.ponte?.issue ? "ok" : ""}`;
  pt.innerHTML = f.ponte?.issue
    ? `${ico("🔗")}<span><b>Registro das macros</b><small>issue #${f.ponte.issue} · ${f.lidoEm ? `lida ${quandoFoi(f.lidoEm)}` : "ainda não lida"}</small>${f.erroLeitura && f.erroLeitura.em > (f.lidoEm || "") ? `<small class="fi-erro-ponte">${icone("⚠️", "ico-inline")} ${escapar(f.erroLeitura.msg)}</small>` : ""}</span>${I.prox}`
    : `${ico("🔗")}<span><b>Conectar o MacroDroid</b><small>As macros do celular secundário mandam o registro para cá</small></span>${I.prox}`;
  pt.onclick = () => { sub = "conectar"; desenhar(); };
  el.append(pt);
  // a noite do orquestrador (a ordem das macros, quanto cada uma levou e o total)
  const nt = C.ultimaNoite(f, hoje);
  if (nt) { const c = cartaoNoite(nt, hoje); c.onclick = () => { sub = "orquestrador"; desenhar(); }; el.append(c); }
  for (const g of C.AUTOMACOES) {
    const s = secao(el, `${ico(g.icone)} ${g.nome}`, `<small>${escapar(g.desc)}</small>`);
    if (!g.fontes.length) { s.insertAdjacentHTML("beforeend", `<div class="fi-fonte embreve"><span class="fi-lanc-tx"><b>Bancos e CDI</b><small>Pix em grupos de até R$ 5 mil, horários de corte e o rendimento de cada banco. Em breve, quando você explicar o esquema.</small></span><span class="fi-tag">em breve</span></div>`); continue; }
    for (const fo of g.fontes) {
      const d = document.createElement(fo.ativa ? "button" : "div"); d.className = `fi-fonte ${fo.ativa ? "" : "embreve"}`; d.dataset.fonte = fo.id;
      if (!fo.ativa) { d.innerHTML = `<span class="fi-lanc-tx"><b>${escapar(fo.nome)}</b><small>Macro no repositório: —</small></span><span class="fi-tag">em breve</span>`; s.append(d); continue; }
      const rs = C.resumoFonte(f, fo.id, hoje), sd = C.saude(f, fo.id, hoje), [e, txt, cls] = ROT_SAUDE[sd.estado];
      const cot = C.cotacao(f, hoje), leva = levaTxt(C.duracaoTipica(f, fo.id));
      const tiles = [];
      // EarnApp (02/11/2026): o saldo é a soma das contas (celular secundário, principal, tablet e, se ligada, o PC)
      const et = fo.id === "earnapp" ? C.earnappTotal(f, hoje, cot) : null;
      if (et?.n > 1) tiles.push(`<span><small>Saldo · ${et.n} contas</small><b>${C.dolares(et.total)}</b><small>≈ ${C.reais(C.emReais(cot, et.total, "usd"))}</small></span>`);
      else if (rs.temSaldo) tiles.push(`<span><small>Saldo${rs.recompensa ? " (à mão)" : ""}</small><b>${rs.estimado ? "≈ " : ""}${C.naUnidade(rs.saldo, rs.un)}</b><small>${rs.un === "brl" ? (rs.previsao?.pronto ? "dá para sacar" : rs.minimo ? `saque com ${C.reais(rs.minimo)}` : "") : `≈ ${C.reais(C.emReais(cot, rs.saldo, rs.un))}`}</small></span>`);
      if (rs.recompensa?.dia != null) tiles.push(`<span><small>Recompensa diária</small><b>Dia ${rs.recompensa.dia}/${rs.recompensa.dias}</b><small>${rs.recompensa.premio} sats no dia ${rs.recompensa.dias}</small></span>`);
      if (rs.sequencia != null) tiles.push(`<span><small>${fo.id === "zbd" ? "Enquete" : "Sequência"}</small><b>${icone("🔥", "ico-inline")}${rs.sequencia}</b><small>${rs.sequencia === 1 ? "dia" : "dias"}</small></span>`);
      if (rs.tempo) tiles.push(`<span><small>Compartilhado</small><b>${escapar(rs.tempo)}</b></span>`);
      if (rs.temSaldo) tiles.push(`<span><small>7 dias</small><b>${C.naUnidade(rs.ganho7, rs.un, { sinal: true })}</b></span>`);
      if (!tiles.length) tiles.push(`<span><small>Seguidos</small><b>${sd.seguidos} ${sd.seguidos === 1 ? "dia ok" : "dias ok"}</b></span>`, `<span><small>Saldo</small><b>—</b><small>a macro só diz se deu certo</small></span>`);
      d.innerHTML = `<span class="fi-fonte-l"><span class="fi-lanc-tx"><b>${escapar(fo.nome)}</b><small>${escapar(fo.site || C.FONTES[fo.id]?.desc || "")}</small></span>
          <span class="fi-saude ${cls}">${icone(e, "ico-inline")}${txt}</span></span>
        <span class="fi-fonte-num">${tiles.slice(0, 3).join("")}</span>
        ${leva || rs.pronto ? `<span class="fi-macro">${leva || ""}${leva && rs.pronto ? " · " : ""}${rs.pronto ? "<b>saque disponível</b>" : ""}</span>` : ""}
        ${et ? `<span class="fi-fonte-contas">${et.contas.map(x => `<span>${x.sd ? icone(ROT_SAUDE[x.sd.estado][0], "ico-inline") : icone("✏️", "ico-inline")} ${escapar(x.nome)}${x.saldo != null ? ` ${C.dolares(x.saldo)}` : ""}${x.pronto ? " · sacar" : ""}</span>`).join("")}</span>` : ""}`;
      d.onclick = () => { sub = fo.id; desenhar(); };
      s.append(d);
    }
  }
  secaoCalendario(el, f, hoje);
}
// O calendário das automações (pedido do Alediov, 03/11/2026): uma linha por noite (a mais recente em cima) e uma coluna
// por macro, com as cores de contas.js `calendarioAutomacoes`; tocar no quadradinho mostra a noite daquela macro.
let calNoites = 10;
const COR_CAL = { ok: "ok", denovo: "denovo", erro: "erro", andamento: "andamento", nada: "nada", nao: "nao", aguardando: "nao", cedo: "cedo", antes: "antes" };
const CURTO_CAL = { orquestrador: "Ronda", earnapp: "EarnApp", earnbitcoin: "Earn BTC", slice: "Slice", zbd: "ZBD", earnappprincipal: "Princip.", earnapptablet: "Tablet", bump: "Bump", "pp-99": "99", "pp-mp": "MP", "pp-ast": "AST" };
const noiteTxt = (dia) => { const a = new Date(C.diaLocal(Date.parse(dia + "T12:00:00") - 864e5) + "T12:00:00"), b = new Date(dia + "T12:00:00"); return `${a.getDate()}${a.getMonth() === b.getMonth() ? "" : `/${a.getMonth() + 1}`} para ${b.getDate()}/${b.getMonth() + 1}`; };
function secaoCalendario(el, f, hoje) {
  if (!Object.values(f.execucoes || {}).some(ex => Object.keys(ex).length)) return; // nenhuma macro mandou nada ainda
  const cal = C.calendarioAutomacoes(f, hoje, { dias: 30 });
  const n = Math.min(calNoites, cal.dias.length), dias = cal.dias.slice(-n).reverse(), cols = cal.linhas.length;
  const s = secao(el, `${ico("🗓️")} Calendário das noites`, `<small>${n} noites</small>`);
  const pp = cal.linhas.findIndex(l => l.pp);
  const g = document.createElement("div"); g.className = "fi-calauto"; g.style.setProperty("--cols", cols);
  const cab = cal.linhas.map((l, k) => `<span class="cab${l.pp ? " pp" : ""}${k === pp ? " ini-pp" : ""}" title="${escapar(l.nome)}"><i>${escapar(CURTO_CAL[l.id] || l.nome)}</i></span>`).join("");
  const grupos = pp > 0 ? `<span class="grupo" style="grid-column: 2 / span ${pp}">Check-ins</span><span class="grupo pp" style="grid-column: ${pp + 2} / span ${cols - pp}">${icone("🏓", "ico-inline")} Ping-Pong</span>` : "";
  const linhas = dias.map(dia => {
    const d = new Date(dia + "T12:00:00");
    const rot = `<span class="dia${dia === hoje ? " hoje" : ""}${dia > hoje ? " vem" : ""}"><b>${dataCurta(dia)}</b><small>${dia > hoje ? "esta noite" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small></span>`;
    return rot + cal.linhas.map((l, k) => { const c = l.celulas.find(x => x.dia === dia); return `<button class="q ${COR_CAL[c.st] || "nada"}${k === pp ? " ini-pp" : ""}" data-l="${l.id}" data-d="${dia}" aria-label="${escapar(l.nome)}, noite de ${noiteTxt(dia)}: ${C.ROTULO_CAL[c.st] || c.st}">${c.st === "denovo" ? "↻" : c.st === "erro" ? "✕" : ""}</button>`; }).join("");
  }).join("");
  g.innerHTML = `<span></span>${grupos}<span></span>${cab}${linhas}`;
  g.querySelectorAll("button.q").forEach(b => (b.onclick = () => folhaCelula(cal, b.dataset.l, b.dataset.d)));
  s.append(g);
  s.insertAdjacentHTML("beforeend", `<div class="fi-cal-leg fi-calauto-leg"><span><i class="ok"></i>deu certo</span><span><i class="denovo"></i>deu certo tentando de novo</span><span><i class="erro"></i>falhou</span><span><i class="nada"></i>não rodou</span><span><i class="nao"></i>não se aplica</span></div>`);
  if (cal.dias.length > n || calNoites > 10) {
    const b = document.createElement("button"); b.className = "fi-link fi-calauto-mais";
    b.textContent = calNoites > 10 ? "Mostrar só as últimas 10 noites" : `Mostrar as ${cal.dias.length} noites`;
    b.onclick = () => { calNoites = calNoites > 10 ? 10 : 30; desenhar(false); };
    s.append(b);
  }
}
/** A noite de uma macro: a situação, cada execução (horário, etapa, mensagem, tentativas) e o que a macro Ping-Pong disse. */
function folhaCelula(cal, lid, dia) {
  const l = cal.linhas.find(x => x.id === lid), c = l?.celulas.find(x => x.dia === dia); if (!c) return;
  tocar("toque");
  const corpo = document.createElement("div"); corpo.className = "fi-calnoite";
  const st = (x) => x.st === "ok" ? "ok" : x.st === "andamento" || x.st === "aguardando" ? "andamento" : "erro";
  corpo.innerHTML = `<p class="fi-calnoite-st ${COR_CAL[c.st] || "nada"}"><i></i><b>${C.ROTULO_CAL[c.st] || c.st}</b><small>noite de ${noiteTxt(dia)}</small></p>
    ${c.itens.length ? `<ol class="fi-calnoite-lista">${c.itens.map(x => `<li class="${st(x)}"><span><b>${escapar(x.nome)}</b> · ${hora(x.inicio)}${x.fim ? ` → ${hora(x.fim)}` : ""}${x.min != null ? ` (${C.textoDuracao(x.min, { curto: true })})` : ""}</span>
      <small>${escapar(ROT_EXEC[x.st] || x.st)}${x.etapa ? ` · etapa ${escapar(x.etapa)}` : ""}${x.tentativas > 1 ? ` · ${x.tentativas} tentativas` : ""}</small>${x.msg ? `<small class="msg">${escapar(x.msg)}</small>` : ""}</li>`).join("")}</ol>`
      : `<p class="fi-dica">${c.st === "nao" ? "Nesta noite esta macro não tinha horário (ou foi pulada: feriado ou desligada na config)." : c.st === "cedo" ? "Ainda não chegou a hora desta macro." : c.st === "antes" ? "Antes da primeira execução registrada." : "Nenhum registro desta macro nesta noite."}</p>`}
    ${c.notas.length ? `<ul class="fi-calnoite-notas">${c.notas.map(x => `<li>${escapar(x)}</li>`).join("")}</ul>` : ""}`;
  const f = folha(`${l.nome} · ${dataCurta(dia)}`, corpo);
  if (!l.pp && C.FONTES[lid]) {
    const b = document.createElement("button"); b.className = "fi-link"; b.textContent = `Abrir ${C.nomeFonte(lid)}`;
    b.onclick = () => { f.fechar(); sub = lid; voltarPara = null; desenhar(); };
    corpo.append(b);
  } else if (l.pp) {
    const b = document.createElement("button"); b.className = "fi-link"; b.textContent = "Abrir o Ping-Pong";
    b.onclick = () => { f.fechar(); sub = "pingpong"; voltarPara = null; desenhar(); };
    corpo.append(b);
  }
}

/** A linha do tempo de uma noite: "Esta noite: 00:05 → 00:19", cada macro na ordem com a duração e o total. */
function cartaoNoite(nt, hoje, { titulo = true } = {}) {
  const d = document.createElement(titulo ? "button" : "div"); d.className = "fi-noite";
  const fimTxt = nt.fim ? hora(nt.fim) : "…";
  const nome = nt.dia === hoje ? "Esta noite" : `Noite de ${dataCurta(nt.dia)}`;
  const a = Date.parse(nt.inicio), b = nt.fim ? Date.parse(nt.fim) : Math.max(a + 60000, ...nt.itens.map(x => Date.parse(x.fim || x.inicio))), amp = Math.max(60000, b - a);
  const st = nt.orq ? nt.orq.st : nt.itens.some(x => x.st === "erro" || x.st === "incompleta") ? "erro" : nt.itens.every(x => x.st === "ok" || x.st === "aguardando") ? "ok" : "andamento";
  const seg = (x) => { const i = Math.max(0, (Date.parse(x.inicio) - a) / amp), w = Math.max(0.025, ((Date.parse(x.fim || x.inicio) - Date.parse(x.inicio)) / amp)); return `<i class="fi-noite-seg ${x.st} f-${x.fonte}" style="left:${(i * 100).toFixed(1)}%;width:${(Math.min(1 - i, w) * 100).toFixed(1)}%" title="${escapar(x.nome)}"></i>`; };
  d.innerHTML = `<span class="fi-noite-cab">${ico("🌙")}<span><b>${nome}: ${hora(nt.inicio)} → ${fimTxt}</b><small>${nt.total != null ? `${C.textoDuracao(nt.total)} no total` : "rodando"} · ${nt.itens.length} ${nt.itens.length === 1 ? "macro" : "macros"}${nt.orq ? "" : " (sem a Ronda)"}</small></span><span class="fi-saude ${ROT_SAUDE[st === "ok" ? "ok" : st === "andamento" ? "andamento" : "erro"][2]}">${ROT_EXEC[st] || st}</span></span>
    <span class="fi-noite-barra" aria-hidden="true">${nt.itens.map(seg).join("")}</span>
    ${nt.situacao.length ? `<span class="fi-noite-sit">${nt.situacao.map(x => `<span class="${x.st === "ok" ? "ok" : x.st === "falta" ? "falta" : "erro"}">${escapar(x.nome)} ${escapar(x.st)}</span>`).join("")}</span>` : ""}
    <span class="fi-noite-lista">${nt.itens.map((x, k) => `<span class="fi-noite-item ${x.st}"><em>${k + 1}</em><b>${escapar(x.nome)}</b><small>${hora(x.inicio)}${x.min != null ? ` · ${C.textoDuracao(x.min, { curto: true })}` : ""}</small><span>${x.st === "ok" ? "✓" : x.st === "andamento" || x.st === "aguardando" ? "…" : "✗"}</span></span>`).join("")}</span>`;
  return d;
}
function quandoFoi(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "agora"; if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return `em ${dataCurta(C.diaLocal(iso))}`;
}

const nomeAba = () => ABAS.find(a => a[0] === aba)?.[1] || "Voltar";
function cabSub(el, titulo, subt = "", voltar = null) {
  const h = document.createElement("div"); h.className = "fi-cab";
  voltar ||= voltarPara === "dinheiro" ? "Seu dinheiro" : C.FONTES[voltarPara] ? C.nomeFonte(voltarPara) : "Automações";
  h.innerHTML = `<button class="fi-voltar">${I.voltar}<span>${voltar}</span></button><h2>${titulo}</h2>${subt ? `<p>${subt}</p>` : ""}`;
  h.querySelector(".fi-voltar").onclick = () => { sub = voltarPara; voltarPara = null; desenhar(true, -1); };
  el.append(h);
}

/** "Atualizar à mão" (Earn Bitcoin, que a macro não consegue ler): o saldo em sats e, opcional, o dia da recompensa diária. */
function atualizarFonteAMao(fonte, rs) {
  const f = F(), hoje = hojeISO(), info = C.FONTES[fonte], rd = rs.recompensa;
  const corpo = document.createElement("div"); corpo.className = "fi-form";
  const emUsd = info.un === "usd"; // a conta do EarnApp no PC: em US$
  corpo.innerHTML = `<p class="fi-dica">O que o ${escapar(info.nome)} mostra agora. ${rd ? `O app estima <b>${C.naUnidade(rs.saldo, "sats")}</b>${rd.dia != null ? ` e o dia ${rd.dia}` : ""}.` : ""}</p>
    ${emUsd ? `<label class="fi-campo"><small>Saldo (US$)</small><input data-teclado="dinheiro" aria-label="Saldo em US$" value="${rs.saldo != null ? C.paraCampo(rs.saldo) : ""}"></label>`
      : `<label class="fi-campo"><small>Saldo (sats)</small><input data-teclado="num" data-max="9" aria-label="Saldo em sats" value="${rs.saldo != null ? Math.round(rs.saldo) : ""}"></label>`}`;
  corpo.insertAdjacentHTML("beforeend", `
    ${info.ciclo ? `<label class="fi-campo"><small>Dia da recompensa diária (opcional, 1 a ${info.ciclo.dias})</small><input data-teclado="num" data-max="2" aria-label="Dia da recompensa diária" value="${rd?.dia ?? ""}" placeholder="—"></label>` : ""}
    <div class="fi-bts"><button type="button" class="botao" data-a="ok">Salvar</button></div>`);
  const { fechar } = folha(`Atualizar à mão: ${info.nome}`, corpo);
  const ok = () => {
    if (emUsd) {
      const usd = C.deCampo(corpo.querySelector('[aria-label="Saldo em US$"]').value);
      C.atualizarAMao(f, fonte, hoje, { usd }); salvar(); fechar(); desenhar(false); toast(`${info.nome}: saldo atualizado`); return;
    }
    const sats = parseInt(corpo.querySelector('[aria-label="Saldo em sats"]').value, 10);
    const dr = parseInt(corpo.querySelector('[aria-label="Dia da recompensa diária"]')?.value || "", 10);
    if (!(sats >= 0)) { toast("Escreva o saldo em sats."); return; }
    if (info.ciclo && Number.isFinite(dr) && (dr < 1 || dr > info.ciclo.dias)) { toast(`O dia vai de 1 a ${info.ciclo.dias}.`); return; }
    C.atualizarAMao(f, fonte, hoje, { sats, diaRecompensa: Number.isFinite(dr) ? dr : null });
    salvar(); fechar(); desenhar(false); toast(`${info.nome}: saldo atualizado`);
  };
  tecl.configurar({ aoConcluir: ok, rotuloConcluir: "Salvar" });
  corpo.querySelector('[data-a="ok"]').onclick = ok;
}

// Uma fonte (Slice, EarnApp, Earn Bitcoin, ZBD ou o orquestrador): a saúde da macro (registro de execução, quanto
// leva), o saldo quando a macro manda (sats pelo bitcoin, US$ pelo dólar), o ganho, a sequência com os dias perdidos,
// o gráfico, o mínimo de saque, a previsão e os saques. Earn Bitcoin, por enquanto, só diz se deu certo.
function telaFonte(el, fonte) {
  const f = F(), hoje = hojeISO(), info = C.FONTES[fonte], nome = info.nome;
  const cot = C.cotacao(f, hoje), rs = C.resumoFonte(f, fonte, hoje, cot), sd = C.saude(f, fonte, hoje), un = rs.un;
  const brl = (v) => C.reais(C.emReais(cot, v, un));
  const leva = levaTxt(C.duracaoTipica(f, fonte), false);
  cabSub(el, escapar(nome), `${escapar(info.desc || "")}${info.site ? ` · ${escapar(info.site)}` : ""}${leva ? ` · ${leva}` : ""}`);
  // saúde da automação
  const [e, txt, cls] = ROT_SAUDE[sd.estado];
  const hj = sd.deHoje[0], val = (r) => r?.sats != null ? C.naUnidade(r.sats, "sats") : r?.usd != null ? C.dolares(r.usd) : r?.brl != null && un === "brl" ? C.reais(r.brl) : "";
  const okHj = sd.deHoje.find(r => r.st === "ok");
  const det = sd.estado === "ok" ? `às ${hora(okHj.fim)}${C.duracao(okHj) != null ? ` (${C.textoDuracao(C.duracao(okHj))})` : ""}${val(hj) ? ` · ${val(hj)}` : ""}`
    : sd.estado === "incompleta" ? `parou na etapa <b>${escapar(hj.etapa || "do começo")}</b> (${hora(hj.em)})`
    : sd.estado === "erro" ? `${hj.etapa ? `na etapa <b>${escapar(hj.etapa)}</b>: ` : ""}${escapar(hj.msg || "sem detalhe")}`
    : sd.estado === "andamento" ? `etapa ${escapar(hj.etapa || "início")} (${hora(hj.em)})`
    : sd.estado === "aguardando" ? `o resgate de hoje ainda não liberou (${hora(hj.em)}); a macro tenta de novo no próximo horário` 
    : sd.estado === "faltou" ? `nenhuma notícia da macro desde ${sd.ultima ? dataCurta(sd.ultima.dia) : "—"}.${fonte === "orquestrador" ? "" : ` Abra o ${escapar(nome)} hoje${rs.sequencia != null ? " para não perder a sequência" : ""}.`}`
    : sd.estado === "cedo" ? "a macro roda de madrugada" : "conecte o MacroDroid e acrescente os avisos na macro";
  // EarnApp (02/11/2026): as contas de cada aparelho, com o total e o "pronto para sacar" de cada uma (o saque é por conta)
  if (fonte === "earnapp") secaoContas(el, f, hoje, cot);
  // a conta sem automação (o PC): sem saúde de macro; liga e desliga daqui
  const s0 = info.semMacro ? document.createElement("div") : secao(el, "Saúde da automação", sd.seguidos ? `<small>${icone("🔥", "ico-inline")} ${sd.seguidos} ${sd.seguidos === 1 ? "dia ok" : "dias ok seguidos"}</small>` : "");
  if (info.opcional) {
    const lig = C.contaLigada(f, fonte), b = document.createElement("button"); b.className = "fi-linha-link"; b.dataset.a = "ligar-conta";
    b.innerHTML = `${ico("💡")}<span>${lig ? "Desligar esta conta" : "Ligar esta conta"}<small>${lig ? "sai do total do EarnApp (o que foi informado fica guardado)" : "entra no total do EarnApp; o saldo é informado à mão"}</small></span>${I.prox}`;
    b.onclick = () => { f.fontes[fonte] = { ...(f.fontes[fonte] || {}), ligada: !lig, em: new Date().toISOString() }; salvar(); desenhar(false); toast(lig ? "Conta desligada" : "Conta ligada"); };
    el.append(b);
  }
  if (!info.semMacro) s0.insertAdjacentHTML("beforeend", `<div class="fi-saude-grande ${cls}">${ico(e)}<span><b>${txt}</b><small>${det}</small></span></div>`);
  // a conferência agora é do dia inteiro, no alto do Início ("Conferi as Finanças", 02/11/2026): a situação da macro fica
  if (sd.lista.length) {
    const lst = document.createElement("div"); lst.className = "fi-execs";
    lst.innerHTML = sd.lista.map(r => { const m = C.duracao(r); return `<div class="fi-exec ${r.st}"><span class="fi-exec-d"><b>${dataCurta(r.dia)}</b><small>${hora(r.inicio)}${m != null ? ` · ${C.textoDuracao(m, { curto: true })}` : ""}</small></span>
      <span class="fi-exec-tx"><span class="fi-exec-et">${r.etapas.length ? r.etapas.map(x => escapar(x)).join(" › ") : r.st === "ok" ? "fim" : "início"}${r.tentativas > 1 ? ` · ${r.tentativas} tentativas` : ""}</span>${r.msg && r.st === "erro" ? `<small>${escapar(r.msg)}</small>` : r.avisos?.length ? `<small>${escapar(r.avisos[0])}</small>` : r.msg ? `<small class="neutro">${escapar(r.msg)}</small>` : ""}</span>
      <span class="fi-exec-st">${ROT_EXEC[r.st]}${val(r) ? `<small>${val(r)}</small>` : ""}</span></div>`; }).join("");
    s0.append(lst);
  }
  if (f.ultimoProblema && f.ultimoProblema.fonte === fonte) s0.insertAdjacentHTML("beforeend", `<p class="fi-dica">${icone("⚠️", "ico-inline")} Último registro com problema (${dataCurta(C.diaLocal(f.ultimoProblema.em))}): ${escapar(f.ultimoProblema.motivo)}</p>`);
  const tl = f.telas?.[fonte];
  if (tl) {
    const b = document.createElement("button"); b.className = "fi-linha-link fi-tela-lida";
    b.innerHTML = `${ico("📱")}<span>Leitura de tela recebida ${quandoFoi(tl.em)}<small>a tela inteira, para o reconhecimento (só a última fica)</small></span>${I.prox}`;
    b.onclick = () => { const c = document.createElement("div"); c.className = "fi-form"; c.innerHTML = `<p class="fi-dica">${escapar(nome)} · ${dataCurta(C.diaLocal(tl.em))} às ${hora(tl.em)}${tl.run ? ` · execução ${escapar(tl.run)}` : ""}</p><pre class="fi-tela-texto">${escapar(tl.texto)}</pre>`; folha("Leitura de tela", c); };
    s0.append(b);
  }
  // o orquestrador: as últimas noites
  if (fonte === "orquestrador") {
    const sn = secao(el, "As últimas noites");
    const dias = [...new Set(["orquestrador", ...C.FONTES_ATIVAS].flatMap(fo => Object.values(f.execucoes?.[fo] || {}).map(r => r.dia)))].filter(d => d <= hoje).sort().reverse().slice(0, 7);
    for (const d of dias) { const nt = C.noite(f, d); if (nt) sn.append(cartaoNoite(nt, hoje, { titulo: false })); }
    if (!dias.length) sn.insertAdjacentHTML("beforeend", `<p class="fi-dica">As noites aparecem com o registro da Ronda.</p>`);
    return;
  }
  // o Ping-Pong: o dinheiro dele (o saldo do Render lido em cada ida), onde está e os últimos passos
  if (fonte === "pingpong") {
    const din = C.dinheiro(f, hoje), sd2 = secao(el, "Seu dinheiro", din ? `<small>lido ${quandoFoi(din.em)}</small>` : "");
    if (!din) sd2.insertAdjacentHTML("beforeend", `<p class="fi-dica">O saldo aparece quando uma ida (ARQ → 99, MP ou AST) ler o Render, mesmo nos testes de R$ 1,00.</p>`);
    else {
      sd2.insertAdjacentHTML("beforeend", `<div class="fi-tiles"><span><small>Saldo do Render</small><b>${C.reais(din.valor)}</b><small>${escapar(din.onde.txt)}</small></span>${din.var7 != null ? `<span><small>Desde ${dataCurta(din.desde7)}</small><b>${C.reais(din.var7, { sinal: true })}</b><small>inclui seus gastos e depósitos</small></span>` : ""}</div>${din.onde.alerta ? `<p class="fi-dica">⚠️ ${escapar(din.onde.alerta)}: confira onde o dinheiro ficou.</p>` : ""}`);
      if (din.serie.length >= 2) sd2.append(graficoSaldo(din.serie, "brl", "Render do ARQ"));
    }
    const movs = (f.dinheiro?.movs || []).slice(-8).reverse();
    if (movs.length) {
      const sm = secao(el, "Últimos passos");
      for (const x of movs) sm.insertAdjacentHTML("beforeend", `<div class="fi-linha-link"><span>${x.ok ? "✓" : "⚠️"} ${escapar(x.msg || x.passo)}<small>${new Date(x.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hora(x.em)}</small></span></div>`);
    }
  }
  // saldo e números (quando a macro manda o saldo, ou à mão no Earn Bitcoin)
  const rotSeq = info.rotuloSeq || "Sequência";
  const botaoAMao = (sec) => {
    if (!info.manual) return;
    const b = document.createElement("button"); b.className = "fi-linha-link fi-amao"; b.dataset.a = "amao";
    b.innerHTML = `${ico("✏️")}<span>Atualizar à mão<small>o saldo em ${info.un === "usd" ? "US$" : "sats"}${info.ciclo ? " e o dia da recompensa diária" : ""}</small></span>${I.prox}`;
    b.onclick = () => atualizarFonteAMao(fonte, rs);
    sec.append(b);
  };
  if (fonte === "pingpong") { /* o saldo já está em "Seu dinheiro" */ }
  else if (!rs.temSaldo) {
    const s1 = secao(el, "Saldo");
    s1.insertAdjacentHTML("beforeend", `${rs.sequencia != null ? `<div class="fi-tiles"><span><small>${rotSeq}</small><b>${icone("🔥", "ico-inline")}${rs.sequencia}</b><small>${rs.sequencia === 1 ? "dia" : "dias"}</small></span></div>` : ""}<p class="fi-dica">${info.semMacro ? `Sem automação: informe o saldo em US$ que o EarnApp mostra quando abrir o app (ele entra no total do EarnApp).` : info.manual ? `A macro não lê o saldo do ${escapar(nome)} (só confere se o ${info.ciclo ? "resgate" : "check-in"} deu certo). Informe à mão o saldo${info.ciclo ? ` e o dia da recompensa diária: o app estima o resto (cada resgate avança 1 dia; o dia ${info.ciclo.dias} dá ${info.ciclo.premio} sats)` : " quando abrir o app"}.` : info.un ? `A macro ainda não mandou o saldo do ${escapar(nome)}.` : `Por enquanto a macro do ${escapar(nome)} só diz se o check-in deu certo; o saldo entra quando ela mandar <code>sats=</code> ou <code>usd=</code>.`}</p>`);
    botaoAMao(s1);
  } else {
    const origem = un === "brl" ? "em reais" : un === "sats" ? `bitcoin ${C.reais(cot.btc || 0, { curto: true })} · ${{ hoje: "de hoje", ultima: `de ${cot.diaBtc ? dataCurta(cot.diaBtc) : "antes"}`, estimada: "estimado pelo site" }[cot.origemBtc] || "sem cotação"}`
      : `dólar ${cot.usd.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${{ manual: "manual", hoje: "de hoje", ultima: `de ${cot.dia ? dataCurta(cot.dia) : "antes"}`, estimada: "estimado" }[cot.origem]}`;
    const s1 = secao(el, "Saldo", `<small>${origem}</small>`);
    const tiles = [], rd = rs.recompensa;
    if (rd?.dia != null) tiles.push(`<span><small>Recompensa diária</small><b>Dia ${rd.dia} de ${rd.dias}</b><small>${rd.premio} sats no dia ${rd.dias}${rd.proximoPremio ? ` (≈ ${dataCurta(rd.proximoPremio)})` : ""}</small></span>`);
    if (rs.sequencia != null) tiles.push(`<span><small>${rotSeq}</small><b>${icone("🔥", "ico-inline")}${rs.sequencia}</b><small>${fonte === "slice" ? `bônus ≈ ${rs.sequencia + 1} pontos/dia` : rs.sequencia === 1 ? "dia" : "dias"}</small></span>`);
    if (rs.tempo) tiles.push(`<span><small>Tempo compartilhado</small><b>${escapar(rs.tempo)}</b><small>o que o app mostra</small></span>`);
    if (rd) tiles.push(`<span><small>Resgates desde ${dataCurta(rd.desde)}</small><b>${rd.resgates}</b><small>${rd.premios ? `${rd.premios} ${rd.premios === 1 ? "prêmio" : "prêmios"} do dia ${rd.dias}` : "pela macro"}</small></span>`);
    tiles.push(`<span><small>Ganho em 7 dias</small><b>${C.naUnidade(rs.ganho7, un, { sinal: true })}</b><small>≈ ${brl(rs.ganho7)}</small></span>`,
      `<span><small>Ganho em 30 dias</small><b>${C.naUnidade(rs.ganho30, un, { sinal: true })}</b><small>≈ ${brl(rs.ganho30)}</small></span>`,
      `<span><small>Média por dia</small><b>${un === "sats" ? `${rs.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sats` : un === "brl" ? C.reais(rs.media) : C.dolares(rs.media)}</b><small>nos últimos 30 dias</small></span>`);
    const sub = rd ? `${rd.premios ? `${rd.informado.toLocaleString("pt-BR")} informados em ${dataCurta(rd.desde)} + ${(rd.premios * rd.premio).toLocaleString("pt-BR")} do dia ${rd.dias} · ` : `informado em ${dataCurta(rd.desde)} · `}≈ ${brl(rs.saldo)}`
      : un === "brl" ? (rs.ultima ? `lido em ${dataCurta(rs.ultima.dia)}` : "") : `≈ ${brl(rs.saldo)}${un === "sats" && rs.usdSite != null ? ` · ${C.dolares(rs.usdSite)} no site` : un === "usd" && Number.isFinite(rs.ultima?.sats) ? ` · ${C.naUnidade(rs.ultima.sats, "sats")} pelo bitcoin de ${dataCurta(rs.ultima.dia)}` : ""}`;
    s1.insertAdjacentHTML("beforeend", `<div class="fi-saldo"><strong>${rs.estimado ? "≈ " : ""}${C.naUnidade(rs.saldo, un)}</strong><span>${sub}</span></div>
      <div class="fi-tiles">${tiles.slice(0, 4).join("")}</div>
      ${rd ? `<p class="fi-dica">${icone("💡", "ico-inline")} Estimativa: a macro não lê o saldo do ${escapar(nome)}; cada resgate dela avança 1 dia num ciclo de ${rd.dias}, e o dia ${rd.dias} dá ${rd.premio} sats (os outros dão RP, pontos do app). Não conta prêmios de jogos. Atualize à mão quando abrir o app.</p>` : ""}`);
    botaoAMao(s1);
    const ser = rs.serie.filter(c => Number.isFinite(c[un]));
    if (ser.length >= 2) s1.append(graficoSaldo(ser.slice(-30), un, nome));
    else if (!rd) s1.insertAdjacentHTML("beforeend", `<p class="fi-dica">O gráfico do saldo aparece a partir da 2ª coleta.</p>`);
  }
  // a sequência: calendário com os dias perdidos e quanto cada quebra custou (Slice e ZBD; o custo, só no Slice)
  if (rs.sequencia != null) {
    const sq = C.sequenciaDaFonte(f, fonte, hoje, 35), comCusto = fonte === "slice";
    const s15 = secao(el, rotSeq, sq.quebras.length && comCusto ? `<small>as quebras custaram ≈ ${sq.custoTotal.toLocaleString("pt-BR")} pontos (${C.dolares(sq.custoTotal / 1000)})</small>` : "");
    const cal = document.createElement("div"); cal.className = "fi-cal";
    const pad = (new Date(sq.dias[0].dia + "T12:00:00").getDay() + 6) % 7; // semana começa na segunda
    cal.innerHTML = `${["S", "T", "Q", "Q", "S", "S", "D"].map(d => `<span class="cab">${d}</span>`).join("")}${"<span></span>".repeat(pad)}${sq.dias.map(d => `<span class="d ${d.st}" title="${diaLongo(d.dia)}">${+d.dia.slice(8)}</span>`).join("")}`;
    s15.append(cal);
    s15.insertAdjacentHTML("beforeend", `<div class="fi-cal-leg"><span><i class="ok"></i>coleta da macro</span><span><i class="perdido"></i>dia perdido${comCusto ? " (bônus zerado)" : ""}</span><span><i class="sem"></i>sem registro</span></div>
      ${sq.quebras.length ? sq.quebras.slice(0, 4).map(q => `<div class="fi-quebra">${ico("📉")}<span class="fi-lanc-tx"><b>${q.perdido ? `Perdeu ${diaLongo(q.dia)}` : `A sequência zerou em ${diaLongo(q.dia)}`}</b><small>estava em ${q.antes} ${q.antes === 1 ? "dia" : "dias"}${comCusto ? `: o bônus caiu de ≈ ${q.antes + 1} para 2 pontos/dia. Custo até ${dataCurta(q.ate)}: ≈ <b>${q.custo.toLocaleString("pt-BR")} pontos</b> (${C.dolares(q.custo / 1000)} ≈ ${C.reais(C.emReais(cot, q.custo / 1000, "usd"))}), e ${q.porDia} pontos a cada dia que passa` : ""}.</small></span></div>`).join("")
      : `<p class="fi-dica">${sq.dias.some(d => d.st === "ok") ? "Nenhum dia perdido no registro." : "O calendário enche com as coletas da macro."} A conta usa a sequência que a tela ${fonte === "slice" ? "do Slice mostra; o bônus é ≈ dia da sequência + 1 ponto (1.000 pontos = US$ 1)" : `do ${escapar(nome)} mostra`}.</p>`}`);
  }
  // saque: o mínimo (por fonte), a previsão e os saques que o saldo mostrou (não no Ping-Pong: o dinheiro já é dele)
  const mn = f.fontes?.[fonte]?.minimoSaque, minUn = rs.minUn;
  const s2 = fonte === "pingpong" ? document.createElement("div") : secao(el, "Saque");
  const pv = rs.previsao;
  const dicaMin = fonte === "slice" ? "em US$, como o site mostra (o Slice paga a partir de US$ 10)" : un === "brl" ? "em R$, como o app mostra (o Bump paga a partir de R$ 20)" : minUn === "brl" ? `em R$, para a taxa valer a pena${rs.minimo ? ` (hoje ≈ ${C.naUnidade(rs.minimo, "sats")})` : ""}` : minUn === "usd" ? "em US$, como o app mostra (confira no app quanto é)" : "em sats (confira no app quanto é)";
  const rotMin = { usd: "US$", brl: "R$" }[minUn] || "sats", comCentavos = minUn === "usd" || minUn === "brl";
  s2.insertAdjacentHTML("beforeend", `<label class="fi-lim"><span class="fi-lanc-tx"><b>Mínimo para sacar</b><small>${dicaMin}</small></span><span class="fi-lim-v"><span>${rotMin}</span><input ${comCentavos ? `data-teclado="dinheiro"` : `data-teclado="num" data-max="9"`} aria-label="Mínimo para sacar (${rotMin})" value="${comCentavos ? C.paraCampo(mn) : mn || ""}" placeholder="—"></span></label>
    ${pv ? `<p class="fi-previsao">${ico(pv.pronto ? "🎉" : "⏳")}<span>${pv.pronto ? (pv.peloSite ? "A macro viu que já dá para sacar!" : "Já dá para sacar!") : pv.porCiclo ? (pv.data ? `Faltam <b>${C.naUnidade(pv.falta, un)}</b>: ${pv.premios} ${pv.premios === 1 ? "prêmio" : "prêmios"} do dia ${rs.recompensa.dias}, por volta de <b>${dataCurta(pv.data)}</b> (estimativa: ciclo de ${rs.recompensa.dias} dias, sem prêmios de jogos).` : `Faltam <b>${C.naUnidade(pv.falta, un)}</b>. Informe o dia da recompensa diária para ver a previsão.`) : pv.dias ? `Faltam <b>${C.naUnidade(pv.falta, un)}</b>: no ritmo atual, uns <b>${pv.dias} ${pv.dias === 1 ? "dia" : "dias"}</b> (por volta de ${dataCurta(pv.data)}).` : `Faltam <b>${C.naUnidade(pv.falta, un)}</b>. A previsão aparece quando houver ganho nos últimos 30 dias.`}</span></p>`
      : mn && rs.temSaldo && rs.minimo == null ? `<p class="fi-dica">A previsão precisa de uma coleta com sats e US$ juntos.</p>` : ""}`);
  let tm = null;
  s2.querySelector("input").addEventListener("input", (ev) => { clearTimeout(tm); tm = setTimeout(() => { const v = comCentavos ? C.deCampo(ev.target.value) : parseInt(ev.target.value, 10); f.fontes[fonte] = { ...(f.fontes[fonte] || {}), minimoSaque: v > 0 ? v : null, minimoManual: true, em: new Date().toISOString() }; salvar(); }, 600); });
  for (const x of C.saques(f, fonte).slice(0, 6)) {
    const d = document.createElement("div"); d.className = `fi-saque ${x.lanc ? "ok" : x.ignorado ? "ign" : ""}`;
    d.innerHTML = `${ico("💸")}<span class="fi-lanc-tx"><b>Saque de ${C.naUnidade(x.saque, un)}</b><small>o saldo caiu em ${dataCurta(x.dia)}${x.lanc ? ` · lançado: ${C.reais(x.lanc.valor)} em ${dataCurta(x.lanc.data)}` : x.ignorado ? " · não era saque" : ` · ≈ ${brl(x.saque)} · ${fonte === "zbd" ? "foi para a Bipa?" : un === "brl" ? "caiu por Pix?" : "caiu no PayPal?"}`}</small></span>
      ${x.lanc || x.ignorado ? "" : `<button class="botao mini" data-a="lancar">Lançar</button><button class="fi-icone mini" data-a="ign" aria-label="Não foi saque">${I.pontos}</button>`}`;
    d.querySelector('[data-a="lancar"]')?.addEventListener("click", () => editarLancamento(null, { tipo: "entrada", valor: C.emReais(cot, x.saque, un), cat: "faucets", desc: `Saque do ${nome}`, forma: fonte === "zbd" ? "Outra" : un === "brl" ? "Pix" : "PayPal", data: hojeISO(), saque: { chave: x.chave, [un]: x.saque } }));
    d.querySelector('[data-a="ign"]')?.addEventListener("click", async () => {
      if (await modal({ titulo: "Não foi saque?", texto: `O saldo caiu, mas o dinheiro não saiu do ${nome} (ajuste, estorno…). Ele deixa de aparecer aqui.`, botoes: [{ texto: "Não foi saque", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] })) { f.ignorados[x.chave] = { em: new Date().toISOString() }; salvar(); desenhar(false); }
    });
    s2.append(d);
  }
  const bm = document.createElement("button"); bm.className = "fi-linha-link"; bm.innerHTML = `${ico("💸")}<span>Lançar um saque à mão</span>${I.mais}`;
  bm.onclick = () => editarLancamento(null, { tipo: "entrada", valor: 0, cat: "faucets", desc: `Saque do ${nome}`, forma: un === "brl" ? "Pix" : "PayPal", data: hojeISO() });
  s2.append(bm);
  // a macro
  if (info.semMacro) return;
  const s3 = secao(el, "Macro");
  s3.insertAdjacentHTML("beforeend", `<p class="fi-dica">As macros ficam no repositório, em <code>financas/macros/</code>; a conferência da madrugada (4h13) lê o registro e corrige o gerador quando algo falha.</p>`);
  const bc = document.createElement("button"); bc.className = "fi-linha-link"; bc.innerHTML = `${ico("🔗")}<span>Como mandar o registro do MacroDroid</span>${I.prox}`;
  bc.onclick = () => { sub = "conectar"; desenhar(); }; s3.append(bc);
}

/** As contas do EarnApp: cada aparelho com o saldo, a situação da macro e se já dá para sacar; e o total. */
function secaoContas(el, f, hoje, cot) {
  const et = C.earnappTotal(f, hoje, cot);
  const sc = secao(el, "Contas", et.total != null ? `<small>${et.n} ${et.n === 1 ? "conta" : "contas"} com saldo</small>` : "");
  const box = document.createElement("div"); box.className = "fi-contas";
  const ICO = { earnapp: "📱", earnappprincipal: "📱", earnapptablet: "📱", earnapppc: "💻" };
  for (const x of et.contas) {
    const b = document.createElement("button"); b.className = `fi-conta${x.pronto ? " pronta" : ""}`; b.dataset.conta = x.id;
    const st = x.sd ? ROT_SAUDE[x.sd.estado] : null;
    const linha = x.manual ? (x.ultima ? `à mão em ${dataCurta(x.ultima.dia)}` : "sem saldo: informe à mão") : `${st[1].toLowerCase()}${x.ultima ? ` · lido em ${dataCurta(x.ultima.dia)}` : ""}`;
    const saque = x.pronto ? "pronto para sacar" : x.falta != null && x.minimo ? `faltam ${C.dolares(x.falta)} para ${C.dolares(x.minimo)}` : "";
    b.innerHTML = `${ico(ICO[x.id] || "📱")}<span><b>${escapar(x.nome)}</b><small>${st ? `${icone(st[0], "ico-inline")} ` : ""}${escapar(linha)}</small></span><span class="fi-conta-v">${x.saldo != null ? C.dolares(x.saldo) : "—"}${saque ? `<small>${escapar(saque)}</small>` : ""}</span>`;
    b.onclick = () => { if (x.id === "earnapp") return; voltarPara = "earnapp"; sub = x.id; desenhar(); };
    box.append(b);
  }
  if (!C.contaLigada(f, "earnapppc")) {
    const b = document.createElement("button"); b.className = "fi-conta desligada"; b.dataset.conta = "earnapppc";
    b.innerHTML = `${ico("💻")}<span><b>PC</b><small>desligada · sem automação; ligue para somar o saldo à mão</small></span><span class="fi-conta-v">—</span>`;
    b.onclick = () => { voltarPara = "earnapp"; sub = "earnapppc"; desenhar(); };
    box.append(b);
  }
  sc.append(box);
  if (et.total != null) sc.insertAdjacentHTML("beforeend", `<div class="fi-contas-total"><span>Total no EarnApp${et.prontas ? ` · ${et.prontas} ${et.prontas === 1 ? "conta pronta" : "contas prontas"} para sacar` : ""}</span><b>${C.dolares(et.total)}</b></div><p class="fi-dica">≈ ${C.reais(C.emReais(cot, et.total, "usd"))}. O saque é por conta: cada uma tem o seu mínimo (na tela dela). Abaixo, os números da conta do celular secundário.</p>`);
}

/** Linha do saldo (SVG), com um toque mostrando o valor do dia. */
function graficoSaldo(serie, un, nome = "Slice", { zero = true } = {}) {
  const W = 340, H = 140, m = { e: 8, d: 8, c: 14, b: 22 };
  const vs = serie.map(c => c[un]), mx0 = Math.max(...vs), mn0 = Math.min(...vs);
  // sem o zero (o patrimônio): a escala aperta em volta dos valores, para a variação aparecer
  const folga = Math.max((mx0 - mn0) * 0.15, mx0 * 0.002, 0.01);
  const mx = zero ? mx0 : mx0 + folga, mn = zero ? Math.min(0, mn0) : Math.max(0, mn0 - folga), amp = mx - mn || 1;
  const x = (i) => m.e + (i * (W - m.e - m.d)) / Math.max(1, serie.length - 1), y = (v) => m.c + (1 - (v - mn) / amp) * (H - m.c - m.b);
  const pts = serie.map((c, i) => `${x(i).toFixed(1)},${y(c[un]).toFixed(1)}`);
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa";
  caixa.innerHTML = `<svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo do ${escapar(nome)} nas últimas ${serie.length} coletas">
    <line x1="${m.e}" x2="${W - m.d}" y1="${y(mn)}" y2="${y(mn)}" class="eixo"/>
    <path d="M${pts[0]} L${pts.join(" L")} L${x(serie.length - 1)},${y(mn)} L${x(0)},${y(mn)}Z" class="area"/>
    <polyline points="${pts.join(" ")}" class="linha"/>
    <circle cx="${x(serie.length - 1)}" cy="${y(serie.at(-1)[un])}" r="4.5" class="ponto"/>
    <text x="${m.e}" y="${H - 6}" class="rot">${dataCurta(serie[0].dia)}</text><text x="${W - m.d}" y="${H - 6}" class="rot" text-anchor="end">${dataCurta(serie.at(-1).dia)}</text>
    <circle class="cursor" r="5" cx="-20" cy="-20"/>
  </svg><p class="fi-graf-info">Toque no gráfico para ver cada dia · máximo ${C.naUnidade(mx0, un)}</p>`;
  const svg = caixa.querySelector("svg"), info = caixa.querySelector(".fi-graf-info"), cur = caixa.querySelector(".cursor");
  const mostrar = (ev) => {
    const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(serie.length - 1, Math.round(((px - m.e) / (W - m.e - m.d)) * (serie.length - 1))));
    cur.setAttribute("cx", x(i)); cur.setAttribute("cy", y(serie[i][un]));
    info.textContent = `${maiuscula(diaLongo(serie[i].dia))}: ${C.naUnidade(serie[i][un], un)}${un === "sats" && serie[i].usd != null ? ` (${C.dolares(serie[i].usd)})` : ""}${serie[i].sequencia != null ? ` · 🔥 ${serie[i].sequencia}` : ""}`;
  };
  svg.addEventListener("pointerdown", mostrar); svg.addEventListener("pointermove", (ev) => { if (ev.buttons || ev.pointerType !== "mouse") mostrar(ev); });
  return caixa;
}

// Conectar o MacroDroid: a issue, o token do celular secundário e o pedaço da macro, com botões de copiar
function telaConectar(el) {
  const f = F(), url = P.urlComentarios();
  cabSub(el, "Conectar o MacroDroid", "As macros do celular secundário avisam cada passo num comentário de uma issue do repositório; o Órbita lê e guarda.");
  // 1) a issue
  const s1 = secao(el, "1. A issue do registro");
  s1.insertAdjacentHTML("beforeend", f.ponte?.issue
    ? `<p class="fi-dica">${icone("✅", "ico-inline")} Issue <b>#${f.ponte.issue}</b> “${escapar(P.TITULO_ISSUE)}” em <code>${escapar(f.ponte.repo)}</code>.</p>`
    : `<p class="fi-dica">O app procura a issue “${escapar(P.TITULO_ISSUE)}” no repositório <code>${escapar(E().config.repo || "")}</code> e, se não houver, cria (com o token do app).</p>`);
  const b1 = document.createElement("div"); b1.className = "fi-bts";
  b1.innerHTML = `<button class="botao ${f.ponte?.issue ? "secundario" : ""}" data-a="conectar">${f.ponte?.issue ? "Procurar de novo" : "Procurar ou criar a issue"}</button><button class="botao secundario" data-a="numero">Usar outra issue (número)</button>`;
  b1.querySelector('[data-a="conectar"]').onclick = async (ev) => {
    ev.target.disabled = true; ev.target.textContent = "Conectando…";
    try { const p = await P.conectar(); toast(`Conectado à issue #${p.issue}`); await P.lerColetas({ forcar: true }); } catch (e) { modal({ titulo: "Não deu para conectar", texto: e.message }); }
    desenhar(false);
  };
  b1.querySelector('[data-a="numero"]').onclick = () => {
    const corpo = document.createElement("div"); corpo.className = "fi-form";
    corpo.innerHTML = `<label class="fi-campo"><small>Número da issue</small><input data-teclado="num" data-max="6" aria-label="Número da issue"></label><div class="fi-bts"><button class="botao" data-a="ok">Usar esta</button></div>`;
    const { fechar } = folha("Usar outra issue", corpo);
    tecl.configurar({ rotuloConcluir: "OK" });
    corpo.querySelector('[data-a="ok"]').onclick = async () => {
      const n = parseInt(corpo.querySelector("input").value, 10); if (!n) return;
      try { await P.conectar(n); fechar(); toast(`Conectado à issue #${n}`); await P.lerColetas({ forcar: true }); } catch (e) { toast(e.message, 4000); }
      desenhar(false);
    };
  };
  s1.append(b1);
  // 2) o token do celular secundário
  const s2 = secao(el, "2. Token só de issues para o celular secundário");
  s2.insertAdjacentHTML("beforeend", `<ol class="fi-passos">
    <li>No GitHub: <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>.</li>
    <li><b>Repository access</b>: “Only select repositories” → <code>${escapar(E().config.repo || "")}</code>.</li>
    <li><b>Permissions → Repository permissions → Issues: Read and write</b>. Nada mais (o GitHub põe “Metadata: Read” sozinho). Sem “Contents”: esse token não lê o código.</li>
    <li>Validade: escolha uma data (1 ano, por exemplo) e anote para trocar antes.</li>
    <li>Guarde o token só no MacroDroid do celular secundário, numa variável global (ex.: <code>gh_token</code>). Não use o token do Órbita lá.</li></ol>`);
  // 3) as macros: moram em financas/macros/ no repositório (outra pessoa as prepara; o LEIA-ME de lá diz como importar)
  const s3 = secao(el, "3. As macros");
  const leia = `https://github.com/${E().config.repo || "Alediov/odonto-quest"}/blob/main/financas/macros/LEIA-ME.md`;
  const campo = (rot, valor) => `<div class="fi-copia"><small>${rot}</small><div><code>${escapar(valor)}</code><button class="fi-icone mini" data-copiar="${encodeURIComponent(valor)}" aria-label="Copiar ${escapar(rot)}">${I.copiar}</button></div></div>`;
  s3.insertAdjacentHTML("beforeend", `<p class="fi-dica">As macros ficam no repositório, em <code>financas/macros/</code>, sem a de desbloqueio e sem senhas. O <b>LEIA-ME</b> de lá explica como importar no MacroDroid e onde pôr o token. Cada passo da macro vira um comentário na issue, e a tela do Slice mostra a saúde de cada execução.</p>
    ${campo("Endereço onde as macros comentam (POST)", url || "(conecte a issue no passo 1)")}
    <p class="fi-dica">Formato de cada comentário (uma linha): <code>orbita-financas fonte=slice|earnapp|earn_bitcoin|zbd|orquestrador;evento=inicio|tentativa|etapa|fim|erro;run=AAAA-MM-DD_HHMMSS;tentativa=N;etapa=…;sats=8734;usd=6.95;sequencia=5;tempo=15d 5h 24m;pronto=sim|nao;msg=…</code>. A leitura da tela inteira: <code>evento=tela;tela=…</code> no fim (o texto vai até o fim do comentário). Chaves desconhecidas ficam guardadas sem atrapalhar.</p>`);
  const b3 = document.createElement("div"); b3.className = "fi-bts";
  b3.innerHTML = `<a class="botao secundario" href="${escapar(leia)}" target="_blank" rel="noopener">Abrir o LEIA-ME das macros</a>`;
  s3.append(b3);
  s3.querySelectorAll("[data-copiar]").forEach(b => (b.onclick = () => copiar(decodeURIComponent(b.dataset.copiar))));
  // 4) testar
  const s4 = secao(el, "4. Testar");
  s4.insertAdjacentHTML("beforeend", `<p class="fi-dica">Rode a macro uma vez (ou mande um comentário à mão na issue com <code>orbita-financas fonte=slice;sats=100;usd=0.08;sequencia=1</code>) e toque em Ler agora.</p>
    ${f.lidoEm ? `<p class="fi-dica">Última leitura: ${quandoFoi(f.lidoEm)}.</p>` : ""}
    ${f.erroLeitura && f.erroLeitura.em > (f.lidoEm || "") ? `<p class="fi-dica">${icone("⚠️", "ico-inline")} Erro na última leitura (${quandoFoi(f.erroLeitura.em)}): ${escapar(f.erroLeitura.msg)}</p>` : ""}
    ${f.ultimoProblema ? `<p class="fi-dica">${icone("⚠️", "ico-inline")} Último registro com problema: ${escapar(f.ultimoProblema.motivo)}</p>` : ""}`);
  const b4 = document.createElement("div"); b4.className = "fi-bts";
  b4.innerHTML = `<button class="botao" ${f.ponte?.issue ? "" : "disabled"} data-a="ler">Ler agora</button>${f.ponte?.url ? `<a class="botao secundario" href="${escapar(f.ponte.url)}" target="_blank" rel="noopener">Abrir a issue</a>` : ""}`;
  b4.querySelector('[data-a="ler"]').onclick = async () => { await lerAgora(true); desenhar(false); };
  s4.append(b4);
  opcoes(secao(el, "Opções"));
}
function opcoes(s) {
  const f = F(), a = f.ajustes;
  const troca = (k, txt, dica) => `<label class="fi-troca"><input type="checkbox" data-k="${k}" ${a[k] ? "checked" : ""}><span>${txt}<small>${dica}</small></span></label>`;
  s.insertAdjacentHTML("beforeend", `${troca("apagarImportados", "Apagar os comentários já importados", "Para a issue não crescer. O registro fica guardado no app.")}
    ${troca("avisoSemColeta", "Avisar às 9h se a macro não terminou", "Só quando o app soube que a execução do dia falhou ou não chegou.")}
    <label class="fi-lim"><span class="fi-lanc-tx"><b>Cotação do dólar à mão</b><small>vazio = a do dia (AwesomeAPI)</small></span><span class="fi-lim-v"><span>R$</span><input data-teclado="dinheiro" aria-label="Cotação do dólar" value="${a.cotacaoManual ? C.paraCampo(a.cotacaoManual) : ""}" placeholder="auto"></span></label>`);
  s.querySelectorAll(".fi-troca input").forEach(i => (i.onchange = () => { f.ajustes = { ...f.ajustes, [i.dataset.k]: i.checked, em: new Date().toISOString() }; salvar(); import("../notificacoes.js").then(N => N.reagendar()).catch(() => {}); }));
  let t = null;
  s.querySelector('[aria-label="Cotação do dólar"]').addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { const v = C.deCampo(e.target.value); f.ajustes = { ...f.ajustes, cotacaoManual: v > 1 ? v : null, em: new Date().toISOString() }; salvar(); }, 600); });
}
function folhaAjustes() {
  const corpo = document.createElement("div"); corpo.className = "fi-form";
  opcoes(corpo);
  const b = document.createElement("div"); b.className = "fi-bts";
  b.innerHTML = `<button class="botao secundario" data-a="conectar">Conectar o MacroDroid</button>`;
  corpo.append(b);
  const { fechar } = folha("Ajustes das Finanças", corpo);
  tecl.configurar({ rotuloConcluir: "OK" });
  b.querySelector("button").onclick = () => { fechar(); aba = "auto"; sub = "conectar"; desenhar(); };
}

// ---------------------------------------------------------------- gráficos dos meses (aba Gastos)
function graficoBarras(h) {
  const W = 340, H = 170, m = { e: 6, d: 6, c: 18, b: 22 }, mx = Math.max(1, ...h.flatMap(x => [x.entradas, x.saidas]));
  const gw = (W - m.e - m.d) / h.length, bw = Math.min(16, gw / 3), y = (v) => m.c + (1 - v / mx) * (H - m.c - m.b), base = H - m.b;
  const barra = (x0, v, cls) => v > 0 ? `<path class="${cls}" d="M${x0},${base} V${y(v) + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${base} Z"/>` : "";
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa";
  caixa.innerHTML = `<div class="fi-legenda"><span><i class="ent"></i>Entradas</span><span><i class="sai"></i>Saídas</span></div>
    <svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas por mês">
    <line x1="${m.e}" x2="${W - m.d}" y1="${base}" y2="${base}" class="eixo"/>
    ${h.map((x, i) => { const cx = m.e + gw * i + gw / 2; return `<g class="grupo ${x.atual ? "atual" : ""}" data-i="${i}"><rect class="alvo" x="${m.e + gw * i}" y="0" width="${gw}" height="${H}"/>${barra(cx - bw - 1, x.entradas, "ent")}${barra(cx + 1, x.saidas, "sai")}<text x="${cx}" y="${H - 6}" class="rot" text-anchor="middle">${C.nomeMes(x.mes, { ano: false, curto: true })}</text></g>`; }).join("")}
  </svg><p class="fi-graf-info">Toque num mês para ver os valores</p>`;
  const info = caixa.querySelector(".fi-graf-info");
  caixa.querySelectorAll(".grupo").forEach(g => g.addEventListener("pointerdown", () => {
    const x = h[+g.dataset.i];
    caixa.querySelectorAll(".grupo").forEach(o => o.classList.toggle("sel", o === g));
    info.innerHTML = `<b>${maiuscula(C.nomeMes(x.mes))}</b>: entradas ${C.reais(x.entradas)} · saídas ${C.reais(x.saidas)} · saldo ${C.reais(x.saldo)}`;
  }));
  return caixa;
}
function graficoPilhas(h, cats, outras) {
  const W = 340, H = 170, m = { e: 6, d: 6, c: 10, b: 22 }, mx = Math.max(1, ...h.map(x => x.saidas));
  const gw = (W - m.e - m.d) / h.length, bw = Math.min(26, gw * 0.55), base = H - m.b, esc = (v) => (v / mx) * (H - m.c - m.b);
  const series = [...cats.map(c => ({ id: c.id, nome: c.nome, cor: c.cor })), ...(outras ? [{ id: "_outras", nome: "Sem categoria", cor: 8 }] : [])];
  const valor = (x, s) => s.id === "_outras" ? Object.entries(x.porCat).filter(([k]) => !cats.find(c => c.id === k)).reduce((t, [, v]) => t + v, 0) : x.porCat[s.id] || 0;
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa";
  caixa.innerHTML = `<div class="fi-legenda">${series.map(s => `<span><i class="c${s.cor}"></i>${escapar(s.nome)}</span>`).join("")}</div>
    <svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gastos por categoria em cada mês">
    <line x1="${m.e}" x2="${W - m.d}" y1="${base}" y2="${base}" class="eixo"/>
    ${h.map((x, i) => {
      const cx = m.e + gw * i + gw / 2; let topo = base; const partes = [];
      series.forEach(s => { const v = valor(x, s); if (!v) return; const alt = esc(v); partes.push(`<rect class="seg c${s.cor}" x="${cx - bw / 2}" y="${topo - alt}" width="${bw}" height="${Math.max(0, alt - 2)}" rx="3"/>`); topo -= alt; });
      return `<g class="grupo ${x.atual ? "atual" : ""}" data-i="${i}"><rect class="alvo" x="${m.e + gw * i}" y="0" width="${gw}" height="${H}"/>${partes.join("")}<text x="${cx}" y="${H - 6}" class="rot" text-anchor="middle">${C.nomeMes(x.mes, { ano: false, curto: true })}</text></g>`;
    }).join("")}
  </svg><p class="fi-graf-info">Toque num mês para ver cada categoria</p>`;
  const info = caixa.querySelector(".fi-graf-info");
  caixa.querySelectorAll(".grupo").forEach(g => g.addEventListener("pointerdown", () => {
    const x = h[+g.dataset.i];
    caixa.querySelectorAll(".grupo").forEach(o => o.classList.toggle("sel", o === g));
    const ps = series.map(s => [s.nome, valor(x, s)]).filter(([, v]) => v);
    info.innerHTML = `<b>${maiuscula(C.nomeMes(x.mes))}</b>: ${ps.length ? ps.map(([n, v]) => `${escapar(n)} ${C.reais(v)}`).join(" · ") : "sem gastos"}`;
  }));
  return caixa;
}

// ---------------------------------------------------------------- para a Home, o Meu dia e os testes
/** Abre a tela do Slice (ou outra aba) depois de abrir a área: usado pelo teste de fumaça e por atalhos. */
export function irPara(o = {}) { if (o.aba) aba = ABA_ANTIGA[o.aba] || o.aba; sub = o.sub ?? (o.aba === "orcamento" ? "orcamento" : null); voltarPara = null; if (o.mes) mes = o.mes; if (raiz?.isConnected) desenhar(); }
