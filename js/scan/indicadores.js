// Indicadores da IC (sem DOM): completude do preenchimento das fichas, categorias da Tabela 1 do projeto
// (com o financiamento PAB/FAEC), indicadores de saúde bucal com fórmula, distribuição no tempo e por dente.
// Tudo agregado: nada aqui devolve dado de paciente.
import { procedimento, procDe, idadeNaData } from "./processar.js";
import { PERMANENTE, DECIDUO, PEDE_DENTE, coerencia } from "./analises.js";
import { LIMIAR_PRESENCA } from "./visao.js";
import { ehCascavel } from "./previsao.js";

// ---------------- Tabela 1 do projeto (Procedimentos do SUS, 04/2010, por especialidade) ----------------
// Códigos como no projeto; "equivalentes" são os códigos atuais da SIGTAP que substituíram um código antigo da
// tabela (ex.: a restauração posterior virou "com resina" e "com amálgama"). Códigos que aparecem em duas
// categorias do projeto contam só na primeira (04.01.01.005-8 e 07.01.07.004-8).
export const TABELA1 = [
  ["Prevenção", "PAB", ["0301010153", "0301010048", "0101020058", "0101020066", "0101020074", "0101020082", "0101020090"]],
  ["Radiologia", "", ["0204010160", "0204010217", "0204010225"]],
  ["Dentística", "PAB", ["0307010015", "0307010023", "0307010031", "0307010040"]],
  ["Odontopediatria", "PAB", ["0301100152", "0414020120", "0414020405", "0401010082", "0414020170", "0307020070", "0307020010", "0307020029"]],
  ["Odontopediatria", "FAEC", ["0307020037", "0701070048"]],
  ["Ortodontia", "FAEC", ["0307040127", "0701070013", "0701070021", "0701070030", "0701070064", "0701070080", "0702020010"]],
  ["Próteses fixas", "FAEC", ["0701070056", "0701070145"]],
  ["Periodontia", "FAEC", ["0307030032", "0404020445", "0414020081", "0414020090", "0414020154", "0414020162", "0414020219", "0414020367", "0414020375", "0401010058"]],
  ["Estomatologia", "FAEC", ["0201010232", "0201010526", "0414020200", "0404020097", "0414010361"]],
  ["Patologia", "", ["0203010035", "0203020030", "0203020049"]],
];
// códigos atuais que fazem as vezes de um código da tabela do projeto
export const EQUIVALENTES = {
  "0307010120": "0307010040", "0307010139": "0307010040",                  // restauração permanente posterior (resina, amálgama)
  "0307010082": "0307010023", "0307010090": "0307010023", "0307010104": "0307010023", "0307010112": "0307010023", // restaurações de decíduo
};
export const NOTA_TABELA1 = "Na Tabela 1 do projeto, 02.04.01.018-7 (radiografia periapical/interproximal) foi lido como 02.04.01.021-7 (interproximal) e 02.04.01.022-5 (periapical), e 03.07.04.004-6 (manutenção de aparelho ortodôntico) como 03.07.04.012-7, os códigos em uso na SIGTAP; 04.01.01.005-8 e 07.01.07.004-8, que aparecem em duas categorias, contam só na primeira. Nas fichas, 02.04.01.018-7 aparece como variação de 02.04.01.021-7 (radiografia interproximal) e conta como ele.";
const POR_CODIGO = new Map();
TABELA1.forEach(([cat, fin, cods], k) => cods.forEach(c => { if (!POR_CODIGO.has(c)) POR_CODIGO.set(c, { categoria: cat, financiamento: fin, grupo: k }); }));
const FORA = [["0307040119", "Ortodontia"], ["030702", "Endodontia"], ["0307020", "Endodontia"], ["0414", "Cirurgia"], ["0404", "Cirurgia"], ["0401", "Cirurgia"], ["0406", "Cirurgia"], ["0701", "Prótese removível e aparelhos"], ["0307040", "Prótese removível e aparelhos"], ["0307010", "Dentística"], ["0101", "Prevenção"], ["0301", "Consultas"], ["0204", "Radiologia"], ["02", "Diagnóstico"]];

/**
 * Categoria de um código: { categoria, financiamento, tabela1 (está na tabela do projeto), codigo base }. `cod` pode
 * ser o código ou o objeto de `procedimento` (com o código emprestado já resolvido: conta como o procedimento real).
 */
