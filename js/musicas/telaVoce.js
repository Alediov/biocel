// "Você e a música" nas Estatísticas das Músicas (pedido do Alediov, 04/11/2026): volume (do aparelho e das músicas),
// clima (das músicas e lá fora), horários, humor do dia e as correlações com a Agenda. As contas são de correlacoes.js
// (puro); aqui o que lê a Agenda, o humor e desenha. O volume do aparelho, a saída e o tempo lá fora só existem nas
// reproduções a partir desta versão ("desde DD/MM"); a intensidade e o clima das músicas são da faixa e valem para o
// histórico todo.
import * as C from "./correlacoes.js";
import { E, somaDias } from "../estado.js";
import { escapar } from "../ui.js";
import { icone } from "../icones.js";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const PARTES = [["resumo", "Resumo"], ["volume", "Volume"], ["clima", "Clima"], ["horarios", "Horários"], ["humor", "Humor"]];
const NAO_FOI = ["falta", "nao_teve", "nao", "naoteve", "nao-teve"];
const ICONE_CLIMA = { Animada: "☀️", Calma: "🌙", "Melancólica": "🌧️", Agressiva: "🔥", "Dançante": "💃", "Romântica": "💗" };
const COR_CLIMA = { Animada: "#F2A922", "Dançante": "#D9467A", Agressiva: "#E0434A", "Romântica": "#B85BD6", Calma: "#22A06B", "Melancólica": "#4E7BD9" };
const lerParte = () => { try { return localStorage.getItem("mu.voce.parte") || "resumo"; } catch { return "resumo"; } };
let parte = lerParte();
const ddmm = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
const pct = (v) => `${Math.round(v * 100)}%`;
const dorme = () => new Promise(r => setTimeout(r, 0));

// ---------- a Agenda e o humor de cada dia ----------
let modAgenda = null, modTam = null, modHumor = null;
async function modulos() {
  if (!modAgenda) [modAgenda, modTam, modHumor] = await Promise.all([import("../agenda.js"), import("../tamanhoDia.js"), import("../humorDia/humorDia.js")]);
}
const minutos = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return a * 60 + (b || 0); };
/** O que a Agenda diz de um dia: { tam, nPres, horasFora, chegada (min do dia), huopCeo, prova }. Sem Agenda: tudo null. */
function agendaDoDia(dia) {
  const e = E(), temAgenda = !!modAgenda.A?.()?.itens?.length;
  const out = { tam: null, nPres: 0, horasFora: null, chegada: null, huopCeo: null, prova: null };
  out.prova = (e.avaliacoes || []).some(a => (a.data === dia || a.data === somaDias(dia, 1)) && (a.tipo === "prova" || a.tipo === "pratica"));
  out.tam = e.diasEscolha?.[dia]?.tam || null; // a escolha dele vale mesmo sem Agenda
  if (!temAgenda) return out;
  let pres = [];
  try {
    const evs = modAgenda.eventosDoDia(dia).filter(ev => !NAO_FOI.includes(ev.presenca));
    out.huopCeo = evs.some(ev => /\b(HUOP|CEO)\b/.test(`${ev.item?.curto || ""} ${ev.item?.nome || ""}`));
    pres = evs.map(ev => [minutos(ev.inicio), minutos(ev.fim || ev.inicio)]);
    for (const s of modAgenda.eventosOnlineDoDia(dia)) if (s.modalidade === "presencial" && !NAO_FOI.includes(s.presenca) && s.inicio) pres.push([minutos(s.inicio), minutos(s.fim || s.inicio)]);
  } catch { /* agenda quebrada: fica sem */ }
  out.nPres = pres.length;
  if (pres.length) {
    const p0 = Math.min(...pres.map(p => p[0])), p1 = Math.max(...pres.map(p => p[1]));
    out.horasFora = Math.round((p1 - p0 + 80) / 6) / 10; // do 1º − 40 min ao último + 40 min (tamanhoDia.js)
    out.chegada = p1 + 40;
  }
  out.tam ||= e.diasPlano?.[dia]?.tam || (() => { try { return modTam.livreDo(dia).tam; } catch { return null; } })();
  return out;
}

