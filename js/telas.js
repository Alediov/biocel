// Telas principais: trilha, treino, loja e perfil.
import { E, salvar, hojeISO, somaDias, nivel, ganhar, substituirEstado, ofensivaReparavel, repararOfensiva } from "./estado.js";
import { listarDias, carregarDia, sincronizar, temToken, enviarBackup, baixarBackup } from "./dados.js";
import { iniciarLicao } from "./licao.js";
import { moli } from "./personagens.js";
import { icone } from "./icones.js";
import { decorarCaminho, temaDaSessao } from "./cenarioTrilha.js";
import { objetoSVG, TEMAS } from "./arte/cenario.js";
import { arteAvatar, av, telaAvatar } from "./telaAvatar.js";
import { tituloEquipado, titulosEstado, TITULOS, svgTitulo } from "./titulos.js";
import { telaTitulos, cartaHTML } from "./telaColecao.js";
import * as CO from "./colecao.js";
import { tocar, musica, reiniciarAudio } from "./sons.js";
import { volumeMusica, proximaFaixa, tocandoAgora, atualizarFundoNativo, reavaliarMusica } from "./musica.js";
import { faixaLiga } from "./liga.js";
import { faixaTemporada } from "./temporada.js";
import { modal, toast, escapar, formulario, confete } from "./ui.js";
import { abrirAjusteAlarmeExato, temNotificacoes } from "./notificacoes.js";
import { desenharSlots, desenharInventario, svgPocao, svgBau, svgGema, configurarAuto, comprarSlotModal } from "./bausUI.js";
import * as EC from "./economia.js";
import { darPocao, ganharBau, abaDaSessao } from "./economia.js";
let acenouNaSessao = false;
export { abaDaSessao };
import { eventoAtivo, eventosAcademicos, diaDoEvento, quandoEvento } from "./eventos.js";
import { comLicoesDeJogo, jogarComoLicao } from "./jogos.js";
import { bannerSazonal } from "./telaEventos.js";
import { regouHoje as jardimRegadoHoje, PLANTAS } from "./jardim.js";
import { plantaSVG } from "./arte/plantas.js";
import * as OF from "./ofertas.js";
import { DEMO } from "./edicao.js";

const tela = () => document.getElementById("tela");
let aoMudar = () => {};
export function definirAoMudar(fn) { aoMudar = fn; }

const SOL = `<svg class="astro" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>`;
const LUA = `<svg class="astro" viewBox="0 0 24 24"><path fill="currentColor" d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/><circle cx="17" cy="5" r="1" fill="currentColor"/><circle cx="20" cy="9" r=".8" fill="currentColor"/></svg>`;
const TARDE = `<svg class="astro" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17a7 7 0 0 1 14 0" fill="currentColor"/><path d="M2 20h20M12 5v3M4.2 9.2l2 2M19.8 9.2l-2 2"/></svg>`;
const PERIODOS = {
  manha: { nome: "manhã", astro: () => SOL },
  tarde: { nome: "tarde", astro: () => TARDE },
  noite: { nome: "noite", astro: () => LUA },
  // sessão extra (ex.: Farmacologia na semana da prova): título próprio, libera sempre e não conta no baú do dia
  extra: { nome: "sessão extra", astro: () => icone("💊", "ico3d ico-grande") },
  evento: { nome: "evento", astro: () => "" },
};
/** Sessões que contam para o dia completo e o baú do dia (a extra é bônus). */
export const sessoesDoDia = (dia) => (dia.sessoes || []).filter(s => s.periodo !== "extra");
const DESLOC = [0, 62, 92, 62, 0, -62, -92, -62];

function nomeDia(data) {
  const hoje = hojeISO();
  if (data === hoje) return "Hoje";
  if (data === somaDias(hoje, -1)) return "Ontem";
  if (data === somaDias(hoje, -2)) return "Anteontem";
  if (data === somaDias(hoje, 1)) return "Amanhã";
  return new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
}
const feito = (id) => !!E().concluidas[id];

