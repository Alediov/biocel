// Testes de mercado: a tela de uma carteira, em 4 partes e linguagem simples (pedido de 22h27): Resumo (o % ao mês
// estimado, os números com "o que quer dizer", os gráficos e o melhor jeito para ela), Jeitos (o ranking e a grade só
// dela), O que fez (a linha do tempo) e Perfil (robô ou pessoa, os "parâmetros", o horário, o imitador e por que entrou).
import { escapar, toast } from "../../ui.js";
import { icone } from "../../icones.js";
import * as K from "./calculo.js";
import { sel, guardarSel, comboSel, trechoSel, hojeDe, barra, seg, secao, graficoComRefs, AVISO, q,
  classe, horas, pct, pctSem, us, vezes, num, quando, nomePeriodo, pctMes,
  graficoMeses, graficoQueda, graficoAlavancagem, mapaHorario } from "./comum.js";
import { secaoGrade, linhaVerba, heroiEstimativa, secaoMetricas, secaoProjecao, seloRobo, seloRisco, usarCombo, itemTempo } from "./subabas.js";

const PARTES = [["geral", "Resumo", "📈"], ["grade", "Jeitos", "🧮"], ["ops", "O que fez", "📋"], ["perfil", "Perfil", "🔬"]];

export function telaCarteira(el, ctx, c) {
  const { redesenhar } = ctx;
  const cab = document.createElement("div"); cab.className = "fi-cab";
  cab.innerHTML = `<button class="fi-voltar"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Quem copiamos</span></button>
    <h2 class="fi-ts-end">${escapar(c.curto)}</h2><p>Seguida desde ${quando(c.desde)} · ${seloRobo(c)}</p>`;
  cab.querySelector(".fi-voltar").onclick = ctx.fechar;
  el.append(cab);
  el.insertAdjacentHTML("beforeend", `<p class="fi-ts-aviso" role="note">${icone("🧪", "ico-inline")} ${AVISO}</p>`);
  if (!PARTES.some(p => p[0] === sel.parte)) sel.parte = "geral";
  const ch = document.createElement("div"); ch.className = "fi-ts-subs fi-ts-partes"; ch.dataset.semDeslize = "";
  ch.innerHTML = PARTES.map(([k, n, e]) => `<button data-parte="${k}" class="${sel.parte === k ? "on" : ""}">${icone(e, "ico3d")}<span>${n}</span></button>`).join("");
  ch.querySelectorAll("button").forEach(b => (b.onclick = () => { sel.parte = b.dataset.parte; guardarSel(); redesenhar(); }));
  el.append(ch);
  ({ geral: resumo, grade: jeitos, ops: oQueFez, perfil }[sel.parte])(el, ctx, c);
}

