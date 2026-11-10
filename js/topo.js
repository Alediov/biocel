// Topo do app: nível, XP do dia, meta, ofensiva, moedas e gemas. Cada item abre um painel
// que desce do topo (toque fora ou no mesmo item para fechar).
import { E, salvar, hojeISO, somaDias, nivel, nomeNivel, ofensivaAtiva, ofensivaReparavel, metaDoDia, tamanhoDe, TAMANHOS } from "./estado.js";
import { multiplicadorAtual, minutosRestantesPocao, pocaoAtiva, inventarioPocoes, ativarPocao, POCOES } from "./economia.js";
import { svgPocao } from "./bausUI.js";
import { toast } from "./ui.js";
import { tocar } from "./sons.js";
import { escapar } from "./ui.js";
import { arteCompanheiro } from "./colecao.js";

const MARCOS = { 7: 5, 14: 5, 30: 10, 50: 15, 100: 30, 200: 50, 365: 100 };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const fmt = (n) => Math.round(n).toLocaleString("pt-BR");
const xpDia = (d) => E().diario[d]?.xp || 0;
const ativoEm = (d) => (E().diario[d]?.licoes.length || 0) > 0;
const deHoje = (x) => { const q = new Date(x.quando); return hojeISO(q) === hojeISO(); };

let aberto = null, irPara = () => {}, mesCal = null;
export function definirTopo(fn) { irPara = fn; }

function fechar() {
  document.querySelector(".painel-topo")?.classList.add("saindo");
  document.querySelector(".fundo-painel")?.remove();
  const p = document.querySelector(".painel-topo");
  if (p) setTimeout(() => p.remove(), 180);
  document.querySelectorAll("#topo .chip.ativo").forEach(c => c.classList.remove("ativo"));
  aberto = null;
}
export function abrirPainel(tipo) {
  if (aberto === tipo) return fechar();
  fechar();
  aberto = tipo;
  const chip = document.getElementById(`chip-${tipo}`), topo = document.getElementById("topo");
  chip?.classList.add("ativo");
  const fundo = document.createElement("div"); fundo.className = "fundo-painel"; fundo.onclick = fechar;
  const p = document.createElement("div"); p.className = `painel-topo painel-${tipo}`;
  const r = topo.getBoundingClientRect(), c = chip?.getBoundingClientRect();
  p.style.top = `${r.bottom - 2}px`; fundo.style.top = `${r.bottom}px`; // o topo continua tocável
  if (c) p.style.setProperty("--seta", `${c.left + c.width / 2 - Math.max(8, r.left + 8)}px`);
  p.innerHTML = `<div class="painel-corpo"></div>`;
  document.body.append(fundo, p);
  if (tipo === "ofensiva") mesCal = hojeISO().slice(0, 7);
  desenhar(tipo, p.querySelector(".painel-corpo"));
  tocar("toque");
}
function desenhar(tipo, corpo) { ({ nivel: pNivel, xp: pXp, meta: pMeta, ofensiva: pOfensiva, moedas: pMoedas, gemas: pGemas })[tipo](corpo); }
const botao = (txt, fn, cls = "") => { const b = document.createElement("button"); b.className = `botao ${cls}`; b.textContent = txt; b.onclick = () => { fechar(); fn(); }; return b; };

export const hexNivel = (n, cls = "") => `<svg class="hex-nivel ${cls}" viewBox="0 0 40 44"><path d="M20 2 L37 11.5 V32.5 L20 42 L3 32.5 V11.5 Z" class="hex-fundo"/><path d="M20 6 L33.5 13.8 V30.2 L20 38 L6.5 30.2 V13.8 Z" class="hex-dentro"/><text x="20" y="27.5" text-anchor="middle">${n}</text></svg>`;

