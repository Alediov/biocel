// Testes de mercado → Looping: as partes da revisão de 09/11/2026 (pedido do Alediov, depois de ver o teste no passado:
// wst1, wst3 e wst6 davam quase o mesmo). Formato em tools/papel/FORMATO.md do orbita-testes, "Looping": a conta por
// dentro (`extra.porDentro`), o empate (`extra.empate`, "paga em N meses"), as janelas de 30 dias contra a régua certa
// (`historico.janelas` com `contra`), o teste de estresse (`estresse` da versão), o wstETH em dólar (`extra.dolar`) e
// "Onde o dólar rende mais" (`dolar` no topo: Aave × Morpho × Moonwell). As versões novas (laço quando compensa, só na
// alta, as réguas de dólar) entram pelas partes de sempre de formas.js, pelo `grupo`. Com o looping.json antigo (sem
// essas chaves) as seções somem.
import { escapar } from "../../ui.js";
import { secao, q, classe, pct, pctSem, us, dataCurta, GLOSSARIO } from "./comum.js";

// os termos novos (só se ainda não existirem: o GLOSSARIO é de todas as formas)
const TERMOS = {
  lacoQuandoCompensa: ["Laço quando compensa", "Fica só no wstETH (1×) e monta o laço quando o staking paga pelo menos 0,5 ponto ao ano a mais que o juro do ether, já multiplicado pela alavancagem (média de 7 dias). Desmonta quando a diferença some (média de 3 dias) ou quando o juro do ether passa o staking por 2 pontos. Cada montar e desmontar paga a troca, o deslize, o empréstimo relâmpago e o gás."],
  tendencia: ["Só na alta", "O ether × dólar 2× que só fica montado com o ether acima da média dos últimos 50 dias (a tendência de alta). Abaixo dela, vende todo o ether, paga a dívida e deixa o dólar rendendo no Aave. Decide uma vez por dia, pelo fechamento do dia anterior."],
  mediaMovel: ["Média de 50 dias", "A média dos preços de fechamento dos últimos 50 dias. Preço acima dela costuma indicar alta; abaixo, queda. Não acerta sempre: num vai e vem, a versão entra e sai várias vezes e paga a troca em cada uma."],
  porDentroLaco: ["A conta por dentro (looping)", "De onde veio o resultado: o staking do wstETH, o juro que o depósito recebeu, o juro que a dívida pagou, a troca, o deslize, o empréstimo relâmpago e o gás de montar e desmontar, as multas de liquidação e o preço (o ganho ou a perda do ether, nas versões em dólar)."],
  empateLaco: ["Empate do laço", "Montar o laço custa mais que comprar a moeda uma vez (a régua). \"Paga em N meses\" é quanto tempo o laço leva, rendendo o que rende a mais que a régua pelas taxas de agora, para devolver esse custo. Se as taxas mudarem, o prazo muda."],
  estresse: ["Teste de estresse", "Contas de \"e se\" com as taxas de agora: o juro do empréstimo em que o laço passa a perder, quantos dias de juro alto apagam um ano de ganho e, no wstETH, o que um desvio do preço do wstETH faria. Não é previsão: mostra onde o laço quebra."],
  oraculo: ["Oráculo", "O preço que o Aave usa para decidir a liquidação. Para o wstETH, ele usa a taxa de câmbio do staking (quanto ether cada wstETH vale pelo contrato), não o preço na bolsa. Por isso um desvio do wstETH no mercado não liquida o laço; mas quem precisar sair na hora vende com o desconto."],
  desvioWsteth: ["Desvio do wstETH", "Quando muita gente quer vender ether em staking ao mesmo tempo, ele passa a valer menos que o ether no mercado (em 2022 o stETH chegou a ~6% abaixo). Num laço de 6×, vender com 6% de desconto leva uns 36% do patrimônio (6 × 6%)."],
  medidoEther: ["Medido em ether", "As versões wstETH contam o patrimônio em ether (convertido pelo preço do primeiro dia): assim aparece só o laço, sem o sobe e desce do ether. A régua certa delas é o \"Só wstETH\", não o CDI: o CDI é renda em reais, e o ether pode cair 40% num ano."],
  morpho: ["Morpho", "Um protocolo de empréstimos da rede Base em que \"cofres\" cuidados por outras empresas emprestam o dólar depositado em vários mercados. O papel usa o cofre de USDC com mais dinheiro, sem as recompensas pagas em moeda do próprio protocolo."],
  moonwell: ["Moonwell", "Outro banco automático da rede Base, como o Aave: quem deposita dólar recebe o juro de quem pega emprestado. O papel usa só o juro do depósito, sem as recompensas em moeda do protocolo."],
  ondeDolar: ["Onde o dólar rende mais", "O mesmo dólar parado em três lugares da mesma rede: o depósito do Aave, um cofre da Morpho e o depósito da Moonwell. Rende mais quem paga mais juro; o risco de cada protocolo é outro e o papel não mede."],
};
for (const [k, v] of Object.entries(TERMOS)) if (!GLOSSARIO[k]) GLOSSARIO[k] = v;
export const TERMOS_LOOPING = ["looping", "fatorSaude", "staking", "eMode", "liquidacao", "regua", "aproximado", "medidoEther", "lacoQuandoCompensa", "tendencia", "mediaMovel", "estresse", "oraculo", "desvioWsteth", "porDentroLaco", "empateLaco", "janelas", "morpho", "moonwell", "ondeDolar"];
/** Os motivos de montar e desmontar (o `motivo` dos eventos `reequilibrou`). */
export const MOTIVOS_LOOPING = { compensa: "o laço passou a compensar", diferenca: "a diferença sumiu", juro: "o juro disparou", alta: "acima da média", queda: "abaixo da média", defesa: "defesa" };