let cache = null;
/** Os dias do período com tudo junto (com cache: o mesmo período, as mesmas reproduções e os mesmos humores). */
async function diasDoPeriodo(reps, faixas) {
  await modulos();
  const hum = modHumor.todos(), chave = `${reps.length}|${reps[0]?.em || 0}|${reps.at(-1)?.em || 0}|${hum.length}|${hum.at(-1)?.em || ""}|${new Date().toDateString()}`;
  if (cache?.chave === chave) return cache.dias;
  await dorme();
  const pd = C.porDia(reps, faixas), dias = [];
  let k = 0;
  for (const d of pd.values()) {
    Object.assign(d, agendaDoDia(d.dia));
    d.humor = modHumor.resumoDoDia(hum.filter(r => r.dia === d.dia));
    dias.push(d);
    if (++k % 40 === 0) await dorme();
  }
  dias.sort((a, b) => a.dia.localeCompare(b.dia));
  cache = { chave, dias };
  return dias;
}

// ---------- pedacinhos de desenho ----------
function barras(dados, { rotulos = [], destaque = -1, titulo = "", base = 0, cor = "", fmt = null } = {}) {
  const vals = dados.map(v => (v == null ? null : v - base)), max = Math.max(1e-9, ...vals.filter(v => v != null));
  const el = document.createElement("div"); el.className = "mu-barras mu-vc-barras";
  el.setAttribute("role", "img"); el.setAttribute("aria-label", titulo);
  el.innerHTML = vals.map((v, i) => `<span class="${i === destaque ? "on" : ""}" title="${escapar(String(rotulos[i] ?? i))}: ${dados[i] == null ? "–" : escapar(fmt ? fmt(dados[i]) : String(Math.round(dados[i])))}"><i style="height:${v == null ? 0 : Math.max(v > 0 ? 4 : 0, Math.round(100 * v / max))}%${cor ? `;background:${cor}` : ""}"></i><small>${escapar(String(rotulos[i] ?? ""))}</small></span>`).join("");
  return el;
}
const secao = (tela, t, extra = "") => tela.insertAdjacentHTML("beforeend", `<h3 class="mu-secao">${t}${extra ? ` <small class="mu-vc-desde">${extra}</small>` : ""}</h3>`);
const dica = (tela, t) => tela.insertAdjacentHTML("beforeend", `<p class="mu-dica mu-dica-curta">${t}</p>`);
/** Tabela de calor: linhas × colunas, células pela intensidade (0 a 1). */
function calor(linhas, colunas, valor, { cor = "var(--acento)", texto = null, titulo = "", estreita = false } = {}) {
  const max = Math.max(1e-9, ...linhas.flatMap((_, i) => colunas.map((_, j) => valor(i, j) || 0)));
  const el = document.createElement("div"); el.className = `mu-vc-calor${estreita ? " estreita" : ""}`;
  el.setAttribute("role", "img"); el.setAttribute("aria-label", titulo);
  el.style.setProperty("--cols", colunas.length);
  el.innerHTML = `<span></span>${colunas.map(c => `<small class="mu-vc-col">${escapar(c)}</small>`).join("")}` +
    linhas.map((l, i) => `<small class="mu-vc-lin">${l}</small>${colunas.map((c, j) => { const v = valor(i, j) || 0; return `<i style="--a:${(v / max).toFixed(3)};--c:${typeof cor === "function" ? cor(i) : cor}" title="${escapar(String(c))}: ${texto ? escapar(texto(v)) : Math.round(v)}">${texto && v ? `<b>${escapar(texto(v))}</b>` : ""}</i>`; }).join("")}`).join("");
  return el;
}
function empilhada(partes, total, { rotulo = "" } = {}) {
  return `<div class="mu-vc-pilha">${rotulo ? `<small>${rotulo}</small>` : ""}<div>${partes.filter(p => p.v > 0).map(p => `<i style="flex:${p.v};background:${p.cor}" title="${escapar(p.nome)}: ${Math.round(100 * p.v / (total || 1))}%"></i>`).join("")}</div></div>`;
}
const legendaClimas = (climas) => `<div class="mu-vc-legenda">${climas.map(c => `<span><i style="background:${COR_CLIMA[c]}"></i>${ICONE_CLIMA[c] || ""} ${escapar(c)}</span>`).join("")}</div>`;
function ajuda(tela, rotulo, texto) {
  const d = document.createElement("details"); d.className = "mu-vc-ajuda";
  d.innerHTML = `<summary>${rotulo} <span aria-hidden="true">?</span></summary><p>${texto}</p>`;
  tela.append(d);
}

