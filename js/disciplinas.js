// Disciplinas do ano (pedido do Alediov, 02/11/2026: "uma aba chamada Disciplinas em Estudos, com todas as disciplinas
// que tenho no 2.° ano com a média de nota, quantos pontos faltam para a aprovação, quantidade de faltas, etc. … Depois
// eu te passo todas as minhas notas e os planos de ensino de cada matéria. Isso será mais útil no meu 3.° ano").
//
// De onde vem cada coisa:
//  - as disciplinas: o pacote `disciplinas` (config/disciplinas.json: nome, professores, carga horária, período, regra e
//    as avaliações do plano de ensino, com peso e bimestre) e, enquanto ele não traz uma, as aulas da Agenda (itens que não
//    são atividade) e as avaliações da Agenda;
//  - as notas: as avaliações da Agenda (pacote `agenda`, "Lançar nota") ligadas pelo id (`av`) ou lançadas aqui;
//  - as faltas: o "Faltei" da Agenda (presencas), em horas pelo horário da aula, mais as `faltasAntes` (antes do registro).
//
// Regras (padrão; cada disciplina pode ter as suas no pacote ou no app, porque o plano de ensino pode ter pesos próprios):
// Regimento Geral da Unioeste (Anexo I da Res. nº 069/2004-COU, texto citado no Edital nº 002/2016 do PROVOU,
// webcon.unioeste.br/portal/publicacoes/2016/provou/002.pdf):
//  - art. 102, § 1º: frequência de, no mínimo, 75% do total das atividades de cada disciplina;
//  - art. 104: notas de 0 a 100 (o app mostra de 0 a 10: 70 = 7,0);
//  - art. 105, I e II: aprovado com média da disciplina ≥ 70 e a frequência;
//  - art. 105, § 1º: média < 70 e ≥ 40 (com a frequência) → exame final;
//  - art. 105, III, a: depois do exame, aprovado com MF = (MD × 6 + NE × 4) ÷ 10 ≥ 60;
//  - art. 105, § 2º: sem a frequência ou sem a média → reprovado.
//
// Estado em E().disciplinas { cfg: { ano, serie, regra, em }, lista: { [id]: disciplina } } (sincroniza entre aparelhos).
// Cada disciplina guardada é um registro com `em`: a junção (juntar.js) fica com a mais recente inteira (assim um peso ou
// uma nota mexida nos dois aparelhos nunca é somada). `aMao`: os campos que ele mudou no app (o pacote não sobrescreve).
import { E, hojeISO, somaDias, marcarVidaSuja } from "./estado.js";
import { A, eventosDoDia } from "./agenda.js";

export const REGRA_UNIOESTE = { aprovacao: 7, exameMin: 4, final: 6, pesoMedia: 6, pesoExame: 4, frequencia: 75 };
export const FONTE_REGRA = "Regimento Geral da Unioeste (Anexo I da Res. 069/2004-COU): art. 102, § 1º, e art. 105";
export const TIPOS = { prova: "Prova", pratica: "Prova prática", trabalho: "Trabalho", seminario: "Seminário", outro: "Outra" };
const TIPOS_COM_NOTA = ["prova", "pratica", "trabalho", "seminario"];
export const PERIODOS = { anual: "Anual", "1sem": "1º semestre", "2sem": "2º semestre" };
export const ESTADOS = {
  aprovado: ["Aprovado", "ok"], garantido: ["Média garantida", "ok"], em_curso: ["Em curso", ""], risco: ["Atenção", "alerta"],
  exame: ["Exame final", "alerta"], exame_certo: ["Vai para o exame", "alerta"], reprovado: ["Reprovado", "ruim"],
  reprovado_certo: ["Sem como passar", "ruim"], reprovado_falta: ["Reprovado por falta", "ruim"], sem_avaliacoes: ["Sem avaliações", ""],
};

