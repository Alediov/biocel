// OdontoScan: visão computacional da ficha "Controle de Tratamento" (Cód. OD-0049), tudo no aparelho.
// 1) acha o quadro impresso (azul ou preto) e endireita a foto (homografia), conferindo com o modelo da ficha;
// 2) recorta as caixas de dígitos (prontuário, nº do aluno, CPF, CNS) e prepara cada dígito em 28×28;
// 3) monta a cópia sem identificação e os recortes isolados de endereço e equipe.
// O protótipo em Python e o treino da rede ficam em tools/odontoscan/.
import { MODELO, MODELO_L, MODELO_A } from "./modelo.js";

export const OX = 40, OY = 110, LARG = 2000, ALT = 1480;      // quadro do modelo e margens da foto alinhada
export const W_AL = LARG + 2 * OX, H_AL = ALT + OY + 40;      // 2080 × 1630

const grade = (x0, passo, n, y, w, h) => Array.from({ length: n }, (_, i) => [Math.round(x0 + passo * i), y, w, h]);
export const CAIXAS = {
  prontuario: grade(18, 59.0, 10, 366, 48, 46),
  aluno: grade(661, 58.6, 9, 366, 48, 46),
  cpf: [...grade(213, 58.9, 9, 660, 48, 46), ...grade(753, 58, 2, 660, 48, 46)],
  cns: grade(210, 58.7, 15, 764, 48, 46),
};
// zonas (x0, y0, x1, y1) no quadro; podem sair um pouco dele (margem da foto alinhada)
export const ZONAS_LEITURA = {
  cabecalho: [-40, -110, 2040, 335],       // anotações acima do quadro, linha da Clínica (horário, cor, clínica) e data
  tipo_dn_sexo: [-40, 420, 200, 1480],      // 01/02/03, data de nascimento e sexo
  idade: [880, 585, 1192, 700],
  municipio: [196, 1100, 1192, 1250],
  procedimentos: [1196, 335, 2040, 1480],
};
export const ZONA_ENDERECO = [196, 985, 1192, 1105];   // vai sozinha: só o bairro volta
export const ZONA_EQUIPE = [196, 1245, 1420, 1480];    // aluno e professor, sozinha: o nome vira código
// faixas mostradas na tela de confirmação dos números (ficam só no aparelho)
export const FAIXAS_NUMEROS = { prontuario: [0, 350, 610, 425], aluno: [640, 350, 1190, 425], cpf: [196, 640, 880, 720], cns: [196, 750, 1100, 825] };

// ---------------- máscaras de cor ----------------
// A ficha vem impressa de dois jeitos: em azul-ciano (G bem acima de R; a caneta roxa/azul tem G perto de R)
// ou em preto (fotocópia; aí a caneta azul é a única coisa colorida). "modo" diz qual impressão procurar.
export function mascaraImpressa(px, n, modo = "azul") {
  const m = new Uint8Array(n);
  if (modo === "preto") {
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const R = px[j], G = px[j + 1], B = px[j + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      m[i] = (R + G + B < 400 && mx - mn < 55) ? 1 : 0; // escuro e sem cor
    }
    return m;
  }
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const R = px[j], G = px[j + 1], B = px[j + 2];
    m[i] = (G - R > 25 && B - R > 50 && R + G + B < 690) ? 1 : 0;
  }
  return m;
}

// ---------------- quadro e homografia ----------------
function ajustarLinha(pts) { // v = a*t + b, robusto: escolhe a reta com mais pontos perto (RANSAC) e refina
  // (riscos de caneta perto da borda, como a linha que anula os procedimentos, viram pontos fora da reta)
  const tol = 5;
  let melhor = null;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const [t1, v1] = pts[i], [t2, v2] = pts[j];
    if (Math.abs(t2 - t1) < 60) continue;
    const a = (v2 - v1) / (t2 - t1); if (Math.abs(a) > 0.15) continue; // a borda do quadro é quase reta no eixo
    const b = v1 - a * t1;
    let n = 0, erro = 0;
    for (const [t, v] of pts) { const r = Math.abs(v - (a * t + b)); if (r <= tol) { n++; erro += r; } }
    if (!melhor || n > melhor.n || (n === melhor.n && erro < melhor.erro)) melhor = { a, b, n, erro };
  }
  if (!melhor) return [0, pts.reduce((s, p) => s + p[1], 0) / Math.max(1, pts.length)];
  let { a, b } = melhor;
  for (let it = 0; it < 2; it++) { // mínimos quadrados só com os pontos da reta
    const dentro = pts.filter(([t, v]) => Math.abs(v - (a * t + b)) <= tol * 1.5);
    if (dentro.length < 2) break;
    let n = 0, st = 0, sv = 0, stt = 0, stv = 0;
    for (const [t, v] of dentro) { n++; st += t; sv += v; stt += t * t; stv += t * v; }
    const den = n * stt - st * st || 1e-9;
    a = (n * stv - st * sv) / den; b = (sv - a * st) / n;
  }
  return [a, b];
}

