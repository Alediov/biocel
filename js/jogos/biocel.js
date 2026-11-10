// Jogos do app BioCel (pedido do Alediov, 10/11/2026: "minigames específicos para esses 2 capítulos"):
// - Que Fase É?: uma célula desenhada (2n = 4, homólogo materno escuro e paterno claro) em cada estágio da mitose e da
//   meiose; escolha o estágio. O retorno diz o detalhe que denuncia a fase (Alberts, Painel 18-1 e Figs. 19-8 a 19-14).
// - Conte o DNA: cromossomos, moléculas de DNA, quantidade de DNA (C) e bivalentes em cada momento do ciclo e da meiose.
import { abrirCamada, terminar } from "../jogos.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { escapar } from "../ui.js";

const COR = { A: ["#C0392B", "#F08A7E"], B: ["#2563EB", "#8DB6FF"] }; // [materno, paterno]

// ---------------------------------------------------------------- desenho
const cromatide = (x, y, ang, cor, c = 22) => {
  const r = (ang * Math.PI) / 180, dx = Math.sin(r) * c / 2, dy = -Math.cos(r) * c / 2;
  return `<line x1="${x - dx}" y1="${y - dy}" x2="${x + dx}" y2="${y + dy}" stroke="${cor}" stroke-width="5.5" stroke-linecap="round"/>`;
};
/** Cromossomo duplicado: duas cromátides-irmãs unidas no centrômero (um X estreito). */
const duplicado = (x, y, ang, cor, c = 22) => {
  const h = c / 2;   // duas cromátides lado a lado, estreitadas no centrômero: )(
  return `<g transform="translate(${x} ${y}) rotate(${ang})"><path d="M-4.2 ${-h} Q-0.6 0 -4.2 ${h}" fill="none" stroke="${cor}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M4.2 ${-h} Q0.6 0 4.2 ${h}" fill="none" stroke="${cor}" stroke-width="5" stroke-linecap="round"/><circle cx="0" cy="0" r="2.4" fill="#333"/></g>`;
};
/** Cromossomo simples (uma cromátide), em V quando puxado (ponta = centrômero voltado para o polo). */
const simples = (x, y, cor, dir, c = 20) => {
  const s = dir; // +1 para baixo (polo de baixo), -1 para cima
  return `<path d="M${x - 6} ${y - s * 9} L${x} ${y + s * 3} L${x + 6} ${y - s * 9}" fill="none" stroke="${cor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const polo = (x, y) => `<g><circle cx="${x}" cy="${y}" r="5" fill="#16A34A"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${x}" y1="${y}" x2="${x + Math.cos(r) * 14}" y2="${y + Math.sin(r) * 14}" stroke="#16A34A" stroke-width="1.2" opacity=".7"/>`; }).join("")}</g>`;
const fibras = (px, py, alvos) => alvos.map(([x, y]) => `<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="#16A34A" stroke-width="1" opacity=".55"/>`).join("");
const celula = (rx = 92, ry = 92, extra = "") => `<ellipse cx="120" cy="120" rx="${rx}" ry="${ry}" fill="var(--bc-cel, #FFF7E6)" stroke="#B4834A" stroke-width="3"/>${extra}`;
const svg = (miolo) => `<svg class="bf-cel" viewBox="0 0 240 240" role="img" aria-label="Célula desenhada">${miolo}</svg>`;
const cromatina = () => {
  let s = ""; const pts = [[95, 105], [125, 95], [140, 125], [110, 135], [100, 120], [130, 112]];
  pts.forEach(([x, y], i) => { const c = i % 2 ? COR.B[i % 4 < 2 ? 0 : 1] : COR.A[i % 4 < 2 ? 0 : 1]; s += `<path d="M${x} ${y} q8 -10 16 0 t16 0" fill="none" stroke="${c}" stroke-width="2.2" opacity=".8"/>`; });
  return s;
};

const DESENHOS = {
  interfase: () => svg(celula() + `<circle cx="120" cy="118" r="42" fill="#F3E3C8" stroke="#8B6A3E" stroke-width="2"/>` + cromatina() + `<circle cx="120" cy="118" r="7" fill="#C9A878"/>` + `<g transform="translate(176 72)"><rect x="-6" y="-2" width="12" height="4" rx="2" fill="#16A34A"/><rect x="-2" y="-6" width="4" height="12" rx="2" fill="#16A34A"/></g>`),
  profase: () => svg(celula() + `<circle cx="120" cy="120" r="44" fill="#F3E3C8" stroke="#8B6A3E" stroke-width="2"/>` +
    duplicado(102, 108, 20, COR.A[0]) + duplicado(136, 112, -25, COR.A[1]) + duplicado(110, 138, -10, COR.B[0]) + duplicado(140, 136, 35, COR.B[1]) +
    polo(176, 58) + polo(194, 82) + `<line x1="176" y1="58" x2="194" y2="82" stroke="#16A34A" stroke-width="1.2"/>`),
  prometafase: () => svg(celula() + [[78, 120, 50], [98, 80, 120], [150, 76, 200], [166, 128, 300], [124, 168, 30], [86, 152, 260]].map(([x, y, a]) => `<path d="M${x} ${y} a10 10 0 0 1 14 -4" transform="rotate(${a} ${x} ${y})" fill="none" stroke="#8B6A3E" stroke-width="2"/>`).join("") +
    polo(120, 32) + polo(120, 208) + fibras(120, 32, [[106, 98], [142, 124]]) + fibras(120, 208, [[96, 132], [138, 104]]) +
    duplicado(106, 100, 40, COR.A[0]) + duplicado(140, 124, -30, COR.A[1]) + duplicado(96, 134, 70, COR.B[0]) + duplicado(136, 104, 10, COR.B[1])),
  metafase: () => { const xs = [72, 104, 136, 168], cs = [COR.A[0], COR.B[1], COR.A[1], COR.B[0]];
    return svg(celula() + polo(120, 32) + polo(120, 208) + fibras(120, 32, xs.map(x => [x, 110])) + fibras(120, 208, xs.map(x => [x, 130])) +
      xs.map((x, i) => duplicado(x, 120, 0, cs[i], 26)).join("") + `<line x1="40" y1="120" x2="200" y2="120" stroke="#999" stroke-dasharray="3 4" stroke-width="1"/>`); },
  anafase: () => { const xs = [76, 106, 136, 166], cs = [COR.A[0], COR.B[1], COR.A[1], COR.B[0]];
    return svg(celula(84, 100) + polo(120, 26) + polo(120, 214) + fibras(120, 26, xs.map(x => [x, 74])) + fibras(120, 214, xs.map(x => [x, 166])) +
      xs.map((x, i) => simples(x, 70, cs[i], -1) + simples(x, 170, cs[i], 1)).join("")); },
  telofase: () => { const xs = [100, 113, 126, 139], cs = [COR.A[0], COR.B[1], COR.A[1], COR.B[0]];
    return svg(`<path d="M120 18 C 205 18 205 102 186 120 C 205 138 205 222 120 222 C 35 222 35 138 54 120 C 35 102 35 18 120 18 Z" fill="var(--bc-cel, #FFF7E6)" stroke="#B4834A" stroke-width="3"/>` +
      `<circle cx="120" cy="66" r="30" fill="#F3E3C8" stroke="#8B6A3E" stroke-width="2" stroke-dasharray="6 3"/><circle cx="120" cy="174" r="30" fill="#F3E3C8" stroke="#8B6A3E" stroke-width="2" stroke-dasharray="6 3"/>` +
      xs.map((x, i) => simples(x, 66, cs[i], -1, 14) + simples(x, 174, cs[i], 1, 14)).join("") + `<line x1="80" y1="120" x2="160" y2="120" stroke="#DC2626" stroke-width="3" opacity=".8"/>`); },
  citocinese: () => svg(`<ellipse cx="120" cy="66" rx="70" ry="50" fill="var(--bc-cel, #FFF7E6)" stroke="#B4834A" stroke-width="3"/><ellipse cx="120" cy="174" rx="70" ry="50" fill="var(--bc-cel, #FFF7E6)" stroke="#B4834A" stroke-width="3"/>` +
    `<rect x="104" y="112" width="32" height="16" fill="var(--bc-cel, #FFF7E6)"/><line x1="106" y1="113" x2="134" y2="113" stroke="#B4834A" stroke-width="3"/><line x1="106" y1="127" x2="134" y2="127" stroke="#B4834A" stroke-width="3"/>` +
    `<circle cx="120" cy="62" r="26" fill="#F3E3C8" stroke="#8B6A3E" stroke-width="2"/><circle cx="120" cy="178" r="26" fill="#F3E3C8" stroke="#8B6A3E" stroke-width="2"/>` + `<g transform="translate(0 -56)">${cromatina()}</g><g transform="translate(0 58)">${cromatina()}</g>` +
    `<ellipse cx="120" cy="120" rx="18" ry="5" fill="none" stroke="#DC2626" stroke-width="3"/>`),
  metafase1: () => { const par = (x, ca, cb) => duplicado(x, 106, 0, ca, 22) + duplicado(x, 134, 0, cb, 22);
    return svg(celula() + polo(120, 30) + polo(120, 210) + fibras(120, 30, [[92, 96], [148, 96]]) + fibras(120, 210, [[92, 144], [148, 144]]) +
      par(92, COR.A[0], COR.A[1]) + par(148, COR.B[1], COR.B[0]) + `<line x1="40" y1="120" x2="200" y2="120" stroke="#999" stroke-dasharray="3 4" stroke-width="1"/>`); },
  anafase1: () => svg(celula(84, 100) + polo(120, 26) + polo(120, 214) + fibras(120, 26, [[96, 72], [144, 72]]) + fibras(120, 214, [[96, 168], [144, 168]]) +
    duplicado(96, 76, 0, COR.A[0], 22) + duplicado(144, 76, 0, COR.B[1], 22) + duplicado(96, 164, 0, COR.A[1], 22) + duplicado(144, 164, 0, COR.B[0], 22)),
  metafase2: () => svg(celula(70, 70) + polo(120, 56) + polo(120, 184) + fibras(120, 56, [[104, 110], [136, 110]]) + fibras(120, 184, [[104, 130], [136, 130]]) +
    duplicado(104, 120, 0, COR.A[0], 22) + duplicado(136, 120, 0, COR.B[1], 22) + `<line x1="56" y1="120" x2="184" y2="120" stroke="#999" stroke-dasharray="3 4" stroke-width="1"/>`),
  anafase2: () => svg(celula(64, 80) + polo(120, 44) + polo(120, 196) + fibras(120, 44, [[106, 82], [134, 82]]) + fibras(120, 196, [[106, 158], [134, 158]]) +
    simples(106, 80, COR.A[0], -1) + simples(134, 80, COR.B[1], -1) + simples(106, 160, COR.A[0], 1) + simples(134, 160, COR.B[1], 1)),
};

const FASES = [
  { id: "interfase", nome: "Interfase", pista: "Núcleo inteiro e cromatina descondensada; o centrossomo já duplicado fica ao lado do núcleo.", p: 622 },
  { id: "profase", nome: "Prófase", pista: "Os cromossomos duplicados se condensam ainda dentro do envelope nuclear intacto; o fuso se forma do lado de fora, entre os dois centrossomos.", p: 622 },
  { id: "prometafase", nome: "Prometáfase", pista: "O envelope nuclear se fragmenta e os microtúbulos do fuso se prendem aos cinetocoros; os cromossomos ainda se movem.", p: 622 },
  { id: "metafase", nome: "Metáfase (mitose)", pista: "Cada cromossomo duplicado sozinho no equador, com as irmãs presas a polos opostos (biorientação).", p: 623 },
  { id: "anafase", nome: "Anáfase (mitose)", pista: "As cromátides-irmãs se separaram: cada cromátide, agora um cromossomo, vai para um polo.", p: 623 },
  { id: "telofase", nome: "Telófase", pista: "Os dois conjuntos chegaram aos polos e um envelope nuclear se forma em volta de cada um; o anel contrátil começa.", p: 623 },
  { id: "citocinese", nome: "Citocinese", pista: "O anel contrátil de actina e miosina estrangula o meio e separa as duas células-filhas, cada uma com um núcleo.", p: 623 },
  { id: "metafase1", nome: "Metáfase I (meiose)", pista: "Os homólogos chegam PAREADOS (bivalentes) ao equador: materno e paterno lado a lado, um de cada lado da placa.", p: 651 },
  { id: "anafase1", nome: "Anáfase I (meiose)", pista: "Os homólogos se separam, mas cada cromossomo ainda tem as duas cromátides-irmãs unidas pelo centrômero.", p: 653 },
  { id: "metafase2", nome: "Metáfase II (meiose)", pista: "Célula menor, só um cromossomo de cada par (haploide), cada um com duas cromátides, alinhado como numa mitose.", p: 654 },
  { id: "anafase2", nome: "Anáfase II (meiose)", pista: "Em célula haploide, as cromátides-irmãs se separam e vão para polos opostos.", p: 654 },
];
const PARECIDAS = { metafase: ["metafase1", "metafase2", "prometafase"], metafase1: ["metafase", "metafase2", "anafase1"], metafase2: ["metafase", "metafase1", "anafase2"],
  anafase: ["anafase1", "anafase2", "telofase"], anafase1: ["anafase", "anafase2", "metafase1"], anafase2: ["anafase", "anafase1", "metafase2"],
  profase: ["prometafase", "interfase", "metafase"], prometafase: ["profase", "metafase", "metafase1"], interfase: ["profase", "telofase", "citocinese"],
  telofase: ["citocinese", "anafase", "interfase"], citocinese: ["telofase", "anafase", "interfase"] };

function css() {
  if (document.getElementById("bf-css")) return;
  const st = document.createElement("style"); st.id = "bf-css";
  st.textContent = `.bf{display:grid;gap:14px;max-width:560px;margin:0 auto;padding:4px 0 24px}
.bf-cel{width:min(260px,70vw);height:auto;margin:0 auto;display:block;--bc-cel:#FFF7E6}
:root[data-tema="escuro"] .bf-cel{--bc-cel:#2A2418}
@media (prefers-color-scheme: dark){:root:not([data-tema="claro"]) .bf-cel{--bc-cel:#2A2418}}
.bf-pergunta{font-weight:700;text-align:center;font-size:1.05rem}
.bf-placar{display:flex;justify-content:space-between;font-weight:700;color:var(--tinta-2,var(--tinta))}
.bf-ret{padding:12px 14px;border-radius:14px;border:1px solid color-mix(in srgb,var(--tinta) 14%,transparent);background:color-mix(in srgb,var(--tinta) 6%,var(--fundo));line-height:1.45}
.bf-ret b{display:block;margin-bottom:4px}.bf-ret small{display:block;margin-top:6px;color:var(--tinta-2,var(--tinta))}
.bf-dna{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.bf-estado{text-align:center;padding:16px;border-radius:16px;background:color-mix(in srgb,var(--acento) 12%,var(--fundo));border:1px solid color-mix(in srgb,var(--acento) 40%,transparent)}
.bf-estado b{display:block;font-size:1.2rem;margin-bottom:4px}.bf-estado small{color:var(--tinta-2,var(--tinta))}`;
  document.head.append(st);
}

function rodada(cam, { titulo, html, pergunta, opcoes, certa, explicar, aoFim }) {
  cam.corpo.innerHTML = `<div class="bf">${titulo}${html}<div class="bf-pergunta">${pergunta}</div><div class="opcoes"></div><div class="bf-fim"></div></div>`;
  const box = cam.corpo.querySelector(".opcoes"), fim = cam.corpo.querySelector(".bf-fim");
  for (const [v, txt] of opcoes) {
    const b = document.createElement("button"); b.className = "opcao"; b.textContent = txt;
    b.onclick = () => {
      const ok = v === certa;
      box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x === b) x.classList.add(ok ? "correta" : "incorreta"); });
      if (!ok) [...box.children].find((x, i) => opcoes[i][0] === certa)?.classList.add("correta");
      tocar(ok ? "certo" : "errado"); if (!ok) vibrar(40);
      fim.innerHTML = `<div class="bf-ret"><b>${ok ? "Isso!" : "Não foi dessa vez."}</b>${explicar}</div>`;
      const seg = document.createElement("button"); seg.className = "botao"; seg.style.marginTop = "12px"; seg.textContent = "Continuar";
      seg.onclick = () => aoFim(ok); fim.append(seg);
      seg.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    box.append(b);
  }
}

