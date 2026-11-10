// Testes de mercado: as contas que o app faz sobre o resumo.json (sem DOM; teste em tools/mercado/teste_app.mjs).
// Tudo aqui é sobre saldos FICTÍCIOS de uma simulação; nada mexe em dinheiro.

export const DIA = 864e5;
/** O dia (AAAA-MM-DD) em Brasília, como o workflow usa nas séries. */
export const diaDe = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
export const maisDias = (dia, n) => new Date(Date.parse(dia + "T12:00:00Z") + n * DIA).toISOString().slice(0, 10);
export const mediana = (l) => { const v = l.filter(x => x != null && Number.isFinite(x)).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };

/** Os períodos do seletor (dias; null = desde o início). */
export const PERIODOS = [["7", "7 dias", 7], ["30", "30 dias", 30], ["tudo", "Desde o início", null]];
export const diasDoPeriodo = (p) => PERIODOS.find(x => x[0] === p)?.[2] ?? null;
/** Critério da melhor combinação: retorno ÷ pior queda, com a queda de no mínimo PISO_QUEDA e pelo menos MIN_OPS operações. */
export const PISO_QUEDA = 0.05, MIN_OPS = 5;

/** As versões, na ordem do seletor, e as alavancagens de cada uma (as do resumo, se ele disser). */
// 09/11/2026: "p20"/"p25"/"p30" param de copiar quem afunda (a cópia cai 20/25/30% do topo e larga a carteira).
export const VERSOES = [["", "Todas"], ["s", "Saídas"], ["l", "Limite"], ["m", "Moedas boas"], ["a2", "×2"], ["a3", "×3"], ["f", "Fixa US$ 50"], ["p25", "Para 25%"], ["p20", "Para 20%"], ["p30", "Para 30%"]];
export const NOME_CURTO = { "": "todas", s: "com saídas", l: "ordem limite", m: "moedas boas", a2: "amplificada ×2", a3: "amplificada ×3", f: "fixa US$ 50", p20: "para ao cair 20%", p25: "para ao cair 25%", p30: "para ao cair 30%" };
export const LEV_PADRAO = { "": [1, 3, 5, 10], s: [3, 5], l: [3, 5], m: [3, 5], a2: [5, 10], a3: [5, 10], f: [2, 5, 10], p20: [3], p25: [3, 5], p30: [3] };
/** As combinações que o resumo diz que existem (`config.combos`, desde 09/11/2026); null no resumo antigo. */
const combosDoResumo = (d) => (Array.isArray(d?.config?.combos) && d.config.combos.length ? d.config.combos : null);
/** As versões que existem no resumo (no antigo, as de antes de 09/11/2026: sem as de parar). */
export function versoesDe(d) {
  const cs = combosDoResumo(d);
  if (!cs) return VERSOES.filter(([v]) => !v.startsWith("p"));
  const tem = new Set(cs.map(k => partes(k)?.versao ?? ""));
  return VERSOES.filter(([v]) => tem.has(v));
}
export function levsDe(d, v) {
  const cs = combosDoResumo(d);
  if (cs) { const l = [...new Set(cs.map(partes).filter(p => p && p.versao === (v || "")).map(p => p.lev))].sort((a, b) => a - b); if (l.length) return l; }
  const l = v ? d?.config?.variantes?.[v]?.alavancagens : d?.config?.alavancagens;
  return l?.length ? l : LEV_PADRAO[v || ""] || [3];
}
export const atrasosDe = (d) => d?.config?.atrasos?.length ? d.config.atrasos : [1, 5];
/** Os atrasos que existem para uma versão e alavancagem (desde 09/11/2026 o de 5 min é só o controle 3×). */
export function atrasosPara(d, v = "", lev = 3) {
  const cs = combosDoResumo(d);
  if (!cs) return atrasosDe(d);
  const l = atrasosDe(d).filter(a => cs.includes(chave(lev, a, v)));
  return l.length ? l : [1];
}
/** Existe a combinação no resumo? (no antigo, as que ele podia ter) */
export const existe = (d, k) => combos(d).includes(k);
/** A alavancagem da versão mais perto de `lev`. */
export function levPara(d, v, lev) {
  const ls = levsDe(d, v);
  return ls.includes(lev) ? lev : ls.reduce((a, b) => (Math.abs(b - lev) < Math.abs(a - lev) ? b : a));
}
export const chave = (lev, atraso, v = "") => `${lev}x${atraso}${v || ""}`;
export function partes(k) {
  const m = /^(\d+)x(\d+)([a-z]\d*)?$/.exec(k || "");
  return m ? { lev: +m[1], atraso: +m[2], versao: m[3] || "" } : null;
}
/** "3× · 1 min · com saídas" */
export function rotulo(k) {
  const p = partes(k);
  return p ? `${p.lev}× · ${p.atraso} min · ${NOME_CURTO[p.versao] ?? p.versao}` : "—";
}
/** Todas as combinações que o resumo pode ter (as do `config.combos`; no resumo antigo, a grade de antes). */
export function combos(d) {
  const cs = combosDoResumo(d);
  if (cs) return [...cs];
  const out = [];
  for (const [v] of versoesDe(d)) for (const lev of levsDe(d, v)) for (const at of atrasosDe(d)) out.push(chave(lev, at, v));
  return out;
}
export const contaDe = (c, k, modo = "vivo") => (modo === "hist" ? c.historico : c.aoVivo)?.[k] || null;

