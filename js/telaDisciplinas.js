// Aba Disciplinas dos Estudos (pedido do Alediov, 02/11/2026): as disciplinas do ano com a média, o que falta para a
// aprovação, a situação (aprovado, em curso, risco de exame) e as faltas; e a tela de cada uma, com as avaliações (peso,
// nota), o exame, a frequência, a carga horária e os professores. As contas estão em disciplinas.js.
import { icone } from "./icones.js";
import { hojeISO, difDias } from "./estado.js";
import * as DS from "./disciplinas.js";
import { lancarNota } from "./agenda.js";
import { tocar } from "./sons.js";
import { modal, toast, formulario, escapar, dataBR } from "./ui.js";

const tela = () => document.getElementById("tela");
let aberta = null;
let aoMudar = () => {};
export function definirAoMudarDisciplinas(fn) { aoMudar = fn; }
const ir = (aba) => window.dispatchEvent(new CustomEvent("oq-ir", { detail: aba }));
/** Abre a tela de uma disciplina (rota "disciplina", filha da aba Disciplinas). */
export function abrirDisciplina(id) { aberta = id; ir("disciplina"); }

const corEstado = (st) => DS.ESTADOS[st]?.[1] || "";
const pilula = (st) => `<span class="dc-pilula ${corEstado(st)}">${escapar(DS.ESTADOS[st]?.[0] || st)}</span>`;
/** O anel com a média (de 0 a 10), na cor da situação. */
function anel(c, grande = false) {
  const v = c.completa ? c.md : c.media, p = v == null ? 0 : Math.max(0, Math.min(1, v / 10));
  return `<span class="dc-anel ${grande ? "grande" : ""} ${corEstado(c.estado)}" style="--p:${p}"><b>${DS.nota(v)}</b><small>${c.completa ? "média final" : v == null ? "sem nota" : "média"}</small></span>`;
}
const quandoTxt = (data) => { const n = difDias(hojeISO(), data); return n === 0 ? "hoje" : n === 1 ? "amanhã" : n < 0 ? dataBR(data) : `em ${n} dias`; };
/** A frase do que falta, para o cartão e para o alto da tela da disciplina. */
function fraseFalta(c) {
  const r = c.regra, n = c.faltam.length;
  if (c.estado === "sem_avaliacoes") return "As avaliações aparecem com a Agenda ou com o plano de ensino.";
  if (c.estado === "reprovado_falta") return `Passou do limite de faltas (${r.frequencia}% de frequência).`;
  if (c.completa) {
    if (c.mf != null) return `Média final depois do exame: ${DS.nota(c.mf)} (precisava de ${DS.nota(r.final)}).`;
    if (c.estado === "exame") return `Exame final: precisa de ${DS.nota(Math.max(0, c.precisaExame))} para a média final chegar a ${DS.nota(r.final)}.`;
    return c.estado === "aprovado" ? `Aprovado com ${DS.nota(c.md)}.` : `Média ${DS.nota(c.md)}: abaixo de ${DS.nota(r.exameMin)}, não há exame.`;
  }
  if (c.estado === "garantido") return `Já passou de ${DS.nota(r.aprovacao)}, mesmo com zero no que falta.`;
  if (c.estado === "reprovado_certo") return `Mesmo com 10 no que falta, a média não chega a ${DS.nota(r.exameMin)}.`;
  if (c.estado === "exame_certo") return `Mesmo com 10 no que falta, não chega a ${DS.nota(r.aprovacao)}: o exame vai precisar de ${DS.nota(Math.max(0, (r.final * (r.pesoMedia + r.pesoExame) - r.pesoMedia * c.maximo) / r.pesoExame))} ou mais.`;
  // com pesos iguais a 1, "pontos" é a soma das notas que falta; com pesos, só a média que falta
  const simples = c.avs.every(a => a.pesoEf === 1);
  return `Precisa de ${DS.nota(c.precisa)} de média ${n === 1 ? "na que falta" : `nas ${n} que faltam`}${simples ? ` (faltam ${DS.nota(c.pontos)} ${c.pontos === 1 ? "ponto" : "pontos"} somando as notas)` : ""}.`;
}
const linhaFaltas = (f, r) => f.limite != null
  ? `${DS.horasTxt(f.total)} de faltas de ${DS.horasTxt(f.limite)}${f.estimada ? "*" : ""}`
  : `${f.faltas} ${f.faltas === 1 ? "falta" : "faltas"}${f.total ? ` (${DS.horasTxt(f.total)})` : ""}`;

