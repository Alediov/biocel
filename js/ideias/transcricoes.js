// Transcrições da antena de ideias pelo celular (09/11/2026). O workflow `ideias.yml` do orbita-testes acha os vídeos
// novos e grava o ramo público `ideias`, mas o YouTube bloqueia a legenda a partir dos IPs do GitHub Actions. Aqui o
// próprio aparelho (IP de casa ou do celular) baixa as legendas automáticas pt/en (legendas.js, o caminho do
// youtube-transcript-api) e sobe o texto para o repositório PRIVADO em `progresso/ideias/transcricoes/<id>.json`,
// que a tarefa "Ideias do Órbita" lê primeiro (gerador/IDEIAS.md).
// Quando: 45 s depois de abrir e 20 s depois de voltar ao app, no máximo a cada 6 h, só no app do Android (pelo
// CapacitorHttp: sem CORS), nunca no plano de dados quando o aparelho sabe dizer, até 15 vídeos por vez com pausa.
// Situação só neste aparelho (localStorage `orbita.ideias.transcricoes`); um vídeo que falhou 3 vezes não é tentado de
// novo (o bloqueio do aparelho e a falta de rede não contam como tentativa: param a rodada). Nada de token em log.
// Seguir o BDM (09/11/2026): o "Bom Dia Mercado" do Theo Borges (palpites do dia, tools/ideias/bdm.py) vai na FRENTE
// da fila e é procurado também no feed do canal (o índice só é refeito 2×/dia). Dentro das 6 h, uma rodada curta só
// para ele, no máximo a cada BDM_INTERVALO_MIN, até o de hoje subir (as mesmas regras: Wi-Fi, 3 tentativas, pausa).
import { E } from "../estado.js";
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import * as L from "./legendas.js";

export const INDICE = "https://raw.githubusercontent.com/Alediov/orbita-testes/ideias/indice.json";
export const PASTA = "progresso/ideias/transcricoes";
const CHAVE = "orbita.ideias.transcricoes";
export const INTERVALO_H = 6;
export const POR_VEZ = 15;
export const MAX_TENTATIVAS = 3;
export const BDM_INTERVALO_MIN = 20;
const PAUSA_MS = [4000, 9000];
const UA_NAVEGADOR = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const nativo = !!Capacitor.isNativePlatform?.();
let Http = null;
const http = () => (Http ||= registerPlugin("CapacitorHttp"));
/** No navegador, só com o falso do teste de fumaça (`window.__transcricoesFalso` = função pedir). */
const falso = () => (typeof window !== "undefined" ? window.__transcricoesFalso : null) || null;

