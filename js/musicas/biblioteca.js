// Biblioteca das Músicas: lê a pasta (Músicas/<Artista>/<faixas>), guarda os dados de cada faixa, as estrelas,
// as contagens (tocadas, puladas, última vez), as tags internas e as playlists (internamente "álbuns": comuns,
// fixas como Estudos e Favoritas, e inteligentes, com regras). Estudos toca nas lições do Estudos.
import * as BD from "./banco.js";
import { motor } from "./motor.js";
import { tituloNoPadrao as padronizarTitulo } from "./tagsInternas.js";
import { definirSiglas, siglasDoTitulo, compararTitulos } from "./titulos.js";
import { analisarTitulo, montarTitulo, definirVersoes, versoes as versoesAtuais, tagsDoArquivo, tagsParaArquivo, normTag, VERSOES_FEITAS, temTag, chaveConjunto } from "./tagsInternas.js";
import { calcular as calcularInteligente } from "./inteligentes.js";
import { chaveSom, esqueleto, temKana } from "./romaji.js";
import { nomeArquivo, conferirNome, chaveArquivo, tituloDoArquivo, semSinalDeCopia } from "./nomes.js";
export { nomeArquivo };

export const ESTUDOS = "estudos", FAVORITAS = "favoritas";
// playlist fixa do despertador (alarmes.js manda as músicas dela ao Android; pedido do Alediov, 26/10/2026)
export const ALARME = "alarme";
import { SEU_DIA, seuDia } from "./seuDia.js";
export { SEU_DIA };
let cache = null; // Map id → faixa
let indiceFeat = null; // Map feat → [faixas] (só os grupos com 2 ou mais), refeito depois de cada mudança
const avisos = new Set();
export const aoMudarBiblioteca = (fn) => { avisos.add(fn); return () => avisos.delete(fn); };
const mudou = (o = {}) => {
  indiceFeat = null;
  avisos.forEach(fn => { try { fn(o); } catch (e) { console.warn(e); } });
  if (o.albuns || o.tags || o.biblioteca || o.cfgPasta) agendarGuardarNaPasta();
  if (o.albuns || o.biblioteca || o.notas || !Object.keys(o).length) agendarAuto();
};

// Android Auto (pedido do Alediov, 25/10/2026): o carro navega por um resumo da biblioteca (faixas e playlists) que
// fica num arquivo do app (AutoBiblioteca.java), para valer também com o app fechado. Mandado 8 s depois de cada
// mudança e ao abrir as Músicas. Faixas: [id, título, artista, álbum, ganho]; playlists pelos índices das faixas.
let timerAuto = null;
export function agendarAuto(ms = 8000) {
  if (!motor.nativo || !motor.bibliotecaAuto) return;
  clearTimeout(timerAuto);
  timerAuto = setTimeout(() => enviarAuto().catch(e => console.warn("Músicas: Android Auto", e.message)), ms);
}
export async function enviarAuto() {
  const m = await faixas(), todas = [...m.values()].filter(f => !f.entrada).sort(porTitulo);
  const idx = new Map(todas.map((f, i) => [f.id, i]));
  const fx = todas.map(f => [f.id, f.titulo || "", f.artista || "", f.album || "", f.ganho ?? null]);
  const listas = (await albuns()).map(a => ({ id: a.id, nome: a.nome, fixo: !!a.fixo, f: (a.faixas || []).map(id => idx.get(id)).filter(i => i != null) })).filter(a => a.f.length);
  const dados = JSON.stringify({ v: 1, faixas: fx, listas });
  await motor.bibliotecaAuto(dados);
  return { faixas: fx.length, listas: listas.length, bytes: dados.length };
}

let cfgTagsLida = false;
async function lerCfgTags() { return (await BD.lerCfg("tagsInternas")) || { versoes: [], grupos: [] }; }
// Grupos das tags (pedido do Alediov, 24/10/2026): Animes, Jogos, Filmes e Séries já vêm prontos; ele cria outros e
// leva as tags para dentro deles (cfg "tagsInternas".categorias = [{ nome, tags: [nomes] }]; no código, "grupo" já é
// o tipo das tags feitas à mão, por isso aqui é "categoria"). Uma tag fica em um grupo só, ou em nenhum.
// Desde 02/11/2026 (pedido do Alediov: "separe em categorias as tags"; escolha dele: seções fixas na aba Tags) os
// fixos são Animes, Jogos, Filmes, Séries e Artistas/Projetos, sempre presentes e nessa ordem (não se renomeiam nem se
// apagam; um fixo apagado antes volta), e os criados por ele vêm depois, na ordem em que foram criados.
// "Em Avaliação" (pedido do Alediov, 09/11/2026): fixo também, onde ficam as tags que ele ainda vai distribuir; a tag
// nova sem grupo escolhido cai nele (a aba Tags o mostra no alto, destacado, só quando tem alguma).
// Os grupos DELE que ficam vazios (as tags saíram ou foram apagadas) somem sozinhos (`semVazias`; pedido de 09/11/2026).
export const EM_AVALIACAO = "Em Avaliação";
export const CATEGORIAS_FIXAS = ["Animes", "Jogos", "Filmes", "Séries", "Artistas/Projetos", EM_AVALIACAO];
export const ehCategoriaFixa = (nome) => CATEGORIAS_FIXAS.some(n => normTag(n) === normTag(nome));
function categoriasDe(c) {
  const l = (c.categorias || []).map(x => ({ nome: x.nome, tags: [...(x.tags || [])], ...(x.icone ? { icone: x.icone } : {}) }));
  for (const n of CATEGORIAS_FIXAS) if (!l.some(x => normTag(x.nome) === normTag(n))) l.push({ nome: n, tags: [] });
  const pos = (x) => { const i = CATEGORIAS_FIXAS.findIndex(n => normTag(n) === normTag(x.nome)); return i < 0 ? CATEGORIAS_FIXAS.length : i; };
  return l.map((x, i) => [x, i]).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map(([x]) => x);
}
/** Tira os grupos dele (não fixos) que tinham tag em `antes` e ficaram sem nenhuma. Devolve os nomes tirados. */
function semVazias(c, antes) {
  const tinha = new Set(antes.filter(x => x.tags.length).map(x => normTag(x.nome)));
  const tirados = c.categorias.filter(x => !ehCategoriaFixa(x.nome) && !x.tags.length && tinha.has(normTag(x.nome))).map(x => x.nome);
  if (tirados.length) c.categorias = c.categorias.filter(x => !tirados.includes(x.nome));
  return tirados;
}
export async function faixas() {
  if (!cfgTagsLida) { cfgTagsLida = true; try { definirVersoes((await lerCfgTags()).versoes || []); definirSiglas((await BD.lerCfg("siglas")) || []); } catch { /* sem cfg */ } }
  if (!cache) cache = new Map((await BD.todasFaixas()).map(f => [f.id, f]));
  return cache;
}
export async function listaFaixas() { return [...(await faixas()).values()]; }
export async function faixa(id) { return (await faixas()).get(id); }

const limpo = (s) => (s == null ? "" : String(s).replace(/\s+/g, " ").trim());
const semExt = (n) => n.replace(/\.[^.]+$/, "");
const chaveMusica = (f) => `${(f.artista || "").toLowerCase()}|${(f.titulo || "").toLowerCase()}`;

// O ano: primeiro o lido pelo jaudiotagger (`anoArq`, de lerNotas), porque o MediaMetadataRetriever do Android não lê o
// TDRC do ID3v2.4 (o das músicas baixadas) e o ano gravado pelo app "sumia" ao ler a pasta de novo (bug relatado pelo
// Alediov em 02/11/2026; e o DATE que ele devolve no M4A sem ano é a data da codificação); se a leitura do arquivo
// falhou, fica o que o app já sabia.
function anoDaTag(tag, antiga) {
  const a = (tag.anoLido ? limpo(tag.anoArq) : limpo(tag.ano)).match(/\d{4}/)?.[0] || "";
  return a || (tag.erro ? antiga?.ano || "" : "");
}
function montar(arq, tag, antiga) {
  const partes = arq.caminho.split("/"), nomeArq = semExt(partes[partes.length - 1]);
  const pasta = partes.length > 1 ? partes[partes.length - 2] : "";
  const ext = (arq.caminho.match(/\.([^.\/]+)$/)?.[1] || "").toLowerCase();
  // sem a tag de título: pelo nome do arquivo, sem o número da faixa e sem os sinais de cópia ("Lua (1)" → "Lua")
  const titulo = limpo(tag.titulo) || semSinalDeCopia(nomeArq.replace(/^\d{1,3}[\s._-]+/, ""));
  const artista = limpo(tag.artista) || limpo(tag.albumArtista) || pasta || "Sem artista";
  return {
    ...(antiga || {}),
    id: arq.id, caminho: arq.caminho, tamanho: arq.tamanho, modificado: arq.modificado,
    titulo, artista, pasta, semTagTitulo: !limpo(tag.titulo), semTagArtista: !limpo(tag.artista),
    album: limpo(tag.album), albumArtista: limpo(tag.albumArtista), genero: limpo(tag.genero), ano: anoDaTag(tag, antiga), faixa: limpo(tag.faixa),
    duracao: +tag.duracao || antiga?.duracao || 0, bitrate: +tag.bitrate || 0, formato: ext, temCapa: !!tag.temCapa,
    nota: antiga?.nota ?? Math.max(0, tag.nota || 0), fav: antiga?.fav ?? !!tag.fav, tags: antiga?.tags ?? (tag.tagsInternas || []), tocadas: antiga?.tocadas || 0, puladas: antiga?.puladas || 0, ultimaVez: antiga?.ultimaVez || 0,
    adicionadaEm: antiga?.adicionadaEm || Date.now(),
  };
}

/** Escolhe (ou troca) a pasta das músicas. */
export async function escolherPasta() {
  const p = await motor.escolherPasta();
  await BD.gravarCfg("pasta", p);
  return p;
}
export const pasta = () => BD.lerCfg("pasta");

/** Lê a pasta: novas, mudadas e removidas. Faixa que mudou de lugar (mesmo artista, título e duração) leva as estrelas e as contagens. */
export async function sincronizar(aoProgresso = () => {}) {
  const p = await pasta();
  if (!p) throw new Error("sem_pasta");
  aoProgresso({ fase: "listando", feitas: 0, total: 0 });
  const todosArquivos = await motor.listar(p.uri);
  // a pasta de entrada fica fora da biblioteca (escolhida: só se estiver dentro da pasta das músicas)
  const naEntrada = await filtroEntrada(p);
  const lista = todosArquivos.filter(a => !naEntrada(a));
  if (!(await pastaEntradaEscolhida())) ultimaEntrada = todosArquivos.filter(naEntrada);
  if (!lista.length && (await faixas()).size) throw new Error("pasta_vazia"); // cartão de memória fora? não apaga nada
  const atuais = await faixas(), atuaisAntes = new Set(atuais.keys());
  const vistos = new Set(lista.map(a => a.id));
  const novas = lista.filter(a => { const f = atuais.get(a.id); return !f || f.modificado !== a.modificado || f.tamanho !== a.tamanho; });
  const sumiram = [...atuais.values()].filter(f => !vistos.has(f.id));
  const porChave = new Map(sumiram.map(f => [chaveMusica(f), f]));
  const trocas = new Map(); // id antigo → id novo
  let feitas = 0;
  for (let i = 0; i < novas.length; i += 25) {
    const bloco = novas.slice(i, i + 25);
    const tags = await motor.lerTags(bloco.map(a => a.id));
    const porId = new Map(tags.map(t => [t.id, t]));
    // pelo jaudiotagger (lerNotas): o ano de todas as que mudaram; e, nas novas (ou depois de apagar os dados do app),
    // as estrelas, a favorita e as tags internas que estão dentro do arquivo
    if (motor.lerNotas) {
      try {
        for (const n of await motor.lerNotas(bloco.map(a => ({ id: a.id, caminho: a.caminho })))) {
          const t = porId.get(n.id); if (!t) continue;
          if (!n.erro && n.ano !== undefined) { t.anoArq = n.ano || ""; t.anoLido = true; }
          if (atuais.get(n.id)) continue;
          if (n.nota >= 0) t.nota = n.nota; if (n.fav) t.fav = true; const tg = tagsDoArquivo(n.tags); if (tg.length) t.tagsInternas = tg;
        }
      } catch (e) { console.warn("Músicas: notas dos arquivos", e.message); }
    }
    const pend = await carregarPendentes();
    const salvar = [];
    for (const a of bloco) {
      let antiga = atuais.get(a.id);
      const f = montar(a, porId.get(a.id) || {}, antiga);
      // o que ainda espera para ir ao arquivo (a música estava tocando, o app fechou antes) vale mais que o arquivo
      const pc = pend.get(a.id)?.campos;
      if (pc?.ano !== undefined) f.ano = pc.ano;
      if (pc?.genero !== undefined) f.genero = pc.genero;
      if (!antiga) {
        const velha = porChave.get(chaveMusica(f));
        if (velha && Math.abs((velha.duracao || 0) - (f.duracao || 0)) < 3000) {
          Object.assign(f, { nota: velha.nota, fav: velha.fav, tags: velha.tags || f.tags, versaoDe: velha.versaoDe, ...(velha.feat ? { feat: velha.feat } : {}), perguntouSpedUp: velha.perguntouSpedUp, tocadas: velha.tocadas, puladas: velha.puladas, ultimaVez: velha.ultimaVez, adicionadaEm: velha.adicionadaEm });
          trocas.set(velha.id, f.id); porChave.delete(chaveMusica(f));
        }
      }
      salvar.push(f); atuais.set(f.id, f);
    }
    await BD.salvarFaixas(salvar);
    feitas += bloco.length;
    aoProgresso({ fase: "lendo", feitas, total: novas.length });
  }
  if (sumiram.length) {
    await BD.apagarFaixas(sumiram.map(f => f.id));
    sumiram.forEach(f => atuais.delete(f.id));
  }
  if (trocas.size || sumiram.length) {
    for (const a of await BD.todosAlbuns()) {
      const ids = (a.faixas || []).map(id => trocas.get(id) || id).filter(id => atuais.has(id));
      const fora = (a.fora || []).map(id => trocas.get(id) || id).filter(id => atuais.has(id));
      if (ids.join() !== (a.faixas || []).join() || fora.join() !== (a.fora || []).join()) await BD.salvarAlbum({ ...a, faixas: a.tipo === "inteligente" ? [] : ids, fora });
    }
    const ligadas = [...atuais.values()].filter(g => g.versaoDe && trocas.has(g.versaoDe));
    for (const g of ligadas) g.versaoDe = trocas.get(g.versaoDe);
    if (ligadas.length) await BD.salvarFaixas(ligadas);
  }
  await BD.gravarCfg("sincronizadaEm", Date.now());
  // dados do app apagados (biblioteca vazia antes): playlists, tags e o resto voltam do arquivo da pasta
  if (!atuaisAntes.size && atuais.size) { try { await restaurarDaPasta(); } catch (e) { console.warn("Músicas: restaurar da pasta", e.message); } }
  // versões novas herdam as tags de tema da família (e as famílias que estavam diferentes ficam iguais)
  try { await igualarTagsDasFamilias(); } catch (e) { console.warn("Músicas: tags das versões", e.message); }
  try { await anoDasVersoes(); } catch (e) { console.warn("Músicas: ano das versões", e.message); }
  try { await igualarFeats(); } catch (e) { console.warn("Músicas: feat.", e.message); }
  mudou({ biblioteca: true, albuns: true });
  return { total: lista.length, novas: novas.filter(a => !atuaisAntes.has(a.id)).length - trocas.size, atualizadas: novas.filter(a => atuaisAntes.has(a.id)).length, removidas: sumiram.length - trocas.size, movidas: trocas.size };
}

