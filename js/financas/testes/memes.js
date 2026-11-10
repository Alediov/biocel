// Testes de mercado → Memecoins: as partes da revisão de 09/11/2026 (pedido do Alediov, as 7 melhorias do observatório
// do pump.fun). Formato em tools/papel/FORMATO.md do orbita-testes, "Memecoins": as taxas "de cada 100 lançamentos" com o
// intervalo de Wilson (`observatorio.taxas`), a curva típica de 5 min a 7 dias (`curva`), a tabela dos sinais da hora do
// lançamento (`sinais`), depois da graduação (`graduacao`), as carteiras que chegam cedo (`cedo`, só o endereço encurtado;
// com o olho fechado, "Carteira N"), o medidor de golpe (`golpe`) e os custos que as regras pagam (`custos`, `amostra`).
// As regras novas (`grad1h`, `copia`) entram pelas partes de sempre de formas.js. Com o memes.json antigo (sem essas
// chaves) as seções somem.
import { escapar } from "../../ui.js";
import { secao, q, classe, pct, pctSem, us, GLOSSARIO } from "./comum.js";
import { carteiraSol } from "./oculto.js";

// os termos novos (só se ainda não existirem: o GLOSSARIO é de todas as formas)
const TERMOS = {
  deCada100: ["De cada 100 lançamentos", "Quantos, de cada 100 moedas novas, tiveram cada destino. A faixa clara é o intervalo de 95% (de Wilson): com poucos tokens ela é larga, porque o número ainda pode mudar bastante; com muitos, aperta."],
  intervalo: ["Intervalo de 95%", "A faixa onde o número verdadeiro deve estar, dado o tamanho da amostra (conta de Wilson). Se as faixas de duas linhas se cruzam, a diferença entre elas ainda pode ser sorte."],
  curvaTipica: ["Curva típica", "O preço de cada token dividido pelo do lançamento, em cada momento (1× = o mesmo preço; 0 = ninguém negociou). A linha forte é a mediana (o token do meio); a faixa vai do quartil de baixo ao de cima (metade dos tokens fica dentro dela)."],
  sinal: ["Sinal da hora do lançamento", "Algo que já se sabia nos primeiros minutos: quanto o criador comprou, se houve compras no mesmo bloco, quanto os 10 maiores donos têm, se tem site ou redes, o que o criador já fez. A tabela compara quem tinha o sinal com quem não tinha, só com 20 tokens de cada lado."],
  bundle: ["Bundle", "Compras feitas no MESMO bloco da criação do token, quase sempre de carteiras do próprio criador ou de robôs combinados com ele: chegam antes de qualquer pessoa e costumam vender em cima de quem vem depois."],
  criador: ["Criador", "A carteira que criou o token. O observatório guarda só contagens por endereço (quantos lançou, quantos morreram), nunca nome nem link."],
  concentracao: ["Concentração", "Quanto do total os 10 maiores donos têm (fora a própria curva do pump.fun). Muito na mão de poucos = poucos podem derrubar o preço."],
  curvaLigacao: ["Curva de ligação", "A conta que dá o preço no pump.fun antes da graduação: cada compra deixa a próxima mais cara (x·y = k). Por isso a própria compra de US$ 10 já empurra o preço (o deslize)."],
  gorjeta: ["Gorjeta (Jito)", "Um extra pago aos validadores da Solana para a transação entrar logo. O papel usa a gorjeta mediana dos últimos blocos (medida na Jito); quem disputa o 1º segundo com os robôs paga bem mais."],
  prioridade: ["Taxa de prioridade", "Outro extra por transação, pago por unidade de computação; o papel usa a mediana medida no RPC público da Solana."],
  deslizeCurva: ["Deslize na curva", "Quanto o preço anda por causa da própria compra ou venda. Na curva do pump.fun e no pool depois da graduação sai da conta x·y = k com o tamanho da aposta."],
  carteiraCedo: ["Carteiras que chegam cedo", "As que compraram no 1º minuto de algum token da amostra. Contadas por semana: quantas vezes chegaram cedo e quantas dessas o token depois dobrou. Só o endereço público (encurtado); nenhuma é seguida de verdade."],
  copiarCedo: ["Copiar quem chega cedo", "A regra escolhe, toda segunda, as 10 carteiras que mais acertaram na semana ANTERIOR e, nesta semana, compra 2 minutos depois do lançamento quando uma delas comprou cedo. Escolher com o passado e medir no futuro é o teste fora da amostra."],
  medidorGolpe: ["Medidor de golpe", "Os jeitos de um token terminar em golpe: o criador vende tudo (logo no começo ou em 24 h), o preço cai mais de 90% em minutos, o RugCheck marca risco alto, ou a liquidez do pool some depois da graduação. Um token pode cair em mais de um."],
  graduacaoDepois: ["Depois da graduação", "O que acontece com o preço a partir da formatura (1× = o preço da graduação): a curva típica de 5 minutos a 24 horas e as regras que compram na hora ou 1 hora depois."],
};
for (const [k, v] of Object.entries(TERMOS)) if (!GLOSSARIO[k]) GLOSSARIO[k] = v;
export const TERMOS_MEMES = ["deCada100", "intervalo", "curvaTipica", "sinal", "bundle", "criador", "concentracao", "curvaLigacao", "gorjeta", "prioridade", "deslizeCurva", "carteiraCedo", "copiarCedo", "medidorGolpe", "graduacaoDepois"];

