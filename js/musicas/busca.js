// Busca de tags na internet para o editor (como o AutomaTag): iTunes (capas em 1000 px, gênero e ano) e Deezer.
// No celular vai pelo HTTP nativo do Capacitor (sem a trava de CORS do navegador).
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import { tituloNoPadrao as padronizarTitulo, analisarTitulo } from "./tagsInternas.js";
import { formasDeBusca, parecenca, normEscrita, temEscritaAsiatica, temKanji } from "./romaji.js";

const nativo = !!Capacitor.isNativePlatform?.();
const Http = nativo ? registerPlugin("CapacitorHttp") : null;
let falso = null; // testes: troca a busca por uma função
export const _definirBuscaFalsa = (fn) => { falso = fn; };

async function pegarJson(url) {
  if (Http) {
    const r = await Http.request({ url, method: "GET", headers: { Accept: "application/json", "User-Agent": "Orbita/1.0 (app pessoal)" }, connectTimeout: 12000, readTimeout: 12000 });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Baixa uma imagem e devolve em base64 (sem o "data:"). */
export async function baixarImagem(url) {
  if (!url) return null;
  if (falso) return falso.imagem?.(url) ?? null;
  if (Http) {
    const r = await Http.request({ url, method: "GET", responseType: "blob", connectTimeout: 15000, readTimeout: 20000 });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return String(r.data).replace(/^data:[^,]*,/, "");
  }
  const b = await (await fetch(url)).blob();
  return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(b); });
}