// ---------------- nível ----------------
function pNivel(corpo) {
  const est = E(), nv = nivel(), falta = nv.custo - nv.noNivel, pct = nv.noNivel / nv.custo * 100;
  const ult7 = Array.from({ length: 7 }, (_, i) => xpDia(somaDias(hojeISO(), -i)));
  const media = ult7.reduce((a, b) => a + b, 0) / 7, dias = media > 0 ? Math.ceil(falta / media) : null;
  const prox = nomeNivel(nv.n + 1);
  // os nomes perto do nível atual: 3 já conquistados e os 4 próximos
  const janela = Array.from({ length: 8 }, (_, i) => nv.n - 3 + i).filter(k => k >= 1);
  corpo.innerHTML = `<div class="pt-cab">${hexNivel(nv.n, "grande")}<div><small>Nível ${nv.n}</small><h3>${nv.titulo}</h3></div></div>
    <div class="pt-barra"><div style="width:${pct}%"></div></div>
    <p class="pt-linha"><b>${fmt(nv.noNivel)}</b> de ${fmt(nv.custo)} XP · faltam <b>${fmt(falta)} XP</b> para o nível ${nv.n + 1} (${escapar(prox)})</p>
    <p class="sub">${dias ? `No seu ritmo dos últimos 7 dias (${fmt(media)} XP por dia), você chega lá em ${dias === 1 ? "1 dia" : `cerca de ${dias} dias`}.` : "Faça uma lição para ver em quanto tempo você chega lá."}</p>
    <div class="pt-titulos">${janela.map(k => `<span class="${k === nv.n ? "atual" : k < nv.n ? "feito" : ""}" title="Nível ${k}"><small>${k}</small> ${escapar(nomeNivel(k))}</span>`).join("")}</div>
    <p class="sub pt-rodape">XP total: ${fmt(est.xp)}</p>`;
}

// ---------------- XP do dia ----------------
function pXp(corpo) {
  const est = E(), hoje = hojeISO(), xp = xpDia(hoje), ontem = xpDia(somaDias(hoje, -1));
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(hoje, i - 6)), vals = dias.map(xpDia), max = Math.max(20, ...vals);
  const recorde = Math.max(0, ...Object.values(est.diario).map(d => d.xp || 0));
  const extras = est.extratos.filter(deHoje).filter(x => x.xp > 0);
  const xpExtras = extras.reduce((s, x) => s + x.xp, 0), nLic = est.diario[hoje]?.licoes.length || 0;
  const sem = ["D", "S", "T", "Q", "Q", "S", "S"];
  corpo.innerHTML = `<div class="pt-cab"><span class="pt-ico raio">⚡</span><div><small>Hoje</small><h3>+${fmt(xp)} XP</h3></div><div class="pt-dir"><small>Ontem</small><b>${fmt(ontem)}</b></div></div>
    <div class="pt-barras">${dias.map((d, i) => `<div class="${d === hoje ? "hoje" : ""}"><i style="height:${Math.max(4, vals[i] / max * 100)}%"></i><small>${sem[new Date(d + "T12:00").getDay()]}</small></div>`).join("")}</div>
    <ul class="pt-lista">${nLic ? `<li><span>Lições (${nLic})</span><b>+${fmt(Math.max(0, xp - xpExtras))}</b></li>` : ""}${extras.slice(0, 5).map(x => `<li><span>${escapar(x.motivo)}</span><b>+${fmt(x.xp)}</b></li>`).join("")}${!nLic && !extras.length ? `<li><span class="sub">Nenhum XP ainda hoje.</span></li>` : ""}</ul>
    <p class="sub pt-rodape">Seu recorde num dia: ${fmt(recorde)} XP</p>`;
  corpo.querySelector(".pt-cab").after(secaoPocoes(corpo));
  corpo.append(botao("Ver o desempenho completo", () => irPara("desempenho"), "secundario"));
}

// Poções (pedido do Alediov, 26/10/2026): ativadas aqui, no painel do XP, ou na Mochila da loja, e não mais ao
// começar cada lição. A ativa aparece como selo no XP do topo enquanto dura (atualizarFixos).
function secaoPocoes(corpo) {
  const sec = document.createElement("div"); sec.className = "pt-pocoes";
  const ativa = pocaoAtiva(), inv = inventarioPocoes();
  if (ativa) {
    const p = POCOES[ativa.tipo] || { cor: "#9B5CF6", nome: "Poção de XP" }, min = minutosRestantesPocao();
    sec.innerHTML = `<div class="pt-pocao ativa" style="--cor-pocao:${p.cor}">${svgPocao(ativa.tipo)}<div><b>Poção ×${ativa.mult} ativa</b><small>Mais ${min} min multiplicando todo XP${inv.length ? ` · na mochila: ${inv.reduce((s, [, n]) => s + n, 0)}` : ""}</small></div></div>`;
    return sec;
  }
  if (!inv.length) { sec.innerHTML = `<p class="sub">Sem poções de XP agora. Elas vêm dos baús e da loja.</p>`; return sec; }
  sec.innerHTML = `<h4>Poções de XP</h4>`;
  for (const [tipo, qtd] of inv) {
    const p = POCOES[tipo]; if (!p) continue;
    const l = document.createElement("div"); l.className = "pt-pocao"; l.style.setProperty("--cor-pocao", p.cor);
    l.innerHTML = `${svgPocao(tipo)}<div><b>×${p.mult} por ${p.min} min</b><small>Você tem ${qtd}</small></div>`;
    const b = document.createElement("button"); b.className = "botao"; b.textContent = "Ativar";
    b.onclick = (ev) => {
      ev.stopPropagation();
      const r = ativarPocao(tipo);
      if (!r.ok) { toast(r.erro); return; }
      tocar("combo"); toast(`Poção ×${r.p.mult} ativada por ${r.p.min} min!`);
      window.dispatchEvent(new Event("oq-topo"));
      pXp(corpo);
    };
    l.append(b); sec.append(l);
  }
  return sec;
}

