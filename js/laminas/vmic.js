// Leitor das lâminas digitais .vmic (PreciPoint ObjectScan; pedido do Alediov, 03/11/2026, para a prova prática de
// Patologia de 01/12). Puro, sem DOM: roda no app e no node (tools/laminas/teste_vmic.mjs).
//
// O formato (conferido num arquivo real de 150 MB):
//  - o .vmic é um ZIP com as entradas GUARDADAS (sem compressão): "Image.vmici" (quase todos os bytes, logo no começo)
//    e "[Content_Types].xml";
//  - o Image.vmici é outro ZIP (entradas em deflate, até os JPEG; nomes com barra invertida): dzc_output.xml (Deep Zoom:
//    TileSize, Overlap, Format, PixelPerMicron, UID e o tamanho), VMCF\config.osc (nome, data, objetiva),
//    VMCF\overview.jpg (foto da lâmina inteira, com a etiqueta) e dzc_output_files\<nível>\<coluna>_<linha>.jpg.
// Tudo por acesso aleatório: nunca lê o arquivo inteiro. A fonte é { tamanho, ler(inicio, n) → Promise<Uint8Array> }
// (um File/Blob no navegador; o plugin "Laminas" no Android, que junta as leituras do mesmo instante numa chamada só).
// O índice (nome → posição) pode ser guardado (slide.indice) e passado de volta em abrirVmic(fonte, { indice }).

export const VERSAO_INDICE = 1;
const TD = new TextDecoder("utf-8");
const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u64 = (b, i) => u32(b, i) + u32(b, i + 4) * 2 ** 32;

class ErroVmic extends Error {}

/** Lê exatamente n bytes (ou o que houver até o fim). */
async function lerFaixa(fonte, inicio, n) {
  n = Math.max(0, Math.min(n, fonte.tamanho - inicio));
  if (n <= 0) return new Uint8Array(0);
  return fonte.ler(inicio, n);
}

/** Fonte que enxerga só um pedaço de outra (o ZIP de dentro, guardado sem compressão no de fora). */
function subFonte(f, base, tamanho) {
  return { tamanho, ler: (i, n) => f.ler(base + i, n) };
}

/** Fim do diretório central (aceita ZIP64). → { entradas, tamanhoCD, inicioCD } */
async function fimDoZip(fonte) {
  const n = Math.min(fonte.tamanho, 65535 + 22 + 20);
  const ini = fonte.tamanho - n;
  const b = await lerFaixa(fonte, ini, n);
  let p = -1;
  for (let i = b.length - 22; i >= 0; i--) if (u32(b, i) === 0x06054b50) { p = i; break; }
  if (p < 0) throw new ErroVmic("Não é um arquivo .vmic (ZIP) válido.");
  let entradas = u16(b, p + 10), tamanhoCD = u32(b, p + 12), inicioCD = u32(b, p + 16);
  // ZIP64: o localizador fica logo antes do fim do diretório
  if ((entradas === 0xffff || tamanhoCD === 0xffffffff || inicioCD === 0xffffffff) && p >= 20 && u32(b, p - 20) === 0x07064b50) {
    const pos64 = u64(b, p - 20 + 8);
    const r = await lerFaixa(fonte, pos64, 56);
    if (u32(r, 0) !== 0x06064b50) throw new ErroVmic("ZIP64 com o fim do diretório estragado.");
    entradas = u64(r, 32); tamanhoCD = u64(r, 40); inicioCD = u64(r, 48);
  }
  return { entradas, tamanhoCD, inicioCD };
}

