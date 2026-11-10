// Telas da gravação das aulas (docs/plano-gravacao.md): "Aulas gravadas" (abre pela Agenda, pelo Perfil, pela pílula e
// pelas notificações), com a gravação ao vivo (tempo, nível do microfone, marcadores, pausar e parar), as aulas por
// disciplina, a transcrição no aparelho (modelo, madrugada, testar a velocidade), a pasta, as opções da Agenda e os
// conselhos de gravação; e a tela de uma aula (ouvir pulando pelos marcadores, a transcrição e apagar).
import * as GR from "./gravacao.js";
import * as ES from "./estimativa.js";
import { MARCADORES, marcador, relogio } from "./gravacao.js";
import { icone } from "../icones.js";
import { modal, toast, formulario, escapar, dataBR } from "../ui.js";
import { hojeISO } from "../estado.js";
import * as AG from "../agenda.js";

const tela = () => document.getElementById("tela");
let voltarPara = "agenda";
let vista = null; // null = lista; id = uma aula
/** Abre "Aulas gravadas" voltando para `origem` (agenda | perfil). */
export function abrirAulas(origem = "agenda", id = null) {
  voltarPara = origem; vista = id; aba = "aulas";
  window.dispatchEvent(new CustomEvent("oq-ir", { detail: "aulas" }));
}