const din = (v, o) => us(v, o);
const mi = (v) => (v >= 1e9 ? `US$ ${n1(v / 1e9, 1)} bi` : v >= 1e6 ? `US$ ${n1(v / 1e6, v < 1e7 ? 1 : 0)} mi` : `US$ ${Math.round(v).toLocaleString("pt-BR")}`);
const n1 = (x, c = 1) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: c });
const ehEther = (v) => v?.medida === "ether";
const de10 = (j) => Math.round(((j.vence ?? j.venceCdi ?? 0) / Math.max(1, j.n)) * 10);
const contraNome = (j) => j?.contra?.nome || "CDI";

/** A frase das janelas: "ganhou do Só wstETH em 7 de cada 10 janelas de 30 dias". */
export function textoJanelas(j, curto = false) {
  if (!j || !j.n) return "";
  const x = de10(j), quem = contraNome(j);
  if (curto) return `ganhou ${quem === "o ether parado" ? "do ether parado" : `do ${quem}`} em ${x} de 10 janelas de ${j.dias || 30} dias`;
  return `Ganhou ${quem === "o ether parado" ? "do ether parado" : `do ${quem}`} em ${x} de cada 10 janelas de ${j.dias || 30} dias (${j.vence ?? j.venceCdi} de ${j.n}).`;
}

/** A frase do empate: "Montar custou US$ 2,60 a mais que a régua: paga em ~6 meses." */
export function textoEmpate(em, curto = false) {
  if (!em) return "";
  if (em.pelo === "preco") return curto ? "só paga se o ether subir" : `Montar custou ${din(em.custo)} a mais que a régua, e o juro do dólar emprestado passa o do ether depositado: este laço só paga pelo preço, se o ether subir.`;
  if (em.ganhoAno === 0 && em.meses == null) return curto ? "no 1× agora" : `Agora está no 1× (sem laço): nada a pagar. Montar e desmontar já custaram ${din(em.custo)} a mais que a régua.`;
  if (em.meses == null) return curto ? "não paga com as taxas de agora" : `Montar custou ${din(em.custo)} a mais que a régua e, com as taxas de agora, o laço rende menos que ela: não paga.`;
  const m = em.meses < 1 ? "menos de 1 mês" : `~${n1(em.meses, em.meses < 10 ? 1 : 0)} ${Math.round(em.meses) === 1 ? "mês" : "meses"}`;
  return curto ? `paga em ${m}` : `Montar custou ${din(em.custo)} a mais que a régua; rendendo ${din(em.ganhoAno)} por ano a mais que ela (taxas de agora), paga em ${m}.`;
}

