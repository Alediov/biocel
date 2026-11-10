// Estado local do jogador: XP, moedas, ofensiva, revisão espaçada, configurações.
import { DEMO } from "./edicao.js";
const CHAVE = "oq.estado.v1";

export function hojeISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function somaDias(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return hojeISO(d);
}
export function difDias(a, b) { // b - a em dias
  return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
}

const PADRAO = () => ({
  xp: 0,
  moedas: 0,
  ofensiva: { atual: 0, recorde: 0, ultimoDia: null, congelamentos: 0, usados: [] },
  diario: {},          // { "2026-10-18": { xp, licoes: [] } }
  concluidas: {},      // { licaoId: { acertos, total, quando, xp } }
  respostas: {},       // { "2026-10-18": [ {id, conceito, acertou, tentativa, licao, quando, ms} ] }
  srs: {},             // { exercicioId: { caixa, proxima, acertos, erros, conceito, ultima } }
  reportes: [],        // [ {id, motivo, quando, data} ]
  sujos: [],           // datas com progresso ainda não enviado
  loja: { comprados: [], equipado: { chapeu: null, rosto: null, cor: "padrao" } },
  config: { som: true, musica: false, vibrar: true, tema: "auto", token: "", repo: "", meta: 15, lembretes: true },
  ultimaSync: null,
  criadoEm: hojeISO(),
  // vida acadêmica (agenda, avaliações, currículo): preenchidos na primeira abertura
  agenda: null,
  avaliacoes: [],
  curriculo: null,
  vidaSuja: false,
  extratos: [],        // últimos ganhos de XP fora das lições [{quando, xp, moedas, motivo}]
});

let estado = carregar();
let multiplicador = () => 1;
/** Função que devolve o multiplicador de XP atual (poções). Definida por main.js. */
export function definirMultiplicador(fn) { multiplicador = fn; }
let ajustes = { ganho: () => 1, moedasLicao: () => 1, chanceGema: () => 0 };
/** Bônus de carta e título (definidos por main.js para evitar dependência circular). */
export function definirAjustes(a) { ajustes = { ...ajustes, ...a }; }
function st() {
  if (!estado.stats) {
    // primeira vez: reconstrói a partir do histórico que já existe no celular
    const resp = Object.values(estado.respostas || {}).flat().filter(r => r.tentativa === 1);
    const lic = Object.entries(estado.concluidas || {}).filter(([k]) => !k.startsWith("treino")).map(([, v]) => v);
    const hora = (v) => (v.quando ? new Date(v.quando).getHours() : 12);
    estado.stats = { exercicios: resp.length, licoes: lic.length, perfeitas: lic.filter(v => v.perfeita).length, madrugador: lic.filter(v => hora(v) < 8).length, coruja: lic.filter(v => hora(v) >= 18).length, tarde: 0, pocoes: 0, notaMax: 0 };
  }
  return estado.stats;
}
export const estatisticas = st;
export function contar(chave, n = 1) { st()[chave] = (st()[chave] || 0) + n; salvar(); }

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return mesclar(PADRAO(), JSON.parse(bruto));
  } catch (e) { /* armazenamento indisponível: segue com padrão */ }
  return PADRAO();
}
function mesclar(base, salvo) {
  for (const k of Object.keys(salvo)) {
    if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) && salvo[k] && typeof salvo[k] === "object" && !Array.isArray(salvo[k])) {
      base[k] = mesclar(base[k], salvo[k]);
    } else base[k] = salvo[k];
  }
  return base;
}
let aoSalvar = null;
/** Chamado depois de cada gravação (sincronização entre aparelhos, sincronia.js). */
export function definirAoSalvar(fn) { aoSalvar = fn; }
export function salvar() {
  estado._mod = Date.now(); // quando este aparelho mudou o progresso pela última vez (desempate na sincronização)
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* cheio ou bloqueado */ }
  try { aoSalvar?.(); } catch (e) { /* sem sincronização */ }
}
export function E() { return estado; }
export function substituirEstado(novo) { estado = mesclar(PADRAO(), novo); salvar(); }

// ---------- níveis ----------
// Um nome por nível. Depois do último, ele ganha numeração romana (Mito de Cascavel II, III…).
export const NOMES_NIVEL = ["Calouro", "Pré-clínico", "Clínico", "Monitor", "Plantonista", "Residente", "Especialista", "Mestre", "Doutor", "Professor titular",
  "Lenda do Malamed", "Guardião do Trigêmeo", "Mestre do Alveolar Inferior", "Detetive do Neville", "Mago da Receita", "Domador de Cistos", "Arquiteto do Sorriso",
  "Cirurgião de Ouro", "Reitor Honorário", "Patrono da Odontologia", "Imortal da Academia", "Sábio de Piracicaba", "Oráculo das Lâminas", "Titã do Esmalte",
  "Imperador da Dentina", "Lorde do Periodonto", "Arquimago da Anestesia", "Colosso da Odontologia", "Semideus do Siso", "Lenda Viva da UNIOESTE",
  "Constelação Odontológica", "Cometa do CEO", "Galáxia do Conhecimento", "Supernova Clínica", "Buraco Negro de Livros", "Entidade Cósmica do Malamed",
  "Domador do Dragão Sisorath", "Destronador do Rei Gosma", "Nobel da Odontologia", "Mito de Cascavel"];
