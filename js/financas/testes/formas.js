// Testes de mercado → as outras formas no papel (Cofres, Funding, Robôs, Apostas; desde 07/11/2026 Looping, Opções, Pools
// e Memecoins), pedido do Alediov de 03/11/2026 (plano em docs/plano-testes-mercado-2.md, "Como aparece na aba Testes").
// Os dados vêm do ramo `papel` do repositório orbita-testes (testes/dados.js `carregarPapel`; formato em
// tools/papel/FORMATO.md de lá). Cada forma: cabeçalho (frase + Como funciona) e as partes Como está indo, Versões, O que
// aconteceu e, nos cofres, Quais cofres; nos memecoins, o Observatório no lugar de Como está indo. As contas são as
// mesmas do copy trading (testes/calculo.js): a conta de cada versão tem o mesmo formato.
import { escapar, toast } from "../../ui.js";
import { icone } from "../../icones.js";
import * as K from "./calculo.js";
import { seg, secao, graficoComRefs, graficoQueda, graficoMeses, q, classe, pct, pctSem, us, quando, dataCurta, pctMes, GLOSSARIO } from "./comum.js";
import { heroiEstimativa, seloRisco, secaoMetricas, secaoBDM } from "./subabas.js";
import * as FX from "./fixar.js";
import * as FUN from "./funding.js";
import * as RB from "./robos.js";
import * as LP from "./looping.js";
import * as OP from "./opcoes.js";
import * as MM from "./memes.js";
import * as PV from "./previsao.js";

/** A ordem dos chips depois de Placar e Copy trading (as formas de fora da lista vão no fim, na ordem do índice). */
export const ORDEM_FORMAS = ["cofres", "funding", "robos", "looping", "opcoes", "pools", "memes", "apostas", "previsao"];
export const ICONE_FORMA = { placar: "🏆", copia: "👥", cofres: "🏦", funding: "💰", robos: "🤖", looping: "🔁", opcoes: "🎯", pools: "🪙", memes: "🐸", apostas: "⚽", previsao: "🔮" };
const NOME_PADRAO = { cofres: "Cofres", funding: "Funding", robos: "Robôs", looping: "Looping", opcoes: "Opções", pools: "Pools", memes: "Memecoins", apostas: "Apostas", previsao: "Previsão" };
const CHAVE = "orbita.testes.formas";
/** O semáforo das outras formas não pede 10 operações (no funding e nos cofres quase não há operações): só 14 dias e a
 *  faixa toda de um lado do CDI. */
const SEM_OPS = Number.POSITIVE_INFINITY;

// ------------------------------------------------------------------ dados (sem DOM)
/** As formas com dados, na ordem dos chips: [chave]. */
export function formasPresentes(p) {
  const fs = p?.formas || {};
  const tem = (k) => Array.isArray(fs[k]?.versoes) && fs[k].versoes.length > 0;
  const fora = Object.keys(p?.indice?.formas || fs).filter(k => !ORDEM_FORMAS.includes(k));
  return [...ORDEM_FORMAS, ...fora].filter(tem);
}
export const nomeForma = (p, k) => p?.formas?.[k]?.nome || p?.indice?.formas?.[k]?.nome || NOME_PADRAO[k] || k;
/** As referências no formato do resumo do copy trading ({ referencias: { btc, cdi } }), para reusar as contas. */
export const refsDe = (p) => { const r = p?.indice?.ref || {}; return { referencias: { btc: r.btc || [], cdi: r.cdi || [], cdiAno: r.cdiAno ?? null, cdiFonte: r.cdiFonte ?? null } }; };
/** As métricas comuns da conta (`metricas` do workflow, desde 09/11/2026; sem elas, as calculadas pelo app). */
export const metricasConta = (p, f, a) => K.metricasDe(a, refsDe(p));
/** O grupo das réguas (looping, pools, apostas, memes): fica por último e com a explicação. */
const REFERENCIA = "Referência";
export const versaoPadrao = (f) => f?.versoes?.find(v => v.id === f.padrao) || f?.versoes?.[0] || null;
export const contaDe = (v, modo = "vivo") => (modo === "hist" ? v?.historico : v?.aoVivo) || null;
/** O trecho "desde o início" da conta: ao vivo até hoje (o dia da rodada); o teste no passado até o fim dele. */
export function trechoDe(f, v, modo = "vivo") {
  const a = contaDe(v, modo);
  return a ? K.trecho(a, "tudo", modo === "hist" ? null : K.diaDe(f.agora || Date.now())) : null;
}
/** Tudo o que o Placar e o número grande precisam de uma versão. */
export function resumoVersao(p, f, v, modo = "vivo") {
  const t = trechoDe(f, v, modo);
  if (!t) return null;
  const m = metricasConta(p, f, contaDe(v, modo), modo), e = K.comMetricas(K.estimativa(t), m), cdi = K.cdiTaxas(refsDe(p));
  const ate = t.pts.at(-1)?.[0], cdiPeriodo = m?.cdi ?? (t.de ? K.retornoRef(p?.indice?.ref?.cdi, t.de, ate) : null);
  const frente = m?.venceCdi != null ? !!m.venceCdi : cdiPeriodo != null && t.retorno > cdiPeriodo;
  return { t, e, m, cdi, sem: K.semaforo(e, cdi.mes, SEM_OPS), risco: v.risco || K.nivelRisco({ queda: t.queda, nLiq: t.nLiq, alav: v.alav || 1 }), frente, aproximado: !!(v.aproximado || (modo === "hist" ? v.historico : v.aoVivo)?.aproximado) };
}
/** O valor que ordena: % ao mês; com menos de 7 dias, o do período (que fica depois). */
export const valorOrdem = (e, t) => (e && !e.cedo && e.mes != null ? e.mes : (e?.periodo ?? t?.retorno ?? -9) - 100);
/** Quantas formas novas estão à frente do CDI (versão padrão, ao vivo, desde o início). */
export function formasAFrente(p) {
  const ks = formasPresentes(p);
  let n = 0;
  for (const k of ks) { const f = p.formas[k], r = resumoVersao(p, f, versaoPadrao(f)); if (r?.frente) n++; }
  return { n, de: ks.length };
}

// ------------------------------------------------------------------ os vários pools (09/11/2026)
// Desde 09/11/2026 (pedido do Alediov: de um pool para cinco) o pools.json traz `pools` (FORMATO.md, "Pools"): cada pool
// com o par, a DEX, a taxa, o volume, a liquidez e o padrão; cada versão diz de qual pool é (`pool`). A tela da forma
// mostra um pool por vez (os chips `.fi-ts-pools`) e a parte Comparar põe todos lado a lado. Sem `pools` (dados antigos),
// tudo continua como um pool só.
const POOL_PADRAO = "weth_usdc";
export const poolsDe = (f) => (Array.isArray(f?.pools) ? f.pools.filter(p => p && p.id) : []);
export const poolsComContas = (f) => poolsDe(f).filter(p => !p.observador);
export const temVariosPools = (f) => poolsComContas(f).length > 1;
export const poolDaVersao = (v) => v?.pool || POOL_PADRAO;
const NOME_MOEDA = { WETH: "ether", cbBTC: "bitcoin", USDC: "dólar", USDT: "tether", EURC: "euro digital", BRZ: "real digital" };
const moedaDe = (s) => NOME_MOEDA[s] || s || "";
/** "Ether × dólar · Uniswap" (o nome curto do chip). */
export function nomePool(pl) {
  if (!pl) return "";
  const [b, c] = String(pl.par || pl.nome || "").split("/");
  const par = b && c ? `${moedaDe(b).replace(/^./, x => x.toUpperCase())} × ${moedaDe(c)}` : (pl.nome || pl.id);
  return `${par} · ${pl.dex || ""}`.replace(/ · $/, "");
}
/** A forma vista por um pool: só as versões dele, o padrão dele e os eventos dele (ou da forma inteira). */
export function vistaDoPool(f, pid) {
  const pl = poolsDe(f).find(x => x.id === pid);
  if (!pl) return f;
  const versoes = (f.versoes || []).filter(v => poolDaVersao(v) === pid);
  const ids = new Set(versoes.map(v => v.id));
  return { ...f, versoes, padrao: ids.has(pl.padrao) ? pl.padrao : versoes[0]?.id || f.padrao, poolSel: pl,
    eventos: (Array.isArray(f.eventos) ? f.eventos : []).filter(e => e && (e.versao == null || ids.has(e.versao))) };
}
/** Comparar os pools: para cada um, a versão que mais rende (no modo), a padrão, as taxas do pool ao ano, a perda
 *  impermanente e o tempo na faixa da melhor. Ordenado pela melhor. */
export function compararPools(p, f, modo = "vivo") {
  const out = [];
  for (const pl of poolsComContas(f)) {
    const vs = (f.versoes || []).filter(v => poolDaVersao(v) === pl.id);
    const rs = vs.map(v => ({ v, r: resumoVersao(p, f, v, modo) })).filter(x => x.r?.t?.pts?.length);
    const estrategias = rs.filter(x => x.v.grupo !== REFERENCIA);
    const melhor = [...(estrategias.length ? estrategias : rs)].sort((a, b) => valorOrdem(b.r.e, b.r.t) - valorOrdem(a.r.e, a.r.t))[0] || null;
    const padrao = rs.find(x => x.v.id === pl.padrao) || null;
    const segurar = rs.find(x => x.v.grupo === REFERENCIA) || null;
    const x = melhor ? (contaDe(melhor.v, modo)?.extra || {}) : {};
    out.push({ pool: pl, melhor, padrao, segurar, taxasAno: pl.aprTaxas ?? null, giro: pl.giro ?? null,
      perdaImp: x.perdaImp ?? null, dentro: x.dentroFrac ?? null, taxas: x.taxasGanhas ?? null, aero: x.aeroVendido ?? null });
  }
  return out.sort((a, b) => (b.melhor ? valorOrdem(b.melhor.r.e, b.melhor.r.t) : -1e9) - (a.melhor ? valorOrdem(a.melhor.r.e, a.melhor.r.t) : -1e9));
}
/** No Aerodrome: cada versão com taxas × a mesma "no gauge" (id + "g"), no modo. */
export function taxasOuAero(p, f, modo = "vivo") {
  const out = [];
  for (const v of f.versoes || []) {
    if (v.grupo === "No gauge (AERO)") continue;
    const g = (f.versoes || []).find(x => x.id === v.id + "g");
    if (!g) continue;
    const rt = resumoVersao(p, f, v, modo), rg = resumoVersao(p, f, g, modo);
    if (rt?.t && rg?.t) out.push({ taxas: { v, r: rt }, gauge: { v: g, r: rg }, ganha: valorOrdem(rg.e, rg.t) > valorOrdem(rt.e, rt.t) ? "gauge" : "taxas" });
  }
  return out;
}

// ------------------------------------------------------------------ a escolha guardada por forma
const PADRAO_SEL = { sub: "indo", versao: "", modo: "vivo", fVersao: "*", pool: POOL_PADRAO };
let sels = null;
export function selDe(k) {
  if (!sels) { try { sels = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch { sels = {}; } }
  return (sels[k] = { ...PADRAO_SEL, ...(sels[k] || {}) });
}
const guardar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(sels)); } catch { /* */ } };

// ------------------------------------------------------------------ formatos
/** A moeda da forma aberta: US$ nas de mercado, R$ nas apostas (`config.moeda`, FORMATO.md). */
let MOEDA = "US$";
/** O nome do teste no passado da forma aberta: nos cofres (09/11/2026) é o "no período da escolha (otimista)", porque o
 *  teste honesto é o fora da amostra (Mais testes). */
