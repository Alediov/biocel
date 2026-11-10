// O perfil da Eva (pedido do Alediov, 04/11/2026: "zoom na foto da Eva, como ver o perfil"): tocar no rosto dela (no
// alto da conversa, nos rostinhos das mensagens e na lista de Mensagens) abre a Eva grande, animada (`.vivo`), saindo
// do avatar tocado como no WhatsApp, com o nome, o humor de hoje em palavras, a semana em pontinhos com a legenda e o
// papel dela. Fecha tocando fora, no X ou com o voltar do Android (voltar.js). Com "reduzir movimento", sem o zoom.
// Nitidez (pedido do Alediov, 05/11/2026: a Eva ampliada saía borrada): a foto é o SVG no tamanho final; o zoom só
// anima a escala de pequena até 1 e termina sem transform, e a foto não tem will-change nem a escala do `.vivo`
// (eva.css), que faziam o Chrome do Android manter a camada rasterizada no tamanho do avatar e esticá-la.
import { eva } from "../arte/eva.js";
import { NIVEIS } from "./humor.js";
import * as EV from "./eva.js";
import { empilhar } from "./voltar.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduzir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const FECHAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const EASE = "cubic-bezier(.2,.8,.2,1)";

/** O deslocamento do centro de `de` até o centro de `para` (em px da camada: com o zoom do tablet, o retângulo vem
 *  aumentado e o translate não) e a escala do tamanho de um para o outro. */
function caminho(de, para, camada) {
  const a = de.getBoundingClientRect(), b = para.getBoundingClientRect();
  if (!a.width || !b.width) return null;
  const kz = camada.getBoundingClientRect().width / (camada.offsetWidth || 1) || 1;
  return { dx: (a.left + a.width / 2 - (b.left + b.width / 2)) / kz, dy: (a.top + a.height / 2 - (b.top + b.height / 2)) / kz, s: a.width / b.width };
}

/** Abre o perfil por cima da camada de Mensagens; `origem`: o avatar tocado (o zoom sai dele e volta para ele). */
export function abrirPerfil(camada, origem = null) {
  if (!camada?.isConnected || camada.querySelector(".eva-perfil")) return null;
  const hum = EV.humorAtual(), cor = NIVEIS[hum.nivel]?.cor || "var(--ev-cor)";
  const ov = document.createElement("div");
  ov.className = "eva-perfil";
  ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Perfil da Eva");
  ov.innerHTML = `<div class="eva-perfil-cartao">
      <button class="eva-ic eva-perfil-x" type="button" aria-label="Fechar">${FECHAR}</button>
      <div class="eva-perfil-foto vivo" style="--c:${cor}">${eva({ humor: hum.rosto, capuz: false })}</div>
      <div class="eva-perfil-info">
        <h2>Eva</h2>
        <p class="eva-perfil-papel">Companheira de rotina e estudos</p>
        <p class="eva-perfil-humor"><i style="--c:${cor}"></i>Hoje ela está <b>${esc(hum.nome)}</b></p>
        <div class="eva-perfil-semana" aria-label="O humor dela nos últimos 7 dias">
          ${hum.semana.map((d, i) => `<span class="${i === 6 ? "eva-hoje" : ""}"><i style="--c:${d.nivel == null ? "var(--linha)" : NIVEIS[d.nivel].cor}"></i><small>${DIAS[new Date(d.data + "T12:00").getDay()]}</small></span>`).join("")}
        </div>
        <ul class="eva-perfil-leg">${NIVEIS.map(n => `<li><i style="--c:${n.cor}"></i>${esc(n.nome)}</li>`).join("")}</ul>
      </div>
    </div>`;
  camada.append(ov);
  const foto = ov.querySelector(".eva-perfil-foto"), info = ov.querySelector(".eva-perfil-info"), x = ov.querySelector(".eva-perfil-x");
  const anima = !reduzir() && typeof foto.animate === "function";
  // o zoom: a foto sai do avatar tocado (translate + escala) e cresce até o lugar dela; o resto aparece depois
  if (anima) {
    const c = origem?.isConnected ? caminho(origem, foto, camada) : null;
    ov.animate([{ backgroundColor: "rgba(10, 6, 30, 0)" }, { backgroundColor: "rgba(10, 6, 30, .62)" }], { duration: 260, easing: "ease-out" });
    if (c) foto.animate([{ transform: `translate(${c.dx}px, ${c.dy}px) scale(${c.s})` }, { transform: "none" }], { duration: 360, easing: EASE });
    else foto.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: EASE });
    for (const el of [info, x]) el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: 140, easing: EASE, fill: "backwards" });
  }
  let fechando = false, tirar = null;
  const fechar = (pelaPilha = false) => {
    if (fechando) return; fechando = true;
    if (!pelaPilha) tirar?.();
    if (!anima || !ov.isConnected) { ov.remove(); return; }
    const c = origem?.isConnected && origem.getClientRects().length ? caminho(origem, foto, camada) : null;
    const dur = 260;
    ov.animate([{ backgroundColor: "rgba(10, 6, 30, .62)" }, { backgroundColor: "rgba(10, 6, 30, 0)" }], { duration: dur, easing: "ease-in", fill: "forwards" });
    for (const el of [info, x]) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
    const a = c ? foto.animate([{ transform: "none" }, { transform: `translate(${c.dx}px, ${c.dy}px) scale(${c.s})` }], { duration: dur, easing: EASE, fill: "forwards" })
      : foto.animate([{ transform: "none", opacity: 1 }, { transform: "scale(.6)", opacity: 0 }], { duration: dur, easing: "ease-in", fill: "forwards" });
    a.onfinish = () => ov.remove();
    setTimeout(() => ov.remove(), dur + 200);
  };
  tirar = empilhar(() => fechar(true));
  ov.addEventListener("click", (e) => { if (e.target === ov) fechar(); });
  x.onclick = () => fechar();
  ov.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
  x.focus({ preventScroll: true });
  return { fechar: () => fechar() };
}
