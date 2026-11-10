// Clima (7ª área do Órbita, config.area "clima"; pedido do Alediov em 02/11/2026: "criar ou um subapp ou alguma parte só
// para clima e temperatura, com detalhes de pressão, possibilidade de chuva, etc. Usando diferentes áreas/sites gratuitos
// com api"). Uma tela só, que rola: o céu de agora (muda com o tempo e a hora; parado com "reduzir movimento"), os avisos
// (chuva na ida ou na volta do ônibus, tempestade, frio, calor, UV, vento, ar), as próximas horas, o gráfico de 48 h, os
// próximos dias e os detalhes (sensação, umidade, vento com a rosa dos ventos, pressão, UV, visibilidade, ponto de
// orvalho, qualidade do ar, nascer e pôr do sol). As contas estão em tempo.js; a busca e o cache, em dados.js.
import { escapar, modal, toast } from "../ui.js";
import { hojeISO } from "../estado.js";
import { tocar } from "../sons.js";
import { icone } from "../icones.js";
import * as T from "./tempo.js";
import * as D from "./dados.js";
import { svgTempo } from "./icones.js";

let raiz = null, opts = {}, timers = [], geracao = 0, ouvindo = false, ultimaHora = "", ultimoMostrado = "";
const $ = (s, r = raiz) => r?.querySelector(s);
const reduzir = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ico = (tipo) => svgTempo(tipo, { animado: !reduzir() });
const fmt = (n, c = 0) => n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const DIAS_SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const diaSem = (d) => DIAS_SEM[new Date(d + "T12:00:00").getDay()];
const hm = (iso) => iso ? T.rotuloHora(iso) : "—";

