// Metas do dia do OdontoScan, calculadas para o trabalho não acumular:
// - Números: confirmar, no dia, pelo menos tantas fichas quantas sobem para a leitura (o que a próxima noite lê),
//   sem passar do que ainda falta confirmar;
// - Revisar: revisar, no dia, pelo menos as fichas lidas que chegaram hoje, mais 1/7 do atraso (o que chegou antes
//   e ainda não foi revisado), para zerar o atraso em uma semana.
// Cada meta pode ser fixa (cfg "metas": { numeros, revisar }: "auto" ou um número).
// Sequência 🔥: dias seguidos em que as duas metas foram cumpridas (dias sem nada a fazer não contam nem quebram).

export const diaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dia = (iso) => iso ? diaLocal(new Date(iso)) : null;
const CONFIRMOU = /^Números (corrigidos e confirmados|confirmados)/; // feitos à mão (os "conferidos sozinhos" não contam)

/** Fichas lidas que ainda esperam a revisão (inclusive as que ainda esperam a confirmação dos números). */
export const aRevisar = (f) => !!f.leitura && f.etapa !== "revisada" && f.etapa !== "erro" && !f.revisadaEm;
export const revisada = (f) => f.etapa === "revisada" || !!f.revisadaEm;

/** Quantas fichas a próxima noite deve ler (a mesma regra do fila.py, de forma aproximada). */
export function proximaNoite(est) {
  if (!est) return 40;
  if (est.andamento?.alvo) return est.andamento.alvo;
  const maximo = est.maximo_por_noite || 150, lim = est.limite || 40, u = est.historico?.at(-1);
  if (u?.terminou && u.alvo && (u.lidas || 0) >= u.alvo && !(est.espera > 0)) {
    const teto = est.teto;
    if (teto && lim >= Math.floor(teto * 0.9)) return Math.min(maximo, lim);
    return Math.min(maximo, teto ? Math.min(Math.ceil(lim * 1.2), Math.floor(teto * 0.9)) : Math.ceil(lim * 1.2));
  }
  return Math.min(maximo, lim);
}

/**
 * fs: fichas do aparelho (sem lixeira); est: estado da fila (estado.json); cfg: { numeros, revisar } ("auto" ou número).
 * Devolve { hoje, num: { feitas, meta, auto, pendentes, noite }, rev: { feitas, meta, auto, chegaram, atraso },
 *           cumpriu, ativo, seq, dias: Map(dia → { rev, cheg, num, env }) }.
 */
export function calcularMetas(fs, est, cfg = {}) {
  const hoje = diaLocal(), dias = new Map();
  const d0 = (k) => { if (!dias.has(k)) dias.set(k, { rev: 0, cheg: 0, num: 0, env: 0 }); return dias.get(k); };
  let atrasoInicio = 0, pendentes = 0;
  for (const f of fs) {
    if (f.etapa === "erro") continue;
    const r = dia(f.revisadaEm), c = dia(f.lidaEm), e = dia(typeof f.enviada === "string" ? f.enviada : null);
    if (r) d0(r).rev++;
    if (c) d0(c).cheg++;
    if (e && !f.numerosAuto) d0(e).env++;
    for (const h of f.historico || []) if (CONFIRMOU.test(h.acao || "")) { const k = dia(h.em); if (k) d0(k).num++; }
    // atraso no começo do dia: lidas antes de hoje e ainda sem revisão (ou revisadas só hoje)
    if (f.leitura && c && c < hoje && (aRevisar(f) || r === hoje)) atrasoInicio++;
    if (f.etapa === "confirmar") pendentes++;
  }
  const h = d0(hoje), noite = proximaNoite(est);
  const autoN = !cfg.numeros || cfg.numeros === "auto", autoR = !cfg.revisar || cfg.revisar === "auto";
  const metaNum = autoN ? Math.min(Math.max(h.env, noite), pendentes + h.num) : Math.min(+cfg.numeros, pendentes + h.num);
  const metaRev = autoR ? h.cheg + Math.ceil(atrasoInicio / 7) : +cfg.revisar;
  const ativo = metaNum > 0 || metaRev > 0;
  const cumpriu = ativo && h.num >= metaNum && h.rev >= metaRev;
  // sequência: dias com trabalho em que revisões ≥ chegadas e números ≥ envios; dias sem nada não contam nem quebram
  let seq = cumpriu ? 1 : 0;
  const d = new Date(); d.setDate(d.getDate() - 1);
  for (let i = 0; i < 181; i++, d.setDate(d.getDate() - 1)) {
    const k = diaLocal(d), x = dias.get(k);
    if (i >= 180) break;
    if (!x || (!x.cheg && !x.env)) continue;
    if (x.rev >= x.cheg && x.num >= x.env) seq++; else break;
  }
  return {
    hoje, cumpriu, ativo, seq, dias,
    num: { feitas: h.num, meta: metaNum, auto: autoN, pendentes, noite },
    rev: { feitas: h.rev, meta: metaRev, auto: autoR, chegaram: h.cheg, atraso: atrasoInicio },
  };
}
