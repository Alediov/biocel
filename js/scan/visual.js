// Visual do OdontoScan (29/10/2026, pedido do Alediov: "um tema mais AMOLED, bolhas animadas e animações, detalhes
// puramente visuais"). O tema escuro segue o do app (ou, no OdontoScan.html, o escolhido na Aparência ou o do sistema)
// e fica em `.os-amoled`; as partículas do fundo (bolhas e as outras, ../particulas.js, desde 02/11/2026) sobem devagar
// (mais depressa durante a importação); botões soltam uma onda no toque.
// Sem dependências do app (vai também no OdontoScan.html) e tudo respeita "reduzir movimento".
import { ligarParticulas, desligarParticulas, temaEscuro, reduzido } from "../particulas.js";

/** Tema AMOLED pelo tema do app (data-tema) ou, sem ele, pelo do sistema. */
export const escuro = temaEscuro;

const ligados = new WeakSet();
/** Liga tema, bolhas e a onda do toque em `raiz` (a área do OdontoScan). */
export function ligarVisual(raiz) {
  const tema = () => raiz.classList.toggle("os-amoled", escuro());
  tema();
  if (!ligados.has(raiz)) {
    ligados.add(raiz);
    try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", tema); } catch { /* navegador antigo */ }
    new MutationObserver(tema).observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    raiz.addEventListener("pointerdown", onda, { passive: true });
  }
  particulasDaArea(raiz);
}

/** As partículas pela escolha da Aparência (aparenciaComum.js põe data-bolhas e data-particulas na área: o
 *  `.camada-scan` no app, o próprio `.os` no OdontoScan.html); sem escolha, as bolhas. */
export function particulasDaArea(raiz) {
  const a = raiz.closest?.("[data-bolhas]");
  if (a?.dataset.bolhas === "nao") desligarBolhas(raiz);
  else ligarParticulas(raiz, { classe: "os-bolhas", tipos: a?.dataset.particulas || "bolhas", escuro: () => raiz.classList.contains("os-amoled") });
}

/** Bolhas (e as outras partículas) em qualquer área do Órbita: um canvas atrás do conteúdo de `raiz`. */
export function ligarBolhas(raiz, { ativo = null, classe = "orb-bolhas", tipos } = {}) { return ligarParticulas(raiz, { ativo, classe, tipos }); }
export const desligarBolhas = desligarParticulas;

// ---------- onda do toque ----------
const COM_ONDA = ".os-botao, .os-seg button, .os-so-nums, .os-etapa, .os-modo-op";
function onda(e) {
  if (reduzido() || e.button > 0) return;
  const el = e.target.closest?.(COM_ONDA);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect(), k = r.width / (el.offsetWidth || r.width) || 1; // zoom do tablet
  const d = Math.max(r.width, r.height) * 2.2 / k;
  const o = document.createElement("i");
  o.className = "os-onda";
  Object.assign(o.style, { width: `${d}px`, height: `${d}px`, left: `${(e.clientX - r.left) / k - d / 2}px`, top: `${(e.clientY - r.top) / k - d / 2}px` });
  el.append(o);
  setTimeout(() => o.remove(), 650);
}
