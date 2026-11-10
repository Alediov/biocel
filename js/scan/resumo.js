// Resumo do OdontoScan para o celular (pedido do Alediov, 29/10/2026): a leitura e a conferência das fichas ficam só no
// computador do laboratório; o celular só mostra os resultados. O computador monta aqui um resumo SÓ COM NÚMEROS
// AGREGADOS (contagens, proporções, séries por dia ou mês, contagens por forma do mapa) e o publica no repositório
// (privado), em progresso/odontoscan/resumo.json. Nada de ficha individual: sem ids, nomes de arquivo, códigos de
// paciente ou de aluno, datas de nascimento nem textos das dúvidas.
import * as BD from "./banco.js";
import { revisaoDe, concordancia, padroesEstranhos, coerencia, CAMPOS_CONC } from "./analises.js";
import { procDe, idadeNaData } from "./processar.js";
import { completude, indicadores, porCategoria, porDiaETurno, piramide, porDente } from "./indicadores.js";
import { distancias } from "./geo.js";
import { contar as contarMapa, VISTAS } from "./mapa.js";

export const CAMINHO_RESUMO = "progresso/odontoscan/resumo.json";
export const VERSAO_RESUMO = 1;
const REPO_PADRAO = "Alediov/odonto-quest";

const contagem = (xs) => { const m = new Map(); for (const x of xs) if (x != null && x !== "") m.set(x, (m.get(x) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
const diaISO = (s) => (s ? String(s).slice(0, 10) : null);
// um código anônimo (P-…, A-…, D-…) nunca vai no resumo
const TEM_CODIGO = /\b[APD]-[0-9A-F]{3,}\b/i;

/**
 * Monta o resumo. `fs`: todas as fichas; `ctx`: { pac (código do paciente por ficha, só para contar), estado (estado.json
 * do leitor), metas (calcularMetas), resPac (resumoPacientes) }.
 */
export function montarResumo(fs, ctx = {}) {
  const etapaDe = (f) => f.etapa === "erro" ? "erro" : f.etapa === "revisada" ? "revisada" : f.leitura ? "lida" : f.etapa === "confirmar" ? "confirmar" : f.enviada ? "fila" : "espera";
  const etapas = Object.fromEntries(contagem(fs.map(etapaDe)));
  const dias = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
  const porDia = (campo) => { const o = Object.fromEntries(contagem(fs.map(f => diaISO(f[campo])))); return dias.map(d => o[d] || 0); };
  // os dados finais: só as fichas conferidas (revisadas)
  const base = fs.filter(f => f.etapa === "revisada" && f.revisao).map(f => ({ f, r: revisaoDe(f) }));
  const rs = base.map(x => x.r);
  const est = ctx.estado || null;
  const conc = concordancia(fs);
  const so = (c) => ({ k: c.k, n: c.n });
  const comp = base.length ? completude(base) : null;
  const inds = base.length ? indicadores(base, ctx.resPac || null).filter(i => i.den) : [];
  const dist = base.length ? distancias(rs) : null;
  const faixa = (i) => i == null ? null : i <= 12 ? "0 a 12" : i <= 17 ? "13 a 17" : i <= 39 ? "18 a 39" : i <= 59 ? "40 a 59" : "60 ou mais";
  // procedimentos por mês e código ESCRITO (o faturado), para comparar com o SIA no celular
  const procMes = {};
  for (const { r } of base) {
    const m = /^(\d{4})-(\d{2})/.exec(r.data || ""); if (!m) continue;
    for (const q of r.procedimentos || []) { const p = procDe(q, r); if (!p.digitos || p.digitos.length !== 10) continue; const cod = p.corrigido ? p.corrigido.digitos : p.digitos, k = `${m[1]}${m[2]}|${cod}`; procMes[k] = (procMes[k] || 0) + 1; }
  }
  const dt = porDiaETurno(rs);
  return {
    v: VERSAO_RESUMO, gerado: new Date().toISOString(),
    total: fs.length, etapas,
    leitura: est ? {
      modelo: est.modelo || null, naFila: est.na_fila ?? null, limite: est.limite ?? null,
      noites: (est.historico || []).slice(-21).map(h => ({ data: h.data, lidas: h.lidas || 0, validacao: h.validacao || 0, falhas: h.falhas || 0, minutos: h.minutos ?? null, seg: h.seg_por_ficha ?? null, terminou: h.terminou !== false, temp: h.temp_max ?? null, calor: h.pausas_calor || 0, motivo: h.motivo || null })),
      agora: est.andamento ? { lidas: est.andamento.lidas || 0, abertas: est.andamento.abertas || 0, temp: est.andamento.temp_max ?? null, pausa: est.andamento.pausa?.motivo || null } : null,
    } : null,
    dias: { dias, processadas: porDia("criado"), lidas: porDia("lidaEm"), revisadas: porDia("revisadaEm") },
    metas: ctx.metas ? { dia: ctx.metas.hoje, rev: { meta: ctx.metas.rev.meta, feitas: ctx.metas.rev.feitas }, num: { meta: ctx.metas.num.meta, feitas: ctx.metas.num.feitas }, seq: ctx.metas.seq || 0, cumpriu: !!ctx.metas.cumpriu } : null,
    qualidade: {
      comNumeros: fs.filter(f => f.tokens && Object.keys(f.tokens).length).length,
      numerosAuto: fs.filter(f => f.numerosAuto).length, numerosIA: fs.filter(f => f.numerosIA).length,
      azul: fs.filter(f => f.impressao === "azul").length, preta: fs.filter(f => f.impressao === "preto").length,
      alinhamento: fs.filter(f => f.alinhamentoPendente && f.etapa !== "erro").length,
      duvidas: fs.filter(f => (f.leitura?.ficha?.duvidas || []).length).length,
      avisos: base.filter(({ f, r }) => coerencia(r, f).length).length,
    },
    concordancia: conc.fichas ? { fichas: conc.fichas, fichasIguais: conc.fichasIguais, total: so(conc.total), procs: so(conc.procs), por: Object.fromEntries(CAMPOS_CONC.map(([k]) => [k, so(conc.por[k])])) } : null,
    pacientes: ctx.resPac ? { pacientes: ctx.resPac.pacientes, comRetorno: ctx.resPac.comRetorno, media: ctx.resPac.media, medianaDias: ctx.resPac.medianaDias } : null,
    conferidas: base.length,
    completude: comp ? { global: comp.global, campos: comp.campos.filter(c => c.pct != null).map(c => ({ nome: c.nome, pct: c.pct, classe: c.classe })), cpf: comp.validade?.cpf || null, cns: comp.validade?.cns || null } : null,
    indicadores: inds.map(i => ({ nome: i.nome, valor: i.valor, unidade: i.unidade, num: i.num, den: i.den })),
    cobertura: dist?.n ? { n: dist.n, raio50: dist.raio50, raio90: dist.raio90, faixas: dist.faixas, pic: dist.nivel.institucional || 0 } : null,
    calendario: Object.fromEntries(contagem(rs.map(r => r.data))),
    meses: contagem(rs.map(r => (r.data || "").slice(0, 7))).sort((a, b) => a[0].localeCompare(b[0])),
    clinicas: contagem(rs.map(r => r.clinica)).slice(0, 15),
    procedimentos: contagem(base.flatMap(({ r }) => (r.procedimentos || []).map(q => { const p = procDe(q, r); return p.nome || `código ${p.codigo}`; }))).slice(0, 15),
    categorias: porCategoria(base).map(g => ({ categoria: g.categoria, financiamento: g.financiamento, tabela1: g.tabela1, n: g.n })),
    faixas: contagem(rs.map(r => faixa(idadeNaData(r.nascimento, r.data) ?? (r.idadeEscrita === "" || r.idadeEscrita == null ? null : +r.idadeEscrita)))),
    sexo: contagem(rs.map(r => r.sexo || "não informado")),
    cor: contagem(rs.map(r => r.cor || "não informada")),
    tipo: [["Urgência", rs.filter(r => r.urgencia).length], ["1ª consulta", rs.filter(r => r.primeira).length], ["Retorno", rs.filter(r => r.retorno).length]],
    municipios: contagem(rs.map(r => r.municipio || "não informado")).slice(0, 15),
    bairros: contagem(rs.filter(r => /cascavel/i.test(r.municipio || "")).map(r => r.bairro || "não informado")).slice(0, 20),
    diaSemana: dt.dias, turnos: [...dt.turnos], semHora: dt.semHora,
    piramide: base.length ? piramide(rs) : null,
    dentes: base.length ? [...porDente(rs)] : [],
    mapa: base.length ? Object.fromEntries(VISTAS.map(([v]) => { const c = contarMapa(v, rs); return [v, { cont: [...c.cont], fora: c.fora, foraTxt: c.foraTxt }]; })) : null,
    padroes: base.length >= 20 ? padroesEstranhos(base).filter(a => !TEM_CODIGO.test(`${a.titulo} ${a.texto}`)).map(a => ({ grav: a.grav, titulo: a.titulo, texto: a.texto })) : [],
    procMes,
  };
}

/** Confere que o resumo não leva nada de ficha individual (defesa a mais, antes de publicar). */
export function conferirResumo(R) {
  const txt = JSON.stringify(R);
  if (TEM_CODIGO.test(txt)) throw new Error("o resumo tem um código de paciente ou de aluno");
  if (/"(id|ids|arquivo|tokens|sugestoes|revisao|historico|recortes|pacote)"\s*:/.test(txt) || /"nascimento"\s*:\s*"/.test(txt)) throw new Error("o resumo tem um campo de ficha individual");
  return true;
}

// ---------- publicar (computador) ----------
const b64 = (s) => { const u = new TextEncoder().encode(s); let x = ""; for (let i = 0; i < u.length; i += 0x8000) x += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(x); };
/** Token e repositório para publicar o resumo (só o resumo: o modo local não usa o GitHub para mais nada). */
export const credResumo = async () => { const c = await BD.lerCfg("resumoGithub"); return c?.token ? { token: c.token, repo: c.repo || REPO_PADRAO } : null; };
export const salvarCredResumo = (token, repo) => BD.gravarCfg("resumoGithub", token ? { token: token.trim(), repo: (repo || REPO_PADRAO).trim() } : null);

/** Publica o resumo no repositório (main). Devolve { ok, em } ou lança. */
export async function publicarResumo(R) {
  const cred = await credResumo(); if (!cred) throw new Error("Falta o token do GitHub para publicar o resumo.");
  conferirResumo(R);
  const url = `https://api.github.com/repos/${cred.repo}/contents/${CAMINHO_RESUMO}`;
  const H = { Authorization: `Bearer ${cred.token}`, Accept: "application/vnd.github+json" };
  for (let t = 0; t < 3; t++) {
    const g = await fetch(url, { headers: H, cache: "no-store" });
    if (g.status === 401 || g.status === 403) throw new Error("O GitHub recusou o token (precisa de Contents: leitura e escrita).");
    const sha = g.ok ? (await g.json()).sha : undefined;
    const r = await fetch(url, { method: "PUT", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ message: "OdontoScan: resumo para o celular (só números agregados)", content: b64(JSON.stringify(R)), ...(sha ? { sha } : {}) }) });
    if (r.ok) { const em = new Date().toISOString(); await BD.gravarCfg("resumoPublicado", { em, total: R.total, conferidas: R.conferidas }); return { ok: true, em }; }
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 140)}`);
    await new Promise(ok => setTimeout(ok, 700 * (t + 1)));
  }
  throw new Error("O GitHub recusou a gravação do resumo (conflito).");
}

/**
 * Quando termina (29/10/2026, sugestão aceita pelo Alediov): pela leitura das últimas noites (fichas por dia de
 * calendário, contando os dias sem leitura desde a primeira das 14 últimas) e pelo seu ritmo de conferência (últimos
 * 14 dias). `noites`: [{ data, lidas }]; `revisadasPorDia`: [n, …] (os dias mais recentes no fim).
 * Devolve { ler: { faltam, porDia, dias, data } | null, conferir: { … } | null }.
 */
export function previsaoTermino({ noites = [], faltamLer = 0, revisadasPorDia = [], faltamConferir = 0 }, hoje = new Date()) {
  const somaDias = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const um = (faltam, porDia) => !faltam ? { faltam: 0, porDia, dias: 0, data: somaDias(0) } : porDia > 0 ? { faltam, porDia, dias: Math.ceil(faltam / porDia), data: somaDias(Math.ceil(faltam / porDia)) } : null;
  const limite = new Date(hoje); limite.setDate(limite.getDate() - 14);
  const rec = noites.filter(x => x.data && new Date(x.data + "T12:00:00") >= limite);
  let ler = null;
  if (rec.length) {
    const primeiro = new Date(rec.map(x => x.data).sort()[0] + "T12:00:00");
    const dias = Math.max(1, Math.min(14, Math.round((hoje - primeiro) / 864e5)));
    ler = um(faltamLer, rec.reduce((a, x) => a + (x.lidas || 0), 0) / dias);
  }
  const r14 = revisadasPorDia.slice(-14), ativos = r14.findIndex(n => n > 0);
  const conferir = ativos >= 0 ? um(faltamConferir, r14.slice(ativos).reduce((a, n) => a + n, 0) / (r14.length - ativos)) : null;
  return { ler, conferir };
}

/** A previsão de término (resumo.js `previsaoTermino`), em uma ou duas linhas. */
export function htmlPrevisao(pv) {
  const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
  const dd = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const l = [];
  if (pv.ler?.faltam) l.push(`<li><span>📖</span><span><b>Leitura</b>: ${fmt(pv.ler.faltam)} ${pv.ler.faltam === 1 ? "ficha falta" : "fichas faltam"}; no ritmo das últimas noites (~${fmt(Math.round(pv.ler.porDia))} por dia), termina em <b>~${fmt(pv.ler.dias)} ${pv.ler.dias === 1 ? "dia" : "dias"}</b> (por volta de ${dd(pv.ler.data)}).</span></li>`);
  else if (pv.ler && !pv.ler.faltam) l.push(`<li><span>📖</span><span><b>Leitura</b>: todas as fichas já foram lidas.</span></li>`);
  if (pv.conferir?.faltam) l.push(`<li><span>✅</span><span><b>Conferência</b>: ${fmt(pv.conferir.faltam)} para conferir; no seu ritmo (~${fmt(Math.round(pv.conferir.porDia))} por dia), <b>~${fmt(pv.conferir.dias)} ${pv.conferir.dias === 1 ? "dia" : "dias"}</b> (por volta de ${dd(pv.conferir.data)}).</span></li>`);
  return l.length ? `<ul class="os-previsao">${l.join("")}</ul>` : "";
}

