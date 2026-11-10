// Gêneros e climas pelo som (pedido do Alediov, 25/10/2026: ele não confia na classificação dos artistas nem do
// Deezer). O app ouve um pedaço de cada música (3 trechos de 6 s, a 25%, 50% e 75% da duração) com o modelo MusiCNN do
// Essentia (treinado no Million Song Dataset: 50 tags de gênero, época e clima; TensorFlow.js, roda no aparelho, sem
// internet) e guarda as 50 notas e o "embedding" de 200 números. Daí saem:
// - o GRUPO (vai para a tag Gênero do arquivo): Pop, Rock, Metal, Electronic, Rap, R&B, Chill, Folk, Classical, Jazz
//   e Brazilian, em inglês e com uma palavra só (pedido dele). Pelas notas do modelo, mais o que ele já corrigiu:
//   as músicas que ele classificou à mão ensinam as parecidas (vizinhos mais próximos no embedding) e o artista dele;
//   Brazilian não sai do som (o modelo não conhece) e vem do gênero original do arquivo, das correções e do artista;
// - o CLIMA (campo próprio do app, não vai para o arquivo): Animada, Calma, Melancólica, Agressiva, Dançante,
//   Romântica.
// Modelo: app/vendor/modelos/msd-musicnn (CC BY-NC-ND 4.0, uso pessoal); Essentia.js (AGPL-3.0) calcula as bandas de
// mel do jeito que o modelo espera (TensorflowInputMusiCNN); TensorFlow.js 4.22 roda o modelo.

export const GRUPOS = ["Pop", "Rock", "Metal", "Electronic", "Rap", "R&B", "Chill", "Folk", "Classical", "Jazz", "Brazilian"];
export const CLIMAS = ["Animada", "Calma", "Melancólica", "Agressiva", "Dançante", "Romântica"];
export const VERSAO_SOM = 1;
export const TAGS = ["rock", "pop", "alternative", "indie", "electronic", "female vocalists", "dance", "00s", "alternative rock", "jazz", "beautiful", "metal", "chillout", "male vocalists", "classic rock", "soul", "indie rock", "Mellow", "electronica", "80s", "folk", "90s", "chill", "instrumental", "punk", "oldies", "blues", "hard rock", "ambient", "acoustic", "experimental", "female vocalist", "guitar", "Hip-Hop", "70s", "party", "country", "easy listening", "sexy", "catchy", "funk", "electro", "heavy metal", "Progressive rock", "60s", "rnb", "indie pop", "sad", "House", "happy"];
const T = Object.fromEntries(TAGS.map((t, i) => [t, i]));

// quanto cada tag do modelo conta para cada grupo (a nota do grupo é a maior entre as suas tags, com um pouco da soma)
const PESOS = {
  Pop: { pop: 1, "indie pop": 0.9, catchy: 0.45, dance: 0.3 },
  Rock: { rock: 1, "alternative rock": 1, "indie rock": 1, "classic rock": 1, punk: 0.95, "Progressive rock": 1, "hard rock": 0.8, alternative: 0.6, indie: 0.5, guitar: 0.35 },
  Metal: { metal: 1.15, "heavy metal": 1.15, "hard rock": 0.45 },
  Electronic: { electronic: 1, electronica: 1, electro: 1, House: 1.05, dance: 0.6, experimental: 0.3 },
  Rap: { "Hip-Hop": 1.3 },
  "R&B": { rnb: 1.15, soul: 1, funk: 0.65, sexy: 0.45 },
  Chill: { chillout: 1, chill: 1, Mellow: 0.75, ambient: 0.9, "easy listening": 0.75 },
  Folk: { folk: 1.05, acoustic: 0.8, country: 1.05 },
  Jazz: { jazz: 1.15, blues: 1 },
};
const PESOS_CLIMA = {
  Animada: { happy: 1, party: 0.8, catchy: 0.6, dance: 0.4 },
  Calma: { Mellow: 1, chill: 0.9, chillout: 0.9, ambient: 0.8, "easy listening": 0.8 },
  "Melancólica": { sad: 1.2, beautiful: 0.45, Mellow: 0.3 },
  Agressiva: { metal: 1, "heavy metal": 1, "hard rock": 0.9, punk: 0.9 },
  "Dançante": { dance: 1, House: 1, electro: 0.8, party: 0.6, funk: 0.5 },
  "Romântica": { sexy: 1.1, soul: 0.5, rnb: 0.5, beautiful: 0.45 },
};
const notaPor = (pesos, a) => { let max = 0, soma = 0; for (const [t, w] of Object.entries(pesos)) { const v = (a[T[t]] || 0) * w; max = Math.max(max, v); soma += v; } return max + 0.15 * soma; };

