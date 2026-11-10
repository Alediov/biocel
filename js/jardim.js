// Jardim: plantas colecionáveis que produzem moedas, XP ou gemas enquanto estão regadas.
// A rega vale 24 h e se faz uma vez por dia com um quiz da trilha. As sementes vêm dos
// baús e da loja do jardim; sementes repetidas viram cópias para evoluir (como as cartas).
import { E, salvar, hojeISO, somaDias, ganhar } from "./estado.js";
import { definirNiveis } from "./juntar.js";

export const RARIDADES_PLANTA = {
  comum: { nome: "Comum", cor: "#5C8DD6", escura: "#3B66A8", mult: 1 },
  rara: { nome: "Rara", cor: "#F28A1E", escura: "#B85F06", mult: 1.4 },
  epica: { nome: "Épica", cor: "#9B5CF6", escura: "#6732C8", mult: 2 },
  lendaria: { nome: "Lendária", cor: "#E0434A", escura: "#A3232A", mult: 3 },
};
export const PLANTAS = {
  girassol: { nome: "Girassol Sorridente", raridade: "comum", produz: "moedas", base: 15, horas: 4, desc: "Segue o sol e solta moedinhas." },
  trevo: { nome: "Trevo da Sorte", raridade: "comum", produz: "xp", base: 20, horas: 4, desc: "Quatro folhas, quatro vezes mais vontade de estudar." },
  cacto: { nome: "Cacto Espinhoso", raridade: "comum", produz: "moedas", base: 28, horas: 8, desc: "Aguenta tudo, menos ficar sem estudar." },
  hortela: { nome: "Hortelã Fresca", raridade: "comum", produz: "xp", base: 32, horas: 6, desc: "O cheirinho de creme dental do jardim." },
  cogumelo: { nome: "Cogumelo Luminoso", raridade: "rara", produz: "xp", base: 45, horas: 6, desc: "Brilha à noite, bem na hora da revisão." },
  rosa: { nome: "Rosa de Fogo", raridade: "rara", produz: "moedas", base: 50, horas: 8, desc: "Pétalas quentes e um caule cheio de moedas." },
  tulipa: { nome: "Tulipa Arco-íris", raridade: "rara", produz: "moedas", base: 30, horas: 4, desc: "Cada pétala de uma cor, cada colheita rápida." },
  lua: { nome: "Flor da Lua", raridade: "epica", produz: "gemas", base: 1, horas: 12, desc: "Só desabrocha de madrugada e deixa uma gema." },
  mandragora: { nome: "Mandrágora Cantora", raridade: "epica", produz: "xp", base: 90, horas: 8, desc: "Grita a matéria tão alto que ninguém esquece." },
  carnivora: { nome: "Planta Carnívora", raridade: "epica", produz: "moedas", base: 100, horas: 12, desc: "Come moscas e cospe moedas." },
  cristal: { nome: "Árvore de Cristal", raridade: "lendaria", produz: "gemas", base: 3, horas: 24, desc: "Seus frutos são gemas de verdade." },
  margarida: { nome: "Margarida Tagarela", raridade: "comum", produz: "moedas", base: 18, horas: 5, desc: "Bem-me-quer, mal-me-quer: sempre acaba em moeda." },
  bambu: { nome: "Bambu Zen", raridade: "comum", produz: "xp", base: 24, horas: 5, desc: "Cresce um gomo por dia, como o seu estudo." },
  babosa: { nome: "Babosa Calmante", raridade: "comum", produz: "moedas", base: 30, horas: 8, desc: "Gel de aloe para aftas e para o mau humor." },
  cravo: { nome: "Cravo-da-índia", raridade: "rara", produz: "xp", base: 50, horas: 7, desc: "Dele vem o eugenol do cimento de óxido de zinco e eugenol." },
  camomila: { nome: "Camomila Sonolenta", raridade: "rara", produz: "xp", base: 38, horas: 5, desc: "Um chazinho antes da revisão da noite." },
  roma: { nome: "Romã Coroada", raridade: "rara", produz: "moedas", base: 62, horas: 9, desc: "Mil sementes e uma coroa: rica que só." },
  bonsai: { nome: "Bonsai Sábio", raridade: "rara", produz: "moedas", base: 34, horas: 5, desc: "Pequeno, paciente e cheio de conselhos." },
  dentedeleao: { nome: "Dente-de-leão", raridade: "epica", produz: "xp", base: 100, horas: 9, desc: "O nome vem do francês dent de lion: as folhas parecem dentes." },
  vitoria: { nome: "Vitória-régia", raridade: "epica", produz: "moedas", base: 115, horas: 12, desc: "A folha gigante da Amazônia aguenta até uma criança." },
  orquidea: { nome: "Orquídea Estelar", raridade: "epica", produz: "gemas", base: 1, horas: 11, desc: "Floresce com pétalas de cristal em noites claras." },
  ipe: { nome: "Ipê-amarelo", raridade: "lendaria", produz: "moedas", base: 260, horas: 12, desc: "Pinta a cidade de ouro no fim do inverno." },
  lotus: { nome: "Lótus Celestial", raridade: "lendaria", produz: "xp", base: 240, horas: 12, desc: "Nasce no lodo e abre limpinha, como um dente depois da profilaxia." },
  dragoeiro: { nome: "Dragoeiro", raridade: "lendaria", produz: "gemas", base: 2, horas: 16, desc: "Árvore-dragão: a seiva vermelha vira rubis." },
  fenix: { nome: "Flor Fênix", raridade: "lendaria", produz: "xp", base: 220, horas: 12, desc: "Renasce das cinzas a cada colheita." },
  // terceira leva (26/10/2026): plantas que a odontologia usa
  malva: { nome: "Malva Calmante", raridade: "comum", produz: "xp", base: 26, horas: 6, desc: "O bochecho de chá de malva acalma a gengiva inflamada: receita de avó." },
  jua: { nome: "Juazeiro", raridade: "comum", produz: "moedas", base: 22, horas: 5, desc: "A raspa da casca do juá já foi o creme dental do sertão." },
  aroeira: { nome: "Aroeira-vermelha", raridade: "rara", produz: "moedas", base: 56, horas: 8, desc: "Dá a pimenta-rosa, e o extrato vira gel anti-inflamatório." },
  copaiba: { nome: "Copaibeira", raridade: "epica", produz: "gemas", base: 1, horas: 10, desc: "O óleo pinga como âmbar e é estudado como antimicrobiano." },
  jabuticabeira: { nome: "Jabuticabeira", raridade: "lendaria", produz: "moedas", base: 250, horas: 12, desc: "Dá fruta no próprio tronco: riqueza brotando de todo lado." },
};
export const NIVEL_MAX_PLANTA = 10;
const COPIAS = { comum: [2, 3, 5, 8, 12, 18, 25, 35, 50], rara: [2, 3, 4, 6, 9, 13, 18, 24, 32], epica: [1, 2, 3, 4, 6, 8, 11, 14, 18], lendaria: [1, 1, 2, 2, 3, 4, 5, 6, 8] };
const CUSTO = [40, 90, 180, 350, 600, 1000, 1600, 2400, 3500];
/** Sementes gastas para levar a planta do nível 1 ao `nivel`. */
export function copiasInvestidas(id, nivel) { const t = COPIAS[PLANTAS[id]?.raridade] || COPIAS.comum; return t.slice(0, Math.max(0, nivel - 1)).reduce((a, b) => a + b, 0); }
// sincronização entre aparelhos (juntar.js): a mesma evolução feita nos dois não tira as sementes duas vezes
definirNiveis(/^jardim\.plantas\.([^.]+)$/, copiasInvestidas);
export const PRECO_VASOS = [{ moedas: 300 }, { moedas: 600 }, { gemas: 20 }, { gemas: 40 }, { gemas: 70 }, { gemas: 100 }];
export const VASOS_INICIAIS = 3;
export const PACOTES = {
  saco: { nome: "Saco de sementes", preco: { moedas: 150 }, pesos: { comum: 75, rara: 22, epica: 3 } },
  rara: { nome: "Semente rara", preco: { gemas: 15 }, pesos: { rara: 80, epica: 18, lendaria: 2 } },
  epica: { nome: "Semente épica", preco: { gemas: 50 }, pesos: { epica: 85, lendaria: 15 } },
};

