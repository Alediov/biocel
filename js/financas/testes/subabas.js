// Testes de mercado: as 4 abas em linguagem simples (pedido do Alediov, 02/11/2026, 22h27: "difícil de entender…
// leigo em finanças"): Como está indo, Quem copiamos, Jeitos de copiar e O que aconteceu, e a tela Como funciona
// (um botão no alto). `ctx` = { d, redesenhar, abrir(endereco), antes, rodape(el), fecharComo }.
import { E, hojeISO } from "../../estado.js";
import { escapar, toast } from "../../ui.js";
import * as C from "../contas.js";
import * as K from "./calculo.js";
import { sel, guardarSel, comboSel, trechoSel, hojeDe, barra, seg, secao, desenharGrade, graficoComRefs, TEXTO_VERSAO,
  classe, pct, pctSem, us, usInteiro, reais, quando, dataCurta, nomePeriodo, q, textoEstimativa, NOME_SEMAFORO, pctMes,
  graficoMeses, graficoQueda, graficoAlavancagem, graficoProjecao, GLOSSARIO } from "./comum.js";
import { ligarAvisos } from "./avisos.js";

const optsSel = () => ({ modo: sel.modo, periodo: sel.periodo });
export const usarCombo = (k, redesenhar) => { const p = K.partes(k); sel.lev = p.lev; sel.atraso = p.atraso; sel.versao = p.versao; guardarSel(); toast(`Jeito: ${K.nomeJeito(k)}`); redesenhar(); };
const RISCO_COR = { baixo: "ok", médio: "medio", alto: "ruim" };
export const seloRisco = (r) => `<i class="fi-ts-risco ${RISCO_COR[r]}">risco ${r}</i>`;
export function seloRobo(c) {
  const r = c.perfil?.robo;
  if (r) return `<i class="fi-ts-selo ${c.selo === "robo" ? "robo" : c.selo === "humano" ? "gente" : ""}">${escapar(r.rotulo)} · ${r.nota}</i>`;
  return c.selo ? `<i class="fi-ts-selo ${c.selo === "robo" ? "robo" : ""}">${c.selo === "robo" ? "robô provável" : c.selo === "humano" ? "humano provável" : "não dá para dizer"}</i>` : "";
}

/** O número grande com a faixa, o CDI e a poupança no mesmo formato e o semáforo. */
export function heroiEstimativa(el, d, t, { titulo, ops = 0, extra = "", metricas = null }) {
  const e = K.comMetricas(K.estimativa(t), metricas), tx = textoEstimativa(e), cdi = K.cdiTaxas(d), sem = K.semaforo(e, cdi.mes, ops);
  const h = document.createElement("section"); h.className = "fi-heroi fi-ts-heroi";
  h.innerHTML = `<small>${titulo}</small><strong>${tx.grande}${e && !e.cedo ? " <em>(estimado)</em>" : ""} ${q("porMes")}</strong>
    <p class="fi-ts-faixa-l">${tx.linha}</p>
    <div class="fi-heroi-num"><span><small>CDI ${q("cdi")}</small><b>${pct(cdi.mes, 2)} a.m.</b><small>${pct(cdi.ano, 1)} a.a.</small></span>
      <span><small>Poupança ${q("poupanca")}</small><b>${pct(K.POUPANCA_MES, 1)} a.m.</b><small>${pct(K.POUPANCA_ANO, 1)} a.a.</small></span></div>
    <p class="fi-ts-semaforo ${sem}"><i></i>${NOME_SEMAFORO[sem]}</p>${extra}`;
  el.append(h);
  return e;
}

/** "Contra o CDI e o risco": as métricas comuns de toda conta (`conta.metricas` do orbita-testes, desde 09/11/2026; sem
 *  elas, as calculadas pelo app em K.calcularMetricas). Os números que ainda não existem dizem com quantos dias saem. */
export function secaoMetricas(el, m, { moeda = "US$" } = {}) {
  if (!m) return null;
  const n2 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const falta = (min) => `com ${min} dias${m.dias != null ? ` (tem ${m.dias})` : ""}`;
  const sharpeTx = m.sharpe == null ? falta(K.MIN_DIAS_SHARPE) : m.sharpe < 0 ? "o CDI rendeu mais sem risco" : m.sharpe < 1 ? "pouco pelo risco que corre" : m.sharpe < 2 ? "bom pelo risco" : "muito bom pelo risco";
  const volTx = m.volAno == null ? "—" : m.volAno < 0.1 ? "calma, como renda fixa" : m.volAno < 0.4 ? "balança um pouco" : m.volAno < 0.8 ? "balança bastante" : "montanha-russa";
  const it = [
    `<span><small>CDI no mesmo período ${q("cdiPeriodo")}</small><b>${pct(m.cdi, 2)}</b><small>a conta: <span class="${classe(m.retorno)}">${pct(m.retorno, 2)}</span></small></span>`,
    `<span class="${m.venceCdi === false ? "fi-ts-ruim" : ""}"><small>Acima do CDI ${q("excesso")}</small><b class="${classe(m.excesso)}">${pct(m.excesso, 2)}</b><small>${m.venceCdi ? "está ganhando do CDI" : "o CDI rendeu mais"}</small></span>`,
    `<span><small>Ao ano ${q("porMes")}</small><b class="${m.aoAno == null ? "" : classe(m.aoAno)}">${m.aoAno == null ? "—" : pct(m.aoAno, 1)}</b><small>${m.aoAno == null ? falta(K.MIN_DIAS_ANO) : m.aoMes != null ? `${pctMes(m.aoMes)} ao mês` : "no ritmo de agora"}</small></span>`,
    `<span><small>Volatilidade ${q("volatilidade")}</small><b>${m.volAno == null ? "—" : `${pctSem(m.volAno, 1)} a.a.`}</b><small>${volTx}</small></span>`,
    `<span><small>Sharpe ${q("sharpe")}</small><b class="${m.sharpe == null ? "" : classe(m.sharpe)}">${m.sharpe == null ? "—" : n2(m.sharpe)}</b><small>${sharpeTx}</small></span>`,
    `<span><small>Retorno ÷ pior queda ${q("retornoPorQueda")}</small><b>${m.retornoPorQueda == null ? "—" : `${n2(m.retornoPorQueda)}×`}</b><small>${m.retornoPorQueda == null ? falta(K.MIN_DIAS_ANO) + " e queda ≥ 0,5%" : "ganho ao ano por queda"}</small></span>`,
    `<span><small>Pior dia ${q("piorDia")}</small><b class="${m.piorDia < 0 ? "ts-desce" : ""}">${m.piorDia == null ? "—" : pct(m.piorDia, 2)}</b><small>de um dia para o outro</small></span>`,
    `<span><small>Dias positivos ${q("diasPositivos")}</small><b>${m.diasPositivos == null ? "—" : pctSem(m.diasPositivos)}</b><small>dos dias medidos</small></span>`,
  ];
  const s = secao(el, "Contra o CDI e o risco", `desde o início · ${m.dias} ${m.dias === 1 ? "dia" : "dias"}`, "fi-ts-metricas");
  s.insertAdjacentHTML("beforeend", `<div class="fi-tiles fi-ts-tiles">${it.join("")}</div>${m.calculado ? `<p class="fi-dica">Calculado no app (os dados desta conta ainda não trazem as métricas prontas).</p>` : ""}${moeda === "R$" ? `<p class="fi-dica">Em R$ de mentira: as porcentagens valem igual.</p>` : ""}`);
  return s;
}

