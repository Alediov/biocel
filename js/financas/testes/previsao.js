// Testes de mercado → Mercados de previsão (pedido do Alediov, 09/11/2026). SÓ observação e papel: desde abril de 2026 o
// Brasil bloqueou a Polymarket e a Kalshi. Formato em tools/papel/FORMATO.md do orbita-testes, "Mercados de previsão":
// o observatório de calibração (`calibracao`: preço × frequência real por faixa, com o intervalo de Wilson, e o Brier por
// categoria), as posições abertas (`itens`, a pergunta encurtada: os mercados são públicos), a diferença entre casas
// (`casas`), seguir os melhores (`seguir`, só o endereço encurtado; com o olho fechado, "Carteira N") e os números de cada
// conta (`extra`: posições, acerto, preço médio, a conta por dentro e a cauda). As versões entram pelas partes de sempre
// de formas.js; a parte Calibração é daqui (`telaCalibracao`).
import { escapar } from "../../ui.js";
import { secao, seg, q, classe, pct, pctSem, us, quando, dataCurta, GLOSSARIO } from "./comum.js";

// os termos novos (só se ainda não existirem: o GLOSSARIO é de todas as formas)
const TERMOS = {
  mercadoPrevisao: ["Mercado de previsão", "Uma aposta de sim ou não sobre um evento (eleição, jogo, juros, lançamento). Cada cota paga US$ 1 se o lado acontecer e nada se não acontecer, então o preço (de 0 a 1) é a chance que a multidão dá. A Polymarket e a Kalshi, as maiores, estão bloqueadas no Brasil desde abril de 2026: aqui é só observação, no papel."],
  calibracao: ["Calibração", "A multidão acerta? Pega os mercados que já acabaram e confere: dos que estavam a 80% um dia antes do fim, quantos aconteceram mesmo? Se a multidão é bem calibrada, perto de 80%. Cada ponto do gráfico é uma faixa de 10 pontos; a diagonal é o acerto perfeito."],
  brier: ["Brier score", "A nota da previsão: a média de (preço − resultado)², com o resultado 1 se aconteceu e 0 se não. 0 = acertou tudo com certeza; 0,25 = o mesmo que chutar 50% sempre. Quanto menor, melhor."],
  favoritoFim: ["Favorito perto do fim", "Comprar o lado que já está a 90% ou 95% quando faltam poucos dias: ganha uns centavos por cota quase sempre e perde a aposta inteira quando o improvável acontece. Parece uma máquina de dinheiro até o dia da cauda."],
  azarao: ["Viés do azarão", "Em apostas, os azarões costumam custar mais do que valem: quem compra o lado a 5% ganha menos de 5% das vezes. A versão Azarão mede isso aqui; espera-se que perca."],
  diferencaCasas: ["Diferença entre casas", "O mesmo evento em duas casas com preços diferentes. Compra-se na Polymarket o lado que está 5 pontos mais barato que na Kalshi (ou na Manifold). Só os casamentos seguros: os mesmos números na pergunta, o fim a até 3 dias e quase as mesmas palavras. Regras de resolução diferentes ainda podem enganar."],
  resolucao: ["Resolução", "Quando o mercado acaba, um oráculo (na Polymarket, o da UMA) diz o que aconteceu: o lado certo paga US$ 1 por cota e o outro, nada; mercado anulado devolve 50 centavos. Pode demorar ou ser contestado."],
  seguirMelhores: ["Seguir os melhores", "Toda segunda, as 10 carteiras que mais lucraram na semana anterior no ranking público; na semana seguinte, cada compra delas vira uma posição de US$ 20 aqui, pelo preço 5 minutos depois (mais 1 centavo). Escolher com o passado e medir no futuro: o teste fora da amostra. Só o endereço público."],
  cauda: ["Cauda", "As perdas raras e grandes. No favorito perto do fim, cada vitória dá ~1 a 2 dólares e cada derrota tira os 20: \"vitórias por perda\" diz quantas vitórias médias a maior perda apaga."],
  livro: ["Livro de ofertas", "As ordens de compra e venda esperando no mercado. Comprar US$ 20 anda pelas ofertas de venda, da mais barata para a mais cara: a diferença para a melhor é o deslize."],
  manifold: ["Manifold", "Um site de mercados de previsão com dinheiro de mentira (mana). Serve de referência de preço, mais fraca que a Kalshi, porque ninguém arrisca dinheiro de verdade."],
};
for (const [k, v] of Object.entries(TERMOS)) if (!GLOSSARIO[k]) GLOSSARIO[k] = v;
export const TERMOS_PREVISAO = ["mercadoPrevisao", "resolucao", "livro", "calibracao", "brier", "favoritoFim", "azarao", "cauda", "diferencaCasas", "manifold", "seguirMelhores", "aproximado", "regua"];