// ------------------------------------------------------------------ séries e períodos
/** A curva da conta, com US$ 1.000 no dia antes do primeiro ponto (ou no dia em que começou). */
export function curva(a) {
  const s = a?.serie || [];
  if (!s.length) return [];
  let d0 = maisDias(s[0][0], -1);
  if (a.inicio) { const di = diaDe(a.inicio); if (di < s[0][0]) d0 = di; }
  return [[d0, 1000], ...s];
}
/** O último dia de uma conta: hoje (ao vivo) ou o fim do teste (histórico). */
const fimDe = (a, hoje) => hoje || a?.serie?.at(-1)?.[0];

/** A conta no período: retorno, pior queda (pelos fechamentos diários; no "desde o início", a do workflow), retorno ÷
 *  queda, dias positivos (entre os dias que mudaram), acerto, ganho médio ÷ perda média e os pontos reescalados para
 *  US$ 1.000 no começo do período. `hoje`: o dia de agora (ao vivo); sem ele, o fim da série. */
export function trecho(a, periodo = "tudo", hoje = null) {
  if (!a) return null;
  const c = curva(a), n = diasDoPeriodo(periodo);
  if (!c.length) return { retorno: a.retorno ?? 0, queda: a.piorQueda ?? 0, pts: [], de: null, ops: a.ops || 0, acerto: a.acerto ?? null, gp: a.gm && a.pm ? a.gm / a.pm : null, diasPos: null, nLiq: a.nLiq || 0, curto: true };
  let base = 0;
  if (n) {
    const corte = maisDias(fimDe(a, hoje), -n);
    for (let i = 0; i < c.length; i++) if (c[i][0] <= corte) base = i;
  }
  const pts = c.slice(base), v0 = pts[0][1];
  const norm = pts.map(([d, v]) => [d, (1000 * v) / v0]);
  let pico = 0, dd = 0, sobe = 0, mexe = 0;
  for (let i = 0; i < norm.length; i++) {
    const v = norm[i][1]; pico = Math.max(pico, v); dd = Math.max(dd, 1 - v / pico);
    if (i) { const dv = v - norm[i - 1][1]; if (Math.abs(dv) > 0.005) { mexe++; if (dv > 0) sobe++; } }
  }
  const tudo = !n || base === 0;
  const retorno = tudo && a.retorno != null ? a.retorno : norm.at(-1)[1] / 1000 - 1;
  const queda = tudo && a.piorQueda != null ? Math.max(a.piorQueda, dd) : dd;
  const corte = n ? maisDias(fimDe(a, hoje), -n) : null;
  const nLiq = !n ? a.nLiq || 0 : (a.liquidacoes || []).filter(l => diaDe(l.em) > corte).length;
  return { retorno, queda, pts: norm, de: norm[0][0], ops: a.ops || 0, acerto: a.acerto ?? null,
    gp: a.gm && a.pm ? a.gm / a.pm : null, diasPos: mexe ? sobe / mexe : null, nLiq, curto: n != null && base === 0 && c[0][0] > maisDias(fimDe(a, hoje), -n) };
}
/** Retorno ÷ pior queda (queda mínima PISO_QUEDA); no prejuízo, o retorno ÷ o piso (ordena pelo tamanho da perda). */
export const razao = (t) => (t ? (t.retorno >= 0 ? t.retorno / Math.max(t.queda, PISO_QUEDA) : t.retorno / PISO_QUEDA) : null);
/** A nota da combinação: a razão, só com amostra mínima de operações. */
export const nota = (t) => (t && t.ops >= MIN_OPS ? razao(t) : null);

/** Uma referência (bitcoin ou CDI) de `de` a `ate`, reescalada para US$ 1.000 em `de`. */
export function referencia(lista, de, ate = null) {
  const l = lista || [];
  const antes = [...l].reverse().find(x => x[0] <= de);
  const resto = l.filter(x => x[0] > de && (!ate || x[0] <= ate));
  const pts = antes ? [[de, antes[1]], ...resto] : resto;
  if (!pts.length) return [];
  const b = pts[0][1];
  return pts.map(([d, v]) => [d, (1000 * v) / b]);
}
export const retornoRef = (lista, de, ate) => { const p = referencia(lista, de, ate); return p.length > 1 ? p.at(-1)[1] / 1000 - 1 : null; };