const n1 = (x, c = 1) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: c });
const de100 = (p) => (p == null ? "—" : n1(p * 100, p * 100 < 10 ? 1 : 0));
const faixa = (ic) => (ic ? `${de100(ic[0])} a ${de100(ic[1])}` : "");
const vezes = (x) => (x == null ? "—" : x === 0 ? "0" : x >= 10 ? `${n1(x, 0)}×` : x >= 1 ? `${n1(x, 1)}×` : x >= 0.01 ? `${n1(x, 2)}×` : "~0×");
const minTxt = (m) => (m == null ? "—" : m < 90 ? `${n1(m, m < 10 ? 1 : 0)} min` : `${n1(m / 60, 1)} h`);
const sol = (x) => (x == null ? "—" : `${Number(x).toLocaleString("pt-BR", { maximumSignificantDigits: 2 })} SOL`);
const COR_TAXA = { somem1h: "desce", dobram: "sobe", vale24: "sobe", vale7d: "sobe", dez: "sobe", graduam: "sobe" };

/** Todas as seções novas, na ordem, no Observatório (chamado por formas.js depois das contagens). */
export function secoesObservatorio(el, f) {
  const o = f?.observatorio || {};
  secaoTaxas(el, o);
  secaoCurva(el, o);
  secaoSinais(el, o);
  secaoGraduacao(el, o);
  secaoCedo(el, o);
  secaoGolpe(el, o);
  secaoCustos(el, o);
}

/** "De cada 100 lançamentos": barras com o intervalo de 95%. */
export function secaoTaxas(el, o) {
  const ts = Array.isArray(o.taxas) ? o.taxas.filter(t => t && t.n) : [];
  if (!ts.length) return;
  const n = Math.max(...ts.map(t => t.n));
  const s = secao(el, `De cada 100 lançamentos ${q("deCada100")}`, `${n.toLocaleString("pt-BR")} analisados · faixa de 95% ${q("intervalo")}`, "fi-ts-mm-taxas");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-mm-barras">${ts.map(t => `<li data-k="${escapar(t.id)}" class="${COR_TAXA[t.id] || ""}">
      <span class="nm"><b>${de100(t.p)}</b> ${escapar(t.nome)} <small>${t.k.toLocaleString("pt-BR")} de ${t.n.toLocaleString("pt-BR")}${t.ic ? ` · ${faixa(t.ic)}` : ""}</small>${t.dica ? `<em>${escapar(t.dica)}</em>` : ""}</span>
      <i style="--w:${Math.round((t.p || 0) * 1000) / 10}%;--a:${Math.round((t.ic?.[0] || 0) * 1000) / 10}%;--b:${Math.round((t.ic?.[1] || 0) * 1000) / 10}%"><u></u></i></li>`).join("")}</ul>
    <p class="fi-dica">O número grande é de cada 100; a faixa clara na barra é onde o número verdadeiro deve estar.</p>`);
}

