// A Eva (pedido do Alediov, 04/11/2026; docs/plano-eva.md): o estado, a conversa e as respostas rápidas.
// Estado em E().eva (sincroniza entre o celular e o tablet; juntar.js):
//   msgs { id: { id, de "eva" | "eu", texto, humor?, acoes?, item?, prog?, aviso?, em } }  as ~500 mais novas; cada
//     registro tem `em`, então a junção fica com o mais novo de cada id e une os ids dos dois aparelhos
//   dias { data: { f, t, lic, cumpridas, semMotivo, naoDa, em } }  o dia para a escala de humor (humor.js)
//   cobrancas { "data|item": { n, motivo?, feito?, em } }  quantas vezes ela cobrou o item no dia (até 3)
//   promessas { id: { id, item, titulo, ate (ms), estado aberta | cumprida | vencida, em } }  os "Daqui a pouco"
//   gasto { "AAAA-MM": { micro, n, in, out, cr, cw } }  inteiros: a junção soma o que cada aparelho gastou
//   ajustes { ia, modelo, teto, aleatorias, mensagens, variar, humor, musica, em }, desde (1º dia), limpouEm (ISO)
//   musicas { "AAAA-MM-DD": { id, titulo, artista, porque, troca, antes?, em } }  a música do dia (musicaDia.js)
//   meses { "AAAA-MM": { …números do mês, em } }  o resumo do mês (resumoMes.js), para redesenhar a imagem
// A chave da API nunca entra aqui (api.js).
// A IA é OPCIONAL e vem DESLIGADA (pedido do Alediov, 05/11/2026: "eu gosto bastante de como está agora sem API"):
// com `ajustes.ia` falso ela responde com as falas prontas (respostaLocal), mesmo com a chave guardada.
// As respostas prontas aparecem depois do "digitando…" (telaEva.js, atrasoDigitando em falas.js); cada fala guarda o
// `modelo` (a chave do texto) para não repetir o mesmo nos dias seguintes.
// O humor do dia (humorDia/, pedido do Alediov, 04/11/2026): a pergunta é uma mensagem dela com `tipo: "humor"` (a da
// noite vem das programadas; o chip "Como estou" põe outra a qualquer hora), o quadro aparece na bolha (telaEva.js) e a
// escolha vai para E().humorDia com `msg` = o id da pergunta. A resposta dela é uma fala pronta pelo CANTO do quadro
// (`privado: true`). Nem a pergunta, nem a resposta, nem o humor dele vão para a API (api.js montarMensagens pula
// `tipo: "humor"` e `privado`; contexto.js não lê o humorDia).
import { E, salvar, hojeISO, somaDias } from "../estado.js";
import * as H from "./humor.js";
import * as API from "./api.js";
import * as IL from "./ialocal.js";
import { fala, rng, sobre, sortear, classificar, ANGUSTIA, CANSACO, QUE_FALTA } from "./falas.js";
import * as HD from "../humorDia/humorDia.js";
import { PERGUNTA_HUMOR } from "./programadas.js";
import * as RE from "./recados.js";

export const MAX_MSGS = 500;
const agoraISO = () => new Date().toISOString();
const avisar = () => window.dispatchEvent(new Event("oq-eva"));

export function EV() {
  const e = E(), v = (e.eva ||= {});
  v.msgs ||= {}; v.dias ||= {}; v.cobrancas ||= {}; v.promessas ||= {}; v.gasto ||= {}; v.musicas ||= {}; v.meses ||= {};
  return v;
}
export const ajustes = () => ({ ia: false, fonte: "claude", modeloLocal: IL.PADRAO, modelo: "haiku", teto: API.TETO_PADRAO, aleatorias: true, mensagens: true, variar: true, humor: true, musica: true, ...(EV().ajustes || {}) });
/** Responder com a IA? (desligado por padrão; quem nunca mexeu fica sem a IA, mesmo com a chave) */
export const comIA = () => ajustes().ia === true;
export function definirAjuste(k, valor) { EV().ajustes = { ...ajustes(), [k]: valor, em: agoraISO() }; salvarEva(); }
export function salvarEva() { salvar(); avisar(); }
export const nomeDele = () => (E().avatar?.nome || "").trim().split(/\s+/)[0] || "Alediov";
const mes = () => hojeISO().slice(0, 7);

// ---------------------------------------------------------------- mensagens
const novoId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const mensagens = () => Object.values(EV().msgs).sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
export function adicionar(m, { salvarJa = true } = {}) {
  const v = EV(), id = m.id || novoId();
  v.msgs[id] = { ...m, id, em: m.em || agoraISO() };
  const ids = Object.keys(v.msgs);
  if (ids.length > MAX_MSGS) for (const x of mensagens().slice(0, ids.length - MAX_MSGS)) delete v.msgs[x.id];
  if (salvarJa) salvarEva();
  return v.msgs[id];
}
export function limparConversa() { const v = EV(); v.msgs = {}; v.limpouEm = agoraISO(); salvarEva(); }

