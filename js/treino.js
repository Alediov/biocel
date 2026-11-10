// Contas da aba Treino (pedido do Alediov, 04/11/2026: a aba tinha cartões demais e repetidos). Sem DOM: a tela fica em
// telaTreino.js. Três coisas:
// - Treino do dia: UM treino só no lugar de "Revisão do dia", "Erros da semana" e "Meus erros": mistura o que está no
//   ponto da revisão espaçada, os erros da semana (os que ainda não foram acertados depois) e erros antigos, puxando para
//   o recorte da próxima prova. Aos domingos continua valendo o bônus da semana (E().treinoDomingo).
// - Treino por disciplina: disciplina → capítulos e unidades (títulos de dados/unidades.json), com o acerto na 1ª
//   tentativa de cada uma. A última escolha fica em config.treinoEscolha.
// - Simulado da próxima prova: 20 questões só do recorte, ~1 min cada, tipos misturados, sem retorno até o fim
//   (licao.js, modo prova). O histórico fica em E().simProva[id] = { av, nome, data, nota, acertos, total, seg, min,
//   esgotou, unidades: { u: [certas, total] }, erros: [ids], em }: um registro por simulado, com id próprio e `em`, então
//   a sincronia junta os dois aparelhos pela união das chaves (juntar.js) sem somar nem perder nenhum.
import { E, salvar, hojeISO, somaDias, difDias, devidosHoje } from "./estado.js";
import { primeiras, errosDaSemana } from "./raioX.js";

// ---------- unidades e disciplinas ----------
/** A unidade de uma questão (ex.: "c14-03"); revisões de capítulo sem unidade ficam em "<cap>-rv". */
export function unidadeDoEx(ex) {
  const id = ex?.id || "";
  const m = id.match(/^[a-z]\d\d-\d\d/); if (m) return m[0];
  const u = ex?.fonte?.unidade;
  if (typeof u === "string" && /^[a-z]\d\d-\d\d$/.test(u)) return u;
  const c = id.match(/^([a-z]\d\d)-/); if (c) return `${c[1]}-rv`;
  if (id.startsWith("metep")) return "metep";
  if (id.startsWith("semio") || id.startsWith("s-")) return "semio";
  if (id.startsWith("ev-")) return `ev-${id.split("-")[1] || "x"}`;
  return id.split("-")[0] || "outros";
}
/** O capítulo (ou grupo) de uma unidade: "c14", "metep", "semio", "ev-sb"… */
export const capDe = (u) => u.match(/^[a-z]\d\d/)?.[0] || u;

export const DISCIPLINAS = [
  { id: "anestesio", nome: "Anestesiologia", fonte: "Malamed", icone: "💉", casa: (u) => /^c\d/.test(u) },
  { id: "pato", nome: "Patologia", fonte: "Neville", icone: "🔬", casa: (u) => /^n\d/.test(u) },
  { id: "farmaco", nome: "Farmacologia", fonte: "Andrade", icone: "💊", casa: (u) => /^f\d/.test(u) },
  { id: "perio", nome: "Periodontia", fonte: "Lindhe", icone: "🦷", casa: (u) => /^l\d/.test(u) },
  { id: "semio", nome: "Semiologia", fonte: "Burket e notas", icone: "🩺", casa: (u) => /^b\d/.test(u) || u === "semio" },
  { id: "metep", nome: "METEP", fonte: "Metodologia da pesquisa", icone: "📚", casa: (u) => u === "metep" },
  { id: "eventos", nome: "Seminários", fonte: "Eventos acadêmicos", icone: "🎤", casa: (u) => u.startsWith("ev-") },
];
export const disciplinaDe = (u) => DISCIPLINAS.find(d => d.casa(u)) || null;
/** Ícone da disciplina de uma avaliação da Agenda (pelo recorte; senão pelo nome). */
export function iconeDaProva(av) {
  const d = av.recorte?.length ? disciplinaDe(capDe(av.recorte[0].replace(/-$/, ""))) : null;
  if (d) return d.icone;
  return /patolog/i.test(av.disciplina || "") ? "🔬" : /anest/i.test(av.disciplina || "") ? "💉" : /semio|radio/i.test(av.disciplina || "") ? "🩺" : "📝";
}