const dobrar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "e").replace(/[^a-z0-9]+/g, " ").trim();
export const idDe = (nome) => dobrar(nome).replace(/ /g, "-").slice(0, 40) || "disciplina";
const agora = () => new Date().toISOString();
const r1 = (v) => Math.round(v * 10) / 10;
const horas = (ini, fim) => { if (!ini || !fim) return 0; const [a, b] = ini.split(":").map(Number), [c, d] = fim.split(":").map(Number); return Math.max(0, (c * 60 + d - a * 60 - b) / 60); };

export function D() {
  const e = E();
  e.disciplinas ||= {};
  e.disciplinas.lista ||= {};
  return e.disciplinas;
}
/** O ano letivo: o do pacote, ou o do semestre da Agenda em que hoje cai (ou o último que já começou). */
export function anoLetivo(hoje = hojeISO()) {
  const cfg = D().cfg;
  if (cfg?.ano) return Number(cfg.ano);
  const ss = (A().calendario?.semestres || []).filter(s => s.inicio <= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio));
  return Number((ss.at(-1)?.inicio || hoje).slice(0, 4));
}
export const regraDe = (disc) => ({ ...REGRA_UNIOESTE, ...(D().cfg?.regra || {}), ...(disc?.regra || {}) });
export const mesmoNome = (disc, nome) => !!nome && [disc.nome, ...(disc.apelidos || [])].some(n => dobrar(n) === dobrar(nome));

/** As disciplinas do ano: as guardadas (pacote ou app) e as que a Agenda conhece (aulas e avaliações), sem repetir. */
export function disciplinasDoAno(ano = anoLetivo()) {
  const guardadas = Object.values(D().lista).filter(x => !x.apagada && Number(x.ano || ano) === ano);
  const out = [...guardadas];
  const ja = (nome) => out.some(x => mesmoNome(x, nome));
  for (const it of A().itens || []) {
    if (it.tipo === "A" || ja(it.nome)) continue;
    if (Object.values(D().lista).some(x => x.apagada && mesmoNome(x, it.nome))) continue;
    out.push({ id: idDe(it.nome), nome: it.nome, curto: it.curto || "", ano, virtual: true });
  }
  for (const av of E().avaliacoes || []) {
    if (!av.disciplina || ja(av.disciplina) || Number((av.data || "").slice(0, 4)) !== ano) continue;
    out.push({ id: idDe(av.disciplina), nome: av.disciplina, curto: "", ano, virtual: true });
  }
  return out;
}
export function disciplina(id) {
  return D().lista[id] || disciplinasDoAno().find(x => x.id === id) || null;
}

/** As avaliações da disciplina: as dela (do plano de ensino, com peso e bimestre, podendo apontar para uma da Agenda pelo
 *  `av`) e as da Agenda ainda sem par (peso 1, até o plano chegar). Cada uma com a nota de 0 a 10 em `n10` (ou null). */
export function avaliacoesDe(disc) {
  const agenda = E().avaliacoes || [], porId = new Map(agenda.map(a => [a.id, a]));
  const proprias = (disc.avaliacoes || []).filter(a => !a.apagada);
  const ligadas = new Set(proprias.map(a => a.av).filter(Boolean)), ignorar = new Set(disc.ignorar || []);
  const out = proprias.map(a => {
    const g = a.av ? porId.get(a.av) : null;
    const nota = a.nota != null ? a.nota : g?.nota ?? null, max = a.nota != null ? (a.max || 10) : (g?.notaMax || 10);
    return { ...a, titulo: a.titulo || g?.titulo || TIPOS[a.tipo || g?.tipo] || "Avaliação", tipo: a.tipo || g?.tipo || "prova", data: a.data || g?.data || "",
      peso: Number.isFinite(+a.peso) && a.peso !== "" && a.peso != null ? +a.peso : 1, nota, max, n10: nota == null ? null : (nota / max) * 10, agenda: g || null };
  });
  for (const g of agenda) {
    if (!mesmoNome(disc, g.disciplina) || !TIPOS_COM_NOTA.includes(g.tipo) || ligadas.has(g.id) || ignorar.has(g.id)) continue;
    const max = g.notaMax || 10;
    out.push({ id: `ag:${g.id}`, av: g.id, titulo: g.titulo || TIPOS[g.tipo], tipo: g.tipo, data: g.data || "", peso: 1, bim: null, nota: g.nota ?? null, max,
      n10: g.nota == null ? null : (g.nota / max) * 10, agenda: g, auto: true });
  }
  return out.sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999") || String(a.titulo).localeCompare(String(b.titulo)));
}
/** Os pesos que valem na conta: na composição "bimestres", a média de cada bimestre (pelos pesos dentro dele) vezes o
 *  peso do bimestre (`pesosBim`, padrão 1); senão, o peso de cada uma (média ponderada). */
