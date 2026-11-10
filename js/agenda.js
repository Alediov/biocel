// Agenda acadêmica: aulas recorrentes, rodízios (CEO), compromissos com data,
// presença com recompensas e avaliações (provas e trabalhos).
import { E, salvar, hojeISO, somaDias, difDias, ganhar, marcarVidaSuja, estatisticas } from "./estado.js";
import { DEMO } from "./edicao.js";

export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const uid = () => Math.random().toString(36).slice(2, 10);
export const diaSemana = (iso) => new Date(iso + "T12:00:00").getDay();

// ---------- agenda vazia na versão Demo ----------
function semente() {
  const a = (dia, nome, curto, tipo, inicio, fim, extra = {}) =>
    ({ id: uid(), dia, nome, curto, tipo, inicio, fim, especial: false, regra: { tipo: "semanal" }, obs: "", ...extra });
  return {
    inicioRegistro: hojeISO(),
    lembretes: { ativo: true, vespera: "20:00", manha: "06:00" },
    itens: [],
    excecoes: {},  // "itemId|data": { cancelada } | { movidaPara, inicio, fim } | { inicio, fim } (+ tema, tipo e aviso do dia: sala, o que levar)
    presencas: {}, // "itemId|data": "presente" | "falta" | "nao_teve"
  };
}

export function A() {
  const est = E();
  if (!est.agenda) { est.agenda = semente(); salvar(); }
  // eventos que se repetem (ex.: a palestra do Patologia Fácil no último sábado do mês): as ocorrências dos próximos meses,
  // uma vez por dia (e de novo quando uma regra muda, `gerarRecorrentes(true)`)
  if (recorrentesEm !== hojeISO()) { recorrentesEm = hojeISO(); gerarRecorrentes(est.agenda); }
  return est.agenda;
}
let recorrentesEm = null;
export function alterou() { marcarVidaSuja(); window.dispatchEvent(new Event("oq-agenda")); }

// ---------- ocorrências ----------
function ocorreNaRegra(item, data) {
  const r = item.regra || { tipo: "semanal" };
  // `ate`: o último dia da disciplina (ex.: METEP acabou em 29/10/2026); depois dele, não ocorre mais
  if (item.ate && data > item.ate) return false;
  if (r.tipo === "datas") return (r.datas || []).includes(data);
  if (diaSemana(data) !== item.dia) return false;
  if (r.tipo === "semanal") return true;
  if (r.tipo === "rodizio") {
    if (data < r.ancora) return false;
    const pulos = new Set(r.pulos || []);
    if (pulos.has(data)) return false;
    // conta os dias de atividade (semanais) desde a âncora, ignorando os pulos
    let n = 0;
    for (let d = r.ancora; d < data; d = somaDias(d, 7)) if (!pulos.has(d)) n++;
    return n % (r.intervalo || 1) === 0;
  }
  return false;
}

// ---------- calendário acadêmico (feriados, recessos, semestre) ----------
export function feriado(data) {
  return (A().calendario?.feriados || []).find(f => f.data === data) || null;
}
export function marcosDoDia(data) {
  return (A().calendario?.marcos || []).filter(m => m.data === data || (m.fim && m.data <= data && data <= m.fim));
}
export function foraDoSemestre(data) {
  // vários semestres (o calendário do ano seguinte já vem junto): fora de todos = sem aulas
  const c = A().calendario, ss = c?.semestres?.length ? c.semestres : c?.semestre ? [c.semestre] : [];
  return ss.length > 0 && !ss.some(s => data >= s.inicio && data <= s.fim);
}