/** Lê o diretório central → [[nome, deslocamentoDoCabecalho, tamanhoComprimido, metodo, tamanho, tamanhoDoNome]]. */
async function diretorio(fonte) {
  const { entradas, tamanhoCD, inicioCD } = await fimDoZip(fonte);
  if (inicioCD + tamanhoCD > fonte.tamanho) throw new ErroVmic("O arquivo está incompleto (cortado na cópia?).");
  const b = await lerFaixa(fonte, inicioCD, tamanhoCD);
  const out = [];
  let p = 0;
  for (let k = 0; k < entradas && p + 46 <= b.length; k++) {
    if (u32(b, p) !== 0x02014b50) throw new ErroVmic("Diretório do ZIP estragado.");
    const metodo = u16(b, p + 10);
    let c = u32(b, p + 20), u = u32(b, p + 24), o = u32(b, p + 42);
    const nl = u16(b, p + 28), el = u16(b, p + 30), cl = u16(b, p + 32);
    const nome = TD.decode(b.subarray(p + 46, p + 46 + nl));
    // ZIP64: os campos com 0xFFFFFFFF vêm no extra 0x0001, nesta ordem
    if (u === 0xffffffff || c === 0xffffffff || o === 0xffffffff) {
      let q = p + 46 + nl;
      const fimExtra = q + el;
      while (q + 4 <= fimExtra) {
        const id = u16(b, q), tam = u16(b, q + 2);
        if (id === 1) {
          let r = q + 4;
          if (u === 0xffffffff) { u = u64(b, r); r += 8; }
          if (c === 0xffffffff) { c = u64(b, r); r += 8; }
          if (o === 0xffffffff) { o = u64(b, r); r += 8; }
          break;
        }
        q += 4 + tam;
      }
    }
    out.push([nome, o, c, metodo, u, nl]);
    p += 46 + nl + el + cl;
  }
  return out;
}

/** Descompacta deflate cru (método 8 do ZIP). */
export async function inflar(bytes) {
  if (typeof DecompressionStream === "undefined") throw new ErroVmic("Este aparelho não descompacta as lâminas (atualize o Android System WebView).");
  const ds = new DecompressionStream("deflate-raw");
  const r = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(r).arrayBuffer());
}

/** Dados de uma entrada: uma leitura só (cabeçalho local + bytes + folga para o extra). */
async function lerEntrada(fonte, e) {
  const [, o, c, metodo, , nl] = e;
  const folga = 64;
  let b = await lerFaixa(fonte, o, 30 + nl + folga + c);
  if (u32(b, 0) !== 0x04034b50) throw new ErroVmic("Entrada do ZIP estragada.");
  const ini = 30 + u16(b, 26) + u16(b, 28);
  let dados;
  if (ini + c <= b.length) dados = b.subarray(ini, ini + c);
  else dados = await lerFaixa(fonte, o + ini, c); // extra local maior que a folga (raro)
  if (metodo === 0) return dados;
  if (metodo === 8) return inflar(dados);
  throw new ErroVmic(`Compressão ${metodo} não suportada.`);
}

const atributo = (xml, nome) => xml.match(new RegExp(`\\b${nome}\\s*=\\s*"([^"]*)"`))?.[1];
const marca = (xml, nome) => xml.match(new RegExp(`<(?:[\\w-]+:)?${nome}>([^<]*)</(?:[\\w-]+:)?${nome}>`))?.[1]?.trim();
const semBOM = (s) => s.replace(/^﻿/, "");

/** dzc_output.xml (Deep Zoom) → { largura, altura, tile, overlap, formato, pxPorMicron, uid } */
export function lerDZI(xml) {
  xml = semBOM(xml);
  const img = xml.match(/<Image\b[^>]*>/)?.[0] || "";
  const size = xml.match(/<Size\b[^>]*>/)?.[0] || "";
  const largura = +atributo(size, "Width"), altura = +atributo(size, "Height");
  if (!(largura > 0 && altura > 0)) throw new ErroVmic("A lâmina não diz o tamanho da imagem.");
  return {
    largura, altura,
    tile: +atributo(img, "TileSize") || 256,
    overlap: +atributo(img, "Overlap") || 0,
    formato: (atributo(img, "Format") || "jpg").toLowerCase(),
    pxPorMicron: +atributo(img, "PixelPerMicron") || null,
    uid: atributo(img, "UID") || null,
  };
}

/** VMCF\config.osc (ObjectScan) → { nome, data, objetiva, aumentoObjetiva, tubo } (o que achar). */
export function lerConfig(xml) {
  xml = semBOM(xml || "");
  const obj = xml.match(/<(?:[\w-]+:)?Objective\b[\s\S]*?<\/(?:[\w-]+:)?Objective>/)?.[0] || "";
  const tubo = xml.match(/<(?:[\w-]+:)?TubeLense\b[\s\S]*?<\/(?:[\w-]+:)?TubeLense>/)?.[0] || "";
  const scan = xml.match(/<(?:[\w-]+:)?ScanData\b[\s\S]*?<\/(?:[\w-]+:)?ScanData>/)?.[0] || xml;
  return {
    nome: marca(scan, "Name") || null,
    data: marca(scan, "Start") || null,
    objetiva: marca(obj, "LongName") || null,
    aumentoObjetiva: +marca(obj, "Magnification") || null,
    tubo: +marca(tubo, "Magnification") || null,
    pxPorMicron: +marca(xml, "PixelPerMicron") || null,
  };
}