/** A curva típica: mediana e quartis do preço ÷ o do lançamento de 5 min a 7 dias, num gráfico em escala log. */
export function secaoCurva(el, o) {
  const pts = Array.isArray(o.curva) ? o.curva.filter(p => p && p.n) : [];
  if (!pts.length) return;
  const s = secao(el, `A curva típica ${q("curvaTipica")}`, "o preço ÷ o do lançamento · mediana e quartis", "fi-ts-mm-curva");
  s.append(graficoCurva(pts, "lançamento"));
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${pts.map(p => `<li data-p="${escapar(p.id)}"><span><b>${escapar(p.nome)}</b><small>${p.n.toLocaleString("pt-BR")} tokens${p.acima != null ? ` · ${pctSem(p.acima)} no preço do lançamento ou acima` : ""}</small></span><b>${vezes(p.mediana)}<small>de ${vezes(p.q1)} a ${vezes(p.q3)}</small></b></li>`).join("")}</ul>
    <p class="fi-dica">0 = ninguém negociou (não dá para vender). Os de 7 dias são vistos de novo uma semana depois; os mortos em 24 h contam como mortos.</p>`);
}

/** O gráfico da curva (SVG): faixa q1–q3 e a mediana, em log (0 vira o chão). */
function graficoCurva(pts, base) {
  const w = 320, h = 140, ml = 34, mr = 8, mt = 8, mb = 22;
  const piso = 0.001, lg = (v) => Math.log10(Math.max(piso, v ?? piso));
  const vals = pts.flatMap(p => [p.q1, p.mediana, p.q3]).filter(v => v != null);
  const topo = Math.max(1, ...vals), y0 = lg(piso), y1 = Math.log10(topo) + 0.15;
  const X = (i) => ml + (pts.length === 1 ? (w - ml - mr) / 2 : i * (w - ml - mr) / (pts.length - 1));
  const Y = (v) => mt + (h - mt - mb) * (1 - (lg(v) - y0) / (y1 - y0));
  const linha = (k) => pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join(" ");
  const banda = `${pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.q3).toFixed(1)}`).join(" ")} ${[...pts].reverse().map((p, j) => `L${X(pts.length - 1 - j).toFixed(1)} ${Y(p.q1).toFixed(1)}`).join(" ")} Z`;
  const marcas = [1, 0.1, 0.01].filter(v => lg(v) <= y1);
  const d = document.createElement("div"); d.className = "fi-ts-mm-graf";
  d.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="A curva típica: a mediana em cada ponto">
    ${marcas.map(v => `<line x1="${ml}" x2="${w - mr}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 1 ? "um" : "grade"}"/><text x="${ml - 4}" y="${Y(v) + 3}" text-anchor="end">${v === 1 ? "1×" : `${v}×`}</text>`).join("")}
    <text x="${ml - 4}" y="${h - mb + 3}" text-anchor="end">0</text>
    <path d="${banda}" class="banda"/><path d="${linha("mediana")}" class="med"/>
    ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.mediana)}" r="3" class="med"/><text x="${X(i)}" y="${h - 6}" text-anchor="middle">${escapar(p.nome)}</text>`).join("")}
  </svg><small>1× = o preço ${base}</small>`;
  return d;
}

/** A tabela dos sinais: com o sinal × sem ele (sobreviveram e dobraram), só com a amostra mínima. */
export function secaoSinais(el, o) {
  const t = o.sinais;
  if (!t || !Array.isArray(t.linhas) || !t.tokens) return;
  const s = secao(el, `Sinais na hora do lançamento ${q("sinal")}`, `${t.tokens.toLocaleString("pt-BR")} tokens com os sinais · comparação com ${t.minimo} de cada lado`, "fi-ts-mm-sinais");
  const lado = (x, k) => (x?.n ? `<b>${pctSem(x[k], 0)}</b><small>${x.n.toLocaleString("pt-BR")}${x[k === "sobreviveram" ? "icSobreviveram" : "icDobraram"] ? ` · ${faixa(x[k === "sobreviveram" ? "icSobreviveram" : "icDobraram"])}` : ""}</small>` : "<b>—</b><small>nenhum</small>");
  const termo = { bundle: q("bundle"), concentrado: q("concentracao"), criadorRepetido: q("criador"), carteiraNova: q("criador"), rugcheck: q("rugcheck") };
  s.insertAdjacentHTML("beforeend", `<div class="fi-ts-mm-tab" role="table">
    <div class="cab" role="row"><span role="columnheader">Sinal</span><span role="columnheader">Valiam 50%+ em 24 h<small>com · sem</small></span><span role="columnheader">Dobraram<small>com · sem</small></span></div>
    ${t.linhas.map(l => {
      const ok = l.ok, d = ok && l.com.sobreviveram != null && l.sem.sobreviveram != null ? l.com.sobreviveram - l.sem.sobreviveram : null;
      return `<div class="lin${ok ? "" : " pouco"}" role="row" data-s="${escapar(l.id)}"><span class="nm" role="cell">${escapar(l.nome)} ${termo[l.id] || ""}${ok ? (d != null && Math.abs(d) >= 0.02 ? `<em class="${d > 0 ? "ts-sobe" : "ts-desce"}">${d > 0 ? "+" : "−"}${n1(Math.abs(d) * 100, 0)} pontos com o sinal</em>` : "<em>quase igual</em>") : `<em>amostra pequena: ${l.com.n} com · ${l.sem.n} sem (precisa de ${t.minimo})</em>`}${l.semDados ? `<em>${l.semDados} sem dados</em>` : ""}</span>
        <span role="cell" class="dois">${ok ? `<span>${lado(l.com, "sobreviveram")}</span><span>${lado(l.sem, "sobreviveram")}</span>` : "<span>—</span>"}</span>
        <span role="cell" class="dois">${ok ? `<span>${lado(l.com, "dobraram")}</span><span>${lado(l.sem, "dobraram")}</span>` : "<span>—</span>"}</span></div>`;
    }).join("")}</div>
    <p class="fi-dica">Só aparece a comparação com ${t.minimo} tokens de cada lado; com menos, um único token mudaria muito a porcentagem. Os números pequenos embaixo são a quantidade e a faixa de 95%.</p>`);
}

/** Depois da graduação: a taxa, o tempo até se formar, a curva a partir do preço da graduação e as duas regras. */
export function secaoGraduacao(el, o) {
  const g = o.graduacao;
  if (!g || !g.n) return;
  const s = secao(el, `Depois da graduação ${q("graduacaoDepois")}`, `${g.graduaram} de ${g.n.toLocaleString("pt-BR")} se formaram`, "fi-ts-mm-grad");
  s.insertAdjacentHTML("beforeend", `<div class="fi-tiles fi-ts-mm-quadros">
      <span><small>Taxa de graduação ${q("graduacao")}</small><b>${de100(g.taxa)} de 100</b><small>${g.ic ? `faixa ${faixa(g.ic)}` : ""}</small></span>
      <span><small>Tempo até se formar</small><b>${minTxt(g.minutosMediana)}</b><small>o típico (mediana)</small></span></div>`);
  const pts = (g.curva || []).filter(p => p && p.n);
  if (pts.length > 1) {
    s.append(graficoCurva(pts, "da graduação"));
    s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${pts.slice(1).map(p => `<li><span><b>${escapar(p.nome)} depois</b><small>${p.n} ${p.n === 1 ? "token" : "tokens"}</small></span><b>${vezes(p.mediana)}<small>de ${vezes(p.q1)} a ${vezes(p.q3)}</small></b></li>`).join("")}</ul>`);
  }
  const rs = (g.regras || []).filter(r => r.apostas);
  if (rs.length) s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-mm-gregras">${rs.map(r => `<li data-v="${escapar(r.id)}"><span><b>${escapar(r.nome)}</b><small>${r.apostas} ${r.apostas === 1 ? "aposta" : "apostas"}${r.acerto != null ? ` · acerto ${pctSem(r.acerto)}` : ""}</small></span><b class="${classe(r.roi)}">${pct(r.roi, 1)}<small>por aposta</small></b></li>`).join("")}</ul>
    <p class="fi-dica">Comprar na hora da formatura × esperar 1 hora: o retorno por aposta de cada uma.</p>`);
}

/** As carteiras que chegam cedo: só o endereço encurtado (com o olho fechado, "Carteira N"). */
export function secaoCedo(el, o) {
  const c = o.cedo;
  if (!c || !c.observadas) return;
  const s = secao(el, `Carteiras que chegam cedo ${q("carteiraCedo")}`, `${c.observadas.toLocaleString("pt-BR")} vistas · ${c.comprasCedo.toLocaleString("pt-BR")} compras no 1º minuto nas 2 últimas semanas`, "fi-ts-mm-cedo");
  const xs = Array.isArray(c.carteiras) ? c.carteiras : [];
  if (xs.length) s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${xs.slice(0, 10).map(x => `<li><span><b>${escapar(carteiraSol(x.carteira))}${x.copiando ? ` <i class="fi-ts-selo gente">copiando</i>` : ""}${x.criador ? ` <i class="fi-ts-selo aviso">já criou token</i>` : ""}${x.bundle ? ` <i class="fi-ts-selo aviso">no bundle</i>` : ""}</b><small>${x.compras} ${x.compras === 1 ? "compra cedo" : "compras cedo"}</small></span><b>${x.acertos} ${x.acertos === 1 ? "acerto" : "acertos"}<small>${pctSem(x.taxa)} dobraram</small></b></li>`).join("")}</ul>`);
  s.insertAdjacentHTML("beforeend", `<p class="fi-dica">${c.selecao?.length ? `A regra "Copiar quem chega cedo" ${q("copiarCedo")} usa nesta semana ${c.selecao.length} ${c.selecao.length === 1 ? "carteira escolhida" : "carteiras escolhidas"} com a semana passada.` : `A regra "Copiar quem chega cedo" ${q("copiarCedo")} começa quando uma semana inteira tiver carteiras com 3 compras cedo e um acerto.`} ${c.criadoras || c.bundle ? `${c.criadoras || 0} ${c.criadoras === 1 ? "parece" : "parecem"} do próprio criador e ${c.bundle || 0} compraram no bundle ${q("bundle")}.` : ""} Só observadas: nenhuma é seguida de verdade.</p>`);
}

