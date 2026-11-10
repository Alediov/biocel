// O texto que vai para a voz do "Ouvir" (voz.js), puro e sem dependências (node tools/teste_voz.mjs). Pedido do
// Alediov, 09/11/2026 ("o áudio do Ouvir é péssimo"): os motores de fala leem mal unidades, abreviações e sinais dos
// livros ("7 mg/kg" virava "sete m g barra k g", "p. ex." virava "p ponto ex ponto", "1:100.000" virava uma hora). Aqui
// eles viram palavras; as frases sem pontuação no fim ganham um ponto (a pausa do fim da frase); e os trechos levam a
// pausa depois deles (`pausa`, em ms: curta entre pedaços do mesmo parágrafo, maior entre parágrafos).

export const PAUSA_PEDACO = 220, PAUSA_PARAGRAFO = 550, MAX_TRECHO = 1200;
const N = String.raw`(\d+(?:[.,]\d+)?)`;
const FIM = String.raw`(?![A-Za-zÀ-ÖØ-öø-ÿµμ/])`;
const um = (n) => /^1([.,]0+)?$/.test(n);
// [unidade (regex), singular, plural]; as compostas antes das simples
const UNIDADES = [
  [String.raw`(?:mg|miligramas?)\s?\/\s?kg`, "miligrama por quilo", "miligramas por quilo"],
  [String.raw`mg\s?\/\s?m[lL]`, "miligrama por mililitro", "miligramas por mililitro"],
  [String.raw`(?:µg|μg|mcg)\s?\/\s?kg`, "micrograma por quilo", "microgramas por quilo"],
  [String.raw`(?:µg|μg|mcg)\s?\/\s?m[lL]`, "micrograma por mililitro", "microgramas por mililitro"],
  [String.raw`mg\s?\/\s?(?:dia|d)`, "miligrama por dia", "miligramas por dia"],
  [String.raw`mmHg`, "milímetro de mercúrio", "milímetros de mercúrio"],
  [String.raw`mg`, "miligrama", "miligramas"],
  [String.raw`(?:µg|μg|mcg)`, "micrograma", "microgramas"],
  [String.raw`kg`, "quilo", "quilos"],
  [String.raw`g`, "grama", "gramas"],
  [String.raw`m[lL]`, "mililitro", "mililitros"],
  [String.raw`L`, "litro", "litros"],
  [String.raw`mm`, "milímetro", "milímetros"],
  [String.raw`cm`, "centímetro", "centímetros"],
  [String.raw`(?:µm|μm)`, "micrômetro", "micrômetros"],
  [String.raw`min`, "minuto", "minutos"],
  [String.raw`(?:°|º)\s?C`, "grau Celsius", "graus Celsius"],
].map(([u, s, p]) => [new RegExp(String.raw`${N}\s?${u}${FIM}`, "g"), s, p]);

// abreviações (a ordem importa: "p. ex." antes de "p. 23")
const ABREV = [
  [/\bp\.\s?ex\./g, "por exemplo"], [/\be\.\s?g\./gi, "por exemplo"], [/\bi\.\s?e\./gi, "isto é"],
  [/\b([Ee])x\.(?=\s*:|\s)/g, (_, e) => (e === "E" ? "Exemplo" : "exemplo")],
  [/\betc\./g, "etcétera"], [/\bvs\.?(?=\s)/g, "versus"],
  [/\b([Cc])aps\.\s?(?=\d)/g, (_, c) => `${c === "C" ? "C" : "c"}apítulos `], [/\b([Cc])ap\.\s?(?=\d)/g, (_, c) => `${c === "C" ? "C" : "c"}apítulo `],
  [/\b([Ff])igs\.\s?(?=\d)/g, (_, f) => `${f === "F" ? "F" : "f"}iguras `], [/\b([Ff])ig\.\s?(?=\d)/g, (_, f) => `${f === "F" ? "F" : "f"}igura `],
  [/\b([Tt])ab\.\s?(?=\d)/g, (_, t) => `${t === "T" ? "T" : "t"}abela `],
  [/\bpp\.\s?(?=\d)/g, "páginas "], [/\bp\.\s?(?=\d)/g, "página "],
  [/\bvol\.\s?(?=\d)/gi, "volume "], [/(\d)ª\s?ed\.(?=[\s,);]|$)/g, "$1ª edição"], [/\bed\.(?=\s?\d)/g, "edição"],
  [/\bDra\.(?=\s)/g, "Doutora"], [/\bDr\.(?=\s)/g, "Doutor"], [/\bProfa\.(?=\s)/g, "Professora"], [/\bProf\.(?=\s)/g, "Professor"],
  [/\bSra\.(?=\s)/g, "Senhora"], [/\bSr\.(?=\s)/g, "Senhor"],
  [/\bn\.?\s?[º°]\s?(?=\d)/g, "número "], [/\baprox\./gi, "aproximadamente"], [/\bmáx\./gi, "máximo"], [/\bmín\./gi, "mínimo"],
  [/\bobs\.:?/gi, "observação:"], [/\bséc\./gi, "século"], [/\bresp\.(?=\s)/g, "respectivamente"],
  [/\be\/ou\b/g, "e ou"],
];