/** "Em reais com a sua verba": a verba de testes do Rendimento aplicada numa curva ao vivo. Uma linha. */
export function linhaVerba(pts) {
  const f = E().financas;
  if (!f) return `<p class="fi-dica fi-ts-verba">Em reais: abra as Finanças uma vez para ter a verba de testes.</p>`;
  const pctV = C.testesPct(f), itens = C.rendimentos(f).itens || [], v = K.verba(itens, pctV, pts);
  if (!pctV) return `<p class="fi-dica fi-ts-verba">Em reais: a verba de testes está em 0% (aba Rendimento).</p>`;
  if (!v) return `<p class="fi-dica fi-ts-verba">Em reais: ainda não há rendimento medido no Ping-Pong, então não há verba de testes para aplicar.</p>`;
  const cot = C.cotacao(f, hojeISO());
  return `<p class="fi-dica fi-ts-verba">Em reais: com ${pctV}% do rendimento (${reais(v.aplicado)} desde ${dataCurta(v.desde)}, ~${reais(v.porMes)} por mês), você teria <b>${reais(v.teria)}</b> (≈ ${us(v.teria / cot.usd)}).</p>`;
}
/** A projeção de 1 ano: gráfico em US$ e a linha em reais com a verba de testes por mês. */
export function secaoProjecao(el, est, titulo = "Se continuar assim, em 1 ano") {
  const s = secao(el, titulo, "de US$ 1.000", "fi-ts-sec-proj");
  const pr = K.projecao(est);
  s.append(graficoProjecao(pr));
  if (!pr) return;
  const fim = pr.at(-1);
  s.insertAdjacentHTML("beforeend", `<p class="fi-dica">US$ 1.000 virariam <b>${usInteiro(fim.meio)}</b> (entre ${usInteiro(fim.pes)} e ${usInteiro(fim.oti)}). ${est.extrapola ? "Com tão poucos dias, é só uma extrapolação." : "Não é promessa: o ritmo muda."}</p>`);
  const f = E().financas;
  const rd = f ? C.rendimento(f, hojeISO()) : null, pctV = f ? C.testesPct(f) : 0;
  const m = rd?.porMes != null ? rd.porMes * pctV / 100 : null;
  s.insertAdjacentHTML("beforeend", m > 0
    ? `<p class="fi-dica">Em reais: pondo a verba de testes (~${reais(m)} por mês), em 1 ano você teria ${reais(K.aplicarMensal(m, est.mes))} (entre ${reais(K.aplicarMensal(m, est.faixaMes[0]))} e ${reais(K.aplicarMensal(m, est.faixaMes[1]))}).</p>`
    : `<p class="fi-dica">Em reais: sem rendimento medido ainda, não há verba de testes para projetar.</p>`);
}

/** O número grande do copy trading numa combinação (o mesmo de Como está indo: a carteira de carteiras, a estimativa,
 *  o CDI e o semáforo), com o risco do ranking dos jeitos. Usado no Placar e no Início. */
export function resumoCopia(d, k = "3x1", opts = { modo: "vivo", periodo: "tudo" }) {
  const cc = d?.carteiras?.length ? K.carteiraNaCombinacao(d, k, opts) : null;
  if (!cc) return null;
  const e = K.estimativa(cc), cdi = K.cdiTaxas(d);
  const alav = K.mediana((d.carteiras || []).map(x => K.alavDaCopia(x, k))) || 1;
  const cdiPeriodo = K.retornoRef(d.referencias?.cdi, cc.de, cc.pts.at(-1)?.[0]);
  return { cc, e, cdi, k, sem: K.semaforo(e, cdi.mes, cc.ops || 0), risco: K.nivelRisco({ queda: cc.queda, nLiq: cc.nLiq, alav }), frente: cdiPeriodo != null && cc.retorno > cdiPeriodo };
}

// ------------------------------------------------------------------ Como está indo
export function telaIndo(el, ctx) {
  const { d, redesenhar } = ctx;
  barra(el, d, redesenhar);
  const k = comboSel(d), cc = K.carteiraNaCombinacao(d, k, optsSel());
  const teto = K.carteiraDeCarteiras(d, optsSel()), et = teto && K.estimativa(teto);
  const extra = et ? `<p class="fi-ts-teto">Cada uma no jeito que funcionou melhor para ela: ${et.cedo ? pct(et.periodo) + " no período" : pctMes(et.mes) + " ao mês"} ${q("teto")}</p>` : "";
  const e = heroiEstimativa(el, d, cc, { titulo: `Se você tivesse copiado todas · ${K.nomeJeito(k)} ${q("cc")}`, ops: cc?.ops || 0, extra });
  linhaForaDaAmostra(el, ctx);
  if (!cc) return ctx.rodape(el);
  const s1 = secao(el, "A carteira de carteiras", `${cc.n} ${cc.n === 1 ? "carteira" : "carteiras"} · ${nomePeriodo()}`, "fi-ts-cc");
  graficoComRefs(s1, d, "Todas copiadas", cc.pts);
  const s2 = secao(el, "% de cada mês");
  s2.append(graficoMeses(K.porMes(cc.pts)));
  const s3 = secao(el, `Queda do topo ${q("queda")}`, `pior: ${pct(-cc.queda, 1)}`);
  s3.insertAdjacentHTML("beforeend", `<p class="fi-dica">Quanto a conta estava abaixo do melhor momento.</p>`);
  s3.append(graficoQueda(K.quedaSerie(cc.pts)));
  if (e && !e.cedo) secaoProjecao(el, e);
  if (sel.modo === "vivo") { const tudo = K.carteiraNaCombinacao(d, k, { modo: "vivo", periodo: "tudo" }); if (tudo) el.querySelector(".fi-ts-cc")?.insertAdjacentHTML("beforeend", linhaVerba(tudo.pts)); }
  novidades(el, ctx, k);
  ctx.rodape(el);
}
function novidades(el, ctx, k) {
  const { d } = ctx, s = secao(el, "Novidades", "desde a última visita", "fi-ts-novidades"), nv = K.novidades(d, ctx.antes, k);
  if (!nv) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">As novidades aparecem a partir da próxima visita.</p>`); return; }
  if (!nv.ops && !nv.entraram.length && !nv.sairam.length) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nada novo desde ${quando(nv.desde)}.</p>`); return; }
  const frases = [];
  if (nv.ops) frases.push(`As cópias fizeram ${nv.ops} ${nv.ops === 1 ? "operação" : "operações"}.`);
  for (const o of nv.liq.slice(0, 3)) frases.push(`<span class="ruim">A cópia de ${escapar(o.curto)} foi liquidada em ${escapar(o.moeda)}${o.res ? `, perdeu ${us(-o.res)}` : ""}.</span> ${q("liquidacao")}`);
  if (nv.liq.length > 3) frases.push(`E mais ${nv.liq.length - 3} liquidações.`);
  for (const c of nv.entraram) frases.push(`A carteira ${escapar(c.curto)} entrou${c.motivos?.[0] ? `: ${escapar(c.motivos[0].toLowerCase())}` : ""}.`);
  for (const x of nv.sairam) frases.push(`A carteira ${escapar(x.curto)} saiu: ${escapar(x.motivo)}.`);
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-nov">${frases.map(f => `<li>${f}</li>`).join("")}</ul>`);
}