// ======================= TRILHA =======================
let geracaoTrilha = 0;
export async function telaTrilha() {
  const t = tela(), gen = ++geracaoTrilha;
  const hoje = hojeISO();
  const dias = await listarDias();
  if (gen !== geracaoTrilha) return; // outra chamada começou depois: ela desenha
  t.innerHTML = "";

  const barra = document.createElement("div"); barra.className = "sync-barra";
  const us = E().ultimaSync ? new Date(E().ultimaSync) : null;
  barra.innerHTML = `<span>${us ? `Sincronizado ${us.toLocaleDateString("pt-BR") === new Date().toLocaleDateString("pt-BR") ? "hoje" : "em " + us.toLocaleDateString("pt-BR")} às ${us.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Ainda não sincronizado"}</span>`;
  const bs = document.createElement("button"); bs.className = "link"; bs.textContent = "Sincronizar";
  bs.onclick = () => executarSync(bs);
  barra.append(bs); t.append(barra);
  const zonaBaus = document.createElement("div"); t.append(zonaBaus); desenharSlots(zonaBaus);
  const atalhos = document.createElement("div"); atalhos.className = "atalhos-trilha";
  const semRega = !jardimRegadoHoje();
  for (const [k, [aba, ic, rot]] of [["treino", "🎯", "Treino"], ["jogos", "🎮", "Jogos"], ["jardim", "🌱", "Jardim"], ["eventos", "🗓️", "Eventos"]].entries()) {
    const b = document.createElement("button"); b.style.setProperty("--k", k); b.className = `atalho ${aba === "jardim" && semRega ? "alerta" : ""}`; b.innerHTML = `${icone(ic, "ico3d")}<span>${rot}</span>`;
    b.onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: aba }));
    atalhos.append(b);
  }
  t.append(atalhos);
  t.append(faixaLiga(), faixaTemporada());
  bannerSazonal(t);
  const eventosAc = await eventosAcademicos();
  if (gen !== geracaoTrilha) return;

  if (!dias.length && !eventosAc.length) {
    t.insertAdjacentHTML("beforeend", `<div class="vazio">${moli("neutro")}<h2>Nenhuma lição baixada</h2><p>Conecte-se à internet e toque em Sincronizar. Na primeira vez, ponha o token nos Ajustes do Órbita (a engrenagem da Home).</p></div>`);
    return;
  }

  // a trilha em três abas: Aulas (o fluxo das aulas), Extensão (projetos de extensão) e Provas (provas, seminários, trabalhos)
  const todosDias = [];
  for (const d of dias) {
    const dia = comLicoesDeJogo(await carregarDia(d));
    if (gen !== geracaoTrilha) return;
    todosDias.push(dia);
  }
  const porAba = (dia, aba) => ({ ...dia, sessoes: (dia.sessoes || []).filter(s => abaDaSessao(s) === aba) });
  const visiveisDa = (aba) => {
    const pend = [], concl = [], vis = [];
    for (const dia0 of todosDias) {
      const dia = porAba(dia0, aba), d = dia.data;
      if (!dia.sessoes.length) continue;
      const ids = dia.sessoes.flatMap(s => s.licoes.map(l => l.id));
      if (d < hoje) (ids.every(feito) ? concl : pend).push(dia);
      else if (d === hoje || d === somaDias(hoje, 1)) vis.push(dia);
    }
    return { mostrar: [...pend.slice(-3), ...vis], concluidos: concl };
  };
  const evAbertos = eventosAc.filter(e => !e.data || e.data >= hoje);
  const pendHoje = (aba) => todosDias.filter(d => d.data === hoje).flatMap(d => porAba(d, aba).sessoes).flatMap(s => s.licoes).filter(l => !feito(l.id)).length
    + (aba === "provas" ? evAbertos.reduce((n, ev) => n + diaDoEvento(ev).sessoes.filter(s => !s.liberaEm || s.liberaEm <= hoje).flatMap(s => s.licoes).filter(l => !feito(l.id)).length, 0) : 0);
  let aba = ABAS_TRILHA.some(a => a.id === E().config.abaTrilha) ? E().config.abaTrilha : "aulas";
  const seletor = document.createElement("div"); seletor.className = "abas-trilha"; seletor.setAttribute("role", "tablist");
  const paineis = {};
  for (const [k, A] of ABAS_TRILHA.entries()) {
    const n = pendHoje(A.id);
    const b = document.createElement("button"); b.className = "aba-trilha"; b.dataset.aba = A.id; b.style.setProperty("--k", k); b.setAttribute("role", "tab");
    b.innerHTML = `${icone(A.icone, "ico3d")}<b>${A.nome}</b>${n ? `<i class="pend-aba">${n}</i>` : ""}`;
    b.onclick = () => { if (aba === A.id) return; tocar("toque"); trocar(A.id, true); };
    seletor.append(b);
    paineis[A.id] = document.createElement("div"); paineis[A.id].className = "painel-trilha"; paineis[A.id].dataset.aba = A.id;
  }
  t.append(seletor, ...Object.values(paineis));
  // cada aba é montada só quando aparece: o cenário da trilha mede o tamanho do caminho, que é zero numa aba escondida
  const construir = {}, construida = {};
  const trocar = (id, rolar) => {
    aba = id; E().config.abaTrilha = id; salvar();
    for (const [k, el] of Object.entries(paineis)) el.hidden = k !== id;
    if (!construida[id]) { construida[id] = true; construir[id](); }
    seletor.querySelectorAll(".aba-trilha").forEach(b => { b.classList.toggle("on", b.dataset.aba === id); b.setAttribute("aria-selected", b.dataset.aba === id); });
    if (rolar) {
      const atual = paineis[id].querySelector(".no.atual");
      if (atual) atual.scrollIntoView({ block: "center", behavior: "smooth" });
      else seletor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  // ----- Aulas -----
  construir.aulas = () => {
    const P = paineis.aulas, { mostrar, concluidos } = visiveisDa("aulas");
    if (!mostrar.some(d => d.data === hoje)) {
      P.insertAdjacentHTML("beforeend", `<div class="vazio">${moli("neutro")}<h2>A lição de hoje ainda não chegou</h2><p>Toque em Sincronizar quando tiver internet. Enquanto isso, a aba Treino funciona offline.</p></div>`);
    }
    for (const aviso of todosDias.find(d => d.data === hoje)?.avisos || []) {
      P.insertAdjacentHTML("beforeend", `<div class="aviso-dia">${icone("💬", "ico3d ico-medio")}<div><b>Recado do Claude</b><br>${escapar(aviso)}</div></div>`);
    }
    let marcado = false;
    for (const dia of mostrar) marcado = desenharDia(P, dia, marcado) || marcado;
    if (!DEMO) {
      const ouv = document.createElement("div"); P.append(ouv); import("./ouvirDia.js").then(m => m.cartaoOuvirDia(ouv)).catch(e => console.warn("ouvir:", e));
      const sim = document.createElement("div"); P.append(sim); import("./simulado.js").then(m => m.cartaoSimulado(sim)).catch(e => console.warn("simulado:", e));
    }
    reverAnteriores(P, concluidos, {});
  };
  // ----- Extensão -----
  construir.extensao = () => {
    const P = paineis.extensao, { mostrar, concluidos } = visiveisDa("extensao");
    const projetos = EXTENSAO.map(x => {
      const ativo = todosDias.some(d => porAba(d, "extensao").sessoes.some(s => x.casa(s)));
      return `<div class="projeto-ext ${ativo ? "" : "em-breve"}">${icone(x.icone, "ico3d ico-medio")}<div><b>${x.nome}</b>${x.sub ? `<small>${x.sub}</small>` : ""}</div>${ativo ? "" : '<span class="selo-breve">em breve</span>'}</div>`;
    }).join("");
    P.insertAdjacentHTML("beforeend", `<div class="projetos-ext">${projetos}</div>`);
    let marcado = false;
    for (const dia of mostrar) marcado = desenharDia(P, dia, marcado, { bauBonus: "extensao" }) || marcado;
    if (!mostrar.length) P.insertAdjacentHTML("beforeend", `<div class="vazio pequeno">${moli("neutro")}<h2>Nada de extensão hoje</h2><p>A trilha da Liga Acadêmica de Periodontia começa em 30/10.</p></div>`);
    reverAnteriores(P, concluidos, { bauBonus: "extensao" });
  };
  // ----- Provas -----
  construir.provas = () => {
    const P = paineis.provas, { mostrar, concluidos } = visiveisDa("provas");
    const proximas = (E().avaliacoes || []).filter(a => a.data && a.data >= hoje).sort((a, b) => (a.data + (a.hora || "")).localeCompare(b.data + (b.hora || ""))).slice(0, 4);
    if (proximas.length) {
      P.insertAdjacentHTML("beforeend", `<div class="proximas-provas"><h3>Próximas avaliações</h3>${proximas.map(a => {
        const dd = Math.round((new Date(a.data + "T12:00") - new Date(hoje + "T12:00")) / 864e5);
        return `<div class="prova-linha ${a.recorte?.length ? "com-rx" : ""}" data-av="${escapar(a.id)}"><span class="prova-dias ${dd <= 3 ? "perto" : ""}">${dd === 0 ? "hoje" : dd === 1 ? "amanhã" : `${dd} dias`}</span><div><b>${escapar(a.disciplina || a.titulo || "")}</b><small>${escapar(a.titulo || "")} · ${new Date(a.data + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}${a.hora ? ` · ${a.hora}` : ""}</small></div></div>`;
      }).join("")}</div>`);
      P.querySelectorAll(".prova-linha.com-rx").forEach(l => {
        l.insertAdjacentHTML("beforeend", `<span class="rx-ir">Raio X ›</span>`);
        l.onclick = () => { focarRaioX(l.dataset.av); window.dispatchEvent(new CustomEvent("oq-ir", { detail: "treino" })); };
      });
    }
    { const pr = document.createElement("div"); P.append(pr); import("./jogos/pratica.js").then(m => m.cartaoPratica(pr)).catch(e => console.warn("prova prática:", e)); }
    { const lam = document.createElement("div"); P.append(lam); import("./jogos/laminas.js").then(m => m.cartaoLaminas(lam)).catch(e => console.warn("lâminas:", e)); }
    let marcado = false;
    for (const dia of mostrar) marcado = desenharDia(P, dia, marcado, { bauBonus: "provas" }) || marcado;
    // eventos acadêmicos que ainda vão acontecer (seminários, trabalhos)
    for (const ev of [...evAbertos].reverse()) {
      // um evento com vários dias mostra só os dias abertos e não terminados, mais o próximo
      const de = diaDoEvento(ev);
      if (de.sessoes.length > 1 && de.sessoes[0].liberaEm) {
        const abertos = de.sessoes.filter(s => s.liberaEm <= hoje && !s.licoes.every(l => feito(l.id)));
        const prox = de.sessoes.find(s => s.liberaEm > hoje);
        de.sessoes = [...abertos, ...(prox ? [prox] : [])];
        if (!de.sessoes.length) de.sessoes = [diaDoEvento(ev).sessoes.at(-1)];
      }
      desenharDia(P, de, false, { evento: ev, subtitulo: quandoEvento(ev) });
    }
    if (!mostrar.length && !evAbertos.length) P.insertAdjacentHTML("beforeend", `<div class="vazio pequeno">${moli("neutro")}<h2>Nenhuma revisão de prova agora</h2><p>Quando uma prova, um seminário ou um trabalho tiver trilha própria, ela aparece aqui.</p></div>`);
    reverAnteriores(P, concluidos, { bauBonus: "provas" });
  };
  trocar(aba, false);
  const atual = paineis[aba].querySelector(".dia:not(.dia-evento) .no.atual") || paineis[aba].querySelector(".no.atual");
  if (atual) atual.scrollIntoView({ block: "center" });
}

/** As abas da trilha. Cada sessão vai para uma: `aba` da sessão ou, nas extras, pela disciplina (`abaDaSessao`). */
const ABAS_TRILHA = [
  { id: "aulas", nome: "Aulas", icone: "📚" },
  { id: "extensao", nome: "Extensão", icone: "🤝" },
  { id: "provas", nome: "Provas", icone: "📝" },
];
// projetos de extensão (o subtítulo segue o padrão da linha "fonte" dos minijogos: autor · livro)
const EXTENSAO = [
  { nome: "Liga Acadêmica de Periodontia", sub: "Lindhe · Clinical Periodontology and Implant Dentistry", icone: "🪥", casa: (s) => /periodont/i.test(s.disciplina || s.nome || "") },
  { nome: "Odontologia Hospitalar", sub: "", icone: "🏥", casa: (s) => /hospitalar/i.test(s.disciplina || s.nome || "") },
  { nome: "Centro de Especialidades Odontológicas", sub: "", icone: "🦷", casa: (s) => /cirurg|\bCEO\b/i.test(`${s.disciplina || ""} ${s.nome || ""}`) },
];
function reverAnteriores(P, concluidos, opts) {
  if (!concluidos.length) return;
  const b = document.createElement("button"); b.className = "link"; b.style.cssText = "display:block;margin:28px auto 0";
  b.textContent = `Rever dias anteriores (${concluidos.length})`;
  b.onclick = () => { b.remove(); [...concluidos].reverse().forEach(d => desenharDia(P, d, true, opts)); };
  P.append(b);
}

/** Desenha um dia (ou um evento, com opts.evento) com faixa e caminho por sessão. */
export function desenharDia(t, dia, jaTemAtual, opts = {}) {
  const refazer = opts.refazer || telaTrilha;
  const hoje = hojeISO(), futuro = !opts.evento && !opts.etapa && dia.data > hoje;
  const bloco = document.createElement("section"); bloco.className = `dia ${opts.evento ? "dia-evento" : ""}`;
  let marcouAtual = false;
  if (futuro) {
    bloco.innerHTML = `<div class="faixa bloqueada">${SOL}<div><h2>${escapar(nomeDia(dia.data))}</h2><p>${escapar(dia.tema)}. Disponível a partir de amanhã cedo.</p></div></div>`;
    t.append(bloco); return false;
  }
  const feitaSessao = (p) => dia.sessoes.find(s => s.periodo === p)?.licoes.every(l => feito(l.id)) ?? true;
  const passado = dia.data < hoje, h = new Date().getHours();
  const liberaSessao = {
    manha: true,
    tarde: passado || feitaSessao("manha") || h >= 11,
    noite: passado || (feitaSessao("manha") && feitaSessao("tarde")) || h >= 17,
    extra: true,
    evento: true,
  };
  const caminhos = [];
  const AVISO = { tarde: "A sessão da tarde libera depois da manhã ou às 11h.", noite: "A revisão da noite libera depois da manhã e da tarde, ou às 17h." };
  dia.sessoes.forEach((s, si) => {
    const per = PERIODOS[s.periodo] ? s.periodo : "manha", P = PERIODOS[per];
    const faixa = document.createElement("div"); faixa.className = `faixa ${per === "manha" ? "" : per}`;
    const temaObj = TEMAS[temaDaSessao(dia, per, s)].objetos[0];
    const fechadaAte = opts.evento && s.liberaEm && s.liberaEm > hoje ? s.liberaEm : null;
    const dataCurta = s.liberaEm ? new Date(s.liberaEm + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }) : "";
    if (opts.evento && s.diaN && si > 0) faixa.classList.add("faixa-dia-ev");
    const nFeitas = s.licoes.filter(l => feito(l.id)).length;
    faixa.innerHTML = opts.etapa
      ? `${icone(opts.etapa.icone || "📘", "ico3d ico-grande")}<div><h2>Etapa ${opts.etapa.n}: ${escapar(s.titulo || dia.tema)}</h2><p>${opts.bloqueado ? "Conclua a etapa anterior para abrir" : nFeitas === s.licoes.length ? "Etapa concluída ✓" : `${nFeitas} de ${s.licoes.length} lições`}</p></div><span class="faixa-obj">${objetoSVG(temaObj)}</span>`
      : opts.evento && s.diaN
      ? (si === 0 ? `${icone(opts.evento.icone || "🎤", "ico3d ico-grande")}<div><h2>${escapar(opts.evento.nome)}</h2><p>${escapar(opts.subtitulo || "")}</p></div><span class="faixa-obj">${objetoSVG(temaObj)}</span>` : "")
        + `<div class="dia-ev"><span class="dia-ev-n">Dia ${s.diaN}</span><div><b>${escapar(s.titulo)}</b><small>${escapar(dataCurta)}${fechadaAte ? " · libera nesse dia" : s.licoes.every(l => feito(l.id)) ? " · feito ✓" : ""}</small></div></div>`
      : opts.evento
      ? `${icone(opts.evento.icone || "🎤", "ico3d ico-grande")}<div><h2>${escapar(opts.evento.nome)}</h2><p>${escapar(opts.subtitulo || "")}</p></div><span class="faixa-obj">${objetoSVG(temaObj)}</span>`
      : per === "extra"
      ? `${s.icone ? icone(s.icone, "ico3d ico-grande") : P.astro()}<div><h2>${escapar(nomeDia(dia.data))}, ${escapar(s.nome || P.nome)}</h2><p>${escapar(s.titulo || "")}</p></div><span class="faixa-obj">${objetoSVG(temaObj)}</span>`
      : `${P.astro()}<div><h2>${escapar(nomeDia(dia.data))}, ${P.nome}</h2><p>${escapar(per === "manha" ? dia.tema : (s.titulo || ""))}</p></div><span class="faixa-obj">${objetoSVG(temaObj)}</span>`;
    const cam = document.createElement("div"); cam.className = "caminho";
    let atualIdx = -1;
    s.licoes.forEach((l, i) => {
      const anteriorFeita = fechadaAte || opts.bloqueado ? false : i === 0 ? liberaSessao[per] : feito(s.licoes[i - 1].id);
      const estaFeita = feito(l.id);
      const liberada = estaFeita || anteriorFeita;
      const ehAtual = !estaFeita && liberada && !jaTemAtual && !marcouAtual;
      if (ehAtual) { marcouAtual = true; atualIdx = i; }
      const w = document.createElement("div"); w.className = "no-wrap"; w.style.transform = `translateX(${DESLOC[i % DESLOC.length]}px)`;
      const b = document.createElement("button"); b.style.setProperty("--k", i);
      b.className = `no ${per === "manha" ? "" : per} ${l.jogo ? "no-jogo" : ""} ${estaFeita ? "feito" : ""} ${!liberada ? "bloqueado" : ""} ${ehAtual ? "atual" : ""}`;
      b.setAttribute("aria-label", `${l.titulo}${estaFeita ? " (concluída)" : !liberada ? " (bloqueada)" : ""}`);
      const perfeita = estaFeita && E().concluidas[l.id]?.perfeita;
      b.innerHTML = `${icone(l.icone || "⭐", "ico-no")}${l.jogo ? `<span class="selo-jogo">${icone("🎮", "ico3d")}</span>` : ""}${ehAtual ? '<span class="brilho-no"></span>' : ""}${perfeita ? `<span class="coroa-no">${icone("👑", "ico3d")}</span>` : estaFeita ? '<span class="marca">✓</span>' : !liberada ? `<span class="marca cadeado">${icone("🔒", "ico3d")}</span>` : ""}`;
      if (ehAtual) w.insertAdjacentHTML("afterbegin", `<div class="balao-comecar">Começar</div>`);
      b.onclick = async () => {
        if (!liberada) { b.classList.remove("nega"); void b.offsetWidth; b.classList.add("nega"); toast(opts.bloqueado ? "Conclua a etapa anterior primeiro." : fechadaAte ? `Este dia do preparo libera em ${dataCurta}.` : i === 0 && AVISO[per] ? AVISO[per] : "Conclua a lição anterior primeiro."); return; }
        tocar("toque");
        if (l.jogo) {
          const r = await jogarComoLicao(l, dia, per);
          if (r) { aoMudar(); refazer(); }
          return;
        }
        // a poção não é mais oferecida aqui (pedido do Alediov, 26/10/2026): ela se ativa no painel do XP do topo ou na Mochila da loja
        const r = await iniciarLicao({ id: l.id, titulo: l.titulo, exercicios: l.exercicios, dia, periodo: per, evento: !!opts.evento });
        if (r) { aoMudar(); refazer(); }
      };
      const rot = document.createElement("div"); rot.className = "rotulo-no"; rot.textContent = l.titulo;
      w.append(b, rot); cam.append(w);
      if (ehAtual && (!opts.evento || opts.etapa)) {
        const m = document.createElement("div"); m.className = "mascote-trilha";
        m.innerHTML = moli("feliz");
        m.onclick = () => {
          tocar("par"); m.innerHTML = moli("uau"); m.classList.add("pula");
          setTimeout(() => { m.innerHTML = moli("feliz"); m.classList.remove("pula"); }, 900);
        };
        m.style.cssText = `position:absolute;${DESLOC[i % DESLOC.length] > 0 ? "right:118px" : "left:118px"};top:4px;width:78px`;
        w.append(m);
        // a 1ª vez que a trilha aparece na sessão, o companheiro acena
        if (!acenouNaSessao) { acenouNaSessao = true; setTimeout(() => { m.classList.add("acena"); setTimeout(() => m.classList.remove("acena"), 1400); }, 700); }
      }
    });
    bloco.append(faixa, cam);
    caminhos.push({ cam, sessao: s, periodo: per, atualIdx });
  });
  if (opts.bauBonus && dia.sessoes?.length) {
    // baú bônus das abas Extensão e Provas: no fim das lições da aba no dia
    const ganho = E().bausBonus?.[`${dia.data}|${opts.bauBonus}`], todas = dia.sessoes.every(s => s.licoes.every(l => feito(l.id)));
    const bf = document.createElement("button"); bf.className = `bau-trilha ${ganho ? "aberto" : todas ? "pronto" : ""}`;
    bf.innerHTML = `${svgBau(ganho || "madeira", { aberto: !!ganho })}<small>${ganho ? "Baú bônus conquistado" : "Baú bônus: complete esta aba no dia"}</small>`;
    bf.onclick = () => { tocar("toque"); toast(ganho ? "Esse baú já foi para os seus slots." : "Complete todas as lições desta aba no dia para ganhar o baú bônus (prata com 90% de acerto)."); };
    bloco.append(bf);
  } else if ((!opts.evento || opts.etapa) && dia.sessoes?.length) {
    // baú do dia no fim da trilha: fechado até completar tudo, aberto depois
    const ganho = E().bausDados?.[dia.data], todas = sessoesDoDia(dia).every(s => s.licoes.every(l => feito(l.id)));
    const bf = document.createElement("button"); bf.className = `bau-trilha ${ganho ? "aberto" : todas ? "pronto" : ""}`;
    const qual = opts.etapa ? "da etapa" : "do dia";
    bf.innerHTML = `${svgBau(ganho || "madeira", { aberto: !!ganho })}<small>${ganho ? `Baú ${qual} conquistado` : `Baú ${qual}: complete ${opts.etapa ? "a etapa" : "a trilha"}`}</small>`;
    bf.onclick = () => { tocar("toque"); toast(ganho ? "Esse baú já foi para os seus slots." : `Complete todas as lições ${qual} para ganhar este baú.`); };
    bloco.append(bf);
  }
  t.append(bloco);
  const enfeitesEvento = eventoAtivo()?.enfeites || null;
  for (const c of caminhos) decorarCaminho(c.cam, { dia, sessao: c.sessao, periodo: c.periodo, atualIdx: c.atualIdx, feito, aoGanhar: aoMudar, enfeitesEvento });
  return marcouAtual;
}

export async function executarSync(botao, silencioso = false) {
  if (botao) { botao.disabled = true; botao.textContent = "Sincronizando…"; }
  try {
    const r = await sincronizar(msg => botao && (botao.textContent = msg));
    if (!silencioso || r.baixadas || r.extras) { toast(r.baixadas || r.extras ? [r.baixadas && `${r.baixadas} dia(s) de lições`, r.extras && `${r.extras} evento(s) ou jogo(s)`].filter(Boolean).join(" e ") + " baixado(s)." : "Tudo em dia."); tocar("moeda"); }
    if (r.pacotes) window.dispatchEvent(new Event("oq-mensagens"));
  } catch (e) {
    if (!silencioso) toast(e.message, 4200);
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = "Sincronizar"; }
    aoMudar();
    if (document.querySelector(".aba.ativa")?.dataset.aba === "trilha") telaTrilha();
  }
}

