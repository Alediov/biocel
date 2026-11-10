// Tela da agenda: dia a dia, presença, pendências, avaliações, frequência e edição do horário.
import { icone } from "./icones.js";
const ESTRELA = `${icone("⭐", "ico-inline")} `;
import { E, salvar, hojeISO, somaDias, difDias } from "./estado.js";
import * as AG from "./agenda.js";
import { tocar } from "./sons.js";
import { modal, toast, formulario, escapar, dataBR } from "./ui.js";
import { planoDeLembretes } from "./notificacoes.js";
import { ehPratica, localDoItem, registrosDa, editarRegistro } from "./caderno.js";
import { levarEventoAoCurriculo, atividadeDoEvento } from "./curriculo.js";
import { secaoAlarmes } from "./telaAlarmes.js";
import { abrirAulas, botaoGravarAula } from "./gravacao/telaGravacao.js";
import * as E3 from "./even3.js";
import { secaoWhats } from "./whatsapp/telaWhats.js";
import { secaoMudancas } from "./agendaAvisos/telaMudancas.js";

const tela = () => document.getElementById("tela");
let selecionado = null;
let mesVisto = null; // AAAA-MM do calendário mensal
let aoMudar = () => {};
export function definirAoMudarAgenda(fn) { aoMudar = fn; }
// resultado novo do Even3 (even3.js): troca só a seção, ou redesenha a Agenda aberta que ainda não a tinha
window.addEventListener("oq-even3", () => {
  const velha = document.querySelector("#tela .e3-sec");
  if (velha) { const nova = E3.secaoEven3({ aoEditar: (ev) => editarOnline(ev) }); if (nova) velha.replaceWith(nova); else velha.remove(); }
  else if (document.querySelector(".aba.ativa")?.dataset.aba === "agenda" && document.querySelector("#tela .agenda-cab")) telaAgenda();
});

// Destaques do WhatsApp (whatsapp/telaWhats.js, 04/11/2026, 20h53): o resumo curto segue as decisões; o "O que mudou"
// (agendaAvisos/telaMudancas.js) segue o pacote agenda-avisos e o Desfazer. Trocam só o cartão (ou somem).
function trocarCartao(sel, novo, depoisDe) {
  const velha = document.querySelector(`#tela ${sel}`), nova = novo();
  if (velha) { if (nova) velha.replaceWith(nova); else velha.remove(); return; }
  if (!nova || !document.querySelector("#tela .agenda-cab")) return; // a Agenda não está na tela
  const ref = depoisDe.map(x => document.querySelector(`#tela ${x}`)).find(Boolean);
  if (ref) ref.after(nova);
}
window.addEventListener("oq-whats", () => trocarCartao(".wa-sec", secaoWhats, [".am-sec", ".semana", ".ag-mes"]));
// uma mudança aplicada ou desfeita mexe no dia também: com a Agenda na tela, redesenha tudo onde estava
window.addEventListener("oq-agenda-avisos", () => {
  if (!document.querySelector("#tela .agenda-cab")) return;
  const el = document.scrollingElement || document.documentElement, y = el.scrollTop;
  telaAgenda(); el.scrollTop = y;
  requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = y; })); // depois do scrollIntoView da faixa dos dias
});

const ROT_TIPO = { T: "Teórica", P: "Prática", A: "Atividade", "": "" };
const nomeLongoDia = (iso) => {
  const h = hojeISO();
  const base = new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return iso === h ? `Hoje, ${base}` : iso === somaDias(h, 1) ? `Amanhã, ${base}` : iso === somaDias(h, -1) ? `Ontem, ${base}` : base[0].toUpperCase() + base.slice(1);
};

/** Marca a presença; numa atividade prática com "Fui", oferece registrar no caderno clínico. */
async function marcar(ev, st) {
  avisoRecompensa(AG.marcarPresenca(ev, st));
  telaAgenda();
  if (st !== "presente" || !ehPratica(ev.item) || registrosDa(ev.chave).length) return;
  const ok = await modal({ titulo: "Registrar no caderno clínico?", texto: "O que você viu, auxiliou ou fez, sem dados do paciente. Leva um minuto.", botoes: [{ texto: "Registrar agora", valor: true }, { texto: "Depois", classe: "secundario", valor: false }] });
  if (ok) abrirCaderno(ev);
}
function abrirCaderno(ev) {
  const [h1, m1] = ev.inicio.split(":").map(Number), [h2, m2] = ev.fim.split(":").map(Number);
  const regs = registrosDa(ev.chave);
  editarRegistro(regs[0] || { data: ev.data, local: localDoItem(ev.item), ocorrencia: ev.chave, horas: Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 30) / 2), procs: [] }, () => telaAgenda());
}

function avisoRecompensa(r) {
  if (!r) return;
  if (r.xp > 0) { tocar("moeda"); toast(`+${r.xp} XP${r.moedas ? ` e +${r.moedas} moedas` : ""}`); }
  else if (r.xp < 0) toast(`Ajustado: ${r.xp} XP`);
  aoMudar();
}

