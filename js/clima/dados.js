// Clima: busca, cache e o lugar. A principal é o Open-Meteo (previsão + qualidade do ar, gratuito e sem chave, CC BY 4.0);
// se ele falhar, a reserva é o MET Norway (locationforecast 2.0, gratuito e sem chave, pede um User-Agent que diga quem
// é, CC BY 4.0). As duas viram o mesmo formato (tempo.js). No Android os pedidos vão pelo CapacitorHttp (como a cotação
// das Finanças); no navegador, por fetch (as duas fontes aceitam CORS).
// Guardado: o lugar em E().config.climaLugar (sincroniza: o tablet mostra a mesma cidade) e a última resposta em
// localStorage "orbita.clima" (só deste aparelho; o app mostra "atualizado há X min" e funciona sem internet).
// Casa, Faculdade e HUOP (pedido do Alediov, 03/11/2026): com a Casa definida, o Clima tem três lugares em Cascavel. A
// Casa fica SÓ neste aparelho (localStorage "orbita.clima.casa", fora do estado que sincroniza com o GitHub); a
// Faculdade (padrão: a UNIOESTE) e o HUOP (padrão: o hospital) ficam em E().config.climaFaculdade/climaHuop (sincronizam).
// Uma previsão guardada por lugar ("orbita.clima.p.<lugar>"). A tela mostra o lugar da hora (tempo.js `lugarDaHora`:
// Casa de manhã cedo e à noite, Faculdade ou HUOP no período dos compromissos presenciais da Agenda) ou o escolhido à
// mão no seletor do alto (vale até o fim do dia, "orbita.clima.escolha"); os widgets e a Home seguem o que a tela
// mostraria. Sem a Casa, um ponto só, como antes.
import { E, salvar, hojeISO, somaDias } from "../estado.js";
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import * as T from "./tempo.js";

const CHAVE = "orbita.clima", CHAVE_RECENTES = "orbita.clima.recentes", CHAVE_CASA = "orbita.clima.casa", CHAVE_ESCOLHA = "orbita.clima.escolha";
const nativo = !!Capacitor.isNativePlatform?.();
const Http = nativo ? registerPlugin("CapacitorHttp") : null;
const UA = "Orbita/1.0 (app pessoal de estudos; Android)";

export const lugar = () => E().config.climaLugar || T.PADRAO;
export function definirLugar(l) {
  const c = E().config;
  c.climaLugar = l && !(Math.abs(l.lat - T.PADRAO.lat) < 1e-3 && Math.abs(l.lon - T.PADRAO.lon) < 1e-3) ? { nome: l.nome, regiao: l.regiao || "", pais: l.pais || "", lat: l.lat, lon: l.lon, fuso: l.fuso || T.PADRAO.fuso } : null;
  if (!c.climaLugar) delete c.climaLugar;
  salvar();
  if (l) guardarRecente(l);
}
export function recentes() { try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES) || "[]"); } catch { return []; } }
function guardarRecente(l) {
  try {
    const r = [l, ...recentes().filter(x => !(Math.abs(x.lat - l.lat) < 1e-3 && Math.abs(x.lon - l.lon) < 1e-3))].slice(0, 5);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(r));
  } catch { /* sem armazenamento */ }
}
const mesmoLugar = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-3 && Math.abs(a.lon - b.lon) < 1e-3;

// ---------------------------------------------------------------- Casa, Faculdade e HUOP
const limpo = (l, nome) => ({ nome: String(l.nome || nome).slice(0, 60), regiao: "Paraná", pais: "BR", lat: +(+l.lat).toFixed(5), lon: +(+l.lon).toFixed(5), fuso: T.PADRAO.fuso, ...(l.bairro ? { bairro: l.bairro } : {}) });
/** A Casa (só deste aparelho) ou null. */
export function casa() {
  try { const c = JSON.parse(localStorage.getItem(CHAVE_CASA) || "null"); return c && Number.isFinite(c.lat) && Number.isFinite(c.lon) ? c : null; } catch { return null; }
}
/** Define a Casa ({lat, lon, nome?, bairro?}) ou a tira (null: volta a um ponto só). Nunca vai para o estado sincronizado. */
export function definirCasa(l) {
  try {
    if (!l) { localStorage.removeItem(CHAVE_CASA); localStorage.removeItem(chaveCache("casa")); }
    else localStorage.setItem(CHAVE_CASA, JSON.stringify(limpo(l, "Casa")));
  } catch { /* sem armazenamento */ }
  avisarTroca();
}
export const temCasa = () => !!casa();
export const faculdade = () => E().config.climaFaculdade || T.FACULDADE;
export const huop = () => E().config.climaHuop || T.HUOP;
/** Faculdade ou HUOP (`qual`) num lugar novo; null volta ao padrão. Sincronizam. */
export function definirLugarFixo(qual, l) {
  const c = E().config, k = qual === "huop" ? "climaHuop" : "climaFaculdade", pad = qual === "huop" ? T.HUOP : T.FACULDADE;
  if (!l || mesmoLugar(l, pad)) delete c[k]; else c[k] = limpo(l, pad.nome);
  salvar(); avisarTroca();
}
/** O lugar de cada "qual": casa, faculdade, huop ou unico (o ponto só, de antes). */
export const lugarDe = (qual) => qual === "casa" ? casa() || lugar() : qual === "faculdade" ? faculdade() : qual === "huop" ? huop() : lugar();
export const NOMES_LUGAR = { casa: "Casa", faculdade: "Faculdade", huop: "HUOP" };

