// Mensagens programadas da Eva (docs/plano-eva.md): notificações locais montadas no aparelho, que funcionam sem internet.
// Horários pela Agenda: bom dia antes do ônibus (1º compromisso presencial − 50 min, ou 6h40; 8h30 no fim de semana
// livre; nunca antes do alarme), depois das aulas (fim da última + 15 min) e o fechamento às 21h30; e de 0 a 2
// aleatórias por dia (sorteadas pela data; tem dia sem nenhuma). Nunca durante aula, evento, prova ou sono (antes do
// alarme do dia e depois das 23h). Cobrança: cada item do Meu dia recebe até 3 lembretes (lembra, insiste, propõe a
// versão menor e pergunta o motivo); "Hoje não dá" com motivo e "Já fiz" tiram o item do dia. Os combinados ("Daqui a
// pouco" → um horário) viram uma mensagem própria naquele horário.
// A música do dia (musicaDia.js, pedido do Alediov, 05/11/2026): só hoje e só com a biblioteca neste aparelho, à
// tardinha ou à noite (18h30 a 20h40; sem lugar, de 12h a 17h30), nunca em compromisso nem no sono e longe das outras.
// Para não repetir o mesmo texto em dias seguidos, cada item guarda o `modelo` da fala e o plano evita os de ontem.
// Ids das notificações: 5000–5019 hoje, 5020–5039 amanhã, 5040 depois de amanhã (a de saudade, trocada sempre que ele
// abre o app). Cada mensagem que chega também entra no chat (`entregarVencidas`), com o mesmo texto da notificação.
// `planejarDia` é puro (node tools/teste_eva.mjs); o resto lê o app por imports dinâmicos.
import { rng, fala as falaPura, pedaco, sobre } from "./falas.js";

export const ID_HOJE = 5000, ID_AMANHA = 5020, ID_LONGE = 5040, MAX_POR_DIA = 20, MAX_COBRANCAS = 3;
export const HORA_FIM = "21:30", HORA_DORMIR = "23:00", HORA_HUMOR = "21:00", HORA_MUSICA = "18:30";
export const PERGUNTA_HUMOR = "Como você está agora?";
const NAO_FOI = ["falta", "nao_teve", "nao", "naoteve", "nao-teve"];
export const min = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return a * 60 + (b || 0); };
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
export const emMs = (data, m) => { const d = new Date(data + "T00:00:00"); d.setHours(0, m, 0, 0); return d.getTime(); };
const horaFala = (m) => { const h = Math.floor(m / 60), mm = Math.round(m % 60); return mm ? `${h}h${String(mm).padStart(2, "0")}` : `${h}h`; };

/** Os intervalos ocupados do dia, em minutos: compromissos (± 10 min), provas (30 min antes a 2h30 depois) e o sono. */
export function ocupados(d) {
  const out = [];
  for (const ev of d.eventos || []) {
    if (!ev.inicio || NAO_FOI.includes(ev.presenca)) continue;
    const a = min(ev.inicio), b = ev.fim ? min(ev.fim) : a + 60;
    out.push([a - 10, Math.max(b, a + 30) + 10, "compromisso"]);
  }
  for (const p of d.provas || []) if (p.hora) out.push([min(p.hora) - 30, min(p.hora) + 150, "prova"]);
  out.push([0, d.acordar ? min(d.acordar) + 5 : min(d.fds ? "07:30" : "06:15"), "sono"]);
  out.push([min(d.dormir || HORA_DORMIR), 24 * 60, "sono"]);
  return out;
}
export const livre = (m, oc) => !oc.some(([a, b]) => m >= a && m < b);
/** Empurra para o fim do intervalo ocupado em que `m` cai (até `limite`); null se não couber. */
function empurrar(m, oc, limite) {
  for (let i = 0; i < 6 && !livre(m, oc); i++) { const iv = oc.find(([a, b]) => m >= a && m < b); m = iv[1] + 5; }
  return livre(m, oc) && m <= limite ? m : null;
}

