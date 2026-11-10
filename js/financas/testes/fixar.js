// Testes de mercado → Cofres: fixar um cofre à mão (pedido do Alediov, 03/11/2026). Grava `config/cofres-fixos.json`
// na `main` do repositório PÚBLICO dos testes (Alediov/orbita-testes) pela API de conteúdo do GitHub, com o token do
// app (precisa ter acesso a esse repositório: token fine-grained com o repositório incluído e Contents: read and
// write). A rodada seguinte (a cada 6 h) lê o arquivo e o cofre vira um item `fixo: true`. Enquanto os dados não
// mostram, o app guarda o pedido no aparelho (localStorage `orbita.testes.fixos`). Nunca guarda token nenhum aqui.
import { E } from "../../estado.js";
import { REPO_PADRAO } from "./dados.js";

export const ARQUIVO = "config/cofres-fixos.json";
const CHAVE = "orbita.testes.fixos";
export const MSG_TOKEN = "O token do app precisa de acesso ao repositório orbita-testes: no GitHub, edite o token (fine-grained), inclua o repositório Alediov/orbita-testes e dê a permissão Contents: read and write.";

export class ErroFixar extends Error { constructor(msg, { token = false, status = 0 } = {}) { super(msg); this.token = token; this.status = status; } }

const repoTestes = () => ((E().config || {}).testesRepo || "").trim() || REPO_PADRAO;
const tokenDoApp = () => ((E().config || {}).token || "").trim();
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

function deBase64(b64) {
  const bin = atob(String(b64 || "").replace(/\s+/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function paraBase64(txt) {
  const bytes = new TextEncoder().encode(txt);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const negado = (s) => s === 401 || s === 403 || s === 404;

/** Fixa (`fixar` true) ou desafixa um cofre no arquivo do repositório. Lê o arquivo (conteúdo + sha) e grava a lista
 *  nova. `opts`: { token, repo, fetch, hoje } (para testar com um fetch de mentira). Devolve a lista gravada. */
export async function fixarCofre(endereco, fixar = true, opts = {}) {
  const token = (opts.token ?? tokenDoApp()).trim();
  if (!token) throw new ErroFixar(`Sem token do GitHub no app. ${MSG_TOKEN}`, { token: true });
  const f = opts.fetch || globalThis.fetch.bind(globalThis);
  const repo = opts.repo || repoTestes();
  const url = `https://api.github.com/repos/${repo}/contents/${ARQUIVO}`;
  const cab = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const end = String(endereco || "").toLowerCase();
  if (!/^0x[0-9a-f]{6,}$/.test(end)) throw new ErroFixar("Endereço de cofre estranho.");
  let r;
  try { r = await f(`${url}?ref=main`, { headers: cab, cache: "no-store" }); } catch { throw new ErroFixar("Sem conexão com o GitHub agora."); }
  let sha = null, lista = [];
  if (r.ok) {
    const j = await r.json();
    sha = j.sha || null;
    try { lista = JSON.parse(deBase64(j.content)).fixos || []; } catch { lista = []; }
  } else if (r.status === 401 || r.status === 403) throw new ErroFixar(MSG_TOKEN, { token: true, status: r.status });
  else if (r.status !== 404) throw new ErroFixar(`O GitHub respondeu ${r.status} ao ler os cofres fixados.`, { status: r.status });
  // 404 na leitura: o arquivo ainda não existe (o repositório é público); a gravação cria. Se for falta de acesso, a
  // gravação também responde 404 e cai na mensagem do token.
  lista = (Array.isArray(lista) ? lista : []).filter(x => x && x.endereco);
  const tem = lista.some(x => String(x.endereco).toLowerCase() === end);
  if (fixar && !tem) lista.push({ endereco: end, em: opts.hoje || hojeBR() });
  if (!fixar) lista = lista.filter(x => String(x.endereco).toLowerCase() !== end);
  const corpo = { message: `${fixar ? "Fixa" : "Desafixa"} o cofre ${end.slice(0, 10)}… (app Órbita)`, branch: "main",
    content: paraBase64(JSON.stringify({ fixos: lista }, null, 2) + "\n") };
  if (sha) corpo.sha = sha;
  try { r = await f(url, { method: "PUT", headers: { ...cab, "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); } catch { throw new ErroFixar("Sem conexão com o GitHub agora."); }
  if (negado(r.status)) throw new ErroFixar(MSG_TOKEN, { token: true, status: r.status });
  if (r.status === 409 || r.status === 422) throw new ErroFixar("O arquivo mudou no meio do caminho; tente de novo.", { status: r.status });
  if (!r.ok) throw new ErroFixar(`O GitHub respondeu ${r.status} ao gravar.`, { status: r.status });
  return lista;
}

// ------------------------------------------------------------------ o pedido guardado no aparelho até a rodada mostrar
/** { endereco: { fixar: true|false, em: ms } } */
export function pedidos() { try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch { return {}; } }
function guardar(p) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* */ } }
export function anotarPedido(endereco, fixar) { const p = pedidos(); p[String(endereco).toLowerCase()] = { fixar, em: Date.now() }; guardar(p); }
/** Tira os pedidos que os dados já mostram (o item fixo apareceu ou sumiu) e os de mais de 3 dias. */
export function conferirPedidos(forma) {
  const p = pedidos(), fixos = new Set((forma?.itens || []).filter(i => i.fixo && !i.saiu).map(i => String(i.endereco).toLowerCase()));
  let mudou = false;
  for (const [end, x] of Object.entries(p)) {
    if (x.fixar === fixos.has(end) || Date.now() - (x.em || 0) > 3 * 864e5) { delete p[end]; mudou = true; }
  }
  if (mudou) guardar(p);
  return p;
}
/** O cofre está fixado (pelos dados ou por um pedido ainda não visto)? E se está esperando a próxima rodada. */
export function situacaoFixo(forma, endereco) {
  const end = String(endereco || "").toLowerCase(), p = pedidos()[end];
  const nosDados = (forma?.itens || []).some(i => String(i.endereco).toLowerCase() === end && i.fixo && !i.saiu);
  if (p && p.fixar !== nosDados) return { fixo: p.fixar, esperando: true };
  return { fixo: nosDados, esperando: false };
}
