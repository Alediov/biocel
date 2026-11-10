// Alarmes do Órbita (pedido do Alediov, 26/10/2026; plano e decisões em docs/plano-alarmes.md): função da Agenda.
// Este arquivo calcula os horários dos próximos 14 dias a partir da Agenda e manda a lista ao Android (AlarmesPlugin),
// que agenda, toca (AlarmeService, com a playlist "Alarme" das Músicas) e mostra a tela do alarme (AlarmeActivity).
// A tela (pedido do Alediov, 05/11/2026): uma das imagens de fundo do app que ele escolheu (`tela.fundos`), a hora e
// o compromisso; deslizar desliga o som e abre as contas, sem som; se não terminar em `tela.repique` minutos (padrão
// 10; 0 = não), o alarme toca de novo.
// Regras (respostas do Alediov):
// - dia de semana (seg. a sex.) com aula ou atividade da Agenda que começa antes do meio-dia: `horaAula` (6h10; ele
//   sai às 6h50). Se o compromisso começa tão cedo que nem dá (antes de horaAula + antecedência), vale o início −
//   antecedência;
// - fim de semana e feriado: só com HUOP ou CEO no dia, no início − antecedência (50 min), com aviso na véspera às 20h
//   para conferir o horário (no HUOP, o do plantonista);
// - dia com HUOP (qualquer dia; pedido do Alediov, 30/10/2026: "quando eu tiver HUOP, coloque o despertador para
//   5h00"): `huop.hora` (5h), ou o início − antecedência se for ainda mais cedo; o aviso da véspera continua;
// - só à tarde, eventos (online ou presenciais) e outros compromissos: sem alarme (ele mesmo lembra);
// - exceções por data: `dias[data] = { hora, em } | { sem: true, em }`; itens que nunca despertam: `ignorar`.
// Sem soneca. XP só pelos acertos das contas depois do deslize (2 por conta), uma vez por data.
// Junção entre aparelhos (juntar.js): números de ajuste ficam dentro de registros com `atualizado`/`em` (fica o mais
// recente inteiro), senão dois aparelhos mudando a antecedência somariam as diferenças.
// Sem DOM no topo do arquivo: roda no node (tools/teste_alarmes.mjs).
import { E, salvar, hojeISO, somaDias, ganhar } from "./estado.js";
import { semThen } from "./semThen.js";
import { A, eventosDoDia, feriado, alterou, diaSemana } from "./agenda.js";

export const DIAS_ALARME = 14;
export const ALARME_PLAYLIST = "alarme"; // id da playlist fixa nas Músicas (biblioteca.js, ALARME)
export const PADRAO_SOM = { fonte: "playlist", crescer: 60, vibrar: true, volume: 100 };
export const PADRAO_CONTAS = { modo: "auto", fixo: 2, quantas: 3 };
/** As imagens que podem aparecer na tela do alarme (os fundos do app, app/fundos/<id>.webp; no APK, em assets/public). */
export const FUNDOS_ALARME = [["marionetes", "Marionetes"], ["trono", "Trono"], ["relogio", "Relógio"], ["porto", "Porto"]];
/** Minutos para tocar de novo se as contas não terminarem depois do deslize (0 = não toca de novo). */
export const OPCOES_REPIQUE = [0, 5, 10, 15];
export const PADRAO_TELA = { fundos: FUNDOS_ALARME.map(([id]) => id), repique: 10 };
export const XP_POR_CONTA = 2;
// os níveis das contas (o gerador de verdade está no AlarmeActivity.java; aqui, o nome e um exemplo para a tela)
export const NIVEIS = [
  null,
  { nome: "Somas e subtrações até 20", ex: "14 + 7" },
  { nome: "Somas e subtrações de 2 dígitos", ex: "58 − 23" },
  { nome: "Tabuada e somas com vai-um", ex: "7 × 8" },
  { nome: "2 dígitos × 1 dígito", ex: "24 × 6" },
  { nome: "3 dígitos e 2 dígitos × 1", ex: "512 − 87" },
  { nome: "Duas operações", ex: "35 + 6 × 7" },
  { nome: "2 dígitos × 2 dígitos", ex: "14 × 17" },
  { nome: "Duas operações com 2 × 2 dígitos", ex: "13 × 16 + 48" },
];