/** Soma o histórico do tocador (tocadas e puladas) nas faixas. */
export async function aplicarHistorico() {
  // estrelas e coração dados na notificação ou no widget (26/10/2026): aplicados junto com o histórico
  import("./notaNativa.js").then(n => { n.iniciarNotaNativa(); return n.aplicarAvaliacoesDeFora(); }).catch(e => console.warn("Músicas: notas de fora", e?.message));
  let itens = [];
  try { itens = await motor.historico(); } catch { return 0; }
  if (!itens.length) return 0;
  const m = await faixas(), mudadas = new Map();
  for (const h of itens) {
    const f = m.get(h.id); if (!f) continue;
    if (h.tipo === "tocada") { f.tocadas = (f.tocadas || 0) + 1; f.ultimaVez = Math.max(f.ultimaVez || 0, h.em || Date.now()); }
    else if (h.tipo === "pulada") f.puladas = (f.puladas || 0) + 1;
    mudadas.set(f.id, f);
  }
  if (mudadas.size) await BD.salvarFaixas([...mudadas.values()]);
  // desde 04/11/2026: o volume do aparelho e a saída (vêm do tocador) e o tempo lá fora naquela hora (tempoOuvindo.js)
  let TO = null, arq = null;
  try { TO = await import("./tempoOuvindo.js"); TO.arquivarHoras(); arq = TO.lerArquivo(); } catch { /* sem o Clima */ }
  await BD.adicionarReproducoes(itens.filter(h => m.has(h.id)).map(h => {
    const em = h.em || Date.now(), r = { id: h.id, tipo: h.tipo, em, dur: m.get(h.id).duracao || 0, artista: m.get(h.id).artista };
    if (typeof h.vol === "number" && h.vol >= 0 && h.vol <= 1) r.vol = Math.round(h.vol * 100) / 100;
    if (h.saida) r.saida = String(h.saida).slice(0, 16);
    const t = TO && arq ? TO.tempoNaHora(em, arq) : null;
    if (t) r.tempo = t;
    return r;
  }));
  if (mudadas.size) mudou({ contagens: true });
  return itens.length;
}

/** Estrelas: 0 a 10 (meias estrelas). */
export async function avaliar(id, nota) {
  const f = await faixa(id); if (!f) return;
  f.nota = Math.max(0, Math.min(10, Math.round(nota)));
  await BD.salvarFaixa(f);
  mudou({ nota: id });
  agendarGravacao(f);
  // feat. (02/11/2026): a mesma música na pasta de cada artista fica com as mesmas estrelas
  for (const g of parceirosFeat(f)) { if ((g.nota || 0) === f.nota) continue; g.nota = f.nota; await BD.salvarFaixa(g); mudou({ nota: g.id }); agendarGravacao(g); }
}
/** Coração: a faixa entra (ou sai) do álbum Favoritas. Também vai para o arquivo. */
export async function favoritar(id, fav) {
  const f = await faixa(id); if (!f) return;
  f.fav = !!fav;
  await BD.salvarFaixa(f);
  mudou({ albuns: true, album: FAVORITAS, fav: id });
  agendarGravacao(f);
  for (const g of parceirosFeat(f)) { if (!!g.fav === f.fav) continue; g.fav = f.fav; await BD.salvarFaixa(g); mudou({ albuns: true, album: FAVORITAS, fav: g.id }); agendarGravacao(g); }
}

// ---------- estrelas e favorita DENTRO do arquivo (sobrevivem a apagar os dados do app) ----------
// Gravar reescreve o arquivo; a faixa que está tocando espera trocar de música. As pendentes ficam
// guardadas (cfg "gravar") e saem aos poucos, uma por vez.
let pendentes = null, gravando = false, tocandoAgora = null, timerGrav = null;
async function carregarPendentes() { if (!pendentes) pendentes = new Map(Object.entries((await BD.lerCfg("gravar")) || {})); return pendentes; }
export function faixaTocando(id) { tocandoAgora = id; if (id) setTimeout(gravarPendentes, 1500); }
async function agendarGravacao(f) {
  if (!motor.gravarNotas) return;
  const p = await carregarPendentes();
  p.set(f.id, { ...(p.get(f.id) || {}), nota: f.nota || 0, fav: !!f.fav, tags: tagsParaArquivo(f.tags), caminho: f.caminho });
  await BD.gravarCfg("gravar", Object.fromEntries(p));
  clearTimeout(timerGrav); timerGrav = setTimeout(gravarPendentes, 4000);
}
/** Põe campos de tag (gênero, ano…) na fila de gravação, com as estrelas e as tags internas de sempre. */
async function agendarCampos(f, campos) {
  if (!motor.gravarNotas) return;
  const p = await carregarPendentes(), atual = p.get(f.id) || {};
  p.set(f.id, { ...atual, nota: f.nota || 0, fav: !!f.fav, tags: tagsParaArquivo(f.tags), caminho: f.caminho, campos: { ...(atual.campos || {}), ...campos } });
  await BD.gravarCfg("gravar", Object.fromEntries(p));
  clearTimeout(timerGrav); timerGrav = setTimeout(gravarPendentes, 4000);
}
export async function gravarPendentes() {
  if (gravando || !motor.gravarNotas) return;
  gravando = true;
  try {
    const p = await carregarPendentes();
    if (!p.size) return;
    try { tocandoAgora = (await motor.estado())?.id || null; } catch { /* sem tocador */ }
    for (const [id, g] of [...p]) {
      if (id === tocandoAgora) continue;
      try {
        // o gênero (grupo pelo som) vai antes, pela gravação de tags; depois as estrelas, o coração e as tags internas
        const campos = { ...(g.genero != null ? { genero: g.genero } : {}), ...(g.campos || {}) };
        if (Object.keys(campos).length && motor.gravarTags) await motor.gravarTags(id, g.caminho, campos);
        const r = await motor.gravarNotas(id, g.caminho, g.nota, g.fav, g.tags);
        const f = await faixa(id);
        if (f && r?.tamanho) { f.tamanho = r.tamanho; f.modificado = r.modificado; await BD.salvarFaixa(f); }
        p.delete(id);
      } catch (e) {
        console.warn("Músicas: gravar no arquivo", g.caminho, e.message);
        if (/não existe|not found|FileNotFound/i.test(e.message)) p.delete(id);
        else { g.erros = (g.erros || 0) + 1; if (g.erros > 3) p.delete(id); }
      }
      await BD.gravarCfg("gravar", Object.fromEntries(p));
    }
  } finally { gravando = false; }
}
/** Uma vez só: as estrelas e corações dados antes de existir a gravação no arquivo entram na fila. */
export async function migrarNotasParaArquivos() {
  if (!motor.gravarNotas || (await BD.lerCfg("notasNoArquivo"))) return 0;
  const l = [...(await faixas()).values()].filter(f => f.nota > 0 || f.fav);
  const p = await carregarPendentes();
  for (const f of l) if (!p.has(f.id)) p.set(f.id, { nota: f.nota || 0, fav: !!f.fav, tags: tagsParaArquivo(f.tags), caminho: f.caminho });
  await BD.gravarCfg("gravar", Object.fromEntries(p));
  await BD.gravarCfg("notasNoArquivo", Date.now());
  return l.length;
}
export async function gravacoesPendentes() { return (await carregarPendentes()).size; }

// ---------- capas ----------
// Três tamanhos: "mini" (320 px, listas), "media" (720 px, grade dos artistas e cabeçalhos) e "original" (os bytes do
// arquivo, sem reduzir nem recomprimir: tela Tocando e editor). As reduzidas ficam no IndexedDB; as originais, só
// algumas na memória (como blob:).
const capasMem = new Map(), esperando = [], originais = new Map();
let buscando = 0;
export async function capaDe(f, tam = "mini") {
  if (!f?.temCapa) return "";
  if (tam === "original") return capaOriginal(f);
  const k = tam === "media" ? f.id + "#m" : f.id;
  if (capasMem.has(k)) return capasMem.get(k);
  const salva = await BD.pegarCapa(k);
  if (salva !== undefined) { capasMem.set(k, salva); return salva; }
  return new Promise(ok => { esperando.push([f, k, tam === "media" ? 720 : 320, ok]); proximaCapa(); });
}
async function proximaCapa() {
  if (buscando >= 3 || !esperando.length) return;
  const [f, k, lado, ok] = esperando.shift();
  buscando++;
  let d = "";
  try { d = await motor.capa(f.id, lado); } catch { d = ""; }
  capasMem.set(k, d); BD.salvarCapa(k, d).catch(() => {});
  buscando--; ok(d); proximaCapa();
}
async function capaOriginal(f) {
  if (originais.has(f.id)) return originais.get(f.id);
  const p = (async () => {
    let d = "";
    try { d = await motor.capa(f.id, 0); } catch { d = ""; }
    if (!d) return "";
    try { return URL.createObjectURL(await (await fetch(d)).blob()); } catch { return d; }
  })();
  originais.set(f.id, p);
  while (originais.size > 6) { const [k, v] = originais.entries().next().value; originais.delete(k); v.then(u => { if (u?.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(u), 4000); }); }
  return p;
}
function esquecerCapa(id) {
  capasMem.delete(id); capasMem.delete(id + "#m");
  const o = originais.get(id); if (o) { originais.delete(id); o.then(u => { if (u?.startsWith("blob:")) URL.revokeObjectURL(u); }); }
  BD.salvarCapa(id, undefined).catch(() => {}); BD.salvarCapa(id + "#m", undefined).catch(() => {});
}

// ---------- playlists (no banco, "álbuns") ----------
// Tipos: comuns (lista à mão), fixas (Estudos; Favoritas é virtual, do coração) e inteligentes (`tipo: "inteligente"`,
// `regras`, `ordem`, `limite`, `limiteTipo`, `fora`: as tiradas à mão), calculadas a cada vez (inteligentes.js).
export async function albuns() {
  const l = await BD.todosAlbuns();
  if (!l.some(a => a.id === ESTUDOS)) {
    const e = { id: ESTUDOS, nome: "Estudos", fixo: true, faixas: [], criadoEm: Date.now() };
    await BD.salvarAlbum(e); l.push(e);
  }
  if (!l.some(a => a.id === ALARME)) {
    const e = { id: ALARME, nome: "Alarme", fixo: true, faixas: [], criadoEm: Date.now() };
    await BD.salvarAlbum(e); l.push(e);
  }
  const m = await faixas(), todas = [...m.values()];
  const favs = todas.filter(f => f.fav).sort(porTitulo).map(f => f.id);
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const base = [...l, { id: FAVORITAS, nome: "Favoritas", fixo: true, virtual: true, faixas: favs },
    { id: SEU_DIA, nome: "Seu dia", fixo: true, virtual: true, ordenada: true, faixas: todas.length ? seuDia(todas, hoje).map(f => f.id) : [] }];
  const conjuntos = new Map(base.filter(a => a.tipo !== "inteligente").map(a => [a.id, new Set(a.faixas)]));
  const intel = base.filter(a => a.tipo === "inteligente");
  const categorias = intel.length ? await mapaCategorias() : new Map();
  const calc = (a, prof = 0) => {
    if (conjuntos.has(a.id)) return;
    if (prof > 3) { conjuntos.set(a.id, new Set()); return; }
    for (const r of [...(a.regras?.incluir || []), ...(a.regras?.excluir || [])]) {
      if (r.campo !== "playlist" || r.valor === a.id || conjuntos.has(r.valor)) continue;
      const b = intel.find(x => x.id === r.valor); if (b) calc(b, prof + 1);
    }
    a.faixas = calcularInteligente(a, todas, { porTitulo, playlists: conjuntos, categorias }).map(f => f.id);
    conjuntos.set(a.id, new Set(a.faixas));
  };
  intel.forEach(a => calc(a));
  const ordemFixos = { [SEU_DIA]: 0, [ESTUDOS]: 1, [FAVORITAS]: 2, [ALARME]: 3 };
  return base.sort((a, b) => (a.fixo || b.fixo ? (ordemFixos[a.id] ?? 9) - (ordemFixos[b.id] ?? 9) : (a.tipo === "inteligente") - (b.tipo === "inteligente") || a.nome.localeCompare(b.nome, "pt-BR")));
}
export async function album(id) { return (await albuns()).find(a => a.id === id); }
export async function criarAlbum(nome, extra = {}) {
  const a = { id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, nome: nome.trim(), faixas: [], criadoEm: Date.now(), ...extra };
  await BD.salvarAlbum(a); mudou({ albuns: true }); return a;
}
/** Grava uma playlist inteligente (as regras; as músicas são calculadas). */
export async function salvarPlaylist(a) {
  const g = { ...a, faixas: a.tipo === "inteligente" ? [] : a.faixas || [] };
  await BD.salvarAlbum(g); mudou({ albuns: true, album: a.id }); return g;
}
export async function renomearAlbum(id, nome) { const a = (await BD.todosAlbuns()).find(x => x.id === id); if (!a || a.fixo) return; a.nome = nome.trim(); await BD.salvarAlbum(a); mudou({ albuns: true }); }
export async function apagarAlbum(id) { const a = await album(id); if (!a || a.fixo) return; await BD.apagarAlbum(id); mudou({ albuns: true }); }
export async function duplicarAlbum(id) {
  const a = (await BD.todosAlbuns()).find(x => x.id === id); if (!a) return null;
  const { id: _, fixo, ...resto } = a;
  return criarAlbum(`${a.nome} (Cópia)`, { ...JSON.parse(JSON.stringify(resto)), faixas: a.tipo === "inteligente" ? [] : [...(a.faixas || [])] });
}
export async function adicionarAoAlbum(id, ids) {
  if (id === SEU_DIA) return 0;
  if (id === FAVORITAS) { let n = 0; for (const x of ids) { const f = await faixa(x); if (f && !f.fav) { await favoritar(x, true); n++; } } return n; }
  const a = (await BD.todosAlbuns()).find(x => x.id === id); if (!a || a.tipo === "inteligente") return 0;
  const novos = ids.filter(x => !a.faixas.includes(x));
  a.faixas.push(...novos); await BD.salvarAlbum(a); mudou({ albuns: true, album: id }); return novos.length;
}
/** Tira da playlist. Numa inteligente, a música fica em `fora` (não entra mais, mesmo batendo nas regras). */
export async function tirarDoAlbum(id, ids) {
  if (id === SEU_DIA) return;
  if (id === FAVORITAS) { for (const x of ids) await favoritar(x, false); return; }
  const a = (await BD.todosAlbuns()).find(x => x.id === id); if (!a) return;
  if (a.tipo === "inteligente") a.fora = [...new Set([...(a.fora || []), ...ids])];
  else a.faixas = a.faixas.filter(x => !ids.includes(x));
  await BD.salvarAlbum(a); mudou({ albuns: true, album: id });
}
export async function devolverAoAlbum(id, ids = null) {
  const a = (await BD.todosAlbuns()).find(x => x.id === id); if (!a?.fora) return;
  a.fora = ids ? a.fora.filter(x => !ids.includes(x)) : [];
  await BD.salvarAlbum(a); mudou({ albuns: true, album: id });
}
export async function faixasDoAlbum(id) {
  const a = await album(id), m = await faixas();
  return (a?.faixas || []).map(x => m.get(x)).filter(Boolean);
}
/** Calcula uma inteligente que ainda está sendo editada (para mostrar quantas músicas dá). */
export async function previaInteligente(a) {
  const als = await albuns(), todas = await listaFaixas();
  return calcularInteligente(a, todas, { porTitulo, categorias: await mapaCategorias(), playlists: new Map(als.filter(x => x.id !== a.id).map(x => [x.id, new Set(x.faixas)])) });
}

