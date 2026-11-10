// Home do Órbita (pedido do Alediov, 26/10/2026: "Como ele é uma compilação de subapps, seria legal, ao abrir,
// aparecer uma home com todos os subapps"). Uma camada própria (.camada-home, por cima das áreas e por baixo dos
// modais) com o logo, a saudação pelo horário, os 5 subapps com um resumo vivo de cada um e o "Meu dia" (meuDia.js).
// Aparece ao abrir o app (abertura fria; `config.abrirEm` "home", padrão, ou "ultima"), no botão do topo dos Estudos e
// no "Trocar de Área" das outras áreas (areas.js, `escolherArea`). Voltar do fundo continua onde estava, e os widgets
// e notificações com `oq_area` continuam indo direto para a área. Só lê o estado de cada área.
import { E, salvar, hojeISO, somaDias, ofensivaAtiva, metaDoDia, metaLeituraDe } from "./estado.js";
import { escapar, modal } from "./ui.js";
import { icone as ico3d } from "./icones.js";
import { tocar } from "./sons.js";
import { pocaoAtiva, minutosRestantesPocao } from "./economia.js";
import * as FC from "./financas/contas.js";

let camada = null, cfg = null, desligar = [], timer = null, geracao = 0, nSvg = 0;
export const homeAberta = () => !!camada;
const reduzir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// os 7 subapps, nas cores dos logos (areas.js; o Clima desde 02/11/2026). Desde 31/10/2026 (pedido do Alediov) todos os cartões têm o mesmo
// tamanho, só com o logo e o nome (sem os textinhos), e a ordem é escolhida (ORDENS: padrão, mais usados, A–Z ou
// personalizada; config.homeOrdem e config.homeOrdemPers; o uso em config.usoAreas, contado pelo irPara de areas.js)
export const AREAS = [
  { id: "learn", nome: "Estudos", desc: "Trilha, jogos, agenda e coleção", c1: "#5B9BFF", c2: "#2340C9" },
  { id: "scan", nome: "Iniciação Científica", desc: "Os projetos de pesquisa", c1: "#34E0BD", c2: "#0B7C70" },
  { id: "musicas", nome: "Músicas", desc: "As suas músicas e o Seu dia", c1: "#FF7AB8", c2: "#7C3AED" },
  { id: "leitura", nome: "Leitura", desc: "Os livros e as novels", c1: "#FFC24B", c2: "#E2551B" },
  { id: "xadrez", nome: "Xadrez", desc: "Aberturas, problemas e partidas", c1: "#5FD1A0", c2: "#1E6B57" },
  { id: "financas", nome: "Finanças", desc: "Entradas, gastos e as automações", c1: "#B8E35A", c2: "#2F8A3B" },
  { id: "clima", nome: "Clima", desc: "O tempo de agora, as horas e os dias", c1: "#62D8F5", c2: "#1C78C8" },
  { id: "cofre", nome: "Cofre", desc: "Senhas, tokens e chaves, cifrados", c1: "#7C8BB0", c2: "#262D45" },
  { id: "eva", nome: "Mensagens", desc: "A Eva e os grupos do WhatsApp", c1: "#C9B2FF", c2: "#6A48D8" },
];
export const ORDENS = [["padrao", "Padrão"], ["uso", "Mais usados"], ["alfa", "A–Z"], ["pers", "Personalizada"]];
const IDS = AREAS.map(a => a.id);
const diasEntre = (a, b) => Math.max(0, Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5));
/** Conta uma abertura do subapp (a pontuação perde 5% por dia: vale mais o uso recente). */
export function contarUso(area) {
  if (!IDS.includes(area)) return;
  const c = E().config, u = (c.usoAreas ||= {}), hoje = hojeISO(), x = u[area];
  u[area] = { s: +(((x ? x.s * Math.pow(0.95, diasEntre(x.d, hoje)) : 0) + 1).toFixed(3)), d: hoje };
  salvar();
}
const pontos = (area) => { const x = E().config.usoAreas?.[area]; return x ? x.s * Math.pow(0.95, diasEntre(x.d, hojeISO())) : 0; };
/** Os subapps na ordem escolhida. */
export function areasNaOrdem(modo = E().config.homeOrdem || "padrao") {
  if (modo === "alfa") return [...AREAS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (modo === "uso") return [...AREAS].sort((a, b) => pontos(b.id) - pontos(a.id) || IDS.indexOf(a.id) - IDS.indexOf(b.id));
  if (modo === "pers") {
    const p = (E().config.homeOrdemPers || []).filter(id => IDS.includes(id));
    return [...p, ...IDS.filter(id => !p.includes(id))].map(id => AREAS.find(a => a.id === id));
  }
  return AREAS;
}
const NOMES_LIVRO = { malamed: "Malamed", andrade: "Andrade", neville: "Neville", lindhe: "Lindhe", burket: "Burket", hunter: "a novel" };

export function saudacao(h = new Date().getHours()) { return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O céu do ícone: planeta com anel e uma lua por subapp (cada uma na cor da área), girando em duas órbitas. */
function ceuSVG() {
  const k = `h${++nSvg}`, mexe = !reduzir();
  // a lua passa por trás do planeta na metade de cima da órbita: duas cópias, uma atrás (antes do planeta) e uma
  // na frente, cada uma recortada pela sua metade (como o anel do logo)
  const orbitas = [
    { rx: 92, ry: 27, rot: -22, luas: [["#3D8BFF", 7.2, 16, 0], ["#FF5FA2", 6.4, 16, 5.3], ["#FFC24B", 5.6, 16, 10.6]] },
    { rx: 122, ry: 38, rot: -14, luas: [["#22C3A6", 6.6, 26, 3], ["#5FD1A0", 5.2, 26, 16]] },
  ];
  const cx = 130, cy = 112;
  const caminho = (o) => `M${cx - o.rx},${cy} a${o.rx},${o.ry} 0 1,0 ${2 * o.rx},0 a${o.rx},${o.ry} 0 1,0 ${-2 * o.rx},0`;
  const lua = (o, [cor, r, dur, ini]) => {
    // parada (reduzir movimento): num ponto fixo da órbita, pela fase
    const t = Math.PI * 0.15 + (ini / dur) * Math.PI * 2, x = cx - o.rx * Math.cos(t), y = cy + o.ry * Math.sin(t);
    const pos = mexe ? "" : ` transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"`;
    const mov = mexe ? `<animateMotion dur="${dur}s" begin="-${ini}s" repeatCount="indefinite" path="${caminho(o)}"/>` : "";
    return `<g${pos}><circle r="${r + 2.4}" fill="#0C0828" opacity=".45"/><circle r="${r}" fill="${cor}"/><circle cx="${-r * .35}" cy="${-r * .35}" r="${r * .36}" fill="#fff" opacity=".55"/>${mov}</g>`;
  };
  const anel = (o, frente) => `<g transform="rotate(${o.rot} ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="${o.rx}" ry="${o.ry}" fill="none" stroke="url(#an${k})" stroke-opacity="${frente ? .9 : .45}" stroke-width="${frente ? 1.8 : 1.4}" ${frente ? `clip-path="url(#fr${k})"` : `clip-path="url(#tr${k})"`}/></g>`;
  const luas = (o, frente) => `<g transform="rotate(${o.rot} ${cx} ${cy})"><g clip-path="url(#${frente ? "fr" : "tr"}${k})">${o.luas.map(l => lua(o, l)).join("")}</g></g>`;
  return `<svg class="home-planeta" viewBox="0 0 260 224" aria-hidden="true"><defs>
      <radialGradient id="pl${k}" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".35" stop-color="#FFC76A"/><stop offset=".75" stop-color="#FF7A59"/><stop offset="1" stop-color="#D9436B"/></radialGradient>
      <radialGradient id="so${k}" cx="70%" cy="75%" r="70%"><stop offset=".55" stop-color="#7A1E4D" stop-opacity="0"/><stop offset="1" stop-color="#5A1240" stop-opacity=".6"/></radialGradient>
      <radialGradient id="ha${k}" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#FFB27A" stop-opacity=".35"/><stop offset="1" stop-color="#FFB27A" stop-opacity="0"/></radialGradient>
      <linearGradient id="an${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B9C7FF"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6C9FF"/></linearGradient>
      <clipPath id="tr${k}"><rect x="-200" y="-200" width="660" height="${cy + 200}"/></clipPath>
      <clipPath id="fr${k}"><rect x="-200" y="${cy}" width="660" height="400"/></clipPath>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="70" fill="url(#ha${k})"/>
    ${orbitas.map(o => anel(o, false) + luas(o, false)).join("")}
    <circle cx="${cx}" cy="${cy}" r="40" fill="url(#pl${k})"/><circle cx="${cx}" cy="${cy}" r="40" fill="url(#so${k})"/>
    <ellipse cx="${cx - 13}" cy="${cy - 17}" rx="12" ry="6.4" fill="#fff" opacity=".38" transform="rotate(-30 ${cx - 13} ${cy - 17})"/>
    ${orbitas.map(o => anel(o, true) + luas(o, true)).join("")}
  </svg>`;
}
// estrelas do céu: posições fixas (pseudoaleatórias), piscando em tempos diferentes
const ESTRELAS = Array.from({ length: 26 }, (_, i) => {
  const a = Math.sin(i * 91.7) * 10000, b = Math.sin(i * 47.3 + 3) * 10000;
  return { x: ((a - Math.floor(a)) * 100).toFixed(1), y: ((b - Math.floor(b)) * 92).toFixed(1), d: (i % 7) * 0.55, g: i % 5 === 0 };
});

/** Abre a Home. `o`: { atual: área aberta por baixo, irPara(area), irParaItem(ir), logos: {orbita, learn, …}, inicio }. */
export function abrirHome(o) {
  cfg = o;
  if (camada) { preencher(); return camada; }
  camada = document.createElement("div");
  camada.className = `camada-home ${reduzir() ? "" : "entra"}`;
  camada.setAttribute("role", "region"); camada.setAttribute("aria-label", "Início do Órbita");
  const nome = (E().avatar?.nome || "").trim().split(/\s+/)[0];
  const hoje = new Date();
  camada.innerHTML = `<div class="home-rolagem"><div class="home-ceu">
      <div class="home-estrelas" aria-hidden="true">${ESTRELAS.map(s => `<i class="${s.g ? "g" : ""}" style="left:${s.x}%;top:${s.y}%;--d:${s.d}s"></i>`).join("")}</div>
      <div class="home-larg">
      <header class="home-cab">
        <div class="home-marca">${o.logos.orbita}<b>Órbita</b></div>
        <span class="home-cab-bt"><button class="home-fechar home-ajustes" type="button" aria-label="Ajustes do Órbita"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button><button class="home-fechar home-aparencia" type="button" aria-label="Aparência: tema, fundo e bolhas"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="7.8" r="1.1" fill="currentColor" stroke="none"/></svg></button>
        <button class="home-fechar" type="button" aria-label="Fechar a Home"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>
      </header>
      <section class="home-heroi">
        ${ceuSVG()}
        <div class="home-ola"><p class="home-hora"><b class="hh-relogio">${relogio()}</b><small class="hh-data">${hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</small></p>
          <h1>${saudacao()}${nome ? `,<br>${escapar(nome)}` : ""}</h1>
          <p class="home-frase">&nbsp;</p></div>
        <button class="home-clima" type="button" aria-label="Abrir o Clima" hidden></button>
        <button class="home-dia" type="button"><span class="hd-anel" style="--p:0"><b>·</b></span><span class="hd-tx"><b>Meu dia</b><small>o que falta hoje</small></span><svg class="hd-seta" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      </section>
      </div></div>
      <div class="home-larg home-corpo">
      <div class="home-colunas">
        <div class="home-subapps"><div class="home-apps-cab"><button class="home-ordem" type="button" aria-label="Mudar a ordem dos subapps">${ICONE_ORDEM}<span></span></button></div>
        <section class="home-apps"></section></div>
        <section class="home-meudia"><div class="home-md-vazio">Carregando o seu dia…</div></section>
      </div>
      <footer class="home-rodape"><small>Ao abrir o app</small><div class="home-seg" role="group" aria-label="Ao abrir o app">
        <button type="button" data-v="home">Home</button><button type="button" data-v="ultima">Última área</button></div></footer>
    </div></div>`;
  document.body.append(camada);
  camada.querySelector(".home-fechar:not(.home-aparencia):not(.home-ajustes)").onclick = () => { tocar("toque"); fecharHome(); cfg?.aoFechar?.(); };
  camada.querySelector(".home-ajustes").onclick = () => { tocar("toque"); import("./ajustes.js").then(m => m.abrirAjustes()); };
  camada.querySelector(".home-aparencia").onclick = () => { tocar("toque"); import("./aparencia.js").then(m => m.abrirAparencia()); };
  desenharCartoes();
  camada.querySelector(".home-ordem").onclick = () => { tocar("toque"); abrirOrdem(); };
  camada.querySelector(".home-dia").onclick = () => camada.querySelector(".home-meudia")?.scrollIntoView({ behavior: reduzir() ? "auto" : "smooth", block: "start" });
  const seg = camada.querySelector(".home-seg");
  const pintarSeg = () => seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", (E().config.abrirEm || "home") === b.dataset.v));
  seg.querySelectorAll("button").forEach(b => (b.onclick = () => { E().config.abrirEm = b.dataset.v; salvar(); pintarSeg(); tocar("toque"); }));
  pintarSeg();
  if (!reduzir()) setTimeout(() => camada?.classList.remove("entra"), 1400);
  ligarMusica();
  ligarRelogioEClima();
  const vis = () => { if (document.visibilityState === "visible") atualizarHome(); };
  document.addEventListener("visibilitychange", vis); desligar.push(() => document.removeEventListener("visibilitychange", vis));
  preencher();
  return camada;
}

export function fecharHome() {
  if (!camada) return;
  const c = camada; camada = null; geracao++;
  clearTimeout(timer); desligar.forEach(f => { try { f(); } catch { /* nada */ } }); desligar = [];
  c.classList.add("sai");
  setTimeout(() => c.remove(), reduzir() ? 0 : 220);
}

/** Atualiza os números com a Home aberta (chamado pelo main.js a cada mudança no topo). */
export function atualizarHome() {
  if (!camada) return;
  clearTimeout(timer); timer = setTimeout(preencher, 600);
}

function cartao(a, i) {
  const aberta = cfg.atual === a.id;
  return `<button class="home-app ${aberta ? "aberta" : ""}" type="button" data-area="${a.id}" aria-label="${a.nome}${aberta ? " (aberta)" : ""}" style="--c1:${a.c1};--c2:${a.c2};--k:${i}">
    <span class="ha-luz"></span>
    <span class="ha-selo"></span>
    <span class="ha-feito" role="img"></span>
    <span class="ha-logo">${cfg.logos[a.id]}</span>
    <span class="ha-tx"><b>${a.nome}</b></span>
    <span class="ha-barra" hidden><i></i></span>
  </button>`;
}
const ICONE_ORDEM = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg>`;
/** Desenha os cartões na ordem escolhida (e o nome da ordem no botão). */
function desenharCartoes() {
  if (!camada) return;
  const box = camada.querySelector(".home-apps"), modo = E().config.homeOrdem || "padrao";
  box.innerHTML = areasNaOrdem(modo).map((a, i) => cartao(a, i)).join("");
  camada.querySelector(".home-ordem span").textContent = `Ordem: ${ORDENS.find(o => o[0] === modo)?.[1] || "Padrão"}`;
  box.querySelectorAll(".home-app").forEach(b => (b.onclick = () => {
    tocar("toque");
    const area = b.dataset.area;
    fecharHome();
    cfg.irPara(area);
  }));
  delete camada.dataset.pintou;
}
/** A folha da ordem: Padrão, Mais usados, A–Z ou Personalizada (com setas para subir e descer). */
function abrirOrdem() {
  const c = E().config;
  const html = `<div class="ho"><h2 class="ho-tit">Ordem dos subapps</h2>
    <div class="ap-seg ho-seg" role="group" aria-label="Ordem">${ORDENS.map(([id, n]) => `<button type="button" data-ordem="${id}">${n}</button>`).join("")}</div>
    <p class="ho-dica"></p><ol class="ho-lista"></ol></div>`;
  const fim = modal({ titulo: "", html, botoes: [{ texto: "Pronto", valor: true }] });
  const m = document.getElementById("modal");
  const dicas = { padrao: "A ordem de sempre do Órbita.", uso: "Os que você mais abriu nos últimos tempos primeiro (vale mais o uso recente).", alfa: "Em ordem alfabética.", pers: "Use as setas para pôr na ordem que quiser." };
  const pintar = () => {
    const modo = c.homeOrdem || "padrao", lista = areasNaOrdem(modo);
    m.querySelectorAll("[data-ordem]").forEach(b => b.classList.toggle("on", b.dataset.ordem === modo));
    m.querySelector(".ho-dica").textContent = dicas[modo];
    m.querySelector(".ho-lista").innerHTML = lista.map((a, i) => `<li style="--c1:${a.c1};--c2:${a.c2}"><span class="ho-logo">${cfg.logos[a.id]}</span><b>${a.nome}</b>${modo === "pers" ? `<span class="ho-setas"><button type="button" data-sobe="${i}" aria-label="Subir ${a.nome}" ${i ? "" : "disabled"}>↑</button><button type="button" data-desce="${i}" aria-label="Descer ${a.nome}" ${i < lista.length - 1 ? "" : "disabled"}>↓</button></span>` : ""}</li>`).join("");
    m.querySelectorAll("[data-sobe],[data-desce]").forEach(b => (b.onclick = () => {
      const ids = areasNaOrdem("pers").map(a => a.id), i = +(b.dataset.sobe ?? b.dataset.desce), j = b.dataset.sobe != null ? i - 1 : i + 1;
      [ids[i], ids[j]] = [ids[j], ids[i]]; c.homeOrdemPers = ids; salvar(); tocar("toque"); pintar(); desenharCartoes(); preencher();
    }));
  };
  m.querySelectorAll("[data-ordem]").forEach(b => (b.onclick = () => {
    // a 1ª vez em Personalizada começa da ordem que está na tela
    if (b.dataset.ordem === "pers" && !c.homeOrdemPers?.length) c.homeOrdemPers = areasNaOrdem(c.homeOrdem || "padrao").map(a => a.id);
    c.homeOrdem = b.dataset.ordem; salvar(); tocar("toque"); pintar(); desenharCartoes(); preencher();
  }));
  pintar();
  return fim;
}

// ---------------------------------------------------------------- os resumos vivos
async function preencher() {
  const g = ++geracao, c = camada; if (!c) return;
  let M = null, itens = [];
  try { M = await import("./meuDia.js"); itens = await M.itensDoDia(); } catch (e) { console.warn("Home: meu dia", e); }
  if (g !== geracao || !camada) return;
  // anel e frase do alto
  const cont = M ? M.contarFeitos(itens) : { feitos: 0, total: 0 }, falta = cont.total - cont.feitos;
  const anel = c.querySelector(".hd-anel");
  anel.style.setProperty("--p", cont.total ? cont.feitos / cont.total : 0);
  anel.innerHTML = `<b>${cont.feitos}</b><small>de ${cont.total}</small>`;
  c.querySelector(".hd-tx small").textContent = !cont.total ? "o que falta hoje" : falta ? `${plural(falta, "coisa", "coisas")} para hoje` : "tudo feito hoje!";
  let provas = [];
  try { provas = M ? M.provasDaSemana() : []; } catch { /* sem agenda */ }
  const hoje = hojeISO(), dias = (d) => Math.round((new Date(d + "T12:00") - new Date(hoje + "T12:00")) / 864e5);
  const prox = provas[0];
  c.querySelector(".home-frase").textContent = prox ? `${dias(prox.data) === 0 ? "Prova hoje" : dias(prox.data) === 1 ? "Prova amanhã" : `Prova em ${dias(prox.data)} dias`}: ${prox.nome}`
    : cont.total && !falta ? "Tudo em dia. Bom trabalho!" : "Para onde vamos hoje?";
  // os cartões
  const por = (id) => itens.find(i => i.id === id);
  pintar("learn", resumoEstudos(itens));
  pintar("scan", resumoScanner());
  pintar("leitura", resumoLeitura(por("leitura")));
  pintar("xadrez", resumoXadrez(por("xadrez")));
  pintar("financas", resumoFinancas());
  pintar("musicas", await resumoMusicas());
  if (g !== geracao || !camada) return;
  if (M) pintarSelos(itens);
  // o "Meu dia" inteiro embaixo (o mesmo bloco de antes), com os atalhos para cada coisa
  const chave = JSON.stringify(itens) + Math.floor(Date.now() / 600000);
  if (M && c.dataset.md !== chave) {
    c.dataset.md = chave;
    try {
      const bloco = await M.blocoMeuDia((ir) => { fecharHome(); cfg.irParaItem(ir); }, itens);
      if (g !== geracao || !camada) return;
      c.querySelector(".home-meudia").replaceChildren(bloco);
    } catch (e) { console.warn("Home: bloco do dia", e); }
  }
}

function pintar(id, r) {
  const b = camada?.querySelector(`.home-app[data-area="${id}"]`); if (!b || !r) return;
  // só troca o que mudou (os ícones não piscam a cada atualização do topo)
  // sem os textinhos (31/10/2026): só a barra do dia e, nas Músicas, o equalizador de quando está tocando
  const selo = b.querySelector(".ha-selo"), sv = id === "musicas" ? r.selo || "" : "";
  if (selo.dataset.h !== sv) { selo.innerHTML = sv; selo.dataset.h = sv; }
  const barra = b.querySelector(".ha-barra");
  barra.hidden = r.p == null;
  if (r.p != null) barra.querySelector("i").style.width = `${Math.round(Math.max(0, Math.min(1, r.p)) * 100)}%`;
  b.classList.toggle("feito", !!r.feito);
}
// ---------------------------------------------------------------- os selos do dia nos cartões (02/11/2026)
// Pedido do Alediov: "um sticker de completo na aba home, quando os objetivos daquela área forem completos, um traço
// quando não se aplica, e um círculo tracejado quando não foi feito ainda". Pelos MESMOS itens do Meu dia (meuDia.js
// itensDoDia, já lidos no preencher), agrupados pela área para onde cada um leva (`ir.area`); os informativos
// (feito === null) e os que não levam a uma área (o token, o foco) ficam de fora. "Se der tempo" (bonus) só conta
// quando a área não tem mais nada: aí o círculo fica mais claro. ✓ = tudo feito; o tracejado leva um arco com a parte
// feita; traço = a área não tem objetivos hoje (o Clima, as Músicas sem artistas a conferir).
export function selosDoDia(itens) {
  const por = {};
  for (const it of itens || []) {
    const a = it.ir?.area; if (!a || it.feito === null || it.feito === undefined) continue;
    const s = (por[a] ||= { f: 0, t: 0, p: 0, bf: 0, bt: 0 });
    if (it.bonus) { s.bt++; if (it.feito) s.bf++; continue; }
    s.t++; if (it.feito) s.f++;
    s.p += it.feito ? 1 : it.conta?.[1] ? Math.min(1, it.conta[0] / it.conta[1]) : 0;
  }
  const out = {};
  for (const a of IDS) {
    const s = por[a];
    out[a] = !s ? { e: "nada" } : s.t ? (s.f >= s.t ? { e: "ok", f: s.f, t: s.t } : { e: "falta", f: s.f, t: s.t, p: s.p / s.t })
      : s.bf >= s.bt ? { e: "ok", f: s.bf, t: s.bt } : { e: "extra", f: s.bf, t: s.bt, p: s.bf / s.bt };
  }
  return out;
}
const SELO = {
  ok: () => `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" class="hf-fundo"/><path d="M7.6 13.4l3.6 3.6 7.2-7.6" class="hf-check"/></svg>`,
  falta: (p) => { const c = 2 * Math.PI * 10, d = Math.max(0, Math.min(1, p || 0)) * c; return `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" class="hf-tracejado"/>${d > 0.5 ? `<circle cx="13" cy="13" r="10" class="hf-arco" stroke-dasharray="${d.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 13 13)"/>` : ""}</svg>`; },
  nada: () => `<svg viewBox="0 0 26 26"><path d="M8 13h10" class="hf-traco"/></svg>`,
};
SELO.extra = SELO.falta;
const ROTULO = { ok: "Tudo feito hoje", falta: "A fazer hoje", extra: "Só o que é para se der tempo", nada: "Nada para hoje" };
// o último estado que a Home mostrou de cada área hoje (localStorage): o pulinho do ✓ aparece também quando a área
// foi completada com a Home fechada, na próxima vez que ela abrir
const VISTOS = "orbita.home.selos";
function pintarSelos(itens) {
  const selos = selosDoDia(itens), hoje = hojeISO();
  let vistos = {};
  try { const v = JSON.parse(localStorage.getItem(VISTOS) || "null"); if (v?.dia === hoje) vistos = v.e || {}; } catch { /* sem armazenamento */ }
  for (const [a, s] of Object.entries(selos)) {
    const el = camada?.querySelector(`.home-app[data-area="${a}"] .ha-feito`); if (!el) continue;
    const chave = `${s.e}|${s.f ?? ""}|${s.t ?? ""}|${(s.p ?? 0).toFixed(2)}`;
    if (el.dataset.k === chave) continue;
    const antes = el.dataset.e || vistos[a];
    vistos[a] = s.e;
    el.dataset.k = chave; el.dataset.e = s.e;
    el.innerHTML = SELO[s.e](s.p);
    el.setAttribute("aria-label", s.t ? `${ROTULO[s.e]}: ${s.f} de ${s.t}` : ROTULO[s.e]);
    el.title = el.getAttribute("aria-label");
    // virou ✓ agora (não na 1ª pintura): um pulinho com um anel que se abre
    el.classList.remove("vira");
    if (s.e === "ok" && antes && antes !== "ok" && !reduzir()) { void el.offsetWidth; el.classList.add("vira"); }
  }
  try { localStorage.setItem(VISTOS, JSON.stringify({ dia: hoje, e: vistos })); } catch { /* sem armazenamento */ }
}
const linha = (emoji, txt, cls = "") => `<span class="ha-l ${cls}">${emoji ? ico3d(emoji, "ico-inline") : ""}<span>${txt}</span></span>`;

function resumoEstudos(itens) {
  const e = E(), hoje = hojeISO();
  const lic = itens.filter(i => i.id.startsWith("licoes-") && i.conta);
  const f = lic.reduce((s, i) => s + i.conta[0], 0), t = lic.reduce((s, i) => s + i.conta[1], 0);
  const meta = metaDoDia(hoje), feitas = e.diario[hoje]?.licoes?.length || 0, xp = e.diario[hoje]?.xp || 0;
  const of = e.ofensiva?.atual || 0, viva = ofensivaAtiva();
  const pc = pocaoAtiva();
  const selo = `<span class="ha-fogo ${viva ? "" : "apagada"}" title="Ofensiva">${ico3d("🔥", "ico-inline")}<b>${of}</b><small>${of === 1 ? "dia" : "dias"}</small></span>`;
  const html = `${linha("📚", t ? `<b>${f}</b> de ${t} lições de hoje` : `<b>${feitas}</b> ${feitas === 1 ? "lição" : "lições"} hoje`)}
    ${linha("⚡", `<b>+${xp.toLocaleString("pt-BR")}</b> XP · meta ${Math.min(feitas, meta)}/${meta}`)}
    ${pc ? linha("⚗️", `Poção <b>×${pc.mult}</b> ativa · ${minutosRestantesPocao()} min`, "pocao") : ""}`;
  return { html, selo, p: Math.min(1, feitas / meta), feito: feitas >= meta };
}
function resumoScanner() {
  const c = E().config, sr = c.scanResumo, hoje = hojeISO();
  if (sr?.dia === hoje && (sr.metaRev || sr.metaNum)) {
    const meta = (sr.metaRev || 0) + (sr.metaNum || 0), feito = Math.min(sr.feitasRev || 0, sr.metaRev || 0) + Math.min(sr.feitasNum || 0, sr.metaNum || 0);
    return { html: linha("📋", `Revisar <b>${sr.feitasRev || 0}/${sr.metaRev || 0}</b>`) + linha("🧮", `Números <b>${sr.feitasNum || 0}/${sr.metaNum || 0}</b>`), p: meta ? feito / meta : 0, feito: feito >= meta };
  }
  if (c.scanNaFila) return { html: linha("🌙", `<b>${c.scanNaFila}</b> ${c.scanNaFila === 1 ? "ficha" : "fichas"} na fila da madrugada`) };
  // o resumo que o computador do laboratório publica (só números agregados), guardado pela tela de resultados
  try {
    const R = JSON.parse(localStorage.getItem("os.resumo") || "null");
    if (R?.total) { const c = R.etapas?.revisada || 0; return { html: linha("🔬", `<b>${Math.round((100 * c) / R.total)}%</b> das fichas conferidas (${c.toLocaleString("pt-BR")} de ${R.total.toLocaleString("pt-BR")})`), p: c / R.total }; }
  } catch { /* sem resumo */ }
  return { html: linha("🔬", "Resultados da IC, do computador do laboratório") };
}
function resumoLeitura(it) {
  const l = E().leitura || {}, hoje = hojeISO(), meta = metaLeituraDe(hoje);
  const lidas = Object.entries(l.lidas || {}).filter(([id, d]) => d === hoje && /^[a-z]\d\d-\d\d$/.test(id)).length;
  const cont = l.ultima?.livro ? NOMES_LIVRO[l.ultima.livro] || l.ultima.livro : "";
  return { html: linha("📖", `<b>${Math.min(lidas, meta)}</b> de ${meta} ${meta === 1 ? "unidade" : "unidades"} hoje`) + (cont ? linha("🔖", `Continuar: ${escapar(cont)}`) : ""),
    p: Math.min(1, lidas / meta), feito: lidas >= meta || !!it?.feito };
}
function resumoXadrez(it) {
  const x = E().xadrez || {}, hoje = hojeISO();
  const feito = !!x.treinoFeito?.[hoje];
  let seq = 0, d = feito ? hoje : somaDias(hoje, -1);
  while (x.treinoFeito?.[d] && seq < 3650) { seq++; d = somaDias(d, -1); }
  const c = it?.conta;
  const txt = feito ? "Trilha de hoje <b>feita</b>" : c ? `<b>${c[0]}</b> de ${c[1]} passos da trilha` : "A trilha de hoje te espera";
  return { html: linha("♟️", txt) + (seq ? linha("🔥", `${plural(seq, "dia", "dias")} seguidos`) : ""), p: feito ? 1 : c ? c[0] / c[1] : 0, feito };
}

/** Finanças: quanto ainda dá para gastar no mês (ou o saldo do mês, sem renda prevista) e a saúde da macro do Slice. */
function resumoFinancas() {
  const e = E();
  if (!e.financas) return { html: linha("💰", "Entradas, gastos e o Slice num lugar só") };
  try {
    const f = FC.garantir(e), hoje = hojeISO(), r = FC.resumoMes(f, FC.mesDe(hoje), hoje);
    const disp = Math.max(0, r.rendaPrevista - r.guardar);
    const txt = r.rendaPrevista ? `Pode gastar <b>${FC.reais(r.podeGastar)}</b> este mês` : `Gastou <b>${FC.reais(r.gastos)}</b> este mês`;
    const sd = FC.saude(f, "slice", hoje), rs = FC.resumoFonte(f, "slice", hoje);
    // o dinheiro dele (Ping-Pong, Bipa e ZBD) e quanto o Ping-Pong rende por dia (30/10/2026)
    const din = FC.seuDinheiro(f, hoje), rd = FC.rendimento(f, hoje);
    const dinheiro = din ? linha("🏦", `<b>${FC.reais(din.total)}</b>${rd.porDia != null ? ` · +${FC.reais(rd.porDia)}/dia` : ""}`) : "";
    const slice = ["erro", "incompleta", "faltou"].includes(sd.estado) ? linha("⚠️", "Slice: a macro não terminou hoje", "aviso")
      : r.pendentes.length + r.aPagar.length ? linha("💵", `${plural(r.pendentes.length + r.aPagar.length, "fixa", "fixas")} para conferir`)
      : sd.estado === "ok" && !din ? linha("🪙", `Slice: ${rs.saldo != null ? FC.naUnidade(rs.saldo, rs.un) : "ok hoje"}`) : "";
    const selo = rs.sequencia != null ? `<span class="ha-fogo" title="Sequência do Slice">${ico3d("🔥", "ico-inline")}<b>${rs.sequencia}</b><small>Slice</small></span>` : "";
    return { html: linha("💰", txt) + dinheiro + slice, selo, p: disp ? Math.min(1, r.gastos / disp) : null };
  } catch (err) { console.warn("Home: finanças", err); return { html: linha("💰", "Entradas, gastos e as automações") }; }
}

// ---------------------------------------------------------------- o relógio e o tempo de agora, no alto (02/11/2026)
// Pedido do Alediov: "na aba Home, aparecessem também o Clima, a Temperatura, o horário". O relógio anda a cada minuto
// (um timer alinhado com a virada do minuto); o tempo vem do que o Clima guardou (clima/dados.js) e, se tiver mais de
// 30 min, é buscado de novo em segundo plano. Tocar abre o Clima.
const relogio = (d = new Date()) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
function ligarRelogioEClima() {
  let t = null;
  const passo = () => {
    if (!camada) return;
    const d = new Date();
    camada.querySelector(".hh-relogio").textContent = relogio(d);
    camada.querySelector(".hh-data").textContent = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    t = setTimeout(passo, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    if (d.getMinutes() % 15 === 0) pintarClima();
  };
  t = setTimeout(passo, 60000 - (Date.now() % 60000) + 50);
  desligar.push(() => clearTimeout(t));
  const aoClima = () => pintarClima();
  window.addEventListener("oq-clima", aoClima); desligar.push(() => window.removeEventListener("oq-clima", aoClima));
  camada.querySelector(".home-clima").onclick = () => { tocar("toque"); fecharHome(); cfg.irPara("clima"); };
  pintarClima(true);
}
async function pintarClima(buscar = false) {
  try {
    const [D, T, { svgTempo }] = await Promise.all([import("./clima/dados.js"), import("./clima/tempo.js"), import("./clima/icones.js")]);
    const b = camada?.querySelector(".home-clima"); if (!b) return;
    const c = D.guardado();
    if (c) {
      const r = T.resumo(c), chave = [r.icone, Math.round(r.t), r.max, r.min, r.prob, T.nomeLugar(c.lugar)].join("|");
      if (b.dataset.k !== chave) {
        b.dataset.k = chave;
        b.innerHTML = `<span class="hc-ico">${svgTempo(r.icone, { animado: !reduzir() })}</span>
          <span class="hc-tx"><b>${T.grau(r.t)}</b><small>${escapar(r.texto)}</small></span>
          <span class="hc-mais"><small><span>↑${T.grau(r.max)}</span> <span>↓${T.grau(r.min)}</span></small>${r.prob != null ? `<small class="hc-chuva">${r.prob}% de chuva</small>` : ""}</span>`;
        b.setAttribute("aria-label", `${T.grau(r.t)}, ${r.texto} em ${T.nomeLugar(c.lugar)}. Abrir o Clima`);
      }
      b.hidden = false;
    }
    if (buscar && (!c || D.idadeMin(c) >= 30) && navigator.onLine) D.atualizar({ idade: 30 }).catch(() => {}); // o evento oq-clima pinta de novo
  } catch (e) { console.warn("Home: clima", e); }
}

// Músicas: o que está tocando (o tocador manda a troca de música e o tocar/pausar enquanto a Home está aberta)
let musicaAtual = null;
async function resumoMusicas() {
  const venc = (E().config.musicasVencem || []).filter(v => Number.isFinite(v) && v <= Date.now()).length;
  const extra = venc ? linha("🧐", `${plural(venc, "artista", "artistas")} para conferir`) : "";
  const m = musicaAtual;
  if (m?.titulo) return { selo: `<span class="ha-tocando ${m.tocando ? "on" : ""}" title="${m.tocando ? "Tocando" : "Pausada"}"><i></i><i></i><i></i></span>`, html: linha("", `<b>${escapar(m.titulo)}</b>${m.artista ? ` · ${escapar(m.artista)}` : ""}`, "ha-mus") + extra };
  return { html: linha("☀️", "Seu dia: a playlist de hoje está pronta") + extra };
}
async function ligarMusica() {
  try {
    const [{ motor }, BD] = await Promise.all([import("./musicas/motor.js"), import("./musicas/banco.js")]);
    const aplicar = async (e) => {
      if (!e?.ativo || !e.id) { musicaAtual = null; return; }
      if (musicaAtual?.id !== e.id) { const f = await BD.pegarFaixa(e.id).catch(() => null); musicaAtual = { id: e.id, titulo: f?.titulo || "", artista: f?.artista || "", tocando: !!e.tocando }; }
      else musicaAtual.tocando = !!e.tocando;
    };
    const quando = Promise.race([motor.estado(), new Promise(ok => setTimeout(() => ok(null), 1500))]);
    await aplicar(await quando.catch(() => null));
    if (!camada) return;
    pintar("musicas", await resumoMusicas());
    const parar = motor.ouvir(async (e) => { const antes = JSON.stringify(musicaAtual); await aplicar(e); if (camada && JSON.stringify(musicaAtual) !== antes) pintar("musicas", await resumoMusicas()); });
    desligar.push(parar);
  } catch (e) { console.warn("Home: músicas", e.message); }
}