/** Como está indo: a conta por dentro da versão (ao vivo ou no teste no passado). */
export function contaPorDentro(el, a, v, { hist = false } = {}) {
  const x = a?.extra?.porDentro;
  if (!x) return;
  const s = secao(el, `A conta por dentro ${q("porDentroLaco")}`, `${escapar(v.nome)} · ${hist ? "teste no passado" : "ao vivo"}`, "fi-ts-pordentro fi-ts-pd-laco");
  const linhas = [];
  if (x.staking || ehEther(v)) linhas.push([`Staking ${q("staking")}`, x.staking || 0, "o wstETH valendo mais ether"]);
  linhas.push(["Juro recebido", x.juroRecebido || 0, v.id === "eth2tend" ? "o depósito (ether ou o dólar parado)" : "o depósito no protocolo"]);
  if (x.juroPago || v.alav > 1) linhas.push(["Juro pago", -(x.juroPago || 0), "a dívida do laço"]);
  linhas.push(["Troca", -(x.troca || 0), "comprar e vender a moeda"]);
  if (x.deslize || !x.estimado) linhas.push([`Deslize ${q("deslize")}`, -(x.deslize || 0), "o preço pior da troca"]);
  if (x.relampago || v.alav > 1) linhas.push(["Empréstimo relâmpago", -(x.relampago || 0), "montar e desmontar de uma vez"]);
  linhas.push(["Gás da rede", -(x.gas || 0), "as transações na Base"]);
  if (x.liquidacoes) linhas.push([`Liquidações ${q("liquidacao")}`, -x.liquidacoes, "a multa"]);
  if (!ehEther(v) && v.grupo !== "Referência" || Math.abs(x.preco || 0) >= 0.01) linhas.push(["Preço do ether", x.preco || 0, ehEther(v) ? "arredondamentos" : "o ether que a conta segura ou segurou"]);
  const pos = (n) => Math.max(0, n || 0), neg = (n) => Math.max(0, -(n || 0));
  const ganhos = pos(x.staking) + pos(x.juroRecebido) + pos(x.preco);
  const perdas = (x.juroPago || 0) + (x.custos || 0) + (x.liquidacoes || 0) + neg(x.preco);
  const tot = Math.max(ganhos, perdas, 1e-9);
  const vezes = (x.montagens || x.desmontagens) ? `<p class="fi-dica">Montou o laço ${x.montagens || 0} ${x.montagens === 1 ? "vez" : "vezes"} e desmontou ${x.desmontagens || 0}.</p>` : "";
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-pd-lista">${linhas.map(([n, val, sub]) => `<li><span><b>${n}</b><small>${sub}</small></span><b class="${classe(val)}">${din(val, { sinal: true })}</b></li>`).join("")}
      <li class="fi-ts-pd-total"><span><b>Resultado</b><small>desde o começo${ehEther(v) ? " · em ether, a US$ do 1º dia" : ""}</small></span><b class="${classe(x.resultado)}">${din(x.resultado || 0, { sinal: true })}</b></li></ul>
    <div class="fi-ts-pd-barras" aria-hidden="true"><span><small>ganhou</small><i class="sobe" style="--w:${Math.round(ganhos / tot * 1000) / 10}%"></i><b>${din(ganhos)}</b></span><span><small>perdeu</small><i class="desce" style="--w:${Math.round(perdas / tot * 1000) / 10}%"></i><b>${din(perdas)}</b></span></div>${vezes}`);
  const em = a?.extra?.empate;
  if (em) s.insertAdjacentHTML("beforeend", `<p class="fi-ts-pd-empate fi-ts-lp-empate ${em.jaPagou ? "ok" : em.meses == null && em.pelo === "juro" && em.ganhoAno !== 0 ? "ruim" : ""}">${textoEmpate(em)}${em.sobra != null ? ` ${em.jaPagou ? `Já pagou: o laço rendeu ${din(em.sobra)} além da régua.` : `Até aqui, ${din(-em.sobra)} atrás da régua.`}` : ""} ${q("empateLaco")}</p>`);
  if (x.estimado) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Esta conta começou antes de 09/11/2026: o staking está dentro de "Juro recebido" e todos os custos em "Troca".</p>`);
}

