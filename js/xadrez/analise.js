// Tabuleiro de análise do Xadrez (aba Treinar; pedido do Alediov, 03/11/2026).
// (a) Jogar lances à vontade, dos dois lados, com o Stockfish avaliando a posição aberta: a barra de avaliação, o melhor
//     lance em seta azul e as 3 melhores linhas em português (tocar numa linha joga o 1º lance dela); voltar e avançar
//     pelos lances, desfazer, virar o tabuleiro, começar de uma posição (FEN) ou de uma linha do repertório.
// (b) Importar uma partida (PGN do chess.com ou do lichess, ou uma FEN; pgn.js) e navegar lance a lance com a avaliação,
//     o lance que o motor jogaria e a classificação de cada lance (classificar.js: Brilhante… Capivarada; os lances do
//     repertório viram Livro), o gráfico de avaliação das partidas contra o computador e a precisão de cada lado.
//     "Analisar a partida" passa por todas as posições numa profundidade moderada (12), com andamento e Cancelar, sem
//     travar a tela (o Stockfish roda num Worker; motor.js `sinal`/`cancelar`); a posição aberta continua sendo
//     aprofundada (até 22) enquanto ele olha.
// Jogar um lance diferente do da partida abre uma VARIANTE (a partida fica guardada; "Voltar à partida").
// As partidas importadas (e as análises salvas à mão) ficam em E().xadrez.analises { id: registro com `em` }, que
// sincroniza entre aparelhos; no máximo MAX_SALVAS, saem as mais antigas.
import { Chess } from "../../vendor/chess.js";
import { criarTabuleiro, SELOS } from "./tabuleiro.js";
import { sanPT, fraseLance } from "./notacao.js";
import { classificar, avDoNumero, notaDe, precisaoDaPartida } from "./classificar.js";
import * as M from "./motor.js";
import * as P from "./pgn.js";
import { E, salvar } from "../estado.js";
import { escapar, toast } from "../ui.js";

export const MAX_SALVAS = 25;
const PROF_LOTE = 12, PROF_VIVO = 22, LINHAS = 3;
const chave = (fen) => fen.split(" ").slice(0, 4).join(" ");
const CLASSES_RUINS = ["imprecisao", "erro", "capivarada"];
const ORDEM = ["brilhante", "otimo", "melhor", "excelente", "bom", "livro", "imprecisao", "erro", "capivarada"];

/** As partidas salvas, das mais novas para as mais antigas. */
export function analisesSalvas() {
  const x = E().xadrez || {};
  return Object.values(x.analises || {}).filter(a => a && a.id && a.sans).sort((a, b) => (a.em < b.em ? 1 : -1));
}
export function apagarAnalise(id) { const x = E().xadrez; if (x?.analises?.[id]) { delete x.analises[id]; salvar(); } }
function guardarRegistro(reg) {
  const x = E().xadrez; x.analises ||= {};
  x.analises[reg.id] = reg;
  const todas = Object.values(x.analises).sort((a, b) => (a.em < b.em ? 1 : -1));
  for (const a of todas.slice(MAX_SALVAS)) delete x.analises[a.id];
  salvar();
}

