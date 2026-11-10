// Aparência comum a todas as variações do Órbita (02/11/2026, pedido do Alediov: "quero que todos os planos de fundo e
// animações de fundo sejam compartilhados entre todas as variações de app que temos e teremos. No momento, são só o
// Órbita e o Scanner"). Sem dependências do app: vai no Órbita (aparencia.js, que guarda a escolha no config e cuida
// das camadas) e no OdontoScan.html do computador (tools/montar_odontoscan.py, escolha no localStorage dele).
//
// Para uma variação nova (outro arquivo avulso, outro subapp):
//   1. o CSS do app/aparencia.css (o montador do arquivo avulso junta o CSS dele; no Órbita vai pelo index.html);
//   2. `iniciarAparenciaAvulsa(raiz, { chave })` ao abrir (lê o localStorage, põe o tema no <html> e o fundo e as
//      partículas em `raiz`), e um botão que chama `abrirAparenciaAvulsa(raiz, { chave })`;
//   3. a raiz precisa de `--fundo-solido` (a cor lisa do tema dela) e de `isolation: isolate` (o canvas das partículas
//      fica com z-index −1, atrás do conteúdo e na frente do fundo).
// Num app com várias áreas (o Órbita), `aplicarAparencia(raiz, visual, { ativo })` em cada raiz e `htmlFolha` +
// `ligarFolha` dentro do modal dele (com `porArea`: a escolha por subapp).
//
// A escolha: { tema: "auto" | "claro" | "escuro", visual: { fundo, animado, tipos }, visualArea: { <área>: {…} } }.
// `animado` liga ou desliga as partículas; `tipos` são os ids de PARTICULAS (pelo menos um; padrão só bolhas). Até
// 02/11/2026 era `bolhas: true | false` (lido como `animado`).
import { PARTICULAS, TIPOS_PADRAO, tiposValidos, svgParticula, ligarParticulas, desligarParticulas } from "./particulas.js";

export const FUNDOS = [
  { id: "liso", nome: "Liso" },
  { id: "marionetes", nome: "Marionetes", arq: "fundos/marionetes.webp", mini: "fundos/marionetes-mini.webp" },
  { id: "trono", nome: "Trono", arq: "fundos/trono.webp", mini: "fundos/trono-mini.webp" },
  { id: "relogio", nome: "Relógio", arq: "fundos/relogio.webp", mini: "fundos/relogio-mini.webp" },
  { id: "porto", nome: "Porto", arq: "fundos/porto.webp", mini: "fundos/porto-mini.webp" },
];
export const TEMAS = [["auto", "Automático"], ["claro", "Claro"], ["escuro", "AMOLED"]];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const base = () => (typeof document !== "undefined" ? document.baseURI : "http://x/");

/** O endereço da imagem (no arquivo avulso, a imagem embutida em globalThis.__FUNDOS). */
export function urlFundo(f, mini = false) {
  if (!f?.arq) return "";
  const emb = globalThis.__FUNDOS?.[f.id];
  if (emb) return emb;
  return new URL(mini ? f.mini || f.arq : f.arq, base()).href;
}

/** O que vale: a escolha geral `g` e, por cima, a da área `a`. */
export function resolverVisual(g = {}, a = {}) {
  g ||= {}; a ||= {};
  const animado = a.animado ?? a.bolhas ?? g.animado ?? g.bolhas ?? true;
  const tipos = tiposValidos(Array.isArray(a.tipos) && a.tipos.length ? a.tipos : g.tipos);
  return { fundo: a.fundo || g.fundo || "liso", animado: !!animado, tipos };
}
/** Passa `bolhas` (o nome antigo) para `animado` num registro da escolha. Devolve se mudou. */
export function migrarVisual(v) {
  if (!v || !("bolhas" in v)) return false;
  if (!("animado" in v) && typeof v.bolhas === "boolean") v.animado = v.bolhas;
  delete v.bolhas;
  return true;
}

/** Põe o tema no <html> ("auto" tira). */
export function aplicarTema(tema) {
  if (!tema || tema === "auto") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
}

