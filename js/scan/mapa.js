// Mapas do Painel: atendimentos por bairro de Cascavel, por distrito de Cascavel e por município do Paraná.
// Contornos em mapas.js (gerado por tools/odontoscan/mapas.py a partir das camadas do GeoCascavel e do IBGE).
import { MAPAS } from "./mapas.js";
import { norm, ehCascavel } from "./previsao.js";
import { ehPIC } from "./processar.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
export const VISTAS = [["bairros", "Bairros"], ["distritos", "Município"], ["parana", "Paraná"]];
const BAIRROS_MAPA = new Set(MAPAS.bairros.itens.map(([n]) => norm(n)));
const DISTRITOS_MAPA = new Map(MAPAS.distritos.itens.map(([n]) => [norm(n), n]));

/** Conta as fichas (revisões r) por forma do mapa. Devolve { cont: Map(nome → n), fora, foraTxt }. */
export function contar(vista, revisoes) {
  const cont = new Map(), soma = (k) => cont.set(k, (cont.get(k) || 0) + 1);
  let fora = 0;
  for (const r of revisoes) {
    if (ehPIC(r)) continue; // PIC: atendimento institucional, fora dos mapas
    const mun = r.municipio || "", cas = ehCascavel(mun), b = norm(r.bairro);
    if (vista === "parana") {
      if (!mun) { fora++; continue; }
      if (/ - [A-Z]{2}$/.test(mun) && !/ - PR$/.test(mun)) { fora++; continue; }
      soma(norm(mun.replace(/ - PR$/, "")));
    } else if (vista === "bairros") {
      if (!cas) continue;
      if (BAIRROS_MAPA.has(b)) soma(b); else fora++;
    } else {
      if (!cas) continue;
      if (DISTRITOS_MAPA.has(b)) soma(b);
      else if (BAIRROS_MAPA.has(b)) soma(norm("Sede Administrativa"));
      else fora++;
    }
  }
  const foraTxt = vista === "parana" ? "de fora do Paraná ou sem município" : vista === "bairros" ? "de Cascavel sem bairro no mapa (distritos, área rural, chácaras ou em branco)" : "de Cascavel sem bairro nem distrito (área rural, chácaras ou em branco)";
  return { cont, fora, foraTxt };
}

const CORES = 5;
const nivel = (v, max) => !v ? 0 : Math.max(1, Math.ceil(Math.sqrt(v / max) * CORES));

/** SVG do mapa com as formas coloridas pela contagem. */
// caixa (x0, y0, x1, y1) das formas com fichas, para aproximar o mapa do Paraná da região dos pacientes
export function caixaDasFormas(m, cont) {
  // as formas que somam 90% das fichas (um paciente de longe não afasta o mapa todo)
  const total = [...cont.values()].reduce((a, b) => a + b, 0), entram = new Set();
  let soma = 0;
  for (const [k, v] of [...cont.entries()].sort((a, b) => b[1] - a[1])) { if (soma >= total * 0.9) break; entram.add(k); soma += v; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [nome, d] of m.itens) {
    if (!entram.has(norm(nome))) continue;
    const ns = d.match(/-?\d+/g).map(Number);
    for (let i = 0; i < ns.length; i += 2) { x0 = Math.min(x0, ns[i]); x1 = Math.max(x1, ns[i]); y0 = Math.min(y0, ns[i + 1]); y1 = Math.max(y1, ns[i + 1]); }
  }
  if (!isFinite(x0)) return null;
  // folga e tamanho mínimo (um quarto do estado), mantendo a proporção do mapa
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let w = Math.max(x1 - x0 + 80, m.w / 4), h = Math.max(y1 - y0 + 80, m.h / 4);
  if (w / h > m.w / m.h) h = w * m.h / m.w; else w = h * m.w / m.h;
  if (w >= m.w * 0.85) return null;
  return [cx - w / 2, cy - h / 2, w, h];
}

