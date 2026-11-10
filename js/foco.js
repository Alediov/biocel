// Modo foco (pedido do Alediov, 25/10/2026): um cronômetro de foco (25, 45 ou 60 min) que fica numa pílula no alto,
// por cima de qualquer área, e esconde o que distrai nos Estudos (moedas, gemas, faixas da liga e da temporada,
// celebração de títulos). No fim: aviso, notificação (se a tela estiver apagada) e 1 XP a cada 2 minutos (até 60 por
// dia). Os minutos de cada dia ficam em E().foco.dias (sincroniza); o cronômetro em andamento, só neste aparelho
// (config.focoAtivo, nos LOCAIS da sincronia).
import { E, salvar, hojeISO, ganhar } from "./estado.js";
import { modal, toast, escapar } from "./ui.js";
import { tocar } from "./sons.js";
import { reagendar } from "./notificacoes.js";

const TETO_XP = 60; // aviso do fim: id 960 em notificacoes.js
const OPCOES = [25, 45, 60];
const ROTULOS = ["Lições", "Leitura", "Caderno", "Revisão", "Outro"];
let pilula = null, timer = null;

const F = () => { const e = E(); e.foco ??= {}; e.foco.dias ??= {}; return e.foco; };
const ativo = () => E().config.focoAtivo || null;
export const emFoco = () => !!ativo();
export const minutosHoje = () => F().dias[hojeISO()] || 0;

const agendarAviso = () => reagendar();
const cancelarAviso = () => reagendar();

/** Escolher a duração e o que vai fazer, e começar. */
export async function abrirFoco() {
  if (ativo()) { desenharPilula(); return; }
  const html = `<div class="fc-escolha"><p class="sub">O cronômetro fica num canto da tela, em qualquer área, e as distrações dos Estudos somem até o fim.</p>
    <div class="fc-chips" data-g="min">${OPCOES.map((m, i) => `<button type="button" data-v="${m}" class="${i === 0 ? "sel" : ""}">${m} min</button>`).join("")}</div>
    <div class="fc-chips" data-g="rot">${ROTULOS.map((r, i) => `<button type="button" data-v="${r}" class="${i === 0 ? "sel" : ""}">${r}</button>`).join("")}</div></div>`;
  const p = modal({ titulo: "Modo foco", html, botoes: [{ texto: "Começar", valor: true }, { texto: "Agora não", classe: "secundario", valor: false }] });
  const esc = { min: 25, rot: "Lições" };
  document.querySelectorAll("#modal .fc-chips").forEach(g => g.querySelectorAll("button").forEach(b => (b.onclick = () => {
    g.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
    esc[g.dataset.g] = g.dataset.g === "min" ? +b.dataset.v : b.dataset.v;
  })));
  if (!(await p)) return;
  const agora = Date.now();
  E().config.focoAtivo = { inicio: agora, fim: agora + esc.min * 60000, min: esc.min, rotulo: esc.rot, pausado: null };
  salvar(); agendarAviso(agora + esc.min * 60000);
  tocar("toque");
  ligar();
}

/** Ao abrir o app: retoma o cronômetro (ou fecha o que acabou enquanto o app estava fechado). */
export function iniciarFoco() { if (ativo()) ligar(); }

function ligar() {
  document.body.classList.add("modo-foco");
  desenharPilula();
  clearInterval(timer); timer = setInterval(tique, 1000);
  tique();
}
function restante() { const a = ativo(); return a ? Math.max(0, a.fim - (a.pausado ?? Date.now())) : 0; }
function tique() {
  const a = ativo(); if (!a) return desligar();
  const r = restante();
  if (r <= 0 && !a.pausado) return concluir(true);
  if (!pilula) desenharPilula();
  const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000);
  pilula.querySelector(".fc-t").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  pilula.style.setProperty("--p", 1 - r / (a.min * 60000));
  pilula.classList.toggle("pausado", !!a.pausado);
}
function desenharPilula() {
  if (pilula) return;
  const a = ativo(); if (!a) return;
  pilula = document.createElement("div"); pilula.className = "foco-pilula";
  pilula.innerHTML = `<span class="fc-anel"></span><span class="fc-tx"><b class="fc-t">--:--</b><small>Foco · ${escapar(a.rotulo)}</small></span>
    <button data-a="pausa" aria-label="Pausar ou continuar"><svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg></button>
    <button data-a="fim" aria-label="Terminar"><svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z" fill="currentColor"/></svg></button>`;
  pilula.addEventListener("click", async (e) => {
    const ac = e.target.closest("button")?.dataset.a, at = ativo(); if (!ac || !at) return;
    if (ac === "pausa") {
      if (at.pausado) { const dur = Date.now() - at.pausado; at.inicio += dur; at.fim += dur; at.pausado = null; agendarAviso(at.fim); }
      else { at.pausado = Date.now(); cancelarAviso(); }
      salvar(); tique();
    }
    if (ac === "fim") {
      const ok = await modal({ titulo: "Terminar o foco agora?", texto: "Os minutos até aqui contam.", botoes: [{ texto: "Terminar", valor: true }, { texto: "Continuar", classe: "secundario", valor: false }] });
      if (ok) concluir(false);
    }
  });
  document.body.append(pilula);
}
function desligar() {
  clearInterval(timer); timer = null;
  pilula?.remove(); pilula = null;
  document.body.classList.remove("modo-foco");
}

async function concluir(inteiro) {
  const a = ativo(); if (!a) return desligar();
  const fimReal = a.pausado ?? Math.min(Date.now(), a.fim);
  const minutos = Math.max(0, Math.round((fimReal - a.inicio) / 60000));
  delete E().config.focoAtivo;
  const F_ = F(), hoje = hojeISO();
  const antes = F_.dias[hoje] || 0; F_.dias[hoje] = antes + minutos;
  F_.sessoes = (F_.sessoes || 0) + 1;
  const xpJa = Math.floor(antes / 2), xp = Math.max(0, Math.min(Math.floor((antes + minutos) / 2), TETO_XP) - Math.min(xpJa, TETO_XP));
  if (xp) ganhar(xp, 0, "Modo foco", "foco");
  salvar(); cancelarAviso(); desligar();
  if (minutos < 1) { toast("Foco encerrado."); return; }
  tocar(inteiro ? "fim" : "toque");
  await modal({ titulo: inteiro ? "Foco concluído!" : "Foco encerrado", texto: `${minutos} min de ${a.rotulo.toLowerCase()}${xp ? ` · +${xp} XP` : ""}. Hoje: ${F_.dias[hoje]} min em foco. ${inteiro ? "Faça uma pausa de 5 minutos: levante, beba água, olhe para longe." : ""}`, botoes: [{ texto: "Ok", valor: true }] });
}
