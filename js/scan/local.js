// Leitura LOCAL do OdontoScan (pedido do Alediov, 28/10/2026): no computador do laboratório, as fichas são lidas por um
// modelo que roda no próprio computador (Ollama, pelo tools/odontoscan/local/leitor.py), e NADA sai dele: sem GitHub, sem
// chaves, sem internet. O OdontoScan.html (Chrome) e o leitor conversam por uma "pasta de trabalho" escolhida aqui:
//   fila/<id>/p-*.jpg (os pedaços da ficha, partes.js), copia.jpg, endereco.jpg, pedido.json
//                                                     → o que o leitor deve ler (o pedido.json é gravado por último)
//   respostas/<id>.json                               → o que ele leu (mesmo formato da resposta da nuvem decifrada)
//   validacao/<id>/…  e  validacao-respostas/<id>.json → o teste da leitura local com fichas já revisadas
//   ajustes.json (máximo por noite, gravado aqui) e estado.json (as noites do leitor: só números e datas)
// As imagens são as mesmas da nuvem (cópia sem identificação e o recorte do endereço), sem cifra: não saem do computador.
// Só no navegador do computador (File System Access); no app Android, a leitura continua na nuvem.
import * as BD from "./banco.js";
import { CONFERENCIA } from "./visao.js";
import { registrar } from "./historico.js";
import { concordancia, tiposDeErro } from "./analises.js";
import { montarRevisao, definirFrequencias, frequenciasGerais } from "./processar.js";
import { partesDaFicha, VERSAO_PARTES, GEO_PARTES } from "./partes.js";

const enc = new TextEncoder();
const PASTAS = ["fila", "respostas", "validacao", "validacao-respostas"];

/** Reduz a cópia da ficha para o tamanho que a leitura usa de fato (lado maior 1600 px). */
export async function reduzir(blob, lado = 1600, q = 0.84) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  if (s === 1) return blob;
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
  const c = cv.getContext("2d"); c.imageSmoothingQuality = "high"; c.drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(ok => cv.toBlob(ok, "image/jpeg", q));
}

/** Fichas que ainda podem ir para a fila (têm as cópias, não foram lidas nem enviadas). */
// Só sobem fichas conferidas pela conferência de alinhamento atual (as antigas são conferidas ao abrir o OdontoScan)
// ou cuja cópia você aprovou.
export const paraEnviar = (fs) => fs.filter(f => (f.imgFicha || f.imgs?.ficha) && !f.semCopia && !f.leitura && !f.enviada && f.etapa !== "erro" && !f.alinhamentoPendente && ((f.conferencia || 0) >= CONFERENCIA || f.alinhamentoAprovado));

// ---------- modo ----------
/** cfg "leitura": { modo: "nuvem" | "local", limite: fichas por noite no leitor local (0 = sem limite) }. */
export async function lerModo() { return { modo: "nuvem", limite: 0, ...((await BD.lerCfg("leitura")) || {}) }; }
/** O modo local precisa escrever numa pasta do computador (Chrome ou Edge no computador; o app Android não tem). */
export const podeLocal = () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
export const modoLocal = async () => podeLocal() && (await lerModo()).modo === "local";
/**
 * Troca o modo. As fichas que estavam "enviadas" para o outro lado e ainda não foram lidas voltam a esperar, para irem
 * para a fila do modo novo (a resposta do outro lado não seria buscada).
 */
export async function definirModo(modo) {
  await BD.gravarCfg("leitura", { ...(await lerModo()), modo });
  for (const f0 of await BD.todasComLixeira()) {
    if (!f0.enviada || f0.leitura || (modo === "local") === !!f0.filaLocal) continue;
    const g = await BD.pegarFicha(f0.id); if (!g || g.leitura) continue;
    g.enviada = false; delete g.filaLocal;
    registrar(g, modo === "local" ? "Voltou para o envio: a leitura passou para este computador" : "Voltou para o envio: a leitura voltou para a nuvem");
    await BD.salvarFicha(g);
  }
}

// ---------- pasta de trabalho ----------
let pastaPronta = null; // handle já liberado nesta sessão
/**
 * A pasta de trabalho. `escolher`: abre o seletor (precisa de um toque); `pedir`: pede de novo a permissão de escrita
 * (também precisa de um toque). Sem isso, devolve a pasta só se a permissão ainda vale, senão null.
 */