const n1 = (x, c = 1) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: c });
const cent = (p) => (p == null ? "—" : `${n1(p * 100, p * 100 < 10 || p * 100 > 90 ? 1 : 0)}¢`);
const p100 = (p) => (p == null ? "—" : `${n1(p * 100, 0)}%`);
const dataDe = (ms) => (ms ? dataCurta(new Date(ms - 3 * 3600e3).toISOString().slice(0, 10)) : "—");
const LADO = { yes: "Sim", no: "Não" };
const ladoTxt = (l) => LADO[String(l || "").toLowerCase()] || String(l || "");
const CAT_EMOJI = { "Esportes": "⚽", "Política": "🏛️", "Cripto": "🪙", "Economia": "📈", "Cultura": "🎬", "Ciência e tecnologia": "🔬", "Outros": "🌀" };

/** O aviso fixo da forma (no alto de cada parte). */
export function avisoBloqueio(el) {
  el.insertAdjacentHTML("beforeend", `<p class="fi-ts-pv-bloqueio" role="note">🔒 <b>Só observação, no papel.</b> A Polymarket e a Kalshi estão bloqueadas no Brasil desde abril de 2026: nenhuma conta, carteira ou ordem; só os dados públicos. ${q("mercadoPrevisao")}</p>`);
}

/** Os quadros das contas (FORMATO.md, "extra"); no lugar de Operações e Liquidações. */
export function tilesPrevisao(x) {
  const it = [];
  it.push(`<span><small>Posições</small><b>${(x.posicoes || 0).toLocaleString("pt-BR")}</b><small>${x.abertas || 0} abertas · ${x.resolvidas || 0} resolvidas${x.vendidas ? ` · ${x.vendidas} vendidas` : ""}</small></span>`);
  if (x.acerto != null) it.push(`<span><small>Acerto</small><b>${pctSem(x.acerto)}</b><small>das resolvidas${x.anuladas ? ` · ${x.anuladas} anuladas` : ""}</small></span>`);
  if (x.roi != null) it.push(`<span><small>Retorno por posição ${q("roi")}</small><b class="${classe(x.roi)}">${pct(x.roi, 1)}</b><small>das fechadas</small></span>`);
  if (x.precoMedio != null) it.push(`<span><small>Preço médio</small><b>${cent(x.precoMedio)}</b><small>de entrada, por cota</small></span>`);
  const c = x.cauda;
  if (c && c.perdas != null) it.push(`<span class="${c.perdas ? "fi-ts-ruim" : ""}"><small>Cauda ${q("cauda")}</small><b>${c.perdas} ${c.perdas === 1 ? "perda" : "perdas"}</b><small>${c.vitoriasPorPerda != null ? `a maior apaga ${n1(c.vitoriasPorPerda, 0)} vitórias` : c.ganhoMedio != null ? `ganho médio ${us(c.ganhoMedio)}` : "nenhuma vitória ainda"}</small></span>`);
  return it;
}

/** Como está indo: a conta por dentro, as posições abertas da versão e, nas versões delas, as casas ou as carteiras. */
export function secoesIndo(el, f, v, a, { hist = false } = {}) {
  contaPorDentro(el, a, v, { hist });
  if (hist) return;
  posicoesAbertas(el, f, v);
  if (v.id === "difK" || v.id === "difM") secaoCasas(el, f, v.id === "difK" ? "Kalshi" : "Manifold");
  if (v.id === "seguir") secaoSeguir(el, f);
}

