// A ficha dividida em pedaços para a leitura LOCAL (29/10/2026, pedido do Alediov: "divida ao máximo possível, sem
// comprometer a leitura… quero garantir a qualidade máxima, mesmo que o tempo seja maior"). Um modelo de visão pequeno
// (8B) lê melhor uma imagem pequena e focada do que a ficha inteira: cada pedaço vai num pedido próprio, ampliado, com
// um prompt só daquele campo (prompt.md, seções PARTE_*), e o leitor.py junta as respostas no mesmo formato de antes.
//   cabecalho   da linha da Clínica PARA CIMA, até a borda da foto (imgTopo; horário, cor e clínica muitas vezes são
//               escritos acima do quadro impresso, pedido do Alediov); sem o imgTopo, só os 110 px acima do quadro
//   data        o campo Data, ampliado
//   tipo        os quadradinhos 01 (urgência), 02 (1ª consulta) e 03 (retorno)
//   nascimento  a faixa vertical do DN e do sexo, GIRADA para ficar na horizontal, e o campo Idade embaixo
//   endereco    os campos Endereço e Município
//   proc-NN     cada linha da tabela de procedimentos sozinha (dente + código); só até a última linha com escrita, mais uma
//   num-<campo> cada número de identificação sozinho (prontuário, RA, CPF, CNS), quando ainda faltam conferir
// Segunda leitura (29/10/2026, sugestão aceita pelo Alediov): os campos críticos (cada linha dos procedimentos, a data e
// o nascimento) vão também numa 2ª versão (`segunda`: maior e com o contraste realçado, em tons de cinza); o leitor lê as
// duas e, quando discordam, a diferença vira dúvida no Conferir.
// As medidas (no quadro da ficha endireitada, como em visao.js) estão em GEO_PARTES, num JSON que o
// tools/odontoscan/local/gerar_exemplo.py também lê, para o exemplo fictício sair igual.
import { W_AL, H_AL, OX, OY, ZONA_ENDERECO, FAIXAS_NUMEROS, novoCanvas, tintaNaZona } from "./visao.js";

export const VERSAO_PARTES = 3; // 3: a 2ª versão dos campos críticos (segunda leitura)
export const GEO_PARTES = {
  "cabecalho": { "zona": [-40, -110, 2040, 300], "escala": 1 },
  "data": { "zona": [1440, 205, 2040, 318], "escala": 2.2 },
  "tipo": { "zona": [-40, 425, 205, 880], "escala": 2 },
  "nascimento": { "zona": [-40, 880, 205, 1480], "girar": 90, "escala": 1.8 },
  "idade": { "zona": [880, 585, 1192, 700], "escala": 1.8 },
  "endereco": { "zona": [196, 985, 1192, 1250], "escala": 1.3 },
  "linhas": [[362, 418], [458, 510], [550, 606], [646, 698], [738, 794], [830, 886], [926, 982], [1022, 1074], [1114, 1170], [1206, 1262], [1302, 1358], [1398, 1450]],
  "linhaX": [1180, 2040], "linhaMargem": 22, "linhaEscala": 1.6,
  "numeroEscala": 2,
  "limiarLinha": 0.004
};
const ROTULOS_NUM = { prontuario: "PRONTUÁRIO", aluno: "RA DO ALUNO", cpf: "CPF", cns: "CNS" };

const jpeg = (cv, q = 0.92) => cv.convertToBlob ? cv.convertToBlob({ type: "image/jpeg", quality: q }) : new Promise(ok => cv.toBlob(ok, "image/jpeg", q));
const branco = (w, h) => { const c = novoCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))), x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); return c; };

/** O quadro inteiro (2080×1630): da ficha inteira, se houver, senão da cópia com o recorte do endereço no lugar dele. */
async function quadro(f) {
  const c = branco(W_AL, H_AL), x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  const base = f.imgInteira instanceof Blob ? f.imgInteira : f.imgFicha;
  if (!(base instanceof Blob)) throw new Error("a cópia da ficha não está no computador");
  const b = await createImageBitmap(base); x.drawImage(b, 0, 0, W_AL, H_AL); b.close?.();
  if (!(f.imgInteira instanceof Blob) && f.imgEndereco instanceof Blob) {
    const [x0, y0, x1, y1] = ZONA_ENDERECO, e = await createImageBitmap(f.imgEndereco);
    x.drawImage(e, x0 + OX, y0 + OY, x1 - x0, y1 - y0); e.close?.();
  }
  return c;
}
/** Um pedaço do quadro, ampliado (e girado 90° no sentido horário, se pedir). */
function pedaco(q, [x0, y0, x1, y1], escala = 1, girar = 0) {
  const X0 = Math.max(0, x0 + OX), Y0 = Math.max(0, y0 + OY), X1 = Math.min(W_AL, x1 + OX), Y1 = Math.min(H_AL, y1 + OY);
  const w = (X1 - X0) * escala, h = (Y1 - Y0) * escala;
  const c = girar ? branco(h, w) : branco(w, h), x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  if (girar) { x.translate(h, 0); x.rotate(Math.PI / 2); }
  x.drawImage(q, X0, Y0, X1 - X0, Y1 - Y0, 0, 0, w, h);
  return c;
}
/** A 2ª versão de um pedaço para a segunda leitura: 25% maior, em tons de cinza e com o contraste esticado
 *  (o mais claro vira branco e o mais escuro, preto: caneta fraca fica mais legível). */
