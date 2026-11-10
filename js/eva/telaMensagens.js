// Mensagens (pedido do Alediov, 04/11/2026: o subapp "Eva" virou "Mensagens", como o WhatsApp). A camada `.camada-eva`
// (o nome interno fica, para atualizar por cima) mostra uma vista por vez:
//   - a LISTA de conversas: a Eva fixada no alto (rosto do humor de hoje, a última mensagem, a hora e as não lidas, por
//     `orbita.eva.lidaAte` neste aparelho), logo abaixo os DESTAQUES (fixos também: todos os destaques dos grupos, com
//     os que faltam decidir como não lidos; whatsapp/telaDestaques.js) e, embaixo, um item por grupo do WhatsApp com
//     mensagens guardadas (Sempre ou Triagem; os Ignorar não guardam nada), do mais recente para o mais velho, com os
//     destaques para decidir como não lidos;
//   - a conversa com a EVA (telaEva.js, tudo o que já existia, com a seta de voltar);
//   - DESTAQUES (pedido do Alediov, 04/11/2026, 20h53): decidir o que vai ao Claude (whatsapp/telaDestaques.js);
//   - a conversa de um GRUPO: as mensagens guardadas dos 30 dias em bolhas de grupo (quem mandou, hora, os dias), os
//     destaques com o motivo e, neles, "Enviar ao Claude" / "Não" (ou o que já foi decidido, com Desfazer) e "Nota ou
//     anexo", que leva ao item em Destaques; busca. Só leitura: no rodapé, a faixa e "Abrir no WhatsApp". Abrir a
//     conversa NÃO decide nada.
// Tocar no rosto da Eva abre o perfil dela (perfilEva.js). O voltar do Android fecha o perfil e volta da conversa para a
// lista (voltar.js). Abertura: `abrirMensagens(camada, { conversa })` com "lista", "eva", "destaques" ("destaques#<id>"
// rola até um) ou "g:<chave do grupo>"
// (areas.js abrirEva; as notificações da Eva abrem a conversa dela, o Meu dia e o cartão da Agenda a do grupo).
import * as EV from "./eva.js";
import * as T from "./telaEva.js";
import { abrirPerfil } from "./perfilEva.js";
import { empilhar, limparPilha } from "./voltar.js";
import { eva } from "../arte/eva.js";
import { toast } from "../ui.js";
import * as R from "../whatsapp/regras.js";
import * as W from "../whatsapp/whatsapp.js";
import { fonte, nativo } from "../whatsapp/fonte.js";
import * as D from "../whatsapp/destaques.js";
import { telaDestaques, IC_DESTAQUES } from "../whatsapp/telaDestaques.js";
import { perguntasAbertas } from "../agendaAvisos/agendaAvisos.js";

