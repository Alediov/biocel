// Gravação das aulas (pedido do Alediov, 26/10/2026; plano e decisões em docs/plano-gravacao.md): gravar agora e
// transcrever depois, no próprio celular. No Android, tudo passa pelo plugin nativo "Gravacao" (GravacaoPlugin.java:
// GravacaoService grava com a tela apagada; TranscricaoService transcreve com o whisper.cpp de madrugada, carregando).
// No navegador (testes no notebook), um motor web com o MediaRecorder do navegador e o IndexedDB `orbita-aulas` faz o
// mesmo papel para a gravação e para ouvir; transcrever, só no celular.
// O ÁUDIO NUNCA SAI DO APARELHO (vozes de colegas; a autorização dos professores é para o estudo dele): só o TEXTO da
// transcrição sobe para o repositório, em aulas/<disciplina>/<AAAA-MM-DD>-<id>.json, para a tarefa da madrugada.
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import { E, hojeISO } from "../estado.js";
import { escapar } from "../ui.js";

export const nativo = Capacitor.isNativePlatform();
const G = nativo ? registerPlugin("Gravacao") : null;

// ---------------------------------------------------------------- marcadores e disciplinas
export const MARCADORES = [
  { tipo: "prova", nome: "Cai na prova", icone: "🎯" },
  { tipo: "importante", nome: "Importante", icone: "📌" },
  { tipo: "duvida", nome: "Não entendi", icone: "❓" },
  { tipo: "exemplo", nome: "Exemplo/caso", icone: "💡" },
];
export const marcador = (tipo) => MARCADORES.find(m => m.tipo === tipo) || MARCADORES[1];

// conteudo/<chave>/ (definições e glossário dos livros) pelo nome da disciplina na Agenda
const CONTEUDOS = [
  [/anest/i, "anestesiologia"], [/patolog/i, "patologia"], [/farmaco/i, "farmacologia"],
  [/semiolog|radiolog|estomato/i, "estomatologia"], [/periodon|laperio/i, "periodontia"],
];
const slug = (s) => String(s || "aula").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "aula";
/** Chave da disciplina (pasta em aulas/ no repositório e em conteudo/). */
export function conteudoDe(nome) { const c = CONTEUDOS.find(([re]) => re.test(nome || "")); return c ? c[1] : slug(nome); }
/** Nome curto para a pasta e a tela ("Anestesiologia", "Semiologia"…): o curto da Agenda, sem as abreviações. */
export function nomeDisciplina(item) {
  const n = item?.nome || "Aula", c = item?.curto || "";
  if (/^anestesio$/i.test(c)) return "Anestesiologia";
  if (c && c.length >= 5 && !/\s/.test(c)) return c;
  return n.split(/ & | e /)[0].trim();
}

// ---------------------------------------------------------------- ajustes deste aparelho
const CFG_CHAVE = "orbita.gravacao";
export function cfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(CFG_CHAVE) || "{}"); } catch (e) { c = {}; }
  return { aviso: false, pararNoFim: true, folga: 15, ...c };
}
export function definirCfg(mudar) {
  const c = { ...cfg(), ...mudar };
  try { localStorage.setItem(CFG_CHAVE, JSON.stringify(c)); } catch (e) { /* sem armazenamento: vale até fechar */ }
  window.dispatchEvent(new Event("oq-lembretes")); // o aviso no começo das aulas entra ou sai das notificações
  return c;
}

// ---------------------------------------------------------------- eventos (nativo ou web)
const alvo = new EventTarget();
const emitir = (nome, dados) => alvo.dispatchEvent(new CustomEvent(nome, { detail: dados }));
/** gravacao | transcricao | modelo | audio | aulas → fn(dados). Devolve a função que desliga. */
export function ouvir(nome, fn) {
  const h = (e) => fn(e.detail);
  alvo.addEventListener(nome, h);
  return () => alvo.removeEventListener(nome, h);
}
let ligados = false;
function ligarNativo() {
  if (!G || ligados) return;
  ligados = true;
  for (const n of ["gravacao", "transcricao", "modelo", "audio"]) G.addListener(n, (d) => emitir(n, d));
}

