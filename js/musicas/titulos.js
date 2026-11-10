// Padrão dos títulos das músicas (pedidos do Alediov, 24/10/2026): cada palavra começa com maiúscula e o resto em
// minúsculas, menos as palavras de ligação (de, da, do, em, que, um…, of, in, the…), que ficam em minúsculas, a não
// ser a primeira e a ÚLTIMA ("I Can't Fit In"); "&" no lugar de "e" (and, y) entre duas palavras. Artigos: saem só no
// começo do título ("O Sol…" → "Sol…"), no começo dos parênteses ("(O Retorno)" → "(Retorno)"; depois de ":" fica,
// "Lua: A Volta") e nos dois nomes ligados por "e" ("Entre o Céu e o Mar" → "Entre Céu & Mar"); no meio ficam, em
// minúsculas ("Rei entre os Reis", "Continuar a Queimar", "This Will Be the Day", "Tudo o que Você Fez"). Também em
// minúsculas no meio: que, se, quem, como, quando, onde, mas, um/uma (that, but, if, so).
// Siglas (MPB, DJ), números romanos e palavras com maiúsculas no meio (McCartney) ficam como estão.

export const PADRAO = {
  minusculas: [
    // português: preposições, contrações e conjunções
    "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "num", "numa", "nuns", "numas", "dum", "duma",
    "ao", "aos", "à", "às", "pela", "pelo", "pelas", "pelos", "por", "com", "sem", "sob", "sobre", "para", "pra", "pro",
    "pras", "pros", "até", "entre", "contra", "desde", "após", "ante", "perante", "ou", "nem", "que", "se", "quem", "como", "quando", "onde", "mas",
    // artigos indefinidos (os definidos ficam em `artigos`, também em minúsculas no meio)
    "um", "uma", "uns", "umas",
    // inglês
    "of", "in", "on", "at", "to", "for", "or", "nor", "by", "with", "from", "into", "onto", "upon", "vs", "vs.", "via", "per", "that", "but", "if", "so",
    // espanhol, italiano e francês
    "del", "en", "con", "para", "di", "du", "des", "et",
    // participação
    "feat.", "ft.", "part.",
  ],
  artigos: ["o", "a", "os", "as", "the", "an", "el", "la", "los", "las", "le", "les", "il", "lo", "gli"],
  e: ["e", "and", "y"],
};

// Siglas que ficam sempre em maiúsculas, mesmo escritas em minúsculas (pedido do Alediov: "IDFC" não vira "Idfc").
// O app também aprende as que ele escreve em maiúsculas ao salvar um título (cfg "siglas", `definirSiglas`).
export const SIGLAS = ["rip", "idfc", "idk", "idc", "tbh", "lol", "omg", "bff", "fyi", "asap", "sos", "vip", "dna", "mpb", "dj", "mc", "tv", "usa", "nyc", "uk", "ost", "ep", "lp", "cd", "ufo", "lsd", "mvp", "fbi", "cia", "nba", "ufc", "gta", "rpg", "pov", "diy", "jpn", "kr"];
let siglas = new Set(SIGLAS);
export const definirSiglas = (aprendidas = []) => { siglas = new Set([...SIGLAS, ...aprendidas.map(x => String(x).toLocaleLowerCase("pt-BR"))]); };
/** Siglas (2 a 6 letras, todas maiúsculas) de um título que não está todo em maiúsculas: para o app aprender. */
export function siglasDoTitulo(titulo) {
  const t = String(titulo || "");
  if (t === t.toLocaleUpperCase("pt-BR")) return [];
  return [...new Set((t.match(/[\p{L}\p{N}.]+/gu) || []).map(w => w.replace(/\./g, "")).filter(w => w.length >= 2 && w.length <= 6 && w === w.toLocaleUpperCase("pt-BR") && /\p{Lu}/u.test(w) && !/^\p{N}*\p{Lu}$/u.test(w) && !ROMANO_SIMPLES.test(w)))];
}
const ROMANO_SIMPLES = /^[IVXLCDM]+$/;
const ROMANO = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;
const INGLES = new Set(["the", "you", "i", "me", "my", "am", "are", "is", "love", "of", "and", "your", "it", "in", "on", "we", "be", "all", "what", "this", "that", "don't", "can't", "i'm", "like", "never", "go", "baby", "night", "heart", "to", "for", "with", "up", "down", "out", "away", "back", "time", "life", "world", "feel", "know", "want", "need", "way", "day", "girl", "boy", "dance", "song", "home", "free", "fire", "dream", "dreams", "don’t", "it's", "let", "tonight", "forever"]);
const PORTUGUES = new Set(["de", "do", "da", "dos", "das", "que", "não", "eu", "você", "meu", "minha", "é", "com", "um", "uma", "pra", "se", "sem", "amor", "vida", "coração", "na", "no", "em", "mais", "ser", "quando", "tudo", "sol", "lua", "mar", "dia", "noite", "tempo", "te", "ela", "ele", "nós", "nosso", "nossa", "sou", "vou", "quero", "aqui", "agora", "pelo", "pela"]);
const minus = (s) => s.toLocaleLowerCase("pt-BR");
const maius = (s) => s.toLocaleUpperCase("pt-BR");
const sem = (s) => minus(s).normalize("NFD").replace(/\p{M}/gu, "");

