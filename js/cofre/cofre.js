// Cofre do Órbita: o estado (aberto ou fechado), o envelope cifrado no aparelho (IndexedDB "orbita-cofre"), a sincronia
// CIFRADA com o repositório (progresso/cofre/cofre.json: só o envelope, escolha do Alediov em 04/11/2026), a digital
// (plugin "CofreDigital", CofreDigitalPlugin.java) e o fechamento sozinho. A chave e os itens abertos ficam só na
// memória e somem ao fechar. Nada daqui vai para o estado do app (E()), para a sincronia normal nem para os logs.
import * as C from "./cripto.js";
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import { semThen } from "../semThen.js";
import { lerArquivoRepo, gravarArquivoRepo, temToken } from "../dados.js";

export const CAMINHO = "progresso/cofre/cofre.json";
const nativo = () => !!Capacitor.isNativePlatform?.();
let plug = null;
const plugin = () => (plug ||= semThen(registerPlugin("CofreDigital")));

// ---------- o envelope no aparelho ----------
let dbp = null;
function banco() {
  return (dbp ||= new Promise((ok, erro) => {
    const r = indexedDB.open("orbita-cofre", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("c");
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  }));
}
async function op(modo, f) {
  const db = await banco();
  return new Promise((ok, erro) => { const t = db.transaction("c", modo), r = f(t.objectStore("c")); t.oncomplete = () => ok(r?.result); t.onerror = () => erro(t.error); });
}
export const lerEnvelope = () => op("readonly", st => st.get("env"));
const gravarEnvelope = (env) => op("readwrite", st => st.put(env, "env"));
const apagarEnvelope = () => op("readwrite", st => st.delete("env"));

// ---------- estado ----------
let chave = null, kdf = null, dados = null, sha = null;
let ultimo = Date.now(), escondidoEm = 0, relogio = null;
const avisar = () => window.dispatchEvent(new CustomEvent("oq-cofre", { detail: { aberto: !!chave } }));
export const aberto = () => !!chave;
export const CFG_PADRAO = { minutos: 3 };
export function cfg() { try { return { ...CFG_PADRAO, ...JSON.parse(localStorage.getItem("orbita.cofre.cfg") || "{}") }; } catch { return { ...CFG_PADRAO }; } }
export function definirCfg(c) { try { localStorage.setItem("orbita.cofre.cfg", JSON.stringify({ ...cfg(), ...c })); } catch { /* sem armazenamento */ } }
/** Os itens (sem os apagados), na ordem: favoritos, depois o título. */
export function itens() {
  if (!dados) return [];
  return Object.values(dados.itens || {}).filter(i => !i.apagado).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || String(a.titulo || "").localeCompare(String(b.titulo || ""), "pt-BR", { sensitivity: "base" }));
}
export const item = (id) => (dados?.itens?.[id] && !dados.itens[id].apagado ? dados.itens[id] : null);
/** Toda ação conta como uso (o fechamento sozinho conta a partir daqui). */
export const usar = () => { ultimo = Date.now(); };

/** { local, remoto (null se não deu para saber), digital: { disponivel, guardado } } */
export async function situacao({ remoto = true } = {}) {
  const env = await lerEnvelope().catch(() => null);
  let rem = null;
  if (remoto && !env && temToken() && navigator.onLine) { try { rem = !!(await lerArquivoRepo(CAMINHO)); } catch { rem = null; } }
  let digital = { disponivel: false, guardado: false };
  if (nativo()) { try { digital = await plugin().situacao(); } catch { /* sem o plugin (versão antiga) */ } }
  return { local: !!env, remoto: rem, digital };
}

function abrir(k, kd, d, s = null) {
  chave = k; kdf = kd; dados = d && typeof d === "object" ? { itens: {}, ...d } : { itens: {} }; sha = s;
  usar(); vigiar(); proteger(true); avisar();
}
/** Fecha: a chave e os itens saem da memória. */
export function fechar() {
  const estava = !!chave;
  chave = null; kdf = null; dados = null;
  clearInterval(relogio); relogio = null;
  proteger(false);
  if (estava) avisar();
}

/** Cria o cofre com a senha mestra (no aparelho que ainda não tem nenhum). */
export async function criar(senha) {
  const kd = C.novoKdf(), bruta = await C.derivarBruta(senha, C.deB64(kd.sal), kd.iter);
  const k = await C.importarChave(bruta); bruta.fill(0);
  abrir(k, kd, { itens: {} });
  await persistir();
  sincronizarNoFundo();
}