export async function pastaTrabalho({ escolher = false, pedir = false } = {}) {
  if (!escolher && pastaPronta) return pastaPronta;
  let dir = escolher ? null : await BD.lerCfg("trabalhoHandle");
  if (dir) {
    let p = await dir.queryPermission?.({ mode: "readwrite" });
    if (p !== "granted" && pedir) p = await dir.requestPermission?.({ mode: "readwrite" });
    if (p !== "granted") return null;
  }
  if (!dir) {
    if (!escolher) return null;
    if (!podeLocal()) throw new Error("Este navegador não deixa escolher pastas. Abra o OdontoScan.html no Microsoft Edge ou no Google Chrome (botão direito no arquivo → Abrir com).");
    try { dir = await window.showDirectoryPicker({ id: "orbita-trabalho", mode: "readwrite" }); }
    catch (e) { if (e.name === "AbortError") return null; throw e; }
    try { await BD.gravarCfg("trabalhoHandle", dir); } catch { /* navegador sem suporte a guardar a pasta */ }
    await BD.gravarCfg("trabalho", { nome: dir.name, escolhida: new Date().toISOString() });
  }
  for (const p of PASTAS) await dir.getDirectoryHandle(p, { create: true });
  return (pastaPronta = dir);
}
/** Usado pelos testes (pasta do navegador no lugar da escolhida). */
export async function usarPasta(dir) { pastaPronta = null; await BD.gravarCfg("trabalhoHandle", dir); await BD.gravarCfg("trabalho", { nome: dir.name, escolhida: new Date().toISOString() }); return pastaTrabalho(); }
/** { nome, estado: "ok" | "pedir" | "nenhuma" } */
export async function situacaoPasta() {
  const h = await BD.lerCfg("trabalhoHandle"), info = await BD.lerCfg("trabalho");
  if (!h) return { nome: null, estado: "nenhuma" };
  let p = "prompt"; try { p = await h.queryPermission({ mode: "readwrite" }); } catch { /* */ }
  return { nome: info?.nome || h.name, estado: p === "granted" ? "ok" : "pedir" };
}

const sub = (dir, nome) => dir.getDirectoryHandle(nome, { create: true });
async function gravar(dir, nome, dados) {
  const fh = await dir.getFileHandle(nome, { create: true }), w = await fh.createWritable();
  await w.write(typeof dados === "string" ? enc.encode(dados) : dados); await w.close();
}
async function lerJson(dir, nome) {
  try { return JSON.parse(await (await (await dir.getFileHandle(nome)).getFile()).text()); } catch { return null; }
}
/** Nomes dentro de uma pasta: { arquivos: [...], pastas: [...] } (ignora temporários). */
async function listar(dir) {
  const arquivos = [], pastas = [];
  for await (const [nome, h] of dir.entries()) {
    if (nome.startsWith(".") || /\.(tmp|crswap)$/i.test(nome)) continue;
    (h.kind === "directory" ? pastas : arquivos).push(nome);
  }
  return { arquivos, pastas };
}
async function apagar(dir, nome) { try { await dir.removeEntry(nome, { recursive: true }); return true; } catch { return false; } }

/**
 * Grava uma ficha numa subpasta de `alvo`: os pedaços da ficha (partes.js, um pedido ao modelo para cada; desde
 * 29/10/2026), a cópia e o recorte do endereço (para um leitor antigo, que ainda não conhece os pedaços) e o pedido,
 * por último.
 */
async function gravarItem(alvo, id, f, extra = {}) {
  // os números de identificação (29/10/2026, pedido do Alediov: a rede pequena do app lia mal): só na fila LOCAL e só
  // das fichas que ainda esperam a conferência dos números
  const comNumeros = extra.tipo !== "validacao" && f.etapa === "confirmar" && !!f.imgs?.recortes?.length;
  await BD.comImagens(f, ["ficha", "endereco", "inteira", "topo", ...(comNumeros ? ["recortes"] : [])]);
  try {
    if (!(f.imgFicha instanceof Blob) || !(f.imgEndereco instanceof Blob)) throw new Error("cópia ou recorte do endereço não está no computador");
    const d = await alvo.getDirectoryHandle(id, { create: true });
    const { partes, tintas } = await partesDaFicha(f, { numeros: comNumeros });
    for (const p of partes) await gravar(d, p.arq, p.blob);
    await gravar(d, "copia.jpg", await reduzir(f.imgFicha));
    await gravar(d, "endereco.jpg", f.imgEndereco);
    // o pedido vai por último: o leitor só pega a ficha quando ele existe (as imagens já estão inteiras)
    await gravar(d, "pedido.json", JSON.stringify({
      v: VERSAO_PARTES, tipo: extra.tipo || "ficha", id, enviado: new Date().toISOString(),
      partes: partes.map(({ arq, parte, linha, campo, topo, segunda, extra }) => ({ arq, parte, ...(linha ? { linha } : {}), ...(campo ? { campo } : {}), ...(topo ? { topo } : {}), ...(segunda ? { segunda } : {}), ...(extra ? { extra } : {}) })),
      tinta_linhas: tintas, ...(comNumeros ? { numeros: true } : {}), ...(f.alinhamentoAprovado ? { aprovada: true } : {}),
    }, null, 1));
  } finally { delete f.imgFicha; delete f.imgEndereco; delete f.imgInteira; delete f.imgTopo; delete f.recortes; }
}
/** Fila gravada num formato mais velho (v1: a ficha numa imagem só; v2: os pedaços sem a 2ª versão para a segunda
 *  leitura) e ainda não lida: sai da pasta e é gravada de novo no formato novo. */