// ------------------------------------------------------------------ escolhas
const hojeDe = (d, modo) => (modo === "hist" ? null : diaDe(d.agora || Date.now()));
/** A melhor combinação de uma carteira (pela nota), no modo e no período. */
export function melhorDe(d, c, { modo = "vivo", periodo = "tudo" } = {}) {
  let melhor = null;
  for (const k of combos(d)) {
    const t = trecho(contaDe(c, k, modo), periodo, hojeDe(d, modo)), n = nota(t);
    if (n != null && (!melhor || n > melhor.nota)) melhor = { k, t, nota: n };
  }
  return melhor;
}
/** A combinação que é a melhor para mais carteiras: [{k, n, mediana}] (a mediana do retorno nela). */
export function melhorGeral(d, opts = {}) {
  const conta = {};
  for (const c of d.carteiras || []) { const m = melhorDe(d, c, opts); if (m) conta[m.k] = (conta[m.k] || 0) + 1; }
  return Object.entries(conta).map(([k, n]) => ({ k, n, mediana: mediana((d.carteiras || []).map(c => trecho(contaDe(c, k, opts.modo), opts.periodo, hojeDe(d, opts.modo))?.retorno)) }))
    .sort((a, b) => b.n - a.n || (b.mediana ?? -9) - (a.mediana ?? -9));
}
/** Placar numa combinação: quantas à frente do CDI e do bitcoin (no mesmo trecho de cada uma) e quantas no prejuízo. */
export function placar(d, k, { modo = "vivo", periodo = "tudo" } = {}) {
  const r = { cdi: 0, btc: 0, prejuizo: 0, de: 0 };
  for (const c of d.carteiras || []) {
    const t = trecho(contaDe(c, k, modo), periodo, hojeDe(d, modo));
    if (!t?.de) continue;
    const ate = t.pts.at(-1)?.[0];
    r.de++;
    const cdi = retornoRef(d.referencias?.cdi, t.de, ate), btc = retornoRef(d.referencias?.btc, t.de, ate);
    if (cdi != null && t.retorno > cdi) r.cdi++;
    if (btc != null && t.retorno > btc) r.btc++;
    if (t.retorno < 0) r.prejuizo++;
  }
  return r;
}
/** A carteira de carteiras: US$ 1.000 divididos igualmente entre as seguidas, cada uma na sua melhor combinação; a
 *  parte de quem começou depois fica parada até ela começar. */
export function carteiraDeCarteiras(d, opts = {}) {
  const partes = (d.carteiras || []).map(c => ({ c, m: melhorDe(d, c, opts) })).filter(x => x.m?.t?.pts?.length);
  if (!partes.length) return null;
  const cota = 1000 / partes.length;
  const dias = [...new Set(partes.flatMap(x => x.m.t.pts.map(p => p[0])))].sort();
  const pts = dias.map(dia => {
    let soma = 0;
    for (const x of partes) {
      const p = x.m.t.pts; let v = null;
      for (const q of p) { if (q[0] <= dia) v = q[1]; else break; }
      soma += cota * (v == null ? 1 : v / 1000);
    }
    return [dia, soma];
  });
  return { pts, retorno: pts.at(-1)[1] / 1000 - 1, de: dias[0], n: partes.length, cada: partes.map(x => ({ curto: x.c.curto, k: x.m.k })) };
}

/** A grade: alavancagens nas linhas, versões nas colunas (um atraso), com o retorno, a queda e a nota de cada célula
 *  (`c` = uma carteira; sem ela, a mediana de todas) e a melhor célula. */
export function grade(d, { modo = "vivo", periodo = "tudo", atraso = 1, c = null } = {}) {
  // as de parar a 20% e 30% ficam fora da grade (cabe na tela do celular): aparecem em Mais testes
  const versoes = versoesDe(d).filter(([v]) => v !== "p20" && v !== "p30");
  const levs = [...new Set(versoes.flatMap(([v]) => levsDe(d, v)))].sort((a, b) => a - b);
  const lista = c ? [c] : d.carteiras || [];
  const celulas = {};
  let melhor = null;
  for (const lev of levs) for (const [v] of versoes) {
    if (!levsDe(d, v).includes(lev)) continue;
    const k = chave(lev, atraso, v);
    if (!existe(d, k)) continue;
    const ts = lista.map(x => trecho(contaDe(x, k, modo), periodo, hojeDe(d, modo))).filter(Boolean);
    if (!ts.length) continue;
    const t = ts.length === 1 ? ts[0] : { retorno: mediana(ts.map(x => x.retorno)), queda: mediana(ts.map(x => x.queda)), ops: mediana(ts.map(x => x.ops)), n: ts.length };
    const nt = nota(t);
    const meses = ts.map(x => { const e = estimativa(x); return e && !e.cedo ? e.mes : null; }).filter(x => x != null);
    celulas[k] = { ...t, nota: nt, k, mes: meses.length ? mediana(meses) : null };
    if (nt != null && (!melhor || nt > celulas[melhor].nota)) melhor = k;
  }
  return { levs, versoes, celulas, melhor };
}
/** A melhor no histórico × a melhor ao vivo (mesmo atraso e período); `iguais` diz se batem. */
export function consistencia(d, opts = {}) {
  const h = grade(d, { ...opts, modo: "hist" }).melhor, v = grade(d, { ...opts, modo: "vivo" }).melhor;
  return { hist: h, vivo: v, iguais: !!h && h === v };
}