export function cantosDoQuadro(m, W, H) {
  const F = 40, min = Math.round(F * 0.55), topo = [], base = [], esq = [], dir = [];
  for (let x = Math.floor(W * .15); x < W * .85 && x + F < W; x += 25) {
    let primeiro = -1, ultimo = -1;
    for (let y = 0; y < H; y++) {
      let s = 0; const o = y * W + x;
      for (let k = 0; k < F; k++) s += m[o + k];
      if (s >= min) { if (primeiro < 0) primeiro = y; ultimo = y; }
    }
    if (primeiro >= 0) { topo.push([x + F / 2, primeiro]); base.push([x + F / 2, ultimo]); }
  }
  for (let y = Math.floor(H * .15); y < H * .85 && y + F < H; y += 25) {
    const col = new Uint16Array(W);
    for (let k = 0; k < F; k++) { const o = (y + k) * W; for (let x = 0; x < W; x++) col[x] += m[o + x]; }
    let primeiro = -1, ultimo = -1;
    for (let x = 0; x < W; x++) if (col[x] >= min) { if (primeiro < 0) primeiro = x; ultimo = x; }
    if (primeiro >= 0) { esq.push([y + F / 2, primeiro]); dir.push([y + F / 2, ultimo]); }
  }
  if (topo.length < 8 || esq.length < 8) throw new Error("Não achei o quadro azul da ficha.");
  const [at, bt] = ajustarLinha(topo), [ab, bb] = ajustarLinha(base), [ae, be] = ajustarLinha(esq), [ad, bd] = ajustarLinha(dir);
  const inter = (ah, bh, av, bv) => { const y = (ah * bv + bh) / (1 - ah * av); return [av * y + bv, y]; };
  return [inter(at, bt, ae, be), inter(at, bt, ad, bd), inter(ab, bb, ad, bd), inter(ab, bb, ae, be)];
}

function homografia(src, dst) { // resolve 8 incógnitas (h33 = 1)
  const A = [], v = [];
  src.forEach(([x, y], i) => {
    const [u, w] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); v.push(u);
    A.push([0, 0, 0, x, y, 1, -w * x, -w * y]); v.push(w);
  });
  for (let c = 0; c < 8; c++) {           // eliminação de Gauss com pivô
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [v[c], v[p]] = [v[p], v[c]];
    for (let r = 0; r < 8; r++) if (r !== c) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      v[r] -= f * v[c];
    }
  }
  return [...v.map((x, i) => x / A[i][i]), 1];
}

// ---------------- conferência do alinhamento ----------------
// Depois de endireitar, a impressão da ficha tem de cair onde o modelo (modelo.js) diz. O modelo marca, em blocos
// de 4×4 px da imagem 2080×1630, onde a ficha "Controle de Tratamento" tem impressão; a conferência olha só as zonas
// que vão na cópia sem identificação (assim a mesma nota vale para a foto, para a cópia guardada e na tarefa da
// madrugada, em tools/odontoscan/fila.py). Em cada parte, a nota é o menor entre:
//   achado: quanto do modelo aparece na imagem (até 2 blocos de folga);
//   no lugar: quanto da impressão achada na imagem cai perto do modelo.
// Foto cortada, torta ou com a impressão confundida com a caneta tira nota baixa; e uma ficha mal recortada NÃO
// segue, porque recortar no lugar errado poderia mandar nome, CPF ou assinatura para a leitura.
export const ALINHAMENTO_MINIMO = 0.8;     // a partir daqui, segue sozinha
export const ALINHAMENTO_DUVIDOSO = 0.7;   // entre os dois: só segue se você aprovar a cópia (Lote)
export const CONFERENCIA = 2;              // versão desta conferência (1: só as linhas do quadro, até a v0.1.41)
const BL = MODELO_L, BA = MODELO_A;
// Partes conferidas: o cabeçalho (em cima), a faixa do tipo/DN/sexo (à esquerda) e a coluna dos procedimentos (à
// direita). Cercam a ficha: se as três batem, o miolo também está no lugar. A nota é a da PIOR das três, para que
// uma parte bem alinhada não esconda outra fora do lugar. (Idade e município são pequenas e têm muita letra: não entram.)
const PARTES = ["cabecalho", "tipo_dn_sexo", "procedimentos"];
let _modelo = null;
function modelo() {
  if (_modelo) return _modelo;
  const bin = atob(MODELO), n = BL * BA, T = new Uint8Array(n), Z = new Uint8Array(n);
  for (let i = 0; i < n; i++) T[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  const partes = PARTES.map(() => ({ zi: [], tz: [] })), zi = [];
  for (let by = 0; by < BA; by++) for (let bx = 0; bx < BL; bx++) {
    const x = bx * 4 + 2 - OX, y = by * 4 + 2 - OY, i = by * BL + bx;
    PARTES.forEach((nome, k) => {
      const [x0, y0, x1, y1] = ZONAS_LEITURA[nome];
      if (Z[i] || x < x0 || x >= x1 || y < y0 || y >= y1) return;
      Z[i] = 1; zi.push(i); partes[k].zi.push(i); if (T[i]) partes[k].tz.push(i);
    });
  }
  _modelo = { Z, zi: Int32Array.from(zi), partes: partes.map(p => ({ zi: Int32Array.from(p.zi), tz: Int32Array.from(p.tz) })), dT: dilatar(T, BL, BA, 2) };
  return _modelo;
}
function dilatar(m, w, h, r) {
  const a = new Uint8Array(w * h), b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) a[y * w + k] = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x]) for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) b[k * w + x] = 1;
  return b;
}
/** Nota de 0 a 1 para os blocos achados (M, só nas partes conferidas): a da pior parte. */
function notaBlocos(M) {
  const { partes, dT } = modelo(), L = BL + 1, I = new Int32Array(L * (BA + 1));
  for (let y = 0; y < BA; y++) for (let x = 0, linha = 0; x < BL; x++) { linha += M[y * BL + x]; I[(y + 1) * L + x + 1] = I[y * L + x + 1] + linha; }
  let pior = 1;
  for (const { zi, tz } of partes) {
    let achado = 0;
    for (const i of tz) {
      const x = i % BL, y = (i / BL) | 0, x0 = Math.max(0, x - 2), x1 = Math.min(BL, x + 3), y0 = Math.max(0, y - 2), y1 = Math.min(BA, y + 3);
      if (I[y1 * L + x1] - I[y0 * L + x1] - I[y1 * L + x0] + I[y0 * L + x0] > 0) achado++;
    }
    let n = 0, perto = 0;
    for (const i of zi) if (M[i]) { n++; if (dT[i]) perto++; }
    pior = Math.min(pior, achado / tz.length, n ? perto / n : 0);
  }
  return pior;
}
// ---------------- campos preenchidos (sem ler) ----------------
// Para a completude da ficha: nome, assinatura, endereço, responsável e professor (carimbo) nunca são lidos, mas dá
// para saber se o espaço tem escrita. Conta os pixels de caneta (roxa/azul ou preta) fora da impressão do modelo
// (dilatada 8 px) em cada espaço. Fichas fictícias: em branco ≤ 0,13%; preenchidas ≥ 1,1%. Nada sai do aparelho.
export const ZONAS_PRESENCA = {
  nome: [210, 500, 1165, 605], assinatura: [210, 875, 1165, 980], endereco: [210, 1020, 1165, 1105],
  responsavel: [196, 1230, 1165, 1360], professor: [196, 1360, 1165, 1480],
};
export const LIMIAR_PRESENCA = 0.005;
/** Fração (0 a 1) de escrita em cada espaço da ficha endireitada (ImageData 2080×1630). */
export function presencaDeTinta(img) {
  const out = {};
  for (const [campo, zona] of Object.entries(ZONAS_PRESENCA)) out[campo] = tintaNaZona(img, zona);
  return out;
}
/** Fração (0 a 1) de escrita de caneta numa zona do quadro (fora da impressão do modelo). */
export function tintaNaZona(img, [x0, y0, x1, y1]) {
  const { dT } = modelo(), d = img.data;
  let tinta = 0, n = 0;
  const Y0 = Math.max(0, y0 + OY), Y1 = Math.min(H_AL, y1 + OY), X0 = Math.max(0, x0 + OX), X1 = Math.min(W_AL, x1 + OX);
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    n++;
    const b = (y >> 2) * BL + (x >> 2);
    if (b >= dT.length || dT[b]) continue;
    const o = (y * W_AL + x) * 4, R = d[o], G = d[o + 1], B = d[o + 2], lum = (R + G + B) / 3;
    if (((G - R < 35 && B - R > 25 && lum < 205) || lum < 110) && (215 - lum) / 120 > 0.15) tinta++;
  }
  return n ? +(tinta / n).toFixed(4) : 0;
}

