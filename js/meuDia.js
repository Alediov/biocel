// "Meu dia" (pedido do Alediov, 25/10/2026): o que falta hoje em todas as áreas, num lugar só. Desde 26/10/2026 aparece
// na Home do Órbita (home.js: o botão do topo dos Estudos e "Trocar de Área" nas outras áreas abrem a Home), com um
// toque para ir a cada coisa. Só lê o estado de cada área; não muda nada.
import { E, salvar, hojeISO, somaDias, metaDoDia, metaLeituraDe } from "./estado.js";
import { carregarDia, extra, listarExtras } from "./dados.js";
import { comLicoesDeJogo } from "./jogos.js";
import { abaDaSessao } from "./economia.js";
import { regouHoje } from "./jardim.js";
import { eventosDoDia, eventosOnlineDoDia } from "./agenda.js";
import { R, tocaAqui, proximoAlarme, horaCurta } from "./alarmes.js";
import { escapar, modal, toast } from "./ui.js";
import { icone as ico3d } from "./icones.js";
import { atualizarWidgetMeuDia } from "./widget.js";
import * as FC from "./financas/contas.js";
import { diaPresencial as fiPresencial } from "./financas/ponte.js";
import { planejarDias, planoDe, dividir, escolher, minutosTexto, TAMANHOS, ativo as tamanhoAtivo } from "./tamanhoDia.js";

const ABAS = { aulas: "Aulas", extensao: "Extensão", provas: "Provas" };
const hm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