/** Formata um título no padrão. `regras` permite trocar as listas (Ajustes das Músicas). */
export function padronizarTitulo(titulo, regras = PADRAO) {
  if (!titulo) return titulo;
  let t = String(titulo).replace(/\s+/g, " ").trim();
  // título todo em maiúsculas com várias palavras ("AMOR DE VERÃO"): as palavras não são siglas; uma palavra só
  // ("IDFC", "RIP") é sigla
  const tudoMaiusculo = t === maius(t) && /\p{L}{3}/u.test(t) && (t.match(/\p{L}+/gu) || []).length > 1;
  const minusc = new Set(regras.minusculas.map(minus));
  const artigos = new Set(regras.artigos.map(minus));
  const artigosMin = new Set([...artigos, "a", "an"]); // no meio, os artigos que ficam vão em minúsculas
  const conj = new Set(regras.e.map(minus));
  const palavrasDoTitulo = t.split(/[\s()[\]]+/).map(minus);
  const nEn = palavrasDoTitulo.filter(p => INGLES.has(p)).length, nPt = palavrasDoTitulo.filter(p => PORTUGUES.has(p)).length;
  const ingles = palavrasDoTitulo[0] === "the" || nEn > nPt;
  // em inglês, "as" não é artigo ("As I Am") e "a" é; em português, "a" é artigo
  const ehArtigo = (p) => artigos.has(p) && !(ingles && ["as", "o", "os", "la", "le", "il", "lo"].includes(p));

  // tokens: palavras e separadores (espaços, parênteses, colchetes, " - ", ":")
  const partes = t.split(/(\s+|[()[\]]|\s-\s|:)/).filter(x => x !== undefined && x !== "");
  const saida = [];
  let inicio = true; // começo do título ou de um trecho entre parênteses / depois de " - " ou ":"
  let primeira = true, depoisDoE = false, abriuParenteses = false;
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (/^\s+$/.test(p)) { saida.push(" "); continue; }
    if (/^[([]$/.test(p) || /^\s-\s$/.test(p) || p === ":") { saida.push(p); inicio = true; depoisDoE = false; abriuParenteses = /^[([]$/.test(p); continue; }
    if (/^[)\]]$/.test(p)) { saida.push(p); continue; }
    const pl = minus(p);
    // próximo token que é palavra (para saber se há palavra depois e se esta é a última do trecho)
    let j = i + 1; while (j < partes.length && /^\s+$/.test(partes[j])) j++;
    const temDepois = j < partes.length && !/^[)\]:([]$/.test(partes[j]) && !/^\s-\s$/.test(partes[j]);
    // artigo: some no começo do título e no começo dos parênteses ("(O Retorno)" → "(Retorno)"; depois de ":" e
    // " - " fica: "Lua: A Volta") e nos dois nomes ligados por "e" ("Entre o Céu e o Mar" → "Entre Céu & Mar");
    // no meio, fica em minúsculas
    let k = j + 1; while (k < partes.length && /^\s+$/.test(partes[k])) k++;
    const antesDoE = temDepois && k < partes.length && (conj.has(minus(partes[k])) || partes[k] === "&");
    if (ehArtigo(pl) && temDepois && (primeira || depoisDoE || antesDoE || (inicio && abriuParenteses))) { depoisDoE = false; continue; }
    // "e" entre duas palavras vira &
    if (conj.has(pl) && !inicio && temDepois && !(ingles && pl === "y")) { saida.push("&"); depoisDoE = true; continue; }
    saida.push(formatarPalavra(p, { inicio, ultima: !temDepois && !inicio, minusc, artigosMin, tudoMaiusculo }));
    inicio = false; primeira = false; depoisDoE = false; abriuParenteses = false;
  }
  return saida.join("").replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\[\s+/g, "[").replace(/\s+\]/g, "]").trim();
}

