// Nível de colecionador (pedido do Alediov, 02/11/2026: "incomoda-me o fato de não ter nenhuma recompensa por upar de
// nível cartas e plantas que não uso"). Cada evolução de carta ou planta vale pontos, mais nas raras e nos níveis altos,
// e os pontos somados dão um nível à parte, com prêmios para resgatar em cada nível (moedas, gemas, poções, baús, um
// título no 10 e no 30 e a carta exclusiva Curador no 15).
// Os pontos saem do nível ATUAL de cada carta e planta (não ficam guardados): contam as evoluções de antes (retroativo),
// valem igual nos dois aparelhos e não somam duas vezes na sincronização. Guardado só o que já foi resgatado:
// E().colecionador.resgatados = { "<nível>": "<quando>" }.
// Sem importar economia.js (economia → bonus → titulos → colecionador fecharia um ciclo): gemas, poções e baús são
// entregues aqui direto no estado.
import { E, salvar } from "./estado.js";
import { CARTAS, darCopias, RARIDADES_CARTA } from "./colecao.js";
import { PLANTAS } from "./jardim.js";

/** Pontos por evolução: a raridade × o nível de onde a carta sai (do 3 para o 4 de uma rara: 20 × 3 = 60). */
export const PONTOS = { comum: 10, rara: 20, epica: 40, lendaria: 80 };
/** Pontos que uma carta ou planta no `nivel` já rendeu. */
export const pontosDoNivel = (rar, nivel) => (PONTOS[rar] || 10) * nivel * (nivel - 1) / 2;
/** Pontos da próxima evolução (de `nivel` para `nivel` + 1). */
export const pontosDaEvolucao = (rar, nivel) => (PONTOS[rar] || 10) * nivel;
/** Pontos para ir do nível n ao n + 1: 100, 150, 200… */
export const custoNivel = (n) => 100 + 50 * (n - 1);
/** Pontos totais para chegar ao nível n. */
export const custoAcumulado = (n) => 100 * (n - 1) + 25 * (n - 1) * (n - 2);
const acumulado = custoAcumulado;
export const NIVEL_CARTA = 15, CARTA_PREMIO = "curador";
export const TITULOS_NIVEL = { 10: "curador", 30: "lendacolecao" };

function st() {
  const est = E();
  est.colecionador ??= { resgatados: {} };
  est.colecionador.resgatados ??= {};
  return est.colecionador;
}

/** O nível de colecionador agora: { n, pontos, noNivel, custo, cartas, plantas, evolucoes }. */
export function nivelColecionador() {
  let cartas = 0, plantas = 0, evolucoes = 0;
  for (const [id, c] of Object.entries(E().colecao?.cartas || {})) if (CARTAS[id] && c?.nivel > 1) { cartas += pontosDoNivel(CARTAS[id].raridade, c.nivel); evolucoes += c.nivel - 1; }
  for (const [id, p] of Object.entries(E().jardim?.plantas || {})) if (PLANTAS[id] && p?.nivel > 1) { plantas += pontosDoNivel(PLANTAS[id].raridade, p.nivel); evolucoes += p.nivel - 1; }
  const pontos = cartas + plantas;
  let n = 1;
  while (pontos >= acumulado(n + 1)) n++;
  return { n, pontos, noNivel: pontos - acumulado(n), custo: custoNivel(n), cartas, plantas, evolucoes };
}

/** Os prêmios do nível n (n ≥ 2). */
export function premiosDoNivel(n) {
  const itens = [{ tipo: "moedas", qtd: 50 + 25 * n }];
  if (n % 2 === 0) itens.push({ tipo: "gemas", qtd: 3 + Math.floor(n / 4) });
  if (n % 5 === 3) itens.push({ tipo: "pocao", pocao: n % 10 === 3 ? "x3_20" : "x5_10" });
  if (n % 5 === 0) itens.push({ tipo: "bau", bau: n === 5 ? "ouro" : n % 10 === 0 && n >= 20 ? "lendario" : "epico" });
  if (n === NIVEL_CARTA) itens.push({ tipo: "carta", carta: CARTA_PREMIO, qtd: 1 });
  if (TITULOS_NIVEL[n]) itens.push({ tipo: "titulo", titulo: TITULOS_NIVEL[n] });
  return itens;
}
export const resgatado = (n) => !!st().resgatados[n];
/** Níveis alcançados com prêmio ainda não resgatado. */
export function pendentes() { const { n } = nivelColecionador(), out = []; for (let k = 2; k <= n; k++) if (!resgatado(k)) out.push(k); return out; }

function slotLivre() { const b = E().baus; return b?.slots ? b.slots.findIndex(s => !s) : -1; }
/** Entrega os prêmios do nível n. Devolve { itens } ou { erro }. */
export function resgatar(n) {
  const est = E(), c = st();
  if (n < 2 || n > nivelColecionador().n) return { erro: "Este nível ainda não foi alcançado." };
  if (c.resgatados[n]) return { erro: "Os prêmios deste nível já foram resgatados." };
  const itens = premiosDoNivel(n);
  if (itens.some(i => i.tipo === "bau") && slotLivre() < 0) return { erro: "Libere um slot de baú (abra um) para resgatar o baú deste nível." };
  const agora = Date.now(), entregues = [];
  for (const it of itens) {
    if (it.tipo === "moedas") est.moedas += it.qtd;
    else if (it.tipo === "gemas") est.gemas = (est.gemas || 0) + it.qtd;
    else if (it.tipo === "pocao") { est.inventario ??= { pocoes: {} }; est.inventario.pocoes[it.pocao] = (est.inventario.pocoes[it.pocao] || 0) + 1; }
    else if (it.tipo === "bau") est.baus.slots[slotLivre()] = { id: Math.random().toString(36).slice(2, 10), raridade: it.bau, origem: `nível ${n} de colecionador`, obtidoEm: agora, inicio: agora, pronto: agora };
    else if (it.tipo === "carta") { entregues.push({ ...it, nova: darCopias(it.carta, it.qtd) }); continue; }
    entregues.push(it);
  }
  c.resgatados[n] = new Date().toISOString();
  est.extratos.unshift({ quando: c.resgatados[n], xp: 0, moedas: itens[0].qtd, motivo: `Nível ${n} de colecionador` });
  salvar();
  window.dispatchEvent(new Event("oq-baus")); window.dispatchEvent(new Event("oq-titulos")); window.dispatchEvent(new Event("oq-topo"));
  return { itens: entregues };
}

/** Resumo de onde vêm os pontos (para a tela): por raridade, cartas e plantas, as que mais renderam. */
export function detalhes() {
  const linhas = [];
  for (const [id, c] of Object.entries(E().colecao?.cartas || {})) if (CARTAS[id] && c.nivel > 1) linhas.push({ tipo: "carta", id, nome: CARTAS[id].nome, raridade: CARTAS[id].raridade, nivel: c.nivel, pontos: pontosDoNivel(CARTAS[id].raridade, c.nivel) });
  for (const [id, p] of Object.entries(E().jardim?.plantas || {})) if (PLANTAS[id] && p.nivel > 1) linhas.push({ tipo: "planta", id, nome: PLANTAS[id].nome, raridade: PLANTAS[id].raridade, nivel: p.nivel, pontos: pontosDoNivel(PLANTAS[id].raridade, p.nivel) });
  return linhas.sort((a, b) => b.pontos - a.pontos);
}
export const COR_RAR = (rar) => RARIDADES_CARTA[rar]?.cor || "#5C8DD6";