// ------------------------------------------------------------------ operações e novidades
export const TIPOS = { abertura: ["abriu", "aumentou"], fechamento: ["reduziu", "fechou"], liquidacao: ["liquidada"], saida: ["tempo", "stop", "parou"] };
/** As operações copiadas de todas as carteiras numa combinação (as mais novas primeiro), com filtros. */
export function feed(d, k, { moeda = "", carteira = "", tipo = "" } = {}) {
  const out = [];
  for (const c of d.carteiras || []) {
    if (carteira && c.endereco !== carteira) continue;
    for (const o of c.aoVivo?.[k]?.ultimas || []) {
      if (moeda && o.moeda !== moeda) continue;
      if (tipo && !(TIPOS[tipo] || []).includes(o.tipo)) continue;
      out.push({ ...o, endereco: c.endereco, curto: c.curto });
    }
  }
  return out.sort((a, b) => b.em - a.em);
}
/** O que mudou desde `antes` ({agora, carteiras: [endereços]}): operações e liquidações na combinação, carteiras que
 *  entraram e as que saíram. Sem `antes`, null (1ª vez). */
export function novidades(d, antes, k) {
  if (!antes?.agora) return null;
  const ops = feed(d, k).filter(o => o.em > antes.agora);
  const vistas = new Set(antes.carteiras || []);
  return {
    desde: antes.agora,
    ops: ops.length,
    liq: ops.filter(o => o.tipo === "liquidada"),
    entraram: (d.carteiras || []).filter(c => !vistas.has(c.endereco)),
    sairam: (d.encerradas || []).filter(e => e.ate > antes.agora),
  };
}
export const marca = (d) => ({ agora: d.agora, carteiras: (d.carteiras || []).map(c => c.endereco) });

/** A verba de testes aplicada numa curva: cada pedaço do rendimento (`itens` [{dia, valor}] em R$) × pct% entra no dia em
 *  que rendeu (antes do começo da curva, espera parado). Devolve o que entrou, o que teria hoje e desde quando. */
export function verba(itens, pct, pts) {
  const xs = (itens || []).filter(x => x.valor > 0).map(x => ({ dia: x.dia, v: (x.valor * pct) / 100 })).filter(x => x.v > 0);
  if (!xs.length || !pts?.length) return null;
  const fim = pts.at(-1)[1];
  let aplicado = 0, teria = 0;
  for (const x of xs) {
    let v = pts[0][1];
    for (const p of pts) { if (p[0] <= x.dia) v = p[1]; else break; }
    aplicado += x.v; teria += (x.v * fim) / v;
  }
  const desde = xs.map(x => x.dia).sort()[0];
  const meses = Math.max(1, (Date.parse(pts.at(-1)[0]) - Date.parse(desde)) / (30.44 * DIA));
  return { aplicado, teria, desde, porMes: aplicado / meses };
}

// ------------------------------------------------------------------ % estimado (pedido de 22h27: "o lucro estimado ao mês e ao ano em porcentagem")
/** Poupança: 0,5% ao mês + TR quando a Selic está acima de 8,5% ao ano; a TR tem ficado perto de 0,1% ao mês, então
 *  ~0,6% ao mês (~7,4% ao ano). Estimativa fixa, só para comparar. */
export const POUPANCA_MES = 0.006;
export const POUPANCA_ANO = Math.pow(1 + POUPANCA_MES, 12) - 1;
const Z80 = 1.2816; // percentis 10 e 90 da normal
export const diasEntre = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DIA);
/** O % do período, ao mês e ao ano, com a faixa (percentis 10 a 90) pela média ± o erro dos retornos diários:
 *  exp(30 × (média ± 1,28 × desvio ÷ √n)) − 1. Com menos de 7 dias, só o do período (`cedo`); com menos de 30, o ao
 *  mês e o ao ano são extrapolação (`extrapola`). `t`: um trecho (pts diários reescalados para 1.000). */
