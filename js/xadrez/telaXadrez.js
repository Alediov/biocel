// Xadrez (5ª área do Órbita, pedido do Alediov em 25/10/2026: "começo do começo"; aberturas para usar por muito
// tempo, com a Siciliana; 10 min por dia de aberturas; treinos semanais de um pouco de cada; jogar contra o computador).
// Abas (pedidos do Alediov, 26/10/2026): Hoje (só a trilha do dia), Treinar (desafio do dia, aberturas com o lado do
// adversário, problemas, aulas e finais), Jogar (contra o computador, contra um amigo no tablet com as variantes, ou
// a 4) e Desempenho (estatísticas e evolução). No topo, a paleta abre a aparência do tabuleiro e das peças e a
// engrenagem, os ajustes do Xadrez (pedido do Alediov, 02/11/2026: "troque o ícone de engrenagem pelo de paleta de cor,
// afinal lá só tem personalização. Se tiver alguma config daí adicione um aba à parte na mesma região").
// Estado em E().xadrez (vai junto na sincronização entre aparelhos).
import { E, salvar, hojeISO, somaDias, tamanhoDe, INICIO_TAMANHO } from "../estado.js";
import { toast, escapar, confete } from "../ui.js";
import { tocar, vibrar } from "../sons.js";
import { Chess } from "../../vendor/chess.js";
import { criarTabuleiro, definirVisual, classesVisual, SELOS, definirCoresProprias, aoMudarCores } from "./tabuleiro.js";
import { sanPT, lanceNumerado, fraseLance, porqueAutomatico, marcarTermos, GLOSSARIO } from "./notacao.js";
import { avaliarLance, classificar, avDoNumero, avBrancas, notaDe } from "./classificar.js";
import { materialDe, htmlMaterial } from "./material.js";
import { comecarAmigo, cfgAmigo, RELOGIOS_AMIGO, GIROS } from "./amigo.js";
import { VARIANTES } from "./variantes.js";
import { telaQuatro, cfgQuatro, MODOS4 } from "./quatro.js";
import * as M from "./motor.js";
import * as CI from "./ciclos.js";
import { abrirAnalise, abrirImportar, escolherLinha, analisesSalvas, apagarAnalise, MAX_SALVAS } from "./analise.js";
import { decorarCaminho } from "../cenarioTrilha.js";
import { objetoSVG } from "../arte/cenario.js";
import { icone } from "../icones.js";
import { moli } from "../personagens.js";

const INTERVALOS = [1, 3, 7, 14, 30, 60, 120];
const X = () => {
  const e = E();
  e.xadrez ||= {};
  const x = e.xadrez;
  x.linhas ||= {}; x.dias ||= {}; x.semana ||= {}; x.partidas ||= [];
  x.cfg ||= {}; for (const [k, v] of Object.entries({ novas: 2, nivel: 2, cor: "w", adv: "maia", maia: 1100, relogio: "", barra: true, selos: true, explicar: true, contAdv: "maia", contLances: 10 })) if (!(k in x.cfg)) x.cfg[k] = v;
  if (x.rating == null) x.rating = 700;
  x.cfg.visual ||= { tabuleiro: "marrom", pecas: "cburnett", coords: true, lances: true };
  x.ciclos ||= {}; x.ciclos.dias ||= {}; // a rotação dos ciclos da trilha de hoje (ciclos.js): um registro com `em` por dia
  return x;
};

