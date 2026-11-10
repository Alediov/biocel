// Simulado impresso (pedido do Alediov, 25/10/2026: "preciso escrever a mão também"). Toda madrugada a tarefa
// "Simulado do OdontoQuest" (gerador/SIMULADO.md) corrige as fotos enviadas e monta o simulado do dia:
// `simulados/AAAA-MM-DD.json` (questões, gabarito e critérios) e `simulados/AAAA-MM-DD.pdf` (para imprimir, sem o
// gabarito). Ele imprime, responde a mão (de uma vez ou aos poucos), fotografa ou digitaliza as folhas e envia pelo
// app; as fotos vão para o ramo `simulados-fotos` (respostas/<chave>/), fora da main. A correção volta em
// `simulados/correcoes/<chave>.json` e os erros entram nos próximos simulados.
// Simulados ESPECIAIS (pedido do Alediov, 26/10/2026): 2 dias antes e na véspera de cada prova, no lugar do simulado
// do dia, um simulado mais longo (~60 a 90 min) só do recorte da prova e no estilo das provas daquele professor.
// Chave `AAAA-MM-DD-esp-<sigla>` (ex.: 2026-10-27-esp-farmaco), mesma chave no PDF, na pasta das fotos, na correção
// e no estado (`enviados`, `vistos`); o simulado do dia tem a data como chave (como sempre).
// Lâminas no papel (pedido do Alediov, 03/11/2026, para a prova prática de Patologia de 01/12): questão `lamina` com
// uma fotomicrografia do Treino de Lâminas (extras/jogos/laminas.json) girada/espelhada como no PDF; na correção, a
// foto aparece dentro da questão (`figuraLamina`, a mesma transformação do papel).
// Cartão no fim da aba Aulas da trilha. Enviar as fotos vale a ofensiva e 5 XP (10 no especial); a correção vale
// 3 XP por ponto.
// Todos os simulados (pedido do Alediov, 05/11/2026: "fiquei uns dias sem fazê-los, mas quero recuperar esses dias
// perdidos"): `todosSimulados` lista todos os que existem no repositório (o Sincronizar baixa todos, sem limite de
// data), com a situação (não feito, fotos enviadas, corrigido com a nota) e Imprimir/Enviar de qualquer data. Os
// atrasados valem o mesmo XP uma vez por chave (`enviados`), e a ofensiva conta só para o dia em que ele manda as
// fotos (nunca volta aos dias que passaram); a tarefa corrige as fotos de qualquer data (tools/simulado/pendentes.py).
// Pedidos do Alediov de 09/11/2026: a dificuldade (Fácil · Média · Difícil, `E().simulados.dificuldade` {nivel, em},
// que a tarefa lê em progresso/sincronia/estado.json; padrão Média; os especiais ficam no estilo da prova), as fotos
// enviadas (ver, ampliar, girar, excluir e mudar a ordem antes da correção: simuladoFotos.js), os simulados que o
// repositório não tem mais somem da lista (`noRepo`: a limpeza dos passados não feitos) e o número de cada um.
// CADERNO DO DIA (pedido do Alediov, 09/11/2026: "os simulados estão muito difíceis… um próprio sistema de evolução:
// os resumos, os exercícios e daí sim os simulados"): a folha do dia (versão 3, `tipo: "caderno"`) tem o Resumo de um
// tema, a Prática no jeito das lições (com o `raciocinio` na correção) e a Prova no estilo das provas; os temas andam
// pelas etapas Resumo → Prática → Prova → Firme (tools/simulado/caderno.py, simulados/caderno.json, que o Sincronizar
// baixa como `caderno:estado`) e o MAPA DE DOMÍNIO (`cartaoMapa`, `abrirMapa`) mostra cada tema com a etapa, a última
// nota e a tendência. O nome visível é "Caderno do Dia"; "Simulado" ficou só nos especiais. As chaves, o código
// SIM-AAAAMMDD e `E().simulados` não mudaram.
import { E, salvar, hojeISO, somaDias, difDias, ganhar, registrarDiaEstudado, marcarSujo } from "./estado.js";
import { extra, urlMidia, listarExtras, baixarDoRepo, listarRepo, guardarExtraRepo, precisaExtraRepo, enviarBlobRepo, temToken } from "./dados.js";
import { toast, escapar, confete } from "./ui.js";
import { tocar } from "./sons.js";
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";
import { abrirFotos, guardarLocal, listaAtual, proximoNome } from "./simuladoFotos.js";