// ---------- a tela ----------
/**
 * Desenha a seção em `tela`. `reps`: as reproduções do período; `faixas`: Map id → faixa; `todas`: TODAS as
 * reproduções (para o "desde" e o calendário do humor).
 */
export async function telaVoce(tela, { reps, faixas, todas = reps, periodo = 30 }) {
  const chips = document.createElement("div"); chips.className = "mu-chips mu-vc-partes";
  for (const [k, nome] of PARTES) {
    const b = document.createElement("button"); b.textContent = nome; b.classList.toggle("on", parte === k); b.dataset.parte = k;
    b.onclick = () => { parte = k; try { localStorage.setItem("mu.voce.parte", k); } catch { /* */ } chips.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); pintar(); };
    chips.append(b);
  }
  tela.append(chips);
  const corpo = document.createElement("div"); corpo.className = "mu-vc"; tela.append(corpo);
  let desdeVol = Infinity, desdeTempo = Infinity;
  for (const r of todas) { if (typeof r.vol === "number" && r.em < desdeVol) desdeVol = r.em; if (r.tempo && r.em < desdeTempo) desdeTempo = r.em; }
  const ctx = { reps, faixas, todas, periodo, desdeVol: Number.isFinite(desdeVol) ? desdeVol : null, desdeTempo: Number.isFinite(desdeTempo) ? desdeTempo : null };
  let geracao = 0;
  async function pintar() {
    const g = ++geracao;
    const novo = document.createElement("div"); novo.className = "mu-vc-parte"; novo.dataset.parte = parte;
    try {
      if (parte === "volume") await parteVolume(novo, ctx);
      else if (parte === "clima") await parteClima(novo, ctx);
      else if (parte === "horarios") parteHorarios(novo, ctx);
      else if (parte === "humor") await parteHumor(novo, ctx, pintar);
      else await parteResumo(novo, ctx, pintar);
    } catch (e) { console.warn("Você e a música", e); novo.insertAdjacentHTML("beforeend", `<p class="mu-dica">Não deu para montar esta parte.</p>`); }
    if (g !== geracao) return;
    corpo.replaceChildren(novo);
  }
  await pintar();
}

function botaoHumor(el, aoSalvar) {
  const b = document.createElement("button"); b.className = "botao secundario mu-vc-humor-bt";
  const hoje = modHumor.humorDe(), ult = hoje.at(-1);
  b.innerHTML = `${ult ? icone(modHumor.humor(ult.h).emoji, "mu-vc-ico") : icone("🙂", "mu-vc-ico")}<span>${ult ? "Registrar de novo" : "Registrar como estou agora"}</span>`;
  b.onclick = async () => { const { abrirQuadroHumor } = await import("../humorDia/quadro.js"); const r = await abrirQuadroHumor(); if (r) aoSalvar?.(); };
  el.append(b);
}