/** Os horários do dia (sem os textos): [{ slot, m, item? (combinado) }]. */
export function horariosDoDia(d) {
  const oc = ocupados(d), rnd = rng(`eva|${d.data}|aleatorias`), out = [];
  if (d.modo === "longe") return [{ slot: "saudade", m: min("19:00") }];
  const pres = (d.eventos || []).filter(ev => ev.presencial && ev.inicio && !NAO_FOI.includes(ev.presenca)).sort((a, b) => min(a.inicio) - min(b.inicio));
  const acorda = d.acordar ? min(d.acordar) : null;
  // bom dia
  let bd = pres[0] && min(pres[0].inicio) < 12 * 60 ? min(pres[0].inicio) - 50 : d.fds ? min("08:30") : min("06:40");
  if (acorda != null) bd = Math.max(bd, acorda + 10);
  bd = empurrar(bd, oc, min("11:30"));
  if (bd != null) out.push({ slot: "bomdia", m: bd });
  // depois das aulas
  if (d.modo !== "amanha" && pres.length) {
    const fim = Math.max(...pres.map(ev => min(ev.fim || ev.inicio)));
    const t = empurrar(fim + 15, oc, min("21:00"));
    if (t != null && fim >= 10 * 60 && (bd == null || t - bd >= 90)) out.push({ slot: "aula", m: t });
  }
  // fechamento
  const fc = empurrar(min(HORA_FIM), oc, min(d.dormir || HORA_DORMIR) - 20);
  if (fc != null) out.push({ slot: "fim", m: fc });
  // a pergunta do humor (humorDia/, pedido do Alediov, 04/11/2026): 1 por dia, à noite, só hoje e só se ele ainda não
  // registrou; às 21h (meia hora antes do fechamento) ou, se não couber, 20 min depois dele
  if (d.modo === "hoje" && d.perguntarHumor) {
    const lim = min(d.dormir || HORA_DORMIR) - 15, longe = (m) => out.every(s => Math.abs(s.m - m) >= 20);
    let hm = empurrar(min(HORA_HUMOR), oc, lim);
    if (hm == null || !longe(hm)) hm = fc != null ? empurrar(fc + 20, oc, lim) : null;
    if (hm != null && longe(hm)) out.push({ slot: "humor", m: hm });
  }
  // a música do dia: o 1º horário livre a partir das 18h30 (de 10 em 10 min), longe 30 min das outras mensagens
  if (d.modo === "hoje" && d.musica) {
    const lim = min(d.dormir || HORA_DORMIR) - 30, longe = (m) => out.every(s => Math.abs(s.m - m) >= 30);
    const ja = d.agoraMin != null ? Math.ceil((d.agoraMin + 10) / 10) * 10 : 0; // só no futuro: um horário que já passou não entra no plano (juntarPlano)
    const achar = (de, ate) => { for (let m = Math.max(min(de), ja); m <= Math.min(min(ate), lim); m += 10) if (livre(m, oc) && longe(m)) return m; return null; };
    // dia cheio (aula à noite, prova à tarde): depois das 20h40 e, por último, de manhã
    const mm = achar(HORA_MUSICA, "20:40") ?? achar("12:00", "17:30") ?? achar("20:50", "23:59") ?? achar("07:00", "11:50");
    if (mm != null) out.push({ slot: "musica", m: mm });
  }
  // aleatórias (0 a 2; tem dia sem nenhuma)
  if (d.modo !== "amanha" && d.aleatorias !== false) {
    const r = rnd(), n = r < 0.3 ? 0 : r < 0.75 ? 1 : 2;
    const ini = Math.max(min("09:00"), (acorda ?? 0) + 60), fimJ = min("20:45");
    for (let k = 0; k < n; k++) {
      for (let tent = 0; tent < 40; tent++) {
        const m = Math.round(ini + rnd() * (fimJ - ini));
        if (livre(m, oc) && out.every(s => Math.abs(s.m - m) >= 50)) { out.push({ slot: `r${k + 1}`, m }); break; }
      }
    }
  }
  // combinados ("Daqui a pouco" para um horário)
  for (const a of d.adiadas || []) {
    const m0 = Math.round((a.ate - emMs(d.data, 0)) / 60000);
    if (m0 < 0 || m0 >= 24 * 60) continue;
    const m = empurrar(m0, oc, min(d.dormir || HORA_DORMIR) - 10);
    if (m != null) out.push({ slot: `ad-${a.id}`, m, adiada: a });
  }
  return out.sort((a, b) => a.m - b.m);
}

