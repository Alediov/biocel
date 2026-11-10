// Retrospectiva em imagem (pedido do Alediov, 25/10/2026): a retrospectiva do mês (resumoDoMes) vira um cartão
// 1080×1920 no formato dos stories, nas cores da capa da música do mês, para compartilhar (Android: Filesystem +
// Share; no navegador, baixa o PNG). Também desenha o "Neste dia" (o que ele ouviu na mesma data, anos antes).
import { capaDe } from "./biblioteca.js";
import { paletaDaImagem, css } from "./cores.js";
import { horasTexto } from "./retrospectiva.js";
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";

const W = 1080, H = 1920;
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DISP = `"Bricolage", "Trebuchet MS", sans-serif`, TXT = `"Lexend", system-ui, sans-serif`;

async function imagem(url) {
  if (!url) return null;
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = url;
  try { await img.decode(); return img; } catch { return null; }
}
function arredondado(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
/** Corta o texto com "…" para caber em `max` px. */
function caber(g, t, max) {
  t = String(t || "");
  if (g.measureText(t).width <= max) return t;
  while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
const escurecer = ([r, gg, b], k) => [r * k, gg * k, b * k].map(Math.round);

async function fundo(g, capaUrl) {
  let pal = null;
  try { if (capaUrl) pal = await paletaDaImagem(capaUrl); } catch { pal = null; }
  const a = pal ? escurecer(pal.dominante, 0.55) : [76, 29, 149], b = pal ? pal.viva : [255, 111, 177], c = pal ? pal.segunda : [124, 58, 237];
  const lin = g.createLinearGradient(0, 0, W * 0.4, H);
  lin.addColorStop(0, css(escurecer(b, 0.8))); lin.addColorStop(0.45, css(a)); lin.addColorStop(1, css(escurecer(a, 0.45)));
  g.fillStyle = lin; g.fillRect(0, 0, W, H);
  // manchas de luz nas cores da capa
  for (const [x, y, r, cor, al] of [[W * 0.9, H * 0.12, 620, c, 0.45], [W * 0.05, H * 0.62, 700, b, 0.3], [W * 0.75, H * 0.95, 560, c, 0.35]]) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, css(cor, al)); rg.addColorStop(1, css(cor, 0));
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  // bolhas do tubete, como no fundo das Músicas
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    const x = rnd() * W, y = rnd() * H, r = 8 + rnd() * 34;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,.22)"; g.fill();
  }
  return { b, c };
}
function rodape(g, texto) {
  g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 30px ${TXT}`; g.textAlign = "center";
  g.fillText(texto, W / 2, H - 70);
  // o planetinha do Órbita
  const x = W / 2 - g.measureText(texto).width / 2 - 44, y = H - 80;
  g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
  g.beginPath(); g.ellipse(x, y, 26, 8, -0.4, 0, Math.PI * 2); g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 3; g.stroke();
  g.textAlign = "left";
}
async function capaGrande(g, url, x, y, lado, cor) {
  const img = await imagem(url);
  g.save();
  g.shadowColor = css(cor, 0.55); g.shadowBlur = 80; g.shadowOffsetY = 24;
  arredondado(g, x, y, lado, lado, 44); g.fillStyle = "rgba(255,255,255,.14)"; g.fill();
  g.restore();
  g.save(); arredondado(g, x, y, lado, lado, 44); g.clip();
  if (img) g.drawImage(img, x, y, lado, lado);
  else { g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x, y, lado, lado); g.fillStyle = "rgba(255,255,255,.7)"; g.font = `200px ${DISP}`; g.textAlign = "center"; g.fillText("♪", x + lado / 2, y + lado * 0.68); g.textAlign = "left"; }
  g.restore();
}
async function linhaTop(g, i, f, n, y) {
  const img = await imagem(await capaDe(f, "mini"));
  g.fillStyle = "rgba(255,255,255,.9)"; g.font = `800 46px ${DISP}`; g.fillText(String(i + 1), 96, y + 62);
  g.save(); arredondado(g, 160, y, 96, 96, 18); g.clip();
  if (img) g.drawImage(img, 160, y, 96, 96); else { g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(160, y, 96, 96); }
  g.restore();
  g.fillStyle = "#fff"; g.font = `700 38px ${TXT}`; g.fillText(caber(g, f.titulo, 600), 284, y + 42);
  g.fillStyle = "rgba(255,255,255,.72)"; g.font = `500 30px ${TXT}`; g.fillText(caber(g, f.artista, 600), 284, y + 84);
  g.fillStyle = "rgba(255,255,255,.9)"; g.font = `700 34px ${TXT}`; g.textAlign = "right"; g.fillText(`${n}×`, W - 96, y + 62); g.textAlign = "left";
}
function tela() {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  return [c, c.getContext("2d")];
}
const paraBlob = (c) => new Promise(ok => c.toBlob(ok, "image/png"));

/** O cartão da retrospectiva do mês `r` (resumoDoMes) como PNG. */
export async function imagemDoMes(r) {
  await document.fonts?.ready;
  const [c, g] = tela();
  const top = r.musicas[0];
  const capaUrl = top ? await capaDe(top.faixa, "media") : "";
  const { b } = await fundo(g, capaUrl);
  g.fillStyle = "rgba(255,255,255,.8)"; g.font = `700 34px ${TXT}`;
  g.fillText("MINHA RETROSPECTIVA", 96, 150);
  g.fillStyle = "#fff"; g.font = `800 92px ${DISP}`; g.fillText(r.nome, 96, 250);
  // horas
  g.fillStyle = "rgba(255,255,255,.8)"; g.font = `600 36px ${TXT}`; g.fillText("Você ouviu", 96, 350);
  g.fillStyle = "#fff"; g.font = `800 150px ${DISP}`; g.fillText(horasTexto(r.tempo), 90, 490);
  g.fillStyle = "rgba(255,255,255,.82)"; g.font = `500 32px ${TXT}`;
  g.fillText(`${r.reproducoes} reproduções · ${r.distintas} músicas · ${r.diasOuvindo} dias · mais às ${SEMANA[r.semanaTop]}s`, 96, 548);
  // música do mês
  let y = 610;
  if (top) {
    await capaGrande(g, capaUrl, 96, y, 340, b);
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = `700 30px ${TXT}`; g.fillText("MÚSICA DO MÊS", 500, y + 70);
    g.fillStyle = "#fff"; g.font = `800 60px ${DISP}`;
    const tit = top.faixa.titulo || "";
    // até duas linhas para o título
    const pal = tit.split(" "); let l1 = "", k = 0;
    while (k < pal.length && g.measureText((l1 + " " + pal[k]).trim()).width <= 480) l1 = (l1 + " " + pal[k++]).trim();
    const l2 = pal.slice(k).join(" ");
    g.fillText(l1 || caber(g, tit, 480), 500, y + 145);
    if (l2) g.fillText(caber(g, l2, 480), 500, y + 212);
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = `500 34px ${TXT}`;
    g.fillText(caber(g, `${top.faixa.artista} · ${top.n}×`, 480), 500, y + (l2 ? 272 : 205));
    y += 390;
  }
  // quadros
  const quadros = [
    ["Artista do mês", r.artistas[0]?.nome || "—"],
    ["Horário favorito", `${r.horaTop}h–${(r.horaTop + 1) % 24}h`],
  ];
  quadros.forEach(([a, v], i) => {
    const x = 96 + (i % 2) * 454, yy = y + Math.floor(i / 2) * 170;
    arredondado(g, x, yy, 434, 150, 30); g.fillStyle = "rgba(255,255,255,.13)"; g.fill();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 26px ${TXT}`; g.fillText(a.toUpperCase(), x + 30, yy + 50);
    g.fillStyle = "#fff"; g.font = `800 44px ${DISP}`; g.fillText(caber(g, v, 380), x + 30, yy + 112);
  });
  y += Math.ceil(quadros.length / 2) * 170 + 30;
  // as 5 mais tocadas
  if (r.musicas.length > 1) {
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = `700 30px ${TXT}`; g.fillText("AS MAIS TOCADAS", 96, y + 20);
    y += 46;
    const cabe = Math.min(r.musicas.length, Math.floor((H - 100 - y) / 114));
    for (let i = 0; i < cabe; i++) await linhaTop(g, i, r.musicas[i].faixa, r.musicas[i].n, y + i * 114);
  }
  rodape(g, "Órbita · Músicas");
  return paraBlob(c);
}

