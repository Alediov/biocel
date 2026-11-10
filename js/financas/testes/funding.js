// Testes de mercado → Funding: as partes da revisão de 09/11/2026 (pedido do Alediov, pelos 6 primeiros dias ao vivo:
// quase tudo entre −0,08% e +0,02% contra o CDI em +0,2%). Formato em tools/papel/FORMATO.md do orbita-testes,
// "funding": a conta por dentro (`extra.porDentro` de cada conta), o teste fora da amostra dos limites
// (`foraDaAmostra`) e o observatório das moedas fora da lista (`observatorio`, só observando, sem conta). Com o
// funding.json antigo (sem essas chaves) as seções somem ou dizem que começam nas próximas rodadas.
// As versões novas (Caixa na Aave, Mais cuidadosas) entram pelas partes de sempre de formas.js, pelo `grupo`.
import { escapar } from "../../ui.js";
import * as K from "./calculo.js";
import { secao, graficoComRefs, q, classe, pct, pctSem, us, dataCurta, GLOSSARIO } from "./comum.js";
import { heroiEstimativa } from "./subabas.js";

// os termos novos (só se ainda não existirem: o GLOSSARIO é de todas as formas)
const TERMOS = {
  porDentro: ["A conta por dentro", "De onde veio cada centavo da conta: o financiamento que entrou e saiu, o juro da Aave, as taxas da corretora, o deslize (o preço pior que a ordem pega), a ponte e o gás, as liquidações e o resto (o preço das duas pernas e a base)."],
  empate: ["Empate", "Quantos dias, no ritmo da última semana (financiamento + juros por dia), faltam para o que entrou cobrir o que saiu em taxas. \"Já cobriu\" = a conta já pagou a entrada; \"não empata\" = no ritmo de agora ela paga mais do que recebe."],
  deslize: ["Deslize", "A diferença entre o preço da tela e o preço que a ordem a mercado realmente pega (a fila de ordens tem pouco em cada preço). O papel cobra um deslize fixo por moeda em cada perna."],
  caixaAave: ["Caixa na Aave", "Quando a versão está fora, o dinheiro vai para o empréstimo de dólar da Aave (na rede Base) e rende o juro do dia. Ir custa o saque da corretora, a ponte e o gás (uns US$ 1,45 em US$ 1.000); voltar, uns US$ 0,50."],
  compensa: ["Só quando compensa", "Só entra se o financiamento previsto (a média das últimas 8 horas) paga as taxas de entrar e sair em até 14 dias. No bitcoin isso pede uns 9% ao ano; no HYPE e no solana, uns 14%. Fica pelo menos 3 dias."],
  rodizioCalmo: ["Rodízio calmo", "Como o rodízio, mas só troca de moeda quando a outra paga 5 pontos ao ano a mais por 3 dias seguidos e essa diferença paga a troca em até 14 dias. O rodízio antigo continua para comparar."],
  foraFunding: ["Teste fora da amostra (funding)", "Os limites da seletiva (entra e sai) e a diferença do rodízio escolhidos sem olhar o futuro: a cada segunda, a regra testa uma grade pequena de limites nas 8 semanas anteriores, fica com o que mais rendeu e anda a semana seguinte com ele. É aproximado (180 dias de dados)."],
  otimistaGrade: ["Melhor da grade (otimista)", "Os limites que mais renderam no período inteiro, escolhidos olhando para trás. Ninguém saberia isso antes: serve para ver o quanto escolher pelo passado engana."],
  soObservando: ["Só observando", "Moedas da corretora fora das 4 do teste, com o financiamento mais alto da semana. Não há conta nenhuma, nem no papel: moedas pequenas pagam muito porque são arriscadas, e muitas nem têm à vista para montar as duas pernas."],
};
for (const [k, v] of Object.entries(TERMOS)) if (!GLOSSARIO[k]) GLOSSARIO[k] = v;

export const SUB_MAIS = ["fmais", "Mais testes", "🔬"];
/** As partes do funding: as de sempre + Mais testes (o fora da amostra e o observatório). */
export const subsFunding = (subs) => [...subs.filter(x => x[0] !== SUB_MAIS[0]), SUB_MAIS];
export const ehSubFunding = (k) => k === SUB_MAIS[0];

const refs = (p) => { const r = p?.indice?.ref || {}; return { referencias: { btc: r.btc || [], cdi: r.cdi || [], cdiAno: r.cdiAno ?? null, cdiFonte: r.cdiFonte ?? null } }; };
const din = (v, o) => us(v, o);
const dias1 = (x) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: x < 10 ? 1 : 0 });

/** A frase do empate (para o cartão e para a linha da versão). */
export function textoEmpate(x, curto = false) {
  if (!x) return "";
  if (x.empateDias === 0) return curto ? "custos já cobertos" : "O que entrou já cobriu tudo o que saiu em taxas.";
  if (x.empateDias == null) return curto ? "não empata neste ritmo" : `No ritmo da última semana${x.ritmoDia != null ? ` (${din(x.ritmoDia, { sinal: true })} por dia)` : ""}, a conta não empata: paga mais do que recebe.`;
  return curto ? `empate em ~${dias1(x.empateDias)} dias` : `Faltam ~${dias1(x.empateDias)} dias, no ritmo da última semana (${din(x.ritmoDia || 0, { sinal: true })} por dia), para o que entrou cobrir o que saiu.`;
}

