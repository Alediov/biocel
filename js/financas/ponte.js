// Ponte entre o MacroDroid (no celular secundário) e as Finanças: COMENTÁRIOS NUMA ISSUE do repositório privado.
// A macro manda um HTTP Request POST para .../issues/<N>/comments com {"body":"orbita-financas fonte=slice;…"}: sem
// base64 e sem sha (só acrescenta), com um token "fine-grained" que só pode mexer em Issues deste repositório (não lê o
// código). Cada comentário é um evento do registro de execução da macro (início, etapas, fim com o saldo, erro);
// contas.js lê e guarda. O app lê os comentários novos (id > maxComentario) ao abrir as Finanças, ao voltar ao app e no
// Sincronizar, com o token do próprio app. Para os testes, `lerColetas({ comentarios })` usa a lista dada, sem rede.
import { E, salvar, hojeISO } from "../estado.js";
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import * as C from "./contas.js";
import { A as agenda, eventosDoDia } from "../agenda.js";

// a issue do registro já existe (#1, criada em 27/10/2026); procurar pelo título fica como reserva
export const TITULO_ISSUE = "Órbita · Finanças · registro das automações (MacroDroid)";
const TITULOS = [TITULO_ISSUE, "Órbita · Finanças · coletas do MacroDroid"];
export const ISSUE_PADRAO = { repo: "Alediov/odonto-quest", issue: 1 };
function F() {
  const f = C.garantir(E());
  if (!f.ponte && repo() === ISSUE_PADRAO.repo) f.ponte = { issue: ISSUE_PADRAO.issue, url: `https://github.com/${ISSUE_PADRAO.repo}/issues/${ISSUE_PADRAO.issue}`, repo: ISSUE_PADRAO.repo, padrao: true, em: "2026-10-27T12:00:00.000Z" };
  return f;
}
const repo = () => (E().config.repo || "").trim();
/** E().financas com o que falta (e a issue #1 do registro, no repositório do Alediov). */
export const financas = () => F();
const token = () => (E().config.token || "").trim();
const API = "https://api.github.com";

async function gh(caminho, { metodo = "GET", corpo = null } = {}) {
  if (!token()) throw new Error("Falta o token do GitHub do app (Ajustes do Órbita (engrenagem da Home)).");
  if (!navigator.onLine) throw new Error("Sem internet agora.");
  const r = await fetch(caminho.startsWith("http") ? caminho : `${API}${caminho}`, {
    method: metodo, cache: "no-store",
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(corpo ? { "Content-Type": "application/json" } : {}) },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });
  if (r.status === 404) return { status: 404, dados: null };
  if (r.status === 401) throw new Error("O GitHub recusou o token do app. Confira em Ajustes do Órbita (engrenagem da Home).");
  if (r.status === 403) throw new Error("O token do app não tem permissão para issues: em github.com → Settings → Developer settings → Fine-grained tokens, abra o token do Órbita e ponha Issues em \"Read and write\" (o token continua o mesmo).");
  if (!r.ok && r.status !== 204) throw new Error(`O GitHub respondeu ${r.status}.`);
  return { status: r.status, dados: r.status === 204 ? null : await r.json(), link: r.headers.get("link") || "" };
}

/** Endereço que o MacroDroid usa para comentar (POST). */
export function urlComentarios(n = F().ponte?.issue) { return n ? `${API}/repos/${repo()}/issues/${n}/comments` : ""; }

/** Procura a issue das coletas pelo título (abertas e fechadas). */
export async function procurarIssue() {
  for (let p = 1; p <= 5; p++) {
    const { dados } = await gh(`/repos/${repo()}/issues?state=all&per_page=100&page=${p}`);
    if (!Array.isArray(dados)) break;
    const achou = dados.find(i => !i.pull_request && TITULOS.includes(i.title));
    if (achou) return achou;
    if (dados.length < 100) break;
  }
  return null;
}
const CORPO_ISSUE = `Registro das automações do MacroDroid para as **Finanças** do Órbita.

Cada comentário é um evento de uma execução de macro, numa linha:

\`\`\`
orbita-financas fonte=slice;evento=fim;sats=8734;usd=6.95;sequencia=5
\`\`\`

Eventos: \`inicio\`, \`etapa\` (com \`etapa=<nome>\`), \`fim\` (com os valores) e \`erro\` (com \`msg=<o que houve>\`). O app lê os comentários novos e, se a opção estiver ligada, apaga os já importados. Não escreva outras coisas aqui.`;

