// OdontoScan: área do app para digitalizar as fichas da IC. Telas: Início (lote), Confirmar números,
// Leitura (pacote ou API), Revisar e Exportar. Tudo fica neste aparelho; nada entra na sincronização.
import { htmlBarraProjeto, ligarBarraProjeto } from "./barraProjeto.js";
import * as BD from "./banco.js";
import { ligarSeletores } from "./seletor.js";
import { clinicaPorExtenso, clinicaDaTabela, processarFoto, fecharNumeros, aplicarLeitura, procedimento, procDe, ctxProc, idadeNaData, montarRevisao, limparUmDigito, clinicaPIC, enderecoPIC, NOME_PIC, codigosVizinhos, definirFrequencias, codigosMaisUsados } from "./processar.js";
import { sugerirMunicipios, sugerirBairros, sugerirTexto, bairrosDaRua, aprenderSubBairros, contarUso, ehCascavel, distritoComoMunicipio } from "./previsao.js";
import { novaChave, VALIDADOR } from "./ids.js";
import { zip, lerZip, xlsx, csv, baixar } from "./arquivos.js";
import { PROMPT_FICHA, PROMPT_ENDERECO, LEIA_ME, perguntarApi } from "./leitura.js";
import { TABELAS } from "./tabelas.js";
import { ligarTeclado, dataIso, dataBr, horaValida } from "./teclado.js";
import { definirGithub, credenciais, salvarCredenciais, paraEnviar, buscarRespostas, REPO_PADRAO, completarFila, lerEstado, gravarMaximo, tamanhoDaFila, reduzir, tirarDaFila } from "./nuvem.js";
import { num, contarNumeros, moverIndicador, confete, carimbar } from "./efeitos.js";
import { dialogo } from "./dialogo.js";
import { ligarVisual, particulasDaArea } from "./visual.js";
import { iniciarAparenciaAvulsa, abrirAparenciaAvulsa } from "../aparenciaComum.js";
import { ligarLupa } from "./lupa.js";
import { abrirAjuste } from "./ajuste.js";
import { cartaoMapa, ligarMapa } from "./mapa.js";
import { VARIAVEIS, cruzar, quiQuadrado, tsv } from "./cruzadas.js";
import { registrar, diferencas, descrever, NOMES_CAMPOS } from "./historico.js";
import { gerarRelatorio, PROJETO } from "./relatorio.js";
import { definirEscala } from "./graficos.js";
import * as OF from "./oficial.js";
import { pacoteBI } from "./pacote.js";
import { completude as completudeDe, indicadores as indicadoresDe } from "./indicadores.js";
import { distancias } from "./geo.js";
import { coerencia, padroesEstranhos, repetidas, concordancia, textoConcordancia, wilson, textoTiposDeErro, CAMPOS_CONC, linhaDoTempo, resumoPacientes, DICIONARIO, revisaoDe } from "./analises.js";
import { dicaAgenda, combinaComAgenda } from "./agendaClinicas.js";
import { calcularMetas, aRevisar as aRevisarF, revisada as revisadaF } from "./metas.js";
import { gerarBackup, lerBackup, restaurar } from "./backup.js";
import * as BA from "./backupAuto.js";
import { montarResumo, publicarResumo, credResumo, salvarCredResumo, previsaoTermino, htmlPrevisao } from "./resumo.js";
import { gravarControleGithub, lerModo, modoLocal, definirModo, podeLocal, pastaTrabalho, situacaoPasta, lendoAgora, candidatasValidacao, recomecarLeitura, lerValidacao, lerExemplos, prepararExemplos, lidasNaoConferidas, lerDeNovo, prepararValidacao, resultadoValidacao, novaRodada, encerrarValidacao, apagarRodadas } from "./local.js";
import { CAIXAS, FAIXAS_NUMEROS, qualidadeAlinhamento, ALINHAMENTO_MINIMO, ALINHAMENTO_DUVIDOSO, CONFERENCIA, novoCanvas, W_AL, H_AL, alinharFoto, imagemInteira, topoJpeg } from "./visao.js";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = (blob) => { const u = URL.createObjectURL(blob); setTimeout(() => URL.revokeObjectURL(u), 120000); return u; };
const ETAPAS = { erro: "Não reconhecida", confirmar: "Números a conferir", pronta: "Pronta para leitura", lida: "Lida", revisada: "Revisada" };

let raiz, opts, teclado, aba = "inicio", parar = false;
let desligarLupa = () => {};
let importando = null; // { n, total, caminho, eta } enquanto uma importação roda (a tela pode ser trocada no meio)

async function chave() {
  let k = await BD.lerCfg("chave");
  if (!k) { k = await novaChave(); await BD.gravarCfg("chave", k); await BD.gravarCfg("chaveCriada", new Date().toISOString()); }
  return k;
}
function aviso(msg, ms = 2600) {
  const t = raiz.querySelector(".os-aviso");
  const tipo = /não |falh|erro|problema|desalinhad|descart/i.test(msg) ? "atencao" : /\b(salva|aprovada|conferid|processad|chegar|pront|enviad|restaurad|refeit)/i.test(msg) ? "ok" : "info";
  t.className = `os-aviso ${tipo}`; t.innerHTML = `<i aria-hidden="true">${{ ok: "✓", atencao: "!", info: "i" }[tipo]}</i><span></span>`;
  t.querySelector("span").textContent = msg; t.style.setProperty("--vida", `${ms}ms`); t.hidden = false;
  t.classList.remove("vivo"); void t.offsetWidth; t.classList.add("vivo");
  clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), ms);
}

