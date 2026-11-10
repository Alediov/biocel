// Ferramentas das lições (pedido do Alediov, 02/11/2026): calculadora, caderno, marca-texto e caneta em TODOS os
// exercícios. Uma barrinha logo abaixo do topo da lição:
//  - Calculadora: uma operação por vez (um operador depois de outro TROCA o anterior; o "-" de número negativo só no
//    começo). A mesma calculadora serve aos minijogos de dose (jogos.js, `montarCalculadora`/`calcular`).
//  - Caderno: um texto da SESSÃO (manhã, tarde, noite, extra, treino; nos jogos, o jogo), que fica entre os
//    exercícios e as lições da mesma sessão e some no dia seguinte (localStorage `orbita.cadernoLicoes`).
//  - Marca-texto: com o modo ligado, tocar numa palavra ou arrastar sobre o texto (enunciado, opções, explicação,
//    resumo) marca em amarelo ou sublinha; tocar numa marca a tira. Com o modo ligado o toque não escolhe opção.
//    As marcas usam a CSS Custom Highlight API (não mexem no DOM dos exercícios) e voltam se o exercício voltar.
//  - Caneta: uma camada de desenho (canvas) por cima do exercício, que rola junto. A caneta (e o mouse) desenha; o
//    dedo desenha só enquanto o app nunca viu uma caneta neste aparelho (depois, o dedo rola e toca nas opções);
//    o botão ✋ troca. Cores, borracha, desfazer e limpar; os traços ficam guardados por exercício na sessão.
//    O botão aparece no tablet (`html.tablet`), depois de usar uma caneta, ou sempre/nunca pela preferência
//    `config.canetaLicoes` ("auto" | "sempre" | "nunca", Perfil → Preferências).
// Com o zoom do tablet (`--z`), as coordenadas são convertidas pela razão entre o retângulo na tela e o tamanho CSS.
import { E, hojeISO } from "./estado.js";
import { tocar } from "./sons.js";

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const ls = {
  ler(k, pad) { try { const v = localStorage.getItem(k); return v == null ? pad : JSON.parse(v); } catch { return pad; } },
  gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};

