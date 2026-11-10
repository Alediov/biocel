// Processa uma foto de ficha: alinha, lê os números no aparelho e gera as cópias para leitura.
// A foto original não é guardada. Os números lidos ficam só até você confirmar; depois viram códigos.
import { alinharFoto, presencaDeTinta, CONFERENCIA, CAIXAS, FAIXAS_NUMEROS, ZONA_ENDERECO, refinar, celula, para28, mascaraImpressaAlinhada, copiaSemIdentificacao, imagemInteira, topoJpeg, recorteJpeg } from "./visao.js";
import { preverDigito } from "./rede.js";
import { melhorValido, VALIDADOR, codigo } from "./ids.js";
import { TABELAS } from "./tabelas.js";
import { registrar, mudancasNumeros } from "./historico.js";
import { municipioOficial, bairroOficial, bairrosDaRua, bairroDoSubBairro, ehCascavel, distritoComoMunicipio } from "./previsao.js";

const aleatorio = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("").slice(0, n);

/** `extra.nome`: caminho da foto na pasta (vira a coluna Arquivo); `extra.tamanho`: tamanho do arquivo original. */
const UM_DIGITO_VAZIO = new Set(["prontuario", "aluno"]);
/** Sugestões antigas com um dígito só no prontuário ou no RA: limpa (devolve true se mudou algo). */
export function limparUmDigito(ficha) {
  let mudou = false;
  for (const c of UM_DIGITO_VAZIO) {
    const s = ficha.sugestoes?.[c];
    if (s && !s.umDigito && String(s.texto || "").replace(/\D/g, "").length === 1) { Object.assign(s, { texto: "", n: 0, idx: [], minp: 1, auto: true, umDigito: true }); mudou = true; }
  }
  return mudou;
}
export async function processarFoto(arquivo, extra = {}) {
  const ficha = { id: `f-${aleatorio(10)}`, arquivo: extra.nome || arquivo.name, tamanho: extra.tamanho ?? arquivo.size, criado: new Date().toISOString(), pacote: aleatorio(8), sugestoes: {}, recortes: {}, tokens: {} };
  let img, modo, duvidoso;
  let topo = null;
  try { ({ img, modo, duvidoso, topo, qualidade: ficha.alinhamento } = await alinharFoto(arquivo, { cantos: extra.cantos, topo: !!extra.inteira })); }
  catch (e) { return { ...ficha, etapa: "erro", erro: e.message || String(e), conferencia: CONFERENCIA }; }
  ficha.impressao = modo;
  ficha.conferencia = CONFERENCIA; // versão da conferência do alinhamento (as de versões antigas são conferidas de novo)
  if (extra.cantos) ficha.ajusteManual = true;
  registrar(ficha, extra.cantos ? "Endireitada à mão" : "Processada", { nota: `impressão ${modo}, alinhamento ${Math.round((ficha.alinhamento || 0) * 100)}%` });
  if (duvidoso) ficha.alinhamentoPendente = true; // não sobe até você conferir a cópia (Lote → Alinhamento duvidoso)
  const imp = mascaraImpressaAlinhada(img, modo);
  let precisaConfirmar = false;
  for (const campo of ["prontuario", "aluno", "cpf", "cns"]) {
    const probs = [], idx = [], [fx0, , fx1] = FAIXAS_NUMEROS[campo];
    const caixas = refinar(imp, CAIXAS[campo]);
    caixas.forEach((cx, i) => { const c = celula(img, cx); if (c.px >= 12) { probs.push(preverDigito(para28(c))); idx.push(i); } });
    // onde fica cada quadradinho no recorte (0 a 1) e de quais vieram os dígitos: a tela Números põe cada dígito embaixo do seu quadro
    const pos = caixas.map(([x, , w]) => +((x + w / 2 - fx0) / (fx1 - fx0)).toFixed(4)), larg = +(caixas[0][2] / (fx1 - fx0)).toFixed(4);
    const cru = probs.map(p => p.indexOf(Math.max(...p))).join("");
    const minp = probs.length ? Math.min(...probs.map(p => Math.max(...p))) : 1;
    const s = { texto: cru, minp: +minp.toFixed(3), n: probs.length, pos, idx, larg };
    if (VALIDADOR[campo] && probs.length) {
      const r = melhorValido(probs, VALIDADOR[campo]);
      if (r) { s.texto = r.digitos.join(""); s.conf = +r.conf.toFixed(4); }
      s.valido = !!r;
      s.auto = !!r && r.conf === 1 && minp >= 0.6;
    } else s.auto = !probs.length || minp >= 0.9;
    // prontuário e RA com um dígito só: quase sempre é risco ou sujeira no campo vazio (vinha "1" ou "2"): fica vazio
    if (UM_DIGITO_VAZIO.has(campo) && probs.length === 1) Object.assign(s, { texto: "", n: 0, idx: [], minp: 1, auto: true, umDigito: true });
    ficha.sugestoes[campo] = s;
    if (!s.auto) precisaConfirmar = true;
    ficha.recortes[campo] = await recorteJpeg(img, FAIXAS_NUMEROS[campo], 0.8);
  }
  try { ficha.presenca = presencaDeTinta(img); } catch (e) { /* só para a completude */ }
  ficha.imgFicha = await copiaSemIdentificacao(img);
  if (extra.inteira) ficha.imgInteira = await imagemInteira(img); // modo local: a ficha inteira, só neste computador
  if (extra.inteira && topo) ficha.imgTopo = await topoJpeg(topo); // e o alto da ficha até a borda da foto (horário, cor, clínica)
  ficha.imgEndereco = await recorteJpeg(img, ZONA_ENDERECO, 0.85);
  ficha.etapa = precisaConfirmar ? "confirmar" : "pronta";
  return ficha;
}

