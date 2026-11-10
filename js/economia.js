// Economia rara: gemas, baús com slots e tempo de abertura, poções de XP.
import { E, salvar, hojeISO, contar } from "./estado.js";
import { cartasDoBau, darCopias, CARTAS } from "./colecao.js";
import { sementesDoBau, sortearPlanta, darSemente } from "./jardim.js";
import { fatorBau, fatorPocao } from "./bonus.js";

export const RARIDADES = {
  madeira: { nome: "Baú de madeira", horas: 3, cor: "#A86B3C", escura: "#6E4223", brilho: "#E8B57E" },
  prata: { nome: "Baú de prata", horas: 8, cor: "#AEB8C6", escura: "#6E7A8C", brilho: "#F3F6FA" },
  ouro: { nome: "Baú de ouro", horas: 12, cor: "#F2B33D", escura: "#B07508", brilho: "#FFE7A3" },
  epico: { nome: "Baú épico", horas: 24, cor: "#9B5CF6", escura: "#5B2DB0", brilho: "#E0CCFF" },
  lendario: { nome: "Baú lendário", horas: 48, cor: "#FF7A1A", escura: "#B33C00", brilho: "#FFE08A" },
  // ----- baús especiais: cada um com uma mecânica própria (base = de onde vêm as cartas e sementes comuns) -----
  escolha: { nome: "Baú da Escolha", horas: 8, cor: "#5C8DD6", escura: "#3B66A8", brilho: "#FFD3E6", base: "prata", especial: "Duas cartas aparecem: você escolhe uma." },
  jardineiro: { nome: "Baú do Jardineiro", horas: 6, cor: "#4CAF6E", escura: "#2F7A4A", brilho: "#C9F2D6", base: "madeira", especial: "Duas sementes aparecem: você escolhe uma (e ganha mais uma de brinde)." },
  caminhos: { nome: "Baú dos Três Caminhos", horas: 12, cor: "#1F6F78", escura: "#124A50", brilho: "#9FE3E8", base: "ouro", especial: "Escolha um de três prêmios: uma carta, uma semente ou gemas." },
  gelado: { nome: "Baú Gelado", horas: 2, cor: "#9FD8F5", escura: "#4FA3CF", brilho: "#EAF8FF", base: "madeira", especial: "Abre rápido e sempre traz um congelamento de ofensiva." },
  sorte: { nome: "Baú da Sorte", horas: 6, cor: "#2FA37A", escura: "#1C6E52", brilho: "#BDF0D9", base: "prata", especial: "Uma roleta multiplica as moedas: ×1, ×2, ×3 ou ×5." },
  cristal: { nome: "Baú de Cristal", horas: 12, cor: "#7FD6F5", escura: "#3E9EC4", brilho: "#E6FAFF", base: "prata", especial: "Gemas garantidas, e muitas." },
  pirata: { nome: "Baú Pirata", horas: 8, cor: "#6E4223", escura: "#3E2414", brilho: "#F2B33D", base: "madeira", especial: "Um tesouro de moedas." },
  temporada: { nome: "Baú da Temporada", horas: 12, cor: "#3B2F8F", escura: "#241B5E", brilho: "#FFD66B", base: "epico", especial: "Escolha um de três prêmios lendários: carta, semente ou 40 gemas." },
  festa: { nome: "Baú de evento", horas: 12, cor: "#F07BB0", escura: "#B8457E", brilho: "#FFE1EC", base: "ouro", especial: "Traz a carta exclusiva do evento." },
};
/** Raridade "de origem" do baú, para as tabelas de cartas e sementes. */
export const baseDe = (tipo) => RARIDADES[tipo]?.base || tipo;
/** Baús especiais que podem aparecer no lugar do baú da trilha do dia: [tipo, peso]. */
const ESPECIAIS = [["escolha", 25], ["jardineiro", 20], ["sorte", 20], ["gelado", 12], ["pirata", 10], ["cristal", 8], ["caminhos", 5]];
export const ORDEM = ["madeira", "prata", "ouro", "epico", "lendario"];

export const POCOES = {
  x2_15: { nome: "Poção de XP ×2", mult: 2, min: 15, cor: "#2F9BFF" },
  x2_30: { nome: "Poção de XP ×2 longa", mult: 2, min: 30, cor: "#1E6FE0" },
  x3_20: { nome: "Poção de XP ×3", mult: 3, min: 20, cor: "#9B5CF6" },
  x5_10: { nome: "Poção de XP ×5", mult: 5, min: 10, cor: "#FF7A1A" },
};