// a Agenda (carregada uma vez, para o lugar da hora ser síncrono; até carregar, conta como sem Agenda)
let agendaMod = null;
const pAgenda = import("../agenda.js").then(m => (agendaMod = m)).catch(() => null);
let alarmesMod = null;
import("../alarmes.js").then(m => (alarmesMod = m)).catch(() => null);
/** A escolha à mão do seletor do alto (vale até o fim do dia). */
export function escolhaManual() {
  try { const e = JSON.parse(localStorage.getItem(CHAVE_ESCOLHA) || "null"); return e?.dia === hojeISO() && ["casa", "faculdade", "huop"].includes(e.qual) ? e.qual : null; } catch { return null; }
}
export function escolher(qual) {
  try { if (qual) localStorage.setItem(CHAVE_ESCOLHA, JSON.stringify({ dia: hojeISO(), qual })); else localStorage.removeItem(CHAVE_ESCOLHA); } catch { /* nada */ }
  avisarTroca();
}
/** O que a tela mostra agora: "unico" (sem Casa) ou casa/faculdade/huop (tempo.js `lugarDaHora`, pela Agenda de hoje). */
export function mostrado(ms = Date.now()) {
  if (!temCasa()) return "unico";
  const d = new Date(ms), hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return T.lugarDaHora({ hm, trajetos: trajetosSync(hojeISO(d)), manual: escolhaManual() });
}
/** Os lugares para o seletor do alto: Casa, Faculdade e, nos dias com HUOP na Agenda (ou escolhido à mão), o HUOP. */
export function lugaresDoSeletor(dia = hojeISO()) {
  if (!temCasa()) return [];
  const comHuop = trajetosSync(dia).some(t => t.huop) || escolhaManual() === "huop";
  return ["casa", "faculdade", ...(comHuop ? ["huop"] : [])];
}
function avisarTroca() {
  window.dispatchEvent(new CustomEvent("oq-clima", { detail: guardado() }));
  enviarAoWidget();
  import("../notificacoes.js").then(N => N.reagendar()).catch(() => {});
}

const chaveCache = (qual) => qual === "unico" ? CHAVE : `${CHAVE}.p.${qual}`;
/** A última resposta guardada de um lugar (padrão: o que a tela mostra agora); null se não houver. */
export function guardado(qual = mostrado()) {
  try {
    const c = JSON.parse(localStorage.getItem(chaveCache(qual)) || "null");
    return c?.horas?.length && mesmoLugar(c.lugar, lugarDe(qual)) ? c : null;
  } catch { return null; }
}
function guardar(c, qual) { try { localStorage.setItem(chaveCache(qual), JSON.stringify(c)); } catch { /* cheio ou bloqueado: fica só na memória */ } }
/** Minutos desde a busca. */
export const idadeMin = (c) => (c ? Math.max(0, Math.round((Date.now() - Date.parse(c.em)) / 60000)) : Infinity);

async function pegarJson(url, { ua = false } = {}) {
  if (Http) {
    const r = await Http.request({ url, method: "GET", headers: { Accept: "application/json", ...(ua ? { "User-Agent": UA } : {}) }, connectTimeout: 12000, readTimeout: 15000 });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  }
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}