const PRATICAS = { laminas: ["Treino de Lâminas (prova prática)", "🔬"], pratica: ["Prova Prática de Anestesio", "🧑‍⚕️"] };
/** Os itens do dia: { id, icone, titulo, detalhe, feito (bool | null = informativo), ir: {area, aba?, tela?} }. */
export async function itensDoDia() {
  const e = E(), hoje = hojeISO(), itens = [];
  const feito = (id) => !!e.concluidas[id];
  try { planejarDias(); } catch (err) { console.warn("Meu dia: tamanho do dia", err); }
  // lições por aba da trilha, na ordem das sessões. Com o tamanho do dia (tamanhoDia.js), cada uma tem prioridade e
  // custo: a aba Provas e o Treino de Lâminas (prova prática) sempre; as aulas; os jogos; a Extensão por último.
  // ~5 min por lição e ~4 min por lição-jogo
  const dia = comLicoesDeJogo(await carregarDia(hoje).catch(() => null));
  if (dia?.sessoes?.length) {
    const porAba = {};
    for (const s of dia.sessoes) {
      const a = abaDaSessao(s);
      for (const l of s.licoes) {
        // os jogos das provas práticas (Treino de Lâminas, Prova Prática de Anestesio) têm item e prioridade próprios
        const g = l.jogo ? (PRATICAS[l.jogo] ? l.jogo : "jogos") : a;
        (porAba[g] ||= { aba: a, ls: [] }).ls.push(l);
      }
    }
    const PRIO = { provas: 1, laminas: 1, pratica: 1, aulas: 2, jogos: 5, extensao: 7 };
    for (const [g, { aba, ls }] of Object.entries(porAba)) {
      const ids = ls.map(l => l.id), f = ids.filter(feito).length;
      const titulo = g === "jogos" ? "Lições-jogo" : PRATICAS[g] ? PRATICAS[g][0] : `Lições · ${ABAS[g] || g}`;
      itens.push({ id: `licoes-${g}`, icone: g === "jogos" ? "🎮" : PRATICAS[g] ? PRATICAS[g][1] : "📚", titulo, tituloMais: g === "jogos" ? "Lições-jogo" : `Mais lições · ${ABAS[g] || g}`, detalhe: `${f} de ${ids.length}`, feito: f >= ids.length, conta: [f, ids.length], ir: { area: "learn", tela: "trilha", aba },
        prio: PRIO[g] ?? 3, partes: ls.map(l => ({ custo: l.jogo ? 4 : 5, feito: feito(l.id) })) });
    }
  } else itens.push({ id: "licoes", icone: "📚", titulo: "Lições", detalhe: "as de hoje ainda não chegaram: sincronize", feito: false, ir: { area: "learn", tela: "trilha" } });
  const meta = metaDoDia(hoje), feitasHoje = e.diario[hoje]?.licoes?.length || 0;
  // com a meta automática, as lições do dia já dizem o que falta: o item da meta só aparece com a meta fixa
  if (e.config.metaAuto === false || !tamanhoAtivo(hoje)) itens.push({ id: "meta", icone: "🎯", titulo: "Meta de lições", detalhe: `${Math.min(feitasHoje, meta)} de ${meta}`, feito: feitasHoje >= meta, ir: { area: "learn", tela: "trilha" } });
  // Caderno do Dia (antes "simulado impresso"; 09/11/2026): resumo, prática e prova; os antigos continuam "Simulado"
  const sim = await extra(`sim:${hoje}`).catch(() => null), env = e.simulados?.enviados?.[hoje];
  const cad = sim?.tipo === "caderno";
  if (sim) itens.push({ id: "simulado", icone: "📝", titulo: cad ? "Caderno do Dia" : "Simulado impresso", detalhe: env ? `${env.fotos} foto${env.fotos > 1 ? "s" : ""} enviada${env.fotos > 1 ? "s" : ""}` : `${cad && sim.resumo?.length ? "resumo + " : ""}${sim.questoes.length} questões · ${sim.tempo || 30} min`, feito: !!env, ir: { area: "learn", tela: "trilha", aba: "aulas", rolar: ".sim-cartao" }, prio: 3, custo: sim.tempo || 30 });
  // simulados especiais de prova (véspera e 2 dias antes; simulado.js), chave AAAA-MM-DD-esp-<sigla>
  for (const se of await listarExtras(`sim:${hoje}-esp-`).catch(() => [])) {
    if (!se?.questoes?.length) continue;
    const envE = e.simulados?.enviados?.[se.chave];
    itens.push({ id: `simulado-${se.chave}`, icone: "📝", titulo: `Simulado especial · ${se.prova?.nome || "prova"}`, detalhe: envE ? `${envE.fotos} foto${envE.fotos > 1 ? "s" : ""} enviada${envE.fotos > 1 ? "s" : ""}` : `${se.questoes.length} questões · ${se.tempo || 60} min`, feito: !!envE, ir: { area: "learn", tela: "trilha", aba: "aulas", rolar: ".sim-especial" }, prio: 0, custo: se.tempo || 60 });
  }
  for (let i = 1; i <= 7; i++) {
    const d = somaDias(hoje, -i), c = await extra(`cor:${d}`).catch(() => null);
    if (c && !e.simulados?.vistos?.[d]) { itens.push({ id: "correcao", icone: "✅", titulo: `Correção do ${(await extra(`sim:${d}`).catch(() => null))?.tipo === "caderno" ? "caderno" : "simulado"} de ${new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`, detalhe: `nota ${String(c.nota).replace(".", ",")}: ver os comentários`, feito: false, ir: { area: "learn", tela: "trilha", aba: "aulas", rolar: ".sim-cartao" }, prio: 3, custo: 5 }); break; }
  }
  // leitura: as unidades do dia nos livros que já estão na Leitura
  // (a meta da Leitura é de unidades por dia, padrão 2: vale qualquer unidade dos didáticos lida hoje)
  const unid = (dia?.unidades || []).filter(id => /^[cf]\d\d-\d\d$/.test(id));
  if (unid.length) {
    const meta = metaLeituraDe(hoje);
    const lidasHoje = Object.entries(e.leitura?.lidas || {}).filter(([id, d]) => d === hoje && /^[a-z]\d\d-\d\d$/.test(id)).length;
    itens.push({ id: "leitura", icone: "📖", titulo: "Leitura do dia", detalhe: `${Math.min(lidasHoje, meta)} de ${meta} unidade${meta > 1 ? "s" : ""} do livro`, feito: lidasHoje >= meta, conta: [Math.min(lidasHoje, meta), meta], ir: { area: "leitura" }, prio: 4, custo: meta * 10 });
  }
  // xadrez: a trilha de hoje (aberturas, revisões e, conforme o dia, aula, problemas, erros ou partida)
  const xz = e.xadrez, planoX = xz?.planoDia?.dia === hoje ? xz.planoDia : null;
  const feitoX = !!xz?.treinoFeito?.[hoje];
  itens.push({ id: "xadrez", icone: "♟️", titulo: "Trilha de xadrez", detalhe: feitoX ? "feita" : planoX ? `${planoX.itens.filter(i => i.feito).length} de ${planoX.itens.length} passos` : "a trilha de hoje", feito: feitoX, conta: planoX ? [planoX.itens.filter(i => i.feito).length, planoX.itens.length] : null, ir: { area: "xadrez" }, prio: 6, custo: planoX?.min || 15 });
  // jardim
  itens.push({ id: "jardim", icone: "🌱", titulo: "Regar o jardim", detalhe: regouHoje() ? "regado" : "quiz de 5 questões", feito: regouHoje(), ir: { area: "learn", tela: "jardim" }, prio: 8, custo: 3 });
  // Scanner: as metas do dia (o resumo que o Scanner manda ao widget)
  const sr = e.config.scanPausado ? null : e.config.scanResumo;
  if (sr?.dia === hoje && (sr.metaRev || sr.metaNum)) {
    const ok = (sr.feitasRev || 0) >= (sr.metaRev || 0) && (sr.feitasNum || 0) >= (sr.metaNum || 0);
    itens.push({ id: "scanner", icone: "🔬", titulo: "Metas da Iniciação Científica", detalhe: `revisar ${sr.feitasRev || 0}/${sr.metaRev || 0} · números ${sr.feitasNum || 0}/${sr.metaNum || 0}`, feito: ok, ir: { area: "scan" } });
  }
  // Scanner: o computador do laboratório parou por um problema ou sumiu (areas.js leitorDoScanner)
  const sp = e.config.scanProblema;
  if (sp?.titulo && !e.config.scanPausado) itens.push({ id: "scanner-pc", icone: "🖥️", titulo: sp.titulo, detalhe: sp.texto || "", feito: false, ir: { area: "scan" } });
  // o token do GitHub vencendo (ajustes.js, conferido pelo cabeçalho da API no Android)
  try { const av = (await import("./ajustes.js")).avisoValidade(); if (av) itens.push({ id: "token", icone: "🔑", titulo: av.titulo, detalhe: av.texto, feito: false, ir: { acao: "ajustes" } }); } catch (err) { console.warn("Meu dia: token", err); }
  // músicas: artistas para conferir
  const venc = (e.config.musicasVencem || []).filter(v => Number.isFinite(v) && v <= Date.now()).length;
  if (venc) itens.push({ id: "musicas", icone: "🎵", titulo: "Artistas para conferir", detalhe: `${venc} artista${venc > 1 ? "s" : ""}`, feito: false, ir: { area: "musicas" }, prio: 9, custo: 999 });
  // Finanças: só quando há o que conferir (entrada fixa cujo dia chegou e não foi marcada, ou uma macro de check-in que
  // não terminou hoje); fora disso, nada (para não poluir o dia)
  try {
    if (e.financas) {
      const f = FC.garantir(e), r = FC.resumoMes(f, FC.mesDe(hoje), hoje);
      // o dinheiro parado fora do Render (03/11/2026: R$ 1.226 ficaram na 99 por duas noites): um item próprio, essencial
      for (const p of FC.dinheiroParado(f)) {
        const t = FC.textoParado(p);
        itens.push({ id: `dinheiro-parado-${p.banco}`, icone: "💸", titulo: t.titulo, detalhe: p.lugar === "arq" ? "o ARQ → Render não guardou · toque para ver" : "a volta do Ping-Pong não trouxe · toque para ver", feito: false, ir: { area: "financas" } });
      }
      // as macros dos check-ins (Slice, EarnApp, Earn Bitcoin, ZBD) que não terminaram hoje (só as que já rodaram alguma vez)
      // (o EarnApp dos outros aparelhos também: as macros de cada aparelho, contas.js FONTES_SAUDE)
      const falhas = FC.FONTES_SAUDE.filter(fo => ["erro", "incompleta", "faltou"].includes(FC.saude(f, fo, hoje).estado)).map(FC.nomeFonte);
      const partes = [];
      if (r.pendentes.length) partes.push(`${r.pendentes.map(x => x.nome).join(", ")}: já chegou?`);
      if (r.aPagar.length) partes.push(`${r.aPagar.map(x => x.nome).join(", ")}: já pagou?`);
      if (falhas.length) partes.push(`${falhas.length === 1 ? "a macro" : "as macros"} ${falhas.join(", ")} não ${falhas.length === 1 ? "terminou" : "terminaram"} hoje`);
      // "Conferi as Finanças" (02/11/2026): ele viu o que deu errado e fez o que precisava; o item fica feito no dia (as
      // macros continuam com a situação que tiverem). Um problema registrado depois da conferência o traz de volta.
      const conf = FC.conferenciaDoDia(f, hoje), ok = FC.financasConferidas(f, hoje);
      const quando = conf ? new Date(conf.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
      if (partes.length) itens.push(ok
        ? { id: "financas", icone: "💰", titulo: "Finanças conferidas", detalhe: `às ${quando} · ${partes.join(" · ")}`, feito: true, ir: { area: "financas" } }
        : { id: "financas", icone: "💰", titulo: `Finanças: ${partes.length === 1 ? "1 coisa" : `${partes.length} coisas`} para conferir`, detalhe: `${conf ? "algo novo depois da conferência · " : ""}${partes.join(" · ")}`, feito: false, ir: { area: "financas" }, acao: "conferir-financas" });
      // o cartão de passagens acabando (estimativa pela Agenda, contas.js `passagensRestantes`): ≤ 4 e aula à frente
      const pp = f.categorias.transporte && !f.categorias.transporte.apagada ? FC.passagensRestantes(f, hoje, fiPresencial) : null;
      if (FC.precisaRecarregar(pp)) itens.push({ id: "passagens", icone: "🚌", titulo: "Recarregar o cartão de passagens", detalhe: `≈ ${pp.restam} ${pp.restam === 1 ? "passagem" : "passagens"}${pp.ate ? ` · dá até ${new Date(pp.ate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "numeric" })}` : " · acabaram"}`, feito: false, ir: { area: "financas" } });
    }
  } catch (err) { console.warn("Meu dia: finanças", err); }
  // Destaques do WhatsApp (whatsapp/whatsapp.js): enquanto há destaques para decidir; tocar leva a Destaques, em Mensagens
  try { const it = (await import("./whatsapp/whatsapp.js")).itemMeuDia(); if (it) itens.push(it); } catch (err) { console.warn("Meu dia: WhatsApp", err); }
  // O que mudou na Agenda pelos destaques (agendaAvisos/): as mudanças novas não vistas e as perguntas do Claude
  try { itens.push(...(await import("./agendaAvisos/agendaAvisos.js")).itensMeuDia()); } catch (err) { console.warn("Meu dia: Agenda (avisos)", err); }
  // Recados do Claude e das tarefas (eva/recados.js): enquanto houver recado aberto; tocar leva à conversa da Eva
  try { const it = (await import("./eva/recados.js")).itemMeuDia(); if (it) itens.push(it); } catch (err) { console.warn("Meu dia: recados", err); }
  // Even3 (even3.js): eventos de Odontologia amanhã, ainda não vistos nem recusados; vai para "Se der tempo"
  try { const it = (await import("./even3.js")).itemMeuDia(); if (it) itens.push(it); } catch (err) { console.warn("Meu dia: Even3", err); }
  // modo foco (só informativo)
  const fm = e.foco?.dias?.[hoje] || 0;
  if (fm) itens.push({ id: "foco", icone: "⏱️", titulo: "Modo foco", detalhe: `${fm} min hoje`, feito: null, ir: { acao: "foco" } });
  // alarme de amanhã (alarmes.js), à noite: só informativo; tocar abre a Agenda nos alarmes
  try {
    const p = hm() >= "18:00" && R().ligado && tocaAqui() ? proximoAlarme() : null;
    if (p && p.data === somaDias(hoje, 1)) itens.push({ id: "alarme", icone: "⏰", titulo: `Alarme amanhã às ${horaCurta(p.hora)}`, detalhe: p.motivo || "", feito: null, ir: { area: "learn", tela: "agenda", rolar: ".alarmes-sec" } });
  } catch (e) { console.warn("Meu dia: alarme", e); }
  return dividir(itens, hoje);
}