/** Fecha os números de uma ficha: guarda só os códigos (HMAC) e apaga números e recortes. */
export async function fecharNumeros(ficha, valores, chave, auto = false) {
  const mudou = mudancasNumeros(ficha.sugestoes, valores);
  registrar(ficha, auto ? "Números conferidos sozinhos (dígito verificador)" : mudou.length ? "Números corrigidos e confirmados" : "Números confirmados sem correção", mudou.length ? { numeros: mudou } : {});
  ficha.tokens = {}; ficha.validos = {};
  for (const [campo, v] of Object.entries(valores)) {
    const d = String(v || "").replace(/\D/g, "");
    // prontuário com I (clínica Infantil) é outra numeração: "I" + número, para não se misturar com o do adulto
    const infantil = campo === "prontuario" && /I/i.test(String(v || ""));
    if (d) ficha.tokens[campo] = await codigo(chave, campo, campo === "prontuario" ? `${infantil ? "I" : ""}${+d}` : d);
    // completude: o CPF e o CNS preenchidos passam no dígito verificador? (só sim/não; o número não fica)
    if (d && VALIDADOR[campo]) ficha.validos[campo] = VALIDADOR[campo]([...d].map(Number));
    if (campo === "prontuario") { if (d && infantil) ficha.infantil = true; else delete ficha.infantil; }
  }
  delete ficha.sugestoes; ficha.recortes = null; // null apaga os recortes do banco
  // revisada antes de confirmar os números: segue revisada (a revisão já está guardada)
  ficha.etapa = ficha.revisadaEm && ficha.revisao ? "revisada" : ficha.leitura ? "lida" : "pronta";
  return ficha;
}

