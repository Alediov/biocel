// Liga semanal offline: você contra 9 rivais simulados ("fantasmas") que seguem um ritmo
// calculado a partir do SEU XP das últimas semanas. A semana vai de segunda a domingo.
// Os 3 primeiros sobem de divisão e os 3 últimos descem; o pódio ganha gemas e baús.
// Tudo é determinístico (semente = semana + divisão), então o ranking não muda ao reabrir.
import { E, salvar, hojeISO, somaDias } from "./estado.js";
import { ganharGemas, ganharBau } from "./economia.js";
import { CARTAS, arteCarta } from "./colecao.js";
import { modal, confete, escapar, dataBR } from "./ui.js";
import { tocar } from "./sons.js";
import { arteAvatar } from "./telaAvatar.js";
import { revelarEmSequencia } from "./animacoes.js";

export const DIVISOES = [
  { nome: "Bronze", cor: "#C27A3A" }, { nome: "Prata", cor: "#9AA6B8" }, { nome: "Ouro", cor: "#F2B33D" },
  { nome: "Safira", cor: "#2F6BFF" }, { nome: "Rubi", cor: "#E0434A" }, { nome: "Esmeralda", cor: "#12A37A" },
  { nome: "Ametista", cor: "#9B5CF6" }, { nome: "Diamante", cor: "#5FC8EE" },
];
export const PREMIOS = [
  { gemas: 15, bau: "ouro" }, { gemas: 10, bau: "prata" }, { gemas: 5, bau: "prata" },
  { moedas: 40 }, { moedas: 40 }, { moedas: 40 }, { moedas: 40 }, {}, {}, {},
];
const NOMES = ["Fuso Mitótico", "Cromátide Irmã", "Cinetocoro Kid", "Ciclina B", "Coesina Forte", "Centrossomo", "Quiasma Quente", "Sinaptonema", "Prófase Prado", "Anel Contrátil", "Securina", "Separase", "Lâmina Nuclear", "Mitose Max", "Fase S", "Interfase Iza", "Bivalente", "Crossing Over", "Condensina", "Placa Metafásica", "Telófase Tati", "Áster", "Cdk1", "APC/C"];
const _NOMES_DEMO = ["Dentina Veloz", "Gengiva Ninja", "Esmalte de Ferro", "Lady Anestesia", "Bisturi Bandido", "Prof. Tártaro", "Molar Sombrio", "Cúspide Feliz",
  "Ana Tomia", "Zigomático", "Mandíbulo", "Pulpo Rex", "Fio Dental Flash", "Sr. Articaína", "Dona Mepivacaína", "Lido Caína", "Capitão Cárie",
  "Raiz Profunda", "Coroa de Ouro", "Bochecha Brava", "Palato Mole", "Língua Ligeira", "Biópsia Bia", "Neville Jr.", "Malamed Mirim",
  "Tubete Turbo", "Agulha Curta", "Forame Mental", "Dra. Oclusão", "Profilaxia Max", "Siso Rebelde", "Nervo Alveolar", "Gaze Estéril"];

function semente(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); let a = h >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Segunda-feira (AAAA-MM-DD) da semana da data. */
export function semanaDe(iso) { const d = new Date(iso + "T12:00:00"); return somaDias(iso, -((d.getDay() + 6) % 7)); }
const inicioSemana = (sem) => new Date(sem + "T00:00:00").getTime();
const fimSemana = (sem) => inicioSemana(somaDias(sem, 7));
export function xpDaSemana(sem) { const di = E().diario || {}; let s = 0; for (let i = 0; i < 7; i++) s += di[somaDias(sem, i)]?.xp || 0; return s; }

/** Ritmo: média de XP das 4 semanas anteriores (mínimo 300; 500 para quem está começando). */
function calcularRitmo(sem) {
  const xs = [1, 2, 3, 4].map(k => xpDaSemana(somaDias(sem, -7 * k)));
  const com = xs.filter(x => x > 0);
  if (!com.length) return 500;
  return Math.max(300, Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(2, com.length)));
}

