// Iniciação Científica: os projetos (pedido do Alediov, 31/10/2026: o subapp "Scanner" virou "Iniciação Científica",
// e dentro dele ele escolhe o projeto). Hoje só um: "Inteligência de Dados em Saúde Bucal Coletiva", que é o
// OdontoScan (fichas de Controle de Tratamento do SUS). Abrir a área pela Home mostra esta lista; notificações e
// widgets abrem o projeto direto (areas.js, abrirScan({ direto: true })).
import { ligarVisual } from "./visual.js";
import { esc, fmt, LOGO } from "./telaScan.js";

export const PROJETOS = [{
  id: "sbc",
  nome: "Inteligência de Dados em Saúde Bucal Coletiva",
  sub: "Fichas de Controle de Tratamento do SUS da clínica de Odontologia da UNIOESTE",
}];
export const NOME_AREA = "Iniciação Científica";

/** Situação do projeto pelo último resumo guardado no aparelho (só números agregados). */
function situacao() {
  let r = null; try { r = JSON.parse(localStorage.getItem("os.resumo") || "null"); } catch { r = null; }
  if (!r?.total) return "";
  return `${fmt(r.conferidas || 0)} de ${fmt(r.total)} fichas conferidas`;
}

/** A tela da lista de projetos dentro de `raiz` (a camada da área). */
export function telaProjetos(raiz, { aoTrocarArea, aoAbrir }) {
  raiz.classList.add("os", "os-projetos");
  raiz.innerHTML = `
    <header class="os-topo">
      <button class="os-area" aria-label="Trocar de área"><span class="os-logo">${LOGO}</span><span><b>${NOME_AREA}</b><small>Trocar de Área ▾</small></span></button>
    </header>
    <main class="os-tela">
      <h2 class="os-h2">Seus projetos</h2>
      <div class="os-proj-lista">${PROJETOS.map(p => {
        const s = situacao();
        return `<button class="os-cartao os-proj" data-id="${p.id}"><span class="os-proj-ic" aria-hidden="true">${LOGO}</span>
          <span class="os-proj-tx"><b>${esc(p.nome)}</b><small>${esc(p.sub)}</small>${s ? `<em>${esc(s)}</em>` : ""}</span><span class="os-proj-seta" aria-hidden="true">›</span></button>`;
      }).join("")}</div>
    </main>`;
  ligarVisual(raiz);
  raiz.querySelector(".os-area").onclick = () => aoTrocarArea?.();
  raiz.querySelectorAll(".os-proj").forEach(b => (b.onclick = () => aoAbrir?.(b.dataset.id)));
}
