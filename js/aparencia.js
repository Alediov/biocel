// Aparência do Órbita (29/10/2026, pedido do Alediov: "padrão entre os subapps… todos com opções de fundo iguais: o
// tema claro, o escuro (AMOLED), as imagens em anexo e ter ou não bolhas"). Uma escolha vale para todos os subapps
// (config.visual {fundo, animado, tipos}) e cada um pode ter a sua (config.visualArea[area]); o tema continua em
// config.tema. Desde 02/11/2026 o fundo, as partículas e a folha moram em aparenciaComum.js + particulas.js, que o
// OdontoScan.html do computador também usa; aqui ficam só o que é do app: o config, as camadas e a lição.
// Cada área recebe na raiz (o <body> nos Estudos, a camada nas outras):
//   .com-imagem + --fundo-img (a imagem, com um véu na cor do tema) ou .sem-imagem
//   data-bolhas="sim" | "nao" (partículas ligadas) e data-particulas="bolhas,estrelas,…"
// A lição (02/11/2026, "Eu gostaria que o fundo também se aplicasse aos exercícios"): um fundo de tela cheia atrás da
// coluna da lição (.orb-fundo-licao, com as partículas), que fica transparente. O CSS está em app/aparencia.css.
import { E, salvar } from "./estado.js";
import { modal } from "./ui.js";
import { FUNDOS, resolverVisual, migrarVisual, aplicarAparencia as aplicarNa, htmlFolha, ligarFolha } from "./aparenciaComum.js";
import { desligarParticulas, ligarParticulas } from "./particulas.js";
import { particulasDaArea } from "./scan/visual.js";

export { FUNDOS };
export const AREAS_VISUAL = [["learn", "Estudos"], ["scan", "Iniciação Científica"], ["musicas", "Músicas"], ["leitura", "Leitura"], ["xadrez", "Xadrez"], ["financas", "Finanças"], ["clima", "Clima"], ["cofre", "Cofre"], ["eva", "Mensagens"]];
const CAMADAS = { "camada-home": "home", "camada-scan": "scan", "camada-musicas": "musicas", "camada-leitura": "leitura", "camada-xadrez": "xadrez", "camada-financas": "financas", "camada-clima": "clima", "camada-cofre": "cofre", "camada-eva": "eva" };

const cfg = () => E().config;
/** O que vale numa área: { fundo, animado, tipos }. */
export function visualDe(area) {
  return resolverVisual(cfg().visual, (area && area !== "home" && cfg().visualArea?.[area]) || {});
}

const temCamada = () => document.querySelector(Object.keys(CAMADAS).map(c => `.${c}`).join(", "));
const cobreEstudos = () => document.querySelector(".jogo-camada, .sim-tela.aberto, #camada-licao:not([hidden])");
function ativoDe(el, area) {
  if (area === "learn") return () => !document.hidden && !temCamada() && !cobreEstudos();
  return () => !document.hidden && (area === "home" || !document.querySelector(".camada-home")) && !el.classList.contains("com-camada");
}

/** Aplica fundo e partículas na raiz `el` da área `area`. */
export function aplicarEm(el, area) {
  if (!el) return;
  const v = visualDe(area);
  if (area === "scan") { // o canvas do Scanner fica no .os (a própria camada, ou dentro dela na lista de projetos)
    aplicarNa(el, v, { particulas: false });
    const os = el.matches(".os") ? el : el.querySelector(".os");
    if (os) particulasDaArea(os);
    return;
  }
  if (area === "musicas") { // as Músicas têm as bolhas próprias (CSS); com outros tipos, o canvas comum no lugar delas
    const proprias = v.tipos.length === 1 && v.tipos[0] === "bolhas";
    aplicarNa(el, v, { particulas: false });
    el.dataset.proprias = proprias ? "sim" : "nao";
    if (v.animado && !proprias) ligarParticulas(el, { ativo: ativoDe(el, area), tipos: v.tipos }); else desligarParticulas(el);
    return;
  }
  aplicarNa(el, v, { ativo: ativoDe(el, area) });
}

/** Aplica em tudo o que está aberto (os Estudos, as camadas e a lição). Com `raiz` e `area`, só nela. */
export function aplicarAparencia(raiz = null, area = null) {
  if (raiz) return aplicarEm(raiz, area || "learn");
  aplicarEm(document.body, "learn");
  for (const [c, area] of Object.entries(CAMADAS)) document.querySelectorAll(`.${c}`).forEach(el => aplicarEm(el, area));
  fundoDaLicao();
}

// ---------- a lição: fundo de tela cheia com as partículas, atrás da coluna ----------
function fundoDaLicao() {
  const lic = document.getElementById("camada-licao");
  if (!lic) return;
  let f = document.querySelector("body > .orb-fundo-licao");
  if (lic.hidden) { if (f) { f.hidden = true; desligarParticulas(f); } return; }
  if (!f) { f = document.createElement("div"); f.className = "orb-fundo-licao"; f.setAttribute("aria-hidden", "true"); }
  if (f.nextElementSibling !== lic) lic.before(f);
  f.hidden = false;
  aplicarNa(f, visualDe("learn"), { ativo: () => !document.hidden && !lic.hidden && !document.querySelector(".camada-home") });
}

/** Passa o nome antigo (`bolhas`) para `animado`, uma vez. */
function migrar() {
  const c = cfg();
  let mudou = migrarVisual(c.visual);
  for (const o of Object.values(c.visualArea || {})) mudou = migrarVisual(o) || mudou;
  if (mudou) salvar();
}

let ligado = false;
/** Uma vez, no começo do app: aplica e fica olhando as camadas que abrem e a lição. */
export function iniciarAparencia() {
  migrar();
  aplicarAparencia();
  if (ligado) return;
  ligado = true;
  new MutationObserver((ms) => {
    for (const m of ms) {
      // a área redesenhou por inteiro (innerHTML) e levou o canvas das partículas junto: põe de novo
      const t = m.target, ca = t.nodeType === 1 && [...t.classList].find(x => CAMADAS[x]);
      if (ca && [...m.removedNodes].some(n => n.nodeType === 1 && n.classList.contains("orb-bolhas")) && !t.querySelector(":scope > .orb-bolhas")) aplicarEm(t, CAMADAS[ca]);
    }
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      const c = [...n.classList].find(x => CAMADAS[x]);
      if (c) aplicarEm(n, CAMADAS[c]);
      else if (n.classList.contains("os") && n.closest(".camada-scan")) aplicarEm(n.closest(".camada-scan"), "scan");
    }
  }).observe(document.body, { childList: true, subtree: true });
  const lic = document.getElementById("camada-licao");
  if (lic) new MutationObserver(fundoDaLicao).observe(lic, { attributes: true, attributeFilter: ["hidden"] });
  // o Scanner (e as variações que vierem) pede a folha por um evento: o arquivo avulso não pode importar o app
  document.addEventListener("orbita:abrir-aparencia", () => abrirAparencia());
}

// ---------- a folha "Aparência" ----------
/** Abre a folha (de qualquer área). `aoTema()`: chamado quando o tema muda (o app reaplica o tema). */
export function abrirAparencia({ aoTema } = {}) {
  const c = cfg();
  migrar();
  const p = modal({ titulo: "", html: htmlFolha(c, { sub: "" }), botoes: [{ texto: "Pronto", valor: true }] });
  const m = document.getElementById("modal");
  ligarFolha(m, c, { aoTema: () => aoTema?.(), aoMudar: () => { salvar(); aplicarAparencia(); } });
  return p;
}
