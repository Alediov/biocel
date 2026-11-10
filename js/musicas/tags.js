// Leitura de tags no navegador (usada fora do Android: notebook e testes; no celular quem lê é o plugin nativo).
// ID3v2.2/2.3/2.4 (MP3), FLAC (Vorbis comment, PICTURE, STREAMINFO) e MP4/M4A (ilst, mvhd).
// Devolve { titulo, artista, album, albumArtista, genero, ano, faixa, duracao (ms), nota (0 a 10, meias estrelas), capa (Blob) }.

const bytes = async (file, ini, fim) => new Uint8Array(await file.slice(ini, fim).arrayBuffer());
const latin1 = (u) => { let s = ""; for (const c of u) s += String.fromCharCode(c); return s; };
const be32 = (u, i) => ((u[i] << 24) >>> 0) + (u[i + 1] << 16) + (u[i + 2] << 8) + u[i + 3];
const le32 = (u, i) => u[i] + (u[i + 1] << 8) + (u[i + 2] << 16) + ((u[i + 3] << 24) >>> 0);
const sync = (u, i) => (u[i] << 21) | (u[i + 1] << 14) | (u[i + 2] << 7) | u[i + 3];
const limpar = (s) => (s || "").replace(/\0+$/g, "").split("\0").filter(Boolean).join("; ").trim();

/** POPM (0 a 255, escala do MusicBee e do Windows) → 0 a 10 meias estrelas. */
export function notaDoPopm(v) {
  if (!v) return 0;
  const tabela = [[1, 2], [13, 1], [54, 3], [64, 4], [118, 5], [128, 6], [186, 7], [196, 8], [242, 9], [255, 10]];
  let melhor = 0, dist = 1e9;
  for (const [b, n] of tabela) if (Math.abs(b - v) < dist) { dist = Math.abs(b - v); melhor = n; }
  return melhor;
}

export async function lerTagsArquivo(file) {
  const cab = await bytes(file, 0, 12);
  try {
    if (latin1(cab.subarray(0, 3)) === "ID3") return await id3(file);
    if (latin1(cab.subarray(0, 4)) === "fLaC") return await flac(file, 4);
    if (latin1(cab.subarray(4, 8)) === "ftyp") return await mp4(file);
    if ((cab[0] === 0xff && (cab[1] & 0xe0) === 0xe0)) return { duracao: await duracaoMp3(file, 0) };
  } catch (e) { console.warn("tags:", file.name, e.message); }
  return {};
}

function texto(u, enc) {
  if (enc === 0) return latin1(u);
  if (enc === 3) return new TextDecoder("utf-8").decode(u);
  if (enc === 1) {
    if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder("utf-16be").decode(u.subarray(2));
    if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder("utf-16le").decode(u.subarray(2));
    return new TextDecoder("utf-16le").decode(u);
  }
  return new TextDecoder("utf-16be").decode(u);
}
// fim de uma string terminada em zero (1 ou 2 bytes conforme a codificação)
function fimTexto(u, i, enc) {
  if (enc === 1 || enc === 2) { while (i + 1 < u.length && !(u[i] === 0 && u[i + 1] === 0)) i += 2; return [i, i + 2]; }
  while (i < u.length && u[i] !== 0) i++;
  return [i, i + 1];
}

