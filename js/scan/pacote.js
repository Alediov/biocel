// Pacote para o Power BI e o ArcGIS (.zip): tabelas relacionadas em CSV (vírgula, ponto decimal, UTF-8) e camadas
// GeoJSON com contagens e taxas por bairro e por município. Mesmo nível de dados da planilha: códigos no lugar de
// identificação, idade no lugar da data de nascimento; a localização é só o centroide do bairro, distrito ou município.
import { zip, csv } from "./arquivos.js";
import { revisaoDe, PERMANENTE, DECIDUO } from "./analises.js";
import { procedimento, procDe, idadeNaData } from "./processar.js";
import { categoriaTabela1, turno, DIAS_SEMANA, CAMPOS_COMPLETUDE, completude, indicadoresPorMes } from "./indicadores.js";
import { local, item, distanciaKm, CLINICA, taxas, bayesEmpirico, desprojetar } from "./geo.js";
import { MAPAS } from "./mapas.js";

const faixa = (i) => i == null ? "" : i <= 12 ? "0 a 12" : i <= 17 ? "13 a 17" : i <= 39 ? "18 a 39" : i <= 59 ? "40 a 59" : "60 ou mais";
const r4 = (v) => v == null || !isFinite(v) ? "" : Math.round(v * 1e4) / 1e4;
const r2 = (v) => v == null || !isFinite(v) ? "" : Math.round(v * 100) / 100;
const tab = (linhas) => csv({ linhas }, ",");

/** Polígonos do mapa (quadro) → GeoJSON em lon/lat. */
function geometria(camada, d) {
  const aneis = d.split("M").filter(Boolean).map(p => { const ns = p.replace("Z", "").trim().split(/\s+/).map(Number), a = []; for (let i = 0; i < ns.length; i += 2) a.push(desprojetar(camada, ns[i], ns[i + 1]).map(v => Math.round(v * 1e5) / 1e5)); if (a.length) a.push(a[0]); return a; });
  return { type: "MultiPolygon", coordinates: aneis.map(a => [a]) };
}