async function parteResumo(el, ctx, repintar) {
  const dias = await diasDoPeriodo(ctx.reps, ctx.faixas);
  const comVol = ctx.reps.filter(r => typeof r.vol === "number"), toc = ctx.reps.filter(r => r.tipo === "tocada");
  const vol = C.media(comVol.map(r => r.vol));
  let lS = 0, lW = 0; const climas = {};
  for (const r of toc) { const f = ctx.faixas.get(r.id); if (!f) continue; const m = (r.dur || f.duracao || 0) / 60000; if (typeof f.loud === "number" && f.loud > -60) { lS += f.loud * m; lW += m; } const cl = C.climasDe(f); for (const c of cl) climas[c] = (climas[c] || 0) + m / cl.length; }
  const topClima = Object.entries(climas).sort((a, b) => b[1] - a[1])[0];
  const hum = dias.filter(d => d.humor), conta = new Map();
  for (const d of hum) conta.set(d.humor.ultimo, (conta.get(d.humor.ultimo) || 0) + 1);
  const topH = [...conta].sort((a, b) => b[1] - a[1])[0], H = topH ? modHumor.humor(topH[0]) : null;
  el.insertAdjacentHTML("beforeend", `<div class="mu-stats mu-vc-cartoes">
    <div><b>${vol != null ? pct(vol) : "–"}</b><small>Volume do aparelho${ctx.desdeVol ? ` · desde ${ddmm(ctx.desdeVol)}` : ""}</small></div>
    <div><b class="mu-vc-menor">${lW ? escapar((t => t.charAt(0).toUpperCase() + t.slice(1))(C.intensidadeTx(lS / lW).replace(/ \(.*/, ""))) : "–"}</b><small>Intensidade das músicas</small></div>
    <div><b class="mu-vc-menor">${topClima ? `${ICONE_CLIMA[topClima[0]] || ""} ${escapar(topClima[0])}` : "–"}</b><small>Clima mais ouvido</small></div>
    <div><b class="mu-vc-menor">${H ? `${icone(H.emoji, "mu-vc-ico")} ${escapar(H.nome)}` : "–"}</b><small>Humor mais comum${hum.length ? ` · ${hum.length} ${hum.length === 1 ? "dia" : "dias"}` : ""}</small></div></div>`);
  botaoHumor(el, repintar);
  const fr = C.frases(dias);
  secao(el, "O que aparece junto");
  if (fr.frases.length) {
    el.insertAdjacentHTML("beforeend", `<ul class="mu-vc-frases">${fr.frases.slice(0, 10).map(f => `<li>${escapar(f.texto)}</li>`).join("")}</ul>`);
  } else el.insertAdjacentHTML("beforeend", `<p class="mu-dica">${dias.length < C.MIN_DIAS * 2 ? "Ainda poucos dias para comparar." : "Nenhuma diferença clara por enquanto."}</p>`);
  dica(el, "São comparações entre dias: mostram o que aparece junto, não o que causa o quê.");
  ajuda(el, "Como as frases são escolhidas", `Dois grupos de dias só são comparados com pelo menos ${C.MIN_DIAS} dias de cada lado, e a frase só aparece se a diferença for grande o bastante (5 pontos no volume, 10 no clima das músicas, 1 dB na intensidade). “Relação” (quanto mais um, mais o outro) é medida pela ordem dos dias, sem ligar para valores extremos, e só aparece com ${C.MIN_PARES} dias ou mais: fraca, moderada (a partir de 0,3) ou forte (a partir de 0,5).`);
  if (fr.parecidos.length) el.insertAdjacentHTML("beforeend", `<details class="mu-vc-mais"><summary>Sem diferença clara (${fr.parecidos.length})</summary><ul>${fr.parecidos.map(f => `<li>${escapar(f.texto)}</li>`).join("")}</ul></details>`);
  if (fr.poucos.length) el.insertAdjacentHTML("beforeend", `<details class="mu-vc-mais"><summary>Ainda poucos dias (${fr.poucos.length})</summary><ul>${fr.poucos.slice(0, 12).map(f => `<li>${escapar(f.texto)}</li>`).join("")}</ul></details>`);
}

