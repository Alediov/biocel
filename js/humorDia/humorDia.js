// Humor do dia: os registros (pedido do Alediov, 04/11/2026). Vários por dia; cada um com id próprio e `em` (ISO), em
// E().humorDia.regs, para a sincronia juntar celular e tablet pela regra de sempre (juntar.js: o registro mudado nos
// dois fica com o mais novo; os ids se unem). Apagar deixa uma marca (`apagado`, com `em` novo) por 180 dias, para o
// outro aparelho não trazer o registro de volta.
// Privacidade: é dado pessoal dele. Fica no aparelho e no estado sincronizado do repositório PRIVADO, como o resto do
// progresso; nada daqui vai para API nenhuma (a Eva só pergunta e mostra o quadro: humorDia/quadro.js).
//
// Registro: { h (id do humor), et ([etiquetas]), tx (texto curto), ms (quando, número: não pode ser string, senão a
// junção acharia que é a data do registro), dia (AAAA-MM-DD), em (ISO da última mudança), msg? (a pergunta da Eva que
// ele respondeu: o id da mensagem no chat), apagado? }
import { E, salvar, hojeISO } from "../estado.js";
import { humor, diaDe, limparEtiqueta, limparTexto, MAX_ETIQUETAS, resumoDoDia } from "./humores.js";

export * from "./humores.js";
const MARCA_DIAS = 180;

function H() { return (E().humorDia ||= { regs: {} }); }
const novoId = () => `hd${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const avisar = () => { try { window.dispatchEvent(new Event("oq-humor")); } catch { /* fora do navegador */ } };

/** Registra como ele está. `id`: um dos HUMORES; `quando`: ms (padrão agora). Devolve o registro (com `rid`). */
export function registrarHumor({ id, etiquetas = [], texto = "", quando = Date.now(), msg = null } = {}) {
  if (!humor(id)) throw new Error(`humor desconhecido: ${id}`);
  const ms = typeof quando === "number" ? quando : Date.parse(quando) || Date.now();
  const et = [...new Set((etiquetas || []).map(limparEtiqueta).filter(Boolean))].slice(0, MAX_ETIQUETAS);
  const reg = { h: id, et, tx: limparTexto(texto), ms, dia: diaDe(ms), em: new Date().toISOString(), ...(msg ? { msg: String(msg) } : {}) };
  const rid = novoId();
  H().regs[rid] = reg;
  limparMarcas();
  salvar(); avisar();
  return { rid, ...reg };
}
/** Muda etiquetas ou texto de um registro (o emoji também, se vier `id`). */
export function editarHumor(rid, { id, etiquetas, texto } = {}) {
  const r = H().regs[rid]; if (!r || r.apagado) return null;
  if (id && humor(id)) r.h = id;
  if (etiquetas) r.et = [...new Set(etiquetas.map(limparEtiqueta).filter(Boolean))].slice(0, MAX_ETIQUETAS);
  if (texto !== undefined) r.tx = limparTexto(texto);
  r.em = new Date().toISOString();
  salvar(); avisar();
  return { rid, ...r };
}
export function apagarHumor(rid) {
  const r = H().regs[rid]; if (!r) return;
  H().regs[rid] = { apagado: true, dia: r.dia, ms: r.ms, em: new Date().toISOString() };
  salvar(); avisar();
}
function limparMarcas() {
  const lim = Date.now() - MARCA_DIAS * 86400000, regs = H().regs;
  for (const [k, r] of Object.entries(regs)) if (r.apagado && Date.parse(r.em) < lim) delete regs[k];
}

/** Todos os registros válidos, do mais antigo ao mais novo: [{ rid, h, et, tx, ms, dia, em }]. */
export function todos() {
  return Object.entries(H().regs).filter(([, r]) => !r.apagado && humor(r.h)).map(([rid, r]) => ({ rid, ...r })).sort((a, b) => a.ms - b.ms);
}
/** Os registros de um dia (AAAA-MM-DD), em ordem; [] se não houver. */
export function humorDe(data = hojeISO()) { return todos().filter(r => r.dia === data); }
/** O resumo do dia (quadrante que mais apareceu, o último emoji, etiquetas) ou null. */
export function resumoDe(data = hojeISO()) { return resumoDoDia(humorDe(data)); }
/** Registros entre duas datas (AAAA-MM-DD ou ms), inclusive. */
export function registrosEntre(a, b) {
  const da = typeof a === "number" ? diaDe(a) : a, db = typeof b === "number" ? diaDe(b) : b;
  return todos().filter(r => r.dia >= da && r.dia <= db);
}
export const jaRespondeuHoje = () => humorDe(hojeISO()).length > 0;
/** O registro que respondeu a uma pergunta da Eva (o id da mensagem), ou null. */
export const respostaDe = (msg) => todos().find(r => r.msg === msg) || null;
/** As etiquetas já usadas, das mais frequentes (nos últimos 60 dias) às menos. */
export function etiquetasUsadas(dias = 60) {
  const lim = Date.now() - dias * 86400000, c = new Map();
  for (const r of todos()) if (r.ms >= lim) for (const e of r.et || []) c.set(e, (c.get(e) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).map(([e]) => e);
}
