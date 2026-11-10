// Even3 de amanhã (pedido do Alediov, 03/11/2026: a busca que ele rodava à mão no notebook, todo dia e sem depender
// dele). O workflow "Eventos do Even3" (tools/eventos/even3.py, ~17h de Brasília) grava `even3/ultimo.json` no ramo
// órfão `eventos`: os eventos ONLINE do dia seguinte com inscrições abertas e certificado para o participante, os de
// Odontologia marcados (`odonto.sim`, com o porquê). Aqui: ler esse arquivo (ao abrir, ao voltar ao app no máximo a
// cada 30 min e no Sincronizar), guardar no aparelho (localStorage `orbita.even3`), o cartão "Amanhã no Even3" da
// Agenda (Abrir inscrição / Adicionar / Não quero) e o item leve do Meu dia. As escolhas (recusados, adicionados, a data
// já vista) ficam em E().even3 e sincronizam entre os aparelhos (registros com `em`).
import { E, salvar, hojeISO, somaDias } from "./estado.js";
import * as AG from "./agenda.js";
import { escapar, toast } from "./ui.js";
import { icone } from "./icones.js";

const CHAVE = "orbita.even3";            // { em, dados }
const CHAVE_ABERTO = "orbita.even3.aberto";
const INTERVALO = 30 * 60e3;
let dados = null, lidoEm = 0, carregando = null, erro = null;

// ---------- estado das escolhas (sincroniza) ----------
/** E().even3 = { recusados: {id: {em, data}}, adicionados: {id: {em, data}}, vistos: {data: {em}} } (só os últimos 30 dias). */
export function S() {
  const e = E();
  const s = (e.even3 ||= {});
  s.recusados ||= {}; s.adicionados ||= {}; s.vistos ||= {};
  return s;
}
function limparVelhos() {
  const s = S(), corte = somaDias(hojeISO(), -30);
  for (const k of ["recusados", "adicionados"]) for (const [id, r] of Object.entries(s[k])) if ((r?.data || "9") < corte) delete s[k][id];
  for (const d of Object.keys(s.vistos)) if (d < corte) delete s.vistos[d];
}
const agora = () => new Date().toISOString();

// ---------- dados do ramo ----------
export function doAparelho() {
  if (dados) return dados;
  try { const t = localStorage.getItem(CHAVE); if (t) { const d = JSON.parse(t); dados = d.dados || null; lidoEm = d.em || 0; } } catch { /* sem armazenamento */ }
  return dados;
}
export const situacao = () => ({ dados: doAparelho(), lidoEm, carregando: !!carregando, erro });

/** Guarda um resultado (vindo do ramo ou injetado no teste de fumaça) e avisa as telas. */
export function guardar(d, em = Date.now()) {
  dados = d; lidoEm = em; erro = null;
  try { localStorage.setItem(CHAVE, JSON.stringify({ em, dados: d })); } catch { /* cheio: fica na memória */ }
  window.dispatchEvent(new Event("oq-even3"));
}