let raiz = null, opts = {}, aba = "hoje", REP = null, PROB = null;
const $ = (s, r = raiz) => r.querySelector(s);
async function repertorio() {
  if (!REP) { REP = await (await fetch("dados/xadrez/repertorio.json")).json(); conferirRepertorio(REP); }
  return REP;
}
// Repertório novo (versão 2, 02/11/2026): o progresso fica pelo id das linhas (as que não mudaram continuam com o mesmo id
// e os mesmos lances); as que saíram somem da trilha (o registro delas fica em x.linhas). Num capítulo cujas linhas
// mudaram, os troféus e o desafio do capítulo valem de novo (`x.capAssin`); a trilha de hoje é refeita se citava uma
// linha que não existe mais.
function conferirRepertorio(rep) {
  const x = X();
  // a assinatura dos capítulos do repertório 1 (até 01/11/2026), para quem ainda não tem nenhuma guardada
  const n = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}-${String(a + i).padStart(2, "0")}`).join(",");
  x.capAssin ||= { sic: n("sic", 1, 12), qgd: n("qgd", 1, 8), ita: n("ita", 1, 6), e4x: n("e4x", 1, 14) };
  let mudou = false;
  for (const c of rep.capitulos) {
    const assin = c.linhas.map(l => l.id).join(",");
    if (x.capAssin[c.id] && x.capAssin[c.id] !== assin) {
      for (const k of Object.keys(x.trofeus || {})) if (k.startsWith(c.id + "-s")) delete x.trofeus[k];
      if (x.desafios) delete x.desafios[c.id];
    }
    if (x.capAssin[c.id] !== assin) { x.capAssin[c.id] = assin; mudou = true; }
  }
  const ids = new Set(rep.capitulos.flatMap(c => c.linhas.map(l => l.id))), caps = new Set(rep.capitulos.map(c => c.id));
  const it = x.planoDia?.itens || [];
  if (it.some(i => (i.id && !ids.has(i.id)) || (i.ids && i.ids.some(k => !ids.has(k))) || (i.linha && !ids.has(i.linha)) || (i.cap && !caps.has(i.cap)))) { x.planoDia = null; mudou = true; }
  if (mudou) salvar();
}
async function problemas() {
  if (PROB) return PROB;
  try { const r = await fetch("dados/xadrez/problemas.json"); if (r.ok) PROB = await r.json(); } catch { /* ainda não gerados */ }
  return PROB;
}
let LIC = null;
async function licoes() { if (!LIC) { try { LIC = await (await fetch("dados/xadrez/licoes.json")).json(); } catch { LIC = { licoes: [] }; } } return LIC.licoes; }
const todasLinhas = (rep) => rep.capitulos.flatMap(c => c.linhas.map(l => ({ ...l, cap: c })));

const I = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fogo: '<svg viewBox="0 0 24 24"><path d="M12 2.5c.6 3.2-1.6 4.7-2.9 6.4C7.7 10.7 7 12.3 7 14.2a5 5 0 0010 0c0-1.6-.6-3-1.6-4.2.1 1.4-.4 2.4-1.4 2.9.4-3.6-.8-7.5-2-10.4z" fill="currentColor"/></svg>',
  voltar: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fechar: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  dica: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  desfazer: '<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  virar: '<svg viewBox="0 0 24 24"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ant: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  prox: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ini: '<svg viewBox="0 0 24 24"><path d="M12 5l-7 7 7 7M19 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fim: '<svg viewBox="0 0 24 24"><path d="M5 5l7 7-7 7M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  paleta: '<svg viewBox="0 0 24 24"><path d="M12 3.2c-5 0-9 3.7-9 8.4 0 4.3 3.5 8.2 7.6 8.2 1.3 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8h2.1c2.9 0 5.4-2.2 5.4-5 0-3.9-4-6.4-8.9-6.4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="7.6" cy="11.4" r="1.45" fill="currentColor"/><circle cx="10.4" cy="7.4" r="1.45" fill="currentColor"/><circle cx="15" cy="7.4" r="1.45" fill="currentColor"/><circle cx="17.6" cy="11" r="1.45" fill="currentColor"/></svg>',
  livro: '<svg viewBox="0 0 24 24"><path d="M4 5.5c2.8-1 5.4-.6 7.5 1v12.7c-2.1-1.4-4.7-1.8-7.5-.9V5.5zm16 0c-2.8-1-5.4-.6-7.5 1v12.7c2.1-1.4 4.7-1.8 7.5-.9V5.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  seguir: '<svg viewBox="0 0 24 24"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  engrenagem: '<svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};

// ---------------------------------------------------------------- área
// Abas (26/10/2026, segundo pedido do Alediov: "talvez seja melhor separar os itens em abas mais adequadas"): Hoje (a
// trilha do dia), Treinar (o que se faz por conta própria: desafio do dia, aberturas, problemas, aulas e finais),
// Jogar (computador, amigo e 4 jogadores) e Desempenho (só os números e a evolução).
const ABAS = [["hoje", "Hoje", "☀️"], ["treinar", "Treinar", "🎯"], ["jogar", "Jogar", "⚔️"], ["desempenho", "Desempenho", "📈"]];
export async function abrirTelaXadrez(el, o = {}) {
  raiz = el; opts = o;
  cobrirFundo(el);
  raiz.innerHTML = `<div class="xz">
    <header class="xz-topo"><button class="xz-area" aria-label="Trocar de área"><span class="xz-logo">${o.logo || ""}</span><span><b>Xadrez</b><small>Trocar de Área ▾</small></span></button><span class="xz-topo-bts"><button class="xz-aparencia" aria-label="Tabuleiro e peças" title="Tabuleiro e peças">${I.paleta}</button><button class="xz-config" aria-label="Ajustes do Xadrez" title="Ajustes do Xadrez">${I.engrenagem}</button></span></header>
    <nav class="xz-abas">${ABAS.map(([k, n, ico]) => `<button data-aba="${k}">${icone(ico, "ico3d")}<span>${n}</span></button>`).join("")}</nav>
    <main class="xz-tela"></main></div>`;
  $(".xz-area").onclick = () => opts.aoTrocarArea?.();
  $(".xz-aparencia").onclick = () => abrirAparencia();
  $(".xz-config").onclick = () => abrirConfig();
  // os termos do glossário sublinhados nas explicações: o toque mostra o que significam
  raiz.addEventListener("click", (e) => { const c = e.target.closest?.(".xz-expl.compacta"); if (c) c.classList.toggle("aberta"); });
  raiz.addEventListener("click", (e) => { const t = e.target.closest?.("[data-termo]"); if (t && GLOSSARIO[t.dataset.termo]) toast(`${t.dataset.termo[0].toUpperCase() + t.dataset.termo.slice(1)}: ${GLOSSARIO[t.dataset.termo]}.`); });
  definirVisual(X().cfg.visual);
  // as cores dele nas anotações (06/11/2026): guardadas em x.cfg (sincronizam)
  definirCoresProprias(X().cfg.coresDesenho || []);
  aoMudarCores((l) => { X().cfg.coresDesenho = l; salvar(); });
  if (!X().cfg.dicaLapis) { X().cfg.dicaLapis = true; salvar(); setTimeout(() => toast("Dica: o lápis embaixo do tabuleiro desenha setas e pinta casas; a lixeira apaga. Segurar uma casa também desenha."), 1500); }
  if (!ABAS.some(a => a[0] === aba)) aba = "hoje";
  raiz.querySelectorAll(".xz-abas button").forEach(b => (b.onclick = () => { aba = b.dataset.aba; desenhar(); }));
  // o Stockfish e a Maia só acordam quando uma partida, prática ou revisão de erros precisa deles (aquecer), e não ao
  // abrir a área: nas lições e nas linhas eles não servem (26/10/2026, desempenho)
  await desenhar();
}
// Desempenho (26/10/2026, "as lições estão bem travadas"): o que fica coberto não pinta nem anima. `xz-cobre` no <html>
// esconde o app dos Estudos atrás do Xadrez (até a área começar a sumir, com a opacidade que fecharXadrez põe) e
// `com-camada` esconde a tela do Xadrez atrás de uma lição, linha, problema ou partida (xadrez.css, no fim).
function cobrirFundo(el) {
  const html = document.documentElement;
  const ver = () => {
    const viva = el.isConnected && el.style.opacity !== "0";
    html.classList.toggle("xz-cobre", viva);
    el.classList.toggle("com-camada", viva && !!el.querySelector(":scope > .xz-camada.aberta"));
    if (!el.isConnected) { obsCorpo.disconnect(); obsArea.disconnect(); }
  };
  const obsCorpo = new MutationObserver(ver), obsArea = new MutationObserver(ver);
  obsCorpo.observe(document.body, { childList: true });
  obsArea.observe(el, { childList: true, attributes: true, attributeFilter: ["style"] });
  el._verFundo = ver;
  ver();
}
async function desenhar() {
  raiz.querySelectorAll(".xz-abas button").forEach(b => b.classList.toggle("on", b.dataset.aba === aba));
  noDoDia = null; // um nó da trilha de hoje aberto e fechado sem terminar não conta
  const t = $(".xz-tela"), alvo = document.createElement("div");
  try {
    if (aba === "jogar") await telaJogar(alvo);
    else if (aba === "treinar") await telaTreinar(alvo);
    else if (aba === "desempenho") await telaDesempenho(alvo);
    else await telaHoje(alvo);
  } catch (e) { alvo.innerHTML = `<p class="xz-vazio">${escapar(e.message || String(e))}</p>`; console.error(e); }
  t.replaceChildren(...alvo.childNodes); t.scrollTop = 0;
}

// ---------------------------------------------------------------- Hoje: a trilha do dia e as trilhas das aberturas
// Pedidos do Alediov (25/10/2026): como o Lotus Chess, sem cronômetro, cada capítulo do repertório é uma trilha de nós
// (Aprender uma linha, Troféu da seção com as 3 linhas seguidas, Desafio no fim) e cada linha se joga de memória até
// sair perfeita DESDE O INÍCIO. Em cima, a TRILHA DE HOJE, pequena e no estilo das trilhas dos Estudos (caminho
// pontilhado, cenário com peças que falam, o companheiro no nó atual): o app escolhe o que entra no dia (o próximo
// passo de algumas aberturas, as revisões devidas e, conforme o dia, uma aula, problemas, os seus erros ou uma partida
// contra a Maia), fixo no dia em `x.planoDia`. Desde 02/11/2026 (v 5, pedido do Alediov) o que não é de todo dia vem
// em CICLOS que se revezam (ciclos.js): Aberturas → Tática → Jogo e técnica.
const POR_SECAO = 3, MIN_APRENDER = 3, MIN_REVER = 1, MIN_TROFEU = 3;
const MIN_DE = { aprender: MIN_APRENDER, trofeu: MIN_TROFEU, desafio: 4, aula: 5, problemas: 4, erros: 3, partida: 10, desafioDia: 3, continuar: 6, corrida: 4, final: 6 };
function devidas(rep) {
  const x = X(), hoje = hojeISO();
  return todasLinhas(rep).filter(l => x.linhas[l.id]?.vista && x.linhas[l.id].proxima <= hoje).sort((a, b) => x.linhas[a.id].proxima.localeCompare(x.linhas[b.id].proxima));
}
function novas(rep) {
  const x = X();
  const caps = rep.capitulos.map(c => c.linhas.filter(l => !x.linhas[l.id]?.vista));
  const out = [];
  for (let i = 0; caps.some(c => c.length); i++) { const c = caps[i % caps.length]; if (c.length) out.push(c.shift()); }
  return out.map(l => todasLinhas(rep).find(y => y.id === l.id));
}
/** Os nós da trilha de um capítulo, em ordem, com o estado de cada um. */
function nosDe(cap, rep) {
  const x = X(); x.trofeus ||= {}; x.desafios ||= {};
  const ls = todasLinhas(rep).filter(l => l.cap.id === cap.id), out = [];
  for (let s = 0; s * POR_SECAO < ls.length; s++) {
    const sec = ls.slice(s * POR_SECAO, (s + 1) * POR_SECAO);
    for (const l of sec) out.push({ tipo: "aprender", l, sec: s, feito: !!x.linhas[l.id]?.vista, firme: (x.linhas[l.id]?.caixa || 0) >= 4 });
    out.push({ tipo: "trofeu", sec: s, linhas: sec, id: `${cap.id}-s${s + 1}`, feito: !!x.trofeus[`${cap.id}-s${s + 1}`] });
  }
  out.push({ tipo: "desafio", linhas: ls, id: cap.id, feito: !!x.desafios[cap.id] });
  const atual = out.findIndex(n => !n.feito);
  out.forEach((n, k) => { n.liberado = atual < 0 || k <= atual; n.atual = k === atual; });
  return out;
}
/** Quando foi a última coisa feita num capítulo (para alternar as aberturas de um dia para o outro). */
function ultimaVez(cap) {
  const x = X();
  let u = "";
  for (const l of cap.linhas) { const s = x.linhas[l.id]; for (const d of [s?.vistaEm, s?.ultima]) if (d && d > u) u = d; }
  for (const [k, d] of Object.entries(x.trofeus || {})) if (k.startsWith(cap.id + "-") && d > u) u = d;
  if (x.desafios?.[cap.id] > u) u = x.desafios[cap.id];
  return u;
}
const hashDe = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function licaoDaSemana(L) {
  const n = Math.max(0, Math.round((new Date(semanaAtual().id + "T12:00:00") - new Date("2026-10-26T12:00:00")) / (7 * 864e5)));
  return { n, atual: L[Math.min(n, L.length - 1)] };
}
/** A aula do ciclo de jogo e técnica: a lição da semana do Capablanca enquanto não estiver feita; depois, um final clássico
 *  ainda não aprendido (Aprender) ou, com todos aprendidos, um para praticar (o nunca praticado ou o praticado há mais tempo). */
async function aulaDoCiclo(hoje) {
  const x = X(), L = await licoes(), F = await finais();
  if (L.length) { const { atual } = licaoDaSemana(L); if (!x.licoes?.[atual.id]) return { tipo: "aula", lic: atual.id }; }
  if (!F.length) return null;
  const naoAprendido = F.find(f => !x.licoes?.["fin-" + f.id]);
  if (naoAprendido) return { tipo: "aula", fin: naoAprendido.id };
  const praticar = [...F].sort((a, b) => (x.finais?.[a.id]?.em || "").localeCompare(x.finais?.[b.id]?.em || "") || (hashDe(hoje + a.id) % 7) - (hashDe(hoje + b.id) % 7))[0];
  return { tipo: "final", fin: praticar.id };
}
/** Uma partida contra a Maia do degrau da escada, a partir de uma linha já aprendida. */
function partidaDoCiclo(rep, hoje) {
  const x = X(), vistas = todasLinhas(rep).filter(l => x.linhas[l.id]?.vista);
  const l = vistas.length ? vistas[hashDe(hoje + "p") % vistas.length] : null;
  const dow = new Date(hoje + "T12:00:00").getDay();
  return { tipo: "partida", nivel: `M${escada().elo}`, linha: l?.id || null, cor: l ? ladoDe(l) : (dow % 2 ? "w" : "b") };
}
/**
 * Os passos de um ciclo (ciclos.js). `leve`: só um passo curto do ciclo (o extra do dia livre).
 *   aberturas: 1 ou 2 nós da trilha das aberturas (as aberturas por dia dos ajustes; no livre, todas) e o "continuar";
 *   tatica: os problemas do tema da semana que faltam e a corrida de 3 minutos ou os seus erros que voltaram;
 *   jogo: a aula (lição da semana ou um final) e uma partida contra a Maia.
 */
async function passosDoCiclo(c, rep, { tam, hoje, leve = false }) {
  const x = X(), out = [], livre = tam === "livre";
  if (c === "aberturas") {
    // as menos treinadas primeiro; a Siciliana não fica fora de dois ciclos de aberturas seguidos (prioridade se não foi
    // treinada desde o último ciclo de aberturas)
    const marco = CI.ultimoDia(x.ciclos.dias, "aberturas", hoje) || somaDias(hoje, -1);
    const caps = rep.capitulos.map((cp, i) => ({ c: cp, i, u: ultimaVez(cp), no: nosDe(cp, rep).find(n => n.atual) })).filter(o => o.no);
    caps.sort((a, b) => {
      const sa = a.c.id === "sic" && a.u < marco ? -1 : 0, sb = b.c.id === "sic" && b.u < marco ? -1 : 0;
      return (sa - sb) || a.u.localeCompare(b.u) || a.i - b.i;
    });
    const n = leve ? 1 : livre ? x.cfg.novas : Math.min(2, x.cfg.novas);
    for (const { c: cp, no } of caps.slice(0, n)) {
      if (no.tipo === "aprender") out.push({ tipo: "aprender", id: no.l.id, cap: cp.id });
      else if (no.tipo === "trofeu") out.push({ tipo: "trofeu", cap: cp.id, sec: no.sec });
      else out.push({ tipo: "desafio", cap: cp.id });
    }
    // continuar depois da abertura (pedido do Alediov, 02/11/2026): uns lances contra a Maia a partir do fim de uma linha
    if (!leve) {
      const vistas = todasLinhas(rep).filter(l => x.linhas[l.id]?.vista);
      if (vistas.length) out.push({ tipo: "continuar", linha: vistas[hashDe(hoje + "c") % vistas.length].id });
    }
  } else if (c === "tatica") {
    const P = await problemas(), erros = errosDevidos().length > 0;
    if (leve) { if (P) out.push({ tipo: "corrida" }); else if (erros) out.push({ tipo: "erros" }); }
    else {
      if (P) {
        const { id, tema } = semanaAtual(), s = x.semana[id] ||= { tema: tema.titulo, feitos: {} };
        const lista = listaDaSemana(P, s, tema, id, x.rating);
        const quantos = livre ? 8 : 5;
        let ids = lista.filter(k => !(k in s.feitos)).slice(0, quantos), semana = true;
        if (ids.length < 2) { // a semana já foi: outro tema, perto do nível dele
          const outro = SEMANAS[hashDe(hoje) % SEMANAS.length];
          ids = escolherProblemas(P, outro, hoje, x.rating).filter(k => !(k in s.feitos)).slice(0, quantos); semana = false;
        }
        if (ids.length) out.push({ tipo: "problemas", ids, semana, tema: semana ? tema.titulo : null });
      }
      if (erros) out.push({ tipo: "erros" });
      if (P && (!erros || livre)) out.push({ tipo: "corrida" });
    }
  } else if (c === "jogo") {
    const aula = await aulaDoCiclo(hoje);
    if (aula) out.push(aula);
    if (!leve) out.push(partidaDoCiclo(rep, hoje));
  }
  return out.map(it => ({ ...it, ciclo: c, ...(leve ? { extra: true } : {}) }));
}
/** Anota no histórico dos ciclos (x.ciclos.dias) o que foi feito do ciclo do plano. Devolve true se mudou. */
function anotarCiclo(p) {
  if (!p?.ciclo || !p.dia) return false;
  const dias = X().ciclos.dias, r = dias[p.dia];
  const s = Math.max(CI.situacaoDoCiclo(p.itens), r?.c === p.ciclo ? r.s || 0 : 0);
  if (r && r.c === p.ciclo && r.s === s && r.t === p.tam) return false;
  dias[p.dia] = { c: p.ciclo, s, t: p.tam, em: new Date().toISOString() };
  return true;
}
const mesmoPasso = (a, b) => a.tipo === b.tipo && ["id", "cap", "sec", "lic", "fin", "linha"].every(k => a[k] === b[k]) && (a.ids || []).join() === (b.ids || []).join();
/** A trilha de hoje (fixa durante o dia). */
async function planoDoDia(rep) {
  const x = X(), hoje = hojeISO();
  // tamanho do dia (tamanhoDia.js, pedido do Alediov, 29/10/2026): no corrido, só as revisões (até 2) e o desafio do dia,
  // e o ciclo não avança; no normal, até 3 revisões e o ciclo da vez; no livre, até 4 revisões, o ciclo da vez e um passo
  // leve do ciclo seguinte
  const tam = hoje >= INICIO_TAMANHO ? tamanhoDe(hoje) : "livre", corrido = tam === "corrido";
  // o plano de um dia anterior: anota o que ele fez do ciclo (é por isso que o ciclo avança ou volta)
  if (x.planoDia && x.planoDia.dia !== hoje && anotarCiclo(x.planoDia)) salvar();
  const p0 = x.planoDia?.dia === hoje && x.planoDia.itens?.length ? x.planoDia : null;
  if (p0 && p0.v === 5 && (p0.tam || "livre") === tam) { if (anotarCiclo(p0)) salvar(); return p0; }
  // montado pela regra antiga (sem os ciclos) e já começado: vale até o fim do dia; nada feito: é refeito
  if (p0 && (p0.v || 0) < 5 && (p0.tam || "livre") === tam && p0.itens.some(i => i.feito)) return p0;
  const antigo = p0?.itens || []; // o que ele já tinha feito hoje continua feito
  const itens = [];
  // sempre: as revisões devidas e o desafio do dia (o mesmo do calendário, em Treinar)
  const dev = devidas(rep).slice(0, corrido ? 2 : tam === "normal" ? 3 : 4);
  if (dev.length) itens.push({ tipo: "rever", ids: dev.map(l => l.id) });
  const P = await problemas();
  if (P) itens.push({ tipo: "desafioDia", dia: hoje });
  // o ciclo da vez (um ciclo sem nada para fazer agora cede ao seguinte)
  let ciclo = null, extra = null;
  if (!corrido) {
    let c = CI.cicloDaVez(x.ciclos.dias, hoje), passos = [];
    for (let k = 0; k < CI.CICLOS.length && !passos.length; k++) { passos = await passosDoCiclo(c, rep, { tam, hoje }); if (!passos.length) c = CI.proximoCiclo(c); }
    if (passos.length) {
      ciclo = c; itens.push(...passos);
      if (tam === "livre") { // dia livre: mais um passo leve do ciclo seguinte
        const e = CI.proximoCiclo(c), ex = (await passosDoCiclo(e, rep, { tam, hoje, leve: true })).filter(i => !itens.some(j => mesmoPasso(i, j)));
        if (ex.length) { extra = e; itens.push(ex[0]); }
      }
    }
  }
  if (!itens.length) { // tudo aprendido e nada devido: reforça as mais fracas
    const fracas = todasLinhas(rep).filter(l => x.linhas[l.id]?.vista).sort((a, b) => (x.linhas[a.id].caixa || 0) - (x.linhas[b.id].caixa || 0)).slice(0, 4);
    if (fracas.length) itens.push({ tipo: "rever", ids: fracas.map(l => l.id) });
  }
  for (const it of itens) if (antigo.some(a => a.feito && mesmoPasso(a, it))) it.feito = true;
  for (const it of itens) if (it.tipo === "desafioDia" && x.desafiosDia?.[hoje]?.feito) it.feito = true;
  const min = itens.reduce((s, it) => s + (it.tipo === "rever" ? it.ids.length * MIN_REVER : it.tipo === "problemas" ? Math.ceil(it.ids.length * 0.8) : MIN_DE[it.tipo] || 3), 0);
  x.planoDia = { v: 5, dia: hoje, tam, ciclo, extra, itens, min };
  if (ciclo) anotarCiclo(x.planoDia);
  else if (corrido && x.ciclos.dias[hoje] && !(x.ciclos.dias[hoje].s > 0)) delete x.ciclos.dias[hoje]; // virou corrido: o ciclo não montado não conta
  salvar();
  return x.planoDia;
}
function sequencia() {
  const x = X(); x.treinoFeito ||= {};
  let n = 0, d = hojeISO();
  if (!x.treinoFeito[d]) d = somaDias(d, -1);
  while (x.treinoFeito[d] && n < 3650) { n++; d = somaDias(d, -1); }
  return n;
}
/** Marca a trilha de hoje como feita quando o último nó termina. Devolve true na hora em que fecha. */
function conferirTrilhaFeita() {
  const x = X(), hoje = hojeISO();
  x.treinoFeito ||= {};
  if (x.planoDia?.dia === hoje) anotarCiclo(x.planoDia);
  if (x.planoDia?.dia === hoje && x.planoDia.itens?.length && x.planoDia.itens.every(i => i.feito) && !x.treinoFeito[hoje]) {
    x.treinoFeito[hoje] = true; salvar(); confete?.(); tocar("ofensiva");
    return true;
  }
  salvar();
  return false;
}
// o nó da trilha de hoje que está aberto (as telas de aula, problemas, erros e partida avisam quando terminam)
let noDoDia = null;
function concluirNoDoDia() {
  const it = noDoDia; noDoDia = null;
  if (!it || it.feito) return;
  it.feito = true;
  if (conferirTrilhaFeita()) toast(`Trilha de hoje feita! ${sequencia()} ${sequencia() === 1 ? "dia" : "dias"} seguidos.`);
}
const ICO_TIPO = { aprender: "⭐", rever: "🔁", trofeu: "🏆", desafio: "👑", aula: "🎓", problemas: "🧩", erros: "🧠", partida: "⚔️", desafioDia: "📅", continuar: "➡️", corrida: "⏱️", final: "🏁" };
const COR_TIPO = { aprender: "", rever: "noite", trofeu: "tarde", desafio: "no-jogo", aula: "extra", problemas: "tarde", erros: "noite", partida: "no-jogo", desafioDia: "extra", continuar: "tarde", corrida: "tarde", final: "extra" };
const CAVALO = `<svg class="astro" viewBox="0 0 24 24"><path fill="currentColor" d="M6.5 21h11.5v-1.6c0-2.6-1-4.9-2.1-6.9.9-1 1.3-2.4 1-3.8-.6-2.3-2.8-3.7-5-3.9L10.6 3 9.4 5.3C7.2 6.4 5.7 8.6 5.1 11c-.3 1.3.9 2.3 2.2 1.8l2.6-1.1c-.9 1.9-3.4 3.8-3.4 7.4z"/></svg>`;
const DICAS = [
  "Antes de cada lance, olhe os xeques, as capturas e as ameaças: as suas e as do adversário.",
  "Na abertura, desenvolva as peças menores, brigue pelo centro e faça o roque cedo.",
  "Não mexa a mesma peça duas vezes na abertura sem um bom motivo.",
  "Cavalo na borda controla poucas casas: no centro ele vale muito mais.",
  "Não tire a dama cedo demais: ela vira alvo das peças menores do adversário.",
  "Torres adoram colunas abertas e a 7ª fileira.",
  "No final, o rei é uma peça de ataque: leve-o para o centro.",
  "Peão passado tem que andar.",
  "Com vantagem de material, troque peças, não peões: o final fica mais fácil de ganhar.",
  "Saber o PORQUÊ dos lances da abertura vale mais que decorar a ordem.",
  "Uma peça sem proteção é um convite para uma tática.",
  "Antes de atacar, termine o desenvolvimento.",
];
function frasesXadrez(rep, itens) {
  const ideias = [];
  for (const it of itens || []) for (const id of it.ids && it.tipo === "rever" ? it.ids : it.id ? [it.id] : []) { const l = todasLinhas(rep).find(y => y.id === id); if (l?.ideia) ideias.push(`<b>${escapar(l.nome)}</b>: ${escapar(l.ideia)}`); }
  return [...ideias, ...DICAS.map(escapar)];
}
const periodoAgora = () => { const h = new Date().getHours(); return h < 12 ? "manha" : h < 18 ? "tarde" : "noite"; };
const DESLOC = [0, 62, 92, 62, 0, -62, -92, -62];
/**
 * Um caminho no estilo dos Estudos. `nos`: [{ rotulo, icone, cor, feito, firme, liberado, atual, balao, jogo, abrir(), nega }]
 * Devolve o elemento .caminho; depois de posto na tela, `decorar(cam)` desenha o cenário.
 */
function caminhoDe(nos, { mascote = false, desl = 0 } = {}) {
  const cam = document.createElement("div"); cam.className = "caminho xz-caminho";
  let atualIdx = -1;
  nos.forEach((n, i) => {
    const dx = DESLOC[(i + desl) % DESLOC.length];
    const w = document.createElement("div"); w.className = "no-wrap"; w.style.transform = `translateX(${dx}px)`;
    const b = document.createElement("button");
    b.className = `no ${n.cor || ""} ${n.feito ? "feito" : ""} ${n.liberado ? "" : "bloqueado"} ${n.atual ? "atual" : ""}`;
    b.style.setProperty("--k", i);
    b.setAttribute("aria-label", `${n.rotulo}${n.feito ? " (feito)" : n.liberado ? "" : " (bloqueado)"}`);
    b.innerHTML = `${icone(n.icone, "ico-no")}${n.atual ? '<span class="brilho-no"></span>' : ""}${n.firme ? `<span class="coroa-no">${icone("👑", "ico3d")}</span>` : n.feito ? '<span class="marca">✓</span>' : !n.liberado ? `<span class="marca cadeado">${icone("🔒", "ico3d")}</span>` : ""}`;
    if (n.atual) { atualIdx = i; w.insertAdjacentHTML("afterbegin", `<div class="balao-comecar">${escapar(n.balao || "Começar")}</div>`); }
    b.onclick = () => {
      if (!n.liberado) { b.classList.remove("nega"); void b.offsetWidth; b.classList.add("nega"); toast(n.nega || "Termine o passo anterior primeiro."); return; }
      tocar("toque"); n.abrir();
    };
    const rot = document.createElement("div"); rot.className = "rotulo-no"; rot.textContent = n.rotulo;
    w.append(b, rot); cam.append(w);
    if (n.atual && mascote) {
      const m = document.createElement("div"); m.className = "mascote-trilha";
      m.innerHTML = moli("feliz");
      m.onclick = () => { tocar("par"); m.innerHTML = moli("uau"); m.classList.add("pula"); setTimeout(() => { m.innerHTML = moli("feliz"); m.classList.remove("pula"); }, 900); };
      m.style.cssText = `position:absolute;${dx > 0 ? "right:118px" : "left:118px"};top:4px;width:78px`;
      w.append(m);
      if (!acenou) { acenou = true; setTimeout(() => { m.classList.add("acena"); setTimeout(() => m.classList.remove("acena"), 1400); }, 700); }
    }
  });
  cam._atual = atualIdx;
  return cam;
}
let acenou = false;
async function telaHoje(t) {
  const rep = await repertorio(), x = X(), hoje = hojeISO();
  x.treinoFeito ||= {};
  const plano = await planoDoDia(rep), feitos = plano.itens.filter(i => i.feito).length, tudo = feitos === plano.itens.length && plano.itens.length > 0;
  const total = todasLinhas(rep).length, aprendidas = Object.values(x.linhas).filter(v => v.vista).length, dominadas = Object.values(x.linhas).filter(v => (v.caixa || 0) >= 4).length;
  const per = periodoAgora(), frases = frasesXadrez(rep, plano.itens);
  const L = await licoes(), F = await finais();
  const capDe = (id) => rep.capitulos.find(c => c.id === id);
  const rotulo = (it) => {
    if (it.tipo === "rever") return `Revisar ${it.ids.length} ${it.ids.length === 1 ? "linha" : "linhas"}`;
    if (it.tipo === "aprender") return todasLinhas(rep).find(l => l.id === it.id)?.nome || "Linha nova";
    if (it.tipo === "trofeu") return `Troféu: ${capDe(it.cap)?.nome || ""}`;
    if (it.tipo === "desafio") return `Desafio: ${capDe(it.cap)?.nome || ""}`;
    if (it.tipo === "aula") return it.lic ? `Aula: ${L.find(l => l.id === it.lic)?.titulo || ""}` : `Final: ${F.find(f => f.id === it.fin)?.titulo || ""}`;
    if (it.tipo === "problemas") return `${it.ids.length} problemas${it.tema ? `: ${it.tema}` : ""}`;
    if (it.tipo === "erros") return "Seus erros das partidas";
    if (it.tipo === "desafioDia") return "Desafio do dia";
    if (it.tipo === "continuar") return `Continuar: ${todasLinhas(rep).find(l => l.id === it.linha)?.nome || "uma linha"}`;
    if (it.tipo === "corrida") return "Corrida de 3 minutos";
    if (it.tipo === "final") return `Praticar: ${F.find(f => f.id === it.fin)?.titulo || "um final"}`;
    return `Partida: ${nomeAdv(it.nivel, true)}`;
  };
  const balao = { aprender: "Aprender", rever: "Revisar", trofeu: "Troféu", desafio: "Desafio", aula: "Aula", problemas: "Resolver", erros: "Rever", partida: "Jogar", desafioDia: "Resolver", continuar: "Continuar", corrida: "Correr", final: "Praticar" };
  const atualDia = plano.itens.findIndex(i => !i.feito);
  // faixa do dia, como as dos Estudos
  t.innerHTML = `<div class="faixa ${per === "manha" ? "" : per} xz-faixa">${CAVALO}<div><h2>${tudo ? "Trilha de hoje feita!" : "Trilha de hoje"}</h2><p>${plano.itens.length} ${plano.itens.length === 1 ? "passo" : "passos"} · ~${Math.max(5, plano.min || 10)} min${feitos && !tudo ? ` · ${feitos} feitos` : ""}</p></div><span class="xz-seq">${I.fogo}${sequencia()}</span><span class="faixa-obj">${objetoSVG("cavalo")}</span></div>${faixaCiclo(plano)}`;
  const camDia = caminhoDe(plano.itens.map((it, i) => ({
    rotulo: rotulo(it) + (it.extra ? " · extra" : ""), icone: ICO_TIPO[it.tipo], cor: COR_TIPO[it.tipo], feito: !!it.feito,
    liberado: !!it.feito || i <= atualDia || atualDia < 0, atual: i === atualDia, balao: balao[it.tipo],
    nega: "Siga a trilha: termine o passo anterior primeiro.",
    abrir: () => abrirNo(it, rep),
  })), { mascote: true });
  t.append(camDia);
  const taca = document.createElement("button"); taca.className = `bau-trilha xz-taca ${tudo ? "aberto" : ""}`;
  taca.innerHTML = `${icone("🏆", "ico3d")}<small>${tudo ? `Trilha feita · ${sequencia()} ${sequencia() === 1 ? "dia" : "dias"} seguidos` : "Complete a trilha de hoje"}</small>`;
  taca.onclick = () => { tocar("toque"); toast(tudo ? "Amanhã tem outra trilha." : "Faça todos os passos de hoje para manter a sequência 🔥."); };
  t.append(taca);
  const caminhos = [{ cam: camDia, semente: `xz|${hoje}|dia` }];
  for (const c of caminhos) decorarCaminho(c.cam, { tema: "xadrez", semente: c.semente, frases, periodo: per, atualIdx: c.cam._atual, aoGanhar: () => {} });
}
/** Abre um nó da trilha de hoje. */
async function abrirNo(it, rep) {
  const x = X();
  if (["rever", "aprender", "trofeu", "desafio"].includes(it.tipo)) {
    if (it.feito) { // refazer: sem mexer no plano
      const copia = { ...it, feito: false };
      if (copia.tipo === "aprender") Object.assign(copia, { tipo: "rever", ids: [it.id] });
      return sessao([copia], { titulo: "De novo" });
    }
    return sessao([it], { plano: true, titulo: "Trilha de hoje" });
  }
  noDoDia = it.feito ? null : it;
  if (it.tipo === "desafioDia") return abrirDesafioDia(it.dia || hojeISO());
  if (it.tipo === "aula") {
    if (it.lic) { const L = await licoes(), lic = L.find(l => l.id === it.lic); if (lic) return fazerLicao(lic); }
    const F = await finais(), f = F.find(y => y.id === it.fin);
    if (f) return fazerLicao({ id: "fin-" + f.id, titulo: f.titulo, fonte: f.fonte, passos: f.passos });
    concluirNoDoDia(); return desenhar();
  }
  if (it.tipo === "problemas") {
    const P = await problemas(); if (!P) { toast("Os problemas ainda não chegaram."); return; }
    const { id } = semanaAtual(), s = it.semana ? x.semana[id] ||= { feitos: {} } : (x.probExtra?.dia === hojeISO() ? x.probExtra : (x.probExtra = { dia: hojeISO(), feitos: {} }));
    let ids = (it.ids || []).filter(k => P.problemas[k]);
    if (it.semana && ids.length < (it.ids || []).length) { // a lista do plano apontava para problemas que sumiram
      const { tema } = semanaAtual(), lista = listaDaSemana(P, s, tema, id, x.rating);
      ids = lista.filter(k => !(k in s.feitos)).slice(0, (it.ids || []).length || 5);
      if (ids.length) { it.ids = ids; salvar(); }
    }
    if (!ids.length) { toast("Esses problemas não estão mais no aparelho. O passo conta como feito."); concluirNoDoDia(); return desenhar(); }
    return resolverProblemas(ids, P, s);
  }
  if (it.tipo === "erros") {
    const dev = errosDevidos();
    const lista = dev.length ? dev : Object.entries(x.erros || {}).map(([k, e]) => ({ k, ...e })).sort(() => Math.random() - 0.5).slice(0, 5);
    if (!lista.length) { concluirNoDoDia(); return desenhar(); }
    return revisarErros(lista.slice(0, 5));
  }
  if (it.tipo === "continuar") {
    const l = todasLinhas(rep).find(y => y.id === it.linha);
    if (!l) { concluirNoDoDia(); return desenhar(); }
    return continuarJogo({ l });
  }
  if (it.tipo === "partida") {
    const l = it.linha ? todasLinhas(rep).find(y => y.id === it.linha) : null;
    return partida({ cor: it.cor, nivel: `M${escada().elo}`, linha: l });
  }
  if (it.tipo === "corrida") {
    const P = await problemas(); if (!P) { toast("Os problemas ainda não chegaram."); concluirNoDoDia(); return desenhar(); }
    return corrida(P);
  }
  if (it.tipo === "final") {
    const F = await finais(), f = F.find(y => y.id === it.fin);
    if (!f) { concluirNoDoDia(); return desenhar(); }
    return praticarFinal(f);
  }
}
/** A faixa do ciclo do dia, logo abaixo da faixa da trilha de hoje. */
function faixaCiclo(plano) {
  const x = X(), hoje = hojeISO(), c = CI.cicloDe(plano.ciclo);
  if (c) {
    const prox = CI.cicloDe(CI.proximoCiclo(c.id)), ex = CI.cicloDe(plano.extra);
    return `<div class="xz-ciclo" data-ciclo="${c.id}">${icone(c.icone, "ico3d")}<div><b>${escapar(c.nome)}</b><small>${escapar(c.sub)}</small>${ex ? `<small class="xz-ciclo-extra">+ um passo de ${escapar(ex.curto.toLowerCase())} (dia livre)</small>` : ""}</div><span class="xz-ciclo-prox">depois<b>${escapar(prox.curto)}</b></span></div>`;
  }
  if (plano.tam === "corrido") {
    const vez = CI.cicloDe(CI.cicloDaVez(x.ciclos.dias, hoje));
    return `<div class="xz-ciclo corrido" data-ciclo="">${icone("⏱️", "ico3d")}<div><b>Dia corrido</b><small>Só as revisões e o desafio do dia. O ${escapar(vez.nome.toLowerCase())} espera o próximo dia com tempo.</small></div></div>`;
  }
  if ((plano.v || 0) < 5) return `<div class="xz-ciclo" data-ciclo="">${icone("📅", "ico3d")}<div><b>Ciclos a partir de amanhã</b><small>Hoje vale a trilha que você já começou.</small></div></div>`;
  return "";
}

/** Roda os itens (do treino de hoje ou de um nó da trilha). O tempo conta em silêncio (resumo da semana). */
async function sessao(itens, { plano = false, titulo = "" } = {}) {
  const rep = await repertorio(), x = X(), hoje = hojeISO();
  itens = itens.filter(it => it && (it.ids?.length || it.id || it.cap));
  if (!itens.length) { toast("Nada para treinar agora."); return; }
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><div class="xz-s-barra"><i></i></div><span class="xz-s-tempo"></span></div>
    <div class="xz-s-tit"></div><div class="xz-s-tab"></div><div class="xz-quadros"></div><div class="xz-s-nota"></div><div class="xz-s-bts"></div>`);
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"));
  tab.posicao(new Chess().fen()); // o cartão da ideia aparece com o tabuleiro montado
  let ativo = true;
  const relogio = setInterval(() => { if (!ov.isConnected) { ativo = false; clearInterval(relogio); return; } if (ativo && document.visibilityState === "visible") { x.dias[hoje] = (x.dias[hoje] || 0) + 1; if (x.dias[hoje] % 60 === 0) salvar(); } }, 1000); // salvar (o estado inteiro, ~0,5 MB) só a cada minuto: os segundos são só para o resumo da semana
  const fechar = () => { ativo = false; clearInterval(relogio); salvar(); ov.remove(); desenhar(); };
  ov.querySelector(".xz-s-fechar").onclick = fechar;
  const linha = (id) => todasLinhas(rep).find(l => l.id === id);
  // as etapas: cada linha a jogar, com o modo
  const etapas = [];
  for (const it of itens) {
    if (it.feito && plano) continue;
    if (it.tipo === "aprender") etapas.push({ it, l: linha(it.id), modo: "aprender", cor: it.cor });
    else if (it.tipo === "rever") it.ids.forEach(id => {
      const l = linha(id); if (!l) return;
      // o lado do adversário (pedido do Alediov, 26/10/2026): "alternar" = uma revisão de cada lado; "sempre" = os dois;
      // "nunca" = só o seu; `it.cor` força um lado (Treinar → linha → "o lado do adversário")
      const pref = x.cfg.ladoAdv || "alternar", meu = ladoDe(l), r = x.linhas[id]?.revs || 0;
      if (it.cor) etapas.push({ it, l, modo: "rever", cor: it.cor });
      else if (pref === "sempre") { etapas.push({ it, l, modo: "rever", cor: meu, parcial: true }); etapas.push({ it, l, modo: "rever", cor: outraCor(meu) }); }
      else etapas.push({ it, l, modo: "rever", cor: pref === "alternar" && r % 2 === 1 ? outraCor(meu) : meu });
    });
    else if (it.tipo === "trofeu") nosDe(rep.capitulos.find(c => c.id === it.cap), rep).find(n => n.tipo === "trofeu" && n.sec === it.sec).linhas.forEach(l => etapas.push({ it, l, modo: "trofeu" }));
    else if (it.tipo === "desafio") { const ls = todasLinhas(rep).filter(l => l.cap.id === it.cap); for (const l of ls.sort(() => Math.random() - 0.5).slice(0, 5)) etapas.push({ it, l, modo: "desafio", cor: (x.cfg.ladoAdv || "alternar") !== "nunca" && Math.random() < 0.4 ? outraCor(ladoDe(l)) : ladoDe(l) }); }
  }
  const resultadoDesafio = new Map(), parciais = new Map();
  for (let e = 0; e < etapas.length && ativo; e++) {
    const { it, l, modo } = etapas[e];
    if (!l) continue;
    const cor = etapas[e].cor || ladoDe(l), adv = cor !== ladoDe(l);
    ov.querySelector(".xz-s-barra i").style.width = `${(e / etapas.length) * 100}%`;
    ov.querySelector(".xz-s-tempo").textContent = `${e + 1}/${etapas.length}`;
    const rot = { aprender: "Linha nova", rever: "Revisão", trofeu: "Troféu", desafio: "Desafio: uma tentativa" }[modo];
    const titulo2 = (c, a) => `<small>${rot} · ${escapar(l.cap.nome)} · ${c === "w" ? "você joga de brancas" : "você joga de pretas"}${a ? ` <em class="xz-adv">lado do adversário</em>` : ""}</small><b>${escapar(l.nome)}</b>`;
    ov.querySelector(".xz-s-tit").innerHTML = titulo2(cor, adv);
    let primeiraErros = null;
    if (modo === "aprender") {
      tab.virar(cor); tab.posicao(new Chess().fen()); tab.setas([]); tab.marcas({}); tab.selo(null); barraDaLinha(tab, l, 0);
      await cartaoIdeia(ov, l);
      if (!ativo) break;
      quadros(ov, l, cor);
      await jogarLinha(ov, tab, l, { guiado: true, cor, aoLance: (k, ok, aj) => pintarQuadro(ov, k, ok ? "ok" : aj ? "ajuda" : "erro") });
      if (!ativo) break;
      await aviso(ov, "Agora de memória, desde o início. Errou? Você vê a correção, termina a linha e começa de novo.");
    }
    if (!ativo) break;
    if (modo === "desafio") {
      quadros(ov, l, cor);
      if (adv) await aviso(ov, "Esta linha é do lado do adversário: jogue os lances dele.", "", null, "Começar");
      const er = await jogarLinha(ov, tab, l, { guiado: false, cor, aoLance: (k, ok, aj) => pintarQuadro(ov, k, ok ? "ok" : aj ? "ajuda" : "erro") });
      if (er == null) break;
      resultadoDesafio.set(l.id, er === 0);
      registrar(l, "rever", er);
      await aviso(ov, er ? `${er} ${er === 1 ? "erro" : "erros"} nesta linha.` : "Perfeita!", er ? "erro" : "ok");
      continue;
    }
    if (adv && modo !== "aprender") await aviso(ov, "Revisão do lado do adversário: agora você joga os lances dele. Lembrar as respostas do outro lado é metade da abertura.", "", null, "Começar");
    // até sair perfeita desde o início (na linha nova: primeiro o seu lado, depois o do adversário)
    const fases = modo === "aprender" && (x.cfg.ladoAdv || "alternar") !== "nunca" ? [cor, outraCor(cor)] : [cor];
    let errosTotal = 0;
    for (let f = 0; f < fases.length && ativo; f++) {
      const c = fases[f];
      if (f > 0) {
        const ehAdv = c !== ladoDe(l);
        ov.querySelector(".xz-s-tit").innerHTML = titulo2(c, ehAdv);
        if (ehAdv) await aviso(ov, "Agora troque de lado: jogue os lances do adversário, de memória.", "", "Para saber uma abertura, você precisa lembrar também o que o outro lado costuma jogar. O app faz os seus lances; você faz os dele.", "Trocar de lado");
        else await aviso(ov, "Agora o seu lado: jogue os seus lances, de memória.", "", "Você já viu as respostas do adversário; agora, as suas.", "Trocar de lado");
        if (!ativo) break;
      }
      let primeira = null;
      for (let tent = 1; ativo; tent++) {
        quadros(ov, l, c);
        const er = await jogarLinha(ov, tab, l, { guiado: false, cor: c, aoLance: (k, ok, aj) => pintarQuadro(ov, k, ok ? "ok" : aj ? "ajuda" : "erro") });
        if (er == null) { ativo = false; break; }
        if (primeira == null) primeira = er;
        if (!er) { await aviso(ov, tent === 1 ? "Perfeita de primeira!" : `Perfeita na ${tent}ª tentativa.`, "ok", f === fases.length - 1 ? l.ideia : null); break; }
        await aviso(ov, `${er} ${er === 1 ? "erro" : "erros"}. De novo, desde o início.`, "erro", null, "Recomeçar");
      }
      errosTotal += primeira || 0;
    }
    if (!ativo) break;
    primeiraErros = errosTotal;
    if (etapas[e].parcial) { parciais.set(l.id, primeiraErros); continue; } // "sempre os dois": registra depois do outro lado
    primeiraErros += parciais.get(l.id) || 0; parciais.delete(l.id);
    registrar(l, modo === "aprender" ? "aprender" : "rever", primeiraErros || 0);
    // item concluído quando a última linha dele termina
    if (plano && etapas.findLastIndex(x2 => x2.it === it) === e) { it.feito = true; salvar(); }
    if (modo === "trofeu" && etapas.findLastIndex(x2 => x2.it === it) === e) { x.trofeus ||= {}; x.trofeus[`${it.cap}-s${it.sec + 1}`] = hojeISO(); salvar(); confete?.(); tocar("combo"); }
  }
  if (!ativo) return;
  // desafio: 4 de 5 perfeitas passam
  const desafio = itens.find(i => i.tipo === "desafio");
  let txtFim = "";
  if (desafio) {
    const certas = [...resultadoDesafio.values()].filter(Boolean).length, n = resultadoDesafio.size;
    if (certas >= Math.min(4, n)) { x.desafios ||= {}; x.desafios[desafio.cap] = hojeISO(); confete?.(); tocar("combo"); txtFim = `Desafio vencido: ${certas} de ${n} perfeitas.`; }
    else txtFim = `${certas} de ${n} perfeitas: precisa de ${Math.min(4, n)}. As erradas voltam amanhã na revisão; tente o desafio de novo depois.`;
  }
  if (plano && desafio) desafio.feito = true; // na trilha de hoje, o desafio conta como feito ao ser tentado
  if (plano && conferirTrilhaFeita()) txtFim = `Trilha de hoje feita! ${sequencia()} ${sequencia() === 1 ? "dia" : "dias"} seguidos.`;
  salvar();
  ov.querySelector(".xz-s-barra i").style.width = "100%";
  ov.querySelector(".xz-s-tab").innerHTML = ""; ov.querySelector(".xz-quadros").innerHTML = ""; tab.barra?.remove();
  ov.querySelector(".xz-s-tit").innerHTML = `<b>${escapar(titulo || "Treino")}: pronto</b>`;
  ov.querySelector(".xz-s-nota").innerHTML = `<div class="xz-fim"><p>${escapar(txtFim || `${etapas.length} ${etapas.length === 1 ? "linha" : "linhas"} treinadas.`)}</p></div>`;
  ov.querySelector(".xz-s-bts").innerHTML = `<button class="botao">Fechar</button>`;
  ov.querySelector(".xz-s-bts .botao").onclick = fechar;
  if (!txtFim) tocar("fim");
}
// um quadradinho por lance seu (verde = de primeira, vermelho = errou e corrigiu), como no Lotus
const ladoDe = (l) => (l.cap.lado === "brancas" ? "w" : "b");
const outraCor = (c) => (c === "w" ? "b" : "w");
function quadros(ov, l, cor = null) {
  const meu = (cor || ladoDe(l)) === "w" ? 0 : 1, n = l.san.filter((_, i) => i % 2 === meu).length;
  ov.querySelector(".xz-quadros").innerHTML = Array.from({ length: n }, () => "<i></i>").join("");
}
function pintarQuadro(ov, k, cls) { const q = ov.querySelectorAll(".xz-quadros i")[k]; if (q) q.className = cls; }
function aviso(ov, texto, tipo = "", detalhe = null, botao = "Continuar") {
  return new Promise(ok => {
    ov.querySelector(".xz-s-nota").innerHTML = `<div class="xz-res ${tipo}"><b>${escapar(texto)}</b>${detalhe ? `<p>${escapar(detalhe)}</p>` : ""}</div>`;
    const bts = ov.querySelector(".xz-s-bts");
    bts.innerHTML = `<button class="botao">${escapar(botao)}</button>`;
    bts.querySelector(".botao").onclick = () => { bts.innerHTML = ""; ok(); };
  });
}
function registrar(l, tipo, erros) {
  const x = X(), hoje = hojeISO(), s = x.linhas[l.id] ||= { caixa: 0, acertos: 0, erros: 0 };
  if (!s.vista) { s.vista = true; s.vistaEm = hoje; }
  if (tipo === "rever") s.revs = (s.revs || 0) + 1; // alterna o lado nas revisões (lado do adversário)
  if (erros) { s.erros++; s.caixa = 0; } else { s.acertos++; s.caixa = Math.min(INTERVALOS.length - 1, (tipo === "aprender" ? 0 : (s.caixa || 0) + 1)); }
  s.proxima = somaDias(hoje, erros ? 1 : INTERVALOS[s.caixa]);
  s.ultima = hoje;
  salvar();
}
// ---------------------------------------------------------------- explicações (pedido do Alediov, 02/11/2026)
// Cada lance aparece nas duas notações: a do xadrez em português (Cxf3) e uma frase com o nome da peça ("As brancas
// capturam o peão em f3 com o cavalo."), mais o porquê do lance (o texto escrito no repertório ou, nos lances comuns, o
// motivo automático de notacao.js). Os termos do glossário vêm explicados na primeira vez; as setas azuis mostram o
// plano, as vermelhas a ameaça e as casas em destaque, as casas importantes do lance.
const notaLance = (l, ply) => { const n = l.notas?.[String(ply)]; return n == null ? null : typeof n === "string" ? { t: n } : n; };
function termosVistos() { return new Set(X().termosVistos || []); }
function guardarTermos(v) { const x = X(), antes = (x.termosVistos || []).length; if (v.size !== antes) { x.termosVistos = [...v]; salvar(); } }
/** O texto com os termos do glossário marcados (e explicados na primeira vez). */
function comTermos(txt) { const v = termosVistos(), h = marcarTermos(escapar(txt), v); guardarTermos(v); return h; }
/** A explicação do meio-lance `ply` da linha (1 = 1º lance das brancas). */
function explicacaoHTML(l, ply, { titulo = "", compacta = false } = {}) {
  const g = new Chess(); let mv = null, ant = null;
  for (let i = 0; i < ply && i < l.san.length; i++) { ant = mv; mv = g.move(l.san[i]); }
  if (!mv) return "";
  const n = notaLance(l, ply), porque = n?.t || porqueAutomatico(mv, ant);
  return `<div class="xz-expl ${compacta ? "compacta" : ""}"><div class="xz-expl-cab">${titulo ? `<small>${escapar(titulo)}</small>` : ""}<b class="xz-not">${escapar(lanceNumerado(mv.san, ply - 1))}</b></div><p class="xz-frase">${escapar(fraseLance(mv))}</p>${porque ? `<p class="xz-porque">${comTermos(porque)}</p>` : ""}</div>`;
}
/** As setas e casas da explicação do meio-lance `ply` no tabuleiro (mais as `extra`). */
function ideiaNoTab(tab, l, ply, extra = []) {
  const n = X().cfg.explicar === false ? null : notaLance(l, ply);
  const seta = (u, cor) => ({ de: u.slice(0, 2), para: u.slice(2, 4), cor });
  tab.setas([...extra, ...(n?.s || []).map(u => seta(u, "azul")), ...(n?.a || []).map(u => seta(u, "vermelha"))]);
  tab.marcas(Object.fromEntries((n?.c || []).map(c => [c, "ideia"])));
}
/** A barra de avaliação do repertório (avaliações do Stockfish, guardadas no JSON) no meio-lance `ply`. */
function barraDaLinha(tab, l, ply) {
  if (X().cfg.barra !== false && l.av?.[ply] != null) tab.avaliacao(avDoNumero(l.av[ply]));
  else tab.avaliacao(false);
}
const NOMES_SELO = Object.fromEntries(Object.entries(SELOS).map(([k, v]) => [k, v.nome]));
const seloHTML = (tipo) => `<i class="xz-selo-in ${tipo}">${SELOS[tipo]?.svg || ""}</i>`;
const txtPerda = (p) => (p >= 1 ? `a chance de vencer cai ${Math.round(p)} ${Math.round(p) === 1 ? "ponto" : "pontos"}` : "quase não muda a avaliação");