/** Nota do lado das brancas → texto: "+0,35", "−1,20", "#3", "#−2". */
export function textoNota(n) {
  if (n == null) return "…";
  if (Math.abs(n) >= 9000) { const m = 10000 - Math.abs(n); return m === 0 ? (n > 0 ? "1-0" : "0-1") : `#${n > 0 ? "" : "−"}${m}`; }
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${(Math.abs(n) / 100).toFixed(2).replace(".", ",")}`;
}
/** Uma linha do motor (UCI) em português e numerada a partir de `fen`: "12...Cf6 13.e5 Cd5". */
export function linhaPT(fen, pv, max = 10) {
  const g = new Chess(fen), out = [];
  for (const u of pv.slice(0, max)) {
    const n = g.moveNumber(), vez = g.turn();
    let mv; try { mv = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    out.push(vez === "w" ? `${n}.${sanPT(mv.san)}` : out.length ? sanPT(mv.san) : `${n}...${sanPT(mv.san)}`);
  }
  return out;
}
/** O número do lance de quem joga em `fen` (o 6º campo da FEN). */
const numeroDe = (fen) => +(fen.split(" ")[5] || 1);

let REP_POS = null;
async function posicoesDoRepertorio(rep) {
  if (REP_POS) return REP_POS;
  REP_POS = new Set();
  for (const c of rep?.capitulos || []) for (const l of c.linhas) { const g = new Chess(); for (const s of l.san) { try { g.move(s); } catch { break; } REP_POS.add(chave(g.fen())); } }
  return REP_POS;
}

/**
 * Abre o tabuleiro de análise. `ctx`: { camada, I, X, repertorio, aquecer, graficoAvaliacao, ligarGrafico, seloHTML,
 * reiEm, aoFechar }. `o`: { fen0, sans, tags, resultado, origem: "livre" | "pgn" | "fen" | "linha" | "salva", id, nome,
 * cur, cor, notas/mel/seg (de um registro salvo) }.
 */
export async function abrirAnalise(ctx, o = {}) {
  const { camada, I, X } = ctx;
  ctx.aquecer?.();
  const x = X();
  const st = {
    fen0: o.fen0 || P.INICIAL, principal: [...(o.sans || [])], vari: null, cur: 0, tags: { ...(o.tags || {}) }, resultado: o.resultado || null,
    origem: o.origem || "livre", id: o.id || null, nome: o.nome || "", livre: !["pgn", "salva"].includes(o.origem || "livre") || !(o.sans || []).length,
    sujo: false,
  };
  if (o.origem === "salva") st.livre = !!o.livre;
  const cache = new Map(); // chave da posição → { n (lado das brancas), mel, seg, prof, linhas? }
  // um registro salvo traz a análise de cada posição da partida
  if (o.notas) {
    const g = new Chess(st.fen0), fs = [st.fen0];
    for (const s of st.principal) { try { g.move(s); } catch { break; } fs.push(g.fen()); }
    fs.forEach((f, i) => { if (o.notas[i] != null) cache.set(chave(f), { n: o.notas[i], mel: o.mel?.[i] || null, seg: o.seg?.[i] ?? null, prof: o.prof || PROF_LOTE }); });
  }
  const rep = await ctx.repertorio?.().catch(() => null);
  const livroSet = await posicoesDoRepertorio(rep);
  const titulo = () => st.nome || (st.origem === "livre" ? "Tabuleiro livre" : st.origem === "fen" ? "A partir de uma posição" : P.nomeDaPartida(st.tags, "Análise"));

  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><span class="xz-p-tit xz-an-tit"></span><button class="xz-an-salvar" hidden>Salvar</button></div>
    <div class="xz-s-tab"></div>
    <div class="xz-an-motor" aria-live="polite"></div>
    <div class="xz-p-bts xz-an-nav"><button data-a="ini" aria-label="Início">${I.ini}</button><button data-a="ant" aria-label="Anterior">${I.ant}</button><button data-a="prox" aria-label="Próximo">${I.prox}</button><button data-a="fim" aria-label="Fim">${I.fim}</button>
      <button data-a="desfazer">${I.desfazer}<span>Desfazer</span></button><button data-a="virar">${I.virar}<span>Virar</span></button><button data-a="motor" class="xz-an-motor-bt">${I.dica}<span>Motor</span></button><button data-a="pgn">${I.livro}<span>Copiar PGN</span></button></div>
    <div class="xz-an-lance"></div>
    <div class="xz-an-var" hidden></div>
    <div class="xz-an-lista"></div>
    <div class="xz-an-partida"></div>`, "analise");
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"), { orientacao: o.cor || "w" });
  tab.avaliacao({ cp: 0 });
  const $ = (s) => ov.querySelector(s);
  let fens = [], mvs = []; // as posições e os lances da linha que está no tabuleiro (partida, ou partida + variante)
  let fensP = [], mvsP = []; // as da partida (principal)
  const motorLigado = () => x.cfg.analiseMotor !== false;

  const linhaAtual = () => (st.vari ? st.principal.slice(0, st.vari.base).concat(st.vari.sans) : st.principal);
  function jogarLinha(sans) {
    const g = new Chess(st.fen0), fs = [st.fen0], ms = [];
    for (const s of sans) { let mv; try { mv = g.move(s); } catch { break; } ms.push(mv); fs.push(g.fen()); }
    return [fs, ms];
  }
  function recalcular() {
    [fensP, mvsP] = jogarLinha(st.principal);
    if (st.principal.length !== mvsP.length) st.principal.length = mvsP.length;
    [fens, mvs] = st.vari ? jogarLinha(linhaAtual()) : [fensP, mvsP];
    st.cur = Math.max(0, Math.min(st.cur, fens.length - 1));
  }
  // os lances da partida que ainda estão no repertório (do começo, sem sair dele) viram Livro
  const livroAte = (ms, fs) => { if (st.fen0 !== P.INICIAL) return 0; let i = 0; while (i < ms.length && i < 40 && livroSet.has(chave(fs[i + 1]))) i++; return i; };
  function classe(i, fs = fens, ms = mvs, livro = null) {
    const mv = ms[i]; if (!mv) return null;
    if (i < (livro ?? livroAte(ms, fs))) return { tipo: "livro" };
    const t = terminal(fs[i + 1]);
    const a = cache.get(chave(fs[i])), d = t ? { n: notaTerminal(t), prof: 99 } : cache.get(chave(fs[i + 1]));
    if (!a || !d || !a.mel) return null;
    const memo = `${chave(fs[i])}|${chave(fs[i + 1])}|${a.n}|${a.seg}|${a.mel}|${d.n}|${mv.san}`;
    if (memoClasse.has(memo)) return memoClasse.get(memo);
    const s = mv.color === "w" ? 1 : -1;
    const antes = { cp: s * a.n, melhor: a.mel, linhas: [{ cp: s * a.n }, ...(a.seg != null ? [{ cp: s * a.seg }] : [])] };
    const c = { ...classificar({ antes, depois: { cp: -s * d.n }, uci: mv.from + mv.to + (mv.promotion || ""), fenDepois: fs[i + 1] }), mel: a.mel };
    memoClasse.set(memo, c);
    return c;
  }
  const memoClasse = new Map();
  const terminais = new Map();
  const terminal = (fen) => {
    if (!terminais.has(fen)) { const g = new Chess(fen); terminais.set(fen, !g.isGameOver() ? null : g.isCheckmate() ? (g.turn() === "w" ? "b" : "w") : "="); }
    return terminais.get(fen);
  };
  function notaTerminal(t) { return t === "w" ? 10000 : t === "b" ? -10000 : 0; }
  function guardar(fen, r, { vivo = false } = {}) {
    if (!r) return;
    const k = chave(fen), s = fen.split(" ")[1] === "w" ? 1 : -1, ant = cache.get(k);
    if (ant && ant.prof > (r.prof || 0)) return;
    if (!r.linhas?.length && r.cp == null && r.mate == null) return;
    cache.set(k, { n: s * notaDe(r), mel: r.melhor || r.linhas?.[0]?.lance || null, seg: r.linhas?.[1] ? s * notaDe(r.linhas[1]) : null, prof: r.prof || 0, ...(vivo ? { linhas: r.linhas.map(l => ({ pv: l.pv, n: s * notaDe(l) })) } : {}) });
  }

  // ---------------- desenho
  function pintar() {
    const fen = fens[st.cur], u = mvs[st.cur - 1], g = new Chess(fen);
    tab.posicao(fen, { ultimo: u ? [u.from, u.to] : null, xeque: g.inCheck() ? ctx.reiEm(g) : null });
    const c = st.cur ? classe(st.cur - 1) : null;
    tab.selo(c && x.cfg.selos !== false ? u.to : null, c?.tipo || "livro");
    $(".xz-an-tit").textContent = titulo();
    $(".xz-an-salvar").hidden = !(st.sujo && st.principal.length);
    $('[data-a="motor"]').classList.toggle("on", motorLigado());
    pintarMotor(); pintarLance(); pintarLista(); pintarPartida();
  }
  function pintarMotor() {
    const el = $(".xz-an-motor"), fen = fens[st.cur], t = terminal(fen), e = cache.get(chave(fen));
    if (t) {
      tab.avaliacao({ fim: t }); tab.setas([]);
      el.innerHTML = `<div class="xz-an-cab"><b class="xz-an-av">${t === "=" ? "½-½" : t === "w" ? "1-0" : "0-1"}</b><span>${t === "=" ? "Empate" : `Xeque-mate: as ${t === "w" ? "brancas" : "pretas"} venceram`}</span></div>`;
      return;
    }
    if (!motorLigado()) { tab.setas([]); el.innerHTML = `<div class="xz-an-cab desligado"><b class="xz-an-av">—</b><span>Motor desligado</span></div>`; return; }
    if (e) tab.avaliacao(avDoNumero(e.n));
    const rodando = !!vivo && !vivo.parado && vivo.fen === fen;
    const linhas = e?.linhas || (e?.mel ? [{ pv: [e.mel], n: e.n }] : []);
    tab.setas(e?.mel ? [{ de: e.mel.slice(0, 2), para: e.mel.slice(2, 4), cor: "azul" }] : []);
    el.innerHTML = `<div class="xz-an-cab"><b class="xz-an-av">${e ? textoNota(e.n) : "…"}</b><span>Stockfish 19${e?.prof ? ` · prof. ${e.prof}` : ""}${lote ? " · analisando a partida" : rodando ? ` <i class="xz-pensando">pensando…</i>` : ""}</span></div>
      <div class="xz-an-linhas">${linhas.slice(0, LINHAS).map((l, i) => `<button data-l="${i}"><b>${textoNota(l.n)}</b><span>${linhaPT(fen, l.pv, 9).map((s, k) => (k ? escapar(s) : `<strong>${escapar(s)}</strong>`)).join(" ")}</span></button>`).join("") || `<p class="xz-dica-g">Calculando…</p>`}</div>`;
    el.querySelectorAll("[data-l]").forEach(b => (b.onclick = () => { const l = linhas[+b.dataset.l]; if (l?.pv?.[0]) mover(l.pv[0].slice(0, 2), l.pv[0].slice(2, 4), l.pv[0][4]); }));
  }
  function pintarLance() {
    const el = $(".xz-an-lance");
    if (!st.cur) { el.innerHTML = `<p class="xz-dica-g">${st.principal.length ? "Posição inicial. Avance com as setas, toque num lance da lista ou mexa as peças para testar outra ideia." : "Mexa as peças dos dois lados: o Stockfish avalia cada posição."}</p>`; return; }
    const mv = mvs[st.cur - 1], c = classe(st.cur - 1), num = `${numeroDe(fens[st.cur - 1])}${mv.color === "w" ? "." : "..."}`;
    let melhor = "";
    if (c?.mel && c.tipo !== "livro" && !["melhor", "brilhante", "otimo"].includes(c.tipo) && c.mel !== mv.from + mv.to + (mv.promotion || "")) {
      const g = new Chess(fens[st.cur - 1]); let m2 = null; try { m2 = g.move({ from: c.mel.slice(0, 2), to: c.mel.slice(2, 4), promotion: c.mel[4] }); } catch { /* */ }
      if (m2) melhor = `<p class="xz-an-melhor">O motor jogaria <b>${escapar(sanPT(m2.san))}</b>${cache.get(chave(fens[st.cur - 1])) ? ` (${textoNota(cache.get(chave(fens[st.cur - 1])).n)})` : ""}.</p>`;
    }
    el.innerHTML = `<div class="xz-an-l ${c?.tipo || ""}"><div class="xz-an-l-cab"><b class="xz-not">${escapar(num + sanPT(mv.san))}</b>${c ? `${ctx.seloHTML(c.tipo)}<span>${escapar(SELOS[c.tipo]?.nome || "")}</span>` : `<span class="xz-dica-g">${lote ? "analisando…" : ""}</span>`}</div>
      <p class="xz-frase">${escapar(fraseLance(mv))}</p>${melhor}</div>`;
  }
  const lanceHTML = (mv, i, fs, ms, livro, base = 0, ativo = false) => {
    const c = classe(i, fs, ms, livro);
    const n = mv.color === "w" ? `<i>${numeroDe(fs[i])}.</i>` : i === base ? `<i>${numeroDe(fs[i])}...</i>` : "";
    return `${n}<span data-i="${i + 1}" class="${ativo ? "on" : ""} ${c?.tipo === "livro" ? "livro" : ""} ${c && CLASSES_RUINS.includes(c.tipo) ? "ruim " + c.tipo : ""}">${escapar(sanPT(mv.san))}${c && c.tipo !== "livro" && c.tipo !== "melhor" && c.tipo !== "excelente" && c.tipo !== "bom" ? ctx.seloHTML(c.tipo) : ""}</span>`;
  };
  function pintarLista() {
    const el = $(".xz-an-lista"), lv = livroAte(mvsP, fensP), naPartida = !st.vari || st.cur <= st.vari.base;
    el.innerHTML = mvsP.length ? `<small class="xz-sobre">${st.origem === "livre" || st.origem === "fen" ? "Lances" : "A partida"}${st.resultado && st.resultado !== "*" ? ` · ${escapar(st.resultado)}` : ""}</small><div class="xz-an-lances">${mvsP.map((mv, i) => lanceHTML(mv, i, fensP, mvsP, lv, 0, naPartida && st.cur === i + 1)).join(" ")}</div>` : "";
    el.querySelectorAll("[data-i]").forEach(sp => (sp.onclick = () => { const i = +sp.dataset.i; if (st.vari && i > st.vari.base) { st.vari = null; recalcular(); } ir(i); }));
    const v = $(".xz-an-var");
    v.hidden = !st.vari;
    if (st.vari) {
      const b = st.vari.base, lvv = livroAte(mvs, fens);
      v.innerHTML = `<div class="xz-an-var-cab"><small class="xz-sobre">Variante (o seu teste)</small><button data-a="voltar-partida">${st.livre ? "Voltar aos lances" : "Voltar à partida"}</button></div><div class="xz-an-lances">${mvs.slice(b).map((mv, k) => lanceHTML(mv, b + k, fens, mvs, lvv, b, st.cur === b + k + 1)).join(" ")}</div>`;
      v.querySelectorAll("[data-i]").forEach(sp => (sp.onclick = () => ir(+sp.dataset.i)));
      v.querySelector('[data-a="voltar-partida"]').onclick = () => { const b2 = st.vari.base; st.vari = null; recalcular(); ir(b2); };
    }
    // a lista rola por dentro (o tabuleiro não sai da tela)
    const on = (st.vari && !naPartida ? v : el).querySelector(".on"), cx = on?.closest(".xz-an-lances");
    if (on && cx) { const t = on.offsetTop - cx.offsetTop; if (t < cx.scrollTop || t > cx.scrollTop + cx.clientHeight - on.offsetHeight) cx.scrollTop = Math.max(0, t - cx.clientHeight / 2); }
  }
  function pintarPartida() {
    const el = $(".xz-an-partida"), N = mvsP.length;
    if (N < 2) { el.innerHTML = ""; return; }
    const notas = fensP.map(f => { const t = terminal(f); return t ? notaTerminal(t) : cache.get(chave(f))?.n ?? null; });
    const falta = notas.filter(n => n == null).length;
    if (lote) {
      const pct = Math.round((lote.feitas / lote.total) * 100);
      el.innerHTML = `<div class="xz-an-prog"><div><b>Analisando a partida…</b><small>${lote.feitas} de ${lote.total} posições</small></div><span class="xz-s-barra"><i style="width:${pct}%"></i></span><button class="botao secundario" data-a="cancelar">Cancelar</button></div>`;
      el.querySelector('[data-a="cancelar"]').onclick = cancelarLote;
      return;
    }
    if (falta) {
      el.innerHTML = `<div class="xz-an-convite"><p class="xz-dica-g">${falta === notas.length ? "" : `Faltam ${falta} posições. `}O Stockfish confere cada lance (${N} lances, profundidade ${PROF_LOTE}): a avaliação ao longo da partida, a classificação e a precisão de cada lado.</p><button class="botao" data-a="analisar">Analisar a partida</button></div>`;
      el.querySelector('[data-a="analisar"]').onclick = analisarTudo;
      return;
    }
    const lv = livroAte(mvsP, fensP), cls = mvsP.map((_, i) => classe(i, fensP, mvsP, lv)?.tipo || null);
    const prec = precisaoDaPartida(notas, mvsP.map(m => m.color));
    const erros = cls.map((c, i) => (c === "erro" || c === "capivarada" ? i : -1)).filter(i => i >= 0);
    const conta = (c, cor) => cls.filter((t, i) => t === c && mvsP[i].color === cor).length;
    el.innerHTML = `${ctx.graficoAvaliacao(notas, erros, null)}
      <div class="xz-an-prec">${["w", "b"].map(c => `<div><span class="xz-jog-cor ${c}"></span><b>${prec[c] ?? "—"}${prec[c] != null ? "%" : ""}</b><small>precisão das ${c === "w" ? "brancas" : "pretas"}${(c === "w" ? st.tags.White : st.tags.Black) && (c === "w" ? st.tags.White : st.tags.Black) !== "?" ? ` · ${escapar(c === "w" ? st.tags.White : st.tags.Black)}` : ""}</small></div>`).join("")}</div>
      <table class="xz-an-tabela"><thead><tr><th></th><th>Brancas</th><th>Pretas</th></tr></thead><tbody>${ORDEM.filter(c => conta(c, "w") + conta(c, "b")).map(c => `<tr><td>${ctx.seloHTML(c)}${escapar(SELOS[c]?.nome || c)}</td><td>${conta(c, "w")}</td><td>${conta(c, "b")}</td></tr>`).join("")}</tbody></table>
      ${erros.length ? `<div class="xz-an-ruins">${erros.map(i => `<button data-i="${i + 1}">${ctx.seloHTML(cls[i])}${escapar(`${numeroDe(fensP[i])}${mvsP[i].color === "w" ? "." : "..."}${sanPT(mvsP[i].san)}`)}</button>`).join("")}</div>` : ""}`;
    ctx.ligarGrafico(el, fensP, mvsP, tab, (k) => { if (st.vari) { st.vari = null; recalcular(); } ir(k); });
    el.querySelectorAll(".xz-an-ruins [data-i]").forEach(b => (b.onclick = () => { if (st.vari) { st.vari = null; recalcular(); } ir(+b.dataset.i); }));
    // cursor do gráfico na posição aberta
    const cur = el.querySelector(".xz-grafico .cursor"), naP = !st.vari || st.cur <= st.vari.base;
    if (cur && naP) { cur.setAttribute("x1", (st.cur / N) * 100); cur.setAttribute("x2", (st.cur / N) * 100); }
  }

  // ---------------- motor
  let vivo = null, timer = null, lote = null, raf = 0;
  function pensarDepois() { clearTimeout(timer); timer = setTimeout(pensar, 160); }
  function pensar() {
    if (!ov.isConnected || lote || !motorLigado()) return;
    const fen = fens[st.cur];
    if (vivo && !vivo.parado && vivo.fen === fen) return;
    M.cancelar(vivo); vivo = null;
    if (terminal(fen)) return;
    const e = cache.get(chave(fen));
    if (e && e.prof >= PROF_VIVO && e.linhas) return;
    const s = (vivo = { fen });
    const repintar = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (ov.isConnected && fens[st.cur] === fen) { pintarMotor(); } }); };
    M.analisar(fen, { prof: PROF_VIVO, multipv: LINHAS, sinal: s, aoInfo: (r) => { if (!s.parado && r.prof >= 8) { guardar(fen, r, { vivo: true }); repintar(); } } })
      .then(r => { if (s === vivo) vivo = null; if (r && !s.parado) guardar(fen, r, { vivo: true }); if (ov.isConnected && fens[st.cur] === fen) { pintarMotor(); pintarLance(); } })
      .catch(e2 => console.warn("Stockfish:", e2));
    pintarMotor();
  }
  async function analisarTudo() {
    if (lote || mvsP.length < 1) return;
    M.cancelar(vivo); vivo = null;
    const alvo = fensP.slice(), sinal = {};
    lote = { sinal, feitas: 0, total: alvo.length };
    pintar();
    for (let i = 0; i < alvo.length; i++) {
      if (sinal.parado || !ov.isConnected) break;
      const f = alvo[i], e = cache.get(chave(f));
      if (!terminal(f) && !(e && e.prof >= PROF_LOTE && e.mel)) {
        const r = await M.analisar(f, { prof: PROF_LOTE, multipv: 2, sinal });
        if (!r || sinal.parado) break;
        guardar(f, r);
      }
      lote.feitas = i + 1;
      if (ov.isConnected) { pintarPartida(); if (i % 3 === 0 || i === alvo.length - 1) { pintarLista(); if (fens[st.cur] === f || fens[st.cur - 1] === f) pintarLance(); } }
    }
    const completo = lote && !sinal.parado && lote.feitas === alvo.length;
    lote = null;
    if (!ov.isConnected) return;
    if (completo && (st.id || st.origem === "pgn" || st.origem === "salva")) salvarAnalise({ silencioso: true });
    pintar(); pensarDepois();
  }
  function cancelarLote() { if (!lote) return; M.cancelar(lote.sinal); lote = null; pintar(); pensarDepois(); }

  // ---------------- lances e navegação
  function ir(k) { st.cur = Math.max(0, Math.min(fens.length - 1, k)); pintar(); pensarDepois(); }
  function mover(de, para, promo) {
    const g = new Chess(fens[st.cur]); let mv;
    try { mv = g.move(promo ? { from: de, to: para, promotion: promo } : { from: de, to: para }); } catch { return false; }
    const linha = linhaAtual(), san = mv.san;
    if (st.cur < linha.length && linha[st.cur] === san) { ir(st.cur + 1); return true; }
    if (!st.vari) {
      if (st.cur === st.principal.length && st.livre) { st.principal.push(san); st.sujo = true; }
      else st.vari = { base: st.cur, sans: [san] };
    } else if (st.cur >= st.vari.base) st.vari.sans = st.vari.sans.slice(0, st.cur - st.vari.base).concat(san);
    else st.vari = { base: st.cur, sans: [san] };
    recalcular(); ir(st.cur + 1);
    return true;
  }
  tab._f = {
    legais: (casa) => (lote ? [] : new Chess(fens[st.cur]).moves({ square: casa, verbose: true }).map(m => ({ to: m.to, promotion: m.promotion }))),
    aoMover: (a, b, promo) => { mover(a, b, promo); },
  };
  function desfazer() {
    if (st.vari) { st.vari.sans.pop(); const b = st.vari.base; if (!st.vari.sans.length) st.vari = null; recalcular(); ir(Math.min(st.cur, st.vari ? st.vari.base + st.vari.sans.length : b)); return; }
    if (st.livre && st.principal.length) { st.principal.pop(); st.sujo = true; recalcular(); ir(Math.min(st.cur, st.principal.length)); return; }
    if (st.principal.length) toast("Numa partida importada, o desfazer vale nos lances que você testa (a variante). Use as setas para voltar na partida.");
  }
  function salvarAnalise({ silencioso = false } = {}) {
    if (!st.principal.length && st.fen0 === P.INICIAL) { toast("Jogue algum lance antes de salvar."); return; }
    const notas = fensP.map(f => { const t = terminal(f); return t ? notaTerminal(t) : cache.get(chave(f))?.n ?? null; });
    const completo = notas.every(n => n != null);
    st.id ||= `an-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const tg = {}; for (const k of ["Event", "Site", "Date", "White", "Black", "Result", "WhiteElo", "BlackElo", "ECO", "Opening", "TimeControl"]) if (st.tags[k]) tg[k] = String(st.tags[k]).slice(0, 80);
    const reg = {
      id: st.id, em: new Date().toISOString(), nome: titulo(), origem: st.origem === "salva" ? (o.origemAntes || "pgn") : st.origem, livre: st.livre,
      tags: tg, resultado: st.resultado || null, fen0: st.fen0, sans: st.principal.slice(0, 600), cor: tab.orientacao,
      ...(notas.some(n => n != null) ? { notas, mel: fensP.map(f => cache.get(chave(f))?.mel || null), seg: fensP.map(f => cache.get(chave(f))?.seg ?? null), prof: PROF_LOTE } : {}),
      ...(completo && mvsP.length >= 2 ? { prec: precisaoDaPartida(notas, mvsP.map(m => m.color)) } : {}),
    };
    o.origemAntes = reg.origem;
    guardarRegistro(reg); st.sujo = false;
    if (!silencioso) toast("Análise salva em Treinar → Tabuleiro de análise.");
    pintar();
  }
  ov._an = { st, mover, ir, cache, salvar: salvarAnalise, analisarTudo, cancelarLote, tab, get lote() { return lote; }, get fens() { return fens; } }; // para o teste de fumaça
  $(".xz-an-salvar").onclick = () => salvarAnalise();
  const fechar = () => { M.cancelar(vivo); if (lote) M.cancelar(lote.sinal); lote = null; clearTimeout(timer); document.removeEventListener("keydown", tecla); ov.remove(); ctx.aoFechar?.(); };
  $(".xz-s-fechar").onclick = fechar;
  $(".xz-an-nav").addEventListener("click", async (e) => {
    const a = e.target.closest("button")?.dataset.a; if (!a) return;
    if (a === "ini") ir(st.vari ? st.vari.base > 0 && st.cur > st.vari.base ? st.vari.base : 0 : 0);
    else if (a === "ant") ir(st.cur - 1);
    else if (a === "prox") ir(st.cur + 1);
    else if (a === "fim") ir(fens.length - 1);
    else if (a === "desfazer") desfazer();
    else if (a === "virar") { tab.virar(); pintar(); if (st.id) st.sujo = true; }
    else if (a === "motor") { x.cfg.analiseMotor = !motorLigado(); salvar(); if (!motorLigado()) { M.cancelar(vivo); vivo = null; } pintar(); pensarDepois(); toast(motorLigado() ? "Motor ligado." : "Motor desligado: pense sem ajuda."); }
    else if (a === "pgn") {
      const txt = P.montarPGN({ tags: st.tags, fen0: st.fen0, sans: st.principal, resultado: st.resultado || "*" });
      try { await navigator.clipboard.writeText(txt); toast("PGN copiado."); } catch { toast("Não deu para copiar aqui."); }
    }
  });
  // atalhos do teclado (notebook): setas
  const tecla = (e) => { if (!ov.isConnected) { document.removeEventListener("keydown", tecla); return; } if (e.target.closest?.("input, textarea")) return; if (e.key === "ArrowLeft") { ir(st.cur - 1); e.preventDefault(); } else if (e.key === "ArrowRight") { ir(st.cur + 1); e.preventDefault(); } };
  document.addEventListener("keydown", tecla);

  recalcular();
  st.cur = o.cur != null ? o.cur : st.origem === "pgn" || st.origem === "salva" ? 0 : fens.length - 1;
  recalcular();
  if (o.origem === "pgn" && !o.id) salvarAnalise({ silencioso: true }); // partida importada entra na lista na hora
  pintar(); pensarDepois();
  return ov;
}

/**
 * A folha de importar: colar PGN ou FEN (o botão "Colar" lê a área de transferência), com várias partidas no texto
 * a escolher. `aoAbrir({ fen0, sans, tags, resultado, origem })`.
 */
export function abrirImportar(ctx, aoAbrir) {
  const { camada, I } = ctx;
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><span class="xz-p-tit">Importar partida</span></div>
    <div class="xz-imp">
      <p class="xz-dica-g">Cole o PGN de uma partida (no chess.com: Compartilhar → PGN; no lichess: Compartilhar e exportar → PGN) ou uma posição em FEN. Comentários, relógio, variantes e marcas como ?! são ignorados.</p>
      <textarea class="xz-imp-txt" rows="9" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder='[White "Você"]&#10;[Black "Adversário"]&#10;&#10;1. e4 e5 2. Cf3 Cc6 …&#10;&#10;ou uma FEN: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'></textarea>
      <div class="xz-imp-bts"><button class="botao secundario" data-a="colar">Colar</button><button class="botao" data-a="abrir">Abrir</button></div>
      <div class="xz-imp-msg"></div>
    </div>`, "importar");
  const txt = ov.querySelector(".xz-imp-txt"), msg = ov.querySelector(".xz-imp-msg");
  ov.querySelector(".xz-s-fechar").onclick = () => ov.remove();
  ov.querySelector('[data-a="colar"]').onclick = async () => { try { txt.value = await navigator.clipboard.readText(); } catch { toast("Toque e segure na caixa para colar."); txt.focus(); } };
  const abrir = (texto) => {
    const r = P.abrirPartida(texto);
    if (r.erro) { msg.innerHTML = `<p class="xz-imp-erro">${escapar(r.erro)}</p>`; return; }
    if (r.parou) toast(`O lance ${r.parou.numero}${r.parou.san} não é possível nessa posição: a partida abre até o lance de antes.`);
    ov.remove();
    aoAbrir({ ...r, origem: r.tipo === "fen" ? "fen" : r.sans.length ? "pgn" : "fen" });
  };
  ov.querySelector('[data-a="abrir"]').onclick = () => {
    const partes = P.separarPartidas(txt.value);
    if (partes.length <= 1) return abrir(txt.value);
    msg.innerHTML = `<small class="xz-sobre">${partes.length} partidas no texto: escolha uma</small><div class="xz-imp-lista">${partes.map((p, i) => { const l = P.lerPGN(p); return `<button data-i="${i}"><b>${escapar(P.nomeDaPartida(l.tags, `Partida ${i + 1}`))}</b><small>${escapar([l.tags.Date, `${Math.ceil(l.lances.length / 2)} lances`, l.resultado].filter(Boolean).join(" · "))}</small></button>`; }).join("")}</div>`;
    msg.querySelectorAll("[data-i]").forEach(b => (b.onclick = () => abrir(partes[+b.dataset.i])));
  };
  setTimeout(() => txt.focus({ preventScroll: true }), 350);
  return ov;
}