// ------------------------------------------------------------------ Quem copiamos
export function telaQuem(el, ctx) {
  const { d, redesenhar } = ctx;
  barra(el, d, redesenhar);
  const f = document.createElement("div"); f.className = "fi-ts-filtros";
  f.append(seg("Ordenar", [["retorno", "Mais rende"], ["queda", "Menos cai"], ["ajustado", "Equilíbrio"]], sel.ordem, v => { sel.ordem = v; guardarSel(); redesenhar(); }, "fi-ts-ordem"));
  f.insertAdjacentHTML("beforeend", `<div class="fi-ts-sels"><select data-f="papel" aria-label="Robô ou pessoa"><option value="">Robô e pessoa</option><option value="robo">Robô</option><option value="humano">Pessoa</option><option value="incerto">Não dá para dizer</option></select>
    <select data-f="alerta" aria-label="Alertas"><option value="">Com e sem alerta</option><option value="com">Com alerta</option><option value="sem">Sem alerta</option></select></div>`);
  f.querySelectorAll("select").forEach(s => { s.value = sel[s.dataset.f] || ""; s.onchange = () => { sel[s.dataset.f] = s.value; guardarSel(); redesenhar(); }; });
  el.append(f);
  const k = comboSel(d);
  let lista = d.carteiras.filter(c => (!sel.papel || (c.selo || "incerto") === sel.papel) && (!sel.alerta || (sel.alerta === "com") === !!c.alertas?.length))
    .map(c => { const t = trechoSel(d, c, k); return { c, t, e: K.estimativa(t), m: K.rankingJeitos(d, optsSel(), c)[0] }; });
  const val = { retorno: x => x.e?.mes ?? x.t?.retorno ?? -9, queda: x => (x.t ? -x.t.queda : -9), ajustado: x => K.razao(x.t) ?? -99 }[sel.ordem] || (x => x.t?.retorno ?? -9);
  lista = lista.sort((a, b) => val(b) - val(a));
  const s = secao(el, "Quem copiamos", `${lista.length} de ${d.carteiras.length}`);
  if (!lista.length) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nenhuma carteira com esses filtros.</p>`);
  lista.forEach(({ c, t, e, m }) => {
    const b = document.createElement("div"); b.className = "fi-ts-cartao"; b.setAttribute("role", "button"); b.tabIndex = 0; b.dataset.end = c.endereco;
    const risco = t ? K.nivelRisco({ queda: t.queda, nLiq: t.nLiq, alav: K.alavDaCopia(c, k) }) : null;
    const frase = (c.perfil?.frase || "").replace(/^[^:]+:\s*/, "");
    b.innerHTML = `<div class="fi-ts-cartao-cab"><b>${escapar(c.curto)}</b>${seloRobo(c)}</div>
      ${frase ? `<p class="fi-ts-frase">${escapar(frase[0].toUpperCase() + frase.slice(1))}</p>` : ""}
      <div class="fi-ts-cartao-num"><span class="${classe(e?.mes ?? t?.retorno)}">${e && !e.cedo ? `${pctMes(e.mes)} ao mês` : t ? `${pct(t.retorno)} no período` : "—"}</span>${risco ? seloRisco(risco) : ""}${c.alertas?.length ? `<i class="fi-ts-selo alerta">⚠ ${c.alertas.length === 1 ? "1 alerta" : `${c.alertas.length} alertas`}</i>` : ""}</div>
      ${m ? `<small class="fi-ts-melhorpra">Funcionou melhor para ela: <b>${K.nomeJeito(m.k)}</b></small>` : ""}`;
    b.onclick = () => ctx.abrir(c.endereco);
    b.onkeydown = (ev) => { if (ev.key === "Enter") ctx.abrir(c.endereco); };
    s.append(b);
  });
}

// ------------------------------------------------------------------ Jeitos de copiar
export function telaJeitos(el, ctx) {
  const { d, redesenhar } = ctx;
  barra(el, d, redesenhar, { combo: false });
  const rk = K.rankingJeitos(d, optsSel());
  const s = secao(el, "Do melhor para o pior", `todas as carteiras · ${nomePeriodo()}`, "fi-ts-jeitos");
  if (!rk.length) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Sem dados ainda.</p>`);
  s.insertAdjacentHTML("beforeend", `<ol class="fi-ts-rank">${rk.slice(0, 10).map((x, i) => `<li data-k="${x.k}" role="button" tabindex="0" class="${x.k === comboSel(d) ? "on" : ""}"><span class="pos">${i + 1}º</span><span class="tx"><b>${K.nomeJeito(x.k)}</b><small>${x.est && !x.est.cedo ? `${pctMes(x.est.mes)} ao mês` : `${pct(x.t.retorno)} no período`} · ${seloRisco(x.risco)}</small></span></li>`).join("")}</ol>
    <p class="fi-dica">Tocar escolhe o jeito para as outras abas. ${q("proporcional")} ${q("dobro")} ${q("fixa")} ${q("saidas")} ${q("moedasBoas")} ${q("parar")}</p>`);
  s.querySelectorAll("[data-k]").forEach(li => (li.onclick = () => usarCombo(li.dataset.k, redesenhar)));
  const sa = secao(el, `Alavancagem × resultado ${q("alavancagem")}`, `proporcional · ${sel.atraso} min`);
  sa.append(graficoAlavancagem(K.porAlavancagem(d, { ...optsSel(), atraso: sel.atraso })));
  const cs = K.consistencia(d, { ...optsSel(), atraso: sel.atraso });
  el.insertAdjacentHTML("beforeend", `<p class="fi-ts-consist ${cs.hist && cs.vivo && !cs.iguais ? "sorte" : ""}">${!cs.hist || !cs.vivo ? "Ainda não dá para comparar o período da escolha com o ao vivo." : cs.iguais ? `O melhor jeito foi o mesmo no período da escolha e ao vivo (${K.nomeJeito(cs.vivo)}): bom sinal.` : `No período da escolha (otimista) o melhor foi ${K.nomeJeito(cs.hist)}; ao vivo, ${K.nomeJeito(cs.vivo)}. Pode ter sido sorte.`} ${q("historico")}</p>`);
  const det = document.createElement("details"); det.className = "fi-ts-detalhes";
  det.innerHTML = `<summary>Ver detalhes (a grade)</summary>`;
  det.open = !!telaJeitos.aberto;
  det.ontoggle = () => { telaJeitos.aberto = det.open; };
  const f = document.createElement("div"); f.className = "fi-ts-filtros fi-ts-filtros2";
  f.append(seg("Atraso", K.atrasosDe(d).map(v => [v, `${v} min`]), sel.atraso, v => { sel.atraso = +v; guardarSel(); redesenhar(); }, "fi-ts-atr"));
  f.insertAdjacentHTML("beforeend", `<select class="fi-ts-visao" aria-label="Visão"><option value="">Todas (mediana)</option>${d.carteiras.map(c => `<option value="${c.endereco}">${escapar(c.curto)}</option>`).join("")}</select>`);
  const sv = f.querySelector("select");
  if (sel.visao && !d.carteiras.some(c => c.endereco === sel.visao)) sel.visao = "";
  sv.value = sel.visao; sv.onchange = () => { sel.visao = sv.value; guardarSel(); redesenhar(); };
  det.append(f);
  secaoGrade(det, d, d.carteiras.find(x => x.endereco === sel.visao) || null, redesenhar);
  el.append(det);
}
/** A grade (de uma carteira ou de todas), a melhor célula e o critério. */
export function secaoGrade(el, d, c, redesenhar) {
  const opts = { ...optsSel(), atraso: sel.atraso, c };
  const g = K.grade(d, opts);
  const s = secao(el, c ? "Grade desta carteira" : "Grade", `% ao mês · ${sel.modo === "hist" ? "na escolha (otimista)" : "ao vivo"} · ${sel.atraso} min`, "fi-ts-sec-grade");
  desenharGrade(s, g, k => usarCombo(k, redesenhar), comboSel(d));
  const mc = g.melhor && g.celulas[g.melhor];
  s.insertAdjacentHTML("beforeend", `${mc ? `<p class="fi-ts-melhorcel"><b>Melhor: ${K.nomeJeito(g.melhor)}</b> · ${pct(mc.retorno)} · queda ${pctSem(mc.queda, 1)}</p>` : `<p class="fi-dica">Nenhuma célula com ${K.MIN_OPS}+ operações ainda.</p>`}
    <p class="fi-dica">Melhor = retorno ÷ pior queda (queda mín. ${pctSem(K.PISO_QUEDA)}, ${K.MIN_OPS}+ operações). ${q("queda")}</p>`);
  if (c) {
    const cs = K.consistencia(d, opts);
    s.insertAdjacentHTML("beforeend", `<p class="fi-ts-consist ${cs.hist && cs.vivo && !cs.iguais ? "sorte" : ""}">${!cs.hist || !cs.vivo ? "Ainda não dá para comparar o período da escolha com o ao vivo." : cs.iguais ? "O melhor jeito foi o mesmo no período da escolha e ao vivo." : `Na escolha (otimista): ${K.nomeJeito(cs.hist)}. Ao vivo: ${K.nomeJeito(cs.vivo)}. Pode ter sido sorte.`}</p>`);
  }
}

