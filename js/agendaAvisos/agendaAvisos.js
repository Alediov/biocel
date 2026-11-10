// O pacote `config/agenda-avisos.json` (escrito pela tarefa da madrugada, gerador/WHATSAPP.md, a partir dos destaques do
// WhatsApp que o Alediov mandou ao Claude): cada operação é aplicada UMA vez neste estado (as regras em operacoes.js), com
// o `antes` guardado para o Desfazer; desfeita, não volta (nem quando o pacote vem de novo). Estado em
// E().agendaAvisos (sincroniza; registros com `em`):
//   ops[id]       = { op: { tipo, alvo, depois }, tipo, resumo, de: [ids das mensagens], dia, estado: "aplicada" |
//                     "desfeita" | "falhou", antes, erro?, visto?, em }
//   perguntas[id] = { texto, opcoes?, de, dia, fechada?, em }   (a pergunta aparece em Destaques, em Mensagens)
//   respostas[id] = { r, em, env? }                                 (sobe com o próximo envio do WhatsApp)
//   lidas[idMsg]  = { resultado: "aplicada" | "nada" | "pergunta" | "cancelada", obs?, em }   (o que a tarefa fez de cada mensagem)
// Tela: "O que mudou" no alto da Agenda (telaMudancas.js), o item do Meu dia e as perguntas em Destaques.
import { E, salvar, hojeISO } from "../estado.js";
import { A, alterou } from "../agenda.js";
import * as O from "./operacoes.js";

const DIAS_GUARDA = 60, DIAS_CARTAO = 10;
export function S() {
  const s = (E().agendaAvisos ||= {});
  s.ops ||= {}; s.perguntas ||= {}; s.respostas ||= {}; s.lidas ||= {};
  return s;
}
const agora = () => new Date().toISOString();
const ctx = () => ({ ag: A(), avs: (E().avaliacoes ||= []) });
const avisar = () => { window.dispatchEvent(new Event("oq-agenda-avisos")); window.dispatchEvent(new Event("oq-topo")); };

/** Aplica o pacote (pacotes.js, a cada versão nova): as operações novas (e as que falharam antes, de novo), as
 *  perguntas novas e o resumo do que foi lido. */
export function aplicarPacoteAvisos(pkg) {
  const s = S(), c = ctx(), em = agora();
  let mudou = false;
  for (const op of pkg.operacoes || []) {
    const r = s.ops[op.id];
    if (r && r.estado !== "falhou") continue; // aplicada ou desfeita: uma vez só
    const res = O.aplicar(c, op);
    s.ops[op.id] = { op: { tipo: op.tipo, alvo: op.alvo || null, depois: op.depois || null }, tipo: op.tipo, resumo: op.resumo || "",
      de: [].concat(op.de || []), dia: op.em || hojeISO(), estado: res.ok ? "aplicada" : "falhou", antes: res.ok ? res.antes ?? null : null,
      ...(res.ok ? {} : { erro: res.erro }), em };
    if (res.ok) mudou = true;
  }
  for (const p of pkg.perguntas || []) {
    const r = s.perguntas[p.id];
    if (!r) s.perguntas[p.id] = { texto: p.texto, opcoes: p.opcoes || [], de: [].concat(p.de || []), dia: p.em || hojeISO(), ...(p.fechada ? { fechada: true } : {}), em };
    else if (p.fechada && !r.fechada) s.perguntas[p.id] = { ...r, fechada: true, em };
  }
  for (const [id, l] of Object.entries(pkg.lidas || {})) if (!s.lidas[id] || (l.em || "") > (s.lidas[id].em || "")) s.lidas[id] = { ...l, em: l.em || em };
  podar(s);
  if (mudou) alterou();
  salvar(); avisar();
}
function podar(s) {
  const corte = new Date(Date.now() - DIAS_GUARDA * 864e5).toISOString();
  for (const k of ["ops", "perguntas", "respostas", "lidas"]) for (const [id, r] of Object.entries(s[k])) if ((r?.em || "") < corte && !(k === "respostas" && !r.env)) delete s[k][id];
}

/** Depois do pacote `agenda` (pacotes.js): as mudanças ativas em avaliações e no horário fixo voltam por cima. */
export function reaplicarSobrePacote() {
  const s = E().agendaAvisos; if (!s?.ops) return;
  const c = ctx();
  for (const r of Object.values(s.ops)) if (r.estado === "aplicada" && (r.tipo === "avaliacao" || r.tipo === "item")) O.reaplicar(c, r.op);
}

