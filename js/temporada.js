// Conquistas de Temporada: cada mês é uma temporada com tema, 8 metas e uma trilha de prêmios.
// As metas que dependem do histórico (lições, XP, dias) são contadas pelo diário; as outras
// (jogos, baús, regas, Mira da Agulha) pela diferença de contadores desde o início do mês.
import { E, salvar, hojeISO, ganhar, metaDoDia } from "./estado.js";
import { darPocao, ganharGemas, colocarBauPronto } from "./economia.js";
import { tocar } from "./sons.js";
import { toast, confete, escapar } from "./ui.js";
import { icone } from "./icones.js";
import { DEMO } from "./edicao.js";

const TEMAS = [
  { nome: "do Recomeço", ico: "🎆", cor: "#5B54D6" }, { nome: "do Carnaval", ico: "🎭", cor: "#E2557A" }, { nome: "da Volta às Aulas", ico: "🎒", cor: "#2F6BFF" },
  { nome: "do Outono", ico: "🍂", cor: "#C2502A" }, { nome: "das Flores", ico: "🌸", cor: "#D9467A" }, { nome: "Junina", ico: "🌽", cor: "#E0A512" },
  { nome: "das Férias", ico: "🏖️", cor: "#12A37A" }, { nome: "do Inverno", ico: "❄️", cor: "#3E9EC4" }, { nome: "da Primavera", ico: "🌻", cor: "#4CAF6E" },
  { nome: "do Sorriso", ico: "🦷", cor: "#2F9BFF" }, { nome: "da Prova", ico: "📚", cor: "#8B5CF6" }, { nome: "das Festas", ico: "🎄", cor: "#1E9E5E" },
];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// metas possíveis: alvo para um mês cheio e pontos
const METAS = {
  dias: { nome: "Estude em {n} dias diferentes", ico: "🔥", alvo: 22, pts: 150 },
  licoes: { nome: "Conclua {n} lições", ico: "📖", alvo: 110, pts: 150 },
  perfeitas: { nome: "Faça {n} lições perfeitas", ico: "⭐", alvo: 25, pts: 120 },
  xp: { nome: "Ganhe {n} XP", ico: "⚡", alvo: 3500, pts: 120 },
  meta: { nome: "Bata a meta do dia {n} vezes", ico: "🎯", alvo: 12, pts: 120 },
  ofensiva: { nome: "Chegue a {n} dias de ofensiva", ico: "📅", alvo: 21, pts: 100, absoluto: true },
  jogos: { nome: "Jogue {n} partidas de minijogos", ico: "🎮", alvo: 15, pts: 80 },
  mira: { nome: "Jogue {n} partidas da Mira da Agulha", ico: "💉", alvo: 6, pts: 100 },
  baus: { nome: "Abra {n} baús", ico: "🧰", alvo: 8, pts: 80 },
  regas: { nome: "Regue o jardim {n} vezes", ico: "🪴", alvo: 18, pts: 80 },
  presencas: { nome: "Confirme {n} presenças na agenda", ico: "🏫", alvo: 16, pts: 80 },
  revisao: { nome: "Faça {n} treinos de revisão", ico: "🔁", alvo: 10, pts: 100 },
};
// BioCel: uma temporada só, até a prova; metas para uma semana e para as 36 lições das duas trilhas
const FIM_BIO = "2026-11-16";
const METAS_BIO = ["licoes", "dias", "perfeitas", "xp", "revisao", "jogos", "ofensiva", "meta"];
Object.assign(METAS, {
  licoes: { nome: "Conclua {n} lições das trilhas", ico: "📖", alvo: 30, pts: 150 },
  dias: { nome: "Estude em {n} dias diferentes", ico: "🔥", alvo: 5, pts: 150 },
  perfeitas: { nome: "Faça {n} lições perfeitas", ico: "⭐", alvo: 10, pts: 120 },
  xp: { nome: "Ganhe {n} XP", ico: "⚡", alvo: 800, pts: 120 },
  revisao: { nome: "Faça {n} treinos de revisão", ico: "🔁", alvo: 5, pts: 100 },
  jogos: { nome: "Jogue {n} partidas dos minijogos", ico: "🎮", alvo: 6, pts: 80 },
  ofensiva: { nome: "Chegue a {n} dias de ofensiva", ico: "📅", alvo: 5, pts: 100, absoluto: true },
  meta: { nome: "Bata a meta do dia {n} vezes", ico: "🎯", alvo: 4, pts: 120 },
});
// 8 metas por mês: as 4 primeiras sempre; as outras variam (novembro puxa a Mira, por causa da prova)
const FIXAS = ["dias", "licoes", "xp", "perfeitas"];
const VARIAVEIS = { 10: ["mira", "revisao", "meta", "ofensiva"], 11: ["meta", "jogos", "ofensiva", "baus"] };
const ROTACAO = ["meta", "ofensiva", "jogos", "mira", "baus", "regas", "presencas", "revisao"];