export function telaAgenda() {
  const t = tela(), hoje = hojeISO();
  selecionado ||= hoje;
  // os atalhos ficam na linha do Semana | Mês (pedido do Alediov, 03/11/2026: no alto, ao lado do título, ficavam altos demais)
  t.innerHTML = `<div class="agenda-cab"><h1 class="titulo-tela">Agenda</h1></div><div class="ag-linha"><div class="agenda-atalhos"><button class="cad-atalho gr-atalho">${icone("🎤", "ico-inline")} Aulas gravadas</button><button class="cad-atalho">${icone("📓", "ico-inline")} Caderno clínico</button></div></div>`;
  t.querySelector(".cad-atalho:not(.gr-atalho)").onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "caderno" }));
  t.querySelector(".gr-atalho").onclick = () => abrirAulas("agenda"); // gravação das aulas (gravacao/telaGravacao.js)

  // Semana (a faixa de dias) ou Mês (o calendário do mês; pedido do Alediov, 02/11/2026). A escolha fica em config.agendaVista
  const avs = AG.avaliacoes();
  const vista = E().config.agendaVista === "mes" ? "mes" : "semana";
  const seg = document.createElement("div"); seg.className = "ag-vista"; seg.setAttribute("role", "tablist");
  seg.innerHTML = [["semana", "Semana"], ["mes", "Mês"]].map(([v, n]) => `<button role="tab" data-v="${v}" class="${v === vista ? "on" : ""}" aria-selected="${v === vista}">${n}</button>`).join("");
  seg.querySelectorAll("button").forEach(b => (b.onclick = () => { if (b.dataset.v === vista) return; E().config.agendaVista = b.dataset.v; salvar(); tocar("toque"); telaAgenda(); requestAnimationFrame(() => document.querySelector(".ag-vista")?.scrollIntoView({ block: "nearest" })); }));
  t.querySelector(".ag-linha").prepend(seg);
  if (vista === "mes") t.append(calendarioMes(hoje, avs));
  else {
    // faixa de dias: 3 para trás, 11 para frente
    const semana = document.createElement("div"); semana.className = "semana";
    for (let i = -3; i <= 11; i++) {
      const d = somaDias(hoje, i), evs = AG.eventosDoDia(d);
      const b = document.createElement("button");
      b.className = `dia-chip ${d === hoje ? "hoje" : ""} ${d === selecionado ? "sel" : ""} ${AG.feriado(d) ? "feriado" : ""}`;
      const pontos = [
        ...avs.filter(a => a.data === d).map(() => '<i class="av"></i>'),
        ...AG.eventosOnlineDoDia(d).map(() => '<i class="on"></i>'),
        ...evs.filter(e => e.item.especial).map(() => '<i class="esp"></i>'),
        ...evs.filter(e => !e.item.especial).slice(0, 3).map(() => "<i></i>"),
      ].slice(0, 4).join("");
      b.innerHTML = `<small>${AG.DIAS_CURTOS[AG.diaSemana(d)]}</small><b>${Number(d.slice(8))}</b><span class="pontos">${pontos}</span>`;
      b.onclick = () => { selecionado = d; telaAgenda(); };
      semana.append(b);
    }
    t.append(semana);
    requestAnimationFrame(() => semana.querySelector(".sel")?.scrollIntoView({ inline: "center", block: "nearest" }));
  }

  // o que mudou pelos destaques do WhatsApp (agendaAvisos/: o pacote da tarefa da madrugada, com Desfazer) e o resumo
  // dos destaques para decidir (whatsapp/telaWhats.js): no alto, logo depois dos dias
  try { const m = secaoMudancas(); if (m) t.append(m); } catch (e) { console.warn("O que mudou:", e); }
  try { const w = secaoWhats(); if (w) t.append(w); } catch (e) { console.warn("WhatsApp:", e); }

  // pendências de presença
  const pend = AG.pendencias().filter(ev => ev.data !== selecionado || selecionado !== hoje);
  if (pend.length) {
    const sec = document.createElement("div"); sec.className = "secao";
    sec.innerHTML = `<h2>Confirme sua presença</h2><div class="cartao"></div>`;
    const box = sec.querySelector(".cartao");
    for (const ev of pend.slice(0, 6)) {
      const l = document.createElement("div"); l.className = "pendente-linha";
      l.innerHTML = `<span>${ev.item.especial ? ESTRELA : ""}${escapar(ev.item.curto || ev.item.nome)}${ev.item.tipo === "P" ? " (P)" : ""}<br><small class="sub">${dataBR(ev.data, { weekday: "short", day: "2-digit", month: "2-digit" })}, ${ev.inicio}</small></span>`;
      const mini = document.createElement("div"); mini.className = "mini";
      for (const [st, ic, rot] of [["presente", "✅", "Fui"], ["falta", "❌", "Faltei"], ["nao_teve", "🚫", "Não teve aula"]]) {
        const bt = document.createElement("button"); bt.innerHTML = icone(ic, "ico3d ico-medio"); bt.setAttribute("aria-label", rot);
        bt.onclick = () => marcar(ev, st);
        mini.append(bt);
      }
      l.append(mini); box.append(l);
    }
    if (pend.length > 6) box.insertAdjacentHTML("beforeend", `<p class="sub" style="margin:8px 0 0">E mais ${pend.length - 6}.</p>`);
    t.append(sec);
  }

  // certificados que não chegaram no prazo: no alto, para não passar
  const atrasados = AG.certificadosAtrasados();
  if (atrasados.length) {
    const sec = document.createElement("div"); sec.className = "secao";
    sec.innerHTML = `<h2>Certificados atrasados</h2>`;
    atrasados.forEach(e => sec.append(cartaoOnline(e)));
    t.append(sec);
  }

  // o dia selecionado
  const secDia = document.createElement("div"); secDia.className = "secao";
  secDia.innerHTML = `<h2 class="titulo-dia">${escapar(nomeLongoDia(selecionado))}</h2>`;
  const fer = AG.feriado(selecionado);
  if (fer) secDia.insertAdjacentHTML("beforeend", `<div class="faixa-info feriado">${icone("🎉", "ico-inline")} Feriado: ${escapar(fer.nome)}. Sem aulas.</div>`);
  for (const m of AG.marcosDoDia(selecionado)) secDia.insertAdjacentHTML("beforeend", `<div class="faixa-info">${icone("📌", "ico-inline")} ${escapar(m.nome)}</div>`);
  if (!fer && AG.foraDoSemestre(selecionado)) secDia.insertAdjacentHTML("beforeend", `<div class="faixa-info">Fora do período letivo.</div>`);
  const avsDia = avs.filter(a => a.data === selecionado);
  for (const a of avsDia) secDia.append(cartaoAvaliacao(a));
  const evs = AG.eventosDoDia(selecionado), onDia = AG.eventosOnlineDoDia(selecionado);
  if (!evs.length && !avsDia.length && !onDia.length) secDia.insertAdjacentHTML("beforeend", `<p class="sub">Nada marcado para este dia.</p>`);
  for (const ev of evs) secDia.append(cartaoEvento(ev));
  for (const s of onDia) secDia.append(cartaoOnline(s.ev, s));
  t.append(secDia);

  // avaliações chegam pelos pacotes da agenda (pedido do Alediov, 24/10/2026); aqui só compromissos e eventos
  const acoes = document.createElement("div"); acoes.className = "barra-acoes";
  const bComp = document.createElement("button"); bComp.className = "botao secundario"; bComp.textContent = "+ Compromisso";
  bComp.onclick = () => novoCompromisso(selecionado);
  const bOn = document.createElement("button"); bOn.className = "botao secundario"; bOn.textContent = "+ Evento";
  bOn.onclick = () => editarOnline({ data: selecionado >= hoje ? selecionado : hoje });
  acoes.append(bComp, bOn); t.append(acoes);

  // alarmes (telaAlarmes.js e alarmes.js, pedido do Alediov, 26/10/2026): próximo alarme e os próximos 14 dias
  try { t.append(secaoAlarmes(telaAgenda)); } catch (e) { console.warn("Alarmes:", e); }

  // Even3 de amanhã (even3.js, pedido do Alediov, 03/11/2026): a busca diária do workflow, os de Odontologia primeiro
  try { const s3 = E3.secaoEven3({ aoEditar: (ev) => editarOnline(ev) }); if (s3) t.append(s3); } catch (e) { console.warn("Even3:", e); }

  // eventos: os que esperam a presença (de algum dia), os próximos, os que esperam o certificado e o histórico; um evento
  // de vários dias aparece uma vez só, com os dias dentro do cartão
  const todosEv = AG.eventosOnline(), quando = (x) => (x ? x.data + x.inicio : "");
  const ultimaConf = (e) => quando(AG.sessoesAConfirmar(e).at(-1)), ultimoDia = (e) => quando(AG.sessoesDe(e).at(-1));
  const confirmar = todosEv.filter(e => AG.sessoesAConfirmar(e).length).sort((a, b) => ultimaConf(b).localeCompare(ultimaConf(a)));
  // de um evento que se repete, só a próxima data (as outras aparecem no dia e no mês)
  const proxOn = todosEv.filter(e => !confirmar.includes(e) && AG.proximaSessao(e)).sort((a, b) => quando(AG.proximaSessao(a)).localeCompare(quando(AG.proximaSessao(b))))
    .filter((e, i, l) => !e.recorrente || l.findIndex(x => x.recorrente === e.recorrente) === i);
  const futuro = (e) => !!AG.proximaSessao(e);
  const esperando = todosEv.filter(e => !confirmar.includes(e) && !proxOn.includes(e) && !futuro(e) && ["aguardando", "suporte"].includes(AG.situacaoCertificado(e)?.estado)).sort((a, b) => ultimoDia(a).localeCompare(ultimoDia(b)));
  const historico = todosEv.filter(e => !confirmar.includes(e) && !proxOn.includes(e) && !futuro(e) && !esperando.includes(e) && AG.situacaoCertificado(e)?.estado !== "atrasado")
    .sort((a, b) => ultimoDia(b).localeCompare(ultimoDia(a)));
  const secOn = document.createElement("div"); secOn.className = "secao";
  secOn.innerHTML = `<h2>Eventos</h2>`;
  if (!confirmar.length && !proxOn.length && !esperando.length) secOn.insertAdjacentHTML("beforeend", `<p class="sub">Palestras, seminários e simpósios, do Even3 ou presenciais, de um dia ou de vários. Toque em + Evento: eu aviso antes de começar e cobro o certificado se ele não chegar em ${AG.PRAZO_CERTIFICADO} dias.</p>`);
  for (const e of [...confirmar, ...proxOn, ...esperando]) secOn.append(cartaoOnline(e));
  // os que se repetem (agenda.js `recorrentes`): a regra, com Editar e Parar/Voltar a repetir
  for (const r of AG.recorrentes()) secOn.append(cartaoRecorrente(r));
  if (historico.length) {
    const det = document.createElement("details"); det.innerHTML = `<summary class="link" style="padding:6px 0">Eventos anteriores (${historico.length})</summary>`;
    historico.forEach(e => det.append(cartaoOnline(e)));
    secOn.append(det);
  }
  t.append(secOn);

  // próximas avaliações
  const futuras = avs.filter(a => a.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const semNota = avs.filter(a => a.data < hoje && a.nota == null);
  const secAv = document.createElement("div"); secAv.className = "secao";
  secAv.innerHTML = `<h2>Provas e trabalhos</h2>`;
  if (!futuras.length && !semNota.length) secAv.insertAdjacentHTML("beforeend", `<p class="sub">Nenhuma prova ou trabalho marcado.</p>`);
  for (const a of [...semNota, ...futuras]) secAv.append(cartaoAvaliacao(a));
  const passadas = avs.filter(a => a.nota != null).sort((a, b) => b.data.localeCompare(a.data));
  if (passadas.length) {
    const det = document.createElement("details"); det.innerHTML = `<summary class="link" style="padding:6px 0">Avaliações com nota (${passadas.length})</summary>`;
    passadas.forEach(a => det.append(cartaoAvaliacao(a)));
    secAv.append(det);
  }
  t.append(secAv);

  // frequência
  const freq = AG.frequencia();
  const secF = document.createElement("div"); secF.className = "secao";
  secF.innerHTML = `<h2>Frequência</h2>`;
  const seq = AG.sequenciaPresenca();
  if (!freq.length) secF.insertAdjacentHTML("beforeend", `<p class="sub">Aparece aqui conforme você confirma as presenças. Ir à aula vale 10 XP, a prática 15 XP e as atividades especiais 40 XP.</p>`);
  else {
    secF.insertAdjacentHTML("beforeend", `<p class="sub">Sequência atual: ${seq} presença${seq === 1 ? "" : "s"} seguida${seq === 1 ? "" : "s"}.</p>`);
    const ul = document.createElement("ul"); ul.className = "fracos freq";
    for (const [nome, f] of freq) {
      const tot = f.presente + f.falta, pct = tot ? Math.round(f.presente / tot * 100) : 100;
      ul.insertAdjacentHTML("beforeend", `<li><span>${f.especial ? ESTRELA : ""}${escapar(nome)}</span><b>${pct}% · ${f.falta} falta${f.falta === 1 ? "" : "s"}</b><div class="mini-barra"><div style="width:${pct}%"></div></div></li>`);
    }
    const c = document.createElement("div"); c.className = "cartao"; c.append(ul); secF.append(c);
  }
  t.append(secF);

  // horário
  const secH = document.createElement("div"); secH.className = "secao";
  secH.innerHTML = `<h2>Horário e lembretes</h2>`;
  const bH = document.createElement("button"); bH.className = "botao secundario"; bH.textContent = "Editar horário semanal";
  bH.onclick = telaEditorHorario;
  const bL = document.createElement("button"); bL.className = "botao secundario"; bL.style.marginTop = "12px"; bL.textContent = "Configurar lembretes";
  bL.onclick = configurarLembretes;
  secH.append(bH, bL); t.append(secH);
}

