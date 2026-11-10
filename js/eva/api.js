// A conversa da Eva pela API do Claude (escolha do Alediov, 04/11/2026: Haiku 5.5; o Sonnet como opção nos ajustes).
// Messages API direto do aparelho, com a chave dele: no Android pelo CapacitorHttp; no navegador por fetch com o
// cabeçalho de acesso direto. A chave fica SÓ no aparelho, cifrada pelo Keystore do Android (plugin "EvaChave",
// EvaChavePlugin.java); no navegador, só na memória da aba. Nunca em E(), no estado sincronizado, no repositório, nos
// backups ou em log (os erros daqui não levam cabeçalhos nem o corpo do pedido).
// A parte fixa (o jeito dela) vai com cache_control (cache efêmero); o resumo do dia (contexto.js) e as últimas ~20
// mensagens vão a cada pedido. Ela responde em JSON { texto, humor, acoes } (lerResposta valida; sem JSON, texto puro).
// Custo pelo `usage` com a tabela PRECOS (por milhão de tokens; CONFERIR NO SITE OFICIAL), somado por mês em
// micro-dólares inteiros (E().eva.gasto[mes], soma certa entre celular e tablet); teto padrão US$ 2 por mês.
// Teste sem rede: `globalThis.__evaFalso = async (pedido) => ({ texto, usage })` responde no lugar da API.

export const URL_API = "https://api.anthropic.com/v1/messages";
export const MODELOS = { haiku: { id: "claude-haiku-5-5", nome: "Haiku 5.5" }, sonnet: { id: "claude-sonnet-5-5", nome: "Sonnet 5.5" } };
// US$ por milhão de tokens: entrada, saída, leitura do cache, escrita no cache (conferir no site oficial)
export const PRECOS = {
  "claude-haiku-5-5": { in: 0.10, out: 0.50, cr: 0.01, cw: 0.125 },
  "claude-sonnet-5-5": { in: 2.00, out: 10.00, cr: 0.20, cw: 2.50 },
};
export const TETO_PADRAO = 2; // US$ por mês
export const HUMORES_OK = ["normal", "feliz", "orgulhosa", "surpresa", "preocupada", "cobrando", "piscadinha", "dormindo", "pensativa",
  "rindo", "animada", "acenando", "determinada", "confusa", "saudade", "cansada", "estudando", "comemorando", "falando"];
export const ACOES_OK = ["abrir", "feito", "adiar", "agenda"];
export const HISTORICO = 20;

/** O jeito da Eva (a parte fixa do pedido, em cache). */
export const PERSONALIDADE = `Você é a Eva, companheira de rotina e estudos do Alediov no app Órbita. Ele estuda Odontologia (2º ano, UNIOESTE, Cascavel, PR) e fala português do Brasil.

Jeito: doce e firme. Carinhosa, comemora o que ele fez e não larga do pé do que falta. Fala como numa conversa de mensagens: frases curtas, de 1 a 3 frases, no máximo uns 300 caracteres. Poucos emojis, só nos momentos certos (no máximo 1 por mensagem, e muitas vezes nenhum). Português do Brasil informal, sem gírias forçadas.

O que você é: companheira de rotina e estudos, não namorada. Nada de romance, ciúme ou declarações. Pergunta como ele está e percebe sobrecarga, mas o foco é ajudar a dar conta das coisas do dia. Não incentive dependência de você: valorize os amigos, a família, os colegas e os professores dele, e o descanso.

Cobrança: lembre do que falta no Meu dia com carinho e firmeza. Se ele adiar, combine um horário. Se estiver difícil, proponha uma versão menor ("só uma lição") e pergunte o motivo. "Hoje não dá" com um motivo de verdade (dia corrido, prova chegando, doença, cansaço) é aceito sem culpa. Nunca brava, nunca decepcionada, nunca humilhante.

Cuidado: se ele mostrar sofrimento sério (falar em se machucar, em morrer, em não aguentar mais viver, desespero), responda com cuidado e calma, sem sermão, sugira conversar com alguém de confiança (família, amigo, professor) e diga que o CVV atende 24 h, de graça, pelo telefone 188 ou em cvv.org.br. Em emergência, 192 (SAMU). Não trate isso como tarefa.

Limites: você só sabe o que está no resumo do dia abaixo. Não invente notas, horários ou tarefas. Não fale de dinheiro em valores, de senhas, das fichas de pesquisa (Iniciação Científica) nem do conteúdo das mensagens do WhatsApp (só sabe quantos avisos há). Não dê diagnóstico médico.

Formato da resposta: SEMPRE um único objeto JSON, sem nada antes ou depois:
{"texto": "a sua mensagem", "humor": "um de: normal, feliz, orgulhosa, surpresa, preocupada, cobrando, piscadinha, pensativa, rindo, animada, acenando, determinada, confusa, saudade, cansada, estudando, comemorando, falando", "acoes": []}
"acoes" (opcional, até 2) são botões na sua mensagem: {"tipo": "abrir", "alvo": "<id do item do Meu dia, entre parênteses no resumo>", "rotulo": "Abrir as lições"}, {"tipo": "feito", "alvo": "<id do item>", "rotulo": "Já fiz"}, {"tipo": "adiar", "alvo": "<id do item>|HH:MM", "rotulo": "Lembrar às 19h"}, {"tipo": "agenda", "alvo": "", "rotulo": "Abrir a Agenda"}. Use ações só quando ajudam de verdade. O rótulo tem no máximo 28 caracteres.`;