// ---------------- interpretação da leitura ----------------
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
// compara siglas sem acento, pontos, espaços e maiúsculas; número no fim vale como romano (Cir 1 = Cir I, Dent 2 = Dent II)
const chaveClinica = (s) => semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(\D)2$/, "$1II").replace(/(\D)1$/, "$1I");
export function clinicaPorExtenso(t) {
  if (!t) return "";
  const alvo = chaveClinica(t);
  for (const [sig, nome] of Object.entries(TABELAS.clinicas)) {
    if (chaveClinica(sig) === alvo) return nome;
    if (chaveClinica(nome) === alvo) return nome;
  }
  // fora das siglas: é o nome do professor que atendeu (ex.: "maristela" → "Maristela")
  return String(t).trim().toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (m) => m.toLowerCase());
}
/** Só o que está na tabela de siglas e variações (ex.: "Mauro" → "Márcio"); fora dela, null. */
export function clinicaDaTabela(t) {
  if (!t) return null;
  const alvo = chaveClinica(t);
  for (const [sig, nome] of Object.entries(TABELAS.clinicas)) if (chaveClinica(sig) === alvo || chaveClinica(nome) === alvo) return nome;
  return null;
}
export const clinicaConhecida = (nome) => Object.values(TABELAS.clinicas).includes(nome);
export const corPorExtenso = (c) => TABELAS.cores[String(c || "").trim().toUpperCase()] || (c || "");
export const municipio = (t) => municipioOficial(t);
// Códigos "emprestados": procedimento sem código próprio no SIGTAP, registrado na clínica com o código de outro.
// A restauração de dente PERMANENTE posterior com ionômero de vidro não tem código; usa-se o do decíduo
// (03.07.01.010-4). O código fica como escrito (é o registro), mas, com dente permanente (11 a 48) ou, sem dente,
// paciente de IDADE_PERMANENTE anos ou mais, o procedimento é o do permanente: `chave` separa os dois nas contagens.
export const EMPRESTIMOS = {
  "0307010104": { chave: "0307010104P", nome: "Restauração de Dente Permanente Posterior com Ionômero de Vidro", base: "0307010040",
    nota: "sem código próprio no SIGTAP; registrada com o código do decíduo (03.07.01.010-4)" },
};
export const IDADE_PERMANENTE = 13;
// Códigos ERRADOS de uso frequente (pedidos do Alediov, 25/10/2026): fichas de conferência de código erradas nas clínicas
// levaram os alunos a anotar os códigos de resina composta de DECÍDUO em dente PERMANENTE: 03.07.01.008-2 (decíduo
// posterior) no lugar de 03.07.01.012-0 (permanente posterior) e 03.07.01.011-2 (decíduo anterior) no lugar de
// 03.07.01.003-1 (permanente anterior). Ao contrário do código emprestado,
// aqui o código certo existe: com dente permanente (11 a 48) ou, sem dente, paciente de IDADE_PERMANENTE anos ou mais,
// o procedimento vira o do código certo (conta junto com ele em tudo) e o registrado fica em `corrigido`.
export const CORRECOES = {
  "0307010082": { para: "0307010120", regiao: "posterior", nota: "03.07.01.008-2 (decíduo posterior com resina) anotado em dente permanente; corrigido para 03.07.01.012-0" },
  "0307010112": { para: "0307010031", regiao: "anterior", nota: "03.07.01.011-2 (decíduo anterior com resina) anotado em dente permanente; corrigido para 03.07.01.003-1" },
};
// Variações de código usadas na clínica para o mesmo procedimento: contam como o código oficial.
// 02.04.01.018-7 é escrito por alguns no lugar de 02.04.01.021-7 (radiografia interproximal; abreviações 287 e 217).
export const SINONIMOS = { "0204010187": "0204010217" };
const DENTE_PERMANENTE = /^[1-4][1-8]$/;
/** O procedimento é num dente permanente? "dente" (anotado, 11 a 48), "idade" (sem dente, paciente adolescente ou adulto) ou null. */
function permanentePor(ctx) {
  const dente = String(ctx.dente ?? "").trim(), idade = ctx.idade == null || ctx.idade === "" || isNaN(+ctx.idade) ? null : +ctx.idade;
  return DENTE_PERMANENTE.test(dente) ? "dente" : !dente && idade != null && idade >= IDADE_PERMANENTE ? "idade" : null;
}
/**
 * Código lido → { digitos, codigo (formatado), nome, conhecido, chave, emprestado }. `ctx` ({ dente, idade }, ver
 * `ctxProc`) resolve os códigos emprestados; sem ele, vale o nome do SIGTAP.
 */