/** Como está indo: a conta por dentro da versão (ao vivo ou no teste no passado). */
export function contaPorDentro(el, a, v, f, { hist = false } = {}) {
  const x = a?.extra?.porDentro;
  if (!x) return;
  const s = secao(el, `A conta por dentro ${q("porDentro")}`, `${escapar(v.nome)} · ${hist ? "teste no passado" : "ao vivo"}`, "fi-ts-pordentro");
  const linhas = [
    ["Financiamento recebido", x.recebido, `${q("funding")}`],
    ["Financiamento pago", -(x.pago || 0), "quando a taxa fica negativa"],
  ];
  if (x.naAave != null || x.juros) linhas.push([`Juros da Aave ${q("caixaAave")}`, x.juros || 0, x.naAave ? "o dinheiro está lá agora" : "enquanto esteve fora"]);
  linhas.push(["Taxas da corretora", -(x.taxas || 0), x.reequilibrio ? `com ${din(x.reequilibrio)} de reequilíbrios` : "entrar, sair e trocar"]);
  linhas.push([`Deslize ${q("deslize")}`, -(x.deslize || 0), "o preço pior que a ordem pega"]);
  if (x.ponte || x.naAave != null) linhas.push([v.id === "entre" ? "Ponte entre corretoras" : "Saque, ponte e gás", -(x.ponte || 0), v.id === "entre" ? "mandar dólar de uma à outra" : "ir e voltar da Aave"]);
  if (x.liquidacoes) linhas.push([`Liquidações ${q("liquidacao")}`, -x.liquidacoes, "margem perdida"]);
  linhas.push([`Preço e base ${q("base")}`, x.resto || 0, "as duas pernas não andam igual"]);
  const ganhos = Math.max(0, (x.recebido || 0) + (x.juros || 0)), custos = (x.pago || 0) + (x.custos || 0) + (x.liquidacoes || 0);
  const tot = Math.max(ganhos, custos, 1e-9);
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-pd-lista">${linhas.map(([n, val, sub]) => `<li><span><b>${n}</b><small>${sub}</small></span><b class="${classe(val)}">${din(val, { sinal: true })}</b></li>`).join("")}
      <li class="fi-ts-pd-total"><span><b>Resultado</b><small>desde o começo</small></span><b class="${classe(x.resultado)}">${din(x.resultado || 0, { sinal: true })}</b></li></ul>
    <div class="fi-ts-pd-barras" aria-hidden="true"><span><small>entrou</small><i class="sobe" style="--w:${Math.round(ganhos / tot * 1000) / 10}%"></i><b>${din(ganhos)}</b></span><span><small>saiu</small><i class="desce" style="--w:${Math.round(custos / tot * 1000) / 10}%"></i><b>${din(custos)}</b></span></div>
    <p class="fi-ts-pd-empate ${x.empateDias === 0 ? "ok" : x.empateDias == null ? "ruim" : ""}">${q("empate")} ${textoEmpate(x)}</p>`);
  const ja = f?.config?.caixa?.juroAgora;
  if (x.naAave != null && ja != null) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">O juro do dólar na Aave agora: ${pct(ja, 1)} ao ano.</p>`);
}

/** Versões: o empate de cada versão, na própria linha do ranking. */
export function marcarEmpates(s0, f, modo) {
  for (const li of s0.querySelectorAll(".fi-ts-rank li[data-v]")) {
    const v = (f.versoes || []).find(x => x.id === li.dataset.v), a = modo === "hist" ? v?.historico : v?.aoVivo, x = a?.extra?.porDentro;
    if (!x || li.querySelector(".fi-ts-empate")) continue;
    li.querySelector(".tx")?.insertAdjacentHTML("beforeend", `<small class="fi-ts-empate ${x.empateDias === 0 ? "ok" : x.empateDias == null ? "ruim" : ""}">taxas ${din((x.custos || 0) + (x.liquidacoes || 0))} · ${textoEmpate(x, true)}</small>`);
  }
}

// ------------------------------------------------------------------ Mais testes
export function telaMaisFunding(el, ctx, f) {
  secaoFora(el, ctx, f);
  secaoObservando(el, f);
}

const limites = (r, x) => (r.id === "seletiva" ? `entra ${pctSem(x.entra)} · sai ${pctSem(x.sai)}` : `troca com ${pctSem(x.dif)} a mais`);

