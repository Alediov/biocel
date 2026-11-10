// "O que mudou" no alto da Agenda (pedido do Alediov, 04/11/2026: a tarefa aplica direto e o app mostra o que mudou, com
// Desfazer em cada item): as mudanças do pacote agenda-avisos dos últimos dias (agendaAvisos.js), cada uma com o resumo,
// a mensagem do WhatsApp que a originou (se ela ainda está neste aparelho) e Desfazer / Aplicar de novo. As novas ficam
// destacadas até "Entendi" (o item do Meu dia some junto).
import { escapar, toast, dataBR } from "../ui.js";
import { icone } from "../icones.js";
import * as AV from "./agendaAvisos.js";
import * as W from "../whatsapp/whatsapp.js";
import { TIPOS } from "./operacoes.js";

const MAX = 5;
const ICONE = { avaliacao: "📅", "nova-avaliacao": "📅", aula: "📌", item: "🔁", datas: "🗓️", evento: "✨", nota: "🔔" };
const curto = (t, n = 140) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

/** O cartão (ou null sem mudanças nos últimos dias). */
export function secaoMudancas() {
  const l = AV.mudancas();
  if (!l.length) return null;
  const sec = document.createElement("div"); sec.className = "secao am-sec";
  let todos = false;
  const desenhar = () => {
    const ms = AV.mudancas(), nv = ms.filter(r => !r.visto && r.estado !== "desfeita");
    if (!ms.length) { sec.remove(); return; }
    const avisos = new Map(W.avisos().map(a => [a.id, a]));
    const mostra = todos ? ms : ms.slice(0, MAX);
    sec.innerHTML = `<div class="am${nv.length ? " am-tem" : ""}"><div class="am-cab"><span class="am-tit">${icone("📅", "ico-inline")} O que mudou na Agenda</span>
      ${nv.length ? `<b class="am-novas">${nv.length} nova${nv.length > 1 ? "s" : ""}</b>` : ""}</div>
      <p class="am-exp">Pelos destaques do WhatsApp que você mandou ao Claude.</p><div class="am-lista"></div></div>`;
    const lista = sec.querySelector(".am-lista");
    for (const r of mostra) {
      const it = document.createElement("article");
      it.className = `am-it am-${r.estado}${!r.visto && r.estado !== "desfeita" ? " nova" : ""}`; it.dataset.id = r.id;
      const orig = (r.de || []).map(id => avisos.get(id)).filter(Boolean);
      const origem = orig.length ? orig.map(a => `<b>${escapar(a.grupo)}</b> · ${escapar(a.de)}: “${escapar(curto(a.texto))}”`).join("<br>") : (r.de?.length ? "uma mensagem do WhatsApp (o texto ficou no celular)" : "");
      const est = r.estado === "desfeita" ? `<span class="am-est">desfeita</span>` : r.estado === "falhou" ? `<span class="am-est am-erro">não deu para aplicar${r.erro ? `: ${escapar(r.erro)}` : ""}</span>` : "";
      it.innerHTML = `<span class="am-ic" aria-hidden="true">${icone(ICONE[r.tipo] || "📌", "ico3d ico-medio")}</span>
        <div class="am-corpo"><p class="am-res">${escapar(r.resumo || TIPOS[r.tipo] || "Mudança")}</p>
          <div class="am-meta">${escapar(TIPOS[r.tipo] || "")}${r.dia ? ` · ${escapar(dataBR(r.dia.slice(0, 10), { day: "2-digit", month: "2-digit" }))}` : ""}${est}</div>
          ${origem ? `<details class="am-orig"><summary>De onde veio</summary><p>${origem}</p></details>` : ""}</div>
        <div class="am-acao"></div>`;
      const ac = it.querySelector(".am-acao");
      if (r.estado === "aplicada" && r.tipo !== "nota") ac.append(botao("Desfazer", "am-desfazer", () => {
        const res = AV.desfazer(r.id);
        toast(res.ok ? "Desfeito: a Agenda voltou como estava." : `Não deu para desfazer: ${res.erro}.`, 3200);
      }));
      else if (r.estado === "desfeita") ac.append(botao("Aplicar de novo", "am-refazer", () => {
        const res = AV.refazer(r.id);
        toast(res.ok ? "Aplicado de novo." : `Não deu: ${res.erro}.`, 3200);
      }));
      lista.append(it);
    }
    const rod = document.createElement("div"); rod.className = "am-rodape";
    if (ms.length > mostra.length) rod.append(botao(`Ver mais ${ms.length - mostra.length}`, "am-mais link", () => { todos = true; desenhar(); }));
    if (nv.length) rod.append(botao("Entendi", "am-entendi", () => AV.marcarVistas(), true));
    if (rod.childElementCount) sec.querySelector(".am").append(rod);
  };
  desenhar();
  return sec;
}
function botao(texto, cls, fn, principal = false) {
  const b = document.createElement("button"); b.type = "button"; b.className = `botao ${principal ? "" : "secundario"} ${cls}`; b.textContent = texto;
  b.onclick = fn;
  return b;
}