export function procedimento(codigoLido, ctx = null) {
  let d = String(codigoLido || "").replace(/\D/g, "");
  if (d.length === 3 && TABELAS.abreviacoes[d]) d = TABELAS.abreviacoes[d];
  d = SINONIMOS[d] || d;
  const nome = TABELAS.codigos[d] || "";
  const fmt = d.length === 10 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 9)}-${d[9]}` : d;
  const p = { digitos: d, codigo: fmt, nome, conhecido: !!nome, chave: d, emprestado: null };
  const e = EMPRESTIMOS[d];
  if (e && ctx) {
    const dente = String(ctx.dente ?? "").trim(), idade = ctx.idade == null || ctx.idade === "" || isNaN(+ctx.idade) ? null : +ctx.idade;
    const pela = DENTE_PERMANENTE.test(dente) ? "dente" : !dente && idade != null && idade >= IDADE_PERMANENTE ? "idade" : null;
    if (pela) return { ...p, nome: e.nome, chave: e.chave, emprestado: { nomeSigtap: nome, nota: e.nota, pela, base: e.base } };
  }
  const c = CORRECOES[d];
  if (c && ctx) {
    const pela = permanentePor(ctx);
    if (pela) return { ...procedimento(c.para), corrigido: { de: fmt, digitos: d, nomeRegistrado: nome, nota: c.nota, pela, regiao: c.regiao } };
  }
  return p;
}
// ---------- código que não existe: o vizinho provável (29/10/2026, sugestão aceita pelo Alediov) ----------
// Um dígito trocado (ou dois vizinhos invertidos) é o erro mais comum de leitura de código escrito à mão. Quando o código
// lido não existe na tabela, os códigos válidos a um passo dele são candidatos; o mais usado NAQUELA clínica (pelas
// fichas já conferidas) vem primeiro. Só sugere: quem decide é você, no Conferir.
let FREQ = null; // { geral: Map(cod → n), clinica: Map(clínica → Map(cod → n)) }
/** As frequências dos códigos nas fichas conferidas (chame com as fichas; as revisadas contam). */
export function definirFrequencias(fichas) {
  const geral = new Map(), clinica = new Map();
  for (const f of fichas || []) {
    // as conferidas e, depois de recomeçar a leitura (29/10/2026), as revisões antigas guardadas como gabarito
    const rev = f.revisao && f.etapa === "revisada" ? f.revisao : f.gabarito?.revisao;
    if (!rev) continue;
    const c = rev.clinica || "";
    if (!clinica.has(c)) clinica.set(c, new Map());
    for (const q of rev.procedimentos || []) {
      let d = String(q.codigo || "").replace(/\D/g, "");
      if (d.length === 3) d = TABELAS.abreviacoes[d] || d;
      if (!TABELAS.codigos[d]) continue;
      geral.set(d, (geral.get(d) || 0) + 1);
      clinica.get(c).set(d, (clinica.get(c).get(d) || 0) + 1);
    }
  }
  FREQ = { geral, clinica };
}
/** Os códigos mais usados na clínica (pelas fichas conferidas; sem dados da clínica, os mais usados no geral):
 *  [{ digitos, codigo, nome, usos }]. Para os botões do Conferir. */
export function codigosMaisUsados(clinica = "", n = 8) {
  const fc = FREQ?.clinica.get(clinica || "");
  const daClinica = !!fc && [...fc.values()].reduce((s, x) => s + x, 0) >= 5, base = daClinica ? fc : FREQ?.geral || new Map();
  const lista = [...base.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([d, usos]) => ({ digitos: d, codigo: fmtCod(d), nome: TABELAS.codigos[d] || "", usos }));
  lista.daClinica = daClinica;
  return lista;
}
/** As frequências como objeto simples (frequencias.json da leitura local: só contagens de códigos). */
export const frequenciasGerais = () => Object.fromEntries(FREQ?.geral || []);
const umPasso = (a, b) => {
  if (a.length !== b.length) return false;
  const dif = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { dif.push(i); if (dif.length > 2) return false; }
  return dif.length === 1 || (dif.length === 2 && dif[1] === dif[0] + 1 && a[dif[0]] === b[dif[1]] && a[dif[1]] === b[dif[0]]);
};
const fmtCod = (d) => d.length === 10 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 9)}-${d[9]}` : d;
/** Códigos válidos a um passo de `lido` (um dígito trocado ou dois vizinhos invertidos), o mais provável primeiro:
 *  [{ digitos, codigo, nome, usos }]. Vazio se o código existe ou não há vizinho. */
export function codigosVizinhos(lido, clinica = "") {
  const d = String(lido || "").replace(/\D/g, "");
  if (d.length === 10 ? TABELAS.codigos[d] || SINONIMOS[d] : d.length === 3 ? TABELAS.abreviacoes[d] : true) return [];
  const universo = d.length === 10 ? Object.keys(TABELAS.codigos) : Object.keys(TABELAS.abreviacoes);
  const fc = FREQ?.clinica.get(clinica || "") || new Map(), fg = FREQ?.geral || new Map();
  return universo.filter(c => umPasso(d, c)).map(c => {
    const cod = d.length === 3 ? TABELAS.abreviacoes[c] : c;
    return { digitos: c, codigo: d.length === 3 ? c : fmtCod(c), nome: TABELAS.codigos[cod] || "", usos: (fc.get(cod) || 0) * 3 + (fg.get(cod) || 0) };
  }).sort((a, b) => b.usos - a.usos || a.digitos.localeCompare(b.digitos)).slice(0, 3);
}