// ---------------------------------------------------------------- a lista
export function telaDisciplinas() {
  const t = tela(), hoje = hojeISO(), ano = DS.anoLetivo(), cfg = DS.D().cfg || {};
  const lista = DS.disciplinasDoAno(ano).map(d => ({ d, c: DS.calcular(d, hoje) }));
  // em curso primeiro (a próxima avaliação mais perto), depois as fechadas
  const fechada = (c) => c.completa || ["reprovado_falta", "reprovado_certo"].includes(c.estado);
  lista.sort((a, b) => fechada(a.c) - fechada(b.c) || (a.c.proxima?.data || "9999").localeCompare(b.c.proxima?.data || "9999") || a.d.nome.localeCompare(b.d.nome, "pt-BR"));
  const comMedia = lista.filter(x => (x.c.completa ? x.c.md : x.c.media) != null);
  const geral = comMedia.length ? comMedia.reduce((s, x) => s + (x.c.completa ? x.c.md : x.c.media), 0) / comMedia.length : null;
  const risco = lista.filter(x => ["risco", "exame", "exame_certo", "reprovado_falta", "reprovado_certo", "reprovado"].includes(x.c.estado)).length;
  t.innerHTML = `<h1 class="titulo-tela">Disciplinas</h1>
    <p class="sub dc-sub">${escapar(cfg.serie || "")}${cfg.serie ? " · " : ""}${ano} · regras da UNIOESTE</p>
    <div class="dc-resumo"><span><b>${lista.length}</b><small>disciplinas</small></span><span><b>${DS.nota(geral)}</b><small>média geral</small></span><span class="${risco ? "alerta" : ""}"><b>${risco}</b><small>${risco === 1 ? "pede atenção" : "pedem atenção"}</small></span></div>`;
  const sec = document.createElement("div"); sec.className = "dc-lista";
  for (const { d, c } of lista) sec.append(cartao(d, c));
  if (!lista.length) sec.innerHTML = `<p class="sub">As disciplinas aparecem com o horário da Agenda ou com o pacote das disciplinas.</p>`;
  t.append(sec);
  t.append(blocoRegra());
}

function cartao(d, c) {
  const b = document.createElement("button"); b.className = `dc-cartao ${corEstado(c.estado)}`; b.dataset.disc = d.id;
  const feitas = c.avs.filter(a => a.n10 != null).length, profs = (d.professores || []).join(", ");
  const prox = c.proxima ? `${escapar(DS.TIPOS[c.proxima.tipo] || "Avaliação")} ${quandoTxt(c.proxima.data)}` : "";
  b.innerHTML = `${anel(c)}<span class="dc-tx"><b>${escapar(d.nome)}</b>
      <small>${[profs && escapar(profs), prox].filter(Boolean).join(" · ") || (d.virtual ? "da Agenda · o plano de ensino ainda não chegou" : "")}</small>
      <span class="dc-linha">${pilula(c.estado)}<span class="dc-av">${feitas}/${c.avs.length} ${c.avs.length === 1 ? "avaliação" : "avaliações"}</span><span class="dc-fal ${c.freq.reprovado ? "ruim" : c.freq.perto ? "alerta" : ""}">${icone("🚫", "ico-inline")} ${linhaFaltas(c.freq, c.regra)}</span></span>
      <span class="dc-frase">${escapar(fraseFalta(c))}</span></span>`;
  b.onclick = () => { tocar("toque"); abrirDisciplina(d.id); };
  return b;
}