function cartaoIdeia(ov, l) {
  return new Promise(ok => {
    const nota = ov.querySelector(".xz-s-nota"), bts = ov.querySelector(".xz-s-bts");
    const x = X(); x.capsVistos ||= {};
    const resumo = !x.capsVistos[l.cap.id] ? `<details class="xz-resumo-cap" open><summary>O capítulo: ${escapar(l.cap.nome)}</summary><p>${comTermos(l.cap.resumo || "")}</p></details>` : "";
    x.capsVistos[l.cap.id] = hojeISO();
    nota.innerHTML = `<div class="xz-ideia">${resumo}<small>${escapar(l.eco)} · ${escapar(l.nomeLichess)}</small><p>${comTermos(l.ideia)}</p><p class="xz-dica-g">Primeiro, siga as setas: a verde é o lance; as azuis, o plano; as vermelhas, as ameaças. Depois, de memória.</p></div>`;
    bts.innerHTML = `<button class="botao">Ver a linha</button>`;
    bts.querySelector(".botao").onclick = () => { bts.innerHTML = ""; ok(); };
  });
}
/**
 * Joga uma linha: o app faz os lances do adversário; você, os seus. Guiado: a seta verde mostra o lance e a explicação
 * vem antes (a do lance do adversário e a do seu). De memória: um erro marca a casa, mostra a classificação do seu lance
 * (Imprecisão, Erro… ou "também é bom, mas não é o da linha"), o lance certo em seta verde com a explicação, e espera
 * você jogá-lo. "Rever a explicação" abre a linha inteira por cima (conta como ajuda: o lance fica âmbar e vale como
 * erro na revisão). `aoLance(k, deprimeira, ajuda)` a cada lance seu. Devolve o número de erros (null se fechou).
 */
async function jogarLinha(ov, tab, l, { guiado, aoLance = () => {}, cor = null }) {
  const x = X(), meu = cor || ladoDe(l);
  const g = new Chess();
  tab.virar(meu); tab.posicao(g.fen()); tab.setas([]); tab.marcas({}); tab.selo(null);
  barraDaLinha(tab, l, 0);
  const nota = ov.querySelector(".xz-s-nota"), bts = ov.querySelector(".xz-s-bts");
  const AGORA = `<p class="xz-agora">Jogue o lance que você aprendeu</p>`;
  nota.innerHTML = guiado ? "" : AGORA;
  let erros = 0, k = 0, vez = 0;
  for (let i = 0; i < l.san.length; i++) {
    if (!ov.isConnected) { bts.innerHTML = ""; return null; }
    const vezDe = g.turn(), uci = l.uci[i], de = uci.slice(0, 2), para = uci.slice(2, 4);
    if (vezDe !== meu) {
      await dormir(i === 0 ? 450 : 520);
      if (!ov.isConnected) return null;
      const mv = g.move(l.san[i]);
      tab.posicao(g.fen(), { ultimo: [mv.from, mv.to], xeque: g.inCheck() ? reiEm(g) : null });
      if (x.cfg.selos !== false) tab.selo(mv.to, "livro");
      barraDaLinha(tab, l, i + 1);
      tocar("toque");
      if (guiado && i === l.san.length - 1) { nota.innerHTML = explicacaoHTML(l, i + 1, { titulo: "O lance do adversário" }); ideiaNoTab(tab, l, i + 1); }
      continue;
    }
    if (guiado) {
      nota.innerHTML = (i > 0 ? explicacaoHTML(l, i, { titulo: "O lance do adversário", compacta: true }) : "") + explicacaoHTML(l, i + 1, { titulo: "O seu lance" });
      ideiaNoTab(tab, l, i + 1, [{ de, para }]);
    }
    let errouAqui = false, ajudouAqui = false;
    const minhaVez = ++vez;
    // "voltar ao aprendizado quando tiver dúvidas" (pedido do Alediov, 02/11/2026)
    if (!guiado) {
      bts.innerHTML = `<button class="botao secundario xz-ajuda">${I.livro}<span>Rever a explicação</span></button>`;
      bts.querySelector(".xz-ajuda").onclick = async () => {
        await verLinha(l, { ate: i, cor: meu, ajuda: true });
        if (!ov.isConnected || minhaVez !== vez) return;
        if (!errouAqui) { errouAqui = true; ajudouAqui = true; erros++; }
        nota.innerHTML = `<p class="xz-agora">Com ajuda: jogue o lance da linha (conta como um erro na revisão)</p>`;
      };
    }
    await new Promise(ok => {
      const legais = (casa) => g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }));
      tabConfig(tab, {
        legais, podeMexer: (c) => c === meu,
        aoMover: (a, b, promo) => {
          if (a === de && b === para) {
            const mv = g.move({ from: a, to: b, promotion: promo || uci[4] });
            tab.setas([]); tab.marcas({});
            tab.posicao(g.fen(), { ultimo: [mv.from, mv.to], xeque: g.inCheck() ? reiEm(g) : null });
            if (x.cfg.selos !== false) tab.selo(mv.to, "livro");
            barraDaLinha(tab, l, i + 1);
            tocar("certo");
            aoLance(k++, !errouAqui, ajudouAqui);
            if (errouAqui && !guiado) nota.innerHTML = AGORA;
            bts.innerHTML = "";
            ok();
          } else {
            if (!errouAqui) { errouAqui = true; erros++; }
            tocar("errado"); vibrar(60); tab.tremer();
            tab.marcas({ [b]: "errado" });
            const certo = sanPT((() => { try { return new Chess(g.fen()).move({ from: de, to: para, promotion: uci[4] }).san; } catch { return l.san[i]; } })());
            const fen = g.fen(), tentativa = a + b + (promo || "");
            let jogado = "";
            try { jogado = sanPT(new Chess(fen).move({ from: a, to: b, promotion: promo }).san); } catch { /* lance que o tabuleiro aceitou */ }
            setTimeout(() => {
              if (!ov.isConnected) return;
              ideiaNoTab(tab, l, i + 1, [{ de, para, cor: "verde" }]);
              nota.innerHTML = `<div class="xz-errou"><p class="xz-nota-lance erro">O lance da linha é <b>${escapar(certo)}</b> (seta verde).<span class="xz-classe-tent"></span></p>${explicacaoHTML(l, i + 1)}</div>`;
            }, 300);
            // a classificação do lance tentado (o Stockfish do app confere; não segura o treino)
            if (x.cfg.selos !== false || x.cfg.barra !== false) {
              aquecer();
              avaliarLance(fen, tentativa, { prof: 10 }).then(r => {
                if (!ov.isConnected || minhaVez !== vez || g.fen() !== fen) return;
                if (x.cfg.selos !== false) tab.selo(b, r.tipo);
                if (x.cfg.barra !== false) tab.avaliacao(r.av);
                const el = nota.querySelector(".xz-classe-tent");
                if (el) el.innerHTML = ["melhor", "excelente", "bom", "otimo", "brilhante"].includes(r.tipo)
                  ? ` ${seloHTML(r.tipo)} O seu ${escapar(jogado)} também ${r.tipo === "melhor" ? "é o melhor lance para o computador" : r.tipo === "bom" ? "é um bom lance" : `é ${escapar(NOMES_SELO[r.tipo].toLowerCase())}`}, mas não é o da linha: aqui você treina a linha do repertório.`
                  : ` ${seloHTML(r.tipo)} O seu ${escapar(jogado)} seria ${r.tipo === "erro" ? "um erro" : r.tipo === "imprecisao" ? "uma imprecisão" : "uma capivarada"}: ${txtPerda(r.perda)}.`;
              }).catch(() => {});
            }
          }
        },
      });
    });
  }
  bts.innerHTML = "";
  return erros;
}
// o tabuleiro recebe as funções por um objeto mutável (mais simples que recriar)
function tabConfig(tab, f) { tab._f = f; }
function reiEm(g) { const b = g.board(); for (const l of b) for (const p of l) if (p && p.type === "k" && p.color === g.turn()) return p.square; return null; }

function resultadoLinha(ov, l, erros, ultimo) {
  return new Promise(ok => {
    const nota = ov.querySelector(".xz-s-nota"), bts = ov.querySelector(".xz-s-bts");
    nota.innerHTML = `<div class="xz-res ${erros ? "erro" : "ok"}"><b>${erros ? `${erros} erro${erros > 1 ? "s" : ""}: volta amanhã` : "Linha certa!"}</b><p>${escapar(l.ideia)}</p></div>`;
    if (!erros) { vibrar(30); }
    bts.innerHTML = `<button class="botao">${ultimo ? "Concluir" : "Próxima"}</button>`;
    bts.querySelector(".botao").onclick = () => { bts.innerHTML = ""; ok(); };
  });
}
function pergunta(ov, texto, opcoes) {
  return new Promise(ok => {
    ov.querySelector(".xz-s-nota").innerHTML = `<p class="xz-agora">${escapar(texto)}</p>`;
    const bts = ov.querySelector(".xz-s-bts");
    bts.innerHTML = opcoes.map((o, i) => `<button class="botao ${i ? "" : "secundario"}" data-i="${i}">${escapar(o)}</button>`).join("");
    bts.querySelectorAll("button").forEach(b => (b.onclick = () => { bts.innerHTML = ""; ok(+b.dataset.i); }));
  });
}
function camada(html, classe = "") {
  const ov = document.createElement("div"); ov.className = `xz-camada ${classe}`;
  ov.innerHTML = html; raiz.append(ov);
  requestAnimationFrame(() => { ov.classList.add("aberta"); raiz._verFundo?.(); });
  return ov;
}

