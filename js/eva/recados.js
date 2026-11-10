// Recados do Claude (pedido do Alediov, 09/11/2026: ele não lê as respostas das tarefas agendadas, mas lê a Eva). O
// pacote `config/recados.json` (tools/recados.py, roteiro em gerador/RECADOS.md) traz os pedidos do Claude e das
// tarefas: { versao, itens: [{ id único para sempre, em, de ("Claude" | "Tarefa: Lições"…), tipo "tarefa" | "duvida",
// titulo, texto?, ate?, link?: { area, … }, fechado? }] }.
// No app, cada recado novo vira um registro em E().recados[id] (sincroniza; registros com `em`, a junção fica com o mais
// novo): { de, tipo, titulo, texto?, ate?, link?, chegou, feito, fechado?, msg?, em }. A Eva manda UMA mensagem por leva
// (`tipo: "recados"`, `recados: [ids]`, id `eva-rec-<1º id>`), com o checklist na bolha (telaEva.js). Tarefa: "Feito";
// dúvida: a resposta vai pelo chat com o Claude, e ele marca "Respondi". Fechado pelo Claude (tools/recados.py fechar):
// sai dos abertos. Os que chegam antes de a Eva começar não viram mensagem (`msg: "antes"`). NADA disso vai para a API (a mensagem tem `tipo` e `privado`; contexto.js não lê os recados).
// Notificação local id 5050 (`extra.area` "eva") quando chega recado novo; item "recados" no Meu dia.
import { E, salvar } from "../estado.js";

export const ID_NOTIF = 5050;
const TIPOS = new Set(["tarefa", "duvida"]);
const agoraISO = () => new Date().toISOString();
const avisar = () => { try { window.dispatchEvent(new Event("oq-eva")); window.dispatchEvent(new Event("oq-topo")); } catch { /* node */ } };

export function RC() { const e = E(); if (!e.recados || typeof e.recados !== "object") e.recados = {}; return e.recados; }

/** O item do pacote limpo (ou null, se não serve). Puro. */
export function limparItem(it) {
  if (!it || typeof it !== "object" || typeof it.id !== "string" || !it.id.trim() || !String(it.titulo || "").trim()) return null;
  const out = { de: String(it.de || "Claude").slice(0, 60), tipo: TIPOS.has(it.tipo) ? it.tipo : "tarefa", titulo: String(it.titulo).trim().slice(0, 160) };
  if (it.texto) out.texto = String(it.texto).trim().slice(0, 800);
  if (/^\d{4}-\d{2}-\d{2}$/.test(it.ate || "")) out.ate = it.ate;
  if (it.link && typeof it.link === "object" && typeof it.link.area === "string") out.link = { ...it.link };
  if (it.em) out.dia = String(it.em).slice(0, 10);
  return out;
}

/**
 * Junta o pacote ao estado (puro sobre `rc`, o objeto E().recados): os recados novos entram abertos, os que o Claude
 * fechou ficam fechados; o resto (o que ele marcou) fica como está. → { novos: [ids], fechados: [ids] }
 */
export function juntarPacote(rc, pkg, em = agoraISO()) {
  const novos = [], fechados = [];
  for (const it of pkg?.itens || []) {
    const l = limparItem(it); if (!l) continue;
    const id = it.id.trim(), r = rc[id];
    if (!r) {
      if (it.fechado) continue; // fechado antes de chegar: nem aparece
      rc[id] = { ...l, chegou: em, feito: false, em };
      novos.push(id);
    } else if (it.fechado && !r.fechado) {
      rc[id] = { ...r, fechado: true, em };
      fechados.push(id);
    }
  }
  return { novos, fechados };
}

