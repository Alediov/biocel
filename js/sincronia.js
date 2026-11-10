// Progresso dos Estudos sincronizado entre aparelhos (pedido do Alediov, 25/10/2026: continuar as trilhas no tablet
// quando o celular fica sem bateria). O estado inteiro do app (XP, moedas, ofensiva, lições feitas, revisão espaçada,
// coleção, jardim, baús, agenda, currículo, leitura…) fica em `progresso/sincronia/estado.json`, com um número de
// revisão. Cada aparelho guarda a última versão que viu (a "base"). Ao sincronizar:
//   - ninguém mais mexeu (a revisão do arquivo é a da base): só envia o que mudou aqui;
//   - outro aparelho mexeu: junta as três versões (base, daqui, de lá) e envia o resultado.
// Na junção, o que só um lado mudou fica como esse lado deixou; quando os dois mudaram, contadores somam o que cada um
// ganhou (XP, moedas, gemas, estatísticas), listas se unem (respostas, lições do dia), registros com data ficam com o
// mais recente e a ofensiva fica com a do último dia estudado. O Scanner e as Músicas não entram: ficam em cada aparelho.
// Sincroniza ao abrir, ao voltar para o app, ~15 s depois de cada mudança e antes do "Sincronizar" do Perfil; não troca
// o estado no meio de uma lição ou de um jogo (espera terminar).
import { E, substituirEstado, definirAoSalvar } from "./estado.js";
import { lerArquivoRepo, gravarArquivoRepo, temToken } from "./dados.js";
import { juntar, igual, clonar, baseDaJuncao } from "./juntar.js";

const CAMINHO = "progresso/sincronia/estado.json";
// o que é de cada aparelho e não viaja
const LOCAIS = [["config", "token"], ["config", "area"], ["config", "musicasVencem"], ["config", "scanNaFila"], ["config", "scanFaltaFila"],
  ["config", "musicaFundo"], ["config", "audioFolga"], ["config", "scanResumo"], ["config", "focoAtivo"], ["config", "atualizacaoVista"], ["config", "alarmeAqui"], ["config", "tokenValidade"], ["ultimaSync"], ["_mod"]];

// ---------------------------------------------------------------- guardado do aparelho (fora do estado sincronizado)
const DB = "orbita-sinc";
let pdb = null;
function db() {
  if (!pdb) pdb = new Promise((ok, falha) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error);
  });
  return pdb;
}
async function kv(k, v) {
  const d = await db();
  return new Promise((ok, falha) => {
    const tx = d.transaction("kv", v === undefined ? "readonly" : "readwrite"), st = tx.objectStore("kv");
    const r = v === undefined ? st.get(k) : st.put(v, k);
    tx.oncomplete = () => ok(v === undefined ? r.result : v); tx.onerror = () => falha(tx.error);
  });
}
async function aparelho() {
  let a = await kv("aparelho");
  if (!a) {
    const lado = Math.min(screen.width || 0, screen.height || 0);
    a = { id: Math.random().toString(36).slice(2, 10), nome: lado >= 600 ? "Tablet" : "Celular" };
    await kv("aparelho", a);
  }
  return a;
}

function semLocais(est) {
  const c = clonar(est);
  for (const p of LOCAIS) {
    let o = c;
    for (let i = 0; i < p.length - 1 && o; i++) o = o[p[i]];
    if (o) delete o[p[p.length - 1]];
  }
  return c;
}
function comLocais(est, de) {
  for (const p of LOCAIS) {
    let o = est, d = de;
    for (let i = 0; i < p.length - 1 && o && d; i++) { o = o[p[i]] ||= {}; d = d[p[i]]; }
    if (o && d && p[p.length - 1] in d) o[p[p.length - 1]] = d[p[p.length - 1]];
  }
  return est;
}
const vazio = (est) => !est.xp && !Object.keys(est.concluidas || {}).length && !Object.keys(est.srs || {}).length;

// ---------------------------------------------------------------- sincronizar
let rodando = null, ocupado = () => false, aoMudar = () => {}, timer = null, ultimoResultado = null;
export const situacao = () => ultimoResultado;