// ---------- calendário mensal ----------
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const TIPOS_PONTO = [["au", "Aula"], ["pr", "Prática"], ["esp", "Atividade"], ["av", "Prova"], ["on", "Evento"]];
/** Os tipos do dia, para os pontinhos do mês: aula, prática, atividade (CEO, HUOP, liga…), prova e evento. */
function tiposDoDia(d, avs) {
  const t = new Set();
  for (const ev of AG.eventosDoDia(d)) t.add(ev.item.especial || ev.item.tipo === "A" ? "esp" : (ev.tipoDia || ev.item.tipo) === "P" ? "pr" : "au");
  if (avs.some(a => a.data === d)) t.add("av");
  if (AG.eventosOnlineDoDia(d).length) t.add("on");
  return TIPOS_PONTO.map(([k]) => k).filter(k => t.has(k));
}
function calendarioMes(hoje, avs) {
  mesVisto ||= (selecionado || hoje).slice(0, 7);
  const [a, m] = mesVisto.split("-").map(Number), ini = `${mesVisto}-01`, dias = new Date(a, m, 0).getDate();
  const c = document.createElement("div"); c.className = "ag-mes";
  const atual = hoje.slice(0, 7);
  c.innerHTML = `<div class="ag-mes-cab"><button class="ag-mes-nav" data-d="-1" aria-label="Mês anterior">‹</button>
      <div><b>${NOMES_MES[m - 1][0].toUpperCase() + NOMES_MES[m - 1].slice(1)} de ${a}</b>${mesVisto !== atual ? `<button class="link ag-mes-hoje">voltar para hoje</button>` : ""}</div>
      <button class="ag-mes-nav" data-d="1" aria-label="Próximo mês">›</button></div>
    <div class="ag-mes-grade">${AG.DIAS_CURTOS.map(n => `<span class="ag-mes-sem">${n[0]}</span>`).join("")}</div>
    <div class="ag-mes-leg">${TIPOS_PONTO.map(([k, n]) => `<span><i class="${k}"></i>${n}</span>`).join("")}<span><i class="fer"></i>Feriado/recesso</span></div>`;
  const grade = c.querySelector(".ag-mes-grade");
  // semanas de domingo a sábado, com os dias do mês anterior e do seguinte (apagados) completando
  const primeiro = somaDias(ini, -AG.diaSemana(ini)), total = Math.ceil((AG.diaSemana(ini) + dias) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = somaDias(primeiro, i), fora = d.slice(0, 7) !== mesVisto;
    const fer = AG.feriado(d), rec = !fer && AG.marcosDoDia(d).some(x => /recesso|f[ée]rias/i.test(x.nome));
    const tipos = tiposDoDia(d, avs);
    const b = document.createElement("button");
    b.className = `ag-mes-dia${fora ? " fora" : ""}${d === hoje ? " hoje" : ""}${d === selecionado ? " sel" : ""}${fer || rec ? " feriado" : ""}${!fer && AG.foraDoSemestre(d) ? " sem-aula" : ""}`;
    b.dataset.d = d;
    b.setAttribute("aria-label", `${dataBR(d, { weekday: "long", day: "numeric", month: "long" })}${fer ? `, feriado: ${fer.nome}` : ""}${tipos.length ? `: ${tipos.map(k => TIPOS_PONTO.find(x => x[0] === k)[1].toLowerCase()).join(", ")}` : ""}`);
    b.innerHTML = `<b>${Number(d.slice(8))}</b><span class="pontos">${tipos.map(k => `<i class="${k}"></i>`).join("")}</span>`;
    b.onclick = () => { selecionado = d; mesVisto = d.slice(0, 7); tocar("toque"); telaAgenda(); requestAnimationFrame(() => document.querySelector(".titulo-dia")?.scrollIntoView({ block: "nearest", behavior: "smooth" })); };
    grade.append(b);
  }
  c.querySelectorAll(".ag-mes-nav").forEach(b => (b.onclick = () => {
    const [y, mm] = mesVisto.split("-").map(Number), dt = new Date(y, mm - 1 + Number(b.dataset.d), 1);
    mesVisto = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; tocar("toque"); telaAgenda();
  }));
  c.querySelector(".ag-mes-hoje")?.addEventListener("click", () => { mesVisto = atual; selecionado = hoje; telaAgenda(); });
  return c;
}