/** Os recados como lista: [{ id, …registro }], os abertos primeiro (o mais antigo no alto), depois os feitos. */
export function lista(rc = RC()) {
  return Object.entries(rc).filter(([, r]) => r && typeof r === "object" && r.titulo).map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => fechadoOuFeito(a) - fechadoOuFeito(b) || (fechadoOuFeito(a) ? (b.em || "").localeCompare(a.em || "") : (a.chegou || "").localeCompare(b.chegou || "") || a.id.localeCompare(b.id)));
}
const fechadoOuFeito = (r) => (r.feito || r.fechado ? 1 : 0);
export const abertos = (rc = RC()) => lista(rc).filter(r => !r.feito && !r.fechado);
export const feitos = (rc = RC()) => lista(rc).filter(r => r.feito || r.fechado);

/** Marca (ou desmarca) um recado. */
export function marcar(id, feito = true) {
  const r = RC()[id]; if (!r) return false;
  RC()[id] = { ...r, feito: !!feito, ...(feito ? { feitoEm: agoraISO() } : { feitoEm: null }), em: agoraISO() };
  salvar(); avisar();
  return true;
}

/** O texto da mensagem da Eva para uma leva. Puro. */
export function textoDaLeva(itens) {
  const n = itens.length, duv = itens.filter(i => i.tipo === "duvida").length, doClaude = itens.every(i => /^claude$/i.test(i.de || ""));
  const quem = doClaude ? "do Claude" : "do Claude e das tarefas da madrugada";
  const cab = n === 1 ? `Recado ${quem} pra você:` : `Chegaram ${n} recados ${quem}:`;
  const fim = duv ? (n === duv ? " A resposta vai pelo chat com o Claude, não por aqui; depois marque “Respondi”." : " As dúvidas você responde no chat com o Claude; aqui é só marcar.") : " Quando fizer, marque aqui.";
  return `${cab}${fim}`;
}

/**
 * Põe na conversa da Eva os recados abertos que ainda não foram para nenhuma mensagem (uma mensagem por leva). Só depois
 * que a Eva começou. `adicionar` = eva.js adicionar (passado para este arquivo não depender do eva.js). → a mensagem ou null
 */
export function entregar(adicionar, { desde = E().eva?.desde } = {}) {
  if (!desde) return null;
  const rc = RC(), pend = abertos(rc).filter(r => !r.msg);
  if (!pend.length) return null;
  const id = `eva-rec-${pend[0].id}`, ids = pend.map(r => r.id), em = agoraISO();
  for (const r of pend) rc[r.id] = { ...rc[r.id], msg: id, em };
  const m = adicionar({ id, de: "eva", tipo: "recados", privado: true, recados: ids, humor: "normal", texto: textoDaLeva(pend) }, { salvarJa: false });
  salvar(); avisar();
  return m;
}

/** Aplica o pacote (pacotes.js). Avisa por notificação quando chegou recado novo. */
export function aplicarPacoteRecados(pkg) {
  const { novos, fechados } = juntarPacote(RC(), pkg);
  if (!novos.length && !fechados.length) return;
  // antes de a Eva começar (aparelho novo, 1ª abertura): sem mensagem; ficam no chip "Recados", na lista e no Meu dia
  if (!E().eva?.desde) for (const id of novos) RC()[id].msg = "antes";
  salvar(); avisar();
  if (novos.length) {
    import("./eva.js").then(EV => { entregar(EV.adicionar); }).catch(() => {});
    const ts = novos.map(id => RC()[id].titulo);
    import("../notificacoes.js").then(N => N.avisarAgora({ id: ID_NOTIF, title: ts.length > 1 ? `${ts.length} recados do Claude` : "Recado do Claude",
      body: ts.slice(0, 3).join(" · ") + (ts.length > 3 ? " …" : ""), extra: { area: "eva" } })).catch(() => {});
  }
}

/** O item do Meu dia: enquanto houver recado aberto. */
export function itemMeuDia() {
  const a = abertos(); if (!a.length) return null;
  return { id: "recados", icone: "📌", titulo: a.length > 1 ? `${a.length} recados do Claude` : "Um recado do Claude", detalhe: a[0].titulo,
    feito: false, ir: { area: "eva", conversa: "eva" } };
}

export const _teste = { avisar };