async function atualizarFilaAntiga(dir) {
  if ((await BD.lerCfg("filaVersao")) === VERSAO_PARTES) return;
  const resp = new Set((await listar(await sub(dir, "respostas"))).arquivos.map(n => n.replace(/\.json$/, "")));
  const fila = await sub(dir, "fila");
  for (const n of (await listar(fila)).pastas) if (!resp.has(n) && ((await lerJson(await fila.getDirectoryHandle(n), "pedido.json"))?.v || 1) < VERSAO_PARTES) await apagar(fila, n);
  // o teste da leitura local que ainda não foi lido também passa para os pedaços (as mesmas fichas)
  const v = await lerValidacao();
  if (v?.mapa) {
    const pv = await sub(dir, "validacao"), rv = new Set((await listar(await sub(dir, "validacao-respostas"))).arquivos.map(n => n.replace(/\.json$/, "")));
    for (const id of (await listar(pv)).pastas) {
      if (rv.has(id) || ((await lerJson(await pv.getDirectoryHandle(id), "pedido.json"))?.v || 1) >= VERSAO_PARTES) continue;
      const f = await BD.pegarFicha(v.mapa[id]);
      await apagar(pv, id);
      if (f) { try { await gravarItem(pv, id, { ...f }, { tipo: "validacao" }); } catch (e) { console.warn("OdontoScan: validação", e.message); } }
    }
  }
  await BD.gravarCfg("filaVersao", VERSAO_PARTES);
}
// ---------- fila local ----------
let puladas = 0;
export const puladasNoEnvioLocal = () => puladas;
/** Grava as fichas na fila da pasta de trabalho. `aoProgresso(i, n)`; `parar()` interrompe. */
export async function enviarLocal(fichas, { aoProgresso, parar } = {}) {
  const dir = await pastaTrabalho(); if (!dir) throw new Error("Escolha (ou libere) a pasta de trabalho na aba IA.");
  const fila = await sub(dir, "fila");
  let n = 0; puladas = 0;
  for (const f of fichas) {
    if (parar?.()) break;
    aoProgresso?.(n, fichas.length);
    try { await gravarItem(fila, f.pacote, f); }
    catch (e) {
      if (/NotAllowed|permission/i.test(`${e.name} ${e.message}`)) throw new Error("O Chrome não deixou gravar na pasta de trabalho: libere o acesso na aba IA.");
      const g = await BD.pegarFicha(f.id);
      if (g) { g.semCopia = true; g.imgFicha = null; g.imgEndereco = null; registrar(g, `Não foi para a fila local: ${e.message || e}`); await BD.salvarFicha(g); }
      puladas++; continue;
    }
    // relê antes de gravar (você pode ter confirmado os números dela enquanto isso)
    const g = await BD.pegarFicha(f.id);
    if (g) { g.enviada = new Date().toISOString(); g.filaLocal = true; registrar(g, "Gravada na fila da leitura local (pasta de trabalho)"); await BD.salvarFicha(g); }
    n++;
    if (n % 10 === 0) await new Promise(r => setTimeout(r, 0));
  }
  aoProgresso?.(n, fichas.length);
  return n;
}

let completando = null;
/** Grava na fila local todas as fichas que esperam (o leitor decide quantas lê por noite). Uma chamada por vez. */
export function completarFilaLocal(opts = {}) {
  if (completando) return completando.catch(() => {}).then(() => completarFilaLocal(opts));
  const este = (async () => {
    try {
      const dir = await pastaTrabalho(); if (!dir) return null;
      await atualizarFilaAntiga(dir);
      const todas = await BD.todasFichas();
      const nomes = new Set((await listar(await sub(dir, "fila"))).pastas);
      await arrumarFilaLocal(dir, nomes, todas);
      const atual = await BD.todasFichas(), porPacote = new Set(atual.map(f => f.pacote));
      try { await prepararExemplos(atual); } catch (e) { console.warn("OdontoScan: exemplos", e.message); }
      const naFila = [...nomes].filter(n => porPacote.has(n)).length;
      const esperando = paraEnviar(atual).sort((a, b) => a.criado.localeCompare(b.criado));
      const enviadas = await enviarLocal(esperando, opts);
      return { enviadas, naFila: naFila + enviadas, esperando: esperando.length - enviadas - puladas, alvo: esperando.length + naFila, puladas, local: true };
    } finally { if (completando === este) completando = null; }
  })();
  return (completando = este);
}

