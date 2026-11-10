// Avisos do WhatsApp na tela: o resumo da Agenda ("N destaques para decidir" + Abrir, que leva a Destaques em Mensagens,
// telaDestaques.js; pedido do Alediov, 04/11/2026, 20h53: o "Visto" e o "Pôr na Agenda" saíram) e os ajustes (o acesso às
// notificações, os grupos com Sempre / Triagem / Ignorar, o grupo silenciado, o histórico de 30 dias com busca e o envio).
// Abertos pelo cartão, por Mensagens e pelos Ajustes do Órbita (ajustes.js).
import { escapar, modal, toast } from "../ui.js";
import { icone } from "../icones.js";
import * as R from "./regras.js";
import * as W from "./whatsapp.js";
import { fonte, nativo } from "./fonte.js";
import { perguntasAbertas } from "../agendaAvisos/agendaAvisos.js";

const hm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
/** "hoje 14:32", "ontem 08:10", "seg. 03/11 19:00". */
export function quandoTxt(ms) {
  const d = new Date(ms), h = new Date(), ontem = new Date(h); ontem.setDate(h.getDate() - 1);
  const mesmo = (a, b) => a.toDateString() === b.toDateString();
  if (mesmo(d, h)) return `hoje ${hm(d)}`;
  if (mesmo(d, ontem)) return `ontem ${hm(d)}`;
  return `${d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} ${hm(d)}`;
}
export const motivoTxt = (m) => (m === "sempre" ? "grupo de avisos" : m === "menção" ? "falaram com você" : String(m || "").replace(/^data: /, "data/hora: "));

// ---------------------------------------------------------------- o resumo na Agenda
/** O cartão curto da Agenda: os destaques para decidir (e as perguntas do Claude) com "Abrir" (Destaques em Mensagens).
 *  Sem nada para decidir, não aparece (devolve null). */
export function secaoWhats() {
  const nd = W.paraDecidir(), np = perguntasAbertas().length;
  if (!nd.length && !np) return null;
  const gs = [...new Set(nd.map(a => R.limparTitulo(a.grupo)))];
  const sec = document.createElement("div"); sec.className = "secao wa-sec";
  const linha1 = nd.length ? `${nd.length} destaque${nd.length > 1 ? "s" : ""} para decidir` : "";
  const linha2 = np ? `${np > 1 ? `${np} perguntas` : "uma pergunta"} do Claude` : "";
  sec.innerHTML = `<div class="wa-resumo"><span class="wa-r-ic">${icone("💬", "ico3d ico-medio")}</span>
    <span class="wa-r-tx"><b>${escapar([linha1, linha2].filter(Boolean).join(" e "))}</b><small>${escapar(gs.length ? gs.slice(0, 2).join(", ") + (gs.length > 2 ? ` e mais ${gs.length - 2}` : "") : "Destaques do WhatsApp")}</small></span>
    <button class="botao wa-abrir" type="button">Abrir</button></div>`;
  sec.querySelector(".wa-abrir").onclick = () => abrirDestaques();
  return sec;
}
/** Abre Destaques em Mensagens (areas.js abrirEva; import na hora, para não criar ciclo de módulos). `id`: rola até ele. */
export function abrirDestaques(id = "") {
  return import("../areas.js").then(m => m.abrirEva({ conversa: id ? `destaques#${id}` : "destaques" }));
}
/** Abre a conversa do grupo em Mensagens. */
export function irParaConversa(grupo) {
  return import("../areas.js").then(m => m.abrirEva({ conversa: `g:${R.normalizar(grupo)}` }));
}