/** Como está indo (só nas versões em ether): a versão contra a régua em ether no mesmo período, no lugar do CDI. */
export function secaoContraRegua(el, f, v, modo) {
  if (!ehEther(v)) return;
  const conta = (x) => (modo === "hist" ? x?.historico : x?.aoVivo);
  const a = conta(v), r = conta((f.versoes || []).find(x => x.id === "wst1"));
  if (!a?.serie?.length) return;
  const s = secao(el, `Contra a régua em ether ${q("medidoEther")}`, `${modo === "hist" ? "teste no passado" : "ao vivo"} · mesmo período`, "fi-ts-lp-regua");
  const ret = (serie, de) => { const xs = serie.filter(([d]) => d >= de); return xs.length > 1 ? xs.at(-1)[1] / xs[0][1] - 1 : null; };
  const de = a.serie[0][0], rv = ret(a.serie, de), rr = v.id === "wst1" ? 0 : r?.serie?.length ? ret(r.serie, de) : null;
  const linhas = [[escapar(v.nome), rv, "a versão"]];
  if (v.id !== "wst1" && rr != null) linhas.push(["Só wstETH", rr, "só o staking, sem laço"]);
  linhas.push(["Ether parado", 0, "a régua de tudo o que é medido em ether"]);
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${linhas.map(([n, x, sub]) => `<li><span><b>${n}</b><small>${sub}</small></span><b class="${x == null ? "" : classe(x)}">${x == null ? "—" : pct(x, 2)}</b></li>`).join("")}</ul>
    <p class="fi-dica">Esta conta é medida em ether: o CDI (renda em reais) não serve de régua para ela. ${v.id !== "wst1" && rr != null && rv != null ? (rv > rr ? "O laço está à frente do Só wstETH." : "O laço está atrás do Só wstETH: a diferença entre o staking e o juro não pagou o custo de montar.") : ""}</p>`);
}

/** Como está indo (wstETH): o mesmo dinheiro em dólar de verdade, ao lado do ether. */
export function etherDolar(el, a, v) {
  const d = a?.extra?.dolar;
  if (!ehEther(v) || !d) return;
  const s = secao(el, `Em ether e em dólar ${q("medidoEther")}`, "a mesma conta, duas réguas", "fi-ts-lp-dolar");
  s.insertAdjacentHTML("beforeend", `<div class="fi-tiles fi-ts-tiles">
      <span><small>Em ether</small><b class="${classe(a.retorno)}">${pct(a.retorno || 0, 2)}</b><small>o laço sozinho</small></span>
      <span><small>Em dólar de verdade</small><b class="${classe(d.retorno)}">${pct(d.retorno, 1)}</b><small>${a.extra?.emDolar != null ? din(a.extra.emDolar) : ""} hoje</small></span>
      <span><small>O ether no período</small><b class="${classe(d.ether)}">${pct(d.ether, 1)}</b><small>quanto ele andou</small></span>
      <span><small>Pior queda em dólar ${q("queda")}</small><b>${pct(-(d.piorQueda || 0), 1)}</b><small>quem começou com dólar</small></span></div>
    <p class="fi-dica">Quem começa com dólar compra ether: em dólar, a conta sobe e cai junto com ele. O laço só muda o que vem a mais ou a menos que o ether.</p>`);
}

/** Como está indo: o teste de estresse da versão (só nas de laço). */
export function secaoEstresse(el, v) {
  const e = v?.estresse;
  if (!e) return;
  const s = secao(el, `Teste de estresse ${q("estresse")}`, `${escapar(v.nome)} · pelas taxas de agora${e.base === "teorica" ? " · como se estivesse montada" : ""}`, "fi-ts-lp-estresse");
  const li = (n, x, sub, cls = "") => `<li class="${cls}"><span><b>${n}</b><small>${sub}</small></span><b>${x}</b></li>`;
  const linhas = [];
  if (e.tipo === "wst") {
    linhas.push(li("Juro do ether agora", `${pct(e.juroAgora, 2)} a.a.`, `staking ${pct(e.stakingAgora, 2)} a.a. · o laço rende ${pct(e.rendeAno, 2)} a.a.`));
    linhas.push(li("Passa a render menos que o 1×", `${pct(e.juroRegua, 2)} a.a.`, "com o juro do ether acima disso, o Só wstETH ganha", e.juroAgora >= e.juroRegua ? "fi-ts-ruim" : ""));
    linhas.push(li("Passa a perder dinheiro", `${pct(e.juroPerde, 2)} a.a.`, "o juro em que o laço rende zero", e.juroAgora >= e.juroPerde ? "fi-ts-ruim" : ""));
  } else {
    linhas.push(li("Juro do dólar agora", `${pct(e.juroAgora, 2)} a.a.`, `depósito do ether ${pct(e.depositoAgora, 2)} a.a. · o juro sozinho rende ${pct(e.rendeAno, 2)} a.a.`));
    linhas.push(li("O juro passa a custar mais que rende", `${pct(e.juroPerde, 2)} a.a.`, "acima disso, só o preço do ether paga o laço", e.juroAgora >= e.juroPerde ? "fi-ts-ruim" : ""));
  }
  for (const j of e.juroAlto || []) linhas.push(li(`Juro ${j.vezes}× o de hoje (${pct(j.juro, 1)})`, j.diasApagam != null ? `${n1(j.diasApagam, 0)} dias` : j.rendeAno < 0 ? "já perde" : "não apaga", j.diasApagam != null ? "apagam um ano de ganho" : j.rendeAno < 0 ? `rende ${pct(j.rendeAno, 1)} a.a.` : `ainda rende ${pct(j.rendeAno, 1)} a.a.`, j.diasApagam != null && j.diasApagam < 60 ? "fi-ts-ruim" : ""));
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${linhas.join("")}</ul>`);
  if (e.tipo === "wst" && e.desvio?.length) {
    s.insertAdjacentHTML("beforeend", `<h4 class="fi-ts-lp-h">Se o wstETH descolar do ether ${q("desvioWsteth")}</h4>
      <ul class="fi-ts-lista fi-ts-lp-desvio">${e.desvio.map(d => li(`−${pctSem(d.desvio, 0)} no mercado`, `${pct(-d.perdaSaindo, 0)}`, `fator de saúde fica ${n1(d.hfAave, 2)} no Aave · seria ${n1(d.hfSeMercado, 2)} pelo mercado${d.liquidariaSeMercado ? " (liquidaria)" : ""} · perda vendendo na hora`, d.perdaSaindo >= 0.3 ? "fi-ts-ruim" : "")).join("")}</ul>
      <p class="fi-dica">O ${escapar(e.oraculo || "oráculo")} ${q("oraculo")} decide a liquidação: como o Aave avalia o wstETH pelo câmbio do staking, um desvio no mercado não liquida. A perda só aparece se for preciso sair na hora (alavancagem × desvio). Pelo mercado, liquidaria com um desvio de ${pctSem(e.desvioLiquida || 0, 1)}.</p>`);
  }
  if (e.tipo === "eth" && e.quedas?.length) {
    s.insertAdjacentHTML("beforeend", `<h4 class="fi-ts-lp-h">Se o ether cair</h4>
      <ul class="fi-ts-lista">${e.quedas.map(d => li(`Ether −${pctSem(d.queda, 0)}`, `${pct(-d.perda, 0)}`, `fator de saúde ${n1(d.hf, 2)}${d.liquida ? " · liquidada" : ""}`, d.liquida ? "fi-ts-ruim" : "")).join("")}
      ${e.quedaLiquida != null ? li("Liquida com uma queda de", pctSem(e.quedaLiquida, 0), `fator de saúde agora ${n1(e.hfAgora, 2)}`) : ""}</ul>`);
  }
}

