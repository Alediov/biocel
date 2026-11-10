// A conversa com a Eva (pedido do Alediov, 04/11/2026; docs/plano-eva.md), dentro de Mensagens (telaMensagens.js cuida
// da camada, da lista de conversas e do voltar). No alto, a seta para a lista, ela (animada, `.vivo`; tocar no rosto
// abre o perfil, perfilEva.js), o nome, o humor e a semana em pontinhos; as mensagens (as dela com o rosto do humor da
// mensagem e os botões de ação; o rostinho também abre o perfil); "pensando" enquanto a API responde; as respostas
// rápidas em chips; e a caixa de texto com o teclado do celular (emojis, ditado).
// A pergunta do humor (`tipo: "humor"`, eva.js): a bolha leva o quadro de humorDia/quadro.js; o quadro de cada pergunta
// fica guardado em `quadros` e volta para o lugar a cada desenho (sem perder a escolha pela metade); depois de
// respondida, a bolha mostra só a pergunta e, como uma mensagem dele, o emoji escolhido (do registro em E().humorDia).
// Ajustes numa folha: "Responder com a IA" (desligado por padrão; ligado, aparecem a chave da API, o modelo, o teto, o
// gasto do mês e "Variar o texto com a IA"), as mensagens programadas, a música do dia, os "Meus meses" e apagar a
// conversa.
// "digitando…" (pedido do Alediov, 05/11/2026): as mensagens dela que chegam com a conversa aberta (as respostas
// prontas, as programadas, os cartões) esperam numa fila (`fila`) e aparecem uma a uma depois dos pontinhos, pelo
// tempo de atrasoDigitando (falas.js); as da IA já esperaram a resposta ("pensando") e entram direto. Teste:
// `window.__evaSemEspera = true` tira a espera.
// Cartões: a música do dia (`tipo: "musica"`: capa, título, artista, Tocar e Outra), o resumo do mês (`tipo: "mes"`:
// a imagem, Ver, Compartilhar e Salvar) e a retrospectiva (`tipo: "retro"`: Assistir).
// Recados do Claude (`tipo: "recados"`, recados.js, 09/11/2026): o checklist na bolha (tarefa: "Feito"; dúvida: a
// resposta vai pelo chat com o Claude, aqui só "Respondi"), "Abrir" quando o recado leva a uma área, e a folha
// "Recados" (abertos e feitos) pelo chip "Recados (N)" e pelos ajustes.
import * as EV from "./eva.js";
import * as API from "./api.js";
import * as IL from "./telaIaLocal.js";
import * as P from "./programadas.js";
import { NIVEIS } from "./humor.js";
import { eva } from "../arte/eva.js";
import * as HD from "../humorDia/humorDia.js";
import { htmlQuadro, ligarQuadro, emojiHTML } from "../humorDia/quadro.js";
import { atrasoDigitando } from "./falas.js";
import * as RE from "./recados.js";

let raiz = null, opts = {}, pensando = false, verTodas = false, rostoAtual = "", desligar = [], vistas = new Set(), quadros = new Map();
let fila = [], timerDig = 0, prontas = new Set(); // as mensagens dela esperando o "digitando…" e as que já passaram por ele
const capas = new Map(), imagensMes = new Map(); // capas das músicas e imagens dos meses já prontas (só na memória)
const semEspera = () => !!window.__evaSemEspera;
const reduzir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Quanto ela "digita" a mensagem `m` (as programadas e os cartões, mais curto). */
function atrasoDe(m) {
  const ms = atrasoDigitando(m.texto, { reduzir: reduzir() });
  return m.prog ? Math.min(1500, ms) : m.tipo === "musica" || m.tipo === "mes" ? Math.min(2600, ms + 300) : ms;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s) => raiz?.querySelector(s);