/** O medidor de golpe: quantos caíram em cada jeito, quão rápido e a fração das apostas de cada regra. */
export function secaoGolpe(el, o) {
  const g = o.golpe;
  const ls = Array.isArray(g?.linhas) ? g.linhas.filter(l => l.n) : [];
  if (!ls.length) return;
  const s = secao(el, `Medidor de golpe ${q("medidorGolpe")}`, "de cada 100, com a faixa de 95%", "fi-ts-mm-golpe");
  const extra = { criadorCedo: g.minutosCriador != null ? `o típico com ${minTxt(g.minutosCriador)} de vida (checado com ${minTxt(g.idadeChecagem)})` : "", queda: g.minutosQueda != null ? `a queda no ${minTxt(g.minutosQueda)} típico` : "" };
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-mm-barras">${ls.map(l => `<li data-k="${escapar(l.id)}" class="desce${l.id === "qualquer" ? " total" : ""}"><span class="nm"><b>${de100(l.p)}</b> ${escapar(l.nome)} <small>${l.k} de ${l.n}${l.ic ? ` · ${faixa(l.ic)}` : ""}</small>${extra[l.id] ? `<em>${extra[l.id]}</em>` : ""}</span><i style="--w:${Math.round((l.p || 0) * 1000) / 10}%;--a:${Math.round((l.ic?.[0] || 0) * 1000) / 10}%;--b:${Math.round((l.ic?.[1] || 0) * 1000) / 10}%"><u></u></i></li>`).join("")}</ul>`);
  const rs = (g.regras || []).filter(r => r.apostas);
  if (rs.length) s.insertAdjacentHTML("beforeend", `<p class="fi-ts-mm-t">Apostas que caíram em golpe</p><ul class="fi-ts-lista fi-ts-mm-gregras">${rs.map(r => `<li data-v="${escapar(r.id)}"><span><b>${escapar(r.nome)}</b><small>${r.emGolpe} de ${r.apostas} apostas</small></span><b>${pctSem(r.fracao)}<small class="${classe(r.resultado)}">${us(r.resultado || 0, { sinal: true })} nelas</small></b></li>`).join("")}</ul>`);
}