function eco() {
  const est = E();
  est.gemas ??= 0;
  est.inventario ??= { pocoes: {} };
  est.pocaoAtiva ??= null;
  est.baus ??= { slots: [null, null, null, null], semEpico: 0, semLendario: 0, abertos: 0 };
  ajustarSlots(est.baus);
  return est;
}

// ---------- slots a mais (pedido do Alediov, 09/11/2026: comprar slots com moedas ou gemas) ----------
// 4 de graça; até SLOTS_MAX comprando, um preço por slot (o 5º, o 6º…), em moedas OU em gemas. Cada compra é um
// registro em E().baus.compras {id: {moeda, preco, em}} (a sincronia une os registros: comprar no celular vale no
// tablet, sem contar duas vezes) e a quantidade de slots sai daí. O 5º slot que ele já tinha veio de um bug da junção
// (juntar.js unia `slots` como lista qualquer: os dois aparelhos puseram um baú no mesmo slot livre e a lista virou 5;
// agora `baus.slots` tem junção própria, por id e posição): ele fica, como presente, e conta como comprado.
export const SLOTS_BASE = 4, SLOTS_MAX = 8;
/** Preço do 5º, 6º, 7º e 8º slot. */
export const PRECOS_SLOT = [{ moedas: 1200, gemas: 100 }, { moedas: 2500, gemas: 200 }, { moedas: 5000, gemas: 350 }, { moedas: 9000, gemas: 500 }];
const PRESENTE_SINC = "2026-11-06T22:29:06-03:00";
function ajustarSlots(b) {
  if (!Array.isArray(b.slots)) b.slots = [];
  for (let i = 0; i < b.slots.length; i++) if (b.slots[i] === undefined) b.slots[i] = null;
  if (b.compras === undefined || b.compras === null) {
    b.compras = {};
    const extra = Math.min(SLOTS_MAX, b.slots.length) - SLOTS_BASE; // o 5º do bug (id fixo: os dois aparelhos chegam ao mesmo registro)
    for (let k = 1; k <= extra; k++) b.compras[`presente-sinc-${k}`] = { moeda: "presente", preco: 0, em: PRESENTE_SINC };
  }
  const cap = capacidadeDe(b);
  while (b.slots.length > cap) { const k = b.slots.lastIndexOf(null); if (k < 0) break; b.slots.splice(k, 1); } // baú a mais (junção) fica até ser aberto
  while (b.slots.length < cap) b.slots.push(null);
}
const capacidadeDe = (b) => SLOTS_BASE + Object.keys(b.compras || {}).length;
export function capacidadeSlots() { return capacidadeDe(eco().baus); }
/** Preço do próximo slot ({moedas, gemas, numero}) ou null no teto. */
export function precoProximoSlot() {
  const cap = capacidadeSlots(), n = cap - SLOTS_BASE;
  return cap >= SLOTS_MAX ? null : { ...PRECOS_SLOT[Math.min(n, PRECOS_SLOT.length - 1)], numero: cap + 1 };
}
/** Compra um slot; moeda "moedas" | "gemas". Devolve { ok, slot } ou { erro }. */
export function comprarSlot(moeda) {
  const est = eco(), pr = precoProximoSlot();
  if (!pr) return { erro: `Você já tem os ${SLOTS_MAX} slots.` };
  const preco = pr[moeda];
  if (!preco) return { erro: "Moeda inválida." };
  if (moeda === "gemas") { if ((est.gemas || 0) < preco) return { erro: `Faltam gemas: custa ${preco}.` }; est.gemas -= preco; }
  else { if ((est.moedas || 0) < preco) return { erro: `Faltam moedas: custa ${preco}.` }; est.moedas -= preco; }
  const em = new Date().toISOString();
  est.baus.compras[`s${uid()}`] = { moeda, preco, em };
  ajustarSlots(est.baus);
  est.extratos?.unshift({ quando: em, xp: 0, moedas: moeda === "moedas" ? -preco : 0, motivo: `${pr.numero}º slot de baú` });
  salvar();
  window.dispatchEvent(new Event("oq-baus")); window.dispatchEvent(new Event("oq-topo"));
  return { ok: true, slot: pr.numero };
}
export function iniciarEconomia() { eco(); salvar(); }