// ======================= TREINO =======================
let rxFoco = null; // avaliação a abrir aberta no Raio X (tocada na aba Provas)
export function focarRaioX(id) { rxFoco = id; }
// a aba Treino mora em telaTreino.js (Treino do dia, Raio X e simulado das provas, por disciplina, aleatório)
export async function telaTreino() {
  const foco = rxFoco; rxFoco = null;
  return (await import("./telaTreino.js")).telaTreino({ aoMudar, foco });
}

// ======================= LOJA =======================
const CORES = {
  padrao: { nome: "Bupivacaína", desc: "Azul", hex: "#2F6BFF", preco: 0 },
  lidocaina: { nome: "Lidocaína", desc: "Vermelho", hex: "#D93A3A", preco: 60 },
  articaina: { nome: "Articaína", desc: "Dourado", hex: "#C98A0C", preco: 60 },
  mepivacaina: { nome: "Mepivacaína", desc: "Marrom", hex: "#8A5A3B", preco: 60 },
  prilocaina: { nome: "Prilocaína", desc: "Preto", hex: "#3A3F52", preco: 60 },
  galaxia: { nome: "Galáxia", desc: "Roxo cósmico", hex: "linear-gradient(135deg,#7C4DFF,#1B2340)", preco: 25, moeda: "gemas" },
  esmeralda: { nome: "Esmeralda", desc: "Verde joia", hex: "linear-gradient(135deg,#12A37A,#0B5E47)", preco: 20, moeda: "gemas" },
  gengiva: { nome: "Gengiva", desc: "Rosa", hex: "#D9467A", preco: 60 },
};
export function aplicarCor() { document.documentElement.dataset.cor = E().loja.equipado.cor || "padrao"; }