const RAMO = "simulados-fotos";
const S = () => (E().simulados ||= { enviados: {}, vistos: {} });
const dataBR = (d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const num = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
/** Nome dos arquivos: `AAAA-MM-DD.json` (do dia) ou `AAAA-MM-DD-esp-<sigla>.json` (especial de prova). */
const RE_ARQ = /^(\d{4}-\d{2}-\d{2}(?:-esp-[a-z0-9]+(?:-[a-z0-9]+)*)?)\.json$/;
const dataDe = (ch) => String(ch).slice(0, 10);
const ehEsp = (ch) => String(ch).includes("-esp-");
const chaveDe = (x) => x?.chave || x?.data;
const nomeProva = (s) => s?.prova?.nome || s?.prova?.disciplina || "prova";
const ehCaderno = (s) => s?.tipo === "caderno";
/** "Caderno" (versão 3) ou "Simulado" (os do dia de antes de 10/11/2026). */
const nomeFolha = (s) => (ehCaderno(s) ? "Caderno" : "Simulado");
/** O rótulo antigo do começo dos enunciados ("(Estilo concurso)"), que saiu a pedido dele (09/11/2026). */
const semRotulo = (t) => String(t || "").replace(/^\s*\((?=[^()]*\b(?:estilo|concurso|banca|adaptad[ao]|cespe|cebraspe|fgv|vunesp)\b)[^()]*\)\s*/i, "");

// ---------------------------------------------------------------- dificuldade
export const DIFICULDADES = [["facil", "Fácil"], ["media", "Média"], ["dificil", "Difícil"]];
const NOME_DIF = Object.fromEntries(DIFICULDADES);
/** A escolha dele para os próximos simulados do dia (a tarefa da madrugada lê; padrão Média). */
export function dificuldade() { const n = S().dificuldade?.nivel; return NOME_DIF[n] ? n : "media"; }
export function definirDificuldade(n) {
  if (!NOME_DIF[n] || n === dificuldade()) return;
  S().dificuldade = { nivel: n, em: new Date().toISOString() };
  salvar();
}
/** O seletor Fácil · Média · Difícil; `aoMudar` depois de trocar. */
function seletorDif(aoMudar) {
  const el = document.createElement("div"); el.className = "sim-dif"; el.setAttribute("role", "radiogroup");
  const pinta = () => {
    const at = dificuldade();
    el.innerHTML = `<span class="sim-dif-rot">Próximos</span>${DIFICULDADES.map(([n, nome]) => `<button role="radio" data-n="${n}" class="${n === at ? "on" : ""}" aria-checked="${n === at}">${nome}</button>`).join("")}`;
    el.querySelectorAll("button").forEach(b => (b.onclick = () => {
      if (b.dataset.n === dificuldade()) return;
      definirDificuldade(b.dataset.n); pinta(); tocar("toque");
      toast(`${NOME_DIF[b.dataset.n]} a partir do próximo simulado.`); aoMudar?.();
    }));
  };
  pinta();
  return el;
}
/** As chaves que o repositório tem (do último Sincronizar): os que saíram de lá não aparecem mais. */
const CHAVE_NO_REPO = "orbita.simulados.noRepo";
function noRepo() { try { const l = JSON.parse(localStorage.getItem(CHAVE_NO_REPO) || "null"); return Array.isArray(l) ? new Set(l) : null; } catch { return null; } }
const existe = (ch) => { const r = noRepo(); return !r || r.has(ch); };
let cssPronto = null;
/** O simulado.css (fotos, dificuldade e a tela Todos), uma vez. */
function garantirCss() {
  if (cssPronto || typeof document === "undefined") return cssPronto || Promise.resolve();
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "simulado.css";
  cssPronto = new Promise((ok) => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  document.head.append(l);
  return cssPronto;
}

// ---------------------------------------------------------------- baixar (no Sincronizar)
/**
 * Baixa os simulados (do dia e especiais) e as correções, de QUALQUER data (antes, só as duas últimas semanas: as
 * correções de simulados antigos feitos com atraso não chegariam). Só o que mudou (pelo sha). Devolve quantos vieram.
 */
export async function baixarSimulados(aoProgresso = () => {}) {
  let n = 0;
  for (const [pasta, pref] of [["simulados", "sim"], ["simulados/correcoes", "cor"]]) {
    const lista = await listarRepo(pasta);
    if (pref === "sim" && lista.length) {
      const chs = lista.map(a => a.name.match(RE_ARQ)?.[1]).filter(Boolean);
      if (chs.length) try { localStorage.setItem(CHAVE_NO_REPO, JSON.stringify(chs)); } catch { /* sem espaço */ }
    }
    for (const arq of lista) {
      if (pref === "sim" && arq.name === "caderno.json") {
        // o estado dos temas do Caderno do Dia (o mapa de domínio)
        const item = { id: "caderno:estado", hash: arq.sha };
        if (await precisaExtraRepo(item)) {
          aoProgresso("Baixando o mapa dos temas…");
          const r = await baixarDoRepo("simulados/caderno.json");
          if (r) { await guardarExtraRepo(item, await r.json()); n++; }
        }
        continue;
      }
      const m = arq.name.match(RE_ARQ);
      if (!m) continue;
      const ch = m[1], item = { id: `${pref}:${ch}`, hash: arq.sha };
      if (!(await precisaExtraRepo(item))) continue;
      aoProgresso(pref === "sim" ? (ehEsp(ch) ? "Baixando o simulado especial…" : "Baixando o simulado…") : "Baixando a correção do simulado…");
      const r = await baixarDoRepo(`${pasta}/${ch}.json`);
      if (!r) continue;
      const dados = await r.json();
      if (dados && typeof dados === "object") dados.chave ||= ch;
      await guardarExtraRepo(item, dados); n++;
    }
  }
  return n;
}
/** Os simulados especiais de um dia (o mais perto da prova primeiro). */
export async function especiaisDe(data) {
  const l = await listarExtras(`sim:${data}-esp-`).catch(() => []);
  return l.filter(s => s?.questoes?.length && existe(chaveDe(s))).sort((a, b) => (a.prova?.data || "").localeCompare(b.prova?.data || ""));
}
let buscouEm = "";
/** Sem nada de hoje guardado: busca no repositório uma vez por sessão (o Sincronizar pode não ter rodado). */
async function buscarDoDia(hoje) {
  if (buscouEm === hoje || !temToken() || !navigator.onLine) return false;
  buscouEm = hoje;
  try { return (await baixarSimulados()) > 0; } catch { return false; }
}
/** Todas as correções guardadas (a mais recente primeiro). */
async function correcoes() {
  const l = (await listarExtras("cor:").catch(() => [])).filter(c => c?.data && c.nota != null);
  return l.sort((a, b) => chaveDe(b).localeCompare(chaveDe(a)));
}
/** "amanhã", "em 2 dias", "hoje" ou "foi em 28/10". */
function quandoProva(s, hoje) {
  const d = s?.prova?.data ? difDias(hoje, s.prova.data) : null;
  if (d == null) return "";
  return d === 0 ? "hoje" : d === 1 ? "amanhã" : d > 1 ? `em ${d} dias` : `foi em ${dataBR(s.prova.data)}`;
}
/** Título curto de um simulado pela chave (o especial leva o nome da prova). */
async function titulo(ch) {
  const s = await extra(`sim:${ch}`);
  if (!ehEsp(ch)) return `${nomeFolha(s)} de ${dataBR(dataDe(ch))}`;
  return `Especial · ${nomeProva(s)} (${dataBR(dataDe(ch))})`;
}

// ---------------------------------------------------------------- cartão na trilha
export async function cartaoSimulado(P) {
  const el = document.createElement("div"); el.className = "sim-cartao";
  P.append(el);
  garantirCss();
  const hoje = hojeISO(), st = S();
  let sim = await extra(`sim:${hoje}`), esp = await especiaisDe(hoje);
  if (!sim && !esp.length && (await buscarDoDia(hoje))) { sim = await extra(`sim:${hoje}`); esp = await especiaisDe(hoje); }
  // correções que chegaram e ainda não foram vistas (a mais recente primeiro)
  // (também a de um simulado antigo feito com atraso: pela data da correção)
  const limite = somaDias(hoje, -14);
  const novas = (await correcoes()).filter(c => !st.vistos[chaveDe(c)] && (dataDe(chaveDe(c)) >= limite || String(c.corrigidoEm || "").slice(0, 10) >= limite));
  // simulados dos últimos 3 dias ainda sem fotos (ele pode fazer aos poucos), do dia e especiais
  const atrasados = [];
  for (let i = 1; i <= 3; i++) {
    const d = somaDias(hoje, -i);
    if (!st.enviados[d] && existe(d) && !(await extra(`cor:${d}`)) && (await extra(`sim:${d}`))) atrasados.push({ ch: d, nome: `O de ${dataBR(d)}` });
    for (const s of await especiaisDe(d)) {
      const ch = chaveDe(s);
      if (!st.enviados[ch] && !(await extra(`cor:${ch}`))) atrasados.push({ ch, nome: `O especial de ${escapar(nomeProva(s))} (${dataBR(d)})` });
    }
  }
  const sub = sim ? `${sim.numero ? `Nº ${sim.numero} · ` : ""}${ehCaderno(sim) ? partesTxt(sim) : `${sim.questoes.length} questões`} · ${sim.tempo || 30} min${sim.dificuldade ? ` · ${NOME_DIF[sim.dificuldade] || ""}` : ""} · ${escapar(disciplinas(sim))}`
    : esp.length ? `Hoje é dia de ${esp.length > 1 ? "simulados especiais: cada um só com o conteúdo da sua prova" : "simulado especial: só o conteúdo da prova"}, no estilo dela.`
    : "O de hoje chega de madrugada, junto das lições.";
  let h = `<div class="sim-topo"><span class="sim-ico">${ICONE}</span><div><b>Caderno do Dia</b><small>${sub}</small></div></div>`;
  for (const c of novas.slice(0, 2)) {
    const ch = chaveDe(c);
    h += `<button class="sim-cor${ehEsp(ch) ? " esp" : ""}" data-ver="${escapar(ch)}"><span class="sim-nota" style="--p:${c.nota / (c.total || 10)}"><b>${num(c.nota)}</b></span><span><b>Correção ${ehEsp(ch) ? `do especial de ${escapar(nomeProva(await extra(`sim:${ch}`)))}` : `do ${nomeFolha(await extra(`sim:${ch}`)).toLowerCase()} de ${dataBR(c.data)}`} chegou</b><small>${escapar(c.geral || "").slice(0, 110)}${(c.geral || "").length > 110 ? "…" : ""}</small></span></button>`;
  }
  for (const s of esp) h += blocoEspecial(s, hoje, st);
  if (sim) {
    const env = st.enviados[hoje];
    if (ehCaderno(sim) && sim.resumo?.length) h += `<p class="sim-foco cad-resumo-linha"><b>Resumo de hoje:</b> ${sim.resumo.map(r => escapar(r.titulo)).join(" · ")}</p>`;
    else if (sim.foco?.length) h += `<p class="sim-foco">Foco: ${sim.foco.map(escapar).join(" · ")}</p>`;
    h += `<div class="sim-bts"><button class="botao secundario" data-a="imprimir" data-ch="${hoje}">Imprimir</button><button class="botao" data-a="enviar" data-ch="${hoje}">${env ? "Mandar mais fotos" : "Enviar as fotos"}</button></div>`;
    if (env) h += `<p class="sim-ok"><button class="link sim-ver-fotos" data-a="fotos" data-ch="${hoje}">${fotosTxt(env)}</button> · a correção chega de madrugada</p>`;
  }
  for (const a of atrasados) h += `<div class="sim-atras"><span>${a.nome} ainda não foi enviado</span><button class="link" data-a="imprimir" data-ch="${escapar(a.ch)}">PDF</button><button class="link" data-a="enviar" data-ch="${escapar(a.ch)}">Enviar</button></div>`;
  const naoFeitos = (await listaSimulados()).filter(x => x.situacao === "nao" && x.ch !== hoje && !(esp.some(e => chaveDe(e) === x.ch))).length;
  h += `<div class="sim-links"><button class="link sim-todos" data-a="todos">Todos os cadernos${naoFeitos ? ` <i class="sim-badge">${naoFeitos} não feito${naoFeitos > 1 ? "s" : ""}</i>` : ""}</button><button class="link sim-hist" data-a="historico">Correções anteriores</button></div>`;
  el.innerHTML = h;
  el.querySelector(".sim-topo").after(seletorDif());
  const refazer = () => { el.remove(); cartaoSimulado(P); };
  el.querySelectorAll('[data-a="fotos"]').forEach(b => (b.onclick = () => verFotos(b.dataset.ch, refazer)));
  el.querySelectorAll('[data-a="imprimir"]').forEach(b => (b.onclick = () => imprimir(b.dataset.ch, b)));
  el.querySelectorAll('[data-a="enviar"]').forEach(b => (b.onclick = () => escolherFotos(b.dataset.ch, b, refazer)));
  el.querySelectorAll("[data-ver]").forEach(b => (b.onclick = () => verCorrecao(b.dataset.ver, refazer)));
  el.querySelector('[data-a="historico"]').onclick = historico;
  el.querySelector('[data-a="todos"]').onclick = () => todosSimulados(refazer);
  // o mapa de domínio dos temas, logo depois do cartão (fim da aba Aulas)
  const mapa = await cartaoMapa();
  if (mapa && el.isConnected) el.after(mapa);
}
/** Tira `*itálico*` e `**negrito**` (resumos de uma linha) ou os transforma em itálico e negrito. */
const semMarcas = (t) => String(t || "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
const enfase = (t) => escapar(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
/** "Resumo + 5 de prática + 3 de prova" (o Caderno do Dia). */
function partesTxt(sim) {
  const pr = sim.questoes.filter(q => q.etapa === "pratica").length, pv = sim.questoes.length - pr;
  return `${sim.resumo?.length ? "Resumo + " : ""}${pr} de prática + ${pv} de prova`;
}
const disciplinas = (sim) => [...new Set(sim.questoes.map(q => q.disciplina).filter(Boolean))].join(", ");
const fotosTxt = (env) => `${env.fotos} foto${env.fotos > 1 ? "s" : ""} enviada${env.fotos > 1 ? "s" : ""}`;

/** O especial de uma prova, com a faixa de destaque, Imprimir e Enviar próprios. */
function blocoEspecial(s, hoje, st) {
  const ch = chaveDe(s), env = st.enviados[ch], pv = s.prova || {};
  const quando = quandoProva(s, hoje);
  return `<div class="sim-especial" data-ch="${escapar(ch)}">
    <div class="sim-faixa">${ESTRELA}<span>Especial — ${escapar(nomeProva(s))}${quando ? ` ${quando}` : ""}</span></div>
    <div class="sim-esp-info"><b>${escapar(pv.titulo || "Prova")} · ${dataBR(pv.data || dataDe(ch))}${pv.hora ? ` às ${escapar(pv.hora)}` : ""}</b>
      <small>${s.questoes.length} questões · ${s.tempo || 60} min${s.estilo ? ` · estilo: ${escapar(s.estilo)}` : ""}</small></div>
    ${s.foco?.length ? `<p class="sim-foco">Foco: ${s.foco.map(escapar).join(" · ")}</p>` : ""}
    <div class="sim-bts"><button class="botao secundario" data-a="imprimir" data-ch="${escapar(ch)}">Imprimir</button><button class="botao" data-a="enviar" data-ch="${escapar(ch)}">${env ? "Mandar mais fotos" : "Enviar as fotos"}</button></div>
    ${env ? `<p class="sim-ok"><button class="link sim-ver-fotos" data-a="fotos" data-ch="${escapar(ch)}">${fotosTxt(env)}</button> · a correção chega de madrugada</p>` : ""}
  </div>`;
}

// ---------------------------------------------------------------- imprimir
async function imprimir(ch, bt) {
  const t = bt.textContent; bt.disabled = true; bt.textContent = "Baixando…";
  try {
    const r = await baixarDoRepo(`simulados/${ch}.pdf`);
    if (!r) throw new Error("O PDF ainda não está no repositório.");
    const s = await extra(`sim:${ch}`);
    const nome = ehEsp(ch) ? `Simulado especial ${nomeProva(s)} ${dataDe(ch)}.pdf` : `${ehCaderno(s) ? "Caderno do Dia" : "Simulado"} ${ch}.pdf`;
    await abrirArquivo(await r.blob(), nome);
  } catch (e) { toast(e.message, 4000); } finally { bt.disabled = false; bt.textContent = t; }
}
async function abrirArquivo(blob, nome) {
  if (Capacitor.isNativePlatform?.()) {
    const Filesystem = registerPlugin("Filesystem"), Share = registerPlugin("Share");
    const b64 = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
    const { uri } = await Filesystem.writeFile({ path: `simulados/${nome}`, data: b64, directory: "CACHE", recursive: true });
    await Share.share({ title: nome, files: [uri], dialogTitle: "Imprimir ou abrir" }).catch(() => {});
  } else {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.target = "_blank"; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
}

// ---------------------------------------------------------------- enviar as fotos
function escolherFotos(ch, bt, depois) {
  if (!temToken()) { toast("Configure o token em Ajustes do Órbita (engrenagem da Home) para enviar."); return; }
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*,application/pdf"; inp.multiple = true;
  inp.onchange = () => inp.files.length && enviar(ch, [...inp.files], bt).then(depois);
  inp.click();
}
async function reduzir(arq) {
  if (arq.type === "application/pdf") return { blob: arq, ext: "pdf" };
  const bmp = await createImageBitmap(arq, { imageOrientation: "from-image" });
  const lado = 2200, k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.86));
  return { blob, ext: "jpg" };
}
async function enviar(ch, arquivos, bt) {
  if (!navigator.onLine) { toast("Sem internet agora: tente de novo quando conectar."); return; }
  const st = S(), t = bt.textContent; bt.disabled = true;
  bt.textContent = "Preparando…";
  // a lista que vale é a do ramo (ele pode ter excluído ou reordenado em outro aparelho)
  const ant = await listaAtual(ch);
  const lista = [...ant], data = dataDe(ch), esp = ehEsp(ch);
  try {
    for (const [i, arq] of arquivos.entries()) {
      bt.textContent = `Enviando ${i + 1} de ${arquivos.length}…`;
      const { blob, ext } = await reduzir(arq);
      const nome = proximoNome(lista, ext);
      await enviarBlobRepo(`respostas/${ch}/${nome}`, blob, `Simulado ${ch}: ${nome}`, RAMO);
      lista.push(nome);
      guardarLocal(ch, nome, blob).catch(() => {}); // para ver depois da correção, quando a pasta sai do ramo
    }
    const hoje = hojeISO(), atrasado = data < hoje;
    // `feitoEm`: o dia em que ele respondeu (num atrasado, não é o da chave; a correção usa este no histórico)
    const envio = { chave: ch, data, especial: esp, fotos: lista, quando: new Date().toISOString(), feitoEm: hoje, ...(atrasado ? { atrasado: true } : {}) };
    await enviarBlobRepo(`respostas/${ch}/envio.json`, new Blob([JSON.stringify(envio, null, 1)], { type: "application/json" }), `Simulado ${ch}: envio`, RAMO);
    const primeiro = !st.enviados[ch];
    st.enviados[ch] = { fotos: lista.length, lista, quando: envio.quando };
    if (primeiro) {
      // o XP uma vez por chave (do dia ou atrasado); a ofensiva só a de HOJE (registrarDiaEstudado marca o dia de
      // hoje): fazer um simulado antigo é estudar hoje, mas os dias que passaram não voltam
      ganhar(esp ? 10 : 5, esp ? 4 : 2, `${await titulo(ch)} enviado${atrasado ? " (atrasado)" : ""}`, "simulado");
      registrarDiaEstudado();
      marcarSujo(hoje);
    }
    salvar();
    tocar("moeda");
    toast(`${arquivos.length} arquivo${arquivos.length > 1 ? "s" : ""} enviado${arquivos.length > 1 ? "s" : ""}. A correção chega de madrugada.${atrasado && primeiro ? " Conta na ofensiva de hoje." : ""}`, 3500);
  } catch (e) {
    if (lista.length > ant.length) { st.enviados[ch] = { fotos: lista.length, lista, quando: new Date().toISOString() }; salvar(); }
    toast(e.message, 4500);
  } finally { bt.disabled = false; bt.textContent = t; }
}

// ---------------------------------------------------------------- correção
async function verCorrecao(ch, depois) {
  const c = await extra(`cor:${ch}`), sim = await extra(`sim:${ch}`);
  if (!c) { toast("Essa correção ainda não chegou."); return; }
  await garantirCss();
  const st = S(), nome = await titulo(ch);
  let premio = "";
  if (!st.vistos[ch]) {
    const xp = ganhar(Math.round(c.nota * 3), Math.round(c.nota), `${nome}: ${num(c.nota)}/${c.total || 10}`, "simulado");
    st.vistos[ch] = { nota: c.nota, em: new Date().toISOString() }; salvar();
    premio = `<span class="sim-premio">+${xp} XP</span>`;
    if (c.nota >= 0.85 * (c.total || 10)) { confete(); tocar("combo"); } else tocar("fim");
  }
  const qs = new Map((sim?.questoes || []).map(q => [q.n, q]));
  const cor = (q) => (q.pontos >= q.max - 1e-6 ? "ok" : q.pontos > 0 ? "parcial" : "erro");
  const esperado = (q) => {
    if (!q) return "";
    if (q.tipo === "multipla") return `${"ABCDE"[q.correta]}) ${q.alternativas[q.correta]}`;
    if (q.tipo === "vf") return q.itens.map(x => (x.v ? "V" : "F")).join(" · ");
    if (q.tipo === "associacao") return q.gabarito.map(g => `(${g})`).join(" ");
    if (q.tipo === "lacunas") return q.respostas.map((r, i) => `${String.fromCharCode(97 + i)}) ${[].concat(r)[0]}`).join(" · ");
    if (q.tipo === "caso") return q.itens.map((it, i) => `${String.fromCharCode(97 + i)}) ${it.resposta}`).join("\n");
    // discursiva com itens a), b), c) (05/11/2026): a resposta de cada letra, se o item tiver; senão a da questão
    if (q.tipo === "discursiva" && q.itens?.length && q.itens.every(it => it.resposta)) return q.itens.map(it => `${it.letra}) ${it.resposta}`).join("\n");
    return q.resposta || "";
  };
  const temas = new Map((sim?.temas || []).map(t => [t.id, t]));
  const bloco = (q) => {
    const s = qs.get(q.n);
    const tx = s?.tipo === "lamina" ? `Lâmina · ${s.nome || "Patologia"}` : semMarcas(semRotulo(s?.enunciado || s?.contexto || (s?.itens?.[0]?.texto ?? "")));
    const tema = s?.tema && temas.get(s.tema);
    return `<details class="sim-q ${cor(q)}"><summary><span class="sim-q-n">${q.n}</span><span class="sim-q-tx">${tema ? `<i class="cad-q-tema">${escapar(tema.titulo)}</i>` : ""}${escapar(tx.slice(0, 90))}${tx.length > 90 ? "…" : ""}</span><b>${num(q.pontos)}/${num(q.max)}</b></summary>
          ${s?.tipo === "lamina" ? figuraLamina(s, q) : ""}
          ${s?.tipo === "discursiva" && s.itens?.length && !s.anestesia ? `<ol class="sim-itens">${s.itens.map(it => `<li><b>${escapar(it.letra)})</b> ${enfase(it.texto || "")}</li>`).join("")}</ol>` : ""}
          ${q.lido ? `<p><small>O que você escreveu</small>${escapar(q.lido)}</p>` : ""}
          <p><small>Correção</small>${escapar(q.comentario || "")}</p>
          ${s?.raciocinio ? `<p class="cad-raciocinio"><small>O raciocínio</small>${enfase(s.raciocinio)}</p>` : ""}
          ${s?.tipo === "vf" && s.itens?.length ? `<div class="sim-esp"><small>Resposta esperada</small><ol class="sim-vf">${s.itens.map(x => `<li><span class="sim-vf-l ${x.v ? "v" : "f"}">${x.v ? "V" : "F"}</span><span>${enfase(x.texto || "")}</span></li>`).join("")}</ol></div>`
            : s ? `<p class="sim-esp"><small>Resposta esperada</small>${enfase(esperado(s)).replace(/\n/g, "<br>")}</p>` : ""}
          ${s?.fonte ? `<p class="sim-fonte">${escapar(s.fonte)}</p>` : ""}</details>`;
  };
  const tela = document.createElement("div"); tela.className = "sim-tela";
  tela.innerHTML = `<header class="sim-t-cab"><button class="sim-fechar" aria-label="Fechar">✕</button><b>${escapar(nome)}</b></header>
    <div class="sim-t-rol">
      ${ehEsp(ch) && sim?.prova ? `<p class="sim-t-esp">${ESTRELA}<span>Simulado especial · ${escapar(sim.prova.titulo || "prova")} de ${escapar(nomeProva(sim))} em ${dataBR(sim.prova.data)}</span></p>` : ""}
      <div class="sim-t-nota"><span class="sim-nota grande" style="--p:${c.nota / (c.total || 10)}"><b>${num(c.nota)}</b><small>de ${c.total || 10}</small></span>${premio}
        ${c.tempo ? `<p class="sim-t-tempo">Tempo: ${escapar(c.tempo)}</p>` : ""}<p>${escapar(c.geral || "")}</p></div>
      ${c.fortes?.length ? `<div class="sim-t-bloco ok"><h3>Mandou bem</h3><ul>${c.fortes.map(x => `<li>${escapar(x)}</li>`).join("")}</ul></div>` : ""}
      ${c.reforcar?.length ? `<div class="sim-t-bloco"><h3>Para reforçar (volta nas próximas folhas)</h3><ul>${c.reforcar.map(x => `<li>${escapar(x.conceito || x)}${x.motivo ? ` <small>${escapar(x.motivo)}</small>` : ""}</li>`).join("")}</ul></div>` : ""}
      ${ehCaderno(sim) ? htmlCadernoCorrecao(sim, c, bloco) : (c.questoes || []).map(bloco).join("")}
    </div>`;
  document.body.append(tela);
  tela.querySelectorAll(".sim-lam img[data-img]").forEach(porImagemLamina);
  requestAnimationFrame(() => tela.classList.add("aberto"));
  tela.querySelector(".sim-fechar").onclick = () => { tela.classList.remove("aberto"); setTimeout(() => tela.remove(), 250); depois?.(); };
}

/** A correção do Caderno do Dia: o resumo do dia (recolhido), a Prática (com o raciocínio) e a Prova, cada uma com a sua
 * nota, e os temas da folha. */
function htmlCadernoCorrecao(sim, c, bloco) {
  const et = new Map((sim.questoes || []).map(q => [q.n, q.etapa]));
  const parte = (e) => (c.questoes || []).filter(q => et.get(q.n) === e);
  const soma = (l) => [l.reduce((a, q) => a + (q.pontos || 0), 0), l.reduce((a, q) => a + (q.max || 0), 0)];
  let h = "";
  if (sim.resumo?.length) {
    h += `<details class="cad-resumo-app"><summary>${ICONE_LIVRO}<span><b>O resumo de hoje</b><small>${sim.resumo.map(r => escapar(r.titulo)).join(" · ")}</small></span></summary>
      ${sim.resumo.map(r => `<div class="cad-rs"><h4>${escapar(r.titulo)}</h4><ol>${(r.pontos || []).map(x => `<li>${x.titulo ? `<b>${escapar(x.titulo)}.</b> ` : ""}${enfase(x.texto)}</li>`).join("")}</ol>
        ${r.cai?.length ? `<p class="cad-cai"><small>Costuma cair</small>${r.cai.map(escapar).join(" · ")}</p>` : ""}${r.fonte ? `<p class="sim-fonte">${escapar(r.fonte)}</p>` : ""}</div>`).join("")}</details>`;
  }
  for (const [e, nome, sub] of [["pratica", "Prática", "no jeito das lições"], ["prova", "Prova", "no estilo das provas"]]) {
    const l = parte(e);
    if (!l.length) continue;
    const [pt, mx] = soma(l);
    h += `<h3 class="cad-sec ${e}"><span>${nome}</span><small>${sub}</small><b>${num(pt)}/${num(mx)}</b></h3>${l.map(bloco).join("")}`;
  }
  const resto = (c.questoes || []).filter(q => !["pratica", "prova"].includes(et.get(q.n)));
  return h + resto.map(bloco).join("");
}

/** A lâmina como saiu no papel (mesmo giro e espelho), com o aumento e o que ele identificou. */
function figuraLamina(s, q) {
  const orienta = `rotate(${s.giro === 180 ? 180 : 0}deg) scaleX(${s.espelho ? -1 : 1})`;
  const disse = q.identificou === true ? "Identificou" : q.identificou === "parcial" ? "Identificou em parte" : q.identificou === false ? "Não identificou" : "";
  return `<figure class="sim-lam"><img alt="Fotomicrografia da questão" data-img="${escapar(s.img || "")}" style="transform:${orienta}">
    <figcaption>${escapar(s.aumento ? `${s.aumento[0].toUpperCase()}${s.aumento.slice(1)} aumento` : "Fotomicrografia")} · como no papel${disse ? ` · <b>${disse}</b>` : ""}</figcaption></figure>`;
}
/** Imagem guardada no aparelho (mídia do Treino de Lâminas) ou, sem ela, o arquivo do repositório. */
async function porImagemLamina(img) {
  const c = img.dataset.img;
  img.onerror = () => { img.onerror = null; img.src = `../${c}`; };
  img.src = (await urlMidia(c).catch(() => null)) || `../${c}`;
}

// ---------------------------------------------------------------- todos os simulados
/**
 * Todos os simulados guardados no aparelho (do dia e especiais), do mais novo para o mais velho, com a situação:
 * "nao" (sem fotos nem correção), "enviado" (fotos enviadas, correção a caminho) ou "corrigido" (com a nota).
 */
export async function listaSimulados() {
  const st = S(), out = [];
  for (const sim of await listarExtras("sim:").catch(() => [])) {
    const ch = chaveDe(sim);
    if (!ch || !sim?.questoes?.length || !existe(ch)) continue;
    const cor = await extra(`cor:${ch}`).catch(() => null), env = st.enviados[ch];
    out.push({ ch, sim, cor, env, data: dataDe(ch), esp: ehEsp(ch),
      situacao: cor && cor.nota != null ? "corrigido" : env ? "enviado" : "nao" });
  }
  return out.sort((a, b) => b.ch.localeCompare(a.ch));
}
const FILTROS = [["nao", "Não feitos"], ["enviado", "Enviados"], ["corrigido", "Corrigidos"], ["todos", "Todos"]];
const CHAVE_FILTRO = "orbita.simulados.filtro";
const DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** A tela "Todos os simulados": filtro (Não feitos primeiro), situação e Imprimir/Enviar de qualquer data. */
export async function todosSimulados(depois) {
  await garantirCss();
  const tela = document.createElement("div"); tela.className = "sim-tela sim-todas";
  tela.innerHTML = `<header class="sim-t-cab"><button class="sim-fechar" aria-label="Fechar">✕</button><b>Todos os cadernos</b></header>
    <div class="sim-t-rol"><div class="sim-resumo"></div><div class="sim-mapa-lugar"></div><div class="sim-dif-lugar"></div>
    <p class="sim-t-aviso">Atrasados valem o mesmo XP; a ofensiva conta só para o dia em que você manda.</p>
    <div class="sim-filtros" role="tablist"></div><p class="sim-buscando" hidden>Procurando simulados no repositório…</p><div class="sim-lista"></div></div>`;
  tela.querySelector(".sim-dif-lugar").replaceWith(seletorDif());
  cartaoMapa().then(m => { if (m) tela.querySelector(".sim-mapa-lugar")?.replaceWith(m); });
  document.body.append(tela);
  requestAnimationFrame(() => tela.classList.add("aberto"));
  let filtro = (() => { try { return localStorage.getItem(CHAVE_FILTRO) || "nao"; } catch { return "nao"; } })();
  let lista = [];
  const hoje = hojeISO();
  const pintar = () => {
    // o resumo no alto: feitos, corrigidos e a média das 5 últimas notas
    const cor = lista.filter(x => x.situacao === "corrigido"), feitos = lista.filter(x => x.situacao !== "nao").length;
    const ult = cor.slice(0, 5), media = ult.length ? ult.reduce((a, x) => a + (10 * x.cor.nota) / (x.cor.total || 10), 0) / ult.length : null;
    tela.querySelector(".sim-resumo").innerHTML = `<span><b>${feitos}</b><small>feito${feitos === 1 ? "" : "s"}</small></span>
      <span><b>${cor.length}</b><small>corrigido${cor.length === 1 ? "" : "s"}</small></span>
      <span class="sim-r-media"><b>${media == null ? "—" : num(Math.round(media * 10) / 10)}</b><small>média${ult.length > 1 ? ` das ${ult.length} últimas` : ""}</small></span>`;
    const cont = (f) => (f === "todos" ? lista.length : lista.filter(x => x.situacao === f).length);
    tela.querySelector(".sim-filtros").innerHTML = FILTROS.map(([f, n]) => `<button role="tab" data-f="${f}" class="${f === filtro ? "on" : ""}" aria-selected="${f === filtro}"><span>${n}</span><small>${cont(f)}</small></button>`).join("");
    tela.querySelectorAll(".sim-filtros button").forEach(b => (b.onclick = () => { filtro = b.dataset.f; try { localStorage.setItem(CHAVE_FILTRO, filtro); } catch { /* */ } pintar(); }));
    const l = filtro === "todos" ? lista : lista.filter(x => x.situacao === filtro);
    const caixa = tela.querySelector(".sim-lista");
    if (!l.length) {
      caixa.innerHTML = `<p class="sim-vazio">${filtro === "nao" ? (lista.length ? "Nenhum caderno por fazer. Em dia!" : "Nenhum caderno guardado ainda. Eles chegam no Sincronizar.") : "Nada aqui ainda."}</p>`;
      return;
    }
    let mes = "";
    caixa.innerHTML = l.map(x => {
      const d = new Date(x.data + "T12:00:00"), m0 = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }), m = m0[0].toUpperCase() + m0.slice(1);
      const cab = m !== mes ? `<h3 class="sim-mes">${m}</h3>` : "";
      mes = m;
      const dias = difDias(x.data, hoje);
      const quando = x.ch === hoje || x.data === hoje ? "hoje" : dias === 1 ? "ontem" : dias > 1 ? `há ${dias} dias` : dias === -1 ? "amanhã" : "";
      const sit = x.situacao === "corrigido" ? `<span class="sim-nota mini" style="--p:${x.cor.nota / (x.cor.total || 10)}"><b>${num(x.cor.nota)}</b></span>`
        : x.situacao === "enviado" ? `<span class="sim-sit enviado">Fotos enviadas</span>` : `<span class="sim-sit nao">Não feito</span>`;
      const fotos = x.env?.fotos ? `<button class="link" data-a="fotos" data-ch="${escapar(x.ch)}">Fotos (${x.env.fotos})</button>` : "";
      const acoes = x.situacao === "corrigido"
        ? `${fotos}<button class="link" data-a="ver" data-ch="${escapar(x.ch)}">Ver a correção</button><button class="link" data-a="imprimir" data-ch="${escapar(x.ch)}">PDF</button>`
        : `<button class="botao secundario" data-a="imprimir" data-ch="${escapar(x.ch)}">Imprimir</button><button class="botao" data-a="enviar" data-ch="${escapar(x.ch)}">${x.env ? "Mandar mais fotos" : "Enviar as fotos"}</button>`;
      return `${cab}<div class="sim-item ${x.situacao}${x.esp ? " esp" : ""}" data-ch="${escapar(x.ch)}">
        <span class="sim-dia"><b>${String(d.getDate()).padStart(2, "0")}</b><small>${DIAS_SEM[d.getDay()]}</small></span>
        <span class="sim-item-meio"><b>${x.esp ? `${ESTRELA}Especial · ${escapar(nomeProva(x.sim))}` : `${nomeFolha(x.sim)}${x.sim.numero ? ` nº ${x.sim.numero}` : " do dia"}`}${!x.esp && x.sim.dificuldade ? `<i class="sim-dif-tag ${escapar(x.sim.dificuldade)}">${NOME_DIF[x.sim.dificuldade] || ""}</i>` : ""}</b>
          <small>${ehCaderno(x.sim) ? partesTxt(x.sim) : `${x.sim.questoes.length} ${x.sim.questoes.length === 1 ? "questão" : "questões"}`} · ${x.sim.tempo || (x.esp ? 60 : 30)} min${quando ? ` · ${quando}` : ""}${x.esp ? "" : x.sim.questoes.some(q => q.disciplina) ? ` · ${escapar(disciplinas(x.sim))}` : ""}</small>
          ${x.situacao === "enviado" ? `<button class="link sim-item-env" data-a="fotos" data-ch="${escapar(x.ch)}">${fotosTxt(x.env)} · ver, girar, ordenar</button>` : ""}</span>
        ${sit}<div class="sim-item-bts">${acoes}</div></div>`;
    }).join("");
    caixa.querySelectorAll('[data-a="imprimir"]').forEach(b => (b.onclick = () => imprimir(b.dataset.ch, b)));
    caixa.querySelectorAll('[data-a="enviar"]').forEach(b => (b.onclick = () => escolherFotos(b.dataset.ch, b, recarregar)));
    caixa.querySelectorAll('[data-a="ver"]').forEach(b => (b.onclick = () => verCorrecao(b.dataset.ch, recarregar)));
    caixa.querySelectorAll('[data-a="fotos"]').forEach(b => (b.onclick = () => verFotos(b.dataset.ch, recarregar)));
  };
  const recarregar = async () => { lista = await listaSimulados(); if (tela.isConnected) pintar(); };
  await recarregar();
  tela.querySelector(".sim-fechar").onclick = () => { tela.classList.remove("aberto"); setTimeout(() => tela.remove(), 250); depois?.(); };
  // o repositório pode ter simulados que o Sincronizar ainda não trouxe (ou os de antes do limite antigo de 14 dias)
  if (temToken() && navigator.onLine) {
    const b = tela.querySelector(".sim-buscando"); b.hidden = false;
    try { if ((await baixarSimulados()) > 0) { await recarregar(); cartaoMapa().then(m => { const l = tela.querySelector(".cad-mapa"); if (m && l) l.replaceWith(m); }); } } catch (e) { console.warn("simulados:", e.message); }
    b.hidden = true;
  }
}

/** As fotos enviadas de um simulado: antes da correção dá para girar, excluir e mudar a ordem (simuladoFotos.js). */
async function verFotos(ch, depois) {
  await garantirCss();
  const corrigido = !!(await extra(`cor:${ch}`).catch(() => null));
  abrirFotos(ch, {
    titulo: `Fotos · ${await titulo(ch)}`, editavel: !corrigido, aoMudar: depois,
    aoAdicionar: (bt) => new Promise((ok) => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*,application/pdf"; inp.multiple = true;
      inp.onchange = () => (inp.files.length ? enviar(ch, [...inp.files], bt).then(ok) : ok());
      inp.click();
    }),
  });
}

