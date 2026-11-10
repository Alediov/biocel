// Avisos do WhatsApp (pedido do Alediov, 04/11/2026: ele perde mudanças de horário e recados que aparecem nos grupos):
// as regras, sem dependências, para dar para testar no node (tools/teste_whatsapp.mjs). O WhatsApp não tem API para
// conta pessoal e os clientes não oficiais arriscam o banimento; por isso o app lê só as NOTIFICAÇÕES do WhatsApp
// (WhatsAvisosService, um NotificationListenerService). Aqui: o nome do grupo normalizado (o mesmo do Java,
// WhatsAvisos.normalizar), o modo de cada grupo (Sempre, Triagem ou Ignorar; os padrões que ele pediu), a triagem
// (menção, data ou hora, palavras; o grupo do Ping-Pong com as palavras dele), a chave contra repetição (o WhatsApp
// publica de novo as mesmas mensagens não lidas), o remetente sem número de telefone e a data e a hora de um recado
// para "Pôr na Agenda".

/** Sem emojis, acentos, maiúsculas nem pontuação: "CEO Terça-feira Prof. Álvaro Garbin" → "ceo terca feira prof alvaro garbin". */
export const normalizar = (s) => String(s || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Sem acentos e em minúsculas, mas com a pontuação (para 14:30 e 18/11). */
const leve = (s) => String(s || "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ");

export const MODOS = { sempre: "Sempre", triagem: "Triagem", ignorar: "Ignorar" };

// os grupos que ele listou (04/11/2026). `prefixo`: vale para o grupo cujo nome começa assim (o do Ping-Pong veio com "…")
export const PADROES = [
  ...["AVISOS TURMA XXIX", "CEO Terça-feira Prof. Álvaro Garbin", "Alunos ODONTO HOSPITALAR 2026", "Extensão UTI", "LAPERIO - ligantes", "PIBIC - Geoscience"]
    .map(nome => ({ nome, modo: "sempre" })),
  ...["ODONTO TURMA XXIX", "Odonto unioeste 2.0", "Núcleo GeoScience", "Monitoria de BioCel", "Monitoria de Fisiologia", "Monitoria de patologia",
    "Monitoria de Oclusão", "Monitoria de Farmacologia", "Monitoria de Anestesiologia e Biossegurança"].map(nome => ({ nome, modo: "triagem" })),
  { nome: "Ping Pong (99, Arq, Mercado Pago…)", modo: "triagem", prefixo: "ping pong" },
];

/** O modo padrão de um grupo pelo nome (null = não está na lista: fica de fora até ele escolher). */
export function modoPadrao(nome) {
  const k = normalizar(nome);
  for (const p of PADROES) if (normalizar(p.nome) === k || (p.prefixo && (k === p.prefixo || k.startsWith(p.prefixo + " ")))) return p.modo;
  return null;
}
/** O modo valendo: o que ele escolheu (`grupos[chave].modo`) ou o padrão; sem nenhum dos dois, "ignorar" (`escolhido`: false). */
export function modoDe(nome, grupos = {}) {
  const g = grupos[normalizar(nome)];
  if (g?.modo && MODOS[g.modo]) return { modo: g.modo, escolhido: true };
  const p = modoPadrao(nome);
  return { modo: p || "ignorar", escolhido: false, padrao: !!p };
}
/** O que vai ao serviço nativo: `grupos` {chave: modo} (padrões + escolhas) e `prefixos` {prefixo: modo}. */
export function configNativa(grupos = {}) {
  const g = {}, pre = {};
  for (const p of PADROES) { if (p.prefixo) pre[p.prefixo] = p.modo; else g[normalizar(p.nome)] = p.modo; }
  for (const [k, v] of Object.entries(grupos)) if (v?.modo && MODOS[v.modo]) g[k] = v.modo;
  // uma escolha dele por cima de um prefixo vale (o grupo exato vem antes do prefixo no Java também)
  return { grupos: g, prefixos: pre };
}
/** O modo que o serviço usa ao receber (o mesmo do WhatsAvisos.modoDe, no Java). */
export function modoNativo(nome, cfg) {
  const k = normalizar(nome);
  if (cfg?.grupos?.[k]) return cfg.grupos[k];
  for (const [p, m] of Object.entries(cfg?.prefixos || {})) if (k === p || k.startsWith(p + " ")) return m;
  return "ignorar";
}
export const guardaMensagens = (modo) => modo === "sempre" || modo === "triagem";

// ---------------------------------------------------------------- privacidade
// número de telefone: + e dígitos, ou 8 dígitos ou mais com espaços, traços, pontos e parênteses no meio
const TELEFONE = /\+?\(?\d[\d\s().-]{6,}\d/g;
const ehTelefone = (s) => (s.match(/\d/g) || []).length >= 8;
/** Tira números de telefone do texto (o Java faz o mesmo antes de guardar). */
export const semTelefone = (t) => String(t || "").replace(TELEFONE, (m) => (ehTelefone(m) ? "[telefone]" : m));
/** O remetente sem o número: "+55 45 9999-9999" → "contato"; "+55 45 9999-9999 ~Fulano" → "~Fulano". */
export function remetente(de) {
  const s = String(de || "").replace(TELEFONE, (m) => (ehTelefone(m) ? " " : m)).replace(/\s+/g, " ").trim();
  return s && s !== "~" && /[\p{L}\p{N}]/u.test(s) ? s : "contato";
}

// ---------------------------------------------------------------- repetição
/** A chave de uma mensagem: grupo + remetente + texto + horário (o WhatsApp publica de novo as não lidas, iguais). */
export const chave = (m) => `${normalizar(m.grupo)}|${m.de}|${m.texto}|${m.quando}`;
/** Tira as repetidas (fica a primeira). */
export function deduplicar(lista) {
  const vistas = new Set(), out = [];
  for (const m of lista) { const k = chave(m); if (vistas.has(k)) continue; vistas.add(k); out.push(m); }
  return out;
}

// ---------------------------------------------------------------- triagem
const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DATA_HORA = [
  /\b(hoje|amanha|depois de amanha|semana que vem|proxima semana)\b/,
  new RegExp(`\\b(${DIAS_SEMANA.join("|")})([\\s-]*feira)?\\b`),
  /\b\d{1,2}\s*h(\s*\d{2})?\b/,                        // 14h, 14h30, 14 h
  /\b\d{1,2}:\d{2}\b/,                                  // 14:30
  /\b\d{1,2}\s*horas?\b/,                               // 14 horas
  /\bdia \d{1,2}\b/,                                    // dia 12
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,                   // 12/11, 12/11/2026
];
// palavras (sem acento; o começo da palavra, `*` = qualquer final)
const PALAVRAS = ["cancelad*", "adiad*", "mud*", "remarc*", "sala", "salas", "prova*", "trabalho*", "entrega*", "prazo*", "trazer", "tragam", "levar", "levem",
  "obrigatori*", "reuniao", "reunioes", "plantao", "plantoes", "escala*", "atendimento*", "falta", "faltas", "presenca*", "nota", "notas", "certificado*",
  "inscric*", "horario*", "monitoria*", "aula", "aulas", "avaliac*", "seminario*", "gabarito*", "resultado*"];
// o grupo do Ping-Pong mexe com as automações do dinheiro dele (financas/macros): as palavras dele, e só elas
const PALAVRAS_PP = ["mudou", "mudanca*", "mudar*", "atualiz*", "app", "apps", "aplicativo*", "corte*", "horario*", "taxa*", "rendimento*", "render", "99",
  "mp", "mercado pago", "astropay", "ast", "arq", "dolarapp", "dolar app", "bloque*", "devolu*", "limite*", "pix"];
const regexPalavras = (l) => new RegExp(`(?:^|[^a-z0-9])(${l.map(p => p.replace(/\*$/, "[a-z]*").replace(/ /g, "\\s+")).join("|")})(?![a-z0-9])`);
const RE_PALAVRAS = regexPalavras(PALAVRAS), RE_PP = regexPalavras(PALAVRAS_PP);

/** O grupo do Ping-Pong (pelo nome)? */
export const ehPingPong = (grupo) => normalizar(grupo).startsWith("ping pong");

/** Menciona ele? "@Alediov", o nome dele, "@Você" (como o WhatsApp mostra a menção a quem lê). */
export function mencao(texto, nomes = ["Alediov"]) {
  const t = normalizar(texto);
  if (/@\s*(voce|you)(?![a-z0-9])/.test(leve(texto))) return true;
  return nomes.map(normalizar).filter(Boolean).some(n => new RegExp(`(^| )${n}( |$)`).test(t));
}

/** Por que a mensagem passa: "sempre", "menção", "data: amanhã", "palavra: prova"… ou null (fica de fora).
 *  `de` = remetente; `admin` = o remetente é admin do grupo (a notificação não diz; fica para quando der para saber). */
export function triar(m, modo, { nomes = ["Alediov"], admin = false } = {}) {
  if (modo === "sempre") return "sempre";
  if (modo !== "triagem") return null;
  const texto = String(m.texto || "");
  if (mencao(texto, nomes)) return "menção";
  if (admin) return "admin";
  const t = leve(texto);
  if (ehPingPong(m.grupo)) { const x = t.match(RE_PP); return x ? `palavra: ${x[1]}` : null; }
  for (const re of DATA_HORA) { const x = t.match(re); if (x) return `data: ${x[0].trim()}`; }
  const x = t.match(RE_PALAVRAS);
  return x ? `palavra: ${x[1]}` : null;
}

// ---------------------------------------------------------------- data e hora de um recado (Pôr na Agenda)
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
/** A data (AAAA-MM-DD) e os horários que o recado cita, contados a partir de quando ele chegou (`quando`, ms). */
export function extrairQuando(texto, quando = Date.now()) {
  const t = leve(texto), base = new Date(quando);
  base.setHours(12, 0, 0, 0);
  const mais = (n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
  let data = null, x;
  if ((x = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)) && +x[2] >= 1 && +x[2] <= 12 && +x[1] >= 1 && +x[1] <= 31) {
    let ano = x[3] ? +x[3] : base.getFullYear();
    if (ano < 100) ano += 2000;
    let d = new Date(ano, +x[2] - 1, +x[1], 12);
    if (!x[3] && d - base < -60 * 864e5) d = new Date(ano + 1, +x[2] - 1, +x[1], 12); // "10/01" dito em novembro: o ano que vem
    data = iso(d);
  } else if (/\bdepois de amanha\b/.test(t)) data = iso(mais(2));
  else if (/\bamanha\b/.test(t)) data = iso(mais(1));
  else if (/\bhoje\b/.test(t)) data = iso(base);
  else if ((x = t.match(new RegExp(`\\b(${DIAS_SEMANA.join("|")})\\b`)))) {
    const alvo = DIAS_SEMANA.indexOf(x[1]);
    data = iso(mais((alvo - base.getDay() + 7) % 7)); // o próprio dia, se é hoje; senão o próximo
  } else if ((x = t.match(/\bdia (\d{1,2})\b/)) && +x[1] >= 1 && +x[1] <= 31) {
    let d = new Date(base.getFullYear(), base.getMonth(), +x[1], 12);
    if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, +x[1], 12);
    data = iso(d);
  }
  // horários: 14h30, 14h, 14:30, "14 horas"; o 2º é o fim ("das 14h às 16h")
  const horas = [];
  for (const h of t.matchAll(/\b(\d{1,2})(?:\s*h\s*(\d{2})?\b|:(\d{2})\b|\s*horas?\b)/g)) {
    const hh = +h[1], mm = +(h[2] || h[3] || 0);
    if (hh <= 23 && mm <= 59) horas.push(hhmm(hh, mm));
  }
  const inicio = horas[0] || null;
  let fim = horas[1] && horas[1] > inicio ? horas[1] : null;
  if (inicio && !fim) { const [a, b] = inicio.split(":").map(Number); fim = hhmm(Math.min(23, a + 1), a + 1 > 23 ? 59 : b); }
  return { data, inicio, fim };
}

/** Um nome curto para o compromisso: a 1ª frase do recado, até ~60 letras. */
export function nomeCurto(texto) {
  const t = String(texto || "").replace(/\s+/g, " ").trim(), frase = t.split(/(?<=[.!?])\s/)[0] || t;
  return frase.length > 60 ? frase.slice(0, 57).replace(/\s+\S*$/, "") + "…" : frase;
}

// ---------------------------------------------------------------- a notificação sem MessagingStyle (o Java faz igual)
/** "AVISOS TURMA XXIX (3 mensagens)" → "AVISOS TURMA XXIX"; também "(2 messages)" e "· 4 novas mensagens". */
export const limparTitulo = (t) => String(t || "").replace(/\s*[(:·-]?\s*\d+\s+(novas\s+)?(mensage(m|ns)|messages?)\)?\s*$/i, "").trim();
/** A notificação de resumo ("5 mensagens de 2 conversas", título "WhatsApp")? Não tem mensagem: fica de fora. */
export const ehResumo = (titulo, texto) => /^whatsapp( business)?$/i.test(String(titulo || "").trim()) || /^\d+\s+(novas\s+)?(mensage(m|ns)|messages?)\s+(de|from)\s+\d+\s+(conversas?|chats?)/i.test(String(texto || "").trim());
/** Lê { grupo, de, texto } das linhas de uma notificação antiga: título "Fulano @ Grupo" ou "Grupo", texto "Fulano: msg". */
export function lerSimples({ titulo, texto, linhas = [] }) {
  if (ehResumo(titulo, texto)) return [];
  let grupo = limparTitulo(titulo), deTitulo = null;
  const arroba = grupo.indexOf(" @ ");
  if (arroba > 0) { deTitulo = grupo.slice(0, arroba).trim(); grupo = grupo.slice(arroba + 3).trim(); }
  const out = [];
  for (const l of (linhas.length ? linhas : [texto])) {
    let s = String(l || "").trim(), de = deTitulo;
    if (!s) continue;
    // nas linhas de uma notificação com várias conversas: "Fulano @ Grupo: msg"
    const m = s.match(/^(.{1,60}?) @ (.{1,80}?): ([\s\S]+)$/);
    if (m) { if (normalizar(limparTitulo(m[2])) !== normalizar(grupo)) continue; de = m[1]; s = m[3]; }
    else if (!de) { const c = s.match(/^([^:\n]{1,60}): ([\s\S]+)$/); if (!c) continue; de = c[1]; s = c[2]; }
    out.push({ grupo, de: de.trim(), texto: s.trim() });
  }
  return out;
}

// ---------------------------------------------------------------- o que o serviço guarda (o Java faz igual)
const DIA = 864e5;
export const RETENCAO_DIAS = 30;
/** Junta as mensagens novas ao que está guardado: só dos grupos Sempre/Triagem, sem telefone, sem repetidas e só dos
 *  últimos 30 dias. `guardadas` é mudada no lugar; devolve as que entraram. `grupos` (vistos) ganha o nome e a hora. */
export function guardar(guardadas, novas, cfg, { agora = Date.now(), grupos = null } = {}) {
  const chaves = new Set(guardadas.map(chave)), entraram = [];
  let rec = guardadas.reduce((m, x) => Math.max(m, x.rec || 0), 0);
  for (const n of novas) {
    if (!n?.grupo || !n.texto) continue;
    const k0 = normalizar(n.grupo);
    if (grupos) grupos[k0] = { nome: limparTitulo(n.grupo), ultima: agora };
    if (!guardaMensagens(modoNativo(n.grupo, cfg))) continue;
    const m = { grupo: limparTitulo(n.grupo), de: remetente(n.de), texto: semTelefone(n.texto).slice(0, 4000), quando: n.quando || agora };
    if (m.quando < agora - RETENCAO_DIAS * DIA) continue;
    const k = chave(m);
    if (chaves.has(k)) continue;
    chaves.add(k);
    rec = Math.max(agora, rec + 1);
    const x = { id: idDe(k), ...m, rec };
    guardadas.push(x); entraram.push(x);
  }
  return entraram;
}
/** Tira as mensagens de mais de 30 dias e as de grupos que não são mais Sempre/Triagem. */
export function podar(guardadas, cfg, agora = Date.now()) {
  const fica = guardadas.filter(m => m.quando >= agora - RETENCAO_DIAS * DIA && guardaMensagens(modoNativo(m.grupo, cfg)));
  guardadas.splice(0, guardadas.length, ...fica);
  return guardadas;
}
/** Um id curto e estável pela chave (FNV-1a de 2 × 32 bits; o Java usa o SHA-1, os ids só precisam ser únicos em cada aparelho). */
export function idDe(k) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < k.length; i++) { const c = k.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x5bd1e995) >>> 0; }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------- Mensagens (a lista de conversas, eva/telaMensagens.js)
/** As conversas dos grupos, como a lista do WhatsApp: uma por grupo (pelo nome normalizado), com a última mensagem,
 *  quantas há e quantos avisos ainda não vistos (só os avisos contam como não lidos); da mais recente para a mais velha.
 *  `mensagens`: as guardadas (30 dias); `naoVistos`: os avisos não vistos ({grupo, …}). Puro, para o teste. */
export function conversas(mensagens = [], naoVistos = []) {
  const por = new Map();
  const de = (nome) => {
    const k = normalizar(nome);
    if (!por.has(k)) por.set(k, { chave: k, nome: limparTitulo(nome), ultima: null, n: 0, naoVistos: 0 });
    return por.get(k);
  };
  for (const m of mensagens) {
    if (!m?.grupo) continue;
    const c = de(m.grupo); c.n++;
    if (!c.ultima || m.quando > c.ultima.quando) { c.ultima = m; c.nome = limparTitulo(m.grupo); }
  }
  for (const a of naoVistos) if (a?.grupo) de(a.grupo).naoVistos++;
  return [...por.values()].filter(c => c.chave)
    .sort((a, b) => (b.ultima?.quando || 0) - (a.ultima?.quando || 0) || a.nome.localeCompare(b.nome, "pt-BR"));
}
/** As iniciais do grupo para o avatar (sem emoji nem pontuação): "ODONTO TURMA XXIX" → "OT", "Família 🏠" → "F". */
export function iniciais(nome) {
  const p = String(nome || "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}
