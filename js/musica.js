// Música de fundo procedural: faixas para cada momento do app (trilha de manhã, de tarde e de noite,
// lição, jogos, aventuras, chefe, jardim e eventos sazonais), sintetizadas na hora com Web Audio.
// Cada faixa define tom, escala, andamento, progressões e padrões de arpejo, baixo e bateria.
// A melodia é gerada por motivos (com semente) e muda a cada volta, junto com a progressão e o tom;
// depois de algumas voltas, a próxima faixa do mesmo momento entra. Nenhum arquivo de áudio.
import { saidaAudio, avisarMusicaFundo } from "./sons.js";
import { E } from "./estado.js";

const ESC = {
  maior: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorico: [0, 2, 3, 5, 7, 9, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], harmonica: [0, 2, 3, 5, 7, 8, 11], frigio: [0, 1, 3, 5, 7, 8, 10],
};
// tom: nota MIDI da tônica na região do arpejo (60 = Dó central).
// progs: graus da escala, um acorde por compasso (0 = I). arp.padroes: índices do acorde (0 a 3; 4 = oitava; null = pausa).
// baixo/bateria: 16 passos por compasso. Baixo: r tônica, t terça, f quinta, s sétima, o oitava, . pausa.
const FAIXAS = {
  // ---- trilha ----
  onibus: { nome: "Ônibus das 6h50", bpm: 96, tom: 60, escala: "maior", progs: [[0, 5, 3, 4], [3, 4, 2, 5], [5, 3, 0, 4], [0, 2, 3, 4]],
    arp: { tipo: "sine", vol: 0.13, div: 8, padroes: [[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 4, 3, 2, 1], [0, 1, 2, 4, 2, 1, 0, 2]] },
    baixo: { tipo: "triangle", vol: 0.12, padroes: ["r.......f.......", "r.......r...f..."] }, pad: { vol: 0.025 },
    melodia: { tipo: "triangle", vol: 0.085, densidade: 0.5 }, bateria: { vol: 0.5, kick: "x.......x.......", chimbal: "..x...x...x...x." } },
  cafe: { nome: "Café com Malamed", bpm: 88, tom: 55, escala: "maior", swing: 0.18, progs: [[0, 3, 1, 4], [5, 1, 4, 0], [3, 3, 0, 5]],
    arp: { tipo: "triangle", vol: 0.1, div: 8, padroes: [[0, 2, 1, 3, 0, 2, 1, 3], [0, null, 2, 3, null, 2, 1, null]] },
    baixo: { tipo: "triangle", vol: 0.13, padroes: ["r.....r.f.......", "r.......t...f..."] }, pad: { vol: 0.03 },
    melodia: { tipo: "sine", vol: 0.1, densidade: 0.45 }, bateria: { vol: 0.45, kick: "x.....x...x.....", caixa: "....x.......x...", chimbal: "x.x.x.x.x.x.x.x." } },
  tarde: { nome: "Tarde de Patologia", bpm: 84, tom: 65, escala: "lidio", progs: [[0, 1, 0, 4], [5, 1, 3, 4], [0, 2, 5, 1]],
    arp: { tipo: "sine", vol: 0.11, div: 16, padroes: [[0, null, 1, 2, null, 3, 2, null, 4, null, 2, 3, null, 1, 2, null]] },
    baixo: { tipo: "sine", vol: 0.14, padroes: ["r.........f.....", "r.......o......."] }, pad: { vol: 0.03 },
    melodia: { tipo: "triangle", vol: 0.08, densidade: 0.35 }, sinos: 0.25 },
  biblioteca: { nome: "Silêncio na biblioteca", bpm: 78, tom: 62, escala: "maior", progs: [[0, 4, 5, 3], [1, 4, 0, 0], [3, 0, 3, 4]],
    arp: { tipo: "triangle", vol: 0.1, div: 8, padroes: [[0, 1, 2, 1, 3, 1, 2, 1], [0, 2, 4, 2, 3, 2, 1, 2]] },
    baixo: { tipo: "sine", vol: 0.13, padroes: ["r.......r......."] }, pad: { vol: 0.03 },
    melodia: { tipo: "sine", vol: 0.09, densidade: 0.3 } },
  luar: { nome: "Revisão ao luar", bpm: 72, tom: 57, escala: "menor", progs: [[0, 5, 2, 6], [3, 0, 4, 4], [5, 6, 0, 0]],
    arp: { tipo: "sine", vol: 0.1, div: 8, padroes: [[0, 2, 4, 2, 1, 2, 3, 2], [0, 1, 2, 3, 4, 3, 2, 1]] },
    baixo: { tipo: "sine", vol: 0.13, padroes: ["r...............", "r.......f......."] }, pad: { vol: 0.035 },
    melodia: { tipo: "sine", vol: 0.09, densidade: 0.3 }, sinos: 0.35 },
  estrelas: { nome: "Céu de Cascavel", bpm: 76, tom: 64, escala: "dorico", progs: [[0, 3, 0, 3], [5, 3, 6, 4], [0, 6, 5, 3]],
    arp: { tipo: "triangle", vol: 0.09, div: 16, padroes: [[0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 2, 1, 3, 2, 1]] },
    baixo: { tipo: "sine", vol: 0.13, padroes: ["r.......r...f..."] }, pad: { vol: 0.03 },
    melodia: { tipo: "sine", vol: 0.08, densidade: 0.35 }, sinos: 0.3 },
  // ---- lição (calmas, sem disputar atenção) ----
  foco: { nome: "Foco", bpm: 90, tom: 62, escala: "maior", progs: [[0, 4, 5, 3], [0, 3, 4, 4], [5, 3, 0, 4]],
    arp: { tipo: "sine", vol: 0.1, div: 8, padroes: [[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 0, 2, 1, 3]] },
    baixo: { tipo: "sine", vol: 0.1, padroes: ["r.......f......."] }, pad: { vol: 0.025 },
    melodia: { tipo: "sine", vol: 0.06, densidade: 0.2 } },
  foco2: { nome: "Foco lo-fi", bpm: 80, tom: 63, escala: "maior", swing: 0.22, progs: [[1, 4, 0, 5], [3, 2, 1, 4], [0, 5, 1, 4]],
    arp: { tipo: "triangle", vol: 0.08, div: 8, padroes: [[0, null, 2, 3, null, 1, 3, null]] },
    baixo: { tipo: "sine", vol: 0.13, padroes: ["r.....r...f.....", "r.......r..t...."] }, pad: { vol: 0.035 },
    melodia: { tipo: "sine", vol: 0.06, densidade: 0.25 }, bateria: { vol: 0.35, kick: "x......x..x.....", caixa: "....x.......x...", chimbal: "x.x.x.x.x.x.x.xx" } },
  foco3: { nome: "Gotas", bpm: 70, tom: 60, escala: "lidio", progs: [[0, 1, 0, 1], [5, 4, 3, 1]],
    arp: { tipo: "sine", vol: 0.09, div: 16, padroes: [[4, null, 2, null, 3, null, 1, null, 2, null, 0, null, 3, null, 2, null]] },
    baixo: { tipo: "sine", vol: 0.12, padroes: ["r..............."] }, pad: { vol: 0.03 }, sinos: 0.3 },
  // ---- jogos rápidos ----
  fliperama: { nome: "Fliperama", bpm: 132, tom: 67, escala: "maior", progs: [[0, 5, 3, 4], [0, 3, 0, 4], [5, 3, 4, 4]],
    arp: { tipo: "square", vol: 0.06, div: 16, padroes: [[0, 1, 2, 4, 2, 1, 0, 1, 2, 4, 2, 1, 0, 1, 2, 4]] },
    baixo: { tipo: "triangle", vol: 0.16, padroes: ["r.r.o.r.r.r.o.r.", "r.o.r.o.f.o.f.o."] },
    melodia: { tipo: "square", vol: 0.07, densidade: 0.75 }, bateria: { vol: 0.6, kick: "x...x...x...x...", caixa: "....x.......x...", chimbal: "x.x.x.x.x.x.x.x." } },
  corrida: { nome: "Contra o relógio", bpm: 144, tom: 69, escala: "mixo", progs: [[0, 6, 3, 0], [0, 6, 4, 4], [3, 6, 0, 0]],
    arp: { tipo: "square", vol: 0.04, div: 8, padroes: [[0, 2, 1, 3, 0, 2, 1, 3]] },
    baixo: { tipo: "triangle", vol: 0.16, padroes: ["r.rr.r.rr.r.f.f.", "r.r.r.r.r.r.o.r."] },
    melodia: { tipo: "triangle", vol: 0.08, densidade: 0.8 }, bateria: { vol: 0.6, kick: "x..x..x.x..x..x.", caixa: "....x.......x..x", chimbal: "xxxxxxxxxxxxxxxx" } },
  // ---- aventuras ----
  reino: { nome: "Reino dos Cristais", bpm: 112, tom: 62, escala: "dorico", progs: [[0, 6, 3, 0], [0, 3, 6, 4], [5, 6, 0, 0]],
    arp: { tipo: "triangle", vol: 0.08, div: 8, padroes: [[0, 1, 2, 1, 0, 1, 2, 1]] },
    baixo: { tipo: "triangle", vol: 0.15, padroes: ["r...r...f...r...", "r.r.f...r.r.o..."] }, pad: { vol: 0.03, tipo: "metal" },
    melodia: { tipo: "metal", vol: 0.06, densidade: 0.6 }, bateria: { vol: 0.55, kick: "x.......x.......", caixa: "....x.......x.xx", chimbal: "x...x...x...x..." } },
  masmorra: { nome: "Corredor das Tochas", bpm: 100, tom: 62, escala: "frigio", progs: [[0, 0, 1, 0], [0, 5, 1, 0], [3, 1, 0, 0]],
    arp: { tipo: "triangle", vol: 0.07, div: 8, padroes: [[0, null, 1, 0, 2, null, 1, null]] },
    baixo: { tipo: "triangle", vol: 0.17, padroes: ["r.r.r.rfr.r.r.r.", "r..r..r.r..r..t."] }, pad: { vol: 0.035 },
    melodia: { tipo: "teremim", vol: 0.06, densidade: 0.35 }, bateria: { vol: 0.5, kick: "x.....x.x.......", chimbal: "..x...x...x...x." } },
  dragao: { nome: "Sisorath desperta", bpm: 150, tom: 64, escala: "harmonica", progs: [[0, 0, 5, 4], [0, 3, 5, 4], [5, 3, 1, 4]],
    arp: { tipo: "sawtooth", vol: 0.05, div: 16, padroes: [[0, 1, 2, 1, 0, 1, 2, 4, 0, 1, 2, 1, 0, 1, 2, 4]] },
    baixo: { tipo: "sawtooth", vol: 0.13, padroes: ["r.r.r.r.r.r.o.r.", "rrr.rrr.rrr.f.o."] }, pad: { vol: 0.03 },
    melodia: { tipo: "metal", vol: 0.09, densidade: 0.7 }, bateria: { vol: 0.7, kick: "x...x...x...x.x.", caixa: "....x.......x...", chimbal: "xxxxxxxxxxxxxxxx" } },
  // ---- jardim ----
  jardim: { nome: "Jardim ao sol", bpm: 84, tom: 65, escala: "maior", progs: [[0, 3, 0, 4], [5, 3, 0, 4], [3, 4, 2, 5]],
    arp: { tipo: "pluck", vol: 0.13, div: 8, padroes: [[0, 2, 1, 3, 2, 4, 3, 2], [0, 1, 2, 3, 4, 3, 2, 1]] },
    baixo: { tipo: "sine", vol: 0.12, padroes: ["r.......f.......", "r.....f.r......."] }, pad: { vol: 0.02 },
    melodia: { tipo: "xilofone", vol: 0.09, densidade: 0.45 }, bateria: { vol: 0.35, chocalho: "..x...x...x...x." }, passaros: true },
  orvalho: { nome: "Orvalho", bpm: 74, tom: 60, escala: "lidio", progs: [[0, 1, 5, 4], [3, 1, 0, 0]],
    arp: { tipo: "pluck", vol: 0.12, div: 16, padroes: [[0, null, 2, null, 4, null, 3, null, 2, null, 4, null, 1, null, 3, null]] },
    baixo: { tipo: "sine", vol: 0.12, padroes: ["r..............."] }, pad: { vol: 0.03 },
    melodia: { tipo: "sine", vol: 0.07, densidade: 0.3 }, sinos: 0.3, passaros: true },
  // ---- eventos sazonais ----
  "ev-natal": { nome: "Sinos de dezembro", bpm: 120, tom: 60, escala: "maior", progs: [[0, 3, 4, 0], [0, 5, 1, 4], [3, 0, 1, 4]],
    arp: { tipo: "triangle", vol: 0.08, div: 8, padroes: [[0, 2, 1, 2, 0, 2, 1, 2]] },
    baixo: { tipo: "triangle", vol: 0.13, padroes: ["r...f...r...f..."] }, pad: { vol: 0.025 },
    melodia: { tipo: "sino", vol: 0.1, densidade: 0.6 }, bateria: { vol: 0.45, chocalho: "x.x.x.x.x.x.x.x.", kick: "x.......x......." } },
  "ev-halloween": { nome: "Abóboras à meia-noite", bpm: 96, tom: 62, escala: "harmonica", progs: [[0, 0, 5, 4], [0, 3, 5, 4], [3, 0, 1, 4]],
    arp: { tipo: "triangle", vol: 0.08, div: 8, padroes: [[0, 1, 2, 1, 4, 1, 2, 1]] },
    baixo: { tipo: "triangle", vol: 0.15, padroes: ["r..r..r.r..r..f."] }, pad: { vol: 0.03 },
    melodia: { tipo: "teremim", vol: 0.08, densidade: 0.45 }, bateria: { vol: 0.4, kick: "x.......x.......", chimbal: "....x.......x..." } },
  "ev-junina": { nome: "Arraiá do Moli", bpm: 120, tom: 67, escala: "mixo", progs: [[0, 0, 4, 4], [0, 3, 4, 0], [3, 0, 4, 0]],
    arp: { tipo: "triangle", vol: 0.06, div: 8, padroes: [[0, 2, 1, 2, 0, 2, 1, 2]] },
    baixo: { tipo: "triangle", vol: 0.16, padroes: ["r..f..r.r..f..r.", "r..f..o.r..f..t."] },
    melodia: { tipo: "sanfona", vol: 0.06, densidade: 0.7 }, bateria: { vol: 0.55, kick: "x..x....x..x....", triangulo: "x.xxx.xxx.xxx.xx" } },
  "ev-carnaval": { nome: "Bloco do Dentinho", bpm: 132, tom: 65, escala: "maior", progs: [[0, 5, 1, 4], [0, 3, 4, 0]],
    arp: { tipo: "square", vol: 0.04, div: 8, padroes: [[0, 2, 1, 3, 0, 2, 1, 3]] },
    baixo: { tipo: "triangle", vol: 0.15, padroes: ["r...f...r.f.f..."] },
    melodia: { tipo: "triangle", vol: 0.09, densidade: 0.75 }, bateria: { vol: 0.6, kick: "....x.......x...", caixa: "x.x.x..x.x.x..x.", chimbal: "xxxxxxxxxxxxxxxx" } },
  "ev-pascoa": { nome: "Caça aos ovos", bpm: 92, tom: 65, escala: "maior", progs: [[0, 3, 4, 0], [5, 1, 4, 0]],
    arp: { tipo: "pluck", vol: 0.12, div: 8, padroes: [[0, 1, 2, 4, 2, 1, 2, 4]] },
    baixo: { tipo: "sine", vol: 0.12, padroes: ["r.......f......."] }, pad: { vol: 0.025 },
    melodia: { tipo: "xilofone", vol: 0.09, densidade: 0.5 }, passaros: true },
  "ev-criancas": { nome: "Caixa de brinquedos", bpm: 126, tom: 72, escala: "maior", progs: [[0, 4, 0, 4], [3, 0, 4, 0]],
    arp: { tipo: "square", vol: 0.035, div: 8, padroes: [[0, 2, 4, 2, 0, 2, 4, 2]] },
    baixo: { tipo: "triangle", vol: 0.13, padroes: ["r...f...r...f..."] },
    melodia: { tipo: "xilofone", vol: 0.1, densidade: 0.6 }, bateria: { vol: 0.45, kick: "x.......x.......", chocalho: "..x...x...x...x." } },
  "ev-dentista": { nome: "25 de outubro", bpm: 108, tom: 67, escala: "maior", progs: [[0, 4, 5, 3], [0, 3, 4, 4]],
    arp: { tipo: "triangle", vol: 0.08, div: 8, padroes: [[0, 1, 2, 3, 4, 3, 2, 1]] },
    baixo: { tipo: "triangle", vol: 0.14, padroes: ["r...r...f...r..."] }, pad: { vol: 0.025 },
    melodia: { tipo: "metal", vol: 0.06, densidade: 0.55 }, bateria: { vol: 0.5, kick: "x.......x.......", caixa: "....x.......x...", chimbal: "x.x.x.x.x.x.x.x." } },
  "ev-aniversario": { nome: "Parabéns!", bpm: 116, tom: 62, escala: "maior", progs: [[0, 4, 4, 0], [0, 3, 0, 4], [3, 0, 4, 0]],
    arp: { tipo: "triangle", vol: 0.08, div: 8, padroes: [[0, 2, 1, 2, 0, 2, 1, 2]] },
    baixo: { tipo: "triangle", vol: 0.14, padroes: ["r...f...r...f..."] }, pad: { vol: 0.025 },
    melodia: { tipo: "sino", vol: 0.09, densidade: 0.55 }, sinos: 0.4, bateria: { vol: 0.5, kick: "x.......x.......", caixa: "....x.......x...", chocalho: "x.x.x.x.x.x.x.x." } },
  "ev-ano_novo": { nome: "Fogos à meia-noite", bpm: 104, tom: 58, escala: "maior", progs: [[0, 5, 3, 4], [3, 4, 0, 0]],
    arp: { tipo: "sine", vol: 0.1, div: 16, padroes: [[0, 1, 2, 4, 2, 1, 2, 4, 0, 1, 2, 4, 3, 2, 1, 2]] },
    baixo: { tipo: "triangle", vol: 0.13, padroes: ["r.......f...r..."] }, pad: { vol: 0.03 },
    melodia: { tipo: "sino", vol: 0.09, densidade: 0.45 }, sinos: 0.5, bateria: { vol: 0.4, kick: "x.......x.......", chimbal: "..x...x...x...x." } },
};
const CONTEXTOS = {
  manha: ["onibus", "cafe"], tarde: ["tarde", "biblioteca"], noite: ["luar", "estrelas"],
  licao: ["foco", "foco2", "foco3"], jogos: ["fliperama", "corrida"], reino: ["reino"], masmorra: ["masmorra"], chefe: ["dragao"],
  jardim: ["jardim", "orvalho"],
};
const MODULA = [0, 2, 0, -3];