async function parteVolume(el, ctx) {
  const comVol = ctx.reps.filter(r => typeof r.vol === "number");
  const desde = ctx.desdeVol ? `desde ${ddmm(ctx.desdeVol)}` : "";
  secao(el, "Volume do aparelho", desde);
  if (!comVol.length) dica(el, ctx.desdeVol ? "Nada com o volume anotado neste período." : "O volume começa a ser anotado nas próximas músicas que você ouvir.");
  else {
    const dist = C.distribuicaoVolume(comVol), pico = dist.indexOf(Math.max(...dist));
    el.append(barras(dist, { rotulos: dist.map((_, i) => (i % 2 ? "" : `${i * 10}%`)), destaque: pico, titulo: "Reproduções por volume" }));
    dica(el, `Média de ${pct(C.media(comVol.map(r => r.vol)))} em ${comVol.length} ${comVol.length === 1 ? "reprodução" : "reproduções"}.`);
    const ps = C.porSaida(comVol, ctx.faixas);
    if (ps.length) {
      secao(el, "Por saída");
      const max = Math.max(...ps.map(p => p.n));
      el.insertAdjacentHTML("beforeend", `<div class="mu-ranking mu-vc-saidas">${ps.map(p => `<div><span>${escapar(C.SAIDAS[p.saida] || p.saida)}</span><i style="width:${Math.round(100 * p.n / max)}%"></i><b>${p.vol != null ? pct(p.vol) : "–"} · ${C.horasTx(p.min)}</b></div>`).join("")}</div>`);
    }
    secao(el, "Volume por hora do dia");
    const vh = C.mediaPorHora(comVol, (r) => r.vol);
    el.append(barras(vh, { rotulos: vh.map((_, h) => (h % 6 === 0 ? `${h}h` : "")), destaque: new Date().getHours(), titulo: "Volume médio por hora", fmt: pct }));
    // ao longo das semanas
    const sem = new Map();
    for (const r of comVol) { const s = C.semanaDe(C.diaDe(r.em)), x = sem.get(s) || []; x.push(r.vol); sem.set(s, x); }
    const ks = [...sem.keys()].sort().slice(-12);
    if (ks.length >= 2) {
      secao(el, "Ao longo das semanas");
      el.append(barras(ks.map(k => C.media(sem.get(k))), { rotulos: ks.map((k, i) => (i % 2 ? "" : ddmm(Date.parse(k + "T12:00:00")))), destaque: ks.length - 1, titulo: "Volume médio por semana", fmt: pct }));
    }
  }
  // a intensidade das músicas vale para tudo (é da faixa)
  const toc = ctx.reps.filter(r => r.tipo === "tocada");
  const ih = C.mediaPorHora(toc, (r, f) => (f && typeof f.loud === "number" && f.loud > -60 ? f.loud : null), ctx.faixas);
  if (ih.some(v => v != null)) {
    secao(el, "Intensidade das músicas por hora");
    const vals = ih.filter(v => v != null), min = Math.min(...vals) - 1;
    el.append(barras(ih, { rotulos: ih.map((_, h) => (h % 6 === 0 ? `${h}h` : "")), base: min, destaque: new Date().getHours(), titulo: "Intensidade média por hora", fmt: (v) => C.intensidadeTx(v), cor: "color-mix(in srgb, #E5533D 55%, var(--superficie-2))" }));
    const hMax = ih.indexOf(Math.max(...vals)), hMin = ih.indexOf(Math.min(...vals));
    if (hMax !== hMin) dica(el, `Mais fortes por volta das ${hMax}h; mais suaves por volta das ${hMin}h.`);
  }
}