async function historico() {
  const linhas = await correcoes();
  if (!linhas.length) { toast("Nenhuma correção ainda. A primeira chega na madrugada depois de você enviar as fotos."); return; }
  await garantirCss();
  let itens = "";
  for (const c of linhas) {
    const ch = chaveDe(c), esp = ehEsp(ch), s = esp ? await extra(`sim:${ch}`) : null;
    const sd = esp ? null : await extra(`sim:${ch}`);
    itens += `<button class="sim-cor${esp ? " esp" : ""}" data-ver="${escapar(ch)}"><span class="sim-nota" style="--p:${c.nota / (c.total || 10)}"><b>${num(c.nota)}</b></span><span><b>${esp ? "" : `${nomeFolha(sd)} · `}${dataBR(c.data)}${esp ? ` <i class="sim-tag-esp">Especial · ${escapar(nomeProva(s))}</i>` : ""}</b><small>${escapar(c.geral || "").slice(0, 90)}</small></span></button>`;
  }
  const tela = document.createElement("div"); tela.className = "sim-tela";
  tela.innerHTML = `<header class="sim-t-cab"><button class="sim-fechar" aria-label="Fechar">✕</button><b>Correções</b></header><div class="sim-t-rol">${itens}</div>`;
  document.body.append(tela);
  requestAnimationFrame(() => tela.classList.add("aberto"));
  const fechar = () => { tela.classList.remove("aberto"); setTimeout(() => tela.remove(), 250); };
  tela.querySelector(".sim-fechar").onclick = fechar;
  tela.querySelectorAll("[data-ver]").forEach(b => (b.onclick = () => { fechar(); verCorrecao(b.dataset.ver); }));
}