export function liga() {
  const est = E();
  if (!est.liga) {
    const sem = semanaDe(hojeISO());
    est.liga = { divisao: 0, semana: sem, ritmo: calcularRitmo(sem), historico: [], pendente: null, melhor: 0, vitorias: 0, podios: 0 };
    salvar();
  }
  return est.liga;
}

/** Os 9 rivais da semana, com o XP de cada um num instante. */
function rivais(sem, div, ritmo) {
  const r = semente(`${sem}|${div}`);
  const nomes = [...NOMES].sort(() => r() - 0.5).slice(0, 9);
  const cartas = Object.keys(CARTAS);
  const fatores = [0.25, 0.45, 0.6, 0.75, 0.9, 1.0, 1.15, 1.35, 1.6];
  return nomes.map((nome, i) => {
    const alvo = Math.round(ritmo * fatores[i] * (0.85 + 0.06 * div) * (0.9 + r() * 0.2));
    // peso de cada dia (alguns dias de folga) e horários de estudo
    const pesos = Array.from({ length: 7 }, () => (r() < 0.15 ? 0 : 0.3 + r() * 1.3));
    const soma = pesos.reduce((a, b) => a + b, 0) || 1;
    const sessoes = [7, 12.5, 19, 21.5].filter(() => r() < 0.6);
    if (!sessoes.length) sessoes.push(19);
    return { nome, carta: cartas[Math.floor(r() * cartas.length)], alvo, pesos: pesos.map(p => p / soma), sessoes: sessoes.map(h => h + (r() - 0.5)) };
  });
}
function xpRival(rv, sem, agora) {
  const ini = inicioSemana(sem);
  if (agora >= fimSemana(sem)) return rv.alvo;
  let frac = 0;
  for (let d = 0; d < 7; d++) {
    const dia0 = ini + d * 86400000;
    if (agora >= dia0 + 86400000) { frac += rv.pesos[d]; continue; }
    if (agora < dia0) break;
    const hora = (agora - dia0) / 3600000;
    const feitas = rv.sessoes.reduce((a, h) => a + Math.min(1, Math.max(0, (hora - h) / 0.5)), 0);
    frac += rv.pesos[d] * feitas / rv.sessoes.length;
  }
  return Math.round(rv.alvo * frac);
}

/** Classificação: [{ nome, xp, voce, carta }] ordenada. */
export function classificacao(sem = liga().semana, div = liga().divisao, ritmo = liga().ritmo, agora = Date.now()) {
  const T = globalThis.__turmaLiga, cartas = Object.keys(CARTAS);
  const reais = T && T.semana === sem ? T.lista.filter(x => !x.eu).map(x => ({ nome: x.apelido, carta: cartas[[...x.apelido].reduce((a, c) => a + c.charCodeAt(0), 0) % cartas.length], xp: x.xp_semana || 0, voce: false, real: true })) : [];
  const lista = [...reais, ...rivais(sem, div, ritmo).slice(0, Math.max(0, 9 - reais.length)).map(rv => ({ nome: rv.nome, carta: rv.carta, xp: xpRival(rv, sem, agora), voce: false, bot: true }))];
  lista.push({ nome: T?.lista?.find(x => x.eu)?.apelido || E().avatar?.nome || "Você", xp: xpDaSemana(sem), voce: true });
  return lista.sort((a, b) => b.xp - a.xp || (a.voce ? -1 : 1));
}
export const minhaPosicao = (cl = classificacao()) => cl.findIndex(x => x.voce) + 1;