export function jogarFases({ quantas = 10 } = {}) {
  css();
  const cam = abrirCamada("Que Fase É?");
  const fila = [];
  while (fila.length < quantas) fila.push(...embaralhar([...FASES]));
  let n = 0, pontos = 0, acertos = 0, combo = 0;
  const erros = [];
  const proxima = () => {
    if (cam.saiu) return;
    if (n >= quantas) {
      const lista = erros.slice(0, 6).map(f => `<li><b>${escapar(f.nome)}</b>: ${escapar(f.pista)}</li>`).join("");
      return terminar(cam, "fases", pontos, { xp: Math.min(25, acertos * 2 + 3), moedas: Math.min(12, acertos) },
        `<p class="sub">${acertos} de ${quantas} certas.</p>${lista ? `<div class="cartao revisao-jogo"><b>Para revisar</b><ul>${lista}</ul></div>` : ""}`);
    }
    const f = fila[n++], outras = embaralhar(PARECIDAS[f.id]).slice(0, 3);
    cam.info.textContent = `${n}/${quantas}`;
    rodada(cam, {
      titulo: `<div class="bf-placar"><span>${pontos} pontos</span><span>${combo >= 2 ? `sequência ×${combo}` : ""}</span></div>`,
      html: DESENHOS[f.id](), pergunta: "Em que estágio está esta célula?",
      opcoes: embaralhar([f.id, ...outras].map(id => [id, FASES.find(x => x.id === id).nome])), certa: f.id,
      explicar: `${escapar(f.pista)}<small>Alberts, p. ${f.p}</small>`,
      aoFim: (ok) => { if (ok) { acertos++; combo++; pontos += 10 + Math.min(10, combo * 2); } else { combo = 0; erros.push(f); } proxima(); },
    });
  };
  proxima();
}