function formatarPalavra(p, { inicio, ultima = false, minusc, artigosMin = new Set(), tudoMaiusculo, hifen = false }) {
  // partes com hífen: cada uma segue a regra (a primeira de um começo é maiúscula; artigo não vale dentro: "Lo-Fi")
  if (p.includes("-") && !/^-+$/.test(p)) { const qs = p.split("-"); return qs.map((q, k) => formatarPalavra(q, { inicio: inicio && k === 0, ultima: ultima && k === qs.length - 1, minusc, tudoMaiusculo, hifen: true })).join("-"); }
  const letras = p.replace(/[^\p{L}]/gu, "");
  if (!letras) return p; // números, símbolos
  // dados de RPG (1D8, 2D6, D20; pedido do Alediov, 25/10/2026) e siglas com números aprendidas (cfg "siglas")
  const alnum = minus(p.replace(/[^\p{L}\p{N}]/gu, ""));
  if (/^\d*d\d+$/.test(alnum) || (/\d/.test(alnum) && siglas.has(alnum))) return p.replace(/\p{L}+/gu, m => maius(m));
  if (siglas.has(minus(letras))) return p.replace(/\p{L}+/gu, m => maius(m)); // RIP, IDFC, R.I.P.
  if (ROMANO.test(letras) && letras.length > 1 && letras === maius(letras)) return p;
  if (!tudoMaiusculo && letras.length >= 2 && letras === maius(letras) && letras.length <= 5) return p; // sigla
  if (/^\p{Ll}+\p{Lu}/u.test(letras) || /^\p{Lu}\p{Ll}+\p{Lu}/u.test(letras)) return p; // iPhone, McCartney
  const pl = minus(p);
  if (/^(feat\.?|ft\.?|part\.)$/.test(pl)) return pl.replace(/^ft\.?$/, "feat.").replace(/^feat$/, "feat."); // "Part II" (sem ponto) é palavra
  if (!inicio && !ultima && (minusc.has(pl) || (!hifen && artigosMin.has(pl)))) return pl;
  // d'água, l'amour: o prefixo fica minúsculo e a palavra depois do apóstrofo começa com maiúscula
  const ap = pl.match(/^([dln])['’](\p{L}.*)$/u);
  if (ap) return (inicio ? maius(ap[1]) : ap[1]) + "'" + maius(ap[2][0]) + ap[2].slice(1);
  // primeira letra (depois de aspas ou ¿¡) maiúscula
  return pl.replace(/^([^\p{L}\d]*)(\p{L})/u, (_, a, b) => a + maius(b));
}

// ---------- ordem alfabética dos títulos (pedido do Alediov, 02/11/2026) ----------
// "Lua (Remake)" vinha DEPOIS de "Lua (Remake Acapella)" e "Lua (Remake Instrumental)": no localeCompare o espaço
// ordena antes do ")". Agora a música vem antes das variações dela: primeiro a base (o título sem os parênteses do
// fim), depois os parênteses palavra a palavra, e o fim do texto antes de qualquer palavra a mais:
// "Lua" → "Lua (Remake)" → "Lua (Remake Acapella)" → "Lua (Remake Instrumental)" → "Lua (Sped Up)" → "Lua Nova".
// A base manda primeiro: a 1ª letra continua sendo a da ordem de antes (a barra de rolagem rápida, rolagem.js, segue).
const COLADOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const cacheOrdem = new Map();
/** { t, base, palavras }: a chave de ordem de um título (guardada: a ordenação de milhares de músicas chama muito). */
export function chaveOrdem(titulo) {
  const t = String(titulo ?? "").replace(/\s+/g, " ").trim();
  let k = cacheOrdem.get(t);
  if (k) return k;
  let base = t;
  const grupos = [];
  for (;;) {
    const m = base.match(/\s*[([]([^()[\]]*)[)\]]\s*$/);
    if (!m || m.index === 0) break;
    grupos.unshift(m[1]);
    base = base.slice(0, m.index).trim();
  }
  k = { t, base, palavras: grupos.join(" ").split(/[\s,;]+/).filter(Boolean) };
  if (cacheOrdem.size > 20000) cacheOrdem.clear();
  cacheOrdem.set(t, k);
  return k;
}
/** Compara dois títulos na ordem do app (sem diferenciar maiúsculas e acentos; números pelo valor: "2" antes de "10"). */
export function compararTitulos(a, b) {
  const x = chaveOrdem(a), y = chaveOrdem(b);
  const c = COLADOR.compare(x.base, y.base);
  if (c) return c;
  const n = Math.min(x.palavras.length, y.palavras.length);
  for (let i = 0; i < n; i++) { const d = COLADOR.compare(x.palavras[i], y.palavras[i]); if (d) return d; }
  if (x.palavras.length !== y.palavras.length) return x.palavras.length - y.palavras.length;
  return COLADOR.compare(x.t, y.t) || (x.t < y.t ? -1 : x.t > y.t ? 1 : 0);
}

/** Compara sem diferenciar maiúsculas/acentos (para achar a versão "(Sped Up)" mesmo com o título padronizado). */
export const mesmoTitulo = (a, b) => sem(a).replace(/\s+/g, " ").trim() === sem(b).replace(/\s+/g, " ").trim();