/** Fecha a semana anterior (se virou a semana) e prepara a nova. */
export function atualizarLiga() {
  const L = liga(), sem = semanaDe(hojeISO());
  if (L.semana === sem) return null;
  const cl = classificacao(L.semana, L.divisao, L.ritmo, fimSemana(L.semana));
  const pos = minhaPosicao(cl), xp = cl[pos - 1].xp;
  const de = L.divisao;
  let resultado = "fica";
  if (pos <= 3 && de < DIVISOES.length - 1) resultado = "sobe";
  else if (pos > cl.length - 3 && de > 0) resultado = "desce";
  if (xp === 0 && de > 0) resultado = "desce";
  resultado = "fica";
  const premio = xp > 0 ? (PREMIOS[pos - 1] || {}) : {};
  if (premio.gemas) ganharGemas(premio.gemas);
  if (premio.moedas) E().moedas += premio.moedas;
  const bau = premio.bau ? ganharBau(premio.bau, "liga") : null;
  L.divisao = de + (resultado === "sobe" ? 1 : resultado === "desce" ? -1 : 0);
  L.melhor = Math.max(L.melhor, L.divisao);
  if (pos === 1 && xp > 0) L.vitorias++;
  if (pos <= 3 && xp > 0) L.podios++;
  L.historico.unshift({ semana: L.semana, divisao: de, posicao: pos, xp, resultado });
  L.historico = L.historico.slice(0, 12);
  L.pendente = { semana: L.semana, divisao: de, posicao: pos, xp, resultado, premio, bauCheio: bau?.cheio ? bau.moedas : 0 };
  L.semana = sem; L.ritmo = calcularRitmo(sem);
  salvar();
  return L.pendente;
}