// ---------- utilidades ----------
function semente(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const escolha = (r, a) => a[Math.floor(r() * a.length)];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const midi = (f, tom, grau) => { const e = ESC[f.escala], o = Math.floor(grau / 7), g = ((grau % 7) + 7) % 7; return tom + 12 * o + e[g]; };
const acorde = (g) => [g, g + 2, g + 4, g + 6];
/** Grau do acorde mais próximo do alvo (qualquer oitava). */
function tomDoAcorde(alvo, tons) {
  let melhor = alvo, dist = 99;
  for (const t of tons) for (let k = -3; k <= 3; k++) { const g = t + 7 * k, d = Math.abs(g - alvo); if (d < dist) { dist = d; melhor = g; } }
  return melhor;
}

// ---------- composição ----------
const RITMOS = {
  esparso: ["x.......x.......", "x...........x...", "x.......x...x...", "x.....x.........", "x...x.......x..."],
  medio: ["x...x...x...x...", "x.x.x...x...x...", "x..x..x.x.......", "x...x.x.x...x...", "x.....x.x...x...", "x..x..x...x.x..."],
  denso: ["x.x.x.x.x.x.x...", "x.xxx.x.x.x.x...", "x..x..x.x.x.x.x.", "xx.x.x..x.x.x...", "x.x.x.xxx...x.x."],
};
const FINAIS = ["x...x...x.......", "x.......x.......", "x.x.x...x......."];
const onsets = (s) => [...s].map((c, i) => (c === "x" ? i : -1)).filter(i => i >= 0);

/** Frase de melodia sobre a progressão: motivo no 1º e 3º compassos, resposta no 2º, cadência no 4º. */
function gerarMelodia(f, prog, r, tom, resolve = true) {
  const dens = f.melodia.densidade;
  const banco = () => escolha(r, dens < 0.35 ? RITMOS.esparso : dens < 0.65 ? (r() < 0.7 ? RITMOS.medio : RITMOS.esparso) : (r() < 0.6 ? RITMOS.denso : RITMOS.medio));
  const rA = banco(), rB = banco();
  const ritmos = prog.map((_, b) => (b === prog.length - 1 && resolve ? escolha(r, FINAIS) : b % 2 === 0 ? rA : rB));
  const motivo = onsets(rA).map(() => escolha(r, [-1, 1, 1, -1, 2, -2, 0, 1, -1, 3]));
  const base = 7; // melodia entre a quinta abaixo e a oitava acima da tônica aguda
  let cur = tomDoAcorde(base, acorde(prog[0]).slice(0, 3));
  return prog.map((g, b) => {
    const tons = acorde(g).slice(0, 3), on = onsets(ritmos[b]), ev = [];
    on.forEach((p, i) => {
      const passo = (b % 2 === 0 ? motivo[i] : escolha(r, [-1, 1, -2, 2, 0, -1])) ?? 1;
      let alvo = cur + passo;
      if (alvo > base + 7 || alvo < base - 3) alvo = cur - passo;
      cur = i === 0 || p % 8 === 0 ? tomDoAcorde(alvo, tons) : alvo;
      if (resolve && b === prog.length - 1 && i === on.length - 1) cur = tomDoAcorde(cur, [g]);
      if (i > 0 && r() < 0.1) return;
      const fim = on[i + 1] ?? 16;
      let m = midi(f, tom, cur); while (m > 86) m -= 12;
      ev.push({ p, inst: "mel", m, d: Math.min(8, fim - p) * 0.92, v: f.melodia.vol * (p % 4 === 0 ? 1 : 0.8) });
    });
    return ev;
  });
}

function montarSecao(f, tipo, ciclo, r) {
  const n = f.progs.length;
  const prog = f.progs[(ciclo + (tipo === "B" ? 1 : tipo === "C" ? 2 : 0)) % n];
  const tom = f.tom + MODULA[ciclo % MODULA.length];
  const repete = tipo === "A" || tipo === "B" ? 2 : 1;
  const comps = [];
  const arpPad = f.arp ? escolha(r, f.arp.padroes) : null;
  const baixoPad = f.baixo ? escolha(r, f.baixo.padroes) : null;
  let mel = null;
  if ((tipo === "A" || tipo === "B") && f.melodia) {
    const frase = gerarMelodia(f, prog, r, tom, false);
    const resposta = r() < 0.5 ? gerarMelodia(f, prog, r, tom, true) : [...frase.slice(0, -1), gerarMelodia(f, prog, r, tom, true).at(-1)];
    mel = [...frase, ...resposta];
  }
  for (let rep = 0; rep < repete; rep++) prog.forEach((g, b) => {
    const ev = [], tons = acorde(g), idx = rep * prog.length + b, ultimo = rep === repete - 1 && b === prog.length - 1;
    if (f.pad && tipo !== "intro") ev.push({ p: 0, inst: "pad", ms: tons.slice(0, 3).map(t => midi(f, tom, t)), d: 16, v: f.pad.vol });
    if (arpPad) {
      const div = f.arp.div, st = 16 / div;
      for (let i = 0; i < div; i++) {
        const k = arpPad[i % arpPad.length];
        if (k == null) continue;
        if (tipo === "C" && i % 2 === 1 && div === 16) continue;
        ev.push({ p: i * st, inst: "arp", m: midi(f, tom, k === 4 ? g + 7 : tons[k]), d: st * 1.5, v: f.arp.vol * (i === 0 ? 1.15 : 1) });
      }
    }
    if (baixoPad && tipo !== "intro") {
      const on = onsets(baixoPad.replace(/[rtfso]/g, "x"));
      on.forEach((p, i) => {
        const c = baixoPad[p], gr = { r: g, t: g + 2, f: g + 4, s: g + 6, o: g + 7 }[c];
        ev.push({ p, inst: "baixo", m: midi(f, tom, gr) - 24, d: Math.min(8, (on[i + 1] ?? 16) - p) * 0.85, v: f.baixo.vol });
      });
    }
    if (f.bateria && tipo !== "intro") {
      const bt = f.bateria;
      for (const peca of ["kick", "caixa", "chimbal", "chocalho", "triangulo"]) {
        if (!bt[peca] || (tipo === "C" && peca !== "chimbal" && peca !== "chocalho")) continue;
        let padrao = bt[peca];
        if (ultimo && peca === "caixa" && tipo !== "C") padrao = padrao.slice(0, 12) + "xxxx";
        onsets(padrao).forEach(p => ev.push({ p, inst: peca, v: bt.vol * (p % 4 === 0 ? 1 : 0.7) }));
      }
    }
    if (mel) ev.push(...mel[idx]);
    if (f.sinos && r() < f.sinos) ev.push({ p: escolha(r, [0, 8, 12, 6]), inst: "sino", m: midi(f, tom, tons[Math.floor(r() * 3)]) + 24, d: 8, v: 0.045 });
    if (f.passaros && r() < 0.18) ev.push({ p: escolha(r, [2, 6, 10]), inst: "passaro", v: 0.03 });
    comps.push(ev);
  });
  return comps;
}

// ---------- instrumentos ----------
let C = null, bus = null, eco = null, ruido = null, faixaNo = null, alcance = 0.25;
function preparar() {
  const s = saidaAudio(); if (!s) return false;
  if (C === s.c && bus) return true;
  C = s.c;
  bus = C.createGain(); bus.gain.value = volume(); bus.connect(s.mestre);
  eco = C.createDelay(1.5); const fb = C.createGain(), filtro = C.createBiquadFilter(), molhado = C.createGain();
  fb.gain.value = 0.28; filtro.type = "lowpass"; filtro.frequency.value = 2200; molhado.gain.value = 0.22;
  eco.connect(filtro); filtro.connect(fb); fb.connect(eco); filtro.connect(molhado); molhado.connect(bus);
  ruido = C.createBuffer(1, C.sampleRate, C.sampleRate);
  const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
function envelope(g, t, vol, ataque, dur, solta) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + ataque);
  g.gain.setValueAtTime(Math.max(vol, 0.0002), t + Math.max(ataque, dur - solta));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + solta);
}
function saida(g, envio = 0.35) { g.connect(faixaNo || bus); if (envio) { const e = C.createGain(); e.gain.value = envio; g.connect(e); e.connect(eco); } }
function osc(tipo, freq, t, fim, detune = 0) { const o = C.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(freq, t); o.detune.value = detune; o.start(t); o.stop(fim); return o; }
function vibrato(o, t, fim, prof, vel = 5.5) { const l = C.createOscillator(), lg = C.createGain(); l.frequency.value = vel; lg.gain.value = prof; l.connect(lg); lg.connect(o.detune); l.start(t + 0.12); l.stop(fim); }