const NOMES_GRUPO = { metep: "Notas de METEP", semio: "Notas de Semiologia", "ev-sb": "Seminário de biópsia", "ev-sbx": "Seminário de biópsia (revisão)" };
export function nomeDaUnidade(u, T = {}) {
  if (T[u]) return T[u];
  if (u.endsWith("-rv")) return `Revisão do cap. ${+u.slice(1, 3)}`;
  return NOMES_GRUPO[u] || u;
}
export function nomeDoCap(cap, T = {}) {
  if (/^[a-z]\d\d$/.test(cap)) return `Cap. ${+cap.slice(1)}`;
  return NOMES_GRUPO[cap] || T[cap] || cap;
}

/** Disciplinas com questões no banco: [{ ...disciplina, total, caps: [{ id, nome, total, vistas, certas, unidades: [{ id, nome, total, vistas, certas }] }] }]. */
export function mapaDisciplinas(banco, T = {}) {
  const prim = primeiras(), por = new Map();
  for (const [id, ex] of banco) {
    const u = unidadeDoEx(ex), d = disciplinaDe(u); if (!d) continue;
    const o = por.get(d.id) || por.set(d.id, { ...d, total: 0, caps: new Map() }).get(d.id);
    const cId = capDe(u), cap = o.caps.get(cId) || o.caps.set(cId, { id: cId, nome: nomeDoCap(cId, T), total: 0, vistas: 0, certas: 0, unidades: new Map() }).get(cId);
    const un = cap.unidades.get(u) || cap.unidades.set(u, { id: u, nome: nomeDaUnidade(u, T), total: 0, vistas: 0, certas: 0 }).get(u);
    const r = prim.get(id);
    for (const x of [o, cap, un]) x.total++;
    if (r) for (const x of [cap, un]) { x.vistas++; if (r.acertou) x.certas++; }
  }
  return DISCIPLINAS.filter(d => por.has(d.id)).map(d => {
    const o = por.get(d.id);
    const caps = [...o.caps.values()].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }))
      .map(c => ({ ...c, unidades: [...c.unidades.values()].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true })) }));
    return { ...o, caps };
  });
}

/** A seleção vale para a unidade? `sel`: ids de capítulos ("c14") e de unidades ("c13-02"); vazia = a disciplina toda. */
export const naSelecao = (u, sel) => !sel?.length || sel.some(s => s === u || s === capDe(u));

/** Peso para escolher entre questões: errada na última vez, nunca vista, pouco firme na revisão. */
function peso(id, prim, srs) {
  const s = srs[id], r = prim.get(id);
  return (r && !r.acertou ? 3 : 0) + (!r ? 1.5 : 0) + (s ? 3 - Math.min(3, s.caixa) : 1) + Math.random() * 2;
}
const embaralhar = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Questões de uma disciplina (e da seleção dela), as mais úteis primeiro e misturadas por unidade. */
export function questoesDaDisciplina(banco, discId, sel, n = 10) {
  const d = DISCIPLINAS.find(x => x.id === discId); if (!d) return [];
  const prim = primeiras(), srs = E().srs || {};
  const ids = [...banco].filter(([, ex]) => { const u = unidadeDoEx(ex); return d.casa(u) && naSelecao(u, sel); }).map(([id]) => id);
  return embaralhar(ids.map(id => [id, peso(id, prim, srs)]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id));
}
export function contarSelecao(banco, discId, sel) {
  const d = DISCIPLINAS.find(x => x.id === discId); if (!d) return 0;
  let n = 0; for (const [, ex] of banco) { const u = unidadeDoEx(ex); if (d.casa(u) && naSelecao(u, sel)) n++; }
  return n;
}
export function escolhaGuardada() { return E().config?.treinoEscolha || null; }
export function guardarEscolha(o) { E().config.treinoEscolha = { ...(E().config.treinoEscolha || {}), ...o }; salvar(); }