/** Começa a Eva na 1ª vez que ele abre (antes disso, nada de mensagens programadas). */
export function comecar() {
  const v = EV();
  if (v.desde) return false;
  v.desde = hojeISO();
  adicionar({ de: "eva", humor: "acenando", texto: `Oi, ${nomeDele()}! Eu sou a Eva. Vou te acompanhar na rotina e nos estudos: lembro do que falta no Meu dia, comemoro o que você fizer e cobro com carinho. Pode falar comigo por aqui ou pelos botões aqui embaixo.` });
  return true;
}

// ---------------------------------------------------------------- cobranças, motivos e combinados
export function cobrancasDe(data) {
  const out = {};
  for (const [k, c] of Object.entries(EV().cobrancas)) { const [d, item] = [k.slice(0, 10), k.slice(11)]; if (d === data) out[item] = c; }
  return out;
}
function cobranca(data, item) { return (EV().cobrancas[`${data}|${item}`] ||= { n: 0 }); }
export function contarCobranca(data, item, n) { const c = cobranca(data, item); c.n = Math.max(c.n || 0, n); c.em = agoraISO(); }
export function registrarMotivo(item, motivo, data = hojeISO()) { const c = cobranca(data, item); c.motivo = String(motivo).slice(0, 120); c.em = agoraISO(); limpar(); salvarEva(); }
export function marcarFeito(item, data = hojeISO()) {
  const c = cobranca(data, item); c.feito = true; c.em = agoraISO();
  for (const p of Object.values(EV().promessas)) if (p.item === item && p.estado === "aberta") { p.estado = "cumprida"; p.em = agoraISO(); }
  limpar(); salvarEva();
}
/** "Daqui a pouco": combina um horário para o item; vira uma mensagem programada (programadas.js). */
export function combinar(item, titulo, ate) {
  const id = `p-${Date.now().toString(36)}`;
  for (const p of Object.values(EV().promessas)) if (p.item === item && p.estado === "aberta") { p.estado = "trocada"; p.em = agoraISO(); }
  EV().promessas[id] = { id, item, titulo, ate, estado: "aberta", em: agoraISO() };
  limpar(); salvarEva(); reagendarLogo();
  return EV().promessas[id];
}
export function combinadosDe(data) {
  return Object.values(EV().promessas).filter(p => p.estado === "aberta" && hojeISO(new Date(p.ate)) === data)
    .map(p => ({ id: p.id, item: { id: p.item, titulo: p.titulo }, ate: p.ate }));
}
function limpar() {
  const v = EV(), corte = somaDias(hojeISO(), -14), corteDias = somaDias(hojeISO(), -60);
  for (const k of Object.keys(v.cobrancas)) if (k.slice(0, 10) < corte) delete v.cobrancas[k];
  for (const [k, p] of Object.entries(v.promessas)) if (hojeISO(new Date(p.ate)) < corte) delete v.promessas[k];
  for (const k of Object.keys(v.dias)) if (k < corteDias) delete v.dias[k];
}

// ---------------------------------------------------------------- humor
/** O dia de hoje para a escala de humor, pelo Meu dia (só grava se mudou). */
export function anotarDia(itens, data = hojeISO()) {
  const v = EV(), cont = (itens || []).filter(i => i.feito !== null && i.feito !== undefined && !i.bonus && !/^scan/.test(i.id || ""));
  const cobr = cobrancasDe(data), pend = new Set(cont.filter(i => !i.feito).map(i => i.id));
  const r = {
    f: cont.filter(i => i.feito).length, t: cont.length, lic: E().diario?.[data]?.licoes?.length || 0,
    cumpridas: Object.values(v.promessas).filter(p => p.estado === "cumprida" && hojeISO(new Date(p.ate)) === data).length,
    semMotivo: Object.entries(cobr).filter(([it, c]) => (c.n || 0) >= 3 && !c.motivo && !c.feito && pend.has(it)).length,
    naoDa: Object.values(cobr).some(c => c.motivo),
  };
  const a = v.dias[data];
  if (a && ["f", "t", "lic", "cumpridas", "semMotivo", "naoDa"].every(k => a[k] === r[k])) return false;
  v.dias[data] = { ...r, em: agoraISO() };
  return true;
}
export function humorAtual() {
  const v = EV();
  return H.calcularHumor(v.dias, hojeISO(), { desde: v.desde || hojeISO(), diario: E().diario || {} });
}

// ---------------------------------------------------------------- API e teto
export const gastoDoMes = () => EV().gasto[mes()] || { micro: 0, n: 0 };
export const modeloId = () => (API.MODELOS[ajustes().modelo] || API.MODELOS.haiku).id;
/** Pode conversar pela API agora? → { ok, motivo: "desligada" | "teto" | "sem-chave" | "offline" } */
export async function situacaoApi() {
  if (!comIA()) return { ok: false, motivo: "desligada" };
  if (IL.ehLocal(ajustes())) return IL.situacaoConversa(ajustes()); // a IA do celular (ialocal.js): sem chave, teto nem internet
  if (!API.dentroDoTeto(EV().gasto, mes(), ajustes().teto)) return { ok: false, motivo: "teto" };
  if (!(await API.temChave())) return { ok: false, motivo: "sem-chave" };
  if (!API.falso() && !navigator.onLine) return { ok: false, motivo: "offline" };
  return { ok: true };
}
function anotarGasto(usage, modelo) { API.somarGasto(EV().gasto, mes(), usage, modelo); }