function voz(t, m, dur, tipo, vol) {
  const f = hz(m), g = C.createGain(), fim = t + dur + 1.6;
  if (tipo === "pluck" || tipo === "xilofone") {
    const o = osc(tipo === "pluck" ? "triangle" : "sine", f, t, fim); o.connect(g);
    if (tipo === "xilofone") { const o2 = osc("sine", f * 4, t, t + 0.3), g2 = C.createGain(); g2.gain.setValueAtTime(vol * 0.3, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o2.connect(g2); saida(g2, 0.2); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.9, dur + 0.4));
    return saida(g, 0.4);
  }
  if (tipo === "sino") {
    const o = osc("sine", f, t, fim), o2 = osc("sine", f * 2.76, t, fim), g2 = C.createGain();
    g2.gain.value = 0.35; o.connect(g); o2.connect(g2); g2.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    return saida(g, 0.5);
  }
  if (tipo === "teremim") {
    const o = osc("sine", f, t, fim); vibrato(o, t, fim, 22, 5.8); o.connect(g);
    envelope(g, t, vol, 0.08, dur, 0.25); return saida(g, 0.5);
  }
  if (tipo === "sanfona" || tipo === "metal") {
    const fl = C.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = tipo === "sanfona" ? 1600 : 2400; fl.Q.value = 0.7;
    const a = osc("sawtooth", f, t, fim, -7), b = osc(tipo === "sanfona" ? "square" : "sawtooth", f, t, fim, 7);
    if (tipo === "sanfona") vibrato(a, t, fim, 6, 6);
    a.connect(fl); b.connect(fl); fl.connect(g);
    envelope(g, t, vol * 0.6, tipo === "sanfona" ? 0.03 : 0.04, dur, 0.12); return saida(g, 0.3);
  }
  const o = osc(tipo, f, t, fim);
  if (tipo === "square" || tipo === "sawtooth") { const fl = C.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 1900; o.connect(fl); fl.connect(g); } else o.connect(g);
  envelope(g, t, vol, 0.012, dur, 0.18); saida(g, 0.35);
}
function pad(t, ms, dur, vol) {
  const fl = C.createBiquadFilter(), g = C.createGain(), fim = t + dur + 1;
  fl.type = "lowpass"; fl.frequency.value = 900; fl.connect(g);
  for (const m of ms) for (const d of [-8, 8]) osc("sawtooth", hz(m), t, fim, d).connect(fl);
  envelope(g, t, vol, 0.5, dur, 0.6); saida(g, 0.3);
}
function batida(t, peca, vol) {
  const g = C.createGain();
  if (peca === "kick") {
    const o = osc("sine", 120, t, t + 0.3); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); o.connect(g);
    g.gain.setValueAtTime(0.32 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26); return saida(g, 0);
  }
  if (peca === "triangulo") {
    const o = osc("sine", 3200, t, t + 0.4), o2 = osc("sine", 4870, t, t + 0.4); o.connect(g); o2.connect(g);
    g.gain.setValueAtTime(0.025 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); return saida(g, 0.2);
  }
  const n = C.createBufferSource(), fl = C.createBiquadFilter(); n.buffer = ruido; n.connect(fl); fl.connect(g);
  const cfg = { caixa: ["bandpass", 1800, 0.16, 0.13], chimbal: ["highpass", 7000, 0.045, 0.05], chocalho: ["bandpass", 5200, 0.06, 0.06] }[peca];
  fl.type = cfg[0]; fl.frequency.value = cfg[1];
  g.gain.setValueAtTime(cfg[3] * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + cfg[2]);
  n.start(t, Math.random() * 0.5); n.stop(t + cfg[2] + 0.05);
  if (peca === "caixa") { const o = osc("triangle", 190, t, t + 0.12), g2 = C.createGain(); g2.gain.setValueAtTime(0.1 * vol, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g2); saida(g2, 0); }
  saida(g, peca === "caixa" ? 0.15 : 0);
}
function passaro(t, vol) {
  let x = t;
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const f0 = 2600 + Math.random() * 1400, o = osc("sine", f0, x, x + 0.12), g = C.createGain();
    o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), x + 0.07); o.connect(g);
    g.gain.setValueAtTime(0.0001, x); g.gain.exponentialRampToValueAtTime(vol, x + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, x + 0.09);
    saida(g, 0.5); x += 0.11 + Math.random() * 0.05;
  }
}
function tocarEvento(e, t, f, dur16) {
  if (e.inst === "pad") return pad(t, e.ms, e.d * dur16, e.v);
  if (e.inst === "mel") return voz(t, e.m, e.d * dur16, f.melodia.tipo, e.v * (0.9 + Math.random() * 0.2));
  if (e.inst === "arp") return voz(t, e.m, e.d * dur16, f.arp.tipo, e.v * (0.85 + Math.random() * 0.25));
  if (e.inst === "baixo") return voz(t, e.m, e.d * dur16, f.baixo.tipo, e.v);
  if (e.inst === "sino") return voz(t, e.m, 1, "sino", e.v);
  if (e.inst === "passaro") return passaro(t, e.v);
  batida(t, e.inst, e.v);
}