/** Trilha de prêmios: pontos necessários e o prêmio. */
export const TRILHA = [
  { pts: 100, ico: "🪙", nome: "150 moedas", dar: () => ganhar(0, 150, "Temporada: prêmio") },
  { pts: 250, ico: "⚗️", nome: "Poção ×2 (30 min)", dar: () => darPocao("x2_30") },
  { pts: 400, ico: "💎", nome: "10 gemas", dar: () => ganharGemas(10) },
  { pts: 550, ico: "🎁", nome: "Baú da Escolha", bau: "escolha" },
  { pts: 700, ico: "💎", nome: "20 gemas e Poção ×3", dar: () => { ganharGemas(20); darPocao("x3_20"); } },
  { pts: 850, ico: "🏆", nome: "Baú da Temporada", bau: "temporada" },
];
const MEDALHAS = [[850, "ouro", "Ouro"], [550, "prata", "Prata"], [250, "bronze", "Bronze"]];

const mesDe = (iso) => iso.slice(0, 7);
const diasNoMes = (m) => { const [a, mm] = m.split("-").map(Number); return new Date(a, mm, 0).getDate(); };
function contadores() {
  const e = E();
  return { jogos: e.jogos?.partidas || 0, mira: e.mira?.partidas || 0, baus: e.baus?.abertos || 0, regas: e.jardim?.regas || 0 };
}
function temp() {
  const e = E(), mes = mesDe(hojeISO());
  e.temporadas ??= { historico: {} };
  const T = e.temporadas;
  if (!T.atual || T.atual.mes !== mes) {
    if (T.atual) encerrar(T.atual);
    const primeira = !T.atual && !Object.keys(T.historico).length;
    const dia = Number(hojeISO().slice(8, 10)), total = diasNoMes(mes);
    // na primeira temporada (começando no meio do mês), as metas encolhem na proporção dos dias que faltam
    const fator = primeira ? Math.max(0.35, (total - dia + 1) / total) : 1;
    const nMes = Number(mes.slice(5, 7));
    const extras = VARIAVEIS[nMes] || ROTACAO.filter((_, i) => (i + nMes) % 2 === 0).slice(0, 4);
    T.atual = { mes, fator, base: contadores(), metas: [...FIXAS, ...extras], resgatados: [], maxOfensiva: e.ofensiva.atual, concluidas: [] };
    salvar();
  }
  if (T.atual.bio !== 1) { Object.assign(T.atual, { bio: 1, fator: 1, metas: [...METAS_BIO] }); salvar(); }
  return T.atual;
}
function encerrar(A) {
  const e = E(), T = e.temporadas, pts = pontos(A);
  // prêmios alcançados e não resgatados são entregues sozinhos
  const pendentes = TRILHA.filter((p, i) => pts >= p.pts && !A.resgatados.includes(i));
  for (const p of pendentes) { if (p.bau) e.moedas += 200; else p.dar(); }
  const med = MEDALHAS.find(([m]) => pts >= m);
  T.historico[A.mes] = { pontos: pts, medalha: med ? med[1] : null };
  T.aviso = { mes: A.mes, pontos: pts, medalha: med ? med[2] : null, entregues: pendentes.length };
}