function pagar(preco, moeda) {
  const est = E();
  if (moeda === "gemas") { if ((est.gemas || 0) < preco) return false; est.gemas -= preco; }
  else { if (est.moedas < preco) return false; est.moedas -= preco; }
  salvar(); return true;
}
const podePagar = (preco, moeda) => moeda === "gemas" ? (E().gemas || 0) >= preco : E().moedas >= preco;
const precoTxt = (preco, moeda) => moeda === "gemas" ? `<span class="preco-gemas">${preco} ${svgGema()}</span>` : `${preco} moedas`;

function desenharProdutos(grade, produtos) {
  for (const pr of produtos) {
    const c = document.createElement("div"); c.className = "item-loja";
    c.innerHTML = `${pr.svg}<h3>${pr.nome}</h3>${pr.det ? `<p>${pr.det}</p>` : ""}${pr.status ? `<p class="status-item">${pr.status}</p>` : ""}<p class="preco-item">${precoTxt(pr.preco, pr.moeda)}</p>`;
    const b = document.createElement("button"); b.className = "botao"; b.textContent = (pr.bloqueado && pr.rotulo) || "Comprar";
    b.disabled = pr.bloqueado || !podePagar(pr.preco, pr.moeda);
    b.onclick = () => { if (!pagar(pr.preco, pr.moeda)) return; pr.acao(); salvar(); tocar("moeda"); aoMudar(); telaLoja(); };
    c.append(b); grade.append(c);
  }
}