// ---------------------------------------------------------------- motor web (navegador): IndexedDB + MediaRecorder
const BD = "orbita-aulas";
let bdP = null;
function bd() {
  return (bdP ||= new Promise((ok, erro) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("aulas", { keyPath: "id" }); d.createObjectStore("partes"); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  }));
}
async function op(loja, modo, fn) {
  const d = await bd();
  return new Promise((ok, erro) => {
    const tx = d.transaction(loja, modo), st = tx.objectStore(loja);
    const r = fn(st);
    tx.oncomplete = () => ok(r?.result);
    tx.onerror = () => erro(tx.error);
  });
}
const webAulas = () => op("aulas", "readonly", s => s.getAll()).then(l => l || []);
const webAula = (id) => op("aulas", "readonly", s => s.get(id));
const webGuardar = (a) => op("aulas", "readwrite", s => s.put(a));
const webParte = (id, nome) => op("partes", "readonly", s => s.get(`${id}|${nome}`));

const W = { rec: null, stream: null, aula: null, iniParte: 0, acumulado: 0, pausado: false, pedacos: [], nivel: 0, analisador: null, ctx: null, tique: null, pararEm: 0 };
const PARTE_MS = 10 * 60 * 1000;
const decorridoWeb = () => W.acumulado + (W.rec && !W.pausado ? performance.now() - W.iniParte : 0);
function estadoWeb() {
  if (!W.aula) return { gravando: false };
  return { gravando: true, id: W.aula.id, pausado: W.pausado, decorrido: decorridoWeb(), nivel: W.nivel, pararEm: W.pararEm, partes: W.aula.partes.length + (W.rec ? 1 : 0),
    disciplina: W.aula.disciplina, titulo: W.aula.titulo, marcadores: W.aula.marcadores, formato: "webm", fonte: "navegador" };
}
const hhmm = (d = new Date()) => d.toTimeString().slice(0, 5);
function comecarParteWeb() {
  const tipo = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || "";
  W.rec = new MediaRecorder(W.stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 24000 });
  W.pedacos = [];
  W.rec.ondataavailable = (e) => { if (e.data?.size) W.pedacos.push(e.data); };
  W.rec.start(5000);
  W.iniParte = performance.now();
}
async function fecharParteWeb() {
  const r = W.rec;
  if (!r) return;
  W.rec = null;
  const dur = performance.now() - W.iniParte;
  await new Promise(ok => { r.onstop = ok; try { r.stop(); } catch (e) { ok(); } });
  const blob = new Blob(W.pedacos, { type: r.mimeType || "audio/webm" });
  if (blob.size < 500) return;
  const ext = /ogg/.test(blob.type) ? "ogg" : "webm", nome = `parte-${String(W.aula.partes.length + 1).padStart(2, "0")}.${ext}`;
  await op("partes", "readwrite", s => s.put(blob, `${W.aula.id}|${nome}`));
  W.aula.partes.push({ nome, ini: Math.round(W.acumulado), dur: Math.round(dur), bytes: blob.size });
  W.acumulado += dur;
  W.aula.duracao = Math.round(W.acumulado);
  await webGuardar(W.aula);
}
async function iniciarWeb(d) {
  if (W.aula) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Este navegador não grava áudio.");
  W.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  const agora = new Date();
  const id = "a" + hojeISO(agora).replace(/-/g, "") + "-" + agora.toTimeString().slice(0, 8).replace(/:/g, "");
  W.aula = { id, disciplina: d.disciplina || "Aula", titulo: d.titulo || "", professor: d.professor || "", conteudo: d.conteudo || "", ocorrencia: d.ocorrencia || "", prompt: d.prompt || "",
    data: hojeISO(agora), inicio: hhmm(agora), criado: Date.now(), gravando: true, local: true, partes: [], marcadores: [], formato: "webm", fonte: "navegador",
    nomePasta: `${hojeISO(agora)} ${d.disciplina || "Aula"}`, transcricao: { situacao: "nao" } };
  W.acumulado = 0; W.pausado = false; W.pararEm = d.pararEm || 0;
  await webGuardar(W.aula);
  try {
    W.ctx = new AudioContext();
    W.analisador = W.ctx.createAnalyser();
    W.analisador.fftSize = 1024;
    W.ctx.createMediaStreamSource(W.stream).connect(W.analisador);
  } catch (e) { W.analisador = null; }
  comecarParteWeb();
  const buf = new Float32Array(1024);
  W.tique = setInterval(async () => {
    if (W.analisador && !W.pausado) { W.analisador.getFloatTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x)); W.nivel = Math.min(1, m * 1.6); }
    if (W.rec && !W.pausado && performance.now() - W.iniParte > PARTE_MS) { await fecharParteWeb(); comecarParteWeb(); }
    if (W.pararEm && Date.now() > W.pararEm) pararWeb("horario");
    emitir("gravacao", estadoWeb());
  }, 500);
  emitir("gravacao", estadoWeb());
}
async function pararWeb(motivo = "parada") {
  if (!W.aula) return;
  clearInterval(W.tique);
  if (!W.pausado) await fecharParteWeb();
  W.stream?.getTracks().forEach(t => t.stop());
  try { W.ctx?.close(); } catch (e) { /* nada */ }
  const a = W.aula;
  Object.assign(a, { gravando: false, fim: hhmm(), duracao: Math.round(W.acumulado), motivoFim: motivo });
  a.transcricao = { situacao: a.partes.length ? "nao" : "vazia" };
  if (a.partes.length) await webGuardar(a); else await op("aulas", "readwrite", s => s.delete(a.id));
  W.aula = null; W.rec = null; W.stream = null;
  emitir("gravacao", estadoWeb());
  emitir("aulas", null);
}
async function comandoWeb(acao, tipo) {
  if (!W.aula) throw new Error("nao_gravando");
  if (acao === "pausar" && !W.pausado) { await fecharParteWeb(); W.pausado = true; }
  else if (acao === "retomar" && W.pausado) { comecarParteWeb(); W.pausado = false; }
  else if (acao === "marcar") { W.aula.marcadores.push({ t: Math.round(decorridoWeb()), tipo: tipo || "importante", em: Date.now() }); await webGuardar(W.aula); }
  else if (acao === "parar") return pararWeb("parada");
  emitir("gravacao", estadoWeb());
}

