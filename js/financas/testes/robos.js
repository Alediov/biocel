// Testes de mercado → Robôs: as partes da revisão de 09/11/2026 (pedido do Alediov, pelos 6 primeiros dias ao vivo).
// Formato em tools/papel/FORMATO.md do orbita-testes, "robôs": a conta por dentro (`extra.porDentro` de cada conta), as
// janelas de 30 dias do teste no passado (`historico.janelas`), a moeda sem dados (`semDados`) e os números novos das
// versões (grade com saída, pela oscilação, caixa na Aave). As réguas (Só segurar BTC/ETH) entram pelo grupo
// "Referência" de formas.js. Com o robos.json antigo (sem essas chaves) as seções somem.
import { escapar } from "../../ui.js";
import { secao, q, classe, pct, pctSem, us, dataCurta, GLOSSARIO } from "./comum.js";

// os termos novos (só se ainda não existirem: o GLOSSARIO é de todas as formas)
const TERMOS = {
  porDentroRobo: ["A conta por dentro (robôs)", "De onde veio o resultado: o lucro dos pares que a grade fechou (comprou num degrau e vendeu no de cima, antes das taxas) ou dos ciclos do DCA com proteção, o ganho ou a perda da moeda que a conta ainda segura (o preço), o financiamento do perpétuo, o juro da Aave, as taxas, o deslize e as liquidações."],
  janelas: ["Janelas de 30 dias", "O teste no passado cortado em pedaços de 30 dias, um começando a cada 7 dias. Cada pedaço é comparado com o CDI do mesmo período. \"Ganhou do CDI em 7 de 10\" quer dizer que, entrando num dia qualquer e saindo 30 dias depois, o robô passou o CDI 7 vezes em cada 10: mostra se o resultado dos 180 dias dependeu de um mês de sorte."],
  gradeSaida: ["Grade com saída", "A grade neutra que fecha tudo quando o preço passa um degrau além da grade ou a conta cai 15% do melhor momento, e só monta de novo quando o preço acalma: depois de um dia, com menos de 4% de vai e vem nas últimas 24 horas. Evita ficar presa numa tendência, mas paga a saída e a volta."],
  gradeOscilacao: ["Grade pela oscilação", "A largura da grade segue o quanto o preço anda num dia normal da última semana (a oscilação), vezes 2 ou 4. Toda segunda a oscilação é medida de novo e a grade é remontada em volta do preço, pagando a troca."],
  segurar: ["Só segurar", "Régua: compra a moeda com os US$ 1.000 no primeiro dia e não faz mais nada. Se o robô não ganha dela, comprar e esperar teria sido melhor (e mais simples)."],
  tudoDia1: ["Tudo no dia 1", "A régua do DCA: pôr de uma vez, no primeiro dia, o total que o DCA compra aos poucos (US$ 50 por semana, 20 semanas = US$ 1.000). É o mesmo que só segurar bitcoin, por isso as duas são uma régua só."],
  caixaAave: ["Caixa na Aave", "O dinheiro que espera a vez fica no empréstimo de dólar da Aave (na rede Base) e rende o juro do dia. Ir custa o saque da corretora, a ponte e o gás (uns US$ 1,45 em US$ 1.000); cada volta, uns US$ 0,10 mais 0,04% do valor."],
};
for (const [k, v] of Object.entries(TERMOS)) if (!GLOSSARIO[k]) GLOSSARIO[k] = v;
export const TERMOS_ROBOS = ["grade", "dca", "perpetuo", "gradeSaida", "gradeOscilacao", "janelas", "porDentroRobo", "segurar", "tudoDia1", "caixaAave"];

const din = (v, o) => us(v, o);
const de10 = (j) => Math.round((j.venceCdi / Math.max(1, j.n)) * 10);

/** A frase das janelas: "ganhou do CDI em 7 de cada 10 janelas de 30 dias". */
export function textoJanelas(j, curto = false) {
  if (!j || !j.n) return "";
  const x = de10(j);
  if (curto) return `ganhou do CDI em ${x} de 10 janelas de ${j.dias || 30} dias`;
  return `Ganhou do CDI em ${x} de cada 10 janelas de ${j.dias || 30} dias (${j.venceCdi} de ${j.n}).`;
}