// ---------------------------------------------------------------- o que ela sabe do dia
let cache = { itens: [], em: 0, dados: null };
export const itensCache = () => cache.itens;
export async function atualizarDia(forcar = false) {
  if (!forcar && Date.now() - cache.em < 20000) return cache;
  const CT = await import("./contexto.js");
  const { dados, itens } = await CT.coletar();
  cache = { itens, dados, em: Date.now(), pend: CT.pendentes(itens) };
  return cache;
}
export const pendentesCache = () => (cache.pend || []).filter(i => { const c = cobrancasDe(hojeISO())[i.id]; return !c?.motivo && !c?.feito; });
/** O item da conversa agora: o da última mensagem dela, se ainda falta; senão o primeiro que falta. */
export function itemEmFoco() {
  const pend = pendentesCache(), ult = mensagens().filter(m => m.de === "eva" && m.item).at(-1);
  return pend.find(i => i.id === ult?.item) || pend[0] || null;
}

// ---------------------------------------------------------------- respostas rápidas
let espera = null; // { tipo: "quando" | "motivo" | "motivoTexto", item }
export const esperando = () => espera;
const nivel = () => humorAtual().nivel;
const r = () => rng(`${Date.now()}|${Math.random()}`);
/** Os modelos de fala usados há pouco (as últimas 40 mensagens dela), para não repetir. */
export const modelosRecentes = (n = 40) => new Set(mensagens().filter(m => m.de === "eva" && m.modelo).slice(-n).map(m => m.modelo));
function dela(tipo, v = {}, extra = {}) {
  const f = fala(tipo, { nome: nomeDele(), ...v }, r(), nivel(), { evitar: modelosRecentes() });
  return adicionar({ de: "eva", texto: f.texto, humor: f.humor, modelo: f.modelo, ...extra });
}
const listaFalta = () => pendentesCache().slice(0, 4).map(i => sobre(i).nome).join(", ").replace(/, ([^,]*)$/, " e $1");

/** As respostas rápidas de agora: [{ id, rotulo, forte? }]. */
export function chipsAgora() {
  if (espera?.tipo === "quando") return [["q30", "Em 30 min"], ["q60", "Em 1 hora"], ["q120", "Em 2 horas"], ["qnoite", "À noite"], ["cancelar", "Deixa"]].map(([id, rotulo]) => ({ id, rotulo }));
  if (espera?.tipo === "motivo" || espera?.tipo === "motivoTexto") return [["corrido", "Dia corrido"], ["prova", "Prova chegando"], ["doente", "Não estou bem"], ["cansado", "Cansado"], ["outro", "Outro motivo"]].map(([id, rotulo]) => ({ id, rotulo }));
  const f = itemEmFoco(), ult = mensagens().at(-1), l = [];
  if (f) l.push({ id: "fiz", rotulo: "Já fiz" }, { id: "depois", rotulo: "Daqui a pouco" }, { id: "naoda", rotulo: "Hoje não dá", forte: ult?.de === "eva" && ult?.item === f.id && /motivo/.test(ult.texto) });
  l.push({ id: "falta", rotulo: "O que falta?" });
  if (!humorEmAberto()) l.push({ id: "humor", rotulo: "Como estou" });
  if (chipMusica()) l.push({ id: "musica", rotulo: "Música do dia" });
  const nr = RE.abertos().length; // os recados do Claude (recados.js): a lista abre numa folha (telaEva.js)
  if (nr) l.push({ id: "recados", rotulo: `Recados (${nr})` });
  if (f?.ir) l.push({ id: "abrir", rotulo: `Abrir ${curto(sobre(f).nome)}` });
  return l;
}
const curto = (s) => (s.length > 26 ? `${s.slice(0, 24)}…` : s);
const MOTIVOS = { corrido: "dia corrido", prova: "prova chegando", doente: "não está bem", cansado: "cansaço" };