// tocador web: as partes em sequência num <audio>
const T = { el: null, aula: null, k: -1, url: null, vel: 1, tique: null };
async function abrirWeb(t) {
  const ps = T.aula?.partes || [];
  if (!ps.length) return false;
  let k = ps.findIndex(p => t < p.ini + p.dur);
  if (k < 0) k = ps.length - 1;
  const blob = await webParte(T.aula.id, ps[k].nome);
  if (!blob) return false;
  if (T.url) URL.revokeObjectURL(T.url);
  T.url = URL.createObjectURL(blob);
  T.el ||= new Audio();
  T.el.src = T.url;
  T.el.playbackRate = T.vel;
  T.k = k;
  T.el.onended = () => { if (T.k + 1 < ps.length) abrirWeb(ps[T.k + 1].ini).then(() => T.el.play().catch(() => {})); else avisarWeb(true); };
  await new Promise(ok => { T.el.onloadedmetadata = ok; setTimeout(ok, 1500); });
  try { T.el.currentTime = Math.max(0, (t - ps[k].ini) / 1000); } catch (e) { /* nada */ }
  clearInterval(T.tique);
  T.tique = setInterval(() => avisarWeb(false), 500);
  return true;
}
const posWeb = () => (T.aula && T.k >= 0 ? T.aula.partes[T.k].ini + (T.el?.currentTime || 0) * 1000 : 0);
const avisarWeb = (fim) => emitir("audio", { id: T.aula?.id || null, t: posWeb(), dur: T.aula?.duracao || 0, tocando: !!T.el && !T.el.paused, fim });