export function categoriaTabela1(cod) {
  const p = typeof cod === "object" && cod ? cod : procedimento(cod), d = p.digitos;
  const base = p.emprestado?.base || EQUIVALENTES[d] || d, t = POR_CODIGO.get(base);
  if (t) return { ...t, tabela1: true, base };
  const f = FORA.find(([p]) => d.startsWith(p));
  return { categoria: f ? f[1] : "Outros", financiamento: "", tabela1: false, base: d };
}
export const CODIGOS_TABELA1 = [...POR_CODIGO.keys()];

// ---------------- completude ----------------
// Romero DE, Cunha CB. Avaliação da qualidade das variáveis sócio-econômicas e demográficas dos óbitos de crianças
// menores de um ano registrados no SIM do Brasil (1996/2001). Cad Saúde Pública. 2006;22(3):673-84.
export const ESCALA_ROMERO = [[5, "Excelente"], [10, "Bom"], [20, "Regular"], [50, "Ruim"], [Infinity, "Muito ruim"]];
export const classeIncompletude = (pctBranco) => ESCALA_ROMERO.find(([lim]) => pctBranco < lim)[1];

const tem = (v) => v != null && String(v).trim() !== "";
const tinta = (f, k) => f.presenca && f.presenca[k] != null ? f.presenca[k] >= LIMIAR_PRESENCA : null; // null: não medido
/** Campos da ficha e como saber se foram preenchidos. Função (f, r) → true, false ou null (não dá para saber). */
export const CAMPOS_COMPLETUDE = [
  ["clinica", "Clínica", "Cabeçalho", (f, r) => tem(r.clinica)],
  ["data", "Data do atendimento", "Cabeçalho", (f, r) => tem(r.data)],
  ["prontuario", "Prontuário", "Cabeçalho", (f) => f.tokens ? tem(f.tokens.prontuario) : null],
  ["aluno", "Número do aluno (RA)", "Cabeçalho", (f) => f.tokens ? tem(f.tokens.aluno) : null],
  ["tipo", "Tipo de atendimento", "Paciente", (f, r) => !!(r.urgencia || r.primeira || r.retorno)],
  ["nome", "Nome do paciente", "Paciente", (f) => tinta(f, "nome")],
  ["cpf", "CPF", "Paciente", (f) => f.tokens ? tem(f.tokens.cpf) : null],
  ["cns", "Cartão Nacional de Saúde", "Paciente", (f) => f.tokens ? tem(f.tokens.cns) : null],
  ["idade", "Idade", "Paciente", (f, r) => tem(r.idadeEscrita)],
  ["nascimento", "Data de nascimento", "Paciente", (f, r) => tem(r.nascimento)],
  ["sexo", "Sexo", "Paciente", (f, r) => tem(r.sexo)],
  ["assinatura", "Assinatura do paciente", "Paciente", (f) => tinta(f, "assinatura")],
  ["endereco", "Endereço", "Paciente", (f) => tem(f.leitura?.endereco?.rua) || tem(f.leitura?.endereco?.bairro) ? true : tinta(f, "endereco")],
  ["municipio", "Município", "Paciente", (f, r) => tem(r.municipio)],
  ["responsavel", "Responsável pelo preenchimento", "Equipe", (f) => tinta(f, "responsavel")],
  ["professor", "Professor responsável (carimbo)", "Equipe", (f) => tinta(f, "professor")],
  ["procedimento", "Procedimento (ao menos um)", "Procedimentos", (f, r) => (r.procedimentos || []).some(q => tem(q.codigo))],
];
/**
 * Completude por campo: { campos: [{ id, nome, grupo, n, preenchidos, pct, branco, classe }], dente: {...},
 * validade: { cpf, cns }, global, porGrupo: (chave → Map(categoria → % médio)) }.
 * `itens`: [{ f, r }] (ficha e revisão).
 */