// máscara mais tolerante que a de achar o quadro: a cópia guardada é JPEG (às vezes reduzido), e as linhas claras perdem cor
function impressoSolto(R, G, B, modo) {
  if (modo === "preto") return R + G + B < 450 && Math.max(R, G, B) - Math.min(R, G, B) < 60;
  return G - R > 15 && B - R > 30 && R + G + B < 720;
}
/** De 0 a 1: o quanto a impressão da ficha endireitada (2080×1630) bate com o modelo. */
export function qualidadeAlinhamento(img, modo) {
  const { Z } = modelo(), M = new Uint8Array(BL * BA), px = img.data;
  for (let y = 0; y < BA * 4; y++) {
    const by = y >> 2;
    for (let x = 0; x < BL * 4; x++) {
      const b = by * BL + (x >> 2);
      if (!Z[b] || M[b]) continue;
      const o = (y * W_AL + x) * 4;
      if (impressoSolto(px[o], px[o + 1], px[o + 2], modo)) M[b] = 1;
    }
  }
  return +notaBlocos(M).toFixed(3);
}

// Quando a nota fica baixa (ex.: uma anotação ou um risco grudado na borda puxou um canto), ajusta os 4 cantos
// aos poucos para a impressão bater melhor com o modelo. Rápido: usa a máscara da foto reduzida pela metade.
export function ajustarCantos(px, W, H, cantos, modo) {
  const w = W >> 1, h = H >> 1, L = w + 1, I = new Int32Array(L * (h + 1));
  for (let y = 0; y < h; y++) {
    let linha = 0;
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dy = 0; dy < 2 && !v; dy++) for (let dx = 0; dx < 2; dx++) { const o = ((2 * y + dy) * W + 2 * x + dx) * 4; if (impressoSolto(px[o], px[o + 1], px[o + 2], modo)) { v = 1; break; } }
      linha += v; I[(y + 1) * L + x + 1] = I[y * L + x + 1] + linha;
    }
  }
  const { zi } = modelo(), M = new Uint8Array(BL * BA);
  const nota = (c) => {
    const hm = homografia([[0, 0], [LARG, 0], [LARG, ALT], [0, ALT]], c);
    const esc = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) / LARG, r = Math.max(1, Math.round(esc)); // meio bloco, em px da máscara reduzida
    M.fill(0);
    for (const i of zi) {
      const xq = (i % BL) * 4 + 2 - OX, yq = ((i / BL) | 0) * 4 + 2 - OY, z = hm[6] * xq + hm[7] * yq + 1;
      const fx = ((hm[0] * xq + hm[1] * yq + hm[2]) / z) / 2, fy = ((hm[3] * xq + hm[4] * yq + hm[5]) / z) / 2;
      const x0 = Math.max(0, Math.round(fx) - r), x1 = Math.min(w, Math.round(fx) + r + 1), y0 = Math.max(0, Math.round(fy) - r), y1 = Math.min(h, Math.round(fy) + r + 1);
      if (x1 > x0 && y1 > y0 && I[y1 * L + x1] - I[y0 * L + x1] - I[y1 * L + x0] + I[y0 * L + x0] > 0) M[i] = 1;
    }
    return notaBlocos(M);
  };
  let melhor = cantos.map(p => [...p]), nm = nota(melhor);
  const lado = Math.hypot(cantos[1][0] - cantos[0][0], cantos[1][1] - cantos[0][1]);
  for (const passo of [0.04, 0.02, 0.01, 0.005].map(f => Math.max(1, Math.round(lado * f)))) {
    for (let volta = 0, melhorou = true; melhorou && volta < 6; volta++) {
      melhorou = false;
      for (let k = 0; k < 4; k++) for (let e = 0; e < 2; e++) for (const s of [passo, -passo]) {
        const c = melhor.map(p => [...p]); c[k][e] += s;
        if (Math.abs(c[k][e] - cantos[k][e]) > lado * 0.05) continue; // ajuste fino: um canto não anda mais que 5% da largura
        const v = nota(c);
        if (v > nm + 1e-4) { melhor = c; nm = v; melhorou = true; }
      }
    }
  }
  return melhor;
}