// ---------- reprodução ----------
let ligada = false, fundo = false, tela = "trilha", camada = null, atualId = null, st = null, timer = null, trocando = null;
const giro = {};
let eventoDaMusica = () => null;
/** Função que devolve o id do evento sazonal ativo (ou null), para tocar a faixa do evento na trilha. */
export function definirEventoMusica(fn) { eventoDaMusica = fn; }
const volume = () => 0.55 * ((E().config.volMusica ?? 60) / 100);

function contextoEfetivo() {
  const c = camada || tela;
  if (c === "trilha" || c === "eventos") {
    const ev = eventoDaMusica();
    if (ev && FAIXAS[`ev-${ev}`]) return { nome: `ev-${ev}`, lista: [`ev-${ev}`] };
    const h = new Date().getHours();
    const per = h >= 5 && h < 12 ? "manha" : h >= 12 && h < 18 ? "tarde" : "noite";
    return { nome: per, lista: CONTEXTOS[per] };
  }
  return { nome: c, lista: CONTEXTOS[c] || CONTEXTOS.manha };
}
function iniciarFaixa(id) {
  const f = FAIXAS[id];
  atualId = id;
  st = { f, id, r: semente(Date.now() & 0xffffff), ciclo: 0, voltas: 0, plano: ["intro", "A", "B", "A", "C"], iSec: 0, comps: null, iComp: 0, passo: 0, prox: C.currentTime + 0.12 };
  st.comps = montarSecao(f, st.plano[0], 0, st.r);
  eco.delayTime.setValueAtTime(Math.min(1.4, (60 / f.bpm) * 0.75), C.currentTime);
  // cada faixa tem a sua saída: ao trocar, as notas já agendadas somem junto com ela
  faixaNo = C.createGain(); faixaNo.gain.value = 0.0001; faixaNo.connect(bus);
  faixaNo.gain.setTargetAtTime(1, C.currentTime, 0.4);
  window.dispatchEvent(new CustomEvent("oq-musica", { detail: f.nome }));
}
function avancar() {
  st.passo++;
  if (st.passo < 16) return;
  st.passo = 0; st.iComp++;
  if (st.iComp < st.comps.length) return;
  st.iComp = 0; st.iSec++;
  if (st.iSec >= st.plano.length) {
    st.iSec = 1; st.ciclo++; st.voltas++;
    const { lista } = contextoEfetivo();
    if (st.voltas >= 2 && lista.length > 1 && lista.includes(st.id)) { trocarFaixa(lista[(lista.indexOf(st.id) + 1) % lista.length]); return; }
  }
  st.comps = montarSecao(st.f, st.plano[st.iSec], st.ciclo, st.r);
}
function agendar() {
  if (!st || trocando) return;
  const f = st.f, dur16 = 60 / f.bpm / 4;
  // No máximo ~2,5 s de música por rodada: com o app fora da tela o alcance sobe para 65 s, e
  // criar tudo de uma vez (milhares de osciladores) engasgava o áudio, com estalos.
  const limite = Math.min(C.currentTime + alcance, Math.max(st.prox, C.currentTime + 0.25) + 2.5);
  while (st && st.prox < limite) {
    const swing = f.swing && st.passo % 2 === 1 ? f.swing * dur16 : 0;
    for (const e of st.comps[st.iComp]) if (e.p === st.passo) tocarEvento(e, st.prox + swing, f, dur16);
    st.prox += dur16;
    avancar();
  }
}
function soltarSaida() {
  const n = faixaNo; faixaNo = null;
  if (!n) return;
  const t = C.currentTime; n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(0.0001, t, 0.2);
  setTimeout(() => n.disconnect(), 1500);
}
function trocarFaixa(id) {
  if (!preparar()) return;
  if (st || trocando) {
    // Já tocando (ou trocando): a faixa atual some e a nova entra depois do fade.
    soltarSaida(); st = null; atualId = id; clearTimeout(trocando);
    trocando = setTimeout(() => { trocando = null; if (ligada && (!fundo || alcance > 1)) iniciarFaixa(id); }, 650);
  } else iniciarFaixa(id);
  if (!timer) timer = setInterval(agendar, 60);
}
// Música própria (Músicas, desde 24/10/2026): nas lições e jogos, o álbum Estudos toca no lugar da música do app; e,
// com as suas músicas tocando no tocador das Músicas, a do app fica quieta. `propria.decidir(contexto, ehCamada)`
// devolve true quando assume (então a música do app para).
let propria = null;
export function definirMusicaPropria(p) { propria = p; }
export function reavaliarMusica() { if (ligada && !fundo) escolherFaixa(); else propria?.parar(); }
function escolherFaixa(forcarProxima = false) {
  if (propria?.decidir(camada || tela, !!camada)) { if (st || trocando) parar(); atualId = null; return; }
  const { nome, lista } = contextoEfetivo();
  if (!forcarProxima && (st || trocando) && lista.includes(atualId)) return;
  giro[nome] = giro[nome] == null ? Math.floor(Math.random() * lista.length) : (giro[nome] + 1) % lista.length;
  trocarFaixa(lista[giro[nome]]);
}
function parar() {
  clearInterval(timer); timer = null; clearTimeout(trocando); trocando = null; st = null;
  if (C) soltarSaida();
}