// ------------------------------------------------------------------ O que aconteceu
export function telaAconteceu(el, ctx) {
  const { d, redesenhar } = ctx;
  funil(el, d);
  barra(el, d, redesenhar, { periodo: false, modo: false });
  const k = comboSel(d), todas = K.feed(d, k);
  const moedas = [...new Set(todas.map(o => o.moeda))].sort();
  if (sel.fMoeda && !moedas.includes(sel.fMoeda)) sel.fMoeda = "";
  if (sel.fCarteira && !d.carteiras.some(c => c.endereco === sel.fCarteira) && !(d.encerradas || []).some(e => e.endereco === sel.fCarteira)) sel.fCarteira = "";
  const f = document.createElement("div"); f.className = "fi-ts-sels fi-ts-sels3";
  f.innerHTML = `<select data-f="fMoeda" aria-label="Moeda"><option value="">Moedas</option>${moedas.map(m => `<option>${escapar(m)}</option>`).join("")}</select>
    <select data-f="fCarteira" aria-label="Carteira"><option value="">Carteiras</option>${d.carteiras.map(c => `<option value="${c.endereco}">${escapar(c.curto)}</option>`).join("")}</select>
    <select data-f="fTipo" aria-label="Tipo"><option value="">Tudo</option><option value="abertura">Compras e vendas</option><option value="fechamento">Fechamentos</option><option value="liquidacao">Liquidações</option><option value="saida">Saídas e paradas</option><option value="carteiras">Carteiras que entraram ou saíram</option></select>`;
  f.querySelectorAll("select").forEach(s => { s.value = sel[s.dataset.f] || ""; s.onchange = () => { sel[s.dataset.f] = s.value; guardarSel(); redesenhar(); }; });
  el.append(f);
  const lista = K.linhaDoTempo(d, k, { moeda: sel.fMoeda, carteira: sel.fCarteira, tipo: sel.fTipo });
  const s = secao(el, "Linha do tempo", `${Math.min(lista.length, 60)} de ${lista.length}`, "fi-ts-tempo");
  s.insertAdjacentHTML("beforeend", lista.length ? `<ul class="fi-ts-linha-tempo">${lista.slice(0, 60).map(itemTempo).join("")}</ul>` : `<p class="fi-dica">Nada com esses filtros.</p>`);
}
const CLS_TEMPO = { liquidada: "ruim", tempo: "aviso", stop: "aviso", parou: "aviso", entrou: "entra", saiu: "sai" };
export function itemTempo(x) {
  const valor = x.res ? ` <b class="${classe(x.res)}">${x.res > 0 ? "ganhou" : "perdeu"} ${us(Math.abs(x.res))}</b>` : x.retorno != null ? ` <b class="${classe(x.retorno)}">rendeu ${pct(x.retorno)}</b>` : "";
  return `<li class="${CLS_TEMPO[x.tipo] || ""}" data-tipo="${x.tipo}"><span class="fi-ts-pt"></span><span class="tx">${escapar(x.frase)}${x.tipo !== "entrou" && x.tipo !== "saiu" && x.curto ? ` <small>(carteira ${escapar(x.curto)})</small>` : ""}${valor}${x.tipo === "liquidada" ? ` ${q("liquidacao")}` : ""}${x.porque ? `<small>porque ${escapar(x.porque.charAt(0).toLowerCase() + x.porque.slice(1))}</small>` : ""}<small>${quando(x.em)}</small></span></li>`;
}
function funil(el, d) {
  const fu = d.funil, qn = d.quarentena;
  const det = document.createElement("details"); det.className = "fi-ts-detalhes fi-ts-funil";
  det.open = !!funil.aberto;
  det.ontoggle = () => { funil.aberto = det.open; };
  det.innerHTML = `<summary>Como escolhemos as carteiras <small>${fu?.semana != null ? `${fu.semana} analisadas em 7 dias` : ""}</small></summary>`;
  if (!fu) { det.insertAdjacentHTML("beforeend", `<p class="fi-dica">A primeira escolha ainda não rodou.</p>`); el.append(det); return; }
  const passos = [["No ranking", fu.ranking], ["Passaram no 1º filtro", fu.preFiltro], ["Analisadas", fu.analisadas], ["Aprovadas", fu.aprovadas], ["Seguidas", fu.seguidas]].filter(x => x[1] != null);
  const mx = Math.max(...passos.map(x => x[1]), 1);
  det.insertAdjacentHTML("beforeend", passos.map(([n, v]) => `<div class="fi-ts-funil-l"><span>${n}</span><i style="--w:${Math.max(3, Math.round((100 * Math.log10(1 + v)) / Math.log10(1 + mx)))}%"></i><b>${v.toLocaleString("pt-BR")}</b></div>`).join("")
    + `<p class="fi-dica"><b>${(fu.semana ?? 0).toLocaleString("pt-BR")} analisadas nos últimos 7 dias</b> · última escolha ${dataCurta(K.diaDe(fu.em || d.agora))} · próxima ${dataCurta(K.diaDe(d.proximaEscolha))}</p>`);
  const rec = Object.entries(fu.recusas || {}).sort((a, b) => b[1] - a[1]);
  if (rec.length) det.insertAdjacentHTML("beforeend", `<h4>Por que recusamos</h4><ul class="fi-ts-lista">${rec.slice(0, 8).map(([m, n]) => `<li><span>${escapar(m)}</span><b>${n.toLocaleString("pt-BR")}</b></li>`).join("")}</ul>`);
  det.insertAdjacentHTML("beforeend", `<h4>Em quarentena ${q("quarentena")} <small>${qn?.n ?? 0}</small></h4>${qn?.lista?.length ? `<ul class="fi-ts-lista">${qn.lista.slice(0, 10).map(x => `<li><span><b>${escapar(x.curto)}</b><small>${escapar(x.motivo)}</small></span><small>até ${dataCurta(K.diaDe(x.ate))}</small></li>`).join("")}</ul>${qn.n > 10 ? `<p class="fi-dica">E mais ${qn.n - 10}.</p>` : ""}` : `<p class="fi-dica">Nenhuma.</p>`}`);
  el.append(det);
}

