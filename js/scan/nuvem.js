// Leitura automática do OdontoScan: fila CIFRADA no ramo `odontoscan` do repositório (GitHub).
// Cada ficha sobe como um arquivo .osc: as duas imagens sem identificação (ficha e endereço), cifradas com AES-256-GCM;
// a chave AES vai embrulhada (RSA-OAEP) com a chave pública da tarefa agendada, cuja chave privada
// existe só nas instruções da tarefa. A tarefa devolve a resposta cifrada com a chave pública deste
// aparelho (a privada fica no IndexedDB do aparelho e não sai dele). O GitHub só guarda bytes ilegíveis.
// A chave dos códigos de paciente (HMAC) nunca sobe.
import * as BD from "./banco.js";
import { zip } from "./arquivos.js";
import { CONFERENCIA } from "./visao.js";
import { registrar } from "./historico.js";
// Modo de leitura local (28/10/2026): no computador do laboratório, a fila e as respostas ficam numa pasta do próprio
// computador e nada disto usa a rede. As funções abaixo desviam para local.js quando o modo é "local".
import { reduzir as reduzirL, paraEnviar as paraEnviarL, modoLocal, completarFilaLocal, buscarRespostasLocal, tirarDaFilaLocal, lerEstadoLocal, gravarLimiteLocal } from "./local.js";

const CHAVE_TAREFA = "MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAyq5QujrRaDc5YghOhk/BkVP+EJFKSqNuPTANrx/5dIOA0f1An3Ci9WK7wLomXgM51bS1Za0ouqNwwR7DBOvVgS/mW0PoCqU0bYX+OO6PYcOZPlfxBk+1PL1qUz2umqBdwMT5YUTa3RnIn41nCqs/AI2UN0EcZ3iieI9EYvaW8DEg3y2aF6iGQW93Czyedbwxi89yiay89mIeIjLoXkSS3OuWnzqCoUeedAgRKd+1yc0k2LgqQXp/ynMdTG5F4KR2TdXEPJcnI8txFSh8woR/dYW37xJg4YT1GUG6OVEl7Vi3vbzKbamsL0LCkjGrW6250odEKvBK+2OuONgoI+N/EUpoxTyQ0Woq54czrxunQUKuui3AsphWDRJDjpgj6HSUO+zT1LxtQqrc8hRUkeRQUOAnAc0aC/2piCF+sgrGu5ZbKWiQccg60nRXFo215j4Ekyg8M8OYd1xtXXARWzFNKHCwRlC11PG8YW3ZBLyvFMYDmFFwJQJYvgFI1rBdvJ0jAgMBAAE=";
export const RAMO = "odontoscan";
export const REPO_PADRAO = "Alediov/odonto-quest";
const RSA = { name: "RSA-OAEP", hash: "SHA-256" };
const enc = new TextEncoder(), dec = new TextDecoder();

// ---------- base64 ----------
function b64(bytes) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const deB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ---------- configuração ----------
let github = null; // { token, repo } vindo do app (OdontoQuest), se houver
export function definirGithub(g) { github = g?.token ? { token: g.token.trim(), repo: (g.repo || REPO_PADRAO).trim() } : null; }
export async function credenciais() {
  if (github?.token) return { ...github, doApp: true };
  const c = await BD.lerCfg("github");
  return c?.token ? { token: c.token, repo: c.repo || REPO_PADRAO } : null;
}
export async function salvarCredenciais(token, repo) { await BD.gravarCfg("github", { token: token.trim(), repo: (repo || REPO_PADRAO).trim() }); }

// ---------- chaves ----------
let chaveTarefa = null;
const tarefa = async () => (chaveTarefa ||= await crypto.subtle.importKey("spki", deB64(CHAVE_TAREFA), RSA, false, ["encrypt"]));

/** Par de chaves deste aparelho (a privada não é exportável e só existe no IndexedDB daqui). */
export async function dispositivo() {
  let d = await BD.lerCfg("dispositivo");
  if (!d) {
    const par = await crypto.subtle.generateKey({ ...RSA, modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]) }, false, ["encrypt", "decrypt"]);
    const id = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, "0")).join("");
    d = { id, privada: par.privateKey, publica: b64(await crypto.subtle.exportKey("spki", par.publicKey)), criado: new Date().toISOString() };
    await BD.gravarCfg("dispositivo", d);
  }
  return d;
}