/** Abre o OdontoScan dentro de `alvo` (no app: uma camada sobre tudo; no notebook: a página inteira). */
const PALETA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="7.8" r="1.1" fill="currentColor" stroke="none"/></svg>`;
export function abrirOdontoScan(alvo, o = {}) {
  opts = o; raiz = alvo;
  ligarSeletores();
  definirGithub(o.github);
  raiz.classList.add("os");
  raiz.innerHTML = `
    <header class="os-topo">
      ${o.aoTrocarArea ? `<button class="os-area" aria-label="Trocar de área"><span class="os-logo">${LOGO}</span><span><b>Iniciação Científica</b><small>Trocar de Área ▾</small></span></button>` : `<div class="os-area"><span class="os-logo">${LOGO}</span><span><b>OdontoScan</b><small>Fichas da IC, dados pessoais só neste computador</small></span></div>`}
      <span class="os-topo-dir"><button class="os-aparencia" aria-label="Aparência: tema, fundo e partículas" title="Aparência">${PALETA}</button><button class="os-busca" aria-label="Procurar ficha" title="Procurar ficha">${IC.busca}</button><span class="os-cadeado" title="Os dados ficam só neste aparelho">${CADEADO}<small>Local</small></span></span>
    </header>
    ${htmlBarraProjeto(o.projeto)}
    <main class="os-tela"></main>
    <nav class="os-abas"><i class="os-abas-ind" aria-hidden="true"></i>${ABAS.map(id => [id, ...NOMES_ABAS()[id]])
      .map(([id, n, ic]) => `<button data-aba="${id}">${ic}<span>${n}</span><i class="os-badge" hidden></i></button>`).join("")}</nav>
    <div class="os-aviso" hidden></div>`;
  // Aparência (02/11/2026): no app, a do Órbita (aparencia.js, pelo evento); no OdontoScan.html, a mesma folha, com a
  // escolha guardada neste navegador (aparenciaComum.js)
  const avulso = !o.aoTrocarArea, ap = { chave: "orbita.aparencia", particulas: false, aoAplicar: particulasDaArea };
  if (avulso) iniciarAparenciaAvulsa(raiz, ap);
  ligarVisual(raiz);
  raiz.querySelector(".os-aparencia").onclick = () => (avulso ? abrirAparenciaAvulsa(raiz, ap) : document.dispatchEvent(new CustomEvent("orbita:abrir-aparencia")));
  teclado = ligarTeclado(raiz, raiz.querySelector(".os-tela"));
  raiz.querySelector("button.os-area")?.addEventListener("click", () => o.aoTrocarArea());
  ligarBarraProjeto(raiz, o.aoProjetos);
  raiz.querySelector(".os-busca").onclick = () => abrirBusca();
  ligarDeslize();
  raiz.querySelector(".os-tela").addEventListener("click", (e) => {
    if (e.target.closest('[data-acao="meta"]')) escolherMeta();
    const sr = e.target.closest("[data-subres]");
    if (sr && sr.dataset.subres !== subRes) ir(sr.dataset.subres === "planilha" ? "exportar" : "painel");
  });
  raiz.querySelectorAll(".os-abas button").forEach(b => (b.onclick = () => ir(b.dataset.aba)));
  addEventListener("resize", () => moverIndicador(raiz.querySelector(".os-abas")));
  BD.todasFichas().then(aprenderSubBairros).catch(() => {});
  ir(aba).then(() => conferirAntigas()).then(() => corrigirDistritos()).then(() => padronizarClinicas()).then(() => esquecerEquipe()).then(() => buscarAuto(true));
}

/** Os nomes do aluno e do professor não são mais lidos (22/10/2026): apaga das fichas antigas o recorte da equipe
 *  (que ainda não tinha subido) e os códigos de nome que vieram da leitura. Uma vez só por ficha. */
async function esquecerEquipe() {
  const imgs = await BD.chavesDeImagens();
  for (const f0 of await BD.todasComLixeira()) {
    if (!imgs.has(`${f0.id}|equipe`) && !f0.leitura?.equipe) continue;
    const f = await BD.pegarFicha(f0.id);
    if (!f) continue;
    if (f.leitura) delete f.leitura.equipe;
    f.imgEquipe = null; // null apaga a imagem
    await BD.salvarFicha(f);
  }
}

/** Fichas já revisadas com um distrito de Cascavel no campo Município (ex.: Juvinópolis): viram Cascavel + distrito no bairro. */
async function corrigirDistritos() {
  let n = 0;
  for (const f0 of await BD.todasFichas()) {
    const d = f0.revisao && distritoComoMunicipio(f0.revisao.municipio);
    if (!d) continue;
    const f = await BD.pegarFicha(f0.id);
    if (!f?.revisao) continue;
    const antes = f.revisao.municipio;
    f.revisao = { ...f.revisao, municipio: "Cascavel", bairro: d };
    registrar(f, `Município corrigido: ${antes} é distrito de Cascavel`, { campos: ["municipio", "bairro"] });
    await BD.salvarFicha(f); n++;
  }
  if (n) { aviso(`${n} ${n === 1 ? "ficha tinha" : "fichas tinham"} um distrito de Cascavel no Município (como Juvinópolis): agora é Cascavel, com o distrito no bairro.`, 6000); atualizarBadges(); }
}

// variações da mesma clínica ou professor que passaram na revisão (ex.: Mauro, Mercio → Márcio; Endo Monit. → Monitoria de Endodontia)
async function padronizarClinicas() {
  let n = 0;
  for (const f0 of await BD.todasFichas()) {
    const c0 = f0.revisao?.clinica, c = c0 && c0 !== NOME_PIC && clinicaDaTabela(c0);
    if (!c || c === c0) continue;
    const f = await BD.pegarFicha(f0.id);
    if (!f?.revisao) continue;
    f.revisao = { ...f.revisao, clinica: c };
    registrar(f, `Clínica padronizada: ${c0} → ${c}`, { campos: ["clinica"] });
    await BD.salvarFicha(f); n++;
  }
  if (n) { aviso(`${n} ${n === 1 ? "ficha tinha" : "fichas tinham"} a clínica escrita de outro jeito (como Mauro ou Julio): agora estão com o nome padrão.`, 6000); atualizarBadges(); }
}

// respostas da leitura automática: busca ao abrir e ao trocar de tela (no máximo a cada 2 minutos)
let ultimaBusca = 0, buscando = false;
async function buscarAuto(forcar = false) {
  if (buscando || (!forcar && Date.now() - ultimaBusca < 120000)) return;
  const local = await modoLocal(); // leitura local: a pasta de trabalho, sem rede
  if (!local && (!navigator.onLine || !(await credenciais()))) return;
  buscando = true; ultimaBusca = Date.now();
  try {
    // a conferência ao abrir grava fichas; esperar por ela evita gravar uma cópia antiga por cima da leitura recém-chegada
    for (let i = 0; conferindo && i < 600; i++) await new Promise(ok => setTimeout(ok, 500));
    const k = await chave();
    const { novas, desalinhadas, semFicha } = await buscarRespostas(async (f, resp) => BD.salvarFicha(await aplicarLeitura(f, resp, k)));
    if (semFicha) aviso(`${semFicha} ${semFicha === 1 ? "leitura chegou de uma ficha que não está mais" : "leituras chegaram de fichas que não estão mais"} neste aparelho (apagadas ou processadas de novo, com outro código) e ${semFicha === 1 ? "foi descartada" : "foram descartadas"}. As fichas de agora sobem de novo para a fila.`, 8000);
    if (desalinhadas) aviso(`${desalinhadas} ${desalinhadas === 1 ? "ficha voltou" : "fichas voltaram"} da leitura porque o quadro não estava alinhado: toque em Continuar no Lote para processar de novo.`, 6000);
    if (novas) { aviso(`${novas} ${novas === 1 ? "ficha lida chegou" : "fichas lidas chegaram"} da leitura automática.`, 4000); if (["inicio", "ia"].includes(aba) || (aba === "conferir" && !raiz.querySelector(".os-rev"))) ir(aba); else atualizarBadges(); }
    // e completa a fila com as que esperam no aparelho (aos poucos, sem travar a tela)
    if ((await BD.lerCfg("autoEnviar")) !== false) completarFila().then(r => { if (r) opts.aoFila?.(r.naFila, r); if (r?.enviadas) { atualizarBadges(); if (aba === "ia") ir("ia"); } }).catch(e => console.warn("OdontoScan: envio", e.message));
  } catch (e) { console.warn("OdontoScan: busca de respostas", e); }
  finally { buscando = false; }
}

// Fichas processadas com uma conferência de alinhamento mais antiga (até a v0.1.41, só as linhas do quadro, que
// deixava passar foto cortada): confere a cópia guardada com o modelo da ficha. As desalinhadas saem do aparelho e
// da fila, para serem processadas de novo; as duvidosas esperam você conferir a cópia no Lote.
let conferindo = false;
async function conferirAntigas() {
  if (conferindo || importando) return;
  conferindo = true;
  try { await limparLixeiraVelha(); await conferir(); } finally { conferindo = false; }
}
const ERRO_DO_APP = /^Problema ao processar: .*(Cannot (set|read) propert|is not a function|is not defined|of (null|undefined)|is null|is undefined)/i;
/** Fichas que vieram das imagens da pasta de trabalho (cópias, endereços e números gravados pelo próprio app para a IA):
 *  saem do aparelho e da fila. */
async function limparArquivosDeTrabalho() {
  const ruins = (await BD.todasComLixeira()).filter(f => ehArquivoDeTrabalho(f.arquivo));
  if (!ruins.length) return;
  const pacotes = ruins.filter(f => f.enviada && f.pacote).map(f => f.pacote);
  for (const f of ruins) await BD.apagarFicha(f.id);
  if (pacotes.length) { try { await tirarDaFila(pacotes); } catch (e) { console.warn("OdontoScan: tirar da fila", e.message); } }
  aviso(`${fmt(ruins.length)} ${ruins.length === 1 ? "imagem da pasta de trabalho da IA tinha entrado" : "imagens da pasta de trabalho da IA tinham entrado"} como ficha (cópias e recortes que o próprio app grava para a leitura) e ${ruins.length === 1 ? "saiu" : "saíram"}. As fichas de verdade continuam como estavam.`, 9000);
  atualizarBadges(); if (aba === "inicio") ir("inicio");
}
/** O backup automático da semana, se já estiver na hora e o navegador deixar gravar na pasta (backupAuto.js). */
async function backupDaSemana() {
  if (opts.pasta) return;
  try {
    const r = await BA.talvezFazer();
    if (r?.ok) { aviso(`Backup da semana gravado: ${fmt(r.fichas)} fichas (${r.nome}).`, 6000); if (aba === "inicio") ir("inicio"); }
  } catch (e) { console.warn("OdontoScan: backup da semana", e.message); }
}
async function conferir() {
  await limparArquivosDeTrabalho();
  // no computador do laboratório, pede ao navegador para nunca apagar sozinho o banco das fichas (sem isso, o Edge
  // pode limpar o IndexedDB quando o disco enche); não pergunta nada ao usuário num arquivo local
  try { if (await modoLocal()) navigator.storage?.persist?.().catch(() => {}); } catch { /* navegador antigo */ }
  backupDaSemana();
  const todas = await BD.todasFichas();
  // "Não reconhecidas" por versões antigas (antes da ficha em preto e da conferência pelo modelo): saem da lista
  // para serem processadas de novo pelo "Continuar" (a foto continua na pasta; aqui só havia o registro do erro)
  // e as que falharam por um erro do próprio app (mensagem de erro de programa, não de foto ruim)
  const errosAntigos = todas.filter(f => f.etapa === "erro" && ((f.conferencia || 0) < CONFERENCIA || ERRO_DO_APP.test(f.erro || "")));
  for (const f of errosAntigos) await BD.apagarFicha(f.id);
  if (errosAntigos.length) {
    const pasta = await BD.lerCfg("pasta");
    aviso(`${errosAntigos.length} ${errosAntigos.length === 1 ? "ficha não reconhecida (por uma versão antiga ou por um erro do app) voltou" : "fichas não reconhecidas (por versões antigas ou por um erro do app) voltaram"} para ser processadas de novo: ${pasta ? "no Lote, toque em Continuar" : "adicione as fotos de novo no Lote"}.`, 9000);
    atualizarBadges(); if (aba === "inicio") ir("inicio");
  }
  // prontuário/RA com um dígito só nas fichas esperando a confirmação dos números: vira vazio; se o resto já tinha
  // sido conferido sozinho, a ficha sai da fila de Números
  const umDigito = todas.filter(f => f.etapa === "confirmar" && f.sugestoes && limparUmDigito(f));
  if (umDigito.length) {
    const k = await chave(); let fechadas = 0;
    for (const f0 of umDigito) {
      const f = await BD.pegarFicha(f0.id); // a cópia atual (pode ter chegado leitura enquanto conferia)
      if (!f || f.etapa !== "confirmar" || !f.sugestoes) continue;
      limparUmDigito(f);
      if (Object.values(f.sugestoes).every(x => x.auto)) { await fecharNumeros(f, Object.fromEntries(Object.entries(f.sugestoes).map(([c, x]) => [c, x.texto])), k, true); f.numerosAuto = true; fechadas++; }
      await BD.salvarFicha(f);
    }
    aviso(`Prontuário ou RA com um dígito só ficou vazio em ${umDigito.length} ${umDigito.length === 1 ? "ficha" : "fichas"}${fechadas ? `; ${fechadas} já não precisam mais de conferência` : ""}.`, 6000);
    atualizarBadges();
  }
  const antigas = todas.filter(f => (f.conferencia || 0) < CONFERENCIA && !f.alinhamentoAprovado && f.etapa !== "erro" && f.imgs?.ficha);
  if (!antigas.length) return;
  if (errosAntigos.length) await new Promise(ok => setTimeout(ok, 9000)); // deixa ler o aviso acima
  let ruins = 0, duvidosas = 0, feitas = 0;
  const tirar = [];
  try {
    for (const [i, f0] of antigas.entries()) {
      if (importando) break; // a importação tem prioridade; continua na próxima vez que abrir o Scanner
      feitas++;
      if (i % 20 === 0) aviso(`Conferindo o alinhamento das fichas já processadas: ${i} de ${antigas.length}…`, 4000);
      if (f0.etapa === "revisada" || f0.leitura) { f0.conferencia = CONFERENCIA; await BD.salvarFicha(f0); continue; } // já lida: nada mais a proteger
      const f = await BD.comImagens({ ...f0 }, ["ficha"]);
      let q = 1;
      try {
        const bmp = await createImageBitmap(f.imgFicha), c = novoCanvas(W_AL, H_AL), cx = c.getContext("2d", { willReadFrequently: true });
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, W_AL, H_AL); cx.drawImage(bmp, 0, 0, W_AL, H_AL); bmp.close?.();
        const img = cx.getImageData(0, 0, W_AL, H_AL);
        q = Math.max(qualidadeAlinhamento(img, "azul"), qualidadeAlinhamento(img, "preto"));
      } catch { /* imagem ilegível: trata como desalinhada */ q = 0; }
      if (q >= ALINHAMENTO_DUVIDOSO) {
        f0.conferencia = CONFERENCIA; f0.alinhamento = q; f0.alinhamentoConferido = true;
        if (q < ALINHAMENTO_MINIMO) {
          // duvidosa: sai da fila até você aprovar a cópia (depois volta, marcada como aprovada)
          f0.alinhamentoPendente = true; duvidosas++;
          if (f0.enviada) { tirar.push(f0.pacote); f0.enviada = false; }
        }
        await BD.salvarFicha(f0); continue;
      }
      if (f0.enviada) tirar.push(f0.pacote);
      await BD.apagarFicha(f0.id); ruins++;
    }
  } finally {
    if (tirar.length) { try { await tirarDaFila(tirar); } catch (e) { console.warn("OdontoScan: tirar da fila", e.message); } }
  }
  const partes = [];
  if (ruins) partes.push(`${ruins} ${ruins === 1 ? "ficha estava desalinhada e foi tirada" : "fichas estavam desalinhadas e foram tiradas"} do aparelho e da fila (no Lote, toque em Continuar para processá-las de novo)`);
  if (duvidosas) partes.push(`${duvidosas} ${duvidosas === 1 ? "ficha ficou" : "fichas ficaram"} com alinhamento duvidoso: confira a cópia no Lote`);
  if (feitas < antigas.length) partes.push(`a conferência das fichas já processadas parou em ${feitas} de ${antigas.length} por causa da importação e continua na próxima vez que você abrir o Scanner`);
  const msg = partes.join("; ");
  if (msg || !importando) aviso(msg ? msg[0].toUpperCase() + msg.slice(1) + "." : `Alinhamento conferido: as ${antigas.length} fichas estão certas.`, 8000);
  atualizarBadges(); if (aba === "inicio") ir("inicio");
}

// As 4 abas (29/10/2026, pedido do Alediov): Lote · Conferir (antes Números e Revisar) · Resultados (Painel e
// Planilha) · IA (antes Leitura). Os nomes antigos continuam valendo em ir() e levam à aba nova.
const ABAS = ["inicio", "conferir", "resultados", "ia"];
const NOMES_ABAS = () => ({ inicio: ["Lote", IC.lote], conferir: ["Conferir", IC.rev], resultados: ["Resultados", IC.painel], ia: ["IA", IC.ia] });
const ALIAS = { confirmar: "conferir", revisar: "conferir", leitura: "ia", exportar: "resultados", painel: "resultados" };
let subRes = (() => { try { return localStorage.getItem("os.subRes") === "planilha" ? "planilha" : "painel"; } catch { return "painel"; } })();
const noPainel = () => aba === "resultados" && subRes === "painel";
/** Painel | Planilha, no alto da aba Resultados. */
const segRes = () => `<div class="os-seg" role="tablist">${[["painel", "Painel", IC.painel], ["planilha", "Planilha e relatório", IC.exp]].map(([id, n, ic]) => `<button role="tab" data-subres="${id}" class="${subRes === id ? "on" : ""}" aria-selected="${subRes === id}">${ic}<span>${n}</span></button>`).join("")}</div>`;
async function telaResultados(t) { return subRes === "planilha" ? telaExportar(t) : telaPainel(t); }
async function ir(nova, lado = 0) {
  if (nova === "exportar" || nova === "painel") { subRes = nova === "exportar" ? "planilha" : "painel"; try { localStorage.setItem("os.subRes", subRes); } catch { /* sem armazenamento */ } }
  if (nova === "confirmar") modoConf = "numeros"; else if (nova === "conferir" || nova === "revisar") modoConf = "fichas";
  aba = ALIAS[nova] || nova;
  desligarLupa(); desligarLupa = () => {};
  raiz.querySelector(".os-tela").onkeydown = null;
  teclado.configurar();
  raiz.querySelectorAll(".os-abas button").forEach(b => b.classList.toggle("on", b.dataset.aba === aba));
  moverIndicador(raiz.querySelector(".os-abas"));
  const t = raiz.querySelector(".os-tela"); t.scrollTop = 0;
  await ({ inicio: telaInicio, conferir: telaConferir, resultados: telaResultados, ia: telaLeitura }[aba])(t);
  t.classList.remove("entra"); void t.offsetWidth; t.classList.add("entra");
  // vindo de um deslize: a aba nova entra pelo lado de onde o dedo veio
  if (lado && !reduzirMov()) t.animate([{ transform: `translateX(${lado * innerWidth * 0.45}px)`, opacity: 0.2 }, { transform: "none", opacity: 1 }], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
  contarNumeros(t);
  atualizarBadges();
  buscarAuto();
}
async function atualizarBadges() {
  const fs = await BD.todasFichas(), n = (e) => fs.filter(f => f.etapa === e).length;
  const B = { inicio: fs.filter(f => f.alinhamentoPendente && f.etapa !== "erro").length, conferir: fs.filter(aConferirF).length, ia: ((await modoLocal()) ? (await situacaoPasta()).estado === "ok" : await credenciais()) ? 0 : paraEnviar(fs).length };
  raiz.querySelectorAll(".os-abas button").forEach(b => {
    const v = B[b.dataset.aba], i = b.querySelector(".os-badge");
    const novo = v > 99 ? "99+" : String(v || "");
    if (novo && novo !== i.textContent) { i.classList.remove("pula"); void i.offsetWidth; i.classList.add("pula"); }
    i.hidden = !v; i.textContent = novo;
  });
  resumoParaWidget(fs).catch(() => {});
  agendarResumo();
  backupDaSemana(); // no máximo uma tentativa por hora (backupAuto.talvezFazer)
}

// widgets da tela inicial (Android): só contagens, nada de paciente
async function resumoParaWidget(fs) {
  if (!opts.aoResumo) return;
  const m = await metaDoDia(fs), n = (e) => fs.filter(f => f.etapa === e).length;
  opts.aoResumo({ dia: m.hoje, metaRev: m.rev.meta, feitasRev: m.rev.feitas, metaNum: m.num.meta, feitasNum: m.num.feitas, seq: m.seq, cumpriu: m.cumpriu, ativo: m.ativo,
    paraRevisar: fs.filter(aRevisarF).length, naFila: fs.filter(f => f.enviada && !f.leitura && f.etapa !== "confirmar").length, confirmar: n("confirmar"), revisadas: fs.filter(revisadaF).length, total: fs.length, erro: n("erro") });
}

// ---------------- Lote ----------------
async function telaInicio(t) {
  const fs = await BD.todasFichas();
  // cada ficha numa etapa só, igual ao Painel: quem espera a confirmação dos números conta só em "Confirmar números"
  const n = (e) => e === "enviar" ? paraEnviar(fs).filter(f => f.etapa !== "confirmar").length : e === "fila" ? fs.filter(f => f.enviada && !f.leitura && f.etapa !== "confirmar").length : e === "lida" ? fs.filter(aRevisarF).length : fs.filter(f => f.etapa === e).length;
  const total = fs.length, feitas = n("revisada");
  const pastaSalva = (await BD.lerCfg("pasta")) || null;
  const ultimoBackup = await BD.lerCfg("ultimoBackup"), diasBackup = ultimoBackup ? Math.floor((Date.now() - new Date(ultimoBackup)) / 864e5) : null;
  const sBA = opts.pasta ? { ligado: false, possivel: false } : await BA.situacao();
  const semRecIds = new Set((await fichasSemRecorte()).map(f => f.id));
  const semCopia = fs.filter(f => (f.semCopia || semRecIds.has(f.id)) && f.etapa !== "erro").length;
  const reps = repetidas(fs, ligarPacientes(fs));
  const lixo = (await BD.fichasNaLixeira()).sort((a, b) => b.lixeira.localeCompare(a.lixeira));
  const duvidosas = fs.filter(f => f.alinhamentoPendente && f.etapa !== "erro");
  const duv = duvidosas.length ? await BD.comImagens({ ...duvidosas[0] }, ["ficha"]) : null;
  const temPasta = !!opts.pasta || "showDirectoryPicker" in window;
  t.innerHTML = `
    <section class="os-cartao os-hero">
      <div class="os-anel" style="--p:${total ? feitas / total : 0}">${num(feitas, "lote-revisadas")}<small>de ${fmt(total)}</small></div>
      <div><h2>Fichas conferidas</h2>${total ? `<span class="os-cab-dir"><span class="os-pct">${pct(feitas, total)}% concluído</span>${await (async () => { const m = await metaDoDia(fs); return m.ativo || m.num.feitas || m.rev.feitas ? `<span class="os-metas">${chipMeta(m, "num")}${chipMeta(m, "rev")}</span>` : ""; })()}</span>` : ""}<p>Cada foto é endireitada, os números de identificação são lidos aqui e viram códigos, e só uma cópia sem identificação vai para a leitura.</p></div>
    </section>
    <div class="os-funil">
      ${[["confirmar", "Números a conferir", "🔢", "var(--os-aviso)"], ["enviar", "Aguardando envio", "📤", "#8A94A6"], ["fila", "Na fila da madrugada", "🌙", "var(--os-azul)"], ["lida", "A conferir", "📝", "#9B6BDF"], ["revisada", "Revisadas", "✅", "var(--os-ok)"], ["erro", "Não reconhecidas", "⚠️", "var(--os-erro)"]]
        .map(([e, nome, ic, cor], k) => `<button class="os-etapa ${n(e) ? "" : "zero"}" data-e="${e}" style="--k:${k};--cor:${cor}"><span class="os-etapa-ic">${ic}</span>${num(n(e), `lote-${e}`)}<small>${nome}</small><i class="os-etapa-parte" style="--w:${total ? Math.max(n(e) ? 3 : 0, (n(e) / total) * 100) : 0}%"></i></button>`).join("")}
    </div>
    <section class="os-cartao os-importar">
      <h3>Adicionar fotos</h3>
      <p class="os-sub">Para muitas fichas, escolha a <b>pasta</b> onde estão as fotos (as subpastas, como as dos meses, entram junto): o app lê uma foto por vez, guarda o caminho de cada uma e, se parar, continua de onde estava. As fotos originais não são copiadas: cada uma é lida, processada e descartada.</p>
      ${pastaSalva ? `<div class="os-pasta-salva">${IC.pasta}<span><b>${esc(pastaSalva.nome)}</b><small>${pastaSalva.total ? `${pastaSalva.total} fotos na última leitura da pasta` : "pasta escolhida"}</small></span><button class="os-botao" data-acao="continuar">Continuar</button></div>` : ""}
      <div class="os-botoes">
        ${temPasta ? `<button class="os-botao ${pastaSalva ? "sec" : ""}" data-acao="pasta">${IC.pasta}<span>${pastaSalva ? "Escolher outra pasta" : "Escolher pasta"}</span></button>`
        : `<label class="os-botao">${IC.pasta}<span>Escolher pasta</span><input type="file" accept="image/*" multiple webkitdirectory hidden class="in-pasta"></label>`}
        <label class="os-botao sec">${IC.lote}<span>Algumas fotos</span><input type="file" accept="image/*" multiple hidden class="in-fotos"></label>
      </div>
      <div class="os-progresso os-prog-lote" ${importando ? "" : "hidden"}>${SCANNER}<div class="os-barra"><i style="width:${importando ? (importando.n / importando.total) * 100 : 0}%"></i></div><div class="os-prog-linha"><b class="os-prog-n">${importando ? `${importando.n} de ${importando.total}` : ""}</b><span class="os-prog-eta">${importando?.eta || ""}</span></div><ol class="os-fases">${FASES.map(([, nome]) => `<li>${nome}</li>`).join("")}</ol><p>${esc(importando?.caminho || "")}</p><button class="os-link os-parar">Parar</button></div>
    </section>
    ${duv ? `<section class="os-cartao os-duvidosa">
      <div class="os-cab"><h3>Alinhamento duvidoso</h3><span class="os-pilula">${duvidosas.length} para conferir</span></div>
      <p class="os-sub">O quadro desta ficha só bateu ${Math.round((duv.alinhamento || 0) * 100)}% com o modelo (foto cortada, apagada ou com rabiscos nas bordas). Abaixo está a <b>cópia que iria para a leitura</b>: se aparecer nome, CPF, CNS, assinatura ou endereço, descarte. Se só aparecem o cabeçalho, a faixa do DN, a idade, o município e os procedimentos, pode ler.</p>
      <figure class="os-copia os-copia-duv"><img src="${url(duv.imgFicha)}" alt="Cópia que iria para a leitura"><figcaption>${esc(duv.arquivo)}</figcaption></figure>
      <div class="os-botoes"><button class="os-botao" data-acao="aprovar">Está certa, pode ler</button><button class="os-botao sec" data-acao="descartar">Descartar</button></div>
    </section>` : ""}
    ${n("erro") ? `<section class="os-cartao"><div class="os-cab"><h3>Não reconhecidas</h3><span class="os-pilula">${n("erro")}</span></div>${pastaSalva && fs.some(f => f.etapa === "erro" && !f.descartada) ? `<div class="os-botoes"><button class="os-botao sec" data-acao="refazer-erros">Tentar todas de novo</button></div>` : ""}<ul class="os-lista">${fs.filter(f => f.etapa === "erro").slice(0, 40).map(f => `<li><span>${esc(f.arquivo)}<small>${esc(f.erro)}</small></span><span class="os-acoes-li"><button class="os-link" data-ajustar="${f.id}">Ajustar</button><button class="os-link perigo-suave" data-apagar="${f.id}">Remover</button></span></li>`).join("")}${n("erro") > 40 ? `<li><span><small>e mais ${n("erro") - 40}</small></span></li>` : ""}</ul><p class="os-sub">Estas ficaram de fora porque a ficha não bateu com o modelo (cortada, muito torta ou apagada) e uma cópia mal recortada poderia levar dados pessoais para a leitura. Em <b>Ajustar</b>, você arrasta os 4 cantos do quadro sobre a foto e o app endireita a partir deles (a conferência pelo modelo continua valendo). Se a ficha estiver cortada de verdade, toque em Remover.</p></section>` : ""}
    ${reps.length ? `<section class="os-cartao os-repetidas">
      <div class="os-cab"><h3>${IC.copia} Possíveis repetidas</h3><span class="os-pilula">${reps.length} ${reps.length === 1 ? "grupo" : "grupos"}</span></div>
      <p class="os-sub">Mesmo paciente, mesma data e mesmos procedimentos: pode ser a mesma ficha digitalizada duas vezes. Apague a que sobra, ou marque que não são repetidas.</p>
      ${reps.slice(0, 5).map((g, i) => `<div class="os-rep" style="--k:${i}"><ul class="os-lista">${g.map(f => `<li>${mini(f.id)}<span>${esc(f.arquivo)}<small>${ETAPAS[f.etapa]}</small></span><button class="os-link perigo-suave" data-apagar-rep="${f.id}">Apagar esta</button></li>`).join("")}</ul><button class="os-link" data-nao-rep="${g.map(f => f.id).join(",")}">Não são repetidas</button></div>`).join("")}
      ${reps.length > 5 ? `<p class="os-sub">e mais ${reps.length - 5} ${reps.length - 5 === 1 ? "grupo" : "grupos"}.</p>` : ""}
    </section>` : ""}
    ${lixo.length ? `<section class="os-cartao os-lixeira">
      <div class="os-cab"><h3>${IC.lixo} Lixeira</h3><span class="os-pilula">${fmt(lixo.length)}</span></div>
      <p class="os-sub">Fichas apagadas ficam aqui por 30 dias, com tudo (códigos, leitura e revisão), e depois somem de vez.</p>
      <ul class="os-lista">${lixo.slice(0, 15).map(f => { const d = Math.floor((Date.now() - new Date(f.lixeira)) / 864e5); return `<li><span>${esc(f.arquivo)}<small>${ETAPAS[f.etapa] || f.etapa} · apagada ${d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`} · some em ${Math.max(0, 30 - d)} ${30 - d === 1 ? "dia" : "dias"}</small></span><span class="os-acoes-li"><button class="os-link" data-restaurar="${f.id}">Restaurar</button><button class="os-link perigo-suave" data-apagar-vez="${f.id}">Apagar de vez</button></span></li>`; }).join("")}${lixo.length > 15 ? `<li><span><small>e mais ${fmt(lixo.length - 15)}</small></span></li>` : ""}</ul>
      <div class="os-botoes"><button class="os-botao sec" data-acao="restaurar-tudo">Restaurar todas</button><button class="os-botao sec" data-acao="esvaziar">Esvaziar lixeira</button></div>
    </section>` : ""}
    <section class="os-cartao os-chave">
      <div class="os-cab"><h3>${CADEADO} Chave e backup</h3>${ultimoBackup ? `<span class="os-pilula ${diasBackup > 7 && feitas ? "alerta" : ""}">backup ${diasBackup === 0 ? "hoje" : diasBackup === 1 ? "ontem" : `há ${diasBackup} dias`}</span>` : total ? `<span class="os-pilula alerta">sem backup</span>` : ""}</div>
      <p class="os-sub">As fichas (com os números já em código, as leituras e as suas revisões) e a chave dos códigos existem <b>só neste aparelho</b>. O backup junta tudo num arquivo protegido por senha, para guardar no notebook ou num pendrive. As fotos e as cópias não vão no backup: se precisar, elas se refazem a partir da pasta das fotos.</p>
      ${semCopia ? `<div class="os-pasta-salva">${IC.pasta}<span><b>${fmt(semCopia)} ${semCopia === 1 ? "ficha sem cópia ou sem recortes no aparelho" : "fichas sem cópia ou sem recortes no aparelho"}</b><small>Refaça a partir da pasta das fotos para ler, revisar ou conferir os números</small></span><button class="os-botao" data-acao="refazer-copias">Refazer</button></div>` : ""}
      ${htmlBackupAuto(sBA, total)}
      <div class="os-botoes"><button class="os-botao" data-acao="backup">Fazer backup</button><label class="os-botao sec">Restaurar backup<input type="file" accept=".oscb,application/octet-stream" hidden class="in-backup"></label></div>
      <div class="os-botoes"><button class="os-botao sec" data-acao="exp-chave">Salvar só a chave</button><label class="os-botao sec">Usar outra chave<input type="file" accept=".txt" hidden class="in-chave"></label></div>
      <button class="os-link perigo" data-acao="apagar-tudo">Apagar todas as fichas deste aparelho</button>
    </section>`;
  t.querySelectorAll(".os-etapa").forEach(b => (b.onclick = () => ir({ confirmar: "conferir", enviar: "leitura", fila: "leitura", lida: "revisar", revisada: "exportar", erro: "inicio" }[b.dataset.e])));
  t.querySelector(".in-fotos").onchange = (e) => processarLote([...e.target.files], t);
  t.querySelector(".in-pasta")?.addEventListener("change", (e) => processarLote([...e.target.files].filter(f => /\.(jpe?g|png|webp)$/i.test(f.name)), t));
  if (importando) { t.querySelectorAll(".os-importar .os-botao, .os-importar input").forEach(b => (b.disabled = true)); t.querySelector(".os-parar").onclick = pedirParada; }
  t.querySelector('[data-acao="pasta"]')?.addEventListener("click", () => importarPasta(t, true));
  t.querySelector('[data-acao="aprovar"]')?.addEventListener("click", async () => {
    const f = await BD.pegarFicha(duv.id); f.alinhamentoPendente = false; f.alinhamentoAprovado = true; f.alinhamentoConferido = true;
    registrar(f, "Alinhamento duvidoso aprovado (cópia conferida)");
    await BD.salvarFicha(f); aviso("Aprovada: vai para a leitura."); ir("inicio");
  });
  t.querySelector('[data-acao="descartar"]')?.addEventListener("click", async () => {
    const f = await BD.pegarFicha(duv.id);
    await BD.apagarFicha(f.id);
    await BD.salvarFicha({ id: f.id, arquivo: f.arquivo, tamanho: f.tamanho, criado: f.criado, pacote: "", etapa: "erro", erro: "Descartada na conferência do alinhamento (a cópia mostrava dados pessoais ou estava torta).", conferencia: CONFERENCIA, descartada: true });
    aviso("Descartada."); ir("inicio");
  });
  t.querySelector(".os-copia-duv img")?.addEventListener("click", (e) => e.currentTarget.closest(".os-copia").classList.toggle("zoom"));
  t.querySelector('[data-acao="continuar"]')?.addEventListener("click", () => importarPasta(t, false));
  t.querySelector('[data-acao="refazer-erros"]')?.addEventListener("click", async () => {
    if (importando) return;
    // tira os registros de erro (menos as descartadas por você) e processa de novo o que falta na pasta
    for (const f of fs.filter(f => f.etapa === "erro" && !f.descartada)) await BD.apagarFicha(f.id);
    await ir("inicio");
    importarPasta(raiz.querySelector(".os-tela"), false);
  });
  t.querySelectorAll("[data-apagar]").forEach(b => (b.onclick = async () => { await BD.apagarFicha(b.dataset.apagar); ir("inicio"); }));
  if (reps.length) carregarMinis(t.querySelector(".os-repetidas"));
  t.querySelectorAll("[data-apagar-rep]").forEach(b => (b.onclick = async () => {
    const f = await BD.pegarFicha(b.dataset.apagarRep);
    const ok = await dialogo(raiz, { titulo: "Apagar esta ficha?", html: `<p class="os-sub">${esc(f.arquivo)} vai para a lixeira${f.enviada && !f.leitura ? " (e sai da fila)" : ""}; dá para restaurar por 30 dias. A outra do grupo continua.</p>`, botoes: [{ texto: "Mover para a lixeira", valor: true, classe: "perigo" }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    await moverParaLixeira([f.id]); aviso("Na lixeira: dá para restaurar por 30 dias."); ir("inicio");
  }));
  t.querySelectorAll("[data-nao-rep]").forEach(b => (b.onclick = async () => {
    for (const id of b.dataset.naoRep.split(",")) { const f = await BD.pegarFicha(id); if (f) { f.naoRepetida = true; await BD.salvarFicha(f); } }
    ir("inicio");
  }));
  t.querySelectorAll("[data-ajustar]").forEach(b => (b.onclick = () => ajustarFicha(b.dataset.ajustar)));
  t.querySelector('[data-acao="exp-chave"]').onclick = async () => {
    const k = await chave();
    baixar(new Blob([`Chave do Scanner do Órbita (guarde em local seguro, separado das fichas)\n${k}\n`], { type: "text/plain" }), "chave-odontoscan.txt");
  };
  t.querySelector(".in-chave").onchange = async (e) => {
    const txt = await e.target.files[0].text(), k = (txt.match(/[0-9a-f]{64}/) || [])[0];
    if (!k) return aviso("Arquivo sem chave válida.");
    if (fs.length && !confirm("Já há fichas processadas com a chave atual. Trocar a chave faz as próximas fichas terem códigos diferentes. Continuar?")) return;
    await BD.gravarCfg("chave", k); aviso("Chave trocada.");
  };
  t.querySelector('[data-acao="backup"]').onclick = () => fazerBackup();
  ligarBackupAuto(t);
  t.querySelector(".in-backup").onchange = (e) => { const a = e.target.files[0]; e.target.value = ""; if (a) restaurarBackup(a); };
  t.querySelector('[data-acao="refazer-copias"]')?.addEventListener("click", () => refazerCopias());
  t.querySelector('[data-acao="apagar-tudo"]').onclick = async () => {
    const ok = await dialogo(raiz, { titulo: "Apagar todas as fichas?", html: `<p class="os-sub">As ${fmt(fs.length)} fichas deste aparelho vão para a lixeira e somem de vez em 30 dias (dá para restaurar até lá). A chave dos códigos continua guardada.</p>`, botoes: [{ texto: "Mover todas para a lixeira", valor: true, classe: "perigo" }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    await moverParaLixeira(fs.map(f => f.id)); ir("inicio");
  };
  ligarLixeira(t);
}

// ---------------- deslizar entre as abas ----------------
// A tela acompanha o dedo; ao soltar depois de um bom pedaço (ou num gesto rápido), sai para o lado e a aba
// vizinha entra pelo outro. Nas pontas (Lote e Painel) há resistência e volta. Ignora bordas da tela (gesto de
// voltar do Android), campos, áreas que rolam para o lado, o teclado próprio e as camadas (diálogo, ajuste, zoom).
const ORDEM_ABAS = ABAS;
const reduzirMov = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function ligarDeslize() {
  let kz = 1;
  const t = raiz.querySelector(".os-tela");
  let x0 = 0, y0 = 0, modo = null, dx = 0, trocando = false, rastro = [];
  const bloqueado = () => trocando || raiz.classList.contains("com-teclado") || raiz.querySelector(".os-dialogo, .os-ajuste, .os-copia.zoom, .os-end-img.zoom, .os-mini.grande");
  const rolaDoLado = (el) => {
    for (let e = el; e && e !== t; e = e.parentElement) {
      if (e.matches?.("input, textarea, select, .os-mapa-svg, [data-sem-deslize]")) return true;
      const ox = getComputedStyle(e).overflowX;
      if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 2) return true;
    }
    return false;
  };
  const soltarPilula = () => { const ind = raiz.querySelector(".os-abas-ind"); if (ind) ind.style.transition = ""; };
  const voltar = () => {
    soltarPilula(); moverIndicador(raiz.querySelector(".os-abas"));
    t.style.transition = "transform .3s cubic-bezier(.3,1.3,.5,1), opacity .3s";
    t.style.transform = ""; t.style.opacity = "";
    setTimeout(() => (t.style.transition = ""), 320);
  };
  t.addEventListener("touchstart", (e) => {
    modo = null; dx = 0; rastro = [];
    if (e.touches.length !== 1 || bloqueado()) { modo = "nada"; return; }
    const p = e.touches[0];
    if (p.clientX < 20 || p.clientX > innerWidth - 20 || rolaDoLado(e.target)) { modo = "nada"; return; }
    kz = t.getBoundingClientRect().width / (t.offsetWidth || 1) || 1; // zoom do tablet: o dedo em px da tela, o deslize em px da área
    x0 = p.clientX / kz; y0 = p.clientY / kz; rastro = [[performance.now(), x0]];
  }, { passive: true });
  t.addEventListener("touchmove", (e) => {
    if (modo === "nada" || e.touches.length !== 1) return;
    const p = e.touches[0], ddx = p.clientX / kz - x0, ddy = p.clientY / kz - y0;
    if (!modo) {
      if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
      modo = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? "lado" : "nada";
      if (modo === "nada") return;
      t.style.transition = "";
    }
    rastro.push([performance.now(), p.clientX / kz]); if (rastro.length > 12) rastro.shift();
    dx = ddx;
    if (reduzirMov()) return;
    const i = ORDEM_ABAS.indexOf(aba), naPonta = (dx > 0 && i <= 0) || (dx < 0 && i >= ORDEM_ABAS.length - 1);
    const des = naPonta ? Math.sign(dx) * Math.pow(Math.abs(dx), 0.72) : dx; // nas pontas, resiste
    t.style.transform = `translateX(${des}px)`;
    t.style.opacity = String(1 - Math.min(0.45, Math.abs(des) / ((innerWidth / kz) * 1.4)));
    // a pílula das abas acompanha o dedo até a aba vizinha
    const nav = raiz.querySelector(".os-abas"), ind = nav.querySelector(".os-abas-ind"), bs = nav.querySelectorAll("button");
    const de = bs[i], para = bs[i + (dx < 0 ? 1 : -1)];
    if (ind && de && para && !naPonta) {
      const k = Math.min(1, Math.abs(dx) / ((innerWidth / kz) * 0.6));
      ind.style.transition = "none";
      ind.style.transform = `translateX(${de.offsetLeft + (para.offsetLeft - de.offsetLeft) * k}px)`;
      ind.style.width = `${de.offsetWidth + (para.offsetWidth - de.offsetWidth) * k}px`;
    }
  }, { passive: true });
  const fim = async () => {
    if (modo !== "lado") { modo = null; return; }
    modo = null;
    // velocidade nos últimos ~120 ms (px/ms): um gesto rápido troca mesmo se for curto
    const [tf, xf] = rastro[rastro.length - 1], ref = rastro.find(([tt]) => tf - tt <= 120) || rastro[0];
    const vel = (xf - ref[1]) / Math.max(16, tf - ref[0]);
    const i = ORDEM_ABAS.indexOf(aba), dir = dx < 0 ? 1 : -1, alvo = ORDEM_ABAS[i + dir];
    const vai = alvo && (Math.abs(dx) > Math.min(120, (innerWidth / kz) * 0.3) || (Math.abs(vel) > 0.3 && Math.abs(dx) > 30 && Math.sign(vel) === Math.sign(dx)));
    if (!vai) return voltar();
    trocando = true; soltarPilula();
    if (!reduzirMov()) {
      t.style.transition = "transform .16s ease-in, opacity .16s";
      t.style.transform = `translateX(${-dir * (innerWidth / kz) * 0.6}px)`; t.style.opacity = "0";
      await new Promise(r => setTimeout(r, 150));
    }
    t.style.transition = ""; t.style.transform = ""; t.style.opacity = "";
    try { await ir(alvo, dir); } finally { trocando = false; }
  };
  t.addEventListener("touchend", fim);
  t.addEventListener("touchcancel", () => { if (modo === "lado") voltar(); modo = null; });
}

// ---------------- metas do dia (Números e Revisar) ----------------
async function metaDoDia(fs) { return calcularMetas(fs, (await BD.lerCfg("estadoFila")) || null, (await BD.lerCfg("metas")) || {}); }
/** Chip com anel: tipo "num" (Números) ou "rev" (Revisar). */
const chipMeta = (m, tipo = "rev") => {
  const x = m[tipo], ok = x.feitas >= x.meta, p = x.meta ? Math.min(1, x.feitas / x.meta) : 1;
  return `<button class="os-meta ${ok ? "feita" : ""}" data-acao="meta" title="Meta de ${tipo === "num" ? "números" : "revisões"} de hoje"><i style="--p:${p}"></i><b>${x.feitas}/${x.meta}</b><span>${tipo === "num" ? "números" : "revisar"}</span>${tipo === "rev" && m.seq ? `<em>🔥 ${m.seq}</em>` : ""}</button>`;
};
/** Depois de uma confirmação ou revisão: carimbo quando a meta daquele tipo acaba de ser cumprida. */
async function comemorarMeta(tipo) {
  const m = await metaDoDia(await BD.todasFichas()), x = m[tipo];
  if (x.meta && x.feitas === x.meta) {
    const nome = tipo === "num" ? "números" : "revisões";
    if (m.cumpriu) { await carimbar(raiz, "Meta do dia!"); confete(raiz); aviso(`As duas metas de hoje estão cumpridas${m.seq > 1 ? `. Sequência de ${m.seq} dias 🔥` : ""}!`, 5000); }
    else { await carimbar(raiz, `Meta de ${nome}!`); aviso(`Meta de ${nome} cumprida (${x.meta}). Falta a de ${tipo === "num" ? "revisões" : "números"}.`, 4000); }
    return true;
  }
  return false;
}
async function escolherMeta() {
  const cfg = (await BD.lerCfg("metas")) || {}, m = await metaDoDia(await BD.todasFichas());
  const opcoes = (atual, valores, un) => `<option value="auto" ${!atual || atual === "auto" ? "selected" : ""}>Automática (recomendada)</option>${valores.map(v => `<option value="${v}" ${+atual === v ? "selected" : ""}>${v} ${un} por dia</option>`).join("")}`;
  const r = await dialogo(raiz, {
    titulo: "Metas do dia",
    html: `<p class="os-sub">As metas automáticas mudam todo dia para o trabalho não acumular:</p>
      <ul class="os-sub os-metas-expl">
        <li><b>Números</b> (no Conferir): confirmar pelo menos tantas fichas quantas sobem para a leitura (a próxima noite lê cerca de ${m.num.noite}), sem passar das ${m.num.pendentes + m.num.feitas} que faltavam hoje. Hoje: <b>${m.num.meta}</b>.</li>
        <li><b>Conferir</b>: conferir pelo menos as fichas que chegaram da leitura hoje (${m.rev.chegaram})${m.rev.atraso ? `, mais 1/7 do atraso (${m.rev.atraso} de dias anteriores), para zerá-lo em uma semana` : ""}. Hoje: <b>${m.rev.meta}</b>.</li>
      </ul>
      <p class="os-sub">Dias seguidos com as duas metas cumpridas viram a sua sequência 🔥 (dias sem nada para fazer não contam nem quebram).${opts.recompensar ? " Cada ficha revisada também rende XP e moedas no OdontoLearn (até 40 XP por dia)." : ""}</p>
      <label class="os-campo-txt">Números<span class="os-sel"><select name="numeros">${opcoes(cfg.numeros, [20, 40, 60, 80, 120, 200], "fichas")}</select></span></label>
      <label class="os-campo-txt">Revisar<span class="os-sel"><select name="revisar">${opcoes(cfg.revisar, [10, 20, 30, 50, 80, 120], "fichas")}</select></span></label>`,
    botoes: [{ texto: "Salvar", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
  });
  if (!r) return;
  await BD.gravarCfg("metas", { numeros: r.campos.numeros === "auto" ? "auto" : +r.campos.numeros, revisar: r.campos.revisar === "auto" ? "auto" : +r.campos.revisar }); ir(aba);
}

// ---------------- busca ----------------
async function abrirBusca() {
  const fs = await BD.todasFichas(), pac = ligarPacientes(fs);
  const p = dialogo(raiz, { titulo: "Procurar ficha", html: `<label class="os-campo-txt">Nome do arquivo ou código do paciente<input class="busca-q" placeholder="ex.: IMG_0123 ou P-3F9A" autocomplete="off"></label><ul class="os-lista os-busca-res"></ul>`, botoes: [{ texto: "Fechar", valor: null, classe: "sec" }] });
  const caixa = raiz.querySelector(".os-dialogo:last-of-type"), q = caixa.querySelector(".busca-q"), res = caixa.querySelector(".os-busca-res");
  const mostrar = () => {
    const v = q.value.trim().toLowerCase();
    if (v.length < 2) { res.innerHTML = `<li><span><small>Digite pelo menos 2 letras ou números.</small></span></li>`; return; }
    const achadas = fs.filter(f => f.arquivo.toLowerCase().includes(v) || (pac(f) || "").toLowerCase().includes(v.replace(/^p-?/, "")));
    res.innerHTML = achadas.slice(0, 25).map(f => `<li>${mini(f.id)}<button class="os-pac" data-id="${f.id}"><b>${esc(f.arquivo)}</b><small>${ETAPAS[f.etapa]}${pac(f) ? ` · ${esc(pac(f))}` : ""}${f.etapa === "erro" ? ` · ${esc(f.erro || "")}` : ""}</small></button></li>`).join("")
      + (achadas.length > 25 ? `<li><span><small>e mais ${achadas.length - 25}</small></span></li>` : "") || `<li><span><small>Nada encontrado.</small></span></li>`;
    carregarMinis(res);
    res.querySelectorAll("[data-id]").forEach(b => (b.onclick = async () => {
      const f = fs.find(x => x.id === b.dataset.id);
      caixa.querySelector("button[data-i]").click();
      if (f.leitura) { await ir("conferir"); telaConferir(raiz.querySelector(".os-tela"), f.id); }
      else if (f.etapa === "confirmar") ir("confirmar");
      else { await ir("inicio"); aviso(`${f.arquivo}: ${ETAPAS[f.etapa] || f.etapa}${f.etapa === "erro" ? ` (${f.erro})` : f.enviada ? ", na fila da madrugada" : ""}.`, 5000); }
    }));
  };
  q.oninput = mostrar; mostrar();
  await p;
}

// ---------------- ajuste à mão ----------------
let cachePasta = null; // { quando, mapa: "caminho|tamanho" → item } (listar a pasta inteira leva alguns segundos)
async function fotoDaPasta(f) {
  if (!(await BD.lerCfg("pasta"))) return null;
  if (!cachePasta || Date.now() - cachePasta.quando > 10 * 60000) {
    aviso("Procurando a foto na pasta…", 6000);
    const lista = await listarPasta(false);
    if (!lista) return null;
    cachePasta = { quando: Date.now(), mapa: new Map(lista.itens.map(i => [`${i.caminho}|${i.tamanho}`, i])), porNome: porNomeUnico(lista.itens) };
  }
  return cachePasta.mapa.get(`${f.arquivo}|${f.tamanho}`) || cachePasta.porNome.get(chaveNome(f.arquivo, f.tamanho)) || null;
}
/** Modo local: a ficha inteira de uma ficha processada antes (29/10/2026), endireitada de novo a partir da foto da pasta.
 *  Só sem perguntar nada: se o navegador não liberou a pasta nesta sessão, fica a cópia. Devolve o Blob ou null. */
const tentouInteira = new Set();
async function garantirInteira(f) {
  if (f.imgs?.inteira || tentouInteira.has(f.id) || importando || opts.pasta) return null;
  tentouInteira.add(f.id);
  const dir = await BD.lerCfg("pastaHandle");
  if (!dir || (await dir.queryPermission?.({ mode: "read" })) !== "granted") return null;
  const it = await fotoDaPasta(f); if (!it) return null;
  const { img, topo } = await alinharFoto(await comPrazo(it.ler(), 60000, "a foto não abriu"), { topo: true });
  const b = await imagemInteira(img, revisadaF(f) ? 0.8 : 0.85);
  await BD.porImagens(f.id, { inteira: b, ...(topo && !f.imgs?.topo ? { topo: await topoJpeg(topo) } : {}) });
  return b;
}
async function ajustarFicha(id) {
  if (importando) return aviso("Espere a importação terminar.");
  const f = await BD.pegarFicha(id); if (!f) return;
  let arquivo = null;
  try { const it = await fotoDaPasta(f); if (it) arquivo = await comPrazo(it.ler(), 60000, "a foto não abriu"); } catch { /* escolhe à mão */ }
  if (!arquivo) {
    let escolhido = null;
    const p = dialogo(raiz, {
      titulo: "Escolher a foto", html: `<p class="os-sub">Não achei <b>${esc(f.arquivo)}</b> na pasta guardada. Escolha a foto dessa ficha.</p><label class="os-botao sec">Escolher a foto<input type="file" accept="image/*" hidden class="aj-foto"></label><p class="os-sub aj-escolhida"></p>`,
      botoes: [{ texto: "Abrir", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
      validar: () => escolhido ? null : "Escolha a foto primeiro.",
    });
    const inp = raiz.querySelector(".os-dialogo:last-of-type .aj-foto");
    inp.onchange = (e) => { escolhido = e.target.files[0] || null; raiz.querySelector(".os-dialogo:last-of-type .aj-escolhida").textContent = escolhido?.name || ""; };
    if (!(await p) || !escolhido) return;
    arquivo = escolhido;
  }
  abrirAjuste(raiz, {
    arquivo, nome: f.arquivo,
    aoEndireitar: async (cantos) => {
      let g = await processarFoto(arquivo, { nome: f.arquivo, tamanho: f.tamanho, cantos, inteira: await modoLocal() });
      if (g.etapa === "erro") return { ok: false, msg: g.erro };
      if (g.etapa === "pronta") { g = await fecharNumeros(g, Object.fromEntries(Object.entries(g.sugestoes).map(([c, s]) => [c, s.texto])), await chave(), true); g.numerosAuto = true; }
      await BD.apagarFicha(f.id); await BD.salvarFicha(g);
      if (g.alinhamentoPendente) aviso(`Endireitada (${Math.round(g.alinhamento * 100)}%). Confira a cópia no Lote, em Alinhamento duvidoso, antes de ela seguir.`, 6000);
      else { aviso("Endireitada! A ficha seguiu para os números e a leitura.", 4000); confete(raiz, 50); }
      ir("inicio");
      return { ok: true };
    },
  });
}

// ---------------- lixeira ----------------
async function moverParaLixeira(ids) {
  const tirar = [], agora = new Date().toISOString();
  for (const id of ids) {
    const f = await BD.pegarFicha(id); if (!f) continue;
    if (f.enviada && !f.leitura) { tirar.push(f.pacote); f.enviada = false; }
    f.lixeira = agora; registrar(f, "Movida para a lixeira");
    await BD.salvarFicha(f);
  }
  if (tirar.length) tirarDaFila(tirar).catch(e => console.warn("OdontoScan: tirar da fila", e.message));
}
async function restaurarDaLixeira(ids) {
  for (const id of ids) { const f = await BD.pegarFicha(id); if (!f) continue; delete f.lixeira; registrar(f, "Restaurada da lixeira"); await BD.salvarFicha(f); }
}
/** Some de vez com o que está na lixeira há mais de 30 dias (ao abrir o Scanner). */
async function limparLixeiraVelha() {
  const limite = Date.now() - 30 * 864e5;
  for (const f of await BD.fichasNaLixeira()) if (new Date(f.lixeira) < limite) await BD.apagarFicha(f.id);
}
function ligarLixeira(t) {
  t.querySelectorAll("[data-restaurar]").forEach(b => (b.onclick = async () => { await restaurarDaLixeira([b.dataset.restaurar]); aviso("Restaurada."); ir("inicio"); }));
  t.querySelectorAll("[data-apagar-vez]").forEach(b => (b.onclick = async () => {
    const ok = await dialogo(raiz, { titulo: "Apagar de vez?", html: `<p class="os-sub">Esta ficha some do aparelho e não dá para recuperar (a foto continua na pasta).</p>`, botoes: [{ texto: "Apagar de vez", valor: true, classe: "perigo" }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (ok) { await BD.apagarFicha(b.dataset.apagarVez); ir("inicio"); }
  }));
  t.querySelector('[data-acao="restaurar-tudo"]')?.addEventListener("click", async () => { const l = await BD.fichasNaLixeira(); await restaurarDaLixeira(l.map(f => f.id)); aviso(`${fmt(l.length)} ${l.length === 1 ? "ficha restaurada" : "fichas restauradas"}.`); ir("inicio"); });
  t.querySelector('[data-acao="esvaziar"]')?.addEventListener("click", async () => {
    const l = await BD.fichasNaLixeira();
    const ok = await dialogo(raiz, { titulo: "Esvaziar a lixeira?", html: `<p class="os-sub">As ${fmt(l.length)} fichas da lixeira somem de vez.</p>`, botoes: [{ texto: "Esvaziar", valor: true, classe: "perigo" }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    for (const f of l) await BD.apagarFicha(f.id);
    aviso("Lixeira vazia."); ir("inicio");
  });
}

// ---------------- backup ----------------
// o backup automático da semana (backupAuto.js): só onde dá para escolher pasta (o computador)
function htmlBackupAuto(s, total) {
  if (!s.possivel) return "";
  if (!s.ligado) return `<div class="os-pasta-salva os-ba">${IC.pasta}<span><b>Backup automático toda semana</b><small>Escolha uma pasta (um pendrive, por exemplo) e uma senha: o app grava o backup sozinho a cada 7 dias e guarda os ${BA.GUARDAR} mais novos.</small></span><button class="os-botao ${total ? "" : "sec"}" data-ba="ligar">Ligar</button></div>`;
  const quando = s.dias === null ? "ainda nenhum" : s.dias === 0 ? "hoje" : s.dias === 1 ? "ontem" : `há ${s.dias} dias`;
  const falta = s.devido && s.permissao !== "granted";
  return `<div class="os-pasta-salva os-ba ${s.devido ? "devido" : ""}">${IC.pasta}<span><b>Backup semanal em ${esc(s.nome)}</b><small>Último: ${quando}${s.erro ? ` · não deu: ${esc(s.erro)}` : ""}${falta ? " · o navegador pede um toque seu para gravar na pasta" : ""}</small></span>
    <span class="os-acoes-li"><button class="os-botao ${s.devido ? "" : "sec"}" data-ba="agora">${falta ? "Gravar o backup da semana" : "Fazer agora"}</button><button class="os-link" data-ba="desligar">Desligar</button></span></div>`;
}
function ligarBackupAuto(t) {
  t.querySelector('[data-ba="ligar"]')?.addEventListener("click", async () => {
    let pasta;
    try { pasta = await BA.escolherPasta(); } catch { return; } // a escolha da pasta precisa vir já no toque
    const r = await dialogo(raiz, {
      titulo: "Backup automático",
      html: `<p class="os-sub">Pasta: <b>${esc(pasta.name)}</b>. Escolha a senha dos backups (mínimo 8 caracteres). <b>Ela não fica guardada</b>: sem ela, ninguém abre os backups, nem você. Anote num lugar seguro.</p>${CAMPO_SENHA("senha", "Senha", "new-password")}${CAMPO_SENHA("conf", "Repita a senha", "new-password")}`,
      botoes: [{ texto: "Ligar e fazer o primeiro", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
      validar: (_, c) => c.senha.length < 8 ? "A senha precisa de pelo menos 8 caracteres." : c.senha !== c.conf ? "As duas senhas não são iguais." : null,
    });
    if (!r) return;
    aviso("Gravando o primeiro backup…", 8000);
    const res = await BA.ligar(pasta, r.campos.senha);
    aviso(res.ok ? `Backup automático ligado: ${fmt(res.fichas)} fichas em ${res.nome}. O próximo sai em 7 dias.` : `Ligado, mas o primeiro não foi gravado (${res.motivo === "permissao" ? "o navegador não deixou gravar na pasta" : res.erro || res.motivo}).`, 7000);
    ir("inicio");
  });
  t.querySelector('[data-ba="agora"]')?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const res = await BA.fazerAgora({ pedir: true });
    aviso(res.ok ? `Backup gravado: ${fmt(res.fichas)} fichas (${res.nome}).` : res.motivo === "permissao" ? "O navegador não deixou gravar na pasta." : `Não deu: ${res.erro || res.motivo}`, 6000);
    ir("inicio");
  });
  t.querySelector('[data-ba="desligar"]')?.addEventListener("click", async () => {
    const ok = await dialogo(raiz, { titulo: "Desligar o backup automático?", html: `<p class="os-sub">Os backups já gravados na pasta continuam lá.</p>`, botoes: [{ texto: "Desligar", valor: true, classe: "perigo" }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    await BA.desligar(); ir("inicio");
  });
}
const CAMPO_SENHA = (nome, rotulo, auto) => `<label class="os-campo-txt">${rotulo}<input type="password" name="${nome}" autocomplete="${auto}" minlength="8" required></label>`;
async function fazerBackup() {
  const r = await dialogo(raiz, {
    titulo: "Fazer backup",
    html: `<p class="os-sub">Escolha uma senha (mínimo 8 caracteres). <b>Sem ela, ninguém abre o backup, nem você</b>: anote num lugar seguro.</p>${CAMPO_SENHA("senha", "Senha", "new-password")}${CAMPO_SENHA("conf", "Repita a senha", "new-password")}`,
    botoes: [{ texto: "Gerar backup", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
    validar: (_, c) => c.senha.length < 8 ? "A senha precisa de pelo menos 8 caracteres." : c.senha !== c.conf ? "As duas senhas não são iguais." : null,
  });
  if (!r) return;
  aviso("Gerando o backup…", 8000);
  try {
    const { blob, info } = await gerarBackup(r.campos.senha);
    await baixar(blob, `odontoscan-backup-${new Date().toISOString().slice(0, 10)}.oscb`);
    await BD.gravarCfg("ultimoBackup", info.criado);
    aviso(`Backup pronto: ${fmt(info.fichas)} fichas e a chave dos códigos, em ${(blob.size / 1048576).toFixed(1).replace(".", ",")} MB.`, 5000);
    if (aba === "inicio") ir("inicio");
  } catch (e) { aviso(`Não consegui gerar o backup: ${e.message}`, 5000); }
}
async function restaurarBackup(arquivo) {
  let dados = null;
  const r = await dialogo(raiz, {
    titulo: "Restaurar backup", html: `<p class="os-sub">${esc(arquivo.name)}</p>${CAMPO_SENHA("senha", "Senha do backup", "current-password")}`,
    botoes: [{ texto: "Abrir", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
    validar: async (_, c) => { try { dados = await lerBackup(arquivo, c.senha); } catch (e) { return e.message === "senha" ? "Senha errada." : e.message; } },
  });
  if (!r || !dados) return;
  const aqui = await BD.todasFichas(), chaveAqui = await BD.lerCfg("chave"), outraChave = aqui.length && chaveAqui && dados.cfg.chave && chaveAqui !== dados.cfg.chave;
  const quando = dados.info.criado ? new Date(dados.info.criado).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "?";
  const c = await dialogo(raiz, {
    titulo: "Restaurar backup",
    html: `<p class="os-sub">Backup de ${quando}, com <b>${fmt(dados.fichas.length)} fichas</b>.</p>${outraChave
      ? `<p class="os-sub"><b>As ${fmt(aqui.length)} fichas deste aparelho usam outra chave dos códigos.</b> Juntar as duas faria o mesmo paciente ter códigos diferentes. Para restaurar, as fichas daqui são apagadas e ficam só as do backup.</p>`
      : aqui.length ? `<p class="os-sub">As ${fmt(aqui.length)} fichas deste aparelho continuam; de cada ficha que estiver nos dois, fica a mais adiantada.</p>` : ""}`,
    botoes: [{ texto: outraChave ? "Apagar daqui e restaurar" : "Restaurar", valor: true, classe: outraChave ? "perigo" : "" }, { texto: "Cancelar", valor: null, classe: "sec" }],
  });
  if (!c) return;
  try {
    const res = await restaurar(dados, { substituir: !!outraChave });
    if (res.tirarDaFila.length) tirarDaFila(res.tirarDaFila).catch(() => {});
    aviso(`Restaurado: ${fmt(res.novas)} novas, ${fmt(res.atualizadas)} atualizadas${res.iguais ? `, ${fmt(res.iguais)} já estavam iguais` : ""}.${res.semCopia ? ` ${fmt(res.semCopia)} sem cópia: toque em Refazer, no cartão Chave e backup.` : ""}`, 8000);
    ir("inicio");
  } catch (e) { aviso(`Não consegui restaurar: ${e.message}`, 5000); }
}
/** Fichas em Números sem os recortes no aparelho (em 22/10/2026, o envio desfazia a confirmação de quem estava sendo
 *  confirmado no mesmo momento: a ficha voltava a Números, mas os recortes já tinham sido apagados). */
async function fichasSemRecorte() {
  const chaves = await BD.chavesDeImagens(), com = new Set([...chaves].filter(k => k.includes("|recorte:")).map(k => k.split("|")[0]));
  return (await BD.todasFichas()).filter(f => f.etapa === "confirmar" && f.sugestoes && !com.has(f.id));
}
/** Refaz as cópias (e o recorte do endereço) das fichas restauradas, e os recortes dos números que se perderam,
 *  a partir das fotos da pasta. */
async function refazerCopias() {
  if (importando) return;
  const semRec = new Set((await fichasSemRecorte()).map(f => f.id));
  const sem = (await BD.todasFichas()).filter(f => (f.semCopia || semRec.has(f.id)) && f.etapa !== "erro");
  if (!sem.length) return;
  let lista;
  try { lista = await listarPasta(false, (m) => aviso(m, 4000)); } catch (e) { return erroPasta(e); }
  if (!lista) return;
  const porChave = new Map(lista.itens.map(i => [`${i.caminho}|${i.tamanho}`, i])), porNome = porNomeUnico(lista.itens);
  let feitas = 0, faltam = 0, falhas = 0;
  const inteira = await modoLocal();
  raiz.classList.add("importando");
  try {
    for (const [i, f] of sem.entries()) {
      if (i % 5 === 0) aviso(`Refazendo as cópias: ${i} de ${sem.length}…`, 4000);
      const it = porChave.get(`${f.arquivo}|${f.tamanho}`) || porNome.get(chaveNome(f.arquivo, f.tamanho));
      if (!it) { faltam++; continue; }
      try {
        const g = await comPrazo(processarFoto(await comPrazo(it.ler(), 60000, "a foto não abriu"), { nome: f.arquivo, tamanho: f.tamanho, inteira }), 90000, "demorou demais");
        if (g.etapa === "erro") { falhas++; continue; }
        // só os recortes perdidos: a cópia que já subiu fica como está
        const imgs = f.semCopia || !f.imgs?.ficha ? { ficha: g.imgFicha, endereco: g.imgEndereco } : {};
        if (f.etapa === "confirmar") for (const [c, b] of Object.entries(g.recortes || {})) imgs[`recorte:${c}`] = b;
        if (g.imgInteira && f.etapa !== "revisada") imgs.inteira = g.imgInteira;
        await BD.porImagens(f.id, imgs, g.presenca ? { presenca: g.presenca } : {}); feitas++;
      } catch { falhas++; }
    }
  } finally { raiz.classList.remove("importando"); }
  aviso(`${fmt(feitas)} ${feitas === 1 ? "ficha refeita" : "fichas refeitas"}${faltam ? `; ${fmt(faltam)} fotos não estão nesta pasta (escolha a pasta certa no Lote)` : ""}${falhas ? `; ${fmt(falhas)} não deram certo` : ""}.`, 7000);
  if (feitas) confete(raiz);
  ir(aba);
}

/** Fotos escolhidas diretamente (poucas) ou pela pasta do navegador antigo. */
function processarLote(arquivos, t) {
  return processarItens(arquivos.map(f => ({ caminho: f.webkitRelativePath || f.name, tamanho: f.size, ler: async () => f })), t);
}

/** Lista as fotos de uma pasta escolhida no navegador (File System Access), com o caminho de cada uma. */
// A pasta de trabalho da leitura local pode estar dentro da pasta das fotos (ou ser a própria): as imagens que o app grava
// lá para a IA (fila/<id>/copia.jpg, endereco.jpg, numeros.jpg e as da validação) não são fotos de fichas (29/10/2026:
// o Lote passou a importá-las e as fotos foram de ~3.800 para 11.424).
const SUBPASTAS_TRABALHO = new Set(["fila", "respostas", "validacao", "validacao-respostas"]);
export const ehArquivoDeTrabalho = (caminho) => /(^|\/)(fila|validacao)\/[^/]+\/(copia|endereco|numeros)\.jpe?g$/i.test(String(caminho || ""));
const mesmaPasta = async (a, b) => { try { return !!(a && b && await a.isSameEntry(b)); } catch { return false; } };
export async function listarPastaNavegador(dir, prefixo = "", out = [], trabalho = undefined) {
  if (trabalho === undefined) trabalho = (await BD.lerCfg("trabalhoHandle").catch(() => null)) || null;
  const ehTrabalho = await mesmaPasta(dir, trabalho);
  for await (const h of dir.values()) {
    if (h.kind === "directory") {
      if (h.name.startsWith(".") || (ehTrabalho && SUBPASTAS_TRABALHO.has(h.name)) || await mesmaPasta(h, trabalho)) continue;
      await listarPastaNavegador(h, `${prefixo}${h.name}/`, out, trabalho); continue;
    }
    if (!/\.(jpe?g|png|webp)$/i.test(h.name) || ehArquivoDeTrabalho(prefixo + h.name)) continue;
    let f; try { f = await comPrazo(h.getFile(), 15000, "sem resposta"); } catch { continue; } // arquivo que não abre não trava a lista
    out.push({ caminho: prefixo + h.name, tamanho: f.size, ler: () => h.getFile() });
  }
  return out;
}

/** Importação grande: escolhe (ou reabre) a pasta, lista as fotos e processa só as que faltam, uma por vez. */
/** Lista as fotos da pasta guardada (ou escolhe uma). Devolve { itens, nome, ignoradas } ou null (cancelou). */
async function listarPasta(escolherNova, mostrar = () => {}) {
  if (opts.pasta) { // app Android: pasta pelo sistema (permissão guardada)
    let p = escolherNova ? null : await BD.lerCfg("pasta");
    if (!p?.uri) { try { p = await opts.pasta.escolher(); } catch (e) { if (/cancel/i.test(e.message)) return null; throw e; } }
    mostrar(`Lendo a pasta ${p.nome}…`);
    let r;
    try { r = await opts.pasta.listar(p.uri); }
    catch (e) {
      if (/sem_permissao/.test(e.message) && !escolherNova) { aviso("O Android não deixou mais ler essa pasta: escolha de novo.", 4500); return listarPasta(true, mostrar); }
      throw e;
    }
    const itens = r.arquivos.map(a => ({ caminho: a.caminho, tamanho: a.tamanho, ler: () => opts.pasta.ler(a.uri) }));
    await BD.gravarCfg("pasta", { uri: p.uri, nome: p.nome, total: itens.length });
    return { itens, nome: p.nome, ignoradas: r.ignoradas || 0 };
  }
  // notebook (Chrome/Edge): seletor de pasta do navegador
  let dir = escolherNova ? null : await BD.lerCfg("pastaHandle");
  if (dir && (await dir.queryPermission?.({ mode: "read" })) !== "granted" && (await dir.requestPermission?.({ mode: "read" })) !== "granted") dir = null;
  if (!dir) { try { dir = await window.showDirectoryPicker({ mode: "read" }); } catch (e) { if (e.name === "AbortError") return null; throw e; } }
  mostrar(`Lendo a pasta ${dir.name}…`);
  const itens = await listarPastaNavegador(dir);
  try { await BD.gravarCfg("pastaHandle", dir); } catch { /* navegador sem suporte a guardar a pasta */ }
  await BD.gravarCfg("pasta", { nome: dir.name, total: itens.length });
  return { itens, nome: dir.name, ignoradas: 0 };
}
const erroPasta = (e) => aviso(/showDirectoryPicker/.test(e.message) ? SEM_PASTAS : /not implemented|não implementado|UNIMPLEMENTED/i.test(e.message) ? "Atualize o app para escolher pastas (versão nova no GitHub)." : `Não consegui abrir a pasta: ${e.message}`, 8000);
// Firefox e outros navegadores não têm o seletor de pastas (File System Access API): só Edge e Chrome.
const SEM_PASTAS = "Este navegador não deixa escolher pastas. Abra o OdontoScan.html no Microsoft Edge ou no Google Chrome (botão direito no arquivo → Abrir com).";

// Reconhecer a mesma foto pelo nome do arquivo + tamanho, sem o caminho (28/10/2026: as fotos vão ser reorganizadas
// noutra pasta, no computador do laboratório, e as fichas restauradas do backup do celular guardam o caminho antigo).
const nomeArq = (c) => String(c || "").split(/[\\/]/).pop().toLowerCase();
const chaveNome = (c, t) => `${nomeArq(c)}|${t}`;
function agrupar(lista, chaveDe) { const m = new Map(); for (const x of lista) { const k = chaveDe(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }
/** Itens da pasta cujo nome + tamanho é único nela: Map(chave → item). */
function porNomeUnico(itens) { return new Map([...agrupar(itens, i => chaveNome(i.caminho, i.tamanho))].filter(([, l]) => l.length === 1).map(([k, l]) => [k, l[0]])); }
/** Das fotos que não estão no app pelo caminho: as reconhecidas pelo nome + tamanho ([item, ficha]), as ambíguas e as novas. */
export function separarMovidas(novos, todas, itens) {
  const aqui = new Set(itens.map(i => `${i.caminho}|${i.tamanho}`));
  // só fichas cuja foto não está mais no caminho guardado (as outras continuam ligadas a ele)
  const fichas = agrupar(todas.filter(f => f.arquivo && !aqui.has(`${f.arquivo}|${f.tamanho}`)), f => chaveNome(f.arquivo, f.tamanho));
  const fotos = agrupar(itens, i => chaveNome(i.caminho, i.tamanho));
  const mudaram = [], ambiguas = [], novas = [];
  for (const it of novos) {
    const k = chaveNome(it.caminho, it.tamanho), fs = fichas.get(k) || [], n = fotos.get(k)?.length || 1;
    if (!fs.length) novas.push(it);
    else if (fs.length === 1 && n === 1) mudaram.push([it, fs[0]]);
    else ambiguas.push({ it, fichas: fs.length, fotos: n });
  }
  return { mudaram, ambiguas, novas };
}

async function importarPasta(t, escolherNova) {
  if (importando) return;
  const box = t.querySelector(".os-prog-lote"), txt = box?.querySelector("p");
  const mostrar = (m) => { if (!box) return; box.hidden = false; const n = t.querySelector(".os-prog-n"), eta = t.querySelector(".os-prog-eta"); if (n) n.textContent = ""; if (eta) eta.textContent = ""; txt.textContent = m; };
  let lista;
  try { lista = await listarPasta(escolherNova, mostrar); }
  catch (e) { if (box) box.hidden = true; return erroPasta(e); }
  if (!lista) return;
  const { itens, nome, ignoradas } = lista;
  itens.sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR", { numeric: true }));
  const todasL = await BD.todasComLixeira(), ja = new Set(todasL.map(f => `${f.arquivo}|${f.tamanho}`));
  const novos = itens.filter(i => !ja.has(`${i.caminho}|${i.tamanho}`));
  // a mesma foto em outra pasta (pasta reorganizada, ou fichas restauradas do backup do celular): pelo nome + tamanho
  const { mudaram, ambiguas, novas } = separarMovidas(novos, todasL, itens);
  let refazer = 0, faltam = novas;
  if (mudaram.length) {
    for (const [it, f0] of mudaram) {
      const g = await BD.pegarFicha(f0.id); if (!g) continue;
      registrar(g, "Foto achada em outra pasta (mesmo nome e tamanho): caminho atualizado");
      g.arquivo = it.caminho; await BD.salvarFicha(g);
      if (g.semCopia && g.etapa !== "erro") refazer++;
    }
    cachePasta = null;
  }
  if (ambiguas.length) {
    const lista = ambiguas.slice(0, 12).map(a => `<li><span><b>${esc(a.it.caminho)}</b><small>${a.fichas} ${a.fichas === 1 ? "ficha" : "fichas"} no app e ${a.fotos} ${a.fotos === 1 ? "foto" : "fotos"} nesta pasta com o mesmo nome e tamanho</small></span></li>`).join("");
    const r = await dialogo(raiz, { titulo: "Fotos ambíguas", html: `<p class="os-sub"><b>${fmt(ambiguas.length)} ${ambiguas.length === 1 ? "foto tem" : "fotos têm"} o mesmo nome e tamanho</b> de mais de uma ficha (ou aparecem repetidas nesta pasta), então o app não sabe a qual ficha cada uma corresponde. Pular evita duplicar; processar cria fichas novas (as repetidas aparecem depois no cartão de repetidas).</p><ul class="os-lista">${lista}</ul>${ambiguas.length > 12 ? `<p class="os-sub">e mais ${fmt(ambiguas.length - 12)}.</p>` : ""}`,
      botoes: [{ texto: "Pular estas", valor: "pular" }, { texto: "Processar também", valor: "processar", classe: "sec" }] });
    if (r?.valor === "processar") faltam = [...faltam, ...ambiguas.map(a => a.it)];
  }
  const partes = [`${nome}: ${fmt(itens.length)} fotos, ${fmt(itens.length - novos.length)} já no app`];
  if (mudaram.length) partes.push(`${fmt(mudaram.length)} reconhecidas pelo nome e tamanho (mudaram de pasta)`);
  if (ambiguas.length) partes.push(`${fmt(ambiguas.length)} ambíguas`);
  if (refazer) {
    const r = await dialogo(raiz, { titulo: "Montar as cópias?", html: `<p class="os-sub"><b>${fmt(refazer)} ${refazer === 1 ? "ficha restaurada do backup achou a foto" : "fichas restauradas do backup acharam as fotos"}</b> nesta pasta. As revisões e os códigos dos pacientes ficam como estão; só as cópias (para a leitura e o Revisar) são refeitas.</p>`,
      botoes: [{ texto: "Refazer as cópias agora", valor: true }, { texto: "Depois", valor: null, classe: "sec" }] });
    if (r) { if (box) box.hidden = true; await refazerCopias(); }
  }
  if (!faltam.length) { if (box) box.hidden = true; return aviso(`${partes.join("; ")}: nada novo para processar.${ignoradas ? ` ${ignoradas} em formato que o app não abre (HEIC?) ficaram de fora.` : ""}`, 6000); }
  aviso(`${partes.join("; ")}; processando ${fmt(faltam.length)}.${ignoradas ? ` ${ignoradas} em HEIC ou outro formato ficaram de fora.` : ""}`, 6000);
  return processarItens(faltam, t);
}

/** Processa as fotos uma por vez (lê, endireita, lê os números, guarda as cópias, descarta a foto). */
const comPrazo = (p, ms, msg) => { let t; return Promise.race([p, new Promise((_, falha) => (t = setTimeout(() => falha(new Error(msg)), ms)))]).finally(() => clearTimeout(t)); };
/** Foto que não deu: fica como "Não reconhecida" (com o motivo), sem imagens; Remover deixa tentar de novo. */
async function registrarProblema(it, e) {
  try {
    await BD.salvarFicha({ id: `f-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, arquivo: it.caminho, tamanho: it.tamanho,
      criado: new Date().toISOString(), pacote: "", etapa: "erro", erro: `Problema ao processar: ${e?.message || e}`, conferencia: CONFERENCIA });
  } catch { /* sem espaço: só não registra */ }
}
function pedirParada() { parar = true; const p = raiz.querySelector(".os-prog-lote p"); if (p) p.textContent = "Parando depois desta foto…"; }
/** Mostra o andamento na tela Lote (se ela estiver aberta; dá para trocar de tela no meio). */
// (só a caixa do Lote: a Leitura também tem .os-progresso, sem os mesmos elementos; e um erro aqui nunca pode
// derrubar a foto que está sendo processada, como aconteceu na v0.1.58 com quem trocou de aba no meio)
function mostrarAndamento() { try { desenharAndamento(); } catch (e) { console.warn("OdontoScan: andamento", e); } }
function desenharAndamento() {
  const box = raiz.querySelector(".os-prog-lote"); if (!box || !importando || !box.querySelector(".os-prog-n")) return;
  box.hidden = false;
  box.querySelector(".os-barra i").style.width = `${(importando.n / importando.total) * 100}%`;
  box.querySelector(".os-prog-n").textContent = importando.rotulo || `${importando.n} de ${importando.total}`;
  box.querySelector(".os-prog-eta").textContent = importando.eta || "";
  box.querySelector("p").textContent = importando.caminho || "";
  const atual = importando.rotulo ? 3 : FASES.findIndex(([chave]) => (importando.fase || "").startsWith(chave));
  box.querySelectorAll(".os-fases li").forEach((li, i) => { li.classList.toggle("on", i === atual); li.classList.toggle("feita", atual >= 0 && i < atual); });
  if (importando.feitas && !importando.rotulo) {
    const min = Math.max(1 / 60, (Date.now() - importando.inicio) / 60000);
    box.querySelector(".os-prog-eta").textContent = `${(importando.feitas / min).toFixed(1).replace(".", ",")} por min${importando.eta ? ` · ${importando.eta}` : ""}`;
  }
  box.querySelector(".os-parar").onclick = pedirParada;
}

/** Processa as fotos uma por vez (lê, endireita, lê os números, guarda as cópias, descarta a foto). */
async function processarItens(itens, t) {
  itens = itens.filter(i => !ehArquivoDeTrabalho(i.caminho)); // imagens que o app grava para a IA não são fichas
  if (!itens.length || importando) return;
  const k = await chave(), ja = new Set((await BD.todasComLixeira()).map(f => `${f.arquivo}|${f.tamanho}`));
  parar = false;
  importando = { n: 0, total: itens.length, caminho: "", eta: "", fase: "", inicio: Date.now(), feitas: 0, problemas: 0 };
  raiz.classList.add("importando");
  raiz.querySelectorAll(".os-importar .os-botao, .os-importar input").forEach(b => (b.disabled = true));
  mostrarAndamento();
  // tela ligada durante a importação (no Android, a tela apagada pausa o app)
  opts.pasta?.manterTela(true);
  let trava = null; try { trava = await navigator.wakeLock?.request("screen"); } catch { /* sem trava de tela */ }
  let feitas = 0, puladas = 0, auto = 0, erros = 0, falhaLer = 0;
  const inicio = Date.now(), total = itens.length, inteira = await modoLocal(); // modo local: guarda também a ficha inteira
  const fase = (f) => { importando.fase = f; mostrarAndamento(); };
  try {
    for (const [i, it] of itens.entries()) {
      if (parar) break;
      importando.n = i + 1; importando.caminho = it.caminho;
      if (i >= 3) { const s = ((Date.now() - inicio) / i) * (total - i) / 1000; importando.eta = s > 90 ? `cerca de ${Math.round(s / 60)} min restantes` : `cerca de ${Math.max(1, Math.round(s))} s restantes`; }
      if (ja.has(`${it.caminho}|${it.tamanho}`)) { puladas++; continue; }
      await new Promise(r => setTimeout(r, 0));
      // cada foto tem prazo e erro próprio: uma foto problemática não trava a importação
      try {
        fase("abrindo a foto");
        let arq = await comPrazo(it.ler(), 60000, "a foto não abriu em 1 minuto (arquivo na nuvem ou corrompido?)");
        fase("endireitando e lendo os números");
        let f = await comPrazo(processarFoto(arq, { nome: it.caminho, tamanho: it.tamanho, inteira }), 90000, "o processamento passou de 1 minuto e meio");
        arq = null;
        if (f.etapa === "pronta") { f = await fecharNumeros(f, Object.fromEntries(Object.entries(f.sugestoes).map(([c, s]) => [c, s.texto])), k, true); f.numerosAuto = true; auto++; }
        if (f.etapa === "erro") erros++;
        fase("guardando");
        await comPrazo(BD.salvarFicha(f), 30000, "não consegui guardar no aparelho (memória cheia?)");
        feitas++;
      } catch (e) {
        falhaLer++; importando.problemas++;
        console.warn("OdontoScan: problema na foto", it.caminho, e);
        await registrarProblema(it, e);
      }
      ja.add(`${it.caminho}|${it.tamanho}`);
      importando.feitas = feitas;
      if (feitas % 25 === 0) { atualizarBadges(); if (noPainel()) telaPainel(raiz.querySelector(".os-tela")); }
      // de tempos em tempos, completa a fila da madrugada (sem esperar)
      if (feitas && feitas % 200 === 0 && (await BD.lerCfg("autoEnviar")) !== false) completarFila().catch(() => {});
    }
  } finally {
    opts.pasta?.manterTela(false);
    try { await trava?.release(); } catch { /* */ }
  }
  importando.eta = "";
  let enviadas = 0;
  try {
    const local = await modoLocal();
    if ((await BD.lerCfg("autoEnviar")) !== false && (local || ((await credenciais()) && navigator.onLine))) {
      try {
        const rf = (await completarFila({
          parar: () => parar,
          aoProgresso: (i, n) => { Object.assign(importando, { rotulo: local ? "Fila local" : "Fila cifrada", caminho: `${local ? "Gravando" : "Enviando"}: ${Math.min(i + 1, n)} de ${n}`, n: i, total: n || 1 }); mostrarAndamento(); },
        }));
        enviadas = rf?.enviadas || 0; if (rf) opts.aoFila?.(rf.naFila, rf);
      } catch (e) { aviso(`Fichas processadas, mas o envio para a fila falhou: ${e.message}`, 6000); }
    }
  } finally { importando = null; raiz.classList.remove("importando"); }
  const resto = total - feitas - puladas - falhaLer;
  if (feitas) confete(raiz);
  if (falhaLer) aviso(`${falhaLer} ${falhaLer === 1 ? "foto deu problema e ficou" : "fotos deram problema e ficaram"} em Não reconhecidas, no Lote.`, 5000);
  aviso(`${feitas} ${feitas === 1 ? "processada" : "processadas"}${auto ? `, ${auto} com números já conferidos pelo dígito verificador` : ""}${puladas ? `, ${puladas} repetidas puladas` : ""}${erros ? `, ${erros} não reconhecidas` : ""}${falhaLer ? `, ${falhaLer} que não abriram` : ""}${enviadas ? `; ${enviadas} na fila da madrugada (as outras sobem aos poucos)` : ""}${parar && resto > 0 ? `. Faltam ${resto}: toque em Continuar quando quiser` : ""}.`, 6500);
  setTimeout(() => { if (aba === "inicio") ir("inicio"); else atualizarBadges(); }, 700);
}

// ---------------- Confirmar números ----------------
/** Onde ficam os quadradinhos no recorte (0 a 1): os medidos nesta ficha ou os do modelo (fichas processadas antes). */
function geometriaCaixas(c, s) {
  if (s?.pos?.length) return { pos: s.pos, larg: s.larg || 0.07 };
  const [fx0, , fx1] = FAIXAS_NUMEROS[c];
  return { pos: CAIXAS[c].map(([x, , w]) => (x + w / 2 - fx0) / (fx1 - fx0)), larg: CAIXAS[c][0][2] / (fx1 - fx0) };
}
/** Em qual quadradinho vai cada dígito: os de onde a leitura veio (se o número de dígitos bate) ou em sequência. */
function distribuir(n, total, idx) {
  if (idx && idx.length === n) return idx;
  const ini = Math.max(0, Math.min(idx?.length ? idx[0] : 0, total - n));
  return Array.from({ length: n }, (_, k) => Math.min(total - 1, ini + k));
}
const CAMPOS = [["prontuario", "Prontuário", 10], ["aluno", "Nº do aluno (RA)", 9], ["cpf", "CPF", 11], ["cns", "CNS", 15]];
/** Os 4 números (prontuário, RA, CPF e CNS) com os recortes e um dígito embaixo de cada quadradinho. Também no Conferir. */
function htmlNumeros(f) {
  return CAMPOS.map(([c, nome, n]) => {
    const s = f.sugestoes?.[c] || { texto: "" };
    return `<div class="os-campo ${s.auto ? "" : "atencao"}" data-c="${c}">
      <div class="os-campo-cab"><b>${nome}</b><span class="os-estado"></span></div>
      ${f.recortes?.[c] ? `<div class="os-recorte-caixa"><img src="${url(f.recortes[c])}" alt="Recorte do ${nome}" class="os-recorte"><div class="os-celulas" data-mantem-teclado></div></div>` : ""}
      <input data-lupa="${c}" data-teclado="${c === "cpf" || c === "cns" || c === "prontuario" ? c : "num"}" data-max="${n}" value="${esc(s.texto)}" class="os-num ${s.auto ? "auto" : ""}" aria-label="${nome}">
      ${s.lidaIA ? `<small class="os-outra">${s.fonte === "ia" ? "Lido pela IA" : "Lido pelo app"}${s.outra ? ` · a outra leitura deu <b>${esc(s.outra)}</b>` : ""}</small>` : ""}
    </div>`;
  }).join("");
}
/** Liga os campos de htmlNumeros dentro de `caixa`: estado do dígito verificador e os quadradinhos. */
function ligarNumeros(caixa, f) {
  const campos = [...caixa.querySelectorAll(".os-campo[data-c]")];
  const checar = () => campos.forEach(el => {
    const c = el.dataset.c, bruto = el.querySelector("input").value, v = bruto.replace(/\D/g, ""), st = el.querySelector(".os-estado");
    if (c === "prontuario" && /I/i.test(bruto)) { st.className = "os-estado"; st.textContent = v ? `Infantil · ${v.length} dígitos` : "Infantil"; return; }
    if (!v) { st.className = "os-estado"; st.textContent = "em branco"; return; }
    if (VALIDADOR[c]) { const ok = VALIDADOR[c](v.split("").map(Number)); st.className = `os-estado ${ok ? "ok" : "erro"}`; st.textContent = ok ? "dígito verificador ✓" : "não confere"; }
    else { st.className = "os-estado"; st.textContent = `${v.length} dígitos`; }
  });
  // cada dígito embaixo do seu quadradinho do recorte; tocar num dígito marca para trocar
  const desenharCelulas = (el) => {
    const box = el.querySelector(".os-celulas"); if (!box) return;
    const c = el.dataset.c, inp = el.querySelector("input"), s = f.sugestoes?.[c];
    const { pos, larg } = geometriaCaixas(c, s);
    // o "I" da clínica Infantil (sempre no fim, ex.: 0000I) também ocupa um quadradinho
    const ds = inp.value.replace(/[^0-9I]/gi, "").toUpperCase(), nums = [...ds].map((_, i) => i);
    const quadros = distribuir(nums.length, pos.length, s?.idx);
    const ativo = inp.classList.contains("ot-ativo") || document.activeElement === inp, cur = ativo ? teclado.posicao(inp) : -1;
    box.style.setProperty("--cw", `${Math.max(10, box.clientWidth * larg)}px`);
    box.innerHTML = pos.map((p, j) => {
      const k = quadros.indexOf(j), ch = k >= 0 ? ds[nums[k]] : "";
      const marcado = ativo && ((k >= 0 && nums[k] === cur) || (k < 0 && j === quadros[nums.length - 1] + 1 && cur >= ds.length));
      return `<button class="os-cel ${ch ? "" : "vazia"} ${marcado ? "sel" : ""}" data-j="${j}" style="left:${(p * 100).toFixed(2)}%;width:${(larg * 100).toFixed(2)}%" tabindex="-1">${ch || "·"}</button>`;
    }).join("");
    box.querySelectorAll(".os-cel").forEach(b => (b.onpointerdown = (e) => {
      e.preventDefault();
      const j = +b.dataset.j, k = quadros.indexOf(j);
      // dígito existente: troca ele; quadrado vazio: cursor depois dos dígitos que vêm antes
      const i = k >= 0 ? nums[k] : (() => { const antes = quadros.filter(q => q < j).length; return antes ? nums[antes - 1] + 1 : 0; })();
      teclado.sobrescrever(inp, i, e.pointerType !== "mouse");
      requestAnimationFrame(() => desenharCelulas(el));
    }));
  };
  const redesenhar = () => campos.forEach(desenharCelulas);
  campos.forEach(el => {
    const inp = el.querySelector("input");
    inp.addEventListener("input", () => { checar(); desenharCelulas(el); });
    ["selecao", "focus", "blur", "keyup", "click"].forEach(ev => inp.addEventListener(ev, () => requestAnimationFrame(redesenhar)));
    el.querySelector(".os-recorte")?.addEventListener("load", () => desenharCelulas(el));
  });
  if (campos.length) new ResizeObserver(redesenhar).observe(caixa);
  checar(); redesenhar();
  let insistiu = null;
  return {
    campos,
    valores: () => Object.fromEntries(campos.map(el => [el.dataset.c, el.querySelector("input").value])),
    /** CPF ou CNS que não confere: na 1ª vez avisa e não deixa seguir; confirmando de novo, segue assim. */
    podeSeguir() {
      const ruins = campos.filter(el => el.querySelector(".os-estado").classList.contains("erro"));
      const chaveRuins = ruins.map(el => el.querySelector("input").value).join("|");
      if (!ruins.length || insistiu === chaveRuins) return true;
      insistiu = chaveRuins;
      ruins.forEach(el => { const i = el.querySelector("input"); i.classList.remove("ot-tremer"); void i.offsetWidth; i.classList.add("ot-tremer"); });
      ruins[0].scrollIntoView({ block: "center", behavior: "smooth" });
      aviso(`${ruins.map(el => el.querySelector(".os-campo-cab b").textContent).join(" e ")} não confere no dígito verificador. Confira; para manter assim, salve de novo.`, 4500);
      return false;
    },
  };
}
/** Só os números (fichas que a IA ainda não leu): aberto pelo Conferir. */
async function telaConfirmar(t) {
  // as que a IA deste computador já leu vêm primeiro (as outras ainda podem ser lidas por ela; 29/10/2026)
  const lidaIA = (f) => Object.values(f.sugestoes || {}).some(s => s.lidaIA) ? 0 : 1;
  const fila = (await BD.todasFichas()).filter(f => f.etapa === "confirmar" && !f.leitura).sort((a, b) => lidaIA(a) - lidaIA(b) || a.criado.localeCompare(b.criado));
  const esperaIA = lidaIA(fila[0] || {}) === 1 && (await modoLocal());
  const voltar = `<button class="os-link os-voltar" data-acao="voltar-conf">← Conferir</button>`;
  if (!fila.length) { t.innerHTML = `${voltar}${vazio("🔢", "Nada para confirmar", "Os números lidos com segurança (dígito verificador conferido) já viraram códigos sozinhos.")}`; t.querySelector('[data-acao="voltar-conf"]').onclick = () => ir("conferir"); return; }
  const f = await BD.comImagens(fila[0], ["recortes"]), mNum = await metaDoDia(await BD.todasFichas());
  const semRecorteN = f.recortes && Object.keys(f.recortes).length ? 0 : (await fichasSemRecorte()).length;
  t.innerHTML = `
    ${voltar}
    <div class="os-cab"><h2>Só os números</h2><span class="os-cab-dir"><span class="os-pilula">${fila.length} na fila</span>${mNum.num.meta ? chipMeta(mNum, "num") : ""}</span></div>
    <p class="os-sub">Fichas que ainda não foram lidas: confira só os números agora, se quiser (o resto da ficha você confere depois da leitura). Os recortes e os números ficam só aqui e são apagados ao confirmar.</p>
    ${esperaIA ? `<p class="os-sub os-aviso-ia">${IC.pc} A IA deste computador ainda não leu os números desta ficha: os de baixo são da leitura antiga do app. Se preferir, espere a leitura da noite (as que ela confere sozinha nem aparecem aqui).</p>` : ""}
    <section class="os-cartao os-conf">
      <small class="os-arq">${esc(f.arquivo)}</small>
      ${f.recortes && Object.keys(f.recortes).length ? "" : `<div class="os-pasta-salva">${IC.pasta}<span><b>Os recortes desta ficha se perderam</b><small>${semRecorteN} ${semRecorteN === 1 ? "ficha está" : "fichas estão"} assim (erro do app em 22/10). Refaça a partir da pasta das fotos para conferir os números.</small></span><button class="os-botao" data-acao="refazer-recortes">Refazer</button></div>`}
      ${htmlNumeros(f)}
      <div class="os-botoes"><button class="os-botao" data-acao="ok">Confirmar e próxima</button><button class="os-botao sec" data-acao="pular">Depois</button></div>
    </section>`;
  t.querySelector('[data-acao="voltar-conf"]').onclick = () => ir("conferir");
  teclado.preparar(t);
  const N = ligarNumeros(t.querySelector(".os-conf"), f);
  // no notebook o cursor já vai para o primeiro número a conferir; no celular, o teclado só abre ao tocar no campo
  if (matchMedia("(pointer: fine)").matches) {
    const primeiro = N.campos.find(el => !f.sugestoes?.[el.dataset.c]?.auto)?.querySelector("input");
    primeiro?.focus(); primeiro?.select();
  }
  const confirmar = async () => {
    if (!N.podeSeguir()) return;
    const vals = N.valores();
    // a ficha atual do banco (não a da hora em que a tela abriu): o envio ou a leitura podem tê-la mudado no meio
    const atual = await BD.pegarFicha(f.id);
    if (atual && atual.etapa === "confirmar") { atual.sugestoes ||= f.sugestoes; await BD.salvarFicha(await fecharNumeros(atual, vals, await chave())); }
    telaConfirmar(t); atualizarBadges(); comemorarMeta("num").catch(() => {});
  };
  t.querySelector('[data-acao="ok"]').onclick = confirmar;
  teclado.configurar({ aoConcluir: confirmar, rotuloConcluir: "Confirmar" });
  t.querySelectorAll(".os-num").forEach(i => i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmar(); } }));
  t.querySelector('[data-acao="pular"]').onclick = async () => { const a = await BD.pegarFicha(f.id); if (a) { a.criado = new Date().toISOString(); await BD.salvarFicha(a); } telaConfirmar(t); };
  t.querySelector('[data-acao="refazer-recortes"]')?.addEventListener("click", () => refazerCopias());
}

// ---------------- Leitura ----------------
async function telaLeitura(t) {
  // onde as fichas são lidas (28/10/2026): na nuvem (fila cifrada no GitHub) ou neste computador (leitor local, Ollama)
  const modo = await lerModo(), nativo = !!opts.pasta, pode = !nativo && podeLocal(), local = pode && modo.modo === "local";
  const fs0 = await BD.todasFichas();
  if (local) return telaLeituraLocal(t, fs0, modo);
  const fs = fs0, prontas = fs.filter(f => (f.etapa === "pronta" || (f.etapa === "confirmar" && !f.leitura)) && !f.enviada);
  const api = (await BD.lerCfg("api")) || { chave: "", modelo: "claude-sonnet-5-5" };
  const cred = await credenciais(), pend = paraEnviar(fs), naFila = fs.filter(f => f.enviada && !f.leitura).length;
  const ultima = await BD.lerCfg("ultimaBusca"), autoEnviar = (await BD.lerCfg("autoEnviar")) !== false;
  const est = cred ? await lerEstado() : null, maximo = est?.maximo_por_noite || (await BD.lerCfg("maximoNoite")) || 150;
  const pendentes = pend.length + naFila, limite = est?.limite || 40, noites = Math.ceil(pendentes / limite);
  const ult0 = est?.andamento ? { ...est.andamento, agora: true } : est?.historico?.at(-1);
  const ult = ult0 && !ult0.agora ? { ...ult0, lidas: Math.max(0, (ult0.lidas || 0) - (ult0.descartadas || 0)) } : ult0;
  const dm = (iso) => iso ? new Date(String(iso).length === 10 ? iso + "T12:00" : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  const ritmo = cred ? `<div class="os-ritmo">
      <p><b>Até ${limite} fichas por noite</b> (ajusta sozinho pelo que as noites conseguem ler; teto ${maximo}).${pendentes ? ` Faltam ${pendentes}: cerca de ${noites} ${noites === 1 ? "noite" : "noites"}.` : ""}</p>
      ${ult ? `<p class="os-sub">${ult.agora ? `Lendo agora: ${ult.lidas || 0} de ${ult.abertas}` : ult.terminou === false ? `Noite de ${dm(ult.data)}: parou depois de ${ult.lidas} (limite de uso); o ritmo foi reduzido` : `Última noite (${dm(ult.data)}): ${ult.lidas} ${ult.lidas === 1 ? "lida" : "lidas"}${ult.minutos != null ? ` em ${ult.minutos} min` : ""}`}.</p>` : ""}
      <p class="os-sub">A fila guarda até ${tamanhoDaFila(est)} fichas deste aparelho; as outras esperam aqui e sobem sozinhas quando abrir vaga (ao abrir o app ou o Scanner).</p>
      <label class="os-campo-txt os-maximo">Máximo por noite<span class="os-sel"><select class="sel-maximo">${[40, 60, 100, 150, 200, 300].map(n => `<option value="${n}" ${n === maximo ? "selected" : ""}>${n} fichas</option>`).join("")}</select></span></label>
    </div>` : "";
  t.innerHTML = `
    <div class="os-cab"><h2>IA na nuvem</h2><span class="os-pilula">${cred ? `${naFila} na fila` : `${prontas.length} aguardando`}</span></div>
    ${cartaoModo(false, pode, nativo)}
    <section class="os-cartao os-auto">
      <h3>${IC.lua} Leitura automática</h3>
      <p class="os-sub">As cópias sobem <b>cifradas</b> para o seu repositório e a tarefa agendada lê de madrugada (por volta das 3h). As respostas chegam sozinhas quando você abre o Scanner, e as fichas vão para o Conferir.</p>
      ${ritmo}
      ${cred ? `
      <div class="os-auto-num">${[[pend.length, "aguardando envio"], [naFila, "na fila da madrugada"], [fs.filter(f => f.leitura).length, "já lidas"]].map(([v, n], k) => `<div style="--k:${k}">${num(v, `leitura-${k}`)}<small>${n}</small></div>`).join("")}</div>
      <label class="os-check"><input type="checkbox" class="auto-env" ${autoEnviar ? "checked" : ""}> Enviar sozinho, aos poucos</label>
      <div class="os-botoes"><button class="os-botao" data-acao="enviar" ${pend.length && naFila < tamanhoDaFila(est) ? "" : "disabled"}>${IC.nuvem}<span>Completar a fila agora</span></button><button class="os-botao sec" data-acao="buscar">${IC.importar}<span>Buscar respostas</span></button></div>
      <div class="os-progresso os-prog-auto" hidden><div class="os-barra"><i></i></div><p></p><button class="os-link os-parar">Parar</button></div>
      <p class="os-sub os-ultima">${ultima ? `Última busca: ${new Date(ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Ainda não buscou respostas."}${cred.doApp ? " · token do Órbita" : ` · ${esc(cred.repo)}`}</p>
      ${cred.doApp ? "" : `<button class="os-link" data-acao="trocar-token">Trocar token</button>`}` : `
      <label class="os-campo-txt">Token do GitHub<input type="password" class="gh-token" placeholder="github_pat_..." autocomplete="off"></label>
      <label class="os-campo-txt">Repositório<input class="gh-repo" value="${REPO_PADRAO}" autocomplete="off"></label>
      <button class="os-botao" data-acao="salvar-token">Salvar</button>
      <p class="os-sub">Use o mesmo token do Órbita (Ajustes do Órbita, a engrenagem da Home). Ele fica guardado só neste computador.</p>`}
    </section>
    ${pode ? await cartaoValidacao(fs, true) : ""}
    <details class="os-outras"${cred ? "" : " open"}><summary>Outras formas de leitura</summary>
    <section class="os-cartao os-explica">
      <div class="os-tres">${["Ficha sem identificação", "Endereço, sozinho"].map((n, k) => `<div style="--k:${k}"><span>${["🩺", "📍"][k]}</span><small>${n}</small></div>`).join("")}</div>
      <p class="os-sub">Cada ficha vira dois pedidos separados, sem nada que os ligue fora deste aparelho. Do endereço só volta o bairro, o município e a rua; os nomes do aluno e do professor não saem do aparelho.</p>
    </section>
    <section class="os-cartao">
      <h3>${IC.pacote} Pacote para leitura</h3>
      <p class="os-sub">Gera um .zip com as cópias e as instruções. Leve para a leitura (por exemplo, numa conversa com o Claude) e importe o respostas.json que voltar.</p>
      <div class="os-linha"><label>Fichas no pacote <input type="number" min="1" max="500" value="${Math.min(50, prontas.length || 50)}" class="os-qtd"></label><button class="os-botao" data-acao="pacote" ${prontas.length ? "" : "disabled"}>Gerar pacote</button></div>
      <label class="os-botao sec">${IC.importar}<span>Importar respostas</span><input type="file" accept=".json,.zip" hidden class="in-resp"></label>
    </section>
    <section class="os-cartao">
      <h3>${IC.raio} Ler direto pela API</h3>
      <p class="os-sub">Usa a sua chave da API da Anthropic (fica só neste aparelho). Cada ficha faz duas chamadas.</p>
      <label class="os-campo-txt">Chave da API<input type="password" value="${esc(api.chave)}" class="api-chave" placeholder="sk-ant-..." autocomplete="off"></label>
      <label class="os-campo-txt">Modelo<input value="${esc(api.modelo)}" class="api-modelo"></label>
      <div class="os-linha"><label>Quantas <input type="number" min="1" max="2000" value="${Math.min(20, prontas.length || 20)}" class="api-qtd"></label><button class="os-botao" data-acao="api" ${prontas.length ? "" : "disabled"}>Ler agora</button></div>
      <div class="os-progresso os-prog-api" hidden><div class="os-barra"><i></i></div><p></p><button class="os-link os-parar">Parar</button></div>
    </section></details>`;
  ligarAuto(t);
  ligarModo(t);
  if (pode) { ligarPasta(t); ligarValidacao(t, fs); }
  t.querySelector('[data-acao="pacote"]').onclick = async () => {
    const qtd = +t.querySelector(".os-qtd").value || 50, lote = prontas.slice(0, qtd), arqs = [];
    for (const f0 of lote) { const f = await BD.comImagens({ ...f0 }, ["ficha", "endereco"]); arqs.push({ nome: `${f.pacote}-ficha.jpg`, dados: f.imgFicha }, { nome: `${f.pacote}-endereco.jpg`, dados: f.imgEndereco }); }
    arqs.push({ nome: "LEIA-ME.txt", dados: LEIA_ME(lote.length) });
    arqs.push({ nome: "modelo-respostas.json", dados: JSON.stringify(Object.fromEntries(lote.map(f => [f.pacote, { ficha: {}, endereco: {} }])), null, 1) });
    baixar(await zip(arqs), `odontoscan-pacote-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.zip`);
    aviso(`Pacote com ${lote.length} fichas gerado.`);
  };
  t.querySelector(".in-resp").onchange = async (e) => {
    const arq = e.target.files[0];
    let dados;
    try {
      if (/\.zip$/i.test(arq.name)) { const j = (await lerZip(arq)).find(x => /\.json$/i.test(x.nome)); dados = JSON.parse(new TextDecoder().decode(j.dados)); }
      else dados = JSON.parse(await arq.text());
    } catch { return aviso("Não consegui ler o arquivo de respostas."); }
    const k = await chave(), porPacote = new Map(fs.map(f => [f.pacote, f]));
    let n = 0;
    for (const [cod, resp] of Object.entries(dados)) {
      const f = porPacote.get(cod); if (!f || !resp?.ficha) continue;
      await BD.salvarFicha(await aplicarLeitura(f, resp, k)); n++;
    }
    aviso(`${n} fichas importadas.`); ir("revisar");
  };
  t.querySelector('[data-acao="api"]').onclick = async () => {
    const cfg = { chave: t.querySelector(".api-chave").value.trim(), modelo: t.querySelector(".api-modelo").value.trim() || "claude-sonnet-5-5" };
    if (!cfg.chave) return aviso("Informe a chave da API.");
    await BD.gravarCfg("api", cfg);
    const qtd = +t.querySelector(".api-qtd").value || 20, lote = prontas.slice(0, qtd), k = await chave();
    const box = t.querySelector(".os-prog-api"), barra = box.querySelector("i"), txt = box.querySelector("p");
    box.hidden = false; parar = false; box.querySelector(".os-parar").onclick = () => (parar = true);
    let ok = 0, falhas = 0;
    for (const [i, f] of lote.entries()) {
      if (parar) break;
      txt.textContent = `${i + 1} de ${lote.length}`; barra.style.width = `${(i / lote.length) * 100}%`;
      try {
        await BD.comImagens(f, ["ficha", "endereco"]);
        const [ficha, endereco] = await Promise.all([perguntarApi(cfg, f.imgFicha, PROMPT_FICHA), perguntarApi(cfg, f.imgEndereco, PROMPT_ENDERECO)]);
        await BD.salvarFicha(await aplicarLeitura(f, { ficha, endereco }, k)); ok++;
      } catch (e) { falhas++; txt.textContent = String(e.message || e); if (/401|403/.test(String(e))) break; }
    }
    barra.style.width = "100%"; aviso(`${ok} lidas${falhas ? `, ${falhas} com erro` : ""}.`, 4000); atualizarBadges();
  };
}

function ligarAuto(t) {
  t.querySelector('[data-acao="salvar-token"]')?.addEventListener("click", async () => {
    const tok = t.querySelector(".gh-token").value.trim();
    if (!tok) return aviso("Cole o token do GitHub.");
    await salvarCredenciais(tok, t.querySelector(".gh-repo").value);
    aviso("Token salvo neste computador."); ir("leitura");
  });
  t.querySelector('[data-acao="trocar-token"]')?.addEventListener("click", async () => { await BD.gravarCfg("github", null); ir("leitura"); });
  t.querySelector(".auto-env")?.addEventListener("change", (e) => BD.gravarCfg("autoEnviar", e.target.checked));
  t.querySelector(".sel-maximo")?.addEventListener("change", async (e) => {
    try { await gravarMaximo(+e.target.value); aviso(`A partir da próxima noite, no máximo ${e.target.value} fichas.`, 3500); }
    catch (er) { aviso(er.message, 5000); }
  });
  t.querySelector('[data-acao="buscar"]')?.addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const k = await chave();
      const { novas, naFila } = await buscarRespostas(async (f, resp) => BD.salvarFicha(await aplicarLeitura(f, resp, k)));
      aviso(novas ? `${novas} ${novas === 1 ? "ficha lida chegou" : "fichas lidas chegaram"}.` : `Nenhuma resposta nova${naFila ? `; ${naFila} ainda na fila` : ""}.`, 3500);
      ir(novas ? "revisar" : "leitura");
    } catch (er) { aviso(er.message, 5000); b.disabled = false; }
  });
  t.querySelector('[data-acao="enviar"]')?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const box = t.querySelector(".os-prog-auto"), barra = box.querySelector("i"), txt = box.querySelector("p");
    box.hidden = false; parar = false; box.querySelector(".os-parar").onclick = () => (parar = true);
    try {
      const r = await completarFila({ parar: () => parar, aoProgresso: (i, tot) => { txt.textContent = `Cifrando e enviando: ${Math.min(i + 1, tot)} de ${tot}`; barra.style.width = `${tot ? (i / tot) * 100 : 100}%`; } });
      if (r?.pausado) aviso("O GitHub pediu uma pausa nos envios; o resto sobe sozinho daqui a pouco.", 4500);
      else { const n = r?.enviadas || 0; aviso(`${n} ${n === 1 ? "ficha enviada" : "fichas enviadas"} para a fila da madrugada${r?.esperando ? `; ${r.esperando} esperam vaga no aparelho` : ""}${r?.puladas ? `; ${r.puladas} sem cópia no aparelho (Refazer, no Lote)` : ""}.`, 6000); }
    } catch (er) { aviso(er.message, 5000); }
    ir("leitura");
  });
}

// ---------------- Leitura neste computador (modo local, 28/10/2026) ----------------
// No computador do laboratório, as fichas são lidas por um modelo no próprio computador (Ollama, pelo leitor de
// tools/odontoscan/local) e nada sai dele. O OdontoScan.html e o leitor trocam arquivos por uma pasta de trabalho.
function cartaoModo(local, pode, nativo) {
  const op = (m, ic, titulo, txt, on, ok = true) => `<button class="os-modo-op${on ? " on" : ""}" role="radio" aria-checked="${on}" data-modo="${m}" ${ok ? "" : "disabled"}><i aria-hidden="true">${ic}</i><span><b>${titulo}</b><small>${txt}</small></span></button>`;
  return `<section class="os-cartao os-modo">
      <h3>${IC.alvo} Onde as fichas são lidas</h3>
      <div class="os-modo-ops" role="radiogroup" aria-label="Onde as fichas são lidas">
        ${op("nuvem", IC.nuvem, "Na nuvem", "O Claude lê de madrugada a fila cifrada no GitHub", !local)}
        ${op("local", IC.pc, "Neste computador", nativo ? "Só no OdontoScan.html, no Chrome do computador" : pode ? "Um modelo no próprio computador (Ollama); nada sai daqui" : "Precisa do Chrome ou do Edge no computador", local, pode)}
      </div>
      ${local ? `<p class="os-sub">As cópias vão para a pasta de trabalho e o leitor as lê à noite, com o computador ligado. Nada vai para a internet: nem GitHub, nem chaves, nem a fila cifrada.</p>`
        : pode ? `<p class="os-sub">Antes de trocar, teste a leitura local com fichas que você já revisou (cartão <b>Testar a leitura local</b>, abaixo): a troca vale para as próximas fichas.</p>` : ""}
    </section>`;
}
function ligarModo(t) {
  t.querySelectorAll(".os-modo-op:not(.on):not([disabled])").forEach(b => (b.onclick = async () => {
    const paraLocal = b.dataset.modo === "local";
    const ok = await dialogo(raiz, paraLocal ? {
      titulo: "Ler neste computador?",
      html: `<p class="os-sub">A partir de agora, as fichas vão para a <b>pasta de trabalho</b> deste computador e o leitor local as lê à noite. Nada vai para o GitHub.</p>
        <p class="os-sub">As que estavam na fila da nuvem e ainda não foram lidas voltam a esperar e entram na fila daqui. Depois de trocar, peça para pausar a tarefa agendada <b>Leitura do OdontoScan</b> (a da nuvem).</p>`,
      botoes: [{ texto: "Ler neste computador", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
    } : {
      titulo: "Voltar para a nuvem?",
      html: `<p class="os-sub">As cópias voltam a subir <b>cifradas</b> para o GitHub (precisa do token) e a tarefa da madrugada as lê. As que estão na fila local e ainda não foram lidas voltam a esperar envio.</p>`,
      botoes: [{ texto: "Voltar para a nuvem", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
    });
    if (!ok) return;
    await definirModo(paraLocal ? "local" : "nuvem");
    aviso(paraLocal ? "Leitura neste computador ligada." : "Leitura na nuvem ligada.", 3500);
    await ir("leitura");
    if (paraLocal && (await situacaoPasta()).estado === "nenhuma") aviso("Agora escolha a pasta de trabalho (a mesma do leitor).", 5000);
  }));
}
/** Linha da pasta de trabalho (escolher, liberar o acesso de novo ou trocar). */
async function linhaPasta() {
  const p = await situacaoPasta();
  const [tit, txt, bot] = p.estado === "ok" ? [`Pasta de trabalho: ${esc(p.nome)}`, "O leitor usa a mesma pasta (fila, respostas e o teste).", "Trocar"]
    : p.estado === "pedir" ? [`Pasta de trabalho: ${esc(p.nome)}`, "O Chrome pede para liberar o acesso de novo (escolha \"Permitir sempre\", se aparecer).", "Liberar"]
    : ["Escolha a pasta de trabalho", "Uma pasta vazia neste computador, como Documentos\\OdontoScan-trabalho. É nela que o leitor procura as fichas.", "Escolher"];
  return `<div class="os-pasta-salva os-pasta-trab${p.estado === "ok" ? "" : " falta"}">${IC.pasta}<span><b>${tit}</b><small>${txt}</small></span><button class="os-botao${p.estado === "ok" ? " sec" : ""}" data-acao="pasta-trab" data-estado="${p.estado}">${bot}</button></div>`;
}
function ligarPasta(t) {
  t.querySelector('[data-acao="pasta-trab"]')?.addEventListener("click", async (e) => {
    const est = e.currentTarget.dataset.estado;
    try {
      const dir = await pastaTrabalho(est === "pedir" ? { pedir: true } : { escolher: true });
      if (!dir) return;
      const m = await lerModo();
      if (m.modo === "local") { await gravarMaximo(m.limite || 0); completarFila().then(() => { if (aba === "ia") ir("ia"); }).catch(er => aviso(er.message, 5000)); }
      aviso(`Pasta de trabalho: ${dir.name}.`, 3000);
      ir("leitura");
    } catch (er) { aviso(`Não consegui usar essa pasta: ${er.message}`, 5000); }
  });
}

async function telaLeituraLocal(t, fs, modo) {
  const pend = paraEnviar(fs), naFila = fs.filter(f => f.enviada && !f.leitura).length, lidas = fs.filter(f => f.leitura).length;
  const pasta = await situacaoPasta(), ok = pasta.estado === "ok";
  if (ok) gravarControleGithub(await credResumo()).catch(() => {}); // a pausa pelo celular usa o mesmo token
  const est = ok ? await lerEstado().catch(() => null) : null, autoEnviar = (await BD.lerCfg("autoEnviar")) !== false, ultima = await BD.lerCfg("ultimaBusca");
  const dm = (iso) => iso ? new Date(String(iso).length === 10 ? iso + "T12:00" : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
  const u = est?.historico?.at(-1), agora = lendoAgora(est) ? est.andamento : null;
  const porFicha = (h) => h?.lidas && h.minutos != null ? ` (${Math.max(1, Math.round((h.minutos * 60) / h.lidas))} s por ficha)` : "";
  // a proteção do computador (29/10/2026): temperatura máxima da placa, pausas pelo calor e o motivo de ter parado
  const MOTIVOS = { "placa quente demais": "parou: a placa não esfriou (confira a ventilação)", "pouco espaço no disco": "parou: pouco espaço no disco", "falhas seguidas": "parou: muitas fichas seguidas sem leitura (rode o testar.bat)", "Ollama parou": "parou: o Ollama não respondeu" };
  const prot = (h) => [h?.temp_max != null ? `placa até ${h.temp_max} °C` : "", h?.pausas_calor ? `${h.pausas_calor} ${h.pausas_calor === 1 ? "pausa" : "pausas"} pelo calor` : "", MOTIVOS[h?.motivo] || ""].filter(Boolean).join(" · ");
  const pausa = agora?.pausa ? ` · <b>em pausa</b> (${esc({ calor: "placa quente, esfriando", descanso: "descanso de 10 min", "fila vazia": "esperando fichas", "limite do dia": "limite do dia" }[agora.pausa.motivo] || agora.pausa.motivo)})` : "";
  const leitor = !ok ? "" : agora ? `<p><b>Lendo agora:</b> ${fmt(agora.lidas || 0)} de ${fmt(agora.abertas || 0)}${est.modelo ? ` · ${esc(est.modelo)}` : ""}${pausa}${prot(agora) ? ` · ${prot(agora)}` : ""}</p>`
    : u ? `<p>${u.terminou === false ? `Leitura de ${dm(u.data)}: parou depois de ${fmt(u.lidas || 0)} (computador desligado ou leitor interrompido)` : `Última leitura (${dm(u.data)}): ${fmt(u.lidas || 0)} ${u.lidas === 1 ? "lida" : "lidas"}${u.minutos != null ? ` em ${fmt(u.minutos)} min${porFicha(u)}` : ""}`}${u.modelo || est.modelo ? ` · ${esc(u.modelo || est.modelo)}` : ""}${prot(u) ? ` · ${prot(u)}` : ""}.</p>`
    : `<p>O leitor ainda não rodou nesta pasta. Ele começa às 19h nos dias úteis (o dia todo nos fins de semana e feriados), pela tarefa do Windows, ou com <b>ler-agora.bat</b>.</p>`;
  const lim = modo.limite || 0;
  // quando termina: pela leitura das últimas noites e pelo seu ritmo de conferência (últimos 14 dias)
  const dias14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d.toISOString().slice(0, 10); });
  const revDia = dias14.map(d => fs.filter(f => f.etapa === "revisada" && String(f.revisadaEm || "").slice(0, 10) === d).length);
  const pv = ok ? previsaoTermino({ noites: (est?.historico || []).map(h => ({ data: h.data, lidas: h.lidas || 0 })), faltamLer: fs.filter(f => !f.leitura && f.etapa !== "erro").length, revisadasPorDia: revDia, faltamConferir: fs.filter(f => f.etapa !== "revisada" && f.etapa !== "erro").length }) : null;
  t.innerHTML = `
    <div class="os-cab"><h2>IA deste computador</h2><span class="os-pilula">${fmt(naFila)} na fila local</span></div>
    ${cartaoModo(true, true, false)}
    <section class="os-cartao os-auto">
      <h3>${IC.lua} Leitura neste computador</h3>
      <p class="os-sub">Os pedaços das fichas vão para a pasta de trabalho e o leitor os lê nos dias úteis das 19h às 7h15 e, nos fins de semana e feriados, o dia todo, com pausas se a placa de vídeo esquentar. As respostas entram quando você abre o Scanner, e as fichas vão para o Conferir.</p>
      ${await linhaPasta()}
      ${ok ? `<div class="os-ritmo">${leitor}
        <label class="os-campo-txt os-maximo">Máximo por noite<span class="os-sel"><select class="sel-maximo">${[0, 50, 100, 200, 400, 800].map(n => `<option value="${n}" ${n === lim ? "selected" : ""}>${n ? `${n} fichas` : "Sem limite"}</option>`).join("")}</select></span></label></div>
      ${pv ? htmlPrevisao(pv) : ""}
      <div class="os-auto-num">${[[pend.length, "aguardando"], [naFila, "na fila local"], [lidas, "já lidas"]].map(([v, n], k) => `<div style="--k:${k}">${num(v, `leitura-${k}`)}<small>${n}</small></div>`).join("")}</div>
      <label class="os-check"><input type="checkbox" class="auto-env" ${autoEnviar ? "checked" : ""}> Gravar na fila sozinho</label>
      <div class="os-botoes"><button class="os-botao" data-acao="enviar" ${pend.length ? "" : "disabled"}>${IC.pasta}<span>Gravar na fila agora</span></button><button class="os-botao sec" data-acao="buscar">${IC.importar}<span>Buscar respostas</span></button></div>
      <div class="os-progresso os-prog-auto" hidden><div class="os-barra"><i></i></div><p></p><button class="os-link os-parar">Parar</button></div>
      <p class="os-sub os-ultima">${ultima ? `Última busca: ${new Date(ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Ainda não buscou respostas."} · nada sai deste computador</p>` : ""}
    </section>
    ${cartaoImagensLeitura(fs)}
    ${ok ? await cartaoMelhorias(fs) : ""}
    ${await cartaoValidacao(fs, false)}
    ${await cartaoResumoCelular()}
    ${await cartaoRecomecar(fs)}`;
  ligarModo(t); ligarPasta(t); ligarValidacao(t, fs); ligarRecomecar(t); ligarResumoCelular(t); ligarImagensLeitura(t); ligarMelhorias(t, fs);
  t.querySelector(".auto-env")?.addEventListener("change", (e) => BD.gravarCfg("autoEnviar", e.target.checked));
  t.querySelector(".sel-maximo")?.addEventListener("change", async (e) => {
    try { await gravarMaximo(+e.target.value); aviso(+e.target.value ? `A partir da próxima noite, no máximo ${e.target.value} fichas.` : "Sem limite: o leitor lê tudo o que couber na noite.", 3500); }
    catch (er) { aviso(er.message, 5000); }
  });
  t.querySelector('[data-acao="buscar"]')?.addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const k = await chave();
      const { novas, naFila: n } = await buscarRespostas(async (f, resp) => BD.salvarFicha(await aplicarLeitura(f, resp, k)));
      aviso(novas ? `${novas} ${novas === 1 ? "ficha lida chegou" : "fichas lidas chegaram"}.` : `Nenhuma resposta nova${n ? `; ${n} ainda na fila local` : ""}.`, 3500);
      ir(novas ? "revisar" : "leitura");
    } catch (er) { aviso(er.message, 5000); b.disabled = false; }
  });
  t.querySelector('[data-acao="enviar"]')?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const box = t.querySelector(".os-prog-auto"), barra = box.querySelector("i"), txt = box.querySelector("p");
    box.hidden = false; parar = false; box.querySelector(".os-parar").onclick = () => (parar = true);
    try {
      const r = await completarFila({ parar: () => parar, aoProgresso: (i, tot) => { txt.textContent = `Gravando na pasta de trabalho: ${Math.min(i + 1, tot)} de ${tot}`; barra.style.width = `${tot ? (i / tot) * 100 : 100}%`; } });
      if (!r) aviso("Libere a pasta de trabalho primeiro.", 4000);
      else { const n = r.enviadas || 0; aviso(`${fmt(n)} ${n === 1 ? "ficha gravada" : "fichas gravadas"} na fila local${r.puladas ? `; ${r.puladas} sem cópia no computador (Refazer, no Lote)` : ""}.`, 5000); }
    } catch (er) { aviso(er.message, 5000); }
    ir("leitura");
  });
}

// ----- resumo para o celular (29/10/2026): só números agregados, publicados no repositório -----
async function resumoAtual() {
  const fs = await BD.todasFichas();
  const resPac = resumoPacientes(linhaDoTempo(fs, ligarPacientes(fs)));
  const estado = await lerEstado().catch(() => null), metas = await metaDoDia(fs);
  return montarResumo(fs, { resPac, estado, metas });
}
let resumoTimer = null, resumoRodando = false;
/** Publica o resumo um pouco depois das mudanças (e no máximo a cada 3 min), se o modo é local e há token. */
function agendarResumo(atraso = 90000) {
  clearTimeout(resumoTimer);
  resumoTimer = setTimeout(async () => {
    if (resumoRodando || importando || !navigator.onLine || !(await modoLocal()) || !(await credResumo())) return;
    if ((await BD.lerCfg("resumoAuto")) === false) return;
    const ult = await BD.lerCfg("resumoPublicado");
    if (ult && Date.now() - Date.parse(ult.em) < 180000) { agendarResumo(180000); return; }
    resumoRodando = true;
    try { await publicarResumo(await resumoAtual()); } catch (e) { console.warn("OdontoScan: resumo", e.message); await BD.gravarCfg("resumoErro", { em: new Date().toISOString(), msg: e.message }); }
    finally { resumoRodando = false; }
  }, atraso);
}
async function cartaoResumoCelular() {
  const cred = await credResumo(), ult = await BD.lerCfg("resumoPublicado"), err = await BD.lerCfg("resumoErro"), auto = (await BD.lerCfg("resumoAuto")) !== false;
  const q = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `<section class="os-cartao os-resumo-cel">
      <h3>${IC.painel} Resumo para o celular</h3>
      <p class="os-sub">O celular mostra os resultados (tabelas, gráficos, estatísticas e o andamento) a partir de um resumo <b>só com números agregados</b> que este computador publica no repositório: nenhuma ficha, código de paciente ou imagem sai daqui. Com o token, o leitor também atende à <b>pausa pelo celular</b> e conta a ele se está lendo ou pausado.</p>
      ${cred ? `<p class="os-sub">${ult ? `Último resumo: ${q(ult.em)} (${fmt(ult.total)} fichas, ${fmt(ult.conferidas)} conferidas).` : "Ainda não publicou."}${err && (!ult || err.em > ult.em) ? ` <b>Erro em ${q(err.em)}:</b> ${esc(err.msg)}` : ""}</p>
        <label class="os-check"><input type="checkbox" class="resumo-auto" ${auto ? "checked" : ""}> Publicar sozinho (alguns minutos depois de cada mudança, com o OdontoScan aberto)</label>
        <div class="os-botoes"><button class="os-botao" data-acao="resumo-publicar">Publicar agora</button><button class="os-link" data-acao="resumo-token">Trocar o token</button></div>`
      : `<p class="os-sub">Cole um token do GitHub com acesso ao repositório (Contents: leitura e escrita), o mesmo tipo do app no celular.</p>
        <label class="os-campo-txt">Token do GitHub<input type="password" class="resumo-tok" placeholder="github_pat_..." autocomplete="off"></label><div class="os-botoes"><button class="os-botao" data-acao="resumo-salvar">Salvar</button></div>`}
    </section>`;
}
function ligarResumoCelular(t) {
  const sec = t.querySelector(".os-resumo-cel"); if (!sec) return;
  sec.querySelector('[data-acao="resumo-salvar"]')?.addEventListener("click", async () => {
    const v = sec.querySelector(".resumo-tok").value.trim(); if (!v) return;
    await salvarCredResumo(v); await gravarControleGithub(await credResumo()).catch(() => {}); aviso("Token salvo neste computador.", 2500); ir("leitura");
  });
  sec.querySelector('[data-acao="resumo-token"]')?.addEventListener("click", async () => { await salvarCredResumo(null); await gravarControleGithub(null).catch(() => {}); ir("leitura"); });
  sec.querySelector(".resumo-auto")?.addEventListener("change", (e) => BD.gravarCfg("resumoAuto", e.target.checked));
  sec.querySelector('[data-acao="resumo-publicar"]')?.addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await publicarResumo(await resumoAtual()); aviso("Resumo publicado: o celular já pode ver.", 3500); }
    catch (er) { await BD.gravarCfg("resumoErro", { em: new Date().toISOString(), msg: er.message }); aviso(er.message, 5000); }
    ir("leitura");
  });
}

// ----- recomeçar a leitura do zero (29/10/2026): as revisões da nuvem viram só gabarito do teste -----
const afetadaRecomeco = (f) => f.etapa !== "erro" && !!(f.leitura || f.enviada || f.revisao || f.revisadaEm);
// ---- imagens para a leitura em pedaços (29/10/2026) ----
// Fichas processadas antes não têm o alto da ficha até a borda da foto (imgTopo) nem a ficha inteira: sem eles, o pedaço
// do cabeçalho tem só 1 cm acima do quadro, e o horário, a cor e a clínica escritos mais acima se perdem.
const semImagensLeitura = (fs) => fs.filter(f => f.etapa !== "erro" && !f.imgs?.topo);
// exemplos da própria letra e "ler de novo" (04/11/2026, sugestões aceitas pelo Alediov depois do 1º teste da leitura local)
async function cartaoMelhorias(fs) {
  const ex = await lerExemplos(), n = lidasNaoConferidas(fs).length;
  const quando = ex?.em ? new Date(ex.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null;
  return `<section class="os-cartao os-melhorias">
      <h3>${IC.alvo} Exemplos e releitura</h3>
      <p class="os-sub">${ex?.n?.total ? `<b>${fmt(ex.n.total)} exemplos da sua letra</b> (${fmt(ex.n.data)} datas, ${fmt(ex.n.nascimento)} nascimentos, ${fmt(ex.n.procedimento + ex.n.vazia)} linhas de procedimento), de fichas já conferidas e fora do teste; atualizados em ${quando}. O leitor mostra alguns antes de cada pedaço.` : "Ainda sem exemplos da sua letra: eles saem das fichas já conferidas (fora as do teste)."}</p>
      <div class="os-botoes"><button class="os-botao sec" data-acao="refazer-ex">${ex?.n?.total ? "Refazer os exemplos" : "Gravar os exemplos"}</button>
        <button class="os-botao sec" data-acao="ler-de-novo" ${n ? "" : "disabled"}>Ler de novo as lidas e não conferidas (${fmt(n)})</button></div>
      <div class="os-progresso os-prog-mel" hidden><div class="os-barra"><i></i></div><p></p></div>
    </section>`;
}
function ligarMelhorias(t, fs) {
  const box = t.querySelector(".os-prog-mel"); if (!box) return;
  const prog = (rot) => (i, tot) => { box.hidden = false; box.querySelector("p").textContent = `${rot}: ${fmt(i)} de ${fmt(tot)}`; box.querySelector("i").style.width = `${tot ? (i / tot) * 100 : 100}%`; };
  t.querySelector('[data-acao="refazer-ex"]')?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { const r = await prepararExemplos(await BD.todasComLixeira(), { forcar: true, aoProgresso: prog("Procurando exemplos") }); aviso(r ? `${fmt(r.n.total)} exemplos gravados. O leitor usa já na próxima ficha.` : "Libere a pasta de trabalho primeiro.", 5000); }
    catch (er) { aviso(er.message, 5000); }
    ir("ia");
  });
  t.querySelector('[data-acao="ler-de-novo"]')?.addEventListener("click", async () => {
    const n = lidasNaoConferidas(fs).length;
    const ok = await dialogo(raiz, { titulo: `Ler de novo ${fmt(n)} ${n === 1 ? "ficha" : "fichas"}?`, html: `<p class="os-sub">As fichas lidas e ainda não conferidas voltam para a fila e o leitor as lê de novo, com as melhorias. A leitura de agora delas sai; os números já confirmados ficam. As conferidas não mudam.</p>`, botoes: [{ texto: "Ler de novo", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    try {
      const v = await lerDeNovo(fs, { aoProgresso: prog("Devolvendo à fila") });
      aviso(`${fmt(v)} ${v === 1 ? "ficha voltou" : "fichas voltaram"} para a fila.`, 4000);
      completarFila({}).catch(() => {});
    } catch (er) { aviso(er.message, 5000); }
    ir("ia");
  });
}
function cartaoImagensLeitura(fs) {
  const n = semImagensLeitura(fs).length;
  if (!n) return "";
  const naoLidas = semImagensLeitura(fs).filter(f => !f.leitura).length;
  return `<section class="os-cartao os-img-leitura">
      <h3>${IC.lote} Imagens para a leitura em pedaços</h3>
      <p class="os-sub">${fmt(n)} ${n === 1 ? "ficha foi processada" : "fichas foram processadas"} antes da leitura em pedaços e não ${n === 1 ? "tem" : "têm"} o <b>alto da ficha até a borda da foto</b> (horário, cor e clínica escritos acima do quadro) nem a ficha inteira. Refaça pela pasta das fotos: cada foto é endireitada de novo (1 a 3 s cada), primeiro as ${fmt(naoLidas)} ainda não lidas; as que já estavam na fila saem dela e são gravadas de novo. As revisões e os números não mudam.</p>
      <div class="os-botoes"><button class="os-botao" data-acao="refazer-img">Refazer pela pasta das fotos</button></div>
      <div class="os-progresso os-prog-img" hidden><div class="os-barra"><i></i></div><p></p><button class="os-link os-parar">Parar</button></div>
    </section>`;
}
function ligarImagensLeitura(t) {
  t.querySelector('[data-acao="refazer-img"]')?.addEventListener("click", async (e) => {
    const bt = e.currentTarget; if (importando) return aviso("Espere a importação terminar.");
    bt.disabled = true;
    const box = t.querySelector(".os-prog-img"), barra = box.querySelector("i"), txt = box.querySelector("p");
    box.hidden = false; parar = false; box.querySelector(".os-parar").onclick = () => { parar = true; txt.textContent = "Parando depois desta foto…"; };
    try {
      const r = await refazerImagensLeitura((i, tot) => { txt.textContent = `Refazendo as imagens: ${fmt(i)} de ${fmt(tot)}`; barra.style.width = `${tot ? (i / tot) * 100 : 100}%`; });
      if (r) aviso(`${fmt(r.feitas)} ${r.feitas === 1 ? "ficha refeita" : "fichas refeitas"}${r.semFoto ? `; ${fmt(r.semFoto)} sem a foto nesta pasta` : ""}${r.falhas ? `; ${fmt(r.falhas)} não deram certo (o cabeçalho delas fica como estava)` : ""}${r.regravar ? `; ${fmt(r.regravar)} voltam para a fila com as imagens novas` : ""}.`, 8000);
    } catch (er) { aviso(er.message, 6000); }
    ir("ia");
  });
}
async function refazerImagensLeitura(aoProgresso) {
  const fs = semImagensLeitura(await BD.todasFichas()).sort((a, b) => (a.leitura ? 1 : 0) - (b.leitura ? 1 : 0) || a.criado.localeCompare(b.criado));
  if (!fs.length) return null;
  let lista;
  try { lista = await listarPasta(false, (m) => aviso(m, 4000)); } catch (e) { erroPasta(e); return null; }
  if (!lista) return null;
  const porChave = new Map(lista.itens.map(i => [`${i.caminho}|${i.tamanho}`, i])), porNome = porNomeUnico(lista.itens);
  let feitas = 0, semFoto = 0, falhas = 0, trava = null;
  const tirar = [];
  try { trava = await navigator.wakeLock?.request("screen"); } catch { /* sem trava de tela */ }
  raiz.classList.add("importando");
  try {
    for (const [i, f0] of fs.entries()) {
      if (parar) break;
      if (i % 3 === 0) { aoProgresso?.(i, fs.length); await new Promise(r => setTimeout(r, 0)); }
      const it = porChave.get(`${f0.arquivo}|${f0.tamanho}`) || porNome.get(chaveNome(f0.arquivo, f0.tamanho));
      if (!it) { semFoto++; continue; }
      try {
        const r = await comPrazo(alinharFoto(await comPrazo(it.ler(), 60000, "a foto não abriu"), { topo: true }), 90000, "demorou demais");
        if (!r.topo) { falhas++; continue; }
        const imgs = { topo: await topoJpeg(r.topo) };
        if (!f0.imgs?.inteira) imgs.inteira = await imagemInteira(r.img, revisadaF(f0) ? 0.8 : 0.85);
        await BD.porImagens(f0.id, imgs); feitas++;
        // já gravada na fila local, ainda sem leitura: sai da fila e volta a ser gravada, com os pedaços novos
        if (f0.enviada && f0.filaLocal && !f0.leitura) {
          const g = await BD.pegarFicha(f0.id);
          if (g && !g.leitura) { tirar.push(g.pacote); g.enviada = false; delete g.filaLocal; registrar(g, "Imagens refeitas para a leitura em pedaços: volta para a fila"); await BD.salvarFicha(g); }
        }
      } catch { falhas++; }
    }
  } finally {
    raiz.classList.remove("importando");
    try { await trava?.release(); } catch { /* */ }
    if (tirar.length) { try { await tirarDaFila(tirar); } catch (e) { console.warn("OdontoScan: tirar da fila", e.message); } }
  }
  aoProgresso?.(fs.length, fs.length);
  if (tirar.length) completarFila().catch(() => {});
  return { feitas, semFoto, falhas, regravar: tirar.length };
}
async function cartaoRecomecar(fs) {
  const n = fs.filter(afetadaRecomeco).length, rev = fs.filter(f => !f.gabarito && f.revisao && (f.etapa === "revisada" || f.revisadaEm)).length;
  const rec = await BD.lerCfg("recomeco"), gab = fs.filter(f => f.gabarito).length;
  const feito = rec ? `<p class="os-sub">Recomeçada em ${new Date(rec.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}: ${fmt(gab)} ${gab === 1 ? "revisão antiga guardada" : "revisões antigas guardadas"} só como gabarito do teste.</p>` : "";
  if (!n) return rec ? `<section class="os-cartao os-recomeco"><h3>${IC.importar} Leitura do zero</h3>${feito}</section>` : "";
  return `<section class="os-cartao os-recomeco">
      <h3>${IC.importar} Recomeçar a leitura do zero</h3>
      <p class="os-sub">Para os dados da pesquisa saírem todos da leitura deste computador, sem misturar com a da nuvem: ${fmt(n)} ${n === 1 ? "ficha lida ou enviada volta" : "fichas lidas ou enviadas voltam"} a esperar a leitura local e você revisa de novo. Os números confirmados e as imagens ficam.</p>
      ${rev ? `<p class="os-sub">As ${fmt(rev)} revisões que você já fez <b>não entram nos dados</b>: ficam guardadas só como gabarito do <b>Testar a leitura local</b>.</p>` : ""}
      ${feito}
      <div class="os-botoes"><button class="os-botao sec" data-acao="recomecar">Recomeçar a leitura</button></div>
      <div class="os-progresso os-prog-rec" hidden><div class="os-barra"><i></i></div><p></p></div>
    </section>`;
}
function ligarRecomecar(t) {
  t.querySelector('[data-acao="recomecar"]')?.addEventListener("click", async (e) => {
    const bt = e.currentTarget;
    const ok = await dialogo(raiz, {
      titulo: "Recomeçar a leitura de todas as fichas?",
      html: `<p class="os-sub">Todas as fichas lidas, enviadas ou revisadas voltam a esperar a leitura <b>deste computador</b>. As revisões feitas até agora saem dos dados (Conferir, Painel, Planilha e relatório) e ficam guardadas só como gabarito do teste.</p>
        <p class="os-sub">Depois disso, <b>não restaure um backup antigo</b>: faça um backup novo.</p>`,
      botoes: [{ texto: "Recomeçar", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
    });
    if (!ok) return;
    bt.disabled = true;
    const box = t.querySelector(".os-prog-rec"); box.hidden = false;
    try {
      const r = await recomecarLeitura({ aoProgresso: (i, tot) => { box.querySelector("p").textContent = `Recomeçando: ${fmt(i)} de ${fmt(tot)}`; box.querySelector("i").style.width = `${tot ? (i / tot) * 100 : 100}%`; } });
      aviso(`${fmt(r.voltaram)} fichas voltaram para a leitura local; ${fmt(r.guardadas)} revisões guardadas como gabarito.`, 6000);
    } catch (er) { aviso(er.message, 5000); }
    ir("leitura");
  });
}

// ----- teste da leitura local com fichas já revisadas (nenhuma ficha é alterada) -----
const pcV = (x) => x?.n ? `${(100 * x.k / x.n).toFixed(1).replace(".", ",")}%` : "–";
async function cartaoValidacao(fs, comPasta) {
  const ok = (await situacaoPasta()).estado === "ok", r = ok ? await resultadoValidacao(fs) : null, v = await lerValidacao();
  const cand = candidatasValidacao(fs).length, rodadas = (r?.rodadas || v?.rodadas || []);
  const tabRodadas = rodadas.length ? `<h4>Rodadas anteriores</h4><ul class="os-lista os-rodadas">${rodadas.slice().reverse().map(x => `<li><span><b>${esc(x.modelo)}</b><small>${new Date(x.fim).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${fmt(x.n)} fichas${x.segundos ? ` · ${Math.round(x.segundos)} s por ficha` : ""}</small></span><span class="os-rod-num"><b>${pcV(x.campos)}</b><small>campos</small></span><span class="os-rod-num"><b>${pcV(x.procs)}</b><small>proced.</small></span></li>`).join("")}</ul>
    <button class="os-link" data-acao="val-esquecer">Apagar o histórico das rodadas</button>` : "";
  let corpo;
  if (!r) {
    corpo = `<div class="os-linha"><label>Fichas no teste <input type="number" min="5" max="${Math.max(5, cand)}" value="${Math.min(100, cand) || 100}" class="val-n"></label><button class="os-botao" data-acao="val-preparar" ${ok && cand ? "" : "disabled"}>Sortear e gravar</button></div>
      <p class="os-sub">${fmt(cand)} ${cand === 1 ? "ficha revisada (ou com a revisão antiga guardada) tem" : "fichas revisadas (ou com a revisão antiga guardada) têm"} a cópia neste computador${cand < 100 ? " (as restauradas do backup ganham a cópia com Refazer, no Lote)" : ""}.</p>`;
  } else {
    const comp = (nome, c, extra = "") => `<tr><th>${nome}</th><td>${pcV(c.total)}</td><td>${pcV(c.procs)}</td><td>${c.fichas ? `${Math.round(100 * c.fichasIguais / c.fichas)}%` : "–"}</td>${extra}</tr>`;
    corpo = `<div class="os-conc-prog"><span>Lidas pelo leitor: <b>${fmt(r.lidas)} de ${fmt(r.total)}</b>${r.modelo ? ` · ${esc(r.modelo)}` : ""}${r.segundos ? ` · ${Math.round(r.segundos)} s por ficha` : ""}${r.falhas ? ` · ${fmt(r.falhas)} sem leitura` : ""}</span><div class="os-barra"><i style="width:${pct(r.lidas, r.total)}%"></i></div></div>
      ${r.lidas ? `<table class="os-val-comp"><thead><tr><th></th><th>Campos</th><th>Proced.</th><th>Sem correção</th></tr></thead><tbody>
        ${comp(`Este computador${r.modelo ? `<small>${esc(r.modelo)}</small>` : ""}`, r.local)}${(r.outros || []).map(o => comp(`${esc(o.modelo)}<small>no fim de semana · ${fmt(o.lidas)} de ${fmt(r.total)}${o.segundos ? ` · ${Math.round(o.segundos)} s/ficha` : ""}</small>`, o.local)).join("")}${comp("Leitura de antes<small>nuvem, nas mesmas fichas</small>", r.antes)}</tbody></table>
        ${(r.outros || []).length ? "" : `<p class="os-sub">Nos fins de semana, com a fila vazia, o leitor relê estas fichas com outro modelo (${"qwen2.5vl:7b"}, se estiver baixado) e ele aparece aqui, lado a lado.</p>`}
        ${tabelaConc(r.local)}` : `<p class="os-sub">As cópias estão em <b>validacao/</b>. O leitor as lê primeiro, na próxima noite; para não esperar, rode <b>ler-agora.bat</b> no computador. Depois toque em Atualizar.</p>`}
      <div class="os-botoes os-val-bot"><button class="os-botao sec" data-acao="val-atualizar">Atualizar</button>${r.lidas ? `<button class="os-botao sec" data-acao="val-copiar">${IC.copia}<span>Copiar relatório</span></button><button class="os-botao sec" data-acao="val-de-novo">Ler de novo (outro modelo)</button>` : ""}</div>
      <div class="os-botoes"><button class="os-link" data-acao="val-outras">Sortear outras fichas</button><button class="os-link" data-acao="val-encerrar">Encerrar o teste</button></div>`;
  }
  return `<section class="os-cartao os-valid">
      <h3>${IC.alvo} Testar a leitura local</h3>
      <p class="os-sub">Sorteia fichas que você <b>já revisou</b>, grava as cópias em <b>validacao/</b> e, quando o leitor terminar, compara campo a campo e procedimento a procedimento com a sua revisão (IC 95% de Wilson). Nenhuma ficha é alterada. Para comparar modelos, troque o modelo no leitor e toque em <b>Ler de novo</b>.</p>
      ${comPasta ? await linhaPasta() : ""}
      ${corpo}
      ${tabRodadas}
      <div class="os-progresso os-prog-val" hidden><div class="os-barra"><i></i></div><p></p></div>
    </section>`;
}
function textoValidacao(r) {
  const ic = (x) => { const [a, b] = wilson(x.k, x.n); return x.n ? `${pcV(x)} (${x.k} de ${x.n}; IC 95%: ${(100 * a).toFixed(1).replace(".", ",")}–${(100 * b).toFixed(1).replace(".", ",")}%)` : "–"; };
  const L = [`Teste da leitura local do OdontoScan (${new Date().toLocaleDateString("pt-BR")})`,
    `Modelo: ${r.modelo || "?"} · fichas lidas: ${r.lidas} de ${r.total}${r.segundos ? ` · ${Math.round(r.segundos)} s por ficha` : ""}${r.falhas ? ` · ${r.falhas} sem leitura` : ""}`,
    "", "Concordância com a revisão manual (IC 95% de Wilson):",
    `- Todos os campos: ${ic(r.local.total)}`, `- Procedimento a procedimento: ${ic(r.local.procs)}`,
    ...CAMPOS_CONC.filter(([k]) => r.local.por[k].n).map(([k, n]) => `- ${n}: ${ic(r.local.por[k])}`),
    `Fichas sem nenhuma correção: ${r.local.fichasIguais} de ${r.local.fichas} (${r.local.fichas ? Math.round(100 * r.local.fichasIguais / r.local.fichas) : 0}%)`,
    "", `Leitura de antes (nuvem), nas mesmas fichas: campos ${ic(r.antes.total)}; procedimentos ${ic(r.antes.procs)}; sem correção ${r.antes.fichasIguais} de ${r.antes.fichas}.`,
    ...(r.outros || []).map(o => `Outro modelo (${o.modelo}, lido no fim de semana, ${o.lidas} fichas): campos ${ic(o.local.total)}; procedimentos ${ic(o.local.procs)}; sem correção ${o.local.fichasIguais} de ${o.local.fichas}${o.segundos ? `; ${Math.round(o.segundos)} s por ficha` : ""}.`)];
  if (r.tipos) L.push("", "Leitura deste computador. " + textoTiposDeErro(r.tipos));
  if (r.tiposAntes) L.push("", "Leitura de antes (nuvem). " + textoTiposDeErro(r.tiposAntes));
  if (r.rodadas.length) L.push("", "Rodadas anteriores:", ...r.rodadas.map(x => `- ${new Date(x.fim).toLocaleDateString("pt-BR")} · ${x.modelo} · ${x.n} fichas · campos ${pcV(x.campos)} · procedimentos ${pcV(x.procs)} · sem correção ${x.fichasIguais}${x.segundos ? ` · ${Math.round(x.segundos)} s por ficha` : ""}`));
  return L.join("\n");
}
function ligarValidacao(t, fs) {
  const box = t.querySelector(".os-prog-val");
  const preparar = async (ids) => {
    const n = Math.max(5, +t.querySelector(".val-n")?.value || 100);
    box.hidden = false; parar = false;
    try {
      const feitas = await prepararValidacao(fs, n, { ids, parar: () => parar, aoProgresso: (i, tot) => { box.querySelector("p").textContent = `Gravando as cópias do teste: ${Math.min(i + 1, tot)} de ${tot}`; box.querySelector("i").style.width = `${tot ? (i / tot) * 100 : 100}%`; } });
      aviso(`${fmt(feitas)} fichas no teste. Agora rode o leitor (ler-agora.bat) ou espere a noite.`, 6000);
    } catch (er) { aviso(er.message, 5000); }
    ir("leitura");
  };
  t.querySelector('[data-acao="val-preparar"]')?.addEventListener("click", (e) => { e.currentTarget.disabled = true; preparar(null); });
  t.querySelector('[data-acao="val-atualizar"]')?.addEventListener("click", () => ir("leitura"));
  t.querySelector('[data-acao="val-copiar"]')?.addEventListener("click", async () => {
    const r = await resultadoValidacao(fs); if (!r) return;
    const txt = textoValidacao(r);
    try { await navigator.clipboard.writeText(txt); aviso("Relatório copiado.", 2500); }
    catch { await dialogo(raiz, { titulo: "Relatório do teste", html: `<textarea class="os-texto" readonly>${esc(txt)}</textarea>`, botoes: [{ texto: "Fechar", valor: true }] }); }
  });
  t.querySelector('[data-acao="val-de-novo"]')?.addEventListener("click", async () => {
    const ok = await dialogo(raiz, { titulo: "Ler de novo as mesmas fichas?", html: `<p class="os-sub">O resultado atual fica guardado em <b>Rodadas anteriores</b> e as respostas saem da pasta: o leitor lê as mesmas cópias de novo, com o modelo que estiver configurado nele (leitor.json ou trocar-modelo.bat).</p>`, botoes: [{ texto: "Ler de novo", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    await novaRodada(fs); aviso("Pronto: rode o leitor de novo.", 4000); ir("leitura");
  });
  t.querySelector('[data-acao="val-outras"]')?.addEventListener("click", async () => {
    const ok = await dialogo(raiz, { titulo: "Sortear outras fichas?", html: `<p class="os-sub">O resultado atual fica guardado em Rodadas anteriores e o teste recomeça com outro sorteio.</p>`, botoes: [{ texto: "Sortear", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    await novaRodada(fs); preparar(null);
  });
  t.querySelector('[data-acao="val-encerrar"]')?.addEventListener("click", async () => {
    const ok = await dialogo(raiz, { titulo: "Encerrar o teste?", html: `<p class="os-sub">O resultado fica guardado em Rodadas anteriores e as cópias do teste saem da pasta de trabalho.</p>`, botoes: [{ texto: "Encerrar", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }] });
    if (!ok) return;
    await encerrarValidacao(fs); aviso("Teste encerrado.", 3000); ir("leitura");
  });
  t.querySelector('[data-acao="val-esquecer"]')?.addEventListener("click", async () => { await apagarRodadas(); ir("leitura"); });
}

// ---------------- Revisar ----------------
// "Só as dúvidas" (pedido do Alediov, 25/10/2026): o Revisar mostra só as fichas a revisar com dúvida da leitura ou aviso
// de coerência, e na ficha destaca os campos em dúvida (os outros ficam apagados, mas editáveis).
let soDuvidas = (() => { try { return localStorage.getItem("os.soDuvidas") === "1"; } catch { return false; } })();
const duvidasDe = (f) => [...(f.revisao?.duvidas || f.leitura?.ficha?.duvidas || [])];
const temDuvida = (f) => duvidasDe(f).length > 0 || coerencia(revisaoDe(f), f).length > 0;
/** Campos citados nas dúvidas ("campo: motivo") e nos avisos de coerência → chaves dos campos do Revisar. */
function camposEmDuvida(textos) {
  const PAR = [[/^data(?! de nasc)/i, "data"], [/^hor[áa]rio/i, "horario"], [/^cl[ií]nica/i, "clinica"], [/^cor\b/i, "cor"], [/nascimento/i, "nascimento"], [/^sexo/i, "sexo"],
    [/idade/i, "idadeEscrita"], [/munic[ií]pio/i, "municipio"], [/bairro|rua|endere/i, "bairro"], [/urg[êe]ncia|retorno|1ª consulta|primeira|tipo/i, "tipo"], [/procedimento|c[óo]digo|dente/i, "procs"]];
  const out = new Set();
  for (const t of textos) for (const [re, k] of PAR) if (re.test(t)) { out.add(k); break; }
  return out;
}
// Conferir (29/10/2026, pedido do Alediov: 4 abas; antes Números e Revisar separados): a ficha lida, com os números
// (enquanto não viraram código) e o resto, conferidos de uma vez. No modo local a imagem é a ficha INTEIRA, guardada
// só neste computador; na nuvem, a cópia sem identificação e o recorte do endereço.
// a conferir: lida e ainda não revisada, ou revisada antes de confirmar os números
const aConferirF = (f) => !!f.leitura && f.etapa !== "erro" && (aRevisarF(f) || f.etapa === "confirmar");
let modoConf = "fichas"; // "numeros": só os números das fichas ainda não lidas
async function telaConferir(t, id) {
  desligarLupa(); desligarLupa = () => {};
  if (modoConf === "numeros") return telaConfirmar(t);
  const todas = await BD.todasFichas();
  definirFrequencias(todas); // para sugerir o código provável quando o lido não existe
  const amostra = new Set((await BD.lerCfg("concordancia"))?.ids || []);
  const ordem = (f) => aConferirF(f) ? (amostra.has(f.id) ? 0 : 1) : 2;
  const lidas = todas.filter(f => f.leitura).sort((a, b) => ordem(a) - ordem(b) || a.criado.localeCompare(b.criado));
  const semLeitura = todas.filter(f => f.etapa === "confirmar" && !f.leitura).length;
  const cartaoNums = semLeitura ? `<button class="os-so-nums" data-acao="so-numeros">${IC.num}<span><b>${fmt(semLeitura)} ${semLeitura === 1 ? "ficha ainda não lida" : "fichas ainda não lidas"}</b><small>Conferir só os números agora (o resto, depois da leitura)</small></span><i aria-hidden="true">›</i></button>` : "";
  const ligarSoNums = () => t.querySelector('[data-acao="so-numeros"]')?.addEventListener("click", () => { modoConf = "numeros"; telaConfirmar(t); });
  if (!lidas.length) { t.innerHTML = `${vazio("📝", "Nada lido ainda", "Depois da leitura, cada ficha aparece aqui para você conferir lado a lado com a imagem.")}${cartaoNums}`; ligarSoNums(); return; }
  const comDuv = lidas.filter(f => aConferirF(f) && temDuvida(f));
  const fs = soDuvidas ? comDuv : lidas;
  if (!fs.length) {
    t.innerHTML = `<div class="os-cab"><h2>Conferir</h2><span class="os-cab-dir"><button class="os-pilula os-so-duv on">Só dúvidas ✕</button></span></div>${vazio("✅", "Nenhuma dúvida pendente", "Todas as fichas com dúvida já foram conferidas. Desligue o filtro para ver as outras.")}${cartaoNums}`;
    t.querySelector(".os-so-duv").onclick = () => { soDuvidas = false; try { localStorage.setItem("os.soDuvidas", "0"); } catch { /* sem armazenamento */ } telaConferir(t); };
    ligarSoNums();
    return;
  }
  const f = await BD.comImagens(fs.find(x => x.id === id) || fs.find(aConferirF) || fs[0], ["ficha", "endereco", "inteira", "topo", "recortes"]);
  const comNums = f.etapa === "confirmar" && !!f.sugestoes;
  const inteira = f.imgInteira instanceof Blob;
  // ainda não revisada: a revisão sai da leitura de novo (pega as melhorias de interpretação)
  const r = revisadaF(f) && f.revisao ? f.revisao : montarRevisao(f), pos = fs.indexOf(f), aRevisar = lidas.filter(aConferirF).length;
  const idadeRev = ctxProc({}, r).idade; // para o código emprestado (ionômero no permanente) sem dente anotado
  const revisadas = todas.filter(x => revisadaF(x) && x.revisao);
  const uso = { municipio: contarUso(revisadas.map(x => x.revisao.municipio)), bairro: contarUso(revisadas.map(x => x.revisao.bairro)), clinica: contarUso(revisadas.map(x => x.revisao.clinica)) };
  aprenderSubBairros(todas);
  const rua = f.leitura?.endereco?.rua || "", bairrosRua = (rua && bairrosDaRua(rua)?.bairros) || [], bairroRua = bairrosRua.length ? bairrosRua : null;
  const clinicas = [...new Set(Object.values(TABELAS.clinicas))];
  t.innerHTML = `
    <div class="os-cab"><h2>Conferir</h2><span class="os-cab-dir"><span class="os-pilula">${aRevisar} para conferir</span><button class="os-pilula os-so-duv ${soDuvidas ? "on" : ""}">${soDuvidas ? `Só dúvidas (${comDuv.length}) ✕` : `Só dúvidas (${comDuv.length})`}</button>${chipMeta(await metaDoDia(todas), "rev")}</span></div>
    ${cartaoNums}
    <div class="os-rev" data-ficha="${esc(f.id)}">
      <figure class="os-copia ${inteira ? "inteira" : ""}"><img src="${url(inteira ? f.imgInteira : f.imgFicha)}" alt="${inteira ? "Ficha inteira" : "Cópia sem identificação"}"><figcaption>${esc(f.arquivo)} · ${comNums ? "números e leitura a conferir" : ETAPAS[f.etapa]}<span class="os-fig-onde">${inteira ? `${CADEADO} ficha inteira, só neste computador` : ""}</span></figcaption>${f.imgTopo instanceof Blob ? `<details class="os-topo-foto"><summary>O alto da ficha, até a borda da foto (horário, cor, clínica)</summary><img src="${url(f.imgTopo)}" alt="O alto da ficha"></details>` : ""}</figure>
      <section class="os-cartao os-form">
        ${comNums ? `<div class="os-nums"><h4>Números <small>viram código ao salvar; o número em si não fica guardado</small></h4>${htmlNumeros(f)}</div>` : ""}
        ${amostra.has(f.id) && aRevisarF(f) ? `<div class="os-amostra"><b>Amostra de concordância</b><span>Confira cada campo com cuidado, inclusive os que parecem certos: esta ficha entra na medida de acerto da leitura automática.</span></div>` : ""}
        ${r.duvidas?.length ? `<div class="os-duvidas">${r.duvidas.map(d => `<span>${esc(d)}</span>`).join("")}</div>` : ""}
        <div class="os-coerencia" hidden></div>
        <div class="os-dica-agenda" hidden></div>
        <div class="os-grade">
          ${campoData("data", "Data", r.data)}${campoTxt("horario", "Horário de chegada", r.horario, 'data-teclado="hora" placeholder="HH:MM"')}
          ${campoTxt("clinica", "Clínica", r.clinica, 'data-teclado="texto" data-prever="clinica" placeholder="sigla ou professor"')}${campoSel("cor", "Cor", r.cor, Object.values(TABELAS.cores))}
          ${campoData("nascimento", "Nascimento", r.nascimento)}${campoSel("sexo", "Sexo", r.sexo, ["Feminino", "Masculino"])}
          <label class="os-campo-txt">Idade<input value="${esc(r.idadeEscrita)}" data-k="idadeEscrita" data-teclado="num" data-max="3" aria-label="Idade"><small class="os-calc os-idade"></small></label>
        </div>
        <div class="os-endereco">
          ${f.imgEndereco && !inteira ? `<figure class="os-end-img"><img src="${url(f.imgEndereco)}" alt="Endereço do paciente"><figcaption>${CADEADO} Endereço da ficha, só neste aparelho. Toque para ampliar.</figcaption></figure>` : ""}
          <div class="os-grade">
            ${campoTxt("municipio", "Município", r.municipio, 'data-teclado="texto" data-prever="municipio" placeholder="ex.: Cascavel"')}
            <label class="os-campo-txt os-bairro">Bairro<input value="${esc(r.bairro)}" data-k="bairro" data-teclado="texto" data-prever="bairro" aria-label="Bairro" placeholder="bairro de Cascavel">${bairrosRua.length ? `<small class="os-calc">pela rua: ${esc(bairrosRua.length > 3 ? `${bairrosRua.slice(0, 3).join(", ")} e mais ${bairrosRua.length - 3}` : bairrosRua.join(", "))}</small>` : ""}</label>
          </div>
        </div>
        <div class="os-checks">${[["urgencia", "Urgência"], ["primeira", "1ª consulta"], ["retorno", "Retorno"]].map(([k, n]) => `<label><input type="checkbox" data-k="${k}" ${r[k] ? "checked" : ""}>${n}</label>`).join("")}</div>
        <h4>Procedimentos</h4>
        <div class="os-procs">${r.procedimentos.map((p, i) => linhaProc(p, i, idadeRev, r.clinica)).join("")}</div>
        <div class="os-chips-cod"></div>
        <button class="os-link" data-acao="mais">+ procedimento</button>
        <div class="os-botoes"><button class="os-botao" data-acao="salvar">${revisadaF(f) && !comNums ? "Salvar" : "Conferida, próxima"}</button>${pos > 0 ? `<button class="os-botao sec" data-acao="ant">Anterior</button>` : ""}${pos < fs.length - 1 ? `<button class="os-botao sec" data-acao="prox">Próxima</button>` : ""}</div>
        ${f.historico?.length ? `<details class="os-hist"><summary>Histórico desta ficha (${f.historico.length})</summary><ol>${[...f.historico].reverse().map(h => `<li><time>${new Date(h.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time><span>${esc(descrever(h))}</span>${h.mudou?.some(m => "de" in m) ? `<ul>${h.mudou.filter(m => "de" in m).map(m => `<li><b>${esc(NOMES_CAMPOS[m.campo] || m.campo)}</b>: <s>${esc(m.de || "vazio")}</s> → ${esc(m.para || "vazio")}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ol></details>` : ""}
        <p class="os-atalhos"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> ${revisadaF(f) && !comNums ? "salva" : "conferida e próxima"} · <kbd>Alt</kbd>+<kbd>→</kbd> / <kbd>←</kbd> próxima e anterior · tocar num campo mostra onde ele está na ficha</p>
      </section>
    </div>`;
  const campo = (k) => t.querySelector(`[data-k="${k}"]`);
  // bairro só para Cascavel (de fora, basta o município)
  // paciente da PIC (clínica PIC): atendimento institucional, sem bairro de propósito
  const ehPicAqui = () => clinicaPIC(campo("clinica").value) || campo("clinica").value.trim() === NOME_PIC;
  const atualizarBairro = () => {
    const m = campo("municipio").value.trim(), fora = !!m && !ehCascavel(m), pic = ehPicAqui();
    const lb = t.querySelector(".os-bairro"); lb.hidden = fora || pic;
    if (fora || pic) campo("bairro").value = "";
    let nota = t.querySelector(".os-nota-pic");
    if (pic && !nota) { nota = document.createElement("p"); nota.className = "os-sub os-nota-pic"; nota.textContent = "Paciente da PIC: atendimento institucional. O bairro fica vazio e a ficha não entra nos mapas nem nas distâncias."; lb.after(nota); }
    if (!pic && nota) nota.remove();
  };
  const atualizarIdade = () => {
    const i = idadeNaData(dataIso(campo("nascimento").value), dataIso(campo("data").value)), esc2 = campo("idadeEscrita").value;
    t.querySelector(".os-idade").textContent = i != null ? `calculada: ${i}${esc2 !== "" && +esc2 !== i ? " ⚠️" : ""}` : "";
  };
  const ler = () => {
    const v = {};
    t.querySelectorAll("[data-k]").forEach(el => (v[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value.trim()));
    v.procedimentos = [...t.querySelectorAll(".os-proc")].map(el => ({ dente: el.querySelector(".p-dente").value.trim(), codigo: el.querySelector(".p-cod").value.replace(/\D/g, "") })).filter(p => p.codigo);
    v.duvidas = r.duvidas || [];
    return v;
  };
  const conferir = (v) => {
    for (const [k, n] of [["data", "Data"], ["nascimento", "Nascimento"]]) {
      if (!v[k]) continue;
      const iso = dataIso(v[k]); if (!iso) return [k, `${n}: data incompleta ou inválida (dia/mês/ano).`];
      v[k] = iso;
    }
    if (v.horario) { const h = horaValida(v.horario); if (!h) return ["horario", "Horário: use horas e minutos (HH:MM)."]; v.horario = h; }
    const distrito = distritoComoMunicipio(v.municipio);
    if (distrito) { v.municipio = "Cascavel"; v.bairro = distrito; aviso(`${distrito} é distrito de Cascavel: ficou Cascavel, com ${distrito} no bairro.`, 4500); }
    if (v.municipio && !ehCascavel(v.municipio)) v.bairro = "";
    const cTab = v.clinica !== NOME_PIC && clinicaDaTabela(v.clinica);
    if (cTab && cTab !== v.clinica) { aviso(`Clínica: ${v.clinica} ficou ${cTab}.`, 3500); v.clinica = cTab; }
    if (clinicaPIC(v.clinica) || v.clinica === NOME_PIC) { v.clinica = NOME_PIC; v.bairro = ""; v.municipio ||= "Cascavel"; v.institucional = "PIC"; }
    else delete v.institucional;
    return null;
  };
  const ligarProcs = () => t.querySelectorAll(".os-proc").forEach(el => {
    const cod = el.querySelector(".p-cod"), nome = el.querySelector(".p-nome"), dente = el.querySelector(".p-dente");
    cod.oninput = dente.oninput = () => { const p = procedimento(cod.value, { dente: dente.value, idade: idadeRev }); nome.innerHTML = htmlNomeProc(p, t.querySelector('[data-k="clinica"]')?.value || r.clinica); nome.classList.toggle("fora", !p.conhecido && p.digitos.length >= 3); };
    el.querySelector(".p-tirar").onclick = () => el.remove();
    nome.onclick = (e) => { const b = e.target.closest(".p-sug"); if (!b) return; cod.value = b.dataset.cod; cod.dispatchEvent(new Event("input", { bubbles: true })); };
  });
  teclado.configurar({
    rotuloConcluir: "Pronto",
    prever: (el) => {
      const v = el.value;
      if (el.dataset.prever === "municipio") return sugerirMunicipios(v, uso.municipio);
      if (el.dataset.prever === "bairro") return sugerirBairros(v, uso.bairro, bairroRua).map(p => ({ valor: p.valor, nota: p.pelaRua ? "pela rua" : "" }));
      if (el.dataset.prever === "clinica") {
        // as clínicas que atendem no dia e no turno da ficha (agenda padrão) vêm primeiro
        const f0 = ler(), dataF = dataIso(f0.data) || "";
        return sugerirTexto(v, clinicas, uso.clinica, 6, (nome) => combinaComAgenda(nome, dataF, f0.horario) ? 25 : 0);
      }
      return [];
    },
  });
  teclado.preparar(t);
  ligarProcs();
  const N = comNums ? ligarNumeros(t.querySelector(".os-nums"), f) : null;
  ligarSoNums();
  // coerência (datas, idade, dentes e procedimentos), recalculada a cada mudança
  const atualizarCoerencia = () => {
    if (t.querySelector(".os-rev")?.dataset.ficha !== f.id) return; // a tela já mudou (outra ficha ou outra aba)
    const v = ler();
    for (const k of ["data", "nascimento"]) v[k] = dataIso(v[k]) || "";
    const av = coerencia(v, f), box = t.querySelector(".os-coerencia");
    box.hidden = !av.length;
    box.innerHTML = av.map(a => `<span>${esc(a)}</span>`).join("");
    // dica da agenda padrão das clínicas (só um lembrete: os horários mudam; não conta como inconsistência)
    const dica = dicaAgenda(clinicaPorExtenso(v.clinica), v.data, v.horario), bd = t.querySelector(".os-dica-agenda");
    bd.hidden = !dica; bd.textContent = dica ? `🗓️ ${dica}` : "";
  };
  atualizarBairro(); atualizarIdade(); atualizarCoerencia();
  t.querySelector(".os-procs").addEventListener("click", (e) => { if (e.target.closest(".p-tirar")) setTimeout(atualizarCoerencia, 0); });
  t.querySelector(".os-form").addEventListener("input", (e) => {
    clearTimeout(t._coer); t._coer = setTimeout(atualizarCoerencia, 250);
    const k = e.target.dataset?.k;
    if (k === "municipio" || k === "clinica") atualizarBairro();
    if (["data", "nascimento", "idadeEscrita"].includes(k)) atualizarIdade();
  });
  // calendário, para quem prefere escolher a data
  t.querySelectorAll(".os-cal").forEach(b => {
    const alvo = b.parentElement.querySelector("input[data-teclado]"), sel = b.querySelector("input");
    b.onclick = (e) => { if (e.target === sel) return; e.preventDefault(); teclado.fechar(); sel.value = dataIso(alvo.value) || ""; try { sel.showPicker(); } catch { sel.click(); } };
    sel.onchange = () => { if (sel.value) { alvo.value = dataBr(sel.value); alvo.dispatchEvent(new Event("input", { bubbles: true })); } };
  });
  t.querySelector('[data-acao="mais"]').onclick = () => { t.querySelector(".os-procs").insertAdjacentHTML("beforeend", linhaProc({ dente: "", codigo: "" }, 99, idadeRev)); teclado.preparar(t.querySelector(".os-procs").lastElementChild); ligarProcs(); };
  t.querySelector('[data-acao="salvar"]').onclick = async () => {
    const v = ler(), erro = conferir(v);
    if (erro) { aviso(erro[1], 3500); const el = campo(erro[0]); el.classList.remove("ot-tremer"); void el.offsetWidth; el.classList.add("ot-tremer"); el.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (N && !N.podeSeguir()) return;
    const eraLida = aRevisarF(f);
    if (eraLida && !f.revisaoInicial) f.revisaoInicial = r; // o que a leitura automática trouxe (para a concordância)
    const mudou = diferencas(eraLida ? r : f.revisao, v);
    registrar(f, eraLida ? (mudou.length ? "Revisada com correções" : "Revisada sem correção") : "Revisão alterada", mudou.length ? { mudou } : {});
    // números ainda por confirmar: a ficha continua em Números e vira "revisada" quando eles forem confirmados
    f.revisao = v; if (f.etapa !== "confirmar") f.etapa = "revisada"; f.revisadaEm ||= new Date().toISOString();
    // revisada: a cópia fica no tamanho da leitura (1600 px), para caber o ano inteiro no celular
    if (!f.compacta && f.imgFicha) { try { f.imgFicha = await reduzir(f.imgFicha, 1600, 0.8); f.compacta = true; } catch { /* fica como estava */ } }
    // a ficha inteira também encolhe depois de conferida (continua dando para ler, ocupa ~1/3)
    if (f.imgInteira instanceof Blob && !f.inteiraCompacta) { try { f.imgInteira = await reduzir(f.imgInteira, 1600, 0.8); f.inteiraCompacta = true; } catch { /* fica como estava */ } }
    if (N) {
      // os números viram código agora (pela cópia atual do banco: a leitura da IA pode ter fechado os números no meio)
      const atual = await BD.pegarFicha(f.id);
      if (atual?.etapa === "confirmar") { f.sugestoes ||= atual.sugestoes; await fecharNumeros(f, N.valores(), await chave()); comemorarMeta("num").catch(() => {}); }
      else { delete f.sugestoes; delete f.recortes; if (atual) { f.tokens = atual.tokens; f.validos = atual.validos; f.etapa = "revisada"; } }
    } else delete f.recortes; // não mexe nos recortes (só existem com números a conferir)
    await BD.salvarFicha(f);
    const prox = fs.find(x => aConferirF(x) && x.id !== f.id);
    if (eraLida) {
      opts.recompensar?.(1);
      if (!(await comemorarMeta("rev"))) await carimbar(raiz);
    }
    const acabou = eraLida && !prox;
    aviso(acabou ? "Salva. Todas as fichas lidas estão conferidas!" : "Salva."); atualizarBadges();
    if (acabou) confete(raiz);
    if (prox) telaConferir(t, prox.id); else telaConferir(t, f.id);
    t.scrollTop = 0;
  };
  t.querySelector(".os-so-duv").onclick = () => { soDuvidas = !soDuvidas; try { localStorage.setItem("os.soDuvidas", soDuvidas ? "1" : "0"); } catch { /* sem armazenamento */ } telaConferir(t, soDuvidas ? (comDuv.find(x => x.id === f.id) || comDuv[0])?.id : f.id); };
  if (soDuvidas) {
    const emDuv = camposEmDuvida([...(r.duvidas || []), ...coerencia(r, f)]), form = t.querySelector(".os-form");
    form.classList.add("so-duvidas");
    for (const k of emDuv) {
      if (k === "procs") t.querySelectorAll(".os-procs, .os-form > h4").forEach(el => el.classList.add("os-foco"));
      else if (k === "tipo") t.querySelector(".os-checks")?.classList.add("os-foco");
      else t.querySelector(`[data-k="${k}"]`)?.closest("label")?.classList.add("os-foco");
    }
    if (emDuv.has("municipio") || emDuv.has("bairro")) t.querySelector(".os-endereco")?.classList.add("os-foco-end");
    t.querySelector(".os-foco")?.scrollIntoView({ block: "center" });
  }
  // pela confiança (04/11/2026, sugestão aceita pelo Alediov): o que os dois modelos leram igual fica verde, já aceito;
  // o cursor vai para o 1º campo em dúvida; embaixo dos procedimentos, os códigos mais usados na clínica, para tocar
  const conc = !revisadaF(f) ? f.leituraInfo?.concordaram : null;
  if (conc) {
    const emDuv = camposEmDuvida([...(r.duvidas || []), ...coerencia(r, f)]);
    for (const k of conc.campos || []) if (!emDuv.has(k)) t.querySelector(`[data-k="${k}"]`)?.closest("label")?.classList.add("os-certo");
    const linhas = [...t.querySelectorAll(".os-proc")];
    if ((conc.procs || []).length === linhas.length) linhas.forEach((el, i) => { if (conc.procs[i]) el.classList.add("os-certo"); });
    t.querySelector(".os-form").addEventListener("input", (e) => e.target.closest(".os-certo")?.classList.remove("os-certo"));
    const ORDEM = ["data", "horario", "clinica", "cor", "nascimento", "sexo", "idadeEscrita", "municipio", "bairro", "tipo", "procs"];
    const k = !soDuvidas && ORDEM.find(x => emDuv.has(x));
    const alvo = !k ? null : k === "procs" ? (t.querySelector(".os-proc:not(.os-certo) .p-cod") || t.querySelector(".os-procs")) : k === "tipo" ? t.querySelector(".os-checks") : t.querySelector(`[data-k="${k}"]`);
    if (alvo) {
      alvo.scrollIntoView({ block: "center" });
      if (alvo.matches?.("input, select") && matchMedia("(pointer: fine)").matches) alvo.focus({ preventScroll: true });
    }
  }
  let ultimoCod = null;
  t.querySelector(".os-procs").addEventListener("focusin", (e) => { if (e.target.matches(".p-cod")) ultimoCod = e.target; });
  const chips = t.querySelector(".os-chips-cod");
  const pintarChips = () => {
    const cl = clinicaDaTabela(campo("clinica").value) || clinicaPorExtenso(campo("clinica").value) || campo("clinica").value.trim();
    const us = codigosMaisUsados(cl, 8);
    chips.innerHTML = us.length ? `<small>Mais usados${cl && us.daClinica ? ` em ${esc(cl)}` : " nas fichas conferidas"}</small>${us.map(u => `<button type="button" data-cod="${u.digitos}" title="${esc(u.nome)}"><b>${esc(u.codigo)}</b><span>${esc(u.nome)}</span></button>`).join("")}` : "";
  };
  pintarChips();
  campo("clinica").addEventListener("input", () => { clearTimeout(chips._t); chips._t = setTimeout(pintarChips, 300); });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-cod]"); if (!b) return;
    let alvo = ultimoCod && ultimoCod.isConnected && !ultimoCod.value.trim() ? ultimoCod : [...t.querySelectorAll(".os-proc .p-cod")].find(x => !x.value.trim());
    if (!alvo) { t.querySelector('[data-acao="mais"]').click(); alvo = t.querySelector(".os-procs").lastElementChild.querySelector(".p-cod"); }
    alvo.value = b.dataset.cod; alvo.dispatchEvent(new Event("input", { bubbles: true }));
    ultimoCod = alvo; setTimeout(atualizarCoerencia, 0);
  });
  t.querySelector('[data-acao="ant"]')?.addEventListener("click", () => { telaConferir(t, fs[pos - 1].id); t.scrollTop = 0; });
  t.querySelector('[data-acao="prox"]')?.addEventListener("click", () => { telaConferir(t, fs[pos + 1].id); t.scrollTop = 0; });
  t.querySelector(".os-copia img").onclick = (e) => e.currentTarget.closest(".os-copia").classList.toggle("zoom");
  desligarLupa = ligarLupa(t, t.querySelector(".os-copia img")?.src, raiz, { inteira });
  // modo local, ficha processada antes de guardar a ficha inteira: refaz pela foto da pasta, sem travar a tela
  if (!inteira && (await modoLocal())) garantirInteira(f).then(b => {
    if (!b || t.querySelector(".os-rev")?.dataset.ficha !== f.id) return;
    const fig = t.querySelector(".os-copia"), img = fig.querySelector("img"), src = url(b);
    img.src = src; img.alt = "Ficha inteira"; fig.classList.add("inteira", "chegou");
    fig.querySelector(".os-fig-onde").innerHTML = `${CADEADO} ficha inteira, só neste computador`;
    t.querySelector(".os-end-img")?.remove();
    desligarLupa(); desligarLupa = ligarLupa(t, src, raiz, { inteira: true });
  }).catch(() => {});
  t.onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); t.querySelector('[data-acao="salvar"]')?.click(); }
    else if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); t.querySelector('[data-acao="prox"]')?.click(); }
    else if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); t.querySelector('[data-acao="ant"]')?.click(); }
  };
  t.querySelector(".os-end-img")?.addEventListener("click", (e) => e.currentTarget.classList.toggle("zoom"));
}
const campoTxt = (k, n, v, extra = "") => `<label class="os-campo-txt">${n}<input value="${esc(v)}" data-k="${k}" aria-label="${esc(n)}" ${extra}></label>`;
const campoData = (k, n, iso) => `<label class="os-campo-txt">${n}<span class="os-com-cal"><input value="${esc(dataBr(iso))}" data-k="${k}" data-teclado="data" aria-label="${esc(n)}" placeholder="DD/MM/AAAA"><span class="os-cal" role="button" tabindex="0" aria-label="Escolher no calendário">${IC.cal}<input type="date" tabindex="-1" aria-hidden="true"></span></span></label>`;
const campoSel = (k, n, v, ops) => {
  const lista = v && !ops.includes(v) ? [...ops, v] : ops;
  return `<label class="os-campo-txt">${n}<span class="os-sel"><select data-k="${k}" aria-label="${esc(n)}"><option value="" ${v ? "" : "selected"}>não informado</option>${lista.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></span></label>`;
};
// nome do procedimento para mostrar; código emprestado (ionômero no permanente): o procedimento real, com a explicação
// código corrigido (resina de decíduo anotada em permanente): o procedimento certo, com o código anotado
const nomeProc = (pr) => pr.emprestado ? `${pr.nome} (sem código próprio no SIGTAP; usa o do decíduo)` : pr.corrigido ? `${pr.nome} (anotado como ${pr.corrigido.de}, de decíduo: contado como ${pr.codigo})` : pr.nome;
/** O nome do procedimento, ou, com o código fora da lista, os vizinhos prováveis com um toque para usar. */
function htmlNomeProc(pr, clinica = "") {
  if (pr.conhecido || pr.digitos.length < 3) return esc(nomeProc(pr) || "");
  const viz = codigosVizinhos(pr.digitos, clinica);
  return `código fora da lista${viz.length ? `: provável ${viz.map(v => `<button type="button" class="p-sug" data-cod="${v.digitos}" title="${esc(v.nome)}">${esc(v.codigo)}</button>`).join(" ")}` : ""}`;
}
function linhaProc(p, i, idade = null, clinica = "") {
  const pr = procedimento(p.codigo, { dente: p.dente, idade });
  return `<div class="os-proc" style="--k:${i}"><input class="p-dente" value="${esc(p.dente)}" placeholder="dente" data-teclado="num" data-max="2" aria-label="Dente"><input class="p-cod" value="${esc(pr.digitos)}" placeholder="código" data-teclado="sigtap" aria-label="Código do procedimento"><button class="p-tirar" aria-label="Tirar">×</button><small class="p-nome ${!pr.conhecido && pr.digitos.length >= 3 ? "fora" : ""}">${htmlNomeProc(pr, clinica)}</small></div>`;
}

// ---------------- Painel ----------------
export const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
export const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const diaISO = (iso) => String(iso || "").slice(0, 10);
export function barras(lista, total, cor = "var(--os-acento)") {
  const max = Math.max(1, ...lista.map(([, v]) => v));
  return `<ul class="os-barras">${lista.map(([n, v], k) => `<li style="--k:${k}"><span class="ob-nome">${esc(n)}</span><span class="ob-trilho"><i style="width:${(v / max) * 100}%;background:${cor}"></i></span><b>${fmt(v)}</b>${total ? `<small>${pct(v, total)}%</small>` : ""}</li>`).join("")}</ul>`;
}
function contar(valores) { const m = new Map(); for (const v of valores) if (v != null && v !== "") m.set(v, (m.get(v) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); }
let relogioPainel = null, vistaMapa = "bairros";
async function telaPainel(t, doRelogio = false) {
  clearInterval(relogioPainel);
  const fs = await BD.todasFichas(), total = fs.length;
  const n = (e) => fs.filter(f => f.etapa === e).length;
  const enviar = paraEnviar(fs).length, fila = fs.filter(f => f.enviada && !f.leitura).length;
  const ETS = [["erro", "Não reconhecidas", "var(--os-erro)"], ["confirmar", "Números a conferir", "var(--os-aviso)"], ["espera", "Aguardando envio", "#8A94A6"], ["fila", "Na fila da madrugada", "var(--os-azul)"], ["lida", "A conferir", "#9B6BDF"], ["revisada", "Revisadas", "var(--os-ok)"]];
  // cada ficha conta numa etapa só (a principal), para a soma dar 100%
  const etapaDe = (f) => f.etapa === "erro" ? "erro" : f.etapa === "revisada" ? "revisada" : f.leitura ? "lida" : f.etapa === "confirmar" ? "confirmar" : f.enviada ? "fila" : "espera";
  const barraEt = contar(fs.map(etapaDe)), contaEt = Object.fromEntries(barraEt);
  const est = (await BD.lerCfg("estadoFila")) || null, pasta = (await BD.lerCfg("pasta")) || null;
  const limite = est?.limite || 40, pend = enviar + fila, noites = Math.ceil(pend / limite);
  // noites contadas pelas leituras de fichas deste aparelho (as de fichas que não existem mais saem do gráfico)
  const hist = (est?.historico || []).map(h => ({ ...h, lidas: Math.max(0, (h.lidas || 0) - (h.descartadas || 0)) })).filter(h => h.lidas || !h.descartadas).slice(-14);
  // ritmo dos últimos 14 dias
  const dias = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d.toISOString().slice(0, 10); });
  const porDia = (campo) => { const m = contar(fs.map(f => diaISO(f[campo]))); const o = Object.fromEntries(m); return dias.map(d => o[d] || 0); };
  const proc = porDia("criado"), lidas = porDia("lidaEm"), revs = porDia("revisadaEm");
  const maxDia = Math.max(1, ...proc, ...lidas, ...revs);
  // qualidade
  const comNumeros = fs.filter(f => f.tokens && Object.keys(f.tokens).length);
  const auto = fs.filter(f => f.numerosAuto).length;
  const azul = fs.filter(f => f.impressao === "azul").length, preta = fs.filter(f => f.impressao === "preto").length;
  const comDuvida = fs.filter(f => (f.revisao?.duvidas || f.leitura?.ficha?.duvidas || []).length).length;
  // prévia da pesquisa (fichas com leitura)
  const so = (await BD.lerCfg("painelSoRevisadas")) === true;
  const base = fs.filter(f => so ? f.etapa === "revisada" : f.leitura || f.revisao).map(f => ({ f, r: revisaoDe(f) }));
  const sia = await OF.carregarSIA();
  // pacientes, coerência, repetidas e concordância
  const pac = ligarPacientes(fs), tempo = linhaDoTempo(fs, pac), resPac = resumoPacientes(tempo);
  const comAviso = fs.filter(f => (f.leitura || f.revisao) && coerencia(revisaoDe(f), f).length).length;
  const reps = repetidas(fs, pac);
  const conc = (await BD.lerCfg("concordancia")) || null, cAmostra = conc ? concordancia(fs, conc.ids) : null, cTodas = concordancia(fs);
  const amostraFeitas = conc ? fs.filter(f => conc.ids.includes(f.id) && f.etapa === "revisada").length : 0;
  const disponiveis = fs.filter(aRevisarF).length;
  const meses = contar(base.map(({ r }) => (r.data || "").slice(0, 7)).filter(Boolean)).sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => [m.split("-").reverse().join("/"), v]);
  const faixa = (i) => i == null ? null : i <= 12 ? "0 a 12" : i <= 17 ? "13 a 17" : i <= 39 ? "18 a 39" : i <= 59 ? "40 a 59" : "60 ou mais";
  const idades = contar(base.map(({ r }) => faixa(idadeNaData(r.nascimento, r.data) ?? (r.idadeEscrita === "" ? null : +r.idadeEscrita))));
  const ordemFaixa = ["0 a 12", "13 a 17", "18 a 39", "40 a 59", "60 ou mais"]; idades.sort((a, b) => ordemFaixa.indexOf(a[0]) - ordemFaixa.indexOf(b[0]));
  const procs = contar(base.flatMap(({ r }) => (r.procedimentos || []).map(q => { const p = procDe(q, r); return p.nome || `código ${p.codigo}`; }))).slice(0, 8);
  const uso = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  // completude, indicadores e cobertura (os mesmos do Relatório da IC)
  const comp = base.length ? completudeDe(base) : null, inds = base.length ? indicadoresDe(base, resPac) : [], dist = base.length ? distancias(base.map(({ r }) => r)) : null;
  const dec1 = (v, c = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
  const CLASSE = { "Excelente": "var(--os-ok)", "Bom": "var(--os-acento)", "Regular": "var(--os-aviso)", "Ruim": "var(--os-erro)", "Muito ruim": "var(--os-erro)" };
  const imp = importando;
  const ritmoImp = imp && imp.feitas ? imp.feitas / Math.max(1 / 60, (Date.now() - imp.inicio) / 60000) : 0;
  t.innerHTML = `
    ${segRes()}
    <div class="os-cab os-cab-fina"><span class="os-pilula">${fmt(total)} ${total === 1 ? "ficha" : "fichas"} no aparelho</span></div>
    ${imp ? `<section class="os-cartao os-agora">
      <h3>${IC.lote} Importando agora</h3>
      <div class="os-agora-num"><div>${num(imp.n, "imp-n")}<small>de ${fmt(imp.total)}</small></div><div><b>${ritmoImp ? ritmoImp.toFixed(1).replace(".", ",") : "–"}</b><small>Fichas por minuto</small></div><div>${num(imp.problemas || 0, "imp-prob")}<small>Com problema</small></div></div>
      <div class="os-barra"><i style="width:${pct(imp.n, imp.total)}%"></i></div>
      <p class="os-sub">${esc(imp.caminho || "")}${imp.fase ? ` · ${esc(imp.fase)}` : ""}${imp.eta ? ` · ${esc(imp.eta)}` : ""}</p>
    </section>` : ""}
    <section class="os-cartao">
      <h3>${IC.painel} Onde estão as fichas</h3>
      <div class="os-pilha" role="img" aria-label="Distribuição das fichas por etapa">${ETS.map(([k, , cor]) => { const v = (barraEt.find(x => x[0] === k) || [0, 0])[1]; return v ? `<i style="flex:${v};background:${cor};--k:${ETS.findIndex(x => x[0] === k)}" title="${v}"></i>` : ""; }).join("") || `<i style="flex:1;background:var(--os-sup2)"></i>`}</div>
      <ul class="os-legenda">${ETS.map(([k, nome, cor]) => `<li><span style="background:${cor}"></span>${nome}${num(contaEt[k] || 0, `painel-${k}`)}<small>${pct(contaEt[k] || 0, total)}%</small></li>`).join("")}</ul>
      ${pasta?.total ? `<p class="os-sub">Pasta <b>${esc(pasta.nome)}</b>: ${fmt(pasta.total)} fotos na última leitura; ${fmt(Math.min(total, pasta.total))} já no aparelho (${pct(Math.min(total, pasta.total), pasta.total)}%).</p>` : ""}
    </section>
    <section class="os-cartao">
      <h3>${IC.lua} Leitura da madrugada</h3>
      <div class="os-agora-num"><div>${num(limite, "painel-limite")}<small>Fichas por noite agora</small></div><div>${num(pend, "painel-pend")}<small>Esperando leitura</small></div><div><b>${pend ? fmt(noites) : "0"}</b><small>${noites === 1 ? "noite" : "noites"} até ler tudo</small></div></div>
      ${hist.length ? `<div class="os-colunas" role="img" aria-label="Fichas lidas por noite">${hist.map(h => `<div class="${h.terminou === false ? "parou" : ""}" title="${h.data}: ${h.lidas}"><b class="os-col-v">${fmt(h.lidas || 0)}</b><i style="height:${Math.max(4, (h.lidas / Math.max(1, ...hist.map(x => x.lidas || 0))) * 78)}%"></i><small>${String(h.data || "").slice(8, 10)}/${String(h.data || "").slice(5, 7)}</small></div>`).join("")}</div><p class="os-sub">Fichas lidas em cada noite (número em cima; data embaixo)${hist.some(h => h.terminou === false) ? " (em laranja, noites que pararam no limite de uso)" : ""}.</p>` : `<p class="os-sub">Nenhuma noite de leitura ainda.</p>`}
    </section>
    <section class="os-cartao">
      <h3>${IC.raio} Últimos 14 dias</h3>
      <div class="os-dias" role="img" aria-label="Processadas, lidas e revisadas por dia">${dias.map((d, i) => `<div title="${d.split("-").reverse().join("/")}: ${proc[i]} processadas, ${lidas[i]} lidas, ${revs[i]} revisadas"><span><i class="d1" style="height:${(proc[i] / maxDia) * 100}%"></i><i class="d2" style="height:${(lidas[i] / maxDia) * 100}%"></i><i class="d3" style="height:${(revs[i] / maxDia) * 100}%"></i></span><small>${d.slice(8, 10)}</small></div>`).join("")}</div>
      <ul class="os-legenda linha"><li><span class="d1"></span>Processadas<b>${fmt(proc.reduce((a, b) => a + b, 0))}</b></li><li><span class="d2"></span>Lidas<b>${fmt(lidas.reduce((a, b) => a + b, 0))}</b></li><li><span class="d3"></span>Revisadas<b>${fmt(revs.reduce((a, b) => a + b, 0))}</b></li></ul>
    </section>
    <section class="os-cartao">
      <h3>${IC.num} Qualidade</h3>
      <ul class="os-fatos">
        <li><b>${comNumeros.length ? `${pct(auto, comNumeros.length)}%` : "–"}</b><span>dos números conferidos sozinhos pelo dígito verificador (${fmt(auto)} de ${fmt(comNumeros.length)})</span></li>
        <li><b>${fmt(n("confirmar"))}</b><span>fichas esperando você confirmar os números</span></li>
        <li><b>${fmt(azul)} · ${fmt(preta)}</b><span>fichas impressas em azul · em preto (fotocópia)</span></li>
        <li><b>${fmt(n("erro"))}</b><span>não reconhecidas (foto ruim ou problema ao abrir)</span></li>
        <li><b>${fmt(fs.filter(f => f.alinhamentoPendente && f.etapa !== "erro").length)}</b><span>com alinhamento duvidoso, esperando você conferir no Lote</span></li>
        <li><b>${fmt(comDuvida)}</b><span>leituras com alguma dúvida para conferir</span></li>
        <li><b>${fmt(comAviso)}</b><span>com aviso de coerência (datas, idade, dentes ou procedimentos), mostrado ao revisar</span></li>
        <li><b>${fmt(reps.length)}</b><span>${reps.length === 1 ? "grupo" : "grupos"} de possíveis fichas repetidas (mesmo paciente, data e procedimentos), no Lote</span></li>
        ${uso?.usage ? `<li><b>${(uso.usage / 1048576).toFixed(0)} MB</b><span>ocupados no aparelho${uso.quota ? ` (de ${(uso.quota / 1073741824).toFixed(1)} GB disponíveis para o app)` : ""}</span></li>` : ""}
      </ul>
    </section>
    <section class="os-cartao os-conc">
      <h3>${IC.alvo} Concordância da leitura</h3>
      <p class="os-sub">Quanto a leitura automática acerta, comparada com a sua revisão. Para o artigo, use uma <b>amostra aleatória</b>: as fichas sorteadas vão para o começo do Conferir, com um aviso para conferir cada campo com cuidado.</p>
      ${conc ? `<div class="os-conc-prog"><span>Amostra de ${fmt(conc.ids.length)} fichas · ${fmt(amostraFeitas)} revisadas</span><div class="os-barra"><i style="width:${pct(amostraFeitas, conc.ids.length)}%"></i></div></div>
        ${cAmostra.fichas ? tabelaConc(cAmostra) : `<p class="os-sub">Revise as fichas da amostra para ver os números.</p>`}` : ""}
      ${cTodas.fichas ? `<p class="os-sub">${conc ? "Em todas as revisadas" : `Em todas as ${fmt(cTodas.fichas)} revisadas (sem amostra, só uma ideia)`}: ${pcConc(cTodas.total)} dos campos iguais à leitura; ${fmt(cTodas.fichasIguais)} ${cTodas.fichasIguais === 1 ? "ficha" : "fichas"} sem nenhuma correção.</p>` : ""}
      <div class="os-botoes">
        ${!conc || amostraFeitas === conc.ids.length ? `<label class="os-sel os-sel-mini"><select class="conc-n">${[20, 30, 50, 100].map(v => `<option value="${v}" ${v === 30 ? "selected" : ""}>${v} fichas</option>`).join("")}</select></label><button class="os-botao sec" data-acao="sortear" ${disponiveis ? "" : "disabled"}>${conc ? "Nova amostra" : "Sortear amostra"}</button>` : `<button class="os-botao sec" data-acao="ir-revisar">Revisar a amostra</button>`}
        ${(cAmostra?.fichas || cTodas.fichas) ? `<button class="os-botao sec" data-acao="copiar-conc">Copiar texto para o artigo</button>` : ""}
      </div>
      ${!disponiveis && !conc ? `<p class="os-sub">O sorteio usa fichas lidas e ainda não revisadas: aparece quando a leitura da madrugada trouxer fichas.</p>` : ""}
    </section>
    <section class="os-cartao os-pacientes">
      <h3>${IC.pessoas} Pacientes</h3>
      <div class="os-agora-num os-quatro"><div>${num(resPac.pacientes, "pac-n")}<small>Pacientes distintos</small></div><div>${num(resPac.comRetorno, "pac-ret")}<small>Com 2 ou mais atendimentos</small></div><div><b>${resPac.media ? resPac.media.toFixed(1).replace(".", ",") : "–"}</b><small>Atendimentos por paciente</small></div><div><b>${resPac.medianaDias != null ? Math.round(resPac.medianaDias) : "–"}</b><small>Dias entre consultas (mediana)</small></div></div>
      ${tempo.size ? `<label class="os-campo-txt">Procurar paciente<input class="busca-pac" placeholder="código, ex.: P-3F9A" autocomplete="off"></label>
      <ul class="os-lista os-pac-lista">${listaPacientes(tempo, "")}</ul>` : `<p class="os-sub">Os pacientes aparecem quando as fichas forem lidas.</p>`}
    </section>
    ${(() => { const al = base.length >= 20 ? padroesEstranhos(base) : []; return al.length ? `<section class="os-cartao os-alertas">
      <h3>${IC.alvo} Padrões estranhos</h3>
      <p class="os-sub">Coisas que pedem uma olhada: podem ser o perfil da clínica, erro de registro ou ficha faltando.</p>
      <ul class="os-alertas-l">${al.map(a => `<li class="${a.grav}"><b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span></li>`).join("")}</ul>
    </section>` : ""; })()}
    ${cartaoOficial(base, sia)}
    ${comp ? `<section class="os-cartao os-completude">
      <h3>${IC.num} Completude do preenchimento</h3>
      <p class="os-sub">Quanto de cada campo da ficha veio preenchido (escala de Romero e Cunha). Nome, assinatura, endereço, responsável e carimbo: o app só vê se há escrita, sem ler. Média: <b>${dec1(comp.global)}%</b>.</p>
      <ul class="os-comp">${comp.campos.filter(c => c.pct != null).map((c, k) => `<li style="--k:${k}"><span>${esc(c.nome)}</span><i style="--w:${c.pct}%;--cor:${CLASSE[c.classe] || "var(--os-acento)"}"></i><b>${dec1(c.pct, 0)}%</b><em style="--cor:${CLASSE[c.classe] || "var(--os-acento)"}">${c.classe}</em></li>`).join("")}</ul>
      ${comp.validade.cpf.n || comp.validade.cns.n ? `<p class="os-sub">Dígito verificador correto: CPF ${comp.validade.cpf.n ? `${dec1(comp.validade.cpf.pct, 0)}%` : "–"} · CNS ${comp.validade.cns.n ? `${dec1(comp.validade.cns.pct, 0)}%` : "–"}.</p>` : ""}
    </section>
    <section class="os-cartao">
      <h3>${IC.alvo} Indicadores</h3>
      <ul class="os-fatos">${inds.filter(i => i.den).map(i => `<li><b>${i.unidade === "%" ? `${dec1(i.valor)}%` : dec1(i.valor, i.unidade === "razão" ? 2 : 1)}</b><span>${esc(i.nome)} <small>(${fmt(i.num)} / ${fmt(i.den)})</small></span></li>`).join("")}</ul>
      ${dist?.n ? `<p class="os-sub">Cobertura: metade dos atendimentos vem de até <b>${dec1(dist.raio50)} km</b> da clínica e 90% de até <b>${dec1(dist.raio90)} km</b> (pelo centro do bairro ou do município)${dist.nivel.institucional ? `; ${fmt(dist.nivel.institucional)} da PIC ficam de fora` : ""}.</p>` : ""}
    </section>` : ""}
    ${base.length ? `<section class="os-cartao">
      <h3>${IC.cal} Atendimentos por dia</h3>
      ${calendarioCalor(base.map(({ r }) => r.data))}
    </section>${cartaoMapa(IC.mapa)}` : ""}
    ${base.length ? `<section class="os-cartao os-cruzada">
      <h3>${IC.grade} Tabelas cruzadas</h3>
      <div class="os-grade os-cruz-sel">
        <label class="os-campo-txt">Linhas<span class="os-sel"><select class="cz-lin">${VARIAVEIS.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></span></label>
        <label class="os-campo-txt">Colunas<span class="os-sel"><select class="cz-col">${VARIAVEIS.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></span></label>
      </div>
      <div class="os-mapa-vistas cz-modo">${[["n", "Números"], ["lin", "% na linha"], ["col", "% na coluna"]].map(([k, n]) => `<button data-modo="${k}">${n}</button>`).join("")}</div>
      <div class="os-cruz-corpo"></div>
    </section>` : ""}
    <section class="os-cartao">
      <h3>${IC.exp} Prévia da pesquisa</h3>
      <label class="os-check"><input type="checkbox" class="so-rev-painel" ${so ? "checked" : ""}> Só as revisadas</label>
      ${base.length ? `
      <p class="os-sub">${fmt(base.length)} ${base.length === 1 ? "ficha" : "fichas"}${so ? " revisadas" : " lidas (inclui as ainda não revisadas)"}.</p>
      <h4>Atendimentos por mês</h4>${barras(meses, base.length)}
      <h4>Clínicas</h4>${barras(contar(base.map(({ r }) => r.clinica)).slice(0, 8), base.length)}
      <h4>Procedimentos mais feitos</h4>${barras(procs, 0, "var(--os-azul)")}
      <h4>Faixa etária</h4>${barras(idades, base.length, "#9B6BDF")}
      <h4>Sexo</h4>${barras(contar(base.map(({ r }) => r.sexo || "não informado")), base.length, "#9B6BDF")}
      <h4>Município</h4>${barras(contar(base.map(({ r }) => r.municipio || "não informado")).slice(0, 6), base.length, "var(--os-ok)")}
      <h4>Bairros de Cascavel</h4>${barras(contar(base.filter(({ r }) => /cascavel/i.test(r.municipio || "")).map(({ r }) => r.bairro || "não informado")).slice(0, 8), 0, "var(--os-ok)")}` : `<p class="os-sub">Os números aparecem quando as primeiras fichas forem lidas.</p>`}
    </section>`;
  if (doRelogio) { t.classList.remove("entra"); contarNumeros(t); }
  if (base.length) ligarCruzada(t.querySelector(".os-cruzada"), base.map(({ r }) => r));
  if (base.length) ligarMapa(t.querySelector(".os-mapa"), base.map(({ r }) => r), vistaMapa, (v) => (vistaMapa = v));
  t.querySelector('[data-acao="sortear"]')?.addEventListener("click", async () => {
    const n = +t.querySelector(".conc-n").value, lidas = fs.filter(aRevisarF).map(f => f.id);
    for (let i = lidas.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [lidas[i], lidas[j]] = [lidas[j], lidas[i]]; }
    const ids = lidas.slice(0, n);
    await BD.gravarCfg("concordancia", { ids, criada: new Date().toISOString(), tamanho: n });
    aviso(`Amostra sorteada: ${ids.length} fichas. Elas aparecem primeiro no Conferir.`, 4500); telaPainel(t);
  });
  t.querySelector('[data-acao="ir-revisar"]')?.addEventListener("click", () => ir("revisar"));
  t.querySelector('[data-acao="copiar-conc"]')?.addEventListener("click", async () => {
    const txt = textoConcordancia(cAmostra?.fichas ? cAmostra : cTodas, !!cAmostra?.fichas);
    try { await navigator.clipboard.writeText(txt); aviso("Texto copiado.", 2500); }
    catch { await dialogo(raiz, { titulo: "Texto para o artigo", html: `<textarea class="os-texto" readonly>${esc(txt)}</textarea>`, botoes: [{ texto: "Fechar", valor: true }] }); }
  });
  t.querySelectorAll("[data-sia-cnes]").forEach(b => (b.onclick = () => { try { localStorage.setItem("os.siaCnes", b.dataset.siaCnes); } catch {} telaPainel(t, true); }));
  const buscaPac = t.querySelector(".busca-pac");
  const ligarPac = () => t.querySelectorAll("[data-pac]").forEach(b => (b.onclick = () => mostrarPaciente(b.dataset.pac, tempo.get(b.dataset.pac))));
  if (buscaPac) buscaPac.oninput = () => { t.querySelector(".os-pac-lista").innerHTML = listaPacientes(tempo, buscaPac.value); ligarPac(); };
  ligarPac();
  t.querySelector(".so-rev-painel").onchange = async (e) => { await BD.gravarCfg("painelSoRevisadas", e.target.checked); telaPainel(t); };
  // enquanto importa, o painel se atualiza sozinho
  if (importando) relogioPainel = setInterval(() => { if (!noPainel() || !importando) { clearInterval(relogioPainel); if (noPainel()) telaPainel(t); return; } telaPainel(t, true); }, 5000);
  if (!doRelogio && (navigator.onLine || await modoLocal())) lerEstado().then(e => { if (e && JSON.stringify(e.historico?.slice(-1)) !== JSON.stringify(est?.historico?.slice(-1)) && noPainel()) telaPainel(t); }).catch(() => {});
}

/** Miniaturas das cópias (carregadas aos poucos, só as que existem no aparelho). */
async function carregarMinis(el) {
  for (const img of el.querySelectorAll("img[data-mini]")) {
    const f = await BD.pegarFicha(img.dataset.mini);
    if (!f?.imgs?.ficha) { img.replaceWith(Object.assign(document.createElement("span"), { className: "os-mini vazio" })); continue; }
    const g = await BD.comImagens({ ...f }, ["ficha"]);
    img.src = url(g.imgFicha); img.removeAttribute("data-mini");
    img.onclick = (e) => { e.stopPropagation(); img.classList.toggle("grande"); };
  }
}
const mini = (id) => `<img class="os-mini" data-mini="${id}" alt="" loading="lazy">`;

/** Calendário de calor: atendimentos por dia, uma coluna por semana (até 53 semanas). */
export function calendarioCalor(datas) {
  // uma lista de datas ou as contagens já prontas ({ "AAAA-MM-DD": n }, o resumo do celular)
  const cont = new Map(); if (Array.isArray(datas)) { for (const d of datas) if (d) cont.set(d, (cont.get(d) || 0) + 1); } else for (const [d, v] of Object.entries(datas || {})) if (v) cont.set(d, v);
  if (!cont.size) return "";
  const dias = [...cont.keys()].sort(), fim = new Date(dias[dias.length - 1] + "T12:00");
  let ini = new Date(dias[0] + "T12:00");
  const limite = new Date(fim); limite.setDate(limite.getDate() - 7 * 52); if (ini < limite) ini = limite;
  ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7)); // segunda-feira
  const max = Math.max(...cont.values()), nivel = (v) => !v ? 0 : Math.min(4, Math.ceil((v / max) * 4));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  let cols = "", meses = "", mesAnt = -1, k = 0;
  for (const d = new Date(ini); d <= fim; k++) {
    let col = "";
    const m = d.getMonth();
    meses += `<span>${m !== mesAnt ? MESES[m] : ""}</span>`; mesAnt = m;
    for (let w = 0; w < 7; w++, d.setDate(d.getDate() + 1)) {
      const s = iso(d), v = cont.get(s) || 0;
      col += d > fim ? "<i class=\"fora\"></i>" : `<i class="n${nivel(v)}" title="${s.split("-").reverse().join("/")}: ${v} ${v === 1 ? "atendimento" : "atendimentos"}"></i>`;
    }
    cols += `<div style="--k:${k}">${col}</div>`;
  }
  const porSemana = [0, 0, 0, 0, 0, 0, 0]; for (const [d, v] of cont) porSemana[(new Date(d + "T12:00").getDay() + 6) % 7] += v;
  const NOMES = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"], top = porSemana.indexOf(Math.max(...porSemana));
  const [diaTop, vTop] = [...cont.entries()].sort((a, b) => b[1] - a[1])[0];
  return `<div class="os-calor"><div class="oc-meses">${meses}</div><div class="oc-grade"><div class="oc-sem"><span>seg</span><span></span><span>qua</span><span></span><span>sex</span><span></span><span>dom</span></div>${cols}</div></div>
    <p class="os-sub">Dia mais cheio: ${diaTop.split("-").reverse().join("/")} (${vTop}). Na semana, ${NOMES[top]} tem mais atendimentos. <span class="oc-leg">menos <i class="n0"></i><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i> mais</span></p>`;
}
// ---------------- tabelas cruzadas ----------------
async function ligarCruzada(el, revisoes) {
  const cfg = { lin: "faixa", col: "sexo", modo: "lin", ...((await BD.lerCfg("cruzada")) || {}) };
  const sl = el.querySelector(".cz-lin"), sc = el.querySelector(".cz-col");
  sl.value = cfg.lin; sc.value = cfg.col;
  const desenhar = () => {
    if (cfg.lin === cfg.col) { cfg.col = VARIAVEIS.find(v => v[0] !== cfg.lin)[0]; sc.value = cfg.col; }
    BD.gravarCfg("cruzada", cfg);
    el.querySelectorAll(".cz-modo button").forEach(b => b.classList.toggle("on", b.dataset.modo === cfg.modo));
    const t = cruzar(revisoes, cfg.lin, cfg.col), q = quiQuadrado(t);
    const pc = (v, b) => b ? `${(100 * v / b).toFixed(1).replace(".", ",")}%` : "–";
    const fr = (i, j) => cfg.modo === "lin" ? (t.totLin[i] ? t.n[i][j] / t.totLin[i] : 0) : cfg.modo === "col" ? (t.totCol[j] ? t.n[i][j] / t.totCol[j] : 0) : t.n[i][j] / Math.max(1, ...t.n.flat());
    const cel = (i, j) => cfg.modo === "lin" ? pc(t.n[i][j], t.totLin[i]) : cfg.modo === "col" ? pc(t.n[i][j], t.totCol[j]) : fmt(t.n[i][j]);
    const pTxt = q ? (q.p < 0.001 ? "p < 0,001" : `p = ${q.p.toFixed(3).replace(".", ",")}`) : "";
    el.querySelector(".os-cruz-corpo").innerHTML = !t.total ? `<p class="os-sub">Sem fichas com as duas informações preenchidas.</p>` : `
      <div class="os-cruz-rolagem"><table class="os-cruz"><thead><tr><th>${esc(t.nomeLin)}</th>${t.colunas.map(c => `<th>${esc(c)}</th>`).join("")}<th>Total</th></tr></thead>
      <tbody>${t.linhas.map((l, i) => `<tr style="--k:${i}"><th>${esc(l)}</th>${t.colunas.map((_, j) => `<td style="--a:${fr(i, j).toFixed(3)}">${cel(i, j)}</td>`).join("")}<td class="tot">${cfg.modo === "col" ? pc(t.totLin[i], t.total) : fmt(t.totLin[i])}</td></tr>`).join("")}</tbody>
      <tfoot><tr><th>Total</th>${t.totCol.map(v => `<td class="tot">${cfg.modo === "lin" ? pc(v, t.total) : fmt(v)}</td>`).join("")}<td class="tot">${fmt(t.total)}</td></tr></tfoot></table></div>
      <p class="os-sub">${fmt(t.total)} ${t.unidade}${t.semValor ? `; ${fmt(t.semValor)} ${t.unidade === "procedimentos" ? "fichas" : "fichas"} sem uma das duas informações ficaram de fora` : ""}.</p>
      ${q ? `<p class="os-cruz-qui"><b>Qui-quadrado:</b> χ² = ${q.qui2.toFixed(2).replace(".", ",")}; gl = ${q.gl}; ${pTxt}${q.p < 0.05 ? " · as duas variáveis parecem ligadas (5%)" : " · sem diferença significativa (5%)"}${q.baixos > 0.2 ? `<br><small>${Math.round(q.baixos * 100)}% das células têm valor esperado menor que 5: o teste fica pouco confiável (junte categorias ou use o exato de Fisher na análise final).</small>` : ""}${t.unidade === "procedimentos" ? `<br><small>Com procedimentos, um paciente pode contar várias vezes: use o teste só como orientação.</small>` : ""}</p>` : ""}
      <div class="os-botoes"><button class="os-botao sec" data-acao="copiar-cruz">Copiar tabela</button></div>`;
    el.querySelector('[data-acao="copiar-cruz"]')?.addEventListener("click", async () => {
      const txt = tsv(t, cfg.modo) + (q ? `\nQui-quadrado: χ² = ${q.qui2.toFixed(2)}; gl = ${q.gl}; ${pTxt}` : "");
      try { await navigator.clipboard.writeText(txt); aviso("Tabela copiada: cole no Excel ou no Word.", 3000); }
      catch { await dialogo(raiz, { titulo: "Tabela", html: `<textarea class="os-texto" readonly>${esc(txt)}</textarea>`, botoes: [{ texto: "Fechar", valor: true }] }); }
    });
  };
  sl.onchange = () => { cfg.lin = sl.value; desenhar(); };
  sc.onchange = () => { cfg.col = sc.value; if (cfg.col === cfg.lin) { cfg.lin = VARIAVEIS.find(v => v[0] !== cfg.col)[0]; sl.value = cfg.lin; } desenhar(); };
  el.querySelectorAll(".cz-modo button").forEach(b => (b.onclick = () => { cfg.modo = b.dataset.modo; desenhar(); }));
  desenhar();
}

const pcConc = (x) => x.n ? `${(100 * x.k / x.n).toFixed(1).replace(".", ",")}%` : "–";
export function tabelaConc(c) {
  const linha = (nome, x) => { const [a, b] = wilson(x.k, x.n); return `<li><span class="ob-nome">${esc(nome)}</span><span class="ob-trilho"><i style="width:${x.n ? (100 * x.k) / x.n : 0}%;background:${x.n && x.k / x.n >= 0.95 ? "var(--os-ok)" : x.n && x.k / x.n >= 0.85 ? "var(--os-aviso)" : "var(--os-erro)"}"></i></span><b>${pcConc(x)}</b><small title="intervalo de confiança de 95%">${x.n ? `${Math.round(100 * a)}–${Math.round(100 * b)}` : ""}</small></li>`; };
  return `<p class="os-sub"><b>${fmt(c.fichas)} fichas</b>: ${pcConc(c.total)} dos campos iguais à leitura; ${fmt(c.fichasIguais)} ${c.fichasIguais === 1 ? "ficha" : "fichas"} sem nenhuma correção. À direita, o intervalo de confiança de 95%.</p>
    <ul class="os-barras os-conc-tab">${linha("Todos os campos", c.total)}${linha("Procedimento a procedimento", c.procs)}${CAMPOS_CONC.filter(([k]) => c.por[k].n).map(([k, nome]) => linha(nome, c.por[k])).join("")}</ul>`;
}
function listaPacientes(tempo, q) {
  const busca = q.trim().toUpperCase().replace(/^P-?/, "");
  const lista = [...tempo.entries()].filter(([p]) => !busca || p.toUpperCase().replace(/^P-?/, "").includes(busca)).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (!lista.length) return `<li><span><small>Nenhum paciente com esse código.</small></span></li>`;
  return lista.slice(0, 8).map(([p, v]) => {
    const datas = v.map(x => x.r.data).filter(Boolean);
    return `<li><button class="os-pac" data-pac="${esc(p)}"><b>${esc(p)}</b><small>${v.length} ${v.length === 1 ? "atendimento" : "atendimentos"}${datas.length ? ` · ${dataBr(datas[0])}${datas.length > 1 ? ` a ${dataBr(datas[datas.length - 1])}` : ""}` : ""}</small></button></li>`;
  }).join("") + (lista.length > 8 ? `<li><span><small>e mais ${fmt(lista.length - 8)}: procure pelo código</small></span></li>` : "");
}
function mostrarPaciente(p, v = []) {
  const itens = v.map(({ f, r }, i) => {
    const tipo = [r.urgencia && "Urgência", r.primeira && "1ª consulta", r.retorno && "Retorno"].filter(Boolean).join(", ");
    const ant = i ? v[i - 1].r.data : null, dias = ant && r.data ? Math.round((new Date(r.data) - new Date(ant)) / 864e5) : null;
    return `<li style="--k:${i}">${dias != null ? `<em>${dias} ${dias === 1 ? "dia" : "dias"} depois</em>` : ""}<b>${r.data ? dataBr(r.data) : "sem data"}${r.clinica ? ` · ${esc(r.clinica)}` : ""}</b>${tipo ? `<small>${tipo}</small>` : ""}
      ${mini(f.id)}<ul>${(r.procedimentos || []).map(q => { const pr = procDe(q, r); return `<li>${q.dente ? `<span class="os-dente">${esc(q.dente)}</span>` : ""}${esc(pr.nome || pr.codigo)}</li>`; }).join("") || "<li>sem procedimento</li>"}</ul><small class="os-arq">${esc(f.arquivo)} · ${ETAPAS[f.etapa]}</small></li>`;
  }).join("");
  dialogo(raiz, { titulo: `Paciente ${p}`, html: `<ol class="os-tempo">${itens}</ol>`, botoes: [{ texto: "Fechar", valor: true }] });
  carregarMinis(raiz.querySelector(".os-dialogo:last-of-type"));
}

// ---------------- Exportar ----------------
function ligarPacientes(fs) {
  const pai = new Map(), achar = (x) => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
  const unir = (a, b) => { a = achar(a); b = achar(b); if (a !== b) pai.set(a < b ? b : a, a < b ? a : b); };
  const prioridade = (tok) => tok.startsWith("cpf:") ? 0 : tok.startsWith("cns:") ? 1 : 2;
  for (const f of fs) {
    const toks = ["cpf", "cns", "prontuario"].filter(c => f.tokens?.[c]).map(c => `${c}:${f.tokens[c]}`);
    toks.forEach(x => { if (!pai.has(x)) pai.set(x, x); });
    for (let i = 1; i < toks.length; i++) unir(toks[0], toks[i]);
  }
  const grupos = new Map();
  for (const x of pai.keys()) { const r = achar(x); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(x); }
  const rotulo = new Map();
  for (const membros of grupos.values()) {
    const melhor = membros.sort((a, b) => prioridade(a) - prioridade(b) || a.localeCompare(b))[0].split(":")[1];
    membros.forEach(m => rotulo.set(m, melhor));
  }
  return (f) => { const tok = ["cpf", "cns", "prontuario"].find(c => f.tokens?.[c]); return tok ? rotulo.get(`${tok}:${f.tokens[tok]}`) : ""; };
}
const FORMATOS = [
  { id: "xlsx", nome: "Excel (.xlsx)", txt: "Colunas no tamanho certo, datas e horas de verdade, códigos como texto, filtro no cabeçalho e uma aba só de procedimentos." },
  { id: "csv-br", nome: "CSV para Excel em português", txt: "Separado por ponto e vírgula, datas dd/mm/aaaa. Abre direto no Excel e no Google Planilhas." },
  { id: "csv", nome: "CSV padrão (R, Python, SPSS)", txt: "Separado por vírgula, datas aaaa-mm-dd. Para a análise estatística." },
];
/** Monta as tabelas da exportação: atendimentos (uma linha por ficha) e procedimentos (uma linha por procedimento). */
function tabelas(lista, pac) {
  const cab = ["Arquivo", "Código do paciente", "Código do aluno", "Clínica", "Horário de Chegada", "Cor", "Data", "Urgência/Emergência", "Primeira Consulta", "Retorno", "Idade (calculada)", "Idade (escrita)", "Sexo", "Município", "Bairro", "Situação"];
  const tipos = ["texto", "texto", "texto", "texto", "hora", "texto", "data", "centro", "centro", "centro", "numero", "numero", "texto", "texto", "texto", "texto"];
  for (let i = 1; i <= 12; i++) { cab.push(`Dente ${i}`, `Código do Procedimento ${i}`, `Nome do Procedimento ${i}`); tipos.push("centro", "texto", "texto"); }
  const at = [cab];
  const pc = [["Arquivo", "Código do paciente", "Data", "Clínica", "Ordem", "Dente", "Código do Procedimento", "Nome do Procedimento", "Observação do código"]];
  for (const f of lista) {
    const r = f.revisao || montarRevisao(f), idade = idadeNaData(r.nascimento, r.data);
    const aluno = f.tokens?.aluno || "", p = pac(f);
    const L = [f.arquivo, p, aluno, r.clinica, r.horario, r.cor, r.data || "",
      r.urgencia ? "X" : "", r.primeira ? "X" : "", r.retorno ? "X" : "", idade ?? "", r.idadeEscrita === "" ? "" : +r.idadeEscrita, r.sexo, r.municipio, r.bairro, ETAPAS[f.etapa]];
    for (let i = 0; i < 12; i++) { const q = r.procedimentos?.[i]; const pr = q ? procDe(q, r) : null; L.push(q?.dente || "", pr?.codigo || "", pr?.nome || ""); }
    at.push(L);
    (r.procedimentos || []).forEach((q, i) => { const pr = procDe(q, r); pc.push([f.arquivo, p, r.data || "", r.clinica, i + 1, q.dente || "", pr.codigo, pr.nome, pr.emprestado ? `${pr.emprestado.nota}; reclassificada pelo ${pr.emprestado.pela === "dente" ? "dente permanente" : "idade do paciente"}` : pr.corrigido ? `${pr.corrigido.nota}, pelo ${pr.corrigido.pela === "dente" ? "dente permanente" : "idade do paciente"}` : ""]); });
  }
  return {
    atendimentos: { nome: "Atendimentos", linhas: at, tipos, filtro: true, larguraMax: 48 },
    procedimentos: { nome: "Procedimentos", linhas: pc, tipos: ["texto", "texto", "data", "texto", "numero", "centro", "texto", "texto", "texto"], filtro: true, larguraMax: 70 },
  };
}
async function telaExportar(t) {
  const fs = await BD.todasFichas(), comLeitura = fs.filter(f => f.leitura || f.revisao);
  const rev = fs.filter(f => f.etapa === "revisada").length;
  const pacientes = new Set(comLeitura.map(ligarPacientes(fs)).filter(Boolean)).size;
  let formato = (await BD.lerCfg("formato")) || "xlsx";
  const rel = { titulo: "", autor: "", orientador: "", instituicao: "Curso de Odontologia – UNIOESTE, campus de Cascavel", soRevisadas: rev > 0, ...((await BD.lerCfg("relatorio")) || {}) };
  t.innerHTML = `
    ${segRes()}
    <div class="os-funil">${[[comLeitura.length, "fichas lidas"], [rev, "revisadas"], [pacientes, "pacientes distintos"]].map(([v, n], k) => `<div class="os-etapa" style="--k:${k}">${num(v, `planilha-${k}`)}<small>${n}</small></div>`).join("")}</div>
    <section class="os-cartao">
      <h3>${IC.exp} Exportar</h3>
      <p class="os-sub">Uma linha por atendimento, no formato da sua planilha-modelo, com código no lugar de nome, CPF, CNS, prontuário, aluno e professor, e idade calculada no lugar da data de nascimento.</p>
      <div class="os-formatos" role="radiogroup" aria-label="Formato">${FORMATOS.map(o => `<label class="os-formato"><input type="radio" name="formato" value="${o.id}" ${o.id === formato ? "checked" : ""}><span><b>${o.nome}</b><small>${o.txt}</small></span></label>`).join("")}</div>
      <label class="os-check"><input type="checkbox" class="so-rev" ${rev ? "checked" : ""}> Só as revisadas</label>
      <button class="os-botao" data-acao="baixar" ${comLeitura.length ? "" : "disabled"}>Baixar</button>
    </section>
    <section class="os-cartao os-relatorio">
      <h3>${IC.doc} Relatório da IC</h3>
      <p class="os-sub">Um documento do Word (.docx), no padrão ABNT, organizado pelos objetivos do projeto: protocolo e fluxograma das fichas, perfil e pirâmide etária, procedimentos pela Tabela 1 (PAB/FAEC) e odontograma, indicadores com fórmula, completude do preenchimento (Romero e Cunha), mapas, taxas por habitante (Censo 2022), raio de cobertura, Kernel, aglomerados (Moran/LISA), a tabela cruzada do Painel, o cronograma e as referências. Só números agregados: nenhum dado ou código de paciente.</p>
      <div class="os-grade">
        <label class="os-campo-txt">Relatório<select class="rel-tipo"><option value="parcial" ${rel.tipo !== "final" ? "selected" : ""}>Parcial</option><option value="final" ${rel.tipo === "final" ? "selected" : ""}>Final</option></select></label>
        <label class="os-campo-txt">Título<input class="rel-titulo" value="${esc(rel.titulo)}" placeholder="Relatório parcial de iniciação científica"></label>
      </div>
      <label class="os-campo-txt">Projeto<input class="rel-projeto" value="${esc(rel.projeto || PROJETO)}"></label>
      <div class="os-grade">
        <label class="os-campo-txt">Autoria<input class="rel-autor" value="${esc(rel.autor)}" placeholder="seu nome"></label>
        <label class="os-campo-txt">Orientação<input class="rel-orientador" value="${esc(rel.orientador)}" placeholder="Prof(a). …"></label>
      </div>
      <label class="os-campo-txt">Instituição<input class="rel-inst" value="${esc(rel.instituicao)}"></label>
      <label class="os-check"><input type="checkbox" class="rel-so" ${rel.soRevisadas ? "checked" : ""}> Só as revisadas</label>
      <div class="os-botoes"><button class="os-botao" data-acao="relatorio" ${comLeitura.length ? "" : "disabled"}>Gerar relatório (.docx)</button><button class="os-botao sec" data-acao="figuras" ${comLeitura.length ? "" : "disabled"}>Figuras para o artigo (.zip)</button></div>
      <p class="os-sub">As figuras saem em PNG de alta resolução (o dobro de pixels do relatório), prontas para o artigo, o pôster ou os slides, com um LEIA-ME com os títulos e as fontes.</p>
    </section>
    <section class="os-cartao os-pacote">
      <h3>${IC.exp} Pacote para Power BI e ArcGIS</h3>
      <p class="os-sub">Um .zip com as tabelas já relacionadas (atendimentos, procedimentos, completude, municípios e bairros com a população do Censo 2022, calendário e indicadores por mês) e as camadas dos bairros de Cascavel e dos municípios do Paraná em GeoJSON, com contagens e taxas. O LEIA-ME diz como ligar as tabelas no Power BI. Mesmos códigos da planilha; a localização é o centro do bairro ou do município.</p>
      <div class="os-botoes"><button class="os-botao sec" data-acao="pacote" ${comLeitura.length ? "" : "disabled"}>Baixar pacote (.zip)</button></div>
    </section>
    <section class="os-cartao">
      <h3>${IC.exp} Dicionário de dados</h3>
      <p class="os-sub">O que é cada coluna, o tipo e de onde vem. Vai como aba no Excel; para R, Python ou SPSS, baixe à parte.</p>
      <details class="os-dic"><summary>Ver as colunas</summary><dl>${DICIONARIO.map(([c, tipo, txt]) => `<dt>${esc(c)} <small>${esc(tipo)}</small></dt><dd>${esc(txt)}</dd>`).join("")}</dl></details>
      <div class="os-botoes"><button class="os-botao sec" data-acao="dic-csv">Baixar dicionário (CSV)</button></div>
    </section>`;
  t.querySelector('[data-acao="relatorio"]').onclick = async (e) => {
    const b = e.currentTarget, o = { tipo: t.querySelector(".rel-tipo").value, titulo: t.querySelector(".rel-titulo").value.trim(), projeto: t.querySelector(".rel-projeto").value.trim(), autor: t.querySelector(".rel-autor").value.trim(), orientador: t.querySelector(".rel-orientador").value.trim(), instituicao: t.querySelector(".rel-inst").value.trim(), soRevisadas: t.querySelector(".rel-so").checked };
    await BD.gravarCfg("relatorio", o);
    if (o.soRevisadas && !rev) return aviso("Nenhuma ficha revisada ainda. Desmarque \"Só as revisadas\" para usar as lidas.");
    b.disabled = true; b.textContent = "Montando o relatório…";
    try {
      const todas = await BD.todasFichas();
      const naLixeira = (await BD.fichasNaLixeira()).filter(f => f.etapa !== "erro").length;
      const blob = await gerarRelatorio(todas, ligarPacientes(todas), { ...o, naLixeira, sia: await OF.carregarSIA(), concordanciaIds: (await BD.lerCfg("concordancia"))?.ids, cruzada: await BD.lerCfg("cruzada") });
      await baixar(blob, `relatorio-${o.tipo === "final" ? "final" : "parcial"}-ic-${new Date().toISOString().slice(0, 10)}.docx`);
      aviso("Relatório pronto.", 3000);
    } catch (err) { console.error(err); aviso(`Não consegui montar o relatório: ${err.message}`, 6000); }
    finally { b.disabled = false; b.textContent = "Gerar relatório (.docx)"; }
  };
  t.querySelector('[data-acao="figuras"]').onclick = async (e) => {
    const b = e.currentTarget, o = { tipo: t.querySelector(".rel-tipo").value, soRevisadas: t.querySelector(".rel-so").checked, figuras: true };
    if (o.soRevisadas && !rev) return aviso("Nenhuma ficha revisada ainda. Desmarque \"Só as revisadas\" para usar as lidas.");
    b.disabled = true; b.textContent = "Desenhando as figuras…";
    try {
      definirEscala(2);
      const todas = await BD.todasFichas();
      const naLixeira = (await BD.fichasNaLixeira()).filter(f => f.etapa !== "erro").length;
      const blob = await gerarRelatorio(todas, ligarPacientes(todas), { ...o, naLixeira, sia: await OF.carregarSIA(), concordanciaIds: (await BD.lerCfg("concordancia"))?.ids, cruzada: await BD.lerCfg("cruzada") });
      await baixar(blob, `figuras-ic-${new Date().toISOString().slice(0, 10)}.zip`);
      aviso("Figuras prontas.", 3000);
    } catch (err) { console.error(err); aviso(`Não consegui desenhar as figuras: ${err.message}`, 6000); }
    finally { definirEscala(1); b.disabled = false; b.textContent = "Figuras para o artigo (.zip)"; }
  };
  t.querySelector('[data-acao="pacote"]').onclick = async (e) => {
    const b = e.currentTarget, so = t.querySelector(".so-rev").checked;
    if (so && !rev) return aviso("Nenhuma ficha revisada ainda. Desmarque \"Só as revisadas\" (em Exportar) para usar as lidas.");
    b.disabled = true; b.textContent = "Montando o pacote…";
    try { const todas = await BD.todasFichas(); await baixar(await pacoteBI(todas, ligarPacientes(todas), { soRevisadas: so }), `odontoscan-bi-sig-${new Date().toISOString().slice(0, 10)}.zip`); aviso("Pacote pronto.", 3000); }
    catch (err) { console.error(err); aviso(`Não consegui montar o pacote: ${err.message}`, 6000); }
    finally { b.disabled = false; b.textContent = "Baixar pacote (.zip)"; }
  };
  t.querySelector('[data-acao="dic-csv"]').onclick = () => baixar(csv({ linhas: [["Coluna", "Tipo", "Descricao"], ...DICIONARIO] }, formato === "csv-br" ? ";" : ","), "odontoscan-dicionario.csv");
  const rotulo = () => { const o = FORMATOS.find(x => x.id === formato); t.querySelector('[data-acao="baixar"]').textContent = `Baixar ${o.id === "xlsx" ? "planilha (.xlsx)" : "CSV"}`; };
  t.querySelectorAll('input[name="formato"]').forEach(r => (r.onchange = () => { formato = r.value; BD.gravarCfg("formato", formato); rotulo(); }));
  rotulo();
  t.querySelector('[data-acao="baixar"]').onclick = async () => {
    const so = t.querySelector(".so-rev").checked, lista = comLeitura.filter(f => !so || f.etapa === "revisada").sort((a, b) => a.arquivo.localeCompare(b.arquivo));
    if (!lista.length) return aviso("Nenhuma ficha revisada ainda. Desmarque \"Só as revisadas\" para baixar as lidas.");
    const tb = tabelas(lista, ligarPacientes(fs)), dia = new Date().toISOString().slice(0, 10);
    if (formato !== "xlsx") return baixar(csv(tb.atendimentos, formato === "csv-br" ? ";" : ","), `odontoscan-${dia}.csv`);
    const leia = [["Órbita Scanner: planilha gerada em " + new Date().toLocaleString("pt-BR")], [""],
      ["Os códigos (P-, A-, D-) são gerados com uma chave secreta guardada só no aparelho que processou as fichas."],
      ["O mesmo CPF, CNS ou prontuário gera sempre o mesmo código de paciente; fichas sem prontuário se ligam pelo CPF ou CNS."],
      ["Nenhum nome, CPF, CNS, prontuário, endereço ou data de nascimento sai nesta planilha."],
      ["A coluna Arquivo traz o nome da foto, para achar a ficha em papel: não nomeie as fotos com dados do paciente."],
      ["Idade (calculada) usa a data de nascimento e a data do atendimento; Idade (escrita) é a do campo Idade da ficha."],
      ["A aba Procedimentos tem uma linha por procedimento (com paciente, data e clínica), boa para contar e filtrar."],
      ["Códigos de procedimento e dentes ficam como texto, para não perder zeros nem pontos."]];
    const pacX = ligarPacientes(fs), corr = [["Arquivo", "Código do paciente", "Quando", "O que", "Campo", "Antes", "Depois"]];
    for (const f of lista) for (const h of f.historico || []) {
      const quando = new Date(h.em).toLocaleString("pt-BR");
      if (h.mudou?.length) h.mudou.forEach(m => corr.push([f.arquivo, pacX(f), quando, h.acao, NOMES_CAMPOS[m.campo] || m.campo, "de" in m ? m.de : "(alterada)", "de" in m ? m.para : "(alterada)"]));
      else if (h.numeros?.length) h.numeros.forEach(m => corr.push([f.arquivo, pacX(f), quando, h.acao, { prontuario: "Prontuário", aluno: "RA", cpf: "CPF", cns: "CNS" }[m.campo] || m.campo, `${m.digitos} ${m.digitos === 1 ? "dígito corrigido" : "dígitos corrigidos"}`, ""]));
    }
    baixar(await xlsx([tb.atendimentos, tb.procedimentos, { nome: "Correções", linhas: corr, tipos: ["texto", "texto", "texto", "texto", "texto", "texto", "texto"], filtro: true, larguraMax: 50 }, { nome: "Dicionário", linhas: [["Coluna", "Tipo", "O que é"], ...DICIONARIO], tipos: ["texto", "texto", "quebra"], filtro: false, larguraMax: 90 }, { nome: "Leia-me", linhas: leia, tipos: ["quebra"], cabecalho: false, larguraMax: 110 }]), `odontoscan-${dia}.xlsx`);
  };
}

// fases mostradas durante a importação (o texto de importando.fase começa com a chave)
const FASES = [["abrindo", "Abrir"], ["endireitando", "Endireitar e ler"], ["guardando", "Guardar"], ["\u0000", "Enviar"]]; // a última fase vale quando importando.rotulo (envio para a fila)
// ficha em miniatura com o feixe do scanner passando
const SCANNER = `<div class="os-scanner" aria-hidden="true"><svg viewBox="0 0 120 84"><rect x="6" y="6" width="108" height="72" rx="6" class="sc-papel"/><rect x="12" y="12" width="96" height="60" rx="2" class="sc-quadro"/><path d="M18 22h34M18 30h50M18 38h28M18 46h44M18 54h36M76 22h26M76 30h26M76 38h26M76 46h26M76 54h26M76 62h26" class="sc-linhas"/><path d="M20 62c6-6 10 4 16-2s8 4 14-1" class="sc-caneta"/></svg><i class="sc-feixe"></i></div>`;
const vazio = (ic, tit, txt) => `<div class="os-vazio"><span>${ic}</span><h2>${tit}</h2><p>${txt}</p></div>`;
export const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="tsscg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34E0BD"/><stop offset="1" stop-color="#0B7C70"/></linearGradient><linearGradient id="tsscb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="tsscc"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#tsscg)"/><g clip-path="url(#tsscc)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="5.32" cy="29.58" r="1.9" fill="#FFF59A" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#tsscb)"/><rect x="15" y="11" width="18" height="25" rx="3.2" fill="#fff"/><path d="M19 17.5h10M19 21.5h7M19 29.5h8" stroke="#7FD9C6" stroke-width="1.8" stroke-linecap="round"/><g class="os-feixe"><path d="M9.5 25.3h29" stroke="#FFF59A" stroke-width="2.4" stroke-linecap="round"/><path d="M9.5 25.3h29" stroke="#FFF59A" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/></g><path d="M11 14v-3.5h3.5M37 14v-3.5h-3.5M11 33v3.5h3.5M37 33v3.5h-3.5" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const CADEADO = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10V8a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
// Comparar com o oficial (oficial.js): fichas × produção apresentada ao SUS pelos dois CNES (SIA/SUS)
export function cartaoOficial(base, sia, contagem = null) {
  let cnes = "ambos"; try { cnes = localStorage.getItem("os.siaCnes") || "ambos"; } catch {}
  const chips = `<div class="os-chips-sia">${[["ambos", "Os dois"], ["3523365", "Odontologia"], ["6391915", "CEO III"]].map(([v, nme]) => `<button data-sia-cnes="${v}" class="${v === cnes ? "on" : ""}">${nme}</button>`).join("")}</div>`;
  const cab = `<h3>${IC.painel} Comparar com o oficial</h3><p class="os-sub">As fichas × o que a clínica apresentou ao SUS (SIA/SUS, DATASUS) pelos CNES 3523365 (Unioeste Odontologia) e 6391915 (CEO III Unioeste), pelo código escrito na ficha.</p>`;
  if (!sia) return `<section class="os-cartao os-oficial">${cab}<p class="os-sub">Os dados do SIA ainda não chegaram (vêm junto com a próxima versão do app e do Scanner.zip).</p></section>`;
  const per = (m) => OF.nomeMes(m);
  // um CNES sem nenhuma linha no SIA baixado (em 25/10/2026, o 3523365: a produção toda saiu pelo 6391915, CEO III)
  const sem = Object.keys(OF.CNES).filter(k => !sia.procedimentos?.some(r => r[1] === k));
  const avisoSem = sem.length ? `<p class="os-sub">${sem.map(k => `${k} (${OF.CNES[k]})`).join(" e ")}: nenhuma produção no SIA entre ${per(sia.meses[0])} e ${per(sia.meses[sia.meses.length - 1])}; os procedimentos da clínica aparecem pelo ${Object.keys(OF.CNES).filter(k => !sem.includes(k)).join(" e ")}.</p>` : "";
  if (sem.includes(cnes)) return `<section class="os-cartao os-oficial">${cab}${chips}${avisoSem}</section>`;
  const c = OF.comparar(base, sia, { cnes, contagem });
  if (!c || c.semComum) return `<section class="os-cartao os-oficial">${cab}${chips}<p class="os-sub">Ainda sem meses em comum: o SIA tem ${sia.meses?.length ? `${per(sia.meses[0])} a ${per(sia.meses[sia.meses.length - 1])}` : "nada"}${c?.mesesFichas?.length ? `; as fichas, ${per(c.mesesFichas[0])} a ${per(c.mesesFichas[c.mesesFichas.length - 1])}` : ""}.</p></section>`;
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const mx = Math.max(1, ...c.meses.map(m => Math.max(m.fichas, m.sia)));
  const barras = `<div class="os-sia-barras">${c.meses.map(m => `<div title="${per(m.mes)}: ${m.fichas} nas fichas, ${m.sia} no SIA"><span><i class="f" style="height:${(100 * m.fichas) / mx}%"></i><i class="s" style="height:${(100 * m.sia) / mx}%"></i></span><small>${per(m.mes)}</small></div>`).join("")}</div>
    <p class="os-legenda-sia"><i class="f"></i>Fichas digitalizadas <i class="s"></i>SIA (aprovado)</p>`;
  const linhas = c.procs.slice(0, 14).map(p => `<tr><td><b>${esc(p.codigo)}</b><small>${esc(p.nome)}</small></td><td>${p.fichas}</td><td>${p.sia}${cnes === "ambos" && p.sia ? `<small>${p.porCnes["3523365"] || 0} · ${p.porCnes["6391915"] || 0}</small>` : ""}</td><td class="${p.sia && p.fichas / p.sia < 0.5 ? "baixo" : p.sia && p.fichas / p.sia > 1.2 ? "alto" : ""}">${p.sia ? `${pct(p.fichas, p.sia)}%` : "só nas fichas"}</td></tr>`).join("");
  const dec = c.deciduo.filter(d => d.sia || d.fichas);
  return `<section class="os-cartao os-oficial">${cab}${chips}${cnes === "ambos" ? avisoSem : ""}
    <div class="os-agora-num"><div><b>${c.fichas}</b><small>Procedimentos nas fichas</small></div><div><b>${c.sia}</b><small>Aprovados no SIA</small></div><div><b>${pct(c.fichas, c.sia)}%</b><small>Fichas ÷ SIA</small></div></div>
    <p class="os-sub">Período em comum: ${per(c.periodo[0])} a ${per(c.periodo[1])}. Abaixo de 100%, faltam fichas (ainda não digitalizadas) ou o SIA tem procedimentos que não vão para a ficha; acima, a ficha registrou o que não foi apresentado ou foi glosado.</p>
    ${barras}
    <table class="os-tab-sia"><thead><tr><th>Procedimento</th><th>Fichas</th><th>SIA${cnes === "ambos" ? "<small>Odonto · CEO</small>" : ""}</th><th>%</th></tr></thead><tbody>${linhas}</tbody></table>
    ${c.soNoSIA ? `<p class="os-sub">${c.soNoSIA} ${c.soNoSIA === 1 ? "procedimento aparece" : "procedimentos aparecem"} só no SIA, sem nenhuma ficha no período.</p>` : ""}
    ${dec.length ? `<p class="os-sub">Resina de decíduo: ${dec.map(d => `${d.codigo} tem ${d.sia} no SIA e ${d.fichas} nas fichas`).join("; ")}. Se o SIA tem muitos, os anotados em dente permanente foram faturados com o código de decíduo.</p>` : ""}
  </section>`;
}
export const IC = {
  lote: svg('<rect x="3" y="5" width="15" height="12" rx="2"/><path d="M7 21h13a1 1 0 0 0 1-1V9"/><circle cx="8" cy="9.5" r="1.5"/><path d="m3 15 4-4 4 4 3-2 4 3"/>'),
  pasta: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  num: svg('<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>'),
  ler: svg('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18"/>'),
  rev: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  exp: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  pacote: svg('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
  importar: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  lua: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 3v3M15.5 4.5h3"/>'),
  nuvem: svg('<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.6A3.8 3.8 0 0 1 17.5 18z"/><path d="M12 15v-5M9.8 12 12 9.8l2.2 2.2"/>'),
  raio: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  painel: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  alvo: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
  pessoas: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'),
  copia: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  grade: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 4v16M15 4v16"/>'),
  doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  lixo: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
  mapa: svg('<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  busca: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  pc: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  ia: svg('<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/><path d="m12 9 .9 2.1L15 12l-2.1.9L12 15l-.9-2.1L9 12l2.1-.9z"/>'),
};