// ---------------------------------------------------------------- Jogar
const MAIA_ELOS = [1100, 1500, 1900];
/** "M1500" = Maia de 1500; número = nível do Stockfish. */
const nomeAdv = (nivel, curto = false) => String(nivel).startsWith("M") ? `${curto ? "" : "Como gente · "}Maia ${String(nivel).slice(1)}` : `${curto ? "nível " + nivel : "Computador · " + (M.NIVEIS.find(n => n.n === nivel)?.nome || "")}`;
// acorda o motor de antemão (o 1º lance e a 1ª dica não esperam carregar)
function aquecer(nivel = null) {
  M.iniciar().catch(e => console.warn("Stockfish:", e));
  if (String(nivel || "").startsWith("M")) import("./maia.js").then(m => m.prepararMaia(+String(nivel).slice(1))).catch(() => {});
}
async function partida({ cor, nivel, linha, relogio = "" }) {
  aquecer(nivel);
  const g = new Chess();
  if (linha) for (const s of linha.san) g.move(s);
  const rel = relogio ? relogio.split("+").map(Number) : null; // [minutos, acréscimo em s]
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Sair">${I.fechar}</button><span class="xz-p-tit">${escapar(nomeAdv(nivel))}</span><span class="xz-pensando" hidden>pensando…</span></div>
    ${rel ? `<div class="xz-relogio ele"><b></b><span class="xz-mat-c ele"></span><small>${escapar(nomeAdv(nivel, true))}</small></div>` : `<div class="xz-mat-l ele"></div>`}
    <div class="xz-s-tab"></div>${rel ? `<div class="xz-relogio eu"><b></b><span class="xz-mat-c eu"></span><small>Você · ${rel[0]}${rel[1] ? `+${rel[1]}` : " min"}</small></div>` : `<div class="xz-mat-l eu"></div>`}<div class="xz-lances"></div><div class="xz-s-nota"></div>
    <div class="xz-p-bts">${rel ? "" : `<button data-a="desfazer">${I.desfazer}<span>Voltar</span></button><button data-a="dica">${I.dica}<span>Dica</span></button>`}<button data-a="virar">${I.virar}<span>Virar</span></button><button data-a="desistir">${I.fechar}<span>Desistir</span></button></div>`, rel ? "partida com-relogio" : "partida");
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"), { orientacao: cor, barraDepois: ov.querySelector(".xz-relogio.eu, .xz-mat-l.eu") });
  const nota = ov.querySelector(".xz-s-nota"), lancesEl = ov.querySelector(".xz-lances");
  let fim = false, pensando = false;
  // relógio: corre o de quem tem a vez; o acréscimo entra depois de cada lance; o do computador corre enquanto ele pensa
  const tempo = rel ? { w: rel[0] * 60000, b: rel[0] * 60000 } : null;
  let tickAnt = Date.now(), tick = null;
  const fmt = (ms) => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return ms < 10000 ? `${Math.floor(ms / 1000)},${Math.floor((ms % 1000) / 100)}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const pintarRelogio = () => {
    if (!tempo) return;
    const adv = cor === "w" ? "b" : "w";
    for (const [cls, c] of [["eu", cor], ["ele", adv]]) {
      const el = ov.querySelector(`.xz-relogio.${cls}`); if (!el) continue;
      el.querySelector("b").textContent = fmt(tempo[c]);
      el.classList.toggle("ativo", !fim && g.turn() === c); el.classList.toggle("pouco", tempo[c] < 20000);
    }
  };
  const acrescimo = (c) => { if (tempo) tempo[c] += rel[1] * 1000; };
  if (tempo) {
    tick = setInterval(() => {
      if (!ov.isConnected) { clearInterval(tick); return; }
      const agora = Date.now(), dt = agora - tickAnt; tickAnt = agora;
      if (fim) return;
      tempo[g.turn()] -= dt; pintarRelogio();
      if (tempo[g.turn()] <= 0) { tempo[g.turn()] = 0; pintarRelogio(); terminar(g.turn() === cor ? "d" : "v", g.turn() === cor ? "O seu tempo acabou." : "O tempo do computador acabou: vitória!"); }
    }, 100);
  }
  const historico = () => g.history({ verbose: true });
  const mostrar = () => {
    const h = historico(), u = h[h.length - 1];
    tab.posicao(g.fen(), { ultimo: u ? [u.from, u.to] : null, xeque: g.inCheck() ? reiEm(g) : null });
    // peças capturadas e o placar de material (peão 1, cavalo e bispo 3, torre 5, dama 9)
    const mat = materialDe(g.fen());
    for (const [k, c] of [["ele", cor === "w" ? "b" : "w"], ["eu", cor]]) { const el = ov.querySelector(`.xz-mat-l.${k}, .xz-mat-c.${k}`); if (el) el.innerHTML = htmlMaterial(mat, c, classesVisual()); }
    const sans = g.history();
    lancesEl.innerHTML = sans.map((s, i) => `${i % 2 === 0 ? `<i>${i / 2 + 1}.</i>` : ""}<span>${escapar(sanPT(s))}</span>`).join(" ");
    lancesEl.scrollLeft = lancesEl.scrollWidth;
  };
  const acabou = () => {
    if (!g.isGameOver()) return false;
    fim = true;
    let res = "e", txt = "Empate";
    if (g.isCheckmate()) { res = g.turn() === cor ? "d" : "v"; txt = res === "v" ? "Xeque-mate! Você venceu." : "Xeque-mate. O computador venceu."; }
    else if (g.isStalemate()) txt = "Empate por afogamento.";
    else if (g.isThreefoldRepetition()) txt = "Empate por repetição.";
    else if (g.isInsufficientMaterial()) txt = "Empate: material insuficiente.";
    terminar(res, txt);
    return true;
  };
  const terminar = (res, txt) => {
    if (tick) clearInterval(tick);
    fim = true; tab.bloquear(true); pintarRelogio();
    const x = X();
    x.partidas.push({ data: new Date().toISOString(), cor, nivel, resultado: res, lances: Math.ceil(g.history().length / 2), linha: linha?.id || null, ...(relogio ? { relogio } : {}) });
    x.partidas = x.partidas.slice(-60); salvar();
    tocar(res === "v" ? "fim" : "toque");
    const subiu = subirEscada(nivel, res);
    if (!(txt === "Você desistiu." && g.history().length < 16)) concluirNoDoDia(); // partida da trilha de hoje
    nota.innerHTML = `<div class="xz-res ${res === "v" ? "ok" : res === "d" ? "erro" : ""}"><b>${escapar(txt)}</b>${subiu ? `<p class="xz-subiu">🪜 ${escapar(subiu)}</p>` : ""}<p>Veja onde a partida virou: o computador confere cada lance seu.</p></div>`;
    ov.querySelector(".xz-p-bts").innerHTML = `<button data-a="analisar">${I.dica}<span>Ver os meus erros</span></button><button data-a="nova">${I.virar}<span>Nova partida</span></button><button data-a="sair">${I.fechar}<span>Sair</span></button>`;
    ov.querySelector('[data-a="analisar"]').onclick = () => analisarPartida(ov, g, cor, tab);
    ov.querySelector('[data-a="nova"]').onclick = () => { ov.remove(); partida({ cor, nivel: proximoNivel(nivel), linha, relogio }); };
    ov.querySelector('[data-a="sair"]').onclick = () => { ov.remove(); desenhar(); };
  };
  const vezDoComputador = async () => {
    if (fim || g.turn() === cor) return;
    pensando = true; ov.querySelector(".xz-pensando").hidden = false; tab.bloquear(true);
    const ini = Date.now();
    let uci;
    try {
      if (String(nivel).startsWith("M")) uci = (await (await import("./maia.js")).lanceMaia(g, +String(nivel).slice(1)))?.lan;
      else uci = await M.lanceDoNivel(g.fen(), nivel);
    } catch (e) { toast("O motor falhou: " + e.message); pensando = false; return; }
    // com relógio, o computador "pensa" um tempo de gente (o relógio dele corre)
    const alvo = rel ? Math.min(tempo[g.turn()] / 25, (rel[0] >= 10 ? 1500 : 700) + Math.random() * (rel[0] >= 10 ? 3500 : 1600)) : 450;
    await new Promise(ok => setTimeout(ok, Math.max(0, alvo - (Date.now() - ini))));
    if (!ov.isConnected || fim) return;
    acrescimo(g.turn());
    g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    tocar("toque");
    pensando = false; ov.querySelector(".xz-pensando").hidden = true; tab.bloquear(false);
    mostrar(); acabou();
  };
  tabConfig(tab, {
    legais: (casa) => (fim || pensando ? [] : g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }))),
    podeMexer: (c) => c === cor,
    aoMover: (a, b, promo) => {
      if (fim) return;
      const quem = g.turn();
      try { g.move({ from: a, to: b, promotion: promo }); } catch { return; }
      acrescimo(quem); pintarRelogio();
      tab.setas([]); nota.innerHTML = "";
      mostrar();
      if (!acabou()) vezDoComputador();
    },
  });
  ov.querySelector(".xz-s-fechar").onclick = () => { if (tick) clearInterval(tick); ov.remove(); desenhar(); };
  ov.querySelector(".xz-p-bts").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b || fim) return;
    const a = b.dataset.a;
    if (a === "virar") { tab.virar(); mostrar(); }
    if (a === "desfazer" && !pensando) { g.undo(); if (g.turn() !== cor) g.undo(); mostrar(); nota.innerHTML = ""; }
    if (a === "dica" && !pensando && g.turn() === cor) {
      nota.innerHTML = `<p class="xz-nota-lance">Pensando na dica…</p>`;
      const r = await M.analisar(g.fen(), { prof: 14 });
      tab.setas([{ de: r.melhor.slice(0, 2), para: r.melhor.slice(2, 4), cor: "azul" }]);
      nota.innerHTML = `<p class="xz-nota-lance">Seta azul: o lance que o Stockfish jogaria. ${avaliacaoTexto(r, g.turn())}</p>`;
    }
    if (a === "desistir") terminar("d", "Você desistiu.");
  });
  mostrar(); pintarRelogio();
  if (g.turn() !== cor) vezDoComputador();
}
function avaliacaoTexto(r, vez) {
  if (r.mate != null) return r.mate > 0 ? `Há mate em ${r.mate}.` : `O adversário tem mate em ${-r.mate}.`;
  if (r.cp == null) return "";
  const v = r.cp / 100;
  if (Math.abs(v) < 0.4) return "A posição está equilibrada.";
  return v > 0 ? `Você está melhor (+${v.toFixed(1)}).` : `Você está pior (${v.toFixed(1)}).`;
}
// confere cada lance seu: perda de 1,5 peão ou mais é erro grave; de 0,7, imprecisão
async function analisarPartida(ov, g, cor, tab) {
  const nota = ov.querySelector(".xz-s-nota"), h = g.history({ verbose: true }), aux = new Chess();
  if (h[0]?.before) aux.load(h[0].before);
  const achados = [];
  nota.innerHTML = `<p class="xz-nota-lance">Conferindo os lances… <b class="xz-prog">0%</b></p>`;
  const nota0 = notaR;
  const curva = new Array(h.length + 1).fill(null); // avaliação (das brancas) de cada posição da partida
  const brancas = (v, vez) => (vez === "w" ? v : -v);
  // precisão por lance como a do lichess: pela queda na chance de vencer
  const chance = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp)))) - 1), precisoes = [];
  for (let i = 0; i < h.length; i++) {
    const m = h[i];
    if (m.color === cor) {
      const antes = await M.analisar(m.before, { prof: 10 });
      const depois = await M.analisar(m.after, { prof: 10 });
      curva[i] = brancas(nota0(antes), m.color); curva[i + 1] = brancas(nota0(depois), m.color === "w" ? "b" : "w");
      const perda = nota0(antes) - (-nota0(depois));
      precisoes.push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, chance(nota0(antes)) - chance(-nota0(depois)))) - 3.1669)));
      if (perda >= 70 && antes.melhor !== m.from + m.to + (m.promotion || "")) {
        const aux2 = new Chess(m.before), melhorSan = (() => { try { return aux2.move({ from: antes.melhor.slice(0, 2), to: antes.melhor.slice(2, 4), promotion: antes.melhor[4] }).san; } catch { return antes.melhor; } })();
        achados.push({ i, lance: `${Math.floor(i / 2) + 1}${m.color === "w" ? "." : "..."} ${sanPT(m.san)}`, melhor: melhorSan, perda, fen: m.before, de: antes.melhor.slice(0, 2), para: antes.melhor.slice(2, 4), meu: [m.from, m.to], uci: antes.melhor, cp: nota0(antes), meuSan: m.san });
      }
    }
    const pr = nota.querySelector(".xz-prog"); if (pr) pr.textContent = `${Math.round(((i + 1) / h.length) * 100)}%`;
    if (!ov.isConnected) return;
  }
  for (let i = 1; i < curva.length; i++) if (curva[i] == null) curva[i] = curva[i - 1];
  const precisao = precisoes.length ? Math.round(precisoes.reduce((a, b) => a + b, 0) / precisoes.length) : null;
  const reg = X().partidas.at(-1);
  if (reg && precisao != null && reg.lances === Math.ceil(h.length / 2)) { reg.precisao = precisao; reg.erros = achados.length; salvar(); }
  const txtPrec = precisao != null ? `<p class="xz-precisao">Precisão: <b>${precisao}%</b></p>` : "";
  if (curva[0] == null) curva[0] = curva.find(v => v != null) ?? 0;
  const fens = [...h.map(m => m.before), h.at(-1)?.after].filter(Boolean);
  const grafico = graficoAvaliacao(curva, achados.map(a => a.i), cor);
  if (!achados.length) { nota.innerHTML = `${grafico}${txtPrec}<div class="xz-res ok"><b>Nenhum erro grave!</b><p>Nenhum lance seu perdeu mais que meio peão de vantagem.</p></div>`; ligarGrafico(nota, fens, h, tab); return; }
  const guardados = guardarErros(achados);
  nota.innerHTML = `${grafico}${txtPrec}<div class="xz-erros"><b>${achados.length} lance${achados.length > 1 ? "s" : ""} para rever</b>${guardados ? `<p class="xz-dica-g">${guardados === 1 ? "1 posição foi" : `${guardados} posições foram`} para o treino "Seus erros" (na trilha de hoje e em Treinar).</p>` : ""}${achados.map((a, k) => `<button data-k="${k}"><span class="${a.perda >= 150 ? "grave" : "impreciso"}">${a.perda >= 150 ? "??" : "?!"}</span>${escapar(a.lance)}<small>melhor: ${escapar(sanPT(a.melhor))}</small></button>`).join("")}</div>`;
  ligarGrafico(nota, fens, h, tab);
  nota.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => {
    const a = achados[+b.dataset.k];
    tab.posicao(a.fen); tab.setas([{ de: a.meu[0], para: a.meu[1], cor: "vermelha" }, { de: a.de, para: a.para, cor: "verde" }]);
    nota.querySelectorAll("[data-k]").forEach(x => x.classList.toggle("on", x === b));
  }));
}

// ---------------------------------------------------------------- Semana: problemas do tema
export const SEMANAS = [
  { titulo: "Garfos", temas: ["garfo"], texto: "Garfo é uma peça atacando duas ao mesmo tempo. O cavalo é o rei dos garfos (ele ataca em 'L' e ninguém bloqueia). Procure casas de onde uma peça sua ataque o rei e outra peça, ou duas peças sem proteção." },
  { titulo: "Mates em 1 e em 2", temas: ["mate1", "mate2"], texto: "Antes de qualquer lance, olhe os xeques. Um mate é um xeque de que o rei não consegue escapar: veja as casas de fuga do rei e quem as controla." },
  { titulo: "Cravadas e espetos", temas: ["cravada", "espeto"], texto: "Cravada: a peça atacada não pode sair porque descobriria uma mais valiosa atrás (ou o rei). Espeto é o contrário: a valiosa está na frente, sai, e você ganha a de trás. Bispos, torres e damas fazem os dois." },
  { titulo: "Finais de peões", temas: ["finalPeoes"], texto: "Nos finais de peões, o rei é uma peça de ataque: centralize-o. Aprenda a 'oposição' (reis frente a frente com uma casa entre eles: quem não tem a vez leva vantagem) e a regra do quadrado do peão." },
  { titulo: "Táticas da sua Siciliana", temas: ["sicilianaQuatroCavalos", "sicilianaTaimanov", "sicilianaOutras", "sicilianaAlapin"], texto: "Problemas tirados de partidas reais com a Siciliana. Repare nos padrões: o cavalo em d4, a cravada do bispo em b4 contra o cavalo de c3, a coluna c aberta e a ruptura ...d5." },
  { titulo: "Descobertos e xeque duplo", temas: ["descoberto", "xequeDuplo"], texto: "Ataque descoberto: uma peça sai da frente e outra, atrás, passa a atacar. Se as duas dão xeque (xeque duplo), o rei é obrigado a fugir: nenhuma captura ou bloqueio resolve." },
  { titulo: "Mate no corredor", temas: ["corredor", "mate2"], texto: "O rei roqueado atrás dos três peões não tem casa de fuga: uma torre ou dama na última fileira dá mate. Por isso, nas suas partidas, às vezes vale abrir uma 'janela' (h3 ou h6)." },
  { titulo: "Peças penduradas e presas", temas: ["pendurada", "presa"], texto: "Peça pendurada é a que está atacada e sem proteção suficiente: conte atacantes e defensores. Peça presa é a que não tem para onde fugir; aí basta atacá-la." },
  { titulo: "Finais de torre", temas: ["finalTorre"], texto: "Os finais mais comuns de todos. Torre ativa vale mais que peão; a torre fica atrás do peão passado (o seu ou o do adversário); e o rei vai para a frente." },
  { titulo: "Táticas das suas aberturas de brancas", temas: ["escocesa", "francesaAvanco", "caroKannAvanco", "escandinava", "pircModerna", "alekhine", "petrovPhilidor", "italiana"], texto: "Problemas de partidas com as aberturas que você joga de brancas com 1.e4: a Escocesa e o avanço contra a Francesa e a Caro-Kann. Repare no ponto f7, nas diagonais dos bispos e nos ataques ao rei." },
  { titulo: "Desvio e atração", temas: ["desvio", "atracao"], texto: "Desvio: obrigar uma peça defensora a sair do lugar. Atração: atrair uma peça (muitas vezes o rei) para uma casa ruim com um sacrifício. Os dois abrem caminho para o golpe final." },
  { titulo: "Táticas do Gambito da Dama, do London e da Grünfeld", temas: ["gambitoDamaRecusado", "gambitoDamaAceito", "eslava", "londres", "grunfeld"], texto: "Problemas de partidas com o Gambito da Dama e o London (as suas aberturas de brancas com 1.d4) e com a Grünfeld (a sua defesa). Atenção à coluna c, ao peão de d5, às cravadas do bispo em g5 e à diagonal grande do bispo em g7." },
  { titulo: "Peões avançados e promoção", temas: ["peaoAvancado"], texto: "Um peão perto da promoção vale quase uma dama. Procure sacrifícios que tiram o bloqueador e veja se o rei adversário alcança o peão (regra do quadrado)." },
  { titulo: "Sacrifícios", temas: ["sacrificio", "mate3"], texto: "Dar material para ganhar mais (ou dar mate). Calcule até o fim: um sacrifício só funciona se todas as respostas perdem." },
  { titulo: "Lance intermediário e defesa", temas: ["intermediario", "defesa"], texto: "Antes de recapturar no automático, procure um lance mais forte no meio (um xeque, uma ameaça). E, na defesa, ache o único lance que segura a posição." },
];
const POR_SEMANA = 20;
// os temas do Lichess que valem mostrar (os de duração e "vantagem" ficam de fora)
const TEMAS_PT = { mate: "mate", mateIn1: "mate em 1", mateIn2: "mate em 2", mateIn3: "mate em 3", mateIn4: "mate em 4", fork: "garfo", pin: "cravada", skewer: "espeto",
  discoveredAttack: "ataque descoberto", doubleCheck: "xeque duplo", hangingPiece: "peça pendurada", trappedPiece: "peça presa", deflection: "desvio", attraction: "atração",
  sacrifice: "sacrifício", defensiveMove: "lance defensivo", advancedPawn: "peão avançado", promotion: "promoção", intermezzo: "lance intermediário", backRankMate: "mate no corredor",
  smotheredMate: "mate sufocado", clearance: "abertura de linha", interference: "interferência", xRayAttack: "raio X", zugzwang: "zugzwang", quietMove: "lance calmo",
  capturingDefender: "captura do defensor", exposedKing: "rei exposto", kingsideAttack: "ataque na ala do rei", queensideAttack: "ataque na ala da dama",
  pawnEndgame: "final de peões", rookEndgame: "final de torre", queenEndgame: "final de dama", bishopEndgame: "final de bispo", knightEndgame: "final de cavalo",
  endgame: "final", middlegame: "meio-jogo", opening: "abertura", equality: "salvar o empate", enPassant: "en passant", castling: "roque", underPromotion: "subpromoção" };
function semanaAtual() {
  const d = new Date(hojeISO() + "T12:00:00"), ini = new Date(d); ini.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const id = ini.toISOString().slice(0, 10), n = Math.round((ini - new Date("2026-10-19T12:00:00")) / (7 * 864e5)); // a semana de 19/10/2026 é a 1ª
  return { id, tema: SEMANAS[((n % SEMANAS.length) + SEMANAS.length) % SEMANAS.length] };
}
function escolherProblemas(P, tema, id, rating) {
  // os da semana: ~20 dos temas, perto do seu nível (de -250 a +200), estáveis na semana
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const ids = [...new Set(tema.temas.flatMap(t => P.temas[t] || []))];
  const perto = ids.filter(k => { const r = P.problemas[k][2]; return r >= rating - 250 && r <= rating + 200; });
  const base = perto.length >= POR_SEMANA ? perto : ids;
  return base.map((k, i) => [k, ((h ^ (i * 2654435761)) >>> 0) % 100000]).sort((a, b) => a[1] - b[1]).slice(0, POR_SEMANA).map(x => x[0]).sort((a, b) => P.problemas[a][2] - P.problemas[b][2]);
}
/**
 * A lista de problemas da semana sem os que não existem mais (bug de 04/11/2026: problemas.json foi refeito em 02/11 e
 * a lista da semana, montada antes, apontava para problemas que sumiram; o tabuleiro abria vazio). Completa até
 * POR_SEMANA com outros do mesmo tema. Devolve a lista (e a grava em `s`, se dada).
 */
function listaDaSemana(P, s, tema, id, rating) {
  const antes = s?.lista;
  const validos = (antes || []).filter(k => P.problemas[k]);
  if (antes && validos.length >= Math.min(POR_SEMANA, antes.length) && validos.length === antes.length) return antes;
  const lista = [...validos];
  for (const k of escolherProblemas(P, tema, id + "+", rating)) { if (lista.length >= POR_SEMANA) break; if (!lista.includes(k)) lista.push(k); }
  if (!antes) { const nova = escolherProblemas(P, tema, id, rating); if (s) s.lista = nova; return nova; }
  lista.sort((a, b) => P.problemas[a][2] - P.problemas[b][2]);
  if (s) { s.lista = lista; for (const k of Object.keys(s.feitos || {})) if (!P.problemas[k]) delete s.feitos[k]; }
  return lista;
}
async function fazerLicao(lic) {
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><div class="xz-s-barra"><i></i></div><span class="xz-s-tempo"></span></div>
    <div class="xz-s-tit"></div><div class="xz-s-tab"></div><div class="xz-s-nota"></div><div class="xz-s-bts"></div>`);
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"));
  let aberto = true;
  ov.querySelector(".xz-s-fechar").onclick = () => { aberto = false; ov.remove(); desenhar(); };
  for (let i = 0; i < lic.passos.length && aberto; i++) {
    const p = lic.passos[i], g = new Chess(p.fen), eu = g.turn();
    ov.querySelector(".xz-s-barra i").style.width = `${(i / lic.passos.length) * 100}%`;
    ov.querySelector(".xz-s-tempo").textContent = `${i + 1}/${lic.passos.length}`;
    ov.querySelector(".xz-s-tit").innerHTML = `<small>${escapar(lic.titulo)}</small><b>${p.lances ? (eu === "w" ? "Brancas jogam" : "Pretas jogam") : "Observe"}</b>`;
    tab.virar(eu); tab.posicao(g.fen()); tab.setas([]); tab.marcas({}); tabConfig(tab, { podeMexer: () => false });
    ov.querySelector(".xz-s-nota").innerHTML = `<p class="xz-lic-tx">${escapar(p.texto)}</p>`;
    ov.querySelector(".xz-s-bts").innerHTML = "";
    if (p.lances) {
      for (let j = 0; j < p.lances.length && aberto; j += 2) {
        const esperado = new Chess(g.fen()).move(p.lances[j]);
        let erros = 0;
        await new Promise(res => {
          tabConfig(tab, {
            legais: (casa) => g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion })),
            podeMexer: (c) => c === eu,
            aoMover: (a, b, promo) => {
              const tent = new Chess(g.fen()); let mv; try { mv = tent.move({ from: a, to: b, promotion: promo }); } catch { return; }
              const ok = mv.san === esperado.san || (p.mate && j === p.lances.length - 1 && tent.isCheckmate());
              if (!ok) {
                erros++; tocar("errado"); tab.tremer();
                const dica = erros >= 2 ? [{ de: esperado.from, para: esperado.to, cor: "azul" }] : [];
                tab.setas(dica);
                ov.querySelector(".xz-s-bts").innerHTML = `<p class="xz-nota-lance">${erros >= 2 ? "A seta mostra o lance." : escapar(p.dica || "Não é esse. Tente de novo.")}</p>`;
                return;
              }
              g.move(mv.san); tab.setas([]); ov.querySelector(".xz-s-bts").innerHTML = "";
              tab.posicao(g.fen(), { ultimo: [mv.from, mv.to], xeque: g.inCheck() ? reiEm(g) : null }); tocar("certo");
              res();
            },
          });
        });
        if (j + 1 < p.lances.length && aberto) {
          await new Promise(ok => setTimeout(ok, 500));
          const mv = g.move(p.lances[j + 1]);
          tab.posicao(g.fen(), { ultimo: [mv.from, mv.to], xeque: g.inCheck() ? reiEm(g) : null });
        }
      }
      tabConfig(tab, { podeMexer: () => false });
      if (aberto) ov.querySelector(".xz-s-nota").insertAdjacentHTML("beforeend", `<div class="xz-res ok"><b>${g.isCheckmate() ? "Xeque-mate!" : "Isso!"}</b></div>`);
    }
    if (!aberto) break;
    await new Promise(ok => {
      const bts = ov.querySelector(".xz-s-bts");
      bts.innerHTML = `<button class="botao">${i < lic.passos.length - 1 ? "Continuar" : "Concluir a lição"}</button>`;
      bts.querySelector(".botao").onclick = () => { bts.innerHTML = ""; ok(); };
    });
  }
  if (!aberto) return;
  const x = X(); x.licoes ||= {}; x.licoes[lic.id] = hojeISO(); salvar();
  concluirNoDoDia();
  tocar("combo"); toast("Lição concluída.");
  ov.remove(); desenhar();
}

async function resolverProblemas(fila, P, s, { titulo = null, aoFim = null } = {}) {
  const x = X();
  fila = fila.filter(k => P.problemas[k]); // nunca abre um tabuleiro vazio
  if (!fila.length) { toast("Não há problemas para mostrar agora."); return; }
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><div class="xz-s-barra"><i></i></div><span class="xz-s-tempo"></span></div>
    <div class="xz-s-tit"></div><div class="xz-s-tab"></div><div class="xz-s-nota"></div><div class="xz-s-bts"></div>`);
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"));
  let aberto = true;
  const fechar = () => { aberto = false; salvar(); ov.remove(); desenhar(); };
  ov.querySelector(".xz-s-fechar").onclick = fechar;
  for (let i = 0; i < fila.length && aberto; i++) {
    const k = fila[i], [fen, movs, rating] = P.problemas[k], ms = movs.split(" ");
    ov.querySelector(".xz-s-barra i").style.width = `${(i / fila.length) * 100}%`;
    ov.querySelector(".xz-s-tempo").textContent = `${i + 1}/${fila.length}`;
    const g = new Chess(fen);
    const eu = g.turn() === "w" ? "b" : "w"; // o 1º lance é do adversário
    ov.querySelector(".xz-s-tit").innerHTML = `<small>${titulo ? `${escapar(titulo)} · ` : ""}Problema ${rating}</small><b>${eu === "w" ? "Brancas" : "Pretas"} jogam e ganham</b>`;
    tab.virar(eu); tab.posicao(g.fen()); tab.setas([]); tab.marcas({});
    ov.querySelector(".xz-s-nota").innerHTML = ""; ov.querySelector(".xz-s-bts").innerHTML = "";
    await new Promise(ok => setTimeout(ok, 600));
    const m0 = g.move({ from: ms[0].slice(0, 2), to: ms[0].slice(2, 4), promotion: ms[0][4] });
    tab.posicao(g.fen(), { ultimo: [m0.from, m0.to], xeque: g.inCheck() ? reiEm(g) : null });
    let certo = true;
    for (let j = 1; j < ms.length && aberto; j += 2) {
      const esperado = ms[j];
      const ok = await new Promise(res => {
        tabConfig(tab, {
          legais: (casa) => g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion })),
          podeMexer: (c) => c === eu,
          aoMover: (a, b, promo) => {
            const uci = a + b + (promo || "");
            const tent = new Chess(g.fen()); let mv; try { mv = tent.move({ from: a, to: b, promotion: promo }); } catch { return; }
            // mate em qualquer lance vale (no Lichess, mate alternativo conta)
            if (uci === esperado || uci.slice(0, 4) === esperado.slice(0, 4) && !esperado[4] || tent.isCheckmate()) { g.move(mv.san); res(true); }
            else res(false);
          },
        });
      });
      if (!ok) {
        certo = false; tocar("errado"); vibrar(60); tab.tremer();
        tab.setas([{ de: esperado.slice(0, 2), para: esperado.slice(2, 4), cor: "vermelha" }]);
        ov.querySelector(".xz-s-nota").innerHTML = `<p class="xz-nota-lance">Não era esse. A seta mostra o lance certo; veja a solução.</p>`;
        await new Promise(ok2 => setTimeout(ok2, 900));
        // mostra o resto da solução
        for (let r = j; r < ms.length; r++) {
          const mv = g.move({ from: ms[r].slice(0, 2), to: ms[r].slice(2, 4), promotion: ms[r][4] });
          tab.setas([]); tab.posicao(g.fen(), { ultimo: [mv.from, mv.to], xeque: g.inCheck() ? reiEm(g) : null });
          await new Promise(ok2 => setTimeout(ok2, 750));
        }
        break;
      }
      const h = g.history({ verbose: true }), u = h[h.length - 1];
      tab.posicao(g.fen(), { ultimo: [u.from, u.to], xeque: g.inCheck() ? reiEm(g) : null }); tocar("certo");
      if (j + 1 < ms.length) {
        await new Promise(ok2 => setTimeout(ok2, 450));
        const r = ms[j + 1], mv = g.move({ from: r.slice(0, 2), to: r.slice(2, 4), promotion: r[4] });
        tab.posicao(g.fen(), { ultimo: [mv.from, mv.to], xeque: g.inCheck() ? reiEm(g) : null });
      }
    }
    if (!aberto) break;
    s.feitos[k] = certo;
    // nível nos problemas, como um Elo simples
    const esp = 1 / (1 + 10 ** ((rating - x.rating) / 400));
    x.rating = Math.max(300, x.rating + 28 * ((certo ? 1 : 0) - esp));
    anotarRating();
    salvar();
    const temasPT = P.problemas[k][3].split(" ").map(t => TEMAS_PT[t]).filter(Boolean);
    ov.querySelector(".xz-s-nota").innerHTML = `<div class="xz-res ${certo ? "ok" : "erro"}"><b>${certo ? "Isso!" : "Fica para a próxima"}</b>${temasPT.length ? `<p>${escapar(temasPT.join(" · "))}</p>` : ""}</div>`;
    if (certo) tocar("combo");
    await new Promise(ok => {
      const bts = ov.querySelector(".xz-s-bts");
      bts.innerHTML = `<button class="botao">${i < fila.length - 1 ? "Próximo" : "Concluir"}</button>`;
      bts.querySelector(".botao").onclick = () => { bts.innerHTML = ""; ok(); };
    });
  }
  if (aberto) { aoFim?.(); concluirNoDoDia(); fechar(); }
}