const sorteio = (min, max) => Math.round(min + Math.random() * (max - min));
const chance = (p) => Math.random() < p;
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- poções ----------
export function multiplicadorAtual() {
  const p = eco().pocaoAtiva;
  if (!p) return 1;
  if (Date.now() > p.ate) { E().pocaoAtiva = null; salvar(); return 1; }
  return p.mult;
}
export function pocaoAtiva() { return multiplicadorAtual() > 1 ? E().pocaoAtiva : null; }
export function minutosRestantesPocao() { const p = pocaoAtiva(); return p ? Math.ceil((p.ate - Date.now()) / 60000) : 0; }
export function inventarioPocoes() { return Object.entries(eco().inventario.pocoes).filter(([, n]) => n > 0); }
export function ativarPocao(tipo) {
  const est = eco();
  if (pocaoAtiva()) return { erro: "Já existe uma poção ativa." };
  if (!(est.inventario.pocoes[tipo] > 0)) return { erro: "Você não tem esta poção." };
  const p = POCOES[tipo];
  est.inventario.pocoes[tipo]--;
  const min = Math.round(p.min * fatorPocao());
  est.pocaoAtiva = { tipo, mult: p.mult, ate: Date.now() + min * 60000 };
  contar("pocoes");
  salvar();
  return { ok: true, p: { ...p, min } };
}
export function darPocao(tipo, n = 1) { const inv = eco().inventario.pocoes; inv[tipo] = (inv[tipo] || 0) + n; salvar(); }

// ---------- gemas ----------
export function gemas() { return eco().gemas; }
export function ganharGemas(n) { eco().gemas += n; salvar(); }
export function gastarGemas(n) { const est = eco(); if (est.gemas < n) return false; est.gemas -= n; salvar(); return true; }

// ---------- conserto do saldo (bug da sincronização de 01/11/2026) ----------
// O celular enviou a rev 429 do progresso (com 660 moedas, 25 gemas e 19 cópias de cartas gastas em evoluções) e o
// Android fechou o app antes de guardar a base nova; na volta, a sincronização juntou o próprio envio com a base velha e
// cobrou tudo de novo (moedas −467, gemas −24, cópias negativas em Moli, Fantasminha, Duda e Barão). A causa foi
// corrigida em sincronia.js/juntar.js; aqui, uma vez, o que foi cobrado duas vezes volta, e o que ainda estiver negativo
// vira 0. Cada conserto fica em E().reparos[id] = { em, delta, motivo }, e a junção (juntar.js) não devolve duas vezes
// se os dois aparelhos consertarem antes de sincronizar.
const DUPLO = { id: "sinc-2026-11-01", motivo: "Devolução: cobrado duas vezes na sincronização de 01/11",
  delta: { moedas: 660, gemas: 25, "colecao.cartas.moli.copias": 8, "colecao.cartas.fantasminha.copias": 8, "colecao.cartas.duda.copias": 2, "colecao.cartas.barao.copias": 1 } };
const somarEm = (est, caminho, v) => {
  const p = caminho.split("."), k = p.pop(); let o = est;
  for (const x of p) { o = o?.[x]; if (!o || typeof o !== "object") return false; }
  if (typeof o[k] !== "number") return false;
  o[k] += v; return true;
};
/** Conserta o saldo (moedas, gemas, cópias de cartas e sementes, poções) e devolve um texto do que mudou, ou null. */
export function consertarSaldos() {
  const est = eco(), em = new Date().toISOString(), feitos = [];
  est.reparos ??= {};
  const cs = est.colecao?.cartas || {};
  if (!est.reparos[DUPLO.id] && (est.criadoEm || "") <= "2026-11-01" && (est.gemas < 0 || est.moedas < 0 || ["moli", "fantasminha", "duda", "barao"].some(k => cs[k]?.copias < 0))) {
    const delta = {};
    for (const [c, v] of Object.entries(DUPLO.delta)) if (somarEm(est, c, v)) delta[c] = v;
    est.reparos[DUPLO.id] = { em, delta, motivo: DUPLO.motivo };
    est.extratos.unshift({ quando: em, xp: 0, moedas: delta.moedas || 0, motivo: DUPLO.motivo });
    const cop = Object.entries(delta).filter(([c]) => c.endsWith(".copias")).reduce((a, [, v]) => a + v, 0);
    feitos.push(`+${delta.moedas || 0} moedas, +${delta.gemas || 0} gemas e ${cop} cópias de cartas que tinham sido cobradas duas vezes`);
  }
  // o que ainda estiver negativo vira 0
  const zerar = {};
  const ver = (c, v) => { if (typeof v === "number" && v < 0) zerar[c] = -v; };
  ver("moedas", est.moedas); ver("gemas", est.gemas);
  for (const [id, c] of Object.entries(cs)) ver(`colecao.cartas.${id}.copias`, c?.copias);
  for (const [id, p] of Object.entries(est.jardim?.plantas || {})) ver(`jardim.plantas.${id}.copias`, p?.copias);
  for (const [t, n] of Object.entries(est.inventario?.pocoes || {})) ver(`inventario.pocoes.${t}`, n);
  if (Object.keys(zerar).length) {
    for (const [c, v] of Object.entries(zerar)) somarEm(est, c, v);
    const id = `neg-${Object.entries(zerar).map(([c, v]) => `${c}:${v}`).join(",")}`; // o mesmo nos dois aparelhos, se os dois zerarem a mesma coisa
    est.reparos[id] = { em, delta: zerar, motivo: "Saldo negativo zerado" };
    feitos.push(`${Object.keys(zerar).length} saldo(s) negativo(s) voltaram a 0`);
  }
  if (est.ofensiva?.congelamentos < 0) est.ofensiva.congelamentos = 0;
  if (!feitos.length) return null;
  salvar();
  return `Saldo consertado: ${feitos.join("; ")}.`;
}

