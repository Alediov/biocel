// Ponto de entrada do app.
import { E, salvar, hojeISO, atualizarOfensivaAoAbrir, ofensivaAtiva, definirMultiplicador, definirAjustes } from "./estado.js";
import { iniciarEconomia, multiplicadorAtual, minutosRestantesPocao, consertarSaldos, avancarAutoAbertura } from "./economia.js";
import { aplicarPacotesEmbutidos, pegarMensagens } from "./pacotes.js";
import { modal } from "./ui.js";
import { iniciarDados, temToken } from "./dados.js";
import { telaTrilha, telaTreino, telaLoja, telaPerfil, definirAoMudar, executarSync, aplicarCor, aplicarTema } from "./telas.js";
import { musica, tocar } from "./sons.js";
import { musicaTela, definirEventoMusica } from "./musica.js";
import { telaAgenda, definirAoMudarAgenda } from "./telaAgenda.js";
import { telaDisciplinas, telaDisciplina, definirAoMudarDisciplinas } from "./telaDisciplinas.js";
import { telaCurriculo, definirAoMudarCurriculo } from "./curriculo.js";
import { reagendar } from "./notificacoes.js";
import { ligarSeletores } from "./scan/seletor.js";
import { A } from "./agenda.js";
import { toast } from "./ui.js";
import { multGanho, multMoedas, chanceGema } from "./bonus.js";
import { iniciarColecao } from "./colecao.js";
import { telaColecao, definirAoMudarColecao, celebrarTitulos } from "./telaColecao.js";
import { verificarTitulos } from "./titulos.js";
import { migrarAcessoriosAntigos } from "./telaAvatar.js";
import { telaJogos, definirAoMudarJogos } from "./jogos.js";
import { telaEventos, definirTelaEventos, anunciarEvento } from "./telaEventos.js";
import { eventoAtivo } from "./eventos.js";
import { definirChapeuEvento } from "./colecao.js";
import { desenharDia } from "./telas.js";
import { telaJardim, definirAoMudarJardim } from "./telaJardim.js";
import { telaLiga, mostrarResultadoLiga, atualizarLiga } from "./liga.js";
import { telaDesempenho } from "./desempenho.js";
import { telaCaderno } from "./caderno.js";
import { telaAulas } from "./gravacao/telaGravacao.js";
import { telaTemporada, verificarTemporada, avisoTemporada } from "./temporada.js";
import { ligarTablet } from "./tablet.js";
import { contarNumero, voarAte, transicaoTela, animarEntradaTela, ativarDeslizeAbas, ligarMicrointeracoes } from "./animacoes.js";
import { definirTopo, ligarTopo, atualizarFixos } from "./topo.js";
import { atualizarWidget } from "./widget.js";
import { iniciarAreas, homeAoIniciar } from "./areas.js";
import { atualizarHome } from "./home.js";
import { DEMO } from "./edicao.js";
import "./nuvem.js";
import "./leituraBio.js";
import { telaTrilhas } from "./trilhasDemo.js";
ligarTablet(); // antes de tudo: no tablet, os Estudos já abrem na escala certa

const TELAS = { trilha: DEMO ? telaTrilhas : telaTrilha, treino: telaTreino, jogos: telaJogos, eventos: telaEventos, jardim: telaJardim, agenda: telaAgenda, disciplinas: telaDisciplinas, disciplina: telaDisciplina, curriculo: telaCurriculo, colecao: telaColecao, loja: telaLoja, perfil: telaPerfil,
  liga: () => telaLiga(() => irPara("trilha")), temporada: () => telaTemporada(() => irPara("trilha")), desempenho: () => telaDesempenho(() => irPara("perfil")), caderno: () => telaCaderno(() => irPara("agenda")),
  aulas: () => telaAulas(irPara) }; // gravação das aulas (gravacao/telaGravacao.js)