// ---------------- registro pelo modelo (fotos tortas, de lado ou de ponta-cabeça) ----------------
// Quando o quadro não aparece pelas bordas (ou a nota fica baixa), procura o modelo inteiro da ficha na foto:
// tenta os 4 lados (0°, 90°, 180°, 270°) com inclinação de até 12°, vários tamanhos e todas as posições, numa
// versão bem reduzida da foto, e fica com o encaixe em que mais impressão do modelo cai sobre impressão da foto.
// Depois refina perto do melhor e devolve os 4 cantos do quadro (para ajustarCantos e para a conferência).
// Nota de um encaixe = impressão do modelo que cai sobre impressão da foto − impressão da foto que cai onde o
// modelo é branco (sem isso, uma foto com fundo sujo "encaixaria" em qualquer lugar).
const NIVEIS = [[60, 16], [120, 8], [240, 4]]; // células da grade no lado maior da foto, blocos do modelo por grupo
let _pontos = null;
function pontosDoModelo() { // por nível: centros dos grupos com impressão (sim) e dos grupos brancos (nao), no quadro
  if (_pontos) return _pontos;
  const bin = atob(MODELO), T = (i) => (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  _pontos = NIVEIS.map(([, g]) => {
    const sim = [], nao = [];
    for (let gy = 0; gy * g < BA; gy++) for (let gx = 0; gx * g < BL; gx++) {
      let on = 0;
      for (let y = gy * g; y < Math.min(BA, gy * g + g) && !on; y++) for (let x = gx * g; x < Math.min(BL, gx * g + g); x++) if (T(y * BL + x)) { on = 1; break; }
      const X = (gx * g + g / 2) * 4 - OX, Y = (gy * g + g / 2) * 4 - OY;
      if (X < 0 || Y < 0 || X > LARG || Y > ALT) continue; // só dentro do quadro
      (on ? sim : nao).push(X, Y);
    }
    return { sim: Float32Array.from(sim), nao: Float32Array.from(nao) };
  });
  return _pontos;
}
/** Grade reduzida da foto: célula ligada se tem impressão (azul ou preta), sem ser mancha cheia (borda escura do scanner). */
function gradeDaFoto(px, W, H, n) {
  const c = Math.max(W, H) / n, gw = Math.ceil(W / c), gh = Math.ceil(H / c), cont = new Uint32Array(gw * gh);
  const passo = Math.max(1, Math.floor(c / 6));
  for (let y = 0; y < H; y += passo) {
    const gy = Math.min(gh - 1, Math.floor(y / c)) * gw;
    for (let x = 0; x < W; x += passo) {
      const o = (y * W + x) * 4, R = px[o], G = px[o + 1], B = px[o + 2];
      if (impressoSolto(R, G, B, "azul") || impressoSolto(R, G, B, "preto")) cont[gy + Math.min(gw - 1, Math.floor(x / c))]++;
    }
  }
  const amostras = (c / passo) ** 2, on = new Uint8Array(gw * gh), dil = new Uint8Array(gw * gh);
  for (let i = 0; i < on.length; i++) on[i] = cont[i] > 0 && cont[i] < amostras * 0.5 ? 1 : 0;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (on[y * gw + x])
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < gh && xx < gw) dil[yy * gw + xx] = 1; }
  return { c, gw, gh, on, dil };
}
/** Melhor encaixe para um ângulo e um tamanho: devolve {nota, tx, ty}. `faixa`: limita as posições perto de um palpite. */
function encaixe(g, pts, ang, esc, faixa) {
  const co = Math.cos(ang), si = Math.sin(ang);
  const girar = (arr) => { const n = arr.length / 2, u = new Int32Array(n), v = new Int32Array(n);
    for (let i = 0; i < n; i++) { const X = arr[2 * i] * esc, Y = arr[2 * i + 1] * esc; u[i] = Math.round(X * co - Y * si); v[i] = Math.round(X * si + Y * co); } return [u, v, n]; };
  const [u, v, n] = girar(pts.sim), [u2, v2, n2] = girar(pts.nao);
  // posições em que o quadro inteiro (com 4% de folga) cabe na foto
  const QX = [0, LARG, LARG, 0], QY = [0, 0, ALT, ALT];
  const cx = QX.map((X, k) => (X * co - QY[k] * si) * esc), cy = QX.map((X, k) => (X * si + QY[k] * co) * esc);
  const folga = 0.04 * LARG * esc;
  let x0 = Math.ceil(-Math.min(...cx) - folga), x1 = Math.floor(g.gw - Math.max(...cx) + folga), y0 = Math.ceil(-Math.min(...cy) - folga), y1 = Math.floor(g.gh - Math.max(...cy) + folga);
  if (faixa) { x0 = Math.max(x0, faixa.tx - faixa.r); x1 = Math.min(x1, faixa.tx + faixa.r); y0 = Math.max(y0, faixa.ty - faixa.r); y1 = Math.min(y1, faixa.ty + faixa.r); }
  let melhor = { nota: -2, tx: 0, ty: 0 };
  const { on, dil, gw, gh } = g;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    let sim = 0, nao = 0;
    for (let i = 0; i < n; i++) { const x = u[i] + tx, y = v[i] + ty; if (x >= 0 && y >= 0 && x < gw && y < gh && dil[y * gw + x]) sim++; }
    for (let i = 0; i < n2; i++) { const x = u2[i] + tx, y = v2[i] + ty; if (x >= 0 && y >= 0 && x < gw && y < gh && on[y * gw + x]) nao++; }
    const nota = sim / n - (n2 ? nao / n2 : 0);
    if (nota > melhor.nota) melhor = { nota, tx, ty };
  }
  return melhor;
}
/** Procura o modelo da ficha na foto. Devolve os cantos do quadro (como cantosDoQuadro) ou null. */
export function registrarModelo(px, W, H) {
  const P = pontosDoModelo(), graus = Math.PI / 180;
  const escDe = (f, nivel) => (f * NIVEIS[nivel][0]) / LARG; // f: largura do quadro / lado maior da foto
  // 1) busca ampla na grade grossa: 4 lados, inclinação de -12° a 12°, tamanhos de 45% a 100%
  const g0 = gradeDaFoto(px, W, H, NIVEIS[0][0]);
  let cands = [];
  for (let lado = 0; lado < 4; lado++) for (let inc = -12; inc <= 12; inc += 3) for (let f = 0.45; f <= 1.0001; f += 0.05) {
    const ang = (lado * 90 + inc) * graus, r = encaixe(g0, P[0], ang, escDe(f, 0));
    if (r.nota > -2) cands.push({ ang, f, ...r });
  }
  cands.sort((a, b) => b.nota - a.nota);
  cands = cands.slice(0, 6);
  // 2) e 3) refina os melhores em grades mais finas, perto do palpite
  const passos = [null, { dA: 1.5, nA: 2, dF: 0.025, nF: 2 }, { dA: 0.5, nA: 2, dF: 0.0125, nF: 2 }];
  for (let nivel = 1; nivel < NIVEIS.length; nivel++) {
    const g = gradeDaFoto(px, W, H, NIVEIS[nivel][0]), k = NIVEIS[nivel][0] / NIVEIS[nivel - 1][0], { dA, nA, dF, nF } = passos[nivel];
    const novos = [];
    for (const c of cands) {
      let melhor = null;
      for (let i = -nA; i <= nA; i++) for (let j = -nF; j <= nF; j++) {
        const ang = c.ang + i * dA * graus, f = c.f + j * dF;
        if (f < 0.35 || f > 1.08) continue;
        const r = encaixe(g, P[nivel], ang, escDe(f, nivel), { tx: Math.round(c.tx * k), ty: Math.round(c.ty * k), r: Math.ceil(k) + 2 });
        if (!melhor || r.nota > melhor.nota) melhor = { ang, f, ...r };
      }
      if (melhor) novos.push(melhor);
    }
    cands = novos.sort((a, b) => b.nota - a.nota).slice(0, nivel === 1 ? 2 : 1);
  }
  const m = cands[0];
  if (!m || m.nota < 0.4) return null;
  const c = Math.max(W, H) / NIVEIS[2][0], esc = escDe(m.f, 2), co = Math.cos(m.ang), si = Math.sin(m.ang);
  return [[0, 0], [LARG, 0], [LARG, ALT], [0, ALT]].map(([X, Y]) => [((X * co - Y * si) * esc + m.tx + 0.5) * c, ((X * si + Y * co) * esc + m.ty + 0.5) * c]);
}