/** Como está indo: a moeda sem dados (o motivo no lugar do número). */
export function avisoSemDados(el, v) {
  if (!v?.semDados) return;
  el.insertAdjacentHTML("beforeend", `<p class="fi-ts-atraso fi-ts-semdados" role="note">⚠ ${escapar(v.semDados)}</p>`);
}

/** Como está indo: a conta por dentro da versão (ao vivo ou no teste no passado). */
export function contaPorDentro(el, a, v, { hist = false } = {}) {
  const x = a?.extra?.porDentro;
  if (!x) return;
  const s = secao(el, `A conta por dentro ${q("porDentroRobo")}`, `${escapar(v.nome)} · ${hist ? "teste no passado" : "ao vivo"}`, "fi-ts-pordentro fi-ts-pd-robo");
  const ciclos = a?.extra?.ciclos != null;
  const linhas = [];
  if (x.pares || /^g/.test(v.id) || ciclos) linhas.push([ciclos ? "Ciclos fechados" : `Pares fechados ${q("grade")}`, x.pares || 0, ciclos ? "vendeu tudo com lucro (antes das taxas)" : "comprou num degrau e vendeu no de cima (antes das taxas)"]);
  linhas.push(["Preço", x.preco || 0, "a moeda que a conta segura ou segurou"]);
  if (x.financiamento) linhas.push([`Financiamento ${q("funding")}`, x.financiamento, x.financiamento >= 0 ? "recebido no perpétuo" : "pago no perpétuo"]);
  if (x.juros || a?.extra?.naAave != null) linhas.push([`Juros da Aave ${q("caixaAave")}`, x.juros || 0, "o caixa que espera a vez"]);
  linhas.push(["Taxas da corretora", -(x.taxas || 0), "cada compra e venda"]);
  if (x.deslize || !x.estimado) linhas.push([`Deslize ${q("deslize")}`, -(x.deslize || 0), "o preço pior das ordens a mercado"]);
  if (x.ponte) linhas.push(["Saque, ponte e gás", -x.ponte, "ir e voltar da Aave"]);
  if (x.liquidacoes) linhas.push([`Liquidações ${q("liquidacao")}`, -x.liquidacoes, "margem perdida"]);
  const pos = (n) => Math.max(0, n || 0), neg = (n) => Math.max(0, -(n || 0));
  const ganhos = pos(x.pares) + pos(x.preco) + pos(x.financiamento) + pos(x.juros);
  const perdas = neg(x.pares) + neg(x.preco) + neg(x.financiamento) + (x.custos || 0) + (x.liquidacoes || 0);
  const tot = Math.max(ganhos, perdas, 1e-9);
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-pd-lista">${linhas.map(([n, val, sub]) => `<li><span><b>${n}</b><small>${sub}</small></span><b class="${classe(val)}">${din(val, { sinal: true })}</b></li>`).join("")}
      <li class="fi-ts-pd-total"><span><b>Resultado</b><small>desde o começo</small></span><b class="${classe(x.resultado)}">${din(x.resultado || 0, { sinal: true })}</b></li></ul>
    <div class="fi-ts-pd-barras" aria-hidden="true"><span><small>ganhou</small><i class="sobe" style="--w:${Math.round(ganhos / tot * 1000) / 10}%"></i><b>${din(ganhos)}</b></span><span><small>perdeu</small><i class="desce" style="--w:${Math.round(perdas / tot * 1000) / 10}%"></i><b>${din(perdas)}</b></span></div>`);
  const ganhoGrade = (x.pares || 0) - (x.custos || 0);
  if (/^g/.test(v.id) && x.pares) s.insertAdjacentHTML("beforeend", `<p class="fi-ts-pd-empate ${ganhoGrade >= 0 && (x.preco || 0) >= 0 ? "ok" : (x.resultado || 0) < 0 ? "ruim" : ""}">${ganhoGrade >= 0 ? `Os pares pagaram as taxas com ${din(ganhoGrade)} de sobra` : `As taxas passaram o lucro dos pares em ${din(-ganhoGrade)}`}; o preço da moeda ${(x.preco || 0) >= 0 ? "somou" : "tirou"} ${din(Math.abs(x.preco || 0))}.</p>`);
  if (x.estimado) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Esta conta começou antes de 09/11/2026: taxa e deslize estão juntos em "Taxas" e os pares são estimados.</p>`);
}

