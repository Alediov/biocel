// Músicas do Órbita (24/10/2026): biblioteca da pasta Músicas (uma subpasta por artista), tocador que segue com a
// tela apagada, estrelas com meia estrela, playlists (Estudos e Favoritas fixas, comuns e inteligentes, com regras
// de inclusão e exclusão), tags internas (de versão, pelos parênteses do título, e de grupo, à mão), editor de tags
// com busca automática e o teclado próprio com previsões, editor de áudio (Sped Up) e estatísticas.
// O plano das fases fica em docs/plano-musicas.md.
import * as B from "./biblioteca.js";
import * as BD from "./banco.js";
import * as ED from "./editor.js";
import { buscarTags, completarDeezer, camposDoCandidato, baixarImagem, artistasDeezer, discografiaDeezer, artistaDeezer, resolverLinkDeezer, notaCandidato } from "./busca.js";
import { romajiParaMostrar, chaveSom, temKana } from "./romaji.js";
import { tituloNoPadrao as padronizarTitulo } from "./tagsInternas.js";
import { criarRolagem, rotuloDaOrdem, grupoDe } from "./rolagem.js";
import { partesTag, nomeEmUso, ordenarTags, ordenarGrupos, ORDENS_TAGS, ORDEM_PADRAO, tituloDoArquivo } from "./nomes.js";
export { partesTag };
import { icone as icone3d } from "../icones.js";
import { analisarTitulo, montarTitulo, tagsDaFaixa, corDaTag, normTag, chaveConjunto, versoes as versoesDeTag } from "./tagsInternas.js";
const tiposDaFaixa = (f) => tagsDaFaixa(f).versoes;
import * as IN from "./inteligentes.js";
import { ligarTeclado } from "../scan/teclado.js";
import { motor, nativo } from "./motor.js";
import { E, salvar } from "../estado.js";
import { reavaliarMusica } from "../musica.js";
import { modal, toast, formulario, escapar } from "../ui.js";
import { barraTempo } from "./barraTempo.js";
import { paletaDaImagem, paletaDeCor, destaque, paraFundo, lerCor, ehEscura, css as cssCor } from "./cores.js";

let raiz = null, opts = {}, aba = "artistas", sub = null, busca = "", ordem = "titulo", periodo = 30;
// O aleatório é feito aqui (a fila já vai embaralhada, com a escolhida na frente): assim "Tocar a seguir" é mesmo a seguir.
let estado = {}, filaAtual = [], listaBase = [], aleatorio = false, timer = null, sincronizando = null, ultimoId = null;
const $ = (s, el = raiz) => el.querySelector(s);
let cfgT = { transicao: 0, igualar: true, radio: false }; // ajustes do tocador (B.cfgTocador)
let progVol = null; // { feitas, total } da medição do volume
let progGen = null; // { feitas, total } da análise dos gêneros pelo som
let pedidoRetro = null; // abrir a retrospectiva assim que a tela estiver pronta (vindo da Temporada)
let tecl = null; // teclado próprio (o mesmo do Scanner), com as previsões de artista e gênero
let filtroArt = "todos"; // aba Artistas: todos, conferir, completos, naoSeAplica
const avulsos = new Map(); // itens da pasta de entrada (fora da biblioteca), para as capas
let ouvindoNotasDeFora = false; // o ouvinte de "orbita:notas-de-fora" (notaNativa.js) é registrado uma vez só

// ---------- ícones ----------
const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
// playlist fixa Alarme (o despertador do Órbita, alarmes.js)
const DESPERTADOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.2l2.6 1.6M4.2 5.6l2.6-2.2M19.8 5.6l-2.6-2.2M7 19.6l-1.4 1.8M17 19.6l1.4 1.8"/></svg>';
const I = {
  onda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/></svg>',
  lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10 11v6M14 11v6"/></svg>',
  certo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 12.5 4 4 8-9"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>',
  traco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h10"/></svg>',
  lupaDisco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="1.6"/><path d="m15 15 5 5"/></svg>',
  jogo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.5l-.8 3.6a2.3 2.3 0 0 1-4 .9L14.5 16h-5l-1.6 2a2.3 2.3 0 0 1-4-.9l-.8-3.6A4.5 4.5 0 0 1 7.5 8z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="17" cy="13.3" r=".6" fill="currentColor"/></svg>',
  filme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="m3.6 9 1-4.2 16.2 2.9-.5 1.3M8.2 5.4l1.3 3.6M13.5 6.3l1.3 2.7"/></svg>',
  tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="6.5" width="18" height="12.5" rx="2"/><path d="m8.5 3 3.5 3.5L15.5 3M8 22h8"/></svg>',
  flor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><ellipse cx="12" cy="7.2" rx="2.9" ry="4.1" transform="rotate(0 12 12)"/><ellipse cx="12" cy="7.2" rx="2.9" ry="4.1" transform="rotate(72 12 12)"/><ellipse cx="12" cy="7.2" rx="2.9" ry="4.1" transform="rotate(144 12 12)"/><ellipse cx="12" cy="7.2" rx="2.9" ry="4.1" transform="rotate(216 12 12)"/><ellipse cx="12" cy="7.2" rx="2.9" ry="4.1" transform="rotate(288 12 12)"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
  microfone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>',
  nuvem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M12 15.5v-5M9.8 12.6 12 10.4l2.2 2.2"/></svg>',
  pasta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.3A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  pausa: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
  prox: '<svg viewBox="0 0 24 24"><path d="M6 6v12l8.5-6z" fill="currentColor"/><rect x="16" y="6" width="2.6" height="12" rx="1" fill="currentColor"/></svg>',
  ant: '<svg viewBox="0 0 24 24"><path d="M18 6v12L9.5 12z" fill="currentColor"/><rect x="5.4" y="6" width="2.6" height="12" rx="1" fill="currentColor"/></svg>',
  aleat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6c1.1 1.7 2.3 2.7 4.3 2.7H21"/><path d="M3 17h3.5c1.2 0 2.1-.4 2.9-1.1M14.6 8.1c.8-.7 1.7-1.1 2.9-1.1H21"/><path d="M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5"/></svg>',
  repetir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>',
  busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  baixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>',
  fila: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h12M4 11h12M4 16h7"/><path d="M16 14.5v6l4.5-3z" fill="currentColor" stroke="none"/></svg>',
  livro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 6.5C9.8 5 6.8 4.6 3.5 5.2v13c3.3-.6 6.3-.2 8.5 1.3 2.2-1.5 5.2-1.9 8.5-1.3v-13C17.2 4.6 14.2 5 12 6.5z"/><path d="M12 6.5v13"/></svg>',
  nota: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
  coracao: '<svg viewBox="0 0 24 24"><path d="M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.2 0 5.4 3 4.3 6.4-1.6 4.8-9.2 9.4-9.2 9.4z" fill="var(--cheio, none)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  grafico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/></svg>',
  varinha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 15 9"/><path d="m13.5 7.5 3 3"/><path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M9 3v2M8 4h2"/></svg>',
  mais2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  etiqueta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-7 7a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.3" cy="8.3" r="1.6"/></svg>',
  fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  lua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/></svg>',
  compartilhar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  ordem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9M4 12h6M4 18h3M17 5v14M14 16l3 3 3-3"/></svg>',
  trocar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
};
const ESTRELA = "M12 2.8l2.85 5.95 6.55.8-4.8 4.5 1.2 6.5L12 17.4l-5.8 3.15 1.2-6.5-4.8-4.5 6.55-.8z";

// ---------- utilidades ----------
const tempo = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const cor = (txt) => { let h = 0; for (const c of txt || "?") h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 55% 52%)`; };
const inicial = (txt) => (txt || "?").trim().charAt(0).toUpperCase();
const textoNota = (n) => n ? `${String(n / 2).replace(".", ",")} ★` : "";

/** Estrelas com meia estrela (0 a 10). Com `aoMudar`, tocar na metade esquerda dá meia; tocar no valor atual zera. */
export function estrelas(nota = 0, { aoMudar = null, classe = "" } = {}) {
  const el = document.createElement("span");
  el.className = `mu-est ${aoMudar ? "editavel" : ""} ${classe}`;
  const pintar = (n) => {
    el.dataset.n = n;
    el.setAttribute("aria-label", n ? `${n / 2} de 5 estrelas` : "Sem estrelas");
    el.querySelectorAll(".mu-e-cheia").forEach((c, i) => { c.style.width = `${Math.max(0, Math.min(2, n - i * 2)) * 50}%`; });
  };
  el.innerHTML = Array.from({ length: 5 }, () => `<span class="mu-e"><svg viewBox="0 0 24 24"><path d="${ESTRELA}"/></svg><span class="mu-e-cheia"><svg viewBox="0 0 24 24"><path d="${ESTRELA}"/></svg></span></span>`).join("");
  pintar(nota);
  if (aoMudar) {
    el.setAttribute("role", "slider");
    el.onclick = (ev) => {
      ev.stopPropagation();
      const e = ev.target.closest(".mu-e"); if (!e) return;
      const i = [...el.children].indexOf(e), r = e.getBoundingClientRect();
      let n = i * 2 + (ev.clientX - r.left < r.width / 2 ? 1 : 2);
      if (n === +el.dataset.n) n = 0;
      pintar(n); aoMudar(n);
    };
  }
  el.pintar = pintar;
  return el;
}

// capas: carregadas só quando aparecem na tela
let obsCapa = null;
let rolar = null, rolagemPendente = null; // barra de rolagem rápida (rolagem.js, 31/10/2026) e a lista que a pediu
// três tamanhos: listas (miniatura), grade e cabeçalhos (média) e a tela Tocando (a capa original, sem perda)
function capa(f, classe = "") {
  const el = document.createElement("span");
  el.className = `mu-capa ${classe}`;
  el.style.setProperty("--c", cor(f?.artista || f?.titulo));
  el.textContent = inicial(f?.artista || f?.titulo);
  if (f?.temCapa) {
    el.dataset.id = f.id;
    el.dataset.tam = /enorme/.test(classe) ? "original" : /quadrada|grande/.test(classe) ? "media" : "mini";
    if (f.entrada) avulsos.set(f.id, f);
    obsCapa?.observe(el);
  }
  return el;
}
async function pintarCapa(el) {
  const f = (await B.faixa(el.dataset.id)) || avulsos.get(el.dataset.id);
  const tam = el.dataset.tam || "mini";
  const por = async (d) => {
    if (!d) return;
    const img = new Image(); img.src = d;
    try { await img.decode(); } catch { /* mostra assim mesmo */ }
    el.style.backgroundImage = `url("${d}")`; el.classList.add("com-img"); el.textContent = "";
  };
  if (tam !== "mini") B.capaDe(f, "mini").then(d => { if (!el.dataset.pronta) por(d); });
  const d = await B.capaDe(f, tam);
  if (d) { el.dataset.pronta = "1"; await por(d); }
}

// ---------- abrir ----------
export async function abrirTelaMusicas(alvo, o = {}) {
  raiz = alvo; opts = o;
  raiz.classList.add("mu");
  raiz.innerHTML = `
    <header class="mu-topo">
      <button class="mu-area" aria-label="Trocar de área"><span class="mu-logo">${o.logo || ""}</span><span><b>Músicas</b><small>Trocar de Área ▾</small></span></button>
      <span class="mu-sinc" hidden></span>
      <button class="mu-icone" data-acao="stats" aria-label="Estatísticas">${I.grafico}</button>
      <button class="mu-icone" data-acao="busca" aria-label="Buscar">${I.busca}</button>
      <button class="mu-icone" data-acao="ajustes" aria-label="Ajustes">${I.ajustes}</button>
    </header>
    <div class="mu-busca" hidden><input type="search" placeholder="Música ou artista" aria-label="Buscar música ou artista"></div>
    <nav class="mu-abas"><button data-aba="artistas">Artistas</button><button data-aba="musicas">Músicas</button><button data-aba="albuns">Playlists</button><button data-aba="tags">Tags</button><button data-aba="editar">Edição<i class="mu-badge" hidden></i></button><i class="mu-abas-ind" aria-hidden="true"></i></nav>
    <main class="mu-tela"></main>
    <div class="mu-mini" hidden></div>
    <div class="mu-tocando" hidden></div>`;
  bolhas(raiz, 14); bolhas(raiz, 10, "extra"); // as bolhas do tubete no fundo (mais delas com música tocando)
  if (!document.querySelector('link[href="scan.css"]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "scan.css"; document.head.append(l); } // o teclado próprio
  tecl = ligarTeclado(raiz, raiz);
  obsCapa = new IntersectionObserver((ents) => ents.forEach(e => { if (e.isIntersecting) { obsCapa.unobserve(e.target); pintarCapa(e.target); } }), { root: null, rootMargin: "200px" });
  $(".mu-area").onclick = () => opts.aoTrocarArea?.();
  $('[data-acao="ajustes"]').onclick = ajustes;
  $('[data-acao="stats"]').onclick = () => { busca = ""; $(".mu-busca").hidden = true; sub = { tipo: "estatisticas" }; desenhar(); };
  $('[data-acao="busca"]').onclick = () => {
    const b = $(".mu-busca"); b.hidden = !b.hidden;
    if (!b.hidden) $(".mu-busca input").focus(); else { busca = ""; $(".mu-busca input").value = ""; desenhar(); }
  };
  $(".mu-busca input").oninput = (e) => { busca = e.target.value.trim(); sub = null; desenhar(); };
  raiz.querySelectorAll(".mu-abas button").forEach(b => (b.onclick = () => {
    const i = ORDEM_ABAS.indexOf(aba), j = ORDEM_ABAS.indexOf(b.dataset.aba);
    aba = b.dataset.aba; sub = null; irComAnimacao(j === i ? 0 : j > i ? 1 : -1);
  }));
  rolar = criarRolagem(raiz, raiz.querySelector(".mu-tela"));
  ligarDeslize();
  try {
    const m = await B.faixas(), g = await BD.lerCfg("fila");
    filaAtual = (g?.ids || []).map(i => m.get(i)).filter(Boolean);
    listaBase = (g?.base || []).map(i => m.get(i)).filter(Boolean);
    aleatorio = !!g?.aleatorio;
  } catch { filaAtual = []; }
  motor.ouvir(e => atualizarEstado(e));
  cfgT = await B.cfgTocador(); motor.ajustesTocador?.(cfgT).catch?.(() => {});
  B.agendarAuto(3000);
  if (pedidoRetro) { sub = { tipo: "retro", mes: pedidoRetro }; pedidoRetro = null; }
  B.aoMudarBiblioteca((o2) => { if (raiz?.isConnected && (o2.biblioteca || o2.albuns || o2.contagens)) desenhar(true); });
  // estrelas e coração dados pela notificação ou pelo widget (notaNativa.js): redesenha a tela Tocando e as linhas
  if (!ouvindoNotasDeFora) {
    ouvindoNotasDeFora = true;
    document.addEventListener("orbita:notas-de-fora", (e) => {
      const ids = e.detail?.ids || [];
      if (!raiz?.isConnected || !ids.length) return;
      const t = $(".mu-tocando");
      if (ids.includes(estado.id) && t && !t.hidden) desenharTocando();
      const visivel = [...raiz.querySelectorAll(".mu-tela [data-id]")].some(el => ids.includes(el.dataset.id));
      if (visivel) desenhar(true);
    });
  }
  await desenhar();
  clearInterval(timer);
  timer = setInterval(() => { if (!raiz?.isConnected) { clearInterval(timer); return; } if (document.visibilityState === "visible") motor.estado().then(atualizarEstado).catch(() => {}); }, 700);
  motor.estado().then(atualizarEstado).catch(() => {});
  B.aplicarHistorico().catch(() => {});
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && raiz?.isConnected) B.aplicarHistorico().catch(() => {}); });
  if (await B.pasta()) sincronizar(true).then(() => { atualizarBadge(); B.relerAnosDosArquivos().catch(() => {}); Promise.resolve(medirVolumesAgora()).finally(analisarGenerosAgora); conferirVersoes(); import("./drive.js").then(m => m.talvezAoAbrir()).catch(() => {}); });
  avisarVencimentos();
}

// ---------- sincronização ----------
async function sincronizar(silenciosa = false) {
  if (sincronizando) return sincronizando;
  const ind = $(".mu-sinc");
  sincronizando = (async () => {
    try {
      const r = await B.sincronizar(p => {
        ind.hidden = false;
        ind.textContent = p.fase === "listando" ? "Lendo a pasta…" : `${p.feitas} de ${p.total}`;
        const prog = $(".mu-progresso"); if (prog) prog.textContent = p.fase === "listando" ? "Lendo a pasta…" : `Lendo as tags: ${p.feitas} de ${p.total}`;
      });
      // os " (1)", " - Cópia"… que chegaram com os arquivos voltam ao nome do título sozinhos (09/11/2026; só no celular)
      if (nativo) B.arrumarNomesSozinho(estado.id).then(n => { if (n) toast(`${n === 1 ? "1 arquivo voltou" : `${n} arquivos voltaram`} ao nome do título (sem o “(1)”).`, 3500); }).catch(e => console.warn("Músicas: nomes", e.message));
      if (!silenciosa || r.novas || r.removidas) toast(`${r.total} músicas${r.novas ? `, ${r.novas} novas` : ""}${r.removidas ? `, ${r.removidas} saíram da pasta` : ""}${r.movidas ? `, ${r.movidas} mudaram de lugar` : ""}.`);
    } catch (e) {
      if (e.message === "escolha_de_novo") { if (!silenciosa) toast("No navegador, escolha a pasta de novo a cada vez que abrir."); }
      else if (e.message === "pasta_vazia") toast("A pasta de músicas está vazia ou indisponível (o cartão de memória está no lugar?). Nada foi apagado.", 5000);
      else if (e.message === "sem_permissao") toast("O Android tirou a permissão da pasta. Escolha a pasta de novo em Ajustes.", 5000);
      else if (!silenciosa) toast(`Não consegui ler a pasta: ${e.message}`, 4500);
    } finally {
      ind.hidden = true; sincronizando = null;
    }
  })();
  return sincronizando;
}

async function escolherPasta() {
  try {
    const p = await B.escolherPasta();
    toast(`Pasta: ${p.nome}`);
    await desenhar();
    await sincronizar();
  } catch (e) { if (e.message !== "cancelado") toast(`Não consegui abrir a pasta: ${e.message}`); }
}

// ---------- estado do tocador ----------
async function atualizarEstado(e) {
  if (!e || !raiz?.isConnected) return;
  const mudouFaixa = e.id !== estado.id;
  estado = e;
  if (mudouFaixa) {
    if (ultimoId) B.aplicarHistorico().catch(() => {});
    ultimoId = e.id;
    if (e.id) guardarFila();
    raiz.querySelectorAll(".mu-faixa.atual").forEach(x => x.classList.remove("atual"));
    if (e.id) raiz.querySelectorAll(`.mu-faixa[data-id="${CSS.escape(e.id)}"]`).forEach(x => x.classList.add("atual"));
    await desenharMini();
    if (!$(".mu-tocando").hidden) await desenharTocando();
  }
  raiz.classList.toggle("tocando", !!e.tocando);
  const mini = $(".mu-mini");
  if (mini && !mini.hidden) {
    mini.querySelector(".mu-mini-play").innerHTML = e.querTocar ? I.pausa : I.play;
    mini.querySelector(".mu-mini-barra i").style.width = `${e.duracao ? (100 * e.posicao / e.duracao) : 0}%`;
  }
  const t = $(".mu-tocando");
  if (t && !t.hidden) {
    t.querySelector(".mu-t-play").innerHTML = e.querTocar ? I.pausa : I.play;
    t.classList.toggle("pausado", !e.querTocar);
    t.classList.toggle("soando", !!e.tocando);
    barraT?.atualizar({ posicao: e.posicao || 0, duracao: e.duracao || 0, tocando: !!e.tocando });
    const r = t.querySelector(".mu-t-barra");
    if (!r.dataset.arrastando) { r.max = e.duracao || 0; r.value = e.posicao || 0; r.style.setProperty("--p", `${e.duracao ? 100 * e.posicao / e.duracao : 0}%`); }
    t.querySelector(".mu-t-pos").textContent = tempo(e.posicao);
    t.querySelector(".mu-t-dur").textContent = tempo(e.duracao);
    t.querySelector('[data-acao="aleatorio"]').classList.toggle("on", aleatorio);
    const tm = t.querySelector('[data-acao="timer"]');
    if (tm) {
      const resta = e.timerFim ? e.timerFim - Date.now() : 0;
      tm.classList.toggle("on", !!e.pararNoFim || resta > 0);
      tm.querySelector("span").textContent = e.pararNoFim ? "No fim desta" : resta > 0 ? `${Math.ceil(resta / 60000)} min` : "Timer";
    }
    const rep = t.querySelector('[data-acao="repetir"]');
    rep.classList.toggle("on", e.repetir !== "nao"); rep.classList.toggle("uma", e.repetir === "uma");
  }
}

const embaralhar = (l) => { l = l.slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const guardarFila = () => BD.gravarCfg("fila", { ids: filaAtual.map(f => f.id), base: listaBase.map(f => f.id), aleatorio, atual: estado.id || null }).catch(() => {});
async function tocarLista(lista, i = 0, o = {}) {
  if (!lista.length) return;
  if (o.aleatorio != null) aleatorio = o.aleatorio;
  listaBase = lista.slice();
  let ini = i;
  if (aleatorio) { filaAtual = [lista[i], ...embaralhar(lista.filter((_, k) => k !== i))]; ini = 0; }
  else filaAtual = lista.slice();
  guardarFila();
  try {
    const e = await motor.tocar(filaAtual, ini, { aleatorio: false, repetir: cfgT.radio ? "nao" : estado.repetir || "todas", posicao: o.posicao || 0 });
    await atualizarEstado(e);
    if (cfgT.radio) atualizarRadio(listaBase);
  } catch (err) { toast(`Não consegui tocar: ${err.message}`, 4000); }
}
/** Rádio: manda ao tocador as músicas parecidas com as da fila (ele as acrescenta quando a fila acaba). */
async function atualizarRadio(sementes) {
  try { await motor.radioPool(await B.poolRadio(sementes.length ? sementes : filaAtual)); } catch (e) { console.warn("Músicas: rádio", e.message); }
}
async function alternarAleatorio() {
  const atual = filaAtual.find(f => f.id === estado.id);
  aleatorio = !aleatorio;
  if (!atual || !listaBase.length) { guardarFila(); atualizarEstado(estado); return; }
  const base = listaBase, i = Math.max(0, base.findIndex(f => f.id === atual.id));
  await tocarLista(base, i, { aleatorio, posicao: estado.posicao });
  if (!estado.querTocar) cmd("pausar");
  toast(aleatorio ? "Aleatório ligado." : "Aleatório desligado.");
}
const cmd = (acao, x) => motor.comando(acao, x).then(atualizarEstado).catch(err => toast(err.message));

// ---------- telas ----------
// cada desenho monta a tela num contêiner à parte e só troca no fim; se outro desenho começou no meio (a biblioteca
// avisou de uma mudança, por exemplo), este é descartado, para a tela não sair duplicada
let geracao = 0;
let desenhando = 0;
async function desenhar(manterRolagem = false) {
  desenhando++;
  try { return await desenhar1(manterRolagem); } finally { desenhando--; }
}
async function desenhar1(manterRolagem) {
  if (!raiz?.isConnected) return;
  const minha = ++geracao;
  if (!manterRolagem && selecao.size) { selecao.clear(); pintarSelecao(); }
  const tela = $(".mu-tela"), rol = tela.scrollTop;
  raiz.querySelectorAll(".mu-abas button").forEach(b => b.classList.toggle("on", b.dataset.aba === aba && !busca && sub?.tipo !== "estatisticas"));
  moverIndicador();
  $('[data-acao="stats"]').classList.toggle("on", sub?.tipo === "estatisticas");
  const p = await B.pasta(), todas = await B.listaFaixas();
  if (minha !== geracao) return;
  if (!p || (!todas.length && !sincronizando)) {
    rolar?.esconder();
    tela.innerHTML = `<div class="mu-vazio">${I.nota}<h2>${p ? "Nenhuma música por aqui" : "Suas músicas no Órbita"}</h2>
      <p>${p ? `A pasta <b>${escapar(p.nome)}</b> não tem músicas ainda.` : "Escolha a pasta <b>Músicas</b> do cartão de memória (uma subpasta por artista, como Anny, Steve…). MP3, FLAC, M4A, OGG, Opus e WAV."}</p>
      <button class="botao">${p ? "Escolher outra pasta" : "Escolher a pasta"}</button>${p ? '<button class="botao secundario" data-acao="ler">Ler a pasta de novo</button>' : ""}</div>`;
    tela.querySelector(".botao").onclick = escolherPasta;
    tela.querySelector('[data-acao="ler"]')?.addEventListener("click", () => sincronizar());
    return;
  }
  if (!todas.length) { rolar?.esconder(); tela.innerHTML = `<div class="mu-vazio">${I.nota}<h2>Lendo as suas músicas</h2><p class="mu-progresso">Lendo a pasta…</p></div>`; return; }
  const alvo = document.createElement("div");
  rolagemPendente = null;
  if (!sub && !busca && ["artistas", "musicas", "albuns"].includes(aba)) { await faixaRotina(alvo); await faixaNesteDia(alvo); }
  if (busca) await telaBusca(alvo, todas);
  else if (sub?.tipo === "artista") await telaArtista(alvo, sub.id);
  else if (sub?.tipo === "falta") await telaFalta(alvo, sub.id);
  else if (sub?.tipo === "generos") await telaGeneros(alvo);
  else if (sub?.tipo === "faltando") await telaFaltando(alvo, sub.campo);
  else if (sub?.tipo === "genero") await telaGenero(alvo, sub.id, sub.clima);
  else if (sub?.tipo === "album") await telaAlbum(alvo, sub.id);
  else if (sub?.tipo === "tag") await telaTag(alvo, sub.id, sub.tipoTag);
  else if (sub?.tipo === "desambiguar") await telaDesambiguar(alvo);
  else if (sub?.tipo === "spedup") await telaSpedUp(alvo);
  else if (sub?.tipo === "drive") await telaDriveMusicas(alvo);
  else if (sub?.tipo === "estatisticas") await telaEstatisticas(alvo);
  else if (sub?.tipo === "retro") await telaRetrospectiva(alvo, sub.mes);
  else if (sub?.tipo === "nestedia") await telaNesteDia(alvo);
  else if (aba === "artistas") await telaArtistas(alvo);
  else if (aba === "musicas") telaTodas(alvo, todas);
  else if (sub?.tipo === "padrao") await telaPadrao(alvo);
  else if (sub?.tipo === "nomes") await telaNomes(alvo);
  else if (aba === "editar") await telaEditar(alvo);
  else if (aba === "tags") await telaTags(alvo);
  else await telaAlbuns(alvo);
  if (minha !== geracao) return;
  const rp = rolagemPendente; rolagemPendente = null;
  tela.replaceChildren(...alvo.childNodes);
  if (rp?.box?.isConnected) rolar?.mostrar(rp); else rolar?.esconder();
  if (manterRolagem) tela.scrollTop = rol; else tela.scrollTop = 0;
  await desenharMini();
}

// ---------- deslizar entre as abas (pedido do Alediov, 25/10/2026) ----------
// A tela acompanha o dedo; passando de ~30% da largura (ou num gesto rápido) troca para a aba vizinha, que entra pelo
// lado oposto. Numa subtela (artista, playlist, tag…), deslizar para a direita volta, como o botão Voltar. Ignora as
// bordas (gesto de voltar do Android), campos, áreas com rolagem lateral, a seleção múltipla e a busca aberta.
const ORDEM_ABAS = ["artistas", "musicas", "albuns", "tags", "editar"];
const menosMov = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
async function irComAnimacao(dir) {
  const tela = $(".mu-tela");
  mostrarAbaAtiva();
  await desenhar();
  if (!dir || menosMov() || !tela) return;
  tela.style.transition = "none"; tela.style.transform = `translateX(${dir * Math.min(90, innerWidth * 0.22)}px)`; tela.style.opacity = "0";
  void tela.offsetWidth;
  tela.style.transition = "transform .26s cubic-bezier(.2,.8,.25,1), opacity .22s";
  tela.style.transform = ""; tela.style.opacity = "";
  setTimeout(() => { tela.style.transition = ""; }, 280);
}
/** A pílula da aba escolhida desliza até ela (some na busca e nas Estatísticas, que não são de aba nenhuma). */
function moverIndicador(de = null, para = null, k = 0) {
  const nav = $(".mu-abas"), ind = nav?.querySelector(".mu-abas-ind"); if (!ind) return;
  if (de && para) { // no meio do gesto: entre as duas abas, sem transição
    ind.style.transition = "none"; ind.style.opacity = "1";
    ind.style.transform = `translateX(${de.offsetLeft + (para.offsetLeft - de.offsetLeft) * k}px)`;
    ind.style.width = `${de.offsetWidth + (para.offsetWidth - de.offsetWidth) * k}px`;
    return;
  }
  ind.style.transition = "";
  const b = nav.querySelector("button.on");
  if (!b) { ind.style.opacity = "0"; return; }
  if (!ind.style.width) ind.style.transition = "none"; // na primeira vez, já no lugar
  ind.style.opacity = "1"; ind.style.transform = `translateX(${b.offsetLeft}px)`; ind.style.width = `${b.offsetWidth}px`;
}
/** A aba escolhida fica à vista na barra (em tela estreita ela rola de lado). */
function mostrarAbaAtiva() {
  const nav = $(".mu-abas"), b = nav?.querySelector(`button[data-aba="${aba}"]`);
  if (!b || nav.scrollWidth <= nav.clientWidth + 2) return;
  nav.scrollTo({ left: b.offsetLeft - (nav.clientWidth - b.offsetWidth) / 2, behavior: menosMov() ? "auto" : "smooth" });
}
function ligarDeslize() {
  let kz = 1;
  const t = $(".mu-tela");
  let x0 = 0, y0 = 0, modo = null, dx = 0, trocando = false, rastro = [], voltarSub = null;
  const bloqueado = () => trocando || busca || selecao.size || raiz.classList.contains("com-teclado") || !$(".mu-tocando").hidden
    || document.querySelector(".mu-folha-fundo");
  const rolaDoLado = (el) => {
    for (let e = el; e && e !== t; e = e.parentElement) {
      if (e.matches?.("input, textarea, select, canvas, [data-sem-deslize]")) return true;
      const ox = getComputedStyle(e).overflowX;
      if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 2) return true;
    }
    return false;
  };
  const destino = (d) => { // d = 1: a aba da direita (dedo para a esquerda); -1: a da esquerda ou voltar
    if (sub && voltarSub) return d < 0 ? "voltar" : null;
    const i = ORDEM_ABAS.indexOf(aba); return ORDEM_ABAS[i + d] || null;
  };
  const voltarAoLugar = () => {
    moverIndicador();
    t.style.transition = "transform .3s cubic-bezier(.3,1.3,.5,1), opacity .3s";
    t.style.transform = ""; t.style.opacity = "";
    setTimeout(() => (t.style.transition = ""), 320);
  };
  t.addEventListener("touchstart", (e) => {
    modo = null; dx = 0; rastro = [];
    if (e.touches.length !== 1 || bloqueado()) { modo = "nada"; return; }
    const p = e.touches[0];
    if (p.clientX < 20 || p.clientX > innerWidth - 20 || rolaDoLado(e.target)) { modo = "nada"; return; }
    voltarSub = t.querySelector(".mu-cab .mu-voltar");
    kz = t.getBoundingClientRect().width / (t.offsetWidth || 1) || 1; // zoom do tablet: o dedo em px da tela, o deslize em px da área
    x0 = p.clientX / kz; y0 = p.clientY / kz; rastro = [[performance.now(), x0]];
  }, { passive: true });
  t.addEventListener("touchmove", (e) => {
    if (modo === "nada" || e.touches.length !== 1) return;
    const p = e.touches[0], ddx = p.clientX / kz - x0, ddy = p.clientY / kz - y0;
    if (!modo) {
      if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
      modo = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? "lado" : "nada";
      if (modo === "nada") return;
      t.style.transition = "";
    }
    rastro.push([performance.now(), p.clientX / kz]); if (rastro.length > 12) rastro.shift();
    dx = ddx;
    if (menosMov()) return;
    const semAlvo = !destino(dx < 0 ? 1 : -1);
    const des = semAlvo ? Math.sign(dx) * Math.pow(Math.abs(dx), 0.72) : dx; // sem para onde ir, resiste
    t.style.transform = `translateX(${des}px)`;
    t.style.opacity = String(1 - Math.min(0.45, Math.abs(des) / ((innerWidth / kz) * 1.4)));
    // a pílula das abas acompanha o dedo até a aba vizinha
    const alvo = destino(dx < 0 ? 1 : -1);
    if (alvo && alvo !== "voltar" && !sub) {
      const nav = $(".mu-abas"), de = nav.querySelector(`button[data-aba="${aba}"]`), para = nav.querySelector(`button[data-aba="${alvo}"]`);
      moverIndicador(de, para, Math.min(1, Math.abs(dx) / ((innerWidth / kz) * 0.6)));
    }
  }, { passive: true });
  t.addEventListener("touchend", async () => {
    if (modo !== "lado") { modo = null; return; }
    modo = null;
    const [tf, xf] = rastro[rastro.length - 1], ref = rastro.find(([tt]) => tf - tt <= 120) || rastro[0];
    const vel = (xf - ref[1]) / Math.max(16, tf - ref[0]); // px/ms nos últimos ~120 ms
    const dir = dx < 0 ? 1 : -1, alvo = destino(dir);
    const vai = alvo && (Math.abs(dx) > Math.min(120, (innerWidth / kz) * 0.3) || (Math.abs(vel) > 0.3 && Math.abs(dx) >= 28 && Math.sign(vel) === Math.sign(dx)));
    if (!vai) return voltarAoLugar();
    trocando = true;
    try {
      if (!menosMov()) {
        t.style.transition = "transform .16s ease-in, opacity .16s";
        t.style.transform = `translateX(${-dir * (innerWidth / kz) * 0.6}px)`; t.style.opacity = "0";
        await new Promise(r => setTimeout(r, 150));
      }
      t.style.transition = "none"; t.style.transform = `translateX(${-dir * (innerWidth / kz) * 0.6}px)`;
      if (alvo === "voltar") { voltarSub.click(); await new Promise(r => setTimeout(r, 0)); await esperarDesenho(); }
      else { aba = alvo; sub = null; mostrarAbaAtiva(); await desenhar(); }
      if (menosMov()) { t.style.transform = ""; t.style.opacity = ""; return; }
      t.style.transform = `translateX(${dir * Math.min(90, (innerWidth / kz) * 0.22)}px)`; t.style.opacity = "0";
      void t.offsetWidth;
      t.style.transition = "transform .26s cubic-bezier(.2,.8,.25,1), opacity .22s";
      t.style.transform = ""; t.style.opacity = "";
      setTimeout(() => { t.style.transition = ""; }, 280);
    } finally { trocando = false; }
  });
  t.addEventListener("touchcancel", () => { if (modo === "lado") voltarAoLugar(); modo = null; });
}
/** Espera o desenho em andamento (o Voltar chama desenhar() sem devolver a promessa). */
async function esperarDesenho() { for (let i = 0; i < 60 && desenhando; i++) await new Promise(r => setTimeout(r, 25)); }

function cabecalho(tela, { titulo, sub: s, capaDe, voltar, acoes = true, lista, menu }) {
  const h = document.createElement("div"); h.className = "mu-cab";
  if (voltar) { const b = document.createElement("button"); b.className = "mu-voltar"; b.innerHTML = `${I.voltar}<span>Voltar</span>`; b.onclick = voltar; h.append(b); }
  const linha = document.createElement("div"); linha.className = "mu-cab-linha";
  if (capaDe) linha.append(capa(capaDe, "grande"));
  const tx = document.createElement("div"); tx.className = "mu-cab-tx";
  tx.innerHTML = `<h2>${escapar(titulo)}</h2>${s ? `<p>${s}</p>` : ""}`;
  linha.append(tx);
  if (menu) { const m = document.createElement("button"); m.className = "mu-icone"; m.innerHTML = I.mais; m.setAttribute("aria-label", "Opções"); m.onclick = menu; linha.append(m); }
  h.append(linha);
  if (acoes && lista?.length) {
    const a = document.createElement("div"); a.className = "mu-cab-acoes";
    const b1 = document.createElement("button"); b1.className = "botao"; b1.innerHTML = `${I.play}<span>Tocar</span>`; b1.onclick = () => tocarLista(lista, 0, { aleatorio: false });
    const b2 = document.createElement("button"); b2.className = "botao secundario"; b2.innerHTML = `${I.aleat}<span>Aleatório</span>`; b2.onclick = () => tocarLista(lista, Math.floor(Math.random() * lista.length), { aleatorio: true });
    a.append(b1, b2); h.append(a);
  }
  tela.append(h);
}

function linhaFaixa(f, lista, i, ctx = {}) {
  const el = document.createElement("div");
  el.className = `mu-faixa ${estado.id === f.id ? "atual" : ""}`;
  el.dataset.id = f.id;
  el.append(capa(f));
  const tx = document.createElement("div"); tx.className = "mu-faixa-tx";
  // feat. (02/11/2026): selo com o(s) artista(s) da outra cópia da mesma música
  const ft = B.artistasFeat(f), selo = ft.length ? `<span class="mu-feat" title="Ligada como feat.">feat. ${escapar(ft.join(", "))}</span>` : "";
  tx.innerHTML = `<b>${escapar(f.titulo)}</b><small>${ctx.semArtista ? "" : `${escapar(f.artista)}`}${selo && !ctx.semArtista ? " " : ""}${selo}${ctx.semArtista && !selo ? "" : " · "}${tempo(f.duracao)}${f.tocadas ? ` · ${f.tocadas}×` : ""}</small>`;
  if (f.nota) tx.querySelector("small").prepend(estrelas(f.nota, { classe: "mini" }));
  if (f.fav) tx.querySelector("small").prepend(Object.assign(document.createElement("span"), { className: "mu-fav-mini", innerHTML: I.coracao }));
  if (f.tags?.length) {
    const p = document.createElement("span"); p.className = "mu-tag-pontos"; p.title = f.tags.join(", ");
    f.tags.slice(0, 4).forEach(t => p.append(Object.assign(document.createElement("i"), { style: `--c:${corDaTag(t)}` })));
    tx.querySelector("b").append(p);
  }
  // etiqueta de tag faltando (pedido do Alediov, 30/10/2026): "sem ano", "sem ano +1"; o toque abre o editor de tags
  const falta = ctx.semFalta ? [] : B.faltandoDe(f);
  if (falta.length) {
    const nomes = falta.map(k => B.CAMPOS_PRINCIPAIS[k].toLowerCase());
    const e = document.createElement("button"); e.type = "button"; e.className = "mu-falta";
    e.textContent = `sem ${nomes[0]}${falta.length > 1 ? ` +${falta.length - 1}` : ""}`;
    e.title = `Falta: ${nomes.join(", ")}`; e.setAttribute("aria-label", `Falta ${nomes.join(", ")}. Abrir o editor de tags`);
    e.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    e.onclick = (ev) => {
      ev.stopPropagation();
      if (selecao.size) { marcar(f, lista, ctx); return; }
      if (estado.id === f.id) { toast("Está tocando: edite as tags quando trocar de música."); return; }
      abrirEditorTags(f);
    };
    tx.querySelector("small").prepend(e); // na 2ª linha, no começo: o título comprido corta com "…" e esconderia
  }
  el.append(tx);
  const m = document.createElement("button"); m.className = "mu-icone"; m.innerHTML = I.mais; m.setAttribute("aria-label", "Opções da música");
  m.onclick = (ev) => { ev.stopPropagation(); menuFaixa(f, ctx); };
  el.append(m);
  // segurar o dedo seleciona (seleção múltipla); com seleção aberta, o toque marca e desmarca
  let t = null, x0 = 0, y0 = 0, segurou = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".mu-icone")) return;
    segurou = false; x0 = e.clientX; y0 = e.clientY; clearTimeout(t);
    t = setTimeout(() => { segurou = true; navigator.vibrate?.(15); marcar(f, lista, ctx); }, 480);
  });
  el.addEventListener("pointermove", (e) => { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 10) clearTimeout(t); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, () => clearTimeout(t));
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.onclick = () => {
    if (segurou) { segurou = false; return; }
    if (selecao.size) { marcar(f, lista, ctx); return; }
    tocarLista(lista, i);
  };
  if (selecao.has(f.id)) el.classList.add("sel");
  return el;
}

// lista grande: desenha aos poucos; com `ctx.rotulo` (e 30 músicas ou mais), liga a barra de rolagem rápida
function lista(tela, faixas, ctx = {}) {
  const box = document.createElement("div"); box.className = "mu-lista";
  tela.append(box);
  let n = 0, obs = null, sent = null;
  const mais = (ate = n + 80) => {
    if (obs) { obs.disconnect(); sent?.remove(); obs = sent = null; }
    const fim = Math.min(faixas.length, Math.max(ate, n + 1));
    for (; n < fim; n++) box.append(linhaFaixa(faixas[n], faixas, n, ctx));
    if (n < faixas.length) {
      sent = document.createElement("div"); sent.className = "mu-sentinela"; box.append(sent);
      obs = new IntersectionObserver((es) => { if (es[0].isIntersecting) mais(); }, { rootMargin: "600px" });
      obs.observe(sent);
    }
  };
  if (!faixas.length) box.innerHTML = `<p class="mu-nada">Nada por aqui.</p>`;
  else mais();
  if (ctx.rotulo && faixas.length >= 30) rolagemPendente = { box, n: faixas.length, rotulo: (i) => ctx.rotulo(faixas[i]), garantir: (i) => { if (i >= n) mais(i + 41); } };
  return box;
}

// ---------- artistas conferidos (pedido do Alediov, 25/10/2026): tenho tudo (3 meses), não se aplica, a conferir ----------
const dataBr = (t) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const NOMES_SIT = { nunca: "Ainda não conferido", completo: "Tenho tudo", vencido: "Conferir de novo", naoSeAplica: "Não se aplica" };
/** O selo do canto do cartão: ✓ verde com um anel que esvazia nos 3 meses, relógio âmbar, traço cinza ou um círculo tracejado. */
function seloConferido(sit) {
  const el = document.createElement("span"); el.className = `mu-conf ${sit.estado}`; el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${NOMES_SIT[sit.estado]}. Tocar para marcar`);
  const C = 2 * Math.PI * 13;
  el.innerHTML = sit.estado === "completo"
    ? `<i>${I.certo}<svg class="mu-conf-anel" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13"/><circle cx="15" cy="15" r="13" stroke-dasharray="${(C * sit.resta).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 15 15)"/></svg></i>`
    : sit.estado === "vencido" ? `<i>${I.relogio}</i>` : sit.estado === "naoSeAplica" ? `<i>${I.traco}</i>` : "<i></i>";
  return el;
}
function textoSituacao(sit) {
  if (sit.estado === "completo") return `Tenho tudo · vale até ${dataBr(sit.vence)}`;
  if (sit.estado === "vencido") return `Conferir de novo · venceu em ${dataBr(sit.vence)}`;
  if (sit.estado === "naoSeAplica") return sit.auto ? "Não se aplica (pasta das versões)" : "Não se aplica";
  return "Ainda não conferido";
}
async function avisarVencimentos() { try { opts.aoVencimentos?.(await B.vencimentos()); } catch { /* sem notificações */ } }
/** Folha para marcar um artista. */
function folhaConferir(nome, sit) {
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit"></h3><p class="mu-dica mu-dica-curta mu-conf-linha"></p>`;
  box.querySelector("h3").textContent = nome;
  box.querySelector("p").textContent = textoSituacao(sit);
  const { fechar } = folha(box);
  const ate = new Date(); ate.setMonth(ate.getMonth() + B.MESES_CONFERIDO);
  const marcar = async (estado, msg) => { fechar(); await B.marcarArtista(nome, estado); avisarVencimentos(); toast(msg); desenhar(true); };
  box.append(
    opcao(`${sit.estado === "completo" || sit.estado === "vencido" ? "Conferi de novo: tenho tudo" : "Tenho todas as músicas"} (vale até ${dataBr(+ate)})`, () => marcar("completo", `${nome}: completo até ${dataBr(+ate)}.`)),
    opcao("Ver o que falta no Deezer", () => { fechar(); busca = ""; sub = { tipo: "falta", id: nome }; desenhar(); }),
  );
  if (sit.estado !== "naoSeAplica") box.append(opcao("Não se aplica (fica para sempre)", () => marcar("naoSeAplica", `${nome}: não se aplica.`)));
  if (sit.estado !== "nunca" && !sit.auto) box.append(opcao("Tirar a marca", () => marcar(null, `${nome}: sem marca.`), true));
}
/** Abre a aba Artistas no filtro "A conferir" (da notificação). */
export function abrirAConferir() { filtroArt = "conferir"; aba = "artistas"; sub = null; busca = ""; if (raiz?.isConnected) desenhar(); }
/** Abre uma playlist (a Agenda → Alarmes abre a playlist Alarme por aqui). */
export function abrirPlaylist(id) { aba = "albuns"; sub = { tipo: "album", id }; busca = ""; if (raiz?.isConnected) desenhar(); }