const romano = (n) => [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, "");
export function nomeNivel(n) {
  if (n <= NOMES_NIVEL.length) return NOMES_NIVEL[n - 1];
  return `${NOMES_NIVEL.at(-1)} ${romano(n - NOMES_NIVEL.length + 1)}`;
}
// Custo de cada nível: +25% por nível até o 13 (o Alediov já estava lá em 21/10/2026, a conta antiga vale até ali) e,
// a partir dele, +250 XP por nível, para os níveis continuarem chegando (o 50 fica perto de 260 mil XP).
export function nivel(xp = estado.xp) {
  let n = 1, custo = 150, acumulado = 0;
  while (xp >= acumulado + custo) { acumulado += custo; n++; custo = n <= 13 ? Math.round(custo * 1.25) : custo + 250; }
  return { n, titulo: nomeNivel(n), noNivel: xp - acumulado, custo };
}

// ---------- ofensiva ----------
export function atualizarOfensivaAoAbrir() {
  const o = estado.ofensiva, hoje = hojeISO();
  if (!o.ultimoDia) return { perdeu: false, usou: 0 };
  const falta = difDias(o.ultimoDia, hoje) - 1; // dias inteiros sem estudar
  if (falta <= 0) return { perdeu: false, usou: 0 };
  if (o.congelamentos >= falta) {
    o.congelamentos -= falta;
    for (let i = 1; i <= falta; i++) o.usados.push(somaDias(o.ultimoDia, i));
    o.ultimoDia = somaDias(hoje, -1);
    salvar();
    return { perdeu: false, usou: falta };
  }
  const anterior = o.atual;
  if (anterior > 0) (o.quebras ||= []).push(somaDias(o.ultimoDia, 1)); // para o calendário da ofensiva
  if (anterior > 1) o.perdida = { valor: anterior, em: hoje, desde: o.ultimoDia }; // dá para consertar na loja por 3 dias
  o.atual = 0; o.ultimoDia = null; salvar();
  return { perdeu: anterior > 0, usou: 0, anterior };
}
export function registrarDiaEstudado() {
  const o = estado.ofensiva, hoje = hojeISO();
  if (o.ultimoDia === hoje) return false;
  o.atual += 1; o.ultimoDia = hoje;
  o.recorde = Math.max(o.recorde, o.atual);
  if (o.atual % 7 === 0 && o.congelamentos < 2) o.congelamentos += 1;
  const marcos = { 7: 5, 14: 5, 30: 10, 50: 15, 100: 30, 200: 50, 365: 100 };
  if (marcos[o.atual]) { estado.gemas = (estado.gemas || 0) + marcos[o.atual]; o.gemasMarco = marcos[o.atual]; } else o.gemasMarco = 0;
  salvar();
  return true; // primeira lição do dia: celebrar
}
/** Reparo de ofensiva (loja): a ofensiva perdida há até 3 dias volta, somada à de agora. */
export function ofensivaReparavel() {
  const p = estado.ofensiva.perdida;
  return p && difDias(p.em, hojeISO()) <= 2 ? p.valor : 0;
}
export function repararOfensiva() {
  const o = estado.ofensiva, v = ofensivaReparavel();
  if (!v) return false;
  const p = o.perdida;
  if (p.desde) { // os dias sem estudo entre a quebra e hoje viram "reparados" no calendário
    o.reparados ||= [];
    for (let d = somaDias(p.desde, 1); d < hojeISO(); d = somaDias(d, 1)) if (!o.reparados.includes(d)) o.reparados.push(d);
    o.quebras = (o.quebras || []).filter(d => d !== somaDias(p.desde, 1));
  }
  if (o.ultimoDia === hojeISO()) o.atual += v; // já estudou hoje: soma
  else { o.atual = v; o.ultimoDia = somaDias(hojeISO(), -1); } // estudando hoje, continua
  o.recorde = Math.max(o.recorde, o.atual);
  o.perdida = null; salvar();
  return true;
}
export function ofensivaAtiva() { return estado.ofensiva.ultimoDia === hojeISO(); }

// ---------- revisão espaçada (Leitner) ----------
const INTERVALOS = [1, 1, 3, 7, 14, 30];
export function registrarResposta(ex, licaoId, acertou, tentativa, ms) {
  const hoje = hojeISO();
  (estado.respostas[hoje] ||= []).push({ id: ex.id, conceito: ex.conceito, acertou, tentativa, licao: licaoId, quando: new Date().toISOString(), ms });
  if (tentativa === 1) {
    st().exercicios++;
    const s = estado.srs[ex.id] ||= { caixa: 0, proxima: hoje, acertos: 0, erros: 0, conceito: ex.conceito };
    if (acertou) { s.caixa = Math.min(s.caixa + 1, INTERVALOS.length - 1); s.acertos++; }
    else { s.caixa = 0; s.erros++; }
    s.proxima = somaDias(hoje, INTERVALOS[s.caixa]);
    s.ultima = hoje;
  }
  marcarSujo(hoje);
}
export function devidosHoje() {
  const hoje = hojeISO();
  return Object.entries(estado.srs).filter(([, s]) => s.proxima <= hoje).sort((a, b) => (b[1].erros - a[1].erros) || (a[1].caixa - b[1].caixa)).map(([id]) => id);
}
export function marcarSujo(data) { if (!estado.sujos.includes(data)) estado.sujos.push(data); }