export function estimativa(t) {
  if (!t?.pts?.length) return null;
  const dias = t.pts.length > 1 ? diasEntre(t.pts[0][0], t.pts.at(-1)[0]) : 0;
  const r = t.retorno ?? (t.pts.at(-1)[1] / t.pts[0][1] - 1);
  const out = { dias, periodo: r, cedo: dias < 7, extrapola: dias < 30 };
  if (out.cedo || r <= -1) return out;
  const lr = [];
  for (let i = 1; i < t.pts.length; i++) if (t.pts[i - 1][1] > 0 && t.pts[i][1] > 0) lr.push(Math.log(t.pts[i][1] / t.pts[i - 1][1]));
  const n = lr.length, mu = Math.log(1 + r) / dias;
  const sd = n > 1 ? Math.sqrt(lr.reduce((s, x) => s + (x - lr.reduce((a, b) => a + b, 0) / n) ** 2, 0) / (n - 1)) : 0;
  const se = n ? sd / Math.sqrt(n) : 0;
  const em = (k, z) => Math.exp(k * (mu + z * se)) - 1;
  return { ...out, mes: em(30, 0), ano: em(365, 0), faixaMes: [em(30, -Z80), em(30, Z80)], faixaAno: [em(365, -Z80), em(365, Z80)] };
}
/** A taxa do CDI de reserva, só para dados antigos sem `cdiAno` nem índice (antes de 09/11/2026 o workflow mandava fixa). */
export const CDI_RESERVA = 0.149;
/** O CDI no mesmo formato. Desde 09/11/2026 o `cdiAno` das referências é a taxa dos últimos 20 dias úteis da série do
 *  Banco Central (FORMATO.md do orbita-testes): ela manda. Com `cdiFonte` "fixa" (o resumo antigo), a taxa pelo índice
 *  dos últimos ≥ 20 dias; sem nada, `CDI_RESERVA`. */
export function cdiTaxas(d) {
  const r = d?.referencias || {}, l = r.cdi || [];
  let ano = null;
  if (r.cdiAno != null && Number.isFinite(+r.cdiAno) && r.cdiFonte !== "fixa") ano = +r.cdiAno;
  if (ano == null && l.length >= 2) {
    const a = l.find(x => diasEntre(x[0], l.at(-1)[0]) <= 60) || l[0], b = l.at(-1), n = diasEntre(a[0], b[0]);
    if (n >= 20 && b[1] > a[1]) ano = Math.pow(b[1] / a[1], 365 / n) - 1;
  }
  if (ano == null) ano = r.cdiAno != null && Number.isFinite(+r.cdiAno) ? +r.cdiAno : CDI_RESERVA;
  return { ano, mes: Math.pow(1 + ano, 1 / 12) - 1 };
}

// ------------------------------------------------------------------ métricas comuns (`conta.metricas`, desde 09/11/2026)
/** Os mínimos de dias de cada número (os mesmos do `conta.metricas` do orbita-testes). */
export const MIN_DIAS_MES = 7, MIN_DIAS_ANO = 30, MIN_DIAS_SHARPE = 14, MIN_QUEDA_RPQ = 0.005;
const limitar = (v, m) => Math.max(-m, Math.min(m, v));
/** As métricas de uma conta pela série diária e o índice do CDI, como o `conta.metricas` do orbita-testes (reserva para
 *  dados antigos, sem o campo): `a` = a conta ({inicio, serie, retorno, piorQueda}), `refs` = { referencias: { cdi,
 *  cdiAno, cdiFonte } } (o `cdi` é o índice acumulado). Do dia do início (US$ 1.000) ao último ponto; dias sem ponto
 *  repetem o valor anterior. O CDI de cada dia pelo índice; fora dele, a taxa de agora nos dias úteis. */