async function telaArtistas(tela) {
  const arts = await B.artistas(), sits = await B.situacoesArtistas();
  const sitDe = (a) => sits.get(normTag(a.nome)) || { estado: "nunca" };
  const grupos = { todos: arts, conferir: arts.filter(a => ["nunca", "vencido"].includes(sitDe(a).estado)), completos: arts.filter(a => sitDe(a).estado === "completo"), naoSeAplica: arts.filter(a => sitDe(a).estado === "naoSeAplica") };
  const vencidos = arts.filter(a => sitDe(a).estado === "vencido");
  if (vencidos.length && filtroArt !== "conferir") {
    const f = document.createElement("button"); f.className = "mu-conf-faixa";
    f.innerHTML = `<i>${I.relogio}</i><span><b>${vencidos.length === 1 ? "1 artista para conferir de novo" : `${vencidos.length} artistas para conferir de novo`}</b></span>`;
    f.onclick = () => { filtroArt = "conferir"; desenhar(true); };
    tela.append(f);
  }
  const chips = document.createElement("div"); chips.className = "mu-chips mu-conf-chips";
  for (const [k, rot] of [["todos", "Todos"], ["conferir", "A conferir"], ["completos", "Completos"], ["naoSeAplica", "Não se aplica"]]) {
    const b = document.createElement("button"); b.className = filtroArt === k ? "on" : ""; b.innerHTML = `${rot} <small>${grupos[k].length}</small>`;
    b.onclick = () => { filtroArt = k; desenhar(true); };
    chips.append(b);
  }
  tela.append(chips);
  let l = grupos[filtroArt] || arts;
  // a conferir: os vencidos primeiro (os que venceram há mais tempo), depois os nunca conferidos
  if (filtroArt === "conferir") l = l.slice().sort((a, b) => (sitDe(a).vence || Infinity) - (sitDe(b).vence || Infinity) || a.nome.localeCompare(b.nome, "pt-BR"));
  if (!l.length) tela.insertAdjacentHTML("beforeend", `<p class="mu-nada">${filtroArt === "conferir" ? "Tudo conferido. 🎉" : "Nenhum artista aqui ainda."}</p>`);
  const g = document.createElement("div"); g.className = "mu-grade";
  for (const a of l) {
    const sit = sitDe(a);
    const c = document.createElement("button"); c.className = `mu-artista conf-${sit.estado}`;
    const cx = document.createElement("span"); cx.className = "mu-capa-caixa";
    cx.append(capa(a.faixas.find(f => f.temCapa) || { artista: a.nome }, "quadrada"), seloConferido(sit));
    c.append(cx);
    c.insertAdjacentHTML("beforeend", `<b>${escapar(a.nome)}</b><small>${a.faixas.length} ${a.faixas.length === 1 ? "música" : "músicas"}${sit.estado === "vencido" ? ` · <em>venceu ${dataBr(sit.vence).slice(0, 5)}</em>` : ""}</small>`);
    c.onclick = (e) => {
      if (e.target.closest(".mu-conf")) { e.stopPropagation(); folhaConferir(a.nome, sit); return; }
      sub = { tipo: "artista", id: a.nome }; desenhar();
    };
    g.append(c);
  }
  tela.append(g);
  // barra de rolagem rápida na grade (pedido do Alediov, 02/11/2026), com a letra do nome; no "A conferir" a ordem é
  // pelo vencimento, então fica sem
  if (filtroArt !== "conferir" && l.length >= 30) rolagemPendente = { box: g, n: l.length, rotulo: (i) => grupoDe(l[i].nome), garantir: () => {} };
}

async function telaArtista(tela, nome) {
  const a = (await B.artistas()).find(x => x.nome === nome);
  if (!a) { sub = null; return desenhar(); }
  const total = a.faixas.reduce((s, f) => s + (f.duracao || 0), 0);
  cabecalho(tela, { titulo: a.nome, sub: `${a.faixas.length} ${a.faixas.length === 1 ? "música" : "músicas"} · ${Math.round(total / 60000)} min`, capaDe: a.faixas.find(f => f.temCapa) || { artista: a.nome }, voltar: () => { sub = null; desenhar(); }, lista: a.faixas });
  const sit = await B.situacaoArtista(a.nome);
  const lin = document.createElement("div"); lin.className = "mu-conf-acoes";
  const p = document.createElement("button"); p.className = `mu-pilula mu-conf-pilula ${sit.estado}`;
  p.append(seloConferido(sit)); p.insertAdjacentHTML("beforeend", `<span>${escapar(textoSituacao(sit))}</span>`);
  p.onclick = () => folhaConferir(a.nome, sit);
  const f = document.createElement("button"); f.className = "mu-pilula"; f.innerHTML = `${I.lupaDisco}<span>O que falta</span>`;
  f.onclick = () => { sub = { tipo: "falta", id: a.nome }; desenhar(); };
  lin.append(p, f); tela.append(lin);
  // barra de rolagem rápida também aqui (pedido do Alediov, 02/11/2026: "são muitas músicas"); a lista é por título
  lista(tela, a.faixas, { semArtista: true, rotulo: (x) => grupoDe(x.titulo) });
}

// ---------- gêneros e climas (pelo som) ----------
const ICONE_CLIMA = { Animada: "☀️", Calma: "🌙", "Melancólica": "🌧️", Agressiva: "🔥", "Dançante": "💃", "Romântica": "💗" };
/** Os cartões dos gêneros (grupos pelo som) e dos climas: [grade dos gêneros, grade dos climas]. */
function gradesGeneros(d) {
  const gg = document.createElement("div"); gg.className = "mu-tags-grade";
  for (const g of d.grupos) {
    const c = document.createElement("button"); c.className = "mu-tag-cartao grupo"; c.style.setProperty("--c", corDaTag(g.nome));
    c.innerHTML = `<i>${I.onda}</i><span><b>${escapar(g.nome)}</b><small>${g.faixas.length} ${g.faixas.length === 1 ? "música" : "músicas"}</small></span>`;
    c.onclick = () => { sub = { tipo: "genero", id: g.nome }; desenhar(); };
    gg.append(c);
  }
  const gc = document.createElement("div"); gc.className = "mu-tags-grade";
  for (const c0 of d.climas) {
    const c = document.createElement("button"); c.className = "mu-tag-cartao versao"; c.style.setProperty("--c", corDaTag(c0.nome));
    c.innerHTML = `<i>${ICONE_CLIMA[c0.nome] || "•"}</i><span><b>${escapar(c0.nome)}</b><small>${c0.faixas.length} ${c0.faixas.length === 1 ? "música" : "músicas"}</small></span>`;
    c.onclick = () => { sub = { tipo: "genero", id: c0.nome, clima: true }; desenhar(); };
    gc.append(c);
  }
  return [gg, gc];
}
async function telaGeneros(tela) {
  const d = await B.generosDaBiblioteca(), sem = (await B.semGenero()).length, total = (await B.listaFaixas()).length;
  cabecalho(tela, { titulo: "Gêneros e climas", sub: `${total} ${total === 1 ? "música" : "músicas"}${sem ? ` · ${sem} sem ouvir` : ""}`, voltar: () => { sub = null; aba = "tags"; desenhar(); }, acoes: false });
  tela.append(botoesGenero(sem));
  const [gg, gc] = gradesGeneros(d);
  const nG = d.grupos.reduce((a, g) => a + g.faixas.length, 0), nC = d.climas.reduce((a, g) => a + g.faixas.length, 0);
  // gêneros abertos (o que se confere aqui); climas fechados (só no app, menos usados)
  const s1 = sanfona({ id: "gen.generos", titulo: "Gêneros", icone: I.onda, resumo: `${nG} ${nG === 1 ? "música" : "músicas"}`, conta: d.grupos.length, aberta: true });
  s1.corpo.append(gg); tela.append(s1.el);
  const s2 = sanfona({ id: "gen.climas", titulo: "Climas", icone: I.lua, resumo: `${nC} ${nC === 1 ? "música" : "músicas"}`, conta: d.climas.length });
  s2.corpo.append(gc); tela.append(s2.el);
  if (d.outras.length) tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">${d.outras.length} sem gênero do app</p>`);
}
/** "Ouvir agora" (forçar a leitura do gênero, 02/11/2026) e "Reavaliar todas", com o andamento. */
function botoesGenero(sem) {
  const box = document.createElement("div"); box.className = "mu-anos-bts mu-gen-bts";
  const a = document.createElement("button"); a.className = `botao ${sem ? "" : "secundario"} mini`; a.innerHTML = `${I.onda}<span>${sem ? `Ouvir agora (${sem})` : "Ouvir agora"}</span>`;
  a.onclick = () => ouvirGenerosAgora();
  const r = document.createElement("button"); r.className = "botao secundario mini"; r.textContent = "Reavaliar todas…";
  r.onclick = () => reavaliarTodas();
  const p = document.createElement("small"); p.className = "mu-dica mu-gen-prog"; p.hidden = true;
  box.append(a, r, p);
  requestAnimationFrame(pintarProgGen);
  return box;
}
async function telaGenero(tela, nome, clima) {
  const d = await B.generosDaBiblioteca(), x = (clima ? d.climas : d.grupos).find(g => g.nome === nome);
  const fs = x?.faixas || [];
  cabecalho(tela, { titulo: nome, sub: `${fs.length} ${fs.length === 1 ? "música" : "músicas"}${clima ? "" : ` · ${escapar(DESC_G[nome] || "")}`}`, voltar: () => { sub = { tipo: "generos" }; desenhar(); }, lista: fs });
  const l = clima ? fs : fs.slice().sort((a, b) => (a.generoManual ? 1 : 0) - (b.generoManual ? 1 : 0) || (a.generoConf ?? 1) - (b.generoConf ?? 1));
  lista(tela, l);
}

// ---------- o que falta de um artista (discografia do Deezer × biblioteca) ----------
const discos = new Map(); // id do Deezer → músicas (na memória, enquanto o app está aberto)
async function telaFalta(tela, nome) {
  const voltar = () => { sub = { tipo: "artista", id: nome }; desenhar(); };
  cabecalho(tela, { titulo: "O que falta", sub: `${escapar(nome)} · comparado com o Deezer`, voltar, acoes: false });
  const caixa = document.createElement("div"); caixa.className = "mu-qf"; tela.append(caixa);
  caixa.innerHTML = `<p class="mu-dica">Procurando no Deezer…</p>`;
  // a busca leva alguns segundos: a tela aparece já, e a caixa se preenche quando chegar
  preencherFalta(caixa, nome, voltar);
}
/** Campo para colar o link (https://www.deezer.com/br/artist/293283561) ou o código do artista no Deezer. */
function campoLinkDeezer(nome, aoUsar = () => {}) {
  const f = document.createElement("form"); f.className = "mu-qf-link";
  f.innerHTML = `<input type="text" inputmode="url" placeholder="Link ou código do artista no Deezer" aria-label="Link ou código do artista no Deezer"><button class="botao mini">Usar</button><small class="mu-dica"></small>`;
  const inp = f.querySelector("input"), aviso = f.querySelector("small");
  f.onsubmit = async (e) => {
    e.preventDefault();
    aviso.textContent = "Conferindo no Deezer…";
    try {
      const id = await resolverLinkDeezer(inp.value);
      if (!id) { aviso.textContent = "Não achei o artista no que foi colado (o link do artista tem /artist/ e um número)."; return; }
      const a = await artistaDeezer(id); await B.guardarConferencia(nome, { deezer: a.id }); aoUsar(); toast(`${nome} = ${a.nome} no Deezer.`); desenhar(true); }
    catch (err) { aviso.textContent = `Não deu: ${err.message}.`; }
  };
  return f;
}
async function preencherFalta(caixa, nome, voltar) {
  await new Promise(ok => setTimeout(ok, 0));
  const dados = await B.dadosConferencia(nome);
  let cands;
  try {
    cands = await artistasDeezer(nome);
    // o que ele escolheu (às vezes pelo link) primeiro, mesmo que a busca pelo nome não ache
    if (dados.deezer && !cands.some(c => c.id === dados.deezer)) { try { cands.unshift(await artistaDeezer(dados.deezer)); } catch { /* fica a busca */ } }
  }
  catch (e) { caixa.innerHTML = `<p class="mu-dica">Não consegui falar com o Deezer (${escapar(e.message)}). Precisa de internet.</p>`; return; }
  if (!caixa.isConnected) return;
  caixa.innerHTML = "";
  if (!cands.length) { caixa.innerHTML = `<p class="mu-dica">O Deezer não achou “${escapar(nome)}” pelo nome. Cole o link ou o código do artista:</p>`; caixa.append(campoLinkDeezer(nome)); return; }
  const escolhido = cands.find(c => c.id === dados.deezer) || cands[0];
  // quem é, no Deezer (dá para trocar se o primeiro não for ele)
  const quem = document.createElement("div"); quem.className = "mu-qf-quem";
  quem.innerHTML = `${escolhido.foto ? `<img src="${escapar(escolhido.foto)}" alt="">` : ""}<span><small>No Deezer</small><b></b><small>${escolhido.fas.toLocaleString("pt-BR")} fãs</small></span>`;
  quem.querySelector("b").textContent = escolhido.nome;
  {
    const t = document.createElement("button"); t.className = "botao secundario mini"; t.textContent = "Não é este?";
    t.onclick = () => {
      const box = document.createElement("div"); box.innerHTML = `<h3 class="mu-folha-tit">Qual é o ${escapar(nome)}?</h3>`;
      const { fechar } = folha(box);
      for (const c of cands.filter(c => c.id !== escolhido.id)) box.append(opcao(`${c.nome} · ${c.fas.toLocaleString("pt-BR")} fãs`, async () => { fechar(); await B.guardarConferencia(nome, { deezer: c.id }); desenhar(true); }));
      box.insertAdjacentHTML("beforeend", `<p class="mu-dica mu-dica-curta">Nenhum desses? Cole o link do artista no Deezer:</p>`);
      box.append(campoLinkDeezer(nome, fechar));
    };
    quem.append(t);
  }
  caixa.append(quem);
  const andam = document.createElement("p"); andam.className = "mu-dica"; andam.textContent = "Lendo a discografia…"; caixa.append(andam);
  let musicas = discos.get(escolhido.id);
  try {
    if (!musicas) { musicas = await discografiaDeezer(escolhido.id, (k, n) => { andam.textContent = `Lendo a discografia… ${k} de ${n} lançamentos`; }); discos.set(escolhido.id, musicas); }
  } catch (e) { andam.textContent = `Não consegui ler a discografia (${e.message}).`; return; }
  if (!caixa.isConnected) return;
  andam.remove();
  if (dados.deezer !== escolhido.id) B.guardarConferencia(nome, { deezer: escolhido.id });
  // o que ele tem: as músicas do artista (e as versões delas), pelo título sem desambiguação nem participação
  const a = (await B.artistas()).find(x => x.nome === nome);
  // pela escrita e pelo som: o título dele em japonês (ルフィ, ブルーロック) bate com o romanizado do Deezer (Luffy, Blue Lock)
  const tem = new Set((a?.faixas || []).flatMap(f => B.chavesObra(f.titulo)));
  const ignorar = new Set(dados.ignorar || []);
  const vistas = new Map(); // chave → { musica, albuns, chaves }
  for (const m of musicas) {
    const k = B.chaveObra(m.titulo);
    if (!k) continue;
    if (!vistas.has(k)) vistas.set(k, { musica: m, chave: k, chaves: B.chavesObra(m.titulo, { esqueleto: true }), albuns: [] });
    vistas.get(k).albuns.push(m.album);
  }
  const todas = [...vistas.values()];
  const temX = (x) => x.chaves.some(k => tem.has(k));
  const faltam = todas.filter(x => !temX(x) && !ignorar.has(x.chave)), ignoradas = todas.filter(x => !temX(x) && ignorar.has(x.chave));
  const tenho = todas.length - faltam.length - ignoradas.length;
  const pct = todas.length ? Math.round(100 * (tenho + ignoradas.length) / todas.length) : 100;
  caixa.insertAdjacentHTML("beforeend", `<div class="mu-qf-resumo"><b>${faltam.length ? `Faltam ${faltam.length}` : "Nada faltando"}</b><small>Você tem ${tenho} de ${todas.length - ignoradas.length} músicas${ignoradas.length ? ` (${ignoradas.length} ignoradas)` : ""}</small><i style="--p:${pct}%"></i></div>`);
  const marcar = document.createElement("button"); marcar.className = `botao ${faltam.length ? "secundario" : ""}`;
  const ate = new Date(); ate.setMonth(ate.getMonth() + B.MESES_CONFERIDO);
  marcar.innerHTML = `${I.certo}<span>Tenho tudo: marcar até ${dataBr(+ate)}</span>`;
  marcar.onclick = async () => { await B.marcarArtista(nome, "completo"); avisarVencimentos(); toast(`${nome}: completo até ${dataBr(+ate)}.`); voltar(); };
  caixa.append(marcar);
  const linha = (x, ign) => {
    const el = document.createElement("div"); el.className = "mu-qf-item";
    el.innerHTML = `<span><b></b><small></small></span>`;
    el.querySelector("b").textContent = x.musica.titulo;
    el.querySelector("small").textContent = `${tempo(x.musica.duracao)}${x.albuns.length > 1 ? ` · em ${x.albuns.length} lançamentos` : ""}`;
    const b = document.createElement("button"); b.className = "botao secundario mini"; b.textContent = ign ? "Voltar" : "Ignorar";
    b.onclick = async () => { if (ign) ignorar.delete(x.chave); else ignorar.add(x.chave); await B.guardarConferencia(nome, { ignorar: [...ignorar] }); desenhar(true); };
    el.append(b); return el;
  };
  // por lançamento (o mais novo primeiro): cada música aparece no primeiro em que saiu nesta lista
  const porAlbum = new Map();
  for (const x of faltam) { const al = x.albuns[0]; if (!porAlbum.has(al.id)) porAlbum.set(al.id, { al, itens: [] }); porAlbum.get(al.id).itens.push(x); }
  const TIPOS = { album: "Álbum", ep: "EP", single: "Single", compile: "Coletânea" };
  for (const { al, itens } of porAlbum.values()) {
    const sec = document.createElement("section"); sec.className = "mu-qf-album";
    sec.innerHTML = `<div class="mu-qf-al">${al.capa ? `<img src="${escapar(al.capa)}" alt="" loading="lazy">` : ""}<span><b></b><small>${[TIPOS[al.tipo] || "", al.ano].filter(Boolean).join(" · ")} · ${itens.length} ${itens.length === 1 ? "faltando" : "faltando"}</small></span></div>`;
    sec.querySelector("b").textContent = al.titulo;
    itens.forEach(x => sec.append(linha(x, false)));
    caixa.append(sec);
  }
  if (ignoradas.length) {
    const d = document.createElement("details"); d.className = "mu-qf-ign";
    d.innerHTML = `<summary>Ignoradas (${ignoradas.length})</summary>`;
    ignoradas.forEach(x => d.append(linha(x, true)));
    caixa.append(d);
  }
}

function telaTodas(tela, todas) {
  const l = todas.slice().sort(B.ORDENS[ordem].fn);
  const bar = document.createElement("div"); bar.className = "mu-barra";
  bar.innerHTML = `<span>${l.length} músicas</span><label class="mu-ordem">Ordem <select aria-label="Ordem">${Object.entries(B.ORDENS).map(([k, o]) => `<option value="${k}" ${k === ordem ? "selected" : ""}>${o.nome}</option>`).join("")}</select></label>`;
  bar.querySelector("select").onchange = (e) => { ordem = e.target.value; desenhar(); };
  const al = document.createElement("button"); al.className = "botao secundario mini"; al.innerHTML = `${I.aleat}<span>Aleatório</span>`;
  al.onclick = () => tocarLista(l, Math.floor(Math.random() * l.length), { aleatorio: true });
  bar.append(al);
  tela.append(bar);
  lista(tela, l, { rotulo: rotuloDaOrdem(ordem) });
}