function resumo(el, ctx, c) {
  const { d, redesenhar } = ctx;
  barra(el, d, redesenhar);
  const k = comboSel(d), a = K.contaDe(c, k, sel.modo), t = trechoSel(d, c, k), hist = sel.modo === "hist";
  if (!a || !t) {
    el.insertAdjacentHTML("beforeend", `<p class="fi-dica">${sel.versao === "m" && hist ? "Só moedas boas não tem teste no período da escolha (seria olhar o futuro)." : `Sem dados para ${K.nomeJeito(k)} ${hist ? "no período da escolha" : "ainda"}.`}</p>`);
    melhorDela(el, ctx, c);
    return;
  }
  // as métricas comuns (`metricas` de cada conta do resumo, desde 09/11/2026) medem desde o início: só no "Tudo"
  const m = sel.periodo === "tudo" ? K.metricasDe(a, d) : null;
  const e = heroiEstimativa(el, d, t, { titulo: `Se você tivesse copiado esta · ${K.nomeJeito(k)}`, ops: t.ops, metricas: m });
  const risco = K.nivelRisco({ queda: t.queda, nLiq: t.nLiq, alav: K.alavDaCopia(c, k) });
  const ti = document.createElement("div"); ti.className = "fi-tiles fi-ts-tiles";
  const acertoTxt = t.acerto == null ? "—" : `${Math.round(t.acerto * 10)} de 10`;
  ti.innerHTML = `<span><small>Pior queda ${q("queda")}</small><b>${pct(-t.queda, 1)}</b><small>o pior momento</small></span>
    <span><small>Risco ${q("risco")}</small><b>${seloRisco(risco)}</b><small>alavancagem real ≈ ${vezes(K.alavDaCopia(c, k))}</small></span>
    <span><small>Acerto ${q("acerto")}</small><b>${acertoTxt}</b><small>apostas fechadas com lucro</small></span>
    <span><small>Ganho ÷ perda ${q("ganhoPerda")}</small><b>${vezes(t.gp)}</b><small>${t.gp == null ? "sem fechamentos" : t.gp >= 1 ? "ganha mais do que perde" : "perde mais do que ganha"}</small></span>
    <span><small>Dias positivos ${q("diasPositivos")}</small><b>${t.diasPos == null ? "—" : pctSem(t.diasPos)}</b><small>dos dias que mexeram</small></span>
    <span class="${t.nLiq ? "fi-ts-ruim" : ""}"><small>Liquidações ${q("liquidacao")}</small><b>${t.nLiq}</b><small>${t.ops} operações</small></span>
    ${a.saidas ? `<span class="fi-ts-largo"><small>Saídas de segurança ${q("saidas")}</small><b>${a.saidas.tempo || 0} pelo tempo · ${a.saidas.stop || 0} pelo stop${a.fora?.length ? ` · fora de ${escapar(a.fora.join(", "))}` : ""}</b></span>` : ""}
    ${a.parou ? `<span class="fi-ts-largo fi-ts-ruim"><small>Parou de copiar ${q("parar")}</small><b>em ${quando(a.parou.em)}, ${pct(-a.parou.queda, 1)} do topo</b></span>` : a.limite ? `<span class="fi-ts-largo"><small>Parar de copiar ${q("parar")}</small><b>ainda copiando · larga ao cair ${pctSem(a.limite)} do topo</b></span>` : ""}
    ${a.semCaixa ? `<span class="fi-ts-largo"><small>Sem dinheiro livre para entrar</small><b>${a.semCaixa} ${a.semCaixa === 1 ? "aposta ficou" : "apostas ficaram"} de fora</b></span>` : ""}
    ${sel.versao === "m" ? `<span class="fi-ts-largo"><small>Moedas copiadas ${q("moedasBoas")}</small><b>${a.moedas?.length ? escapar(a.moedas.join(", ")) : "nenhuma: a conta fica parada"}</b></span>` : ""}`;
  el.append(ti);
  if (t.curto) el.insertAdjacentHTML("beforeend", `<p class="fi-dica">Menos dias que o período: mostra o que há.</p>`);
  if (m) secaoMetricas(el, m);
  const sg = secao(el, hist ? "No período da escolha (otimista)" : "Patrimônio de mentira", K.nomeJeito(k));
  const extra = [];
  if (sel.versao) {
    const kb = K.chave(K.levPara(d, "", sel.lev), sel.atraso, ""), tb = K.trecho(K.contaDe(c, kb, sel.modo), sel.periodo, hojeDe(d));
    if (tb?.pts?.length) {
      const de = t.pts[0]?.[0], base = tb.pts.filter(p => p[0] <= de).at(-1)?.[1] || tb.pts[0][1];
      extra.push({ nome: `Proporcional ${K.partes(kb).lev}×`, cls: "l-normal", pts: tb.pts.filter(p => p[0] >= de).map(([x, v]) => [x, (1000 * v) / base]) });
    }
  }
  graficoComRefs(sg, d, "Cópia", t.pts, extra);
  if (!hist) sg.insertAdjacentHTML("beforeend", `<p class="fi-dica">Taxas ${us(a.taxas || 0)} · financiamento ${q("financiamento")} ${a.funding > 0 ? "pago" : "recebido"} ${us(Math.abs(a.funding || 0))}</p>${linhaVerba(K.trecho(a, "tudo", hojeDe(d)).pts)}`);
  secao(el, "% de cada mês").append(graficoMeses(K.porMes(t.pts)));
  const sq = secao(el, `Queda do topo ${q("queda")}`, `pior: ${pct(-t.queda, 1)}`);
  sq.append(graficoQueda(K.quedaSerie(t.pts)));
  const sa = secao(el, `Alavancagem × resultado ${q("alavancagem")}`, `proporcional · ${sel.atraso} min`);
  sa.append(graficoAlavancagem(K.porAlavancagem(d, { modo: sel.modo, periodo: sel.periodo, atraso: sel.atraso, c })));
  if (e && !e.cedo) secaoProjecao(el, e);
  melhorDela(el, ctx, c);
  if (!hist && a.posicoes?.length) {
    const sp = secao(el, "Apostas abertas agora");
    sp.insertAdjacentHTML("beforeend", a.posicoes.map(p => `<div class="fi-ts-op"><span class="fi-ts-lado ${p.lado}">${p.lado === "compra" ? "Comprado" : "Vendido"}</span><span class="fi-ts-tx"><b>${escapar(p.moeda)} · ${p.lev}×</b><small>entrou a ${num(p.entrada)} · liquida em ${num(p.liq)}</small></span><span class="fi-ts-v">${p.tam != null ? us(p.tam) : ""}<small>garantia ${us(p.margem)}</small></span></div>`).join(""));
  }
}
function melhorDela(el, ctx, c) {
  const { d, redesenhar } = ctx, m = K.rankingJeitos(d, { modo: sel.modo, periodo: sel.periodo }, c)[0];
  const s = secao(el, "O jeito que funcionou melhor para ela", nomePeriodo());
  if (!m) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Ainda sem dados.</p>`); return; }
  s.insertAdjacentHTML("beforeend", `<button class="fi-ts-melhor"><b>${K.nomeJeito(m.k)}</b><small>${m.est && !m.est.cedo ? `${pctMes(m.est.mes)} ao mês` : `${pct(m.t.retorno)} no período`} · ${seloRisco(m.risco)}</small></button><p class="fi-dica">Escolhido depois de ver: serve de teto ${q("teto")}</p>`);
  s.querySelector("button").onclick = () => usarCombo(m.k, redesenhar);
}
function jeitos(el, ctx, c) {
  const { d, redesenhar } = ctx;
  barra(el, d, redesenhar, { combo: false });
  const rk = K.rankingJeitos(d, { modo: sel.modo, periodo: sel.periodo }, c);
  const s = secao(el, "Do melhor para o pior", nomePeriodo(), "fi-ts-jeitos");
  s.insertAdjacentHTML("beforeend", rk.length ? `<ol class="fi-ts-rank">${rk.slice(0, 8).map((x, i) => `<li data-k="${x.k}" role="button" tabindex="0" class="${x.k === comboSel(d) ? "on" : ""}"><span class="pos">${i + 1}º</span><span class="tx"><b>${K.nomeJeito(x.k)}</b><small>${x.est && !x.est.cedo ? `${pctMes(x.est.mes)} ao mês` : `${pct(x.t.retorno)} no período`} · ${seloRisco(x.risco)}</small></span></li>`).join("")}</ol>` : `<p class="fi-dica">Sem dados ainda.</p>`);
  s.querySelectorAll("[data-k]").forEach(li => (li.onclick = () => usarCombo(li.dataset.k, redesenhar)));
  const det = document.createElement("details"); det.className = "fi-ts-detalhes";
  det.innerHTML = `<summary>Ver detalhes (a grade)</summary>`;
  det.open = !!jeitos.aberto;
  det.ontoggle = () => { jeitos.aberto = det.open; };
  const f = document.createElement("div"); f.className = "fi-ts-filtros";
  f.append(seg("Atraso", K.atrasosDe(d).map(v => [v, `${v} min`]), sel.atraso, v => { sel.atraso = +v; guardarSel(); redesenhar(); }, "fi-ts-atr"));
  det.append(f);
  secaoGrade(det, d, c, redesenhar);
  el.append(det);
}
function oQueFez(el, ctx, c) {
  const { d, redesenhar } = ctx;
  barra(el, d, redesenhar, { periodo: false, modo: false });
  const k = comboSel(d), lista = K.linhaDoTempo(d, k, { carteira: c.endereco });
  const s = secao(el, "O que a cópia fez", K.nomeJeito(k), "fi-ts-tempo");
  s.insertAdjacentHTML("beforeend", lista.length ? `<ul class="fi-ts-linha-tempo">${lista.map(itemTempo).join("")}</ul>` : `<p class="fi-dica">Nada ainda: a cópia entra na próxima compra ou venda dela.</p>`);
}

// ------------------------------------------------------------------ Perfil
const num1 = (v) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
function perfil(el, ctx, c) {
  const pf = c.perfil, r = pf?.robo, p = pf?.parametros || {};
  const s0 = secao(el, "Em uma frase");
  s0.insertAdjacentHTML("beforeend", pf ? `<p class="fi-ts-frase grande">${escapar(pf.frase)}</p>` : `<p class="fi-dica">O perfil é feito uma vez por dia; ainda não saiu para esta carteira.</p>`);
  if (r) {
    const s1 = secao(el, `Robô ou pessoa? ${q("robo")}`, `nota ${r.nota} de 100`);
    s1.insertAdjacentHTML("beforeend", `<div class="fi-ts-regua"><i style="--x:${r.nota}%"></i><span>pessoa</span><span>robô</span></div>
      <p class="fi-ts-rotulo-robo"><b>${escapar(r.rotulo[0].toUpperCase() + r.rotulo.slice(1))}</b></p>
      <ul class="fi-ts-sinais">${r.sinais.map(x => `<li class="${x.s > 0 ? "robo" : x.s < 0 ? "gente" : ""}"><i>${x.s > 0 ? "🤖" : x.s < 0 ? "🙂" : "·"}</i>${escapar(x.frase)}</li>`).join("")}</ul>`);
  }
  if (pf) {
    const s2 = secao(el, "O jeito dela de operar");
    const itens = [];
    if (p.moedas?.length) itens.push(`<b>Moedas:</b> ${p.moedas.map(([m, f]) => `${escapar(m)} (${Math.round(f * 100)}%)`).join(", ")}`);
    if (p.horas?.de != null) itens.push(`<b>Horário:</b> ${p.horas.tam <= 17 ? `quase sempre entre ${p.horas.de}h e ${p.horas.ate}h (Brasília)` : "a qualquer hora"}`);
    if (p.ganhoMediano != null || p.perdaMediana != null) itens.push(`<b>Quando sai:</b> com cerca de ${p.ganhoMediano != null ? `+${num1(p.ganhoMediano)}%` : "—"} quando acerta e ${p.perdaMediana != null ? `−${num1(p.perdaMediana)}%` : "—"} quando erra (no preço)`);
    if (p.tempoH != null) itens.push(`<b>Tempo de cada aposta:</b> ${horas(p.tempoH)}, típico`);
    if (p.apostaPct != null) itens.push(`<b>Tamanho:</b> ${Math.round(p.apostaPct * 100)}% do dinheiro dela por aposta, típico; alavancagem real até ≈ ${vezes(p.alavEfetiva)} ${q("alavancagem")}`);
    if (p.compras != null) itens.push(`<b>Lado:</b> ${p.compras >= 0.7 ? "quase sempre aposta na alta" : p.compras <= 0.3 ? "quase sempre aposta na queda" : `aposta na alta em ${Math.round(p.compras * 100)}% das vezes`}`);
    const a = p.antes;
    if (a) itens.push(`<b>Antes de entrar:</b> na hora anterior o preço tinha andado ${pctSem(Math.abs(a.m60), 1)} ${a.m60 < 0 ? "contra" : "a favor de"} onde ela apostou (mediana) · ${a.tipo === "contra" ? "costuma entrar contra o movimento" : a.tipo === "segue" ? "costuma seguir o movimento" : a.tipo === "rompimento" ? "entra em rompimentos" : "sem padrão claro"}`);
    if (p.martingale) itens.push(`<span class="ruim"><b>Risco:</b> aumenta a aposta quando o preço vai contra (em ${Math.round(p.aumentaContra * 100)}% dos negócios)</span>`);
    s2.insertAdjacentHTML("beforeend", `<ul class="fi-ts-params">${itens.map(x => `<li>${x}</li>`).join("")}</ul><p class="fi-dica">Pelos ${p.negocios || 0} negócios fechados dos 30 dias.</p>`);
    if (pf.horario) { const sh = secao(el, "Quando ela opera", "hora × dia, Brasília"); sh.append(mapaHorario(pf.horario)); sh.insertAdjacentHTML("beforeend", `<p class="fi-dica">Quem opera de madrugada e no fim de semana igual ao resto do tempo provavelmente é robô.</p>`); }
    imitador(el, pf.imitador);
  }
  motivos(el, c);
}
function imitador(el, im) {
  const s = secao(el, `O imitador ${q("imitador")}`, "regras descobertas");
  if (!im) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Ainda não rodou para esta carteira.</p>`); return; }
  if (!im.regras) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">${escapar(im.texto || "Não deu para descobrir as regras desta carteira.")}</p>`); return; }
  const te = im.teste;
  s.insertAdjacentHTML("beforeend", `<p class="fi-ts-frase">${im.ok ? "Regra descoberta" : "Melhor tentativa"}: ${escapar(im.regrasTexto || "")}.</p>
    <div class="fi-tiles"><span><small>Acertou as entradas</small><b class="${im.ok ? "ts-sobe" : "ts-desce"}">${Math.round(te.acerto * 100)}%</b><small>${te.acertadas} de ${te.reais} nos 10 dias de teste</small></span>
      <span><small>Inventou</small><b>${te.inventadas}</b><small>de ${te.sinais} entradas dele</small></span>
      <span><small>Resultado do imitador</small><b class="${classe(im.conta?.retorno)}">${pct(im.conta?.retorno)}</b><small>3×, sem atraso</small></span>
      <span><small>A cópia dela no mesmo tempo</small><b class="${classe(im.copiaTeste)}">${pct(im.copiaTeste)}</b><small>proporcional 3× · 1 min</small></span></div>
    <p class="fi-dica">Ajustado nos primeiros 20 dias e conferido nos 10 últimos, que ele não viu.${im.ok ? "" : " Acertou pouco: não deu para descobrir as regras desta carteira."}</p>`);
}
function motivos(el, c) {
  const m = c.medidas || {}, rk = c.risco || {}, boas = c.moedasBoas || null;
  const s = secao(el, "Por que entrou");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-motivos">${(c.motivos || []).map(x => `<li>${escapar(x)}</li>`).join("")}</ul>
    ${c.alertas?.length ? `<div class="fi-ts-alertas" role="note"><b>⚠ Atenção</b><ul>${c.alertas.map(x => `<li>${escapar(x)}</li>`).join("")}</ul></div>` : ""}`);
  if (rk.piorPerdaRazao != null) s.insertAdjacentHTML("beforeend", `<div class="fi-tiles"><span><small>Pior perda ÷ ganho médio</small><b>${rk.piorPerdaRazao.toLocaleString("pt-BR")}×</b><small>alto = segura as perdas</small></span><span><small>Queda do lucro dela</small><b>${pctSem(rk.quedaLucro)}</b></span><span class="fi-ts-largo"><small>Mais tempo no vermelho</small><b>${horas(rk.vermelhoH)}${rk.vermelhoMoeda ? ` (${escapar(rk.vermelhoMoeda)})` : ""}</b></span></div>`);
  if (boas) s.insertAdjacentHTML("beforeend", `<p class="fi-dica"><b>Moedas boas</b> ${q("moedasBoas")} antes da cópia: ${boas.length ? boas.map(([x, n]) => `${escapar(x)} (${n} op.)`).join(", ") : "nenhuma passou no mínimo"}.</p>`);
  s.insertAdjacentHTML("beforeend", `<div class="fi-tiles"><span><small>Operações por dia</small><b>${m.opsDia != null ? m.opsDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</b></span><span><small>Conta dela</small><b>${c.conta ? us(c.conta).replace(",00", "") : "—"}</b></span></div>
    <p class="fi-dica">Endereço público: <code class="fi-ts-endc">${escapar(c.endereco)}</code></p>`);
  const b = document.createElement("button"); b.className = "botao secundario fi-ts-copiar-end"; b.textContent = "Copiar o endereço"; // some com o olho fechado
  b.onclick = async () => { try { await navigator.clipboard.writeText(c.endereco); toast("Copiado"); } catch { toast(c.endereco, 5000); } };
  s.append(b);
}
