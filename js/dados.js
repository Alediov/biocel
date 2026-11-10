// Armazenamento das lições e imagens (IndexedDB) e sincronização com o GitHub.
import { E, salvar, hojeISO, somaDias } from "./estado.js";
import { aplicarPacote } from "./pacotes.js";

const DB_NOME = "odontoquest", DB_VERSAO = 3;
let dbPromessa = null;

function db() {
  if (!dbPromessa) {
    dbPromessa = new Promise((ok, falha) => {
      const req = indexedDB.open(DB_NOME, DB_VERSAO);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("dias")) d.createObjectStore("dias");
        if (!d.objectStoreNames.contains("midia")) d.createObjectStore("midia");
        if (!d.objectStoreNames.contains("extras")) d.createObjectStore("extras");
        if (!d.objectStoreNames.contains("arquivos")) d.createObjectStore("arquivos"); // certificados anexados
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(req.error);
    });
  }
  return dbPromessa;
}
async function op(store, modo, fn) {
  const d = await db();
  return new Promise((ok, falha) => {
    const tx = d.transaction(store, modo);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => ok(r && "result" in r ? r.result : undefined);
    tx.onerror = () => falha(tx.error);
  });
}
const pegar = (s, k) => op(s, "readonly", st => st.get(k));
const guardar = (s, k, v) => op(s, "readwrite", st => st.put(v, k));
const chaves = (s) => op(s, "readonly", st => st.getAllKeys());

// ---------- extras: eventos acadêmicos e dados dos minijogos ----------
// No repositório, extras/indice.json lista { id, caminho, hash }. Cada extra fica
// guardado como { hash, dados } e só é baixado de novo quando o hash muda.
export async function extra(id) { return (await pegar("extras", id).catch(() => null))?.dados || null; }
export async function listarExtras(prefixo = "") {
  const out = [];
  for (const k of await chaves("extras")) if (String(k).startsWith(prefixo)) { const v = await pegar("extras", k); if (v?.dados) out.push(v.dados); }
  return out;
}
async function guardarExtra(item, dados) { await guardar("extras", item.id, { hash: item.hash, dados }); }
async function precisaExtra(item) { return (await pegar("extras", item.id).catch(() => null))?.hash !== item.hash; }

async function importarExtrasEmbutidos() {
  try {
    const r = await fetch("embutido/extras/indice.json", { cache: "no-store" });
    if (!r.ok) return;
    for (const item of (await r.json()).arquivos || []) {
      if (!(await precisaExtra(item))) continue;
      const rr = await fetch(`embutido/${item.caminho}`);
      if (rr.ok) await guardarExtra(item, await rr.json());
    }
  } catch (e) { /* sem extras embutidos */ }
}

// ---------- conteúdo embutido no app (funciona sem internet desde a instalação) ----------
async function importarEmbutido() {
  await importarExtrasEmbutidos();
  const emb = window.__EMBUTIDO__;
  if (emb) {
    for (const [data, dia] of Object.entries(emb.dias)) if (!(await pegar("dias", data))) await guardar("dias", data, dia);
    return;
  }
  try {
    const r = await fetch("embutido/indice.json", { cache: "no-store" });
    if (!r.ok) return;
    const ind = await r.json();
    for (const data of ind.dias) {
      // `revs` (versão Demo): trilhas embutidas que mudaram numa versão nova são substituídas
      const rev = ind.revs?.[data], ja = await pegar("dias", data);
      if (ja && (rev == null || ja.rev === rev)) continue;
      const dia = await (await fetch(`embutido/licoes/${data}.json`)).json();
      await guardar("dias", data, dia);
    }
  } catch (e) { /* sem conteúdo embutido */ }
}

export async function iniciarDados() {
  await importarEmbutido();
}

export async function listarDias() {
  const ks = await chaves("dias");
  return ks.sort();
}
export async function carregarDia(data) { return pegar("dias", data); }

const urlsCache = new Map();
export async function urlMidia(caminho) {
  if (!caminho) return null;
  if (urlsCache.has(caminho)) return urlsCache.get(caminho);
  let url = null;
  const blob = await pegar("midia", caminho).catch(() => null);
  if (blob) url = URL.createObjectURL(blob);
  else if (window.__EMBUTIDO__?.midia?.[caminho]) url = window.__EMBUTIDO__.midia[caminho];
  else url = `embutido/${caminho}`;
  urlsCache.set(caminho, url);
  return url;
}

