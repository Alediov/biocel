// Ida e volta entre a escrita original e o alfabeto latino (pedido do Alediov, 26/10/2026): ele escreve os nomes no
// idioma original (ルフィ, 紅蓮華, 방탄소년단), mas o iTunes e o Deezer muitas vezes trazem a forma romanizada (Luffy,
// Gurenge, Bangtan Sonyeondan). Aqui:
// - `romaji`: kana (hiragana e katakana) → Hepburn (sokuon っ dobra a consoante, chōon ー vira vogal longa, yōon きゃ
//   → kya, as combinações do katakana para sons estrangeiros: ファ fa, ティ ti, ウィ wi, ヴァ va…); hangul → romanização
//   revisada (com a ligação da consoante final na vogal seguinte e ㄹㄹ → ll). Kanji fica como está: sem dicionário
//   não dá para saber a leitura (鬼滅の刃 não vira Kimetsu no Yaiba); nesse caso a busca usa as outras pistas.
// - `chaveSom`: um romaji simplificado para comparar grafias diferentes do mesmo som (l ≈ r, v ≈ b, si/shi, tu/tsu,
//   ou/oo/ō, consoantes dobradas, "y" final como "i"): Rufi, Ruffy e Luffy dão a mesma chave de ルフィ.
// - `esqueleto`: só as consoantes da chave, para os nomes em inglês escritos em katakana (ブルーロック ≈ Blue Lock,
//   アイドル ≈ Idol), em que o japonês põe vogais entre as consoantes.
// - `parecenca(a, b)`: 0 a 1, quanto dois nomes parecem o mesmo (1 = iguais; 0,9 = mesmo som; 0,6 a 0,75 = mesmo
//   esqueleto; 0,5 = só as partes em kana batem; 0 = não dá para dizer, como kanji contra latino).

const H = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko", が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to", だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho", ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", ゐ: "i", ゑ: "e", を: "o", ん: "n", ゔ: "vu",
  ゕ: "ka", ゖ: "ke",
};
const PEQ_Y = { ゃ: "a", ゅ: "u", ょ: "o" }; // yōon
const PEQ_V = { ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ゎ: "wa" }; // sons estrangeiros (ファ, ティ…)
const KATA_V = { "ヷ": "va", "ヸ": "vi", "ヹ": "ve", "ヺ": "vo" };
const MACRON = { a: "ā", i: "ī", u: "ū", e: "ē", o: "ō" };

const ehKana = (c) => /[ぁ-ゖァ-ヺー]/.test(c);
const ehHangul = (c) => { const n = c.codePointAt(0); return n >= 0xAC00 && n <= 0xD7A3; };
const paraHira = (c) => { const n = c.codePointAt(0); return n >= 0x30A1 && n <= 0x30F6 ? String.fromCodePoint(n - 0x60) : c; };
/** Tem kanji (ideogramas)? Então a leitura não sai sem dicionário. */
export const temKanji = (s) => /\p{Script=Han}/u.test(s || "");
/** Tem kana ou hangul (que dá para romanizar)? */
export const temKana = (s) => /[ぁ-ゖァ-ヺー가-힣ｦ-ﾝ]/.test(s || "");
/** Tem escrita japonesa ou coreana (kana, kanji, hangul)? */
export const temEscritaAsiatica = (s) => temKana(s) || temKanji(s);

// ---------- hangul → romanização revisada ----------
const INI = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const MED = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FIM = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
// a final simples antes de vogal (ㅇ inicial) passa para a sílaba seguinte com o som de inicial
const LIGA = { 1: "g", 2: "kk", 4: "n", 7: "d", 8: "r", 16: "m", 17: "b", 19: "s", 20: "ss", 22: "j", 23: "ch", 24: "k", 25: "t", 26: "p", 27: "" };
function hangul(txt) {
  const s = [...txt], out = [];
  for (let i = 0; i < s.length; i++) {
    if (!ehHangul(s[i])) { out.push(s[i]); continue; }
    const n = s[i].codePointAt(0) - 0xAC00, l = Math.floor(n / 588), v = Math.floor((n % 588) / 28), t = n % 28;
    const prox = s[i + 1] && ehHangul(s[i + 1]) ? s[i + 1].codePointAt(0) - 0xAC00 : -1;
    const lProx = prox >= 0 ? Math.floor(prox / 588) : -1;
    let ini = INI[l];
    const ant = out._fimLigado; out._fimLigado = undefined;
    if (ant != null) ini = ant + (l === 11 ? "" : ini);
    else if (l === 5 && out._fimL) ini = "l"; // ㄹㄹ → ll
    out._fimL = false;
    let fim = FIM[t];
    if (t && lProx === 11 && LIGA[t] != null) { out._fimLigado = LIGA[t]; fim = ""; } // 음악 → eumak
    else if (t === 8 && lProx === 5) out._fimL = true;
    out.push(ini + MED[v] + fim);
  }
  return out.join("");
}