/**
 * Fichas marcadas como enviadas que não estão na fila local nem nas respostas (foram para a nuvem antes da troca de
 * modo, ou a pasta de trabalho mudou) voltam a esperar; e o que está na fila sem ficha correspondente sai.
 */
async function arrumarFilaLocal(dir, nomes, todas) {
  const resp = new Set((await listar(await sub(dir, "respostas"))).arquivos.filter(n => n.endsWith(".json")).map(n => n.slice(0, -5)));
  for (const f of todas.filter(f => f.enviada && !f.leitura && f.etapa !== "erro" && !nomes.has(f.pacote) && !resp.has(f.pacote))) {
    const g = await BD.pegarFicha(f.id);
    if (g && !g.leitura) { g.enviada = false; delete g.filaLocal; registrar(g, "Voltou para o envio (não estava na fila local)"); await BD.salvarFicha(g); }
  }
  const meus = new Set((await BD.todasComLixeira()).map(f => f.pacote).filter(Boolean)), fila = await sub(dir, "fila");
  for (const n of nomes) if (!meus.has(n) && await apagar(fila, n)) nomes.delete(n);
}

/** Tira fichas da fila local (ex.: foram para a lixeira). */
export async function tirarDaFilaLocal(pacotes) {
  const dir = await pastaTrabalho(); if (!dir || !pacotes.length) return 0;
  const fila = await sub(dir, "fila"); let n = 0;
  for (const p of pacotes) if (await apagar(fila, p)) n++;
  return n;
}

/** Lê as respostas do leitor local, entrega a `aplicar(ficha, resposta)` e apaga a resposta e a ficha da fila. */
export async function buscarRespostasLocal(aplicar) {
  const dir = await pastaTrabalho(); if (!dir) return { novas: 0, naFila: null, semPasta: true };
  const pResp = await sub(dir, "respostas"), pFila = await sub(dir, "fila");
  const porPacote = new Map((await BD.todasComLixeira()).filter(f => f.pacote).map(f => [f.pacote, f]));
  let novas = 0, semFicha = 0, invalidas = 0;
  for (const nome of (await listar(pResp)).arquivos.filter(n => n.endsWith(".json"))) {
    const id = nome.slice(0, -5), resposta = await lerJson(pResp, nome);
    if (!resposta || typeof resposta.ficha !== "object") { invalidas++; continue; } // ainda sendo gravada ou estragada: fica
    const f = porPacote.get(id);
    if (f && !f.leitura) { await aplicar(f, resposta); if (!f.lixeira) novas++; }
    else if (!f) semFicha++;
    await apagar(pResp, nome); await apagar(pFila, id);
  }
  const fila = (await listar(pFila)).pastas.filter(n => porPacote.has(n)).length;
  await BD.gravarCfg("ultimaBusca", new Date().toISOString());
  if (semFicha) await BD.gravarCfg("respostasSemFicha", ((await BD.lerCfg("respostasSemFicha")) || 0) + semFicha);
  return { novas, naFila: fila, desalinhadas: 0, semFicha, invalidas };
}

// ---------- estado das noites e limite ----------
/** estado.json do leitor (só números e datas), no formato do estado da nuvem, para o Painel e as metas. */
export async function lerEstadoLocal() {
  const dir = await pastaTrabalho();
  if (!dir) { const c = await BD.lerCfg("estadoFila"); return c?.local ? c : null; }
  const j = (await lerJson(dir, "estado.json")) || {};
  const { limite } = await lerModo(), ult = (j.historico || []).filter(h => h.lidas).at(-1);
  // sem limite, a "próxima noite" das metas é o que a última noite conseguiu ler
  const lim = limite || j.limite || ult?.lidas || 100;
  const est = { ...j, local: true, limite: lim, maximo_por_noite: lim, lido: new Date().toISOString() };
  await BD.gravarCfg("estadoFila", est);
  return est;
}
/**
 * O token do resumo para o celular também vai para o leitor (controle-github.json na pasta de trabalho, só neste
 * computador): com ele, o leitor lê a pausa pedida pelo celular e conta ao celular se está lendo ou pausado (29/10/2026).
 */
export async function gravarControleGithub(cred) {
  const dir = await pastaTrabalho(); if (!dir) return false;
  if (!cred?.token) { await apagar(dir, "controle-github.json"); return true; }
  const atual = await lerJson(dir, "controle-github.json");
  if (atual?.token === cred.token && atual?.repo === cred.repo) return true;
  await gravar(dir, "controle-github.json", JSON.stringify({ token: cred.token, repo: cred.repo, gravado: new Date().toISOString() }, null, 1));
  return true;
}
/** Máximo de fichas por noite no leitor local (0 = sem limite): vai para ajustes.json, que o leitor lê ao começar. */
export async function gravarLimiteLocal(n) {
  await BD.gravarCfg("leitura", { ...(await lerModo()), limite: n });
  const dir = await pastaTrabalho(); if (!dir) return;
  await gravar(dir, "ajustes.json", JSON.stringify({ limite_por_noite: n, alterado: new Date().toISOString() }, null, 1));
}
/** O leitor está lendo agora (estado.json atualizado nos últimos 10 min com uma noite em andamento)? */
export const lendoAgora = (est) => !!(est?.andamento && est.atualizado && Date.now() - new Date(est.atualizado) < 10 * 60000);