function pesosEfetivos(disc, avs) {
  if (disc.composicao !== "bimestres") return avs.map(a => Math.max(0, a.peso));
  const soma = {};
  for (const a of avs) soma[a.bim ?? 0] = (soma[a.bim ?? 0] || 0) + Math.max(0, a.peso);
  return avs.map(a => { const b = a.bim ?? 0, pb = Number(disc.pesosBim?.[b] ?? 1); return soma[b] ? (pb * Math.max(0, a.peso)) / soma[b] : 0; });
}

/** Carga horária pela Agenda (enquanto o plano de ensino não diz): as horas de todas as aulas da disciplina nos semestres
 *  do ano que o calendário conhece. Numa disciplina anual com um semestre só no calendário, o dobro dele. */
const memoCarga = new Map();
export function cargaPelaAgenda(disc, ano = Number(disc.ano) || anoLetivo()) {
  const chave = `${disc.nome}|${ano}|${hojeISO()}|${(A().itens || []).length}`;
  if (memoCarga.has(chave)) return memoCarga.get(chave);
  const sems = (A().calendario?.semestres || []).filter(s => Number(s.inicio.slice(0, 4)) === ano);
  let h = 0;
  for (const s of sems) for (let d = s.inicio; d <= s.fim; d = somaDias(d, 1))
    for (const ev of eventosDoDia(d)) if (ev.item.tipo !== "A" && mesmoNome(disc, ev.item.nome)) h += horas(ev.inicio, ev.fim);
  const dobro = disc.periodo === "anual" && sems.length === 1;
  const r = h ? { horas: dobro ? h * 2 : h, semestres: sems.map(s => s.nome), dobro } : null;
  memoCarga.set(chave, r);
  return r;
}

/** Faltas pela Agenda (o "Faltei" das aulas desta disciplina), em aulas e em horas, mais as anteriores ao registro. */
export function frequenciaDe(disc, regra = regraDe(disc)) {
  const ag = A(), lista = [];
  let faltas = 0, faltasH = 0, pres = 0, presH = 0;
  for (const [chave, st] of Object.entries(ag.presencas || {})) {
    if (st !== "falta" && st !== "presente") continue;
    const [id, data] = chave.split("|"), it = (ag.itens || []).find(i => i.id === id);
    if (!it || it.tipo === "A" || !mesmoNome(disc, it.nome) || (disc.ano && Number(data.slice(0, 4)) !== Number(disc.ano))) continue;
    const exc = ag.excecoes?.[chave], h = horas(exc?.inicio || it.inicio, exc?.fim || it.fim);
    if (st === "falta") { faltas++; faltasH += h; lista.push({ data, h, tipo: it.tipo, chave }); } else { pres++; presH += h; }
  }
  const antes = Math.max(0, Number(disc.faltasAntes) || 0);
  const ch = Number(disc.ch?.total) > 0 ? Number(disc.ch.total) : null, est = ch ? null : cargaPelaAgenda(disc);
  const base = ch || est?.horas || null;
  const limite = base ? base * (1 - regra.frequencia / 100) : null;
  const total = faltasH + antes;
  const pct = base ? Math.max(0, 100 * (1 - total / base)) : presH + faltasH ? (100 * presH) / (presH + faltasH) : null;
  return { faltas, faltasH, antes, total, pres, presH, ch, estimada: est, base, limite, resta: limite != null ? limite - total : null, pct,
    reprovado: limite != null && total > limite + 1e-9, perto: limite != null && total > limite * 0.75, lista: lista.sort((a, b) => b.data.localeCompare(a.data)) };
}