const limpar = (s) => (s || "").replace(/\s*[([](?:official|audio|lyric|video|clipe|oficial|visualizer|letra)[^)\]]*[)\]]/gi, "").replace(/\.(mp3|flac|m4a|ogg|opus|wav)$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
const ano = (s) => (String(s || "").match(/\d{4}/) || [""])[0];

// Gêneros do iTunes do Japão e da Coreia (a busca na escrita original vai para essas lojas): em inglês, como os outros.
const GENEROS_LOJA = { "アニメ": "Anime", "ロック": "Rock", "ポップ": "Pop", "ポップス": "Pop", "エレクトロニック": "Electronic", "エレクトロニカ": "Electronic", "ダンス": "Dance", "ヒップホップ/ラップ": "Hip-Hop/Rap", "ヒップホップ": "Hip-Hop", "サウンドトラック": "Soundtrack", "オルタナティブ": "Alternative", "R&B/ソウル": "R&B/Soul", "ジャズ": "Jazz", "クラシック": "Classical", "メタル": "Metal", "ハードロック": "Hard Rock", "ワールド": "World", "インストゥルメンタル": "Instrumental", "シンガーソングライター": "Singer/Songwriter", "ヴォーカル": "Vocal", "歌謡曲": "Kayokyoku", "演歌": "Enka", "キッズ": "Children's Music", "ゲーム": "Video Game", "가요": "K-Pop", "댄스": "Dance", "발라드": "Ballad", "록": "Rock", "힙합": "Hip-Hop", "알앤비": "R&B", "인디": "Indie", "OST": "Soundtrack" };
const generoLoja = (g) => (g && GENEROS_LOJA[g]) || (g && temEscritaAsiatica(g) ? "" : g || "");

/**
 * As buscas a fazer (ida e volta da escrita original, pedido do Alediov, 26/10/2026): o texto como ele escreveu; a forma
 * romanizada quando há kana ou hangul (sem kanji: ルフィ → "rufi"); e, com escrita japonesa ou coreana, a loja do iTunes
 * do Japão ou da Coreia, que devolve os nomes na escrita original (紅蓮華, 夜に駆ける), o que vale também para os
 * títulos em kanji, que não dá para romanizar sem dicionário.
 */
export function termosDeBusca({ titulo, artista, arquivo }) {
  const original = limpar([artista, titulo].filter(Boolean).join(" ")) || limpar(arquivo);
  if (!original) return [];
  const l = [{ termo: original, loja: "BR" }];
  const fa = formasDeBusca(limpar(artista)), ft = formasDeBusca(limpar(titulo || arquivo));
  const rom = limpar([fa[fa.length - 1], ft[ft.length - 1]].filter(Boolean).join(" "));
  if (rom && rom !== original) l.push({ termo: rom, loja: "BR" });
  if (/[\u3041-\u30FF]|\p{Script=Han}/u.test(original) && !/[\uAC00-\uD7A3]/.test(original)) l.push({ termo: original, loja: "JP", soItunes: true });
  else if (/[\uAC00-\uD7A3]/.test(original)) l.push({ termo: original, loja: "KR", soItunes: true });
  return l;
}

/** Quanto um candidato da busca bate com a música dele: { titulo, artista, total } (0 a 1), pelo nome, pelo som
 *  (romaji ↔ escrita original) e, quando o nome não dá para comparar (kanji contra latino), pela duração e pelo artista. */
export function notaCandidato(c, { titulo, artista, duracao, versoes: vs = [] }) {
  const base = analisarTitulo(titulo || "").base || titulo || "";
  const delesT = String(c.titulo || "").replace(/\s+-\s+(?:from|tema|theme|opening|ending|tv|op|ed)\b.*$/i, "");
  const delesBase = analisarTitulo(delesT).base || delesT;
  const nt = normEscrita(base), nd = normEscrita(delesBase);
  let tt = Math.max(parecenca(base, delesBase), parecenca(base, delesT));
  if (nt.length >= 3 && nd.length >= 3 && (nd.startsWith(nt) || nt.startsWith(nd))) tt = Math.max(tt, 0.8);
  // artista: o nome todo ou um dos que assinam ("YOASOBI & Ayase", "LiSA, Uru")
  let ta = 0;
  if (artista) {
    const partes = [c.artista || "", ...String(c.artista || "").split(/\s*(?:,|&|\/|;|\bfeat\.?|\bft\.?|\bx\b|×|、)\s*/i)].filter(Boolean);
    ta = Math.max(0, ...partes.map(p => parecenca(artista, p)));
    const na = normEscrita(artista), nc = normEscrita(c.artista);
    if (na.length >= 3 && nc.includes(na.slice(0, 12))) ta = Math.max(ta, 0.85);
  }
  const dur = duracao && c.duracao ? Math.abs(duracao - c.duracao) : null;
  // versões de verdade (Live, Remake, Acoustic…) só valem com a versão no título achado
  const versaoOk = vs.every(v => normEscrita(c.titulo).includes(normEscrita(v)));
  let total = 0;
  if (versaoOk) {
    if (tt >= 0.6 && (!artista || ta >= 0.6)) total = (tt + (artista ? ta : tt)) / 2;
    // kanji contra latino (紅蓮華 × Gurenge): o artista bate e a duração também (até 2,5 s)
    else if (tt < 0.6 && ta >= 0.6 && dur != null && dur <= 2500 && (temKanji(base) || temKanji(delesBase))) total = 0.6 + (tt >= 0.5 ? 0.1 : 0);
    else if (tt >= 0.5 && ta >= 0.85 && (dur == null || dur <= 4000)) total = 0.6;
    if (total && dur != null) total = Math.min(1, total + (dur <= 2500 ? 0.05 : dur > 15000 ? -0.2 : 0));
  }
  return { titulo: tt, artista: ta, total: Math.max(0, total) };
}

/** Candidatos: [{ titulo, artista, album, genero, ano, capa (url grande), miniatura, fonte, duracao }]. */
export async function buscarTags({ titulo, artista, arquivo, duracao }) {
  const termos = termosDeBusca({ titulo, artista, arquivo });
  if (!termos.length) return [];
  const out = [];
  if (falso) out.push(...((await falso.buscar(termos[0].termo, termos)) || []));
  else {
    const pedidos = [];
    for (const t of termos) {
      const q = encodeURIComponent(t.termo);
      const lang = t.loja === "JP" ? "ja_jp" : t.loja === "BR" ? "pt_br" : "en_us";
      pedidos.push(pegarJson(`https://itunes.apple.com/search?term=${q}&entity=song&limit=8&country=${t.loja}&lang=${lang}`).then(r => ({ it: r, loja: t.loja })));
      if (!t.soItunes) pedidos.push(pegarJson(`https://api.deezer.com/search?q=${q}&limit=6`).then(r => ({ dz: r })));
    }
    const rs = await Promise.allSettled(pedidos);
    if (!rs.some(r => r.status === "fulfilled")) throw rs[0]?.reason || new Error("a busca falhou");
    for (const r of rs) {
      if (r.status !== "fulfilled") continue;
      if (r.value.it) for (const x of r.value.it.results || []) out.push({
        titulo: x.trackName, artista: x.artistName, album: (x.collectionName || "").replace(/ - (Single|EP)$/i, ""), albumOriginal: x.collectionName,
        genero: generoLoja(x.primaryGenreName), ano: ano(x.releaseDate), capa: (x.artworkUrl100 || "").replace(/\/\d+x\d+bb\./, "/1000x1000bb."), miniatura: x.artworkUrl100,
        fonte: r.value.loja === "BR" ? "iTunes" : `iTunes ${r.value.loja}`, duracao: x.trackTimeMillis || 0,
      });
      if (r.value.dz) for (const x of r.value.dz.data || []) out.push({
        titulo: x.title, artista: x.artist?.name, album: x.album?.title || "", albumOriginal: x.album?.title, genero: "", ano: "", albumId: x.album?.id,
        capa: x.album?.cover_xl || x.album?.cover_big, miniatura: x.album?.cover_medium, fonte: "Deezer", duracao: (x.duration || 0) * 1000,
      });
    }
  }
  // o mais parecido primeiro; com o nome dele na escrita original, os resultados na mesma escrita passam na frente
  const alvo = { titulo: titulo || limpar(arquivo), artista, duracao };
  const original = temEscritaAsiatica(`${titulo || ""} ${artista || ""}`);
  const nota = (c) => {
    const n = notaCandidato(c, alvo);
    return n.titulo * 3 + n.artista * 2 + n.total + (c.fonte.startsWith("iTunes") ? 0.3 : 0) + (original && temEscritaAsiatica(c.titulo) ? 0.5 : 0);
  };
  const vistos = new Set();
  return out.map(c => ({ c, n: nota(c) })).sort((a, b) => b.n - a.n).map(x => x.c)
    .filter(c => { const k = normEscrita(c.titulo) + "|" + normEscrita(c.artista) + "|" + c.fonte; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 12);
}

/** Deezer não traz gênero e ano na busca: completa pelo álbum. */
export async function completarDeezer(c) {
  if (c.fonte !== "Deezer" || !c.albumId || (c.genero && c.ano)) return c;
  try {
    const a = await pegarJson(`https://api.deezer.com/album/${c.albumId}`);
    return { ...c, ano: c.ano || ano(a.release_date), genero: c.genero || a.genres?.data?.[0]?.name || "" };
  } catch { return c; }
}

/**
 * Do candidato para os campos do editor, já no padrão do Alediov (título padronizado; artista = álbum = artista do álbum
 * se ligados). Com `atual` (os campos de agora): o título, o artista e o álbum que ele escreveu na escrita original
 * (japonês, coreano) NUNCA viram a forma romanizada que a busca trouxe; o que a busca trouxe vai em `romanizados`, para
 * o editor mostrar como dica. O gênero da busca fica de fora: só vale o gênero que o app tira do som.
 */
export function camposDoCandidato(c, ligados = true, atual = null) {
  const manter = (meu, deles) => !!(meu && temEscritaAsiatica(meu) && deles && !temEscritaAsiatica(deles));
  const romanizados = {};
  const escolher = (k, deles) => { if (manter(atual?.[k], deles)) { romanizados[k] = deles; return atual[k]; } return deles; };
  const artista = escolher("artista", c.artista || "");
  const titulo = manter(atual?.titulo, c.titulo) ? (romanizados.titulo = c.titulo, atual.titulo) : padronizarTitulo(c.titulo || "");
  return {
    titulo,
    artista,
    album: ligados ? artista : escolher("album", c.album || ""),
    albumArtista: ligados ? artista : escolher("albumArtista", artista),
    // sem gênero: o da loja não vai para o arquivo (pedido do Alediov, 02/11/2026: só o gênero da avaliação do app)
    ano: c.ano || "",
    romanizados,
  };
}

// ---------- discografia no Deezer, para conferir o que falta de um artista (25/10/2026) ----------
/** Artistas do Deezer com esse nome: [{ id, nome, fas, foto }], o mais parecido primeiro. Busca também a forma
 *  romanizada (ヨルシカ → "yorushika") e compara pelo som (o Deezer costuma ter o nome em romaji). */
export async function artistasDeezer(nome) {
  if (falso?.artistas) return ordenarArtistas(await falso.artistas(nome, formasDeBusca(nome)), nome);
  const rs = await Promise.allSettled(formasDeBusca(nome).map(q => pegarJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`)));
  if (!rs.some(r => r.status === "fulfilled")) throw rs[0].reason;
  const l = [];
  for (const r of rs) if (r.status === "fulfilled") for (const a of r.value.data || []) if (!l.some(x => x.id === a.id)) l.push({ id: a.id, nome: a.name, fas: a.nb_fan || 0, foto: a.picture_medium || "" });
  return ordenarArtistas(l, nome);
}
function ordenarArtistas(l, nome) {
  const p = (a) => { const x = parecenca(nome, a.nome); return x >= 0.9 ? 2 : x >= 0.6 ? 1 : 0; };
  return (l || []).map(a => ({ a, p: p(a) })).sort((x, y) => y.p - x.p || y.a.fas - x.a.fas).map(x => x.a);
}
/**
 * Todas as músicas do artista no Deezer (álbuns, EPs e singles em que ele é o artista principal):
 * [{ titulo, duracao, album: { id, titulo, ano, tipo, capa } }], do lançamento mais novo ao mais antigo.
 */
export async function discografiaDeezer(id, aoProgresso = () => {}) {
  if (falso?.discografia) return falso.discografia(id);
  const albuns = [];
  let url = `https://api.deezer.com/artist/${id}/albums?limit=100`;
  for (let i = 0; url && i < 5; i++) { const r = await pegarJson(url); albuns.push(...(r.data || [])); url = r.next || null; }
  albuns.sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")));
  const out = [];
  for (let i = 0; i < albuns.length; i += 4) {
    const bloco = albuns.slice(i, i + 4);
    const rs = await Promise.allSettled(bloco.map(al => pegarJson(`https://api.deezer.com/album/${al.id}/tracks?limit=200`)));
    rs.forEach((r, k) => {
      if (r.status !== "fulfilled") return;
      const al = bloco[k];
      const album = { id: al.id, titulo: al.title, ano: String(al.release_date || "").slice(0, 4), tipo: al.record_type || "", capa: al.cover_medium || "" };
      for (const t of r.value.data || []) {
        if (t.artist?.id && t.artist.id !== id) continue; // coletâneas: só as dele
        out.push({ titulo: t.title, curto: t.title_short, duracao: (t.duration || 0) * 1000, album });
      }
    });
    aoProgresso(Math.min(albuns.length, i + 4), albuns.length);
    await new Promise(ok => setTimeout(ok, 250)); // o Deezer limita a 50 pedidos por 5 s
  }
  return out;
}
/** Um artista do Deezer pelo código (ou pelo link: https://www.deezer.com/br/artist/293283561). */
export function idDeezer(txt) {
  const t = String(txt || "").trim();
  return (t.match(/deezer\.(?:com|page\.link)\/(?:[a-z]{2}\/)?artist\/(\d+)/i) || t.match(/^(\d{1,12})$/) || [])[1] || null;
}
/** O código a partir de um link curto do app do Deezer (deezer.page.link/…, link.deezer.com/…): segue o link. */
export async function resolverLinkDeezer(txt) {
  const direto = idDeezer(txt); if (direto) return direto;
  const url = (String(txt).match(/https?:\/\/\S+/) || [])[0];
  if (!url || !/deezer/i.test(url)) return null;
  if (falso?.resolver) return falso.resolver(url);
  let final = "", corpo = "";
  if (Http) { const r = await Http.request({ url, method: "GET", connectTimeout: 12000, readTimeout: 12000 }); final = r.url || ""; corpo = typeof r.data === "string" ? r.data : JSON.stringify(r.data || ""); }
  else { const r = await fetch(url); final = r.url; corpo = await r.text(); }
  return idDeezer(final) || (corpo.match(/deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/i) || [])[1] || null;
}
export async function artistaDeezer(id) {
  if (falso?.artista) return falso.artista(id);
  const a = await pegarJson(`https://api.deezer.com/artist/${id}`);
  if (!a || a.error || !a.id) throw new Error("o Deezer não achou esse artista");
  return { id: a.id, nome: a.name, fas: a.nb_fan || 0, foto: a.picture_medium || "" };
}
