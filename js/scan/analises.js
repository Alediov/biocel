// Análises do OdontoScan sobre as fichas (tudo no aparelho): coerência de cada ficha, fichas repetidas,
// concordância da leitura automática com a revisão, linha do tempo dos pacientes e dicionário de dados da planilha.
import { montarRevisao, procedimento, idadeNaData } from "./processar.js";

// montarRevisao normaliza município e bairro (procura entre milhares de nomes): guarda o resultado por ficha
const cache = new Map();
export function revisaoDe(f) {
  if ((f.etapa === "revisada" || f.revisadaEm) && f.revisao) return f.revisao;
  const k = `${f.lidaEm || ""}|${f.leitura ? 1 : 0}`, c = cache.get(f.id);
  if (c && c.k === k) return c.r;
  const r = montarRevisao(f); cache.set(f.id, { k, r });
  return r;
}
const hoje = () => new Date().toISOString().slice(0, 10);

// ---------------- coerência ----------------
export const PERMANENTE = /^[1-4][1-8]$/, DECIDUO = /^[5-8][1-5]$/;
// procedimentos feitos num dente (pedem o número do dente)
export const PEDE_DENTE = /por dente|\bdente\b|exodontia|restaura[çc][ãa]o|pulp|endod[oô]nt|capeamento|selamento de perfura/i;
/** Avisos de coerência de uma revisão (r) da ficha f: datas, idade, dentes e procedimentos. */
export function coerencia(r, f = {}) {
  const av = [];
  const idade = idadeNaData(r.nascimento, r.data);
  if (r.data && r.data > hoje()) av.push("data do atendimento no futuro");
  if (r.data && r.data < "2000-01-01") av.push("data do atendimento antes de 2000");
  if (r.nascimento && r.data && r.nascimento > r.data) av.push("nascimento depois da data do atendimento");
  if (idade != null && idade > 110) av.push(`idade de ${idade} anos`);
  if (idade != null && r.idadeEscrita !== "" && r.idadeEscrita != null && Math.abs(idade - +r.idadeEscrita) > 1) av.push(`idade escrita (${r.idadeEscrita}) diferente da calculada (${idade})`);
  const idadeRef = idade ?? (r.idadeEscrita === "" || r.idadeEscrita == null ? null : +r.idadeEscrita);
  if (f.infantil && idadeRef != null && idadeRef >= 18) av.push(`prontuário da clínica Infantil, mas o paciente tem ${idadeRef} anos`);
  if ([r.urgencia, r.primeira, r.retorno].filter(Boolean).length > 1) av.push("mais de um tipo marcado");
  (r.procedimentos || []).forEach((q, i) => {
    const p = procedimento(q.codigo, { dente: q.dente, idade: idadeRef }), n = `procedimento ${i + 1}`, d = String(q.dente || "").trim();
    if (!p.conhecido) { if (p.digitos.length >= 3) av.push(`${n}: código fora da lista`); return; }
    if (d && !PERMANENTE.test(d) && !DECIDUO.test(d)) av.push(`${n}: dente ${d} não existe na numeração FDI`);
    if (!d && PEDE_DENTE.test(p.nome)) av.push(`${n} (${p.nome}) sem o número do dente`);
    if (/dec[ií]duo/i.test(p.nome) && PERMANENTE.test(d)) av.push(`${n}: procedimento em dente decíduo, mas o dente ${d} é permanente`);
    if (/permanente/i.test(p.nome) && DECIDUO.test(d)) av.push(`${n}: procedimento em dente permanente, mas o dente ${d} é decíduo`);
    if (/dec[ií]duo/i.test(p.nome) && idadeRef != null && idadeRef >= 15) av.push(`${n}: dente decíduo num paciente de ${idadeRef} anos`);
    if (p.corrigido?.regiao === "posterior" && /^[1-4][1-3]$/.test(d)) av.push(`${n}: código de restauração posterior (${p.corrigido.de}), mas o dente ${d} é anterior`);
    if (p.corrigido?.regiao === "anterior" && /^[1-4][4-8]$/.test(d)) av.push(`${n}: código de restauração anterior (${p.corrigido.de}), mas o dente ${d} é posterior`);
    if (p.emprestado && /^[1-4][1-3]$/.test(d)) av.push(`${n}: código de restauração posterior, mas o dente ${d} é anterior`);
  });
  return av;
}

