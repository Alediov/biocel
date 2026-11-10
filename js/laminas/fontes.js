// De onde vêm as lâminas digitais (.vmic) e o que fica guardado delas NESTE aparelho (nada disso sincroniza; os
// arquivos nunca saem do aparelho: o GitHub nem aceita arquivos de 150 MB).
//  - Android: uma pasta do cartão SD escolhida pelo Storage Access Framework (plugin nativo "Laminas", LaminasPlugin.java:
//    escolherPasta, pasta, listar, lerTrechos, info, fechar). A leitura dos tiles é por trechos: tudo o que o visor pede no
//    mesmo instante vai numa chamada só (`lerTrechos` com a lista), lido por posição num FileChannel aberto.
//  - navegador/notebook: showDirectoryPicker (o handle fica no IndexedDB) ou arquivos escolhidos (só nesta sessão).
// IndexedDB "orbita-laminas" (loja "kv"): `ix:<chave>` o índice do ZIP (abrir de novo é instantâneo), `res:<chave>` o
// resumo do cartão (uid, nome, tamanho, miniatura do tecido e a etiqueta) e `pasta` (o handle do navegador).
// A chave de um arquivo é a identidade dele: endereço (ou nome) + tamanho + data de modificação.
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import { abrirVmic, fonteDeBlob, tamanhoDoNivel, tilesDoNivel } from "./vmic.js";

export const nativo = !!Capacitor.isNativePlatform?.();
const Plug = nativo ? registerPlugin("Laminas") : null;
// o Google Drive das lâminas (pedido do Alediov, 04/11/2026; DriveLaminasPlugin.java: login do Play services com
// drive.readonly, leitura por Range). No navegador, um Drive de mentira (`_driveFalso`) para o teste de fumaça.
const PlugD = nativo ? registerPlugin("DriveLaminas") : null;
const CH_PASTA = "orbita.laminas.pasta", CH_DRIVE = "orbita.laminas.drive";