function realce(cv) {
  const w = Math.round(cv.width * 1.25), h = Math.round(cv.height * 1.25), out = branco(w, h), x = out.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(cv, 0, 0, w, h);
  const img = x.getImageData(0, 0, w, h), d = img.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = l; hist[l]++; }
  const n = w * h; let a = 0, b = 255, acc = 0;
  for (; a < 255 && (acc += hist[a]) < n * 0.01; a++);
  acc = 0;
  for (; b > 0 && (acc += hist[b]) < n * 0.02; b--);
  const k = 255 / Math.max(20, b - a);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] - a) * k)); d[i] = d[i + 1] = d[i + 2] = v; }
  x.putImageData(img, 0, 0);
  return out;
}

/** Pedaços um embaixo do outro, cada um com o nome à esquerda (como os números antes). */
function empilhar(itens) {
  const ROT = 300, M = 16, W = ROT + Math.max(...itens.map(([, c]) => c.width)) + 2 * M, H = itens.reduce((s, [, c]) => s + c.height + M, M);
  const out = branco(W, H), x = out.getContext("2d");
  x.fillStyle = "#000"; x.font = "bold 30px sans-serif"; x.textBaseline = "middle";
  let y = M;
  for (const [rot, c] of itens) {
    rot.split("\n").forEach((l, i, ls) => x.fillText(l, M, y + c.height / 2 + (i - (ls.length - 1) / 2) * 34));
    x.drawImage(c, ROT, y); x.strokeStyle = "#999"; x.strokeRect(ROT - 0.5, y - 0.5, c.width + 1, c.height + 1);
    y += c.height + M;
  }
  return out;
}

/** Quais linhas da tabela de procedimentos vão para a leitura: até a última com escrita, mais uma (no mínimo a 1ª). */
export function linhasParaLer(tintas, limiar = GEO_PARTES.limiarLinha) {
  let ult = -1;
  tintas.forEach((t, i) => { if (t >= limiar) ult = i; });
  return Array.from({ length: Math.min(tintas.length, Math.max(1, ult + 2)) }, (_, i) => i);
}

/**
 * Os pedaços de uma ficha para a fila local: [{ arq, parte, blob, linha?, campo? }] e as tintas das linhas (só números).
 * `f` já com as imagens (comImagens: ficha, endereco, inteira e, com `numeros`, os recortes).
 */
export async function partesDaFicha(f, { numeros = false } = {}) {
  const G = GEO_PARTES, q = await quadro(f), saida = [];
  const poe = async (arq, parte, cv, extra = {}) => saida.push({ arq, parte, blob: await jpeg(cv), ...extra });
  // com a 2ª versão (segunda leitura): o arquivo "-b" vai junto, no campo `segunda` do pedaço
  const poe2 = async (arq, parte, cv, extra = {}) => {
    const arqB = arq.replace(/\.jpg$/, "-b.jpg");
    saida.push({ arq, parte, blob: await jpeg(cv), segunda: arqB, ...extra });
    saida.push({ arq: arqB, parte, blob: await jpeg(realce(cv)), extra: true, ...extra });
  };
  if (f.imgTopo instanceof Blob) {
    const b = await createImageBitmap(f.imgTopo), c = branco(b.width, b.height);
    c.getContext("2d").drawImage(b, 0, 0); b.close?.();
    await poe("p-cabecalho.jpg", "cabecalho", c, { topo: true });
  } else await poe("p-cabecalho.jpg", "cabecalho", pedaco(q, G.cabecalho.zona, G.cabecalho.escala));
  await poe2("p-data.jpg", "data", pedaco(q, G.data.zona, G.data.escala));
  await poe("p-tipo.jpg", "tipo", pedaco(q, G.tipo.zona, G.tipo.escala));
  await poe2("p-nascimento.jpg", "nascimento", empilhar([
    ["DATA DE\nNASCIMENTO\nE SEXO", pedaco(q, G.nascimento.zona, G.nascimento.escala, G.nascimento.girar)],
    ["IDADE", pedaco(q, G.idade.zona, G.idade.escala)],
  ]));
  await poe("p-endereco.jpg", "endereco", pedaco(q, G.endereco.zona, G.endereco.escala));
  // as linhas dos procedimentos: só as que têm escrita (e uma a mais, por segurança)
  const img = q.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W_AL, H_AL);
  const [lx0, lx1] = G.linhaX, m = G.linhaMargem;
  const tintas = G.linhas.map(([y0, y1]) => tintaNaZona(img, [lx0 + 20, y0, lx1 - 20, y1]));
  for (const i of linhasParaLer(tintas)) {
    const [y0, y1] = G.linhas[i];
    await poe2(`p-proc-${String(i + 1).padStart(2, "0")}.jpg`, "procedimento", pedaco(q, [lx0, y0 - m, lx1, y1 + m], G.linhaEscala), { linha: i + 1 });
  }
  // os números de identificação, cada um sozinho (dos recortes; sem eles, da ficha inteira)
  if (numeros) for (const campo of Object.keys(ROTULOS_NUM)) {
    let cv = null;
    if (f.recortes?.[campo] instanceof Blob) {
      const b = await createImageBitmap(f.recortes[campo]);
      cv = branco(b.width * G.numeroEscala + 32, b.height * G.numeroEscala + 32);
      const x = cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(b, 16, 16, b.width * G.numeroEscala, b.height * G.numeroEscala); b.close?.();
    } else if (f.imgInteira instanceof Blob) cv = pedaco(q, FAIXAS_NUMEROS[campo], G.numeroEscala);
    if (cv) await poe(`p-num-${campo}.jpg`, "numero", cv, { campo });
  }
  return { partes: saida, tintas };
}
