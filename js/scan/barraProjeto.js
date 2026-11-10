// A barra do projeto aberto na Iniciação Científica (31/10/2026), logo abaixo do topo do OdontoScan e dos resultados
// no celular; o toque volta à lista de projetos (projetos.js). Sem imports: telaScan.js e painelCelular.js a usam, e o
// OdontoScan.html do computador (montar_odontoscan.py) não tem a barra (lá não há `aoProjetos`).
const PASTA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
const escB = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** HTML da barra para o projeto `p` ({ nome }), ou "" sem projeto. */
export function htmlBarraProjeto(p) {
  if (!p?.nome) return "";
  return `<button class="os-projeto" aria-label="Projeto: ${escB(p.nome)}. Ver os projetos"><span class="os-projeto-ic" aria-hidden="true">${PASTA}</span><span class="os-projeto-tx"><small>Projeto</small><b>${escB(p.nome)}</b></span><span class="os-projeto-tr">Projetos ›</span></button>`;
}
/** Liga o toque da barra dentro de `raiz`. */
export function ligarBarraProjeto(raiz, aoProjetos) {
  const b = raiz.querySelector(".os-projeto"); if (b && aoProjetos) b.onclick = () => aoProjetos();
}