function contaPorDentro(el, a, v, { hist }) {
  const x = a?.extra?.porDentro;
  if (!x) return;
  const s = secao(el, "A conta por dentro", `${escapar(v.nome)} · ${hist ? "teste no passado" : "ao vivo"}`, "fi-ts-pordentro fi-ts-pv-pordentro");
  const linhas = [["Ganhos (realizados)", x.ganhos], ["Perdas (realizadas)", -x.perdas], [`Taxas ${q("resolucao")}`, -x.taxas], [`Deslize ${q("livro")}`, -x.deslize], ["Abertas, se vendesse agora", x.emAberto]];
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${linhas.map(([n, val]) => `<li><span>${n}</span><b class="${classe(val)}">${us(val || 0, { sinal: true })}</b></li>`).join("")}
    <li class="total"><span><b>Resultado</b></span><b class="${classe(x.resultado)}">${us(x.resultado || 0, { sinal: true })}</b></li></ul>
    <p class="fi-dica">O deslize já está no preço de entrada (andou pelo livro com os US$ 20); as taxas só existem nos mercados que cobram.</p>`);
}

function posicoesAbertas(el, f, v) {
  const xs = (Array.isArray(f.itens) ? f.itens : []).filter(i => i && i.pergunta && i.versao === v.id);
  if (!xs.length) return;
  const s = secao(el, "Posições abertas", `${xs.length} · US$ 20 cada`, "fi-ts-pv-posicoes");
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${xs.slice(0, 25).map(i => {
    const ganho = (i.agora - i.preco) / (i.preco || 1) * (i.valor || 20);
    return `<li><span><b>${escapar(i.pergunta)}</b><small>${CAT_EMOJI[i.cat] || ""} ${escapar(i.cat || "")} · “${escapar(ladoTxt(i.lado))}” a ${cent(i.preco)} · desde ${dataDe(i.em)}${i.fim ? ` · acaba ${dataDe(i.fim)}` : ""}${i.outra ? ` · ${escapar(i.outra)} ${cent(i.outraPreco)}` : ""}${i.carteira ? ` · de ${escapar(i.carteira)}` : ""}</small></span><b class="${classe(ganho)}">${cent(i.agora)}<small> ${us(ganho, { sinal: true })}</small></b></li>`;
  }).join("")}</ul>${xs.length > 25 ? `<p class="fi-dica">E mais ${xs.length - 25}.</p>` : ""}`);
}

/** Diferença entre casas: os pares casados desta rodada (de uma casa ou das duas). */
export function secaoCasas(el, f, casa = null) {
  const c = f.casas;
  if (!c) return;
  const pares = (Array.isArray(c.pares) ? c.pares : []).filter(p => !casa || p.outra === casa);
  const fontes = Object.entries(c.fontes || {}).filter(([n]) => !casa || n === casa);
  const s = secao(el, `Diferença entre casas ${q("diferencaCasas")}`, casa ? `contra a ${escapar(casa)}` : "Kalshi e Manifold", "fi-ts-pv-casas");
  s.insertAdjacentHTML("beforeend", `<p class="fi-dica">${fontes.map(([n, x]) => x.ok ? `${escapar(n)}: ${x.mercados.toLocaleString("pt-BR")} mercados lidos` : `${escapar(n)}: sem dados${x.motivo ? ` (${escapar(x.motivo)})` : ""}`).join(" · ")}</p>`);
  if (!pares.length) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Nenhum casamento seguro nesta rodada.</p>`); return; }
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${pares.slice(0, 15).map(p => `<li data-casa="${escapar(p.outra)}"><span><b>${escapar(p.pergunta)}</b><small>Sim: Polymarket ${cent(p.polymarket)} · ${escapar(p.outra)} ${cent(p.outraPreco)}${p.comprou ? ` · <i class="fi-ts-selo gente">comprou “${escapar(ladoTxt(p.comprou))}”</i>` : ""}</small></span><b class="${Math.abs(p.diferenca) >= (c.regra?.diferenca || 0.05) ? "ts-sobe" : ""}">${p.diferenca >= 0 ? "+" : "−"}${n1(Math.abs(p.diferenca) * 100, 0)}<small> pontos</small></b></li>`).join("")}</ul>
    <p class="fi-dica">Compra quando a diferença passa de ${n1((c.regra?.diferenca || 0.05) * 100, 0)} pontos já com o deslize. Os mesmos números na pergunta, o fim a até ${c.regra?.fimDias || 3} dias e ${pctSem(c.regra?.palavras || 0.7)} das palavras em comum.</p>`);
}