// ---------------- meta ----------------
function pMeta(corpo) {
  const est = E(), d = est.diario[hojeISO()], feitas = d?.licoes.length || 0, meta = metaDoDia(), pct = Math.min(1, feitas / meta);
  const per = { m: 0, t: 0, n: 0, o: 0 };
  for (const id of d?.licoes || []) { const k = (id.match(/-([mtn])(?:\d+|-jogo)$/) || [])[1] || "o"; per[k]++; }
  corpo.innerHTML = `<div class="pt-cab"><svg viewBox="0 0 36 36" class="anel grande"><circle cx="18" cy="18" r="15" class="anel-fundo"/><circle cx="18" cy="18" r="15" class="anel-valor" style="stroke-dashoffset:${94.25 * (1 - pct)}"/></svg>
      <div><small>Meta do dia</small><h3>${Math.min(feitas, meta)} de ${meta} lições</h3></div></div>
    <p class="pt-linha">${feitas >= meta ? `Meta batida! ${d?.bau ? "Os 20 moedas de bônus já entraram." : ""}` : `Faltam <b>${meta - feitas}</b> ${meta - feitas === 1 ? "lição" : "lições"} para a meta (e 20 moedas de bônus).`}</p>
    <div class="pt-periodos">${[["m", "Manhã", "☀️"], ["t", "Tarde", "🌤️"], ["n", "Noite", "🌙"], ["o", "Treino e extras", "🏋️"]].filter(([k]) => k !== "o" || per.o).map(([k, n, ic]) => `<div><span>${ic}</span><b>${per[k]}</b><small>${n}</small></div>`).join("")}</div>`;
  const linha = document.createElement("div"); linha.className = "pt-metas";
  linha.innerHTML = `<small>Mudar a meta:</small>`;
  const auto = est.config.metaAuto !== false;
  { // automática: pelo tamanho do dia (tamanhoDia.js), 5 no corrido, 10 no normal, 15 no livre
    const b = document.createElement("button"); b.className = `chip-filtro ${auto ? "on" : ""}`; b.textContent = `Automática (${TAMANHOS[tamanhoDe()].meta}, dia ${TAMANHOS[tamanhoDe()].curto.toLowerCase()})`;
    b.onclick = () => { est.config.metaAuto = true; salvar(); window.dispatchEvent(new Event("oq-topo")); pMeta(corpo); };
    linha.append(b);
  }
  for (const v of [5, 10, 15]) {
    const b = document.createElement("button"); b.className = `chip-filtro ${!auto && v === meta ? "on" : ""}`; b.textContent = `${v} lições`;
    b.onclick = () => { est.config.meta = v; est.config.metaAuto = false; salvar(); window.dispatchEvent(new Event("oq-topo")); pMeta(corpo); };
    linha.append(b);
  }
  corpo.append(linha, botao(feitas >= meta ? "Ver a trilha" : "Continuar a trilha", () => irPara("trilha")));
}