/** Toca numa resposta rápida. `ir(ir)` leva a um item (areas.js irParaItem). Devolve a mensagem dela (ou null). */
export async function rapida(id, { ir } = {}) {
  await atualizarDia();
  const f = espera?.item || itemEmFoco(), rot = chipsAgora().find(c => c.id === id)?.rotulo || "";
  if (id === "abrir") { if (f?.ir && ir) ir(f.ir); return null; }
  if (id === "recados") return null; // a folha dos recados (telaEva.js)
  if (id === "humor") { espera = null; return perguntarHumor(); }
  if (id === "musica") { espera = null; adicionar({ de: "eu", texto: rot || "Música do dia" }, { salvarJa: false }); return musicaDoDia({ pedida: true }); }
  if (rot && id !== "outro") adicionar({ de: "eu", texto: rot }, { salvarJa: false });
  if (id === "falta") { espera = null; return pendentesCache().length ? dela("falta", { lista: listaFalta() }) : dela("nadaFalta"); }
  if (id === "fiz") return jaFez(f);
  if (id === "depois") { espera = { tipo: "quando", item: f }; return dela("quando", {}, { item: f?.id }); }
  if (id === "naoda") { espera = { tipo: "motivo", item: f }; return dela("motivo", {}, { item: f?.id }); }
  if (id === "cancelar") { espera = null; return dela("checkin", { feitos: cache.dados ? contados().f : 0, total: contados().t }); }
  if (id.startsWith("q")) {
    const ag = Date.now(), d = new Date();
    let ate = id === "qnoite" ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0).getTime() : ag + Number(id.slice(1)) * 60000;
    if (ate <= ag + 15 * 60000) ate = ag + 60 * 60000;
    espera = null;
    if (!f) return dela("checkin", contadosV());
    combinar(f.id, f.titulo, ate);
    const hd = new Date(ate);
    return dela("daquiAPouco", { item: sobre(f).nome, hora: `${hd.getHours()}h${hd.getMinutes() ? String(hd.getMinutes()).padStart(2, "0") : ""}` }, { item: f.id });
  }
  if (id === "outro") { espera = { tipo: "motivoTexto", item: f }; return null; }
  if (MOTIVOS[id]) {
    espera = null;
    if (!f) return dela("checkin", contadosV());
    registrarMotivo(f.id, MOTIVOS[id]);
    const tipo = { doente: "motivoCuidado", corrido: "motivoCorrido", prova: "motivoProva", cansado: "motivoCansado" }[id] || "motivoOk";
    return dela(tipo, { item: sobre(f).nome, motivo: MOTIVOS[id] }, { item: f.id });
  }
  return null;
}
const contados = () => { const c = (cache.itens || []).filter(i => i.feito !== null && !i.bonus && !/^scan/.test(i.id || "")); return { f: c.filter(i => i.feito).length, t: c.length }; };
const contadosV = () => { const c = contados(); return { feitos: c.f, total: c.t }; };
function jaFez(f) {
  espera = null;
  if (!f) return dela("nadaFalta");
  const aindaFalta = (cache.pend || []).some(i => i.id === f.id);
  marcarFeito(f.id);
  if (aindaFalta && /^(licoes|meta|leitura|xadrez|jardim|simulado|correcao)/.test(f.id)) return dela("jaFezAinda", { item: sobre(f).nome });
  return pendentesCache().length ? dela("jaFez", { item: sobre(f).nome }) : dela("jaFezTudo");
}

// ---------------------------------------------------------------- humor do dia (humorDia/)
const ehHoje = (m) => hojeISO(new Date(m.em)) === hojeISO();
/** A pergunta de hoje que ainda espera a escolha (se houver). */
export const humorEmAberto = () => mensagens().find(m => m.tipo === "humor" && ehHoje(m) && !HD.respostaDe(m.id)) || null;
/** Põe a pergunta com o quadro no chat (o chip "Como estou"; dá para registrar mais de uma vez por dia). */
export function perguntarHumor() {
  return humorEmAberto() || adicionar({ de: "eva", tipo: "humor", texto: PERGUNTA_HUMOR, humor: "normal" });
}
const QUADRANTE_FALA = { "alta-desagradavel": "humorTenso", "alta-agradavel": "humorAnimado", "baixa-desagradavel": "humorBaixo", "baixa-agradavel": "humorPaz" };
/**
 * Ele escolheu o emoji na pergunta `msgId` (o registro já está em E().humorDia): a resposta dela, uma vez por pergunta
 * (id `<pergunta>-r`, o mesmo nos dois aparelhos). Por canto, sem nota; com angústia no texto ou nas etiquetas, ou o
 * canto de baixo e desagradável num dia em que ele disse "Não estou bem", vem também a fala de cuidado com o CVV 188.
 */
export function responderHumor(msgId, reg) {
  const v = EV(), id = `${msgId}-r`;
  if (v.msgs[id] || !reg?.h) return v.msgs[id] || null;
  const h = HD.humor(reg.h); if (!h) return null;
  const tipo = QUADRANTE_FALA[h.quadrante], f = itemEmFoco();
  const menor = tipo === "humorTenso" && f ? ` Se ajudar, hoje vale só ${sobre(f).menor}.` : "";
  const fl = fala(tipo, { nome: nomeDele(), menor }, rng(`${msgId}|${reg.h}`), nivel());
  const em = new Date(Math.max(Date.now(), (reg.ms || 0) + 1000)).toISOString();
  const m = adicionar({ id, de: "eva", texto: fl.texto, humor: fl.humor, privado: true, respHumor: msgId, em }, { salvarJa: false });
  const naoBem = Object.values(cobrancasDe(hojeISO())).some(c => /n[aã]o est[aá] bem/.test(c.motivo || ""));
  const texto = `${reg.tx || ""} ${(reg.et || []).join(" ")}`;
  if (ANGUSTIA.test(texto) || (h.quadrante === "baixa-desagradavel" && naoBem)) {
    const c = fala("cuidado", { nome: nomeDele() }, rng(id), nivel());
    adicionar({ id: `${msgId}-c`, de: "eva", texto: c.texto, humor: c.humor, privado: true, em: new Date(Date.parse(em) + 1000).toISOString() }, { salvarJa: false });
  }
  salvarEva();
  return m;
}

