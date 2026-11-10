// Avisos do WhatsApp (pedido do Alediov, 04/11/2026: "perco mudanças de horário e recados que aparecem nos grupos").
// O celular lê as notificações do WhatsApp (fonte.js; no Android, WhatsAvisosService) e guarda só as dos grupos que ele
// escolheu. Aqui:
//   - a escolha de cada grupo (Sempre, Triagem ou Ignorar) em E().whatsapp.grupos[chave] = { nome, modo, em }
//     (sincroniza: não é sensível); grupo sem escolha fica de fora (os da lista de regras.js já vêm escolhidos);
//   - a triagem (regras.js `triar`): os que passam viram DESTAQUES (avisos), guardados só neste aparelho (localStorage
//     `orbita.whats.avisos`, 30 dias), cada um com o motivo ("sempre", "menção", "data: amanhã", "palavra: prova"…);
//   - a DECISÃO de cada destaque (pedido do Alediov, 04/11/2026, 20h53; regras em destaques.js): "Enviar ao Claude" ou
//     "Não", com nota e anexos, em E().whatsapp.decisoes[id] (sincroniza, 30 dias); sem decisão = "para decidir";
//   - o envio ao repositório PRIVADO só do que ele marcou: `progresso/whatsapp/enviados/AAAA-MM-DD.jsonl` (+ os anexos em
//     `progresso/whatsapp/anexos/<id>/`), lido pela tarefa da madrugada (gerador/WHATSAPP.md), que atualiza a Agenda
//     pelo pacote config/agenda-avisos.json (agendaAvisos/). Ao abrir, ao voltar e a cada 15 min com o app aberto.
// O resto nunca sai do celular e some em 30 dias. (Até 04/11/2026, 20h53, subiam todos os avisos para
// `progresso/whatsapp/AAAA-MM-DD.jsonl`; isso parou, e os "Visto" antigos não valem como decisão.)
import { E, salvar } from "../estado.js";
import { temToken, lerArquivoRepo, gravarArquivoRepo, enviarBlobRepo, guardarArquivo, pegarArquivo, apagarArquivo } from "../dados.js";
import * as R from "./regras.js";
import * as D from "./destaques.js";
import { respostasParaEnviar } from "../agendaAvisos/agendaAvisos.js";
import { fonte, nativo } from "./fonte.js";

const CHAVE = "orbita.whats.avisos";
const DIA = 864e5, INTERVALO = 15 * 60e3;
export const PASTA_REPO = "progresso/whatsapp";

// ---------------------------------------------------------------- estado (sincroniza)
export function W() {
  const s = (E().whatsapp ||= {});
  s.grupos ||= {}; s.decisoes ||= {};
  delete s.vistos; // os "Visto" antigos (até 04/11/2026, 20h53) não valem como decisão: os destaques voltam para decidir
  return s;
}
const agoraISO = () => new Date().toISOString();
/** Os nomes que contam como menção a ele. */
export const nomes = () => (W().nomes?.length ? W().nomes : ["Alediov"]);
export const modoDe = (nome) => R.modoDe(nome, W().grupos);

/** Escolhe o modo de um grupo (vale nos dois aparelhos) e refaz a triagem do que está guardado. */
export async function definirModo(nome, modo) {
  if (!R.MODOS[modo]) return;
  W().grupos[R.normalizar(nome)] = { nome, modo, em: agoraISO() };
  salvar();
  await enviarConfig();
  await atualizar({ refazer: true });
}
/** Manda os modos ao serviço do celular (ele só guarda as mensagens dos grupos Sempre e Triagem). */
export async function enviarConfig() {
  try { await fonte().definirConfig(R.configNativa(W().grupos)); } catch (e) { console.warn("WhatsApp: config", e); }
}

// ---------------------------------------------------------------- os avisos (neste aparelho)
let cache = null;
function lerLocal() {
  if (cache) return cache;
  try { const d = JSON.parse(localStorage.getItem(CHAVE) || "null"); if (d && Array.isArray(d.avisos)) return (cache = d); } catch { /* */ }
  return (cache = { cursor: 0, avisos: [] });
}
function gravarLocal() { try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch { /* cheio: fica na memória */ } }

