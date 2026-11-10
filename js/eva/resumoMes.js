// O resumo do mês da Eva (pedido do Alediov, 05/11/2026: "ao final do mês, ela mande uma imagem resumindo as principais
// estatísticas do mês"): na 1ª abertura de um mês novo, ela manda no chat um cartão 1080×1920 (formato dos stories,
// como musicas/retroImagem.js) com o mês que passou: Estudos (XP, lições, dias estudados, a maior sequência, acerto),
// leitura, xadrez, foco, simulados corrigidos e as Músicas (horas, a música e o artista do mês). NADA do humor dele,
// das Finanças (valores), do Scanner/IC, do Cofre ou do WhatsApp: a imagem pode ser compartilhada.
// Os números (pequenos) ficam em E().eva.meses["AAAA-MM"] { …, em } e sincronizam; o PNG nunca vai para E(): é
// redesenhado quando precisa (cache só na memória). `calcularMes` e `diasDoMes` são puros (node tools/teste_eva.mjs).
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (mes, { ano = true } = {}) => { const [a, m] = mes.split("-").map(Number); const n = MESES[m - 1]; return ano ? `${n[0].toUpperCase()}${n.slice(1)} de ${a}` : n; };
export const mesDe = (iso) => String(iso).slice(0, 7);
export function mesAnterior(mes, n = 1) { const [a, m] = mes.split("-").map(Number); const d = new Date(a, m - 1 - n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
/** Os dias do mês "AAAA-MM" (AAAA-MM-DD). */
export function diasDoMes(mes) {
  const [a, m] = mes.split("-").map(Number), n = new Date(a, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}
const ehUnidade = (id) => /^[a-z]\d\d-\d\d$/.test(id);

/**
 * Os números do mês, pelo estado do app `e` (E()). o: { sims: [notas], musica: { min, titulo, artista, artistaTop } }.
 * Puro. → { mes, xp, licoes, dias, seqMax, acerto, questoes, melhorDia, leituraUn, leituraMin, xadrezMin, partidas,
 *   desafios, focoMin, sims: { n, media }, musica }
 */
export function calcularMes(e, mes, o = {}) {
  const ds = diasDoMes(mes);
  let xp = 0, licoes = 0, dias = 0, n = 0, certas = 0, leituraSeg = 0, xadrezSeg = 0, focoMin = 0, seq = 0, seqMax = 0, melhor = null;
  for (const d of ds) {
    const di = e.diario?.[d], l = di?.licoes?.length || 0, x = di?.xp || 0;
    xp += x; licoes += l;
    if (l > 0 || x > 0) { dias++; seq++; seqMax = Math.max(seqMax, seq); } else seq = 0;
    if (x > 0 && (!melhor || x > melhor.xp)) melhor = { d, xp: x };
    for (const r of e.respostas?.[d] || []) if (r.tentativa === 1) { n++; if (r.acertou) certas++; }
    leituraSeg += e.leitura?.dias?.[d] || 0;
    xadrezSeg += e.xadrez?.dias?.[d] || 0;
    focoMin += e.foco?.dias?.[d] || 0;
  }
  const leituraUn = Object.entries(e.leitura?.lidas || {}).filter(([id, d]) => ehUnidade(id) && typeof d === "string" && d.startsWith(mes)).length;
  const x = e.xadrez || {};
  const partidas = [...(x.partidas || []), ...(x.amigo?.partidas || []), ...(x.quatro?.partidas || [])].filter(p => String(p?.data || "").startsWith(mes)).length;
  const desafios = Object.entries(x.desafiosDia || {}).filter(([d, v]) => d.startsWith(mes) && v?.feito).length;
  const sims = (o.sims || []).filter(v => typeof v === "number");
  return {
    mes, xp, licoes, dias, diasNoMes: ds.length, seqMax, acerto: n ? Math.round((certas / n) * 100) / 100 : null, questoes: n, melhorDia: melhor,
    leituraUn, leituraMin: Math.round(leituraSeg / 60), xadrezMin: Math.round(xadrezSeg / 60), partidas, desafios, focoMin: Math.round(focoMin),
    sims: { n: sims.length, media: sims.length ? Math.round((sims.reduce((a, b) => a + b, 0) / sims.length) * 10) / 10 : null },
    musica: o.musica || null,
  };
}
/** O mês teve alguma coisa para mostrar? */
export const temDados = (r) => !!r && (r.xp > 0 || r.licoes > 0 || r.leituraUn > 0 || r.partidas > 0 || r.focoMin > 0 || (r.musica?.min || 0) > 0);

// ---------------------------------------------------------------- no app
/** Calcula o mês lendo o app (simulados corrigidos e as Músicas deste aparelho). */
export async function montarMes(mes) {
  const ES = await import("../estado.js"), e = ES.E();
  const sims = [];
  try {
    const { extra } = await import("../dados.js");
    for (const d of diasDoMes(mes)) { const c = await extra(`cor:${d}`).catch(() => null); if (c?.nota != null) sims.push(c.nota); }
  } catch { /* sem simulados */ }
  let musica = null;
  try {
    const R = await import("../musicas/retrospectiva.js");
    const r = await R.resumoDoMes(mes);
    if (r) musica = { min: Math.round(r.tempo / 60000), titulo: r.musicas[0]?.faixa?.titulo || null, artista: r.musicas[0]?.faixa?.artista || null, id: r.musicas[0]?.faixa?.id || null, artistaTop: r.artistas[0]?.nome || null };
  } catch { /* sem as Músicas neste aparelho */ }
  return calcularMes(e, mes, { sims, musica });
}

// ---------------------------------------------------------------- a imagem
const W = 1080, H = 1920;
const DISP = `"Bricolage", "Trebuchet MS", sans-serif`, TXT = `"Lexend", system-ui, sans-serif`;
const num = (n) => Math.round(n || 0).toLocaleString("pt-BR");
const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""}` : `${min} min`);
/** Os quadros da imagem (e da retrospectiva): [rótulo, valor, detalhe]. Só o que teve. */
export function quadrosDoMes(r) {
  const q = [];
  if (r.seqMax) q.push(["Maior sequência", `${r.seqMax} ${r.seqMax === 1 ? "dia" : "dias"}`, "estudando seguido"]);
  if (r.acerto != null) q.push(["Acerto", `${Math.round(r.acerto * 100)}%`, `${num(r.questoes)} questões de primeira`]);
  if (r.leituraUn || r.leituraMin) q.push(["Leitura", r.leituraUn ? `${r.leituraUn} ${r.leituraUn === 1 ? "unidade" : "unidades"}` : horas(r.leituraMin), r.leituraMin ? `${horas(r.leituraMin)} lendo` : ""]);
  if (r.partidas || r.desafios || r.xadrezMin) q.push(["Xadrez", r.partidas ? `${r.partidas} ${r.partidas === 1 ? "partida" : "partidas"}` : r.desafios ? `${r.desafios} desafios` : horas(r.xadrezMin),
    r.partidas && r.desafios ? `${r.desafios} desafios do dia` : r.xadrezMin && (r.partidas || r.desafios) ? `${horas(r.xadrezMin)} treinando` : ""]);
  if (r.focoMin) q.push(["Modo foco", horas(r.focoMin), "concentrado"]);
  if (r.sims?.n) q.push(["Cadernos", `${r.sims.n} ${r.sims.n === 1 ? "corrigido" : "corrigidos"}`, r.sims.media != null ? `média ${String(r.sims.media).replace(".", ",")}` : ""]);
  if (r.musica?.min) q.push(["Músicas", horas(r.musica.min), r.musica.artistaTop ? `mais ${r.musica.artistaTop}` : "ouvindo"]);
  return q;
}
function arredondado(g, x, y, w, h, rr) { g.beginPath(); g.roundRect(x, y, w, h, rr); }
function caber(g, t, max) {
  t = String(t || ""); if (g.measureText(t).width <= max) return t;
  while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
async function imagem(url) {
  if (!url) return null;
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = url;
  try { await img.decode(); return img; } catch { return null; }
}
/** A Eva (SVG vetorial) como imagem para o canvas, no tamanho em que vai ser desenhada. */
export async function evaComoImagem(humor = "orgulhosa", lado = 360) {
  try {
    const { eva } = await import("../arte/eva.js");
    let svg = eva({ humor, capuz: false });
    svg = svg.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${lado}" height="${lado}" `);
    return await imagem(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  } catch { return null; }
}
async function fundo(g) {
  const lin = g.createLinearGradient(0, 0, W * 0.5, H);
  lin.addColorStop(0, "#2A1466"); lin.addColorStop(0.5, "#4C1D95"); lin.addColorStop(1, "#140A33");
  g.fillStyle = lin; g.fillRect(0, 0, W, H);
  for (const [x, y, rr, cor, al] of [[W * 0.92, H * 0.1, 640, "169,139,250", 0.45], [W * 0.05, H * 0.6, 700, "240,123,176", 0.22], [W * 0.8, H * 0.96, 560, "127,214,245", 0.25]]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, rr);
    rg.addColorStop(0, `rgba(${cor},${al})`); rg.addColorStop(1, `rgba(${cor},0)`);
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  // estrelinhas
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 2.6, 0, Math.PI * 2); g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.5})`; g.fill(); }
}
function rodape(g) {
  g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 30px ${TXT}`; g.textAlign = "center";
  const t = "Órbita · com a Eva"; g.fillText(t, W / 2, H - 70);
  const x = W / 2 - g.measureText(t).width / 2 - 44, y = H - 80;
  g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
  g.beginPath(); g.ellipse(x, y, 26, 8, -0.4, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3; g.stroke();
  g.textAlign = "left";
}