const HIST_PADRAO = { botao: "Teste no passado", txt: "teste no passado", Txt: "No teste no passado" };
const HIST_COFRES = { botao: "Na escolha", txt: "no período da escolha (otimista)", Txt: "No período da escolha (otimista)" };
let HIST = HIST_PADRAO;
const din = (v, o) => (MOEDA === "R$" ? us(v, o).replace("US$", "R$") : us(v, o));
export function usCurto(v) {
  if (v == null || !Number.isFinite(+v)) return "—";
  const a = Math.abs(v), f = (x, c) => x.toLocaleString("pt-BR", { maximumFractionDigits: c });
  return a >= 1e9 ? `US$ ${f(v / 1e9, 1)} bi` : a >= 1e6 ? `US$ ${f(v / 1e6, 1)} mi` : a >= 1e3 ? `US$ ${f(v / 1e3, 0)} mil` : `US$ ${f(v, 0)}`;
}
const vezesBr = (v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×`;
const mesDoAno = (apr) => (apr == null || apr <= -1 ? null : Math.pow(1 + apr, 1 / 12) - 1);
const dataDe = (ms) => (ms ? dataCurta(K.diaDe(ms)) : "—");
/** O "% ao mês" curto de uma estimativa (ou o do período, cedo). */
export function textoCurto(e, t) {
  if (e && !e.cedo && e.mes != null) return `${pctMes(e.mes)} ao mês`;
  if (e) return `${pct(e.periodo)} em ${e.dias} ${e.dias === 1 ? "dia" : "dias"}`;
  return t ? `${pct(t.retorno)} no período` : "—";
}

// ------------------------------------------------------------------ a tela de uma forma
const SUBS = [["indo", "Como está indo", "📊"], ["versoes", "Versões", "🧮"], ["aconteceu", "O que aconteceu", "📋"]];
const SUB_COFRES = ["quais", "Quais cofres", "🏦"];
const SUB_OBS = ["obs", "Observatório", "🔭"];
const SUB_COMPARAR = ["comparar", "Comparar pools", "⚖️"];
const SUB_MAIS = ["mais", "Mais testes", "🔬"];
const SUB_CALIB = ["calib", "Calibração", "🎯"];
/** As partes de cada forma: nos cofres, mais Quais cofres e Mais testes (o fora da amostra e o cofre × líder, 09/11/2026);
 *  nos memecoins, o Observatório no lugar de Como está indo; nos pools com mais de um pool, Comparar pools antes. */
export const subsDe = (k, f) => (k === "cofres" ? [...SUBS, SUB_COFRES, SUB_MAIS] : k === "memes" ? [SUB_OBS, SUBS[1], SUBS[2]]
  : k === "pools" && temVariosPools(f) ? [SUB_COMPARAR, ...SUBS] : k === "previsao" ? [SUBS[0], SUB_CALIB, SUBS[1], SUBS[2]] : SUBS);

/** `ctx` = { p, k, redesenhar, avisoAtraso(el), rodape(el) }. */
export function telaForma(el, ctx) {
  const { p, k } = ctx, s = selDe(k);
  let f = p.formas[k];
  MOEDA = f.config?.moeda === "R$" ? "R$" : "US$";
  HIST = k === "cofres" ? HIST_COFRES : HIST_PADRAO;
  const ind = p.indice?.formas?.[k];
  cabecalho(el, ctx, f);
  ctx.avisoAtraso(el);
  if (ind && ind.ok === false) el.insertAdjacentHTML("beforeend", `<p class="fi-ts-atraso fi-ts-falhou" role="note">${icone("⚠️", "ico-inline")} A última rodada de ${escapar(nomeForma(p, k))} falhou${ind.erro ? ` (${escapar(ind.erro)})` : ""}; estes são os dados de ${quando(f.agora || ind.agora)}.</p>`);
  const subs = k === "funding" ? FUN.subsFunding(subsDe(k, f)) : subsDe(k, f);
  if (!subs.some(x => x[0] === s.sub)) s.sub = subs[0][0];
  if (k === "pools" && poolsDe(f).length) {
    // um pool por vez (menos no Comparar): os chips dos pools e a forma vista por ele
    const pls = poolsComContas(f);
    if (!pls.some(x => x.id === s.pool)) s.pool = (pls.find(x => x.id === POOL_PADRAO) || pls[0])?.id || POOL_PADRAO;
    if (s.sub !== "comparar") {
      if (pls.length > 1) chipsPools(el, ctx, pls, s);
      f = vistaDoPool(f, s.pool);
    }
  }
  if (!f.versoes.some(v => v.id === s.versao)) s.versao = versaoPadrao(f)?.id || "";
  const ch = document.createElement("div"); ch.className = `fi-ts-subs fi-ts-fsubs ${subs.length >= 4 ? "fi-ts-subs4" : "fi-ts-subs3"}`; ch.dataset.semDeslize = "";
  ch.innerHTML = subs.map(([x, n, e]) => `<button data-fsub="${x}" class="${s.sub === x ? "on" : ""}">${icone(e, "ico3d")}<span>${n}</span></button>`).join("");
  ch.querySelectorAll("button").forEach(b => (b.onclick = () => { s.sub = b.dataset.fsub; guardar(); navigator.vibrate?.(6); ctx.redesenhar(); }));
  el.append(ch);
  // funding (09/11/2026): Mais testes (o fora da amostra e o só observando), em testes/funding.js
  if (k === "funding" && FUN.ehSubFunding(s.sub)) { FUN.telaMaisFunding(el, ctx, f); ctx.rodape(el); return; }
  ({ indo: telaIndo, versoes: telaVersoes, aconteceu: telaAconteceu, quais: telaQuais, obs: telaObservatorio, comparar: telaComparar, mais: telaMaisCofres, calib: PV.telaCalibracao }[s.sub])(el, ctx, f, s);
  ctx.rodape(el);
}

/** Os chips dos pools (um pool por vez nas partes Como está indo, Versões e O que aconteceu). */
function chipsPools(el, ctx, pls, s) {
  const d = document.createElement("div"); d.className = "fi-ts-pools"; d.setAttribute("role", "group"); d.setAttribute("aria-label", "Qual pool");
  d.dataset.semDeslize = "";
  d.innerHTML = pls.map(pl => `<button data-pool="${escapar(pl.id)}" class="${pl.id === s.pool ? "on" : ""}" aria-pressed="${pl.id === s.pool}"><b>${escapar(nomePool(pl))}</b><small>taxa ${pctSem(pl.taxa, 2)}${pl.medida === "btc" ? " · em bitcoin" : ""}</small></button>`).join("");
  d.querySelectorAll("button").forEach(b => (b.onclick = () => { s.pool = b.dataset.pool; s.versao = ""; s.fVersao = "*"; guardar(); navigator.vibrate?.(6); ctx.redesenhar(); }));
  el.append(d);
}

// ------------------------------------------------------------------ Comparar pools (09/11/2026)
function telaComparar(el, ctx, f, s) {
  const temHist = f.versoes.some(v => v.historico?.serie?.length);
  if (!temHist && s.modo === "hist") s.modo = "vivo";
  if (temHist) { const b = document.createElement("div"); b.className = "fi-ts-barra fi-ts-fbarra"; b.append(seg("Ao vivo ou o teste no passado", [["vivo", "Ao vivo"], ["hist", "Teste no passado"]], s.modo, v => { s.modo = v; guardar(); ctx.redesenhar(); }, "fi-ts-fmodo")); el.append(b); }
  const linhas = compararPools(ctx.p, f, s.modo);
  const sc = secao(el, "Qual pool está ganhando", `a melhor versão de cada um · ${s.modo === "hist" ? "teste no passado" : "ao vivo"}`, "fi-ts-comparar");
  if (!linhas.some(l => l.melhor)) sc.insertAdjacentHTML("beforeend", `<p class="fi-dica">Sem dias medidos ainda.</p>`);
  sc.insertAdjacentHTML("beforeend", `<ol class="fi-ts-rank fi-ts-cmp">${linhas.map((l, i) => {
    const pl = l.pool, m = l.melhor, r = m?.r;
    const cdi = r?.m?.excesso != null ? `<span class="${classe(r.m.excesso)}">${pct(r.m.excesso, 1)} ${r.m.excesso >= 0 ? "acima" : "abaixo"} do CDI</span>` : r ? (r.frente ? "à frente do CDI" : "atrás do CDI") : "";
    const nums = [
      pl.aprTaxas != null ? `taxas do pool ${pct(pl.aprTaxas, 1)} a.a. ${q("giro")}` : null,
      l.perdaImp != null ? `perda impermanente ${din(l.perdaImp, { sinal: true })} ${q("perdaImp")}` : null,
      l.dentro != null ? `${pctSem(l.dentro)} do tempo na faixa` : null,
      l.aero != null ? `AERO vendido ${din(l.aero)} ${q("gauge")}` : null,
    ].filter(Boolean).join(" · ");
    return `<li data-pool="${escapar(pl.id)}" data-v="${escapar(m?.v.id || "")}" role="button" tabindex="0"><span class="pos">${i + 1}º</span><span class="tx"><b>${escapar(nomePool(pl))}${pl.medida === "btc" ? ` <i class="fi-ts-selo">em bitcoin ${q("medidoBtc")}</i>` : ""}</b>`
      + (m ? `<small>${escapar(m.v.nome)}: <span class="${classe(r.e?.mes ?? r.t.retorno)}">${textoCurto(r.e, r.t)}</span> · ${cdi}${r.aproximado ? ` <i class="fi-ts-selo aviso">aproximado</i>` : ""}</small>` : `<small>sem dias medidos ainda</small>`)
      + (nums ? `<small class="fi-ts-cmp-nums">${nums}</small>` : "")
      + (l.padrao && l.padrao.v.id !== m?.v.id ? `<small>padrão (${escapar(l.padrao.v.nome)}): ${textoCurto(l.padrao.r.e, l.padrao.r.t)}</small>` : "")
      + (l.segurar ? `<small>só segurar as duas moedas: ${textoCurto(l.segurar.r.e, l.segurar.r.t)}</small>` : "")
      + `</span></li>`;
  }).join("")}</ol>
    <p class="fi-dica">Tocar abre o pool na versão que mais rendeu. A melhor de cada pool foi escolhida depois de ver o resultado: serve para comparar, não é previsão ${q("teto")}. Os pools novos usam faixas pela oscilação do par ${q("faixaVol")}.</p>`);
  sc.querySelectorAll("li[data-pool]").forEach(li => {
    const ir = () => { s.pool = li.dataset.pool; s.versao = li.dataset.v || ""; s.sub = "indo"; guardar(); ctx.redesenhar(); };
    li.onclick = ir; li.onkeydown = (ev) => { if (ev.key === "Enter") ir(); };
  });
  // o Aerodrome: taxas ou AERO
  for (const pl of poolsComContas(f).filter(x => x.gauge || x.parteGauge != null)) {
    const fv = vistaDoPool(f, pl.id), pares = taxasOuAero(ctx.p, fv, s.modo);
    if (!pares.length && !pl.gauge) continue;
    const sa = secao(el, `Taxas ou AERO? ${q("gauge")}`, escapar(nomePool(pl)), "fi-ts-aero");
    const g = pl.gauge || {};
    sa.insertAdjacentHTML("beforeend", `<p class="fi-ts-frase">No ${escapar(pl.dex || "")}, quem deixa a posição solta ganha as taxas das trocas${pl.parteGauge ? ` (menos ${pctSem(pl.parteGauge)}, que vão para o gauge)` : ""}. Quem põe no gauge não ganha taxa nenhuma e sim AERO ${q("aero")}, a moeda do ${escapar(pl.dex || "")}, que o papel vende todo dia.</p>
      <ul class="fi-ts-lista">${[
        pl.aprTaxas != null ? ["Taxas, ao ano", pct(pl.aprTaxas, 1), "o pool inteiro, pelo volume de 24 h"] : null,
        g.aprEmissoes != null ? [`AERO, ao ano ${q("emissoes")}`, pct(g.aprEmissoes, 1), `${Math.round(g.aeroDia || 0).toLocaleString("pt-BR")} AERO por dia${g.precoAero ? ` a US$ ${Number(g.precoAero).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}` : ""}`] : null,
        g.fracStake != null ? ["No gauge", pctSem(g.fracStake), "da liquidez ativa"] : null,
      ].filter(Boolean).map(([n, v, x]) => `<li><span><b>${n}</b><small>${x}</small></span><b>${v}</b></li>`).join("")}</ul>`);
    if (pares.length) sa.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-aero-pares">${pares.map(x => `<li><span><b>${escapar(x.taxas.v.nome.replace(/ · taxas$/, ""))}</b><small>taxas ${textoCurto(x.taxas.r.e, x.taxas.r.t)} · AERO ${textoCurto(x.gauge.r.e, x.gauge.r.t)}</small></span><b class="${x.ganha === "gauge" ? "ts-sobe" : ""}">${x.ganha === "gauge" ? "AERO" : "taxas"}<small>rendeu mais</small></b></li>`).join("")}</ul>`);
    sa.insertAdjacentHTML("beforeend", `<p class="fi-dica">O AERO é aproximado ${q("aproximado")}: a parte em stake e o preço do AERO só são lidos a cada 6 h.</p>`);
  }
  // os só observados (o real digital)
  const obs = poolsDe(f).filter(x => x.observador);
  if (obs.length) {
    const so = secao(el, `Só observados ${q("observado")}`, "pequenos demais para o papel", "fi-ts-pools-obs");
    so.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${obs.map(x => `<li><span><b>${escapar(nomePool(x))}</b><small>${escapar(x.nota || "")}</small></span><b>${usCurto(x.volume24h)}<small>em 24 h · liquidez ${usCurto(x.tvl)}</small></b></li>`).join("")}</ul>`);
  }
}

function cabecalho(el, ctx, f) {
  const c = document.createElement("section"); c.className = "fi-ts-forma-cab";
  c.innerHTML = `<p class="fi-ts-frase grande">${escapar(f.frase || "")}</p>`;
  const b = document.createElement("button"); b.className = "fi-ts-como-forma"; b.setAttribute("aria-expanded", String(!!cabecalho.aberto?.[ctx.k]));
  b.innerHTML = `${icone("💡", "ico-inline")}<span>Como funciona</span><i>${cabecalho.aberto?.[ctx.k] ? "▴" : "▾"}</i>`;
  b.onclick = () => { cabecalho.aberto = { ...cabecalho.aberto, [ctx.k]: !cabecalho.aberto?.[ctx.k] }; ctx.redesenhar(); };
  c.append(b);
  if (cabecalho.aberto?.[ctx.k]) {
    const d = document.createElement("div"); d.className = "fi-ts-como-txt";
    d.innerHTML = (f.comoFunciona || []).map(x => `<p>${escapar(x)}</p>`).join("")
      + (TERMOS[ctx.k] ? `<p class="fi-ts-termos">${TERMOS[ctx.k].map(t => `${escapar(GLOSSARIO[t]?.[0] || t)} ${q(t)}`).join(" · ")}</p>` : "")
      + `<p class="fi-ts-termos fi-ts-termos-comuns">Para comparar com o CDI: ${TERMOS_COMUNS.map(t => `${escapar(GLOSSARIO[t]?.[0] || t)} ${q(t)}`).join(" · ")}</p>`
      + (f.avisos?.length ? `<h4>O que o papel não mostra</h4><ul>${f.avisos.map(x => `<li>${escapar(x)}</li>`).join("")}</ul>` : "")
      + `<p class="fi-dica">Cada versão começa com ${MOEDA} 1.000 de mentira${f.config?.frequencia ? ` e anda ${escapar(f.config.frequencia)}` : ""}. O % ao mês, a faixa e o semáforo são calculados como no copy trading ${q("porMes")} ${q("faixa")}.</p>`;
    c.append(d);
  }
  el.append(c);
}

/** Ao vivo ou o teste no passado (só se alguma versão tiver) e a versão. */
function seletores(el, ctx, f, s, { versao = true } = {}) {
  const temHist = f.versoes.some(v => v.historico?.serie?.length);
  if (!temHist && s.modo === "hist") s.modo = "vivo";
  const b = document.createElement("div"); b.className = "fi-ts-barra fi-ts-fbarra";
  if (versao) {
    b.insertAdjacentHTML("beforeend", `<label class="fi-ts-fver"><small>Versão</small><select class="fi-ts-fversao" aria-label="Versão">${f.versoes.map(v => `<option value="${escapar(v.id)}">${escapar(v.nome)}${v.id === f.padrao ? " (padrão)" : ""}</option>`).join("")}</select></label>`);
    const sv = b.querySelector("select"); sv.value = s.versao;
    sv.onchange = () => { s.versao = sv.value; guardar(); ctx.redesenhar(); };
  }
  if (temHist) b.append(seg(`Ao vivo ou o ${HIST.txt}`, [["vivo", "Ao vivo"], ["hist", HIST.botao]], s.modo, v => { s.modo = v; guardar(); ctx.redesenhar(); }, "fi-ts-fmodo"));
  el.append(b);
  if (temHist && s.modo === "hist" && HIST === HIST_COFRES) el.insertAdjacentHTML("beforeend", `<p class="fi-ts-otimista" role="note">⚠ <b>No período da escolha (otimista)</b>: as versões refeitas nos últimos 180 dias com os cofres escolhidos hoje, que foram escolhidos por terem ido bem. Não é previsão; o teste honesto é o fora da amostra, em Mais testes. ${q("historicoCofres")}</p>`);
}

// ------------------------------------------------------------------ Como está indo
function telaIndo(el, ctx, f, s) {
  seletores(el, ctx, f, s);
  const v = f.versoes.find(x => x.id === s.versao) || versaoPadrao(f), hist = s.modo === "hist", a = contaDe(v, s.modo);
  const soVivo = !v.historico && (v.aproximado || v.aoVivo?.aproximado);
  el.insertAdjacentHTML("beforeend", `<p class="fi-ts-jeito fi-ts-vfrase">${escapar(v.frase || "")} ${seloRisco(v.risco || "médio")}${v.alav > 1 ? ` <i class="fi-ts-selo">${v.alav}× ${q("alavancagem")}</i>` : ""}${v.fixa ? ` <i class="fi-ts-selo fixo">fixados por você</i>` : ""}${v.grupo === REFERENCIA ? ` <i class="fi-ts-selo">régua ${q("regua")}</i>` : ""}${soVivo ? ` <i class="fi-ts-selo aviso">só ao vivo · aproximado ${q(v.id === "entre" ? "entreCorretoras" : "aproximado")}</i>` : v.soAoVivo ? ` <i class="fi-ts-selo">só ao vivo</i>` : ""}</p>`);
  if (ctx.k === "robos" || ctx.k === "looping" || ctx.k === "opcoes") RB.avisoSemDados(el, v);
  if (ctx.k === "previsao") PV.avisoBloqueio(el);
  if (!a?.serie?.length) {
    const comeca = !hist && f.config?.aoVivoComeca;
    el.insertAdjacentHTML("beforeend", `<p class="fi-dica fi-ts-comeca">${hist ? (ctx.k === "previsao" ? "Só o Favorito perto do fim e o Azarão têm teste no passado (pelos mercados encerrados que o observatório já leu). Veja em Ao vivo." : v.soAoVivo ? "Esta versão é só ao vivo: segue os palpites de cada dia, então não há teste no passado. Veja em Ao vivo." : soVivo ? "Esta versão é só ao vivo: as taxas das outras corretoras não ficam guardadas, então não há como refazer o passado. Veja em Ao vivo." : "Esta versão não tem teste no passado.") : comeca ? `O ao vivo começa na sexta, ${dataDe(comeca)}: a primeira venda é depois do vencimento das 5h (08h UTC). Até lá, veja o teste no passado.` : "Esta versão ainda não tem dias medidos."}</p>`);
    if (!hist) { opcoesAbertas(el, f, v); aaveAgora(el, f); secaoBDM(el, v, a); }
    // opções (09/11/2026): antes da 1ª sexta, o prêmio caro de agora, o estresse com o que venderia e as janelas
    if (ctx.k === "opcoes" && !hist) { OP.secaoFiltro(el, f, v, a); OP.secaoEstresse(el, v); OP.secaoJanelas(el, v); }
    if (ctx.k === "previsao" && !hist) PV.secoesIndo(el, f, v, a);
    return;
  }
  if (hist && a.nota) el.insertAdjacentHTML("beforeend", `<p class="fi-dica fi-ts-hnota">${escapar(String(a.nota))}</p>`);
  const refs = refsDe(ctx.p), t = trechoDe(f, v, s.modo);
  const aprox = a.aproximado ? ` <i class="fi-ts-selo aviso">aproximado ${q("aproximado")}</i>` : "";
  const titulo = `${escapar(nomeForma(ctx.p, ctx.k))} · ${escapar(v.nome)}${hist ? ` · ${HIST.txt}${a.de && a.ate ? ` (${dataCurta(a.de)} a ${dataCurta(a.ate)})` : ""}` : ""}${aprox}`;
  const m = metricasConta(ctx.p, f, a, s.modo);
  heroiEstimativa(el, refs, t, { titulo, ops: SEM_OPS, metricas: m, extra: ctx.k === "looping" && v.medida === "ether" ? `<p class="fi-dica fi-ts-lp-medida">Medida em ether ${q("medidoEther")}: o CDI aqui é só para situar; a régua certa é o Só wstETH (logo abaixo).</p>` : "" });
  if (!hist && ctx.k === "cofres") linhaForaCofres(el, ctx, f, v, s);
  if (!hist && a.aproximado) el.insertAdjacentHTML("beforeend", `<p class="fi-dica fi-ts-aprox-vivo">Aproximado também ao vivo: ${v.id === "entre" ? "as taxas das outras corretoras são as previstas que a própria Hyperliquid publica, lidas a cada 6 h, e a conta supõe que as duas pernas valem igual o tempo todo." : "a conta é uma estimativa feita com poucos pontos."}</p>`);
  tiles(el, a, t, v, f.poolSel);
  // looping (09/11/2026): nas versões medidas em ether, a régua em ether no lugar de "Contra o CDI e o risco"
  if (ctx.k === "looping" && v.medida === "ether") LP.secaoContraRegua(el, f, v, s.modo);
  else secaoMetricas(el, m, { moeda: MOEDA });
  financiamentoAgora(el, f);
  if (ctx.k === "funding") FUN.contaPorDentro(el, a, v, f, { hist });
  // robôs (09/11/2026): a conta por dentro e as janelas de 30 dias do teste no passado, em testes/robos.js
  if (ctx.k === "robos") { RB.contaPorDentro(el, a, v, { hist }); RB.secaoJanelas(el, v); }
  // looping (09/11/2026): a conta por dentro com o empate, ether × dólar, o estresse, as janelas e onde o dólar rende mais
  if (ctx.k === "looping") { LP.contaPorDentro(el, a, v, { hist }); LP.etherDolar(el, a, v); LP.secaoEstresse(el, v); LP.secaoJanelas(el, v); if (!hist) LP.ondeDolar(el, f, v); }
  // opções (09/11/2026): a conta por dentro com o empate, a pior semana, o prêmio caro, o estresse, as janelas e o sorriso
  if (ctx.k === "opcoes") { OP.contaPorDentro(el, a, v, { hist }); OP.secaoPiorSemana(el, a, v); OP.secaoFiltro(el, f, v, a); OP.secaoEstresse(el, v); OP.secaoJanelas(el, v); if (hist) OP.notaSorriso(el, f, v); }
  if (ctx.k === "previsao") { PV.secoesIndo(el, f, v, a, { hist }); if (hist) RB.secaoJanelas(el, v); }
  apostasEsperando(el, f, v);
  if (!hist) secaoBDM(el, v, a);
  if (!hist) { opcoesAbertas(el, f, v); aaveAgora(el, f); poolAgora(el, f); }
  const sg = secao(el, hist ? HIST.Txt : "Patrimônio de mentira", `${escapar(v.nome)} × bitcoin × CDI`, "fi-ts-fcurva");
  graficoComRefs(sg, refs, v.nome, t.pts);
  if (hist && a.aproximado) sg.insertAdjacentHTML("beforeend", `<p class="fi-dica">Aproximado: feito com poucos pontos por dia, então a curva é mais lisa que a de verdade.</p>`);
  const sq = secao(el, `Queda do topo ${q("queda")}`, `pior: ${pct(-t.queda, 1)}`, "fi-ts-fqueda");
  sq.insertAdjacentHTML("beforeend", `<p class="fi-dica">Quanto a conta estava abaixo do melhor momento.</p>`);
  sq.append(graficoQueda(K.quedaSerie(t.pts)));
  const meses = K.porMes(t.pts);
  if (meses.length > 1) secao(el, "% de cada mês").append(graficoMeses(meses));
}
/** Funding: a taxa de cada moeda agora (os `itens` com `fundingAgora`, frações ao ano), comparada com outras corretoras. */
function financiamentoAgora(el, f) {
  const xs = (Array.isArray(f.itens) ? f.itens : []).filter(i => i && i.moeda && (i.fundingAgora != null || i.media3d != null));
  if (!xs.length) return;
  const a = (v) => (v == null || !Number.isFinite(+v) ? "—" : `${pct(+v, 1)}`);
  const s = secao(el, `Financiamento agora ${q("funding")}`, "ao ano, por moeda", "fi-ts-fund-agora");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${xs.map(i => `<li><span><b>${escapar(i.moeda)}</b><small>média de 3 dias ${a(i.media3d)}${i.binance != null ? ` · Binance ${a(i.binance)}` : ""}${i.bybit != null ? ` · Bybit ${a(i.bybit)}` : ""}${i.alavMax ? ` · até ${i.alavMax}×` : ""}</small></span><b class="${classe(i.fundingAgora ?? i.hl)}">${a(i.fundingAgora ?? i.hl)}</b></li>`).join("")}</ul>
    <p class="fi-dica">Positivo: quem fica vendido no perpétuo recebe. Negativo: paga.</p>`);
}
/** Apostas: as já feitas no papel esperando o placar (os `itens` com `jogo`), da versão escolhida. */
function apostasEsperando(el, f, v) {
  const xs = (Array.isArray(f.itens) ? f.itens : []).filter(i => i && i.jogo && (!Array.isArray(i.versoes) || i.versoes.includes(v.id)))
    .sort((a, b) => (a.inicio || 0) - (b.inicio || 0));
  if (!xs.length) return;
  const odd = (o) => (o == null ? "—" : Number(o).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 }));
  const s = secao(el, "Esperando o placar", `${xs.length} aposta${xs.length === 1 ? "" : "s"} no papel`, "fi-ts-esperando");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${xs.slice(0, 30).map(i => `<li><span><b>${escapar(i.jogo)}</b><small>${escapar(i.selecao || "")}${i.liga ? ` · ${escapar(i.liga)}` : ""}${i.inicio ? ` · ${quando(i.inicio)}` : ""}${i.casa ? ` · ${escapar(i.casa)}` : ""} · justa ${odd(i.justa)}</small></span><b>${odd(i.odd)}${i.valor != null ? ` <small class="${classe(i.valor)}">${pct(i.valor, 1)}</small>` : ""}</b></li>`).join("")}</ul>`);
}
/** Opções: as vendidas em aberto da versão (os `itens` com `instrumento`), com o prêmio e quanto custaria recomprar. */
function opcoesAbertas(el, f, v) {
  const xs = (Array.isArray(f.itens) ? f.itens : []).filter(i => i && i.instrumento && i.versao === v.id).sort((a, b) => (a.vence || 0) - (b.vence || 0));
  if (!xs.length) return;
  const s = secao(el, `Em aberto ${q("put")}`, `${xs.length} ${xs.length === 1 ? "opção vendida" : "opções vendidas"}`, "fi-ts-opcoes-abertas");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${xs.map(i => `<li><span><b>${i.tipo === "call" ? "Call" : "Put"} de US$ ${Math.round(i.strike || 0).toLocaleString("pt-BR")} · ${escapar(i.moeda || "")}</b><small>vence ${dataDe(i.vence)}${i.delta != null ? ` · delta ${Number(i.delta).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` : ""} · recebeu ${din(i.premio || 0)}</small></span><b class="${classe((i.premio || 0) - (i.marca || 0))}">${din((i.premio || 0) - (i.marca || 0), { sinal: true })}<small> se recomprar agora</small></b></li>`).join("")}</ul>`);
}
/** Looping: as taxas do Aave de agora (os `itens` com `ativo`, frações ao ano). */
function aaveAgora(el, f) {
  const xs = (Array.isArray(f.itens) ? f.itens : []).filter(i => i && i.ativo);
  if (!xs.length) return;
  const a = (x) => (x == null || !Number.isFinite(+x) ? "—" : pct(+x, 2));
  const s = secao(el, `Taxas do Aave agora ${q("looping")}`, "ao ano, na rede Base", "fi-ts-aave");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${xs.map(i => `<li><span><b>${escapar(i.ativo)}</b><small>${[i.emprestimo != null ? `pegar emprestado ${a(i.emprestimo)}` : null, i.staking != null ? `staking ${a(i.staking)}` : null, i.lt ? `liquida em ${pctSem(i.lt)} ${q("fatorSaude")}` : null, i.nota ? escapar(i.nota) : null].filter(Boolean).join(" · ")}</small></span><b>${a(i.deposito)}<small> depósito</small></b></li>`).join("")}</ul>`);
}
/** Pools: o pool de agora (preço, volume das últimas 24 h conferido com o GeckoTerminal, o custo de reposicionar). */
function poolAgora(el, f) {
  const c = f.config || {};
  const pl = f.poolSel;
  if (pl) {
    // vários pools (09/11/2026): o escolhido
    const [b, ct] = String(pl.par || "").split("/");
    const s = secao(el, `O pool agora ${q("pool")}`, escapar(`${pl.par || ""} · ${pl.protocolo || pl.dex || ""} · Base`), "fi-ts-pool");
    const g = pl.gauge;
    const linhas = [
      [`Preço do ${moedaDe(b)}`, pl.preco != null ? precoTexto(pl.preco, ct) : "—", `taxa de ${pctSem(pl.taxa, 2)} por troca`],
      ["Volume em 24 h", usCurto(pl.volume24h), `${(pl.trocas24h || 0).toLocaleString("pt-BR")} trocas${pl.id === POOL_PADRAO && c.conferencia?.volume24h ? ` · GeckoTerminal: ${usCurto(c.conferencia.volume24h)}` : ""}`],
      [`Liquidez ${q("tvl")}`, usCurto(pl.tvl), pl.giro != null ? `o volume de um dia é ${pctSem(pl.giro, 0)} dela ${q("giro")}` : "o que o pool guarda"],
      [`Taxas, ao ano ${q("giro")}`, pl.aprTaxas != null ? pct(pl.aprTaxas, 1) : "—", "o pool inteiro, se o volume seguir assim"],
      [`Oscilação de um dia ${q("faixaVol")}`, pl.volDia != null ? pctSem(pl.volDia, pl.volDia < 0.01 ? 2 : 1) : "—", "a faixa das versões segue ela"],
    ];
    if (g) linhas.push([`AERO no gauge ${q("gauge")}`, g.aprEmissoes != null ? `${pct(g.aprEmissoes, 1)} a.a.` : "—", `${Math.round(g.aeroDia || 0).toLocaleString("pt-BR")} AERO por dia · ${pctSem(g.fracStake || 0)} da liquidez em stake`]);
    if (pl.id === POOL_PADRAO && c.custoReposicionar != null) linhas.push([`Reposicionar ${q("gas")}`, din(c.custoReposicionar), "de gás (fora a troca)"]);
    if (pl.passado && pl.passado.alcancou === false) linhas.push(["Teste no passado", "lendo", `faltam ~${Number(pl.passado.faltamDias || 0).toLocaleString("pt-BR")} dias`]);
    s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${linhas.map(([n, v, x]) => `<li><span><b>${n}</b><small>${x}</small></span><b>${v}</b></li>`).join("")}</ul>${pl.nota ? `<p class="fi-dica">${escapar(pl.nota)}</p>` : ""}`);
    return;
  }
  if (c.taxaPool == null) return;
  const cf = c.conferencia, vol = c.volume24h;
  const s = secao(el, `O pool agora ${q("pool")}`, escapar(`${c.par || ""} · ${c.protocolo || ""} · ${c.rede || ""}`), "fi-ts-pool");
  const linhas = [
    ["Preço do ether", c.precoEth ? `US$ ${Math.round(c.precoEth).toLocaleString("pt-BR")}` : "—", `taxa de ${pctSem(c.taxaPool, 2)} por troca`],
    ["Volume em 24 h", usCurto(vol), cf?.volume24h ? `GeckoTerminal: ${usCurto(cf.volume24h)}` : "das trocas lidas"],
    [`Reposicionar ${q("gas")}`, c.custoReposicionar != null ? din(c.custoReposicionar) : "—", "de gás (fora a troca)"],
  ];
  if (c.passado && c.passado.alcancou === false) linhas.push(["Teste no passado", "lendo", `faltam ~${Number(c.passado.faltamDias || 0).toLocaleString("pt-BR")} dias`]);
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${linhas.map(([n, v, x]) => `<li><span><b>${n}</b><small>${x}</small></span><b>${v}</b></li>`).join("")}</ul>`);
}
/** Um preço do par: em US$ (inteiro quando grande, com casas nos dólares estáveis) ou em bitcoin. */
function precoNum(p, cot) {
  if (p == null || !Number.isFinite(+p)) return "—";
  const casas = cot === "cbBTC" ? 5 : p >= 100 ? 0 : p >= 2 ? 2 : 4;
  return Number(p).toLocaleString("pt-BR", { minimumFractionDigits: casas === 0 ? 0 : Math.min(casas, 2), maximumFractionDigits: casas });
}
const precoTexto = (p, cot) => (cot === "cbBTC" ? `${precoNum(p, cot)} BTC` : `US$ ${precoNum(p, cot)}`);
const unidadePreco = (base, cot) => (cot === "cbBTC" ? `bitcoin por ${moedaDe(base)}` : `US$ por ${moedaDe(base)}`);

/** Os números da conta e os `extra` que o app conhece (FORMATO.md). `pl` = o pool escolhido (vários pools). */
function tiles(el, a, t, v, pl = null) {
  const x = a.extra || {}, it = [], memes = x.apostado != null && x.dobrou != null, aposta = !memes && x.apostas != null, prev = !memes && !aposta && x.posicoes != null && "abertas" in x;
  it.push(`<span><small>Pior queda ${q("queda")}</small><b>${pct(-t.queda, 1)}</b><small>o pior momento</small></span>`);
  it.push(`<span><small>Risco ${q("risco")}</small><b>${seloRisco(v.risco || "médio")}</b><small>${aposta || memes || prev ? "pelo tamanho das apostas" : v.alav > 1 ? `alavancagem ${v.alav}×` : "sem alavancagem"}</small></span>`);
  if (prev) {
    // mercados de previsão (FORMATO.md, "Mercados de previsão"): US$ 20 por posição, sem liquidações
    it.push(...PV.tilesPrevisao(x));
  } else if (memes) {
    // memecoins (FORMATO.md, "Memecoins"): US$ 10 por token, sem liquidações
    it.push(`<span><small>Apostas</small><b>${(x.apostas || 0).toLocaleString("pt-BR")}</b><small>US$ 10 cada${x.semDinheiro ? ` · ${x.semDinheiro} sem dinheiro` : ""}</small></span>`);
    if (x.acerto != null) it.push(`<span><small>Acerto ${q("acerto")}</small><b>${pctSem(x.acerto)}</b><small>com lucro</small></span>`);
    if (x.roi != null) it.push(`<span><small>Retorno por aposta ${q("roi")}</small><b class="${classe(x.roi)}">${pct(x.roi, 1)}</b><small>do valor apostado</small></span>`);
    it.push(`<span><small>Saídas</small><b>${x.dobrou || 0} · ${x.stop || 0}</b><small>no dobro · no −50%</small></span>`);
    if (x.melhor != null && x.pior != null) it.push(`<span><small>Melhor e pior</small><b class="${classe(x.melhor)}">${din(x.melhor, { sinal: true })}</b><small>pior ${din(x.pior, { sinal: true })}</small></span>`);
    it.push(...MM.tilesMemes(x)); // custos e golpe (09/11/2026)
  } else if (aposta) {
    // apostas de valor (FORMATO.md, "Apostas de valor"): sem taxas nem liquidações; as contas são em R$ de mentira
    it.push(`<span><small>Apostas</small><b>${(x.apostas || 0).toLocaleString("pt-BR")}</b><small>${x.anuladas ? `${x.anuladas} anulada${x.anuladas === 1 ? "" : "s"}` : "com placar"}</small></span>`);
    if (x.acerto != null) it.push(`<span><small>Acerto ${q("acerto")}</small><b>${pctSem(x.acerto)}</b><small>apostas ganhas</small></span>`);
    if (x.roi != null) it.push(`<span><small>Retorno por aposta ${q("roi")}</small><b class="${classe(x.roi)}">${pct(x.roi, 1)}</b><small>do valor apostado</small></span>`);
    if (x.oddMedia) it.push(`<span><small>Odd média ${q("odd")}</small><b>${Number(x.oddMedia).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</b><small>das apostas feitas</small></span>`);
    if (x.clvMedio != null) it.push(`<span><small>CLV ${q("clv")}</small><b class="${classe(x.clvMedio)}">${pct(x.clvMedio, 1)}</b><small>${x.clvPositivo != null ? `${pctSem(x.clvPositivo)} acima do fechamento` : "contra o fechamento"}</small></span>`);
    if (x.piorSequencia) it.push(`<span><small>Pior sequência</small><b>${x.piorSequencia}</b><small>derrotas seguidas</small></span>`);
    if (x.ganhoGratis != null) it.push(`<span><small>Aposta grátis ${q("apostaGratis")}</small><b class="${classe(x.ganhoGratis)}">${din(x.ganhoGratis, { sinal: true })}</b><small>ganho sem pôr dinheiro</small></span>`);
    if (x.fonteSoft) it.push(`<span><small>Casa</small><b>${escapar(String(x.fonteSoft).replace(/ \(.*\)$/, ""))}</b><small>${escapar((String(x.fonteSoft).match(/\((.*)\)$/) || [])[1] || "onde a aposta seria feita")}</small></span>`);
  } else {
    it.push(`<span><small>Operações</small><b>${(a.ops || 0).toLocaleString("pt-BR")}</b><small>taxas ${din(a.taxas || 0)}</small></span>`);
    it.push(`<span class="${a.nLiq ? "fi-ts-ruim" : ""}"><small>Liquidações ${q("liquidacao")}</small><b>${a.nLiq || 0}</b><small>${a.liquidacoes?.length ? `última ${dataDe(a.liquidacoes.at(-1)?.em)}` : "nenhuma"}</small></span>`);
    if (a.acerto != null) it.push(`<span><small>Acerto ${q("acerto")}</small><b>${Math.round(a.acerto * 10)} de 10</b><small>fechadas com lucro</small></span>`);
  }
  if (a.gm && a.pm) it.push(`<span><small>Ganho ÷ perda ${q("ganhoPerda")}</small><b>${(a.gm / a.pm).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×</b><small>${din(a.gm)} ÷ ${din(a.pm)}</small></span>`);
  // funding
  if (x.recebido != null || x.pago != null) it.push(`<span><small>Financiamento ${q("funding")}</small><b class="${classe((x.recebido || 0) - (x.pago || 0))}">${din((x.recebido || 0) - (x.pago || 0), { sinal: true })}</b><small>recebeu ${din(x.recebido || 0)} · pagou ${din(x.pago || 0)}</small></span>`);
  if (x.fundingAno != null && x.diferencaAno == null) it.push(`<span><small>Taxa média</small><b>${pct(x.fundingAno, 1)} a.a.</b><small>no período</small></span>`);
  if (x.longo || x.curto) it.push(`<span class="fi-ts-largo"><small>As duas pernas agora ${q("entreCorretoras")}</small><b>${x.longo ? `comprado na ${escapar(x.longo)}` : "sem posição"}${x.curto ? ` · vendido na ${escapar(x.curto)}` : ""}</b><small>${x.diferencaAno != null ? `diferença das taxas ${pct(x.diferencaAno, 1)} a.a.` : ""}${x.montagens != null ? ` · montou ${x.montagens} ${x.montagens === 1 ? "vez" : "vezes"}` : ""}${x.leituras != null ? ` · ${x.leituras} leituras` : ""}</small></span>`);
  else if ("longo" in x) it.push(`<span><small>As duas pernas ${q("entreCorretoras")}</small><b>fora</b><small>${x.diferencaAno != null ? `diferença ${pct(x.diferencaAno, 1)} a.a.: pouca para entrar` : "esperando uma diferença boa"}</small></span>`);
  if (x.base != null) it.push(`<span><small>Base ${q("base")}</small><b>${pct(x.base, 2)}</b><small>à vista × perpétuo</small></span>`);
  if (x.moeda && x.premios == null) it.push(`<span><small>Moeda agora</small><b>${escapar(x.moeda)}</b><small>${x.dentro === false ? "fora: esperando parado" : x.dentro === true ? "montada" : "da posição"}</small></span>`);
  // robôs
  // (no perpétuo, `comprado` tem sinal: negativo = vendido; e `caixa` é a conta inteira: não somar os dois)
  if (x.comprado != null) it.push(`<span><small>${x.comprado < 0 ? "Vendido na moeda" : "Na moeda"}</small><b>${din(Math.abs(x.comprado))}</b><small>${x.comprado < 0 ? "aposta na queda" : "comprado"}</small></span>`);
  if (x.caixa != null) it.push(`<span><small>Caixa</small><b>${din(x.caixa)}</b><small>dinheiro da conta</small></span>`);
  if (x.fundingPago != null) it.push(`<span><small>Financiamento ${q("funding")}</small><b class="${classe(-x.fundingPago)}">${din(-x.fundingPago, { sinal: true })}</b><small>${x.fundingPago >= 0 ? "pago" : "recebido"}</small></span>`);
  it.push(...RB.tilesRobo(x));
  it.push(...LP.tilesLooping(x));
  it.push(...OP.tilesOpcoes(x));
  if (x.ciclos != null) it.push(`<span><small>Ciclos</small><b>${x.ciclos}</b><small>compras feitas</small></span>`);
  if (x.degrausExecutados != null) it.push(`<span><small>Degraus ${q("grade")}</small><b>${x.degrausExecutados}</b><small>${x.foraDaGrade ? "preço fora da grade" : "preço dentro da grade"}</small></span>`);
  if (x.precoMedio) it.push(`<span><small>Preço médio ${q("dca")}</small><b>US$ ${Number(x.precoMedio).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</b><small>das compras</small></span>`);
  // looping
  if ("hf" in x) it.push(`<span class="${x.hf != null && x.hf < 1.15 ? "fi-ts-ruim" : ""}"><small>Fator de saúde ${q("fatorSaude")}</small><b>${x.hf == null ? "—" : Number(x.hf).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</b><small>${x.hf == null ? "sem dívida" : "abaixo de 1, liquidação"}</small></span>`);
  if (x.alavAgora != null && x.hf !== undefined) it.push(`<span><small>Alavancagem agora ${q("alavancagem")}</small><b>${vezesBr(x.alavAgora)}</b><small>garantia ÷ patrimônio</small></span>`);
  if (x.rendeAno != null) it.push(`<span><small>Rende agora</small><b class="${classe(x.rendeAno)}">${pct(x.rendeAno, 1)} a.a.</b><small>depósito − juro, multiplicados</small></span>`);
  if (x.ganhoJuros != null) it.push(`<span><small>Juros ${q("staking")}</small><b class="${classe(x.ganhoJuros - (x.custoJuros || 0))}">${din(x.ganhoJuros - (x.custoJuros || 0), { sinal: true })}</b><small>ganhou ${din(x.ganhoJuros)} · pagou ${din(x.custoJuros || 0)}</small></span>`);
  if (x.precoLiquidacao) it.push(`<span><small>Liquida se o ether cair a</small><b>US$ ${Math.round(x.precoLiquidacao).toLocaleString("pt-BR")}</b><small>pela regra do Aave</small></span>`);
  if (x.defesas) it.push(`<span><small>Defesas</small><b>${x.defesas}</b><small>vendeu antes da liquidação</small></span>`);
  if (x.emDolar != null) it.push(`<span><small>Em dólar de verdade</small><b>${din(x.emDolar)}</b><small>${pl?.medida === "btc" ? `com o bitcoin de hoje (a conta é medida em bitcoin) ${q("medidoBtc")}` : "com o ether a hoje (a conta é medida em ether)"}</small></span>`);
  // opções
  if (x.premios != null) it.push(`<span><small>Prêmios ${q("premio")}</small><b class="ts-sobe">${din(x.premios)}</b><small>${x.vendas || 0} ${x.vendas === 1 ? "opção vendida" : "opções vendidas"}</small></span>`);
  if (x.pagos != null) it.push(`<span class="${x.dentro ? "fi-ts-ruim" : ""}"><small>Pago no vencimento</small><b class="${x.pagos > 0 ? "ts-desce" : ""}">${din(x.pagos)}</b><small>${x.dentro || 0} ${x.dentro === 1 ? "venceu" : "venceram"} dentro · ${x.semValor || 0} sem valor</small></span>`);
  if (x.recompras) it.push(`<span><small>Recompras</small><b>${x.recompras}</b><small>fechou antes de vencer</small></span>`);
  if (x.emAberto !== undefined && x.premios != null) {
    // "Put 70.000 · vence 13/11 (+1)": o strike no número grande, o vencimento embaixo
    const [cab, ...resto] = String(x.emAberto || "").split(" · ");
    it.push(`<span><small>Em aberto ${q("strike")}</small><b>${escapar(cab || "nenhuma")}</b><small>${x.emAberto ? escapar(resto.join(" · ")) + (x.naMoeda ? ` · na moeda ${din(x.naMoeda)}` : "") : "esperando a sexta"}</small></span>`);
  }
  // pools
  if (x.taxasGanhas != null && x.perdaImp !== undefined && x.aeroGanho == null) it.push(`<span><small>Taxas do pool ${q("pool")}</small><b class="ts-sobe">${din(x.taxasGanhas)}</b><small>ganhas nas trocas</small></span>`);
  if (x.perdaImp != null) it.push(`<span><small>Perda impermanente ${q("perdaImp")}</small><b class="${classe(x.perdaImp)}">${din(x.perdaImp, { sinal: true })}</b><small>contra só segurar</small></span>`);
  if (x.reposicoes != null && x.perdaImp != null) it.push(`<span><small>Reposicionou ${q("reposicionar")}</small><b>${x.reposicoes}</b><small>gás ${din(x.gasPago || 0)}</small></span>`);
  if (x.reinvestimentos != null && (x.reinvestimentos > 0 || v.grupo === "À mão")) it.push(`<span><small>Reinvestiu ${q("reinvestir")}</small><b>${x.reinvestimentos}</b><small>${x.reinvestimentos === 1 ? "vez as taxas" : "vezes as taxas"}, a cada 7 dias</small></span>`);
  if (x.dentroFrac != null) it.push(`<span class="${x.dentro === false ? "fi-ts-ruim" : ""}"><small>Tempo na faixa ${q("faixaPool")}</small><b>${pctSem(x.dentroFrac)}</b><small>${x.dentro === false ? "agora fora: não ganha" : "agora dentro"}</small></span>`);
  // vários pools (09/11/2026): a faixa e a composição nas moedas do par escolhido
  const [pb, pc] = String(pl?.par || "WETH/USDC").split("/");
  if (Array.isArray(x.faixa)) it.push(`<span><small>Faixa agora${x.largura != null ? ` ${q("faixaVol")}` : ""}</small><b>${precoNum(x.faixa[0], pc)} a ${precoNum(x.faixa[1], pc)}</b><small>${unidadePreco(pb, pc)}${x.largura != null ? ` · ±${pctSem(x.largura, x.largura < 0.01 ? 2 : 1)}` : ""}</small></span>`);
  if (x.noEther != null && x.noDolar != null) { const tot = x.noEther + x.noDolar; it.push(`<span><small>Composição</small><b>${tot > 0 ? pctSem(x.noEther / tot) : "—"} ether</b><small>${din(x.noEther)} · ${din(x.noDolar)} em dólar</small></span>`); }
  else if (x.naBase != null && x.naCotacao != null && x.perdaImp !== undefined || (x.naBase != null && pl && v.grupo === REFERENCIA)) { const tot = x.naBase + x.naCotacao; it.push(`<span><small>Composição</small><b>${tot > 0 ? pctSem(x.naBase / tot) : "—"} ${moedaDe(pb)}</b><small>${din(x.naBase)} · ${din(x.naCotacao)} em ${moedaDe(pc)}</small></span>`); }
  if (x.aeroGanho != null) it.push(`<span><small>AERO do gauge ${q("gauge")}</small><b class="ts-sobe">${din(x.aeroVendido || 0)}</b><small>${Number(x.aeroGanho).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} AERO ganhos${x.aeroParado ? ` · ${din(x.aeroParado)} por vender` : ""}</small></span>`);
  // cofres
  if (x.cofres != null) it.push(`<span><small>Cofres ${q("cofre")}</small><b>${x.cofres}</b><small>na versão</small></span>`);
  if (x.comissaoPaga != null) it.push(`<span><small>Comissão do líder ${q("comissao")}</small><b>${din(x.comissaoPaga)}</b><small>paga até agora</small></span>`);
  if (x.travadoAte && x.travadoAte > Date.now()) it.push(`<span><small>Travado até</small><b>${dataDe(x.travadoAte)}</b><small>não dá para sair antes</small></span>`);
  const ti = document.createElement("div"); ti.className = "fi-tiles fi-ts-tiles";
  ti.innerHTML = it.join("");
  el.append(ti);
}

// ------------------------------------------------------------------ Versões
/** As versões do looping medidas em ether não se comparam com o CDI (a régua delas é o Só wstETH; 09/11/2026). */
const semCdi = (ctx, v) => ctx.k === "looping" && v.medida === "ether";
function telaVersoes(el, ctx, f, s) {
  seletores(el, ctx, f, s, { versao: false });
  const lista = f.versoes.map(v => ({ v, r: resumoVersao(ctx.p, f, v, s.modo) })).filter(x => x.r?.t?.pts?.length)
    .sort((a, b) => valorOrdem(b.r.e, b.r.t) - valorOrdem(a.r.e, a.r.t));
  const sem = f.versoes.filter(v => !lista.some(x => x.v === v));
  // os grupos na ordem das versões da forma, com as réguas ("Referência") por último
  const grupos = [...new Set(f.versoes.map(v => v.grupo || ""))].filter(g => lista.some(x => (x.v.grupo || "") === g))
    .sort((a, b) => (a === REFERENCIA) - (b === REFERENCIA));
  const s0 = secao(el, "Da melhor para a pior", `${s.modo === "hist" ? HIST.txt : "ao vivo"} · desde o início`, "fi-ts-fversoes");
  if (!lista.length) s0.insertAdjacentHTML("beforeend", `<p class="fi-dica">Sem dados ainda.</p>`);
  const separar = grupos.length > 1 && grupos.every(Boolean);
  for (const g of separar ? grupos : [null]) {
    const xs = g == null ? lista : lista.filter(x => (x.v.grupo || "") === g);
    if (separar) s0.insertAdjacentHTML("beforeend", `<h4 class="fi-ts-grupo">${escapar(g)}</h4>${g === REFERENCIA ? `<p class="fi-dica fi-ts-regua">Réguas para comparar, não estratégias ${q("regua")}</p>` : g === "Entre corretoras" ? `<p class="fi-dica fi-ts-regua">Só ao vivo e aproximada ${q("entreCorretoras")}</p>` : g === "À mão" ? `<p class="fi-dica fi-ts-regua">Olha uma vez por dia e reinveste as taxas a cada 7 dias ${q("reinvestir")}</p>` : ""}`);
    s0.insertAdjacentHTML("beforeend", `<ol class="fi-ts-rank">${xs.map(({ v, r }, i) => `<li data-v="${escapar(v.id)}" role="button" tabindex="0" class="${v.id === s.versao ? "on" : ""}"><span class="pos">${i + 1}º</span><span class="tx"><b>${escapar(v.nome)}${v.id === f.padrao ? ` <i class="fi-ts-selo">padrão</i>` : ""}</b><small><span class="${classe(r.e?.mes ?? r.t.retorno)}">${textoCurto(r.e, r.t)}</span>, ${seloRisco(r.risco)}, pior queda ${pctSem(r.t.queda, 1)}${r.t.nLiq ? `, <span class="ts-desce">${r.t.nLiq} ${r.t.nLiq === 1 ? "liquidação" : "liquidações"}</span>` : ""}${semCdi(ctx, v) ? "" : `${r.frente ? " · à frente do CDI" : ""}${r.m?.sharpe != null ? ` · Sharpe ${Number(r.m.sharpe).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}` : ""}`}${r.aproximado ? ` <i class="fi-ts-selo aviso">aproximado</i>` : ""}</small></span></li>`).join("")}</ol>`);
  }
  if (sem.length) s0.insertAdjacentHTML("beforeend", `<p class="fi-dica">Sem ${s.modo === "hist" ? HIST.txt : "dias medidos"}: ${sem.map(v => escapar(v.nome)).join(", ")}.</p>`);
  s0.insertAdjacentHTML("beforeend", `<p class="fi-dica">Tocar escolhe a versão do número grande. Ordem pelo % ao mês estimado; com menos de 7 dias, vai para o fim. ${q("porMes")}</p>`);
  if (ctx.k === "funding") FUN.marcarEmpates(s0, f, s.modo);
  if (ctx.k === "robos") RB.marcarJanelas(s0, f);
  if (ctx.k === "looping") LP.marcarVersoes(s0, f);
  if (ctx.k === "opcoes") OP.marcarVersoes(s0, f);
  s0.querySelectorAll("[data-v]").forEach(li => {
    const ir = () => { s.versao = li.dataset.v; guardar(); toast(`Versão: ${f.versoes.find(v => v.id === s.versao)?.nome || s.versao}`); ctx.redesenhar(); };
    li.onclick = ir; li.onkeydown = (ev) => { if (ev.key === "Enter") ir(); };
  });
}

// ------------------------------------------------------------------ O que aconteceu
/** O porquê de cada saída nos cofres (o `motivo` do evento, 09/11/2026). */
export const MOTIVO_SAIDA = { stop: "caiu do topo", tvl: "TVL caindo", lider: "líder com pouco", deposito: "fechou para depósitos", fechou: "cofre fechou", sumiu: "cofre sumiu", lista: "saiu da lista", grade: "preço fora da grade", semana: "outro melhor da semana", fixos: "tirado dos fixados", ...LP.MOTIVOS_LOOPING, ...OP.MOTIVOS_OPCOES };
const CLS_EVENTO = { liquidou: "ruim", aviso: "aviso", entrou: "entra", saiu: "sai", abriu: "entra", pagou: "aviso", ganhou: "entra", perdeu: "sai", anulou: "aviso" };
function telaAconteceu(el, ctx, f, s) {
  const evs = (Array.isArray(f.eventos) ? f.eventos : []).filter(e => e && e.texto).sort((a, b) => (b.em || 0) - (a.em || 0));
  const ids = new Set(f.versoes.map(v => v.id));
  if (s.fVersao !== "*" && s.fVersao !== "" && !ids.has(s.fVersao)) s.fVersao = "*";
  const b = document.createElement("div"); b.className = "fi-ts-sels fi-ts-sels1";
  b.innerHTML = `<select data-f="fVersao" aria-label="Versão"><option value="*">Todas as versões</option><option value="">A forma inteira</option>${f.versoes.map(v => `<option value="${escapar(v.id)}">${escapar(v.nome)}</option>`).join("")}</select>`;
  const sv = b.querySelector("select"); sv.value = s.fVersao;
  sv.onchange = () => { s.fVersao = sv.value; guardar(); ctx.redesenhar(); };
  el.append(b);
  const lista = evs.filter(e => s.fVersao === "*" || (s.fVersao === "" ? e.versao == null : e.versao === s.fVersao));
  const nomeV = Object.fromEntries(f.versoes.map(v => [v.id, v.nome]));
  const sec = secao(el, "Linha do tempo", `${Math.min(lista.length, 80)} de ${lista.length}`, "fi-ts-tempo fi-ts-ftempo");
  sec.insertAdjacentHTML("beforeend", lista.length
    ? `<ul class="fi-ts-linha-tempo">${lista.slice(0, 80).map(e => `<li class="${CLS_EVENTO[e.tipo] || ""}" data-tipo="${escapar(e.tipo || "")}" data-versao="${escapar(e.versao ?? "")}"><span class="fi-ts-pt"></span><span class="tx">${escapar(e.texto)}${e.tipo === "liquidou" ? ` ${q("liquidacao")}` : ""}${e.motivo && MOTIVO_SAIDA[e.motivo] ? ` <i class="fi-ts-selo fi-ts-motivo" data-motivo="${escapar(e.motivo)}">${MOTIVO_SAIDA[e.motivo]}</i>` : ""}<small>${e.versao ? `${escapar(nomeV[e.versao] || e.versao)} · ` : ""}${e.em ? quando(e.em) : ""}</small></span></li>`).join("")}</ul>`
    : `<p class="fi-dica">${evs.length ? "Nada com esse filtro." : "Nada aconteceu ainda."}</p>`);
}

// ------------------------------------------------------------------ Quais cofres (só nos cofres)
function telaQuais(el, ctx, f) {
  FX.conferirPedidos(f);
  const itens = (Array.isArray(f.itens) ? f.itens : []).filter(i => i?.endereco);
  const ativos = itens.filter(i => !i.saiu), sairam = itens.filter(i => i.saiu);
  const cand = (Array.isArray(f.candidatos) ? f.candidatos : []).filter(c => c?.endereco)
    .sort((a, b) => (b.passou === true) - (a.passou === true) || (b.tvl || 0) - (a.tvl || 0));
  const s1 = secao(el, `Seguidos agora ${q("cofre")}`, `${ativos.length}`, "fi-ts-cofres-seg");
  if (!ativos.length) s1.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nenhum cofre seguido ainda.</p>`);
  ativos.forEach(i => s1.append(cartaoCofre(ctx, f, i, { medido: true })));
  if (sairam.length) {
    const s2 = secao(el, "Saíram", `${sairam.length}`, "fi-ts-cofres-sairam");
    sairam.forEach(i => s2.append(cartaoCofre(ctx, f, i, { medido: true })));
  }
  const s3 = secao(el, `Candidatos ${q("tvl")}`, `${cand.length} · os que passaram primeiro`, "fi-ts-cofres-cand");
  s3.insertAdjacentHTML("beforeend", `<p class="fi-dica">Fixar põe o cofre na versão "Os que você fixou" e ele não sai pela regra. Entra na próxima rodada (a cada 6 h).</p>`);
  if (!cand.length) s3.insertAdjacentHTML("beforeend", `<p class="fi-dica">Sem candidatos nesta rodada.</p>`);
  const mostrar = telaQuais.todos ? cand : cand.slice(0, 12);
  mostrar.forEach(c => s3.append(cartaoCofre(ctx, f, c, { candidato: true })));
  if (cand.length > mostrar.length) {
    const b = document.createElement("button"); b.className = "botao secundario fi-ts-mais"; b.textContent = `Mostrar todos (${cand.length})`;
    b.onclick = () => { telaQuais.todos = true; ctx.redesenhar(); };
    s3.append(b);
  }
}
const NOME_LISTA = { grandes: "grandes", constancia: "constância" };
function textoSaiu(x) {
  if (!x) return "";
  if (typeof x === "number") return `saiu em ${dataDe(x)}`;
  if (typeof x === "string") return `saiu: ${escapar(x)}`;
  return `saiu${x.em ? ` em ${dataDe(x.em)}` : ""}${x.motivo ? `: ${escapar(x.motivo)}` : ""}`;
}
function cartaoCofre(ctx, f, c, { medido = false, candidato = false } = {}) {
  const st = FX.situacaoFixo(f, c.endereco);
  const d = document.createElement("div"); d.className = `fi-ts-cartao fi-ts-cofre${c.saiu ? " saiu" : ""}`; d.dataset.end = String(c.endereco).toLowerCase();
  const mesApr = mesDoAno(c.apr);
  let aqui = "";
  if (medido && c.aoVivo?.serie?.length) { const t = K.trecho(c.aoVivo, "tudo", K.diaDe(f.agora || Date.now())), e = K.estimativa(t); const m = metricasConta(ctx.p, f, c.aoVivo); aqui = `aqui: <span class="${classe(e?.mes ?? t.retorno)}">${textoCurto(K.comMetricas(e, m), t)}</span>${m ? ` · ${m.venceCdi ? "à frente" : "atrás"} do CDI (${pct(m.cdi, 1)} no período)${m.sharpe != null ? ` · Sharpe ${Number(m.sharpe).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}` : ""}` : ""}`; }
  const sinais = [];
  if (st.fixo) sinais.push(`<i class="fi-ts-selo fixo">📌 fixado</i>`);
  if (st.esperando) sinais.push(`<i class="fi-ts-selo aviso">${st.fixo ? "entra na próxima rodada (a cada 6 h)" : "sai na próxima rodada"}</i>`);
  if (candidato && c.passou != null) sinais.push(`<i class="fi-ts-selo ${c.passou ? "gente" : ""}">${c.passou ? "passou na regra" : "não passou"}</i>`);
  if (c.saiu) sinais.push(`<i class="fi-ts-selo">${textoSaiu(c.saiu)}</i>`);
  for (const l of Array.isArray(c.listas) ? c.listas : []) if (NOME_LISTA[l]) sinais.push(`<i class="fi-ts-selo fi-ts-lista-cofre" data-lista="${escapar(l)}">${NOME_LISTA[l]}</i>`);
  const nums = [`TVL ${usCurto(c.tvl)}`, mesApr != null ? `APR do cofre: ${pct(mesApr, 1)} ao mês` : null, c.idadeDias != null ? `${c.idadeDias} dias` : null, c.comissao != null ? `comissão ${pctSem(c.comissao)}` : null,
    candidato && c.lucroMes != null ? `mês ${pct(c.lucroMes, 1)}` : null, candidato && c.piorQueda != null ? `pior queda ${pctSem(c.piorQueda)}` : null].filter(Boolean);
  d.innerHTML = `<div class="fi-ts-cartao-cab"><b>${escapar(c.nome || String(c.endereco).slice(0, 10) + "…")}</b>${sinais.join("")}</div>
    <small class="fi-ts-cofre-nums">${nums.join(" · ")}</small>
    ${aqui ? `<p class="fi-ts-cofre-aqui">${aqui}</p>` : ""}
    ${c.motivo ? `<p class="fi-ts-frase">${escapar(c.motivo)}</p>` : ""}`;
  if (!c.saiu || st.fixo) {
    const b = document.createElement("button"); b.className = `botao mini secundario fi-ts-fixar${st.fixo ? " fixo" : ""}`; b.dataset.end = d.dataset.end;
    b.textContent = st.fixo ? "Desafixar" : "Fixar";
    b.onclick = () => fixarPelaTela(ctx, b, c.endereco, !st.fixo);
    d.append(b);
  }
  return d;
}
async function fixarPelaTela(ctx, b, endereco, fixar) {
  b.disabled = true; const antes = b.textContent; b.textContent = fixar ? "Fixando…" : "Desafixando…";
  try {
    await FX.fixarCofre(endereco, fixar);
    FX.anotarPedido(endereco, fixar);
    toast(fixar ? "Fixado; entra na próxima rodada (a cada 6 h)." : "Desafixado; sai na próxima rodada (a cada 6 h).", 4000);
    ctx.redesenhar();
  } catch (e) {
    b.disabled = false; b.textContent = antes;
    const msg = e?.message || String(e);
    toast(msg, 9000);
    const card = b.closest(".fi-ts-cofre");
    card?.querySelector(".fi-ts-fixar-erro")?.remove();
    card?.insertAdjacentHTML("beforeend", `<p class="fi-ts-fixar-erro" role="alert">${escapar(msg)}</p>`);
  }
}

// ------------------------------------------------------------------ Observatório (só nos memecoins)
/** As contagens do observatório (`f.observatorio`, FORMATO.md "Memecoins"), quanto cada regra teria dado, os últimos
 *  tokens e, embaixo, a conta da versão escolhida (o mesmo de Como está indo). */
function telaObservatorio(el, ctx, f, s) {
  const o = f.observatorio || {};
  if (!["semana", "tudo"].includes(s.obs)) s.obs = "semana";
  const c = o[s.obs] || {}, n = c.tokens || 0;
  const cab = secao(el, `Observatório ${q("observatorio")}`, o.desde ? `desde ${dataDe(o.desde)} · ${o.amostras || 0} ${o.amostras === 1 ? "amostra" : "amostras"}` : "esperando a 1ª análise", "fi-ts-obs");
  cab.append(seg("Período", [["semana", "Últimos 8 dias"], ["tudo", "Desde o começo"]], s.obs, (x) => { s.obs = x; guardar(); ctx.redesenhar(); }, "fi-ts-obs-per"));
  if (!n) {
    cab.insertAdjacentHTML("beforeend", `<p class="fi-dica">${o.esperando ? `${o.esperando} lançamentos sorteados esperando as 24 h${o.proxima ? ` (a próxima análise sai por volta de ${quando(o.proxima)})` : ""}.` : "Nenhum lançamento analisado ainda."}</p>`);
  } else {
    // os "sem dados" (desde 09/11/2026) ficam fora das outras contas: a % delas é sobre os que se sabe
    const sd = c.semDados || 0, base = Math.max(0, n - sd);
    const fr = (k) => (k === "semDados" ? (n ? sd / n : 0) : base ? (c[k] || 0) / base : 0);
    const barras = [["dobraram", "dobraram", "ts-sobe", "o preço chegou a 2× o do lançamento"], ["dezVezes", "chegaram a 10×", "ts-sobe", ""],
      ["graduaram", "se formaram", "ts-sobe", "a curva encheu e foram para a corretora"], ["golpes", "golpe", "ts-desce", "caíram mais de 90% em minutos"],
      ["morreram", "morreram", "ts-desce", "sem negócios ou valendo menos de 10% em 24 h"], ["rugcheckAlto", "RugCheck alto", "", "risco alto logo depois de lançar"],
      ["criadorGrande", "criador comprou muito", "", "10% ou mais na criação"], ["semDados", `sem dados ${q("semDados")}`, "", "ninguém respondeu sobre eles: ficam fora das outras contas"]];
    cab.insertAdjacentHTML("beforeend", `<p class="fi-ts-obs-total"><b>${n.toLocaleString("pt-BR")}</b> lançamentos sorteados${o.lancamentosPorDia ? ` (de uns ${Number(o.lancamentosPorDia).toLocaleString("pt-BR")} por dia)` : ""}${sd ? `; ${sd.toLocaleString("pt-BR")} sem dados, então as porcentagens são sobre ${base.toLocaleString("pt-BR")}` : ""}</p>
      <ul class="fi-ts-obs-barras">${barras.map(([k, nome, cl, dica]) => `<li data-k="${k}"><span class="nm"><b class="${cl}">${(c[k] || 0).toLocaleString("pt-BR")}</b> ${nome} <small>${pctSem(fr(k))}</small>${dica ? `<em>${dica}</em>` : ""}</span><i style="--w:${Math.round(fr(k) * 1000) / 10}%"></i></li>`).join("")}</ul>
      <p class="fi-dica">${c.medianaX24 != null ? `Dos que tiveram negócios, o típico valia ${pctSem(c.medianaX24)} do preço do lançamento 24 h depois. ` : ""}${c.vivos24h != null ? `${c.vivos24h} de ${n} valiam o mesmo ou mais.` : ""}${o.esperando ? ` Esperando: ${o.esperando}.` : ""}</p>${o.outrasPlataformas ? `<p class="fi-dica fi-ts-obs-outras">${Number(o.outrasPlataformas).toLocaleString("pt-BR")} ${o.outrasPlataformas === 1 ? "lançamento de outra plataforma ficou" : "lançamentos de outras plataformas ficaram"} de fora: a amostra é só da curva do pump.fun ${q("curvaPump")}.</p>` : ""}`);
  }
  const regras = Array.isArray(o.regras) ? o.regras.filter(r => r.apostas) : [];
  if (regras.length) {
    const sr = secao(el, "Quanto cada regra teria dado", "US$ 10 por token, desde o começo", "fi-ts-obs-regras");
    sr.insertAdjacentHTML("beforeend", `<ol class="fi-ts-rank">${regras.sort((a, b) => (b.roi ?? -9) - (a.roi ?? -9)).map((r, i) => `<li data-v="${escapar(r.id)}" role="button" tabindex="0"><span class="pos">${i + 1}º</span><span class="tx"><b>${escapar(r.nome)}${r.id === f.padrao ? ` <i class="fi-ts-selo">padrão</i>` : ""}</b><small><span class="${classe(r.resultado)}">${din(r.resultado || 0, { sinal: true })}</span> em ${r.apostas} ${r.apostas === 1 ? "aposta" : "apostas"} · retorno por aposta <span class="${classe(r.roi)}">${pct(r.roi, 1)}</span>${r.acerto != null ? ` · acerto ${pctSem(r.acerto)}` : ""}${r.emGolpe ? ` · ${pctSem(r.emGolpe / r.apostas)} em golpe` : ""}${r.custoPct != null ? ` · custos ${pctSem(r.custoPct, 1)}` : ""}</small></span></li>`).join("")}</ol>
      <p class="fi-dica">Tocar mostra a conta da regra logo abaixo. O real tende a ser pior: os robôs compram no mesmo segundo do lançamento. ${q("roi")}</p>`);
    sr.querySelectorAll("[data-v]").forEach(li => {
      const ir = () => { s.versao = li.dataset.v; guardar(); ctx.redesenhar(); };
      li.onclick = ir; li.onkeydown = (ev) => { if (ev.key === "Enter") ir(); };
    });
  }
  MM.secoesObservatorio(el, f); // a revisão de 09/11/2026 (testes/memes.js): somem sem os campos novos
  const itens = (Array.isArray(f.itens) ? f.itens : []).filter(i => i && i.mint);
  if (itens.length) {
    const st = secao(el, "Os últimos analisados", `${Math.min(itens.length, 12)} de ${itens.length} · sem os nomes`, "fi-ts-obs-tokens");
    const marca = (i) => (i.semDados ? `<i class="fi-ts-selo">sem dados</i>` : i.golpe ? `<i class="fi-ts-selo aviso">golpe</i>` : i.graduou ? `<i class="fi-ts-selo gente">formou</i>` : i.morreu ? `<i class="fi-ts-selo">morreu</i>` : "");
    st.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${itens.slice(0, 12).map(i => `<li><span><b>${escapar(i.mint)} ${marca(i)}</b><small>${i.lancado ? quando(i.lancado) : ""}${i.rugcheck === "alto" ? " · RugCheck alto" : ""}${i.criadorGrande ? " · criador comprou muito" : ""}</small></span><b>${i.semDados && i.maxX == null ? "—" : vezesBr(i.maxX || 1)}<small> máx. · ${i.semDados ? "ninguém respondeu" : i.x24 == null ? "sem negócios" : `${pctSem(i.x24)} em 24 h`}</small></b></li>`).join("")}</ul>`);
  }
  telaIndo(el, ctx, f, s);
}

// as métricas comuns (09/11/2026), em toda forma
// ------------------------------------------------------------------ Cofres: Mais testes (09/11/2026)
// O teste fora da amostra (`passado` do cofres.json), o cofre × copiar o líder (`lider`) e o porquê das saídas (o
// `motivo` dos eventos). Formato em tools/papel/FORMATO.md do orbita-testes, "Cofres". Sem as chaves (cofres.json
// antigo), cada seção diz que começa nas próximas rodadas.
const nomeVersao = (f, id) => (f.versoes || []).find(v => v.id === id)?.nome || id;
const sharpeTxt = (m) => (m?.sharpe != null ? ` · Sharpe ${Number(m.sharpe).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}` : "");
/** O resultado do teste fora da amostra de uma versão como um trecho (ou null). */
export function foraCofres(f, vid) {
  const r = f?.passado?.resultado, a = r?.contas?.[vid];
  if (!a?.serie?.length) return null;
  const t = K.trechoConta(a, "tudo", null);
  return t ? { ...t, conta: a, de: K.diaDe(r.de), ate: K.diaDe(r.ate), previsto: r.previsto?.[vid] ?? null } : null;
}
/** No Como está indo dos cofres: a linha do fora da amostra da versão escolhida, que leva a Mais testes. */
function linhaForaCofres(el, ctx, f, v, s) {
  const t = foraCofres(f, v.id);
  if (!t) return;
  const p = document.createElement("p"); p.className = "fi-ts-honesto fi-ts-honesto-cofres";
  p.innerHTML = `<i class="fi-ts-aprox">aproximado</i> <span><b>Teste fora da amostra:</b> escolhendo toda segunda desde ${dataCurta(t.de)} sem saber o futuro, ${escapar(v.nome)} teria feito <b class="${classe(t.retorno)}">${pct(t.retorno, 1)}</b> em ${K.diasEntre(t.de, t.ate)} dias${t.previsto != null ? ` (o da escolha dizia ${pct(t.previsto, 1)})` : ""}. ${q("foraAmostraCofres")}</span>`;
  const b = document.createElement("button"); b.className = "fi-ts-ver"; b.textContent = "Ver";
  b.onclick = () => { s.sub = "mais"; guardar(); ctx.redesenhar(); };
  p.append(b);
  el.append(p);
}

function telaMaisCofres(el, ctx, f, s) {
  secaoForaCofres(el, ctx, f, s);
  secaoLider(el, ctx, f);
  secaoMotivos(el, ctx, f);
}

function secaoForaCofres(el, ctx, f, s) {
  const pa = f.passado;
  const sc = secao(el, `Teste fora da amostra ${q("foraAmostraCofres")}`, `<i class="fi-ts-aprox">aproximado</i>`, "fi-ts-fora fi-ts-fora-cofres");
  if (!pa) { sc.insertAdjacentHTML("beforeend", `<p class="fi-dica">Este teste ainda não rodou: começa nas próximas rodadas (a cada 6 h).</p>`); return; }
  const r = pa.resultado, an = pa.andamento;
  const andamento = (a) => `<div class="fi-ts-fora-prog"><i style="--w:${Math.round(Math.min(1, a.detalhados / Math.max(1, a.universo)) * 100)}%"></i></div><p class="fi-dica">Lendo a história de cada cofre: ${a.detalhados.toLocaleString("pt-BR")} de ${a.universo.toLocaleString("pt-BR")} (${a.comDados} com dados que servem). Anda um pouco a cada rodada (a cada 6 h).</p>`;
  if (!r) { sc.insertAdjacentHTML("beforeend", `<p class="fi-dica"><b>Montando o 1º teste.</b></p>${an ? andamento(an) : ""}`); return; }
  const ids = (f.versoes || []).map(v => v.id).filter(id => r.contas?.[id]);
  const vid = ids.includes(s.versao) ? s.versao : ids.includes(f.padrao) ? f.padrao : ids[0];
  const t = vid ? foraCofres(f, vid) : null;
  if (!t) { sc.insertAdjacentHTML("beforeend", `<p class="fi-dica">O teste terminou sem cofres que passassem na regra naquela época.</p>`); return; }
  heroiEstimativa(sc, refsDe(ctx.p), t, { titulo: `Escolhendo toda segunda desde ${dataCurta(t.de)} · ${escapar(nomeVersao(f, vid))}`, ops: SEM_OPS, metricas: t.conta.metricas });
  const fu = r.funil || {};
  sc.insertAdjacentHTML("beforeend", `<p class="fi-dica">De ${dataCurta(t.de)} a ${dataCurta(t.ate)}: ${r.semanas} escolhas, uma por segunda, cada uma só com o que se sabia naquele dia · ${fu.comDados ?? "?"} cofres com dados entre ${(fu.universo || 0).toLocaleString("pt-BR")} olhados da lista inteira${fu.fechados ? ` (${fu.fechados} fecharam no caminho)` : ""}.</p>`);
  if (t.previsto != null) sc.insertAdjacentHTML("beforeend", `<p class="fi-ts-previsto ${t.previsto > t.retorno + 0.02 ? "otimista" : ""}">No mesmo período, o teste no período da escolha (otimista) dizia <b class="${classe(t.previsto)}">${pct(t.previsto, 1)}</b>; fora da amostra deu <b class="${classe(t.retorno)}">${pct(t.retorno, 1)}</b>. ${q("historicoCofres")}</p>`);
  graficoComRefs(sc, refsDe(ctx.p), "Fora da amostra", t.pts);
  // as versões neste teste
  const lista = ids.map(id => ({ id, t: foraCofres(f, id) })).filter(x => x.t).sort((a, b) => b.t.retorno - a.t.retorno);
  sc.insertAdjacentHTML("beforeend", `<h4 class="fi-ts-fora-t">As versões neste teste</h4><ol class="fi-ts-rank fi-ts-fora-versoes">${lista.map((x, i) => `<li data-v="${escapar(x.id)}" role="button" tabindex="0" class="${x.id === vid ? "on" : ""}"><span class="pos">${i + 1}º</span><span class="tx"><b>${escapar(nomeVersao(f, x.id))}</b><small><span class="${classe(x.t.retorno)}">${pct(x.t.retorno, 1)}</span> · pior queda ${pctSem(x.t.queda, 1)}${x.t.conta.metricas?.venceCdi != null ? ` · ${x.t.conta.metricas.venceCdi ? "à frente" : "atrás"} do CDI` : ""}${sharpeTxt(x.t.conta.metricas)}${x.t.previsto != null ? ` · na escolha ${pct(x.t.previsto, 1)}` : ""}</small></span></li>`).join("")}</ol>`);
  sc.querySelectorAll(".fi-ts-fora-versoes [data-v]").forEach(li => {
    const ir = () => { s.versao = li.dataset.v; guardar(); ctx.redesenhar(); };
    li.onclick = ir; li.onkeydown = (ev) => { if (ev.key === "Enter") ir(); };
  });
  const esc = Array.isArray(r.escolhas) ? r.escolhas : [];
  if (esc.length) {
    const de = document.createElement("details"); de.className = "fi-ts-detalhes fi-ts-fora-escolhas";
    de.innerHTML = `<summary>Os 5 melhores de cada segunda <small>${esc.length}</small></summary><ul class="fi-ts-lista">${[...esc].reverse().map(e => `<li><span><b>${dataCurta(e.semana)}</b><small>${(e.top5 || []).map(x => escapar(x.nome)).join(", ") || "nenhum passou"}</small></span><b>${e.passaram ?? ""}<small> passaram</small></b></li>`).join("")}</ul>`;
    sc.append(de);
  }
  const rec = Object.entries(fu.recusas || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const df = document.createElement("details"); df.className = "fi-ts-detalhes";
  df.innerHTML = `<summary>De onde vieram os cofres</summary><ul class="fi-ts-lista"><li><span>Na lista da corretora</span><b>${(fu.lista || 0).toLocaleString("pt-BR")}</b></li><li><span>Olhados (abertos pelo TVL de hoje e fechados)</span><b>${(fu.universo || 0).toLocaleString("pt-BR")}</b></li><li><span>Com dados no período</span><b>${fu.comDados ?? "—"}</b></li><li><span>Usados em alguma escolha dos 5 melhores</span><b>${fu.usados ?? "—"}</b></li></ul>${rec.length ? `<h4>Por que ficaram de fora</h4><ul class="fi-ts-lista">${rec.map(([m, n]) => `<li><span>${escapar(m)}</span><b>${n.toLocaleString("pt-BR")}</b></li>`).join("")}</ul>` : ""}`;
  sc.append(df);
  const rods = Array.isArray(pa.rodadas) ? pa.rodadas : [];
  if (rods.length > 1) sc.insertAdjacentHTML("beforeend", `<h4 class="fi-ts-fora-t">Os testes anteriores (5 melhores)</h4><ul class="fi-ts-lista">${[...rods].reverse().map(x => `<li><span>${dataCurta(K.diaDe(x.de))} a ${dataCurta(K.diaDe(x.ate))}<small>${x.comDados ?? "?"} cofres${x.previsto != null ? ` · na escolha ${pct(x.previsto, 1)}` : ""}</small></span><b class="${classe(x.retorno)}">${x.retorno == null ? "—" : pct(x.retorno, 1)}</b></li>`).join("")}</ul>`);
  if (an) sc.insertAdjacentHTML("beforeend", `<p class="fi-dica"><b>Um teste novo está sendo montado.</b></p>${andamento(an)}`);
  else if (pa.proximo) sc.insertAdjacentHTML("beforeend", `<p class="fi-dica">O próximo começa em ${dataCurta(K.diaDe(pa.proximo))}.</p>`);
  sc.insertAdjacentHTML("beforeend", `<p class="fi-dica">Aproximado: só entram os cofres que ainda estão na lista da corretora (os fechados entram; os apagados, não), os abertos pelo TVL de hoje, a parte do líder é a de hoje (o sinal do líder não entra), não se sabe quando um cofre fechou para depósitos e o histórico antigo tem poucos pontos. Serve de ideia, não de medida exata.</p>`);
}

function secaoLider(el, ctx, f) {
  const L = f.lider;
  const sl = secao(el, `Cofre × copiar o líder ${q("copiarLider")}`, "ao vivo · US$ 1.000 cada", "fi-ts-lider");
  if (!L || !Array.isArray(L.cofres) || !L.cofres.length) { sl.insertAdjacentHTML("beforeend", `<p class="fi-dica">Começa nas próximas rodadas: os 5 melhores cofres de agora, cada um contra a cópia das operações dele.</p>`); return; }
  const T = L.total, refs = refsDe(ctx.p);
  if (T) {
    const tc = K.trechoConta(T.cofre, "tudo", null), tp = K.trechoConta(T.copia, "tudo", null);
    sl.insertAdjacentHTML("beforeend", `<div class="fi-ts-versus fi-ts-lider-versus"><span><small>No cofre (já sem os 10%)</small><b class="${classe(T.cofre.retorno)}">${pct(T.cofre.retorno, 1)}</b><small>${T.cofre.metricas?.venceCdi != null ? `${T.cofre.metricas.venceCdi ? "à frente" : "atrás"} do CDI` : ""}</small></span><span><small>Copiando as operações</small><b class="${classe(T.copia.retorno)}">${pct(T.copia.retorno, 1)}</b><small>${T.copia.metricas?.venceCdi != null ? `${T.copia.metricas.venceCdi ? "à frente" : "atrás"} do CDI` : ""}</small></span></div>
      <p class="fi-ts-frase fi-ts-lider-frase">${T.diferenca > 0.001 ? `Copiar teria rendido <b class="ts-sobe">${pct(T.diferenca, 1)}</b> a mais` : T.diferenca < -0.001 ? `Ficar no cofre rendeu <b class="ts-sobe">${pct(-T.diferenca, 1)}</b> a mais` : "Deu quase igual"} (US$ 1.000 em cada um dos ${T.n}). A cópia ganhou em ${T.copiaGanhou} de ${T.n}.</p>`);
    if (tc && tp) graficoComRefs(sl, refs, "No cofre", tc.pts, [{ nome: "Copiando", cls: "l-normal", pts: tp.pts }]);
  }
  sl.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-lider-lista">${L.cofres.map(l => `<li data-end="${escapar(String(l.endereco || "").toLowerCase())}"><span><b>${escapar(l.nome)}</b><small>desde ${dataDe(l.desde)} · cofre ${pct(l.cofre.retorno, 1)} · cópia ${pct(l.copia.retorno, 1)} · ${l.copia.ops} ${l.copia.ops === 1 ? "operação" : "operações"}${l.copia.extra?.financiamento != null ? ` · financiamento ${din(-l.copia.extra.financiamento, { sinal: true })}` : ""}${l.muitas ? " · muitas operações: as mais antigas podem faltar" : ""}</small></span><b class="${classe(l.diferenca)}">${pct(l.diferenca, 1)}<small> cópia − cofre</small></b></li>`).join("")}</ul>`);
  const sd = Array.isArray(L.saidos) ? L.saidos.filter(x => x?.copia) : [];
  if (sd.length) {
    const d = document.createElement("details"); d.className = "fi-ts-detalhes";
    d.innerHTML = `<summary>Os que saíram dos 5 melhores <small>${sd.length}</small></summary><ul class="fi-ts-lista">${[...sd].reverse().map(x => `<li><span><b>${escapar(x.nome || "")}</b><small>${dataDe(x.desde)} a ${dataDe(x.saiu)}${x.cofre ? ` · cofre ${pct(x.cofre.retorno, 1)}` : ""} · cópia ${pct(x.copia.retorno, 1)}</small></span><b class="${classe(x.diferenca)}">${x.diferenca == null ? "—" : pct(x.diferenca, 1)}</b></li>`).join("")}</ul>`;
    sl.append(d);
  }
  sl.insertAdjacentHTML("beforeend", `<p class="fi-dica">A cópia repete no papel as operações que o líder faz no cofre, ${L.atraso || 1} minuto depois, do tamanho proporcional (${L.alav || 1}×), pagando a taxa da corretora, a diferença de preço e o financiamento, mas sem os 10% de comissão. Só os perpétuos entram (à vista e outros mercados ficam de fora) e as posições que o cofre já tinha antes de começarmos só entram quando ele mexe nelas.</p>`);
}

function secaoMotivos(el, ctx, f) {
  const evs = (Array.isArray(f.eventos) ? f.eventos : []).filter(e => e && e.motivo && (e.tipo === "saiu" || e.tipo === "trocou") && e.versao);
  const s = secao(el, `Por que saímos dos cofres ${q("sinaisSaida")}`, `${evs.length} ${evs.length === 1 ? "saída" : "saídas"} nas versões`, "fi-ts-motivos");
  if (!evs.length) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nenhuma saída com o motivo anotado ainda.</p>`); return; }
  const por = {};
  for (const e of evs) { const x = (por[e.motivo] ||= { n: 0, v: new Set() }); x.n++; x.v.add(e.versao); }
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${Object.entries(por).sort((a, b) => b[1].n - a[1].n).map(([m, x]) => `<li data-motivo="${escapar(m)}"><span><b>${MOTIVO_SAIDA[m] || escapar(m)}</b><small>${[...x.v].map(v => escapar(nomeVersao(f, v))).join(", ")}</small></span><b>${x.n}</b></li>`).join("")}</ul>
    <p class="fi-dica">A versão "5 melhores com sinais" sai também quando o líder fica com menos de 5% do cofre, o TVL cai 30% em 7 dias ou o cofre fecha para depósitos (sempre depois da trava). Cada saída aparece em O que aconteceu com o motivo.</p>`);
}

const TERMOS_COMUNS = ["cdiPeriodo", "excesso", "volatilidade", "sharpe", "retornoPorQueda"];
// os termos de cada forma no Como funciona (o "?" mostra a explicação do GLOSSARIO de comum.js)
const TERMOS = { cofres: ["cofre", "tvl", "comissao", "aproximado", "sinaisSaida", "constancia", "cofresGrandes", "mistura", "historicoCofres", "foraAmostraCofres", "copiarLider"], funding: ["funding", "perpetuo", "base", "entreCorretoras"], robos: RB.TERMOS_ROBOS, apostas: ["odd", "margem", "oddJusta", "valorAposta", "clv", "roi", "apostaGratis", "seguirBDM", "cobertura", "oddCitada"],
  looping: LP.TERMOS_LOOPING, opcoes: OP.TERMOS_OPCOES,
  pools: ["pool", "faixaPool", "perdaImp", "reposicionar", "reinvestir", "gas", "faixaVol", "giro", "gauge", "aero", "medidoBtc"], memes: ["memecoin", "curvaPump", "graduacao", "golpe", "rugcheck", "semDados", "observatorio", ...MM.TERMOS_MEMES],
  previsao: PV.TERMOS_PREVISAO };
