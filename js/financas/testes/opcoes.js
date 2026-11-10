// Testes de mercado → Opções: as partes da revisão de 09/11/2026 (pedido do Alediov, depois do teste no passado: as
// puts levemente positivas, calls cobertas, strangle e a mensal negativas, Sharpe negativo em todas). Formato em
// tools/papel/FORMATO.md do orbita-testes, "Opções": a conta por dentro (`extra.porDentro`) com o empate
// (`extra.empate`), a pior semana (`extra.piorSemana`), as janelas de 30 dias contra a régua certa (`historico.janelas`
// com `contra`), o teste de estresse (`estresse` da versão), a decisão do prêmio caro (`extra.filtro` e
// `config.vrp.agora`), a fase da roda (`extra.fase`) e o sorriso do teste no passado (`config.sorriso`). As versões novas
// (garantia rendendo, prêmio caro, a roda, as réguas) entram pelas partes de sempre de formas.js, pelo `grupo`. Com o
// opcoes.json antigo (sem essas chaves) as seções somem.
import { escapar } from "../../ui.js";
import { secao, q, classe, pct, pctSem, us, dataCurta, GLOSSARIO } from "./comum.js";

// os termos novos (só se ainda não existirem: o GLOSSARIO é de todas as formas)
const TERMOS = {
  garantiaRendendo: ["Garantia rendendo", "Quem vende uma put guarda o dólar para comprar a moeda no strike. Nas versões \"+ Aave\" esse dólar fica no empréstimo de USDC da Aave (rede Base) e rende o juro do dia enquanto espera; só sai o que for pago. Pôr lá custa uns US$ 1,05 (saque e gás) uma vez, e cada pagamento, uns US$ 0,10 de gás. Na corretora de verdade a garantia precisa estar lá: é uma simplificação."],
  premioCaro: ["Prêmio caro", "Só vende na sexta em que a volatilidade que o mercado cobra (a implícita) está pelo menos 20% acima da que a moeda teve de verdade nos últimos 30 dias (a realizada). Nas outras semanas fica de fora, com o dólar rendendo na Aave. A ideia: vender seguro só quando ele está caro."],
  volImplicita: ["Volatilidade implícita", "O quanto o mercado espera que a moeda suba e desça, tirado do preço das opções (aqui, o DVOL da Deribit, de 30 dias). Quanto maior, mais caro o prêmio."],
  volRealizada: ["Volatilidade realizada", "O quanto a moeda subiu e desceu de verdade nos últimos dias, medido pelos preços de hora em hora e levado ao ano. Comparada com a implícita, mostra se o prêmio está caro ou barato."],
  roda: ["A roda", "Vende puts até uma ser exercida; aí fica com a moeda (comprada no strike) e passa a vender calls sobre ela até ser chamada (vende a moeda no strike); e volta às puts. Recebe prêmio o tempo todo, mas segura a moeda justo depois das quedas."],
  sorriso: ["Sorriso", "As opções longe do preço custam mais volatilidade que as do dinheiro (no gráfico, uma curva com cara de sorriso, torta para as puts: o seguro contra a queda é o mais procurado). O teste no passado usa a curva medida na cadeia da Deribit a cada rodada; sem ela, uma curva padrão."],
  spread: ["Spread", "A diferença entre o preço de quem compra e o de quem vende. Quem vende a opção na hora recebe o preço de quem compra, um pouco abaixo do preço justo. O teste no passado usa o spread medido na cadeia de agora."],
  piorSemana: ["Pior semana", "O vencimento que mais custou: quanto a conta pagou além do prêmio e quantas semanas de prêmio médio essa perda apagou. Vender opções ganha pouco quase sempre e perde muito de vez em quando: este número mostra o tamanho do de vez em quando."],
  porDentroOpcoes: ["A conta por dentro (opções)", "De onde veio o resultado: os prêmios recebidos, o que foi pago nos vencimentos que terminaram dentro, as recompras, as taxas da Deribit (venda, entrega e a compra da moeda), os custos de ir e tirar da Aave, os juros da garantia, o que custaria recomprar as opções abertas e o preço (a moeda que a conta segura, nas cobertas e na roda)."],
  empateOpcoes: ["Empate das opções", "Quantas semanas de prêmio médio pagam as taxas e, quando a conta está atrás, quantas semanas de prêmio faltam para recuperar o que foi pago nos vencimentos ruins (sem contar o preço da moeda)."],
  estresseOpcoes: ["Teste de estresse (opções)", "E se a moeda cair 15% ou 30% num fim de semana (com a volatilidade subindo 30%)? E, nas que seguram a moeda ou vendem call, se subir? Conta sobre as opções abertas agora (ou as que a versão venderia agora) e mostra a perda em dólar, em % da conta e em semanas de prêmio médio do passado."],
  janelas: ["Janelas de 30 dias", "O teste no passado cortado em pedaços de 30 dias, um começando a cada 7 dias, cada um comparado com a régua do mesmo período. Mostra se o resultado dependeu de um mês de sorte."],
};
for (const [k, v] of Object.entries(TERMOS)) if (!GLOSSARIO[k]) GLOSSARIO[k] = v;
export const TERMOS_OPCOES = ["put", "call", "strike", "delta", "premio", "dvol", "aproximado", "regua", "garantiaRendendo", "premioCaro", "volImplicita", "volRealizada", "roda", "sorriso", "spread", "piorSemana", "porDentroOpcoes", "empateOpcoes", "estresseOpcoes", "janelas"];
/** Os motivos dos eventos das opções (a roda e o prêmio caro). */
export const MOTIVOS_OPCOES = { exercida: "put exercida", chamada: "moeda chamada", caro: "prêmio caro", barato: "prêmio barato", semDados: "sem a realizada" };