/**
 * O plano do dia com os textos: [{ id, data, slot, quando (ms), texto, humor, item?, nivel? }].
 * d: { data, modo ("hoje" | "amanha" | "longe"), eventos, provas (de hoje, com hora), acordar, dormir, fds, pendentes
 * [{ id, titulo }] na ordem do Meu dia, feitos, total, nivel (humor 0–4), nome, cobrancas { itemId: { n, motivo, feito } },
 * adiadas [{ id, item: { id, titulo }, ate (ms) }], aleatorias, provaPerto { nome, quando }, vespera (nome da prova de amanhã),
 * musica { id, titulo, artista, porque } (a música do dia), evitar (os modelos de fala de ontem: Set ou lista) }.
 */
export function planejarDia(d) {
  const nivel = d.nivel ?? 2, nome = d.nome || "Alediov", out = [];
  const evitar = d.evitar instanceof Set ? d.evitar : new Set(d.evitar || []);
  const fala = (tipo, v, r, nv) => falaPura(tipo, v, r, nv, { evitar });
  const proj = {}; // cobranças projetadas por item
  for (const [k, c] of Object.entries(d.cobrancas || {})) proj[k] = c.n || 0;
  const fora = (it) => { const c = d.cobrancas?.[it.id]; return !!(c?.motivo || c?.feito); };
  const pend = (d.pendentes || []).filter(it => !fora(it));
  const alvo = () => pend.find(it => (proj[it.id] || 0) < MAX_COBRANCAS);
  const prova = (r) => (d.provaPerto ? pedaco("prova", { prova: d.provaPerto.nome, quando: d.provaPerto.quando }, r) : "");
  for (const h of horariosDoDia(d)) {
    const id = `eva-${d.data}-${h.slot}`, r = rng(`${id}|${nivel}`);
    let f = null, item = null, nv = null;
    if (h.slot === "humor") f = { texto: PERGUNTA_HUMOR, humor: "normal" }; // texto fixo (não vai para a reescrita da IA)
    else if (h.slot === "musica") f = fala("musicaDia", { nome, titulo: d.musica.titulo, artista: d.musica.artista, porque: d.musica.porque }, r, nivel);
    else if (d.modo === "longe") f = fala("saudade", { nome }, r, 4);
    else if (d.modo === "amanha") {
      if (h.slot === "bomdia") { f = fala("amanha", { nome }, r, nivel); f.texto += prova(r); }
      else if (h.slot === "fim") f = fala("amanhaFim", { nome }, r, nivel);
    } else if (h.slot === "bomdia") {
      if (!pend.length && !(d.pendentes || []).length) f = fala("bomdiaVazio", { nome }, r, nivel);
      else { const p = pend[0] || d.pendentes[0]; f = fala("bomdia", { nome, item: sobre(p).nome, total: (d.pendentes || []).length }, r, nivel); }
      f.texto += prova(r);
    } else if (h.slot === "fim") {
      const p = pend[0];
      if (!(d.pendentes || []).length) f = fala("fimTudo", { nome, total: d.total || 0 }, r, nivel);
      else if (p) { f = fala("fimFalta", { nome, item: sobre(p).nome, menor: sobre(p).menor, feitos: d.feitos || 0, total: d.total || 0 }, r, nivel); item = p.id; }
      else f = fala("checkin", { nome, feitos: d.feitos || 0, total: d.total || 0 }, r, nivel);
      if (d.vespera) f.texto += pedaco("vesperaProva", { prova: d.vespera }, r);
    } else if (h.adiada) {
      const it = h.adiada.item || {};
      f = fala("adiada", { nome, item: sobre(it).nome, hora: horaFala(h.m) }, r, nivel); item = it.id || null;
    } else {
      // depois das aulas e as aleatórias: a cobrança do próximo item (até 3 por item), senão um oi
      const p = alvo();
      if (p) {
        const n = (proj[p.id] || 0) + 1; proj[p.id] = n;
        const s = sobre(p), v = { nome, item: s.nome, menor: s.menor, falta: pend.length };
        f = n === 1 && h.slot === "aula" ? fala("depoisAula", v, r, nivel) : fala(n === 1 ? "cobrar1" : n === 2 ? "cobrar2" : "cobrar3", v, r, nivel);
        item = p.id; nv = n;
      } else if (h.slot === "aula" && !pend.length) f = null;
      else f = fala("checkin", { nome, feitos: d.feitos || 0, total: d.total || 0 }, r, nivel);
    }
    if (!f?.texto) continue;
    out.push({ id, data: d.data, slot: h.slot, quando: emMs(d.data, h.m), texto: f.texto, humor: f.humor, ...(f.modelo ? { modelo: f.modelo } : {}),
      ...(h.slot === "humor" ? { tipo: "humor" } : {}), ...(h.slot === "musica" ? { tipo: "musica", musica: { id: d.musica.id, titulo: d.musica.titulo, artista: d.musica.artista, porque: d.musica.porque, data: d.data, troca: d.musica.troca || 0 } } : {}),
      ...(item ? { item } : {}), ...(nv ? { nivel: nv } : {}) });
  }
  return out.slice(0, MAX_POR_DIA);
}

