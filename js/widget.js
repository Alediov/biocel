// Widgets da tela inicial do Android (ofensiva com o companheiro ou o avatar). O app manda os
// dados para o plugin nativo "Widget", que guarda e redesenha os widgets. No navegador, nada acontece.
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";
import { E, hojeISO, somaDias, metaDoDia } from "./estado.js";
import { arteCompanheiro, nomeCompanheiro } from "./colecao.js";
import { arteAvatar } from "./telaAvatar.js";

const nativo = !!Capacitor.isNativePlatform?.();
const Widget = nativo ? registerPlugin("Widget") : null;
let timer = null, ultimo = "", imagemChave = "", imagemPng = "";

/** SVG → PNG (base64, sem o prefixo data:) para o widget nativo. */
function svgParaPng(svg, lado = 256) {
  return new Promise((ok) => {
    const s = (svg.includes("xmlns=") ? svg : svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')).replace(/var\(--[a-z-]+\)/g, "#2F6BFF");
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = lado; c.height = lado;
      c.getContext("2d").drawImage(img, 0, 0, lado, lado);
      ok(c.toDataURL("image/png").split(",")[1]);
    };
    img.onerror = () => ok("");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  });
}

/** Estado de cada dia para o widget: a = estudou, c = congelado, r = reparado, x = perdeu. */
function historico(dias = 35) {
  const est = E(), o = est.ofensiva, out = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = somaDias(hojeISO(), -i);
    const k = (est.diario[d]?.licoes.length || 0) > 0 ? "a" : (o.usados || []).includes(d) ? "c" : (o.reparados || []).includes(d) ? "r" : (o.quebras || []).includes(d) ? "x" : "-";
    out.push(`${d}:${k}`);
  }
  return out.join(",");
}

async function enviar() {
  const est = E(), o = est.ofensiva, figura = est.config.widgetFigura || "companheiro";
  const feito = o.ultimoDia === hojeISO();
  const chave = `${figura}|${figura === "avatar" ? JSON.stringify(est.avatar?.cfg || {}) : est.colecao?.equipada}|${feito}`;
  if (chave !== imagemChave) {
    const svg = figura === "avatar" ? arteAvatar() : arteCompanheiro({ humor: feito ? "feliz" : "triste" });
    imagemPng = await svgParaPng(svg); imagemChave = chave;
  }
  const dados = {
    atual: o.atual, recorde: o.recorde, congelamentos: o.congelamentos, ultimoDia: o.ultimoDia || "",
    historico: historico(), nome: figura === "avatar" ? (est.avatar?.nome || "Você") : nomeCompanheiro(),
    metaFeitas: est.diario[hojeISO()]?.licoes.length || 0, meta: metaDoDia(), xpHoje: est.diario[hojeISO()]?.xp || 0,
  };
  const assin = JSON.stringify(dados) + imagemChave;
  if (assin === ultimo) return;
  ultimo = assin;
  try { await Widget.atualizar({ ...dados, imagem: imagemPng }); } catch (e) { /* app antigo sem o plugin */ }
}
/** Chamado sempre que o topo muda: junta as chamadas e manda para o widget. */
export function atualizarWidget(imediato = false) {
  if (!nativo) return;
  clearTimeout(timer);
  timer = setTimeout(enviar, imediato ? 0 : 1500);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") atualizarWidget(true); });

// ---------- OdontoScan ----------
// Só contagens (revisões por dia, meta, fichas por etapa): nenhum dado de paciente vai para o widget.
let ultimoScan = "";
export function atualizarWidgetScan(r) {
  if (!nativo || !r) return;
  const dados = { dia: r.dia, metaRev: r.metaRev, feitasRev: r.feitasRev, metaNum: r.metaNum, feitasNum: r.feitasNum, seq: r.seq, cumpriu: !!r.cumpriu, ativo: !!r.ativo,
    paraRevisar: r.paraRevisar, naFila: r.naFila, confirmar: r.confirmar, revisadas: r.revisadas, total: r.total, erro: r.erro };
  const assin = JSON.stringify(dados);
  if (assin === ultimoScan) return;
  ultimoScan = assin;
  Widget.atualizarScan(dados).catch(() => { /* app antigo sem o método */ });
}
/** Área pedida pelo toque num widget ("scan" ou "learn"); "" se nenhuma. */
export async function areaDoWidget() {
  if (!nativo) return "";
  try { return (await Widget.areaPendente()).area || ""; } catch (e) { return ""; }
}

/** "Meu dia" (meuDia.js): o resumo do dia para o widget nativo. */
export function atualizarWidgetMeuDia(r) {
  if (!nativo || !r) return;
  Widget.atualizarMeuDia({ dia: r.dia, feitos: r.feitos, total: r.total, linhas: JSON.stringify(r.linhas) }).catch(() => { /* app antigo sem o método */ });
}

/** "Seu dinheiro" (Finanças, 30/10/2026): o total, a linha de baixo e a série [[dia, valor], …] desde 1º/11/2026. */
let ultimoFin = "";
export function atualizarWidgetFinancas(d) {
  if (!nativo || !d) return;
  const dados = { total: d.total, sub: d.sub, serie: JSON.stringify(d.serie || []) };
  const assin = JSON.stringify(dados);
  if (assin === ultimoFin) return;
  ultimoFin = assin;
  Widget.atualizarFinancas(dados).catch(() => { /* app antigo sem o método */ });
}