const din = (v, o) => us(v, o);
const n1 = (x, c = 1) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: c });
const de10 = (j) => Math.round(((j.vence ?? j.venceCdi ?? 0) / Math.max(1, j.n)) * 10);
const contraNome = (j) => j?.contra?.nome || "CDI";
const semanasTxt = (n) => (n == null ? "" : `${n1(n, n < 10 ? 1 : 0)} ${n === 1 ? "semana" : "semanas"}`);

/** A frase das janelas: "ganhou do USDC na Aave em 6 de cada 10 janelas de 30 dias". */
export function textoJanelas(j, curto = false) {
  if (!j || !j.n) return "";
  const x = de10(j), quem = contraNome(j);
  if (curto) return `ganhou do ${quem} em ${x} de 10 janelas de ${j.dias || 30} dias`;
  return `Ganhou do ${quem} em ${x} de cada 10 janelas de ${j.dias || 30} dias (${j.vence ?? j.venceCdi} de ${j.n}).`;
}

/** A frase do empate: "Os prêmios já pagaram tudo, com US$ 12,30 de sobra" ou "faltam ~8 semanas de prêmio". */
export function textoEmpate(em, curto = false) {
  if (!em) return "";
  if (em.jaPagou) return curto ? "os prêmios já pagaram" : `Os prêmios (e os juros) já pagaram as taxas e o que venceu dentro, com ${din(em.sobra)} de sobra.`;
  if (em.semanasParaRecuperar == null) return curto ? "atrás, sem prêmio médio" : `Os vencimentos ruins e as taxas passaram os prêmios em ${din(-em.sobra)}.`;
  return curto ? `faltam ~${semanasTxt(em.semanasParaRecuperar)} de prêmio` : `Os vencimentos ruins e as taxas passaram os prêmios em ${din(-em.sobra)}: no prêmio médio de ${din(em.premioSemana)} por semana, faltam ~${semanasTxt(em.semanasParaRecuperar)} para recuperar.`;
}