// ---------------------------------------------------------------- ver uma linha do repertório (aberto em Treinar)
/**
 * Ver uma linha lance a lance, com a explicação de cada um (as duas notações, o porquê, as setas e as casas), a barra
 * de avaliação e o ícone "Livro". `ate`: o meio-lance onde começa; `ajuda`: aberta do meio de um treino (sem o
 * "Continuar daqui"). Devolve uma promessa que se cumpre ao fechar.
 */
function verLinha(l, { ate = 0, cor = null, ajuda = false } = {}) {
  return new Promise(fim => {
    const meu = cor || ladoDe(l);
    const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><span class="xz-p-tit">${ajuda ? "Rever: " : ""}${escapar(l.nome)}</span></div>
      <div class="xz-s-tit"><small>${escapar(l.eco)} · ${escapar(l.nomeLichess)}</small></div><div class="xz-s-tab"></div><div class="xz-lances"></div><div class="xz-s-nota"></div>
      <div class="xz-p-bts"><button data-a="ini" aria-label="Início">${I.ini}</button><button data-a="ant" aria-label="Anterior">${I.ant}</button><button data-a="prox" aria-label="Próximo">${I.prox}</button><button data-a="fim" aria-label="Fim">${I.fim}</button>${ajuda ? "" : `<button data-a="seguir" class="xz-seguir">${I.seguir}<span>Continuar daqui</span></button>`}</div>`, ajuda ? "ajuda-linha" : "ver-linha");
    const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"), { orientacao: meu });
    tabConfig(tab, { legais: () => [] });
    let k = 0;
    const ir = (alvo) => {
      k = Math.max(0, Math.min(l.san.length, alvo));
      const g = new Chess(); let u = null;
      for (let i = 0; i < k; i++) u = g.move(l.san[i]);
      tab.posicao(g.fen(), { ultimo: u ? [u.from, u.to] : null, xeque: g.inCheck() ? reiEm(g) : null });
      tab.selo(u && X().cfg.selos !== false ? u.to : null, "livro");
      barraDaLinha(tab, l, k);
      ov.querySelector(".xz-lances").innerHTML = l.san.map((s, i) => `${i % 2 === 0 ? `<i>${i / 2 + 1}.</i>` : ""}<span class="${i === k - 1 ? "on" : ""}" data-i="${i + 1}">${escapar(sanPT(s))}</span>`).join(" ");
      ov.querySelector(".xz-lances .on")?.scrollIntoView({ inline: "center", block: "nearest" });
      ov.querySelectorAll(".xz-lances span").forEach(sp => (sp.onclick = () => ir(+sp.dataset.i)));
      ov.querySelector(".xz-s-nota").innerHTML = k === 0 ? `<div class="xz-ideia"><p>${comTermos(l.ideia)}</p><p class="xz-dica-g">Avance com a seta para ver cada lance explicado.</p></div>` : explicacaoHTML(l, k);
      if (k) ideiaNoTab(tab, l, k); else { tab.setas([]); tab.marcas({}); }
    };
    const fechar = () => { ov.remove(); fim(); };
    ov.querySelector(".xz-s-fechar").onclick = fechar;
    ov.querySelector(".xz-p-bts").addEventListener("click", (e) => {
      const a = e.target.closest("button")?.dataset.a;
      if (a === "ini") ir(0); else if (a === "ant") ir(k - 1); else if (a === "prox") ir(k + 1); else if (a === "fim") ir(l.san.length);
      else if (a === "seguir") { ov.remove(); fim(); continuarJogo({ l, ate: k || l.san.length, cor: meu }); }
    });
    ir(ate);
  });
}

// ---------------------------------------------------------------- Continuar depois da abertura (pedido do Alediov, 02/11/2026)
// "exercícios para continuar um jogo após algum movimento de uma abertura que estou estudando": a partir do fim de uma
// linha (ou de um lance no meio dela, pelo "Continuar daqui" do Ver), ele joga `x.cfg.contLances` lances (10 por padrão)
// contra a Maia do degrau da escada (ou o Stockfish no nível escolhido, `x.cfg.contAdv`), com a barra de avaliação e a
// classificação de cada lance seu. O objetivo vem da avaliação de partida: manter a vantagem (perder no máximo 1 peão
// dela), manter a igualdade (não cair abaixo de −0,7) ou segurar a posição. No fim, o resumo: as classificações, a
// precisão, a avaliação do começo e do fim, os lances para rever (que vão para o treino "Seus erros").
const CLASSES_ORDEM = ["brilhante", "otimo", "melhor", "excelente", "bom", "imprecisao", "erro", "capivarada"];
const fmtAv = (v) => (Math.abs(v) > 9000 ? `${v > 0 ? "+" : "−"}M${10000 - Math.abs(v)}` : `${v > 0 ? "+" : v < 0 ? "−" : ""}${(Math.abs(v) / 100).toFixed(1).replace(".", ",")}`);
function objetivoDe(ini) {
  if (ini >= 150) return { alvo: Math.max(60, ini - 100), texto: `Você está melhor (${fmtAv(ini)}). Objetivo: manter a vantagem, terminando com ${fmtAv(Math.max(60, ini - 100))} ou mais.` };
  if (ini > -150) return { alvo: -70, texto: `A posição está equilibrada (${fmtAv(ini)}). Objetivo: seguir o plano sem piorar, terminando com ${fmtAv(-70)} ou mais.` };
  return { alvo: ini - 100, texto: `Você está um pouco pior (${fmtAv(ini)}). Objetivo: segurar a posição, sem perder mais que 1 peão de avaliação.` };
}
async function continuarJogo({ l, ate = null, cor = null }) {
  const x = X(), meu = cor || ladoDe(l), n0 = Math.min(ate ?? l.san.length, l.san.length);
  const nivel = x.cfg.contAdv === "maia" || x.cfg.contAdv == null ? `M${escada().elo}` : +x.cfg.contAdv;
  const meta = x.cfg.contLances || 10;
  aquecer(nivel);
  const g = new Chess();
  for (let i = 0; i < n0; i++) g.move(l.san[i]);
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Sair">${I.fechar}</button><span class="xz-p-tit">Continuar: ${escapar(l.nome)}</span><span class="xz-pensando" hidden>pensando…</span></div>
    <div class="xz-s-tit xz-cont-tit"><small>${escapar(nomeAdv(nivel))} · ${meta} lances seus · você joga de ${meu === "w" ? "brancas" : "pretas"}</small><b class="xz-cont-obj">Calculando a posição…</b></div>
    <div class="xz-s-tab"></div><div class="xz-quadros xz-cont-q"></div><div class="xz-lances"></div><div class="xz-s-nota"></div>
    <div class="xz-p-bts"><button data-a="plano">${I.livro}<span>O plano</span></button><button data-a="virar">${I.virar}<span>Virar</span></button><button data-a="parar">${I.fechar}<span>Terminar</span></button></div>`, "continuar");
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"), { orientacao: meu });
  const nota = ov.querySelector(".xz-s-nota"), lancesEl = ov.querySelector(".xz-lances");
  ov._jogo = g; // para o teste de fumaça escolher um lance legal
  ov.querySelector(".xz-cont-q").innerHTML = Array.from({ length: meta }, () => "<i></i>").join("");
  const historicoIni = n0, tipos = {}; // tipos[meio-lance] = a classificação do lance dele
  let fim = false, pensando = false;
  const cache = new Map();
  const analise = (fen) => { const k = fen.split(" ").slice(0, 4).join(" "); if (!cache.has(k)) cache.set(k, M.analisar(fen, { prof: 11, multipv: 2 })); return cache.get(k); };
  const s = meu === "w" ? 1 : -1;
  const mostrar = (u = null) => {
    tab.posicao(g.fen(), { ultimo: u ? [u.from, u.to] : null, xeque: g.inCheck() ? reiEm(g) : null });
    const h = g.history();
    lancesEl.innerHTML = h.map((sn, i) => `${i % 2 === 0 ? `<i>${i / 2 + 1}.</i>` : ""}<span class="${i < historicoIni ? "livro" : ""}">${escapar(sanPT(sn))}${tipos[i] ? seloHTML(tipos[i]) : ""}</span>`).join(" ");
    lancesEl.scrollLeft = lancesEl.scrollWidth;
  };
  const barra = (r, vez) => { if (x.cfg.barra !== false && r) tab.avaliacao(avBrancas(r, vez)); };
  const mostrarLista = () => { const h = g.history(); lancesEl.innerHTML = h.map((sn, i) => `${i % 2 === 0 ? `<i>${i / 2 + 1}.</i>` : ""}<span class="${i < historicoIni ? "livro" : ""}">${escapar(sanPT(sn))}${tipos[i] ? seloHTML(tipos[i]) : ""}</span>`).join(" "); lancesEl.scrollLeft = lancesEl.scrollWidth; };
  mostrar(null);
  if (x.cfg.barra !== false) tab.avaliacao(l.av?.[n0] != null ? avDoNumero(l.av[n0]) : { cp: 0 });
  const ini0 = l.av?.[n0] != null ? l.av[n0] * s : notaDe(await analise(g.fen())) * (g.turn() === meu ? 1 : -1);
  const obj = objetivoDe(ini0);
  ov.querySelector(".xz-cont-obj").textContent = obj.texto;
  nota.innerHTML = `<div class="xz-ideia"><small>O plano da linha</small><p>${comTermos(l.ideia)}</p></div>`;
  const meus = []; // { san, tipo, perda, cp, fen, uci, melhor, de, para }
  const terminar = async (motivo = "") => {
    if (fim) return; fim = true;
    tab.bloquear(true); tabConfig(tab, { legais: () => [] });
    const r = g.isGameOver() ? null : await analise(g.fen());
    if (!ov.isConnected) return;
    const fimAv = g.isCheckmate() ? (g.turn() === meu ? -10000 : 10000) : g.isGameOver() ? 0 : notaDe(r) * (g.turn() === meu ? 1 : -1);
    const ok = fimAv >= obj.alvo;
    const prec = meus.length ? Math.round(meus.reduce((a, m) => a + Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * m.perda) - 3.1669)), 0) / meus.length) : null;
    const cont = Object.fromEntries(CLASSES_ORDEM.map(c => [c, meus.filter(m => m.tipo === c).length]));
    const rever = meus.filter(m => ["imprecisao", "erro", "capivarada"].includes(m.tipo));
    const guardados = guardarErros(rever.filter(m => m.perdaCp >= 70).map(m => ({ fen: m.fen, uci: m.melhor, melhor: m.melhorEn, meuSan: m.sanEn, perda: m.perdaCp, cp: m.cpAntes })));
    x.continuar ||= [];
    x.continuar.push({ data: new Date().toISOString(), linha: l.id, ate: n0, cor: meu, nivel, lances: meus.length, ini: ini0, fim: fimAv, ok, precisao: prec });
    x.continuar = x.continuar.slice(-60); salvar();
    if (meus.length >= meta || g.isGameOver()) concluirNoDoDia(); // na trilha de hoje, vale ter jogado até o fim (o objetivo é o desafio)
    tocar(ok ? "fim" : "toque");
    const cedo = meus.length < meta && !g.isGameOver();
    nota.innerHTML = `<div class="xz-res ${ok ? "ok" : "erro"}"><b>${ok ? (cedo ? "Até aqui, dentro do objetivo" : "Objetivo cumprido!") : cedo ? "Até aqui, fora do objetivo" : "Objetivo não cumprido desta vez"}${motivo ? ` · ${escapar(motivo)}` : ""}</b>
      <p>Avaliação: ${fmtAv(ini0)} no começo → ${fmtAv(fimAv)} no fim (do seu lado).${prec != null ? ` Precisão: <strong>${prec}%</strong>.` : ""}</p>
      <div class="xz-classes">${CLASSES_ORDEM.filter(c => cont[c]).map(c => `<span>${seloHTML(c)}${cont[c]} ${escapar(NOMES_SELO[c])}</span>`).join("")}</div>
      ${rever.length ? `<div class="xz-erros"><b>${rever.length} ${rever.length === 1 ? "lance" : "lances"} para rever</b>${guardados ? `<p class="xz-dica-g">${guardados === 1 ? "1 posição foi" : `${guardados} posições foram`} para o treino «Seus erros».</p>` : ""}${rever.map((m, i) => `<button data-k="${i}">${seloHTML(m.tipo)}${escapar(m.num)}<small>melhor: ${escapar(m.melhorSan)}</small></button>`).join("")}</div>` : ""}</div>`;
    nota.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => {
      const m = rever[+b.dataset.k];
      tab.posicao(m.fen); tab.selo(m.para, m.tipo);
      tab.setas([{ de: m.de, para: m.para, cor: "vermelha" }, { de: m.melhor.slice(0, 2), para: m.melhor.slice(2, 4), cor: "verde" }]);
      nota.querySelectorAll("[data-k]").forEach(y => y.classList.toggle("on", y === b));
    }));
    ov.querySelector(".xz-p-bts").innerHTML = `<button data-a="denovo">${I.desfazer}<span>De novo</span></button><button data-a="sair">${I.fechar}<span>Fechar</span></button>`;
  };
  const vezDele = async () => {
    if (fim || g.turn() === meu) return;
    pensando = true; ov.querySelector(".xz-pensando").hidden = false; tab.bloquear(true);
    let uci;
    try {
      if (String(nivel).startsWith("M")) uci = (await (await import("./maia.js")).lanceMaia(g, +String(nivel).slice(1)))?.lan;
      else uci = await M.lanceDoNivel(g.fen(), nivel);
    } catch (e) { toast("O motor falhou: " + e.message); pensando = false; return; }
    await dormir(350);
    if (!ov.isConnected || fim) return;
    const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    tocar("toque"); mostrar(mv); tab.selo(null);
    pensando = false; ov.querySelector(".xz-pensando").hidden = true; tab.bloquear(false);
    if (g.isGameOver()) return terminar(g.isCheckmate() ? "xeque-mate" : "empate");
    analise(g.fen()).then(r => { if (ov.isConnected && !fim) barra(r, g.turn()); }).catch(() => {});
  };
  tabConfig(tab, {
    legais: (casa) => (fim || pensando ? [] : g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }))),
    podeMexer: (c) => c === meu,
    aoMover: async (a, b, promo) => {
      if (fim || pensando) return;
      const fen = g.fen(); let mv;
      try { mv = g.move({ from: a, to: b, promotion: promo }); } catch { return; }
      const uci = mv.from + mv.to + (mv.promotion || ""), k = meus.length, num = `${Math.floor((g.history().length - 1) / 2) + 1}${mv.color === "w" ? "." : "..."}${sanPT(mv.san)}`;
      tab.setas([]); mostrar(mv);
      const reg = { san: sanPT(mv.san), sanEn: mv.san, num, fen, uci, de: mv.from, para: mv.to, tipo: null, perda: 0 };
      meus.push(reg);
      const fenDepois = g.fen();
      nota.innerHTML = `<p class="xz-nota-lance">Conferindo ${escapar(reg.san)}…</p>`;
      const pAntes = analise(fen), pDepois = g.isGameOver() ? null : analise(fenDepois), ply = g.history().length - 1;
      // o adversário responde depois que o lance é conferido (o ícone aparece em cima da peça antes da resposta; se o
      // motor demorar mais de 6 s, o adversário joga assim mesmo)
      const fimAgora = g.isGameOver() || meus.length >= meta;
      pensando = true; tab.bloquear(true);
      const responder = () => { if (!fimAgora && !respondeu) { respondeu = true; pensando = false; dormir(450).then(vezDele); } };
      let respondeu = false; setTimeout(responder, 6000);
      try {
        const antes = await pAntes, depois = pDepois ? await pDepois : { cp: g.isCheckmate() ? -10000 : 0, mate: null };
        const c = classificar({ antes, depois, uci, fenDepois });
        Object.assign(reg, { tipo: c.tipo, perda: c.perda, melhor: c.melhor || uci, perdaCp: notaDe(antes) + notaDe(depois), cpAntes: notaDe(antes) });
        try { reg.melhorEn = new Chess(fen).move({ from: reg.melhor.slice(0, 2), to: reg.melhor.slice(2, 4), promotion: reg.melhor[4] }).san; } catch { reg.melhorEn = reg.melhor; }
        reg.melhorSan = sanPT(reg.melhorEn);
        if (!ov.isConnected) return;
        pintarQuadro(ov, k, ["imprecisao", "erro", "capivarada"].includes(c.tipo) ? (c.tipo === "imprecisao" ? "ajuda" : "erro") : "ok");
        tipos[ply] = c.tipo;
        if (g.fen() === fenDepois) { if (x.cfg.selos !== false) tab.selo(mv.to, c.tipo); barra(depois, g.turn()); mostrarLista(); }
        const ruim = ["imprecisao", "erro", "capivarada"].includes(c.tipo), tp = txtPerda(c.perda);
        if (!fim) nota.innerHTML = `<p class="xz-nota-lance">${seloHTML(c.tipo)} <b>${escapar(reg.num)}</b>: ${escapar(NOMES_SELO[c.tipo])}.${ruim ? ` ${escapar(tp[0].toUpperCase() + tp.slice(1))}; o melhor era <b>${escapar(reg.melhorSan)}</b>.` : ""} ${meta - meus.length > 0 ? `Faltam ${meta - meus.length}.` : ""}</p>`;
      } catch (e) { console.warn(e); }
      if (fimAgora) { pensando = false; } else responder();
      if (fimAgora) terminar(g.isGameOver() ? (g.isCheckmate() ? "xeque-mate" : "empate") : "");
    },
  });
  ov.querySelector(".xz-s-fechar").onclick = () => { fim = true; ov.remove(); desenhar(); };
  ov.querySelector(".xz-p-bts").addEventListener("click", (e) => {
    const a = e.target.closest("button")?.dataset.a;
    if (a === "virar") tab.virar();
    else if (a === "plano") nota.innerHTML = `<div class="xz-ideia"><small>O plano da linha</small><p>${comTermos(l.ideia)}</p><p class="xz-dica-g">${escapar(obj.texto)}</p></div>`;
    else if (a === "parar") { if (meus.length) terminar("você terminou antes"); else { fim = true; ov.remove(); desenhar(); } }
    else if (a === "denovo") { ov.remove(); continuarJogo({ l, ate: n0, cor: meu }); }
    else if (a === "sair") { ov.remove(); desenhar(); }
  });
  if (g.turn() !== meu) vezDele();
}

// ---------------------------------------------------------------- extras de 25/10/2026 (pedidos do Alediov)
const RELOGIOS = [["", "Sem"], ["10+0", "10 min"], ["5+3", "5+3"], ["3+2", "3+2"]];
const notaR = (r) => (r.mate != null ? (r.mate > 0 ? 10000 - r.mate : -10000 - r.mate) : r.cp);
const dormir = (ms) => new Promise(ok => setTimeout(ok, ms));

// Escada da Maia: 3 vitórias contra a Maia do degrau sobem para a próxima (1100 → 1500 → 1900)
function escada() { const x = X(); x.escada ||= { elo: MAIA_ELOS[0], vit: 0, subiuEm: {} }; return x.escada; }
const VIT_PARA_SUBIR = 3;
function subirEscada(nivel, res) {
  const e = escada();
  if (nivel !== `M${e.elo}` || res !== "v") return null;
  e.vit++;
  const prox = MAIA_ELOS[MAIA_ELOS.indexOf(e.elo) + 1];
  if (e.vit >= VIT_PARA_SUBIR && prox) {
    e.subiuEm[prox] = hojeISO(); e.elo = prox; e.vit = 0; salvar();
    setTimeout(() => { confete?.(); tocar("combo"); }, 300);
    return `Subiu na escada: agora é a Maia ${prox}!`;
  }
  if (e.vit >= VIT_PARA_SUBIR && !prox) { e.topo = (e.topo || 0) + 1; e.vit = 0; salvar(); return "Topo da escada: mais uma série de vitórias contra a Maia 1900!"; }
  salvar();
  return `${e.vit} de ${VIT_PARA_SUBIR} vitórias para subir na escada.`;
}
// "Nova partida" depois de subir: já contra o degrau novo
function proximoNivel(nivel) { const e = escada(); return String(nivel).startsWith("M") && MAIA_ELOS.includes(+String(nivel).slice(1)) && +String(nivel).slice(1) < e.elo && nivel === `M${MAIA_ELOS[MAIA_ELOS.indexOf(e.elo) - 1]}` ? `M${e.elo}` : nivel; }
function cartaoEscada(t) {
  const e = escada(), x = X();
  const c = document.createElement("div"); c.className = "xz-cartao xz-escada";
  c.innerHTML = `<small>Escada da Maia</small><h2>Degrau: Maia ${e.elo}</h2>
    <div class="xz-degraus">${MAIA_ELOS.map(el => `<span class="${el < e.elo ? "feito" : el === e.elo ? "atual" : ""}"><b>${el}</b>${el === e.elo ? `<i>${Array.from({ length: VIT_PARA_SUBIR }, (_, k) => `<em class="${k < e.vit ? "on" : ""}"></em>`).join("")}</i>` : el < e.elo ? "<i>✓</i>" : "<i>·</i>"}</span>`).join('<span class="xz-deg-seta">›</span>')}</div>
    <p class="xz-dica-g">${VIT_PARA_SUBIR} vitórias contra a Maia do degrau sobem para a próxima.${e.topo ? ` Você já fechou a escada ${e.topo} ${e.topo === 1 ? "vez" : "vezes"}.` : ""}</p>
    <button class="botao">Jogar contra a Maia ${e.elo}</button>`;
  c.querySelector(".botao").onclick = () => {
    const cor = x.cfg.cor === "r" ? (Math.random() < 0.5 ? "w" : "b") : x.cfg.cor;
    partida({ cor, nivel: `M${e.elo}`, relogio: x.cfg.relogio });
  };
  t.prepend(c);
}

