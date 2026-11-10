// Títulos: conquistados só por feitos. Um equipado por vez, com bônus.
import { E, salvar, estatisticas, nivel } from "./estado.js";
import { CARTAS } from "./colecao.js";
import { nivelColecionador } from "./colecionador.js";

export const stats = estatisticas;

const presencas = () => Object.values(E().agenda?.presencas || {}).filter(s => s === "presente").length;
const cartas = () => Object.keys(E().colecao?.cartas || {});
// currículo (mesma regra de seção do curriculo.js: evento e palestra → Eventos; curso → Formação complementar)
const ativs = () => E().curriculo?.atividades || [];
const secao = (a) => a.secao || ({ evento: "eventos", palestra: "eventos", curso: "formacao" })[a.tipo] || "outras";
const nSecao = (k) => ativs().filter(a => secao(a) === k).length;
const horas = () => ativs().reduce((t, a) => t + (Number(a.horas) || 0), 0);

export const TITULOS = [
  { id: "primeiros", nome: "Primeiros Passos", cor: "#5C8DD6", req: "Concluir 1 lição", meta: 1, valor: () => stats().licoes, bonus: { tipo: "xp", v: 2 } },
  { id: "dedicado", nome: "Estudante Dedicado", cor: "#5C8DD6", req: "3 dias de ofensiva", meta: 3, valor: () => E().ofensiva.recorde, bonus: { tipo: "moedas", v: 3 } },
  { id: "semana", nome: "Semana Implacável", cor: "#F28A1E", req: "7 dias de ofensiva", meta: 7, valor: () => E().ofensiva.recorde, bonus: { tipo: "xp", v: 5 } },
  { id: "mes", nome: "Mês de Ferro", cor: "#9B5CF6", req: "30 dias de ofensiva", meta: 30, valor: () => E().ofensiva.recorde, bonus: { tipo: "xp", v: 10 } },
  { id: "centena", nome: "Centena", cor: "#5C8DD6", req: "Responder 100 exercícios", meta: 100, valor: () => stats().exercicios, bonus: { tipo: "xp", v: 4 } },
  { id: "mil", nome: "Mil Respostas", cor: "#9B5CF6", req: "Responder 1.000 exercícios", meta: 1000, valor: () => stats().exercicios, bonus: { tipo: "xp", v: 8 } },
  { id: "perfeccionista", nome: "Perfeccionista", cor: "#F28A1E", req: "10 lições perfeitas", meta: 10, valor: () => stats().perfeitas, bonus: { tipo: "xpPerfeita", v: 15 } },
  { id: "madrugador", nome: "Madrugador", cor: "#F28A1E", req: "20 lições antes das 8h", meta: 20, valor: () => stats().madrugador, bonus: { tipo: "xpManha", v: 10 } },
  { id: "almoco", nome: "Almoço Produtivo", cor: "#F28A1E", req: "20 lições da tarde", meta: 20, valor: () => stats().tarde, bonus: { tipo: "xpTarde", v: 10 } },
  { id: "coruja", nome: "Coruja Noturna", cor: "#F28A1E", req: "20 lições depois das 18h", meta: 20, valor: () => stats().coruja, bonus: { tipo: "xpNoite", v: 10 } },
  { id: "presente", nome: "Sempre Presente", cor: "#F28A1E", req: "30 presenças confirmadas", meta: 30, valor: presencas, bonus: { tipo: "presenca", v: 20 } },
  { id: "cacador", nome: "Caçador de Baús", cor: "#F28A1E", req: "Abrir 10 baús", meta: 10, valor: () => E().baus?.abertos || 0, bonus: { tipo: "bauTempo", v: 10 } },
  { id: "alquimista", nome: "Alquimista", cor: "#9B5CF6", req: "Usar 10 poções", meta: 10, valor: () => stats().pocoes, bonus: { tipo: "pocaoDuracao", v: 25 } },
  { id: "colecionador", nome: "Colecionador", cor: "#9B5CF6", req: "Ter 8 cartas diferentes", meta: 8, valor: () => cartas().length, bonus: { tipo: "moedas", v: 6 } },
  { id: "lenda", nome: "Lenda Viva", cor: "#E0434A", req: "Conseguir uma carta lendária", meta: 1, valor: () => cartas().filter(id => CARTAS[id]?.raridade === "lendaria").length, bonus: { tipo: "gemaChance", v: 3 } },
  { id: "curriculo", nome: "Currículo de Peso", cor: "#9B5CF6", req: "60 atividades no currículo", meta: 60, valor: () => E().curriculo?.atividades?.length || 0, bonus: { tipo: "curriculo", v: 20 } },
  { id: "nota10", nome: "Nota Dez", cor: "#E0434A", req: "Tirar 9 ou mais em uma avaliação", meta: 9, valor: () => stats().notaMax, bonus: { tipo: "moedas", v: 5 } },
  { id: "fliperama", nome: "Fliperama", cor: "#5C8DD6", req: "Jogar 20 partidas de minijogos", meta: 20, valor: () => stats().jogos || 0, bonus: { tipo: "moedas", v: 4 } },
  { id: "orador", nome: "Orador(a)", cor: "#F28A1E", req: "Registrar como foi um seminário", meta: 1, valor: () => Object.values(E().eventosAc || {}).filter(x => x.checkin).length, bonus: { tipo: "curriculo", v: 10 } },
  { id: "festeiro", nome: "Espírito de Festa", cor: "#9B5CF6", req: "Conseguir 3 cartas de evento", meta: 3, valor: () => cartas().filter(id => CARTAS[id]?.evento).length, bonus: { tipo: "xp", v: 6 } },
  { id: "dedoverde", nome: "Dedo Verde", cor: "#5C8DD6", req: "Regar o jardim 7 vezes", meta: 7, valor: () => E().jardim?.regas || 0, bonus: { tipo: "moedas", v: 3 } },
  { id: "campeao", nome: "Campeão da Liga", cor: "#F28A1E", req: "Terminar uma semana em 1º lugar na liga", meta: 1, valor: () => E().liga?.vitorias || 0, bonus: { tipo: "xp", v: 4 } },
  { id: "diamante", nome: "Diamante", cor: "#E0434A", req: "Chegar à Liga Diamante", meta: 8, valor: () => (E().liga?.melhor ?? -1) + 1, bonus: { tipo: "xp", v: 8 } },
  { id: "botanico", nome: "Botânico", cor: "#9B5CF6", req: "Ter 8 plantas diferentes", meta: 8, valor: () => Object.keys(E().jardim?.plantas || {}).length, bonus: { tipo: "xp", v: 5 } },
  { id: "zoologico", nome: "Zoológico Completo", cor: "#E0434A", req: "Ter 30 cartas diferentes", meta: 30, valor: () => cartas().length, bonus: { tipo: "moedas", v: 10 } },
  { id: "paisagista", nome: "Paisagista", cor: "#E0434A", req: "Ter 18 plantas diferentes", meta: 18, valor: () => Object.keys(E().jardim?.plantas || {}).length, bonus: { tipo: "xp", v: 8 } },
  { id: "imortal", nome: "Imortal do Esmalte", cor: "#E0434A", req: "100 dias de ofensiva", meta: 100, valor: () => E().ofensiva.recorde, bonus: { tipo: "xp", v: 15 } },
  // feitos de longo prazo (outubro de 2026)
  { id: "carimbada", nome: "Figurinha Carimbada", cor: "#F28A1E", req: "50 eventos no currículo", meta: 50, valor: () => nSecao("eventos"), bonus: { tipo: "curriculo", v: 10 } },
  { id: "aprendiz", nome: "Eterno Aprendiz", cor: "#9B5CF6", req: "100 cursos de formação complementar", meta: 100, valor: () => nSecao("formacao"), bonus: { tipo: "xp", v: 6 } },
  { id: "milhoras", nome: "Mil Horas", cor: "#9B5CF6", req: "1.000 horas de atividades no currículo", meta: 1000, valor: horas, bonus: { tipo: "curriculo", v: 15 } },
  { id: "lattes", nome: "Lenda do Lattes", cor: "#E0434A", req: "300 atividades no currículo", meta: 300, valor: () => ativs().length, bonus: { tipo: "curriculo", v: 30 } },
  { id: "onipresente", nome: "Onipresente", cor: "#E0434A", req: "1.000 eventos no currículo", meta: 1000, valor: () => nSecao("eventos"), bonus: { tipo: "xp", v: 20 } },
  { id: "dezmilhoras", nome: "Dez Mil Horas", cor: "#E0434A", req: "10.000 horas de atividades no currículo", meta: 10000, valor: horas, bonus: { tipo: "xp", v: 20 } },
  { id: "dezmil", nome: "Dez Mil Respostas", cor: "#E0434A", req: "Responder 10.000 exercícios", meta: 10000, valor: () => stats().exercicios, bonus: { tipo: "xp", v: 12 } },
  { id: "cemmil", nome: "Cem Mil Respostas", cor: "#E0434A", req: "Responder 100.000 exercícios", meta: 100000, valor: () => stats().exercicios, bonus: { tipo: "xp", v: 25 } },
  { id: "millicoes", nome: "Mil Lições", cor: "#9B5CF6", req: "Concluir 1.000 lições", meta: 1000, valor: () => stats().licoes, bonus: { tipo: "moedas", v: 10 } },
  { id: "serie", nome: "Perfeição em Série", cor: "#E0434A", req: "100 lições perfeitas", meta: 100, valor: () => stats().perfeitas, bonus: { tipo: "xpPerfeita", v: 25 } },
  { id: "voltaaosol", nome: "Volta ao Sol", cor: "#E0434A", req: "365 dias de ofensiva", meta: 365, valor: () => E().ofensiva.recorde, bonus: { tipo: "xp", v: 25 } },
  { id: "nivel25", nome: "Bodas de Prata", cor: "#9B5CF6", req: "Chegar ao nível 25", meta: 25, valor: () => nivel().n, bonus: { tipo: "xp", v: 8 } },
  { id: "nivel50", nome: "Meio Centenário", cor: "#E0434A", req: "Chegar ao nível 50", meta: 50, valor: () => nivel().n, bonus: { tipo: "xp", v: 15 } },
  // nível de colecionador (colecionador.js, 02/11/2026): evoluir cartas e plantas, mesmo as que não usa
  { id: "curador", nome: "Curador da Coleção", cor: "#9B5CF6", req: "Chegar ao nível 10 de colecionador", meta: 10, valor: () => nivelColecionador().n, bonus: { tipo: "bauTempo", v: 8 } },
  { id: "lendacolecao", nome: "Lenda da Coleção", cor: "#E0434A", req: "Chegar ao nível 30 de colecionador", meta: 30, valor: () => nivelColecionador().n, bonus: { tipo: "moedas", v: 12 } },
  { id: "nivel100", nome: "Centenário", cor: "#E0434A", req: "Chegar ao nível 100", meta: 100, valor: () => nivel().n, bonus: { tipo: "xp", v: 30 } },
];

