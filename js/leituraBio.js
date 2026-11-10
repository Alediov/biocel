// App de BioCel: a Leitura do Órbita só com os caps. 18 e 19 do Alberts. Os arquivos ficam no Supabase Storage
// (bucket privado "leitura", só para quem entrou na turma); nuvem.js define globalThis.__baixarLeitura.
import { icone } from "./icones.js";

let camada = null;
export async function abrirLeitura() {
  if (camada) return;
  if (!document.querySelector('link[href="leitura.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "leitura.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirTelaLeitura } = await import("./leitura/telaLeitura.js");
  camada = document.createElement("div"); camada.className = "camada-leitura";
  document.body.append(camada);
  abrirTelaLeitura(camada, { aoTrocarArea: fechar, logo: icone("📖", "ico3d") });
}
export function fechar() {
  if (!camada) return;
  const c = camada; camada = null;
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
  window.dispatchEvent(new Event("oq-topo"));
}
window.addEventListener("biocel-leitura", () => abrirLeitura().catch(e => console.warn("leitura:", e)));