// gráfico da avaliação da partida (do ponto de vista das brancas), com os erros marcados; tocar mostra a posição
function graficoAvaliacao(curva, erros, cor) {
  const N = Math.max(1, curva.length - 1), y = (v) => 50 - Math.max(-600, Math.min(600, v)) / 12;
  const pts = curva.map((v, i) => `${(i / N) * 100},${y(v).toFixed(1)}`).join(" ");
  return `<div class="xz-grafico" data-n="${N}"><svg viewBox="0 0 100 100" preserveAspectRatio="none">
    <rect width="100" height="100" class="pretas"/><polygon points="0,100 ${pts} 100,100" class="brancas"/><line x1="0" y1="50" x2="100" y2="50" class="meio"/>
    <polyline points="${pts}" class="linha"/>${erros.map(i => `<line x1="${((i + 1) / N) * 100}" x2="${((i + 1) / N) * 100}" y1="0" y2="100" class="erro"/>`).join("")}<line class="cursor" x1="-5" x2="-5" y1="0" y2="100"/></svg>
    <small>Avaliação ao longo da partida (em cima, vantagem das brancas${cor === "w" ? ": você" : ""}; embaixo, das pretas${cor === "b" ? ": você" : ""}). Toque para ver a posição.</small></div>`;
}
// `aoIr(k)` (tabuleiro de análise): quem usa cuida de mostrar a posição k; sem ele, o gráfico mostra no tabuleiro
function ligarGrafico(nota, fens, h, tab, aoIr = null) {
  const gr = nota.querySelector(".xz-grafico"); if (!gr) return;
  const N = +gr.dataset.n, svg = gr.querySelector("svg"), cur = gr.querySelector(".cursor");
  const ir = (ev) => {
    const r = svg.getBoundingClientRect(), k = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * N);
    cur.setAttribute("x1", (k / N) * 100); cur.setAttribute("x2", (k / N) * 100);
    if (aoIr) return aoIr(k);
    const fen = fens[Math.min(k, fens.length - 1)], u = k > 0 ? h[k - 1] : null;
    tab.posicao(fen, { ultimo: u ? [u.from, u.to] : null }); tab.setas([]);
  };
  svg.addEventListener("pointerdown", (e) => { ir(e); svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", (e) => { if (e.buttons) ir(e); });
}

// Aprender com os erros: os lances que a análise achou viram posições de treino com revisão espaçada
function guardarErros(achados) {
  const x = X(); x.erros ||= {};
  let n = 0;
  for (const a of achados) {
    const k = a.fen.split(" ").slice(0, 4).join(" ");
    if (x.erros[k]) continue;
    x.erros[k] = { fen: a.fen, melhor: a.uci, san: a.melhor, meu: a.meuSan, perda: a.perda, cp: a.cp, em: hojeISO(), caixa: 0, proxima: hojeISO() };
    n++;
  }
  // até 200: saem primeiro os mais antigos já firmes
  const ks = Object.keys(x.erros);
  if (ks.length > 200) ks.sort((a, b) => (x.erros[b].caixa - x.erros[a].caixa) || x.erros[a].em.localeCompare(x.erros[b].em)).slice(0, ks.length - 200).forEach(k => delete x.erros[k]);
  salvar();
  return n;
}
const errosDevidos = () => Object.entries(X().erros || {}).filter(([, e]) => e.proxima <= hojeISO()).map(([k, e]) => ({ k, ...e }));
async function revisarErros(lista) {
  aquecer();
  const x = X(), fila = lista.slice(0, 10);
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><div class="xz-s-barra"><i></i></div><span class="xz-s-tempo"></span></div>
    <div class="xz-s-tit"></div><div class="xz-s-tab"></div><div class="xz-s-nota"></div><div class="xz-s-bts"></div>`);
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"));
  let aberto = true, acertos = 0;
  ov.querySelector(".xz-s-fechar").onclick = () => { aberto = false; salvar(); ov.remove(); desenhar(); };
  for (let i = 0; i < fila.length && aberto; i++) {
    const e = fila[i], g = new Chess(e.fen), eu = g.turn();
    ov.querySelector(".xz-s-barra i").style.width = `${(i / fila.length) * 100}%`;
    ov.querySelector(".xz-s-tempo").textContent = `${i + 1}/${fila.length}`;
    ov.querySelector(".xz-s-tit").innerHTML = `<small>Da sua partida de ${new Date(e.em + "T12:00:00").toLocaleDateString("pt-BR")}</small><b>${eu === "w" ? "Brancas" : "Pretas"} jogam: ache um lance melhor</b>`;
    tab.virar(eu); tab.posicao(g.fen()); tab.setas([]); tab.marcas({});
    ov.querySelector(".xz-s-nota").innerHTML = `<p class="xz-nota-lance">Na partida você jogou <b>${escapar(sanPT(e.meu))}</b>, que perdeu ${(e.perda / 100).toFixed(1).replace(".", ",")} peão de vantagem.</p>`;
    ov.querySelector(".xz-s-bts").innerHTML = "";
    const res = await new Promise(ok => {
      tabConfig(tab, {
        legais: (casa) => g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion })),
        podeMexer: (c) => c === eu,
        aoMover: async (a, b, promo) => {
          const tent = new Chess(g.fen()); let mv; try { mv = tent.move({ from: a, to: b, promotion: promo }); } catch { return; }
          tab.posicao(tent.fen(), { ultimo: [mv.from, mv.to] }); tabConfig(tab, { podeMexer: () => false });
          if (a + b + (promo || "") === e.melhor || tent.isCheckmate()) return ok({ certo: true, igual: true });
          ov.querySelector(".xz-s-nota").innerHTML = `<p class="xz-nota-lance">Conferindo ${escapar(sanPT(mv.san))}…</p>`;
          const r = await M.analisar(tent.fen(), { prof: 12 });
          const v = -notaR(r);
          ok({ certo: v >= (e.cp ?? 0) - 40, san: sanPT(mv.san), v });
        },
      });
    });
    if (!aberto) break;
    if (res.certo) { acertos++; tocar("certo"); e.caixa = Math.min(INTERVALOS.length - 1, (e.caixa || 0) + 1); }
    else { tocar("errado"); vibrar(60); tab.tremer(); e.caixa = 0; }
    e.proxima = somaDias(hojeISO(), res.certo ? INTERVALOS[e.caixa] : 1);
    x.erros[e.k] && Object.assign(x.erros[e.k], { caixa: e.caixa, proxima: e.proxima });
    salvar();
    tab.posicao(e.fen); tab.setas([{ de: e.melhor.slice(0, 2), para: e.melhor.slice(2, 4), cor: "verde" }]);
    ov.querySelector(".xz-s-nota").innerHTML = `<div class="xz-res ${res.certo ? "ok" : "erro"}"><b>${res.certo ? (res.igual ? "Isso! Era esse." : `Também serve: ${escapar(res.san)}`) : `Ainda não: ${escapar(res.san)} não segura`}</b><p>O melhor era <b>${escapar(sanPT(e.san))}</b> (seta verde). ${res.certo ? `Volta em ${INTERVALOS[e.caixa]} dia${INTERVALOS[e.caixa] > 1 ? "s" : ""}.` : "Volta amanhã."}</p></div>`;
    await new Promise(ok => { const bts = ov.querySelector(".xz-s-bts"); bts.innerHTML = `<button class="botao">${i < fila.length - 1 ? "Próxima" : "Concluir"}</button>`; bts.querySelector(".botao").onclick = () => { bts.innerHTML = ""; ok(); }; });
  }
  if (!aberto) return;
  concluirNoDoDia();
  toast(`${acertos} de ${fila.length} certas.`); ov.remove(); desenhar();
}

// Corrida de 3 minutos (como o Puzzle Rush): problemas cada vez mais difíceis; 3 erros acabam a corrida
const CORRIDA_MS = 180000;
async function cartaoCorrida(t) {
  const P = await problemas(); if (!P) return;
  const x = X(), r = x.corrida ||= { recorde: 0, vezes: 0, ultimas: [] };
  const c = document.createElement("div"); c.className = "xz-cartao xz-corrida";
  c.innerHTML = `<small>Corrida de 3 minutos</small><h2>${r.recorde ? `Recorde: ${r.recorde}` : "Quantos você resolve?"}</h2>
    <p class="xz-dica-g">Problemas do Lichess cada vez mais difíceis. Um lance errado é uma falta; na 3ª, acaba.${r.ultimas.length ? ` Últimas: ${r.ultimas.slice(-5).join(", ")}.` : ""}</p>
    <button class="botao">Correr</button>`;
  c.querySelector(".botao").onclick = () => corrida(P);
  t.append(c);
}
async function corrida(P) {
  const x = X(), r = x.corrida ||= { recorde: 0, vezes: 0, ultimas: [] };
  const todos = Object.entries(P.problemas).map(([k, v]) => ({ k, fen: v[0], ms: v[1].split(" "), rating: v[2] })).sort((a, b) => a.rating - b.rating);
  const usados = new Set();
  const escolher = (alvo) => { const perto = todos.filter(p => !usados.has(p.k) && Math.abs(p.rating - alvo) <= 120); const l = perto.length ? perto : todos.filter(p => !usados.has(p.k)); const p = l[Math.floor(Math.random() * l.length)]; usados.add(p.k); return p; };
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><div class="xz-s-barra xz-c-tempo"><i></i></div><span class="xz-s-tempo">3:00</span></div>
    <div class="xz-c-placar"><b class="xz-c-pontos">0</b><span class="xz-c-faltas"><i></i><i></i><i></i></span></div>
    <div class="xz-s-tit"></div><div class="xz-s-tab"></div><div class="xz-s-nota"></div>`);
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"));
  let aberto = true, pontos = 0, faltas = 0, alvo = Math.max(400, Math.round(x.rating - 350));
  const fim = Date.now() + CORRIDA_MS;
  const relogio = setInterval(() => {
    const resta = Math.max(0, fim - Date.now());
    ov.querySelector(".xz-c-tempo i").style.width = `${(resta / CORRIDA_MS) * 100}%`;
    ov.querySelector(".xz-s-tempo").textContent = `${Math.floor(resta / 60000)}:${String(Math.floor((resta % 60000) / 1000)).padStart(2, "0")}`;
    ov.querySelector(".xz-c-tempo").classList.toggle("pouco", resta < 20000);
    if (resta <= 0) acabar();
  }, 200);
  let acabou = null;
  const fimPromessa = new Promise(ok => (acabou = ok));
  const acabar = () => { if (!aberto) return; aberto = false; clearInterval(relogio); acabou(); };
  ov.querySelector(".xz-s-fechar").onclick = () => { acabar(); ov.remove(); desenhar(); };
  const rodada = async () => {
    while (aberto) {
      const p = escolher(alvo), g = new Chess(p.fen), eu = g.turn() === "w" ? "b" : "w";
      ov.querySelector(".xz-s-tit").innerHTML = `<small>${p.rating}</small><b>${eu === "w" ? "Brancas" : "Pretas"} jogam</b>`;
      tab.virar(eu); tab.posicao(g.fen()); tab.setas([]);
      await dormir(350); if (!aberto) return;
      const m0 = g.move({ from: p.ms[0].slice(0, 2), to: p.ms[0].slice(2, 4), promotion: p.ms[0][4] });
      tab.posicao(g.fen(), { ultimo: [m0.from, m0.to], xeque: g.inCheck() ? reiEm(g) : null });
      let certo = true;
      for (let j = 1; j < p.ms.length && aberto; j += 2) {
        const esp = p.ms[j];
        const ok = await Promise.race([fimPromessa.then(() => null), new Promise(res => tabConfig(tab, {
          legais: (casa) => g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion })),
          podeMexer: (c) => c === eu,
          aoMover: (a, b, promo) => {
            const tent = new Chess(g.fen()); let mv; try { mv = tent.move({ from: a, to: b, promotion: promo }); } catch { return; }
            const uci = a + b + (promo || "");
            if (uci === esp || (uci.slice(0, 4) === esp.slice(0, 4) && !esp[4]) || tent.isCheckmate()) { g.move(mv.san); res(true); } else res(false);
          },
        }))]);
        if (ok == null) return;
        if (!ok) { certo = false; break; }
        const u = g.history({ verbose: true }).at(-1);
        tab.posicao(g.fen(), { ultimo: [u.from, u.to], xeque: g.inCheck() ? reiEm(g) : null });
        if (j + 1 < p.ms.length) { await dormir(250); const rr = p.ms[j + 1], mv = g.move({ from: rr.slice(0, 2), to: rr.slice(2, 4), promotion: rr[4] }); tab.posicao(g.fen(), { ultimo: [mv.from, mv.to], xeque: g.inCheck() ? reiEm(g) : null }); }
      }
      if (!aberto) return;
      if (certo) { pontos++; tocar("certo"); alvo += 45; ov.querySelector(".xz-c-pontos").textContent = pontos; ov.querySelector(".xz-c-pontos").classList.remove("pula"); void ov.offsetWidth; ov.querySelector(".xz-c-pontos").classList.add("pula"); }
      else {
        faltas++; tocar("errado"); vibrar(60); tab.tremer(); alvo = Math.max(400, alvo - 30);
        ov.querySelectorAll(".xz-c-faltas i").forEach((el, k) => el.classList.toggle("on", k < faltas));
        if (faltas >= 3) { acabar(); return; }
        await dormir(400);
      }
    }
  };
  rodada();
  await fimPromessa;
  tabConfig(tab, { podeMexer: () => false });
  if (!ov.isConnected) return;
  concluirNoDoDia(); // na trilha de hoje (ciclo de tática), vale ter corrido até o fim
  const novo = pontos > r.recorde;
  r.vezes++; r.ultimas = [...r.ultimas, pontos].slice(-20); if (novo) r.recorde = pontos; salvar();
  if (novo && pontos > 0) { confete?.(); tocar("combo"); }
  ov.querySelector(".xz-s-nota").innerHTML = `<div class="xz-res ${novo ? "ok" : ""}"><b>${pontos} ${pontos === 1 ? "problema" : "problemas"}${novo && pontos ? " · recorde novo!" : ""}</b><p>${faltas >= 3 ? "Três faltas." : "Acabou o tempo."} Recorde: ${r.recorde}.</p></div><div class="xz-s-bts"><button class="botao">De novo</button><button class="botao secundario">Sair</button></div>`;
  const [denovo, sair] = ov.querySelectorAll(".xz-s-nota .botao");
  denovo.onclick = () => { ov.remove(); corrida(P); };
  sair.onclick = () => { ov.remove(); desenhar(); };
}