// ---------- formato .osc: "OSC1" + tamanho do cabeçalho (4 bytes) + cabeçalho JSON + dados cifrados ----------
async function cifrar(dados, publica, cab) {
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, dados));
  const embrulhada = await crypto.subtle.encrypt(RSA, publica, await crypto.subtle.exportKey("raw", k));
  const h = enc.encode(JSON.stringify({ v: 1, ...cab, chave: b64(embrulhada), iv: b64(iv) }));
  const out = new Uint8Array(8 + h.length + cifrado.length);
  out.set(enc.encode("OSC1")); new DataView(out.buffer).setUint32(4, h.length); out.set(h, 8); out.set(cifrado, 8 + h.length);
  return out;
}
function cabecalho(bytes) {
  if (dec.decode(bytes.subarray(0, 4)) !== "OSC1") throw new Error("arquivo .osc inválido");
  const n = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4);
  return { cab: JSON.parse(dec.decode(bytes.subarray(8, 8 + n))), resto: bytes.subarray(8 + n) };
}
async function decifrar(bytes, privada) {
  const { cab, resto } = cabecalho(bytes);
  const bruta = await crypto.subtle.decrypt(RSA, privada, deB64(cab.chave));
  const k = await crypto.subtle.importKey("raw", bruta, "AES-GCM", false, ["decrypt"]);
  return { cab, dados: new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(cab.iv) }, k, resto)) };
}