// ------------------------------------------------------------------ Como funciona (botão no alto)
export function telaComo(el, ctx) {
  const { d } = ctx, cfg = d.config || {};
  const cab = document.createElement("div"); cab.className = "fi-cab";
  cab.innerHTML = `<button class="fi-voltar"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Testes</span></button><h2>Como funciona</h2>`;
  cab.querySelector(".fi-voltar").onclick = ctx.fecharComo;
  el.append(cab);
  const sa = secao(el, "Avisos", "", "fi-ts-avisos");
  sa.insertAdjacentHTML("beforeend", `<label class="fi-ts-interruptor"><input type="checkbox" ${sel.avisos ? "checked" : ""}><span><b>Avisar no celular</b><small>Quando a cópia (${K.nomeJeito(comboSel(d))}) for liquidada e quando uma carteira entrar ou sair.</small></span></label>`);
  sa.querySelector("input").onchange = (ev) => { ligarAvisos(ev.target.checked, d); toast(ev.target.checked ? "Avisos dos testes ligados" : "Avisos dos testes desligados"); };
  const s1 = secao(el, "Em poucas palavras");
  s1.insertAdjacentHTML("beforeend", `<p class="fi-dica">Seguimos carteiras públicas de quem opera criptomoedas na Hyperliquid e, a cada compra ou venda delas, uma conta de mentira de ${usInteiro(cfg.capital || 1000)} faz o mesmo, ${(cfg.atrasos || [1, 5]).join(" ou ")} minutos depois. Nada é dinheiro de verdade: é para ver se copiar daria certo antes de pensar nisso.</p>
    ${cfg.combos ? `<p class="fi-dica">Desde 09/11/2026 cada carteira tem ${K.combos(d).length} jeitos de copiar, todos com 1 minuto de atraso; só a Proporcional 3× tem também uma conta com 5 minutos, de controle ${q("controle")}. O 10× saiu: quebrava quase sempre.</p>` : ""}
    <p class="fi-dica">O <b>% ao mês estimado</b> estica o resultado dos dias medidos para um mês: (1 + resultado)^(30 ÷ dias) − 1; ao ano, com 365. A <b>faixa</b> vem da variação de um dia para o outro (média ± 1,28 × desvio ÷ √dias, os percentis 10 e 90). Com menos de 7 dias mostramos só o resultado do período; com menos de 30, é extrapolação.</p>`);
  const s2 = secao(el, "Os jeitos de copiar");
  s2.insertAdjacentHTML("beforeend", `<ul class="fi-ts-como">
      <li><b>Proporcional</b>: põe a mesma parte do dinheiro que a carteira pôs; a alavancagem escolhida (${K.levsDe(d, "").join("×, ")}×) só limita.</li>
      <li><b>Dobro e Triplo</b>: 2 ou 3 vezes essa parte, até a alavancagem (${K.levsDe(d, "a2").join("× e ")}×; com 3× o triplo bateria no limite quase sempre).</li>
      <li><b>Fixa US$ ${cfg.margemFixa || 50}</b>: cada aposta nova usa US$ ${cfg.margemFixa || 50} de garantia × a alavancagem (${K.levsDe(d, "f").join("×, ")}×); reduz e fecha junto com ela; sem dinheiro livre, não entra.</li>
      <li><b>Com saídas</b>: fecha a aposta aberta há mais de ${cfg.saidas?.dias || 3} dias ou que perder ${pctSem(cfg.saidas?.stop || 0.05)} da conta.</li>
      <li><b>Com ordem limite</b>: o melhor caso de copiar com ordem limite onde ela usou (taxa de 0,015% e sem diferença de preço).</li>
      <li><b>Só moedas boas</b>: só as moedas em que ela ganhou (${cfg.minOpsMoeda || 3}+ operações) antes de começarmos.</li>
      ${K.versoesDe(d).some(([v]) => v.startsWith("p")) ? `<li><b>Para ao cair 20, 25 ou 30%</b>: copia como a proporcional, mas larga a carteira (fecha tudo e não copia mais) quando a cópia cai isso abaixo do seu melhor momento; conferido de hora em hora.</li>` : ""}
    </ul>
    <p class="fi-dica">Cada jeito tem a taxa de 0,045%, a diferença de preço, o financiamento de hora em hora e a liquidação de verdade da corretora. Bitcoin é comprar e segurar; CDI ${d.referencias?.cdiFonte === "bcb" ? "pela série do Banco Central" : `a ${pctSem(K.cdiTaxas(d).ano, 1)} ao ano`}; poupança ≈ 0,6% ao mês (0,5% + TR, estimativa fixa).</p>`);
  const s3 = secao(el, "Robô ou pessoa e o imitador");
  s3.insertAdjacentHTML("beforeend", `<p class="fi-dica">O palpite soma seis sinais pelas operações dos 30 dias: se ela para algumas horas por dia (dorme), se repete o mesmo tamanho, se entra em minutos fixos ou em intervalos regulares, se põe ordens em grade, se usa preços redondos (gente digita 62.300) e se manda ordens a menos de 3 s uma da outra. A nota vai de 0 (pessoa) a 100 (robô): 80+ quase certo, 62+ provável, 38 a 62 não dá para dizer.</p>
    <p class="fi-dica">Nos robôs, o <b>imitador</b> procura a regra mais simples (o preço andou X% em Y minutos antes de ela entrar, a favor ou contra) nos primeiros 20 dias e confere nos 10 últimos, que ele não viu. Se acertar pouco, a tela diz que não deu para descobrir.</p>`);
  const s3b = secao(el, "Os testes a mais");
  s3b.insertAdjacentHTML("beforeend", `<p class="fi-dica"><b>Teste fora da amostra</b> (aproximado): o teste no período da escolha de cada carteira usa os mesmos 30 dias em que ela foi escolhida por ter ido bem, então é otimista. O fora da amostra aplica a mesma regra de escolha aos dados de 60 a 30 dias atrás e copia as escolhidas nos 30 dias seguintes, que a regra não viu. O ranking público só mostra o agora; por isso o ranking daquela época é refeito pelo histórico de cada carteira (o valor da conta e o lucro desde o começo, o volume pelas operações), numa amostra sorteada de até 3.000 do ranking de hoje. Limites: quem sumiu do ranking não entra (otimista), o histórico desde o começo é espaçado (o ponto mais perto, até 5 dias), a corretora só guarda as 10.000 operações mais recentes de cada carteira e a escolha usa velas de 1 h. Refeito a cada 7 dias, aos poucos.</p>
    <p class="fi-dica"><b>As 5 melhores</b>, <b>Só robôs</b> e <b>Só pessoas</b>: carteiras de carteiras que trocam toda semana, em partes iguais, pagando 0,15% de cada dólar que sai ou entra; nasceram com a história desde o começo do teste (menos as carteiras que saíram antes de 09/11/2026). O <b>Consenso</b> só entra numa moeda com 2 ou mais carteiras do mesmo lado, com 30% da conta por moeda a 3×.</p>`);
  const s4 = secao(el, "Como escolhemos");
  s4.insertAdjacentHTML("beforeend", `<p class="fi-dica">Toda semana o ranking público passa por filtros (conta, lucro, quanto ela movimenta, operações por dia, tempo das apostas, só perpétuos, risco). Até ${cfg.analisar || 80} novas por vez; recusadas ficam 7 dias de fora; quem entra fica pelo menos 4 semanas. O melhor jeito de cada carteira é o de maior retorno ÷ pior queda (queda mín. ${pctSem(K.PISO_QUEDA)}, ${K.MIN_OPS}+ operações).</p>`);
  const s5 = secao(el, "Glossário");
  s5.insertAdjacentHTML("beforeend", `<dl class="fi-ts-gloss">${GLOSS_ORDEM().map(([t, x]) => `<dt>${t}</dt><dd>${x}</dd>`).join("")}</dl>`);
  ctx.rodape(el);
}
const GLOSS_ORDEM = () => ["alavancagem", "liquidacao", "queda", "cdi", "poupanca", "atraso", "limite", "financiamento", "porMes", "faixa", "cc", "risco", "robo", "imitador", "historico", "foraAmostra", "parar", "top5", "consenso", "roboPessoa", "troca", "controle"].map(k => GLOSSARIO[k]);