const nomesPlaylists = async () => new Map((await B.albuns()).map(a => [a.id, a.nome]));
async function telaAlbuns(tela) {
  const als = await B.albuns(), m = await B.faixas(), nomes = new Map(als.map(a => [a.id, a.nome]));
  const g = document.createElement("div"); g.className = "mu-albuns";
  let secaoIntel = false;
  for (const a of als) {
    const intel = a.tipo === "inteligente";
    if (intel && !secaoIntel) { secaoIntel = true; g.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Inteligentes</h3>`); }
    const fs = a.faixas.map(id => m.get(id)).filter(Boolean);
    const c = document.createElement("button"); c.className = `mu-album ${a.fixo ? "fixo" : ""} ${intel ? "intel" : ""}`;
    const fav = a.id === B.FAVORITAS, dia = a.id === B.SEU_DIA, alarme = a.id === B.ALARME;
    const caixa = document.createElement("span"); caixa.className = "mu-capa-caixa";
    caixa.append(a.fixo ? Object.assign(document.createElement("span"), { className: `mu-capa quadrada ${fav ? "favoritas" : dia ? "seudia" : alarme ? "alarme" : "estudos"}`, innerHTML: fav ? I.coracao : dia ? SOL : alarme ? DESPERTADOR : I.livro }) : capa(fs.find(f => f.temCapa) || { titulo: a.nome }, "quadrada"));
    if (intel) caixa.insertAdjacentHTML("beforeend", `<i class="mu-selo">${I.varinha}</i>`);
    c.append(caixa);
    const desc = a.id === B.ESTUDOS ? " · toca nas lições e jogos" : alarme ? " · toca no despertador" : fav ? " · as do coração" : dia ? " · muda todo dia" : intel ? ` · ${escapar(IN.resumo(a, nomes))}` : "";
    c.insertAdjacentHTML("beforeend", `<span class="mu-album-tx"><b>${escapar(a.nome)}</b><small>${fs.length} ${fs.length === 1 ? "música" : "músicas"}${desc}</small></span>`);
    c.onclick = () => { sub = { tipo: "album", id: a.id }; desenhar(); };
    g.append(c);
  }
  const novo = document.createElement("button"); novo.className = "mu-album novo";
  novo.innerHTML = `<span class="mu-capa quadrada">${I.mais2}</span><span class="mu-album-tx"><b>Nova playlist</b></span>`;
  novo.onclick = novaPlaylist;
  g.append(novo);
  tela.append(g);
}
function novaPlaylist() {
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Nova playlist</h3>`;
  const { fechar } = folha(box);
  box.append(
    opcao("Playlist comum", async () => { fechar(); const a = await novoAlbum(); if (a) { aba = "albuns"; sub = { tipo: "album", id: a.id }; desenhar(); } }),
    opcao("Playlist inteligente (por regras)…", () => { fechar(); editarInteligente(null); }),
  );
  box.insertAdjacentHTML("beforeend", `<h4 class="mu-secao">${I.varinha} Modelos prontos</h4>`);
  const l = document.createElement("div"); l.className = "mu-chips mu-modelos";
  for (const md of IN.MODELOS) { const b = document.createElement("button"); b.textContent = md.nome; b.onclick = () => { fechar(); editarInteligente(null, md); }; l.append(b); }
  box.append(l);
}

async function telaAlbum(tela, id) {
  const a = await B.album(id);
  if (!a) { sub = null; return desenhar(); }
  const fs = await B.faixasDoAlbum(id);
  const modo = E().config.musicaLicoes || "auto", intel = a.tipo === "inteligente";
  const min = Math.round(fs.reduce((t, f) => t + (f.duracao || 0), 0) / 60000);
  cabecalho(tela, {
    titulo: a.nome, voltar: () => { sub = null; desenhar(); }, lista: fs,
    sub: `${fs.length} ${fs.length === 1 ? "música" : "músicas"} · ${min} min${a.id === B.ESTUDOS ? ` · ${modo === "auto" ? "toca nas lições e jogos do Estudos" : modo === "app" ? "desligado: as lições usam a música do app" : "desligado: lições em silêncio"}` : ""}${intel ? `<br><span class="mu-intel">${I.varinha} ${escapar(IN.resumo(a, await nomesPlaylists()))}</span>` : ""}`,
    capaDe: a.fixo ? null : fs.find(f => f.temCapa) || { titulo: a.nome },
    menu: a.fixo ? null : () => menuAlbum(a),
  });
  if (intel) {
    const b = document.createElement("button"); b.className = "mu-pilula mu-editar-regras"; b.innerHTML = `${I.varinha}<span>Editar as regras</span>`;
    b.onclick = () => editarInteligente(a); tela.append(b);
    if (a.fora?.length) {
      const d = document.createElement("p"); d.className = "mu-dica";
      d.innerHTML = `${a.fora.length} ${a.fora.length === 1 ? "tirada" : "tiradas"} à mão <button class="link-mini">Devolver</button>`;
      d.querySelector("button").onclick = async () => { await B.devolverAoAlbum(a.id); desenhar(true); };
      tela.append(d);
    }
    if (!fs.length) tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nenhuma música bate com estas regras por enquanto.</p>`);
  } else if (!a.fixo || a.id === B.ALARME) {
    const b = document.createElement("button"); b.className = "mu-pilula mu-editar-regras"; b.innerHTML = `${I.mais2}<span>Adicionar músicas</span>`;
    b.onclick = async () => {
      const r = await escolherMusicas({ titulo: `Adicionar a ${a.nome}`, marcadas: new Set(a.faixas) });
      if (!r) return;
      const novas = [...r].filter(x => !a.faixas.includes(x)), saem = a.faixas.filter(x => !r.has(x));
      if (novas.length) await B.adicionarAoAlbum(a.id, novas);
      if (saem.length) await B.tirarDoAlbum(a.id, saem);
      desenhar(true);
    };
    tela.append(b);
  }
  lista(tela, fs, { album: a });
}

async function telaBusca(tela, todas) {
  const q = busca.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const norm = (s) => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  // em romaji também acha os nomes em kana e hangul ("luffy" → ルフィ, "yorushika" → ヨルシカ)
  const qs = q.trim().length >= 3 ? chaveSom(busca) : "";
  const peloSom = (t) => !!(qs && t && temKana(t) && chaveSom(t).includes(qs));
  const arts = (await B.artistas()).filter(a => norm(a.nome).includes(q) || peloSom(a.nome)).slice(0, 12);
  const fs = todas.filter(f => norm(f.titulo).includes(q) || norm(f.artista).includes(q) || norm(f.album).includes(q) || peloSom(f.titulo) || peloSom(f.artista)).sort(B.porTitulo);
  if (arts.length) {
    tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Artistas</h3>`);
    const g = document.createElement("div"); g.className = "mu-chips";
    for (const a of arts) { const b = document.createElement("button"); b.textContent = a.nome; b.onclick = () => { busca = ""; $(".mu-busca input").value = ""; $(".mu-busca").hidden = true; sub = { tipo: "artista", id: a.nome }; desenhar(); }; g.append(b); }
    tela.append(g);
  }
  tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Músicas (${fs.length})</h3>`);
  lista(tela, fs);
}

// ---------- menus sanfona (pedido do Alediov, 26/10/2026: Tags, Gêneros e climas e Edição com menus expansíveis) ----------
// Cabeçalho com ícone, título, resumo, contagem e seta; o toque abre e fecha com a altura indo de 0 ao conteúdo (grade
// 0fr → 1fr) e o conteúdo aparecendo; com "reduzir movimento", sem animação. A escolha fica no aparelho (localStorage
// "mu.sf.<id>"); sem escolha guardada vale o padrão de cada seção (abertas só as de pendência para agir ou de mais uso).
// `alerta` pinta a contagem na cor de aviso, para a pendência aparecer mesmo com a seção fechada.
const SF = "mu.sf.";
function sfAberta(id, padrao) { try { const v = localStorage.getItem(SF + id); return v == null ? padrao : v === "1"; } catch { return padrao; } }
function sfGuardar(id, aberta) { try { localStorage.setItem(SF + id, aberta ? "1" : "0"); } catch { /* sem armazenamento: vale o padrão */ } }
function sanfona({ id, titulo, icone = "", resumo = "", conta = null, alerta = false, aberta = false, menu = null, classe = "" }) {
  const ab = sfAberta(id, aberta), el = document.createElement("section");
  el.className = `mu-sf ${ab ? "aberta" : ""} ${alerta ? "alerta" : ""} ${classe}`.trim();
  el.dataset.sf = id;
  const corpoId = `mu-sf-${String(id).replace(/[^\w-]+/g, "_")}`;
  el.innerHTML = `<div class="mu-sf-cab"><button class="mu-sf-alt" aria-expanded="${ab}" aria-controls="${corpoId}">${icone ? `<i class="mu-sf-ic">${icone}</i>` : ""}<span class="mu-sf-tx"><b></b>${resumo ? "<small></small>" : ""}</span>${conta != null && conta !== "" ? `<em class="mu-sf-n"></em>` : ""}<span class="mu-sf-seta" aria-hidden="true">${I.baixo}</span></button></div><div class="mu-sf-corpo" id="${corpoId}" role="region"><div class="mu-sf-in"></div></div>`;
  el.querySelector(".mu-sf-tx b").textContent = titulo;
  if (resumo) el.querySelector(".mu-sf-tx small").textContent = resumo;
  if (conta != null && conta !== "") el.querySelector(".mu-sf-n").textContent = conta;
  const corpo = el.querySelector(".mu-sf-in"), bt = el.querySelector(".mu-sf-alt");
  corpo.inert = !ab; // fechada, o que está dentro não recebe foco
  bt.onclick = () => {
    const agora = !el.classList.contains("aberta");
    el.classList.toggle("aberta", agora); bt.setAttribute("aria-expanded", String(agora)); corpo.inert = !agora;
    sfGuardar(id, agora);
    // abrindo perto do fim da tela, rola o bastante para o começo do conteúdo aparecer
    if (agora) setTimeout(() => { const r = el.getBoundingClientRect(); if (r.top > innerHeight * 0.7) el.scrollIntoView({ block: "start", behavior: menosMov() ? "auto" : "smooth" }); }, 300);
  };
  if (menu) {
    const m = document.createElement("button"); m.className = "mu-icone mu-sf-menu"; m.setAttribute("aria-label", menu.rotulo || "Opções"); m.innerHTML = I.mais;
    m.onclick = (e) => { e.stopPropagation(); menu.fn(); };
    el.querySelector(".mu-sf-cab").append(m);
  }
  return { el, corpo };
}

// ---------- folhas (menus de baixo) ----------
function folha(conteudo, { classe = "" } = {}) {
  const fundo = document.createElement("div"); fundo.className = "mu-folha-fundo";
  const f = document.createElement("div"); f.className = `mu-folha ${classe}`;
  f.innerHTML = `<div class="mu-alca"></div>`;
  if (typeof conteudo === "string") f.insertAdjacentHTML("beforeend", conteudo); else f.append(conteudo);
  fundo.append(f); raiz.append(fundo);
  requestAnimationFrame(() => fundo.classList.add("aberto"));
  const fechar = () => { fundo.classList.remove("aberto"); setTimeout(() => fundo.remove(), 220); };
  fundo.onclick = (e) => { if (e.target === fundo) fechar(); };
  return { el: f, fechar };
}
function opcao(texto, fn, perigo = false) {
  const b = document.createElement("button"); b.className = `mu-op ${perigo ? "perigo" : ""}`; b.textContent = texto; b.onclick = fn; return b;
}

async function menuFaixa(f, ctx = {}) {
  const box = document.createElement("div");
  const topo = document.createElement("div"); topo.className = "mu-folha-topo";
  topo.append(capa(f));
  topo.insertAdjacentHTML("beforeend", `<span><b>${escapar(f.titulo)}</b><small>${escapar(f.artista)}</small></span>`);
  box.append(topo);
  box.append(avaliacao(f));
  const est = await B.album(B.ESTUDOS), naEstudos = est?.faixas.includes(f.id);
  const naAlarme = !!(await B.album(B.ALARME))?.faixas.includes(f.id);
  const { fechar } = folha(box);
  const versao = await B.versaoSpedUp(f), semDono = versao === null ? await B.versaoSemDono(f) : null;
  box.append(
    opcao("Tocar a seguir", () => { fechar(); enfileirar(f, false); }),
    opcao("Pôr no fim da fila", () => { fechar(); enfileirar(f, true); }),
    opcao(naEstudos ? "Tirar de Estudos" : "Adicionar a Estudos", async () => { fechar(); if (naEstudos) await B.tirarDoAlbum(B.ESTUDOS, [f.id]); else await B.adicionarAoAlbum(B.ESTUDOS, [f.id]); toast(naEstudos ? "Saiu de Estudos." : "Vai tocar nas lições do Estudos."); reavaliarMusica(); }),
    opcao("Adicionar a uma playlist…", () => { fechar(); escolherAlbum([f]); }),
    opcao(naAlarme ? "Tirar de Alarme" : "Adicionar a Alarme", async () => { fechar(); if (naAlarme) await B.tirarDoAlbum(B.ALARME, [f.id]); else await B.adicionarAoAlbum(B.ALARME, [f.id]); toast(naAlarme ? "Saiu do despertador." : "Vai tocar no despertador (Agenda → Alarmes)."); }),
    opcao(f.tags?.length ? `Tags internas (${f.tags.length})…` : "Tags internas…", () => { fechar(); folhaTags(f); }),
    opcao(`Gênero: ${f.genero || "sem gênero"}${f.generoManual ? " (seu)" : f.som ? " (pelo som)" : ""}${f.clima?.length ? ` · ${f.clima.join(", ")}` : ""}…`, () => { fechar(); folhaGenero(f); }),
  );
  if (ctx.album && !ctx.album.fixo) box.append(opcao(`Tirar de ${ctx.album.nome}`, async () => { fechar(); await B.tirarDoAlbum(ctx.album.id, [f.id]); if (ctx.album.tipo === "inteligente") toast(`Não entra mais em ${ctx.album.nome} (dá para devolver na playlist).`, 3500); }));
  if (ctx.tag?.tipo === "grupo") box.append(opcao(`Tirar a tag ${ctx.tag.nome}`, async () => { fechar(); await B.marcarTag([f.id], ctx.tag.nome, false); desenhar(true); }));
  if (!(sub?.tipo === "artista" && sub.id === f.artista)) box.append(opcao(`Ver ${f.artista}`, () => { fechar(); fecharTocando(); busca = ""; $(".mu-busca").hidden = true; sub = { tipo: "artista", id: f.artista }; desenhar(); }));
  if (semDono) box.append(opcao(`"${semDono.titulo}" é desta música?`, () => { fechar(); perguntarDono(semDono); }));
  else if (versao === null) box.append(opcao("Criar a versão Sped Up", () => { fechar(); abrirEditor(f, ED.SPED_UP); }));
  box.append(opcao("Editar (cria uma cópia)…", () => { fechar(); abrirEditor(f, B.ehVersao(f) ? ED.SEM_EFEITO : ED.SPED_UP); }));
  box.append(opcao("Editar tags…", () => { fechar(); abrirEditorTags(f); }));
  box.append(opcao("Informações", () => { fechar(); informacoes(f); }));
}

/** Estrelas + coração (lado a lado). */
function avaliacao(f, classe = "grande") {
  const l = document.createElement("div"); l.className = `mu-avaliar ${classe}`;
  l.append(estrelas(f.nota || 0, { classe, aoMudar: (n) => avaliar(f, n) }), botaoCoracao(f));
  return l;
}
function botaoCoracao(f) {
  const b = document.createElement("button");
  b.className = `mu-coracao ${f.fav ? "on" : ""}`; b.innerHTML = I.coracao;
  b.setAttribute("aria-label", f.fav ? "Tirar das Favoritas" : "Pôr nas Favoritas");
  b.onclick = async (e) => {
    e.stopPropagation();
    f.fav = !f.fav;
    raiz.querySelectorAll(`.mu-coracao[data-id="${CSS.escape(f.id)}"]`).forEach(x => x.classList.toggle("on", f.fav));
    b.classList.toggle("on", f.fav); b.classList.add("pulsa"); setTimeout(() => b.classList.remove("pulsa"), 400);
    await B.favoritar(f.id, f.fav);
    toast(f.fav ? "Nas Favoritas." : "Saiu das Favoritas.");
  };
  b.dataset.id = f.id;
  return b;
}

async function enfileirar(f, fim) {
  const fs = Array.isArray(f) ? f : [f];
  try {
    if (!estado.ativo || !filaAtual.length) return tocarLista(fs, 0);
    await motor.enfileirar(fs, fim);
    if (fim) filaAtual.push(...fs); else filaAtual.splice((estado.indice ?? 0) + 1, 0, ...fs);
    guardarFila();
    toast(fim ? (fs.length > 1 ? `${fs.length} foram para o fim da fila.` : "Foi para o fim da fila.") : (fs.length > 1 ? `${fs.length} tocam depois desta.` : "Toca depois desta."));
  } catch (e) { toast(e.message); }
}

async function avaliar(f, n) {
  await B.avaliar(f.id, n);
  f.nota = n;
  raiz.querySelectorAll(`.mu-faixa[data-id="${CSS.escape(f.id)}"] .mu-est`).forEach(e => e.pintar(n));
  if (estado.id === f.id) $(".mu-tocando .mu-est")?.pintar(n);
  // a pergunta "Criar a versão Sped Up?" ao dar 5 estrelas saiu (pedido do Alediov, 02/11/2026): as que faltam ficam
  // na tela "Sped Up das 5 estrelas" (aba Edição e Ajustes), com "Criar as N que faltam"
}

/** Uma versão antiga ("Lua (Sped Up)") com o título em dois ou mais artistas: pergunta de qual é e põe o artista no nome. */
async function perguntarDono(g) {
  const item = (await B.versoesSemDono()).find(x => x.versao.id === g.id);
  if (!item) return null;
  const artistas = [...new Map(item.candidatos.map(o => [o.artista, o])).values()];
  const base = analisarTitulo(g.titulo).base, ex = artistas[0];
  const v = await modal({ titulo: "De quem é esta versão?", texto: `"${g.titulo}" está em ${await B.pastaVersoes()}, mas há "${base}" de ${artistas.map(o => o.artista).join(" e de ")}. Para não confundir, o nome passa a levar o artista original, como "${(await B.nomeVersao(ex, analisarTitulo(g.titulo).versoes.find(x => x !== "Instrumental" && x !== "Remake") || "Sped Up")).nome}".`,
    botoes: [...artistas.map(o => ({ texto: `De ${o.artista}`, valor: o.id })), { texto: "Não sei agora", valor: null, classe: "secundario" }] });
  if (!v) return null;
  if (estado.id === g.id) { toast("Essa versão está tocando: passe para a próxima e tente de novo."); return null; }
  try {
    const nova = await B.atribuirVersao(g, item.candidatos.find(o => o.id === v));
    toast(`Agora é "${nova.titulo}".`); desenhar(true);
    return nova;
  } catch (e) { toast(`Não consegui renomear: ${e.message}`, 4500); return null; }
}

async function informacoes(f) {
  const orig = f.versaoDe ? await B.faixa(f.versaoDe) : null;
  const linhas = [["Título", f.titulo], ["Artista", f.artista], ["Álbum", f.album], ["Artista do álbum", f.albumArtista], ["Gênero", f.genero], ["Ano", f.ano], ["Faixa", f.faixa], ["Duração", tempo(f.duracao)], ["Formato", `${(f.formato || "").toUpperCase()}${f.bitrate ? ` · ${Math.round(f.bitrate / 1000)} kbps` : ""}`], ["Estrelas", textoNota(f.nota) || "sem"], ["Versão", tagsDaFaixa(f).versoes.join(", ")], ["Tags", (f.tags || []).join(", ")], ["Versão de", orig ? `${orig.titulo} (${orig.artista})` : ""], ["Tocada", `${f.tocadas || 0} ${f.tocadas === 1 ? "vez" : "vezes"}`], ["Pulada", `${f.puladas || 0} ${f.puladas === 1 ? "vez" : "vezes"}`], ["Última vez", f.ultimaVez ? new Date(f.ultimaVez).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "nunca"], ["Arquivo", f.caminho]];
  folha(`<h3 class="mu-folha-tit">Informações</h3><dl class="mu-info">${linhas.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${escapar(String(v))}</dd>`).join("")}</dl>`);
}

async function novoAlbum() {
  const r = await formulario({ titulo: "Nova playlist", campos: [{ id: "nome", rotulo: "Nome", tipo: "text", valor: "", placeholder: "Ex.: Para Correr" }], botoes: [{ texto: "Criar", acao: "salvar" }] });
  if (!r?.nome?.trim()) return null;
  return B.criarAlbum(r.nome);
}
async function escolherAlbum(fs) {
  const als = (await B.albuns()).filter(a => a.tipo !== "inteligente");
  const box = document.createElement("div");
  box.insertAdjacentHTML("beforeend", `<h3 class="mu-folha-tit">Adicionar a uma playlist</h3>`);
  const { fechar } = folha(box);
  for (const a of als) box.append(opcao(a.nome, async () => { fechar(); const n = await B.adicionarAoAlbum(a.id, fs.map(f => f.id)); toast(n ? `Adicionada a ${a.nome}.` : `Já estava em ${a.nome}.`); if (a.fixo) reavaliarMusica(); }));
  box.append(opcao("+ Nova playlist…", async () => { fechar(); const a = await novoAlbum(); if (a) { await B.adicionarAoAlbum(a.id, fs.map(f => f.id)); toast(`Adicionada a ${a.nome}.`); } }));
}
function menuAlbum(a) {
  const box = document.createElement("div");
  box.insertAdjacentHTML("beforeend", `<h3 class="mu-folha-tit">${escapar(a.nome)}</h3>`);
  const { fechar } = folha(box);
  if (a.tipo === "inteligente") box.append(opcao("Editar as regras…", () => { fechar(); editarInteligente(a); }));
  box.append(
    opcao("Renomear", async () => { fechar(); const r = await formulario({ titulo: "Renomear playlist", campos: [{ id: "nome", rotulo: "Nome", tipo: "text", valor: a.nome }] }); if (r?.nome?.trim()) { await B.renomearAlbum(a.id, r.nome); desenhar(); } }),
    opcao("Duplicar", async () => { fechar(); const c = await B.duplicarAlbum(a.id); if (c) { sub = { tipo: "album", id: c.id }; desenhar(); } }),
    opcao("Apagar a playlist", async () => { fechar(); const v = await modal({ titulo: `Apagar ${a.nome}?`, texto: "As músicas continuam na biblioteca; só a playlist some.", botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] }); if (v) { await B.apagarAlbum(a.id); sub = null; desenhar(); } }, true),
  );
}

async function ajustes() {
  const p = await B.pasta(), todas = await B.listaFaixas(), arts = new Set(todas.map(f => f.artista));
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Ajustes das Músicas</h3>
    <p class="mu-dica">${p ? `<b>${escapar(p.nome)}</b> · ${todas.length} músicas · ${arts.size} artistas` : "Nenhuma pasta escolhida."}</p>
    <label class="campo">Nas lições e jogos do Estudos<select><option value="auto">Tocar a playlist Estudos (se tiver músicas)</option><option value="app">Tocar a música do app</option><option value="silencio">Silêncio</option></select></label>`;
  const sel = box.querySelector("select"); sel.value = E().config.musicaLicoes || "auto";
  sel.onchange = () => { E().config.musicaLicoes = sel.value; salvar(); reavaliarMusica(); };
  const pv = await B.pastaVersoes(), su = await B.spedUpDasCinco(), grav = await B.gravacoesPendentes();
  const esc = await B.pastaEntradaEscolhida();
  box.insertAdjacentHTML("beforeend", `<p class="mu-dica">Pasta de entrada: <b>${esc ? escapar(esc.nome) : "nenhuma"}</b></p>`);
  box.insertAdjacentHTML("beforeend", `<label class="campo">Pasta das suas versões<input type="text" value="${escapar(pv)}"></label>${grav ? `<p class="mu-dica">${grav} ${grav === 1 ? "música espera" : "músicas esperam"} para gravar no arquivo.</p>` : ""}`);
  box.querySelector('input[type="text"]').onchange = (e) => B.definirPastaVersoes(e.target.value);
  // tocador: transição, volume igualado, rotinas; dados guardados na pasta
  const semVol = (await B.semVolume()).length, rots = await B.rotinas(), guardado = await B.guardadoNaPasta();
  box.insertAdjacentHTML("beforeend", `<h4 class="mu-secao">Tocador</h4>
    <label class="campo">Transição entre as músicas<select class="mu-aj-trans"><option value="0">Desligada</option><option value="2000">2 segundos</option><option value="4000">4 segundos</option><option value="6000">6 segundos</option><option value="8000">8 segundos</option><option value="10000">10 segundos</option></select></label>
    <label class="linha-cfg mu-aj-linha"><span>Volume igualado<small class="mu-dica mu-aj-vol" style="display:block;margin:2px 0 0"></small></span></label>`);
  const tr = box.querySelector(".mu-aj-trans"); tr.value = String(cfgT.transicao || 0);
  tr.onchange = async () => { cfgT = await B.definirTocador({ transicao: +tr.value }); };
  const vol = box.querySelector(".mu-aj-vol");
  const pintarVol = () => { vol.textContent = !cfgT.igualar ? "" : progVol && progVol.feitas < progVol.total ? `Medindo: ${progVol.feitas} de ${progVol.total}…` : semVol ? `${semVol} sem medir` : ""; vol.hidden = !vol.textContent; };
  const ch = document.createElement("button"); ch.className = `chave ${cfgT.igualar ? "on" : ""}`; ch.setAttribute("aria-label", "Volume igualado");
  ch.onclick = async (e) => { e.preventDefault(); cfgT = await B.definirTocador({ igualar: !cfgT.igualar }); ch.classList.toggle("on", cfgT.igualar); pintarVol(); if (cfgT.igualar) medirVolumesAgora(); };
  box.querySelector(".mu-aj-linha").append(ch); pintarVol();
  // gêneros pelo som: ligar, ouvir agora, reavaliar e quais versões são ouvidas à parte (02/11/2026)
  const cfgG = await B.cfgGeneros(), semGen = (await B.semGenero()).length;
  box.insertAdjacentHTML("beforeend", `<h4 class="mu-secao">Gêneros pelo som</h4><label class="linha-cfg mu-aj-gen"><span>Classificar pelo som<small class="mu-dica mu-aj-gen-tx mu-gen-prog" style="display:block;margin:2px 0 0"></small></span></label>`);
  const gtx = box.querySelector(".mu-aj-gen-tx");
  const pintarGen = () => { gtx.textContent = progGen && progGen.feitas < progGen.total ? `Ouvindo: ${progGen.feitas} de ${progGen.total}…` : semGen ? `${semGen} sem ouvir` : ""; gtx.hidden = !gtx.textContent; };
  const cg = document.createElement("button"); cg.className = `chave ${cfgG.auto ? "on" : ""}`; cg.setAttribute("aria-label", "Gêneros pelo som");
  cg.onclick = async (e) => { e.preventDefault(); Object.assign(cfgG, await B.definirCfgGeneros({ auto: !cfgG.auto })); cg.classList.toggle("on", cfgG.auto); pintarGen(); if (cfgG.auto) analisarGenerosAgora(); };
  box.querySelector(".mu-aj-gen").append(cg); pintarGen();
  box.insertAdjacentHTML("beforeend", `<p class="mu-dica mu-dica-curta">Versões ouvidas à parte</p>`);
  box.append(chipsAParte(cfgG));
  const { fechar } = folha(box);
  box.append(opcao(semGen ? `Ouvir agora (${semGen})` : "Ouvir agora", () => { fechar(); ouvirGenerosAgora(); }));
  box.append(opcao("Reavaliar todas…", () => { fechar(); reavaliarTodas(); }));
  box.append(opcao("Ver os gêneros e climas", () => { fechar(); busca = ""; aba = "tags"; sub = { tipo: "generos" }; desenhar(); }));
  box.insertAdjacentHTML("beforeend", `<h4 class="mu-secao">Biblioteca</h4>`);
  box.append(opcao(`Rotinas por horário${rots.length ? ` (${rots.length})` : ""}…`, () => { fechar(); folhaRotinas(); }));
  box.append(opcao(esc ? "Trocar a pasta de entrada" : "Escolher a pasta de entrada", () => { fechar(); escolherEntrada(); }));
  box.append(opcao(`Sped Up das 5 estrelas${su.faltam.length ? ` (${su.faltam.length} sem)` : ""}`, () => { fechar(); busca = ""; aba = "editar"; sub = { tipo: "spedup" }; desenhar(); }));
  box.append(opcao("Procurar versões com defeito", () => { fechar(); toast("Procurando…"); conferirVersoes(true); }));
  box.append(opcao("Arrumar os anos pelas originais", () => { fechar(); arrumarAnos(); }));
  const nomesArq = await B.nomesDosArquivos();
  if (nomesArq.length) box.append(opcao(`Nomes dos arquivos (${nomesArq.length})`, () => { fechar(); busca = ""; aba = "editar"; sub = { tipo: "nomes" }; desenhar(); }));
  const sd = await B.versoesSemDono(), rep = await B.titulosRepetidos(), dup = await B.duplicatas(), ftL = await B.feats();
  if (sd.length || rep.length || dup.length || ftL.length) box.append(opcao(`Desambiguar e duplicatas${sd.length + rep.length + dup.length ? ` (${sd.length + rep.length + dup.length})` : ""}${ftL.length ? ` · ${ftL.length} feat.` : ""}`, () => { fechar(); aba = "editar"; sub = { tipo: "desambiguar" }; desenhar(); }));
  box.append(
    opcao(p ? "Ler a pasta de novo" : "Escolher a pasta", () => { fechar(); p ? sincronizar() : escolherPasta(); }),
    ...(p ? [opcao("Trocar de pasta", () => { fechar(); escolherPasta(); })] : []),
  );
  // do celular para o tablet pelo Wi-Fi de casa (transferir.js): os artistas com ✓ e os "não se aplica"
  if (nativo && p) {
    box.insertAdjacentHTML("beforeend", `<h4 class="mu-secao">Celular e tablet</h4>`);
    box.append(
      opcao("Enviar para o tablet", () => { fechar(); import("./transferir.js").then(m => m.enviarParaTablet()); }),
      opcao("Receber do celular", () => { fechar(); import("./transferir.js").then(m => m.receberDoCelular(() => desenhar())); }),
    );
  }
  // backup no Google Drive (drive.js, 02/11/2026): a tela própria
  if (p) {
    const dr = await import("./drive.js").then(m => m.situacao()).catch(() => null);
    box.insertAdjacentHTML("beforeend", `<h4 class="mu-secao">Backup no Drive</h4>`);
    const rot = !dr?.conectado ? "Conectar o Google Drive" : dr.servico?.rodando ? `Backup no Drive (${(dr.servico.feitos || 0).toLocaleString("pt-BR")} de ${(dr.servico.total || 0).toLocaleString("pt-BR")})` : "Backup no Drive";
    const o = opcao(rot, () => { fechar(); busca = ""; sub = { tipo: "drive" }; desenhar(); }); o.classList.add("mu-aj-drive");
    box.append(o);
  }
  if (p) {
    box.insertAdjacentHTML("beforeend", `<h4 class="mu-secao">Na pasta (.orbita)</h4>${guardado ? `<p class="mu-dica">Última vez: ${new Date(guardado).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>` : ""}`);
    box.append(opcao("Guardar na pasta agora", async () => { fechar(); try { await B.guardarNaPasta(); toast("Guardado na pasta das músicas."); } catch (e) { toast(`Não consegui guardar: ${e.message}`, 4500); } }));
  }
}

// ---------- mini tocador e tela "Tocando" ----------
async function desenharMini() {
  const m = $(".mu-mini");
  const f = estado.id ? await B.faixa(estado.id) : null;
  m.hidden = !f;
  raiz.classList.toggle("com-mini", !!f);
  if (!f) return;
  m.innerHTML = `<div class="mu-mini-barra"><i></i></div>`;
  m.append(capa(f));
  m.insertAdjacentHTML("beforeend", `<span class="mu-mini-tx"><b>${escapar(f.titulo)}</b><small>${escapar(f.artista)}</small></span>`);
  const bp = document.createElement("button"); bp.className = "mu-icone mu-mini-play"; bp.setAttribute("aria-label", "Tocar ou pausar"); bp.innerHTML = estado.querTocar ? I.pausa : I.play;
  bp.onclick = (e) => { e.stopPropagation(); cmd(estado.querTocar ? "pausar" : "continuar"); };
  const bn = document.createElement("button"); bn.className = "mu-icone"; bn.setAttribute("aria-label", "Próxima"); bn.innerHTML = I.prox;
  bn.onclick = (e) => { e.stopPropagation(); cmd("proxima"); };
  m.append(bp, bn);
  m.onclick = abrirTocando;
  m.querySelector(".mu-mini-barra i").style.width = `${estado.duracao ? 100 * estado.posicao / estado.duracao : 0}%`;
}

async function abrirTocando() {
  const t = $(".mu-tocando");
  t.hidden = false;
  await desenharTocando();
  requestAnimationFrame(() => t.classList.add("aberto"));
  setTimeout(() => { if (t.classList.contains("aberto")) raiz.classList.add("com-tocando"); }, 300); // depois de subir
}
function fecharTocando() {
  const t = $(".mu-tocando");
  if (!t || t.hidden) return;
  raiz.classList.remove("com-tocando");
  t.classList.remove("aberto");
  setTimeout(() => { t.hidden = true; }, 260);
}

// Cores da capa na tela Tocando (pedido do Alediov, 24/10/2026): fundo com a arte desfocada girando devagar e manchas
// nas três cores da capa, brilho da capa, botão de tocar, onda da barra de tempo, estrelas e pílulas na cor viva.
// As variáveis --capa-* são registradas (@property em musicas.css), então a troca de música muda as cores aos poucos.
let barraT = null;
async function aplicarCores(t, f) {
  const fundo = lerCor(getComputedStyle(raiz).getPropertyValue("--fundo")), escuro = fundo ? ehEscura(fundo) : true;
  const url = f.temCapa ? await B.capaDe(f).catch(() => "") : "";
  let pal = null;
  if (url) { try { pal = await paletaDaImagem(url); } catch { pal = null; } }
  if (!pal) pal = paletaDeCor(lerCor(cor(f.artista || f.titulo)) || [90, 110, 230]);
  if (!t.isConnected || estado.id !== f.id) return;
  const d = destaque(pal.viva, escuro), d2 = destaque(pal.segunda, escuro);
  const v = { "--capa-1": paraFundo(pal.dominante, escuro), "--capa-2": paraFundo(pal.viva, escuro), "--capa-3": paraFundo(pal.segunda, escuro), "--capa-acento": d.cor, "--capa-sobre": d.sobre, "--tinta-capa": pal.viva };
  for (const [k, c] of Object.entries(v)) t.style.setProperty(k, cssCor(c));
  t.classList.add("com-cores");
  const arte = t.querySelector(".mu-t-arte");
  // o fundo é a capa já desfocada num canvas pequeno (uma vez só), esticada: girar uma imagem pronta é leve; o
  // filter: blur() do CSS numa camada do tamanho da tela pesava a cada quadro
  if (arte && url) {
    const img = new Image();
    img.onload = () => {
      if (!arte.isConnected) return;
      try {
        const c = document.createElement("canvas"); c.width = c.height = 48;
        const g = c.getContext("2d"); g.filter = "blur(5px) saturate(1.6)"; g.drawImage(img, -6, -6, 60, 60);
        arte.style.backgroundImage = `url("${c.toDataURL("image/jpeg", 0.85)}")`;
      } catch { arte.style.backgroundImage = `url("${url}")`; }
      arte.classList.add("pronta");
    };
    img.src = url;
  }
  const tinta = lerCor(getComputedStyle(t).color) || (escuro ? [240, 242, 248] : [20, 24, 40]);
  barraT?.cores(cssCor(d2.cor), cssCor(d.cor), cssCor(tinta, 0.2));
}

async function desenharTocando() {
  const t = $(".mu-tocando");
  const f = estado.id ? await B.faixa(estado.id) : null;
  if (!f) { fecharTocando(); return; }
  const est = await B.album(B.ESTUDOS), naEstudos = est?.faixas.includes(f.id);
  t.innerHTML = `
    <div class="mu-t-fundo" aria-hidden="true"><i class="mu-t-arte"></i></div>
    <div class="mu-t-topo"><button class="mu-icone" data-acao="fechar" aria-label="Fechar">${I.baixo}</button><span>Tocando agora</span><button class="mu-icone" data-acao="fila" aria-label="Fila">${I.fila}</button></div>
    <div class="mu-t-capa"></div>
    <div class="mu-t-tx"><b></b><button class="mu-t-artista"></button></div>
    <div class="mu-t-tags"></div>
    <div class="mu-t-est"></div>
    <div class="mu-t-tempo"><div class="mu-t-trilho"><input type="range" class="mu-t-barra" min="0" step="1000" aria-label="Posição"></div><span class="mu-t-pos">0:00</span><span class="mu-t-dur">0:00</span></div>
    <div class="mu-t-ctrl">
      <button class="mu-icone" data-acao="aleatorio" aria-label="Aleatório">${I.aleat}</button>
      <button class="mu-icone grande" data-acao="anterior" aria-label="Anterior">${I.ant}</button>
      <button class="mu-t-play" data-acao="play" aria-label="Tocar ou pausar">${estado.querTocar ? I.pausa : I.play}</button>
      <button class="mu-icone grande" data-acao="proxima" aria-label="Próxima">${I.prox}</button>
      <button class="mu-icone" data-acao="repetir" aria-label="Repetir">${I.repetir}<i>1</i></button>
    </div>
    <div class="mu-t-extras"><button class="mu-pilula" data-acao="timer">${I.lua}<span>Timer</span></button><button class="mu-pilula ${cfgT.radio ? "on" : ""}" data-acao="radio">${I.radio}<span>Rádio</span></button></div>
    <div class="mu-t-baixo"><button class="mu-pilula ${naEstudos ? "on" : ""}" data-acao="estudos">${I.livro}<span>${naEstudos ? "Em Estudos" : "Adicionar a Estudos"}</span></button><button class="mu-pilula" data-acao="mais">${I.mais}<span>Mais</span></button></div>`;
  t.querySelector(".mu-t-capa").append(capa(f, "enorme"));
  t.querySelector(".mu-t-tx b").textContent = f.titulo;
  const ba = t.querySelector(".mu-t-artista"); ba.textContent = f.artista;
  ba.onclick = () => { fecharTocando(); busca = ""; sub = { tipo: "artista", id: f.artista }; desenhar(); };
  // feat.: "feat. Novaz" embaixo do artista (o toque abre o outro artista)
  for (const nome of B.artistasFeat(f)) {
    const bf = document.createElement("button"); bf.className = "mu-t-feat"; bf.textContent = `feat. ${nome}`;
    bf.onclick = () => { fecharTocando(); busca = ""; sub = { tipo: "artista", id: nome }; desenhar(); };
    t.querySelector(".mu-t-tx").append(bf);
  }
  t.querySelector(".mu-t-est").append(avaliacao(f));
  bolhas(t, 8);
  t.prepend(t.querySelector(".mu-t-fundo")); // o fundo da capa fica embaixo das bolhas
  // original ↔ Sped Up, no mesmo ponto da música
  B.outraVersao(f).then(g => {
    if (!g || !t.isConnected || estado.id !== f.id) return;
    const b = document.createElement("button"); b.className = "mu-pilula"; b.dataset.acao = "versao";
    b.innerHTML = `${I.trocar}<span>${B.ehVersao(g) ? "Ouvir a Sped Up" : "Ouvir a original"}</span>`;
    b.onclick = (e) => { e.stopPropagation(); trocarVersao(f, g); };
    t.querySelector(".mu-t-extras")?.append(b);
  });
  const tg = tagsDaFaixa(f), boxT = t.querySelector(".mu-t-tags");
  for (const [nome, tipo] of [...tg.versoes.map(v => [v, "versao"]), ...tg.grupos.map(g => [g, "grupo"])]) {
    const c = document.createElement("button"); c.className = `mu-tag-chip ${tipo}`; c.style.setProperty("--c", corDaTag(nome)); c.innerHTML = nomeTag(nome);
    c.onclick = () => { fecharTocando(); busca = ""; aba = "tags"; sub = { tipo: "tag", id: nome, tipoTag: tipo }; desenhar(); };
    boxT.append(c);
  }
  if (f.genero || f.clima?.length) {
    const cg = document.createElement("button"); cg.className = "mu-tag-chip genero"; cg.style.setProperty("--c", "var(--capa-acento, var(--acento))");
    cg.innerHTML = `${I.onda}<span>${escapar([f.genero, ...(f.clima || [])].filter(Boolean).join(" · "))}</span>`;
    cg.onclick = () => folhaGenero(f);
    boxT.prepend(cg);
  }
  const mt = document.createElement("button"); mt.className = "mu-tag-chip mais"; mt.innerHTML = `${I.etiqueta}<span>${tg.grupos.length ? "" : "Tags"}</span>`; mt.setAttribute("aria-label", "Tags da música");
  mt.onclick = () => folhaTags(f); boxT.append(mt);
  const r = t.querySelector(".mu-t-barra");
  barraT = barraTempo(t.querySelector(".mu-t-trilho"), r, { formatar: tempo });
  aplicarCores(t, f);
  r.oninput = () => { r.dataset.arrastando = "1"; r.style.setProperty("--p", `${r.max ? 100 * r.value / r.max : 0}%`); t.querySelector(".mu-t-pos").textContent = tempo(+r.value); };
  r.onchange = () => { delete r.dataset.arrastando; cmd("buscar", { ms: +r.value }); };
  t.onclick = async (e) => {
    const b = e.target.closest("[data-acao]"); if (!b) return;
    const a = b.dataset.acao;
    if (a === "fechar") fecharTocando();
    else if (a === "play") cmd(estado.querTocar ? "pausar" : "continuar");
    else if (a === "anterior" || a === "proxima") cmd(a);
    else if (a === "aleatorio") alternarAleatorio();
    else if (a === "repetir") cmd("repetir", { valor: { nao: "todas", todas: "uma", uma: "nao" }[estado.repetir || "nao"] });
    else if (a === "fila") mostrarFila();
    else if (a === "timer") folhaTimer();
    else if (a === "radio") alternarRadio(b);
    else if (a === "mais") menuFaixa(f);
    else if (a === "estudos") {
      if (naEstudos) await B.tirarDoAlbum(B.ESTUDOS, [f.id]); else await B.adicionarAoAlbum(B.ESTUDOS, [f.id]);
      toast(naEstudos ? "Saiu de Estudos." : "Vai tocar nas lições do Estudos.");
      reavaliarMusica(); desenharTocando();
    }
  };
  atualizarEstado(estado);
}

async function mostrarFila() {
  const ids = await motor.fila().catch(() => []), m = await B.faixas();
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Fila (${ids.length})</h3>`;
  const l = document.createElement("div"); l.className = "mu-fila";
  const { fechar } = folha(box, { classe: "alta" });
  const iAtual = Math.max(0, estado.indice ?? ids.indexOf(estado.id));
  ids.slice(iAtual, iAtual + 200).forEach((id, k) => {
    const f = m.get(id); if (!f) return;
    const el = document.createElement("button"); el.className = `mu-fila-item ${k === 0 ? "atual" : ""}`;
    el.append(capa(f));
    el.insertAdjacentHTML("beforeend", `<span><b>${escapar(f.titulo)}</b><small>${escapar(f.artista)}</small></span>`);
    el.onclick = () => { fechar(); cmd("irPara", { indice: iAtual + k }); };
    l.append(el);
  });
  box.append(l);
}