/** Ações que um item do Meu dia faz ali mesmo, sem abrir a área. */
const ACOES = {
  "conferir-financas": { rotulo: "Conferi", feito: "Finanças conferidas", fazer: async () => {
    const f = FC.garantir(E()); FC.conferirFinancas(f, hojeISO()); salvar();
    window.dispatchEvent(new Event("oq-financas"));
    toast("Finanças conferidas hoje. Se uma macro der erro depois, o aviso volta.", 3200);
  } },
};

/** O que acontece hoje (aulas, compromissos, eventos) e as provas da semana: só informativo. */
function agendaDoDia() {
  const hoje = hojeISO(), agora = hm(), out = [];
  try {
    for (const ev of eventosDoDia(hoje)) if ((ev.fim || "23:59") >= agora) out.push({ hora: ev.inicio, nome: ev.item.curto || ev.item.nome || "", tipo: ev.item.tipo === "P" ? "prática" : "" });
    for (const ev of eventosOnlineDoDia(hoje)) if ((ev.fim || "23:59") >= agora) out.push({ hora: ev.inicio || "", nome: ev.n > 1 ? `${ev.nome} (dia ${ev.i + 1} de ${ev.n})` : ev.nome, tipo: ev.modalidade === "online" ? "evento online" : "evento" });
  } catch (e) { console.warn("Meu dia: agenda", e); }
  const provas = (E().avaliacoes || []).filter(a => a.data && a.data >= hoje && a.data <= somaDias(hoje, 7))
    .sort((a, b) => a.data.localeCompare(b.data)).map(a => ({ data: a.data, nome: a.disciplina || a.titulo || "", titulo: a.titulo || "" }));
  return { eventos: out.sort((a, b) => (a.hora || "").localeCompare(b.hora || "")), provas };
}