// ---------- baús ----------
/** Baú de evento: já vem pronto para abrir e garante cópias da carta do evento. Precisa de slot livre. */
export function ganharBauEvento(cartaId, qtd, nomeEvento) {
  const b = eco().baus, i = b.slots.findIndex(s => !s);
  if (i < 0) return null;
  const agora = Date.now();
  b.slots[i] = { id: uid(), raridade: "festa", origem: `evento ${nomeEvento}`, obtidoEm: agora, inicio: agora, pronto: agora, extraCartas: [{ id: cartaId, qtd }] };
  salvar(); window.dispatchEvent(new Event("oq-baus"));
  return { slot: i };
}
/** Baú que já chega pronto para abrir (prêmios de temporada etc.). Precisa de slot livre. */
export function colocarBauPronto(tipo, origem) {
  const b = eco().baus, i = b.slots.findIndex(s => !s);
  if (i < 0) return null;
  const agora = Date.now();
  b.slots[i] = { id: uid(), raridade: tipo, origem, obtidoEm: agora, inicio: agora, pronto: agora };
  salvar(); window.dispatchEvent(new Event("oq-baus"));
  return { slot: i };
}
export function sortearRaridade(precisao = 0.8) {
  const b = eco().baus;
  if (b.semLendario >= 44) return "lendario";
  if (b.semEpico >= 14) return "epico";
  const pesos = precisao >= 0.95 ? [15, 35, 33, 13, 4] : precisao >= 0.85 ? [30, 35, 25, 8, 2] : [50, 30, 15, 4, 1];
  let r = Math.random() * pesos.reduce((s, x) => s + x, 0);
  let tipo = "madeira";
  for (let i = 0; i < pesos.length; i++) { if ((r -= pesos[i]) < 0) { tipo = ORDEM[i]; break; } }
  // nos dias que não deram épico nem lendário, 1 em 4 vira um baú especial
  if (["madeira", "prata", "ouro"].includes(tipo) && Math.random() < 0.25) return sortearEspecial();
  return tipo;
}
export function sortearEspecial() {
  let r = Math.random() * ESPECIAIS.reduce((s, [, w]) => s + w, 0);
  for (const [t, w] of ESPECIAIS) { if ((r -= w) < 0) return t; }
  return "escolha";
}