export function endireitar(src, W, H, cantos) {
  const h = homografia([[0, 0], [LARG, 0], [LARG, ALT], [0, ALT]], cantos); // do modelo para a foto
  const out = new ImageData(W_AL, H_AL), d = out.data;
  for (let Y = 0; Y < H_AL; Y++) {
    const yq = Y - OY;
    for (let X = 0; X < W_AL; X++) {
      const xq = X - OX, z = h[6] * xq + h[7] * yq + 1;
      const fx = (h[0] * xq + h[1] * yq + h[2]) / z, fy = (h[3] * xq + h[4] * yq + h[5]) / z;
      const o = (Y * W_AL + X) * 4;
      if (fx < 0 || fy < 0 || fx >= W - 1 || fy >= H - 1) { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255; continue; }
      const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, p = (y0 * W + x0) * 4, q = p + W * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[p + c] * (1 - ax) + src[p + 4 + c] * ax, bot = src[q + c] * (1 - ax) + src[q + 4 + c] * ax;
        d[o + c] = top * (1 - ay) + bot * ay;
      }
      d[o + 3] = 255;
    }
  }
  return out;
}

// O alto da ficha (29/10/2026, pedido do Alediov): horário, cor e clínica são escritos da linha da Clínica PARA CIMA e
// muitas vezes passam do quadro impresso (só não passam da foto). O quadro endireitado guarda só 110 px acima dele;
// este pedaço vai da linha da Clínica até a borda de cima da foto (no máximo 1.000 px acima do quadro).
export const ZONA_TOPO = [-40, -1000, 2040, 300];
/** O alto da ficha, endireitado pela mesma homografia, cortado onde a foto acaba: um canvas, ou null. */
export function topoDaFoto(src, W, H, cantos, [x0, y0, x1, y1] = ZONA_TOPO) {
  const h = homografia([[0, 0], [LARG, 0], [LARG, ALT], [0, ALT]], cantos);
  const w = x1 - x0, alt = y1 - y0, out = new ImageData(w, alt), d = out.data;
  let primeira = -1;
  for (let Y = 0; Y < alt; Y++) {
    const yq = Y + y0;
    let algum = false;
    for (let X = 0; X < w; X++) {
      const xq = X + x0, z = h[6] * xq + h[7] * yq + 1;
      const fx = (h[0] * xq + h[1] * yq + h[2]) / z, fy = (h[3] * xq + h[4] * yq + h[5]) / z;
      const o = (Y * w + X) * 4;
      d[o + 3] = 255;
      if (z <= 0 || fx < 0 || fy < 0 || fx >= W - 1 || fy >= H - 1) { d[o] = d[o + 1] = d[o + 2] = 255; continue; }
      algum = true;
      const xi = fx | 0, yi = fy | 0, ax = fx - xi, ay = fy - yi, p = (yi * W + xi) * 4, q = p + W * 4;
      for (let c = 0; c < 3; c++) d[o + c] = (src[p + c] * (1 - ax) + src[p + 4 + c] * ax) * (1 - ay) + (src[q + c] * (1 - ax) + src[q + 4 + c] * ax) * ay;
    }
    if (algum && primeira < 0) primeira = Y;
  }
  if (primeira < 0) return null;
  const topo = Math.max(0, primeira - 4), c = novoCanvas(w, alt - topo);
  c.getContext("2d").putImageData(out, 0, -topo);
  return c;
}
export const topoJpeg = (canvas) => jpeg(canvas, 0.88);