// ---------- validação: a leitura local × as revisões (sem mexer em nenhuma ficha) ----------
// cfg "validacaoLocal": { mapa: { <id do teste>: <id da ficha> }, criada, inicio (da rodada atual), rodadas: [resumos] }
const novoId = () => "v" + Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2, "0")).join("");
export const lerValidacao = async () => (await BD.lerCfg("validacaoLocal")) || null;
/** Revisadas com a cópia e o endereço neste computador (as que podem entrar no teste). */
export const candidatasValidacao = (fs) => fs.filter(f => gabaritoDe(f) && f.imgs?.ficha && f.imgs?.endereco && !f.semCopia);
/**
 * A revisão que serve de gabarito no teste: a guardada ao recomeçar a leitura (`f.gabarito`) ou, sem ela, a revisão
 * atual. Devolve { revisao, revisaoInicial } ou null.
 */
export function gabaritoDe(f) {
  if (f.gabarito?.revisao) return f.gabarito;
  if (f.revisao && (f.etapa === "revisada" || f.revisadaEm)) return { revisao: f.revisao, revisaoInicial: f.revisaoInicial || montarRevisao(f) };
  return null;
}

/**
 * Recomeça a leitura de TODAS as fichas (pedido do Alediov, 29/10/2026: migrar para o computador do laboratório e
 * refazer tudo com a leitura local, sem misturar com as leituras e revisões da nuvem). Cada ficha lida, enviada ou
 * revisada volta a esperar a leitura (os números confirmados e as imagens ficam); a revisão antiga vai para
 * `f.gabarito` (com o que a leitura de antes trouxe), que só o teste da leitura local usa: Revisar, Painel, Planilha e
 * relatório não a veem. A fila e as respostas antigas da pasta de trabalho saem.
 */
export async function recomecarLeitura({ aoProgresso } = {}) {
  const agora = new Date().toISOString(), todas = await BD.todasComLixeira();
  let guardadas = 0, voltaram = 0;
  for (const [i, f0] of todas.entries()) {
    if (i % 25 === 0) aoProgresso?.(i, todas.length);
    if (f0.etapa === "erro" || !(f0.leitura || f0.enviada || f0.revisao || f0.revisadaEm)) continue;
    const g = await BD.pegarFicha(f0.id); if (!g) continue;
    if (!g.gabarito && g.revisao && (g.etapa === "revisada" || g.revisadaEm)) {
      g.gabarito = { revisao: g.revisao, revisaoInicial: g.revisaoInicial || montarRevisao(g), revisadaEm: g.revisadaEm || null, lidaEm: g.lidaEm || null, guardadoEm: agora };
      guardadas++;
    }
    for (const k of ["leitura", "leituraInfo", "revisao", "revisaoInicial", "lidaEm", "revisadaEm", "enviada", "filaLocal"]) delete g[k];
    if (g.etapa !== "confirmar") g.etapa = "pronta";
    registrar(g, g.gabarito ? "Leitura recomeçada (leitura local): a revisão antiga ficou guardada só para o teste" : "Leitura recomeçada (leitura local)");
    await BD.salvarFicha(g); voltaram++;
  }
  aoProgresso?.(todas.length, todas.length);
  const dir = await pastaTrabalho();
  if (dir) for (const nome of ["fila", "respostas"]) { const p = await sub(dir, nome), l = await listar(p); for (const x of [...l.arquivos, ...l.pastas]) await apagar(p, x); }
  await BD.gravarCfg("recomeco", { em: agora, guardadas, voltaram });
  return { guardadas, voltaram };
}