/** As regras (em A().alarmes, sincronizam com a Agenda), com os padrões. */
export function R() {
  const ag = A(), a = (ag.alarmes ??= {});
  a.ligado ??= true;
  a.horaAula ??= "06:10";
  a.dias ??= {};
  a.ignorar ??= [];
  a.resultados ??= {};
  return a;
}
const agoraISO = () => new Date().toISOString();
export const som = () => ({ ...PADRAO_SOM, ...(R().som || {}) });
export const contas = () => ({ ...PADRAO_CONTAS, ...(R().contas || {}) });
/** A tela do alarme: { fundos: ids que podem aparecer (pelo menos um), repique: minutos (0 = não toca de novo) }. */
export function tela() {
  const t = { ...PADRAO_TELA, ...(R().tela || {}) };
  const ok = new Set(FUNDOS_ALARME.map(([id]) => id));
  const fundos = (Array.isArray(t.fundos) ? t.fundos : []).filter(id => ok.has(id));
  return { fundos: fundos.length ? [...new Set(fundos)] : PADRAO_TELA.fundos.slice(), repique: OPCOES_REPIQUE.includes(Number(t.repique)) ? Number(t.repique) : PADRAO_TELA.repique };
}
export const antecedencia = () => R().antecedencia?.min ?? 50;
export const HORA_HUOP = "05:00";
/** A hora do alarme nos dias de HUOP (registro com `atualizado`, para a junção entre aparelhos). */
export const horaHuop = (regras = R()) => (/^\d\d:\d\d$/.test(regras.huop?.hora || "") ? regras.huop.hora : HORA_HUOP);
/** O nível das contas que vale agora (automático: o último que o celular calculou; fixo: o escolhido). */
export const nivelAtual = () => { const c = contas(); return Math.min(8, Math.max(1, c.modo === "fixo" ? c.fixo : R().nivel?.valor || 1)); };

// ---------- horário de cada dia ----------
const minutos = (h) => { const [a, b] = String(h || "00:00").split(":").map(Number); return a * 60 + (b || 0); };
const hhmm = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
/** "06:10" → "6h10", "07:00" → "7h". */
export const horaCurta = (h) => (h ? h.replace(/^0(?=\d)/, "").replace(":00", "h").replace(":", "h") : "");
/** HUOP e CEO são o que desperta no fim de semana e no feriado. */
export const ehHuop = (item) => /\bHUOP\b/.test(`${item?.curto || ""} ${item?.nome || ""}`);
export const ehHuopOuCeo = (item) => /\b(HUOP|CEO)\b/.test(`${item?.curto || ""} ${item?.nome || ""}`);
const nomeDe = (item) => item?.curto || item?.nome || "";
export function emHoraLocal(data, h) { const [a, b] = h.split(":").map(Number); const d = new Date(data + "T00:00:00"); d.setHours(a, b, 0, 0); return d; }

/**
 * O alarme de um dia: { data, hora ("HH:MM" | null), motivo, regra ("aula" | "fds"), item, inicio, manual, sem,
 * confira (avisar na véspera para conferir o horário), fds, feriado }.
 */
export function alarmeDoDia(data, regras = R()) {
  const dow = diaSemana(data), fer = feriado(data), fds = dow === 0 || dow === 6 || !!fer;
  const exc = regras.dias?.[data] || null;
  const base = { data, fds, feriado: fer?.nome || "", hora: null, manual: false, sem: false, confira: false };
  if (regras.ligado === false) return { ...base, motivo: "Alarmes desligados" };
  const ignorar = new Set(regras.ignorar || []);
  const evs = eventosDoDia(data).filter(ev => !ignorar.has(ev.item.id));
  const huop = evs.find(ev => ehHuop(ev.item));
  const regra = huop ? "huop" : fds ? "fds" : "aula";
  const alvo = huop || (fds ? evs.find(ev => ehHuopOuCeo(ev.item)) : evs.find(ev => ev.inicio < "12:00"));
  const motivo = alvo ? `${nomeDe(alvo.item)} ${horaCurta(alvo.inicio)}` : "";
  const extra = alvo ? { item: nomeDe(alvo.item), itemId: alvo.item.id, inicio: alvo.inicio, regra } : { regra };
  if (exc?.sem) return { ...base, ...extra, sem: true, motivo: motivo || "Sem compromisso" };
  if (exc?.hora) return { ...base, ...extra, hora: exc.hora, manual: true, motivo: motivo || "Horário escolhido por você" };
  if (!alvo) {
    const porque = fds ? (fer ? `Feriado: ${fer.nome}` : evs.length ? "Fim de semana, sem HUOP nem CEO" : "Fim de semana") : evs.length ? "Só à tarde" : "Sem aula";
    return { ...base, motivo: porque };
  }
  const cedo = hhmm(Math.max(0, minutos(alvo.inicio) - antecedencia()));
  const fixa = regra === "aula" ? regras.horaAula : regra === "huop" ? horaHuop(regras) : null;
  const hora = fixa && fixa < cedo ? fixa : cedo;
  return { ...base, ...extra, hora, motivo, confira: fds || regra === "huop" };
}