const MOSTRAR = 80;
const IC = {
  engr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  enviar: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a.9.9 0 0 0-1.3 1l1.8 6.6 9.6.8-9.6.8-1.8 6.6a.9.9 0 0 0 1.3 1z"/></svg>`,
  fechar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  voltar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
};
const hm = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
function rotuloDia(iso) {
  const d = new Date(iso), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
  const igual = (a, b) => a.toDateString() === b.toDateString();
  return igual(d, hoje) ? "Hoje" : igual(d, ontem) ? "Ontem" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
const rosto = (humor, classe = "") => eva({ humor, capuz: false, semFundo: false, classe });

/** Abre a conversa com a Eva em `el` (a vista dentro da camada de Mensagens). o: { aoTrocarArea, logo, irParaItem,
 *  voltar (a seta para a lista de conversas; sem ela, o logo leva à Home), perfil(origem) (abre o perfil dela) }. */
export async function abrirTelaEva(el, o = {}) {
  desligar.forEach(f => { try { f(); } catch { /* nada */ } }); desligar = [];
  clearTimeout(timerDig); timerDig = 0; fila = []; prontas = new Set();
  raiz = el; opts = o; raiz.classList.add("eva-raiz"); vistas = new Set(); quadros = new Map(); rostoAtual = ""; pensando = false;
  EV.comecar();
  raiz.innerHTML = `<header class="eva-topo">
      ${o.voltar ? `<button class="eva-ic eva-voltar" type="button" aria-label="Voltar para as conversas">${IC.voltar}</button>` : `<button class="eva-area" type="button" aria-label="Trocar de área">${o.logo || ""}</button>`}
      <div class="eva-quem" role="button" tabindex="0" aria-label="Ver o perfil da Eva"><span class="eva-rosto vivo" aria-hidden="true"></span><span class="eva-nome"><b>Eva</b><small class="eva-estado"></small></span></div>
      <button class="eva-humor" type="button" aria-label="Humor da Eva"><span class="eva-semana"></span></button>
      <button class="eva-ic eva-abrir-ajustes" type="button" aria-label="Ajustes da Eva">${IC.engr}</button>
    </header>
    <main class="eva-chat" aria-live="polite"></main>
    <div class="eva-aviso" hidden></div>
    <div class="eva-chips" role="group" aria-label="Respostas rápidas"></div>
    <form class="eva-entrada" autocomplete="off"><textarea rows="1" placeholder="Mensagem" aria-label="Mensagem para a Eva" enterkeyhint="send"></textarea><button class="eva-enviar" type="submit" aria-label="Enviar">${IC.enviar}</button></form>`;
  if (o.voltar) $(".eva-voltar").onclick = () => o.voltar(); else $(".eva-area").onclick = () => opts.aoTrocarArea?.();
  const quem = $(".eva-quem");
  quem.onclick = () => opts.perfil?.($(".eva-rosto"));
  quem.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); opts.perfil?.($(".eva-rosto")); } };
  // os rostinhos das mensagens também abrem o perfil (o zoom sai do rostinho tocado)
  $(".eva-chat").addEventListener("click", (ev) => { const av = ev.target.closest?.(".eva-av"); if (av?.querySelector("svg")) opts.perfil?.(av); });
  $(".eva-chat").addEventListener("click", aoTocarCartao);
  $(".eva-abrir-ajustes").onclick = () => abrirAjustes();
  $(".eva-humor").onclick = () => mostrarSemana();
  const ta = $(".eva-entrada textarea");
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`; });
  ta.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey && matchMedia("(pointer: fine)").matches) { ev.preventDefault(); enviar(); } });
  $(".eva-entrada").onsubmit = (ev) => { ev.preventDefault(); enviar(); };
  const aoMudar = () => { if (raiz?.isConnected) desenhar(); };
  window.addEventListener("oq-eva", aoMudar); desligar.push(() => window.removeEventListener("oq-eva", aoMudar));
  window.addEventListener("oq-humor", aoMudar); desligar.push(() => window.removeEventListener("oq-humor", aoMudar));
  desenhar(true);
  await EV.atualizarDia(true).catch(() => {});
  await P.entregarVencidas().catch(() => {});
  if (raiz?.isConnected) desenhar(true);
  EV.aoMudarDia({ forcar: true });
}
/** Ao sair da conversa (de volta à lista) ou da área (telaMensagens.js). Com `el`, só se ela ainda é a aberta. */
export function sairDaEva(el) {
  if (el && raiz && raiz !== el) return;
  desligar.forEach(f => { try { f(); } catch { /* nada */ } }); desligar = []; raiz = null; quadros = new Map();
  clearTimeout(timerDig); timerDig = 0; fila = [];
}

// ---------------------------------------------------------------- desenho
/** As mensagens novas dela entram na fila do "digitando…" (não na 1ª vez, nem as da IA, nem as antigas). */
function enfileirar(msgs) {
  if (!vistas.size || semEspera()) return;
  const agora = Date.now();
  for (const m of msgs) if (m.de === "eva" && !vistas.has(m.id) && !prontas.has(m.id) && !fila.includes(m.id) && !m.ia && agora - Date.parse(m.em) < 10 * 60000) fila.push(m.id);
  if (fila.length) rolarDigitacao();
}
function rolarDigitacao() {
  if (timerDig || !fila.length) return;
  const m = EV.EV().msgs[fila[0]];
  if (!m || semEspera()) { prontas.add(fila.shift()); rolarDigitacao(); return; }
  timerDig = setTimeout(() => { timerDig = 0; prontas.add(fila.shift()); if (raiz?.isConnected) desenhar(true); rolarDigitacao(); }, atrasoDe(m));
}
const digitando = () => pensando || fila.length > 0;
function desenhar(rolarFim = false) {
  if (!raiz?.isConnected) return;
  const hum = EV.humorAtual(), todas = EV.mensagens();
  enfileirar(todas);
  const ocultas = new Set(fila), msgs = todas.filter(m => !ocultas.has(m.id));
  // o rosto do alto: o da última mensagem dela, se recente; senão o do humor
  const ult = msgs.filter(m => m.de === "eva").at(-1);
  const r = pensando ? "pensativa" : fila.length ? "falando" : ult && Date.now() - Date.parse(ult.em) < 3 * 60000 && ult.humor ? ult.humor : hum.rosto;
  trocarRosto(r);
  $(".eva-estado").textContent = digitando() ? "digitando…" : hum.nome;
  $(".eva-semana").innerHTML = hum.semana.map((d, i) => `<i class="${i === 6 ? "eva-hoje" : ""}" style="--c:${d.nivel == null ? "var(--linha)" : NIVEIS[d.nivel].cor}"></i>`).join("");
  $(".eva-humor").setAttribute("aria-label", `Humor da Eva: ${hum.nome}`);
  // as mensagens
  const chat = $(".eva-chat"), perto = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 120;
  const corte = verTodas ? msgs : msgs.slice(-MOSTRAR);
  // as respostas do humor viram uma "mensagem dele" (só na tela; o registro mora em E().humorDia), na hora em que ele escolheu
  const lista = [...corte];
  for (const m of corte) {
    if (m.tipo !== "humor") continue;
    const reg = HD.respostaDe(m.id);
    if (reg) lista.push({ id: `${m.id}-eu`, de: "eu", sint: reg, em: new Date(Math.max(reg.ms, Date.parse(m.em) + 1)).toISOString() });
  }
  lista.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
  const hoje = new Date().toDateString();
  let html = msgs.length > lista.length ? `<button class="eva-antes" type="button">Mostrar as anteriores</button>` : "", dia = "";
  // só as mensagens que ainda não estavam na tela entram com animação (a 1ª vez, nenhuma)
  const primeira = !vistas.size, nova = (m) => (!primeira && !vistas.has(m.id) ? " eva-nova" : "");
  const marcar = () => lista.forEach(m => vistas.add(m.id));
  lista.forEach((m, i) => {
    const d = rotuloDia(m.em);
    if (d !== dia) { dia = d; html += `<div class="eva-dia"><span>${esc(d)}</span></div>`; }
    const prox = lista[i + 1], ultimaDoGrupo = !prox || prox.de !== m.de || rotuloDia(prox.em) !== d;
    if (m.sint) { const h = HD.humor(m.sint.h); html += `<div class="eva-msg eva-minha eva-hd-resp${ultimaDoGrupo ? " eva-fim" : ""}${nova(m)}"><div class="eva-bolha"><p class="eva-hd-escolha">${emojiHTML(m.sint.h, "eva-hd-ico")}<span><b>${esc(h?.nome || "")}</b>${m.sint.et?.length ? `<small>${m.sint.et.map(esc).join(", ")}</small>` : ""}</span></p>${m.sint.tx ? `<p class="eva-hd-tx">${esc(m.sint.tx)}</p>` : ""}<time>${hm(m.em)}</time></div></div>`; return; }
    if (m.de === "eu") { html += `<div class="eva-msg eva-minha${ultimaDoGrupo ? " eva-fim" : ""}${nova(m)}"><div class="eva-bolha"><p>${esc(m.texto)}</p><time>${hm(m.em)}</time></div></div>`; return; }
    if (m.tipo === "humor") {
      const aberta = !HD.respostaDe(m.id) && new Date(m.em).toDateString() === hoje;
      html += `<div class="eva-msg eva-dela eva-humor-msg${ultimaDoGrupo ? " eva-fim" : ""}${nova(m)}" data-humor="normal" data-m="${esc(m.id)}">
        <span class="eva-av">${ultimaDoGrupo ? rosto(m.humor || "normal") : ""}</span>
        <div class="eva-bolha${m.prog ? " eva-prog" : ""}${aberta ? " eva-bolha-humor" : ""}">${aberta ? `<div class="eva-hq" data-m="${esc(m.id)}"></div>` : `<p>${esc(m.texto)}</p>`}<time>${hm(m.em)}</time>${!aberta && !HD.respostaDe(m.id) ? `<small class="eva-obs">sem resposta</small>` : ""}</div></div>`;
      return;
    }
    const acoes = (m.acoes || []).map((a, k) => `<button type="button" class="eva-acao" data-m="${esc(m.id)}" data-k="${k}">${esc(a.rotulo)}</button>`).join("");
    html += `<div class="eva-msg eva-dela${ultimaDoGrupo ? " eva-fim" : ""}${nova(m)}${m.tipo ? ` eva-tipo-${esc(m.tipo)}` : ""}" data-humor="${esc(m.humor || "normal")}" data-m="${esc(m.id)}">
      <span class="eva-av">${ultimaDoGrupo ? rosto(m.humor || "normal") : ""}</span>
      <div class="eva-bolha${m.prog ? " eva-prog" : ""}"><p>${esc(m.texto)}</p>${cartao(m)}${acoes ? `<div class="eva-acoes">${acoes}</div>` : ""}<time>${hm(m.em)}</time>${m.aviso ? `<small class="eva-obs">${esc(m.aviso)}</small>` : ""}</div></div>`;
  });
  if (digitando()) html += `<div class="eva-msg eva-dela eva-fim eva-nova eva-digitando"><span class="eva-av">${rosto(pensando ? "pensativa" : "falando")}</span><div class="eva-bolha"><span class="eva-pontos" aria-label="Eva está digitando"><i></i><i></i><i></i></span></div></div>`;
  chat.innerHTML = html;
  marcar();
  ligarQuadros(chat);
  encherCartoes(chat);
  chat.querySelector(".eva-antes")?.addEventListener("click", () => { verTodas = true; desenhar(); });
  chat.querySelectorAll(".eva-acao").forEach(b => (b.onclick = async () => {
    const m = EV.EV().msgs[b.dataset.m], a = m?.acoes?.[+b.dataset.k]; if (!a) return;
    b.disabled = true;
    const res = await EV.fazerAcao(a, { ir: irPara });
    if (res) desenhar(true);
  }));
  if (rolarFim || perto) chat.scrollTop = chat.scrollHeight;
  desenharChips();
  avisoApi();
}
// ---------------------------------------------------------------- cartões (música do dia, mês, retrospectiva)
const NOTA = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17.5a3 3 0 1 1-2-2.83V5.6a1 1 0 0 1 .76-.97l10-2.5A1 1 0 0 1 19 3.1v11.4a3 3 0 1 1-2-2.83V7.28l-8 2v8.22z"/></svg>`;
const TOCAR = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`;
function cartao(m) {
  if (m.tipo === "musica" && m.musica) {
    const mu = m.musica, c = capas.get(mu.id);
    return `<div class="eva-mus" data-id="${esc(mu.id)}">
        <span class="eva-mus-capa"${c ? ` style="background-image:url('${c}')"` : ""}>${c ? "" : NOTA}</span>
        <span class="eva-mus-tx"><b>${esc(mu.titulo)}</b><small>${esc(mu.artista)}</small></span>
        <button type="button" class="eva-mus-tocar" data-id="${esc(mu.id)}" aria-label="Tocar ${esc(mu.titulo)}">${TOCAR}</button>
      </div>
      <div class="eva-acoes"><button type="button" class="eva-acao eva-mus-tocar2" data-id="${esc(mu.id)}">Tocar</button>${EV.podeTrocarMusica(m) ? `<button type="button" class="eva-acao eva-mus-outra">Outra</button>` : ""}</div>`;
  }
  if (m.tipo === "mes" && m.mes) {
    const u = imagensMes.get(m.mes);
    return `<button type="button" class="eva-mes-img" data-mes="${esc(m.mes)}" aria-label="Ver o resumo do mês">${u ? `<img src="${u.url}" alt="Resumo do mês">` : `<span class="eva-mes-espera"></span>`}</button>
      <div class="eva-acoes"><button type="button" class="eva-acao eva-mes-ver" data-mes="${esc(m.mes)}">Ver</button><button type="button" class="eva-acao eva-mes-comp" data-mes="${esc(m.mes)}">Compartilhar</button><button type="button" class="eva-acao eva-mes-salvar" data-mes="${esc(m.mes)}">Salvar</button></div>`;
  }
  if (m.tipo === "recados" && Array.isArray(m.recados)) return checklist(m.recados.map(id => ({ id, ...(RE.RC()[id] || {}) })).filter(r => r.titulo));
  if (m.tipo === "retro" && m.retro) return `<div class="eva-acoes"><button type="button" class="eva-acao eva-forte-acao eva-rt-abrir" data-m="${esc(m.id)}">${TOCAR}Assistir</button></div>`;
  return "";
}
// ---------------------------------------------------------------- recados do Claude (recados.js)
const CERTO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
function checklist(itens) {
  if (!itens.length) return `<p class="eva-rec-vazio">Nenhum recado aqui.</p>`;
  return `<ul class="eva-rec">${itens.map(r => {
    const duv = r.tipo === "duvida", ok = !!(r.feito || r.fechado);
    const rot = duv ? (r.feito ? "Respondida" : "Respondi") : (r.feito ? "Feito" : "Marcar feito");
    return `<li class="eva-rec-it${ok ? " eva-rec-ok" : ""}${duv ? " eva-rec-duv" : ""}" data-rec="${esc(r.id)}">
      <button type="button" class="eva-rec-caixa" role="checkbox" aria-checked="${ok}" data-rec="${esc(r.id)}" ${r.fechado ? "disabled" : ""} aria-label="${esc(`${rot}: ${r.titulo}`)}">${ok ? CERTO : ""}</button>
      <div class="eva-rec-tx"><b>${esc(r.titulo)}</b>${r.texto ? `<p>${esc(r.texto)}</p>` : ""}
        ${duv && !ok ? `<p class="eva-rec-nota">Responda no chat com o Claude, não por aqui. Depois marque “Respondi”.</p>` : ""}
        <small>${esc(r.de || "Claude")}${duv ? " · dúvida" : ""}${r.ate ? ` · até ${br(r.ate)}` : ""}${r.fechado ? " · fechado pelo Claude" : r.feito ? ` · ${duv ? "respondida" : "feito"}` : ""}</small>
        ${r.link?.area && !ok ? `<button type="button" class="eva-acao eva-rec-ir" data-rec="${esc(r.id)}">Abrir</button>` : ""}</div></li>`;
  }).join("")}</ul>`;
}
/** Os toques no checklist (na bolha ou na folha). → true se tratou */
function tocarRecado(b) {
  if (b.matches(".eva-rec-caixa")) { const r = RE.RC()[b.dataset.rec]; if (r && !r.fechado) RE.marcar(b.dataset.rec, !r.feito); return true; }
  if (b.matches(".eva-rec-ir")) { const r = RE.RC()[b.dataset.rec]; if (r?.link) irPara(r.link); return true; }
  return false;
}
/** A lista dos recados: abertos e feitos. */
function abrirRecados(aba = "abertos") {
  const desenharFolha = (el) => {
    const a = RE.abertos(), f = RE.feitos();
    el.querySelector(".eva-rec-abas").innerHTML = [["abertos", `Abertos (${a.length})`], ["feitos", `Feitos (${f.length})`]].map(([k, t]) => `<button type="button" data-aba="${k}" class="${aba === k ? "eva-on" : ""}">${t}</button>`).join("");
    el.querySelector(".eva-rec-lista").innerHTML = checklist(aba === "abertos" ? a : f);
  };
  folha(`<h2>Recados do Claude</h2><div class="eva-seg eva-rec-abas"></div><div class="eva-rec-lista"></div>`, (el) => {
    desenharFolha(el);
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest?.("button"); if (!b) return;
      if (b.dataset.aba) { aba = b.dataset.aba; desenharFolha(el); return; }
      if (b.matches(".eva-rec-ir")) { el.closest(".eva-folha-fundo")?.remove(); }
      if (tocarRecado(b)) { if (el.isConnected) desenharFolha(el); desenhar(); }
    });
  });
}

/** Busca as capas e as imagens dos meses que ainda não estão prontas (sem redesenhar a conversa toda). */
function encherCartoes(chat) {
  chat.querySelectorAll(".eva-mus").forEach(async (el) => {
    const id = el.dataset.id; if (capas.has(id)) return;
    capas.set(id, "");
    const MD = await import("./musicaDia.js"), u = await MD.capa(id);
    capas.set(id, u);
    if (!u) return;
    raiz?.querySelectorAll(`.eva-mus[data-id="${CSS.escape(id)}"] .eva-mus-capa`).forEach(c => { c.style.backgroundImage = `url('${u}')`; c.innerHTML = ""; });
  });
  chat.querySelectorAll(".eva-mes-img").forEach(async (el) => {
    const mes = el.dataset.mes; if (imagensMes.has(mes)) return;
    const u = await urlDoMes(mes);
    if (!u) return;
    raiz?.querySelectorAll(`.eva-mes-img[data-mes="${mes}"]`).forEach(b => (b.innerHTML = `<img src="${u.url}" alt="Resumo do mês">`));
  });
}
const fazendoMes = new Map();
function urlDoMes(mes) {
  if (imagensMes.has(mes)) return Promise.resolve(imagensMes.get(mes));
  if (fazendoMes.has(mes)) return fazendoMes.get(mes);
  const r = EV.EV().meses?.[mes]; if (!r) return Promise.resolve(null);
  const p = import("./resumoMes.js").then(RM => RM.urlDoMes(r)).catch(e => { console.warn("Eva: imagem do mês", e); return null; })
    .then(u => { fazendoMes.delete(mes); if (u) imagensMes.set(mes, u); return u; });
  fazendoMes.set(mes, p);
  return p;
}
let tocandoAviso = 0;
async function aoTocarCartao(ev) {
  const b = ev.target.closest?.("button"); if (!b || !raiz) return;
  if (tocarRecado(b)) { desenhar(); return; }
  if (b.matches(".eva-mus-tocar, .eva-mus-tocar2")) {
    const MD = await import("./musicaDia.js");
    b.disabled = true;
    const r = await MD.tocar(b.dataset.id);
    b.disabled = false;
    if (r === "tocando") { b.closest(".eva-bolha")?.classList.add("eva-tocando"); clearTimeout(tocandoAviso); tocandoAviso = setTimeout(() => raiz?.querySelectorAll(".eva-tocando").forEach(x => x.classList.remove("eva-tocando")), 6000); }
    else if (r === "abrir") irPara({ area: "musicas" });
    else b.textContent = "Não achei a música";
    return;
  }
  if (b.matches(".eva-mus-outra")) { b.disabled = true; await EV.outraMusica(); desenhar(true); return; }
  if (b.matches(".eva-mes-img, .eva-mes-ver")) { verMes(b.dataset.mes); return; }
  if (b.matches(".eva-mes-comp, .eva-mes-salvar")) {
    const u = await urlDoMes(b.dataset.mes); if (!u) return;
    const nome = `orbita-${b.dataset.mes}.png`;
    if (b.matches(".eva-mes-comp")) { const R = await import("../musicas/retroImagem.js"); await R.compartilharImagem(u.blob, nome); }
    else { const RM = await import("./resumoMes.js"); const res = await RM.salvarImagem(u.blob, nome); b.textContent = res === "salvo" ? "Salva em Documentos" : res === "baixado" ? "Baixada" : "Salvar"; }
    return;
  }
  if (b.matches(".eva-rt-abrir")) { const m = EV.EV().msgs[b.dataset.m]; if (m?.retro) abrirRetrospectiva(m.retro); }
}
/** A imagem do mês em tela cheia, com Compartilhar e Salvar. */
async function verMes(mes) {
  const RM = await import("./resumoMes.js"), u = await urlDoMes(mes); if (!u || !raiz) return;
  raiz.querySelector(".eva-ver")?.remove();
  const ov = document.createElement("div"); ov.className = "eva-ver"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
  ov.innerHTML = `<button class="eva-ic eva-ver-x" type="button" aria-label="Fechar">${IC.fechar}</button><img src="${u.url}" alt="Resumo de ${esc(RM.nomeMes(mes))}">
    <div class="eva-ver-bts"><button type="button" class="eva-bt eva-ver-comp">Compartilhar</button><button type="button" class="eva-bt eva-sec eva-ver-salvar">Salvar</button></div>`;
  raiz.append(ov);
  const fechar = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) fechar(); });
  ov.querySelector(".eva-ver-x").onclick = fechar;
  ov.querySelector(".eva-ver-comp").onclick = async () => { const R = await import("../musicas/retroImagem.js"); await R.compartilharImagem(u.blob, `orbita-${mes}.png`); };
  ov.querySelector(".eva-ver-salvar").onclick = async (e) => { const res = await RM.salvarImagem(u.blob, `orbita-${mes}.png`); e.target.textContent = res === "salvo" ? "Salva em Documentos" : res === "baixado" ? "Baixada" : "Salvar"; };
}
/** A retrospectiva animada dos meses de `rt` ({ titulo, meses, ano }). */
async function abrirRetrospectiva(rt) {
  const RT = await import("./retroEva.js"), v = EV.EV();
  const resumos = (rt.meses || []).map(m => v.meses?.[m]).filter(Boolean);
  if (!resumos.length) return null;
  return RT.abrirRetro(raiz?.closest(".camada-eva") || raiz, { resumos, titulo: rt.titulo, ano: rt.ano, meses: rt.meses, nome: EV.nomeDele() });
}

/** Põe nas perguntas abertas o quadro (o mesmo de antes, se já existia: a escolha pela metade fica). */
function ligarQuadros(chat) {
  const usadas = new Set();
  chat.querySelectorAll(".eva-hq[data-m]").forEach(ph => {
    const id = ph.dataset.m; usadas.add(id);
    let q = quadros.get(id);
    if (!q) {
      const m = EV.EV().msgs[id];
      q = document.createElement("div"); q.className = "eva-hq"; q.dataset.m = id;
      q.innerHTML = htmlQuadro({ pergunta: m?.texto || P.PERGUNTA_HUMOR, compacto: true });
      ligarQuadro(q, { msg: id, aoEscolher: (reg) => { setTimeout(() => { EV.responderHumor(id, reg); quadros.delete(id); desenhar(true); }, 450); } });
      quadros.set(id, q);
    }
    ph.replaceWith(q);
  });
  for (const k of [...quadros.keys()]) if (!usadas.has(k)) quadros.delete(k);
}
function trocarRosto(h) {
  const el = $(".eva-rosto"); if (!el || rostoAtual === h) return;
  const primeira = !rostoAtual; rostoAtual = h;
  el.innerHTML = rosto(h);
  if (!primeira) { el.classList.remove("eva-troca"); void el.offsetWidth; el.classList.add("eva-troca"); }
}
function desenharChips() {
  const box = $(".eva-chips"); if (!box) return;
  const cs = digitando() ? [] : EV.chipsAgora();
  box.innerHTML = cs.map(c => `<button type="button" class="eva-chip${c.forte ? " eva-forte" : ""}" data-id="${esc(c.id)}">${esc(c.rotulo)}</button>`).join("");
  box.querySelectorAll(".eva-chip").forEach(b => (b.onclick = async () => {
    if (digitando()) return;
    const id = b.dataset.id;
    if (id === "recados") { abrirRecados(); return; }
    const res = await EV.rapida(id, { ir: irPara });
    if (id === "outro") { const ta = $(".eva-entrada textarea"); ta.placeholder = "Qual o motivo?"; ta.focus(); }
    if (res || id !== "abrir") desenhar(true);
  }));
}
let avisoN = 0; // só vale a situação mais nova (a da IA local pode chegar depois de uma mais antiga)
async function avisoApi() {
  if (!$(".eva-aviso")) return;
  const n = ++avisoN, s = await EV.situacaoApi().catch(() => ({ ok: false }));
  const el = raiz?.isConnected && n === avisoN ? $(".eva-aviso") : null;
  if (!el) return;
  const t = s.ok ? "" : s.motivo === "teto" ? `Teto de US$ ${String(EV.ajustes().teto).replace(".", ",")} do mês atingido: só respostas rápidas até virar o mês.` : s.motivo === "sem-chave" ? "A IA está ligada, mas falta a chave." : IL.avisoLocal(s.motivo);
  el.hidden = !t;
  el.innerHTML = t ? `${esc(t)}${s.motivo === "sem-chave" ? ` <button type="button" class="eva-link">Pôr a chave</button>` : s.motivo === "sem-modelo" ? ` <button type="button" class="eva-link">Baixar o modelo</button>` : ""}` : "";
  el.querySelector(".eva-link")?.addEventListener("click", () => abrirAjustes());
}
function irPara(ir) { opts.irParaItem?.(ir); }

async function enviar() {
  const ta = $(".eva-entrada textarea"), t = ta.value.trim();
  if (!t || pensando) return;
  ta.value = ""; ta.style.height = "auto"; ta.placeholder = "Mensagem";
  await EV.conversar(t, { aoPensar: (v) => { pensando = v; desenhar(true); } });
  desenhar(true);
}

function mostrarSemana() {
  const hum = EV.humorAtual(), dias = ["D", "S", "T", "Q", "Q", "S", "S"];
  folha(`<h2>Humor: ${esc(hum.nome)}</h2>
    <div class="eva-sem-grande">${hum.semana.map(d => `<span><i style="--c:${d.nivel == null ? "var(--linha)" : NIVEIS[d.nivel].cor}"></i><small>${dias[new Date(d.data + "T12:00").getDay()]}</small></span>`).join("")}</div>
    <ul class="eva-legenda">${NIVEIS.map(n => `<li><i style="--c:${n.cor}"></i>${esc(n.nome)}</li>`).join("")}</ul>`);
}

// ---------------------------------------------------------------- folhas
function folha(html, aoMontar) {
  raiz.querySelector(".eva-folha-fundo")?.remove();
  const f = document.createElement("div"); f.className = "eva-folha-fundo";
  f.innerHTML = `<div class="eva-folha" role="dialog" aria-modal="true"><button class="eva-ic eva-fechar" type="button" aria-label="Fechar">${IC.fechar}</button>${html}</div>`;
  raiz.append(f);
  const fechar = () => f.remove();
  f.addEventListener("click", (e) => { if (e.target === f) fechar(); });
  f.querySelector(".eva-fechar").onclick = fechar;
  aoMontar?.(f.querySelector(".eva-folha"), fechar);
  return f;
}
const dolar = (micro) => `US$ ${(micro / 1e6).toFixed(2).replace(".", ",")}`;
async function abrirAjustes() {
  const a = EV.ajustes(), g = EV.gastoDoMes(), tem = await API.temChave(), teto = Math.round(a.teto * 1e6);
  const p = Math.min(1, (g.micro || 0) / Math.max(1, teto));
  const liga = (k, v, rot) => `<label class="eva-liga"><span>${rot}</span><input type="checkbox" data-k="${k}" ${v ? "checked" : ""}><i></i></label>`;
  const RM = await import("./resumoMes.js"), ms = EV.meses().slice().reverse();
  folha(`<h2>Ajustes da Eva</h2>
    <section class="eva-sec"><h3>Conversa</h3>
      ${liga("ia", a.ia === true, "Responder com a IA")}
      <p class="eva-nota">Desligada, ela responde com as falas dela: sem internet e sem custo.</p></section>
    <div class="eva-com-ia"${a.ia === true ? "" : " hidden"}>
    ${IL.htmlFonte(a)}
    <div class="eva-so-claude"${IL.ehLocal(a) ? " hidden" : ""}>
    <section class="eva-sec"><h3>Chave da API</h3>
      <p class="eva-chave-sit ${tem ? "eva-ok" : ""}">${tem ? "Guardada neste aparelho" : "Nenhuma chave neste aparelho"}</p>
      <div class="eva-linha"><input type="password" class="eva-chave" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="eva-bt eva-guardar">Guardar</button></div>
      <div class="eva-linha"><button type="button" class="eva-bt eva-sec eva-testar" ${tem ? "" : "disabled"}>Testar</button><button type="button" class="eva-bt eva-sec eva-ruim eva-apagar-chave" ${tem ? "" : "disabled"}>Apagar</button></div>
      <p class="eva-nota">Crie em console.anthropic.com → API Keys. Fica só neste aparelho, cifrada.</p>
      <p class="eva-teste-res" hidden></p></section>
    <section class="eva-sec"><h3>Modelo</h3>
      <div class="eva-seg">${Object.entries(API.MODELOS).map(([k, m]) => `<button type="button" data-modelo="${k}" class="${a.modelo === k ? "eva-on" : ""}">${m.nome}</button>`).join("")}</div></section>
    <section class="eva-sec"><h3>Gasto do mês</h3>
      <div class="eva-gasto"><i style="--p:${p}"></i></div>
      <p class="eva-gasto-tx">${dolar(g.micro || 0)} de ${dolar(teto)} · ${g.n || 0} pedido${g.n === 1 ? "" : "s"}</p>
      <label class="eva-teto">Teto por mês (US$)<input type="number" min="0.5" max="50" step="0.5" value="${a.teto}" inputmode="decimal"></label>
      <p class="eva-nota">Preços por milhão de tokens: conferir no site oficial.</p></section>
    </div>
    <section class="eva-sec">${liga("variar", a.variar !== false, "Variar o texto com a IA")}</section>
    </div>
    <section class="eva-sec"><h3>Mensagens</h3>
      ${liga("aqui", P.aqui(), "Mensagens programadas neste aparelho")}
      ${liga("aleatorias", a.aleatorias !== false, "Mensagens em horários aleatórios")}
      ${liga("humor", a.humor !== false, "Perguntar como estou à noite")}
      ${liga("musica", a.musica !== false, "Música do dia")}</section>
    <section class="eva-sec"><h3>Recados do Claude</h3>
      <button type="button" class="eva-bt eva-sec eva-ver-recados">Ver os recados (${RE.abertos().length} aberto${RE.abertos().length === 1 ? "" : "s"})</button></section>
    <section class="eva-sec eva-meses"><h3>Meus meses</h3>
      ${ms.length ? `<div class="eva-meses-l">${ms.map(m => `<button type="button" class="eva-mes-bt" data-mes="${m}">${esc(RM.nomeMes(m))}<small>${(EV.EV().meses[m].xp || 0).toLocaleString("pt-BR")} XP</small></button>`).join("")}</div>` : `<p class="eva-nota">No começo de cada mês ela faz um resumo do mês que passou. Ele aparece aqui.</p>`}
      ${ms.length >= 2 ? `<button type="button" class="eva-bt eva-sec eva-ver-retro">Assistir à retrospectiva</button>` : ""}</section>
    <section class="eva-sec"><button type="button" class="eva-bt eva-sec eva-ruim eva-limpar">Apagar a conversa</button></section>`, (f, fechar) => {
    IL.ligarFonte(f, { aoMudar: () => avisoApi() });
    const res = f.querySelector(".eva-teste-res");
    const mostrar = (t, ok) => { res.hidden = false; res.textContent = t; res.classList.toggle("eva-ok", !!ok); };
    f.querySelector(".eva-guardar").onclick = async () => {
      const inp = f.querySelector(".eva-chave"), v = inp.value.trim();
      if (!/^sk-ant-/.test(v) && v.length < 20) { mostrar("Isso não parece uma chave da Anthropic.", false); return; }
      try { await API.guardarChave(v); inp.value = ""; fechar(); abrirAjustes(); desenhar(); } catch (e) { mostrar(e.message || "Não deu para guardar", false); }
    };
    f.querySelector(".eva-testar").onclick = async (ev) => {
      ev.target.disabled = true; mostrar("Testando…", true);
      try {
        const r = await API.chamar(API.montarPedido({ modelo: EV.modeloId(), contexto: "Teste da chave.", nova: "Diga só oi, em JSON.", maxTokens: 60 }));
        EV.EV().gasto && API.somarGasto(EV.EV().gasto, new Date().toISOString().slice(0, 7), r.usage, r.modelo); EV.salvarEva();
        mostrar(`Funcionou: “${API.lerResposta(r.texto).texto.slice(0, 80)}”`, true);
      } catch (e) { mostrar(e.message || "Não funcionou", false); }
      ev.target.disabled = false;
    };
    const apagar = f.querySelector(".eva-apagar-chave");
    apagar.onclick = async () => {
      if (!apagar.dataset.certeza) { apagar.dataset.certeza = "1"; apagar.textContent = "Toque de novo para apagar"; return; }
      await API.apagarChave(); fechar(); abrirAjustes(); desenhar();
    };
    f.querySelectorAll("[data-modelo]").forEach(b => (b.onclick = () => { EV.definirAjuste("modelo", b.dataset.modelo); f.querySelectorAll("[data-modelo]").forEach(x => x.classList.toggle("eva-on", x === b)); }));
    f.querySelector(".eva-teto input").onchange = (e) => { const v = Math.max(0.5, Math.min(50, parseFloat(String(e.target.value).replace(",", ".")) || API.TETO_PADRAO)); EV.definirAjuste("teto", v); fechar(); abrirAjustes(); };
    f.querySelectorAll(".eva-liga input").forEach(i => (i.onchange = () => {
      if (i.dataset.k === "aqui") P.definirAqui(i.checked); else EV.definirAjuste(i.dataset.k, i.checked);
      if (i.dataset.k === "ia") { f.querySelector(".eva-com-ia").hidden = !i.checked; avisoApi(); }
      import("../notificacoes.js").then(m => m.reagendar()).catch(() => {});
    }));
    f.querySelectorAll(".eva-mes-bt").forEach(b => (b.onclick = () => verMes(b.dataset.mes)));
    f.querySelector(".eva-ver-recados").onclick = () => { fechar(); abrirRecados(); };
    f.querySelector(".eva-ver-retro")?.addEventListener("click", () => {
      const m = EV.meses(); fechar();
      abrirRetrospectiva({ titulo: m.length > 3 ? "Os seus meses" : "Os últimos meses", meses: m.slice(-12), ano: m.length > 6 });
    });
    const limpar = f.querySelector(".eva-limpar");
    limpar.onclick = () => {
      if (!limpar.dataset.certeza) { limpar.dataset.certeza = "1"; limpar.textContent = "Toque de novo para apagar tudo"; return; }
      EV.limparConversa(); fechar(); desenhar(true);
    };
  });
}

export const _teste = { abrirRecados, abrirAjustes, mostrarSemana, desenhar: () => desenhar(true), fila: () => [...fila], verMes, abrirRetrospectiva };