export function completude(itens, { agrupar = [] } = {}) {
  const campos = CAMPOS_COMPLETUDE.map(([id, nome, grupo, fn]) => {
    let n = 0, sim = 0;
    for (const { f, r } of itens) { const v = fn(f, r); if (v == null) continue; n++; if (v) sim++; }
    const pct = n ? 100 * sim / n : null;
    return { id, nome, grupo, n, preenchidos: sim, pct, branco: pct == null ? null : 100 - pct, classe: pct == null ? "" : classeIncompletude(100 - pct) };
  });
  // dente informado nos procedimentos que pedem dente
  let pedem = 0, comDente = 0, fdiInvalido = 0;
  for (const { r } of itens) for (const q of r.procedimentos || []) {
    const p = procedimento(q.codigo); if (!p.conhecido || !PEDE_DENTE.test(p.nome)) continue;
    pedem++; const d = String(q.dente || "").trim();
    if (d) { comDente++; if (!PERMANENTE.test(d) && !DECIDUO.test(d)) fdiInvalido++; }
  }
  const dente = { n: pedem, preenchidos: comDente, pct: pedem ? 100 * comDente / pedem : null, fdiInvalido };
  if (pedem) campos.push({ id: "dente", nome: "Dente (nos procedimentos que pedem)", grupo: "Procedimentos", n: pedem, preenchidos: comDente, pct: dente.pct, branco: 100 - dente.pct, classe: classeIncompletude(100 - dente.pct) });
  // validade dos números (dígito verificador), entre os preenchidos
  const validade = {};
  for (const c of ["cpf", "cns"]) {
    let n = 0, ok = 0;
    for (const { f } of itens) { const v = f.validos?.[c]; if (v == null) continue; n++; if (v) ok++; }
    validade[c] = { n, validos: ok, pct: n ? 100 * ok / n : null };
  }
  // inconsistências (regras de coerência)
  const tipos = new Map(); let comAlguma = 0;
  for (const { f, r } of itens) {
    const av = coerencia(r, f); if (av.length) comAlguma++;
    for (const a of av) { const k = tipoInconsistencia(a); tipos.set(k, (tipos.get(k) || 0) + 1); }
  }
  const medidos = campos.filter(c => c.pct != null);
  const global = medidos.length ? medidos.reduce((s, c) => s + c.pct, 0) / medidos.length : null;
  // completude média por categoria (clínica, mês…): média dos campos medidos
  const porGrupo = {};
  for (const [chave, fnG] of agrupar) {
    const m = new Map();
    for (const it of itens) { const g = fnG(it.r, it.f) || "Não informado"; if (!m.has(g)) m.set(g, []); m.get(g).push(it); }
    porGrupo[chave] = new Map([...m].map(([g, its]) => {
      let soma = 0, k = 0;
      for (const [, , , fn] of CAMPOS_COMPLETUDE) { let n = 0, sim = 0; for (const { f, r } of its) { const v = fn(f, r); if (v == null) continue; n++; if (v) sim++; } if (n) { soma += 100 * sim / n; k++; } }
      return [g, { n: its.length, pct: k ? soma / k : null }];
    }));
  }
  return { campos, dente, validade, inconsistencias: { fichas: comAlguma, tipos: [...tipos].sort((a, b) => b[1] - a[1]) }, global, total: itens.length, porGrupo };
}

// nome do tipo de inconsistência, sem os números de cada ficha
const TIPOS_INC = [[/futuro/, "data do atendimento no futuro"], [/antes de 2000/, "data do atendimento antes de 2000"], [/nascimento depois/, "nascimento depois do atendimento"],
  [/^idade de/, "idade acima de 110 anos"], [/idade escrita/, "idade escrita diferente da calculada"], [/Infantil/, "prontuário da clínica Infantil em paciente adulto"],
  [/mais de um tipo/, "mais de um tipo de atendimento marcado"], [/fora da lista/, "código de procedimento fora da tabela"], [/numeração FDI/, "dente fora da numeração FDI"],
  [/sem o número do dente/, "procedimento sem o número do dente"], [/decíduo, mas o dente/, "procedimento de decíduo em dente permanente"],
  [/permanente, mas o dente/, "procedimento de permanente em dente decíduo"], [/decíduo num paciente/, "dente decíduo em paciente com 15 anos ou mais"]];
export const tipoInconsistencia = (a) => (TIPOS_INC.find(([re]) => re.test(a)) || [, a])[1];

// ---------------- indicadores ----------------
const EXO_PERM = new Set(["0414020138"]), EXO_TODAS = new Set(["0414020120", "0414020138", "0414020146", "0414020278"]);
const REST_PERM = new Set(["0307010031", "0307010040", "0307010120", "0307010139", "0307010104P"]); // P: ionômero no permanente (código emprestado)
const PREVENTIVOS = /^0101/;
const individual = (d) => !/^0301|^02/.test(d); // procedimento clínico individual (sem consultas e exames)
/**
 * Indicadores: [{ id, nome, formula, num, den, valor, unidade, nota }]. `itens`: [{ f, r }]; `pacientes`: resumoPacientes.
 */