// ------------------------------------------------------------------ Mais testes (09/11/2026)
/** No Como está indo: uma linha com o teste fora da amostra (quando há), que leva a Mais testes. */
function linhaForaDaAmostra(el, ctx) {
  const t = K.foraNaCombinacao(ctx.d, "3x1");
  if (!t) return;
  const p = document.createElement("p"); p.className = "fi-ts-honesto";
  p.innerHTML = `<i class="fi-ts-aprox">aproximado</i> <span><b>Teste fora da amostra:</b> a regra, usada em ${dataCurta(t.de)} sem saber o futuro, teria feito <b class="${classe(t.retorno)}">${pct(t.retorno, 1)}</b> em ${K.diasEntre(t.de, t.ate)} dias (Proporcional 3× · 1 min). ${q("foraAmostra")}</span>`;
  const b = document.createElement("button"); b.className = "fi-ts-ver"; b.textContent = "Ver";
  b.onclick = () => { sel.sub = "mais"; guardarSel(); ctx.redesenhar(); };
  p.append(b);
  el.append(p);
}

export function telaMais(el, ctx) {
  const { d } = ctx;
  secaoForaDaAmostra(el, d);
  secaoAgregadas(el, d);
  secaoParar(el, d);
  ctx.rodape(el);
}

const textoNum = (t) => { const e = K.estimativa(t); return e && !e.cedo && e.mes != null ? `${pctMes(e.mes)} ao mês` : t ? `${pct(t.retorno, 1)} no período` : "—"; };
const numDe = (t) => { const e = K.estimativa(t); return e && !e.cedo && e.mes != null ? e.mes : t?.retorno ?? 0; };