/** Sorteia `n` fichas revisadas (ou usa as `ids`) e grava as cópias em validacao/. */
export async function prepararValidacao(fs, n, { ids = null, aoProgresso, parar } = {}) {
  const dir = await pastaTrabalho(); if (!dir) throw new Error("Escolha (ou libere) a pasta de trabalho primeiro.");
  await limparPastasValidacao(dir);
  let escolhidas;
  if (ids) { const por = new Map(fs.map(f => [f.id, f])); escolhidas = ids.map(i => por.get(i)).filter(Boolean); }
  else {
    const c = candidatasValidacao(fs).slice();
    for (let i = c.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [c[i], c[j]] = [c[j], c[i]]; }
    escolhidas = c.slice(0, n);
  }
  const pasta = await sub(dir, "validacao"), mapa = {};
  for (const [i, f0] of escolhidas.entries()) {
    if (parar?.()) break;
    aoProgresso?.(i, escolhidas.length);
    const id = novoId();
    try { await gravarItem(pasta, id, { ...f0 }, { tipo: "validacao" }); mapa[id] = f0.id; } catch (e) { console.warn("OdontoScan: validação", e.message); }
  }
  aoProgresso?.(escolhidas.length, escolhidas.length);
  const antes = await lerValidacao();
  await BD.gravarCfg("validacaoLocal", { mapa, criada: new Date().toISOString(), inicio: new Date().toISOString(), rodadas: antes?.rodadas || [] });
  return Object.keys(mapa).length;
}
async function limparPastasValidacao(dir, { soRespostas = false } = {}) {
  // validacao-comparar/<modelo>/: as leituras do fim de semana com os outros modelos (leitor.py, "comparar_modelos");
  // com "Ler de novo" (as mesmas fichas) elas continuam valendo
  for (const nome of soRespostas ? ["validacao-respostas"] : ["validacao", "validacao-respostas", "validacao-comparar"]) {
    const p = await sub(dir, nome), l = await listar(p);
    for (const x of [...l.arquivos, ...l.pastas]) await apagar(p, x);
  }
}

/** Compara as respostas do teste com as revisões. Devolve null se não há teste. */
/** As respostas do teste numa pasta (`pr`), comparáveis com as revisões: { pseudo, reais, modelo, seg, comSeg, falhas }. */
async function respostasDoTeste(pr, v, por) {
  const pseudo = [], reais = [], modelos = new Map();
  let seg = 0, comSeg = 0, falhas = 0;
  {
    for (const nome of (await listar(pr)).arquivos.filter(n => n.endsWith(".json"))) {
      const id = nome.slice(0, -5), f = por.get(v.mapa[id]), gb = f && gabaritoDe(f); if (!gb) continue;
      const r = await lerJson(pr, nome); if (!r || typeof r.ficha !== "object") continue;
      const meta = r._leitor || {};
      if (meta.modelo) modelos.set(meta.modelo, (modelos.get(meta.modelo) || 0) + 1);
      if (meta.segundos) { seg += meta.segundos; comSeg++; }
      if (meta.falhou) falhas++;
      const e = r.endereco || {};
      const ini = montarRevisao({ leitura: { ficha: r.ficha || {}, endereco: { bairro: e.bairro || null, municipio: e.municipio || null, rua: e.rua || null } } });
      // só a comparação: nenhuma ficha é alterada
      pseudo.push({ id: f.id, etapa: "revisada", revisao: gb.revisao, revisaoInicial: ini });
      reais.push({ id: f.id, etapa: "revisada", revisao: gb.revisao, revisaoInicial: gb.revisaoInicial || montarRevisao(f) });
    }
  }
  const modelo = [...modelos.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m).join(" + ") || null;
  return { pseudo, reais, modelo, segundos: comSeg ? seg / comSeg : null, falhas };
}
export async function resultadoValidacao(fs) {
  const v = await lerValidacao(); if (!v?.mapa) return null;
  const dir = await pastaTrabalho();
  const por = new Map(fs.map(f => [f.id, f]));
  const total = Object.keys(v.mapa).length;
  const R = dir ? await respostasDoTeste(await sub(dir, "validacao-respostas"), v, por) : { pseudo: [], reais: [], modelo: null, segundos: null, falhas: 0 };
  // os outros modelos, lidos no fim de semana pelo leitor (validacao-comparar/<modelo>/)
  const outros = [];
  if (dir) {
    const pc = await sub(dir, "validacao-comparar");
    for (const p of (await listar(pc)).pastas) {
      const o = await respostasDoTeste(await pc.getDirectoryHandle(p), v, por);
      if (o.pseudo.length) outros.push({ modelo: o.modelo || p, lidas: o.pseudo.length, segundos: o.segundos, falhas: o.falhas, local: concordancia(o.pseudo) });
    }
  }
  return {
    total, lidas: R.pseudo.length, modelo: R.modelo, falhas: R.falhas, segundos: R.segundos, inicio: v.inicio, criada: v.criada, rodadas: v.rodadas || [],
    local: concordancia(R.pseudo),
    tipos: tiposDeErro(R.pseudo), tiposAntes: tiposDeErro(R.reais),
    // a leitura que essas mesmas fichas tiveram antes (nuvem ou API), para comparar
    antes: concordancia(R.reais),
    outros,
  };
}
const resumo = (r) => ({ inicio: r.inicio, fim: new Date().toISOString(), modelo: r.modelo || "?", n: r.lidas, total: r.total, segundos: r.segundos, falhas: r.falhas,
  campos: r.local.total, procs: r.local.procs, fichasIguais: r.local.fichasIguais, por: Object.fromEntries(Object.entries(r.local.por).map(([k, x]) => [k, { k: x.k, n: x.n }])),
  antes: { campos: r.antes.total, procs: r.antes.procs, fichasIguais: r.antes.fichasIguais } });
