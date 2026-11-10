// Aba Treino dos Estudos (reorganizada a pedido do Alediov, 04/11/2026: muitos cartões repetidos). Em ordem:
// 1. Treino do dia: um botão só, que mistura revisão, erros da semana e erros antigos puxando para a próxima prova
//    (treino.js montarTreinoDoDia); aos domingos vira "Treino de domingo", com +25 XP e 10 moedas uma vez por semana.
// 2. Raio X das provas: para cada prova com recorte nos próximos 30 dias, a prontidão, o Simulado da prova (20 questões
//    cronometradas, licao.js no modo prova) com as últimas notas, os pontos fracos e o detalhe por unidade.
// 3. Por disciplina: disciplina → capítulos e unidades com o acerto; a escolha fica guardada.
// 4. Treino aleatório.
import { E, ganhar, salvar, hojeISO, somaDias } from "./estado.js";
import { bancoDeExercicios } from "./dados.js";
import { iniciarLicao } from "./licao.js";
import { embaralhar } from "./exercicios.js";
import { icone } from "./icones.js";
import { escapar, toast } from "./ui.js";
import * as RX from "./raioX.js";
import * as TR from "./treino.js";

const tela = () => document.getElementById("tela");
const pct = (c, t) => (t ? Math.round((c / t) * 100) : null);
const dias = (hoje, d) => Math.round((new Date(d + "T12:00") - new Date(hoje + "T12:00")) / 864e5);
const quando = (n) => (n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);

