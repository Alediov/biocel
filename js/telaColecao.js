// Telas da Coleção (cartas de companheiros) e dos Títulos.
import { E } from "./estado.js";
import * as CO from "./colecao.js";
import { TITULOS, titulosEstado, equiparTitulo, progresso, svgTitulo } from "./titulos.js";
import { tocar } from "./sons.js";
import { modal, toast, confete, escapar, dataBR } from "./ui.js";
import { SAZONAIS, proximosSazonais } from "./eventos.js";
import * as COL from "./colecionador.js";
import { barraFiltros, lerFiltro, gravarFiltro, ativos } from "./filtros.js";
import { icone } from "./icones.js";
import { POCOES, RARIDADES as RAR_BAU } from "./economia.js";

const tela = () => document.getElementById("tela");
let aoMudar = () => {};
export function definirAoMudarColecao(fn) { aoMudar = fn; }

const ORDEM = ["comum", "rara", "epica", "lendaria"];

const PIPS = { comum: 1, rara: 2, epica: 3, lendaria: 4 };
export const pips = (rar) => `<span class="carta-pips" aria-hidden="true">${"<i></i>".repeat(PIPS[rar] || 1)}</span>`;
// faíscas por cima da arte das épicas e lendárias (CSS: .cb)
const faiscas = (rar) => (rar === "epica" || rar === "lendaria" ? [[12, 18, 0], [80, 12, 0.9], [86, 66, 1.7], [14, 72, 2.4]].slice(0, rar === "lendaria" ? 4 : 2).map(([x, y, d]) => `<b class="cb" style="left:${x}%;top:${y}%;--d:${d}s"></b>`).join("") : "");

/** Carta da Coleção (guia v2): moldura e fundo da arte pela raridade (raios nas raras, holográfico nas épicas, raios
 *  girando e borda animada nas lendárias), pips da raridade, nível (dourado no máximo) e a barra de cópias. */
export function cartaHTML(id, { mini = false } = {}) {
  const c = CO.CARTAS[id], r = CO.RARIDADES_CARTA[c.raridade], st = CO.colecao().cartas[id];
  if (!st) {
    const ev = c.evento ? SAZONAIS.find(e => e.id === c.evento) : null;
    return `<div class="carta bloqueada ${mini ? "mini" : ""}" style="--cor:${r.cor};--escura:${r.escura}"><div class="carta-arte">${CO.arteCarta(id, { classe: "silhueta", semFundo: true })}<span class="carta-interroga" aria-hidden="true">?</span>${pips(c.raridade)}</div><div class="carta-nome">${ev ? escapar(c.nome) : "???"}</div><div class="carta-rar">${ev ? escapar(ev.nome) : r.nome}</div></div>`;
  }
  const n = CO.copiasParaEvoluir(id), pct = n ? Math.min(100, st.copias / n * 100) : 100, pode = CO.podeEvoluir(id), max = st.nivel >= CO.NIVEL_MAX;
  return `<div class="carta ${c.raridade} ${mini ? "mini" : ""} ${CO.equipada() === id ? "equipada" : ""} ${max ? "max" : ""}" style="--cor:${r.cor};--escura:${r.escura}">
    <i class="carta-fx" aria-hidden="true"></i>
    <div class="carta-nivel">${max ? "★ " : ""}Nv. ${st.nivel}</div>
    <div class="carta-arte"><i class="carta-luz" aria-hidden="true"></i>${CO.arteCarta(id, { classe: "vivo" })}${faiscas(c.raridade)}${pips(c.raridade)}</div>
    <div class="carta-nome">${escapar(c.nome)}</div>
    <div class="carta-barra ${pode ? "pronta" : ""}"><div style="width:${pct}%"></div><span>${n ? `${st.copias}/${n}` : "MÁX"}</span></div>
  </div>`;
}

