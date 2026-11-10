// Testes de mercado: a escolha guardada (localStorage `orbita.testes.sel`), os formatos, a barra de filtros, a grade e o
// gráfico, usados pelas subabas e pela tela da carteira.
import { escapar } from "../../ui.js";
import * as K from "./calculo.js";

export const CHAVE_SEL = "orbita.testes.sel";
export const AVISO = "Simulação com saldo fictício. Nada aqui é recomendação de investimento.";
const PADRAO = { sub: "indo", lev: 3, atraso: 1, versao: "", modo: "vivo", periodo: "tudo", ordem: "retorno", papel: "", alerta: "", visao: "", fMoeda: "", fCarteira: "", fTipo: "", parte: "geral", avisos: false };
/** As subabas antigas (19h50) → as de 22h27: Resumo → Como está indo, Carteiras → Quem copiamos, Comparar → Jeitos de
 *  copiar, Operações e Escolha → O que aconteceu; "como" virou um botão no alto. */
export const SUB_ANTIGA = { resumo: "indo", carteiras: "quem", comparar: "jeitos", operacoes: "aconteceu", escolha: "aconteceu", como: "indo" };
export const sel = (() => {
  let s;
  try { s = { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_SEL) || "{}") }; } catch { s = { ...PADRAO }; }
  if (SUB_ANTIGA[s.sub]) s.sub = SUB_ANTIGA[s.sub];
  return s;
})();
export const guardarSel = () => { try { localStorage.setItem(CHAVE_SEL, JSON.stringify(sel)); } catch { /* */ } };
/** A combinação escolhida (a alavancagem acertada para a versão; desde 09/11/2026 o atraso de 5 min só existe no controle
 *  3×, então uma escolha que não existe mais cai no atraso de 1 min, e uma versão que saiu, na proporcional). */
export const comboSel = (d) => {
  const v = K.versoesDe(d).some(([x]) => x === (sel.versao || "")) ? sel.versao || "" : "";
  const lev = K.levPara(d, v, sel.lev), k = K.chave(lev, sel.atraso, v);
  return K.existe(d, k) ? k : K.chave(lev, K.atrasosPara(d, v, lev)[0], v);
};
export const hojeDe = (d) => (sel.modo === "hist" ? null : K.diaDe(d.agora || Date.now()));
/** A conta da carteira na combinação escolhida, no período e no modo. */
export const trechoSel = (d, c, k = comboSel(d)) => K.trecho(K.contaDe(c, k, sel.modo), sel.periodo, hojeDe(d));

/** Um texto curto sobre o jeito de dimensionar de cada versão. */
export const TEXTO_VERSAO = {
  "": "Proporcional: põe a mesma parte do dinheiro que a carteira pôs; a alavancagem só limita.",
  s: "Como a proporcional, mas sai depois de 3 dias ou com 5% de perda da conta.",
  l: "Como a proporcional, com taxa menor e sem diferença de preço onde ela usou ordem limite.",
  m: "Como a proporcional, só nas moedas em que ela ganhou antes da cópia.",
  p20: "Como a proporcional, mas larga a carteira (fecha tudo e para) quando a cópia cai 20% do melhor momento.",
  p25: "Como a proporcional, mas larga a carteira (fecha tudo e para) quando a cópia cai 25% do melhor momento.",
  p30: "Como a proporcional, mas larga a carteira (fecha tudo e para) quando a cópia cai 30% do melhor momento.",
  a2: "O dobro da fração da carteira, até a alavancagem da conta e a máxima da moeda.",
  a3: "O triplo da fração da carteira, até a alavancagem da conta e a máxima da moeda.",
  f: "US$ 50 de margem × a alavancagem em cada abertura ou aumento; reduz e fecha na mesma proporção que ela.",
};
export const NOME_TIPO = { abriu: "Abriu", aumentou: "Aumentou", reduziu: "Reduziu", fechou: "Fechou", liquidada: "Liquidada", tempo: "Saiu: 3 dias", stop: "Stop 5%", parou: "Parou" };