/** Guarda o resultado atual nas rodadas e apaga as respostas, para o leitor ler as mesmas fichas de novo (outro modelo). */
export async function novaRodada(fs) {
  const v = await lerValidacao(), r = await resultadoValidacao(fs), dir = await pastaTrabalho();
  if (!v || !dir) return;
  if (r?.lidas) v.rodadas = [...(v.rodadas || []), resumo(r)].slice(-20);
  await limparPastasValidacao(dir, { soRespostas: true });
  v.inicio = new Date().toISOString();
  await BD.gravarCfg("validacaoLocal", v);
}
/** Encerra o teste: guarda o resultado e apaga as cópias de validacao/. */
export async function encerrarValidacao(fs) {
  const v = await lerValidacao(), r = await resultadoValidacao(fs), dir = await pastaTrabalho();
  if (!v) return;
  if (r?.lidas) v.rodadas = [...(v.rodadas || []), resumo(r)].slice(-20);
  if (dir) await limparPastasValidacao(dir);
  await BD.gravarCfg("validacaoLocal", { rodadas: v.rodadas || [] });
}
/** Esquece o histórico das rodadas. */
export async function apagarRodadas() { const v = await lerValidacao(); if (v) await BD.gravarCfg("validacaoLocal", { ...v, rodadas: [] }); }

