// Destaques (pedido do Alediov, 04/11/2026, 20h53: "um modo de visualização de todas as mensagens destacadas e dizer
// quais enviar para você… daí você atualiza a agenda"): a conversa fixa logo abaixo da Eva em Mensagens, com TODOS os
// destaques da triagem (grupos Sempre + o que passou na triagem), de todos os grupos, do mais novo para o mais velho, com
// o dia, o grupo (leva à conversa dele), quem mandou, a hora, o texto e o motivo. Em cada um: "Enviar ao Claude" ou
// "Não" (Desfazer volta atrás), a nota curta "o que mudou?" e "Anexar arquivo ou foto" (a notificação não traz o anexo).
// Filtros: Para decidir (padrão), Enviadas, Não, Todas. No alto, as perguntas da tarefa da madrugada sobre a Agenda
// (agendaAvisos/), com as opções ou uma resposta escrita. Só o que ele marca sobe (whatsapp.js `enviar`), de madrugada
// o Claude lê (gerador/WHATSAPP.md) e o que mudou aparece no alto da Agenda.
import * as W from "./whatsapp.js";
import * as D from "./destaques.js";
import * as R from "./regras.js";
import * as AV from "../agendaAvisos/agendaAvisos.js";
import { motivoTxt } from "./telaWhats.js";
import { modal, toast } from "../ui.js";
import { temToken } from "../dados.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dois = (n) => String(n).padStart(2, "0");
const hm = (ms) => { const d = new Date(ms); return `${dois(d.getHours())}:${dois(d.getMinutes())}`; };
const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function rotuloDia(ms) {
  const d = new Date(ms), hoje = new Date(), ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
const tamTxt = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const IC_DESTAQUES = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.4l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>`;
const IC = {
  voltar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  clipe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>`,
  enviar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg>`,
};
const ESTADO = { enviar: ["ds-e-espera", "Vai ao Claude no próximo envio"], enviada: ["ds-e-ok", "Enviada ao Claude"], nao: ["ds-e-nao", "Não vai"], "nao-cancelando": ["ds-e-nao", "Não vai (o Claude será avisado)"], "decidir-cancelando": ["ds-e-nao", "Desfeita (o Claude será avisado)"] };
const LIDA = { aplicada: "o Claude atualizou a Agenda", nada: "o Claude leu: nada a mudar", pergunta: "o Claude tem uma pergunta", cancelada: "o Claude viu que você desfez" };

/** Monta a vista dentro de `el` (eva-vista). o: { voltar(), irGrupo(chave), foco: id }. Devolve { focar(id) }. */
export async function telaDestaques(el, o = {}) {
  el.classList.add("eva-raiz", "msg-vista-destaques");
  el.innerHTML = `<header class="eva-topo msg-topo">
      <button class="eva-ic eva-voltar msg-voltar" type="button" aria-label="Voltar para as conversas">${IC.voltar}</button>
      <span class="msg-av msg-av-ds msg-av-topo" aria-hidden="true">${IC_DESTAQUES}</span>
      <div class="msg-titulo"><b>Destaques</b><small class="ds-sub"></small></div>
    </header>
    <div class="ds-filtros" role="tablist" aria-label="Filtrar os destaques"></div>
    <main class="ds-lista" aria-label="Destaques dos grupos"></main>
    <footer class="ds-rodape"></footer>`;
  const $ = (s) => el.querySelector(s), lista = $(".ds-lista");
  $(".msg-voltar").onclick = () => o.voltar?.();
  let filtro = "decidir", foco = o.foco || "", pendente = false;
  // os que ele marcou "Enviar ao Claude" nesta visita ficam na lista (abertos para a nota e o anexo) até trocar de filtro
  const fixos = new Set();
  const digitando = () => el.contains(document.activeElement) && document.activeElement.matches?.(".ds-nota, .ds-resp-tx");

  const desenhar = ({ manter = true } = {}) => {
    if (!el.isConnected) return;
    if (digitando()) { pendente = true; return; } // não redesenha embaixo do dedo: espera sair do campo
    pendente = false;
    const topo = lista.scrollTop, c = W.contagens(), perg = AV.perguntasParaMostrar();
    if (foco) { const r = W.decisao(foco); if (D.filtroDe(r) !== filtro && filtro !== "todas") filtro = W.avisos().some(a => a.id === foco) ? D.filtroDe(r) : filtro; }
    $(".ds-sub").textContent = c.decidir ? `${c.decidir} para decidir · o Claude lê de madrugada` : "Nada para decidir · o Claude lê de madrugada";
    $(".ds-filtros").innerHTML = Object.entries(D.FILTROS).map(([k, n]) => `<button type="button" role="tab" data-f="${k}" class="ds-f${k === filtro ? " on" : ""}" aria-selected="${k === filtro}">${n}<small>${c[k]}</small></button>`).join("");
    $(".ds-filtros").querySelectorAll("[data-f]").forEach(b => (b.onclick = () => { filtro = b.dataset.f; foco = ""; fixos.clear(); desenhar({ manter: false }); }));
    const ds = filtro === "todas" ? W.destaques("todas") : W.destaques("todas").filter(a => fixos.has(a.id) || D.filtroDe(W.decisao(a.id)) === filtro);
    let h = "";
    if (perg.length && (filtro === "decidir" || filtro === "todas")) h += perg.map(htmlPergunta).join("");
    const nd = ds.filter(a => D.paraDecidir(W.decisao(a.id))).length;
    if (filtro === "decidir" && nd > 1) h += `<div class="ds-todas"><button type="button" class="ds-bt ds-nao-todas">Não para as ${nd}</button></div>`;
    let dia = "";
    for (const a of ds) {
      const d = rotuloDia(a.quando);
      if (d !== dia) { dia = d; h += `<div class="eva-dia"><span>${esc(d)}</span></div>`; }
      h += htmlItem(a);
    }
    if (!ds.length) h += `<p class="ds-vazio">${filtro === "decidir" ? (c.todas ? "Tudo decidido. Os destaques novos aparecem aqui." : "Nenhum destaque ainda. Aparecem aqui as mensagens dos grupos <b>Sempre</b> e as que passam na <b>Triagem</b>.") : "Nada aqui."}</p>`;
    lista.innerHTML = h;
    ligar();
    rodape();
    if (foco) {
      const it = lista.querySelector(`.ds-it[data-id="${CSS.escape(foco)}"]`);
      if (it) { it.scrollIntoView({ block: "center" }); it.classList.add("ds-foco"); }
      foco = "";
    } else if (manter) lista.scrollTop = topo;
    else lista.scrollTop = 0;
  };

  function htmlItem(a) {
    const r = W.decisao(a.id), st = D.situacao(r), [cls, rot] = ESTADO[st] || ["", ""], decidida = !D.paraDecidir(r);
    const lida = AV.lida(a.id), nAn = r?.anexos?.length || 0, abrir = r?.d === "enviar" || r?.nota || nAn;
    return `<article class="ds-it${decidida ? ` ds-${r.d}` : ""}" data-id="${esc(a.id)}">
      <div class="ds-cab"><button type="button" class="ds-grupo" data-g="${esc(R.normalizar(a.grupo))}">${esc(R.limparTitulo(a.grupo))}<span aria-hidden="true">›</span></button><time>${hm(a.quando)}</time></div>
      <div class="ds-de">${esc(a.de)}</div>
      <p class="ds-texto">${esc(a.texto)}</p>
      <div class="ds-meta"><span class="msg-motivo" title="Por que destacou">${esc(motivoTxt(a.motivo))}</span>${rot ? `<span class="ds-e ${cls}">${esc(rot)}</span>` : ""}</div>
      ${lida ? `<p class="ds-lida">${esc(LIDA[lida.resultado] || "o Claude leu")}${lida.obs ? `: ${esc(lida.obs)}` : ""}</p>` : ""}
      <div class="ds-acoes">${decidida
        ? `<button type="button" class="ds-bt ds-desfazer">Desfazer</button>${r.d === "nao" ? `<button type="button" class="ds-bt ds-enviar ds-mudar">${IC.enviar}Enviar ao Claude</button>` : ""}`
        : `<button type="button" class="ds-bt ds-enviar">${IC.enviar}Enviar ao Claude</button><button type="button" class="ds-bt ds-nao">Não</button>`}
        ${abrir ? "" : `<button type="button" class="ds-bt ds-mais" aria-expanded="false">Nota ou anexo</button>`}</div>
      <div class="ds-extra"${abrir ? "" : " hidden"}>
        <input class="ds-nota" type="text" maxlength="${D.MAX_NOTA}" placeholder="O que mudou? (opcional)" aria-label="O que mudou? (nota para o Claude)" value="${esc(r?.nota || "")}" enterkeyhint="done" autocomplete="off">
        <div class="ds-anexos">${(r?.anexos || []).map(an => `<span class="ds-an${an.sub ? " ds-an-ok" : ""}" data-n="${an.n}"><span class="ds-an-nome">${an.tipo === "application/pdf" ? "📄" : "🖼️"} ${esc(an.nome)}</span><small>${tamTxt(an.tam || 0)}${an.sub ? " · enviado" : ""}</small>${an.sub ? "" : `<button type="button" class="ds-an-x" aria-label="Tirar ${esc(an.nome)}">${IC.x}</button>`}</span>`).join("")}
          ${nAn < D.MAX_ANEXOS ? `<button type="button" class="ds-bt ds-anexar">${IC.clipe}Anexar arquivo ou foto</button>` : ""}</div>
      </div>
    </article>`;
  }
  function htmlPergunta(p) {
    const resp = AV.respostaDe(p.id), orig = (p.de || []).map(id => W.avisos().find(a => a.id === id)).filter(Boolean);
    return `<article class="ds-perg" data-p="${esc(p.id)}"><div class="ds-perg-cab">Pergunta do Claude sobre a Agenda</div>
      <p class="ds-perg-tx">${esc(p.texto)}</p>
      ${orig.length ? `<p class="ds-perg-de">Sobre: ${orig.map(a => `<b>${esc(R.limparTitulo(a.grupo))}</b> “${esc(a.texto.slice(0, 120))}${a.texto.length > 120 ? "…" : ""}”`).join(" · ")}</p>` : ""}
      ${resp ? `<p class="ds-perg-r">Sua resposta: <b>${esc(resp.r)}</b> <small>${resp.env ? "enviada" : "vai no próximo envio"}</small></p>${resp.env ? "" : `<button type="button" class="ds-bt ds-resp-desfazer">Mudar a resposta</button>`}`
        : `<div class="ds-perg-op">${(p.opcoes || []).map(op => `<button type="button" class="ds-bt ds-op">${esc(op)}</button>`).join("")}</div>
           <div class="ds-perg-livre"><input class="ds-resp-tx" type="text" maxlength="400" placeholder="Ou escreva a resposta" aria-label="Resposta" enterkeyhint="send" autocomplete="off"><button type="button" class="ds-bt ds-enviar ds-resp-ok">Responder</button></div>`}
    </article>`;
  }

  function ligar() {
    lista.querySelectorAll(".ds-it").forEach(it => {
      const id = it.dataset.id, q = (s) => it.querySelector(s);
      q(".ds-grupo").onclick = () => o.irGrupo?.(q(".ds-grupo").dataset.g);
      q(".ds-texto").onclick = () => q(".ds-texto").classList.toggle("aberto");
      const sair = (fn) => { if (filtro === "todas" || matchMedia("(prefers-reduced-motion: reduce)").matches) return fn(); it.classList.add("ds-saindo"); setTimeout(fn, 180); };
      q(".ds-enviar")?.addEventListener("click", () => { fixos.add(id); W.decidir(id, "enviar"); if (!temToken()) toast("Falta o token do GitHub (Ajustes do Órbita) para enviar."); });
      q(".ds-nao")?.addEventListener("click", () => sair(() => { fixos.delete(id); W.decidir(id, "nao"); }));
      q(".ds-desfazer")?.addEventListener("click", () => {
        const r = W.decisao(id);
        W.decidir(id, null);
        if (r?.env && AV.lida(id)) toast("Desfeito. O Claude já leu esta: se a Agenda mudou, use Desfazer em “O que mudou”, na Agenda.", 4200);
      });
      q(".ds-mais")?.addEventListener("click", (ev) => { q(".ds-extra").hidden = false; ev.currentTarget.remove(); q(".ds-nota").focus(); });
      const nota = q(".ds-nota");
      let tNota = null;
      const gravarNota = () => { clearTimeout(tNota); if ((W.decisao(id)?.nota || "") !== nota.value.trim()) W.definirNota(id, nota.value); };
      nota.addEventListener("input", () => { clearTimeout(tNota); tNota = setTimeout(gravarNota, 900); });
      nota.addEventListener("keydown", (ev) => { if (ev.key === "Enter") nota.blur(); });
      nota.addEventListener("blur", () => { gravarNota(); if (pendente) setTimeout(desenhar, 0); });
      q(".ds-anexar")?.addEventListener("click", () => escolherAnexo(id));
      it.querySelectorAll(".ds-an-x").forEach(b => (b.onclick = () => W.tirarAnexo(id, Number(b.closest(".ds-an").dataset.n))));
    });
    lista.querySelectorAll(".ds-perg").forEach(pe => {
      const id = pe.dataset.p;
      pe.querySelectorAll(".ds-op").forEach(b => (b.onclick = () => { AV.responder(id, b.textContent); W.agendarEnvio(); }));
      const tx = pe.querySelector(".ds-resp-tx");
      const ok = () => { if (!tx.value.trim()) return tx.focus(); const v = tx.value; tx.blur(); AV.responder(id, v); W.agendarEnvio(); };
      pe.querySelector(".ds-resp-ok")?.addEventListener("click", ok);
      tx?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ok(); });
      tx?.addEventListener("blur", () => { if (pendente) setTimeout(desenhar, 0); });
      pe.querySelector(".ds-resp-desfazer")?.addEventListener("click", () => AV.desfazerResposta(id));
    });
    lista.querySelector(".ds-nao-todas")?.addEventListener("click", async () => {
      const ids = W.destaques("decidir").map(a => a.id);
      const ok = await modal({ titulo: `Não para as ${ids.length}?`, texto: "Nenhuma delas vai ao Claude. Dá para mudar depois, no filtro Não.", botoes: [{ texto: "Não para todas", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] });
      if (ok) W.decidir(ids, "nao");
    });
  }
  function escolherAnexo(id) {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*,application/pdf"; inp.multiple = true;
    inp.onchange = async () => {
      for (const f of inp.files) {
        const r = await W.anexar(id, f);
        if (r.erro) { toast(`${f.name}: ${r.erro}`, 4200); break; }
      }
    };
    inp.click();
  }
  function rodape() {
    const s = W.situacaoEnvio(), f = $(".ds-rodape");
    f.innerHTML = s.faltam
      ? `<span class="ds-r-tx">${s.faltam} esperando o envio${s.erro ? ` · último erro: ${esc(s.erro)}` : ""}</span><button type="button" class="ds-bt ds-enviar ds-enviar-agora"${s.enviando ? " disabled" : ""}>${s.enviando ? "Enviando…" : "Enviar agora"}</button>`
      : `<span class="ds-r-tx">${s.erro ? `Último erro: ${esc(s.erro)}` : "Só o que você marca vai ao repositório privado. O Claude lê de madrugada e atualiza a Agenda."}</span>`;
    f.querySelector(".ds-enviar-agora")?.addEventListener("click", async (ev) => {
      if (!temToken()) { toast("Configure o token em Ajustes do Órbita (engrenagem da Home) para enviar."); return; }
      if (!navigator.onLine) { toast("Sem internet agora: vai sozinho quando conectar."); return; }
      ev.currentTarget.disabled = true; ev.currentTarget.textContent = "Enviando…";
      const n = await W.enviar();
      toast(W.situacaoEnvio().erro ? `Não deu para enviar: ${W.situacaoEnvio().erro}` : n ? `${n} enviado${n > 1 ? "s" : ""}. O Claude lê de madrugada.` : "Nada novo para enviar.", 3500);
      rodape();
    });
  }

  el._redesenhar = () => desenhar({ manter: true });
  const aoAv = () => desenhar({ manter: true });
  window.addEventListener("oq-agenda-avisos", aoAv);
  el._sair = () => window.removeEventListener("oq-agenda-avisos", aoAv);
  await W.atualizar().catch(() => 0);
  desenhar({ manter: false });
  return { focar(id) { foco = id; desenhar(); } };
}