// ---------------------------------------------------------------- estado neste aparelho
/** { ultimaVez, rodada: {em, baixadas, falharam, parou?}, noRepo, esperando, desistidos, falhas: {id: {n, motivo, em}}, erro } */
export function situacao() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "null") || {}; } catch { return {}; }
}
function guardar(s) {
  try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch { /* sem armazenamento */ }
  try { window.dispatchEvent(new Event("oq-transcricoes")); } catch { /* node */ }
}
const hora = (iso) => {
  const d = new Date(iso), hoje = new Date();
  const h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === hoje.toDateString() ? `hoje às ${h}` : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${h}`;
};
/** "Transcrições: 12 baixadas, 3 esperando, última vez hoje às 14:05" (null se nunca rodou neste aparelho). */
export function textoSituacao(s = situacao()) {
  if (!s.ultimaVez && !s.erro) return null;
  const partes = [`${s.noRepo || 0} baixada${s.noRepo === 1 ? "" : "s"}`, `${s.esperando || 0} esperando`];
  if (s.desistidos) partes.push(`${s.desistidos} sem legenda`);
  let t = `Transcrições: ${partes.join(", ")}`;
  if (s.ultimaVez) t += `, última vez ${hora(s.ultimaVez)}`;
  if (s.rodada?.parou) t += ` (parou: ${s.rodada.parou})`;
  else if (s.erro) t += ` (${s.erro})`;
  return t + ".";
}

// ---------------------------------------------------------------- rede
/** Um pedido: { url, metodo, headers, corpo (objeto vira JSON) } → { status, texto }. */
export async function pedir({ url, metodo = "GET", headers = {}, corpo }) {
  const f = falso();
  const body = corpo == null ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  if (f) return f({ url, metodo, headers, corpo: body });
  if (!nativo) throw new L.ErroLegenda("rede", "só no app do Android");
  try {
    const r = await http().request({ url, method: metodo, headers, data: corpo == null ? undefined : corpo, responseType: "text", connectTimeout: 15000, readTimeout: 25000 });
    return { status: r.status, texto: typeof r.data === "string" ? r.data : JSON.stringify(r.data ?? "") };
  } catch (e) { throw new L.ErroLegenda("rede", String(e?.message || e).slice(0, 80)); }
}
const json = (r) => { try { return JSON.parse(r.texto); } catch { return null; } };

// ---------------------------------------------------------------- uma transcrição
/** Baixa a legenda de um vídeo: { idioma, auto, traduzidaDe?, texto }. Lança ErroLegenda com o código. */
export async function transcrever(id, { pedido = pedir } = {}) {
  const cab = { "User-Agent": UA_NAVEGADOR, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" };
  let r = await pedido({ url: L.urlVideo(id), headers: cab });
  if (r.status === 429) throw new L.ErroLegenda("bloqueio", "HTTP 429");
  if (r.status >= 400) throw new L.ErroLegenda("rede", `página do vídeo ${r.status}`);
  let html = L.entidades(r.texto);
  const v = L.consentimento(html);
  if (v) {
    r = await pedido({ url: L.urlVideo(id), headers: { ...cab, Cookie: `CONSENT=YES+${v}` } });
    html = L.entidades(r.texto);
    if (L.consentimento(html)) throw new L.ErroLegenda("consentimento");
  }
  const chave = L.chaveInnertube(html);
  if (!chave) throw new L.ErroLegenda("sem-chave");
  r = await pedido({ url: L.urlPlayer(chave), metodo: "POST", headers: { "Content-Type": "application/json", "Accept-Language": cab["Accept-Language"] }, corpo: L.corpoPlayer(id) });
  if (r.status === 429) throw new L.ErroLegenda("bloqueio", "HTTP 429");
  if (r.status >= 400) throw new L.ErroLegenda("rede", `player ${r.status}`);
  const trilha = L.escolherTrilha(L.trilhasDoPlayer(r.texto));
  if (L.precisaPoToken(trilha.url)) throw new L.ErroLegenda("po-token");
  // o XML (como o youtube-transcript-api); vazio, tenta o json3
  let trechos = null;
  for (const fmt of ["", "json3"]) {
    const rl = await pedido({ url: L.urlNoFormato(trilha.url, fmt), headers: cab });
    if (rl.status === 429) throw new L.ErroLegenda("bloqueio", "HTTP 429");
    if (rl.status >= 400 || !rl.texto?.trim()) continue;
    trechos = L.lerLegenda(rl.texto);
    if (trechos.length) break;
  }
  const texto = trechos ? L.textoCorrido(trechos) : "";
  if (!texto) throw new L.ErroLegenda("vazia");
  return { idioma: trilha.idioma, auto: trilha.auto, ...(trilha.traduzidaDe ? { traduzidaDe: trilha.traduzidaDe } : {}), texto };
}

// ---------------------------------------------------------------- GitHub (repositório privado)
function cabGH() {
  return { Authorization: `Bearer ${E().config.token.trim()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}
const apiGH = (caminho) => `https://api.github.com/repos/${E().config.repo.trim()}/contents/${caminho}`;
function base64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
/** Os ids que já estão em `progresso/ideias/transcricoes/` (pasta que não existe = nenhum). */
async function noRepositorio() {
  const r = await pedir({ url: apiGH(PASTA), headers: cabGH() });
  if (r.status === 404) return new Set();
  if (r.status === 401 || r.status === 403) throw new Error("o GitHub recusou o token");
  if (r.status >= 400) throw new Error(`GitHub ${r.status}`);
  const l = json(r);
  return new Set((Array.isArray(l) ? l : []).map(a => String(a.name || "")).filter(n => n.endsWith(".json")).map(n => n.slice(0, -5)));
}
/** Sobe um arquivo novo; 422 (já existe, outro aparelho subiu antes) conta como feito. */
async function subir(reg) {
  const r = await pedir({ url: apiGH(`${PASTA}/${reg.id}.json`), metodo: "PUT", headers: { ...cabGH(), "Content-Type": "application/json" },
    corpo: { message: `Ideias: transcrição ${reg.id} (pelo celular)`, content: base64(JSON.stringify(reg, null, 1) + "\n") } });
  if (r.status === 422 || r.status === 409) return "existia";
  if (r.status >= 400) throw new Error(`GitHub ${r.status} ao subir`);
  return "subiu";
}

// ---------------------------------------------------------------- a rodada
const espera = (ms) => new Promise(ok => setTimeout(ok, ms));
const noCelularDeDados = () => { const c = typeof navigator !== "undefined" ? navigator.connection : null; return !!c && (c.type === "cellular" || c.saveData === true); };
let andamento = null;

/** O BDM mais novo do feed do canal (o índice traz o channel_id); [] se não der. */
async function bdmDoFeed(indice) {
  const cid = indice?.canais?.theoborges?.channel_id;
  if (!cid) return [];
  try {
    const r = await pedir({ url: L.urlFeed(cid), headers: { "User-Agent": UA_NAVEGADOR, "Cache-Control": "no-cache" } });
    return r.status < 400 ? L.bdmDoFeed(r.texto) : [];
  } catch { return []; }
}

/** Uma rodada. `forcar` ignora as 6 h e o Wi-Fi; `pausa` (ms) troca a pausa entre vídeos (teste). Dentro das 6 h,
 *  só o BDM (no máximo a cada BDM_INTERVALO_MIN e até o de hoje estar no repositório). */
export function rodar({ forcar = false, pausa = null, porVez = POR_VEZ } = {}) {
  if (andamento) return andamento;
  andamento = (async () => {
    const s = situacao();
    const cfg = E().config || {};
    if (!nativo && !falso()) return s;
    if (!cfg.token?.trim() || !cfg.repo?.trim()) return s;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return s;
    const soBDM = !forcar && s.ultimaVez && Date.now() - Date.parse(s.ultimaVez) < INTERVALO_H * 3600e3;
    if (soBDM && (s.bdmHoje === L.diaBR() || (s.bdmVez && Date.now() - Date.parse(s.bdmVez) < BDM_INTERVALO_MIN * 60e3))) return s;
    if (!forcar && noCelularDeDados()) { s.erro = "esperando o Wi-Fi"; guardar(s); return s; }
    s.falhas ||= {};
    if (soBDM) s.bdmVez = new Date().toISOString();
    try {
      const ri = await pedir({ url: INDICE, headers: { "Cache-Control": "no-cache" } });
      const indice = ri.status < 400 ? json(ri) : null;
      if (!indice || !Array.isArray(indice.videos)) throw new Error(ri.status === 404 ? "o ramo ideias ainda não existe" : "não consegui ler o índice");
      const ja = await noRepositorio();
      const ids = new Set(indice.videos.map(v => v.id));
      const doFeed = (await bdmDoFeed(indice)).filter(v => !ids.has(v.id)).slice(0, 1);
      for (const v of doFeed) ids.add(v.id);
      for (const id of Object.keys(s.falhas)) if (!ids.has(id) || ja.has(id)) delete s.falhas[id];
      const videos = L.ordenarFila([...doFeed, ...indice.videos]);
      const bdmNovo = videos[0] && L.ehBDM(videos[0]) && L.diaBR(Date.parse(videos[0].publicado)) === L.diaBR() ? videos[0] : null;
      if (soBDM && bdmNovo && ja.has(bdmNovo.id)) s.bdmHoje = L.diaBR();
      const pend = (soBDM ? videos.filter(v => v === bdmNovo) : videos).filter(v => v?.id && !v.transcricao && !ja.has(v.id));
      const fila = pend.filter(v => (s.falhas[v.id]?.n || 0) < MAX_TENTATIVAS);
      const rodada = { em: new Date().toISOString(), baixadas: 0, falharam: 0 };
      let feitos = 0;
      for (const v of fila.slice(0, porVez)) {
        if (feitos++) await espera(pausa ?? (PAUSA_MS[0] + Math.random() * (PAUSA_MS[1] - PAUSA_MS[0])));
        try {
          const t = await transcrever(v.id);
          await subir({ id: v.id, canal: v.canal, titulo: v.titulo, publicado: v.publicado || null, url: v.url || L.urlVideo(v.id),
            idioma: t.idioma, auto: t.auto, ...(t.traduzidaDe ? { traduzidaDe: t.traduzidaDe } : {}), texto: t.texto,
            caracteres: t.texto.length, fonte: "celular", em: new Date().toISOString() });
          ja.add(v.id); delete s.falhas[v.id]; rodada.baixadas++;
          if (v === bdmNovo) s.bdmHoje = L.diaBR();
        } catch (e) {
          const codigo = e?.codigo || "erro";
          if (L.ehDoAparelho(codigo)) { rodada.parou = e.message; break; }
          if (!e?.codigo) { rodada.parou = String(e?.message || e).slice(0, 80); break; } // GitHub: para e tenta depois
          const f = (s.falhas[v.id] ||= { n: 0 });
          f.n++; f.motivo = e.message; f.codigo = codigo; f.em = new Date().toISOString();
          rodada.falharam++;
        }
      }
      if (soBDM) {  // a rodada curta não mexe na contagem nem nas 6 h
        if (rodada.baixadas || rodada.falharam || rodada.parou) s.rodadaBDM = rodada;
        guardar(s);
        return s;
      }
      s.rodada = rodada;
      s.noRepo = ja.size;
      s.esperando = pend.filter(v => !ja.has(v.id) && (s.falhas[v.id]?.n || 0) < MAX_TENTATIVAS).length;
      s.desistidos = pend.filter(v => !ja.has(v.id) && (s.falhas[v.id]?.n || 0) >= MAX_TENTATIVAS).length;
      s.ultimaVez = rodada.em;
      if (bdmNovo && ja.has(bdmNovo.id)) s.bdmHoje = L.diaBR();
      delete s.erro;
    } catch (e) {
      s.erro = String(e?.message || e).slice(0, 80);
    }
    guardar(s);
    return s;
  })().finally(() => { andamento = null; });
  return andamento;
}

/** main.js: 45 s depois de abrir e 20 s depois de voltar ao app (o `rodar` decide pelas 6 h). */
export function iniciarTranscricoes() {
  if (!nativo) return;
  setTimeout(() => rodar().catch(() => {}), 45000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(() => rodar().catch(() => {}), 20000);
  });
}