/** Contexto de um procedimento da revisão `r` para `procedimento` (dente e idade do paciente na data). */
export const ctxProc = (q, r) => ({ dente: q?.dente, idade: r ? (idadeNaData(r.nascimento, r.data) ?? (r.idadeEscrita === "" || r.idadeEscrita == null ? null : +r.idadeEscrita)) : null });
/** Atalho: o procedimento `q` de uma revisão `r`, já com o código emprestado resolvido. */
export const procDe = (q, r) => procedimento(q?.codigo, ctxProc(q, r));
export function idadeNaData(nasc, data) {
  if (!nasc || !data) return null;
  const n = new Date(nasc + "T12:00"), a = new Date(data + "T12:00");
  if (isNaN(n) || isNaN(a)) return null;
  let i = a.getFullYear() - n.getFullYear();
  if (a.getMonth() < n.getMonth() || (a.getMonth() === n.getMonth() && a.getDate() < n.getDate())) i--;
  return i >= 0 && i < 120 ? i : null;
}

/** Recebe as respostas (ficha e endereço). Os nomes do aluno e do professor não são lidos (pedido do Alediov,
 *  22/10/2026): uma resposta antiga que ainda traga `equipe` é ignorada. */
export async function aplicarLeitura(ficha, { ficha: lf = {}, endereco = {}, numeros = null, _leitor: info = null }, chave) {
  registrar(ficha, "Lida pela leitura automática");
  ficha.leitura = { ficha: lf, endereco: { bairro: endereco.bairro || null, municipio: endereco.municipio || null, rua: endereco.rua || null } };
  // a leitura local (04/11/2026): o que as duas leituras (dois modelos) disseram igual fica verde no Conferir
  if (info?.concordaram) ficha.leituraInfo = { modelo: info.modelo || null, versao: info.versao || null, concordaram: info.concordaram, segundo: info.segunda?.modelo || null };
  else delete ficha.leituraInfo;
  ficha.revisao = montarRevisao(ficha);
  ficha.lidaEm = new Date().toISOString();
  ficha.imgEquipe = null; // fichas antigas: o recorte da equipe sai
  if (ficha.etapa !== "confirmar") ficha.etapa = "lida";
  // os números de identificação lidos pelo modelo DESTE computador (só a leitura local manda): juntam com os da rede
  // do app; se todos ficam seguros, viram códigos na hora, sem passar pela tela Números
  if (numeros && typeof numeros === "object" && ficha.etapa === "confirmar" && ficha.sugestoes) {
    const seguros = juntarNumeros(ficha, numeros);
    registrar(ficha, seguros ? "Números lidos pela IA deste computador e conferidos" : "Números lidos pela IA deste computador (falta conferir)");
    if (seguros && chave) {
      const vals = Object.fromEntries(Object.entries(ficha.sugestoes).map(([c, s]) => [c, s.texto]));
      await fecharNumeros(ficha, vals, chave, true);
      ficha.numerosAuto = true; ficha.numerosIA = true;
    }
  }
  return ficha;
}

const so = (v, campo) => {
  let t = String(v ?? "").toUpperCase().replace(/[^0-9I?]/g, "");
  t = campo === "prontuario" && t.includes("I") ? t.replace(/I/g, "") + "I" : t.replace(/I/g, "1");
  return /[0-9?]/.test(t) ? t : "";
};
/**
 * Junta a leitura dos números feita pela IA local (`numeros`: { prontuario, aluno, cpf, cns }, "?" = dígito ilegível)
 * com a da rede do app (`ficha.sugestoes`). Regras: CPF e CNS valem pela IA quando passam no dígito verificador (ou
 * pela rede, se ela já estava segura); prontuário e RA, só quando a IA e a rede concordam. No resto, a tela Números
 * mostra a IA (quando completa) e a outra leitura embaixo. Devolve true se os quatro ficaram seguros.
 */