async function id3(file) {
  const h = await bytes(file, 0, 10), ver = h[3], tam = sync(h, 6) + 10;
  const u = await bytes(file, 0, tam);
  const t = {};
  let i = 10;
  if (h[5] & 0x40 && ver >= 3) i += ver === 4 ? sync(u, 10) : be32(u, 10) + 4; // cabeçalho estendido
  const curto = ver === 2;
  const MAPA = curto
    ? { TT2: "titulo", TP1: "artista", TAL: "album", TP2: "albumArtista", TCO: "genero", TYE: "ano", TRK: "faixa" }
    : { TIT2: "titulo", TPE1: "artista", TALB: "album", TPE2: "albumArtista", TCON: "genero", TYER: "ano", TDRC: "ano", TRCK: "faixa" };
  while (i + (curto ? 6 : 10) <= tam) {
    const id = latin1(u.subarray(i, i + (curto ? 3 : 4)));
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const n = curto ? (u[i + 3] << 16) + (u[i + 4] << 8) + u[i + 5] : ver === 4 ? sync(u, i + 4) : be32(u, i + 4);
    const ini = i + (curto ? 6 : 10), d = u.subarray(ini, ini + n);
    if (MAPA[id] && d.length) t[MAPA[id]] = limpar(texto(d.subarray(1), d[0]));
    else if ((id === "APIC" || id === "PIC") && !t.capa) {
      const enc = d[0];
      let j, mime;
      if (curto) { mime = "image/" + latin1(d.subarray(1, 4)).toLowerCase().replace("jpg", "jpeg"); j = 4; }
      else { const [f, prox] = fimTexto(d, 1, 0); mime = latin1(d.subarray(1, f)) || "image/jpeg"; j = prox; }
      j += 1; // tipo da figura
      const [, depoisDesc] = fimTexto(d, j, enc);
      t.capa = new Blob([d.subarray(depoisDesc)], { type: mime.includes("/") ? mime : "image/" + mime });
    } else if ((id === "POPM" || id === "POP") && t.nota == null) {
      const [, k] = fimTexto(d, 0, 0);
      t.nota = notaDoPopm(d[k]);
    }
    i = ini + n;
  }
  if (t.genero) t.genero = t.genero.replace(/^\((\d+)\)/, "").trim() || t.genero;
  if (t.ano) t.ano = t.ano.slice(0, 4);
  t.duracao = await duracaoMp3(file, tam);
  return t;
}

const TAXAS = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const BITS1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITS2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
async function duracaoMp3(file, ini) {
  const u = await bytes(file, ini, ini + 16384);
  for (let i = 0; i + 4 < u.length; i++) {
    if (u[i] !== 0xff || (u[i + 1] & 0xe0) !== 0xe0) continue;
    const v = (u[i + 1] >> 3) & 3, camada = (u[i + 1] >> 1) & 3, bi = u[i + 2] >> 4, ti = (u[i + 2] >> 2) & 3;
    if (v === 1 || camada !== 1 || bi === 0 || bi === 15 || ti === 3) continue;
    const taxa = TAXAS[v][ti], kbps = (v === 3 ? BITS1 : BITS2)[bi], mono = (u[i + 3] >> 6) === 3;
    const amostras = v === 3 ? 1152 : 576;
    const xing = i + 4 + (v === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17));
    const marca = latin1(u.subarray(xing, xing + 4));
    if ((marca === "Xing" || marca === "Info") && (u[xing + 7] & 1)) return Math.round(be32(u, xing + 8) * amostras / taxa * 1000);
    return Math.round((file.size - ini) * 8 / (kbps * 1000) * 1000);
  }
  return 0;
}