const SVG = {
  calc: `<svg viewBox="0 0 24 24"><rect x="5" y="2.5" width="14" height="19" rx="3"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/></svg>`,
  caderno: `<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M4 7h4M4 12h4M4 17h4M10 8h6M10 12h6"/></svg>`,
  marca: `<svg viewBox="0 0 24 24"><path d="m14.5 4.5 5 5-8 8-5 0 0-5z"/><path d="M6.5 12.5l5 5M4 21h8"/></svg>`,
  caneta: `<svg viewBox="0 0 24 24"><path d="M15.5 4.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M13.5 6.5l3 3"/></svg>`,
  borracha: `<svg viewBox="0 0 24 24"><path d="m7 21-4-4 10-10 6 6-7 8z"/><path d="M13 21h8M9 11l6 6"/></svg>`,
  desfazer: `<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`,
  lixo: `<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  dedo: `<svg viewBox="0 0 24 24"><path d="M9 11V5a1.5 1.5 0 0 1 3 0v5M12 10V3.5a1.5 1.5 0 0 1 3 0V10M15 10V5a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.8-2.4L3 14.5a1.6 1.6 0 0 1 2.4-2L9 15"/></svg>`,
  x: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
};

// ======================= calculadora =======================
const OPS = "+-×÷";
/** Avalia "36×6+2" (vírgula decimal, × e ÷ antes de + e −; "-" no começo é número negativo). null se não der. */
export function calcular(expr) {
  const toks = String(expr).replace(/,/g, ".").match(/\d+(?:\.\d+)?|\.\d+|[+\-×÷]/g) || [];
  const nums = [], ops = [], prec = { "+": 1, "-": 1, "×": 2, "÷": 2 };
  const aplica = () => { const b = nums.pop(), a = nums.pop(), o = ops.pop(); nums.push(o === "+" ? a + b : o === "-" ? a - b : o === "×" ? a * b : a / b); };
  let espera = true;
  for (const t of toks) {
    if (/\d/.test(t)) { nums.push(parseFloat(t)); espera = false; }
    else if (espera && t === "-") nums.push(0), ops.push("-");
    else { while (ops.length && prec[ops.at(-1)] >= prec[t]) aplica(); ops.push(t); espera = true; }
  }
  while (ops.length && nums.length >= 2) aplica();
  const r = nums.pop();
  return Number.isFinite(r) ? r : null;
}
const fmtNum = (r) => String(Math.round(r * 1e6) / 1e6).replace(".", ",");
/** Estado puro da calculadora: { e, hist, pronto } + tecla → novo estado. Um operador depois de outro troca o
 *  anterior; "-" só abre um número negativo no começo; uma vírgula por número; depois do "=", um dígito começa de
 *  novo e um operador continua do resultado. */
export function teclarCalc(st, k) {
  let { e = "", hist = "", pronto = false } = st || {};
  const ult = e.slice(-1);
  if (k === "C") return { e: "", hist: "", pronto: false };
  if (k === "⌫") return { e: pronto ? "" : e.slice(0, -1), hist, pronto: false };
  if (/^\d$/.test(k)) {
    if (pronto) return { e: k, hist, pronto: false };
    if (/(^|[+\-×÷])0$/.test(e)) return { e: e.slice(0, -1) + k, hist, pronto: false }; // "07" → "7"
    return { e: e + k, hist, pronto: false };
  }
  if (k === ",") {
    if (pronto || e === "") return { e: "0,", hist, pronto: false };
    if (e.split(/[+\-×÷]/).pop().includes(",")) return { e, hist, pronto }; // uma vírgula por número
    if (OPS.includes(ult)) return { e: e + "0,", hist, pronto: false };
    return { e: e + ",", hist, pronto: false };
  }
  if (OPS.includes(k)) {
    if (e === "" || e === "-") return { e: k === "-" ? "-" : e, hist, pronto: false };
    let base = e;
    if (base.endsWith(",")) base = base.slice(0, -1);
    if (OPS.includes(base.slice(-1))) base = base.slice(0, -1); // troca o operador anterior
    if (base === "" || base === "-") return { e: k === "-" ? "-" : "", hist, pronto: false };
    return { e: base + k, hist, pronto: false };
  }
  if (k === "=") {
    let x = e.replace(/[,+\-×÷]+$/, "");
    if (!x || x === "-") return { e, hist, pronto };
    const r = calcular(x);
    if (r == null) return { e: "", hist: "Não dá para dividir por zero", pronto: true };
    return { e: fmtNum(r), hist: `${mostrarExpr(x)} =`, pronto: true };
  }
  return { e, hist, pronto };
}
const mostrarExpr = (e) => (e || "0").replace(/(?!^)([+\-×÷])/g, " $1 ").replace(/\s+/g, " ").trim().replace(/-/g, "−");

const TECLAS = ["C", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", ","];
/** Monta o visor e o teclado (classes .calc-* do estilo.css) em `raiz`. `mem` guarda a conta entre um abrir e outro
 *  do painel (o mesmo objeto na lição ou no jogo inteiro). Devolve { teclar(k), expr() }. */
export function montarCalculadora(raiz, mem = {}) {
  raiz.innerHTML = `<div class="calc-visor"><small class="calc-hist"></small><span class="calc-expr">0</span></div><div class="calc-teclas"></div>`;
  const exprEl = raiz.querySelector(".calc-expr"), histEl = raiz.querySelector(".calc-hist"), tec = raiz.querySelector(".calc-teclas");
  let st = mem.st || { e: "", hist: "", pronto: false };
  const mostrar = () => {
    exprEl.textContent = mostrarExpr(st.e);
    histEl.textContent = st.hist;
    exprEl.scrollLeft = exprEl.scrollWidth;
  };
  const teclar = (k) => { st = mem.st = teclarCalc(st, k); mostrar(); };
  for (const k of TECLAS) {
    const b = el("button", `calc-k ${OPS.includes(k) ? "op" : ""} ${k === "=" ? "igual" : ""} ${k === "0" ? "zero" : ""}`);
    b.type = "button"; b.textContent = k === "-" ? "−" : k; b.dataset.k = k;
    b.onclick = () => { tocar("toque"); teclar(k); };
    tec.append(b);
  }
  mostrar();
  return { teclar, expr: () => st.e };
}
// teclado físico (notebook) para a calculadora visível
const TECLA_FISICA = { "*": "×", x: "×", X: "×", "/": "÷", ".": ",", Enter: "=", "=": "=", Backspace: "⌫", Escape: "C", Delete: "C" };
function teclaDoEvento(ev) {
  if (/^\d$/.test(ev.key) || "+-,".includes(ev.key) && ev.key.length === 1) return ev.key;
  return TECLA_FISICA[ev.key] || null;
}

// ======================= caderno =======================
const CHAVE_CADERNO = "orbita.cadernoLicoes";
function cadernos() {
  const tudo = ls.ler(CHAVE_CADERNO, {}), hoje = hojeISO();
  let mudou = false;
  for (const [k, v] of Object.entries(tudo)) if (!v || v.d !== hoje) { delete tudo[k]; mudou = true; }
  if (mudou) ls.gravar(CHAVE_CADERNO, tudo);
  return tudo;
}
export const textoDoCaderno = (chave) => cadernos()[chave]?.t || "";
export function guardarCaderno(chave, texto) {
  const tudo = cadernos();
  if (texto) tudo[chave] = { t: texto, d: hojeISO() }; else delete tudo[chave];
  ls.gravar(CHAVE_CADERNO, tudo);
}
/** Monta o caderno da sessão `chave` em `raiz` (o texto é gravado a cada letra e some no dia seguinte). */
export function montarCaderno(raiz, chave, dica = "Fica guardado durante esta sessão e some amanhã.") {
  raiz.innerHTML = `<textarea class="fl-caderno-texto" placeholder="Anote dados, contas, ideias…" spellcheck="false"></textarea><div class="fl-caderno-pe"><small></small><button type="button" class="link fl-cad-limpar">Limpar</button></div>`;
  const ta = raiz.querySelector("textarea");
  ta.value = textoDoCaderno(chave);
  raiz.querySelector("small").textContent = dica;
  ta.oninput = () => guardarCaderno(chave, ta.value);
  raiz.querySelector(".fl-cad-limpar").onclick = () => { ta.value = ""; guardarCaderno(chave, ""); ta.focus(); };
  return { ta };
}

// ======================= marca-texto =======================
const TEM_HL = typeof Highlight !== "undefined" && typeof CSS !== "undefined" && !!CSS.highlights;
const HL = TEM_HL ? { marca: new Highlight(), sub: new Highlight(), previa: new Highlight() } : null;
if (HL) { CSS.highlights.set("fl-marca", HL.marca); CSS.highlights.set("fl-sub", HL.sub); CSS.highlights.set("fl-previa", HL.previa); }

const LETRA = /[\p{L}\p{N}'’-]/u;
/** Acha o caractere de texto sob o ponto (x, y da tela) dentro de `raizes`: { node, offset } ou null.
 *  Não usa caretRangeFromPoint (o app inteiro é user-select: none e ele pula esse texto). */
function caractereNoPonto(x, y, raizes) {
  const alvo = document.elementFromPoint(x, y);
  if (!alvo || !raizes.some(r => r.contains(alvo))) return null;
  const caixa = alvo.closest(".opcao, .palavra, .cesto, .item-cat, .lacuna, .par, p, li, .frase-resumo, .enunciado, .afirmacao, .contexto, .frase, .explic, .gabarito, .bolha, .resumo-topo, .tipo-rotulo") || alvo;
  const w = document.createTreeWalker(caixa, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let melhor = null, dMelhor = 28, n = 0;
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    if (t.parentElement?.closest(".fl-tela, .cont")) continue;
    const s = t.data;
    for (let i = 0; i < s.length; i++) {
      if (++n > 4000) return melhor;
      if (/\s/.test(s[i])) continue;
      r.setStart(t, i); r.setEnd(t, i + 1);
      const b = r.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return { node: t, offset: i };
      const dy = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
      const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
      const d = dy * 3 + dx; // a linha manda mais que a coluna
      if (d < dMelhor) { dMelhor = d; melhor = { node: t, offset: i }; }
    }
  }
  return melhor;
}
// vírgula, ponto, barra e % entre algarismos ficam na palavra ("1,8", "7 mg/kg" não, "3/4" sim)
const NUM = /[.,/]/;
const naPalavra = (s, i) => {
  const c = s[i]; if (!c) return false;
  if (LETRA.test(c)) return true;
  if (c === "%") return /\d/.test(s[i - 1] || "");
  return NUM.test(c) && /\d/.test(s[i - 1] || "") && /\d/.test(s[i + 1] || "");
};
function palavraEm(p) {
  const s = p.node.data;
  let a = p.offset, b = p.offset + 1;
  if (naPalavra(s, a)) { while (a > 0 && naPalavra(s, a - 1)) a--; while (b < s.length && naPalavra(s, b)) b++; }
  return [a, b];
}
function rangeEntre(p, q) {
  const r = document.createRange();
  const [a0] = palavraEm(p), [, b1] = palavraEm(q);
  r.setStart(p.node, a0); r.setEnd(p.node, a0);
  if (r.comparePoint(q.node, q.offset) < 0) { // q vem antes de p: inverte
    const [qa] = palavraEm(q), [, pb] = palavraEm(p);
    r.setStart(q.node, qa); r.setEnd(p.node, pb);
  } else r.setEnd(q.node, b1);
  return r;
}
// sem a Highlight API (WebView antigo): envolve os pedaços em <span> (textContent continua o mesmo)
function envolver(range, tipo) {
  const nos = [];
  const w = document.createTreeWalker(range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) if (range.intersectsNode(t)) nos.push(t);
  const spans = [];
  for (let t of nos) {
    let a = t === range.startContainer ? range.startOffset : 0, b = t === range.endContainer ? range.endOffset : t.data.length;
    if (b <= a) continue;
    if (b < t.data.length) t.splitText(b);
    if (a > 0) t = t.splitText(a);
    const sp = el("span", `fl-m-${tipo}`); t.parentNode.insertBefore(sp, t); sp.append(t); spans.push(sp);
  }
  return spans;
}

// ======================= barra da lição =======================
/** Liga as ferramentas a uma lição aberta. opts: { camada, corpo, rodape, depoisDe (elemento depois do qual entra a
 *  barra), chaveCaderno, nomeSessao }. Devolve { exercicio(chave), fim(), destruir() }. */
export function criarFerramentas({ camada, corpo, rodape, depoisDe, chaveCaderno, nomeSessao = "sessão" }) {
  const barra = el("div", "fl-barra");
  barra.innerHTML = `<div class="fl-principais">
    <button type="button" class="fl-bt" data-f="calc" aria-label="Calculadora" title="Calculadora">${SVG.calc}</button>
    <button type="button" class="fl-bt" data-f="caderno" aria-label="Caderno" title="Caderno">${SVG.caderno}</button>
    <button type="button" class="fl-bt" data-f="marca" aria-label="Marca-texto" title="Marcar ou sublinhar o texto">${SVG.marca}</button>
    <button type="button" class="fl-bt" data-f="caneta" aria-label="Caneta" title="Escrever na tela">${SVG.caneta}</button></div><div class="fl-sub" hidden></div>`;
  depoisDe.after(barra);
  const sub = barra.querySelector(".fl-sub");
  const btCaneta = barra.querySelector('[data-f="caneta"]');
  const doca = el("div", "fl-doca"); doca.hidden = true;
  rodape.before(doca);
  let painel = null, modo = null, chaveEx = null;
  const raizesTexto = [corpo, rodape];

  // ---------- painéis (calculadora e caderno) ----------
  let calc = null; const memCalc = {};
  function abrirPainel(qual) {
    if (painel === qual) return fecharPainel();
    painel = qual; doca.hidden = false; doca.dataset.p = qual;
    doca.innerHTML = `<div class="fl-doca-topo"><b>${qual === "calc" ? "Calculadora" : `Caderno <small>· ${nomeSessao}</small>`}</b><button type="button" class="fl-doca-x" aria-label="Fechar">${SVG.x}</button></div><div class="fl-doca-corpo"></div>`;
    doca.querySelector(".fl-doca-x").onclick = fecharPainel;
    const c = doca.querySelector(".fl-doca-corpo");
    if (qual === "calc") { calc = montarCalculadora(c, memCalc); c.classList.add("fl-calc"); }
    else { calc = null; montarCaderno(c, chaveCaderno, `Fica nos exercícios e nas lições desta sessão (${nomeSessao}) e some amanhã.`); }
    pintar();
  }
  function fecharPainel() { painel = null; calc = null; doca.hidden = true; doca.innerHTML = ""; pintar(); }
  const aoTeclar = (ev) => {
    if (!calc || ev.ctrlKey || ev.metaKey || ev.altKey || /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement?.tagName || "")) return;
    const k = teclaDoEvento(ev); if (!k) return;
    ev.preventDefault(); calc.teclar(k);
  };
  document.addEventListener("keydown", aoTeclar);

  // ---------- modos (marca-texto e caneta) ----------
  let estiloMarca = "marca", cor = "tinta", borracha = false;
  const CORES = [["tinta", "Grafite"], ["#E5484D", "Vermelho"], ["#2F6BFF", "Azul"], ["#18A058", "Verde"]];
  const viuCaneta = () => ls.ler("orbita.viuCaneta", false);
  const dedoDesenha = () => { const v = ls.ler("orbita.dedoDesenha", null); return v == null ? !viuCaneta() : v; };
  function mostrarCaneta() {
    const pref = E().config.canetaLicoes || "auto";
    btCaneta.hidden = pref === "nunca" || (pref === "auto" && !document.documentElement.classList.contains("tablet") && !viuCaneta());
  }
  function pintar() {
    barra.querySelectorAll(".fl-bt").forEach(b => b.classList.toggle("on", b.dataset.f === painel || b.dataset.f === modo));
    camada.classList.toggle("fl-marcando", modo === "marca");
    camada.classList.toggle("fl-desenhando", modo === "caneta");
    sub.hidden = !modo;
    if (modo === "marca") {
      sub.innerHTML = `<button type="button" class="fl-chip ${estiloMarca === "marca" ? "on" : ""}" data-m="marca"><span class="fl-amostra-marca">Marcar</span></button><button type="button" class="fl-chip ${estiloMarca === "sub" ? "on" : ""}" data-m="sub"><span class="fl-amostra-sub">Sublinhar</span></button><button type="button" class="fl-chip fl-ico" data-m="limpar" aria-label="Tirar as marcas deste exercício" title="Tirar as marcas">${SVG.lixo}</button><small class="fl-dica">Toque numa palavra ou arraste sobre o texto</small>`;
      sub.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
        if (b.dataset.m === "limpar") { limparMarcas(); return; }
        estiloMarca = b.dataset.m; pintar();
      });
    } else if (modo === "caneta") {
      sub.innerHTML = CORES.map(([c, n]) => `<button type="button" class="fl-cor ${!borracha && cor === c ? "on" : ""}" data-c="${c}" aria-label="${n}" title="${n}" style="--c:${c === "tinta" ? "var(--tinta)" : c}"></button>`).join("")
        + `<button type="button" class="fl-chip fl-ico ${borracha ? "on" : ""}" data-a="borracha" aria-label="Borracha" title="Borracha">${SVG.borracha}</button>`
        + `<button type="button" class="fl-chip fl-ico" data-a="desfazer" aria-label="Desfazer" title="Desfazer">${SVG.desfazer}</button>`
        + `<button type="button" class="fl-chip fl-ico" data-a="limpar" aria-label="Apagar o desenho" title="Apagar o desenho">${SVG.lixo}</button>`
        + `<button type="button" class="fl-chip fl-ico ${dedoDesenha() ? "on" : ""}" data-a="dedo" aria-label="O dedo também desenha" title="O dedo também desenha">${SVG.dedo}</button>`;
      sub.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { cor = b.dataset.c; borracha = false; pintar(); });
      sub.querySelector('[data-a="borracha"]').onclick = () => { borracha = !borracha; pintar(); };
      sub.querySelector('[data-a="desfazer"]').onclick = () => { tracos().pop(); redesenhar(); };
      sub.querySelector('[data-a="limpar"]').onclick = () => { tracos().length = 0; redesenhar(); };
      sub.querySelector('[data-a="dedo"]').onclick = () => { ls.gravar("orbita.dedoDesenha", !dedoDesenha()); pintar(); };
    } else sub.innerHTML = "";
    if (tela) tela.style.pointerEvents = modo === "caneta" ? "auto" : "none";
  }
  barra.querySelectorAll(".fl-bt").forEach(b => b.onclick = () => {
    tocar("toque");
    const f = b.dataset.f;
    if (f === "calc" || f === "caderno") return abrirPainel(f);
    modo = modo === f ? null : f; borracha = false;
    if (modo === "caneta") medir();
    pintar();
  });

  // ---------- marcas ----------
  const marcas = new Map(); // chave do exercício → [{ texto, tipo, range }]
  const minhas = () => { if (!marcas.has(chaveEx)) marcas.set(chaveEx, []); return marcas.get(chaveEx); };
  function aplicarMarca(range, tipo) {
    const m = { texto: range.toString(), tipo, range };
    if (HL) HL[tipo].add(range); else m.spans = envolver(range, tipo);
    minhas().push(m);
  }
  function tirarMarca(m) {
    if (HL) HL[m.tipo].delete(m.range);
    else for (const sp of m.spans || []) { if (sp.isConnected) sp.replaceWith(...sp.childNodes); }
    const l = minhas(); l.splice(l.indexOf(m), 1);
  }
  function limparMarcas() { for (const m of [...minhas()]) tirarMarca(m); }
  function esquecerMarcasNaTela() { if (HL) { HL.marca.clear(); HL.sub.clear(); HL.previa.clear(); } }
  // ao voltar a um exercício (a questão errada volta no fim), as marcas voltam pelo texto
  function reaplicarMarcas() {
    const l = marcas.get(chaveEx); if (!l?.length) return;
    const antigas = l.splice(0);
    for (const m of antigas) { const r = acharTexto(corpo, m.texto); if (r) aplicarMarca(r, m.tipo); }
  }
  function acharTexto(raiz, texto) {
    if (!texto) return null;
    const nos = [], w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let todo = "";
    for (let t = w.nextNode(); t; t = w.nextNode()) { if (t.parentElement?.closest(".fl-tela")) continue; nos.push([t, todo.length]); todo += t.data; }
    const i = todo.indexOf(texto); if (i < 0) return null;
    const ponto = (pos, fim) => { for (let k = nos.length - 1; k >= 0; k--) { const [t, ini] = nos[k]; if (pos > ini || (!fim && pos === ini)) return [t, pos - ini]; } return [nos[0][0], 0]; };
    const r = document.createRange(); const [a, ao] = ponto(i, false), [b, bo] = ponto(i + texto.length, true);
    r.setStart(a, ao); r.setEnd(b, bo); return r;
  }
  let gesto = null;
  const naoMarca = (alvo) => !alvo || !raizesTexto.some(r => r.contains(alvo)) || alvo.closest(".botao, .reportar, .fl-tela, .zoom, .fechar");
  function marcaNoPonto(p) {
    for (const m of minhas()) {
      try { if (m.range.isPointInRange(p.node, p.offset)) return m; } catch { /* nó saiu da tela */ }
      if (m.spans?.some(sp => sp.contains(p.node))) return m;
    }
    return null;
  }
  const aoBaixar = (ev) => {
    if (modo !== "marca" || ev.button > 0 || naoMarca(ev.target)) return;
    const p = caractereNoPonto(ev.clientX, ev.clientY, raizesTexto);
    if (!p) return;
    gesto = { id: ev.pointerId, p, q: p, x: ev.clientX, y: ev.clientY, moveu: false };
  };
  let quadro = 0;
  const aoMover = (ev) => {
    if (!gesto || ev.pointerId !== gesto.id) return;
    if (Math.hypot(ev.clientX - gesto.x, ev.clientY - gesto.y) > 6) gesto.moveu = true;
    if (!gesto.moveu) return;
    const x = ev.clientX, y = ev.clientY;
    if (quadro) return;
    quadro = requestAnimationFrame(() => {
      quadro = 0; if (!gesto) return;
      const q = caractereNoPonto(x, y, raizesTexto); if (q) gesto.q = q;
      if (HL) { HL.previa.clear(); try { HL.previa.add(rangeEntre(gesto.p, gesto.q)); } catch { /* fora de ordem */ } }
    });
  };
  const aoSoltar = (ev) => {
    if (!gesto || ev.pointerId !== gesto.id) return;
    const g = gesto; gesto = null; HL?.previa.clear();
    if (ev.type === "pointercancel") return; // virou rolagem
    if (!g.moveu) {
      const ja = marcaNoPonto(g.p);
      if (ja) { tirarMarca(ja); return; }
      const [a, b] = palavraEm(g.p); const r = document.createRange(); r.setStart(g.p.node, a); r.setEnd(g.p.node, b);
      if (r.toString().trim()) aplicarMarca(r, estiloMarca);
      return;
    }
    try { const r = rangeEntre(g.p, g.q); if (r.toString().trim()) aplicarMarca(r, estiloMarca); } catch { /* nada */ }
  };
  // com o marca-texto ligado, o toque marca em vez de escolher a opção (os botões de seguir continuam valendo)
  const aoClicar = (ev) => {
    if (modo !== "marca" || naoMarca(ev.target)) return;
    ev.preventDefault(); ev.stopPropagation();
  };
  camada.addEventListener("pointerdown", aoBaixar, true);
  camada.addEventListener("pointermove", aoMover, true);
  camada.addEventListener("pointerup", aoSoltar, true);
  camada.addEventListener("pointercancel", aoSoltar, true);
  camada.addEventListener("click", aoClicar, true);
  // uma caneta usada na lição revela o botão da caneta (preferência "auto")
  // (e, a partir daí, o dedo deixa de desenhar: rola e toca nas opções)
  const aoCaneta = (ev) => { if (ev.pointerType === "pen" && !viuCaneta()) { ls.gravar("orbita.viuCaneta", true); mostrarCaneta(); requestAnimationFrame(pintar); } };
  camada.addEventListener("pointerdown", aoCaneta, true);

  // ---------- caneta ----------
  const desenhos = new Map(); // chave do exercício → traços [{ cor, larg, borr?, pts: [[x, y], …] }]
  const tracos = () => { if (!desenhos.has(chaveEx)) desenhos.set(chaveEx, []); return desenhos.get(chaveEx); };
  let tela = null, ctx = null, esc = 1, alt = 0, larg = 0;
  const fator = () => { const r = corpo.getBoundingClientRect(); return corpo.offsetWidth ? r.width / corpo.offsetWidth : 1; };
  function criarTela() {
    tela = el("canvas", "fl-tela"); tela.setAttribute("aria-hidden", "true");
    tela.style.pointerEvents = modo === "caneta" ? "auto" : "none";
    corpo.append(tela); ctx = tela.getContext("2d"); alt = larg = 0;
    tela.addEventListener("pointerdown", desenhoBaixa);
    tela.addEventListener("pointermove", desenhoMove);
    tela.addEventListener("pointerup", desenhoSolta);
    tela.addEventListener("pointercancel", desenhoSolta);
    tela.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  function medir() {
    if (!tela?.isConnected) return;
    tela.style.display = "none";
    const h = corpo.scrollHeight, w = corpo.clientWidth;
    tela.style.display = "";
    if (h === alt && w === larg) return;
    alt = h; larg = w;
    tela.style.width = w + "px"; tela.style.height = h + "px";
    let k = (devicePixelRatio || 1) * fator();
    if (w * h * k * k > 6e6) k = Math.sqrt(6e6 / (w * h));
    esc = k; tela.width = Math.round(w * k); tela.height = Math.round(h * k);
    redesenhar();
  }
  const corReal = (c) => c === "tinta" ? (getComputedStyle(corpo).getPropertyValue("--tinta").trim() || "#1B2340") : c;
  function traco(t, i0 = 1) {
    ctx.strokeStyle = corReal(t.cor); ctx.lineCap = ctx.lineJoin = "round";
    const p = t.pts;
    if (p.length === 1) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(p[0][0], p[0][1], t.larg * (p[0][2] ?? 1) / 2, 0, 7); ctx.fill(); return; }
    for (let i = Math.max(1, i0); i < p.length; i++) {
      ctx.lineWidth = t.larg * (p[i][2] ?? 1);
      ctx.beginPath(); ctx.moveTo(p[i - 1][0], p[i - 1][1]); ctx.lineTo(p[i][0], p[i][1]); ctx.stroke();
    }
  }
  function redesenhar() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, tela.width, tela.height);
    ctx.setTransform(esc, 0, 0, esc, 0, 0);
    for (const t of tracos()) traco(t);
  }
  const ponto = (ev) => { const r = tela.getBoundingClientRect(), k = tela.offsetWidth / (r.width || 1); return [(ev.clientX - r.left) * k, (ev.clientY - r.top) * k]; };
  const pressao = (ev) => ev.pointerType === "pen" && ev.pressure > 0 ? 0.55 + ev.pressure * 0.9 : 1;
  let atual = null, rolagem = null;
  function apagarPerto([x, y]) {
    const l = tracos(), antes = l.length;
    for (let i = l.length - 1; i >= 0; i--) if (l[i].pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 12)) l.splice(i, 1);
    if (l.length !== antes) redesenhar();
  }
  function desenhoBaixa(ev) {
    if (modo !== "caneta") return;
    const dedo = ev.pointerType === "touch";
    if (atual && dedo) return; // a mão encostada enquanto a caneta escreve
    ev.preventDefault();
    if (dedo && !dedoDesenha()) { // o dedo rola e toca nas opções
      rolagem = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, st: corpo.scrollTop, t: Date.now(), moveu: false, k: fator() };
      tela.setPointerCapture?.(ev.pointerId);
      return;
    }
    tela.setPointerCapture?.(ev.pointerId);
    const p = ponto(ev);
    if (borracha || ev.button === 5 || (ev.buttons & 32)) { atual = { id: ev.pointerId, borr: true }; apagarPerto(p); return; }
    atual = { id: ev.pointerId, t: { cor, larg: ev.pointerType === "touch" ? 3.2 : 2.6, pts: [[...p, pressao(ev)]] } };
    tracos().push(atual.t); traco(atual.t);
  }
  function desenhoMove(ev) {
    if (rolagem && ev.pointerId === rolagem.id) {
      const dy = ev.clientY - rolagem.y;
      if (Math.abs(dy) > 6 || Math.abs(ev.clientX - rolagem.x) > 6) rolagem.moveu = true;
      corpo.scrollTop = rolagem.st - dy / rolagem.k;
      return;
    }
    if (!atual || ev.pointerId !== atual.id) return;
    const evs = ev.getCoalescedEvents?.() || [ev];
    for (const e of evs) {
      const p = ponto(e);
      if (atual.borr) { apagarPerto(p); continue; }
      const pts = atual.t.pts, u = pts[pts.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 0.8) continue;
      pts.push([...p, pressao(e)]); traco(atual.t, pts.length - 1);
    }
  }
  function desenhoSolta(ev) {
    if (rolagem && ev.pointerId === rolagem.id) {
      const r = rolagem; rolagem = null;
      if (!r.moveu && Date.now() - r.t < 600 && ev.type !== "pointercancel") { // toque: passa para o que está embaixo
        tela.style.pointerEvents = "none";
        const alvo = document.elementFromPoint(ev.clientX, ev.clientY);
        tela.style.pointerEvents = "auto";
        alvo?.closest("button, [onclick], a, input, textarea, select, img")?.click?.();
      }
      return;
    }
    if (atual && ev.pointerId === atual.id) atual = null;
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => requestAnimationFrame(medir)) : null;
  const mo = new MutationObserver(() => requestAnimationFrame(medir));
  ro?.observe(corpo);
  mo.observe(corpo, { childList: true, subtree: true });
  addEventListener("resize", medir);

  mostrarCaneta();
  pintar();
  return {
    /** chamado depois de montar cada exercício (a chave é o id da questão: o desenho e as marcas voltam com ela) */
    exercicio(chave) {
      esquecerMarcasNaTela();
      for (const l of marcas.values()) for (const m of l) if (!HL) m.spans = []; // os spans antigos foram embora com o DOM
      chaveEx = chave;
      barra.hidden = false; mostrarCaneta();
      criarTela();
      requestAnimationFrame(() => { medir(); reaplicarMarcas(); });
    },
    /** tela final da lição: some a barra, os painéis e os modos (o caderno continua guardado) */
    fim() {
      modo = null; fecharPainel(); barra.hidden = true; esquecerMarcasNaTela(); tela?.remove(); tela = null; ctx = null; pintar();
    },
    destruir() {
      this.fim();
      document.removeEventListener("keydown", aoTeclar);
      removeEventListener("resize", medir);
      ro?.disconnect(); mo.disconnect();
      camada.classList.remove("fl-marcando", "fl-desenhando");
      barra.remove(); doca.remove();
    },
  };
}