/** Como está indo: a conta por dentro da versão (ao vivo ou no teste no passado), com o empate. */
export function contaPorDentro(el, a, v, { hist = false } = {}) {
  const x = a?.extra?.porDentro;
  if (!x) return;
  const regua = v.grupo === "Referência";
  const s = secao(el, `A conta por dentro ${q("porDentroOpcoes")}`, `${escapar(v.nome)} · ${hist ? "teste no passado" : "ao vivo"}`, "fi-ts-pordentro fi-ts-pd-opcoes");
  const linhas = [];
  if (!regua) {
    linhas.push([`Prêmios ${q("premio")}`, x.premios || 0, `${a.extra?.vendas || 0} ${a.extra?.vendas === 1 ? "opção vendida" : "opções vendidas"}`]);
    linhas.push(["Pago no vencimento", -(x.pagos || 0), "as que terminaram dentro"]);
    if (x.recompras) linhas.push(["Recompras", -x.recompras, "fechou antes de vencer"]);
  }
  linhas.push(["Taxas", -(x.taxas || 0), regua ? "comprar a moeda" : "Deribit e a compra da moeda"]);
  if (x.entrega) linhas.push(["Taxa de entrega", -x.entrega, "nos vencimentos dentro"]);
  if (x.aave || x.juros) {
    linhas.push([`Juros da Aave ${q("garantiaRendendo")}`, x.juros || 0, "o dólar parado rendendo"]);
    linhas.push(["Saque e gás da Aave", -(x.aave || 0), "pôr e tirar o dólar de lá"]);
  }
  if (x.emAberto) linhas.push(["Opções em aberto", x.emAberto, "o que custaria recomprar agora"]);
  if (Math.abs(x.preco || 0) >= 0.01 || a.extra?.naMoeda) linhas.push(["Preço da moeda", x.preco || 0, "a moeda que a conta segura ou segurou"]);
  const pos = (n) => Math.max(0, n || 0), neg = (n) => Math.max(0, -(n || 0));
  const ganhos = pos(x.premios) + pos(x.juros) + pos(x.preco);
  const perdas = (x.pagos || 0) + (x.recompras || 0) + (x.custos || 0) + neg(x.emAberto) + neg(x.preco);
  const tot = Math.max(ganhos, perdas, 1e-9);
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-pd-lista">${linhas.map(([n, val, sub]) => `<li><span><b>${n}</b><small>${sub}</small></span><b class="${classe(val)}">${din(val, { sinal: true })}</b></li>`).join("")}
      <li class="fi-ts-pd-total"><span><b>Resultado</b><small>desde o começo</small></span><b class="${classe(x.resultado)}">${din(x.resultado || 0, { sinal: true })}</b></li></ul>
    <div class="fi-ts-pd-barras" aria-hidden="true"><span><small>ganhou</small><i class="sobe" style="--w:${Math.round(ganhos / tot * 1000) / 10}%"></i><b>${din(ganhos)}</b></span><span><small>perdeu</small><i class="desce" style="--w:${Math.round(perdas / tot * 1000) / 10}%"></i><b>${din(perdas)}</b></span></div>`);
  const em = a?.extra?.empate;
  if (em) s.insertAdjacentHTML("beforeend", `<p class="fi-ts-pd-empate fi-ts-op-empate ${em.jaPagou ? "ok" : "ruim"}">${textoEmpate(em)}${em.semanas != null ? ` As taxas custam ~${semanasTxt(em.semanas)} de prêmio.` : ""} ${q("empateOpcoes")}</p>`);
}

/** Como está indo: a pior semana (o vencimento que mais custou). */
export function secaoPiorSemana(el, a, v) {
  const p = a?.extra?.piorSemana;
  if (!p) return;
  const s = secao(el, `A pior semana ${q("piorSemana")}`, `${escapar(v.nome)} · ${p.semanas} ${p.semanas === 1 ? "vencimento" : "vencimentos"}`, "fi-ts-op-pior");
  const apagou = p.semanasDePremio;
  s.insertAdjacentHTML("beforeend", `<div class="fi-tiles fi-ts-tiles">
      <span class="${p.perda > 0 ? "fi-ts-ruim" : ""}"><small>Perda</small><b class="${p.perda > 0 ? "ts-desce" : ""}">${din(-p.perda)}</b><small>vendida ${dataCurta(p.de)} · venceu ${dataCurta(p.vence)}</small></span>
      <span><small>Prêmio médio</small><b>${p.premioMedio != null ? din(p.premioMedio) : "—"}</b><small>por semana, já sem a taxa</small></span>
      <span class="${apagou != null && apagou >= 10 ? "fi-ts-ruim" : ""}"><small>Apagou</small><b>${apagou != null ? semanasTxt(apagou) : p.perda > 0 ? "—" : "nada"}</b><small>de prêmio médio</small></span></div>
    <p class="fi-dica">${p.perda > 0 ? `Vender opções ganha pouco quase sempre e perde muito de vez em quando: uma semana assim levou ${apagou != null ? `o prêmio de ${semanasTxt(apagou)}` : "mais do que os prêmios"}.` : "Nenhum vencimento terminou no prejuízo até aqui."}</p>`);
}

/** Como está indo: o prêmio caro (a última decisão e a de agora). */
export function secaoFiltro(el, f, v, a) {
  const fl = a?.extra?.filtro, agora = f?.config?.vrp?.agora?.[v.moeda || "BTC"], min = f?.config?.vrp?.minimo ?? fl?.minimo ?? 1.2;
  if (v.grupo !== "Prêmio caro" || (!fl && !agora)) return;
  const s = secao(el, `Prêmio caro? ${q("premioCaro")}`, `vende só com a implícita ≥ ${n1(min, 1)} × a realizada`, "fi-ts-op-filtro");
  const linha = (x, rot) => x && x.razao != null ? `<li class="${x.caro ?? x.vendeu ? "fi-ts-ok" : ""}"><span><b>${rot}</b><small>implícita ${pctSem(x.iv, 0)} ${q("volImplicita")} × realizada de ${f?.config?.vrp?.dias || 30} dias ${pctSem(x.rv, 0)} ${q("volRealizada")}${x.rv7 ? ` · de 7 dias ${pctSem(x.rv7, 0)}` : ""}</small></span><b>${n1(x.razao, 2)}× · ${x.caro ?? x.vendeu ? "caro: vende" : "barato: fica de fora"}</b></li>` : "";
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${linha(agora, "Agora")}${linha(fl?.ultima, `Última sexta${fl?.ultima?.em ? ` (${dataCurta(new Date(fl.ultima.em).toISOString().slice(0, 10))})` : ""}`)}
    ${fl ? `<li><span><b>Semanas</b><small>desde o começo</small></span><b>vendeu ${fl.vendeu} · de fora ${fl.fora}</b></li>` : ""}</ul>
    <p class="fi-dica">Nas semanas de fora, o dólar continua rendendo na Aave.</p>`);
}