function blocoRegra() {
  const r = { ...DS.REGRA_UNIOESTE, ...(DS.D().cfg?.regra || {}) };
  const det = document.createElement("details"); det.className = "dc-regra";
  det.innerHTML = `<summary>${icone("📏", "ico-inline")} Como o app calcula</summary>
    <ul><li><b>Aprovação direta:</b> média ${DS.nota(r.aprovacao)} ou mais e frequência de ${r.frequencia}%.</li>
    <li><b>Exame final:</b> média de ${DS.nota(r.exameMin)} a ${DS.nota(r.aprovacao - 0.1)}. Depois dele, média final = (média × ${r.pesoMedia} + exame × ${r.pesoExame}) ÷ ${r.pesoMedia + r.pesoExame}, que precisa chegar a ${DS.nota(r.final)}.</li>
    <li><b>Faltas:</b> no máximo ${100 - r.frequencia}% da carga horária. Contam o "Faltei" da Agenda (em horas, pelo horário da aula) e as faltas de antes do registro. *Sem a carga horária do plano de ensino, o limite é estimado pela Agenda.</li>
    <li><b>Pesos:</b> os do plano de ensino; sem ele, as provas e trabalhos da Agenda valem peso 1. Cada disciplina pode ter regras próprias.</li></ul>
    <p class="sub">${escapar(DS.FONTE_REGRA)} (notas de 0 a 100 no Regimento; aqui, de 0 a 10).</p>`;
  return det;
}