/** Como está indo: as janelas de 30 dias do teste no passado, contra a referência certa da versão. */
export function secaoJanelas(el, v) {
  const j = v?.historico?.janelas;
  if (!j || !j.n) return;
  const s = secao(el, `Janelas de ${j.dias || 30} dias ${q("janelas")}`, `teste no passado · contra ${escapar(contraNome(j))}`, "fi-ts-janelas fi-ts-lp-janelas");
  const x = de10(j), ref = (o) => o?.ref ?? o?.cdi ?? 0;
  s.insertAdjacentHTML("beforeend", `<p class="fi-ts-jan-frase"><b class="${x >= 5 ? "ts-sobe" : "ts-desce"}">${x} de 10</b> ${textoJanelas(j).replace(/^Ganhou/, "ganhou").replace(/ \(.*$/, "")}</p>
    <div class="fi-ts-jan-pontos" role="img" aria-label="${j.vence ?? j.venceCdi} de ${j.n} janelas acima">${(j.lista || []).map(([d, r, c]) => `<i class="${(1 + r) > (1 + c) ? "sim" : "nao"}" title="${dataCurta(d)}: ${pct(r, 2)} (${escapar(contraNome(j))} ${pct(c, 2)})"></i>`).join("")}</div>
    <ul class="fi-ts-lista">
      <li><span><b>Mediana</b><small>a janela do meio</small></span><b class="${classe(j.mediana)}">${pct(j.mediana, 2)}</b></li>
      <li><span><b>Pior janela</b><small>a partir de ${dataCurta(j.pior?.de)} · ${escapar(contraNome(j))} ${pct(ref(j.pior), 2)}</small></span><b class="${classe(j.pior?.retorno)}">${pct(j.pior?.retorno ?? 0, 2)}</b></li>
      <li><span><b>Melhor janela</b><small>a partir de ${dataCurta(j.melhor?.de)} · ${escapar(contraNome(j))} ${pct(ref(j.melhor), 2)}</small></span><b class="${classe(j.melhor?.retorno)}">${pct(j.melhor?.retorno ?? 0, 2)}</b></li></ul>
    <p class="fi-dica">Cada ponto é uma janela (verde: passou ${escapar(contraNome(j))} no mesmo período). ${j.contra?.id === "cdi" ? "Versão em dólar: a régua é o CDI." : "Versão em ether: a régua é a do ether, não o CDI."}</p>`);
}