/** O cartão do mês `r` (calcularMes) como PNG (Blob). o.capa: a capa da música do mês (data URL), se houver. */
export async function imagemDoMes(r, o = {}) {
  await document.fonts?.ready;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  await fundo(g);
  g.fillStyle = "rgba(255,255,255,.8)"; g.font = `700 34px ${TXT}`; g.fillText("MEU MÊS NO ÓRBITA", 96, 150);
  g.fillStyle = "#fff"; g.font = `800 96px ${DISP}`; g.fillText(caber(g, nomeMes(r.mes).split(" de ")[0], 560), 96, 252);
  g.fillStyle = "rgba(255,255,255,.75)"; g.font = `700 44px ${TXT}`; g.fillText(r.mes.slice(0, 4), 100, 312);
  const ev = await evaComoImagem("orgulhosa", 300);
  if (ev) {
    g.save(); g.beginPath(); g.arc(W - 96 - 150, 230, 150, 0, Math.PI * 2); g.fillStyle = "#ECE5FF"; g.fill(); g.clip();
    g.drawImage(ev, W - 96 - 300, 80, 300, 300); g.restore();
    g.beginPath(); g.arc(W - 96 - 150, 230, 150, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 8; g.stroke();
  }
  // o principal: XP e lições
  g.fillStyle = "rgba(255,255,255,.8)"; g.font = `600 36px ${TXT}`; g.fillText("Nos Estudos", 96, 470);
  g.fillStyle = "#fff"; g.font = `800 150px ${DISP}`; g.fillText(`${num(r.xp)} XP`, 88, 612);
  g.fillStyle = "rgba(255,255,255,.85)"; g.font = `500 36px ${TXT}`;
  g.fillText(`${num(r.licoes)} ${r.licoes === 1 ? "lição" : "lições"} · ${r.dias} de ${r.diasNoMes || 30} dias estudados`, 96, 676);
  // a barra dos dias
  const bx = 96, by = 712, bw = W - 192, bh = 22;
  arredondado(g, bx, by, bw, bh, 11); g.fillStyle = "rgba(255,255,255,.16)"; g.fill();
  arredondado(g, bx, by, Math.max(bh, bw * Math.min(1, r.dias / (r.diasNoMes || 30))), bh, 11);
  const gb = g.createLinearGradient(bx, 0, bx + bw, 0); gb.addColorStop(0, "#FFE08A"); gb.addColorStop(1, "#F07BB0"); g.fillStyle = gb; g.fill();
  // os quadros
  const qs = quadrosDoMes(r).filter(q => q[0] !== "Músicas" || !r.musica?.titulo).slice(0, 6);
  let y = 790;
  qs.forEach(([a, v, d], i) => {
    const x = 96 + (i % 2) * 454, yy = y + Math.floor(i / 2) * 190;
    arredondado(g, x, yy, 434, 170, 30); g.fillStyle = "rgba(255,255,255,.12)"; g.fill();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 26px ${TXT}`; g.fillText(a.toUpperCase(), x + 30, yy + 48);
    g.fillStyle = "#fff"; g.font = `800 50px ${DISP}`; g.fillText(caber(g, v, 380), x + 30, yy + 110);
    if (d) { g.fillStyle = "rgba(255,255,255,.7)"; g.font = `500 26px ${TXT}`; g.fillText(caber(g, d, 380), x + 30, yy + 148); }
  });
  y += Math.ceil(qs.length / 2) * 190 + 20;
  // a música do mês
  if (r.musica?.titulo && y < H - 380) {
    arredondado(g, 96, y, W - 192, 230, 36); g.fillStyle = "rgba(255,255,255,.14)"; g.fill();
    const img = await imagem(o.capa);
    g.save(); arredondado(g, 126, y + 30, 170, 170, 24); g.clip();
    if (img) g.drawImage(img, 126, y + 30, 170, 170); else { g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(126, y + 30, 170, 170); g.fillStyle = "#fff"; g.font = `120px ${DISP}`; g.textAlign = "center"; g.fillText("♪", 211, y + 160); g.textAlign = "left"; }
    g.restore();
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = `700 26px ${TXT}`; g.fillText("MÚSICA DO MÊS", 330, y + 70);
    g.fillStyle = "#fff"; g.font = `800 46px ${DISP}`; g.fillText(caber(g, r.musica.titulo, W - 192 - 270), 330, y + 126);
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = `500 30px ${TXT}`; g.fillText(caber(g, `${r.musica.artista || ""} · ${horas(r.musica.min)} de música no mês`, W - 192 - 270), 330, y + 174);
  }
  rodape(g);
  return new Promise(ok => c.toBlob(ok, "image/png"));
}

// imagens já desenhadas nesta sessão (mês → { url, blob, chave })
const feitas = new Map();
/** A URL (blob:) da imagem do mês, desenhada uma vez por sessão (de novo se os números mudarem). */
export async function urlDoMes(r) {
  const chave = JSON.stringify(r), f = feitas.get(r.mes);
  if (f?.chave === chave) return f;
  let capa = "";
  if (r.musica?.id) try { const MD = await import("./musicaDia.js"); capa = await MD.capa(r.musica.id); } catch { capa = ""; }
  const blob = await imagemDoMes(r, { capa });
  if (f?.url) URL.revokeObjectURL(f.url);
  const novo = { url: URL.createObjectURL(blob), blob, chave };
  feitas.set(r.mes, novo);
  return novo;
}

/** Salva o PNG: no Android, na pasta Documentos/Órbita (senão, o compartilhar); no navegador, baixa. */
export async function salvarImagem(blob, nome) {
  const { Capacitor, registerPlugin } = await import("../../vendor/capacitor-core.js");
  if (Capacitor.isNativePlatform?.()) {
    const Filesystem = registerPlugin("Filesystem");
    const b64 = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    try { await Filesystem.writeFile({ path: `Orbita/${nome}`, data: b64, directory: "DOCUMENTS", recursive: true }); return "salvo"; }
    catch { const R = await import("../musicas/retroImagem.js"); await R.compartilharImagem(blob, nome); return "compartilhado"; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
  return "baixado";
}