/** Notas de cada grupo só pelo som (0 a ~1). Classical: instrumental sem guitarra, eletrônica, rap nem rock. */
export function notasDoSom(a) {
  const n = {};
  for (const g of GRUPOS) n[g] = PESOS[g] ? notaPor(PESOS[g], a) : 0;
  const v = (t) => a[T[t]] || 0;
  n.Classical = v("instrumental") * 0.75 * (1 - Math.max(v("electronic"), v("rock"), v("Hip-Hop"), v("guitar"), v("dance"))) + 0.25 * v("beautiful") * v("instrumental");
  return n;
}
/** O clima (1 ou 2, se o segundo chega perto do primeiro). */
export function climaDe(a) {
  const l = CLIMAS.map(c => [c, notaPor(PESOS_CLIMA[c], a)]).sort((x, y) => y[1] - x[1]);
  if (!l.length || l[0][1] < 0.05) return [];
  return l[1] && l[1][1] >= 0.85 * l[0][1] ? [l[0][0], l[1][0]] : [l[0][0]];
}

/** O gênero escrito no arquivo (iTunes, Deezer, o artista) → um grupo, quando dá para saber. */
export function grupoDoTexto(txt) {
  const s = String(txt || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (!s) return null;
  if (GRUPOS.some(g => g.toLowerCase() === s)) return GRUPOS.find(g => g.toLowerCase() === s);
  if (/mpb|sertanej|pagode|samba|forro|axe|brasil|brazil|bossa|funk (carioca|brasil)|piseiro|arrocha|gospel brasil|musica popular brasileira/.test(s)) return "Brazilian";
  if (/metal|metalcore|deathcore/.test(s)) return "Metal";
  if (/hip.?hop|rap|trap|drill|grime/.test(s)) return "Rap";
  if (/r&b|rnb|r'n'b|soul|funk$/.test(s)) return "R&B";
  if (/electro|edm|house|techno|trance|dubstep|drum ?(&|and|n) ?bass|dance|synth|eurobeat|hardstyle|phonk/.test(s)) return "Electronic";
  if (/lo.?fi|chill|ambient|new age|easy listening|relax/.test(s)) return "Chill";
  if (/jazz|blues|swing/.test(s)) return "Jazz";
  if (/classic(al|a)|orquest|orchestr|opera|soundtrack|trilha|score|instrumental/.test(s)) return "Classical";
  if (/folk|country|acoustic|acustic|singer.?songwriter|bluegrass/.test(s)) return "Folk";
  if (/rock|punk|grunge|emo|alternative|alternativ|indie rock|post-?hardcore/.test(s)) return "Rock";
  if (/pop|k-?pop|j-?pop|anime|vocaloid|idol|reggaeton|latin/.test(s)) return "Pop";
  return null;
}

// ---------- análise (carrega TF.js, Essentia e o modelo só quando precisa) ----------
let carregando = null;
function script(src) {
  return new Promise((ok, erro) => {
    if (document.querySelector(`script[data-orbita="${src}"]`)) return ok();
    const s = document.createElement("script"); s.src = src; s.dataset.orbita = src; s.onload = ok; s.onerror = () => erro(new Error(`não carregou ${src}`));
    document.head.append(s);
  });
}
async function carregar() {
  if (carregando) return carregando;
  carregando = (async () => {
    const base = new URL("../../", import.meta.url).href; // app/
    await script(base + "vendor/tf.min.js");
    await script(base + "vendor/tfjs-wasm/tf-backend-wasm.min.js");
    await script(base + "vendor/essentia/essentia-wasm.web.js");
    const tf = window.tf;
    tf.wasm?.setWasmPaths?.(base + "vendor/tfjs-wasm/", true);
    // WASM (com SIMD) primeiro: no celular é o mais estável; se não der, WebGL; por último, a CPU
    let ok = false;
    for (const b of [window.__tfBackend, "wasm", "webgl", "cpu"].filter(Boolean)) { try { if (await tf.setBackend(b)) { await tf.ready(); ok = true; break; } } catch { /* o próximo */ } }
    if (!ok) throw new Error("o TensorFlow.js não abriu");
    const { default: Essentia } = await import("../../vendor/essentia/essentia.js-core.es.min.js");
    const wasm = await window.EssentiaWASM({ locateFile: (f) => base + "vendor/essentia/" + f });
    const essentia = new Essentia(wasm);
    const modelo = await tf.loadGraphModel(base + "vendor/modelos/msd-musicnn/model.json");
    return { tf, essentia, modelo };
  })().catch(e => { carregando = null; throw e; });
  return carregando;
}

export let tempos = null;
const FRAME = 512, HOP = 256, PATCH = 187, BANDAS = 96, TAXA = 16000, TRECHO = 6.1; // 6,1 s = 2 pedaços de 187 frames
/** Áudio mono a 16 kHz (decodificado já nessa taxa). */
async function mono16k(bytes) {
  const ctx = new OfflineAudioContext(1, 1, TAXA);
  const buf = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const n = buf.length, out = new Float32Array(n), C = buf.numberOfChannels;
  for (let c = 0; c < C; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / C; }
  return out;
}
/** As bandas de mel (frames × 96) de um trecho, como o modelo espera. */
function bandas(essentia, sinal) {
  const out = [];
  for (let i = 0; i + FRAME <= sinal.length; i += HOP) {
    const v = essentia.arrayToVector(sinal.subarray(i, i + FRAME));
    const r = essentia.TensorflowInputMusiCNN(v);
    out.push(essentia.vectorToArray(r.bands));
    v.delete?.(); r.bands.delete?.();
  }
  return out;
}

/**
 * Analisa os bytes de uma música: { notas: Float32Array(50), emb: Float32Array(200) } (médias dos trechos).
 * Usa 3 trechos de 6 s (a 25%, 50% e 75% da duração; a música toda se for curta): uns 2 s por música no notebook.
 */
export async function analisar(bytes) {
  const { tf, essentia, modelo } = await carregar();
  const t0 = performance.now();
  const s = await mono16k(bytes);
  const t1 = performance.now();
  const L = TRECHO * TAXA, trechos = [];
  if (s.length <= 3 * L) trechos.push(s);
  else for (const k of [0.25, 0.5, 0.75]) { const ini = Math.min(s.length - L, Math.floor(s.length * k)); trechos.push(s.subarray(ini, ini + L)); }
  const frames = trechos.flatMap(t => { const b = bandas(essentia, t); return b.slice(0, Math.floor(b.length / PATCH) * PATCH || b.length); });
  const t2 = performance.now();
  if (frames.length < PATCH / 2) throw new Error("música curta demais");
  while (frames.length % PATCH) frames.push(new Float32Array(BANDAS)); // completa o último pedaço com silêncio
  const lotes = frames.length / PATCH;
  const plano = new Float32Array(frames.length * BANDAS);
  frames.forEach((f, i) => plano.set(f, i * BANDAS));
  const x = tf.tensor3d(plano, [lotes, PATCH, BANDAS]);
  let saidas;
  try { saidas = modelo.execute({ "model/Placeholder": x }, ["model/Sigmoid", "model/dense/Relu"]); }
  catch { saidas = modelo.execute(x, ["model/Sigmoid", "model/dense/Relu"]); }
  const [pred, emb] = await Promise.all(saidas.map(t => t.array()));
  x.dispose(); saidas.forEach(t => t.dispose());
  tempos = { decodificar: Math.round(t1 - t0), bandas: Math.round(t2 - t1), modelo: Math.round(performance.now() - t2), backend: tf.getBackend() };
  const media = (l, n) => { const o = new Float32Array(n); for (const v of l) for (let i = 0; i < n; i++) o[i] += v[i] / l.length; return o; };
  return { notas: media(pred, 50), emb: media(emb, 200) };
}

// ---------- guardar compacto (1 byte por número) ----------
export function compactar(arr, escala) {
  const u = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++) u[i] = Math.max(0, Math.min(255, Math.round(arr[i] / escala * 255)));
  let s = ""; for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
export function expandir(b64, escala) {
  if (!b64) return null;
  const s = atob(b64), o = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) / 255 * escala;
  return o;
}
export const escalaEmb = (emb) => Math.max(1e-6, ...emb);