/** Coloca um baú no primeiro slot livre. Com os slots cheios, vira moedas. */
/** `id` fixo (opcional): o mesmo presente dado nos dois aparelhos antes da sincronia vira um baú só na junção. */
export function ganharBau(raridade, origem = "trilha", { id } = {}) {
  const est = eco(), b = est.baus;
  b.semEpico = ["epico", "lendario"].includes(raridade) ? 0 : b.semEpico + 1;
  b.semLendario = raridade === "lendario" ? 0 : b.semLendario + 1;
  const i = b.slots.findIndex(s => !s);
  if (i < 0) {
    const moedas = { madeira: 15, prata: 30, ouro: 60, epico: 120, lendario: 250 }[baseDe(raridade)] || 30;
    est.moedas += moedas; salvar();
    return { cheio: true, raridade, moedas };
  }
  b.slots[i] = { id: id || uid(), raridade, origem, obtidoEm: Date.now(), inicio: null, pronto: null };
  avancarAutoAbertura();
  salvar();
  return { slot: i, raridade };
}
export function situacao(bau) {
  if (!bau) return "vazio";
  if (!bau.inicio) return "fechado";
  return Date.now() >= bau.pronto ? "pronto" : "abrindo";
}
export function algumAbrindo() { return eco().baus.slots.some(s => situacao(s) === "abrindo"); }
const duracaoBau = (s) => Math.round(RARIDADES[s.raridade].horas * fatorBau() * 3600000);
export function iniciarAbertura(i) {
  const b = eco().baus, s = b.slots[i];
  if (!s || s.inicio || algumAbrindo()) return false;
  s.inicio = Date.now();
  s.pronto = s.inicio + duracaoBau(s);
  b.fimAbertura = Math.max(b.fimAbertura || 0, s.pronto); // até quando a fila de abertura está ocupada (abertura automática)
  salvar();
  window.dispatchEvent(new Event("oq-baus"));
  return true;
}
export function restanteMs(bau) { return bau?.pronto ? Math.max(0, bau.pronto - Date.now()) : Math.round(RARIDADES[bau.raridade].horas * fatorBau() * 3600000); }
/** 1 gema a cada 30 minutos restantes. */
export function custoAcelerar(bau) { return Math.max(1, Math.ceil(restanteMs(bau) / 1800000)); }
export function acelerar(i) {
  const s = eco().baus.slots[i];
  const custo = custoAcelerar(s);
  if (!gastarGemas(custo)) return false;
  if (situacao(s) === "abrindo") eco().baus.fimAbertura = Date.now(); // o que estava abrindo acabou agora: a fila anda
  s.inicio ||= Date.now(); s.pronto = Date.now(); salvar();
  window.dispatchEvent(new Event("oq-baus"));
  return true;
}

// ---------- abertura automática dos baús (pedido do Alediov, 02/11/2026: "um upgrade caro, em diamantes, para começar
// a desbloquear os baús automaticamente… quando acaba o tempo de um, ele começa a abrir outro") ----------
// Compra única na loja (PRECO_AUTO gemas). Ligada, sempre que nenhum baú está abrindo e há baú fechado, o próximo da
// fila começa a abrir no instante em que o anterior acabou (ou em que o baú chegou, ou em que a abertura automática foi
// ligada), calculado pelo relógio: com o app fechado a fila anda do mesmo jeito, e ao abrir o app ela é posta em dia.
// A conta só usa horários guardados no estado, então os dois aparelhos chegam ao mesmo resultado. Estado em
// E().baus.auto = { comprado, ligado, ordem: "rapido" | "slots" | "raro", desde, em } e E().baus.fimAbertura.
export const PRECO_AUTO = 250;
export const ORDENS_AUTO = { rapido: "O mais rápido primeiro", slots: "Na ordem dos slots", raro: "O mais raro primeiro" };
export const autoBaus = () => eco().baus.auto || null;
export const autoLigada = () => !!(eco().baus.auto?.comprado && eco().baus.auto.ligado);
function proximoDaFila(fechados, ordem) {
  const k = (x) => (ordem === "slots" ? x.i : ordem === "raro" ? -ORDEM.indexOf(baseDe(x.s.raridade)) * 10 + x.i : duracaoBau(x.s) / 1000 + x.i / 100);
  return [...fechados].sort((a, b) => k(a) - k(b))[0];
}
/** Põe a fila em dia até o instante `ate` (Infinity: a previsão inteira). Muda `b` e devolve os baús que começaram. */
function encadear(b, a, ate) {
  const novos = [];
  for (let k = 0; k < 8; k++) {
    if (b.slots.some(s => s?.inicio && s.pronto > ate)) break; // um ainda abrindo
    const fechados = b.slots.map((s, i) => ({ s, i })).filter(x => x.s && !x.s.inicio && RARIDADES[x.s.raridade]);
    if (!fechados.length) break;
    const { s, i } = proximoDaFila(fechados, a.ordem);
    const fim = Math.max(b.fimAbertura || 0, ...b.slots.filter(x => x?.pronto).map(x => x.pronto));
    s.inicio = Math.min(ate, Math.max(fim, s.obtidoEm || 0, a.desde || 0));
    s.pronto = s.inicio + duracaoBau(s); s.auto = true;
    b.fimAbertura = s.pronto;
    novos.push({ i, raridade: s.raridade, inicio: s.inicio, pronto: s.pronto });
  }
  return novos;
}
/** Avança a abertura automática até agora. Devolve true se algum baú começou a abrir. */
export function avancarAutoAbertura(agora = Date.now()) {
  const b = eco().baus, a = b.auto;
  if (!a?.comprado || !a.ligado) return false;
  const novos = encadear(b, a, agora);
  if (novos.length) salvar();
  return novos.length > 0;
}
/** Quando cada baú fica pronto (os que estão abrindo e, com a abertura automática, a fila prevista): [{ i, raridade, inicio, pronto }]. */
export function previsaoBaus() {
  const b = JSON.parse(JSON.stringify(eco().baus)), a = b.auto, agora = Date.now();
  const lista = b.slots.map((s, i) => (s?.pronto && s.pronto > agora ? { i, raridade: s.raridade, inicio: s.inicio, pronto: s.pronto } : null)).filter(Boolean);
  if (a?.comprado && a.ligado) lista.push(...encadear(b, a, Infinity).filter(x => x.pronto > agora));
  return lista.sort((x, y) => x.pronto - y.pronto);
}
export function comprarAuto() {
  const b = eco().baus;
  if (b.auto?.comprado) return { erro: "Você já tem a abertura automática." };
  if (!gastarGemas(PRECO_AUTO)) return { erro: `Faltam gemas: custa ${PRECO_AUTO}.` };
  const em = new Date().toISOString();
  b.auto = { comprado: em, ligado: true, ordem: "rapido", desde: Date.now(), em };
  avancarAutoAbertura(); salvar();
  window.dispatchEvent(new Event("oq-baus"));
  return { ok: true };
}
/** Liga/desliga e escolhe a ordem. */
export function ajustarAuto({ ligado, ordem } = {}) {
  const a = eco().baus.auto;
  if (!a?.comprado) return false;
  if (ligado !== undefined && ligado !== a.ligado) { a.ligado = ligado; if (ligado) a.desde = Date.now(); }
  if (ordem && ORDENS_AUTO[ordem]) a.ordem = ordem;
  a.em = new Date().toISOString();
  avancarAutoAbertura(); salvar();
  window.dispatchEvent(new Event("oq-baus"));
  return true;
}