/** Junta o plano novo com o guardado: o que já passou fica como foi (a notificação já saiu com aquele texto). */
export function juntarPlano(guardado = [], novo = [], agora = Date.now()) {
  const passados = guardado.filter(p => p.quando <= agora);
  const ids = new Set(passados.map(p => p.id));
  return [...passados, ...novo.filter(p => p.quando > agora && !ids.has(p.id))].sort((a, b) => a.quando - b.quando);
}

/** As notificações do Capacitor a partir do plano (só o futuro), com os ids por dia. */
export function paraNotificacoes(plano, agora = Date.now(), datas = {}) {
  const out = [], cont = {};
  for (const p of plano) {
    if (p.quando <= agora) continue;
    const base = p.data === datas.hoje ? ID_HOJE : p.data === datas.amanha ? ID_AMANHA : p.slot === "saudade" ? ID_LONGE : null;
    if (base == null) continue;
    const k = (cont[base] = (cont[base] ?? -1) + 1);
    if (base === ID_LONGE ? k > 0 : k >= MAX_POR_DIA) continue;
    out.push({ id: base + k, title: "Eva", body: p.texto, largeBody: p.texto, summaryText: "Mensagens", extra: { area: "eva", msg: p.id }, schedule: { at: new Date(p.quando), allowWhileIdle: true } });
  }
  return out;
}