// ---------------------------------------------------------------- conversa
/** Resposta sem a API (a IA desligada, sem chave, sem internet ou passado o teto). Devolve a mensagem dela (ou a
 *  promessa dela, na música do dia). */
export function respostaLocal(texto) {
  const f = itemEmFoco(), s = String(texto || "");
  if (ANGUSTIA.test(s)) { espera = null; return dela("cuidado"); } // antes de tudo, até de um motivo
  if (espera?.tipo === "motivoTexto") {
    const item = espera.item || f; espera = null;
    if (item) { registrarMotivo(item.id, s); return dela("motivoOk", { item: sobre(item).nome, motivo: s.slice(0, 60) }, { item: item.id }); }
  }
  if (/\bj[aá] (fiz|terminei|acabei)|\bfeito\b|\bterminei\b|\bacabei\b/i.test(s) && f) return jaFez(f);
  if (/(n[aã]o (d[aá]|vai dar|vou conseguir|consigo hoje))/i.test(s) && f) { espera = { tipo: "motivo", item: f }; return dela("motivo", {}, { item: f.id }); }
  if (/(daqui a pouco|mais tarde|depois eu|j[aá] j[aá]|daqui a? ?(um|uma|1) (hora|pouco))/i.test(s) && f) { espera = { tipo: "quando", item: f }; return dela("quando", {}, { item: f.id }); }
  if (QUE_FALTA.test(s)) return pendentesCache().length ? dela("falta", { lista: listaFalta() }) : dela("nadaFalta");
  if (CANSACO.test(s)) return dela("cansado", { menor: f ? sobre(f).menor : "nada além de descansar" }, f ? { item: f.id } : {});
  const resto = pendentesCache().length ? `Ainda tem ${listaFalta()} hoje.` : "Hoje tá tudo feito.";
  const tipo = classificar(s);
  if (tipo === "musica") return musicaDoDia({ pedida: true });
  if (tipo === "provaInfo") {
    const p = (cache.dados?.provas || [])[0];
    return p ? dela("provaInfo", { prova: p.titulo && p.nome ? `${p.titulo} de ${p.nome}` : p.nome || p.titulo, quando: p.dias === 0 ? "hoje" : p.dias === 1 ? "amanhã" : `em ${p.dias} dias` }) : dela("provaNenhuma");
  }
  if (tipo === "agendaHoje") {
    const ag = (cache.dados?.agenda?.hoje || []).map(a => `${a.nome}${a.inicio ? ` às ${a.inicio}` : ""}`);
    return ag.length ? dela("agendaHoje", { lista: ag.slice(0, 4).join(", ").replace(/, ([^,]*)$/, " e $1") }) : dela("agendaVazia");
  }
  if (tipo === "oi" || tipo === "bomDiaResp" || tipo === "boaTardeResp") {
    const o = fala(tipo, { nome: nomeDele() }, r(), nivel(), { evitar: modelosRecentes() });
    return adicionar({ de: "eva", texto: `${o.texto} ${resto}`, humor: o.humor, modelo: o.modelo });
  }
  if (tipo === "sono") return dela(f && new Date().getHours() < 20 ? "cansado" : "sono", { menor: f ? sobre(f).menor : "nada além de descansar" });
  if (tipo) return dela(tipo, { resto });
  return dela("generico", { resto });
}

