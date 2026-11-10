// A retrospectiva animada da Eva (pedido do Alediov, 05/11/2026: "depois de meses de estatísticas, quero que uma
// animação seja feita, com alguma das músicas mais ouvidas de fundo"). Com 3 ou mais resumos do mês guardados
// (resumoMes.js, E().eva.meses), na 1ª abertura de fevereiro, maio, agosto e novembro ela oferece a dos 3 meses
// anteriores e, em janeiro, a do ano inteiro. Tela cheia no formato dos stories (~30 a 60 s): abertura, um cartão
// por mês com os números contando, os recordes do período e o fechamento. De fundo, a música mais tocada do período
// que estiver na biblioteca deste aparelho, pelo 2º tocador das Músicas (o do álbum Estudos: volume com fade, para
// ao fechar); sem ela, roda em silêncio com um aviso. Tocar à direita avança, à esquerda volta, o botão pausa, o X
// fecha. Com "reduzir movimento", sem contagem nem movimento (só a troca dos cartões).
// `retroDaVez` e `destaques` são puros (node tools/teste_eva.mjs). Sem o humor dele, valores das Finanças, Scanner,
// Cofre ou WhatsApp (os mesmos números da imagem do mês).
import { nomeMes, mesAnterior, quadrosDoMes } from "./resumoMes.js";

export const MESES_DA_RETRO = [1, 2, 5, 8, 11];
export const MINIMO_RESUMOS = 3;

/** A retrospectiva que cabe no mês `mesAtual` ("AAAA-MM"), com os meses que têm resumo. → { chave, titulo, meses } | null */
export function retroDaVez(mesAtual, comResumo = []) {
  const tem = new Set(comResumo), [a, m] = mesAtual.split("-").map(Number);
  if (tem.size < MINIMO_RESUMOS || !MESES_DA_RETRO.includes(m)) return null;
  let periodo, titulo;
  if (m === 1) { periodo = Array.from({ length: 12 }, (_, i) => `${a - 1}-${String(i + 1).padStart(2, "0")}`); titulo = `O seu ${a - 1}`; }
  else { periodo = [3, 2, 1].map(n => mesAnterior(mesAtual, n)); titulo = `${cap(nomeMes(periodo[0], { ano: false }))} a ${nomeMes(periodo[2], { ano: false })}`; }
  const meses = periodo.filter(x => tem.has(x));
  if (meses.length < 2) return null;
  return { chave: mesAtual, titulo, meses, ano: m === 1 };
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Os recordes do período (resumos de calcularMes). */
export function destaques(rs) {
  const soma = (k) => rs.reduce((s, r) => s + (r[k] || 0), 0);
  const melhor = [...rs].sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];
  const seq = [...rs].sort((a, b) => (b.seqMax || 0) - (a.seqMax || 0))[0];
  const musMin = rs.reduce((s, r) => s + (r.musica?.min || 0), 0);
  const musica = [...rs].filter(r => r.musica?.titulo).sort((a, b) => (b.musica.min || 0) - (a.musica.min || 0))[0]?.musica || null;
  return { xp: soma("xp"), licoes: soma("licoes"), dias: soma("dias"), leituraUn: soma("leituraUn"), partidas: soma("partidas"), focoMin: soma("focoMin"),
    melhorMes: melhor && melhor.xp ? { mes: melhor.mes, xp: melhor.xp } : null, seqMax: seq && seq.seqMax ? { mes: seq.mes, n: seq.seqMax } : null, musicaMin: musMin, musica };
}

/** A música mais tocada no período que existe na biblioteca deste aparelho (ou null). */
export async function musicaDoPeriodo(meses) {
  try {
    const BD = await import("../musicas/banco.js");
    const [reps, fs] = await Promise.all([BD.todasReproducoes(), BD.todasFaixas()]);
    const ids = new Set(fs.map(f => f.id)), conta = new Map();
    const dentro = (t) => { const d = new Date(t), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; return meses.includes(k); };
    for (const r of reps) if (r.tipo === "tocada" && ids.has(r.id) && dentro(r.em)) conta.set(r.id, (conta.get(r.id) || 0) + 1);
    const top = [...conta].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => fs.find(f => f.id === id));
    return top[0] || null;
  } catch { return null; }
}