export function calcularMetricas(a, refs = null) {
  const s = a?.serie || [];
  if (!s.length) return null;
  const pontos = new Map(s);
  let ini = s[0][0];
  if (a.inicio) { const di = diaDe(a.inicio); if (di < ini) ini = di; }
  const fim = s.reduce((m, x) => (x[0] > m ? x[0] : m), s[0][0]);
  const vals = [];
  let v = 1000;
  for (let dia = ini; dia <= fim && vals.length < 4000; dia = maisDias(dia, 1)) { if (pontos.has(dia)) v = pontos.get(dia); vals.push([dia, v]); }
  const dias = diasEntre(ini, fim), retorno = vals.at(-1)[1] / 1000 - 1;
  const idx = refs?.referencias?.cdi || [], mapa = new Map(idx), primeiro = idx[0]?.[0] || "", ultimo = idx.at(-1)?.[0] || "";
  const diaria = Math.pow(1 + cdiTaxas(refs).ano, 1 / 252) - 1;
  const cdiDoDia = (dia) => {
    const ant = maisDias(dia, -1);
    if (mapa.has(dia) && mapa.has(ant) && mapa.get(ant) > 0) return mapa.get(dia) / mapa.get(ant) - 1;
    const sem = new Date(dia + "T12:00:00Z").getUTCDay();
    return (dia > ultimo || dia < primeiro) && sem >= 1 && sem <= 5 ? diaria : 0;
  };
  const rets = [], livres = [];
  let acc = 1;
  for (let i = 1; i < vals.length; i++) {
    const rf = cdiDoDia(vals[i - 1][0]);
    acc *= 1 + rf;
    if (vals[i - 1][1] > 0) { rets.push(vals[i][1] / vals[i - 1][1] - 1); livres.push(rf); }
  }
  const n = rets.length, media = n ? rets.reduce((x, y) => x + y, 0) / n : 0;
  const dp = n > 1 ? Math.sqrt(rets.reduce((x, r) => x + (r - media) ** 2, 0) / (n - 1)) : 0;
  const base = Math.max(0, 1 + retorno);
  const aoMes = dias >= MIN_DIAS_MES ? Math.pow(base, 30 / dias) - 1 : null;
  const aoAno = dias >= MIN_DIAS_ANO ? Math.pow(base, 365 / dias) - 1 : null;
  const queda = +(a.piorQueda || 0);
  let sharpe = null;
  if (n >= 2 && dias >= MIN_DIAS_SHARPE && dp > 1e-9) {
    const ex = rets.map((r, i) => r - livres[i]), me = ex.reduce((x, y) => x + y, 0) / n;
    sharpe = limitar((me / dp) * Math.sqrt(365), 10);
  }
  return {
    dias, retorno, cdi: acc - 1, excesso: (1 + retorno) / acc - 1, venceCdi: 1 + retorno > acc,
    aoMes, aoAno, volAno: n >= 2 ? dp * Math.sqrt(365) : null, sharpe,
    retornoPorQueda: aoAno != null && queda >= MIN_QUEDA_RPQ ? aoAno / queda : null,
    piorDia: n ? Math.min(...rets) : null, diasPositivos: n ? rets.filter(x => x > 0).length / n : null,
    calculado: true,
  };
}
/** As métricas da conta: as do workflow (`a.metricas`) quando existem; senão as calculadas aqui (`calculado: true`). */
export function metricasDe(a, refs = null) {
  if (!a) return null;
  if (a.metricas && typeof a.metricas === "object" && a.metricas.dias != null) return a.metricas;
  return calcularMetricas(a, refs);
}
/** A estimativa com o % ao mês e ao ano das métricas do workflow (que medem o mesmo período, desde o início): só quando
 *  existem; a faixa continua a da estimativa do app. */
export function comMetricas(e, m) {
  if (!e || !m || m.calculado) return e;
  const out = { ...e };
  if (m.aoMes != null && !e.cedo) out.mes = m.aoMes;
  if (m.aoAno != null && !e.cedo) out.ano = m.aoAno;
  return out;
}
/** "ganhando" | "perdendo" | "cedo" do CDI: só sai de "cedo" com 14+ dias, 10+ operações e a faixa toda de um lado. */
export function semaforo(est, cdiMes, ops = 0) {
  if (!est || est.cedo || est.dias < 14 || ops < 10 || !est.faixaMes) return "cedo";
  if (est.faixaMes[0] > cdiMes) return "ganhando";
  if (est.faixaMes[1] < cdiMes) return "perdendo";
  return "cedo";
}
/** Risco em 3 níveis pela pior queda, liquidações e alavancagem de verdade. */
export function nivelRisco({ queda = 0, nLiq = 0, alav = 1 } = {}) {
  if (queda >= 0.3 || nLiq >= 2 || alav >= 8) return "alto";
  if (queda >= 0.12 || nLiq >= 1 || alav >= 3) return "médio";
  return "baixo";
}
/** A alavancagem de verdade de uma cópia: a da carteira (perfil) × o jeito (×2, ×3), até a da conta. */
export function alavDaCopia(c, k) {
  const p = partes(k), ef = c?.perfil?.parametros?.alavEfetiva || 1;
  if (!p) return ef;
  if (p.versao === "f") return Math.min(p.lev, p.lev * 0.05 * 4); // US$ 50 × lev em até ~4 posições, sobre US$ 1.000
  const amp = p.versao === "a2" ? 2 : p.versao === "a3" ? 3 : 1;
  return Math.min(p.lev, ef * amp);
}
/** O nome do jeito em linguagem simples: "Proporcional 3× · 1 min", "Dobro 5× · 1 min", "Fixa US$ 50 2× · 5 min"… */
export const NOME_JEITO = { "": "Proporcional", s: "Proporcional com saídas", l: "Proporcional com ordem limite", m: "Só moedas boas", a2: "Dobro", a3: "Triplo", f: "Fixa US$ 50", p20: "Para ao cair 20%", p25: "Para ao cair 25%", p30: "Para ao cair 30%" };
export function nomeJeito(k) { const p = partes(k); return p ? `${NOME_JEITO[p.versao] ?? p.versao} ${p.lev}× · ${p.atraso} min` : "—"; }