/** Pausa as animações das cartas fora da tela (são dezenas de cartas vivas na Coleção e na estufa). */
let observador = null;
export function pausarCartasForaDaTela(raiz) {
  if (!("IntersectionObserver" in window)) return;
  observador?.disconnect();
  observador = new IntersectionObserver((es) => { for (const e of es) e.target.toggleAttribute("data-fora", !e.isIntersecting); }, { rootMargin: "80px 0px" });
  raiz.querySelectorAll(".carta").forEach(el => { el.setAttribute("data-fora", ""); observador.observe(el); });
}

/** Inclinação 3D e brilho que seguem o dedo (carta grande do detalhe). */
function ligarInclinacao(el) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.classList.add("inclina");
  const mexe = (e) => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - y) * 16).toFixed(2)}deg`); el.style.setProperty("--ry", `${((x - 0.5) * 18).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`); el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  };
  const solta = () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); };
  el.addEventListener("pointermove", mexe); el.addEventListener("pointerdown", mexe);
  el.addEventListener("pointerleave", solta); el.addEventListener("pointerup", solta); el.addEventListener("pointercancel", solta);
}

// ---------- filtros da Coleção (pedido do Alediov, 02/11/2026) ----------
const NOME_BONUS = { xp: "XP em tudo", xpManha: "XP da manhã", xpTarde: "XP da tarde", xpNoite: "XP da noite", xpPerfeita: "Lição perfeita", moedas: "Moedas",
  gemaChance: "Gemas", bauTempo: "Baús mais rápidos", pocaoDuracao: "Poções mais longas", presenca: "Presenças", curriculo: "Currículo" };
const TIPO_ARTE = { dente: "Dentes", humano: "Pessoas", avatar: "Pessoas", bicho: "Bichos e criaturas" };
const origemDe = (c) => (c.premio ? "premio" : c.evento ? "evento" : "baus");
const faixaNivel = (n) => (n <= 1 ? "1" : n <= 4 ? "2-4" : n <= 9 ? "5-9" : "10");
const GRUPOS_CARTAS = [
  { id: "raridade", titulo: "Raridade", opcoes: ORDEM.map(r => [r, CO.RARIDADES_CARTA[r].nome]) },
  { id: "situacao", titulo: "Situação", opcoes: [["tem", "Encontradas"], ["falta", "Não encontradas"], ["evoluir", "Prontas para evoluir"], ["max", "Nível máximo"]] },
  { id: "bonus", titulo: "Habilidade (bônus)", opcoes: Object.entries(NOME_BONUS) },
  { id: "arte", titulo: "Tipo", opcoes: [["dente", "Dentes"], ["humano", "Pessoas"], ["bicho", "Bichos e criaturas"]] },
  { id: "nivel", titulo: "Nível", opcoes: [["1", "Nível 1"], ["2-4", "2 a 4"], ["5-9", "5 a 9"], ["10", "10 (máximo)"]] },
  { id: "origem", titulo: "De onde vem", opcoes: [["baus", "Baús e ofertas"], ["evento", "Eventos"], ["premio", "Prêmio de colecionador"]] },
];
const ORDENS_CARTAS = [["raridade", "Raridade"], ["nivel", "Maior nível"], ["evoluir", "Mais perto de evoluir"], ["bonus", "Maior bônus"], ["nome", "Nome (A–Z)"]];
const PADRAO_CARTAS = { raridade: "", situacao: "", bonus: "", arte: "", nivel: "", origem: "", ordem: "raridade" };
const CHAVE_FILTRO = "oq.filtro.cartas";

function passaCarta(id, f) {
  const c = CO.CARTAS[id], st = CO.colecao().cartas[id];
  if (f.raridade && c.raridade !== f.raridade) return false;
  if (f.bonus && c.bonus.tipo !== f.bonus) return false;
  if (f.arte && (TIPO_ARTE[c.arte.tipo] !== TIPO_ARTE[f.arte])) return false;
  if (f.origem && origemDe(c) !== f.origem) return false;
  if (f.situacao === "tem" && !st) return false;
  if (f.situacao === "falta" && st) return false;
  if (f.situacao === "evoluir" && !CO.podeEvoluir(id)) return false;
  if (f.situacao === "max" && !(st && st.nivel >= CO.NIVEL_MAX)) return false;
  if (f.nivel && !(st && faixaNivel(st.nivel) === f.nivel)) return false;
  return true;
}
function ordenarCartas(ids, ordem) {
  const st = (id) => CO.colecao().cartas[id], rar = (id) => ORDEM.indexOf(CO.CARTAS[id].raridade);
  const perto = (id) => { const n = CO.copiasParaEvoluir(id); return st(id) && n ? st(id).copias / n : -1; };
  const nome = (a, b) => CO.CARTAS[a].nome.localeCompare(CO.CARTAS[b].nome, "pt-BR");
  const cmp = {
    nivel: (a, b) => (st(b)?.nivel || 0) - (st(a)?.nivel || 0) || rar(b) - rar(a) || nome(a, b),
    evoluir: (a, b) => perto(b) - perto(a) || nome(a, b),
    bonus: (a, b) => (st(b) ? CO.valorBonus(b, st(b).nivel) : -1) - (st(a) ? CO.valorBonus(a, st(a).nivel) : -1) || nome(a, b),
    nome,
  }[ordem];
  return cmp ? [...ids].sort(cmp) : ids;
}

export function telaColecao() {
  const t = tela(), col = CO.colecao(), ids = Object.keys(CO.CARTAS);
  const eq = CO.equipada(), st = col.cartas[eq];
  t.innerHTML = `<h1 class="titulo-tela">Coleção</h1><p class="sub">${Object.keys(col.cartas).length} de ${ids.length} companheiros. Novas cartas vêm dos baús e das ofertas do dia da loja.</p>`;
  t.append(cartaoColecionador(() => telaColecao()));
  const dest = document.createElement("div"); dest.className = `cartao destaque-carta ${CO.CARTAS[eq].raridade}`;
  dest.innerHTML = `<div class="destaque-arte"><i class="palco-luz" aria-hidden="true"></i>${CO.arteCarta(eq, { classe: "vivo acena" })}</div><div><small class="sub">Companheiro equipado</small><h2>${escapar(CO.CARTAS[eq].nome)}</h2><p class="bonus-txt">${CO.BONUS[CO.CARTAS[eq].bonus.tipo](CO.valorBonus(eq, st.nivel))}</p></div>`;
  t.append(dest);
  const zonaBarra = document.createElement("div"), lista = document.createElement("div"); lista.className = "lista-colecao";
  t.append(zonaBarra, lista);
  let f = lerFiltro(CHAVE_FILTRO, PADRAO_CARTAS);
  const contar = (x) => ids.filter(id => passaCarta(id, x)).length;
  const redesenhar = () => {
    zonaBarra.replaceChildren(barraFiltros({ grupos: GRUPOS_CARTAS, ordens: ORDENS_CARTAS, f, padrao: PADRAO_CARTAS, contar, aoMudar: (nf) => { f = nf; gravarFiltro(CHAVE_FILTRO, f); redesenhar(); }, classe: "fil-cartas" }));
    desenharCartas(lista, ids.filter(id => passaCarta(id, f)), f);
  };
  redesenhar();
}

function botaoCarta(id) {
  const b = document.createElement("button"); b.className = "botao-carta"; b.dataset.carta = id; b.innerHTML = cartaHTML(id);
  b.onclick = () => (CO.colecao().cartas[id] ? detalhe(id) : detalheBloqueada(id));
  return b;
}
function desenharCartas(lista, ids, f) {
  lista.innerHTML = "";
  if (!ids.length) { lista.innerHTML = `<div class="fil-vazio">${icone("🔍", "ico3d")}<p>Nenhuma carta com esses filtros.</p></div>`; return; }
  const filtrando = ativos(f, GRUPOS_CARTAS) > 0;
  if (f.ordem !== "raridade") {
    const g = document.createElement("div"); g.className = "grade-cartas";
    for (const id of ordenarCartas(ids, f.ordem)) g.append(botaoCarta(id));
    lista.append(g);
  } else {
    const grupos = [...ORDEM.map(rar => [CO.RARIDADES_CARTA[rar].plural, "", ids.filter(i => CO.CARTAS[i].raridade === rar && origemDe(CO.CARTAS[i]) === "baus")]),
      ["De eventos", "Só saem do baú da loja de cada evento, que volta todo ano.", proximosSazonais().map(ev => ev.carta).filter(id => ids.includes(id))],
      ["Prêmio de colecionador", `Vem no nível ${COL.NIVEL_CARTA} de colecionador: evolua cartas e plantas.`, ids.filter(i => origemDe(CO.CARTAS[i]) === "premio")]];
    for (const [nome, sub, doGrupo] of grupos) {
      if (!doGrupo.length) continue;
      const sec = document.createElement("div"); sec.className = "secao";
      sec.innerHTML = `<h2>${nome}${filtrando ? ` <small class="sub">${doGrupo.length}</small>` : ""}</h2>${sub && !filtrando ? `<p class="sub">${sub}</p>` : ""}`;
      const g = document.createElement("div"); g.className = "grade-cartas";
      for (const id of doGrupo) g.append(botaoCarta(id));
      sec.append(g); lista.append(sec);
    }
  }
  requestAnimationFrame(() => pausarCartasForaDaTela(lista));
}

/** Onde se consegue uma carta (para o detalhe das não encontradas). */
function ondeVem(id) {
  const c = CO.CARTAS[id];
  if (c.premio) return `Prêmio do nível ${COL.NIVEL_CARTA} de colecionador (você está no nível ${COL.nivelColecionador().n}).`;
  if (c.evento) { const ev = SAZONAIS.find(e => e.id === c.evento), px = proximosSazonais().find(e => e.id === c.evento) || ev; return `Sai no baú da loja do evento ${ev?.nome || ""}${px?.ini ? ` (${dataBR(px.ini)} a ${dataBR(px.fim)})` : ""}.`; }
  return { comum: "Sai em qualquer baú e nas ofertas do dia.", rara: "Sai a partir do baú de prata e nas ofertas do dia.", epica: "Sai a partir do baú de ouro, nos baús de escolha e nas ofertas do dia.", lendaria: "Sai no baú lendário, nos baús de escolha e nas ofertas do dia por gemas." }[c.raridade];
}
/** Detalhe de uma carta ainda não encontrada (pedido do Alediov, 02/11/2026: "ver a descrição das cartas, mesmo sem
 *  tê-las"): a silhueta, o nome, a descrição, a habilidade no nível 1 e no 10 e onde ela sai. */
async function detalheBloqueada(id) {
  const c = CO.CARTAS[id], r = CO.RARIDADES_CARTA[c.raridade];
  const html = `<div class="detalhe-carta bloq">${cartaHTML(id)}<h2>${escapar(c.nome)}</h2><small class="rar-txt" style="color:${r.cor}">${r.nome} · ainda não encontrada</small><p class="desc-carta">${escapar(c.desc)}</p>
    <div class="bonus-linha"><b>Habilidade:</b> ${CO.BONUS[c.bonus.tipo](CO.valorBonus(id, 1))}<br><small class="sub">No nível ${CO.NIVEL_MAX}: ${CO.BONUS[c.bonus.tipo](CO.valorBonus(id, CO.NIVEL_MAX))}</small></div>
    <p class="sub onde-vem">${icone("🎁", "ico-inline")} ${escapar(ondeVem(id))}</p></div>`;
  await modal({ titulo: "", html, botoes: [{ texto: "Fechar", valor: null, classe: "secundario" }] });
}

async function detalhe(id) {
  const c = CO.CARTAS[id], st = CO.colecao().cartas[id], r = CO.RARIDADES_CARTA[c.raridade], est = E();
  const custo = CO.custoEvoluir(id), n = CO.copiasParaEvoluir(id), pode = CO.podeEvoluir(id);
  const agora = CO.BONUS[c.bonus.tipo](CO.valorBonus(id, st.nivel));
  const prox = st.nivel < CO.NIVEL_MAX ? CO.BONUS[c.bonus.tipo](CO.valorBonus(id, st.nivel + 1)) : null;
  const html = `<div class="detalhe-carta">${cartaHTML(id)}<h2>${escapar(c.nome)}</h2><small class="rar-txt" style="color:${r.cor}">${r.nome}, nível ${st.nivel}</small><p class="desc-carta">${escapar(c.desc)}</p>
    <div class="bonus-linha"><b>Bônus:</b> ${agora}${prox ? `<br><small class="sub">No nível ${st.nivel + 1}: ${prox}</small>` : ""}</div>
    ${n ? `<p class="sub">${pode ? "Pronta para evoluir!" : `Faltam ${n - st.copias} cópia(s) para evoluir.`} Evoluir rende <b>+${COL.pontosDaEvolucao(c.raridade, st.nivel)}</b> pontos de colecionador.</p>` : `<p class="sub">Nível máximo.</p>`}</div>`;
  const botoes = [];
  if (CO.equipada() !== id) botoes.push({ texto: "Equipar", valor: "equipar" });
  if (pode) {
    botoes.push({ texto: `Evoluir por ${custo.moedas} moedas`, valor: "moedas", classe: est.moedas >= custo.moedas ? "" : "secundario" });
    botoes.push({ texto: `Evoluir por ${custo.gemas} ${custo.gemas === 1 ? "gema" : "gemas"}`, valor: "gemas", classe: "secundario" });
  }
  botoes.push({ texto: "Fechar", valor: null, classe: "secundario" });
  const aberto = modal({ titulo: "", html, botoes });
  ligarInclinacao(document.querySelector("#modal .detalhe-carta .carta"));
  const v = await aberto;
  if (v === "equipar") { CO.equipar(id); tocar("combo"); toast(`${c.nome} agora te acompanha!`); }
  else if (v === "moedas" || v === "gemas") {
    const antes = COL.nivelColecionador().n, pts = COL.pontosDaEvolucao(c.raridade, st.nivel);
    const res = CO.evoluir(id, v);
    if (res.erro) toast(res.erro);
    else {
      tocar("fim"); confete();
      await modal({ titulo: `${c.nome} subiu para o nível ${res.nivel}!`, html: `<div class="detalhe-carta sobe-nivel"><i class="explosao" aria-hidden="true"></i>${cartaHTML(id)}</div>`, texto: `${CO.BONUS[c.bonus.tipo](CO.valorBonus(id, res.nivel))}. +${pts} pontos de colecionador.`, botoes: [{ texto: "Demais!", valor: true }] });
      await celebrarColecionador(antes);
    }
  }
  aoMudar(); telaColecao();
}

// ======================= NÍVEL DE COLECIONADOR =======================
const ICO_PREMIO = { moedas: "🪙", gemas: "💎", pocao: "⚗️", bau: "🎁", carta: "🃏", titulo: "🏅" };
function textoPremio(it) {
  if (it.tipo === "moedas") return `${it.qtd} moedas`;
  if (it.tipo === "gemas") return `${it.qtd} gemas`;
  if (it.tipo === "pocao") return POCOES[it.pocao]?.nome || "Poção";
  if (it.tipo === "bau") return `${RAR_BAU[it.bau]?.nome || "Baú"} (já aberto)`;
  if (it.tipo === "carta") return `Carta exclusiva: ${CO.CARTAS[it.carta].nome}`;
  if (it.tipo === "titulo") return `Título: ${TITULOS.find(x => x.id === it.titulo)?.nome || ""}`;
  return "";
}
const htmlPremios = (n) => COL.premiosDoNivel(n).map(it => `<span class="col-premio ${it.tipo}">${icone(ICO_PREMIO[it.tipo], "ico-inline")}${escapar(textoPremio(it))}</span>`).join("");

/** Cartão com o nível de colecionador (no alto da Coleção e da estufa do Jardim). */
export function cartaoColecionador(voltar) {
  const nv = COL.nivelColecionador(), pend = COL.pendentes();
  const b = document.createElement("button"); b.className = `cartao col-cartao ${pend.length ? "tem-premio" : ""}`;
  b.innerHTML = `<span class="col-selo"><b>${nv.n}</b></span><span class="col-txt"><b>Nível ${nv.n} de colecionador</b><small>${pend.length ? `${pend.length} ${pend.length === 1 ? "prêmio" : "prêmios"} para resgatar` : `${nv.noNivel}/${nv.custo} pontos para o nível ${nv.n + 1}`}</small><span class="nivel-barra"><span style="width:${Math.min(100, nv.noNivel / nv.custo * 100)}%"></span></span></span>${pend.length ? `<span class="col-badge">${pend.length}</span>` : ""}`;
  b.onclick = () => telaColecionador(voltar);
  return b;
}

/** Depois de uma evolução: se subiu o nível de colecionador, comemora e oferece os prêmios. */
export async function celebrarColecionador(antes) {
  const nv = COL.nivelColecionador();
  if (nv.n <= antes) return;
  tocar("ofensiva"); confete();
  const v = await modal({ titulo: `Nível ${nv.n} de colecionador!`, html: `<div class="col-selo grande"><b>${nv.n}</b></div><div class="col-premios">${htmlPremios(nv.n)}</div>`, texto: "Evoluir cartas e plantas (mesmo as que você não usa) sobe este nível.", botoes: [{ texto: "Resgatar agora", valor: "ir" }, { texto: "Depois", classe: "secundario", valor: null }] });
  if (v === "ir") { const r = COL.resgatar(nv.n); if (r.erro) toast(r.erro, 3600); else { tocar("moeda"); toast(`Prêmios do nível ${nv.n} resgatados!`); } }
}

/** Tela do nível de colecionador: progresso, como ganhar pontos, prêmios por nível e de onde vêm os pontos. */
export function telaColecionador(voltar = () => telaColecao()) {
  const t = tela(), nv = COL.nivelColecionador(), pend = COL.pendentes();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Voltar"; v.onclick = voltar;
  t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela" style="margin-top:4px">Colecionador</h1>
    <div class="cartao col-heroi"><span class="col-selo grande"><b>${nv.n}</b></span><div><b>Nível ${nv.n}</b><small>${nv.pontos.toLocaleString("pt-BR")} pontos · ${nv.evolucoes} evoluções</small>
      <span class="nivel-barra"><span style="width:${Math.min(100, nv.noNivel / nv.custo * 100)}%"></span></span><small>${nv.noNivel}/${nv.custo} para o nível ${nv.n + 1}</small>
      <small class="sub">Cartas ${nv.cartas.toLocaleString("pt-BR")} · plantas ${nv.plantas.toLocaleString("pt-BR")}</small></div></div>
    <p class="sub">Cada evolução de carta ou planta vale pontos, use você ou não: ${ORDEM.map(r => `${CO.RARIDADES_CARTA[r].nome.toLowerCase()} ${COL.PONTOS[r]}`).join(", ")} × o nível de onde ela sai (de 3 para 4 numa rara: ${COL.PONTOS.rara * 3}). As evoluções de antes já contam.</p>`);
  if (pend.length) {
    const b = document.createElement("button"); b.className = "botao col-resgatar-tudo"; b.textContent = pend.length > 1 ? `Resgatar ${pend.length} níveis` : `Resgatar o nível ${pend[0]}`;
    b.onclick = () => {
      let ok = 0, erro = null;
      for (const n of COL.pendentes()) { const r = COL.resgatar(n); if (r.erro) { erro = r.erro; break; } ok++; }
      if (ok) { tocar("combo"); confete(1400); toast(`${ok} ${ok === 1 ? "nível resgatado" : "níveis resgatados"}!`); }
      if (erro) setTimeout(() => toast(erro, 3800), ok ? 1800 : 0);
      aoMudar(); telaColecionador(voltar);
    };
    t.append(b);
  }
  const sec = document.createElement("div"); sec.className = "secao";
  sec.innerHTML = `<h2>Prêmios por nível</h2>`;
  const lst = document.createElement("div"); lst.className = "col-niveis";
  const ate = Math.max(nv.n + 6, COL.NIVEL_CARTA, 12);
  const marcos = [20, 25, 30].filter(m => m > ate);
  for (const n of [...Array.from({ length: ate - 1 }, (_, k) => k + 2), ...marcos]) {
    const res = COL.resgatado(n), alc = n <= nv.n;
    const l = document.createElement("div"); l.className = `col-nivel ${res ? "feito" : alc ? "pronto" : "bloq"}`; l.dataset.nivel = n;
    l.innerHTML = `<span class="col-num">${n}</span><div class="col-premios">${htmlPremios(n)}</div>`;
    if (res) l.insertAdjacentHTML("beforeend", `<span class="col-ok">${icone("✅", "ico-inline")}</span>`);
    else if (alc) {
      const b = document.createElement("button"); b.className = "botao col-resg"; b.textContent = "Resgatar";
      b.onclick = () => { const r = COL.resgatar(n); if (r.erro) return toast(r.erro, 3600); tocar("moeda"); toast(`Prêmios do nível ${n} resgatados!`); aoMudar(); telaColecionador(voltar); };
      l.append(b);
    } else l.insertAdjacentHTML("beforeend", `<small class="col-falta">${(COL.custoAcumulado(n) - nv.pontos).toLocaleString("pt-BR")} pts</small>`);
    lst.append(l);
  }
  sec.append(lst); t.append(sec);
  const det = COL.detalhes().slice(0, 10);
  if (det.length) t.insertAdjacentHTML("beforeend", `<div class="secao"><h2>De onde vêm os pontos</h2><div class="cartao col-origem">${det.map(d => `<div><i class="bolinha-rar" style="background:${COL.COR_RAR(d.raridade)}"></i><span>${escapar(d.nome)}<small> · ${d.tipo === "carta" ? "carta" : "planta"}, nível ${d.nivel}</small></span><b>${d.pontos.toLocaleString("pt-BR")}</b></div>`).join("")}</div></div>`);
  requestAnimationFrame(() => t.querySelector(".col-nivel.pronto, .col-nivel.bloq")?.scrollIntoView({ block: "nearest" }));
}