/** Conecta: acha ou cria a issue e guarda o número. `numero`: usar uma issue escolhida à mão. */
export async function conectar(numero = null) {
  let issue;
  if (numero) {
    const { dados } = await gh(`/repos/${repo()}/issues/${numero}`);
    if (!dados) throw new Error(`A issue #${numero} não existe neste repositório.`);
    issue = dados;
  } else {
    issue = await procurarIssue();
    if (!issue) issue = (await gh(`/repos/${repo()}/issues`, { metodo: "POST", corpo: { title: TITULO_ISSUE, body: CORPO_ISSUE } })).dados;
  }
  if (issue.state === "closed") await gh(`/repos/${repo()}/issues/${issue.number}`, { metodo: "PATCH", corpo: { state: "open" } }).catch(() => {});
  const f = F();
  const mudou = f.ponte?.issue !== issue.number;
  f.ponte = { issue: issue.number, url: issue.html_url, repo: repo(), em: new Date().toISOString() };
  if (mudou) f.maxComentario = Math.max(f.maxComentario || 0, 0); // outra issue: os ids são do repositório inteiro, então o filtro por id continua valendo
  salvar();
  return f.ponte;
}

let rodando = null, ultimaLeitura = 0;
/**
 * Lê os comentários novos da issue e guarda os eventos (execuções e saldo). `comentarios`: lista injetada (testes, sem
 * rede). `forcar`: ignora o intervalo mínimo (botão "Ler agora", Sincronizar). Devolve { novos, coletas, execucoes,
 * invalidos } ou { pulou } / { erro }.
 */
export function lerColetas({ comentarios = null, forcar = false } = {}) {
  if (rodando) return comentarios || forcar ? rodando.then(() => lerColetas({ comentarios, forcar })) : rodando; // os injetados e o "Ler agora" esperam a leitura em curso
  rodando = (async () => {
    await null; // o `finally` abaixo tem de rodar depois desta atribuição (sem isso, um retorno sem await deixava `rodando` preso)
    const f = F();
    try {
      if (!comentarios) {
        if (!f.ponte?.issue) return { pulou: "sem issue" };
        if (!forcar && Date.now() - ultimaLeitura < 5 * 60000) return { pulou: "lido há pouco" };
        if (!token() || !navigator.onLine) return { pulou: "offline" };
      }
      ultimaLeitura = Date.now();
      const lista = comentarios || await baixarComentarios(f);
      const { eventos, invalidos, maxId } = C.eventosDeComentarios(lista, f.maxComentario || 0);
      const r = C.aplicarEventos(f, eventos);
      f.maxComentario = Math.max(f.maxComentario || 0, maxId);
      if (invalidos.length) f.ultimoProblema = { ...invalidos.at(-1), em: invalidos.at(-1).em };
      f.lidoEm = new Date().toISOString();
      salvar();
      if (!comentarios && f.ajustes?.apagarImportados) apagarImportados(lista.filter(c => c.id <= f.maxComentario && C.lerComentario(c.body).length)).catch(e => console.warn("Finanças: apagar", e.message));
      if (!comentarios) buscarCotacao().catch(() => {});
      avisar();
      return { novos: eventos.length, ...r, invalidos: invalidos.length };
    } catch (e) {
      console.warn("Finanças: leitura da issue", e.message);
      f.erroLeitura = { msg: e.message, em: new Date().toISOString() }; salvar();
      return { erro: e.message };
    } finally { rodando = null; }
  })();
  return rodando;
}
async function baixarComentarios(f) {
  // `since` (atualizados depois de) poupa páginas; o filtro por id faz o resto. Na 1ª leitura, todas.
  const desde = f.lidoEm && f.maxComentario ? new Date(Date.parse(f.lidoEm) - 2 * 864e5).toISOString() : null;
  const out = [];
  for (let p = 1; p <= 30; p++) {
    const { dados } = await gh(`/repos/${repo()}/issues/${f.ponte.issue}/comments?per_page=100&page=${p}${desde ? `&since=${encodeURIComponent(desde)}` : ""}`);
    if (!Array.isArray(dados)) { if (p === 1) throw new Error(`O GitHub não mostrou a issue #${f.ponte.issue}. Quase sempre é o token do app sem a permissão Issues (leitura): em github.com → Settings → Developer settings → Fine-grained tokens, abra o token do Órbita e ponha Issues em "Read and write" (o token continua o mesmo).`); break; }
    out.push(...dados.map(c => ({ id: c.id, body: c.body, created_at: c.created_at })));
    if (dados.length < 100) break;
  }
  return out;
}
/** Apaga da issue os comentários já importados (opção dos ajustes, desligada por padrão), para ela não crescer. */
async function apagarImportados(lista) {
  for (const c of lista.slice(0, 40)) { await gh(`/repos/${repo()}/issues/comments/${c.id}`, { metodo: "DELETE" }); await new Promise(r => setTimeout(r, 400)); }
}
/** O widget "Seu dinheiro": o total, a variação desde 1º/11 e o rendimento por dia, e a série da evolução. */
export async function enviarAoWidget() {
  if (!E().financas) return;
  try {
    const f = F(), hoje = hojeISO(), ev = C.evolucao(f, hoje);
    const { atualizarWidgetFinancas } = await import("../widget.js");
    if (!ev) { atualizarWidgetFinancas({ total: "", sub: "Abra as Finanças para mostrar o seu dinheiro.", serie: [] }); return; }
    const partes = [];
    if (!ev.comecou) partes.push("o gráfico começa em 1º/11");
    else if (ev.variacao != null) partes.push(`${C.reais(ev.variacao, { sinal: true })} desde 1º/11`);
    if (ev.porDia != null) partes.push(`+${C.reais(ev.porDia)}/dia`);
    atualizarWidgetFinancas({ total: C.reais(ev.total), sub: partes.join(" · ") || "rendimento ainda medindo", serie: ev.serie.map(x => [x.dia, x.brl]) });
  } catch (e) { console.warn("Finanças: widget", e.message); }
}
function avisar() {
  enviarAoWidget();
  window.dispatchEvent(new Event("oq-financas"));
  import("../notificacoes.js").then(N => N.reagendar()).catch(() => {});
  conferirParado().catch(e => console.warn("Finanças: dinheiro parado", e.message));
}