/**
 * Aplica o fundo e as partículas em `raiz`: `.com-imagem` (+ `--fundo-img`) ou `.sem-imagem`, `data-bolhas`
 * ("sim" | "nao": as partículas ligadas) e `data-particulas` (os tipos). Com `particulas` (padrão), liga o canvas em
 * `alvo` (padrão: a própria raiz) com `ativo()` (se a área está à vista) e a `classe` do canvas.
 */
export function aplicarAparencia(raiz, v, { ativo = null, particulas = true, alvo = null, classe = "orb-bolhas" } = {}) {
  if (!raiz) return;
  v = v?.tipos ? v : resolverVisual(v);
  const f = FUNDOS.find(x => x.id === v.fundo && x.arq);
  raiz.classList.toggle("com-imagem", !!f);
  raiz.classList.toggle("sem-imagem", !f);
  if (f) { raiz.style.setProperty("--fundo-img", `url("${urlFundo(f)}")`); raiz.dataset.fundo = f.id; }
  else { raiz.style.removeProperty("--fundo-img"); delete raiz.dataset.fundo; }
  raiz.dataset.bolhas = v.animado ? "sim" : "nao";
  raiz.dataset.particulas = v.tipos.join(",");
  if (!particulas) return;
  const a = alvo || raiz;
  if (v.animado) ligarParticulas(a, { ativo, classe, tipos: v.tipos }); else desligarParticulas(a);
}

// ---------- a folha ----------
// `area`: os chips de um subapp (data-part-area = a área, data-tipo = o tipo); sem ela, os de todos (data-part = o tipo)
const chips = (tipos, area = null) => PARTICULAS.map(p => `<button type="button" class="ap-part ${tipos.includes(p.id) ? "on" : ""}" ${area ? `data-part-area="${area}" data-tipo="${p.id}"` : `data-part="${p.id}"`} aria-pressed="${tipos.includes(p.id)}" title="${esc(p.nome)}">${svgParticula(p.id)}<small>${esc(p.nome)}</small></button>`).join("");

/** O HTML da folha. `est`: a escolha; `porArea`: [[id, nome], …] para a seção "Por subapp" (ou nada). */
export function htmlFolha(est, { porArea = null, sub = "Vale para todos os subapps. Embaixo, dá para escolher outro fundo só num deles." } = {}) {
  const g = est.visual || {}, v = resolverVisual(g), va = est.visualArea || {};
  const tile = (f) => `<button type="button" class="ap-tile ${f.id === v.fundo ? "on" : ""}" data-fundo="${f.id}" aria-pressed="${f.id === v.fundo}">${f.arq ? `<img src="${urlFundo(f, true)}" alt="" loading="lazy">` : `<span class="ap-liso"></span>`}<small>${esc(f.nome)}</small></button>`;
  const opcoesFundo = (x) => [["", "Igual"], ...FUNDOS.map(f => [f.id, f.nome])].map(([id, n]) => `<option value="${id}" ${(x || "") === id ? "selected" : ""}>${n}</option>`).join("");
  const modoArea = (o = {}) => { const an = o.animado ?? o.bolhas; return an === false ? "nao" : o.tipos?.length ? "escolher" : an === true ? "sim" : ""; };
  const opcoesPart = (o) => [["", "Igual"], ["nao", "Sem partículas"], ["sim", "Com as de todos"], ["escolher", "Escolher…"]].map(([id, n]) => `<option value="${id}" ${modoArea(o) === id ? "selected" : ""}>${n}</option>`).join("");
  return `<div class="ap">
    <h2>Aparência</h2>
    ${sub ? `<p class="sub ap-sub">${esc(sub)}</p>` : ""}
    <h3>Tema</h3>
    <div class="ap-seg" role="group" aria-label="Tema">${TEMAS.map(([id, n]) => `<button type="button" data-tema="${id}" class="${(est.tema || "auto") === id ? "on" : ""}">${n}</button>`).join("")}</div>
    <h3>Fundo</h3>
    <div class="ap-tiles">${FUNDOS.map(tile).join("")}</div>
    <div class="ap-linha"><span>Partículas animadas<small>Sobem (ou caem) devagar no fundo; somem com "reduzir movimento"</small></span><button type="button" class="chave ap-chave ${v.animado ? "on" : ""}" data-animado role="switch" aria-checked="${v.animado}" aria-label="Partículas animadas"></button></div>
    <div class="ap-parts-cab ${v.animado ? "" : "desligadas"}"><b>Quais aparecem</b><button type="button" class="ap-todas" data-todas>${v.tipos.length === PARTICULAS.length ? "Só bolhas" : "Todas"}</button></div>
    <div class="ap-parts ${v.animado ? "" : "desligadas"}" role="group" aria-label="Partículas">${chips(v.tipos)}</div>
    <p class="ap-nota">A quantidade não muda: os tipos escolhidos se revezam.</p>
    ${porArea ? `<details class="ap-areas"><summary>Por subapp</summary>
      ${porArea.map(([a, n]) => `<div class="ap-area" data-area="${a}"><b>${esc(n)}</b><select data-area-fundo="${a}" aria-label="Fundo de ${esc(n)}">${opcoesFundo(va[a]?.fundo)}</select><select data-area-part="${a}" aria-label="Partículas de ${esc(n)}">${opcoesPart(va[a])}</select>
        <div class="ap-parts mini" data-area-tipos="${a}" ${modoArea(va[a]) === "escolher" ? "" : "hidden"}>${chips(tiposValidos(va[a]?.tipos?.length ? va[a].tipos : v.tipos), a)}</div></div>`).join("")}
    </details>` : ""}
  </div>`;
}