// ---------- exemplos da própria letra e "ler de novo" (04/11/2026, sugestões aceitas pelo Alediov depois do 1º teste:
// 70% dos campos e 34% dos procedimentos, contra 95% da nuvem) ----------
// exemplos/: pedaços de fichas JÁ CONFERIDAS (fora as do teste, para não inflar a medida), com a resposta certa. O leitor
// põe 2 ou 3 deles antes de cada pedaço a ler: o modelo vê como é a letra desta clínica e o que se espera. Ficam só na
// pasta de trabalho deste computador, como a fila. frequencias.json: só quantas vezes cada código aparece (para o leitor
// escolher entre os parecidos).
export const VERSAO_EXEMPLOS = 1;
const QUER = { data: 16, nascimento: 16, procedimento: 40, vazia: 8 };
const DENTE_OK = /^(1[1-8]|2[1-8]|3[1-8]|4[1-8]|5[1-5]|6[1-5]|7[1-5]|8[1-5])$/;
const so = (v) => String(v ?? "").replace(/\D/g, "");
export const lerExemplos = async () => (await BD.lerCfg("exemplosLocal")) || null;
/** Grava (ou refaz) os exemplos. Sem `forcar`, só se faltam ou têm mais de 7 dias. Devolve { v, em, n } ou null. */
export async function prepararExemplos(fs, { forcar = false, aoProgresso } = {}) {
  const dir = await pastaTrabalho(); if (!dir) return null;
  const atual = await lerExemplos();
  if (!forcar && atual?.v === VERSAO_EXEMPLOS && Date.now() - new Date(atual.em).getTime() < 7 * 864e5) return atual;
  const teste = new Set(Object.values((await lerValidacao())?.mapa || {}));
  const conferida = (f) => f.revisao && (f.etapa === "revisada" || f.revisadaEm) ? f.revisao : f.gabarito?.revisao || null;
  const cands = fs.filter(f => !teste.has(f.id) && conferida(f) && (f.imgs?.ficha || f.imgs?.inteira) && !f.semCopia);
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  definirFrequencias(fs);
  const pasta = await sub(dir, "exemplos");
  for (const x of [...(await listar(pasta)).arquivos]) await apagar(pasta, x);
  const itens = [], n = { data: 0, nascimento: 0, procedimento: 0, vazia: 0 }, porCodigo = new Map();
  const falta = () => Object.keys(QUER).some(k => n[k] < QUER[k]);
  let k = 0;
  for (const [ix, f0] of cands.entries()) {
    if (!falta()) break;
    aoProgresso?.(ix, cands.length);
    const g = conferida(f0), f = { ...f0 };
    let partes, tintas;
    try { await BD.comImagens(f, ["ficha", "endereco", "inteira", "topo"]); ({ partes, tintas } = await partesDaFicha(f)); }
    catch { continue; }
    finally { delete f.imgFicha; delete f.imgEndereco; delete f.imgInteira; delete f.imgTopo; }
    const blob = (arq) => partes.find(p => p.arq === arq)?.blob;
    const poe = async (parte, arq, texto, resposta) => { const b = blob(arq); if (!b) return false; const nome = `e${String(++k).padStart(3, "0")}-${arq.replace(/^p-/, "")}`; await gravar(pasta, nome, b); itens.push({ arq: nome, parte, texto, resposta }); return true; };
    const data = /^\d{4}-\d{2}-\d{2}$/.test(g.data || "") ? g.data : null;
    if (data && n.data < QUER.data && await poe("data", "p-data.jpg", "Exemplo de outra ficha, já conferido:", { data, duvidas: [] })) n.data++;
    const sexo = g.sexo === "Feminino" ? "F" : g.sexo === "Masculino" ? "M" : null, idade = g.idadeEscrita === "" || g.idadeEscrita == null || isNaN(+g.idadeEscrita) ? null : +g.idadeEscrita;
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(g.nascimento || "") && n.nascimento < QUER.nascimento &&
      await poe("nascimento", "p-nascimento.jpg", `Exemplo de outra ficha (a data do atendimento dela é ${data}), já conferido:`, { nascimento: g.nascimento, sexo, idade, duvidas: [] })) n.nascimento++;
    // as linhas: só de fichas em que cada linha com escrita é um procedimento (sem linhas riscadas nem "〃": a quantidade
    // de linhas com tinta bate com a de procedimentos e nenhum código se repete na linha seguinte)
    const procs = (g.procedimentos || []).filter(q => so(q.codigo));
    const lim = GEO_PARTES.limiarLinha, comTinta = tintas.filter(t => t >= lim).length;
    const bate = procs.length && procs.length === comTinta && tintas.slice(0, procs.length).every(t => t >= lim) && procs.length <= GEO_PARTES.linhas.length &&
      !procs.some((q, i) => i && so(q.codigo) === so(procs[i - 1].codigo)) && procs.every(q => !String(q.dente || "").trim() || DENTE_OK.test(String(q.dente).trim()));
    if (bate) {
      for (const [i, q] of procs.entries()) {
        const cod = so(q.codigo);
        if (n.procedimento >= QUER.procedimento || (porCodigo.get(cod) || 0) >= 4) continue;
        const arq = `p-proc-${String(i + 1).padStart(2, "0")}.jpg`;
        if (await poe("procedimento", arq, `Exemplo de outra ficha (linha ${i + 1}), já conferido:`, { vazia: false, riscada: false, igual_acima: false, dente: String(q.dente || "").trim() || null, codigo: cod, duvidas: [] })) { n.procedimento++; porCodigo.set(cod, (porCodigo.get(cod) || 0) + 1); }
      }
      const prox = `p-proc-${String(procs.length + 1).padStart(2, "0")}.jpg`;
      if (n.vazia < QUER.vazia && await poe("procedimento", prox, `Exemplo de outra ficha (linha ${procs.length + 1}), já conferido:`, { vazia: true, riscada: false, igual_acima: false, dente: null, codigo: null, duvidas: [] })) n.vazia++;
    }
  }
  await gravar(pasta, "indice.json", JSON.stringify({ v: VERSAO_EXEMPLOS, criado: new Date().toISOString(), itens }, null, 1));
  await gravar(dir, "frequencias.json", JSON.stringify({ criado: new Date().toISOString(), codigos: frequenciasGerais() }));
  const res = { v: VERSAO_EXEMPLOS, em: new Date().toISOString(), n: { ...n, total: itens.length } };
  await BD.gravarCfg("exemplosLocal", res);
  aoProgresso?.(cands.length, cands.length);
  return res;
}

/** Lidas e ainda não conferidas (as que "Ler de novo" devolve à fila). */
export const lidasNaoConferidas = (fs) => fs.filter(f => f.leitura && f.etapa !== "erro" && !f.lixeira && f.etapa !== "revisada" && !f.revisadaEm);
/** Devolve à fila as lidas e ainda não conferidas, para o leitor ler de novo (com as melhorias). Os números já
 *  confirmados e as imagens ficam. Devolve quantas voltaram. */
export async function lerDeNovo(fs, { aoProgresso } = {}) {
  const lista = lidasNaoConferidas(fs);
  let n = 0;
  for (const [i, f0] of lista.entries()) {
    if (i % 25 === 0) aoProgresso?.(i, lista.length);
    const g = await BD.pegarFicha(f0.id);
    if (!g?.leitura || g.etapa === "revisada" || g.revisadaEm) continue;
    for (const k of ["leitura", "leituraInfo", "revisao", "revisaoInicial", "lidaEm", "enviada", "filaLocal"]) delete g[k];
    if (g.etapa !== "confirmar") g.etapa = "pronta";
    registrar(g, "Voltou para a fila: ler de novo com o leitor melhorado");
    await BD.salvarFicha(g); n++;
  }
  aoProgresso?.(lista.length, lista.length);
  return n;
}