// Títulos: confere depois de qualquer mudança, mas só celebra quando nada está aberto por cima.
let timerTitulos = null, celebrando = false;
function agendarTitulos(ms = 1200) {
  clearTimeout(timerTitulos);
  timerTitulos = setTimeout(async () => {
    const ocupado = !document.getElementById("camada-licao").hidden || !document.getElementById("modal").hidden || document.querySelector(".abertura") || document.querySelector(".jogo-camada") || document.body.classList.contains("modo-foco");
    if (ocupado || celebrando) return agendarTitulos(2500);
    const novos = verificarTitulos();
    if (!novos.length) return;
    celebrando = true;
    try { await celebrarTitulos(novos); } finally { celebrando = false; }
    const aba = document.querySelector(".aba.ativa")?.dataset.aba;
    if (aba === "perfil") TELAS.perfil();
  }, ms);
}

const mostrado = { xp: null, moedas: null, gemas: null };
let timerTemporada = null, timerMeuDia = null;
function atualizarTopo() {
  const est = E();
  // ganhos novos voam até o contador; depois o número conta (o XP do topo é o XP de hoje)
  const livre = document.getElementById("camada-licao").hidden && !document.querySelector(".jogo-camada");
  for (const [tipo, id, v] of [["xp", "v-xp", est.diario[hojeISO()]?.xp || 0], ["moedas", "v-moedas", est.moedas], ["gemas", "v-gemas", est.gemas || 0]]) {
    const el = document.getElementById(id), antes = mostrado[tipo];
    if (!livre && antes != null && v > antes) continue; // espera a lição ou o jogo fechar para voar
    mostrado[tipo] = v;
    if (antes == null || v <= antes) { contarNumero(el, v, { ms: antes == null ? 0 : 450 }); continue; }
    voarAte(tipo, el.closest(".chip"), v - antes).then(() => { contarNumero(el, v); if (tipo !== "xp") tocar("moeda"); });
  }
  atualizarFixos();
  atualizarWidget();
  atualizarHome(); // a Home do Órbita aberta acompanha os números
  if (!DEMO) { clearTimeout(timerMeuDia); timerMeuDia = setTimeout(() => { import("./meuDia.js").then(m => m.enviarAoWidget()).catch(() => {}); if (E().financas) import("./financas/ponte.js").then(m => { m.enviarAoWidget(); m.conferirParado().catch(() => {}); }).catch(() => {}); if (E().eva?.desde) import("./eva/eva.js").then(m => m.aoMudarDia()).catch(() => {}); }, 3000); }
  if (livre && !document.querySelector(".abertura")) { clearTimeout(timerTemporada); timerTemporada = setTimeout(verificarTemporada, 900); }
  agendarTitulos();
}

export function irPara(aba) {
  document.querySelectorAll(".aba").forEach(b => b.classList.toggle("ativa", b.dataset.aba === aba || (["treino", "jogos", "eventos", "jardim", "liga", "temporada"].includes(aba) && b.dataset.aba === "trilha") || (aba === "desempenho" && b.dataset.aba === "perfil") || (["caderno", "aulas"].includes(aba) && b.dataset.aba === "agenda") || (aba === "disciplina" && b.dataset.aba === "disciplinas")));
  document.getElementById("tela").scrollTop = 0;
  TELAS[aba]();
  animarEntradaTela();
  transicaoTela(aba);
  musicaTela(["jogos", "jardim", "eventos"].includes(aba) ? aba : "trilha");
}

async function mostrarMensagens() {
  try { await (await import("./resumoSemana.js")).avisoSemana(); } catch (e) { console.warn("resumo da semana:", e); }
  const at = avisoTemporada();
  if (at) await modal({ titulo: at.titulo, texto: at.texto, botoes: [{ texto: "Ver a nova temporada", valor: true }] });
  for (const m of pegarMensagens()) await modal({ titulo: m.titulo, texto: m.texto, botoes: [{ texto: "Ver", valor: true }] });
  atualizarTopo();
  if (document.querySelector(".aba.ativa")?.dataset.aba === "trilha") TELAS.trilha();
}

