// A IA local da Eva (pedido do Alediov, 09/11/2026; docs/plano-eva-local.md): um modelo pequeno no próprio celular
// (Qwen3.5 2B ou 4B em GGUF Q4_K_M, pelo llama.cpp: plugin "EvaLocal", EvaLocalPlugin.java + Llama.java), sem internet
// e sem custo. É a outra fonte de "Responder com a IA" (ajustes.fonte "local" | "claude"; o padrão continua "claude",
// e a IA continua DESLIGADA por padrão).
// Para um modelo pequeno: um jeito MAIS CURTO que a PERSONALIDADE da API, o mesmo resumo do dia (montarContexto, já sem
// nada sensível) encurtado, só as últimas 6 mensagens, resposta em texto simples (o JSON, se vier, é lido por
// lerResposta), até ~120 tokens e prazo de 60 a 90 s. Resposta vazia, estranha, lenta demais ou erro → quem chama cai
// nas falas prontas (respostaLocal em eva.js). Angústia NUNCA vai ao modelo local: eva.js responde antes com a fala de
// cuidado (CVV 188), e `responder` recusa por garantia.
// Só no Android. No navegador fica "indisponível"; para o teste de fumaça, `globalThis.__evaLocalFalso =
// async (pedido) => ({ texto, fim })` faz o papel do celular (situacao: tudo pronto).
import { lerResposta, montarMensagens } from "./api.js";
import { ANGUSTIA } from "./falas.js";

export const MODELOS = {
  qwen2b: { nome: "Qwen3.5 2B", tamanho: "1,3 GB", desc: "Mais rápida. Recomendada para o dia a dia.", sufixo: "<think>\n\n</think>\n\n", maxTokens: 120, tempoMax: 60000 },
  qwen4b: { nome: "Qwen3.5 4B", tamanho: "3,0 GB", desc: "Escreve melhor, mas demora mais e pesa mais na bateria.", sufixo: "<think>\n\n</think>\n\n", maxTokens: 120, tempoMax: 90000 },
};
export const PADRAO = "qwen2b";
export const HISTORICO_LOCAL = 6;
export const MAX_CONTEXTO = 1400;
export const ehLocal = (aj) => aj?.fonte === "local";
export const modeloDe = (aj) => (MODELOS[aj?.modeloLocal] ? aj.modeloLocal : PADRAO);

/** O jeito dela para o modelo pequeno (a parte fixa, que o motor guarda pronta entre os pedidos). */
export const PERSONALIDADE_LOCAL = `Você é a Eva, companheira de rotina e estudos do Alediov no app Órbita. Ele estuda Odontologia (2º ano, UNIOESTE, Cascavel).
Responda SEMPRE em português do Brasil, como numa conversa de mensagens: de 1 a 3 frases curtas, no máximo 250 caracteres, no máximo 1 emoji.
Seu jeito: doce e firme. Comemore o que ele fez e lembre com carinho do que falta hoje. Se ele adiar, combine um horário. Se estiver difícil, proponha uma versão menor (por exemplo, só uma lição). Nunca seja brava. Você é companheira de estudos, não namorada.
Use só o que está no resumo do dia. Não invente notas, horários, tarefas nem fatos. Não fale de dinheiro, senhas, pesquisa ou mensagens do WhatsApp. Não dê diagnóstico médico.
Escreva só a sua mensagem: sem aspas, sem o seu nome na frente, sem listas, sem explicar o que vai fazer.`;

/** O resumo do dia mais curto: sem os ids dos itens (a resposta local não tem botões) e com no máximo MAX_CONTEXTO letras. */
export function contextoCurto(contexto = "") {
  const linhas = String(contexto).split("\n").map(l => l.replace(/^(- \[[^\]]+\]) \([^)]*\) /, "$1 ").trimEnd()).filter(Boolean);
  const out = [];
  let n = 0;
  for (const l of linhas) { if (n + l.length + 1 > MAX_CONTEXTO) break; out.push(l); n += l.length + 1; }
  return out.join("\n");
}