// ---------------------------------------------------------------- dinheiro parado fora do Render (03/11/2026)
// O app só lê a issue quando está aberto. Então: (1) aqui, depois de cada leitura e no timer do topo (main.js), confere
// a regra (contas.js `dinheiroParado`) e avisa na hora, uma vez por episódio (`f.paradoAvisados`, sincroniza: o tablet
// não repete); (2) no Android, a conferência da manhã (FinancasConferencia.java: alarme inexato às 7h15, reagendado no
// boot) busca os comentários recentes da issue sozinha e aplica a mesma regra. Ela precisa do token do app, que vai
// para o armazenamento privado do app (SharedPreferences) pelo plugin "FinancasNativo"; nunca para log nem repositório.
const ID_PARADO = 980;
let finNativo;
const FinNativo = () => (finNativo ??= Capacitor.isNativePlatform?.() ? registerPlugin("FinancasNativo") : null);
let ultimaConfigNativo = "";
/** Manda ao Android o que a conferência da manhã precisa (token, repositório, issue, horários das voltas e os episódios
 *  já resolvidos). Só quando muda (`forcar`: depois do "Já resolvi"). */
export async function configurarNativo(forcar = false) {
  if (!FinNativo() || !E().financas) return;
  const f = F(), tk = token(), ligado = !!(f.ponte?.issue && tk && repo());
  const voltas = Object.fromEntries(C.BANCOS_PP.map(b => [b, C.HORARIOS_PP[`volta_${b}`]]));
  const dados = { ligado, token: ligado ? tk : "", repo: repo(), issue: f.ponte?.issue || 0, prazo: C.PRAZO_PARADO_MIN,
    horarios: JSON.stringify(voltas), ignorar: JSON.stringify(Object.keys(f.paradoIgnorados || {})), hora: 7, minuto: 15,
    // os episódios que o app já avisou, com o dia: a conferência da manhã não repete no mesmo dia
    avisados: JSON.stringify(Object.fromEntries(Object.entries(f.paradoAvisados || {}).map(([k, v]) => [k, C.diaLocal(v.em)]))) };
  const assin = JSON.stringify(dados);
  if (!forcar && assin === ultimaConfigNativo) return;
  try { await FinNativo().configurar(dados); ultimaConfigNativo = assin; }
  catch (e) { console.warn("Finanças: conferência da manhã", e?.message || e); /* app antigo sem o plugin */ }
}
/** Confere o dinheiro parado e avisa na hora (uma vez por episódio). Devolve a lista (contas.js `dinheiroParado`). */
export async function conferirParado({ notificar = true } = {}) {
  if (!E().financas) return [];
  const f = F(), ps = C.dinheiroParado(f), p = ps[0], av = (f.paradoAvisados ||= {});
  if (!notificar || !p || av[p.chave]) { configurarNativo(); return ps; }
  av[p.chave] = { em: new Date().toISOString() };
  for (const k of Object.keys(av).sort((a, b) => (av[a].em < av[b].em ? 1 : -1)).slice(30)) delete av[k];
  salvar();
  configurarNativo();
  const t = C.textoParado(p);
  const { avisarAgora } = await import("../notificacoes.js");
  await avisarAgora({ id: ID_PARADO, title: t.titulo, body: t.texto, extra: { area: "financas" } });
  return ps;
}