export async function pacoteBI(fichas, pac, { soRevisadas = false } = {}) {
  const lista = fichas.filter(f => f.etapa !== "erro" && (f.leitura || f.revisao) && (!soRevisadas || f.etapa === "revisada"));
  const base = lista.map(f => ({ f, r: revisaoDe(f) }));
  const at = [["id_atendimento", "codigo_paciente", "data", "ano_mes", "dia_semana", "turno", "horario", "clinica", "tipo_atendimento", "sexo", "cor", "idade", "faixa_etaria", "municipio", "cod_ibge_municipio", "bairro", "local_nivel", "lat", "lon", "distancia_km", "n_procedimentos", "revisada"]];
  const pr = [["id_atendimento", "ordem", "dente", "dente_tipo", "codigo_sigtap", "procedimento", "codigo_emprestado", "codigo_anotado", "categoria", "financiamento", "na_tabela1_projeto"]];
  const comp = [["id_atendimento", ...CAMPOS_COMPLETUDE.map(c => c[0])]];
  const datas = new Set();
  base.forEach(({ f, r }, k) => {
    const id = `AT${String(k + 1).padStart(5, "0")}`, idade = idadeNaData(r.nascimento, r.data) ?? (r.idadeEscrita === "" || r.idadeEscrita == null ? null : +r.idadeEscrita);
    let dia = "";
    if (r.data) { const [a, m, d] = r.data.split("-").map(Number); dia = DIAS_SEMANA[new Date(a, m - 1, d).getDay()]; datas.add(r.data); }
    const l = local(r), it = l && !l.fora && !l.institucional ? item(l.camada, l.i) : null;
    const munCod = l?.institucional ? "4104808" : it ? (l.camada === "parana" ? it.cod : "4104808") : ""; // bairro, distrito e PIC: Cascavel
    const tipo = [r.urgencia && "Urgência/Emergência", r.primeira && "Primeira consulta", r.retorno && "Retorno"].filter(Boolean).join(" + ");
    const procs = (r.procedimentos || []).filter(q => procedimento(q.codigo).digitos);
    at.push([id, pac(f) || "", r.data || "", r.data ? r.data.slice(0, 7) : "", dia, turno(r.horario) || "", r.horario || "", r.clinica || "", tipo, r.sexo || "", r.cor || "", idade ?? "", faixa(idade), r.municipio || "", munCod, r.bairro || "",
      l?.fora ? "fora do PR" : l?.institucional ? "institucional (PIC)" : l?.nivel || "", it && l.nivel !== "cidade" ? r4(it.lat) : "", it && l.nivel !== "cidade" ? r4(it.lon) : "", it && l.nivel !== "cidade" ? r2(distanciaKm(CLINICA, it)) : "", procs.length, f.etapa === "revisada" ? "sim" : "não"]);
    procs.forEach((q, i) => {
      const p = procDe(q, r), c = categoriaTabela1(p), d = String(q.dente || "").trim();
      pr.push([id, i + 1, d, PERMANENTE.test(d) ? "permanente" : DECIDUO.test(d) ? "decíduo" : d ? "inválido" : "", p.codigo, p.nome || "", p.emprestado ? "sim" : "não", p.corrigido ? p.corrigido.de : p.codigo, c.categoria, c.financiamento, c.tabela1 ? "sim" : "não"]);
    });
    comp.push([id, ...CAMPOS_COMPLETUDE.map(([, , , fn]) => { const v = fn(f, r); return v == null ? "" : v ? 1 : 0; })]);
  });
  // dimensões
  const tm = taxas(base.map(x => x.r), "parana", 10000), tb = taxas(base.map(x => x.r), "bairros", 1000).filter(t => t.pop);
  const ebB = bayesEmpirico(tb.map(t => t.n), tb.map(t => t.pop)).map(v => v * 1000);
  const mun = [["cod_ibge", "municipio", "regiao_intermediaria", "lat", "lon", "area_km2", "populacao_2022", "atendimentos", "taxa_10mil_hab", "distancia_km"],
    ...tm.map(t => { const it = item("parana", t.i); return [it.cod, it.nome, it.rg, r4(it.lat), r4(it.lon), it.area, it.pop ?? "", t.n, r4(t.taxa), r2(distanciaKm(CLINICA, it))]; })];
  const bai = [["bairro", "lat", "lon", "area_km2", "populacao_2022", "pct_pop_favela", "atendimentos", "taxa_1000_hab", "taxa_1000_hab_bayes", "distancia_km"],
    ...tb.map((t, k) => { const it = item("bairros", t.i); return [it.nome, r4(it.lat), r4(it.lon), it.area, it.pop, it.favela ?? "", t.n, r4(t.taxa), r4(ebB[k]), r2(distanciaKm(CLINICA, it))]; })];
  const cal = [["data", "ano", "mes", "ano_mes", "dia_semana", "semana_do_ano"]];
  for (const d of [...datas].sort()) {
    const [a, m, dd] = d.split("-").map(Number), dt = new Date(a, m - 1, dd), ini = new Date(a, 0, 1);
    cal.push([d, a, m, d.slice(0, 7), DIAS_SEMANA[dt.getDay()], Math.ceil(((dt - ini) / 864e5 + ini.getDay() + 1) / 7)]);
  }
  const c = completude(base);
  const compRes = [["campo", "grupo", "avaliados", "preenchidos", "completude_pct", "classificacao_romero_cunha"], ...c.campos.map(x => [x.nome, x.grupo, x.n, x.preenchidos, r2(x.pct), x.classe])];
  const im = [["ano_mes", "atendimentos", "indicador", "numerador", "denominador", "valor", "unidade"]];
  for (const [mes, n, li] of indicadoresPorMes(base, ["urgencia", "primeira", "retornoTipo", "procAtend", "preventivos", "exodontia", "exoTodas", "restExo", "deciduos", "foraCascavel", "pab", "faec"])) for (const i of li) im.push([mes, n, i.nome, i.num, i.den, r4(i.valor), i.unidade]);
  // camadas
  const geoB = { type: "FeatureCollection", features: MAPAS.bairros.itens.map(([nome, d], i) => { const t = tb.find(x => x.i === i), k = tb.indexOf(t), it = item("bairros", i); return { type: "Feature", properties: { bairro: nome, populacao_2022: it.pop, pct_pop_favela: it.favela, atendimentos: t?.n || 0, taxa_1000_hab: t ? r4(t.taxa) : null, taxa_1000_hab_bayes: t ? r4(ebB[k]) : null }, geometry: geometria("bairros", d) }; }) };
  const geoM = { type: "FeatureCollection", features: MAPAS.parana.itens.map(([nome, d], i) => { const t = tm[i], it = item("parana", i); return { type: "Feature", properties: { cod_ibge: it.cod, municipio: nome, regiao_intermediaria: it.rg, populacao_2022: it.pop, atendimentos: t.n, taxa_10mil_hab: r4(t.taxa) }, geometry: geometria("parana", d) }; }) };
  const leia = `Órbita Scanner: pacote para o Power BI e o ArcGIS (gerado em ${new Date().toLocaleString("pt-BR")})
${base.length} atendimentos${soRevisadas ? " (só as fichas revisadas)" : " (fichas lidas, revisadas ou não)"}.

TABELAS (CSV, separador vírgula, ponto decimal, UTF-8):
- atendimentos.csv: um atendimento por linha (chave id_atendimento). codigo_paciente liga as consultas do mesmo paciente
  (gerado no aparelho; não é o CPF). lat/lon: centroide do bairro (Cascavel), do distrito ou do município de residência;
  vazio para Cascavel sem bairro. distancia_km: linha reta até a clínica.
- procedimentos.csv: um procedimento por linha (id_atendimento -> atendimentos), com a categoria da Tabela 1 do projeto.
  codigo_emprestado = sim: 03.07.01.010-4 (restauração de decíduo posterior com ionômero de vidro) usado para o dente
  permanente, que não tem código próprio no SIGTAP; "procedimento" e a categoria já são os do permanente.
  codigo_anotado: o código escrito na ficha. Difere de codigo_sigtap quando um código de resina de decíduo foi anotado
  em dente permanente (ou, sem dente, em paciente de 13 anos ou mais): 03.07.01.008-2 (decíduo posterior) conta como
  03.07.01.012-0 (permanente posterior) e 03.07.01.011-2 (decíduo anterior) conta como 03.07.01.003-1 (permanente
  anterior).
- completude_por_ficha.csv: 1 = campo preenchido, 0 = em branco, vazio = não avaliado (id_atendimento -> atendimentos).
- municipios.csv (cod_ibge) e bairros.csv (bairro): população do Censo 2022 (IBGE) e taxas.
- calendario.csv (data): dimensão de datas.
- completude.csv e indicadores_por_mes.csv: resumos prontos.

RELACIONAMENTOS NO POWER BI (Modelo):
  atendimentos[id_atendimento] 1 -> * procedimentos[id_atendimento]
  atendimentos[id_atendimento] 1 -> 1 completude_por_ficha[id_atendimento]
  calendario[data] 1 -> * atendimentos[data]
  municipios[cod_ibge] 1 -> * atendimentos[cod_ibge_municipio]
  bairros[bairro] 1 -> * atendimentos[bairro]

CAMADAS (GeoJSON, WGS 84, contornos simplificados):
- bairros_cascavel.geojson: bairros do GeoCascavel com atendimentos, população e taxas.
- municipios_parana.geojson: municípios do IBGE com atendimentos, população e taxa.
No ArcGIS Pro: Map > Add Data, ou a ferramenta JSON To Features. Para o Kernel com pontos, use atendimentos.csv
(XY Table To Point, campos lon e lat) sabendo que os pontos são centroides, não endereços.

Nenhum nome, CPF, CNS, prontuário, endereço com número ou data de nascimento está neste pacote.
`;
  return zip([
    { nome: "LEIA-ME.txt", dados: leia },
    { nome: "atendimentos.csv", dados: tab(at) },
    { nome: "procedimentos.csv", dados: tab(pr) },
    { nome: "completude_por_ficha.csv", dados: tab(comp) },
    { nome: "municipios.csv", dados: tab(mun) },
    { nome: "bairros.csv", dados: tab(bai) },
    { nome: "calendario.csv", dados: tab(cal) },
    { nome: "completude.csv", dados: tab(compRes) },
    { nome: "indicadores_por_mes.csv", dados: tab(im) },
    { nome: "bairros_cascavel.geojson", dados: JSON.stringify(geoB) },
    { nome: "municipios_parana.geojson", dados: JSON.stringify(geoM) },
  ]).then(b => new Blob([b], { type: "application/zip" }));
}