function cartaoEvento(ev) {
  const w = document.createElement("div"); w.className = "evento";
  w.innerHTML = `<div class="hora">${ev.inicio}<small>${ev.fim}</small></div>`;
  const c = document.createElement("div"); c.className = `ev-cartao ${ev.item.especial ? "especial" : ""}`;
  const tipo = ROT_TIPO[ev.tipoDia || ev.item.tipo] || "";
  c.innerHTML = `<h3>${escapar(ev.item.nome)}${ev.item.especial ? `<span class="tag esp">${ESTRELA}Especial</span>` : tipo && ev.item.tipo !== "A" ? `<span class="tag">${tipo}</span>` : ""}</h3>
    ${ev.movidaDe ? `<div class="meta">Remarcado (era ${dataBR(ev.movidaDe)})</div>` : ev.alterado ? `<div class="meta">Horário alterado neste dia</div>` : ""}
    ${ev.tema ? `<div class="meta tema-aula">${icone("📌", "ico-inline")} ${escapar(ev.tema)}</div>` : ""}
    ${ev.avisoDia ? `<div class="meta aviso-aula">${icone("🔔", "ico-inline")} ${escapar(ev.avisoDia)}</div>` : ""}
    ${ev.item.obs ? `<div class="meta">${escapar(ev.item.obs)}</div>` : ""}`;
  const mais = document.createElement("button"); mais.className = "mais"; mais.textContent = "⋯"; mais.setAttribute("aria-label", "Opções deste dia");
  mais.onclick = () => opcoesOcorrencia(ev);
  c.append(mais);
  if (ev.presenca) {
    const rot = { presente: `${icone("✅", "ico-inline")} Presente`, falta: `${icone("❌", "ico-inline")} Faltou`, nao_teve: `${icone("🚫", "ico-inline")} Não teve` }[ev.presenca];
    const s = document.createElement("div"); s.className = `status ${ev.presenca}`;
    s.innerHTML = `<span>${rot}</span>`;
    const alt = document.createElement("button"); alt.textContent = "Alterar";
    alt.onclick = () => s.replaceWith(botoesCheckin(ev));
    s.append(alt); c.append(s);
    if (ev.presenca === "presente" && ehPratica(ev.item)) {
      const n = registrosDa(ev.chave).length, cb = document.createElement("button"); cb.className = "cad-ev";
      cb.innerHTML = `${icone("📓", "ico-inline")} ${n ? "Ver no caderno clínico" : "Registrar no caderno clínico"}`;
      cb.onclick = () => abrirCaderno(ev); c.append(cb);
    }
  } else if (AG.jaComecou(ev)) c.append(botoesCheckin(ev));
  const bg = botaoGravarAula(ev); // "Gravar aula" nas aulas de hoje (gravacao/telaGravacao.js)
  if (bg) c.append(bg);
  w.append(c);
  return w;
}

function botoesCheckin(ev) {
  const box = document.createElement("div"); box.className = "checkin";
  const r = AG.recompensaPresenca(ev.item, "presente");
  for (const [st, cls, rot] of [["presente", "fui", `Fui (+${r.xp})`], ["falta", "faltei", "Faltei"], ["nao_teve", "", "Não teve"]]) {
    const b = document.createElement("button"); b.className = cls; b.textContent = rot;
    b.onclick = () => marcar(ev, st);
    box.append(b);
  }
  return box;
}

async function opcoesOcorrencia(ev) {
  const rod = ev.item.regra?.tipo === "rodizio";
  const botoes = [
    { texto: "Mudar horário ou data deste dia", valor: "mover", classe: "secundario" },
    { texto: "Cancelar só este dia", valor: "cancelar", classe: "secundario" },
  ];
  if (rod) botoes.push({ texto: `Não houve ${ev.item.curto} para ninguém (empurra a escala)`, valor: "pular", classe: "secundario" });
  if (ev.alterado) botoes.push({ texto: "Desfazer a alteração deste dia", valor: "restaurar", classe: "secundario" });
  botoes.push({ texto: "Editar no horário semanal", valor: "editar", classe: "secundario" });
  const v = await modal({ titulo: ev.item.nome, texto: `${dataBR(ev.data, { weekday: "long", day: "2-digit", month: "2-digit" })}, ${ev.inicio}–${ev.fim}`, botoes });
  if (v === "mover") {
    const f = await formulario({ titulo: "Remarcar este dia", campos: [
      { id: "data", rotulo: "Data", tipo: "date", valor: ev.data },
      { id: "inicio", rotulo: "Início", tipo: "time", valor: ev.inicio },
      { id: "fim", rotulo: "Fim", tipo: "time", valor: ev.fim }] });
    if (f?.data) { AG.alterarOcorrencia(ev, f); toast("Alterado só neste dia."); }
  } else if (v === "cancelar") { AG.cancelarOcorrencia(ev); toast("Cancelado neste dia."); }
  else if (v === "pular") {
    AG.pularRodizio(ev.item, ev.movidaDe || ev.data);
    const prox = AG.proximasOcorrencias(ev.item, 1)[0];
    toast(prox ? `Escala empurrada. Seu próximo ${ev.item.curto}: ${dataBR(prox, { weekday: "short", day: "2-digit", month: "2-digit" })}.` : "Escala empurrada.", 4200);
  } else if (v === "restaurar") AG.restaurarOcorrencia(ev);
  else if (v === "editar") return editarItem(ev.item, true);
  telaAgenda();
}

// ---------- avaliações ----------
function cartaoAvaliacao(a) {
  const hoje = hojeISO(), dias = difDias(hoje, a.data);
  const b = document.createElement("button"); b.className = "av-cartao";
  let cont;
  if (a.nota != null) cont = `<div class="contagem feita">${String(a.nota).replace(".", ",")}<small>de ${a.notaMax || 10}</small></div>`;
  else if (dias < 0) cont = `<div class="contagem">?<small>Nota</small></div>`;
  else cont = `<div class="contagem ${dias > 7 ? "longe" : ""}">${dias === 0 ? "Hoje" : dias}<small>${dias === 0 ? "" : dias === 1 ? "Dia" : "Dias"}</small></div>`;
  b.innerHTML = `${cont}<div><h3>${escapar(AG.TIPOS_AVALIACAO[a.tipo] || "Avaliação")} de ${escapar(a.disciplina)}</h3><p>${escapar(a.titulo || "")}${a.titulo ? ", " : ""}${dataBR(a.data, { weekday: "short", day: "2-digit", month: "2-digit" })}${a.hora ? ` às ${a.hora}` : ""}${a.local ? ` · ${escapar(a.local)}` : ""}</p>${a.conteudo ? `<p>${escapar(a.conteudo)}</p>` : ""}</div>`;
  b.onclick = () => (a.data < hoje || a.nota != null) ? opcoesAvaliacaoPassada(a) : editarAvaliacao(a);
  return b;
}

async function editarAvaliacao(a) {
  const discs = AG.disciplinas();
  const f = await formulario({
    titulo: a.id ? "Editar avaliação" : "Nova avaliação",
    campos: [
      { id: "tipo", rotulo: "Tipo", tipo: "select", valor: a.tipo || "prova", opcoes: Object.entries(AG.TIPOS_AVALIACAO) },
      { id: "disciplina", rotulo: "Disciplina", tipo: "select", valor: a.disciplina || discs[0], opcoes: [...discs.map(d => [d, d]), ["__outra", "Outra…"]] },
      { id: "outra", rotulo: "Nome da disciplina", tipo: "text", mostrarSe: v => v.disciplina === "__outra" },
      { id: "titulo", rotulo: "Título (opcional)", tipo: "text", valor: a.titulo || "", placeholder: "Ex.: 2ª prova, seminário de lesões" },
      { id: "data", rotulo: "Data", tipo: "date", valor: a.data || hojeISO() },
      { id: "hora", rotulo: "Horário (opcional)", tipo: "time", valor: a.hora || "" },
      { id: "conteudo", rotulo: "Conteúdo que cai", tipo: "textarea", valor: a.conteudo || "", dica: "Quanto mais detalhes (capítulos, temas), melhor eu adapto a trilha." },
    ],
    botoes: a.id ? [{ texto: "Salvar", acao: "salvar" }, { texto: "Excluir", acao: "excluir", classe: "secundario" }] : [{ texto: "Adicionar", acao: "salvar" }],
  });
  if (!f) return;
  if (f._acao === "excluir") { AG.removerAvaliacao(a.id); return telaAgenda(); }
  if (!f.data) return toast("Informe a data.");
  const disciplina = f.disciplina === "__outra" ? (f.outra || "Outra") : f.disciplina;
  AG.salvarAvaliacao({ ...a, tipo: f.tipo, disciplina, titulo: f.titulo, data: f.data, hora: f.hora, conteudo: f.conteudo });
  if (!a.id) { tocar("moeda"); toast("Avaliação cadastrada (+5 XP). Vou considerar na trilha."); }
  aoMudar(); telaAgenda();
}