// ---------------------------------------------------------------- API única (nativo ou web)
/** Estado de tudo: gravação, transcrição, motor, modelos, pasta, espaço. */
export async function situacao() {
  if (G) { ligarNativo(); return G.situacao(); }
  const aulas = await webAulas().catch(() => []);
  if (FALSO) return { ...FALSO.base, gravacao: estadoWeb(), transcricao: { ...FALSO.tr, agora: Date.now() },
    naFila: aulas.filter(a => ["fila", "andamento"].includes(a.transcricao?.situacao)).length };
  return { gravacao: estadoWeb(), transcricao: { rodando: false }, microfone: true, web: true,
    motor: { disponivel: false, erro: "Transcrever só no celular (o navegador não tem o motor)." }, modelos: [], ajustes: {}, pasta: "", pastaNome: "",
    usado: aulas.reduce((s, a) => s + (a.partes || []).reduce((x, p) => x + (p.bytes || 0), 0), 0), livre: -1, naFila: 0 };
}
/** Só a gravação (leve, para o medidor de nível da tela ao vivo). */
export async function estadoGravacao() { return G ? G.estadoGravacao() : estadoWeb(); }
export async function iniciar(dados) { if (G) { ligarNativo(); return G.iniciar(dados); } return iniciarWeb(dados); }
export async function comando(acao, tipo) { if (G) return G.comando({ acao, ...(tipo ? { tipo } : {}) }); return comandoWeb(acao, tipo); }
export async function listar() {
  const l = G ? (await G.listar()).aulas || [] : await webAulas();
  return l.sort((a, b) => (b.criado || 0) - (a.criado || 0));
}
export async function aula(id) { return (await listar()).find(a => a.id === id) || null; }
export async function atualizar(id, campos) {
  if (G) return G.atualizar({ id, ...campos });
  const a = await webAula(id); if (!a) return null;
  Object.assign(a, campos); await webGuardar(a); return a;
}
export async function apagar(id) {
  if (G) return G.apagar({ id });
  const a = await webAula(id);
  await op("aulas", "readwrite", s => s.delete(id));
  for (const p of a?.partes || []) await op("partes", "readwrite", s => s.delete(`${id}|${p.nome}`));
}
/** O texto (JSON) da transcrição ou null. */
export async function transcricao(id) {
  let txt;
  if (G) txt = (await G.transcricao({ id })).texto;
  else txt = (await webAula(id))?.transcricaoTexto;
  try { return txt ? JSON.parse(txt) : null; } catch (e) { return null; }
}
export const escolherPasta = () => G ? G.escolherPasta() : Promise.reject(new Error("Só no celular."));
export const procurarNaPasta = () => G ? G.procurarNaPasta() : Promise.resolve({ voltaram: 0 });
export const ajustesTranscricao = (a) => G ? G.ajustesTranscricao(a) : Promise.resolve(a);
export const baixarModelo = (id) => G ? (ligarNativo(), G.baixarModelo({ id })) : Promise.reject(new Error("Só no celular."));
export const cancelarDownload = () => G?.cancelarDownload();
export const apagarModelo = (id) => G?.apagarModelo({ id });
export const transcrever = (id) => G ? G.transcrever(id ? { id } : {}) : Promise.reject(new Error("Transcrever só no celular."));
export const pararTranscricao = () => G?.pararTranscricao();
export const testar = (id, segundos = 60) => G ? G.testar({ id, segundos }) : Promise.reject(new Error("Só no celular."));
export const semOtimizacao = () => G?.semOtimizacao();

/** Ouvir: abre a aula no instante `t` (ms) e toca. */
export async function tocar(id, t = 0, velocidade = 1) {
  if (G) { ligarNativo(); return G.tocar({ id, t: Math.round(t), velocidade }); }
  T.aula = await webAula(id); T.vel = velocidade;
  if (!(await abrirWeb(t))) throw new Error("Não consegui abrir o áudio desta aula.");
  await T.el.play().catch(() => {});
  avisarWeb(false);
}
/** pausar | continuar | ir (t) | velocidade (v) | parar */
export async function audio(acao, extra = {}) {
  if (G) return G.audio({ acao, ...extra });
  if (!T.el) return;
  if (acao === "pausar") T.el.pause();
  else if (acao === "continuar") await T.el.play().catch(() => {});
  else if (acao === "ir") { const tocava = !T.el.paused; await abrirWeb(extra.t); if (tocava) await T.el.play().catch(() => {}); }
  else if (acao === "velocidade") { T.vel = extra.velocidade; T.el.playbackRate = T.vel; }
  else if (acao === "parar") { T.el.pause(); clearInterval(T.tique); T.aula = null; }
  avisarWeb(false);
}