function secaoForaDaAmostra(el, d) {
  const fa = K.foraDaAmostra(d);
  const s = secao(el, `Teste fora da amostra ${q("foraAmostra")}`, `<i class="fi-ts-aprox">aproximado</i>`, "fi-ts-fora");
  if (!fa) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Este teste ainda não rodou: começa na próxima rodada dos testes.</p>`); return; }
  const an = fa.andamento, r = fa.resultado;
  const textoAndamento = (a) => {
    const fase = { pre: `refazendo o ranking de ${dataCurta(K.diaDe(a.de))}: ${a.olhadas.toLocaleString("pt-BR")} de ${a.amostra.toLocaleString("pt-BR")} carteiras olhadas, ${a.passaram} passaram no 1º filtro`,
      fino: `analisando as que passaram: ${a.analisadas} de ${a.passaram}, ${a.aprovadas} aprovadas`,
      copia: `copiando as ${a.escolhidas} escolhidas nos 30 dias seguintes: ${a.copiadas} de ${a.escolhidas}` }[a.fase] || a.fase;
    const prog = a.fase === "pre" ? a.olhadas / Math.max(1, a.amostra) * 0.6 : a.fase === "fino" ? 0.6 + 0.3 * a.analisadas / Math.max(1, a.passaram) : 0.9 + 0.1 * a.copiadas / Math.max(1, a.escolhidas);
    return `<div class="fi-ts-fora-prog"><i style="--w:${Math.round(Math.min(1, prog) * 100)}%"></i></div><p class="fi-dica">${fase}. Anda um pouco a cada rodada (a cada 2 h); leva 1 a 2 dias.</p>`;
  };
  if (!r) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica"><b>Montando o 1º teste.</b></p>${an ? textoAndamento(an) : ""}`); return; }
  const kOk = sel.modo === "vivo" && r.contas?.[comboSel(d)] ? comboSel(d) : "3x1";
  const t = K.foraNaCombinacao(d, kOk);
  if (!t) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">O teste terminou sem nenhuma carteira escolhida (${r.funil?.olhadas ?? 0} olhadas): nada passou na regra naquela época.</p>`); return; }
  heroiEstimativa(s, d, t, { titulo: `Se a regra tivesse escolhido em ${dataCurta(t.de)} · ${K.nomeJeito(kOk)}`, ops: t.ops, metricas: t.conta.metricas });
  const dias = K.diasEntre(t.de, t.ate);
  s.insertAdjacentHTML("beforeend", `<p class="fi-dica">De ${dataCurta(t.de)} a ${dataCurta(t.ate)}: ${dias} dias que a regra não viu · ${r.n} ${r.n === 1 ? "carteira escolhida" : "carteiras escolhidas"} de uma amostra de ${(r.amostra || 0).toLocaleString("pt-BR")} (de ${(r.universo || 0).toLocaleString("pt-BR")} no ranking) · ${t.conta.positivas ?? "?"} no azul, a pior ${pct(t.conta.piores, 0)}.</p>`);
  if (r.previsto != null && kOk === "3x1") s.insertAdjacentHTML("beforeend", `<p class="fi-ts-previsto ${r.previsto > t.retorno + 0.05 ? "otimista" : ""}">O teste no período da escolha das mesmas carteiras dizia <b>${pct(r.previsto, 1)}</b>; fora da amostra deu <b class="${classe(t.retorno)}">${pct(t.retorno, 1)}</b>. ${q("previsto")}</p>`);
  graficoComRefs(s, d, "Fora da amostra", t.pts);
  // os jeitos neste teste
  const jeitos = Object.entries(r.contas || {}).map(([k, a]) => ({ k, a })).sort((x, y) => (y.a.retorno ?? -9) - (x.a.retorno ?? -9));
  if (jeitos.length > 1) {
    const dj = document.createElement("details"); dj.className = "fi-ts-detalhes fi-ts-fora-jeitos";
    dj.innerHTML = `<summary>Os jeitos de copiar neste teste <small>${jeitos.length}</small></summary><ol class="fi-ts-rank">${jeitos.map((x, i) => `<li class="${x.k === kOk ? "on" : ""}"><span class="pos">${i + 1}º</span><span class="tx"><b>${K.nomeJeito(x.k)}</b><small><span class="${classe(x.a.retorno)}">${pct(x.a.retorno, 1)}</span> em ${dias} dias · pior queda ${pct(-x.a.piorQueda, 1)}${x.a.nLiq ? ` · ${x.a.nLiq} liquidações` : ""}${x.a.pararam ? ` · ${x.a.pararam} largadas` : ""}</small></span></li>`).join("")}</ol>`;
    s.append(dj);
  }
  if (r.carteiras?.length) {
    const dc = document.createElement("details"); dc.className = "fi-ts-detalhes";
    dc.innerHTML = `<summary>As escolhidas pela regra <small>${r.carteiras.length}</small></summary><ul class="fi-ts-lista">${r.carteiras.map(c => `<li><span><b>${escapar(c.curto)}</b><small>na escolha ${pct(c.previsto, 0)} · nota ${c.nota == null ? "—" : Number(c.nota).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</small></span><b class="${classe(c.retorno)}">${pct(c.retorno, 1)}</b></li>`).join("")}</ul>`;
    s.append(dc);
  }
  const fu = r.funil;
  if (fu) {
    const df = document.createElement("details"); df.className = "fi-ts-detalhes";
    const rec = Object.entries({ ...(fu.recusasPre || {}), ...(fu.recusasFino || {}) }).sort((a, b) => b[1] - a[1]).slice(0, 8);
    df.innerHTML = `<summary>Como a regra escolheu em ${dataCurta(t.de)}</summary>
      <ul class="fi-ts-lista"><li><span>Sorteadas do ranking</span><b>${(fu.amostra || 0).toLocaleString("pt-BR")}</b></li><li><span>Passaram no 1º filtro (em T0)</span><b>${fu.passaram}</b></li><li><span>Aprovadas</span><b>${fu.aprovadas}</b></li><li><span>Escolhidas</span><b>${fu.escolhidas}</b></li></ul>
      ${rec.length ? `<h4>Por que recusamos</h4><ul class="fi-ts-lista">${rec.map(([m, n]) => `<li><span>${escapar(m)}</span><b>${n.toLocaleString("pt-BR")}</b></li>`).join("")}</ul>` : ""}`;
    s.append(df);
  }
  if (fa.rodadas.length > 1) s.insertAdjacentHTML("beforeend", `<h4 class="fi-ts-fora-t">Os testes anteriores</h4><ul class="fi-ts-lista">${[...fa.rodadas].reverse().map(x => `<li><span>${dataCurta(K.diaDe(x.de))} a ${dataCurta(K.diaDe(x.ate))}<small>${x.n} carteiras · na escolha ${pct(x.previsto, 0)}</small></span><b class="${classe(x.retorno)}">${pct(x.retorno, 1)}</b></li>`).join("")}</ul>`);
  if (an) s.insertAdjacentHTML("beforeend", `<p class="fi-dica"><b>Um teste novo está sendo montado.</b></p>${textoAndamento(an)}`);
  else if (fa.proximo) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">O próximo começa em ${dataCurta(K.diaDe(fa.proximo))}.</p>`);
  s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Aproximado: amostra sorteada do ranking de hoje (quem sumiu dele não entra), histórico espaçado, velas de 1 h na escolha e de 15 min na cópia. Serve de ideia, não de medida exata.</p>`);
}

function secaoAgregadas(el, d) {
  const lista = K.agregadas(d);
  const s = secao(el, "Outras carteiras de carteiras", "ao vivo · US$ 1.000 cada", "fi-ts-agregadas");
  if (!lista.length) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">As 5 melhores, o Consenso e Só robôs × Só pessoas aparecem a partir da próxima rodada dos testes.</p>`); return; }
  const hoje = K.diaDe(d.agora || Date.now());
  const rob = lista.find(x => x.id === "robos"), hum = lista.find(x => x.id === "humanos");
  if (rob && hum) {
    const tr = K.trechoConta(rob, "tudo", hoje), th = K.trechoConta(hum, "tudo", hoje);
    s.insertAdjacentHTML("beforeend", `<div class="fi-ts-versus"><span><small>Só robôs ${q("roboPessoa")}</small><b class="${classe(numDe(tr))}">${textoNum(tr)}</b><small>${rob.n} ${rob.n === 1 ? "carteira" : "carteiras"}</small></span><i>×</i><span><small>Só pessoas</small><b class="${classe(numDe(th))}">${textoNum(th)}</b><small>${hum.n} ${hum.n === 1 ? "carteira" : "carteiras"}</small></span></div>`);
  }
  for (const a of lista) {
    const t = K.trechoConta(a, "tudo", hoje), m = a.metricas || K.metricasDe(a, d);
    const risco = K.nivelRisco({ queda: t?.queda || 0, nLiq: a.nLiq || 0, alav: 3 });
    const det = document.createElement("details"); det.className = "fi-ts-ag"; det.dataset.ag = a.id;
    det.open = !!secaoAgregadas.abertas?.[a.id];
    det.ontoggle = () => { (secaoAgregadas.abertas ||= {})[a.id] = det.open; };
    const qid = a.id === "top5" ? "top5" : a.id === "consenso" ? "consenso" : "roboPessoa";
    const sub = a.id === "consenso" ? `${Object.keys(a.consensoAgora || {}).length} ${Object.keys(a.consensoAgora || {}).length === 1 ? "moeda" : "moedas"} em consenso agora` : `${a.n} ${a.n === 1 ? "carteira" : "carteiras"} · ${a.nTrocas || 0} ${a.nTrocas === 1 ? "troca" : "trocas"}`;
    det.innerHTML = `<summary><span class="fi-ts-ag-cab"><b>${escapar(a.nome)}</b> ${q(qid)}<small>${sub}</small></span><span class="fi-ts-ag-num"><b class="${classe(numDe(t))}">${textoNum(t)}</b>${m ? `<small class="${m.venceCdi ? "ts-sobe" : "ts-desce"}">${m.venceCdi ? "à frente do CDI" : "atrás do CDI"}</small>` : ""}${seloRisco(risco)}</span></summary>`;
    const corpo = document.createElement("div"); corpo.className = "fi-ts-ag-corpo";
    corpo.insertAdjacentHTML("beforeend", `<p class="fi-dica">${escapar(a.regra || "")}</p>`);
    if (t?.pts?.length) graficoComRefs(corpo, d, a.nome, t.pts);
    if (m) secaoMetricas(corpo, m);
    if (a.id === "consenso") {
      const ag = Object.entries(a.consensoAgora || {});
      corpo.insertAdjacentHTML("beforeend", `<h4>Agora</h4>${ag.length ? `<ul class="fi-ts-lista">${ag.map(([mo, x]) => `<li><span><b>${escapar(mo)}</b><small>${x.n} carteiras</small></span><b>${x.lado === "compra" ? "comprado" : "vendido"}</b></li>`).join("")}</ul>` : `<p class="fi-dica">Sem consenso em nenhuma moeda: a conta está parada.</p>`}
        <p class="fi-dica">${a.ops || 0} operações · taxas ${us(a.taxas || 0)}${a.nLiq ? ` · ${a.nLiq} liquidações` : ""}</p>`);
      const ult = (a.ultimas || []).slice(0, 6);
      if (ult.length) corpo.insertAdjacentHTML("beforeend", `<ul class="fi-ts-linha-tempo">${ult.map(o => itemTempo({ em: o.em, tipo: o.tipo, frase: K.fraseOp(o), res: o.res })).join("")}</ul>`);
    } else {
      corpo.insertAdjacentHTML("beforeend", `<h4>Nela agora</h4><p class="fi-dica">${a.membros?.length ? a.membros.map(escapar).join(", ") : "nenhuma carteira (dinheiro parado)"}${a.proximaTroca ? ` · próxima troca em ${dataCurta(a.proximaTroca)}` : ""} · custos das trocas ${us(a.custos || 0)}. ${q("troca")}</p>`);
      const tr = [...(a.trocas || [])].reverse().slice(0, 6);
      if (tr.length) corpo.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-trocas">${tr.map(x => `<li><span>${dataCurta(x.dia)}<small>${x.entraram?.length ? `entraram ${x.entraram.map(escapar).join(", ")}` : ""}${x.entraram?.length && x.sairam?.length ? " · " : ""}${x.sairam?.length ? `saíram ${x.sairam.map(escapar).join(", ")}` : ""}${!x.entraram?.length && !x.sairam?.length ? "sem mudança" : ""}</small></span><small>${us(x.custo || 0)}</small></li>`).join("")}</ul>`);
    }
    det.append(corpo);
    s.append(det);
  }
}