// ---------- GitHub (API contents, no ramo da fila) ----------
// Prazo de cada pedido: com o app em segundo plano, o Android pode congelar uma conexão no meio, e o pedido
// nunca terminava (em 22/10/2026 a fila ficou parada o dia todo, com o resto esperando esse envio).
const PRAZO_GH = 90000;
async function gh(cred, metodo, caminho, corpo, bruto = false) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), PRAZO_GH);
  try { return await ghSemPrazo(cred, metodo, caminho, corpo, bruto, ctl.signal); }
  catch (e) { if (e.name === "AbortError") throw new Error("O GitHub não respondeu a tempo."); throw e; }
  finally { clearTimeout(t); }
}
async function ghSemPrazo(cred, metodo, caminho, corpo, bruto, signal) {
  const r = await fetch(`https://api.github.com/repos/${cred.repo}/contents/${caminho}${metodo === "GET" ? `?ref=${RAMO}` : ""}`, {
    method: metodo, cache: "no-store", signal,
    headers: { Authorization: `Bearer ${cred.token}`, Accept: bruto ? "application/vnd.github.raw" : "application/vnd.github+json", ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify({ ...corpo, branch: RAMO }) : undefined,
  });
  if (r.status === 404 && metodo === "GET") return null;
  if (r.status === 429 || (r.status === 403 && (r.headers.get("retry-after") || r.headers.get("x-ratelimit-remaining") === "0" || /rate limit/i.test(await r.clone().text())))) {
    const e = new Error("O GitHub pediu uma pausa nos envios (limite de velocidade). O resto vai depois, sozinho."); e.pausa = true; throw e;
  }
  if (r.status === 401 || r.status === 403) throw new Error("O GitHub recusou o acesso: confira o token.");
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return bruto ? new Uint8Array(await r.arrayBuffer()) : r.status === 204 ? null : r.json();
}
async function enviar(cred, caminho, bytes, msg) {
  for (let t = 0; t < 3; t++) {
    try { return await gh(cred, "PUT", caminho, { message: msg, content: b64(bytes) }); }
    catch (e) { if (!/GitHub 409|GitHub 422/.test(e.message) || t === 2) throw e; await new Promise(r => setTimeout(r, 800 * (t + 1))); }
  }
}

/** Publica a chave pública deste aparelho (uma vez), para a tarefa saber cifrar a resposta. */
async function publicarChave(cred, d) {
  if ((await BD.lerCfg("chavePublicada")) === `${cred.repo}|${d.id}`) return;
  if (!(await gh(cred, "GET", `chaves/${d.id}.json`))) {
    await enviar(cred, `chaves/${d.id}.json`, enc.encode(JSON.stringify({ dispositivo: d.id, publica: d.publica, criado: d.criado }, null, 1)), `OdontoScan: chave pública do aparelho ${d.id}`);
  }
  await BD.gravarCfg("chavePublicada", `${cred.repo}|${d.id}`);
}

// reduzir e paraEnviar moraram aqui; agora estão em local.js (a leitura local usa as mesmas regras)
export const reduzir = reduzirL;
export const paraEnviar = paraEnviarL;

/** Tira fichas da fila do GitHub (por exemplo, as que ficaram desalinhadas). Devolve quantas tirou. */
export async function tirarDaFila(pacotes) {
  if (await modoLocal()) return tirarDaFilaLocal(pacotes);
  const cred = await credenciais(); if (!cred || !pacotes.length) return 0;
  const alvo = new Set(pacotes), fila = (await gh(cred, "GET", "fila")) || [];
  let n = 0;
  for (const it of fila) {
    if (!alvo.has(it.name.replace(/\.osc$/, ""))) continue;
    await gh(cred, "DELETE", it.path, { message: "OdontoScan: ficha tirada da fila (alinhamento)", sha: it.sha }); n++;
  }
  return n;
}

let puladas = 0; // fichas puladas no último envio (cópia faltando ou com defeito)
export const puladasNoEnvio = () => puladas;
/** Envia as fichas para a fila cifrada. `aoProgresso(i, n)`; `parar()` interrompe. */
export async function enviarFila(fichas, { aoProgresso, parar, pausa = 0 } = {}) {
  const cred = await credenciais(); if (!cred) throw new Error("Falta o token do GitHub.");
  const d = await dispositivo();
  await publicarChave(cred, d);
  const pub = await tarefa();
  let n = 0;
  puladas = 0;
  for (const f of fichas) {
    if (parar?.()) break;
    aoProgresso?.(n, fichas.length);
    // Preparar (imagens, zip, cifra) é local: se a cópia de UMA ficha estiver faltando ou com defeito, ela é marcada
    // "sem cópia" (Refazer, no Lote, refaz pela pasta das fotos) e o envio segue com as outras. Antes, a falha
    // parava tudo, e como o envio começa pela mais antiga, a fila não andava mais.
    let bytes;
    try {
      await BD.comImagens(f, ["ficha", "endereco"]);
      if (!(f.imgFicha instanceof Blob) || !(f.imgEndereco instanceof Blob)) throw new Error("cópia ou recorte do endereço não está no aparelho");
      const pacote = await zip([{ nome: "ficha.jpg", dados: await reduzir(f.imgFicha) }, { nome: "endereco.jpg", dados: f.imgEndereco }]);
      bytes = await cifrar(new Uint8Array(await pacote.arrayBuffer()), pub, { tipo: "ficha", id: f.pacote, dispositivo: d.id, enviado: new Date().toISOString(), ...(f.alinhamentoAprovado ? { aprovada: true } : {}) });
    } catch (e) {
      delete f.imgFicha; delete f.imgEndereco;
      const g = await BD.pegarFicha(f.id);
      if (g) { g.semCopia = true; g.imgFicha = null; g.imgEndereco = null; registrar(g, `Não subiu para a fila: ${e.message || e}`); await BD.salvarFicha(g); }
      puladas++; console.warn("OdontoScan: ficha pulada no envio", e);
      continue;
    }
    delete f.imgFicha; delete f.imgEndereco; // só os dados voltam ao banco (as imagens já estão lá)
    try { await enviar(cred, `fila/${f.pacote}.osc`, bytes, `OdontoScan: ficha ${f.pacote} na fila`); }
    catch (e) {
      // o arquivo já está na fila (subiu, mas o app foi fechado antes de anotar): conta como enviada. Antes,
      // o GitHub recusava ("sha wasn't supplied") e, como o envio começa pela mais antiga, a fila parava ali.
      if (!/GitHub 422/.test(e.message) || !/sha/i.test(e.message)) throw e;
    }
    // relê a ficha antes de gravar: o envio leva minutos e, enquanto isso, você pode ter confirmado os números
    // dela (em 22/10/2026, gravar a cópia de antes desfazia a confirmação e a ficha voltava a Números sem recortes)
    const g = await BD.pegarFicha(f.id);
    if (g) { g.enviada = new Date().toISOString(); registrar(g, "Enviada cifrada para a fila da madrugada"); await BD.salvarFicha(g); }
    n++;
    if (pausa && n < fichas.length) await new Promise(r => setTimeout(r, pausa));
  }
  aoProgresso?.(n, fichas.length);
  return n;
}

// ---------- envio aos poucos ----------
// A fila no GitHub guarda, de cada aparelho, só o dobro do que a tarefa lê numa noite: o resto espera
// aqui no aparelho e sobe sozinho quando há vaga (ao abrir o app ou o OdontoScan). Assim o ramo fica
// pequeno e o GitHub não bloqueia por excesso de envios.
const PAUSA_ENTRE_ENVIOS = 1100;      // ms: abaixo do limite de ~80 envios por minuto do GitHub
const PAUSA_DEPOIS_DE_LIMITE = 20 * 60000;

/** Estado da leitura noturna (estado.json do ramo: limite da noite e histórico; só números e datas). */
export async function lerEstado() {
  if (await modoLocal()) return lerEstadoLocal();
  const cred = await credenciais(); if (!cred) return null;
  try {
    const b = await gh(cred, "GET", "estado.json", null, true);
    const est = b ? JSON.parse(dec.decode(b)) : null;
    if (est) await BD.gravarCfg("estadoFila", { ...est, lido: new Date().toISOString() });
    return est;
  } catch { return (await BD.lerCfg("estadoFila")) || null; }
}
/** Máximo de fichas por noite (o teto da calibração), guardado em ajustes.json no ramo. */
export async function gravarMaximo(n) {
  if (await modoLocal()) return gravarLimiteLocal(n);
  const cred = await credenciais(); if (!cred) throw new Error("Falta o token do GitHub.");
  const atual = await gh(cred, "GET", "ajustes.json");
  const dados = enc.encode(JSON.stringify({ maximo_por_noite: n, alterado: new Date().toISOString() }, null, 1));
  await gh(cred, "PUT", "ajustes.json", { message: `OdontoScan: até ${n} fichas por noite`, content: b64(dados), ...(atual?.sha ? { sha: atual.sha } : {}) });
  await BD.gravarCfg("maximoNoite", n);
}
/** Quantas fichas deste aparelho podem estar na fila ao mesmo tempo. */
export const tamanhoDaFila = (est) => Math.max(20, Math.min(300, 2 * (est?.limite || 40)));

let completando = null, completandoDesde = 0;
const PRAZO_COMPLETAR = 15 * 60000; // um envio parado há mais que isso é dado como travado e não segura os próximos
/**
 * Completa a fila: sobe as fichas mais antigas que esperam no aparelho até a fila ter `tamanhoDaFila`
 * fichas deste aparelho. Devolve { enviadas, naFila, esperando, alvo }. Uma chamada por vez.
 */
export function completarFila(opts = {}) {
  return modoLocal().then(l => l ? completarFilaLocal(opts) : completarFilaNuvem(opts));
}
function completarFilaNuvem(opts = {}) {
  // se já há um envio em andamento, espera ele terminar e confere de novo (pode ter chegado ficha nova)
  if (completando && Date.now() - completandoDesde < PRAZO_COMPLETAR) return completando.catch(() => {}).then(() => completarFilaNuvem(opts));
  completandoDesde = Date.now();
  const este = (async () => {
    try {
      const cred = await credenciais(); if (!cred || !navigator.onLine) return null;
      const pausa = await BD.lerCfg("pausaEnvio");
      if (pausa && Date.now() < pausa) return { pausado: true };
      const est = await lerEstado(), alvo = tamanhoDaFila(est);
      const todas = await BD.todasFichas(), porPacote = new Set(todas.map(f => f.pacote));
      const naFila = (await gh(cred, "GET", "fila")) || [];
      await arrumarFila(cred, naFila, todas);
      const fila = naFila.filter(x => porPacote.has(x.name.replace(/\.osc$/, ""))).length;
      const esperando = paraEnviar(todas).sort((a, b) => a.criado.localeCompare(b.criado));
      const lote = esperando.slice(0, Math.max(0, alvo - fila));
      let enviadas = 0;
      try {
        enviadas = await enviarFila(lote, { ...opts, pausa: PAUSA_ENTRE_ENVIOS });
      } catch (e) {
        if (e.pausa) await BD.gravarCfg("pausaEnvio", Date.now() + PAUSA_DEPOIS_DE_LIMITE);
        throw e;
      }
      return { enviadas, naFila: fila + enviadas, esperando: esperando.length - enviadas - puladas, alvo, puladas };
    } finally { if (completando === este) completando = null; }
  })();
  return (completando = este);
}

/**
 * Mantém a fila coerente com o aparelho:
 * - fichas marcadas como enviadas que não estão na fila nem nas respostas (a resposta se perdeu ou o arquivo saiu
 *   da fila) voltam a esperar envio, em vez de ficarem presas sem leitura;
 * - se este é o único aparelho com chave publicada, apaga da fila os arquivos que não correspondem a nenhuma ficha
 *   daqui (fichas apagadas ou processadas de novo, com outro código): a madrugada não gasta leitura com elas.
 */
async function arrumarFila(cred, naFila, todas) {
  const nomes = new Set(naFila.map(x => x.name.replace(/\.osc$/, "")));
  const respostas = new Set(((await gh(cred, "GET", "respostas")) || []).map(x => x.name.replace(/\.osc$/, "")));
  const presas = todas.filter(f => f.enviada && !f.leitura && f.etapa !== "erro" && !nomes.has(f.pacote) && !respostas.has(f.pacote) && Date.now() - new Date(f.enviada) > 3600000);
  for (const f of presas) { const g = await BD.pegarFicha(f.id); if (g && !g.leitura) { g.enviada = false; registrar(g, "Voltou para o envio (não estava mais na fila)"); await BD.salvarFicha(g); } }
  const chaves = ((await gh(cred, "GET", "chaves")) || []).filter(x => x.name.endsWith(".json")), d = await dispositivo();
  if (chaves.length !== 1 || chaves[0].name !== `${d.id}.json`) return { presas: presas.length, orfas: 0 }; // outro aparelho também usa a fila
  const meus = new Set((await BD.todasComLixeira()).map(f => f.pacote).filter(Boolean));
  let orfas = 0;
  for (const it of naFila) {
    if (!it.name.endsWith(".osc") || meus.has(it.name.replace(/\.osc$/, ""))) continue;
    try { await gh(cred, "DELETE", it.path, { message: "OdontoScan: ficha que não existe mais no aparelho saiu da fila", sha: it.sha }); orfas++; } catch { break; }
    await new Promise(r => setTimeout(r, PAUSA_ENTRE_ENVIOS));
  }
  if (orfas) await BD.gravarCfg("orfasTiradas", ((await BD.lerCfg("orfasTiradas")) || 0) + orfas);
  return { presas: presas.length, orfas };
}

/** Anota na última noite do estado.json quantas leituras eram de fichas que não existem mais (o Painel as tira do gráfico). */
async function marcarDescartadas(cred, n) {
  const atual = await gh(cred, "GET", "estado.json"); if (!atual?.sha) return;
  const est = JSON.parse(dec.decode(deB64(atual.content.replace(/\s/g, ""))));
  const ult = est.historico?.at(-1); if (!ult) return;
  ult.descartadas = (ult.descartadas || 0) + n;
  await gh(cred, "PUT", "estado.json", { message: `OdontoScan: ${n} leituras de fichas que não existem mais`, content: b64(enc.encode(JSON.stringify(est, null, 1) + "\n")), sha: atual.sha });
  await BD.gravarCfg("estadoFila", { ...est, lido: new Date().toISOString() });
}

/** Baixa as respostas deste aparelho, decifra e entrega a `aplicar(ficha, resposta)`; depois apaga do repositório. */
export async function buscarRespostas(aplicar) {
  if (await modoLocal()) return buscarRespostasLocal(aplicar);
  const cred = await credenciais(); if (!cred) return { novas: 0, naFila: null };
  const d = await dispositivo();
  const lista = (await gh(cred, "GET", "respostas")) || [];
  const fila = (await gh(cred, "GET", "fila")) || [];
  // inclui a lixeira: a leitura de uma ficha apagada por engano fica guardada nela, para o caso de restaurar
  const porPacote = new Map((await BD.todasComLixeira()).filter(f => f.pacote).map(f => [f.pacote, f]));
  let novas = 0, desalinhadas = 0, semFicha = 0;
  for (const it of lista.filter(x => x.name.endsWith(".osc"))) {
    const bytes = await gh(cred, "GET", it.path, null, true);
    let r;
    try { const { cab } = cabecalho(bytes); if (cab.dispositivo !== d.id) continue; r = await decifrar(bytes, d.privada); }
    catch { continue; } // de outro aparelho ou de outra chave
    const resposta = JSON.parse(dec.decode(r.dados)), f = porPacote.get(r.cab.id);
    if (f && resposta.desalinhada) { await BD.apagarFicha(f.id); desalinhadas++; } // a tarefa recusou: volta a ser processada
    else if (f && !f.leitura) { await aplicar(f, resposta); if (!f.lixeira) novas++; }
    else if (!f) semFicha++; // ficha que não existe mais neste aparelho (foi apagada ou processada de novo, com outro código)
    await gh(cred, "DELETE", it.path, { message: `OdontoScan: resposta ${r.cab.id} recebida`, sha: it.sha });
  }
  const minhas = fila.filter(x => porPacote.has(x.name.replace(/\.osc$/, ""))).length;
  await BD.gravarCfg("ultimaBusca", new Date().toISOString());
  if (semFicha) {
    await BD.gravarCfg("respostasSemFicha", ((await BD.lerCfg("respostasSemFicha")) || 0) + semFicha);
    await marcarDescartadas(cred, semFicha).catch(e => console.warn("OdontoScan: estado", e.message));
  }
  return { novas, naFila: minhas, desalinhadas, semFicha };
}
