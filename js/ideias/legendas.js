// Legendas do YouTube em texto (antena de ideias, 09/11/2026). Puro, sem DOM: roda no app e no node
// (tools/teste_transcricoes.mjs). Segue o caminho do youtube-transcript-api 1.2.x: a página do vídeo dá a chave do
// innertube (INNERTUBE_API_KEY), o POST em /youtubei/v1/player com o cliente ANDROID dá as `captionTracks`, e o
// `baseUrl` da trilha devolve a legenda (XML srv1/srv3; ou json3 com `fmt=json3`).

export const CLIENTE = { clientName: "ANDROID", clientVersion: "20.10.38" };
export const urlVideo = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
export const urlPlayer = (chave) => `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(chave)}`;
export const corpoPlayer = (id) => ({ context: { client: { ...CLIENTE } }, videoId: id });

/** Erro com um código (`bloqueio`, `po-token`, `sem-legendas`…) e o motivo em português. */
export class ErroLegenda extends Error {
  constructor(codigo, detalhe = "") { super(MOTIVOS[codigo] ? MOTIVOS[codigo] + (detalhe ? `: ${detalhe}` : "") : detalhe || codigo); this.codigo = codigo; }
}
export const MOTIVOS = {
  bloqueio: "o YouTube bloqueou este aparelho (pede para provar que não é robô)",
  "po-token": "o YouTube pediu PO token para esta legenda",
  "sem-legendas": "o vídeo não tem legendas",
  "sem-idioma": "sem legenda em português ou inglês",
  idade: "vídeo com restrição de idade",
  indisponivel: "vídeo indisponível",
  "nao-reproduzivel": "o YouTube não deixou reproduzir",
  consentimento: "a página de consentimento do YouTube não passou",
  "sem-chave": "a página do vídeo veio sem a chave do innertube",
  vazia: "a legenda veio vazia (pode ser o PO token)",
  formato: "legenda em formato desconhecido",
  rede: "falha de rede",
};
/** O bloqueio é do aparelho/IP, não do vídeo: para a rodada e não conta como tentativa do vídeo. */
export const ehDoAparelho = (codigo) => codigo === "bloqueio" || codigo === "rede";