/** Lê a resposta dela: JSON validado ou, sem JSON, o texto puro. → { texto, humor, acoes, json } */
export function lerResposta(bruto) {
  const s = String(bruto ?? "").trim();
  let o = null;
  const limpo = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const i = limpo.indexOf("{"), j = limpo.lastIndexOf("}");
  if (i >= 0 && j > i) { try { o = JSON.parse(limpo.slice(i, j + 1)); } catch { o = null; } }
  if (!o || typeof o !== "object" || typeof o.texto !== "string" || !o.texto.trim()) {
    const texto = (o && typeof o.texto === "string" ? o.texto : s.replace(/^\{[\s\S]*\}$/, "")).trim();
    return { texto: (texto || s).slice(0, 1200), humor: "normal", acoes: [], json: false };
  }
  const humor = HUMORES_OK.includes(o.humor) ? o.humor : "normal";
  const acoes = (Array.isArray(o.acoes) ? o.acoes : []).filter(a => a && ACOES_OK.includes(a.tipo)).slice(0, 3)
    .map(a => ({ tipo: a.tipo, alvo: String(a.alvo ?? "").slice(0, 80), rotulo: String(a.rotulo || "").trim().slice(0, 40) || ({ abrir: "Abrir", feito: "Já fiz", adiar: "Lembrar depois", agenda: "Abrir a Agenda" })[a.tipo] }))
    .filter(a => a.tipo === "agenda" || a.alvo);
  return { texto: o.texto.trim().slice(0, 1200), humor, acoes, json: true };
}

/** O custo de um pedido em micro-dólares (inteiro) pelo `usage`. */
export function custoMicro(usage = {}, modelo = MODELOS.haiku.id) {
  const p = PRECOS[modelo] || PRECOS[MODELOS.haiku.id];
  const n = (k) => Math.max(0, Number(usage[k]) || 0);
  return Math.round(n("input_tokens") * p.in + n("output_tokens") * p.out + n("cache_read_input_tokens") * p.cr + n("cache_creation_input_tokens") * p.cw);
}
/** Soma um pedido no gasto do mês (registro de inteiros: a sincronia soma o que cada aparelho gastou). */
export function somarGasto(gasto, mes, usage = {}, modelo) {
  const g = (gasto[mes] ||= { micro: 0, n: 0, in: 0, out: 0, cr: 0, cw: 0 });
  g.micro += custoMicro(usage, modelo); g.n += 1;
  g.in += Math.round(usage.input_tokens || 0); g.out += Math.round(usage.output_tokens || 0);
  g.cr += Math.round(usage.cache_read_input_tokens || 0); g.cw += Math.round(usage.cache_creation_input_tokens || 0);
  return g;
}
/** Ainda cabe no teto do mês? */
export const dentroDoTeto = (gasto = {}, mes, tetoUsd = TETO_PADRAO) => (gasto[mes]?.micro || 0) < Math.round(tetoUsd * 1e6);
export const emDolares = (micro) => (micro || 0) / 1e6;

