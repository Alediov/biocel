// Banco local do OdontoScan (IndexedDB próprio, separado do OdontoQuest).
// Nada daqui é sincronizado com o GitHub nem com qualquer servidor.
// As imagens ficam numa loja à parte ("imagens"): listar milhares de fichas lê só os dados, sem carregar
// as fotos na memória. Quem precisa das imagens de uma ficha pede com comImagens(ficha).
const NOME = "odontoscan", VERSAO = 2;
// campos de imagem da ficha → nome na loja de imagens
// "inteira": a ficha inteira com a identificação, só no modo local (computador do laboratório)
// "topo": o alto da ficha até a borda da foto (horário, cor e clínica escritos acima do quadro), também só no modo local
const CAMPOS = { imgFicha: "ficha", imgEndereco: "endereco", imgEquipe: "equipe", imgInteira: "inteira", imgTopo: "topo" };
let db = null;

/** Tira os Blobs da ficha: devolve [ficha só com dados, [[chave, blob]], [chaves a apagar]]. */
function separar(f) {
  const meta = { ...f }, poe = [], tira = [];
  meta.imgs = { ...(f.imgs || {}) };
  for (const [campo, nome] of Object.entries(CAMPOS)) {
    if (!(campo in f)) continue;
    delete meta[campo];
    if (f[campo] instanceof Blob) { poe.push([[f.id, nome], f[campo]]); meta.imgs[nome] = true; }
    else if (f[campo] === null) { tira.push([f.id, nome]); delete meta.imgs[nome]; }
  }
  if ("recortes" in f) {
    delete meta.recortes;
    const antigos = meta.imgs.recortes || [];
    if (f.recortes && typeof f.recortes === "object") {
      for (const [c, b] of Object.entries(f.recortes)) if (b instanceof Blob) poe.push([[f.id, `recorte:${c}`], b]);
      meta.imgs.recortes = [...new Set([...antigos, ...Object.keys(f.recortes)])];
    } else { antigos.forEach(c => tira.push([f.id, `recorte:${c}`])); delete meta.imgs.recortes; }
  }
  return [meta, poe, tira];
}

function abrir() {
  if (db) return Promise.resolve(db);
  return new Promise((ok, falha) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = (ev) => {
      const d = r.result;
      if (!d.objectStoreNames.contains("fichas")) d.createObjectStore("fichas", { keyPath: "id" });
      if (!d.objectStoreNames.contains("cfg")) d.createObjectStore("cfg");
      if (!d.objectStoreNames.contains("imagens")) d.createObjectStore("imagens");
      if (ev.oldVersion === 1) {
        // versão 1 guardava as imagens dentro da ficha: move para a loja de imagens
        const tx = r.transaction, fichas = tx.objectStore("fichas"), imagens = tx.objectStore("imagens");
        fichas.openCursor().onsuccess = (e) => {
          const c = e.target.result; if (!c) return;
          const [meta, poe] = separar(c.value);
          for (const [k, b] of poe) imagens.put(b, k);
          c.update(meta); c.continue();
        };
      }
    };
    r.onsuccess = () => { db = r.result; ok(db); };
    r.onerror = () => falha(r.error);
  });
}
async function op(lojas, modo, fn) {
  const d = await abrir();
  return new Promise((ok, falha) => {
    const tx = d.transaction(lojas, modo);
    const r = fn(Array.isArray(lojas) ? lojas.map(l => tx.objectStore(l)) : tx.objectStore(lojas));
    tx.oncomplete = () => ok(r && "result" in r ? r.result : undefined);
    tx.onerror = () => falha(tx.error);
  });
}
const faixa = (id) => IDBKeyRange.bound([id], [id, []]);

/** Salva a ficha. Blobs em imgFicha/imgEndereco/imgEquipe/recortes vão para a loja de imagens;
 *  o campo com null (ex.: ficha.recortes = null) apaga aquelas imagens. */
export const salvarFicha = (f) => op(["fichas", "imagens"], "readwrite", ([fichas, imagens]) => {
  const [meta, poe, tira] = separar(f);
  for (const [k, b] of poe) imagens.put(b, k);
  for (const k of tira) imagens.delete(k);
  f.imgs = meta.imgs;
  return fichas.put(meta);
});
/** Só os dados (sem imagens). */
export const pegarFicha = (id) => op("fichas", "readonly", st => st.get(id));
/** As fichas (sem as da lixeira). */
export const todasFichas = async () => (await op("fichas", "readonly", st => st.getAll())).filter(f => !f.lixeira);
/** Todas, inclusive as da lixeira (para não importar de novo a mesma foto). */
export const todasComLixeira = () => op("fichas", "readonly", st => st.getAll());
export const fichasNaLixeira = async () => (await op("fichas", "readonly", st => st.getAll())).filter(f => f.lixeira);
/** Põe as imagens na ficha (imgFicha, imgEndereco, imgEquipe e recortes que existirem). */
export async function comImagens(f, quais = ["ficha", "endereco", "equipe", "recortes"]) {
  const pares = await op("imagens", "readonly", st => {
    const out = []; const c = st.openCursor(faixa(f.id));
    c.onsuccess = (e) => { const k = e.target.result; if (k) { out.push([k.key[1], k.value]); k.continue(); } };
    return { get result() { return out; } };
  });
  for (const [nome, blob] of pares) {
    if (nome.startsWith("recorte:")) { if (quais.includes("recortes")) (f.recortes ||= {})[nome.slice(8)] = blob; }
    else if (quais.includes(nome)) f[Object.keys(CAMPOS).find(c => CAMPOS[c] === nome)] = blob;
  }
  return f;
}
export const apagarFicha = (id) => op(["fichas", "imagens"], "readwrite", ([fichas, imagens]) => { imagens.delete(faixa(id)); return fichas.delete(id); });
export const apagarTudo = () => op(["fichas", "imagens"], "readwrite", ([fichas, imagens]) => { imagens.clear(); return fichas.clear(); });
/** Quais imagens existem: Set de "id|nome". */
export const chavesDeImagens = async () => new Set((await op("imagens", "readonly", st => st.getAllKeys())).map(([id, nome]) => `${id}|${nome}`));
/** Põe as imagens (Blobs) numa ficha que já existe, sem mexer nos dados: { ficha, endereco, equipe, "recorte:cpf"… }. */
export const porImagens = (id, imagens, extra = {}) => op(["fichas", "imagens"], "readwrite", ([fichas, st]) => {
  const r = fichas.get(id);
  r.onsuccess = () => {
    const f = r.result; if (!f) return;
    f.imgs = { ...(f.imgs || {}) };
    for (const [nome, blob] of Object.entries(imagens)) {
      if (!(blob instanceof Blob)) continue;
      st.put(blob, [id, nome]);
      if (nome.startsWith("recorte:")) f.imgs.recortes = [...new Set([...(f.imgs.recortes || []), nome.slice(8)])]; else f.imgs[nome] = true;
    }
    for (const [k, v] of Object.entries(extra)) if (f[k] == null) f[k] = v; // ex.: presença de escrita, se faltava
    delete f.semCopia; delete f.semRecorte;
    fichas.put(f);
  };
});
export const lerCfg = (k) => op("cfg", "readonly", st => st.get(k));
export const gravarCfg = (k, v) => op("cfg", "readwrite", st => st.put(v, k));
