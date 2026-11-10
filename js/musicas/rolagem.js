// Barra de rolagem rápida da lista de músicas (pedido do Alediov, 31/10/2026: "uma barra de rolagem ao lado das
// músicas, de tal forma que quando você desce o scroll aparece a letra do alfabeto em que está, ou o símbolo,
// considerando outros idiomas"). Uma trilha na borda direita da tela; arrastar pula pela lista inteira (desenhando o
// que ainda não estava desenhado) e o balão mostra o grupo da música do alto: a letra (sem acento), "#" para números
// e símbolos, a linha do silabário no japonês (あ か さ…), a consoante inicial no coreano (ㄱ ㄴ ㄷ…), "漢" para os
// ideogramas e a própria letra nos outros alfabetos (Б, Ω…). Nas ordens que não são por nome, o balão mostra o que
// manda na ordem (mês de chegada, estrelas, vezes tocadas). Sem DOM no topo: grupoDe roda no node.

const LINHAS_KANA = [
  ["あ", "ぁあぃいぅうぇえぉおゔ"], ["か", "かがきぎくぐけげこごゕゖ"], ["さ", "さざしじすずせぜそぞ"], ["た", "ただちぢっつづてでとど"],
  ["な", "なにぬねの"], ["は", "はばぱひびぴふぶぷへべぺほぼぽ"], ["ま", "まみむめも"], ["や", "ゃやゅゆょよ"], ["ら", "らりるれろ"], ["わ", "ゎわゐゑをん"],
];
const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", DOBRADAS = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" };

/** O grupo de um título ou nome, na mesma ordem em que o app ordena (compararTitulos em titulos.js: a base do título pelo
 *  Intl.Collator; símbolos e números primeiro). */
export function grupoDe(texto) {
  const s = String(texto || "").trim();
  const c = [...s][0];
  if (!c || !/\p{L}/u.test(c)) return "#";
  if (/\p{Script=Latin}/u.test(c)) { const b = c.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase(); return b || c.toUpperCase(); }
  const cod = c.codePointAt(0);
  if (/\p{Script=Katakana}|\p{Script=Hiragana}/u.test(c)) {
    const h = cod >= 0x30a1 && cod <= 0x30f6 ? String.fromCodePoint(cod - 0x60) : c;
    return LINHAS_KANA.find(([, l]) => l.includes(h))?.[0] || "あ";
  }
  if (cod >= 0xac00 && cod <= 0xd7a3) { const j = CHOSEONG[Math.floor((cod - 0xac00) / 588)]; return DOBRADAS[j] || j; }
  if (/\p{Script=Hangul}/u.test(c)) return DOBRADAS[c] || c;
  if (/\p{Script=Han}/u.test(c)) return "漢";
  return c.toUpperCase();
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** O rótulo do balão para cada ordem da aba Músicas (B.ORDENS). */
export function rotuloDaOrdem(ordem) {
  if (ordem === "artista") return (f) => grupoDe(f.artista);
  if (ordem === "recentes") return (f) => { if (!f.adicionadaEm) return "–"; const d = new Date(f.adicionadaEm); return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; };
  if (ordem === "nota") return (f) => f.nota ? `★${(f.nota / 2).toLocaleString("pt-BR")}` : "–";
  if (ordem === "tocadas") return (f) => `${f.tocadas || 0}×`;
  return (f) => grupoDe(f.titulo);
}

/**
 * Cria a barra dentro de `raiz` (a camada das Músicas), sobre a `tela` que rola. Devolve { mostrar(lista), esconder() };
 * `lista` = { box, n, rotulo(i), garantir(i) }: o contêiner das linhas (cada filho é uma música, na ordem), quantas
 * são, o rótulo da i-ésima e uma função que desenha até a i-ésima.
 */
export function criarRolagem(raiz, tela) {
  const el = document.createElement("div");
  el.className = "mu-rolar"; el.hidden = true; el.dataset.semDeslize = "";
  el.innerHTML = `<div class="mu-rolar-trilho" role="scrollbar" aria-orientation="vertical" aria-label="Rolar a lista"><i class="mu-rolar-pega"></i></div><b class="mu-rolar-letra" aria-hidden="true"></b>`;
  raiz.append(el);
  const trilho = el.querySelector(".mu-rolar-trilho"), pega = el.querySelector(".mu-rolar-pega"), letra = el.querySelector(".mu-rolar-letra");
  let L = null, arrastando = false, apaga = 0, quadro = 0;
  const posicionar = () => { el.style.top = `${tela.offsetTop}px`; el.style.height = `${tela.clientHeight}px`; };
  try { new ResizeObserver(posicionar).observe(tela); } catch { /* sem ResizeObserver */ }
  const linhas = () => L?.box?.children || [];
  /** A música no alto da tela: busca binária pelas linhas desenhadas. */
  const indiceTopo = () => {
    const ls = linhas(), topo = tela.getBoundingClientRect().top + 4;
    let a = 0, b = Math.min(ls.length, L.n) - 1;
    if (b < 0) return 0;
    while (a < b) { const m = (a + b + 1) >> 1; if (ls[m].getBoundingClientRect().top <= topo) a = m; else b = m - 1; }
    return a;
  };
  const pintar = (i, frac) => {
    const max = Math.max(0, trilho.clientHeight - pega.offsetHeight);
    const y = Math.round((frac ?? (L.n > 1 ? i / (L.n - 1) : 0)) * max);
    pega.style.transform = `translateY(${y}px)`;
    letra.style.transform = `translateY(${y + pega.offsetHeight / 2}px) translateY(-50%)`;
    const t = L.rotulo(Math.max(0, Math.min(L.n - 1, i)));
    if (letra.textContent !== t) letra.textContent = t;
  };
  const acender = (comLetra) => {
    el.classList.add("on"); if (comLetra) el.classList.add("letra");
    clearTimeout(apaga);
    apaga = setTimeout(() => { if (!arrastando) el.classList.remove("on", "letra"); }, 1300);
  };
  tela.addEventListener("scroll", () => {
    if (!L || el.hidden || arrastando) return;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => { if (L?.box?.isConnected) { pintar(indiceTopo()); acender(true); } });
  }, { passive: true });
  const mover = (e) => {
    const r = trilho.getBoundingClientRect(), frac = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const i = Math.round(frac * (L.n - 1));
    L.garantir(i);
    linhas()[i]?.scrollIntoView({ block: "start" });
    pintar(i, frac);
  };
  trilho.addEventListener("pointerdown", (e) => {
    if (!L) return;
    e.preventDefault(); e.stopPropagation();
    arrastando = true; trilho.setPointerCapture?.(e.pointerId);
    el.classList.add("on", "letra", "arrastando"); navigator.vibrate?.(8);
    mover(e);
  });
  trilho.addEventListener("pointermove", (e) => { if (arrastando) { e.preventDefault(); mover(e); } });
  const soltar = () => { if (!arrastando) return; arrastando = false; el.classList.remove("arrastando"); acender(false); };
  trilho.addEventListener("pointerup", soltar); trilho.addEventListener("pointercancel", soltar);
  return {
    mostrar(lista) { L = lista; el.hidden = false; posicionar(); requestAnimationFrame(() => L && pintar(0, 0)); },
    esconder() { L = null; el.hidden = true; el.classList.remove("on", "letra", "arrastando"); },
  };
}