/** Lê o arquivo de imagem e devolve a ficha endireitada (ImageData 2080×1630), o modo da impressão e a qualidade. */
async function lerPixels(arquivo) {
  const bmp = await createImageBitmap(arquivo);
  const esc = Math.min(1, 3000 / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * esc), H = Math.round(bmp.height * esc);
  const cv = novoCanvas(W, H), cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0, W, H); bmp.close?.();
  return { src: cx.getImageData(0, 0, W, H).data, W, H };
}
// mínimo para uma ficha com os cantos postos à mão: abaixo disso, a impressão não está onde deveria
export const ALINHAMENTO_MANUAL = 0.5;
/** Palpite dos cantos do quadro para o ajuste à mão: { cantos, W, H } (na foto reduzida a 3000 px). */
export async function palpiteCantos(arquivo) {
  const { src, W, H } = await lerPixels(arquivo);
  let melhor = null;
  for (const modo of ["azul", "preto"]) {
    try {
      const c = cantosDoQuadro(mascaraImpressa(src, W * H, modo), W, H), q = qualidadeAlinhamento(endireitar(src, W, H, c), modo);
      if (!melhor || q > melhor.q) melhor = { c, q };
    } catch { /* sem quadro neste modo */ }
  }
  if (!melhor || melhor.q < 0.5) { const r = registrarModelo(src, W, H); if (r) melhor = { c: r, q: 0.5 }; }
  const m = 0.08;
  return { W, H, cantos: melhor?.c || [[W * m, H * m], [W * (1 - m), H * m], [W * (1 - m), H * (1 - m)], [W * m, H * (1 - m)]] };
}

/** Endireita com os cantos postos à mão (coordenadas da foto reduzida a 3000 px, como em palpiteCantos). */
async function alinharComCantos(arquivo, cantos, opcoes = {}) {
  const { src, W, H } = await lerPixels(arquivo);
  let melhor = null;
  for (const modo of ["azul", "preto"]) {
    for (const c of [cantos, ajustarCantos(src, W, H, cantos, modo)]) {
      const img = endireitar(src, W, H, c), qualidade = qualidadeAlinhamento(img, modo);
      if (!melhor || qualidade > melhor.qualidade) melhor = { img, cantos: c, modo, qualidade };
    }
  }
  if (melhor.qualidade < ALINHAMENTO_MANUAL) throw new Error(`A ficha ainda não bateu com o modelo (${Math.round(melhor.qualidade * 100)}%). Confira se cada número está no canto certo do quadro.`);
  melhor.duvidoso = melhor.qualidade < ALINHAMENTO_MINIMO;
  melhor.manual = true;
  if (opcoes.topo) melhor.topo = topoDaFoto(src, W, H, melhor.cantos);
  return melhor;
}