// ---------------- ofensiva ----------------
function estadoDia(d, o) {
  if (ativoEm(d)) return "ativo";
  if ((o.usados || []).includes(d)) return "congelado";
  if ((o.reparados || []).includes(d)) return "reparado";
  if ((o.quebras || []).includes(d)) return "quebra";
  return "";
}
function pOfensiva(corpo) {
  const est = E(), o = est.ofensiva, hoje = hojeISO(), feitoHoje = ofensivaAtiva();
  const prox = Object.keys(MARCOS).map(Number).find(m => m > o.atual);
  const rep = ofensivaReparavel();
  const [ano, mes] = mesCal.split("-").map(Number);
  const primeiro = new Date(ano, mes - 1, 1), nDias = new Date(ano, mes, 0).getDate();
  let cel = "";
  for (let i = 0; i < primeiro.getDay(); i++) cel += `<span></span>`;
  for (let dia = 1; dia <= nDias; dia++) {
    const iso = `${mesCal}-${String(dia).padStart(2, "0")}`, e = iso > hoje ? "futuro" : estadoDia(iso, o);
    const ligado = (x) => ["ativo", "congelado", "reparado"].includes(x);
    const antes = ligado(estadoDia(somaDias(iso, -1), o)) && ligado(e) && new Date(iso + "T12:00").getDay() !== 0;
    const depois = ligado(e) && somaDias(iso, 1) <= hoje && ligado(estadoDia(somaDias(iso, 1), o)) && new Date(iso + "T12:00").getDay() !== 6;
    cel += `<span class="dia ${e} ${iso === hoje ? "hoje" : ""} ${antes ? "liga-e" : ""} ${depois ? "liga-d" : ""}"><b>${dia}</b></span>`;
  }
  const doMes = Array.from({ length: nDias }, (_, i) => estadoDia(`${mesCal}-${String(i + 1).padStart(2, "0")}`, o));
  const conta = (k) => doMes.filter(x => x === k).length;
  corpo.innerHTML = `<div class="pt-cab ofensiva-cab ${feitoHoje ? "" : "apagada"}"><div class="pt-chama"><svg viewBox="0 0 24 24"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-1-3 0-6 1-9.5z"/></svg></div>
      <div><small>Ofensiva</small><h3>${o.atual} ${o.atual === 1 ? "dia" : "dias"}</h3><small>${feitoHoje ? "Hoje já está garantido." : o.atual ? "Faça uma lição hoje para não perder." : "Faça uma lição para começar."}</small></div>
      <div class="pt-comp">${arteCompanheiro({ humor: feitoHoje ? "feliz" : "triste" })}</div></div>
    <div class="pt-numeros"><div><b>${o.recorde}</b><small>Recorde</small></div><div><b>${o.congelamentos}/2</b><small>Congelamentos</small></div><div><b>${prox ? prox - o.atual : "—"}</b><small>${prox ? `dias para +${MARCOS[prox]} gemas` : "marcos completos"}</small></div></div>
    ${rep ? `<div class="pt-aviso">Sua ofensiva de ${rep} dias pode ser reparada na loja (Ofensiva › Reparo).</div>` : ""}
    <div class="cal-cab"><button class="cal-nav" data-d="-1" aria-label="Mês anterior">‹</button><b>${MESES[mes - 1][0].toUpperCase() + MESES[mes - 1].slice(1)} de ${ano}</b><button class="cal-nav" data-d="1" aria-label="Próximo mês" ${mesCal >= hoje.slice(0, 7) ? "disabled" : ""}>›</button></div>
    <div class="cal-sem">${["D", "S", "T", "Q", "Q", "S", "S"].map(x => `<small>${x}</small>`).join("")}</div>
    <div class="cal-grade">${cel}</div>
    <div class="cal-leg"><span><i class="ativo"></i>Estudou ${conta("ativo")}</span><span><i class="congelado"></i>Congelado ${conta("congelado")}</span><span><i class="reparado"></i>Reparado ${conta("reparado")}</span><span><i class="quebra"></i>Perdeu ${conta("quebra")}</span></div>`;
  corpo.querySelectorAll(".cal-nav").forEach(b => (b.onclick = (ev) => {
    ev.stopPropagation();
    const dt = new Date(ano, mes - 1 + Number(b.dataset.d), 1);
    mesCal = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    pOfensiva(corpo); tocar("toque");
  }));
  if (o.congelamentos < 2) corpo.append(botao("Comprar congelamento na loja", () => irPara("loja"), "secundario"));
}