/** { aoMudar, foco }: `foco` = id da avaliação a abrir aberta (tocada na aba Provas da trilha). */
export async function telaTreino({ aoMudar = () => {}, foco = null } = {}) {
  const t = tela();
  const banco = await bancoDeExercicios();
  const T = await RX.titulosUnidades();
  const hoje = hojeISO(), domingo = new Date(hoje + "T12:00").getDay() === 0;
  const chaveDomingo = somaDias(hoje, -new Date(hoje + "T12:00").getDay()), bonusFeito = !!E().treinoDomingo?.[chaveDomingo];
  const recarregar = () => telaTreino({ aoMudar });
  t.innerHTML = `<h1 class="titulo-tela">Treino</h1><p class="sub">Funciona sem internet, com tudo o que você já baixou.</p>`;

  const exercicios = (ids) => ids.map(id => { const ex = { ...banco.get(id) }; delete ex.personagem; return ex; });
  const treinar = async (titulo, ids, aoTerminar) => {
    const r = await iniciarLicao({ id: `treino-${hoje}`, titulo, exercicios: exercicios(ids), treino: true, periodo: "treino" });
    if (r) { aoTerminar?.(r); aoMudar(); recarregar(); }
  };

  // ---------- 1. Treino do dia ----------
  const provas = TR.proximasProvas(hoje);
  const td = TR.montarTreinoDoDia(banco, { hoje, prova: provas[0] || null });
  const feito = TR.treinoDoDiaFeito(hoje);
  const dia = document.createElement("div");
  dia.className = `cartao tr-dia ${domingo && !bonusFeito ? "treino-domingo" : ""}`;
  const estado = feito ? `Feito hoje${feito.vezes > 1 ? ` ${feito.vezes}×` : ""} ✓ · ${feito.acertos}/${feito.total} de primeira`
    : domingo ? (bonusFeito ? "Domingo: o bônus da semana já foi ganho." : "Domingo: vale +25 XP e 10 moedas de bônus.") : "Revisão, erros e a próxima prova num treino só.";
  dia.innerHTML = `<div class="tr-dia-topo">${icone(domingo ? "🗓️" : "🎯", "ico3d ico-grande")}<div><h2>${domingo ? "Treino de domingo" : "Treino do dia"}</h2><span class="sub">${escapar(estado)}</span></div></div>
    <p class="tr-resumo">${escapar(TR.resumoTreinoDoDia(td))}</p>`;
  const bDia = document.createElement("button"); bDia.className = "botao tr-comecar"; bDia.textContent = feito ? "Mais um treino" : "Começar"; bDia.disabled = !td.ids.length;
  bDia.onclick = () => treinar(domingo ? "Treino de domingo" : "Treino do dia", td.ids, (r) => {
    TR.anotarTreinoDoDia(r, hoje);
    if (!domingo || E().treinoDomingo?.[chaveDomingo]) return;
    (E().treinoDomingo ??= {})[chaveDomingo] = true;
    ganhar(25, 10, "Treino de domingo", "treino"); salvar(); toast("Bônus do treino de domingo: +25 XP e 10 moedas");
  });
  dia.append(bDia); t.append(dia);

  // ---------- 2. Raio X das provas, com o simulado ----------
  if (provas.length) {
    const sec = document.createElement("div"); sec.className = "secao rx";
    sec.innerHTML = `<h2>Raio X das provas</h2><p class="sub">Simulado cronometrado só do recorte, o domínio de cada unidade e os pontos fracos.</p>`;
    for (const av of provas) {
      const rx = await RX.raioX(av, banco), dd = dias(hoje, av.data);
      const sims = TR.simuladosDe(av.id), disp = TR.disponiveisSimulado(banco, av), nSim = Math.min(20, disp);
      const c = document.createElement("div"); c.className = "cartao tr-prova"; c.dataset.av = av.id;
      c.innerHTML = `<div class="tr-prova-cab"><span class="rx-anel ${RX.corDaNota(rx.prontidao)}" style="--p:${rx.prontidao}"><b>${Math.round(rx.prontidao * 100)}</b></span>
          <span class="rx-tit"><b>${icone(TR.iconeDaProva(av), "ico-inline")} ${escapar(av.disciplina || av.titulo)}</b><small>${escapar(av.titulo || "")} · ${quando(dd)}${rx.faltam.length && rx.unidades.length ? ` · ${Math.round(rx.estudado * 100)}% do que já está na trilha` : ""}</small></span></div>
        <div class="tr-notas">${sims.length ? `<span>Simulados:</span>${sims.slice(0, 4).map(s => `<b class="tr-nota ${s.nota >= 7 ? "bom" : s.nota >= 5 ? "medio" : "fraco"}" title="${s.data.slice(8, 10)}/${s.data.slice(5, 7)}">${TR.notaTxt(s.nota)}</b>`).join("")}` : "<span>Nenhum simulado ainda.</span>"}</div>
        <div class="tr-bts"></div>`;
      const bts = c.querySelector(".tr-bts");
      const bS = document.createElement("button"); bS.className = "botao tr-simulado";
      bS.innerHTML = nSim >= 5 ? `${icone("⏱️", "ico-inline")} Simulado · ${nSim} questões · ${nSim} min` : "Poucas questões do recorte ainda";
      bS.disabled = nSim < 5; bS.onclick = () => simulado(av, sims[0]);
      const fracas = RX.pontosFracos(rx, banco);
      const bF = document.createElement("button"); bF.className = "botao secundario"; bF.textContent = fracas.length ? `Pontos fracos (${fracas.length})` : "Nada para treinar ainda";
      bF.disabled = !fracas.length; bF.onclick = () => treinar(`Raio X: ${av.disciplina || av.titulo}`, fracas);
      bts.append(bS, bF);
      const erros = (sims[0]?.erros || []).filter(id => banco.has(id));
      if (erros.length) {
        const bE = document.createElement("button"); bE.className = "link tr-rever-ultimo"; bE.textContent = `Rever os erros do último simulado (${erros.length})`;
        bE.onclick = () => treinar(`Erros do simulado: ${av.disciplina || av.titulo}`, erros);
        c.append(bE);
      }
      const det = document.createElement("details"); det.className = "tr-det"; det.open = foco === av.id;
      det.innerHTML = `<summary>Por unidade</summary><ul class="rx-lista">${RX.linhasUnidades(rx)}</ul>`;
      c.append(det); sec.append(c);
      if (foco === av.id) requestAnimationFrame(() => c.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
    t.append(sec);
  }

  async function simulado(av, anterior) {
    const ids = TR.montarSimulado(banco, av);
    const nome = TR.nomeProva(av);
    const detalhe = (lista) => {
      const us = TR.porUnidade(lista, banco, T);
      return `<div class="tr-por-u">${anterior ? `<p class="sub">Simulado anterior: ${TR.notaTxt(anterior.nota)} (${anterior.data.slice(8, 10)}/${anterior.data.slice(5, 7)})</p>` : ""}
        <h3>Por unidade</h3><ul class="rx-lista">${us.map(u => `<li class="rx-u ${RX.corDaNota(u.c / u.t)}"><div class="rx-u-topo"><span><small>${escapar(u.id)}</small> ${escapar(u.nome)}</span><b>${u.c}/${u.t}</b></div><div class="rx-barra"><i style="width:${Math.round((u.c / u.t) * 100)}%"></i></div></li>`).join("")}</ul></div>`;
    };
    const r = await iniciarLicao({ id: `treino-simulado-${hoje}`, titulo: `Simulado: ${nome}`, exercicios: exercicios(ids), treino: true, periodo: "treino", prova: { minutos: ids.length, detalhe } });
    if (!r) return;
    TR.guardarSimulado(av, r, banco); aoMudar();
    if (r.rever) return treinar(`Erros do simulado: ${nome}`, r.prova.respostas.filter(x => !x.acertou).map(x => x.id).filter(id => banco.has(id)));
    recarregar();
  }

  // ---------- 3. Por disciplina ----------
  const discs = TR.mapaDisciplinas(banco, T);
  if (discs.length) {
    const sec = document.createElement("div"); sec.className = "secao tr-disc";
    sec.innerHTML = `<h2>Por disciplina</h2><div class="tr-discs" role="tablist"></div><div class="tr-painel"></div>`;
    t.append(sec);
    const guardada = TR.escolhaGuardada() || {};
    const esc = { disc: discs.some(d => d.id === guardada.disc) ? guardada.disc : discs[0].id, sel: [...(guardada.sel || [])], n: guardada.n || 10, abertos: new Set() };
    if (guardada.disc !== esc.disc) esc.sel = [];
    for (const x of esc.sel) if (TR.capDe(x) !== x) esc.abertos.add(TR.capDe(x)); // unidades escolhidas: o capítulo já aberto
    const chips = sec.querySelector(".tr-discs"), painel = sec.querySelector(".tr-painel");
    for (const d of discs) {
      const b = document.createElement("button"); b.className = "tr-chip"; b.dataset.disc = d.id; b.setAttribute("role", "tab");
      b.innerHTML = `${icone(d.icone, "ico3d")}<span><b>${escapar(d.nome)}</b><small>${d.total} questões</small></span>`;
      b.onclick = () => { if (esc.disc === d.id) return; esc.disc = d.id; esc.sel = []; esc.abertos.clear(); TR.guardarEscolha({ disc: esc.disc, sel: [] }); desenhar(); };
      chips.append(b);
    }
    const linha = (o, nivel) => {
      const p = pct(o.certas, o.vistas);
      const marcado = esc.sel.includes(o.id) || (nivel === "u" && esc.sel.includes(TR.capDe(o.id)));
      const parte = !marcado && nivel === "c" && esc.sel.some(x => x !== o.id && TR.capDe(x) === o.id);
      return `<div class="tr-linha tr-${nivel} ${marcado ? "on" : parte ? "parte" : ""}" data-id="${escapar(o.id)}" data-nivel="${nivel}" role="checkbox" aria-checked="${marcado}">
        <span class="tr-caixa" aria-hidden="true"></span>
        <span class="tr-txt"><b>${nivel === "c" ? escapar(o.nome) : `<small>${escapar(o.id)}</small> ${escapar(o.nome)}`}</b><small>${nivel === "c" && o.unidades[0] && o.nome.startsWith("Cap.") ? `${escapar(o.unidades[0].nome)} · ` : ""}${o.total} ${o.total === 1 ? "questão" : "questões"}${o.vistas < o.total ? ` · ${o.total - o.vistas} nunca vistas` : ""}</small></span>
        <b class="tr-pct ${p == null ? "nunca" : RX.corDaNota(p / 100)}">${p == null ? "–" : `${p}%`}</b>
        ${nivel === "c" && o.unidades.length > 1 ? `<button class="tr-abre ${esc.abertos.has(o.id) ? "aberto" : ""}" data-abre="${escapar(o.id)}" aria-label="Unidades">▾</button>` : ""}
      </div>`;
    };
    function desenhar() {
      chips.querySelectorAll(".tr-chip").forEach(b => b.classList.toggle("on", b.dataset.disc === esc.disc));
      const d = discs.find(x => x.id === esc.disc);
      const total = TR.contarSelecao(banco, d.id, esc.sel), n = Math.min(esc.n, total);
      const rolagem = painel.querySelector(".tr-caps")?.scrollTop || 0; // tocar numa linha não volta a lista ao topo
      painel.innerHTML = `<div class="cartao tr-caps">
          <p class="tr-fonte">${escapar(d.fonte)} · toque para escolher capítulos ou unidades; sem escolha, vale a disciplina toda.</p>
          ${d.caps.map(c => linha(c, "c") + (esc.abertos.has(c.id) ? `<div class="tr-unis">${c.unidades.map(u => linha(u, "u")).join("")}</div>` : "")).join("")}
        </div>
        <div class="tr-rodape"><div class="tr-qtd">${[10, 20, 30].map(q => `<button class="chip-filtro ${esc.n === q ? "on" : ""}" data-n="${q}">${q}</button>`).join("")}</div>
          ${esc.sel.length ? `<button class="link tr-limpar">Limpar escolha</button>` : ""}</div>`;
      const b = document.createElement("button"); b.className = "botao tr-treinar-disc";
      b.textContent = total ? `Treinar ${n} de ${total} ${total === 1 ? "questão" : "questões"}${esc.sel.length ? "" : ` de ${d.nome}`}` : "Nenhuma questão aqui ainda";
      b.disabled = !total;
      b.onclick = () => treinar(`${d.nome}${esc.sel.length ? `: ${esc.sel.length === 1 ? (d.caps.find(c => c.id === esc.sel[0])?.nome || esc.sel[0]) : `${esc.sel.length} escolhas`}` : ""}`, TR.questoesDaDisciplina(banco, d.id, esc.sel, n));
      painel.append(b);
      painel.querySelector(".tr-caps").scrollTop = rolagem;
      painel.querySelectorAll(".tr-qtd [data-n]").forEach(x => x.onclick = () => { esc.n = +x.dataset.n; TR.guardarEscolha({ n: esc.n }); desenhar(); });
      painel.querySelector(".tr-limpar")?.addEventListener("click", () => { esc.sel = []; TR.guardarEscolha({ disc: esc.disc, sel: [] }); desenhar(); });
      painel.querySelectorAll(".tr-abre").forEach(x => x.onclick = (e) => { e.stopPropagation(); const id = x.dataset.abre; esc.abertos.has(id) ? esc.abertos.delete(id) : esc.abertos.add(id); desenhar(); });
      painel.querySelectorAll(".tr-linha").forEach(x => x.onclick = () => { alternar(x.dataset.id, x.dataset.nivel, d); TR.guardarEscolha({ disc: esc.disc, sel: esc.sel }); desenhar(); });
    }
    function alternar(id, nivel, d) {
      if (nivel === "c") { // o capítulo inteiro: tira as unidades dele que estavam escolhidas uma a uma
        const tinha = esc.sel.includes(id);
        esc.sel = esc.sel.filter(s => TR.capDe(s) !== id);
        if (!tinha) esc.sel.push(id);
        return;
      }
      const cap = TR.capDe(id);
      if (esc.sel.includes(cap)) { // desmarcar uma unidade de um capítulo inteiro: fica o resto dele
        esc.sel = esc.sel.filter(s => s !== cap);
        esc.sel.push(...d.caps.find(c => c.id === cap).unidades.map(u => u.id).filter(u => u !== id));
      } else if (esc.sel.includes(id)) esc.sel = esc.sel.filter(s => s !== id);
      else {
        esc.sel.push(id);
        const todas = d.caps.find(c => c.id === cap).unidades.map(u => u.id);
        if (todas.every(u => esc.sel.includes(u))) esc.sel = [...esc.sel.filter(s => !todas.includes(s)), cap]; // todas: vira o capítulo
      }
    }
    desenhar();
    const on = chips.querySelector(".tr-chip.on"); if (on) chips.scrollLeft = Math.max(0, on.offsetLeft - 8);
  }

  // ---------- 4. Treino aleatório ----------
  const al = document.createElement("div"); al.className = "cartao tr-aleatorio";
  al.innerHTML = `${icone("🎲", "ico3d")}<span><b>Treino aleatório</b><small>10 questões entre ${banco.size} do seu banco</small></span>`;
  const bA = document.createElement("button"); bA.className = "botao secundario"; bA.textContent = "Treinar"; bA.disabled = !banco.size;
  bA.onclick = () => treinar("Treino aleatório", embaralhar([...banco.keys()]).slice(0, 10));
  al.append(bA); t.append(al);
}