// ---------------- fichas repetidas ----------------
/** Grupos de fichas que parecem a mesma (mesmo paciente e data, e mesmos procedimentos). `pac(f)`: código do paciente. */
export function repetidas(fichas, pac) {
  const grupos = new Map();
  for (const f of fichas) {
    if (f.etapa === "erro" || f.naoRepetida) continue;
    const p = pac(f); if (!p) continue;
    const r = (f.leitura || f.revisao) ? revisaoDe(f) : null;
    // sem leitura ainda: só dá para comparar o paciente e o nome do arquivo não ajuda; espera a leitura
    if (!r?.data) continue;
    const procs = (r.procedimentos || []).map(q => procedimento(q.codigo).digitos).sort().join(",");
    const k = `${p}|${r.data}|${procs}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(f);
  }
  return [...grupos.values()].filter(g => g.length > 1);
}

// ---------------- concordância ----------------
export const CAMPOS_CONC = [
  ["data", "Data"], ["horario", "Horário"], ["clinica", "Clínica"], ["cor", "Cor"], ["nascimento", "Nascimento"], ["sexo", "Sexo"],
  ["idadeEscrita", "Idade escrita"], ["municipio", "Município"], ["bairro", "Bairro"], ["tipo", "Tipo de atendimento"], ["procedimentos", "Procedimentos"],
];
const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const valorCampo = (r, k) => k === "tipo" ? [r.urgencia, r.primeira, r.retorno].map(Boolean).join() :
  k === "procedimentos" ? (r.procedimentos || []).map(q => `${String(q.dente || "").trim()}:${procedimento(q.codigo).digitos}`).sort().join("|") : norm(r[k]);
/** Intervalo de confiança de 95% (Wilson) para k acertos em n. */
export function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}
/**
 * Concordância entre a leitura automática (o que a revisão mostrou de início) e a revisão salva.
 * Compara só os campos que a leitura ou a revisão preencheram. `ids`: só essas fichas (a amostra).
 */
export function concordancia(fichas, ids = null) {
  const lista = fichas.filter(f => f.etapa === "revisada" && f.revisao && (!ids || ids.includes(f.id)));
  const por = Object.fromEntries(CAMPOS_CONC.map(([k]) => [k, { k: 0, n: 0 }]));
  const procs = { k: 0, n: 0 }; // procedimento a procedimento
  for (const f of lista) {
    const ini = f.revisaoInicial || montarRevisao(f), fim = f.revisao;
    for (const [k] of CAMPOS_CONC) {
      const a = valorCampo(ini, k), b = valorCampo(fim, k);
      if (!a && !b) continue;
      por[k].n++; if (a === b) por[k].k++;
    }
    const pa = (ini.procedimentos || []).map(q => `${String(q.dente || "").trim()}:${procedimento(q.codigo).digitos}`), pb = (fim.procedimentos || []).map(q => `${String(q.dente || "").trim()}:${procedimento(q.codigo).digitos}`);
    const resto = [...pa];
    for (const x of pb) { procs.n++; const i = resto.indexOf(x); if (i >= 0) { procs.k++; resto.splice(i, 1); } }
    procs.n += resto.length; // lidos que não ficaram
  }
  const total = Object.values(por).reduce((s, x) => ({ k: s.k + x.k, n: s.n + x.n }), { k: 0, n: 0 });
  const fichasIguais = lista.filter(f => { const ini = f.revisaoInicial || montarRevisao(f); return CAMPOS_CONC.every(([k]) => valorCampo(ini, k) === valorCampo(f.revisao, k)); }).length;
  return { fichas: lista.length, fichasIguais, por, procs, total };
}
// ---------- que tipo de erro a leitura comete (04/11/2026: o teste da leitura local deu 70% nos campos e 34% nos
// procedimentos, contra 95% da nuvem; para saber onde mexer sem mostrar nenhum valor das fichas, só as contagens) ----------
const digs = (v) => String(v ?? "").replace(/\D/g, "");
const difDigitos = (a, b) => { if (a.length !== b.length) return null; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
function parecido(a, b) {
  a = norm(a); b = norm(b); if (!a || !b) return 0;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - m[a.length][b.length] / Math.max(a.length, b.length);
}
function tipoErroData(a, b) {
  const [ya, ma, da] = String(a).split("-"), [yb, mb, db] = String(b).split("-");
  if (!ya || !yb || !ma || !mb) return "outro";
  if (ya === yb && ma === db && da === mb) return "dia e mês trocados";
  const d = difDigitos(digs(a), digs(b));
  if (d === 1) return "um dígito";
  const certos = [ya === yb, ma === mb, da === db];
  if (certos[1] && certos[2]) return "só o ano";
  if (certos[0] && certos[2]) return "só o mês";
  if (certos[0] && certos[1]) return "só o dia";
  return "outro";
}
/** Contagens dos tipos de erro (leitura × revisão), sem nenhum valor. `fichas`: as mesmas da `concordancia`. */
export function tiposDeErro(fichas) {
  const lista = fichas.filter(f => f.etapa === "revisada" && f.revisao);
  const por = {}, conta = (k, t) => { (por[k] ||= {})[t] = (por[k][t] || 0) + 1; };
  let erros = 0, avisados = 0;
  for (const f of lista) {
    const ini = f.revisaoInicial || montarRevisao(f), fim = f.revisao;
    const marcados = new Set();
    for (const d of ini.duvidas || []) for (const [re, k] of [[/^data(?! de nasc)/i, "data"], [/^hor[áa]rio/i, "horario"], [/^cl[ií]nica/i, "clinica"], [/^cor\b/i, "cor"], [/nascimento/i, "nascimento"], [/^sexo/i, "sexo"], [/idade/i, "idadeEscrita"], [/munic[ií]pio/i, "municipio"], [/bairro|rua|endere/i, "bairro"], [/urg[êe]ncia|retorno|consulta|tipo/i, "tipo"], [/procedimento|c[óo]digo|dente/i, "procedimentos"]]) if (re.test(d)) { marcados.add(k); break; }
    for (const [k] of CAMPOS_CONC) {
      if (k === "procedimentos") continue;
      const a = valorCampo(ini, k), b = valorCampo(fim, k);
      if (a === b || (!a && !b)) continue;
      erros++; if (marcados.has(k)) avisados++;
      let t;
      if (!a) t = "a IA deixou vazio"; else if (!b) t = "a IA leu algo que não estava";
      else if (k === "data" || k === "nascimento") t = tipoErroData(a, b);
      else if (k === "horario") t = difDigitos(digs(a), digs(b)) === 1 ? "um dígito" : "outro";
      else if (k === "idadeEscrita") t = Math.abs(+a - +b) <= 1 ? "1 ano de diferença" : String(+a) === String(+b).split("").reverse().join("") ? "dígitos invertidos" : "outro";
      else if (k === "tipo") t = "outro quadradinho";
      else t = parecido(a, b) >= 0.75 ? "parecido (letras)" : "outro";
      conta(k, t);
    }
    // procedimentos: o que bateu sai; o resto é pareado pelo mais parecido
    const q = (x) => ({ d: String(x.dente || "").trim(), c: procedimento(x.codigo).digitos, ok: procedimento(x.codigo).conhecido });
    const A = (ini.procedimentos || []).map(q), B = (fim.procedimentos || []).map(q);
    conta("procedimentos", `linhas: IA ${A.length > B.length ? "a mais" : A.length < B.length ? "a menos" : "igual"}`);
    for (let i = B.length - 1; i >= 0; i--) { const j = A.findIndex(x => x.d === B[i].d && x.c === B[i].c); if (j >= 0) { A.splice(j, 1); B.splice(i, 1); } }
    if (A.length || B.length) { erros++; if (marcados.has("procedimentos")) avisados++; }
    for (const b of B) {
      const nota = (a) => (a.c === b.c ? 3 : 0) + (a.d === b.d ? 2 : 0) + ((difDigitos(a.c, b.c) ?? 9) <= 2 ? 1 : 0);
      let j = -1, best = 0; A.forEach((a, i) => { const n = nota(a); if (n > best) { best = n; j = i; } });
      if (j < 0) { conta("procedimentos", "a IA não leu a linha"); continue; }
      const a = A.splice(j, 1)[0];
      if (a.c === b.c) conta("procedimentos", !a.d ? "código certo, dente vazio" : !b.d ? "código certo, dente a mais" : "código certo, dente errado");
      else {
        const dd = difDigitos(a.c, b.c);
        conta("procedimentos", `${a.c.length !== 10 ? "código incompleto" : dd === 1 ? "código: 1 dígito" : "código: 2 dígitos"}${a.ok ? "" : " (fora da tabela)"}${a.d === b.d ? "" : " + dente"}`);
      }
    }
    for (const a of A) conta("procedimentos", `a IA leu linha a mais${a.ok ? "" : " (fora da tabela)"}`);
  }
  return { fichas: lista.length, erros, avisados, por };
}
export function textoTiposDeErro(t) {
  const nomes = Object.fromEntries(CAMPOS_CONC);
  const L = [`Tipos de erro (${t.erros} campos errados; ${t.avisados} deles a IA marcou como dúvida):`];
  for (const [k, n] of CAMPOS_CONC) {
    const x = t.por[k]; if (!x) continue;
    L.push(`- ${nomes[k] || n}: ${Object.entries(x).sort((a, b) => b[1] - a[1]).map(([tt, c]) => `${tt} ${c}`).join("; ")}`);
  }
  return L.join("\n");
}
/** Parágrafo pronto para a metodologia/resultados. */
export function textoConcordancia(c, amostra) {
  const pc = (x) => x.n ? `${(100 * x.k / x.n).toFixed(1).replace(".", ",")}%` : "–";
  const ic = (x) => { const [a, b] = wilson(x.k, x.n); return `IC 95%: ${(100 * a).toFixed(1).replace(".", ",")}–${(100 * b).toFixed(1).replace(".", ",")}%`; };
  const piores = CAMPOS_CONC.map(([k, n]) => [n, c.por[k]]).filter(([, x]) => x.n >= 5).sort((a, b) => a[1].k / a[1].n - b[1].k / b[1].n).slice(0, 2);
  return `A leitura automática das fichas foi comparada com a revisão manual ${amostra ? `numa amostra aleatória de ${c.fichas} fichas, conferidas campo a campo` : `de ${c.fichas} fichas revisadas`}. ` +
    `A concordância geral foi de ${pc(c.total)} dos campos (${c.total.k} de ${c.total.n}; ${ic(c.total)}), e ${c.fichasIguais} fichas (${c.fichas ? Math.round(100 * c.fichasIguais / c.fichas) : 0}%) não precisaram de nenhuma correção. ` +
    `Nos procedimentos (dente e código), a concordância foi de ${pc(c.procs)} (${c.procs.k} de ${c.procs.n}; ${ic(c.procs)}).` +
    (piores.length ? ` Os campos com mais correções foram ${piores.map(([n, x]) => `${n.toLowerCase()} (${pc(x)})`).join(" e ")}.` : "");
}

// ---------------- linha do tempo dos pacientes ----------------
/** Map código do paciente → atendimentos [{ f, r }] em ordem de data. Só fichas lidas ou revisadas. */
export function linhaDoTempo(fichas, pac) {
  const m = new Map();
  for (const f of fichas) {
    if (!(f.leitura || f.revisao)) continue;
    const p = pac(f); if (!p) continue;
    const r = revisaoDe(f);
    if (!m.has(p)) m.set(p, []);
    m.get(p).push({ f, r });
  }
  for (const v of m.values()) v.sort((a, b) => (a.r.data || "").localeCompare(b.r.data || ""));
  return m;
}
/** Resumo: pacientes, com retorno (2+ atendimentos), média de atendimentos e mediana de dias entre consultas. */
export function resumoPacientes(m) {
  const ps = [...m.values()], com2 = ps.filter(v => v.length > 1), dias = [];
  for (const v of com2) for (let i = 1; i < v.length; i++) {
    const a = v[i - 1].r.data, b = v[i].r.data;
    if (a && b) dias.push((new Date(b) - new Date(a)) / 864e5);
  }
  dias.sort((a, b) => a - b);
  return { pacientes: ps.length, comRetorno: com2.length, media: ps.length ? ps.reduce((s, v) => s + v.length, 0) / ps.length : 0, medianaDias: dias.length ? dias[Math.floor(dias.length / 2)] : null };
}

// ---------------- dicionário de dados da planilha ----------------
export const DICIONARIO = [
  ["Arquivo", "texto", "Caminho da foto dentro da pasta importada (ex.: Outubro/IMG_0001.jpg). Serve para achar a ficha em papel."],
  ["Código do paciente", "texto", "P- seguido de letras e números. Gerado no aparelho a partir do CPF, do CNS ou do prontuário com uma chave secreta (HMAC). O mesmo paciente tem sempre o mesmo código."],
  ["Código do aluno", "texto", "A-…: código do RA do aluno (o nome do aluno e o do professor não são lidos)."],
  ["Clínica", "texto", "Sigla por extenso (ex.: Prótese I) ou o nome do professor que atendeu, quando é isso que está na linha da Clínica."],
  ["Horário de Chegada", "hora (HH:MM)", "Horário escrito na linha da Clínica ou acima do quadro."],
  ["Cor", "texto", "Raça/cor escrita na ficha (Branca, Parda, Preta, Amarela, Indígena)."],
  ["Data", "data", "Data do atendimento."],
  ["Urgência/Emergência", "X ou vazio", "Marcado na ficha (01)."],
  ["Primeira Consulta", "X ou vazio", "Marcado na ficha (02)."],
  ["Retorno", "X ou vazio", "Marcado na ficha (03)."],
  ["Idade (calculada)", "número (anos)", "Calculada pela data de nascimento e a data do atendimento. A data de nascimento não sai na planilha."],
  ["Idade (escrita)", "número (anos)", "A idade escrita no campo Idade da ficha."],
  ["Sexo", "texto", "Feminino ou Masculino."],
  ["Município", "texto", "Nome oficial do IBGE; fora do Paraná, \"Nome - UF\"."],
  ["Bairro", "texto", "Só para Cascavel: nome do GeoCascavel. O endereço completo não sai na planilha."],
  ["Situação", "texto", "Etapa da ficha no Scanner (Lida ou Revisada)."],
  ["Dente N", "texto (FDI)", "Número do dente do procedimento N (11–48 permanentes, 51–85 decíduos), como texto."],
  ["Código do Procedimento N", "texto", "Código SIGTAP com pontos (00.00.00.000-0), como texto para não perder zeros."],
  ["Nome do Procedimento N", "texto", "Nome do procedimento na tabela SIGTAP usada pela clínica. Exceção: 03.07.01.010-4 (restauração de dente decíduo posterior com ionômero de vidro) em dente permanente, ou sem dente com paciente de 13 anos ou mais, sai como Restauração de Dente Permanente Posterior com Ionômero de Vidro, que não tem código próprio no SIGTAP (a clínica usa o do decíduo); o código fica como registrado e a aba Procedimentos explica em Observação do código."],
  ["Aba Correções", "—", "Histórico das correções de cada ficha: quando, o que (números confirmados, revisão), o campo, o valor lido e o corrigido. Dos números de identificação, só quantos dígitos mudaram; da data de nascimento, só que foi alterada."],
  ["Aba Procedimentos", "—", "Uma linha por procedimento: Arquivo, Código do paciente, Data, Clínica, Ordem (posição na ficha), Dente, Código e Nome."],
];

// ---------------- padrões estranhos (pedido do Alediov, 25/10/2026) ----------------
/**
 * Alertas de padrões que pedem uma olhada (só números agregados; o aluno aparece pelo código A-…):
 * clínica com um código dominante, mês com queda ou alta brusca, procedimentos sem dente por clínica e por aluno,
 * códigos corrigidos (resina de decíduo em permanente) por clínica, campos em branco muito acima da média e
 * idade escrita diferente da calculada. `itens`: [{ f, r }]. Devolve [{ grav: "alta"|"media", titulo, texto }].
 */
export function padroesEstranhos(itens, { codigoAluno = (f) => f.tokens?.aluno || "" } = {}) {
  const out = [], pc = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const porClinica = new Map();
  for (const it of itens) { const c = it.r.clinica || "sem clínica"; if (!porClinica.has(c)) porClinica.set(c, []); porClinica.get(c).push(it); }
  // 1) clínica com um código dominante
  for (const [c, lista] of porClinica) {
    const cods = new Map(); let n = 0;
    for (const { r } of lista) for (const q of r.procedimentos || []) { const p = procedimento(q.codigo, { dente: q.dente }); if (!p.digitos) continue; n++; cods.set(p.codigo, (cods.get(p.codigo) || 0) + 1); }
    if (n < 20) continue;
    const [cod, k] = [...cods].sort((a, b) => b[1] - a[1])[0];
    if (k / n >= 0.7) out.push({ grav: "media", titulo: `${c}: um código só`, texto: `${pc(k, n)}% dos ${n} procedimentos são ${cod} (${procedimento(cod).nome || "fora da tabela"}). Pode ser o perfil da clínica ou um código anotado por hábito.` });
  }
  // 2) meses com queda ou alta brusca (comparados à mediana dos meses com atendimento)
  const meses = new Map();
  for (const { r } of itens) if (r.data) meses.set(r.data.slice(0, 7), (meses.get(r.data.slice(0, 7)) || 0) + 1);
  const valores = [...meses.values()].sort((a, b) => a - b);
  if (valores.length >= 4) {
    const med = valores[Math.floor(valores.length / 2)];
    // meses sem nenhuma ficha entre o primeiro e o último também contam
    const ks = [...meses.keys()].sort();
    for (let [a, mm] = ks[0].split("-").map(Number); `${a}-${String(mm).padStart(2, "0")}` < ks[ks.length - 1];) {
      mm++; if (mm > 12) { mm = 1; a++; }
      const k = `${a}-${String(mm).padStart(2, "0")}`; if (!meses.has(k)) meses.set(k, 0);
    }
    for (const [m, v] of [...meses].sort()) {
      const ferias = /-(01|02|07|12)$/.test(m);
      if (v < med * 0.4) out.push({ grav: ferias ? "media" : "alta", titulo: `Poucas fichas em ${m.split("-").reverse().join("/")}`, texto: `${v} atendimentos, contra a mediana de ${med} por mês${ferias ? " (mês de férias, talvez esperado)" : ": falta digitalizar fichas desse mês?"}` });
      if (v > med * 2.5) out.push({ grav: "media", titulo: `Muitas fichas em ${m.split("-").reverse().join("/")}`, texto: `${v} atendimentos, contra a mediana de ${med} por mês. Confira se não há fichas repetidas ou datas lidas erradas.` });
    }
  }
  // 3) procedimentos que pedem dente sem o dente, por clínica e por aluno
  const semDente = (lista) => { let pedem = 0, sem = 0; for (const { r } of lista) for (const q of r.procedimentos || []) { const p = procedimento(q.codigo); if (!p.conhecido || !PEDE_DENTE.test(p.nome)) continue; pedem++; if (!String(q.dente || "").trim()) sem++; } return { pedem, sem }; };
  const geral = semDente(itens), mediaSem = geral.pedem ? geral.sem / geral.pedem : 0;
  for (const [c, lista] of porClinica) { const { pedem, sem } = semDente(lista); if (pedem >= 15 && sem / pedem >= Math.max(0.3, mediaSem * 2)) out.push({ grav: "media", titulo: `${c}: dente sem anotar`, texto: `${pc(sem, pedem)}% dos procedimentos que pedem dente vieram sem o número do dente (média geral: ${pc(geral.sem, geral.pedem)}%).` }); }
  const porAluno = new Map();
  for (const it of itens) { const a = codigoAluno(it.f); if (!a) continue; if (!porAluno.has(a)) porAluno.set(a, []); porAluno.get(a).push(it); }
  const alunos = [...porAluno].map(([a, l]) => ({ a, ...semDente(l) })).filter(x => x.pedem >= 10 && x.sem / x.pedem >= Math.max(0.5, mediaSem * 2.5)).sort((a, b) => b.sem / b.pedem - a.sem / a.pedem).slice(0, 5);
  if (alunos.length) out.push({ grav: "media", titulo: "Alunos que quase nunca anotam o dente", texto: alunos.map(x => `${x.a}: ${pc(x.sem, x.pedem)}% sem dente (${x.pedem} procedimentos)`).join("; ") + "." });
  // 4) códigos corrigidos por clínica
  for (const [c, lista] of porClinica) {
    let n = 0, cor = 0;
    const porCod = new Map();
    for (const { r } of lista) for (const q of r.procedimentos || []) { const p = procedimento(q.codigo, { dente: q.dente }); if (!p.digitos) continue; n++; if (p.corrigido) { cor++; const k = `${p.corrigido.de} → ${p.codigo}`; porCod.set(k, (porCod.get(k) || 0) + 1); } }
    if (cor >= 5 && cor / n >= 0.1) out.push({ grav: "media", titulo: `${c}: resina de decíduo em dente permanente`, texto: `${cor} procedimentos (${pc(cor, n)}% da clínica) anotados com código de decíduo em dente permanente e contados com o do permanente (${[...porCod].map(([k, v]) => `${k}: ${v}`).join("; ")}).` });
  }
  // 5) idade escrita diferente da calculada
  let comAmbas = 0, difere = 0;
  for (const { r } of itens) { const i = idadeNaData(r.nascimento, r.data); if (i == null || r.idadeEscrita === "" || r.idadeEscrita == null) continue; comAmbas++; if (Math.abs(i - +r.idadeEscrita) > 1) difere++; }
  if (comAmbas >= 20 && difere / comAmbas >= 0.1) out.push({ grav: "media", titulo: "Idade escrita diferente da calculada", texto: `Em ${pc(difere, comAmbas)}% das fichas com as duas (${difere} de ${comAmbas}), a idade anotada difere mais de 1 ano da calculada pela data de nascimento. Pode ser data lida errada.` });
  // 6) fichas sem nenhum procedimento
  const semProc = itens.filter(({ r }) => !(r.procedimentos || []).some(q => q.codigo)).length;
  if (itens.length >= 20 && semProc / itens.length >= 0.05) out.push({ grav: "media", titulo: "Fichas sem procedimento", texto: `${semProc} fichas (${pc(semProc, itens.length)}%) não têm nenhum procedimento anotado.` });
  return out.sort((a, b) => (a.grav === "alta" ? 0 : 1) - (b.grav === "alta" ? 0 : 1));
}
