// Filtros e ordem das listas da Coleção e do Jardim (pedidos do Alediov, 02/11/2026: "opções de colocar filtros na
// aba de cartas… por habilidades, raridades, etc." e "filtros na hora de plantar e nas plantas"). Uma barra com chips
// rápidas (o 1º grupo, a raridade), o botão "Filtros" (folha de baixo com todos os grupos e a contagem ao vivo) e o
// seletor de ordem. A escolha fica no aparelho (localStorage), por lista.
import { escapar } from "./ui.js";

export function lerFiltro(chave, padrao) {
  try { return { ...padrao, ...JSON.parse(localStorage.getItem(chave) || "{}") }; } catch (e) { return { ...padrao }; }
}
export function gravarFiltro(chave, f) { try { localStorage.setItem(chave, JSON.stringify(f)); } catch (e) { /* sem armazenamento */ } }
/** Quantos grupos estão filtrando (fora a ordem). */
export const ativos = (f, grupos) => grupos.filter(g => f[g.id]).length;

/**
 * grupos: [{ id, titulo, opcoes: [[valor, rotulo]] }] (o valor "" é "Todas", e não precisa estar na lista);
 * ordens: [[valor, rotulo]]; f: a escolha atual ({ <grupo>: valor, ordem }); padrao: a escolha sem filtros;
 * contar(f): quantos itens passam; aoMudar(f): redesenhar a lista. Devolve o elemento da barra.
 */
export function barraFiltros({ grupos, ordens, f, padrao, contar, aoMudar, rapido = grupos[0]?.id, classe = "" }) {
  const el = document.createElement("div"); el.className = `fil-barra ${classe}`;
  const g0 = grupos.find(g => g.id === rapido);
  const n = ativos(f, grupos.filter(g => g.id !== rapido)) + (f[rapido] ? 1 : 0);
  el.innerHTML = `${g0 ? `<div class="fil-rapidos">${[["", "Todas"], ...g0.opcoes].map(([v, r]) => `<button class="chip-filtro ${(f[rapido] || "") === v ? "on" : ""}" data-v="${escapar(v)}">${escapar(r)}</button>`).join("")}</div>` : ""}
    <div class="fil-linha">
      <button class="fil-botao ${n ? "on" : ""}" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>Filtros${n ? ` <b>${n}</b>` : ""}</button>
      <label class="fil-ordem"><span>Ordem</span><select>${ordens.map(([v, r]) => `<option value="${escapar(v)}" ${f.ordem === v ? "selected" : ""}>${escapar(r)}</option>`).join("")}</select></label>
      ${n ? `<button class="fil-limpar" type="button">Limpar</button>` : ""}
      <small class="fil-conta">${contar(f)} ${contar(f) === 1 ? "item" : "itens"}</small>
    </div>`;
  el.querySelectorAll(".fil-rapidos .chip-filtro").forEach(b => (b.onclick = () => aoMudar({ ...f, [rapido]: b.dataset.v })));
  el.querySelector(".fil-ordem select").onchange = (e) => aoMudar({ ...f, ordem: e.target.value });
  el.querySelector(".fil-limpar")?.addEventListener("click", () => aoMudar({ ...padrao, ordem: f.ordem }));
  el.querySelector(".fil-botao").onclick = () => abrirFolha({ grupos, f, padrao, contar, aoMudar });
  return el;
}

/** Folha de baixo com todos os grupos: tocar numa opção liga, tocar de novo desliga; a contagem acompanha. */
export function abrirFolha({ grupos, f, padrao, contar, aoMudar }) {
  let atual = { ...f };
  const fundo = document.createElement("div"); fundo.className = "fil-fundo";
  fundo.innerHTML = `<div class="fil-folha" role="dialog" aria-label="Filtros"><div class="fil-alca"></div><h2>Filtros</h2><div class="fil-grupos"></div>
    <div class="fil-acoes"><button class="botao secundario fil-zerar" type="button">Limpar</button><button class="botao fil-ver" type="button"></button></div></div>`;
  const corpo = fundo.querySelector(".fil-grupos"), ver = fundo.querySelector(".fil-ver");
  const desenhar = () => {
    corpo.innerHTML = grupos.map(g => `<div class="fil-grupo"><h3>${escapar(g.titulo)}</h3><div class="fil-chips">${g.opcoes.map(([v, r]) => `<button class="chip-filtro ${atual[g.id] === v ? "on" : ""}" data-g="${g.id}" data-v="${escapar(v)}" type="button">${escapar(r)}</button>`).join("")}</div></div>`).join("");
    corpo.querySelectorAll(".chip-filtro").forEach(b => (b.onclick = () => { const { g, v } = b.dataset; atual = { ...atual, [g]: atual[g] === v ? "" : v }; desenhar(); }));
    const n = contar(atual);
    ver.textContent = n ? `Ver ${n} ${n === 1 ? "item" : "itens"}` : "Nenhum item";
  };
  const fechar = (aplicar) => { fundo.classList.add("saindo"); setTimeout(() => fundo.remove(), 180); if (aplicar) aoMudar(atual); };
  fundo.onclick = (e) => { if (e.target === fundo) fechar(true); };
  fundo.querySelector(".fil-zerar").onclick = () => { atual = { ...padrao, ordem: atual.ordem }; desenhar(); };
  ver.onclick = () => fechar(true);
  desenhar();
  document.body.append(fundo);
  return fundo;
}