/** Como está indo (ao vivo): onde o dólar parado rende mais na mesma rede (`dolar` do topo). */
export function ondeDolar(el, f, v) {
  const xs = Array.isArray(f?.dolar) ? f.dolar.filter(x => x && x.nome) : [];
  if (!xs.length || (v && v.medida !== "dolar")) return;
  const melhor = xs.filter(x => x.agora != null).sort((a, b) => b.agora - a.agora)[0];
  const s = secao(el, `Onde o dólar rende mais ${q("ondeDolar")}`, "USDC parado na rede Base · ao ano", "fi-ts-lp-onde");
  const nome = (x) => `${escapar(x.nome)}${x.id === "morpho" ? ` ${q("morpho")}` : x.id === "moonwell" ? ` ${q("moonwell")}` : ""}`;
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${xs.map(x => `<li data-onde="${escapar(x.id)}" class="${x.semDados ? "fi-ts-ruim" : ""}"><span><b>${nome(x)}${melhor && x.id === melhor.id ? ` <i class="fi-ts-selo">mais agora</i>` : ""}</b><small>${x.semDados ? escapar(x.semDados) : [x.media30 != null ? `30 dias ${pct(x.media30, 2)}` : null, x.media365 != null ? `1 ano ${pct(x.media365, 2)}` : null, x.cofre ? `cofre ${escapar(x.cofre)}` : null, x.tvl ? `${mi(x.tvl)} depositados` : null, x.recompensa ? `+${pct(x.recompensa, 1)} em moeda do protocolo, fora da conta` : null].filter(Boolean).join(" · ")}</small></span><b>${x.agora != null ? pct(x.agora, 2) : "—"}</b></li>`).join("")}</ul>
    <p class="fi-dica">Só o juro do depósito, sem as recompensas pagas em moedas dos protocolos. As versões "Só USDC" de cada lugar mostram o mesmo no tempo, em Versões.</p>`);
}

/** Versões: a linha das janelas e do empate de cada versão, na própria linha do ranking. */
export function marcarVersoes(s0, f) {
  for (const li of s0.querySelectorAll(".fi-ts-rank li[data-v]")) {
    const v = (f.versoes || []).find(x => x.id === li.dataset.v), tx = li.querySelector(".tx");
    if (!v || !tx || li.querySelector(".fi-ts-lp-linha")) continue;
    const j = v.historico?.janelas, em = v.aoVivo?.extra?.empate;
    const partes = [];
    if (ehEther(v)) partes.push(`<i class="fi-ts-selo">em ether ${q("medidoEther")}</i>`);
    if (j?.n) partes.push(`<span class="${de10(j) >= 5 ? "ok" : "ruim"}">${textoJanelas(j, true)}</span>`);
    if (em) partes.push(`<span class="${em.jaPagou ? "ok" : ""}">${textoEmpate(em, true)}</span>`);
    if (v.semDados) partes.push(`<span class="ruim">${escapar(v.semDados)}</span>`);
    if (partes.length) tx.insertAdjacentHTML("beforeend", `<small class="fi-ts-lp-linha">${partes.join(" · ")}</small>`);
  }
}

/** Os números novos para os quadradinhos (tiles) de Como está indo. */
export function tilesLooping(x) {
  const it = [];
  if (x.laco === "montado" || x.laco === "1×") it.push(`<span class="${x.laco === "1×" ? "" : "fi-ts-ok"}"><small>Laço agora ${q("lacoQuandoCompensa")}</small><b>${x.laco === "1×" ? "1× (só wstETH)" : `${x.montadaEm}× montado`}</b><small>${x.laco === "1×" ? "esperando compensar" : "o staking paga mais que o juro"}</small></span>`);
  if (x.laco === "alta" || x.laco === "fora") it.push(`<span><small>Agora ${q("tendencia")}</small><b>${x.laco === "alta" ? "2× no ether" : "fora, em USDC"}</b><small>${x.laco === "alta" ? "acima da média de 50 dias" : `${x.emUsdc != null ? din(x.emUsdc) : ""} rendendo no Aave`}</small></span>`);
  if (x.onde) it.push(`<span><small>Onde está</small><b>${escapar(x.onde)}</b><small>USDC parado</small></span>`);
  return it;
}