async function opcoesAvaliacaoPassada(a) {
  const v = await modal({ titulo: `${AG.TIPOS_AVALIACAO[a.tipo]} de ${a.disciplina}`, texto: a.nota != null ? `Nota: ${a.nota} de ${a.notaMax || 10}` : "Como foi? Lançar a nota rende XP, e mais ainda se for boa.", botoes: [
    { texto: a.nota != null ? "Corrigir nota" : "Lançar nota", valor: "nota" },
    { texto: "Editar", valor: "editar", classe: "secundario" }] });
  if (v === "editar") return editarAvaliacao(a);
  if (v !== "nota") return;
  const f = await formulario({ titulo: "Lançar nota", campos: [
    { id: "nota", rotulo: "Nota", tipo: "number", valor: a.nota ?? "", passo: "0.1" },
    { id: "max", rotulo: "Nota máxima", tipo: "number", valor: a.notaMax || 10, passo: "0.1" }] });
  if (f?.nota == null) return;
  const r = AG.lancarNota(a, f.nota, f.max || 10);
  if (r.xp) { tocar(f.nota / (f.max || 10) >= 0.7 ? "fim" : "moeda"); toast(`+${r.xp} XP e +${r.moedas} moedas${r.gemas ? ` e +${r.gemas} gemas` : ""}`); }
  aoMudar(); telaAgenda();
}

// ---------- eventos ----------
// Um evento pode ter vários dias (continuações, pedido do Alediov, 26/10/2026): cada dia aparece na Agenda no seu dia, com
// lembrete e Fui / Não fui / Não teve próprios; o certificado é um só, do evento inteiro (conta do último dia).
const DM = { weekday: "short", day: "2-digit", month: "2-digit" };
const LEMBRETES = [["0", "Sem lembrete"], ["10", "10 minutos antes"], ["30", "30 minutos antes"], ["60", "1 hora antes"], ["1440", "1 dia antes"]];
const textoLembrete = (aviso) => (aviso ? `Lembrete ${aviso >= 1440 ? "1 dia" : aviso >= 60 ? `${aviso / 60} h` : `${aviso} min`} antes` : "Sem lembrete");
const ROT_PRES = { presente: ["✅", "Fui"], falta: ["❌", "Não fui"], nao_teve: ["🚫", "Não teve"] };
const horario = (s) => `${s.inicio}${s.fim ? ` às ${s.fim}` : ""}`;
const fmtH = (h) => String(h).replace(".", ",");
const parar = (fn) => (ev) => { ev.stopPropagation(); fn(); };

function contagemAte(s) {
  const dias = difDias(hojeISO(), s.data);
  return `<div class="contagem online ${dias > 7 ? "longe" : ""}">${dias <= 0 ? s.inicio : dias}<small>${dias <= 0 ? "Hoje" : dias === 1 ? "Dia" : "Dias"}</small></div>`;
}
const contagemPresenca = (st) => st === "presente" ? `<div class="contagem feita">${icone("✅", "ico3d ico-medio")}</div>` : `<div class="contagem passado">${icone(st === "falta" ? "❌" : "🚫", "ico3d ico-medio")}</div>`;

/** Fui / Não fui / Não teve de um dia, ou o que foi marcado (com Alterar). */
function presencaDoDia(s) {
  if (!s.presenca) {
    const box = document.createElement("div"); box.className = "checkin";
    for (const [st, cls, rot] of [["presente", "fui", "Fui (+20)"], ["falta", "faltei", "Não fui"], ["nao_teve", "", "Não teve"]]) {
      const b = document.createElement("button"); b.className = cls; b.textContent = rot;
      b.onclick = parar(() => { avisoRecompensa(AG.marcarPresencaOnline(s, st)); telaAgenda(); });
      box.append(b);
    }
    return box;
  }
  const st = document.createElement("div"); st.className = `status ${s.presenca}`;
  const [ic, rot] = ROT_PRES[s.presenca];
  st.innerHTML = `<span>${icone(ic, "ico-inline")} ${rot}</span>`;
  const alt = document.createElement("button"); alt.textContent = "Alterar";
  alt.onclick = parar(() => { avisoRecompensa(AG.marcarPresencaOnline(s, null)); telaAgenda(); });
  st.append(alt);
  return st;
}

/** Cartão de um evento. Com `s` (um dia, na faixa do dia), mostra aquele dia; sem, o evento inteiro (com os dias dentro, se forem vários). */
function cartaoOnline(e, s = null) {
  const ss = AG.sessoesDe(e), n = ss.length, multi = n > 1, cert = AG.situacaoCertificado(e);
  const foco = s || (multi ? null : ss[0]);
  const c = document.createElement("div"); c.className = `av-cartao on-cartao ${multi ? "on-multi" : ""} ${cert?.estado === "atrasado" ? "atrasado" : ""}`;
  let cont;
  if (foco) cont = foco.presenca ? contagemPresenca(foco.presenca) : AG.eventoOnlineComecou(foco) ? `<div class="contagem">?<small>Foi?</small></div>` : contagemAte(foco);
  else {
    const prox = AG.proximaSessao(e);
    cont = AG.sessoesAConfirmar(e).length ? `<div class="contagem">?<small>Foi?</small></div>` : prox ? contagemAte(prox)
      : contagemPresenca(AG.foiAoEvento(e) ? "presente" : ss.every(x => x.presenca === "nao_teve") ? "nao_teve" : "falta");
  }
  const etiqueta = multi ? `<span class="tag on-dias-tag">${foco ? AG.rotuloSessao(foco) : `${n} dias`}</span>` : "";
  const quando = foco ? `${dataBR(foco.data, DM)}, ${horario(foco)}` : `${dataBR(ss[0].data, DM)} a ${dataBR(ss[n - 1].data, DM)}`;
  const outros = foco && multi ? `<p class="sub on-outros">Também: ${ss.filter(x => x.ref !== foco.ref).map(x => `${dataBR(x.data, DM)}${x.presenca ? ` ${icone(ROT_PRES[x.presenca][0], "ico-inline")}` : ""}`).join(", ")}</p>` : "";
  const lembrete = foco && !AG.eventoOnlineComecou(foco) ? `<p class="sub">${textoLembrete(foco.aviso ?? AG.AVISO_ONLINE_MIN)}</p>` : "";
  const regra = AG.regraDe(e), plat = e.plataforma ? ` · ${escapar(e.plataforma)}` : "";
  const rep = regra ? `<p class="sub on-rec">${icone("🔁", "ico-inline")} ${escapar(AG.textoRegra(regra))}</p>` : "";
  c.innerHTML = `${cont}<div class="on-info"><h3>${escapar(e.nome)}${etiqueta}</h3><p>${AG.MODALIDADES[e.modalidade] || "Online"}${plat} · ${quando}</p>${rep}${lembrete}${outros}</div>`;
  const rod = document.createElement("div"); rod.className = "on-rodape";
  // presença: do dia em foco, ou de cada dia do evento
  if (foco) { if (foco.presenca || AG.eventoOnlineComecou(foco)) rod.append(presencaDoDia(foco)); }
  else {
    const lista = document.createElement("div"); lista.className = "on-dias";
    const prox = AG.proximaSessao(e);
    for (const x of ss) {
      const l = document.createElement("div"); l.className = `on-dia ${x.ref === prox?.ref ? "prox" : ""}`;
      const comecou = AG.eventoOnlineComecou(x);
      l.innerHTML = `<div class="on-dia-cab"><b>Dia ${x.i + 1}</b><span>${dataBR(x.data, DM)}, ${horario(x)}</span>${!comecou ? `<small>${x.ref === prox?.ref ? textoLembrete(x.aviso ?? AG.AVISO_ONLINE_MIN) : ""}</small>` : ""}</div>`;
      if (x.presenca || comecou) l.append(presencaDoDia(x));
      lista.append(l);
    }
    rod.append(lista);
  }
  // certificado: um só, do evento inteiro; na faixa do dia, só no cartão do último dia
  if (cert && multi && cert.estado !== "recebido" && !AG.eventoOnlineAcabou(e)) {
    if (!foco) rod.insertAdjacentHTML("beforeend", `<div class="on-cert"><span>${icone("🎓", "ico-inline")} Certificado: um só, do evento inteiro. O prazo de ${AG.PRAZO_CERTIFICADO} dias conta do último dia (${dataBR(ss[n - 1].data)}).</span></div>`);
  } else if (cert && (!foco || !multi || foco.i === n - 1)) rod.append(blocoCertificado(e, cert, multi));
  // continuação: num evento que ainda não acabou, sem abrir o formulário inteiro
  if (!s && !AG.eventoOnlineAcabou(e)) {
    const b = document.createElement("button"); b.className = "link-mini on-continuar"; b.textContent = "+ Adicionar continuação (outro dia)";
    b.onclick = parar(() => editarOnline(e, { maisUmDia: true }));
    rod.append(b);
  }
  if (rod.children.length) c.append(rod);
  c.onclick = () => editarOnline(e);
  return c;
}