// ---------------- moedas e gemas ----------------
function pMoedas(corpo) {
  const est = E(), lista = est.extratos.filter(x => x.moedas > 0).slice(0, 6);
  const hoje = est.extratos.filter(deHoje).reduce((s, x) => s + Math.max(0, x.moedas), 0);
  corpo.innerHTML = `<div class="pt-cab"><span class="pt-ico moeda"></span><div><small>Moedas</small><h3>${fmt(est.moedas)}</h3></div><div class="pt-dir"><small>Hoje, fora das lições</small><b>+${fmt(hoje)}</b></div></div>
    <ul class="pt-lista">${lista.map(x => `<li><span>${escapar(x.motivo)}<small>${new Date(x.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small></span><b>+${fmt(x.moedas)}</b></li>`).join("") || `<li><span class="sub">Os ganhos aparecem aqui.</span></li>`}</ul>
    <p class="sub">Lição: 5 moedas (+5 se perfeita) · meta do dia: +20 · baús, jardim, minijogos e presenças.</p>`;
  corpo.append(botao("Ir à loja", () => irPara("loja")));
}
function pGemas(corpo) {
  const est = E(), o = est.ofensiva, prox = Object.keys(MARCOS).map(Number).find(m => m > o.atual);
  corpo.innerHTML = `<div class="pt-cab"><span class="pt-ico gema"><svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z" fill="#4FD1E8" stroke="#1B2340" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 9h20M8 3l-2 6 6 12 6-12-2-6M12 3v6" fill="none" stroke="#1E8FB3" stroke-width="1.2"/></svg></span><div><small>Gemas</small><h3>${fmt(est.gemas || 0)}</h3></div></div>
    <p class="pt-linha">Gemas são raras. Elas vêm de:</p>
    <ul class="pt-lista">
      <li><span>Baús (Cristal e Três Caminhos dão mais)</span><b>1–25</b></li>
      <li><span>Marcos de ofensiva${prox ? ` (próximo: ${prox} dias)` : ""}</span><b>${prox ? `+${MARCOS[prox]}` : "—"}</b></li>
      <li><span>Pódio da liga semanal</span><b>5–15</b></li>
      <li><span>Plantas raras do jardim</span><b>1–3</b></li>
      <li><span>Lição perfeita (sorte)</span><b>+1</b></li></ul>
    <p class="sub">Use em poções fortes, para abrir baús na hora e nas ofertas do dia.</p>`;
  corpo.append(botao("Ir à loja", () => irPara("loja")));
}

/** Atualiza os números do topo que não voam (nível, meta, ofensiva) e o selo de poção. */
export function atualizarFixos() {
  const est = E(), nv = nivel();
  const vn = document.getElementById("v-nivel");
  if (vn && vn.dataset.n !== String(nv.n)) { vn.innerHTML = hexNivel(nv.n); vn.dataset.n = nv.n; }
  const bn = document.getElementById("barra-nivel"); if (bn) bn.style.width = `${Math.round(nv.noNivel / nv.custo * 100)}%`;
  document.getElementById("v-ofensiva").textContent = est.ofensiva.atual;
  document.getElementById("chip-ofensiva").classList.toggle("apagada", !ofensivaAtiva());
  const m = multiplicadorAtual(), vm = document.getElementById("v-mult"), cx = document.getElementById("chip-xp");
  vm.hidden = m <= 1; vm.textContent = m > 1 ? `×${m}` : "";
  // selo da poção ativa: o XP do topo fica na cor dela enquanto dura
  const pa = pocaoAtiva(), corP = pa ? POCOES[pa.tipo]?.cor || "#9B5CF6" : "";
  cx.classList.toggle("com-pocao", !!pa);
  if (pa) { cx.style.setProperty("--cor-pocao", corP); cx.setAttribute("aria-label", `XP de hoje · poção ×${pa.mult} por mais ${minutosRestantesPocao()} min`); }
  else { cx.style.removeProperty("--cor-pocao"); cx.setAttribute("aria-label", "XP de hoje"); }
  const feitas = est.diario[hojeISO()]?.licoes.length || 0, meta = metaDoDia();
  document.getElementById("v-meta").textContent = `${Math.min(feitas, meta)}/${meta}`;
  document.getElementById("anel-meta").style.strokeDashoffset = 94.25 * (1 - Math.min(1, feitas / meta));
  document.getElementById("chip-meta").classList.toggle("batida", feitas >= meta);
  if (aberto) { const c = document.querySelector(".painel-topo .painel-corpo"); if (c && aberto !== "ofensiva") desenhar(aberto, c); }
}

export function ligarTopo() {
  for (const t of ["nivel", "xp", "meta", "ofensiva", "moedas", "gemas"]) document.getElementById(`chip-${t}`).onclick = () => abrirPainel(t);
  window.addEventListener("oq-ir", fechar);
  document.querySelectorAll(".aba").forEach(b => b.addEventListener("click", fechar));
}
