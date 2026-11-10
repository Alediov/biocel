// Caixa de diálogo do OdontoScan (no lugar de prompt/confirm do navegador, que ficam feios no app).
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Abre um diálogo dentro de `raiz`. `botoes`: [{ texto, valor, classe: "sec"|"perigo" }]. `validar(valor, campos)`:
 * devolve uma mensagem de erro (fica aberto) ou nada. Resolve com { valor, campos } ou null (fechou).
 */
export function dialogo(raiz, { titulo, html = "", botoes = [{ texto: "OK", valor: true }], validar = null }) {
  return new Promise(ok => {
    const d = document.createElement("div");
    d.className = "os-dialogo";
    d.innerHTML = `<form class="os-dlg-caixa" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <h3>${esc(titulo)}</h3><div class="os-dlg-corpo">${html}</div><p class="os-dlg-erro" hidden></p>
      <div class="os-botoes">${botoes.map((b, i) => `<button type="${i === 0 ? "submit" : "button"}" class="os-botao ${b.classe || ""}" data-i="${i}">${esc(b.texto)}</button>`).join("")}</div>
    </form>`;
    raiz.append(d);
    const form = d.querySelector("form"), erro = d.querySelector(".os-dlg-erro");
    const campos = () => Object.fromEntries([...form.querySelectorAll("[name]")].map(el => [el.name, el.type === "checkbox" ? el.checked : el.value]));
    const fechar = (r) => { d.classList.add("saindo"); setTimeout(() => d.remove(), 180); ok(r); };
    const escolher = async (i) => {
      const b = botoes[i], c = campos();
      if (b.valor !== null && b.valor !== false && validar) { const m = await validar(b.valor, c); if (m) { erro.textContent = m; erro.hidden = false; form.classList.remove("treme"); void form.offsetWidth; form.classList.add("treme"); return; } }
      fechar(b.valor === null ? null : { valor: b.valor, campos: c });
    };
    form.onsubmit = (e) => { e.preventDefault(); escolher(0); };
    d.querySelectorAll("button[data-i]").forEach(b => { if (b.type === "button") b.onclick = () => escolher(+b.dataset.i); });
    d.addEventListener("click", (e) => { if (e.target === d) fechar(null); });
    d.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(null); });
    setTimeout(() => form.querySelector("input, select, button")?.focus(), 60);
  });
}