// ======================= TÍTULOS =======================
export function telaTitulos(voltar) {
  const t = tela(), st = titulosEstado();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Perfil"; v.onclick = voltar;
  t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela" style="margin-top:4px">Títulos</h1><p class="sub">${st.conquistados.length} de ${TITULOS.length} conquistados. Só se ganha com feitos, e só um fica equipado.</p>`);
  const lista = document.createElement("div"); lista.className = "cartao";
  for (const tt of TITULOS) {
    const ok = st.conquistados.includes(tt.id), eq = st.equipado === tt.id;
    const p = progresso(tt);
    const l = document.createElement("div"); l.className = `linha-titulo ${ok ? "" : "bloq"}`;
    l.innerHTML = `${svgTitulo(tt, !ok)}<div class="txt"><b>${escapar(tt.nome)}</b><small>${escapar(tt.req)}</small><small class="bonus-txt">${CO.BONUS[tt.bonus.tipo](tt.bonus.v)}</small>${ok ? "" : `<div class="nivel-barra"><div style="width:${p / tt.meta * 100}%"></div></div><small>${p}/${tt.meta}</small>`}</div>`;
    if (ok) {
      const b = document.createElement("button"); b.className = `botao ${eq ? "secundario" : ""}`; b.textContent = eq ? "Equipado" : "Equipar";
      b.onclick = () => { equiparTitulo(tt.id); tocar("toque"); aoMudar(); telaTitulos(voltar); };
      l.append(b);
    }
    lista.append(l);
  }
  t.append(lista);
}

/** Celebra títulos recém-conquistados. */
export async function celebrarTitulos(novos) {
  for (const tt of novos) {
    tocar("ofensiva"); confete();
    await modal({ titulo: `Novo título: ${tt.nome}`, html: `<div style="width:96px;margin:0 auto 6px">${svgTitulo(tt)}</div>`, texto: `${tt.req}. Bônus: ${CO.BONUS[tt.bonus.tipo](tt.bonus.v)}.`, botoes: [{ texto: "Equipar", valor: "eq" }, { texto: "Depois", classe: "secundario", valor: null }] })
      .then(v => { if (v === "eq" && titulosEstado().equipado !== tt.id) equiparTitulo(tt.id); });
  }
  aoMudar();
}