/** Como está indo: o teste de estresse (as opções abertas agora, ou as que a versão venderia agora). */
export function secaoEstresse(el, v) {
  const e = v?.estresse;
  if (!e?.choques?.length) return;
  const s = secao(el, `Teste de estresse ${q("estresseOpcoes")}`, `${escapar(v.nome)} · num fim de semana${e.base === "teorica" ? " · com as opções que venderia agora" : " · com as opções abertas"}`, "fi-ts-op-estresse");
  const li = (c) => {
    const ganho = c.perda < 0;
    return `<li class="${c.perdaPct >= 0.15 ? "fi-ts-ruim" : ""}" data-choque="${c.variacao}"><span><b>${v.moeda === "ETH" ? "Ether" : "Bitcoin"} ${c.variacao > 0 ? "+" : "−"}${pctSem(Math.abs(c.variacao), 0)}</b><small>${ganho ? "a conta ganha (o ganho fica limitado pela call)" : c.semanasDePremio != null ? `apaga ~${semanasTxt(c.semanasDePremio)} de prêmio` : "perda"}</small></span><b class="${classe(-c.perda)}">${din(-c.perda, { sinal: true })} · ${pct(-c.perdaPct, 1)}</b></li>`;
  };
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${e.choques.map(li).join("")}</ul>
    <p class="fi-dica">Conta de "e se": a moeda a ${din(e.preco)} muda de uma vez, passam ${e.dias || 2} dias e a volatilidade sobe ${pctSem((e.vol?.queda || 1.3) - 1, 0)} na queda${e.choques.some(c => c.variacao > 0) ? ` (${pctSem((e.vol?.alta || 1.1) - 1, 0)} na alta)` : ""}. ${e.premioSemana ? `Prêmio médio de ${din(e.premioSemana)} por semana ${e.premioFonte === "passado" ? "no teste no passado" : "ao vivo"}.` : ""}</p>`);
}

/** Como está indo: as janelas de 30 dias do teste no passado, contra a régua certa da versão. */
export function secaoJanelas(el, v) {
  const j = v?.historico?.janelas;
  if (!j || !j.n) return;
  const s = secao(el, `Janelas de ${j.dias || 30} dias ${q("janelas")}`, `teste no passado · contra ${escapar(contraNome(j))}`, "fi-ts-janelas fi-ts-op-janelas");
  const x = de10(j), ref = (o) => o?.ref ?? o?.cdi ?? 0;
  s.insertAdjacentHTML("beforeend", `<p class="fi-ts-jan-frase"><b class="${x >= 5 ? "ts-sobe" : "ts-desce"}">${x} de 10</b> ${textoJanelas(j).replace(/^Ganhou/, "ganhou").replace(/ \(.*$/, "")}</p>
    <div class="fi-ts-jan-pontos" role="img" aria-label="${j.vence ?? j.venceCdi} de ${j.n} janelas acima">${(j.lista || []).map(([d, r, c]) => `<i class="${(1 + r) > (1 + c) ? "sim" : "nao"}" title="${dataCurta(d)}: ${pct(r, 2)} (${escapar(contraNome(j))} ${pct(c, 2)})"></i>`).join("")}</div>
    <ul class="fi-ts-lista">
      <li><span><b>Mediana</b><small>a janela do meio</small></span><b class="${classe(j.mediana)}">${pct(j.mediana, 2)}</b></li>
      <li><span><b>Pior janela</b><small>a partir de ${dataCurta(j.pior?.de)} · ${escapar(contraNome(j))} ${pct(ref(j.pior), 2)}</small></span><b class="${classe(j.pior?.retorno)}">${pct(j.pior?.retorno ?? 0, 2)}</b></li>
      <li><span><b>Melhor janela</b><small>a partir de ${dataCurta(j.melhor?.de)} · ${escapar(contraNome(j))} ${pct(ref(j.melhor), 2)}</small></span><b class="${classe(j.melhor?.retorno)}">${pct(j.melhor?.retorno ?? 0, 2)}</b></li></ul>
    <p class="fi-dica">Cada ponto é uma janela (verde: passou ${escapar(contraNome(j))} no mesmo período). ${j.contra?.id === "usdc" ? "A put guarda dólar: a régua é o mesmo dólar rendendo na Aave." : /^seg/.test(j.contra?.id || "") ? "A call coberta segura a moeda: a régua é só segurar a moeda." : "A régua é o CDI."}</p>`);
}

/** Teste no passado: de onde veio o sorriso (medido na cadeia ou a curva padrão). */
export function notaSorriso(el, f, v) {
  const s = f?.config?.sorriso?.[v?.moeda || "BTC"];
  if (!s || v?.grupo === "Referência") return;
  const p15 = s.put?.["0.15"], c15 = s.call?.["0.15"];
  el.insertAdjacentHTML("beforeend", `<p class="fi-dica fi-ts-op-sorriso">Sorriso ${q("sorriso")}: ${s.fonte === "cadeia" ? `medido na cadeia da Deribit (${s.n} ${s.n === 1 ? "medida" : "medidas"})` : "curva padrão (ainda sem medida da cadeia)"}${p15 ? ` · put de delta 0,15 a ${n1(p15, 2)}× o DVOL` : ""}${c15 ? `, call a ${n1(c15, 2)}×` : ""}. Venda pela oferta de compra estimada ${q("spread")}.</p>`);
}

/** Versões: a linha das janelas e do empate de cada versão, na própria linha do ranking. */
export function marcarVersoes(s0, f) {
  for (const li of s0.querySelectorAll(".fi-ts-rank li[data-v]")) {
    const v = (f.versoes || []).find(x => x.id === li.dataset.v), tx = li.querySelector(".tx");
    if (!v || !tx || li.querySelector(".fi-ts-op-linha")) continue;
    const j = v.historico?.janelas, ps = v.historico?.extra?.piorSemana;
    const partes = [];
    if (j?.n) partes.push(`<span class="${de10(j) >= 5 ? "ok" : "ruim"}">${textoJanelas(j, true)}</span>`);
    if (ps?.semanasDePremio != null && ps.perda > 0) partes.push(`<span class="${ps.semanasDePremio >= 10 ? "ruim" : ""}">pior semana apagou ${semanasTxt(ps.semanasDePremio)}</span>`);
    if (v.semDados) partes.push(`<span class="ruim">${escapar(v.semDados)}</span>`);
    if (partes.length) tx.insertAdjacentHTML("beforeend", `<small class="fi-ts-op-linha">${partes.join(" · ")}</small>`);
  }
}

/** Os números novos para os quadradinhos (tiles) de Como está indo. */
export function tilesOpcoes(x) {
  const it = [];
  if (x.fase) it.push(`<span class="${x.fase === "call" ? "fi-ts-ok" : ""}"><small>Fase da roda ${q("roda")}</small><b>${x.fase === "call" ? "Call sobre a moeda" : "Put em dólar"}</b><small>exercida ${x.exercidas || 0}× · chamada ${x.chamadas || 0}×</small></span>`);
  if (x.filtro) {
    const u = x.filtro.ultima;
    it.push(`<span class="${u && u.vendeu === false ? "" : "fi-ts-ok"}"><small>Prêmio caro ${q("premioCaro")}</small><b>${u ? (u.vendeu ? "vendeu" : "ficou de fora") : "esperando a sexta"}</b><small>${u?.razao != null ? `implícita ${n1(u.razao, 2)}× a realizada · ` : ""}${x.filtro.vendeu} vendidas · ${x.filtro.fora} de fora</small></span>`);
  }
  if (x.juroAgora != null && x.juros != null) it.push(`<span><small>Juros da garantia ${q("garantiaRendendo")}</small><b class="ts-sobe">${din(x.juros)}</b><small>a ${pct(x.juroAgora, 2)} ao ano agora</small></span>`);
  return it;
}
