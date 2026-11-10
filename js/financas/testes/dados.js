// Testes de mercado: os resultados vêm do repositório PÚBLICO `Alediov/orbita-testes` (desde 03/11/2026; antes, do ramo
// `mercado` deste repositório privado, onde os minutos do Actions acabavam), lidos SEM token por raw.githubusercontent:
// - ramo `mercado` → `resumo.json` (copy trading, workflow mercado.yml, a cada 2 h);
// - ramo `papel` → `indice.json` + `<forma>.json` (cofres, funding, robôs…, workflow papel.yml, a cada 6 h; formato em
//   tools/papel/FORMATO.md de lá).
// Guarda o último de cada um no aparelho (localStorage `orbita.testes.resumo` e `orbita.testes.papel`). Fora do app
// nativo e sem token (navegador, teste de fumaça), lê os exemplos de tools/mercado/exemplos/ (mercado de mentira).
// `atraso` diz há quantas horas os dados não chegam (o aviso na aba e no Início). Só leitura: nada aqui mexe em dinheiro.
import { Capacitor } from "../../../vendor/capacitor-core.js";
import { E } from "../../estado.js";

export const REPO_PADRAO = "Alediov/orbita-testes";
const CHAVE = "orbita.testes.resumo", CHAVE_PAPEL = "orbita.testes.papel";
const EXEMPLO = "../tools/mercado/exemplos/resumo.json", EXEMPLO_PAPEL = "../tools/mercado/exemplos/papel/";
/** Horas sem dados novos a partir das quais a aba avisa (a cópia roda a cada 2 h e as outras formas a cada 6 h; o
 *  GitHub às vezes atrasa ou pula um horário agendado). */
export const ATRASO_H = { mercado: 8, papel: 18 };
let dados = null, lidoEm = 0, carregando = null, erro = null;
let papel = null, papelEm = 0, carregandoPapel = null, erroPapel = null;

export const estado = () => ({ dados: doAparelho(), lidoEm, carregando: !!carregando, erro });
export const estadoPapel = () => ({ dados: papelDoAparelho(), lidoEm: papelEm, carregando: !!carregandoPapel, erro: erroPapel });
export const temToken = () => { const c = E().config || {}; return !!((c.token || "").trim() && (c.repo || "").trim()); };
const nativo = () => !!Capacitor.isNativePlatform?.();
/** Busca os dados de verdade (no app nativo, ou no navegador com o token configurado); senão, os exemplos. */
export const deVerdade = () => nativo() || temToken();
export const podeBuscar = deVerdade;
const repo = () => ((E().config || {}).testesRepo || "").trim() || REPO_PADRAO;
const urlRaw = (ramo, arq) => `https://raw.githubusercontent.com/${repo()}/${ramo}/${arq}`;

/** Há quantas horas a rodada mais nova aconteceu, se passou do limite (senão null). */
export function atraso(d, tipo = "mercado", agora = Date.now()) {
  if (!d?.agora || d.exemplo) return null;
  const h = (agora - d.agora) / 3600e3;
  return h >= ATRASO_H[tipo] ? Math.floor(h) : null;
}

async function baixar(ramo, arq) {
  if (!navigator.onLine) throw new Error("Sem internet agora.");
  const r = await fetch(urlRaw(ramo, arq), { cache: "no-store" });
  if (r.status === 404) throw new Error(`Os testes ainda não gravaram ${arq} (ramo ${ramo}).`);
  if (!r.ok) throw new Error(`O GitHub respondeu ${r.status}.`);
  return r.json();
}

export function doAparelho() {
  if (dados) return dados;
  try { const t = localStorage.getItem(CHAVE); if (t) { const d = JSON.parse(t); dados = d.resumo; lidoEm = d.em || 0; } } catch { /* */ }
  return dados;
}
/** Busca o resumo do copy trading (no máximo a cada 10 min, a não ser `forcar`); devolve os dados ou null. */
export function carregar({ forcar = false } = {}) {
  doAparelho();
  if (carregando) return carregando;
  if (!forcar && dados && Date.now() - lidoEm < 10 * 60e3) return Promise.resolve(dados);
  carregando = (async () => {
    try {
      let d;
      if (deVerdade()) d = await baixar("mercado", "resumo.json");
      else { const r = await fetch(EXEMPLO, { cache: "no-store" }); if (!r.ok) throw new Error(`Exemplo: ${r.status}.`); d = await r.json(); }
      if (!d || !Array.isArray(d.carteiras)) throw new Error("Resumo dos testes em formato estranho.");
      dados = d; lidoEm = Date.now(); erro = null;
      try { localStorage.setItem(CHAVE, JSON.stringify({ em: lidoEm, resumo: d })); } catch { /* cheio: fica só na memória */ }
    } catch (e) { erro = e.message || String(e); }
    finally { carregando = null; }
    return dados;
  })();
  return carregando;
}

export function papelDoAparelho() {
  if (papel) return papel;
  try { const t = localStorage.getItem(CHAVE_PAPEL); if (t) { const d = JSON.parse(t); papel = d.papel; papelEm = d.em || 0; } } catch { /* */ }
  return papel;
}
/** Busca as outras formas: o índice e cada `<forma>.json` que ele lista (só os que mudaram desde a última vez).
 *  Devolve { agora, indice, formas: { cofres: {...}, … } } ou null. */
export function carregarPapel({ forcar = false } = {}) {
  papelDoAparelho();
  if (carregandoPapel) return carregandoPapel;
  if (!forcar && papel && Date.now() - papelEm < 10 * 60e3) return Promise.resolve(papel);
  carregandoPapel = (async () => {
    try {
      const real = deVerdade();
      const pegar = real ? (a) => baixar("papel", a)
        : async (a) => { const r = await fetch(EXEMPLO_PAPEL + a, { cache: "no-store" }); if (!r.ok) throw new Error(`Exemplo ${a}: ${r.status}.`); return r.json(); };
      const indice = await pegar("indice.json");
      if (!indice || typeof indice.formas !== "object") throw new Error("Índice dos testes em formato estranho.");
      const antes = papel?.formas || {}, formas = {};
      await Promise.all(Object.entries(indice.formas).map(async ([k, f]) => {
        if (!f?.arquivo) return;
        if (antes[k] && antes[k].agora === f.agora && !forcar) { formas[k] = antes[k]; return; }
        try { formas[k] = await pegar(f.arquivo); } catch (e) { if (antes[k]) formas[k] = antes[k]; else throw e; }
      }));
      papel = { agora: indice.agora, indice, formas, exemplo: !!indice.exemplo };
      papelEm = Date.now(); erroPapel = null;
      try { localStorage.setItem(CHAVE_PAPEL, JSON.stringify({ em: papelEm, papel })); } catch { /* */ }
    } catch (e) { erroPapel = e.message || String(e); }
    finally { carregandoPapel = null; }
    return papel;
  })();
  return carregandoPapel;
}