// ---------------------------------------------------------------- IndexedDB
let bancoP = null;
function banco() {
  return (bancoP ??= new Promise((ok, erro) => {
    const r = indexedDB.open("orbita-laminas", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  }));
}
async function kv(modo, fn) {
  const db = await banco();
  return new Promise((ok, erro) => {
    const t = db.transaction("kv", modo), st = t.objectStore("kv");
    const r = fn(st);
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => erro(t.error);
  });
}
export const pegar = (k) => kv("readonly", st => st.get(k)).catch(() => null);
export const guardar = (k, v) => kv("readwrite", st => st.put(v, k)).catch(() => null);
const apagar = (k) => kv("readwrite", st => st.delete(k)).catch(() => null);

// ---------------------------------------------------------------- base64 (resposta do plugin)
function deBase64(s) {
  const bin = atob(s), n = bin.length, out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Fonte nativa: as leituras pedidas no mesmo instante vão juntas numa chamada `lerTrechos`. */
function fonteNativa(uri, tamanho) {
  let fila = [], timer = null;
  const enviar = async () => {
    const lote = fila; fila = []; timer = null;
    try {
      const r = await Plug.lerTrechos({ uri, trechos: lote.map(x => [x.i, x.n]) });
      lote.forEach((x, k) => (r.dados?.[k] != null ? x.ok(deBase64(r.dados[k])) : x.erro(new Error("trecho faltando"))));
    } catch (e) { lote.forEach(x => x.erro(e)); }
  };
  return {
    tamanho,
    ler: (i, n) => new Promise((ok, erro) => {
      fila.push({ i, n, ok, erro });
      if (fila.length >= 48) { clearTimeout(timer); enviar(); } else if (!timer) timer = setTimeout(enviar, 0);
    }),
  };
}

/** Fonte do Drive: como a nativa, com o id do arquivo no lugar do endereço. */
function fonteDrive(id, tamanho) {
  let fila = [], timer = null;
  const enviar = async () => {
    const lote = fila; fila = []; timer = null;
    try {
      const r = PlugD ? await PlugD.lerTrechos({ id, trechos: lote.map(x => [x.i, x.n]) }) : await _driveFalso.lerTrechos(id, lote.map(x => [x.i, x.n]));
      lote.forEach((x, k) => (r.dados?.[k] != null ? x.ok(typeof r.dados[k] === "string" ? deBase64(r.dados[k]) : r.dados[k]) : x.erro(new Error("trecho faltando"))));
    } catch (e) {
      const m = String(e?.message || e);
      lote.forEach(x => x.erro(new Error(/reconectar/.test(m) ? "Conecte o Google Drive de novo (na biblioteca das lâminas)." : /limite_do_drive/.test(m) ? "O Drive pediu uma pausa: tente daqui a pouco." : "Não consegui ler do Drive (sem internet?).")));
    }
  };
  return {
    tamanho,
    ler: (i, n) => new Promise((ok, erro) => {
      fila.push({ i, n, ok, erro });
      if (fila.length >= 32) { clearTimeout(timer); enviar(); } else if (!timer) timer = setTimeout(enviar, 0);
    }),
  };
}

/** Um Drive de mentira (navegador): arquivos guardados na memória, para o teste de fumaça. */
export const _driveFalso = {
  arquivos: new Map(), conta: "",
  async lerTrechos(id, trechos) {
    const f = this.arquivos.get(id); if (!f) throw new Error("drive 404");
    return { dados: await Promise.all(trechos.map(async ([i, n]) => new Uint8Array(await f.slice(i, i + n).arrayBuffer()))) };
  },
};

/** O Drive das lâminas: { conectado, conta }. */
export async function driveSituacao() {
  if (PlugD) { try { const r = await PlugD.situacao(); gravarLS(CH_DRIVE, r.conectado ? { conta: r.conta || "" } : null); return r; } catch { return { conectado: false, conta: "" }; } }
  const r = lerLS(CH_DRIVE);
  return { conectado: !!r, conta: r?.conta || "" };
}
/** Conecta a conta Google das lâminas (escolha da conta e permissão de leitura do Drive). */
export async function driveConectar() {
  if (PlugD) {
    try { const r = await PlugD.conectar(); gravarLS(CH_DRIVE, { conta: r.conta || "" }); return r; }
    catch (e) {
      const m = String(e?.message || e);
      if (/cancelado/.test(m)) throw new Error("cancelado");
      if (/cliente_android/.test(m)) throw new Error("O Google recusou o app: confira o cliente Android no Google Cloud (pacote br.alediov.odontoquest e o SHA-1).");
      if (/sem_rede/.test(m)) throw new Error("Sem internet.");
      throw new Error(`Não consegui conectar (${m}).`);
    }
  }
  _driveFalso.conta = "laminas@exemplo.com";
  gravarLS(CH_DRIVE, { conta: _driveFalso.conta });
  return { conectado: true, conta: _driveFalso.conta };
}
export async function driveDesconectar() {
  if (PlugD) await PlugD.desconectar().catch(() => {});
  gravarLS(CH_DRIVE, null);
}
async function listarDrive() {
  if (PlugD) return (await PlugD.listar()).arquivos || [];
  return [..._driveFalso.arquivos].map(([id, f]) => ({ id, nome: f.name, tamanho: f.size, modificado: f.lastModified, pasta: f.pasta || "Lâminas" }));
}

/** O nome que aparece no cartão: o do arquivo sem a extensão ou, no Image.vmici solto (todas as lâminas extraídas de um
 *  .zip se chamam assim), o da pasta onde ele está. */
export function tituloDe(it) {
  const base = String(it?.nome || "").replace(/\.vmici?$/i, "");
  if (!/^image$/i.test(base)) return base;
  const partes = String(it.caminho || "").split("/").filter(Boolean);
  const pasta = it.pastaDrive || (partes.length > 1 ? partes[partes.length - 2] : "");
  return pasta || base;
}

// ---------------------------------------------------------------- baixar do Drive para a pasta (pedido do Alediov, 04/11/2026)
// "daria para baixar essas lâminas automaticamente para a pasta escolhida?": as do Drive que não estão na pasta do
// cartão vão para <pasta>/<pasta do Drive>/ por um serviço em primeiro plano (DriveLaminasService), só no Wi-Fi. Depois
// a mesma lâmina (nome + tamanho) aparece uma vez só, a do cartão, que abre sem internet.
const CH_AUTO = "orbita.laminas.autoBaixar";
export const baixarSozinho = () => lerLS(CH_AUTO) !== false;
export const definirBaixarSozinho = (v) => gravarLS(CH_AUTO, !!v);
export const podeBaixar = () => !!PlugD;
/** A pasta deixa gravar? (a escolhida antes de 04/11/2026 só tinha leitura) */
export async function pastaGrava() {
  if (!Plug) return false;
  try { return !!(await Plug.pasta())?.escrita; } catch { return false; }
}
/** Começa o download das lâminas `itens` (as do Drive) para a pasta. Erro "sem_escrita": escolher a pasta de novo. */
export async function baixarParaPasta(itens) {
  const p = await pastaAtual();
  if (!p?.uri) throw new Error("sem_pasta");
  const arquivos = itens.filter(i => i.drive).map(i => ({ id: i.drive, nome: i.nome, tamanho: i.tamanho, pasta: i.pastaDrive || "" }));
  try { return await PlugD.baixar({ arvore: p.uri, arquivos, soWifi: true }); }
  catch (e) { throw new Error(/sem_escrita/.test(String(e?.message || e)) ? "sem_escrita" : String(e?.message || e)); }
}
export async function estadoDownload() { if (!PlugD) return { rodando: false }; try { return await PlugD.estadoDownload(); } catch { return { rodando: false }; } }
export async function pararDownload() { if (PlugD) await PlugD.pararDownload().catch(() => {}); }
/** fn(estado) a cada mudança do download; devolve a função que para de ouvir. */
export function ouvirDownload(fn) {
  if (!PlugD) return () => {};
  let h = null, fora = false;
  Promise.resolve(PlugD.addListener("download", fn)).then(x => { h = x; if (fora) h?.remove?.(); }).catch(() => {});
  return () => { fora = true; h?.remove?.(); };
}

// ---------------------------------------------------------------- a pasta e a lista
const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

const daSessao = new Map(); // chave → item (arquivos escolhidos no navegador; somem ao fechar o app)

const itemDeArquivo = (f, caminho = f.name) => ({ chave: `f:${caminho}|${f.size}|${f.lastModified}`, nome: f.name, caminho, tamanho: f.size, modificado: f.lastModified, arquivo: f });

/** Arquivos .vmic escolhidos (navegador): ficam na lista até fechar o app. */
export function adicionarArquivos(files) {
  const novos = [];
  for (const f of files || []) if (/\.vmici?$/i.test(f.name)) { const it = itemDeArquivo(f); daSessao.set(it.chave, it); novos.push(it); }
  return novos;
}

export const temPastaNoNavegador = () => !nativo && typeof window.showDirectoryPicker === "function";

/** A pasta escolhida: { nome } ou null. */
export async function pastaAtual() {
  if (nativo) {
    const p = lerLS(CH_PASTA);
    if (p?.uri) return p;
    try { const r = await Plug.pasta(); if (r?.uri) { gravarLS(CH_PASTA, r); return r; } } catch { /* sem pasta */ }
    return null;
  }
  const h = await pegar("pasta");
  return h ? { nome: h.name, handle: h } : null;
}

/** Escolhe (ou troca) a pasta das lâminas. */
export async function escolherPasta() {
  if (nativo) {
    const r = await Plug.escolherPasta();
    gravarLS(CH_PASTA, { uri: r.uri, nome: r.nome });
    return r;
  }
  const h = await window.showDirectoryPicker({ id: "laminas", mode: "read" });
  await guardar("pasta", h);
  return { nome: h.name, handle: h };
}

async function percorrerHandle(dir, prefixo, out, nivel = 0) {
  for await (const [nome, h] of dir.entries()) {
    if (nome.startsWith(".")) continue;
    if (h.kind === "directory") { if (nivel < 6) await percorrerHandle(h, `${prefixo}${nome}/`, out, nivel + 1); }
    else if (/\.vmici?$/i.test(nome)) { const f = await h.getFile(); out.push(itemDeArquivo(f, prefixo + nome)); }
  }
}

/**
 * As lâminas disponíveis neste aparelho. → { pasta, itens, precisaPermissao, erro }
 * `pedir`: no navegador, pode pedir a permissão da pasta (precisa de um toque do usuário).
 */
/** O erro do Drive em palavras, com o código quando o Drive respondeu (antes tudo virava "sem internet?"). */
export function erroDoDrive(m) {
  m = String(m || "");
  if (/reconectar/.test(m)) return "A permissão do Google Drive venceu: toque em Conectar de novo.";
  if (/limite_do_drive/.test(m)) return `O Google Drive pediu uma pausa (${m.replace(/\D+/g, " ").trim() || "limite"}): tente de novo daqui a alguns minutos.`;
  const cod = m.match(/drive (\d{3})(?::\s*(.*))?/);
  if (cod) return `O Google Drive recusou a lista (erro ${cod[1]}${cod[2] ? ": " + cod[2] : ""}).`;
  if (/UnknownHost|Unable to resolve|timeout|timed out|ConnectException|SocketException|Failed to fetch|network/i.test(m)) return "Não consegui falar com o Google Drive: o celular está sem internet?";
  return `Não consegui ler o Google Drive (${m.slice(0, 120) || "erro desconhecido"}).`;
}

export async function listar({ pedir = false } = {}) {
  const pasta = await pastaAtual();
  const itens = [...daSessao.values()];
  let precisaPermissao = false, erro = null;
  if (pasta && nativo) {
    try {
      const r = await Plug.listar({ uri: pasta.uri });
      for (const a of r.arquivos || []) itens.push({ chave: `u:${a.uri}|${a.tamanho}|${a.modificado}`, nome: a.nome, caminho: a.caminho, tamanho: a.tamanho, modificado: a.modificado, uri: a.uri });
    } catch (e) {
      erro = /sem_permissao/.test(String(e?.message || e)) ? "O app perdeu a permissão da pasta. Escolha a pasta de novo." : "Não consegui ler a pasta.";
    }
  } else if (pasta?.handle) {
    try {
      let p = await pasta.handle.queryPermission?.({ mode: "read" });
      if (p !== "granted" && pedir) p = await pasta.handle.requestPermission?.({ mode: "read" });
      if (p === "granted" || p === undefined) await percorrerHandle(pasta.handle, "", itens);
      else precisaPermissao = true;
    } catch { erro = "Não consegui ler a pasta."; }
  }
  // o Drive (com a conta conectada): os .vmic de lá; a mesma lâmina no cartão e no Drive fica uma vez só (a do cartão,
  // mais rápida), pelo nome e o tamanho
  let drive = null;
  if (lerLS(CH_DRIVE)) {
    drive = { conta: lerLS(CH_DRIVE).conta || "", n: 0 };
    try {
      const locais = new Set(itens.map(i => `${i.nome}|${i.tamanho}`));
      for (const a of await listarDrive()) {
        if (locais.has(`${a.nome}|${a.tamanho}`)) continue;
        itens.push({ chave: `d:${a.id}|${a.tamanho}|${a.modificado}`, nome: a.nome, caminho: `Drive/${a.pasta ? a.pasta + "/" : ""}${a.nome}`, tamanho: a.tamanho, modificado: a.modificado, drive: a.id, pastaDrive: a.pasta || "" });
        drive.n++;
      }
    } catch (e) {
      const m = String(e?.message || e);
      drive.erro = erroDoDrive(m);
    }
  }
  const vistos = new Set();
  const unicos = itens.filter(i => !vistos.has(i.chave) && vistos.add(i.chave));
  return { pasta, itens: unicos, precisaPermissao, erro, drive };
}

// ---------------------------------------------------------------- abrir
const abertos = new Map(); // chave → Promise<slide> (os 3 mais recentes)

/** Abre a lâmina de um item da lista (com o índice guardado, quando houver). */
export function abrir(item) {
  if (abertos.has(item.chave)) { const p = abertos.get(item.chave); abertos.delete(item.chave); abertos.set(item.chave, p); return p; }
  const p = (async () => {
    const fonte = item.drive ? fonteDrive(item.drive, item.tamanho)
      : item.uri ? fonteNativa(item.uri, item.tamanho || (await Plug.info({ uri: item.uri })).tamanho) : fonteDeBlob(item.arquivo);
    const ix = await pegar(`ix:${item.chave}`);
    if (ix && ix.tamanho === fonte.tamanho) {
      try { return await abrirVmic(fonte, { indice: ix, maxCache: 160 }); } catch { await apagar(`ix:${item.chave}`); }
    }
    const s = await abrirVmic(fonte, { maxCache: 160 });
    guardar(`ix:${item.chave}`, s.indice);
    return s;
  })();
  p.catch(() => abertos.delete(item.chave));
  abertos.set(item.chave, p);
  while (abertos.size > 3) abertos.delete(abertos.keys().next().value);
  return p;
}

/** Fecha os arquivos abertos no Android (o plugin guarda no máximo 3 abertos de qualquer jeito). */
export function fecharTudo() { abertos.clear(); if (nativo) Plug.fechar({}).catch?.(() => {}); }

// ---------------------------------------------------------------- resumo do cartão (com as miniaturas)
const bitmap = async (blob) => (blob ? createImageBitmap(blob) : null);
const paraBlob = (c, q = 0.82) => new Promise(ok => c.toBlob(ok, "image/jpeg", q));

/** A lâmina inteira pequena (o nível da pirâmide com até ~480 px). */
export async function miniaturaTecido(slide, lado = 480) {
  const i = slide.info;
  const L = Math.max(0, i.nivelMax - Math.max(0, Math.ceil(Math.log2(Math.max(i.largura, i.altura) / lado))));
  const [w, h] = tamanhoDoNivel(i, L), [cx, cy] = tilesDoNivel(i, L);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  const pedidos = [];
  for (let x = 0; x < cx; x++) for (let y = 0; y < cy; y++) pedidos.push(slide.tile(L, x, y).then(bitmap).then(b => { if (b) { g.drawImage(b, x * i.tile - (x ? i.overlap : 0), y * i.tile - (y ? i.overlap : 0)); b.close?.(); } }).catch(() => {}));
  await Promise.all(pedidos);
  return c;
}

/** A etiqueta escrita à mão, recortada da foto da lâmina inteira (overview). Nas do PreciPoint, a foto mostra o suporte de
 *  duas lâminas com as etiquetas à direita e a área escaneada num retângulo vermelho: a etiqueta é a da mesma metade
 *  (de cima ou de baixo) do retângulo, girada para ler na horizontal. Sem o retângulo, a foto inteira. */
export async function recorteEtiqueta(blob) {
  const b = await bitmap(blob);
  if (!b) return null;
  const W = 480, H = Math.round(b.height * W / b.width);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(b, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4, r = px[k], gg = px[k + 1], bb = px[k + 2];
    if (r > 160 && gg < 80 && bb < 80) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  let rx, ry, rw, rh, girar = false;
  if (n > 20 && x1 > x0 + 4 && y1 > y0 + 4) {
    const emBaixo = (y0 + y1) / 2 > H / 2;
    const ya = emBaixo ? Math.round(H / 2) : 0, yb = emBaixo ? H : Math.round(H / 2);
    // o suporte das etiquetas: a primeira faixa escura à direita do retângulo
    let xe = Math.round(W * 0.72);
    for (let x = x1 + 2; x < W - 5; x++) {
      let soma = 0, k = 0;
      for (let y = ya; y < yb; y += 3) { const q = (y * W + x) * 4; soma += px[q] + px[q + 1] + px[q + 2]; k++; }
      if (soma / k / 3 < 120) { xe = x; break; }
    }
    rx = xe; ry = ya; rw = W - xe; rh = yb - ya; girar = rw > 20 && rh > rw;
    if (rw < 20) { rx = 0; ry = 0; rw = W; rh = H; girar = false; }
  } else { rx = 0; ry = 0; rw = W; rh = H; }
  const k = b.width / W;
  const alt = 120;
  const out = document.createElement("canvas");
  const go = out.getContext("2d");
  if (girar) {
    out.height = alt; out.width = Math.round(rh / rw * alt);
    go.translate(0, alt); go.rotate(-Math.PI / 2);
    go.drawImage(b, rx * k, ry * k, rw * k, rh * k, 0, 0, alt, out.width);
  } else {
    out.height = alt; out.width = Math.round(rw / rh * alt);
    go.drawImage(b, rx * k, ry * k, rw * k, rh * k, 0, 0, out.width, alt);
  }
  b.close?.();
  return { canvas: out, retangulo: n > 20 ? { x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H } : null };
}

/** Resumo do cartão (guardado): { uid, nome, largura, altura, data, tecido: Blob, etiqueta: Blob|null }. */
export async function resumo(item, { refazer = false } = {}) {
  if (!refazer) { const r = await pegar(`res:${item.chave}`); if (r) return r; }
  const s = await abrir(item);
  const i = s.info;
  const [tec, et] = await Promise.all([
    miniaturaTecido(s).then(c => paraBlob(c)).catch(() => null),
    s.overview().then(recorteEtiqueta).then(r => (r ? paraBlob(r.canvas, 0.85) : null)).catch(() => null),
  ]);
  const r = { uid: uidDe(i), nome: i.nome, largura: i.largura, altura: i.altura, data: i.data, tecido: tec, etiqueta: et };
  await guardar(`res:${item.chave}`, r);
  return r;
}

/** A chave dos dados sincronizados de uma lâmina: o UID do arquivo (o mesmo no celular e no tablet). */
export function uidDe(info) { return info.uid || `sem-uid:${info.nome || "lamina"}:${info.largura}x${info.altura}`; }
