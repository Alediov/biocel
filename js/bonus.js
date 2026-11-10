// Soma os bônus da carta equipada e do título equipado.
import { CARTAS, colecao, equipada, valorBonus } from "./colecao.js";
import { tituloEquipado } from "./titulos.js";

export function bonus(tipo) {
  let v = 0;
  const id = equipada(), c = colecao().cartas[id];
  if (c && CARTAS[id].bonus.tipo === tipo) v += valorBonus(id, c.nivel);
  const t = tituloEquipado();
  if (t && t.bonus.tipo === tipo) v += t.bonus.v;
  return v;
}

const PERIODO = { manha: "xpManha", tarde: "xpTarde", noite: "xpNoite" };

/** Multiplicador de XP de uma lição (sem a poção). */
export function multLicao({ periodo, perfeita }) {
  let p = bonus("xp") + (PERIODO[periodo] ? bonus(PERIODO[periodo]) : 0) + (perfeita ? bonus("xpPerfeita") : 0);
  return 1 + p / 100;
}
/** Multiplicador de XP de ganhos fora das lições, por categoria. */
export function multGanho(categoria) {
  let p = bonus("xp");
  if (categoria === "presenca") p += bonus("presenca");
  if (categoria === "curriculo") p += bonus("curriculo");
  return 1 + p / 100;
}
export const multMoedas = () => 1 + bonus("moedas") / 100;
export const chanceGema = () => bonus("gemaChance") / 100;
export const fatorBau = () => Math.max(0.5, 1 - bonus("bauTempo") / 100);
export const fatorPocao = () => 1 + bonus("pocaoDuracao") / 100;