export function juntarNumeros(ficha, numeros) {
  let todos = true;
  for (const campo of ["prontuario", "aluno", "cpf", "cns"]) {
    const s = (ficha.sugestoes[campo] ||= { texto: "", n: 0, idx: [], auto: true });
    let ia = so(numeros[campo], campo);
    if (UM_DIGITO_VAZIO.has(campo) && ia.replace(/I$/, "").length === 1) ia = ""; // risco ou sujeira no campo vazio
    const rede = so(s.texto, campo);
    // "?" da IA: completa com o dígito da rede na mesma posição, se as duas leram o mesmo tanto de dígitos
    const iaCheia = ia.includes("?") && rede.length === ia.length ? [...ia].map((ch, i) => ch === "?" ? rede[i] : ch).join("") : ia;
    const completa = !iaCheia.includes("?");
    s.lidaIA = true; delete s.outra;
    let texto = s.texto, auto;
    if (VALIDADOR[campo]) {
      const okIA = completa && iaCheia && VALIDADOR[campo]([...iaCheia].map(Number));
      if (okIA) { texto = iaCheia; auto = true; }
      else if (s.auto && rede) auto = true;                 // a rede já tinha passado no dígito verificador com segurança
      else if (!ia && !rede) auto = true;                    // em branco para as duas
      else { auto = false; texto = completa && iaCheia ? iaCheia : rede; }
    } else if (!ia.includes("?") && ia === rede) auto = true; // sem dígito verificador: só quando as duas leram igual
    else { auto = false; texto = completa && iaCheia ? iaCheia : rede; }
    const outra = texto === rede ? (ia || "(em branco)") : (rede || "(em branco)");
    if (so(outra, campo) !== so(texto, campo)) s.outra = outra.replace(/\?/g, "·");
    if (texto !== s.texto) { s.texto = texto; s.idx = []; s.fonte = "ia"; }
    s.auto = auto;
    if (!auto) todos = false;
  }
  return todos;
}