/** Abre com a senha (o envelope do aparelho ou, num aparelho novo, o do repositório). Senha errada → Error("senha"). */
export async function abrirComSenha(senha) {
  let env = await lerEnvelope(), s = null;
  if (!env) {
    const r = temToken() ? await lerArquivoRepo(CAMINHO) : null;
    if (!r) throw new Error("vazio");
    env = JSON.parse(r.texto); s = r.sha;
  }
  const bruta = await C.derivarBruta(senha, C.deB64(env.kdf.sal), env.kdf.iter);
  const k = await C.importarChave(bruta); bruta.fill(0);
  const d = await C.decifrar(k, env); // "senha" se errada
  abrir(k, env.kdf, d, s);
  await persistir();
  sincronizarNoFundo();
}

/** Abre pela digital. "invalidada": a digital foi trocada no Android ou a senha mudou (precisa da senha de novo). */
export async function abrirComDigital() {
  const env = await lerEnvelope(); if (!env) throw new Error("vazio");
  const r = await plugin().abrir({ titulo: "Abrir o cofre" }); // cancelar → rejeita
  const bruta = C.deB64(r.dado), k = await C.importarChave(bruta); bruta.fill(0);
  let d;
  try { d = await C.decifrar(k, env); } catch { await desligarDigital(); throw new Error("invalidada"); }
  abrir(k, env.kdf, d);
  sincronizarNoFundo();
}
/** Liga a digital: confere a senha e guarda a chave embrulhada pelo Keystore (só a digital desembrulha). */
export async function ligarDigital(senha) {
  if (!chave) throw new Error("fechado");
  const bruta = await C.derivarBruta(senha, C.deB64(kdf.sal), kdf.iter);
  try { await C.decifrar(await C.importarChave(bruta), await lerEnvelope()); } catch { bruta.fill(0); throw new Error("senha"); }
  try { await plugin().guardar({ dado: C.b64(bruta), titulo: "Ligar a digital no cofre" }); } finally { bruta.fill(0); }
}
export async function desligarDigital() { if (nativo()) { try { await plugin().esquecer(); } catch { /* */ } } }

// ---------- itens ----------
const novoId = () => C.b64(C.aleatorio(9)).replace(/[+/=]/g, "x");
/** Grava (novo ou editado). Devolve o item. */
export async function salvarItem(it) {
  if (!chave) throw new Error("fechado");
  const agora = new Date().toISOString(), id = it.id || novoId();
  const novo = { ...it, id, em: agora, criado: it.criado || agora };
  delete novo.apagado;
  dados.itens[id] = novo; usar();
  await persistir(); sincronizarNoFundo();
  return novo;
}
export async function apagarItem(id) {
  if (!chave || !dados.itens[id]) return;
  dados.itens[id] = { id, apagado: true, em: new Date().toISOString() }; usar();
  await persistir(); sincronizarNoFundo();
}
async function persistir() {
  const env = await C.cifrar(chave, kdf, dados);
  await gravarEnvelope({ ...env, em: new Date().toISOString() });
}

// ---------- senha mestra ----------
/** Troca a senha mestra: sal novo, chave nova, tudo cifrado de novo (e no repositório). A digital precisa ser ligada de novo. */
export async function trocarSenha(atual, nova) {
  if (!chave) throw new Error("fechado");
  const b0 = await C.derivarBruta(atual, C.deB64(kdf.sal), kdf.iter);
  try { await C.decifrar(await C.importarChave(b0), await lerEnvelope()); } catch { throw new Error("senha"); } finally { b0.fill(0); }
  await sincronizar().catch(() => {}); // antes de trocar, junta o que os outros aparelhos gravaram (com a senha antiga)
  const kd = C.novoKdf(), b1 = await C.derivarBruta(nova, C.deB64(kd.sal), kd.iter);
  chave = await C.importarChave(b1); b1.fill(0); kdf = kd;
  await persistir();
  await desligarDigital();
  await sincronizar({ forcarEnvio: true }).catch(() => {});
}

// ---------- sincronia cifrada (só com o cofre aberto: a junção é item a item, precisa abrir os dois lados) ----------
let sincronizando = null, timerSinc = null;
export function situacaoSinc() { try { return JSON.parse(localStorage.getItem("orbita.cofre.sinc") || "null"); } catch { return null; } }
const anotarSinc = (s) => { try { localStorage.setItem("orbita.cofre.sinc", JSON.stringify({ ...s, em: new Date().toISOString() })); } catch { /* */ } };
function sincronizarNoFundo() { clearTimeout(timerSinc); timerSinc = setTimeout(() => sincronizar().catch(() => {}), 2500); }
/**
 * Junta o cofre daqui com o do repositório e grava os dois. `outraSenha`: o do repositório foi cifrado com outra senha
 * mestra (trocada em outro aparelho): chame `abrirComOutraSenha(senha)`.
 */