/** Ele mandou uma mensagem: pela API, se der; senão a resposta local. Devolve a mensagem dela. */
export async function conversar(texto, { aoPensar } = {}) {
  const t = String(texto || "").trim();
  if (!t) return null;
  const antes = mensagens();
  adicionar({ de: "eu", texto: t });
  await atualizarDia();
  // depois do "Hoje não dá", o que ele escrever é o motivo
  if (espera?.tipo === "motivo" || espera?.tipo === "motivoTexto") { espera = { ...espera, tipo: "motivoTexto" }; return respostaLocal(t); }
  espera = null;
  const sit = await situacaoApi();
  if (!sit.ok) return respostaLocal(t);
  if (sit.local && ANGUSTIA.test(t)) return respostaLocal(t); // o modelo do celular nunca responde isso sozinho
  aoPensar?.(true);
  try {
    const CT = await import("./contexto.js");
    const hoje = hojeISO(), hum = humorAtual();
    const combinados = combinadosDe(hoje).map(c => { const d = new Date(c.ate); return { titulo: c.item.titulo, hora: `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}` }; });
    const motivos = Object.entries(cobrancasDe(hoje)).filter(([, c]) => c.motivo).map(([it, c]) => ({ titulo: (cache.itens.find(i => i.id === it)?.titulo) || it, motivo: c.motivo }));
    const contexto = CT.montarContexto({ ...cache.dados, humor: hum, combinados, motivos });
    if (sit.local) {
      const lida = await IL.responder({ contexto, historico: antes, nova: t, ajustes: ajustes() });
      return adicionar({ de: "eva", texto: lida.texto, humor: lida.humor, ia: true, local: true });
    }
    const pedido = API.montarPedido({ modelo: modeloId(), contexto, historico: antes, nova: t });
    const res = await API.chamar(pedido);
    anotarGasto(res.usage, res.modelo || pedido.model);
    const lida = API.lerResposta(res.texto);
    const m = adicionar({ de: "eva", texto: lida.texto, humor: lida.humor, acoes: lida.acoes, ia: true, ...(lida.acoes.find(a => a.tipo !== "agenda") ? { item: lida.acoes.find(a => a.tipo !== "agenda").alvo.split("|")[0] } : {}) });
    // rede de segurança: sofrimento sério sempre recebe o caminho do CVV
    if (ANGUSTIA.test(t) && !/188|cvv/i.test(lida.texto)) dela("cuidado");
    return m;
  } catch (e) {
    const m = await respostaLocal(t);
    m.aviso = sit.local ? (e.codigo === "local-lento" ? "a IA do celular demorou: resposta rápida" : "a IA do celular não respondeu: resposta rápida") : e.codigo === "recusada" ? "a chave foi recusada" : e.codigo === "rede" ? "sem conexão: resposta rápida" : "a IA não respondeu: resposta rápida";
    salvarEva();
    return m;
  } finally { aoPensar?.(false); }
}

/** Um botão de ação numa mensagem dela. */
export async function fazerAcao(a, { ir } = {}) {
  await atualizarDia();
  const achar = (id) => (cache.itens || []).find(i => i.id === id);
  if (a.tipo === "agenda") { ir?.({ area: "learn", tela: "agenda" }); return null; }
  if (a.tipo === "abrir") { const it = achar(a.alvo); if (it?.ir) ir?.(it.ir); return null; }
  if (a.tipo === "feito") { const it = achar(a.alvo) || { id: a.alvo, titulo: a.alvo }; adicionar({ de: "eu", texto: a.rotulo || "Já fiz" }, { salvarJa: false }); return jaFez(it); }
  if (a.tipo === "adiar") {
    const [idItem, hora] = a.alvo.includes("|") ? a.alvo.split("|") : [itemEmFoco()?.id, a.alvo];
    const it = achar(idItem) || itemEmFoco();
    const m = /^(\d{1,2}):?(\d{2})?$/.exec(String(hora || "").trim());
    if (!it || !m) return null;
    const d = new Date(); d.setHours(+m[1], +(m[2] || 0), 0, 0);
    let ate = d.getTime(); if (ate <= Date.now() + 10 * 60000) ate = Date.now() + 60 * 60000;
    adicionar({ de: "eu", texto: a.rotulo || "Depois" }, { salvarJa: false });
    combinar(it.id, it.titulo, ate);
    const hd = new Date(ate);
    return dela("daquiAPouco", { item: sobre(it).nome, hora: `${hd.getHours()}h${hd.getMinutes() ? String(hd.getMinutes()).padStart(2, "0") : ""}` }, { item: it.id });
  }
  return null;
}

// ---------------------------------------------------------------- a música do dia (musicaDia.js)
// A mensagem vem das programadas (à tardinha ou à noite, num horário livre) ou do chip "Música do dia"; o id é
// `eva-<data>-musica` nos dois casos (uma só por dia); "Outra" põe `eva-<data>-musica-2`. O cartão fica em `musica`.
let temMusicas = null; // a biblioteca deste aparelho tem músicas? (lido uma vez por sessão; null = não sei ainda)
export async function conferirBiblioteca() {
  const MD = await import("./musicaDia.js");
  const n = (await MD.faixasDaBiblioteca()).length; MD.anotarBiblioteca(n); temMusicas = n > 0;
  return temMusicas;
}
function chipMusica() {
  if (ajustes().musica === false) return false;
  if (temMusicas === null) { conferirBiblioteca().then(t => { if (t) avisar(); }).catch(() => {}); return false; }
  return temMusicas && !EV().msgs[`eva-${hojeISO()}-musica`];
}
const cartaoMusica = (m, data) => ({ id: m.id, titulo: m.titulo, artista: m.artista, porque: m.porque, data, troca: m.troca || 0 });
/** Põe a música do dia no chat (uma vez por dia; pedida de novo, ela lembra qual é). → a mensagem ou null */
export async function musicaDoDia({ pedida = false } = {}) {
  const MD = await import("./musicaDia.js"), hoje = hojeISO(), id = `eva-${hoje}-musica`;
  const m = await MD.musicaDeHoje({ data: hoje });
  if (!m) { temMusicas = false; return pedida ? dela("musicaSem") : null; }
  temMusicas = true;
  if (EV().msgs[id]) return pedida ? dela("musicaJa", { titulo: m.titulo }) : EV().msgs[id];
  const f = fala("musicaDia", { nome: nomeDele(), titulo: m.titulo, artista: m.artista, porque: m.porque }, rng(id), nivel(), { evitar: modelosRecentes() });
  return adicionar({ id, de: "eva", tipo: "musica", texto: f.texto, humor: f.humor, modelo: f.modelo, musica: cartaoMusica(m, hoje) });
}
/** "Outra": troca a de hoje uma vez. → a mensagem nova ou null (já trocou / não é de hoje) */
export async function outraMusica() {
  const MD = await import("./musicaDia.js"), hoje = hojeISO(), atual = EV().musicas?.[hoje];
  if (!atual || (atual.troca || 0) >= 1) return null;
  adicionar({ de: "eu", texto: "Outra" }, { salvarJa: false });
  const m = await MD.musicaDeHoje({ data: hoje, trocar: true });
  if (!m || m.id === atual.id) return dela("musicaJa", { titulo: atual.titulo });
  const id = `eva-${hoje}-musica-2`;
  const f = fala("musicaOutra", { nome: nomeDele(), titulo: m.titulo, artista: m.artista, porque: m.porque }, rng(id), nivel());
  return adicionar({ id, de: "eva", tipo: "musica", texto: f.texto, humor: f.humor, modelo: f.modelo, musica: cartaoMusica(m, hoje) });
}
/** Ainda dá para pedir outra na mensagem `msg`? (só a última de hoje, uma troca por dia) */
export function podeTrocarMusica(msg) {
  const hoje = hojeISO(), reg = EV().musicas?.[hoje];
  return !!(msg?.musica && msg.musica.data === hoje && reg && (reg.troca || 0) < 1 && reg.id === msg.musica.id);
}

