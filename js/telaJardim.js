// Tela do Jardim: vasos, rega com quiz, colheita, pá, estufa (coleção) e loja de sementes.
import { E } from "./estado.js";
import * as JD from "./jardim.js";
import { plantaSVG } from "./arte/plantas.js";
import { abrirCamada, perguntaRapida } from "./jogos.js";
import { icone } from "./icones.js";
import { svgGema } from "./bausUI.js";
import { tocar, vibrar } from "./sons.js";
import { modal, toast, confete, escapar } from "./ui.js";
import { pips, pausarCartasForaDaTela, cartaoColecionador, celebrarColecionador } from "./telaColecao.js";
import { barraFiltros, lerFiltro, gravarFiltro } from "./filtros.js";
import * as COL from "./colecionador.js";

const tela = () => document.getElementById("tela");
let aoMudar = () => {}, relogio = null;
export function definirAoMudarJardim(fn) { aoMudar = fn; }
const ICONE_PROD = { moedas: "🪙", xp: "⚡", gemas: "💎" };
const NOME_PROD = { moedas: "moedas", xp: "XP", gemas: "gemas" };
const fmtT = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`; };
const precoTxt = (p) => (p.gemas ? `<span class="preco-gemas">${p.gemas} ${svgGema()}</span>` : `${p.moedas} moedas`);

// ---------- filtros da estufa e do "O que plantar?" ----------
const RARS = ["comum", "rara", "epica", "lendaria"];
const GRUPOS_ESTUFA = [
  { id: "raridade", titulo: "Raridade", opcoes: RARS.map(r => [r, JD.RARIDADES_PLANTA[r].nome]) },
  { id: "produz", titulo: "O que produz", opcoes: [["moedas", "Moedas"], ["xp", "XP"], ["gemas", "Gemas"]] },
  { id: "situacao", titulo: "Situação", opcoes: [["tem", "Encontradas"], ["falta", "Não encontradas"], ["vaso", "No vaso"], ["livre", "Na estufa (livres)"], ["pronta", "Prontas para colher"], ["evoluir", "Prontas para evoluir"], ["max", "Nível máximo"]] },
  { id: "nivel", titulo: "Nível", opcoes: [["1", "Nível 1"], ["2-4", "2 a 4"], ["5-9", "5 a 9"], ["10", "10 (máximo)"]] },
];
const ORDENS_PLANTA = [["raridade", "Raridade"], ["producao", "Mais produção por hora"], ["nivel", "Maior nível"], ["evoluir", "Mais perto de evoluir"], ["rapida", "Ciclo mais curto"], ["nome", "Nome (A–Z)"]];
const PADRAO_ESTUFA = { raridade: "", produz: "", situacao: "", nivel: "", ordem: "raridade" };
const CHAVE_ESTUFA = "oq.filtro.estufa", CHAVE_PLANTAR = "oq.filtro.plantar";
const faixaNivel = (n) => (n <= 1 ? "1" : n <= 4 ? "2-4" : n <= 9 ? "5-9" : "10");
/** Produção por hora (para comparar: gemas valem 50 moedas, XP vale 1 moeda). */
const porHora = (id) => { const st = JD.jardim().plantas[id], p = JD.PLANTAS[id]; return JD.producao(id, st?.nivel || 1) / p.horas; };
const valorHora = (id) => porHora(id) * (JD.PLANTAS[id].produz === "gemas" ? 50 : 1);
function passaPlanta(id, f) {
  const p = JD.PLANTAS[id], j = JD.jardim(), st = j.plantas[id], vaso = j.vasos.find(v => v?.id === id);
  if (f.raridade && p.raridade !== f.raridade) return false;
  if (f.produz && p.produz !== f.produz) return false;
  if (f.situacao === "tem" && !st) return false;
  if (f.situacao === "falta" && st) return false;
  if (f.situacao === "vaso" && !vaso) return false;
  if (f.situacao === "livre" && !(st && !vaso)) return false;
  if (f.situacao === "pronta" && !(vaso && JD.progresso(vaso).pct >= 1)) return false;
  if (f.situacao === "evoluir" && !JD.podeEvoluir(id)) return false;
  if (f.situacao === "max" && !(st && st.nivel >= JD.NIVEL_MAX_PLANTA)) return false;
  if (f.nivel && !(st && faixaNivel(st.nivel) === f.nivel)) return false;
  return true;
}
function ordenarPlantas(ids, ordem) {
  const st = (id) => JD.jardim().plantas[id], rar = (id) => RARS.indexOf(JD.PLANTAS[id].raridade);
  const nome = (a, b) => JD.PLANTAS[a].nome.localeCompare(JD.PLANTAS[b].nome, "pt-BR");
  const perto = (id) => { const n = JD.copiasParaEvoluir(id); return st(id) && n ? st(id).copias / n : -1; };
  const cmp = {
    raridade: (a, b) => rar(a) - rar(b),
    producao: (a, b) => (st(b) ? 1 : 0) - (st(a) ? 1 : 0) || valorHora(b) - valorHora(a),
    nivel: (a, b) => (st(b)?.nivel || 0) - (st(a)?.nivel || 0) || rar(b) - rar(a) || nome(a, b),
    evoluir: (a, b) => perto(b) - perto(a) || nome(a, b),
    rapida: (a, b) => JD.PLANTAS[a].horas - JD.PLANTAS[b].horas || nome(a, b),
    nome,
  }[ordem];
  return cmp ? [...ids].sort(cmp) : ids;
}
function botaoPlanta(id) {
  const j = JD.jardim(), p = JD.PLANTAS[id], st = j.plantas[id], rar = p.raridade, r = JD.RARIDADES_PLANTA[rar], n = JD.copiasParaEvoluir(id);
  const b = document.createElement("button"); b.className = "botao-carta"; b.dataset.planta = id;
  b.innerHTML = st
    ? `<div class="carta planta-carta ${rar} ${st.nivel >= JD.NIVEL_MAX_PLANTA ? "max" : ""}" style="--cor:${r.cor};--escura:${r.escura}"><i class="carta-fx" aria-hidden="true"></i><div class="carta-nivel">${st.nivel >= JD.NIVEL_MAX_PLANTA ? "★ " : ""}Nv. ${st.nivel}</div><div class="carta-arte"><i class="carta-luz" aria-hidden="true"></i>${plantaSVG(id, { classe: "vivo" })}${pips(rar)}<span class="planta-prod" title="${NOME_PROD[p.produz]}">${icone(ICONE_PROD[p.produz], "ico-inline")}</span></div><div class="carta-nome">${escapar(p.nome.split(" ")[0])}</div><div class="carta-barra ${JD.podeEvoluir(id) ? "pronta" : ""}"><div style="width:${n ? Math.min(100, st.copias / n * 100) : 100}%"></div><span>${n ? `${st.copias}/${n}` : "MÁX"}</span></div></div>`
    : `<div class="carta bloqueada" style="--cor:${r.cor};--escura:${r.escura}"><div class="carta-arte">${plantaSVG(id, { classe: "silhueta" })}<span class="carta-interroga" aria-hidden="true">?</span>${pips(rar)}</div><div class="carta-nome">???</div><div class="carta-rar">${r.nome}</div></div>`;
  b.onclick = () => (st ? detalhePlanta(id) : detalhePlantaBloqueada(id));
  return b;
}
async function detalhePlantaBloqueada(id) {
  const p = JD.PLANTAS[id], r = JD.RARIDADES_PLANTA[p.raridade];
  await modal({ titulo: "", html: `<div class="detalhe-carta bloq"><div class="avatar-grande silhueta-grande" style="width:130px">${plantaSVG(id, { classe: "silhueta" })}</div><h2>${escapar(p.nome)}</h2><small class="rar-txt" style="color:${r.cor}">${r.nome} · ainda não encontrada</small><p class="desc-carta">${escapar(p.desc)}</p>
    <div class="bonus-linha"><b>Produção:</b> ${JD.producao(id, 1)} ${NOME_PROD[p.produz]} a cada ${p.horas}h<br><small class="sub">No nível ${JD.NIVEL_MAX_PLANTA}: ${JD.producao(id, JD.NIVEL_MAX_PLANTA)}</small></div>
    <p class="sub onde-vem">${icone("🎁", "ico-inline")} ${p.raridade === "comum" ? "Sai nos baús a partir do de prata, no saco de sementes e nas ofertas do dia." : p.raridade === "lendaria" ? "Sai no baú lendário, nas sementes raras e épicas e nos baús de escolha." : "Sai nos baús de ouro em diante, nas sementes da loja e nas ofertas do dia."}</p></div>`,
    botoes: [{ texto: "Fechar", valor: null, classe: "secundario" }] });
}

export function telaJardim() {
  JD.atualizarProducao();
  const t = tela(), j = JD.jardim(), regado = JD.regadoAgora();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Trilha";
  v.onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "trilha" }));
  t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela" style="margin-top:4px">Jardim</h1>`);

  // ---- rega ----
  const rega = document.createElement("div"); rega.className = `cartao rega ${regado ? "ok" : "seca"}`;
  const ate = new Date(j.regadoAte);
  rega.innerHTML = `${icone(regado ? "💧" : "🌵", "ico3d ico-grande")}<div><b>${regado ? "Jardim regado" : "As plantas estão com sede"}</b><small>${regado ? `Produzindo até ${ate.toLocaleDateString("pt-BR", { weekday: "short" })} às ${ate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.` : "Sem rega, a produção para. Responda 5 perguntas da trilha (3 certas regam)."}${j.sequencia > 1 ? ` Sequência: ${j.sequencia} dias.` : ""}</small></div>`;
  const br = document.createElement("button"); br.className = "botao"; br.disabled = JD.regouHoje();
  br.textContent = JD.regouHoje() ? "Regado hoje" : "Regar com o quiz";
  br.onclick = () => quizRega();
  rega.append(br); t.append(rega);

  // ---- vasos ----
  const g = document.createElement("div"); g.className = "vasos";
  j.vasos.forEach((vs, i) => {
    const c = document.createElement("button"); c.className = "vaso";
    if (!vs) {
      c.classList.add("vazio");
      c.innerHTML = `<div class="vaso-arte">${icone("🌱", "ico3d")}</div><b>Vaso livre</b><small>Toque para plantar</small>`;
      c.onclick = () => escolherPlanta(i);
    } else {
      const p = JD.PLANTAS[vs.id], st = j.plantas[vs.id], pr = JD.progresso(vs), pronta = pr.pct >= 1;
      c.classList.toggle("pronta", pronta);
      c.innerHTML = `<div class="vaso-arte">${plantaSVG(vs.id, { humor: pronta ? "uau" : regado ? "feliz" : "sede", classe: "vivo", crescimento: 0.4 + 0.6 * pr.pct })}${pronta ? `<span class="balao-colher">${icone(ICONE_PROD[p.produz], "ico-inline")} ${JD.producao(vs.id, st.nivel)}</span>` : ""}</div>
        <b>${escapar(p.nome)}</b><small>Nv. ${st.nivel} · ${JD.producao(vs.id, st.nivel)} ${NOME_PROD[p.produz]} a cada ${p.horas}h</small>
        <div class="nivel-barra"><div style="width:${pr.pct * 100}%"></div></div><small class="tempo" data-vaso="${i}">${pronta ? "Pronta! Toque para colher" : regado ? `Falta ${fmtT(pr.falta)}` : "Parada: precisa de rega"}</small>`;
      c.onclick = () => (pronta ? colherVaso(i) : acoesVaso(i));
    }
    g.append(c);
  });
  const prox = JD.PRECO_VASOS[j.vasos.length - JD.VASOS_INICIAIS];
  if (prox) {
    const c = document.createElement("button"); c.className = "vaso bloq";
    c.innerHTML = `<div class="vaso-arte">${icone("🔒", "ico3d")}</div><b>Novo vaso</b><small>${precoTxt(prox)}</small>`;
    c.onclick = async () => {
      const ok = await modal({ titulo: "Comprar mais um vaso?", texto: `Custa ${prox.gemas ? `${prox.gemas} gemas` : `${prox.moedas} moedas`}.`, botoes: [{ texto: "Comprar", valor: true }, { texto: "Agora não", classe: "secundario", valor: false }] });
      if (!ok) return;
      const r = JD.comprarVaso(); if (r.erro) return toast(r.erro);
      tocar("moeda"); aoMudar(); telaJardim();
    };
    g.append(c);
  }
  t.append(g);

  // ---- estufa (com filtros: pedido do Alediov, 02/11/2026) ----
  const se = document.createElement("div"); se.className = "secao estufa";
  const total = Object.keys(JD.PLANTAS).length, tem = Object.keys(j.plantas).length;
  se.innerHTML = `<h2>Estufa</h2><p class="sub">${tem} de ${total} plantas. Sementes vêm dos baús (a partir do de prata), da loja abaixo e a cada 7 dias seguidos de rega.</p>`;
  se.append(cartaoColecionador(() => telaJardim()));
  const zonaBarra = document.createElement("div"), ge = document.createElement("div"); ge.className = "grade-cartas";
  se.append(zonaBarra, ge); t.append(se);
  let f = lerFiltro(CHAVE_ESTUFA, PADRAO_ESTUFA);
  const ids = Object.keys(JD.PLANTAS);
  const contar = (x) => ids.filter(id => passaPlanta(id, x)).length;
  const redesenhar = () => {
    zonaBarra.replaceChildren(barraFiltros({ grupos: GRUPOS_ESTUFA, ordens: ORDENS_PLANTA, f, padrao: PADRAO_ESTUFA, contar, aoMudar: (nf) => { f = nf; gravarFiltro(CHAVE_ESTUFA, f); redesenhar(); }, classe: "fil-estufa" }));
    const lista = ordenarPlantas(ids.filter(id => passaPlanta(id, f)), f.ordem);
    ge.innerHTML = lista.length ? "" : `<div class="fil-vazio">${icone("🔍", "ico3d")}<p>Nenhuma planta com esses filtros.</p></div>`;
    ge.classList.toggle("vazia", !lista.length);
    for (const id of lista) ge.append(botaoPlanta(id));
    requestAnimationFrame(() => pausarCartasForaDaTela(se));
  };
  redesenhar();

  // ---- loja de sementes ----
  const sl = document.createElement("div"); sl.className = "secao";
  sl.innerHTML = `<h2>Sementes</h2>`;
  const gl = document.createElement("div"); gl.className = "grade-loja";
  for (const [tipo, pk] of Object.entries(JD.PACOTES)) {
    const d = document.createElement("div"); d.className = "item-loja";
    const chances = Object.entries(pk.pesos).map(([k, w]) => `${JD.RARIDADES_PLANTA[k].nome.toLowerCase()} ${w}%`).join(", ");
    d.innerHTML = `<div class="item-ico">${icone(tipo === "saco" ? "🌱" : tipo === "rara" ? "🍀" : "🌟", "ico3d ico-loja")}</div><h3>${pk.nome}</h3><p>${chances}</p><p>${precoTxt(pk.preco)}</p>`;
    const b = document.createElement("button"); b.className = "botao"; b.textContent = "Comprar";
    b.onclick = async () => { const r = JD.comprarPacote(tipo); if (r.erro) return toast(r.erro); await revelarSemente(r); aoMudar(); telaJardim(); };
    d.append(b); gl.append(d);
  }
  sl.append(gl); t.append(sl);

  clearInterval(relogio);
  relogio = setInterval(() => {
    if (!document.body.contains(g)) return clearInterval(relogio);
    JD.atualizarProducao();
    let mudou = false;
    g.querySelectorAll(".tempo[data-vaso]").forEach(el => {
      const vs = JD.jardim().vasos[+el.dataset.vaso]; if (!vs) return;
      const pr = JD.progresso(vs);
      if (pr.pct >= 1 && !el.textContent.startsWith("Pronta")) mudou = true;
      else if (JD.regadoAgora() && pr.pct < 1) el.textContent = `Falta ${fmtT(pr.falta)}`;
      el.previousElementSibling.firstElementChild.style.width = `${pr.pct * 100}%`;
    });
    if (mudou) telaJardim();
  }, 30000);
}