/** Os custos que as regras pagam (medidos): taxa, rede, gorjeta, deslize; e o tamanho da amostra com os pedidos. */
export function secaoCustos(el, o) {
  const c = o.custos;
  if (!c) return;
  const s = secao(el, "Os custos que as regras pagam", c.gorjetaMedida ? "medidos nas últimas rodadas" : "estimados (sem a medida da gorjeta)", "fi-ts-mm-custos");
  const rs = (o.regras || []).filter(r => r.apostas && r.custoPct != null);
  s.insertAdjacentHTML("beforeend", `<div class="fi-tiles fi-ts-mm-quadros">
      <span><small>Taxa do pump.fun ${q("curvaLigacao")}</small><b>${pctSem(c.taxaCurva, 1)}</b><small>por lado na curva · ${pctSem(c.taxaAmm, 2)} no pool</small></span>
      <span><small>Gorjeta ${q("gorjeta")}</small><b>${sol(c.gorjetaSol)}</b><small>${c.gorjetaP75Sol != null ? `a de cima: ${sol(c.gorjetaP75Sol)}` : "por operação"}</small></span>
      <span><small>Prioridade ${q("prioridade")}</small><b>${sol(c.prioridadeSol)}</b><small>+ a base de ${sol(c.redeBaseSol)}</small></span>
      <span><small>Rede por operação</small><b>${us(c.porOperacaoUsd || 0)}</b><small>${sol(c.porOperacaoSol)} com o SOL a ${us(c.solUsd || 0)}</small></span>
      <span><small>Deslize ${q("deslizeCurva")}</small><b>${pctSem(c.deslizeLancamento, 1)}</b><small>US$ 10 na curva vazia</small></span>
      <span><small>Ida e volta</small><b>${pctSem(c.porApostaPct, 1)}</b><small>da aposta, fora o deslize</small></span></div>
    ${rs.length ? `<ul class="fi-ts-lista">${rs.map(r => `<li data-v="${escapar(r.id)}"><span><b>${escapar(r.nome)}</b><small>${r.custos ? `taxas ${us(r.custos.taxa || 0)} · rede ${us(r.custos.rede || 0)} · deslize ${us(r.custos.deslize || 0)}` : ""}</small></span><b>${pctSem(r.custoPct, 1)}<small>do apostado</small></b></li>`).join("")}</ul>` : ""}`);
  const a = o.amostra;
  if (a) s.insertAdjacentHTML("beforeend", `<p class="fi-dica fi-ts-mm-amostra">Amostra: ${escapar(a.metodo || "")}${a.porDia ? ` (uns ${a.porDia.toLocaleString("pt-BR")} por dia)` : ""}.${Array.isArray(o.semDados) && o.semDados.length ? ` Nesta rodada ficaram sem dados: ${o.semDados.map(x => escapar(x.fonte)).join(", ")}.` : ""}</p>`);
}

/** Os números novos nos quadradinhos de Como está indo (custo e golpe da versão). */
export function tilesMemes(x) {
  const it = [];
  if (x.custoPct != null) it.push(`<span><small>Custos</small><b>${pctSem(x.custoPct, 1)}</b><small>do apostado (taxas, rede, deslize)</small></span>`);
  if (x.emGolpe != null && x.apostas) it.push(`<span class="${x.emGolpe / x.apostas >= 0.3 ? "fi-ts-ruim" : ""}"><small>Em golpe ${q("medidorGolpe")}</small><b>${pctSem(x.emGolpe / x.apostas)}</b><small>${x.emGolpe} das apostas · ${us(x.resultadoGolpe || 0, { sinal: true })}</small></span>`);
  return it;
}