// ------------------------------------------------------------------ formatos
export const classe = (v) => (v > 0 ? "ts-sobe" : v < 0 ? "ts-desce" : "");
export const horas = (h) => (h == null ? "?" : h >= 48 ? `${Math.round(h / 24)} dias` : h >= 2 ? `${Math.round(h)} h` : `${Math.round(h * 60)} min`);
export const dataCurta = (dia) => (dia ? new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—");
const hora = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const quando = (ms) => `${dataCurta(K.diaDe(ms))} ${hora(ms)}`;
export const usInteiro = (v) => `US$ ${Math.round(v).toLocaleString("pt-BR")}`;
export const us = (v, { sinal = false } = {}) => `${sinal && v > 0 ? "+" : v < 0 ? "−" : ""}US$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const reais = (v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pct = (v, casas = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: Math.abs(v) < 0.1 ? casas : 0 })}%`);
export const pctSem = (v, casas = 0) => pct(v, casas).replace("+", "");
export const vezes = (v) => (v == null || !Number.isFinite(v) ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×`);
export const num = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumSignificantDigits: 6 }));
export const nomePeriodo = () => K.PERIODOS.find(p => p[0] === sel.periodo)?.[1] || "Desde o início";

// ------------------------------------------------------------------ peças
/** Um grupo de botões (segmentado). `itens` [[valor, nome]]; `ao(valor)`. */
export function seg(rotulo, itens, atual, ao, cls = "") {
  const g = document.createElement("div"); g.className = `fi-seg ${cls}`; g.setAttribute("role", "group"); g.setAttribute("aria-label", rotulo); g.dataset.semDeslize = "";
  g.innerHTML = itens.map(([v, n]) => `<button data-v="${escapar(String(v))}" class="${String(atual) === String(v) ? "on" : ""}">${n}</button>`).join("");
  g.querySelectorAll("button").forEach(b => (b.onclick = () => { navigator.vibrate?.(6); ao(b.dataset.v); }));
  return g;
}

/** A barra de filtros: a combinação (dobrável), o período e ao vivo/histórico. */
export function barra(el, d, redesenhar, { combo = true, periodo = true, modo = true } = {}) {
  const b = document.createElement("div"); b.className = "fi-ts-barra";
  if (combo) {
    const k = comboSel(d), p = K.partes(k), v = p.versao;
    const det = document.createElement("details"); det.className = "fi-ts-combo";
    det.open = !!barra.aberta;
    det.innerHTML = `<summary><small>Jeito de copiar</small><b>${K.nomeJeito(k)}</b></summary>`;
    det.ontoggle = () => { barra.aberta = det.open; };
    const mudar = (f) => { f(); guardarSel(); redesenhar(); };
    det.append(
      seg("Alavancagem", K.levsDe(d, v).map(x => [x, `${x}×`]), p.lev, x => mudar(() => { sel.lev = +x; sel.atraso = p.atraso; }), "fi-ts-lev"),
      seg("Atraso", K.atrasosPara(d, v, p.lev).map(x => [x, `${x} min`]), p.atraso, x => mudar(() => { sel.atraso = +x; }), "fi-ts-atr"),
      seg("Versão da cópia", K.versoesDe(d).map(([x, n]) => [x, x === "" ? "Proporcional" : x === "a2" ? "Dobro" : x === "a3" ? "Triplo" : n]), v, x => mudar(() => { sel.versao = x; sel.lev = K.levPara(d, x, sel.lev); }), "fi-ts-versao"),
    );
    const soUm = K.atrasosPara(d, v, p.lev).length === 1 && K.atrasosDe(d).length > 1;
    det.insertAdjacentHTML("beforeend", `<p class="fi-ts-jeito">${TEXTO_VERSAO[v] || ""}${soUm ? ` O atraso de 5 min ficou só no controle (Proporcional 3×).` : ""} ${q("alavancagem")} ${q("atraso")}</p>`);
    b.append(det);
  }
  if (periodo || modo) {
    const l = document.createElement("div"); l.className = "fi-ts-linha2";
    if (periodo) l.append(seg("Período", K.PERIODOS.map(([v, n]) => [v, v === "tudo" ? "Tudo" : n]), sel.periodo, v => { sel.periodo = v; guardarSel(); redesenhar(); }, "fi-ts-periodo"));
    if (modo) l.append(seg("Ao vivo ou o teste no período da escolha (otimista)", [["vivo", "Ao vivo"], ["hist", "Na escolha"]], sel.modo, v => { sel.modo = v; guardarSel(); redesenhar(); }, "fi-ts-modo"));
    b.append(l);
    if (modo && sel.modo === "hist") b.insertAdjacentHTML("beforeend", `<p class="fi-ts-otimista" role="note">⚠ <b>No período da escolha (otimista)</b>: a cópia nos mesmos 30 dias em que a carteira foi escolhida por ter ido bem. Não é previsão; o teste honesto é o fora da amostra, em Mais testes. ${q("historico")}</p>`);
  }
  el.append(b);
}

export function secao(el, titulo, sub = "", cls = "") {
  const s = document.createElement("section"); s.className = `fi-sec ${cls}`;
  s.innerHTML = `<div class="fi-sec-cab"><h3>${titulo}</h3>${sub ? `<small>${sub}</small>` : ""}</div>`;
  el.append(s);
  return s;
}

/** Cor da célula da grade: verde (sobe) → vermelho (cai), mais forte quanto maior. */
export function corDe(r) {
  if (r == null) return "";
  const k = Math.max(-1, Math.min(1, r / 0.5)), h = k >= 0 ? 140 : 0, a = 0.18 + 0.62 * Math.abs(k);
  return `background: hsl(${h} 62% 40% / ${a.toFixed(2)})`;
}
/** A grade (alavancagem × versão, um atraso). Tocar numa célula chama `aoEscolher(k)`. */
export function desenharGrade(el, g, aoEscolher, atual) {
  const cols = g.versoes;
  const t = document.createElement("div"); t.className = "fi-ts-grade"; t.setAttribute("role", "table");
  t.style.setProperty("--cols", cols.length);
  t.innerHTML = `<div role="row" class="cab"><span></span>${cols.map(([v, n]) => `<span title="${escapar(TEXTO_VERSAO[v])}">${v === "f" ? "Fixa" : v === "m" ? "Moedas" : n}</span>`).join("")}</div>`
    + g.levs.map(lev => `<div role="row"><span class="lev">${lev}×</span>${cols.map(([v]) => {
      const k = Object.keys(g.celulas).find(x => { const p = K.partes(x); return p.lev === lev && p.versao === v; });
      const c = k && g.celulas[k];
      if (!c) return `<span class="vazia">—</span>`;
      const vv = c.mes ?? c.retorno;
      return `<button data-k="${k}" class="${k === g.melhor ? "melhor" : ""}${k === atual ? " on" : ""}" style="${corDe(c.mes != null ? c.mes * 4 : c.retorno)}">${pct(vv, Math.abs(vv) < 0.1 ? 1 : 0)}</button>`;
    }).join("")}</div>`).join("");
  t.querySelectorAll("button[data-k]").forEach(b => (b.onclick = () => aoEscolher(b.dataset.k)));
  el.append(t);
}

/** Uma operação copiada (abertura, fechamento, liquidação ou saída). */
export function linhaOp(o, { carteira = false } = {}) {
  const liq = o.tipo === "liquidada", saida = o.tipo === "tempo" || o.tipo === "stop";
  return `<div class="fi-ts-op${liq ? " liq" : saida ? " saida" : ""}"><span class="fi-ts-lado ${liq ? "liq" : o.lado}">${NOME_TIPO[o.tipo] || escapar(o.tipo)}</span><span class="fi-ts-tx"><b>${escapar(o.moeda)} · ${o.lado === "compra" ? "compra" : "venda"}</b><small>${carteira ? `${escapar(o.curto)} · ${quando(o.em)}` : `${quando(o.em)} · ${us(o.tam)} a ${num(o.px)}`}</small></span><span class="fi-ts-v ${classe(o.res)}">${o.res ? us(o.res, { sinal: true }) : ""}</span></div>`;
}

/** Linhas (dia → valor) num gráfico só; tocar mostra os valores do dia. */
export function grafico(series, rotuloAria = "Patrimônio fictício, bitcoin e CDI") {
  const W = 340, H = 170, m = { e: 8, d: 8, c: 12, b: 22 };
  const ultimo = series[0]?.pts.at(-1)?.[0];
  const dias = [...new Set(series.flatMap(s => s.pts.map(p => p[0])))].filter(d => !ultimo || d <= ultimo).sort();
  const val = series.map(s => { const mp = new Map(s.pts); let ult = null; return dias.map(d => (mp.has(d) ? (ult = mp.get(d)) : ult)); });
  const todos = val.flat().filter(v => v != null), mx0 = Math.max(...todos), mn0 = Math.min(...todos), folga = Math.max((mx0 - mn0) * 0.12, 5);
  const mx = mx0 + folga, mn = mn0 - folga;
  const x = (i) => m.e + (i * (W - m.e - m.d)) / Math.max(1, dias.length - 1), y = (v) => m.c + (1 - (v - mn) / (mx - mn || 1)) * (H - m.c - m.b);
  const caminho = (vs) => vs.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa fi-ts-graf";
  caixa.innerHTML = `<svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapar(rotuloAria)}">
    <line x1="${m.e}" x2="${W - m.d}" y1="${y(1000)}" y2="${y(1000)}" class="eixo base"/>
    ${series.map((s, k) => `<polyline points="${caminho(val[k])}" class="ts-linha ${s.cls}"/>`).reverse().join("")}
    <text x="${m.e}" y="${H - 6}" class="rot">${dataCurta(dias[0])}</text><text x="${W - m.d}" y="${H - 6}" class="rot" text-anchor="end">${dataCurta(dias.at(-1))}</text>
    <line class="ts-cursor" x1="-9" x2="-9" y1="${m.c}" y2="${H - m.b}"/>
  </svg>
  <p class="fi-ts-legenda">${series.map(s => `<span class="${s.cls}"><i></i>${escapar(s.nome)}</span>`).join("")}</p>
  <p class="fi-graf-info">Toque no gráfico para ver cada dia</p>`;
  const svg = caixa.querySelector("svg"), info = caixa.querySelector(".fi-graf-info"), cur = caixa.querySelector(".ts-cursor");
  const mostrar = (ev) => {
    const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(dias.length - 1, Math.round(((px - m.e) / (W - m.e - m.d)) * (dias.length - 1))));
    cur.setAttribute("x1", x(i)); cur.setAttribute("x2", x(i));
    info.innerHTML = `<b>${dataCurta(dias[i])}</b>: ${series.map((s, k) => `${escapar(s.nome)} ${val[k][i] == null ? "—" : us(val[k][i])}`).join(" · ")}`;
  };
  svg.addEventListener("pointerdown", mostrar); svg.addEventListener("pointermove", (ev) => { if (ev.buttons || ev.pointerType !== "mouse") mostrar(ev); });
  return caixa;
}
/** Gráfico de uma curva × bitcoin × CDI no mesmo trecho (ou um aviso, com poucos pontos). */
export function graficoComRefs(el, d, nome, pts, extra = []) {
  if (!pts || pts.length < 2) { el.insertAdjacentHTML("beforeend", `<p class="fi-dica">O gráfico enche a cada dia (um ponto no fim de cada dia).</p>`); return; }
  const de = pts[0][0], ate = pts.at(-1)[0];
  el.append(grafico([{ nome, cls: "l-conta", pts }, ...extra,
    { nome: "Bitcoin", cls: "l-btc", pts: K.referencia(d.referencias?.btc, de, ate) },
    { nome: "CDI", cls: "l-cdi", pts: K.referencia(d.referencias?.cdi, de, ate) }]));
}

// ------------------------------------------------------------------ "?" em todo termo técnico (pedido de 22h27)
export const GLOSSARIO = {
  copiar: ["Copiar no papel", "Cada vez que a carteira compra ou vende, uma conta de mentira com US$ 1.000 faz o mesmo. Nenhum dinheiro de verdade."],
  porMes: ["% ao mês estimado", "Quanto a conta cresceria por mês se seguisse no ritmo dos dias medidos. É uma estimativa, não uma promessa."],
  faixa: ["Faixa", "Onde o resultado provavelmente está (8 em cada 10 chances), pela variação de um dia para o outro. Poucos dias deixam a faixa larga."],
  extrapolacao: ["Extrapolação", "Com menos de 30 dias medidos, o % ao mês e ao ano esticam um período curto: podem mudar muito."],
  cdi: ["CDI", "A taxa que os bancos cobram entre si. Uma aplicação comum de renda fixa rende perto de 100% do CDI: é a régua do dinheiro parado rendendo."],
  poupanca: ["Poupança", "Rende 0,5% ao mês + TR quando a Selic passa de 8,5% ao ano. Usamos cerca de 0,6% ao mês (≈ 7,4% ao ano), uma estimativa fixa."],
  bitcoin: ["Bitcoin", "Comprar bitcoin com os mesmos US$ 1.000 e só segurar, para comparar."],
  alavancagem: ["Alavancagem", "Usar dinheiro emprestado da corretora. Com 3×, US$ 100 viram uma aposta de US$ 300: ganhos e perdas 3 vezes maiores."],
  liquidacao: ["Liquidação", "Quando a perda come quase toda a garantia de uma aposta, a corretora fecha à força e a garantia se perde."],
  queda: ["Pior queda", "O quanto a conta chegou a ficar abaixo do seu melhor momento. Mede o susto pelo caminho."],
  atraso: ["Atraso", "Quanto tempo a cópia demora para repetir a carteira: 1 ou 5 minutos. O preço pode mudar nesse tempo."],
  limite: ["Ordem limite", "Uma ordem com preço marcado que espera alguém aceitar. A taxa é menor, mas ela pode não acontecer."],
  financiamento: ["Financiamento", "Uma taxinha trocada de hora em hora entre quem aposta na alta e quem aposta na queda."],
  historico: ["No período da escolha (otimista)", "A mesma cópia feita nos 30 dias antes de começar a seguir a carteira, que são os dias em que ela foi escolhida por ter ido bem. Por isso é otimista: na 1ª semana, dava +37% em média contra ~+1% ao vivo. O teste honesto é o fora da amostra."],
  // os testes a mais (09/11/2026)
  foraAmostra: ["Teste fora da amostra", "A regra de escolha usada no passado sem saber o futuro: ela olha só os dados de 60 a 30 dias atrás, escolhe as carteiras e a cópia é simulada nos 30 dias seguintes, que ela não viu. É aproximado: o ranking daquela época é refeito pelo histórico de cada carteira, de uma amostra sorteada; quem sumiu do ranking não entra (isso deixa o teste um pouco otimista)."],
  parar: ["Parar de copiar", "A cópia larga a carteira (fecha tudo e não copia mais) quando cai 20, 25 ou 30% abaixo do seu melhor momento. Conferido de hora em hora, então a saída pode vir um pouco depois do limite."],
  top5: ["As 5 melhores", "Uma carteira de carteiras que toda semana fica só com as 5 que mais renderam ao vivo (% ao mês, no jeito Proporcional 3× · 1 min, com 7 dias ou mais), em partes iguais. Cada troca custa 0,15% de cada dólar que sai ou entra."],
  consenso: ["Consenso", "Uma conta de US$ 1.000 que só entra numa moeda quando 2 ou mais carteiras seguidas estão do mesmo lado nela (e mais do que do outro), com 30% da conta por moeda a 3×; sai quando isso acaba."],
  roboPessoa: ["Só robôs × Só pessoas", "Duas carteiras de carteiras: uma só com as carteiras de selo robô e outra só com as de selo pessoa, em partes iguais, trocando toda semana. Mostram quem é melhor de copiar."],
  troca: ["Troca semanal", "Uma vez por semana a carteira de carteiras refaz as partes iguais. Vender a parte de uma e comprar a de outra custa a taxa e a diferença de preço (aqui, 0,15% por lado)."],
  previsto: ["O que o teste da escolha dizia", "A média do teste no período da escolha das mesmas carteiras, feito em T0. A diferença para o resultado mostra o quanto aquele teste é otimista."],
  controle: ["Controle do atraso", "Uma só conta com 5 min de atraso (Proporcional 3×) para conferir se demorar mais pesa. Nos primeiros dias, 1 e 5 min davam quase igual."],
  cc: ["Carteira de carteiras", "US$ 1.000 divididos em partes iguais entre todas as carteiras seguidas, todas no mesmo jeito de copiar."],
  teto: ["Teto", "Escolher o melhor jeito de cada carteira depois de ver o resultado sempre parece ótimo. Serve de limite de cima, não de previsão."],
  risco: ["Risco", "Baixo, médio ou alto pela pior queda, pelas liquidações e pela alavancagem de verdade usada."],
  robo: ["Robô ou pessoa", "Um palpite pelo jeito de operar: horários, tamanhos, velocidade e preços. A nota vai de 0 (pessoa) a 100 (robô)."],
  imitador: ["Imitador", "Tenta adivinhar a regra do robô pelo que o preço fazia antes de cada entrada. Ajusta nos primeiros 20 dias e confere nos 10 últimos, que ele não viu."],
  acerto: ["Acerto", "De cada 10 apostas fechadas, quantas fecharam com lucro."],
  ganhoPerda: ["Ganho ÷ perda", "O ganho médio das apostas boas dividido pela perda média das ruins. Acima de 1, ganha mais do que perde quando erra."],
  diasPositivos: ["Dias positivos", "Quantos dias fecharam no azul. Nas formas no papel, entre todos os dias medidos; na carteira do copy trading, só entre os dias em que a conta mexeu."],
  proporcional: ["Proporcional", "A cópia põe a mesma parte do dinheiro que a carteira pôs (se ela usou 20% dela, a cópia usa 20% dos US$ 1.000)."],
  dobro: ["Dobro e triplo", "Põe 2 ou 3 vezes a parte que a carteira pôs, sempre até a alavancagem escolhida."],
  fixa: ["Fixa US$ 50", "Cada aposta nova usa US$ 50 de garantia × a alavancagem, sem olhar quanto a carteira pôs."],
  saidas: ["Saídas de segurança", "Fecha a aposta aberta há mais de 3 dias ou que perder 5% da conta."],
  moedasBoas: ["Moedas boas", "Só copia as moedas em que a carteira ganhou antes de começarmos a seguir."],
  quarentena: ["Quarentena", "Uma carteira recusada fica 7 dias sem ser analisada de novo."],
  // as outras formas (03/11/2026)
  // os cofres revistos (09/11/2026)
  historicoCofres: ["No período da escolha (otimista)", "As versões dos cofres refeitas nos últimos 180 dias com os cofres que a escolha de hoje olhou: os que mais lucraram no último mês. Como foram escolhidos por terem ido bem, o teste sai melhor que a realidade (na 1ª semana: +7,7% no teste contra −0,06% ao vivo nos 5 melhores). O teste honesto é o fora da amostra."],
  foraAmostraCofres: ["Teste fora da amostra (cofres)", "As regras usadas no passado sem saber o futuro: toda segunda das últimas 12 semanas, cada versão escolhe os cofres só com os números até aquele dia, entre todos os da lista da corretora (também os que fecharam depois), e o dinheiro anda pelos dias seguintes. É aproximado: os cofres apagados da lista não entram, a parte do líder é a de hoje e o histórico antigo tem poucos pontos."],
  sinaisSaida: ["Sinais de saída", "Além de cair 15% do melhor momento, a versão com sinais sai de um cofre quando o líder fica com menos de 5% do dinheiro dele (tem pouco a perder), quando o TVL cai 30% em 7 dias (muita gente saindo) ou quando o cofre fecha para depósitos. Sempre depois da trava."],
  constancia: ["Constância", "Os cofres que mais renderam em 90 dias para o quanto balançaram de um dia para o outro (parecido com o Sharpe). Fica de fora quem fez mais da metade do lucro de 90 dias num dia só: isso é sorte ou aposta grande, não constância."],
  cofresGrandes: ["Só cofres grandes", "A mesma regra dos 5 melhores, mas só entre os cofres com US$ 1 milhão ou mais depositados. Cofre grande costuma ser mais estável e mais difícil de fechar de repente."],
  mistura: ["Mistura com o HLP", "Parte no HLP (o cofre da própria corretora, mais calmo) e o resto nos 5 melhores. Toda segunda volta às partes certas: tira de quem passou da parte e põe em quem ficou abaixo."],
  copiarLider: ["Cofre × copiar o líder", "No cofre, o líder fica com 10% do lucro. A outra opção seria repetir sozinho as operações que ele faz no cofre. Aqui as duas correm lado a lado no papel, com US$ 1.000 cada, para ver se a comissão vale o trabalho que ela poupa."],
  cofre: ["Cofre", "Uma conta coletiva da Hyperliquid: várias pessoas depositam e um líder opera tudo junto. O resultado é dividido pela parte de cada um."],
  comissao: ["Comissão do líder", "A parte do lucro que fica com quem opera o cofre (em geral 10%). Só é cobrada quando há lucro."],
  tvl: ["TVL", "Quanto dinheiro está depositado no cofre. Mais dinheiro costuma querer dizer mais gente confiando nele."],
  funding: ["Funding", "A taxa de financiamento: quem aposta na alta no perpétuo paga a quem aposta na queda (ou o contrário), de hora em hora."],
  perpetuo: ["Perpétuo", "Um contrato que segue o preço da moeda sem data para acabar. Dá para apostar na alta ou na queda."],
  base: ["Base", "A diferença de preço entre a moeda comprada à vista e o perpétuo. Mexe um pouco no resultado ao montar e ao desmontar."],
  grade: ["Grade", "Uma escada de preços: o robô compra um pouco a cada degrau que o preço desce e vende a cada degrau que sobe."],
  dca: ["DCA", "Comprar o mesmo valor em dias fixos, sem tentar acertar o momento. O preço médio vira a média do período."],
  aproximado: ["Aproximado", "O teste no passado foi feito com poucos pontos (como o histórico dos cofres). Serve de ideia, não de medida exata."],
  placar: ["Placar", "Cada forma no seu jeito padrão, ao vivo e desde o começo, do maior % ao mês para o menor."],
  // apostas de valor (futebol, só no papel)
  odd: ["Odd", "Quanto a casa paga por real apostado, contando o real de volta: odd 2,00 paga R$ 2 por R$ 1. A chance que a odd dá é 1 ÷ odd (2,00 → 50%)."],
  margem: ["Margem da casa", "Somando as chances das três saídas de um jogo (vitória, empate, derrota) pela odd da casa, passa de 100%: o que passa é o lucro garantido da casa. É por isso que apostar sem critério perde aos poucos."],
  oddJusta: ["Odd justa", "A odd sem a margem: a da Pinnacle, a casa de margem mais baixa, com a margem tirada. É a melhor estimativa pública da chance real do jogo."],
  valorAposta: ["Aposta de valor", "Quando a odd de uma casa comum paga mais do que a odd justa: 2,20 onde a justa é 2,00 tem 10% de valor. Uma só pode perder; o ganho aparece em muitas apostas."],
  clv: ["CLV", "Closing line value: quanto a odd que você pegou era melhor que a odd justa na hora do jogo começar. CLV positivo de forma consistente é o melhor sinal de que o método acha valor de verdade, mesmo quando o resultado ainda oscila."],
  roi: ["Retorno por aposta", "O resultado dividido pelo total apostado (ROI). 5% = em média R$ 0,50 de lucro a cada R$ 10 apostados."],
  seguirBDM: ["Seguir o BDM", "Uma conta que aposta R$ 20 (no papel) em cada palpite do programa Bom Dia Mercado, do Theo Borges, que o teste sabe precificar (1X2 e mais/menos de 2,5 gols), na odd da hora em que o palpite apareceu. Mostra se seguir os palpites daria lucro e se as odds dele eram boas (o CLV)."],
  cobertura: ["Cobertura", "Quantos dos palpites viraram aposta no papel. Ficam de fora os planos para o ao vivo ou condicionais, os mercados que o teste não precifica (handicap, ambas marcam, cartões…), os jogos de campeonatos que o teste não acompanha e os vistos depois que o jogo começou."],
  oddCitada: ["Odd citada", "A odd que o palpiteiro disse no vídeo. A conta aposta na odd que a casa pagava quando o palpite apareceu, que pode ser maior ou menor."],
  apostaGratis: ["Aposta grátis", "O bônus semanal de R$ 5 que a casa dá: se ganhar, recebe só o lucro (odd − 1) × 5; se perder, não perde nada. Por isso vale escolher odds mais altas que numa aposta comum."],
  // looping (07/11/2026)
  looping: ["Looping", "Depositar, pegar emprestado contra o depósito e depositar de novo, várias vezes: o rendimento do depósito e o juro do empréstimo ficam multiplicados."],
  fatorSaude: ["Fator de saúde", "Garantia × o limite de liquidação ÷ a dívida. Acima de 1, tudo bem; abaixo de 1, o Aave vende parte da garantia com multa (a liquidação)."],
  staking: ["Staking", "O ether \"preso\" ajudando a rede a funcionar rende uns 3% ao ano. O wstETH é esse ether em staking, que vale cada vez mais ether."],
  eMode: ["Modo eficiente (e-mode)", "No Aave, moedas que andam juntas (como o wstETH e o ether) deixam pegar até 90% emprestado, porque o risco de uma descolar da outra é pequeno."],
  // opções (07/11/2026)
  put: ["Put", "O direito de VENDER a moeda a um preço combinado numa data. Quem vende a put recebe um prêmio já e, se a moeda cair abaixo desse preço, paga a diferença."],
  call: ["Call", "O direito de COMPRAR a moeda a um preço combinado numa data. Quem vende a call coberta (com a moeda comprada) recebe o prêmio e abre mão das altas acima desse preço."],
  strike: ["Strike", "O preço combinado da opção. A put dá prejuízo a quem vendeu se a moeda terminar abaixo dele; a call, se terminar acima."],
  delta: ["Delta", "Mais ou menos a chance de a opção terminar valendo alguma coisa: delta 0,15 ≈ 15%. Quanto menor, menor o prêmio e mais raro o prejuízo."],
  premio: ["Prêmio", "O que quem compra a opção paga na hora a quem vende. Fica com quem vendeu, aconteça o que acontecer; o prejuízo, se houver, vem no vencimento."],
  dvol: ["DVOL", "O índice de volatilidade da Deribit: quanto o mercado espera que o bitcoin (ou o ether) balance nos próximos 30 dias. Quanto maior, mais caras as opções."],
  // pools (07/11/2026)
  pool: ["Pool de liquidez", "Um caixa com duas moedas (como ether e dólar) onde qualquer um troca uma pela outra pagando uma pequena taxa (0,01% a 0,3%). Quem põe as moedas no caixa ganha essas taxas."],
  faixaPool: ["Faixa de preço", "A posição escolhe entre quais preços ela trabalha. Dentro da faixa ganha a taxa das trocas; fora, para de ganhar e fica toda numa moeda só."],
  // vários pools (09/11/2026)
  faixaVol: ["Faixa pela oscilação", "Nos pools novos, a faixa não é um número fixo: \"estreita\" é do tamanho de um dia normal de sobe e desce do par, \"média\" de 3 dias e \"larga\" de 8. Assim dois dólares (que quase não mexem) e o ether (que mexe muito) são comparados do mesmo jeito."],
  giro: ["Taxas do pool ao ano", "O volume de um dia dividido pelo dinheiro guardado no pool, vezes a taxa, levado para o ano. Diz quanto o pool inteiro rende só de taxas, se o volume seguir assim. A sua posição pode render mais (faixa estreita) ou menos (fora da faixa)."],
  gauge: ["Gauge", "No Aerodrome, dá para pôr a posição num \"gauge\": ela para de ganhar as taxas das trocas e passa a ganhar AERO, a moeda do Aerodrome. Quem não põe ganha as taxas, mas uma parte delas vai para o gauge."],
  aero: ["AERO", "A moeda do Aerodrome, distribuída todo dia a quem está no gauge. O papel vende o AERO uma vez por dia pelo preço do momento: se o AERO cair, o ganho cai junto."],
  emissoes: ["AERO ao ano", "Quanto o AERO pago pelo gauge vale, em dólar, por ano, dividido pela liquidez que está no gauge. Muda toda semana (a votação do Aerodrome decide quanto cada pool recebe) e com o preço do AERO."],
  medidoBtc: ["Medido em bitcoin", "No par ether × bitcoin, as duas moedas andam juntas. Para mostrar só o efeito do pool, a conta é medida em bitcoin e convertida em dólar pelo preço do bitcoin do dia em que começou; o valor em dólar de hoje aparece à parte."],
  observado: ["Só observado", "Pools pequenos demais para o papel: com tão pouco dinheiro guardado, os US$ 1.000 de mentira mexeriam no preço. O papel só acompanha o volume e a liquidez, para avisar se crescerem."],
  perdaImp: ["Perda impermanente", "Quanto a posição no pool vale a menos do que se tivesse só segurado as mesmas moedas. Vem de o pool vender o ether na alta e comprar na queda. As taxas precisam cobrir isso."],
  reposicionar: ["Reposicionar", "Tirar a posição do pool, trocar para a proporção certa e pôr de novo em volta do preço de agora. Custa a taxa da troca e o gás, e torna a perda impermanente definitiva."],
  gas: ["Gás", "A taxa da rede para cada transação. Na Base ela é de centavos de dólar, mas conta quando se reposiciona muitas vezes."],
  // memecoins (07/11/2026)
  memecoin: ["Memecoin", "Uma moeda de brincadeira que qualquer pessoa cria em segundos, sem nada por trás além da vontade de quem compra. A maioria vai a zero em minutos."],
  curvaPump: ["Curva do pump.fun", "O preço sai de uma conta: cada compra deixa a próxima mais cara e cada venda, mais barata. Não precisa de alguém do outro lado."],
  graduacao: ["Graduação", "Quando a curva do pump.fun junta uns 85 SOL, o token se forma e passa a ser negociado numa corretora (a PumpSwap). Pouquíssimos chegam lá."],
  golpe: ["Golpe", "Aqui: o preço cair mais de 90% em até 5 minutos na primeira hora. Quase sempre é quem criou (ou uns poucos donos) vendendo tudo de uma vez em cima de quem comprou."],
  rugcheck: ["RugCheck", "Um site gratuito que olha o token logo depois de criado e aponta riscos, como poucos donos com quase tudo. Risco alto não quer dizer golpe certo, nem o contrário."],
  observatorio: ["Observatório", "Em vez de prometer ganho, mostra o que acontece com as moedas novas: de uma amostra sorteada, quantas dobram, morrem ou são golpe, e quanto cada regra simples teria dado."],
  // métricas comuns de todas as formas (09/11/2026, `conta.metricas` do orbita-testes)
  cdiPeriodo: ["CDI no mesmo período", "Quanto o CDI rendeu exatamente nos mesmos dias em que a conta existiu. É a régua justa: comparar com o CDI de um ano inteiro engana quando a conta tem poucos dias."],
  excesso: ["Acima do CDI", "Quanto a conta rendeu a mais (ou a menos) que o CDI no mesmo período. Se for negativo, deixar o dinheiro no CDI teria sido melhor."],
  volatilidade: ["Volatilidade", "O quanto a conta balança de um dia para o outro, levada para o ano. 5% é calmo como renda fixa; 50% ou mais é montanha-russa."],
  sharpe: ["Índice de Sharpe", "O ganho acima do CDI dividido pelo quanto a conta balança. Acima de 1 é bom pelo risco que corre; entre 0 e 1, pouco pelo risco; abaixo de 0, o CDI rendeu mais sem risco nenhum. Só sai com 14 dias ou mais."],
  retornoPorQueda: ["Retorno ÷ pior queda", "O ganho ao ano dividido pela pior queda (também chamado Calmar). 2 quer dizer que, para cada 1% de queda que você teria de aguentar, ganhou 2% ao ano. Só sai com 30 dias e uma queda de pelo menos 0,5%."],
  piorDia: ["Pior dia", "A maior perda de um dia só (de um fechamento ao seguinte)."],
  entreCorretoras: ["Entre corretoras", "Comprado no perpétuo de uma corretora e vendido no de outra, onde a taxa de financiamento é maior: ganha a diferença das taxas sem depender do preço. Aqui é aproximado: as taxas são as previstas que a própria Hyperliquid publica, lidas a cada 6 h, e não há teste no passado."],
  regua: ["Referência", "Versões que não são estratégia: servem de régua. No looping, só o staking (wstETH sem empréstimo), só o ether e só depositar dólar; cada laço se compara com a régua do mesmo tipo."],
  reinvestir: ["Reinvestir as taxas", "Pôr as taxas ganhas de volta na posição, na mesma faixa. Aqui, no jeito \"à mão\", a cada 7 dias, como quem cuida da pool pelo celular."],
  semDados: ["Sem dados", "Nem a DexScreener nem o GeckoTerminal responderam sobre o token: não dá para saber o que aconteceu com ele. Fica fora das apostas e das contas de morto ou vivo."],
};
/** O "?" pequeno de um termo (um span com papel de botão: pode ir dentro de botões e cartões). */
export const q = (id) => (GLOSSARIO[id] ? `<span class="fi-ts-q" role="button" tabindex="0" data-q="${id}" aria-label="O que é ${escapar(GLOSSARIO[id][0])}?">?</span>` : "");
let numQ = 0;
/** Depois de quê a explicação entra: o bloco do "?" (o item, o parágrafo, o cartão…), subindo enquanto o pai for uma grade
 *  ou uma fileira (09/11/2026: o CDI e a Poupança ficam lado a lado no número grande e no Placar; a explicação entrava
 *  como mais uma célula da grade, espremida ao lado, e a da Poupança não tirava a do CDI). */
function lugarDaAjuda(b) {
  let bloco = b.closest(".fi-ts-qa, li, p, .fi-heroi, summary, section, button, [role=button]:not(.fi-ts-q), div") || b.parentElement;
  for (let pai = bloco.parentElement; pai && !pai.classList.contains("fi-testes"); pai = pai.parentElement) {
    const cs = getComputedStyle(pai), fileira = cs.display.endsWith("flex") && !cs.flexDirection.startsWith("column");
    if (!cs.display.endsWith("grid") && !fileira) break;
    bloco = pai;
  }
  return bloco;
}
/** Tocar num "?" abre (ou fecha) a explicação logo abaixo do bloco. Ligado uma vez na raiz da aba. */
export function ligarAjuda(raiz) {
  const abrir = (ev) => {
    const b = ev.target.closest?.(".fi-ts-q");
    if (!b || !raiz.contains(b)) return;
    ev.preventDefault(); ev.stopPropagation();
    const id = b.dataset.q, aberta = raiz.querySelector(`.fi-ts-explica[data-de="${b.dataset.qn ||= String(++numQ)}"]`);
    // um "?" aberto de cada vez: tocar de novo fecha; tocar noutro fecha o anterior
    raiz.querySelectorAll(".fi-ts-explica").forEach(e => e.remove());
    raiz.querySelectorAll(".fi-ts-q[aria-expanded]").forEach(e => e.setAttribute("aria-expanded", "false"));
    if (aberta) return;
    const [t, x] = GLOSSARIO[id];
    lugarDaAjuda(b).insertAdjacentHTML("afterend", `<p class="fi-ts-explica" data-q="${id}" data-de="${b.dataset.qn}" role="note"><b>${escapar(t)}:</b> ${escapar(x)}</p>`);
    b.setAttribute("aria-expanded", "true");
  };
  raiz.addEventListener("click", abrir, true);
  raiz.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList?.contains("fi-ts-q")) abrir(ev); }, true);
}

// ------------------------------------------------------------------ o % estimado em texto
const absurdo = (v) => (v > 10 ? "mais de +1.000%" : null);
export const pctMes = (v) => (v == null ? "—" : absurdo(v) || pct(v, 1));
/** "+2,1% ao mês" (ou o % do período, se cedo) e a linha de baixo: faixa, dias, ao ano. */
export function textoEstimativa(e) {
  if (!e) return { grande: "—", linha: "Sem dados ainda." };
  if (e.cedo) return { grande: `${pct(e.periodo)} no período`, linha: `Medindo há ${e.dias} ${e.dias === 1 ? "dia" : "dias"}: cedo demais para estimar ao mês.` };
  // a conta perdeu tudo (liquidada): não há % ao mês nem faixa
  if (!e.faixaMes) return { grande: `${pct(e.periodo)} no período`, linha: `A conta perdeu tudo · medindo há ${e.dias} ${e.dias === 1 ? "dia" : "dias"}` };
  const ano = absurdo(e.ano) || pct(e.ano, 0);
  return {
    grande: `${pctMes(e.mes)} ao mês`,
    linha: `entre ${pctMes(e.faixaMes[0])} e ${pctMes(e.faixaMes[1])} ${q("faixa")} · medindo há ${e.dias} dias · ≈ ${ano} ao ano${e.extrapola ? ` (extrapolação ${q("extrapolacao")})` : ""}`,
  };
}
export const NOME_SEMAFORO = { ganhando: "Por enquanto está ganhando do CDI", perdendo: "Por enquanto está perdendo do CDI", cedo: "Ainda é cedo para saber" };

// ------------------------------------------------------------------ gráficos novos (SVG leves)
const W = 340;
/** Barras do % de cada mês, verdes e vermelhas (o valor fica sempre do lado de fora da barra, longe do mês). */
export function graficoMeses(meses) {
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa fi-ts-gmes";
  if (!meses?.length) { caixa.innerHTML = `<p class="fi-dica">Sem meses ainda.</p>`; return caixa; }
  const alto = 52, cima = meses.some(m => m.r > 0) ? alto : 6, baixo = meses.some(m => m.r < 0) ? alto : 6;
  const meio = 16 + cima, H = meio + baixo + 32, mx = Math.max(0.01, ...meses.map(m => Math.abs(m.r)));
  const passo = (W - 16) / meses.length, lw = Math.min(46, passo - 8);
  const nome = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  caixa.innerHTML = `<svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Porcentagem de cada mês">
    <line x1="8" x2="${W - 8}" y1="${meio}" y2="${meio}" class="eixo"/>
    ${meses.map((m, i) => { const x = 8 + i * passo + (passo - lw) / 2, h = Math.max(1, Math.abs(m.r) / mx * alto), y = m.r >= 0 ? meio - h : meio;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${lw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="${m.r >= 0 ? "ts-barra-sobe" : "ts-barra-desce"}"/>
        <text x="${(x + lw / 2).toFixed(1)}" y="${(m.r >= 0 ? y - 4 : y + h + 12).toFixed(1)}" class="rot" text-anchor="middle">${pct(m.r, 1)}</text>
        <text x="${(x + lw / 2).toFixed(1)}" y="${H - 4}" class="rot forte" text-anchor="middle">${nome(m.mes)}</text>`; }).join("")}
  </svg>`;
  return caixa;
}
/** A queda do topo ao longo do tempo (área vermelha abaixo de zero). */
export function graficoQueda(serie) {
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa fi-ts-gqueda";
  if (!serie || serie.length < 2) { caixa.innerHTML = `<p class="fi-dica">O gráfico enche a cada dia.</p>`; return caixa; }
  const H = 110, m = { e: 8, d: 8, c: 10, b: 20 }, mn = Math.min(-0.02, ...serie.map(x => x[1]));
  const x = (i) => m.e + i * (W - m.e - m.d) / (serie.length - 1), y = (v) => m.c + (v / mn) * (H - m.c - m.b);
  const pts = serie.map(([, v], i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  caixa.innerHTML = `<svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Quanto a conta estava abaixo do melhor momento">
    <polygon points="${m.e},${y(0)} ${pts} ${x(serie.length - 1)},${y(0)}" class="ts-area-queda"/>
    <line x1="${m.e}" x2="${W - m.d}" y1="${y(0)}" y2="${y(0)}" class="eixo"/>
    <text x="${m.e}" y="${H - 5}" class="rot">${dataCurta(serie[0][0])}</text><text x="${W - m.d}" y="${H - 5}" class="rot" text-anchor="end">${dataCurta(serie.at(-1)[0])}</text>
  </svg>`;
  return caixa;
}
/** Alavancagem × resultado: para cada alavancagem, o % ao mês (para cima se ganhou, para baixo se perdeu) e a pior
 *  queda (sempre para baixo), lado a lado. */
export function graficoAlavancagem(lista) {
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa fi-ts-galav";
  if (!lista?.length) { caixa.innerHTML = `<p class="fi-dica">Sem dados ainda.</p>`; return caixa; }
  const val = (x) => (x.est && !x.est.cedo ? x.est.mes : x.retorno);
  const sobe = Math.max(0, ...lista.map(val)), desce = Math.max(0.01, ...lista.map(x => Math.max(x.queda, -val(x))));
  const mx = Math.max(sobe, desce), cimaPx = sobe > 0 ? 50 : 8, baixoPx = 60;
  const base = 16 + cimaPx, H = base + baixoPx + 34, g = (W - 16) / lista.length;
  const alt = (v, k) => Math.max(1, Math.abs(v) / mx * k);
  caixa.innerHTML = `<svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Alavancagem e resultado">
    <line x1="8" x2="${W - 8}" y1="${base}" y2="${base}" class="eixo"/>
    ${lista.map((x, i) => { const x0 = 8 + i * g + g / 2, v = val(x), hv = alt(v, v >= 0 ? cimaPx : baixoPx), hq = alt(x.queda, baixoPx);
      return `<rect x="${x0 - 22}" y="${(v >= 0 ? base - hv : base).toFixed(1)}" width="20" height="${hv.toFixed(1)}" rx="3" class="${v >= 0 ? "ts-barra-sobe" : "ts-barra-desce"}"/>
        <rect x="${x0 + 2}" y="${base}" width="20" height="${hq.toFixed(1)}" rx="3" class="ts-barra-queda"/>
        <text x="${x0 - 12}" y="${(v >= 0 ? base - hv - 4 : base + hv + 11).toFixed(1)}" class="rot" text-anchor="middle">${pct(v, 0)}</text>
        <text x="${x0 + 12}" y="${(base + hq + 11).toFixed(1)}" class="rot" text-anchor="middle">${pct(-x.queda, 0)}</text>
        <text x="${x0}" y="${H - 5}" class="rot forte" text-anchor="middle">${x.lev}×</text>`; }).join("")}
  </svg>
  <p class="fi-ts-legenda"><span><i class="sobe"></i>% ao mês</span><span><i class="queda"></i>pior queda</span></p>`;
  return caixa;
}
/** "Se continuar assim, em 1 ano…": a linha do meio e a faixa otimista/pessimista, em US$. */
export function graficoProjecao(pr) {
  const caixa = document.createElement("div"); caixa.className = "fi-graf-caixa fi-ts-gproj";
  if (!pr) { caixa.innerHTML = `<p class="fi-dica">Com menos de 7 dias medidos, não dá para projetar.</p>`; return caixa; }
  const H = 140, m = { e: 8, d: 8, c: 12, b: 20 };
  const mx = Math.max(...pr.map(p => p.oti)), mn = Math.min(...pr.map(p => p.pes), 1000);
  const x = (i) => m.e + i * (W - m.e - m.d) / (pr.length - 1), y = (v) => m.c + (1 - (v - mn) / (mx - mn || 1)) * (H - m.c - m.b);
  const linha = (k) => pr.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  caixa.innerHTML = `<svg class="fi-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção de 1 ano">
    <polygon points="${linha("oti")} ${pr.map((p, i) => `${x(i).toFixed(1)},${y(p.pes).toFixed(1)}`).reverse().join(" ")}" class="ts-faixa"/>
    <line x1="${m.e}" x2="${W - m.d}" y1="${y(1000)}" y2="${y(1000)}" class="eixo base"/>
    <polyline points="${linha("meio")}" class="ts-linha l-conta"/>
    <text x="${m.e}" y="${H - 5}" class="rot">hoje</text><text x="${W - m.d}" y="${H - 5}" class="rot" text-anchor="end">em 12 meses</text>
  </svg>`;
  return caixa;
}
/** O mapa de calor hora × dia da semana (Brasília) das operações. */
export function mapaHorario(g) {
  const caixa = document.createElement("div"); caixa.className = "fi-ts-calor";
  const mx = Math.max(1, ...g.flat()), dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  caixa.innerHTML = `<div class="fi-ts-calor-g" role="img" aria-label="Operações por hora e dia da semana">${g.map((l, i) => `<span class="d">${dias[i]}</span>${l.map((v, h) => `<i style="--a:${v ? (0.15 + 0.85 * v / mx).toFixed(2) : 0}" title="${dias[i]} ${h}h: ${v}"></i>`).join("")}`).join("")}
    <span></span>${Array.from({ length: 24 }, (_, h) => `<b>${h % 6 === 0 ? h + "h" : ""}</b>`).join("")}</div>`;
  return caixa;
}