// Finais clássicos (Lucena e Philidor): aprender com os passos guiados e praticar contra o Stockfish no máximo
let FIN = null;
async function finais() { if (!FIN) { try { FIN = (await (await fetch("dados/xadrez/finais.json")).json()).finais; } catch { FIN = []; } } return FIN; }
async function cartaoFinais(t) {
  const F = await finais(); if (!F.length) return;
  const x = X(); x.finais ||= {};
  const c = document.createElement("div"); c.className = "xz-cartao xz-finais";
  c.innerHTML = `<small>Finais clássicos</small><h2>Torre e peão</h2>
    ${F.map(f => { const s = x.finais[f.id] || {}; return `<div class="xz-final"><span><b>${escapar(f.titulo)}</b><small>${escapar(f.sub)}${s.pratica ? ` · ${f.pratica.objetivo === "vencer" ? "venceu" : "empatou"} ${s.pratica}×` : ""}</small></span>
      <button class="botao mini ${x.licoes?.["fin-" + f.id] ? "secundario" : ""}" data-a="aprender" data-id="${f.id}">${x.licoes?.["fin-" + f.id] ? "Rever" : "Aprender"}</button><button class="botao mini" data-a="praticar" data-id="${f.id}">Praticar</button></div>`; }).join("")}`;
  c.querySelectorAll("[data-a]").forEach(b => (b.onclick = () => {
    const f = F.find(y => y.id === b.dataset.id);
    if (b.dataset.a === "aprender") fazerLicao({ id: "fin-" + f.id, titulo: f.titulo, fonte: f.fonte, passos: f.passos });
    else praticarFinal(f);
  }));
  t.append(c);
}
async function praticarFinal(f) {
  aquecer();
  const x = X(); x.finais ||= {};
  const g = new Chess(f.pratica.fen), eu = g.turn(), vencer = f.pratica.objetivo === "vencer", LIM = vencer ? 40 : 25;
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Sair">${I.fechar}</button><span class="xz-p-tit">${escapar(f.titulo)} · prática</span><span class="xz-pensando" hidden>pensando…</span></div>
    <div class="xz-s-tit"><small>${escapar(f.pratica.texto)}</small><b class="xz-f-cont"></b></div><div class="xz-s-tab"></div><div class="xz-s-nota"></div>
    <div class="xz-p-bts"><button data-a="recomecar">${I.desfazer}<span>Recomeçar</span></button><button data-a="virar">${I.virar}<span>Virar</span></button></div>`, "partida");
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"), { orientacao: eu });
  const nota = ov.querySelector(".xz-s-nota");
  let fim = false, pensando = false, meus = 0;
  const contar = () => (ov.querySelector(".xz-f-cont").textContent = `Lance ${meus} de ${LIM}`);
  const mostrar = () => { const u = g.history({ verbose: true }).at(-1); tab.posicao(g.fen(), { ultimo: u ? [u.from, u.to] : null, xeque: g.inCheck() ? reiEm(g) : null }); contar(); };
  const acabar = (ok, txt) => {
    fim = true; tab.bloquear(true);
    if (ok) { const s = x.finais[f.id] ||= {}; s.pratica = (s.pratica || 0) + 1; s.em = hojeISO(); salvar(); tocar("combo"); confete?.(); } else tocar("errado");
    concluirNoDoDia(); // na trilha de hoje (ciclo de jogo e técnica), vale ter levado a prática até o fim
    nota.innerHTML = `<div class="xz-res ${ok ? "ok" : "erro"}"><b>${escapar(txt)}</b></div>`;
  };
  const conferir = async () => {
    if (g.isCheckmate()) return acabar(g.turn() !== eu, g.turn() !== eu ? "Xeque-mate!" : "Levou mate.");
    if (g.isDraw()) return acabar(!vencer, vencer ? "Empatou: o objetivo era vencer." : "Empate garantido!");
    const r = await M.analisar(g.fen(), { prof: 12 });
    const v = g.turn() === eu ? notaR(r) : -notaR(r); // do seu ponto de vista
    if (vencer) {
      const temDama = g.board().flat().some(p => p && p.type === "q" && p.color === eu);
      if (temDama && v >= 600) return acabar(true, "Peão promovido e vantagem decisiva: venceu a Lucena!");
      if (v < 150) return acabar(false, "A vantagem escapou: a posição virou empate. Tente de novo pela ponte.");
    } else if (v <= -400) return acabar(false, "A posição ficou perdida. Lembre: torre na 6ª e, com o peão em e6, xeques por trás.");
    if (meus >= LIM) return acabar(vencer ? false : true, vencer ? "Acabaram os lances sem promover." : `Segurou ${LIM} lances: empate!`);
  };
  const vezDoMotor = async () => {
    if (fim || g.turn() === eu) return;
    pensando = true; ov.querySelector(".xz-pensando").hidden = false; tab.bloquear(true);
    const r = await M.analisar(g.fen(), { prof: 16, tempo: 1200 });
    if (!ov.isConnected) return;
    g.move({ from: r.melhor.slice(0, 2), to: r.melhor.slice(2, 4), promotion: r.melhor[4] });
    tocar("toque"); pensando = false; ov.querySelector(".xz-pensando").hidden = true; tab.bloquear(false);
    mostrar(); await conferir();
  };
  tabConfig(tab, {
    legais: (casa) => (fim || pensando ? [] : g.moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }))),
    podeMexer: (c) => c === eu,
    aoMover: async (a, b, promo) => {
      try { g.move({ from: a, to: b, promotion: promo }); } catch { return; }
      meus++; mostrar(); await conferir();
      if (!fim) vezDoMotor();
    },
  });
  ov.querySelector(".xz-s-fechar").onclick = () => { ov.remove(); desenhar(); };
  ov.querySelector(".xz-p-bts").addEventListener("click", (e) => {
    const a = e.target.closest("button")?.dataset.a;
    if (a === "virar") { tab.virar(); mostrar(); }
    if (a === "recomecar" && !pensando) { ov.remove(); praticarFinal(f); }
  });
  mostrar();
}

// ---------------------------------------------------------------- Jogar: computador ou amigo
// Pedido do Alediov (26/10/2026): escolher contra que motor jogar (a Maia, que joga como gente, ou o Stockfish por
// níveis) e jogar contra um amigo no próprio tablet, no clássico ou nas variantes, com sorteio de cores e o jeito de
// segurar o tablet; e, desde o 2º pedido do dia, o xadrez para 4 jogadores (quatro.js). A corrida e os finais foram
// para Treinar.
async function telaJogar(t) {
  const x = X();
  x.cfg.modoJogar ||= "computador";
  const modo = x.cfg.modoJogar;
  t.innerHTML = `<div class="xz-modos tres">
      <button data-m="computador" class="${modo === "computador" ? "on" : ""}">${icone("🤖", "ico3d")}<b>Computador</b><small>Maia ou Stockfish</small></button>
      <button data-m="amigo" class="${modo === "amigo" ? "on" : ""}">${icone("🤝", "ico3d")}<b>Com um amigo</b><small>no tablet, 11 variantes</small></button>
      <button data-m="quatro" class="${modo === "quatro" ? "on" : ""}">${icone("👥", "ico3d")}<b>4 jogadores</b><small>${MODOS4.length} modos</small></button></div>
    <div class="xz-modo-corpo"></div>`;
  t.querySelectorAll(".xz-modos button").forEach(b => (b.onclick = () => { x.cfg.modoJogar = b.dataset.m; salvar(); desenhar(); }));
  const corpo = t.querySelector(".xz-modo-corpo");
  if (modo === "amigo") return telaAmigo(corpo);
  if (modo === "quatro") return telaQuatro(corpo, { camada, I, aoSair: () => desenhar() });
  await telaComputador(corpo);
}
async function telaComputador(t) {
  const x = X(), rep = await repertorio();
  const ultimas = x.partidas.slice(-5).reverse();
  t.innerHTML = `<div class="xz-cartao">
      <h2>Contra que motor?</h2>
      <div class="xz-motores">
        <button data-v="maia"><b>Maia</b><small>Joga como gente: uma rede treinada em milhões de partidas do Lichess, com os erros típicos de cada nível.</small></button>
        <button data-v="stockfish"><b>Stockfish 19</b><small>O motor mais forte do mundo, em 8 níveis: os primeiros erram como um iniciante.</small></button>
      </div>
      <label class="xz-rotulo xz-rot-nivel">Nível</label>
      <div class="xz-niveis xz-niv-sf">${M.NIVEIS.map(n => `<button data-n="${n.n}"><b>${n.n === 8 ? "Máx." : n.n}</b><small>${n.elo}</small></button>`).join("")}</div>
      <div class="xz-niveis xz-niv-maia">${MAIA_ELOS.map(e => `<button data-e="${e}"><b>${e}</b><small>Lichess</small></button>`).join("")}</div>
      <label class="xz-rotulo">Você joga de</label>
      <div class="xz-seg" data-k="cor">${[["w", "Brancas"], ["b", "Pretas"], ["r", "Sorteio"]].map(([v, n]) => `<button data-v="${v}">${n}</button>`).join("")}</div>
      <label class="xz-rotulo">Relógio</label>
      <div class="xz-seg" data-k="relogio">${RELOGIOS.map(([v, n]) => `<button data-v="${v}">${n}</button>`).join("")}</div>
      <label class="xz-rotulo">Começar</label>
      <select class="xz-inicio"><option value="">Da posição inicial</option>${rep.capitulos.map(c => `<optgroup label="${escapar(c.nome)} (${c.lado})">${c.linhas.map(l => `<option value="${l.id}">${escapar(l.nome)}</option>`).join("")}</optgroup>`).join("")}</select>
      <button class="botao xz-jogar">Jogar</button></div>
    ${ultimas.length ? `<h3 class="xz-sec">Últimas partidas</h3><div class="xz-partidas">${ultimas.map(p => `<div><span class="xz-r ${p.resultado}">${{ v: "Vitória", d: "Derrota", e: "Empate" }[p.resultado] || "—"}</span><span>${p.cor === "w" ? "Brancas" : "Pretas"} · ${escapar(nomeAdv(p.nivel, true))} · ${p.lances} lances${p.precisao != null ? ` · ${p.precisao}%` : ""}</span><small>${new Date(p.data).toLocaleDateString("pt-BR")}</small></div>`).join("")}</div>` : ""}`;
  const cores = [...t.querySelectorAll('.xz-seg[data-k="cor"] button')], niveis = [...t.querySelectorAll(".xz-niv-sf button")], inicio = t.querySelector(".xz-inicio");
  const advs = [...t.querySelectorAll(".xz-motores button")], elos = [...t.querySelectorAll(".xz-niv-maia button")];
  const rels = [...t.querySelectorAll('.xz-seg[data-k="relogio"] button')];
  const caixaSf = t.querySelector(".xz-niv-sf"), caixaMaia = t.querySelector(".xz-niv-maia");
  const pintar = () => {
    cores.forEach(b => b.classList.toggle("on", b.dataset.v === x.cfg.cor));
    niveis.forEach(b => b.classList.toggle("on", +b.dataset.n === x.cfg.nivel));
    advs.forEach(b => b.classList.toggle("on", b.dataset.v === x.cfg.adv));
    elos.forEach(b => b.classList.toggle("on", +b.dataset.e === x.cfg.maia));
    rels.forEach(b => b.classList.toggle("on", b.dataset.v === (x.cfg.relogio || "")));
    caixaSf.hidden = x.cfg.adv === "maia"; caixaMaia.hidden = x.cfg.adv !== "maia";
  };
  rels.forEach(b => (b.onclick = () => { x.cfg.relogio = b.dataset.v; salvar(); pintar(); }));
  advs.forEach(b => (b.onclick = () => { x.cfg.adv = b.dataset.v; salvar(); pintar(); }));
  elos.forEach(b => (b.onclick = () => { x.cfg.maia = +b.dataset.e; salvar(); pintar(); }));
  cores.forEach(b => (b.onclick = () => { x.cfg.cor = b.dataset.v; salvar(); pintar(); }));
  niveis.forEach(b => (b.onclick = () => { x.cfg.nivel = +b.dataset.n; salvar(); pintar(); }));
  t.querySelector(".xz-jogar").onclick = () => {
    const id = inicio.value, l = id ? todasLinhas(rep).find(y => y.id === id) : null;
    let cor = x.cfg.cor === "r" ? (Math.random() < 0.5 ? "w" : "b") : x.cfg.cor;
    if (l) cor = l.cap.lado === "brancas" ? "w" : "b";
    partida({ cor, nivel: x.cfg.adv === "maia" ? `M${x.cfg.maia}` : x.cfg.nivel, linha: l, relogio: x.cfg.relogio });
  };
  pintar();
  cartaoEscada(t);
}
function telaAmigo(t) {
  const a = cfgAmigo();
  const v = VARIANTES.find(y => y.id === a.variante) || VARIANTES[0];
  const ultimas = a.partidas.slice(-6).reverse();
  t.innerHTML = `<div class="xz-cartao xz-amigo-cfg">
      <h2>Partida no tablet</h2>
      <div class="xz-nomes"><label><small>Embaixo (você)</small><input data-n="0" maxlength="16" value="${escapar(a.nomes[0])}"></label><label><small>O amigo</small><input data-n="1" maxlength="16" value="${escapar(a.nomes[1])}"></label></div>
      <label class="xz-rotulo">Variante</label>
      <div class="xz-variantes">${VARIANTES.map(y => `<button data-v="${y.id}" class="${y.id === v.id ? "on" : ""}">${icone(y.icone, "ico3d")}<b>${escapar(y.nome)}</b></button>`).join("")}</div>
      <p class="xz-regra"><b>${escapar(v.nome)}:</b> ${escapar(v.regra)}</p>
      <label class="xz-rotulo">Cores</label>
      <div class="xz-seg" data-k="cores"><button data-v="sorteio">Sortear</button><button data-v="w">Você de brancas</button><button data-v="b">Você de pretas</button></div>
      <label class="xz-rotulo">O tablet</label>
      <div class="xz-seg" data-k="giro">${GIROS.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join("")}</div>
      <p class="xz-dica-g xz-giro-dica"></p>
      <label class="xz-rotulo">Relógio</label>
      <div class="xz-seg" data-k="relogio">${RELOGIOS_AMIGO.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join("")}</div>
      <button class="botao xz-jogar">Começar</button></div>
    ${ultimas.length ? `<h3 class="xz-sec">Últimas com amigos</h3><div class="xz-partidas">${ultimas.map(p => { const vv = VARIANTES.find(y => y.id === p.variante); return `<div><span class="xz-r ${p.vencedor ? "v" : "e"}">${p.vencedor ? escapar(p.vencedor === "w" ? p.brancas : p.pretas) : "Empate"}</span><span>${escapar(vv?.nome || p.variante)} · ${escapar(p.motivo || "")} · ${p.lances} lances</span><small>${new Date(p.data).toLocaleDateString("pt-BR")}</small></div>`; }).join("")}</div>` : ""}`;
  const DICAS_GIRO = { fixo: "O tabuleiro fica parado, com as suas peças embaixo.", girar: "A cada lance o tabuleiro vira para quem vai jogar: bom para passar o tablet de mão em mão.", frente: "O tablet deitado na mesa, um de cada lado: as peças, o relógio e os botões de quem fica em cima ficam virados para ele." };
  const pintar = () => {
    t.querySelectorAll('.xz-seg[data-k="cores"] button').forEach(b => b.classList.toggle("on", b.dataset.v === (a.sorteio ? "sorteio" : a.minhaCor || "w")));
    t.querySelectorAll('.xz-seg[data-k="giro"] button').forEach(b => b.classList.toggle("on", b.dataset.v === a.giro));
    t.querySelectorAll('.xz-seg[data-k="relogio"] button').forEach(b => b.classList.toggle("on", b.dataset.v === (a.relogio || "")));
    t.querySelector(".xz-giro-dica").textContent = a.variante === "neblina" ? "Na Neblina, o tablet passa de mão em mão: uma cortina esconde o tabuleiro entre os lances." : DICAS_GIRO[a.giro];
  };
  t.querySelectorAll(".xz-nomes input").forEach(i => (i.oninput = () => { a.nomes[+i.dataset.n] = i.value.trim() || (i.dataset.n === "0" ? "Você" : "Amigo"); salvar(); }));
  t.querySelectorAll(".xz-variantes button").forEach(b => (b.onclick = () => { a.variante = b.dataset.v; salvar(); telaAmigo(t); }));
  t.querySelectorAll('.xz-seg[data-k="cores"] button').forEach(b => (b.onclick = () => { a.sorteio = b.dataset.v === "sorteio"; if (!a.sorteio) a.minhaCor = b.dataset.v; salvar(); pintar(); }));
  t.querySelectorAll('.xz-seg[data-k="giro"] button').forEach(b => (b.onclick = () => { a.giro = b.dataset.v; salvar(); pintar(); }));
  t.querySelectorAll('.xz-seg[data-k="relogio"] button').forEach(b => (b.onclick = () => { a.relogio = b.dataset.v; salvar(); pintar(); }));
  t.querySelector(".xz-jogar").onclick = () => comecarAmigo({ camada, I, aoSair: () => desenhar() });
  pintar();
}

// ---------------------------------------------------------------- Desafio do dia (calendário em Treinar)
// Pedido do Alediov (26/10/2026): um desafio por dia, uma posição com uma sequência de lances certos. Um problema do
// Lichess com pelo menos 2 lances seus, fixo no dia (`x.desafiosDia[dia].k`), mais fácil na segunda e mais difícil no
// domingo (como as palavras cruzadas do jornal). Dá para fazer os dias que ficaram para trás pelo calendário.
const INICIO_DESAFIOS = "2026-10-01";
function desafioDe(P, dia) {
  const x = X(); x.desafiosDia ||= {};
  const d = x.desafiosDia[dia];
  if (d?.k && P.problemas[d.k]) return d.k;
  const dow = (new Date(dia + "T12:00:00").getDay() + 6) % 7; // 0 = segunda
  const alvo = Math.round(x.rating - 150 + dow * 60);
  const cand = Object.keys(P.problemas).filter(k => { const v = P.problemas[k]; return v[1].split(" ").length >= 4 && Math.abs(v[2] - alvo) <= 120; }).sort();
  const lista = cand.length ? cand : Object.keys(P.problemas).sort();
  const k = lista[hashDe("desafio|" + dia) % lista.length];
  x.desafiosDia[dia] = { ...(d || {}), k }; salvar();
  return k;
}
async function abrirDesafioDia(dia) {
  const P = await problemas(); if (!P) { toast("Os problemas ainda não chegaram."); return; }
  const k = desafioDe(P, dia), x = X(), s = { feitos: {} };
  const data = new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  resolverProblemas([k], P, s, {
    titulo: `Desafio de ${data}`,
    aoFim: () => {
      const d = x.desafiosDia[dia] ||= { k };
      const certo = !!s.feitos[k];
      if (!d.feito) { d.feito = true; d.certo = certo; d.em = hojeISO(); }
      else if (certo && !d.certo) d.depois = true;
      d.tentativas = (d.tentativas || 0) + 1;
      salvar();
      if (certo) toast(dia === hojeISO() ? `Desafio do dia resolvido! ${seqDesafios()} ${seqDesafios() === 1 ? "dia" : "dias"} seguidos.` : "Desafio resolvido.");
    },
  });
}
function seqDesafios() {
  const x = X(); let n = 0, d = hojeISO();
  if (!x.desafiosDia?.[d]?.feito) d = somaDias(d, -1);
  while (x.desafiosDia?.[d]?.feito && n < 3650) { n++; d = somaDias(d, -1); }
  return n;
}
let mesCal = null;
function calendarioDesafios(c) {
  const x = X(), hoje = hojeISO();
  mesCal ||= hoje.slice(0, 7);
  const [a, m] = mesCal.split("-").map(Number), ini = new Date(a, m - 1, 1), dias = new Date(a, m, 0).getDate(), pula = (ini.getDay() + 6) % 7;
  const nomeMes = ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (l) => l.toUpperCase());
  let html = "";
  for (let i = 0; i < pula; i++) html += "<span></span>";
  let feitos = 0, certos = 0;
  for (let d = 1; d <= dias; d++) {
    const dia = `${mesCal}-${String(d).padStart(2, "0")}`, r = x.desafiosDia?.[dia];
    const futuro = dia > hoje, antes = dia < INICIO_DESAFIOS;
    const cls = futuro || antes ? "fora" : r?.feito ? (r.certo ? "certo" : r.depois ? "depois" : "errou") : dia === hoje ? "hoje" : "falta";
    if (r?.feito) { feitos++; if (r.certo) certos++; }
    html += `<button data-dia="${dia}" class="${cls} ${dia === hoje ? "eh-hoje" : ""}" ${futuro || antes ? "disabled" : ""}>${d}${r?.feito ? `<i>${r.certo ? "✓" : r.depois ? "✓" : "✗"}</i>` : ""}</button>`;
  }
  c.innerHTML = `<div class="xz-cal-cab"><button data-mes="-1" aria-label="Mês anterior">${I.ant}</button><b>${nomeMes}</b><button data-mes="1" aria-label="Próximo mês">${I.prox}</button></div>
    <div class="xz-cal-sem">${["S", "T", "Q", "Q", "S", "S", "D"].map(s => `<span>${s}</span>`).join("")}</div>
    <div class="xz-cal">${html}</div>
    <p class="xz-dica-g">${feitos} ${feitos === 1 ? "desafio feito" : "desafios feitos"} no mês · ${certos} de primeira · sequência: ${seqDesafios()} 🔥. ✓ verde: de primeira; ✓ âmbar: depois de errar; ✗: errou (dá para tentar de novo).</p>
    ${x.desafiosDia?.[hoje]?.feito ? "" : `<button class="botao xz-des-hoje">Desafio de hoje</button>`}`;
  c.querySelectorAll("[data-mes]").forEach(b => (b.onclick = () => { const dt = new Date(a, m - 1 + +b.dataset.mes, 1); mesCal = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; calendarioDesafios(c); }));
  c.querySelectorAll("[data-dia]").forEach(b => (b.onclick = () => abrirDesafioDia(b.dataset.dia)));
  c.querySelector(".xz-des-hoje")?.addEventListener("click", () => abrirDesafioDia(hoje));
}

// ---------------------------------------------------------------- Desempenho: estatísticas e evolução
function anotarRating() {
  const x = X(), hoje = hojeISO();
  x.ratingHist ||= [];
  const u = x.ratingHist[x.ratingHist.length - 1];
  if (u?.d === hoje) u.r = Math.round(x.rating); else x.ratingHist.push({ d: hoje, r: Math.round(x.rating) });
  if (x.ratingHist.length > 400) x.ratingHist.splice(0, x.ratingHist.length - 400);
}
const ELO_ADV = (nivel) => (String(nivel).startsWith("M") ? +String(nivel).slice(1) : parseInt(String(M.NIVEIS.find(n => n.n === +nivel)?.elo || "1500").replace(/\D/g, ""), 10) || 1500);
/** Rating de desempenho nas partidas contra o computador (média dos adversários + 400 × (V − D) / N, nas últimas 30). */
function desempenhoPartidas(ps) {
  const fs = ps.filter(p => ["v", "d", "e"].includes(p.resultado)).slice(-30);
  if (fs.length < 3) return null;
  const med = fs.reduce((s, p) => s + ELO_ADV(p.nivel), 0) / fs.length, v = fs.filter(p => p.resultado === "v").length, d = fs.filter(p => p.resultado === "d").length;
  return Math.round(med + (400 * (v - d)) / fs.length);
}
function linhaSvg(pontos, { alto = 120, cor = "var(--acento)" } = {}) {
  if (pontos.length < 2) return "";
  const ys = pontos.map(p => p[1]), mn = Math.min(...ys) - 20, mx = Math.max(...ys) + 20, W = 300;
  const px = (i) => (i / (pontos.length - 1)) * W, py = (v) => alto - ((v - mn) / (mx - mn || 1)) * alto;
  const d = pontos.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(p[1]).toFixed(1)}`).join(" ");
  return `<svg class="xz-graf" viewBox="0 0 ${W} ${alto}" preserveAspectRatio="none"><path d="${d} L${W} ${alto} L0 ${alto}Z" fill="${cor}" opacity=".12"/><path d="${d}" fill="none" stroke="${cor}" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
    <div class="xz-graf-eixo"><span>${new Date(pontos[0][0] + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span><span>${Math.round(mn + 20)}–${Math.round(mx - 20)}</span><span>${new Date(pontos[pontos.length - 1][0] + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span></div>`;
}
function barrasSvg(vals, rotulos, { fmt = (v) => v } = {}) {
  const mx = Math.max(1, ...vals.map(v => (Array.isArray(v) ? v.reduce((a, b) => a + b, 0) : v)));
  return `<div class="xz-barras">${vals.map((v, i) => { const partes = Array.isArray(v) ? v : [v], tot = partes.reduce((a, b) => a + b, 0); return `<div title="${fmt(tot)}"><span>${partes.map((p, k) => `<i class="b${k}" style="height:${(p / mx) * 100}%"></i>`).join("")}</span><small>${rotulos[i]}</small></div>`; }).join("")}</div>`;
}
function semanasAtras(n) {
  const out = [], hoje = new Date(hojeISO() + "T12:00:00"), seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  for (let i = n - 1; i >= 0; i--) { const d = new Date(seg); d.setDate(seg.getDate() - 7 * i); out.push(d.toISOString().slice(0, 10)); }
  return out;
}
/** Cabeçalho de seção (ícone 3D, título, linha de apoio) usado nas abas Treinar e Desempenho. */
const cabSecao = (ico, titulo, sub = "", id = "") => `<header class="xz-secao-cab" ${id ? `id="xz-sec-${id}"` : ""}>${icone(ico, "ico3d")}<div><h2>${titulo}</h2>${sub ? `<small>${sub}</small>` : ""}</div></header>`;
const LADOS_ADV = [["alternar", "Alternar", "Uma revisão do seu lado, a seguinte do lado do adversário."], ["sempre", "Os dois", "Toda revisão vem duas vezes: primeiro o seu lado, depois o dele."], ["nunca", "Só o meu", "Você joga só os seus lances (na linha nova também)."]];