// ---------------------------------------------------------------- Conte o DNA
// Por célula. "cromossomos" = centrômeros; "moléculas de DNA" = cromátides; C = quantidade de DNA do gameta.
const ESTADOS = [
  { id: "g1", nome: "G1", desc: "antes da replicação", cr: (n) => 2 * n, dna: (n) => 2 * n, c: 2, biv: 0, p: 605, porque: "Cada cromossomo tem uma molécula de DNA, e a célula é diploide." },
  { id: "g2", nome: "G2", desc: "depois da fase S", cr: (n) => 2 * n, dna: (n) => 4 * n, c: 4, biv: 0, p: 605, porque: "A fase S duplicou o DNA: o número de cromossomos é o mesmo, mas cada um tem duas cromátides-irmãs." },
  { id: "met", nome: "Metáfase da mitose", desc: "", cr: (n) => 2 * n, dna: (n) => 4 * n, c: 4, biv: 0, p: 623, porque: "Os cromossomos ainda estão duplicados: as irmãs só se separam na anáfase." },
  { id: "ana", nome: "Anáfase da mitose", desc: "a célula inteira, antes de dividir", cr: (n) => 4 * n, dna: (n) => 4 * n, c: 4, biv: 0, p: 627, porque: "Cada cromátide separada passa a ser um cromossomo: o número de cromossomos dobra por um momento, o DNA não muda." },
  { id: "filha", nome: "Célula-filha da mitose", desc: "logo depois da citocinese", cr: (n) => 2 * n, dna: (n) => 2 * n, c: 2, biv: 0, p: 604, porque: "A mitose entrega a cada filha um genoma completo e idêntico ao da célula-mãe em G1." },
  { id: "met1", nome: "Metáfase I", desc: "meiose", cr: (n) => 2 * n, dna: (n) => 4 * n, c: 4, biv: (n) => n, p: 651, porque: "Os homólogos duplicados estão pareados: um bivalente por par, cada um com quatro cromátides." },
  { id: "pos1", nome: "Depois da meiose I", desc: "cada uma das duas células", cr: (n) => n, dna: (n) => 2 * n, c: 2, biv: 0, p: 653, porque: "A meiose I separa os homólogos: a célula fica com n cromossomos, mas cada um ainda tem duas cromátides." },
  { id: "met2", nome: "Metáfase II", desc: "meiose", cr: (n) => n, dna: (n) => 2 * n, c: 2, biv: 0, p: 654, porque: "Haploide, com as cromátides-irmãs ainda unidas no centrômero; não houve nova fase S." },
  { id: "ana2", nome: "Anáfase II", desc: "a célula inteira, antes de dividir", cr: (n) => 2 * n, dna: (n) => 2 * n, c: 2, biv: 0, p: 654, porque: "As irmãs se separam: por um momento são 2n cromossomos de uma cromátide cada, na célula que ainda não se dividiu." },
  { id: "gameta", nome: "Gameta", desc: "fim da meiose II", cr: (n) => n, dna: (n) => n, c: 1, biv: 0, p: 650, porque: "Haploide: um conjunto de cromossomos, cada um com uma molécula de DNA." },
  { id: "zigoto", nome: "Zigoto", desc: "depois da fusão dos pronúcleos", cr: (n) => 2 * n, dna: (n) => 2 * n, c: 2, biv: 0, p: 657, porque: "Dois gametas haploides reconstituem o conjunto diploide." },
];
const PERGUNTAS = [
  { k: "cr", txt: "Quantos cromossomos há na célula?" },
  { k: "dna", txt: "Quantas moléculas de DNA (cromátides) há na célula?" },
  { k: "c", txt: "Qual é a quantidade de DNA, em C (C = o DNA de um gameta)?" },
  { k: "biv", txt: "Quantos bivalentes há na célula?" },
];