// saldo negativo e abertura automática dos baús (economia.js, 02/11/2026)
function cuidarDaEconomia() {
  try {
    const t = consertarSaldos();
    if (t) setTimeout(() => toast(t, 6000), 1500);
    if (avancarAutoAbertura()) window.dispatchEvent(new Event("oq-baus"));
  } catch (e) { console.warn("economia:", e); }
}

async function iniciar() {
  aplicarTema(); aplicarCor();
  import("./aparencia.js").then(m => m.iniciarAparencia()).catch(e => console.warn("aparência", e));
  // Home do Órbita na abertura (home.js; config.abrirEm): logo de cara, antes da sincronia e dos dados
  if (!DEMO) homeAoIniciar().catch(e => console.warn("Home:", e));
  definirAoMudar(atualizarTopo); definirAoMudarAgenda(atualizarTopo); definirAoMudarDisciplinas(atualizarTopo); definirAoMudarCurriculo(atualizarTopo); definirAoMudarColecao(atualizarTopo);
  definirMultiplicador(multiplicadorAtual);
  definirAjustes({ ganho: multGanho, moedasLicao: multMoedas, chanceGema });
  iniciarEconomia();
  iniciarColecao();
  definirChapeuEvento(eventoAtivo()?.chapeu || null);
  definirAoMudarJogos(atualizarTopo);
  definirAoMudarJardim(atualizarTopo);
  definirTelaEventos({ mudou: atualizarTopo, desenharDia });
  migrarAcessoriosAntigos();
  // com a sessão da tarde, a meta padrão passou de 8 para 12 lições
  const cfg = E().config;
  if (!cfg.metaTarde) { if (cfg.meta === 8) cfg.meta = 12; cfg.metaTarde = true; salvar(); }
  // com a lição-jogo em cada sessão (19/10/2026), cada sessão tem 5 lições: 4→5, 8→10, 12→15
  // Demo: meta inicial de 10 lições (as etapas têm 4 ou 5)
  if (DEMO && !cfg.demoIniciada) { cfg.meta = 10; cfg.metaJogos = true; cfg.metaTarde = true; cfg.demoIniciada = true; salvar(); }
  if (!cfg.metaJogos) { cfg.meta = { 4: 5, 8: 10, 12: 15 }[cfg.meta] || cfg.meta; cfg.metaJogos = true; salvar(); }
  A();
  document.querySelectorAll(".aba").forEach(b => (b.onclick = () => irPara(b.dataset.aba)));
  definirTopo(irPara); ligarTopo();
  window.addEventListener("oq-topo", atualizarTopo);
  // progresso entre aparelhos (sincronia.js): antes de conferir a ofensiva, para o tablet não achar que ela quebrou
  if (!DEMO) {
    const S = await import("./sincronia.js");
    const ocupado = () => !document.getElementById("camada-licao").hidden || !!document.querySelector(".jogo-camada");
    const mudou = () => { cuidarDaEconomia(); atualizarTopo(); window.dispatchEvent(new Event("oq-colecao")); };
    const sinc = S.iniciarSincronia({ ocupado, mudou });
    await Promise.race([sinc, new Promise(ok => setTimeout(ok, 4000))]);
    sinc.finally(cuidarDaEconomia); // depois de receber o que veio do outro aparelho
  } else cuidarDaEconomia();
  const r = atualizarOfensivaAoAbrir();
  if (r.usou) toast(`Um congelamento protegeu sua ofensiva (${r.usou} dia sem estudar).`, 4000);
  else if (r.perdeu) toast(`Sua ofensiva de ${r.anterior} dias acabou. Bora começar outra hoje!`, 4000);
  atualizarTopo();
  await iniciarDados();
  if (!DEMO) await aplicarPacotesEmbutidos();
  irPara("trilha");
  if (!DEMO) import("./alarmes.js").then(m => m.iniciarAlarmes()).catch(e => console.warn("alarmes:", e));
  if (!DEMO) import("./gravacao/gravacao.js").then(m => m.iniciarGravacao()).catch(e => console.warn("gravação:", e));
  if (!DEMO) import("./even3.js").then(m => m.iniciarEven3()).catch(e => console.warn("Even3:", e));
  if (!DEMO) import("./ideias/transcricoes.js").then(m => m.iniciarTranscricoes()).catch(e => console.warn("transcrições:", e)); // legendas da antena de ideias pelo celular (09/11/2026)
  if (!DEMO) import("./whatsapp/whatsapp.js").then(m => m.iniciarWhats()).catch(e => console.warn("WhatsApp:", e)); // avisos dos grupos (04/11/2026)
  if (!DEMO) import("./eva/eva.js").then(m => m.iniciarEva()).catch(e => console.warn("Eva:", e)); // a companheira de rotina (04/11/2026)
  if (!DEMO) { iniciarAreas(); import("./foco.js").then(m => m.iniciarFoco()).catch(e => console.warn("foco:", e)); import("./musicas/estudos.js").then(m => m.iniciarMusicaPropria()).catch(e => console.warn("Músicas:", e)); }
  await mostrarMensagens();
  await anunciarEvento();
  await mostrarResultadoLiga();
  setInterval(atualizarTopo, 30000);

  // versão nova do app (atualizacao.js): procura uma vez por dia, 8 s depois de abrir
  if (!DEMO) setTimeout(() => import("./atualizacao.js").then(m => m.verificarAtualizacao()).catch(() => {}), 8000);
  // ao abrir com internet: sincroniza se a última foi há mais de 20 minutos
  const ult = E().ultimaSync ? Date.parse(E().ultimaSync) : 0;
  if (temToken() && navigator.onLine && Date.now() - ult > 20 * 60000) executarSync(null, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { cuidarDaEconomia(); atualizarOfensivaAoAbrir(); if (atualizarLiga()) mostrarResultadoLiga(); atualizarTopo(); reagendar(); definirChapeuEvento(eventoAtivo()?.chapeu || null); anunciarEvento(); }
  });
  // navegador exige um toque antes de tocar música
  definirEventoMusica(() => eventoAtivo()?.id || null);
  if (E().config.musica) document.addEventListener("pointerdown", () => musica(true), { once: true });
  window.addEventListener("oq-lembretes", reagendar);
  let syncTimer = null;
  // tamanho do dia (tamanhoDia.js): os próximos 14 dias pela Agenda, que o gerador da madrugada lê no estado sincronizado
  const planejar = () => import("./tamanhoDia.js").then(m => m.planejarDias()).catch(e => console.warn("tamanho do dia", e));
  setTimeout(planejar, 4000);
  // a validade do token do GitHub (ajustes.js): uma vez por dia, pelo cabeçalho da API (só no Android)
  setTimeout(() => import("./ajustes.js").then(m => m.conferirValidade()).then(() => window.dispatchEvent(new Event("oq-topo"))).catch(() => {}), 25000);
  window.addEventListener("oq-agenda", () => {
    planejar(); reagendar(); atualizarTopo();
    clearTimeout(syncTimer);
    if (temToken() && navigator.onLine) syncTimer = setTimeout(() => executarSync(null, true), 8000);
  });
  window.addEventListener("oq-ir", (e) => irPara(e.detail));
  // as notas e faltas mudaram (Agenda, sincronização): a aba Disciplinas aberta acompanha
  window.addEventListener("oq-disciplinas", () => { const a = document.querySelector(".aba.ativa")?.dataset.aba; if (a === "disciplinas" && !document.querySelector(".voltar")) TELAS.disciplinas(); });
  ativarDeslizeAbas(irPara);
  ligarMicrointeracoes(() => E().config.vibrar !== false);
  ligarSeletores();
  window.addEventListener("oq-baus", () => { reagendar(); atualizarTopo(); });
  window.addEventListener("oq-mensagens", mostrarMensagens);
  window.addEventListener("oq-titulos", () => agendarTitulos(400));
  window.addEventListener("oq-colecao", () => { atualizarTopo(); if (document.querySelector(".aba.ativa")?.dataset.aba === "trilha") TELAS.trilha(); });
  reagendar();
}

iniciar();