export async function revelarSemente({ id, nova }) {
  const p = JD.PLANTAS[id], r = JD.RARIDADES_PLANTA[p.raridade];
  tocar(nova ? "ofensiva" : "moeda"); if (nova) confete();
  await modal({ titulo: nova ? `Nova planta: ${p.nome}!` : `Semente de ${p.nome}`, html: `<div class="avatar-grande" style="width:140px">${plantaSVG(id, { humor: "uau" })}</div>`,
    texto: nova ? `${r.nome}. Produz ${NOME_PROD[p.produz]} a cada ${p.horas}h. Plante num vaso livre!` : "Virou uma cópia para evoluir a planta na estufa.", botoes: [{ texto: "Legal!", valor: true }] });
}

async function quizRega() {
  const cam = abrirCamada("Regar o jardim", { aoFechar: () => telaJardim(), musica: "jardim" });
  cam.corpo.innerHTML = `<div class="fim">${icone("💧", "ico3d ico-item")}<h1>Hora de regar</h1><p class="sub">5 perguntas da trilha. Com 3 acertos o jardim fica regado por 24 horas; com 5, as plantas ainda ganham 2 horas de crescimento.</p></div>`;
  let acertos = 0;
  for (let k = 0; k < 5; k++) {
    if (cam.saiu) return;
    cam.info.textContent = `${k + 1}/5`;
    if (await perguntaRapida(cam, `Rega · pergunta ${k + 1} de 5`)) acertos++;
  }
  const r = JD.regar(acertos, 5);
  cam.info.textContent = "";
  cam.corpo.innerHTML = `<div class="fim">${icone(r.ok ? "🌈" : "🌵", "ico3d ico-item")}<h1>${r.ok ? (r.perfeito ? "Chuva dourada!" : "Jardim regado!") : "Não deu para regar"}</h1>
    <p class="sub">${acertos} de 5 certas. ${r.ok ? `As plantas produzem pelas próximas 24 horas.${r.perfeito ? " Ganharam 2 horas de crescimento." : ""}${r.sequencia > 1 ? ` Sequência: ${r.sequencia} dias.` : ""}` : "Precisa de 3 acertos. Tente de novo."}</p></div>`;
  if (r.ok) { tocar(r.perfeito ? "combo" : "fim"); confete(); } else tocar("errado");
  const b = document.createElement("button"); b.className = "botao"; b.textContent = r.ok ? "Ver o jardim" : "Tentar de novo";
  b.onclick = async () => { cam.raiz.remove(); if (!r.ok) return quizRega(); if (r.bonusSeq) await revelarSemente(r.bonusSeq); aoMudar(); telaJardim(); };
  const rod = document.createElement("div"); rod.className = "jogo-rodape"; rod.append(b); cam.corpo.append(rod);
  window.dispatchEvent(new Event("oq-titulos"));
}