/** A conta da disciplina: média (das que têm nota), o que falta para a aprovação direta, a situação, o exame e as faltas. */
export function calcular(disc, hoje = hojeISO()) {
  const regra = regraDe(disc), avs = avaliacoesDe(disc), pesos = pesosEfetivos(disc, avs);
  let pT = 0, pF = 0, soma = 0;
  avs.forEach((a, i) => { const p = pesos[i]; a.pesoEf = p; if (!(p > 0)) return; pT += p; if (a.n10 != null) { pF += p; soma += a.n10 * p; } });
  const media = pF ? soma / pF : null, resto = pT - pF, completa = pT > 0 && resto < 1e-9;
  const faltam = avs.filter((a, i) => a.n10 == null && pesos[i] > 0);
  const precisa = resto > 1e-9 ? (regra.aprovacao * pT - soma) / resto : null; // média nas que faltam para a aprovação direta
  const pontos = Math.max(0, regra.aprovacao * pT - soma); // os pontos (ponderados) que faltam
  const maximo = pT ? (soma + 10 * resto) / pT : null; // a média com 10 em todas as que faltam
  const freq = frequenciaDe(disc, regra);
  const md = completa ? soma / pT : media;
  const exameNota = disc.exame?.nota != null ? (disc.exame.nota / (disc.exame.max || 10)) * 10 : null;
  const precisaExame = md == null ? null : (regra.final * (regra.pesoMedia + regra.pesoExame) - regra.pesoMedia * md) / regra.pesoExame;
  const mf = completa && exameNota != null ? (md * regra.pesoMedia + exameNota * regra.pesoExame) / (regra.pesoMedia + regra.pesoExame) : null;
  let estado;
  if (freq.reprovado) estado = "reprovado_falta";
  else if (!pT) estado = "sem_avaliacoes";
  else if (completa) estado = md >= regra.aprovacao - 1e-9 ? "aprovado" : md >= regra.exameMin - 1e-9 ? (mf != null ? (mf >= regra.final - 1e-9 ? "aprovado" : "reprovado") : "exame") : "reprovado";
  else if (soma / pT >= regra.aprovacao - 1e-9) estado = "garantido";
  else if (maximo < regra.exameMin - 1e-9) estado = "reprovado_certo";
  else if (precisa > 10 + 1e-9) estado = "exame_certo";
  else if (precisa > 8.5 || (media != null && precisa > media + 1.5) || freq.perto) estado = "risco";
  else estado = "em_curso";
  const proxima = avs.filter(a => a.n10 == null && a.data && a.data >= hoje).sort((a, b) => a.data.localeCompare(b.data))[0] || null;
  return { regra, avs, media, md, completa, pT, pF, soma, resto, faltam, precisa, pontos, maximo, precisaExame, exameNota, mf, freq, estado, proxima };
}

/** "7,5" (uma casa, vírgula). */
export const nota = (v, casas = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));
export const horasTxt = (h) => (h == null ? "—" : `${String(r1(h)).replace(".", ",")} h`);