export async function alinharFoto(arquivo, opcoes = {}) {
  if (opcoes.cantos) return alinharComCantos(arquivo, opcoes.cantos, opcoes);
  const { src, W, H } = await lerPixels(arquivo);
  let melhor = null;
  const tentar = (cantos, modo) => {
    const img = endireitar(src, W, H, cantos), qualidade = qualidadeAlinhamento(img, modo);
    if (!melhor || qualidade > melhor.qualidade) melhor = { img, cantos, modo, qualidade };
    return qualidade;
  };
  const bom = () => melhor && melhor.qualidade >= ALINHAMENTO_MINIMO;
  // 1) pelas bordas do quadro (o normal: rápido)
  const achados = [];
  for (const modo of ["azul", "preto"]) {
    let cantos;
    try { cantos = cantosDoQuadro(mascaraImpressa(src, W * H, modo), W, H); } catch { continue; }
    achados.push([cantos, modo, tentar(cantos, modo)]);
    if (bom()) break;
  }
  // 2) nota baixa, mas perto: ajusta os cantos pela impressão (ex.: uma anotação puxou um canto)
  if (!bom()) for (const [cantos, modo, q] of achados.filter(x => x[2] >= 0.3).sort((x, y) => y[2] - x[2])) {
    tentar(ajustarCantos(src, W, H, cantos, modo), modo);
    if (bom()) break;
  }
  // 3) ainda não: a foto pode estar torta, de lado ou de ponta-cabeça; procura o modelo inteiro na foto
  if (!bom()) {
    const cantos = registrarModelo(src, W, H);
    if (cantos) {
      const qs = ["azul", "preto"].map(modo => [modo, tentar(cantos, modo)]).sort((x, y) => y[1] - x[1]);
      if (!bom() && qs[0][1] >= 0.3) tentar(ajustarCantos(src, W, H, cantos, qs[0][0]), qs[0][0]);
    }
  }
  if (!melhor) throw new Error("Não achei o quadro da ficha.");
  // abaixo do mínimo, mas com algum quadro achado: segue como "duvidosa" e só vai para a leitura se você aprovar a cópia
  if (melhor.qualidade < ALINHAMENTO_DUVIDOSO) throw new Error(`O quadro não ficou alinhado (${Math.round(melhor.qualidade * 100)}%): a foto parece cortada ou muito torta.`);
  melhor.duvidoso = melhor.qualidade < ALINHAMENTO_MINIMO;
  if (opcoes.topo) melhor.topo = topoDaFoto(src, W, H, melhor.cantos);
  return melhor;
}

export function novoCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
}

// ---------------- caixas de dígitos ----------------
/** Desloca a fileira de caixas (até ±10 px) para casar com as bordas impressas da própria foto. */
export function refinar(imp, caixas, raio = 10) {
  let melhor = [0, 0], best = -1;
  for (let dy = -raio; dy <= raio; dy += 2) for (let dx = -raio; dx <= raio; dx += 2) {
    let s = 0;
    for (const [x, y, w, h] of caixas) {
      const X = x + OX + dx, Y = y + OY + dy;
      for (let k = 0; k < w; k++) s += imp[Y * W_AL + X + k] + imp[(Y + h) * W_AL + X + k];
      for (let k = 0; k < h; k++) s += imp[(Y + k) * W_AL + X] + imp[(Y + k) * W_AL + X + w];
    }
    if (s > best) { best = s; melhor = [dx, dy]; }
  }
  return caixas.map(([x, y, w, h]) => [x + melhor[0], y + melhor[1], w, h]);
}

function rotular(m, w, h) { // componentes 4-conectados
  const lab = new Int32Array(w * h); let n = 0; const tam = [0];
  const pilha = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i]) continue;
    n++; let s = 0; pilha.push(i); lab[i] = n;
    while (pilha.length) {
      const p = pilha.pop(); s++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = n; pilha.push(p - 1); }
      if (x < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = n; pilha.push(p + 1); }
      if (y > 0 && m[p - w] && !lab[p - w]) { lab[p - w] = n; pilha.push(p - w); }
      if (y < h - 1 && m[p + w] && !lab[p + w]) { lab[p + w] = n; pilha.push(p + w); }
    }
    tam.push(s);
  }
  return { lab, n, tam };
}

