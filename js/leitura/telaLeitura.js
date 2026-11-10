// Leitura (4ª área do Órbita, pedido do Alediov em 25/10/2026): os livros didáticos num formato confortável de ler,
// com as figuras no lugar, e (depois) as novels. Os livros vêm de `conteudo/<disciplina>/<livro>/leitura/`, gerados por
// tools/leitura/preparar_leitura.py, e ficam guardados no aparelho (banco.js) depois de abertos ou baixados.
//
// Ler uma unidade dos didáticos conta: XP pelo tamanho, se o tempo na unidade for compatível com ter lido (35% do
// tempo estimado, no mínimo 1 min), vale a ofensiva e NÃO conta na meta de lições; no fim, 3 perguntas rápidas da
// própria unidade (das lições já baixadas) dão um bônus.
import { E, salvar, ganhar, registrarDiaEstudado, marcarSujo, hojeISO, somaDias, contar, registrarResposta, metaLeituraDe } from "../estado.js";
import { baixarDoRepo, listarDias, carregarDia, listarRepo, temToken } from "../dados.js";
import { toast, escapar } from "../ui.js";
import { tocar, vibrar } from "../sons.js";
import { embaralhar } from "../exercicios.js";
import * as BD from "./banco.js";
import { arteDaCapa, ceuDaHistoria } from "./capas.js";

export const LIVROS = [
  { chave: "alberts", pasta: "conteudo/biocel/alberts", titulo: "Fundamentos da Biologia Celular", autor: "Bruce Alberts et al.", edicao: "caps. 18 e 19",
    disciplina: "Biologia Celular", prefixo: "a", cores: ["#2F6BFF", "#0E2A6B"] },
];
// novels (pedido do Alediov, 25/10/2026): ele cola os capítulos em inglês; a tarefa da madrugada traduz (~20 por noite)
export const NOVELS = [];
// Histórias do Claude (pedido do Alediov, 26/10/2026): histórias ORIGINAIS escritas para ele pela tarefa da madrugada
// (gerador/HISTORIAS.md) quando ela já conhecer os gostos dele pelas novels lidas aqui. A regra dele: o protagonista
// se chama Dante. Desde 02/11/2026 são DUAS (pedido dele: "uma buscando entreter com base nos meus gostos. E a outra
// buscando ensinar, baseando-se tanto nos meus gostos quanto nos conteúdos"), cada uma com o seu Dante, começo, meio e
// fim planejados em segredo para ~1.000 capítulos. Lidas como as novels (sem XP); o índice pode trazer `titulo`,
// `sinopse`, `fim` e, em cada capítulo, um `resumo` sem spoiler (o "Anteriormente"). Os títulos daqui são provisórios.
export const HISTORIAS = [];
// a extensão planejada (o app só mostra "cerca de"; o plano em si é segredo)
const CAPITULOS_PLANEJADOS = 1000;
// quando começa: 2 novels com 50 capítulos lidos cada, ou quando ele pedir (o mesmo de tools/novel/criterio_historia.py);
// vale para as duas histórias, e o pedido é de cada uma
export const CRITERIO_HISTORIA = { novels: 2, capitulos: 50 };
const livroDe = (id) => LIVROS.find(l => id.startsWith(l.prefixo) && /^\w\d\d-\d\d$/.test(id));
const porChave = (k) => LIVROS.find(l => l.chave === k) || NOVELS.find(n => n.chave === k) || HISTORIAS.find(n => n.chave === k);
// as histórias se leem como as novels (capítulos, sem XP, glossário sem spoiler)
const ehNovel = (livro) => livro?.tipo === "novel" || livro?.tipo === "historia";
const ehHistoria = (livro) => livro?.tipo === "historia";
const tituloDe = (livro) => (ehHistoria(livro) && indices.get(livro.chave)?.titulo) || livro.titulo;

const I = {
  voltar: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  aa: '<svg viewBox="0 0 24 24"><path d="M3 19l5-13 5 13M4.8 14.5h6.4M14 19l3.5-9 3.5 9M15.2 16h4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  baixar: '<svg viewBox="0 0 24 24"><path d="M12 4v11m-5-5l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  relogio: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.7" fill="currentColor"/><path d="M5 17l5-4.5 3.5 3 2.5-2 3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  seta: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fechar: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  copiar: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9V6.5A2.5 2.5 0 0012.5 4h-6A2.5 2.5 0 004 6.5v6A2.5 2.5 0 006.5 15H9" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  fone: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0116 0v3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="5" height="7" rx="2" fill="currentColor"/><rect x="16" y="14" width="5" height="7" rx="2" fill="currentColor"/></svg>',
  toque: '<svg viewBox="0 0 24 24"><path d="M9 11.5V5.8a1.8 1.8 0 013.6 0v4.7l4.1.9a2 2 0 011.5 2.3l-.9 4.6a2.5 2.5 0 01-2.5 2H11a2.5 2.5 0 01-2-1l-3.3-4.4a1.6 1.6 0 012.4-2.1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5.5 6.5a5 5 0 0110.6-1.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pena: '<svg viewBox="0 0 24 24"><path d="M20 4c-6 0-11 4.5-12.5 11.5L6 20m2-4.5h5.5C17 15.5 20 10 20 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  livro: '<svg viewBox="0 0 24 24"><path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zM12 6.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};

const AJ_PADRAO = { tam: 19, alt: 1.7, fonte: "serif", tema: "app", justificar: false, refs: true, termos: true };
function L() {
  const e = E();
  e.leitura ||= {};
  const l = e.leitura;
  l.pos ||= {}; l.lidas ||= {}; l.tempo ||= {}; l.quiz ||= {}; l.dias ||= {};
  l.aj ||= {};
  for (const [k, v] of Object.entries(AJ_PADRAO)) if (!(k in l.aj)) l.aj[k] = v;
  return l;
}

let raiz = null, opts = {}, tela = { tipo: "estante" };
const $ = (s, r = raiz) => r.querySelector(s);

// ---------------------------------------------------------------- dados
const indices = new Map();
async function json(caminho) {
  const ja = await BD.pegar("json", caminho);
  if (ja) return ja;
  const r = await baixarDoRepo(caminho);
  if (!r) throw new Error("Não deu para baixar agora. Confira a internet e o token em Ajustes do Órbita (engrenagem da Home).");
  const d = await r.json();
  await BD.guardar("json", caminho, d).catch(() => {});
  return d;
}
// arquivos pequenos que crescem (definições e glossários): busca de novo uma vez por sessão, senão o guardado
const frescos = new Map();
function jsonFresco(caminho) {
  if (frescos.has(caminho)) return frescos.get(caminho);
  const p = (async () => {
    try { const r = await baixarDoRepo(caminho); if (r) { const d = await r.json(); await BD.guardar("json", caminho, d).catch(() => {}); return d; } } catch { /* sem internet */ }
    return (await BD.pegar("json", caminho)) || null;
  })();
  frescos.set(caminho, p);
  return p;
}
async function indice(livro, { novo = false } = {}) {
  if (indices.has(livro.chave) && !novo) return indices.get(livro.chave);
  const caminho = `${livro.pasta}/leitura/indice.json`;
  let d = null;
  // o índice é pequeno: busca de novo quando dá (o livro pode ter sido refeito), senão usa o guardado
  try {
    const r = await baixarDoRepo(caminho);
    if (r) {
      d = await r.json();
      // livro refeito (revisão nova no índice): as unidades guardadas saem, para baixar de novo
      const velho = await BD.pegar("json", caminho);
      if (velho && (velho.revisao || 0) !== (d.revisao || 0)) {
        const pre = `${livro.pasta}/leitura/`;
        for (const k of await BD.chaves("json")) if (String(k).startsWith(pre) && k !== caminho) await BD.apagar("json", k);
      }
      await BD.guardar("json", caminho, d).catch(() => {});
    }
  } catch { /* sem internet */ }
  if (!d) d = await BD.pegar("json", caminho);
  if (!d) throw new Error(ehHistoria(livro) ? "A história ainda não começou." : livro.traducao || ehNovel(livro) ? "A tradução ainda não começou." : "Este livro ainda não foi baixado. Conecte-se à internet para abrir.");
  d.unidades = d.unidades.filter(u => !u.vazia);
  indices.set(livro.chave, d);
  if (livro.traducao || ehNovel(livro)) contarNovos(livro, d);
  return d;
}
const urls = new Map();
async function urlImg(caminho) {
  if (urls.has(caminho)) return urls.get(caminho);
  let blob = await BD.pegar("img", caminho);
  if (!blob) {
    const r = await baixarDoRepo(caminho);
    if (!r) return null;
    blob = await r.blob();
    await BD.guardar("img", caminho, blob).catch(() => {});
  }
  const u = URL.createObjectURL(blob);
  urls.set(caminho, u);
  return u;
}
const caminhoImg = (livro, src) => `${livro.pasta}/${src}`;

// ---------------------------------------------------------------- abrir / desenhar
export async function abrirTelaLeitura(el, o = {}) {
  raiz = el; opts = o; tela = { tipo: "estante" };
  raiz.innerHTML = `<div class="le">
    <header class="le-topo">
      <button class="le-area" aria-label="Trocar de área"><span class="le-logo">${o.logo || ""}</span><span><b>Leitura</b><small>Voltar à trilha</small></span></button>
    </header>
    <main class="le-tela"></main>
  </div>`;
  $(".le-area").onclick = () => opts.aoTrocarArea?.();
  await desenhar();
}

async function desenhar() {
  const t = $(".le-tela");
  const alvo = document.createElement("div");
  try {
    if (tela.tipo === "livro") await telaLivro(alvo, LIVROS.find(l => l.chave === tela.livro));
    else if (tela.tipo === "stats") await telaStats(alvo);
    else if (tela.tipo === "novel") await telaNovel(alvo, NOVELS.find(l => l.chave === tela.livro));
    else if (tela.tipo === "historia") await telaHistoria(alvo, HISTORIAS.find(l => l.chave === tela.livro));
    else await telaEstante(alvo);
  } catch (e) {
    alvo.innerHTML = `<div class="le-vazio">${I.livro}<p>${escapar(e.message || String(e))}</p></div>`;
  }
  t.replaceChildren(...alvo.childNodes);
  t.scrollTop = 0;
}

function capa(livro, classe = "") {
  if (ehHistoria(livro)) return capaHistoria(livro, classe);
  const [a, b] = livro.cores, { arte, fundo } = arteDaCapa(livro.chave);
  return `<div class="le-capa capa-${livro.chave} ${arte ? "com-arte" : ""} ${classe}" style="--c1:${a};--c2:${b}">${fundo}<i class="le-capa-luz"></i><small>${escapar(livro.disciplina)}</small><b>${escapar(livro.titulo)}</b>${arte}<span>${escapar(livro.autor.split(" ").slice(-1)[0])}</span></div>`;
}

// ---------------------------------------------------------------- baixar na estante (pedido do Alediov, 02/11/2026)
// Cada livro, novel e história da estante tem um botão de baixar (com o andamento num anel) e o selo do que já está no
// aparelho: ✓ verde quando TODAS as unidades (ou capítulos) disponíveis estão guardadas, anel parcial quando só parte.
// Uma unidade conta como guardada quando o JSON está no IndexedDB e, se tem figuras, quando o download as trouxe
// (marcadas em `<pasta>/leitura/.completas`, que some junto quando o livro é refeito: `revisao` nova no índice).
const baixando = new Map(); // chave → { feitos, total, falhas, parar }
const marcaDe = (livro) => `${livro.pasta}/leitura/.completas`;
const ehCapitulos = (livro) => ehNovel(livro);
async function situacaoDl(livro, ind, chaves = null) {
  chaves ||= new Set(await BD.chaves("json"));
  const marca = (await BD.pegar("json", marcaDe(livro))) || {}, pre = `${livro.pasta}/leitura/`;
  let ok = 0, algum = 0;
  for (const u of ind.unidades) {
    const tem = chaves.has(`${pre}${u.id}.json`);
    if (tem) algum++;
    if (tem && (!u.figuras || marca[u.id])) ok++;
  }
  const total = ind.unidades.length;
  return { ok, algum, total, estado: total && ok === total ? "tudo" : algum ? "parte" : "nada" };
}
const ICONE_DL = '<svg viewBox="0 0 24 24"><path d="M12 4.5v10m-4.5-4.5 4.5 4.5 4.5-4.5M6 19.5h12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONE_PAUSA = '<svg viewBox="0 0 24 24"><rect x="7.5" y="7" width="3.2" height="10" rx="1.2" fill="currentColor"/><rect x="13.3" y="7" width="3.2" height="10" rx="1.2" fill="currentColor"/></svg>';
const anelDl = (f) => `<svg class="le-dl-anel" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" pathLength="100"/><circle class="v" cx="20" cy="20" r="17" pathLength="100" stroke-dasharray="${Math.max(0, Math.min(100, f * 100)).toFixed(1)} 100"/></svg>`;
/** Pinta o botão de baixar (o redondo da capa ou o largo da tela do livro) pela situação ou pelo andamento. */
function pintarDl(bt, livro, sit) {
  const st = baixando.get(livro.chave), nome = ehCapitulos(livro) ? "capítulos" : "unidades";
  const largo = bt.classList.contains("le-baixar");
  let estado = sit?.estado || "nada", f = sit && sit.total ? sit.ok / sit.total : 0, rotulo;
  if (st) { estado = "baixando"; f = st.total ? st.feitos / st.total : 0; }
  bt.dataset.estado = estado;
  if (estado === "baixando") rotulo = `Baixando… ${Math.round(f * 100)}% (toque para parar)`;
  else if (estado === "tudo") rotulo = `Tudo baixado: ${sit.total} ${nome} no aparelho, dá para ler sem internet`;
  else if (estado === "parte") rotulo = `Baixado em parte: ${sit.ok} de ${sit.total} ${nome}. Toque para baixar o resto`;
  else rotulo = `Baixar para ler sem internet (${sit?.total || 0} ${nome})`;
  bt.setAttribute("aria-label", rotulo); bt.title = rotulo;
  if (largo) {
    bt.innerHTML = estado === "tudo" ? `${I.check}<span>Tudo baixado: dá para ler sem internet</span>`
      : estado === "baixando" ? `${anelDl(f)}<span>Baixando… ${st.feitos} de ${st.total} · toque para parar</span>`
      : estado === "parte" ? `${anelDl(f)}<span>Baixar o resto (${sit.ok} de ${sit.total} ${nome} no aparelho)</span>`
      : `${I.baixar}<span>Baixar ${ehCapitulos(livro) ? "os capítulos" : "o livro"} para ler sem internet</span>`;
    return;
  }
  bt.innerHTML = estado === "tudo" ? I.check
    : estado === "baixando" ? `${anelDl(f)}<b>${Math.round(f * 100)}</b>`
    : estado === "parte" ? `${anelDl(f)}${ICONE_DL}`
    : ICONE_DL;
}
/** Liga um botão de baixar: pinta pela situação e, no toque, baixa, para ou avisa que está tudo no aparelho. */
function ligarDl(bt, livro, ind, sit) {
  bt.dataset.dl = livro.chave;
  pintarDl(bt, livro, sit);
  bt.addEventListener("click", async (e) => {
    e.stopPropagation(); e.preventDefault();
    const st = baixando.get(livro.chave);
    if (st) { st.parar = true; toast("Download pausado: o que já veio fica guardado."); return; }
    const s0 = await situacaoDl(livro, ind);
    if (s0.estado === "tudo") { toast(`Tudo no aparelho: ${s0.total} ${ehCapitulos(livro) ? "capítulos" : "unidades"}${ehCapitulos(livro) ? "" : " e as figuras"}.`); vibrar(10); return; }
    vibrar(15);
    const fim = await baixarTudo(livro, ind);
    const s1 = await situacaoDl(livro, ind);
    if (fim.parar) return;
    if (s1.estado === "tudo") { toast(`${tituloDe(livro)}: tudo baixado ✓`); tocar("certo"); }
    else toast(`Faltaram ${s1.total - s1.ok} ${ehCapitulos(livro) ? "capítulos" : "unidades"}: tente de novo com internet.`);
  });
}
async function repintarDl(livro, ind) {
  const bts = raiz?.querySelectorAll(`[data-dl="${livro.chave}"]`);
  if (!bts?.length) return;
  const sit = baixando.has(livro.chave) ? null : await situacaoDl(livro, ind);
  bts.forEach(b => pintarDl(b, livro, sit));
}
/** Baixa as unidades (ou capítulos) que faltam, com as figuras, 4 de cada vez. Devolve o andamento final. */
async function baixarTudo(livro, ind) {
  if (baixando.has(livro.chave)) return baixando.get(livro.chave).p;
  const pre = `${livro.pasta}/leitura/`;
  const marca = (await BD.pegar("json", marcaDe(livro))) || {};
  const chaves = new Set(await BD.chaves("json"));
  const fila = ind.unidades.filter(u => !(chaves.has(`${pre}${u.id}.json`) && (!u.figuras || marca[u.id])));
  const st = { feitos: ind.unidades.length - fila.length, total: ind.unidades.length, falhas: 0, parar: false };
  baixando.set(livro.chave, st);
  repintarDl(livro, ind);
  const um = async (u) => {
    const d = await json(`${pre}${u.id}.json`);
    for (const b of d.blocos || []) if (b.src && !(await BD.tem("img", caminhoImg(livro, b.src)))) {
      const r = await baixarDoRepo(caminhoImg(livro, b.src));
      if (!r) throw new Error("figura");
      await BD.guardar("img", caminhoImg(livro, b.src), await r.blob());
    }
    marca[u.id] = 1;
  };
  let i = 0, aSalvar = 0, pintado = 0;
  const trabalhador = async () => {
    while (!st.parar && i < fila.length) {
      const u = fila[i++];
      try { await um(u); } catch { st.falhas++; }
      st.feitos++;
      if (++aSalvar >= 6) { aSalvar = 0; await BD.guardar("json", marcaDe(livro), marca).catch(() => {}); }
      if (Date.now() - pintado > 250) { pintado = Date.now(); repintarDl(livro, ind); }
    }
  };
  st.p = Promise.all(Array.from({ length: 4 }, trabalhador)).then(async () => {
    await BD.guardar("json", marcaDe(livro), marca).catch(() => {});
    baixando.delete(livro.chave);
    await repintarDl(livro, ind);
    return st;
  });
  return st.p;
}
/** O cartão de um livro, novel ou história da estante: a capa com o botão de baixar e o texto embaixo. */
function cartaoEstante(livro, ind, sit, { selo = "", miolo = "", aoAbrir }) {
  const b = document.createElement("div");
  b.className = "le-livro"; b.dataset.chave = livro.chave; b.tabIndex = 0; b.setAttribute("role", "button");
  b.innerHTML = `${selo}<div class="le-livro-capa">${capa(livro)}${ind?.unidades?.length && sit ? `<button class="le-dl" type="button"></button>` : ""}</div>${miolo}`;
  b.onclick = aoAbrir;
  b.onkeydown = (e) => { if (e.target === b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); aoAbrir(); } };
  const dl = b.querySelector(".le-dl");
  if (dl) ligarDl(dl, livro, ind, sit);
  return b;
}