export function jardim() {
  const est = E();
  if (!est.jardim) {
    est.jardim = { plantas: { girassol: { nivel: 1, copias: 0 }, trevo: { nivel: 1, copias: 0 } }, vasos: Array(VASOS_INICIAIS).fill(null), regadoAte: 0, ultimaRega: "", sequencia: 0, regas: 0 };
    salvar();
  }
  return est.jardim;
}
export const producao = (id, nivel) => { const p = PLANTAS[id]; const v = p.base * (1 + 0.15 * (nivel - 1)); return p.produz === "gemas" ? Math.max(p.base, Math.floor(v)) : Math.round(v); };
export const copiasParaEvoluir = (id) => { const st = jardim().plantas[id]; return !st || st.nivel >= NIVEL_MAX_PLANTA ? null : COPIAS[PLANTAS[id].raridade][st.nivel - 1]; };
export const custoEvoluir = (id) => { const st = jardim().plantas[id]; if (!st || st.nivel >= NIVEL_MAX_PLANTA) return null; const m = Math.round(CUSTO[st.nivel - 1] * RARIDADES_PLANTA[PLANTAS[id].raridade].mult); return { moedas: m, gemas: Math.ceil(m / 50) }; };
export const podeEvoluir = (id) => { const n = copiasParaEvoluir(id), st = jardim().plantas[id]; return n != null && st.copias >= n; };
export function evoluir(id, moeda) {
  const est = E(), st = jardim().plantas[id];
  if (!podeEvoluir(id)) return { erro: "Faltam sementes desta planta." };
  const c = custoEvoluir(id);
  if (moeda === "gemas") { if ((est.gemas || 0) < c.gemas) return { erro: "Gemas insuficientes." }; est.gemas -= c.gemas; }
  else { if (est.moedas < c.moedas) return { erro: "Moedas insuficientes." }; est.moedas -= c.moedas; }
  st.copias -= copiasParaEvoluir(id); st.nivel++; salvar();
  return { ok: true, nivel: st.nivel };
}

