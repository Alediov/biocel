// Banco das Músicas (IndexedDB "orbita-musicas"): faixas, capas (miniaturas), álbuns e configurações.
// Os arquivos ficam onde estão (na pasta escolhida); aqui só os dados de cada um.
const NOME = "orbita-musicas", VERSAO = 2;
let pdb = null;

function abrir() {
  return (pdb ||= new Promise((ok, erro) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("faixas")) db.createObjectStore("faixas", { keyPath: "id" });
      if (!db.objectStoreNames.contains("capas")) db.createObjectStore("capas");
      if (!db.objectStoreNames.contains("albuns")) db.createObjectStore("albuns", { keyPath: "id" });
      if (!db.objectStoreNames.contains("cfg")) db.createObjectStore("cfg");
      // v2: cada reprodução (tocada ou pulada), para as estatísticas
      if (!db.objectStoreNames.contains("reproducoes")) db.createObjectStore("reproducoes", { autoIncrement: true }).createIndex("em", "em");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  }));
}
async function op(loja, modo, fn) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const tx = db.transaction(loja, modo), st = tx.objectStore(loja);
    let res;
    const r = fn(st);
    if (r && "onsuccess" in r) r.onsuccess = () => { res = r.result; };
    tx.oncomplete = () => ok(res);
    tx.onerror = () => erro(tx.error);
    tx.onabort = () => erro(tx.error);
  });
}

export const todasFaixas = () => op("faixas", "readonly", st => st.getAll());
export const pegarFaixa = (id) => op("faixas", "readonly", st => st.get(id));
export const salvarFaixa = (f) => op("faixas", "readwrite", st => { st.put(f); });
export const salvarFaixas = (lista) => op("faixas", "readwrite", st => { for (const f of lista) st.put(f); });
export async function apagarFaixas(ids) {
  const db = await abrir();
  await new Promise((ok, erro) => {
    const tx = db.transaction(["faixas", "capas"], "readwrite");
    for (const id of ids) { tx.objectStore("faixas").delete(id); tx.objectStore("capas").delete(id); tx.objectStore("capas").delete(id + "#m"); }
    tx.oncomplete = ok; tx.onerror = () => erro(tx.error);
  });
}

/** Capa reduzida: dataURL, "" (não tem) ou undefined (ainda não buscada). Chave `id` = miniatura (320 px), `id#m` = média (720 px). */
export const pegarCapa = (id) => op("capas", "readonly", st => st.get(id));
export const salvarCapa = (id, dados) => op("capas", "readwrite", st => { st.put(dados, id); });

export const todosAlbuns = () => op("albuns", "readonly", st => st.getAll());
export const salvarAlbum = (a) => op("albuns", "readwrite", st => { st.put(a); });
export const apagarAlbum = (id) => op("albuns", "readwrite", st => { st.delete(id); });

export const adicionarReproducoes = (lista) => op("reproducoes", "readwrite", st => { for (const r of lista) st.add(r); });
export const todasReproducoes = () => op("reproducoes", "readonly", st => st.getAll());

export const lerCfg = (k) => op("cfg", "readonly", st => st.get(k));
export const gravarCfg = (k, v) => op("cfg", "readwrite", st => { st.put(v, k); });