/** O texto de uma fala sem as marcações (HTML, ênfases do app, os marcadores de página `[[p. N]]`). */
export function limparMarcacoes(texto) {
  return String(texto || "").replace(/<sup class="r">[^<]*<\/sup>/g, "").replace(/<[^>]+>/g, "")
    .replace(/\[\[p\.\s*\d+\]\]/g, "").replace(/==|!!|\+\+|__|\*\*|\*/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

/** Unidades, abreviações, horários, proporções e sinais em palavras. */
export function normalizarFala(texto) {
  let t = limparMarcacoes(texto);
  if (!t) return "";
  // horários e intervalos de horas: "14h30", "8/8 h", "de 12 em 12h", "8h"
  t = t.replace(/\b(\d{1,2})\s?\/\s?\1\s?h(?![a-zà-ÿ])/g, "$1 em $1 horas")
    .replace(/\b(\d{1,2})h(\d{2})\b/g, "$1 horas e $2")
    .replace(/\b(\d+(?:,\d+)?)\s?h(?![a-zà-ÿA-Z])/g, (_, n) => `${n} ${um(n) ? "hora" : "horas"}`);
  // proporções da epinefrina: "1:100.000" (não é horário)
  t = t.replace(/\b(\d{1,3}):(\d{1,3}(?:\.\d{3})+)\b/g, "$1 para $2");
  for (const [rx, s, p] of UNIDADES) t = t.replace(rx, (_, n) => `${n} ${um(n) ? s : p}`);
  t = t.replace(/(\d)\s?%/g, "$1 por cento").replace(/(\d)\s?‰/g, "$1 por mil");
  // "3x ao dia", "2 × 3"
  t = t.replace(/(\d)\s?[x×]\s?(?=\d)/g, "$1 vezes ").replace(/(\d)\s?[x×](?=\s|[,.;)]|$)/g, "$1 vezes");
  // intervalos: "1,8–3,6" e "2-4" (curtos, para não pegar datas e códigos)
  t = t.replace(/(\d)\s?–\s?(?=\d)/g, "$1 a ").replace(/(?<![\d.,/-])(\d{1,3}(?:,\d+)?)-(\d{1,3}(?:,\d+)?)(?![\d.,/-])/g, "$1 a $2");
  for (const [rx, sub] of ABREV) t = t.replace(rx, sub);
  t = t.replace(/\s?≥\s?/g, " maior ou igual a ").replace(/\s?≤\s?/g, " menor ou igual a ").replace(/\s?±\s?/g, " mais ou menos ")
    .replace(/\s?≈\s?/g, " cerca de ").replace(/~\s?(?=\d)/g, "cerca de ").replace(/\s?[→⇒]\s?/g, ", ").replace(/\s>\s(?=\d)/g, " maior que ").replace(/\s<\s(?=\d)/g, " menor que ")
    .replace(/\s?\/\s?(?=[a-zà-ÿ])/g, (m, i, s) => (/\d$/.test(s.slice(0, i)) ? m : " ou ")); // "anestésico/vasoconstritor" → "ou"
  return t.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}
/** Termina com pontuação? Se não, um ponto (a voz faz a pausa do fim da frase). */
export const comPonto = (t) => (/[.!?…:;]["”')\]]?$/.test(t) ? t : `${t}.`);

/**
 * Os trechos para a voz: o texto normalizado e quebrado em pedaços de até MAX_TRECHO caracteres (o Android aceita ~4.000
 * por fala), pelas frases. Cada trecho leva `pausa` (ms de silêncio depois dele): curta entre os pedaços do mesmo texto
 * e, no último, a de parágrafo (ou `extra.pausa`).
 */
export function trechosDe(texto, extra = {}) {
  const t = normalizarFala(texto);
  if (!t) return [];
  const fim = extra.pausa ?? PAUSA_PARAGRAFO;
  if (t.length <= MAX_TRECHO) return [{ ...extra, texto: comPonto(t), pausa: fim }];
  const frases = t.match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) || [t], out = [];
  let atual = "";
  for (const f of frases) { if ((atual + f).length > MAX_TRECHO && atual) { out.push({ ...extra, texto: atual.trim(), pausa: PAUSA_PEDACO }); atual = ""; } atual += f; }
  if (atual.trim()) out.push({ ...extra, texto: comPonto(atual.trim()), pausa: fim });
  else if (out.length) out.at(-1).pausa = fim;
  return out;
}

/**
 * A melhor voz de uma lista (para o padrão): pt-BR antes de pt, instalada, maior qualidade, sem rede antes de com rede
 * (no ônibus nem sempre há internet) e, no empate, as do "Serviços de fala do Google" (com.google.android.tts) e as
 * "naturais"/"neurais"/"Google" do navegador. `vozes`: [{ nome, lingua, qualidade?, latencia?, rede?, instalada?, motor? }].
 */
export function melhorVoz(vozes) {
  const nota = (v) => {
    const br = /^pt[-_]BR/i.test(v.lingua || "") ? 3000 : /^pt/i.test(v.lingua || "") ? 1000 : -9e6;
    const q = Number.isFinite(v.qualidade) ? v.qualidade : 300; // Android: 100 (muito baixa) a 500 (muito alta)
    const lat = Number.isFinite(v.latencia) ? v.latencia : 300;
    const nomeBom = /natural|neural|google|online|premium|enhanced|wavenet/i.test(v.nome || "") ? 100 : 0; // no navegador, as "Google" são online e bem melhores
    return br + q - (v.instalada === false ? 5000 : 0) - (v.rede ? 60 : 0) - lat / 20 + (/com\.google\.android\.tts/.test(v.motor || "") ? 30 : 0) + nomeBom;
  };
  return [...(vozes || [])].filter(v => /^pt/i.test(v.lingua || "")).sort((a, b) => nota(b) - nota(a) || String(a.nome).localeCompare(String(b.nome)))[0] || null;
}

/** "Muito alta", "Alta"… pela qualidade do Android (Voice.QUALITY_*). */
export function rotuloQualidade(q) {
  if (!Number.isFinite(q)) return "";
  return q >= 500 ? "muito alta" : q >= 400 ? "alta" : q >= 300 ? "normal" : q >= 200 ? "baixa" : "muito baixa";
}