function secaoParar(el, d) {
  const l = K.compararParadas(d, { modo: "vivo", periodo: "tudo" });
  if (!l.some(x => K.partes(x.k).versao)) return;
  const s = secao(el, `Parar de copiar quem afunda ${q("parar")}`, "todas as carteiras · ao vivo", "fi-ts-parar");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${l.map(x => `<li><span><b>${K.nomeJeito(x.k)}</b><small>pior queda ${pct(-x.t.queda, 1)}${x.pararam != null ? ` · ${x.pararam} ${x.pararam === 1 ? "carteira largada" : "carteiras largadas"}` : ""}</small></span><b class="${classe(numDe(x.t))}">${textoNum(x.t)}</b></li>`).join("")}</ul>
    <p class="fi-dica">A carteira de carteiras em cada jeito, desde o começo. Quem cai do limite fica parado em dinheiro até o fim. Tocar num jeito em Jeitos de copiar o escolhe para as outras abas.</p>`);
}

// ------------------------------------------------------------------ Seguir o BDM (apostas, 09/11/2026)
const rs = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const oddTx = (o) => (o == null ? "—" : Number(o).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const SIT_BDM = { esperando: "esperando o jogo", apostado: "esperando o placar", anulado: "anulada", fora: "fora do teste" };
/** O cartão da conta Seguir o BDM (`extra` dela, FORMATO.md do orbita-testes): palpites vistos × no teste, os números,
 *  por que ficaram de fora e os últimos palpites com o resultado. Só ao vivo. */
export function secaoBDM(el, v, a) {
  const x = a?.extra;
  if (!v || v.id !== "bdm" || !x || x.palpitesVistos == null) return;
  const s = secao(el, `Seguir o BDM ${q("seguirBDM")}`, x.palpitesVistos ? `${x.palpitesVistos} palpite${x.palpitesVistos === 1 ? "" : "s"} desde ${dataCurta(K.diaDe(x.desde || a.inicio))}` : "esperando o 1º palpite", "fi-ts-bdm");
  if (!x.palpitesVistos) {
    s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nenhum palpite ainda: eles chegam quando o programa da manhã é transcrito e lido.</p>`);
    return;
  }
  const nums = [
    ["No teste", `${x.noTeste || 0} de ${x.palpitesVistos}`, `cobertura ${pctSem(x.cobertura)} ${q("cobertura")}`],
    ["Acerto", x.acerto != null ? pctSem(x.acerto) : "—", `${x.apostas || 0} com placar`],
    ["Retorno por aposta", x.roi != null ? `<span class="${classe(x.roi)}">${pct(x.roi, 1)}</span>` : "—", `R$ 20 cada ${q("roi")}`],
    ["CLV", x.clvMedio != null ? `<span class="${classe(x.clvMedio)}">${pct(x.clvMedio, 1)}</span>` : "—", x.clvPositivo != null ? `${pctSem(x.clvPositivo)} acima do fechamento ${q("clv")}` : `contra o fechamento ${q("clv")}`],
    ["Pior sequência", `${x.piorSequencia || 0}`, "derrotas seguidas"],
  ];
  if (x.oddCitadaMedia) nums.push(["Odd citada × pega", `${oddTx(x.oddCitadaMedia)} × ${oddTx(x.oddPegaMedia)}`, `médias ${q("oddCitada")}`]);
  s.insertAdjacentHTML("beforeend", `<div class="fi-ts-bdm-nums">${nums.map(([n, b, sm]) => `<span><small>${n}</small><b>${b}</b><small>${sm}</small></span>`).join("")}</div>`);
  const fora = Array.isArray(x.fora) ? x.fora.filter(f => f && f.n) : [];
  if (fora.length) s.insertAdjacentHTML("beforeend", `<details class="fi-ts-bdm-fora"><summary>Fora do teste: ${fora.reduce((t, f) => t + f.n, 0)}${x.esperando ? ` · ${x.esperando} esperando` : ""}</summary><ul class="fi-ts-lista">${fora.map(f => `<li><span><small>${escapar(f.motivo)}</small></span><b>${f.n}</b></li>`).join("")}</ul></details>`);
  const ult = Array.isArray(x.ultimos) ? x.ultimos : [];
  if (ult.length) s.insertAdjacentHTML("beforeend", `<h4 class="fi-ts-bdm-t">Últimos palpites</h4><ul class="fi-ts-lista fi-ts-bdm-ult">${ult.map(p => {
    const fim = p.situacao === "liquidado" && p.resultado != null;
    const lado = fim ? `<b class="${classe(p.resultado)}">${rs(p.resultado)}${p.placar ? `<small> ${p.placar[0]} × ${p.placar[1]}</small>` : ""}</b>`
      : `<b class="fi-ts-bdm-sit"><small>${escapar(SIT_BDM[p.situacao] || p.situacao || "")}</small></b>`;
    const qd = p.inicio ? quando(p.inicio) : dataCurta(p.dia);
    const odds = [p.oddCitada != null ? `citou ${oddTx(p.oddCitada)}` : null, p.odd != null ? `pegou ${oddTx(p.odd)}` : null].filter(Boolean).join(" · ");
    return `<li class="${p.situacao === "fora" ? "fi-ts-bdm-x" : ""}"><span><b>${escapar(p.jogo)}</b><small>${escapar(p.selecao || p.mercado || "")}${odds ? ` · ${odds}` : ""} · ${qd}${p.competicao ? ` · ${escapar(p.competicao)}` : ""}${p.situacao === "fora" && p.motivo ? `<br>${escapar(p.motivo)}` : ""}</small></span>${lado}</li>`;
  }).join("")}</ul>`);
  s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Os palpites são lidos de uma transcrição automática por uma IA, que pode errar; só ao vivo (não há teste no passado).</p>`);
}