/** Quantos itens do dia já foram feitos (para o anel da Home e do bloco). */
export function contarFeitos(itens) {
  const contaveis = itens.filter(i => i.feito !== null && !i.bonus); // o "se der tempo" não conta
  return { feitos: contaveis.filter(i => i.feito).length, total: contaveis.length };
}
/** As provas dos próximos 7 dias (para a Home). */
export const provasDaSemana = () => agendaDoDia().provas;

/** HTML do bloco "Meu dia" (na Home do Órbita, home.js). `aoIr(item.ir)` navega; `prontos` = itensDoDia() já lidos. */
export async function blocoMeuDia(aoIr, prontos = null) {
  const itens = prontos || await itensDoDia(), ag = agendaDoDia();
  const contaveis = itens.filter(i => i.feito !== null && !i.bonus), feitos = contaveis.filter(i => i.feito).length;
  const pl = tamanhoAtivo() ? planoDe() : null, bonus = itens.filter(i => i.bonus);
  const linhaItem = (it) => {
    const k = itens.indexOf(it), item = `<button class="md-item ${it.feito ? "ok" : ""} ${it.bonus ? "md-bonus" : ""}" data-k="${k}"><span class="md-ico">${ico3d(it.icone, "ico3d")}</span><span class="md-tx"><b>${escapar(it.titulo)}</b><small>${escapar(it.detalhe)}</small></span>${it.feito === null || it.acao ? "" : `<i class="md-check">${it.feito ? "✓" : ""}</i>`}</button>`;
    // um item com ação própria (o "Conferi" das Finanças): o botão fica ao lado, no lugar do círculo
    return it.acao ? `<div class="md-linha">${item}<button class="md-acao" type="button" data-acao="${it.acao}" data-k="${k}">${ACOES[it.acao]?.rotulo || "Feito"}</button></div>` : item;
  };
  const p = contaveis.length ? feitos / contaveis.length : 0;
  const el = document.createElement("div"); el.className = "meu-dia";
  const hoje = new Date();
  el.innerHTML = `<div class="md-cab"><span class="md-anel" style="--p:${p}"><b>${feitos}</b><small>de ${contaveis.length}</small></span>
      <div><h3>Meu dia</h3><small>${hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</small>${pl ? `<button class="md-tam md-tam-${pl.tam}" type="button" title="Tamanho do dia: toque para trocar">${escapar(pl.nome)} · ~${minutosTexto(pl.min)}${pl.escolhido ? " ✎" : ""}</button>` : ""}</div>
      <button class="md-foco" type="button">⏱️ Foco</button></div>
    ${ag.provas.length ? `<div class="md-provas">${ag.provas.map(a => { const dd = Math.round((new Date(a.data + "T12:00") - new Date(hojeISO() + "T12:00")) / 864e5); return `<span><b>${dd === 0 ? "hoje" : dd === 1 ? "amanhã" : `${dd} dias`}</b> ${escapar(a.nome)}</span>`; }).join("")}</div>` : ""}
    <div class="md-lista">${itens.filter(i => !i.bonus).map(linhaItem).join("")}</div>
    ${bonus.length ? `<details class="md-extra" ${bonus.some(i => i.feito) || feitos >= contaveis.length ? "open" : ""}><summary>Se der tempo <small>${bonus.length} ${bonus.length === 1 ? "coisa" : "coisas"}</small></summary><div class="md-lista">${bonus.map(linhaItem).join("")}</div></details>` : ""}
    ${ag.eventos.length ? `<div class="md-agenda"><h4>Ainda hoje</h4>${ag.eventos.slice(0, 4).map(ev => `<div><b>${escapar(ev.hora || "")}</b><span>${escapar(ev.nome)}</span>${ev.tipo ? `<small>${escapar(ev.tipo)}</small>` : ""}</div>`).join("")}</div>` : ""}`;
  el.querySelectorAll(".md-item").forEach(b => (b.onclick = () => aoIr(itens[+b.dataset.k].ir)));
  el.querySelectorAll(".md-acao").forEach(b => (b.onclick = async (ev) => {
    ev.stopPropagation();
    const a = ACOES[b.dataset.acao]; if (!a) return;
    await a.fazer();
    // a linha vira feita na hora; a Home atualiza o anel pelo topo
    const linha = b.closest(".md-linha"), it = linha?.querySelector(".md-item");
    if (it) { it.classList.add("ok"); it.querySelector(".md-tx b").textContent = a.feito; it.insertAdjacentHTML("beforeend", `<i class="md-check">✓</i>`); }
    b.remove();
    window.dispatchEvent(new Event("oq-topo"));
  }));
  el.querySelector(".md-foco").onclick = () => aoIr({ acao: "foco" });
  const bt = el.querySelector(".md-tam"); if (bt) bt.onclick = () => abrirTamanho();
  return el;
}