function tit() {
  const est = E();
  est.titulos ??= { conquistados: [], equipado: null };
  return est.titulos;
}
export const titulosEstado = () => tit();
export const tituloEquipado = () => TITULOS.find(t => t.id === tit().equipado) || null;
export function equiparTitulo(id) { tit().equipado = tit().equipado === id ? null : id; salvar(); }
export function progresso(t) { return Math.min(t.meta, t.valor() || 0); }

/** Confere os feitos e devolve os títulos recém-conquistados. */
export function verificarTitulos() {
  const st = tit(), novos = [];
  for (const t of TITULOS) {
    if (st.conquistados.includes(t.id)) continue;
    if ((t.valor() || 0) >= t.meta) { st.conquistados.push(t.id); novos.push(t); }
  }
  if (novos.length) { if (!st.equipado) st.equipado = novos[0].id; salvar(); }
  return novos;
}

// ---------- selo do título (guia v2): medalha pelo nível do feito (azul, laranja, roxo, vermelho) e um emblema próprio ----------
const BR = `fill="#fff" stroke="#1B2340" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
const LN = `fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
const txt = (t, tam = 9) => `<text x="10" y="${10 + tam * 0.36}" text-anchor="middle" font-family="Bricolage, sans-serif" font-weight="800" font-size="${tam}" fill="#fff" stroke="#1B2340" stroke-width=".9" paint-order="stroke">${t}</text>`;
const est5 = (cx, cy, r) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`; } return `<path d="${d}Z" ${BR}/>`; };
const EMBLEMAS = {
  pegadas: `<ellipse cx="7" cy="12" rx="2.6" ry="3.6" ${BR}/><ellipse cx="13.4" cy="8" rx="2.6" ry="3.6" ${BR}/><circle cx="5.4" cy="7" r="1" fill="#fff"/><circle cx="7.6" cy="6.4" r="1" fill="#fff"/><circle cx="12" cy="3" r="1" fill="#fff"/><circle cx="14.4" cy="2.6" r="1" fill="#fff"/>`,
  chama: `<path d="M10 1.5 C13.4 5 16 7.6 16 12 C16 16 13.2 18.8 10 18.8 C6.8 18.8 4 16 4 12 C4 9 6 7.8 7.2 5.4 C8 8 9 9 10 9.4 C10.6 6.6 9.4 4.4 10 1.5Z" ${BR}/><path d="M10 11.6 C11.6 13 12.4 14 12.4 15.4 C12.4 16.8 11.2 17.6 10 17.6 C8.8 17.6 7.6 16.8 7.6 15.4 C7.6 14 8.6 13 10 11.6Z" fill="#FFC24B"/>`,
  estrela: est5(10, 10.4, 8.6),
  estrelas: `${est5(5, 12, 4.4)}${est5(15, 12, 4.4)}${est5(10, 6, 4.8)}`,
  sol: `<circle cx="10" cy="10" r="4.6" ${BR}/><path d="M10 1.6 v2.4 M10 16 v2.4 M1.6 10 h2.4 M16 10 h2.4 M4 4 l1.7 1.7 M14.3 14.3 l1.7 1.7 M16 4 l-1.7 1.7 M5.7 14.3 L4 16" ${LN}/>`,
  talheres: `<path d="M6 2 v6 a2 2 0 0 0 4 0 v-6 M8 2 v16 M14 2 c-2.4 2 -2.4 7 0 8 v8" ${LN}/>`,
  coruja: `<path d="M3 5 L6 8 Q10 6 14 8 L17 5 L17 12 Q17 18.4 10 18.4 Q3 18.4 3 12Z" ${BR}/><circle cx="7.2" cy="11" r="2.4" fill="#FFC24B" stroke="#1B2340" stroke-width="1"/><circle cx="12.8" cy="11" r="2.4" fill="#FFC24B" stroke="#1B2340" stroke-width="1"/><circle cx="7.4" cy="11.2" r="1" fill="#1B2340"/><circle cx="13" cy="11.2" r="1" fill="#1B2340"/><path d="M9.2 13.6 l.8 1.4 l.8 -1.4z" fill="#F28A1E"/>`,
  calendario: `<rect x="3" y="4.4" width="14" height="13" rx="2" ${BR}/><path d="M3.6 8 h12.8" stroke="#1B2340" stroke-width="1.1"/><path d="M6.6 2.6 v3 M13.4 2.6 v3" stroke="#1B2340" stroke-width="1.6" stroke-linecap="round"/><path d="M6.4 12.6 l2.4 2.4 l4.6 -5" fill="none" stroke="#1E9E5E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  bau: `<path d="M3 9 V7.4 Q3 3.6 10 3.6 Q17 3.6 17 7.4 V9Z" ${BR}/><rect x="3" y="9" width="14" height="8" rx="1.4" ${BR}/><rect x="8.4" y="7.4" width="3.2" height="4" rx=".8" fill="#FFC24B" stroke="#1B2340" stroke-width=".9"/>`,
  frasco: `<path d="M8 2 h4 v5 l5 8 q1 3 -2 3 h-10 q-3 0 -2 -3 l5 -8z" ${BR}/><path d="M5 13 h10 l1.4 2.6 q.4 1.6 -1.4 1.6 h-10 q-1.8 0 -1.4 -1.6z" fill="#7FD6A0"/><circle cx="9" cy="14.4" r=".9" fill="#fff"/>`,
  cartas: `<rect x="3" y="4" width="9" height="12.6" rx="1.6" transform="rotate(-12 7.5 10.3)" ${BR}/><rect x="8" y="3.4" width="9" height="12.6" rx="1.6" transform="rotate(10 12.5 9.7)" ${BR}/><path d="M12.4 7.6 l1 2 2 .3 -1.5 1.4 .4 2 -1.9 -1 -1.9 1 .4 -2 -1.5 -1.4 2 -.3z" fill="#F28A1E" transform="rotate(10 12.5 9.7)"/>`,
  coroa: `<path d="M3 15.4 L2.4 5.6 L7 9.4 L10 3.4 L13 9.4 L17.6 5.6 L17 15.4Z" ${BR}/><circle cx="10" cy="11.6" r="1.4" fill="#E0434A"/><path d="M3.4 15.4 h13.2" stroke="#1B2340" stroke-width="1.1"/>`,
  documento: `<path d="M4 2.4 h8.4 l3.6 3.6 v11.6 h-12z" ${BR}/><path d="M12.4 2.4 v3.6 h3.6" fill="none" stroke="#1B2340" stroke-width="1"/><path d="M6.4 9 h7 M6.4 12 h7 M6.4 15 h4.4" stroke="#9AA3C7" stroke-width="1.3" stroke-linecap="round"/>`,
  controle: `<path d="M5 6 h10 q4 0 4.4 6 q.4 4.6 -2.4 4.6 q-1.8 0 -3 -2.6 h-8 q-1.2 2.6 -3 2.6 q-2.8 0 -2.4 -4.6 Q1 6 5 6Z" ${BR}/><path d="M5.4 9.4 v4 M3.4 11.4 h4" stroke="#1B2340" stroke-width="1.3" stroke-linecap="round"/><circle cx="13.4" cy="10.4" r="1.1" fill="#E0434A"/><circle cx="15.6" cy="12.4" r="1.1" fill="#2F6BFF"/>`,
  microfone: `<rect x="7" y="2" width="6" height="10" rx="3" ${BR}/><path d="M4.6 9.4 a5.4 5.4 0 0 0 10.8 0 M10 14.8 v3 M7 18 h6" ${LN}/><path d="M7.6 5 h4.8 M7.6 7.4 h4.8" stroke="#9AA3C7" stroke-width="1"/>`,
  confete: `<path d="M3 18 L7 6 L15 14Z" ${BR}/><path d="M5 12.4 l3 3" stroke="#F07BB0" stroke-width="1.6"/><circle cx="13" cy="4" r="1.3" fill="#FFE08A"/><circle cx="17" cy="8" r="1.2" fill="#7FD6F5"/><path d="M10 2.4 l1 2 M15.6 2 l-.4 2.2 M17.6 11.6 l-2 .4" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
  folha: `<path d="M3 17 C3 8 9 3 17 3 C17 11 12 17 3 17Z" ${BR}/><path d="M4 16 L13 7" stroke="#7FD6A0" stroke-width="1.4" stroke-linecap="round"/>`,
  trofeu: `<path d="M5 3 h10 v4 q0 6 -5 6 q-5 0 -5 -6z" ${BR}/><path d="M5 5 h-2.4 q0 4 3.2 4.6 M15 5 h2.4 q0 4 -3.2 4.6" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M8.6 13 h2.8 v2.6 h-2.8z M6 15.6 h8 v2.4 h-8z" ${BR}/>`,
  diamante: `<path d="M5 3 h10 l3.4 5 -8.4 10 -8.4 -10z" ${BR}/><path d="M1.6 8 h16.8 M7 3 l-1.6 5 4.6 10 4.6 -10 -1.6 -5" fill="none" stroke="#7FD6F5" stroke-width="1.1"/>`,
  flor: `${[0, 72, 144, 216, 288].map(a => `<ellipse cx="10" cy="5.4" rx="2.8" ry="4" transform="rotate(${a} 10 10.4)" ${BR}/>`).join("")}<circle cx="10" cy="10.4" r="2.6" fill="#FFC24B" stroke="#1B2340" stroke-width="1"/>`,
  pata: `<ellipse cx="10" cy="13.4" rx="4.6" ry="3.8" ${BR}/><circle cx="4.4" cy="8.4" r="2" ${BR}/><circle cx="8" cy="5" r="2" ${BR}/><circle cx="12" cy="5" r="2" ${BR}/><circle cx="15.6" cy="8.4" r="2" ${BR}/>`,
  arvore: `<path d="M9 18 V12 h2 v6z" ${BR}/><circle cx="10" cy="8" r="6" ${BR}/><circle cx="7.6" cy="7" r="1.2" fill="#7FD6A0"/><circle cx="12" cy="9.4" r="1.2" fill="#7FD6A0"/>`,
  dente: `<path d="M3.4 6 C3.4 2 7 1.6 10 3.4 C13 1.6 16.6 2 16.6 6 C16.6 9.4 15 11 14.4 16 C14 18.4 12.4 18.4 12 16.4 L10.8 12.4 Q10 11.4 9.2 12.4 L8 16.4 C7.6 18.4 6 18.4 5.6 16 C5 11 3.4 9.4 3.4 6Z" ${BR}/><path d="M12.6 4.4 q2 .6 2 3" stroke="#BFE6FF" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  carimbo: `<path d="M7.4 2.6 h5.2 v5 q0 1.6 2.4 2.4 h1.6 v3 h-13.2 v-3 h1.6 q2.4 -.8 2.4 -2.4z" ${BR}/><rect x="2.4" y="14.4" width="15.2" height="3" rx="1" ${BR}/>`,
  livro: `<path d="M10 4.6 Q6 2.6 2.4 3.6 V16 Q6 15 10 17 Q14 15 17.6 16 V3.6 Q14 2.6 10 4.6Z" ${BR}/><path d="M10 4.6 V17" stroke="#1B2340" stroke-width="1"/><path d="M4.4 7 q2.4 -.6 4 .2 M4.4 10 q2.4 -.6 4 .2 M11.6 7.2 q1.6 -.8 4 -.2" stroke="#9AA3C7" stroke-width="1" fill="none"/>`,
  livros: `<rect x="2.6" y="13.4" width="14.8" height="4" rx="1" ${BR}/><rect x="3.8" y="9.2" width="12.4" height="4.2" rx="1" ${BR}/><rect x="3" y="5" width="13.6" height="4.2" rx="1" ${BR}/><path d="M6 15.4 h7 M6.6 11.3 h6 M5.8 7.1 h6.4" stroke="#9AA3C7" stroke-width="1"/>`,
  relogio: `<circle cx="10" cy="10" r="7.6" ${BR}/><path d="M10 5 V10 L13.4 12" fill="none" stroke="#1B2340" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  globo: `<circle cx="10" cy="10" r="7.6" ${BR}/><path d="M2.6 10 h14.8 M10 2.4 q-4.4 7.6 0 15.2 M10 2.4 q4.4 7.6 0 15.2 M4 5.6 q6 2 12 0 M4 14.4 q6 -2 12 0" fill="none" stroke="#7FD6F5" stroke-width="1"/>`,
  orbita: `<ellipse cx="10" cy="10" rx="8.6" ry="3.6" transform="rotate(-20 10 10)" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="10" cy="10" r="4" fill="#FFC24B" stroke="#1B2340" stroke-width="1"/><circle cx="17.4" cy="7.4" r="1.6" ${BR}/>`,
};
const EMBLEMA_DE = {
  primeiros: "pegadas", dedicado: "chama", semana: "chama", mes: "chama", imortal: "dente", voltaaosol: "orbita",
  centena: () => txt("100", 7.4), mil: () => txt("1k", 9), dezmil: () => txt("10k", 7.6), cemmil: () => txt("100k", 6), millicoes: "livros",
  perfeccionista: "estrela", serie: "estrelas", madrugador: "sol", almoco: "talheres", coruja: "coruja", presente: "calendario",
  cacador: "bau", alquimista: "frasco", colecionador: "cartas", lenda: "coroa", curriculo: "documento", nota10: () => txt("10", 10),
  fliperama: "controle", orador: "microfone", festeiro: "confete", dedoverde: "folha", campeao: "trofeu", diamante: "diamante",
  botanico: "flor", zoologico: "pata", paisagista: "arvore", carimbada: "carimbo", aprendiz: "livro", milhoras: "relogio",
  dezmilhoras: "relogio", lattes: () => txt("L", 11), onipresente: "globo", curador: "cartas", lendacolecao: "coroa", nivel25: () => txt("25", 9), nivel50: () => txt("50", 9), nivel100: () => txt("100", 7.4),
};
const NIVEL_COR = { "#5C8DD6": 1, "#F28A1E": 2, "#9B5CF6": 3, "#E0434A": 4 };
const escuro = (hex) => "#" + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.72).toString(16).padStart(2, "0")).join("");
export function svgTitulo(t, bloqueado = false) {
  const cor = bloqueado ? "#9AA3C7" : t.cor, esc = escuro(cor), n = NIVEL_COR[t.cor] || 2;
  const e = EMBLEMA_DE[t.id], emblema = typeof e === "function" ? e() : EMBLEMAS[e] || EMBLEMAS.estrela;
  // bordas: lisa (1), recortada (2), estrela de 8 pontas (3), estrela de 12 pontas com coroa (4)
  const pontas = n >= 3 ? (n === 4 ? 12 : 8) : 0;
  let borda = "";
  if (n === 2) { let d = ""; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, a2 = a + Math.PI / 16; d += `${i ? "L" : "M"}${(24 + Math.cos(a) * 20).toFixed(2)} ${(22 + Math.sin(a) * 20).toFixed(2)}Q${(24 + Math.cos(a2) * 22.4).toFixed(2)} ${(22 + Math.sin(a2) * 22.4).toFixed(2)} ${(24 + Math.cos(a + Math.PI / 8) * 20).toFixed(2)} ${(22 + Math.sin(a + Math.PI / 8) * 20).toFixed(2)}`; } borda = `<path d="${d}Z" fill="${esc}" stroke="#1B2340" stroke-width="2"/>`; }
  if (pontas) { let d = ""; for (let i = 0; i < pontas * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / pontas, rr = i % 2 ? 19 : 23.4; d += `${i ? "L" : "M"}${(24 + Math.cos(a) * rr).toFixed(2)} ${(22 + Math.sin(a) * rr).toFixed(2)}`; } borda = `<path d="${d}Z" fill="${n === 4 && !bloqueado ? "#FFC24B" : esc}" stroke="#1B2340" stroke-width="2" stroke-linejoin="round"/>`; }
  const anel = bloqueado ? "#C9D0E0" : n === 1 ? "#D5DCE6" : "#FFD66B";
  const brilhos = !bloqueado && n >= 3 ? `<g class="pa pa-faisca" style="transform-origin:42px 6px;--pd:.2s"><path d="M42 1.6 l1.2 3.2 3.2 1.2 -3.2 1.2 -1.2 3.2 -1.2 -3.2 -3.2 -1.2 3.2 -1.2z" fill="#FFF3B0"/></g><g class="pa pa-faisca" style="transform-origin:6px 36px;--pd:1.3s"><path d="M6 33 l.9 2.2 2.2 .9 -2.2 .9 -.9 2.2 -.9 -2.2 -2.2 -.9 2.2 -.9z" fill="#FFF3B0"/></g>` : "";
  const coroa = !bloqueado && n === 4 ? `<path d="M17 4.6 L16.4 -1 L20.6 1.6 L24 -3 L27.4 1.6 L31.6 -1 L31 4.6Z" fill="#FFC24B" stroke="#1B2340" stroke-width="1.6" stroke-linejoin="round"/><circle cx="24" cy="1.6" r="1.2" fill="#E0434A"/>` : "";
  return `<svg class="selo-titulo anima" viewBox="-2 -4 52 60" ${bloqueado ? 'style="filter:saturate(.2)"' : ""}>
    <path d="M12 32 L7 54 L16.4 48.6 L23 54.6 L22 36Z" fill="${cor}" stroke="#1B2340" stroke-width="2" stroke-linejoin="round"/><path d="M36 32 L41 54 L31.6 48.6 L25 54.6 L26 36Z" fill="${cor}" stroke="#1B2340" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 36 L10.6 50.6 M34 36 L37.4 50.6" stroke="${esc}" stroke-width="2.2" stroke-linecap="round"/>
    ${borda}
    <circle cx="24" cy="22" r="17" fill="${anel}" stroke="#1B2340" stroke-width="2.2"/>
    <circle cx="24" cy="22" r="13" fill="${cor}" stroke="#1B2340" stroke-width="1.6"/>
    <path d="M14.6 15.4 A11 11 0 0 1 26 11.2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    <g transform="translate(14 12)"${bloqueado ? ' opacity=".55"' : ""}>${emblema}</g>
    ${coroa}${brilhos}
  </svg>`;
}