// ---------------------------------------------------------------- Treinar: o que se faz por conta própria
async function telaTreinar(t) {
  const x = X(), rep = await repertorio(), L = await licoes(), F = await finais(), P = await problemas();
  const lado = x.cfg.ladoAdv || "alternar", ladoInfo = LADOS_ADV.find(l => l[0] === lado);
  const { id: semId, tema } = semanaAtual(), sem = x.semana[semId];
  const listaSem = P ? listaDaSemana(P, sem, tema, semId, x.rating) : [];
  const feitosSem = listaSem.filter(k => sem?.feitos && k in sem.feitos).length, certosSem = listaSem.filter(k => sem?.feitos?.[k]).length;
  const dev = errosDevidos(), todosErros = Object.keys(x.erros || {}).length;
  const { n: nSem } = L.length ? licaoDaSemana(L) : { n: 0 };
  const dataLic = (i) => new Date(new Date("2026-10-26T12:00:00").getTime() + i * 7 * 864e5).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  t.innerHTML = `<nav class="xz-atalhos">${[["desafio", "🗓️", "Desafio"], ["aberturas", "📚", "Aberturas"], ["problemas", "🧩", "Problemas"], ["aulas", "🧑‍🏫", "Aulas"], ["analise", "🔍", "Análise"]].map(([k, ico, n]) => `<button data-ir="${k}">${icone(ico, "ico3d")}<span>${n}</span></button>`).join("")}</nav>
    ${cabSecao("🗓️", "Desafio do dia", `Uma posição por dia, com uma sequência de lances certos · ${seqDesafios()} 🔥`, "desafio")}
    <section class="xz-cartao"><div class="xz-cal-caixa"></div></section>

    ${cabSecao("📚", "Aberturas", "Treine qualquer linha quando quiser, do seu lado ou do lado do adversário", "aberturas")}
    <section class="xz-cartao xz-lado-cfg">
      <label class="xz-rotulo">Nas revisões, quem você joga</label>
      <div class="xz-seg" data-k="ladoAdv">${LADOS_ADV.map(([k, n]) => `<button data-v="${k}" class="${k === lado ? "on" : ""}">${n}</button>`).join("")}</div>
      <p class="xz-dica-g">${escapar(ladoInfo[2])} Para saber uma abertura, é preciso lembrar também as respostas do outro lado; na linha nova, depois de aprender o seu lado, você joga o do adversário.</p>
      <label class="xz-rotulo">Aberturas por dia na trilha</label>
      <div class="xz-seg" data-k="novas">${[1, 2, 3, 4].map(n => `<button data-v="${n}" class="${x.cfg.novas === n ? "on" : ""}">${n}</button>`).join("")}</div>
    </section>
    <section class="xz-cartao xz-aberturas-des">
      ${rep.capitulos.map(c => { const ls = c.linhas, v = ls.filter(l => x.linhas[l.id]?.vista).length, f = ls.filter(l => (x.linhas[l.id]?.caixa || 0) >= 4).length, meu = c.lado === "brancas" ? "w" : "b"; return `<details class="xz-capitulo"><summary><span class="xz-lado ${c.lado}">${c.lado === "brancas" ? "Brancas" : "Pretas"}</span><b>${escapar(c.nome)}</b><span class="xz-cap-barra"><i style="width:${(v / ls.length) * 100}%"></i><i class="f" style="width:${(f / ls.length) * 100}%"></i></span><small>${v}/${ls.length}</small></summary>
        ${ls.map(l => { const s2 = x.linhas[l.id]; const est = !s2?.vista ? ["nova", "Nova"] : (s2.caixa || 0) >= 4 ? ["dominada", "Firme"] : ["aprendendo", `Revisão ${s2.proxima <= hojeISO() ? "hoje" : new Date(s2.proxima + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`]; return `<div class="xz-linha xz-linha-t"><span><b>${escapar(l.nome)}</b><small>${escapar(l.eco)} · ${escapar(l.san.slice(0, 8).map((s3, i) => (i % 2 ? sanPT(s3) : `${i / 2 + 1}.${sanPT(s3)}`)).join(" "))}…</small></span><i class="xz-est ${est[0]}">${est[1]}</i>
          <div class="xz-linha-acoes"><button data-l="${l.id}" data-a="ver">Ver</button><button data-l="${l.id}" data-a="meu"><span class="xz-jog-cor ${meu}"></span>Meu lado</button><button data-l="${l.id}" data-a="adv"><span class="xz-jog-cor ${outraCor(meu)}"></span>Lado do adversário</button><button data-l="${l.id}" data-a="cont">${I.seguir}Continuar</button></div></div>`; }).join("")}</details>`; }).join("")}
    </section>

    ${cabSecao("🧩", "Problemas", `Seu nível nos problemas: ${Math.round(x.rating)}`, "problemas")}
    ${P ? `<section class="xz-cartao xz-tema-sem"><small class="xz-sobre">Tema da semana</small><h2>${escapar(tema.titulo)}</h2><p>${escapar(tema.texto)}</p>
      <div class="xz-grade">${listaSem.map(k => `<span class="${sem?.feitos && k in sem.feitos ? (sem.feitos[k] ? "ok" : "erro") : ""}">${P.problemas[k]?.[2] || ""}</span>`).join("")}</div>
      <p class="xz-dica-g">${feitosSem} de ${listaSem.length} feitos · ${certosSem} certos.</p>
      <button class="botao ${feitosSem >= listaSem.length ? "secundario" : ""} xz-res-sem">${feitosSem >= listaSem.length ? "Refazer os errados" : feitosSem ? "Continuar" : "Começar"}</button></section>` : `<section class="xz-cartao"><p class="xz-dica-g">Os problemas ainda não chegaram.</p></section>`}
    <div class="xz-caixa-corrida"></div>
    ${todosErros ? `<section class="xz-cartao xz-erros-card"><small class="xz-sobre">Seus erros das partidas</small><h2>${dev.length ? `${dev.length} para rever hoje` : "Nada para rever hoje"}</h2><p class="xz-dica-g">${todosErros} posições das suas partidas guardadas para treinar (ache o lance melhor). ${Object.values(x.erros).filter(e => e.caixa >= 4).length} já firmes.</p><button class="botao ${dev.length ? "" : "secundario"} xz-rever-erros">${dev.length ? "Rever agora" : "Treinar mesmo assim"}</button></section>` : ""}

    ${cabSecao("🧑‍🏫", "Aulas", "Uma lição por semana do caminho do Capablanca e os finais clássicos", "aulas")}
    ${L.length ? `<section class="xz-cartao xz-lics">${L.map((lic, i) => { const feita = !!x.licoes?.[lic.id], liberada = i <= nSem; return `<button class="xz-lic-item ${feita ? "feita" : ""} ${liberada ? "" : "bloq"} ${i === nSem && !feita ? "atual" : ""}" data-lic="${lic.id}"><span class="xz-lic-n">${feita ? "✓" : i + 1}</span><span><b>${escapar(lic.titulo)}</b><small>${escapar(lic.fonte)}${liberada ? (i === nSem ? " · lição desta semana" : "") : ` · libera em ${dataLic(i)}`}</small></span></button>`; }).join("")}</section>` : ""}
    <div class="xz-caixa-finais"></div>

    ${cabSecao("🔍", "Tabuleiro de análise", "Jogue à vontade com o Stockfish avaliando, ou importe uma partida para rever", "analise")}
    <div class="xz-caixa-analise"></div>`;
  secaoAnalise(t.querySelector(".xz-caixa-analise"));
  // atalhos
  t.querySelectorAll("[data-ir]").forEach(b => (b.onclick = () => raiz.querySelector(`#xz-sec-${b.dataset.ir}`)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  if (P) calendarioDesafios(t.querySelector(".xz-cal-caixa")); else t.querySelector(".xz-cal-caixa").innerHTML = `<p class="xz-dica-g">Os problemas ainda não chegaram.</p>`;
  t.querySelectorAll('[data-k="ladoAdv"] button').forEach(b => (b.onclick = () => { x.cfg.ladoAdv = b.dataset.v; salvar(); desenhar(); }));
  t.querySelectorAll('[data-k="novas"] button').forEach(b => (b.onclick = () => { x.cfg.novas = +b.dataset.v; if (x.planoDia && !x.planoDia.itens.some(i => i.feito)) x.planoDia = null; salvar(); desenhar(); }));
  t.querySelectorAll(".xz-linha-acoes button").forEach(b => (b.onclick = () => {
    const l = todasLinhas(rep).find(y => y.id === b.dataset.l); if (!l) return;
    if (b.dataset.a === "ver") return verLinha(l);
    if (b.dataset.a === "cont") return continuarJogo({ l });
    const cor = b.dataset.a === "meu" ? ladoDe(l) : outraCor(ladoDe(l));
    // linha nunca vista: aprende primeiro (pelo lado escolhido); vista: uma revisão daquele lado
    sessao([x.linhas[l.id]?.vista ? { tipo: "rever", ids: [l.id], cor } : { tipo: "aprender", id: l.id, cap: l.cap.id, cor }], { titulo: b.dataset.a === "meu" ? "Seu lado" : "Lado do adversário" });
  }));
  t.querySelector(".xz-res-sem")?.addEventListener("click", () => {
    const s2 = x.semana[semId] ||= { tema: tema.titulo, feitos: {} }; s2.lista ||= listaSem;
    const falta = s2.lista.filter(k => !(k in s2.feitos)), errados = s2.lista.filter(k => s2.feitos[k] === false);
    const fila = (falta.length ? falta : errados.length ? errados : s2.lista).slice(0, 10);
    resolverProblemas(fila, P, s2, { titulo: tema.titulo });
  });
  t.querySelector(".xz-rever-erros")?.addEventListener("click", () => { const d = errosDevidos(); revisarErros(d.length ? d : Object.entries(x.erros).map(([k, e]) => ({ k, ...e })).sort(() => Math.random() - 0.5).slice(0, 5)); });
  t.querySelectorAll(".xz-lic-item").forEach(b => (b.onclick = () => {
    if (b.classList.contains("bloq")) { b.classList.remove("nega"); void b.offsetWidth; b.classList.add("nega"); toast("Essa lição libera numa das próximas semanas."); return; }
    const lic = L.find(y => y.id === b.dataset.lic); if (lic) fazerLicao(lic);
  }));
  await cartaoCorrida(t.querySelector(".xz-caixa-corrida"));
  await cartaoFinais(t.querySelector(".xz-caixa-finais"));
}

// ---------------------------------------------------------------- Tabuleiro de análise (analise.js, 03/11/2026)
// O que a análise usa desta tela (camada, ícones, gráfico, repertório…); ao fechar, a lista de Treinar se atualiza.
function ctxAnalise(caixa) {
  return { camada, I, X, repertorio, aquecer, graficoAvaliacao, ligarGrafico, seloHTML, reiEm, aoFechar: () => { if (caixa?.isConnected) secaoAnalise(caixa); } };
}
function secaoAnalise(el) {
  if (!el) return;
  const salvas = analisesSalvas(), ctx = ctxAnalise(el);
  const data = (a) => { const d = (a.tags?.Date || "").replace(/\./g, "-"); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : new Date(a.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
  el.innerHTML = `<section class="xz-cartao xz-an-entrada">
      <div class="xz-an-modos"><button data-a="livre">${icone("♟️", "ico3d")}<b>Tabuleiro livre</b><small>Os dois lados</small></button><button data-a="importar">${icone("📥", "ico3d")}<b>Importar</b><small>PGN ou FEN</small></button><button data-a="linha">${icone("📚", "ico3d")}<b>Do repertório</b><small>Uma linha</small></button></div>
      <p class="xz-dica-g">Barra de avaliação, o melhor lance em seta azul e as 3 melhores linhas. Numa partida importada, "Analisar a partida" classifica cada lance (como no chess.com) e mostra a precisão de cada lado.</p>
    </section>
    ${salvas.length ? `<section class="xz-cartao xz-an-salvas"><small class="xz-sobre">Partidas salvas · ${salvas.length}${salvas.length >= MAX_SALVAS ? ` (as ${MAX_SALVAS} mais novas)` : ""}</small>${salvas.map(a => `<div class="xz-an-salva" data-id="${escapar(a.id)}"><button class="xz-an-abrir" data-id="${escapar(a.id)}"><b>${escapar(a.nome || "Análise")}</b><small>${escapar([data(a), `${Math.ceil(a.sans.length / 2)} ${Math.ceil(a.sans.length / 2) === 1 ? "lance" : "lances"}`, a.resultado && a.resultado !== "*" ? a.resultado : ""].filter(Boolean).join(" · "))}${a.prec ? ` · <span class="xz-an-p">precisão ${a.prec.w ?? "—"}% · ${a.prec.b ?? "—"}%</span>` : a.notas ? "" : " · sem análise"}</small></button><button class="xz-an-apagar" data-id="${escapar(a.id)}" aria-label="Apagar">${I.fechar}</button></div>`).join("")}</section>` : ""}`;
  el.querySelector('[data-a="livre"]').onclick = () => abrirAnalise(ctx, { origem: "livre" });
  el.querySelector('[data-a="importar"]').onclick = () => abrirImportar(ctx, (r) => abrirAnalise(ctx, r));
  el.querySelector('[data-a="linha"]').onclick = async () => { const rep = await repertorio(); escolherLinha(ctx, rep, (l, c) => abrirAnalise(ctx, { origem: "linha", sans: l.san, nome: l.nome, cor: c.lado === "brancas" ? "w" : "b" })); };
  el.querySelectorAll(".xz-an-abrir").forEach(b => (b.onclick = () => {
    const a = X().analises?.[b.dataset.id]; if (!a) return;
    abrirAnalise(ctx, { ...a, origem: "salva", origemAntes: a.origem, id: a.id, nome: a.nome });
  }));
  el.querySelectorAll(".xz-an-apagar").forEach(b => (b.onclick = () => {
    const linha = b.closest(".xz-an-salva");
    if (!linha.classList.contains("confirma")) { linha.classList.add("confirma"); b.setAttribute("aria-label", "Toque de novo para apagar"); toast("Toque de novo no × para apagar."); setTimeout(() => linha.classList.remove("confirma"), 3000); return; }
    apagarAnalise(b.dataset.id); secaoAnalise(el);
  }));
}

// ---------------------------------------------------------------- Desempenho: só os números e a evolução
/** A rotação dos ciclos (ciclos.js): o de hoje, o próximo e quantas vezes cada um foi feito. */
function rotacaoHTML() {
  const x = X(), hoje = hojeISO(), dias = x.ciclos.dias, n = CI.contagem(dias);
  const deHoje = CI.cicloDe(dias[hoje]?.c)?.id || null, prox = deHoje ? CI.proximoCiclo(deHoje) : CI.cicloDaVez(dias, hoje);
  const txt = deHoje
    ? `Hoje: ${CI.cicloDe(deHoje).curto.toLowerCase()}. Com ao menos um passo dele feito, o próximo dia com tempo traz ${CI.cicloDe(prox).curto.toLowerCase()}; sem nenhum, o de hoje volta uma vez.`
    : `Hoje sem ciclo (dia corrido): o próximo dia com tempo traz ${CI.cicloDe(prox).curto.toLowerCase()}.`;
  return `${cabSecao("🔁", "Rotação dos treinos", "Um ciclo por dia com tempo")}
    <section class="xz-cartao xz-rotacao"><div class="xz-rot-ciclos">${CI.CICLOS.map(c => { const k = n[c.id]; return `<div class="xz-rot ${c.id === deHoje ? "hoje" : c.id === prox ? "prox" : ""}" data-ciclo="${c.id}">${icone(c.icone, "ico3d")}<b>${escapar(c.curto)}</b>${c.id === deHoje ? "<i>hoje</i>" : c.id === prox ? "<i>próximo</i>" : ""}<small>feito ${k.feitos}×${k.parte ? ` · em parte ${k.parte}×` : ""}</small></div>`; }).join('<span class="xz-rot-seta">›</span>')}</div>
      <p class="xz-dica-g">${escapar(txt)}</p></section>`;
}
async function telaDesempenho(t) {
  const x = X(), rep = await repertorio(), L = await licoes(), F = await finais();
  if (x.rating != null && !(x.ratingHist || []).length) { anotarRating(); salvar(); }
  const ps = x.partidas || [], vit = ps.filter(p => p.resultado === "v").length, emp = ps.filter(p => p.resultado === "e").length, der = ps.filter(p => p.resultado === "d").length;
  const total = todasLinhas(rep).length, aprendidas = Object.values(x.linhas).filter(v => v.vista).length, firmes = Object.values(x.linhas).filter(v => (v.caixa || 0) >= 4).length;
  const semanas = semanasAtras(8), segIni = semanas[semanas.length - 1];
  const minSemana = Object.entries(x.dias || {}).filter(([d]) => d >= segIni).reduce((s, [, v]) => s + v, 0) / 60;
  const hist = x.ratingHist || [], h30 = hist.find(h => h.d >= somaDias(hojeISO(), -30));
  const delta = h30 ? Math.round(x.rating - h30.r) : 0, perf = desempenhoPartidas(ps);
  const precs = ps.filter(p => p.precisao != null).slice(-10), precMed = precs.length ? Math.round(precs.reduce((s, p) => s + p.precisao, 0) / precs.length) : null;
  const dd = Object.values(x.desafiosDia || {}).filter(d => d.feito), ddCertos = dd.filter(d => d.certo).length;
  const rotSem = semanas.map(s => s.slice(8, 10) + "/" + s.slice(5, 7));
  t.innerHTML = `<div class="xz-resumo-des">
      <div><b>${sequencia()} 🔥</b><small>dias seguidos de trilha</small></div>
      <div><b>${seqDesafios()} 🗓️</b><small>desafios do dia seguidos</small></div>
      <div><b>${Math.round(x.rating)}</b><small>nível nos problemas${delta ? ` <em class="${delta > 0 ? "sobe" : "desce"}">${delta > 0 ? "+" : ""}${delta} em 30 dias</em>` : ""}</small></div>
      <div><b>${vit}·${emp}·${der}</b><small>vitórias, empates e derrotas</small></div>
      <div><b>${aprendidas}<span>/${total}</span></b><small>linhas aprendidas · ${firmes} firmes</small></div>
      <div><b>${Math.round(minSemana)} min</b><small>de treino nesta semana</small></div>
    </div>
    ${cabSecao("📈", "Evolução", "Como você vem melhorando")}
    <section class="xz-cartao"><h2>Nível nos problemas</h2>${hist.length >= 2 ? linhaSvg(hist.map(h => [h.d, h.r])) : `<p class="xz-dica-g">O gráfico aparece depois de alguns dias resolvendo problemas (trilha de hoje, desafio do dia, corrida).</p>`}
      <h2>Partidas por semana</h2>${barrasSvg(semanas.map(s => { const fim = somaDias(s, 7), da = ps.filter(p => p.data?.slice(0, 10) >= s && p.data?.slice(0, 10) < fim); return [da.filter(p => p.resultado === "v").length, da.filter(p => p.resultado === "e").length, da.filter(p => p.resultado === "d").length]; }), rotSem)}
      <p class="xz-legenda"><i class="b0"></i>vitórias <i class="b1"></i>empates <i class="b2"></i>derrotas</p>
      <h2>Minutos de treino por semana</h2>${barrasSvg(semanas.map(s => { const fim = somaDias(s, 7); return Math.round(Object.entries(x.dias || {}).filter(([d]) => d >= s && d < fim).reduce((a, [, v]) => a + v, 0) / 60); }), rotSem)}</section>
    ${cabSecao("🤖", "Contra o computador", perf ? `Seu desempenho: ~${perf}` : "Jogue algumas partidas para ver a estimativa")}
    <section class="xz-cartao">
      <p class="xz-dica-g">${perf ? "Estimativa pelas últimas 30 partidas: a média dos adversários mais 400 × (vitórias − derrotas) ÷ partidas." : ""}${precMed != null ? ` Precisão média nas últimas analisadas: <b>${precMed}%</b>.` : ""}</p>
      <div class="xz-tab-des">${(() => { const grupos = new Map(); for (const p of ps) { const k = String(p.nivel); const g = grupos.get(k) || { v: 0, e: 0, d: 0 }; g[p.resultado] = (g[p.resultado] || 0) + 1; grupos.set(k, g); } return [...grupos].sort((a, b) => ELO_ADV(isNaN(+a[0]) ? a[0] : +a[0]) - ELO_ADV(isNaN(+b[0]) ? b[0] : +b[0])).map(([k, g]) => { const n = g.v + g.e + g.d, pts = n ? Math.round(((g.v + g.e / 2) / n) * 100) : 0; return `<div><span>${escapar(nomeAdv(isNaN(+k) ? k : +k, true))}</span><span>${g.v}·${g.e}·${g.d}</span><span class="xz-pct"><i style="width:${pts}%"></i></span><b>${pts}%</b></div>`; }).join("") || `<p class="xz-dica-g">Nenhuma partida ainda.</p>`; })()}</div>
      ${ps.length ? `<div class="xz-cores-des">${["w", "b"].map(c => { const da = ps.filter(p => p.cor === c), n = da.length, pts = n ? Math.round(((da.filter(p => p.resultado === "v").length + da.filter(p => p.resultado === "e").length / 2) / n) * 100) : 0; return `<div><span class="xz-jog-cor ${c}"></span><b>${pts}%</b><small>dos pontos de ${c === "w" ? "brancas" : "pretas"} (${n} ${n === 1 ? "partida" : "partidas"})</small></div>`; }).join("")}</div>` : ""}</section>
    ${cabSecao("📚", "Aberturas e treino", "O que já está firme")}
    <section class="xz-cartao">
      <div class="xz-caps-des">${rep.capitulos.map(c => { const ls = c.linhas, v = ls.filter(l => x.linhas[l.id]?.vista).length, f = ls.filter(l => (x.linhas[l.id]?.caixa || 0) >= 4).length; return `<div><span class="xz-lado ${c.lado}">${c.lado === "brancas" ? "B" : "P"}</span><b>${escapar(c.nome)}</b><span class="xz-cap-barra"><i style="width:${(v / ls.length) * 100}%"></i><i class="f" style="width:${(f / ls.length) * 100}%"></i></span><small>${v}/${ls.length}</small></div>`; }).join("")}</div>
      <p class="xz-legenda"><i class="b0"></i>aprendidas <i class="xz-leg-f"></i>firmes · para treinar uma linha, vá em Treinar → Aberturas</p>
      <div class="xz-marcos">
        <div><b>${escada().elo}</b><small>degrau da escada da Maia</small></div>
        <div><b>${x.corrida?.recorde || 0}</b><small>recorde na corrida de 3 min</small></div>
        <div><b>${dd.length}<span>${dd.length ? ` · ${Math.round((ddCertos / dd.length) * 100)}%` : ""}</span></b><small>desafios do dia${dd.length ? " · de primeira" : ""}</small></div>
        <div><b>${Object.keys(x.licoes || {}).filter(k => !k.startsWith("fin-")).length}/${L.length}</b><small>lições do Capablanca</small></div>
        <div><b>${F.filter(f => x.finais?.[f.id]?.pratica).length}/${F.length}</b><small>finais praticados</small></div>
        <div><b>${Object.keys(x.trofeus || {}).length} · ${Object.keys(x.desafios || {}).length}</b><small>troféus de seção · desafios de abertura</small></div>
        <div><b>${(x.continuar || []).filter(c => c.ok).length}/${(x.continuar || []).length}</b><small>continuar depois da abertura · objetivos cumpridos</small></div>
      </div></section>
    ${rotacaoHTML()}
    ${(() => { const a = cfgAmigo(), q4 = cfgQuatro(); if (!a.partidas.length && !q4.partidas.length) return ""; const porV = new Map(); for (const p of a.partidas) porV.set(p.variante, (porV.get(p.variante) || 0) + 1); const porM = new Map(); for (const p of q4.partidas) porM.set(p.modo, (porM.get(p.modo) || 0) + 1); return `${cabSecao("🤝", "Com amigos", `${a.partidas.length + q4.partidas.length} ${a.partidas.length + q4.partidas.length === 1 ? "partida" : "partidas"} no tablet`)}<section class="xz-cartao">${a.partidas.length ? `<h2>Dois jogadores</h2><div class="xz-marcos">${[...porV].sort((p, q) => q[1] - p[1]).map(([vv, n]) => `<div><b>${n}</b><small>${escapar(VARIANTES.find(y => y.id === vv)?.nome || vv)}</small></div>`).join("")}</div>` : ""}${q4.partidas.length ? `<h2>Quatro jogadores</h2><div class="xz-marcos">${[...porM].sort((p, q) => q[1] - p[1]).map(([mm, n]) => `<div><b>${n}</b><small>${escapar(MODOS4.find(y => y.id === mm)?.nome || mm)}</small></div>`).join("")}</div>` : ""}</section>`; })()}`;
}

// ---------------------------------------------------------------- Aparência do tabuleiro e das peças
// Pedido do Alediov (26/10/2026): personalizar o tabuleiro e as peças, com peças 2.5D (as do modo 3D do lichess).
let LISTA_VISUAL = null;
async function listaVisual() { if (!LISTA_VISUAL) { try { LISTA_VISUAL = await (await fetch("vendor/pecas/lista.json")).json(); } catch { LISTA_VISUAL = { pecas2d: {}, pecas3d: {}, tabuleiros: {}, cores: {} }; } } return LISTA_VISUAL; }
// as cores de antes (se a lista não carregar)
const CORES_TAB = { marrom: ["Marrom", "#F0D9B5", "#B58863"], verde: ["Verde", "#EEEED2", "#769656"], azul: ["Azul", "#DEE3E6", "#8CA2AD"], roxo: ["Roxo", "#EFE6FA", "#9C7CC9"], cinza: ["Cinza", "#E3E3E3", "#A5A5A5"], coral: ["Coral", "#F5E1D9", "#D98B73"], oceano: ["Oceano", "#D6E9F2", "#4E8BB0"], noite: ["Noite", "#7C8494", "#4A505E"] };
// Pedidos do Alediov (02/11/2026): TODOS os temas do lichess, em ordem alfabética dentro de cada grupo (a lista vem
// ordenada do montar_aparencia.py), e as prévias dos tabuleiros com o mesmo recorte de 4 × 4 casas.
async function abrirAparencia() {
  const x = X(), lista = await listaVisual(), v = x.cfg.visual;
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><span class="xz-p-tit">Tabuleiro e peças</span></div>
    <div class="xz-s-tab"></div><div class="xz-ap"></div>`, "aparencia");
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"), { ferramentas: false });
  tab.posicao("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", { ultimo: ["g8", "f6"] });
  tab.setas([{ de: "f3", para: "g5", cor: "verde" }]);
  const pecas2 = Object.entries(lista.pecas2d || {}), cegas = Object.entries(lista.cegas || {}), pecas3 = Object.entries(lista.pecas3d || {});
  const cores = Object.entries(lista.cores && Object.keys(lista.cores).length ? lista.cores : CORES_TAB), texturas = Object.entries(lista.tabuleiros || {});
  const grupo = (titulo, n, corpo) => `<label class="xz-rotulo">${titulo} <small>${n}</small></label>${corpo}`;
  const botaoPeca = (k, n) => `<button data-p="${k}" class="${v.pecas === k ? "on" : ""}"><span class="xz-amostra ${k.startsWith("3d-") ? `pecas-3d pc3-${k.slice(3)}` : k === "cburnett" ? "" : "pc-" + k}"><i class="xz-p wn"></i><i class="xz-p bq"></i></span><small>${escapar(n)}</small></button>`;
  const caixa = ov.querySelector(".xz-ap");
  const pintar = () => {
    caixa.innerHTML = grupo("Peças 2.5D", pecas3.length, `<div class="xz-ap-pecas">${pecas3.map(([k, n]) => botaoPeca("3d-" + k, n)).join("")}</div>`)
      + grupo("Peças 2D", pecas2.length, `<div class="xz-ap-pecas">${pecas2.map(([k, n]) => botaoPeca(k, n)).join("")}</div>`)
      + (cegas.length ? grupo("Peças para treinar às cegas", cegas.length, `<div class="xz-ap-pecas">${cegas.map(([k, n]) => botaoPeca(k, n)).join("")}</div><p class="xz-dica-g">Sem cor: as peças das brancas e das pretas iguais. Disfarçadas: todas as peças com o mesmo desenho. Um desafio para treinar a memória do tabuleiro.</p>`) : "")
      + grupo("Tabuleiro: cores", cores.length, `<div class="xz-ap-tabs">${cores.map(([k, [n, c1, c2]]) => `<button data-t="${k}" class="${v.tabuleiro === k ? "on" : ""}"><span class="xz-amostra-tab" style="--c1:${c1};--c2:${c2}"></span><small>${escapar(n)}</small></button>`).join("")}</div>`)
      + grupo("Tabuleiro: texturas", texturas.length, `<div class="xz-ap-tabs">${texturas.map(([k, [n, ext]]) => `<button data-t="tx-${k}" class="${v.tabuleiro === "tx-" + k ? "on" : ""}"><span class="xz-amostra-tab textura" style="background-image:url(vendor/tabuleiros/${k}${ext})"></span><small>${escapar(n)}</small></button>`).join("")}</div>`)
      + `<label class="xz-rotulo">Mostrar</label>
      <div class="xz-ap-opcoes"><label><input type="checkbox" data-o="coords" ${v.coords !== false ? "checked" : ""}> Coordenadas (a–h, 1–8)</label><label><input type="checkbox" data-o="lances" ${v.lances !== false ? "checked" : ""}> Pontos dos lances possíveis</label></div>
      <p class="xz-dica-g">Em qualquer tabuleiro: segure uma casa e arraste até outra para traçar uma seta; segure e solte para pintar a casa. Repetir troca a cor (verde, vermelha, azul, amarela) e, na quinta vez, apaga. Com mouse, use o botão direito. Os desenhos somem quando alguém joga. Os ajustes do treino ficam na engrenagem, ao lado da paleta.</p>`;
    caixa.querySelectorAll("[data-p]").forEach(b => (b.onclick = () => { v.pecas = b.dataset.p; aplicar(); }));
    caixa.querySelectorAll("[data-t]").forEach(b => (b.onclick = () => { v.tabuleiro = b.dataset.t; aplicar(); }));
    caixa.querySelectorAll("[data-o]").forEach(i => (i.onchange = () => { v[i.dataset.o] = i.checked; aplicar(); }));
  };
  const aplicar = () => { const y = caixa.scrollTop, yo = ov.scrollTop; salvar(); definirVisual(v); pintar(); caixa.scrollTop = y; ov.scrollTop = yo; tocar("toque"); };
  ov.querySelector(".xz-s-fechar").onclick = () => { ov.remove(); desenhar(); };
  pintar();
}

// ---------------------------------------------------------------- Ajustes do Xadrez (a engrenagem do topo)
// As configurações que estavam espalhadas (lado do adversário e aberturas por dia, em Treinar; relógio e motor, em
// Jogar) continuam onde ele já usa e aparecem também aqui, junto com as novas: a barra de avaliação, os ícones da
// classificação dos lances, as setas das explicações e o exercício de continuar depois da abertura.
async function abrirConfig() {
  const x = X(), c = x.cfg;
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><span class="xz-p-tit">Ajustes do Xadrez</span></div><div class="xz-cfg"></div>`, "config");
  const caixa = ov.querySelector(".xz-cfg");
  const seg = (k, ops, atual) => `<div class="xz-seg" data-k="${k}">${ops.map(([v, n]) => `<button data-v="${v}" class="${String(atual) === String(v) ? "on" : ""}">${escapar(n)}</button>`).join("")}</div>`;
  const chave = (k, txt, sub = "") => `<label class="xz-chave"><span><b>${escapar(txt)}</b>${sub ? `<small>${escapar(sub)}</small>` : ""}</span><input type="checkbox" data-c="${k}" ${c[k] !== false ? "checked" : ""}></label>`;
  const pintar = () => {
    caixa.innerHTML = `${cabSecao("📚", "Treino de aberturas", "A trilha das aberturas e as revisões")}
      <section class="xz-cartao">
        ${chave("barra", "Barra de avaliação", "Ao lado do tabuleiro: o quanto a posição está parelha (avaliação do Stockfish).")}
        ${chave("selos", "Classificação dos lances", "Os ícones do chess.com: Livro, Melhor, Excelente, Imprecisão, Erro…")}
        ${chave("explicar", "Setas e casas nas explicações", "Azul: o plano; vermelho: a ameaça; casas em destaque.")}
        <label class="xz-rotulo">Nas revisões, quem você joga</label>${seg("ladoAdv", LADOS_ADV.map(([k, n]) => [k, n]), c.ladoAdv || "alternar")}
        <p class="xz-dica-g">${escapar(LADOS_ADV.find(l => l[0] === (c.ladoAdv || "alternar"))[2])}</p>
        <label class="xz-rotulo">Aberturas por dia na trilha</label>${seg("novas", [1, 2, 3, 4].map(n => [n, String(n)]), c.novas)}
        <button class="botao secundario xz-cfg-termos">Ver o glossário (${Object.keys(GLOSSARIO).length} termos)</button>
      </section>
      ${cabSecao("➡️", "Continuar depois da abertura", "Jogar alguns lances a partir do fim de uma linha")}
      <section class="xz-cartao">
        <label class="xz-rotulo">Adversário</label>${seg("contAdv", [["maia", `Maia ${escada().elo} (a sua escada)`], ...[3, 4, 5, 6].map(n => [n, `Stockfish ${n}`])], c.contAdv ?? "maia")}
        <label class="xz-rotulo">Lances seus</label>${seg("contLances", [[6, "6"], [8, "8"], [10, "10"], [12, "12"]], c.contLances || 10)}
      </section>
      ${cabSecao("⚔️", "Partidas", "Contra o computador")}
      <section class="xz-cartao">
        <label class="xz-rotulo">Relógio padrão</label>${seg("relogio", RELOGIOS, c.relogio || "")}
        <p class="xz-dica-g">O motor, o nível e a cor ficam na aba Jogar.</p>
      </section>
      ${cabSecao("🎨", "Aparência", "Tabuleiro e peças")}
      <section class="xz-cartao"><button class="botao secundario xz-cfg-ap">${I.paleta}<span>Abrir tabuleiro e peças</span></button></section>`;
    caixa.querySelectorAll("[data-c]").forEach(i => (i.onchange = () => { c[i.dataset.c] = i.checked; salvar(); tocar("toque"); }));
    caixa.querySelectorAll(".xz-seg").forEach(sg => sg.querySelectorAll("button").forEach(b => (b.onclick = () => {
      const k = sg.dataset.k, v = b.dataset.v;
      c[k] = ["novas", "contLances"].includes(k) || (k === "contAdv" && v !== "maia") ? +v : v;
      if (k === "novas" && x.planoDia && !x.planoDia.itens.some(i => i.feito)) x.planoDia = null;
      salvar(); tocar("toque"); pintar();
    })));
    caixa.querySelector(".xz-cfg-ap").onclick = () => { ov.remove(); abrirAparencia(); };
    caixa.querySelector(".xz-cfg-termos").onclick = () => {
      const lst = Object.entries(GLOSSARIO).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
      caixa.querySelector(".xz-cfg-termos").outerHTML = `<dl class="xz-glossario">${lst.map(([t, d]) => `<dt>${escapar(t)}</dt><dd>${escapar(d)}</dd>`).join("")}</dl>`;
    };
  };
  ov.querySelector(".xz-s-fechar").onclick = () => { ov.remove(); desenhar(); };
  pintar();
}