const andamento = {};
/** Busca o tempo de um lugar (`qual`; se o guardado tem mais de `idade` minutos ou `forcar`), guarda e avisa. */
function atualizarUm(qual, { forcar = false, idade = 10 } = {}) {
  const atual = guardado(qual);
  if (!forcar && atual && idadeMin(atual) < idade) return Promise.resolve({ clima: atual, novo: false });
  if (!navigator.onLine) return Promise.resolve({ clima: atual, novo: false, erro: "Sem internet agora." });
  return (andamento[qual] ||= (async () => {
    const l = lugarDe(qual);
    let c = null, erro = null;
    try {
      const [b, ar] = await Promise.all([pegarJson(T.urlOpenMeteo(l)), pegarJson(T.urlAr(l)).catch(() => null)]);
      c = T.normalizarOpenMeteo(b, ar, l);
    } catch (e1) {
      console.warn("Clima: Open-Meteo", e1.message);
      try { c = T.normalizarMET(await pegarJson(T.urlMET(l), { ua: true }), l); }
      catch (e2) { console.warn("Clima: MET Norway", e2.message); erro = "Não deu para buscar o tempo agora."; }
    }
    if (c) { guardar(c, qual); avisar(c); }
    return { clima: c || atual, novo: !!c, erro };
  })().finally(() => { delete andamento[qual]; }));
}
/** Busca o tempo do lugar mostrado e, com a Casa definida, depois o dos outros (a Casa e a Faculdade sempre, para a
 *  chuva no caminho; o HUOP só nos dias com HUOP ou se for o mostrado). Se só der para buscar um, o mostrado fica
 *  primeiro. Devolve o resultado do mostrado. */
export async function atualizar({ forcar = false, idade = 10 } = {}) {
  const q = mostrado(), r = await atualizarUm(q, { forcar, idade });
  if (q !== "unico" && !r.erro) {
    const outros = ["casa", "faculdade", ...(lugaresDoSeletor().includes("huop") ? ["huop"] : [])].filter(x => x !== q);
    for (const o of outros) { const ro = await atualizarUm(o, { idade: forcar ? 10 : idade }); if (ro.erro) break; }
  }
  return r;
}
/** Guarda um clima pronto (o teste de fumaça e a troca de lugar sem internet), no lugar que tem a coordenada dele. */
export function usar(c, qual = null) {
  qual ||= ["casa", "faculdade", "huop"].find(q => (q !== "casa" || temCasa()) && mesmoLugar(c.lugar, lugarDe(q))) || "unico";
  guardar(c, qual); avisar(c);
}
function avisar(c) {
  window.dispatchEvent(new CustomEvent("oq-clima", { detail: c }));
  enviarAoWidget();
  // a previsão mudou: o aviso de chuva das 6h é refeito (notificacoes.js) e, entre as 6h e a ida, avisa na hora
  import("../notificacoes.js").then(N => N.reagendar()).catch(() => {});
  avisarChuvaAgora().catch(e => console.warn("Clima: chuva no caminho", e?.message || e));
}

/** Os bairros e distritos de Cascavel com o centro de cada um (para escolher a Casa sem GPS): dos mapas do Painel da
 *  IC (scan/mapas.js, gerado; grande, então só carrega quando a folha abre). [{nome, tipo, lat, lon}] em ordem. */