// ------------------------------------------------------------------ séries para os gráficos
/** O % de cada mês: [{mes "AAAA-MM", r}], pelo último valor de cada mês sobre o do mês anterior (ou o começo). */
export function porMes(pts) {
  const out = [];
  let ant = pts?.[0]?.[1], mes = null, ult = null;
  for (const [d, v] of pts || []) {
    const m = d.slice(0, 7);
    if (mes && m !== mes) { out.push({ mes, r: ult / ant - 1 }); ant = ult; }
    mes = m; ult = v;
  }
  if (mes && ant) out.push({ mes, r: ult / ant - 1 });
  return out;
}
/** Quanto abaixo do melhor momento a conta estava, dia a dia: [[dia, fração negativa ou 0]]. */
export function quedaSerie(pts) {
  let pico = 0;
  return (pts || []).map(([d, v]) => { pico = Math.max(pico, v); return [d, pico ? v / pico - 1 : 0]; });
}
/** A projeção de 1 ano no ritmo estimado: [{m, meio, oti, pes}] em US$ partindo de `base`. */
export function projecao(est, base = 1000, meses = 12) {
  if (!est?.faixaMes) return null;
  const out = [];
  for (let m = 0; m <= meses; m++) out.push({ m, meio: base * (1 + est.mes) ** m, oti: base * (1 + est.faixaMes[1]) ** m, pes: Math.max(0, base * (1 + est.faixaMes[0]) ** m) });
  return out;
}
/** Aplicar `porMes` reais por mês durante 12 meses à taxa mensal `i` (valor no fim). */
export const aplicarMensal = (porMesBRL, i, meses = 12) => (Math.abs(i) < 1e-9 ? porMesBRL * meses : porMesBRL * ((1 + i) ** meses - 1) / i * (1 + i));

// ------------------------------------------------------------------ carteira de carteiras numa combinação e o ranking dos jeitos
/** Como `carteiraDeCarteiras`, mas todas na MESMA combinação `k` (sem escolher depois de ver). */
export function carteiraNaCombinacao(d, k, { modo = "vivo", periodo = "tudo" } = {}) {
  const hoje = hojeDe(d, modo);
  const partes = (d.carteiras || []).map(c => ({ c, t: trecho(contaDe(c, k, modo), periodo, hoje) })).filter(x => x.t?.pts?.length);
  if (!partes.length) return null;
  const cota = 1000 / partes.length;
  const dias = [...new Set(partes.flatMap(x => x.t.pts.map(p => p[0])))].sort();
  const pts = dias.map(dia => {
    let soma = 0;
    for (const x of partes) { let v = null; for (const q of x.t.pts) { if (q[0] <= dia) v = q[1]; else break; } soma += cota * (v == null ? 1 : v / 1000); }
    return [dia, soma];
  });
  const r = pts.at(-1)[1] / 1000 - 1;
  let pico = 0, dd = 0;
  for (const [, v] of pts) { pico = Math.max(pico, v); dd = Math.max(dd, 1 - v / pico); }
  return { pts, retorno: r, queda: dd, de: dias[0], n: partes.length, ops: partes.reduce((s, x) => s + (x.t.ops || 0), 0), nLiq: partes.reduce((s, x) => s + (x.t.nLiq || 0), 0) };
}
/** Os jeitos de copiar do melhor para o pior, pelo % ao mês estimado da carteira de carteiras em cada um. */
export function rankingJeitos(d, opts = {}, c = null) {
  const out = [];
  for (const k of combos(d)) {
    const t = c ? trecho(contaDe(c, k, opts.modo), opts.periodo, hojeDe(d, opts.modo)) : carteiraNaCombinacao(d, k, opts);
    if (!t?.pts?.length) continue;
    const est = estimativa(t);
    const alav = c ? alavDaCopia(c, k) : mediana((d.carteiras || []).map(x => alavDaCopia(x, k))) || 1;
    out.push({ k, t, est, risco: nivelRisco({ queda: t.queda, nLiq: t.nLiq, alav }), valor: est?.mes ?? est?.periodo ?? t.retorno });
  }
  return out.sort((a, b) => b.valor - a.valor);
}
/** Alavancagem × resultado (o jeito proporcional, um atraso): [{lev, est, queda}] de uma carteira ou da carteira de carteiras. */
export function porAlavancagem(d, { modo = "vivo", periodo = "tudo", atraso = 1, c = null } = {}) {
  return levsDe(d, "").map(lev => {
    const k = chave(lev, atraso, "");
    const t = c ? trecho(contaDe(c, k, modo), periodo, hojeDe(d, modo)) : carteiraNaCombinacao(d, k, { modo, periodo });
    return t?.pts?.length ? { lev, est: estimativa(t), queda: t.queda, retorno: t.retorno } : null;
  }).filter(Boolean);
}