// ---------- decidir o grupo ----------
const cos = (a, b) => { let p = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { p += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? p / Math.sqrt(na * nb) : 0; };
/**
 * O grupo de cada faixa analisada. `faixas`: [{ id, artista, notas (50), emb (200), manual (grupo dele ou null) }].
 * Devolve Map id → { grupo, confianca, notas }. Notas do som + vizinhos que ele classificou (k = 7, pesados pela
 * semelhança) + o artista (o que ele classificou nas outras músicas do artista). Brazilian, que o som não reconhece,
 * vem só das correções dele (nas parecidas e no artista).
 */
export function decidir(faixas) {
  const manuais = faixas.filter(f => f.manual && f.emb);
  const porArtista = new Map();
  for (const f of faixas) if (f.manual) { const k = (f.artista || "").toLowerCase(); if (!porArtista.has(k)) porArtista.set(k, new Map()); const m = porArtista.get(k); m.set(f.manual, (m.get(f.manual) || 0) + 1); }
  const out = new Map();
  for (const f of faixas) {
    if (f.manual) { out.set(f.id, { grupo: f.manual, confianca: 1, manual: true }); continue; }
    const n = f.notas ? notasDoSom(f.notas) : Object.fromEntries(GRUPOS.map(g => [g, 0]));
    // vizinhos
    if (manuais.length && f.emb) {
      const viz = manuais.map(m => [m, cos(f.emb, m.emb)]).sort((a, b) => b[1] - a[1]).slice(0, 7);
      const peso = viz.reduce((s, [, c]) => s + Math.max(0, c) ** 4, 0) || 1;
      for (const [m, c] of viz) n[m.manual] += 1.4 * Math.max(0, c) ** 4 / peso * Math.min(1, manuais.length / 6) * Math.max(0, (c - 0.5) * 2);
    }
    // o artista
    const art = porArtista.get((f.artista || "").toLowerCase());
    if (art) { const tot = [...art.values()].reduce((s, v) => s + v, 0); for (const [g, v] of art) n[g] += 0.7 * v / tot * Math.min(1, tot / 3); }
    // o gênero que veio no arquivo não pesa mais (pedido do Alediov, 02/11/2026: só os gêneros da avaliação do app)
    const l = Object.entries(n).sort((a, b) => b[1] - a[1]);
    out.set(f.id, { grupo: l[0][0], confianca: l[0][1] ? (l[0][1] - (l[1]?.[1] || 0)) / l[0][1] : 0, notas: n });
  }
  return out;
}
