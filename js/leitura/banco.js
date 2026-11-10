// Leitura: o que já foi baixado dos livros (unidades em JSON e imagens), num IndexedDB próprio, para ler sem internet.
const NOME = "orbita-leitura", VERSAO = 1;
let p = null;
function db() {
  if (!p) p = new Promise((ok, falha) => {
    const r = indexedDB.open(NOME, VERSAO);
    r.onupgradeneeded = () => { const d = r.result; for (const s of ["json", "img"]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
    r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error);
  });
  return p;
}
async function op(store, modo, fn) {
  const d = await db();
  return new Promise((ok, falha) => {
    const tx = d.transaction(store, modo), r = fn(tx.objectStore(store));
    tx.oncomplete = () => ok(r && "result" in r ? r.result : undefined);
    tx.onerror = () => falha(tx.error);
  });
}
export const pegar = (s, k) => op(s, "readonly", st => st.get(k)).catch(() => undefined);
export const guardar = (s, k, v) => op(s, "readwrite", st => st.put(v, k));
export const tem = (s, k) => op(s, "readonly", st => st.count(k)).then(n => n > 0).catch(() => false);
export const chaves = (s) => op(s, "readonly", st => st.getAllKeys()).catch(() => []);
export const apagar = (s, k) => op(s, "readwrite", st => st.delete(k)).catch(() => {});