/** Seguir os melhores: as 10 carteiras da semana (endereço encurtado) e o que foi copiado. */
export function secaoSeguir(el, f) {
  const g = f.seguir;
  if (!g) return;
  const cs = Array.isArray(g.carteiras) ? g.carteiras : [];
  const s = secao(el, `Seguir os melhores ${q("seguirMelhores")}`, g.semana ? `escolhidas em ${dataCurta(g.semana)}${g.proxima ? ` · próxima ${dataDe(g.proxima)}` : ""}` : "esperando a 1ª escolha", "fi-ts-pv-seguir");
  if (!cs.length) { s.insertAdjacentHTML("beforeend", `<p class="fi-dica">${g.motivo ? `Sem carteiras nesta semana: ${escapar(g.motivo)}.` : "O ranking da semana ainda não veio."}</p>`); return; }
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista">${cs.map(c => `<li><span><b>${escapar(c.carteira)}</b><small>${c.copiadas || 0} copiadas · ${c.fechadas || 0} fechadas${c.fechadas ? ` · ${c.ganhas || 0} com lucro` : ""}</small></span><b>${c.abertas || 0}<small> abertas</small></b></li>`).join("")}</ul>
    <p class="fi-dica">As ${g.regra?.n || 10} de maior lucro da semana anterior${g.mercadosLidos ? `, pelas negociações públicas de ${g.mercadosLidos} mercados resolvidos nela` : ""}; cada compra delas de US$ ${g.regra?.minimo || 50} ou mais vira US$ 20 aqui, ${g.regra?.atrasoMin || 5} min depois, com ${n1((g.regra?.deslize || 0.01) * 100, 0)} centavo de deslize estimado. Aproximado ${q("aproximado")}.</p>`);
}

// ------------------------------------------------------------------ a parte Calibração
let horizonte = "24h";
/** A parte Calibração: o gráfico preço × frequência real, as faixas, o Brier por categoria, o azarão e as casas. */
export function telaCalibracao(el, ctx, f) {
  avisoBloqueio(el);
  const c = f.calibracao || {};
  const hs = Array.isArray(c.horizontes) ? c.horizontes : [];
  const s = secao(el, `A multidão acerta? ${q("calibracao")}`, c.mercados ? `${c.eventos != null ? `${c.eventos.toLocaleString("pt-BR")} eventos (um mercado por evento)` : `${c.mercados.toLocaleString("pt-BR")} mercados encerrados`}${c.desde ? ` · ${dataDe(c.desde)} a ${dataDe(c.ate)}` : ""}` : "lendo os mercados encerrados", "fi-ts-pv-cal");
  if (!hs.length || !c.mercados) {
    s.insertAdjacentHTML("beforeend", `<p class="fi-dica">O observatório ainda não leu mercados encerrados.${c.andamento?.alcancouDias != null ? ` Já olhou ${n1(c.andamento.alcancouDias, 0)} de ${c.andamento.meta || 180} dias para trás.` : ""}</p>`);
  } else {
    if (!hs.some(h => h.id === horizonte)) horizonte = hs[0].id;
    s.append(seg("Quanto antes do fim", hs.map(h => [h.id, h.nome]), horizonte, (x) => { horizonte = x; ctx.redesenhar(); }, "fi-ts-pv-hor"));
    const h = hs.find(x => x.id === horizonte);
    s.append(graficoCalibracao(h));
    const fx = h.faixas.filter(x => x.n);
    s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-lista fi-ts-pv-faixas">${fx.map(x => `<li data-faixa="${Math.round(x.de * 10)}"><span><b>${p100(x.de)} a ${p100(x.ate)}</b><small>${x.n.toLocaleString("pt-BR")} mercados · preço médio ${p100(x.previsto)}${x.ic ? ` · faixa ${p100(x.ic[0])} a ${p100(x.ic[1])}` : ""}</small></span><b class="${x.ic && (x.previsto < x.ic[0] ? "ts-sobe" : x.previsto > x.ic[1] ? "ts-desce" : "")}">${p100(x.real)}<small> aconteceram</small></b></li>`).join("")}</ul>
      <p class="fi-dica">Verde: aconteceu mais do que o preço dizia (a faixa de 95% inteira acima); vermelho: menos. ${h.brier != null ? `Brier de todos: <b>${n1(h.brier, 3)}</b> ${q("brier")}.` : ""}</p>`);
    const cats = Array.isArray(h.porCategoria) ? h.porCategoria : [];
    if (cats.length) {
      const sc = secao(el, `Brier por categoria ${q("brier")}`, `${escapar(h.nome)} · menor é melhor`, "fi-ts-pv-brier");
      const mx = Math.max(0.25, ...cats.map(x => x.brier || 0));
      sc.insertAdjacentHTML("beforeend", `<ul class="fi-ts-obs-barras fi-ts-pv-bbarras">${cats.map(x => `<li data-cat="${escapar(x.cat)}"><span class="nm"><b>${n1(x.brier, 3)}</b> ${CAT_EMOJI[x.cat] || ""} ${escapar(x.cat)} <small>${x.n.toLocaleString("pt-BR")} mercados</small></span><i style="--w:${Math.round(Math.min(1, x.brier / mx) * 1000) / 10}%"></i></li>`).join("")}</ul>
        <p class="fi-dica">0 = acertou tudo; 0,25 = chutar 50% sempre. Esportes entram, marcados.</p>`);
    }
    if (c.azarao?.n) {
      const az = c.azarao;
      el.insertAdjacentHTML("beforeend", `<p class="fi-ts-frase fi-ts-pv-az">Azarões ${q("azarao")}: os lados a menos de 10% um dia antes custavam em média ${p100(az.previsto)} e aconteceram em <b>${p100(az.real)}</b> das vezes (${az.n.toLocaleString("pt-BR")} mercados${az.ic ? `, faixa ${p100(az.ic[0])} a ${p100(az.ic[1])}` : ""}).</p>`);
    }
  }
  const an = c.andamento;
  if (an && an.alcancouDias != null && an.alcancouDias < (an.meta || 180)) el.insertAdjacentHTML("beforeend", `<p class="fi-dica">Lendo para trás: ${n1(an.alcancouDias, 0)} de ${an.meta || 180} dias (80 mercados a cada rodada).</p>`);
  secaoCasas(el, f);
  secaoSeguir(el, f);
  const sd = Array.isArray(f.semDados) ? f.semDados : [];
  if (sd.length) el.insertAdjacentHTML("beforeend", `<p class="fi-dica fi-ts-pv-semdados">Sem dados nesta rodada: ${sd.map(x => `${escapar(x.fonte)} (${escapar(x.motivo || "")})`).join(" · ")}.</p>`);
}