export function svgMapa(vista, cont, perto = false) {
  const m = MAPAS[vista], max = Math.max(1, ...cont.values());
  const caixa = perto ? caixaDasFormas(m, cont) : null;
  const vb = caixa ? caixa.map(v => Math.round(v)).join(" ") : `-4 -4 ${m.w + 8} ${m.h + 8}`;
  const formas = m.itens.map(([nome, d]) => {
    const v = cont.get(norm(nome)) || 0;
    return `<path d="${d}" class="m${nivel(v, max)}${vista === "parana" && ehCascavel(nome) ? " casa" : ""}" data-nome="${esc(nome)}" data-v="${v}"><title>${esc(nome)}: ${fmt(v)}</title></path>`;
  }).join("");
  const leg = Array.from({ length: CORES }, (_, i) => Math.round(max * ((i + 1) / CORES) ** 2));
  return `<svg class="os-mapa-svg ${caixa ? "perto" : ""}" viewBox="${vb}" role="img" aria-label="Mapa de atendimentos">${formas}</svg>
    <div class="os-mapa-leg"><span>0</span><i class="m0"></i>${leg.map((v, i) => `<i class="m${i + 1}" title="até ${fmt(v)}"></i>`).join("")}<span>${fmt(max)}</span></div>`;
}

/** Monta o cartão do mapa dentro de `el` (troca de vista e toque numa forma). */
export function ligarMapa(el, revisoes, vistaInicial = "bairros", aoTrocar = () => {}) {
  let vista = vistaInicial, perto = true;
  const desenhar = () => {
    const { cont, fora, foraTxt } = contar(vista, revisoes);
    const podeAproximar = vista === "parana" && !!caixaDasFormas(MAPAS.parana, cont);
    const top = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc((MAPAS[vista].itens.find(([n]) => norm(n) === k) || [k])[0])} (${fmt(v)})`);
    el.querySelector(".os-mapa-corpo").innerHTML = `${podeAproximar ? `<button class="os-link os-mapa-zoom">${perto ? "Ver o Paraná inteiro" : "Aproximar da região das fichas"}</button>` : ""}${svgMapa(vista, cont, perto && podeAproximar)}
      <p class="os-mapa-info">${top.length ? `Mais atendimentos: ${top.join(", ")}.` : "Nenhuma ficha lida com esse lugar ainda."} Toque numa área para ver o número.</p>
      ${fora ? `<p class="os-sub">${fmt(fora)} ${fora === 1 ? "ficha" : "fichas"} ${foraTxt}.</p>` : ""}`;
    el.querySelectorAll(".os-mapa-vistas button").forEach(b => b.classList.toggle("on", b.dataset.vista === vista));
    const info = el.querySelector(".os-mapa-info");
    const z = el.querySelector(".os-mapa-zoom"); if (z) z.onclick = () => { perto = !perto; desenhar(); };
    el.querySelectorAll(".os-mapa-svg path").forEach(p => (p.onclick = () => {
      el.querySelectorAll(".os-mapa-svg path.sel").forEach(x => x.classList.remove("sel"));
      p.classList.add("sel"); p.parentNode.append(p); // traz para a frente (contorno inteiro)
      info.innerHTML = `<b>${esc(p.dataset.nome)}</b>: ${fmt(p.dataset.v)} ${+p.dataset.v === 1 ? "atendimento" : "atendimentos"}`;
    }));
  };
  el.querySelectorAll(".os-mapa-vistas button").forEach(b => (b.onclick = () => { vista = b.dataset.vista; aoTrocar(vista); desenhar(); }));
  desenhar();
}
export const cartaoMapa = (icone) => `<section class="os-cartao os-mapa">
  <div class="os-cab"><h3>${icone} Mapa dos atendimentos</h3></div>
  <div class="os-mapa-vistas" role="tablist">${VISTAS.map(([k, n]) => `<button data-vista="${k}" role="tab">${n}</button>`).join("")}</div>
  <div class="os-mapa-corpo"></div>
</section>`;
