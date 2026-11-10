// Ofertas do dia (loja): 4 itens sorteados a cada dia, 3 por moedas e 1 por gemas, com
// limite de compras e às vezes desconto. O sorteio usa a data como semente, então o dia
// inteiro mostra as mesmas ofertas (e muda à meia-noite).
import { E, salvar, hojeISO } from "./estado.js";
import { CARTAS, darCopias, RARIDADES_CARTA } from "./colecao.js";
import { PLANTAS, darSemente } from "./jardim.js";
import { ganharBau, RARIDADES as RAR_BAU } from "./economia.js";

/** Raridade de cada oferta (mesmas cores das cartas). Baús usam a raridade do baú. */
export const RARIDADE_OFERTA = {
  comum: { nome: "Comum", cor: RARIDADES_CARTA.comum.cor },
  rara: { nome: "Rara", cor: RARIDADES_CARTA.rara.cor },
  epica: { nome: "Épica", cor: RARIDADES_CARTA.epica.cor },
  lendaria: { nome: "Lendária", cor: RARIDADES_CARTA.lendaria.cor },
};
const RAR_DO_BAU = { madeira: "comum", prata: "comum", ouro: "rara", epico: "epica", lendario: "lendaria", escolha: "rara", jardineiro: "comum", caminhos: "epica", gelado: "comum", sorte: "comum", cristal: "rara", pirata: "rara", festa: "rara" };

/** Tabela de ofertas: preço cheio, quantidade, limite por dia e peso no sorteio (maior = mais comum). */
export const CATALOGO = [
  // ----- por moedas -----
  { id: "c-comum", tipo: "carta", rar: "comum", qtd: 6, preco: 120, moeda: "moedas", limite: 3, peso: 10 },
  { id: "c-rara", tipo: "carta", rar: "rara", qtd: 3, preco: 280, moeda: "moedas", limite: 2, peso: 6 },
  { id: "c-epica", tipo: "carta", rar: "epica", qtd: 1, preco: 650, moeda: "moedas", limite: 1, peso: 2 },
  { id: "s-comum", tipo: "semente", rar: "comum", qtd: 2, preco: 90, moeda: "moedas", limite: 3, peso: 10 },
  { id: "s-rara", tipo: "semente", rar: "rara", qtd: 1, preco: 220, moeda: "moedas", limite: 2, peso: 6 },
  { id: "s-epica", tipo: "semente", rar: "epica", qtd: 1, preco: 520, moeda: "moedas", limite: 1, peso: 2 },
  { id: "b-madeira", tipo: "bau", bau: "madeira", qtd: 1, preco: 70, moeda: "moedas", limite: 2, peso: 8 },
  { id: "b-prata", tipo: "bau", bau: "prata", qtd: 1, preco: 160, moeda: "moedas", limite: 2, peso: 6 },
  { id: "b-ouro", tipo: "bau", bau: "ouro", qtd: 1, preco: 380, moeda: "moedas", limite: 1, peso: 2 },
  { id: "b-escolha", tipo: "bau", bau: "escolha", qtd: 1, preco: 240, moeda: "moedas", limite: 1, peso: 4 },
  { id: "b-jardineiro", tipo: "bau", bau: "jardineiro", qtd: 1, preco: 180, moeda: "moedas", limite: 1, peso: 4 },
  { id: "b-sorte", tipo: "bau", bau: "sorte", qtd: 1, preco: 150, moeda: "moedas", limite: 2, peso: 4 },
  // ----- por gemas -----
  { id: "gc-rara", tipo: "carta", rar: "rara", qtd: 5, preco: 12, moeda: "gemas", limite: 2, peso: 6 },
  { id: "gc-epica", tipo: "carta", rar: "epica", qtd: 2, preco: 30, moeda: "gemas", limite: 1, peso: 5 },
  { id: "gc-lendaria", tipo: "carta", rar: "lendaria", qtd: 1, preco: 60, moeda: "gemas", limite: 1, peso: 2 },
  { id: "gs-epica", tipo: "semente", rar: "epica", qtd: 1, preco: 25, moeda: "gemas", limite: 1, peso: 5 },
  { id: "gs-lendaria", tipo: "semente", rar: "lendaria", qtd: 1, preco: 55, moeda: "gemas", limite: 1, peso: 2 },
  { id: "gb-ouro", tipo: "bau", bau: "ouro", qtd: 1, preco: 30, moeda: "gemas", limite: 1, peso: 5 },
  { id: "gb-caminhos", tipo: "bau", bau: "caminhos", qtd: 1, preco: 40, moeda: "gemas", limite: 1, peso: 3 },
  { id: "gb-epico", tipo: "bau", bau: "epico", qtd: 1, preco: 50, moeda: "gemas", limite: 1, peso: 3 },
  { id: "gb-lendario", tipo: "bau", bau: "lendario", qtd: 1, preco: 95, moeda: "gemas", limite: 1, peso: 1 },
];
/** Descontos possíveis em cada oferta: [porcentagem, peso]. */
export const DESCONTOS = [[0, 55], [10, 20], [20, 13], [30, 8], [50, 4]];

