// Efeitos sonoros sintetizados com Web Audio (nenhum arquivo de áudio). A música fica em musica.js.
import { E } from "./estado.js";
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";

let ctx = null, mestre = null;
function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    // "playback" dá mais folga ao áudio (menos estalos em alguns celulares), com um pouco mais de atraso
    try { ctx = new C({ latencyHint: E().config.audioFolga ? "playback" : "interactive" }); } catch (e) { ctx = new C(); }
    mestre = ctx.createGain(); mestre.gain.value = VOL_MESTRE; mestre.connect(ctx.destination);
  }
  if (ctx.state === "suspended" && !emFundo) ctx.resume();
  return ctx;
}

function nota(freq, ini, dur, { tipo = "triangle", vol = 0.25, destino = null, desliza = 0 } = {}) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + ini;
  const o = c.createOscillator(), g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, t);
  if (desliza) o.frequency.exponentialRampToValueAtTime(freq * desliza, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(destino || mestre);
  o.start(t); o.stop(t + dur + 0.05);
}

const EFEITOS = {
  toque: () => nota(660, 0, 0.05, { tipo: "sine", vol: 0.08 }),
  certo: () => { nota(784, 0, 0.12, { tipo: "triangle" }); nota(1175, 0.09, 0.22, { tipo: "triangle" }); },
  errado: () => { nota(220, 0, 0.18, { tipo: "square", vol: 0.08 }); nota(196, 0.12, 0.26, { tipo: "square", vol: 0.08, desliza: 0.85 }); },
  parcial: () => { nota(523, 0, 0.12, { tipo: "triangle", vol: 0.16 }); nota(494, 0.11, 0.24, { tipo: "triangle", vol: 0.14 }); },
  combo: () => [988, 1319, 1568, 1976].forEach((f, i) => nota(f, i * 0.05, 0.1, { tipo: "sine", vol: 0.12 })),
  par: () => nota(880, 0, 0.09, { tipo: "triangle", vol: 0.15 }),
  fim: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, i * 0.11, i === 5 ? 0.5 : 0.14, { tipo: "triangle", vol: 0.2 })),
  ofensiva: () => { [392, 523, 659, 784].forEach((f, i) => nota(f, i * 0.08, 0.2, { tipo: "sawtooth", vol: 0.07 })); nota(1568, 0.36, 0.5, { tipo: "triangle", vol: 0.18 }); },
  bau: () => { nota(110, 0, 0.25, { tipo: "triangle", vol: 0.3, desliza: 0.6 }); nota(147, 0.18, 0.25, { tipo: "triangle", vol: 0.25, desliza: 0.6 }); [784, 988, 1175].forEach((f, i) => nota(f, 0.45 + i * 0.07, 0.25, { tipo: "sine", vol: 0.12 })); },
  moeda: () => { nota(1319, 0, 0.07, { tipo: "square", vol: 0.06 }); nota(1976, 0.06, 0.18, { tipo: "square", vol: 0.06 }); },
};

export function tocar(nome) {
  if (!E().config.som) return;
  try { EFEITOS[nome]?.(); } catch (e) { /* áudio indisponível */ }
}
export function vibrar(ms = 30) {
  if (E().config.vibrar && navigator.vibrate) navigator.vibrate(ms);
}

// ---------- música de fundo: ver musica.js ----------
export { musica } from "./musica.js";
import { musicaEmFundo, musicaSoltarContexto } from "./musica.js";
/** Contexto de áudio e saída principal, para a música procedural. */
export function saidaAudio() { const c = audio(); return c ? { c, mestre } : null; }
let emFundo = false;

/** App foi para o fundo (ou voltou): para a música e silencia o áudio; ao voltar, retoma se estava ligada.
 *  Suspender o contexto no meio de uma nota (e retomar com notas já agendadas) estalava como papel
 *  amassado: agora a saída some em ~0,1 s antes de suspender e só volta, em fade, depois do resume. */
const VOL_MESTRE = 0.5;
let suspensao = null, retomada = 0;
function fadeMestre(alvo, tau) {
  if (!ctx || !mestre) return;
  const t = ctx.currentTime;
  mestre.gain.cancelScheduledValues(t); mestre.gain.setValueAtTime(mestre.gain.value, t);
  mestre.gain.setTargetAtTime(alvo, t, tau);
}
export function audioEmFundo(fundo) {
  if (fundo === emFundo) return;
  emFundo = fundo;
  const manter = !!(E().config.musica && E().config.musicaFundo);
  const minha = ++retomada;
  clearTimeout(suspensao); suspensao = null;
  if (fundo) {
    musicaEmFundo(true, manter);
    if (manter || !ctx) return;
    fadeMestre(0.0001, 0.025);
    suspensao = setTimeout(() => { suspensao = null; if (emFundo) try { ctx.suspend(); } catch (e) { /* nada */ } }, 150);
  } else {
    // Ao voltar, em vez de retomar o contexto antigo, cria um novo: em alguns celulares o contexto
    // retomado fica com a saída de áudio "engasgando" (chiado de papel amassado) até fechar o app.
    if (ctx) {
      const velho = ctx;
      musicaSoltarContexto();
      ctx = null; mestre = null;
      try { velho.close(); } catch (e) { /* nada */ }
    }
    setTimeout(() => {
      if (minha !== retomada || emFundo) return;
      musicaEmFundo(false);
      if (ctx && mestre) { mestre.gain.value = 0.0001; fadeMestre(VOL_MESTRE, 0.08); }
    }, 250);
  }
}
/** Recria o contexto de áudio (preferência "mais folga" mudou). */
export function reiniciarAudio() {
  if (!ctx) return;
  const velho = ctx; musicaSoltarContexto(); ctx = null; mestre = null;
  try { velho.close(); } catch (e) { /* nada */ }
  setTimeout(() => musicaEmFundo(false), 200);
}
document.addEventListener("visibilitychange", () => audioEmFundo(document.visibilityState === "hidden"));
window.addEventListener("pagehide", () => audioEmFundo(true));
window.addEventListener("pageshow", () => audioEmFundo(document.visibilityState === "hidden"));
// No Android, o plugin App avisa quando o app sai da tela (a aba continua aberta nos recentes).
if (Capacitor.isNativePlatform?.()) {
  try {
    const App = registerPlugin("App");
    Promise.resolve(App.addListener("pause", () => audioEmFundo(true))).catch(() => {});
    Promise.resolve(App.addListener("resume", () => audioEmFundo(false))).catch(() => {});
    Promise.resolve(App.addListener("appStateChange", ({ isActive }) => audioEmFundo(!isActive))).catch(() => {});
  } catch (e) { /* plugin ausente: fica só o visibilitychange */ }
}

// Plugin nativo (MainActivity + MusicaService): mantém a música tocando fora da tela.
let musicaFundoNativo = null;
if (Capacitor.isNativePlatform?.()) { try { musicaFundoNativo = registerPlugin("MusicaFundo"); } catch (e) { /* APK antigo */ } }
export function avisarMusicaFundo(ativo) {
  try { Promise.resolve(musicaFundoNativo?.definir({ ativo: !!ativo })).catch(() => {}); } catch (e) { /* sem plugin */ }
}