const I = {
  pino: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.8" r="2.4" fill="currentColor"/></svg>',
  ler: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 01-14.3 4.9M4 12A8 8 0 0118.3 7.1M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  guarda: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0118 0z" fill="currentColor" opacity=".9"/><path d="M12 12v6.5a2 2 0 01-4 0M12 3v1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  vento: '<svg viewBox="0 0 24 24"><path d="M3 9h11a3 3 0 10-3-3M3 14h15a3 3 0 11-3 3M3 19h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  termo: '<svg viewBox="0 0 24 24"><path d="M10 4a2 2 0 014 0v9.5a4 4 0 11-4 0z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17" r="1.8" fill="currentColor"/><path d="M12 15V8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gota: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.6 6 11a6 6 0 01-12 0c0-4.4 6-11 6-11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  medidor: '<svg viewBox="0 0 24 24"><path d="M4.5 17a8.5 8.5 0 1115 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 14l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="14" r="1.6" fill="currentColor"/></svg>',
  olho: '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  sol: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  folha: '<svg viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  nuvem: '<svg viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 00.5-8 6 6 0 00-11.3 1.8A3.2 3.2 0 007 18z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  seta: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const ICO_AVISO = { chuva: () => I.guarda, vento: () => I.vento, frio: () => I.termo, calor: () => ico("sol"), uv: () => ico("sol"), tempestade: () => ico("tempestade"), ar: () => icone("😷", "ico3d") };

// ---------------------------------------------------------------- área
export async function abrirTelaClima(el, o = {}) {
  raiz = el; opts = o;
  raiz.classList.add("cl");
  cobrirFundo(el);
  raiz.innerHTML = `<main class="cl-tela"><div class="cl-vazio">Carregando o tempo…</div></main>`;
  if (!ouvindo) { // uma vez só (a área pode abrir e fechar várias vezes)
    ouvindo = true;
    window.addEventListener("oq-clima", () => { if (raiz?.isConnected) desenhar(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && raiz?.isConnected) atualizar(false, 30); });
  }
  timers.forEach(clearInterval);
  // a cada 30 min com a área aberta, busca de novo; a cada minuto, o "atualizado há" e a hora que virou
  timers = [setInterval(() => { if (raiz?.isConnected && document.visibilityState === "visible") atualizar(false, 30); }, 30 * 60e3),
    setInterval(() => { if (!raiz?.isConnected) return timers.forEach(clearInterval); tique(); }, 60e3)];
  desenhar();
  await atualizar(false, 10);
}

async function atualizar(forcar, idade = 10) {
  const b = $(".cl-ler");
  b?.classList.add("girando");
  const r = await D.atualizar({ forcar, idade });
  b?.classList.remove("girando");
  if (!raiz?.isConnected) return r;
  if (r.erro && (forcar || !r.clima)) toast(r.erro, 3500);
  else if (forcar && r.novo) toast("Tempo atualizado");
  if (!r.novo) desenhar(); // com dado novo, o evento oq-clima já redesenhou
  return r;
}

function tique() {
  const c = D.guardado(); if (!c) return;
  const id = $(".cl-idade"); if (id) id.textContent = textoIdade(c);
  const h = T.localISO(Date.now(), c.offset).slice(0, 13);
  if (h !== ultimaHora || D.mostrado() !== ultimoMostrado) desenhar(); // virou a hora (ou chegou a hora de mostrar outro lugar)
}
const textoIdade = (c) => { const m = D.idadeMin(c); return m < 1 ? "agora mesmo" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} ${m < 2880 ? "dia" : "dias"}`; };

// o que fica coberto não pinta nem anima (como nas Finanças e no Xadrez): `cl-cobre` no <html> esconde os Estudos atrás
// do Clima; com a Home por cima ou o app no fundo, o céu e os ícones do Clima param
function cobrirFundo(el) {
  const html = document.documentElement;
  const ver = () => {
    const viva = el.isConnected && el.style.opacity !== "0";
    html.classList.toggle("cl-cobre", viva);
    const parado = !viva || !!document.querySelector(".camada-home") || document.hidden;
    if (el.classList.contains("cl-parado") !== parado) {
      el.classList.toggle("cl-parado", parado);
      el.querySelectorAll("svg.tp-ico").forEach(s => { try { parado ? s.pauseAnimations() : s.unpauseAnimations(); } catch { /* sem SMIL */ } });
    }
    if (!el.isConnected) { obs1.disconnect(); obs2.disconnect(); document.removeEventListener("visibilitychange", ver); }
  };
  const obs1 = new MutationObserver(ver), obs2 = new MutationObserver(ver);
  obs1.observe(document.body, { childList: true });
  obs2.observe(el, { attributes: true, attributeFilter: ["style"] });
  document.addEventListener("visibilitychange", ver);
  ver();
}

// ---------------------------------------------------------------- desenho
async function desenhar() {
  if (!raiz) return;
  const g = ++geracao, c = D.guardado(), t = $(".cl-tela"), rol = t?.scrollTop || 0;
  if (!c) {
    t.innerHTML = `${topo(null)}<div class="cl-vazio">${navigator.onLine ? "Buscando o tempo…" : "Sem internet e sem nada guardado ainda. Assim que houver conexão, o tempo aparece aqui."}</div>`;
    ligarTopo(t); return;
  }
  const avs = await D.avisosDe(c), pc = await D.planoChuva();
  if (g !== geracao || !raiz?.isConnected) return;
  const ms = Date.now(), a = T.agoraDe(c, ms), hoje = T.proximosDias(c, ms, 1)[0] || {};
  ultimaHora = T.localISO(ms, c.offset).slice(0, 13);
  const sol = hoje.nascer ? { nascer: T.msDe(hoje.nascer, c.offset), por: T.msDe(hoje.por, c.offset) } : null;
  const ceu = T.ceuDe(a.cod, ms, sol);
  const alvo = document.createElement("div");
  alvo.innerHTML = `<section class="cl-ceu" data-periodo="${ceu.periodo}" data-tempo="${ceu.tempo}">
      ${decoracaoCeu(ceu)}
      ${topo(c)}
      <div class="cl-agora">
        <div class="cl-agora-ico">${ico(T.iconeDe(a.cod, a.dia))}</div>
        <div class="cl-agora-tx">
          <strong class="cl-temp">${a.t == null ? "—" : Math.round(a.t)}<span>°C</span></strong>
          <b>${escapar(T.textoDe(a.cod))}</b>
          <small>Sensação ${T.grau(a.sens)} · <span title="Máxima">↑ ${T.grau(hoje.max)}</span> <span title="Mínima">↓ ${T.grau(hoje.min)}</span></small>
        </div>
      </div>
      <p class="cl-idade-linha">${a.previsto ? "Previsão para agora · " : ""}atualizado <span class="cl-idade">${textoIdade(c)}</span> · ${c.fonte === "met.no" ? "MET Norway" : "Open-Meteo"}</p>
      ${avs.length ? `<ul class="cl-avisos">${avs.map(av => `<li class="cl-aviso ${av.tipo}"><span class="cl-av-ico">${(ICO_AVISO[av.tipo] || (() => I.gota))()}</span><span>${escapar(av.texto)}</span></li>`).join("")}</ul>` : ""}
    </section>
    <div class="cl-corpo">
      <div class="cl-col">
        ${secaoHoras(c, ms)}
        ${secaoGrafico(c, ms)}
      </div>
      <div class="cl-col">
        ${secaoDias(c, ms, a)}
      </div>
    </div>
    ${secaoDetalhes(c, a, hoje, ms)}
    ${secaoOpcoes(pc)}
    <footer class="cl-rodape">Previsão: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0), qualidade do ar do CAMS pelo Open-Meteo; reserva: <a href="https://api.met.no/" target="_blank" rel="noopener">MET Norway</a> (CC BY 4.0).</footer>`;
  t.replaceChildren(...alvo.childNodes);
  t.scrollTop = rol;
  ligarTopo(t);
  t.querySelectorAll(".cl-dia").forEach(b => (b.onclick = () => { tocar("toque"); b.classList.toggle("aberto"); b.setAttribute("aria-expanded", b.classList.contains("aberto")); }));
  const tc = t.querySelector('.cl-troca input[data-op="chuva"]');
  if (tc) tc.onchange = () => { tocar("toque"); D.definirAvisoChuva(tc.checked); toast(tc.checked ? "Aviso de chuva no caminho ligado" : "Aviso de chuva no caminho desligado"); desenhar(); };
  if (raiz.classList.contains("cl-parado")) t.querySelectorAll("svg.tp-ico").forEach(s => { try { s.pauseAnimations(); } catch { /* nada */ } });
}

function topo(c) {
  const q = D.mostrado(), l = q === "unico" ? c?.lugar || D.lugar() : D.lugarDe(q), sel = D.lugaresDoSeletor();
  const nome = q === "unico" ? T.nomeLugar(l) : D.NOMES_LUGAR[q]; // com os três lugares, só o nome (o endereço fica na folha)
  ultimoMostrado = q;
  return `<header class="cl-topo">
    <button class="cl-area" type="button" aria-label="Trocar de área"><span class="cl-logo">${opts.logo || ""}</span><span><b>Clima</b><small>Trocar de Área ▾</small></span></button>
    <button class="cl-lugar" type="button" aria-label="${q === "unico" ? "Trocar de cidade" : "Seus lugares"}">${I.pino}<span>${escapar(nome)}</span></button>
    <button class="cl-ler" type="button" aria-label="Atualizar o tempo">${I.ler}</button>
  </header>
  ${sel.length ? `<div class="cl-quais" role="radiogroup" aria-label="Lugar">${sel.map(x => `<button type="button" role="radio" data-q="${x}" aria-checked="${x === q}" class="${x === q ? "on" : ""}">${D.NOMES_LUGAR[x]}</button>`).join("")}${D.escolhaManual() ? `<small>escolhido à mão até o fim do dia</small>` : ""}</div>` : ""}`;
}
function ligarTopo(t) {
  $(".cl-area", t).onclick = () => opts.aoTrocarArea?.();
  $(".cl-lugar", t).onclick = () => { tocar("toque"); folhaLugar(); };
  $(".cl-ler", t).onclick = () => { tocar("toque"); atualizar(true); };
  // Casa / Faculdade / HUOP à mão (vale até o fim do dia); tocar no que o horário já escolheria volta ao automático
  t.querySelectorAll(".cl-quais [data-q]").forEach(b => (b.onclick = () => {
    tocar("toque");
    const q = b.dataset.q, auto = (() => { const m = D.escolhaManual(); D.escolher(null); const a = D.mostrado(); if (m) D.escolher(m); return a; })();
    D.escolher(q === auto ? null : q);
    desenhar(); atualizar(false, 30);
  }));
}

/** Enfeites do céu: estrelas à noite, nuvens passando, chuva caindo e o clarão da tempestade (só CSS). */
function decoracaoCeu(ceu) {
  const estrelas = ceu.periodo === "noite" ? `<div class="cl-estrelas">${Array.from({ length: 22 }, (_, i) => { const a = Math.sin(i * 77.7) * 1e4, b = Math.sin(i * 31.3 + 2) * 1e4;
    return `<i style="left:${((a - Math.floor(a)) * 100).toFixed(1)}%;top:${((b - Math.floor(b)) * 70).toFixed(1)}%;--d:${(i % 6) * .6}s"></i>`; }).join("")}</div>` : "";
  const nuvens = ceu.tempo !== "limpo" ? `<div class="cl-nuvens"><i></i><i></i><i></i></div>` : "";
  const chuva = ceu.tempo === "chuva" || ceu.tempo === "tempestade" ? `<div class="cl-chuva"></div>` : "";
  const raio = ceu.tempo === "tempestade" ? `<div class="cl-clarao"></div>` : "";
  const luz = ceu.tempo === "limpo" && ceu.periodo !== "noite" ? `<div class="cl-luz"></div>` : "";
  return `<div class="cl-deco" aria-hidden="true">${luz}${estrelas}${nuvens}${chuva}${raio}</div>`;
}

// ---------------------------------------------------------------- próximas horas
function secaoHoras(c, ms) {
  const hs = T.proximasHoras(c, ms, 25);
  const eventos = []; // o nascer e o pôr do sol entre as horas
  for (const d of c.dias) for (const [k, nome] of [["nascer", "Nascer"], ["por", "Pôr do sol"]]) if (d[k]) eventos.push({ h: d[k], nome });
  const itens = [];
  hs.forEach((x, i) => {
    const h = T.horaDe(x.h), rot = i === 0 ? "Agora" : h === 0 ? diaSem(x.h.slice(0, 10)) : `${h}h`;
    itens.push(`<li class="cl-hora ${h === 0 && i ? "meia" : ""}"><small>${rot}</small>${ico(T.iconeDe(x.cod, x.dia))}<b>${T.grau(x.t)}</b><span class="cl-prob ${(x.prob ?? 0) >= 50 ? "forte" : ""}">${(x.prob ?? 0) >= 10 ? `${I.gota}${x.prob}%` : ""}</span></li>`);
    for (const ev of eventos) if (ev.h.slice(0, 13) === x.h.slice(0, 13) && i < hs.length - 1)
      itens.push(`<li class="cl-hora sol-ev"><small>${hm(ev.h)}</small>${svgSolEvento(ev.nome === "Nascer")}<b>${ev.nome === "Nascer" ? "Nascer" : "Pôr"}</b><span class="cl-prob"></span></li>`);
  });
  return `<section class="cl-cartao"><h3>Próximas horas</h3><ul class="cl-horas" data-sem-deslize>${itens.join("")}</ul></section>`;
}
function svgSolEvento(nasce) {
  return `<svg class="tp-ico" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 44h48" stroke="#F29B0C" stroke-width="3" stroke-linecap="round"/><path d="M18 44a14 14 0 0128 0" fill="#FFC93C" stroke="#F29B0C" stroke-width="1.5"/><path d="M32 ${nasce ? "26V14M26 19l6-6 6 6" : "14v12M26 21l6 6 6-6"}" fill="none" stroke="#FF9F1C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ---------------------------------------------------------------- gráfico de 48 h: a temperatura e a chance de chuva