/** A folha do tamanho do dia: hoje e amanhã, automático (pela Agenda) ou escolhido. */
export function abrirTamanho() {
  const hoje = hojeISO(), dias = [hoje, somaDias(hoje, 1)];
  const nomeDia = (d, i) => `${i ? "Amanhã" : "Hoje"} <small>${new Date(d + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</small>`;
  const bloco = (d, i) => {
    const p = planoDe(d), op = [["", `Pela Agenda (${TAMANHOS[p.auto].curto.toLowerCase()})`], ...Object.entries(TAMANHOS).map(([k, t]) => [k, t.curto])];
    return `<div class="tam-dia" data-d="${d}"><h3>${nomeDia(d, i)}</h3>
      <p class="sub">${escapar(p.motivo ? p.motivo[0].toUpperCase() + p.motivo.slice(1) : "")}: ~${minutosTexto(p.livre)} livres</p>
      <div class="ap-seg tam-seg">${op.map(([k, n]) => `<button data-t="${k}" class="${(p.escolhido || "") === k ? "on" : ""}">${n}</button>`).join("")}</div></div>`;
  };
  const html = `<div class="tam"><h2>Tamanho do dia</h2>
    <p class="sub">A Agenda decide quanto cabe: <b>corrido</b> ~1h (só o essencial e as provas), <b>normal</b> ~1h45 e <b>livre</b> ~2h45. O que não couber vai para "Se der tempo". Amanhã: a escolha vale para as lições que chegam de madrugada (no corrido, menos lições).</p>
    ${dias.map(bloco).join("")}</div>`;
  const p = modal({ titulo: "", html, botoes: [{ texto: "Pronto", valor: true }] });
  const m = document.getElementById("modal");
  m.querySelectorAll(".tam-dia").forEach(b => b.querySelectorAll("[data-t]").forEach(x => (x.onclick = () => {
    escolher(b.dataset.d, x.dataset.t || null);
    b.querySelectorAll("[data-t]").forEach(y => y.classList.toggle("on", y === x));
  })));
  return p;
}

/** Manda o resumo do dia ao widget "Meu dia" (chamado com atraso depois de cada mudança no topo). */
let ultimoEnvio = "";
export async function enviarAoWidget() {
  const todos = await itensDoDia(), itens = todos.filter(i => !i.bonus), contaveis = itens.filter(i => i.feito !== null), nb = todos.length - itens.length;
  const r = { dia: hojeISO(), feitos: contaveis.filter(i => i.feito).length, total: contaveis.length,
    linhas: [...itens.map(i => (i.feito === null ? { t: i.titulo, d: i.detalhe } : { t: i.titulo, d: i.detalhe, ok: !!i.feito })), ...(nb ? [{ t: "Se der tempo", d: `${nb} ${nb === 1 ? "coisa" : "coisas"}` }] : [])] };
  const chave = JSON.stringify(r); if (chave === ultimoEnvio) return;
  ultimoEnvio = chave; atualizarWidgetMeuDia(r);
}
