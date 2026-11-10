// Personagens que aparecem no app. O "mascote" é sempre o companheiro equipado
// (carta da Coleção). A Dra. Lia e o Caio aparecem como narradores nas lições.
import { arteCarta, arteCompanheiro, nomeCompanheiro } from "./colecao.js";

/** Companheiro equipado, com humor (feliz | triste | uau | neutro). */
export function moli(humor = "feliz", { classe = "" } = {}) {
  return arteCompanheiro({ humor, classe: `vivo ${classe}` });
}

export function avatar(id) {
  if (id === "moli") return { nome: nomeCompanheiro(), svg: arteCompanheiro({ classe: "avatar vivo" }) };
  if (id === "dra_lia") return { nome: "Dra. Lia", svg: arteCarta("lia", { classe: "avatar" }) };
  if (id === "caio") return { nome: "Caio", svg: arteCarta("caio", { classe: "avatar" }) };
  return null;
}