const INSET = -4;
/** Tinta da caneta dentro de uma caixa (com 4 px de folga para fora). Devolve a máscara e o nº de pixels. */
export function celula(img, [x, y, w, h]) {
  const X0 = x + OX + INSET, Y0 = y + OY + INSET, cw = w - 2 * INSET, ch = h - 2 * INSET, d = img.data;
  const m = new Uint8Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const o = ((Y0 + j) * W_AL + X0 + i) * 4, R = d[o], G = d[o + 1], B = d[o + 2], lum = (R + G + B) / 3;
    const roxa = G - R < 35 && B - R > 25 && lum < 205, preta = lum < 110;
    const forca = Math.min(1, Math.max(0, (215 - lum) / 120));
    m[j * cw + i] = (roxa || preta) && forca > 0.15 ? 1 : 0;
  }
  const E = 12;
  for (let j = 0; j < ch; j++) if (j < E || j >= ch - E) {
    let s = 0; for (let i = 0; i < cw; i++) s += m[j * cw + i];
    if (s / cw > .5) for (let i = 0; i < cw; i++) m[j * cw + i] = 0;
  }
  for (let i = 0; i < cw; i++) if (i < E || i >= cw - E) {
    let s = 0; for (let j = 0; j < ch; j++) s += m[j * cw + i];
    if (s / ch > .5) for (let j = 0; j < ch; j++) m[j * cw + i] = 0;
  }
  let { lab, n, tam } = rotular(m, cw, ch);
  for (let i = 0; i < m.length; i++) if (m[i] && tam[lab[i]] < 6) m[i] = 0;
  ({ lab, n, tam } = rotular(m, cw, ch));
  const sx = new Float64Array(n + 1), sy = new Float64Array(n + 1);
  for (let i = 0; i < m.length; i++) if (m[i]) { sx[lab[i]] += i % cw; sy[lab[i]] += (i / cw) | 0; }
  for (let k = 1; k <= n; k++) {
    const cx = sx[k] / tam[k], cy = sy[k] / tam[k];
    const fora = cy < 5 || cy > ch - 6 || cx < 5 || cx > cw - 6;
    if (fora && tam[k] < 60) for (let i = 0; i < m.length; i++) if (lab[i] === k) m[i] = 0;
  }
  let px = 0; for (const v of m) px += v;
  return { m, w: cw, h: ch, px };
}

/** Normaliza o dígito como no MNIST: traço uniforme, caixa de 20 px, centro de massa no meio de 28×28. */
export function para28({ m, w, h }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (m[j * w + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  const out = new Float32Array(28 * 28);
  if (x1 < 0) return out;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // dilatação em cruz dentro da caixa do dígito
  const b = new Float32Array(bw * bh);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const v = (a, c) => a >= 0 && c >= 0 && a < bw && c < bh && m[(y0 + c) * w + x0 + a];
    b[j * bw + i] = (v(i, j) || v(i - 1, j) || v(i + 1, j) || v(i, j - 1) || v(i, j + 1)) ? 1 : 0;
  }
  const s = 20 / Math.max(bw, bh), nw = Math.max(1, Math.round(bw * s)), nh = Math.max(1, Math.round(bh * s));
  const r = new Float32Array(nw * nh); // redução por média de área
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    const ax = i / s, bx = (i + 1) / s, ay = j / s, by = (j + 1) / s;
    let soma = 0, area = 0;
    for (let yy = Math.floor(ay); yy < Math.ceil(by); yy++) for (let xx = Math.floor(ax); xx < Math.ceil(bx); xx++) {
      if (xx >= bw || yy >= bh) continue;
      const fx = Math.min(bx, xx + 1) - Math.max(ax, xx), fy = Math.min(by, yy + 1) - Math.max(ay, yy);
      const f = fx * fy; soma += b[yy * bw + xx] * f; area += f;
    }
    r[j * nw + i] = Math.min(1, area ? soma / area * 1.4 : 0);
  }
  let sm = 0, cy = 0, cx = 0;
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) { const v = r[j * nw + i]; sm += v; cy += j * v; cx += i * v; }
  cy = sm ? cy / sm : nh / 2; cx = sm ? cx / sm : nw / 2;
  const oy = Math.min(Math.max(Math.round(14 - cy), 0), 28 - nh), ox = Math.min(Math.max(Math.round(14 - cx), 0), 28 - nw);
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) out[(oy + j) * 28 + ox + i] = r[j * nw + i];
  return out;
}

export function mascaraImpressaAlinhada(img, modo = "azul") { return mascaraImpressa(img.data, W_AL * H_AL, modo); }

// ---------------- recortes ----------------
function recortar(img, [x0, y0, x1, y1]) {
  const X0 = Math.max(0, x0 + OX), Y0 = Math.max(0, y0 + OY), X1 = Math.min(W_AL, x1 + OX), Y1 = Math.min(H_AL, y1 + OY);
  const c = novoCanvas(X1 - X0, Y1 - Y0);
  c.getContext("2d").putImageData(img, -X0, -Y0, X0, Y0, X1 - X0, Y1 - Y0);
  return c;
}
async function jpeg(canvas, q = .85) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: "image/jpeg", quality: q });
  return new Promise(ok => canvas.toBlob(ok, "image/jpeg", q));
}
/** Cópia sem identificação: só as zonas permitidas, no lugar original, sobre fundo branco. */
export async function copiaSemIdentificacao(img) {
  const c = novoCanvas(W_AL, H_AL), cx = c.getContext("2d");
  cx.fillStyle = "#fff"; cx.fillRect(0, 0, W_AL, H_AL);
  for (const z of Object.values(ZONAS_LEITURA)) {
    const X0 = Math.max(0, z[0] + OX), Y0 = Math.max(0, z[1] + OY), X1 = Math.min(W_AL, z[2] + OX), Y1 = Math.min(H_AL, z[3] + OY);
    cx.putImageData(img, 0, 0, X0, Y0, X1 - X0, Y1 - Y0);
  }
  return jpeg(c);
}
/** A ficha inteira, endireitada, COM a identificação (29/10/2026: no modo local a conferência é feita só no computador,
 *  com a ficha toda à vista). Fica só no banco deste computador: nunca vai para a leitura nem para o GitHub. */
export async function imagemInteira(img, q = 0.85) {
  const c = novoCanvas(W_AL, H_AL);
  c.getContext("2d").putImageData(img, 0, 0);
  return jpeg(c, q);
}
export const recorteJpeg = (img, zona, q) => jpeg(recortar(img, zona), q);