// ---------------------------------------------------------------- mapa de domínio dos temas (Caderno do Dia)
export const ETAPAS = [["resumo", "Resumo"], ["pratica", "Prática"], ["prova", "Prova"], ["firme", "Firme"]];
const NOME_ETAPA = Object.fromEntries(ETAPAS);
const TEND = { sobe: ["↗", "subindo"], desce: ["↘", "caindo"], igual: ["→", "estável"] };
/** O estado dos temas (simulados/caderno.json, do Sincronizar); só os ativos. */
export async function estadoTemas() {
  const e = await extra("caderno:estado").catch(() => null);
  if (!e?.temas) return null;
  const temas = Object.values(e.temas).filter(t => t && t.ativo !== false && NOME_ETAPA[t.etapa]);
  return temas.length ? { ...e, lista: temas } : null;
}
const pct = (x) => `${Math.round(x * 100)}%`;
/** A faixa com quantos temas há em cada etapa (larguras proporcionais). */
function barraEtapas(lista) {
  const n = Object.fromEntries(ETAPAS.map(([e]) => [e, lista.filter(t => t.etapa === e).length]));
  return `<div class="cad-barra" role="img" aria-label="${ETAPAS.map(([e, nome]) => `${n[e]} em ${nome}`).join(", ")}">${ETAPAS.filter(([e]) => n[e]).map(([e]) => `<span class="e-${e}" style="flex:${n[e]}"></span>`).join("")}</div>
    <div class="cad-legenda">${ETAPAS.map(([e, nome]) => `<span class="e-${e}"><i></i>${nome} <b>${n[e]}</b></span>`).join("")}</div>`;
}
/** Uma linha do mapa: a etapa, o tema, a última nota e a tendência. */
function linhaTema(t) {
  const u = t.ultima, td = TEND[t.tendencia];
  const nota = u ? `<span class="cad-nota${u.nota >= 0.7 ? " boa" : u.nota < 0.5 ? " ruim" : ""}" title="${u.etapa === "pratica" ? "Prática" : "Prova"} em ${dataBR(u.data)}">${pct(u.nota)}${td ? `<i class="cad-tend ${t.tendencia}" title="${td[1]}">${td[0]}</i>` : ""}</span>`
    : `<span class="cad-nota vazia">—</span>`;
  return `<div class="cad-tema e-${escapar(t.etapa)}" data-tema="${escapar(t.id)}"><span class="cad-et">${NOME_ETAPA[t.etapa]}</span>
    <span class="cad-tit"><b>${escapar(t.titulo)}</b><small>${escapar(t.disciplina || "")}${t.desde ? ` · desde ${dataBR(t.desde)}` : ""}</small></span>${nota}</div>`;
}
/** O cartão do mapa (no fim da aba Aulas e no alto de "Todos os cadernos"): a faixa das etapas e os temas que mexeram
 * por último; "Ver o mapa" abre todos. Sem o caderno.json (antes do 1º Sincronizar), nada. */