const MB = (b) => b >= 1e9 ? `${(b / 1e9).toFixed(1).replace(".", ",")} GB` : `${Math.max(0, Math.round((b || 0) / 1e6))} MB`;
const minutos = (ms) => { const m = Math.round((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
const ROT_SIT = { nao: ["Sem transcrição", ""], fila: ["Na fila", "fila"], andamento: ["Transcrevendo", "andamento"], feita: ["Transcrita", "feita"], erro: ["Erro", "erro"], vazia: ["Vazia", ""] };
function chipSituacao(a, tr) {
  const t = a.transcricao || {};
  if (a.gravando) return `<span class="gr-chip ao-vivo">Gravando</span>`;
  if (tr?.rodando && tr.id === a.id) return `<span class="gr-chip andamento">${Math.round((tr.progresso || 0) * 100)}%</span>`;
  if (t.situacao === "feita" && t.enviada) return `<span class="gr-chip feita">Transcrita ✓</span>`;
  const [rot, cls] = ROT_SIT[t.situacao] || ROT_SIT.nao;
  return `<span class="gr-chip ${cls}">${rot}</span>`;
}
const elemento = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };

// ---------------------------------------------------------------- tela principal
// Duas abas (pedido do Alediov, 03/11/2026: "está um pouco confusa a divisão"): **Aulas** (gravar, a situação da
// transcrição numa linha e as aulas por disciplina) e **Ajustes** (transcrição no aparelho, testar a velocidade, a
// pasta, as opções da Agenda e os conselhos). A aba fica em localStorage `orbita.gravacao.aba`; abrir pela Agenda, pelo
// Perfil ou por uma notificação (`abrirAulas`) volta para Aulas.
const CHAVE_ABA = "orbita.gravacao.aba";
let aba = (() => { try { return localStorage.getItem(CHAVE_ABA) === "ajustes" ? "ajustes" : "aulas"; } catch { return "aulas"; } })();
function trocarAba(a, irPara) { aba = a; try { localStorage.setItem(CHAVE_ABA, a); } catch { /* */ } telaAulas(irPara); }

export async function telaAulas(irPara) {
  if (vista) return telaAula(vista, irPara);
  const t = tela();
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = voltarPara === "perfil" ? "‹ Perfil" : "‹ Agenda";
  v.onclick = () => irPara(voltarPara);
  t.innerHTML = "";
  t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela">Aulas gravadas</h1>
    <p class="sub gr-intro">${icone("🔒", "ico-inline")} O áudio fica só no celular; só o texto vai para as trilhas.</p>
    <div class="gr-abas" role="tablist">${[["aulas", "🎤", "Aulas"], ["ajustes", "⚙️", "Ajustes"]].map(([k, e, n]) =>
      `<button role="tab" data-aba="${k}" aria-selected="${aba === k}" class="${aba === k ? "on" : ""}">${icone(e, "ico-inline")}<span>${n}</span></button>`).join("")}</div>`);
  for (const b of t.querySelectorAll(".gr-abas button")) b.onclick = () => { if (b.dataset.aba !== aba) { navigator.vibrate?.(6); trocarAba(b.dataset.aba, irPara); } };
  const corpo = document.createElement("div"); corpo.className = `gr-corpo aba-${aba}`; t.append(corpo);
  corpo.innerHTML = `<div class="cartao gr-carregando">Carregando…</div>`;
  let s, aulas;
  try { [s, aulas] = await Promise.all([GR.situacao(), GR.listar()]); }
  catch (e) { corpo.innerHTML = `<div class="cartao">Não consegui abrir as gravações: ${escapar(e.message || e)}</div>`; return; }
  if (!t.contains(corpo)) return;
  corpo.innerHTML = "";
  if (aba === "ajustes") {
    corpo.append(secaoTranscricao(s, aulas, irPara));
    corpo.append(secaoPasta(s, irPara));
    corpo.append(secaoOpcoes());
    corpo.append(conselhos());
  } else {
    corpo.append(s.gravacao?.gravando ? cartaoAoVivo(s.gravacao, irPara) : cartaoGravar(irPara, s));
    if (!s.gravacao?.gravando) corpo.append(faixaTranscricao(s, aulas, irPara));
    corpo.append(secaoAulas(aulas, s, irPara));
  }
  // atualiza sozinha quando a gravação acaba, a transcrição anda ou uma aula muda
  const desl = [GR.ouvir("aulas", () => redesenhar()), GR.ouvir("transcricao", (tr) => atualizarTranscricao(corpo, tr)),
    GR.ouvir("gravacao", (g) => { if (aba === "aulas" && !!g?.gravando !== !!corpo.querySelector(".gr-vivo")) redesenhar(); })];
  function redesenhar() { if (!t.contains(corpo)) { desl.forEach(f => f()); return; } desl.forEach(f => f()); telaAulas(irPara); }
}

/** Aba Aulas: a transcrição numa linha (o que espera, quando roda, Transcrever agora); os ajustes ficam na outra aba. */
function faixaTranscricao(s, aulas, irPara) {
  const c = elemento(`<div class="cartao gr-status"></div>`);
  if (s.web) { c.innerHTML = `<p class="sub">${icone("🧠", "ico-inline")} Transcrever é só no celular; aqui dá para gravar e ouvir.</p>`; return c; }
  const m = s.motor || {}, aj = s.ajustes || {}, tr = s.transcricao || {};
  const escolhido = aj.modelo || "turbo", temModelo = (s.modelos || []).find(x => x.id === escolhido)?.baixado;
  const n = s.naFila || 0;
  c.dataset.eta = "1";
  let linha, acao = "";
  if (!m.disponivel) linha = `${icone("⚠️", "ico-inline")} O motor de transcrição chega numa atualização do app. Até lá, as aulas esperam na fila.`;
  else if (!temModelo) { linha = `${icone("📥", "ico-inline")} Falta baixar o modelo de transcrição (uma vez, pelo Wi-Fi).`; acao = `<button class="botao secundario" data-a="ajustes">Abrir os Ajustes</button>`; }
  else if (n) linha = `${icone("🧠", "ico-inline")} <b>${n} ${n === 1 ? "aula" : "aulas"} na fila.</b> ${aj.auto !== false ? `Transcreve de madrugada, a partir das ${aj.hora ?? 22}h, com o celular carregando.` : "A transcrição de madrugada está desligada."}`;
  else linha = `${icone("✅", "ico-inline")} Nada esperando transcrição.`;
  c.innerHTML = `<p class="gr-status-txt">${linha}</p>${acao}<div class="gr-tr-agora"></div><details class="gr-eta" hidden></details>`;
  c.querySelector('[data-a="ajustes"]')?.addEventListener("click", () => trocarAba("ajustes", irPara));
  if (m.disponivel && temModelo && (n || tr.rodando || tr.erro)) desenharAgora(c.querySelector(".gr-tr-agora"), s, tr, irPara);
  // o andamento detalhado, com as estimativas (pedido do Alediov, 05/11/2026); atualiza a cada evento e a cada 20 s
  const det = c.querySelector(".gr-eta");
  ctxEta = { s, aulas };
  if (m.disponivel && temModelo) {
    pintarEta(det, s, aulas, tr);
    const tq = setInterval(() => { if (!document.body.contains(det)) { clearInterval(tq); return; } if (!ultimoTr?.rodando) pintarEta(det, s, aulas, ultimoTr || tr); }, 20000);
  }
  return c;
}

// ---------------------------------------------------------------- andamento detalhado e estimativas (estimativa.js)
const CHAVE_ETA = "orbita.gravacao.eta";
let ctxEta = null, ultimoTr = null;
const etaAberto = () => { try { return localStorage.getItem(CHAVE_ETA) !== "fechado"; } catch { return true; } };
/** O fator de velocidade deste aparelho para o modelo escolhido: o do serviço (rodando) ou o das amostras guardadas. */
function fatorAtual(s, aulas, tr) {
  const aj = s.ajustes || {};
  const base = ES.fatorDe({ velocidades: s.velocidades || {}, modelo: aj.modelo || "turbo", variante: s.motor?.variante || "", teste: s.teste, aulas });
  if (tr?.rodando && tr.fator > 0) return { ...base, fator: tr.fator, fonte: base.fonte || "medido" };
  return base;
}
const FONTE_FATOR = {
  medido: (f) => `medida em ${f.amostras} ${f.amostras === 1 ? "parte" : "partes"} neste celular`,
  outra: () => "medida com a outra versão do motor",
  teste: () => "pelo teste de velocidade",
  aulas: (f) => `pelas ${f.amostras} ${f.amostras === 1 ? "aula transcrita" : "aulas transcritas"}`,
};
const dataCurta = (d) => (d ? dataBR(d) : "");
function pintarEta(det, s, aulas, tr) {
  if (!det) return;
  ultimoTr = tr;
  const aj = s.ajustes || {}, agora = Date.now(), hora = aj.hora ?? 22;
  const fx = fatorAtual(s, aulas, tr);
  const q = ES.estimar({ tr, aulas, fator: fx.fator, agora, hora, auto: aj.auto !== false });
  if (!q.fila.length) { det.hidden = true; return; }
  det.hidden = false;
  if (!det.dataset.ligado) {
    det.dataset.ligado = "1";
    det.open = etaAberto();
    det.addEventListener("toggle", () => { try { localStorage.setItem(CHAVE_ETA, det.open ? "aberto" : "fechado"); } catch { /* */ } });
  }
  const a = q.atual;
  let h = `<summary><span class="gr-eta-fim">${icone("⏱️", "ico-inline")} ${escapar(ES.textoFim(q, agora))}</span><small>${det.open ? "Menos" : "Detalhes"}</small></summary><div class="gr-eta-corpo">`;
  if (a) {
    const pAula = a.totalMs ? Math.min(1, a.feitoMs / a.totalMs) : 0;
    h += `<div class="gr-eta-atual"><b>${escapar(a.disciplina)}${a.titulo ? ` · ${escapar(a.titulo)}` : ""}</b><small>${dataCurta(a.data)}</small>
      <div class="gr-eta-l"><span>Parte ${a.parte + 1} de ${a.partes}${a.etapa === "ouvindo" ? " · abrindo o áudio" : ""}</span><b>${Math.round(a.pctParte * 100)}%</b></div>
      <div class="gr-prog fina"><i style="transform:scaleX(${a.pctParte})"></i></div>
      <div class="gr-eta-l"><span>A aula: ${ES.minutosAudio(a.feitoMs)} de ${ES.minutosAudio(a.totalMs)} de áudio</span><b>${Math.round(pAula * 100)}%</b></div>
      <div class="gr-prog fina"><i style="transform:scaleX(${pAula})"></i></div>
      <p class="gr-eta-resta">${a.restanteMs != null ? `Faltam <b>${ES.duracao(a.restanteMs)}</b> nesta aula${a.fimEm ? ` · pronta ${ES.diaTexto(a.fimEm, agora) === "hoje" ? "" : ES.diaTexto(a.fimEm, agora) + " "}às ${ES.horaTexto(a.fimEm)}` : ""}` : "Medindo a velocidade na primeira parte…"}</p></div>`;
  }
  const outras = q.fila.filter(x => !x.atual);
  if (outras.length) {
    h += `<h4>${a ? "Depois desta" : "Na fila"} <small>${outras.length} ${outras.length === 1 ? "aula" : "aulas"} · ${ES.minutosAudio(outras.reduce((x, y) => x + y.faltaMs, 0))} de áudio</small></h4><ol class="gr-eta-fila">`;
    for (const x of outras) {
      h += `<li><span><b>${escapar(x.disciplina)}</b> <small>${dataCurta(x.data)}${x.titulo ? ` · ${escapar(x.titulo)}` : ""}</small></span>
        <small>${ES.minutosAudio(x.faltaMs)} de áudio${x.parte ? ` (da parte ${x.parte + 1})` : ""}${x.restanteMs != null ? ` · ${ES.duracao(x.restanteMs)}` : ""}${x.fimEm ? ` · pronta ${ES.diaTexto(x.fimEm, agora) === "hoje" ? "" : ES.diaTexto(x.fimEm, agora) + " "}~${ES.horaTexto(x.fimEm)}` : ""}</small></li>`;
    }
    h += `</ol>`;
  }
  h += `<p class="gr-eta-vel">${icone("⚡", "ico-inline")} ${fx.fator > 0 ? `Velocidade: <b>${ES.fatorTexto(fx.fator)}</b> (${FONTE_FATOR[fx.fonte]?.(fx) || "estimada"})` : "Velocidade ainda não medida: a primeira parte transcrita mostra quanto tempo tudo leva."}</p>`;
  if (q.modo === "noite" || q.modo === "espera") {
    const dentro = !!ES.janelaEm(agora, hora);
    h += `<p class="gr-eta-noite">${icone("🌙", "ico-inline")} De madrugada, das ${hora}h às 7h e carregando; tirar da tomada para e ela continua na próxima noite.${q.noite?.noites > 1 ? ` Não cabe numa noite: segue sozinha nas seguintes (${q.noite.noites} no total).` : ""}${q.modo === "espera" && dentro && s.carregando === false ? " <b>Ligue na tomada para começar.</b>" : ""}</p>`;
  } else if (q.modo === "agora") h += `<p class="gr-eta-noite">${icone("🔋", "ico-inline")} Transcrevendo agora, fora da madrugada${s.carregando === false ? ": melhor com o celular na tomada" : ""}.</p>`;
  h += `<p class="gr-eta-nota">Estimativa pela velocidade das últimas partes; muda um pouco com os silêncios da aula.</p></div>`;
  det.innerHTML = h;
  det.querySelector("summary small").textContent = det.open ? "Menos" : "Detalhes";
  det.ontoggle = () => { const sm = det.querySelector("summary small"); if (sm) sm.textContent = det.open ? "Menos" : "Detalhes"; };
}

// ---------------------------------------------------------------- gravar
/** As aulas de hoje que dá para gravar agora (começam em até 20 min ou estão acontecendo). */
function aulasDeAgora() {
  const agora = new Date().toTimeString().slice(0, 5), hoje = hojeISO();
  const soma = (hm, min) => { const [h, m] = hm.split(":").map(Number), x = h * 60 + m + min; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
  return AG.eventosDoDia(hoje).filter(ev => ev.item.tipo !== "A" && !ev.item.especial && agora >= soma(ev.inicio, -20) && agora <= ev.fim);
}

async function gravarEvento(ev, extra = {}) {
  try {
    await GR.iniciar(await GR.dadosDaAula(ev, extra));
    toast("Gravando. Pode apagar a tela.");
  } catch (e) {
    const m = String(e?.message || e);
    if (/sem_microfone|Permission|NotAllowed/i.test(m)) modal({ titulo: "Sem o microfone", texto: "O Órbita precisa da permissão do microfone para gravar a aula. Ela é pedida uma vez; se negou, libere em Configurações → Apps → Órbita → Permissões." });
    else modal({ titulo: "Não consegui gravar", texto: m });
  }
}

async function gravarOutra() {
  const discs = AG.disciplinas();
  const f = await formulario({ titulo: "Gravar uma aula", campos: [
    { id: "disc", rotulo: "Disciplina", tipo: "select", opcoes: [...discs.map(d => [d, d]), ["__outra", "Outra…"]] },
    { id: "outra", rotulo: "Nome", tipo: "text", mostrarSe: (v) => v.disc === "__outra" },
    { id: "titulo", rotulo: "Tema da aula (opcional)", tipo: "text", placeholder: "Ex.: técnica do alveolar inferior", dica: "Ajuda a transcrição a acertar os termos." },
  ], botoes: [{ texto: "Começar a gravar", acao: "ok" }] });
  if (!f) return;
  const nome = f.disc === "__outra" ? (f.outra || "Aula") : f.disc;
  const item = AG.A().itens.find(i => i.nome === nome) || { nome, curto: nome };
  gravarEvento({ item, chave: "", data: hojeISO() }, { titulo: f.titulo });
}

function cartaoGravar(irPara, s) {
  const c = elemento(`<div class="cartao gr-gravar"><div class="gr-gravar-cab">${icone("🎤")}<div><h2>Gravar uma aula</h2><p class="sub">Perto do professor, com a tela para baixo.</p></div></div><div class="gr-agora"></div></div>`);
  const box = c.querySelector(".gr-agora");
  for (const ev of aulasDeAgora()) {
    const b = document.createElement("button"); b.className = "botao gr-bt-gravar";
    b.innerHTML = `<i class="gr-rec"></i> Gravar ${escapar(GR.nomeDisciplina(ev.item))} <small>${ev.inicio}–${ev.fim}</small>`;
    b.onclick = () => gravarEvento(ev);
    box.append(b);
  }
  const outra = document.createElement("button"); outra.className = `botao ${box.children.length ? "secundario" : ""}`;
  outra.innerHTML = box.children.length ? "Gravar outra coisa" : `<i class="gr-rec"></i> Gravar agora`;
  outra.onclick = gravarOutra;
  box.append(outra);
  if (s.web) box.insertAdjacentHTML("beforeend", `<p class="sub gr-nota">No navegador, a gravação usa o microfone do computador e fica só neste navegador (para testar a tela). No celular, grava com a tela apagada.</p>`);
  return c;
}

function cartaoAoVivo(g, irPara) {
  const c = elemento(`<div class="cartao gr-vivo ${g.pausado ? "pausada" : ""}">
    <div class="gr-vivo-cab"><i class="gr-rec"></i><b>${g.pausado ? "Pausada" : "Gravando"}</b><span>${escapar(g.disciplina || "Aula")}${g.titulo ? ` · ${escapar(g.titulo)}` : ""}</span></div>
    <div class="gr-tempo">${relogio(g.decorrido)}</div>
    <div class="gr-nivel" aria-hidden="true"><i></i></div>
    <p class="sub gr-para">${g.pararEm ? `Para sozinha às ${new Date(g.pararEm).toTimeString().slice(0, 5)} · ` : ""}${{ ogg: "Opus", m4a: "AAC", webm: "WebM" }[g.formato] || ""}${g.fonte === "voz" ? " · microfone de voz" : g.fonte === "mic" ? " · microfone comum" : ""}</p>
    <div class="gr-marcar">${MARCADORES.map(m => `<button data-tipo="${m.tipo}">${icone(m.icone, "ico-inline")}<span>${m.nome}</span><b></b></button>`).join("")}</div>
    <div class="gr-ctl"><button class="botao secundario" data-a="pausa">${g.pausado ? "Retomar" : "Pausar"}</button><button class="botao gr-parar" data-a="parar">Parar e salvar</button></div>
    <ul class="gr-lista-marc"></ul>
  </div>`);
  const pintarMarc = (ms = []) => {
    for (const b of c.querySelectorAll(".gr-marcar button")) { const n = ms.filter(m => m.tipo === b.dataset.tipo).length; b.querySelector("b").textContent = n || ""; }
    c.querySelector(".gr-lista-marc").innerHTML = ms.slice(-6).reverse().map(m => `<li>${icone(marcador(m.tipo).icone, "ico-inline")} ${marcador(m.tipo).nome} <span>${relogio(m.t)}</span></li>`).join("");
  };
  pintarMarc(g.marcadores || []);
  for (const b of c.querySelectorAll(".gr-marcar button")) b.onclick = async () => {
    b.classList.remove("ok"); void b.offsetWidth; b.classList.add("ok");
    navigator.vibrate?.(15);
    try { await GR.comando("marcar", b.dataset.tipo); const st = await GR.estadoGravacao(); pintarMarc(st.marcadores || []); } catch (e) { toast("Não marcou: " + (e.message || e)); }
  };
  c.querySelector('[data-a="pausa"]').onclick = async () => { await GR.comando(c.classList.contains("pausada") ? "retomar" : "pausar").catch(e => toast(String(e.message || e))); };
  c.querySelector('[data-a="parar"]').onclick = async () => {
    const ok = await modal({ titulo: "Parar a gravação?", texto: "A aula fica salva e entra na fila da transcrição da madrugada.", botoes: [{ texto: "Parar e salvar", valor: true }, { texto: "Continuar gravando", classe: "secundario", valor: false }] });
    if (ok) { await GR.comando("parar").catch(e => toast(String(e.message || e))); toast("Aula salva."); }
  };
  // tempo e nível: pergunta o estado a cada 0,4 s enquanto o cartão está na tela
  const barra = c.querySelector(".gr-nivel i"), tempo = c.querySelector(".gr-tempo");
  const tq = setInterval(async () => {
    if (!document.body.contains(c)) { clearInterval(tq); return; }
    try {
      const st = await GR.estadoGravacao();
      if (!st.gravando) return;
      tempo.textContent = relogio(st.decorrido);
      barra.style.transform = `scaleX(${st.pausado ? 0 : Math.max(.03, Math.min(1, Math.sqrt(st.nivel || 0)))})`;
      if (!!st.pausado !== c.classList.contains("pausada")) {
        c.classList.toggle("pausada", !!st.pausado);
        c.querySelector('[data-a="pausa"]').textContent = st.pausado ? "Retomar" : "Pausar";
        c.querySelector(".gr-vivo-cab b").textContent = st.pausado ? "Pausada" : "Gravando";
      }
    } catch (e) { /* segue */ }
  }, 400);
  return c;
}

// ---------------------------------------------------------------- a lista
function secaoAulas(aulas, s, irPara) {
  const sec = elemento(`<div class="secao gr-aulas"><h2>As aulas${aulas.length ? ` <small>${aulas.length}</small>` : ""}</h2></div>`);
  if (!aulas.length) { sec.insertAdjacentHTML("beforeend", `<div class="cartao gr-vazio">${icone("🎤")}<p>Nenhuma aula gravada ainda. Na Agenda, cada aula de hoje tem o botão <b>Gravar aula</b>.</p></div>`); return sec; }
  const porDisc = new Map();
  for (const a of aulas) { const k = a.disciplina || "Aula"; if (!porDisc.has(k)) porDisc.set(k, []); porDisc.get(k).push(a); }
  for (const [disc, l] of porDisc) {
    const g = elemento(`<div class="gr-grupo"><h3>${escapar(disc)} <small>${l.length} ${l.length === 1 ? "aula" : "aulas"} · ${minutos(l.reduce((x, a) => x + (a.duracao || 0), 0))}</small></h3></div>`);
    for (const a of l) {
      const nm = (a.marcadores || []).length;
      const b = elemento(`<button class="gr-aula"><span class="gr-data"><b>${a.data ? dataBR(a.data) : "—"}</b><small>${a.data ? dataBR(a.data, { weekday: "short" }).replace(".", "") : ""}</small></span>
        <span class="gr-meio"><b>${escapar(a.titulo || `Aula de ${a.disciplina || ""}`)}</b><small>${a.gravando ? "gravando agora" : `${minutos(a.duracao)}${nm ? ` · ${nm} ${nm === 1 ? "marcador" : "marcadores"}` : ""}${a.local === false ? ` · ${icone("📁", "ico-inline")}` : ""}`}</small></span>
        ${chipSituacao(a, s.transcricao)}</button>`);
      b.dataset.id = a.id;
      b.onclick = () => { vista = a.id; telaAula(a.id, irPara); };
      g.append(b);
    }
    sec.append(g);
  }
  return sec;
}

// ---------------------------------------------------------------- transcrição no aparelho
function secaoTranscricao(s, aulas, irPara) {
  const sec = elemento(`<div class="secao gr-tr"><h2>Transcrição</h2><div class="cartao"></div></div>`);
  const c = sec.querySelector(".cartao");
  if (s.web) { c.innerHTML = `<p class="sub">Transcrever é só no celular: o Whisper roda no próprio aparelho, de madrugada, com ele carregando. Aqui no navegador dá para gravar e ouvir.</p>`; return sec; }
  const m = s.motor || {}, aj = s.ajustes || {}, tr = s.transcricao || {};
  const modelos = (s.modelos || []).filter(x => x.id !== "vad");
  const escolhido = aj.modelo || "turbo", temModelo = modelos.find(x => x.id === escolhido)?.baixado;
  c.innerHTML = `
    <div class="gr-motor ${m.disponivel ? "ok" : "falta"}">${m.disponivel ? `${icone("🧠", "ico-inline")} Motor pronto <small>whisper.cpp${m.variante?.endsWith("v82") ? " · versão rápida da CPU" : ""} · ${m.threads} núcleos</small>` : `${icone("⚠️", "ico-inline")} O motor de transcrição ainda não está neste APK.<small>Ele chega numa atualização do app (workflow "Whisper" no GitHub). Até lá, as aulas ficam na fila.</small>`}</div>
    <h4>Modelo</h4>
    <div class="gr-modelos">${modelos.map(x => `<label class="gr-modelo ${x.id === escolhido ? "sel" : ""}"><input type="radio" name="gr-modelo" value="${x.id}" ${x.id === escolhido ? "checked" : ""}>
      <span><b>${x.id === "turbo" ? "Melhor (Large v3 Turbo)" : "Leve (Small)"}</b><small>${x.mb} MB · ${x.id === "turbo" ? "acerta mais, mais lento" : "para aparelho fraco"}${x.baixado ? " · baixado ✓" : ""}</small></span></label>`).join("")}</div>
    <div class="gr-baixar"></div>
    <label class="linha-cfg"><span>Transcrever de madrugada, carregando</span><input type="checkbox" class="check" data-k="auto" ${aj.auto !== false ? "checked" : ""}></label>
    <label class="campo gr-hora"><span>A partir de</span><select data-k="hora">${[20, 21, 22, 23, 0, 1, 2].map(h => `<option value="${h}" ${h === (aj.hora ?? 22) ? "selected" : ""}>${h}h</option>`).join("")}</select><small class="dica">Começa nessa hora (ou depois, quando ligar na tomada) e vai até as 7h.</small></label>
    <label class="linha-cfg"><span>Pular os silêncios (detecção de voz)</span><input type="checkbox" class="check" data-k="vad" ${aj.vad !== false ? "checked" : ""}></label>
    ${s.semOtimizacao === false ? `<div class="gr-aviso">${icone("🔋", "ico-inline")} Para começar sozinha de madrugada, o Android precisa deixar o Órbita sem otimização de bateria. <button class="link" data-a="bateria">Liberar</button></div>` : ""}`;
  sec.insertAdjacentHTML("beforeend", `<h2 class="gr-h2-vel">Velocidade neste celular</h2><div class="cartao gr-teste"></div>`);
  // modelo
  for (const r of c.querySelectorAll('input[name="gr-modelo"]')) r.onchange = async () => { await GR.ajustesTranscricao({ modelo: r.value }); telaAulas(irPara); };
  const baixar = c.querySelector(".gr-baixar");
  if (!temModelo) {
    const mm = modelos.find(x => x.id === escolhido);
    baixar.innerHTML = `<button class="botao">Baixar o modelo (${mm?.mb || "?"} MB)</button><p class="sub">Uma vez só, pelo Wi-Fi. Fica nos arquivos do app.</p>`;
    baixar.querySelector("button").onclick = () => baixarModelo(escolhido, baixar, irPara);
  } else {
    baixar.innerHTML = `<button class="link gr-apagar-modelo">Apagar o modelo baixado</button>`;
    baixar.querySelector("button").onclick = async () => { if (await modal({ titulo: "Apagar o modelo?", texto: "Para transcrever de novo, ele precisa ser baixado outra vez.", botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] })) { await GR.apagarModelo(escolhido); telaAulas(irPara); } };
  }
  for (const el of c.querySelectorAll("[data-k]")) el.onchange = () => GR.ajustesTranscricao({ [el.dataset.k]: el.type === "checkbox" ? el.checked : Number(el.value) });
  c.querySelector('[data-a="bateria"]')?.addEventListener("click", () => GR.semOtimizacao());
  // testar a velocidade
  const te = sec.querySelector(".gr-teste"), r = s.teste;
  const fator = r?.fator || 0;
  te.innerHTML = `${r ? `<p class="gr-res"><b>${String(fator).replace(".", ",")}×</b> ${fator >= 1 ? "mais rápido que o tempo real" : "do tempo real"}: ${String(r.audio).replace(".", ",")} s de áudio em ${String(r.gasto).replace(".", ",")} s (${r.modelo === "turbo" ? "Turbo" : "Small"}). Uma aula de 100 min leva <b>~${Math.round(100 / Math.max(.05, fator))} min</b>${fator < .5 ? `. Lento demais: use o modelo Leve ou transcreva no notebook (tools/aulas/transcrever.py)` : ""}.</p>
      ${r.amostra ? `<blockquote class="gr-amostra">${escapar(r.amostra)}</blockquote>` : ""}` : `<p class="sub">Transcreve o primeiro minuto de uma aula gravada e mostra quanto tempo uma aula inteira levaria neste aparelho.</p>`}
    ${(() => { const fx = fatorAtual(s, aulas, s.transcricao); return fx.fonte === "medido" || fx.fonte === "outra" ? `<p class="sub gr-medido">${icone("⚡", "ico-inline")} Nas transcrições de verdade: <b>${ES.fatorTexto(fx.fator)}</b> (${FONTE_FATOR[fx.fonte](fx)}). É esta que as estimativas usam.</p>` : ""; })()}
    <button class="botao secundario" ${!aulas.some(a => !a.gravando && a.partes?.length) || !m.disponivel || !temModelo ? "disabled" : ""}>Testar com a última aula</button>`;
  te.querySelector("button.botao").onclick = async () => {
    const a = aulas.find(x => !x.gravando && x.partes?.length);
    try { await GR.testar(a.id, 60); toast("Testando… leva de 30 s a alguns minutos."); } catch (e) { toast(String(e.message || e), 4000); }
  };
  return sec;
}

function desenharAgora(box, s, tr, irPara) {
  if (!box) return;
  if (tr.rodando) {
    box.innerHTML = `<div class="gr-andamento"><div class="gr-prog"><i style="transform:scaleX(${tr.progresso || 0})"></i></div><p class="sub">${escapar(textoAndamento(tr))}</p><button class="link">Parar</button></div>`;
    box.querySelector("button").onclick = () => GR.pararTranscricao();
    return;
  }
  const n = s.naFila || 0;
  box.innerHTML = `${tr.erro ? `<div class="gr-aviso erro">${escapar(tr.erro)}</div>` : ""}<button class="botao secundario" ${n ? "" : "disabled"}>Transcrever agora</button>${n && s.carregando === false ? `<p class="sub">Melhor com o celular na tomada.</p>` : ""}`;
  box.querySelector("button").onclick = async () => { try { await GR.transcrever(); toast("Transcrevendo. Acompanhe pela notificação."); } catch (e) { toast(String(e.message || e), 4000); } };
}

function atualizarTranscricao(corpo, tr) {
  if (!tr) return;
  const det = corpo.querySelector(".gr-eta");
  if (det && ctxEta) pintarEta(det, ctxEta.s, ctxEta.aulas, tr);
  const box = corpo.querySelector(".gr-tr-agora");
  if (box && tr.rodando) {
    const p = box.querySelector(".gr-prog i");
    if (p) { p.style.transform = `scaleX(${tr.progresso || 0})`; box.querySelector(".sub").textContent = textoAndamento(tr); }
    else desenharAgora(box, { naFila: 0 }, tr);
  }
  if (tr.id) { const chip = corpo.querySelector(`.gr-aula[data-id="${tr.id}"] .gr-chip`); if (chip && tr.rodando) { chip.className = "gr-chip andamento"; chip.textContent = `${Math.round((tr.progresso || 0) * 100)}%`; } }
  if (!tr.rodando) setTimeout(() => window.dispatchEvent(new Event("oq-gravacao-redesenhar")), 0);
}

/** "Parte 3 de 6 · ~25 min restantes · 42%" (como a notificação) ou a fase com o %. */
function textoAndamento(tr) {
  const pct = `${Math.round((tr.progresso || 0) * 100)}%`;
  if (!(tr.partes > 0) || tr.teste) return `${tr.fase || "Transcrevendo…"} · ${pct}`;
  return `${ES.textoNotificacao(tr, tr.fator || 0)} · ${pct}`;
}

async function baixarModelo(id, box, irPara) {
  box.innerHTML = `<div class="gr-prog"><i></i></div><p class="sub gr-baixando">Baixando…</p><button class="link">Cancelar</button>`;
  box.querySelector("button").onclick = () => GR.cancelarDownload();
  const desl = GR.ouvir("modelo", (p) => {
    if (!document.body.contains(box) || p.id !== id) return;
    const f = p.total ? p.feito / p.total : 0;
    box.querySelector(".gr-prog i").style.transform = `scaleX(${f})`;
    box.querySelector(".gr-baixando").textContent = `Baixando… ${MB(p.feito)} de ${MB(p.total)}`;
  });
  try { await GR.baixarModelo(id); toast("Modelo baixado."); }
  catch (e) { toast(/cancelado/.test(e.message) ? "Download cancelado (continua de onde parou da próxima vez)." : `O download parou: ${e.message}`, 4500); }
  finally { desl(); telaAulas(irPara); }
}

// ---------------------------------------------------------------- pasta
function secaoPasta(s, irPara) {
  const sec = elemento(`<div class="secao gr-pasta"><h2>Onde ficam os áudios</h2><div class="cartao"></div></div>`);
  const c = sec.querySelector(".cartao");
  if (s.web) { c.innerHTML = `<p class="sub">No navegador, ficam só neste navegador (${MB(s.usado)}).</p>`; return sec; }
  c.innerHTML = `<p>${s.pasta ? `${icone("📁", "ico-inline")} <b>${escapar(s.pastaNome || "pasta escolhida")}</b>` : "Nos arquivos do app (somem se o app for desinstalado)."}</p>
    <p class="sub">Uma pasta por disciplina e outra por aula. ${MB(s.usado)} usados${s.livre > 0 ? ` · ${MB(s.livre)} livres` : ""} · cerca de 11 MB por hora de aula.</p>
    <div class="gr-botoes"><button class="botao secundario" data-a="escolher">${s.pasta ? "Trocar a pasta" : "Escolher uma pasta no cartão SD"}</button>${s.pasta ? `<button class="link" data-a="procurar">Procurar aulas na pasta</button>` : ""}</div>`;
  c.querySelector('[data-a="escolher"]').onclick = async () => {
    try { const r = await GR.escolherPasta(); toast(`Pasta: ${r.nome}${r.movidas ? ` · ${r.movidas} aula(s) levada(s) para lá` : ""}${r.voltaram ? ` · ${r.voltaram} aula(s) achada(s)` : ""}`, 4000); telaAulas(irPara); }
    catch (e) { if (!/cancelado/.test(e.message)) toast(e.message, 4000); }
  };
  c.querySelector('[data-a="procurar"]')?.addEventListener("click", async () => { const r = await GR.procurarNaPasta(); toast(r.voltaram ? `${r.voltaram} aula(s) voltaram para a lista.` : "Nenhuma aula nova na pasta."); telaAulas(irPara); });
  return sec;
}

// ---------------------------------------------------------------- opções da Agenda e conselhos
function secaoOpcoes() {
  const k = GR.cfg();
  const sec = elemento(`<div class="secao gr-opcoes"><h2>Agenda</h2><div class="cartao">
    <label class="linha-cfg"><span>Avisar no começo de cada aula</span><input type="checkbox" class="check" data-k="aviso" ${k.aviso ? "checked" : ""}></label>
    <label class="linha-cfg"><span>Parar sozinha no fim da aula + 15 min</span><input type="checkbox" class="check" data-k="pararNoFim" ${k.pararNoFim ? "checked" : ""}></label>
  </div></div>`);
  for (const el of sec.querySelectorAll("[data-k]")) el.onchange = () => { GR.definirCfg({ [el.dataset.k]: el.checked }); toast("Salvo."); };
  return sec;
}

function conselhos() {
  return elemento(`<details class="secao gr-conselhos"><summary><h2>${icone("💡", "ico-inline")} Para gravar bem</h2></summary><div class="cartao"><ul>
    <li><b>Perto de quem fala.</b> O celular na mesa da frente, perto do professor, rende mais que qualquer ajuste. A cada metro a mais, a voz cai e o barulho da sala sobe.</li>
    <li><b>Tela para baixo, sobre um caderno ou casaco.</b> O microfone de baixo fica livre e a mesa não passa as batidas e o arrastar de cadeiras.</li>
    <li><b>Modo avião (opcional).</b> Sem notificações e chamadas, sem chiado de rádio e com menos bateria. A gravação não precisa de internet.</li>
    <li><b>Microfone de lapela sem fio ou USB-C.</b> Se o professor aceitar usar, a transcrição melhora muito (voz limpa, sem a sala). Um de lapela simples já basta.</li>
    <li><b>Marque na hora.</b> "Cai na prova" e "Importante" pesam mais nas lições; "Não entendi" vira revisão; "Exemplo/caso" vira questão de caso clínico.</li>
    <li><b>Bateria.</b> Gravar gasta pouco (~3 a 5% por hora). Transcrever gasta muito: por isso só de madrugada, na tomada.</li>
    <li><b>Combinado com a turma.</b> Os professores autorizaram o áudio para o seu estudo. O áudio fica só no seu celular (e no cartão); nada de áudio vai para a internet.</li>
  </ul></div></details>`);
}

// ---------------------------------------------------------------- uma aula
const VELS = [1, 1.25, 1.5, 1.75, 2];
export async function telaAula(id, irPara) {
  const t = tela();
  const a = await GR.aula(id);
  if (!a) { vista = null; return telaAulas(irPara); }
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Aulas gravadas";
  v.onclick = () => { GR.audio("parar").catch(() => {}); vista = null; telaAulas(irPara); };
  t.innerHTML = ""; t.scrollTop = 0;
  t.append(v);
  const dur = a.duracao || 0, ms = (a.marcadores || []).slice().sort((x, y) => x.t - y.t);
  const box = elemento(`<div class="gr-detalhe">
    <div class="gr-tit"><h1 class="titulo-tela">${escapar(a.titulo || `Aula de ${a.disciplina}`)}</h1><button class="gr-lapis" aria-label="Renomear">${icone("📝", "ico-inline")}</button></div>
    <p class="sub">${escapar(a.disciplina || "")} · ${a.data ? dataBR(a.data, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : ""}${a.inicio ? ` · ${a.inicio}${a.fim ? `–${a.fim}` : ""}` : ""} · ${minutos(dur)}${a.motivoFim === "interrompida" ? " · gravação interrompida" : ""}</p>
    <div class="cartao gr-tocador">
      <div class="gr-tl"><button class="gr-play" aria-label="Tocar">▶</button><div class="gr-tempos"><b class="gr-pos">0:00</b><small>/ ${relogio(dur)}</small></div>
        <button class="gr-pulo" data-d="-15000">−15 s</button><button class="gr-pulo" data-d="30000">+30 s</button><button class="gr-vel">1×</button></div>
      <div class="gr-trilho"><input type="range" min="0" max="${Math.max(1, dur)}" step="1000" value="0" aria-label="Posição">
        <div class="gr-ticks">${ms.map(m => `<i class="t-${m.tipo}" style="left:${(m.t / Math.max(1, dur)) * 100}%"></i>`).join("")}</div></div>
    </div>
    <div class="secao"><h2>Marcadores</h2><div class="cartao gr-marcs">${ms.length ? "" : `<p class="sub">Sem marcadores. Toque em "Marcar aqui" enquanto ouve.</p>`}</div>
      <button class="botao secundario gr-marcar-aqui">+ Marcar aqui</button></div>
    <div class="secao"><h2>Transcrição</h2><div class="cartao gr-transc"><p class="sub">Carregando…</p></div></div>
    <button class="link gr-apagar">Apagar esta aula</button>
  </div>`);
  t.append(box);
  // marcadores
  const lista = box.querySelector(".gr-marcs");
  for (const m of ms) {
    const li = elemento(`<div class="gr-marc"><button class="gr-marc-ir">${icone(marcador(m.tipo).icone, "ico-inline")} <span>${marcador(m.tipo).nome}</span><b>${relogio(m.t)}</b></button><button class="gr-marc-x" aria-label="Apagar marcador">×</button></div>`);
    li.querySelector(".gr-marc-ir").onclick = () => irA(Math.max(0, m.t - 5000), true);
    li.querySelector(".gr-marc-x").onclick = async () => { await GR.atualizar(a.id, { marcadores: (a.marcadores || []).filter(x => x !== m) }); telaAula(id, irPara); };
    lista.append(li);
  }
  // tocador
  let pos = 0, tocando = false, aberto = false, velI = 0;
  const range = box.querySelector('input[type="range"]'), play = box.querySelector(".gr-play"), posEl = box.querySelector(".gr-pos");
  const mostrar = (p) => { pos = p; posEl.textContent = relogio(p); if (!range.matches(":active")) range.value = p; marcarSegmento(p); };
  async function irA(t, tocar = false) {
    try {
      if (!aberto || tocar && !tocando) { await GR.tocar(a.id, t, VELS[velI]); aberto = true; tocando = true; }
      else await GR.audio("ir", { t });
      mostrar(t);
    } catch (e) { toast(String(e.message || e)); }
  }
  play.onclick = async () => {
    if (!aberto) return irA(pos, true);
    await GR.audio(tocando ? "pausar" : "continuar").catch(() => {});
  };
  range.onchange = () => irA(Number(range.value));
  for (const b of box.querySelectorAll(".gr-pulo")) b.onclick = () => irA(Math.max(0, Math.min(dur, pos + Number(b.dataset.d))));
  box.querySelector(".gr-vel").onclick = async (e) => { velI = (velI + 1) % VELS.length; e.currentTarget.textContent = `${String(VELS[velI]).replace(".", ",")}×`; if (aberto) await GR.audio("velocidade", { velocidade: VELS[velI] }).catch(() => {}); };
  const desl = GR.ouvir("audio", (st) => {
    if (!document.body.contains(box)) { desl(); GR.audio("pausar").catch(() => {}); return; }
    if (st.id && st.id !== a.id) return;
    tocando = !!st.tocando;
    play.textContent = tocando ? "❚❚" : "▶";
    play.classList.toggle("tocando", tocando);
    if (st.fim) { aberto = false; mostrar(0); return; }
    mostrar(st.t || 0);
  });
  box.querySelector(".gr-marcar-aqui").onclick = async () => {
    const tipo = await modal({ titulo: `Marcar em ${relogio(pos)}`, botoes: MARCADORES.map(m => ({ texto: m.nome, valor: m.tipo, classe: "secundario" })) });
    if (!tipo) return;
    await GR.atualizar(a.id, { marcadores: [...(a.marcadores || []), { t: Math.round(pos), tipo, em: Date.now() }] });
    telaAula(id, irPara);
  };
  box.querySelector(".gr-lapis").onclick = async () => {
    const f = await formulario({ titulo: "Dados da aula", campos: [
      { id: "titulo", rotulo: "Tema / título", valor: a.titulo || "" },
      { id: "disciplina", rotulo: "Disciplina", valor: a.disciplina || "" },
      { id: "professor", rotulo: "Professor(a) (opcional)", valor: a.professor || "" }] });
    if (!f) return;
    await GR.atualizar(a.id, { titulo: f.titulo, disciplina: f.disciplina || a.disciplina, professor: f.professor, conteudo: GR.conteudoDe(f.disciplina || a.disciplina) });
    telaAula(id, irPara);
  };
  box.querySelector(".gr-apagar").onclick = async () => {
    const ok = await modal({ titulo: "Apagar esta aula?", texto: "Apaga o áudio, os marcadores e a transcrição deste aparelho (e da pasta). O texto que já subiu para as trilhas continua lá.", botoes: [{ texto: "Apagar", valor: true, classe: "errado" }, { texto: "Cancelar", classe: "secundario", valor: false }] });
    if (!ok) return;
    try { await GR.apagar(a.id); toast("Aula apagada."); vista = null; telaAulas(irPara); } catch (e) { toast(/gravando/.test(e.message) ? "Pare a gravação antes de apagar." : String(e.message || e)); }
  };
  // transcrição
  const tc = box.querySelector(".gr-transc");
  let segs = [];
  function marcarSegmento(p) {
    if (!segs.length) return;
    const s = p / 1000;
    const atual = tc.querySelector(".gr-seg.agora");
    const el = [...tc.querySelectorAll(".gr-seg")].find(x => s >= Number(x.dataset.i) && s < Number(x.dataset.f));
    if (el === atual) return;
    atual?.classList.remove("agora");
    el?.classList.add("agora");
  }
  const sit = a.transcricao?.situacao || "nao";
  const tr = sit === "feita" ? await GR.transcricao(a.id).catch(() => null) : null;
  if (!document.body.contains(tc)) return;
  if (tr?.segmentos?.length) {
    segs = tr.segmentos;
    const mk = (tr.marcadores || []).slice();
    tc.innerHTML = `<p class="sub gr-tr-info">${tr.segmentos.length} trechos · modelo ${escapar(tr.modelo || "")}${a.transcricao?.enviada ? ` · ${icone("✅", "ico-inline")} já nas trilhas (o texto)` : " · o texto sobe para as trilhas na próxima sincronização"}</p><div class="gr-segs"></div>
      ${GR.nativo ? `<button class="link gr-de-novo">Transcrever de novo</button>` : ""}`;
    const sb = tc.querySelector(".gr-segs");
    for (const sgm of tr.segmentos) {
      const [ini, fim, texto] = sgm;
      while (mk.length && mk[0].t <= fim) { const m = mk.shift(); sb.insertAdjacentHTML("beforeend", `<div class="gr-seg-marc t-${m.tipo}">${icone(marcador(m.tipo).icone, "ico-inline")} ${marcador(m.tipo).nome} · ${relogio(m.t * 1000)}</div>`); }
      const p = elemento(`<button class="gr-seg"><small>${relogio(ini * 1000)}</small><span>${escapar(texto)}</span></button>`);
      p.dataset.i = ini; p.dataset.f = fim;
      p.onclick = () => irA(ini * 1000, true);
      sb.append(p);
    }
    tc.querySelector(".gr-de-novo")?.addEventListener("click", () => transcreverEsta(a, true));
  } else {
    const msg = { nao: "Ainda não transcrita.", fila: "Na fila: transcreve de madrugada, com o celular carregando.", andamento: `Transcrevendo (parte ${(a.transcricao?.parte ?? 0) + 1} de ${a.transcricao?.total || a.partes?.length || "?"}).`,
      erro: `Deu erro: ${a.transcricao?.erro || "tente de novo"}.`, vazia: "A gravação ficou vazia.", feita: "A transcrição não foi achada neste aparelho." }[sit] || "";
    tc.innerHTML = `<p class="sub">${escapar(msg)}</p>${GR.nativo && sit !== "vazia" && sit !== "andamento" ? `<button class="botao secundario">Transcrever agora</button>` : ""}`;
    tc.querySelector("button")?.addEventListener("click", () => transcreverEsta(a, false));
  }
}

async function transcreverEsta(a, deNovo) {
  if (deNovo && !(await modal({ titulo: "Transcrever de novo?", texto: "Útil depois de trocar de modelo. A transcrição atual é substituída quando a nova ficar pronta.", botoes: [{ texto: "Transcrever", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] }))) return;
  try { await GR.transcrever(a.id); toast("Transcrevendo. Acompanhe pela notificação."); } catch (e) { toast(String(e.message || e), 4000); }
}

// ---------------------------------------------------------------- na Agenda
/** Botão "Gravar aula" no cartão de uma aula de hoje (antes de começar até o fim + 15 min); "Gravando…" na que está sendo gravada. */
export function botaoGravarAula(ev) {
  if (!ev || ev.item.tipo === "A" || ev.item.especial || ev.data !== hojeISO()) return null;
  const agora = new Date().toTimeString().slice(0, 5);
  const [h, m] = ev.fim.split(":").map(Number), fimMais = `${String(Math.floor((h * 60 + m + 15) / 60)).padStart(2, "0")}:${String((m + 15) % 60).padStart(2, "0")}`;
  const [hi, mi] = ev.inicio.split(":").map(Number), antes = `${String(Math.floor(Math.max(0, hi * 60 + mi - 30) / 60)).padStart(2, "0")}:${String(Math.max(0, hi * 60 + mi - 30) % 60).padStart(2, "0")}`;
  if (agora < antes || agora > fimMais) return null;
  const b = document.createElement("button"); b.className = "gr-ev";
  b.innerHTML = `<i class="gr-rec"></i> Gravar aula`;
  b.onclick = async () => {
    const st = await GR.estadoGravacao().catch(() => ({}));
    if (st.gravando) { abrirAulas("agenda"); return; }
    await gravarEvento(ev);
    abrirAulas("agenda");
  };
  GR.estadoGravacao().then(st => { if (st.gravando) { b.classList.add("gravando"); b.innerHTML = `<i class="gr-rec"></i> ${st.disciplina === GR.nomeDisciplina(ev.item) ? "Gravando esta aula" : "Gravando outra aula"} · abrir`; } }).catch(() => {});
  return b;
}
window.addEventListener("oq-gravacao-redesenhar", () => { if (document.querySelector(".gr-corpo") && !vista) window.dispatchEvent(new CustomEvent("oq-ir", { detail: "aulas" })); });