async function parteClima(el, ctx) {
  const toc = ctx.reps.filter(r => r.tipo === "tocada");
  const por = C.climaPor(toc, ctx.faixas, (r) => C.periodoDe(new Date(C.meioDe(r)).getHours()));
  const usados = C.CLIMAS_ORDEM.filter(c => [...por.values()].some(x => x[c]));
  secao(el, "Clima das músicas por período do dia");
  if (!usados.length) { dica(el, "As músicas ainda não têm clima (Gêneros e climas, na aba Tags)."); }
  else {
    el.append(calor(usados.map(c => `${ICONE_CLIMA[c] || ""} ${escapar(c)}`), C.PERIODOS, (i, j) => { const x = por.get(C.PERIODOS[j]); return x ? (x[usados[i]] || 0) / x.total : 0; }, { cor: (i) => COR_CLIMA[usados[i]], texto: (v) => `${Math.round(v * 100)}%`, titulo: "Clima por período do dia" }));
    const pd = C.climaPor(toc, ctx.faixas, (r) => new Date(C.meioDe(r)).getDay());
    secao(el, "Por dia da semana");
    el.append(calor(usados.map(c => `${ICONE_CLIMA[c] || ""} ${escapar(c)}`), ORDEM_SEMANA.map(d => SEMANA[d]), (i, j) => { const x = pd.get(ORDEM_SEMANA[j]); return x ? (x[usados[i]] || 0) / x.total : 0; }, { cor: (i) => COR_CLIMA[usados[i]], texto: (v) => `${Math.round(v * 100)}`, titulo: "Clima por dia da semana", estreita: true }));
    dica(el, "Em % do tempo ouvido em cada coluna.");
  }
  // o tempo lá fora
  const comTempo = toc.filter(r => r.tempo);
  secao(el, "Com o tempo lá fora", ctx.desdeTempo ? `desde ${ddmm(ctx.desdeTempo)}` : "");
  if (!comTempo.length) { dica(el, ctx.desdeTempo ? "Nada com o tempo anotado neste período." : "O tempo lá fora começa a ser anotado nas próximas músicas (pelo Clima, com ou sem internet)."); return; }
  const grupos = [
    ["Com chuva", (r) => r.tempo.chuva], ["Sem chuva", (r) => !r.tempo.chuva],
    ["Frio (< 18°)", (r) => r.tempo.t < 18], ["Ameno", (r) => r.tempo.t >= 18 && r.tempo.t < 25], ["Calor (≥ 25°)", (r) => r.tempo.t >= 25],
  ];
  const lin = [];
  for (const [nome, f] of grupos) {
    const x = C.climaPor(comTempo.filter(f), ctx.faixas, () => "g").get("g");
    const min = comTempo.filter(f).reduce((s, r) => s + (r.dur || ctx.faixas.get(r.id)?.duracao || 0) / 60000, 0);
    if (!min) continue;
    lin.push(x ? empilhada(C.CLIMAS_ORDEM.map(c => ({ nome: c, v: x[c] || 0, cor: COR_CLIMA[c] })), x.total, { rotulo: `${nome} · ${C.horasTx(min)}` }) : `<div class="mu-vc-pilha"><small>${nome} · ${C.horasTx(min)}</small><div class="vazia"></div></div>`);
  }
  el.insertAdjacentHTML("beforeend", `<div class="mu-vc-pilhas">${lin.join("")}</div>${legendaClimas(C.CLIMAS_ORDEM)}`);
  const ts = comTempo.map(r => r.tempo.t).filter(t => typeof t === "number");
  if (ts.length) dica(el, `Você ouviu com ${Math.round(ts.reduce((a, b) => Math.min(a, b)))}° a ${Math.round(ts.reduce((a, b) => Math.max(a, b)))}° lá fora; ${pct(comTempo.filter(r => r.tempo.chuva).length / comTempo.length)} das músicas com chuva.`);
}