export async function cartaoMapa() {
  const e = await estadoTemas();
  if (!e) return null;
  await garantirCss();
  const el = document.createElement("div"); el.className = "sim-cartao cad-mapa";
  const ult = (t) => t.mudancas?.at?.(-1)?.data || t.ultima?.data || t.entrou || "";
  const mexeu = [...e.lista].sort((a, b) => ult(b).localeCompare(ult(a)) || a.titulo.localeCompare(b.titulo)).slice(0, 5);
  el.innerHTML = `<div class="sim-topo"><span class="sim-ico">${ICONE_MAPA}</span><div><b>Mapa dos temas</b><small>${e.lista.length} temas · Resumo → Prática → Prova → Firme</small></div></div>
    ${barraEtapas(e.lista)}<div class="cad-lista">${mexeu.map(linhaTema).join("")}</div>
    <button class="link cad-ver" data-a="mapa">Ver o mapa inteiro</button>`;
  el.querySelector('[data-a="mapa"]').onclick = () => abrirMapa();
  return el;
}
const CHAVE_FILTRO_MAPA = "orbita.caderno.filtro";
/** O mapa inteiro: filtro por etapa e os temas por disciplina. */
export async function abrirMapa() {
  const e = await estadoTemas();
  if (!e) { toast("O mapa chega no próximo Sincronizar."); return; }
  await garantirCss();
  const tela = document.createElement("div"); tela.className = "sim-tela cad-mapa-tela";
  tela.innerHTML = `<header class="sim-t-cab"><button class="sim-fechar" aria-label="Fechar">✕</button><b>Mapa dos temas</b></header>
    <div class="sim-t-rol">${barraEtapas(e.lista)}<p class="sim-t-aviso">Cada tema começa no Resumo, treina na Prática (como nas lições) e vai para a Prova quando acerta 70% ou mais; duas provas boas e ele fica Firme.${e.atualizado ? ` Atualizado em ${dataBR(e.atualizado)}.` : ""}</p>
    <div class="sim-filtros cad-filtros" role="tablist"></div><div class="cad-grupos"></div></div>`;
  document.body.append(tela);
  requestAnimationFrame(() => tela.classList.add("aberto"));
  let filtro = (() => { try { return localStorage.getItem(CHAVE_FILTRO_MAPA) || "todos"; } catch { return "todos"; } })();
  const pintar = () => {
    const opcoes = [["todos", "Todos"], ...ETAPAS];
    const cont = (f) => (f === "todos" ? e.lista.length : e.lista.filter(t => t.etapa === f).length);
    tela.querySelector(".cad-filtros").innerHTML = opcoes.map(([f, n]) => `<button role="tab" data-f="${f}" class="${f === filtro ? "on" : ""}" aria-selected="${f === filtro}"><span>${n}</span><small>${cont(f)}</small></button>`).join("");
    tela.querySelectorAll(".cad-filtros button").forEach(b => (b.onclick = () => { filtro = b.dataset.f; try { localStorage.setItem(CHAVE_FILTRO_MAPA, filtro); } catch { /* */ } pintar(); }));
    const l = filtro === "todos" ? e.lista : e.lista.filter(t => t.etapa === filtro);
    const ordem = Object.fromEntries(ETAPAS.map(([k], i) => [k, i]));
    const grupos = {};
    for (const t of l) (grupos[t.disciplina || "Outros"] ||= []).push(t);
    tela.querySelector(".cad-grupos").innerHTML = Object.entries(grupos).sort((a, b) => b[1].length - a[1].length).map(([d, ts]) =>
      `<h3 class="sim-mes">${escapar(d)} <small>${ts.length}</small></h3><div class="cad-lista">${ts.sort((a, b) => ordem[b.etapa] - ordem[a.etapa] || (a.ensinado || "").localeCompare(b.ensinado || "")).map(linhaTema).join("")}</div>`).join("")
      || `<p class="sim-vazio">Nenhum tema nesta etapa.</p>`;
  };
  pintar();
  tela.querySelector(".sim-fechar").onclick = () => { tela.classList.remove("aberto"); setTimeout(() => tela.remove(), 250); };
}

const ICONE_MAPA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICONE_LIVRO = `<svg viewBox="0 0 24 24" aria-hidden="true" class="cad-ico-livro"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICONE = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 15.5l1.5 1.5 3-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ESTRELA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor"/></svg>`;