export async function bairrosDeCascavel() {
  const { MAPAS, GEO } = await import("../scan/mapas.js");
  const out = [];
  for (const camada of ["bairros", "distritos"]) MAPAS[camada].itens.forEach(([nome], i) => {
    const g = GEO[camada].itens[i];
    if (g && nome !== "Sede Administrativa") out.push({ nome, tipo: camada === "bairros" ? "bairro" : "distrito", lon: g[1], lat: g[2] });
  });
  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Busca cidades pelo nome (geocoding do Open-Meteo). */
export async function buscarCidades(nome) {
  if (!nome || nome.trim().length < 2) return [];
  return T.lugaresDaBusca(await pegarJson(T.urlBusca(nome.trim())));
}

// ---------------------------------------------------------------- as idas e voltas pela Agenda (para os avisos)
/** As saídas de casa e as voltas do dia: pela Agenda, 40 min antes do 1º compromisso presencial e 10 min depois do
 *  último; sem Agenda, de segunda a sexta às 6h50 e às 19h (os ônibus de sempre). */
export async function trajetosDe() {
  await pAgenda;
  return trajetosSync;
}
/** Os trajetos de um dia, já com a Agenda carregada (ou o padrão): [{quando, hora, onde, agenda, huop}]. `onde`: de
 *  onde sai (a ida, de casa) ou onde está (a volta: o HUOP se o último compromisso do dia é no HUOP, senão a Faculdade;
 *  o CEO conta como Faculdade); `agenda`: veio da Agenda (o padrão não decide o lugar da tela); `huop`: o dia tem HUOP. */
export function trajetosSync(dia) {
  const A = agendaMod, ehH = alarmesMod?.ehHuop || ((it) => /\bHUOP\b/.test(`${it?.curto || ""} ${it?.nome || ""}`));
  const min = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }, hm = (x) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  try {
    if (A && (A.A().itens || []).length) {
      const evs = A.eventosDoDia(dia).filter(ev => !["falta", "nao_teve"].includes(ev.presenca) && ev.inicio && ev.fim);
      if (!evs.length) return [];
      const ini = Math.min(...evs.map(e => min(e.inicio))), fim = Math.max(...evs.map(e => min(e.fim)));
      const ultimo = evs.filter(e => min(e.fim) === fim), huopDia = evs.some(e => ehH(e.item)), voltaHuop = ultimo.some(e => ehH(e.item));
      return [{ quando: "ida", hora: hm(Math.max(0, ini - 40)), onde: "casa", agenda: true, huop: huopDia },
        { quando: "volta", hora: hm(Math.min(23 * 60 + 59, fim + 10)), onde: voltaHuop ? "huop" : "faculdade", agenda: true, huop: huopDia }];
    }
  } catch { /* cai no padrão */ }
  const s = new Date(dia + "T12:00:00").getDay();
  return s >= 1 && s <= 5 ? [{ quando: "ida", hora: "06:50", onde: "casa" }, { quando: "volta", hora: "19:00", onde: "faculdade" }] : [];
}
export async function avisosDe(c, ms = Date.now()) {
  if (!c) return [];
  return T.avisos(c, ms, { trajetos: await trajetosDe() });
}

// ---------------------------------------------------------------- chuva no caminho (pedido do Alediov, 03/11/2026)
// "Leve guarda-chuva: chuva prevista na ida, 7h–8h, 70%", às 6h, só nos dias com chuva na ida ou na volta. O app não
// roda de madrugada: a notificação local é agendada para as 6h (notificacoes.js, id 979, com a previsão guardada) a cada
// atualização da previsão e reescrita (ou tirada) quando ela muda. Aberto depois das 6h e antes da ida, sem a das 6h
// ter saído, avisa na hora, uma vez. Interruptor nas opções do Clima (`config.climaAvisoChuva`, ligado por padrão).
// O que já foi agendado e avisado fica em localStorage "orbita.clima.chuva" (só deste aparelho).
const CHAVE_CHUVA = "orbita.clima.chuva", ID_CHUVA = 979;
export const avisoChuvaLigado = () => E().config.climaAvisoChuva !== false;
export function definirAvisoChuva(v) {
  E().config.climaAvisoChuva = !!v; salvar();
  import("../notificacoes.js").then(N => N.reagendar()).catch(() => {});
}
function estadoChuva() { try { const s = JSON.parse(localStorage.getItem(CHAVE_CHUVA) || "{}"); return s && typeof s === "object" ? s : {}; } catch { return {}; } }
function guardarChuva(s) { try { localStorage.setItem(CHAVE_CHUVA, JSON.stringify(s)); } catch { /* sem armazenamento */ } }
const seisDe = (dia) => new Date(`${dia}T06:00:00`);
/** O aviso das 6h que o notificacoes.js agenda: o dia alvo (hoje antes das 6h, senão amanhã) e a chuva no caminho dele
 *  pela previsão guardada (até 36 h de idade). { alvo, quando, aviso (tempo.js `chuvaNoCaminho`) | null }. */
export async function planoChuva(agora = Date.now()) {
  const hoje = hojeISO(), alvo = agora < +seisDe(hoje) ? hoje : somaDias(hoje, 1), quando = seisDe(alvo);
  const cs = previsoesDoCaminho();
  if (!avisoChuvaLigado() || !cs) return { alvo, quando, aviso: null };
  return { alvo, quando, aviso: T.chuvaNoCaminho(cs, alvo, await trajetosDe()) };
}
/** As previsões da chuva no caminho (até 36 h de idade): sem a Casa, a do ponto só; com ela, a ida pela Casa e a volta
 *  pela Faculdade ou pelo HUOP (o que faltar cai no que houver). null sem nenhuma. */