/** Níveis do Deep Zoom: 0 (1×1) até o máximo (resolução cheia). */
export function niveisDe(largura, altura) { return Math.ceil(Math.log2(Math.max(largura, altura))); }
export function tamanhoDoNivel(info, n) {
  const k = 2 ** (info.nivelMax - n);
  return [Math.max(1, Math.ceil(info.largura / k)), Math.max(1, Math.ceil(info.altura / k))];
}
export function tilesDoNivel(info, n) {
  const [w, h] = tamanhoDoNivel(info, n);
  return [Math.ceil(w / info.tile), Math.ceil(h / info.tile)];
}

const norm = (s) => s.replace(/\\/g, "/");
const TIPOS = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Abre uma lâmina. `indice`: o que um slide anterior devolveu em `slide.indice` (pula a leitura dos diretórios).
 * → { info, indice, overview(), tile(n, x, y), arquivo(nome), lerTexto(nome) }
 */
export async function abrirVmic(fonte, { indice = null, maxCache = 300 } = {}) {
  let ix = indice && indice.v === VERSAO_INDICE ? indice : null;
  if (!ix) ix = await montarIndice(fonte);
  const interna = subFonte(fonte, ix.base, ix.tamanhoInterno);
  const mapa = new Map();
  for (const e of ix.entradas) mapa.set(e[0], e);
  const info = ix.info;
  const tipo = TIPOS[info.formato] || "image/jpeg";
  const pasta = ix.pastaTiles;
  const cache = new Map(); // nome → Blob (LRU)
  const lendo = new Map();

  async function arquivo(nome) {
    const e = mapa.get(norm(nome));
    if (!e) return null;
    return lerEntrada(interna, e);
  }
  async function blobDe(nome, mime) {
    if (cache.has(nome)) { const b = cache.get(nome); cache.delete(nome); cache.set(nome, b); return b; }
    if (lendo.has(nome)) return lendo.get(nome);
    const p = (async () => {
      const bytes = await arquivo(nome);
      if (!bytes) return null;
      const b = new Blob([bytes], { type: mime });
      cache.set(nome, b);
      while (cache.size > maxCache) cache.delete(cache.keys().next().value);
      return b;
    })().finally(() => lendo.delete(nome));
    lendo.set(nome, p);
    return p;
  }
  return {
    info,
    indice: ix,
    temTile: (n, x, y) => mapa.has(`${pasta}/${n}/${x}_${y}.${ix.extTiles}`),
    tile: (n, x, y) => {
      const nome = `${pasta}/${n}/${x}_${y}.${ix.extTiles}`;
      return mapa.has(nome) ? blobDe(nome, tipo) : Promise.resolve(null);
    },
    overview: () => (ix.overview ? blobDe(ix.overview, "image/jpeg") : Promise.resolve(null)),
    arquivo,
    lerTexto: async (nome) => { const b = await arquivo(nome); return b ? semBOM(TD.decode(b)) : null; },
  };
}