// ---------- progresso ----------
function noMes(A) {
  const e = E(), dias = Object.entries(e.diario).filter(([d]) => mesDe(d) === A.mes);
  return {
    dias: dias.filter(([, d]) => d.licoes.length > 0).length,
    licoes: dias.reduce((s, [, d]) => s + d.licoes.filter(id => !id.startsWith("treino")).length, 0),
    revisao: dias.reduce((s, [, d]) => s + d.licoes.filter(id => id.startsWith("treino")).length, 0),
    xp: dias.reduce((s, [, d]) => s + (d.xp || 0), 0),
    meta: dias.filter(([dd, d]) => d.licoes.length >= metaDoDia(dd)).length,
    perfeitas: Object.values(e.concluidas).filter(c => c.perfeita && c.quando && mesDe(c.quando.slice(0, 10)) === A.mes).length,
    presencas: Object.entries(e.agenda?.presencas || {}).filter(([k, v]) => v === "presente" && mesDe(k.split("|")[1] || "") === A.mes).length,
  };
}
export function progressoMetas(A = temp()) {
  const e = E(), m = noMes(A), c = contadores();
  A.maxOfensiva = Math.max(A.maxOfensiva || 0, e.ofensiva.atual);
  const valor = { ...m, ofensiva: A.maxOfensiva, jogos: c.jogos - A.base.jogos, mira: c.mira - A.base.mira, baus: c.baus - A.base.baus, regas: c.regas - A.base.regas };
  return A.metas.map(id => {
    const M = METAS[id], alvo = Math.max(1, Math.round(M.alvo * (M.absoluto ? Math.min(1, A.fator + 0.2) : A.fator)));
    const v = Math.max(0, valor[id] || 0);
    return { id, ...M, alvo, valor: v, feita: v >= alvo, nomeTxt: M.nome.replace("{n}", alvo.toLocaleString("pt-BR")) };
  });
}
function pontos(A) { return progressoMetas(A).filter(m => m.feita).reduce((s, m) => s + m.pts, 0); }
export function pontosAtuais() { return pontos(temp()); }

/** Chamado depois de mudanças: avisa metas recém-cumpridas. */
export function verificarTemporada() {
  const A = temp(), metas = progressoMetas();
  A.ultimosPontos = metas.filter(m => m.feita).reduce((s, m) => s + m.pts, 0);
  const novas = metas.filter(m => m.feita && !A.concluidas.includes(m.id));
  if (!novas.length) { salvar(); return; }
  for (const m of novas) A.concluidas.push(m.id);
  salvar();
  tocar("ofensiva"); confete(1400);
  toast(`Meta da temporada: ${novas.map(m => m.nomeTxt).join(", ")} (+${novas.reduce((s, m) => s + m.pts, 0)} pontos)`, 4500);
}
/** Mensagem de temporada encerrada (uma vez). */
export function avisoTemporada() {
  temp();
  const T = E().temporadas, a = T.aviso;
  if (!a) return null;
  T.aviso = null; salvar();
  const [ano, m] = a.mes.split("-").map(Number);
  return { titulo: `Temporada ${TEMAS[m - 1].nome} encerrada`, texto: `Você fez ${a.pontos} pontos em ${MESES[m - 1]} de ${ano}.${a.medalha ? ` Medalha de ${a.medalha}!` : ""}${a.entregues ? ` ${a.entregues} prêmio(s) não resgatado(s) foram entregues agora.` : ""} A nova temporada já começou.` };
}

function resgatar(i) {
  const A = temp(), p = TRILHA[i];
  if (A.resgatados.includes(i) || pontosAtuais() < p.pts) return;
  if (p.bau) {
    const r = colocarBauPronto(p.bau, `temporada ${A.mes}`);
    if (!r) return toast("Libere um slot de baú na trilha para pegar este prêmio.");
  } else p.dar();
  A.resgatados.push(i); salvar();
  tocar("bau"); confete(1200);
  toast(p.bau ? `${p.nome} pronto para abrir nos slots da trilha!` : `Resgatado: ${p.nome}!`);
}