// ---------------------------------------------------------------- o resumo do mês e a retrospectiva
// Na 1ª abertura de um mês novo (neste aparelho; as mensagens têm id fixo, então não duplicam entre aparelhos), ela
// calcula o mês que passou (resumoMes.js), guarda os números em E().eva.meses e manda a imagem no chat. Os meses
// anteriores a ela (com dados nos Estudos) entram calados, uma vez, para os "Meus meses" e a retrospectiva.
const CHAVE_MES = "orbita.eva.mesVisto", CHAVE_PASSADO = "orbita.eva.mesesPassados";
const lerLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
export const meses = () => Object.keys(EV().meses || {}).sort();
export async function guardarMes(mes) {
  const RM = await import("./resumoMes.js");
  const r = await RM.montarMes(mes);
  if (!RM.temDados(r)) return null;
  EV().meses[mes] = { ...r, em: agoraISO() };
  return EV().meses[mes];
}
/** O que fazer na virada do mês. `agora` para testar. → número de mensagens novas */
export async function verificarMes(agora = new Date(), { forcar = false } = {}) {
  const v = EV(); if (!v.desde) return 0;
  const RM = await import("./resumoMes.js"), RT = await import("./retroEva.js");
  const mesAt = hojeISO(agora).slice(0, 7), ant = RM.mesAnterior(mesAt);
  if (!forcar && lerLocal(CHAVE_MES) === mesAt) return 0;
  gravarLocal(CHAVE_MES, mesAt);
  v.meses ||= {};
  // os meses de antes, calados (uma vez por aparelho): até 12, só os que tiveram Estudos
  if (!lerLocal(CHAVE_PASSADO)) {
    gravarLocal(CHAVE_PASSADO, "1");
    const comDiario = new Set(Object.keys(E().diario || {}).map(d => d.slice(0, 7)));
    for (let k = 2; k <= 13; k++) { const m = RM.mesAnterior(mesAt, k); if (!v.meses[m] && comDiario.has(m)) await guardarMes(m).catch(() => null); }
  }
  let n = 0;
  const idMes = `eva-mes-${ant}`;
  if (v.desde < `${mesAt}-01` && !v.msgs[idMes]) {
    const r = v.meses[ant] || (await guardarMes(ant));
    if (r) {
      const f = fala("resumoMes", { nome: nomeDele(), mes: RM.nomeMes(ant, { ano: false }) }, rng(idMes), nivel());
      adicionar({ id: idMes, de: "eva", tipo: "mes", mes: ant, texto: f.texto, humor: f.humor, modelo: f.modelo }, { salvarJa: false });
      n++;
    }
  }
  const rt = RT.retroDaVez(mesAt, meses()), idRt = `eva-retro-${mesAt}`;
  if (rt && !v.msgs[idRt]) {
    const f = fala("retroOferta", { nome: nomeDele() }, rng(idRt), nivel());
    adicionar({ id: idRt, de: "eva", tipo: "retro", retro: rt, texto: f.texto, humor: f.humor, modelo: f.modelo, em: new Date(Date.now() + 1000).toISOString() }, { salvarJa: false });
    n++;
  }
  salvarEva();
  return n;
}