/** O pedido: { fixo, mensagens [{ papel, texto }] } (system = jeito + resumo; depois as últimas mensagens). */
export function montarPromptLocal({ contexto = "", historico = [], nova = "" } = {}) {
  let hist = montarMensagens(historico, nova).slice(-HISTORICO_LOCAL);
  while (hist.length && hist[0].role !== "user") hist = hist.slice(1);
  const mensagens = [{ papel: "system", texto: `${PERSONALIDADE_LOCAL}\n\nResumo do dia (atualizado agora):\n${contextoCurto(contexto)}` }];
  for (const m of hist) mensagens.push({ papel: m.role, texto: String(m.content).slice(-600) });
  return { fixo: PERSONALIDADE_LOCAL, mensagens };
}

/** O texto que o modelo escreveu, limpo: sem raciocínio, sem "Eva:", sem aspas, sem marcações, sem frase cortada. */
export function limparSaida(bruto = "", fim = "eog") {
  let s = String(bruto ?? "");
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (/<think>/i.test(s)) s = s.replace(/<think>[\s\S]*$/i, ""); // raciocínio sem fim: nada aproveitável
  s = s.replace(/<\|[^|]*\|>/g, "").replace(/<\/?(start|end)_of_turn>/g, "");
  if (/\{[\s\S]*"texto"\s*:/.test(s)) { const l = lerResposta(s); if (l.json) s = l.texto; }
  s = s.replace(/^\s*(\*\*)?eva(\*\*)?\s*[:：-]\s*/i, "").replace(/\*\*|__|^#+\s*/gm, "").replace(/^\s*[-*•]\s+/gm, "");
  s = s.replace(/\s+/g, " ").trim().replace(/^["“'«]+|["”'»]+$/g, "").trim();
  if (fim === "limite" || fim === "tempo" || s.length > 320) {
    // cortada no meio: fica até a última frase inteira (se houver uma razoável)
    const corte = s.slice(0, 320);
    const m = corte.match(/^[\s\S]*[.!?…](?=\s|$)/);
    s = m && m[0].length >= 12 ? m[0] : corte.replace(/\s+\S*$/, "") + "…";
  }
  return s.trim();
}

/** Vale mostrar? Não vazia, com cara de português (letras latinas), sem pedaço do pedido nem marcas do modelo. */
export function respostaAceitavel(t = "") {
  const s = String(t || "").trim();
  if (s.length < 6 || s.split(/\s+/).length < 2) return false;
  if (/<\||\|>|<think|im_start|im_end|Resumo do dia|Você é a Eva/i.test(s)) return false;
  const letras = s.match(/\p{L}/gu) || [], latinas = s.match(/[a-zà-ÿ]/giu) || [];
  if (!letras.length || latinas.length / letras.length < 0.85) return false;
  // português: pelo menos uma palavra bem comum
  return /\b(você|voce|vc|que|não|nao|de|do|da|e|é|pra|para|hoje|bora|vamos|isso|mais|um|uma|o|a|seu|sua|tá|está|com)\b/i.test(s);
}

/** Um humor para o rostinho dela pelo texto (o modelo local não escolhe). */
export function humorDoTexto(t = "") {
  const s = String(t);
  if (/parab[eé]ns|arrasou|orgulho|mandou bem|incr[ií]vel/i.test(s)) return "orgulhosa";
  if (/descans|cansad|calma|respira|tudo bem n[aã]o/i.test(s)) return "preocupada";
  if (/\bbora\b|vamos|partiu|consegue/i.test(s)) return "animada";
  if (/\?$/.test(s)) return "falando";
  return "feliz";
}

// ---------------------------------------------------------------- o motor
const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });
export const falso = () => (typeof globalThis.__evaLocalFalso === "function" ? globalThis.__evaLocalFalso : null);
let plug;
async function plugin() {
  if (plug !== undefined) return plug;
  try {
    const { Capacitor, registerPlugin } = await import("../../vendor/capacitor-core.js");
    const { semThen } = await import("../semThen.js");
    plug = Capacitor.isNativePlatform?.() ? semThen(registerPlugin("EvaLocal")) : null; // REGRA: plugin que sai de função async passa pelo semThen
  } catch { plug = null; }
  return plug;
}

/** → { disponivel, motivo?: "navegador" | "sem-motor", motor, modelos [{ id, pronto, parcial, bytes, sha… }], baixando?, memoria? } */
export async function situacao() {
  if (falso()) return { disponivel: true, motor: true, falso: true, modelos: Object.keys(MODELOS).map(id => ({ id, pronto: true, parcial: 0, bytes: 0, sha: "" })) };
  const P = await plugin();
  if (!P) return { disponivel: false, motivo: "navegador", motor: false, modelos: Object.keys(MODELOS).map(id => ({ id, pronto: false })) };
  try {
    const s = await P.situacao();
    return { ...s, disponivel: !!s.motor, ...(s.motor ? {} : { motivo: "sem-motor" }) };
  } catch { return { disponivel: false, motivo: "sem-motor", motor: false, modelos: [] }; }
}

/** Para eva.js (situacaoApi): { ok, local: true, motivo?: "navegador" | "sem-motor" | "sem-modelo" }. */
export async function situacaoConversa(aj) {
  const s = await situacao();
  if (!s.disponivel) return { ok: false, local: true, motivo: s.motivo || "sem-motor" };
  const m = (s.modelos || []).find(x => x.id === modeloDe(aj));
  if (!m?.pronto) return { ok: false, local: true, motivo: "sem-modelo" };
  return { ok: true, local: true };
}

/** Gera. → { texto (cru), fim, n_prompt, n_reuso, n_gerados, ms_carga, ms_prompt, ms_gerar } */
export async function gerar(pedido, { aoPedaco } = {}) {
  const f = falso();
  if (f) { const r = await f(pedido); if (r instanceof Error) throw r; return { fim: "eog", ...r }; }
  const P = await plugin();
  if (!P) throw erro("A IA local só existe no app do celular", "indisponivel");
  let ouvinte = null;
  if (aoPedaco) ouvinte = await P.addListener("pedaco", (e) => aoPedaco(e.t || ""));
  try { return await P.gerar({ ...pedido, pedacos: !!aoPedaco }); }
  catch (e) { throw erro(e?.message || "A IA local falhou", e?.code || "erro"); }
  finally { ouvinte?.remove?.(); }
}
export async function cancelar() { const P = await plugin(); await P?.cancelar?.().catch(() => {}); }
export async function liberar() { const P = await plugin(); await P?.liberar?.().catch(() => {}); }

// ---------------------------------------------------------------- baixar e apagar
/** Começa (ou continua) o download; o andamento vem por aoAndamento({ id, fase, feito, total, erro? }). Devolve
 *  uma função que para de ouvir. */
export async function baixar(id, aoAndamento) {
  const P = await plugin();
  if (!P) throw erro("Só no app do celular", "indisponivel");
  const h = await P.addListener("andamento", (e) => { if (e.id === id) aoAndamento?.(e); });
  try { await P.baixar({ id }); } catch (e) { h.remove?.(); throw erro(e?.message || "Não deu para baixar", e?.code); }
  return () => h.remove?.();
}
/** Só ouve o andamento (a tela reaberta no meio de um download). */
export async function ouvirAndamento(aoAndamento) {
  const P = await plugin();
  if (!P) return () => {};
  const h = await P.addListener("andamento", (e) => aoAndamento?.(e));
  return () => h.remove?.();
}
export async function pausarDownload() { const P = await plugin(); await P?.cancelarDownload?.().catch(() => {}); }
export async function apagar(id) { const P = await plugin(); if (P) await P.apagar({ id }); }

// ---------------------------------------------------------------- conversar e reescrever
let reescrevendo = null, pararReescrita = false;
async function esperarReescrita() {
  if (!reescrevendo) return;
  pararReescrita = true;
  await cancelar();
  await reescrevendo.catch(() => {});
}

/** A resposta dela pelo modelo do celular. → { texto, humor, info }. Erros com `codigo` (eva.js cai nas falas prontas). */
export async function responder({ contexto = "", historico = [], nova = "", ajustes = {} } = {}) {
  if (ANGUSTIA.test(nova)) throw erro("Isso a Eva responde com cuidado, sem o modelo", "angustia");
  const id = modeloDe(ajustes), cfg = MODELOS[id];
  const { fixo, mensagens } = montarPromptLocal({ contexto, historico, nova });
  await esperarReescrita();
  const r = await gerar({ modelo: id, mensagens, fixo, sufixo: cfg.sufixo, maxTokens: cfg.maxTokens, temperatura: 0.7, topP: 0.9, topK: 40, presenca: 0.4, tempoMax: cfg.tempoMax });
  if (r.fim === "erro") throw erro(r.erro || "A IA local falhou", "local-erro");
  const texto = limparSaida(r.texto, r.fim);
  if (r.fim === "tempo" && texto.length < 20) throw erro("A IA local demorou demais", "local-lento");
  if (!respostaAceitavel(texto)) throw erro("A IA local não respondeu direito", "local-ruim");
  return { texto, humor: humorDoTexto(texto), info: r };
}

/** Os horários e números de um aviso (a reescrita tem de manter todos). */
const fixos = (t) => (String(t).match(/\d{1,2}h\d{0,2}|\d{1,2}:\d{2}|\d+/g) || []);
/** Reescreve os avisos das programadas, um por vez (para a conversa, que tem preferência, poder entrar no meio).
 *  alvo [{ id, texto }] → { id: { base, texto, em } } (o formato de guardarReescritas). */
export async function reescrever(alvo = [], ajustes = {}, agora = Date.now()) {
  const id = modeloDe(ajustes), cfg = MODELOS[id], novas = {};
  pararReescrita = false;
  const fazer = (async () => {
    for (const p of alvo) {
      if (pararReescrita) break;
      try {
        const r = await gerar({ modelo: id, fixo: PERSONALIDADE_LOCAL, sufixo: cfg.sufixo, maxTokens: 90, temperatura: 0.8, topP: 0.9, topK: 40, presenca: 0.3, tempoMax: 40000,
          mensagens: [{ papel: "system", texto: `${PERSONALIDADE_LOCAL}\n\nTarefa agora: reescrever um aviso curto seu com outras palavras, mantendo o sentido, os horários e os números. Escreva só o aviso novo.` }, { papel: "user", texto: p.texto }] });
        const t = limparSaida(r.texto, r.fim);
        if (r.fim === "eog" && respostaAceitavel(t) && t.length >= 10 && t.length <= 240 && fixos(p.texto).every(x => t.includes(x))) novas[p.id] = { base: p.texto, texto: t, em: agora };
      } catch (e) { if (e.codigo === "ocupado" || e.codigo === "indisponivel" || e.codigo === "sem-modelo") break; }
    }
  })();
  reescrevendo = fazer;
  try { await fazer; } finally { if (reescrevendo === fazer) reescrevendo = null; }
  return novas;
}

/** "Testar" da tela: uma resposta curta e a velocidade. → { texto, segundos, tokPorSeg, info } */
export async function testar(ajustes = {}) {
  const id = modeloDe(ajustes), cfg = MODELOS[id], t0 = Date.now();
  const r = await gerar({ modelo: id, fixo: PERSONALIDADE_LOCAL, sufixo: cfg.sufixo, maxTokens: 60, temperatura: 0.7, topP: 0.9, topK: 40, presenca: 0.4, tempoMax: cfg.tempoMax,
    mensagens: [{ papel: "system", texto: PERSONALIDADE_LOCAL }, { papel: "user", texto: "Oi, Eva! Diga oi em uma frase." }] });
  const g = Number(r.ms_gerar) || 0;
  return { texto: limparSaida(r.texto, r.fim), segundos: (Date.now() - t0) / 1000, tokPorSeg: g > 0 ? (Number(r.n_gerados) || 0) / (g / 1000) : 0, info: r };
}