/** Uma semente: a primeira desbloqueia a planta; as outras viram cópias. */
export function darSemente(id, n = 1) {
  const j = jardim();
  let nova = false;
  if (!j.plantas[id]) { j.plantas[id] = { nivel: 1, copias: n - 1 }; nova = true; } else j.plantas[id].copias += n;
  salvar();
  return nova;
}
export function sortearPlanta(pesos) {
  let r = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0), rar = "comum";
  for (const [k, w] of Object.entries(pesos)) { if ((r -= w) < 0) { rar = k; break; } }
  const pool = Object.keys(PLANTAS).filter(k => PLANTAS[k].raridade === rar);
  return pool[Math.floor(Math.random() * pool.length)];
}
const SEMENTES_BAU = {
  prata: () => (Math.random() < 0.35 ? [{ comum: 1 }] : []),
  ouro: () => [{ comum: 70, rara: 30 }],
  epico: () => [{ comum: 40, rara: 45, epica: 15 }, { comum: 40, rara: 45, epica: 15 }],
  lendario: () => [{ epica: 100 }, { rara: 60, epica: 30, lendaria: 10 }, { comum: 30, rara: 50, epica: 20 }],
};
/** Sementes que saem de um baú: [{ id, nova }]. */
export function sementesDoBau(raridadeBau) {
  return (SEMENTES_BAU[raridadeBau]?.() || []).map(p => { const id = sortearPlanta(p); return { id, nova: darSemente(id) }; });
}