const TABELA = {
  madeira: { moedas: [25, 45], xp: 30, gemas: () => (chance(0.1) ? 1 : 0), pocoes: () => (chance(0.2) ? ["x2_15"] : []), congela: 0 },
  prata: { moedas: [60, 100], xp: 60, gemas: () => (chance(0.35) ? sorteio(1, 2) : 0), pocoes: () => [chance(0.7) ? "x2_15" : "x2_30"], congela: 0.05 },
  ouro: { moedas: [130, 200], xp: 120, gemas: () => sorteio(2, 4), pocoes: () => [chance(0.5) ? "x2_30" : "x3_20", ...(chance(0.4) ? ["x2_15"] : [])], congela: 0.15 },
  epico: { moedas: [300, 450], xp: 250, gemas: () => sorteio(6, 10), pocoes: () => ["x3_20", chance(0.5) ? "x2_30" : "x3_20"], congela: 0.4 },
  lendario: { moedas: [700, 1000], xp: 600, gemas: () => sorteio(15, 25), pocoes: () => ["x5_10", "x3_20", "x2_30"], congela: 1 },
  escolha: { moedas: [60, 100], xp: 60, gemas: () => 0, pocoes: () => [], congela: 0, cartas: false, escolha: "cartas" },
  jardineiro: { moedas: [40, 70], xp: 40, gemas: () => 0, pocoes: () => [], congela: 0, sementes: false, escolha: "sementes" },
  caminhos: { moedas: [150, 250], xp: 150, gemas: () => 0, pocoes: () => [chance(0.5) ? "x2_30" : "x3_20"], congela: 0, escolha: "caminhos" },
  gelado: { moedas: [30, 60], xp: 40, gemas: () => 0, pocoes: () => ["x2_30"], congela: 1 },
  sorte: { moedas: [50, 90], xp: 60, gemas: () => (chance(0.3) ? 1 : 0), pocoes: () => [], congela: 0, roleta: true },
  cristal: { moedas: [80, 120], xp: 100, gemas: () => sorteio(8, 14), pocoes: () => [], congela: 0 },
  pirata: { moedas: [350, 550], xp: 80, gemas: () => (chance(0.3) ? sorteio(2, 3) : 0), pocoes: () => [], congela: 0 },
  temporada: { moedas: [300, 450], xp: 250, gemas: () => sorteio(5, 8), pocoes: () => ["x3_20"], congela: 0.5, escolha: "temporada" },
  festa: { moedas: [130, 200], xp: 120, gemas: () => sorteio(2, 4), pocoes: () => ["x2_30"], congela: 0.15 },
};
const ROLETA = [[1, 45], [2, 30], [3, 18], [5, 7]];
const QTD_CARTA = { comum: 8, rara: 4, epica: 2, lendaria: 1 };
function porPeso(pesos) { let r = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0); for (const [k, w] of Object.entries(pesos)) { if ((r -= w) < 0) return k; } return Object.keys(pesos)[0]; }
function cartaAleatoria(rar, fora = []) {
  const pool = Object.keys(CARTAS).filter(k => CARTAS[k].raridade === rar && !CARTAS[k].evento && !CARTAS[k].premio && !fora.includes(k));
  return pool[Math.floor(Math.random() * pool.length)];
}
function opcaoCarta(pesos, fora) { const rar = porPeso(pesos), id = cartaAleatoria(rar, fora); return { tipo: "carta", carta: id, qtd: QTD_CARTA[rar] }; }
function opcaoSemente(pesos, fora = []) { let id = sortearPlanta(pesos); for (let k = 0; k < 6 && fora.includes(id); k++) id = sortearPlanta(pesos); return { tipo: "semente", planta: id, qtd: 1 }; }
/** Opções de um baú de escolha (ainda não entregues). */
function montarEscolha(tipo) {
  if (tipo === "cartas") { const a = opcaoCarta({ rara: 60, epica: 32, lendaria: 8 }, []); return [a, opcaoCarta({ rara: 50, epica: 40, lendaria: 10 }, [a.carta])]; }
  if (tipo === "sementes") { const a = opcaoSemente({ rara: 60, epica: 32, lendaria: 8 }); return [a, opcaoSemente({ rara: 50, epica: 40, lendaria: 10 }, [a.planta])]; }
  if (tipo === "temporada") return [opcaoCarta({ lendaria: 100 }, []), opcaoSemente({ lendaria: 100 }), { tipo: "gemas", qtd: 40 }];
  return [opcaoCarta({ epica: 75, lendaria: 25 }, []), opcaoSemente({ epica: 75, lendaria: 25 }), { tipo: "gemas", qtd: sorteio(15, 25) }];
}