/** Os avisos dos últimos 30 dias, do mais novo para o mais velho. */
export const avisos = () => lerLocal().avisos.slice().sort((a, b) => b.quando - a.quando);
const avisar = () => { window.dispatchEvent(new Event("oq-whats")); window.dispatchEvent(new Event("oq-topo")); };
/** A decisão de um destaque ({ d, nota, anexos, env… } ou undefined = para decidir). */
export const decisao = (id) => W().decisoes[id];
export const situacao = (id) => D.situacao(W().decisoes[id]);
/** Os destaques ainda sem decisão (é a contagem de "não lidas"). */
export const paraDecidir = () => avisos().filter(a => D.paraDecidir(W().decisoes[a.id]));
export const destaques = (filtro = "decidir") => D.filtrar(avisos(), W().decisoes, filtro);
export const contagens = () => D.contagens(avisos(), W().decisoes);
/** "Enviar ao Claude" (d = "enviar"), "Não" (d = "nao") ou desfazer (d = null), para um ou vários. */
export function decidir(ids, d) {
  const dec = W().decisoes, em = agoraISO();
  for (const id of [].concat(ids)) D.decidir(dec, id, d, em);
  D.podar(dec, new Date(Date.now() - D.DIAS_DECISAO * DIA).toISOString());
  salvar(); avisar();
  agendarEnvio();
}
/** A nota curta ("o que mudou?") de um destaque. */
export function definirNota(id, nota) { D.editar(W().decisoes, id, { nota }, agoraISO()); salvar(); avisar(); agendarEnvio(); }