/** Escolher uma linha do repertório para começar a análise dela. */
export function escolherLinha(ctx, rep, aoEscolher) {
  const { camada, I } = ctx;
  const ov = camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Fechar">${I.fechar}</button><span class="xz-p-tit">Começar de uma linha</span></div>
    <div class="xz-an-rep">${(rep?.capitulos || []).map(c => `<details class="xz-capitulo"><summary><span class="xz-lado ${c.lado}">${c.lado === "brancas" ? "Brancas" : "Pretas"}</span><b>${escapar(c.nome)}</b><small>${c.linhas.length}</small></summary>
      ${c.linhas.map(l => `<button class="xz-an-rep-l" data-l="${escapar(l.id)}"><b>${escapar(l.nome)}</b><small>${escapar(l.eco || "")} · ${escapar(l.san.slice(0, 6).map((s, i) => (i % 2 ? sanPT(s) : `${i / 2 + 1}.${sanPT(s)}`)).join(" "))}…</small></button>`).join("")}</details>`).join("")}</div>`, "escolher-linha");
  ov.querySelector(".xz-s-fechar").onclick = () => ov.remove();
  ov.querySelectorAll("[data-l]").forEach(b => (b.onclick = () => {
    for (const c of rep.capitulos) { const l = c.linhas.find(y => y.id === b.dataset.l); if (l) { ov.remove(); aoEscolher(l, c); return; } }
  }));
  return ov;
}