/** Liga a folha já posta em `el`. Muda `est` e chama `aoMudar(est)`; `aoTema(tema)` quando o tema muda. */
export function ligarFolha(el, est, { aoMudar = () => {}, aoTema = null } = {}) {
  const visual = () => (est.visual ||= {});
  const marcar = (bs) => bs.forEach(([b, v]) => { b.classList.toggle("on", v); b.setAttribute("aria-pressed", String(v)); });
  el.querySelectorAll("[data-tema]").forEach(b => (b.onclick = () => {
    est.tema = b.dataset.tema; el.querySelectorAll("[data-tema]").forEach(x => x.classList.toggle("on", x === b));
    aplicarTema(est.tema); aoTema?.(est.tema); aoMudar(est);
  }));
  el.querySelectorAll("[data-fundo]").forEach(b => (b.onclick = () => {
    visual().fundo = b.dataset.fundo;
    marcar([...el.querySelectorAll("[data-fundo]")].map(x => [x, x === b]));
    aoMudar(est);
  }));
  const chave = el.querySelector("[data-animado]");
  const pintarAnimado = (on) => {
    chave.classList.toggle("on", on); chave.setAttribute("aria-checked", String(on));
    el.querySelectorAll(":scope .ap > .ap-parts, :scope .ap > .ap-parts-cab").forEach(x => x.classList.toggle("desligadas", !on));
  };
  chave.onclick = (e) => { e.preventDefault(); migrarVisual(visual()); const on = !resolverVisual(visual()).animado; visual().animado = on; pintarAnimado(on); aoMudar(est); };
  const pintarTipos = () => {
    const t = resolverVisual(visual()).tipos;
    marcar([...el.querySelectorAll("[data-part]")].map(b => [b, t.includes(b.dataset.part)]));
    const td = el.querySelector("[data-todas]"); if (td) td.textContent = t.length === PARTICULAS.length ? "Só bolhas" : "Todas";
  };
  el.querySelectorAll("[data-part]").forEach(b => (b.onclick = () => {
    const t = new Set(resolverVisual(visual()).tipos), id = b.dataset.part;
    if (t.has(id)) { if (t.size === 1) { b.classList.remove("treme"); void b.offsetWidth; b.classList.add("treme"); return; } t.delete(id); } else t.add(id);
    visual().tipos = tiposValidos([...t]);
    if (!resolverVisual(visual()).animado) { visual().animado = true; pintarAnimado(true); }
    pintarTipos(); aoMudar(est);
  }));
  const td = el.querySelector("[data-todas]");
  if (td) td.onclick = () => {
    const todas = resolverVisual(visual()).tipos.length === PARTICULAS.length;
    visual().tipos = todas ? [...TIPOS_PADRAO] : PARTICULAS.map(p => p.id);
    if (!resolverVisual(visual()).animado) { visual().animado = true; pintarAnimado(true); }
    pintarTipos(); aoMudar(est);
  };
  // por subapp
  const daArea = (a, f) => { const va = (est.visualArea ||= {}), o = { ...(va[a] || {}) }; migrarVisual(o); f(o); if (Object.keys(o).length) va[a] = o; else delete va[a]; aoMudar(est); };
  el.querySelectorAll("[data-area-fundo]").forEach(s => (s.onchange = () => daArea(s.dataset.areaFundo, o => { if (s.value) o.fundo = s.value; else delete o.fundo; })));
  el.querySelectorAll("[data-area-part]").forEach(s => (s.onchange = () => {
    const a = s.dataset.areaPart, caixa = el.querySelector(`[data-area-tipos="${a}"]`);
    if (caixa) caixa.hidden = s.value !== "escolher";
    daArea(a, o => {
      delete o.tipos; delete o.animado;
      if (s.value === "nao") o.animado = false;
      else if (s.value === "sim") o.animado = true;
      else if (s.value === "escolher") { o.animado = true; o.tipos = tiposValidos([...caixa.querySelectorAll(".ap-part.on")].map(b => b.dataset.tipo)); }
    });
  }));
  el.querySelectorAll("[data-part-area]").forEach(b => (b.onclick = () => {
    const a = b.dataset.partArea, caixa = b.closest("[data-area-tipos]");
    const on = !b.classList.contains("on");
    if (!on && caixa.querySelectorAll(".ap-part.on").length === 1) return;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
    daArea(a, o => { o.animado = true; o.tipos = tiposValidos([...caixa.querySelectorAll(".ap-part.on")].map(x => x.dataset.tipo)); });
  }));
}