// ---------- provas ----------
/** Avaliações com recorte de hoje até `dias` à frente (sem seminário nem 2ª chamada), as mais próximas primeiro. */
export function proximasProvas(hoje = hojeISO(), dias = 30) {
  return (E().avaliacoes || []).filter(a => a.recorte?.length && a.data >= hoje && a.data <= somaDias(hoje, dias) && !["seminario", "outro"].includes(a.tipo))
    .sort((a, b) => a.data.localeCompare(b.data));
}
export const casaRecorte = (id, recorte) => !!recorte?.some(p => id.startsWith(p));
const dataCurta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Nome curto da prova: a disciplina do recorte (a de "Radiologia & Semiologia" com recorte do Burket é Semiologia). */
export function nomeProva(av) {
  const d = av.recorte?.length ? disciplinaDe(capDe(av.recorte[0].replace(/-$/, ""))) : null;
  return d?.nome || (av.disciplina || av.titulo || "prova").split(" & ")[0];
}

// ---------- Treino do dia ----------
/** Monta o treino do dia: { ids, partes: { revisao, semana, antigos, prova, recentes }, daProva, prova, n }. */
export function montarTreinoDoDia(banco, { hoje = hojeISO(), prova = proximasProvas(hoje)[0] || null } = {}) {
  const est = E(), srs = est.srs || {}, prim = primeiras();
  const domingo = new Date(hoje + "T12:00").getDay() === 0;
  const naProva = (id) => !!prova && casaRecorte(id, prova.recorte);
  const perto = prova ? difDias(hoje, prova.data) <= 21 : false;
  const bonusProva = prova ? (perto ? 3 : 1.5) : 0;
  const ja = new Set(), cand = [];
  const por = (pool, base, ids) => { for (const id of ids) if (banco.has(id) && !ja.has(id)) { ja.add(id); cand.push({ id, pool, nota: base(id) + (naProva(id) ? bonusProva : 0) + Math.random() * 1.5 }); } };
  // erros da semana que ainda não foram acertados depois (a última 1ª tentativa continua errada)
  por("semana", () => (domingo ? 9 : 6), errosDaSemana(banco, 40).filter(id => prim.get(id)?.acertou === false));
  const devidos = devidosHoje();
  por("revisao", (id) => 5 + Math.min(3, srs[id]?.erros || 0) * 0.3, devidos);
  // erros antigos: os menos firmes primeiro
  por("antigos", (id) => 3 + Math.max(0, 2 - (srs[id]?.caixa || 0)) * 0.5,
    Object.entries(srs).filter(([, s]) => s.erros > 0 && (s.caixa || 0) <= 3).sort((a, b) => (a[1].caixa - b[1].caixa) || (b[1].erros - a[1].erros)).slice(0, 60).map(([id]) => id));
  // completar: o recorte da próxima prova (o que ainda não está firme) e o que entrou na trilha nos últimos 10 dias
  if (prova) por("prova", () => 2, [...banco.keys()].filter(id => naProva(id) && (srs[id]?.caixa || 0) < 3));
  por("recentes", () => 1, [...banco].filter(([id, ex]) => ex._data && ex._data >= somaDias(hoje, -10) && ex._data <= hoje && (srs[id]?.caixa || 0) < 3).map(([id]) => id));
  const fortes = cand.filter(c => ["semana", "revisao", "antigos"].includes(c.pool)).length;
  const n = domingo || fortes > 20 ? 15 : 12;
  const teto = { semana: domingo ? 10 : 5, revisao: 7, antigos: 4, prova: 6, recentes: 6 };
  const usados = {}, ids = [];
  for (const c of cand.sort((a, b) => b.nota - a.nota)) {
    if (ids.length >= n) break;
    if ((usados[c.pool] || 0) >= teto[c.pool]) continue;
    usados[c.pool] = (usados[c.pool] || 0) + 1; ids.push(c.id);
  }
  if (ids.length < n) for (const c of cand) { if (ids.length >= n) break; if (!ids.includes(c.id)) { usados[c.pool] = (usados[c.pool] || 0) + 1; ids.push(c.id); } } // sobrou espaço: sem teto
  return { ids: embaralhar(ids), partes: usados, daProva: ids.filter(naProva).length, prova, domingo, n };
}
/** "12 questões · 5 para revisar, 4 erros da semana… · 6 de Anestesiologia (18/11)". */
export function resumoTreinoDoDia(t) {
  if (!t.ids.length) return "Nada para treinar ainda: faça as lições da trilha e volte aqui.";
  const p = t.partes, partes = [
    p.revisao && `${p.revisao} para revisar`, p.semana && `${p.semana} ${p.semana === 1 ? "erro" : "erros"} da semana`,
    p.antigos && `${p.antigos} ${p.antigos === 1 ? "erro antigo" : "erros antigos"}`,
    (p.prova || p.recentes) && `${(p.prova || 0) + (p.recentes || 0)} para firmar`,
  ].filter(Boolean);
  return `${t.ids.length} questões · ${partes.join(", ")}${t.prova && t.daProva ? ` · ${t.daProva} do recorte de ${nomeProva(t.prova)} (${dataCurta(t.prova.data)})` : ""}`;
}
/** Anota o treino do dia feito (E().treinoDia[data] = { vezes, acertos, total, em }; os últimos 14 dias). */
export function anotarTreinoDoDia(r, hoje = hojeISO()) {
  const t = (E().treinoDia ??= {}), a = t[hoje];
  t[hoje] = { vezes: (a?.vezes || 0) + 1, acertos: r?.acertos || 0, total: r?.total || 0, em: new Date().toISOString() };
  for (const d of Object.keys(t)) if (d < somaDias(hoje, -14)) delete t[d];
  salvar();
}
export const treinoDoDiaFeito = (hoje = hojeISO()) => E().treinoDia?.[hoje] || null;