export function escudo(div, tam = 40) {
  const { cor } = DIVISOES[div];
  return `<svg class="escudo-liga" width="${tam}" height="${tam}" viewBox="0 0 48 52" aria-hidden="true">
    <path d="M24 3 L43 10 V26 C43 38 34 46 24 49 C14 46 5 38 5 26 V10 Z" fill="${cor}" stroke="#1B2340" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M24 9 L37 14 V26 C37 34 31 40 24 43" fill="none" stroke="#fff" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>
    <path d="M24 16 L30 23 L24 34 L18 23 Z" fill="#fff" opacity=".92" stroke="#1B2340" stroke-width="1.8" stroke-linejoin="round"/>
    ${Array.from({ length: Math.min(3, div % 3 + (div >= 6 ? 1 : 0)) }, (_, i) => `<circle cx="${18 + i * 6}" cy="40" r="1.8" fill="#fff"/>`).join("")}
  </svg>`;
}
const fimEm = () => {
  const ms = fimSemana(liga().semana) - Date.now(), h = Math.max(0, Math.floor(ms / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h ${Math.max(0, Math.floor(ms / 60000) % 60)} min`;
};
const premioTxt = (p) => [p.gemas && `${p.gemas} gemas`, p.bau && `baú de ${p.bau}`, p.moedas && `${p.moedas} moedas`].filter(Boolean).join(" + ") || "sem prêmio";

/** Faixa compacta para a trilha. */
export function faixaLiga() {
  atualizarLiga();
  const L = liga(), cl = classificacao(), pos = minhaPosicao(cl);
  const b = document.createElement("button"); b.className = "faixa-liga";
  b.style.setProperty("--cor-div", DIVISOES[L.divisao].cor);
  const zona = pos <= 3 ? "sobe" : false ? "desce" : "";
  b.innerHTML = `${escudo(L.divisao, 34)}<div><b>Liga da Turma</b><small>${pos}º lugar · ${cl[pos - 1].xp} XP · termina em ${fimEm()}</small></div><span class="zona ${zona}">${zona === "sobe" ? "▲" : zona === "desce" ? "▼" : "›"}</span>`;
  b.onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "liga" }));
  return b;
}

/** Tela da liga. */
export function telaLiga(voltar) {
  atualizarLiga();
  const t = document.getElementById("tela"), L = liga(), D = DIVISOES[L.divisao], cl = classificacao(), pos = minhaPosicao(cl);
  t.innerHTML = "";
  if (voltar) { const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Trilha"; v.onclick = voltar; t.append(v); }
  const linhas = cl.map((x, i) => {
    const p = i + 1, zona = p <= 3 ? "sobe" : false ? "desce" : "";
    const sep = p === 4 ? `<li class="sep-liga sobe">▲ pódio da semana</li>` : false ? "" : "";
    const av = x.voce ? `<span class="av-liga voce">${arteAvatar()}</span>` : `<span class="av-liga">${arteCarta(x.carta, { semFundo: true })}</span>`;
    return `${sep}<li class="${x.voce ? "eu" : ""} ${zona}"><span class="pos ${p <= 3 ? `med m${p}` : ""}">${p}</span>${av}<span class="nome">${escapar(x.voce && x.nome !== "Você" ? `${x.nome} (você)` : x.nome)}${x.bot ? ' <small class="sub">· simulado</small>' : ""}</span><b>${x.xp} XP</b></li>`;
  }).join("");
  const proximo = pos > 1 ? cl[pos - 2].xp - cl[pos - 1].xp + 1 : 0;
  t.insertAdjacentHTML("beforeend", `
    <div class="liga-topo" style="--cor-div:${D.cor}">
      ${escudo(L.divisao, 64)}
      <div><h1 class="titulo-tela">Liga da Turma</h1><p class="sub">Termina em <b>${fimEm()}</b>. O pódio da semana ganha gemas e baús.</p></div>
    </div>
    <div class="cartao dica-liga">${pos === 1 ? "Você está em 1º! Continue estudando para segurar a liderança." : `Faltam <b>${proximo} XP</b> para passar ${escapar(cl[pos - 2].nome)}.`}</div>
    <ol class="ranking-liga">${linhas}</ol>
    <div class="secao"><h2>Prêmios da semana</h2><div class="cartao premios-liga">
      <div><span><i class="med m1">1</i> 1º lugar</span><b>${premioTxt(PREMIOS[0])}</b></div><div><span><i class="med m2">2</i> 2º lugar</span><b>${premioTxt(PREMIOS[1])}</b></div>
      <div><span><i class="med m3">3</i> 3º lugar</span><b>${premioTxt(PREMIOS[2])}</b></div><div><span><i class="med m0">4</i> 4º a 7º</span><b>${premioTxt(PREMIOS[3])}</b></div></div></div>
    <div hidden><h2>Divisões</h2><div class="cartao divisoes-liga">${DIVISOES.map((d, i) => `<div class="${i === L.divisao ? "atual" : i > L.melhor ? "bloq" : ""}">${escudo(i, 36)}<small>${d.nome}</small></div>`).join("")}</div></div>
    ${L.historico.length ? `<div class="secao"><h2>Semanas anteriores</h2><div class="cartao"><ul class="hist-liga">${L.historico.slice(0, 6).map(h => `<li><span>${dataBR(h.semana)}</span><b>${h.posicao}º · ${h.xp} XP ${h.resultado === "sobe" ? "▲" : h.resultado === "desce" ? "▼" : ""}</b></li>`).join("")}</ul></div></div>` : ""}
    <p class="sub" style="text-align:center;margin:16px 0 24px" data-fim>${cl.some(x => x.real) ? `Na liga estão os colegas da turma.` : `Os colegas aparecem aqui quando o app estiver ligado à turma.`}${cl.some(x => x.bot) ? ` Enquanto faltarem colegas para 10, completam a liga rivais simulados (marcados).` : ""}</p>`);
  revelarEmSequencia(t.querySelectorAll(".ranking-liga li"), { passo: 45 });
}

/** Mostra o resultado da semana que fechou (uma vez). */
export async function mostrarResultadoLiga() {
  atualizarLiga();
  const L = liga(), r = L.pendente;
  if (!r || document.querySelector("#modal:not([hidden])")) return;
  L.pendente = null; salvar();
  const nova = DIVISOES[L.divisao];
  const frase = r.resultado === "sobe" ? `Você subiu para a Liga ${nova.nome}!` : r.resultado === "desce" ? `Você desceu para a Liga ${nova.nome}. Dá para voltar já nesta semana.` : `Começou uma semana nova na Liga da Turma.`;
  const premio = r.premio && Object.keys(r.premio).length ? ` Prêmio: ${premioTxt(r.premio)}${r.bauCheio ? ` (slots cheios: o baú virou ${r.bauCheio} moedas)` : ""}.` : "";
  if (r.posicao <= 3) { confete(); tocar("fim"); }
  await modal({
    titulo: r.posicao <= 3 ? `${r.posicao}º lugar na semana!` : `Semana encerrada: ${r.posicao}º lugar`,
    html: `<div style="text-align:center">${escudo(L.divisao, 72)}</div>`,
    texto: `Liga da Turma, com ${r.xp} XP. ${frase}${premio}`,
    botoes: [{ texto: "Bora!", valor: true }],
  });
}
