// Prova Prática (pedido do Alediov, 04/11/2026, para a 2ª prova prática de Anestesiologia, 18/11, logo depois da
// teórica): na prova ele recebe um caso ("exodontia do 33 com infecção"), diz que técnicas usaria e explica CADA uma
// como no Malamed. Na 1ª prática zerou por não dizer a agulha nem o volume, então agulha e volume ficam em destaque
// em todo lugar.
// - "Prova prática": um caso (procedimento, dentes e a condição que decide), a escolha das técnicas (várias), o retorno
//   com o porquê e as páginas, e depois, para cada técnica do plano, agulha (calibre + comprimento), volume e ponto de
//   inserção, com o botão da ficha.
// - "Consultar as técnicas": a ficha completa de cada técnica dos caps. 13 e 14 (e das suplementares do cap. 15, fora do
//   recorte da prova teórica), na ordem do livro, com as figuras.
// Dados em extras/jogos/tecnicas.json (tools/jogos/montar_tecnicas.py: o texto é o do livro, conferido página a
// página). Estado em E().pratica: partidas, casos[id] {vezes, pontos} e tecnicas[id] {agulha, volume, insercao, plano}
// = {c, e} (contadores: a sincronia soma o que cada aparelho ganhou). O simulado impresso (tools/simulado/
// anestesia_caso.py) lê esse domínio para escolher o caso.
import { abrirCamada, semConteudo } from "../jogos.js";
import { extra, urlMidia } from "../dados.js";
import { escapar } from "../ui.js";
import { E, salvar, hojeISO } from "../estado.js";
import { embaralhar } from "../exercicios.js";
import { tocar } from "../sons.js";
import { jogarCasos, telaConsulta } from "./casoClinico.js";
import { abrirVisor } from "../visorZoom.js";

export const PROVA_PRATICA = "2026-11-18";
const ITENS = ["agulha", "volume", "insercao", "plano"];
const PESO = { agulha: 1.5, volume: 1.5, insercao: 1, plano: 1 };
const GRUPOS = [
  ["maxila", "Maxila · cap. 13"],
  ["mandibula", "Mandíbula · cap. 14"],
  ["suplementar", "Suplementares · cap. 15 (fora do recorte da prova teórica)"],
];

export const est = () => {
  const p = E().pratica ??= {};
  p.casos ??= {}; p.tecnicas ??= {}; p.partidas ??= 0;
  return p;
};
const dom = (S, tid) => (S.tecnicas[tid] ??= {});
function anotar(S, tid, item, certo) {
  const d = dom(S, tid), x = (d[item] ??= { c: 0, e: 0 });
  if (certo) x.c++; else x.e++;
  salvar();
}
/** 0 (sabe) a 1 (não sabe): o quanto a técnica precisa de treino, pelos acertos em agulha, volume, inserção e escolha. */
export function fraqueza(S, tid) {
  const d = S.tecnicas[tid] || {};
  let soma = 0, pesos = 0;
  for (const k of ITENS) {
    const x = d[k], tot = (x?.c || 0) + (x?.e || 0);
    soma += PESO[k] * (tot ? ((x.e || 0) + 1) / (tot + 2) : 0.6);
    pesos += PESO[k];
  }
  return soma / pesos;
}
/** Acerto (%) em um item (agulha, volume, insercao, plano), somando todas as técnicas; null sem tentativas. */
export function acertoItem(S, item) {
  let c = 0, t = 0;
  for (const d of Object.values(S.tecnicas || {})) { const x = d?.[item]; if (x) { c += x.c || 0; t += (x.c || 0) + (x.e || 0); } }
  return t ? Math.round((c / t) * 100) : null;
}
const diasAte = (d) => Math.round((new Date(d + "T12:00") - new Date(hojeISO() + "T12:00")) / 864e5);