function secaoFora(el, ctx, f) {
  const fa = f.foraDaAmostra;
  if (!fa || !Array.isArray(fa.regras) || !fa.regras.length) {
    const s = secao(el, `Teste fora da amostra ${q("foraFunding")}`, `<i class="fi-ts-aprox">aproximado</i>`, "fi-ts-ffora");
    s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Ainda não rodou: sai quando o teste no passado for refeito (uma vez por semana).</p>`);
    return;
  }
  const rf = refs(ctx.p);
  for (const r of fa.regras) {
    const s = secao(el, `Fora da amostra · ${escapar(r.nome)} ${q("foraFunding")}`, `<i class="fi-ts-aprox">aproximado</i> ${dataCurta(fa.de)} a ${dataCurta(fa.ate)}`, "fi-ts-ffora");
    s.dataset.regra = r.id;
    const t = r.conta?.serie?.length ? K.trecho(r.conta, "tudo", null) : null;
    if (!t) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Sem dias medidos.</p>`); continue; }
    heroiEstimativa(s, rf, t, { titulo: `${escapar(r.nome)} com os limites escolhidos a cada segunda`, ops: Number.POSITIVE_INFINITY, metricas: r.conta.metricas || null });
    const m = r.melhorNoPeriodo || {};
    s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-ffora-cmp">
        <li><span><b>Fora da amostra</b><small>escolha só com as 8 semanas de antes</small></span><b class="${classe(t.retorno)}">${pct(t.retorno, 2)}</b></li>
        <li><span><b>Regra de sempre</b><small>${limites(r, r.fixa || {})}, no mesmo período</small></span><b class="${classe(r.fixaNoPeriodo)}">${pct(r.fixaNoPeriodo ?? 0, 2)}</b></li>
        <li class="otimista"><span><b>Melhor da grade ${q("otimistaGrade")}</b><small>${limites(r, m)}, escolhida olhando para trás</small></span><b class="${classe(m.retorno)}">${pct(m.retorno ?? 0, 2)}</b></li></ul>
      <p class="fi-dica">${fa.semanas} ${fa.semanas === 1 ? "semana" : "semanas"}; em ${r.trocas || 0} a escolha foi diferente da regra de sempre.</p>`);
    graficoComRefs(s, rf, "Fora da amostra", t.pts);
    const es = (r.escolhas || []).slice().reverse();
    if (es.length) {
      const d = document.createElement("details"); d.className = "fi-ts-ffora-escolhas";
      d.innerHTML = `<summary>As escolhas, uma por segunda (${es.length})</summary><ul class="fi-ts-lista">${es.map(e => `<li><span><b>${dataCurta(e.de)}</b><small>${limites(r, e)}</small></span><b class="${classe(e.treino)}">${pct(e.treino ?? 0, 2)}<small>nas 8 semanas antes</small></b></li>`).join("")}</ul>`;
      s.append(d);
    }
  }
  el.insertAdjacentHTML("beforeend", `<p class="fi-dica fi-ts-ffora-nota">${escapar(fa.nota || "")} O "teste no passado" das versões usa os limites de sempre, escolhidos antes destes dados.</p>`);
}

function secaoObservando(el, f) {
  const o = f.observatorio;
  const s = secao(el, `Só observando ${q("soObservando")}`, "moedas fora da lista · sem conta", "fi-ts-fobs");
  s.insertAdjacentHTML("beforeend", `<p class="fi-ts-otimista fi-ts-fobs-aviso" role="note">👀 <b>Nenhuma conta aqui</b>, nem no papel: só o financiamento das moedas que mais pagaram na semana.</p>`);
  const ms = Array.isArray(o?.moedas) ? o.moedas : [];
  if (!ms.length) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">${o ? "Nenhuma moeda passou no volume mínimo nesta rodada." : "Começa na próxima rodada (a cada 6 h)."}</p>`); return; }
  const a = (x) => (x == null ? "—" : pct(x, 1));
  const vol = (v) => (v >= 1e9 ? `US$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi` : `US$ ${Math.round(v / 1e6).toLocaleString("pt-BR")} mi`);
  const alta = (m) => (m.altaTodoPeriodo ? `alta há ${o.criterio?.dias || 14}+ dias` : m.altaDias ? `alta há ${m.altaDias} ${m.altaDias === 1 ? "dia" : "dias"}${m.altaDesde ? ` (desde ${dataCurta(K.diaDe(m.altaDesde))})` : ""}` : "subiu agora");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-fobs-lista">${ms.map(m => `<li data-moeda="${escapar(m.moeda)}"><span><b>${escapar(m.moeda)}</b><small>3 dias ${a(m.ano3d)} · agora ${a(m.agora)} · ${alta(m)}</small><small>volume ${vol(m.volumeDia || 0)} por dia${m.negativas7d ? ` · ${pctSem(m.negativas7d)} das horas negativas` : ""}</small></span><b class="${classe(m.ano7d)}">${a(m.ano7d)}<small>7 dias, ao ano</small></b></li>`).join("")}</ul>
    <p class="fi-dica">${o.candidatas ?? "?"} moedas fora das 4 do teste tinham volume de ${vol(o.criterio?.volumeMin || 5e6)} ou mais por dia; aqui as ${ms.length} de maior média de 7 dias. "Alta" = a média do dia acima de ${pctSem(o.criterio?.alta ?? 0.1)} ao ano. ${escapar(o.nota || "")}</p>`);
}