export function indicadores(itens, pacientes = null) {
  const rs = itens.map(x => x.r), n = rs.length;
  const comTipo = rs.filter(r => r.urgencia || r.primeira || r.retorno);
  const procs = rs.flatMap(r => (r.procedimentos || []).map(q => { const p = procDe(q, r); return { ...q, p, d: p.digitos, k: p.chave }; })).filter(q => q.d);
  const indiv = procs.filter(q => individual(q.d));
  const comDente = procs.filter(q => PERMANENTE.test(String(q.dente).trim()) || DECIDUO.test(String(q.dente).trim()));
  const fora = rs.filter(r => r.municipio && !ehCascavel(r.municipio));
  const feitos = new Set(procs.map(q => categoriaTabela1(q.p)).filter(c => c.tabela1).map(c => c.base));
  const fin = { PAB: 0, FAEC: 0 }; for (const q of procs) { const c = categoriaTabela1(q.p); if (c.financiamento) fin[c.financiamento]++; }
  const exoP = procs.filter(q => EXO_PERM.has(q.d)).length, restP = procs.filter(q => REST_PERM.has(q.k)).length;
  const L = [
    ["urgencia", "Proporção de atendimentos de urgência", "atendimentos com Urgência/Emergência marcada ÷ atendimentos com o tipo marcado × 100", comTipo.filter(r => r.urgencia).length, comTipo.length, "%"],
    ["primeira", "Proporção de primeiras consultas", "atendimentos com 1ª Consulta marcada ÷ atendimentos com o tipo marcado × 100", comTipo.filter(r => r.primeira).length, comTipo.length, "%"],
    ["retornoTipo", "Proporção de retornos", "atendimentos com Retorno marcado ÷ atendimentos com o tipo marcado × 100", comTipo.filter(r => r.retorno).length, comTipo.length, "%"],
    ["procAtend", "Procedimentos por atendimento", "procedimentos registrados ÷ atendimentos", procs.length, n, "média"],
    ["preventivos", "Proporção de procedimentos preventivos", "procedimentos do grupo 01.01 (flúor, selante, cariostático, evidenciação de placa, selamento provisório) ÷ procedimentos registrados × 100", procs.filter(q => PREVENTIVOS.test(q.d)).length, procs.length, "%"],
    ["exodontia", "Proporção de exodontias de dentes permanentes", "exodontias de dente permanente (04.14.02.013-8) ÷ procedimentos clínicos individuais (sem consultas e exames) × 100", exoP, indiv.length, "%"],
    ["exoTodas", "Proporção de exodontias (todas)", "exodontias de decíduo, de permanente, múltiplas e de dente retido ÷ procedimentos clínicos individuais × 100", procs.filter(q => EXO_TODAS.has(q.d)).length, indiv.length, "%"],
    ["restExo", "Razão restaurações/exodontias em dentes permanentes", "restaurações de dente permanente ÷ exodontias de dente permanente", restP, exoP, "razão"],
    ["deciduos", "Proporção de procedimentos em dentes decíduos", "procedimentos em dentes decíduos (51 a 85) ÷ procedimentos com dente informado × 100", comDente.filter(q => DECIDUO.test(String(q.dente).trim())).length, comDente.length, "%"],
    ["foraCascavel", "Proporção de atendimentos de pacientes de outros municípios", "atendimentos de pacientes não residentes em Cascavel ÷ atendimentos com município × 100", fora.length, rs.filter(r => r.municipio).length, "%"],
    ["pab", "Proporção de procedimentos da atenção básica (PAB)", "procedimentos classificados como PAB na Tabela 1 ÷ procedimentos registrados × 100", fin.PAB, procs.length, "%"],
    ["faec", "Proporção de procedimentos especializados (FAEC)", "procedimentos classificados como FAEC na Tabela 1 ÷ procedimentos registrados × 100", fin.FAEC, procs.length, "%"],
    ["escopo", "Escopo da Tabela 1 realizado", "códigos da Tabela 1 do projeto feitos ao menos uma vez ÷ códigos da Tabela 1 × 100", feitos.size, CODIGOS_TABELA1.length, "%"],
  ];
  if (pacientes) {
    L.push(["atendPac", "Atendimentos por paciente", "atendimentos ÷ pacientes distintos (código anônimo)", Math.round(pacientes.media * pacientes.pacientes), pacientes.pacientes, "média"]);
    L.push(["retornaram", "Proporção de pacientes com retorno", "pacientes com 2 ou mais atendimentos ÷ pacientes distintos × 100", pacientes.comRetorno, pacientes.pacientes, "%"]);
  }
  return L.map(([id, nome, formula, num, den, unidade]) => ({ id, nome, formula, num, den, unidade, valor: den ? (unidade === "%" ? 100 * num / den : num / den) : null }));
}
/** Os mesmos indicadores por mês (AAAA-MM → lista). */
export function indicadoresPorMes(itens, ids = ["urgencia", "primeira", "procAtend", "exodontia", "preventivos"]) {
  const m = new Map();
  for (const it of itens) { const k = it.r.data?.slice(0, 7); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(it); }
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, its]) => [mes, its.length, indicadores(its).filter(i => ids.includes(i.id))]);
}