// ---------- simulado da prova ----------
export const TIPOS_SIMULADO = ["multipla", "vf", "lacunas", "ordenar"]; // os que respondem de uma vez (sem retorno no meio)
/** 20 questões do recorte, espalhadas pelas unidades, sem passar de 30% de V ou F. */
export function montarSimulado(banco, av, n = 20) {
  const porU = new Map();
  for (const [id, ex] of banco) {
    if (!casaRecorte(id, av.recorte) || !TIPOS_SIMULADO.includes(ex.tipo)) continue;
    const u = unidadeDoEx(ex); (porU.get(u) || porU.set(u, []).get(u)).push(id);
  }
  const filas = embaralhar([...porU.values()].map(embaralhar));
  const out = [], maxVf = Math.ceil(n * 0.3); let vf = 0;
  for (let volta = 0; out.length < n && filas.some(f => f.length); volta++) {
    for (const f of filas) {
      if (out.length >= n) break;
      const i = f.findIndex(id => banco.get(id).tipo !== "vf" || vf < maxVf);
      if (i < 0) { f.length = 0; continue; }
      const [id] = f.splice(i, 1); if (banco.get(id).tipo === "vf") vf++; out.push(id);
    }
  }
  return embaralhar(out);
}
export const disponiveisSimulado = (banco, av) => [...banco].filter(([id, ex]) => casaRecorte(id, av.recorte) && TIPOS_SIMULADO.includes(ex.tipo)).length;

/** Acertos por unidade de uma lista de respostas do simulado: [{ id, nome, c, t }], as piores primeiro. */
export function porUnidade(lista, banco, T = {}) {
  const m = new Map();
  for (const r of lista) {
    const u = unidadeDoEx(banco.get(r.id) || { id: r.id }), o = m.get(u) || m.set(u, { id: u, nome: nomeDaUnidade(u, T), c: 0, t: 0 }).get(u);
    o.t++; if (r.acertou) o.c++;
  }
  return [...m.values()].sort((a, b) => (a.c / a.t - b.c / b.t) || a.id.localeCompare(b.id));
}
export function guardarSimulado(av, resumo, banco) {
  const p = resumo.prova, s = (E().simProva ??= {});
  const unidades = {}; for (const u of porUnidade(p.respostas, banco)) unidades[u.id] = [u.c, u.t];
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  s[id] = { av: av.id, nome: nomeProva(av), data: hojeISO(), nota: p.nota, acertos: resumo.acertos, total: resumo.total, seg: p.seg, esgotou: !!p.esgotou,
    unidades, erros: p.respostas.filter(r => !r.acertou).map(r => r.id), em: new Date().toISOString() };
  // guarda os 60 mais novos
  const ord = Object.entries(s).sort((a, b) => (b[1].em || "").localeCompare(a[1].em || ""));
  for (const [k] of ord.slice(60)) delete s[k];
  salvar();
  return id;
}
/** Simulados de uma avaliação, o mais novo primeiro. */
export const simuladosDe = (avId) => Object.entries(E().simProva || {}).filter(([, r]) => r.av === avId).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.em || "").localeCompare(a.em || ""));
export const notaTxt = (x) => (+x || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