/** Abre um baú pronto: aplica e devolve a lista de recompensas para a animação.
 *  Baús de escolha devolvem também `escolha` (opções); a escolhida é entregue por escolherDoBau(). */
export function abrirBau(i) {
  const est = eco(), s = est.baus.slots[i];
  if (situacao(s) !== "pronto") return null;
  const t = TABELA[s.raridade] || TABELA.prata, base = baseDe(s.raridade);
  const itens = [];
  let moedas = sorteio(...t.moedas), roleta = 0;
  if (t.roleta) { roleta = Number(porPeso(Object.fromEntries(ROLETA))); moedas *= roleta; }
  itens.push({ tipo: "moedas", qtd: moedas, roleta });
  itens.push({ tipo: "xp", qtd: t.xp });
  let g = t.gemas(); if (g) itens.push({ tipo: "gemas", qtd: g });
  const ps = {};
  for (const p of t.pocoes()) ps[p] = (ps[p] || 0) + 1;
  for (const [p, n] of Object.entries(ps)) itens.push({ tipo: "pocao", pocao: p, qtd: n });
  if (chance(t.congela)) {
    if (est.ofensiva.congelamentos < 2) itens.push({ tipo: "congelamento", qtd: 1 });
    else if (s.raridade === "gelado") { itens.push({ tipo: "gemas", qtd: 3 }); g += 3; } // estoque cheio: vira gemas
  }
  for (const x of s.extraCartas || []) itens.push({ tipo: "carta", carta: x.id, qtd: x.qtd, nova: darCopias(x.id, x.qtd) });
  if (t.cartas !== false) for (const c of cartasDoBau(base)) itens.push({ tipo: "carta", carta: c.id, qtd: c.qtd, nova: c.nova });
  if (t.sementes !== false) for (const sm of sementesDoBau(base)) itens.push({ tipo: "semente", planta: sm.id, qtd: 1, nova: sm.nova });
  if (t.escolha === "sementes") { const b = opcaoSemente({ comum: 100 }); itens.push({ ...b, nova: darSemente(b.planta) }); }
  // aplica
  est.moedas += moedas; est.xp += t.xp; est.gemas += g;
  const d = est.diario[hojeISO()] ||= { xp: 0, licoes: [] }; d.xp += t.xp;
  for (const [p, n] of Object.entries(ps)) est.inventario.pocoes[p] = (est.inventario.pocoes[p] || 0) + n;
  if (itens.some(x => x.tipo === "congelamento")) est.ofensiva.congelamentos++;
  const escolha = t.escolha ? montarEscolha(t.escolha) : null;
  if (escolha) est.baus.escolhaPendente = { raridade: s.raridade, opcoes: escolha };
  est.baus.slots[i] = null; est.baus.abertos++;
  est.extratos.unshift({ quando: new Date().toISOString(), xp: t.xp, moedas, motivo: `${RARIDADES[s.raridade].nome} aberto` });
  salvar();
  window.dispatchEvent(new Event("oq-baus"));
  return { raridade: s.raridade, itens, escolha };
}
export const escolhaPendente = () => eco().baus.escolhaPendente || null;
/** Entrega a opção k da escolha pendente e devolve o item (com `nova`). */
export function escolherDoBau(k) {
  const est = eco(), p = est.baus.escolhaPendente;
  if (!p || !p.opcoes[k]) return null;
  const o = { ...p.opcoes[k] };
  if (o.tipo === "carta") { o.nova = darCopias(o.carta, o.qtd); window.dispatchEvent(new Event("oq-colecao")); }
  else if (o.tipo === "semente") o.nova = darSemente(o.planta, o.qtd);
  else if (o.tipo === "gemas") est.gemas += o.qtd;
  est.baus.escolhaPendente = null; salvar();
  return o;
}

