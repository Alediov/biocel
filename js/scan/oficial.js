// Comparar com o oficial (pedido do Alediov, 25/10/2026): as fichas digitalizadas × a produção ambulatorial que a
// clínica apresentou ao SUS (SIA/SUS, DATASUS) pelos dois CNES da Odontologia da UNIOESTE: 3523365 (Unioeste
// Odontologia) e 6391915 (CEO III Unioeste). Os dados oficiais são públicos e agregados (por competência, CNES e
// procedimento), baixados pelo workflow "Dados do SIA (CNES)" (tools/odontoscan/sia.py) para app/dados/sia/unioeste.json.
// A comparação usa o código como foi ESCRITO na ficha (o que é faturado), não o recodificado: o 03.07.01.008-2
// anotado em dente permanente aparece no SIA como 03.07.01.008-2, se foi faturado como estava.
import { procDe, procedimento } from "./processar.js";

export const CNES = { "3523365": "Unioeste Odontologia", "6391915": "CEO III Unioeste" };
let cache = null;
/** Os dados do SIA (ou null fora do app, no OdontoScan.html, ou se ainda não foram baixados). */
export async function carregarSIA() {
  if (cache) return cache;
  if (globalThis.__SIA) return (cache = globalThis.__SIA); // o OdontoScan.html leva os dados dentro (montar_odontoscan.py)
  try {
    const r = await fetch("dados/sia/unioeste.json"); // relativo ao index.html do app
    if (!r.ok) return null;
    cache = await r.json();
    return cache;
  } catch { return null; }
}

const mesDe = (data) => (data && /^\d{4}-\d\d/.test(data) ? data.slice(0, 4) + data.slice(5, 7) : null);
export const nomeMes = (m) => `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m.slice(4) - 1]}/${m.slice(2, 4)}`;

/**
 * `base`: [{ f, r }] (r = revisão); `cnes`: "ambos" | "3523365" | "6391915".
 * Devolve { meses: [{ mes, fichas, sia }], procs: [{ codigo, digitos, nome, fichas, sia, porCnes }], periodo, fichas, sia, foraDoSIA }.
 * Só entram os meses que têm fichas E produção no SIA (o período em comum).
 */
export function comparar(base, sia, { cnes = "ambos", contagem = null } = {}) {
  if (!sia?.procedimentos?.length) return null;
  const vale = (c) => cnes === "ambos" || c === cnes;
  const siaMes = new Map(), siaProc = new Map(), siaProcCnes = new Map();
  for (const [cmp, c, proc, , aprov] of sia.procedimentos) {
    if (!vale(c) || !aprov) continue;
    siaMes.set(cmp, (siaMes.get(cmp) || 0) + aprov);
    siaProc.set(`${cmp}|${proc}`, (siaProc.get(`${cmp}|${proc}`) || 0) + aprov);
    siaProcCnes.set(`${cmp}|${proc}|${c}`, (siaProcCnes.get(`${cmp}|${proc}|${c}`) || 0) + aprov);
  }
  const fMes = new Map(), fProc = new Map();
  // `contagem` ({ "AAAAMM|código": n }): as fichas já contadas (o resumo agregado que o celular recebe do computador)
  if (contagem) for (const [k, v] of Object.entries(contagem)) { const [m] = k.split("|"); fMes.set(m, (fMes.get(m) || 0) + v); fProc.set(k, (fProc.get(k) || 0) + v); }
  for (const { r } of contagem ? [] : base) {
    const m = mesDe(r?.data); if (!m) continue;
    for (const q of r.procedimentos || []) {
      const p = procDe(q, r); if (!p.digitos || p.digitos.length !== 10) continue;
      const cod = p.corrigido ? p.corrigido.digitos : p.digitos; // o código escrito (o faturado)
      fMes.set(m, (fMes.get(m) || 0) + 1);
      fProc.set(`${m}|${cod}`, (fProc.get(`${m}|${cod}`) || 0) + 1);
    }
  }
  const meses = [...fMes.keys()].filter(m => siaMes.has(m)).sort();
  if (!meses.length) return { meses: [], procs: [], periodo: null, fichas: 0, sia: 0, semComum: true, mesesSIA: [...siaMes.keys()].sort(), mesesFichas: [...fMes.keys()].sort() };
  const em = new Set(meses);
  const porProc = new Map();
  const somar = (cod, campo, v, c) => {
    const x = porProc.get(cod) || { fichas: 0, sia: 0, porCnes: {} }; porProc.set(cod, x);
    x[campo] += v; if (c) x.porCnes[c] = (x.porCnes[c] || 0) + v;
  };
  for (const [k, v] of fProc) { const [m, cod] = k.split("|"); if (em.has(m)) somar(cod, "fichas", v); }
  for (const [k, v] of siaProcCnes) { const [m, cod, c] = k.split("|"); if (em.has(m)) somar(cod, "sia", v, c); }
  const procs = [...porProc].map(([d, x]) => { const p = procedimento(d); return { digitos: d, codigo: p.codigo, nome: p.nome || "fora da tabela", ...x }; })
    .sort((a, b) => Math.max(b.sia, b.fichas) - Math.max(a.sia, a.fichas));
  const fichas = meses.reduce((s, m) => s + (fMes.get(m) || 0), 0), siaT = meses.reduce((s, m) => s + (siaMes.get(m) || 0), 0);
  return {
    meses: meses.map(m => ({ mes: m, fichas: fMes.get(m) || 0, sia: siaMes.get(m) || 0 })),
    procs, periodo: [meses[0], meses[meses.length - 1]], fichas, sia: siaT,
    // no SIA mas sem nenhuma ficha (procedimentos inteiros que não chegaram à digitalização)
    soNoSIA: procs.filter(p => p.sia > 0 && p.fichas === 0).length,
    // códigos de resina de decíduo: quantos foram faturados como estavam
    deciduo: ["0307010082", "0307010112"].map(d => ({ codigo: procedimento(d).codigo, sia: porProc.get(d)?.sia || 0, fichas: porProc.get(d)?.fichas || 0 })),
  };
}