/** Como está indo: as janelas de 30 dias do teste no passado (vale nos dois modos: é sempre do teste no passado). */
export function secaoJanelas(el, v) {
  const j = v?.historico?.janelas;
  if (!j || !j.n) return;
  const s = secao(el, `Janelas de ${j.dias || 30} dias ${q("janelas")}`, `teste no passado · uma a cada ${j.passo || 7} dias`, "fi-ts-janelas");
  const x = de10(j);
  s.insertAdjacentHTML("beforeend", `<p class="fi-ts-jan-frase"><b class="${x >= 5 ? "ts-sobe" : "ts-desce"}">${x} de 10</b> ${textoJanelas(j).replace(/^Ganhou/, "ganhou").replace(/ \(.*$/, "")}</p>
    <div class="fi-ts-jan-pontos" role="img" aria-label="${j.venceCdi} de ${j.n} janelas acima do CDI">${(j.lista || []).map(([d, r, c]) => `<i class="${(1 + r) > (1 + c) ? "sim" : "nao"}" title="${dataCurta(d)}: ${pct(r, 1)} (CDI ${pct(c, 1)})"></i>`).join("")}</div>
    <ul class="fi-ts-lista">
      <li><span><b>Mediana</b><small>a janela do meio</small></span><b class="${classe(j.mediana)}">${pct(j.mediana, 1)}</b></li>
      <li><span><b>Pior janela</b><small>a partir de ${dataCurta(j.pior?.de)} · CDI ${pct(j.pior?.cdi ?? 0, 1)}</small></span><b class="${classe(j.pior?.retorno)}">${pct(j.pior?.retorno ?? 0, 1)}</b></li>
      <li><span><b>Melhor janela</b><small>a partir de ${dataCurta(j.melhor?.de)} · CDI ${pct(j.melhor?.cdi ?? 0, 1)}</small></span><b class="${classe(j.melhor?.retorno)}">${pct(j.melhor?.retorno ?? 0, 1)}</b></li></ul>
    <p class="fi-dica">Cada ponto é uma janela (verde: passou o CDI do mesmo período). Também é teste no passado, com as velas de 1 hora.</p>`);
}

/** Versões: as janelas de cada versão (do teste no passado), na própria linha do ranking. */
export function marcarJanelas(s0, f) {
  for (const li of s0.querySelectorAll(".fi-ts-rank li[data-v]")) {
    const v = (f.versoes || []).find(x => x.id === li.dataset.v), j = v?.historico?.janelas;
    if (!j?.n || li.querySelector(".fi-ts-jan-linha")) continue;
    li.querySelector(".tx")?.insertAdjacentHTML("beforeend", `<small class="fi-ts-jan-linha ${de10(j) >= 5 ? "ok" : "ruim"}">${textoJanelas(j, true)}</small>`);
  }
}

/** Os números novos dos robôs para os quadradinhos (tiles) de Como está indo. */
export function tilesRobo(x) {
  const it = [];
  if (x.parada != null) it.push(`<span class="${x.parada ? "fi-ts-ruim" : ""}"><small>Grade ${q("gradeSaida")}</small><b>${x.parada ? "fora" : "montada"}</b><small>${x.parada ? "esperando o preço acalmar" : `remontou ${x.remontes || 0} ${x.remontes === 1 ? "vez" : "vezes"}`}</small></span>`);
  if (x.volDia !== undefined && x.faixaAgora != null) it.push(`<span><small>Largura ${q("gradeOscilacao")}</small><b>±${pctSem(x.faixaAgora, 1)}</b><small>${x.volDia != null ? `oscilação de ${pctSem(x.volDia, 1)} por dia` : "oscilação ainda sem dados"}</small></span>`);
  if (x.naAave != null && x.porDentro) it.push(`<span><small>Na Aave ${q("caixaAave")}</small><b>${din(x.naAave)}</b><small>esperando a vez</small></span>`);
  return it;
}