// ---------------------------------------------------------------- os ajustes
let camada = null;
export function fecharAjustesWhats() { camada?.remove(); camada = null; }
export async function abrirAjustesWhats() {
  fecharAjustesWhats();
  camada = document.createElement("div"); camada.className = "camada-ajustes camada-whats";
  camada.innerHTML = `<header class="aj-cab"><button class="aj-voltar" type="button" aria-label="Voltar">‹</button><h1>Avisos do WhatsApp</h1></header>
    <div class="aj-corpo">
      <section class="secao"><h2>Acesso às notificações</h2><div class="cartao" id="wa-acesso"></div></section>
      <section class="secao"><h2>Grupos</h2><div class="cartao" id="wa-grupos"></div></section>
      <section class="secao"><h2>Grupo silenciado</h2><div class="cartao" id="wa-silencio"></div></section>
      <section class="secao"><h2>Histórico (30 dias)</h2><div class="cartao" id="wa-hist"></div></section>
      <section class="secao"><h2>Envio e privacidade</h2><div class="cartao" id="wa-envio"></div></section>
    </div>`;
  document.body.append(camada);
  const $ = (s) => camada.querySelector(s);
  camada.querySelector(".aj-voltar").onclick = fecharAjustesWhats;

  // acesso
  const acesso = async () => {
    const s = await fonte().situacao().catch(() => null), el = $("#wa-acesso");
    if (!el) return;
    const ok = !!s?.permitido;
    el.innerHTML = `<div class="wa-estado ${ok ? "ok" : "nao"}"><b>${ok ? "Ligado" : "Desligado"}</b><span>${ok
      ? `O Órbita lê só as notificações do WhatsApp${s.ultimaMensagem ? ` · último aviso guardado ${escapar(quandoTxt(s.ultimaMensagem))}` : ""}.`
      : "Sem o acesso, o Órbita não vê as mensagens dos grupos."}</span></div>
      ${!nativo() ? `<p class="sub">No navegador, uma fonte de teste faz o papel das notificações.</p>` : ""}
      <button class="botao ${ok ? "secundario" : ""} wa-permitir" type="button">${ok ? "Abrir o acesso às notificações" : "Dar acesso às notificações"}</button>
      <details class="aj-como"><summary>O Órbita aparece cinza ou não deixa ligar?</summary><ol>
        <li>No Android 13 ou mais novo, app instalado fora da loja precisa de uma liberação a mais: abra os detalhes do app.</li>
        <li>Toque nos ⋮ do canto e em <b>Permitir configurações restritas</b> (confirme com a digital ou o PIN).</li>
        <li>Volte e ligue <b>Órbita: avisos do WhatsApp</b> no acesso às notificações.</li></ol>
        <button class="botao secundario wa-app" type="button">Abrir os detalhes do app</button></details>`;
    el.querySelector(".wa-permitir").onclick = async () => { await fonte().abrirPermissao().catch(() => toast("Não consegui abrir os ajustes do Android.")); if (!nativo()) acesso(); };
    el.querySelector(".wa-app").onclick = () => fonte().abrirApp().catch(() => {});
  };
  const aoVoltar = () => { if (document.visibilityState === "visible" && camada) { acesso(); grupos(); } };
  document.addEventListener("visibilitychange", aoVoltar);
  const fechar0 = fecharAjustesWhats;
  camada.querySelector(".aj-voltar").onclick = () => { document.removeEventListener("visibilitychange", aoVoltar); fechar0(); };

  // grupos
  const grupos = async () => {
    const el = $("#wa-grupos"); if (!el) return;
    const gs = await W.grupos();
    el.innerHTML = `<p class="sub wa-exp"><b>Sempre</b>: todo recado vira destaque. <b>Triagem</b>: só o que fala com você, tem data ou hora, ou palavras como prova, sala, cancelada, prazo. <b>Ignorar</b>: nada é guardado. Grupo novo fica em Ignorar até você escolher.</p><div class="wa-gl"></div>`;
    const gl = el.querySelector(".wa-gl");
    for (const g of gs) {
      const novo = !g.escolhido && !g.padrao;
      const l = document.createElement("div"); l.className = `wa-g ${novo ? "novo" : ""}`; l.dataset.chave = g.chave;
      const quando = g.ultima ? `visto ${quandoTxt(g.ultima)}` : "ainda não apareceu neste celular";
      l.innerHTML = `<div class="wa-g-nome"><b>${escapar(g.nome)}</b><small>${novo ? `<i class="wa-novo">escolha</i> ` : ""}${escapar(quando)}${R.ehPingPong(g.nome) ? " · palavras das automações" : ""}</small></div>
        <div class="wa-seg" role="radiogroup" aria-label="${escapar(g.nome)}">${Object.entries(R.MODOS).map(([k, n]) => `<button type="button" role="radio" data-modo="${k}" class="${g.modo === k ? "on" : ""}" aria-checked="${g.modo === k}">${n}</button>`).join("")}</div>`;
      l.querySelectorAll("[data-modo]").forEach(b => (b.onclick = async () => {
        l.querySelectorAll("[data-modo]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
        l.classList.remove("novo"); l.querySelector(".wa-novo")?.remove();
        await W.definirModo(g.nome, b.dataset.modo);
        historico();
      }));
      gl.append(l);
    }
  };

  // silenciado
  $("#wa-silencio").innerHTML = `<p class="sub" style="margin:0">Grupo <b>silenciado</b> no WhatsApp não gera notificação, então o Órbita não vê as mensagens dele.
    Para um grupo que você quer acompanhar sem barulho, no lugar de silenciar: no grupo, toque no nome → <b>Notificações</b> (ou "Notificações personalizadas") →
    ligue <b>Usar notificações personalizadas</b> e escolha o som <b>Nenhum</b>, a vibração <b>Desligada</b> e a notificação pop-up <b>Sem pop-up</b>.
    Se o Android deixar, em Ajustes do Android → Notificações → WhatsApp, deixe a categoria do grupo como <b>Silenciosa</b> (sem som, mas aparece).</p>`;

  // histórico
  let tBusca = null;
  const historico = async () => {
    const el = $("#wa-hist"); if (!el) return;
    if (!el.querySelector(".wa-busca")) {
      el.innerHTML = `<input class="wa-busca" type="search" placeholder="Buscar no grupo, em quem mandou ou no texto" autocomplete="off"><div class="wa-hl"></div>`;
      el.querySelector(".wa-busca").addEventListener("input", () => { clearTimeout(tBusca); tBusca = setTimeout(historico, 250); });
    }
    const q = el.querySelector(".wa-busca").value, hl = el.querySelector(".wa-hl");
    const l = await W.historico(q).catch(() => []);
    hl.innerHTML = l.length ? "" : `<p class="sub">${q ? "Nada com isso nos últimos 30 dias." : "Nada guardado ainda: só aparecem os grupos Sempre e Triagem."}</p>`;
    for (const m of l.slice(0, 150)) hl.insertAdjacentHTML("beforeend", `<div class="wa-h ${m.motivo ? "passou" : ""}"><div class="wa-av-cab"><b class="wa-grupo">${escapar(m.grupo)}</b><time>${escapar(quandoTxt(m.quando))}</time></div>
      <div class="wa-de">${escapar(m.de)}${m.motivo ? ` <span class="wa-motivo">${escapar(motivoTxt(m.motivo))}</span>` : ` <span class="wa-motivo fora">não passou na triagem</span>`}</div><p class="wa-texto">${escapar(m.texto)}</p></div>`);
    if (l.length > 150) hl.insertAdjacentHTML("beforeend", `<p class="sub">E mais ${l.length - 150}: busque para achar.</p>`);
  };

  // envio
  const envio = () => {
    const el = $("#wa-envio"); if (!el) return;
    const s = W.situacaoEnvio();
    el.innerHTML = `<p class="sub" style="margin:0 0 10px">Só os grupos que você escolheu são guardados, sem número de telefone, por 30 dias neste celular.
      Só os destaques que você marca como <b>Enviar ao Claude</b> (com a nota e os anexos) vão para o repositório privado, em <b>${W.PASTA_REPO}/enviados/</b>; o Claude lê de madrugada e atualiza a Agenda. O resto nunca sai do celular.</p>
      <p class="sub wa-env-sit">${s.faltam ? `${s.faltam} esperando o envio.` : "Tudo enviado."}${s.erro ? ` Último erro: ${escapar(s.erro)}` : ""}</p>
      <button class="botao secundario wa-enviar" type="button">Ler e enviar agora</button>
      <button class="botao secundario wa-limpar" type="button">Apagar o que está guardado neste celular</button>`;
    el.querySelector(".wa-enviar").onclick = async (ev) => {
      ev.target.disabled = true;
      const novos = await W.atualizar(); const n = await W.enviar();
      toast(`${novos} destaque${novos === 1 ? "" : "s"} novo${novos === 1 ? "" : "s"}${n ? ` · ${n} enviado${n > 1 ? "s" : ""}` : ""}.`);
      envio(); historico();
    };
    el.querySelector(".wa-limpar").onclick = async () => {
      const ok = await modal({ titulo: "Apagar do celular?", texto: "As mensagens guardadas e a lista de grupos vistos saem deste celular. O que você já enviou ao Claude fica no repositório.", botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] });
      if (!ok) return;
      await fonte().limpar(); await W.atualizar({ refazer: true });
      toast("Apagado deste celular."); grupos(); historico(); envio();
    };
  };

  await Promise.all([acesso(), grupos(), historico()]);
  envio();
}