// ---------------------------------------------------------------- página do vídeo
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function entidades(t) {
  return String(t ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
/** A chave do innertube na página do vídeo; com o recaptcha, `bloqueio`; sem nada, null. */
export function chaveInnertube(html) {
  const m = String(html || "").match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
  if (m) return m[1];
  if (/class="g-recaptcha"/.test(html || "")) throw new ErroLegenda("bloqueio");
  return null;
}
/** Página de consentimento (Europa): devolve o valor para o cookie CONSENT, ou null se não é. */
export function consentimento(html) {
  if (!/action="https:\/\/consent\.youtube\.com\/s"/.test(html || "")) return null;
  const m = String(html).match(/name="v" value="(.*?)"/);
  if (!m) throw new ErroLegenda("consentimento");
  return m[1];
}

// ---------------------------------------------------------------- resposta do player
/** As trilhas de legenda da resposta do player: [{ url, idioma, nome, auto, traduzivel }]. Lança o motivo. */
export function trilhasDoPlayer(dados) {
  if (typeof dados === "string") { try { dados = JSON.parse(dados); } catch { throw new ErroLegenda("formato", "resposta do player"); } }
  const ps = dados?.playabilityStatus || {}, st = ps.status, motivo = ps.reason || "";
  if (st && st !== "OK") {
    if (st === "LOGIN_REQUIRED" && /not a bot|não é um robô|robô/i.test(motivo)) throw new ErroLegenda("bloqueio");
    if (st === "LOGIN_REQUIRED" && /inappropriate|idade|age/i.test(motivo)) throw new ErroLegenda("idade");
    if (st === "ERROR" && /unavailable|indisponível/i.test(motivo)) throw new ErroLegenda("indisponivel");
    if (st === "LOGIN_REQUIRED") throw new ErroLegenda("bloqueio", motivo);
    throw new ErroLegenda("nao-reproduzivel", motivo);
  }
  const r = dados?.captions?.playerCaptionsTracklistRenderer;
  const lista = r?.captionTracks;
  if (!Array.isArray(lista) || !lista.length) throw new ErroLegenda("sem-legendas");
  return lista.filter(c => c?.baseUrl).map(c => ({
    url: String(c.baseUrl).replace("&fmt=srv3", ""),
    idioma: c.languageCode || "",
    nome: c.name?.runs?.[0]?.text || c.name?.simpleText || c.languageCode || "",
    auto: c.kind === "asr",
    traduzivel: !!c.isTranslatable,
  }));
}
const deIdioma = (t, base) => t.idioma === base || t.idioma.startsWith(base + "-");
/** A melhor trilha: pt feita à mão > pt automática > en à mão > en automática > outra traduzida para pt (tlang). */
export function escolherTrilha(trilhas) {
  for (const base of ["pt", "en"]) {
    const m = trilhas.find(t => deIdioma(t, base) && !t.auto); if (m) return m;
    const a = trilhas.find(t => deIdioma(t, base) && t.auto); if (a) return a;
  }
  const tr = trilhas.find(t => t.traduzivel);
  if (tr) return { ...tr, url: `${tr.url}&tlang=pt`, idioma: "pt", traduzidaDe: tr.idioma };
  throw new ErroLegenda("sem-idioma");
}
export const precisaPoToken = (url) => /[&?]exp=xpe(&|$)/.test(url || "");
/** O endereço da legenda no formato pedido (`json3`, `srv3`…; vazio = o padrão do YouTube, XML srv1). */
export function urlNoFormato(url, fmt = "") {
  const u = String(url).replace(/([&?])fmt=[^&]*&?/g, "$1").replace(/[&?]$/, "");
  return fmt ? `${u}${u.includes("?") ? "&" : "?"}fmt=${fmt}` : u;
}

// ---------------------------------------------------------------- a legenda
/** json3: { events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] } → [{ ini (s), texto }]. */
export function lerJson3(texto) {
  const d = typeof texto === "string" ? JSON.parse(texto) : texto;
  const out = [];
  for (const ev of d?.events || []) {
    if (!Array.isArray(ev.segs)) continue;
    const t = ev.segs.map(s => s.utf8 || "").join("");
    if (t.trim()) out.push({ ini: (ev.tStartMs || 0) / 1000, texto: t });
  }
  return out;
}
const semTags = (t) => t.replace(/<[^>]*>/g, "");
/** XML srv1 (`<text start dur>`) ou srv3 (`<p t d>` com `<s>`) → [{ ini (s), texto }]. */
export function lerXml(texto) {
  const x = String(texto || ""), out = [];
  if (/<timedtext[^>]*format="3"/.test(x) || /<p\s+t="/.test(x)) {
    for (const m of x.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
      const t = entidades(semTags(m[2].replace(/<br\s*\/?>/g, " ")));
      const ini = Number((m[1].match(/\bt="(\d+)"/) || [])[1] || 0) / 1000;
      if (t.trim()) out.push({ ini, texto: t });
    }
    return out;
  }
  for (const m of x.matchAll(/<text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/text>)/g)) {
    if (m[2] == null) continue;
    // o texto vem escapado uma vez ou duas (&amp;#39;): o youtube-transcript-api desescapa e tira as tags
    const t = semTags(entidades(entidades(m[2])));
    const ini = Number((m[1].match(/\bstart="([\d.]+)"/) || [])[1] || 0);
    if (t.trim()) out.push({ ini, texto: t });
  }
  return out;
}
/** Reconhece o formato pelo começo. */
export function lerLegenda(texto) {
  const t = String(texto || "").trim();
  if (!t) throw new ErroLegenda("vazia");
  if (t[0] === "{") return lerJson3(t);
  if (t[0] === "<") return lerXml(t);
  throw new ErroLegenda("formato");
}
const MARCAS = /\[(música|music|aplausos|applause|risos|laughter|risadas|silêncio|inaudível|inaudible|__)\]/gi;
/** Os trechos em texto corrido: sem as marcas [Música], espaços juntos, sem o trecho repetido em seguida, e um
 *  parágrafo novo depois de uma pausa de 4 s ou mais (lê melhor numa transcrição longa). */
export function textoCorrido(trechos) {
  const par = [];
  let atual = [], fimAnt = null, ult = "";
  for (const s of trechos) {
    const t = s.texto.replace(MARCAS, " ").replace(/\s+/g, " ").trim();
    if (!t || t === ult) continue;
    if (fimAnt != null && s.ini - fimAnt >= 4 && atual.length) { par.push(atual.join(" ")); atual = []; }
    atual.push(t); ult = t;
    fimAnt = s.ini + Math.min(8, Math.max(1, t.split(" ").length * 0.4));
  }
  if (atual.length) par.push(atual.join(" "));
  return par.join("\n\n").replace(/ +([,.!?;:])/g, "$1").trim();
}

// ---------------------------------------------------------------- Seguir o BDM (09/11/2026)
// O programa diário "Bom Dia Mercado" do Theo Borges vira a conta "Seguir o BDM" das apostas no papel
// (tools/ideias/bdm.py). Ele sai de manhã e os jogos são no mesmo dia: a transcrição dele vai na frente da fila e é
// procurada também direto no feed do canal (o índice do ramo `ideias` só é refeito 2×/dia).
export const RE_BDM = /planejamento de apostas|bom dia mercado|\bbdm\b/i;
export const ehBDM = (v) => v?.canal === "theoborges" && RE_BDM.test(v?.titulo || "");
export const urlFeed = (channelId) => `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
/** Os vídeos do BDM no feed RSS do canal (mais novo primeiro): [{ id, canal, titulo, publicado, url }]. */
export function bdmDoFeed(xml) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<entry\b[\s\S]*?<\/entry>/g)) {
    const e = m[0];
    const id = (e.match(/<yt:videoId>([\w-]{6,20})<\/yt:videoId>/) || [])[1];
    const titulo = entidades((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").trim();
    const publicado = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || null;
    const v = { id, canal: "theoborges", titulo, publicado, url: id ? urlVideo(id) : null };
    if (id && ehBDM(v)) out.push(v);
  }
  return out.sort((a, b) => String(b.publicado || "").localeCompare(String(a.publicado || "")));
}
/** A fila de transcrições: o BDM mais novo (dentro de `horas`) primeiro, depois o resto na ordem do índice. */
export function ordenarFila(videos, agora = Date.now(), horas = 30) {
  const recente = (v) => v.publicado && agora - Date.parse(v.publicado) <= horas * 3600e3;
  const bdm = videos.filter(v => ehBDM(v) && recente(v)).sort((a, b) => String(b.publicado).localeCompare(String(a.publicado)));
  const primeiro = bdm[0];
  return primeiro ? [primeiro, ...videos.filter(v => v !== primeiro)] : [...videos];
}
/** "AAAA-MM-DD" de Brasília. */
export const diaBR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
