// Revisar: ao tocar num campo, mostra a parte da cópia da ficha onde ele está escrito.
// Uma "lupa" fica fixa no alto da tela (no celular a cópia sai de vista ao rolar) e, quando a cópia está à vista
// (notebook, lado a lado), o retângulo do campo acende sobre ela.
import { OX, OY, W_AL, H_AL, FAIXAS_NUMEROS, ZONA_ENDERECO } from "./visao.js";
import { GEO_PARTES } from "./partes.js";

// retângulos no quadro da ficha (x0, y0, x1, y1), medidos na ficha endireitada
const LINHA_CLINICA = [0, 205, 1450, 300];
export const REGIOES = {
  data: [1540, 205, 2000, 300],
  horario: LINHA_CLINICA, clinica: LINHA_CLINICA, cor: LINHA_CLINICA,
  urgencia: [0, 430, 205, 900], primeira: [0, 430, 205, 900], retorno: [0, 430, 205, 900],
  nascimento: [20, 930, 125, 1350],
  sexo: [115, 930, 200, 1210],
  idadeEscrita: [880, 585, 1180, 690],
  municipio: [200, 1090, 1180, 1250],
};
// na ficha inteira (modo local, só no computador): também os números e o endereço
export const REGIOES_INTEIRA = { ...FAIXAS_NUMEROS, municipio: ZONA_ENDERECO, bairro: ZONA_ENDERECO };
/** Linha i dos procedimentos (dente e código). */
// (as linhas medidas na impressão da ficha, as mesmas da leitura local; antes, 352 + 86,2 × i saía do lugar a partir da 5ª)
export const linhaProcedimento = (i) => { const L = GEO_PARTES.linhas, [y0, y1] = L[Math.min(L.length - 1, i)]; return [1195, y0 - 8, 2005, y1 + 8]; };

/**
 * Liga a lupa na tela `t`. `src`: URL da imagem da cópia (ou da ficha inteira, com `o.inteira`). Devolve uma função que desliga.
 */
export function ligarLupa(t, src, raiz, o = {}) {
  const fig = t.querySelector(".os-copia"), img = fig?.querySelector("img");
  if (!img || !src) return () => {};
  // retângulo que acende sobre a cópia (religada com a ficha inteira: reaproveita a caixa)
  let caixa = img.parentElement?.classList.contains("os-copia-caixa") ? img.parentElement : null, foco = caixa?.querySelector(".os-foco");
  if (!caixa) {
    caixa = document.createElement("span"); caixa.className = "os-copia-caixa";
    foco = document.createElement("i"); foco.className = "os-foco"; foco.hidden = true;
    img.replaceWith(caixa); caixa.append(img, foco);
  }
  // lupa fixa
  const lupa = document.createElement("div"); lupa.className = "os-lupa"; lupa.hidden = true;
  lupa.innerHTML = `<div class="os-lupa-img"></div><small></small>`;
  raiz.append(lupa);
  const quadro = lupa.querySelector(".os-lupa-img");
  quadro.style.backgroundImage = `url("${src}")`;
  let esconder = null;

  const regiaoDe = (el) => {
    if (o.inteira && el.dataset.lupa && REGIOES_INTEIRA[el.dataset.lupa]) return [REGIOES_INTEIRA[el.dataset.lupa], el.closest(".os-campo")?.querySelector(".os-campo-cab b")?.textContent || ""];
    if (o.inteira && REGIOES_INTEIRA[el.dataset.k] && /municipio|bairro/.test(el.dataset.k)) return [REGIOES_INTEIRA[el.dataset.k], "Endereço"];
    if (el.dataset.k && REGIOES[el.dataset.k]) return [REGIOES[el.dataset.k], el.closest("label")?.firstChild?.textContent?.trim() || ""];
    const proc = el.closest(".os-proc");
    if (proc) { const i = [...proc.parentElement.children].indexOf(proc); return [linhaProcedimento(i), `Procedimento ${i + 1}`]; }
    return null;
  };
  const mostrar = (el) => {
    const r = regiaoDe(el); if (!r) return esconderJa();
    clearTimeout(esconder);
    const [[x0, y0, x1, y1], nome] = r;
    const ax0 = x0 + OX, ay0 = y0 + OY, w = x1 - x0, h = y1 - y0;
    // sobre a cópia
    Object.assign(foco.style, { left: `${(ax0 / W_AL) * 100}%`, top: `${(ay0 / H_AL) * 100}%`, width: `${(w / W_AL) * 100}%`, height: `${(h / H_AL) * 100}%` });
    foco.hidden = false; foco.classList.remove("acende"); void foco.offsetWidth; foco.classList.add("acende");
    // a lupa só aparece quando a cópia não está à vista
    const b = img.getBoundingClientRect(), visivel = b.bottom > 80 && b.top < innerHeight * 0.6;
    if (visivel) { lupa.hidden = true; return; }
    const largura = Math.min(innerWidth - 24, 640), margem = 30;
    let esc = largura / (w + 2 * margem);
    const alturaMax = Math.min(170, innerHeight * 0.22);
    if ((h + 2 * margem) * esc > alturaMax) esc = alturaMax / (h + 2 * margem);
    Object.assign(quadro.style, {
      width: `${largura}px`, height: `${(h + 2 * margem) * esc}px`,
      backgroundSize: `${W_AL * esc}px ${H_AL * esc}px`,
      backgroundPosition: `${-(ax0 - margem) * esc + (largura - (w + 2 * margem) * esc) / 2}px ${-(ay0 - margem) * esc}px`,
    });
    lupa.querySelector("small").textContent = nome ? `${nome} na ficha` : "na ficha";
    if (lupa.hidden) { lupa.hidden = false; lupa.classList.remove("entra"); void lupa.offsetWidth; lupa.classList.add("entra"); }
  };
  const esconderJa = () => { lupa.hidden = true; foco.hidden = true; };
  const aoFocar = (e) => { if (e.target.matches("input, select")) mostrar(e.target); };
  const aoSair = () => { clearTimeout(esconder); esconder = setTimeout(() => { if (!t.contains(document.activeElement) || !document.activeElement.matches("input, select")) esconderJa(); }, 250); };
  t.addEventListener("focusin", aoFocar);
  t.addEventListener("focusout", aoSair);
  // o teclado próprio não tira o foco do campo: acompanha o campo ativo dele
  const obs = new MutationObserver((ms) => { for (const m of ms) if (m.target.classList?.contains("ot-ativo")) return mostrar(m.target); });
  obs.observe(t, { subtree: true, attributes: true, attributeFilter: ["class"] });
  lupa.onclick = esconderJa;
  return () => { obs.disconnect(); lupa.remove(); t.removeEventListener("focusin", aoFocar); t.removeEventListener("focusout", aoSair); };
}
