// Eventos sazonais (voltam todo ano na mesma época) e eventos acadêmicos
// (seminários e trabalhos, com trilha própria que fica disponível para sempre).
import { E, salvar, hojeISO, somaDias, ganhar } from "./estado.js";
import { CARTAS } from "./colecao.js";
import { listarExtras } from "./dados.js";
import { DEMO } from "./edicao.js";

// ---------------- datas ----------------
function pascoa(ano) { // algoritmo de Meeus/Jones/Butcher
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
const fixa = (ini, fim) => (ano) => [`${ano}-${ini}`, fim < ini ? `${ano + 1}-${fim}` : `${ano}-${fim}`];

export const SAZONAIS = [
  { id: "carnaval", nome: "Carnaval", icone: "🎊", cor: "#9B5CF6", moeda: { nome: "Confetes", icone: "🎊" }, janela: (a) => [somaDias(pascoa(a), -51), somaDias(pascoa(a), -46)], chapeu: "plumas", carta: "confete", enfeites: ["🎊", "🎉", "✨"] },
  { id: "pascoa", nome: "Páscoa", icone: "🐰", cor: "#F07BB0", moeda: { nome: "Ovos", icone: "🥚" }, janela: (a) => [somaDias(pascoa(a), -7), somaDias(pascoa(a), 1)], chapeu: "coelho", carta: "cora", enfeites: ["🥚", "🐰", "🌱"] },
  { id: "junina", nome: "Festa Junina", icone: "🔥", cor: "#E8742A", moeda: { nome: "Milhos", icone: "🌽" }, janela: fixa("06-12", "06-29"), chapeu: "palha", carta: "juninha", enfeites: ["🌽", "🔥", "🎉"] },
  { id: "criancas", nome: "Dia das Crianças", icone: "🧸", cor: "#F28A1E", moeda: { nome: "Pirulitos", icone: "🍭" }, janela: fixa("10-10", "10-14"), chapeu: "helice", carta: "pirulito", enfeites: ["🍭", "🎈", "🧸"] },
  { id: "dentista", nome: "Dia do Cirurgião-Dentista", icone: "🦷", cor: "#2F6BFF", moeda: { nome: "Dentinhos", icone: "🦷" }, janela: fixa("10-25", "10-27"), chapeu: "touca_dente", carta: "dentina", enfeites: ["🦷", "🪥", "✨"] },
  { id: "halloween", nome: "Halloween", icone: "🎃", cor: "#E8742A", moeda: { nome: "Doces", icone: "🍬" }, janela: fixa("10-29", "11-02"), chapeu: "bruxa", carta: "fantasminha", enfeites: ["🎃", "🍬", "🌙"] },
  { id: "aniversario", nome: "Seu aniversário", icone: "🎂", cor: "#F07BB0", moeda: { nome: "Balões", icone: "🎈" }, janela: fixa("11-06", "11-08"), chapeu: "festa", carta: "festeira", enfeites: ["🎈", "🎉", "🎂"], presente: true },
  { id: "natal", nome: "Natal", icone: "🎄", cor: "#12A37A", moeda: { nome: "Flocos", icone: "❄️" }, janela: fixa("12-18", "12-26"), chapeu: "gorro", carta: "noelzinho", enfeites: ["❄️", "🎄", "🎁"] },
  { id: "ano_novo", nome: "Ano-Novo", icone: "🎆", cor: "#C98A0C", moeda: { nome: "Brilhos", icone: "✨" }, janela: fixa("12-29", "01-03"), chapeu: "cartola", carta: "estrelinha", enfeites: ["🎆", "✨", "🌠"] },
];
// na versão Demo não há o aniversário (é o do Alediov)
if (DEMO) SAZONAIS.splice(SAZONAIS.findIndex(e => e.id === "aniversario"), 1);
export const sazonal = (id) => SAZONAIS.find(e => e.id === id);

/** Evento sazonal ativo hoje (ou null), com a janela e a chave do ano. */
export function eventoAtivo(hoje = hojeISO()) {
  const ano = +hoje.slice(0, 4);
  for (const ev of SAZONAIS) for (const a of [ano - 1, ano]) {
    const [ini, fim] = ev.janela(a);
    if (hoje >= ini && hoje <= fim) return { ...ev, ini, fim, chave: `${ev.id}-${a}` };
  }
  return null;
}
/** Próximas ocorrências de cada evento sazonal (para o calendário). */
export function proximosSazonais(hoje = hojeISO()) {
  const ano = +hoje.slice(0, 4);
  return SAZONAIS.map(ev => {
    for (const a of [ano - 1, ano, ano + 1]) { const [ini, fim] = ev.janela(a); if (fim >= hoje) return { ...ev, ini, fim }; }
    return null;
  }).filter(Boolean).sort((a, b) => a.ini.localeCompare(b.ini));
}

// ---------------- estado e moeda do evento ----------------
export const MISSOES = [
  { id: "licoes", texto: "Concluir 8 lições", meta: 8, premio: 60 },
  { id: "perfeitas", texto: "Fazer 3 lições perfeitas", meta: 3, premio: 60 },
  { id: "jogos", texto: "Jogar 3 partidas de minijogos", meta: 3, premio: 40 },
  { id: "dias", texto: "Estudar em 2 dias diferentes", meta: 2, premio: 60 },
];
export function estadoEvento(ev = eventoAtivo()) {
  if (!ev) return null;
  const est = E();
  est.sazonais ??= {};
  return (est.sazonais[ev.chave] ??= { moeda: 0, cont: { licoes: 0, perfeitas: 0, jogos: 0, dias: [] }, resgatadas: [], presente: false });
}
export function progressoMissao(m, st) { return Math.min(m.meta, m.id === "dias" ? st.cont.dias.length : st.cont[m.id] || 0); }
export function resgatarMissao(mid) {
  const st = estadoEvento(), m = MISSOES.find(x => x.id === mid);
  if (!st || !m || st.resgatadas.includes(mid) || progressoMissao(m, st) < m.meta) return 0;
  st.resgatadas.push(mid); st.moeda += m.premio; salvar();
  return m.premio;
}
/** Chamado ao concluir uma lição ou um minijogo. Devolve a moeda ganha (ou 0). */
export function creditarEvento(tipo, { perfeita = false } = {}) {
  const st = estadoEvento();
  if (!st) return 0;
  let ganho = 0;
  if (tipo === "licao") {
    st.cont.licoes++; ganho = 10;
    if (perfeita) { st.cont.perfeitas++; ganho += 5; }
    const h = hojeISO(); if (!st.cont.dias.includes(h)) st.cont.dias.push(h);
  } else if (tipo === "jogo") {
    st.cont.jogos++; ganho = st.cont.jogos <= 12 ? 5 : 0;
  }
  st.moeda += ganho; salvar();
  return ganho;
}
export function gastarMoedaEvento(n) { const st = estadoEvento(); if (!st || st.moeda < n) return false; st.moeda -= n; salvar(); return true; }

export const LOJA_EVENTO = [
  { id: "chapeu", nome: "Chapéu exclusivo do avatar", preco: 150 },
  { id: "bau", nome: "Baú do evento (cartas exclusivas)", preco: 120, repete: true },
  { id: "pocao", nome: "Poção ×2 (15 min)", preco: 60, repete: true },
];
export const cartaDoEvento = (ev) => CARTAS[ev.carta];

// ---------------- eventos acadêmicos ----------------
export async function eventosAcademicos() {
  const lista = await listarExtras("evento:");
  return lista.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
}
export function progressoAcademico(ev) {
  const ids = (ev.licoes || []).map(l => l.id);
  return { feitas: ids.filter(id => E().concluidas[id]).length, total: ids.length };
}
/** Evento acadêmico vira uma "trilha" no formato de um dia, para reaproveitar o desenho da trilha. */
export function diaDoEvento(ev) {
  // Com "dias", cada dia de preparo vira uma sessão que libera na sua data (as atrasadas continuam abertas).
  if (Array.isArray(ev.dias) && ev.dias.length) {
    const por = Object.fromEntries((ev.licoes || []).map(l => [l.id, l]));
    const sessoes = ev.dias.map((d, k) => ({ id: `ev-${ev.id}-d${k + 1}`, periodo: "evento", titulo: d.titulo, diaN: k + 1, liberaEm: d.data, licoes: d.licoes.map(id => por[id]).filter(Boolean) }));
    return { data: `ev-${ev.id}`, tema: ev.nome, disciplina: ev.disciplina || "", sessoes };
  }
  return { data: `ev-${ev.id}`, tema: ev.nome, disciplina: ev.disciplina || "", sessoes: [{ id: `ev-${ev.id}`, periodo: "evento", titulo: ev.nome, licoes: ev.licoes || [] }] };
}
export function quandoEvento(ev, hoje = hojeISO()) {
  if (!ev.data) return "";
  const br = new Date(ev.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (ev.data === hoje) return `Apresentação hoje (${br})`;
  if (ev.data === somaDias(hoje, 1)) return `Apresentação amanhã (${br})`;
  if (ev.data > hoje) return `Apresentação em ${br}`;
  return `Apresentado em ${br}. Fica aqui para revisar quando quiser.`;
}
export function checkinAcademico(ev, como) {
  const est = E();
  est.eventosAc ??= {};
  if (est.eventosAc[ev.id]?.checkin) return null;
  est.eventosAc[ev.id] = { checkin: como, quando: new Date().toISOString() };
  const xp = ganhar(como === "otima" ? 60 : 40, 20, `Apresentação: ${ev.nome}`, "curriculo");
  salvar();
  return xp;
}