function progressoLivro(ind) {
  const l = L(), us = ind.unidades;
  const lidas = us.filter(u => l.lidas[u.id]).length;
  const min = us.reduce((s, u) => s + (l.lidas[u.id] ? 0 : u.minutos * (1 - (l.pos[u.id]?.f || 0))), 0);
  return { lidas, total: us.length, pct: us.length ? lidas / us.length : 0, restam: Math.round(min) };
}
const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`);

async function telaEstante(t) {
  const l = L();
  cartaoMeta(t);
  await faixaNovidades(t);
  // continuar lendo
  if (l.ultima) {
    const livro = porChave(l.ultima.livro);
    const ind = livro && await indice(livro).catch(() => null);
    const u = ind?.unidades.find(x => x.id === l.ultima.id);
    if (u) {
      const f = l.lidas[u.id] ? 1 : (l.pos[u.id]?.f || 0);
      const c = document.createElement("button"); c.className = "le-continuar";
      c.innerHTML = `${capa(livro, "mini")}<span class="le-cont-tx"><small>Continuar lendo</small><b>${escapar(u.titulo)}</b>
        <span class="le-prog"><i style="width:${Math.round(f * 100)}%"></i></span><em>${l.lidas[u.id] ? "Lida" : `${Math.max(1, Math.round(u.minutos * (1 - f)))} min restantes`} · ${escapar(tituloDe(livro))}</em></span>`;
      if (ehNovel(livro) && l.lidas[u.id]) { const ind2 = ind.unidades, k = ind2.findIndex(x => x.id === u.id); if (ind2[k + 1]) { c.onclick = () => abrirUnidade(livro, ind2[k + 1].id); c.querySelector("small").textContent = "Próximo capítulo"; c.querySelector(".le-cont-tx b").textContent = ind2[k + 1].titulo; } }
      if (!c.onclick) c.onclick = () => abrirUnidade(livro, u.id);
      t.append(c);
    }
  }
  // as unidades da trilha de hoje que têm o livro preparado
  const dia = await carregarDia(hojeISO()).catch(() => null);
  const hoje = [];
  for (const id of dia?.unidades || []) {
    const livro = livroDe(id); if (!livro) continue;
    const ind = await indice(livro).catch(() => null);
    const u = ind?.unidades.find(x => x.id === id);
    if (u) hoje.push({ livro, u });
  }
  if (hoje.length) {
    // as que faltam para a meta: as primeiras ainda não lidas, na ordem da trilha (a disciplina principal primeiro)
    let faltam = Math.max(0, metaUn() - lidasEm(hojeISO()));
    t.insertAdjacentHTML("beforeend", `<h2 class="le-sec">Na trilha de hoje</h2><p class="le-dica le-sec-sub">${faltam ? `Para a meta, ${faltam === 1 ? "falta 1 unidade" : `faltam ${faltam} unidades`}: as marcadas vêm primeiro. As outras são extras.` : "Meta de hoje feita: o resto é extra."}</p>`);
    const box = document.createElement("div"); box.className = "le-lista";
    for (const { livro, u } of hoje) {
      const el = linhaUnidade(livro, u, true);
      if (faltam > 0 && !l.lidas[u.id]) { faltam--; el.classList.add("meta"); el.querySelector(".le-un-tx small")?.insertAdjacentHTML("afterbegin", `<em class="le-para-meta">para a meta</em> `); }
      box.append(el);
    }
    t.append(box);
  }
  t.insertAdjacentHTML("beforeend", `<h2 class="le-sec">Livros didáticos</h2>`);
  const g = document.createElement("div"); g.className = "le-estante";
  const chaves = new Set(await BD.chaves("json"));
  for (const livro of LIVROS) {
    const ind = await indice(livro).catch(() => null);
    const p = ind ? progressoLivro(ind) : null, sit = ind ? await situacaoDl(livro, ind, chaves) : null;
    const nv0 = l.novos?.[livro.chave]?.n;
    g.append(cartaoEstante(livro, ind, sit, {
      selo: nv0 ? `<em class="le-selo-novo">${nv0} ${nv0 === 1 ? "nova" : "novas"}</em>` : "",
      miolo: `<b>${escapar(livro.titulo)}</b><small>${escapar(livro.autor)} · ${escapar(livro.edicao)}</small>
      ${p ? `<span class="le-prog"><i style="width:${Math.round(p.pct * 100)}%"></i></span><small>${p.lidas} de ${p.total} unidades${livro.traducao ? " traduzidas" : ""}</small>` : `<small class="le-off">${livro.traducao ? "A tradução segue a trilha: começa numa das próximas noites" : "Abra com internet para baixar"}</small>`}`,
      aoAbrir: () => { if (!p && livro.traducao) { toast("A tradução deste livro ainda não começou: ela vem pela madrugada, seguindo a trilha."); return; } tela = { tipo: "livro", livro: livro.chave }; desenhar(); },
    }));
  }
  t.append(g);
  if (NOVELS.length) t.insertAdjacentHTML("beforeend", `<h2 class="le-sec">Novels</h2>`);
  const gn = document.createElement("div"); gn.className = "le-estante";
  for (const nv of NOVELS) {
    const ind = await indice(nv).catch(() => null), N = novelEstado(nv);
    const trad = ind?.unidades.length || 0, lidos = ind ? ind.unidades.filter(u => L().lidas[u.id]).length : 0;
    const nv1 = L().novos?.[nv.chave]?.n, sit = ind ? await situacaoDl(nv, ind, chaves) : null;
    gn.append(cartaoEstante(nv, ind, sit, {
      selo: nv1 ? `<em class="le-selo-novo">${nv1} ${nv1 === 1 ? "novo" : "novos"}</em>` : "",
      miolo: `<b>${escapar(nv.titulo)}</b><small>${escapar(nv.autor)} · novel</small>
      <span class="le-prog"><i style="width:${Math.round((lidos / Math.max(1, nv.capitulos)) * 100)}%"></i></span><small>${lidos} lidos · ${trad} traduzidos · ${N.colados.length} colados</small>`,
      aoAbrir: () => { tela = { tipo: "novel", livro: nv.chave }; desenhar(); },
    }));
  }
  t.append(gn);
  if (HISTORIAS.length) t.insertAdjacentHTML("beforeend", `<h2 class="le-sec">Histórias do Claude</h2>`);
  const gh = document.createElement("div"); gh.className = "le-estante";
  for (const h of HISTORIAS) {
    const ind = await indice(h).catch(() => null), us = ind?.unidades || [];
    const lidos = us.filter(u => L().lidas[u.id]).length, nv2 = L().novos?.[h.chave]?.n;
    const sit = us.length ? await situacaoDl(h, ind, chaves) : null;
    gh.append(cartaoEstante(h, ind, sit, {
      selo: nv2 ? `<em class="le-selo-novo">${nv2} ${nv2 === 1 ? "novo" : "novos"}</em>` : "",
      miolo: `<b>${escapar(tituloDe(h))}</b><small>com ${escapar(h.protagonista)} · ${escapar(h.rotulo)}</small>
      ${us.length ? `<span class="le-prog"><i style="width:${Math.round((lidos / us.length) * 100)}%"></i></span><small>${lidos} de ${us.length} ${us.length === 1 ? "capítulo lido" : "capítulos lidos"}${ind.fim ? " · completa" : ""}</small>` : `<small class="le-off">Em breve: começa quando o Claude conhecer seus gostos</small>`}`,
      aoAbrir: () => { tela = { tipo: "historia", livro: h.chave }; desenhar(); },
    }));
  }
  t.append(gh);
}

// ---------------------------------------------------------------- meta e estatísticas de leitura
// (pedidos do Alediov, 25/10/2026) A meta é de UNIDADES por dia (L().metaUn, padrão 2; havia uma de minutos que
// brigava com a lista "Na trilha de hoje"): contam as unidades dos livros didáticos lidas no dia, de qualquer livro,
// com prioridade para as da trilha de hoje. Sequência de dias com a meta, a semana, o ritmo e as previsões continuam;
// os minutos de leitura ativa (tique) ficam só como estatística.
const ehUnidade = (id) => /^[a-z]\d\d-\d\d$/.test(id);
// no dia corrido (tamanhoDia.js), 1 unidade basta para a meta (e para a sequência)
const metaUn = (d = hojeISO()) => metaLeituraDe(d, L().metaUn || 2);
const minDe = (d) => Math.round((L().dias[d] || 0) / 60);
const porDia = () => { const m = new Map(); for (const [id, d] of Object.entries(L().lidas)) if (ehUnidade(id)) m.set(d, (m.get(d) || 0) + 1); return m; };
const lidasEm = (d) => porDia().get(d) || 0;
function sequenciaMeta() {
  const pd = porDia(), meta = metaUn();
  let d = hojeISO(), n = 0;
  if ((pd.get(d) || 0) < meta) d = somaDias(d, -1);
  while ((pd.get(d) || 0) >= metaUn(d)) { n++; d = somaDias(d, -1); }
  return n;
}
function semana() { const pd = porDia(); const out = []; for (let i = 6; i >= 0; i--) { const d = somaDias(hojeISO(), -i); out.push({ d, v: pd.get(d) || 0 }); } return out; }
const SEM = ["D", "S", "T", "Q", "Q", "S", "S"];
function barras(dias, meta) {
  const mx = Math.max(meta, ...dias.map(x => x.v), 1);
  return `<div class="le-barras">${dias.map(x => `<span class="${x.v >= meta ? "ok" : ""} ${x.d === hojeISO() ? "hoje" : ""}" title="${x.v} ${x.v === 1 ? "unidade" : "unidades"}"><i style="height:${Math.max(4, Math.round((x.v / mx) * 100))}%"></i><small>${SEM[new Date(x.d + "T12:00:00").getDay()]}</small></span>`).join("")}<b class="le-barras-meta" style="bottom:${Math.round((meta / mx) * 100)}%"></b></div>`;
}
function cartaoMeta(t) {
  const hoje = lidasEm(hojeISO()), meta = metaUn(), f = Math.min(1, hoje / meta), seq = sequenciaMeta();
  const c = document.createElement("button"); c.className = `le-meta ${f >= 1 ? "feita" : ""}`;
  c.innerHTML = `<i class="le-meta-anel" style="--f:${f}"><b>${hoje}/${meta}</b><small>unid.</small></i>
    <span class="le-meta-tx"><small>Meta de leitura</small><b>${f >= 1 ? "Feita hoje!" : `${hoje} de ${meta} ${meta === 1 ? "unidade" : "unidades"} hoje`}</b><em>${seq ? `🔥 ${seq} ${seq === 1 ? "dia" : "dias"} seguidos` : "Leia hoje para começar a sequência"}${minDe(hojeISO()) ? ` · ${minDe(hojeISO())} min` : ""}</em></span>
    ${barras(semana(), meta)}`;
  c.onclick = () => { tela = { tipo: "stats" }; desenhar(); };
  t.append(c);
}
async function telaStats(t) {
  const l = L(), meta = metaUn(), hoje = hojeISO(), pd = porDia();
  const cab = document.createElement("div"); cab.className = "le-cab";
  cab.innerHTML = `<button class="le-voltar">${I.voltar}<span>Estante</span></button><h2 class="le-st-tit">Sua leitura</h2>`;
  cab.querySelector(".le-voltar").onclick = () => { tela = { tipo: "estante" }; desenhar(); };
  t.append(cab);
  // meta
  const m = document.createElement("div"); m.className = "le-st-card";
  m.innerHTML = `<h3>Meta por dia</h3><div class="le-seg le-st-metas">${[1, 2, 3, 4].map(v => `<button data-v="${v}" class="${v === (l.metaUn || 2) ? "on" : ""}">${v} ${v === 1 ? "unidade" : "unidades"}</button>`).join("")}</div>
    <p class="le-dica">Vale qualquer unidade dos livros didáticos; as da trilha de hoje vêm primeiro na estante.${meta !== (l.metaUn || 2) ? ` Hoje é um dia corrido: ${meta} basta.` : ""}</p>${barras(semana(), meta)}`;
  m.querySelectorAll("[data-v]").forEach(b => (b.onclick = () => { l.metaUn = +b.dataset.v; salvar(); desenhar(); }));
  t.append(m);
  // números
  const mes = hoje.slice(0, 7), dias = Object.entries(l.dias);
  const minMes = Math.round(dias.filter(([d]) => d.startsWith(mes)).reduce((s, [, v]) => s + v, 0) / 60);
  const minTotal = Math.round(dias.reduce((s, [, v]) => s + v, 0) / 60);
  const diasMeta = [...pd].filter(([d, v]) => String(d).startsWith(mes) && v >= meta).length;
  const lidasMes = Object.values(l.lidas).filter(d => String(d).startsWith(mes)).length;
  let recorde = 0; { let run = 0, ant = null; for (const [d, v] of [...pd].sort()) { if (v >= meta) { run = ant && somaDias(ant, 1) === d ? run + 1 : 1; ant = d; recorde = Math.max(recorde, run); } } }
  // ritmo: o estimado das unidades lidas (com tempo) ÷ o tempo que levou
  const todas = [];
  for (const lv of [...LIVROS, ...NOVELS]) { const ind = await indice(lv).catch(() => null); if (ind) todas.push([lv, ind]); }
  const minutosDe = new Map(todas.flatMap(([, ind]) => ind.unidades.map(u => [u.id, u.minutos])));
  let est = 0, real = 0;
  for (const id of Object.keys(l.lidas)) if (minutosDe.has(id) && l.tempo[id] > 30) { est += minutosDe.get(id); real += l.tempo[id] / 60; }
  const ritmo = real > 5 ? est / real : null;
  const ult14 = Array.from({ length: 14 }, (_, i) => minDe(somaDias(hoje, -i))).reduce((a, b) => a + b, 0) / 14;
  t.insertAdjacentHTML("beforeend", `<div class="le-st-grade">
    <div><small>Neste mês</small><b>${horas(minMes)}</b><span>${diasMeta} ${diasMeta === 1 ? "dia" : "dias"} com a meta</span></div>
    <div><small>Sequência</small><b>${sequenciaMeta()} ${sequenciaMeta() === 1 ? "dia" : "dias"}</b><span>recorde: ${recorde}</span></div>
    <div><small>Unidades e capítulos</small><b>${lidasMes}</b><span>lidos neste mês</span></div>
    <div><small>Ritmo</small><b>${ritmo ? (ritmo >= 1 ? `${ritmo.toFixed(1).replace(".", ",")}×` : `${Math.round(100 / ritmo)}%`) : "—"}</b><span>${ritmo ? (ritmo >= 1 ? "mais rápido que o tempo estimado" : "do tempo estimado, em média") : "aparece depois de algumas unidades"}</span></div>
    <div><small>Média (14 dias)</small><b>${Math.round(ult14)} min</b><span>por dia</span></div>
    <div><small>No total</small><b>${horas(minTotal)}</b><span>${l.termosVistos ? `${l.termosVistos} termos consultados` : "de leitura ativa"}</span></div></div>`);
  // calendário das últimas 12 semanas
  const cal = document.createElement("div"); cal.className = "le-st-card";
  let ini = somaDias(hoje, -83); while (new Date(ini + "T12:00:00").getDay() !== 0) ini = somaDias(ini, -1);
  const cel = []; for (let d = ini; d <= hoje; d = somaDias(d, 1)) { const v = pd.get(d) || 0, mn = minDe(d); cel.push(`<i class="n${v >= meta * 2 ? 4 : v >= meta ? 3 : v ? 2 : mn ? 1 : 0}" title="${d}: ${v} ${v === 1 ? "unidade" : "unidades"}, ${mn} min"></i>`); }
  cal.innerHTML = `<h3>Últimas 12 semanas</h3><div class="le-cal">${cel.join("")}</div>`;
  t.append(cal);
  // previsões
  const prev = [];
  const ritmoDia = Math.max(ult14, 0);
  for (const [lv, ind] of todas) {
    if (lv.tipo === "novel") {
      const caps14 = ind.unidades.filter(u => l.lidas[u.id] && l.lidas[u.id] >= somaDias(hoje, -13)).length / 14;
      const lidos = ind.unidades.filter(u => l.lidas[u.id]).length, faltaTrad = ind.unidades.length - lidos;
      if (!lidos) continue;
      prev.push(`<div class="le-prev">${capa(lv, "mini")}<span><b>${escapar(lv.titulo)}</b><small>${caps14 > 0 ? `${caps14.toFixed(1).replace(".", ",")} capítulos por dia: alcança o último traduzido em ~${Math.ceil(faltaTrad / caps14)} dias e termina os ${lv.capitulos} em ~${Math.ceil((lv.capitulos - lidos) / caps14)} dias` : "Sem capítulos nas últimas 2 semanas"}</small></span></div>`);
      continue;
    }
    const p = progressoLivro(ind);
    if (!p.lidas || p.lidas === p.total) continue;
    const dias2 = ritmoDia > 0 ? Math.ceil(p.restam / ((ritmo || 1) * ritmoDia)) : null;
    prev.push(`<div class="le-prev">${capa(lv, "mini")}<span><b>${escapar(lv.titulo)}</b><small>${p.lidas} de ${p.total} unidades${lv.traducao ? " traduzidas" : ""} · ${dias2 ? `no seu ritmo, termina em ~${dias2} dias (${new Date(somaDias(hoje, dias2) + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })})` : `${horas(p.restam)} pela frente`}</small></span></div>`);
  }
  if (prev.length) t.insertAdjacentHTML("beforeend", `<h2 class="le-sec">Previsões</h2><div class="le-st-card">${prev.join("")}</div>`);
}

// ---------------------------------------------------------------- novidades (capítulos e unidades traduzidos)
// Aviso de capítulos novos traduzidos (pedido do Alediov, 25/10/2026): o índice de cada novel e de cada livro traduzido
// é comparado com o que ele já viu (L().vistos[chave]); o que cresceu vira um aviso no alto da estante, um selo no livro
// e, se o app não está na Leitura, uma notificação (verificarNovidades, chamado pelo areas.js ao abrir e ao voltar).
function contarNovos(livro, ind) {
  const l = L(); l.vistos ||= {}; l.novos ||= {};
  const n = ind.unidades.length, antes = l.vistos[livro.chave];
  if (antes == null) { l.vistos[livro.chave] = n; return 0; }
  if (n > antes) { l.novos[livro.chave] = { n: (l.novos[livro.chave]?.n || 0) + (n - antes), desde: ind.unidades[antes]?.id || null }; l.vistos[livro.chave] = n; salvar(); return n - antes; }
  if (n < antes) l.vistos[livro.chave] = n;
  return 0;
}
async function faixaNovidades(t) {
  const l = L(), nov = Object.entries(l.novos || {}).filter(([, v]) => v?.n > 0);
  if (!nov.length) return;
  for (const [k, v] of nov) {
    const lv = porChave(k); if (!lv) continue;
    const c = document.createElement("div"); c.className = "le-novos";
    c.innerHTML = `${capa(lv, "mini")}<span><small>${ehHistoria(lv) ? "Sua história" : "Tradução nova"}</small><b>${v.n} ${ehNovel(lv) ? (v.n === 1 ? "capítulo novo" : "capítulos novos") : (v.n === 1 ? "unidade nova" : "unidades novas")}</b><em>${escapar(tituloDe(lv))}</em></span><button class="botao mini">Ler</button><button class="le-novos-x" aria-label="Dispensar">${I.fechar}</button>`;
    c.querySelector(".botao").onclick = async () => {
      delete l.novos[k]; salvar();
      const ind = await indice(lv).catch(() => null);
      const u = v.desde && ind?.unidades.find(x => x.id === v.desde) || ind?.unidades.find(x => !l.lidas[x.id]);
      if (ehNovel(lv)) { const prox = ind?.unidades.find(x => !l.lidas[x.id]); if (prox) return abrirUnidade(lv, prox.id); }
      if (u) abrirUnidade(lv, u.id); else { tela = { tipo: ehHistoria(lv) ? "historia" : ehNovel(lv) ? "novel" : "livro", livro: k }; desenhar(); }
    };
    c.querySelector(".le-novos-x").onclick = () => { delete l.novos[k]; salvar(); c.remove(); };
    t.append(c);
  }
}
/** Confere os índices das novels e dos livros traduzidos; devolve [{ livro, n }] do que chegou de novo. */
export async function verificarNovidades({ notificar = true } = {}) {
  const novos = [];
  for (const lv of [...NOVELS, ...HISTORIAS, ...LIVROS.filter(x => x.traducao)]) {
    try { const ind = await indice(lv, { novo: true }); const n = contarNovos(lv, ind); if (n > 0) novos.push({ livro: lv, n }); } catch { /* sem tradução ainda */ }
  }
  if (novos.length && notificar) {
    const txt = novos.map(x => `${x.n} ${ehNovel(x.livro) ? (x.n === 1 ? "capítulo" : "capítulos") : (x.n === 1 ? "unidade" : "unidades")} de ${tituloDe(x.livro)}`).join(" e ");
    const { avisarAgora } = await import("../notificacoes.js");
    const soHistoria = novos.every(x => ehHistoria(x.livro));
    avisarAgora({ id: 975, title: soHistoria ? "Capítulo novo da sua história 📖" : "Tradução nova na Leitura 📖", body: `Chegou: ${txt}.`, extra: { area: "leitura" } });
  }
  return novos;
}

// ---------------------------------------------------------------- novels
function novelEstado(nv) { const l = L(); l.novels ||= {}; const n = l.novels[nv.chave] ||= {}; n.colados ||= []; return n; }

async function telaNovel(t, nv) {
  const ind = await indice(nv).catch(() => null), N = novelEstado(nv), l = L();
  const us = ind?.unidades || [], lidos = us.filter(u => l.lidas[u.id]).length;
  const trad = new Set(us.map(u => u.capitulo));
  const esperando = N.colados.filter(n => !trad.has(n)).sort((a, b) => a - b);
  const cab = document.createElement("div"); cab.className = "le-cab"; cab.dataset.novel = nv.chave;
  cab.innerHTML = `<button class="le-voltar">${I.voltar}<span>Estante</span></button>
    <div class="le-cab-linha">${capa(nv, "media")}<div><h2>${escapar(nv.titulo)}</h2><p>${escapar(nv.autor)} · ${nv.capitulos} capítulos</p>
    <span class="le-prog"><i style="width:${Math.round((lidos / nv.capitulos) * 100)}%"></i></span>
    <p class="le-dica">${lidos} lidos · ${us.length} traduzidos · ${esperando.length} esperando a tradução da madrugada</p></div></div>
    <div class="le-nv-botoes"><button class="le-baixar le-colar">${I.livro}<span>Colar capítulos em inglês</span></button><button class="le-baixar le-glossario">${I.aa}<span>Glossário</span></button></div>
    <button class="le-fav">${I.toque}<span><b>Copiar do site com um toque</b><small>Um favorito no Chrome copia o capítulo aberto, sem menus nem anúncios</small></span>${I.seta}</button>`;
  cab.querySelector(".le-voltar").onclick = () => { tela = { tipo: "estante" }; desenhar(); };
  cab.querySelector(".le-colar").onclick = () => folhaColar(nv);
  cab.querySelector(".le-fav").onclick = () => folhaFavorito();
  cab.querySelector(".le-glossario").onclick = () => verGlossario(nv);
  t.append(cab);
  if (esperando.length) t.insertAdjacentHTML("beforeend", `<p class="le-dica le-nv-esp">Esperando tradução: ${faixas(esperando)}. A tarefa da madrugada traduz uns 20 por noite, sempre os próximos que você vai ler.</p>`);
  if (!us.length) t.insertAdjacentHTML("beforeend", `<div class="le-vazio">${I.livro}<p>Cole os capítulos em inglês (um ou vários de uma vez): de madrugada eles voltam em português.</p></div>`);
  else blocosDeCapitulos(t, nv, us);
  if (temToken()) conferirEnviados(nv);
}

// Capítulos que chegaram ao repositório sem passar pelo "Colar" do app (pedido do Alediov, 02/11/2026: a extensão
// "Órbita · Capítulos", tools/novel/extensao/, envia do notebook direto para `<pasta>/en/NNNN.md`): ao abrir a novel,
// lista `en/` pela API e junta os números a `N.colados`, para o "esperando a tradução" valer. Uma vez a cada 10 min
// por novel (abrir e voltar não repete); sem internet ou sem token, fica o que já se sabia.
const enviadosVistos = new Map(); // chave → quando listou
async function conferirEnviados(nv) {
  const visto = enviadosVistos.get(nv.chave);
  if (visto && Date.now() - visto < 10 * 60e3) return;
  enviadosVistos.set(nv.chave, Date.now());
  let lista;
  try { lista = await listarRepo(`${nv.pasta}/en`); } catch { enviadosVistos.delete(nv.chave); return; }
  await juntarEnviados(nv.chave, lista);
}
/** Junta aos colados os números dos arquivos `NNNN.md` de `en/` ([{ name }]); redesenha a novel aberta se mudou. */
export async function juntarEnviados(chave, lista) {
  const nv = NOVELS.find(n => n.chave === chave);
  if (!nv) return 0;
  const N = novelEstado(nv), ja = new Set(N.colados);
  const novos = [...new Set((lista || []).map(x => /^(\d{1,5})\.md$/.exec(x?.name || "")?.[1]).filter(Boolean).map(Number))].filter(n => n > 0 && !ja.has(n));
  if (!novos.length) return 0;
  N.colados.push(...novos); N.colados.sort((a, b) => a - b); salvar();
  if (tela.tipo === "novel" && tela.livro === chave && raiz?.querySelector(`.le-cab[data-novel="${chave}"]`)) {
    const t = $(".le-tela"), y = t.scrollTop;
    await desenhar();
    t.scrollTop = y;
  }
  return novos.length;
}
/** Capítulos de 50 em 50, abrindo o bloco onde ele está (novels e histórias). */
function blocosDeCapitulos(t, nv, us) {
  const l = L(), atual = us.find(u => !l.lidas[u.id]) || us.at(-1);
  for (let ini = 0; ini < us.length; ini += 50) {
    const bloco = us.slice(ini, ini + 50), lid = bloco.filter(u => l.lidas[u.id]).length;
    const d = document.createElement("details"); d.className = "le-cap"; d.open = bloco.includes(atual);
    d.innerHTML = `<summary><span class="le-cap-n">${bloco[0].capitulo}</span><span class="le-cap-tx"><b>Capítulos ${bloco[0].capitulo} a ${bloco.at(-1).capitulo}</b><small>${lid} de ${bloco.length} lidos</small></span><i class="le-cap-anel" style="--f:${lid / bloco.length}"></i></summary>`;
    const box = document.createElement("div"); box.className = "le-lista";
    for (const u of bloco) box.append(linhaUnidade(nv, u));
    d.append(box); t.append(d);
  }
}
const faixas = (ns) => { const out = []; for (let i = 0; i < ns.length; i++) { let j = i; while (ns[j + 1] === ns[j] + 1) j++; out.push(i === j ? `${ns[i]}` : `${ns[i]}–${ns[j]}`); i = j; } return out.join(", "); };

// ---------------------------------------------------------------- Histórias do Claude
// Estado (sincroniza; a tarefa da madrugada lê em progresso/sincronia/estado.json → estado.leitura.historias):
// { pedidoEm: "AAAA-MM-DD" (pediu para começar já), recados: "o que ele quer ou não quer ver",
//   reacoes: { "<id>": "adorei" | "bom" | "naocurti" } } (texto, não número: a junção somaria números)
function historiaEstado(h) { const l = L(); l.historias ||= {}; const x = l.historias[h.chave] ||= {}; x.reacoes ||= {}; return x; }
const lidosDaNovel = (nv) => Object.keys(L().lidas).filter(id => id.startsWith(`${nv.chave}-`)).length;

function capaHistoria(h, classe = "") {
  const [a, b] = h.cores, ind = indices.get(h.chave), vazia = !ind?.unidades?.length;
  // o céu de cada história em volta do "D": estrelas, lua e órbita (entreter) ou cruzes, batimento e lupa (ensinar)
  return `<div class="le-capa historia emb-${h.emblema || "lua"} ${vazia ? "vazia" : ""} ${classe}" style="--c1:${a};--c2:${b}"><i class="le-capa-luz"></i>
    <svg class="le-hist-ceu" viewBox="0 0 100 150" aria-hidden="true">${ceuDaHistoria(h.emblema)}</svg>
    <small>${escapar(h.disciplina)}</small><i class="le-hist-d">${escapar((h.protagonista || "D")[0])}</i>
    <b>${escapar(tituloDe(h))}</b>${vazia ? `<em class="le-hist-fita">em breve</em>` : ""}<span>por Claude</span></div>`;
}

async function telaHistoria(t, h) {
  const ind = await indice(h).catch(() => null), H = historiaEstado(h), l = L();
  const us = ind?.unidades || [], lidos = us.filter(u => l.lidas[u.id]).length;
  const cab = document.createElement("div"); cab.className = "le-cab";
  cab.innerHTML = `<button class="le-voltar">${I.voltar}<span>Estante</span></button>
    <div class="le-cab-linha">${capa(h, "media")}<div><h2>${escapar(tituloDe(h))}</h2><p>${escapar(h.proposito)} · protagonista: ${escapar(h.protagonista)}</p>
    ${ind?.sinopse ? `<p class="le-hist-sinopse">${escapar(ind.sinopse)}</p>` : ""}
    ${us.length ? `<span class="le-prog"><i style="width:${Math.round((lidos / us.length) * 100)}%"></i></span><p class="le-dica">${lidos} de ${us.length} ${us.length === 1 ? "capítulo lido" : "capítulos lidos"} · ${ind.fim ? "história completa" : `capítulos novos chegam de madrugada; a história terá cerca de ${CAPITULOS_PLANEJADOS.toLocaleString("pt-BR")}`}</p>` : ""}</div></div>
    ${us.length ? `<div class="le-nv-botoes"><button class="le-baixar le-glossario">${I.aa}<span>Glossário (sem spoiler)</span></button><button class="le-baixar le-hist-dl"></button></div>` : ""}`;
  cab.querySelector(".le-voltar").onclick = () => { tela = { tipo: "estante" }; desenhar(); };
  cab.querySelector(".le-glossario")?.addEventListener("click", () => verGlossario(h));
  const dl = cab.querySelector(".le-hist-dl");
  if (dl) ligarDl(dl, h, ind, await situacaoDl(h, ind));
  t.append(cab);
  if (!us.length) emBreveHistoria(t, h, H);
  else { anteriormente(t, us); blocosDeCapitulos(t, h, us); }
  // recados: o que ele quer (ou não) na história; a tarefa lê antes de escrever
  const r = document.createElement("div"); r.className = "le-st-card le-hist-recados";
  r.innerHTML = `<h3>${I.pena}Recados para a história</h3><p class="le-dica">Opcional: o que você gostaria (ou não) de ver, como gênero, tom, um tipo de personagem, um clichê que você ama ou odeia. O Claude lê antes de escrever cada capítulo.</p>
    <textarea maxlength="1500" rows="3" placeholder="Ex.: mais humor, nada de harém, gosto de sistemas com janelas…"></textarea><small class="le-dica le-hist-salvo"></small>`;
  const ta = r.querySelector("textarea"), ok = r.querySelector(".le-hist-salvo");
  ta.value = H.recados || "";
  let tm = null;
  ta.oninput = () => { H.recados = ta.value.trim(); clearTimeout(tm); tm = setTimeout(() => { salvar(); ok.textContent = "Guardado: vai junto na sincronização."; }, 700); };
  t.append(r);
}

// "Anteriormente": o resumo sem spoiler (`resumo` no índice) dos capítulos que ele JÁ leu, do mais recente para trás
function anteriormente(t, us) {
  const l = L(), lidos = us.filter(u => l.lidas[u.id] && u.resumo);
  if (!lidos.length) return;
  const ult = lidos.slice(-12).reverse();
  const d = document.createElement("details"); d.className = "le-st-card le-hist-antes";
  d.innerHTML = `<summary><b>Anteriormente</b><small>até o capítulo ${lidos.at(-1).capitulo}, sem nada do que vem depois</small></summary>
    ${ult.map(u => `<p><b>Cap. ${u.capitulo}</b> ${escapar(u.resumo)}</p>`).join("")}${lidos.length > ult.length ? `<p class="le-dica">Os ${lidos.length - ult.length} anteriores estão nos próprios capítulos.</p>` : ""}`;
  t.append(d);
}

function emBreveHistoria(t, h, H) {
  const C = CRITERIO_HISTORIA;
  const linhas = NOVELS.map(nv => ({ nv, n: lidosDaNovel(nv) }));
  const prontas = linhas.filter(x => x.n >= C.capitulos).length;
  for (let k = linhas.length; k < C.novels; k++) linhas.push({ nv: null, n: 0 });
  const c = document.createElement("div"); c.className = "le-hist-breve";
  const texto = h.ensina
    ? `<p>Uma segunda história <b>original</b>, também com um <b>${escapar(h.protagonista)}</b> (outro Dante, outra vida), que <b>ensina enquanto entretém</b>: pacientes chegam com uma queixa, e a investigação passa pelas hipóteses, pelos diferenciais, pelos exames e pela conduta, com o que você estuda (Anestesiologia, Patologia, Farmacologia, Estomatologia, Periodontia…), sempre conferido pelos livros.</p>`
    : `<p>O Claude vai escrever uma história <b>original</b> só para você, para entreter, com o <b>${escapar(h.protagonista)}</b> como protagonista. Antes, ele quer conhecer o que você gosta de ler: os gêneros, o humor, o ritmo, os mal-entendidos, o que faz você ler "só mais um capítulo".</p>`;
  c.innerHTML = `<div class="le-hist-breve-cab"><i class="le-hist-icone">${h.ensina ? I.livro : I.pena}</i><div><small>Em breve</small><h3>${h.ensina ? "Uma história que ensina" : "Uma história escrita para você"}</h3></div></div>
    ${texto}
    <p>Terá começo, meio e fim, em cerca de <b>${CAPITULOS_PLANEJADOS.toLocaleString("pt-BR")} capítulos</b>. O plano fica guardado em segredo: nada de spoiler.</p>
    <p>${h.ensina ? "Ela começa junto com a outra" : "Ela começa"}: quando você tiver lido <b>${C.capitulos} capítulos de ${C.novels} novels</b> aqui na Leitura (ou antes, se você pedir). Depois, os capítulos chegam de madrugada, como as traduções.</p>
    <div class="le-hist-prog">${linhas.map(({ nv, n }) => nv
      ? `<div class="le-hist-pl ${n >= C.capitulos ? "ok" : ""}">${capa(nv, "mini")}<span><b>${escapar(nv.titulo)}</b><span class="le-prog"><i style="width:${Math.min(100, Math.round((n / C.capitulos) * 100))}%"></i></span><small>${Math.min(n, C.capitulos)} de ${C.capitulos} capítulos${n >= C.capitulos ? " · pronta" : ""}</small></span></div>`
      : `<div class="le-hist-pl vaga"><i class="le-hist-vaga">${I.livro}</i><span><b>Outra novel</b><small>Quando você colar os capítulos de uma 2ª novel, ela entra aqui</small></span></div>`).join("")}</div>
    <p class="le-dica le-hist-conta">${prontas} de ${C.novels} novels prontas</p>
    <div class="le-hist-pedido"></div>`;
  const ped = c.querySelector(".le-hist-pedido");
  const pintar = () => {
    if (H.pedidoEm) {
      ped.innerHTML = `<p class="le-hist-ok">${I.check}<span>Pedido feito em ${new Date(H.pedidoEm + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}: começa numa das próximas madrugadas, com o que você já leu.</span></p><button class="le-link">Cancelar o pedido</button>`;
      ped.querySelector("button").onclick = () => { delete H.pedidoEm; salvar(); pintar(); };
    } else {
      ped.innerHTML = `<button class="botao le-hist-ir">Quero que comece já</button>`;
      ped.querySelector("button").onclick = () => { H.pedidoEm = hojeISO(); salvar(); vibrar(20); toast("Pedido anotado: vai na próxima sincronização."); pintar(); };
    }
  };
  pintar();
  t.append(c);
}

// reação no fim de cada capítulo da história: entra no "perfil de gosto" da tarefa
const REACOES = [["adorei", "Adorei"], ["bom", "Bom"], ["naocurti", "Não curti"]];
const reacaoHTML = (h, id) => { const v = historiaEstado(h).reacoes[id]; return `<div class="le-reacao"><small>O que achou deste capítulo?</small><div class="le-seg">${REACOES.map(([k, n]) => `<button data-r="${k}" class="${v === k ? "on" : ""}">${n}</button>`).join("")}</div></div>`; };
function ligarReacao(el, h, id) {
  el.querySelectorAll(".le-reacao [data-r]").forEach(b => (b.onclick = () => {
    const H = historiaEstado(h);
    if (H.reacoes[id] === b.dataset.r) delete H.reacoes[id]; else H.reacoes[id] = b.dataset.r;
    salvar(); vibrar(15);
    el.querySelectorAll(".le-reacao [data-r]").forEach(x => x.classList.toggle("on", H.reacoes[id] === x.dataset.r));
  }));
}

// ---------------------------------------------------------------- favorito "Copiar capítulo" (ajuda)
// (pedido do Alediov, 26/10/2026) O favorito (tools/novel/copiar-capitulo.js, montado em ./favorito.js) roda no site
// da novel, na página que ELE abriu: copia o capítulo e guarda numa lista do próprio site. Aqui só a instalação.
async function folhaFavorito() {
  const { FAVORITO } = await import("./favorito.js");
  const fundo = document.createElement("div"); fundo.className = "le-folha-fundo";
  fundo.innerHTML = `<div class="le-folha le-fav-folha"><h3>Copiar capítulos com um toque</h3>
    <p class="le-dica">Um favorito do navegador que copia o capítulo aberto no site (título e texto, sem menus, anúncios e comentários). É sempre você que toca: ele não abre nem baixa nada sozinho.</p>
    <p class="le-dica le-fav-ext">No notebook, a extensão <b>Órbita · Capítulos</b> faz isso com um clique e já envia para a tradução, sem colar: baixe o <code>Orbita-Capitulos.zip</code> na página de versões do app (o passo a passo vem dentro).</p>
    <div class="le-fav-bts"><button class="botao le-fav-copiar">Copiar o código</button><button class="le-baixar le-fav-enviar">Enviar para o notebook</button></div>
    <h4>No celular (Chrome)</h4>
    <ol class="le-fav-passos">
      <li>Toque em <b>Copiar o código</b>, aqui em cima.</li>
      <li>No Chrome, abra qualquer página e toque em <b>⋮ → ☆</b> para criar um favorito. Depois, <b>⋮ → Favoritos</b>, segure o favorito novo e toque em <b>Editar</b>.</li>
      <li>Nome: <code>orbita</code>. Endereço (URL): apague tudo e cole o código. Salve.</li>
      <li>No capítulo, toque na barra de endereço, digite <code>orbita</code> e toque no favorito que aparece na lista (pelo menu Favoritos ele não roda).</li>
      <li>Aparece um quadro embaixo: o capítulo já está copiado. Volte aqui, toque em <b>Colar capítulos em inglês</b> e cole.</li>
    </ol>
    <h4>Vários de uma vez</h4>
    <p class="le-dica">Cada capítulo em que você toca no favorito fica numa lista guardada no próprio site. No último, toque em <b>Copiar todos</b> e cole tudo de uma vez aqui; depois, <b>Esvaziar a lista</b>.</p>
    <h4>No notebook</h4>
    <p class="le-dica">Toque em <b>Enviar para o notebook</b> (por e-mail ou WhatsApp para você mesmo). No Chrome do notebook: <b>Ctrl+Shift+O</b> → ⋮ → Adicionar novo favorito, nome <code>Órbita</code> e o código no URL; mostre a barra de favoritos com <b>Ctrl+Shift+B</b> e clique nela no capítulo. Ou abra a página <code>copiar-capitulo.html</code> e arraste o botão para a barra.</p>
    <h4>Se não der certo</h4>
    <p class="le-dica">"Pouco texto": o site pode montar o capítulo aos poucos; role até o fim e toque de novo. Sem o número do capítulo, ele entra aqui como o próximo da lista.</p>
    <details class="le-fav-cod"><summary>Ver o código</summary><textarea readonly rows="4"></textarea></details></div>`;
  raiz.append(fundo);
  requestAnimationFrame(() => fundo.classList.add("aberto"));
  const ta = fundo.querySelector("textarea"); ta.value = FAVORITO;
  fundo.querySelector(".le-fav-copiar").onclick = async (e) => {
    try { await navigator.clipboard.writeText(FAVORITO); }
    catch { fundo.querySelector(".le-fav-cod").open = true; ta.focus(); ta.select(); try { document.execCommand("copy"); } catch { /* fica selecionado */ } }
    e.currentTarget.textContent = "Código copiado ✓"; vibrar(20);
  };
  fundo.querySelector(".le-fav-enviar").onclick = async () => {
    try {
      const { Capacitor, registerPlugin } = await import("../../vendor/capacitor-core.js");
      if (Capacitor.isNativePlatform?.()) { await registerPlugin("Share").share({ title: "Favorito Copiar capítulo (Órbita)", text: FAVORITO, dialogTitle: "Enviar o código do favorito" }); return; }
      if (navigator.share) { await navigator.share({ title: "Copiar capítulo (Órbita)", text: FAVORITO }); return; }
      await navigator.clipboard.writeText(FAVORITO); toast("Código copiado: cole numa mensagem para você.");
    } catch { /* cancelou */ }
  };
  fundo.onclick = (e) => { if (e.target === fundo) { fundo.classList.remove("aberto"); setTimeout(() => fundo.remove(), 220); } };
}

/** Colar: separa os capítulos (colar.js) e envia cada um para novels/<id>/en/ no repositório. */
async function folhaColar(nv) {
  const N = novelEstado(nv), ind = await indice(nv).catch(() => null);
  const ultimo = Math.max(0, ...N.colados, ...(ind?.unidades || []).map(u => u.capitulo));
  const fundo = document.createElement("div"); fundo.className = "le-folha-fundo";
  fundo.innerHTML = `<div class="le-folha le-colar-folha"><h3>Colar capítulos</h3>
    <p class="le-dica">Cole um ou vários capítulos de uma vez, cada um começando por "Chapter N". Sem título, vira o capítulo ${ultimo + 1}.</p>
    <button class="le-link le-colar-fav">${I.toque}Copiar do site com um toque: como fazer</button>
    <textarea rows="10" placeholder="Chapter ${ultimo + 1}: …"></textarea><p class="le-dica le-colar-info"></p>
    <button class="botao le-colar-ir" disabled>Enviar para a tradução</button></div>`;
  raiz.append(fundo);
  requestAnimationFrame(() => fundo.classList.add("aberto"));
  const ta = fundo.querySelector("textarea"), info = fundo.querySelector(".le-colar-info"), bt = fundo.querySelector(".le-colar-ir");
  fundo.querySelector(".le-colar-fav").onclick = () => folhaFavorito();
  const C = await import("./colar.js");
  let caps = [];
  ta.oninput = () => {
    caps = C.separarCapitulos(ta.value, ultimo + 1);
    info.textContent = caps.length ? `${caps.length} capítulo${caps.length > 1 ? "s" : ""}: ${faixas(caps.map(c => c.n).sort((a, b) => a - b))}` : "";
    bt.disabled = !caps.length;
  };
  bt.onclick = async () => {
    const { lerArquivoRepo, gravarArquivoRepo, temToken } = await import("../dados.js");
    if (!temToken()) { toast("Ponha o token do GitHub em Ajustes do Órbita (engrenagem da Home) para enviar."); return; }
    bt.disabled = true; ta.disabled = true;
    let ok = 0;
    for (const c of caps) {
      info.textContent = `Enviando ${ok + 1} de ${caps.length}…`;
      const caminho = `${nv.pasta}/en/${C.nomeArquivo(c.n)}`;
      try {
        const ja = await lerArquivoRepo(caminho).catch(() => null);
        const r = await gravarArquivoRepo(caminho, C.conteudoArquivo(c), ja?.sha || null, `Novel ${nv.chave}: capítulo ${c.n} (inglês)`);
        if (r?.conflito) throw new Error("conflito");
        if (!N.colados.includes(c.n)) N.colados.push(c.n);
        ok++;
      } catch (e) { info.textContent = `Parou no capítulo ${c.n}: ${e.message || e}. Os anteriores foram enviados.`; break; }
    }
    N.colados.sort((a, b) => a - b); salvar();
    if (ok === caps.length) { toast(`${ok} capítulo${ok > 1 ? "s" : ""} enviado${ok > 1 ? "s" : ""}: a tradução chega de madrugada.`); fundo.remove(); desenhar(); }
    else { bt.disabled = false; ta.disabled = false; }
  };
  fundo.onclick = (e) => { if (e.target === fundo) { fundo.classList.remove("aberto"); setTimeout(() => fundo.remove(), 220); } };
}

/** Glossário de nomes e termos, sem spoiler: só o que aparece até o capítulo lido mais adiante. */
async function verGlossario(nv) {
  let g = null;
  try { const r = await baixarDoRepo(`${nv.pasta}/glossario.json`); if (r) { g = await r.json(); await BD.guardar("json", `${nv.pasta}/glossario.json`, g); } } catch { /* sem internet */ }
  g ||= await BD.pegar("json", `${nv.pasta}/glossario.json`);
  const ind = await indice(nv).catch(() => null), l = L();
  const ate = Math.max(0, ...(ind?.unidades || []).filter(u => l.lidas[u.id] || l.pos[u.id]?.f > 0.05).map(u => u.capitulo));
  const itens = (g?.termos || []).filter(x => (x.desde || 0) <= ate).sort((a, b) => (a.tipo || "").localeCompare(b.tipo || "") || a.pt.localeCompare(b.pt, "pt-BR"));
  const fundo = document.createElement("div"); fundo.className = "le-folha-fundo";
  fundo.innerHTML = `<div class="le-folha le-glos"><h3>Glossário</h3><p class="le-dica">Até o capítulo ${ate}: nada do que vem depois.</p>
    ${itens.length ? itens.map(x => `<div class="le-glos-it"><b>${escapar(x.pt)}</b>${x.ko ? `<span lang="ko">${escapar(x.ko)}</span>` : ""}${x.en && x.en !== x.pt ? `<small>${escapar(x.en)}</small>` : ""}${x.nota ? `<p>${escapar(x.nota)}</p>` : ""}</div>`).join("") : `<p class="le-dica">Ainda vazio: ele cresce a cada noite de tradução.</p>`}</div>`;
  raiz.append(fundo);
  requestAnimationFrame(() => fundo.classList.add("aberto"));
  fundo.onclick = (e) => { if (e.target === fundo) { fundo.classList.remove("aberto"); setTimeout(() => fundo.remove(), 220); } };
}

function linhaUnidade(livro, u, comLivro = false) {
  const l = L(), lida = !!l.lidas[u.id], f = l.pos[u.id]?.f || 0;
  const b = document.createElement("button");
  b.className = `le-un ${lida ? "lida" : f > 0.02 ? "meio" : ""}`;
  b.innerHTML = `<i class="le-un-marca" style="--f:${lida ? 1 : f}">${lida ? I.check : ""}</i>
    <span class="le-un-tx"><b>${escapar(u.titulo)}</b><small>${comLivro ? `${escapar(livro.disciplina)} · ` : ""}${I.relogio}${u.minutos} min${u.figuras ? ` · ${I.img}${u.figuras}` : ""}${!lida && f > 0.02 ? ` · ${Math.round(f * 100)}%` : ""}</small></span>${I.seta}`;
  b.onclick = () => abrirUnidade(livro, u.id);
  return b;
}

async function telaLivro(t, livro) {
  const ind = await indice(livro);
  const p = progressoLivro(ind), l = L();
  const cab = document.createElement("div"); cab.className = "le-cab";
  cab.innerHTML = `<button class="le-voltar">${I.voltar}<span>Estante</span></button>
    <div class="le-cab-linha">${capa(livro, "media")}<div><h2>${escapar(livro.titulo)}</h2><p>${escapar(livro.autor)} · ${escapar(livro.edicao)}</p>
    <span class="le-prog"><i style="width:${Math.round(p.pct * 100)}%"></i></span><p class="le-dica">${p.lidas} de ${p.total} unidades lidas · ${horas(p.restam)} de leitura pela frente</p></div></div>
    <button class="le-baixar"></button>`;
  cab.querySelector(".le-voltar").onclick = () => { tela = { tipo: "estante" }; desenhar(); };
  ligarDl(cab.querySelector(".le-baixar"), livro, ind, await situacaoDl(livro, ind));
  t.append(cab);
  // por capítulo, abrindo o do ponto onde ele está
  const caps = new Map();
  for (const u of ind.unidades) { if (!caps.has(u.capitulo)) caps.set(u.capitulo, []); caps.get(u.capitulo).push(u); }
  const atual = ind.unidades.find(u => !l.lidas[u.id])?.capitulo;
  for (const [c, us] of caps) {
    const lidas = us.filter(u => l.lidas[u.id]).length;
    const d = document.createElement("details"); d.className = "le-cap"; d.open = c === atual;
    d.innerHTML = `<summary><span class="le-cap-n">${c}</span><span class="le-cap-tx"><b>${escapar(ind.capitulos?.[c] || `Capítulo ${c}`)}</b><small>${lidas} de ${us.length} lidas · ${us.reduce((s, u) => s + u.minutos, 0)} min</small></span><i class="le-cap-anel" style="--f:${lidas / us.length}"></i></summary>`;
    const box = document.createElement("div"); box.className = "le-lista";
    for (const u of us) box.append(linhaUnidade(livro, u));
    d.append(box);
    t.append(d);
  }
}

// ---------------------------------------------------------------- leitor
let leitor = null; // { livro, u, dados, el, timer, ultimoToque }

function aplicarAjustes(el) {
  const a = L().aj;
  el.style.setProperty("--le-tam", `${a.tam}px`);
  el.style.setProperty("--le-alt", a.alt);
  el.dataset.fonte = a.fonte; el.dataset.tema = a.tema;
  el.classList.toggle("justificar", !!a.justificar);
  el.classList.toggle("sem-refs", !a.refs);
  el.classList.toggle("sem-termos", !a.termos);
}

const normal = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function htmlBloco(b, figs) {
  const ligar = (x) => x.replace(/\b(Figuras?|Figs?\.|Tabelas?|Quadros?)\s*(\d+)[.](\d+)/g, (m, tipo, a, c) => {
    const k = /^Fig/i.test(tipo) ? `fig:${a}.${c}` : `tab:${a}.${c}`;
    return figs.has(k) ? `<a class="le-ref" data-k="${k}">${m}</a>` : m;
  });
  switch (b.t) {
    case "h2": case "h3": return `<${b.t}>${b.x}</${b.t}>`;
    case "p": return `<p>${ligar(b.x)}</p>`;
    case "li": {
      // níveis (tools/leitura/padronizar_listas.py): 1 = 1., 2 = a), 3 = i), 4 = a) dentro do romano; sem nível, o antigo
      const nv = b.nivel ?? (b.n && /^[a-z]$/i.test(b.n) ? 2 : b.n ? 1 : 0);
      const marca = !b.n ? "•" : nv === 1 ? `${escapar(b.n)}.` : `${escapar(b.n)})`;
      return `<div class="le-li n${nv}"><span class="le-li-m">${marca}</span><p>${ligar(b.x)}</p></div>`;
    }
    case "nota": return `<aside class="le-nota">${ligar(b.x)}</aside>`;
    case "fig": case "tab": case "caixa": {
      const leg = b.t === "fig" ? `<figcaption><b>Figura ${escapar(b.num)}</b> ${legendaHTML(b.leg)}</figcaption>` : b.num ? `<figcaption><b>${escapar(b.num)}</b></figcaption>` : "";
      const ar = b.w && b.h ? `style="aspect-ratio:${b.w}/${b.h}"` : "";
      return `<figure class="le-fig ${b.t}" data-src="${escapar(b.src)}"><div class="le-fig-img" ${ar}><img alt="" ${b.w ? `width="${b.w}" height="${b.h}"` : ""}></div>${leg}</figure>`;
    }
  }
  return "";
}

// legenda: texto escapado, mas com as tags de ênfase permitidas nos blocos e as entidades (&lt; em "<4 mm")
function legendaHTML(leg) {
  return escapar(leg || "").replace(/&lt;(\/?)(i|b|em|strong|sup|sub|br)&gt;/g, "<$1$2>").replace(/&amp;(lt|gt|amp|nbsp|#\d+);/g, "&$1;");
}

async function abrirUnidade(livro, id) {
  fecharLeitor(false);
  const ind = await indice(livro).catch(e => { toast(e.message); return null; });
  if (!ind) return;
  const u = ind.unidades.find(x => x.id === id);
  const el = document.createElement("div"); el.className = "le-leitor";
  el.innerHTML = `<div class="le-barra"><i></i></div>
    <header class="le-l-topo"><button class="le-l-voltar" aria-label="Voltar">${I.voltar}</button><span class="le-l-tit"><small>${escapar(tituloDe(livro))}</small><b>${escapar(u?.titulo || "")}</b></span><button class="le-l-ouvir" aria-label="Ouvir">${I.fone}</button><button class="le-l-aa" aria-label="Aparência do texto">${I.aa}</button></header>
    <div class="le-l-rol"><article class="le-texto" lang="pt-BR"><div class="le-carregando">Abrindo…</div></article></div>`;
  aplicarAjustes(el);
  raiz.append(el);
  requestAnimationFrame(() => el.classList.add("aberto"));
  el.querySelector(".le-l-voltar").onclick = () => fecharLeitor();
  el.querySelector(".le-l-aa").onclick = () => folhaAjustes(el);
  el.querySelector(".le-l-ouvir").onclick = () => leitor && ouvirUnidade(livro, leitor.u.id, (L().pos[leitor.u.id]?.b ?? 0) + (leitor.desloc || 0));
  let dados;
  try { dados = await json(`${livro.pasta}/leitura/${id}.json`); }
  catch (e) { el.querySelector(".le-texto").innerHTML = `<div class="le-vazio">${I.livro}<p>${escapar(e.message)}</p></div>`; return; }
  const l = L();
  l.ultima = { livro: livro.chave, id }; salvar();
  leitor = { livro, u, dados, el, ind, ultimoToque: Date.now(), concluiu: !!l.lidas[id] };
  const figs = new Map();
  for (const b of dados.blocos) {
    if (b.t === "fig") figs.set(`fig:${b.num}`, b);
    else if (b.t === "tab" && b.num) figs.set(`tab:${b.num.replace(/^\D+/, "")}`, b);
  }
  // o primeiro título repete o da unidade: some
  const blocos = dados.blocos.slice();
  if (blocos[0] && /^h[23]$/.test(blocos[0].t) && normal(dados.titulo).includes(normal(blocos[0].x).slice(0, 30))) { blocos.shift(); leitor.desloc = 1; }
  const art = el.querySelector(".le-texto");
  art.lang = livro.traducao || ehNovel(livro) ? "pt-BR" : art.lang;
  art.innerHTML = `<header class="le-t-cab"><small>${ehNovel(livro) ? `Capítulo ${dados.capitulo}` : `Cap. ${dados.capitulo}${dados.capituloNome ? ` · ${escapar(dados.capituloNome)}` : ""}`}${livro.traducao ? " · tradução" : ""}</small><h1>${escapar(dados.titulo)}</h1>
    <p>${I.relogio}${u?.minutos || "?"} min de leitura${u?.figuras ? ` · ${u.figuras} ${u.figuras > 1 ? "figuras e tabelas" : "figura ou tabela"}` : ""}</p></header>`
    + blocos.map((b, i) => htmlBloco(b, figs).replace(/^<(\w+)/, `<$1 data-i="${i}"`)).join("")
    + `<div class="le-fim"></div>`;
  // imagens só quando chegam perto da tela
  const obsImg = new IntersectionObserver(async (ents) => {
    for (const e of ents) if (e.isIntersecting) {
      obsImg.unobserve(e.target);
      const img = e.target.querySelector("img"), u2 = await urlImg(caminhoImg(livro, e.target.dataset.src));
      if (u2) { img.onload = () => e.target.classList.add("ok"); img.src = u2; }
      else e.target.classList.add("falhou");
    }
  }, { root: el.querySelector(".le-l-rol"), rootMargin: "900px 0px" });
  // com texto selecionado (arrastar o mouse sobre a legenda, por exemplo), o clique termina a seleção e não amplia
  art.querySelectorAll(".le-fig").forEach(f => { obsImg.observe(f); f.onclick = () => { if (!temSelecao(art)) ampliar(f); }; });
  art.querySelectorAll(".le-ref").forEach(a => (a.onclick = (e) => {
    e.stopPropagation();
    if (temSelecao(art)) return;
    const b = figs.get(a.dataset.k), f = b && art.querySelector(`.le-fig[data-src="${CSS.escape(b.src)}"]`);
    if (f) ampliar(f);
  }));
  montarFim(art.querySelector(".le-fim"));
  ligarTermos(livro, dados, art);
  ligarCopiar(el, art);
  // volta ao ponto onde parou
  const rol = el.querySelector(".le-l-rol");
  const pos = l.pos[id];
  if (pos && !l.lidas[id] && pos.b != null) {
    const alvo = art.querySelector(`[data-i="${pos.b}"]`);
    if (alvo) rol.scrollTop = alvo.offsetTop - 70;
  }
  leitor.obsImg = obsImg;
  let pendente = false;
  rol.addEventListener("scroll", () => {
    leitor.ultimoToque = Date.now();
    if (pendente) return; pendente = true;
    requestAnimationFrame(() => { pendente = false; aoRolar(); });
    if (G) G.fecharBalao();
  }, { passive: true });
  ["pointerdown", "touchstart", "wheel", "keydown"].forEach(k => el.addEventListener(k, () => (leitor && (leitor.ultimoToque = Date.now())), { passive: true }));
  leitor.timer = setInterval(tique, 5000);
  aoRolar();
}

// ---------------------------------------------------------------- glossário ao toque (glossario.js)
let G = null;
async function ligarTermos(livro, dados, art) {
  if (L().aj.termos === false) return;
  try {
    G ||= await import("./glossario.js");
    const termos = await G.termosDo(livro, jsonFresco, { ate: dados.capitulo || 0, unidade: dados.id || "" });
    if (!art.isConnected || !termos.length) return;
    G.marcarTermos(art, termos);
    art.addEventListener("click", (e) => {
      const s = e.target.closest(".le-termo"); if (!s || !art.contains(s)) return;
      e.stopPropagation();
      if (temSelecao(art)) return;
      const t = termos[+s.dataset.t]; if (!t) return;
      const l = L(); l.termosVistos = (l.termosVistos || 0) + 1;
      G.mostrarTermo(s, t, { traducao: !!livro.traducao, livro: (livro.ensina && t.un && livroDe(t.un)?.titulo) || livro.titulo });
    });
  } catch (e) { console.warn("Leitura: glossário", e); }
}

// ---------------------------------------------------------------- copiar o texto (pedido do Alediov, 03/11/2026)
// O app inteiro é user-select: none; no leitor o texto é selecionável (leitura.css): segurar o dedo abre a seleção do
// Android com "Copiar". Enquanto há seleção, uma pílula discreta no alto copia o parágrafo inteiro (sem os números das
// referências). Nada aqui segura o toque longo nem o contextmenu: a seleção nativa fica como é.
const BLOCO_COPIAR = ".le-texto > [data-i]:not(figure), .le-texto > .le-t-cab, .le-texto figcaption";
function temSelecao(art) {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !String(sel).trim()) return false;
  return art.contains(sel.anchorNode) || art.contains(sel.focusNode);
}
export function textoDoBloco(b) {
  const c = b.cloneNode(true);
  c.querySelectorAll("sup.r").forEach(x => x.remove());
  if (c.matches(".le-li")) { const m = c.querySelector(".le-li-m"); const t = m && m.textContent !== "•" ? `${m.textContent} ` : "• "; m?.remove(); return (t + c.textContent).replace(/\s+/g, " ").trim(); }
  if (c.matches(".le-t-cab")) return c.querySelector("h1")?.textContent.trim() || "";
  return c.textContent.replace(/\s+/g, " ").trim();
}
async function copiarTexto(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch {
    const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;width:1px;height:1px";
    document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch { /* sem cópia */ } ta.remove(); return ok;
  }
}
function ligarCopiar(el, art) {
  const pil = document.createElement("button"); pil.className = "le-copiar"; pil.type = "button"; pil.hidden = true;
  pil.innerHTML = `${I.copiar}<span>Copiar o parágrafo</span>`;
  el.append(pil);
  let bloco = null, esconder = 0;
  const aoMudar = () => {
    if (!leitor || leitor.el !== el) return;
    if (temSelecao(art)) {
      leitor.ultimoToque = Date.now(); // selecionar também é ler
      const n = document.getSelection().anchorNode, e = n?.nodeType === 1 ? n : n?.parentElement;
      const b = e?.closest(BLOCO_COPIAR);
      clearTimeout(esconder);
      if (b && art.contains(b)) { bloco = b; pil.hidden = false; requestAnimationFrame(() => pil.classList.add("aberto")); return; }
    }
    // o toque na pílula desfaz a seleção antes do clique: ela espera um pouco antes de sumir
    clearTimeout(esconder);
    esconder = setTimeout(() => { pil.classList.remove("aberto"); pil.hidden = true; bloco = null; }, 900);
  };
  document.addEventListener("selectionchange", aoMudar);
  leitor.semCopiar = () => { document.removeEventListener("selectionchange", aoMudar); clearTimeout(esconder); };
  pil.addEventListener("pointerdown", (e) => e.preventDefault()); // no mouse, não desfaz a seleção
  pil.onclick = async () => {
    if (!bloco) return;
    const txt = textoDoBloco(bloco);
    const ok = txt && await copiarTexto(txt);
    toast(ok ? "Parágrafo copiado" : "Não deu para copiar");
    document.getSelection()?.removeAllRanges();
    pil.classList.remove("aberto"); pil.hidden = true; bloco = null;
  };
}

// ---------------------------------------------------------------- ouvir (voz.js)
/** Trechos de uma unidade para ouvir: títulos, parágrafos, itens, notas e as legendas das figuras. */
export function trechosDaUnidade(dados) {
  const V = vozMod, out = [];
  dados.blocos.forEach((b, i) => {
    const ref = { unidade: dados.id, bloco: i };
    if (b.t === "fig") out.push(...V.trechosDe(`Figura ${b.num}. ${b.leg || ""}`, { ref, rotulo: dados.titulo }));
    else if (b.t === "tab" || b.t === "caixa") { if (b.num) out.push(...V.trechosDe(`${b.num}: veja no livro.`, { ref, rotulo: dados.titulo })); }
    else if (b.x) out.push(...V.trechosDe((b.t === "li" && b.n ? `${b.n}. ` : "") + b.x, { ref, rotulo: dados.titulo }));
  });
  return out;
}
let vozMod = null;
async function ouvirUnidade(livro, id, blocoInicial = 0) {
  vozMod ||= await import("../voz.js");
  const ind = await indice(livro), u = ind.unidades.find(x => x.id === id);
  const dados = await json(`${livro.pasta}/leitura/${id}.json`);
  const trechos = trechosDaUnidade(dados);
  const inicio = Math.max(0, trechos.findIndex(t => t.ref.bloco >= blocoInicial));
  const destacar = (i, t) => {
    if (!leitor || leitor.u.id !== t?.ref?.unidade) return;
    leitor.el.querySelectorAll(".lendo").forEach(x => x.classList.remove("lendo"));
    const b = leitor.el.querySelector(`.le-texto > [data-i="${t.ref.bloco - (leitor.desloc || 0)}"]`);
    if (b) { b.classList.add("lendo"); if (document.visibilityState === "visible") b.scrollIntoView({ block: "center", behavior: "smooth" }); }
  };
  // ao acabar, emenda a próxima unidade do livro (para ouvir o ônibus inteiro sem mexer no celular)
  const proxima = async (atualId) => {
    const us = ind.unidades, k = us.findIndex(x => x.id === atualId), p = us[k + 1];
    if (!p) return null;
    const d2 = await json(`${livro.pasta}/leitura/${p.id}.json`);
    const tr = [{ texto: `Próxima unidade: ${d2.titulo}.`, rotulo: d2.titulo, ref: { unidade: p.id, bloco: -1 } }, ...trechosDaUnidade(d2)];
    L().pos[p.id] ||= { f: 0, b: 0 }; L().ultima = { livro: livro.chave, id: p.id }; salvar();
    return { trechos: tr, titulo: `${livro.titulo.split(" ").slice(0, 4).join(" ")} · ${d2.titulo}`, aoFim: () => proxima(p.id) };
  };
  vozMod.ouvir({ titulo: `${u?.titulo || dados.titulo}`, trechos, inicio, aoTrecho: (i, t) => { destacar(i, t); if (t?.ref && t.ref.bloco >= 0) { L().pos[t.ref.unidade] = { ...(L().pos[t.ref.unidade] || {}), b: Math.max(0, t.ref.bloco - (leitor?.u.id === t.ref.unidade ? leitor.desloc || 0 : 0)) }; } }, aoFim: () => proxima(id) });
}

function aoRolar() {
  if (!leitor) return;
  const rol = leitor.el.querySelector(".le-l-rol");
  const f = Math.min(1, rol.scrollTop / Math.max(1, rol.scrollHeight - rol.clientHeight));
  leitor.el.querySelector(".le-barra i").style.width = `${(f * 100).toFixed(1)}%`;
  // o bloco no alto da tela, para voltar a ele
  let b = null;
  for (const x of leitor.el.querySelectorAll(".le-texto > [data-i]")) { if (x.offsetTop + x.offsetHeight > rol.scrollTop + 60) { b = +x.dataset.i; break; } }
  const l = L(), id = leitor.u.id;
  l.pos[id] = { f: Math.max(f, l.lidas[id] ? 1 : 0), b };
  clearTimeout(leitor.salvarT); leitor.salvarT = setTimeout(salvar, 800);
  verificarConclusao();
}

// tempo de leitura: conta enquanto a tela está visível e houve toque ou rolagem no último minuto
function tique() {
  if (!leitor || document.visibilityState !== "visible" || Date.now() - leitor.ultimoToque > 60000) return;
  const l = L(), id = leitor.u.id, hoje = hojeISO();
  l.tempo[id] = (l.tempo[id] || 0) + 5;
  l.dias[hoje] = (l.dias[hoje] || 0) + 5;
  verificarConclusao();
  atualizarFim();
}
const exigido = (u) => Math.max(60, Math.round((u?.minutos || 5) * 60 * 0.35));
const xpDe = (u) => Math.max(5, Math.min(40, Math.round((u?.minutos || 5) * 2)));

function noFim() {
  const rol = leitor.el.querySelector(".le-l-rol");
  return rol.scrollTop + rol.clientHeight >= rol.scrollHeight - 260;
}
function verificarConclusao() {
  if (!leitor || leitor.concluiu || !noFim()) return;
  const l = L(), id = leitor.u.id;
  if (!ehNovel(leitor.livro) && (l.tempo[id] || 0) < exigido(leitor.u)) { atualizarFim(); return; }
  leitor.concluiu = true;
  l.lidas[id] = hojeISO();
  if (ehNovel(leitor.livro)) { salvar(); vibrar(30); atualizarFim(); return; }
  const xp = ganhar(xpDe(leitor.u), Math.ceil(xpDe(leitor.u) / 3), `Leitura: ${leitor.u.titulo}`, "leitura");
  const novoDia = registrarDiaEstudado();
  marcarSujo(hojeISO()); contar("unidadesLidas");
  salvar();
  tocar(novoDia ? "ofensiva" : "fim"); vibrar(40);
  leitor.ganhou = { xp, novoDia };
  if (lidasEm(hojeISO()) === metaUn()) setTimeout(() => toast(`Meta de leitura de hoje: ${metaUn()} ${metaUn() === 1 ? "unidade" : "unidades"}! 📖`), 900);
  atualizarFim();
}

function montarFim(el) { el.innerHTML = ""; atualizarFim(); }
function atualizarFim() {
  if (!leitor) return;
  const el = leitor.el.querySelector(".le-fim"); if (!el) return;
  const l = L(), id = leitor.u.id, prox = proximaUnidade();
  const estado = l.lidas[id] ? "lida" : "lendo";
  if (el.dataset.estado === estado && estado === "lida" && el.dataset.q === String(l.quiz[id] ?? "")) return;
  if (ehNovel(leitor.livro)) {
    if (el.dataset.estado === estado) return;
    el.dataset.estado = estado;
    const hist = ehHistoria(leitor.livro);
    el.innerHTML = `${estado === "lida" ? `<div class="le-fim-card ok"><span class="le-fim-selo">${I.check}</span><b>Capítulo lido</b>${hist ? reacaoHTML(leitor.livro, id) : ""}</div>` : ""}${prox ? botaoProxima(prox) : `<div class="le-fim-card"><p>${hist ? "O próximo capítulo chega numa das próximas madrugadas." : "O próximo capítulo ainda não foi traduzido. Cole os próximos em inglês: eles chegam de madrugada."}</p></div>`}`;
    el.querySelector(".le-prox")?.addEventListener("click", () => abrirUnidade(leitor.livro, prox.id));
    if (hist) ligarReacao(el, leitor.livro, id);
    return;
  }
  if (estado === "lendo") {
    const falta = Math.max(0, exigido(leitor.u) - (l.tempo[id] || 0));
    const txt = falta > 0 ? `Leia com calma: a unidade vale <b>${xpDe(leitor.u)} XP</b> quando você chegar aqui depois de ~${Math.max(1, Math.ceil(falta / 60))} min de leitura.` : `Chegando ao fim, a unidade vale <b>${xpDe(leitor.u)} XP</b>.`;
    if (el.dataset.estado === "lendo" && el.dataset.txt === txt) return;
    el.dataset.estado = "lendo"; el.dataset.txt = txt;
    el.innerHTML = `<div class="le-fim-card"><p>${txt}</p></div>${prox ? botaoProxima(prox) : ""}`;
  } else {
    el.dataset.estado = "lida"; el.dataset.q = String(l.quiz[id] ?? "");
    const g = leitor.ganhou;
    el.innerHTML = `<div class="le-fim-card ok"><span class="le-fim-selo">${I.check}</span><b>Unidade lida</b>
      <p>${g ? `+${g.xp} XP${g.novoDia ? " · a ofensiva de hoje está garantida" : ""}` : `Lida em ${new Date(l.lidas[id] + "T12:00:00").toLocaleDateString("pt-BR")}`}</p><div class="le-quiz"></div></div>${prox ? botaoProxima(prox) : ""}`;
    montarQuiz(el.querySelector(".le-quiz"));
  }
  el.querySelector(".le-prox")?.addEventListener("click", () => abrirUnidade(leitor.livro, prox.id));
}
function proximaUnidade() {
  const us = leitor.ind.unidades, i = us.findIndex(u => u.id === leitor.u.id);
  return us[i + 1] || null;
}
const botaoProxima = (u) => `<button class="le-prox"><small>Próxima</small><b>${escapar(u.titulo)}</b><span>${u.minutos} min ${I.seta}</span></button>`;

// 3 perguntas da própria unidade (das lições já no aparelho), uma vez por unidade
async function perguntasDa(id) {
  const out = [];
  for (const d of (await listarDias()).slice(-120)) {
    const dia = await carregarDia(d);
    for (const s of dia?.sessoes || []) for (const li of s.licoes || []) for (const ex of li.exercicios || [])
      if (ex.tipo === "multipla" && String(ex.id).startsWith(id + "-") && Array.isArray(ex.opcoes)) out.push(ex);
  }
  return escolherPerguntas(id, out);
}
// pedido do Alediov (06/11/2026): as duas últimas às vezes eram iguais. A mesma questão volta nas lições de revisão
// com outro id, então fica uma só por id E por enunciado (sem acento, maiúsculas, marcações e pontuação); depois o
// sorteio estável por unidade de sempre
const chaveEnunciado = (t) => String(t || "").replace(/<[^>]+>|\*+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function escolherPerguntas(id, lista, n = 3) {
  const ids = new Set(), textos = new Set(), unicas = [];
  for (const ex of lista) {
    const k = chaveEnunciado(ex.enunciado);
    if (ids.has(ex.id) || textos.has(k)) continue;
    ids.add(ex.id); textos.add(k); unicas.push(ex);
  }
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return unicas.map((x, i) => [x, ((h + i * 2654435761) >>> 0) % 1000]).sort((a, b) => a[1] - b[1]).map(x => x[0]).slice(0, n);
}
// a certa vem sempre em 1º no gerador (as lições embaralham na hora, em exercicios.js); aqui também: a ordem é sorteada
// uma vez por pergunta quando o quiz começa e cada botão guarda o índice original (`k`)
export const opcoesNaTela = (ex) => embaralhar(ex.opcoes.map((t, k) => ({ t, k })));
async function montarQuiz(box) {
  const l = L(), id = leitor.u.id;
  if (l.quiz[id] != null) { box.innerHTML = `<p class="le-dica">Perguntas rápidas: ${l.quiz[id]} de 3 certas.</p>`; return; }
  const qs = await perguntasDa(id);
  if (!qs.length || !box.isConnected) return;
  box.innerHTML = `<button class="botao le-quiz-ir">${qs.length} pergunta${qs.length > 1 ? "s" : ""} rápida${qs.length > 1 ? "s" : ""} (bônus)</button>`;
  box.querySelector("button").onclick = () => rodarQuiz(box, qs);
}
function rodarQuiz(box, qs) {
  let i = 0, certas = 0, t0 = Date.now();
  const ordens = qs.map(opcoesNaTela);
  const id = leitor.u.id;
  const mostrar = () => {
    if (i >= qs.length) {
      const l = L(); l.quiz[id] = certas; salvar();
      if (certas) ganhar(certas * 3, certas, `Leitura: perguntas de ${leitor.u.titulo}`, "leitura");
      box.innerHTML = `<p class="le-dica">${certas} de ${qs.length} certas${certas ? ` · +${certas * 3} XP` : ""}</p>`;
      if (certas === qs.length) tocar("combo");
      return;
    }
    const ex = qs[i];
    box.innerHTML = `<div class="le-q"><small>${i + 1} de ${qs.length}</small><p>${escapar(ex.enunciado)}</p>${ordens[i].map(({ t, k }) => `<button data-k="${k}">${escapar(t)}</button>`).join("")}</div>`;
    t0 = Date.now();
    box.querySelectorAll("button").forEach(b => (b.onclick = () => {
      const k = +b.dataset.k, ok = k === ex.correta;
      registrarResposta(ex, `leitura-${id}`, ok, 1, Date.now() - t0);
      if (ok) certas++;
      tocar(ok ? "certo" : "errado");
      box.querySelectorAll("button").forEach(x => { x.disabled = true; if (+x.dataset.k === ex.correta) x.classList.add("certa"); });
      if (!ok) b.classList.add("errada");
      box.querySelector(".le-q").insertAdjacentHTML("beforeend", `<p class="le-q-exp">${escapar(ex.explicacao || "")}</p><button class="botao le-q-seg">${i + 1 < qs.length ? "Próxima" : "Terminar"}</button>`);
      box.querySelector(".le-q-seg").onclick = () => { i++; mostrar(); };
    }));
  };
  mostrar();
}

function fecharLeitor(animar = true) {
  if (!leitor) return;
  const { el, timer, obsImg } = leitor;
  clearInterval(timer); obsImg?.disconnect();
  leitor.semCopiar?.();
  G?.fecharBalao();
  salvar();
  leitor = null;
  if (animar) { el.classList.remove("aberto"); setTimeout(() => el.remove(), 260); } else el.remove();
  if (["estante", "livro", "novel", "historia"].includes(tela.tipo)) desenhar();
}

// ---------------------------------------------------------------- aparência do texto
function folhaAjustes(el) {
  const a = L().aj;
  const fundo = document.createElement("div"); fundo.className = "le-folha-fundo";
  fundo.innerHTML = `<div class="le-folha">
    <h3>Aparência do texto</h3>
    <div class="le-aj-linha"><span>Tamanho</span><div class="le-passo"><button data-a="menos">A−</button><b class="le-tam"></b><button data-a="mais">A+</button></div></div>
    <div class="le-aj-linha"><span>Espaço entre linhas</span><div class="le-seg" data-k="alt">${[[1.5, "Justo"], [1.7, "Normal"], [1.95, "Amplo"]].map(([v, n]) => `<button data-v="${v}">${n}</button>`).join("")}</div></div>
    <div class="le-aj-linha"><span>Letra</span><div class="le-seg" data-k="fonte"><button data-v="serif" class="f-serif">Serifada</button><button data-v="sans" class="f-sans">Sem serifa</button></div></div>
    <div class="le-aj-linha"><span>Fundo</span><div class="le-temas" data-k="tema">${[["app", "Do app"], ["papel", "Papel"], ["sepia", "Sépia"], ["noite", "Escuro"]].map(([v, n]) => `<button data-v="${v}" class="t-${v}"><i></i>${n}</button>`).join("")}</div></div>
    <label class="le-aj-linha"><span>Justificar o texto</span><input type="checkbox" data-k="justificar"></label>
    <label class="le-aj-linha"><span>Números das referências</span><input type="checkbox" data-k="refs"></label>
    <label class="le-aj-linha"><span>Termos do glossário<small>Sublinhados: um toque mostra a definição</small></span><input type="checkbox" data-k="termos"></label>
  </div>`;
  raiz.append(fundo);
  requestAnimationFrame(() => fundo.classList.add("aberto"));
  const pintar = () => {
    fundo.querySelector(".le-tam").textContent = a.tam;
    fundo.querySelectorAll(".le-seg, .le-temas").forEach(g => g.querySelectorAll("button").forEach(b => b.classList.toggle("on", String(a[g.dataset.k]) === b.dataset.v)));
    fundo.querySelectorAll("input[data-k]").forEach(i => (i.checked = !!a[i.dataset.k]));
    aplicarAjustes(el); salvar();
  };
  fundo.querySelector('[data-a="menos"]').onclick = () => { a.tam = Math.max(14, a.tam - 1); pintar(); };
  fundo.querySelector('[data-a="mais"]').onclick = () => { a.tam = Math.min(28, a.tam + 1); pintar(); };
  fundo.querySelectorAll(".le-seg, .le-temas").forEach(g => g.querySelectorAll("button").forEach(b => (b.onclick = () => {
    const v = b.dataset.v; a[g.dataset.k] = isNaN(+v) ? v : +v; pintar();
  })));
  fundo.querySelectorAll("input[data-k]").forEach(i => (i.onchange = () => { a[i.dataset.k] = i.checked; pintar(); }));
  fundo.onclick = (e) => { if (e.target === fundo) { fundo.classList.remove("aberto"); setTimeout(() => fundo.remove(), 220); } };
  pintar();
}

// ---------------------------------------------------------------- figura ampliada (pinça, arrastar, toque duplo)
function ampliar(fig) {
  const img = fig.querySelector("img"); if (!img?.src) return;
  const cap = fig.querySelector("figcaption")?.innerHTML || "";
  const z = document.createElement("div"); z.className = `le-zoom ${fig.classList.contains("fig") ? "" : "clara"}`;
  z.innerHTML = `<button class="le-zoom-x" aria-label="Fechar">${I.fechar}</button><div class="le-zoom-area"><img src="${img.src}" alt=""></div>${cap ? `<p class="le-zoom-leg">${cap}</p>` : ""}`;
  raiz.append(z);
  requestAnimationFrame(() => z.classList.add("aberto"));
  const area = z.querySelector(".le-zoom-area"), im = z.querySelector("img");
  let esc = 1, tx = 0, ty = 0;
  const pts = new Map(); let ini = null, ultimoToque = 0;
  const aplicar = (suave) => { im.style.transition = suave ? "transform .22s ease" : "none"; im.style.transform = `translate(${tx}px, ${ty}px) scale(${esc})`; };
  const limitar = () => {
    const r = area.getBoundingClientRect(), w = im.offsetWidth * esc, h = im.offsetHeight * esc;
    const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (h - r.height) / 2);
    tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
    if (esc <= 1.01) { esc = 1; tx = 0; ty = 0; }
  };
  area.addEventListener("pointerdown", (e) => {
    area.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      const agora = Date.now();
      if (agora - ultimoToque < 300) { // toque duplo: aproxima no ponto ou volta
        if (esc > 1) { esc = 1; tx = 0; ty = 0; } else {
          const r = area.getBoundingClientRect(); esc = 2.6;
          tx = -(e.clientX - r.left - r.width / 2) * (esc - 1); ty = -(e.clientY - r.top - r.height / 2) * (esc - 1);
          limitar();
        }
        aplicar(true); ultimoToque = 0; return;
      }
      ultimoToque = agora;
    }
    ini = { esc, tx, ty, pts: [...pts.values()].map(p => ({ ...p })) };
  });
  area.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId) || !ini) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...pts.values()];
    if (p.length >= 2 && ini.pts.length >= 2) {
      const d0 = Math.hypot(ini.pts[0].x - ini.pts[1].x, ini.pts[0].y - ini.pts[1].y), d1 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      esc = Math.max(1, Math.min(6, ini.esc * d1 / Math.max(1, d0)));
      tx = ini.tx + ((p[0].x + p[1].x) - (ini.pts[0].x + ini.pts[1].x)) / 2;
      ty = ini.ty + ((p[0].y + p[1].y) - (ini.pts[0].y + ini.pts[1].y)) / 2;
    } else if (esc > 1) {
      tx = ini.tx + p[0].x - ini.pts[0].x; ty = ini.ty + p[0].y - ini.pts[0].y;
    }
    limitar(); aplicar(false);
  });
  const soltar = (e) => { pts.delete(e.pointerId); ini = pts.size ? { esc, tx, ty, pts: [...pts.values()].map(p => ({ ...p })) } : null; limitar(); aplicar(true); };
  area.addEventListener("pointerup", soltar); area.addEventListener("pointercancel", soltar);
  area.addEventListener("wheel", (e) => { e.preventDefault(); esc = Math.max(1, Math.min(6, esc * (e.deltaY < 0 ? 1.15 : 0.87))); limitar(); aplicar(true); }, { passive: false });
  const fechar = () => { z.classList.remove("aberto"); setTimeout(() => z.remove(), 220); };
  z.querySelector(".le-zoom-x").onclick = fechar;
  z.addEventListener("click", (e) => { if (e.target === z) fechar(); });
}

/** O botão voltar do Android: fecha o que estiver por cima. Devolve true se fechou algo. */
export function voltarLeitura() {
  const top = raiz?.querySelector(".le-zoom, .le-folha-fundo");
  if (top) { top.classList.remove("aberto"); setTimeout(() => top.remove(), 220); return true; }
  if (leitor) { fecharLeitor(); return true; }
  if (tela.tipo !== "estante") { tela = { tipo: "estante" }; desenhar(); return true; }
  return false;
}