// ---------- estatísticas ----------
const DIA = 86400000;
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function horas(ms) { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`; }
function barras(dados, { rotulos, destaque = -1, titulo = "" } = {}) {
  const max = Math.max(1, ...dados);
  const el = document.createElement("div"); el.className = "mu-barras";
  el.setAttribute("role", "img"); el.setAttribute("aria-label", titulo);
  el.innerHTML = dados.map((v, i) => `<span class="${i === destaque ? "on" : ""}" title="${rotulos?.[i] ?? i}: ${v}"><i style="height:${Math.max(v ? 4 : 0, Math.round(100 * v / max))}%"></i><small>${rotulos?.[i] ?? ""}</small></span>`).join("");
  return el;
}
let vistaStats = (() => { try { return localStorage.getItem("mu.stats.vista") === "voce" ? "voce" : "geral"; } catch { return "geral"; } })();
async function telaEstatisticas(tela) {
  const reps = await BD.todasReproducoes(), m = await B.faixas(), todas = [...m.values()];
  const agora = Date.now(), desde = periodo ? agora - periodo * DIA : 0;
  const r = reps.filter(x => x.em >= desde), toc = r.filter(x => x.tipo === "tocada"), pul = r.filter(x => x.tipo === "pulada");
  cabecalho(tela, { titulo: "Estatísticas", voltar: () => { sub = null; desenhar(); }, acoes: false, sub: "Do que você ouviu no Órbita" });
  // Geral | Você e a música (04/11/2026: volume, clima, horários, humor e as correlações com a Agenda; telaVoce.js)
  const seg = document.createElement("div"); seg.className = "mu-vc-seg"; seg.setAttribute("role", "tablist");
  for (const [k, nome] of [["geral", "Geral"], ["voce", "Você e a música"]]) {
    const b = document.createElement("button"); b.textContent = nome; b.setAttribute("role", "tab"); b.dataset.vista = k;
    b.classList.toggle("on", vistaStats === k); b.setAttribute("aria-selected", String(vistaStats === k));
    b.onclick = () => { if (vistaStats === k) return; vistaStats = k; try { localStorage.setItem("mu.stats.vista", k); } catch { /* */ } desenhar(true); };
    seg.append(b);
  }
  tela.append(seg);
  if (vistaStats === "voce") {
    const chipsV = document.createElement("div"); chipsV.className = "mu-chips mu-periodos";
    for (const [d, nome] of [[7, "7 dias"], [30, "30 dias"], [365, "1 ano"], [0, "Tudo"]]) {
      const b = document.createElement("button"); b.textContent = nome; b.classList.toggle("on", periodo === d);
      b.onclick = () => { periodo = d; desenhar(true); }; chipsV.append(b);
    }
    tela.append(chipsV);
    const V = await import("./telaVoce.js");
    await V.telaVoce(tela, { reps: r, faixas: m, todas: reps, periodo });
    return;
  }
  const RT = await import("./retrospectiva.js"), meses = await RT.mesesComDados();
  if (meses.length) {
    const c = document.createElement("button"); c.className = "mu-retro-cartao";
    c.innerHTML = `<small>Retrospectiva</small><b>${RT.nomeMes(meses[0])}</b><span>A música, o artista e a tag do mês, e mais</span>`;
    c.onclick = () => { sub = { tipo: "retro", mes: meses[0] }; desenhar(); };
    tela.append(c);
  }
  const chips = document.createElement("div"); chips.className = "mu-chips mu-periodos";
  for (const [d, nome] of [[7, "7 dias"], [30, "30 dias"], [365, "1 ano"], [0, "Tudo"]]) {
    const b = document.createElement("button"); b.textContent = nome; b.classList.toggle("on", periodo === d);
    b.onclick = () => { periodo = d; desenhar(true); }; chips.append(b);
  }
  tela.append(chips);
  const tempoOuvido = toc.reduce((s, x) => s + (x.dur || m.get(x.id)?.duracao || 0), 0);
  const distintas = new Set(toc.map(x => x.id)).size;
  tela.insertAdjacentHTML("beforeend", `<div class="mu-stats">
    <div><b>${toc.length}</b><small>Reproduções</small></div>
    <div><b>${horas(tempoOuvido)}</b><small>Ouvindo</small></div>
    <div><b>${distintas}</b><small>Músicas diferentes</small></div>
    <div><b>${r.length ? Math.round(100 * pul.length / r.length) : 0}%</b><small>Puladas</small></div></div>`);
  if (!reps.length) tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nada ouvido ainda.</p>`);
  // por dia (ou por mês, no ano e no tudo)
  const porMes = periodo === 0 || periodo === 365;
  let dados = [], rot = [];
  if (porMes) {
    for (let k = 11; k >= 0; k--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); d.setHours(0, 0, 0, 0);
      const f = new Date(d); f.setMonth(f.getMonth() + 1);
      dados.push(toc.filter(x => x.em >= +d && x.em < +f).length);
      rot.push(maiuscula(d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").slice(0, 3)));
    }
  } else {
    const n = periodo;
    for (let k = n - 1; k >= 0; k--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - k);
      dados.push(toc.filter(x => x.em >= +d && x.em < +d + DIA).length);
      rot.push(n <= 7 ? maiuscula(d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)) : (k % 5 === 0 ? String(d.getDate()) : ""));
    }
  }
  tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">${porMes ? "Por mês" : "Por dia"}</h3>`);
  tela.append(barras(dados, { rotulos: rot, destaque: dados.length - 1, titulo: "Reproduções por período" }));
  // por hora do dia: em "Você e a música" → Horários (com o mapa hora × dia da semana)
  // mais tocadas e artistas
  const conta = (l, chave) => { const c = new Map(); l.forEach(x => { const k = chave(x); if (k) c.set(k, (c.get(k) || 0) + 1); }); return [...c].sort((a, b) => b[1] - a[1]); };
  const top = conta(toc, x => x.id).filter(([id]) => m.has(id)).slice(0, 10);
  if (top.length) {
    tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Mais tocadas</h3>`);
    const fs = top.map(([id]) => m.get(id));
    const box = document.createElement("div"); box.className = "mu-lista";
    top.forEach(([id, n], i) => { const el = linhaFaixa(m.get(id), fs, i); el.querySelector("small").insertAdjacentHTML("afterbegin", `<b class="mu-n">${n}×</b> `); el.prepend(Object.assign(document.createElement("span"), { className: "mu-pos", textContent: i + 1 })); box.append(el); });
    tela.append(box);
  }
  const arts = conta(toc, x => x.artista || m.get(x.id)?.artista).slice(0, 8);
  if (arts.length) {
    tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Artistas que você mais ouviu</h3>`);
    const max = arts[0][1];
    tela.insertAdjacentHTML("beforeend", `<div class="mu-ranking">${arts.map(([a, n]) => `<div><span>${escapar(a)}</span><i style="width:${Math.round(100 * n / max)}%"></i><b>${n}</b></div>`).join("")}</div>`);
  }
  const maisPuladas = conta(pul, x => x.id).filter(([id]) => m.has(id)).slice(0, 5);
  if (maisPuladas.length) {
    tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Mais puladas</h3>`);
    const fs = maisPuladas.map(([id]) => m.get(id)), box = document.createElement("div"); box.className = "mu-lista";
    maisPuladas.forEach(([id, n], i) => { const el = linhaFaixa(m.get(id), fs, i); el.querySelector("small").insertAdjacentHTML("afterbegin", `<b class="mu-n">${n}× pulada</b> `); box.append(el); });
    tela.append(box);
  }
  // biblioteca
  const notas = Array(10).fill(0); let semNota = 0, soma = 0, comNota = 0;
  todas.forEach(f => { if (f.nota) { notas[f.nota - 1]++; soma += f.nota; comNota++; } else semNota++; });
  tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">A sua biblioteca</h3><div class="mu-stats">
    <div><b>${todas.length}</b><small>Músicas</small></div>
    <div><b>${todas.filter(f => f.fav).length}</b><small>Favoritas</small></div>
    <div><b>${todas.filter(f => !f.tocadas).length}</b><small>Nunca tocadas</small></div>
    <div><b>${comNota ? String((soma / comNota / 2).toFixed(1)).replace(".", ",") : "–"}</b><small>Média de estrelas</small></div></div>`);
  tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Estrelas (${semNota} sem nota)</h3>`);
  tela.append(barras(notas, { rotulos: notas.map((_, i) => (i % 2 ? `${(i + 1) / 2}★` : "")), titulo: "Músicas por estrelas" }));
  await estatisticasBiblioteca(tela, todas);
  const d = await B.generosDaBiblioteca();
  if (d.grupos.some(g => g.faixas.length)) {
    tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Por gênero (pelo som)</h3>`);
    const l = d.grupos.filter(g => g.faixas.length).sort((a, b) => b.faixas.length - a.faixas.length), max = l[0].faixas.length;
    tela.insertAdjacentHTML("beforeend", `<div class="mu-ranking">${l.map(g => `<div><span>${escapar(g.nome)}</span><i style="width:${Math.round(100 * g.faixas.length / max)}%"></i><b>${g.faixas.length}</b></div>`).join("")}</div>`);
    const cl = d.climas.filter(c => c.faixas.length).sort((a, b) => b.faixas.length - a.faixas.length);
    if (cl.length) tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Por clima</h3><div class="mu-ranking">${cl.map(c => `<div><span>${ICONE_CLIMA[c.nome] || ""} ${escapar(c.nome)}</span><i style="width:${Math.round(100 * c.faixas.length / cl[0].faixas.length)}%"></i><b>${c.faixas.length}</b></div>`).join("")}</div>`);
  }
}

// ---------- estatísticas da biblioteca (pedido do Alediov, 25/10/2026): lançamentos por ano (tag Ano), avaliação
// média só das originais (sem tag de versão: Live, Acoustic, Instrumental, Sped Up…), favoritas e o ranking dos
// artistas em cada uma. A pasta das versões (Alediov) fica fora dos rankings. ----------
let rankAtual = "musicas", anoArtista = "";
const original = (f) => !analisarTitulo(f.titulo).versoes.length;
const media = (l) => { const c = l.filter(f => f.nota); return c.length ? c.reduce((s, f) => s + f.nota, 0) / c.length : 0; };
const estrelasTx = (n) => String((n / 2).toFixed(2)).replace(".", ",") + "★";
async function estatisticasBiblioteca(tela, todas) {
  const pv = normTag(await B.pastaVersoes());
  const originais = todas.filter(original), mediaOrig = media(originais);
  tela.insertAdjacentHTML("beforeend", `<div class="mu-stats">
    <div><b>${mediaOrig ? estrelasTx(mediaOrig) : "–"}</b><small>Média das originais (${originais.filter(f => f.nota).length} com nota)</small></div>
    <div><b>${todas.length ? Math.round(100 * todas.filter(f => f.fav).length / todas.length) : 0}%</b><small>São favoritas</small></div></div>`);
  // lançamentos por ano
  const sec = document.createElement("section"); sec.className = "mu-anos"; tela.append(sec);
  const artistasComAno = [...new Set(todas.filter(f => /^\d{4}$/.test(f.ano || "")).map(f => f.artista))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const pintarAnos = () => {
    const l = todas.filter(f => !anoArtista || f.artista === anoArtista), comAno = l.filter(f => /^\d{4}$/.test(f.ano || "") && +f.ano > 1900);
    sec.innerHTML = `<h3 class="mu-secao">Lançamentos por ano</h3>`;
    const sel = document.createElement("select"); sel.className = "mu-anos-sel"; sel.setAttribute("aria-label", "Artista");
    sel.innerHTML = `<option value="">Todos os artistas</option>${artistasComAno.map(a => `<option ${a === anoArtista ? "selected" : ""}>${escapar(a)}</option>`).join("")}`;
    sel.onchange = () => { anoArtista = sel.value; pintarAnos(); };
    sec.append(sel);
    if (!comAno.length) { sec.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nenhuma música com o ano preenchido${anoArtista ? " neste artista" : ""}.</p>`); return; }
    const anos = comAno.map(f => +f.ano), ini = Math.min(...anos), fim = Math.max(...anos, new Date().getFullYear());
    const passo = fim - ini > 44 ? 5 : fim - ini > 22 ? 2 : 1, base = ini - (ini % passo);
    const dados = [], rot = [];
    for (let y = base; y <= fim; y += passo) { dados.push(anos.filter(a => a >= y && a < y + passo).length); const k = (y - base) / passo; rot.push(k % 5 === 0 ? String(y) : ""); }
    const pico = dados.indexOf(Math.max(...dados));
    sec.append(barras(dados, { rotulos: rot, destaque: pico, titulo: "Músicas por ano de lançamento" }));
    const semAno = l.length - comAno.length, anoPico = base + pico * passo;
    sec.insertAdjacentHTML("beforeend", `<p class="mu-dica mu-dica-curta">${passo > 1 ? `Cada barra junta ${passo} anos. ` : ""}Mais músicas em <b>${passo > 1 ? `${anoPico}–${anoPico + passo - 1}` : anoPico}</b> (${dados[pico]}). Ano médio: ${Math.round(anos.reduce((s, a) => s + a, 0) / anos.length)}.${semAno ? ` ${semAno} sem o ano preenchido.` : ""}</p>`);
  };
  pintarAnos();
  // ranking dos artistas
  const porArt = new Map();
  for (const f of todas) { if (normTag(f.artista) === pv) continue; if (!porArt.has(f.artista)) porArt.set(f.artista, []); porArt.get(f.artista).push(f); }
  const ano = new Date().getFullYear();
  const RANKS = {
    musicas: { nome: "Mais músicas", valor: (l) => l.length, tx: (v) => `${v}` },
    recentes: { nome: `Lançadas desde ${ano - 2}`, valor: (l) => l.filter(f => +f.ano >= ano - 2).length, tx: (v) => `${v}` },
    avaliacao: { nome: "Melhor avaliação", valor: (l) => { const c = l.filter(f => original(f) && f.nota); if (c.length < 3) return 0; const C = 3; return (C * mediaOrig + c.reduce((s, f) => s + f.nota, 0)) / (C + c.length); }, tx: (v, l) => { const c = l.filter(f => original(f) && f.nota); return `${estrelasTx(media(c))} · ${c.length}`; } },
    favoritas: { nome: "Mais favoritas", valor: (l) => l.filter(f => f.fav).length, tx: (v, l) => `${v} · ${Math.round(100 * v / l.length)}%` },
  };
  const rs = document.createElement("section"); rs.className = "mu-rank"; tela.append(rs);
  const pintarRank = () => {
    const R = RANKS[rankAtual];
    rs.innerHTML = `<h3 class="mu-secao">Melhores artistas</h3>`;
    const ch = document.createElement("div"); ch.className = "mu-chips mu-rank-chips";
    for (const [k, r] of Object.entries(RANKS)) { const b = document.createElement("button"); b.textContent = r.nome; b.className = k === rankAtual ? "on" : ""; b.onclick = () => { rankAtual = k; pintarRank(); }; ch.append(b); }
    rs.append(ch);
    if (R.dica) rs.insertAdjacentHTML("beforeend", `<p class="mu-dica mu-dica-curta">${R.dica}</p>`);
    const l = [...porArt].map(([nome, fs]) => ({ nome, fs, v: R.valor(fs) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v || b.fs.length - a.fs.length || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 10);
    if (!l.length) { rs.insertAdjacentHTML("beforeend", `<p class="mu-dica">Ainda não dá para montar este ranking.</p>`); return; }
    const max = l[0].v, min = rankAtual === "avaliacao" ? Math.min(...l.map(x => x.v)) * 0.9 : 0;
    const box = document.createElement("div"); box.className = "mu-ranking mu-rank-lista";
    l.forEach((x, i) => {
      const el = document.createElement("button");
      el.innerHTML = `<em>${i + 1}</em><span></span><i style="width:${Math.max(4, Math.round(100 * (x.v - min) / (max - min || 1)))}%"></i><b>${escapar(R.tx(x.v, x.fs))}</b>`;
      el.querySelector("span").textContent = x.nome;
      el.onclick = () => { aba = "artistas"; sub = { tipo: "artista", id: x.nome }; desenhar(); };
      box.append(el);
    });
    rs.append(box);
  };
  pintarRank();
}

// ---------- editor (cópia com velocidade e reverberador) ----------
const decodificadas = new Map(); // id → AudioBuffer (a última aberta)
async function carregarAudio(f, aoProgresso) {
  if (decodificadas.has(f.id)) return decodificadas.get(f.id);
  const bytes = await motor.lerArquivo(f.id, (k) => aoProgresso?.(k * 0.7));
  aoProgresso?.(0.8);
  const buf = await ED.decodificar(bytes);
  decodificadas.clear(); decodificadas.set(f.id, buf);
  aoProgresso?.(1);
  return buf;
}

function controle(rot, min, max, passo, valor, fmt, aoMudar) {
  const l = document.createElement("label"); l.className = "mu-ctrl";
  l.innerHTML = `<span>${rot}</span><b></b><input type="range" min="${min}" max="${max}" step="${passo}" value="${valor}" aria-label="${rot}">`;
  const b = l.querySelector("b"), i = l.querySelector("input");
  const pintar = () => { b.textContent = fmt(+i.value); i.style.setProperty("--p", `${100 * (i.value - min) / (max - min)}%`); };
  i.oninput = () => { pintar(); aoMudar(+i.value); };
  pintar();
  l.definir = (v) => { i.value = v; pintar(); };
  return l;
}

async function abrirEditor(f, preset) {
  const p = { ...preset };
  const pv = await B.pastaVersoes();
  const box = document.createElement("div"); box.className = "mu-editor";
  box.innerHTML = `<h3 class="mu-folha-tit">Editar “${escapar(f.titulo)}”</h3>
    <label class="campo">Nome da cópia<input type="text" class="mu-ed-nome" data-teclado="texto" aria-label="Nome da cópia"></label>
    <label class="campo">Salvar em<select class="mu-ed-pasta"><option value="${escapar(pv)}">${escapar(pv)} (as suas versões)</option>${f.pasta && f.pasta !== pv ? `<option value="${escapar(f.pasta)}">${escapar(f.pasta)} (junto da original)</option>` : ""}</select></label>
    <div class="mu-ed-presets"><button class="mu-pilula" data-p="sped">${I.varinha}<span>Sped Up</span></button><button class="mu-pilula" data-p="zero"><span>Sem efeitos</span></button></div>
    <div class="mu-ed-ctrls"></div>
    <p class="mu-ed-status mu-dica">Carregando a música…</p>
    <div class="mu-ed-acoes"><button class="botao secundario" data-a="previa" disabled>${I.play}<span>Ouvir prévia</span></button><button class="botao" data-a="salvar" disabled>Salvar a cópia</button></div>`;
  const nome = box.querySelector(".mu-ed-nome");
  // o nome já vem desambiguado: "Lua (Anny, Sped Up)" se outro artista também tem "Lua"
  const nomes = {}; for (const t of ["Sped Up", "Slowed", "Editada"]) nomes[t] = (await B.nomeVersao(f, t)).nome;
  const tipoVersao = () => (p.velocidade > 1.001 ? "Sped Up" : p.velocidade < 0.999 ? "Slowed" : "Editada");
  let nomeMexido = false;
  const nomeAuto = () => { if (!nomeMexido) nome.value = nomes[tipoVersao()]; };
  nome.oninput = () => { nomeMexido = true; };
  nomeAuto();
  const ctrls = box.querySelector(".mu-ed-ctrls");
  const previa = new ED.Previa();
  const mudou = () => { nomeAuto(); if (previa.tocando && previa.ajustar(p)) tocarPrevia(); };
  const pct = (v) => `${Math.round(v)}%`;
  const cVel = controle("Velocidade", 50, 200, 1, p.velocidade * 100, pct, v => { p.velocidade = v / 100; mudou(); });
  const rv = document.createElement("label"); rv.className = "linha-cfg mu-ed-reverb";
  rv.innerHTML = `<span>Reverberador</span>`;
  const chave = document.createElement("button"); chave.className = `chave ${p.reverb ? "on" : ""}`; chave.setAttribute("aria-label", "Reverberador");
  rv.append(chave);
  const grupo = document.createElement("div"); grupo.className = "mu-ed-grupo";
  const cs = {
    molhado: controle("Molhado", 0, 100, 1, p.molhado * 100, pct, v => { p.molhado = v / 100; mudou(); }),
    largura: controle("Amplitude estereofônica", 0, 100, 1, p.largura * 100, pct, v => { p.largura = v / 100; mudou(); }),
    amortecimento: controle("Redução de alta freq.", 0, 100, 1, p.amortecimento * 100, pct, v => { p.amortecimento = v / 100; mudou(); }),
    sala: controle("Tamanho do cômodo", 0, 100, 1, p.sala * 100, pct, v => { p.sala = v / 100; mudou(); }),
    preDelay: controle("Pré-delay", 0, 200, 1, p.preDelay, v => `${v} ms`, v => { p.preDelay = v; mudou(); }),
    corteGraves: controle("Corte baixa freq.", 20, 1000, 5, p.corteGraves, v => `${v} Hz`, v => { p.corteGraves = v; mudou(); }),
  };
  Object.values(cs).forEach(c => grupo.append(c));
  const pintarReverb = () => { chave.classList.toggle("on", p.reverb); grupo.hidden = !p.reverb; };
  chave.onclick = (e) => { e.preventDefault(); p.reverb = !p.reverb; pintarReverb(); mudou(); };
  pintarReverb();
  ctrls.append(cVel, rv, grupo);
  const aplicar = (q) => { Object.assign(p, q); cVel.definir(p.velocidade * 100); cs.molhado.definir(p.molhado * 100); cs.largura.definir(p.largura * 100); cs.amortecimento.definir(p.amortecimento * 100); cs.sala.definir(p.sala * 100); cs.preDelay.definir(p.preDelay); cs.corteGraves.definir(p.corteGraves); pintarReverb(); if (previa.tocando) tocarPrevia(); nomeAuto(); };
  box.querySelector('[data-p="sped"]').onclick = () => aplicar(ED.SPED_UP);
  box.querySelector('[data-p="zero"]').onclick = () => aplicar(ED.SEM_EFEITO);
  const { fechar } = folha(box, { classe: "alta" });
  tecl?.configurar({ sistema: true }); tecl?.preparar(box);
  const fundo = box.closest(".mu-folha-fundo");
  const fecharTudo = () => { previa.parar(); fechar(); };
  fundo.onclick = (e) => { if (e.target === fundo) fecharTudo(); };
  const status = box.querySelector(".mu-ed-status"), bPrev = box.querySelector('[data-a="previa"]'), bSalvar = box.querySelector('[data-a="salvar"]');
  let buf = null;
  const tocarPrevia = () => {
    if (!buf) return;
    if (estado.querTocar) cmd("pausar");
    previa.tocar(buf, p, Math.min(buf.duration * 0.3, 60));
    bPrev.innerHTML = `${I.pausa}<span>Parar a prévia</span>`;
    previa.aoAcabar = () => { bPrev.innerHTML = `${I.play}<span>Ouvir prévia</span>`; };
  };
  bPrev.onclick = () => { if (previa.tocando) { previa.parar(); bPrev.innerHTML = `${I.play}<span>Ouvir prévia</span>`; } else tocarPrevia(); };
  bSalvar.onclick = () => { previa.parar(); fechar(); salvarVersao(f, { ...p }, nome.value.trim() || nomes[tipoVersao()], box.querySelector(".mu-ed-pasta").value, buf); };
  try {
    buf = await carregarAudio(f, (k) => { status.textContent = `Carregando a música… ${Math.round(k * 100)}%`; });
    status.textContent = `Pronta: ${tempo(buf.duration * 1000)}. A prévia toca um trecho do meio; os controles mudam o som na hora.`;
    bPrev.disabled = false; bSalvar.disabled = false;
  } catch (e) {
    status.textContent = `Não consegui abrir esta música: ${e.message}`;
  }
}

// processamento com uma faixa de andamento no alto (dá para continuar usando o app)
let processando = Promise.resolve();
function andamento(texto) {
  let el = $(".mu-proc");
  if (!el) { el = document.createElement("div"); el.className = "mu-proc"; el.innerHTML = `<span></span><i><b></b></i>`; raiz.append(el); }
  const set = (t, k) => { el.querySelector("span").textContent = t; el.querySelector("b").style.width = `${Math.round((k || 0) * 100)}%`; };
  set(texto, 0);
  return { set, fim: () => el.remove() };
}
function salvarVersao(f, p, nome, pasta, buf = null) {
  processando = processando.then(() => fazerVersao(f, p, nome, pasta, buf)).catch(() => {});
  return processando;
}
async function fazerVersao(f, p, nome, pasta, buf, pre = "") {
  const a = andamento(`${pre}${nome}: carregando…`);
  try {
    buf ||= await carregarAudio(f, (k) => a.set(`${pre}${nome}: carregando…`, k * 0.15));
    const r = await ED.renderizar(buf, p, (k) => a.set(`${pre}${nome}: aplicando os efeitos…`, 0.15 + k * 0.25));
    const mp3 = await ED.codificarMp3(r, 320, (k) => a.set(`${pre}${nome}: gerando o MP3…`, 0.4 + k * 0.5));
    let capaBytes = null;
    try {
      const d = await motor.capa(f.id, 0); // a capa original, sem recomprimir
      if (d) { const s = atob(d.split(",")[1]); capaBytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) capaBytes[i] = s.charCodeAt(i); }
    } catch { /* sem capa */ }
    const versoes = pasta === (await B.pastaVersoes());
    const artista = versoes ? pasta : f.artista;
    const efeitos = [p.velocidade !== 1 ? `velocidade ${Math.round(p.velocidade * 100)}%` : "", p.reverb ? `reverberador (molhado ${Math.round(p.molhado * 100)}%, cômodo ${Math.round(p.sala * 100)}%)` : ""].filter(Boolean).join(", ");
    const tag = ED.tagId3({ titulo: nome, artista, album: versoes ? artista : f.album, albumArtista: versoes ? artista : f.albumArtista, genero: f.genero, ano: f.ano, comentario: `Versão de "${f.titulo}" (${f.artista}) ${B.MARCA_EDITOR_2}: ${efeitos || "sem efeitos"}.` }, capaBytes);
    const bytes = new Uint8Array(tag.length + mp3.length); bytes.set(tag); bytes.set(mp3, tag.length);
    const pastaMusicas = await B.pasta();
    const arquivo = `${nome.replace(/[\\/:*?"<>|]/g, "-")}.mp3`;
    await motor.criarArquivo(pastaMusicas.uri, pasta, arquivo, "audio/mpeg", bytes, (k) => a.set(`${pre}${nome}: salvando…`, 0.9 + k * 0.1));
    a.fim();
    toast(`Pronto: "${nome}" em ${pasta}.`, 3500);
    await sincronizar(true);
    await B.ligarVersao(`${pasta}/${arquivo}`, f.id);
  } catch (e) {
    a.fim();
    toast(`Não consegui criar "${nome}": ${e.message}`, 5000);
    throw e;
  }
}
async function criarEmLote(lista) {
  const pasta = await B.pastaVersoes();
  const v = await modal({ titulo: `Criar ${lista.length} ${lista.length === 1 ? "versão" : "versões"} Sped Up?`, texto: `${lista.slice(0, 6).map(f => f.titulo).join(", ")}${lista.length > 6 ? "…" : ""}`, botoes: [{ texto: "Criar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
  if (!v) return;
  let k = 0;
  for (const f of lista) {
    const nome = (await B.nomeVersao(f)).nome;
    processando = processando.then(async () => {
      k++;
      if ((await B.versaoSpedUp(f)) !== null) return; // já foi criada (outro toque, outra tela)
      await fazerVersao(f, ED.SPED_UP, nome, pasta, null, `${k} de ${lista.length} · `);
    }).catch(() => {});
  }
  processando.then(() => { if (raiz?.isConnected && sub?.tipo === "spedup") desenhar(true); });
}

// ---------- Sped Up das 5 estrelas (pedido do Alediov, 02/11/2026) ----------
// As originais com 5 estrelas: as que já têm a versão Sped Up na pasta das versões e as que faltam, com "Criar as N".
/** Backup das músicas no Google Drive (drive.js; Ajustes → Backup no Drive). */
async function telaDriveMusicas(tela) {
  cabecalho(tela, { titulo: "Backup no Drive", voltar: () => { sub = null; desenhar(); }, acoes: false });
  const D = await import("./drive.js");
  await D.telaDrive(tela, { redesenhar: () => { if (raiz?.isConnected && sub?.tipo === "drive") desenhar(true); } });
}
async function telaSpedUp(tela) {
  const { tem, faltam, semDono } = await B.spedUpDasCinco();
  cabecalho(tela, { titulo: "Sped Up das 5 estrelas", sub: `${tem.length} com · ${faltam.length} sem${semDono.length ? ` · ${semDono.length} sem dono` : ""}`, voltar: () => { sub = null; aba = "editar"; desenhar(); }, acoes: false });
  if (faltam.length) {
    const b = document.createElement("button"); b.className = "botao mu-su-criar";
    b.innerHTML = `${I.varinha}<span>Criar ${faltam.length === 1 ? "a que falta" : `as ${faltam.length} que faltam`}</span>`;
    b.onclick = () => criarEmLote(faltam);
    tela.append(b);
  }
  if (semDono.length) {
    const { el, corpo } = sanfona({ id: "su.semdono", titulo: "De quem é?", icone: I.trocar, conta: semDono.length, alerta: true, aberta: true });
    for (const { v } of semDono) corpo.append(opcao(v.titulo, async () => { await perguntarDono(v); desenhar(true); }));
    tela.append(el);
  }
  const s1 = sanfona({ id: "su.faltam", titulo: "Sem Sped Up", icone: I.relogio, conta: faltam.length, alerta: faltam.length > 0, aberta: true });
  if (faltam.length) lista(s1.corpo, faltam, { semFalta: true }); else s1.corpo.insertAdjacentHTML("beforeend", `<p class="mu-nada">Nenhuma. 🎉</p>`);
  tela.append(s1.el);
  const s2 = sanfona({ id: "su.tem", titulo: "Com Sped Up", icone: I.certo, conta: tem.length });
  if (tem.length) lista(s2.corpo, tem.map(x => x.f), { semFalta: true });
  tela.append(s2.el);
}

// ---------- aba Edição: pasta de entrada (escolhida no cartão SD), editor de tags e padrão dos títulos ----------
let entradaAtual = [];
async function atualizarBadge(forcar = false) {
  try {
    entradaAtual = await B.listarEntrada(forcar);
    const b = $(".mu-abas .mu-badge"); if (!b) return;
    b.hidden = !entradaAtual.length; b.textContent = entradaAtual.length;
  } catch { /* sem pasta */ }
}

async function escolherEntrada() {
  try { const e = await B.escolherPastaEntrada(); toast(`Pasta de entrada: ${e.nome}`); await atualizarBadge(true); desenhar(); }
  catch (e) { if (e.message !== "cancelado") toast(e.message, 4500); }
}
async function telaEditar(tela) {
  const esc = await B.pastaEntradaEscolhida(), pe = await B.pastaEntrada();
  tela.insertAdjacentHTML("beforeend", esc
    ? `<div class="mu-ed-topo"><div><small>Pasta de entrada</small><b>${escapar(esc.nome)}</b></div><div class="mu-ed-bts"></div></div>`
    : `<div class="mu-ed-topo"><div><b>Escolha a pasta de entrada</b></div><div class="mu-ed-bts"></div></div>`);
  const bts = tela.querySelector(".mu-ed-bts");
  if (esc) {
    const atualizar = document.createElement("button"); atualizar.className = "botao secundario mini"; atualizar.textContent = "Ler de novo";
    atualizar.onclick = async () => { try { await atualizarBadge(true); } catch { /* aviso abaixo */ } desenhar(true); };
    bts.append(atualizar);
  }
  const trocar = document.createElement("button"); trocar.className = `botao ${esc ? "secundario" : ""} mini`; trocar.textContent = esc ? "Trocar" : "Escolher";
  trocar.onclick = escolherEntrada; bts.append(trocar);
  // cuidados com a biblioteca, em menus sanfona fechados (a contagem em cor de aviso mostra que há o que fazer); a lista
  // da pasta de entrada, que é o trabalho do dia a dia, fica aberta embaixo
  const fora = await B.titulosForaDoPadrao();
  if (fora.length) {
    const { el, corpo } = sanfona({ id: "ed.padrao", titulo: "Títulos fora do padrão", icone: I.varinha, conta: fora.length, alerta: true });
    const pv = document.createElement("div"); pv.className = "mu-sf-previa";
    for (const x of fora.slice(0, 3)) { const l = document.createElement("div"); l.innerHTML = `<s></s><b></b>`; l.querySelector("s").textContent = x.faixa.titulo; l.querySelector("b").textContent = x.novo; pv.append(l); }
    const b = document.createElement("button"); b.className = "botao mini"; b.textContent = fora.length === 1 ? "Revisar o título" : `Revisar os ${fora.length} títulos`;
    b.onclick = () => { sub = { tipo: "padrao" }; desenhar(); };
    corpo.append(pv, b); tela.append(el);
  }
  // Sped Up das 5 estrelas (02/11/2026): as que têm e as que faltam na pasta das versões
  {
    const su = await B.spedUpDasCinco(), n = su.faltam.length + su.semDono.length;
    const { el, corpo } = sanfona({ id: "ed.spedup", titulo: "Sped Up das 5 estrelas", icone: I.onda, resumo: `${su.tem.length} com · ${su.faltam.length} sem`, conta: n || su.tem.length, alerta: n > 0 });
    const bx = document.createElement("div"); bx.className = "mu-anos-bts";
    if (su.faltam.length) { const c = document.createElement("button"); c.className = "botao mini"; c.innerHTML = `${I.varinha}<span>Criar ${su.faltam.length === 1 ? "a que falta" : `as ${su.faltam.length} que faltam`}</span>`; c.onclick = () => criarEmLote(su.faltam); bx.append(c); }
    const vr = document.createElement("button"); vr.className = "botao secundario mini"; vr.textContent = "Ver a lista"; vr.onclick = () => { sub = { tipo: "spedup" }; desenhar(); };
    bx.append(vr); corpo.append(bx); tela.append(el);
  }
  // nome do arquivo × título (09/11/2026; antes só os "(1)", bug de 02/11/2026): os que dá para arrumar e os com conflito
  const nomesArq = await B.nomesDosArquivos();
  if (nomesArq.length) {
    const livres = nomesArq.filter(x => !x.conflito), conf = nomesArq.length - livres.length;
    const { el, corpo } = sanfona({ id: "ed.nomes", titulo: "Nomes dos arquivos", icone: I.etiqueta, resumo: conf ? `${conf} com conflito` : "", conta: nomesArq.length, alerta: true });
    const pv = document.createElement("div"); pv.className = "mu-sf-previa";
    for (const x of livres.slice(0, 3)) { const l = document.createElement("div"); l.innerHTML = `<s></s><b></b>`; l.querySelector("s").textContent = x.f.caminho.split("/").pop(); l.querySelector("b").textContent = x.nome; pv.append(l); }
    const bx = document.createElement("div"); bx.className = "mu-anos-bts";
    if (livres.length) { const b = document.createElement("button"); b.className = "botao mini mu-nomes-arrumar"; b.textContent = livres.length === 1 ? "Arrumar o nome" : `Arrumar os ${livres.length} nomes`; b.onclick = () => arrumarNumeros(livres); bx.append(b); }
    const vr = document.createElement("button"); vr.className = "botao secundario mini mu-nomes-ver"; vr.textContent = "Ver a lista"; vr.onclick = () => { sub = { tipo: "nomes" }; desenhar(); };
    bx.append(vr); corpo.append(pv, bx); tela.append(el);
  }
  // tags principais faltando na biblioteca (o ano, sobretudo) e os anos das versões
  const falt = await B.tagsFaltando(), nf = Object.entries(falt).filter(([, l]) => l.length);
  const anosArrumar = await B.anosPelasOriginais();
  if (nf.length || anosArrumar.length) {
    const nSem = new Set(nf.flatMap(([, l]) => l.map(f => f.id))).size;
    const { el, corpo } = sanfona({ id: "ed.faltando", titulo: nf.length ? "Tags faltando" : "Anos das versões", icone: I.etiqueta, resumo: nf.length ? nf.map(([k, l]) => `${l.length} sem ${B.CAMPOS_PRINCIPAIS[k].toLowerCase()}`).join(" · ") : `${anosArrumar.length} fora do ano da original`, conta: nf.length ? nSem : anosArrumar.length, alerta: true });
    if (nf.length) {
      const ch = document.createElement("div"); ch.className = "mu-chips mu-falt-chips";
      for (const [k, l] of nf) { const b = document.createElement("button"); b.innerHTML = `${B.CAMPOS_PRINCIPAIS[k]} <small>${l.length}</small>`; b.onclick = () => { sub = { tipo: "faltando", campo: k }; desenhar(); }; ch.append(b); }
      corpo.append(ch);
    }
    corpo.append(await botoesAnos(anosArrumar, falt.ano));
    tela.append(el);
  }
  const sd = await B.versoesSemDono(), rep = await B.titulosRepetidos(), dup = await B.duplicatas(), ftL = await B.feats();
  const nNenhuma = await B.quantasNaoDuplicatas();
  if (sd.length || rep.length || dup.length || ftL.length || nNenhuma) {
    const nAlerta = sd.length + rep.length + dup.length;
    const { el, corpo } = sanfona({ id: "ed.desamb", titulo: "Desambiguar", icone: I.trocar, conta: nAlerta || ftL.length, alerta: nAlerta > 0 });
    for (const [n, um, varios] of [[dup.length, "possível duplicata", "possíveis duplicatas"], [sd.length, "versão sem o artista original", "versões sem o artista original"], [rep.length, "título repetido no mesmo artista", "títulos repetidos no mesmo artista"], [ftL.length, "música em feat.", "músicas em feat."]]) {
      if (!n) continue;
      corpo.append(opcao(`${n} ${n === 1 ? um : varios}`, () => { sub = { tipo: "desambiguar" }; desenhar(); }));
    }
    corpo.append(botaoReavaliarDuplicatas(nNenhuma));
    tela.append(el);
  }
  let itens = [];
  try { itens = await B.listarEntrada(); entradaAtual = itens; } catch (e) { tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">${escapar(e.message)}</p>`); }
  const b = $(".mu-abas .mu-badge"); if (b) { b.hidden = !itens.length; b.textContent = itens.length; }
  if (!itens.length) {
    tela.insertAdjacentHTML("beforeend", esc
      ? `<div class="mu-vazio">${I.varinha}<h2>Nada para editar</h2></div>`
      : `<div class="mu-vazio">${I.varinha}<h2>Nada para editar</h2></div>`);
    if (!esc) { const bc = document.createElement("button"); bc.className = "botao"; bc.textContent = "Escolher a pasta de entrada"; bc.onclick = escolherEntrada; tela.querySelector(".mu-vazio").append(bc); }
    return;
  }
  // a pasta de entrada: aberta (é a pendência do dia a dia)
  const dups = await B.duplicadasNaEntrada(itens);
  const sec = sanfona({ id: "ed.entrada", titulo: "Para editar", icone: I.pasta, resumo: `Na pasta ${esc?.nome || pe}${dups.size ? ` · ${dups.size} ${dups.size === 1 ? "parece duplicata" : "parecem duplicatas"}` : ""}`, conta: itens.length, alerta: true, aberta: true });
  tela.append(sec.el);
  const alvo = sec.corpo;
  // duplicatas: já na biblioteca, ou duas vezes na pasta de entrada
  const textoDup = (d) => d.biblioteca ? `Já está na biblioteca: ${d.biblioteca.artista} – ${d.biblioteca.titulo}` : `Repetida aqui: ${d.entrada.nome}`;
  if (dups.size) {
    const c = document.createElement("div"); c.className = "mu-aviso mu-dup-cartao";
    c.innerHTML = `<b>${dups.size === 1 ? "1 parece duplicata" : `${dups.size} parecem duplicatas`}</b>`;
    const b = document.createElement("button"); b.className = "botao mini perigo"; b.innerHTML = `${I.lixo}<span>Excluir ${dups.size === 1 ? "a duplicata" : `as ${dups.size}`}</span>`;
    b.onclick = async () => {
      const l = itens.filter(it => dups.has(it.id));
      const v = await modal({ titulo: `Excluir ${l.length === 1 ? "1 arquivo" : `${l.length} arquivos`}?`, html: `<p>Saem de vez da pasta de entrada (não vão para a lixeira):</p><ul class="mu-dup-lista">${l.slice(0, 12).map(it => `<li><b>${escapar(it.nome)}</b><small>${escapar(textoDup(dups.get(it.id)))}</small></li>`).join("")}${l.length > 12 ? `<li>…e mais ${l.length - 12}</li>` : ""}</ul>`, botoes: [{ texto: "Excluir", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
      if (!v) return;
      let n = 0; for (const it of l) { try { await B.apagarDaEntrada(it); n++; } catch (e) { toast(`Não consegui excluir ${it.nome}: ${e.message}`, 4000); } }
      toast(`${n === 1 ? "1 arquivo excluído" : `${n} arquivos excluídos`}.`); await atualizarBadge(); desenhar(true);
    };
    c.append(b); alvo.append(c);
  }
  const box = document.createElement("div"); box.className = "mu-lista";
  for (const it of itens) {
    const el = document.createElement("div"); el.className = `mu-faixa ${dups.has(it.id) ? "mu-dup" : ""}`;
    el.append(capa(it));
    const d = dups.get(it.id);
    el.insertAdjacentHTML("beforeend", `<div class="mu-faixa-tx"><b>${escapar(it.titulo || it.nome)}</b><small>${escapar(it.artista || "Sem artista")}${it.faltam.length ? ` · <span class="mu-falta">Falta: ${escapar(it.faltam.join(", "))}</span>` : " · Tudo preenchido"}</small>${d ? `<small class="mu-dup-tx">${escapar(textoDup(d))}</small>` : ""}</div>`);
    const lx = document.createElement("button"); lx.className = "mu-icone mu-lixo"; lx.innerHTML = I.lixo; lx.setAttribute("aria-label", "Excluir o arquivo");
    lx.onclick = (e) => { e.stopPropagation(); excluirDaEntrada(it, d); };
    const bt = document.createElement("button"); bt.className = "mu-icone"; bt.innerHTML = I.varinha; bt.setAttribute("aria-label", "Editar tags");
    el.append(lx, bt);
    el.onclick = () => abrirEditorTags(it);
    box.append(el);
  }
  alvo.append(box);
}
/** Os botões dos anos (no cartão "Tags faltando" e na tela das que estão sem ano): arrumar pelas originais e buscar na internet. */
async function botoesAnos(anosArrumar, semAno) {
  const box = document.createElement("div"); box.className = "mu-anos-bts";
  const a = document.createElement("button"); a.className = `botao ${anosArrumar.length ? "" : "secundario"} mini`;
  a.innerHTML = `${I.relogio}<span>Arrumar os anos pelas originais${anosArrumar.length ? ` (${anosArrumar.length})` : ""}</span>`;
  a.onclick = () => arrumarAnos();
  box.append(a);
  if (semAno?.length) {
    const pvN = normTag(await B.pastaVersoes());
    const l = semAno.filter(f => normTag(f.artista) !== pvN && normTag(f.pasta || "") !== pvN);
    if (l.length) {
      const b = document.createElement("button"); b.className = "botao secundario mini"; b.innerHTML = `${I.busca}<span>Buscar os anos na internet (${l.length})</span>`;
      b.onclick = () => buscarAnos(l);
      box.append(b);
    }
  }
  box.insertAdjacentHTML("beforeend", `<p class="mu-dica mu-dica-curta">${anosArrumar.length ? `${anosArrumar.length === 1 ? "1 versão" : `${anosArrumar.length} versões`} fora do ano da original` : "Anos das versões em dia"}</p>`);
  return box;
}
/** "Arrumar os anos pelas originais" (pedido do Alediov, 26/10/2026): mostra o que vai mudar, por família, para ele
 *  conferir (todas marcadas), e grava os marcados nos arquivos pela fila de gravação. */
async function arrumarAnos() {
  const lista = await B.anosPelasOriginais();
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Anos pelas originais</h3>`;
  const { fechar } = folha(box, { classe: "alta" });
  if (!lista.length) { box.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nada para arrumar: as versões já estão com o ano da original.</p>`); return; }
  const usar = new Set(lista.map((_, i) => i));
  const l = document.createElement("div"); l.className = "mu-busca-ano";
  lista.forEach((x, i) => {
    const el = document.createElement("label"); el.className = "mu-esc-item mu-ano-item";
    el.innerHTML = `<input type="checkbox" checked><span><b></b><small></small></span><em><s></s> ${x.para}</em>`;
    el.querySelector("b").textContent = `${x.f.artista} – ${x.f.titulo}`;
    el.querySelector("small").textContent = `${x.motivo === "da original" ? "Original" : x.motivo}: ${x.original.titulo}${x.original.artista !== x.f.artista ? ` (${x.original.artista})` : ""}`;
    el.querySelector("s").textContent = x.de || "sem ano";
    el.querySelector("input").onchange = (e) => { if (e.target.checked) usar.add(i); else usar.delete(i); pintar(); };
    l.append(el);
  });
  box.append(l);
  const ok = document.createElement("button"); ok.className = "botao";
  const pintar = () => { ok.textContent = usar.size === 1 ? "Gravar 1 ano" : `Gravar ${usar.size} anos`; ok.disabled = !usar.size; };
  ok.onclick = async () => {
    ok.disabled = true;
    const n = await B.aplicarAnos([...usar].map(i => lista[i]));
    fechar();
    toast(n ? `${n === 1 ? "1 ano mudou" : `${n} anos mudaram`}: ${n === 1 ? "vai" : "vão"} para os arquivos aos poucos (a que está tocando grava quando trocar).` : "Nada mudou.", 4500);
    desenhar(true);
  };
  pintar(); box.append(ok);
}
// ---------- tags principais faltando na biblioteca (pedido do Alediov, 25/10/2026) ----------
async function telaFaltando(tela, campo) {
  const falt = await B.tagsFaltando(), l = falt[campo] || [];
  cabecalho(tela, { titulo: "Tags faltando", voltar: () => { sub = null; aba = "editar"; desenhar(); }, acoes: false });
  const ch = document.createElement("div"); ch.className = "mu-chips mu-falt-chips";
  for (const [k, nome] of Object.entries(B.CAMPOS_PRINCIPAIS)) {
    const b = document.createElement("button"); b.className = k === campo ? "on" : ""; b.innerHTML = `${nome} <small>${falt[k].length}</small>`;
    b.onclick = () => { sub = { tipo: "faltando", campo: k }; desenhar(true); };
    ch.append(b);
  }
  tela.append(ch);
  if (campo === "ano") {
    tela.append(await botoesAnos(await B.anosPelasOriginais(), l));
  }
  if (!l.length) { tela.insertAdjacentHTML("beforeend", `<p class="mu-nada">Todas têm ${B.CAMPOS_PRINCIPAIS[campo].toLowerCase()}. 🎉</p>`); return; }
  const box = document.createElement("div"); box.className = "mu-lista";
  for (const f of l.slice(0, 400)) {
    const el = document.createElement("div"); el.className = "mu-faixa";
    el.append(capa(f));
    el.insertAdjacentHTML("beforeend", `<div class="mu-faixa-tx"><b>${escapar(f.titulo)}</b><small>${escapar(f.artista)}${f.ano ? ` · ${escapar(f.ano)}` : ""}${f.genero ? ` · ${escapar(f.genero)}` : ""}</small></div>`);
    const bt = document.createElement("button"); bt.className = "mu-icone"; bt.innerHTML = I.varinha; bt.setAttribute("aria-label", "Editar tags");
    el.append(bt);
    el.onclick = () => { if (estado.id === f.id) { toast("Está tocando: edite quando trocar de música."); return; } abrirEditorTags(f); };
    box.append(el);
  }
  tela.append(box);
  if (l.length > 400) tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">…e mais ${l.length - 400}.</p>`);
}
/** Procura o ano de cada música no iTunes e no Deezer (o mais antigo entre os que batem título e artista) e mostra
 *  para ele conferir antes de gravar. */
async function buscarAnos(lista) {
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Anos pela internet</h3><p class="mu-dica mu-busca-ano-tx">Procurando…</p><div class="mu-busca-ano"></div>`;
  const { fechar } = folha(box, { classe: "alta" });
  const tx = box.querySelector(".mu-busca-ano-tx"), l = box.querySelector(".mu-busca-ano");
  const achados = [];
  let parar = false;
  const bp = document.createElement("button"); bp.className = "botao secundario mini"; bp.textContent = "Parar"; bp.onclick = () => { parar = true; };
  box.append(bp);
  for (let i = 0; i < lista.length && !parar && box.isConnected; i++) {
    const f = lista[i];
    tx.textContent = `Procurando ${i + 1} de ${lista.length}: ${f.artista} – ${f.titulo}`;
    try {
      // versões de verdade (Live, Remake, Acoustic…) só valem com a versão no título achado; as feitas por ele não entram
      // também pela forma romanizada (ルフィ ↔ Luffy) e, nos títulos em kanji, pelo artista e pela duração (notaCandidato)
      const a = analisarTitulo(f.titulo), base = a.base, vs = a.versoes.filter(v => !["Sped Up", "Slowed", "Editada"].includes(v));
      const cs = await buscarTags({ titulo: [base, ...vs].join(" "), artista: f.artista, duracao: f.duracao });
      const bons = cs.filter(c => c.ano && notaCandidato(c, { titulo: base, artista: f.artista, duracao: f.duracao, versoes: vs }).total >= 0.6);
      if (bons.length) {
        const ano = String(Math.min(...bons.map(c => +c.ano)));
        achados.push({ f, ano, de: bons.find(c => c.ano === ano) });
        const el = document.createElement("label"); el.className = "mu-esc-item mu-ano-item";
        el.innerHTML = `<input type="checkbox" checked><span><b></b><small></small></span><em>${ano}</em>`;
        el.querySelector("b").textContent = `${f.artista} – ${f.titulo}`;
        const de = bons.find(c => c.ano === ano);
        el.querySelector("small").textContent = `${de.fonte}: ${de.titulo}${de.album ? ` (${de.album})` : ""}`;
        el.querySelector("input").onchange = (e) => { achados.find(x => x.f === f).usar = e.target.checked; };
        achados[achados.length - 1].usar = true;
        l.append(el);
      }
    } catch (e) { tx.textContent = `Sem internet ou a busca falhou (${e.message}).`; break; }
    await new Promise(ok => setTimeout(ok, 350));
  }
  bp.remove();
  if (!box.isConnected) return;
  tx.textContent = achados.length ? `Achei o ano de ${achados.length} de ${lista.length}. Desmarque os que estiverem errados (vale o lançamento mais antigo achado).` : "Não achei nenhum ano.";
  if (!achados.length) return;
  const ok = document.createElement("button"); ok.className = "botao"; ok.textContent = "Gravar os anos marcados";
  ok.onclick = async () => {
    const usar = achados.filter(x => x.usar);
    fechar();
    for (const x of usar) await B.definirAno(x.f.id, x.ano);
    toast(`${usar.length === 1 ? "1 ano vai" : `${usar.length} anos vão`} para os arquivos aos poucos (a que está tocando grava quando trocar).`, 4000);
    desenhar(true);
  };
  box.append(ok);
}

/** Tira o " (1)" do nome dos arquivos sem duplicata (o arquivo volta a "<Título>.mp3"). */
async function arrumarNumeros(lista) {
  const v = await modal({ titulo: lista.length === 1 ? "Arrumar 1 nome?" : `Arrumar ${lista.length} nomes?`, html: `<ul class="mu-dup-lista">${lista.slice(0, 12).map(x => `<li><b>${escapar(x.nome)}</b><small>${escapar(x.f.caminho)}</small></li>`).join("")}${lista.length > 12 ? `<li>…e mais ${lista.length - 12}</li>` : ""}</ul>`, botoes: [{ texto: "Arrumar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
  if (!v) return;
  const a = andamento("Arrumando os nomes…");
  const n = await B.tirarNumeros(lista, estado.id);
  a.fim();
  toast(`${n === 1 ? "1 nome arrumado" : `${n} nomes arrumados`}${n < lista.length ? ` (${lista.length - n} ficaram: tocando ou com erro)` : ""}.`, 4000);
  desenhar(true);
}

async function excluirDaEntrada(it, d = null) {
  const v = await modal({ titulo: "Excluir o arquivo?", html: `<p><b>${escapar(it.nome)}</b> sai de vez da pasta de entrada (não vai para a lixeira).</p>${d ? `<p class="mu-dica">${escapar(d.biblioteca ? `Já está na biblioteca: ${d.biblioteca.artista} – ${d.biblioteca.titulo}` : `Repetida aqui: ${d.entrada.nome}`)}</p>` : ""}`, botoes: [{ texto: "Excluir", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
  if (!v) return false;
  try { await B.apagarDaEntrada(it); toast("Excluído."); await atualizarBadge(); desenhar(true); return true; }
  catch (e) { toast(`Não consegui excluir: ${e.message}`, 4500); return false; }
}

// imagem escolhida para a capa: vai como está (JPEG ou PNG de até 6 MB, sem perda); outra coisa (ou maior) vira um
// JPEG de até 3000 px, qualidade 95
function imagemParaCapa(file) {
  return new Promise((ok, erro) => {
    if (/^image\/(jpeg|png)$/.test(file.type) && file.size <= 6 * 1024 * 1024) {
      const fr = new FileReader();
      fr.onload = () => ok({ dados: String(fr.result).split(",")[1], mime: file.type });
      fr.onerror = () => erro(new Error("imagem inválida"));
      fr.readAsDataURL(file); return;
    }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const e = Math.min(1, 3000 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok({ dados: c.toDataURL("image/jpeg", 0.95).split(",")[1], mime: "image/jpeg" });
    };
    img.onerror = () => erro(new Error("imagem inválida"));
    img.src = url;
  });
}

// ---------- previsões do teclado próprio (artista, gênero, título no padrão) ----------
// os campos do editor de tags (sem o Gênero desde 02/11/2026: só o do app)
const CAMPOS_EDITOR = B.CAMPOS_TAG.filter(k => k !== "genero");
// as previsões de gênero ficam para as regras das playlists inteligentes (os grupos do app)
const GENEROS_COMUNS = ["Pop", "Rock", "Metal", "Electronic", "Rap", "R&B", "Chill", "Folk", "Classical", "Jazz", "Brazilian"];
const prev = { artistas: [], generos: [], extras: {} };
async function prepararPrevisoes() {
  const todas = await B.listaFaixas();
  const contar = (k) => { const m = new Map(); for (const f of todas) { const v = (f[k] || "").trim(); if (v) m.set(v, (m.get(v) || 0) + 1); } return m; };
  const arts = contar("artista");
  for (const f of todas) if (f.pasta && ![...arts.keys()].some(a => normTag(a) === normTag(f.pasta))) arts.set(f.pasta, 0);
  const gens = contar("genero");
  for (const g of GENEROS_COMUNS) if (![...gens.keys()].some(x => normTag(x) === normTag(g))) gens.set(g, 0);
  prev.artistas = [...arts].map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor, "pt-BR"));
  prev.generos = [...gens].map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n || a.valor.localeCompare(b.valor, "pt-BR"));
  prev.extras = {};
}
function preverMusicas(el) {
  const tipo = el.dataset.prever, txt = el.value || "", q = normTag(txt);
  if (tipo === "titulo") { const sg = padronizarTitulo(txt); return sg && sg !== txt ? [{ valor: sg, nota: "no padrão" }] : []; }
  const lista = tipo === "genero" ? prev.generos : prev.artistas;
  const extras = (prev.extras[tipo] || []).filter(Boolean).map(valor => ({ valor, n: 0, extra: true }));
  const todos = [...extras, ...lista.filter(x => !extras.some(e => normTag(e.valor) === normTag(x.valor)))];
  const saida = (x) => ({ valor: x.valor, nota: x.extra ? "da busca" : "" });
  if (!q) return todos.slice(0, 6).map(saida);
  // digitando em romaji, os nomes em kana também aparecem ("yoru" → ヨルシカ)
  const qs = q.length >= 2 ? chaveSom(txt) : "";
  const ponto = (x) => { const v = normTag(x.valor); if (v === q) return 0; if (v.startsWith(q)) return 4; if (v.split(/[\s\-/&()]+/).some(w => w.startsWith(q))) return 3; if (v.includes(q)) return 1; if (qs && temKana(x.valor) && chaveSom(x.valor).startsWith(qs)) return 2; return -1; };
  return todos.map(x => ({ x, p: ponto(x) })).filter(o => o.p > 0).sort((a, b) => b.p - a.p || b.x.extra - a.x.extra || b.x.n - a.x.n).slice(0, 6).map(o => saida(o.x));
}
async function ligarTecladoEm(box) {
  await prepararPrevisoes();
  tecl?.configurar({ prever: preverMusicas, sistema: true });
  tecl?.preparar(box);
}

/** Editor de tags (como o AutomaTag): melhor resultado da busca, campos, tags internas, capa e "campos ligados". */
async function abrirEditorTags(item) {
  if (!item.entrada && estado.id === item.id) { toast("Esta música está tocando: passe para a próxima e edite depois (o arquivo é regravado)."); return; }
  const ligadosPadrao = (await BD.lerCfg("camposLigados")) !== false;
  const v = Object.fromEntries(B.CAMPOS_TAG.map(k => [k, item[k] || ""]));
  // da pasta de entrada sem a tag de título: o nome do arquivo sem "03 - " nem os sinais de cópia ("(1)", "Cópia")
  if (item.entrada && !v.titulo && item.nome) v.titulo = padronizarTitulo(tituloDoArquivo(item.nome));
  let ligados = ligadosPadrao, capaNova, capaMime = "image/jpeg", capaUrl = null, candidatos = [], escolhido = -1;
  let romanizados = {}; // o que a busca trouxe em romaji no lugar do que ele escreveu na escrita original (fica só como dica)
  const tagsSel = new Set(item.tags || []);
  const outras = (await B.listaFaixas()).filter(g => g.id !== item.id);
  const box = document.createElement("div"); box.className = "mu-tags";
  box.innerHTML = `<div class="mu-tags-cab"><span class="mu-tags-capa"></span><div><b class="mu-tags-tit"></b><small class="mu-tags-art"></small></div></div>
    <h4 class="mu-secao">${I.varinha} Melhor resultado</h4>
    <div class="mu-tags-res"><p class="mu-dica">Buscando…</p></div>
    <div class="mu-tags-busca"><input type="search" aria-label="Buscar de novo"><button class="botao secundario mini">Buscar</button></div>
    <h4 class="mu-secao">Campos</h4>
    <div class="mu-tags-campos"></div>
    <label class="linha-cfg mu-tags-lig"><span>Artista = Álbum = Artista do álbum</span></label>
    <h4 class="mu-secao">${I.etiqueta} Tags internas</h4>
    <p class="mu-dica mu-dica-curta">Versão</p>
    <div class="mu-chips mu-tags-versoes"></div>
    <p class="mu-dica mu-dica-curta">Suas tags</p>
    <div class="mu-tags-grupos-ed"></div>
    <h4 class="mu-secao">Capa</h4>
    <div class="mu-tags-capas"><span class="mu-tags-capa-grande"></span><div class="mu-tags-capa-bts"></div></div>
    <p class="mu-dica mu-capa-info"></p>
    <div class="mu-ed-acoes"><button class="botao secundario" data-a="cancelar">Cancelar</button><button class="botao" data-a="salvar"></button></div>`;
  const { fechar } = folha(box, { classe: "alta" });
  const tit = box.querySelector(".mu-tags-tit"), art = box.querySelector(".mu-tags-art"), bSalvar = box.querySelector('[data-a="salvar"]');
  // sem o Gênero (pedido do Alediov, 02/11/2026): o gênero do arquivo é só o que o app tira do som
  const nomes = { titulo: "Título", artista: "Artista", album: "Álbum", albumArtista: "Artista do álbum", ano: "Ano" };
  const prever = { titulo: "titulo", artista: "artista", album: "artista", albumArtista: "artista" };
  const campos = box.querySelector(".mu-tags-campos"), ins = {};
  for (const k of CAMPOS_EDITOR) {
    const l = document.createElement("label"); l.className = "mu-campo";
    l.innerHTML = `<span>${nomes[k]}</span><input type="text" ${k === "ano" ? 'data-teclado="num" data-max="4" maxlength="4"' : `data-teclado="texto" data-prever="${prever[k]}"`} aria-label="${nomes[k]}">${k === "titulo" ? '<small class="mu-padrao" hidden></small><small class="mu-conflito" hidden></small>' : ""}${k === "titulo" || k === "artista" ? '<small class="mu-romaji" hidden></small>' : ""}`;
    ins[k] = l.querySelector("input"); ins[k].value = v[k];
    ins[k].oninput = () => { v[k] = ins[k].value; if (k === "artista" && ligados) espelhar(); pintar(); };
    campos.append(l);
  }
  const espelhar = () => { v.album = v.albumArtista = v.artista; ins.album.value = ins.albumArtista.value = v.artista; };
  const chave = document.createElement("button"); chave.className = `chave ${ligados ? "on" : ""}`; chave.setAttribute("aria-label", "Campos ligados");
  box.querySelector(".mu-tags-lig").append(chave);
  chave.onclick = (e) => { e.preventDefault(); ligados = !ligados; chave.classList.toggle("on", ligados); BD.gravarCfg("camposLigados", ligados); if (ligados) espelhar(); pintar(); };
  const pad = box.querySelector(".mu-padrao"), conf = box.querySelector(".mu-conflito");
  // ida e volta do romaji (pedido do Alediov, 26/10/2026): o nome dele na escrita original fica; a forma romanizada
  // (a de leitura do kana, ou a que a busca trouxe) aparece embaixo do campo, com "Usar" se ele quiser trocar
  const pintarRomaji = () => {
    for (const k of ["titulo", "artista"]) {
      const el = ins[k].parentElement.querySelector(".mu-romaji"); if (!el) continue;
      const daBusca = romanizados[k] && romanizados[k] !== v[k] ? romanizados[k] : "";
      const leitura = romajiParaMostrar(v[k]);
      el.hidden = !daBusca && !leitura;
      el.innerHTML = daBusca ? `Da busca: <b></b> <button class="link-mini">Usar</button>` : leitura ? `Em romaji: <b></b>` : "";
      if (el.hidden) continue;
      el.querySelector("b").textContent = daBusca || leitura;
      el.querySelector("button")?.addEventListener("click", (e) => { e.preventDefault(); v[k] = ins[k].value = k === "titulo" ? padronizarTitulo(daBusca) : daBusca; if (k === "artista" && ligados) espelhar(); delete romanizados[k]; pintar(); });
    }
  };
  const repetida = () => outras.find(g => normTag(g.artista) === normTag(v.artista) && chaveConjunto(g.titulo) === chaveConjunto(v.titulo));
  // tags internas: versões (mexem nos parênteses do título) e as de grupo
  const boxV = box.querySelector(".mu-tags-versoes"), boxG = box.querySelector(".mu-tags-grupos-ed");
  const pintarVersoes = () => {
    const a = analisarTitulo(v.titulo);
    boxV.innerHTML = "";
    for (const ver of versoesDeTag()) {
      const b = document.createElement("button"); b.className = a.versoes.includes(ver.nome) ? "on" : ""; b.textContent = ver.nome;
      b.onclick = (e) => {
        e.preventDefault();
        const t = analisarTitulo(v.titulo);
        const partes = t.versoes.includes(ver.nome) ? t.partes.filter(p => p !== ver.nome) : [...t.partes, ver.nome];
        v.titulo = ins.titulo.value = montarTitulo(t.base, partes); pintar();
      };
      boxV.append(b);
    }
  };
  const pintarGrupos = async () => {
    const t = await B.tagsInternas();
    const tem = (nome) => [...tagsSel].find(x => normTag(x) === normTag(nome));
    chipsDeTags(boxG, t, {
      classe: (nome) => (tem(nome) ? "on" : ""), extras: [...tagsSel],
      aoTocar: (nome) => { const ja = tem(nome); if (ja) tagsSel.delete(ja); else tagsSel.add(nome); pintarGrupos(); },
      aoNova: async () => { const nome = await pedirNomeTag(); if (nome) { tagsSel.add(nome); pintarGrupos(); } },
    });
  };
  const pintar = () => {
    tit.textContent = v.titulo || item.nome || "Sem título"; art.textContent = v.artista || "Sem artista";
    ins.album.disabled = ins.albumArtista.disabled = ligados;
    const sug = padronizarTitulo(v.titulo);
    pad.hidden = !v.titulo || sug === v.titulo;
    pad.innerHTML = pad.hidden ? "" : `Fora do padrão. Sugestão: <b>${escapar(sug)}</b> <button class="link-mini">Usar</button>`;
    pad.querySelector("button")?.addEventListener("click", (e) => { e.preventDefault(); v.titulo = ins.titulo.value = sug; pintar(); });
    const dup = v.titulo && v.artista ? repetida() : null;
    conf.hidden = !dup;
    conf.innerHTML = dup ? `Já existe "${escapar(dup.titulo)}" de ${escapar(dup.artista)}.` : "";
    bSalvar.textContent = item.entrada ? `Salvar e mover para ${B.nomeArquivo(v.artista || "Sem artista")}` : "Salvar";
    pintarRomaji();
    pintarVersoes();
  };
  if (ligados && !v.album && !v.albumArtista) espelhar();
  // capa: a original do arquivo, sem perda
  const capaG = box.querySelector(".mu-tags-capa-grande"), capaP = box.querySelector(".mu-tags-capa"), capaInfo = box.querySelector(".mu-capa-info");
  const pintarCapa = async () => {
    const url = capaNova === "" ? "" : capaNova ? `data:${capaMime};base64,${capaNova}` : item.temCapa ? await B.capaDe({ ...item, temCapa: true }, "original") : "";
    for (const el of [capaG, capaP]) { el.style.backgroundImage = url ? `url("${url}")` : ""; el.classList.toggle("vazia", !url); }
    capaInfo.textContent = "";
    if (url) { const img = new Image(); img.onload = () => { capaInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight} px${capaNova ? ` · ${Math.round(capaNova.length * 0.75 / 1024)} KB` : ""}`; }; img.src = url; }
  };
  const bts = box.querySelector(".mu-tags-capa-bts");
  const bDaBusca = document.createElement("button"); bDaBusca.className = "mu-pilula"; bDaBusca.textContent = "Usar a da busca"; bDaBusca.hidden = true;
  bDaBusca.onclick = async () => { try { bDaBusca.textContent = "Baixando…"; capaNova = await baixarImagem(capaUrl); capaMime = "image/jpeg"; pintarCapa(); } catch (e) { toast(`Não consegui baixar a capa: ${e.message}`); } bDaBusca.textContent = "Usar a da busca"; };
  const bArq = document.createElement("label"); bArq.className = "mu-pilula"; bArq.innerHTML = `Escolher imagem…<input type="file" accept="image/*" hidden>`;
  bArq.querySelector("input").onchange = async (e) => { const f = e.target.files[0]; if (f) { try { const r = await imagemParaCapa(f); capaNova = r.dados; capaMime = r.mime; pintarCapa(); } catch (er) { toast(er.message); } } };
  const bTirar = document.createElement("button"); bTirar.className = "mu-pilula"; bTirar.textContent = "Tirar a capa";
  bTirar.onclick = () => { capaNova = ""; pintarCapa(); };
  bts.append(bDaBusca, bArq, bTirar);
  // busca
  const res = box.querySelector(".mu-tags-res"), qIn = box.querySelector(".mu-tags-busca input");
  const semExt = (item.nome || item.caminho.split("/").pop()).replace(/\.[^.]+$/, "");
  const padraoQ = () => [v.artista, v.titulo || semExt].filter(Boolean).join(" ");
  qIn.value = padraoQ();
  const usar = async (i) => {
    escolhido = i;
    let c = candidatos[i]; c = await completarDeezer(c); candidatos[i] = c;
    const r = camposDoCandidato(c, ligados, v);
    romanizados = r.romanizados || {}; delete r.romanizados;
    Object.assign(v, r);
    for (const k of CAMPOS_EDITOR) ins[k].value = v[k];
    capaUrl = c.capa; bDaBusca.hidden = !capaUrl;
    if (capaUrl) bDaBusca.click();
    desenharRes(); pintar();
  };
  const desenharRes = (abertos = false) => {
    res.innerHTML = "";
    if (!candidatos.length) { res.innerHTML = `<p class="mu-dica">Nada encontrado.</p>`; return; }
    const lista = abertos ? candidatos : [candidatos[Math.max(0, escolhido)]];
    lista.forEach((c) => {
      const i = candidatos.indexOf(c);
      const el = document.createElement("button"); el.className = `mu-res ${i === escolhido ? "on" : ""}`;
      el.innerHTML = `<span class="mu-res-capa" style="background-image:url('${c.miniatura || ""}')"></span><span class="mu-res-tx"><b>${escapar(c.titulo)}</b><small>${escapar(c.artista)}</small><small>${escapar([c.albumOriginal, c.ano].filter(Boolean).join(" · "))} · ${c.fonte}</small></span>`;
      el.onclick = () => usar(i);
      res.append(el);
    });
    if (!abertos && candidatos.length > 1) {
      const mais = document.createElement("button"); mais.className = "link-mini mu-res-mais"; mais.textContent = candidatos.length === 2 ? "Ver o outro resultado" : `Ver os outros ${candidatos.length - 1} resultados`;
      mais.onclick = () => desenharRes(true); res.append(mais);
    }
  };
  const buscar = async () => {
    res.innerHTML = `<p class="mu-dica">Buscando…</p>`;
    try {
      const q = qIn.value.trim();
      candidatos = await buscarTags(q !== padraoQ() ? { titulo: q, artista: "", arquivo: semExt, duracao: item.duracao } : { titulo: v.titulo || semExt, artista: v.artista, arquivo: semExt, duracao: item.duracao });
      escolhido = -1; desenharRes();
      // o que a busca achou também vira previsão no teclado
      prev.extras = { artista: [...new Set(candidatos.map(c => c.artista))] };
    } catch (e) { res.innerHTML = `<p class="mu-dica">Sem internet ou a busca falhou (${escapar(e.message)}).</p>`; }
  };
  box.querySelector(".mu-tags-busca button").onclick = buscar;
  qIn.onkeydown = (e) => { if (e.key === "Enter") buscar(); };
  if (item.entrada) {
    const ex = document.createElement("button"); ex.className = "link-mini mu-ed-excluir"; ex.innerHTML = `${I.lixo}<span>Excluir o arquivo</span>`;
    ex.onclick = async (e) => { e.preventDefault(); if (await excluirDaEntrada(item)) { tecl?.fechar(); fechar(); } };
    box.querySelector(".mu-ed-acoes").after(ex);
  }
  box.querySelector('[data-a="cancelar"]').onclick = () => { tecl?.fechar(); fechar(); };
  bSalvar.onclick = async () => {
    tecl?.fechar();
    if (!v.titulo.trim() || !v.artista.trim()) { toast("Preencha pelo menos o título e o artista."); return; }
    const dup = repetida();
    if (dup && !(await modal({ titulo: "Título repetido", texto: `"${dup.titulo}" de ${dup.artista} já existe. Salvar assim mesmo? O arquivo fica como "${B.nomeArquivo(v.titulo)} (2)".`, botoes: [{ texto: "Voltar e diferenciar", valor: false }, { texto: "Salvar assim mesmo", valor: true, classe: "secundario" }] }))) return;
    bSalvar.disabled = true; bSalvar.textContent = "Salvando…";
    try {
      const f = await B.salvarTags(item, { ...v, titulo: v.titulo.trim(), artista: v.artista.trim(), tags: [...tagsSel] }, capaNova, capaMime);
      fechar();
      const an = B.ultimoAvisoNome();
      if (an) toast(`Já havia “${an.pedido}” em ${an.pasta}: ficou “${an.ficou}”.`, 5000);
      else toast(item.entrada ? `"${f.titulo}" foi para ${f.pasta}.` : "Tags salvas no arquivo.");
      await atualizarBadge(); desenhar(true);
    } catch (e) { toast(`Não consegui salvar: ${e.message}`, 5000); bSalvar.disabled = false; pintar(); }
  };
  await ligarTecladoEm(box);
  pintar(); pintarGrupos(); pintarCapa(); buscar();
}

/** Nome do arquivo × título (09/11/2026): a lista para arrumar em lote; os com conflito ficam sem marcar. */
async function telaNomes(tela) {
  const l = await B.nomesDosArquivos();
  cabecalho(tela, { titulo: "Nomes dos arquivos", voltar: () => { sub = null; desenhar(); }, acoes: false, sub: `${l.length} ${l.length === 1 ? "arquivo" : "arquivos"}` });
  if (!l.length) { tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Todos com o nome do título.</p>`); return; }
  const MOT = { copia: "cópia", maiusculas: "maiúsculas", titulo: "outro nome" };
  const sel = new Set(l.filter(x => !x.conflito).map(x => x.f.id));
  const barra = document.createElement("div"); barra.className = "mu-barra";
  const bAplicar = document.createElement("button"); bAplicar.className = "botao mini mu-nomes-aplicar";
  const pintarB = () => { bAplicar.textContent = `Arrumar (${sel.size})`; bAplicar.disabled = !sel.size; };
  barra.append(bAplicar); tela.append(barra);
  const box = document.createElement("div"); box.className = "mu-padrao-lista"; tela.append(box);
  for (const x of l) {
    const el = document.createElement("label"); el.className = `mu-padrao-item mu-nomes-item ${x.conflito ? "conflito" : ""}`;
    el.innerHTML = `<input type="checkbox" ${x.conflito ? "disabled" : "checked"}><span><s></s><b></b><small></small></span>`;
    el.querySelector("s").textContent = x.f.caminho.split("/").pop();
    el.querySelector("b").textContent = x.nome; el.querySelector("b").insertAdjacentHTML("beforeend", `<em class="mu-nm-mot">${MOT[x.motivo]}</em>`);
    const sm = el.querySelector("small"); sm.textContent = x.pasta;
    if (x.conflito) sm.insertAdjacentHTML("beforeend", ` · <span class="mu-nm-conf">já existe “${escapar(x.conflito.caminho.split("/").pop())}”</span>`);
    const ck = el.querySelector("input"); ck.onchange = () => { if (ck.checked) sel.add(x.f.id); else sel.delete(x.f.id); pintarB(); };
    box.append(el);
  }
  pintarB();
  bAplicar.onclick = () => arrumarNumeros(l.filter(x => sel.has(x.f.id)));
}

async function telaPadrao(tela) {
  const fora = await B.titulosForaDoPadrao();
  cabecalho(tela, { titulo: "Padrão dos títulos", voltar: () => { sub = null; desenhar(); }, acoes: false, sub: `${fora.length} ${fora.length === 1 ? "título" : "títulos"}` });
  if (!fora.length) { tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Tudo no padrão.</p>`); return; }
  const sel = new Map(fora.map(x => [x.faixa.id, x.novo]));
  const barra = document.createElement("div"); barra.className = "mu-barra";
  const bAplicar = document.createElement("button"); bAplicar.className = "botao mini";
  const pintarB = () => { bAplicar.textContent = `Aplicar (${sel.size})`; bAplicar.disabled = !sel.size; };
  const bTodos = document.createElement("button"); bTodos.className = "botao secundario mini"; bTodos.textContent = "Desmarcar todos";
  barra.append(bTodos, bAplicar); tela.append(barra);
  const box = document.createElement("div"); box.className = "mu-padrao-lista"; tela.append(box);
  for (const { faixa: f, novo } of fora) {
    const el = document.createElement("label"); el.className = "mu-padrao-item";
    el.innerHTML = `<input type="checkbox" checked><span><s>${escapar(f.titulo)}</s><input type="text" value="${escapar(novo)}" aria-label="Novo título"><small>${escapar(f.artista)}</small></span>`;
    const ck = el.querySelector('input[type="checkbox"]'), tx = el.querySelector('input[type="text"]');
    ck.onchange = () => { if (ck.checked) sel.set(f.id, tx.value); else sel.delete(f.id); pintarB(); };
    tx.oninput = () => { if (ck.checked) sel.set(f.id, tx.value); };
    box.append(el);
  }
  bTodos.onclick = () => { const marcar = !sel.size; box.querySelectorAll(".mu-padrao-item").forEach((el, i) => { const ck = el.querySelector('input[type="checkbox"]'); ck.checked = marcar; ck.onchange(); }); bTodos.textContent = marcar ? "Desmarcar todos" : "Marcar todos"; };
  pintarB();
  bAplicar.onclick = async () => {
    const lista = [...sel];
    const a = andamento(`Padronizando 0 de ${lista.length}…`);
    let ok = 0, pulou = 0, erros = 0;
    for (let i = 0; i < lista.length; i++) {
      const [id, novo] = lista[i];
      a.set(`Padronizando ${i + 1} de ${lista.length}…`, i / lista.length);
      const f = await B.faixa(id);
      if (!f) continue;
      if (estado.id === id) { pulou++; continue; }
      try { await B.salvarTags(f, { titulo: novo.trim() }); ok++; } catch (e) { erros++; console.warn("padrão", f.caminho, e.message); }
    }
    a.fim();
    toast(`${ok} ${ok === 1 ? "título padronizado" : "títulos padronizados"}${pulou ? `; ${pulou} tocando agora (fica para depois)` : ""}${erros ? `; ${erros} com erro` : ""}.`, 5000);
    desenhar();
  };
}

// ---------- bolhas no fundo (como as do tubete do Estudos) ----------
function bolhas(alvo, n = 14, classe = "") {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const c = document.createElement("div"); c.className = `mu-bolhas ${classe}`; c.setAttribute("aria-hidden", "true");
  for (let i = 0; i < n; i++) {
    const b = document.createElement("i"), t = 6 + Math.random() * 20;
    b.style.cssText = `--x:${(Math.random() * 96).toFixed(1)}%;--s:${t.toFixed(0)}px;--d:${(12 + Math.random() * 14).toFixed(1)}s;--a:-${(Math.random() * 26).toFixed(1)}s;--v:${(Math.random() * 44 - 22).toFixed(0)}px`;
    c.append(b);
  }
  alvo.prepend(c);
  return c;
}

// ---------- tags internas ----------
// partesTag (nomes.js): tags longas mostram o nome em cima e o que está entre parênteses embaixo, menor.
/** O nome da tag em HTML: principal e, se houver, o subtítulo. */
function nomeTag(nome) {
  const p = partesTag(nome);
  return `<span class="mu-tn" title="${escapar(nome)}"><span class="mu-tn-p">${escapar(p.principal)}</span>${p.sub ? `<span class="mu-tn-s">${escapar(p.sub)}</span>` : ""}</span>`;
}
const ICONE_CATEGORIA = { animes: "flor", jogos: "jogo", filmes: "filme", series: "tv", "artistas/projetos": "microfone", [normTag(B.EM_AVALIACAO)]: "relogio" };
// a ordem das tags e dos grupos dele na aba Tags (pedido do Alediov, 09/11/2026; nomes.js): neste aparelho
const ORDEM_TAGS_KEY = "mu.tags.ordem";
const ordemTags = () => { try { const v = localStorage.getItem(ORDEM_TAGS_KEY); return ORDENS_TAGS.some(o => o.id === v) ? v : ORDEM_PADRAO; } catch { return ORDEM_PADRAO; } };
/** As tags internas na ordem escolhida: as tags de cada grupo, as sem grupo e os grupos dele (os fixos no lugar). */
function naOrdem(t) {
  const m = ordemTags();
  const categorias = ordenarGrupos(t.categorias.map(c => ({ ...c, tags: ordenarTags(c.tags, m) })), m);
  const semCategoria = ordenarTags(t.semCategoria, m);
  return { ...t, categorias, semCategoria, grupos: [...categorias.flatMap(c => c.tags), ...semCategoria] };
}
function escolherOrdemTags() {
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Ordem das tags</h3>`;
  const { fechar } = folha(box);
  for (const o of ORDENS_TAGS) {
    const b = opcao(o.rotulo, () => { fechar(); try { localStorage.setItem(ORDEM_TAGS_KEY, o.id); } catch { /* sem armazenamento */ } desenhar(true); });
    b.dataset.ordem = o.id; if (o.id === ordemTags()) b.classList.add("on");
    box.append(b);
  }
}
/**
 * Confere ao vivo, no formulário aberto, se o nome já está em uso (pedido do Alediov, 09/11/2026; nomes.js): ✓ ao lado
 * do campo quando está livre; igual a outro (sem maiúsculas e acentos, ou com as partes trocadas) bloqueia o botão;
 * parecido (a parte antes ou dentro dos parênteses, pela escrita ou pelo som) só avisa.
 */
function verificarNomeNoFormulario(existentes, ignorar = null) {
  const form = document.querySelector("#modal form"), inp = form?.querySelector("input[type=text]"), bt = form?.querySelector(".botao");
  if (!inp) return;
  const caixa = document.createElement("span"); caixa.className = "mu-nome-caixa";
  inp.before(caixa); caixa.append(inp);
  const ok = document.createElement("i"); ok.className = "mu-nome-ok"; ok.innerHTML = I.certo; ok.setAttribute("aria-label", "Nome livre");
  caixa.append(ok);
  const av = document.createElement("small"); av.className = "mu-nome-aviso"; av.setAttribute("aria-live", "polite");
  caixa.after(av);
  const pintar = () => {
    const r = nomeEmUso(inp.value, existentes, { ignorar });
    const livre = !r.vazio && !r.igual && !r.parecidos.length;
    ok.hidden = !livre; caixa.dataset.estado = r.vazio ? "" : r.igual ? "igual" : r.parecidos.length ? "parecido" : "livre";
    if (bt) bt.disabled = !!r.vazio || !!r.igual;
    av.className = `mu-nome-aviso ${r.igual ? "igual" : ""}`;
    av.textContent = r.igual ? `Já existe: ${r.igual}` : r.parecidos.length ? `Parecida: ${r.parecidos.map(x => x.nome).join(" · ")}` : "";
    av.hidden = !av.textContent;
  };
  inp.addEventListener("input", pintar); pintar();
}
// ícones escolhidos para os grupos (pedido do Alediov, 02/11/2026): emojis, mostrados como os ícones 3D do app
// (icones.js; os sem ícone 3D saem como o emoji do sistema)
const ICONES_GRUPO = ["🌸", "🐉", "🦊", "🥷", "🤖", "⚔️", "🛡️", "👑", "🔮", "🪄", "💀", "🎃", "🎮", "🎲", "🃏", "♟️", "🧩", "🎯", "🏆", "🎬", "📺", "🎭", "🎪", "🎫", "🎤", "🎧", "🎸", "🎨", "📚", "📖", "📜", "🎓", "🏫", "🧠", "🦷", "🔥", "⚡", "⭐", "🌟", "✨", "💫", "🌈", "🌙", "☀️", "🌌", "🌠", "🪐", "☄️", "🛰️", "🚀", "🌅", "🌃", "🌆", "⛰️", "🌋", "🏝️", "🏖️", "❄️", "💧", "🫧", "🌀", "🌻", "🍂", "🌿", "🍀", "🌱", "🍄", "🦄", "🦋", "🦉", "🐰", "🦆", "🧸", "🍭", "🍨", "🎂", "🎁", "🎉", "🎈", "🎆", "🎄", "💎", "❤️", "💪", "💬", "🌎", "🏛️", "🧭", "📱", "🔔"];
const iconesCat = new Map(); // grupo (normalizado) → emoji escolhido, lembrado de cada tagsInternas() que a tela lê
function lembrarIcones(t) { for (const c of t?.categorias || []) { if (c.icone) iconesCat.set(normTag(c.nome), c.icone); else iconesCat.delete(normTag(c.nome)); } return t; }
/** O ícone de um grupo (objeto da categoria ou o nome): o escolhido por ele ou o desenho padrão. */
function iconeCategoria(c) {
  const nome = typeof c === "string" ? c : c?.nome, esc = (typeof c === "object" && c ? c.icone : null) ?? iconesCat.get(normTag(nome));
  return esc ? icone3d(esc, "mu-cat-ico") : I[ICONE_CATEGORIA[normTag(nome)] || "pasta"];
}
/** Grade de ícones para o grupo. */
function escolherIcone(c) {
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit"></h3><div class="mu-icones-grade" role="listbox"></div>`;
  box.querySelector("h3").textContent = `Ícone de ${c.nome}`;
  const { fechar } = folha(box, { classe: "alta" });
  const g = box.querySelector(".mu-icones-grade");
  const ir = async (e) => { fechar(); await B.definirIconeCategoria(c.nome, e); if (e) iconesCat.set(normTag(c.nome), e); else iconesCat.delete(normTag(c.nome)); desenhar(true); };
  const pad = document.createElement("button"); pad.className = `mu-ic-op padrao ${c.icone ? "" : "on"}`; pad.innerHTML = I[ICONE_CATEGORIA[normTag(c.nome)] || "pasta"]; pad.setAttribute("aria-label", "Padrão"); pad.onclick = () => ir("");
  g.append(pad);
  for (const e of ICONES_GRUPO) {
    const b = document.createElement("button"); b.className = `mu-ic-op ${c.icone === e ? "on" : ""}`; b.innerHTML = icone3d(e, "mu-cat-ico"); b.setAttribute("aria-label", e); b.onclick = () => ir(e);
    g.append(b);
  }
}
/**
 * Escolha de tags por grupo (Animes, Jogos…, e "Sem grupo" no fim): em `alvo`, um título por grupo e os chips.
 * `classe(nome)` diz "on", "parcial" ou "" e `rotulo(nome)` pode trocar o texto; `extras` são tags que ainda não
 * existem na lista (escolhidas no editor).
 */
function chipsDeTags(alvo, t, { classe, aoTocar, aoNova, rotulo, extras = [] }) {
  t = naOrdem(t);
  alvo.innerHTML = ""; alvo.classList.add("mu-tags-secoes");
  const soltas = [...t.semCategoria.map(g => g.nome), ...extras.filter(x => !t.grupos.some(g => normTag(g.nome) === normTag(x)))];
  const comGrupo = t.categorias.some(c => c.tags.length);
  lembrarIcones(t);
  const secoes = [...t.categorias.filter(c => c.tags.length).map(c => [c.nome, c.tags.map(g => g.nome), iconeCategoria(c)]), ...(soltas.length ? [[comGrupo ? "Outras" : "", soltas, I.etiqueta]] : [])];
  for (const [nomeSec, nomes, ic] of secoes) {
    if (nomeSec) alvo.insertAdjacentHTML("beforeend", `<h5 class="mu-tags-cat">${ic}<span>${escapar(nomeSec)}</span></h5>`);
    const g = document.createElement("div"); g.className = "mu-chips mu-tags-grupos";
    for (const nome of nomes) {
      const b = document.createElement("button"); b.style.setProperty("--c", corDaTag(nome)); b.className = classe(nome) || "";
      b.innerHTML = nomeTag(rotulo ? rotulo(nome) : nome);
      b.onclick = (e) => { e.preventDefault(); aoTocar(nome); };
      g.append(b);
    }
    alvo.append(g);
  }
  const n = document.createElement("button"); n.className = "nova"; n.innerHTML = `${I.mais2}<span>Nova tag</span>`;
  n.onclick = (e) => { e.preventDefault(); aoNova(); };
  const fim = document.createElement("div"); fim.className = "mu-chips mu-tags-grupos"; fim.append(n); alvo.append(fim);
}
/** Diz quantas versões da música também mudaram. */
function avisarVersoes(n) { if (n) toast(`${n === 1 ? "A outra versão também mudou" : `As outras ${n} versões também mudaram`} (Sped Up, Instrumental…).`); }

/** Nome de uma tag nova (ou o novo nome, com `valor`). A nova sem grupo escolhido vai para Em Avaliação; `null`
 *  explícito (o "+" de Outras) a deixa sem grupo. */
async function pedirNomeTag(tipo = "grupo", valor = "", categoria = B.EM_AVALIACAO) {
  const t = await B.tagsInternas(), existentes = [...t.versoes, ...t.grupos].map(x => x.nome);
  const espera = formulario({ titulo: valor ? "Renomear a tag" : tipo === "versao" ? "Nova tag de versão" : "Nova tag", campos: [{ id: "nome", rotulo: "Nome", tipo: "text", valor, placeholder: tipo === "versao" ? "Ex.: Remix, Nightcore" : "Ex.: ブルーロック (Blue Lock)" }], botoes: [{ texto: valor ? "Salvar" : "Criar", acao: "salvar" }] });
  verificarNomeNoFormulario(existentes, valor || null);
  const nome = (await espera)?.nome?.trim();
  if (!nome) return null;
  const igual = nomeEmUso(nome, existentes, { ignorar: valor || null }).igual;
  if (igual) { toast(`Já existe a tag ${igual}.`); return null; }
  if (valor) return nome;
  return B.criarTag(nome, tipo, tipo === "grupo" ? categoria : null);
}
async function pedirNomeCategoria(valor = "") {
  const existentes = [...(await B.tagsInternas()).categorias.map(c => c.nome), "Outras", "Versões"];
  const espera = formulario({ titulo: valor ? "Renomear o grupo" : "Novo grupo de tags", campos: [{ id: "nome", rotulo: "Nome", tipo: "text", valor, placeholder: "Ex.: Doramas, Novelas, Vocaloid" }], botoes: [{ texto: valor ? "Salvar" : "Criar", acao: "salvar" }] });
  verificarNomeNoFormulario(existentes, valor || null);
  const nome = (await espera)?.nome?.trim() || null;
  if (nome && nomeEmUso(nome, existentes, { ignorar: valor || null }).igual) { toast(`Já existe o grupo ${nome}.`); return null; }
  return nome;
}
/** Avisa os grupos dele que ficaram vazios e sumiram. */
function avisarGruposApagados(l) { if (l?.length) toast(l.length === 1 ? `O grupo ${l[0]} ficou vazio e foi apagado.` : `Os grupos ${l.join(", ")} ficaram vazios e foram apagados.`, 3500); }
/** Para qual grupo vai a tag? */
async function escolherCategoria(nomes, atual) {
  const t = naOrdem(await B.tagsInternas());
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">${nomes.length === 1 ? `Mover “${escapar(nomes[0])}” para` : `Mover ${nomes.length} tags para`}</h3>`;
  const { fechar } = folha(box);
  const ir = async (cat) => { fechar(); const sumiram = await B.moverParaCategoria(nomes, cat); toast(`Foi para ${cat || "Outras"}.`); avisarGruposApagados(sumiram); desenhar(true); };
  lembrarIcones(t);
  for (const c of t.categorias) {
    const o = opcao(c.nome, () => ir(c.nome)); o.insertAdjacentHTML("afterbegin", `<i class="mu-op-ic">${iconeCategoria(c)}</i>`);
    if (atual && normTag(atual) === normTag(c.nome)) o.classList.add("on");
    box.append(o);
  }
  const ou = opcao("Outras", () => ir(null)); ou.insertAdjacentHTML("afterbegin", `<i class="mu-op-ic">${I.etiqueta}</i>`);
  if (!atual) ou.classList.add("on");
  box.append(ou);
  box.append(opcao("Novo grupo…", async () => { fechar(); const n = await pedirNomeCategoria(); if (n) { const nome = await B.criarCategoria(n); await B.moverParaCategoria(nomes, nome); toast(`Foi para ${nome}.`); desenhar(true); } }));
}

/** Segurar o dedo (ou o botão direito) num elemento chama `fn`; o toque que vier depois do segurar é ignorado. */
function aoSegurar(el, fn) {
  let t = null, x0 = 0, y0 = 0;
  el.addEventListener("pointerdown", (e) => {
    x0 = e.clientX; y0 = e.clientY; clearTimeout(t);
    t = setTimeout(() => { el.dataset.segurou = "1"; navigator.vibrate?.(15); fn(); }, 480);
  });
  el.addEventListener("pointermove", (e) => { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 10) clearTimeout(t); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, () => clearTimeout(t));
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); if (e.pointerType !== "touch" && !el.dataset.segurou) { clearTimeout(t); el.dataset.segurou = "1"; fn(); } });
  el.addEventListener("click", (e) => { if (el.dataset.segurou) { delete el.dataset.segurou; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
function cartaoTag(t) {
  const c = document.createElement("button"); c.className = `mu-tag-cartao ${t.tipo}`; c.style.setProperty("--c", corDaTag(t.nome));
  c.dataset.tag = t.nome;
  const p = partesTag(t.nome);
  c.innerHTML = `<i>${t.tipo === "versao" ? I.varinha : I.etiqueta}</i><span><b></b>${p.sub ? "<em></em>" : ""}<small>${t.n} ${t.n === 1 ? "música" : "músicas"}</small></span>`;
  c.querySelector("b").textContent = p.principal; if (p.sub) c.querySelector("em").textContent = p.sub;
  c.title = t.nome;
  c.onclick = () => { sub = { tipo: "tag", id: t.nome, tipoTag: t.tipo }; desenhar(); };
  // segurar a tag: mover para outra seção, renomear, apagar (as versões fixas não têm menu)
  if (t.tipo === "grupo" || !t.fixa) aoSegurar(c, () => menuTag(t.nome, t.tipo));
  return c;
}
/** A tag em Em Avaliação: o cartão e, no canto, o atalho "Mover para…". */
function celulaMover(t) {
  const d = document.createElement("div"); d.className = "mu-tag-cel";
  const m = document.createElement("button"); m.className = "mu-tag-mover"; m.innerHTML = I.pasta; m.setAttribute("aria-label", `Mover ${t.nome} para…`); m.title = "Mover para…";
  m.onclick = (e) => { e.stopPropagation(); escolherCategoria([t.nome], B.EM_AVALIACAO); };
  d.append(cartaoTag(t), m);
  return d;
}
/** O "+" discreto no fim de cada seção. */
function cartaoNovo(rotulo, fn) {
  const b = document.createElement("button"); b.className = "mu-tag-cartao nova mu-tag-mais"; b.setAttribute("aria-label", rotulo); b.title = rotulo;
  b.innerHTML = `<i>${I.mais2}</i>`; b.onclick = fn;
  return b;
}
/**
 * Aba Tags (pedido do Alediov, 02/11/2026: "não quero descrições nessa aba… separe em categorias as tags"; escolha
 * dele: seções fixas). Versões, Animes, Jogos, Filmes, Séries, Artistas/Projetos, os grupos criados por ele e Outras
 * (as tags sem grupo), cada uma recolhível, com o ícone e a contagem; segurar uma tag a move para outra seção.
 * No alto, discretos: Gêneros e climas, + Tag e + Grupo.
 */
async function telaTags(tela) {
  const t = naOrdem(lembrarIcones(await B.tagsInternas()));
  const abrirTag = (n, tipo = "grupo") => { sub = { tipo: "tag", id: n, tipoTag: tipo }; desenhar(); };
  const novaTag = (cat) => async () => { const n = await pedirNomeTag("grupo", "", cat); if (n) abrirTag(n); };
  {
    const topo = document.createElement("div"); topo.className = "mu-tags-topo";
    const pil = (cls, ic, tx, fn) => { const b = document.createElement("button"); b.className = `mu-pilula ${cls}`; b.innerHTML = `${ic}<span>${tx}</span>`; b.onclick = fn; return b; };
    const sem = (await B.semGenero()).length;
    topo.append(
      pil("mu-tags-generos", I.onda, `Gêneros e climas${sem ? ` <em>${sem}</em>` : ""}`, () => { sub = { tipo: "generos" }; desenhar(); }),
      pil("mu-tags-nova", I.mais2, "Tag", novaTag(B.EM_AVALIACAO)),
      pil("mu-tags-novogrupo", I.pasta, "Grupo", async () => { const n = await pedirNomeCategoria(); if (n) { await B.criarCategoria(n); desenhar(true); } }),
      pil("mu-tags-dividir", I.trocar, "Dividir", folhaDivisao),
      pil("mu-tags-ordem", I.ordem, ORDENS_TAGS.find(o => o.id === ordemTags())?.rotulo.replace(/ \(A–Z\)$/, "") || "Ordem", escolherOrdemTags),
    );
    tela.append(topo);
  }
  const secao = ({ id, nome, icone, tags, aberta, menu, classe = "", mais, mover = false }) => {
    const { el, corpo } = sanfona({ id, titulo: nome, icone, conta: tags.length, aberta, menu, classe: `mu-sf-tags ${classe}` });
    el.dataset.secao = nome;
    const g = document.createElement("div"); g.className = "mu-tags-grade";
    tags.forEach(x => g.append(mover ? celulaMover(x) : cartaoTag(x)));
    if (mais) g.append(mais);
    corpo.append(g); tela.append(el);
    return el;
  };
  // Em Avaliação (09/11/2026): no alto e destacada, só quando tem tag; cada tag com o atalho para o grupo certo
  const aval = t.categorias.find(c => normTag(c.nome) === normTag(B.EM_AVALIACAO));
  if (aval?.tags.length) secao({ id: "tags.avaliacao", nome: aval.nome, icone: iconeCategoria(aval), tags: aval.tags, aberta: true, classe: "mu-sf-aval", mover: true,
    menu: { rotulo: `Opções de ${aval.nome}`, fn: () => menuCategoria(aval, t) }, mais: cartaoNovo(`Nova tag em ${aval.nome}`, novaTag(aval.nome)) });
  secao({ id: "tags.versoes", nome: "Versões", icone: I.varinha, tags: t.versoes, aberta: false,
    mais: cartaoNovo("Nova versão", async () => { const n = await pedirNomeTag("versao"); if (n) desenhar(true); }) });
  // aberto por padrão: o grupo mais usado (com mais músicas marcadas)
  const soma = (c) => c.tags.reduce((a, g) => a + (g.n || 0), 0);
  const maisUsado = t.categorias.filter(c => soma(c) > 0).sort((a, b) => soma(b) - soma(a))[0]?.nome;
  for (const c of t.categorias) {
    if (c === aval) continue;
    const el = secao({ id: `tags.cat.${normTag(c.nome)}`, nome: c.nome, icone: iconeCategoria(c), tags: c.tags, aberta: c.nome === maisUsado,
      menu: { rotulo: `Opções de ${c.nome}`, fn: () => menuCategoria(c, t) }, classe: "mu-sf-cat", mais: cartaoNovo(`Nova tag em ${c.nome}`, novaTag(c.nome)) });
    // tocar no ícone do grupo abre a grade de ícones
    const ic = el.querySelector(".mu-sf-ic");
    if (ic) { ic.classList.add("trocavel"); ic.setAttribute("role", "button"); ic.setAttribute("aria-label", `Ícone de ${c.nome}`); ic.addEventListener("click", (e) => { e.stopPropagation(); escolherIcone(c); }); }
  }
  // Outras: as tags sem grupo (aberta quando tem alguma)
  secao({ id: "tags.semgrupo", nome: "Outras", icone: I.etiqueta, tags: t.semCategoria, aberta: t.semCategoria.length > 0, classe: "mu-sf-outras",
    mais: cartaoNovo("Nova tag em Outras", novaTag(null)) });
}
// A divisão das tags pelo Claude (pedido do Alediov, 04/11/2026): "Enviar" grava progresso/musicas/tags.json no
// repositório (com o token do app; sem ele, copia o texto), o Claude escreve progresso/musicas/divisao-tags.json e
// "Aplicar" mostra o que muda antes (grupos novos, tags que mudam de grupo, nomes não achados).
const TAGS_REPO = "progresso/musicas/tags.json", DIVISAO_REPO = "progresso/musicas/divisao-tags.json";
async function folhaDivisao() {
  const D = await import("../dados.js");
  const comToken = D.temToken();
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Dividir as tags com o Claude</h3>`;
  const { fechar } = folha(box);
  box.append(
    opcao(comToken ? "Enviar as tags ao Claude" : "Copiar as tags (para colar na conversa)", async () => {
      fechar();
      const txt = JSON.stringify(await B.exportarTags());
      if (comToken) {
        try {
          const a = await D.lerArquivoRepo(TAGS_REPO).catch(() => null);
          const r = await D.gravarArquivoRepo(TAGS_REPO, txt, a?.sha, "Músicas: tags e grupos para a divisão");
          if (r.conflito) throw new Error("conflito, tente de novo");
          toast("Enviadas. Avise o Claude na conversa.", 3500); return;
        } catch (e) { toast(`Não consegui enviar (${e.message}); copiei o texto.`, 4000); }
      }
      try { await navigator.clipboard.writeText(txt); toast("Copiado: cole na conversa com o Claude.", 3500); } catch { toast("Não consegui copiar.", 2500); }
    }),
  );
  if (comToken) box.append(opcao("Aplicar a divisão do Claude", async () => {
    fechar();
    let div;
    try { const a = await D.lerArquivoRepo(DIVISAO_REPO); if (!a) { toast("O Claude ainda não mandou a divisão.", 3000); return; } div = JSON.parse(a.texto); }
    catch (e) { toast(`Não consegui ler a divisão: ${e.message}`, 4000); return; }
    await confirmarDivisao(div);
  }));
  box.append(opcao("Colar uma divisão", async () => {
    fechar();
    const v = await formulario({ titulo: "Colar a divisão", campos: [{ id: "txt", rotulo: "Texto do Claude", tipo: "textarea" }], botoes: [{ texto: "Ver o que muda", acao: "ver" }] });
    if (!v?.txt) return;
    let div; try { div = JSON.parse(String(v.txt).replace(/^[^{]*/, "").replace(/[^}]*$/, "")); } catch { toast("Não é o texto da divisão.", 3000); return; }
    await confirmarDivisao(div);
  }));
}
async function confirmarDivisao(div) {
  let p;
  try { p = await B.aplicarDivisao(div, { iconesValidos: ICONES_GRUPO }); } catch (e) { toast(e.message, 4000); return; }
  if (!p.novos.length && !p.mover.length && !p.icones.length) { toast(`Nada a mudar${p.naoAchadas.length ? ` (${p.naoAchadas.length} tags não achadas)` : ""}.`, 3000); return; }
  const porGrupo = new Map(); for (const [, g] of p.mover) porGrupo.set(g, (porGrupo.get(g) || 0) + 1);
  const linhas = [
    p.novos.length ? `Grupos novos: ${p.novos.join(", ")}` : "",
    p.mover.length ? `${p.mover.length} tags mudam de grupo: ${[...porGrupo].map(([g, n]) => `${g} (${n})`).join(", ")}` : "",
    p.naoAchadas.length ? `Não achadas (ficam como estão): ${p.naoAchadas.slice(0, 8).join(", ")}${p.naoAchadas.length > 8 ? "…" : ""}` : "",
  ].filter(Boolean);
  const ok = await modal({ titulo: "Aplicar a divisão?", html: linhas.map(l => `<p>${escapar(l)}</p>`).join(""), botoes: [{ texto: "Aplicar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
  if (!ok) return;
  await B.aplicarDivisao(div, { aplicar: true, iconesValidos: ICONES_GRUPO });
  toast("Pronto: tags divididas.", 2500);
  desenhar(true);
}
function menuCategoria(c, t) {
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit"></h3>`; box.querySelector("h3").textContent = c.nome;
  const { fechar } = folha(box);
  box.append(
    opcao("Ícone…", () => { fechar(); escolherIcone(c); }),
    opcao("Trazer tags para cá", () => { fechar(); trazerParaCategoria(c.nome, t); }),
  );
  if (c.fixa) return;
  box.append(
    opcao("Renomear o grupo", async () => { fechar(); const n = await pedirNomeCategoria(c.nome); if (n) { try { await B.renomearCategoria(c.nome, n); } catch (e) { toast(e.message); } desenhar(true); } }),
    opcao("Apagar o grupo", async () => {
      fechar();
      const v = await modal({ titulo: `Apagar o grupo ${c.nome}?`, texto: "As tags continuam nas músicas e vão para Outras.", botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
      if (v) { await B.apagarCategoria(c.nome); desenhar(true); }
    }, true),
  );
}
/** Marcar várias tags de uma vez para levar a um grupo (as que estão em outro grupo também podem vir). */
function trazerParaCategoria(cat, t) {
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Tags em ${escapar(cat)}</h3>`;
  const { fechar } = folha(box, { classe: "alta" });
  const sel = new Set(t.grupos.filter(g => g.categoria && normTag(g.categoria) === normTag(cat)).map(g => g.nome)), antes = new Set(sel);
  const alvo = document.createElement("div"); box.append(alvo);
  const pintar = () => chipsDeTags(alvo, t, {
    classe: (n) => (sel.has(n) ? "on" : ""),
    aoTocar: (n) => { if (sel.has(n)) sel.delete(n); else sel.add(n); pintar(); },
    aoNova: async () => { const n = await pedirNomeTag("grupo", "", cat); if (n) { fechar(); desenhar(true); } },
  });
  pintar();
  const ok = document.createElement("button"); ok.className = "botao"; ok.textContent = "Salvar";
  ok.onclick = async () => {
    fechar();
    const poe = [...sel].filter(n => !antes.has(n)), tira = [...antes].filter(n => !sel.has(n));
    const sumiram = [...(poe.length ? await B.moverParaCategoria(poe, cat) : []), ...(tira.length ? await B.moverParaCategoria(tira, null) : [])];
    avisarGruposApagados(sumiram);
    desenhar(true);
  };
  box.append(ok);
}

async function telaTag(tela, nome, tipo) {
  const fs = await B.faixasComTag(nome);
  const fixa = tipo === "versao" && versoesDeTag().find(v => normTag(v.nome) === normTag(nome))?.fixa;
  const cat = tipo === "grupo" ? lembrarIcones(await B.tagsInternas()).grupos.find(g => normTag(g.nome) === normTag(nome))?.categoria : null;
  cabecalho(tela, {
    titulo: nome, voltar: () => { sub = null; aba = "tags"; desenhar(); }, lista: fs,
    sub: `${fs.length} ${fs.length === 1 ? "música" : "músicas"}${cat ? ` · ${escapar(cat)}` : ""}`,
    menu: fixa ? null : () => menuTag(nome, tipo),
  });
  if (tipo === "grupo") {
    const mv = document.createElement("button"); mv.className = "mu-pilula mu-editar-regras"; mv.innerHTML = `${cat ? iconeCategoria(cat) : I.etiqueta}<span>${cat ? escapar(cat) : "Outras"}</span>`;
    mv.onclick = () => escolherCategoria([nome], cat);
    const b = document.createElement("button"); b.className = "mu-pilula mu-editar-regras"; b.innerHTML = `${I.mais2}<span>Pôr ou tirar músicas</span>`;
    b.onclick = async () => {
      const antes = new Set(fs.map(f => f.id));
      const r = await escolherMusicas({ titulo: `Músicas com ${nome}`, marcadas: antes });
      if (!r) return;
      const poe = [...r].filter(x => !antes.has(x)), tira = [...antes].filter(x => !r.has(x));
      const n = (await B.marcarTag(poe, nome, true)) + (await B.marcarTag(tira, nome, false));
      const extra = n - poe.length - tira.length;
      if (n) toast(`Pronto${extra > 0 ? ` (com ${extra} ${extra === 1 ? "versão" : "versões"} junto)` : ""}. A tag vai para ${n === 1 ? "o arquivo" : `os ${n} arquivos`} aos poucos.`);
      desenhar(true);
    };
    const linhaB = document.createElement("div"); linhaB.className = "mu-tag-acoes"; linhaB.append(b, mv); tela.append(linhaB);
    if (!fs.length) tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nenhuma música com esta tag ainda.</p>`);
  }
  lista(tela, fs, { tag: { nome, tipo } });
}
function menuTag(nome, tipo) {
  const box = document.createElement("div");
  box.insertAdjacentHTML("beforeend", `<h3 class="mu-folha-tit"></h3>`); box.querySelector("h3").textContent = nome;
  const { fechar } = folha(box);
  if (tipo === "grupo") box.append(opcao("Mover para…", async () => { fechar(); const t = await B.tagsInternas(); escolherCategoria([nome], t.grupos.find(g => normTag(g.nome) === normTag(nome))?.categoria); }));
  box.append(
    opcao("Renomear", async () => { fechar(); const n = await pedirNomeTag(tipo, nome); if (n && n !== nome) { await B.renomearTag(nome, n, tipo); sub = { tipo: "tag", id: n, tipoTag: tipo }; desenhar(); } }),
    opcao("Apagar a tag", async () => {
      fechar();
      const v = await modal({ titulo: `Apagar ${nome}?`, texto: tipo === "versao" ? "Os títulos não mudam; só a tag deixa de existir." : "As músicas continuam na biblioteca; a tag sai delas (e dos arquivos).", botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
      if (v) { avisarGruposApagados(await B.apagarTag(nome, tipo)); sub = null; aba = "tags"; desenhar(); }
    }, true),
  );
}
/** As tags de uma música: as de versão (pelo título) e as suas, para ligar e desligar. */
async function folhaTags(f) {
  const box = document.createElement("div");
  const { fechar } = folha(box);
  const sel = new Set(f.tags || []);
  const pintar = async () => {
    const t = await B.tagsInternas(), vs = tagsDaFaixa(f).versoes;
    const fam = await B.familiaDe(f);
    box.innerHTML = `<h3 class="mu-folha-tit">Tags internas de “${escapar(f.titulo)}”</h3>${vs.length ? `<p class="mu-dica mu-dica-curta">Pelo título: ${vs.map(escapar).join(", ")}</p>` : ""}`;
    const g = document.createElement("div"); box.append(g);
    const tem = (nome) => [...sel].find(x => normTag(x) === normTag(nome));
    chipsDeTags(g, t, {
      classe: (nome) => (tem(nome) ? "on" : ""), extras: [...sel],
      aoTocar: async (nome) => { const ja = tem(nome); if (ja) sel.delete(ja); else sel.add(nome); avisarVersoes(await B.definirTags(f.id, [...sel])); f.tags = [...sel]; pintar(); },
      aoNova: async () => { const nome = await pedirNomeTag(); if (nome) { sel.add(nome); avisarVersoes(await B.definirTags(f.id, [...sel])); f.tags = [...sel]; pintar(); } },
    });
    if (fam.length) box.insertAdjacentHTML("beforeend", `<p class="mu-dica mu-dica-curta mu-familia">${I.trocar}<span>+ ${fam.length === 1 ? "1 versão" : `${fam.length} versões`}</span></p>`);
    const ok = document.createElement("button"); ok.className = "botao"; ok.textContent = "Pronto"; ok.onclick = () => { fechar(); desenhar(true); if (estado.id === f.id && !$(".mu-tocando").hidden) desenharTocando(); };
    box.append(ok);
  };
  pintar();
}

/** Escolher várias músicas (com busca). Devolve o conjunto de ids marcados, ou null se cancelar. */
function escolherMusicas({ titulo, marcadas = new Set(), botao = "Salvar" }) {
  return new Promise(async (ok) => {
    const todas = (await B.listaFaixas()).sort(B.porTitulo), sel = new Set(marcadas);
    const box = document.createElement("div"); box.className = "mu-escolher";
    box.innerHTML = `<h3 class="mu-folha-tit"></h3><div class="mu-tags-busca"><input type="search" placeholder="Buscar música ou artista" aria-label="Buscar"></div>
      <label class="mu-esc-so"><input type="checkbox"> Só as marcadas</label><div class="mu-esc-lista"></div>
      <div class="mu-ed-acoes mu-esc-acoes"><button class="botao secundario" data-a="cancelar">Cancelar</button><button class="botao" data-a="ok"></button></div>`;
    box.querySelector("h3").textContent = titulo;
    const { fechar } = folha(box, { classe: "alta" });
    const fundo = box.closest(".mu-folha-fundo");
    let feito = false;
    const fim = (v) => { if (feito) return; feito = true; fechar(); ok(v); };
    fundo.onclick = (e) => { if (e.target === fundo) fim(null); };
    const l = box.querySelector(".mu-esc-lista"), q = box.querySelector("input[type=search]"), so = box.querySelector(".mu-esc-so input"), bOk = box.querySelector('[data-a="ok"]');
    const pintarB = () => { bOk.textContent = `${botao} (${sel.size})`; };
    const norm = (s) => normTag(s);
    const desenharL = () => {
      const t = norm(q.value);
      const fs = todas.filter(f => (!so.checked || sel.has(f.id)) && (!t || norm(f.titulo).includes(t) || norm(f.artista).includes(t)));
      fs.sort((a, b) => sel.has(b.id) - sel.has(a.id));
      l.innerHTML = "";
      for (const f of fs.slice(0, 200)) {
        const el = document.createElement("label"); el.className = "mu-esc-item";
        el.innerHTML = `<input type="checkbox" ${sel.has(f.id) ? "checked" : ""}>`;
        el.append(capa(f));
        el.insertAdjacentHTML("beforeend", `<span><b>${escapar(f.titulo)}</b><small>${escapar(f.artista)}</small></span>`);
        el.querySelector("input").onchange = (e) => { if (e.target.checked) sel.add(f.id); else sel.delete(f.id); pintarB(); };
        l.append(el);
      }
      if (fs.length > 200) l.insertAdjacentHTML("beforeend", `<p class="mu-dica">Mais ${fs.length - 200}: use a busca para achar.</p>`);
      if (!fs.length) l.innerHTML = `<p class="mu-dica">Nada encontrado.</p>`;
    };
    q.oninput = desenharL; so.onchange = desenharL;
    box.querySelector('[data-a="cancelar"]').onclick = () => fim(null);
    bOk.onclick = () => fim(sel);
    pintarB(); desenharL();
  });
}

// ---------- playlists inteligentes: editor de regras ----------
const rotEstrelas = (n) => `${String(n / 2).replace(".", ",")} ★`;
async function editarInteligente(pl = null, modelo = null) {
  const p = pl ? JSON.parse(JSON.stringify({ ...pl, faixas: [] }))
    : { nome: modelo?.nome || "", tipo: "inteligente", regras: modelo ? JSON.parse(JSON.stringify(modelo.regras)) : { modo: "todas", incluir: [IN.novaRegra("estrelas")], excluir: [] }, ordem: modelo?.ordem || "titulo", limite: modelo?.limite || 0, limiteTipo: "musicas", fora: [] };
  p.regras.incluir ||= []; p.regras.excluir ||= [];
  const tags = await B.tagsInternas(), als = (await B.albuns()).filter(a => a.id !== p.id);
  await prepararPrevisoes();
  const box = document.createElement("div"); box.className = "mu-regras";
  box.innerHTML = `<h3 class="mu-folha-tit">${pl ? "Editar a playlist inteligente" : "Nova playlist inteligente"}</h3>
    <label class="mu-campo"><span>Nome</span><input type="text" class="mu-reg-nome" data-teclado="texto" aria-label="Nome da playlist"></label>
    <div class="mu-reg-cab"><span>Entram as músicas que atendem a</span><select class="mu-reg-modo" aria-label="Como juntar as regras"><option value="todas">todas as regras</option><option value="qualquer">qualquer uma das regras</option></select></div>
    <div class="mu-reg-lista" data-l="incluir"></div>
    <button class="mu-pilula" data-mais="incluir">${I.mais2}<span>Regra</span></button>
    <div class="mu-reg-cab exc"><span>E saem as que (basta uma):</span></div>
    <div class="mu-reg-lista" data-l="excluir"></div>
    <button class="mu-pilula" data-mais="excluir">${I.mais2}<span>Exclusão</span></button>
    <div class="mu-reg-extra">
      <label class="mu-campo"><span>Ordem</span><select class="mu-reg-ordem">${Object.entries(IN.ORDENS_INTELIGENTE).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></label>
      <label class="mu-campo"><span>Limite</span><span class="mu-reg-lim"><select class="mu-reg-limtipo"><option value="0">Sem limite</option><option value="musicas">Músicas</option><option value="minutos">Minutos</option></select><input type="text" class="mu-reg-limn" data-teclado="num" data-max="4" aria-label="Limite"></span></label>
    </div>
    <p class="mu-reg-fora mu-dica" hidden></p>
    <div class="mu-reg-previa"></div>
    <div class="mu-ed-acoes"><button class="botao secundario" data-a="cancelar">Cancelar</button><button class="botao" data-a="salvar">${pl ? "Salvar" : "Criar"}</button></div>`;
  const { fechar } = folha(box, { classe: "alta" });
  const nome = box.querySelector(".mu-reg-nome"); nome.value = p.nome;
  nome.oninput = () => { p.nome = nome.value; };
  const modoSel = box.querySelector(".mu-reg-modo"); modoSel.value = p.regras.modo || "todas"; modoSel.onchange = () => { p.regras.modo = modoSel.value; previa(); };
  const ordemSel = box.querySelector(".mu-reg-ordem"); ordemSel.value = p.ordem || "titulo"; ordemSel.onchange = () => { p.ordem = ordemSel.value; previa(); };
  const limT = box.querySelector(".mu-reg-limtipo"), limN = box.querySelector(".mu-reg-limn");
  limT.value = p.limite > 0 ? p.limiteTipo || "musicas" : "0"; limN.value = p.limite > 0 ? p.limite : "";
  const pintarLim = () => { limN.hidden = limT.value === "0"; };
  limT.onchange = () => { if (limT.value === "0") p.limite = 0; else { p.limiteTipo = limT.value; p.limite = +limN.value || (limT.value === "minutos" ? 60 : 50); limN.value = p.limite; } pintarLim(); previa(); };
  limN.oninput = () => { p.limite = +limN.value || 0; previa(); };
  pintarLim();
  const foraP = box.querySelector(".mu-reg-fora");
  const pintarFora = () => {
    foraP.hidden = !p.fora?.length;
    if (p.fora?.length) { foraP.innerHTML = `${p.fora.length} ${p.fora.length === 1 ? "música tirada" : "músicas tiradas"} à mão. <button class="link-mini">Devolver</button>`; foraP.querySelector("button").onclick = (e) => { e.preventDefault(); p.fora = []; pintarFora(); previa(); }; }
  };
  pintarFora();
  // uma linha de regra: campo, operação e valor (o valor muda conforme o campo)
  const linha = (r, onde) => {
    const el = document.createElement("div"); el.className = "mu-regra";
    const cSel = document.createElement("select"); cSel.setAttribute("aria-label", "Campo");
    cSel.innerHTML = Object.entries(IN.CAMPOS).map(([k, c]) => `<option value="${k}">${c.nome}</option>`).join("");
    cSel.value = r.campo;
    const oSel = document.createElement("select"); oSel.setAttribute("aria-label", "Condição");
    const val = document.createElement("span"); val.className = "mu-regra-val";
    const rm = document.createElement("button"); rm.className = "mu-icone mu-regra-rm"; rm.innerHTML = I.fechar; rm.setAttribute("aria-label", "Tirar a regra");
    const pintarOps = () => { const c = IN.CAMPOS[r.campo]; oSel.innerHTML = Object.entries(c.ops).map(([k, n]) => `<option value="${k}">${n}</option>`).join(""); if (!c.ops[r.op]) r.op = Object.keys(c.ops)[0]; oSel.value = r.op; };
    const pintarVal = () => {
      const c = IN.CAMPOS[r.campo]; val.innerHTML = "";
      if (c.valor === "nenhum" || (r.campo === "estrelas" && r.op === "sem") || (r.campo === "ultimaVez" && r.op === "nunca")) return;
      let inp;
      if (c.valor === "estrelas") { inp = document.createElement("select"); inp.innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${rotEstrelas(i + 1)}</option>`).join(""); }
      else if (c.valor === "tag") {
        inp = document.createElement("select");
        const og = (rot, l) => (l.length ? `<optgroup label="${escapar(rot)}">${l.map(t => `<option>${escapar(t.nome)}</option>`).join("")}</optgroup>` : "");
        inp.innerHTML = og("Versões", tags.versoes) + tags.categorias.map(x => og(x.nome, x.tags)).join("") + og(tags.categorias.some(x => x.tags.length) ? "Sem grupo" : "Suas tags", tags.semCategoria);
        if (!r.valor) r.valor = tags.versoes[0]?.nome || "";
      }
      else if (c.valor === "clima") { inp = document.createElement("select"); inp.innerHTML = ["Animada", "Calma", "Melancólica", "Agressiva", "Dançante", "Romântica"].map(x => `<option>${x}</option>`).join(""); if (!r.valor) r.valor = "Calma"; }
      else if (c.valor === "grupoTag") { inp = document.createElement("select"); inp.innerHTML = tags.categorias.map(x => `<option>${escapar(x.nome)}</option>`).join(""); if (!r.valor) r.valor = tags.categorias[0]?.nome || ""; }
      else if (c.valor === "formato") { inp = document.createElement("select"); inp.innerHTML = IN.FORMATOS.map(x => `<option value="${x}">${x.toUpperCase()}</option>`).join(""); }
      else if (c.valor === "playlist") { inp = document.createElement("select"); inp.innerHTML = als.map(a => `<option value="${a.id}">${escapar(a.nome)}</option>`).join(""); if (!r.valor) r.valor = als[0]?.id || ""; }
      else {
        inp = document.createElement("input"); inp.type = "text";
        if (c.valor === "texto") { inp.dataset.teclado = "texto"; if (c.prever) inp.dataset.prever = c.prever; }
        else { inp.dataset.teclado = "num"; inp.dataset.max = "4"; }
        inp.setAttribute("aria-label", c.nome);
      }
      inp.value = r.valor ?? "";
      inp.oninput = inp.onchange = () => { r.valor = inp.tagName === "SELECT" && c.valor === "estrelas" ? +inp.value : inp.value; previa(); };
      if (inp.tagName === "SELECT") r.valor = c.valor === "estrelas" ? +inp.value : inp.value;
      val.append(inp);
      if (c.valor === "dias") val.insertAdjacentHTML("beforeend", "<small>dias</small>");
      tecl?.preparar(val);
    };
    cSel.onchange = () => { const nr = IN.novaRegra(cSel.value); Object.assign(r, nr); pintarOps(); pintarVal(); previa(); };
    oSel.onchange = () => { r.op = oSel.value; pintarVal(); previa(); };
    rm.onclick = (e) => { e.preventDefault(); p.regras[onde] = p.regras[onde].filter(x => x !== r); el.remove(); previa(); };
    pintarOps(); pintarVal();
    el.append(cSel, oSel, val, rm);
    return el;
  };
  const listas = { incluir: box.querySelector('[data-l="incluir"]'), excluir: box.querySelector('[data-l="excluir"]') };
  for (const onde of ["incluir", "excluir"]) {
    p.regras[onde].forEach(r => listas[onde].append(linha(r, onde)));
    box.querySelector(`[data-mais="${onde}"]`).onclick = (e) => { e.preventDefault(); const r = IN.novaRegra(onde === "excluir" ? "tag" : "estrelas"); if (onde === "excluir") r.op = "tem"; p.regras[onde].push(r); listas[onde].append(linha(r, onde)); previa(); };
  }
  const pv = box.querySelector(".mu-reg-previa");
  let t = null;
  const previa = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const fs = await B.previaInteligente(p), min = Math.round(fs.reduce((s2, f) => s2 + (f.duracao || 0), 0) / 60000);
      pv.innerHTML = `<b>${fs.length} ${fs.length === 1 ? "música" : "músicas"}</b> · ${min} min${fs.length ? `<small>${fs.slice(0, 4).map(f => escapar(f.titulo)).join(", ")}${fs.length > 4 ? "…" : ""}</small>` : ""}`;
    }, 200);
  };
  previa();
  box.querySelector('[data-a="cancelar"]').onclick = () => { tecl?.fechar(); fechar(); };
  box.querySelector('[data-a="salvar"]').onclick = async () => {
    tecl?.fechar();
    p.nome = nome.value.trim();
    if (!p.nome) { toast("Dê um nome à playlist."); nome.focus(); return; }
    p.regras.incluir = p.regras.incluir.filter(r => IN.CAMPOS[r.campo]);
    let a;
    if (pl) a = await B.salvarPlaylist(p);
    else { const { nome: n, ...resto } = p; a = await B.criarAlbum(n, resto); }
    fechar(); aba = "albuns"; sub = { tipo: "album", id: a.id }; desenhar();
    toast(pl ? "Regras salvas." : `Playlist ${a.nome} criada.`);
  };
  tecl?.configurar({ prever: preverMusicas, sistema: true });
  tecl?.preparar(box);
}

// ---------- desambiguação ----------
/** "Reavaliar as duplicatas" (pedido do Alediov, 04/11/2026): as marcadas como Nenhuma voltam (com "Antes: Nenhuma"),
 *  a pasta é lida de novo e a busca roda na biblioteca inteira; abre o Desambiguar. */
function botaoReavaliarDuplicatas(nNenhuma) {
  return opcao(`Reavaliar as duplicatas${nNenhuma ? ` (${nNenhuma} marcadas como Nenhuma)` : ""}`, async () => {
    if (nNenhuma) {
      const v = await modal({ titulo: "Reavaliar as duplicatas?", texto: `As ${nNenhuma === 1 ? "1 marcada" : `${nNenhuma} marcadas`} como Nenhuma voltam para você escolher de novo, e a biblioteca inteira é lida e conferida outra vez.`, botoes: [{ texto: "Reavaliar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
      if (!v) return;
    }
    const voltaram = await B.reavaliarDuplicatas();
    await sincronizar(true);
    const n = (await B.duplicatas()).length;
    toast(n ? `${n} ${n === 1 ? "possível duplicata" : "possíveis duplicatas"}${voltaram ? ` (com as ${voltaram} de antes)` : ""}.` : "Nenhuma duplicata na biblioteca.");
    aba = "editar"; sub = { tipo: "desambiguar" }; desenhar();
  });
}

async function telaDesambiguar(telaRaiz) {
  const tela = telaRaiz;
  const sd = await B.versoesSemDono(), rep = await B.titulosRepetidos(), dup = await B.duplicatas(), ftL = await B.feats();
  cabecalho(tela, { titulo: "Desambiguar", voltar: () => { sub = null; desenhar(); }, acoes: false, sub: "Músicas de mesmo nome, para não confundir (nem a versão Sped Up de uma com a de outra), e o mesmo áudio em dois arquivos." });
  const nNenhuma = await B.quantasNaoDuplicatas();
  if (!sd.length && !rep.length && !dup.length && !ftL.length) { tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nada para desambiguar.</p>`); tela.append(botaoReavaliarDuplicatas(nNenhuma)); return; }
  tela.append(botaoReavaliarDuplicatas(nNenhuma));
  // menus sanfona: aberto por padrão só o primeiro que tem o que fazer
  const primeiro = dup.length ? "dup" : sd.length ? "semdono" : rep.length ? "rep" : "feat";
  if (dup.length) {
    const { el: secEl, corpo: tela } = sanfona({ id: "desamb.dup", titulo: "Possíveis duplicatas", icone: I.trocar, resumo: "Mesmo título e a mesma duração", conta: dup.length, alerta: true, aberta: primeiro === "dup" });
    telaRaiz.append(secEl);
    const mb = (n) => `${String((n / 1048576).toFixed(1)).replace(".", ",")} MB`;
    for (const g of dup) {
      const el = document.createElement("div"); el.className = "mu-dup";
      el.insertAdjacentHTML("beforeend", `<b class="mu-dup-tit">${escapar(g.titulo)}</b>${g.antes ? `<small class="mu-dup-antes">Antes: Nenhuma</small>` : ""}`);
      const botoesFicar = [];
      for (const f of g.faixas) {
        const l = document.createElement("div"); l.className = "mu-dup-item";
        l.append(capa(f));
        l.insertAdjacentHTML("beforeend", `<span><b>${escapar(f.artista)} · ${tempo(f.duracao)}</b><small>${escapar(f.caminho)}</small><small>${(f.formato || "").toUpperCase()}${f.bitrate ? ` ${Math.round(f.bitrate / 1000)} kbps` : ""}${f.tamanho ? ` · ${mb(f.tamanho)}` : ""}${f.nota ? ` · ${textoNota(f.nota)}` : ""}${f.tocadas ? ` · ${f.tocadas}×` : ""}</small></span>`);
        const b = document.createElement("button"); b.className = "botao secundario mini mu-dup-ficar"; b.textContent = "Ficar com esta"; b.hidden = true;
        b.onclick = async () => {
          if (g.faixas.some(x => x.id === estado.id)) { toast("Uma delas está tocando: passe para outra música e tente de novo."); return; }
          const v = await modal({ titulo: "Ficar com esta?", texto: `${g.faixas.length - 1 === 1 ? "A outra cópia é apagada" : `As outras ${g.faixas.length - 1} cópias são apagadas`} do cartão de memória. As estrelas, o coração, as tags, as contagens e as playlists passam para esta.`, botoes: [{ texto: "Ficar com esta", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
          if (!v) return;
          try { await B.ficarCom(g, f.id); toast("Pronto."); desenhar(true); } catch (e) { toast(`Não consegui: ${e.message}`, 4500); }
        };
        botoesFicar.push(b);
        l.append(b); el.append(l);
      }
      // três escolhas (pedido do Alediov, 02/11/2026): Duplicata (fica com uma), Feat. (a mesma música, uma cópia na
      // pasta de cada artista) e Nenhuma (não são a mesma música)
      const artistasDif = new Set(g.faixas.map(f => B.normArtista(f.artista))).size > 1;
      const esc = document.createElement("div"); esc.className = "mu-dup-escolha"; esc.setAttribute("role", "group"); esc.setAttribute("aria-label", "O que são");
      const opc = (txt, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = txt; b.onclick = fn; esc.append(b); return b; };
      const bDup = opc("Duplicata", () => {
        const ligado = !bDup.classList.contains("on");
        bDup.classList.toggle("on", ligado); bDup.setAttribute("aria-pressed", String(ligado));
        botoesFicar.forEach(b => { b.hidden = !ligado; });
        el.classList.toggle("escolhendo", ligado);
        if (ligado) toast("Toque em “Ficar com esta” na cópia que fica.");
      });
      bDup.setAttribute("aria-pressed", "false");
      if (artistasDif) {
        opc("Feat.", async (ev) => {
          ev.currentTarget.disabled = true;
          try {
            await B.ligarFeat(g);
            const nomes = [...new Set(g.faixas.map(f => f.artista))];
            toast(`Ligadas como feat. (${nomes.join(" & ")}): estrelas, coração e tags passam de uma para a outra.`, 4500);
            desenhar(true);
          } catch (e) { toast(`Não consegui: ${e.message}`, 4500); ev.currentTarget.disabled = false; }
        }, "feat");
      }
      opc("Nenhuma", async () => { await B.naoSaoDuplicatas(g); desenhar(true); });
      el.append(esc); tela.append(el);
    }
  }
  if (sd.length) {
    const { el: secEl, corpo: tela } = sanfona({ id: "desamb.semdono", titulo: "Versões sem o artista original", icone: I.etiqueta, resumo: "De quem é cada versão", conta: sd.length, alerta: true, aberta: primeiro === "semdono" });
    telaRaiz.append(secEl);
    for (const { versao: g, candidatos } of sd) {
      const el = document.createElement("div"); el.className = "mu-desamb";
      el.append(capa(g));
      el.insertAdjacentHTML("beforeend", `<span class="mu-desamb-tx"><b>${escapar(g.titulo)}</b><small>${escapar(g.pasta || g.artista)}</small></span>`);
      const bts = document.createElement("div"); bts.className = "mu-chips";
      for (const o of [...new Map(candidatos.map(o => [o.artista, o])).values()]) {
        const b = document.createElement("button"); b.textContent = `De ${o.artista}`;
        b.onclick = async () => {
          if (estado.id === g.id) { toast("Essa versão está tocando: passe para a próxima e tente de novo."); return; }
          b.disabled = true;
          try { const n = await B.atribuirVersao(g, o); toast(`Agora é "${n.titulo}".`); desenhar(true); } catch (e) { toast(`Não consegui renomear: ${e.message}`, 4500); b.disabled = false; }
        };
        bts.append(b);
      }
      el.append(bts); tela.append(el);
    }
  }
  if (rep.length) {
    const { el: secEl, corpo: tela } = sanfona({ id: "desamb.rep", titulo: "Títulos repetidos no mesmo artista", icone: I.nota, resumo: "Diferencie entre parênteses", conta: rep.length, alerta: true, aberta: primeiro === "rep" });
    telaRaiz.append(secEl);
    for (const r of rep) {
      tela.insertAdjacentHTML("beforeend", `<h4 class="mu-sub-secao">${escapar(r.artista)} · ${escapar(r.titulo)}</h4>`);
      const box = document.createElement("div"); box.className = "mu-lista";
      for (const f of r.faixas) {
        const el = linhaFaixa(f, r.faixas, 0);
        el.querySelector("small").insertAdjacentHTML("beforeend", ` · ${escapar(f.caminho.split("/").pop())}`);
        el.onclick = () => abrirEditorTags(f);
        box.append(el);
      }
      tela.append(box);
    }
  }
  if (ftL.length) {
    const { el: secEl, corpo: tela } = sanfona({ id: "desamb.feat", titulo: "Feat.", icone: I.microfone, resumo: "Uma cópia em cada artista", conta: ftL.length, aberta: primeiro === "feat" });
    secEl.dataset.secao = "feat";
    telaRaiz.append(secEl);
    for (const g of ftL) {
      const el = document.createElement("div"); el.className = "mu-dup mu-feat-grupo";
      el.insertAdjacentHTML("beforeend", `<b class="mu-dup-tit">${escapar(g.titulo)}</b><small class="mu-feat-quem">${g.faixas.map(f => escapar(f.artista)).join(" & ")}</small>`);
      const box = document.createElement("div"); box.className = "mu-lista";
      for (const f of g.faixas) box.append(linhaFaixa(f, g.faixas, g.faixas.indexOf(f), { semFalta: true }));
      el.append(box);
      const d = document.createElement("button"); d.className = "link-mini"; d.textContent = "Desfazer";
      d.onclick = async () => { await B.desfazerFeat(g.feat); toast("Desfeito: cada cópia volta a ter as suas estrelas e tags daqui em diante."); desenhar(true); };
      el.append(d); tela.append(el);
    }
  }
}


// ---------- seleção múltipla (segurar o dedo numa música) ----------
const selecao = new Map(); // id → faixa, na ordem em que foram marcadas
let listaSel = [], ctxSel = {};
function marcar(f, lista, ctx = {}) {
  listaSel = lista; ctxSel = ctx;
  if (selecao.has(f.id)) selecao.delete(f.id); else selecao.set(f.id, f);
  pintarSelecao();
}
function sairSelecao() { selecao.clear(); pintarSelecao(); }
function pintarSelecao() {
  if (!raiz) return;
  const n = selecao.size;
  raiz.classList.toggle("selecionando", n > 0);
  raiz.querySelectorAll(".mu-tela .mu-faixa[data-id]").forEach(x => x.classList.toggle("sel", selecao.has(x.dataset.id)));
  let b = $(".mu-sel-barra");
  if (!n) { b?.remove(); return; }
  if (!b) {
    b = document.createElement("div"); b.className = "mu-sel-barra";
    b.innerHTML = `<div class="mu-sel-topo"><button class="mu-icone" data-s="sair" aria-label="Sair da seleção">${I.fechar}</button><b></b><button class="link-mini" data-s="todas"></button></div><div class="mu-sel-acoes"></div>`;
    raiz.append(b);
    b.onclick = (e) => { const x = e.target.closest("[data-s]"); if (x) acaoSelecao(x.dataset.s); };
  }
  b.querySelector("b").textContent = `${n} ${n === 1 ? "selecionada" : "selecionadas"}`;
  const todas = listaSel.length && listaSel.every(f => selecao.has(f.id));
  const bt = b.querySelector('[data-s="todas"]'); bt.textContent = todas ? "Desmarcar todas" : `Marcar todas (${listaSel.length})`; bt.dataset.s = todas ? "nenhuma" : "todas";
  const tirar = ctxSel.album ? `Tirar de ${ctxSel.album.nome}` : ctxSel.tag?.tipo === "grupo" ? `Tirar a tag` : "";
  b.querySelector(".mu-sel-acoes").innerHTML = [
    `<button class="mu-pilula" data-s="tocar">${I.play}<span>Tocar</span></button>`,
    `<button class="mu-pilula" data-s="seguir">${I.fila}<span>A seguir</span></button>`,
    `<button class="mu-pilula" data-s="fim"><span>Fim da fila</span></button>`,
    `<button class="mu-pilula" data-s="tags">${I.etiqueta}<span>Tags internas</span></button>`,
    `<button class="mu-pilula" data-s="playlist">${I.mais2}<span>Playlist</span></button>`,
    tirar ? `<button class="mu-pilula perigo" data-s="tirar"><span>${escapar(tirar)}</span></button>` : "",
  ].join("");
}
async function acaoSelecao(a) {
  const fs = [...selecao.values()];
  if (a === "sair") return sairSelecao();
  if (a === "todas") { for (const f of listaSel) selecao.set(f.id, f); return pintarSelecao(); }
  if (a === "nenhuma") return sairSelecao();
  if (a === "tocar") { sairSelecao(); return tocarLista(fs, 0, { aleatorio: false }); }
  if (a === "seguir" || a === "fim") { sairSelecao(); return enfileirar(fs, a === "fim"); }
  if (a === "playlist") return escolherAlbum(fs);
  if (a === "tags") return folhaTagsVarias(fs);
  if (a === "tirar") {
    const ids = fs.map(f => f.id);
    if (ctxSel.album) { await B.tirarDoAlbum(ctxSel.album.id, ids); if (ctxSel.album.id === B.ESTUDOS) reavaliarMusica(); }
    else if (ctxSel.tag) await B.marcarTag(ids, ctxSel.tag.nome, false);
    toast(`${ids.length} ${ids.length === 1 ? "saiu" : "saíram"}.`);
    sairSelecao(); desenhar(true);
  }
}
/** Tags internas de várias músicas: tocar numa tag põe em todas (ou tira de todas, se todas já têm). */
async function folhaTagsVarias(fs) {
  const box = document.createElement("div");
  const { fechar } = folha(box);
  const pintar = async () => {
    const t = await B.tagsInternas(), m = await B.faixas();
    const atuais = fs.map(f => m.get(f.id) || f);
    box.innerHTML = `<h3 class="mu-folha-tit">Tags internas de ${fs.length} ${fs.length === 1 ? "música" : "músicas"}</h3>`;
    const g = document.createElement("div"); box.append(g);
    const quantas = (nome) => atuais.filter(f => (f.tags || []).some(x => normTag(x) === normTag(nome))).length;
    chipsDeTags(g, t, {
      classe: (nome) => { const q = quantas(nome); return q === atuais.length ? "on" : q ? "parcial" : ""; },
      rotulo: (nome) => { const q = quantas(nome); return q && q < atuais.length ? `${nome} · ${q}` : nome; },
      aoTocar: async (nome) => { await B.marcarTag(atuais.map(f => f.id), nome, quantas(nome) !== atuais.length); pintar(); },
      aoNova: async () => { const nome = await pedirNomeTag(); if (nome) { await B.marcarTag(atuais.map(f => f.id), nome, true); pintar(); } },
    });
    const ok = document.createElement("button"); ok.className = "botao"; ok.textContent = "Pronto";
    ok.onclick = () => { fechar(); sairSelecao(); desenhar(true); };
    box.append(ok);
  };
  pintar();
}

// ---------- timer, rádio e original ↔ Sped Up (tela Tocando) ----------
function folhaTimer() {
  const box = document.createElement("div");
  const resta = estado.timerFim ? estado.timerFim - Date.now() : 0;
  box.innerHTML = `<h3 class="mu-folha-tit">Timer</h3><p class="mu-dica mu-dica-curta">${estado.pararNoFim ? "Para no fim desta música." : resta > 0 ? `Para em ${Math.ceil(resta / 60000)} min.` : "Desligado."}</p>`;
  const { fechar } = folha(box);
  const por = async (ms, fim = false) => {
    fechar();
    try { const r = await motor.timer(ms, fim); Object.assign(estado, r || {}); atualizarEstado({ ...estado }); toast(fim ? "Para no fim desta música." : ms ? `Para em ${Math.round(ms / 60000)} min.` : "Timer desligado."); }
    catch (e) { toast(e.message); }
  };
  const g = document.createElement("div"); g.className = "mu-chips mu-timer-ops";
  for (const m of [15, 30, 45, 60, 90]) { const b = document.createElement("button"); b.textContent = `${m} min`; b.onclick = () => por(m * 60000); g.append(b); }
  box.append(g);
  box.append(opcao("No fim desta música", () => por(0, true)));
  if (resta > 0 || estado.pararNoFim) box.append(opcao("Desligar o timer", () => por(0, false), true));
}
async function alternarRadio(b) {
  cfgT = await B.definirTocador({ radio: !cfgT.radio });
  b?.classList.toggle("on", cfgT.radio);
  if (cfgT.radio) {
    await cmd("repetir", { valor: "nao" });
    await atualizarRadio(listaBase.length ? listaBase : filaAtual);
    toast("Rádio ligado: quando a fila acabar, seguem músicas parecidas (artista, tags, estrelas). O repetir fica desligado.", 4500);
  } else toast("Rádio desligado.");
}
async function trocarVersao(f, g) {
  const ms = (estado.posicao || 0) * ((g.duracao || 1) / (f.duracao || 1));
  try {
    const e = await motor.trocar(g, ms);
    for (const l of [filaAtual, listaBase]) { const i = l.findIndex(x => x.id === f.id); if (i >= 0) l[i] = g; }
    guardarFila();
    if (e) await atualizarEstado(e);
    toast(B.ehVersao(g) ? "Na Sped Up." : "Na original.");
  } catch (err) { toast(`Não consegui trocar: ${err.message}`); }
}

// ---------- versões com defeito (até a v0.2.6 o editor lia só o começo do arquivo) ----------
async function conferirVersoes(manual = false) {
  if (!motor.lerInicio) return;
  if (!manual && (await BD.lerCfg("conferiuVersoes")) === 2) return;
  let l;
  try { l = await B.versoesComDefeito(); } catch (e) { if (manual) toast(e.message); return; }
  await BD.gravarCfg("conferiuVersoes", 2);
  if (!l.length) { if (manual) toast("Nenhuma versão com defeito."); return; }
  const refazer = l.filter(x => x.original && B.ehVersao(x.faixa) && analisarTitulo(x.faixa.titulo).versoes.includes("Sped Up"));
  const outras = l.filter(x => !refazer.includes(x));
  const nomes = (xs) => xs.slice(0, 6).map(x => `“${x.faixa.titulo}”`).join(", ") + (xs.length > 6 ? "…" : "");
  const v = await modal({
    titulo: `${l.length === 1 ? "Uma versão saiu" : `${l.length} versões saíram`} com defeito`,
    texto: `Até a versão anterior, o editor lia só o começo do arquivo, então as versões feitas no app repetiam os primeiros ~40 segundos até o fim. Já está corrigido.${refazer.length ? ` Dá para refazer ${refazer.length === 1 ? "a Sped Up" : `as ${refazer.length} Sped Up`} agora (${nomes(refazer)}), mantendo estrelas, coração, tags, contagens e playlists.` : ""}${outras.length ? ` ${outras.length === 1 ? "Esta precisa" : "Estas precisam"} ser refeita${outras.length === 1 ? "" : "s"} à mão no editor, porque os ajustes não ficaram guardados${outras.some(x => !x.original) ? " ou a original não está mais na biblioteca" : ""}: ${nomes(outras)}.` : ""}`,
    botoes: refazer.length ? [{ texto: `Refazer ${refazer.length === 1 ? "agora" : `as ${refazer.length}`}`, valor: true }, { texto: "Depois", valor: false, classe: "secundario" }] : [{ texto: "Entendi", valor: false }],
  });
  if (v) refazerVersoes(refazer);
  else if (refazer.length) await BD.gravarCfg("conferiuVersoes", 1);
}
function refazerVersoes(lista) {
  for (const { faixa: v, original: o } of lista) {
    processando = processando.then(async () => {
      if (estado.id === v.id) { toast(`“${v.titulo}” está tocando; ficou para depois.`); return; }
      const antiga = { ...v }, pasta = v.caminho.split("/").slice(0, -1).join("/") || (await B.pastaVersoes());
      const arquivo = `${v.titulo.replace(/[\\/:*?"<>|]/g, "-")}.mp3`;
      await motor.apagarArquivo(v.id);
      await fazerVersao(o, ED.SPED_UP, v.titulo, pasta);
      await B.restaurarVersao(`${pasta}/${arquivo}`, antiga);
    }).catch(e => console.warn("Músicas: refazer versão", e));
  }
}

// ---------- volume igualado: mede aos poucos, com a tela das Músicas aberta ----------
async function medirVolumesAgora() {
  if (!cfgT.igualar) return;
  return B.medirVolumes((feitas, total) => { progVol = { feitas, total }; }, () => !!raiz?.isConnected).finally(() => { progVol = null; });
}
// ---------- gêneros e climas pelo som (genero.js): ouve aos poucos, com a tela das Músicas aberta ----------
// O andamento aparece em todo `.mu-gen-prog` na tela (Gêneros e climas, Ajustes).
function pintarProgGen() {
  const t = progGen && progGen.feitas < progGen.total ? `Ouvindo: ${progGen.feitas} de ${progGen.total}…` : "";
  raiz?.querySelectorAll(".mu-gen-prog").forEach(el => { if (t) { el.textContent = t; el.hidden = false; } });
}
function analisarGenerosAgora(forcar = false) {
  return B.analisarGeneros((feitas, total) => { progGen = { feitas, total }; pintarProgGen(); }, () => !!raiz?.isConnected, { forcar })
    .catch(e => { console.warn("Músicas: gêneros", e); toast(`O avaliador parou: ${e.message}`, 4500); })
    .finally(() => { progGen = null; if (raiz?.isConnected && (sub?.tipo === "generos" || aba === "tags")) desenhar(true); });
}
/** O botão "Ouvir agora" (pedido do Alediov, 02/11/2026: forçar a leitura do gênero): as que faltam, já. */
async function ouvirGenerosAgora() {
  if (B.analisandoGeneros()) { toast(progGen ? `Já estou ouvindo: ${progGen.feitas} de ${progGen.total}.` : "Já estou ouvindo."); return; }
  const n = (await B.semGenero()).length;
  if (!n) { toast("Todas já foram ouvidas. Para ouvir de novo: Reavaliar."); return; }
  toast(`Ouvindo ${n === 1 ? "1 música" : `${n} músicas`} (com as Músicas abertas).`);
  analisarGenerosAgora(true);
}
/** Reavaliar todas: o avaliador ouve de novo as originais (e as à parte); as suas correções ficam. */
async function reavaliarTodas() {
  const li = await B.lideresGenero(), n = [...li].filter(([id, x]) => x.lider === id).length;
  const v = await modal({ titulo: "Reavaliar todas?", texto: `${n} ${n === 1 ? "música" : "músicas"}, uns 2 s cada, com as Músicas abertas. As suas correções ficam.`, botoes: [{ texto: "Reavaliar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
  if (!v) return;
  if (B.analisandoGeneros()) { toast("Espere o avaliador terminar as que está ouvindo."); return; }
  await B.reavaliarGeneros();
  analisarGenerosAgora(true);
  desenhar(true);
}
/** Chips das versões: acesa = ouvida à parte (Remake e Acoustic por padrão); apagada = segue a original. */
function chipsAParte(cfgG) {
  const g = document.createElement("div"); g.className = "mu-chips mu-aparte";
  for (const v of versoesDeTag().map(x => x.nome)) {
    const b = document.createElement("button"); b.className = cfgG.aParte[v] ? "on" : ""; b.textContent = v;
    b.onclick = async (e) => {
      e.preventDefault();
      const ap = { ...cfgG.aParte, [v]: !cfgG.aParte[v] };
      Object.assign(cfgG, await B.definirCfgGeneros({ aParte: ap }));
      b.classList.toggle("on", !!cfgG.aParte[v]);
      await B.aplicarGeneros({ forcar: true });
      if (cfgG.aParte[v] && (await B.semGenero()).length) analisarGenerosAgora(true);
    };
    g.append(b);
  }
  return g;
}
const GRUPOS_G = ["Pop", "Rock", "Metal", "Electronic", "Rap", "R&B", "Chill", "Folk", "Classical", "Jazz", "Brazilian"];
const DESC_G = { Pop: "pop, indie pop", Rock: "rock, alternativo, punk", Metal: "metal, hard rock", Electronic: "eletrônica, house, dance", Rap: "hip-hop, rap, trap", "R&B": "R&B, soul, funk", Chill: "lo-fi, calma, ambiente", Folk: "acústica, folk, country", Classical: "orquestral, clássica, trilhas", Jazz: "jazz, blues", Brazilian: "MPB, sertanejo, funk, samba…" };
/** Corrigir o grupo de uma música (vale para as versões que a seguem e ensina as parecidas); numa versão, ouvir à
 *  parte ou seguir a original. */
async function folhaGenero(f) {
  const lider = await B.liderDe(f), versao = tiposDaFaixa(f).length > 0 || f.generoAParte != null || !!lider;
  const box = document.createElement("div");
  box.innerHTML = `<h3 class="mu-folha-tit">Gênero de “${escapar(f.titulo)}”</h3>
    <p class="mu-dica mu-dica-curta">${lider ? `Segue “${escapar(lider.titulo)}”` : f.generoManual ? "Escolhido por você" : f.som ? `Pelo som${f.generoConf != null ? ` · ${Math.round(f.generoConf * 100)}%` : ""}` : "Ainda não ouvida"}${f.clima?.length ? ` · ${f.clima.map(escapar).join(", ")}` : ""}</p>`;
  const { fechar } = folha(box);
  const g = document.createElement("div"); g.className = "mu-chips mu-gen-chips";
  for (const n of GRUPOS_G) {
    const b = document.createElement("button"); b.className = f.genero === n ? "on" : ""; b.innerHTML = `${escapar(n)}<small>${escapar(DESC_G[n])}</small>`;
    b.onclick = async () => { fechar(); await B.definirGenero(f.id, n); toast(`${f.titulo}: ${n}.`); desenhar(true); if (estado.id === f.id && !$(".mu-tocando").hidden) desenharTocando(); };
    g.append(b);
  }
  box.append(g);
  if (f.generoManual) box.append(opcao("Voltar ao automático", async () => { fechar(); await B.definirGenero(f.id, null); desenhar(true); }));
  if (versao) {
    if (lider) box.append(opcao("Ouvir esta à parte", async () => { fechar(); await B.definirAParte(f.id, true); analisarGenerosAgora(true); desenhar(true); }));
    else box.append(opcao("Seguir a original", async () => { fechar(); await B.definirAParte(f.id, false); desenhar(true); }));
    if (f.generoAParte != null) box.append(opcao("Pela regra do tipo de versão", async () => { fechar(); await B.definirAParte(f.id, null); analisarGenerosAgora(true); desenhar(true); }));
  }
  if (!lider) box.append(opcao("Reavaliar esta", async () => { fechar(); await B.reavaliarGeneros([f.id]); toast("Vai ser ouvida de novo."); ouvirGenerosAgora(); }));
}

// ---------- rotinas por horário ----------
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Faixa no alto quando há uma rotina para este horário: um toque toca a playlist dela. */
async function faixaRotina(tela) {
  const r = await B.rotinaAgora(); if (!r) return;
  const pl = await B.album(r.playlist); if (!pl?.faixas.length) return;
  if (estado.querTocar && pl.faixas.includes(estado.id)) return;
  const c = document.createElement("div"); c.className = "mu-rotina";
  c.innerHTML = `${I.relogio}<span><small>${escapar(r.nome || "Rotina")} · até ${escapar(r.fim)}</small><b>${escapar(pl.nome)}</b></span>`;
  const b = document.createElement("button"); b.className = "botao mini"; b.innerHTML = `${I.play}<span>Tocar</span>`;
  b.onclick = () => tocarRotina(r);
  c.append(b); tela.append(c);
}
async function tocarRotina(r) {
  const fs = await B.faixasDoAlbum(r.playlist);
  if (!fs.length) { toast("A playlist da rotina está vazia."); return false; }
  await tocarLista(fs, r.aleatorio ? Math.floor(Math.random() * fs.length) : 0, { aleatorio: !!r.aleatorio });
  return true;
}
/** Play pelo widget com o tocador desligado: a rotina deste horário ou, sem ela, a última fila de onde parou. */
export async function tocarAoAbrir() {
  for (let i = 0; i < 40 && !raiz?.isConnected; i++) await new Promise(ok => setTimeout(ok, 100));
  const r = await B.rotinaAgora();
  if (r && (await tocarRotina(r))) { toast(`${r.nome || "Rotina"}: tocando.`); return; }
  const g = await BD.lerCfg("fila"), m = await B.faixas();
  const fs = (g?.ids || []).map(i => m.get(i)).filter(Boolean);
  if (!fs.length) return;
  filaAtual = fs; listaBase = (g.base || []).map(i => m.get(i)).filter(Boolean); aleatorio = !!g.aleatorio;
  const i = Math.max(0, fs.findIndex(f => f.id === g.atual));
  try { await atualizarEstado(await motor.tocar(fs, i, { aleatorio: false, repetir: cfgT.radio ? "nao" : "todas" })); if (cfgT.radio) atualizarRadio(listaBase); } catch (e) { toast(e.message); }
}
async function folhaRotinas() {
  const box = document.createElement("div");
  const { fechar } = folha(box, { classe: "alta" });
  const als = (await B.albuns()).filter(a => a.faixas.length || a.tipo === "inteligente");
  const pintar = async () => {
    const l = await B.rotinas();
    box.innerHTML = `<h3 class="mu-folha-tit">Rotinas por horário</h3>`;
    for (const r of l) {
      const el = document.createElement("button"); el.className = "mu-rotina-item";
      el.innerHTML = `${I.relogio}<span><b>${escapar(r.nome || "Rotina")}</b><small>${escapar(r.ini)}–${escapar(r.fim)} · ${(r.dias || []).length === 7 ? "todo dia" : (r.dias || []).map(d => DIAS_SEMANA[d]).join(", ")} · ${escapar(als.find(a => a.id === r.playlist)?.nome || "playlist apagada")}${r.aleatorio ? " · aleatório" : ""}</small></span>`;
      el.onclick = () => editarRotina(r, als, pintar);
      box.append(el);
    }
    const n = document.createElement("button"); n.className = "botao"; n.textContent = "Nova rotina";
    n.onclick = () => editarRotina(null, als, pintar);
    box.append(n);
  };
  pintar();
}
function editarRotina(r, als, aoSalvar) {
  const v = r ? { ...r, dias: [...(r.dias || [])] } : { id: `r${Date.now().toString(36)}`, nome: "Ônibus da Manhã", ini: "06:40", fim: "07:30", dias: [1, 2, 3, 4, 5], playlist: als[0]?.id || "", aleatorio: true };
  const box = document.createElement("div"); box.className = "mu-regras";
  box.innerHTML = `<h3 class="mu-folha-tit">${r ? "Editar a rotina" : "Nova rotina"}</h3>
    <label class="mu-campo"><span>Nome</span><input type="text" class="mu-rt-nome" data-teclado="texto" aria-label="Nome da rotina"></label>
    <div class="mu-reg-extra"><label class="mu-campo"><span>Começa</span><input type="text" class="mu-rt-ini" data-teclado="hora" aria-label="Começa"></label><label class="mu-campo"><span>Termina</span><input type="text" class="mu-rt-fim" data-teclado="hora" aria-label="Termina"></label></div>
    <p class="mu-dica mu-dica-curta">Dias</p><div class="mu-chips mu-rt-dias"></div>
    <label class="mu-campo"><span>Playlist</span><select class="mu-rt-pl">${als.map(a => `<option value="${a.id}">${escapar(a.nome)}</option>`).join("")}</select></label>
    <label class="linha-cfg mu-rt-alea"><span>Aleatório</span></label>
    <div class="mu-ed-acoes"><button class="botao secundario" data-a="apagar">${r ? "Apagar" : "Cancelar"}</button><button class="botao" data-a="salvar">Salvar</button></div>`;
  const { fechar } = folha(box);
  const nome = box.querySelector(".mu-rt-nome"), ini = box.querySelector(".mu-rt-ini"), fim = box.querySelector(".mu-rt-fim"), pl = box.querySelector(".mu-rt-pl");
  nome.value = v.nome; ini.value = v.ini; fim.value = v.fim; pl.value = v.playlist;
  const dias = box.querySelector(".mu-rt-dias");
  DIAS_SEMANA.forEach((d, i) => { const b = document.createElement("button"); b.textContent = d; b.classList.toggle("on", v.dias.includes(i)); b.onclick = () => { v.dias = v.dias.includes(i) ? v.dias.filter(x => x !== i) : [...v.dias, i].sort(); b.classList.toggle("on"); }; dias.append(b); });
  const ch = document.createElement("button"); ch.className = `chave ${v.aleatorio ? "on" : ""}`; ch.setAttribute("aria-label", "Aleatório");
  ch.onclick = (e) => { e.preventDefault(); v.aleatorio = !v.aleatorio; ch.classList.toggle("on", v.aleatorio); };
  box.querySelector(".mu-rt-alea").append(ch);
  const hora = (t) => { const d = t.replace(/\D/g, ""); if (d.length < 3) return null; const h = +d.slice(0, d.length - 2), m = +d.slice(-2); return h < 24 && m < 60 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null; };
  box.querySelector('[data-a="apagar"]').onclick = async () => {
    tecl?.fechar();
    if (r) await B.salvarRotinas((await B.rotinas()).filter(x => x.id !== r.id));
    fechar(); aoSalvar(); desenhar(true);
  };
  box.querySelector('[data-a="salvar"]').onclick = async () => {
    tecl?.fechar();
    const a = hora(ini.value), b = hora(fim.value);
    if (!a || !b) { toast("Confira os horários (HH:MM)."); return; }
    if (!v.dias.length) { toast("Escolha pelo menos um dia."); return; }
    if (!pl.value) { toast("Crie uma playlist antes."); return; }
    const nova = { ...v, nome: nome.value.trim() || "Rotina", ini: a, fim: b, playlist: pl.value };
    const l = (await B.rotinas()).filter(x => x.id !== nova.id); l.push(nova);
    await B.salvarRotinas(l.sort((x, y) => x.ini.localeCompare(y.ini)));
    fechar(); aoSalvar(); desenhar(true);
  };
  tecl?.configurar({ sistema: true }); tecl?.preparar(box);
}

// ---------- retrospectiva do mês ----------
export function abrirRetrospectiva(mes) {
  if (raiz?.isConnected) { busca = ""; sub = { tipo: "retro", mes }; desenhar(); } else pedidoRetro = mes;
}
async function telaRetrospectiva(tela, mes) {
  const RT = await import("./retrospectiva.js");
  const meses = await RT.mesesComDados();
  mes = mes || meses[0] || RT.mesAtual();
  const r = await RT.resumoDoMes(mes);
  cabecalho(tela, { titulo: "Retrospectiva", voltar: () => { sub = { tipo: "estatisticas" }; desenhar(); }, acoes: false, sub: RT.nomeMes(mes) });
  if (meses.length > 1) {
    const ch = document.createElement("div"); ch.className = "mu-chips mu-periodos";
    const curto = (m) => { const [a, mm] = m.split("-"); return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mm - 1]}/${a.slice(2)}`; };
    for (const m of meses.slice(0, 12)) { const b = document.createElement("button"); b.textContent = curto(m); b.classList.toggle("on", m === mes); b.onclick = () => { sub = { tipo: "retro", mes: m }; desenhar(); }; ch.append(b); }
    tela.append(ch);
  }
  if (!r) { tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nada ouvido neste mês ainda.</p>`); return; }
  botaoImagem(tela, "Compartilhar em imagem", async () => { const RI = await import("./retroImagem.js"); await RI.compartilharImagem(await RI.imagemDoMes(r), `Retrospectiva ${mes}.png`); });
  const dif = r.tempoAnt ? Math.round(100 * (r.tempo - r.tempoAnt) / r.tempoAnt) : null;
  const HORAS = (h) => `${h}h–${(h + 1) % 24}h`, SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  tela.insertAdjacentHTML("beforeend", `<div class="mu-retro-hero"><small>Você ouviu</small><b>${RT.horasTexto(r.tempo)}</b><span>${r.reproducoes} ${r.reproducoes === 1 ? "reprodução" : "reproduções"} de ${r.distintas} ${r.distintas === 1 ? "música" : "músicas"}${dif != null ? ` · ${dif >= 0 ? "+" : ""}${dif}% que no mês anterior` : ""}</span></div>`);
  if (r.musicas[0]) {
    const top = r.musicas[0], c = document.createElement("div"); c.className = "mu-retro-top";
    c.append(capa(top.faixa, "grande"));
    c.insertAdjacentHTML("beforeend", `<span><small>Música do mês</small><b>${escapar(top.faixa.titulo)}</b><em>${escapar(top.faixa.artista)} · ${top.n}×</em></span>`);
    c.onclick = () => tocarLista(r.musicas.map(x => x.faixa), 0, { aleatorio: false });
    tela.append(c);
  }
  const blocos = [
    r.artistas[0] && ["Artista do mês", r.artistas[0].nome, `${r.artistas[0].n} ${r.artistas[0].n === 1 ? "reprodução" : "reproduções"}`],
    r.tags[0] && ["Tag do mês", r.tags[0].nome, `${r.tags[0].n}×`],
    r.descoberta && ["Descoberta do mês", r.descoberta.faixa.titulo, `${r.descoberta.faixa.artista} · ${r.descoberta.n}×`],
    ["Dia que mais ouviu", `Dia ${r.diaTop.dia}`, RT.horasTexto(r.diaTop.ms)],
    ["Horário favorito", HORAS(r.horaTop), `O dia da semana em que mais ouve é ${SEMANA[r.semanaTop]}`],
    ["Sequência", `${r.sequencia} ${r.sequencia === 1 ? "dia" : "dias"} seguidos`, `${r.diasOuvindo} ${r.diasOuvindo === 1 ? "dia" : "dias"} com música no mês`],
    r.spedUp > 0 && ["Sped Up", `${r.spedUp}%`, "das reproduções foram de versões Sped Up"],
  ].filter(Boolean);
  tela.insertAdjacentHTML("beforeend", `<div class="mu-retro-grade">${blocos.map(([a, b, c]) => `<div><small>${escapar(a)}</small><b>${escapar(b)}</b><span>${escapar(c)}</span></div>`).join("")}</div>`);
  if (r.musicas.length > 1) {
    tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">As 5 mais tocadas</h3>`);
    const box = document.createElement("div"); box.className = "mu-lista"; const fs = r.musicas.map(x => x.faixa);
    r.musicas.forEach((x, i) => { const el = linhaFaixa(x.faixa, fs, i); el.querySelector("small").insertAdjacentHTML("afterbegin", `<b class="mu-n">${x.n}×</b> `); el.prepend(Object.assign(document.createElement("span"), { className: "mu-pos", textContent: i + 1 })); box.append(el); });
    tela.append(box);
  }
  if (r.artistas.length > 1) tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">Artistas</h3><div class="mu-ranking">${r.artistas.map(a => `<div><span>${escapar(a.nome)}</span><i style="width:${Math.round(100 * a.n / r.artistas[0].n)}%"></i><b>${a.n}</b></div>`).join("")}</div>`);
}

// ---------- retrospectiva em imagem e "Neste dia" ----------
function botaoImagem(tela, rotulo, gerar) {
  const b = document.createElement("button"); b.className = "botao secundario mu-retro-img";
  b.innerHTML = `${I.compartilhar}<span>${escapar(rotulo)}</span>`;
  b.onclick = async () => {
    const t = b.innerHTML; b.disabled = true; b.innerHTML = `<span>Desenhando…</span>`;
    try { await gerar(); } catch (e) { toast(`Não deu para montar a imagem (${e.message}).`, 4000); } finally { b.disabled = false; b.innerHTML = t; }
  };
  tela.append(b);
}
const hojeChave = () => new Date().toLocaleDateString("sv");
/** Faixa no alto quando há o que lembrar neste dia (some ao fechar, até amanhã). */
async function faixaNesteDia(tela) {
  try { if (localStorage.getItem("mu.nesteDia") === hojeChave()) return; } catch {}
  const RT = await import("./retrospectiva.js");
  const l = await RT.nesteDia(); if (!l.length) return;
  const n = l[0], top = n.musicas[0];
  const c = document.createElement("div"); c.className = "mu-rotina mu-neste";
  c.append(capa(top.faixa, "mini"));
  c.insertAdjacentHTML("beforeend", `<span><small>Neste dia · ${escapar(n.titulo.toLowerCase())}</small><b>${escapar(top.faixa.titulo)}</b></span>`);
  c.querySelector("span").onclick = () => { sub = { tipo: "nestedia" }; desenhar(); };
  const ver = document.createElement("button"); ver.className = "botao mini"; ver.textContent = "Ver";
  ver.onclick = () => { sub = { tipo: "nestedia" }; desenhar(); };
  const x = document.createElement("button"); x.className = "mu-neste-x"; x.setAttribute("aria-label", "Fechar"); x.innerHTML = I.fechar;
  x.onclick = () => { try { localStorage.setItem("mu.nesteDia", hojeChave()); } catch {} c.remove(); };
  c.append(ver, x); tela.append(c);
}
async function telaNesteDia(tela) {
  const RT = await import("./retrospectiva.js");
  cabecalho(tela, { titulo: "Neste dia", voltar: () => { sub = null; desenhar(); }, acoes: false, sub: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) });
  const l = await RT.nesteDia();
  if (!l.length) { tela.insertAdjacentHTML("beforeend", `<p class="mu-dica">Nada ouvido nesta data ainda.</p>`); return; }
  for (const n of l) {
    tela.insertAdjacentHTML("beforeend", `<div class="mu-retro-hero"><small>${escapar(n.titulo)} · ${escapar(n.data)}</small><b>${RT.horasTexto(n.tempo)}</b><span>${n.musicas.length} ${n.musicas.length === 1 ? "música" : "músicas"} diferentes</span></div>`);
    const fs = n.musicas.map(x => x.faixa);
    const box = document.createElement("div"); box.className = "mu-lista";
    n.musicas.forEach((x, i) => { const el = linhaFaixa(x.faixa, fs, i); el.querySelector("small")?.insertAdjacentHTML("afterbegin", `<b class="mu-n">${x.n}×</b> `); box.append(el); });
    tela.append(box);
    const acoes = document.createElement("div"); acoes.className = "mu-neste-acoes";
    const tocar = document.createElement("button"); tocar.className = "botao mini"; tocar.innerHTML = `${I.play}<span>Tocar estas</span>`;
    tocar.onclick = () => tocarLista(fs, 0, { aleatorio: false });
    acoes.append(tocar); tela.append(acoes);
    botaoImagem(acoes, "Imagem", async () => { const RI = await import("./retroImagem.js"); await RI.compartilharImagem(await RI.imagemNesteDia(n), `Neste dia ${hojeChave()}.png`); });
  }
}
