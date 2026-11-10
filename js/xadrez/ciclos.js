// Rotação dos treinos do Xadrez em ciclos (pedido do Alediov, 02/11/2026: "podemos criar 3 ciclos e, toda vez que a
// agenda permite, um desses ciclos aparece, na próxima vez, o outro, e assim por diante").
// Todo dia (inclusive os corridos) a trilha de hoje tem as revisões devidas e o Desafio do dia; nos dias normais e livres
// entra também o ciclo da vez: Aberturas → Tática → Jogo e técnica → Aberturas…
//
// Puro (sem DOM nem estado global): o histórico vem de fora, `x.ciclos.dias` = { "AAAA-MM-DD": { c, s, t, em } }, um
// registro por dia em que um ciclo foi montado (c = id do ciclo; s = 0 nada feito, 1 parte, 2 tudo; t = tamanho do dia;
// em = ISO de quando mudou). A posição na rotação sai desse histórico (nada de contador: na junção entre aparelhos o
// registro mais recente de cada dia fica inteiro, pela data `em`).
//
// Quando avança: o ciclo do último dia com ciclo avança se ele fez AO MENOS UM passo do ciclo naquele dia; se não fez
// nenhum, o mesmo ciclo volta no próximo dia com tempo, mas só uma vez (na 2ª vez seguida sem nada, avança assim mesmo,
// para não ficar preso num ciclo que ele vem pulando). Dia corrido não monta ciclo e não mexe na rotação.
//   node tools/xadrez/teste_ciclos.mjs

export const CICLOS = [
  { id: "aberturas", nome: "Ciclo de aberturas", curto: "Aberturas", icone: "📚", sub: "linhas novas e continuar a partida" },
  { id: "tatica", nome: "Ciclo de tática", curto: "Tática", icone: "🧩", sub: "problemas da semana, corrida ou seus erros" },
  { id: "jogo", nome: "Ciclo de jogo e técnica", curto: "Jogo e técnica", icone: "⚔️", sub: "aula ou final e partida contra a Maia" },
];
export const REPETE_NO_MAXIMO = 1; // dias seguidos em que um ciclo não feito volta antes de avançar assim mesmo
export const cicloDe = (id) => CICLOS.find(c => c.id === id) || null;
export function proximoCiclo(id) {
  const i = CICLOS.findIndex(c => c.id === id);
  return CICLOS[(i + 1) % CICLOS.length].id;
}

/** Os dias com ciclo antes de `hoje`, do mais recente para o mais antigo. */
function antes(dias, hoje) {
  return Object.entries(dias || {}).filter(([d, r]) => d < hoje && r && cicloDe(r.c)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

/** O ciclo que cabe hoje: o já montado hoje (o mesmo em todos os aparelhos) ou o da vez pelo histórico. */
export function cicloDaVez(dias, hoje) {
  if (cicloDe(dias?.[hoje]?.c)) return dias[hoje].c;
  const h = antes(dias, hoje);
  if (!h.length) return CICLOS[0].id;
  const [, ult] = h[0];
  if ((ult.s || 0) > 0) return proximoCiclo(ult.c);
  // não fez nada no último: repete, a não ser que já tenha repetido (os dias seguidos com o mesmo ciclo e nada feito)
  let seguidos = 0;
  for (const [, r] of h) { if (r.c === ult.c && !(r.s > 0)) seguidos++; else break; }
  return seguidos > REPETE_NO_MAXIMO ? proximoCiclo(ult.c) : ult.c;
}

/** O que vem depois de hoje, se o ciclo de hoje for feito (ao menos um passo). */
export const depoisDeHoje = (dias, hoje) => proximoCiclo(cicloDaVez(dias, hoje));

/** 0 = nada feito, 1 = parte, 2 = tudo, pelos passos do plano que são do ciclo (sem os extras do dia livre). */
export function situacaoDoCiclo(itens) {
  const doCiclo = (itens || []).filter(i => i.ciclo && !i.extra);
  const feitos = doCiclo.filter(i => i.feito).length;
  return !doCiclo.length || !feitos ? 0 : feitos === doCiclo.length ? 2 : 1;
}

/** O último dia (antes de hoje) em que o ciclo `id` foi montado, ou "". */
export function ultimoDia(dias, id, hoje) {
  const h = antes(dias, hoje).find(([, r]) => r.c === id);
  return h ? h[0] : "";
}

/** Por ciclo: quantas vezes foi feito inteiro, em parte e quantas vezes foi montado. */
export function contagem(dias) {
  const out = Object.fromEntries(CICLOS.map(c => [c.id, { feitos: 0, parte: 0, montados: 0 }]));
  for (const r of Object.values(dias || {})) {
    const o = out[r?.c]; if (!o) continue;
    o.montados++;
    if (r.s === 2) o.feitos++; else if (r.s === 1) o.parte++;
  }
  return out;
}