// ---------------------------------------------------------------- cotação do dólar (AwesomeAPI), uma vez por dia
const nativo = !!Capacitor.isNativePlatform?.();
const Http = nativo ? registerPlugin("CapacitorHttp") : null;
async function pegarJson(url) {
  if (Http) {
    const r = await Http.request({ url, method: "GET", headers: { Accept: "application/json" }, connectTimeout: 12000, readTimeout: 12000 });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
export async function buscarCotacao({ forcar = false } = {}) {
  const f = F(), hoje = hojeISO(), c = f.cotacoes[hoje];
  if (!forcar && c?.usd && c?.btc) return c;
  if (!navigator.onLine) return null;
  // dólar e bitcoin em R$ (o Slice e o EarnApp acumulam em US$; a ZBD, o Earn Bitcoin e a Bipa, em sats)
  const d = await pegarJson("https://economia.awesomeapi.com.br/json/last/USD-BRL,BTC-BRL");
  const usd = parseFloat(d?.USDBRL?.bid), btc = parseFloat(d?.BTCBRL?.bid);
  const novo = { ...(c || {}), em: new Date().toISOString() };
  if (usd > 1 && usd < 50) novo.usd = Math.round(usd * 10000) / 10000;
  if (btc > 1e4 && btc < 1e8) novo.btc = Math.round(btc);
  if (!novo.usd && !novo.btc) throw new Error("cotação estranha");
  f.cotacoes[hoje] = novo;
  // guarda só os últimos 400 dias
  for (const k of Object.keys(f.cotacoes).sort().slice(0, -400)) delete f.cotacoes[k];
  salvar(); window.dispatchEvent(new Event("oq-financas"));
  return novo;
}

/** Ao voltar ao app e no Sincronizar: lê só se as Finanças já estão conectadas a uma issue. */
export async function lerSeConectado(forcar = false) {
  if (!E().financas || !F().ponte?.issue) return null;
  return lerColetas({ forcar });
}

// ---------------------------------------------------------------- a Agenda para o almoço e as passagens
/** Há horário na Agenda? (sem ele, a sugestão usa 22 dias de aula e as passagens contam de segunda a sexta) */
export function temAgenda() { try { return (agenda().itens || []).length > 0; } catch { return false; } }
/** O dia tem compromisso presencial (aula ou atividade da Agenda; eventos online e os da lista de eventos não contam;
 *  "Faltei" e "Não teve" também não)? É o dia que gasta 2 passagens. Sem Agenda: de segunda a sexta. */
export function diaPresencial(dia) {
  if (!temAgenda()) { const s = new Date(dia + "T12:00:00").getDay(); return s >= 1 && s <= 5; }
  try { return eventosDoDia(dia).some(ev => !["falta", "nao_teve"].includes(ev.presenca)); } catch { return false; }
}
/** Dias de aula do mês pela Agenda (null sem Agenda: a sugestão usa 22). */
export const diasDeAulaDoMes = (mes) => temAgenda() ? C.diasDeAula(mes, diaPresencial) : null;
/** As passagens que sobram hoje (contas.js, `passagensRestantes`) pela Agenda. */
export const passagensHoje = () => C.passagensRestantes(F(), hojeISO(), diaPresencial);