/** Os próximos `n` dias a partir de hoje, cada um com `quando` (ms) e `passou`. */
export function proximosDias(n = DIAS_ALARME, agora = new Date()) {
  const hoje = hojeISO(agora), out = [];
  for (let i = 0; i < n; i++) {
    const d = somaDias(hoje, i), a = alarmeDoDia(d);
    if (a.hora) { a.quando = emHoraLocal(d, a.hora).getTime(); a.passou = a.quando <= agora.getTime(); }
    out.push(a);
  }
  return out;
}
/** O próximo alarme que ainda vai tocar (ou null). */
export const proximoAlarme = (agora = new Date()) => proximosDias(DIAS_ALARME, agora).find(a => a.hora && !a.passou) || null;
/** Texto curto do dia: "hoje", "amanhã" ou "qua., 29/10". */
export function quandoTexto(data, agora = new Date()) {
  const h = hojeISO(agora);
  if (data === h) return "hoje";
  if (data === somaDias(h, 1)) return "amanhã";
  return new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

// ---------- este aparelho ----------
/** Toca neste aparelho? Fica no aparelho (config.alarmeAqui, fora da sincronização): padrão ligado no celular e
 *  desligado no tablet, para os dois não despertarem juntos. */
export function tocaAqui() {
  const v = E().config.alarmeAqui;
  if (typeof v === "boolean") return v;
  try { return Math.min(screen.width, screen.height) < 600; } catch { return true; }
}
export function definirTocaAqui(v) { E().config.alarmeAqui = !!v; salvar(); agendarEnvio(300); }

// ---------- mudanças nas regras ----------
export function ligar(v) { R().ligado = !!v; alterou(); }
export function definirHoraAula(h) { if (/^\d\d:\d\d$/.test(h)) { R().horaAula = h; alterou(); } }
export function definirHoraHuop(h) { if (/^\d\d:\d\d$/.test(h)) { R().huop = { hora: h, atualizado: agoraISO() }; alterou(); } }
export function definirAntecedencia(min) { R().antecedencia = { min: Math.max(0, Math.min(180, Math.round(min))), atualizado: agoraISO() }; alterou(); }
export function definirSom(p) { R().som = { ...som(), ...p, atualizado: agoraISO() }; alterou(); }
export function definirContas(p) { R().contas = { ...contas(), ...p, atualizado: agoraISO() }; alterou(); }
/** Muda a tela do alarme ({ fundos } e/ou { repique }). Devolve false se tiraria a última imagem. */
export function definirTela(p) {
  if (Array.isArray(p.fundos) && !p.fundos.some(id => FUNDOS_ALARME.some(([f]) => f === id))) return false;
  // registro com `atualizado` (a junção entre aparelhos fica com o mais recente inteiro); tela() limpa os valores
  R().tela = { ...tela(), ...p };
  R().tela = { ...tela(), atualizado: agoraISO() };
  alterou();
  return true;
}
/** Liga ou desliga uma imagem da tela do alarme (sempre fica pelo menos uma). */
export function alternarFundo(id, sim) {
  const s = new Set(tela().fundos);
  if (sim) s.add(id); else s.delete(id);
  if (!s.size) return false;
  return definirTela({ fundos: FUNDOS_ALARME.map(([f]) => f).filter(f => s.has(f)) });
}
/** Exceção de um dia: { hora: "05:40" } | { sem: true } | null (volta ao normal). */
export function definirDia(data, exc) {
  const d = R().dias;
  if (!exc) delete d[data]; else d[data] = { ...exc, em: agoraISO() };
  // as exceções que já passaram saem
  for (const k of Object.keys(d)) if (k < somaDias(hojeISO(), -2)) delete d[k];
  alterou();
}
/** Um item da Agenda que nunca desperta (ou volta a despertar). */
export function ignorarItem(id, sim = true) {
  const a = R(), s = new Set(a.ignorar);
  if (sim) s.add(id); else s.delete(id);
  a.ignorar = [...s]; alterou();
}
export const itensIgnorados = () => R().ignorar.map(id => A().itens.find(i => i.id === id)).filter(Boolean);

// ---------- resultados das contas (o celular guarda; o app lê ao abrir) ----------
/** Aplica um resultado vindo do Android: { data, acertos, erros, ms (do deslize ao fim das contas), nivel, novoNivel,
 *  hora (do deslize), em (ms), teste, voltas (quantas vezes tocou de novo por não terminar as contas) }.
 *  Devolve o XP ganho (0 se a data já tinha resultado, por exemplo vinda de outro aparelho, ou se era teste). */
export function aplicarResultado(r) {
  if (!r?.data) return 0;
  const a = R(), em = new Date(Number(r.em) || Date.now()).toISOString();
  if (r.novoNivel && contas().modo === "auto" && (!a.nivel?.em || a.nivel.em < em)) a.nivel = { valor: Math.min(8, Math.max(1, Math.round(r.novoNivel))), em };
  if (r.teste) { salvar(); return 0; }
  if (a.resultados[r.data]) { salvar(); return 0; }
  const acertos = Math.max(0, Math.round(r.acertos || 0));
  a.resultados[r.data] = { acertos, erros: Math.max(0, Math.round(r.erros || 0)), ms: Math.round(r.ms || 0), nivel: r.nivel || 1, hora: r.hora || "", em };
  if (r.voltas > 0) a.resultados[r.data].voltas = Math.round(r.voltas);
  // guarda só os últimos 90 dias
  const limite = somaDias(hojeISO(), -90);
  for (const k of Object.keys(a.resultados)) if (k < limite) delete a.resultados[k];
  const xp = acertos ? ganhar(XP_POR_CONTA * acertos, 0, "Alarme: contas ao acordar", "alarme") : 0;
  alterou();
  return xp;
}
/** Resumo dos últimos dias: { n, horaMedia, tempoMedio (ms), acertos, lista: [{ data, hora, ms, acertos, erros, nivel }] }. */
export function estatisticas(dias = 30) {
  const limite = somaDias(hojeISO(), -dias);
  const lista = Object.entries(R().resultados).filter(([d]) => d >= limite).map(([data, r]) => ({ data, ...r })).sort((a, b) => b.data.localeCompare(a.data));
  if (!lista.length) return { n: 0, lista };
  const comHora = lista.filter(r => /^\d\d:\d\d$/.test(r.hora));
  const horaMedia = comHora.length ? hhmm(Math.round(comHora.reduce((t, r) => t + minutos(r.hora), 0) / comHora.length)) : "";
  return { n: lista.length, horaMedia, tempoMedio: Math.round(lista.reduce((t, r) => t + (r.ms || 0), 0) / lista.length), acertos: lista.reduce((t, r) => t + (r.acertos || 0), 0), lista };
}

// ---------- aviso na véspera (notificacoes.js): HUOP e CEO no fim de semana, e HUOP em qualquer dia ----------
/** As notificações da véspera, às 20h: [{ id, title, body, quando, extra }]. */
export function avisosDeVespera(agora = new Date()) {
  if (!tocaAqui()) return [];
  return proximosDias(DIAS_ALARME, agora).filter(a => a.hora && a.confira && !a.manual && !a.passou).map((a, k) => {
    const quando = emHoraLocal(somaDias(a.data, -1), "20:00");
    const huop = /\bHUOP\b/.test(a.item || "");
    return { id: 1200 + k, quando, title: `Amanhã tem ${a.item}: alarme às ${horaCurta(a.hora)} ⏰`,
      body: `${huop ? "Confira o horário do plantonista" : "Confira o horário"} (começa às ${horaCurta(a.inicio)}). Toque para mudar o alarme.`, extra: { area: "agenda:alarmes" } };
  }).filter(x => x.quando > agora);
}

// ---------- o lado nativo ----------
let plug;
async function plugin() {
  if (plug !== undefined) return plug;
  try {
    const { Capacitor, registerPlugin } = await import("../vendor/capacitor-core.js");
    plug = Capacitor.isNativePlatform() ? semThen(registerPlugin("Alarmes")) : null; // sem o then, o await travava (semThen.js)
  } catch { plug = null; }
  return plug;
}
export const nativo = async () => !!(await plugin());

/** As músicas da playlist Alarme das Músicas: [{ uri, ganho, titulo, artista }] (vazia sem Músicas). */
export async function faixasDoAlarme() {
  try {
    const BD = await import("./musicas/banco.js");
    const al = (await BD.todosAlbuns()).find(a => a.id === ALARME_PLAYLIST);
    if (!al?.faixas?.length) return [];
    const ids = new Set(al.faixas), out = [];
    for (const f of await BD.todasFaixas()) if (ids.has(f.id) && !f.entrada) out.push({ uri: f.id, ganho: Number.isFinite(f.ganho) ? f.ganho : 0, titulo: f.titulo || "", artista: f.artista || "" });
    return out.slice(0, 300);
  } catch { return []; }
}

/** O pacote que vai ao Android. */
export async function dadosParaNativo(agora = new Date()) {
  const s = som(), c = contas(), t = tela();
  const lista = tocaAqui() ? proximosDias(DIAS_ALARME, agora).filter(a => a.hora && !a.passou) : [];
  return {
    v: 2,
    alarmes: lista.map(a => ({ id: a.data, data: a.data, quando: a.quando, hora: a.hora, titulo: a.motivo || "Alarme" })),
    som: { fonte: s.fonte, crescer: s.crescer, vibrar: s.vibrar !== false, volume: s.volume },
    faixas: s.fonte === "playlist" ? await faixasDoAlarme() : [],
    contas: { modo: c.modo, nivel: nivelAtual(), nivelEm: Date.parse(R().nivel?.em || "") || 0, quantas: c.quantas },
    // a tela do alarme (AlarmeActivity): as imagens que podem aparecer e o "toca de novo" depois do deslize
    tela: { fundos: t.fundos, repique: t.repique },
  };
}

let ultimoEnvio = "", timerEnvio = null;
/** Situação do lado nativo, para a tela: { exato, telaCheia, sobreApps, caminho, notificacoes, bateria, agendados, proximo, tocando } (null fora do Android). */
export let situacao = null;
export function agendarEnvio(ms = 1500) { clearTimeout(timerEnvio); timerEnvio = setTimeout(() => enviar().catch(e => console.warn("Alarmes:", e?.message || e)), ms); }
export async function enviar(forcar = false) {
  const P = await plugin();
  if (!P) return null;
  const dados = await dadosParaNativo();
  const txt = JSON.stringify(dados);
  if (!forcar && txt === ultimoEnvio) return situacao;
  situacao = await P.agendar({ dados: txt });
  ultimoEnvio = txt;
  window.dispatchEvent?.(new Event("oq-alarmes"));
  return situacao;
}
export async function lerSituacao() {
  const P = await plugin();
  if (!P) return null;
  try { situacao = await P.estado(); } catch { /* app antigo, sem o plugin */ }
  return situacao;
}
/** O diário do alarme no celular (AlarmesPlugin.diario): [{ em, texto }], do mais novo ao mais antigo; null fora do app
 *  ou num app antigo (sem o diário). Pedido do Alediov, 03/11/2026: saber o que deu errado num teste que não tocou. */
export async function diario() {
  const P = await plugin();
  if (!P?.diario) return null;
  try { const r = await P.diario(); return (r?.itens || []).map(([em, texto]) => ({ em: Number(em), texto: String(texto) })).reverse(); }
  catch { return null; }
}
export async function abrirAjuste(qual) { const P = await plugin(); if (P) await P.abrirAjuste({ qual }).catch(() => {}); }
/** "Testar alarme em 1 minuto": manda a lista (com o som e as contas de agora) e agenda um teste. */
export async function testar(segundos = 60) {
  const P = await plugin();
  if (!P) return { simulado: true };
  await enviar(true).catch(() => {});
  return P.testar({ segundos });
}
/** Lê os resultados das contas guardados pelo Android e aplica (XP só pelos acertos). Devolve o XP ganho. */
export async function lerResultados() {
  const P = await plugin();
  if (!P) return 0;
  let xp = 0;
  try {
    const { itens = [] } = await P.resultados();
    for (const r of itens) xp += aplicarResultado(r);
  } catch { /* app antigo */ }
  if (xp) window.dispatchEvent?.(new Event("oq-topo"));
  return xp;
}

let iniciado = false;
/** Liga os recálculos: ao abrir, ao voltar ao app, a cada mudança na Agenda e nas regras, depois da sincronização
 *  (oq-colecao) e quando a playlist Alarme muda. Também a cada 15 min (virada do dia). */
export function iniciarAlarmes() {
  if (iniciado) return; iniciado = true;
  window.addEventListener("oq-agenda", () => agendarEnvio());
  window.addEventListener("oq-colecao", () => agendarEnvio(3000));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { lerResultados(); agendarEnvio(2000); } });
  setInterval(() => agendarEnvio(0), 15 * 60000);
  import("./musicas/biblioteca.js").then(B => B.aoMudarBiblioteca(o => { if (o.albuns || o.album === ALARME_PLAYLIST) agendarEnvio(4000); })).catch(() => {});
  lerResultados().then(xp => { if (xp) import("./ui.js").then(U => U.toast(`Bom dia! +${xp} XP pelas contas do alarme ⏰`, 3600)); });
  agendarEnvio(2500);
}