/** Uma regra de evento que se repete: "Todo último sábado do mês · 19:00 às 20:00", Editar e Parar/Voltar a repetir. */
function cartaoRecorrente(r) {
  const c = document.createElement("div"); c.className = `on-regra${r.pausada ? " pausada" : ""}`; c.dataset.regra = r.id;
  const prox = AG.eventosOnline().filter(e => e.recorrente === r.id && e.data >= hojeISO()).map(e => e.data).sort()[0];
  c.innerHTML = `<span class="on-regra-ico">${icone("🔁", "ico3d")}</span><span class="on-regra-tx"><b>${escapar(r.nome)}</b>
    <small>${escapar(AG.textoRegra(r))} · ${r.inicio}${r.fim ? ` às ${r.fim}` : ""}${r.plataforma ? ` · ${escapar(r.plataforma)}` : ""}</small>
    <small>${r.pausada ? `Parado desde ${dataBR(r.pausada)}: não cria as próximas datas.` : prox ? `Próxima: ${dataBR(prox, DM)}. As datas dos próximos ${AG.MESES_A_FRENTE} meses aparecem sozinhas.` : "Sem datas nos próximos meses."}</small></span>`;
  const bts = document.createElement("div"); bts.className = "on-acoes";
  const be = document.createElement("button"); be.className = "link-mini"; be.textContent = "Editar";
  be.onclick = () => editarRecorrente(r);
  const bp = document.createElement("button"); bp.className = "link-mini"; bp.textContent = r.pausada ? "Voltar a repetir" : "Parar de repetir";
  bp.onclick = () => { AG.pausarRecorrente(r.id, !r.pausada); aoMudar(); toast(r.pausada ? "Voltou a repetir." : "Parou: as datas que já estão na Agenda ficam."); telaAgenda(); };
  bts.append(be, bp); c.append(bts);
  return c;
}
async function editarRecorrente(r) {
  const f = await formulario({ titulo: "Evento que se repete", campos: [
    { id: "nome", rotulo: "Nome", tipo: "text", valor: r.nome },
    { id: "plataforma", rotulo: "Onde (opcional)", tipo: "text", valor: r.plataforma || "", placeholder: "Ex.: YouTube · canal Patologia Fácil" },
    { id: "inicio", rotulo: "Início", tipo: "time", valor: r.inicio },
    { id: "fim", rotulo: "Término", tipo: "time", valor: r.fim || "" },
    { id: "aviso", rotulo: "Lembrete", tipo: "select", valor: String(r.aviso ?? AG.AVISO_ONLINE_MIN), opcoes: LEMBRETES }] });
  if (!f) return;
  if (!f.nome || !f.inicio || !f.fim || f.fim <= f.inicio) return toast("Informe o nome e os horários (o término depois do início).");
  AG.salvarRecorrente({ id: r.id, nome: f.nome, plataforma: f.plataforma, inicio: f.inicio, fim: f.fim, aviso: Number(f.aviso) });
  aoMudar(); toast("Salvo: as próximas datas acompanham (as já marcadas ficam como estão)."); telaAgenda();
}

function blocoCertificado(e, cert, multi) {
  const l = document.createElement("div"); l.className = `on-cert ${cert.estado}`;
  const ultimo = multi ? " depois do último dia" : "";
  const txt = {
    recebido: `${icone("🎓", "ico-inline")} Certificado recebido em ${dataBR(e.certificadoEm)}`,
    aguardando: `${icone("🎓", "ico-inline")} Certificado${multi ? " (um só, do evento inteiro)" : ""}: aguardando. Se não chegar até ${dataBR(cert.limite)} (${cert.faltam} ${cert.faltam === 1 ? "dia" : "dias"}), eu aviso.`,
    suporte: `${icone("🎓", "ico-inline")} Você falou com o suporte em ${dataBR(e.suporteEm)}. Aviso de novo em ${dataBR(cert.limite)} se não chegar.`,
    atrasado: `${icone("⚠️", "ico-inline")} O certificado não chegou ${e.suporteEm ? `${AG.PRAZO_SUPORTE} dias depois de falar com o suporte` : `em ${AG.PRAZO_CERTIFICADO} dias${ultimo}`}: escreva para o suporte do evento (no Even3, pela página do evento ou pelo e-mail da organização).`,
  }[cert.estado];
  l.innerHTML = `<span>${txt}</span>`;
  const bts = document.createElement("div"); bts.className = "on-acoes";
  if (cert.estado === "recebido") {
    const at = atividadeDoEvento(e.id);
    if (!at?.certId) {
      const b = document.createElement("button"); b.className = "link-mini"; b.textContent = at ? "Anexar no Currículo" : "Levar ao Currículo";
      b.onclick = parar(() => levarAoCurriculo(e));
      bts.append(b);
    }
    const b = document.createElement("button"); b.className = "link-mini"; b.textContent = "Desfazer";
    b.onclick = parar(() => { AG.marcarCertificado(e, false); telaAgenda(); });
    bts.append(b);
  } else {
    const b = document.createElement("button"); b.className = "botao mini"; b.textContent = "Recebi o certificado";
    b.onclick = parar(async () => {
      AG.marcarCertificado(e, true); tocar("moeda"); aoMudar();
      const h = AG.horasDoEvento(e), dias = AG.sessoesDe(e).filter(x => x.presenca === "presente").length;
      const texto = multi ? `Vai para o Currículo como uma atividade só${h ? `, com ${fmtH(h)} h (${dias === 1 ? "o dia" : `os ${dias} dias`} a que você foi)` : ""}: conta nos eventos, nas horas e nos editais.` : "Anexe no Currículo: ele conta nos eventos, nas horas e nos editais.";
      const v = await modal({ titulo: "Certificado recebido 🎓", texto, botoes: [{ texto: "Anexar no Currículo", valor: "cv" }, { texto: "Depois", valor: null, classe: "secundario" }] });
      if (v === "cv") levarAoCurriculo(e); else telaAgenda();
    });
    bts.append(b);
    if (cert.estado === "atrasado") {
      const s2 = document.createElement("button"); s2.className = "botao mini secundario"; s2.textContent = "Falei com o suporte";
      s2.onclick = parar(() => { AG.marcarSuporte(e); aoMudar(); toast(`Anotado. Se não chegar em ${AG.PRAZO_SUPORTE} dias, aviso de novo.`); telaAgenda(); });
      bts.append(s2);
    }
  }
  l.append(bts);
  return l;
}

/** Uma atividade só no Currículo, com as horas somadas dos dias a que foi, e o anexar do arquivo. */
function levarAoCurriculo(e) {
  const foi = AG.sessoesDe(e).filter(x => x.presenca === "presente");
  levarEventoAoCurriculo({ id: e.id, nome: e.nome, data: (foi[0] || AG.sessoesDe(e)[0]).data, horas: AG.horasDoEvento(e), dias: foi.length });
}