// ---------------------------------------------------------------- prompt com os termos da disciplina
// O Whisper aceita um "prompt inicial" (até ~224 tokens): com os termos técnicos da disciplina ele os escreve certo
// (articaína e não "arte caína"). Vêm de conteudo/<disciplina>/definicoes.json (termos em português) e do glossário.
const PROMPTS_CHAVE = "orbita.gravacao.prompts";
const termosCache = {};
async function termosDe(conteudo) {
  if (termosCache[conteudo]) return termosCache[conteudo];
  const ler = async (c) => {
    try { const D = await import("../dados.js"); const r = await D.baixarDoRepo(c); return r ? await r.json() : null; } catch (e) { return null; }
  };
  const defs = await ler(`conteudo/${conteudo}/definicoes.json`), glos = await ler(`conteudo/${conteudo}/glossario.json`);
  const out = [];
  for (const t of defs?.termos || []) if (t?.t) out.push(t.t);
  for (const [en, pt] of Object.entries(glos || {})) if (!en.startsWith("_") && typeof pt === "string" && pt.split(/\s+/).length <= 4 && pt.length >= 6) out.push(pt);
  return (termosCache[conteudo] = [...new Set(out.map(s => s.trim()).filter(Boolean))]);
}
const dobrar = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** "Aula de Anestesiologia (Odontologia). Tema: … Termos: a, b, c." com até ~650 caracteres. */
export async function promptDaAula(disciplina, conteudo, tema = "") {
  const termos = await termosDe(conteudo);
  let base = `Aula de ${disciplina} na faculdade de Odontologia, em português do Brasil.${tema ? ` Tema: ${tema}.` : ""}`;
  if (!termos.length) return base;
  // os termos que dividem palavras com o tema vêm primeiro; o resto na ordem do livro
  const pals = dobrar(tema).split(/\W+/).filter(p => p.length > 3);
  const nota = (t) => pals.reduce((s, p) => s + (dobrar(t).includes(p) ? 1 : 0), 0);
  const ordem = termos.map((t, i) => [t, nota(t), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(x => x[0]);
  const lista = [];
  let n = base.length + 10;
  for (const t of ordem) { if (n + t.length + 2 > 650) break; lista.push(t); n += t.length + 2; }
  return `${base} Termos: ${lista.join(", ")}.`;
}
/** Manda ao aparelho o prompt de cada disciplina (para as aulas gravadas sem prompt próprio). Uma vez por dia. */
async function enviarPrompts() {
  if (!G) return;
  let guard = {};
  try { guard = JSON.parse(localStorage.getItem(PROMPTS_CHAVE) || "{}"); } catch (e) { guard = {}; }
  if (guard.dia === hojeISO()) return;
  const prompts = {};
  for (const [, c] of CONTEUDOS) {
    const nome = c[0].toUpperCase() + c.slice(1);
    prompts[c] = await promptDaAula(nome, c);
  }
  await G.ajustesTranscricao({ prompts }).catch(() => {});
  try { localStorage.setItem(PROMPTS_CHAVE, JSON.stringify({ dia: hojeISO() })); } catch (e) { /* nada */ }
}

// ---------------------------------------------------------------- começar a gravar uma aula da Agenda
const emMs = (data, hm) => { const [h, m] = (hm || "00:00").split(":").map(Number); const d = new Date(data + "T00:00:00"); d.setHours(h, m, 0, 0); return +d; };
/** Dados para iniciar a gravação a partir de um evento da Agenda (ou de um nome solto). */
export async function dadosDaAula(ev, extra = {}) {
  const disciplina = extra.disciplina || nomeDisciplina(ev?.item);
  const conteudo = conteudoDe(ev?.item?.nome || disciplina);
  const titulo = extra.titulo ?? (ev?.tema || "");
  const c = cfg();
  return {
    disciplina, titulo, conteudo, professor: extra.professor || "",
    ocorrencia: ev?.chave || "",
    pararEm: ev && c.pararNoFim ? emMs(ev.data, ev.fim) + (c.folga || 15) * 60000 : 0,
    prompt: await promptDaAula(disciplina, conteudo, titulo).catch(() => ""),
  };
}

// ---------------------------------------------------------------- texto para o repositório
const enviando = { agora: false };
/** Sobe o TEXTO das transcrições prontas e ainda não enviadas (nunca o áudio). */
export async function enviarTranscricoes() {
  if (!G || enviando.agora || !E().config.token?.trim() || !navigator.onLine) return 0;
  enviando.agora = true;
  let n = 0;
  try {
    const D = await import("../dados.js");
    for (const a of await listar()) {
      const t = a.transcricao || {};
      if (t.situacao !== "feita" || t.enviada) continue;
      const txt = (await G.transcricao({ id: a.id })).texto;
      if (!txt) continue;
      const caminho = `aulas/${a.conteudo || conteudoDe(a.disciplina)}/${a.data}-${a.id}.json`;
      const atual = await D.lerArquivoRepo(caminho).catch(() => null);
      const r = await D.gravarArquivoRepo(caminho, txt, atual?.sha, `Transcrição da aula: ${a.disciplina} ${a.data}`);
      if (r?.conflito) continue;
      await G.marcarEnviada({ id: a.id, caminho });
      n++;
    }
  } catch (e) { console.warn("Gravação: envio das transcrições", e.message); }
  finally { enviando.agora = false; }
  if (n) emitir("aulas", null);
  return n;
}

// ---------------------------------------------------------------- aviso no começo das aulas (notificacoes.js)
/** Notificações "Gravar <disciplina>?" no começo das aulas presenciais dos próximos 7 dias (ids 4000+). Opção, desligada por padrão. */
export function lembretesGravacao(eventosDoDia, somaDias) {
  if (!nativo || !cfg().aviso) return [];
  const out = [], agora = Date.now();
  for (let i = 0; i < 7 && out.length < 40; i++) {
    const d = somaDias(hojeISO(), i);
    for (const ev of eventosDoDia(d)) {
      if (ev.item.tipo === "A" || ev.item.especial) continue; // atividades (CEO, HUOP…) não são aulas
      const q = emMs(d, ev.inicio);
      if (q <= agora) continue;
      const disc = nomeDisciplina(ev.item);
      out.push({ id: 4000 + out.length, title: `Gravar ${disc}? 🎤`, body: `Começa às ${ev.inicio}. Toque para gravar a aula (o celular pode ficar com a tela apagada).`,
        summaryText: "Gravação", actionTypeId: "gravar-aula", extra: { area: "gravar", chave: ev.chave, data: d }, schedule: { at: new Date(q), allowWhileIdle: true } });
    }
  }
  return out;
}
/** Toque na notificação "Gravar …?": começa a gravar a aula daquela ocorrência e abre a tela. */
export async function aoTocarNotificacao(a) {
  const x = a?.notification?.extra || {};
  try {
    const AG = await import("../agenda.js");
    const ev = AG.eventosDoDia(x.data || hojeISO()).find(e => e.chave === x.chave);
    // tocou depois do fim da aula (ou a aula sumiu da Agenda): só abre a tela
    if (ev && Date.now() < emMs(ev.data, ev.fim) && !(await estadoGravacao()).gravando) await iniciar(await dadosDaAula(ev));
  } catch (e) { console.warn("Gravação: notificação", e); }
  window.dispatchEvent(new CustomEvent("oq-ir", { detail: "aulas" }));
}

// ---------------------------------------------------------------- pílula da gravação (por cima de tudo)
let pilula = null;
const relogio = (ms) => { const s = Math.floor((ms || 0) / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`; };
export { relogio };
let base = { em: 0, ms: 0, pausado: true };
function desenharPilula(st) {
  if (!st?.gravando) { pilula?.remove(); pilula = null; return; }
  base = { em: performance.now(), ms: st.decorrido || 0, pausado: !!st.pausado };
  if (!pilula) {
    pilula = document.createElement("button");
    pilula.className = "grav-pilula";
    pilula.setAttribute("aria-label", "Gravação da aula em andamento");
    // fecha a Home e as outras áreas e abre "Aulas gravadas" nos Estudos (areas.js)
    pilula.onclick = () => import("../areas.js").then(m => m.irParaAulas()).catch(() => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "aulas" })));
    pilula.innerHTML = `<i class="gp-ponto"></i><b class="gp-t"></b><small class="gp-d"></small>`;
    document.body.append(pilula);
  }
  pilula.classList.toggle("pausada", !!st.pausado);
  pilula.querySelector(".gp-d").textContent = st.pausado ? "pausada" : (st.disciplina || "");
  pilula.querySelector(".gp-t").textContent = relogio(st.decorrido);
}
export const decorridoAgora = () => base.ms + (base.pausado ? 0 : performance.now() - base.em);
setInterval(() => { if (pilula && !base.pausado) pilula.querySelector(".gp-t").textContent = relogio(decorridoAgora()); }, 1000);

function cssGravacao() {
  if (typeof document === "undefined" || document.querySelector('link[href="gravacao.css"]')) return;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "gravacao.css"; document.head.append(l);
}
cssGravacao(); // já na abertura: o botão "Gravar aula" da Agenda e a pílula usam estes estilos

/** Chamado na abertura (main.js): eventos, pílula, prompts e o envio do texto das transcrições prontas. */
export async function iniciarGravacao() {
  cssGravacao();
  // botão "Gravar" na notificação do começo da aula (o toque no corpo faz o mesmo; areas.js → aoTocarNotificacao)
  if (nativo) try { await registerPlugin("LocalNotifications").registerActionTypes({ types: [{ id: "gravar-aula", actions: [{ id: "gravar", title: "Gravar" }] }] }); } catch (e) { /* app antigo */ }
  ouvir("gravacao", (st) => { desenharPilula(st); if (st && !st.gravando) emitir("aulas", null); if (st?.erro) import("../ui.js").then(u => u.toast(st.erro, 5000)); });
  ouvir("transcricao", (st) => { if (st && !st.rodando) { emitir("aulas", null); setTimeout(enviarTranscricoes, 2000); } });
  try { const s = await situacao(); desenharPilula(s.gravacao); } catch (e) { console.warn("Gravação:", e.message); }
  setTimeout(() => { enviarPrompts().catch(() => {}); enviarTranscricoes(); }, 25000);
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    try { desenharPilula((await situacao()).gravacao); } catch (e) { /* nada */ }
    setTimeout(enviarTranscricoes, 6000);
  });
}

// ---------------------------------------------------------------- para os testes (navegador): transcrição de mentira
// O navegador não transcreve; para o teste de fumaça (passo aulas-transcricao-eta), `transcricaoDeTeste` cria 3 aulas
// na fila e faz `situacao` responder como o celular no meio da transcrição (motor, modelo, amostras de velocidade e o
// estado do serviço); `eventoDeTeste` manda um evento "transcricao" como o TranscricaoService.
let FALSO = null;
export async function transcricaoDeTeste({ rodando = true, noite = true } = {}) {
  const MIN = 60000, agora = Date.now();
  const nova = async (id, disciplina, titulo, nPartes, criado, t) => {
    const partes = Array.from({ length: nPartes }, (_, k) => ({ nome: `parte-${String(k + 1).padStart(2, "0")}.ogg`, ini: k * 10 * MIN, dur: 10 * MIN, bytes: 1 }));
    await webGuardar({ id, disciplina, titulo, conteudo: conteudoDe(disciplina), data: hojeISO(new Date(criado)), inicio: "08:00", criado, duracao: nPartes * 10 * MIN,
      gravando: false, local: true, nomePasta: id, formato: "ogg", partes, marcadores: [], transcricao: t });
  };
  await nova("a-eta-1", "Anestesiologia", "Bloqueio do alveolar inferior", 6, agora - 2 * 3600e3, { situacao: "andamento", parte: 2, total: 6 });
  await nova("a-eta-2", "Patologia", "Cistos odontogênicos", 9, agora - 26 * 3600e3, { situacao: "fila" });
  await nova("a-eta-3", "Semiologia", "", 5, agora - 50 * 3600e3, { situacao: "fila" });
  FALSO = {
    base: { microfone: true, web: false, falso: true, motor: { disponivel: true, variante: "orbita_whisper_v82", threads: 4 },
      modelos: [{ id: "turbo", mb: 547, nome: "Large v3 Turbo (q5_0)", baixado: true }, { id: "small", mb: 181, nome: "Small (q5_1)", baixado: false }, { id: "vad", mb: 1, baixado: true }],
      ajustes: { modelo: "turbo", auto: true, hora: 22, vad: true }, pasta: "", pastaNome: "", usado: 0, livre: -1, carregando: true, semOtimizacao: true,
      velocidades: { "turbo|orbita_whisper_v82": [[600, 400, 1], [600, 380, 2], [600, 420, 3]] }, fator: 1.5, teste: { fator: 1.4, modelo: "turbo", audio: 60, gasto: 43 } },
    tr: rodando ? { rodando: true, id: "a-eta-1", fase: "Transcrevendo a parte 3 de 6", progresso: 0.4, parte: 2, partes: 6, parteProg: 0.4, etapa: "transcrevendo",
      durParte: 10 * MIN, depoisDaParte: 30 * MIN, feitoAula: 24 * MIN, totalAula: 60 * MIN, iniParte: agora - 160000, inicio: agora - 30 * MIN, fator: 1.5, noite, teste: false } : { rodando: false },
  };
  emitir("aulas", null);
}
export function eventoDeTeste(mudar) {
  if (!FALSO) return;
  FALSO.tr = { ...FALSO.tr, ...mudar };
  emitir("transcricao", { ...FALSO.tr, agora: Date.now() });
}
export async function semTranscricaoDeTeste() {
  FALSO = null;
  for (const id of ["a-eta-1", "a-eta-2", "a-eta-3"]) await op("aulas", "readwrite", s => s.delete(id)).catch(() => {});
  emitir("aulas", null);
}

// ---------------------------------------------------------------- para os testes (navegador): uma aula fictícia
/** Cria no navegador uma aula fictícia (2 s de silêncio, marcadores e transcrição) para o teste de fumaça. */
export async function aulaDeTeste() {
  const taxa = 8000, n = taxa * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); txt(8, "WAVE"); txt(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, "data"); v.setUint32(40, n * 2, true);
  const id = "a-teste-" + Date.now().toString(36);
  await op("partes", "readwrite", s => s.put(new Blob([buf], { type: "audio/wav" }), `${id}|parte-01.wav`));
  const tr = { versao: 1, id, disciplina: "Anestesiologia", data: hojeISO(), duracao: 2, modelo: "teste", marcadores: [{ t: 0.5, tipo: "prova" }],
    segmentos: [[0, 0.9, "Hoje a gente vai ver a técnica do nervo alveolar inferior."], [0.9, 2, "Isso cai na prova: a aspiração antes de injetar."]] };
  await webGuardar({ id, disciplina: "Anestesiologia", titulo: "Alveolar inferior (teste)", conteudo: "anestesiologia", data: hojeISO(), inicio: "16:10", fim: "18:40", criado: Date.now(),
    duracao: 2000, gravando: false, local: true, nomePasta: `${hojeISO()} Anestesiologia`, formato: "wav", partes: [{ nome: "parte-01.wav", ini: 0, dur: 2000, bytes: buf.byteLength }],
    marcadores: [{ t: 500, tipo: "prova" }, { t: 1500, tipo: "duvida" }], transcricao: { situacao: "feita", modelo: "teste", segmentos: 2 }, transcricaoTexto: JSON.stringify(tr) });
  return id;
}
export { escapar };