/** Lê `even3/ultimo.json` do ramo `eventos` (no máximo a cada 30 min, a não ser `forcar`). Sem token, não faz nada. */
export function carregar({ forcar = false } = {}) {
  doAparelho();
  if (carregando) return carregando;
  if (!forcar && dados && Date.now() - lidoEm < INTERVALO) return Promise.resolve(dados);
  const cfg = E().config || {}, token = (cfg.token || "").trim(), repo = (cfg.repo || "").trim();
  if (!token || !repo || !navigator.onLine) return Promise.resolve(dados);
  carregando = (async () => {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/even3/ultimo.json?ref=eventos`, { cache: "no-store", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "X-GitHub-Api-Version": "2022-11-28" } });
      if (r.status === 404) throw new Error("A busca do Even3 ainda não rodou (o ramo eventos não existe).");
      if (r.status === 401 || r.status === 403) throw new Error("O GitHub recusou o token do app.");
      if (!r.ok) throw new Error(`O GitHub respondeu ${r.status}.`);
      const d = await r.json();
      if (!d || !Array.isArray(d.eventos) || !d.data) throw new Error("Resultado do Even3 em formato estranho.");
      const mudou = JSON.stringify(d) !== JSON.stringify(dados);
      dados = d; lidoEm = Date.now(); erro = null;
      try { localStorage.setItem(CHAVE, JSON.stringify({ em: lidoEm, dados: d })); } catch { /* */ }
      if (mudou) window.dispatchEvent(new Event("oq-even3"));
    } catch (e) { erro = e.message || String(e); }
    finally { carregando = null; }
    return dados;
  })();
  return carregando;
}

/** Ao abrir o app (12 s depois) e ao voltar a ele (no máximo a cada 30 min, pelo `carregar`). */
export function iniciarEven3() {
  setTimeout(() => carregar(), 12000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(() => carregar(), 9000); });
}

// ---------- o que mostrar ----------
/** "amanha" | "hoje" | null (o resultado é velho). */
export function quando(d = doAparelho()) {
  if (!d?.data) return null;
  const h = hojeISO();
  return d.data === somaDias(h, 1) ? "amanha" : d.data === h ? "hoje" : null;
}
const hm = () => { const x = new Date(); return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
/** O evento já está na Agenda (adicionado aqui ou em outro aparelho)? Devolve o evento da Agenda. */
export const naAgenda = (id) => AG.eventosOnline().find(x => x.even3 === id) || null;

/** Os eventos para mostrar: { odonto, outros, recusados } (os de hoje que já começaram saem). */
export function eventosParaMostrar(d = doAparelho()) {
  const q = quando(d);
  if (!q) return { odonto: [], outros: [], recusados: [] };
  const rec = S().recusados, h = hm();
  const vale = d.eventos.filter(e => q === "amanha" || !e.inicio || e.inicio > h);
  const recusados = vale.filter(e => rec[e.id]);
  const resto = vale.filter(e => !rec[e.id]);
  return { odonto: resto.filter(e => e.odonto?.sim), outros: resto.filter(e => !e.odonto?.sim), recusados };
}

/** Item do Meu dia: só quando há evento de Odontologia amanhã (ou hoje, ainda por começar) não visto, não recusado e
 *  fora da Agenda. Vai para "Se der tempo" (bonus) e não conta no anel. */
export function itemMeuDia() {
  const d = doAparelho(), q = quando(d);
  if (!q || S().vistos[d.data]) return null;
  const n = eventosParaMostrar(d).odonto.filter(e => !naAgenda(e.id)).length;
  if (!n) return null;
  return { id: "even3", icone: "🦷", titulo: `Even3: ${n} evento${n > 1 ? "s" : ""} de Odontologia ${q === "amanha" ? "amanhã" : "hoje"}`,
    detalhe: "online, com certificado", feito: null, bonus: true, prio: 9, custo: 999, ir: { area: "learn", tela: "agenda", rolar: ".e3-sec" } };
}
function marcarVisto(d) {
  const s = S();
  if (!d?.data || s.vistos[d.data]) return;
  s.vistos[d.data] = { em: agora() }; limparVelhos(); salvar();
  window.dispatchEvent(new Event("oq-topo"));
}

// ---------- ações ----------
export function recusar(ev, d = doAparelho()) {
  S().recusados[ev.id] = { em: agora(), data: d?.data || hojeISO(), nome: ev.nome }; limparVelhos(); salvar();
}
export function desfazerRecusa(id) { delete S().recusados[id]; salvar(); }
/** Põe o evento na Agenda (salvarEventoOnline: aviso 30 min antes, depois Fui/certificado/Currículo). */
export function adicionar(ev, d = doAparelho()) {
  if (naAgenda(ev.id)) return naAgenda(ev.id);
  AG.salvarEventoOnline({ nome: ev.nome, modalidade: "online", data: ev.data || d.data, inicio: ev.inicio, fim: ev.fim || "", aviso: AG.AVISO_ONLINE_MIN,
    plataforma: ev.plataforma || undefined, link: ev.urlFinal || ev.url, even3: ev.id });
  S().adicionados[ev.id] = { em: agora(), data: ev.data || d.data, nome: ev.nome }; limparVelhos(); salvar();
  return naAgenda(ev.id);
}

// ---------- o cartão da Agenda ----------
const dataCurta = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
function horario(ev) {
  if (!ev.inicio) return "horário na página";
  return ev.fim ? `${ev.inicio}–${ev.fim}` : `${ev.inicio}`;
}
const horasTxt = (h) => (h == null ? "" : `${String(h).replace(".", ",")} h de certificado`);

function linhaEvento(ev, { aoEditar, redesenhar, recusado = false }) {
  const od = ev.odonto?.sim, ag = naAgenda(ev.id);
  const el = document.createElement("article");
  el.className = `e3-ev ${od ? "e3-odonto" : ""} ${ag ? "e3-na-agenda" : ""}`; el.dataset.id = ev.id;
  const info = [horario(ev), horasTxt(ev.certificado?.horas), ev.preco || "", ev.plataforma || ""].filter(Boolean);
  const multi = ev.dataFim ? `<span class="e3-tag">até ${escapar(dataCurta(ev.dataFim))}</span>` : "";
  el.innerHTML = `${od ? `<div class="e3-selo">${icone("🦷", "ico-inline")} Odontologia<small>${escapar(ev.odonto.porque || "")}</small></div>` : ""}
    <h3>${escapar(ev.nome)}${multi}</h3>
    <p class="e3-info">${info.map(x => `<span>${escapar(x)}</span>`).join("")}</p>
    ${ev.resumo ? `<p class="e3-resumo">${escapar(ev.resumo)}</p>` : ""}
    ${ev.certificado?.trecho ? `<p class="e3-cert">${icone("📜", "ico-inline")} “${escapar(ev.certificado.trecho)}”</p>` : ""}
    <div class="e3-botoes"></div>`;
  const bt = el.querySelector(".e3-botoes");
  const link = document.createElement("a"); link.className = "botao secundario e3-abrir"; link.href = ev.urlFinal || ev.url; link.target = "_blank"; link.rel = "noopener"; link.textContent = "Abrir inscrição";
  bt.append(link);
  if (recusado) {
    const b = document.createElement("button"); b.className = "botao secundario e3-voltar"; b.textContent = "Mostrar de novo";
    b.onclick = () => { desfazerRecusa(ev.id); redesenhar(); };
    bt.append(b);
    return el;
  }
  if (ag) {
    const b = document.createElement("button"); b.className = "botao secundario e3-ver"; b.innerHTML = `${icone("✅", "ico-inline")} Na Agenda`;
    b.onclick = () => aoEditar?.(ag);
    bt.append(b);
  } else {
    const add = document.createElement("button"); add.className = "botao e3-add"; add.textContent = "Adicionar";
    add.onclick = () => {
      if (!ev.inicio) { // sem horário legível: o formulário de sempre, já preenchido (ele põe a hora)
        aoEditar?.({ nome: ev.nome, modalidade: "online", data: ev.data || doAparelho()?.data, plataforma: ev.plataforma || undefined, link: ev.urlFinal || ev.url, even3: ev.id });
        return;
      }
      adicionar(ev); toast(`Na Agenda: aviso ${AG.AVISO_ONLINE_MIN} min antes.`); redesenhar();
    };
    const nao = document.createElement("button"); nao.className = "botao secundario e3-nao"; nao.textContent = "Não quero";
    nao.onclick = () => { recusar(ev); el.classList.add("saindo"); setTimeout(redesenhar, 220); };
    bt.append(add, nao);
  }
  return el;
}

/** A seção "Amanhã no Even3" (ou "Hoje…"), recolhível; null quando não há resultado de hoje/amanhã.
 *  `aoEditar(ev)`: abre o formulário de evento da Agenda (para um evento sem horário ou para ver o que já está lá). */
export function secaoEven3({ aoEditar } = {}) {
  const d = doAparelho(), q = quando(d);
  if (!d || !q) return null;
  const sec = document.createElement("div"); sec.className = "secao e3-sec";
  const desenhar = () => {
    const { odonto, outros, recusados } = eventosParaMostrar(d);
    const n = odonto.length + outros.length;
    let aberto = null;
    try { aberto = localStorage.getItem(CHAVE_ABERTO); } catch { /* */ }
    const abrir = aberto == null ? odonto.some(e => !naAgenda(e.id)) && !S().vistos[d.data] : aberto === "1";
    const quandoTxt = q === "amanha" ? "Amanhã" : "Hoje";
    const busca = d.geradoEm ? new Date(d.geradoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    sec.innerHTML = `<details class="e3" ${abrir ? "open" : ""}><summary><span class="e3-tit">${icone("🎟️", "ico-inline")} ${quandoTxt} no Even3</span>
      <span class="e3-cont">${n ? `${n} evento${n > 1 ? "s" : ""}` : "nenhum"}${odonto.length ? ` · <b>${icone("🦷", "ico-inline")} ${odonto.length}</b>` : ""}</span></summary>
      <div class="e3-corpo"></div></details>`;
    const corpo = sec.querySelector(".e3-corpo"), det = sec.querySelector("details");
    det.addEventListener("toggle", () => { try { localStorage.setItem(CHAVE_ABERTO, det.open ? "1" : "0"); } catch { /* */ } if (det.open && odonto.length) marcarVisto(d); });
    if (d.erro) corpo.insertAdjacentHTML("beforeend", `<p class="e3-erro">A busca de ${escapar(busca)} teve um problema: ${escapar(d.erro)}</p>`);
    const redesenhar = () => { desenhar(); window.dispatchEvent(new Event("oq-topo")); };
    const op = { aoEditar, redesenhar };
    if (odonto.length) {
      const g = document.createElement("div"); g.className = "e3-grupo e3-grupo-odonto";
      odonto.forEach(ev => g.append(linhaEvento(ev, op)));
      corpo.append(g);
    }
    if (outros.length) {
      const det2 = document.createElement("details"); det2.className = "e3-outros"; if (!odonto.length || outros.length <= 3) det2.open = true;
      det2.innerHTML = `<summary>${odonto.length ? "Outros eventos" : "Eventos"} <small>${outros.length}</small></summary>`;
      outros.forEach(ev => det2.append(linhaEvento(ev, op)));
      corpo.append(det2);
    }
    if (!n && !d.erro) corpo.insertAdjacentHTML("beforeend", `<p class="sub">Nenhum evento online ${q === "amanha" ? "amanhã" : "hoje"} com inscrição aberta e certificado${recusados.length ? " (fora os que você não quis)" : ""}.</p>`);
    if (recusados.length) {
      const det3 = document.createElement("details"); det3.className = "e3-recusados";
      det3.innerHTML = `<summary>Você não quis <small>${recusados.length}</small></summary>`;
      recusados.forEach(ev => det3.append(linhaEvento(ev, { ...op, recusado: true })));
      corpo.append(det3);
    }
    const tot = d.totalDia != null ? ` · ${d.totalLista ?? "?"} online de ${d.totalDia} no dia` : "";
    corpo.insertAdjacentHTML("beforeend", `<p class="e3-rodape">Busca${busca ? ` de ${escapar(busca)}` : ""}: online, inscrição aberta e certificado para o participante${tot}</p>`);
    // visto: o cartão aberto com os de Odontologia aparecendo na tela
    if (det.open && odonto.length && !S().vistos[d.data] && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((ents) => { if (ents.some(x => x.isIntersecting)) { io.disconnect(); setTimeout(() => marcarVisto(d), 1500); } }, { threshold: 0.4 });
      io.observe(corpo.querySelector(".e3-grupo-odonto") || corpo);
    }
  };
  desenhar();
  return sec;
}