// ---------------------------------------------------------------- a tela
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = (v) => Math.round(v || 0).toLocaleString("pt-BR");
const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${Math.round(min || 0)} min`);
const reduzir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const IC = {
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  pausa: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>`,
  tocar: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`,
};

function slides(rs, info) {
  const d = destaques(rs), dur = info.ano ? 4200 : 6000, l = [];
  l.push({ dur: 4500, tipo: "abre", html: `<p class="eva-rt-pre">Sua retrospectiva</p><h2 class="eva-rt-tit">${esc(info.titulo)}</h2>
    <div class="eva-rt-eva vivo">${info.eva("animada")}</div>
    <p class="eva-rt-sub">${rs.length} meses de Órbita. Vem ver o que você fez.</p>${info.musica ? `<p class="eva-rt-som">♪ ${esc(info.musica.titulo)} · ${esc(info.musica.artista || "")}</p>` : `<p class="eva-rt-som eva-rt-mudo">${esc(info.semSom || "Sem música desta vez")}</p>`}` });
  for (const r of rs) {
    const qs = quadrosDoMes(r).slice(0, 4);
    l.push({ dur, tipo: "mes", html: `<p class="eva-rt-pre">${esc(cap(nomeMes(r.mes, { ano: false })))}</p>
      <div class="eva-rt-xp"><b data-conta="${r.xp || 0}">0</b><span>XP</span></div>
      <p class="eva-rt-sub"><b data-conta="${r.licoes || 0}">0</b> ${r.licoes === 1 ? "lição" : "lições"} · <b data-conta="${r.dias || 0}">0</b> dias estudados</p>
      <div class="eva-rt-qs">${qs.map(([a, v, x], i) => `<div class="eva-rt-q" style="--i:${i}"><small>${esc(a)}</small><b>${esc(v)}</b>${x ? `<em>${esc(x)}</em>` : ""}</div>`).join("")}</div>
      ${r.musica?.titulo ? `<p class="eva-rt-mus">♪ <b>${esc(r.musica.titulo)}</b> foi a música do mês</p>` : ""}` });
  }
  const rec = [
    d.melhorMes ? ["Melhor mês", cap(nomeMes(d.melhorMes.mes, { ano: false })), `${n(d.melhorMes.xp)} XP`] : null,
    d.seqMax ? ["Maior sequência", `${d.seqMax.n} dias`, `em ${nomeMes(d.seqMax.mes, { ano: false })}`] : null,
    ["Lições no período", n(d.licoes), `${n(d.dias)} dias estudando`],
    d.leituraUn ? ["Leitura", `${n(d.leituraUn)} unidades`, ""] : null,
    d.partidas ? ["Xadrez", `${n(d.partidas)} partidas`, ""] : null,
    d.musicaMin ? ["Música", horas(d.musicaMin), d.musica?.titulo ? `mais: ${d.musica.titulo}` : ""] : null,
  ].filter(Boolean).slice(0, 5);
  l.push({ dur: 6500, tipo: "recordes", html: `<p class="eva-rt-pre">Os seus recordes</p><div class="eva-rt-xp"><b data-conta="${d.xp}">0</b><span>XP no total</span></div>
    <div class="eva-rt-rec">${rec.map(([a, v, x], i) => `<div class="eva-rt-q" style="--i:${i}"><small>${esc(a)}</small><b>${esc(v)}</b>${x ? `<em>${esc(x)}</em>` : ""}</div>`).join("")}</div>` });
  l.push({ dur: 6000, tipo: "fim", html: `<div class="eva-rt-eva vivo">${info.eva("orgulhosa")}</div><h2 class="eva-rt-tit">Que orgulho, ${esc(info.nome)}!</h2>
    <p class="eva-rt-sub">Cada lição contou. Bora para os próximos meses?</p><button type="button" class="eva-rt-fechar-fim">Fechar</button>` });
  return l;
}

let aberta = null;
/**
 * Abre a retrospectiva por cima de `camada` (ou do body). o: { resumos (calcularMes), titulo, ano, nome, meses (para
 * achar a música), musica: faixa | null | undefined (undefined = procura a mais tocada) }. → { fechar, ir(i), estado() }
 */
export async function abrirRetro(camada, o = {}) {
  aberta?.fechar();
  const { eva } = await import("../arte/eva.js");
  const rs = (o.resumos || []).slice().sort((a, b) => (a.mes < b.mes ? -1 : 1));
  let musica = o.musica === undefined ? await musicaDoPeriodo(o.meses || rs.map(r => r.mes)) : o.musica;
  let M = null, podeTocar = false, semSom = "";
  if (musica) {
    try { M = (await import("../musicas/motor.js")).motor; podeTocar = M.nativo || !!M._arquivos?.has(musica.id); } catch { M = null; }
    if (!podeTocar) semSom = "Sem música: abra as Músicas neste aparelho";
  } else semSom = "Sem música desta vez";
  if (!podeTocar) musica = null;
  const info = { titulo: o.titulo || "Seus meses", ano: !!o.ano, nome: o.nome || "Alediov", musica, semSom, eva: (humor) => eva({ humor, capuz: false }) };
  const ls = slides(rs, info);
  const ov = document.createElement("div");
  ov.className = "eva-rt"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Sua retrospectiva");
  ov.innerHTML = `<div class="eva-rt-palco">
      <div class="eva-rt-barras">${ls.map(() => `<i><b></b></i>`).join("")}</div>
      <div class="eva-rt-topo"><button type="button" class="eva-rt-pausa" aria-label="Pausar">${IC.pausa}</button><button type="button" class="eva-rt-x" aria-label="Fechar">${IC.x}</button></div>
      <div class="eva-rt-cartao"></div>
      <button type="button" class="eva-rt-ant" aria-label="Anterior"></button><button type="button" class="eva-rt-prox" aria-label="Próximo"></button>
    </div>`;
  (camada?.isConnected ? camada : document.body).append(ov);
  const cartao = ov.querySelector(".eva-rt-cartao"), barras = [...ov.querySelectorAll(".eva-rt-barras b")];
  let i = -1, t0 = 0, gasto = 0, pausado = false, raf = 0, timer = 0, fechada = false;
  // a música de fundo (2º tocador das Músicas); a do app fica quieta enquanto isso
  let musicaApp = null;
  try { musicaApp = await import("../musica.js"); musicaApp.musicaEmFundo(true); } catch { musicaApp = null; }
  const vol = 0.75;
  if (musica && M) M.estudosTocar([musica.id], vol).then(r => { if (r?.ocupado) ov.querySelector(".eva-rt-som")?.append(" (a sua música já está tocando)"); }).catch(() => {});

  const contar = () => {
    const els = cartao.querySelectorAll("[data-conta]");
    if (reduzir()) { els.forEach(e => (e.textContent = n(+e.dataset.conta))); return; }
    const ini = performance.now(), D = 1300;
    const passo = (t) => {
      const k = Math.min(1, (t - ini) / D), e = 1 - Math.pow(1 - k, 3);
      els.forEach(x => (x.textContent = n(+x.dataset.conta * e)));
      if (k < 1 && !fechada) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  };
  const pintarBarras = () => barras.forEach((b, k) => { b.style.transform = `scaleX(${k < i ? 1 : k > i ? 0 : Math.min(1, gasto / ls[i].dur)})`; });
  const tique = () => {
    cancelAnimationFrame(raf);
    if (fechada || pausado) return;
    gasto = performance.now() - t0;
    pintarBarras();
    if (gasto >= ls[i].dur) { if (i < ls.length - 1) ir(i + 1); else terminar(); return; }
    raf = requestAnimationFrame(tique);
  };
  function ir(k) {
    if (fechada) return;
    i = Math.max(0, Math.min(ls.length - 1, k)); gasto = 0; t0 = performance.now();
    const s = ls[i];
    cartao.className = `eva-rt-cartao eva-rt-${s.tipo}`;
    cartao.innerHTML = s.html; void cartao.offsetWidth; cartao.classList.add("eva-rt-entra");
    cartao.querySelector(".eva-rt-fechar-fim")?.addEventListener("click", (e) => { e.stopPropagation(); fechar(); });
    contar(); pintarBarras();
    clearTimeout(timer);
    if (!pausado) raf = requestAnimationFrame(tique);
  }
  function terminar() { gasto = ls[i].dur; pintarBarras(); pausar(true); if (musica && M) M.estudosParar().catch(() => {}); }
  function pausar(v = !pausado) {
    pausado = v;
    ov.classList.toggle("eva-rt-pausada", pausado);
    const b = ov.querySelector(".eva-rt-pausa"); b.innerHTML = pausado ? IC.tocar : IC.pausa; b.setAttribute("aria-label", pausado ? "Continuar" : "Pausar");
    if (musica && M) M.estudosVolume(pausado ? 0 : vol).catch(() => {});
    if (!pausado) { t0 = performance.now() - gasto; raf = requestAnimationFrame(tique); }
  }
  function fechar() {
    if (fechada) return; fechada = true; cancelAnimationFrame(raf); clearTimeout(timer);
    if (musica && M) M.estudosParar().catch(() => {});
    try { musicaApp?.musicaEmFundo(false); } catch { /* */ }
    ov.classList.add("eva-rt-saindo");
    setTimeout(() => ov.remove(), reduzir() ? 0 : 220);
    if (aberta === api) aberta = null;
  }
  ov.querySelector(".eva-rt-x").onclick = (e) => { e.stopPropagation(); fechar(); };
  ov.querySelector(".eva-rt-pausa").onclick = (e) => { e.stopPropagation(); if (i === ls.length - 1 && gasto >= ls[i].dur) ir(0); else pausar(); };
  ov.querySelector(".eva-rt-ant").onclick = () => ir(i - 1);
  ov.querySelector(".eva-rt-prox").onclick = () => (i < ls.length - 1 ? ir(i + 1) : terminar());
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); else if (e.key === "ArrowRight") ir(i + 1); else if (e.key === "ArrowLeft") ir(i - 1); else if (e.key === " ") { e.preventDefault(); pausar(); } });
  const api = { fechar, ir: (k) => ir(k), pausar: (v) => pausar(v), estado: () => ({ i, total: ls.length, pausado, musica: musica?.id || null, tipo: ls[i]?.tipo }) };
  aberta = api;
  ov.querySelector(".eva-rt-x").focus({ preventScroll: true });
  ir(0);
  return api;
}
export const retroAberta = () => aberta;

/** Resumos de mentira (para testar a retrospectiva sem meses de dados). */
export function resumosDeTeste(fim = "2026-10", nMeses = 3) {
  const out = [];
  for (let k = nMeses - 1; k >= 0; k--) {
    const mes = mesAnterior(fim, k), j = nMeses - k;
    out.push({ mes, xp: 3200 + j * 900, licoes: 120 + j * 25, dias: 20 + j, diasNoMes: 30, seqMax: 8 + j * 3, acerto: 0.7 + j * 0.04, questoes: 600 + j * 40, melhorDia: null,
      leituraUn: 10 + j * 2, leituraMin: 300 + j * 30, xadrezMin: 200, partidas: 4 + j, desafios: 18 + j, focoMin: 240 + j * 20, sims: { n: 12 + j, media: 7 + j * 0.3 },
      musica: { min: 1500 + j * 200, titulo: ["Lua", "Estrelas", "Estrondo"][j % 3], artista: "Anny", artistaTop: "Anny", id: null } });
  }
  return out;
}
