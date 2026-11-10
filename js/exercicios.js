// Componentes de cada tipo de exercício.
// Cada função monta o exercício em `raiz` e devolve { verificar() } ou chama api.concluir() sozinha.
import { tocar, vibrar } from "./sons.js";
import { iconesNoTexto } from "./icones.js";
import { separarAfirmativas } from "./afirmativas.js";

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
export function embaralhar(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function embaralharDiferente(a) { // evita entregar a ordem já correta
  if (a.length < 2) return [...a];
  let b; do { b = embaralhar(a); } while (b.every((x, i) => x === a[i]));
  return b;
}

const ROTULOS = { resumo: "Resumo do dia", multipla: "Escolha a resposta", vf: "Verdadeiro ou falso?", pares: "Ligue os pares", lacunas: "Complete as lacunas", ordenar: "Coloque na ordem", categorias: "Classifique" };
export const rotuloTipo = (t) => ROTULOS[t] || "";

// ---------- múltipla escolha ----------
const LETRAS = "ABCDEFGHIJ";
const TESOURA = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>`;
function multipla(ex, raiz, api) {
  raiz.append(elRico("div", "enunciado", ex.enunciado));
  const box = el("div", "opcoes");
  box.classList.add("com-letras");
  const ordem = embaralhar(ex.opcoes.map((t, i) => ({ t, i })));
  let marcada = null;
  // pedidos do Alediov (05/11/2026): a letra (A, B, C…) pela posição na tela, depois do embaralhar, e a tesoura à
  // direita para "cortar" (acinzentar) as que ele acha erradas, como nos sites de questões de concurso; tocar de novo
  // devolve, e escolher uma cortada também a devolve
  const botoes = ordem.map(({ t, i }, k) => {
    const linha = el("div", "op-linha");
    const b = el("button", "opcao", t);
    b.dataset.letra = LETRAS[k] || "";
    const cortar = el("button", "op-cortar");
    cortar.type = "button";
    cortar.innerHTML = TESOURA;
    cortar.setAttribute("aria-label", `Cortar a alternativa ${LETRAS[k] || ""}`);
    cortar.setAttribute("aria-pressed", "false");
    const cortada = (sim) => { linha.classList.toggle("cortada", sim); cortar.setAttribute("aria-pressed", String(sim)); };
    cortar.onclick = (ev) => {
      ev.stopPropagation(); if (b.disabled) return;
      tocar("toque"); vibrar(8);
      const sim = !linha.classList.contains("cortada");
      cortada(sim);
      if (sim && marcada === i) { b.classList.remove("marcada"); marcada = null; api.pronto(false); }
    };
    b.onclick = () => { tocar("toque"); cortada(false); botoes.forEach(x => x.classList.remove("marcada")); b.classList.add("marcada"); marcada = i; api.pronto(true); };
    b._i = i; b._cortar = cortar; linha.append(b, cortar); box.append(linha); return b;
  });
  raiz.append(box);
  return {
    verificar() {
      const acertou = marcada === ex.correta;
      botoes.forEach(b => { b.disabled = true; b._cortar.disabled = true; b.classList.remove("marcada"); if (b._i === ex.correta) b.classList.add("correta"); else if (b._i === marcada) b.classList.add("incorreta"); });
      return { acertou, gabarito: ex.opcoes[ex.correta] };
    },
  };
}

// ---------- verdadeiro ou falso ----------
function vf(ex, raiz, api) {
  raiz.append(elRico("div", "afirmacao", ex.afirmacao));
  const box = el("div", "vf");
  let marcada = null;
  const bs = [[true, "Verdadeiro"], [false, "Falso"]].map(([v, t]) => {
    const b = el("button", "opcao", t); b._v = v;
    b.onclick = () => { tocar("toque"); bs.forEach(x => x.classList.remove("marcada")); b.classList.add("marcada"); marcada = v; api.pronto(true); };
    box.append(b); return b;
  });
  raiz.append(box);
  return {
    verificar() {
      const acertou = marcada === ex.correta;
      bs.forEach(b => { b.disabled = true; b.classList.remove("marcada"); if (b._v === ex.correta) b.classList.add("correta"); else if (b._v === marcada) b.classList.add("incorreta"); });
      return { acertou, gabarito: ex.correta ? "Verdadeiro" : "Falso" };
    },
  };
}

// ---------- ligar pares ----------
function pares(ex, raiz, api) {
  raiz.append(elRico("div", "enunciado", ex.enunciado));
  const grade = el("div", "pares");
  const colE = el("div", "col"), colD = el("div", "col");
  let selE = null, selD = null, erros = 0, feitos = 0; const errados = new Set();
  const criar = (texto, idx, lado) => {
    const b = el("button", "opcao par", texto); b._idx = idx; b._lado = lado;
    b.onclick = () => {
      if (b.classList.contains("feito")) return;
      tocar("toque");
      if (lado === "e") { selE?.classList.remove("marcada"); selE = b; } else { selD?.classList.remove("marcada"); selD = b; }
      b.classList.add("marcada");
      if (selE && selD) {
        const a = selE, c = selD; selE = selD = null;
        if (a._idx === c._idx) {
          [a, c].forEach(x => { x.classList.remove("marcada"); x.classList.add("feito"); x.disabled = true; });
          tocar("par"); feitos++;
          if (feitos === ex.pares.length) setTimeout(() => api.concluir({ acertou: erros === 0, certos: ex.pares.length - errados.size, total: ex.pares.length, gabarito: null, detalhe: erros ? `${erros} tentativa(s) errada(s)` : null }), 250);
        } else {
          erros++; errados.add(a._idx); errados.add(c._idx); tocar("errado"); vibrar(60);
          [a, c].forEach(x => { x.classList.remove("marcada"); x.classList.add("treme"); setTimeout(() => x.classList.remove("treme"), 400); });
        }
      }
    };
    return b;
  };
  embaralhar(ex.pares.map((p, i) => [p[0], i])).forEach(([t, i]) => colE.append(criar(t, i, "e")));
  embaralhar(ex.pares.map((p, i) => [p[1], i])).forEach(([t, i]) => colD.append(criar(t, i, "d")));
  grade.append(colE, colD); raiz.append(grade);
  return { auto: true };
}

// ---------- lacunas com banco de palavras ----------
function lacunas(ex, raiz, api) {
  raiz.append(elRico("div", "enunciado", ex.enunciado));
  const frase = el("div", "frase");
  const partes = ex.texto.split(/(\[\[\d+\]\])/);
  const vagas = [];
  for (const p of partes) {
    const m = p.match(/\[\[(\d+)\]\]/);
    if (m) {
      const v = el("button", "lacuna", " "); v._n = +m[1]; v._palavra = null;
      v.onclick = () => { if (v._palavra) { v._palavra.classList.remove("usada"); v._palavra = null; v.textContent = " "; v.classList.remove("cheia"); tocar("toque"); checar(); } };
      vagas.push(v); frase.append(v);
    } else frase.append(document.createTextNode(p));
  }
  raiz.append(frase);
  const banco = el("div", "banco");
  embaralhar([...ex.respostas, ...(ex.distratores || [])]).forEach(w => {
    const b = el("button", "palavra", w);
    b.onclick = () => {
      if (b.classList.contains("usada")) return;
      const livre = vagas.find(v => !v._palavra); if (!livre) return;
      tocar("toque"); livre._palavra = b; livre.textContent = w; livre.classList.add("cheia"); b.classList.add("usada"); checar();
    };
    banco.append(b);
  });
  raiz.append(banco);
  function checar() { api.pronto(vagas.every(v => v._palavra)); }
  const grupos = gruposLacunas(ex, partes);
  return {
    verificar() {
      // Lacunas do mesmo grupo (uma lista como "A, B e C") aceitam as respostas em qualquer ordem.
      let certos = 0;
      for (const g of grupos) {
        const sobra = g.map(n => ex.respostas[n]);
        const vs = vagas.filter(v => g.includes(v._n));
        for (const v of vs) {
          const k = sobra.indexOf(v.textContent);
          const certo = k >= 0; if (certo) { sobra.splice(k, 1); certos++; }
          v.classList.add(certo ? "ok" : "nok"); v.disabled = true;
        }
      }
      banco.querySelectorAll("button").forEach(b => b.disabled = true);
      return { acertou: certos === vagas.length, certos, total: vagas.length, gabarito: ex.respostas.join(" · ") };
    },
  };
}
/** Agrupa as lacunas intercambiáveis: ex.ordem_livre (todas), ex.ordem_fixa (nenhuma) ou, por padrão,
 *  lacunas vizinhas separadas só por vírgula, "e", "ou" ou barra. */
export function gruposLacunas(ex, partes = ex.texto.split(/(\[\[\d+\]\])/)) {
  const nums = [], entre = [];
  let texto = null;
  for (const p of partes) {
    const m = p.match(/^\[\[(\d+)\]\]$/);
    if (m) { if (nums.length) entre.push(texto ?? ""); nums.push(+m[1]); texto = ""; }
    else if (texto != null) texto += p;
  }
  if (ex.ordem_livre) return [nums];
  if (ex.ordem_fixa) return nums.map(n => [n]);
  const grupos = [];
  nums.forEach((n, i) => {
    if (i && /^\s*(,|,?\s*(e|ou|nem)|\/)\s*$/i.test(entre[i - 1])) grupos[grupos.length - 1].push(n);
    else grupos.push([n]);
  });
  return grupos;
}

// ---------- ordenar ----------
function ordenar(ex, raiz, api) {
  raiz.append(elRico("div", "enunciado", ex.enunciado));
  const resp = el("div", "resposta-ordem"), pool = el("div", "pool-ordem");
  embaralharDiferente(ex.itens).forEach(t => {
    const b = el("button", "palavra", t);
    b.onclick = () => {
      tocar("toque");
      (b.parentElement === pool ? resp : pool).append(b);
      api.pronto(pool.children.length === 0);
    };
    pool.append(b);
  });
  raiz.append(resp, pool);
  return {
    verificar() {
      const atual = [...resp.children];
      let certos = 0;
      atual.forEach((b, i) => { const c = b.textContent === ex.itens[i]; if (c) certos++; b.classList.add(c ? "ok" : "nok"); b.disabled = true; });
      return { acertou: certos === ex.itens.length, certos, total: ex.itens.length, gabarito: ex.itens.map((t, i) => `${i + 1}. ${t}`).join("\n") };
    },
  };
}

// ---------- classificar em categorias (um cartão por vez) ----------
function categorias(ex, raiz, api) {
  raiz.append(elRico("div", "enunciado", ex.enunciado));
  const palco = el("div", "cat-palco");
  const fila = embaralhar(ex.itens);
  const cartao = el("div", "item-cat");
  const restantes = el("div", "cat-restantes");
  // minmax(0, 1fr): colunas iguais que nunca passam da tela (com 1fr a palavra mais longa alargava a coluna e, com 3
  // categorias, o Classifique saía da tela no celular); se mesmo assim uma palavra não couber, vira uma por linha
  const cestos = el("div", `cestos n${ex.categorias.length}`); cestos.style.gridTemplateColumns = `repeat(${Math.min(ex.categorias.length, 3)}, minmax(0, 1fr))`;
  let pos = 0, erros = 0; const errados = [], itensErrados = new Set();
  const contagem = ex.categorias.map(() => 0);
  const bts = ex.categorias.map((c, ci) => {
    const b = el("button", "cesto"); b.innerHTML = `${c}<span class="cont">0</span>`;
    b.onclick = () => {
      if (pos >= fila.length || cartao._ocupado) return;
      const item = fila[pos];
      if (item.categoria === ci) {
        tocar("par"); cartao._ocupado = true; contagem[ci]++; b.querySelector(".cont").textContent = contagem[ci];
        cartao.classList.add(`voa-${ci}`);
        setTimeout(() => { cartao.className = "item-cat"; cartao._ocupado = false; pos++; mostrar(); }, 340);
      } else {
        erros++; tocar("errado"); vibrar(60);
        const linha = `${item.texto} → ${ex.categorias[item.categoria]}`;
        if (!errados.includes(linha)) errados.push(linha);
        itensErrados.add(item);
        cartao.classList.add("treme"); setTimeout(() => cartao.classList.remove("treme"), 400);
      }
    };
    cestos.append(b); return b;
  });
  function mostrar() {
    if (pos >= fila.length) {
      cartao.textContent = "✓"; restantes.textContent = "";
      setTimeout(() => api.concluir({ acertou: erros === 0, certos: fila.length - itensErrados.size, total: fila.length, gabarito: errados.length ? errados.join("\n") : null }), 200);
      return;
    }
    cartao.textContent = fila[pos].texto;
    restantes.textContent = `${fila.length - pos} restante(s)`;
  }
  palco.append(cartao, restantes, cestos); raiz.append(palco);
  mostrar();
  const caber = () => {
    if (!cestos.isConnected) return;
    cestos.classList.remove("empilhados"); cestos.style.gridTemplateColumns = `repeat(${Math.min(ex.categorias.length, 3)}, minmax(0, 1fr))`;
    cestos.classList.add("medindo"); // sem quebrar palavra: se a mais longa não cabe na coluna, empilha
    const naoCabe = bts.some(b => b.scrollWidth > b.clientWidth + 1);
    cestos.classList.remove("medindo");
    if (naoCabe) { cestos.classList.add("empilhados"); cestos.style.gridTemplateColumns = ex.categorias.length > 3 ? "repeat(2, minmax(0, 1fr))" : "1fr"; }
  };
  requestAnimationFrame(caber);
  if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(() => { if (!cestos.isConnected) return ro.disconnect(); caber(); }); ro.observe(palco); }
  return { auto: true };
}

// ---------- resumo do dia (não é avaliado) ----------
// Marcações: **destaque**, ==marca-texto==, ++verde++, !!vermelho!!, __roxo__
export function formatarResumo(txt) {
  const esc = String(txt).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  return iconesNoTexto(esc
    .replace(/\*\*(.+?)\*\*/g, '<b class="r-acento">$1</b>')
    .replace(/==(.+?)==/g, '<mark class="r-ouro">$1</mark>')
    .replace(/\+\+(.+?)\+\+/g, '<span class="r-verde">$1</span>')
    .replace(/!!(.+?)!!/g, '<span class="r-vermelho">$1</span>')
    .replace(/__(.+?)__/g, '<span class="r-roxo">$1</span>')
    .replace(ITALICO, "<em>$1</em>"));
}
// *termo* (um asterisco de cada lado, como os nomes em inglês: *odontogenic keratocyst*) vira itálico;
// os ** do destaque já foram trocados antes
const ITALICO = /(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])/g;
/** Texto comum (enunciado, afirmação, explicação, contexto): escapa e mostra **negrito** e *itálico* sem os asteriscos. */
export function textoComEnfase(txt) {
  const esc = String(txt ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(ITALICO, "<em>$1</em>");
}
const elRico = (tag, cls, txt) => {
  const e = el(tag, cls);
  const af = cls === "enunciado" ? separarAfirmativas(txt) : null;
  if (!af) { e.innerHTML = textoComEnfase(txt); return e; }
  // questão de concurso com afirmativas (pedido do Alediov, 05/11/2026: "em tópicos para cada afirmação"): a
  // introdução, cada afirmativa num cartão com o número romano e a pergunta no fim
  e.classList.add("com-afirmativas");
  e.innerHTML = (af.intro ? `<div class="af-intro">${textoComEnfase(af.intro)}</div>` : "")
    + `<ol class="afirmativas">${af.itens.map(([n, t]) => `<li><span class="af-num">${n}</span><span class="af-txt">${textoComEnfase(t)}</span></li>`).join("")}</ol>`
    + (af.pergunta ? `<div class="af-pergunta">${textoComEnfase(af.pergunta)}</div>` : "");
  return e;
};


function resumo(ex, raiz, api, extras = {}) {
  const box = el("div", "resumo");
  const topo = el("div", "resumo-topo");
  topo.innerHTML = `${extras.mascote || ""}<div><h2></h2><small class="sub">Leia rapidinho antes de praticar</small></div>`;
  topo.querySelector("h2").textContent = ex.titulo || "Resumo do dia";
  box.append(topo);
  const lista = el("div", "resumo"); box.append(lista);
  const bt = el("button", "botao");
  let i = 0;
  const mostrar = () => {
    const f = el("div", "frase-resumo"); f.innerHTML = formatarResumo(ex.frases[i]); lista.append(f);
    i++; tocar("toque");
    if (i < ex.frases.length) bt.textContent = `Próxima (${i}/${ex.frases.length})`; else bt.innerHTML = `Bora praticar! ${iconesNoTexto("🚀")}`;
    requestAnimationFrame(() => bt.scrollIntoView({ block: "end", behavior: "smooth" }));
  };
  bt.onclick = () => (i < ex.frases.length ? mostrar() : api.concluir({ acertou: true, resumo: true }));
  box.append(bt); raiz.append(box);
  mostrar();
  return { auto: true };
}

export const COMPONENTES = { resumo, multipla, vf, pares, lacunas, ordenar, categorias };