/** Formulário do evento: nome, formato e os dias (cada um com data, início, término e lembrete; "+ Outro dia"). */
function formEvento(e, sessoes) {
  return new Promise((ok) => {
    const m = document.getElementById("modal");
    m.innerHTML = "";
    const f = document.createElement("form"); f.className = "modal-caixa form form-evento"; f.noValidate = true;
    f.innerHTML = `<h2>${e.id ? "Editar evento" : "Novo evento"}</h2>
      <label class="campo"><span>Nome do evento</span><input name="nome" type="text" placeholder="Ex.: Simpósio de Cirurgia Bucomaxilofacial"></label>
      <label class="campo"><span>Formato</span><select name="modalidade">${Object.entries(AG.MODALIDADES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <div class="ev-sessoes"></div>
      <button type="button" class="ev-mais"></button>
      <small class="dica ev-dica">Vários dias, um certificado só: cada dia tem lembrete e presença próprios, e o prazo do certificado conta do último dia.</small>`;
    f.querySelector("[name=nome]").value = e.nome || "";
    f.querySelector("[name=modalidade]").value = e.modalidade || "online";
    const caixa = f.querySelector(".ev-sessoes"), mais = f.querySelector(".ev-mais");
    const desenhar = () => {
      caixa.innerHTML = "";
      const multi = sessoes.length > 1;
      mais.textContent = e.id ? "+ Adicionar continuação (outro dia)" : "+ Outro dia (evento de vários dias)";
      sessoes.forEach((s, k) => {
        const d = document.createElement("div"); d.className = `ev-sessao ${multi ? "multi" : ""}`;
        const pres = s.presenca ? ` <small class="ev-pres">${icone(ROT_PRES[s.presenca][0], "ico-inline")} ${ROT_PRES[s.presenca][1]}</small>` : "";
        d.innerHTML = `${multi ? `<div class="ev-sessao-cab"><b>Dia ${k + 1}${pres}</b><button type="button" class="ev-tirar">Tirar este dia</button></div>` : ""}
          <label class="campo"><span>Data</span><input type="date" data-k="data"></label>
          <div class="ev-horas"><label class="campo"><span>Início</span><input type="time" data-k="inicio"></label><label class="campo"><span>Término</span><input type="time" data-k="fim"></label></div>
          <label class="campo"><span>Lembrete</span><select data-k="aviso">${LEMBRETES.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`;
        d.querySelectorAll("[data-k]").forEach(inp => {
          inp.value = s[inp.dataset.k] ?? "";
          const pegar = () => { s[inp.dataset.k] = inp.dataset.k === "aviso" ? Number(inp.value) : inp.value; };
          inp.addEventListener("input", pegar); inp.addEventListener("change", pegar);
        });
        const tirar = d.querySelector(".ev-tirar");
        if (tirar) tirar.onclick = () => { sessoes.splice(k, 1); desenhar(); };
        caixa.append(d);
      });
    };
    const acrescentar = () => {
      const u = sessoes[sessoes.length - 1] || {};
      sessoes.push({ data: somaDias(u.data || hojeISO(), 1), inicio: u.inicio || "19:00", fim: u.fim || "", aviso: u.aviso ?? AG.AVISO_ONLINE_MIN });
      desenhar();
      requestAnimationFrame(() => caixa.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    };
    mais.onclick = acrescentar;
    desenhar();
    const fechar = (v) => { m.hidden = true; ok(v); };
    const botoes = e.id ? [["Salvar", "salvar", ""], ["Excluir", "excluir", "secundario"]] : [["Adicionar", "salvar", ""]];
    for (const [txt, acao, cls] of botoes) {
      const b = document.createElement("button"); b.type = "button"; b.className = `botao ${cls}`; b.textContent = txt;
      b.onclick = () => {
        if (acao === "excluir") return fechar({ _acao: "excluir" });
        const nome = f.querySelector("[name=nome]").value.replace(/\s+/g, " ").trim();
        if (!nome) return toast("Dê um nome ao evento.");
        for (const [k, s] of sessoes.entries()) {
          const dia = sessoes.length > 1 ? ` do dia ${k + 1}` : "";
          if (!s.data || !s.inicio || !s.fim) return toast(`Informe a data e os horários de início e de término${dia}.`);
          if (s.fim <= s.inicio) return toast(`O término${dia} precisa ser depois do início.`);
        }
        const chaves = sessoes.map(s => s.data + s.inicio);
        if (new Set(chaves).size < chaves.length) return toast("Há dois dias com a mesma data e o mesmo início.");
        fechar({ _acao: "salvar", nome, modalidade: f.querySelector("[name=modalidade]").value, sessoes });
      };
      f.append(b);
    }
    const bc = document.createElement("button"); bc.type = "button"; bc.className = "link"; bc.style.marginTop = "8px"; bc.textContent = "Cancelar";
    bc.onclick = () => fechar(null);
    f.append(bc);
    m.append(f); m.hidden = false;
    m.onclick = (ev) => { if (ev.target === m) fechar(null); };
    if (sessoes._maisUm) acrescentar();
  });
}

async function editarOnline(e, { maisUmDia = false } = {}) {
  const antigas = e.id ? AG.sessoesDe(e) : [];
  const sessoes = antigas.length
    ? antigas.map(s => ({ _ref: s.ref, id: s.ref === e ? undefined : s.ref.id, data: s.data, inicio: s.inicio, fim: s.fim, aviso: s.aviso ?? AG.AVISO_ONLINE_MIN, presenca: s.presenca || undefined }))
    : [{ data: e.data || hojeISO(), inicio: e.inicio || "19:00", fim: e.fim || "", aviso: AG.AVISO_ONLINE_MIN }];
  if (maisUmDia) sessoes._maisUm = true;
  const f = await formEvento(e, sessoes);
  if (!f) return false;
  if (f._acao === "excluir") {
    AG.removerEventoOnline(e.id); aoMudar();
    if (e.recorrente) toast("Só esta data saiu; as próximas continuam aparecendo.", 3200);
    return telaAgenda();
  }
  // dia tirado em que ele tinha ido: desfaz a recompensa daquele dia
  for (const s of antigas) if (s.presenca && !f.sessoes.some(x => x._ref === s.ref)) AG.marcarPresencaOnline(s, null);
  // `plataforma` e `link` (campos antigos) só ficam nas ocorrências de um evento que se repete (vêm da regra) e nos que
  // vieram do Even3 (even3.js)
  const { plataforma, link, ...resto } = e;
  AG.salvarEventoOnline({ ...resto, ...(e.recorrente || e.even3 ? { plataforma, link } : {}), nome: f.nome, modalidade: f.modalidade, sessoes: f.sessoes.map(({ _ref, ...x }) => x) });
  const n = f.sessoes.length, aviso = f.sessoes[0].aviso;
  if (!e.id) {
    tocar("moeda");
    const quando = { 10: "10 minutos", 30: "30 minutos", 60: "1 hora", 1440: "1 dia" }[aviso];
    toast(n > 1 ? `Evento de ${n} dias registrado (+5 XP). Cada dia tem o seu lembrete, e o certificado é um só.` : quando ? `Evento registrado (+5 XP). Eu aviso ${quando} antes.` : "Evento registrado (+5 XP).", 3400);
  } else if (n > antigas.length) toast(`Continuação adicionada: agora são ${n} dias.`);
  aoMudar(); telaAgenda();
  return true;
}

// ---------- compromissos e horário ----------
/** `pre`: { nome, inicio, fim } já preenchidos em "Outro compromisso…". Devolve true se salvou. */
async function novoCompromisso(data, pre = null) {
  const ag = AG.A();
  const porData = ag.itens.filter(i => i.regra?.tipo === "datas");
  const f = await formulario({
    titulo: "Novo compromisso",
    campos: [
      { id: "qual", rotulo: "O quê?", tipo: "select", opcoes: [...porData.map(i => [i.id, `${i.especial ? "★ " : ""}${i.nome}`]), ["__novo", "Outro compromisso…"]], valor: pre ? "__novo" : undefined },
      { id: "nome", rotulo: "Nome", tipo: "text", valor: pre?.nome || "", mostrarSe: v => v.qual === "__novo" },
      { id: "especial", rotulo: "Destacar como especial", tipo: "checkbox", mostrarSe: v => v.qual === "__novo" },
      { id: "data", rotulo: "Data", tipo: "date", valor: data },
      { id: "inicio", rotulo: "Início", tipo: "time", valor: pre?.inicio || "08:00", mostrarSe: v => v.qual === "__novo" },
      { id: "fim", rotulo: "Fim", tipo: "time", valor: pre?.fim || "12:00", mostrarSe: v => v.qual === "__novo" },
    ],
    botoes: [{ texto: "Adicionar", acao: "salvar" }],
  });
  if (!f?.data) return false;
  if (f.qual === "__novo") {
    if (!f.nome) { toast("Dê um nome ao compromisso."); return false; }
    AG.salvarItem({ id: AG.novoId(), dia: AG.diaSemana(f.data), nome: f.nome, curto: f.nome.split(" ")[0], tipo: "A", inicio: f.inicio, fim: f.fim, especial: f.especial, regra: { tipo: "datas", datas: [f.data] }, obs: "" });
  } else {
    const item = ag.itens.find(i => i.id === f.qual);
    item.regra.datas = [...new Set([...(item.regra.datas || []), f.data])].sort();
    AG.salvarItem(item);
  }
  toast("Compromisso adicionado. O lembrete chega na véspera, às 20h.");
  selecionado = f.data; telaAgenda();
  return true;
}

export function telaEditorHorario() {
  const t = tela(), ag = AG.A();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Agenda"; v.onclick = telaAgenda;
  t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela" style="margin-top:4px">Horário semanal</h1><p class="sub">Toque em um item para editar. Mudanças de um dia só são feitas pelo botão ⋯ na agenda.</p>`);
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const itens = ag.itens.filter(i => i.dia === d && i.regra?.tipo !== "datas").sort((a, b) => a.inicio.localeCompare(b.inicio));
    const avulsos = ag.itens.filter(i => i.dia === d && i.regra?.tipo === "datas");
    if (!itens.length && !avulsos.length) continue;
    const sec = document.createElement("div"); sec.className = "secao";
    sec.innerHTML = `<h2>${AG.DIAS[d]}</h2>`;
    const c = document.createElement("div"); c.className = "cartao";
    for (const it of [...itens, ...avulsos]) {
      const b = document.createElement("button"); b.className = "item-horario";
      const fmt = (d) => d.split("-").reverse().slice(0, 2).join("/");
      const regra = it.ate && it.ate < hojeISO() ? `encerrada em ${fmt(it.ate)}` : (it.regra?.tipo === "rodizio" ? `a cada ${it.regra.intervalo} semanas` : it.regra?.tipo === "datas" ? `${(it.regra.datas || []).filter(x => x >= hojeISO()).length} data(s) marcada(s)` : "toda semana") + (it.ate ? ` até ${fmt(it.ate)}` : "");
      if (it.ate && it.ate < hojeISO()) b.style.opacity = ".55";
      b.innerHTML = `<span><b>${it.especial ? ESTRELA : ""}${escapar(it.nome)}</b><small>${it.inicio}–${it.fim}${it.tipo && it.tipo !== "A" ? `, ${ROT_TIPO[it.tipo]}` : ""}, ${regra}</small></span><span>›</span>`;
      b.onclick = () => editarItem(it);
      c.append(b);
    }
    sec.append(c); t.append(sec);
  }
  const add = document.createElement("button"); add.className = "botao"; add.style.marginTop = "20px"; add.textContent = "Adicionar aula ou atividade";
  add.onclick = () => editarItem(null);
  t.append(add);
}

