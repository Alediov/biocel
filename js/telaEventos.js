// Telas dos eventos: o sazonal ativo (missões e loja), os acadêmicos
// (seminários e trabalhos, para sempre disponíveis) e o calendário.
import { E, salvar, hojeISO, difDias } from "./estado.js";
import * as EV from "./eventos.js";
import { CARTAS, RARIDADES_CARTA } from "./colecao.js";
import { cartaHTML } from "./telaColecao.js";
import { av } from "./telaAvatar.js";
import { humano } from "./arte/humano.js";
import { ganharBauEvento, darPocao, ganharBau, ganharGemas } from "./economia.js";
import { abrirComAnimacao } from "./bausUI.js";
import { icone } from "./icones.js";
import { tocar } from "./sons.js";
import { modal, toast, confete, escapar, dataBR } from "./ui.js";

const tela = () => document.getElementById("tela");
let aoMudar = () => {}, desenharDiaFn = null;
export function definirTelaEventos({ mudou, desenharDia }) { aoMudar = mudou; desenharDiaFn = desenharDia; }

const faltam = (fim) => { const d = difDias(hojeISO(), fim); return d <= 0 ? "Último dia!" : d === 1 ? "Termina amanhã" : `Faltam ${d + 1} dias`; };

/** Faixa do evento sazonal no topo da trilha. */
export function bannerSazonal(container) {
  const ev = EV.eventoAtivo();
  if (!ev) return;
  const st = EV.estadoEvento(ev);
  const b = document.createElement("button"); b.className = "banner-evento"; b.style.setProperty("--cor-ev", ev.cor);
  b.innerHTML = `${icone(ev.icone, "ico3d ico-grande")}<div><b>${escapar(ev.nome)}</b><small>${faltam(ev.fim)} · ${st.moeda} ${icone(ev.moeda.icone, "ico-inline")} ${ev.moeda.nome.toLowerCase()}</small></div><span class="seta">›</span>`;
  b.onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "eventos" }));
  container.append(b);
}

export async function telaEventos() {
  const t = tela(), ev = EV.eventoAtivo();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Trilha";
  v.onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "trilha" }));
  t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela" style="margin-top:4px">Eventos</h1>`);
  if (ev) desenharSazonal(t, ev);

  // ---- acadêmicos ----
  const acad = await EV.eventosAcademicos();
  const sec = document.createElement("div"); sec.className = "secao";
  sec.innerHTML = `<h2>Seminários e trabalhos</h2>`;
  if (!acad.length) sec.insertAdjacentHTML("beforeend", `<div class="cartao"><p class="sub" style="margin:0">Mande o material do seu próximo seminário ou trabalho no chat com o Claude. Ele monta uma trilha só para ele, que aparece aqui e no topo da trilha.</p></div>`);
  for (const a of acad) {
    const p = EV.progressoAcademico(a), hoje = hojeISO();
    const c = document.createElement("div"); c.className = "cartao evento-ac";
    c.innerHTML = `<div class="ev-topo">${icone(a.icone || "🎤", "ico3d ico-grande")}<div><b>${escapar(a.nome)}</b><small>${escapar(EV.quandoEvento(a))}</small></div></div>
      <div class="nivel-barra"><div style="width:${p.total ? p.feitas / p.total * 100 : 0}%"></div></div><small class="sub">${p.feitas} de ${p.total} lições${a.disciplina ? ` · ${escapar(a.disciplina)}` : ""}</small>`;
    const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = p.feitas === p.total && p.total ? "Revisar" : p.feitas ? "Continuar" : "Estudar";
    bt.onclick = () => telaEventoAcademico(a);
    c.append(bt);
    const ck = E().eventosAc?.[a.id]?.checkin;
    if (a.data && a.data <= hoje && !ck) {
      const box = document.createElement("div"); box.className = "checkin-ev";
      box.innerHTML = `<small>Como foi a apresentação?</small>`;
      for (const [k, txt] of [["otima", "Mandei bem"], ["ok", "Foi ok"], ["dificil", "Foi difícil"]]) {
        const b = document.createElement("button"); b.className = "dia-chip largo"; b.textContent = txt;
        b.onclick = async () => {
          const xp = EV.checkinAcademico(a, k);
          if (xp == null) return;
          tocar("fim"); confete();
          await modal({ titulo: k === "dificil" ? "Faz parte, e você apresentou!" : "Parabéns pela apresentação!", texto: `+${xp} XP e +20 moedas. A trilha deste evento continua aqui para revisar quando quiser.`, botoes: [{ texto: "Valeu!", valor: true }] });
          aoMudar(); telaEventos();
        };
        box.append(b);
      }
      c.append(box);
    } else if (ck) c.insertAdjacentHTML("beforeend", `<small class="sub">Apresentação registrada: ${{ otima: "mandou bem", ok: "foi ok", dificil: "foi difícil" }[ck]}.</small>`);
    sec.append(c);
  }
  t.append(sec);

  // ---- calendário ----
  const cal = document.createElement("div"); cal.className = "secao";
  cal.innerHTML = `<h2>Calendário de eventos</h2><p class="sub">Todo ano, nas mesmas datas, com chapéu e carta exclusivos.</p>`;
  const lista = document.createElement("div"); lista.className = "cartao";
  for (const s of EV.proximosSazonais()) {
    const c = CARTAS[s.carta], tem = !!E().colecao?.cartas?.[s.carta];
    lista.insertAdjacentHTML("beforeend", `<div class="linha-cal">${icone(s.icone, "ico3d ico-medio")}<div class="txt"><b>${escapar(s.nome)}</b><small>${dataBR(s.ini)} a ${dataBR(s.fim)} · carta ${escapar(c.nome)} (${RARIDADES_CARTA[c.raridade].nome.toLowerCase()})${tem ? " ✓" : ""}</small></div>${ev?.id === s.id ? `<span class="selo-agora">agora</span>` : ""}</div>`);
  }
  cal.append(lista); t.append(cal);
}