// ---------- recompensas ----------
export function concluirLicao(licaoId, resumo) {
  const hoje = hojeISO();
  const d = estado.diario[hoje] ||= { xp: 0, licoes: [] };
  const primeiraVez = !estado.concluidas[licaoId];
  estado.concluidas[licaoId] = { ...resumo, quando: new Date().toISOString() };
  if (!d.licoes.includes(licaoId)) d.licoes.push(licaoId);
  d.xp += resumo.xp;
  estado.xp += resumo.xp;
  const moedas = Math.round(((primeiraVez ? 5 : 2) + (resumo.perfeita ? 5 : 0)) * ajustes.moedasLicao());
  estado.moedas += moedas;
  const gemaSorte = (resumo.perfeita && primeiraVez && Math.random() < 0.08) || Math.random() < ajustes.chanceGema() ? 1 : 0;
  const h = new Date().getHours(), s0 = st();
  s0.licoes++; if (resumo.perfeita) s0.perfeitas++;
  if (h < 8) s0.madrugador++;
  if (h >= 18) s0.coruja++;
  if (resumo.periodo === "tarde") s0.tarde++;
  estado.gemas = (estado.gemas || 0) + gemaSorte;
  let bauMeta = false;
  if (d.licoes.length >= metaDoDia(hoje) && !d.bau) { d.bau = true; estado.moedas += 20; bauMeta = true; }
  const novoDia = registrarDiaEstudado();
  marcarSujo(hoje);
  salvar();
  return { moedas: moedas + (bauMeta ? 20 : 0), novoDia, bauMeta, gemaSorte };
}
// ---------- tamanho do dia (tamanhoDia.js calcula pela Agenda; aqui só a leitura, sem dependências) ----------
// (pedido do Alediov, 29/10/2026: "a carga horária está muito mal distribuída… usar de base o tempo conforme a agenda")
// E().diasPlano[data] = { tam: "corrido" | "normal" | "livre", livre, min, em } (automático, para 14 dias; o gerador lê);
// E().diasEscolha[data] = { tam, em } (o que ele escolheu no Meu dia, vale por cima do automático).
export const TAMANHOS = { corrido: { nome: "Dia corrido", curto: "Corrido", min: 60, meta: 6 }, normal: { nome: "Dia normal", curto: "Normal", min: 105, meta: 9 }, livre: { nome: "Dia livre", curto: "Livre", min: 165, meta: 12 } };
// (a meta automática acompanha o que o gerador faz: 2, 3 ou 4 lições por sessão de aula)
/** A partir de quando o tamanho do dia muda o que entra (antes, os dias ficam como eram). */
export const INICIO_TAMANHO = "2026-10-30";
/** "corrido" | "normal" | "livre" (sem plano: "normal"). */
export function tamanhoDe(data = hojeISO()) {
  const t = estado.diasEscolha?.[data]?.tam || estado.diasPlano?.[data]?.tam;
  return TAMANHOS[t] ? t : "normal";
}
/** A meta de lições do dia: pelo tamanho do dia (meta automática, o padrão) ou a fixa (config.meta). */
export function metaDoDia(data = hojeISO()) {
  if (DEMO || estado.config.metaAuto === false || data < INICIO_TAMANHO) return estado.config.meta || 15;
  return TAMANHOS[tamanhoDe(data)].meta;
}
/** A meta de leitura do dia (unidades): no dia corrido, 1 (a Leitura vira bônus). */
export function metaLeituraDe(data = hojeISO(), base = estado.leitura?.metaUn || 2) {
  return !DEMO && data >= INICIO_TAMANHO && tamanhoDe(data) === "corrido" ? Math.min(base, 1) : base;
}
/** Recompensa fora das lições (presença, avaliações, currículo). */
export function ganhar(xp, moedas, motivo, categoria = "") {
  const hoje = hojeISO();
  if (xp > 0) xp = Math.round(xp * multiplicador() * ajustes.ganho(categoria));
  const d = estado.diario[hoje] ||= { xp: 0, licoes: [] };
  d.xp += xp; estado.xp += xp; estado.moedas = Math.max(0, estado.moedas + moedas); // desfazer uma presença não deixa o saldo negativo
  estado.extratos.unshift({ quando: new Date().toISOString(), xp, moedas, motivo });
  estado.extratos = estado.extratos.slice(0, 60);
  estado.vidaSuja = true;
  salvar();
  return xp;
}
export function marcarVidaSuja() { estado.vidaSuja = true; salvar(); }

export function reportar(id, motivo) {
  estado.reportes.push({ id, motivo, quando: new Date().toISOString(), data: hojeISO() });
  marcarSujo(hojeISO());
  salvar();
}