async function flac(file, ini) {
  const t = {};
  let i = ini, ultimo = false;
  while (!ultimo && i + 4 <= file.size) {
    const h = await bytes(file, i, i + 4);
    ultimo = !!(h[0] & 0x80);
    const tipo = h[0] & 0x7f, n = (h[1] << 16) + (h[2] << 8) + h[3];
    if (tipo === 0 || tipo === 4 || tipo === 6) {
      const d = await bytes(file, i + 4, i + 4 + n);
      if (tipo === 0) {
        const taxa = (d[10] << 12) + (d[11] << 4) + (d[12] >> 4);
        const total = (d[13] & 0x0f) * 2 ** 32 + be32(d, 14);
        if (taxa) t.duracao = Math.round(total / taxa * 1000);
      } else if (tipo === 4) {
        let j = 4 + le32(d, 0);
        const qtd = le32(d, j); j += 4;
        const dec = new TextDecoder("utf-8");
        for (let k = 0; k < qtd && j + 4 <= d.length; k++) {
          const m = le32(d, j); j += 4;
          const s = dec.decode(d.subarray(j, j + m)); j += m;
          const p = s.indexOf("="); if (p < 0) continue;
          const chave = s.slice(0, p).toUpperCase(), valor = s.slice(p + 1).trim();
          const campo = { TITLE: "titulo", ARTIST: "artista", ALBUM: "album", ALBUMARTIST: "albumArtista", "ALBUM ARTIST": "albumArtista", GENRE: "genero", DATE: "ano", YEAR: "ano", TRACKNUMBER: "faixa" }[chave];
          if (campo) t[campo] = t[campo] ? `${t[campo]}; ${valor}` : valor;
          else if (chave === "RATING" && t.nota == null) { const v = +valor; t.nota = v > 5 ? Math.round(v / 10) : Math.round(v * 2); }
          else if (chave === "FMPS_RATING" && t.nota == null) t.nota = Math.round(+valor * 10);
        }
      } else if (tipo === 6 && !t.capa) {
        let j = 4;
        const lm = be32(d, j); j += 4;
        const mime = latin1(d.subarray(j, j + lm)); j += lm;
        j += 4 + be32(d, j) + 16;
        const ld = be32(d, j); j += 4;
        t.capa = new Blob([d.subarray(j, j + ld)], { type: mime || "image/jpeg" });
      }
    }
    i += 4 + n;
  }
  if (t.ano) t.ano = t.ano.slice(0, 4);
  return t;
}

async function mp4(file) {
  const t = {};
  // acha o moov entre os átomos do topo
  let i = 0, moov = null;
  while (i + 8 <= file.size) {
    const h = await bytes(file, i, i + 16);
    let n = be32(h, 0);
    const tipo = latin1(h.subarray(4, 8));
    let cab = 8;
    if (n === 1) { n = be32(h, 8) * 2 ** 32 + be32(h, 12); cab = 16; }
    if (n === 0) n = file.size - i;
    if (n < 8) break;
    if (tipo === "moov") { moov = await bytes(file, i + cab, i + n); break; }
    i += n;
  }
  if (!moov) return t;
  const filhos = (u, ini, fim, fn) => {
    let j = ini;
    while (j + 8 <= fim) {
      const n = be32(u, j), tipo = latin1(u.subarray(j + 4, j + 8));
      if (n < 8 || j + n > fim) break;
      fn(tipo, j + 8, j + n);
      j += n;
    }
  };
  const ITENS = { "©nam": "titulo", "©ART": "artista", "©alb": "album", aART: "albumArtista", "©gen": "genero", "©day": "ano" };
  filhos(moov, 0, moov.length, (tipo, a, b) => {
    if (tipo === "mvhd") {
      const v = moov[a];
      const escala = v === 1 ? be32(moov, a + 20) : be32(moov, a + 12);
      const dur = v === 1 ? be32(moov, a + 24) * 2 ** 32 + be32(moov, a + 28) : be32(moov, a + 16);
      if (escala) t.duracao = Math.round(dur / escala * 1000);
    }
    if (tipo !== "udta") return;
    filhos(moov, a, b, (t2, a2, b2) => {
      if (t2 !== "meta") return;
      filhos(moov, a2 + 4, b2, (t3, a3, b3) => {
        if (t3 !== "ilst") return;
        filhos(moov, a3, b3, (item, a4, b4) => {
          filhos(moov, a4, b4, (d, a5, b5) => {
            if (d !== "data") return;
            const tipoDado = be32(moov, a5) & 0xffffff, valor = moov.subarray(a5 + 8, b5);
            if (ITENS[item]) t[ITENS[item]] = new TextDecoder("utf-8").decode(valor);
            else if (item === "trkn" && valor.length >= 4) t.faixa = String((valor[2] << 8) + valor[3]);
            else if (item === "covr" && !t.capa) t.capa = new Blob([valor], { type: tipoDado === 14 ? "image/png" : "image/jpeg" });
          });
        });
      });
    });
  });
  if (t.ano) t.ano = t.ano.slice(0, 4);
  return t;
}