export function fmtTempo(ms) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}

// ---------- abas da trilha e baú bônus ----------
/** A aba da trilha de uma sessão: Aulas (manhã, tarde, noite), Extensão (projetos de extensão) ou Provas. */
export function abaDaSessao(s) {
  if (s.aba) return s.aba;
  if (s.periodo !== "extra") return "aulas";
  return /periodont|hospitalar|cirurg|liga|extens/i.test(`${s.disciplina || ""} ${s.nome || ""}`) ? "extensao" : "provas";
}
export const ABAS_BONUS = { extensao: "Extensão", provas: "Provas" };
/** Baú bônus de uma aba nova (Extensão ou Provas): ao terminar todas as lições dela no dia. Madeira, ou prata com ≥ 90% de acerto. */
export function verificarBauBonus(dia) {
  if (!dia?.sessoes) return null;
  const est = eco();
  est.bausBonus ??= {};
  for (const aba of Object.keys(ABAS_BONUS)) {
    const ids = dia.sessoes.filter(s => s.periodo === "extra" && abaDaSessao(s) === aba).flatMap(s => s.licoes.map(l => l.id));
    const chave = `${dia.data}|${aba}`;
    if (!ids.length || est.bausBonus[chave] || !ids.every(id => est.concluidas[id])) continue;
    const tot = ids.reduce((s, id) => s + (est.concluidas[id].total || 0), 0), ac = ids.reduce((s, id) => s + (est.concluidas[id].acertos || 0), 0);
    const precisao = tot ? ac / tot : 0.8, raridade = precisao >= 0.9 ? "prata" : "madeira";
    est.bausBonus[chave] = raridade;
    salvar();
    return { ...ganharBau(raridade, `bônus ${ABAS_BONUS[aba]} ${dia.data}`), precisao, aba };
  }
  return null;
}

// ---------- baú da trilha do dia ----------
/** Chamado ao concluir uma lição: se todas as lições do dia estiverem feitas, dá o baú (uma vez por dia). */
export function verificarBauDoDia(dia) {
  if (!dia) return null;
  const est = eco();
  const ids = dia.sessoes.filter(s => s.periodo !== "extra").flatMap(s => s.licoes.map(l => l.id)); // a sessão extra é bônus
  if (!ids.length || !ids.every(id => est.concluidas[id])) return null; // dia sem aulas (ou só a aba Extensão/Provas): sem baú
  est.bausDados ??= {};
  if (est.bausDados[dia.data]) return null;
  const tot = ids.reduce((s, id) => s + (est.concluidas[id].total || 0), 0);
  const ac = ids.reduce((s, id) => s + (est.concluidas[id].acertos || 0), 0);
  const precisao = tot ? ac / tot : 0.8;
  const raridade = sortearRaridade(precisao);
  est.bausDados[dia.data] = raridade;
  salvar();
  return { ...ganharBau(raridade, `trilha ${dia.data}`), precisao };
}