// ---------------- categorias da Tabela 1 ----------------
/** Contagem de procedimentos por categoria: [{ categoria, financiamento, tabela1, n, codigos: Map(base → n) }]. */
export function porCategoria(itens) {
  const m = new Map();
  for (const { r } of itens) for (const q of r.procedimentos || []) {
    const p = procDe(q, r);
    if (!p.digitos) continue;
    const c = categoriaTabela1(p), k = `${c.tabela1 ? "T" : "F"}|${c.categoria}|${c.financiamento}`;
    if (!m.has(k)) m.set(k, { categoria: c.categoria, financiamento: c.financiamento, tabela1: c.tabela1, n: 0, codigos: new Map() });
    const g = m.get(k); g.n++; g.codigos.set(c.base, (g.codigos.get(c.base) || 0) + 1);
  }
  const ordem = (g) => g.tabela1 ? TABELA1.findIndex(([c, f]) => c === g.categoria && f === g.financiamento) : 100;
  return [...m.values()].sort((a, b) => ordem(a) - ordem(b) || b.n - a.n);
}

// ---------------- tempo e dentes ----------------
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const turno = (h) => { const m = /^(\d{1,2})/.exec(h || ""); if (!m) return null; const x = +m[1]; return x < 12 ? "Manhã" : x < 18 ? "Tarde" : "Noite"; };
export function porDiaETurno(rs) {
  const dias = DIAS_SEMANA.map(() => 0), turnos = new Map([["Manhã", 0], ["Tarde", 0], ["Noite", 0]]); let semHora = 0;
  for (const r of rs) {
    if (r.data) { const [a, m, d] = r.data.split("-").map(Number); dias[new Date(a, m - 1, d).getDay()]++; }
    const t = turno(r.horario); if (t) turnos.set(t, turnos.get(t) + 1); else semHora++;
  }
  return { dias, turnos, semHora };
}
/** Pirâmide etária: faixas de 10 anos (0-9 … 80+) × sexo. */
export function piramide(rs) {
  const faixas = ["0 a 9", "10 a 19", "20 a 29", "30 a 39", "40 a 49", "50 a 59", "60 a 69", "70 a 79", "80 ou mais"];
  const M = faixas.map(() => 0), F = faixas.map(() => 0);
  for (const r of rs) {
    const i = idadeNaData(r.nascimento, r.data) ?? (tem(r.idadeEscrita) ? +r.idadeEscrita : null);
    if (i == null || isNaN(i) || i < 0 || i > 120) continue;
    const k = Math.min(8, Math.floor(i / 10));
    if (r.sexo === "Masculino") M[k]++; else if (r.sexo === "Feminino") F[k]++;
  }
  return { faixas, M, F };
}
/** Procedimentos por dente (FDI): Map(dente → n), só os com dente válido; `filtro(cat)` opcional. */
export function porDente(rs, filtro = null) {
  const m = new Map();
  for (const r of rs) for (const q of r.procedimentos || []) {
    const d = String(q.dente || "").trim(); if (!PERMANENTE.test(d) && !DECIDUO.test(d)) continue;
    if (filtro) { const p = procDe(q, r); if (!filtro(categoriaTabela1(p), p)) continue; }
    m.set(d, (m.get(d) || 0) + 1);
  }
  return m;
}