// ---------- variações avulsas (o OdontoScan.html; as que vierem) ----------
const lerAvulsa = (chave) => { try { return JSON.parse(localStorage.getItem(chave) || "null") || {}; } catch { return {}; } };
const gravarAvulsa = (chave, est) => { try { localStorage.setItem(chave, JSON.stringify({ tema: est.tema || "auto", visual: est.visual || {} })); } catch { /* sem armazenamento */ } };

/** Ao abrir uma variação avulsa: tema no <html>, fundo e partículas em `raiz`. `aoAplicar(raiz)`: depois de aplicar
 *  (o OdontoScan liga as partículas dele pelo `data-particulas`, com `particulas: false`). */
export function iniciarAparenciaAvulsa(raiz, { chave = "orbita.aparencia", particulas = true, aoAplicar = null } = {}) {
  const est = lerAvulsa(chave);
  aplicarTema(est.tema);
  aplicarAparencia(raiz, resolverVisual(est.visual), { particulas });
  aoAplicar?.(raiz);
  return est;
}

/** A folha numa caixa própria, dentro de `raiz` (sem o modal do app). */
export function abrirAparenciaAvulsa(raiz, { chave = "orbita.aparencia", particulas = true, aoAplicar = null } = {}) {
  raiz.querySelector(":scope > .ap-avulsa")?.remove();
  const est = lerAvulsa(chave);
  const d = document.createElement("div");
  d.className = "ap-avulsa";
  d.innerHTML = `<div class="ap-avulsa-caixa" role="dialog" aria-modal="true" aria-label="Aparência">${htmlFolha(est, { sub: "O tema, o fundo e as partículas, iguais aos do Órbita. Ficam guardados neste navegador." })}<button type="button" class="ap-pronto">Pronto</button></div>`;
  raiz.append(d);
  const fechar = () => { d.classList.add("saindo"); setTimeout(() => d.remove(), 180); };
  d.querySelector(".ap-pronto").onclick = fechar;
  d.addEventListener("click", (e) => { if (e.target === d) fechar(); });
  d.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
  ligarFolha(d, est, { aoMudar: (e) => { migrarVisual(e.visual); gravarAvulsa(chave, e); aplicarAparencia(raiz, resolverVisual(e.visual), { particulas }); aoAplicar?.(raiz); } });
  setTimeout(() => d.querySelector(".ap-pronto")?.focus(), 60);
  return d;
}