let camada = null, opts = {}, vista = null, vistaEl = null, tirarConversa = null, perfilAtual = null, desligar = [], geracao = 0;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CHAVE_LIDA = "orbita.eva.lidaAte";
const MOSTRAR = 150;
const IC = {
  voltar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  grupos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><circle cx="17" cy="9" r="2.5"/><path d="M16.2 14.3c2.6.1 4.3 1.8 4.8 4.6"/></svg>`,
  lupa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`,
  fechar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  fixada: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.6 2.6l5.8 5.8-2.2.6-3.2 3.2.4 4.6-1.6 1.6-4-4-5.2 5.2-1.2-.1-.1-1.2 5.2-5.2-4-4L7.1 7.5l4.6.4 3.2-3.2z"/></svg>`,
  cadeado: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/></svg>`,
  whats: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3z"/></svg>`,
};
// cores das iniciais dos grupos e dos nomes nas bolhas (como o WhatsApp, uma por nome), legíveis no claro e no AMOLED
const CORES = ["#E0567A", "#3E8ED8", "#2FA77A", "#D9822B", "#8B6CF0", "#C0503B", "#1F9BB0", "#B5527F", "#5E7DD6", "#7A9A2E"];
const corDe = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return CORES[h % CORES.length]; };
const dois = (n) => String(n).padStart(2, "0");
const hm = (ms) => { const d = new Date(ms); return `${dois(d.getHours())}:${dois(d.getMinutes())}`; };
const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
/** A hora na lista de conversas: "14:32" hoje, "Ontem", "seg." na semana, "03/11" antes. */
function horaLista(ms) {
  if (!ms) return "";
  const hoje = new Date(), d = new Date(ms), ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return hm(ms);
  if (mesmoDia(d, ontem)) return "Ontem";
  if (hoje - d < 6 * 864e5) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
}
function rotuloDia(ms) {
  const d = new Date(ms), hoje = new Date(), ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
const motivoTxt = (m) => (m === "sempre" ? "grupo de avisos" : m === "menção" ? "falaram com você" : String(m || "").replace(/^data: /, "data/hora: "));

// ---------------------------------------------------------------- a Eva: lidas neste aparelho
const lidaAte = () => { try { return localStorage.getItem(CHAVE_LIDA) || ""; } catch { return ""; } };
/** As mensagens dela ainda não vistas na conversa (neste aparelho). */
export const evaNaoLidas = () => { const ate = lidaAte(); return EV.mensagens().filter(m => m.de === "eva" && m.em > ate).length; };
function marcarEvaLida() {
  const ult = EV.mensagens().at(-1);
  if (ult && ult.em > lidaAte()) try { localStorage.setItem(CHAVE_LIDA, ult.em); } catch { /* */ }
}

// ---------------------------------------------------------------- a camada
/** Abre Mensagens na camada (areas.js). o: { aoTrocarArea, logo, irParaItem, conversa: "lista" | "eva" | "g:<chave>" }. */
export async function abrirMensagens(el, o = {}) {
  desligar.forEach(f => { try { f(); } catch { /* */ } }); desligar = [];
  camada = el; opts = o; vista = null; vistaEl = null; tirarConversa = null; perfilAtual = null;
  camada.classList.add("msg-camada");
  cobrirFundo(el);
  const aoWhats = () => { vistaEl?._redesenhar?.({ manter: true }); };
  const aoAv = () => { if (vista === "lista") vistaEl?._redesenhar?.({ manter: true }); };
  window.addEventListener("oq-agenda-avisos", aoAv); desligar.push(() => window.removeEventListener("oq-agenda-avisos", aoAv));
  let tEva = null;
  const aoEva = () => { if (vista === "eva" && !document.hidden) marcarEvaLida(); if (vista === "lista") { clearTimeout(tEva); tEva = setTimeout(() => vistaEl?._redesenhar?.({ manter: true }), 120); } };
  window.addEventListener("oq-whats", aoWhats); window.addEventListener("oq-eva", aoEva);
  desligar.push(() => { window.removeEventListener("oq-whats", aoWhats); window.removeEventListener("oq-eva", aoEva); clearTimeout(tEva); });
  EV.comecar(); // as boas-vindas da 1ª vez (a Eva começa quando ele abre Mensagens)
  await mostrar(o.conversa || "lista", { inicio: true });
}
/** Ao sair da área (areas.js fecharEva). Com a camada `el`, só se ela ainda é a aberta (fechar e abrir de novo depressa). */
export function sairDeMensagens(el) {
  if (el && camada && camada !== el) return;
  sairVista();
  desligar.forEach(f => { try { f(); } catch { /* */ } }); desligar = [];
  tirarConversa = null; perfilAtual = null; limparPilha();
  camada = null; vista = null; vistaEl = null;
}
export const vistaAtual = () => vista;

// o que fica coberto não pinta nem anima (como no Clima): `eva-cobre` no <html> esconde os Estudos atrás; com a Home por
// cima ou o app no fundo, a camada para de se mexer
function cobrirFundo(el) {
  const html = document.documentElement;
  // outra camada aberta logo depois (fechar e abrir depressa) cuida da classe: esta não a tira
  const descobrir = () => { if (![...document.querySelectorAll(".camada-eva")].some(c => c !== el && c.style.opacity !== "0")) html.classList.remove("eva-cobre"); };
  const ver = () => {
    const viva = el.isConnected && el.style.opacity !== "0";
    if (viva) html.classList.add("eva-cobre"); else descobrir();
    el.classList.toggle("eva-parado", !viva || !!document.querySelector(".camada-home") || document.hidden);
    if (!el.isConnected) { o1.disconnect(); document.removeEventListener("visibilitychange", ver); }
  };
  const o1 = new MutationObserver(ver);
  o1.observe(document.body, { childList: true });
  document.addEventListener("visibilitychange", ver);
  desligar.push(() => { o1.disconnect(); document.removeEventListener("visibilitychange", ver); descobrir(); });
  ver();
}

function sairVista() {
  if (!vistaEl) return;
  if (vista === "eva") T.sairDaEva(vistaEl);
  vistaEl._sair?.();
  vistaEl.remove();
}

/** Mostra uma vista: "lista", "eva", "destaques" (ou "destaques#<id>") ou "g:<chave>". Da lista para uma conversa,
 *  empilha o voltar do Android. */
let focoDestaques = null;
export async function mostrar(c = "lista", { inicio = false } = {}) {
  if (!camada?.isConnected) return;
  c = c || "lista";
  let foco = "";
  if (c.startsWith("destaques#")) { foco = c.slice(10); c = "destaques"; }
  if (c === vista && vistaEl?.isConnected) { if (foco) focoDestaques?.focar(foco); return; }
  perfilAtual?.fechar(); perfilAtual = null;
  const antes = vista;
  sairVista();
  const el = document.createElement("div");
  el.className = "eva-vista";
  if (!inicio && antes) el.classList.add(c === "lista" ? "msg-volta" : "msg-vai");
  camada.append(el);
  vista = c; vistaEl = el;
  if (c === "lista") { if (tirarConversa) { const t = tirarConversa; tirarConversa = null; t(); } }
  else if (!tirarConversa) tirarConversa = empilhar(() => { tirarConversa = null; mostrar("lista"); });
  if (c === "eva") {
    await T.abrirTelaEva(el, { ...opts, voltar: () => mostrar("lista"), perfil: (orig) => abrirPerfilDaqui(orig) });
    if (vistaEl === el) marcarEvaLida();
  } else if (c === "destaques") {
    focoDestaques = await telaDestaques(el, { voltar: () => mostrar("lista"), irGrupo: (ch) => mostrar(`g:${ch}`), foco });
  } else if (c.startsWith("g:")) await telaGrupo(el, c.slice(2));
  else await telaLista(el);
}
function abrirPerfilDaqui(origem) {
  if (!camada) return;
  perfilAtual = abrirPerfil(camada, origem);
}

// ---------------------------------------------------------------- a lista de conversas
async function telaLista(el) {
  el.classList.add("eva-raiz", "msg-vista-lista");
  el.innerHTML = `<header class="eva-topo msg-topo">
      <button class="eva-area" type="button" aria-label="Trocar de área">${opts.logo || ""}</button>
      <div class="msg-titulo"><b>Mensagens</b><small>A Eva e os grupos do WhatsApp</small></div>
      <button class="eva-ic msg-grupos" type="button" aria-label="Grupos do WhatsApp">${IC.grupos}</button>
    </header>
    <main class="msg-lista" aria-label="Conversas"></main>`;
  el.querySelector(".eva-area").onclick = () => opts.aoTrocarArea?.();
  el.querySelector(".msg-grupos").onclick = () => import("../whatsapp/telaWhats.js").then(m => m.abrirAjustesWhats());
  const lista = el.querySelector(".msg-lista");
  const desenhar = async ({ manter = false } = {}) => {
    const g = ++geracao, topo = lista.scrollTop;
    const [cs, sit] = await Promise.all([W.conversasDosGrupos().catch(() => []), fonte().situacao().catch(() => null)]);
    if (g !== geracao || vistaEl !== el) return;
    const hum = EV.humorAtual(), ms = EV.mensagens(), ult = ms.at(-1), nl = evaNaoLidas();
    const prev = ult ? `${ult.de === "eu" ? "Você: " : ""}${ult.texto}` : "Toque para conversar";
    let h = `<div class="msg-item msg-eva${nl ? " msg-tem" : ""}" data-c="eva">
        <button class="msg-av msg-av-eva" type="button" aria-label="Ver o perfil da Eva">${eva({ humor: hum.rosto, capuz: false })}</button>
        <button class="msg-corpo" type="button" aria-label="Conversa com a Eva${nl ? `, ${nl} não lida${nl > 1 ? "s" : ""}` : ""}">
          <span class="msg-l1"><b>Eva</b><time>${esc(horaLista(ult ? Date.parse(ult.em) : 0))}</time></span>
          <span class="msg-l2"><span class="msg-prev">${esc(prev)}</span><i class="msg-pin" title="Fixada">${IC.fixada}</i>${nl ? `<b class="msg-cont">${nl}</b>` : ""}</span>
        </button></div>`;
    // Destaques: fixo logo abaixo da Eva (os destaques de todos os grupos, para decidir o que vai ao Claude)
    const todosD = W.avisos(), nd = W.paraDecidir().length + perguntasAbertas().length, ud = W.paraDecidir()[0] || todosD[0];
    const prevD = ud ? `${R.limparTitulo(ud.grupo)}: ${ud.texto}` : "Os recados importantes dos grupos aparecem aqui";
    h += `<div class="msg-item msg-ds${nd ? " msg-tem" : ""}" data-c="destaques">
        <button class="msg-av msg-av-ds" type="button" tabindex="-1" aria-hidden="true">${IC_DESTAQUES}</button>
        <button class="msg-corpo" type="button" aria-label="Destaques${nd ? `, ${nd} para decidir` : ""}">
          <span class="msg-l1"><b>Destaques</b><time>${esc(horaLista(ud?.quando))}</time></span>
          <span class="msg-l2"><span class="msg-prev">${esc(prevD)}</span><i class="msg-pin" title="Fixada">${IC.fixada}</i>${nd ? `<b class="msg-cont msg-cont-ds">${nd}</b>` : ""}</span>
        </button></div>`;
    h += `<div class="msg-sep">Grupos do WhatsApp</div>`;
    for (const c of cs) {
      const u = c.ultima, p = u ? `${u.de}: ${u.texto}` : "Destaque novo";
      h += `<div class="msg-item msg-g${c.naoVistos ? " msg-tem" : ""}" data-c="g:${esc(c.chave)}">
        <button class="msg-av msg-av-g" type="button" tabindex="-1" aria-hidden="true" style="--c:${corDe(c.chave)}">${esc(R.iniciais(c.nome))}</button>
        <button class="msg-corpo" type="button" aria-label="${esc(c.nome)}${c.naoVistos ? `, ${c.naoVistos} destaque${c.naoVistos > 1 ? "s" : ""} para decidir` : ""}">
          <span class="msg-l1"><b>${esc(c.nome)}</b><time>${esc(horaLista(u?.quando))}</time></span>
          <span class="msg-l2"><span class="msg-prev">${esc(p)}</span>${c.naoVistos ? `<b class="msg-cont msg-cont-wa">${c.naoVistos}</b>` : ""}</span>
        </button></div>`;
    }
    if (!cs.length) h += `<div class="msg-vazio"><p>${sit?.permitido ? "Nenhuma mensagem dos grupos ainda. Aparecem aqui os grupos em <b>Sempre</b> ou <b>Triagem</b>." : nativo() ? "O Órbita ainda não lê as notificações do WhatsApp." : "No navegador: fonte de teste, sem mensagens ainda."}</p><button type="button" class="eva-bt msg-escolher">${sit?.permitido ? "Escolher os grupos" : "Ativar"}</button></div>`;
    else if (sit && !sit.permitido) h += `<div class="msg-vazio msg-pouco"><p>O acesso às notificações está desligado: nada novo chega.</p><button type="button" class="eva-bt eva-sec msg-escolher">Ativar</button></div>`;
    lista.innerHTML = h;
    lista.querySelectorAll(".msg-item").forEach(it => {
      const c = it.dataset.c;
      it.querySelector(".msg-corpo").onclick = () => mostrar(c);
      it.querySelector(".msg-av").onclick = (ev) => { if (c === "eva") abrirPerfilDaqui(ev.currentTarget); else mostrar(c); };
    });
    lista.querySelector(".msg-escolher")?.addEventListener("click", () => import("../whatsapp/telaWhats.js").then(m => m.abrirAjustesWhats()));
    if (manter) lista.scrollTop = topo;
  };
  el._redesenhar = desenhar;
  await desenhar();
}

// ---------------------------------------------------------------- a conversa de um grupo (só leitura)
async function telaGrupo(el, chave) {
  el.classList.add("eva-raiz", "msg-vista-grupo");
  el.dataset.grupo = chave;
  el.innerHTML = `<header class="eva-topo msg-topo">
      <button class="eva-ic eva-voltar msg-voltar" type="button" aria-label="Voltar para as conversas">${IC.voltar}</button>
      <span class="msg-av msg-av-g msg-av-topo" aria-hidden="true"></span>
      <div class="msg-titulo"><b class="msg-nome"></b><small class="msg-sub"></small></div>
      <button class="eva-ic msg-buscar" type="button" aria-label="Buscar na conversa" aria-expanded="false">${IC.lupa}</button>
    </header>
    <div class="msg-busca" hidden><input type="search" placeholder="Buscar nesta conversa" aria-label="Buscar nesta conversa" autocomplete="off" enterkeyhint="search"><small class="msg-busca-n"></small><button class="eva-ic msg-busca-x" type="button" aria-label="Fechar a busca">${IC.fechar}</button></div>
    <main class="eva-chat msg-chat" aria-label="Mensagens do grupo"></main>
    <div class="msg-novos" hidden></div>
    <footer class="msg-so-leitura"><span class="msg-sl-tx">${IC.cadeado}<span>Só leitura: para responder, use o WhatsApp.</span></span><button type="button" class="msg-abrir-wa">${IC.whats}Abrir no WhatsApp</button></footer>`;
  const $ = (s) => el.querySelector(s), chat = $(".msg-chat"), caixa = $(".msg-busca"), inp = $(".msg-busca input");
  $(".msg-voltar").onclick = () => mostrar("lista");
  let limite = MOSTRAR, busca = "", primeira = true, tBusca = null;
  $(".msg-buscar").onclick = () => {
    const abrir = caixa.hidden; caixa.hidden = !abrir; $(".msg-buscar").setAttribute("aria-expanded", String(abrir));
    if (abrir) inp.focus(); else { inp.value = ""; if (busca) { busca = ""; desenhar(); } }
  };
  $(".msg-busca-x").onclick = () => $(".msg-buscar").click();
  inp.addEventListener("input", () => { clearTimeout(tBusca); tBusca = setTimeout(() => { busca = R.normalizar(inp.value); desenhar(); }, 200); });
  $(".msg-abrir-wa").onclick = async () => {
    const ok = await W.abrirWhatsApp();
    if (!ok) toast(nativo() ? "Não achei o WhatsApp neste celular." : "No navegador não dá para abrir o WhatsApp: abra no celular.");
  };
  const marca = (texto) => {
    if (!busca) return esc(texto);
    // destaca o que bate com a busca (sem acento e sem maiúsculas, como a busca), palavra a palavra
    const t = String(texto), n = R.normalizar(t);
    if (!n.includes(busca)) return esc(t);
    const termos = busca.split(" ").filter(x => x.length > 1);
    return esc(t).replace(/[\p{L}\p{N}]+/gu, (w) => (termos.some(x => R.normalizar(w).includes(x)) ? `<mark>${w}</mark>` : w));
  };
  const desenhar = async ({ manter = false } = {}) => {
    const g = ++geracao, distFim = chat.scrollHeight - chat.scrollTop;
    const ms = await W.mensagensDoGrupo(chave);
    if (g !== geracao || vistaEl !== el) return;
    const nome = R.limparTitulo(ms.at(-1)?.grupo || W.avisos().find(a => R.normalizar(a.grupo) === chave)?.grupo || chave);
    const modo = W.modoDe(nome).modo, nv = ms.filter(m => m.aviso && D.paraDecidir(W.decisao(m.aviso.id)));
    $(".msg-nome").textContent = nome;
    $(".msg-sub").textContent = `${R.MODOS[modo] || ""} · ${ms.length} mensage${ms.length === 1 ? "m" : "ns"} em 30 dias`;
    const av = $(".msg-av-topo"); av.textContent = R.iniciais(nome); av.style.setProperty("--c", corDe(chave));
    const lista = busca ? ms.filter(m => R.normalizar(`${m.de} ${m.texto}`).includes(busca)) : ms.slice(-limite);
    $(".msg-busca-n").textContent = busca ? `${lista.length} encontrada${lista.length === 1 ? "" : "s"}` : "";
    let h = !busca && ms.length > lista.length ? `<button class="eva-antes msg-antes" type="button">Mostrar as anteriores</button>` : "";
    let dia = "", ant = null, sepNovos = false;
    for (const m of lista) {
      const d = rotuloDia(m.quando);
      if (d !== dia) { dia = d; ant = null; h += `<div class="eva-dia"><span>${esc(d)}</span></div>`; }
      const a = m.aviso, rec = a && W.decisao(a.id), visto = a && !D.paraDecidir(rec);
      if (a && !visto && !sepNovos && !busca) { sepNovos = true; ant = null; h += `<div class="msg-sep-novos"><span>Para decidir</span></div>`; }
      const cont = ant && ant.de === m.de && !a && !ant.aviso;
      h += `<div class="msg-b-linha${cont ? " msg-cont-linha" : ""}" data-id="${esc(m.id)}">
        <div class="msg-b${a ? ` msg-aviso${visto ? " msg-visto" : ""}` : ""}">
          ${a ? `<span class="msg-motivo" title="Por que destacou">${esc(motivoTxt(a.motivo))}</span>` : ""}
          ${cont ? "" : `<b class="msg-de" style="--c:${corDe(m.de)}">${esc(m.de)}</b>`}
          <p>${marca(m.texto)}</p>
          <div class="msg-pe">${a ? `<span class="msg-acoes">${visto
            ? `<span class="msg-visto-tx">${rec.d === "enviar" ? (rec.env ? "✓ enviada ao Claude" : "vai ao Claude") : "não vai"}</span><button type="button" class="msg-bt msg-bt-desfazer" data-a="${esc(a.id)}">Desfazer</button>`
            : `<button type="button" class="msg-bt msg-bt-enviar" data-a="${esc(a.id)}">Enviar ao Claude</button><button type="button" class="msg-bt msg-bt-nao" data-a="${esc(a.id)}">Não</button>`}<button type="button" class="msg-bt msg-bt-ds" data-a="${esc(a.id)}">Nota ou anexo ›</button></span>` : ""}<time>${hm(m.quando)}</time></div>
        </div></div>`;
      ant = m;
    }
    if (!lista.length) h += `<p class="msg-nada">${busca ? "Nada com isso nesta conversa." : "Nenhuma mensagem guardada deste grupo nos últimos 30 dias."}</p>`;
    chat.innerHTML = h;
    chat.querySelector(".msg-antes")?.addEventListener("click", () => { limite += MOSTRAR; desenhar({ manter: true }); });
    // as mesmas decisões de Destaques (whatsapp.js); "Nota ou anexo" leva ao item lá
    chat.querySelectorAll(".msg-bt-enviar").forEach(b => (b.onclick = () => { b.disabled = true; W.decidir(b.dataset.a, "enviar"); }));
    chat.querySelectorAll(".msg-bt-nao").forEach(b => (b.onclick = () => { b.disabled = true; W.decidir(b.dataset.a, "nao"); }));
    chat.querySelectorAll(".msg-bt-desfazer").forEach(b => (b.onclick = () => W.decidir(b.dataset.a, null)));
    chat.querySelectorAll(".msg-bt-ds").forEach(b => (b.onclick = () => mostrar(`destaques#${b.dataset.a}`)));
    // a faixa dos destaques para decidir do grupo: tocar no número leva ao primeiro; o botão abre Destaques
    const nov = $(".msg-novos");
    nov.hidden = !nv.length;
    nov.innerHTML = nv.length ? `<button type="button" class="msg-ir-novo">${nv.length} para decidir</button><button type="button" class="msg-bt msg-ir-ds">Abrir Destaques</button>` : "";
    nov.querySelector(".msg-ir-ds")?.addEventListener("click", () => mostrar("destaques"));
    nov.querySelector(".msg-ir-novo")?.addEventListener("click", () => chat.querySelector(`.msg-b-linha[data-id="${CSS.escape(nv[0].id)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    // a 1ª vez: no primeiro aviso novo (como o "mensagens não lidas" do WhatsApp) ou no fim; depois, onde estava
    if (primeira) {
      primeira = false;
      const alvo = chat.querySelector(".msg-sep-novos");
      if (alvo) chat.scrollTop = Math.max(0, alvo.offsetTop - 12); else chat.scrollTop = chat.scrollHeight;
    } else if (manter) chat.scrollTop = chat.scrollHeight - distFim;
    else chat.scrollTop = busca ? 0 : chat.scrollHeight;
  };
  el._redesenhar = desenhar;
  el._sair = () => clearTimeout(tBusca);
  await desenhar();
}

export const _teste = { horaLista, marcarEvaLida };