function secaoGrafico(c, ms) {
  const hs = T.proximasHoras(c, ms, 48).filter(x => x.t != null);
  if (hs.length < 6) return "";
  const W = 640, H = 210, top = 26, base = 128, chuvaTopo = 150, chuvaBase = 190, esq = 8, dir = 8;
  const ts = hs.map(x => x.t), mn = Math.min(...ts), mx = Math.max(...ts), folga = Math.max(1, (mx - mn) * 0.12);
  const X = (i) => esq + (i * (W - esq - dir)) / (hs.length - 1), Y = (t) => top + (1 - (t - (mn - folga)) / (mx - mn + 2 * folga)) * (base - top);
  // linha suave (Catmull-Rom → Bézier)
  const p = hs.map((x, i) => [X(i), Y(x.t)]);
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = `${d}L${p[p.length - 1][0].toFixed(1)} ${base}L${p[0][0].toFixed(1)} ${base}Z`;
  const larg = (W - esq - dir) / hs.length * 0.62;
  const barras = hs.map((x, i) => { const pr = x.prob ?? 0; if (pr < 1) return ""; const h = (pr / 100) * (chuvaBase - chuvaTopo);
    return `<rect x="${(X(i) - larg / 2).toFixed(1)}" y="${(chuvaBase - h).toFixed(1)}" width="${larg.toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="cl-g-barra" style="opacity:${(0.35 + pr / 160).toFixed(2)}"/>`; }).join("");
  const rotulos = hs.map((x, i) => { const h = T.horaDe(x.h); if (i && (h % 6 || X(i) < 78)) return "";
    return `<text x="${X(i).toFixed(1)}" y="${H - 2}" text-anchor="${i === 0 ? "start" : "middle"}" class="cl-g-eixo">${i === 0 ? "agora" : h === 0 ? diaSem(x.h.slice(0, 10)) : `${h}h`}</text>`; }).join("");
  const meias = hs.map((x, i) => i && T.horaDe(x.h) === 0 ? `<line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${top - 10}" y2="${chuvaBase}" class="cl-g-meia"/>` : "").join("");
  const iMax = ts.indexOf(mx), iMin = ts.indexOf(mn);
  const marca = (i, t, cima) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(t).toFixed(1)}" r="4.5" class="cl-g-ponto"/><text x="${Math.min(W - 18, Math.max(18, X(i))).toFixed(1)}" y="${(Y(t) + (cima ? -10 : 20)).toFixed(1)}" text-anchor="middle" class="cl-g-valor">${Math.round(t)}°</text>`;
  const somaMm = hs.slice(0, 24).reduce((s, x) => s + (x.mm || 0), 0);
  return `<section class="cl-cartao"><h3>Temperatura e chuva · 48 h</h3>
    <svg class="cl-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperatura entre ${Math.round(mn)} e ${Math.round(mx)} graus e a chance de chuva nas próximas 48 horas">
      <defs><linearGradient id="cl-g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF8A3D" stop-opacity=".38"/><stop offset="1" stop-color="#FF8A3D" stop-opacity="0"/></linearGradient></defs>
      ${meias}
      <path d="${area}" fill="url(#cl-g-area)"/>
      <path d="${d}" class="cl-g-linha"/>
      ${marca(iMax, mx, true)}${iMin !== iMax ? marca(iMin, mn, false) : ""}
      <line x1="${esq}" x2="${W - dir}" y1="${chuvaBase}" y2="${chuvaBase}" class="cl-g-base"/>
      ${barras}
      ${rotulos}
    </svg>
    <p class="cl-legenda"><span><i class="cl-leg t"></i>Temperatura</span><span><i class="cl-leg c"></i>Chance de chuva</span>${somaMm >= 0.1 ? `<span>${fmt(somaMm, 1)} mm nas próximas 24 h</span>` : ""}</p>
  </section>`;
}