// ---------------------------------------------------------------- no app
const CHAVE_PLANO = "orbita.eva.plano", CHAVE_REESCRITAS = "orbita.eva.reescritas", CHAVE_AQUI = "orbita.eva.aqui";
const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? padrao; } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* cheio */ } };
export const planoGuardado = () => ler(CHAVE_PLANO, { itens: [] }).itens || [];
/** As mensagens programadas tocam neste aparelho? (só no aparelho: padrão o celular sim, o tablet não, como o alarme) */
export function aqui() {
  const v = ler(CHAVE_AQUI, null);
  if (typeof v === "boolean") return v;
  try { return Math.min(screen.width, screen.height) < 600; } catch { return true; }
}
export const definirAqui = (v) => gravar(CHAVE_AQUI, !!v);
/** Os textos reescritos pelo Haiku (só valem se o texto de base for o mesmo). */
export const reescritas = () => ler(CHAVE_REESCRITAS, {});
export function guardarReescritas(novas) {
  const r = { ...reescritas(), ...novas }, corte = Date.now() - 3 * 864e5;
  for (const [k, v] of Object.entries(r)) if ((v.em || 0) < corte) delete r[k];
  gravar(CHAVE_REESCRITAS, r);
}

/** Os dados do planejamento de um dia, lidos do app. */
async function dadosDoDia(data, modo, base) {
  const [AG, AL] = await Promise.all([import("../agenda.js"), import("../alarmes.js")]);
  const eventos = [];
  try {
    for (const ev of AG.eventosDoDia(data)) eventos.push({ inicio: ev.inicio, fim: ev.fim, presencial: true, presenca: ev.presenca || null });
    for (const s of AG.eventosOnlineDoDia(data)) eventos.push({ inicio: s.inicio || "", fim: s.fim || "", presencial: s.modalidade === "presencial", presenca: s.presenca || null });
  } catch (e) { console.warn("Eva: agenda", e); }
  let acordar = null, fds = false;
  try { const a = AL.alarmeDoDia(data); acordar = AL.R().ligado === false ? null : a.hora; fds = !!a.fds; } catch { const dw = new Date(data + "T12:00").getDay(); fds = dw === 0 || dw === 6; }
  const provas = (base.avaliacoes || []).filter(a => a.data === data && a.hora).map(a => ({ hora: a.hora }));
  return { data, modo, eventos, provas, acordar, fds, dormir: HORA_DORMIR };
}

/** O plano de hoje, amanhã e depois (só com a Eva começada); guarda e devolve [itens]. */
export async function planejar(agora = Date.now()) {
  const [ES, EV, CT] = await Promise.all([import("../estado.js"), import("./eva.js"), import("./contexto.js")]);
  const e = ES.E(), ev = EV.EV();
  if (!ev.desde) return [];
  const hoje = ES.hojeISO(new Date(agora)), amanha = ES.somaDias(hoje, 1), depois = ES.somaDias(hoje, 2);
  const { dados, itens } = await CT.coletar(agora);
  const pend = CT.pendentes(itens).map(i => ({ id: i.id, titulo: i.titulo }));
  const contaveis = itens.filter(i => i.feito !== null && !i.bonus);
  const hum = EV.humorAtual();
  const ajustes = EV.ajustes();
  const prox = dados.provas.find(p => p.tipo === "prova" || /prova/i.test(p.titulo || "")) || dados.provas[0];
  const quando = (p) => (p.dias === 0 ? "hoje" : p.dias === 1 ? "amanhã" : `em ${p.dias} dias`);
  const vesp = dados.provas.find(p => p.dias === 1);
  // os modelos de fala dos 3 dias antes de hoje (do chat e do plano de ontem), para não repetir
  const de3 = ES.somaDias(hoje, -3), evitar = new Set();
  for (const m of Object.values(ev.msgs || {})) if (m.modelo && m.de === "eva") { const d = ES.hojeISO(new Date(m.em)); if (d >= de3 && d < hoje) evitar.add(m.modelo); }
  for (const p of planoGuardado()) if (p.modelo && p.data < hoje && p.data >= de3) evitar.add(p.modelo);
  const comum = { nome: dados.nome, nivel: hum.nivel, aleatorias: ajustes.aleatorias !== false, evitar };
  let musica = null;
  if (ajustes.musica !== false && !ev.msgs[`eva-${hoje}-musica`]) try { musica = await (await import("./musicaDia.js")).musicaDeHoje({ data: hoje, hora: 19 }); } catch { musica = null; }
  let perguntarHumor = ajustes.humor !== false;
  if (perguntarHumor) try { perguntarHumor = (await import("../humorDia/humorDia.js")).humorDe(hoje).length === 0; } catch { perguntarHumor = false; }
  const ag = new Date(agora), dHoje = { ...(await dadosDoDia(hoje, "hoje", e)), ...comum, perguntarHumor, musica, agoraMin: ag.getHours() * 60 + ag.getMinutes(), pendentes: pend, feitos: contaveis.filter(i => i.feito).length, total: contaveis.length,
    cobrancas: EV.cobrancasDe(hoje), adiadas: EV.combinadosDe(hoje), provaPerto: prox && prox.dias <= 7 ? { nome: prox.nome, quando: quando(prox) } : null, vespera: vesp?.nome || null };
  const proxA = dados.provas.find(p => p.dias >= 1 && p.dias <= 8);
  const dAmanha = { ...(await dadosDoDia(amanha, "amanha", e)), ...comum, provaPerto: proxA ? { nome: proxA.nome, quando: proxA.dias === 1 ? "hoje" : `em ${proxA.dias - 1} dias` } : null };
  const dLonge = { data: depois, modo: "longe" };
  const novo = [...planejarDia(dHoje), ...planejarDia(dAmanha), ...planejarDia(dLonge)];
  // os textos reescritos pela IA, quando o texto de base é o mesmo
  const rs = reescritas();
  for (const p of novo) if (!p.tipo && EV.comIA() && rs[p.id]?.base === p.texto && rs[p.id].texto) { p.base = p.texto; p.texto = rs[p.id].texto; }
  const guardado = planoGuardado().filter(p => p.data >= ES.somaDias(hoje, -1));
  const plano = juntarPlano(guardado, novo, agora);
  gravar(CHAVE_PLANO, { em: agora, itens: plano });
  return plano;
}