// ---------------------------------------------------------------- edição (no app)
function avisar() { marcarVidaSuja(); window.dispatchEvent(new Event("oq-disciplinas")); }
/** A disciplina guardada (cria a partir da virtual na primeira mudança). */
function guardada(id) {
  const d = D();
  if (!d.lista[id]) {
    const v = disciplinasDoAno().find(x => x.id === id) || { id, nome: id };
    const { virtual, ...resto } = v;
    d.lista[id] = { ...resto, avaliacoes: [], origem: "app", em: agora() };
  }
  return d.lista[id];
}
/** Muda campos da disciplina (nome curto, professores, carga horária, período, regra, faltas antes do registro…). */
export function salvarDisciplina(id, campos) {
  const x = guardada(id);
  Object.assign(x, campos);
  x.aMao = [...new Set([...(x.aMao || []), ...Object.keys(campos)])];
  x.em = agora(); avisar();
  return x;
}
/** Grava uma avaliação da disciplina. `a.id` "ag:<id>" (uma da Agenda sem par) vira uma avaliação própria ligada a ela. */
export function salvarAvaliacaoDisc(discId, a) {
  const x = guardada(discId), l = (x.avaliacoes ||= []);
  let id = a.id;
  if (!id || String(id).startsWith("ag:")) id = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const { agenda, n10, pesoEf, auto, ...limpo } = a;
  const novo = { ...limpo, id };
  const i = l.findIndex(y => y.id === id);
  if (i >= 0) l[i] = { ...l[i], ...novo }; else l.push(novo);
  x.em = agora(); avisar();
  return novo;
}
/** Tira uma avaliação da conta: a própria sai; a da Agenda (sem par) fica de fora desta disciplina. */
export function tirarAvaliacaoDisc(discId, a) {
  const x = guardada(discId);
  if (String(a.id).startsWith("ag:")) x.ignorar = [...new Set([...(x.ignorar || []), a.av])];
  else x.avaliacoes = (x.avaliacoes || []).filter(y => y.id !== a.id);
  x.em = agora(); avisar();
}
export function lancarExame(discId, notaExame, max = 10) {
  const x = guardada(discId);
  if (notaExame == null) delete x.exame; else x.exame = { nota: notaExame, max };
  x.em = agora(); avisar();
}

// ---------------------------------------------------------------- pacote `disciplinas` (config/disciplinas.json)
/** Aplica o pacote: a configuração do ano (ano, série, regra padrão) e cada disciplina pelo `id` (ou pelo nome). Os campos
 *  que ele mudou no app (`aMao`) ficam; as avaliações entram e se atualizam pelo `id`, sem apagar a nota lançada no app. */
export function aplicarPacoteDisciplinas(pkg) {
  const d = D(), quando = agora();
  if (pkg.ano || pkg.regra || pkg.serie) d.cfg = { ...(d.cfg || {}), ...(pkg.ano ? { ano: pkg.ano } : {}), ...(pkg.serie ? { serie: pkg.serie } : {}), ...(pkg.regra ? { regra: limparRegra(pkg.regra) } : {}), em: quando };
  for (const x of pkg.disciplinas || []) {
    const id = x.id || idDe(x.nome), atual = d.lista[id] || Object.values(d.lista).find(y => mesmoNome(y, x.nome));
    const base = { ...x, id: atual?.id || id, ano: x.ano || pkg.ano || atual?.ano || anoLetivo() };
    if (base.regra) base.regra = limparRegra(base.regra);
    if (!atual) { d.lista[base.id] = { ...base, avaliacoes: (x.avaliacoes || []).map(a => ({ ...a })), origem: "pacote", em: quando }; continue; }
    const aMao = new Set(atual.aMao || []), novo = { ...atual };
    for (const [k, v] of Object.entries(base)) if (k !== "avaliacoes" && !aMao.has(k)) novo[k] = v;
    const avs = [...(atual.avaliacoes || [])];
    for (const a of x.avaliacoes || []) {
      const i = avs.findIndex(y => y.id === a.id);
      if (i < 0) avs.push({ ...a });
      else avs[i] = { ...avs[i], ...a, ...(avs[i].notaAMao ? { nota: avs[i].nota, max: avs[i].max } : a.nota == null ? { nota: avs[i].nota, max: avs[i].max } : {}) };
    }
    novo.avaliacoes = avs; novo.em = quando;
    d.lista[novo.id] = novo;
  }
  memoCarga.clear();
}
function limparRegra(r) {
  const out = {};
  for (const k of Object.keys(REGRA_UNIOESTE)) if (Number.isFinite(+r[k]) && r[k] !== null && r[k] !== "") out[k] = +r[k];
  if (r.fonte) out.fonte = String(r.fonte);
  return out;
}