// ---------------------------------------------------------------- uma disciplina
export function telaDisciplina() {
  const t = tela(), d = aberta && DS.disciplina(aberta);
  if (!d) return ir("disciplinas");
  const c = DS.calcular(d), r = c.regra, f = c.freq;
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Disciplinas"; v.onclick = () => ir("disciplinas");
  t.append(v);
  const cab = document.createElement("div"); cab.className = "dc-cab";
  const profs = (d.professores || []).join(", ");
  cab.innerHTML = `<h1 class="titulo-tela">${escapar(d.nome)}</h1>
    <p class="sub">${[DS.PERIODOS[d.periodo], d.ano, profs].filter(Boolean).map(x => escapar(String(x))).join(" · ") || "Período e professores: com o plano de ensino"}</p>`;
  t.append(cab);
  // a média e o que falta
  const heroi = document.createElement("div"); heroi.className = `dc-heroi ${corEstado(c.estado)}`;
  const feitas = c.avs.filter(a => a.n10 != null);
  heroi.innerHTML = `${anel(c, true)}<div class="dc-heroi-tx">${pilula(c.estado)}<p>${escapar(fraseFalta(c))}</p>
      ${c.pT ? `<span class="dc-barra" title="Peso já avaliado"><i style="width:${Math.round((c.pF / c.pT) * 100)}%"></i></span><small>${feitas.length} de ${c.avs.length} ${c.avs.length === 1 ? "avaliação" : "avaliações"} com nota · ${Math.round((c.pF / c.pT) * 100)}% do peso</small>` : ""}</div>`;
  t.append(heroi);
  // exame (quando a média fechou entre o mínimo e a aprovação, ou se ele já lançou)
  if ((c.completa && c.md >= r.exameMin - 1e-9 && c.md < r.aprovacao - 1e-9) || d.exame) {
    const ex = document.createElement("div"); ex.className = "cartao dc-exame";
    ex.innerHTML = `<b>${icone("📝", "ico-inline")} Exame final</b><p class="sub">${c.exameNota != null ? `Nota do exame: ${DS.nota(c.exameNota)} → média final ${DS.nota(c.mf)}.` : `Precisa de ${DS.nota(Math.max(0, c.precisaExame))} no exame.`}</p>`;
    const b = document.createElement("button"); b.className = "botao secundario mini"; b.textContent = c.exameNota != null ? "Corrigir a nota do exame" : "Lançar a nota do exame";
    b.onclick = async () => {
      const fx = await formulario({ titulo: "Nota do exame", campos: [{ id: "nota", rotulo: "Nota", tipo: "number", valor: d.exame?.nota ?? "", passo: "0.1" }, { id: "max", rotulo: "Nota máxima", tipo: "number", valor: d.exame?.max || 10, passo: "0.1" }],
        botoes: [{ texto: "Salvar", acao: "salvar" }, ...(d.exame ? [{ texto: "Apagar", acao: "apagar", classe: "secundario" }] : [])] });
      if (!fx) return;
      DS.lancarExame(d.id, fx._acao === "apagar" ? null : fx.nota, fx.max || 10); aoMudar(); telaDisciplina();
    };
    ex.append(b); t.append(ex);
  }
  // avaliações
  const sa = document.createElement("div"); sa.className = "secao";
  sa.innerHTML = `<h2>Avaliações</h2>`;
  const box = document.createElement("div"); box.className = "dc-avs";
  for (const a of c.avs) box.append(linhaAvaliacao(d, a, c));
  if (!c.avs.length) box.innerHTML = `<p class="sub">Nenhuma avaliação ainda. As provas da Agenda entram sozinhas; as do plano de ensino, com o pacote das disciplinas.</p>`;
  sa.append(box);
  const nova = document.createElement("button"); nova.className = "botao secundario"; nova.textContent = "+ Avaliação";
  nova.onclick = () => editarAvaliacao(d, null);
  sa.append(nova);
  if (d.composicao === "bimestres") sa.insertAdjacentHTML("beforeend", `<p class="sub">Média dos bimestres: em cada bimestre, a média pelos pesos de dentro dele.</p>`);
  t.append(sa);
  // frequência
  const sf = document.createElement("div"); sf.className = "secao";
  const pct = f.limite ? Math.min(1, f.total / f.limite) : 0;
  sf.innerHTML = `<h2>Faltas</h2><div class="cartao dc-freq ${f.reprovado ? "ruim" : f.perto ? "alerta" : ""}">
    <div class="dc-freq-num"><span><b>${f.faltas}</b><small>${f.faltas === 1 ? "falta" : "faltas"} na Agenda</small></span><span><b>${DS.horasTxt(f.total)}</b><small>faltas${f.antes ? ` (${DS.horasTxt(f.antes)} de antes)` : ""}</small></span><span><b>${f.limite != null ? DS.horasTxt(Math.max(0, f.resta)) : "—"}</b><small>ainda pode faltar</small></span></div>
    ${f.limite != null ? `<span class="dc-barra faltas"><i style="width:${Math.round(pct * 100)}%"></i></span>` : ""}
    <p class="sub">${f.limite != null ? `Limite: ${DS.horasTxt(f.limite)} (${100 - r.frequencia}% de ${DS.horasTxt(f.base)}${f.ch ? "" : f.estimada?.dobro ? ", estimado: o dobro do semestre que a Agenda conhece" : ", estimado pela Agenda"}).` : "Sem a carga horária ainda: o limite aparece com o plano de ensino."}${f.pct != null ? ` Frequência: ${Math.round(f.pct)}%.` : ""}</p>
    ${f.lista.length ? `<p class="dc-faltas-lista">${f.lista.slice(0, 8).map(x => `<span>${dataBR(x.data)}${x.tipo === "P" ? " (P)" : ""} · ${DS.horasTxt(x.h)}</span>`).join("")}</p>` : ""}</div>`;
  t.append(sf);
  // dados da disciplina
  const si = document.createElement("div"); si.className = "secao";
  const ch = d.ch?.total ? `${d.ch.total} h${d.ch.teorica || d.ch.pratica ? ` (${d.ch.teorica || 0} teórica, ${d.ch.pratica || 0} prática)` : ""}` : f.estimada ? `≈ ${DS.horasTxt(f.estimada.horas)} pela Agenda` : "—";
  si.innerHTML = `<h2>Dados</h2><div class="cartao dc-dados">
    <p><span>Carga horária</span><b>${escapar(ch)}</b></p>
    <p><span>Professores</span><b>${escapar(profs || "—")}</b></p>
    <p><span>Período</span><b>${escapar(DS.PERIODOS[d.periodo] || "—")}</b></p>
    <p><span>Aprovação</span><b>média ${DS.nota(r.aprovacao)} · exame de ${DS.nota(r.exameMin)} · final ${DS.nota(r.final)} · ${r.frequencia}% de frequência</b></p>
    ${d.obs ? `<p class="sub">${escapar(d.obs)}</p>` : ""}</div>`;
  const be = document.createElement("button"); be.className = "botao secundario"; be.style.marginTop = "10px"; be.textContent = "Editar disciplina";
  be.onclick = () => editarDisciplina(d);
  si.append(be); t.append(si);
}