// ---------- telas ----------
const fimEm = () => { const h = new Date(), f = new Date(FIM_BIO + "T23:59:59"); if (h > f) return "terminou na prova"; const d = Math.ceil((f - h) / 86400000); return d <= 1 ? "a prova é hoje" : `faltam ${d} dias`; };
export function faixaTemporada() {
  const A = temp(), [, m] = A.mes.split("-").map(Number), tema = TEMAS[m - 1], metas = progressoMetas(), pts = metas.filter(x => x.feita).reduce((s, x) => s + x.pts, 0);
  const prox = TRILHA.find(p => p.pts > pts), pend = TRILHA.filter((p, i) => pts >= p.pts && !A.resgatados.includes(i)).length;
  const b = document.createElement("button"); b.className = "faixa-liga faixa-temporada"; b.style.setProperty("--cor-div", tema.cor);
  b.innerHTML = `<span class="temp-ico">${icone(tema.ico, "ico3d")}</span><div><b>Temporada ${tema.nome}</b><small>${metas.filter(x => x.feita).length}/${metas.length} metas · ${pts} pts · ${fimEm()}</small><i class="temp-barra"><i style="width:${Math.min(100, pts / TRILHA[TRILHA.length - 1].pts * 100)}%"></i></i></div><span class="zona ${pend ? "sobe" : ""}">${pend ? `${pend} 🎁` : prox ? "›" : "✓"}</span>`;
  b.onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "temporada" }));
  return b;
}
export function telaTemporada(voltar) {
  const t = document.getElementById("tela"), A = temp(), [ano, m] = A.mes.split("-").map(Number), tema = TEMAS[m - 1];
  const metas = progressoMetas(), pts = metas.filter(x => x.feita).reduce((s, x) => s + x.pts, 0), max = TRILHA[TRILHA.length - 1].pts;
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Trilha"; v.onclick = voltar; t.append(v);
  const cab = document.createElement("div"); cab.className = "temp-cab"; cab.style.setProperty("--cor-div", tema.cor);
  cab.innerHTML = `<div class="temp-cab-ico">${icone(tema.ico, "ico3d")}</div><div><small>Até a prova de 16/11 · ${fimEm()}</small><h1>Temporada ${tema.nome}</h1><p><b>${pts}</b> de ${max} pontos</p></div>`;
  t.append(cab);
  if (A.fator < 1) t.insertAdjacentHTML("beforeend", `<p class="sub">Primeira temporada: as metas foram ajustadas para os dias que faltam no mês.</p>`);
  // trilha de prêmios
  const tr = document.createElement("div"); tr.className = "temp-trilha"; tr.style.setProperty("--cor-div", tema.cor);
  tr.innerHTML = `<div class="temp-linha"><i style="width:${Math.min(100, pts / max * 100)}%"></i></div>`;
  TRILHA.forEach((p, i) => {
    const ok = pts >= p.pts, pego = A.resgatados.includes(i);
    const n = document.createElement("button"); n.className = `temp-premio ${ok ? "alcancado" : ""} ${pego ? "pego" : ""}`; n.style.left = `${p.pts / max * 100}%`;
    n.innerHTML = `<span class="tp-ico">${pego ? "✓" : icone(p.ico, "ico3d")}</span><small>${p.pts}</small>`;
    n.onclick = () => { if (ok && !pego) { resgatar(i); telaTemporada(voltar); window.dispatchEvent(new Event("oq-topo")); } else toast(`${p.nome} · ${p.pts} pontos${pego ? " (resgatado)" : ok ? "" : ` (faltam ${p.pts - pts})`}`); };
    tr.append(n);
  });
  t.append(tr);
  const pend = TRILHA.map((p, i) => ({ p, i })).filter(({ p, i }) => pts >= p.pts && !A.resgatados.includes(i));
  if (pend.length) {
    const b = document.createElement("button"); b.className = "botao"; b.textContent = `Resgatar ${pend.length === 1 ? pend[0].p.nome : `${pend.length} prêmios`}`;
    b.onclick = () => { for (const { i } of pend) resgatar(i); telaTemporada(voltar); window.dispatchEvent(new Event("oq-topo")); };
    t.append(b);
  }
  // metas
  const sec = document.createElement("div"); sec.className = "secao";
  sec.innerHTML = `<h2>Metas da semana</h2>`;
  const lista = document.createElement("div"); lista.className = "temp-metas";
  for (const x of metas) {
    const pct = Math.min(100, x.valor / x.alvo * 100);
    lista.insertAdjacentHTML("beforeend", `<div class="temp-meta ${x.feita ? "feita" : ""}"><span class="tm-ico">${icone(x.ico, "ico3d")}</span><div><b>${escapar(x.nomeTxt)}</b><div class="tm-barra"><i style="width:${pct}%"></i></div><small>${Math.min(x.valor, x.alvo).toLocaleString("pt-BR")} / ${x.alvo.toLocaleString("pt-BR")}</small></div><span class="tm-pts">${x.feita ? "✓" : ""} ${x.pts}</span></div>`);
  }
  sec.append(lista); t.append(sec);
  trilhaSonora(t, A.mes);
  // prêmios e medalhas anteriores
  const hist = Object.entries(E().temporadas.historico).sort((a, b) => b[0].localeCompare(a[0]));
  const sh = document.createElement("div"); sh.className = "secao";
  sh.innerHTML = `<h2>Medalhas</h2><p class="sub">Bronze com 250 pontos, prata com 550 e ouro com 850.</p>${hist.length ? `<div class="temp-medalhas">${hist.map(([mes, h]) => { const [a2, m2] = mes.split("-").map(Number); return `<div class="tmed ${h.medalha || "nenhuma"}">${medalhaSVG(h.medalha, TEMAS[m2 - 1].cor)}<small>${MESES[m2 - 1].slice(0, 3)}/${String(a2).slice(2)}</small><b>${h.pontos}</b></div>`; }).join("")}</div>` : `<p class="sub">A primeira medalha sai no fim deste mês.</p>`}`;
  t.append(sh);
}
// a retrospectiva das Músicas do mesmo mês (pedido do Alediov, 24/10/2026): música, artista e horas ouvidas
async function trilhaSonora(t, mes) {
  if (DEMO) return;
  const sec = document.createElement("div"); sec.className = "secao"; t.append(sec);
  try {
    const RT = await import("./musicas/retrospectiva.js"), r = await RT.resumoDoMes(mes);
    const logo = (await import("./areas.js")).LOGO_MUSICAS.replace(/\b(mug|mub|muc)\b/g, "$1-temp"); // ids próprios (o degradê não some)
    if (!r || !sec.isConnected) { sec.remove(); return; }
    const top = r.musicas[0]?.faixa;
    sec.innerHTML = `<h2>Trilha sonora da temporada</h2><button class="temp-trilha-sonora"><span class="tts-logo">${logo}</span><span><b>${escapar(top ? top.titulo : "Músicas")}</b><small>${escapar(top ? top.artista : "")}${r.artistas[0] ? ` · artista do mês: ${escapar(r.artistas[0].nome)}` : ""}</small><small>${RT.horasTexto(r.tempo)} ouvindo · ${r.reproducoes} reproduções</small></span><span class="tts-ir">›</span></button>`;
    sec.querySelector("button").onclick = async () => (await import("./areas.js")).abrirRetrospectivaMusicas(mes);
  } catch { sec.remove(); }
}
function medalhaSVG(tipo, cor) {
  const c = { ouro: ["#F2B33D", "#B07508"], prata: ["#C9D1DD", "#7F8AA3"], bronze: ["#D08A4E", "#8A5A3B"] }[tipo] || ["#DDE2EE", "#9AA3C7"];
  return `<svg viewBox="0 0 40 48" class="medalha"><path d="M12 2 L20 16 L28 2 Z" fill="${cor}"/><circle cx="20" cy="29" r="15" fill="${c[0]}" stroke="${c[1]}" stroke-width="3"/><path d="M20 21 l2.4 5 5.4.6 -4 3.7 1.1 5.3 -4.9-2.7 -4.9 2.7 1.1-5.3 -4-3.7 5.4-.6z" fill="${c[1]}"/></svg>`;
}