/**
 * Kana e hangul para o alfabeto latino (minúsculas). Kanji e o resto ficam como estão.
 * `longas`: "macron" (ー → ō, como no Hepburn; padrão), "dobrar" (ー → oo) ou "nada".
 */
export function romaji(txt, { longas = "macron" } = {}) {
  let s = String(txt || "").normalize("NFKC");
  if (/[가-힣]/.test(s)) s = hangul(s);
  if (!/[ぁ-ゖァ-ヺー]/.test(s)) return s;
  const out = []; // pedaços: { t: texto, k: veio de kana }
  let dobrar = false;
  for (const c0 of s) {
    const c = paraHira(c0);
    if (KATA_V[c0]) { out.push({ t: KATA_V[c0], k: true }); continue; }
    if (c === "っ") { dobrar = true; continue; }
    if (c === "ー") {
      const u = out[out.length - 1];
      if (u?.k) { const m = u.t.match(/[aeiou]$/); if (m) u.t = longas === "macron" ? u.t.slice(0, -1) + MACRON[m[0]] : longas === "dobrar" ? u.t + m[0] : u.t; }
      continue;
    }
    if (PEQ_Y[c] || PEQ_V[c]) {
      const u = out[out.length - 1];
      if (u?.k && /[a-z]$/.test(u.t)) {
        const base = u.t.replace(/[aeiou]$/, "");
        if (PEQ_Y[c]) u.t = /(sh|ch|j)$/.test(base) ? base + PEQ_Y[c] : base + "y" + PEQ_Y[c];
        else if (c === "ゎ") u.t = base + "wa";
        else if (u.t === "u") u.t = "w" + PEQ_V[c]; // ウィ wi, ウェ we, ウォ wo
        else if (u.t === "i") u.t = "y" + PEQ_V[c]; // イェ ye
        else if (u.t === "te" || u.t === "de" || u.t === "to" || u.t === "do") u.t = u.t[0] + PEQ_V[c]; // ティ ti, ドゥ du
        else u.t = base + PEQ_V[c]; // ファ fa, シェ she, ヴァ va, ツァ tsa
        continue;
      }
      out.push({ t: (PEQ_Y[c] ? "y" : "") + (PEQ_Y[c] || PEQ_V[c]), k: true });
      continue;
    }
    const r = H[c];
    if (r == null) { dobrar = false; out.push({ t: c0, k: false }); continue; }
    let t = r;
    if (dobrar) { t = (t.startsWith("ch") ? "t" : /^[bcdfghjkmpqrstvwxz]/.test(t) ? t[0] : "") + t; dobrar = false; }
    out.push({ t, k: true });
  }
  // ん antes de vogal ou de y: n' (Hepburn: ren'ai)
  for (let i = 0; i < out.length - 1; i++) if (out[i].k && out[i].t === "n" && out[i + 1].k && /^[aeiouy]/.test(out[i + 1].t)) out[i].t = "n'";
  return out.map(p => p.t).join("");
}
/** Para mostrar: o romaji com a 1ª letra de cada palavra em maiúscula ("ルフィ" → "Rufi"). Vazio se não muda nada. */
export function romajiParaMostrar(txt) {
  if (!temKana(txt) || temKanji(txt)) return "";
  const r = romaji(txt);
  return r.replace(/(^|[\s(\[「『/・-])([a-zāīūēō])/g, (_, a, b) => a + b.toUpperCase());
}

// ---------- comparar ----------
/** Minúsculas, sem acento nem sinais (mantém letras de qualquer escrita): para comparar a escrita como está. */
export const normEscrita = (s) => String(s || "").normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
/** A chave do som: romaji simplificado, sem espaços (Rufi, Ruffy, Luffy e ルフィ → "rufi"). */
const memoSom = new Map();
export function chaveSom(s) {
  const k = String(s || "");
  let r = memoSom.get(k);
  if (r == null) { r = calcularChaveSom(k); if (memoSom.size > 8000) memoSom.clear(); memoSom.set(k, r); }
  return r;
}
function calcularChaveSom(s) {
  let t = romaji(s, { longas: "dobrar" }).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  t = t.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").map(w => w.replace(/(?<=[a-z])y$/, "i")).join("");
  return t
    .replace(/ck/g, "k").replace(/ph/g, "f").replace(/q/g, "k").replace(/x/g, "ks").replace(/c(?=[eiy])/g, "s")
    .replace(/tch/g, "ch").replace(/sh/g, "s").replace(/ch/g, "t").replace(/c/g, "k").replace(/ts/g, "t").replace(/dz/g, "z").replace(/j/g, "z")
    .replace(/l/g, "r").replace(/v/g, "b").replace(/hu/g, "fu").replace(/ng(?=[kg])/g, "n").replace(/([aeiou])w(?![aeiou])/g, "$1")
    .replace(/ou/g, "o").replace(/oo/g, "o").replace(/uu/g, "u").replace(/aa/g, "a").replace(/ii/g, "i").replace(/ee/g, "e").replace(/ei/g, "e")
    .replace(/([b-df-hj-np-tv-z])\1+/g, "$1");
}
/** Só as consoantes da chave do som (Blue Lock e ブルーロック → "brk"). */
export const esqueleto = (s) => chaveSom(s).replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1");
const soLatino = (s) => !/[^\p{Script=Latin}\p{N}\s\p{P}\p{S}]/u.test(s);

/** As partes em kana de um texto com kanji, romanizadas ("夜に駆ける" → ["ni", "keru"]). */
function partesKana(s) {
  return (String(s || "").normalize("NFKC").match(/[ぁ-ゖァ-ヺー]+/g) || []).map(p => chaveSom(p)).filter(p => p.length >= 2);
}

/** Quanto dois nomes parecem o mesmo: 1 iguais, 0,9 mesmo som, 0,6 a 0,75 mesmo esqueleto, 0,5 só as partes em kana, 0 não dá para dizer. */
export function parecenca(a, b) {
  const na = normEscrita(a), nb = normEscrita(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ra = romaji(a), rb = romaji(b);
  // kanji de um lado e latino do outro: as partes em kana do lado com kanji têm de aparecer, na ordem, do outro lado
  if (temKanji(ra) || temKanji(rb)) {
    if (temKanji(ra) && temKanji(rb)) return na.includes(nb) || nb.includes(na) ? 0.8 : 0;
    const [comK, outro] = temKanji(ra) ? [a, b] : [b, a];
    const ps = partesKana(comK), alvo = chaveSom(outro);
    if (!ps.length || !soLatino(romaji(outro))) return 0;
    let i = 0;
    for (const p of ps) { const j = alvo.indexOf(p, i); if (j < 0) return 0; i = j + p.length; }
    return 0.5;
  }
  const ca = chaveSom(a), cb = chaveSom(b);
  if (ca && ca === cb) return 0.9;
  const ea = esqueleto(a), eb = esqueleto(b);
  if (ea && ea === eb) {
    // vogais muito diferentes no começo pesam contra (o esqueleto sozinho junta muita coisa nos nomes curtos)
    return ea.length >= 3 ? 0.75 : ea.length === 2 ? 0.6 : 0.4;
  }
  if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) return 0.7;
  return 0;
}

/** As formas de buscar um texto: a original e, se tiver kana ou hangul (e nada de kanji), a romanizada. */
export function formasDeBusca(txt) {
  const t = String(txt || "").trim();
  if (!t) return [];
  const l = [t];
  if (temKana(t) && !temKanji(t)) { const r = romaji(t, { longas: "nada" }); if (r && r !== t) l.push(r); }
  return l;
}