export function previsoesDoCaminho() {
  const ok = (c) => (c && idadeMin(c) <= 36 * 60 ? c : null);
  if (!temCasa()) return ok(guardado("unico"));
  const cs = { casa: ok(guardado("casa")), faculdade: ok(guardado("faculdade")), huop: ok(guardado("huop")) };
  const algum = cs.casa || cs.faculdade || cs.huop;
  if (!algum) return null;
  cs.unico = algum; // reserva para o lugar sem previsão
  return cs;
}
/** Anota o que o notificacoes.js agendou (ou tirou) para o dia alvo: a das 6h que já passou conta como avisada. */
export function anotarAgendamento(p, agora = Date.now()) {
  const s = estadoChuva(), ag = (s.ag ||= {});
  if (p.aviso && +p.quando > agora) ag[p.alvo] = +p.quando;
  else if (ag[p.alvo] > agora) delete ag[p.alvo]; // a previsão mudou antes das 6h: não sai mais
  for (const d of Object.keys(ag)) if (d < somaDias(hojeISO(), -3)) delete ag[d];
  guardarChuva(s);
}
/** Depois das 6h e antes da ida de hoje, com chuva no caminho e sem a das 6h ter saído: avisa na hora, uma vez. */
export async function avisarChuvaAgora(agora = Date.now()) {
  const hoje = hojeISO(), s = estadoChuva();
  if (!avisoChuvaLigado() || agora < +seisDe(hoje) || s.avisada === hoje) return null;
  if (s.ag?.[hoje] && s.ag[hoje] <= agora) { s.avisada = hoje; guardarChuva(s); return null; } // a das 6h já saiu
  const cs = previsoesDoCaminho(); if (!cs) return null;
  const tjs = await trajetosDe(), ida = (tjs(hoje) || []).find(t => t.quando === "ida");
  if (!ida || +new Date(`${hoje}T${ida.hora}:00`) <= agora) return null;
  const av = T.chuvaNoCaminho(cs, hoje, tjs);
  if (!av) return null;
  s.avisada = hoje; guardarChuva(s);
  const { avisarAgora } = await import("../notificacoes.js");
  await avisarAgora({ id: ID_CHUVA, title: av.titulo, body: av.texto, extra: { area: "clima" } });
  return av;
}

// ---------------------------------------------------------------- os widgets nativos
const Widget = nativo ? registerPlugin("Widget") : null;
const VERSAO_ICONES = "1";
let ultimoWidget = "";
/** Manda ao Android as próximas horas, os dias, o aviso e (uma vez por versão) os ícones em PNG. */
export async function enviarAoWidget(c = guardado()) {
  c ||= guardado(); // os widgets mostram o lugar que a tela mostraria agora
  if (!Widget || !c) return;
  try {
    const dados = T.paraWidget(c, await avisosDe(c));
    const assin = JSON.stringify(dados);
    let icones = null;
    if (localStorage.getItem("orbita.clima.icones") !== VERSAO_ICONES) icones = await iconesPng();
    if (assin === ultimoWidget && !icones) return;
    ultimoWidget = assin;
    await Widget.atualizarClima({ ...dados, ...(icones ? { icones: JSON.stringify(icones) } : {}) });
    if (icones) localStorage.setItem("orbita.clima.icones", VERSAO_ICONES);
  } catch (e) { console.warn("Clima: widget", e?.message || e); /* app antigo sem o método */ }
}
async function iconesPng() {
  const { svgTempo, TIPOS } = await import("./icones.js");
  const out = {};
  for (const t of TIPOS) out[t] = await svgParaPng(svgTempo(t, { animado: false }), 192);
  return out;
}
function svgParaPng(svg, lado) {
  return new Promise((ok) => {
    const s = svg.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" `);
    const img = new Image();
    img.onload = () => { const cv = document.createElement("canvas"); cv.width = lado; cv.height = lado; cv.getContext("2d").drawImage(img, 0, 0, lado, lado); ok(cv.toDataURL("image/png").split(",")[1]); };
    img.onerror = () => ok("");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  });
}

// ---------------------------------------------------------------- em segundo plano (areas.js)
let ultimaFundo = 0;
/** Ao abrir o app e ao voltar a ele (no máximo a cada 30 min): busca o tempo para a Home e os widgets. */
export async function atualizarNoFundo() {
  if (Date.now() - ultimaFundo < 30 * 60e3) return;
  ultimaFundo = Date.now();
  const r = await atualizar({ idade: 30 });
  if (!r.novo && r.clima) { enviarAoWidget(r.clima); avisarChuvaAgora().catch(() => {}); }
}