// Pacientes da Penitenciária Industrial de Cascavel (PIC): atendidos na própria PIC e com "PIC" no endereço. São
const listaBairros = (l) => l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} e ${l.at(-1)}`;
/**
 * Bairro de Cascavel pelo endereço. A rua manda mais que o escrito: é comum escreverem o sub-bairro (jardim,
 * loteamento, conjunto) no lugar do bairro. O escrito só fica quando é um bairro por onde a rua passa (ou um sub-bairro
 * conhecido que fica num deles), ou quando a rua não foi achada (ou só por semelhança) e o escrito é um bairro oficial.
 */
export function bairroPeloEndereco(escrito, rua) {
  const W = String(escrito || "").trim(), avisos = [];
  const R = rua ? bairrosDaRua(rua) : null, rs = R?.bairros || [];
  const O = W ? bairroOficial(W) : null, S = W ? bairroDoSubBairro(W) : null;
  const candidatos = [O?.exato && O.valor, S, O?.confiavel && O.valor].filter(Boolean);
  if (rs.length) {
    const ok = candidatos.find(c => rs.includes(c));
    if (ok) {
      if (ok !== O?.valor) avisos.push(`bairro: "${W}" é sub-bairro do ${ok} (confere com a rua); confira pelo endereço`);
      return { bairro: ok, avisos };
    }
    if (!W) {
      avisos.push(rs.length === 1 ? `bairro: não estava escrito; pela rua, ${rs[0]}; confira pelo endereço` : `bairro: não estava escrito; a rua passa por ${listaBairros(rs)}; ficou ${rs[0]}, confira pelo endereço`);
      return { bairro: rs[0], avisos };
    }
    // rua longa (passa por vários bairros) e sub-bairro conhecido: o sub-bairro diz melhor onde fica
    if (rs.length > 1 && S) {
      avisos.push(`bairro: "${W}" é sub-bairro do ${S}; a rua passa por ${listaBairros(rs)}; ficou ${S}, confira pelo endereço`);
      return { bairro: S, avisos };
    }
    if (!R.exata && candidatos[0]) {
      avisos.push(`bairro: ficou ${candidatos[0]} (escrito "${W}"); a rua lida só parece com uma de ${listaBairros(rs)}; confira pelo endereço`);
      return { bairro: candidatos[0], avisos };
    }
    avisos.push(rs.length === 1 ? `bairro: escrito "${W}", mas a rua fica no ${rs[0]}; ficou o da rua (o escrito deve ser sub-bairro), confira pelo endereço`
      : `bairro: escrito "${W}", mas a rua passa por ${listaBairros(rs)}; ficou ${rs[0]} (o escrito deve ser sub-bairro), confira pelo endereço`);
    return { bairro: rs[0], avisos };
  }
  if (!W) return { bairro: "", avisos };
  if (O?.exato || (O?.confiavel && (!S || S === O.valor))) return { bairro: O.valor, avisos };
  if (S) { avisos.push(`bairro: "${W}" é sub-bairro; ficou o bairro ${S}, confira pelo endereço`); return { bairro: S, avisos }; }
  avisos.push(`bairro: "${W}" não está na lista de bairros de Cascavel (nem a rua); confira pelo endereço`);
  return { bairro: W, avisos };
}

// atendimento institucional: município Cascavel, bairro vazio de propósito e fora das análises espaciais.
export const NOME_PIC = TABELAS.clinicas.PIC;
export const enderecoPIC = (t) => /\bPIC\b|penitenci/i.test(String(t || ""));
export const clinicaPIC = (t) => /^\s*PIC\s*$|penitenci/i.test(String(t || ""));
export const ehPIC = (r) => !!r && (r.institucional === "PIC" || clinicaPIC(r.clinica));
export function montarRevisao(ficha) {
  const l = ficha.leitura?.ficha || {}, e = ficha.leitura?.endereco || {};
  const duvidas = [...(l.duvidas || [])];
  const pic = clinicaPIC(l.clinica) || enderecoPIC(e.rua) || enderecoPIC(e.bairro) || enderecoPIC(l.municipio);
  const clinica = pic && !l.clinica ? NOME_PIC : clinicaPorExtenso(l.clinica);
  // nome de professor na linha da Clínica é normal: não é dúvida
  const avisos = duvidas.filter(d => !/^cl[ií]nica\b.*(sigla|nome|pessoa|professor)/i.test(d));
  // distrito de Cascavel escrito como município (ex.: Juvinópolis): município Cascavel e o distrito no bairro
  const escritoMun = l.municipio || e.municipio, distrito = pic ? null : distritoComoMunicipio(escritoMun);
  const mun = pic || distrito ? municipioOficial("Cascavel") : municipioOficial(escritoMun);
  let bairro = "";
  if (distrito) {
    bairro = distrito;
    avisos.push(`município: "${escritoMun}" é distrito de Cascavel; ficou Cascavel, com ${distrito} no bairro`);
  } else if (!pic && (!mun || ehCascavel(mun))) {
    const b = bairroPeloEndereco(e.bairro, e.rua);
    bairro = b.bairro; avisos.push(...b.avisos);
  }
  // código que não existe: diz qual é o vizinho provável (no lugar do aviso genérico do leitor)
  (l.procedimentos || []).forEach((q, i) => {
    const viz = codigosVizinhos(q.codigo, clinica);
    if (!viz.length) return;
    const n = i + 1, d = String(q.codigo || "").replace(/\D/g, "");
    for (let k = avisos.length - 1; k >= 0; k--) if (new RegExp(`^procedimento ${n}: (código fora|abreviação)`).test(avisos[k])) avisos.splice(k, 1);
    avisos.push(`procedimento ${n}: o código ${fmtCod(d)} não existe na tabela; provável ${viz[0].codigo}${viz[0].nome ? ` (${viz[0].nome})` : ""}${viz.length > 1 ? ` ou ${viz.slice(1).map(v => v.codigo).join(", ")}` : ""}; confira na ficha`);
  });
  return {
    clinica, horario: l.horario || "", cor: corPorExtenso(l.cor), data: l.data || "",
    urgencia: !!l.urgencia, primeira: !!l.primeira_consulta, retorno: !!l.retorno,
    nascimento: l.nascimento || "", sexo: l.sexo === "M" ? "Masculino" : l.sexo === "F" ? "Feminino" : "",
    idadeEscrita: l.idade ?? "", municipio: mun, bairro,
    procedimentos: (l.procedimentos || []).map(p => ({ dente: p.dente || "", codigo: String(p.codigo || "").replace(/\D/g, "") })),
    duvidas: avisos,
    ...(pic ? { institucional: "PIC" } : {}),
  };
}