// ---------- GitHub ----------
function cab(tipo = "json") {
  const t = E().config.token.trim();
  return {
    Authorization: `Bearer ${t}`,
    Accept: tipo === "raw" ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
const api = (caminho) => `https://api.github.com/repos/${E().config.repo.trim()}/contents/${caminho}`;

async function gh(caminho, tipo = "json") {
  const r = await fetch(api(caminho), { headers: cab(tipo), cache: "no-store" });
  if (r.status === 404) return null;
  if (r.status === 401 || r.status === 403) throw new Error("O GitHub recusou o acesso. Confira o token em Ajustes do Órbita (engrenagem da Home).");
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  return tipo === "raw" ? r : r.json();
}

/** Lê um arquivo de texto do repositório com o sha (para gravar de volta sem atropelar outro aparelho). */
export async function lerArquivoRepo(caminho) {
  const meta = await gh(caminho);
  if (!meta) return null;
  let texto;
  if (meta.content && meta.encoding === "base64" && meta.size < 900000) {
    const bin = atob(meta.content.replace(/\s/g, ""));
    texto = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  } else texto = await (await gh(caminho, "raw")).text();
  return { sha: meta.sha, texto };
}
/** Grava um arquivo de texto; com `sha`, só se ninguém mudou desde a leitura (senão devolve { conflito: true }). */
export async function gravarArquivoRepo(caminho, texto, sha, mensagem) {
  const corpo = { message: mensagem, content: base64(texto) };
  if (sha) corpo.sha = sha;
  const r = await fetch(api(caminho), { method: "PUT", headers: { ...cab(), "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (r.status === 409 || r.status === 422) return { conflito: true };
  if (!r.ok) throw new Error(`Falha ao enviar ${caminho} (${r.status})`);
  return { sha: (await r.json()).content?.sha };
}

/** Envia um arquivo (Blob) ao repositório; `ramo` opcional (as fotos dos simulados vão para um ramo à parte). */
export async function enviarBlobRepo(caminho, blob, mensagem, ramo = null) {
  const sha = (await fetch(api(caminho) + (ramo ? `?ref=${ramo}` : ""), { headers: cab(), cache: "no-store" }).then(r => (r.ok ? r.json() : null)).catch(() => null))?.sha;
  const corpo = { message: mensagem, content: await blobBase64(blob) };
  if (sha) corpo.sha = sha;
  if (ramo) corpo.branch = ramo;
  const r = await fetch(api(caminho), { method: "PUT", headers: { ...cab(), "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`Falha ao enviar ${caminho} (${r.status})`);
}
/** Lista uma pasta do repositório ([{ name, path, sha }]). */
export async function listarRepo(caminho) { const l = await gh(caminho); return Array.isArray(l) ? l : []; }
export { guardarExtra as guardarExtraRepo, precisaExtra as precisaExtraRepo };

/** Um arquivo do repositório (Leitura: livros preparados). Sem token, tenta o caminho relativo (testes no notebook). */
export async function baixarDoRepo(caminho) {
  if (globalThis.__baixarLeitura) return globalThis.__baixarLeitura(caminho);
  if (E().config.token?.trim()) return gh(caminho, "raw");
  const r = await fetch(`../${caminho}`).catch(() => null);
  return r && r.ok ? r : null;
}

function base64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function enviarArquivo(caminho, conteudo, mensagem) {
  const atual = await gh(caminho);
  const corpo = { message: mensagem, content: base64(conteudo) };
  if (atual?.sha) corpo.sha = atual.sha;
  const r = await fetch(api(caminho), { method: "PUT", headers: { ...cab(), "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`Falha ao enviar ${caminho} (${r.status})`);
}

export function temToken() { return !!E().config.token.trim(); }

// ---------- certificados (arquivos do currículo) ----------
export const guardarArquivo = (id, blob) => guardar("arquivos", id, blob);
export const pegarArquivo = (id) => pegar("arquivos", id).catch(() => null);
export const apagarArquivo = (id) => op("arquivos", "readwrite", st => st.delete(id)).catch(() => {});
function blobBase64(blob) {
  return new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => falha(r.error); r.readAsDataURL(blob); });
}
let enviandoCert = null;
/** Envia ao repositório os certificados anexados que ainda não subiram. Devolve quantos foram. */
export function enviarCertificados(aoProgresso = () => {}) {
  if (enviandoCert) return enviandoCert;
  enviandoCert = (async () => {
    const certs = (E().curriculo?.certificados || []).filter(c => !c.enviado);
    let n = 0;
    for (const c of certs) {
      const blob = await pegarArquivo(c.id);
      if (!blob) { c.erro = "Arquivo não encontrado no celular."; continue; }
      aoProgresso(`Enviando certificados (${n + 1}/${certs.length})…`);
      const caminho = c.caminho;
      const atual = await gh(caminho).catch(() => null);
      const corpo = { message: `Certificado: ${c.nome}`, content: await blobBase64(blob) };
      if (atual?.sha) corpo.sha = atual.sha;
      const r = await fetch(api(caminho), { method: "PUT", headers: { ...cab(), "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      if (!r.ok) { c.erro = `O GitHub recusou o envio (${r.status}).`; continue; }
      c.enviado = true; c.enviadoEm = new Date().toISOString(); delete c.erro; n++;
      E().vidaSuja = true; salvar();
    }
    return n;
  })().finally(() => { enviandoCert = null; });
  return enviandoCert;
}
/** Envio rápido depois de anexar: certificados + vida acadêmica (sem baixar nada). */
export async function enviarCurriculoAgora() {
  if (!temToken() || !navigator.onLine) return 0;
  const n = await enviarCertificados();
  const est = E();
  if (est.vidaSuja && est.agenda) {
    const vida = { atualizado: new Date().toISOString(), agenda: est.agenda, avaliacoes: est.avaliacoes, curriculo: est.curriculo };
    await enviarArquivo("progresso/vida-academica.json", JSON.stringify(vida, null, 1), "Agenda, avaliações e currículo");
    est.vidaSuja = false; salvar();
  }
  return n;
}

/** Baixa lições novas e imagens; envia resultados pendentes. Retorna um resumo. */
export async function sincronizar(aoProgresso = () => {}) {
  if (!temToken()) throw new Error("Configure o token do GitHub em Ajustes do Órbita (engrenagem da Home).");
  if (!navigator.onLine) throw new Error("Sem internet agora. As lições já baixadas continuam disponíveis.");
  const est = E();
  let baixadas = 0, imagens = 0, enviados = 0;

  // 0. junta o progresso com o dos outros aparelhos (sincronia.js) antes de enviar os resultados do dia
  aoProgresso("Juntando o progresso dos aparelhos…");
  await import("./sincronia.js").then(S => S.sincronizarProgresso()).catch(() => {});
  // 1. envia resultados primeiro (a tarefa da noite depende deles)
  aoProgresso("Enviando seus resultados…");
  const sujos = [...est.sujos];
  for (const data of sujos) {
    const pacote = {
      data,
      respostas: est.respostas[data] || [],
      reportes: est.reportes.filter(r => r.data === data),
      xp: est.diario[data]?.xp || 0,
      licoes: est.diario[data]?.licoes || [],
    };
    await enviarArquivo(`progresso/${data}.json`, JSON.stringify(pacote, null, 1), `Progresso de ${data}`);
    est.sujos = est.sujos.filter(d => d !== data);
    enviados++;
  }
  // resumo da revisão espaçada (o gerador usa para escolher o que revisar)
  if (enviados) {
    const resumo = { atualizado: new Date().toISOString(), srs: est.srs, ofensiva: est.ofensiva, xp: est.xp };
    await enviarArquivo("progresso/estado.json", JSON.stringify(resumo), "Resumo do estado do app");
    salvar();
  }

  // certificados anexados no Currículo (a tarefa da madrugada confere a pontuação)
  enviados += await enviarCertificados(aoProgresso);
  // vida acadêmica (agenda, avaliações, currículo): o gerador usa para adaptar a trilha
  if (est.vidaSuja && est.agenda) {
    const vida = { atualizado: new Date().toISOString(), agenda: est.agenda, avaliacoes: est.avaliacoes, curriculo: est.curriculo };
    await enviarArquivo("progresso/vida-academica.json", JSON.stringify(vida, null, 1), "Agenda, avaliações e currículo");
    est.vidaSuja = false; salvar(); enviados++;
  }

  // 2. baixa lições
  aoProgresso("Procurando lições novas…");
  const lista = (await gh("licoes")) || [];
  const limite = somaDias(hojeISO(), -14);
  const locais = new Set(await listarDias());
  for (const arq of lista) {
    const m = arq.name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    const data = m[1];
    const precisa = !locais.has(data) || data >= hojeISO(); // dias de hoje em diante podem ter sido regenerados
    if (data < limite || !precisa) continue;
    const r = await gh(`licoes/${data}.json`, "raw");
    if (!r) continue;
    const dia = await r.json();
    await guardar("dias", data, dia);
    baixadas++;
    for (const caminho of dia.midia || []) {
      if (await pegar("midia", caminho)) continue;
      aoProgresso(`Baixando imagens (${++imagens})…`);
      const ri = await gh(caminho, "raw");
      if (ri) await guardar("midia", caminho, await ri.blob());
    }
  }
  // 2b. extras (eventos acadêmicos, dados dos minijogos)
  aoProgresso("Procurando eventos e jogos…");
  let extras = 0;
  const indExtras = await gh("extras/indice.json", "raw").then(r => r && r.json()).catch(() => null);
  for (const item of indExtras?.arquivos || []) {
    if (!(await precisaExtra(item))) continue;
    const r = await gh(item.caminho, "raw");
    if (!r) continue;
    const dados = await r.json();
    for (const caminho of dados.midia || []) {
      if (await pegar("midia", caminho)) continue;
      aoProgresso(`Baixando imagens (${++imagens})…`);
      const ri = await gh(caminho, "raw");
      if (ri) await guardar("midia", caminho, await ri.blob());
    }
    await guardarExtra(item, dados);
    extras++;
  }
  // 2b'. simulados impressos (simulado.js): o do dia e as correções das últimas duas semanas
  try { extras += await (await import("./simulado.js")).baixarSimulados(aoProgresso); } catch (e) { console.warn("simulados:", e.message); }
  // 2b''. Finanças: o registro das macros do MacroDroid (comentários da issue), se a issue está ligada
  try { await (await import("./financas/ponte.js")).lerSeConectado(true); } catch (e) { console.warn("finanças:", e.message); }
  // 2b-even3. os eventos do Even3 de amanhã (even3.js; o ramo `eventos` do workflow diário)
  try { await (await import("./even3.js")).carregar({ forcar: true }); } catch (e) { console.warn("Even3:", e.message); }
  // 2c. figuras corrigidas no repositório (ex.: radiografias que saíam em negativo): troca as que já estão no aparelho
  const rev = await gh("conteudo/midia-revisada.json", "raw").then(r => r && r.json()).catch(() => null);
  if (rev?.versao && (est.midiaRevisada || 0) < rev.versao) {
    for (const caminho of rev.caminhos || []) {
      if (!(await pegar("midia", caminho))) continue;
      aoProgresso(`Atualizando imagens (${++imagens})…`);
      const ri = await gh(caminho, "raw");
      if (ri) await guardar("midia", caminho, await ri.blob());
    }
    est.midiaRevisada = rev.versao; salvar();
  }
  // 3. pacotes de configuração (editais, Lattes, calendário)
  let pacotes = 0;
  const man = await gh("config/manifesto.json", "raw").then(r => r && r.json()).catch(() => null);
  for (const p of man?.pacotes || []) {
    if ((est.pacotes?.[p.id] || 0) >= p.versao) continue;
    const r = await gh(p.arquivo, "raw");
    if (r && aplicarPacote(p.id, p.versao, await r.json())) pacotes++;
  }
  est.ultimaSync = new Date().toISOString();
  salvar();
  return { baixadas, imagens, enviados, pacotes, extras };
}

/** Cópia de segurança do estado completo no repositório. */
export async function enviarBackup() {
  const copia = { ...E(), config: { ...E().config, token: "" } }; // o token nunca vai para o repositório
  await enviarArquivo("progresso/backup-app.json", JSON.stringify(copia), "Backup do app");
}
export async function baixarBackup() {
  const r = await gh("progresso/backup-app.json", "raw");
  if (!r) throw new Error("Nenhum backup encontrado no repositório.");
  return r.json();
}

/** Banco de exercícios para o treino (todas as lições baixadas). */
export async function bancoDeExercicios() {
  const banco = new Map();
  for (const data of await listarDias()) {
    const dia = await carregarDia(data);
    for (const s of dia.sessoes) for (const l of s.licoes) for (const ex of l.exercicios) if (ex.tipo !== "resumo" && !banco.has(ex.id)) banco.set(ex.id, { ...ex, _data: data });
  }
  for (const ev of await listarExtras("evento:"))
    for (const l of ev.licoes || []) for (const ex of l.exercicios || []) if (ex.tipo !== "resumo" && !banco.has(ex.id)) banco.set(ex.id, { ...ex, _data: ev.data, _evento: ev.id });
  return banco;
}