const fmtTempo = (ms) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`; };
function arteOferta(o) {
  if (o.tipo === "carta") { const r = CO.RARIDADES_CARTA[CO.CARTAS[o.alvo].raridade]; return `<div class="oferta-arte"><div class="moldura-oferta" style="--cor:${r.cor};--escura:${r.escura}">${CO.arteCarta(o.alvo, { classe: "vivo" })}</div></div>`; }
  if (o.tipo === "semente") return `<div class="oferta-arte">${plantaSVG(o.alvo, { humor: "uau", classe: "item-svg" })}</div>`;
  return `<div class="oferta-arte">${svgBau(o.bau)}</div>`;
}
function detalheOferta(o) {
  if (o.tipo === "carta") { const c = CO.CARTAS[o.alvo]; return `${o.qtd} ${o.qtd === 1 ? "cópia" : "cópias"} de carta ${CO.RARIDADES_CARTA[c.raridade].nome.toLowerCase()}`; }
  if (o.tipo === "semente") return `${o.qtd} semente${o.qtd > 1 ? "s" : ""} para o jardim`;
  return `Vai para um slot de baú`;
}
function desenharOfertas(t) {
  const sec = document.createElement("div"); sec.className = "secao ofertas-dia";
  sec.innerHTML = `<div class="titulo-ofertas"><h2>Ofertas do dia</h2><button class="link" id="tabela-ofertas">Raridades e preços</button></div><p class="sub">Novas ofertas em ${fmtTempo(OF.msAteNovasOfertas())}.</p>`;
  const g = document.createElement("div"); g.className = "grade-loja";
  OF.ofertasDoDia().forEach((o, i) => {
    const rar = OF.RARIDADE_OFERTA[OF.raridadeDe(o)], feitas = OF.comprasHoje(i), esgotou = feitas >= o.limite;
    const bauCheio = o.tipo === "bau" && OF.slotsBauCheios();
    const c = document.createElement("div"); c.className = `item-loja oferta ${o.moeda === "gemas" ? "oferta-gema" : ""} ${esgotou ? "esgotada" : ""}`;
    c.style.setProperty("--rar", rar.cor);
    c.innerHTML = `<span class="selo-rar">${rar.nome}</span>${o.desconto ? `<span class="selo-desc">−${o.desconto}%</span>` : ""}
      ${arteOferta(o)}<h3>${escapar(OF.nomeOferta(o))}</h3><p>${detalheOferta(o)}</p>
      <p class="preco-item">${o.desconto ? `<s>${o.precoCheio}</s> ` : ""}${precoTxt(o.preco, o.moeda)}</p>
      <p class="limite-oferta">${esgotou ? "Esgotado hoje" : `Restam ${o.limite - feitas} de ${o.limite}`}</p>`;
    const b = document.createElement("button"); b.className = "botao";
    b.textContent = esgotou ? "Esgotado" : bauCheio ? "Slots cheios" : "Comprar";
    b.disabled = esgotou || bauCheio || !podePagar(o.preco, o.moeda);
    b.onclick = async () => {
      const r = OF.comprarOferta(i);
      if (r.erro) return toast(r.erro);
      tocar("moeda"); aoMudar();
      if (o.tipo === "bau") toast(`${OF.nomeOferta(o)} guardado num slot. Abra na trilha!`);
      else {
        const arte = o.tipo === "carta" ? `<div class="revela-oferta">${cartaHTML(o.alvo)}</div>` : `<div class="revela-oferta">${plantaSVG(o.alvo, { humor: "uau", classe: "item-svg" })}</div>`;
        const nome = o.tipo === "carta" ? CO.CARTAS[o.alvo].nome : PLANTAS[o.alvo].nome;
        tocar(r.nova ? "fim" : "par");
        await modal({ html: arte, titulo: r.nova ? `${o.tipo === "carta" ? "Nova carta" : "Nova planta"}: ${nome}!` : `+${o.qtd} ${o.tipo === "carta" ? (o.qtd === 1 ? "cópia" : "cópias") : (o.qtd === 1 ? "semente" : "sementes")}: ${nome}`,
          texto: o.tipo === "carta" ? "Veja e evolua na Coleção (Perfil)." : "Plante e evolua no Jardim.", botoes: [{ texto: "Legal!", valor: true }] });
      }
      telaLoja();
    };
    c.append(b); g.append(c);
  });
  sec.append(g); t.append(sec);
  sec.querySelector("#tabela-ofertas").onclick = tabelaOfertas;
}
function tabelaOfertas() {
  const linha = (o) => {
    const rar = OF.RARIDADE_OFERTA[OF.raridadeDe(o)];
    const nome = o.tipo === "carta" ? `Carta ${rar.nome.toLowerCase()} ×${o.qtd}` : o.tipo === "semente" ? `Semente ${rar.nome.toLowerCase()}${o.qtd > 1 ? ` ×${o.qtd}` : ""}` : OF.nomeOferta(o);
    return `<tr><td><i class="bolinha-rar" style="background:${rar.cor}"></i>${nome}</td><td>${o.preco}</td><td>${o.limite}</td></tr>`;
  };
  const tot = (m) => OF.CATALOGO.filter(o => o.moeda === m).reduce((s, o) => s + o.peso, 0);
  const chance = (o) => `${Math.round(o.peso / tot(o.moeda) * 100)}%`;
  const tabela = (m) => `<table class="tabela-ofertas"><tr><th>Item</th><th>${m === "gemas" ? "Gemas" : "Moedas"}</th><th>Limite</th></tr>${OF.CATALOGO.filter(o => o.moeda === m).map(o => linha(o).replace("</td><td>", ` <small>${chance(o)}</small></td><td>`)).join("")}</table>`;
  const descontos = OF.DESCONTOS.map(([d, p]) => `${d ? `−${d}%` : "sem desconto"}: ${Math.round(p / OF.DESCONTOS.reduce((s, x) => s + x[1], 0) * 100)}%`).join(" · ");
  modal({ html: `<div class="detalhe-item"><h2 class="titulo-detalhe">Ofertas do dia</h2>
    <p class="sub">Todo dia, à meia-noite, saem 3 ofertas por moedas (no máximo 2 do mesmo tipo) e 1 por gemas. A % ao lado do nome é a chance de cada item aparecer.</p>
    <h3>Por moedas</h3>${tabela("moedas")}<h3>Por gemas</h3>${tabela("gemas")}
    <h3>Descontos</h3><p class="sub">${descontos}</p>
    <h3>Raridades</h3><p class="sub">${Object.values(OF.RARIDADE_OFERTA).map(r => `<i class="bolinha-rar" style="background:${r.cor}"></i>${r.nome}`).join(" ")}. Baús de madeira e prata contam como comuns, ouro como raro.</p></div>`,
    botoes: [{ texto: "Fechar", valor: true }] });
}

export function telaLoja() {
  const t = tela(), est = E();
  t.innerHTML = `<h1 class="titulo-tela">Loja</h1><p class="sub">Você tem ${est.moedas} moedas e ${est.gemas || 0} gemas. Gemas são raras: vêm principalmente dos baús.</p>`;
  desenharInventario(t, () => { aoMudar(); telaLoja(); });

  desenharOfertas(t);

  // poções
  const secP = document.createElement("div"); secP.className = "secao";
  secP.innerHTML = `<h2>Poções</h2>`;
  const gp = document.createElement("div"); gp.className = "grade-loja";
  const produtos = [
    { svg: svgPocao("x2_15"), nome: "Poção ×2", det: "15 min", preco: 120, moeda: "moedas", acao: () => darPocao("x2_15") },
    { svg: svgPocao("x2_30"), nome: "Poção ×2", det: "30 min", preco: 220, moeda: "moedas", acao: () => darPocao("x2_30") },
    { svg: svgPocao("x3_20"), nome: "Poção ×3", det: "20 min", preco: 8, moeda: "gemas", acao: () => darPocao("x3_20") },
    { svg: svgPocao("x5_10"), nome: "Poção ×5", det: "10 min", preco: 15, moeda: "gemas", acao: () => darPocao("x5_10") },
  ];
  desenharProdutos(gp, produtos);
  secP.append(gp); t.append(secP);

  // ofensiva
  const o = est.ofensiva, reparavel = ofensivaReparavel();
  const secO = document.createElement("div"); secO.className = "secao";
  secO.innerHTML = `<h2>Ofensiva</h2>`;
  const go = document.createElement("div"); go.className = "grade-loja";
  desenharProdutos(go, [
    { svg: `<div class="item-ico">${icone("🧊", "ico3d ico-loja")}</div>`, nome: "Congelamento de ofensiva", det: "Protege 1 dia sem estudo", status: `Você tem ${o.congelamentos} de 2`,
      preco: 50, moeda: "moedas", bloqueado: o.congelamentos >= 2, rotulo: o.congelamentos >= 2 ? "Estoque cheio" : null, acao: () => { o.congelamentos++; } },
    { svg: `<div class="item-ico">${icone("🩹", "ico3d ico-loja")}</div>`, nome: "Reparo de ofensiva", det: "Recupera a ofensiva perdida há até 3 dias",
      status: reparavel ? `Volta para ${reparavel + (o.ultimoDia === hojeISO() ? o.atual : 0)} dias` : "Sua ofensiva está inteira",
      preco: 20, moeda: "gemas", bloqueado: !reparavel, rotulo: reparavel ? "Reparar" : "Sem ofensiva perdida",
      acao: () => { repararOfensiva(); tocar("ofensiva"); toast(`Ofensiva recuperada: ${E().ofensiva.atual} dias!`); } },
  ]);
  secO.append(go); t.append(secO);

  // melhorias: abertura automática dos baús (economia.js, compra única por gemas; pedido do Alediov, 02/11/2026)
  const auto = EC.autoBaus(), secM = document.createElement("div"); secM.className = "secao";
  secM.innerHTML = `<h2>Melhorias</h2>`;
  const um = document.createElement("div"); um.className = "item-loja upgrade-auto";
  um.innerHTML = `<div class="item-ico">${icone("⚙️", "ico3d ico-loja")}</div><h3>Abertura automática de baús</h3>
    <p>Quando um baú termina de abrir, o próximo da fila começa sozinho, mesmo com o app fechado. Compra única.</p>
    ${auto?.comprado ? `<p class="status-item">Comprada · ${auto.ligado ? `ligada, ${EC.ORDENS_AUTO[auto.ordem || "rapido"].toLowerCase()}` : "desligada"}</p>` : `<p class="preco-item">${precoTxt(EC.PRECO_AUTO, "gemas")}</p>`}`;
  const bu = document.createElement("button"); bu.className = `botao ${auto?.comprado ? "secundario" : ""}`;
  bu.textContent = auto?.comprado ? "Ajustar" : "Comprar";
  bu.disabled = !auto?.comprado && !podePagar(EC.PRECO_AUTO, "gemas");
  bu.onclick = async () => {
    if (EC.autoBaus()?.comprado) return configurarAuto(() => telaLoja());
    const ok = await modal({ titulo: "Abertura automática de baús", texto: `Custa ${EC.PRECO_AUTO} gemas, uma vez só. Depois dá para ligar, desligar e escolher qual baú abre primeiro.`, botoes: [{ texto: "Comprar", valor: true }, { texto: "Agora não", classe: "secundario", valor: false }] });
    if (!ok) return;
    const r = EC.comprarAuto(); if (r.erro) return toast(r.erro);
    tocar("combo"); confete(1400); toast("Abertura automática ligada!"); aoMudar(); telaLoja();
  };
  um.append(bu);
  if (!auto?.comprado && !podePagar(EC.PRECO_AUTO, "gemas")) um.insertAdjacentHTML("beforeend", `<p class="sub" style="margin:6px 0 0">Você tem ${E().gemas || 0} gemas.</p>`);
  // slots de baú a mais (economia.js, comprarSlot; pedido do Alediov, 09/11/2026)
  const ps = EC.precoProximoSlot(), us = document.createElement("div"); us.className = "item-loja upgrade-slot";
  us.innerHTML = `<div class="item-ico">${svgBau("madeira")}</div><h3>Slot de baú a mais</h3>
    <p>Mais um lugar para guardar baús. Você tem ${EC.capacidadeSlots()} de ${EC.SLOTS_MAX}.</p>
    ${ps ? `<p class="preco-item">${ps.moedas} moedas ou ${precoTxt(ps.gemas, "gemas")}</p>` : `<p class="status-item">Todos os slots liberados</p>`}`;
  const bs = document.createElement("button"); bs.className = "botao"; bs.textContent = ps ? `Comprar o ${ps.numero}º` : "Completo";
  bs.disabled = !ps || (!podePagar(ps.moedas, "moedas") && !podePagar(ps.gemas, "gemas"));
  bs.onclick = () => comprarSlotModal(() => { aoMudar(); telaLoja(); });
  us.append(bs);
  const gm = document.createElement("div"); gm.className = "grade-loja"; gm.append(um, us);
  secM.append(gm); t.append(secM);

  const secA = document.createElement("div"); secA.className = "secao";
  secA.innerHTML = `<h2>Seu avatar</h2>`;
  const ca = document.createElement("div"); ca.className = "cartao atalho-avatar";
  ca.innerHTML = `<div class="avatar-medio">${arteAvatar()}</div><div><b>Cabelos, olhos, chapéus, roupas e fundos</b><p class="sub" style="margin:4px 0 10px">Partes comuns custam moedas; as raras, gemas.</p></div>`;
  const bA = document.createElement("button"); bA.className = "botao"; bA.textContent = "Personalizar";
  bA.onclick = () => telaAvatar(() => telaLoja(), aoMudar);
  ca.querySelector("div:last-child").append(bA); secA.append(ca); t.append(secA);

  const sec3 = document.createElement("div"); sec3.className = "secao";
  sec3.innerHTML = `<h2>Cor do app</h2><p class="sub">Inspiradas no código de cores dos tubetes, e algumas especiais.</p>`;
  const g3 = document.createElement("div"); g3.className = "grade-loja";
  for (const [id, c] of Object.entries(CORES)) {
    const tem = c.preco === 0 || est.loja.comprados.includes("cor-" + id), usando = (est.loja.equipado.cor || "padrao") === id;
    const d = document.createElement("div"); d.className = "item-loja";
    d.innerHTML = `<div class="amostra-cor" style="background:${c.hex}"></div><h3>${c.nome}</h3><p>${c.desc}${tem ? "" : `, ${precoTxt(c.preco, c.moeda)}`}</p>`;
    const b = document.createElement("button"); b.className = `botao ${usando ? "secundario" : ""}`;
    b.textContent = usando ? "Em uso" : tem ? "Usar" : "Comprar"; b.disabled = usando || (!tem && !podePagar(c.preco, c.moeda));
    b.onclick = () => {
      if (!tem) { if (!pagar(c.preco, c.moeda)) return; est.loja.comprados.push("cor-" + id); tocar("moeda"); }
      est.loja.equipado.cor = id; salvar(); aplicarCor(); aoMudar(); telaLoja();
    };
    d.append(b); g3.append(d);
  }
  sec3.append(g3); t.append(sec3);
}

// ======================= PERFIL =======================
export function aplicarTema() {
  const tm = E().config.tema;
  if (tm === "auto") delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = tm;
}

export function telaPerfil() {
  const t = tela(), est = E(), nv = nivel(), tit = tituloEquipado();
  const totalResp = Object.values(est.respostas).flat();
  const primeira = totalResp.filter(r => r.tentativa === 1);
  const precisao = primeira.length ? Math.round(primeira.filter(r => r.acertou).length / primeira.length * 100) : 0;
  // conceitos com mais erros
  const porConceito = {};
  for (const r of primeira) { const c = porConceito[r.conceito] ||= { e: 0, n: 0 }; c.n++; if (!r.acertou) c.e++; }
  const fracos = Object.entries(porConceito).filter(([, c]) => c.e > 0).sort((a, b) => b[1].e / b[1].n - a[1].e / a[1].n).slice(0, 5);
  // calendário: últimas 5 semanas
  const hoje = hojeISO(); let cal = "";
  for (let i = 34; i >= 0; i--) {
    const d = somaDias(hoje, -i), n = est.diario[d]?.licoes.length || 0;
    cal += `<span class="${n >= 6 ? "n3" : n >= 3 ? "n2" : n ? "n1" : ""} ${i === 0 ? "hoje" : ""}" title="${d}: ${n} lições"></span>`;
  }
  t.innerHTML = `
    <div class="perfil-topo">
      <button class="avatar-perfil" id="bt-avatar" aria-label="Personalizar avatar">${arteAvatar()}<span class="lapis">✎</span></button>
      <div style="flex:1;min-width:0">
        <button class="nome-perfil" id="bt-nome">${av().nome ? escapar(av().nome) : `<span class="sub" style="font-size:17px">Seu nome ✎</span>`}</button>
        ${tit ? `<button class="selo-equipado" id="bt-selo" style="--cor:${tit.cor}">${svgTitulo(tit)}<span>${escapar(tit.nome)}</span></button>` : `<button class="selo-equipado vazio" id="bt-selo">Nenhum título equipado</button>`}
        <h1 style="font-size:19px;margin-top:6px">Nível ${nv.n}: ${nv.titulo}</h1>
        <div class="nivel-barra"><div style="width:${Math.round(nv.noNivel / nv.custo * 100)}%"></div></div>
        <span class="sub">${nv.noNivel} de ${nv.custo} XP para o próximo nível</span></div>
    </div>
    <div class="atalhos-perfil">
      <button class="cartao" id="at-avatar">${icone("🎨")}<b>Avatar</b><small>Personalizar</small></button>
      <button class="cartao" id="at-titulos">${icone("🏆")}<b>Títulos</b><small>${titulosEstado().conquistados.length}/${TITULOS.length}</small></button>
      <button class="cartao" id="at-desemp">${icone("📊")}<b>Desempenho</b><small>Gráficos</small></button>
      <button class="cartao" id="at-colecao"><span class="mini-comp">${CO.arteCompanheiro({ classe: "vivo" })}</span><b>Coleção</b><small>${Object.keys(CO.colecao().cartas).length}/${Object.keys(CO.CARTAS).length}</small></button>
    </div>
    <div class="secao estat">
      <div class="cartao"><b style="color:var(--fogo)">${est.ofensiva.atual}</b><span>dias de ofensiva (recorde ${est.ofensiva.recorde})</span></div>
      <div class="cartao"><b style="color:var(--ouro)">${est.xp}</b><span>XP total</span></div>
      <div class="cartao"><b>${Object.keys(est.concluidas).filter(k => !k.startsWith("treino")).length}</b><span>lições concluídas</span></div>
      <div class="cartao"><b style="color:var(--certo)">${precisao}%</b><span>acerto na 1ª tentativa</span></div>
    </div>
    <button class="link ver-desemp" id="ver-desemp">Ver o painel de desempenho completo ›</button>
    ${DEMO ? "" : `<div class="perfil-extras"><button class="botao secundario" id="bt-foco">${icone("⏱️", "ico-inline")} Modo foco</button><button class="botao secundario" id="bt-semana">${icone("🗓️", "ico-inline")} Resumo da semana</button><button class="botao secundario" id="bt-aulas">${icone("🎤", "ico-inline")} Aulas gravadas</button></div>`}
    <div class="secao"><h2>Últimas 5 semanas</h2><div class="cartao"><div class="calendario">${cal}</div></div></div>
    <div class="secao"><h2>Pontos para reforçar</h2><div class="cartao">${fracos.length ? `<ul class="fracos">${fracos.map(([c, v]) => `<li><span>${escapar(c.replace(/[._]/g, " "))}</span><b>${v.e}/${v.n} erros</b></li>`).join("")}</ul>` : `<p class="sub" style="margin:0">Aparecem aqui quando você errar alguma questão.</p>`}</div></div>
    <div class="secao"><h2>Preferências</h2><div class="cartao" id="prefs"></div></div>
    ${DEMO ? `<div class="secao"><h2>Sobre o BioCel</h2><div class="cartao" id="sobre"><p class="sub" style="margin:0 0 12px">BioCel: lições e a leitura do ciclo celular (cap. 18) e da meiose (cap. 19) do Alberts, para a 4ª prova. Feito pelo monitor; é um jeito extra de estudar, não substitui o livro nem as aulas.</p></div></div>` : `<div class="secao"><h2>Sincronização</h2><div class="cartao" id="sync"></div></div>`}
    <p class="sub" style="text-align:center;margin-top:24px">${DEMO ? "BioCel" : "Órbita"}</p>`;

  const abrirAvatar = () => telaAvatar(() => telaPerfil(), aoMudar);
  const abrirTitulos = () => telaTitulos(() => telaPerfil());
  t.querySelector("#bt-avatar").onclick = abrirAvatar;
  t.querySelector("#at-avatar").onclick = abrirAvatar;
  t.querySelector("#bt-selo").onclick = abrirTitulos;
  t.querySelector("#at-titulos").onclick = abrirTitulos;
  t.querySelector("#ver-desemp").onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "desempenho" }));
  t.querySelector("#at-desemp").onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "desempenho" }));
  t.querySelector("#bt-foco")?.addEventListener("click", () => import("./foco.js").then(m => m.abrirFoco()));
  t.querySelector("#bt-semana")?.addEventListener("click", () => import("./resumoSemana.js").then(m => m.verResumo(new Date().getDay() !== 1)));
  t.querySelector("#bt-aulas")?.addEventListener("click", () => import("./gravacao/telaGravacao.js").then(m => m.abrirAulas("perfil")));
  t.querySelector("#at-colecao").onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "colecao" }));
  t.querySelector("#bt-nome").onclick = async () => {
    const r = await formulario({ titulo: "Seu nome", campos: [{ id: "nome", rotulo: "Como quer aparecer no perfil", valor: av().nome || "" }] });
    if (r) { av().nome = String(r.nome || "").slice(0, 30); salvar(); telaPerfil(); }
  };

  const prefs = t.querySelector("#prefs");
  const chave = (rot, k, depois) => {
    const l = document.createElement("div"); l.className = "linha-cfg"; l.innerHTML = `<span>${rot}</span>`;
    const b = document.createElement("button"); b.className = `chave ${est.config[k] ? "on" : ""}`; b.setAttribute("aria-label", rot);
    b.onclick = () => { est.config[k] = !est.config[k]; salvar(); b.classList.toggle("on"); depois?.(est.config[k]); };
    l.append(b); prefs.append(l);
  };
  // o que vale para o Órbita inteiro (aparência, ao abrir, sons, vibração, GitHub, backup, atualização) mora nos
  // Ajustes do Órbita (ajustes.js, engrenagem da Home); aqui ficam só os dos Estudos
  if (!DEMO) {
    const ir = document.createElement("button"); ir.className = "linha-cfg aj-atalho"; ir.type = "button";
    ir.innerHTML = `<span>Ajustes do Órbita<small class="sub" style="display:block;font-size:12px">Tema e fundo, sons e vibração, token do GitHub, sincronização, backup e atualização</small></span><span aria-hidden="true">›</span>`;
    ir.onclick = () => import("./ajustes.js").then(m => m.abrirAjustes());
    prefs.append(ir);
  } else chave("Efeitos sonoros", "som");
  chave("Música de fundo", "musica", v => { musica(v); infoMusica(); });
  const lm = document.createElement("div"); lm.className = "linha-musica";
  lm.innerHTML = `<label>Volume da música<input type="range" min="5" max="100" step="5"></label><div class="tocando"><span></span><button class="botao secundario mini">Próxima ♪</button></div>`;
  const rg = lm.querySelector("input"); rg.value = est.config.volMusica ?? 60;
  rg.oninput = () => { est.config.volMusica = +rg.value; volumeMusica(); };
  rg.onchange = () => salvar();
  lm.querySelector("button").onclick = () => { proximaFaixa(); };
  const ll = document.createElement("label"); ll.className = "campo"; ll.style.marginTop = "10px";
  ll.innerHTML = `Nas lições e jogos<select><option value="auto">Do álbum Estudos (Músicas), se tiver músicas</option><option value="app">A música do app</option><option value="silencio">Silêncio</option></select>`;
  const sl = ll.querySelector("select"); sl.value = est.config.musicaLicoes || "auto";
  sl.onchange = () => { est.config.musicaLicoes = sl.value; salvar(); reavaliarMusica(); };
  lm.append(ll);
  const infoMusica = () => {
    lm.hidden = !est.config.musica;
    lm.querySelector("span").textContent = tocandoAgora() ? `Tocando: ${tocandoAgora()}` : "A música começa no próximo toque na tela.";
  };
  window.addEventListener("oq-musica", () => { if (lm.isConnected) infoMusica(); });
  const lf = document.createElement("div"); lf.className = "linha-cfg"; lf.innerHTML = `<span>Continuar tocando fora do app<small class="sub" style="display:block;font-size:12px">A música segue quando você sai sem fechar o app.</small></span>`;
  const bf = document.createElement("button"); bf.className = `chave ${est.config.musicaFundo ? "on" : ""}`; bf.setAttribute("aria-label", "Continuar tocando fora do app");
  bf.onclick = () => { est.config.musicaFundo = !est.config.musicaFundo; salvar(); bf.classList.toggle("on"); atualizarFundoNativo(); };
  lf.append(bf); lm.append(lf);
  prefs.append(lm); infoMusica(); ll.remove(); lf.remove();
  if (DEMO) chave("Vibração", "vibrar");
  // tema, fundo (liso ou uma das imagens) e bolhas, iguais em todos os subapps (aparencia.js)
  const tema = document.createElement("div"); tema.className = "linha-cfg"; tema.style.marginTop = "12px";
  tema.innerHTML = `<span>Aparência<small class="sub" style="display:block;font-size:12px">Tema claro ou escuro, fundo liso ou com imagem e as bolhas</small></span><button class="botao secundario" style="width:auto;padding:8px 14px">Mudar</button>`;
  tema.querySelector("button").onclick = () => import("./aparencia.js").then(m => m.abrirAparencia({ aoTema: aplicarTema }));
  const meta = document.createElement("label"); meta.className = "campo";
  meta.innerHTML = DEMO ? `Meta diária<select><option value="5">5 lições</option><option value="10">10 lições</option><option value="15">15 lições</option></select>` : `Meta diária<select><option value="5">5 lições (uma sessão)</option><option value="10">10 lições (duas sessões)</option><option value="15">15 lições (manhã, tarde e noite)</option><option value="auto">Automática, pelo tamanho do dia (6, 9 ou 12)</option></select><span class="dica">Automática: a Agenda decide se o dia é corrido, normal ou livre (dá para trocar no Meu dia).</span>`;
  const sm = meta.querySelector("select"); sm.value = !DEMO && est.config.metaAuto !== false ? "auto" : String(est.config.meta);
  sm.onchange = () => { if (sm.value === "auto") est.config.metaAuto = true; else { est.config.meta = +sm.value; est.config.metaAuto = false; } salvar(); aoMudar(); };
  const wid = document.createElement("label"); wid.className = "campo";
  wid.innerHTML = `Widget da tela inicial mostra<select><option value="companheiro">O companheiro equipado</option><option value="avatar">O seu avatar</option></select><span class="dica">No Android: segure numa área vazia da tela inicial, toque em Widgets e procure Órbita.</span>`;
  const sw = wid.querySelector("select"); sw.value = est.config.widgetFigura || "companheiro";
  sw.onchange = () => { est.config.widgetFigura = sw.value; salvar(); aoMudar(); };
  // caneta nas lições (ferramentasLicao.js): no automático, o botão aparece no tablet ou depois de usar uma caneta
  const can = document.createElement("label"); can.className = "campo";
  can.innerHTML = `Caneta nas lições<select><option value="auto">Automático: no tablet ou depois de usar uma caneta</option><option value="sempre">Sempre mostrar o botão</option><option value="nunca">Nunca mostrar</option></select><span class="dica">Calculadora, caderno e marca-texto aparecem em todos os exercícios; a caneta escreve por cima do exercício.</span>`;
  const sc = can.querySelector("select"); sc.value = est.config.canetaLicoes || "auto";
  sc.onchange = () => { est.config.canetaLicoes = sc.value; salvar(); };
  prefs.append(tema, meta, can);
  if (DEMO) {
    const ab = document.createElement("label"); ab.className = "campo";
    ab.innerHTML = `Ao abrir o app<select><option value="home">A Home do Órbita, com todas as áreas</option><option value="ultima">A última área usada</option></select><span class="dica">Voltar ao app sem fechá-lo continua onde você estava; os widgets abrem direto a área deles.</span>`;
    const sa = ab.querySelector("select"); sa.value = est.config.abrirEm || "home";
    sa.onchange = () => { est.config.abrirEm = sa.value; salvar(); };
  }
  if (DEMO && temNotificacoes()) {
    const bx = document.createElement("button"); bx.className = "botao secundario"; bx.style.marginTop = "6px"; bx.textContent = "Permitir lembretes no horário exato";
    bx.onclick = async () => { if (!(await abrirAjusteAlarmeExato())) toast("Este Android não precisa dessa permissão."); };
    prefs.append(bx);
  }

  if (DEMO) {
    const bz = document.createElement("button"); bz.className = "botao secundario"; bz.textContent = "Recomeçar do zero";
    bz.onclick = async () => {
      const ok = await modal({ titulo: "Recomeçar do zero?", texto: "Apaga XP, moedas, coleção, jardim e o progresso das trilhas deste aparelho.", botoes: [{ texto: "Apagar tudo", valor: true, classe: "perigo" }, { texto: "Cancelar", classe: "secundario", valor: false }] });
      if (!ok) return;
      try { localStorage.clear(); } catch (e) { /* sem armazenamento */ }
      location.reload();
    };
    import("./nuvem.js").then(m => m.contaNoPerfil(t.querySelector("#sobre")));
    return;
  }
  // a conta do GitHub, o backup e a atualização ficam nos Ajustes do Órbita (ajustes.js); aqui só o Sincronizar e um atalho
  const sync = t.querySelector("#sync");
  const bs = document.createElement("button"); bs.className = "botao"; bs.textContent = "Sincronizar";
  bs.onclick = () => executarSync(bs);
  const ba2 = document.createElement("button"); ba2.className = "botao secundario"; ba2.style.marginTop = "12px"; ba2.textContent = "Token, backup e atualização: Ajustes do Órbita";
  ba2.onclick = () => import("./ajustes.js").then(m => m.abrirAjustes());
  sync.append(bs, ba2);
  if (!temToken()) sync.insertAdjacentHTML("afterbegin", `<p class="sub">Sem o token, o app só mostra as lições que vieram na instalação. Ponha o token nos Ajustes do Órbita (a engrenagem da Home).</p>`);
}