// ------------------------------------------------------------------ a linha do tempo em frases
const LADO = { compra: "compra", venda: "venda" };
/** Um acontecimento em frase: "Comprou BTC", "Foi liquidada em ETH, perdeu US$ 40"… (o valor vai à parte). */
export function fraseOp(o) {
  const m = o.moeda, compra = o.lado === "compra";
  switch (o.tipo) {
    case "abriu": return compra ? `Comprou ${m}` : `Vendeu ${m} (aposta na queda)`;
    case "aumentou": return compra ? `Comprou mais ${m}` : `Aumentou a aposta na queda de ${m}`;
    case "reduziu": return `Realizou parte de ${m}`;
    case "fechou": return `Fechou ${m}`;
    case "liquidada": return `Foi liquidada em ${m}`;
    case "tempo": return `Saiu de ${m} depois de 3 dias`;
    case "stop": return `Saiu de ${m} pelo stop de 5%`;
    case "parou": return m ? `Parou de copiar: fechou ${m} e largou a carteira` : "Parou de copiar: largou a carteira";
    default: return `${o.tipo} ${m} ${LADO[o.lado] || ""}`.trim();
  }
}
export const TIPOS_TEMPO = { ...TIPOS, carteiras: [] };
/** A linha do tempo: as operações da combinação + as carteiras que entraram e saíram, as mais novas primeiro. */
export function linhaDoTempo(d, k, { moeda = "", carteira = "", tipo = "" } = {}) {
  const out = [];
  if (tipo !== "carteiras") for (const o of feed(d, k, { moeda, carteira, tipo })) out.push({ em: o.em, tipo: o.tipo, frase: fraseOp(o), res: o.res, curto: o.curto, endereco: o.endereco, moeda: o.moeda });
  if ((!tipo || tipo === "carteiras") && !moeda) {
    for (const c of d.carteiras || []) if (!carteira || c.endereco === carteira) out.push({ em: c.desde, tipo: "entrou", frase: `A carteira ${c.curto} entrou`, porque: (c.motivos || []).slice(0, 2).join("; "), curto: c.curto, endereco: c.endereco });
    for (const e of d.encerradas || []) if (!carteira || e.endereco === carteira) out.push({ em: e.ate, tipo: "saiu", frase: `A carteira ${e.curto || e.endereco?.slice(0, 6)} saiu`, porque: e.motivo, res: null, retorno: e.retorno, curto: e.curto });
  }
  return out.sort((a, b) => b.em - a.em);
}

// ------------------------------------------------------------------ os testes a mais (09/11/2026, `agregadas` e `passado` do resumo)
/** As contas de carteira de carteiras e o Consenso, na ordem da tela: [{id, nome, regra, conta…}] (só as que existem). */
export const ORDEM_AGREGADAS = ["top5", "consenso", "robos", "humanos"];
export function agregadas(d) {
  const a = d?.agregadas;
  if (!a || typeof a !== "object") return [];
  return ORDEM_AGREGADAS.filter(k => a[k]?.serie?.length).map(k => ({ id: k, ...a[k] }));
}
/** Uma conta "lista" (de agregadas ou do teste fora da amostra) vista como um trecho do app (com o período). */
export function trechoConta(a, periodo = "tudo", hoje = null) { return a?.serie?.length ? trecho(a, periodo, hoje) : null; }
/** O teste fora da amostra: { resultado, andamento, rodadas } (ou null no resumo antigo). */
export function foraDaAmostra(d) {
  const p = d?.passado;
  if (!p || typeof p !== "object") return null;
  const r = p.resultado && typeof p.resultado === "object" ? p.resultado : null;
  return { resultado: r, andamento: p.andamento || null, rodadas: Array.isArray(p.rodadas) ? p.rodadas : [], proximo: p.proximo || null };
}
/** O resultado do teste fora da amostra numa combinação (a média das escolhidas), como um trecho; null se não houver. */
export function foraNaCombinacao(d, k = "3x1") {
  const r = foraDaAmostra(d)?.resultado, a = r?.contas?.[k];
  if (!a?.serie?.length) return null;
  const t = trecho(a, "tudo", null);
  return t ? { ...t, n: r.n, de: diaDe(r.de), ate: diaDe(r.ate), conta: a } : null;
}
/** As versões de parar de uma carteira de carteiras (proporcional 3× × para 20/25/30%): [{k, t, est, pararam}]. */
export function compararParadas(d, opts = { modo: "vivo", periodo: "tudo" }) {
  const out = [];
  for (const k of ["3x1", "3x1p20", "3x1p25", "3x1p30", "5x1", "5x1p25"]) {
    if (!existe(d, k)) continue;
    const t = carteiraNaCombinacao(d, k, opts);
    if (!t?.pts?.length) continue;
    const pararam = (d.carteiras || []).filter(c => contaDe(c, k, opts.modo)?.parou).length;
    out.push({ k, t, est: estimativa(t), pararam: partes(k).versao ? pararam : null });
  }
  return out;
}
