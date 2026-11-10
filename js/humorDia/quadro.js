// O quadro do humor (pedido do Alediov, 04/11/2026): 4 cantos (energia alta/baixa × desagradável/agradável), 4 emojis
// com nome em cada um, e depois uma etiqueta opcional (chips sugeridos ou escrita) e um texto curto. Sem nota e sem
// escala: o que fica guardado é o emoji (humorDia.js).
//
// Para embutir (a Eva põe no chat): `el.innerHTML = htmlQuadro({ compacto: true })` e `ligarQuadro(el, { aoEscolher })`.
// Para usar sozinho (Estatísticas das Músicas, "Registrar como estou agora"): `await abrirQuadroHumor()` abre uma folha
// por cima de tudo e resolve com o registro salvo (ou null se ele fechar).
import { HUMORES, QUADRANTES, ETIQUETAS, MAX_ETIQUETAS, MAX_TEXTO, humor, limparEtiqueta } from "./humores.js";
import { registrarHumor, etiquetasUsadas } from "./humorDia.js";
import { icone } from "../icones.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

export function garantirCss() {
  if (typeof document === "undefined") return Promise.resolve();
  const ja = document.querySelector('link[href="humorDia.css"]');
  if (ja) return ja._pronto || Promise.resolve();
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "humorDia.css";
  l._pronto = new Promise((ok) => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  document.head.append(l);
  return l._pronto;
}

/** Só o emoji em 3D (ou o próprio emoji, sem o ícone). */
export const emojiHTML = (id, classe = "hd-ico") => { const h = humor(id); return h ? icone(h.emoji, classe) : ""; };

/**
 * O HTML do quadro. `opcoes`: { pergunta ("Como você está agora?"), compacto (menor, para o chat), etiquetas (true:
 * mostra o 2º passo com etiqueta e texto; false: escolher o emoji já termina) }.
 */
export function htmlQuadro({ pergunta = "Como você está agora?", compacto = false, etiquetas = true } = {}) {
  garantirCss();
  const canto = (q) => `<div class="hd-q" data-q="${q.id}" style="--q:${q.cor}" role="group" aria-label="${esc(q.nome)}">
    ${HUMORES.filter(h => h.quadrante === q.id).map(h => `<button type="button" class="hd-h" data-h="${h.id}" aria-label="${esc(h.nome)}">${icone(h.emoji, "hd-ico")}<small>${esc(h.nome)}</small></button>`).join("")}
  </div>`;
  return `<div class="hd-quadro${compacto ? " compacto" : ""}" data-etiquetas="${etiquetas ? "sim" : "nao"}">
    ${pergunta ? `<p class="hd-perg">${esc(pergunta)}</p>` : ""}
    <div class="hd-passo1">
      <div class="hd-eixo-y"><span>Mais energia</span><span>Menos energia</span></div>
      <div class="hd-grade">${QUADRANTES.map(canto).join("")}</div>
      <div class="hd-eixo-x"><span>Desagradável</span><span>Agradável</span></div>
    </div>
    <div class="hd-passo2" hidden>
      <div class="hd-escolhido"></div>
      <p class="hd-sub">Algo a ver com isso? <small>(opcional)</small></p>
      <div class="hd-chips"></div>
      <div class="hd-outra"><input type="text" class="hd-nova" maxlength="24" placeholder="Outra etiqueta" aria-label="Outra etiqueta" enterkeyhint="done"><button type="button" class="hd-mais" aria-label="Pôr a etiqueta">+</button></div>
      <input type="text" class="hd-texto" maxlength="${MAX_TEXTO}" placeholder="Uma frase curta (opcional)" aria-label="Uma frase curta" enterkeyhint="done">
      <div class="hd-acoes"><button type="button" class="botao secundario" data-a="voltar">Trocar</button><button type="button" class="botao" data-a="salvar">Salvar</button></div>
    </div>
  </div>`;
}

/**
 * Liga o quadro posto em `el`. `aoEscolher(registro)`: chamado ao salvar (com o registro gravado, se `registrar`, ou
 * { id, etiquetas, texto } se não). `registrar` (padrão true): grava em E().humorDia. `quando`: ms do registro. `msg`:
 * o id da pergunta da Eva que ele está respondendo (fica no registro).
 * Devolve { limpar() } (volta ao 1º passo).
 */
export function ligarQuadro(el, { aoEscolher, registrar = true, quando, msg } = {}) {
  const raiz = el.matches?.(".hd-quadro") ? el : el.querySelector(".hd-quadro");
  if (!raiz) throw new Error("ligarQuadro: o quadro não está em el");
  const comEtiquetas = raiz.dataset.etiquetas !== "nao";
  const p1 = raiz.querySelector(".hd-passo1"), p2 = raiz.querySelector(".hd-passo2");
  const chips = raiz.querySelector(".hd-chips"), nova = raiz.querySelector(".hd-nova"), texto = raiz.querySelector(".hd-texto");
  let escolhido = null, marcadas = new Set(), feito = false;
  const sugeridas = () => { let u = []; try { u = etiquetasUsadas(); } catch { /* sem estado */ } return [...new Set([...u.slice(0, 6), ...ETIQUETAS, ...marcadas])]; };
  const pintarChips = () => {
    chips.innerHTML = sugeridas().map(e => `<button type="button" class="hd-chip${marcadas.has(e) ? " on" : ""}" data-e="${esc(e)}" aria-pressed="${marcadas.has(e)}">${esc(e)}</button>`).join("");
  };
  const concluir = () => {
    if (feito || !escolhido) return;
    feito = true;
    const dados = { id: escolhido, etiquetas: [...marcadas], texto: texto?.value || "" };
    let reg = dados;
    if (registrar) reg = registrarHumor({ ...dados, ...(quando ? { quando } : {}), ...(msg ? { msg } : {}) });
    raiz.classList.add("salvo");
    raiz.querySelectorAll("button, input").forEach(b => { b.disabled = true; });
    const h = humor(escolhido);
    p2.hidden = true; p1.hidden = true;
    raiz.insertAdjacentHTML("beforeend", `<p class="hd-ok">${icone(h.emoji, "hd-ico")}<span>${esc(h.nome)}${marcadas.size ? ` · ${[...marcadas].map(esc).join(", ")}` : ""}</span></p>`);
    aoEscolher?.(reg);
  };
  const escolher = (id) => {
    escolhido = id;
    raiz.querySelectorAll(".hd-h").forEach(b => b.classList.toggle("on", b.dataset.h === id));
    if (!comEtiquetas) return concluir();
    const h = humor(id), q = QUADRANTES.find(x => x.id === h.quadrante);
    raiz.querySelector(".hd-escolhido").innerHTML = `${icone(h.emoji, "hd-ico")}<span><b>${esc(h.nome)}</b><small style="color:${q.cor}">${esc(q.nome)}</small></span>`;
    p1.hidden = true; p2.hidden = false;
    pintarChips();
  };
  const porNova = () => {
    const e = limparEtiqueta(nova.value); nova.value = "";
    if (!e) return;
    if (marcadas.size < MAX_ETIQUETAS) marcadas.add(e);
    pintarChips();
  };
  raiz.addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b || !raiz.contains(b) || b.disabled) return;
    if (b.dataset.h) escolher(b.dataset.h);
    else if (b.dataset.e) { const e = b.dataset.e; if (marcadas.has(e)) marcadas.delete(e); else if (marcadas.size < MAX_ETIQUETAS) marcadas.add(e); pintarChips(); }
    else if (b.classList.contains("hd-mais")) porNova();
    else if (b.dataset.a === "voltar") { p2.hidden = true; p1.hidden = false; }
    else if (b.dataset.a === "salvar") concluir();
  });
  nova?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); porNova(); } });
  texto?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); concluir(); } });
  return {
    limpar() { escolhido = null; marcadas = new Set(); feito = false; raiz.classList.remove("salvo"); raiz.querySelector(".hd-ok")?.remove(); raiz.querySelectorAll("button, input").forEach(b => { b.disabled = false; }); if (texto) texto.value = ""; p1.hidden = false; p2.hidden = true; raiz.querySelectorAll(".hd-h.on").forEach(b => b.classList.remove("on")); },
  };
}

/** A folha própria (por cima de qualquer área). Resolve com o registro salvo ou null. */
export async function abrirQuadroHumor({ pergunta = "Como você está agora?", titulo = "Seu humor" } = {}) {
  await garantirCss();
  return new Promise((ok) => {
    const fundo = document.createElement("div"); fundo.className = "hd-fundo";
    fundo.innerHTML = `<div class="hd-folha" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="hd-alca"></div>
      <div class="hd-topo"><b>${esc(titulo)}</b><button type="button" class="hd-fechar" aria-label="Fechar">×</button></div>
      ${htmlQuadro({ pergunta })}</div>`;
    document.body.append(fundo);
    requestAnimationFrame(() => fundo.classList.add("aberto"));
    let resultado = null;
    const fechar = () => { fundo.classList.remove("aberto"); setTimeout(() => fundo.remove(), 220); ok(resultado); };
    fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });
    fundo.querySelector(".hd-fechar").onclick = fechar;
    ligarQuadro(fundo, { aoEscolher: (r) => { resultado = r; setTimeout(fechar, 650); } });
  });
}