function linhaAvaliacao(d, a, c) {
  const b = document.createElement("button"); b.className = `dc-av-linha ${a.n10 == null ? "" : a.n10 >= c.regra.aprovacao ? "ok" : a.n10 >= c.regra.exameMin ? "meio" : "ruim"}`;
  const peso = d.composicao === "bimestres" ? `${a.bim ? `${a.bim}º bim.` : "sem bimestre"}${a.peso !== 1 ? ` · peso ${DS.nota(a.peso, a.peso % 1 ? 1 : 0)}` : ""}` : `peso ${DS.nota(a.peso, a.peso % 1 ? 1 : 0)}`;
  b.innerHTML = `<span class="dc-av-nota">${a.n10 == null ? (a.data && a.data >= hojeISO() ? `<small>${quandoTxt(a.data)}</small>` : "?") : `${DS.nota(a.nota, a.nota % 1 ? 1 : 0)}<small>de ${DS.nota(a.max, a.max % 1 ? 1 : 0)}</small>`}</span>
    <span class="dc-tx"><b>${escapar(a.titulo)}</b><small>${escapar(DS.TIPOS[a.tipo] || "")}${a.data ? ` · ${dataBR(a.data)}` : ""} · ${peso}${a.auto ? " · da Agenda" : ""}</small></span>`;
  b.onclick = () => editarAvaliacao(d, a);
  return b;
}

async function editarAvaliacao(d, a) {
  const nova = !a;
  a ||= { titulo: "", tipo: "prova", data: "", peso: 1, bim: null, nota: null, max: 10 };
  const bimestral = d.composicao === "bimestres";
  const f = await formulario({
    titulo: nova ? "Nova avaliação" : a.titulo,
    campos: [
      { id: "titulo", rotulo: "Nome", tipo: "text", valor: a.titulo, placeholder: "Ex.: 1ª prova teórica" },
      { id: "tipo", rotulo: "Tipo", tipo: "select", valor: a.tipo || "prova", opcoes: Object.entries(DS.TIPOS) },
      { id: "data", rotulo: "Data (opcional)", tipo: "date", valor: a.data || "" },
      { id: "peso", rotulo: "Peso", tipo: "number", valor: a.peso ?? 1, passo: "0.1", dica: bimestral ? "Dentro do bimestre." : "Na média da disciplina (o do plano de ensino)." },
      { id: "bim", rotulo: "Bimestre", tipo: "select", valor: String(a.bim || ""), opcoes: [["", "—"], ["1", "1º"], ["2", "2º"], ["3", "3º"], ["4", "4º"]] },
      { id: "nota", rotulo: "Nota", tipo: "number", valor: a.nota ?? "", passo: "0.1", dica: a.agenda ? "Lançar aqui também lança na Agenda (com o XP)." : "" },
      { id: "max", rotulo: "Nota máxima", tipo: "number", valor: a.max || 10, passo: "0.1" },
    ],
    botoes: nova ? [{ texto: "Adicionar", acao: "salvar" }] : [{ texto: "Salvar", acao: "salvar" }, { texto: "Tirar da conta", acao: "tirar", classe: "secundario" }],
  });
  if (!f) return;
  if (f._acao === "tirar") {
    const ok = await modal({ titulo: "Tirar da conta?", texto: a.auto ? "Esta prova da Agenda deixa de contar na média desta disciplina (continua na Agenda)." : "A avaliação sai desta disciplina.", botoes: [{ texto: "Tirar", valor: true }, { texto: "Manter", valor: false, classe: "secundario" }] });
    if (ok) { DS.tirarAvaliacaoDisc(d.id, a); aoMudar(); }
    return telaDisciplina();
  }
  if (!f.titulo) { toast("Dê um nome à avaliação."); return telaDisciplina(); }
  const max = f.max > 0 ? f.max : 10, peso = f.peso != null && f.peso >= 0 ? f.peso : 1;
  if (f.nota != null && (f.nota < 0 || f.nota > max)) { toast(`A nota vai de 0 a ${DS.nota(max, max % 1 ? 1 : 0)}.`); return telaDisciplina(); }
  const campos = { ...(a.id ? { id: a.id } : {}), titulo: f.titulo, tipo: f.tipo, data: f.data || "", peso, bim: f.bim ? Number(f.bim) : null };
  if (a.agenda) {
    // a nota fica na avaliação da Agenda (com o XP de lançar a nota); aqui, o peso e o bimestre
    DS.salvarAvaliacaoDisc(d.id, { ...campos, av: a.av, nota: null });
    if (f.nota != null && (f.nota !== a.agenda.nota || max !== (a.agenda.notaMax || 10))) {
      const rr = lancarNota(a.agenda, f.nota, max);
      if (rr?.xp) { tocar(f.nota / max >= 0.7 ? "fim" : "moeda"); toast(`+${rr.xp} XP e +${rr.moedas} moedas${rr.gemas ? ` e +${rr.gemas} gemas` : ""}`); }
    }
  } else DS.salvarAvaliacaoDisc(d.id, { ...campos, nota: f.nota, max, notaAMao: f.nota != null });
  aoMudar(); telaDisciplina();
}