// ---------- tags internas ----------
// De versão (pelos parênteses do título, tagsInternas.js) e de grupo (à mão, gravadas no arquivo). A lista de tags
// de grupo fica em cfg "tagsInternas".grupos (para existir mesmo sem músicas) e também sai das próprias faixas.
async function gravarCfgTags(c) { await BD.gravarCfg("tagsInternas", c); definirVersoes(c.versoes || []); }
export async function tagsInternas() {
  const c = await lerCfgTags(), todas = await listaFaixas();
  const versoes = versoesAtuais().map(v => ({ nome: v.nome, tipo: "versao", fixa: v.fixa, n: todas.filter(f => analisarTitulo(f.titulo).versoes.includes(v.nome)).length }));
  const cont = new Map();
  const achar = (nome) => [...cont.keys()].find(k => normTag(k) === normTag(nome));
  for (const g of c.grupos || []) if (!achar(g)) cont.set(g, 0);
  for (const f of todas) for (const t of f.tags || []) { const k = achar(t) || t; cont.set(k, (cont.get(k) || 0) + 1); }
  const cats = categoriasDe(c);
  const catDe = (nome) => cats.find(x => x.tags.some(t => normTag(t) === normTag(nome)))?.nome || null;
  // pos: a ordem em que foram criadas (para "Mais recentes"; as que só existem nas faixas contam como as mais antigas)
  const posDe = (nome) => (c.grupos || []).findIndex(g => normTag(g) === normTag(nome));
  const grupos = [...cont].map(([nome, n]) => ({ nome, tipo: "grupo", n, categoria: catDe(nome), pos: posDe(nome) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  // na ordem dos grupos (os fixos primeiro, depois os dele na ordem em que foram criados), e as sem grupo no fim
  const categorias = cats.map((x, i) => ({ nome: x.nome, fixa: ehCategoriaFixa(x.nome), icone: x.icone || "", pos: i, tags: grupos.filter(g => g.categoria === x.nome) }));
  const semCategoria = grupos.filter(g => !g.categoria);
  return { versoes, grupos: [...categorias.flatMap(x => x.tags), ...semCategoria], categorias, semCategoria };
}
/** Cria um grupo de tags. Devolve o nome (o que já existia, se for igual). */
export async function criarCategoria(nome) {
  nome = limpo(nome); if (!nome) return null;
  const c = await lerCfgTags(), cats = categoriasDe(c);
  const ja = cats.find(x => normTag(x.nome) === normTag(nome)); if (ja) return ja.nome;
  c.categorias = [...cats, { nome, tags: [] }]; c.apagadas = (c.apagadas || []).filter(x => normTag(x) !== normTag(nome));
  await gravarCfgTags(c); mudou({ tags: true }); return nome;
}
export async function renomearCategoria(velho, novo) {
  novo = limpo(novo); if (!novo || novo === velho) return;
  if (ehCategoriaFixa(velho)) throw new Error(`${velho} é um grupo fixo.`);
  const c = await lerCfgTags(), cats = categoriasDe(c);
  if (cats.some(x => normTag(x.nome) === normTag(novo) && normTag(x.nome) !== normTag(velho))) throw new Error(`Já existe o grupo ${novo}.`);
  const x = cats.find(y => normTag(y.nome) === normTag(velho)); if (!x) return;
  x.nome = novo; c.categorias = cats;
  if (CATEGORIAS_FIXAS.includes(velho)) c.apagadas = [...new Set([...(c.apagadas || []), velho])];
  await gravarCfgTags(c);
  for (const a of await BD.todosAlbuns()) {
    if (a.tipo !== "inteligente") continue;
    let mexeu = false;
    for (const r of [...(a.regras?.incluir || []), ...(a.regras?.excluir || [])]) if (r.campo === "grupoTag" && normTag(r.valor) === normTag(velho)) { r.valor = novo; mexeu = true; }
    if (mexeu) await BD.salvarAlbum(a);
  }
  mudou({ tags: true, albuns: true });
}
/** O ícone do grupo (pedido do Alediov, 02/11/2026): um emoji da grade (vira o ícone 3D do app); "" volta ao padrão.
 *  Fica na cfg "tagsInternas", que também vai para a pasta (.orbita). */
export async function definirIconeCategoria(nome, icone) {
  const c = await lerCfgTags(), cats = categoriasDe(c), x = cats.find(y => normTag(y.nome) === normTag(nome));
  if (!x) return;
  if (icone) x.icone = icone; else delete x.icone;
  c.categorias = cats;
  await gravarCfgTags(c); mudou({ tags: true });
}
/** Apaga o grupo (as tags continuam, sem grupo). */
export async function apagarCategoria(nome) {
  if (ehCategoriaFixa(nome)) throw new Error(`${nome} é um grupo fixo.`);
  const c = await lerCfgTags();
  c.categorias = categoriasDe(c).filter(x => normTag(x.nome) !== normTag(nome));
  if (CATEGORIAS_FIXAS.some(n => normTag(n) === normTag(nome))) c.apagadas = [...new Set([...(c.apagadas || []), nome])];
  await gravarCfgTags(c); mudou({ tags: true });
}
/** Leva tags para um grupo (null tira do grupo). Devolve os grupos dele que ficaram vazios e sumiram. */
export async function moverParaCategoria(nomes, categoria) {
  const c = await lerCfgTags(), cats = categoriasDe(c), ns = new Set(nomes.map(normTag));
  const antes = cats.map(x => ({ nome: x.nome, tags: [...x.tags] }));
  for (const x of cats) x.tags = x.tags.filter(t => !ns.has(normTag(t)));
  const alvo = categoria && cats.find(x => normTag(x.nome) === normTag(categoria));
  if (alvo) alvo.tags.push(...nomes);
  c.categorias = cats;
  // a tag também passa a existir na lista (mesmo sem músicas)
  for (const n of nomes) if (!(c.grupos || []).some(g => normTag(g) === normTag(n))) (c.grupos ||= []).push(n);
  const tirados = semVazias(c, antes);
  await gravarCfgTags(c); mudou({ tags: true, albuns: true });
  return tirados;
}
// ---------- divisão das tags pelo Claude (pedido do Alediov, 04/11/2026) ----------
// "comecei a separar as minhas músicas em categorias, mas muita coisa ficou na categoria Anime… separar pelo material
// original, seja Mangá, Anime, Novel… ver as categorias e as etiquetas em cada uma delas por algum tipo de upload e então
// dividir". O app manda os grupos e as tags (com até 3 músicas de exemplo, para saber de que obra é cada tag) e aplica
// uma divisão { grupos: [{ nome, icone?, tags: [...] }] }: cria os grupos que faltam e leva as tags. Nunca apaga tag nem
// grupo, e não cria tag (nome que não existe fica de fora, na lista "naoAchadas").
export async function exportarTags() {
  const t = await tagsInternas(), todas = await listaFaixas();
  const exemplos = (nome) => todas.filter(f => (f.tags || []).some(x => normTag(x) === normTag(nome))).slice(0, 3).map(f => `${f.artista} – ${f.titulo}`);
  const tag = (g) => ({ nome: g.nome, n: g.n || 0, ex: exemplos(g.nome) });
  return { v: 1, em: new Date().toISOString(), grupos: t.categorias.map(c => ({ nome: c.nome, icone: c.icone || "", fixo: !!c.fixa, tags: c.tags.map(tag) })),
    outras: t.semCategoria.map(tag) };
}
/** O plano (com `aplicar: true`, já aplicado): { novos: [grupo], mover: [[tag, grupo]], icones: [[grupo, emoji]], naoAchadas, ficam }. */
export async function aplicarDivisao(div, { aplicar = false, iconesValidos = null } = {}) {
  if (!div || !Array.isArray(div.grupos)) throw new Error("Não é uma divisão de tags (falta a lista de grupos).");
  const t = await tagsInternas();
  const existe = new Map(t.grupos.map(g => [normTag(g.nome), g]));
  const catAtual = new Map(t.grupos.map(g => [normTag(g.nome), g.categoria || null]));
  const cats = new Map(t.categorias.map(c => [normTag(c.nome), c]));
  const plano = { novos: [], mover: [], icones: [], naoAchadas: [], ficam: 0 };
  const vistas = new Set();
  for (const g of div.grupos) {
    const nome = limpo(g?.nome); if (!nome || normTag(nome) === normTag("Outras") || normTag(nome) === normTag("Versões")) continue;
    const c = cats.get(normTag(nome));
    if (!c && !plano.novos.some(x => normTag(x) === normTag(nome))) plano.novos.push(nome);
    const nomeCat = c?.nome || plano.novos.find(x => normTag(x) === normTag(nome));
    const ic = limpo(g.icone);
    if (ic && (!iconesValidos || iconesValidos.includes(ic)) && ic !== (c?.icone || "")) plano.icones.push([nomeCat, ic]);
    for (const tn of g.tags || []) {
      const nt = normTag(typeof tn === "string" ? tn : tn?.nome);
      if (!nt || vistas.has(nt)) continue;
      vistas.add(nt);
      const tag = existe.get(nt);
      if (!tag) { plano.naoAchadas.push(typeof tn === "string" ? tn : tn?.nome); continue; }
      if (normTag(catAtual.get(nt) || "") === normTag(nomeCat)) { plano.ficam++; continue; }
      plano.mover.push([tag.nome, nomeCat]);
    }
  }
  if (aplicar) {
    for (const n of plano.novos) await criarCategoria(n);
    const porGrupo = new Map();
    for (const [tag, g] of plano.mover) { if (!porGrupo.has(g)) porGrupo.set(g, []); porGrupo.get(g).push(tag); }
    for (const [g, tags] of porGrupo) await moverParaCategoria(tags, g);
    for (const [g, ic] of plano.icones) await definirIconeCategoria(g, ic);
  }
  return plano;
}

/** Mapa grupo → tags (normalizadas), para as playlists inteligentes. */
export async function mapaCategorias() {
  return new Map(categoriasDe(await lerCfgTags()).map(x => [normTag(x.nome), new Set(x.tags.map(normTag))]));
}
/** Cria uma tag (de grupo ou de versão). Devolve o nome (o que já existia, se for igual). */
export async function criarTag(nome, tipo = "grupo", categoria = null) {
  nome = limpo(nome); if (!nome) return null;
  const c = await lerCfgTags(), t = await tagsInternas();
  const ja = [...t.versoes, ...t.grupos].find(x => normTag(x.nome) === normTag(nome));
  if (ja) { if (categoria && tipo === "grupo" && !ja.categoria) await moverParaCategoria([ja.nome], categoria); return ja.nome; }
  if (tipo === "versao") (c.versoes ||= []).push({ nome }); else (c.grupos ||= []).push(nome);
  await gravarCfgTags(c);
  if (categoria && tipo === "grupo") await moverParaCategoria([nome], categoria);
  mudou({ tags: true }); return nome;
}
export async function renomearTag(velho, novo, tipo = "grupo") {
  novo = limpo(novo); if (!novo || novo === velho) return;
  const c = await lerCfgTags();
  if (tipo === "versao") { const v = (c.versoes || []).find(x => normTag(x.nome) === normTag(velho)); if (v) v.nome = novo; await gravarCfgTags(c); mudou({ tags: true }); return; }
  c.grupos = [...new Set([...(c.grupos || []).filter(g => normTag(g) !== normTag(velho)), novo])];
  c.categorias = categoriasDe(c).map(x => ({ ...x, tags: x.tags.map(t => (normTag(t) === normTag(velho) ? novo : t)) }));
  await gravarCfgTags(c);
  const mudadas = [];
  for (const f of (await faixas()).values()) if ((f.tags || []).some(t => normTag(t) === normTag(velho))) {
    f.tags = [...new Set(f.tags.map(t => (normTag(t) === normTag(velho) ? novo : t)))]; mudadas.push(f);
  }
  await renomearNasRegras(velho, novo);
  if (mudadas.length) { await BD.salvarFaixas(mudadas); for (const f of mudadas) await agendarGravacao(f); }
  mudou({ tags: true, biblioteca: true });
}
async function renomearNasRegras(velho, novo) {
  for (const a of await BD.todosAlbuns()) {
    if (a.tipo !== "inteligente") continue;
    let mexeu = false;
    for (const r of [...(a.regras?.incluir || []), ...(a.regras?.excluir || [])]) if (r.campo === "tag" && normTag(r.valor) === normTag(velho)) { r.valor = novo; mexeu = true; }
    if (mexeu) await BD.salvarAlbum(a);
  }
}
export async function apagarTag(nome, tipo = "grupo") {
  const c = await lerCfgTags();
  if (tipo === "versao") { c.versoes = (c.versoes || []).filter(x => normTag(x.nome) !== normTag(nome)); await gravarCfgTags(c); mudou({ tags: true }); return; }
  c.grupos = (c.grupos || []).filter(g => normTag(g) !== normTag(nome));
  const antes = categoriasDe(c);
  c.categorias = antes.map(x => ({ ...x, tags: x.tags.filter(t => normTag(t) !== normTag(nome)) }));
  const tirados = semVazias(c, antes);
  await gravarCfgTags(c);
  const mudadas = [];
  for (const f of (await faixas()).values()) if ((f.tags || []).some(t => normTag(t) === normTag(nome))) { f.tags = f.tags.filter(t => normTag(t) !== normTag(nome)); mudadas.push(f); }
  if (mudadas.length) { await BD.salvarFaixas(mudadas); for (const f of mudadas) await agendarGravacao(f); }
  mudou({ tags: true, biblioteca: true });
  return tirados;
}
/** Troca as tags de grupo de uma faixa (vão para o arquivo também). O que entrou ou saiu vale para as versões dela.
 *  Devolve quantas versões também mudaram. */
export async function definirTags(id, tags) {
  const f = await faixa(id); if (!f) return 0;
  const antes = f.tags || [];
  const vistos = new Set(); f.tags = (tags || []).map(limpo).filter(t => t && !vistos.has(normTag(t)) && vistos.add(normTag(t)));
  await BD.salvarFaixa(f); await agendarGravacao(f);
  const n = await propagarTags(f, antes, f.tags);
  mudou({ tags: true, biblioteca: true });
  return n;
}
/** As tags que entraram em `f` entram nas versões dela; as que saíram, saem. Devolve quantas mudaram. */
async function propagarTags(f, antes, depois) {
  const tem = (l, t) => l.some(x => normTag(x) === normTag(t));
  const poe = depois.filter(t => !tem(antes, t)), tira = antes.filter(t => !tem(depois, t));
  if (!poe.length && !tira.length) return 0;
  const mudadas = [];
  for (const g of await familiaDe(f)) {
    const novas = [...(g.tags || []).filter(t => !tem(tira, t)), ...poe.filter(t => !tem(g.tags || [], t))];
    if (tagsParaArquivo(novas) !== tagsParaArquivo(g.tags || [])) { g.tags = novas; mudadas.push(g); }
  }
  if (mudadas.length) { await BD.salvarFaixas(mudadas); for (const g of mudadas) await agendarGravacao(g); }
  return mudadas.length;
}
/** Põe (ou tira) uma tag de grupo em várias faixas (e nas versões delas). */
export async function marcarTag(ids, nome, ligar = true) {
  ids = await comVersoes(ids);
  const mudadas = [];
  for (const id of ids) {
    const f = await faixa(id); if (!f) continue;
    const tem = (f.tags || []).some(t => normTag(t) === normTag(nome));
    if (ligar && !tem) f.tags = [...(f.tags || []), nome];
    else if (!ligar && tem) f.tags = f.tags.filter(t => normTag(t) !== normTag(nome));
    else continue;
    mudadas.push(f);
  }
  if (mudadas.length) { await BD.salvarFaixas(mudadas); for (const f of mudadas) await agendarGravacao(f); mudou({ tags: true, biblioteca: true }); }
  return mudadas.length;
}
export async function faixasComTag(nome) { return (await listaFaixas()).filter(f => temTag(f, nome)).sort(porTitulo); }

// ---------- famílias: a música e as versões dela ----------
// As tags de grupo são temas (anime, jogo, filme): valem para a música e para TODAS as versões dela (Sped Up, Slowed,
// Instrumental, Live…), pedido do Alediov (24/10/2026). Família = mesmo artista e mesmo título sem as versões (base +
// desambiguação: "Estrondo", "Estrondo (Instrumental)" e "Estrondo (Orchestral)" de Steve); as da pasta das versões
// entram pela ligação (`versaoDe`) ou pelo título sem o artista da desambiguação ("Lua (Steve, Sped Up)" → Lua de Steve).
export async function familias() {
  const pv = norm(await pastaVersoes()), todas = await listaFaixas(), chave = new Map(), porBase = new Map();
  const partes = (t) => { const a = analisarTitulo(t); return { base: norm(a.base), ex: a.extras.map(norm).sort() }; };
  for (const f of todas) {
    if (naPastaVersoes(f, pv)) continue;
    const p = partes(f.titulo);
    chave.set(f.id, `${norm(f.artista)}|${p.base}|${p.ex.join(",")}`);
    if (!porBase.has(p.base)) porBase.set(p.base, []);
    porBase.get(p.base).push(f);
  }
  unirFeats(chave, todas);
  for (const g of todas) {
    if (!naPastaVersoes(g, pv)) continue;
    if (g.versaoDe && chave.has(g.versaoDe) && !naPastaVersoes(cache.get(g.versaoDe) || {}, pv)) { chave.set(g.id, chave.get(g.versaoDe)); continue; }
    const p = partes(g.titulo), ks = new Set();
    for (const o of porBase.get(p.base) || []) {
      const ex = p.ex.filter(x => x !== norm(o.artista));
      if (ex.join(",") === partes(o.titulo).ex.join(",")) ks.add(chave.get(o.id));
    }
    chave.set(g.id, ks.size === 1 ? [...ks][0] : `versoes:${p.base}|${p.ex.join(",")}`);
  }
  unirFeats(chave, todas);
  return chave;
}
/** Feat.: as famílias das músicas ligadas viram uma só (tags de tema, gênero e clima pelo mesmo líder, ano). */
function unirFeats(chave, todas) {
  const pai = new Map(), raiz = (k) => { while (pai.has(k) && pai.get(k) !== k) k = pai.get(k); return k; };
  const porFeat = new Map();
  for (const f of todas) if (f.feat && chave.has(f.id)) { if (!porFeat.has(f.feat)) porFeat.set(f.feat, []); porFeat.get(f.feat).push(chave.get(f.id)); }
  let uniu = false;
  for (const ks of porFeat.values()) {
    if (ks.length < 2) continue;
    const rs = [...new Set(ks.map(raiz))].sort();
    for (const r of rs.slice(1)) { pai.set(r, rs[0]); uniu = true; }
  }
  if (uniu) for (const [id, k] of chave) chave.set(id, raiz(k));
}
/** As outras faixas da família de `f` (sem ela). */
export async function familiaDe(f) {
  const ch = await familias(), k = ch.get(f.id); if (!k) return [];
  const m = await faixas();
  return [...ch].filter(([id, x]) => x === k && id !== f.id).map(([id]) => m.get(id)).filter(Boolean);
}
async function comVersoes(ids) {
  const ch = await familias(), ks = new Set(ids.map(id => ch.get(id)).filter(Boolean));
  return [...new Set([...ids, ...[...ch].filter(([, k]) => ks.has(k)).map(([id]) => id)])];
}
/** Deixa cada família com as mesmas tags (a união): para versões novas e para as que estavam diferentes. */
export async function igualarTagsDasFamilias() {
  const ch = await familias(), m = await faixas(), por = new Map();
  for (const [id, k] of ch) { if (!por.has(k)) por.set(k, []); por.get(k).push(m.get(id)); }
  const mudadas = [];
  for (const l of por.values()) {
    if (l.length < 2) continue;
    const uniao = [];
    for (const f of l) for (const t of f.tags || []) if (!uniao.some(x => normTag(x) === normTag(t))) uniao.push(t);
    if (!uniao.length) continue;
    for (const f of l) {
      const falta = uniao.filter(t => !(f.tags || []).some(x => normTag(x) === normTag(t)));
      if (falta.length) { f.tags = [...(f.tags || []), ...falta]; mudadas.push(f); }
    }
  }
  if (mudadas.length) { await BD.salvarFaixas(mudadas); for (const f of mudadas) await agendarGravacao(f); mudou({ tags: true, biblioteca: true }); }
  return mudadas.length;
}

// ---------- organização ----------
export async function artistas() {
  const por = new Map();
  for (const f of (await faixas()).values()) {
    const k = f.artista || "Sem artista";
    if (!por.has(k)) por.set(k, []);
    por.get(k).push(f);
  }
  return [...por].map(([nome, l]) => ({ nome, faixas: l.sort(porTitulo) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}
// a música antes das variações dela: "Lua (Remake)" antes de "Lua (Remake Acapella)" (titulos.js, compararTitulos)
export const porTitulo = (a, b) => compararTitulos(a.titulo, b.titulo);
export const ORDENS = {
  titulo: { nome: "Título", fn: porTitulo },
  artista: { nome: "Artista", fn: (a, b) => a.artista.localeCompare(b.artista, "pt-BR", { sensitivity: "base" }) || porTitulo(a, b) },
  recentes: { nome: "Recentes", fn: (a, b) => (b.adicionadaEm || 0) - (a.adicionadaEm || 0) || porTitulo(a, b) },
  nota: { nome: "Estrelas", fn: (a, b) => (b.nota || 0) - (a.nota || 0) || porTitulo(a, b) },
  tocadas: { nome: "Mais tocadas", fn: (a, b) => (b.tocadas || 0) - (a.tocadas || 0) || porTitulo(a, b) },
};

// ---------- versões (Sped Up e edições) e desambiguação ----------
// As versões que o Alediov cria ficam numa pasta própria (padrão "Alediov"). O nome é "<Título> (Sped Up)"; se o
// mesmo título existir em outro artista (fora da pasta das versões), entra o artista original: "<Título> (<Artista>,
// Sped Up)". Os parênteses que a música já tem (desambiguação do próprio artista, como "Estrelas (Kuro)", ou versões
// como Instrumental) ficam juntos: "Estrelas (Kuro, Sped Up)". A versão criada guarda `versaoDe` (o id da original).
const norm = (s) => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
export async function pastaVersoes() { return (await BD.lerCfg("pastaVersoes")) || "Alediov"; }
export async function definirPastaVersoes(nome) { await BD.gravarCfg("pastaVersoes", (nome || "").trim() || "Alediov"); mudou({ cfgPasta: true }); }
/** Ajustes do tocador (transição em ms, volume igualado, rádio): ficam no banco, na pasta e no serviço nativo. */
export async function cfgTocador() { return { transicao: 0, igualar: true, radio: false, ...((await BD.lerCfg("tocador")) || {}) }; }
export async function definirTocador(o) {
  const c = { ...(await cfgTocador()), ...o };
  await BD.gravarCfg("tocador", c); mudou({ cfgPasta: true });
  try { await motor.ajustesTocador(c); } catch (e) { console.warn("Músicas: ajustes do tocador", e.message); }
  return c;
}
export async function guardadoNaPasta() { return BD.lerCfg("guardadoNaPasta"); }
export function ehVersao(f) { return analisarTitulo(f?.titulo).versoes.some(v => VERSOES_FEITAS.includes(v)); }
const naPastaVersoes = (g, pv) => norm(g.pasta) === pv || norm(g.artista) === pv;
const semFeitas = (partes) => partes.filter(p => !VERSOES_FEITAS.includes(p));
/** Título sem as versões feitas pelo Alediov (Sped Up, Slowed): "lua|kuro". */
const chaveTitulo = (t) => { const a = analisarTitulo(t); return [norm(a.base), ...semFeitas(a.partes).map(norm)].join("|"); };
/** Igual sem ligar para a ordem dentro dos parênteses. */
const versoesDe = (pv, todas) => todas.filter(g => naPastaVersoes(g, pv));

/** O nome da versão de `f` (tipo "Sped Up", "Slowed"…), já com a desambiguação. */
export async function nomeVersao(f, tipo = "Sped Up") {
  const pv = norm(await pastaVersoes()), todas = await listaFaixas();
  const a = analisarTitulo(f.titulo);
  const ft = new Set(parceirosFeat(f).map(g => g.id));
  const outros = todas.filter(g => !naPastaVersoes(g, pv) && norm(g.artista) !== norm(f.artista) && !ft.has(g.id) && chaveTitulo(g.titulo) === chaveTitulo(f.titulo));
  const partes = semFeitas(a.partes);
  if (outros.length && !partes.some(p => norm(p) === norm(f.artista))) partes.unshift(f.artista);
  partes.push(tipo);
  return { nome: montarTitulo(a.base, partes), ambiguo: outros.length > 0, outros };
}
/** A versão Sped Up de `f`: a faixa, se existe; null se merece e não tem; false se não se aplica. */
export async function versaoSpedUp(f) {
  if (!f || ehVersao(f)) return false;
  const pv = norm(await pastaVersoes());
  if (naPastaVersoes(f, pv)) return false;
  const vs = versoesDe(pv, await listaFaixas()).filter(g => analisarTitulo(g.titulo).versoes.includes("Sped Up"));
  // a versão de uma música em feat. vale para a cópia da outra pasta (é a mesma gravação)
  const donos = new Set([f.id, ...parceirosFeat(f).map(g => g.id)]);
  const ligada = vs.find(g => donos.has(g.versaoDe));
  if (ligada) return ligada;
  const { nome } = await nomeVersao(f);
  return vs.find(g => chaveConjunto(g.titulo) === chaveConjunto(nome) && (!g.versaoDe || donos.has(g.versaoDe))) || null;
}
/** Título ambíguo e uma versão antiga sem o artista ("Lua (Sped Up)" com Lua de Anny e de Steve): de quem é? */
export async function versaoSemDono(f, tipo = "Sped Up") {
  const { ambiguo } = await nomeVersao(f, tipo);
  if (!ambiguo) return null;
  const pv = norm(await pastaVersoes()), a = analisarTitulo(f.titulo);
  const antigo = chaveConjunto(montarTitulo(a.base, [...semFeitas(a.partes), tipo]));
  return versoesDe(pv, await listaFaixas()).find(g => !g.versaoDe && chaveConjunto(g.titulo) === antigo) || null;
}
/** Versões da pasta das versões cujo título bate com músicas de 2 ou mais artistas e não dizem de qual são. */
export async function versoesSemDono() {
  const pv = norm(await pastaVersoes()), todas = await listaFaixas(), out = [];
  const originais = todas.filter(g => !naPastaVersoes(g, pv));
  const porChave = new Map();
  for (const o of originais) { const k = chaveTitulo(o.titulo); if (!porChave.has(k)) porChave.set(k, []); porChave.get(k).push(o); }
  for (const g of versoesDe(pv, todas)) {
    if (g.versaoDe && (await faixa(g.versaoDe))) continue;
    const a = analisarTitulo(g.titulo);
    if (!a.versoes.some(v => VERSOES_FEITAS.includes(v))) continue;
    const cands = porChave.get(chaveTitulo(g.titulo)) || [];
    // as cópias de uma música em feat. são um dono só
    if (new Set(cands.map(o => (parceirosFeat(o).length ? `ft:${o.feat}` : norm(o.artista)))).size >= 2) out.push({ versao: g, candidatos: cands.sort((x, y) => x.artista.localeCompare(y.artista, "pt-BR")) });
  }
  return out;
}
/** Diz de qual música é a versão: renomeia para o nome com o artista ("Lua (Anny, Sped Up)") e liga as duas. */
export async function atribuirVersao(versao, original) {
  const tipo = analisarTitulo(versao.titulo).versoes.find(v => VERSOES_FEITAS.includes(v)) || "Sped Up";
  const { nome } = await nomeVersao(original, tipo);
  let g = versao;
  if (nome !== versao.titulo) g = await salvarTags(versao, { titulo: nome });
  g = await faixa(g.id); if (!g) return null;
  g.versaoDe = original.id; await BD.salvarFaixa(g); await igualarTagsDasFamilias(); mudou({ biblioteca: true });
  return g;
}
/** Liga uma versão recém-criada (pelo caminho do arquivo) à original. */
export async function ligarVersao(caminho, idOriginal) {
  const g = (await listaFaixas()).find(x => x.caminho === caminho);
  if (g) { g.versaoDe = idOriginal; await BD.salvarFaixa(g); await igualarTagsDasFamilias(); }
  return g || null;
}
/**
 * Sped Up das 5 estrelas (pedido do Alediov, 02/11/2026: "ver quais já têm Sped Up e quais não, pelo Alediov"): as
 * originais com 5 estrelas, separadas em { tem: [{ f, v }], faltam: [f], semDono: [{ f, v }] } (v = a versão na pasta
 * das versões; semDono = uma "(Sped Up)" antiga sem o artista num título de dois artistas: ele diz de quem é).
 */
export async function spedUpDasCinco() {
  const tem = [], faltam = [], semDono = [];
  for (const f of (await faixas()).values()) {
    if (f.nota !== 10) continue;
    const v = await versaoSpedUp(f);
    if (v === false) continue;
    if (v) { tem.push({ f, v }); continue; }
    const sd = await versaoSemDono(f);
    if (sd) semDono.push({ f, v: sd }); else faltam.push(f);
  }
  const ord = (a, b) => (a.f || a).artista.localeCompare((b.f || b).artista, "pt-BR") || porTitulo(a.f || a, b.f || b);
  // feat.: uma Sped Up só para as cópias da mesma música (a 1ª, pela ordem)
  const vistos = new Set(), umaPorFeat = (f) => { if (!f.feat || !parceirosFeat(f).length) return true; if (vistos.has(f.feat)) return false; vistos.add(f.feat); return true; };
  return { tem: tem.sort(ord), faltam: faltam.sort(ord).filter(umaPorFeat), semDono: semDono.sort(ord) };
}
/** Músicas com 5 estrelas que ainda não têm a versão Sped Up (as de dono incerto ficam de fora até ele dizer). */
export async function faltamSpedUp() { return (await spedUpDasCinco()).faltam; }
/** O mesmo artista com dois títulos iguais (precisam de desambiguação, como "Estrelas (Kuro)" e "Estrelas (Slow)").
 *  Se as durações batem (diferença de até 1,5 s), é o mesmo áudio: vai para as duplicatas, não para cá. */
export async function titulosRepetidos() {
  const g = new Map();
  for (const f of (await faixas()).values()) { const k = `${norm(f.artista)}|${chaveConjunto(f.titulo)}`; if (!g.has(k)) g.set(k, []); g.get(k).push(f); }
  const dup = new Set((await duplicatas()).flatMap(d => d.faixas.map(f => f.id)));
  return [...g.values()].map(l => l.filter(f => !dup.has(f.id))).filter(l => l.length > 1).map(l => ({ artista: l[0].artista, titulo: l[0].titulo, faixas: l.sort(porTitulo) })).sort((a, b) => a.artista.localeCompare(b.artista, "pt-BR"));
}

// ---------- duplicatas (o mesmo áudio em dois arquivos) ----------
// Mesmo título (base + parênteses) e duração com até 1,5 s de diferença, e o mesmo artista (ou durações quase iguais,
// até 0,25 s, com outro artista). "Não são duplicatas" fica em cfg "naoDuplicatas" (pelos caminhos).
const parChave = (l) => l.map(f => f.caminho).sort().join("|");
export async function duplicatas() {
  const ignorar = new Set((await BD.lerCfg("naoDuplicatas")) || []);
  const antes = new Set((await BD.lerCfg("naoDuplicatasAntes")) || []);
  const porTitulo = new Map();
  for (const f of (await faixas()).values()) { if (!f.duracao) continue; const k = chaveConjunto(f.titulo); if (!porTitulo.has(k)) porTitulo.set(k, []); porTitulo.get(k).push(f); }
  const out = [];
  for (const l of porTitulo.values()) {
    if (l.length < 2) continue;
    const usados = new Set();
    for (const a of l) {
      if (usados.has(a.id)) continue;
      // ligadas como feat. não são duplicatas: de cada feat., só a 1ª entra no cartão (uma cópia a mais dela ainda aparece)
      const feats = new Set();
      const grupo = [a, ...l.filter(b => b.id !== a.id && !usados.has(b.id) && Math.abs(b.duracao - a.duracao) <= (norm(b.artista) === norm(a.artista) ? 1500 : 250))].filter(x => {
        const ft = x.feat && parceirosFeat(x).length ? x.feat : null;
        if (!ft) return true;
        if (feats.has(ft)) { usados.add(x.id); return false; }
        feats.add(ft); return true;
      });
      if (grupo.length < 2 || ignorar.has(parChave(grupo))) continue;
      grupo.forEach(x => usados.add(x.id));
      out.push({ titulo: a.titulo, antes: antes.has(parChave(grupo)), faixas: grupo.sort((x, y) => (y.bitrate || 0) - (x.bitrate || 0) || (y.tamanho || 0) - (x.tamanho || 0)) });
    }
  }
  return out.sort((a, b) => compararTitulos(a.titulo, b.titulo));
}
/** Quantas ele marcou como "Nenhuma" (não são duplicatas). */
export async function quantasNaoDuplicatas() { return ((await BD.lerCfg("naoDuplicatas")) || []).length; }
/** Reavaliar (pedido do Alediov, 04/11/2026: "um botão para reavaliar as duplicatas passadas"; "as duas coisas"): as
 *  marcadas como "Nenhuma" voltam ao cartão das possíveis duplicatas, com a marca `antes` (cfg "naoDuplicatasAntes"),
 *  para ele escolher de novo entre Duplicata, Feat. e Nenhuma. Devolve quantas voltaram. A busca na biblioteca inteira
 *  (sincronizar e `duplicatas`) a tela faz em seguida. */
export async function reavaliarDuplicatas() {
  const l = (await BD.lerCfg("naoDuplicatas")) || [];
  const antes = new Set([...((await BD.lerCfg("naoDuplicatasAntes")) || []), ...l]);
  await BD.gravarCfg("naoDuplicatasAntes", [...antes]);
  await BD.gravarCfg("naoDuplicatas", []);
  mudou({ biblioteca: true, cfgPasta: true });
  return l.length;
}
export async function naoSaoDuplicatas(grupo) {
  const l = (await BD.lerCfg("naoDuplicatas")) || [];
  l.push(parChave(grupo.faixas)); await BD.gravarCfg("naoDuplicatas", [...new Set(l)]); mudou({ biblioteca: true, cfgPasta: true });
}

// ---------- feat. (pedido do Alediov, 02/11/2026) ----------
// "LHz e Novaz fizeram a música Fascinação juntos; eu tenho uma cópia em cada uma das pastas. E eu quero assim." Nas
// possíveis duplicatas, além de Duplicata (ficar com uma) e Nenhuma (não são duplicatas), há Feat.: as cópias ficam
// cada uma na pasta do seu artista, ligadas como a mesma música. Ligadas, as estrelas, o coração e as tags de tema de uma
// passam para as outras na hora (e vão para o arquivo de cada uma pela fila "gravar"); o gênero e o clima são os do
// mesmo líder (as famílias se unem em `familias`), e o ano é o mesmo. As contagens (tocadas, puladas) continuam por
// arquivo. A ligação é o campo `feat` (o mesmo valor nas faixas ligadas), que vai junto ao mudar de nome ou de pasta
// (trocarId, leitura da pasta) e é guardado na pasta (.orbita/biblioteca.json, pelo caminho).
const novoFeat = () => `ft${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
function indiceDosFeats() {
  if (indiceFeat && indiceFeat.de === cache) return indiceFeat.ix;
  const ix = new Map();
  for (const f of cache?.values() || []) if (f.feat) { if (!ix.has(f.feat)) ix.set(f.feat, []); ix.get(f.feat).push(f); }
  for (const [k, l] of ix) if (l.length < 2) ix.delete(k);
  indiceFeat = { de: cache, ix };
  return ix;
}
/** As outras cópias da música em feat. (sem ela); [] se não está ligada. Síncrona (para as linhas das listas). */
export function parceirosFeat(f) {
  if (!f?.feat) return [];
  return (indiceDosFeats().get(f.feat) || []).filter(g => g.id !== f.id);
}
/** Os artistas das outras cópias ("feat. Novaz"), sem repetir e sem o próprio. */
export function artistasFeat(f) {
  const proprio = norm(f?.artista), vistos = new Set(), out = [];
  for (const g of parceirosFeat(f)) { const k = norm(g.artista); if (k !== proprio && !vistos.has(k)) { vistos.add(k); out.push(g.artista); } }
  return out;
}
/** Os grupos ligados: [{ feat, titulo, faixas }], pelo título. */
export async function feats() {
  await faixas();
  return [...indiceDosFeats()].map(([feat, l]) => ({ feat, titulo: l[0].titulo, faixas: l.slice().sort((a, b) => a.artista.localeCompare(b.artista, "pt-BR", { sensitivity: "base" })) }))
    .sort((a, b) => compararTitulos(a.titulo, b.titulo));
}
/** Liga as faixas do cartão como feat. (junta com um feat. que uma delas já tenha) e iguala estrelas, coração, tags e ano. */
export async function ligarFeat(grupo) {
  const m = await faixas(), l = grupo.faixas.map(f => m.get(f.id)).filter(Boolean);
  if (l.length < 2) return null;
  const antigos = new Set(l.map(f => f.feat).filter(Boolean));
  const id = [...antigos][0] || novoFeat();
  const todas = [...new Set([...l, ...[...m.values()].filter(f => f.feat && antigos.has(f.feat))])];
  for (const f of todas) f.feat = id;
  await BD.salvarFaixas(todas);
  indiceFeat = null;
  await igualarFeats();
  // as famílias se uniram: as versões de uma (Sped Up, Instrumental…) também ganham as tags de tema e o ano
  await igualarTagsDasFamilias(); await anoDasVersoes();
  try { await aplicarGeneros(); } catch (e) { console.warn("Músicas: gênero do feat.", e.message); }
  mudou({ biblioteca: true, albuns: true, tags: true });
  return id;
}
/** Desfaz a ligação (as cópias continuam; podem voltar a aparecer nas possíveis duplicatas). */
export async function desfazerFeat(feat) {
  const l = [...(await faixas()).values()].filter(f => f.feat === feat);
  for (const f of l) delete f.feat;
  if (l.length) await BD.salvarFaixas(l);
  mudou({ biblioteca: true, cfgPasta: true });
  return l.length;
}
/**
 * Deixa as cópias de cada feat. iguais: estrelas (a maior), coração (se uma tem), tags de tema (a união), ano (o mais
 * antigo) e, se o avaliador já decidiu, o gênero e o clima do líder. Ao ligar e no fim de cada leitura da pasta.
 */
export async function igualarFeats() {
  await faixas();
  indiceFeat = null; // na leitura da pasta, as faixas que mudaram são objetos novos
  const grupos = [...indiceDosFeats().values()];
  if (!grupos.length) return 0;
  const li = await lideresGenero().catch(() => new Map());
  const notas = new Set(), campos = new Map(), salvar = new Set();
  const poeCampo = (f, k, v) => { campos.set(f, { ...(campos.get(f) || {}), [k]: v }); salvar.add(f); };
  for (const l of grupos) {
    const nota = Math.max(...l.map(f => f.nota || 0)), fav = l.some(f => f.fav);
    const tags = [];
    for (const f of l) for (const t of f.tags || []) if (!tags.some(x => normTag(x) === normTag(t))) tags.push(t);
    const anos = l.map(f => f.ano).filter(a => temAno({ ano: a })).sort();
    const lider = l.find(f => li.get(f.id)?.lider === f.id && f.genero);
    for (const f of l) {
      if ((f.nota || 0) !== nota || !!f.fav !== fav) { f.nota = nota; f.fav = fav; notas.add(f); }
      const falta = tags.filter(t => !(f.tags || []).some(x => normTag(x) === normTag(t)));
      if (falta.length) { f.tags = [...(f.tags || []), ...falta]; notas.add(f); }
      if (anos.length && f.ano !== anos[0]) { f.ano = anos[0]; poeCampo(f, "ano", anos[0]); }
      if (lider && f !== lider && !f.generoManual && f.genero !== lider.genero) { f.genero = lider.genero; f.generoAuto = true; poeCampo(f, "genero", lider.genero); }
      if (lider && f !== lider && lider.clima?.length && (f.clima || []).join() !== lider.clima.join()) { f.clima = lider.clima.slice(); salvar.add(f); }
    }
  }
  const todas = new Set([...notas, ...salvar]);
  if (!todas.size) return 0;
  await BD.salvarFaixas([...todas]);
  for (const f of todas) { if (campos.has(f)) await agendarCampos(f, campos.get(f)); else await agendarGravacao(f); }
  mudou({ biblioteca: true, albuns: true });
  return todas.size;
}
/** Fica com uma: as outras são APAGADAS do cartão; estrelas, coração, tags, contagens e playlists passam para a que fica. */
export async function ficarCom(grupo, idFica) {
  const fica = await faixa(idFica); if (!fica) return null;
  const saem = grupo.faixas.filter(f => f.id !== idFica).map(f => cache.get(f.id)).filter(Boolean);
  for (const o of saem) {
    fica.nota = Math.max(fica.nota || 0, o.nota || 0); fica.fav = fica.fav || o.fav;
    fica.tags = [...new Set([...(fica.tags || []), ...(o.tags || [])])];
    fica.tocadas = (fica.tocadas || 0) + (o.tocadas || 0); fica.puladas = (fica.puladas || 0) + (o.puladas || 0);
    fica.ultimaVez = Math.max(fica.ultimaVez || 0, o.ultimaVez || 0); fica.adicionadaEm = Math.min(fica.adicionadaEm || Date.now(), o.adicionadaEm || Date.now());
    if (o.feat && !fica.feat) fica.feat = o.feat; // a ligação de feat. da cópia apagada fica com esta
  }
  const ids = new Set(saem.map(o => o.id));
  for (const a of await BD.todosAlbuns()) {
    const fs = (a.faixas || []).map(x => (ids.has(x) ? idFica : x)), fora = (a.fora || []).map(x => (ids.has(x) ? idFica : x));
    if (fs.join() !== (a.faixas || []).join() || fora.join() !== (a.fora || []).join()) await BD.salvarAlbum({ ...a, faixas: [...new Set(fs)], fora: [...new Set(fora)] });
  }
  for (const g of cache.values()) if (ids.has(g.versaoDe)) { g.versaoDe = idFica; await BD.salvarFaixa(g); }
  for (const o of saem) { try { await motor.apagarArquivo(o.id); } catch (e) { console.warn("Músicas: apagar duplicata", e.message); } }
  await BD.apagarFaixas([...ids]); ids.forEach(x => cache.delete(x));
  await BD.salvarFaixa(fica); await agendarGravacao(fica);
  mudou({ biblioteca: true, albuns: true });
  return fica;
}

// ---------- par original × versão (para alternar na tela Tocando) ----------
/** A outra versão de `f`: a Sped Up, se `f` é original; a original, se `f` é a versão. null se não há. */
export async function outraVersao(f) {
  if (!f) return null;
  if (ehVersao(f)) {
    if (f.versaoDe) { const o = await faixa(f.versaoDe); if (o) return o; }
    const pv = norm(await pastaVersoes()), a = analisarTitulo(f.titulo), tipo = a.versoes.find(v => VERSOES_FEITAS.includes(v)) || "Sped Up";
    for (const o of await listaFaixas()) {
      if (naPastaVersoes(o, pv) || ehVersao(o) || norm(o.titulo) === norm(f.titulo)) continue;
      if (norm(analisarTitulo(o.titulo).base) !== norm(a.base)) continue;
      if (chaveConjunto((await nomeVersao(o, tipo)).nome) === chaveConjunto(f.titulo)) return o;
    }
    return null;
  }
  const v = await versaoSpedUp(f);
  return v || null;
}

// ---------- versões com defeito (24/10/2026) ----------
// Até a v0.2.6, o plugin lia sempre o PRIMEIRO trecho (2 MB) do arquivo (o getLong do Capacitor devolvia 0 para o
// início): as versões feitas no app de músicas maiores que isso saíram com os ~40 s iniciais repetidos até o fim.
// Elas têm o comentário "… feita no Órbita: …"; as feitas depois da correção dizem "feita no Órbita (editor 2)".
export const MARCA_EDITOR_2 = "feita no Órbita (editor 2)";
const PASSO_LEITURA = 2 << 20;
function contem(bytes, txt) {
  const u8 = new TextEncoder().encode(txt), u16 = new Uint8Array(txt.length * 2);
  for (let i = 0; i < txt.length; i++) { const c = txt.charCodeAt(i); u16[i * 2] = c & 255; u16[i * 2 + 1] = c >> 8; }
  const achar = (p) => { outer: for (let i = 0; i + p.length <= bytes.length; i++) { if (bytes[i] !== p[0]) continue; for (let k = 1; k < p.length; k++) if (bytes[i + k] !== p[k]) continue outer; return true; } return false; };
  return achar(u16) || achar(u8);
}
/** A tag ID3 do começo do arquivo (até 8 MB). */
async function tagDoArquivo(id) {
  const h = await motor.lerInicio(id, 10);
  if (h.length < 10 || h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33) return new Uint8Array(0);
  const tam = ((h[6] & 127) << 21) | ((h[7] & 127) << 14) | ((h[8] & 127) << 7) | (h[9] & 127);
  return motor.lerInicio(id, Math.min(10 + tam, 8 << 20));
}
/** Versões feitas no app antes da correção, de originais maiores que o trecho: [{ faixa, original }]. */
export async function versoesComDefeito() {
  const out = [], refeitas = new Set((await BD.lerCfg("versoesRefeitas")) || []);
  for (const f of await listaFaixas()) {
    if (f.formato !== "mp3" || refeitas.has(f.caminho)) continue;
    if (!analisarTitulo(f.titulo).versoes.some(v => VERSOES_FEITAS.includes(v))) continue;
    let tag;
    try { tag = await tagDoArquivo(f.id); } catch { continue; }
    if (!contem(tag, "feita no Órbita") || contem(tag, MARCA_EDITOR_2)) continue;
    const original = (f.versaoDe && (await faixa(f.versaoDe))) || (await outraVersao(f));
    if (original?.tamanho && original.tamanho <= PASSO_LEITURA) continue;
    out.push({ faixa: f, original: original || null });
  }
  return out.sort((a, b) => porTitulo(a.faixa, b.faixa));
}
/** Depois de refazer: a versão nova fica com as estrelas, coração, tags, contagens e playlists da antiga. */
export async function restaurarVersao(caminho, antiga) {
  await faixas();
  const g = [...cache.values()].find(x => x.caminho === caminho); if (!g) return null;
  for (const k of ["nota", "fav", "tags", "tocadas", "puladas", "ultimaVez", "adicionadaEm", "versaoDe", "feat"]) if (antiga[k] !== undefined) g[k] = antiga[k];
  delete g.loud; delete g.volV;
  if (g.id !== antiga.id) for (const a of await BD.todosAlbuns()) if ((a.faixas || []).includes(antiga.id)) await BD.salvarAlbum({ ...a, faixas: a.faixas.map(x => (x === antiga.id ? g.id : x)) });
  await BD.salvarFaixa(g); await agendarGravacao(g);
  const l = (await BD.lerCfg("versoesRefeitas")) || []; l.push(caminho); await BD.gravarCfg("versoesRefeitas", [...new Set(l)].slice(-500));
  mudou({ biblioteca: true, albuns: true });
  return g;
}

// ---------- artistas conferidos (pedido do Alediov, 25/10/2026) ----------
// Ele gosta de ter TODAS as músicas de cada artista. Cada artista pode estar: sem marca (nunca conferido), completo
// (conferiu e tem tudo; vale 3 meses, depois vira "conferir de novo") ou "não se aplica" (para sempre). Fica em cfg
// "artistasConferidos" { <nome normalizado>: { nome, estado: "completo" | "naoSeAplica", em, deezer, ignorar } },
// também guardada na pasta. A pasta das versões (Alediov) é "não se aplica" sem precisar marcar.
export const MESES_CONFERIDO = 3;
export async function conferidos() { return (await BD.lerCfg("artistasConferidos")) || {}; }
export function venceEm(em) { const d = new Date(em); d.setMonth(d.getMonth() + MESES_CONFERIDO); return +d; }
/** { estado: "nunca" | "completo" | "vencido" | "naoSeAplica", em, vence, resta (0 a 1 do prazo que sobra), auto } */
export function situacaoDe(reg, agora = Date.now()) {
  if (!reg?.estado) return { estado: "nunca" };
  if (reg.estado === "naoSeAplica") return { estado: "naoSeAplica", em: reg.em };
  const vence = venceEm(reg.em);
  return { estado: agora >= vence ? "vencido" : "completo", em: reg.em, vence, resta: Math.max(0, Math.min(1, (vence - agora) / (vence - reg.em))) };
}
/** Situação de cada artista (Map nome normalizado → situação). */
export async function situacoesArtistas() {
  const c = await conferidos(), pv = norm(await pastaVersoes()), out = new Map();
  for (const a of await artistas()) {
    const k = norm(a.nome);
    out.set(k, k === pv && !c[k]?.estado ? { estado: "naoSeAplica", auto: true } : situacaoDe(c[k]));
  }
  return out;
}
export async function situacaoArtista(nome) { return (await situacoesArtistas()).get(norm(nome)) || { estado: "nunca" }; }
/** Marca um artista: "completo" (agora; vale 3 meses), "naoSeAplica" ou null (tira a marca). */
export async function marcarArtista(nome, estado) {
  const c = await conferidos(), k = norm(nome);
  const r = { ...(c[k] || {}), nome };
  if (estado) { r.estado = estado; r.em = Date.now(); } else { delete r.estado; delete r.em; }
  c[k] = r;
  await BD.gravarCfg("artistasConferidos", c); mudou({ cfgPasta: true, artistas: true });
  return situacaoDe(r);
}
// ---------- do celular para o tablet (transferir.js) ----------
export const normArtista = (s) => norm(s);
/** Os estados que vão do celular para o tablet: os artistas com ✓ (mesmo vencido) e os "não se aplica" (a pasta das versões). */
export const ESTADOS_ESPELHO = new Set(["completo", "vencido", "naoSeAplica"]);
/** Depois de receber: as estrelas, a favorita e as tags internas vêm de DENTRO dos arquivos novos ou trocados (a
 *  sincronização mantém as do app para um arquivo que já existia, e aqui quem manda é o celular). */
export async function notasDosArquivos(caminhos) {
  const todas = await faixas(), quero = new Set(caminhos);
  const alvo = [...todas.values()].filter(f => quero.has(f.caminho));
  if (!alvo.length || !motor.lerNotas) return 0;
  const salvar = [];
  for (let i = 0; i < alvo.length; i += 40) {
    const bloco = alvo.slice(i, i + 40), porId = new Map(bloco.map(f => [f.id, f]));
    for (const n of await motor.lerNotas(bloco.map(f => ({ id: f.id, caminho: f.caminho })))) {
      const f = porId.get(n.id); if (!f) continue;
      f.nota = n.nota >= 0 ? n.nota : 0; f.fav = !!n.fav; f.tags = tagsDoArquivo(n.tags);
      salvar.push(f);
    }
  }
  if (salvar.length) { await BD.salvarFaixas(salvar); mudou({ biblioteca: true }); }
  return salvar.length;
}
/** As marcas de "conferido" dos artistas que vieram do celular (as do celular valem). */
export async function adotarConferidos(regs) {
  if (!regs || !Object.keys(regs).length) return;
  const c = await conferidos();
  for (const [k, r] of Object.entries(regs)) c[k] = { ...(c[k] || {}), ...r };
  await BD.gravarCfg("artistasConferidos", c); mudou({ cfgPasta: true, artistas: true });
}
/** O que o app guarda de cada artista para a conferência no Deezer (id escolhido e músicas ignoradas). */
export async function dadosConferencia(nome) { return (await conferidos())[norm(nome)] || { nome }; }
export async function guardarConferencia(nome, o) {
  const c = await conferidos(), k = norm(nome);
  c[k] = { ...(c[k] || {}), nome, ...o };
  await BD.gravarCfg("artistasConferidos", c); mudou({ cfgPasta: true });
}
/** Quando vence cada artista completo (para as notificações). */
export async function vencimentos() {
  return Object.values(await conferidos()).filter(r => r.estado === "completo" && r.em).map(r => venceEm(r.em)).sort((a, b) => a - b);
}
/** A chave de uma música para comparar com a discografia: título sem desambiguação, sem participação e sem
 *  versões feitas (Sped Up, Slowed), mas com as versões de verdade (Live, Acoustic, Instrumental…). */
export function chaveObra(titulo) {
  let t = String(titulo || "").replace(/\s+-\s+[^-]*\b(remaster(ed)?|remasterizad[ao]|edit|version|vers[aã]o|mono|stereo|mix|bonus|deluxe|ao vivo)\b[^-]*$/i, "");
  const a = analisarTitulo(t);
  const base = a.base.replace(/\s(&|e|and|y|et|n)\s/gi, " ").replace(/\s+[([]?(feat\.?|ft\.?|featuring|part\.|com)\s.*$/i, "");
  const vs = a.versoes.filter(v => !VERSOES_FEITAS.includes(v)).map(v => norm(v)).sort();
  const n = norm(base).replace(/[^\p{L}\p{N}]+/gu, "");
  return n + (vs.length ? "|" + vs.join(",") : "");
}
/** As chaves para comparar pela escrita e pelo som (ida e volta do romaji, 26/10/2026): a de `chaveObra`, a do som
 *  ("s:", ルフィ = Luffy = Rufi) e, com `esqueleto` (só as consoantes, ブルーロック = Blue Lock), a "e:" quando tiver
 *  pelo menos 2 consoantes. A biblioteca dele usa o esqueleto só nos títulos em kana; a discografia, sempre. */
export function chavesObra(titulo, { esqueleto: comEsq = false } = {}) {
  const k = chaveObra(titulo); if (!k) return [];
  const [, vs = ""] = k.split("|"), sufixo = vs ? "|" + vs : "";
  const a = analisarTitulo(String(titulo || "").replace(/\s+-\s+[^-]*$/, (m) => /\b(remaster|edit|version|mix|ao vivo)/i.test(m) ? "" : m));
  const base = a.base.replace(/\s+[([]?(feat\.?|ft\.?|featuring|part\.|com)\s.*$/i, "");
  const l = [k];
  const som = chaveSom(base); if (som) l.push(`s:${som}${sufixo}`);
  if (comEsq || temKana(base)) { const e = esqueleto(base); if (e.length >= 2) l.push(`e:${e}${sufixo}`); }
  return l;
}

// ---------- rádio: músicas parecidas com as da fila ----------
/** Até `n` músicas parecidas com as `sementes` (mesmo artista, tags, gênero, estrelas; as esquecidas ganham pontos). */
export async function poolRadio(sementes, n = 60) {
  const todas = await listaFaixas(), ids = new Set(sementes.map(f => f.id));
  const arts = new Map(), tags = new Map(), gens = new Map();
  for (const f of sementes) {
    arts.set(norm(f.artista), (arts.get(norm(f.artista)) || 0) + 1);
    for (const t of f.tags || []) tags.set(normTag(t), (tags.get(normTag(t)) || 0) + 1);
    if (f.genero) gens.set(norm(f.genero), (gens.get(norm(f.genero)) || 0) + 1);
  }
  const k = Math.max(1, sementes.length), comVersao = sementes.some(f => ehVersao(f)), agora = Date.now();
  const ponto = (g) => {
    let p = 0;
    p += 4 * Math.min(1, (arts.get(norm(g.artista)) || 0) / k * 3);
    for (const t of g.tags || []) p += 3 * Math.min(1, (tags.get(normTag(t)) || 0) / k * 3);
    if (g.genero) p += 1.5 * Math.min(1, (gens.get(norm(g.genero)) || 0) / k * 2);
    p += (g.nota || 0) / 4;
    p += Math.min(1.5, (g.ultimaVez ? (agora - g.ultimaVez) / 86400000 : 60) / 30);
    p -= Math.min(2, (g.puladas || 0) / Math.max(1, (g.tocadas || 0) + 1));
    if (ehVersao(g) !== comVersao) p -= 1.5;
    return p + Math.random() * 1.5;
  };
  return todas.filter(g => !ids.has(g.id)).map(g => [g, ponto(g)]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([g]) => g);
}

// ---------- volume igualado: medir aos poucos ----------
let medindo = false;
// VOLUME_V 2 (24/10/2026): no celular, as medidas antigas leram só o primeiro trecho do arquivo, repetido (o bug do
// getLong no plugin); todas são medidas de novo.
const VOLUME_V = 2;
export async function semVolume() { return (await listaFaixas()).filter(f => (f.loud == null || f.volV !== VOLUME_V) && !(f.loudErro && f.volV === VOLUME_V)); }
/** Mede as que faltam, uma por vez. `continuar()` diz se ainda vale seguir (a tela das Músicas aberta). */
export async function medirVolumes(aoProgresso = () => {}, continuar = () => true) {
  if (medindo) return; medindo = true;
  try {
    const { medir } = await import("./volume.js");
    const l = await semVolume();
    for (let i = 0; i < l.length && continuar(); i++) {
      const f = cache.get(l[i].id); if (!f) continue;
      f.volV = VOLUME_V; delete f.loudErro;
      try { Object.assign(f, await medir(f)); } catch (e) { f.loudErro = String(e.message || e).slice(0, 80); }
      await BD.salvarFaixa(f);
      aoProgresso(i + 1, l.length);
      await new Promise(r => setTimeout(r, 300));
    }
    agendarGuardarNaPasta();
  } finally { medindo = false; }
}

// ---------- gêneros e climas pelo som (pedido do Alediov, 25/10/2026; genero.js) ----------
// Cada faixa ouvida guarda: som (as 50 notas do modelo, 1 byte cada), emb (200 números) + embEsc, clima e somV. O grupo
// vai para a tag Gênero do arquivo (fila de gravação); generoManual é o que ele corrigiu. Só o gênero do app vale
// (pedido do Alediov, 02/11/2026): o que vinha no arquivo ou na busca não pesa mais.
// O avaliador só ouve as ORIGINAIS (pedido do Alediov, 02/11/2026): cada versão (Live, Instrumental, Acapella, Sped Up…)
// herda o gênero e o clima da original da família; os tipos marcados "à parte" (padrão: Remake e Acoustic, que podem
// mudar o gênero) formam o seu próprio grupo, ouvido no remake (e as versões dele seguem ele). Numa música, `generoAParte`
// true = ouvida à parte, false = segue a original, ausente = pela regra do tipo.
let analisando = false;
export const A_PARTE_PADRAO = { Remake: true, Acoustic: true };
export async function cfgGeneros() {
  const c = { auto: true, ...((await BD.lerCfg("generos")) || {}) };
  c.aParte = { ...A_PARTE_PADRAO, ...(c.aParte || {}) };
  return c;
}
export async function definirCfgGeneros(o) { const c = { ...(await cfgGeneros()), ...o }; await BD.gravarCfg("generos", c); mudou({ cfgPasta: true }); return c; }
async function moduloGenero() { return import("./genero.js"); }
const tiposVersao = (f) => analisarTitulo(f?.titulo).versoes.filter(v => v !== "Editada");
/**
 * Quem o avaliador ouve e de quem cada música herda: Map id → { lider (id), grupo (a chave do grupo) }. Grupo = a
 * família (`familias`) + os tipos de versão "à parte" do título; o líder é a do grupo com menos tipos de versão, fora da
 * pasta das versões (a original, no grupo sem tipos à parte; o remake, no grupo do Remake).
 */
export async function lideresGenero() {
  const m = await faixas(), ch = await familias(), pv = norm(await pastaVersoes()), { aParte } = await cfgGeneros();
  const grupos = new Map();
  for (const f of m.values()) {
    const tipos = tiposVersao(f), original = !tipos.length && !naPastaVersoes(f, pv);
    const k = f.generoAParte === true && !original ? `#${f.id}` : f.generoAParte === false ? "" : tipos.filter(v => aParte[v]).sort().join("+");
    const g = `${ch.get(f.id) || f.id}\u0001${k}`;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(f);
  }
  const peso = (f) => (naPastaVersoes(f, pv) ? 100 : 0) + tiposVersao(f).length * 10 + (f.som ? 0 : 1);
  const out = new Map();
  for (const [g, l] of grupos) {
    const lider = l.reduce((a, b) => (peso(b) < peso(a) || (peso(b) === peso(a) && porTitulo(b, a) < 0) ? b : a));
    for (const f of l) out.set(f.id, { lider: lider.id, grupo: g });
  }
  return out;
}
/** As que o avaliador ainda vai ouvir: só os líderes (as originais e as "à parte"). */
export async function semGenero() {
  const G = await moduloGenero(), li = await lideresGenero(), m = await faixas();
  return [...m.values()].filter(f => li.get(f.id)?.lider === f.id && f.somV !== G.VERSAO_SOM && !(f.somErro && f.somErroV === G.VERSAO_SOM));
}
/** Ouve as que faltam, uma por vez (`continuar()`: a tela das Músicas ainda aberta; `forcar`: mesmo com o automático desligado). */
export async function analisarGeneros(aoProgresso = () => {}, continuar = () => true, { forcar = false } = {}) {
  if (analisando || !(forcar || (await cfgGeneros()).auto)) return false;
  analisando = true;
  try {
    const G = await moduloGenero(), l = await semGenero();
    let desdeAplicar = 0;
    aoProgresso(0, l.length);
    for (let i = 0; i < l.length && continuar(); i++) {
      const f = cache.get(l[i].id); if (!f) continue;
      try {
        const a = await G.analisar(await motor.lerArquivo(f.id));
        const esc = G.escalaEmb(a.emb);
        Object.assign(f, { som: G.compactar(a.notas, 1), emb: G.compactar(a.emb, esc), embEsc: esc, clima: G.climaDe(a.notas), somV: G.VERSAO_SOM });
        delete f.somErro;
      } catch (e) { f.somErro = String(e.message || e).slice(0, 80); f.somErroV = G.VERSAO_SOM; }
      await BD.salvarFaixa(f);
      aoProgresso(i + 1, l.length);
      if (++desdeAplicar >= 15) { desdeAplicar = 0; await aplicarGeneros({ forcar }); }
      await new Promise(r => setTimeout(r, 250));
    }
    await aplicarGeneros({ forcar });
    return true;
  } finally { analisando = false; }
}
export const analisandoGeneros = () => analisando;
/** "Reavaliar": as escolhidas (ou todos os líderes) voltam para a fila do avaliador (as correções dele ficam). */
export async function reavaliarGeneros(ids = null) {
  const li = await lideresGenero(), m = await faixas(), mudadas = [];
  for (const f of m.values()) {
    if (ids ? !ids.includes(f.id) : li.get(f.id)?.lider !== f.id) continue;
    delete f.somV; delete f.somErro; delete f.somErroV; mudadas.push(f);
  }
  if (mudadas.length) await BD.salvarFaixas(mudadas);
  return mudadas.length;
}
/** Decide o grupo de cada líder (som + correções dele + artista) e passa para o grupo inteiro; grava no arquivo o que mudou. */
export async function aplicarGeneros({ forcar = false } = {}) {
  const G = await moduloGenero(), m = await faixas(), li = await lideresGenero();
  if (!forcar && !(await cfgGeneros()).auto) return 0;
  const ehLider = (f) => li.get(f.id)?.lider === f.id;
  const itens = [...m.values()].filter(f => (f.som && ehLider(f)) || f.generoManual).map(f => ({ id: f.id, artista: f.artista, notas: G.expandir(f.som, 1), emb: G.expandir(f.emb, f.embEsc || 1), manual: f.generoManual || null }));
  const dec = G.decidir(itens);
  // por grupo: a correção dele vale para todas; senão, a decisão do líder
  const porGrupo = new Map();
  for (const [id, d] of dec) {
    const k = li.get(id)?.grupo || id, f = m.get(id), atual = porGrupo.get(k);
    const nota = (d.manual ? 10 : 0) + (ehLider(f) ? 1 : 0) + d.confianca;
    if (!atual || nota > atual.nota) porGrupo.set(k, { ...d, nota });
  }
  const mudadas = new Set();
  for (const f of m.values()) {
    const x = li.get(f.id), k = x?.grupo || f.id, d = porGrupo.get(k); if (!d) continue;
    // o clima também é o do líder
    const lider = m.get(x?.lider);
    if (lider && lider !== f && lider.clima?.length && (f.clima || []).join() !== lider.clima.join()) { f.clima = lider.clima.slice(); mudadas.add(f); }
    f.generoConf = Math.round(d.confianca * 100) / 100;
    if (f.genero !== d.grupo) {
      if (f.generoOriginal === undefined) f.generoOriginal = f.genero || "";
      f.genero = d.grupo; f.generoAuto = !d.manual;
      mudadas.add(f);
      await agendarCampos(f, { genero: f.genero || "" });
    }
  }
  if (mudadas.size) { await BD.salvarFaixas([...mudadas]); mudou({ biblioteca: true }); }
  return mudadas.size;
}
/** As do mesmo grupo de gênero de `f` (ela inclusive). */
async function grupoGeneroDe(f) {
  const li = await lideresGenero(), k = li.get(f.id)?.grupo, m = await faixas();
  return k ? [...li].filter(([, x]) => x.grupo === k).map(([id]) => m.get(id)).filter(Boolean) : [f];
}
/** Ele corrigiu o grupo (null devolve ao automático): vale para o grupo da música (a original e as versões que a
 *  seguem); ensina as parecidas. */
export async function definirGenero(id, grupo) {
  const f = await faixa(id); if (!f) return;
  for (const g of await grupoGeneroDe(f)) { g.generoManual = grupo || null; await BD.salvarFaixa(g); }
  await aplicarGeneros({ forcar: true });
  mudou({ biblioteca: true });
}
/** Numa música: true = avaliar à parte, false = seguir a original, null = pela regra do tipo de versão. */
export async function definirAParte(id, valor) {
  const f = await faixa(id); if (!f) return;
  if (valor == null) delete f.generoAParte; else f.generoAParte = !!valor;
  // ao sair do grupo, a correção herdada não vai junto
  if (valor === true) f.generoManual = null;
  await BD.salvarFaixa(f);
  await aplicarGeneros({ forcar: true });
  mudou({ biblioteca: true, cfgPasta: true });
}
/** De quem a música herda o gênero (null se ela mesma é ouvida). */
export async function liderDe(f) {
  const x = (await lideresGenero()).get(f.id);
  return x && x.lider !== f.id ? (await faixa(x.lider)) || null : null;
}
export async function generosDaBiblioteca() {
  const G = await moduloGenero(), l = await listaFaixas();
  return { grupos: G.GRUPOS.map(g => ({ nome: g, faixas: l.filter(f => f.genero === g).sort(porTitulo) })), climas: G.CLIMAS.map(c => ({ nome: c, faixas: l.filter(f => (f.clima || []).includes(c)).sort(porTitulo) })), outras: l.filter(f => !G.GRUPOS.includes(f.genero)).sort(porTitulo) };
}

// ---------- tags principais faltando (pedido do Alediov, 25/10/2026: todas as músicas com o ano) ----------
// As versões dele (pasta das versões, Sped Up etc.) pegam o ano da original sozinhas (`anoDasVersoes`).
// (o gênero saiu em 02/11/2026: vem só da avaliação do app, não se completa à mão)
export const CAMPOS_PRINCIPAIS = { ano: "Ano", capa: "Capa", artista: "Artista", titulo: "Título" };
const temAno = (f) => /^\d{4}$/.test(f.ano || "");
/** A original de uma versão (pela ligação, pelo nome ou pela família), ou null. */
async function originalDe(f, ch, m, pv) {
  if (f.versaoDe && m.get(f.versaoDe)) return m.get(f.versaoDe);
  const k = ch.get(f.id);
  return [...m.values()].find(g => g.id !== f.id && ch.get(g.id) === k && !ehVersao(g) && !naPastaVersoes(g, pv)) || (await outraVersao(f));
}
/** Põe nas versões dele o ano da original (fila de gravação). Devolve quantas mudaram. */
export async function anoDasVersoes() {
  const m = await faixas(), ch = await familias(), pv = norm(await pastaVersoes()), mudadas = [];
  for (const f of m.values()) {
    if (!naPastaVersoes(f, pv) && !ehVersao(f)) continue;
    const o = await originalDe(f, ch, m, pv);
    if (!o || o.id === f.id || !temAno(o) || f.ano === o.ano) continue;
    f.ano = o.ano; mudadas.push(f); await agendarCampos(f, { ano: o.ano });
  }
  if (mudadas.length) { await BD.salvarFaixas(mudadas); mudou({ biblioteca: true }); }
  return mudadas.length;
}
/**
 * "Arrumar os anos pelas originais" (pedido do Alediov, 26/10/2026: os anos das versões seguem os das originais). Para
 * TODAS as famílias (`familias`: a música e as versões dela, como Live, Remake, Acoustic, Instrumental do mesmo artista,
 * Sped Up, Slowed e as da pasta das versões), o ano de cada versão vira o da original (a que não tem tag de versão e
 * não está na pasta das versões); com mais de uma original, ou nenhuma, ou a original sem ano, vale o ano mais antigo
 * conhecido da família. Só lista: `aplicarAnos` grava o que ele deixou marcado.
 * Devolve [{ f, de, para, original, motivo }], por artista e título.
 */
export async function anosPelasOriginais() {
  const m = await faixas(), ch = await familias(), pv = norm(await pastaVersoes()), por = new Map();
  for (const [id, k] of ch) { const f = m.get(id); if (!f || f.entrada) continue; if (!por.has(k)) por.set(k, []); por.get(k).push(f); }
  const ehOriginal = (f) => !naPastaVersoes(f, pv) && !analisarTitulo(f.titulo).versoes.length;
  const maisAntiga = (l) => l.filter(temAno).sort((a, b) => +a.ano - +b.ano)[0] || null;
  const out = [];
  for (const l of por.values()) {
    if (l.length < 2) continue;
    const orig = l.filter(ehOriginal), vers = l.filter(f => !ehOriginal(f));
    if (!vers.length) continue;
    let fonte, motivo;
    if (orig.length === 1 && temAno(orig[0])) { fonte = orig[0]; motivo = "da original"; }
    else {
      fonte = maisAntiga(orig) || maisAntiga(l);
      motivo = orig.length > 1 ? `o mais antigo das ${orig.length} originais` : orig.length ? "a original está sem ano: o mais antigo da família" : "sem original: o mais antigo da família";
      if (orig.length > 1 && fonte && !orig.includes(fonte)) motivo = "o mais antigo da família";
    }
    if (!fonte) continue;
    for (const f of vers) if (f.ano !== fonte.ano) out.push({ f, de: temAno(f) ? f.ano : "", para: fonte.ano, original: fonte, motivo });
  }
  return out.sort((a, b) => a.f.artista.localeCompare(b.f.artista, "pt-BR") || porTitulo(a.f, b.f));
}
/** Grava os anos escolhidos (fila de gravação, com `campos`: a que está tocando grava quando trocar). Devolve quantas. */
export async function aplicarAnos(lista) {
  const m = await faixas(), mudadas = [];
  for (const x of lista) {
    const f = m.get(x.f.id); if (!f || !/^\d{4}$/.test(x.para) || f.ano === x.para) continue;
    f.ano = x.para; mudadas.push(f); await agendarCampos(f, { ano: x.para });
  }
  if (mudadas.length) { await BD.salvarFaixas(mudadas); mudou({ biblioteca: true }); }
  return mudadas.length;
}
/** As tags principais que faltam numa faixa, na ordem de CAMPOS_PRINCIPAIS (["ano", "genero"], ou [] se está completa).
 *  A mesma regra do cartão "Tags faltando" e da etiqueta na linha da música (pedido do Alediov, 30/10/2026). */
export function faltandoDe(f) {
  const out = [];
  if (!temAno(f)) out.push("ano");
  if (!f.temCapa) out.push("capa");
  if (!f.artista || f.artista === "Sem artista" || f.semTagArtista) out.push("artista");
  if (!f.titulo || f.semTagTitulo) out.push("titulo");
  return out;
}
/** As músicas da biblioteca com tags principais faltando: { ano: [...], capa: [...], … }. */
export async function tagsFaltando() {
  const out = Object.fromEntries(Object.keys(CAMPOS_PRINCIPAIS).map(k => [k, []]));
  for (const f of await listaFaixas()) for (const k of faltandoDe(f)) out[k].push(f);
  for (const k in out) out[k].sort((a, b) => a.artista.localeCompare(b.artista, "pt-BR") || porTitulo(a, b));
  return out;
}
/** Uma vez só (02/11/2026): as músicas sem ano no app releem o ano de dentro do arquivo pelo jaudiotagger (o ano que ele
 *  gravou e o app "perdeu" ao ler a pasta com o leitor do Android volta sem precisar editar de novo). Devolve quantas. */
export async function relerAnosDosArquivos() {
  if (!motor.lerNotas || !motor.nativo || (await BD.lerCfg("anosRelidos"))) return 0;
  const l = [...(await faixas()).values()].filter(f => !temAno(f)), mudadas = [];
  for (let i = 0; i < l.length; i += 25) {
    const b = l.slice(i, i + 25);
    try {
      for (const n of await motor.lerNotas(b.map(f => ({ id: f.id, caminho: f.caminho })))) {
        const f = cache.get(n.id), a = String(n.ano || "").match(/\d{4}/)?.[0];
        if (f && !n.erro && a) { f.ano = a; mudadas.push(f); }
      }
    } catch (e) { console.warn("Músicas: reler os anos", e.message); return 0; }
  }
  if (mudadas.length) { await BD.salvarFaixas(mudadas); await anoDasVersoes(); mudou({ biblioteca: true }); }
  await BD.gravarCfg("anosRelidos", Date.now());
  return mudadas.length;
}
/** Grava o ano (fila de gravação: espera a música que está tocando trocar). */
export async function definirAno(id, ano) {
  const f = await faixa(id); if (!f || !/^\d{4}$/.test(ano)) return;
  f.ano = ano; await BD.salvarFaixa(f); await agendarCampos(f, { ano });
  for (const g of parceirosFeat(f)) if (g.ano !== ano) { g.ano = ano; await BD.salvarFaixa(g); await agendarCampos(g, { ano }); }
  await anoDasVersoes(); mudou({ biblioteca: true });
}

// ---------- rotinas por horário ----------
// cfg "rotinas": [{ id, nome, ini "06:40", fim "07:30", dias [0..6], playlist, aleatorio }]
export async function rotinas() { return (await BD.lerCfg("rotinas")) || []; }
export async function salvarRotinas(l) { await BD.gravarCfg("rotinas", l); mudou({ cfgPasta: true }); }
const minutos = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return (a || 0) * 60 + (b || 0); };
/** A rotina deste momento (dia da semana e faixa de horário), se houver. */
export async function rotinaAgora(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes(), dia = d.getDay();
  return (await rotinas()).find(r => (r.dias || []).includes(dia) && (minutos(r.ini) <= minutos(r.fim) ? m >= minutos(r.ini) && m < minutos(r.fim) : m >= minutos(r.ini) || m < minutos(r.fim))) || null;
}

// ---------- tudo o que não está nos arquivos, guardado na pasta (.orbita/biblioteca.json) ----------
// Pedido do Alediov: apagando os dados do app, as playlists (comuns e inteligentes, com as tiradas à mão), as tags
// criadas, as versões ligadas às originais, os volumes medidos, as rotinas e os ajustes voltam ao ler a pasta.
// Faixas vão pelo caminho dentro da pasta das músicas (o id muda se a pasta for escolhida de novo).
const PASTA_DADOS = ".orbita", ARQ_DADOS = "biblioteca.json";
const CFG_GUARDADAS = ["siglas", "tagsInternas", "rotinas", "pastaVersoes", "camposLigados", "tocador", "naoDuplicatas", "naoDuplicatasAntes", "entradaPasta", "artistasConferidos", "generos"];
let timerGuardar = null;
function agendarGuardarNaPasta() { clearTimeout(timerGuardar); timerGuardar = setTimeout(() => guardarNaPasta().catch(e => console.warn("Músicas: guardar na pasta", e.message)), 4000); }
export async function guardarNaPasta() {
  const p = await pasta(); if (!p || !motor.gravarTexto) return null;
  const m = await faixas(), cam = (id) => m.get(id)?.caminho;
  const albs = (await BD.todosAlbuns()).map(a => ({ ...a, faixas: (a.faixas || []).map(cam).filter(Boolean), fora: (a.fora || []).map(cam).filter(Boolean) }));
  const faixasExtras = {};
  for (const f of m.values()) {
    const x = {};
    if (f.versaoDe && m.get(f.versaoDe)) x.versaoDe = m.get(f.versaoDe).caminho;
    if (f.loud != null) { x.loud = f.loud; x.pico = f.pico; x.ganho = f.ganho; x.volV = f.volV; }
    if (f.perguntouSpedUp) x.perguntouSpedUp = true;
    if (f.feat) x.feat = f.feat; // a ligação de feat. (as faixas de mesmo `feat` são a mesma música)
    if (f.tags?.length) x.tags = f.tags; // reserva (as tags também estão dentro do arquivo)
    for (const k of ["som", "emb", "embEsc", "clima", "somV", "generoManual", "generoOriginal", "generoAParte"]) if (f[k] != null && f[k] !== "") x[k] = f[k];
    if (Object.keys(x).length) faixasExtras[f.caminho] = x;
  }
  const cfg = {}; for (const k of CFG_GUARDADAS) cfg[k] = await BD.lerCfg(k);
  const dados = { formato: 1, app: "Órbita", salvoEm: new Date().toISOString(), playlists: albs, faixas: faixasExtras, cfg };
  await motor.gravarTexto(p.uri, PASTA_DADOS, ARQ_DADOS, JSON.stringify(dados));
  await BD.gravarCfg("guardadoNaPasta", Date.now());
  return dados.salvoEm;
}
export async function restaurarDaPasta() {
  const p = await pasta(); if (!p || !motor.lerTexto) return false;
  const txt = await motor.lerTexto(p.uri, PASTA_DADOS, ARQ_DADOS); if (!txt) return false;
  const d = JSON.parse(txt), m = await faixas(), porCaminho = new Map([...m.values()].map(f => [f.caminho, f]));
  const id = (c) => porCaminho.get(c)?.id;
  for (const a of d.playlists || []) {
    const fs = (a.faixas || []).map(id).filter(Boolean), fora = (a.fora || []).map(id).filter(Boolean);
    await BD.salvarAlbum({ ...a, faixas: a.tipo === "inteligente" ? [] : fs, fora });
  }
  const mudadas = [];
  for (const [c, x] of Object.entries(d.faixas || {})) {
    const f = porCaminho.get(c); if (!f) continue;
    if (x.versaoDe && id(x.versaoDe)) f.versaoDe = id(x.versaoDe);
    if (x.loud != null && f.loud == null && x.volV === VOLUME_V) Object.assign(f, { loud: x.loud, pico: x.pico, ganho: x.ganho, volV: x.volV });
    if (x.perguntouSpedUp) f.perguntouSpedUp = true;
    if (x.feat && !f.feat) f.feat = x.feat;
    if (x.tags?.length && !f.tags?.length) f.tags = x.tags;
    for (const k of ["som", "emb", "embEsc", "clima", "somV", "generoManual", "generoOriginal", "generoAParte"]) if (x[k] != null && f[k] == null) f[k] = x[k];
    mudadas.push(f);
  }
  if (mudadas.length) await BD.salvarFaixas(mudadas);
  for (const [k, v] of Object.entries(d.cfg || {})) if (v != null && (await BD.lerCfg(k)) == null) await BD.gravarCfg(k, v);
  definirVersoes((await lerCfgTags()).versoes || []);
  definirSiglas((await BD.lerCfg("siglas")) || []);
  await BD.gravarCfg("restauradoDaPasta", d.salvoEm || true);
  return true;
}

// ---------- pasta de entrada (músicas baixadas, para editar as tags) e editor de tags ----------
// Pedido do Alediov (24/10/2026): as músicas baixadas vão para uma pasta só delas ("Para Editar", dentro da pasta das
// músicas); depois de editar, o app grava as tags e a capa no arquivo, renomeia para "<Título>.<ext>" e manda para a
// pasta do artista (criando, se faltar).
// Desde 24/10/2026 (pedido do Alediov), a pasta de entrada é ESCOLHIDA (qualquer pasta do cartão SD, como Download):
// cfg "entradaPasta" = { uri, nome }. Sem ela, vale a subpasta antiga "Para Editar" dentro da pasta das músicas.
let ultimaEntrada = null;
const tagsEntrada = new Map(); // id|modificado → tags
export async function pastaEntrada() { return (await pastaEntradaEscolhida())?.nome || (await BD.lerCfg("pastaEntrada")) || "Para Editar"; }
export async function definirPastaEntrada(nome) { await BD.gravarCfg("pastaEntrada", (nome || "").trim() || "Para Editar"); }
export const pastaEntradaEscolhida = () => BD.lerCfg("entradaPasta");
/** "content://…/tree/<id>" → o id do documento da árvore ("1234-5678:Músicas"). */
const idDaArvore = (uri) => { try { return decodeURIComponent((String(uri).match(/\/tree\/([^/]+)/) || [])[1] || ""); } catch { return ""; } };
/** Escolhe a pasta de entrada (não pode ser a própria pasta das músicas). */
export async function escolherPastaEntrada() {
  const e = await motor.escolherPasta(motor.nativo ? undefined : "webE");
  const p = await pasta();
  if (p && (e.uri === p.uri || (idDaArvore(e.uri) && idDaArvore(e.uri) === idDaArvore(p.uri)))) throw new Error("Essa é a pasta das músicas: escolha outra (a de downloads, por exemplo).");
  await BD.gravarCfg("entradaPasta", { uri: e.uri, nome: e.nome });
  ultimaEntrada = null;
  return e;
}
export async function esquecerPastaEntrada() { await BD.gravarCfg("entradaPasta", null); ultimaEntrada = null; }
/** Quais arquivos da pasta das músicas são da entrada (e ficam fora da biblioteca). */
async function filtroEntrada(p) {
  const esc = await pastaEntradaEscolhida();
  if (esc) {
    const raiz = idDaArvore(p?.uri), ent = idDaArvore(esc.uri);
    if (raiz && ent.startsWith(raiz + "/")) { const rel = ent.slice(raiz.length + 1).toLowerCase() + "/"; return (a) => a.caminho.toLowerCase().startsWith(rel); }
    return () => false;
  }
  const nome = ((await BD.lerCfg("pastaEntrada")) || "Para Editar").toLowerCase();
  return (a) => a.caminho.split("/")[0].toLowerCase() === nome;
}
export const CAMPOS_TAG = ["titulo", "artista", "album", "albumArtista", "genero", "ano"];

/** Arquivos da pasta de entrada, com as tags que já têm e o que falta. */
export async function listarEntrada(forcar = false) {
  const p = await pasta(); if (!p) return [];
  const esc = await pastaEntradaEscolhida();
  if (forcar || !ultimaEntrada) {
    if (esc) { try { ultimaEntrada = (await motor.listar(esc.uri)).map(a => ({ ...a, de: esc.uri })); } catch (e) { ultimaEntrada = null; throw new Error(e.message === "sem_permissao" ? "O Android tirou a permissão da pasta de entrada. Escolha de novo." : e.message === "escolha_de_novo" ? "No navegador, escolha a pasta de entrada de novo." : e.message); } }
    else { const naEntrada = await filtroEntrada(p); ultimaEntrada = (await motor.listar(p.uri)).filter(naEntrada); }
  }
  const novos = ultimaEntrada.filter(a => !tagsEntrada.has(a.id + "|" + a.modificado));
  for (let i = 0; i < novos.length; i += 20) {
    const b = novos.slice(i, i + 20);
    for (const t of await motor.lerTags(b.map(a => a.id))) {
      const a = b.find(x => x.id === t.id);
      tagsEntrada.set(a.id + "|" + a.modificado, t);
    }
  }
  return ultimaEntrada.map(a => {
    const t = tagsEntrada.get(a.id + "|" + a.modificado) || {};
    const nome = a.caminho.split("/").pop();
    const it = { id: a.id, caminho: a.caminho, nome, tamanho: a.tamanho, modificado: a.modificado, temCapa: !!t.temCapa, duracao: +t.duracao || 0, entrada: true, de: a.de,
      titulo: limpo(t.titulo), artista: limpo(t.artista), album: limpo(t.album), albumArtista: limpo(t.albumArtista), genero: limpo(t.genero), ano: limpo(t.ano).slice(0, 4) };
    it.faltam = [["titulo", "título"], ["artista", "artista"], ["ano", "ano"]].filter(([k]) => !it[k]).map(([, n]) => n);
    if (!it.temCapa) it.faltam.push("capa");
    if (it.titulo && padronizarTitulo(it.titulo) !== it.titulo) it.faltam.push("padrão do título");
    return it;
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------- pasta de entrada: duplicatas e excluir (pedido do Alediov, 25/10/2026) ----------
// Algumas baixadas já estão na biblioteca (ou estão duas vezes na pasta): dá para excluir direto na aba Edição, sem
// passar pelo editor. Duplicata = mesmo título (sem ligar para a ordem dos parênteses) e o mesmo artista, ou a duração
// quase igual (até 1,5 s).
// sem os sinais de cópia do nome do arquivo: "Música (1).mp3", "Música - Cópia.mp3", "Música (copy).mp3"
const tituloDoItem = (it) => padronizarTitulo(it.titulo || semExt(it.nome || "").replace(/\s*(\((\d{1,2}|c[oó]pia|copy)\)|-\s*c[oó]pia)\s*$/i, "")) || "";
/** Map id do item → { biblioteca: faixa } ou { entrada: outro item } (a 2ª cópia na própria pasta). */
export async function duplicadasNaEntrada(itens) {
  const porChave = new Map();
  for (const f of await listaFaixas()) { const k = chaveConjunto(f.titulo); if (!porChave.has(k)) porChave.set(k, []); porChave.get(k).push(f); }
  const parece = (a, b) => (a.artista && b.artista && norm(a.artista) === norm(b.artista)) || (a.duracao && b.duracao && Math.abs(a.duracao - b.duracao) <= 1500) || (!a.artista && !b.artista && a.entrada && b.entrada);
  const out = new Map(), vistos = [];
  // as com sinal de cópia no nome ("(1)", "Cópia") por último: é nelas que fica a marca de repetida
  const copia = (it) => /(\((\d{1,2}|c[oó]pia|copy)\)|-\s*c[oó]pia)\s*\.[^.]+$/i.test(it.nome || "");
  for (const it of [...itens].sort((a, b) => copia(a) - copia(b))) {
    const k = chaveConjunto(tituloDoItem(it));
    if (!k || k === "|") continue;
    const f = (porChave.get(k) || []).find(g => parece(it, g));
    if (f) { out.set(it.id, { biblioteca: f }); continue; }
    const o = vistos.find(x => x.k === k && parece(it, x.it));
    if (o) out.set(it.id, { entrada: o.it }); else vistos.push({ k, it });
  }
  return out;
}
/** Exclui de vez o arquivo da pasta de entrada. */
export async function apagarDaEntrada(it) {
  await motor.apagarArquivo(it.id);
  if (ultimaEntrada) ultimaEntrada = ultimaEntrada.filter(a => a.id !== it.id);
}

/** Troca o id de uma faixa (o arquivo mudou de nome ou de pasta), levando estrelas, contagens, álbuns e capa. */
async function trocarId(velho, novo, extra = {}) {
  const m = await faixas(), f = m.get(velho);
  if (!f) return null;
  const g = { ...f, ...extra, id: novo };
  indiceFeat = null;
  await BD.apagarFaixas([velho]);
  await BD.salvarFaixa(g);
  m.delete(velho); m.set(novo, g);
  for (const a of await BD.todosAlbuns()) if ((a.faixas || []).includes(velho) || (a.fora || []).includes(velho)) await BD.salvarAlbum({ ...a, faixas: (a.faixas || []).map(x => (x === velho ? novo : x)), fora: (a.fora || []).map(x => (x === velho ? novo : x)) });
  for (const k of ["", "#m"]) if (capasMem.has(velho + k)) { capasMem.set(novo + k, capasMem.get(velho + k)); capasMem.delete(velho + k); }
  if (originais.has(velho)) { originais.set(novo, originais.get(velho)); originais.delete(velho); }
  const ligadas = [...m.values()].filter(x => x.versaoDe === velho);
  for (const x of ligadas) x.versaoDe = novo;
  if (ligadas.length) await BD.salvarFaixas(ligadas);
  const pend = await carregarPendentes();
  if (pend.has(velho)) { pend.set(novo, { ...pend.get(velho), caminho: g.caminho }); pend.delete(velho); await BD.gravarCfg("gravar", Object.fromEntries(pend)); }
  return g;
}

/**
 * Grava as tags (e a capa, se vier: base64; "" tira) no arquivo e o põe no lugar: "<Título>.<ext>" na pasta do
 * artista. Serve para a pasta de entrada (o arquivo entra na biblioteca) e para faixas da biblioteca.
 */
export async function salvarTags(item, campos, capa = undefined, mime = "image/jpeg") {
  if (!motor.gravarTags) throw new Error("Editar tags só funciona no celular.");
  const p = await pasta();
  // o gênero do arquivo é só o do app (pedido do Alediov, 02/11/2026): quem entra pela pasta de entrada chega sem gênero
  // (o avaliador põe depois) e o editor não mexe mais nele
  campos = { ...campos };
  if (item.entrada) campos.genero = ""; else delete campos.genero;
  const mudou_ = {};
  for (const k of CAMPOS_TAG) if (campos[k] !== undefined && (campos[k] || "") !== (item[k] || "")) mudou_[k] = campos[k] || "";
  const tagsNovas = campos.tags !== undefined ? campos.tags : undefined;
  if (tagsNovas !== undefined && tagsParaArquivo(tagsNovas) !== tagsParaArquivo(item.tags || [])) mudou_.tagsInternas = tagsParaArquivo(tagsNovas);
  let gravado = null;
  if (Object.keys(mudou_).length || capa !== undefined) gravado = await motor.gravarTags(item.id, item.caminho, mudou_, capa, mime);
  // um valor antigo na fila de gravação (de quando a música tocava) não pode voltar por cima do que acabou de ser gravado
  const pend = await carregarPendentes(), pg = pend.get(item.id);
  if (pg?.campos) { for (const k of Object.keys(mudou_)) delete pg.campos[k]; if (mudou_.genero !== undefined) delete pg.genero; await BD.gravarCfg("gravar", Object.fromEntries(pend)); }
  const ext = (item.caminho.match(/\.[^.\/]+$/) || [".mp3"])[0].toLowerCase();
  const titulo = campos.titulo ?? item.titulo, artista = campos.artista ?? item.artista;
  const pastaAlvo = nomeArquivo(artista || item.pasta || "Sem artista");
  const nomeAlvo = nomeArquivo(titulo) + ext;
  const atualPasta = item.caminho.split("/").slice(0, -1).join("/"), atualNome = item.caminho.split("/").pop();
  // o tamanho e a data do arquivo depois de gravar: sem eles, a próxima leitura da pasta achava o arquivo "mudado" e
  // relia as tags (e, com o leitor do Android, perdia o ano: bug de 02/11/2026)
  let novo = { id: item.id, caminho: item.caminho, ...(gravado?.tamanho ? { tamanho: gravado.tamanho, modificado: gravado.modificado } : {}) };
  avisoNome = null;
  if (item.entrada || atualPasta.toLowerCase() !== pastaAlvo.toLowerCase() || atualNome !== nomeAlvo) {
    novo = await motor.moverArquivo(p.uri, item.id, pastaAlvo, nomeAlvo, item.de);
    // já havia outro arquivo com esse nome na pasta: o Android (ou o motor) pôs " (2)"; a tela avisa
    const ficou = novo.caminho.split("/").pop();
    if (chaveArquivo(ficou) !== chaveArquivo(nomeAlvo)) avisoNome = { pedido: nomeAlvo, ficou, pasta: pastaAlvo };
  }
  const dados = { ...Object.fromEntries(CAMPOS_TAG.map(k => [k, campos[k] ?? item[k] ?? ""])), caminho: novo.caminho, pasta: novo.caminho.split("/").slice(0, -1).join("/") || pastaAlvo,
    ...(novo.tamanho ? { tamanho: novo.tamanho, modificado: novo.modificado } : {}), ...(capa !== undefined ? { temCapa: !!capa } : {}), ...(tagsNovas !== undefined ? { tags: tagsNovas } : {}) };
  let f;
  if (item.entrada) {
    f = montar({ id: novo.id, caminho: novo.caminho, tamanho: novo.tamanho || item.tamanho, modificado: novo.modificado || Date.now() }, { ...dados, duracao: item.duracao, temCapa: capa !== undefined ? !!capa : item.temCapa, tagsInternas: tagsNovas || [] }, null);
    await BD.salvarFaixa(f); (await faixas()).set(f.id, f);
    if (ultimaEntrada) ultimaEntrada = ultimaEntrada.filter(a => a.id !== item.id);
  } else {
    const antes = (await faixa(item.id))?.tags || [];
    f = novo.id !== item.id ? await trocarId(item.id, novo.id, dados) : Object.assign(await faixa(item.id), dados);
    await BD.salvarFaixa(f);
    if (tagsNovas !== undefined) await propagarTags(f, antes, f.tags || []);
  }
  if (item.entrada) await igualarTagsDasFamilias();
  if (mudou_.ano !== undefined) {
    for (const g of parceirosFeat(f)) if (g.ano !== f.ano && /^\d{4}$/.test(f.ano || "")) { g.ano = f.ano; await BD.salvarFaixa(g); await agendarCampos(g, { ano: f.ano }); }
    await anoDasVersoes();
  }
  if (capa !== undefined) esquecerCapa(f.id);
  if (item.entrada) { f.generoOriginal = ""; f.genero = ""; await BD.salvarFaixa(f); }
  // siglas que ele escreveu em maiúsculas (IDFC, NYC…): o padrão dos títulos passa a mantê-las
  const novas = siglasDoTitulo(titulo);
  if (novas.length) {
    const atuais = (await BD.lerCfg("siglas")) || [], juntas = [...new Set([...atuais, ...novas.map(x => x.toLocaleLowerCase("pt-BR"))])];
    if (juntas.length !== atuais.length) { await BD.gravarCfg("siglas", juntas); definirSiglas(juntas); }
  }
  mudou({ biblioteca: true, albuns: true });
  return f;
}

let avisoNome = null;
/** Depois do salvarTags: { pedido, ficou, pasta } quando o nome pedido já era de outro arquivo da pasta (e limpa). */
export function ultimoAvisoNome() { const a = avisoNome; avisoNome = null; return a; }

// ---------- " (1)" no nome do arquivo sem duplicata (bug relatado pelo Alediov em 02/11/2026) ----------
// No cartão SD, renomear só trocando maiúsculas ("musica.mp3" → "Música.mp3") achava o próprio arquivo e o Android punha
// " (1)" no nome (corrigido em MusicasPlugin.moverArquivo). Aqui: os que ficaram assim, para voltar ao nome certo.
const SUFIXO = /^(.*?) \((\d{1,2})\)(\.[^./]+)$/;
/** [{ f, pasta, nome }]: arquivos "Título (N).ext" cujo título não termina em "(N)" e sem outro "Título.ext" na pasta. */
export async function nomesComNumero() {
  const todas = await listaFaixas(), ocupados = new Set(todas.map(f => norm(f.caminho)));
  const out = [];
  for (const f of todas) {
    const partes = f.caminho.split("/"), nome = partes.pop(), m = nome.match(SUFIXO);
    if (!m || new RegExp(`\\(${m[2]}\\)\\s*$`).test(f.titulo || "")) continue;
    const certo = m[1] + m[3];
    if (ocupados.has(norm([...partes, certo].join("/")))) continue; // tem outro com o nome sem o número: não mexe
    out.push({ f, pasta: partes.join("/"), nome: certo });
  }
  return out.sort((a, b) => a.f.caminho.localeCompare(b.f.caminho, "pt-BR"));
}
/** Tira o " (N)" do nome dos arquivos (pula a que está tocando). Devolve quantos mudaram. */
export async function tirarNumeros(lista, tocando = null) {
  const p = await pasta(); let n = 0;
  for (const x of lista) {
    if (x.f.id === tocando) continue;
    try {
      const r = await motor.moverArquivo(p.uri, x.f.id, x.pasta, x.nome);
      const extra = { caminho: r.caminho, ...(r.tamanho ? { tamanho: r.tamanho, modificado: r.modificado } : {}) };
      if (r.id !== x.f.id) await trocarId(x.f.id, r.id, extra); else { Object.assign(x.f, extra); await BD.salvarFaixa(x.f); }
      n++;
    } catch (e) { console.warn("Músicas: tirar o número do nome", x.f.caminho, e.message); }
  }
  if (n) mudou({ biblioteca: true, albuns: true });
  return n;
}

// ---------- nome do arquivo × título (pedido do Alediov, 09/11/2026: "com frequência os arquivos chegam com (1)") ----------
// Cada arquivo da biblioteca se chama "<Título>.<ext>" (o salvarTags já grava assim). Aqui, os que não: [{ f, pasta,
// nome, motivo: copia | maiusculas | titulo, conflito? }]. `conflito` = outro arquivo da mesma pasta já tem (ou vai
// ter) esse nome, sem diferenciar maiúsculas como o cartão SD: esse fica para ele decidir (não se mexe). Fora as
// faixas sem a tag de título (o título é o próprio nome).
export async function nomesDosArquivos() {
  const todas = (await listaFaixas()).filter(f => !f.entrada);
  const porPasta = new Map();
  for (const f of todas) { const pa = f.caminho.split("/").slice(0, -1).join("/"); if (!porPasta.has(pa)) porPasta.set(pa, new Map()); porPasta.get(pa).set(chaveArquivo(f.caminho.split("/").pop()), f); }
  const out = [];
  for (const f of [...todas].sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"))) {
    if (f.semTagTitulo) continue;
    const r = conferirNome(f.caminho, f.titulo); if (!r) continue;
    const pa = f.caminho.split("/").slice(0, -1).join("/"), nomes = porPasta.get(pa), k = chaveArquivo(r.nome);
    const outro = nomes.get(k);
    const x = { f, pasta: pa, nome: r.nome, motivo: r.motivo };
    if (outro && outro.id !== f.id) x.conflito = outro;
    else { nomes.delete(chaveArquivo(f.caminho.split("/").pop())); nomes.set(k, f); } // o nome passa a ser dele
    out.push(x);
  }
  return out;
}
/** Arruma sozinho (ao ler a pasta, no celular) os nomes que só têm os sinais de cópia ("Lua (1).mp3" → "Lua.mp3"),
 *  sem conflito e fora a que está tocando. Devolve quantos mudaram. */
export async function arrumarNomesSozinho(tocando = null) {
  const l = (await nomesDosArquivos()).filter(x => x.motivo === "copia" && !x.conflito);
  return l.length ? tirarNumeros(l, tocando) : 0;
}

/** Faixas da biblioteca com o título fora do padrão: [{ faixa, novo }]. */
export async function titulosForaDoPadrao() {
  const out = [];
  for (const f of (await faixas()).values()) {
    const novo = padronizarTitulo(f.titulo);
    if (novo && novo !== f.titulo) out.push({ faixa: f, novo });
  }
  return out.sort((a, b) => a.faixa.artista.localeCompare(b.faixa.artista, "pt-BR") || porTitulo(a.faixa, b.faixa));
}