// ---------------------------------------------------------------- variar o texto das programadas (Haiku)
const CHAVE_REESCREVEU = "orbita.eva.reescreveuEm";
export async function reescreverProximas(agora = Date.now()) {
  if (!comIA() || !ajustes().variar) return 0;
  try { if (agora - Number(localStorage.getItem(CHAVE_REESCREVEU) || 0) < 3 * 3600e3) return 0; } catch { /* sem armazenamento */ }
  const sit = await situacaoApi(); if (!sit.ok) return 0;
  const P = await import("./programadas.js");
  const alvo = P.planoGuardado().filter(p => p.quando > agora + 10 * 60000 && p.quando < agora + 36 * 3600e3 && !p.base && !p.tipo).slice(0, 6);
  if (!alvo.length) return 0;
  try { localStorage.setItem(CHAVE_REESCREVEU, String(agora)); } catch { /* */ }
  if (sit.local) { // pelo modelo do celular, um aviso por vez (ialocal.js)
    const novas = await IL.reescrever(alvo, ajustes(), agora).catch(() => ({}));
    P.guardarReescritas(novas);
    if (Object.keys(novas).length) reagendarLogo();
    return Object.keys(novas).length;
  }
  const pedido = {
    model: API.MODELOS.haiku.id, max_tokens: 700,
    system: [{ type: "text", text: `${API.PERSONALIDADE}\n\nTarefa agora: reescrever avisos curtos que você vai mandar mais tarde por notificação, variando as palavras e mantendo o sentido, o item e o horário. Responda SÓ com um objeto JSON { "<id>": "<texto novo>" }, cada texto com no máximo 200 caracteres.`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(Object.fromEntries(alvo.map(p => [p.id, p.texto]))) }],
  };
  try {
    const res = await API.chamar(pedido);
    anotarGasto(res.usage, pedido.model); salvar();
    const s = res.texto, i = s.indexOf("{"), j = s.lastIndexOf("}");
    const o = i >= 0 && j > i ? JSON.parse(s.slice(i, j + 1)) : {};
    const novas = {};
    for (const p of alvo) if (typeof o[p.id] === "string" && o[p.id].trim().length > 5) novas[p.id] = { base: p.texto, texto: o[p.id].trim().slice(0, 240), em: agora };
    P.guardarReescritas(novas);
    if (Object.keys(novas).length) reagendarLogo();
    return Object.keys(novas).length;
  } catch (e) { console.warn("Eva: reescrever", e.codigo || e.message); return 0; }
}

// ---------------------------------------------------------------- o ciclo no fundo
let ultimoCiclo = 0, assinatura = "";
const reagendarLogo = () => import("../notificacoes.js").then(m => m.reagendar()).catch(() => {});
/** Depois de mudanças no app (main.js, a cada mudança no topo) e ao voltar: anota o dia, entrega as programadas que já
 *  passaram e reagenda quando o que falta mudou. */
export async function aoMudarDia({ forcar = false } = {}) {
  const v = EV();
  if (!v.desde) return;
  if (!forcar && Date.now() - ultimoCiclo < 45000) return;
  ultimoCiclo = Date.now();
  try {
    const c = await atualizarDia(true);
    const hoje = hojeISO();
    // combinados: cumpridos quando o item sai do que falta; vencidos 3 h depois do horário
    let mudou = false;
    for (const p of Object.values(v.promessas)) {
      if (p.estado !== "aberta") continue;
      if (!(c.pend || []).some(i => i.id === p.item) && hojeISO(new Date(p.ate)) === hoje) { p.estado = "cumprida"; p.em = agoraISO(); mudou = true; }
      else if (Date.now() - p.ate > 3 * 3600e3) { p.estado = "vencida"; p.em = agoraISO(); mudou = true; }
    }
    if (anotarDia(c.itens)) mudou = true;
    if (mudou) { limpar(); salvar(); }
    const P = await import("./programadas.js");
    if (await P.entregarVencidas()) mudou = true;
    if (RE.entregar(adicionar)) mudou = true; // recados do Claude que chegaram (recados.js)
    const nova = `${hoje}|${(c.pend || []).map(i => i.id).join(",")}|${humorAtual().nivel}`;
    if (nova !== assinatura) { assinatura = nova; reagendarLogo(); }
    if (await verificarMes().catch(e => { console.warn("Eva: mês", e); return 0; })) mudou = true;
    if (mudou) avisar();
    if (navigator.onLine) reescreverProximas().catch(() => {});
  } catch (e) { console.warn("Eva: ciclo", e); }
}
export function iniciarEva() {
  setTimeout(() => aoMudarDia({ forcar: true }), 9000);
  setInterval(async () => { if (!EV().desde) return; const P = await import("./programadas.js"); if (await P.entregarVencidas()) avisar(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(() => aoMudarDia({ forcar: true }), 4000); });
  // registrou o humor por outro caminho (as Músicas, o chip): a pergunta da noite sai das notificações
  let tHumor = 0;
  window.addEventListener("oq-humor", () => { clearTimeout(tHumor); tHumor = setTimeout(() => { if (EV().desde) reagendarLogo(); }, 3000); });
}
export const _teste = { zerarEspera: () => { espera = null; }, cache: () => cache, sortear, biblioteca: (v) => { temMusicas = v; } };
