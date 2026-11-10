// Relatório da IC (.docx), montado no aparelho só com números agregados (nenhum nome, número ou código de paciente).
// Segue os objetivos específicos do projeto: protocolo de digitalização e anonimização, completude do preenchimento,
// indicadores, painéis (Power BI), origem geográfica (mapas, taxas, Kernel) e aglomerados espaciais (Moran/LISA).
import { Documento } from "./docx.js";
import { zip } from "./arquivos.js";
import { revisaoDe, concordancia, CAMPOS_CONC, wilson, linhaDoTempo, resumoPacientes } from "./analises.js";
import { VARIAVEIS, cruzar, quiQuadrado } from "./cruzadas.js";
import { procedimento, procDe, idadeNaData, ehPIC, IDADE_PERMANENTE } from "./processar.js";
import { contar as contarMapa } from "./mapa.js";
import { colunas, mapa, kernel as kernelPng, lisa as lisaPng, piramide as piramidePng, odontograma as odontogramaPng, fluxograma, pontosNaForma } from "./graficos.js";
import { NOMES_CAMPOS } from "./historico.js";
import { completude, indicadores, indicadoresPorMes, porCategoria, categoriaTabela1, porDiaETurno, piramide, porDente, DIAS_SEMANA, NOTA_TABELA1, CODIGOS_TABELA1, ESCALA_ROMERO } from "./indicadores.js";
import { CLINICA, distancias, taxas, bayesEmpirico, moran, regiaoCascavel, vizinhosEm, kmPorUnidade, projetar, raioKernel, local, GEO } from "./geo.js";
import { MAPAS } from "./mapas.js";
import { norm } from "./previsao.js";
import { comparar as compararSIA, nomeMes as mesSIA } from "./oficial.js";

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const dec = (v, c = 1) => v == null || !isFinite(v) ? "–" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const pc = (v, t) => t ? dec(100 * v / t) : "–";
const pval = (p) => p < 0.001 ? "p < 0,001" : `p = ${dec(p, 3)}`;
const dBr = (iso) => iso ? iso.split("-").reverse().join("/") : "";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesExt = (am) => { const [a, m] = am.split("-"); return `${MESES[+m - 1]}/${a}`; };
const FONTE = "Fonte: fichas de Controle de Tratamento digitalizadas (Órbita Scanner).";
export const PROJETO = "Inteligência de Dados em Saúde Bucal Coletiva: Aplicação de Geoprocessamento e Business Intelligence na Clínica-Escola da Unioeste";

function contagem(valores) { const m = new Map(); for (const v of valores) m.set(v, (m.get(v) || 0) + 1); return m; }
const quadrantes = (m) => new Map(m.locais.map((l, i) => [i, l?.quadrante]).filter(([, q]) => q));

/**
 * `fichas`: as do aparelho (sem lixeira); `pac(f)`: código do paciente (só para ligar as consultas, não sai no texto);
 * `o`: { titulo, tipo ("parcial" | "final"), projeto, autor, orientador, instituicao, soRevisadas, concordanciaIds,
 *        cruzada: { lin, col }, naLixeira (fichas apagadas como repetidas) }.
 */
/** "Figuras para o artigo" (pedido do Alediov, 25/10/2026): as figuras do relatório em PNG, num .zip, com um LEIA-ME com
 * os títulos e as fontes (gerarRelatorio com `figuras: true`, desenhadas com o dobro de pixels). */