async function escolherPlanta(i) {
  const j = JD.jardim(), plantadas = new Set(j.vasos.filter(Boolean).map(v => v.id));
  const livres = Object.keys(j.plantas).filter(id => !plantadas.has(id) && JD.PLANTAS[id]);
  if (!livres.length) return toast("Todas as suas plantas já estão em vasos. Consiga sementes novas!");
  const grupos = GRUPOS_ESTUFA.filter(g => g.id === "produz" || g.id === "raridade");
  const padrao = { produz: "", raridade: "", ordem: "producao" };
  let f = lerFiltro(CHAVE_PLANTAR, padrao);
  const pr = modal({ titulo: "", html: `<div class="plantar-cab"><h2 class="plantar-tit">O que plantar?</h2></div><div class="plantar-filtros"></div><div class="escolha-plantas"></div>`, botoes: [{ texto: "Cancelar", classe: "secundario", valor: null }] });
  const caixa = document.querySelector("#modal .modal-caixa");
  const zona = caixa.querySelector(".plantar-filtros"), grade = caixa.querySelector(".escolha-plantas");
  const contar = (x) => livres.filter(id => passaPlanta(id, x)).length;
  const desenhar = () => {
    zona.replaceChildren(barraFiltros({ grupos, ordens: ORDENS_PLANTA.filter(([v]) => !["evoluir"].includes(v)), f, padrao, contar, rapido: "produz", aoMudar: (nf) => { f = nf; gravarFiltro(CHAVE_PLANTAR, f); desenhar(); }, classe: "fil-plantar" }));
    const lista = ordenarPlantas(livres.filter(id => passaPlanta(id, f)), f.ordem);
    grade.innerHTML = lista.length ? lista.map(id => { const p = JD.PLANTAS[id], st = j.plantas[id], r = JD.RARIDADES_PLANTA[p.raridade]; return `<button data-id="${id}" class="escolha-planta ${p.raridade}" style="--cor:${r.cor}">${plantaSVG(id)}<b>${escapar(p.nome)}</b><small>Nv. ${st.nivel} · ${JD.producao(id, st.nivel)} ${NOME_PROD[p.produz]}/${p.horas}h</small><small class="ep-hora">${icone(ICONE_PROD[p.produz], "ico-inline")} ${fmtHora(porHora(id), p.produz)}/h</small></button>`; }).join("")
      : `<div class="fil-vazio"><p>Nenhuma planta livre com esses filtros.</p></div>`;
    grade.querySelectorAll(".escolha-planta").forEach(b => b.onclick = () => {
      document.querySelector("#modal .botao.secundario")?.click();
      if (JD.plantar(i, b.dataset.id)) { tocar("par"); vibrar(15); }
      aoMudar(); telaJardim();
    });
  };
  desenhar();
  await pr;
}
const fmtHora = (v, tipo) => (tipo === "gemas" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

async function colherVaso(i) {
  const vs = JD.jardim().vasos[i], r = JD.colher(i);
  if (!r) return;
  tocar(r.tipo === "gemas" ? "combo" : "moeda"); vibrar(25);
  toast(`+${r.qtd} ${NOME_PROD[r.tipo]} de ${JD.PLANTAS[vs.id].nome}!`);
  aoMudar(); telaJardim();
}

async function acoesVaso(i) {
  const vs = JD.jardim().vasos[i], p = JD.PLANTAS[vs.id];
  const v = await modal({ titulo: p.nome, html: `<div class="avatar-grande" style="width:120px">${plantaSVG(vs.id)}</div>`, texto: p.desc, botoes: [
    { texto: "Ver na estufa", valor: "ver" }, { texto: "Tirar com a pá", valor: "pa", classe: "secundario" }, { texto: "Fechar", valor: null, classe: "secundario" }] });
  if (v === "ver") return detalhePlanta(vs.id);
  if (v === "pa") {
    const ok = await modal({ titulo: "Tirar do vaso?", texto: "A planta volta para a estufa com o mesmo nível, mas o crescimento atual é perdido.", botoes: [{ texto: "Tirar", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] });
    if (!ok) return;
    const r = JD.desplantar(i); tocar("toque");
    if (r?.colheu) toast(`Colhido antes: +${r.colheu.qtd} ${NOME_PROD[r.colheu.tipo]}`);
    aoMudar(); telaJardim();
  }
}

async function detalhePlanta(id) {
  const p = JD.PLANTAS[id], st = JD.jardim().plantas[id], r = JD.RARIDADES_PLANTA[p.raridade];
  const n = JD.copiasParaEvoluir(id), pode = JD.podeEvoluir(id), custo = JD.custoEvoluir(id);
  const prox = st.nivel < JD.NIVEL_MAX_PLANTA ? JD.producao(id, st.nivel + 1) : null;
  const html = `<div class="detalhe-carta"><div class="avatar-grande" style="width:130px">${plantaSVG(id, { humor: "uau" })}</div><h2>${escapar(p.nome)}</h2><small class="rar-txt" style="color:${r.cor}">${r.nome}, nível ${st.nivel}</small><p class="desc-carta">${escapar(p.desc)}</p>
    <div class="bonus-linha"><b>Produção:</b> ${JD.producao(id, st.nivel)} ${NOME_PROD[p.produz]} a cada ${p.horas}h${prox != null ? `<br><small class="sub">No nível ${st.nivel + 1}: ${prox}</small>` : ""}</div>
    <p class="sub">${n ? `${pode ? "Pronta para evoluir!" : `Sementes: ${st.copias}/${n}`} Evoluir rende <b>+${COL.pontosDaEvolucao(p.raridade, st.nivel)}</b> pontos de colecionador.` : "Nível máximo."}</p></div>`;
  const botoes = [];
  if (pode) { botoes.push({ texto: `Evoluir por ${custo.moedas} moedas`, valor: "moedas" }); botoes.push({ texto: `Evoluir por ${custo.gemas} ${custo.gemas === 1 ? "gema" : "gemas"}`, valor: "gemas", classe: "secundario" }); }
  botoes.push({ texto: "Fechar", valor: null, classe: "secundario" });
  const v = await modal({ titulo: "", html, botoes });
  if (v === "moedas" || v === "gemas") {
    const antes = COL.nivelColecionador().n, pts = COL.pontosDaEvolucao(p.raridade, st.nivel);
    const res = JD.evoluir(id, v);
    if (res.erro) toast(res.erro); else { tocar("fim"); confete(); toast(`${p.nome} subiu para o nível ${res.nivel}! +${pts} pontos de colecionador`); await celebrarColecionador(antes); }
    aoMudar(); telaJardim();
  }
}