function desenharSazonal(t, ev) {
  const st = EV.estadoEvento(ev), c = CARTAS[ev.carta];
  const box = document.createElement("div"); box.className = "evento-sazonal"; box.style.setProperty("--cor-ev", ev.cor);
  box.innerHTML = `<div class="ev-cab">${icone(ev.icone, "ico3d ico-ev")}<div><h2>${escapar(ev.nome)}</h2><small>${dataBR(ev.ini)} a ${dataBR(ev.fim)} · ${faltam(ev.fim)}</small></div></div>
    <div class="ev-saldo">${icone(ev.moeda.icone, "ico3d ico-medio")}<b>${st.moeda}</b><span>${escapar(ev.moeda.nome)}</span></div>
    <p class="sub" style="color:inherit;opacity:.9;margin:6px 0 0">Ganhe ${ev.moeda.nome.toLowerCase()} nas lições (+10, +5 se perfeita), nos minijogos e nas missões. Seu companheiro usa o chapéu do evento enquanto ele durar.</p>`;
  t.append(box);

  // missões
  const sm = document.createElement("div"); sm.className = "secao"; sm.innerHTML = `<h2>Missões</h2>`;
  const lm = document.createElement("div"); lm.className = "cartao";
  for (const m of EV.MISSOES) {
    const p = EV.progressoMissao(m, st), ok = p >= m.meta, pega = st.resgatadas.includes(m.id);
    const l = document.createElement("div"); l.className = "linha-titulo";
    l.innerHTML = `${icone(pega ? "✅" : "🎯", "ico3d ico-medio")}<div class="txt"><b>${m.texto}</b><div class="nivel-barra"><div style="width:${p / m.meta * 100}%"></div></div><small>${p}/${m.meta} · prêmio ${m.premio} ${ev.moeda.nome.toLowerCase()}</small></div>`;
    if (ok && !pega) {
      const b = document.createElement("button"); b.className = "botao"; b.textContent = "Resgatar";
      b.onclick = () => { const n = EV.resgatarMissao(m.id); if (n) { tocar("moeda"); toast(`+${n} ${ev.moeda.nome.toLowerCase()}!`); aoMudar(); telaEventos(); } };
      l.append(b);
    }
    lm.append(l);
  }
  sm.append(lm); t.append(sm);

  // loja
  const sl = document.createElement("div"); sl.className = "secao"; sl.innerHTML = `<h2>Loja do evento</h2>`;
  const g = document.createElement("div"); g.className = "grade-loja";
  const a = av(), chave = `chapeu:${ev.chapeu}`, temChapeu = a.comprados.includes(chave);
  const itens = [
    { item: EV.LOJA_EVENTO[0], arte: `<div class="avatar-medio" style="margin:0 auto">${humano({ ...a.cfg, chapeu: ev.chapeu })}</div>`, estado: temChapeu ? (a.cfg.chapeu === ev.chapeu ? "Usando" : "Usar") : null,
      acao: async () => {
        if (temChapeu) { a.cfg.chapeu = ev.chapeu; salvar(); tocar("toque"); return true; }
        if (!EV.gastarMoedaEvento(150)) return false;
        a.comprados.push(chave); a.cfg.chapeu = ev.chapeu; salvar(); tocar("combo"); confete(); return true;
      } },
    { item: EV.LOJA_EVENTO[1], arte: `<div class="item-carta" style="margin:0 auto;width:96px">${cartaHTML(ev.carta, { mini: true })}</div>`,
      acao: async () => {
        if (!E().baus.slots.some(s => !s)) { toast("Libere um slot de baú na trilha primeiro."); return null; }
        if (!EV.gastarMoedaEvento(120)) return false;
        const r = ganharBauEvento(ev.carta, c.raridade === "lendaria" ? 1 : 2, ev.nome);
        abrirComAnimacao(r.slot, () => { aoMudar(); telaEventos(); });
        return "aberto";
      } },
    { item: EV.LOJA_EVENTO[2], arte: `<div class="item-ico">${icone("⚗️", "ico3d ico-loja")}</div>`,
      acao: async () => { if (!EV.gastarMoedaEvento(60)) return false; darPocao("x2_15"); tocar("moeda"); toast("Poção ×2 na mochila!"); return true; } },
  ];
  for (const it of itens) {
    const d = document.createElement("div"); d.className = "item-loja";
    d.innerHTML = `${it.arte}<h3>${escapar(it.item.nome)}</h3><p>${it.estado === "Usando" ? "Usando" : it.estado ? "Já é seu" : `${it.item.preco} ${escapar(ev.moeda.nome.toLowerCase())}`}</p>`;
    const b = document.createElement("button"); b.className = `botao ${it.estado === "Usando" ? "secundario" : ""}`;
    b.textContent = it.estado || "Comprar"; b.disabled = it.estado === "Usando" || (!it.estado && st.moeda < it.item.preco);
    b.onclick = async () => {
      const r = await it.acao();
      if (r === false) toast(`Faltam ${ev.moeda.nome.toLowerCase()}.`);
      else if (r === true) { aoMudar(); telaEventos(); }
    };
    d.append(b); g.append(d);
  }
  sl.append(g); t.append(sl);
  t.insertAdjacentHTML("beforeend", `<p class="sub" style="text-align:center">A carta ${escapar(c.nome)} só sai do baú deste evento. Ele volta todo ano nas mesmas datas.</p>`);
}