async function figurasDoRelatorio(doc) {
  const nomeArq = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 70);
  const arqs = doc.imagens.map(im => ({ nome: `figura-${String(im.n).padStart(2, "0")}-${nomeArq(im.titulo)}.png`, dados: im.png }));
  const leia = ["Figuras do Órbita Scanner para artigos, pôsteres e apresentações (PNG, fundo branco, ~3.200 px de largura).", "",
    ...doc.imagens.map(im => `Figura ${im.n} – ${im.titulo}\n  ${im.fonte || ""}`), "",
    "Só números agregados: nenhum dado ou código de paciente."].join("\n");
  return zip([...arqs, { nome: "LEIA-ME.txt", dados: leia }]);
}
export async function gerarRelatorio(fichas, pac, o = {}) {
  const validas = fichas.filter(f => f.etapa !== "erro");
  const erros = fichas.length - validas.length, naLixeira = o.naLixeira || 0;
  const lidas = validas.filter(f => f.leitura || f.revisao), revisadas = validas.filter(f => f.etapa === "revisada");
  const base = (o.soRevisadas ? revisadas : lidas).map(f => ({ f, r: revisaoDe(f) }));
  const rs = base.map(x => x.r), n = rs.length;
  const datas = rs.map(r => r.data).filter(Boolean).sort();
  const periodo = datas.length ? `${dBr(datas[0])} a ${dBr(datas[datas.length - 1])}` : "período não informado";
  const tempo = linhaDoTempo(base.map(x => x.f), pac), resp = resumoPacientes(tempo);
  // cada procedimento já com o código emprestado resolvido (p), para as contagens por procedimento real
  const procs = rs.flatMap(r => (r.procedimentos || []).map(q => ({ ...q, p: procDe(q, r) }))).filter(q => q.p.digitos);
  const doc = new Documento();
  const tipo = o.tipo === "final" ? "final" : "parcial";

  // ---------- capa ----------
  doc.titulo(o.titulo || `Relatório ${tipo} de iniciação científica`);
  doc.subtitulo(`_${o.projeto || PROJETO}_`);
  if (o.instituicao) doc.subtitulo(o.instituicao);
  if (o.autor) doc.subtitulo(`Discente: ${o.autor}`);
  if (o.orientador) doc.subtitulo(`Orientação: ${o.orientador}`);
  doc.subtitulo(`Gerado em ${new Date().toLocaleDateString("pt-BR")} · ${fmt(n)} atendimentos (${periodo})`);

  // ---------- 1 introdução ----------
  doc.secao("1 Introdução");
  doc.paragrafo(`Este relatório ${tipo} apresenta os resultados do projeto, que tem como objetivo geral digitalizar, estruturar e analisar, de forma espacial e epidemiológica, os dados não sensíveis das fichas de atendimento da Clínica de Odontologia da Unioeste, campus de Cascavel, com ferramentas de Sistema de Informação Geográfica (SIG) e _Business Intelligence_ (BI). Os resultados estão organizados pelos objetivos específicos:`);
  for (const t of ["protocolo de transcrição seletiva e anonimização dos dados das fichas (seções 2.2 e 3.1);", "completude e qualidade do preenchimento das fichas (seção 3.7);", "indicadores para o monitoramento das ações de saúde bucal (seções 3.5 e 3.6);", "painéis interativos (seção 2.6: painel do Órbita Scanner e pacote para o Power BI);", "origem geográfica da demanda, com mapas temáticos e densidade de Kernel (seção 3.8);", "aglomerados espaciais (_clusters_) de demanda (seção 3.8)."]) doc.item(t);

  // ---------- 2 método ----------
  doc.secao("2 Material e métodos");
  doc.secao("2.1 Desenho e local do estudo", 2);
  doc.paragrafo("Estudo transversal, retrospectivo e descritivo, com abordagem quantitativa e espacial, a partir dos registros das fichas de Controle de Tratamento padrão SUS (Cód. OD-0049) preenchidas na Clínica-Escola de Odontologia da Universidade Estadual do Oeste do Paraná (Unioeste), campus de Cascavel.");
  doc.secao("2.2 Digitalização e anonimização (protocolo)", 2);
  doc.paragrafo("As fichas foram fotografadas ou digitalizadas e processadas no Órbita Scanner, aplicativo desenvolvido para esta pesquisa, que substitui a digitação manual em formulário eletrônico. Em cada imagem, o quadro impresso da ficha é localizado e endireitado; o alinhamento é conferido comparando a impressão com o modelo da ficha, e imagens que não atingem a nota mínima são excluídas ou conferidas manualmente, para evitar que dados de identificação apareçam nas cópias usadas na leitura.");
  doc.paragrafo("Os números de identificação (CPF, Cartão Nacional de Saúde, prontuário e registro do aluno) são lidos no próprio aparelho, conferidos pelo dígito verificador quando existe e convertidos em **códigos anônimos** (HMAC com chave guardada só no aparelho): o mesmo paciente recebe sempre o mesmo código, o que permite ligar consultas sem guardar o número. Nome, assinatura, endereço completo, telefone e a identificação nominal do aluno e do professor não são transcritos; do endereço, só o bairro e o município entram na análise, e a idade é calculada pela data de nascimento, que não sai do aparelho.");
  doc.paragrafo(`Os demais campos (data, horário, clínica, cor, sexo, idade, município, bairro, tipo de atendimento, dente e procedimentos com os códigos da tabela SIGTAP) foram transcritos por leitura automática de uma cópia sem identificação e ${revisadas.length ? `revisados um a um, comparando com a imagem da ficha (${fmt(revisadas.length)} fichas até agora)` : "serão revisados um a um, comparando com a imagem da ficha"}. A concordância entre a leitura automática e a revisão manual é medida campo a campo (seção 3.7).`);
  doc.secao("2.3 Critérios de inclusão e exclusão", 2);
  doc.paragrafo(`Foram incluídas todas as fichas digitalizadas. Foram excluídas as imagens em que a ficha não pôde ser reconhecida (cortada, muito torta ou ilegível) e as fichas em duplicata (mesmo paciente, data e procedimentos). ${o.soRevisadas ? "Este relatório usa apenas as fichas já revisadas manualmente." : "Este relatório usa todas as fichas já lidas, revisadas ou não."}`);
  doc.secao("2.4 Tratamento dos dados", 2);
  doc.paragrafo(`Municípios e bairros foram padronizados pelos nomes oficiais do IBGE e do GeoCascavel (a grafia livre, como "Cvel" ou "Jd.", é convertida). Os procedimentos foram classificados pelas categorias da Tabela 1 do projeto (Prevenção, Radiologia, Dentística, Odontopediatria, Ortodontia, Próteses fixas, Periodontia, Estomatologia e Patologia), com o financiamento indicado (PAB ou FAEC); os procedimentos fora dessa tabela foram agrupados pela organização da SIGTAP. ${NOTA_TABELA1}`);
  const nEmp = procs.filter(q => q.p.emprestado).length;
  if (nEmp) {
    const pelaIdade = procs.filter(q => q.p.emprestado?.pela === "idade").length;
    doc.paragrafo(`A SIGTAP não tem código para a restauração de dente permanente posterior com ionômero de vidro, e a clínica a registra com o código da restauração de dente decíduo posterior com ionômero de vidro (03.07.01.010-4). Por isso, esse código foi reclassificado como restauração de dente permanente posterior com ionômero de vidro quando o dente anotado era permanente (11 a 48)${pelaIdade ? ` ou, sem o dente anotado, quando o paciente tinha ${IDADE_PERMANENTE} anos ou mais` : ""}, e contado com as restaurações de dente permanente posterior (Dentística). Isso ocorreu em ${fmt(nEmp)} ${nEmp === 1 ? "procedimento" : "procedimentos"} (${pc(nEmp, procs.length)}% do total)${pelaIdade ? `, ${fmt(pelaIdade)} deles pela idade` : ""}. O código registrado foi mantido nas planilhas, ao lado do procedimento reclassificado.`);
  }
  const nCor = procs.filter(q => q.p.corrigido).length;
  if (nCor) {
    const corIdade = procs.filter(q => q.p.corrigido?.pela === "idade").length;
    const nPost = procs.filter(q => q.p.corrigido?.regiao === "posterior").length, nAnt = procs.filter(q => q.p.corrigido?.regiao === "anterior").length;
    const pares = [nPost && `restauração de dente decíduo posterior com resina composta (03.07.01.008-2) no lugar de restauração de dente permanente posterior com resina composta (03.07.01.012-0), em ${fmt(nPost)} ${nPost === 1 ? "procedimento" : "procedimentos"}`, nAnt && `restauração de dente decíduo anterior com resina composta (03.07.01.011-2) no lugar de restauração de dente permanente anterior com resina composta (03.07.01.003-1), em ${fmt(nAnt)} ${nAnt === 1 ? "procedimento" : "procedimentos"}`].filter(Boolean);
    doc.paragrafo(`Códigos de restauração de dente decíduo com resina composta foram anotados em dentes permanentes no lugar dos códigos correspondentes do dente permanente: ${pares.join("; e ")}, um erro de codificação ligado a tabelas de conferência de códigos desatualizadas nas clínicas. Como o estudo é retrospectivo, o código anotado foi mantido no banco, e o procedimento foi recodificado com o código do dente permanente quando o dente anotado era permanente (11 a 48)${corIdade ? ` ou, sem o dente anotado, quando o paciente tinha ${IDADE_PERMANENTE} anos ou mais` : ""}, conforme a SIGTAP. No total, isso ocorreu em ${fmt(nCor)} ${nCor === 1 ? "procedimento" : "procedimentos"} (${pc(nCor, procs.length)}% do total)${corIdade ? `, ${fmt(corIdade)} deles pela idade` : ""}.`);
  }
  doc.secao("2.5 Completude e qualidade do preenchimento", 2);
  doc.paragrafo(`A completude de cada campo é a proporção de fichas em que ele foi preenchido, classificada pela escala de Romero e Cunha (2006) segundo a proporção de campos em branco: ${ESCALA_ROMERO.map(([lim, nome], k) => `${nome.toLowerCase()} (${k === 0 ? `menos de ${lim}%` : lim === Infinity ? `${ESCALA_ROMERO[k - 1][0]}% ou mais` : `${ESCALA_ROMERO[k - 1][0]}% a ${lim}%`})`).join(", ")}. Nos campos que não são transcritos (nome, assinatura, endereço, responsável pelo preenchimento e carimbo do professor), o aplicativo apenas verifica, no próprio aparelho, se há escrita no espaço do campo, sem ler o conteúdo. A validade do CPF e do CNS foi conferida pelo dígito verificador, e a coerência entre os campos por regras automáticas (datas, idade escrita e calculada, dente na numeração FDI, procedimento de dente decíduo em dente permanente etc.).`);
  doc.secao("2.6 Indicadores e painéis", 2);
  doc.paragrafo("Os indicadores foram calculados com as fórmulas apresentadas na tabela de indicadores (seção 3.6), no total e por mês. O painel do Órbita Scanner acompanha os mesmos números durante a coleta, e o aplicativo exporta um pacote de tabelas relacionadas (atendimentos, procedimentos, municípios, bairros e calendário) para a construção dos painéis no Microsoft Power BI e das camadas no ArcGIS.");
  doc.secao("2.7 Análise espacial", 2);
  doc.paragrafo("Os pacientes da Penitenciária Industrial de Cascavel (PIC), atendidos na própria unidade, foram tratados como atendimento institucional: contam em todas as análises, mas não entram nos mapas, nas distâncias, nas taxas por habitante nem na análise de aglomerados, porque o local do atendimento não reflete a residência nem a procura espontânea pela clínica.");
  doc.paragrafo("Como o endereço não é transcrito com número, cada atendimento foi localizado de forma aproximada pelo centroide do bairro (pacientes de Cascavel, pelos limites do GeoCascavel), do distrito ou do município de residência (malha municipal do IBGE). A distância em linha reta até a clínica foi calculada pela fórmula de haversine, e o raio de cobertura é a distância que contém 50% e 90% dos atendimentos localizados.");
  doc.paragrafo("As taxas de atendimento usaram a população residente do Censo Demográfico 2022 (IBGE), por município e por bairro (setores censitários somados nos bairros do GeoCascavel), e foram suavizadas pelo estimador bayesiano empírico global (Marshall, 1991) para reduzir a instabilidade das áreas pouco populosas (Assunção; Reis, 1999). A autocorrelação espacial foi avaliada pelo índice de Moran global e pelos indicadores locais de associação espacial (LISA; Anselin, 1995), com vizinhança por fronteira comum, matriz padronizada nas linhas e pseudo-significância por 999 permutações (p < 0,05). A densidade de Kernel usou a função quártica, com o raio pela regra de Silverman (1986) adaptada; como cada atendimento só tem o bairro, os pontos foram sorteados dentro do bairro de residência, e o mapa mostra a distribuição da demanda entre os bairros, não a localização exata das residências.");
  doc.secao("2.8 Aspectos éticos", 2);
  doc.paragrafo("A pesquisa usa dados secundários desidentificados, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018): nenhum dado que permita identificar diretamente o paciente, o aluno ou o professor é transcrito, e as imagens enviadas para a leitura automática são cópias sem os campos de identificação, transmitidas e guardadas cifradas.");

  // ---------- 3 resultados ----------
  doc.secao("3 Resultados");
  doc.secao("3.1 Fichas incluídas", 2);
  const importadas = fichas.length + naLixeira, reconhecidas = validas.length + naLixeira;
  const etapas = [["Fichas digitalizadas", importadas], ["Fichas reconhecidas", reconhecidas], ["Fichas únicas", validas.length], ["Fichas lidas", lidas.length]];
  const excl = [["Não reconhecidas (cortadas, tortas ou ilegíveis)", erros], ["Duplicatas apagadas", naLixeira], ["Aguardando a leitura", validas.length - lidas.length]];
  if (o.soRevisadas) { etapas.push(["Fichas revisadas (analisadas)", revisadas.length]); excl.push(["Lidas, ainda não revisadas", lidas.length - revisadas.length]); }
  doc.paragrafo(`De ${fmt(importadas)} fichas digitalizadas, ${fmt(erros)} (${pc(erros, importadas)}%) não puderam ser reconhecidas pela qualidade da imagem e ${fmt(naLixeira)} eram duplicatas. Foram analisados **${fmt(n)} atendimentos** de **${fmt(resp.pacientes)} pacientes** distintos, entre ${periodo} (Figura ${doc.nFig + 1}).`);
  { const g = await fluxograma(etapas, excl); doc.figura("Fluxograma de inclusão das fichas", g.png, g.w, g.h, { largura: 15, fonte: "Fonte: Órbita Scanner." }); }

  // 3.2 perfil
  doc.secao("3.2 Perfil dos atendimentos", 2);
  const linhasT1 = [["Variável", "n", "%"]], destaque = [];
  for (const id of ["sexo", "faixa", "tipo", "origem", "cor"]) {
    const v = VARIAVEIS.find(x => x[0] === id), cont = contagem(rs.map(r => v[2](r) ?? "Não informado"));
    destaque.push(linhasT1.length); linhasT1.push([v[1], "", ""]);
    const ordem = [...(v[3] || [...cont.keys()].filter(k => k !== "Não informado").sort((a, b) => cont.get(b) - cont.get(a))), "Não informado"].filter(k => cont.has(k));
    for (const k of ordem) linhasT1.push([`   ${k}`, fmt(cont.get(k)), pc(cont.get(k), n)]);
  }
  doc.paragrafo(`A Tabela ${doc.nTab + 1} resume o perfil dos ${fmt(n)} atendimentos.`);
  doc.tabela("Características dos atendimentos", linhasT1, { destaque, larguras: [0.6, 0.2, 0.2], fonte: FONTE });
  {
    const nums = rs.map(r => idadeNaData(r.nascimento, r.data) ?? (r.idadeEscrita === "" || r.idadeEscrita == null ? null : +r.idadeEscrita)).filter(v => v != null && !isNaN(v) && v >= 0 && v < 120).sort((a, b) => a - b);
    if (nums.length) {
      const media = nums.reduce((a, b) => a + b, 0) / nums.length, dp = Math.sqrt(nums.reduce((a, b) => a + (b - media) ** 2, 0) / Math.max(1, nums.length - 1)), med = nums[Math.floor(nums.length / 2)];
      const pr = piramide(rs), temPir = pr.M.some(Boolean) || pr.F.some(Boolean);
      doc.paragrafo(`A idade média foi de ${dec(media)} anos (desvio-padrão de ${dec(dp)}; mediana de ${med}; de ${nums[0]} a ${nums[nums.length - 1]} anos), considerando ${fmt(nums.length)} atendimentos com idade.${temPir ? ` A Figura ${doc.nFig + 1} mostra a distribuição por idade e sexo.` : ""}`);
      if (temPir) { const g = await piramidePng(pr); doc.figura("Pirâmide etária dos atendimentos", g.png, g.w, g.h, { largura: 15, fonte: FONTE }); }
    }
  }

  // 3.3 tempo
  doc.secao("3.3 Distribuição no tempo", 2);
  const meses = [...contagem(datas.map(d => d.slice(0, 7))).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (meses.length) { const g = await colunas(meses.map(([m, v]) => [mesExt(m), v])); doc.figura("Atendimentos por mês", g.png, g.w, g.h, { largura: 15, fonte: FONTE }); }
  {
    const dt = porDiaETurno(rs), dias = DIAS_SEMANA.map((d, i) => [d, dt.dias[i]]).filter(([, v], i) => v || (i > 0 && i < 6));
    const comDia = dt.dias.reduce((a, b) => a + b, 0), comHora = n - dt.semHora;
    if (comDia) {
      const maior = dias.reduce((a, b) => b[1] > a[1] ? b : a);
      doc.paragrafo(`${maior[0]} foi o dia com mais atendimentos (${fmt(maior[1])}; ${pc(maior[1], comDia)}%).${comHora ? ` Pelo horário anotado (${fmt(comHora)} atendimentos), ${[...dt.turnos].filter(([, v]) => v).map(([t, v]) => `${pc(v, comHora)}% foram de ${t.toLowerCase()}`).join(", ")}.` : ""}`);
      const g = await colunas(dias, { h: 640 }); doc.figura("Atendimentos por dia da semana", g.png, g.w, g.h, { largura: 13, fonte: FONTE });
    }
  }

  // 3.4 clínicas
  const clin = [...contagem(rs.map(r => r.clinica || "Não informada")).entries()].sort((a, b) => b[1] - a[1]);
  doc.secao("3.4 Clínicas", 2);
  if (clin.length) doc.tabela("Atendimentos por clínica", [["Clínica", "n", "%"], ...clin.map(([k, v]) => [k, fmt(v), pc(v, n)])], { larguras: [0.6, 0.2, 0.2], fonte: `${FONTE} Quando a linha da Clínica traz o nome do professor que atendeu, ele aparece como clínica.` });
  else doc.paragrafo("Ainda não há fichas lidas.");

  // 3.5 procedimentos
  doc.secao("3.5 Procedimentos", 2);
  const inds = indicadores(base, resp), ind = (id) => inds.find(i => i.id === id);
  if (procs.length) {
    const cats = porCategoria(base), t1 = cats.filter(c => c.tabela1), fora = cats.filter(c => !c.tabela1), nT1 = t1.reduce((s, c) => s + c.n, 0);
    doc.paragrafo(`Foram registrados **${fmt(procs.length)} procedimentos** (${dec(procs.length / Math.max(1, n))} por atendimento). ${pc(nT1, procs.length)}% estão na Tabela 1 do projeto, e ${ind("escopo").num} dos ${CODIGOS_TABELA1.length} códigos da tabela (${dec(ind("escopo").valor)}%) foram feitos ao menos uma vez. A Tabela ${doc.nTab + 1} agrupa os procedimentos pelas categorias e pelo financiamento.`);
    const linhas = [["Categoria", "Financiamento", "n", "%"]], dest = [];
    for (const c of t1) linhas.push([c.categoria, c.financiamento || "–", fmt(c.n), pc(c.n, procs.length)]);
    if (fora.length) { dest.push(linhas.length); linhas.push(["Fora da Tabela 1", "", fmt(procs.length - nT1), pc(procs.length - nT1, procs.length)]); for (const c of fora) linhas.push([`   ${c.categoria}`, "", fmt(c.n), pc(c.n, procs.length)]); }
    dest.push(linhas.length); linhas.push(["Total", "", fmt(procs.length), "100,0"]);
    doc.tabela("Procedimentos pelas categorias da Tabela 1 do projeto", linhas, { destaque: dest, larguras: [0.46, 0.2, 0.17, 0.17], fonte: `${FONTE} Categorias e financiamento: Tabela 1 do projeto (Ministério da Saúde, 2010).` });
    const porChave = new Map(procs.map(q => [q.p.chave, q.p]));
    const top = [...contagem(procs.map(q => q.p.chave)).entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const temEmp = top.some(([k]) => porChave.get(k).emprestado);
    doc.tabela("Procedimentos mais frequentes", [["Procedimento (código SIGTAP)", "n", "%"], ...top.map(([k, v]) => { const p = porChave.get(k); return [`${p.nome || "Código fora da tabela"} (${p.emprestado ? `sem código; registrado como ${p.codigo}*` : p.codigo})`, fmt(v), pc(v, procs.length)]; })],
      { larguras: [0.7, 0.15, 0.15], fonte: FONTE + (temEmp ? " *Código do procedimento em dente decíduo, usado na clínica para o dente permanente, que não tem código próprio no SIGTAP (ver Método)." : "") });
    const dentes = porDente(rs), nDente = [...dentes.values()].reduce((a, b) => a + b, 0);
    if (nDente) {
      const topD = [...dentes].sort((a, b) => b[1] - a[1]).slice(0, 3);
      doc.paragrafo(`Dos procedimentos com o dente informado (${fmt(nDente)}), os dentes mais frequentes foram ${topD.map(([d, v]) => `${d} (${fmt(v)})`).join(", ")} (Figura ${doc.nFig + 1}).`);
      const g = await odontogramaPng(dentes); doc.figura("Procedimentos por dente (numeração FDI)", g.png, g.w, g.h, { largura: 16, fonte: FONTE });
    }
  } else doc.paragrafo("Ainda não há procedimentos lidos.");

  // 3.6 indicadores
  doc.secao("3.6 Indicadores", 2);
  {
    const linhas = [["Indicador", "Cálculo", "Numerador / denominador", "Valor"]];
    for (const i of inds) if (i.den) linhas.push([i.nome, i.formula, `${fmt(i.num)} / ${fmt(i.den)}`, i.unidade === "%" ? `${dec(i.valor)}%` : dec(i.valor, i.unidade === "razão" ? 2 : 1)]);
    if (linhas.length > 1) doc.tabela("Indicadores de saúde bucal da clínica", linhas, { larguras: [0.27, 0.43, 0.17, 0.13], alinhar: ["e", "e", "d", "d"], fonte: `${FONTE} Procedimentos clínicos individuais: todos, menos consultas (03.01) e exames (02).` });
    else doc.paragrafo("Os indicadores serão calculados quando houver fichas lidas.");
    const pm = indicadoresPorMes(base);
    if (pm.length >= 2) {
      const nomes = { urgencia: "Urgência (%)", primeira: "1ª consulta (%)", procAtend: "Proc./atend.", exodontia: "Exodontia perm. (%)", preventivos: "Preventivos (%)" };
      const ids = Object.keys(nomes);
      const l2 = [["Mês", "Atend.", ...ids.map(k => nomes[k])], ...pm.map(([mes, nn, li]) => [mesExt(mes), fmt(nn), ...ids.map(k => { const x = li.find(i => i.id === k); return x?.valor == null ? "–" : dec(x.valor); })])];
      doc.tabela("Indicadores por mês", l2, { larguras: [0.2, 0.1, ...ids.map(() => 0.7 / ids.length)], fonte: FONTE });
    }
  }

  // 3.7 completude
  doc.secao("3.7 Completude e qualidade do preenchimento", 2);
  const comp = completude(base, { agrupar: [["clinica", (r) => r.clinica], ["mes", (r) => r.data?.slice(0, 7)]] });
  if (n) {
    const medidos = comp.campos.filter(c => c.pct != null), ruins = medidos.filter(c => c.branco >= 20).sort((a, b) => b.branco - a.branco);
    doc.paragrafo(`A completude média dos campos foi de **${dec(comp.global)}%**. ${ruins.length ? `Os campos com mais lacunas foram ${ruins.slice(0, 4).map(c => `${c.nome.toLowerCase()} (${dec(c.branco)}% em branco)`).join(", ")}.` : "Nenhum campo ficou com 20% ou mais em branco."} A Tabela ${doc.nTab + 1} detalha cada campo.`);
    const linhas = [["Campo", "Preenchidos / avaliados", "Completude (%)", "Classificação"]], dest = [];
    let grupo = "";
    for (const c of comp.campos) {
      if (c.grupo !== grupo) { grupo = c.grupo; dest.push(linhas.length); linhas.push([grupo, "", "", ""]); }
      linhas.push([`   ${c.nome}`, c.n ? `${fmt(c.preenchidos)} / ${fmt(c.n)}` : "não medido", c.pct == null ? "–" : dec(c.pct), c.classe || "–"]);
    }
    doc.tabela("Completude dos campos da ficha", linhas, { destaque: dest, larguras: [0.42, 0.22, 0.16, 0.2], fonte: `${FONTE} Classificação: Romero e Cunha (2006). Nome, assinatura, endereço, responsável e professor: presença de escrita no campo, verificada no aparelho sem ler o conteúdo; o prontuário só existe a partir da 2ª consulta.` });
    const vc = comp.validade;
    if (vc.cpf.n || vc.cns.n) doc.paragrafo(`Entre os números preenchidos, ${vc.cpf.n ? `${dec(vc.cpf.pct)}% dos CPF (${fmt(vc.cpf.validos)} de ${fmt(vc.cpf.n)})` : ""}${vc.cpf.n && vc.cns.n ? " e " : ""}${vc.cns.n ? `${dec(vc.cns.pct)}% dos CNS (${fmt(vc.cns.validos)} de ${fmt(vc.cns.n)})` : ""} passaram no dígito verificador, depois da conferência manual dos dígitos.`);
    if (comp.inconsistencias.fichas) doc.paragrafo(`${fmt(comp.inconsistencias.fichas)} fichas (${pc(comp.inconsistencias.fichas, n)}%) tinham ao menos uma inconsistência entre campos; as mais comuns foram: ${comp.inconsistencias.tipos.slice(0, 4).map(([t, v]) => `${t} (${fmt(v)})`).join("; ")}.`);
    const porClin = [...comp.porGrupo.clinica].filter(([, v]) => v.n >= 5 && v.pct != null).sort((a, b) => b[1].pct - a[1].pct);
    if (porClin.length >= 2) doc.tabela("Completude média por clínica", [["Clínica", "Fichas", "Completude média (%)"], ...porClin.map(([k, v]) => [k, fmt(v.n), dec(v.pct)])], { larguras: [0.6, 0.15, 0.25], fonte: `${FONTE} Clínicas com 5 fichas ou mais; média da completude dos campos avaliados.` });
  } else doc.paragrafo("A completude será calculada quando houver fichas lidas.");
  const amostra = o.concordanciaIds?.length ? concordancia(fichas, o.concordanciaIds) : null, todas = concordancia(fichas);
  const c = amostra?.fichas ? amostra : todas;
  if (c.fichas) {
    const ic = (x) => { const [a, b] = wilson(x.k, x.n); return `${dec(100 * a)} a ${dec(100 * b)}`; };
    doc.paragrafo(`A concordância entre a leitura automática e a revisão manual foi medida ${amostra?.fichas ? `numa amostra aleatória de ${fmt(c.fichas)} fichas, conferidas campo a campo` : `nas ${fmt(c.fichas)} fichas revisadas`} (Tabela ${doc.nTab + 1}). No total, **${pc(c.total.k, c.total.n)}%** dos campos lidos não precisaram de correção, e ${fmt(c.fichasIguais)} fichas (${pc(c.fichasIguais, c.fichas)}%) não tiveram nenhuma correção.`);
    const linhas = [["Campo", "Iguais / comparados", "Concordância (%)", "IC 95% (%)"],
      ...CAMPOS_CONC.filter(([k]) => c.por[k].n).map(([k, nome]) => [nome, `${fmt(c.por[k].k)} / ${fmt(c.por[k].n)}`, pc(c.por[k].k, c.por[k].n), ic(c.por[k])]),
      ["Procedimento a procedimento", `${fmt(c.procs.k)} / ${fmt(c.procs.n)}`, pc(c.procs.k, c.procs.n), ic(c.procs)],
      ["Todos os campos", `${fmt(c.total.k)} / ${fmt(c.total.n)}`, pc(c.total.k, c.total.n), ic(c.total)]];
    doc.tabela("Concordância entre a leitura automática e a revisão manual", linhas, { destaque: [linhas.length - 1], larguras: [0.34, 0.24, 0.2, 0.22], fonte: "Fonte: Órbita Scanner. IC 95%: intervalo de confiança de Wilson." });
  }
  const corrCampo = new Map(); let corrNum = 0, autoNum = 0;
  for (const f of validas) for (const h of f.historico || []) {
    for (const m of h.mudou || []) corrCampo.set(m.campo, (corrCampo.get(m.campo) || 0) + 1);
    if (h.numeros?.length) corrNum++;
    if (/sozinhos/.test(h.acao)) autoNum++;
  }
  const comNumeros = validas.filter(f => f.tokens && Object.keys(f.tokens).length).length;
  if (comNumeros) doc.paragrafo(`Dos números de identificação, ${fmt(autoNum)} fichas (${pc(autoNum, comNumeros)}%) tiveram todos os números conferidos automaticamente pelo dígito verificador, e em ${fmt(corrNum)} ao menos um dígito foi corrigido manualmente.${corrCampo.size ? ` Na revisão, os campos mais corrigidos foram: ${[...corrCampo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${(NOMES_CAMPOS[k] || k).toLowerCase()} (${fmt(v)})`).join(", ")}.` : ""}`);

  // 3.8 espacial
  doc.secao("3.8 Distribuição espacial da demanda", 2);
  const cascavel = rs.filter(r => !ehPIC(r) && /cascavel/i.test(r.municipio || "")).length;
  const munis = [...contagem(rs.filter(r => r.municipio && !ehPIC(r)).map(r => r.municipio)).entries()].sort((a, b) => b[1] - a[1]);
  doc.paragrafo(`${pc(cascavel, n)}% dos atendimentos foram de pacientes de Cascavel (${fmt(cascavel)}). ${munis.length > 1 ? `Os outros municípios mais frequentes foram ${munis.filter(([m]) => !/^cascavel$/i.test(m)).slice(0, 5).map(([m, v]) => `${m} (${fmt(v)})`).join(", ")}.` : ""}`);
  const pic = rs.filter(ehPIC);
  if (pic.length) {
    const pp = pic.flatMap(r => (r.procedimentos || []).map(q => procDe(q, r))).filter(p => p.digitos);
    const topPic = [...contagem(pp.map(p => p.nome || p.codigo)).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    doc.paragrafo(`**${fmt(pic.length)} atendimentos (${pc(pic.length, n)}%) foram institucionais, na Penitenciária Industrial de Cascavel (PIC)**, com ${fmt(pp.length)} procedimentos${topPic.length ? `, sobretudo ${topPic.map(([k, v]) => `${k.toLowerCase()} (${fmt(v)})`).join(", ")}` : ""}. Eles ficam fora das análises espaciais a seguir.`);
  }
  const dist = distancias(rs);
  if (dist.n) {
    doc.paragrafo(`Considerando os ${fmt(dist.n)} atendimentos localizados (${fmt(dist.nivel.bairro)} pelo bairro, ${fmt(dist.nivel.distrito)} pelo distrito e ${fmt(dist.nivel.municipio)} pelo município), a mediana da distância até a clínica foi de **${dec(dist.mediana)} km**; metade da demanda veio de até ${dec(dist.raio50)} km e 90% de até **${dec(dist.raio90)} km** (raio de cobertura). ${pc(dist.ate5, dist.n)}% moravam a até 5 km.${dist.nivel.cidade ? ` ${fmt(dist.nivel.cidade)} atendimentos de Cascavel sem bairro ficaram de fora do cálculo.` : ""}`);
    const g = await colunas(dist.faixas, { h: 640 }); doc.figura("Atendimentos por distância da residência até a clínica", g.png, g.w, g.h, { largura: 14, fonte: `${FONTE} Distância em linha reta do centroide do bairro, distrito ou município até a clínica.` });
  }
  const cBairros = contarMapa("bairros", rs);
  if ([...cBairros.cont.values()].some(Boolean)) {
    const g = await mapa("bairros", cBairros.cont);
    doc.figura("Atendimentos de pacientes de Cascavel por bairro", g.png, g.w, g.h, { largura: 15, fonte: `${FONTE} Limites dos bairros: GeoCascavel. ${cBairros.fora ? `${fmt(cBairros.fora)} atendimentos ${cBairros.foraTxt}.` : ""}` });
    const tx = taxas(rs, "bairros", 1000).filter(t => t.pop);
    const suav = bayesEmpirico(tx.map(t => t.n), tx.map(t => t.pop)).map(v => v * 1000);
    tx.forEach((t, k) => (t.eb = suav[k]));
    const ordem = tx.slice().sort((a, b) => b.eb - a.eb);
    doc.paragrafo(`Em relação à população (Censo 2022), as maiores taxas de atendimento foram nos bairros ${ordem.slice(0, 3).map(t => `${t.nome} (${dec(t.eb, 2)} por 1.000 habitantes)`).join(", ")}, e as menores em ${ordem.slice(-3).reverse().map(t => `${t.nome} (${dec(t.eb, 2)})`).join(", ")}. Bairros com taxa baixa e distantes da clínica são candidatos a vazios assistenciais (Figura ${doc.nFig + 1}).`);
    const g2 = await mapa("bairros", new Map(tx.map(t => [norm(t.nome), +t.eb.toFixed(2)])), { legenda: "Por 1.000 hab.:", casas: 1 });
    doc.figura("Taxa de atendimentos por 1.000 habitantes, por bairro de Cascavel (bayesiana empírica)", g2.png, g2.w, g2.h, { largura: 15, fonte: `${FONTE} População: IBGE, Censo Demográfico 2022; limites: GeoCascavel.` });
    const pts = [];
    MAPAS.bairros.itens.forEach(([nome, d], i) => { const k = cBairros.cont.get(norm(nome)) || 0; if (k) pts.push(...pontosNaForma(d, k, i + 1)); });
    if (pts.length >= 20) {
      const kmUn = kmPorUnidade("bairros"), raio = raioKernel(pts, kmUn);
      const gk = await kernelPng("bairros", pts, raio, kmUn, { clinica: projetar("bairros", CLINICA.lon, CLINICA.lat) });
      doc.figura(`Densidade de Kernel dos atendimentos na área urbana de Cascavel (raio de ${dec(raio, 1)} km)`, gk.png, gk.w, gk.h, { largura: 15, fonte: `${FONTE} Kernel quártico; cada atendimento representado por um ponto sorteado dentro do seu bairro.` });
    }
    const vals = GEO.bairros.itens.map((_, i) => { const t = tx.find(x => x.i === i); return t ? t.eb : null; });
    const m = cBairros.cont.size >= 5 && n >= 30 ? moran(vals, GEO.bairros.itens.map(g => g[4])) : null;
    if (m) {
      const quad = quadrantes(m);
      const nomes = (q) => [...quad].filter(([, x]) => x === q).map(([i]) => MAPAS.bairros.itens[i][0]);
      const altos = nomes("Alto-Alto"), baixos = nomes("Baixo-Baixo");
      doc.paragrafo(`O índice de Moran global da taxa por bairro foi de ${dec(m.I, 3)} (${pval(m.p)}; esperado sob aleatoriedade: ${dec(m.esperado, 3)}), ${m.p < 0.05 ? (m.I > 0 ? "indicando que bairros vizinhos tendem a ter taxas parecidas (autocorrelação positiva)" : "indicando autocorrelação negativa") : "sem evidência de autocorrelação espacial"}. ${altos.length ? `O LISA apontou aglomerado de taxas altas (Alto-Alto) em ${altos.join(", ")}` : "O LISA não apontou aglomerado de taxas altas"}${baixos.length ? ` e de taxas baixas (Baixo-Baixo) em ${baixos.join(", ")}` : ""} (Figura ${doc.nFig + 1}).`);
      const gl = await lisaPng("bairros", quad, { rotulos: true });
      doc.figura("Aglomerados locais (LISA) da taxa de atendimentos por bairro", gl.png, gl.w, gl.h, { largura: 15, fonte: `${FONTE} LISA com 999 permutações, p < 0,05.` });
    }
    // aglomerados de demanda por tratamentos específicos: proporção de cada categoria no bairro
    const cats = porCategoria(base).filter(c => c.tabela1 && c.n >= 30);
    const linhasC = [];
    let melhor = null;
    for (const cat of cats) {
      const nb = GEO.bairros.itens.map(() => 0), tb = GEO.bairros.itens.map(() => 0);
      for (const r of rs) {
        const l = local(r); if (l?.camada !== "bairros") continue;
        for (const q of r.procedimentos || []) { const p = procDe(q, r); if (!p.digitos) continue; tb[l.i]++; const k = categoriaTabela1(p); if (k.tabela1 && k.categoria === cat.categoria && k.financiamento === cat.financiamento) nb[l.i]++; }
      }
      const idx = tb.map((t, i) => t ? i : -1).filter(i => i >= 0);
      if (idx.length < 8) continue;
      const eb = bayesEmpirico(idx.map(i => nb[i]), idx.map(i => tb[i]));
      const v = GEO.bairros.itens.map(() => null); idx.forEach((i, k) => (v[i] = eb[k]));
      const mm = moran(v, GEO.bairros.itens.map(g => g[4]), { semente: 11 });
      if (!mm) { linhasC.push([`${cat.categoria}${cat.financiamento ? ` (${cat.financiamento})` : ""}`, "–", "–", "sem variação entre os bairros além do acaso"]); continue; }
      const hh = mm.locais.map((l, i) => l?.quadrante === "Alto-Alto" ? MAPAS.bairros.itens[i][0] : null).filter(Boolean);
      linhasC.push([`${cat.categoria}${cat.financiamento ? ` (${cat.financiamento})` : ""}`, dec(mm.I, 3), pval(mm.p).replace(/^p = /, "").replace(/^p /, ""), hh.join(", ") || "–"]);
      if (mm.p < 0.05 && mm.I > 0 && (!melhor || mm.p < melhor.m.p)) melhor = { m: mm, cat };
    }
    if (linhasC.length) {
      doc.paragrafo(`Para investigar aglomerados de demandas por tratamentos específicos, a proporção de cada categoria de procedimento no total de procedimentos do bairro (suavizada por Bayes empírico) foi testada pelo índice de Moran (Tabela ${doc.nTab + 1}).`);
      doc.tabela("Autocorrelação espacial da proporção de cada categoria de procedimento nos bairros de Cascavel", [["Categoria", "Moran (I)", "p", "Aglomerados Alto-Alto (LISA)"], ...linhasC], { larguras: [0.3, 0.14, 0.14, 0.42], alinhar: ["e", "d", "d", "e"], fonte: `${FONTE} Categorias com 30 procedimentos ou mais; 999 permutações.` });
      if (melhor) {
        const gl = await lisaPng("bairros", quadrantes(melhor.m), { rotulos: true });
        doc.figura(`Aglomerados locais (LISA) da proporção de procedimentos de ${melhor.cat.categoria.toLowerCase()} por bairro`, gl.png, gl.w, gl.h, { largura: 15, fonte: `${FONTE} LISA com 999 permutações, p < 0,05.` });
      }
    }
  }
  const cPr = contarMapa("parana", rs);
  if ([...cPr.cont.keys()].some(k => k !== "cascavel")) {
    const g = await mapa("parana", cPr.cont);
    doc.figura("Atendimentos por município do Paraná", g.png, g.w, g.h, { largura: 15, fonte: `${FONTE} Malha municipal: IBGE (2025).${cPr.fora ? ` ${fmt(cPr.fora)} atendimentos de fora do Paraná ou sem município.` : ""}` });
    const reg = regiaoCascavel(), tx = taxas(rs, "parana", 10000).filter(t => reg.includes(t.i) && t.pop);
    const eb = bayesEmpirico(tx.map(t => t.n), tx.map(t => t.pop)).map(v => v * 10000);
    const vals = GEO.parana.itens.map(() => null); tx.forEach((t, k) => (vals[t.i] = eb[k]));
    const comAtend = tx.filter(t => t.n).length;
    const m = comAtend >= 5 ? moran(vals, vizinhosEm("parana", reg), { semente: 5 }) : null;
    const ordem = tx.map((t, k) => ({ ...t, eb: eb[k] })).filter(t => t.n).sort((a, b) => b.eb - a.eb);
    doc.paragrafo(`Na Região Geográfica Intermediária de Cascavel (${reg.length} municípios), ${comAtend} municípios tiveram ao menos um atendimento. Fora Cascavel, as maiores taxas foram em ${ordem.filter(t => t.nome !== "Cascavel").slice(0, 4).map(t => `${t.nome} (${dec(t.eb, 2)} por 10 mil habitantes)`).join(", ") || "–"}.${m ? ` O índice de Moran global foi de ${dec(m.I, 3)} (${pval(m.p)}), ${m.p < 0.05 && m.I > 0 ? "com municípios vizinhos de taxas parecidas, o que indica um aglomerado regional da demanda" : "sem evidência de aglomeração regional"}.` : ""}`);
    if (m) {
      const gl = await lisaPng("parana", quadrantes(m), { indices: reg, rotulos: true });
      doc.figura("Aglomerados locais (LISA) da taxa de atendimentos por município da região intermediária de Cascavel", gl.png, gl.w, gl.h, { largura: 15, fonte: `${FONTE} Taxa por 10 mil habitantes (Censo 2022), suavizada por Bayes empírico; LISA com 999 permutações, p < 0,05.` });
    }
  }

  // 3.9 pacientes
  doc.secao("3.9 Retorno dos pacientes", 2);
  doc.paragrafo(`Os ${fmt(n)} atendimentos correspondem a ${fmt(resp.pacientes)} pacientes (ligados pelo código anônimo do CPF, do CNS ou do prontuário). ${fmt(resp.comRetorno)} pacientes (${pc(resp.comRetorno, resp.pacientes)}%) tiveram dois ou mais atendimentos no período, com média de ${dec(resp.media)} atendimentos por paciente${resp.medianaDias != null ? ` e mediana de ${Math.round(resp.medianaDias)} dias entre consultas consecutivas` : ""}.`);

  // 3.10 tabela cruzada
  const cz = o.cruzada || { lin: "faixa", col: "sexo" };
  let t = cruzar(rs, cz.lin, cz.col);
  if (t.colunas.length > t.linhas.length) t = cruzar(rs, cz.col, cz.lin);
  const q = quiQuadrado(t), soPct = t.colunas.length > 4;
  if (t.total) {
    doc.secao("3.10 Associação entre variáveis", 2);
    const linhas = [[`${t.nomeLin} × ${t.nomeCol}`, ...t.colunas, "Total"]];
    const cel = (v, b) => soPct ? pc(v, b) : `${fmt(v)} (${pc(v, b)}%)`;
    t.linhas.forEach((l, i) => linhas.push([l, ...t.colunas.map((_, j) => cel(t.n[i][j], t.totLin[i])), fmt(t.totLin[i])]));
    linhas.push(["Total", ...t.totCol.map(v => cel(v, t.total)), fmt(t.total)]);
    const nc = t.colunas.length + 2;
    doc.tabela(`${t.nomeLin} segundo ${t.nomeCol.toLowerCase()} (${soPct ? "% na linha; n no total" : "n e % na linha"})`, linhas, { destaque: [linhas.length - 1], larguras: [0.3, ...Array(nc - 1).fill(0.7 / (nc - 1))],
      fonte: `${FONTE} Unidade: ${t.unidade}.${q ? ` Teste qui-quadrado de independência: χ² = ${dec(q.qui2, 2)}; gl = ${q.gl}; ${pval(q.p)}.${q.baixos > 0.2 ? ` ${Math.round(q.baixos * 100)}% das células com valor esperado menor que 5 (interpretar com cautela; considerar o teste exato de Fisher).` : ""}` : ""}` });
    if (q) doc.paragrafo(q.p < 0.05 ? `Houve associação estatisticamente significativa entre ${t.nomeLin.toLowerCase()} e ${t.nomeCol.toLowerCase()} (${pval(q.p)}).` : `Não houve associação estatisticamente significativa entre ${t.nomeLin.toLowerCase()} e ${t.nomeCol.toLowerCase()} (${pval(q.p)}).`);
  }

  // 3.11 comparação com a produção oficial (SIA/SUS) dos dois CNES (oficial.js)
  const cs = o.sia ? compararSIA(base, o.sia) : null;
  if (cs && cs.meses.length) {
    doc.secao("3.11 Comparação com a produção oficial (SIA/SUS)", 2);
    doc.paragrafo(`De ${mesSIA(cs.periodo[0])} a ${mesSIA(cs.periodo[1])} (meses com fichas e com produção publicada), as fichas digitalizadas somam ${fmt(cs.fichas)} procedimentos, e o Sistema de Informações Ambulatoriais do SUS registra ${fmt(cs.sia)} procedimentos aprovados para os estabelecimentos da clínica (CNES 3523365, Unioeste Odontologia, e 6391915, CEO III Unioeste), uma razão de ${pc(cs.fichas, cs.sia)}%. A comparação usa o código como foi escrito na ficha, que é o faturado. Diferenças refletem fichas ainda não digitalizadas, procedimentos que não passam pela ficha de controle de tratamento, glosas e erros de codificação.`);
    if (cs.meses.length <= 24) doc.tabela("Procedimentos por mês: fichas digitalizadas e produção aprovada no SIA/SUS", [["Mês", "Fichas", "SIA/SUS", "Fichas ÷ SIA (%)"], ...cs.meses.map(m => [mesSIA(m.mes), fmt(m.fichas), fmt(m.sia), pc(m.fichas, m.sia)])], { larguras: [0.25, 0.25, 0.25, 0.25], fonte: `${FONTE} e SIA/SUS (DATASUS), competência do atendimento.` });
    const top = cs.procs.filter(p => p.sia).slice(0, 12);
    if (top.length) doc.tabela("Procedimentos mais apresentados ao SIA/SUS e os registrados nas fichas", [["Procedimento (código SIGTAP)", "Fichas", "SIA/SUS", "%"], ...top.map(p => [`${p.nome} (${p.codigo})`, fmt(p.fichas), fmt(p.sia), pc(p.fichas, p.sia)])], { larguras: [0.55, 0.15, 0.15, 0.15], fonte: `${FONTE} e SIA/SUS (DATASUS).` });
    const dec = cs.deciduo.filter(d => d.sia);
    if (dec.length) doc.paragrafo(`Os códigos de restauração de dente decíduo com resina composta aparecem também na produção oficial (${dec.map(d => `${d.codigo}: ${fmt(d.sia)}`).join("; ")}), o que indica que parte dos procedimentos em dente permanente anotados com esses códigos foi faturada como decíduo.`);
  }

  // ---------- 4 cronograma ----------
  doc.secao("4 Andamento do cronograma");
  doc.tabela("Atividades previstas e situação", [["Atividade", "Período previsto", "Situação"],
    ["A. Revisão bibliográfica", "set. a out./2026", "Conforme o projeto (completar)"],
    ["B. Protocolo, digitalização e tratamento dos dados (ETL)", "set./2026 a mai./2027", `${fmt(importadas)} fichas digitalizadas; ${fmt(lidas.length)} lidas e ${fmt(revisadas.length)} revisadas`],
    ["C. Completude e qualidade do preenchimento", "out./2026 a jun./2027", n ? `Calculada para ${fmt(n)} atendimentos (seção 3.7)` : "Aguardando fichas lidas"],
    ["D. Origem geográfica e aglomerados espaciais (SIG)", "nov./2026 a jun./2027", n ? "Mapas, taxas, Kernel e Moran/LISA (seção 3.8)" : "Aguardando fichas lidas"],
    ["E. Indicadores e painéis (BI)", "mar. a jun./2027", n ? "Indicadores (seção 3.6); painel do Órbita Scanner e pacote para o Power BI" : "Aguardando fichas lidas"],
    ["F. Relatórios (parcial e final)", "fev. e mar./2027; jul. e ago./2027", tipo === "final" ? "Relatório final (este documento)" : "Relatório parcial (este documento)"],
  ], { larguras: [0.4, 0.22, 0.38], alinhar: ["e", "e", "e"], fonte: "Fonte: cronograma do projeto; situação pelos dados do Órbita Scanner na data de geração." });

  // ---------- 5 limitações ----------
  doc.secao("5 Limitações e próximos passos");
  const semData = rs.filter(r => !r.data).length, semSexo = rs.filter(r => !r.sexo).length, semIdade = rs.filter(r => VARIAVEIS[0][2](r) == null).length;
  doc.item(`${fmt(erros)} fichas não puderam ser processadas pela qualidade da digitalização${erros ? " e não entram nas análises" : ""}.`);
  if (semData || semSexo || semIdade) doc.item(`Campos em branco ou ilegíveis: data em ${fmt(semData)}, sexo em ${fmt(semSexo)} e idade em ${fmt(semIdade)} atendimentos.`);
  if (!o.soRevisadas && lidas.length > revisadas.length) doc.item(`${fmt(lidas.length - revisadas.length)} atendimentos ainda não foram revisados; os números podem mudar depois da revisão.`);
  doc.item("Pacientes sem CPF, CNS ou prontuário preenchidos não puderam ser ligados entre consultas, o que pode subestimar os retornos.");
  if (cs && cs.meses.length) doc.item("A produção do SIA/SUS é publicada com alguns meses de atraso e soma os dois estabelecimentos; procedimentos sem ficha de controle de tratamento (como os de outros setores) entram só no SIA.");
  doc.item("A localização pelo centroide do bairro ou do município não permite análise dentro do bairro; a densidade de Kernel e as distâncias são aproximadas.");
  doc.item("As taxas usam a população total do Censo 2022 como denominador; a clínica não atende toda a população, e as taxas medem a captação relativa entre as áreas.");
  doc.nota("Relatório gerado automaticamente pelo Órbita Scanner a partir dos dados do aparelho. Nenhum dado de identificação dos pacientes consta deste documento. Confira os números antes de usá-los.");

  // ---------- referências ----------
  doc.secao("Referências");
  for (const r of REFERENCIAS) doc.referencia(r);

  if (o.figuras) return figurasDoRelatorio(doc);
  return doc.gerar({ titulo: o.titulo || "Relatório da IC", autor: o.autor || "" });
}

const REFERENCIAS = [
  "ANSELIN, L. Local indicators of spatial association — LISA. **Geographical Analysis**, v. 27, n. 2, p. 93-115, 1995.",
  "ASSUNÇÃO, R. M.; REIS, E. A. A new proposal to adjust Moran's I for population density. **Statistics in Medicine**, v. 18, n. 16, p. 2147-2162, 1999.",
  "BRASIL. Ministério da Saúde. **SIGTAP**: Sistema de Gerenciamento da Tabela de Procedimentos, Medicamentos e OPM do SUS. Brasília: DATASUS. Disponível em: http://sigtap.datasus.gov.br.",
  "BRASIL. Ministério da Saúde. DATASUS. **Sistema de Informações Ambulatoriais do SUS (SIA/SUS)**: arquivos de produção ambulatorial (PA). Brasília: Ministério da Saúde, 2026. Disponível em: ftp://ftp.datasus.gov.br/dissemin/publicos/SIASUS/. Acesso em: 2026.",
  "CAETANO, C. S.; ORFÃO, N. H. Prontuário eletrônico do paciente em clínicas odontológicas: uma revisão integrativa. **Journal of Health Informatics**, v. 13, p. 93-99, 2021.",
  "CASCAVEL. Prefeitura Municipal. **GeoCascavel**: limites de bairros e distritos e cadastro de logradouros. Cascavel. Disponível em: https://geocascavel.cascavel.pr.gov.br.",
  "FIGUEIREDO, N. et al. Observatório de Saúde Bucal/UFPE: ações estratégicas de gestão da informação e de saúde digital em saúde bucal para melhoria da governança no SUS. **Revista da ABENO**, v. 21, 1644, 2021.",
  "GONDIM, F. M. L. et al. A utilização do prontuário eletrônico odontológico: revisão narrativa da literatura. **Research, Society and Development**, v. 11, e520111536866, 2022.",
  "INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA (IBGE). **Censo Demográfico 2022**: população residente e agregados por setores censitários. Rio de Janeiro: IBGE, 2023-2026.",
  "INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA (IBGE). **Malha municipal digital do Brasil**: 2025. Rio de Janeiro: IBGE, 2025.",
  "MARSHALL, R. J. Mapping disease and mortality rates using empirical Bayes estimators. **Journal of the Royal Statistical Society: Series C (Applied Statistics)**, v. 40, n. 2, p. 283-294, 1991.",
  "MOREIRA, R. S.; NICO, L. S.; TOMITA, N. E. A relação entre o espaço e a saúde bucal coletiva: por uma epidemiologia georreferenciada. **Ciência & Saúde Coletiva**, v. 12, p. 275-284, 2007.",
  "ROMERO, D. E.; CUNHA, C. B. Avaliação da qualidade das variáveis sócio-econômicas e demográficas dos óbitos de crianças menores de um ano registrados no Sistema de Informações sobre Mortalidade do Brasil (1996/2001). **Cadernos de Saúde Pública**, v. 22, n. 3, p. 673-684, 2006.",
  "SILVERMAN, B. W. **Density estimation for statistics and data analysis**. London: Chapman and Hall, 1986.",
  "TORRES, D. R. et al. Aplicabilidade e potencialidades no uso de ferramentas de Business Intelligence na Atenção Primária em Saúde. **Ciência & Saúde Coletiva**, v. 26, p. 2065-2074, 2021.",
];