async function editarDisciplina(d) {
  const r = DS.regraDe(d);
  const f = await formulario({
    titulo: "Editar disciplina",
    campos: [
      { id: "curto", rotulo: "Nome curto", tipo: "text", valor: d.curto || "" },
      { id: "professores", rotulo: "Professores (separados por vírgula)", tipo: "text", valor: (d.professores || []).join(", ") },
      { id: "periodo", rotulo: "Período", tipo: "select", valor: d.periodo || "", opcoes: [["", "—"], ...Object.entries(DS.PERIODOS)] },
      { id: "ch", rotulo: "Carga horária total (horas)", tipo: "number", valor: d.ch?.total ?? "", dica: "A do plano de ensino; vazio: estimada pela Agenda." },
      { id: "faltasAntes", rotulo: "Faltas antes do registro (horas)", tipo: "number", valor: d.faltasAntes ?? "", passo: "0.5", dica: "As do começo do ano, que a Agenda não viu." },
      { id: "composicao", rotulo: "Como a média é feita", tipo: "select", valor: d.composicao || "ponderada", opcoes: [["ponderada", "Média ponderada pelos pesos"], ["bimestres", "Média dos bimestres"]] },
      { id: "aprovacao", rotulo: "Média para aprovação direta", tipo: "number", valor: r.aprovacao, passo: "0.1" },
      { id: "exameMin", rotulo: "Média mínima para o exame", tipo: "number", valor: r.exameMin, passo: "0.1" },
      { id: "final", rotulo: "Média final depois do exame", tipo: "number", valor: r.final, passo: "0.1" },
      { id: "frequencia", rotulo: "Frequência mínima (%)", tipo: "number", valor: r.frequencia },
      { id: "obs", rotulo: "Observação", tipo: "textarea", valor: d.obs || "" },
    ],
  });
  if (!f) return;
  // só o que difere da regra do ano (a da UNIOESTE ou a do pacote); os pesos do exame e a fonte do plano ficam
  const padrao = DS.regraDe(null), regra = {};
  for (const k of ["pesoMedia", "pesoExame", "fonte"]) if (d.regra?.[k] != null) regra[k] = d.regra[k];
  for (const k of ["aprovacao", "exameMin", "final", "frequencia"]) if (f[k] != null && f[k] !== padrao[k]) regra[k] = f[k];
  DS.salvarDisciplina(d.id, {
    curto: f.curto, professores: f.professores ? f.professores.split(",").map(x => x.trim()).filter(Boolean) : [], periodo: f.periodo || null,
    ch: f.ch > 0 ? { ...(d.ch || {}), total: f.ch } : null, faltasAntes: f.faltasAntes > 0 ? f.faltasAntes : 0, composicao: f.composicao,
    regra, obs: f.obs,
  });
  aoMudar(); toast("Disciplina salva."); telaDisciplina();
}