/** Sincroniza agora. Devolve { acao: "nada" | "enviado" | "recebido" | "juntado" | "esperando", ... }. */
export function sincronizarProgresso() {
  if (rodando) return rodando;
  rodando = (async () => {
    try {
      if (!temToken() || !navigator.onLine) return { acao: "offline" };
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const r = await umaVez();
        if (r) { ultimoResultado = { ...r, quando: new Date().toISOString() }; return ultimoResultado; }
      }
      return { acao: "conflito" };
    } catch (e) {
      console.warn("sincronia:", e.message);
      ultimoResultado = { acao: "erro", erro: e.message, quando: new Date().toISOString() };
      return ultimoResultado;
    } finally { rodando = null; }
  })();
  return rodando;
}

async function umaVez() {
  const ap = await aparelho();
  const meta = (await kv("meta")) || {};
  const local = semLocais(E()), mod0 = E()._mod;
  const rem = await lerArquivoRepo(CAMINHO);
  let historico = [];
  const enviar = async (estado, rev, sha) => {
    // quem gravou cada revisão (as últimas 30): se o app fechar entre o envio e guardar a base, a próxima sincronização
    // sabe que o envio chegou e usa o que foi enviado como base (baseDaJuncao), em vez de cobrar tudo de novo
    const corpo = { versao: 1, rev, aparelho: ap.id, nome: ap.nome, atualizado: new Date(E()._mod || Date.now()).toISOString(), historico: [...historico, { rev, aparelho: ap.id }].slice(-30), estado };
    await kv("pendente", { rev, estado });
    const g = await gravarArquivoRepo(CAMINHO, JSON.stringify(corpo), sha, `Progresso (${ap.nome})`);
    if (g.conflito) return false;
    await kv("meta", { rev, sha: g.sha, base: estado, nome: ap.nome });
    await kv("pendente", null);
    return true;
  };
  if (!rem) return (await enviar(local, 1, null)) ? { acao: "enviado" } : null;
  const d = JSON.parse(rem.texto);
  historico = Array.isArray(d.historico) ? d.historico : [];
  if (meta.sha === rem.sha) { // ninguém mais mexeu
    if (igual(local, meta.base)) return { acao: "nada" };
    return (await enviar(local, (d.rev || 0) + 1, rem.sha)) ? { acao: "enviado" } : null;
  }
  // outro aparelho mexeu
  if (ocupado()) return { acao: "esperando" }; // não troca o estado no meio de uma lição ou de um jogo
  const localNovo = (E()._mod || 0) > Date.parse(d.atualizado || 0);
  const escolhida = baseDaJuncao({ meta, pendente: await kv("pendente"), remoto: d, aparelho: ap.id });
  if (escolhida?.recuperada) console.warn(`sincronia: o envio da rev ${escolhida.rev} chegou, mas a base não foi guardada; usando-a como base`);
  let junto;
  if (!escolhida && vazio(local)) junto = clonar(d.estado); // aparelho novo: fica com o que está lá
  else junto = juntar(escolhida?.base, local, d.estado, localNovo);
  if (!igual(junto, local)) {
    if (E()._mod !== mod0) return null; // o app mudou o estado enquanto lia o GitHub: junta de novo com o atual, sem perder a mudança
    substituirEstado(comLocais(clonar(junto), E()));
    try { aoMudar(); } catch (e) { console.warn(e); }
  }
  if (igual(junto, d.estado)) {
    await kv("meta", { rev: d.rev, sha: rem.sha, base: clonar(d.estado), nome: ap.nome });
    await kv("pendente", null);
    return { acao: "recebido", de: d.nome };
  }
  return (await enviar(junto, (d.rev || 0) + 1, rem.sha)) ? { acao: "juntado", de: d.nome } : null;
}

/** Liga a sincronização automática. `ocupado()`: true durante lição ou jogo. `mudou()`: redesenhar depois de receber. */
export function iniciarSincronia(o = {}) {
  ocupado = o.ocupado || ocupado; aoMudar = o.mudou || aoMudar;
  definirAoSalvar(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!ocupado()) sincronizarProgresso(); }, 15000);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(sincronizarProgresso, 1500);
    else if (timer) { clearTimeout(timer); timer = null; sincronizarProgresso(); } // saindo do app com algo para enviar
  });
  window.addEventListener("online", () => setTimeout(sincronizarProgresso, 2000));
  return sincronizarProgresso();
}