function parteHorarios(el, ctx) {
  const m = C.mapaHoraDia(ctx.reps, ctx.faixas), tot = m.flat().reduce((s, x) => s + x, 0);
  secao(el, "Quando você ouve");
  if (!tot) { dica(el, "Nada ouvido neste período."); return; }
  el.append(calor(ORDEM_SEMANA.map(d => SEMANA[d]), [...Array(24).keys()].map(h => (h % 3 === 0 ? `${h}` : "")), (i, j) => m[ORDEM_SEMANA[i]][j], { titulo: "Minutos por dia da semana e hora", texto: null }));
  el.insertAdjacentHTML("beforeend", `<div class="mu-vc-escala"><small>menos</small><i></i><small>mais</small></div>`);
  const porHora = [...Array(24).keys()].map(h => m.reduce((s, l) => s + l[h], 0)), porDia = m.map(l => l.reduce((s, x) => s + x, 0));
  const hTop = porHora.indexOf(Math.max(...porHora)), dTop = porDia.indexOf(Math.max(...porDia));
  dica(el, `Mais às ${hTop}h e aos ${["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"][dTop]}.`);
  secao(el, "Por hora do dia");
  el.append(barras(porHora, { rotulos: porHora.map((_, h) => (h % 6 === 0 ? `${h}h` : "")), destaque: new Date().getHours(), titulo: "Minutos por hora", fmt: (v) => C.horasTx(v) }));
}