/** Desfaz uma mudança (fica "desfeita": o pacote não a aplica de novo). Devolve { ok } ou { ok: false, erro }. */
export function desfazer(id) {
  const r = S().ops[id]; if (!r || r.estado !== "aplicada") return { ok: false, erro: "nada a desfazer" };
  const res = O.desfazer(ctx(), r.op, r.antes);
  if (!res.ok) return res;
  S().ops[id] = { ...r, estado: "desfeita", visto: true, em: agora() };
  alterou(); salvar(); avisar();
  return { ok: true };
}
/** Volta a aplicar uma mudança desfeita (ele mudou de ideia). */
export function refazer(id) {
  const r = S().ops[id]; if (!r || r.estado === "aplicada") return { ok: false, erro: "já está aplicada" };
  const res = O.aplicar(ctx(), r.op);
  if (!res.ok) return { ok: false, erro: res.erro };
  S().ops[id] = { ...r, estado: "aplicada", antes: res.antes ?? null, visto: true, em: agora() };
  delete S().ops[id].erro;
  alterou(); salvar(); avisar();
  return { ok: true };
}

/** As mudanças dos últimos dias, a mais nova primeiro: [{ id, ...registro }]. */
export function mudancas({ dias = DIAS_CARTAO } = {}) {
  const corte = new Date(Date.now() - dias * 864e5).toISOString();
  return Object.entries(E().agendaAvisos?.ops || {}).map(([id, r]) => ({ id, ...r }))
    .filter(r => (r.em || "") >= corte || (r.estado !== "desfeita" && !r.visto))
    // as desfeitas por último; as ainda não vistas no alto (o cartão mostra só as primeiras, 06/11/2026); o resto da
    // noite mais nova para a mais velha, na ordem do pacote
    .sort((a, b) => (a.estado === "desfeita") - (b.estado === "desfeita") || ehNova(b) - ehNova(a) || (b.dia || "").localeCompare(a.dia || "") || a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
}
function ehNova(r) {
  return !r.visto && r.estado !== "desfeita" ? 1 : 0;
}
export const novas = () => mudancas({ dias: DIAS_GUARDA }).filter(r => !r.visto && r.estado !== "desfeita");
export function marcarVistas() {
  const s = S(), em = agora();
  let n = 0;
  for (const r of novas()) { s.ops[r.id] = { ...s.ops[r.id], visto: true, em }; n++; }
  if (n) { salvar(); avisar(); }
}
/** Os ids das mensagens de uma mudança ou pergunta, e o que a tarefa fez de uma mensagem. */
export const lida = (idMsg) => E().agendaAvisos?.lidas?.[idMsg] || null;
export const mudancasDe = (idMsg) => mudancas({ dias: DIAS_GUARDA }).filter(r => r.de?.includes(idMsg));

// ---------------------------------------------------------------- perguntas da tarefa
export function perguntasAbertas() {
  const s = E().agendaAvisos; if (!s?.perguntas) return [];
  return Object.entries(s.perguntas).filter(([id, p]) => !p.fechada && !s.respostas?.[id]).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.em || "").localeCompare(a.em || ""));
}
/** As perguntas ainda não fechadas pela tarefa (respondidas ou não), a mais nova primeiro. */
export function perguntasParaMostrar() {
  const s = E().agendaAvisos; if (!s?.perguntas) return [];
  return Object.entries(s.perguntas).filter(([, p]) => !p.fechada).map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.em || "").localeCompare(a.em || ""));
}
export const respostaDe = (id) => E().agendaAvisos?.respostas?.[id] || null;
export function responder(id, texto) {
  const t = String(texto || "").trim().slice(0, 400); if (!t) return;
  S().respostas[id] = { r: t, em: agora() };
  salvar(); avisar();
}
export function desfazerResposta(id) { const r = S().respostas[id]; if (r && !r.env) { delete S().respostas[id]; salvar(); avisar(); } }
/** As respostas que ainda não subiram (whatsapp.js `enviar` manda junto). */
export function respostasParaEnviar() {
  const s = E().agendaAvisos; if (!s?.respostas) return [];
  return Object.entries(s.respostas).filter(([, r]) => !r.env).map(([id, r]) => ({
    pergunta: id, resposta: r.r, feito: () => { const x = S().respostas[id]; if (x && x.r === r.r) x.env = new Date().toISOString(); } }));
}

// ---------------------------------------------------------------- Meu dia
export function itensMeuDia() {
  const l = [], n = novas();
  if (n.length) l.push({ id: "agenda-avisos", icone: "📅", titulo: n.length > 1 ? `A Agenda mudou: ${n.length} mudanças` : "A Agenda mudou",
    detalhe: n[0].resumo, feito: null, ir: { area: "learn", tela: "agenda", rolar: ".am-sec" } }); // informativo: não conta no anel
  const p = perguntasAbertas();
  if (p.length) l.push({ id: "agenda-perguntas", icone: "❓", titulo: p.length > 1 ? `${p.length} perguntas do Claude sobre a Agenda` : "Uma pergunta do Claude sobre a Agenda",
    detalhe: p[0].texto, feito: false, ir: { area: "eva", conversa: "destaques" } });
  return l;
}