/** Casos para a rodada: primeiro os que puxam as técnicas mais fracas e os nunca vistos, sem repetir o tema seguido. */
export function escolherCasosPratica(D, S, n) {
  const nota = (c) => {
    const p = c.planos[0], f = p.reduce((a, t) => a + fraqueza(S, t), 0) / p.length;
    const v = S.casos[c.id]?.vezes || 0;
    return f + (v ? 0 : 0.5) - 0.15 * v + Math.random() * 0.3;
  };
  const ord = D.casos.map(c => [nota(c), c]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const out = [];
  for (const c of ord) {
    if (out.length >= n) break;
    if (out.length && out.at(-1).temas[0] === c.temas[0] && ord.length > n * 2) continue;
    out.push(c);
  }
  for (const c of ord) if (out.length < n && !out.includes(c)) out.push(c);
  return out;
}

// ---------------------------------------------------------------- a ficha
const pag = (p) => (p ? `<span class="pt-p">p. ${p}</span>` : "");
const fonteLivro = (t, p) => `Malamed, cap. ${t.cap} (p. ${p} do PDF)`;

function htmlItens(itens) {
  let ult = null;
  return itens.map(it => {
    const p = it.p && it.p !== ult ? (ult = it.p) : null;
    const n = it.n ? `<i>${escapar(it.n)}.</i> ` : "";
    return `<li class="pt-n${it.nivel || 0}">${n}${escapar(it.x)}${p ? ` ${pag(p)}` : ""}</li>`;
  }).join("");
}

/** O HTML da ficha da técnica (agulha e volume no alto, o resumo, as figuras e as seções do livro). */
export function fichaHTML(t) {
  const lin = (rot, x) => (x ? `<div class="pt-r"><dt>${rot}</dt><dd>${escapar(x.rot)} ${pag(x.p)}</dd></div>` : "");
  const a = t.agulha, v = t.volume;
  return `<div class="pt-ficha" data-t="${escapar(t.id)}">
    <div class="pt-cab"><h2>${escapar(t.nome)}</h2>
      <small>Malamed, cap. ${t.cap} · p. ${t.paginas[0]}–${t.paginas[1]}${t.recorte ? "" : " · <b>cap. 15 (fora do recorte da prova teórica)</b>"}</small></div>
    <div class="pt-destaque">
      <div class="pt-d pt-agulha"><span>Agulha</span><b>${escapar(a.rot)}</b>
        <p>${escapar(a.texto)} ${pag(a.p)}</p>
        ${a.nota ? `<p class="pt-nota">${escapar(a.nota)} ${pag(a.pNota)}</p>` : ""}
        <small>Comprimento padrão: ${escapar(a.mm)} ${pag(a.pMm)}</small></div>
      <div class="pt-d pt-volume"><span>Volume</span><b>${escapar(v.rot)}</b>
        ${v.tempo ? `<p>${escapar(v.tempo)}</p>` : ""}
        ${v.texto ? `<p class="pt-livro">“${escapar(v.texto)}” ${pag(v.p)}</p>` : `<p>${pag(v.p)}</p>`}</div>
    </div>
    <dl class="pt-resumo">
      ${lin("Inserção", t.insercao)}${lin("Área-alvo", t.alvo)}${lin("Referências", t.referencias)}${lin("Bisel", t.bisel)}
      ${lin("Profundidade", t.prof)}${lin("Aspiração positiva", t.aspiracao)}${lin("Posição", t.posicao)}
    </dl>
    ${t.figuras.length ? `<div class="pt-figs">${t.figuras.map((f, k) => `<figure class="pt-fig" data-k="${k}"><img alt="" loading="lazy" data-src="${escapar(f.src)}"><figcaption>Fig. ${escapar(f.num)} · p. ${f.p}</figcaption></figure>`).join("")}</div>` : ""}
    <nav class="pt-indice">${t.secoes.map((s, k) => `<button data-s="${k}">${escapar(s.titulo.replace(/^Técnica: /, "Técnica · "))}</button>`).join("")}</nav>
    ${t.sobre?.length ? `<details class="pt-sobre"${t.sobre[0].p ? "" : " open"}><summary>${t.sobre[0].p ? "Sobre a técnica (introdução do livro)" : "Atenção"}</summary>${t.sobre.map(s => `<p>${escapar(s.x)} ${pag(s.p)}</p>`).join("")}</details>` : ""}
    ${t.secoes.map((s, k) => `<section class="pt-sec pt-sec-${escapar(s.id)}" data-s="${k}"><h3>${escapar(s.titulo)} ${pag(s.p)}</h3><ul>${htmlItens(s.itens)}</ul></section>`).join("")}
  </div>`;
}

async function porImagem(img, caminho) {
  const u = await urlMidia(caminho);
  img.onerror = () => { img.onerror = null; img.src = `../${caminho}`; };
  img.src = u || `../${caminho}`;
}
const ampliar = (src, legenda) => abrirVisor(src, { legenda, clara: true, classe: "pt-zoom" });
/** Liga as figuras (carregar, ampliar) e o índice das seções da ficha. */
function ligarFicha(el, t, rolo) {
  el.querySelectorAll(".pt-fig").forEach(fg => {
    const f = t.figuras[+fg.dataset.k], img = fg.querySelector("img");
    porImagem(img, f.src);
    fg.onclick = () => ampliar(img.src, `Figura ${f.num}. ${f.leg} (Malamed, p. ${f.p} do PDF)`);
  });
  el.querySelectorAll(".pt-indice button").forEach(b => (b.onclick = () => {
    const s = el.querySelector(`.pt-sec[data-s="${b.dataset.s}"]`);
    if (s && rolo) rolo.scrollTo({ top: s.offsetTop - 8, behavior: "smooth" });
  }));
}
/** A ficha numa folha por cima (sem perder o caso em andamento). */
export function abrirFicha(cam, t) {
  const ov = document.createElement("div"); ov.className = "pt-folha";
  ov.innerHTML = `<div class="pt-folha-topo"><button class="lam-voltar">‹ Voltar ao caso</button></div><div class="pt-folha-corpo">${fichaHTML(t)}</div>`;
  (cam.raiz || document.body).append(ov);
  ligarFicha(ov, t, ov.querySelector(".pt-folha-corpo"));
  ov.querySelector(".lam-voltar").onclick = () => ov.remove();
  return ov;
}

// ---------------------------------------------------------------- o caso
const rotPlano = (p, T) => p.map(id => T[id]?.curto || id).join(" + ");
const dif = (a, b) => a.filter(x => !b.includes(x));

/** Confere a escolha: certo se algum plano aceito está todo nela e o resto são opcionais do caso. */
export function conferirPlano(c, sel) {
  const ok = (p) => p.every(t => sel.includes(t)) && sel.every(t => p.includes(t) || c.opcionais.includes(t));
  const i = c.planos.findIndex(ok);
  if (i >= 0) return { certo: true, i, plano: c.planos[i] };
  // o plano mais perto do que ele escolheu
  let melhor = 0, nota = -1e9;
  c.planos.forEach((p, k) => {
    const n = p.filter(t => sel.includes(t)).length * 2 - dif(sel, [...p, ...c.opcionais]).length - dif(p, sel).length * 0.5;
    if (n > nota) { nota = n; melhor = k; }
  });
  return { certo: false, i: melhor, plano: c.planos[melhor] };
}

function opcoesQuiz(T, t, campo) {
  const todos = Object.values(T).filter(x => x.id !== t.id);
  if (campo === "agulha") {
    const cal = (c) => new Set(String(c).match(/\d+/g) || []);
    const conflita = (a) => (a.comp === t.agulha.comp || a.comp === "curtaOuLonga" || t.agulha.comp === "curtaOuLonga") && [...cal(a.cal)].some(x => cal(t.agulha.cal).has(x));
    const base = [{ comp: "curta", cal: "27" }, { comp: "curta", cal: "25 ou 27" }, { comp: "longa", cal: "25 ou 27" }, { comp: "longa", cal: "30" }, { comp: "curta", cal: "30" }, { comp: "extracurta", cal: "30" }];
    const NOME = { curta: "Curta (≈ 20 mm)", longa: "Longa (≈ 32 mm)", extracurta: "Extracurta" };
    const erradas = embaralhar(base.filter(a => !conflita(a)).map(a => `${NOME[a.comp]}, calibre ${a.cal}`)).filter(x => x !== t.agulha.rot);
    // pelo menos uma do outro comprimento
    erradas.sort((a, b) => (b.startsWith(t.agulha.comp === "longa" ? "Curta" : "Longa") ? 1 : 0) - (a.startsWith(t.agulha.comp === "longa" ? "Curta" : "Longa") ? 1 : 0));
    return [t.agulha.rot, ...erradas.slice(0, 3)];
  }
  if (campo === "volume") {
    const sobrepoe = (v) => v.min <= t.volume.max + 0.05 && v.max >= t.volume.min - 0.05;
    const vistos = new Set([t.volume.rot]);
    const erradas = embaralhar(todos.map(x => x.volume)).filter(v => !sobrepoe(v) && !vistos.has(v.rot) && vistos.add(v.rot)).map(v => v.rot);
    return [t.volume.rot, ...erradas.slice(0, 3)];
  }
  // inserção: de preferência das técnicas do mesmo arco
  const vistos = new Set([t.insercao.rot]);
  const mesmo = embaralhar(todos.filter(x => x.grupo === t.grupo)), outro = embaralhar(todos.filter(x => x.grupo !== t.grupo));
  const erradas = [...mesmo, ...outro].map(x => x.insercao.rot).filter(r => !vistos.has(r) && vistos.add(r));
  return [t.insercao.rot, ...erradas.slice(0, 3)];
}

function etapasDaTecnica(T, t) {
  const botao = `<button class="botao secundario pt-ver" data-t="${escapar(t.id)}">Ver a ficha: ${escapar(t.curto)}</button>`;
  const fCap6 = `Malamed, cap. 6, comprimento das agulhas (p. ${t.agulha.pMm} do PDF)`;
  return [
    { tipo: "agulha", tid: t.id, rotulo: "Agulha", enunciado: `${t.nome}: qual agulha?`, opcoes: opcoesQuiz(T, t, "agulha"), certa: 0,
      explic: `${t.agulha.texto}${t.agulha.nota ? ` ${t.agulha.nota}` : ""} Na prova, diga o calibre E o comprimento.`, fonte: [fonteLivro(t, t.agulha.p), fCap6], extraHtml: botao },
    { tipo: "volume", tid: t.id, rotulo: "Volume", enunciado: `${t.nome}: quanto anestésico?`, opcoes: opcoesQuiz(T, t, "volume"), certa: 0,
      explic: `${t.volume.rot}${t.volume.tempo ? `, ${t.volume.tempo}` : ""}.${t.volume.texto ? ` No livro: “${t.volume.texto}”` : ""} Um tubete tem 1,8 mL: diga o volume e a fração.`, fonte: [fonteLivro(t, t.volume.p)], extraHtml: botao },
    { tipo: "insercao", tid: t.id, rotulo: "Inserção", enunciado: `${t.nome}: onde a agulha entra?`, opcoes: opcoesQuiz(T, t, "insercao"), certa: 0,
      explic: `${t.insercao.texto ? `Área de inserção: ${t.insercao.texto}` : t.insercao.rot}${t.alvo ? ` Área-alvo: ${t.alvo.rot}` : ""}`, fonte: [fonteLivro(t, t.insercao.p)], extraHtml: botao },
  ];
}

function etapaPlano(D, T, c) {
  const grupos = GRUPOS.map(([g, titulo]) => ({ titulo, opcoes: D.tecnicas.filter(t => t.grupo === g).map(t => ({ id: t.id, rot: t.curto })) }));
  return {
    multi: true, tipo: "plano", rotulo: "Técnicas", enunciado: "Quais técnicas você usaria? (pode marcar mais de uma)", grupos,
    avaliar(sel) {
      const r = conferirPlano(c, sel), P = r.plano;
      const outros = c.planos.filter((_, k) => k !== r.i);
      const faltou = dif(P, sel), sobrou = dif(sel, [...P, ...c.opcionais]);
      const marcas = {};
      for (const id of sel) marcas[id] = P.includes(id) || c.opcionais.includes(id) ? "correta" : "incorreta";
      for (const id of faltou) marcas[id] = "faltou";
      // o que ele escolheu e tem comentário no caso (por que não, ou por que sozinho não basta)
      const comentarios = sel.filter(id => c.porque[id] && (!r.certo || !P.includes(id))).map(id => `<p class="cc-porque">${escapar(T[id]?.curto || id)}: ${escapar(c.porque[id])}</p>`).join("");
      const nota = c.notas[String(r.i)];
      const html = `<b>${r.certo ? `Isso! ${escapar(rotPlano(P, T))}` : `Plano esperado: ${escapar(rotPlano(P, T))}`}</b>
        ${!r.certo && faltou.length ? `<p class="cc-porque">Faltou: ${escapar(rotPlano(faltou, T))}</p>` : ""}
        ${!r.certo && sobrou.length ? `<p class="cc-porque">Não entra: ${escapar(rotPlano(sobrou, T))}</p>` : ""}
        ${comentarios}
        ${nota ? `<p class="pt-nota">${escapar(nota)}</p>` : ""}
        <p>${escapar(c.explic)}</p>
        ${outros.length ? `<p class="pt-tambem">Também vale: ${outros.map(p => escapar(rotPlano(p, T))).join(" · ")}</p>` : ""}
        ${c.opcionais.length ? `<p class="pt-tambem">Pode somar sem erro: ${escapar(rotPlano(c.opcionais, T))}</p>` : ""}
        <small class="cc-fonte">${c.fonte.map(escapar).join(" · ")}</small>`;
      // domínio: as técnicas do plano esperado (marcou = acertou a escolha dela) e as que ele pôs sem entrar
      for (const id of P) anotar(est(), id, "plano", sel.includes(id));
      for (const id of sobrou) anotar(est(), id, "plano", false);
      c.resposta = rotPlano(P, T);
      return { certo: r.certo, html, marcas, depois: P.filter(id => T[id]).flatMap(id => etapasDaTecnica(T, T[id])) };
    },
  };
}

export async function jogarPratica(opts = {}) {
  const cam = abrirCamada("Prova Prática");
  const D = await extra("jogo:tecnicas");
  if (!D?.tecnicas?.length || !D.casos?.length) return semConteudo(cam, "As técnicas ainda não chegaram. Sincronize com internet.");
  const S = est();
  const T = Object.fromEntries(D.tecnicas.map(t => [t.id, t]));
  const jogar = (n) => {
    const lista = escolherCasosPratica(D, S, n).map(c => ({ ...c, etapas: [] }));
    for (const c of lista) c.etapas.push(etapaPlano(D, T, c));
    jogarCasos(cam, {
      jogo: "pratica", est: S, lista, rotulo: "Caso", nomes: { plano: "Técnicas", agulha: "Agulha", volume: "Volume", insercao: "Inserção" },
      icone: () => "🧑‍⚕️", faixa: () => "Anestesiologia · prova prática",
      procedimento: (c) => c.procedimento,
      aoResponder: (c, e, certo) => { if (e.tid) anotar(S, e.tid, e.tipo, certo); },
      ligarRetorno: (el) => el?.querySelectorAll(".pt-ver").forEach(b => (b.onclick = () => abrirFicha(cam, T[b.dataset.t]))),
    });
  };
  if (cam.licao || opts.direto) return jogar(opts.quantas || 2);
  if (opts.tecnica && T[opts.tecnica]) return telaFicha(T[opts.tecnica], inicio);
  inicio();

  function inicio() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    const dd = diasAte(D.prova || PROVA_PRATICA);
    const pc = (k) => { const v = acertoItem(S, k); return v == null ? "—" : `${v}%`; };
    const fracas = D.tecnicas.filter(t => t.recorte && S.tecnicas[t.id]).sort((a, b) => fraqueza(S, b.id) - fraqueza(S, a.id)).slice(0, 4);
    cam.corpo.innerHTML = `<div class="lam pt-inicio">
      <div class="lam-cab"><div class="lam-cont gal"><b>${D.casos.length}</b><small>casos</small></div>
        <div><h2>Prova Prática</h2><small>Malamed · Manual de Anestesia Local · ${D.tecnicas.length} técnicas</small></div></div>
      ${dd >= 0 ? `<p class="pt-prova">${dd === 0 ? "A prova prática é hoje" : dd === 1 ? "A prova prática é amanhã" : `Prova prática em ${dd} dias`} (18/11, logo depois da teórica). Em cada técnica: <b>agulha</b> (calibre e comprimento) e <b>volume</b>.</p>` : ""}
      <div class="pt-dominio"><div><b>${pc("agulha")}</b><small>agulha</small></div><div><b>${pc("volume")}</b><small>volume</small></div><div><b>${pc("insercao")}</b><small>inserção</small></div><div><b>${pc("plano")}</b><small>escolha</small></div></div>
      ${fracas.length ? `<div class="pt-fracas"><small>Para rever:</small>${fracas.map(t => `<button class="pt-chip-t" data-t="${t.id}">${escapar(t.curto)}</button>`).join("")}</div>` : ""}
      <div class="lam-modos">
        <button class="lam-modo" data-m="caso"><b>Prova prática</b><small>5 casos: quais técnicas, e de cada uma a agulha, o volume e onde a agulha entra</small></button>
        <button class="lam-modo" data-m="fichas"><b>Consultar as técnicas</b><small>A ficha de cada técnica, na ordem do Malamed, com as figuras</small></button>
        <button class="lam-modo" data-m="ref"><b>Tabelas do livro</b><small>Agulhas, volumes, técnicas por dente, aspiração, infecção e coagulopatia</small></button>
      </div></div>`;
    cam.corpo.querySelectorAll(".lam-modo").forEach(b => (b.onclick = () => {
      tocar("toque");
      if (b.dataset.m === "caso") jogar(5);
      else if (b.dataset.m === "fichas") lista();
      else telaConsulta(cam, "Do Malamed", D.referencia, inicio);
    }));
    cam.corpo.querySelectorAll(".pt-chip-t").forEach(b => (b.onclick = () => telaFicha(T[b.dataset.t], inicio)));
  }

  function lista() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam pt-lista"><button class="lam-voltar">‹ Voltar</button><h2>Técnicas</h2>
      ${GRUPOS.map(([g, titulo]) => `<h3>${escapar(titulo)}</h3>${D.tecnicas.filter(t => t.grupo === g).map(t => {
        const f = S.tecnicas[t.id] ? fraqueza(S, t.id) : null;
        return `<button class="pt-linha" data-t="${t.id}"><span><b>${escapar(t.nome)}</b><small>${escapar(t.agulha.rot)} · ${escapar(t.volume.rot)}</small></span>${f == null ? "" : `<em class="${f > 0.5 ? "fraca" : "boa"}">${Math.round((1 - f) * 100)}%</em>`}</button>`;
      }).join("")}`).join("")}</div>`;
    cam.corpo.querySelector(".lam-voltar").onclick = inicio;
    cam.corpo.querySelectorAll(".pt-linha").forEach(b => (b.onclick = () => telaFicha(T[b.dataset.t], lista)));
  }

  function telaFicha(t, voltar) {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam pt-tela"><button class="lam-voltar">‹ Voltar</button>${fichaHTML(t)}</div>`;
    cam.corpo.querySelector(".lam-voltar").onclick = voltar;
    ligarFicha(cam.corpo, t, cam.corpo);
  }
}

/** Cartão para a aba Provas da trilha (até o dia da prova prática). */
export async function cartaoPratica(P) {
  const dd = diasAte(PROVA_PRATICA);
  if (dd < 0) return;
  const S = est(), ag = acertoItem(S, "agulha"), vo = acertoItem(S, "volume");
  const el = document.createElement("button"); el.className = "lam-cartao pt-cartao";
  el.innerHTML = `<span class="lam-c-ico">🧑‍⚕️</span><span class="lam-c-tx"><b>Prova Prática de Anestesio</b><small>${dd === 0 ? "Hoje" : dd === 1 ? "Amanhã" : `Em ${dd} dias`}, logo depois da teórica · ${ag == null ? "caso → técnicas → agulha e volume" : `agulha ${ag}% · volume ${vo ?? "—"}%`}</small></span><span class="lam-c-ir">›</span>`;
  el.onclick = () => jogarPratica();
  P.append(el);
}