// ---------- rega e produção ----------
export const regadoAgora = () => Date.now() < jardim().regadoAte;
export const regouHoje = () => jardim().ultimaRega === hojeISO();
/** Avança a produção de cada vaso pelo tempo em que esteve regado. */
export function atualizarProducao() {
  const j = jardim(), agora = Date.now();
  for (const v of j.vasos) {
    if (!v) continue;
    const meta = PLANTAS[v.id].horas * 3600000;
    const ini = Math.max(v.ultima || agora, 0), fim = Math.min(agora, j.regadoAte);
    if (fim > ini) v.acum = Math.min(meta, (v.acum || 0) + (fim - ini));
    v.ultima = agora;
  }
  salvar();
}
export function regar(acertos, total) {
  const j = jardim(), hoje = hojeISO();
  atualizarProducao();
  const ok = acertos >= Math.ceil(total * 0.6);
  if (!ok) return { ok: false };
  j.sequencia = j.ultimaRega === somaDias(hoje, -1) ? j.sequencia + 1 : 1;
  j.ultimaRega = hoje; j.regas++;
  j.regadoAte = Date.now() + 24 * 3600000;
  let bonusSeq = null;
  if (acertos === total) for (const v of j.vasos) if (v) v.acum = Math.min(PLANTAS[v.id].horas * 3600000, (v.acum || 0) + 2 * 3600000);
  if (j.sequencia % 7 === 0) { const id = sortearPlanta(PACOTES.saco.pesos); bonusSeq = { id, nova: darSemente(id) }; }
  for (const v of j.vasos) if (v) v.ultima = Date.now();
  salvar();
  return { ok: true, perfeito: acertos === total, bonusSeq, sequencia: j.sequencia };
}
export function progresso(v) { const meta = PLANTAS[v.id].horas * 3600000; return { pct: Math.min(1, (v.acum || 0) / meta), falta: Math.max(0, meta - (v.acum || 0)) }; }
export function colher(i) {
  const j = jardim(), v = j.vasos[i], est = E();
  atualizarProducao();
  if (!v || progresso(v).pct < 1) return null;
  const p = PLANTAS[v.id], qtd = producao(v.id, j.plantas[v.id].nivel);
  if (p.produz === "moedas") est.moedas += qtd;
  else if (p.produz === "gemas") est.gemas = (est.gemas || 0) + qtd;
  else ganhar(qtd, 0, `Jardim: ${p.nome}`, "jardim");
  v.acum = 0; v.ultima = Date.now(); j.colheitas = (j.colheitas || 0) + 1;
  salvar();
  return { tipo: p.produz, qtd };
}
export function plantar(i, id) {
  const j = jardim();
  if (j.vasos[i] || !j.plantas[id] || j.vasos.some(v => v?.id === id)) return false;
  j.vasos[i] = { id, acum: 0, ultima: Date.now() }; salvar(); return true;
}
/** Pá: tira a planta do vaso e devolve à estufa (colhe antes, se estiver pronta). */
export function desplantar(i) {
  const j = jardim(), v = j.vasos[i];
  if (!v) return null;
  const colheu = progresso(v).pct >= 1 ? colher(i) : null;
  j.vasos[i] = null; salvar();
  return { colheu };
}
export function comprarVaso() {
  const j = jardim(), est = E(), idx = j.vasos.length - VASOS_INICIAIS, preco = PRECO_VASOS[idx];
  if (!preco) return { erro: "O jardim já está no tamanho máximo." };
  if (preco.gemas) { if ((est.gemas || 0) < preco.gemas) return { erro: "Gemas insuficientes." }; est.gemas -= preco.gemas; }
  else { if (est.moedas < preco.moedas) return { erro: "Moedas insuficientes." }; est.moedas -= preco.moedas; }
  j.vasos.push(null); salvar();
  return { ok: true };
}
export function comprarPacote(tipo) {
  const pk = PACOTES[tipo], est = E();
  if (pk.preco.gemas) { if ((est.gemas || 0) < pk.preco.gemas) return { erro: "Gemas insuficientes." }; est.gemas -= pk.preco.gemas; }
  else { if (est.moedas < pk.preco.moedas) return { erro: "Moedas insuficientes." }; est.moedas -= pk.preco.moedas; }
  const id = sortearPlanta(pk.pesos);
  return { id, nova: darSemente(id) };
}