/** O gráfico preço (x) × frequência real (y), com a diagonal, o intervalo de cada faixa e o tamanho pelo n. */
function graficoCalibracao(h) {
  const L = 34, T = 10, W = 280, H = 200;
  const X = (p) => L + p * W, Y = (p) => T + (1 - p) * H;
  const fx = h.faixas.filter(x => x.n && x.real != null);
  const nmax = Math.max(1, ...fx.map(x => x.n));
  let svg = `<svg viewBox="0 0 ${L + W + 8} ${T + H + 28}" role="img" aria-label="Preço contra a frequência real">`;
  for (let i = 0; i <= 10; i += 2) {
    svg += `<line class="grade" x1="${L}" x2="${L + W}" y1="${Y(i / 10)}" y2="${Y(i / 10)}"/><text x="${L - 4}" y="${Y(i / 10) + 3}" text-anchor="end">${i * 10}%</text>`;
    svg += `<text x="${X(i / 10)}" y="${T + H + 13}" text-anchor="middle">${i * 10}%</text>`;
  }
  svg += `<line class="diag" x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}"/>`;
  for (const x of fx) {
    const cx = X(x.previsto ?? (x.de + x.ate) / 2), r = 3 + 6 * Math.sqrt(x.n / nmax);
    if (x.ic) svg += `<line class="ic" x1="${cx}" x2="${cx}" y1="${Y(x.ic[0])}" y2="${Y(x.ic[1])}"/>`;
    svg += `<circle class="pt" cx="${cx}" cy="${Y(x.real)}" r="${r.toFixed(1)}"><title>${p100(x.de)} a ${p100(x.ate)}: ${p100(x.real)} de ${x.n}</title></circle>`;
  }
  svg += `<text x="${L + W / 2}" y="${T + H + 26}" text-anchor="middle" class="eixo">preço (a chance que a multidão dava)</text></svg>`;
  const d = document.createElement("div"); d.className = "fi-ts-pv-graf";
  d.innerHTML = svg + `<small>Na diagonal, a multidão acerta. Cada bolinha é uma faixa de 10 pontos (maior = mais mercados); o traço é a faixa de 95%.</small>`;
  return d;
}