async function parteHumor(el, ctx, repintar) {
  await modulos();
  botaoHumor(el, repintar);
  const regs = modHumor.todos(), hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  // calendário: 5 semanas, a começar na segunda
  const fim = C.diaDe(+hoje), ini = somaDias(C.semanaDe(fim), -28), porDia = new Map();
  for (const r of regs) if (r.dia >= ini && r.dia <= fim) { const l = porDia.get(r.dia) || []; l.push(r); porDia.set(r.dia, l); }
  secao(el, "Calendário");
  const cal = document.createElement("div"); cal.className = "mu-vc-cal";
  cal.innerHTML = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => `<small>${d}</small>`).join("");
  for (let d = ini; d <= somaDias(C.semanaDe(fim), 6); d = somaDias(d, 1)) {
    const l = porDia.get(d), res = l ? modHumor.resumoDoDia(l) : null, h = res ? modHumor.humor(res.ultimo) : null;
    const q = res ? modHumor.quadrante(res.quadrante) : null;
    cal.insertAdjacentHTML("beforeend", `<button type="button" class="mu-vc-dia${d === fim ? " hoje" : ""}${d > fim ? " depois" : ""}" data-d="${d}" ${d > fim ? "disabled" : ""} style="${q ? `--q:${q.cor}` : ""}" aria-label="${d}${h ? `: ${h.nome}` : ""}">${h ? icone(h.emoji, "mu-vc-ico") : `<span>${Number(d.slice(8))}</span>`}${l && l.length > 1 ? `<em>${l.length}</em>` : ""}</button>`);
  }
  el.append(cal);
  const det = document.createElement("div"); det.className = "mu-vc-diadet"; el.append(det);
  const mostrarDia = (d) => {
    const l = porDia.get(d) || [];
    det.innerHTML = `<b>${d.split("-").reverse().slice(0, 2).join("/")}</b>${l.length ? l.map(r => { const h = modHumor.humor(r.h), t = new Date(r.ms); return `<div class="mu-vc-reg">${icone(h.emoji, "mu-vc-ico")}<span><b>${escapar(h.nome)}</b> · ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}${r.et?.length ? ` · ${r.et.map(escapar).join(", ")}` : ""}${r.tx ? `<small>${escapar(r.tx)}</small>` : ""}</span><button type="button" class="mu-vc-apagar" data-rid="${r.rid}" aria-label="Apagar este registro">×</button></div>`; }).join("") : `<small> nada anotado</small>`}`;
    det.querySelectorAll(".mu-vc-apagar").forEach(b => { b.onclick = () => { if (b.classList.contains("conf")) { modHumor.apagarHumor(b.dataset.rid); repintar(); } else { b.classList.add("conf"); b.textContent = "Apagar?"; } }; });
  };
  cal.addEventListener("click", (e) => { const b = e.target.closest(".mu-vc-dia"); if (!b || b.disabled) return; cal.querySelectorAll(".sel").forEach(x => x.classList.remove("sel")); b.classList.add("sel"); mostrarDia(b.dataset.d); });
  if (!regs.length) { dica(el, "Nenhum humor anotado ainda."); return; }
  // por semana: quantos registros em cada canto (sem média)
  const sem = new Map();
  for (const r of regs) { const s = C.semanaDe(r.dia), x = sem.get(s) || {}; const q = modHumor.humor(r.h).quadrante; x[q] = (x[q] || 0) + 1; sem.set(s, x); }
  const ks = [...sem.keys()].sort().slice(-8);
  secao(el, "Os quatro cantos por semana");
  el.insertAdjacentHTML("beforeend", `<div class="mu-vc-pilhas">${ks.map(k => { const x = sem.get(k), tot = Object.values(x).reduce((s, v) => s + v, 0); return empilhada(modHumor.QUADRANTES.map(q => ({ nome: q.nome, v: x[q.id] || 0, cor: q.cor })), tot, { rotulo: `${ddmm(Date.parse(k + "T12:00:00"))} · ${tot}` }); }).join("")}</div>
    <div class="mu-vc-legenda">${modHumor.QUADRANTES.map(q => `<span><i style="background:${q.cor}"></i>${escapar(q.nome)}</span>`).join("")}</div>`);
  // por emoji, dentro do período, agrupados pelo canto
  const desde = ctx.periodo ? C.diaDe(Date.now() - ctx.periodo * C.DIA_MS) : "";
  const noPer = regs.filter(r => r.dia >= desde), conta = new Map();
  for (const r of noPer) conta.set(r.h, (conta.get(r.h) || 0) + 1);
  secao(el, "Cada emoji");
  el.insertAdjacentHTML("beforeend", `<div class="mu-vc-cantos">${modHumor.QUADRANTES.map(q => `<div style="--q:${q.cor}"><small>${escapar(q.nome)}</small>${modHumor.HUMORES.filter(h => h.quadrante === q.id).map(h => `<span class="${conta.get(h.id) ? "" : "zero"}">${icone(h.emoji, "mu-vc-ico")}<b>${conta.get(h.id) || 0}</b></span>`).join("")}</div>`).join("")}</div>`);
  const et = new Map();
  for (const r of noPer) for (const e of r.et || []) et.set(e, (et.get(e) || 0) + 1);
  if (et.size) {
    secao(el, "Etiquetas mais comuns");
    el.insertAdjacentHTML("beforeend", `<div class="mu-chips mu-vc-etiquetas">${[...et].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([e, n]) => `<span>${escapar(e)} <b>${n}</b></span>`).join("")}</div>`);
  }
  // o humor e a música: por canto, o volume e o clima mais ouvido nesses dias
  const dias = await diasDoPeriodo(ctx.reps, ctx.faixas), linhas = [];
  for (const q of modHumor.QUADRANTES) {
    const ds = dias.filter(d => d.humor?.quadrante === q.id); if (!ds.length) continue;
    const vol = C.media(ds.map(d => C.MEDIDAS.volume.valor(d)).filter(v => v != null)), cl = {};
    ds.forEach(d => Object.entries(d.climas).forEach(([c, m]) => (cl[c] = (cl[c] || 0) + m)));
    const top = Object.entries(cl).sort((a, b) => b[1] - a[1])[0];
    linhas.push(`<div style="--q:${q.cor}"><span>${escapar(q.nome)}</span><b>${ds.length} ${ds.length === 1 ? "dia" : "dias"}</b><small>${vol != null ? `volume ${pct(vol)}` : "sem volume anotado"}${top ? ` · mais ${ICONE_CLIMA[top[0]] || ""} ${escapar(top[0])}` : ""}</small></div>`);
  }
  if (linhas.length) { secao(el, "O humor e a música"); el.insertAdjacentHTML("beforeend", `<div class="mu-vc-humus">${linhas.join("")}</div>`); }
}