// ---------------------------------------------------------------- anexos (ficam no aparelho até subir)
const idBlob = (id, n) => `wa:${id}:${n}`;
async function reduzirFoto(arq) {
  const bmp = await createImageBitmap(arq, { imageOrientation: "from-image" });
  const k = Math.min(1, D.LADO_FOTO / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.86));
}
/** Anexa um arquivo (foto: reduzida a 2200 px em JPEG; PDF como está) a um destaque. Devolve { ok } ou { erro }. */
export async function anexar(id, arq) {
  const r = W().decisoes[id] || {}, l = (r.anexos || []).slice();
  if (l.length >= D.MAX_ANEXOS) return { erro: `No máximo ${D.MAX_ANEXOS} anexos por mensagem.` };
  let blob = arq, nome = arq.name || "anexo", tipo = arq.type || "";
  if (/^image\//.test(tipo) && !/gif|svg/.test(tipo)) {
    try { blob = await reduzirFoto(arq); tipo = "image/jpeg"; nome = nome.replace(/\.[^.]+$/, "") + ".jpg"; } catch { /* manda como está */ }
  } else if (tipo !== "application/pdf" && !/^image\//.test(tipo)) return { erro: "Só fotos e PDF." };
  if (blob.size > D.MAX_ANEXO_BYTES) return { erro: `O arquivo tem ${(blob.size / 1048576).toFixed(1).replace(".", ",")} MB: o máximo é ${D.MAX_ANEXO_BYTES / 1048576} MB.` };
  const n = Math.max(0, ...l.map(x => x.n || 0)) + 1;
  await guardarArquivo(idBlob(id, n), blob);
  l.push({ n, nome, arq: D.nomeArquivo(nome, n), tipo, tam: blob.size });
  D.editar(W().decisoes, id, { anexos: l }, agoraISO());
  salvar(); avisar(); agendarEnvio();
  return { ok: true };
}
export async function tirarAnexo(id, n) {
  const r = W().decisoes[id]; if (!r) return;
  const an = (r.anexos || []).find(x => x.n === n);
  if (an?.sub) return; // já subiu: fica (a tarefa já pode ter lido)
  await apagarArquivo(idBlob(id, n));
  D.editar(W().decisoes, id, { anexos: (r.anexos || []).filter(x => x.n !== n) }, agoraISO());
  salvar(); avisar();
}
/** O arquivo do anexo guardado neste aparelho (para ver antes de subir), ou null. */
export const blobAnexo = (id, n) => pegarArquivo(idBlob(id, n));

/** Por que a mensagem passa agora (com o modo atual do grupo), ou null. */
export const motivoDe = (m) => R.triar(m, modoDe(m.grupo).modo, { nomes: nomes() });

/** Lê o que o serviço guardou desde a última vez, faz a triagem e junta aos avisos. `refazer`: relê tudo (o modo de
 *  um grupo mudou). Devolve quantos avisos novos entraram. */
let lendo = null;
export function atualizar({ refazer = false } = {}) {
  if (lendo) return lendo.then(() => atualizar({ refazer }));
  lendo = (async () => {
    const d = lerLocal(), antes = new Map(d.avisos.map(a => [a.id, a]));
    let desde = refazer ? 0 : d.cursor || 0, novos = 0, voltas = 0;
    const lidos = [];
    for (;;) {
      const r = await fonte().mensagens({ desde, limite: 2000 });
      lidos.push(...(r?.mensagens || []));
      desde = Math.max(desde, Number(r?.ultimo) || 0);
      if (!r?.mais || ++voltas > 20) break;
    }
    const lista = refazer ? [] : d.avisos.slice();
    const ids = new Set(lista.map(a => a.id));
    for (const m of R.deduplicar(lidos)) {
      const motivo = motivoDe(m);
      if (!motivo || ids.has(m.id)) continue;
      const velho = antes.get(m.id);
      lista.push({ id: m.id, grupo: m.grupo, de: m.de, quando: m.quando, texto: m.texto, motivo });
      ids.add(m.id);
      if (!velho) novos++;
    }
    const corte = Date.now() - R.RETENCAO_DIAS * DIA;
    const mudou = refazer || novos > 0 || lista.length !== d.avisos.length;
    cache = { cursor: desde, avisos: lista.filter(a => a.quando >= corte) };
    gravarLocal();
    if (mudou) { window.dispatchEvent(new Event("oq-whats")); window.dispatchEvent(new Event("oq-topo")); }
    return novos;
  })().catch(e => { console.warn("WhatsApp: leitura", e); return 0; }).finally(() => { lendo = null; });
  return lendo;
}

/** O histórico (30 dias) de tudo o que o celular guardou dos grupos escolhidos, com o motivo de quem passou. */
export async function historico(busca = "") {
  const r = await fonte().mensagens({ desde: 0, limite: 5000 });
  const q = R.normalizar(busca);
  return R.deduplicar(r?.mensagens || []).map(m => ({ ...m, motivo: motivoDe(m) }))
    .filter(m => !q || R.normalizar(`${m.grupo} ${m.de} ${m.texto}`).includes(q))
    .sort((a, b) => b.quando - a.quando);
}

/** A lista de grupos para classificar: os vistos pelo celular + os escolhidos + os padrões. */
export async function grupos() {
  let vistos = [];
  try { vistos = (await fonte().situacao())?.grupos || []; } catch { /* */ }
  const porChave = new Map();
  for (const p of R.PADROES) porChave.set(R.normalizar(p.nome), { chave: R.normalizar(p.nome), nome: p.nome, ultima: 0, padrao: true });
  for (const [k, g] of Object.entries(W().grupos)) porChave.set(k, { ...(porChave.get(k) || {}), chave: k, nome: g.nome || k });
  for (const g of vistos) {
    // o grupo do Ping-Pong pelo começo do nome: o nome real substitui o da lista
    const pp = R.ehPingPong(g.nome) ? [...porChave.keys()].find(k => k.startsWith("ping pong") && porChave.get(k).padrao && !porChave.get(k).ultima) : null;
    if (pp && pp !== g.chave) { porChave.delete(pp); }
    porChave.set(g.chave, { ...(porChave.get(g.chave) || {}), chave: g.chave, nome: g.nome, ultima: g.ultima, visto: true });
  }
  return [...porChave.values()].map(g => ({ ...g, ...modoDe(g.nome) }))
    .sort((a, b) => (a.escolhido || a.padrao ? 1 : 0) - (b.escolhido || b.padrao ? 1 : 0) || (b.ultima || 0) - (a.ultima || 0) || a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------------------------------------------------------------- envio ao repositório privado
const dois = (n) => String(n).padStart(2, "0");
/** "2026-11-04T14:30:00-03:00" (a hora do celular, com o fuso). */
export function isoLocal(ms) {
  const d = new Date(ms), o = -d.getTimezoneOffset(), s = o >= 0 ? "+" : "-", a = Math.abs(o);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}${s}${dois(Math.floor(a / 60))}:${dois(a % 60)}`;
}

let enviando = null, ultimoErro = null, ultimoEnvio = 0, tEnvio = null;
const pendentesAgora = () => D.pendentes(avisos(), W().decisoes);
// as respostas às perguntas da tarefa (agendaAvisos/) sobem junto
const respostasPendentes = () => { try { return respostasParaEnviar(); } catch { return []; } };
export function situacaoEnvio() {
  const p = pendentesAgora();
  return { enviando: !!enviando, erro: ultimoErro, em: ultimoEnvio, faltam: p.mensagens.length + p.cancelar.length + respostasPendentes().length };
}
/** Envia pouco depois de uma decisão (ele pode marcar várias seguidas). */
export function agendarEnvio() { clearTimeout(tEnvio); tEnvio = setTimeout(() => enviar(), 20000); }
/** Manda ao repositório o que ele marcou: anexos primeiro, depois as linhas no arquivo do dia do envio (com o sha;
 *  conflito: lê de novo), e os cancelamentos e as respostas às perguntas da tarefa. */
export function enviar() {
  if (enviando) return enviando;
  if (!temToken() || !navigator.onLine) return Promise.resolve(0);
  enviando = (async () => {
    const { mensagens, cancelar } = pendentesAgora(), resps = respostasPendentes();
    if (!mensagens.length && !cancelar.length && !resps.length) return 0;
    const agora = isoLocal(Date.now()), linhas = [], feitas = [];
    for (const { aviso: a, rec } of mensagens) {
      let falta = false;
      for (const an of rec.anexos || []) {
        if (an.sub) continue;
        const blob = await blobAnexo(a.id, an.n);
        if (!blob) { falta = true; continue; } // marcado em outro aparelho: sobe de lá
        await enviarBlobRepo(D.caminhoAnexo(a.id, an), blob, `WhatsApp: anexo de ${a.grupo}`);
        an.sub = agora;
        const atual = W().decisoes[a.id]?.anexos?.find(x => x.n === an.n); if (atual) atual.sub = agora; // o registro pode ter sido trocado
        salvar();
        await apagarArquivo(idBlob(a.id, an.n));
      }
      if (falta) continue;
      linhas.push(D.linhaMensagem(a, rec, isoLocal(a.quando), agora)); feitas.push(() => { const r = W().decisoes[a.id]; if (r && r.em === rec.em && r.d === "enviar") r.env = agora; }); // mudou no meio: sobe de novo
    }
    for (const id of cancelar) { linhas.push(D.linhaCancelar(id, agora)); feitas.push(() => { const r = W().decisoes[id]; if (r?.cancelar) r.cancelEnv = agora; }); }
    for (const r of resps) { linhas.push(D.linhaResposta(r.pergunta, r.resposta, agora)); feitas.push(r.feito); }
    if (!linhas.length) return 0;
    const caminho = `${D.PASTA_ENVIADOS}/${agora.slice(0, 10)}.jsonl`;
    let total = 0;
    for (let t = 0; t < 4; t++) {
      const atual = await lerArquivoRepo(caminho);
      const { texto, novas } = D.acrescentar(atual?.texto, linhas);
      if (!novas) break;
      const r = await gravarArquivoRepo(caminho, texto, atual?.sha, `WhatsApp: ${novas} destaque${novas > 1 ? "s" : ""} para o Claude`);
      if (!r.conflito) { total = novas; break; }
      if (t === 3) throw new Error("o arquivo mudou de novo no meio do envio");
    }
    for (const f of feitas) f?.();
    salvar(); avisar();
    ultimoErro = null; ultimoEnvio = Date.now();
    return total;
  })().catch(e => { ultimoErro = e.message || String(e); console.warn("WhatsApp: envio", e); return 0; }).finally(() => { enviando = null; });
  return enviando;
}

// ---------------------------------------------------------------- Meu dia e o ciclo
/** Item do Meu dia enquanto há destaques para decidir; tocar leva a Destaques, em Mensagens (pedido do Alediov,
 *  04/11/2026, 20h53). */
export function itemMeuDia() {
  const n = paraDecidir().length;
  if (!n) return null;
  const gs = [...new Set(paraDecidir().map(a => R.limparTitulo(a.grupo)))];
  return { id: "whatsapp", icone: "💬", titulo: `${n} destaque${n > 1 ? "s" : ""} do WhatsApp para decidir`,
    detalhe: gs.slice(0, 2).join(", ") + (gs.length > 2 ? ` e mais ${gs.length - 2}` : ""), feito: false,
    ir: { area: "eva", conversa: "destaques" } };
}

// ---------------------------------------------------------------- Mensagens (eva/telaMensagens.js)
/** As conversas dos grupos guardados (Sempre e Triagem), a mais recente primeiro, com os destaques para decidir de cada uma. */
export async function conversasDosGrupos() {
  await atualizar();
  const r = await fonte().mensagens({ desde: 0, limite: 5000 }).catch(() => null);
  const ms = R.deduplicar(r?.mensagens || []).filter(m => R.guardaMensagens(modoDe(m.grupo).modo));
  return R.conversas(ms, paraDecidir()).filter(c => c.ultima || c.naoVistos).map(c => ({ ...c, modo: modoDe(c.nome).modo }));
}
/** As mensagens guardadas de um grupo (pela chave), da mais velha para a mais nova, com o aviso de cada uma (se passou). */
export async function mensagensDoGrupo(chave) {
  const r = await fonte().mensagens({ desde: 0, limite: 5000 }).catch(() => null);
  const av = new Map(avisos().map(a => [a.id, a]));
  const ms = R.deduplicar(r?.mensagens || []).filter(m => R.normalizar(m.grupo) === chave)
    .map(m => ({ ...m, aviso: av.get(m.id) || null }));
  // aviso cuja mensagem já não está guardada (não deveria acontecer: os dois ficam 30 dias): entra assim mesmo
  const ids = new Set(ms.map(m => m.id));
  for (const a of av.values()) if (R.normalizar(a.grupo) === chave && !ids.has(a.id)) ms.push({ id: a.id, grupo: a.grupo, de: a.de, texto: a.texto, quando: a.quando, aviso: a });
  return ms.sort((a, b) => a.quando - b.quando || (a.rec || 0) - (b.rec || 0));
}
/** Abre o WhatsApp (só leitura no Órbita: responder é lá). No navegador não há como: devolve false. */
export async function abrirWhatsApp() {
  try { return (await fonte().abrirWhatsApp())?.aberto !== false; } catch { return false; }
}

/** Lê, faz a triagem e envia: ao abrir (6 s depois), ao voltar ao app e a cada 15 min com ele aberto. */
let ciclo = null;
export async function rodar() {
  await atualizar();
  await enviar();
}
export function iniciarWhats() {
  if (!nativo()) return; // no navegador a fonte de mentira só serve aos testes (e à tela)
  setTimeout(async () => { await enviarConfig(); rodar(); }, 6000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(rodar, 4000); });
  clearInterval(ciclo);
  ciclo = setInterval(() => { if (document.visibilityState === "visible") rodar(); }, INTERVALO);
}