export const raridadeDe = (o) => (o.tipo === "bau" ? RAR_DO_BAU[o.bau] : o.rar);

function gerador(texto) { // mulberry32 com semente tirada do texto
  let h = 1779033703;
  for (let i = 0; i < texto.length; i++) { h = Math.imul(h ^ texto.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function porPeso(r, lista, peso) {
  let x = r() * lista.reduce((s, i) => s + peso(i), 0);
  for (const i of lista) { if ((x -= peso(i)) < 0) return i; }
  return lista[lista.length - 1];
}
const arredonda = (v, moeda) => (moeda === "gemas" ? Math.max(1, Math.ceil(v)) : Math.max(5, Math.round(v / 5) * 5));

/** As 4 ofertas de um dia: [{ ...catálogo, alvo, desconto, preco, precoCheio }]. */
export function ofertasDoDia(dia = hojeISO()) {
  const r = gerador(`oq-ofertas-${dia}`);
  const escolhidas = [];
  const moedas = CATALOGO.filter(o => o.moeda === "moedas");
  while (escolhidas.length < 3) {
    const o = porPeso(r, moedas.filter(x => !escolhidas.includes(x)), x => x.peso);
    if (escolhidas.filter(x => x.tipo === o.tipo).length >= 2) continue; // no máximo 2 do mesmo tipo
    escolhidas.push(o);
  }
  escolhidas.push(porPeso(r, CATALOGO.filter(o => o.moeda === "gemas"), x => x.peso));
  return escolhidas.map(o => {
    let alvo = null;
    if (o.tipo === "carta") { const ids = Object.keys(CARTAS).filter(k => CARTAS[k].raridade === o.rar && !CARTAS[k].evento && !CARTAS[k].premio); alvo = ids[Math.floor(r() * ids.length)]; }
    if (o.tipo === "semente") { const ids = Object.keys(PLANTAS).filter(k => PLANTAS[k].raridade === o.rar); alvo = ids[Math.floor(r() * ids.length)]; }
    const desconto = porPeso(r, DESCONTOS, d => d[1])[0];
    return { ...o, alvo, desconto, precoCheio: o.preco, preco: arredonda(o.preco * (1 - desconto / 100), o.moeda) };
  });
}

function registro() {
  const l = E().loja;
  if (!l.ofertas || l.ofertas.dia !== hojeISO()) l.ofertas = { dia: hojeISO(), compras: [0, 0, 0, 0] };
  return l.ofertas;
}
export const comprasHoje = (i) => registro().compras[i] || 0;
export const slotsBauCheios = () => (E().baus?.slots || []).every(Boolean);

export function nomeOferta(o) {
  if (o.tipo === "carta") return `${CARTAS[o.alvo].nome}${o.qtd > 1 ? ` ×${o.qtd}` : ""}`;
  if (o.tipo === "semente") return `${PLANTAS[o.alvo].nome}${o.qtd > 1 ? ` ×${o.qtd}` : ""}`;
  return RAR_BAU[o.bau].nome;
}

/** Compra a oferta i de hoje. Devolve { ok, oferta, nova } ou { erro }. */
export function comprarOferta(i) {
  const o = ofertasDoDia()[i], reg = registro(), est = E();
  if (!o) return { erro: "Oferta indisponível." };
  if ((reg.compras[i] || 0) >= o.limite) return { erro: "Limite de hoje atingido." };
  if (o.tipo === "bau" && slotsBauCheios()) return { erro: "Os slots de baú estão cheios." };
  if (o.moeda === "gemas") { if ((est.gemas || 0) < o.preco) return { erro: "Gemas insuficientes." }; est.gemas -= o.preco; }
  else { if (est.moedas < o.preco) return { erro: "Moedas insuficientes." }; est.moedas -= o.preco; }
  let nova = false;
  if (o.tipo === "carta") { nova = darCopias(o.alvo, o.qtd); window.dispatchEvent(new Event("oq-colecao")); }
  else if (o.tipo === "semente") nova = darSemente(o.alvo, o.qtd);
  else ganharBau(o.bau, "loja");
  reg.compras[i] = (reg.compras[i] || 0) + 1;
  salvar();
  return { ok: true, oferta: o, nova };
}

/** Milissegundos até as próximas ofertas (meia-noite). */
export function msAteNovasOfertas() {
  const a = new Date(), m = new Date(a); m.setHours(24, 0, 0, 0);
  return m - a;
}