export function jogarDNA({ quantas = 10 } = {}) {
  css();
  const cam = abrirCamada("Conte o DNA");
  let n = 0, pontos = 0, acertos = 0;
  const erros = [];
  const sorteio = [];
  for (const e of ESTADOS) for (const q of PERGUNTAS) if (q.k !== "biv" || e.id === "met1" || Math.random() < 0.15) sorteio.push([e, q]);
  const fila = embaralhar(sorteio).slice(0, quantas);
  const proxima = () => {
    if (cam.saiu) return;
    if (n >= fila.length) {
      const lista = erros.slice(0, 6).map(([e, q, v]) => `<li><b>${escapar(e.nome)}</b> · ${escapar(q.txt.replace("?", ""))}: <b>${v}</b></li>`).join("");
      return terminar(cam, "dna", pontos, { xp: Math.min(25, acertos * 2 + 3), moedas: Math.min(12, acertos) },
        `<p class="sub">${acertos} de ${fila.length} certas.</p>${lista ? `<div class="cartao revisao-jogo"><b>Para revisar</b><ul>${lista}</ul></div>` : ""}`);
    }
    const [e, q] = fila[n++];
    const humano = Math.random() < 0.4, nn = humano ? 23 : 2;
    const val = (k) => (typeof e[k] === "function" ? e[k](nn) : e[k]);
    const certo = val(q.k);
    const unid = q.k === "c" ? "C" : "";
    const cand = q.k === "c" ? [1, 2, 4, 8] : q.k === "biv" ? [0, nn, 2 * nn, 4 * nn] : [nn, 2 * nn, 4 * nn, 8 * nn];
    const ops = [...new Set([certo, ...cand])].slice(0, 4);
    cam.info.textContent = `${n}/${fila.length}`;
    rodada(cam, {
      titulo: `<div class="bf-placar"><span>${pontos} pontos</span><span>${humano ? "humano: 2n = 46" : "2n = 4"}</span></div>`,
      html: `<div class="bf-estado"><b>${escapar(e.nome)}</b><small>${escapar(e.desc || "")}${e.desc ? " · " : ""}uma célula com 2n = ${2 * nn}</small></div>`,
      pergunta: escapar(q.txt),
      opcoes: embaralhar(ops).map(v => [v, `${v}${unid ? " " + unid : ""}`]), certa: certo,
      explicar: `${escapar(e.porque)} Cromossomos: ${val("cr")}; moléculas de DNA: ${val("dna")}; DNA: ${val("c")}C${val("biv") ? `; bivalentes: ${val("biv")}` : ""}.<small>Alberts, p. ${e.p}</small>`,
      aoFim: (ok) => { if (ok) { acertos++; pontos += 10; } else erros.push([e, q, `${certo}${unid ? " " + unid : ""}`]); proxima(); },
    });
  };
  proxima();
}
export { DESENHOS, FASES };
