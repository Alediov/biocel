// Humor do dia (pedido do Alediov, 04/11/2026): "um controle do humor com uma pergunta diária para escolher o emoji que
// combina no momento", SEM nota: "tem dias que eu estou estressado/irritado, mas isso não necessariamente é igual a
// desânimo". Por isso um quadro de 4 cantos (energia baixa/alta × desagradável/agradável) com 16 emojis com nome, e
// nunca uma escala única. Este arquivo é puro (sem DOM nem estado), para os testes no node.

export const QUADRANTES = [
  { id: "alta-desagradavel", energia: "alta", valencia: "desagradavel", nome: "Agitado e desagradável", curto: "Tenso", cor: "#E5533D" },
  { id: "alta-agradavel", energia: "alta", valencia: "agradavel", nome: "Agitado e agradável", curto: "Animado", cor: "#E9A80C" },
  { id: "baixa-desagradavel", energia: "baixa", valencia: "desagradavel", nome: "Parado e desagradável", curto: "Pra baixo", cor: "#4E7BD9" },
  { id: "baixa-agradavel", energia: "baixa", valencia: "agradavel", nome: "Parado e agradável", curto: "Em paz", cor: "#22A06B" },
];

const H = (id, emoji, nome, q) => {
  const Q = QUADRANTES.find(x => x.id === q);
  return { id, emoji, nome, quadrante: q, energia: Q.energia, valencia: Q.valencia };
};
/** Os 16 humores (a ordem é a do quadro: 4 por canto). */
export const HUMORES = [
  H("irritado", "😠", "Irritado", "alta-desagradavel"), H("estressado", "😰", "Estressado", "alta-desagradavel"),
  H("frustrado", "😤", "Frustrado", "alta-desagradavel"), H("ansioso", "😟", "Ansioso", "alta-desagradavel"),
  H("animado", "😄", "Animado", "alta-agradavel"), H("empolgado", "🤩", "Empolgado", "alta-agradavel"),
  H("feliz", "😊", "Feliz", "alta-agradavel"), H("focado", "💪", "Focado", "alta-agradavel"),
  H("triste", "😔", "Triste", "baixa-desagradavel"), H("desanimado", "😞", "Desanimado", "baixa-desagradavel"),
  H("cansado", "😩", "Cansado", "baixa-desagradavel"), H("vazio", "😶", "Vazio", "baixa-desagradavel"),
  H("calmo", "😌", "Calmo", "baixa-agradavel"), H("tranquilo", "🙂", "Tranquilo", "baixa-agradavel"),
  H("sonolento", "😴", "Sonolento", "baixa-agradavel"), H("grato", "🥰", "Grato", "baixa-agradavel"),
];
export const humor = (id) => HUMORES.find(h => h.id === id) || null;
export const quadrante = (id) => QUADRANTES.find(q => q.id === id) || null;

/** Etiquetas sugeridas (opcionais; ele pode escrever outras). */
export const ETIQUETAS = ["prova", "dormi mal", "aula longa", "clínica", "treino", "família", "amigos", "estudo", "descanso", "saúde", "dinheiro", "chuva"];
export const MAX_ETIQUETAS = 4, MAX_TEXTO = 60;

/** Etiqueta limpa: minúsculas, sem espaços sobrando, até 24 caracteres ("" se vazia). */
export const limparEtiqueta = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 24);
export const limparTexto = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);

/** O dia (AAAA-MM-DD) no fuso do aparelho. */
export function diaDe(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * O resumo de um dia com vários registros, SEM média: o quadrante que mais apareceu (empate: o mais recente) e os
 * emojis em ordem. `regs`: [{ h, ms }]. Devolve null sem registros.
 */
export function resumoDoDia(regs) {
  const l = (regs || []).filter(r => humor(r.h)).sort((a, b) => a.ms - b.ms);
  if (!l.length) return null;
  const conta = new Map();
  l.forEach((r, i) => { const q = humor(r.h).quadrante, c = conta.get(q) || { n: 0, ult: 0 }; c.n++; c.ult = i; conta.set(q, c); });
  const [q] = [...conta].sort((a, b) => b[1].n - a[1].n || b[1].ult - a[1].ult)[0];
  const ultimo = humor(l.at(-1).h);
  return { quadrante: q, energia: quadrante(q).energia, valencia: quadrante(q).valencia, ultimo: ultimo.id, humores: l.map(r => r.h), etiquetas: [...new Set(l.flatMap(r => r.et || []))] };
}