export async function telaEventoAcademico(ev) {
  const t = tela();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Eventos";
  v.onclick = () => telaEventos();
  t.append(v);
  if (ev.descricao) t.insertAdjacentHTML("beforeend", `<div class="aviso-dia">${icone(ev.icone || "🎤", "ico3d ico-medio")}<div>${escapar(ev.descricao)}</div></div>`);
  desenharDiaFn(t, EV.diaDoEvento(ev), false, { evento: ev, subtitulo: EV.quandoEvento(ev), refazer: () => telaEventoAcademico(ev) });
}

/** Mostra a abertura do evento (uma vez por ano) e o presente de aniversário. */
export async function anunciarEvento() {
  const ev = EV.eventoAtivo();
  if (!ev) return;
  const st = EV.estadoEvento(ev);
  if (ev.presente && !st.presente) {
    st.presente = true;
    const r = ganharBau("lendario", "aniversário", { id: `aniv-${ev.id || "evento"}-${new Date().getFullYear()}` }); ganharGemas(20); salvar();
    tocar("ofensiva"); confete(3000);
    const nome = av().nome ? `, ${av().nome}` : "";
    await modal({ titulo: `Feliz aniversário${nome}!`, html: `<div style="width:120px;margin:0 auto">${icone("🎂", "ico3d ico-item")}</div>`, texto: `Presente: um baú lendário${r.cheio ? " (virou moedas, os slots estavam cheios)" : " nos seus slots"} e 20 gemas. E até 08/11 tem a loja do aniversário, com a carta lendária Festeira.`, botoes: [{ texto: "Obrigado!", valor: true }] });
    aoMudar();
  }
  if (!st.visto) {
    st.visto = true; salvar();
    const v = await modal({ titulo: `Começou: ${ev.nome}!`, html: `<div style="width:110px;margin:0 auto">${icone(ev.icone, "ico3d ico-item")}</div>`, texto: `Até ${dataBR(ev.fim)}: ganhe ${ev.moeda.nome.toLowerCase()} estudando, cumpra as missões e troque na loja do evento por um chapéu e pela carta exclusiva ${CARTAS[ev.carta].nome}.`, botoes: [{ texto: "Ver o evento", valor: "ver" }, { texto: "Depois", classe: "secundario", valor: null }] });
    if (v === "ver") window.dispatchEvent(new CustomEvent("oq-ir", { detail: "eventos" }));
  }
}