async function editarItem(item, voltarParaAgenda = false) {
  const novo = !item;
  item ||= { dia: 1, nome: "", curto: "", tipo: "T", inicio: "08:00", fim: "09:40", especial: false, regra: { tipo: "semanal" }, obs: "" };
  const r = item.regra || { tipo: "semanal" };
  const f = await formulario({
    titulo: novo ? "Nova aula ou atividade" : "Editar",
    campos: [
      { id: "nome", rotulo: "Nome", tipo: "text", valor: item.nome },
      { id: "curto", rotulo: "Nome curto (para o lembrete)", tipo: "text", valor: item.curto },
      { id: "tipo", rotulo: "Tipo", tipo: "select", valor: item.tipo, opcoes: [["T", "Aula teórica"], ["P", "Aula prática"], ["", "Aula"], ["A", "Atividade (monitoria, liga, estágio…)"]] },
      { id: "especial", rotulo: "Destacar como especial", tipo: "checkbox", valor: item.especial },
      { id: "regra", rotulo: "Repetição", tipo: "select", valor: r.tipo, opcoes: [["semanal", "Toda semana"], ["rodizio", "Rodízio (a cada N semanas)"], ["datas", "Só em datas marcadas"]] },
      { id: "dia", rotulo: "Dia da semana", tipo: "select", valor: String(item.dia), opcoes: [1, 2, 3, 4, 5, 6, 0].map(d => [String(d), AG.DIAS[d]]), mostrarSe: v => v.regra !== "datas" },
      { id: "intervalo", rotulo: "A cada quantas semanas", tipo: "number", valor: r.intervalo || 3, mostrarSe: v => v.regra === "rodizio" },
      { id: "ancora", rotulo: "Uma data em que você foi (ou vai)", tipo: "date", valor: r.ancora || hojeISO(), mostrarSe: v => v.regra === "rodizio", dica: "Use \"Não houve para ninguém\" na agenda quando a escala andar." },
      { id: "datas", rotulo: "Datas (dd/mm/aaaa, separadas por vírgula)", tipo: "textarea", valor: (r.datas || []).map(d => d.split("-").reverse().join("/")).join(", "), mostrarSe: v => v.regra === "datas" },
      { id: "ate", rotulo: "Último dia (opcional)", tipo: "date", valor: item.ate || "", mostrarSe: v => v.regra !== "datas", dica: "Quando a disciplina acaba antes do fim do semestre. Vazio: segue até o fim." },
      { id: "inicio", rotulo: "Início", tipo: "time", valor: item.inicio },
      { id: "fim", rotulo: "Fim", tipo: "time", valor: item.fim },
      { id: "obs", rotulo: "Observação", tipo: "text", valor: item.obs },
    ],
    botoes: novo ? [{ texto: "Adicionar", acao: "salvar" }] : [{ texto: "Salvar", acao: "salvar" }, { texto: "Excluir do horário", acao: "excluir", classe: "secundario" }],
  });
  const voltar = () => (voltarParaAgenda ? telaAgenda() : telaEditorHorario());
  if (!f) return voltar();
  if (f._acao === "excluir") {
    const ok = await modal({ titulo: `Excluir ${item.nome}?`, texto: "As presenças já marcadas continuam no histórico de XP.", botoes: [{ texto: "Excluir", valor: true }, { texto: "Manter", classe: "secundario", valor: false }] });
    if (ok) AG.removerItem(item.id);
    return voltar();
  }
  if (!f.nome) { toast("Dê um nome."); return voltar(); }
  let regra;
  if (f.regra === "rodizio") regra = { tipo: "rodizio", intervalo: Math.max(1, Math.round(f.intervalo || 1)), ancora: f.ancora, pulos: r.tipo === "rodizio" && r.ancora === f.ancora ? (r.pulos || []) : [] };
  else if (f.regra === "datas") {
    const datas = (f.datas.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || []).map(s => { const [d, m, a] = s.split("/"); return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; });
    regra = { tipo: "datas", datas: [...new Set(datas)].sort() };
  } else regra = { tipo: "semanal" };
  AG.salvarItem({ ...item, id: item.id || AG.novoId(), nome: f.nome, curto: f.curto || f.nome.split(" ")[0], tipo: f.tipo, especial: f.especial, dia: f.regra === "datas" ? (regra.datas[0] ? AG.diaSemana(regra.datas[0]) : item.dia) : Number(f.dia), ate: f.regra !== "datas" && f.ate ? f.ate : undefined, inicio: f.inicio, fim: f.fim, obs: f.obs, regra });
  toast("Horário salvo.");
  voltar();
}

async function configurarLembretes() {
  const cfg = AG.A().lembretes;
  const f = await formulario({ titulo: "Lembretes da agenda", campos: [
    { id: "ativo", rotulo: "Lembrar das aulas", tipo: "checkbox", valor: cfg.ativo },
    { id: "vespera", rotulo: "Na véspera, às", tipo: "time", valor: cfg.vespera },
    { id: "manha", rotulo: "No dia, às", tipo: "time", valor: cfg.manha }] });
  if (!f) return;
  Object.assign(cfg, { ativo: f.ativo, vespera: f.vespera || "20:00", manha: f.manha || "06:00" });
  AG.alterou();
  const prox = planoDeLembretes(3)[0];
  await modal({ titulo: "Lembretes salvos", texto: prox ? `Próximo: ${prox.titulo}\n${prox.corpo}` : "Nenhum lembrete nos próximos dias.", botoes: [{ texto: "Ok", valor: true }] });
}