/** Eventos de um dia, já com exceções aplicadas e em ordem de horário. */
export function eventosDoDia(data) {
  const ag = A(), lista = [];
  const semAulas = !!feriado(data) || foraDoSemestre(data);
  for (const item of ag.itens) {
    const chave = `${item.id}|${data}`;
    const exc = ag.excecoes[chave];
    if (semAulas && item.regra?.tipo !== "datas") continue;
    if (ocorreNaRegra(item, data)) {
      if (exc?.cancelada || (exc?.movidaPara && exc.movidaPara !== data)) continue;
      lista.push({ item, data, chave, inicio: exc?.inicio || item.inicio, fim: exc?.fim || item.fim, alterado: !!(exc?.inicio || exc?.fim), tema: exc?.tema || "", tipoDia: exc?.tipo || "", avisoDia: exc?.aviso || "" });
    }
  }
  // ocorrências movidas para este dia
  for (const [chave, exc] of Object.entries(ag.excecoes)) {
    if (exc.movidaPara !== data) continue;
    const [id, origem] = chave.split("|");
    if (origem === data) continue;
    const item = ag.itens.find(i => i.id === id);
    if (item) lista.push({ item, data, chave, inicio: exc.inicio || item.inicio, fim: exc.fim || item.fim, alterado: true, movidaDe: origem, tema: exc.tema || "", tipoDia: exc.tipo || "", avisoDia: exc.aviso || "" });
  }
  lista.forEach(ev => (ev.presenca = ag.presencas[ev.chave] || null));
  return lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function proximasOcorrencias(item, n = 4) {
  const out = [];
  for (let i = 0, d = hojeISO(); i < 120 && out.length < n; i++, d = somaDias(d, 1)) {
    if (eventosDoDia(d).some(ev => ev.item.id === item.id)) out.push(d);
  }
  return out;
}

// ---------- presença ----------
export function recompensaPresenca(item, status) {
  if (status === "presente") return item.especial ? { xp: 40, moedas: 10 } : item.tipo === "P" ? { xp: 15, moedas: 3 } : { xp: 10, moedas: 2 };
  if (status === "nao_teve") return { xp: 2, moedas: 0 };
  return { xp: 0, moedas: 0 };
}
export function marcarPresenca(ev, status) {
  const ag = A();
  const antes = ag.presencas[ev.chave] || null;
  if (antes === status) return null;
  const r0 = antes ? recompensaPresenca(ev.item, antes) : { xp: 0, moedas: 0 };
  const r1 = recompensaPresenca(ev.item, status);
  ag.presencas[ev.chave] = status;
  const dxp = r1.xp - r0.xp, dm = r1.moedas - r0.moedas;
  const rotulo = { presente: "Presença", falta: "Falta", nao_teve: "Sem aula" }[status];
  const real = ganhar(dxp, dm, `${rotulo}: ${ev.item.curto || ev.item.nome}`, "presenca");
  alterou();
  return { xp: real, moedas: dm };
}
export function jaComecou(ev) {
  const hoje = hojeISO();
  if (ev.data < hoje) return true;
  if (ev.data > hoje) return false;
  const agora = new Date().toTimeString().slice(0, 5);
  return agora >= ev.inicio;
}
export function pendencias() {
  const ag = A(), hoje = hojeISO(), out = [];
  const ini = [ag.inicioRegistro, somaDias(hoje, -7)].sort()[1];
  for (let d = ini; d <= hoje; d = somaDias(d, 1)) {
    for (const ev of eventosDoDia(d)) if (!ev.presenca && jaComecou(ev) && (d < hoje || new Date().toTimeString().slice(0, 5) >= ev.fim)) out.push(ev);
  }
  return out;
}
export function frequencia() {
  const ag = A(), por = {};
  for (const [chave, st] of Object.entries(ag.presencas)) {
    const item = ag.itens.find(i => i.id === chave.split("|")[0]);
    if (!item || st === "nao_teve") continue;
    const nome = item.tipo === "P" || item.tipo === "T" ? `${item.curto || item.nome} (${item.tipo})` : (item.curto || item.nome);
    const f = por[nome] ||= { presente: 0, falta: 0, especial: item.especial };
    f[st]++;
  }
  return Object.entries(por).sort((a, b) => b[1].falta - a[1].falta);
}
export function sequenciaPresenca() {
  const ag = A();
  const marcadas = Object.entries(ag.presencas).filter(([, s]) => s !== "nao_teve")
    .map(([k, s]) => ({ data: k.split("|")[1], s })).sort((a, b) => b.data.localeCompare(a.data));
  let n = 0;
  for (const m of marcadas) { if (m.s !== "presente") break; n++; }
  return n;
}

// ---------- edição de ocorrências ----------
export function cancelarOcorrencia(ev) { A().excecoes[`${ev.item.id}|${ev.movidaDe || ev.data}`] = { cancelada: true }; alterou(); }
export function alterarOcorrencia(ev, { data, inicio, fim }) {
  const origem = ev.movidaDe || ev.data;
  A().excecoes[`${ev.item.id}|${origem}`] = { movidaPara: data, inicio, fim };
  alterou();
}
export function restaurarOcorrencia(ev) { delete A().excecoes[`${ev.item.id}|${ev.movidaDe || ev.data}`]; alterou(); }
/** "Não houve CEO neste dia para ninguém": a escala inteira anda uma semana. */
export function pularRodizio(item, data) {
  const r = item.regra; r.pulos = [...new Set([...(r.pulos || []), data])].sort(); alterou();
}
export function salvarItem(item) {
  const ag = A(), i = ag.itens.findIndex(x => x.id === item.id);
  if (i >= 0) ag.itens[i] = item; else ag.itens.push({ ...item, id: item.id || uid() });
  alterou();
}
export function removerItem(id) { const ag = A(); ag.itens = ag.itens.filter(i => i.id !== id); alterou(); }
export function novoId() { return uid(); }

// ---------- eventos (palestras, seminários, simpósios; Even3 e outros, online ou presenciais) ----------
// Pedidos do Alediov (24/10/2026): nome, online ou presencial, data, início, término e lembrete (30 min antes, por
// padrão); depois de começar, Fui / Não fui / Não teve, como as aulas; e, se foi, o certificado: se não chegar em
// 30 dias, aviso (notificação e cartão no alto da Agenda) para falar com o suporte do evento; "Falei com o suporte"
// dá mais 15 dias antes de avisar de novo. A lista mora em A().eventosOnline (nome antigo, mantido). Desde 26/10/2026, um
// evento pode ter vários dias (continuações), com um certificado só (veja `sessoesDe`).
export const AVISO_ONLINE_MIN = 30;
export const PRAZO_CERTIFICADO = 30, PRAZO_SUPORTE = 15;
export const MODALIDADES = { online: "Online", presencial: "Presencial" };
export function eventosOnline() { return (A().eventosOnline ??= []); }

// Eventos de vários dias (pedido do Alediov, 26/10/2026: "tem eventos que são mais de um dia em diferentes horários, mas
// que só terão 1 certificado"). O 1º dia fica nos campos do próprio evento (data, inicio, fim, aviso, presenca), como
// nos eventos de um dia só (os salvos antes continuam valendo, e uma versão antiga do app em outro aparelho ainda vê o
// 1º dia), e os outros dias em `continuacoes` [{ id, data, inicio, fim, aviso, presenca }]. Cada dia tem lembrete e
// presença próprios; o certificado é um só, do evento inteiro, contado a partir do último dia.
const CAMPOS_SESSAO = ["data", "inicio", "fim", "aviso", "presenca"];
const ordemSessao = (a, b) => ((a.data || "") + (a.inicio || "")).localeCompare((b.data || "") + (b.inicio || ""));
/** Os dias (sessões) de um evento, em ordem: { ev, ref (onde mora: o evento ou a continuação), i, n, data, inicio, fim, aviso, presenca, nome, modalidade, id }. */
export function sessoesDe(e) {
  if (!e) return [];
  if (e.ev && e.ref) e = e.ev;
  const l = [e, ...(Array.isArray(e.continuacoes) ? e.continuacoes : [])].filter(r => r && r.data)
    .map(ref => ({ ev: e, ref, data: ref.data, inicio: ref.inicio || "", fim: ref.fim || "", aviso: ref.aviso, presenca: ref.presenca || null, nome: e.nome, modalidade: e.modalidade, id: e.id }))
    .sort(ordemSessao);
  l.forEach((s, i) => { s.i = i; s.n = l.length; });
  return l;
}
export const eventoDe = (x) => (x?.ev && x?.ref ? x.ev : x);
/** "Dia 2 de 3" (vazio num evento de um dia só). */
export const rotuloSessao = (s) => (s?.n > 1 ? `Dia ${s.i + 1} de ${s.n}` : "");
export function eventosOnlineDoDia(data) { return eventosOnline().flatMap(e => sessoesDe(e).filter(s => s.data === data)).sort(ordemSessao); }
/** Grava o evento; com `sessoes` (lista de dias), o mais cedo vai para os campos do evento e o resto para `continuacoes`. */
export function salvarEventoOnline(ev) {
  const { sessoes, ...dados } = ev;
  if (Array.isArray(sessoes) && sessoes.length) {
    const l = sessoes.filter(s => s.data).map(s => ({ ...s })).sort(ordemSessao), [p, ...resto] = l;
    for (const k of CAMPOS_SESSAO) { if (p[k] == null || p[k] === "") delete dados[k]; else dados[k] = p[k]; }
    if (resto.length) dados.continuacoes = resto.map(s => { const c = { id: s.id || uid() }; for (const k of CAMPOS_SESSAO) if (s[k] != null && s[k] !== "") c[k] = s[k]; return c; });
    else delete dados.continuacoes;
  }
  if (!foiAoEvento(dados)) delete dados.certificadoEm;
  const l = eventosOnline(), i = l.findIndex(x => x.id === dados.id);
  if (i >= 0) l[i] = dados;
  else { l.push({ ...dados, id: uid(), criadoEm: hojeISO() }); ganhar(5, 0, `Evento registrado: ${dados.nome}`, "presenca"); }
  alterou();
}
export function removerEventoOnline(id) {
  const ev = eventosOnline().find(x => x.id === id);
  // uma ocorrência de um evento que se repete: a regra não a recria (a data vai para `apagadas`)
  const rec = ev?.recorrente && (A().recorrentes || []).find(r => r.id === ev.recorrente);
  if (rec && ev.data) rec.apagadas = [...new Set([...(rec.apagadas || []), ev.recorrenteData || ev.data])].sort();
  A().eventosOnline = eventosOnline().filter(x => x.id !== id); alterou();
}

// ---------- eventos que se repetem (pedido do Alediov, 02/11/2026: "um evento todo último sábado do mês, uma palestra no
// YouTube no Canal Patologia Fácil, geralmente das 19h às 20h, com certificação") ----------
// Regras em A().recorrentes [{ id, nome, modalidade, plataforma, link?, regra: { tipo, diaSemana }, inicio, fim, aviso,
// desde, ate?, apagadas: [datas] }] (vêm pelo pacote `agenda` ou do app). Cada ocorrência vira um evento comum em
// A().eventosOnline (aviso, Fui / Não fui / Não teve, certificado e Currículo, como os outros), com id ESTÁVEL
// `<regra>-<data>` (os dois aparelhos geram a mesma, e a sincronização junta pelo id) e `recorrente` = id da regra. As
// ocorrências dos próximos ~3 meses aparecem sozinhas; uma ocorrência mudada (horário, continuação) fica como está, e
// uma apagada não volta (`apagadas`). Tipos de regra: "ultimo" (o último <diaSemana> do mês), "semanal" (todo
// <diaSemana>) e "mensal" (o dia `dia` de cada mês).
export const MESES_A_FRENTE = 3;
export function textoRegra(r) {
  const g = r?.regra || {}, d = DIAS[g.diaSemana ?? 6]?.toLowerCase();
  const fds = d === "sábado" || d === "domingo", nome = fds ? d : `${d}-feira`;
  if (g.tipo === "ultimo") return fds ? `Todo último ${nome} do mês` : `Toda última ${nome} do mês`;
  if (g.tipo === "semanal") return fds ? `Todo ${nome}` : `Toda ${nome}`;
  if (g.tipo === "mensal") return `Todo dia ${g.dia} do mês`;
  return "Repete";
}
/** As datas da regra entre `de` e `ate` (ISO, inclusivas). */
export function datasDaRegra(r, de, ate) {
  const g = r.regra || {}, out = [];
  const ini = [de, r.desde || de].sort()[1], fim = [ate, r.ate || ate].sort()[0];
  if (ini > fim) return out;
  if (g.tipo === "semanal") {
    let d = ini; while (diaSemana(d) !== g.diaSemana) d = somaDias(d, 1);
    for (; d <= fim; d = somaDias(d, 7)) out.push(d);
    return out;
  }
  // mensal e último <dia da semana> do mês: mês a mês
  let [a, m] = ini.split("-").map(Number);
  for (let k = 0; k < 60; k++, m++) {
    if (m > 12) { m = 1; a++; }
    const mm = String(m).padStart(2, "0"), ult = new Date(a, m, 0).getDate();
    let d;
    if (g.tipo === "mensal") d = `${a}-${mm}-${String(Math.min(g.dia || 1, ult)).padStart(2, "0")}`;
    else { // "ultimo": do último dia do mês para trás até o dia da semana
      let n = ult; while (new Date(a, m - 1, n, 12).getDay() !== (g.diaSemana ?? 6)) n--;
      d = `${a}-${mm}-${String(n).padStart(2, "0")}`;
    }
    if (`${a}-${mm}-01` > fim) break;
    if (d >= ini && d <= fim) out.push(d);
  }
  return out;
}
/** Cria as ocorrências que faltam (de hoje até ~3 meses), sem mexer nas que existem nem recriar as apagadas. */
export function gerarRecorrentes(ag = E().agenda, hoje = hojeISO()) {
  if (!ag?.recorrentes?.length) return 0;
  const lista = (ag.eventosOnline ??= []), ids = new Set(lista.map(e => e.id));
  const ate = somaDias(hoje, MESES_A_FRENTE * 31);
  let n = 0;
  for (const r of ag.recorrentes) {
    if (r.pausada) continue;
    const fora = new Set(r.apagadas || []);
    for (const d of datasDaRegra(r, hoje, ate)) {
      const id = `${r.id}-${d}`;
      if (ids.has(id) || fora.has(d)) continue;
      const ev = { id, nome: r.nome, modalidade: r.modalidade || "online", data: d, inicio: r.inicio, fim: r.fim, aviso: r.aviso ?? AVISO_ONLINE_MIN, recorrente: r.id, recorrenteData: d, criadoEm: d };
      if (r.plataforma) ev.plataforma = r.plataforma;
      if (r.link) ev.link = r.link;
      lista.push(ev); ids.add(id); n++;
    }
  }
  if (n) { marcarVidaSuja(); }
  return n;
}
export const recorrentes = () => (A().recorrentes ??= []);
export const regraDe = (ev) => (ev?.recorrente ? recorrentes().find(r => r.id === ev.recorrente) || null : null);
/** Para (ou volta a) repetir: parada, não cria mais ocorrências; as que já existem ficam. */
export function pausarRecorrente(id, pausar = true) {
  const r = recorrentes().find(x => x.id === id); if (!r) return;
  if (pausar) r.pausada = hojeISO(); else { delete r.pausada; gerarRecorrentes(A()); }
  alterou();
}
/** Grava (ou cria) uma regra; as ocorrências futuras ainda sem presença acompanham o nome e o horário novos. */
export function salvarRecorrente(r) {
  const l = recorrentes(), i = l.findIndex(x => x.id === r.id), hoje = hojeISO();
  if (i >= 0) l[i] = { ...l[i], ...r }; else l.push({ ...r, id: r.id || uid() });
  const atual = l[i >= 0 ? i : l.length - 1];
  for (const ev of eventosOnline()) if (ev.recorrente === atual.id && ev.data >= hoje && !ev.presenca && !ev.continuacoes?.length) {
    Object.assign(ev, { nome: atual.nome, inicio: atual.inicio, fim: atual.fim, aviso: atual.aviso ?? ev.aviso, modalidade: atual.modalidade || ev.modalidade });
    if (atual.plataforma) ev.plataforma = atual.plataforma;
  }
  gerarRecorrentes(A());
  alterou();
}
export function emHora(data, hhmm) { const [h, m] = (hhmm || "00:00").split(":").map(Number); const d = new Date(data + "T00:00:00"); d.setHours(h, m, 0, 0); return d; }
/** Começou? Vale para um dia (sessão) ou para o evento (o 1º dia). */
export const eventoOnlineComecou = (x) => new Date() >= emHora(x.data, x.inicio);
/** Já acabou (passou o término, ou 2 h depois do início se não tem término)? Num evento, o último dia. */
export function eventoOnlineAcabou(x) {
  const s = x?.ref ? x : sessoesDe(x).at(-1) || x;
  const fim = s.fim ? emHora(s.data, s.fim) : new Date(emHora(s.data, s.inicio).getTime() + 2 * 3600000);
  return new Date() > fim;
}
/** Dias que já começaram e ainda esperam o Fui / Não fui / Não teve. */
export const sessoesAConfirmar = (e) => sessoesDe(e).filter(s => !s.presenca && eventoOnlineComecou(s));
/** O próximo dia que ainda não começou (ou null). */
export const proximaSessao = (e) => sessoesDe(e).find(s => !eventoOnlineComecou(s)) || null;
/** Foi a algum dia do evento? */
export const foiAoEvento = (e) => sessoesDe(e).some(s => s.presenca === "presente");
const minutos = (s) => { if (!s.inicio || !s.fim) return 0; const [a, b] = s.inicio.split(":").map(Number), [c, d] = s.fim.split(":").map(Number); return Math.max(0, c * 60 + d - (a * 60 + b)); };
/** Carga horária dos dias a que foi (para o Currículo), em horas, de meia em meia. */
export const horasDoEvento = (e) => Math.round(sessoesDe(e).filter(s => s.presenca === "presente").reduce((t, s) => t + minutos(s), 0) / 30) / 2;
/** Fui (+20 XP e 5 moedas) por dia, Não fui ou Não teve; trocar de ideia desfaz a recompensa anterior. `x`: o dia (sessão) ou o evento (1º dia). */
export function marcarPresencaOnline(x, status) {
  const ref = x?.ref || x, ev = eventoDe(x), antes = ref.presenca || null;
  if (antes === status) return null;
  const valor = (st) => st === "presente" ? { xp: 20, moedas: 5 } : { xp: 0, moedas: 0 };
  const r0 = valor(antes), r1 = valor(status);
  if (status) ref.presenca = status; else delete ref.presenca;
  if (!foiAoEvento(ev)) delete ev.certificadoEm; // não foi a nenhum dia: não há certificado
  const s = sessoesDe(ev).find(y => y.ref === ref), dia = s?.n > 1 ? ` (dia ${s.i + 1} de ${s.n})` : "";
  const rot = { presente: "Foi ao evento", falta: "Não foi ao evento", nao_teve: "Evento não aconteceu" }[status] || "Presença desfeita";
  const real = ganhar(r1.xp - r0.xp, r1.moedas - r0.moedas, `${rot}: ${ev.nome}${dia}`, "presenca");
  alterou();
  return { xp: real, moedas: r1.moedas - r0.moedas };
}
/** Certificado de um evento em que esteve (em pelo menos um dia): null (não foi), ou { estado: recebido | aguardando |
 *  suporte | atrasado, limite, faltam, desde }. O prazo de 30 dias conta do ÚLTIMO dia do evento (menos os que não tiveram). */
export function situacaoCertificado(x) {
  const ev = eventoDe(x);
  if (!foiAoEvento(ev)) return null;
  if (ev.certificadoEm) return { estado: "recebido" };
  const ss = sessoesDe(ev), ultimo = (ss.filter(s => s.presenca !== "nao_teve").at(-1) || ss.at(-1)).data;
  const limite = somaDias(ev.suporteEm || ultimo, ev.suporteEm ? PRAZO_SUPORTE : PRAZO_CERTIFICADO), faltam = difDias(hojeISO(), limite);
  return { estado: faltam > 0 ? (ev.suporteEm ? "suporte" : "aguardando") : "atrasado", limite, faltam, desde: ultimo };
}
export function marcarCertificado(x, recebido) { const ev = eventoDe(x); if (recebido) ev.certificadoEm = hojeISO(); else delete ev.certificadoEm; alterou(); }
export function marcarSuporte(x) { eventoDe(x).suporteEm = hojeISO(); alterou(); }
export const certificadosAtrasados = () => eventosOnline().filter(e => situacaoCertificado(e)?.estado === "atrasado");

// ---------- avaliações ----------
export const TIPOS_AVALIACAO = { prova: "Prova", trabalho: "Trabalho", seminario: "Seminário", pratica: "Prova prática", outro: "Outro" };
export function avaliacoes() { return E().avaliacoes; }
export function salvarAvaliacao(av) {
  const lista = E().avaliacoes, i = lista.findIndex(x => x.id === av.id);
  if (i >= 0) lista[i] = av;
  else { lista.push({ ...av, id: uid(), criadaEm: hojeISO() }); ganhar(5, 0, `Avaliação cadastrada: ${av.titulo || av.disciplina}`); }
  alterou();
}
export function removerAvaliacao(id) { E().avaliacoes = E().avaliacoes.filter(a => a.id !== id); alterou(); }
export function lancarNota(av, nota, max = 10) {
  const primeira = av.nota == null;
  av.nota = nota; av.notaMax = max;
  if (primeira) {
    const p = nota / max;
    const xp = 20 + (p >= 0.9 ? 60 : p >= 0.7 ? 30 : 0), moedas = 5 + (p >= 0.9 ? 20 : p >= 0.7 ? 10 : 0);
    const real = ganhar(xp, moedas, `Nota lançada: ${av.titulo || av.disciplina}`);
    const gemas = p >= 0.9 ? 3 : 0;
    const sx = estatisticas(); sx.notaMax = Math.max(sx.notaMax || 0, Math.round(p * 10 * 10) / 10);
    if (gemas) { E().gemas = (E().gemas || 0) + gemas; salvar(); }
    alterou();
    return { xp: real, moedas, gemas };
  }
  alterou();
  return { xp: 0, moedas: 0 };
}
export function disciplinas() {
  return [...new Set(A().itens.filter(i => i.tipo !== "A").map(i => i.nome))].sort();
}

// ---------- texto dos lembretes ----------
const hora = (h) => h.replace(/^0/, "").replace(":00", "h").replace(":", "h");
export function textoLembrete(data, quando) {
  const evs = eventosDoDia(data);
  const avs = E().avaliacoes.filter(a => a.data === data);
  const fer = feriado(data);
  const futuras = quando === "vespera"
    ? E().avaliacoes.filter(a => [3, 7].includes(difDias(data, a.data)))
    : [];
  if (fer && !evs.length && !avs.length) {
    const teriaAula = A().itens.some(i => i.regra?.tipo !== "datas" && ocorreNaRegra(i, data));
    if (quando !== "vespera" || !teriaAula) return null;
    return { titulo: `Amanhã é feriado: ${fer.nome} 🎉`, corpo: "Sem aulas. A trilha de estudos continua normalmente.", longo: `Feriado: ${fer.nome}\nSem aulas. A trilha de estudos continua normalmente.` };
  }
  if (!evs.length && !avs.length && !futuras.length) return null;
  const esp = evs.filter(e => e.item.especial), outras = evs.filter(e => !e.item.especial);
  const nomeAv = (a) => `${TIPOS_AVALIACAO[a.tipo] || "Avaliação"} de ${a.disciplina}${a.titulo ? ` (${a.titulo})` : ""}`;
  let resumo = [];
  if (avs.length) resumo.push(`📝 ${avs.map(nomeAv).join(" + ")}`);
  if (esp.length) resumo.push(`⭐ ${esp.map(e => e.item.curto || e.item.nome).join(" + ")}`);
  if (outras.length) resumo.push(`${outras.length} aula${outras.length > 1 ? "s" : ""}`);
  if (!resumo.length) resumo.push("sem aulas");
  const prefixo = quando === "vespera" ? `Amanhã (${DIAS_CURTOS[diaSemana(data)]})` : "Hoje";
  const titulo = `${prefixo}: ${resumo.join(" · ")}`;
  const curto = evs.map(e => `${hora(e.inicio)} ${e.item.especial ? "⭐ " : ""}${e.item.curto || e.item.nome}${e.item.tipo === "P" ? " (P)" : ""}`).join(", ");
  const linhas = [
    ...avs.map(a => `📝 ${nomeAv(a)}${a.hora ? ` às ${a.hora}` : ""}`),
    ...evs.map(e => `${e.inicio}–${e.fim}  ${e.item.especial ? "⭐ " : ""}${e.item.nome}${e.item.tipo === "P" ? " (prática)" : ""}`),
    ...futuras.map(a => `⏳ Em ${difDias(data, a.data)} dias: ${nomeAv(a)}`),
  ];
  return { titulo, corpo: curto || linhas[0], longo: linhas.join("\n") };
}