export function sincronizar({ forcarEnvio = false } = {}) {
  if (sincronizando) return sincronizando;
  sincronizando = (async () => {
    try {
      if (!chave) return { fechado: true };
      if (!temToken()) { anotarSinc({ ok: false, erro: "sem token" }); return { semToken: true }; }
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const r = await lerArquivoRepo(CAMINHO);
        let base = null;
        if (r) {
          const renv = JSON.parse(r.texto);
          if (renv.kdf?.sal !== kdf.sal && !forcarEnvio) { anotarSinc({ ok: false, erro: "outra senha" }); return { outraSenha: true }; }
          if (renv.kdf?.sal === kdf.sal) {
            base = await C.decifrar(chave, renv);
            const junto = C.juntar(dados, base);
            if (!C.iguais(junto, dados)) { dados = junto; await persistir(); avisar(); }
          }
        }
        if (base && C.iguais(dados, base) && !forcarEnvio) { anotarSinc({ ok: true }); return { ok: true, enviado: false }; }
        const g = await gravarArquivoRepo(CAMINHO, JSON.stringify(await C.cifrar(chave, kdf, dados)), r?.sha, "Órbita: cofre (cifrado)");
        if (g.conflito) { forcarEnvio = false; continue; } // outro aparelho gravou no meio: lê e junta de novo
        sha = g.sha; anotarSinc({ ok: true }); return { ok: true, enviado: true };
      }
      anotarSinc({ ok: false, erro: "conflito" }); return { conflito: true };
    } catch (e) {
      anotarSinc({ ok: false, erro: e.message === "senha" ? "outra senha" : (e.message || "erro") });
      throw e;
    } finally { sincronizando = null; }
  })();
  return sincronizando;
}
/** O do repositório está com outra senha (trocada em outro aparelho): abre com ela, junta e fica com a senha nova. */
export async function abrirComOutraSenha(senha) {
  const r = await lerArquivoRepo(CAMINHO); if (!r) throw new Error("vazio");
  const renv = JSON.parse(r.texto), bruta = await C.derivarBruta(senha, C.deB64(renv.kdf.sal), renv.kdf.iter);
  const k = await C.importarChave(bruta); bruta.fill(0);
  const base = await C.decifrar(k, renv);
  chave = k; kdf = renv.kdf; dados = C.juntar(dados || { itens: {} }, base);
  await persistir(); await desligarDigital(); avisar();
  await sincronizar();
}

// ---------- backup em arquivo (o envelope, cifrado) ----------
export async function envelopeParaBackup() { if (!chave) throw new Error("fechado"); return JSON.stringify({ ...(await C.cifrar(chave, kdf, dados)), app: "orbita-cofre", em: new Date().toISOString() }); }
/** Junta um backup (pode ter outra senha). Devolve quantos itens vieram. */
export async function importarBackup(texto, senha) {
  if (!chave) throw new Error("fechado");
  const env = JSON.parse(texto); if (!env?.kdf || !env.dados) throw new Error("arquivo");
  const bruta = await C.derivarBruta(senha, C.deB64(env.kdf.sal), env.kdf.iter);
  const outro = await C.decifrar(await C.importarChave(bruta), env); bruta.fill(0);
  dados = C.juntar(dados, outro); await persistir(); avisar(); sincronizarNoFundo();
  return Object.values(outro.itens || {}).filter(i => !i.apagado).length;
}
/** Apaga o cofre DESTE aparelho (o do repositório fica). */
export async function apagarDesteAparelho() { fechar(); await apagarEnvelope(); await desligarDigital(); }

// ---------- copiar, tela protegida e fechar sozinho ----------
let limpar = null;
/** Copia um segredo: no Android, marcado como sensível (não aparece na prévia) e apagado da área de transferência em 45 s. */
export async function copiar(texto) {
  usar();
  if (nativo()) { try { await plugin().copiar({ texto, segundos: 45 }); return; } catch { /* plugin antigo: o do navegador */ } }
  await navigator.clipboard.writeText(texto);
  clearTimeout(limpar);
  limpar = setTimeout(() => { navigator.clipboard.writeText("").catch(() => {}); }, 45000);
}
/** Sem captura de tela e sem prévia nos recentes enquanto o cofre está aberto (FLAG_SECURE). */
function proteger(ligar) { if (nativo()) plugin().protegerTela({ ligar }).catch(() => {}); }
function vigiar() {
  clearInterval(relogio);
  relogio = setInterval(() => { if (chave && Date.now() - ultimo > cfg().minutos * 60e3) fechar(); }, 10000);
}
let ouvindo = false;
export function ouvirVisibilidade() {
  if (ouvindo) return; ouvindo = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") escondidoEm = Date.now();
    else if (chave && escondidoEm && Date.now() - escondidoEm > 30000) fechar(); // mais de 30 s fora do app: fecha
  });
  for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { if (chave) usar(); }, { passive: true, capture: true });
}