/** O cartão do "Neste dia" (`n` de nesteDia). */
export async function imagemNesteDia(n) {
  await document.fonts?.ready;
  const [c, g] = tela();
  const top = n.musicas[0];
  const capaUrl = top ? await capaDe(top.faixa, "media") : "";
  const { b } = await fundo(g, capaUrl);
  g.fillStyle = "rgba(255,255,255,.8)"; g.font = `700 34px ${TXT}`; g.fillText("NESTE DIA", 96, 150);
  g.fillStyle = "#fff"; g.font = `800 92px ${DISP}`; g.fillText(n.titulo, 96, 250);
  g.fillStyle = "rgba(255,255,255,.82)"; g.font = `500 34px ${TXT}`; g.fillText(`${n.data} · ${horasTexto(n.tempo)} ouvindo`, 96, 312);
  if (top) await capaGrande(g, capaUrl, 190, 400, 700, b);
  if (top) {
    g.textAlign = "center"; g.fillStyle = "#fff"; g.font = `800 64px ${DISP}`; g.fillText(caber(g, top.faixa.titulo, 900), W / 2, 1210);
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = `500 36px ${TXT}`; g.fillText(caber(g, top.faixa.artista, 900), W / 2, 1266); g.textAlign = "left";
  }
  let y = 1340;
  const cabe = Math.min(n.musicas.length - 1, Math.floor((H - 150 - y) / 118));
  for (let i = 0; i < cabe; i++) await linhaTop(g, i + 1, n.musicas[i + 1].faixa, n.musicas[i + 1].n, y + i * 118);
  rodape(g, "Órbita · Músicas");
  return paraBlob(c);
}

/** Compartilha (Android) ou baixa (navegador) o PNG. */
export async function compartilharImagem(blob, nome) {
  if (Capacitor.isNativePlatform?.()) {
    const Filesystem = registerPlugin("Filesystem"), Share = registerPlugin("Share");
    const b64 = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
    const { uri } = await Filesystem.writeFile({ path: `retrospectiva/${nome}`, data: b64, directory: "CACHE", recursive: true });
    await Share.share({ title: nome, files: [uri], dialogTitle: "Compartilhar a retrospectiva" }).catch(() => {});
  } else {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = nome; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  }
}