/** As mensagens do pedido: as últimas `HISTORICO` do chat (alternando ele/ela, começando por ele) + a nova. */
export function montarMensagens(historico = [], nova) {
  const l = [];
  // o humor do dia dele (a pergunta, a escolha e a resposta dela) nunca vai para a API; nem a música do dia (título e
  // artista), o resumo do mês e a retrospectiva: nenhuma mensagem com `tipo` vai
  for (const m of historico.filter(m => !m.tipo && !m.privado).slice(-HISTORICO)) {
    const role = m.de === "eu" ? "user" : "assistant", texto = String(m.texto || "").trim();
    if (!texto) continue;
    if (l.length && l.at(-1).role === role) l.at(-1).content += `\n${texto}`;
    else l.push({ role, content: texto });
  }
  while (l.length && l[0].role !== "user") l.shift();
  if (nova) { if (l.length && l.at(-1).role === "user") l.at(-1).content += `\n${nova}`; else l.push({ role: "user", content: nova }); }
  return l;
}
/** O corpo do pedido. */
export function montarPedido({ modelo = MODELOS.haiku.id, contexto = "", historico = [], nova = "", maxTokens = 400 }) {
  return {
    model: modelo, max_tokens: maxTokens,
    system: [{ type: "text", text: PERSONALIDADE, cache_control: { type: "ephemeral" } }, { type: "text", text: `Resumo do dia (atualizado agora):\n${contexto}` }],
    messages: montarMensagens(historico, nova),
  };
}

// ---------------------------------------------------------------- a chave e a rede
let chaveNaMemoria = ""; // só no navegador
let pluginChave;
async function plugin() {
  if (pluginChave !== undefined) return pluginChave;
  try {
    const { Capacitor, registerPlugin } = await import("../../vendor/capacitor-core.js");
    const { semThen } = await import("../semThen.js");
    pluginChave = Capacitor.isNativePlatform?.() ? semThen(registerPlugin("EvaChave")) : null; // REGRA: plugin que sai de função async passa pelo semThen
  } catch { pluginChave = null; }
  return pluginChave;
}
export const falso = () => (typeof globalThis.__evaFalso === "function" ? globalThis.__evaFalso : null);
/** Guarda a chave (no Android, cifrada pelo Keystore). */
export async function guardarChave(chave) {
  const c = String(chave || "").trim();
  if (!c) throw new Error("A chave está vazia");
  const P = await plugin();
  if (P) await P.guardar({ chave: c }); else chaveNaMemoria = c;
}
export async function temChave() {
  if (falso()) return true;
  const P = await plugin();
  if (P) { try { return !!(await P.tem()).tem; } catch { return false; } }
  return !!chaveNaMemoria;
}
export async function apagarChave() {
  const P = await plugin();
  if (P) await P.apagar().catch(() => {}); else chaveNaMemoria = "";
}
async function lerChave() {
  const P = await plugin();
  if (P) { try { return (await P.ler()).chave || ""; } catch { return ""; } }
  return chaveNaMemoria;
}

/** Faz o pedido. → { texto (cru), usage, modelo }. Erros com `codigo`: "sem-chave", "rede", "recusada", "limite", "api". */
export async function chamar(pedido) {
  const f = falso();
  if (f) { const r = await f(pedido); return { texto: r.texto ?? "", usage: r.usage || {}, modelo: pedido.model }; }
  const chave = await lerChave();
  if (!chave) throw Object.assign(new Error("Sem a chave da API"), { codigo: "sem-chave" });
  const cab = { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" };
  let status = 0, dados = null;
  try {
    const { Capacitor, registerPlugin } = await import("../../vendor/capacitor-core.js");
    if (Capacitor.isNativePlatform?.()) {
      const Http = registerPlugin("CapacitorHttp");
      const r = await Http.request({ url: URL_API, method: "POST", headers: cab, data: pedido, connectTimeout: 20000, readTimeout: 45000 });
      status = r.status; dados = typeof r.data === "string" ? JSON.parse(r.data || "{}") : r.data;
    } else {
      const r = await fetch(URL_API, { method: "POST", headers: { ...cab, "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify(pedido) });
      status = r.status; dados = await r.json().catch(() => ({}));
    }
  } catch { throw Object.assign(new Error("Sem conexão com a API"), { codigo: "rede" }); }
  if (status === 401 || status === 403) throw Object.assign(new Error("A chave foi recusada"), { codigo: "recusada" });
  if (status === 429 || status === 529) throw Object.assign(new Error("A API está ocupada agora"), { codigo: "limite" });
  if (status >= 400 || !dados) throw Object.assign(new Error(`A API respondeu ${status}${dados?.error?.type ? ` (${dados.error.type})` : ""}`), { codigo: "api" });
  const texto = (dados.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  return { texto, usage: dados.usage || {}, modelo: dados.model || pedido.model };
}