/** Para o notificacoes.js (reagendar): as notificações da Eva deste aparelho. */
export async function notificacoes(agora = Date.now()) {
  if (!aqui()) return [];
  const ES = await import("../estado.js"), EV = await import("./eva.js");
  if (!EV.EV().desde || EV.ajustes().mensagens === false) return [];
  const plano = await planejar(agora), hoje = ES.hojeISO(new Date(agora));
  return paraNotificacoes(plano, agora, { hoje, amanha: ES.somaDias(hoje, 1) });
}

/** As mensagens programadas que já passaram entram no chat (uma vez cada, pelo id), e contam as cobranças. */
export async function entregarVencidas(agora = Date.now()) {
  if (!aqui()) return 0;
  const EV = await import("./eva.js");
  const ev = EV.EV();
  if (!ev.desde || EV.ajustes().mensagens === false) return 0;
  let n = 0, HD = null;
  for (const p of planoGuardado()) {
    if (p.quando > agora || p.quando < agora - 20 * 3600e3 || ev.msgs[p.id] || p.quando < (Date.parse(ev.limpouEm || "") || 0)) continue;
    if (p.tipo === "humor") { // ele já registrou o humor do dia por outro caminho (as Músicas, o chip): não pergunta
      try { HD ||= await import("../humorDia/humorDia.js"); if (HD.humorDe(p.data).length) continue; } catch { continue; }
    }
    if (p.tipo === "musica" && (!p.musica || EV.ajustes().musica === false)) continue;
    EV.adicionar({ id: p.id, de: "eva", texto: p.texto, humor: p.humor, item: p.item, prog: p.slot, ...(p.modelo ? { modelo: p.modelo } : {}), ...(p.tipo ? { tipo: p.tipo } : {}), ...(p.musica ? { musica: p.musica } : {}), em: new Date(p.quando).toISOString() }, { salvarJa: false });
    if (p.item && p.nivel) EV.contarCobranca(p.data, p.item, p.nivel);
    n++;
  }
  if (n) EV.salvarEva();
  return n;
}