/** Lê os dois diretórios e os XML. */
async function montarIndice(fonte) {
  if (!(fonte.tamanho > 22)) throw new ErroVmic("Arquivo vazio.");
  const fora = await diretorio(fonte);
  // o Image.vmici sozinho (pedido do Alediov, 04/11/2026: as lâminas que vieram pelo WhatsApp num .zip, que extraído
  // dá a pasta com [Content_Types].xml e Image.vmici): o arquivo já é o ZIP de dentro, com o Deep Zoom na raiz
  const solto = fora.some(e => /(^|[\\/])dzc_output\.xml$|\.dzi$/i.test(e[0]) || /_files[\\/]\d+[\\/]/i.test(e[0]));
  let base = 0, tamanhoInterno = fonte.tamanho;
  if (!solto) {
    const ent = fora.find(e => /\.vmici$/i.test(e[0])) || fora.find(e => /image/i.test(e[0]));
    if (!ent) throw new ErroVmic("O .vmic não tem a imagem (Image.vmici).");
    if (ent[3] !== 0) throw new ErroVmic("Este .vmic está compactado por fora; o app só lê os guardados sem compressão.");
    const cab = await lerFaixa(fonte, ent[1], 30);
    if (u32(cab, 0) !== 0x04034b50) throw new ErroVmic("Cabeçalho da imagem estragado.");
    base = ent[1] + 30 + u16(cab, 26) + u16(cab, 28);
    tamanhoInterno = ent[2];
  }
  const interna = subFonte(fonte, base, tamanhoInterno);
  const dentro = (await diretorio(interna)).map(e => [norm(e[0]), e[1], e[2], e[3], e[4], e[5]]);
  const mapa = new Map(dentro.map(e => [e[0], e]));
  const texto = async (nome) => { const e = mapa.get(nome); return e ? semBOM(TD.decode(await lerEntrada(interna, e))) : null; };
  // o .xml do Deep Zoom: dzc_output.xml (ou outro .xml/.dzi na raiz com a pasta <nome>_files ao lado)
  const xmlNome = mapa.has("dzc_output.xml") ? "dzc_output.xml"
    : dentro.map(e => e[0]).find(n => /^[^/]+\.(xml|dzi)$/i.test(n) && dentro.some(x => x[0].startsWith(n.replace(/\.(xml|dzi)$/i, "_files/"))));
  if (!xmlNome) throw new ErroVmic("O .vmic não tem a pirâmide Deep Zoom.");
  const dzi = lerDZI(await texto(xmlNome));
  const cfgNome = dentro.map(e => e[0]).find(n => /(^|\/)config\.osc$/i.test(n));
  const cfg = lerConfig(cfgNome ? await texto(cfgNome) : "");
  const overview = dentro.map(e => e[0]).find(n => /(^|\/)overview\.(jpe?g|png)$/i.test(n)) || null;
  const pastaTiles = xmlNome.replace(/\.(xml|dzi)$/i, "_files");
  const extTiles = dzi.formato === "jpeg" ? "jpeg" : dzi.formato;
  const nivelMax = niveisDe(dzi.largura, dzi.altura);
  // só as entradas que o app usa (os tiles, o overview e os textos); o resto (js, css, imagens do visor deles) fica fora
  const entradas = dentro.filter(e => e[0].startsWith(pastaTiles + "/") || e[0] === overview || e[0].startsWith("VMCF/") || e[0] === xmlNome);
  const niveis = new Set(entradas.filter(e => e[0].startsWith(pastaTiles + "/")).map(e => +e[0].split("/")[1]));
  const info = {
    nome: cfg.nome, data: cfg.data, objetiva: cfg.objetiva, aumentoObjetiva: cfg.aumentoObjetiva, tubo: cfg.tubo,
    largura: dzi.largura, altura: dzi.altura, tile: dzi.tile, overlap: dzi.overlap, formato: dzi.formato,
    pxPorMicron: dzi.pxPorMicron || cfg.pxPorMicron, uid: dzi.uid, nivelMax,
    niveis: [...niveis].filter(Number.isFinite).sort((a, b) => a - b),
  };
  return { v: VERSAO_INDICE, base, tamanhoInterno, tamanho: fonte.tamanho, pastaTiles, extTiles, overview, info, entradas };
}

/** Fonte a partir de um File/Blob (navegador e node). */
export function fonteDeBlob(b) {
  return { tamanho: b.size, ler: async (i, n) => new Uint8Array(await b.slice(i, i + n).arrayBuffer()) };
}

/** Aumento aproximado na tela, como o de uma objetiva de microscópio: 0,25 µm por pixel = 40× (a convenção das lâminas
 *  digitais), então aumento = 10 × px/µm × escala (escala = pixels da tela por pixel da imagem cheia). Acima da escala 1
 *  é só zoom digital (nenhum detalhe novo). */
export function aumentoNaTela(pxPorMicron, escala) { return pxPorMicron ? 10 * pxPorMicron * escala : null; }
