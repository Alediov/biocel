// Interface dos baús (slots e abertura), das poções e das gemas.
import { E } from "./estado.js";
import * as EC from "./economia.js";
import { tocar, vibrar } from "./sons.js";
import { modal, toast, confete } from "./ui.js";
import { cartaHTML } from "./telaColecao.js";
import { CARTAS, RARIDADES_CARTA, arteCarta } from "./colecao.js";
import { icone } from "./icones.js";
import { PLANTAS, RARIDADES_PLANTA } from "./jardim.js";
import { plantaSVG } from "./arte/plantas.js";
import { uid, vol, volE, pRet, sombraDe, faisca, parte, bolha, estrela5 } from "./arte/kit.js";

const TINTA = "#1B2340";

// Cada baú tem o mesmo esqueleto (corpo, tampa que abre, fechadura) e enfeites próprios.
const T3 = `stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"`;
const T2 = `stroke="${TINTA}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const estrela = (x, y, r, cor) => `<path d="M${x} ${y - r} L${x + r * .32} ${y - r * .32} L${x + r} ${y} L${x + r * .32} ${y + r * .32} L${x} ${y + r} L${x - r * .32} ${y + r * .32} L${x - r} ${y} L${x - r * .32} ${y - r * .32}Z" fill="${cor}"/>`;
const ESTILO_BAU = {
  madeira: { metal: "#7F8AA3", corpo: (r) => `<path d="M14 52 H86 M14 74 H86" stroke="${r.escura}" stroke-width="1.6" opacity=".7"/><circle cx="20" cy="66" r="1.2" fill="${r.escura}"/><circle cx="80" cy="52" r="1.2" fill="${r.escura}"/>`,
    tampa: (r) => `<path d="M13 34 Q30 24 50 24 Q70 24 87 34" stroke="${r.escura}" stroke-width="1.6" fill="none" opacity=".7"/>` },
  prata: { metal: "#5E6A80", corpo: (r) => [20, 80].map(x => [48, 60, 72].map(y => `<circle cx="${x + 8}" cy="${y}" r="1.6" fill="${r.brilho}" stroke="${TINTA}" stroke-width=".8"/>`).join("")).join(""),
    tampa: (r) => `<circle cx="28" cy="24" r="1.6" fill="${r.brilho}"/><circle cx="72" cy="24" r="1.6" fill="${r.brilho}"/><circle cx="28" cy="36" r="1.6" fill="${r.brilho}"/><circle cx="72" cy="36" r="1.6" fill="${r.brilho}"/>` },
  ouro: { metal: "#B07508", corpo: () => `<circle cx="28" cy="71" r="3" fill="#E0434A" ${T2}/><circle cx="72" cy="71" r="3" fill="#2F6BFF" ${T2}/>`,
    tampa: () => `<path d="M50 14 l5 6 l-5 6 l-5 -6z" fill="#E0434A" ${T2}/>`, joia: "#E0434A" },
  epico: { metal: "#3B1E7A", aura: .25, corpo: () => `<path d="M38 70 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6" stroke="#9FF3FF" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>`,
    tampa: () => `${estrela(50, 26, 6, "#9FF3FF")}<path d="M18 38 q6 -6 12 0 M70 38 q6 -6 12 0" stroke="#9FF3FF" stroke-width="1.8" fill="none" opacity=".8"/>`, joia: "#9FF3FF" },
  lendario: { metal: "#8A2A00", aura: .4, raios: true, corpo: () => `<path d="M50 66 l7 7 l-7 8 l-7 -8z" fill="#FFE08A" ${T2}/><path d="M43 73 h14" stroke="#E0A512" stroke-width="1.4"/><circle cx="20" cy="72" r="2.5" fill="#FFE08A"/><circle cx="80" cy="72" r="2.5" fill="#FFE08A"/>`,
    tampa: () => `<path d="M36 14 L38 4 L44 10 L50 0 L56 10 L62 4 L64 14 Z" fill="#FFC93C" ${T2}/><circle cx="50" cy="9" r="1.8" fill="#E0434A"/>`, joia: "#E0434A" },
  escolha: { metal: "#2A3F70", corpo: () => `<path d="M50 43 V83 H86 V48 Q86 43 82 43 Z" fill="#F07BB0"/><path d="M50 43 V83" stroke="${TINTA}" stroke-width="2"/>`,
    tampa: () => `<path d="M50 13 V43 H89 V30 Q89 14 50 13Z" fill="#F07BB0"/><rect x="30" y="20" width="10" height="14" rx="2" fill="#fff" ${T2} transform="rotate(-12 35 27)"/><rect x="60" y="20" width="10" height="14" rx="2" fill="#fff" ${T2} transform="rotate(12 65 27)"/><text x="50" y="33" text-anchor="middle" font-family="Bricolage, sans-serif" font-weight="800" font-size="11" fill="${TINTA}">?</text>`, joia: "#FFE08A" },
  jardineiro: { metal: "#8A5A3B", corpo: () => `<path d="M14 80 C24 70 30 82 40 74 C50 66 56 80 66 72 C74 66 80 76 86 70" stroke="#2F7A4A" stroke-width="2.4" fill="none"/>${[[24, 74], [44, 72], [64, 72], [80, 70]].map(([x, y]) => `<path d="M${x} ${y} q-5 -6 0 -9 q5 3 0 9z" fill="#9BE3B8" ${T2}/>`).join("")}`,
    tampa: () => `${Array.from({ length: 6 }, (_, i) => `<ellipse cx="50" cy="8" rx="3.5" ry="6" fill="#FFC24B" ${T2} transform="rotate(${i * 60} 50 14)"/>`).join("")}<circle cx="50" cy="14" r="4" fill="#E0434A" ${T2}/><path d="M16 36 q8 -10 16 -4" stroke="#2F7A4A" stroke-width="2.4" fill="none"/>` },
  caminhos: { metal: "#C9A227", aura: .2, corpo: () => `<path d="M50 82 V74 M50 74 L42 68 M50 74 L58 68 M50 74 V67" stroke="#FFD66B" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="41" cy="67" r="2.2" fill="#FFD66B"/><circle cx="59" cy="67" r="2.2" fill="#FFD66B"/><circle cx="50" cy="66" r="2.2" fill="#FFD66B"/>`,
    tampa: () => `${estrela(30, 30, 3.5, "#FFD66B")}${estrela(50, 22, 4.5, "#FFD66B")}${estrela(70, 30, 3.5, "#FFD66B")}`, joia: "#FFD66B" },
  gelado: { metal: "#2F7FB0", corpo: () => `<path d="M20 50 l4 6 M70 64 l6 4 M30 76 l-4 4" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`,
    tampa: () => `<path d="M12 44 l4 9 l4 -9 l5 12 l5 -12 l4 7 l4 -7 M58 44 l4 8 l4 -8 l5 11 l5 -11 l4 7 l4 -7" fill="#EAF8FF" ${T2}/><path d="M50 18 v16 M43 22 l14 8 M57 22 l-14 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`, joia: "#EAF8FF", depoisTampa: true },
  sorte: { metal: "#C9A227", corpo: () => `<circle cx="22" cy="72" r="3.2" fill="#FFC93C" ${T2}/><circle cx="78" cy="72" r="3.2" fill="#FFC93C" ${T2}/>`,
    tampa: () => `${[0, 90, 180, 270].map(r => `<path d="M50 26 C44 18 38 24 44 28 C38 32 44 38 50 30Z" fill="#7FE0A8" ${T2} transform="rotate(${r} 50 27)"/>`).join("")}<circle cx="50" cy="27" r="2.4" fill="#FFC93C"/>`, joia: "#FFC93C" },
  cristal: { metal: "#3E9EC4", aura: .2, corpo: () => `<path d="M14 44 L30 60 L14 82 M86 44 L70 60 L86 82 M30 60 H70 M38 44 L30 60 M62 44 L70 60" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7"/><path d="M36 64 l6 8 l6 -8 l-6 -4z" fill="#C9B8FF" ${T2}/><path d="M56 68 l5 7 l5 -7 l-5 -3z" fill="#FF9EC2" ${T2}/>`,
    tampa: () => `<path d="M10 44 L30 20 L50 14 L70 20 L90 44 M30 20 L40 44 M70 20 L60 44 M50 14 L50 44" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7"/>`, joia: "#C9B8FF", vidro: true },
  pirata: { metal: "#2A1A10", corpo: (r) => `${[[30, 52], [52, 50], [68, 54]].map(([x, y]) => `<ellipse cx="${x}" cy="${y - 10}" rx="5" ry="3" fill="#F2B33D" ${T2}/>`).join("")}<path d="M14 52 H86 M14 74 H86" stroke="${r.escura}" stroke-width="1.6"/>`,
    tampa: () => `<path d="M44 20 C44 14 56 14 56 20 L55 30 Q53 33 52 30 L50 26 L48 30 Q47 33 45 30 Z" fill="#fff" ${T2}/><circle cx="47.5" cy="21" r="1.4" fill="${TINTA}"/><circle cx="52.5" cy="21" r="1.4" fill="${TINTA}"/><path d="M38 36 L62 26 M38 26 L62 36" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M38 36 L62 26 M38 26 L62 36" stroke="${TINTA}" stroke-width="1" stroke-linecap="round" opacity=".4"/>`, joia: "#F2B33D", frente: () => `${[[16, 86], [26, 88], [21, 82], [84, 87], [92, 85]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="3" fill="#F2B33D" ${T2}/>`).join("")}` },
  temporada: { metal: "#FFD66B", aura: .3, raios: true, corpo: () => `<path d="M38 82 C30 74 30 66 34 60 M62 82 C70 74 70 66 66 60" stroke="#FFD66B" stroke-width="2.2" fill="none"/>${[[33, 66], [32, 74], [67, 66], [68, 74]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.6" fill="#FFD66B" transform="rotate(${x < 50 ? -40 : 40} ${x} ${y})"/>`).join("")}`,
    tampa: () => `<circle cx="50" cy="26" r="9" fill="#FFD66B" ${T2}/><path d="M50 20.5 l1.7 3.5 3.8.5 -2.8 2.6 .7 3.7 -3.4-1.9 -3.4 1.9 .7-3.7 -2.8-2.6 3.8-.5z" fill="#B07508"/><path d="M44 14 L50 4 L56 14" fill="#E0434A" ${T2}/>`, joia: "#FFD66B" },
  festa: { metal: "#B8457E", corpo: () => `<rect x="46" y="43" width="8" height="40" fill="#FFE08A"/>${[[20, 50, "#7FD6F5"], [80, 76, "#FFC24B"], [30, 78, "#9B5CF6"], [74, 50, "#4CAF6E"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2" fill="${c}"/>`).join("")}`,
    tampa: () => `<rect x="46" y="13" width="8" height="31" fill="#FFE08A"/><path d="M50 13 C40 2 30 6 36 12 C40 16 46 14 50 13 C54 14 60 16 64 12 C70 6 60 2 50 13Z" fill="#FFE08A" ${T2}/>`, joia: "#FFE08A" },
};
const RAROS = ["ouro", "epico", "lendario", "cristal", "temporada", "caminhos", "festa"];
/** Baú (guia v2): corpo e tampa com volume, tiras, fechadura e os enfeites de cada tipo. Os raros têm um brilho que
 *  passa na tampa e faíscas; aberto, sai luz de dentro com faíscas subindo. */
export function svgBau(raridade, { classe = "", aberto = false } = {}) {
  const r = EC.RARIDADES[raridade] || EC.RARIDADES.madeira, e = ESTILO_BAU[raridade] || ESTILO_BAU.madeira;
  const raro = RAROS.includes(raridade);
  const aura = e.aura ? `<circle cx="50" cy="50" r="44" fill="${r.brilho}" opacity="${e.aura}" class="aura"/>` : "";
  const raios = e.raios ? `<g class="aura" opacity=".5">${Array.from({ length: 8 }, (_, i) => `<path d="M50 50 L${(50 + Math.cos(i * Math.PI / 4) * 50).toFixed(1)} ${(50 + Math.sin(i * Math.PI / 4) * 50).toFixed(1)}" stroke="${r.brilho}" stroke-width="6" stroke-linecap="round"/>`).join("")}</g>` : "";
  const op = e.vidro ? 0.86 : null;
  const corpoD = pRet(12, 42, 76, 42, 6), tampaD = "M10 44 L10 30 Q10 12 50 12 Q90 12 90 30 L90 44 Z";
  const fechadura = `${vol(pRet(42, 38, 16, 18, 3), r.brilho, { k: 1, contorno: 3 })}<circle cx="50" cy="46" r="2.6" fill="${e.joia || TINTA}" stroke="${TINTA}" stroke-width="${e.joia ? 1.2 : 0}"/><path d="M50 47 v4" stroke="${TINTA}" stroke-width="2"/>`;
  const idT = uid("bt");
  const varre = raro && !aberto ? `<clipPath id="${idT}"><path d="${tampaD}"/></clipPath><g clip-path="url(#${idT})">${parte("pa-varre", 50, 28, `<path d="M40 8 L52 8 L38 48 L26 48Z" fill="#fff" opacity=".55"/>`)}</g>` : "";
  const dentro = aberto ? `<path d="M12 46 L14 33 Q50 25 86 33 L88 46Z" fill="${sombraDe(r.escura, 1.7)}" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="50" cy="40" rx="30" ry="6" fill="${r.brilho}" opacity=".9"/><ellipse cx="50" cy="41" rx="18" ry="3.6" fill="#FFFDF0"/>` : "";
  const luz = aberto ? `${parte("pa-luz", 50, 30, `<path d="M16 42 L0 -4 H100 L84 42Z" fill="${r.brilho}" opacity=".38"/><path d="M32 42 L24 -4 H76 L68 42Z" fill="#FFF8D6" opacity=".55"/>`)}` : "";
  const sobeLuz = aberto ? `${faisca(36, 30, 4.4, "#FFF3B0", 0)}${faisca(62, 22, 5.4, "#FFFFFF", 0.6)}${faisca(48, 10, 3.6, "#FFE08A", 1.2)}${faisca(74, 8, 3, "#FFFFFF", 1.8)}` : "";
  const faiscas = raro && !aberto ? `${faisca(8, 26, 3.4, r.brilho, 0.2)}${faisca(93, 40, 2.8, r.brilho, 1.1)}${faisca(86, 8, 3, "#FFFFFF", 1.8)}` : "";
  return `<svg class="bau bau-${raridade} anima ${classe}" viewBox="0 0 100 92" aria-label="${r.nome}">
    ${raios}${aura}${luz}
    <ellipse cx="50" cy="88" rx="36" ry="4" fill="#000" opacity=".15"/>
    ${dentro}
    ${vol(corpoD, r.cor, { k: 3.4, contorno: 0, op })}
    ${e.corpo(r)}
    <rect x="13.5" y="58" width="73" height="6" fill="${r.escura}"/>
    <rect x="24" y="43.5" width="8" height="39" fill="${r.escura}"/><rect x="68" y="43.5" width="8" height="39" fill="${r.escura}"/>
    <path d="M25.6 46 v34 M69.6 46 v34" stroke="${r.brilho}" stroke-width="1.2" opacity=".45"/>
    <path d="${corpoD}" fill="none" ${T3}/>
    <path d="M18 48 h10" stroke="${r.brilho}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
    <g class="tampa" style="transform-origin: 50px 44px; ${aberto ? "transform: rotate(-24deg) translateY(-14px)" : ""}">
      ${vol(tampaD, r.cor, { k: 3, contorno: 0, op })}
      <path d="M28 44 V16.5 M72 44 V16.5" stroke="${r.escura}" stroke-width="8"/>
      ${e.tampa(r)}
      ${varre}
      <path d="${tampaD}" fill="none" ${T3}/>
      <path d="M18 30 Q22 20 34 18" stroke="${r.brilho}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>
    </g>
    ${fechadura}${e.frente ? e.frente(r) : ""}${faiscas}${sobeLuz}
  </svg>`;
}
/** Poção (guia v2): frasco de vidro com volume, líquido com bolhas que sobem, rolha, brilho e o multiplicador. */
export function svgPocao(tipo, classe = "") {
  const p = EC.POCOES[tipo], id = uid("pc");
  const frasco = "M24 12 h12 v12 l14 18 a20 20 0 1 1 -40 0 l14 -18 z";
  return `<svg class="pocao anima ${classe}" viewBox="0 0 60 70" aria-label="${p.nome}">
    ${parte("pa-luz", 30, 46, `<circle cx="30" cy="46" r="24" fill="${p.cor}" opacity=".16"/>`)}
    ${vol(pRet(22, 4, 16, 8, 2), "#C98E5A", { k: 1, contorno: 2.5 })}<path d="M25 7 h4" stroke="#E6B88A" stroke-width="1.4" stroke-linecap="round"/>
    ${vol(frasco, "#EAF6FF", { k: 2.4, contorno: 0, sombra: "#CFE3F5" })}
    <clipPath id="${id}"><path d="${frasco}"/></clipPath>
    <g clip-path="url(#${id})">
      ${vol("M6 44 q8 -5 12 -2 t12 0 t12 0 t12 -1 V72 H6Z", p.cor, { k: 2.4, contorno: 0 })}
      ${bolha(22, 58, 2.2, 0)}${bolha(36, 62, 1.6, 0.9)}${bolha(30, 54, 1.2, 1.7)}${bolha(40, 56, 1.4, 2.3)}
    </g>
    <path d="${frasco}" fill="none" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M17 42 q-4 6 -3 12" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8"/>
    <rect x="17" y="30" width="26" height="14" rx="5" fill="#fff" stroke="${TINTA}" stroke-width="2"/>
    <text x="30" y="41" text-anchor="middle" font-family="Bricolage, sans-serif" font-weight="800" font-size="11.5" fill="${TINTA}">×${p.mult}</text>
    ${faisca(52, 18, 3, "#FFE08A", 0.4)}
  </svg>`;
}
export const svgGema = (classe = "") => `<svg class="gema ${classe}" viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#3FBAD8"/><path d="M6 3h12l4 6H2z" fill="#7FE3F5"/><path d="M8 3l-2 6 6 12 6-12-2-6z" fill="#5AD3EC"/><path d="M8 3h8l2 6H6z" fill="#B8F3FF"/><path d="M6 3h12l4 6-10 12L2 9z" fill="none" stroke="${TINTA}" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 9h20M8 3l-2 6 6 12 6-12-2-6" fill="none" stroke="#1E8FB3" stroke-width="1" stroke-linejoin="round"/><path d="M8.6 4.6l-1.4 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const svgMoeda = `<svg viewBox="0 0 24 24" class="item-svg"><circle cx="12" cy="12" r="10" fill="#F2A922" stroke="${TINTA}" stroke-width="1.6"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#FFE08A" stroke-width="1.6"/><path d="M12 8v8" stroke="${TINTA}" stroke-width="2" stroke-linecap="round"/></svg>`;
const svgXp = `<svg viewBox="0 0 24 24" class="item-svg"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#F2A922" stroke="${TINTA}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

// ---------- slots na trilha ----------
let relogio = null;
export function desenharSlots(container) {
  EC.avancarAutoAbertura(); // abertura automática (upgrade da loja): põe a fila em dia pelo relógio
  const est = E();
  const box = document.createElement("div"); box.className = "slots-baus";
  est.baus.slots.forEach((b, i) => {
    const sit = EC.situacao(b);
    const el = document.createElement("button");
    el.className = `slot-bau ${sit}`;
    if (sit === "vazio") { el.innerHTML = `<div class="slot-vazio"></div><small>Slot livre</small>`; el.onclick = () => toast("Complete a trilha do dia inteira para ganhar um baú."); }
    else {
      const r = EC.RARIDADES[b.raridade];
      const rot = sit === "pronto" ? `<b class="pronto-txt">ABRIR!</b>` : sit === "abrindo" ? `<b data-relogio="${i}">${EC.fmtTempo(EC.restanteMs(b))}</b>` : `<b>${r.horas}h</b>`;
      el.innerHTML = `${svgBau(b.raridade, { classe: sit === "pronto" ? "pulando" : sit === "abrindo" ? "" : "" })}${rot}<small>${sit === "fechado" ? "Toque para abrir" : sit === "abrindo" ? "Abrindo…" : r.nome}</small>`;
      el.onclick = () => tocarSlot(i, container);
    }
    box.append(el);
  });
  const pr = EC.precoProximoSlot();
  if (pr) { // slot a mais à venda (economia.js, comprarSlot)
    const m = document.createElement("button"); m.className = "slot-bau comprar"; m.setAttribute("aria-label", `Comprar o ${pr.numero}º slot`);
    m.innerHTML = `<div class="slot-mais">+</div><small>${pr.numero}º slot</small>`;
    m.onclick = () => comprarSlotModal(() => desenharSlots(container));
    box.append(m);
  }
  container.querySelector(".slots-baus")?.remove();
  container.querySelector(".faixa-escolha")?.remove();
  container.querySelector(".auto-baus")?.remove();
  container.prepend(box);
  const auto = EC.autoBaus();
  if (auto?.comprado) {
    const a = document.createElement("button"); a.className = `auto-baus ${auto.ligado ? "ligado" : ""}`;
    a.innerHTML = `${icone("⚙️", "ico-inline")}<span>Abertura automática: <b>${auto.ligado ? "ligada" : "desligada"}</b>${auto.ligado ? ` · ${EC.ORDENS_AUTO[auto.ordem || "rapido"].toLowerCase()}` : ""}</span>`;
    a.onclick = () => configurarAuto(() => desenharSlots(container));
    box.after(a);
  }
  if (EC.escolhaPendente()) {
    const f = document.createElement("button"); f.className = "faixa-escolha";
    f.innerHTML = `${svgBau(EC.escolhaPendente().raridade)}<span><b>Escolha pendente</b><small>Um baú ainda espera a sua escolha. Toque para escolher.</small></span>`;
    f.onclick = () => retomarEscolha(() => desenharSlots(container));
    box.after(f);
  }
  clearInterval(relogio);
  relogio = setInterval(() => {
    if (!document.body.contains(box)) return clearInterval(relogio);
    let mudou = EC.avancarAutoAbertura();
    box.querySelectorAll("[data-relogio]").forEach(x => {
      const b = E().baus.slots[+x.dataset.relogio];
      if (EC.situacao(b) === "pronto") mudou = true; else x.textContent = EC.fmtTempo(EC.restanteMs(b));
    });
    if (mudou) desenharSlots(container);
  }, 20000);
}

async function tocarSlot(i, container) {
  const b = E().baus.slots[i], sit = EC.situacao(b), r = EC.RARIDADES[b.raridade];
  if (sit === "pronto") return abrirComAnimacao(i, () => desenharSlots(container));
  if (sit === "fechado") {
    if (EC.algumAbrindo()) {
      const custo = EC.custoAcelerar(b);
      const v = await modal({ titulo: r.nome, html: svgBau(b.raridade, { classe: "bau-modal" }), texto: `Só um baú abre por vez. Você pode abrir este agora com gemas.`, botoes: [{ texto: `Abrir agora por ${custo} gemas`, valor: "gemas" }, { texto: "Esperar", classe: "secundario", valor: null }] });
      if (v === "gemas") { if (EC.acelerar(i)) abrirComAnimacao(i, () => desenharSlots(container)); else toast(`Faltam gemas: você tem ${EC.gemas()}.`); }
      return;
    }
    const v = await modal({ titulo: r.nome, html: svgBau(b.raridade, { classe: "bau-modal" }), texto: `${r.especial ? `${r.especial} ` : ""}Leva ${r.horas} horas para abrir. O tempo corre mesmo com o app fechado, e você recebe um aviso quando ficar pronto.`, botoes: [{ texto: "Começar a abrir", valor: "abrir" }, { texto: `Abrir agora por ${EC.custoAcelerar(b)} gemas`, valor: "gemas", classe: "secundario" }] });
    if (v === "abrir") { EC.iniciarAbertura(i); tocar("toque"); desenharSlots(container); }
    else if (v === "gemas") { if (EC.acelerar(i)) abrirComAnimacao(i, () => desenharSlots(container)); else toast(`Faltam gemas: você tem ${EC.gemas()}.`); }
    return;
  }
  if (sit === "abrindo") {
    const custo = EC.custoAcelerar(b);
    const v = await modal({ titulo: r.nome, html: svgBau(b.raridade, { classe: "bau-modal" }), texto: `Fica pronto em ${EC.fmtTempo(EC.restanteMs(b))}.`, botoes: [{ texto: `Abrir agora por ${custo} gemas`, valor: "gemas" }, { texto: "Esperar", classe: "secundario", valor: null }] });
    if (v === "gemas") { if (EC.acelerar(i)) abrirComAnimacao(i, () => desenharSlots(container)); else toast(`Faltam gemas: você tem ${EC.gemas()}.`); }
  }
}

/** Compra de um slot a mais, com moedas ou gemas (da trilha e da loja). */
export async function comprarSlotModal(depois = () => {}) {
  const pr = EC.precoProximoSlot();
  if (!pr) return toast(`Você já tem os ${EC.SLOTS_MAX} slots.`);
  const est = E(), temM = (est.moedas || 0) >= pr.moedas, temG = (est.gemas || 0) >= pr.gemas;
  const v = await modal({ titulo: `${pr.numero}º slot de baú`, html: `<div class="slot-mais grande">+</div>`,
    texto: `Mais um lugar para guardar baús (até ${EC.SLOTS_MAX}). Você tem ${est.moedas || 0} moedas e ${est.gemas || 0} gemas.`,
    botoes: [{ texto: `${pr.moedas} moedas`, valor: "moedas", classe: temM ? "" : "secundario" }, { texto: `${pr.gemas} gemas`, valor: "gemas", classe: temG ? "" : "secundario" }, { texto: "Agora não", classe: "secundario", valor: null }] });
  if (!v) return;
  const r = EC.comprarSlot(v);
  if (r.erro) return toast(r.erro);
  tocar("combo"); confete(1200); toast(`${r.slot}º slot liberado!`);
  depois();
}

/** Ajustes da abertura automática (liga/desliga e a ordem da fila). */
export async function configurarAuto(depois = () => {}) {
  const a = EC.autoBaus(); if (!a?.comprado) return;
  let ordem = a.ordem || "rapido";
  const html = `<div class="auto-cfg"><h2>Abertura automática</h2><p class="sub">Quando o baú que está abrindo termina, o próximo da fila começa sozinho, mesmo com o app fechado.</p>
    <p class="ups-rotulo">Qual abre primeiro</p><div class="ups-seg">${Object.entries(EC.ORDENS_AUTO).map(([k, t]) => `<button class="chip-filtro ${k === ordem ? "on" : ""}" data-o="${k}" type="button">${t}</button>`).join("")}</div></div>`;
  const pr = modal({ titulo: "", html, botoes: [{ texto: a.ligado ? "Desligar" : "Ligar", valor: "trocar", classe: a.ligado ? "secundario" : "" }, { texto: "Pronto", valor: "ok" }] });
  document.querySelectorAll("#modal .ups-seg .chip-filtro").forEach(b => (b.onclick = () => {
    ordem = b.dataset.o; document.querySelectorAll("#modal .ups-seg .chip-filtro").forEach(x => x.classList.toggle("on", x === b));
    EC.ajustarAuto({ ordem }); tocar("toque");
  }));
  const v = await pr;
  if (v === "trocar") { const liga = !EC.autoBaus()?.ligado; EC.ajustarAuto({ ligado: liga }); tocar("toque"); toast(`Abertura automática ${liga ? "ligada" : "desligada"}.`); }
  depois();
}

// ---------- animação de abertura ----------
function itemHtml(it) {
  if (it.tipo === "moedas") return { svg: svgMoeda, nome: "Moedas", qtd: it.qtd };
  if (it.tipo === "xp") return { svg: svgXp, nome: "XP", qtd: it.qtd };
  if (it.tipo === "gemas") return { svg: svgGema("item-svg"), nome: "Gemas", qtd: it.qtd };
  if (it.tipo === "pocao") return { svg: svgPocao(it.pocao, "item-svg"), nome: `${EC.POCOES[it.pocao].nome} (${EC.POCOES[it.pocao].min} min)`, qtd: it.qtd };
  if (it.tipo === "carta") { const c = CARTAS[it.carta]; return { svg: `<div class="item-carta">${cartaHTML(it.carta, { mini: true })}${it.nova ? '<span class="selo-nova">NOVA!</span>' : ""}</div>`, nome: `${c.nome} (${RARIDADES_CARTA[c.raridade].nome.toLowerCase()})`, qtd: it.qtd, carta: true, nova: it.nova, raridade: c.raridade }; }
  if (it.tipo === "semente") { const p = PLANTAS[it.planta]; return { svg: `<div class="item-carta item-planta">${plantaSVG(it.planta, { humor: "uau", classe: "item-svg" })}${it.nova ? '<span class="selo-nova">NOVA!</span>' : ""}</div>`, nome: `Semente: ${p.nome}`, qtd: it.qtd, carta: true, nova: it.nova, raridade: p.raridade === "epica" ? "epica" : p.raridade === "lendaria" ? "lendaria" : "comum" }; }
  return { svg: `<div class="item-svg">${icone("🧊", "ico3d ico-item")}</div>`, nome: "Congelamento de ofensiva", qtd: it.qtd };
}

/** Arte e nome de uma opção de baú de escolha. */
function opcaoHtml(o) {
  if (o.tipo === "carta") { const c = CARTAS[o.carta], tem = !!E().colecao?.cartas?.[o.carta]; const rc = RARIDADES_CARTA[c.raridade]; return `<div class="op-arte"><div class="moldura-oferta" style="--cor:${rc.cor};--escura:${rc.escura}">${arteCarta(o.carta, { classe: "vivo" })}</div></div><b>${c.nome}</b><small>×${o.qtd} · ${RARIDADES_CARTA[c.raridade].nome}${tem ? "" : " · nova!"}</small>`; }
  if (o.tipo === "semente") { const p = PLANTAS[o.planta], tem = !!E().jardim?.plantas?.[o.planta]; return `<div class="op-arte">${plantaSVG(o.planta, { humor: "uau", classe: "item-svg" })}</div><b>${p.nome}</b><small>Semente · ${RARIDADES_PLANTA[p.raridade]?.nome || p.raridade}${tem ? "" : " · nova!"}</small>`; }
  return `<div class="op-arte">${svgGema("item-svg")}</div><b>${o.qtd} gemas</b><small>Direto para a carteira</small>`;
}
/** Mostra as opções e resolve com o item entregue. */
function escolherNaTela(rev, pend, titulo) {
  return new Promise((ok) => {
    const n = pend.opcoes.length;
    rev.innerHTML = `<div class="escolha-bau"><p class="escolha-tit">${titulo}</p><div class="escolha-ops n${n}">${pend.opcoes.map((o, k) => `<button class="op-bau ${o.tipo === "carta" ? CARTAS[o.carta].raridade : o.tipo === "semente" ? PLANTAS[o.planta].raridade : "gema"}" data-k="${k}">${opcaoHtml(o)}</button>`).join("")}</div></div>`;
    rev.querySelectorAll(".op-bau").forEach(b => (b.onclick = (ev) => {
      ev.stopPropagation();
      const item = EC.escolherDoBau(+b.dataset.k);
      rev.querySelectorAll(".op-bau").forEach(x => x.classList.add(x === b ? "escolhida" : "descartada"));
      tocar(item?.nova ? "ofensiva" : "combo"); vibrar([30, 40, 60]); if (item?.nova) confete(1200);
      setTimeout(() => ok(item), 650);
    }));
  });
}
/** Escolha que ficou pendente (o app fechou no meio): abre só a parte da escolha. */
export function retomarEscolha(depois = () => {}) {
  const pend = EC.escolhaPendente(); if (!pend) return;
  const r = EC.RARIDADES[pend.raridade] || EC.RARIDADES.escolha;
  const ov = document.createElement("div"); ov.className = "abertura aberto";
  ov.style.setProperty("--cor-bau", r.cor); ov.style.setProperty("--brilho-bau", r.brilho);
  ov.innerHTML = `<div class="raios"></div><div class="nome-bau">${r.nome}</div><div class="item-revelado"></div><p class="dica-toque"></p>`;
  document.body.append(ov);
  escolherNaTela(ov.querySelector(".item-revelado"), pend, pend.opcoes.length === 3 ? "Escolha um caminho" : "Escolha uma").then(() => { ov.remove(); depois(); });
}

export function abrirComAnimacao(i, depois = () => {}) {
  const res = EC.abrirBau(i);
  if (!res) return;
  const r = EC.RARIDADES[res.raridade];
  const ov = document.createElement("div"); ov.className = "abertura";
  ov.style.setProperty("--cor-bau", r.cor); ov.style.setProperty("--brilho-bau", r.brilho);
  ov.innerHTML = `<div class="raios"></div><div class="palco-bau">${svgBau(res.raridade, { classe: "bau-grande tremendo" })}</div><div class="nome-bau">${r.nome}</div><div class="item-revelado"></div><p class="dica-toque">Toque para continuar</p>`;
  document.body.append(ov);
  tocar("bau"); vibrar(80);
  const palco = ov.querySelector(".palco-bau"), rev = ov.querySelector(".item-revelado"), dica = ov.querySelector(".dica-toque");
  let passo = -1, ocupado = false, escolhido = null;
  const mostrarItem = (it) => {
    const h = itemHtml(it);
    rev.innerHTML = `<div class="item-card ${h.carta ? `revela-carta ${h.raridade}` : ""}">${h.svg}<b>${h.carta ? "×" : "+"}${h.qtd.toLocaleString("pt-BR")}</b><span>${h.nome}</span></div>`;
    if (h.carta && (h.nova || h.raridade === "lendaria" || h.raridade === "epica")) { tocar("ofensiva"); confete(1200); vibrar([30, 40, 60]); }
    else { tocar(it.tipo === "gemas" ? "combo" : "moeda"); vibrar(25); }
  };
  const roleta = (it) => { // gira ×1 ×2 ×3 ×5 e para no sorteado
    ocupado = true; dica.style.visibility = "hidden";
    const vals = [1, 2, 3, 5];
    rev.innerHTML = `<div class="roleta-bau"><span>Roleta da sorte</span><b>×1</b></div>`;
    const b = rev.querySelector("b");
    let k = 0, atraso = 60;
    const gira = () => {
      b.textContent = `×${vals[k++ % 4]}`; tocar("toque");
      atraso *= 1.13;
      if (atraso < 420 || vals[(k - 1) % 4] !== it.roleta) return setTimeout(gira, atraso);
      b.classList.add("parou"); tocar(it.roleta >= 3 ? "ofensiva" : "par"); if (it.roleta >= 3) confete(1200);
      setTimeout(() => { mostrarItem(it); rev.insertAdjacentHTML("beforeend", `<p class="roleta-res">Moedas ×${it.roleta}!</p>`); ocupado = false; dica.style.visibility = ""; }, 900);
    };
    gira();
  };
  const proximo = async () => {
    if (ocupado) return;
    passo++;
    if (passo === 0) {
      palco.innerHTML = svgBau(res.raridade, { classe: "bau-grande", aberto: true });
      ov.classList.add("aberto"); confete(1600); tocar("fim");
      if (r.especial) rev.innerHTML = `<p class="especial-bau">${r.especial}</p>`;
      return;
    }
    const it = res.itens[passo - 1];
    if (it) { if (it.roleta) roleta(it); else mostrarItem(it); return; }
    if (passo === res.itens.length + 1 && res.escolha && !escolhido) {
      ocupado = true; palco.innerHTML = ""; dica.style.visibility = "hidden";
      escolhido = await escolherNaTela(rev, EC.escolhaPendente() || { opcoes: res.escolha }, res.escolha.length === 3 ? "Escolha um caminho" : "Escolha uma");
      if (escolhido) res.itens.push(escolhido);
      ocupado = false; dica.style.visibility = ""; passo--; // segue para o resumo no próximo toque
      proximo(); return;
    }
    if (passo === res.itens.length + 1) {
      palco.innerHTML = "";
      ov.querySelector(".nome-bau").textContent = "Você ganhou";
      rev.innerHTML = `<div class="resumo-itens">${res.itens.map(it => { const h = itemHtml(it); return `<div class="${h.carta ? "ri-carta" : ""}">${h.svg}<b>${h.carta ? "×" : "+"}${h.qtd}</b><small>${h.nome}</small></div>`; }).join("")}</div>`;
      dica.textContent = "Toque para fechar";
      return;
    }
    ov.remove(); depois(); window.dispatchEvent(new Event("oq-agenda")); window.dispatchEvent(new Event("oq-titulos"));
  };
  setTimeout(() => { ov.onclick = proximo; }, 700);
}

/** Tela "ganhou um baú" ao completar a trilha do dia. */
export function htmlBauGanho(res, titulo = "Trilha do dia completa!") {
  if (res.cheio) return `<div class="fim">${svgBau(res.raridade, { classe: "bau-grande" })}<h1>${titulo}</h1><p class="sub">Seus slots estão cheios, então o ${EC.RARIDADES[res.raridade].nome.toLowerCase()} virou ${res.moedas} moedas. Abra baús para não perder os próximos.</p></div>`;
  return `<div class="fim">${svgBau(res.raridade, { classe: "bau-grande pulando" })}<h1>${titulo}</h1><p>Você ganhou um <b>${EC.RARIDADES[res.raridade].nome.toLowerCase()}</b>.</p><p class="sub">${EC.RARIDADES[res.raridade].especial ? `${EC.RARIDADES[res.raridade].especial} ` : ""}Ele está nos slots da trilha. Leva ${EC.RARIDADES[res.raridade].horas}h para abrir.</p></div>`;
}

// ---------- poções ----------
// Antes, `preLicao` oferecia as poções a cada lição; desde 26/10/2026 (pedido do Alediov: "me incomoda elas
// aparecerem toda vez") a poção se ativa no painel do XP do topo (topo.js) ou aqui, na Mochila da loja.
export function desenharInventario(container, aoMudar = () => {}) {
  const sec = document.createElement("div"); sec.className = "secao";
  const ativa = EC.pocaoAtiva();
  sec.innerHTML = `<h2>Mochila</h2>${ativa ? `<div class="faixa-info">${icone("⚗️", "ico-inline")} Poção ×${ativa.mult} ativa: ${EC.minutosRestantesPocao()} min restantes. Todo XP ganho agora é multiplicado.</div>` : ""}`;
  const inv = EC.inventarioPocoes();
  const g = document.createElement("div"); g.className = "grade-loja";
  if (!inv.length) sec.insertAdjacentHTML("beforeend", `<p class="sub">Nenhuma poção. Elas vêm nos baús ou podem ser compradas abaixo.</p>`);
  else if (!ativa) sec.insertAdjacentHTML("beforeend", `<p class="sub">Ative quando quiser, aqui ou no ${icone("⚡", "ico-inline")} XP do topo. Nada é oferecido ao começar uma lição.</p>`);
  for (const [tipo, qtd] of inv) {
    const p = EC.POCOES[tipo];
    const c = document.createElement("div"); c.className = "item-loja";
    c.innerHTML = `${svgPocao(tipo)}<h3>${p.nome}</h3><p>${p.min} min, você tem ${qtd}</p>`;
    const b = document.createElement("button"); b.className = "botao"; b.textContent = "Ativar"; b.disabled = !!ativa;
    b.onclick = () => { const r = EC.ativarPocao(tipo); if (r.ok) { tocar("combo"); toast(`XP ×${p.mult} pelos próximos ${r.p.min} min!`); aoMudar(); window.dispatchEvent(new Event("oq-topo")); } else toast(r.erro); };
    c.append(b); g.append(c);
  }
  if (inv.length) sec.append(g);
  container.append(sec);
}