/** Liga ou desliga a música (a preferência fica em config.musica). */
/** Diz ao Android se a música deve seguir com o app fora da tela. */
export function atualizarFundoNativo() { avisarMusicaFundo(ligada && !!E().config.musicaFundo); }
export function musica(ligar) {
  ligada = ligar;
  atualizarFundoNativo();
  if (!ligar) { parar(); atualId = null; propria?.parar(); return; }
  if (!fundo) escolherFaixa();
}
/** Tela atual (trilha, jogos, jardim, eventos…): define o clima da música. */
export function musicaTela(nome) { tela = nome; if (ligada && !fundo && !camada) escolherFaixa(); }
/** Camada por cima da tela (licao, jogos, reino, masmorra, chefe, jardim) ou null para voltar à tela. */
export function musicaCamada(nome) { if (camada === nome) return; camada = nome; if (ligada && !fundo) escolherFaixa(); }
/** App foi para o fundo (b = true) ou voltou. Com `manter`, a música continua: as notas passam a
 *  ser agendadas com ~1 min de antecedência, porque o sistema espaça os timers fora da tela. */
export function musicaEmFundo(b, manter = false) {
  fundo = b;
  if (b && manter && ligada) { alcance = 65; return; }
  alcance = 0.25;
  if (b) { parar(); atualId = null; propria?.parar(); }
  else if (ligada) escolherFaixa();
}
/** O contexto de áudio vai ser trocado por um novo: solta a faixa atual (sons.js recria tudo). */
export function musicaSoltarContexto() { parar(); atualId = null; bus = null; C = null; }
export function proximaFaixa() { if (ligada && !fundo) escolherFaixa(true); }
export function volumeMusica() { if (bus) bus.gain.setTargetAtTime(volume(), C.currentTime, 0.1); propria?.volume?.(); }
export const tocandoAgora = () => (ligada && atualId ? FAIXAS[atualId].nome : null);
export const _faixas = FAIXAS; // para testes
export function _tocarFaixa(id) { if (ligada && FAIXAS[id]) trocarFaixa(id); } // para testes
