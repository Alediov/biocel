// Escala de humor da Eva (ideia do Alediov, 04/11/2026; docs/plano-eva.md): 5 níveis que mudam devagar, pelos últimos
// dias e não por cada tarefa. Sem dependências (node tools/teste_eva.mjs).
//
// Cada dia vira uma nota de −1 a 1 (`notaDoDia`): a parte do Meu dia que ele fez, uma lição já evita a nota baixa,
// promessa cumprida sobe, tarefa adiada 3 vezes sem motivo desce; "Hoje não dá" com motivo nunca desce. O nível de base
// é a média ponderada dos últimos 5 dias antes de hoje (os mais recentes pesam mais); hoje sobe um nível com qualquer
// coisa feita (dois com 80% do dia) e retomar depois de um dia ruim vale mais. Dia sem abrir o app (depois que a Eva
// começou) conta como ausência: um dia inteiro sem abrir → "sentindo sua falta" enquanto hoje nada foi feito. Nunca
// brava nem decepcionada: o mais baixo é preocupada.

export const NIVEIS = [
  { chave: "radiante", nome: "radiante", rosto: "orgulhosa", cor: "#F5B83D" },
  { chave: "animada", nome: "animada", rosto: "feliz", cor: "#8BD45A" },
  { chave: "tranquila", nome: "tranquila", rosto: "normal", cor: "#7FB4F5" },
  { chave: "preocupada", nome: "preocupada", rosto: "preocupada", cor: "#C39BE8" },
  { chave: "saudade", nome: "sentindo sua falta", rosto: "saudade", cor: "#9AA3C7" },
];
export const nivelPorChave = (k) => Math.max(0, NIVEIS.findIndex(n => n.chave === k));

const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Nota de um dia registrado (r = { f, t, lic, cumpridas, semMotivo, naoDa }) de −1 a 1. */
export function notaDoDia(r) {
  if (!r) return null;
  const t = r.t || 0, f = r.f || 0, lic = r.lic || 0;
  const p = t ? f / t : lic > 0 ? 1 : 0;
  let s = p >= 0.8 ? 1 : p >= 0.5 ? 0.5 : p > 0.15 ? 0 : -0.5;
  if (lic > 0 || f > 0) s = Math.max(s, 0); // uma lição já tira do vermelho
  if (r.naoDa) s = Math.max(s, 0.25); // "Hoje não dá" com motivo: não desce
  s += 0.25 * Math.min(2, r.cumpridas || 0) - 0.25 * Math.min(2, r.semMotivo || 0);
  return clamp(s, -1, 1);
}
/** Nível (0 a 3) de uma nota; a saudade (4) só vem da ausência. */
export const nivelDaNota = (s) => (s >= 0.6 ? 0 : s >= 0.2 ? 1 : s >= -0.25 ? 2 : 3);

/**
 * O humor de hoje. `dias`: { "AAAA-MM-DD": registro } (E().eva.dias); `desde`: o 1º dia da Eva (antes dele, um dia sem
 * registro é desconhecido e usa o `diario` dos Estudos, { data: { licoes: [...] } }, se houver).
 * Devolve { nivel, chave, nome, rosto, cor, base, semana: [{ data, nivel | null, ausente }] } (os 7 dias até hoje).
 */
export function calcularHumor(dias = {}, hoje, { desde = hoje, diario = {} } = {}) {
  const reg = (d) => {
    if (dias[d]) return { r: dias[d], ausente: false };
    const lic = diario[d]?.licoes?.length || 0;
    if (lic) return { r: { lic, f: lic, t: 0 }, ausente: false }; // abriu e estudou (antes da Eva ou num aparelho sem ela)
    if (d >= desde && d < hoje) return { r: null, ausente: true };
    return { r: null, ausente: false };
  };
  // base: os 5 dias antes de hoje
  let soma = 0, peso = 0, ausentesSeguidos = 0, contando = true;
  for (let i = 1; i <= 5; i++) {
    const d = somaDias(hoje, -i), { r, ausente } = reg(d), w = 6 - i;
    if (ausente) { soma += -1 * w; peso += w; if (contando) ausentesSeguidos++; continue; }
    contando = false;
    const s = notaDoDia(r);
    if (s != null) { soma += s * w; peso += w; }
  }
  const base = peso ? soma / peso : 0.25; // sem histórico: começa animada
  let nivel = nivelDaNota(base);
  const h = dias[hoje] || (diario[hoje]?.licoes?.length ? { lic: diario[hoje].licoes.length, f: 0, t: 0 } : null);
  const fezHoje = !!h && ((h.f || 0) > 0 || (h.lic || 0) > 0 || (h.cumpridas || 0) > 0);
  const pHoje = h?.t ? (h.f || 0) / h.t : 0;
  if (fezHoje) {
    nivel -= pHoje >= 0.8 ? 2 : 1;
    // retomar depois de um dia ruim (ou de sumir) vale mais
    const ontem = reg(somaDias(hoje, -1));
    if (ontem.ausente || (notaDoDia(ontem.r) ?? 0) <= -0.5) nivel -= 1;
  } else if (h && (h.semMotivo || 0) >= 2) nivel += 1;
  nivel = clamp(nivel, 0, 3);
  if (!fezHoje && ausentesSeguidos >= 1 && !h?.naoDa) nivel = 4;
  const semana = [];
  for (let i = 6; i >= 0; i--) {
    const d = somaDias(hoje, -i);
    if (i === 0) { semana.push({ data: d, nivel, ausente: false }); continue; }
    const { r, ausente } = reg(d), s = notaDoDia(r);
    semana.push({ data: d, nivel: ausente ? 4 : s == null ? null : nivelDaNota(s), ausente });
  }
  return { nivel, ...NIVEIS[nivel], base: +base.toFixed(3), semana };
}