// ---------------------------------------------------------------- próximos dias
/** Cor de uma temperatura (frio azul → calor vermelho). */
function corTemp(t) {
  const pts = [[8, [90, 169, 255]], [16, [79, 209, 197]], [22, [255, 209, 102]], [28, [255, 138, 61]], [35, [240, 84, 79]]];
  if (t <= pts[0][0]) return `rgb(${pts[0][1]})`;
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
    const [a, ca] = pts[i - 1], [b, cb] = pts[i], k = (t - a) / (b - a);
    return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(",")})`;
  }
  return `rgb(${pts[pts.length - 1][1]})`;
}
function secaoDias(c, ms, a) {
  const ds = T.proximosDias(c, ms, 10).filter(d => d.max != null && d.min != null);
  if (!ds.length) return "";
  const gmn = Math.min(...ds.map(d => d.min)), gmx = Math.max(...ds.map(d => d.max)), span = Math.max(1, gmx - gmn);
  const hojeD = T.localISO(ms, c.offset).slice(0, 10);
  return `<section class="cl-cartao"><h3>Próximos ${ds.length} dias</h3><ul class="cl-dias">${ds.map((d, i) => {
    const nome = d.d === hojeD ? "Hoje" : i === 1 && ds[0].d === hojeD ? "Amanhã" : `${diaSem(d.d)} ${+d.d.slice(8)}`;
    const l = ((d.min - gmn) / span) * 100, w = Math.max(4, ((d.max - d.min) / span) * 100);
    const ponto = d.d === hojeD && a.t != null ? `<i class="cl-ponto" style="left:${Math.min(100, Math.max(0, ((a.t - gmn) / span) * 100)).toFixed(1)}%"></i>` : "";
    const extra = [d.mm ? `Chuva ${fmt(d.mm, 1)} mm` : "Sem chuva prevista", d.vento != null ? `Vento até ${Math.round(d.vento)} km/h${d.rajada ? ` (rajadas de ${Math.round(d.rajada)})` : ""}${d.dir != null ? ` ${T.deOnde(d.dir)}` : ""}` : "",
      d.uv != null ? `UV ${Math.round(d.uv)} (${T.nivelUV(Math.round(d.uv)).nome.toLowerCase()})` : "", d.nascer ? `Sol ${hm(d.nascer)} → ${hm(d.por)}` : ""].filter(Boolean).join(" · ");
    return `<li><button class="cl-dia" type="button" aria-expanded="false">
      <span class="cl-dia-nome">${nome}</span>
      <span class="cl-dia-ico">${ico(T.iconeDe(d.cod, true))}</span>
      <span class="cl-prob ${(d.prob ?? 0) >= 50 ? "forte" : ""}">${(d.prob ?? 0) >= 10 ? `${I.gota}${d.prob}%` : ""}</span>
      <span class="cl-min">${T.grau(d.min)}</span>
      <span class="cl-faixa"><i style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%;background:linear-gradient(90deg,${corTemp(d.min)},${corTemp(d.max)})"></i>${ponto}</span>
      <span class="cl-max">${T.grau(d.max)}</span>
      <span class="cl-dia-mais">${escapar(T.textoDe(d.cod))} · ${escapar(extra)}</span>
    </button></li>`; }).join("")}</ul></section>`;
}

// ---------------------------------------------------------------- detalhes
function ladrilho(cls, icoSvg, titulo, corpo, sub = "") {
  return `<div class="cl-lad ${cls}"><h4>${icoSvg}${titulo}</h4>${corpo}${sub ? `<p>${sub}</p>` : ""}</div>`;
}
function secaoDetalhes(c, a, hoje, ms) {
  const i = T.indiceHora(c.horas, T.localISO(ms, c.offset)), tend = T.tendencia(c.horas, i);
  const out = [];
  // sensação
  const dif = a.sens != null && a.t != null ? a.sens - a.t : 0;
  out.push(ladrilho("sens", I.termo, "Sensação", `<strong>${T.grau(a.sens)}</strong>`, Math.abs(dif) < 1.5 ? "Igual à temperatura." : dif > 0 ? "Parece mais quente: umidade e pouco vento." : "Parece mais frio por causa do vento."));
  // umidade
  if (a.umid != null) out.push(ladrilho("umid", I.gota, "Umidade", `<strong>${a.umid}%</strong><div class="cl-barra"><i style="width:${a.umid}%"></i></div>`, a.umid < 30 ? "Ar seco: beba água." : a.umid > 85 ? "Muito úmido." : "Confortável."));
  // em pares (o vento e o sol ocupam a linha inteira)
  // ponto de orvalho
  if (a.orvalho != null) out.push(ladrilho("orv", I.gota, "Ponto de orvalho", `<strong>${T.grau(a.orvalho)}</strong>`, a.orvalho >= 21 ? "Abafado." : a.orvalho >= 16 ? "Um pouco úmido." : a.orvalho >= 10 ? "Agradável." : "Ar seco."));
  // visibilidade
  if (a.vis != null) out.push(ladrilho("vis", I.olho, "Visibilidade", `<strong>${T.visEm(a.vis)}</strong>`, a.vis >= 10000 ? "Ótima." : a.vis >= 4000 ? "Boa." : a.vis >= 1000 ? "Névoa." : "Neblina: cuidado na rua."));
  // vento com a rosa dos ventos
  if (a.vento != null) out.push(ladrilho("vento largo", I.vento, "Vento", `<div class="cl-vento">${rosa(a.dir, a.vento)}<div><strong>${Math.round(a.vento)}<small> km/h</small></strong>
      <p>${escapar(T.ventoEm(a.vento))}${a.dir != null ? ` ${T.deOnde(a.dir)} (${T.rumo(a.dir)})` : ""}</p>${a.rajada != null ? `<p>Rajadas de ${Math.round(a.rajada)} km/h</p>` : ""}</div></div>`));
  // pressão
  if (a.pressao != null) out.push(ladrilho("pressao", I.medidor, "Pressão", medidor(a.pressao),
    `${T.nivelPressao(a.pressao)}${tend ? ` · ${tend > 0 ? "subindo ↑" : "caindo ↓"}` : ""}`));
  // UV
  if (a.uv != null || hoje.uv != null) {
    const uv = a.uv ?? 0, nv = T.nivelUV(Math.round(uv));
    out.push(ladrilho("uv", I.sol, "Índice UV", `<strong>${Math.round(uv)}<small> ${nv.nome.toLowerCase()}</small></strong><div class="cl-escala uv"><i style="left:${Math.min(100, (uv / 12) * 100).toFixed(1)}%"></i></div>`,
      hoje.uv != null ? `Máximo hoje: ${Math.round(hoje.uv)} (${T.nivelUV(Math.round(hoje.uv)).nome.toLowerCase()}).` : ""));
  }
  // qualidade do ar
  if (c.ar) {
    const nv = T.nivelAr(c.ar.aqi);
    out.push(ladrilho("ar", I.folha, "Qualidade do ar", `<strong>${c.ar.aqi}<small> ${nv.nome.toLowerCase()}</small></strong><div class="cl-escala ar"><i style="left:${Math.min(100, (c.ar.aqi / 300) * 100).toFixed(1)}%"></i></div>`,
      [c.ar.pm25 != null ? `PM2,5 ${fmt(c.ar.pm25, 1)}` : "", c.ar.pm10 != null ? `PM10 ${fmt(c.ar.pm10, 1)} µg/m³` : ""].filter(Boolean).join(" · ")));
  }
  // nuvens e chuva
  out.push(ladrilho("chuva", I.nuvem, "Chuva hoje", `<strong>${fmt(hoje.mm ?? 0, 1)}<small> mm</small></strong>`, `${hoje.prob != null ? `Chance máxima de ${hoje.prob}%` : ""}${a.nuvens != null ? `${hoje.prob != null ? " · " : ""}nuvens ${a.nuvens}%` : ""}`));
  // nascer e pôr do sol
  if (hoje.nascer && hoje.por) out.push(ladrilho("sol largo", I.sol, "Nascer e pôr do sol", arcoSol(hoje, c, ms)));
  return `<section class="cl-cartao cl-detalhes"><h3>Detalhes de agora</h3><div class="cl-grade">${out.join("")}</div></section>`;
}
/** As opções do Clima: o aviso das 6h de chuva no caminho (03/11/2026) e, se houver, o que está marcado. */
function secaoOpcoes(pc) {
  const on = D.avisoChuvaLigado(), amanha = !!pc?.alvo && pc.alvo !== hojeISO();
  const marcado = on && pc?.aviso ? `<p class="cl-op-prox">${I.guarda}<span>${pc.quando > new Date() ? `Aviso marcado para ${amanha ? "amanhã" : "hoje"} às 6h: ` : ""}${escapar(pc.aviso.texto)}</span></p>` : "";
  return `<section class="cl-cartao cl-opcoes"><h3>Avisos</h3>
    <label class="cl-troca"><input type="checkbox" data-op="chuva" ${on ? "checked" : ""}><span><b>Chuva no caminho</b><small>Às 6h, só nos dias com chuva prevista na ida ou na volta (pelos horários da Agenda).</small></span></label>
    ${marcado}</section>`;
}
/** A rosa dos ventos com a seta para onde o vento vai (ele vem de `dir`). */
function rosa(dir, vel) {
  const marcas = Array.from({ length: 16 }, (_, i) => { const a = (i * 22.5 * Math.PI) / 180, r1 = i % 4 ? 41 : 38, r2 = 45;
    return `<line x1="${(50 + Math.sin(a) * r1).toFixed(1)}" y1="${(50 - Math.cos(a) * r1).toFixed(1)}" x2="${(50 + Math.sin(a) * r2).toFixed(1)}" y2="${(50 - Math.cos(a) * r2).toFixed(1)}" class="${i % 4 ? "m" : "M"}"/>`; }).join("");
  const letras = [["N", 50, 22], ["L", 79, 54], ["S", 50, 85], ["O", 21, 54]].map(([l, x, y]) => `<text x="${x}" y="${y}" text-anchor="middle">${l}</text>`).join("");
  const seta = dir == null ? "" : `<g transform="rotate(${(dir + 180) % 360} 50 50)"><path d="M50 14L56.5 28H52.5V72H47.5V28H43.5Z" class="seta"/><circle cx="50" cy="50" r="5" class="eixo"/></g>`;
  return `<svg class="cl-rosa" viewBox="0 0 100 100" role="img" aria-label="Vento ${dir == null ? "" : T.deOnde(dir)}, ${Math.round(vel)} km/h"><circle cx="50" cy="50" r="46" class="aro"/>${marcas}${letras}${seta}</svg>`;
}
/** O medidor da pressão, de 970 a 1040 hPa, com o valor no meio. */
function medidor(hpa) {
  const a0 = 135, a1 = 405, k = Math.min(1, Math.max(0, (hpa - 970) / 70)), ang = a0 + (a1 - a0) * k;
  const pt = (ang, r) => [50 + r * Math.cos((ang * Math.PI) / 180), 50 + r * Math.sin((ang * Math.PI) / 180)];
  const [x0, y0] = pt(a0, 38), [x1, y1] = pt(a1, 38), [xv, yv] = pt(ang, 38);
  return `<svg class="cl-medidor" viewBox="0 0 100 86" role="img" aria-label="Pressão de ${fmt(hpa)} hectopascais"><path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A38 38 0 1 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" class="trilho"/>
    <path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A38 38 0 ${ang - a0 > 180 ? 1 : 0} 1 ${xv.toFixed(1)} ${yv.toFixed(1)}" class="valor"/><circle cx="${xv.toFixed(1)}" cy="${yv.toFixed(1)}" r="5.5" class="ponta"/>
    <text x="50" y="52" text-anchor="middle" class="num">${fmt(hpa)}</text><text x="50" y="65" text-anchor="middle">hPa</text>
    <text x="${(x0 - 5).toFixed(1)}" y="85" text-anchor="middle">baixa</text><text x="${(x1 + 5).toFixed(1)}" y="85" text-anchor="middle">alta</text></svg>`;
}
/** O arco do sol do dia, com o sol onde ele está agora. */
function arcoSol(d, c, ms) {
  const n = T.msDe(d.nascer, c.offset), p = T.msDe(d.por, c.offset), k = (ms - n) / (p - n), dur = Math.round((p - n) / 60000);
  const kk = Math.min(1, Math.max(0, k)), ang = Math.PI * (1 - kk), x = 100 + 80 * Math.cos(ang), y = 78 - 62 * Math.sin(ang);
  const fase = k < 0 ? `Nasce em ${duracao(n - ms)}` : k > 1 ? "O sol já se pôs" : `Põe-se em ${duracao(p - ms)}`;
  return `<div class="cl-sol"><svg viewBox="0 0 200 92" aria-hidden="true"><path d="M20 78A80 62 0 0 1 180 78" class="arco"/>${k > 0 && k < 1 ? `<path d="M20 78A80 62 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" class="feito"/>` : ""}<line x1="8" x2="192" y1="78" y2="78" class="horizonte"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="astro ${k < 0 || k > 1 ? "posto" : ""}"/></svg>
    <div class="cl-sol-tx"><span><small>Nascer</small><b>${hm(d.nascer)}</b></span><span class="meio"><small>${fase}</small><b>Dia de ${Math.floor(dur / 60)}h${String(dur % 60).padStart(2, "0")}</b></span><span><small>Pôr</small><b>${hm(d.por)}</b></span></div></div>`;
}
const duracao = (msx) => { const m = Math.max(0, Math.round(msx / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };

// ---------------------------------------------------------------- trocar de cidade
function folhaLugar() {
  if (D.temCasa()) return folhaLugares();
  const atual = D.lugar();
  const html = `<div class="cl-folha"><h2>Cidade do Clima</h2>
    <label class="cl-busca">${I.pino}<input type="search" placeholder="Buscar cidade" aria-label="Buscar cidade" autocomplete="off" enterkeyhint="search"></label>
    <ul class="cl-res"></ul>
    <h4>Rápido</h4><ul class="cl-res fixos">${[T.PADRAO, ...D.recentes().filter(r => !(Math.abs(r.lat - T.PADRAO.lat) < 1e-3 && Math.abs(r.lon - T.PADRAO.lon) < 1e-3))].map((l, i) => linhaLugar(l, `f${i}`, atual)).join("")}</ul>
    <p class="cl-folha-dica">A busca usa o geocoding do Open-Meteo. A cidade escolhida vale também no tablet.</p>
    <button type="button" class="botao secundario cl-def-casa">${I.pino} Definir minha casa</button>
    <p class="cl-folha-dica">Com a casa definida, o Clima mostra a Casa de manhã e à noite e a Faculdade (ou o HUOP) no horário dos compromissos da Agenda, e a chuva da ida e da volta vem de cada lugar.</p></div>`;
  const fixos = [T.PADRAO, ...D.recentes().filter(r => !(Math.abs(r.lat - T.PADRAO.lat) < 1e-3 && Math.abs(r.lon - T.PADRAO.lon) < 1e-3))];
  modal({ titulo: "", html, botoes: [{ texto: "Fechar", valor: null, classe: "secundario" }] });
  const m = document.getElementById("modal"), inp = m.querySelector(".cl-busca input"), res = m.querySelector(".cl-res");
  let achados = [], t = null, n = 0;
  const escolher = async (l) => {
    tocar("toque");
    m.querySelector(".botao")?.click();
    D.definirLugar(l);
    desenhar();
    const r = await atualizar(true);
    if (!r.novo) toast("Sem internet: o tempo da cidade nova aparece assim que der.");
  };
  const ligar = (box, lista, pre) => box.querySelectorAll("[data-l]").forEach(b => (b.onclick = () => escolher(lista[+b.dataset.l.replace(pre, "")])));
  ligar(m.querySelector(".cl-res.fixos"), fixos, "f");
  m.querySelector(".cl-def-casa").onclick = () => { tocar("toque"); folhaPonto("casa"); };
  inp.oninput = () => {
    clearTimeout(t);
    const q = inp.value.trim();
    if (q.length < 2) { res.innerHTML = ""; return; }
    t = setTimeout(async () => {
      const k = ++n;
      res.innerHTML = `<li class="cl-res-msg">Buscando…</li>`;
      try { achados = await D.buscarCidades(q); }
      catch { if (k === n) res.innerHTML = `<li class="cl-res-msg">${navigator.onLine ? "A busca não respondeu. Tente de novo." : "Sem internet agora."}</li>`; return; }
      if (k !== n) return;
      res.innerHTML = achados.length ? achados.map((l, i) => linhaLugar(l, `b${i}`, atual)).join("") : `<li class="cl-res-msg">Nenhuma cidade com esse nome.</li>`;
      ligar(res, achados, "b");
    }, 380);
  };
  setTimeout(() => inp.focus(), 200);
}
// ---------------------------------------------------------------- Casa, Faculdade e HUOP (03/11/2026)
/** Os três lugares, cada um com Trocar, e "Usar um ponto só" (tira a Casa). */
function folhaLugares() {
  const linha = (q) => { const l = D.lugarDe(q), pad = q === "faculdade" ? T.FACULDADE : q === "huop" ? T.HUOP : null;
    const sub = q === "casa" ? (l.bairro ? `bairro ${l.bairro}` : `${l.lat.toFixed(4)}, ${l.lon.toFixed(4)}`) + " · só neste aparelho" : pad && Math.abs(l.lat - pad.lat) < 1e-4 && Math.abs(l.lon - pad.lon) < 1e-4 ? "padrão" : l.nome;
    return `<li><button type="button" data-q="${q}">${I.pino}<span><b>${D.NOMES_LUGAR[q]}</b><small>${escapar(sub)}</small></span><em>Trocar</em></button></li>`; };
  modal({ titulo: "", html: `<div class="cl-folha"><h2>Seus lugares</h2><ul class="cl-res fixos">${["casa", "faculdade", "huop"].map(linha).join("")}</ul>
    <button type="button" class="botao secundario cl-um-ponto">Usar um ponto só</button>
    <p class="cl-folha-dica">A Casa fica só neste aparelho (não vai para o GitHub). A Faculdade e o HUOP valem também no tablet. O CEO conta como Faculdade.</p></div>`,
    botoes: [{ texto: "Fechar", valor: null, classe: "secundario" }] });
  const m = document.getElementById("modal");
  m.querySelectorAll("[data-q]").forEach(b => (b.onclick = () => { tocar("toque"); folhaPonto(b.dataset.q); }));
  m.querySelector(".cl-um-ponto").onclick = async () => {
    if (!(await modal({ titulo: "Usar um ponto só?", texto: "A casa sai deste aparelho e o Clima volta a mostrar uma cidade só.", botoes: [{ texto: "Usar um ponto só", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] }))) return;
    D.definirCasa(null); desenhar(); atualizar(false, 30);
  };
}
/** Escolher onde fica um lugar sem GPS: um bairro ou distrito de Cascavel (o centro dele) ou coordenadas/link colados. */
function folhaPonto(qual) {
  const nome = D.NOMES_LUGAR[qual], pad = qual === "faculdade" ? T.FACULDADE : qual === "huop" ? T.HUOP : null;
  modal({ titulo: "", html: `<div class="cl-folha cl-folha-ponto"><h2>Onde fica ${qual === "casa" ? "a sua casa" : `o lugar “${nome}”`}?</h2>
    <label class="cl-busca">${I.pino}<input type="text" class="cl-coord" placeholder="Cole as coordenadas ou um link do Google Maps" aria-label="Coordenadas ou link do mapa" autocomplete="off" enterkeyhint="done"></label>
    <button type="button" class="botao cl-usar-coord">Usar estas coordenadas</button>
    ${pad ? `<button type="button" class="botao secundario cl-padrao">Voltar ao padrão (${escapar(pad.nome)})</button>` : ""}
    <h4>Ou o bairro (o centro dele)</h4>
    <label class="cl-busca">${I.pino}<input type="search" class="cl-filtro" placeholder="Filtrar os bairros" aria-label="Filtrar os bairros" autocomplete="off"></label>
    <ul class="cl-res cl-bairros"><li class="cl-res-msg">Carregando os bairros…</li></ul>
    ${qual === "casa" ? `<p class="cl-folha-dica">Sem GPS: no Google Maps, segure o dedo na sua casa e copie as coordenadas (ou o link). Fica só neste aparelho.</p>` : ""}</div>`,
    botoes: [{ texto: "Cancelar", valor: null, classe: "secundario" }] });
  const m = document.getElementById("modal");
  const salvar = (l) => {
    if (qual === "casa") D.definirCasa({ nome: "Casa", ...l }); else D.definirLugarFixo(qual, l);
    m.querySelector(".modal-caixa > .botao:last-child")?.click();
    toast(`${nome}: lugar guardado`); desenhar(); atualizar(true);
  };
  m.querySelector(".cl-usar-coord").onclick = () => {
    const c = T.lerCoordenadas(m.querySelector(".cl-coord").value);
    if (!c) { toast("Não achei as coordenadas. Cole algo como -24.95, -53.45 ou o link do mapa com o alfinete.", 4000); return; }
    tocar("toque"); salvar({ nome: qual === "casa" ? "Casa" : nome, lat: c.lat, lon: c.lon });
  };
  m.querySelector(".cl-padrao")?.addEventListener("click", () => { tocar("toque"); D.definirLugarFixo(qual, null); m.querySelector(".modal-caixa > .botao:last-child")?.click(); desenhar(); atualizar(true); });
  const ul = m.querySelector(".cl-bairros"), filtro = m.querySelector(".cl-filtro");
  let lista = [];
  const pintar = () => {
    const q = filtro.value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const vis = lista.filter(b => !q || b.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q));
    ul.innerHTML = vis.length ? vis.map(b => `<li><button type="button" data-b="${lista.indexOf(b)}">${I.pino}<span><b>${escapar(b.nome)}</b><small>${b.tipo === "distrito" ? "distrito" : "bairro"} de Cascavel</small></span></button></li>`).join("") : `<li class="cl-res-msg">Nenhum bairro com esse nome.</li>`;
    ul.querySelectorAll("[data-b]").forEach(b => (b.onclick = () => { const x = lista[+b.dataset.b]; tocar("toque"); salvar({ nome: qual === "casa" ? "Casa" : x.nome, bairro: x.nome, lat: x.lat, lon: x.lon }); }));
  };
  filtro.oninput = pintar;
  D.bairrosDeCascavel().then(l => { lista = l; if (m.contains(ul)) pintar(); }).catch(() => { ul.innerHTML = `<li class="cl-res-msg">Não deu para carregar os bairros.</li>`; });
}
function linhaLugar(l, id, atual) {
  const on = Math.abs(l.lat - atual.lat) < 1e-3 && Math.abs(l.lon - atual.lon) < 1e-3;
  const sub = [l.regiao, l.pais && l.pais !== "BR" ? l.paisNome || l.pais : ""].filter(Boolean).join(" · ");
  return `<li><button type="button" data-l="${id}" class="${on ? "on" : ""}">${I.pino}<span><b>${escapar(l.nome)}</b><small>${escapar(sub || "Brasil")}</small></span>${on ? "<em>atual</em>" : ""}</button></li>`;
}

/** Teste de fumaça: abre a área com um clima pronto (sem rede). */
export const _teste = { desenhar };
