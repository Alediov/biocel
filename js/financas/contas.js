// Finanças (6ª área do Órbita, pedido do Alediov em 27/10/2026): as contas, sem DOM e sem rede, para dar para testar no
// node (tools/teste_financas.mjs). Tudo mora em E().financas e vai junto na sincronização entre aparelhos (juntar.js):
// por isso cada registro que pode mudar (lançamento, categoria, entrada fixa, coleta, execução, ajustes) é um objeto com
// `em` (data ISO), e a junção fica com o mais recente inteiro; nenhum contador inteiro solto (seriam somados), e o
// último comentário lido se chama `maxComentario` (a junção fica com o maior).

// ---------------------------------------------------------------- dinheiro e datas
const fmtBR = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "R$ 1.234,56" (negativo: "−R$ 12,00"). `curto`: sem centavos quando é redondo. */
export function reais(v, { curto = false, sinal = false } = {}) {
  const n = Math.round((+v || 0) * 100) / 100, a = Math.abs(n);
  const txt = curto && Number.isInteger(a) ? a.toLocaleString("pt-BR") : fmtBR.format(a);
  return `${n < 0 ? "−" : sinal && n > 0 ? "+" : ""}R$ ${txt}`;
}
/** "US$ 1,23" (com 2 casas; abaixo de 1 centavo, 4 casas). */
export function dolares(v, { sinal = false } = {}) {
  const n = +v || 0, a = Math.abs(n);
  const txt = a > 0 && a < 0.01 ? a.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : fmtBR.format(a);
  return `${n < 0 ? "−" : sinal && n > 0 ? "+" : ""}US$ ${txt}`;
}
/** Lê um número escrito de qualquer jeito: "1,23", "$1.23", " 1.234,56 ", "US$ 0,5", "1,234.56". NaN se não houver. */
export function numero(txt) {
  if (typeof txt === "number") return txt;
  let s = String(txt ?? "").replace(/(US|R)?\$|\s|^[a-zA-Z]+|[a-zA-Z]+$/g, "").trim();
  if (!/\d/.test(s) || /[{}=]/.test(s)) return NaN;
  const neg = /^[-−]/.test(s); s = s.replace(/^[-−+]/, "");
  const ultP = s.lastIndexOf("."), ultV = s.lastIndexOf(",");
  if (ultP >= 0 && ultV >= 0) { // os dois: o último é o decimal
    const dec = ultP > ultV ? "." : ",", mil = dec === "." ? "," : ".";
    s = s.split(mil).join("").replace(dec, ".");
  } else if (ultV >= 0) s = (s.match(/,/g).length > 1 ? s.split(",").join("") : s.replace(",", "."));
  else if ((s.match(/\./g) || []).length > 1) s = s.split(".").join("");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
  const n = parseFloat(s);
  return neg ? -n : n;
}
/** Centavos digitados no teclado de dinheiro ("1.234,56") → 1234.56. */
export const deCampo = (txt) => { const d = String(txt || "").replace(/\D/g, ""); return d ? +d / 100 : 0; };
/** 1234.5 → "1.234,50" (para o campo com o teclado de dinheiro). */
export const paraCampo = (v) => (v ? fmtBR.format(Math.abs(v)) : "");

const doisDig = (n) => String(n).padStart(2, "0");
/** Data local (AAAA-MM-DD) de um instante. */
export function diaLocal(iso) { const d = new Date(iso); return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`; }
export const mesDe = (dia) => String(dia).slice(0, 7);
export function somaMes(mes, n) { const [a, m] = mes.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}`; }
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (mes, { ano = true, curto = false } = {}) => { const [a, m] = mes.split("-").map(Number); const n = MESES[m - 1]; const t = curto ? n.slice(0, 3) : n; return ano ? `${t} de ${a}` : t; };
export const diasNoMes = (mes) => { const [a, m] = mes.split("-").map(Number); return new Date(a, m, 0).getDate(); };
const difDias = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const maisDias = (dia, n) => { const d = new Date(dia + "T12:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`; };
const r2 = (v) => Math.round(v * 100) / 100;
export const novoId = (pref = "l") => `${pref}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------------------------------------------------------------- estado inicial
// Cores das categorias: as 8 da paleta categórica (ordem fixa; nunca sorteada), com o passo do tema escuro no CSS.
export const CORES = 8;
export const FORMAS = ["Pix", "Débito", "Crédito", "Dinheiro", "Boleto", "PayPal", "Outra"];
const CAT_PADRAO = [
  // saídas (com limite mensal no Orçamento)
  { id: "materiais", nome: "Materiais", icone: "🧰", tipo: "saida", cor: 1, ordem: 1, peso: 35 },
  { id: "cursos", nome: "Cursos", icone: "🎓", tipo: "saida", cor: 2, ordem: 2, peso: 25 },
  { id: "eventos", nome: "Eventos", icone: "🎫", tipo: "saida", cor: 3, ordem: 3, peso: 20 },
  // Comida e Transporte (pedido do Alediov, 27/10/2026): sem peso; a sugestão calcula pela Agenda (`sugerirOrcamento`)
  { id: "comida", nome: "Comida", icone: "🍽️", tipo: "saida", cor: 5, ordem: 3.4, calc: "almoco" },
  { id: "transporte", nome: "Transporte", icone: "🚌", tipo: "saida", cor: 7, ordem: 3.7, calc: "passagens" },
  // Assinaturas (30/10/2026: a do Claude, como saída fixa): o limite sugerido é a soma das saídas fixas dela
  { id: "assinaturas", nome: "Assinaturas", icone: "🔁", tipo: "saida", cor: 6, ordem: 3.9, calc: "fixas" },
  // Contas (09/11/2026: o crédito do celular, R$ 20 por mês): como as Assinaturas, o limite sugerido é a soma das fixas dela
  { id: "contas", nome: "Contas", icone: "🧾", tipo: "saida", cor: 8, ordem: 3.95, calc: "fixas" },
  { id: "outros", nome: "Outros", icone: "🏷️", tipo: "saida", cor: 4, ordem: 4, peso: 20 },
  // entradas
  { id: "familia", nome: "Família", icone: "🎁", tipo: "entrada", cor: 5, ordem: 1 },
  { id: "bolsa", nome: "Bolsa", icone: "🏦", tipo: "entrada", cor: 7, ordem: 2 },
  { id: "faucets", nome: "Faucets e check-ins", icone: "🪙", tipo: "entrada", cor: 6, ordem: 3 },
  { id: "farms", nome: "Farms", icone: "🎮", tipo: "entrada", cor: 8, ordem: 4 },
  { id: "pingpong", nome: "Ping-Pong", icone: "🏓", tipo: "entrada", cor: 1, ordem: 5 },
  { id: "outras", nome: "Outras entradas", icone: "💵", tipo: "entrada", cor: 3, ordem: 6 },
];
// entradas fixas do pedido (27/10/2026): mãe R$ 300, vó R$ 100 e a bolsa R$ 700 a partir de novembro/2026.
// O dia em que chegam "varia muito" (resposta do Alediov, 27/10/2026): sem dia certo, a entrada só fica "devida" no
// último dia do mês e "atrasada" depois dele; o dia previsto é opcional (editável na entrada fixa).
const FIXA_CLAUDE = { id: "claude", tipo: "saida", nome: "Assinatura do Claude", icone: "🤖", valor: null, dia: null, desde: "2026-11", ate: null, cat: "assinaturas", ordem: 10 };
// o crédito do celular (pedido do Alediov, 09/11/2026): R$ 20 por mês, desde novembro/2026, na categoria Contas
const FIXA_CELULAR = { id: "celular", tipo: "saida", nome: "Crédito do celular", icone: "📱", valor: 20, dia: null, desde: "2026-11", ate: null, cat: "contas", ordem: 11 };
const FIXAS_PADRAO = [
  { id: "mae", nome: "Mãe", icone: "👩", valor: 300, dia: null, desde: "2026-11", ate: null, cat: "familia", ordem: 1 },
  { id: "vo", nome: "Vó", icone: "👵", valor: 100, dia: null, desde: "2026-11", ate: null, cat: "familia", ordem: 2 },
  { id: "bolsa", nome: "Bolsa", icone: "🏦", valor: 700, dia: null, desde: "2026-11", ate: null, cat: "bolsa", ordem: 3 },
];
/** As fontes que mandam o registro pela issue #1 (27/10/2026: Slice, EarnApp, Earn Bitcoin e ZBD, cada uma com a sua
 *  macro, e o orquestrador, que roda as outras em sequência de madrugada). `un`: a unidade do saldo quando ainda não
 *  houve coleta (null = a macro só diz se deu certo); `minUn`: a unidade do mínimo de saque (editável por fonte). */
export const FONTES = {
  slice: { nome: "Slice", site: "addslice.com", un: "usd", minUn: "usd", pontos: true, desc: "Check-in diário · acumula em pontos (1.000 = US$ 1)" },
  earnapp: { nome: "EarnApp", curto: "Celular secundário", conta: "earnapp", site: "earnapp.com", un: "usd", minUn: "usd", desc: "Saldo em US$ e o tempo compartilhado" },
  earnbitcoin: { nome: "Earn Bitcoin", un: "sats", minUn: "sats", manual: true, ciclo: { dias: 7, premio: 150 }, desc: "Recompensa diária · o saldo é informado à mão" },
  zbd: { nome: "ZBD", site: "zbd.gg", un: "sats", minUn: "brl", manual: true, rotuloSeq: "Sequência da enquete", desc: "Enquete diária · o saldo é informado à mão" },
  // EarnApp nos outros aparelhos (pedido do Alediov, 02/11/2026: "o saldo real que eu tenho no EarnApp é a soma de todas
  // as contas"): uma conta por aparelho, cada uma com a sua macro às 03:00 (reserva às 03:20; `ate`: só depois das 4h
  // a falta vira "não rodou"); a do PC fica sem automação e desligada até ele ligar (saldo à mão)
  earnappprincipal: { nome: "EarnApp · celular principal", curto: "Celular principal", conta: "earnapp", un: "usd", minUn: "usd", ate: 4, desc: "Conta do celular principal · a macro roda às 03:00 (reserva às 03:20)" },
  earnapptablet: { nome: "EarnApp · tablet", curto: "Tablet", conta: "earnapp", un: "usd", minUn: "usd", ate: 4, desc: "Conta do tablet · a macro roda às 03:00 (reserva às 03:20)" },
  earnapppc: { nome: "EarnApp · PC", curto: "PC", conta: "earnapp", un: "usd", minUn: "usd", manual: true, semMacro: true, opcional: true, desc: "Conta do PC · sem automação, saldo à mão" },
  // Bump (pedido do Alediov, 09/11/2026): paga em R$ por internet compartilhada (hotspot) no celular principal; a macro
  // liga o hotspot às 03:10 (reserva às 03:40) e lê «No total» (os ganhos) antes de ligar. Saque a partir de R$ 20.
  bump: { nome: "Bump", un: "brl", minUn: "brl", ate: 5, desc: "Hotspot no celular principal · a macro liga às 03:10 (reserva às 03:40)" },
  orquestrador: { nome: "Ronda", un: null, semSaldo: true, desc: "Roda os check-ins em sequência de madrugada" },
  pingpong: { nome: "Ping-Pong", un: null, semSaldo: true, desc: "ARQ ↔ 99, MP e AST nos horários de corte" },
  desbloqueio: { nome: "Desbloqueio", un: null, semSaldo: true, desc: "Desbloqueia o celular secundário (só registra quando falha)" },
};
export const nomeFonte = (id) => FONTES[id]?.nome || id;
/** Os grupos de automação (pedido do Alediov): os check-ins funcionam desde 27/10/2026; o Ping-Pong desde 30/10/2026 (as
 *  macros ida/volta de cada banco registram com fonte=pingpong). As farms não serão automatizadas (30/10/2026: dão muito
 *  trabalho e pouco lucro); o que render delas entra à mão, na categoria Farms. */
export const AUTOMACOES = [
  { id: "checkins", nome: "Check-ins", icone: "✅", desc: "Só o login diário", fontes: [
    { id: "slice", nome: "Slice", ativa: true, site: "addslice.com" }, { id: "earnapp", nome: "EarnApp", ativa: true, site: "earnapp.com" },
    { id: "earnbitcoin", nome: "Earn Bitcoin", ativa: true }, { id: "zbd", nome: "ZBD", ativa: true, site: "zbd.gg" }] },
  { id: "pingpong", nome: "Ping-Pong", icone: "🏓", desc: "O mesmo dinheiro rendendo pelo CDI em vários bancos no dia, em pix de até R$ 5 mil", fontes: [
    { id: "pingpong", nome: "Ping-Pong", ativa: true }] },
  { id: "compartilhar", nome: "Internet compartilhada", icone: "📶", desc: "O celular principal como hotspot, de madrugada", fontes: [
    { id: "bump", nome: "Bump", ativa: true }] },
];
export const FONTES_ATIVAS = ["slice", "earnapp", "earnbitcoin", "zbd"];
/** As contas do EarnApp (02/11/2026): a do celular secundário (a da Ronda), as dos outros aparelhos e a do PC. */
export const CONTAS_EARNAPP = ["earnapp", "earnappprincipal", "earnapptablet", "earnapppc"];
/** As macros que rodam fora da Ronda, cada uma no seu aparelho (contam na saúde do dia: Meu dia, Para conferir). */
export const FONTES_APARELHOS = ["earnappprincipal", "earnapptablet", "bump"];
/** As fontes cuja macro pode falhar no dia (o que o Meu dia e o "Para conferir" olham). */
export const FONTES_SAUDE = [...FONTES_ATIVAS, ...FONTES_APARELHOS];
/** As fontes com o saldo em R$ (`brl=` no registro, guardado em coletas[fonte][dia].brl): hoje só o Bump. Não entram em
 *  "Seu dinheiro" (como o EarnApp: é dinheiro a receber até o saque). */
export const FONTES_REAIS = Object.keys(FONTES).filter(id => FONTES[id].un === "brl");

// Respostas do Alediov (27/10/2026): guardar mais (padrão 20%, de 0 a 50%), mínimo de saque do Slice US$ 10, almoço de
// R$ 4 no cartão e a recarga do cartão de passagens de R$ 47 = 20 passagens (2 por dia de aula).
export const RESERVA_PADRAO = 20, RESERVA_MAX = 50;
export const MINIMO_SLICE = 10;
/** Mínimos de saque padrão (respostas do Alediov, 27/10/2026): Slice e EarnApp US$ 10, Earn Bitcoin 1.500 sats; ZBD
 *  vazio até ele confirmar. */
export const MINIMOS_PADRAO = { slice: MINIMO_SLICE, earnapp: 10, earnbitcoin: 1500, zbd: 100, earnappprincipal: 10, earnapptablet: 10, earnapppc: 10, bump: 20 };
/** ZBD (pedido do Alediov, 30/10/2026): saca quando quiser, mas tem taxa, então só depois de passar de R$ 100 (o mínimo
 *  dela é em R$, convertido em sats pelo bitcoin do dia). */
export const MINIMO_ZBD_REAIS = 100;
export const ALMOCO_PADRAO = 4, RECARGA_PADRAO = { valor: 47, passagens: 20 }, PASSAGENS_POR_DIA = 2, DIAS_AULA_PADRAO = 22;

/** Garante E().financas com o que falta (sem trocar o que já existe; as categorias novas entram nos estados antigos, e
 *  os padrões antigos que ele não mexeu, como guardar 10% e o mínimo de saque vazio, passam para os novos). */
export function garantir(e, agora = new Date().toISOString()) {
  const f = e.financas ||= {};
  f.v ||= 1;
  f.categorias ||= {};
  for (const c of CAT_PADRAO) if (!f.categorias[c.id]) { const { peso, calc, ...resto } = c; f.categorias[c.id] = { ...resto, limite: null, em: agora }; } // apagada fica apagada
  if (!f.fixas) { f.fixas = {}; for (const x of FIXAS_PADRAO) f.fixas[x.id] = { ...x, em: agora }; }
  // saídas fixas (pedido do Alediov, 30/10/2026): a assinatura do Claude (Max agora, Pro depois), sem valor até ele pôr
  if (!f.fixas.claude) f.fixas.claude = { ...FIXA_CLAUDE, em: agora };
  // o crédito do celular entra uma vez (`fixaCelular`): apagado por ele (some do mapa ou fica `apagada`), não volta
  if (!f.fixaCelular) { if (!f.fixas.celular) f.fixas.celular = { ...FIXA_CELULAR, em: agora }; f.fixaCelular = agora; }
  // as fixas só começam em novembro/2026 (resposta dele, 30/10/2026: "este mês já não posso gastar mais nada"): Mãe, Vó e a
  // assinatura criadas desde outubro passam para novembro, se não houver recebimento ou pagamento delas em outubro
  if (!f.fixasNovembro) {
    for (const id of ["mae", "vo", "claude"]) {
      const fx = f.fixas[id];
      if (fx && fx.desde === "2026-10" && !Object.values(f.lanc || {}).some(l => !l.apagado && l.fixa === id && (l.ref || mesDe(l.data)) === "2026-10"))
        f.fixas[id] = { ...fx, desde: "2026-11", em: agora };
    }
    f.fixasNovembro = agora;
  }
  f.lanc ||= {}; f.coletas ||= {}; f.execucoes ||= {}; f.cotacoes ||= {}; f.pulos ||= {}; f.ignorados ||= {};
  f.fontes ||= { slice: { minimoSaque: MINIMO_SLICE, em: agora } };
  for (const id of [...FONTES_ATIVAS, ...CONTAS_EARNAPP, ...FONTES_REAIS]) f.fontes[id] ||= { minimoSaque: MINIMOS_PADRAO[id] ?? null, em: agora }; // ZBD: vazio até ele confirmar
  f.telas ||= {};
  // ZBD: o mínimo passou a ser em R$ (30/10/2026); o antigo (em sats, vazio por padrão) não vale mais
  if (f.fontes.zbd && f.fontes.zbd.un !== "brl") f.fontes.zbd = { minimoSaque: MINIMO_ZBD_REAIS, un: "brl", em: agora };
  // o mínimo vazio era o padrão antigo; só fica vazio se ele apagou depois (`minimoManual`)
  for (const [id, v] of Object.entries(MINIMOS_PADRAO)) { const x = f.fontes[id]; if (x && x.minimoSaque == null && !x.minimoManual) f.fontes[id] = { ...x, minimoSaque: v, em: agora }; }
  f.ajustes ||= { reservaPct: RESERVA_PADRAO, apagarImportados: false, avisoSemColeta: false, cotacaoManual: null, em: agora };
  // 10% era o padrão antigo: sem a marca de escolha à mão (`reservaManual`, gravada pelo Orçamento), vira o padrão novo
  if ((f.ajustes.reservaPct ?? 10) === 10 && !f.ajustes.reservaManual) f.ajustes = { ...f.ajustes, reservaPct: RESERVA_PADRAO, em: agora };
  if (typeof f.maxComentario !== "number") f.maxComentario = 0;
  return f;
}
/** Valor do almoço e da recarga (ajustáveis no Orçamento). */
export const almoco = (f) => f.ajustes?.almoco > 0 ? f.ajustes.almoco : ALMOCO_PADRAO;
export const recarga = (f) => ({ valor: f.ajustes?.recargaValor > 0 ? f.ajustes.recargaValor : RECARGA_PADRAO.valor, passagens: f.ajustes?.recargaPassagens > 0 ? Math.round(f.ajustes.recargaPassagens) : RECARGA_PADRAO.passagens });
export const categorias = (f, tipo = null) => Object.values(f.categorias).filter(c => !c.apagada && (!tipo || c.tipo === tipo)).sort((a, b) => (a.ordem || 99) - (b.ordem || 99) || a.nome.localeCompare(b.nome));
export const pesoPadrao = (id) => CAT_PADRAO.find(c => c.id === id)?.peso ?? null;
/** "almoco" (Comida) ou "passagens" (Transporte): categorias cuja sugestão sai de uma conta, não de um peso. */
export const calculoDe = (id) => CAT_PADRAO.find(c => c.id === id)?.calc ?? null;

// ---------------------------------------------------------------- registro das macros (comentários da issue)
// Cada linha que começa com "orbita-financas" é um evento de uma execução de macro:
//   orbita-financas fonte=slice;evento=inicio|tentativa|etapa|fim|erro;run=<AAAA-MM-DD_HHMMSS>;tentativa=N;etapa=Leitura;
//     sats=8734;usd=6.95;sequencia=5;msg=…
// Só `fonte` é obrigatória. O Slice acumula em PONTOS (1.000 = US$ 1; o dia N da sequência dá N pontos): `usd` é o que
// de fato cresce; `sats` é só a conversão pelo bitcoin do momento (prints do Alediov, 01/11/2026: 9.031 sats em 31/10 e
// 8.983 em 01/11 com os pontos subindo; antes o app contava em sats e uma queda do bitcoin virava saque). `usd` também (`saldo` vale como `usd`, o nome da primeira versão). Sem `evento`, a linha com valores vale como "fim".
// Sem `run`, a execução é a do dia (a macro roda uma vez por dia, 00:10). O dia da execução sai do começo do `run`
// (AAAA-MM-DD…), ou da data do comentário.
const APELIDOS = { seq: "sequencia", streak: "sequencia", dias: "sequencia", sequência: "sequencia", ofensiva: "sequencia", saldo: "usd", balance: "usd", valor: "usd", dolar: "usd", dolares: "usd",
  sat: "sats", satoshis: "sats", satoshi: "sats",
  source: "fonte", event: "evento", step: "etapa", id: "run", execucao: "run", execução: "run", mensagem: "msg", message: "msg", erro: "msg",
  time: "tempo", compartilhado: "tempo", ready: "pronto", disponivel: "pronto", saque: "pronto", screen: "tela", texto: "tela" };
// as chaves que o app entende; as outras vão para `extras` (não quebram nada)
const CONHECIDAS = new Set(["fonte", "evento", "run", "tentativa", "etapa", "sats", "usd", "sequencia", "msg", "data", "tempo", "pronto", "tela", "brl", "ret", "dep", "rendc", "banco", "passo"]);
const MAX_TELA = 6000;
const EVENTOS = { inicio: "inicio", início: "inicio", start: "inicio", tentativa: "tentativa", retry: "tentativa", etapa: "etapa", step: "etapa", fim: "fim", end: "fim", ok: "fim", erro: "erro", error: "erro", falha: "erro", tela: "tela", screen: "tela", leitura: "tela" };
const temValor = (o) => Number.isFinite(o.sats) || Number.isFinite(o.usd);
const temDado = (o) => temValor(o) || Number.isFinite(o.sequencia) || !!o.tempo || typeof o.pronto === "boolean";
const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lê um corpo de comentário. Devolve a lista de eventos (um por linha "orbita-financas"), cada um com os campos e os erros.
 *  `tela=` (a leitura da tela inteira, para o reconhecimento) vai até o fim do comentário (ou até a próxima linha
 *  "orbita-financas"), com ";" e quebras de linha dentro; chaves desconhecidas vão para `campos.extras`. */
export function lerComentario(corpo) {
  const out = [], linhas = String(corpo || "").split(/\r?\n/);
  const ehLinha = (l) => /^[\s`>*_-]*orbita[-_ ]?finan[cç]as\b/i.test(l);
  for (let n = 0; n < linhas.length; n++) {
    const linha = linhas[n].replace(/^[\s`>*_-]+|[\s`*_]+$/g, "");
    const m = linha.match(/^orbita[-_ ]?finan[cç]as\b[:\s]*(.*)$/i);
    if (!m) continue;
    let resto = m[1], tela = null;
    const t = resto.match(/(?:^|[;|])\s*(?:tela|screen)\s*=/i);
    if (t) { // o texto da tela: o resto da linha e as linhas seguintes
      tela = resto.slice(t.index + t[0].length);
      resto = resto.slice(0, t.index);
      const mais = [];
      while (n + 1 < linhas.length && !ehLinha(linhas[n + 1])) mais.push(linhas[++n]);
      if (mais.length) tela += "\n" + mais.join("\n");
      tela = tela.replace(/[\s`]+$/, "").trim().slice(0, MAX_TELA);
    }
    const ev = { campos: {}, erros: [] };
    for (const par of resto.split(/[;|]/)) {
      const i = par.indexOf("="); if (i < 0) { if (par.trim()) ev.erros.push(`sem "=": ${par.trim().slice(0, 40)}`); continue; }
      let k = semAcento(par.slice(0, i).trim().toLowerCase()).replace(/[\s-]+/g, "_");
      k = APELIDOS[k] || k;
      const v = par.slice(i + 1).trim();
      if (/\{[^}]*\}|\[v=|\{v=/.test(v)) { ev.erros.push(`${k}: a variável não foi trocada (${v.slice(0, 40)})`); continue; } // o MacroDroid mandou o texto mágico cru
      if (k === "sats" || k === "sequencia" || k === "tentativa") { // inteiros: "8,734", "8.734" e "8 734" são 8734
        const d = v.replace(/[^\d]/g, "");
        if (d && /^[\s\d.,]*\s*(sats?|dias?|days?)?$/i.test(v)) ev.campos[k] = parseInt(d, 10);
        else if (v) ev.erros.push(`${k}: "${v.slice(0, 30)}" não é número`);
      } else if (k === "usd") {
        const x = numero(v);
        if (Number.isFinite(x)) ev.campos.usd = x;
        else if (v) ev.erros.push(`usd: "${v.slice(0, 30)}" não é número`);
      } else if (k === "brl") { // o saldo do Render (Ping-Pong): "4215,74", "4.215,74"
        const x = numero(v);
        if (Number.isFinite(x) && x >= 0) ev.campos.brl = x;
        else if (v) ev.erros.push(`brl: "${v.slice(0, 30)}" não é número`);
      } else if (k === "ret" || k === "dep") { // Ping-Pong: o que a ida tirou do Render e o que o Render guardou
        const x = numero(v);
        if (Number.isFinite(x) && x >= 0) ev.campos[k] = x;
        else if (v) ev.erros.push(`${k}: "${v.slice(0, 30)}" não é número`);
      } else if (k === "rendc") { // Ping-Pong: o rendimento que a volta mandou ao ARQ, em centavos ("003")
        if (/^\d{1,9}$/.test(v)) ev.campos.rend = parseInt(v, 10) / 100;
        else if (v) ev.erros.push(`rendc: "${v.slice(0, 30)}" não é número`);
      } else if (k === "banco" || k === "passo") { const x = semAcento(v.toLowerCase()).replace(/[^a-z0-9]/g, ""); if (x) ev.campos[k] = x.slice(0, 12); }
      else if (k === "pronto") {
        const x = semAcento(v.toLowerCase());
        if (/^(sim|s|yes|y|true|1|ok|pronto)$/.test(x)) ev.campos.pronto = true;
        else if (/^(nao|n|no|false|0)$/.test(x)) ev.campos.pronto = false;
        else if (v) ev.erros.push(`pronto: "${v.slice(0, 20)}" não é sim/nao`);
      } else if (k === "tempo") { if (v) ev.campos.tempo = v.slice(0, 40); }
      else if (k === "fonte") ev.campos.fonte = semAcento(v.toLowerCase()).replace(/[^a-z0-9]/g, "");
      else if (k === "evento") { const e = EVENTOS[semAcento(v.toLowerCase())]; if (e) ev.campos.evento = e; else ev.erros.push(`evento desconhecido: ${v.slice(0, 20)}`); }
      else if (k === "data") { const d = v.match(/^(\d{4})-(\d{2})-(\d{2})$/) || v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (d) ev.campos.data = d[1].length === 4 ? `${d[1]}-${d[2]}-${d[3]}` : `${d[3]}-${d[2]}-${d[1]}`; }
      else if (CONHECIDAS.has(k)) ev.campos[k] = v.slice(0, 200);
      else if (k && /^[a-z0-9_]{1,30}$/.test(k)) { const x = (ev.campos.extras ||= {}); if (Object.keys(x).length < 20) x[k] = v.slice(0, 200); }
    }
    if (tela != null) { ev.campos.tela = tela; ev.campos.evento ||= "tela"; }
    if (!ev.campos.fonte) ev.erros.push("falta fonte=");
    if (!ev.campos.evento) ev.campos.evento = temDado(ev.campos) ? "fim" : ev.erros.length ? "erro" : "etapa";
    out.push(ev);
  }
  return out;
}

/** Os comentários da issue (`{id, body, created_at}`) com id > maxId → eventos prontos para guardar. */
export function eventosDeComentarios(comentarios, maxId = 0, diaDe = diaLocal) {
  const eventos = [], invalidos = [];
  let novoMax = maxId;
  for (const c of [...(comentarios || [])].sort((a, b) => a.id - b.id)) {
    if (!(c.id > maxId)) continue;
    novoMax = Math.max(novoMax, c.id);
    const lidos = lerComentario(c.body);
    if (!lidos.length) continue; // outro assunto na issue: não é da macro
    lidos.forEach((ev, k) => {
      const em = c.created_at || new Date().toISOString();
      const dia = ev.campos.data || (/^\d{4}-\d{2}-\d{2}/.test(ev.campos.run || "") ? ev.campos.run.slice(0, 10) : diaDe(em));
      if (!ev.campos.fonte) { invalidos.push({ id: c.id, em, motivo: ev.erros.join("; ") }); return; }
      eventos.push({ ...ev.campos, dia, em, comentario: c.id, ordem: k, erros: ev.erros });
      if (ev.erros.length) invalidos.push({ id: c.id, em, fonte: ev.campos.fonte, motivo: ev.erros.join("; ") });
    });
  }
  return { eventos, invalidos, maxId: novoMax };
}

const MAX_EXECUCOES = 60;
/** Guarda os eventos em `execucoes[fonte][run]` e o saldo em `coletas[fonte][dia]`. Devolve { coletas, execucoes } (quantas mudaram). */
export function aplicarEventos(f, eventos) {
  let nColetas = 0, nTelas = 0; const runs = new Set();
  for (let ev of eventos) {
    const fonte = ev.fonte, run = String(ev.run || ev.dia).slice(0, 60);
    // ZBD das primeiras noites: a sequência da enquete vinha na msg ("número na tela N"); depois, em `sequencia=`
    if (fonte === "zbd" && !Number.isFinite(ev.sequencia) && numeroNaTela(ev.msg) != null) ev = { ...ev, sequencia: Math.round(numeroNaTela(ev.msg)) };
    // Slice: "0 Sats" e "$0.00" são o que a página mostra antes de carregar (29/10/2026: leu 0 com 8.557 sats na conta);
    // um saldo zerado de verdade só viria de um saque, que o PayPal tira em dólar: descarta a leitura, fica o check-in
    if (fonte === "slice" && ev.sats === 0 && !(ev.usd > 0)) { ev = { ...ev }; delete ev.sats; delete ev.usd; }
    // a leitura da tela inteira: só a última de cada fonte, fora das execuções
    if (ev.evento === "tela") {
      const tl = (f.telas ||= {}), atual = tl[fonte];
      if (ev.tela && (!atual || atual.em <= ev.em)) { tl[fonte] = { em: ev.em, dia: ev.dia, run: ev.run || null, texto: String(ev.tela).slice(0, MAX_TELA), comentario: ev.comentario }; nTelas++; }
      continue;
    }
    const ex = (f.execucoes[fonte] ||= {});
    const r = ex[run] ||= { id: run, dia: ev.dia, inicio: ev.em, etapas: [], status: "andamento", em: ev.em };
    if (r.vistos?.includes(ev.comentario * 10 + ev.ordem)) continue; // repetido
    (r.vistos ||= []).push(ev.comentario * 10 + ev.ordem);
    if (ev.em < r.inicio) r.inicio = ev.em;
    if (ev.evento === "inicio") r.comInicio = true; // a duração só vale com o início registrado
    if (ev.em > r.em) r.em = ev.em;
    if (ev.etapa && r.etapas.at(-1) !== ev.etapa) r.etapas.push(String(ev.etapa).slice(0, 40));
    if (ev.etapa) r.etapa = ev.etapa;
    if (ev.msg) r.msg = ev.msg;
    if (ev.erros?.length) r.avisos = [...new Set([...(r.avisos || []), ...ev.erros])].slice(-4);
    const emReal = FONTES[fonte]?.un === "brl"; // o Bump: o saldo vem em brl= (no Ping-Pong, brl é o Render)
    for (const k of ["sats", "usd", "sequencia", ...(emReal ? ["brl"] : [])]) if (Number.isFinite(ev[k])) r[k] = ev[k];
    if (ev.tempo) r.tempo = ev.tempo;
    if (typeof ev.pronto === "boolean") r.pronto = ev.pronto;
    if (ev.extras) r.extras = Object.fromEntries(Object.entries({ ...(r.extras || {}), ...ev.extras }).slice(-20));
    if (Number.isFinite(ev.tentativa)) r.tentativas = Math.max(r.tentativas || 1, ev.tentativa);
    // os eventos chegam em ordem (id do comentário): o último fim/erro decide
    if (ev.evento === "fim") { r.fim = ev.em; r.status = ev.erros?.length && !temDado(ev) && !(emReal && Number.isFinite(ev.brl)) ? "erro" : "ok"; if (r.status === "erro") r.msg = ev.msg || ev.erros.join("; "); }
    if (ev.evento === "erro") { r.fim = ev.em; r.status = "erro"; }
    runs.add(`${fonte}|${run}`);
    if (fonte === "pingpong") { marcarPassoPP(r, ev); guardarDinheiro(f, ev, run); }
    if (temDado(ev) || (emReal && Number.isFinite(ev.brl))) {
      const co = (f.coletas[fonte] ||= {}), atual = co[ev.dia];
      if (!atual || atual.em <= ev.em) {
        const c = { em: ev.em, comentario: ev.comentario, run };
        for (const k of ["sats", "usd", "sequencia", ...(emReal ? ["brl"] : [])]) { const v = Number.isFinite(ev[k]) ? ev[k] : atual?.[k]; if (Number.isFinite(v)) c[k] = v; }
        const tempo = ev.tempo || atual?.tempo; if (tempo) c.tempo = tempo;
        const pronto = typeof ev.pronto === "boolean" ? ev.pronto : atual?.pronto; if (typeof pronto === "boolean") c.pronto = pronto;
        co[ev.dia] = c; nColetas++;
      }
    }
  }
  // poda: só as últimas execuções de cada fonte
  for (const ex of Object.values(f.execucoes)) {
    const ks = Object.keys(ex).sort((a, b) => (ex[a].inicio < ex[b].inicio ? -1 : 1));
    for (const k of ks.slice(0, Math.max(0, ks.length - MAX_EXECUCOES))) delete ex[k];
  }
  return { coletas: nColetas, execucoes: runs.size, telas: nTelas };
}

// ---------------------------------------------------------------- o dinheiro dele (Ping-Pong)
// Pedido do Alediov (30/10/2026): o que vai e volta no Ping-Pong é, quase todo, o dinheiro que ele tem; entra nas
// Finanças. Cada ida lê o saldo do Render do ARQ (`brl`); idas, voltas e o Render dizem onde o dinheiro está.
const MAX_LEITURAS = 240, MAX_MOVS = 400;
function guardarDinheiro(f, ev, run) {
  const d = (f.dinheiro ||= { leituras: [], movs: [] }), chave = ev.comentario * 10 + (ev.ordem || 0);
  if (Number.isFinite(ev.brl) && !d.leituras.some(x => x.c === chave)) {
    d.leituras.push({ c: chave, em: ev.em, dia: ev.dia, brl: ev.brl, banco: ev.banco || null, run });
    d.leituras.sort((a, b) => (a.em < b.em ? -1 : 1)); d.leituras.splice(0, Math.max(0, d.leituras.length - MAX_LEITURAS));
  }
  if (ev.passo && (ev.evento === "fim" || ev.evento === "erro") && !d.movs.some(x => x.c === chave)) {
    const x = { c: chave, em: ev.em, dia: ev.dia, banco: ev.banco || null, passo: ev.passo, ok: ev.evento === "fim", msg: String(ev.msg || "").slice(0, 120) };
    for (const k of ["ret", "dep", "rend"]) if (Number.isFinite(ev[k])) x[k] = ev[k];
    if (Number.isFinite(ev.brl)) x.brl = ev.brl;
    d.movs.push(x);
    d.movs.sort((a, b) => (a.em < b.em ? -1 : 1)); d.movs.splice(0, Math.max(0, d.movs.length - MAX_MOVS));
  }
}
export const NOMES_BANCO = { 99: "99Pay", mp: "Mercado Pago", ast: "AstroPay", render: "Render do ARQ", arq: "ARQ" };

// ---------------------------------------------------------------- qual passo do Ping-Pong é cada execução
// Cada passo (ida, volta, Render) é uma macro com o seu `run`; o `fim` traz `passo` e `banco`, mas o `inicio` e o `erro`
// não: eles trazem o nome da macro na msg ("ARQ → 99 v… · valor tudo", "99 → ARQ não concluiu na etapa Pix"). A macro
// Ping-Pong (a que chama os passos nos horários) manda só `etapa=<chave>` ("volta_99") com "tentando de novo (Nª vez)"
// ou "… pulado: feriado"; essas execuções viram `mestre` com as `marcas` (para o calendário das automações).
const SIGLA_PP = { arq: "arq", 99: "99", mp: "mp", ast: "ast", render: "render" };
/** "ARQ → 99 …" → {passo: "ida", banco: "99"}; "MP → ARQ …" → volta; "ARQ → Render …" → render. null se não achar. */
export function passoDaMsg(msg) {
  const m = String(msg || "").match(/\b(ARQ|99|MP|AST)\s*(?:→|->)\s*(ARQ|99|MP|AST|Render)\b/i);
  if (!m) return null;
  const a = SIGLA_PP[m[1].toLowerCase()], b = SIGLA_PP[m[2].toLowerCase()];
  if (a === "arq" && b === "render") return { passo: "render", banco: "render" };
  if (a === "arq" && b !== "arq") return { passo: "ida", banco: b };
  if (b === "arq" && a !== "arq") return { passo: "volta", banco: a };
  return null;
}
/** "volta_99" → {tipo: "volta", banco: "99"} (as chaves dos horários da macro Ping-Pong). */
export function chavePP(etapa) {
  const m = String(etapa || "").match(/^(ida|volta)_(99|mp|ast)$/);
  return m ? { tipo: m[1], banco: m[2], chave: m[0] } : null;
}
function marcarPassoPP(r, ev) {
  const ch = ev.passo ? null : chavePP(ev.etapa);
  if (ev.passo) { r.passo = ev.passo; if (ev.banco) r.banco = ev.banco; }
  else if (!r.passo && !ch && !r.mestre) { const pb = passoDaMsg(ev.msg); if (pb) Object.assign(r, pb); }
  if (ch) {
    r.mestre = true;
    const msg = String(ev.msg || ""), n = msg.match(/\((\d+)\s*ª\s*vez\)/);
    const t = /pulad/i.test(msg) ? "pulado" : /de novo/i.test(msg) ? "denovo" : null;
    if (t) r.marcas = [...(r.marcas || []), { k: ch.chave, t, n: n ? +n[1] : null, render: /Render/i.test(msg) }].slice(-12);
  }
}

// ---------------------------------------------------------------- dinheiro parado fora do Render
// Pedido do Alediov (03/11/2026): R$ 1.226,46 ficaram na 99 por duas noites e ele só soube perguntando. O dinheiro mora
// no Render do ARQ; a ida leva a um banco e a volta traz de volta pouco depois. Se a volta que devia trazer já passou
// do horário (+ as novas tentativas, ~1 h) e o dinheiro não voltou, ele está parado: alerta no Início, item no Meu dia e
// uma notificação (no app, na hora; no Android, também a conferência das 7h15, FinancasConferencia.java, com a mesma
// regra). Os horários espelham financas/macros/config.json → pingpong.horarios (o teste confere que estão iguais).
export const HORARIOS_PP = {
  volta_99: { hora: "00:30", dias: [1, 1, 1, 1, 1, 1, 1] }, ida_mp: { hora: "17:30", dias: [1, 1, 1, 1, 1, 0, 0] },
  volta_mp: { hora: "18:15", dias: [1, 1, 1, 1, 1, 0, 0] }, ida_ast: { hora: "20:30", dias: [1, 1, 1, 1, 0, 0, 1] },
  volta_ast: { hora: "21:15", dias: [1, 1, 1, 1, 0, 0, 1] }, ida_99: { hora: "23:30", dias: [1, 1, 1, 1, 1, 1, 1] },
};
export const BANCOS_PP = ["99", "mp", "ast"];
/** Folga depois do horário da volta (as 3 tentativas da volta e do Render, com 60 s entre elas, cabem nela). */
export const PRAZO_PARADO_MIN = 60;
const NA_BANCO = { 99: "na 99", mp: "no Mercado Pago", ast: "na AstroPay", arq: "na conta do ARQ, fora do Render" };
/** O próximo horário (ms) de um passo ({hora, dias[seg…dom]}) depois de `ms`, na hora local; null sem horário. */
export function proximoHorario(ms, h) {
  if (!h?.hora) return null;
  const [hh, mm] = h.hora.split(":").map(Number);
  for (let k = 0; k <= 8; k++) {
    const d = new Date(ms); d.setDate(d.getDate() + k); d.setHours(hh, mm, 0, 0);
    if (+d <= ms) continue;
    if (!h.dias || h.dias[(d.getDay() + 6) % 7]) return +d;
  }
  return null;
}
/**
 * O dinheiro fora do Render além do ciclo normal: [{chave, banco, lugar ("banco" | "arq"), valor, desde, prazo}], o mais
 * recente primeiro ([] se está tudo no lugar). Num banco: a última ida com dinheiro (`ret` > 0) para ele é mais nova que a
 * última volta dele, e o horário dessa volta + `prazoMin` já passou; uma ida depois com pelo menos metade do valor
 * (de qualquer banco) mostra que o dinheiro já tinha voltado (ele trouxe à mão). Na conta do ARQ: a volta trouxe (havia
 * ida com dinheiro antes dela) e nenhum ARQ → Render terminou depois, passado o prazo. `f.paradoIgnorados[chave]` ("Já
 * resolvi") tira o aviso daquele episódio.
 */
export function dinheiroParado(f, agora = Date.now(), { horarios = HORARIOS_PP, prazoMin = PRAZO_PARADO_MIN } = {}) {
  const movs = (f.dinheiro?.movs || []).filter(x => x.ok && x.passo).sort((a, b) => (a.em < b.em ? -1 : 1));
  const ign = f.paradoIgnorados || {}, out = [], t = (x) => Date.parse(x.em);
  for (const banco of BANCOS_PP) {
    const ida = [...movs].reverse().find(x => x.passo === "ida" && x.banco === banco && x.ret > 0);
    if (!ida) continue;
    const depois = movs.filter(x => x.em > ida.em);
    if (depois.some(x => x.passo === "volta" && x.banco === banco)) continue;
    if (depois.some(x => x.passo === "ida" && x.ret >= ida.ret * 0.5)) continue;
    const volta = proximoHorario(t(ida), horarios[`volta_${banco}`]);
    const prazo = (volta ?? t(ida) + 2 * 3600e3) + prazoMin * 60000;
    const chave = `${banco}|${ida.em}`;
    if (agora < prazo || ign[chave]) continue;
    out.push({ chave, banco, lugar: "banco", valor: ida.ret, desde: ida.em, prazo: new Date(prazo).toISOString() });
  }
  const v = movs.filter(x => x.passo === "volta" && !/nada a devolver/i.test(x.msg || "")).at(-1);
  if (v) {
    const ida = [...movs].reverse().find(x => x.passo === "ida" && x.banco === v.banco && x.ret > 0 && x.em < v.em);
    const outraVolta = ida && movs.some(x => x.passo === "volta" && x.banco === v.banco && x.em > ida.em && x.em < v.em);
    const guardou = movs.some(x => x.em > v.em && (x.passo === "render" || (x.passo === "ida" && ida && x.ret >= ida.ret * 0.5)));
    const prazo = t(v) + prazoMin * 60000, chave = `arq|${v.em}`;
    if (ida && !outraVolta && !guardou && agora >= prazo && !ign[chave])
      out.push({ chave, banco: "arq", de: v.banco, lugar: "arq", valor: ida.ret, desde: v.em, prazo: new Date(prazo).toISOString() });
  }
  return out.sort((a, b) => (a.desde < b.desde ? 1 : -1));
}
const hmCurto = (ms) => { const d = new Date(ms), m = d.getMinutes(); return `${d.getHours()}h${m ? doisDig(m) : ""}`; };
/** "desde as 0h30", "desde ontem", "desde anteontem", "desde 28/10". */
export function desdeQuando(iso, agora = Date.now()) {
  const n = difDias(diaLocal(iso), diaLocal(agora));
  if (n <= 0) return `desde as ${hmCurto(Date.parse(iso))}`;
  if (n === 1) return "desde ontem";
  if (n === 2) return "desde anteontem";
  const d = new Date(iso); return `desde ${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}`;
}
/** O título e o texto do aviso (o mesmo na notificação do app, na do Android, no Início e no Meu dia). */
export function textoParado(p, agora = Date.now()) {
  const v = reais(Math.round(p.valor), { curto: true });
  const titulo = `${v} ainda ${NA_BANCO[p.banco] || `no ${p.banco}`} ${desdeQuando(p.desde, agora)}`;
  const texto = p.lugar === "arq"
    ? `A volta ${p.de ? `d${p.de === "99" ? "a 99" : p.de === "mp" ? "o Mercado Pago" : "a AstroPay"} ` : ""}trouxe o dinheiro, mas o ARQ → Render não guardou. Abra o ARQ e guarde no Render.`
    : `A volta do Ping-Pong não trouxe o dinheiro de volta ao Render. Confira o app ${p.banco === "99" ? "da 99" : p.banco === "mp" ? "do Mercado Pago" : "da AstroPay"} e devolva ao ARQ à mão, se precisar.`;
  return { titulo, texto, curto: `${v} ${NA_BANCO[p.banco] || p.banco}` };
}
/** "Já resolvi": o aviso daquele episódio some (registro com data; só os últimos 30). */
export function ignorarParado(f, chave, agora = new Date().toISOString()) {
  const g = (f.paradoIgnorados ||= {});
  g[chave] = { em: agora };
  for (const k of Object.keys(g).sort((a, b) => (g[a].em < g[b].em ? 1 : -1)).slice(30)) delete g[k];
}
/** O dinheiro dele pela última leitura do Ping-Pong: valor, quando, onde está agora (o último passo que terminou), a
 *  variação desde a leitura de ~7 dias atrás e a série (a última leitura de cada dia, até 90 dias). null sem leituras. */
export function dinheiro(f, hoje) {
  const d = f.dinheiro, ls = d?.leituras || [];
  if (!ls.length) return null;
  const u = ls.at(-1);
  // onde: a última ida que terminou e ainda não voltou; senão, se a última volta não foi guardada, na conta do ARQ
  const movs = (d.movs || []).filter(x => x.ok);
  const ult = movs.at(-1);
  let onde = { banco: "render", txt: "no Render do ARQ" };
  if (ult?.passo === "ida") onde = { banco: ult.banco, desde: ult.em, txt: `no ${NOMES_BANCO[ult.banco] || ult.banco} (Ping-Pong)` };
  else if (ult?.passo === "volta") onde = { banco: "arq", desde: ult.em, txt: "na conta do ARQ (falta guardar no Render)" };
  const falhou = (d.movs || []).at(-1);
  if (falhou && !falhou.ok && (!ult || falhou.em > ult.em)) onde = { ...onde, alerta: `${falhou.passo === "ida" ? "a ida" : falhou.passo === "volta" ? "a volta" : "o Render"}${falhou.banco && falhou.banco !== "render" ? ` (${NOMES_BANCO[falhou.banco] || falhou.banco})` : ""} não terminou` };
  const porDia = {};
  for (const x of ls) if (difDias(x.dia, hoje) <= 90) porDia[x.dia] = x; // a última de cada dia
  const serie = Object.values(porDia).sort((a, b) => (a.dia < b.dia ? -1 : 1)).map(x => ({ dia: x.dia, brl: x.brl }));
  const ant = [...ls].reverse().find(x => difDias(x.dia, u.dia) >= 7);
  return { valor: u.brl, em: u.em, dia: u.dia, onde, var7: ant ? u.brl - ant.brl : null, desde7: ant?.dia || null, serie };
}

// ---------------------------------------------------------------- onde está o dinheiro dele
// Pedido do Alediov (30/10/2026): o dinheiro está em 4 lugares: o Ping-Pong (a maior parte, lido a cada ida), a Bipa
// (um cofrinho de bitcoin que rende ~13 sats por dia; é onde ele junta o que vem das farms e check-ins, pelo PayPal ou
// pela ZBD), a ZBD (sats das enquetes, sacados só depois de R$ 100) e o dinheiro físico (o da Vó), que só conta quando
// vira digital (não entra aqui).
export const LUGARES = [
  { id: "pingpong", nome: "Ping-Pong", icone: "🏓", desc: "ARQ e os bancos do Ping-Pong · lido a cada ida" },
  { id: "bipa", nome: "Bipa", icone: "🐷", desc: "Cofrinho de bitcoin · o que vem do PayPal e da ZBD" },
  { id: "zbd", nome: "ZBD", icone: "⚡", desc: "Sats das enquetes" },
];
export const BIPA_SATS_DIA = 13;
/** As fontes cujos saques vão para a Bipa (o PayPal do Slice e do EarnApp e a ZBD). */
const PARA_BIPA = ["slice", "zbd", ...CONTAS_EARNAPP];
const RE_SAQUE_BIPA = /^Saque d[oa] (Slice|EarnApp|ZBD)\b/i;

/** "Atualizar a Bipa": o valor em R$ que o app dela mostra, guardado em sats pelo bitcoin do dia (o cofrinho é em
 *  bitcoin), e quanto rende por dia. Histórico curto para o gráfico. */
export function atualizarBipa(f, dia, { brl, satsDia = null }, btc = null, agora = new Date().toISOString()) {
  const b = (f.bipa ||= { hist: [] }), sd = Number.isFinite(satsDia) && satsDia >= 0 ? satsDia : b.satsDia ?? BIPA_SATS_DIA;
  const r = { dia, em: agora, brl: r2(brl), sats: btc > 0 ? Math.round((brl / btc) * 1e8) : null };
  // a Bipa rende 70% do CDI EM SATS (resposta do Alediov, 30/10/2026: 12 ou 13 sats por dia): os sats/dia de hoje viram a
  // taxa por dia, e o rendimento cresce junto com o saldo
  if (r.sats > 0) r.taxa = sd / r.sats;
  b.hist = [...(b.hist || []).filter(x => x.dia !== dia), r].sort((x, y) => (x.dia < y.dia ? -1 : 1)).slice(-120);
  b.satsDia = sd; b.em = agora;
  return r;
}
/** Saques lançados (do PayPal ou da ZBD) depois do dia `desde`: entram na Bipa até ele atualizar o valor à mão. */
function saquesParaBipa(f, desde, hoje) {
  return Object.values(f.lanc || {}).filter(l => !l.apagado && l.tipo === "entrada" && l.data > desde && l.data <= hoje
    && (PARA_BIPA.includes(String(l.saque?.chave || "").split("|")[0]) || RE_SAQUE_BIPA.test(l.desc || "")));
}
/** A Bipa hoje: a última atualização + o rendimento desde então (satsDia, pelo bitcoin de hoje) + os saques lançados
 *  depois. Sem bitcoin, o valor informado + os saques. null sem atualização. */
export function bipa(f, hoje, cot = null) {
  const b = f.bipa, u = b?.hist?.at(-1);
  if (!u) return null;
  const btc = (cot || cotacao(f, hoje)).btc, dias = Math.max(0, difDias(u.dia, hoje));
  const sats = satsBipa(u, dias, b.satsDia);
  const saques = saquesParaBipa(f, u.dia, hoje), extra = r2(saques.reduce((t, l) => t + l.valor, 0));
  const base = sats != null && btc > 0 ? r2((sats / 1e8) * btc) : u.brl;
  const satsHoje = sats != null && taxaBipa(u, b.satsDia) ? Math.round(sats * taxaBipa(u, b.satsDia)) : b.satsDia ?? BIPA_SATS_DIA;
  return { valor: r2(base + extra), informado: u.brl, dia: u.dia, em: u.em, dias, sats, satsDia: satsHoje,
    rendeu: sats != null && btc > 0 ? r2(((sats - u.sats) / 1e8) * btc) : 0, saques: saques.length, extra, estimado: dias > 0 || extra > 0 };
}
/** A taxa por dia da Bipa (guardada na atualização; nas antigas, os sats/dia ÷ o saldo). */
const taxaBipa = (u, satsDia) => u.taxa > 0 ? u.taxa : u.sats > 0 ? (satsDia ?? BIPA_SATS_DIA) / u.sats : 0;
/** Os sats da Bipa `dias` depois da atualização `u`: juros compostos por dia (70% do CDI em sats). */
const satsBipa = (u, dias, satsDia) => u.sats == null ? null : Math.round(u.sats * Math.pow(1 + taxaBipa(u, satsDia), dias));
/** A ZBD em R$: o último saldo em sats (à mão ou pela macro), pelo bitcoin de hoje. */
export function zbdEmReais(f, hoje, cot = null) {
  const u = [...serie(f, "zbd")].reverse().find(c => Number.isFinite(c.sats));
  if (!u) return null;
  const c = cot || cotacao(f, hoje);
  return { valor: emReais(c, u.sats, "sats"), sats: u.sats, dia: u.dia, em: u.em || null, semCotacao: !c.btc };
}
/** O dinheiro dele somado (Ping-Pong + Bipa + ZBD): o total, cada lugar e a série do total por dia (os dias com leitura
 *  do Ping-Pong, com a Bipa e a ZBD como estavam naquele dia). null se nenhum lugar tem valor. */
export function seuDinheiro(f, hoje, cot = null) {
  cot ||= cotacao(f, hoje);
  const pp = dinheiro(f, hoje), bp = bipa(f, hoje, cot), zb = zbdEmReais(f, hoje, cot);
  const lugares = LUGARES.map(l => {
    const v = l.id === "pingpong" ? pp : l.id === "bipa" ? bp : zb;
    return { ...l, valor: v ? v.valor : null, info: v };
  });
  if (lugares.every(l => l.valor == null)) return null;
  const total = r2(lugares.reduce((t, l) => t + (l.valor || 0), 0));
  // a série: a Bipa de cada dia pela atualização mais recente até ele (+ o rendimento), a ZBD pela coleta até ele
  const hist = f.bipa?.hist || [], zs = serie(f, "zbd").filter(c => Number.isFinite(c.sats)), sd = f.bipa?.satsDia ?? BIPA_SATS_DIA;
  const bipaEm = (d) => { const u = [...hist].reverse().find(x => x.dia <= d); if (!u) return 0; const n = Math.max(0, difDias(u.dia, d)); return u.sats != null && cot.btc ? r2((satsBipa(u, n, sd) / 1e8) * cot.btc) : u.brl; };
  const zbdEm = (d) => { const u = [...zs].reverse().find(c => c.dia <= d); return u ? emReais(cot, u.sats, "sats") : 0; };
  const serieT = (pp?.serie || []).map(x => ({ dia: x.dia, brl: r2(x.brl + bipaEm(x.dia) + zbdEm(x.dia)) }));
  return { total, lugares, serie: serieT, pingpong: pp, temTudo: lugares.every(l => l.valor != null) };
}
/** O gráfico da evolução começa em 1º/11/2026 (pedido do Alediov, 30/10/2026: "quando tudo deve estar alinhado"). */
export const INICIO_EVOLUCAO = "2026-11-01";
// o rendimento conta desta data em diante (o teste de fumaça, que roda com movimentos de "hoje", põe uma data antiga)
let inicioRendimento = INICIO_EVOLUCAO;
export function definirInicioRendimento(dia) { inicioRendimento = dia || INICIO_EVOLUCAO; }
/** A evolução do dinheiro desde INICIO_EVOLUCAO: a série (com o total de hoje no fim), a variação e o rendimento por dia
 *  (para o widget e a aba Rendimento). */
export function evolucao(f, hoje, cot = null) {
  const d = seuDinheiro(f, hoje, cot);
  if (!d) return null;
  const s = d.serie.filter(x => x.dia >= INICIO_EVOLUCAO);
  if (hoje >= INICIO_EVOLUCAO && (!s.length || s.at(-1).dia !== hoje)) s.push({ dia: hoje, brl: d.total });
  else if (s.length && s.at(-1).dia === hoje) s[s.length - 1] = { dia: hoje, brl: d.total };
  const rd = rendimento(f, hoje);
  return { total: d.total, serie: s, desde: s[0]?.dia || INICIO_EVOLUCAO, variacao: s.length >= 2 ? r2(d.total - s[0].brl) : null,
    porDia: rd.porDia, comecou: hoje >= INICIO_EVOLUCAO };
}

// ---------------------------------------------------------------- quanto o Ping-Pong rende (pedido do Alediov, 30/10/2026)
// Medido, não estimado: (1) o Render, entre uma ida e a seguinte: a ida lê o saldo (brl) e tira `ret`; o ARQ → Render
// guarda `dep`; na ida seguinte, o que passou de (brl − ret + deps) é rendimento, se for pouco (senão foi ele quem
// mexeu: o intervalo não conta); (2) os bancos: a volta manda ao ARQ o que sobrou depois das devoluções (`rend`, o
// rendimento dos ciclos passados). Por dia = a soma ÷ os dias medidos.
export const TESTES_PADRAO = 5; // % do rendimento para testes (trading, mercados arriscados): resposta dele, 30/10/2026
const MAX_REND_INTERVALO = 0.004; // 0,4% do saldo entre duas idas já é mexida dele, não rendimento
export function rendimentos(f) {
  // só de 1º/11/2026 em diante (os testes de R$ 1 e as amostras de R$ 0,50 de outubro não contam como rendimento)
  const ms = [...(f.dinheiro?.movs || [])].filter(x => x.ok && (x.dia || diaLocal(x.em)) >= inicioRendimento).sort((a, b) => (a.em < b.em ? -1 : 1));
  const itens = [];
  let base = null, desde = null, inicio = null;
  for (const x of ms) {
    if (x.passo === "ida" && Number.isFinite(x.brl)) {
      if (base != null) {
        const d = r2(x.brl - base);
        if (d >= -0.01 && d <= Math.max(0.05, base * MAX_REND_INTERVALO) && d > 0) itens.push({ dia: x.dia, em: x.em, valor: d, de: "render", desde });
      }
      base = Number.isFinite(x.ret) ? r2(x.brl - x.ret) : null; desde = x.em;
      if (base != null) inicio ||= x.em; // a medida começa na 1ª ida que diz quanto tirou
    } else if (x.passo === "render" && Number.isFinite(x.dep)) { if (base != null) base = r2(base + x.dep); }
    else if (x.passo === "volta" && x.rend > 0) { itens.push({ dia: x.dia, em: x.em, valor: x.rend, de: x.banco || "banco" }); inicio ||= x.em; }
  }
  const fim = ms.at(-1)?.em || null;
  return { itens, inicio, fim, dias: inicio && fim ? Math.max(0, (Date.parse(fim) - Date.parse(inicio)) / 864e5) : 0 };
}
/** O rendimento do Ping-Pong: por dia (média dos últimos 30 dias medidos), mês, ano, % ao ano sobre o saldo, por
 *  lugar, por dia (série) e a verba de testes (testesPct% do que rendeu no mês e desde o começo). */
export function rendimento(f, hoje) {
  const r = rendimentos(f), pp = dinheiro(f, hoje), pct = testesPct(f);
  // a janela: os últimos 30 dias (ou desde o começo da medida, se for mais recente) até o último registro
  const w0 = r.inicio ? Math.max(Date.parse(r.inicio), Date.parse(`${maisDias(hoje, -30)}T12:00:00`)) : null;
  const ult = w0 != null ? r.itens.filter(x => Date.parse(x.em) >= w0) : [];
  const dias = w0 != null && r.fim ? Math.max(0, (Date.parse(r.fim) - w0) / 864e5) : 0;
  const soma = r2(ult.reduce((t, x) => t + x.valor, 0));
  const porDia = dias >= 0.5 ? soma / dias : null;
  const saldo = pp?.valor || null;
  const taxaAno = porDia != null && saldo > 0 ? Math.pow(1 + porDia / saldo, 365) - 1 : null;
  const porLugar = {};
  for (const x of ult) porLugar[x.de] = r2((porLugar[x.de] || 0) + x.valor);
  const serie = {};
  for (const x of r.itens) if (difDias(x.dia, hoje) < 30) serie[x.dia] = r2((serie[x.dia] || 0) + x.valor);
  const mes = mesDe(hoje), noMes = r2(r.itens.filter(x => mesDe(x.dia) === mes).reduce((t, x) => t + x.valor, 0));
  const total = r2(r.itens.reduce((t, x) => t + x.valor, 0));
  return { porDia, porMes: porDia != null ? porDia * 30.44 : null, porAno: porDia != null ? porDia * 365 : null, taxaAno, saldo, dias, medindo: dias < 3,
    porLugar, serie: Object.entries(serie).sort().map(([dia, v]) => ({ dia, brl: v })), noMes, total, desde: r.inicio,
    testes: { pct, noMes: r2(noMes * pct / 100), total: r2(total * pct / 100) } };
}
export const testesPct = (f) => { const v = f.ajustes?.testesPct; return Number.isFinite(v) && v >= 0 && v <= 50 ? v : TESTES_PADRAO; };
/** Quanto sobra por mês, em média, nos últimos 3 meses fechados com lançamentos (entradas − saídas); null sem eles. */
export function sobraMensal(f, hoje) {
  const h = historico(f, somaMes(mesDe(hoje), -1), 3).filter(x => x.entradas || x.saidas);
  return h.length ? r2(h.reduce((t, x) => t + x.saldo, 0) / h.length) : null;
}
/**
 * Quanto ele terá em `anos` (pedido do Alediov, 30/10/2026): mês a mês, o dinheiro rende pela taxa medida (ou a
 * informada à mão), menos a verba de testes (que sai), mais o que sobra por mês. Três cenários: só o rendimento, no
 * ritmo dos últimos meses (a sobra média, que pode ser negativa) e guardando a reserva da renda fixa. Em valores de hoje
 * (sem inflação). null sem taxa.
 */
export function projecao(f, hoje, { anos = 10, inicial = null, taxaAno = null } = {}) {
  const rd = rendimento(f, hoje);
  const taxa = Number.isFinite(taxaAno) ? taxaAno : f.ajustes?.taxaManual > 0 ? f.ajustes.taxaManual / 100 : rd.taxaAno;
  const P0 = Number.isFinite(inicial) ? inicial : seuDinheiro(f, hoje)?.total ?? 0;
  if (!(taxa > 0) || !(P0 >= 0)) return null;
  const im = Math.pow(1 + taxa, 1 / 12) - 1, fica = 1 - testesPct(f) / 100;
  const r = resumoMes(f, mesDe(hoje), hoje), fixasEnt = r.fixas.filter(x => x.tipo !== "saida").reduce((t, x) => t + (x.previsto || 0), 0);
  const ritmo = sobraMensal(f, hoje);
  const cenarios = [
    { id: "rendimento", nome: "Só o rendimento", aporte: 0 },
    ...(ritmo != null ? [{ id: "ritmo", nome: "No ritmo dos últimos meses", aporte: ritmo }] : []),
    ...(fixasEnt > 0 && r.reservaPct > 0 ? [{ id: "reserva", nome: `Guardando ${r.reservaPct}% da renda fixa`, aporte: r2(fixasEnt * r.reservaPct / 100) }] : []),
  ].map(c => {
    let v = P0; const meses = [{ m: 0, v }];
    for (let m = 1; m <= anos * 12; m++) { v = Math.max(0, v * (1 + im * fica) + c.aporte); meses.push({ m, v: r2(v) }); }
    return { ...c, meses, em: Object.fromEntries([1, 2, 5, 10].filter(a => a <= anos).map(a => [a, meses[a * 12].v])) };
  });
  return { taxa, manual: !Number.isFinite(taxaAno) && f.ajustes?.taxaManual > 0, P0: r2(P0), cenarios, testesPct: testesPct(f), anos };
}

/**
 * "Conferi as Finanças" (pedido do Alediov, 02/11/2026: "Não quero marcar que o Check-in deu certo quando não deu
 * totalmente. … Eu só quero marcar que conferi a aba Finanças e que, se houve algum erro ou importe para fazer, eu o
 * fiz"): a conferência é do DIA inteiro, em `f.conferidas[dia]` {em} (registro com data, sincroniza; só os últimos 60
 * dias), e NÃO muda a situação de nenhuma macro (um erro continua erro). O item das Finanças do Meu dia fica feito
 * naquele dia; um problema novo depois (uma macro com erro ou que parou, registrada depois da conferência) o traz de
 * volta. O `f.conferidos` por fonte da versão de 01/11/2026 é ignorado.
 */
export function conferirFinancas(f, dia, desfazer = false, agora = new Date().toISOString()) {
  const c = (f.conferidas ||= {});
  if (desfazer) delete c[dia]; else c[dia] = { em: agora };
  for (const d of Object.keys(c)) if (difDias(d, dia) > 60) delete c[d];
  return c[dia] || null;
}
export const conferenciaDoDia = (f, dia) => f.conferidas?.[dia] || null;
/** As execuções com problema (erro ou parada) do dia registradas depois de `desde` (ISO), nas fontes que o dia olha. */
export function problemasDepois(f, dia, desde, agora = Date.now(), fontes = [...FONTES_SAUDE, "pingpong"]) {
  return fontes.flatMap(fo => Object.values(f.execucoes?.[fo] || {}).filter(r => r.dia === dia && (r.em || "") > desde && ["erro", "incompleta"].includes(statusExecucao(r, agora))).map(r => ({ fonte: fo, ...r })));
}
/** Ele conferiu as Finanças hoje e nada novo deu errado depois? */
export function financasConferidas(f, dia, agora = Date.now()) {
  const c = conferenciaDoDia(f, dia);
  return !!c && !problemasDepois(f, dia, c.em, agora).length;
}
/** Situação de uma execução: ok, erro, andamento (começou há menos de 30 min), incompleta ou aguardando (o `erro`
 *  com msg "bloqueada": o resgate do Earn Bitcoin ainda não liberou; não é falha da macro). */
export function statusExecucao(r, agora = Date.now()) {
  if (r.status === "erro" && /bloquead/i.test(r.msg || "")) return "aguardando";
  if (r.status === "ok" || r.status === "erro") return r.status;
  return agora - Date.parse(r.em) < 30 * 60000 ? "andamento" : "incompleta";
}
/** Saúde da automação de uma fonte: rodou hoje? onde parou? as últimas execuções. */
export function saude(f, fonte, hoje, agora = Date.now()) {
  const lista = Object.values(f.execucoes[fonte] || {}).sort((a, b) => (a.inicio < b.inicio ? 1 : -1)).map(r => ({ ...r, st: statusExecucao(r, agora) }));
  const deHoje = lista.filter(r => r.dia === hoje);
  const okHoje = deHoje.some(r => r.st === "ok");
  const ultima = lista[0] || null;
  const ativa = lista.some(r => difDias(r.dia, hoje) <= 7) || Object.keys(f.coletas[fonte] || {}).some(d => difDias(d, hoje) <= 7);
  const hora = new Date(agora).getHours();
  let estado = "nunca";
  if (okHoje) estado = "ok";
  else if (deHoje.some(r => r.st === "andamento")) estado = "andamento";
  else if (deHoje.length) estado = deHoje[0].st; // erro, incompleta ou aguardando
  else if (ativa) estado = hora >= (FONTES[fonte]?.ate ?? 2) ? "faltou" : "cedo"; // a Ronda acaba antes das 2h; os outros aparelhos, às 4h
  // dias seguidos com execução ok (até ontem, mais hoje se já foi)
  let seguidos = 0;
  const okDias = new Set(lista.filter(r => r.st === "ok").map(r => r.dia));
  for (let d = okHoje ? hoje : maisDias(hoje, -1); okDias.has(d) && seguidos < 3650; d = maisDias(d, -1)) seguidos++;
  return { estado, ultima, lista: lista.slice(0, 14), deHoje, seguidos, ativa };
}

// ---------------------------------------------------------------- duração das execuções e a noite do orquestrador
/** Minutos de uma execução, pelo horário dos comentários (início → fim ou erro); null enquanto não terminou ou sem o
 *  evento de início (uma linha solta só com o saldo não tem duração). */
export function duracao(r) {
  if (!r?.comInicio || !r?.inicio || !r?.fim) return null;
  const m = (Date.parse(r.fim) - Date.parse(r.inicio)) / 60000;
  return Number.isFinite(m) && m >= 0 ? m : null;
}
/** Quanto a macro de uma fonte costuma levar: a mediana das últimas `n` execuções terminadas (minutos), ou null. */
export function duracaoTipica(f, fonte, n = 7) {
  const ds = Object.values(f.execucoes?.[fonte] || {}).filter(r => r.fim).sort((a, b) => (a.inicio < b.inicio ? 1 : -1)).slice(0, n).map(duracao).filter(x => x != null).sort((a, b) => a - b);
  if (!ds.length) return null;
  const k = Math.floor(ds.length / 2);
  return ds.length % 2 ? ds[k] : (ds[k - 1] + ds[k]) / 2;
}
/** "3 min", "menos de 1 min" (`curto`: "<1 min"), "1 h 15" (ou "" sem duração). */
export function textoDuracao(min, { curto = false } = {}) {
  if (min == null) return "";
  if (min < 1) return curto ? "<1 min" : "menos de 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  return `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`;
}
/**
 * A noite das macros (pedido do Alediov, 27/10/2026): o orquestrador roda as fontes em sequência de madrugada. Devolve a
 * janela (a execução do orquestrador daquele `dia`, ou, sem ela, do 1º início ao último fim das fontes), as execuções
 * de cada fonte dentro dela em ordem (com a duração e a situação) e o total. `dia`: o da noite (as macros rodam depois
 * da meia-noite, então é o dia que começa). null sem nada naquele dia.
 */
export function noite(f, dia, agora = Date.now()) {
  const doDia = (fo) => Object.values(f.execucoes?.[fo] || {}).filter(r => r.dia === dia);
  const orq = doDia("orquestrador").sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0] || null;
  let itens = FONTES_ATIVAS.flatMap(fo => doDia(fo).map(r => ({ fonte: fo, nome: nomeFonte(fo), id: r.id, inicio: r.inicio, fim: r.fim || null, min: duracao(r), st: statusExecucao(r, agora), etapa: r.etapa || "" })));
  if (orq) { const a = Date.parse(orq.inicio) - 60000, b = Date.parse(orq.fim || orq.em) + 60000; itens = itens.filter(x => Date.parse(x.inicio) >= a && Date.parse(x.inicio) <= b); }
  if (!orq && !itens.length) return null;
  itens.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  const inicio = orq?.inicio || itens[0].inicio;
  const fins = itens.map(x => x.fim || x.inicio);
  const fim = orq ? (orq.fim || null) : fins.sort().at(-1);
  const total = fim ? Math.max(0, (Date.parse(fim) - Date.parse(inicio)) / 60000) : null;
  return { dia, orq: orq ? { ...orq, st: statusExecucao(orq, agora) } : null, inicio, fim, total, itens, situacao: situacoesDaMsg(orq?.msg) };
}
/** A situação de cada fonte que o orquestrador manda no `fim` (msg "earnapp ok · earn_bitcoin falta · …"):
 *  [{fonte, nome, st}] na ordem; st em minúsculas como veio (ok, falta, erro…). */
export function situacoesDaMsg(msg) {
  const out = [];
  for (const p of String(msg || "").split(/\s*[·;,|]\s*/)) {
    const m = p.trim().match(/^([a-z][a-z0-9_ ]*?)\s*[:=]?\s+([a-zà-ú]+)$/i);
    if (!m) continue;
    const fonte = semAcento(m[1].toLowerCase()).replace(/[^a-z0-9]/g, "");
    if (FONTES[fonte]) out.push({ fonte, nome: nomeFonte(fonte), st: semAcento(m[2].toLowerCase()) });
  }
  return out;
}
/** O número que o ZBD lê ao lado de "Daily Poll" (msg "enquete respondida · número na tela N"), ou null. */
export function numeroNaTela(msg) { const m = String(msg || "").match(/n[uú]mero na tela\s*:?\s*([\d.,]+)/i); return m ? numero(m[1]) : null; }
/** A noite mais recente com execuções (até `hoje`), para "Esta noite" ou "Última noite". */
export function ultimaNoite(f, hoje, agora = Date.now()) {
  const dias = new Set(["orquestrador", ...FONTES_ATIVAS].flatMap(fo => Object.values(f.execucoes?.[fo] || {}).map(r => r.dia)).filter(d => d <= hoje));
  const d = [...dias].sort().at(-1);
  return d ? noite(f, d, agora) : null;
}

// ---------------------------------------------------------------- calendário das automações
// Pedido do Alediov (03/11/2026): um quadradinho por noite e por macro nos últimos ~30 dias: verde deu certo, amarelo deu
// certo depois de tentar de novo, vermelho falhou, cinza não rodou ou não se aplica. A noite D vai do meio-dia de D−1 ao
// meio-dia de D: os check-ins da madrugada de D (o `dia` da execução) e o Ping-Pong que começa na tarde de D−1 (MP
// 17h30, AST 20h30, 99 23h30 e a volta das 0h30). O Ping-Pong fica numa linha por banco (ida, volta e o Render depois
// dela juntos; o pior decide), para caber no celular.
export const LINHAS_CAL = [
  { id: "orquestrador", nome: "Ronda" }, { id: "earnapp", nome: "EarnApp" }, { id: "earnbitcoin", nome: "Earn Bitcoin" },
  { id: "slice", nome: "Slice" }, { id: "zbd", nome: "ZBD" },
  { id: "earnappprincipal", nome: "EarnApp · principal", opcional: true }, { id: "earnapptablet", nome: "EarnApp · tablet", opcional: true },
  { id: "bump", nome: "Bump", opcional: true },
  ...BANCOS_PP.map(b => ({ id: `pp-${b}`, nome: `Ping-Pong · ${b === "99" ? "99" : b.toUpperCase()}`, banco: b, pp: true })),
];
/** A noite (AAAA-MM-DD) de um instante: o dia do meio-dia seguinte. */
export const noiteDe = (iso) => diaLocal(Date.parse(iso) + 12 * 3600e3);
const PIOR = { erro: 5, andamento: 4, denovo: 3, ok: 2, pulado: 1 };
const NOME_PASSO = { ida: "Ida", volta: "Volta", render: "ARQ → Render" };
/** O passo de uma execução do Ping-Pong ({passo, banco}), também nas guardadas antes de `marcarPassoPP`. */
function passoDe(r) {
  if (r.passo) return { passo: r.passo, banco: r.banco || null };
  if (r.mestre || chavePP(r.etapa)) return null; // a macro Ping-Pong (a que chama os passos)
  return passoDaMsg(r.msg) || null;
}
function itemDe(r, nome, agora) {
  return { nome, inicio: r.inicio, fim: r.fim || null, st: statusExecucao(r, agora), etapa: r.etapa || "", msg: r.msg || "", tentativas: r.tentativas || 1, min: duracao(r) };
}
/**
 * O calendário: { dias: [AAAA-MM-DD…] (do mais antigo a hoje), linhas: [{id, nome, pp, celulas: [{dia, st, itens, notas}]}] }.
 * st: "ok", "denovo" (deu certo depois de tentar de novo), "erro", "andamento", "nada" (devia rodar e não há registro),
 * "nao" (não se aplica: dia sem o banco, feriado, "pulado"), "aguardando" (o resgate ainda não liberou), "cedo" (hoje,
 * antes do horário) ou "antes" (antes da 1ª execução). `itens`: as execuções da noite (nome, início, fim, situação,
 * etapa, msg, tentativas); `notas`: o que a macro Ping-Pong disse (tentou de novo, pulou). As linhas opcionais (o EarnApp
 * dos outros aparelhos) só entram se rodaram alguma vez; o Ping-Pong, se há alguma execução dele.
 */
export function calendarioAutomacoes(f, hoje, { dias = 30, agora = Date.now(), horarios = HORARIOS_PP } = {}) {
  // depois do meio-dia, a noite que está começando (a de amanhã) entra no fim, no lugar da mais antiga
  const hora = new Date(agora).getHours(), ate = hora >= 12 ? maisDias(hoje, 1) : hoje, lista = [];
  for (let k = dias - 1; k >= 0; k--) lista.push(maisDias(ate, -k));
  const linhas = [];
  // check-ins (e a Ronda): pelo `dia` da execução
  for (const L of LINHAS_CAL.filter(l => !l.pp)) {
    const exs = Object.values(f.execucoes?.[L.id] || {});
    if (L.opcional && !exs.length) continue;
    const primeiro = exs.map(r => r.dia).sort()[0] || null;
    const celulas = lista.map(dia => {
      const rs = exs.filter(r => r.dia === dia).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
      const itens = rs.map(r => itemDe(r, nomeFonte(L.id), agora));
      if (!rs.length) return { dia, st: dia > hoje || (dia === hoje && hora < (FONTES[L.id]?.ate ?? 2)) ? "cedo" : !primeiro || dia < primeiro ? "antes" : "nada", itens, notas: [] };
      const sts = itens.map(x => x.st), iOk = sts.indexOf("ok");
      let st;
      if (iOk >= 0) st = itens.some(x => x.tentativas > 1) || sts.slice(0, iOk).some(s => s === "erro" || s === "incompleta") ? "denovo" : "ok";
      else if (sts.includes("andamento")) st = "andamento";
      else if (sts.every(s => s === "aguardando")) st = "aguardando";
      else st = "erro";
      return { dia, st, itens, notas: [] };
    });
    linhas.push({ id: L.id, nome: L.nome, celulas });
  }
  // Ping-Pong: os passos de cada banco (o Render vai com o passo que veio logo antes dele, até 3 h)
  const pps = Object.values(f.execucoes?.pingpong || {}).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  if (pps.length) {
    const passos = [], marcas = [];
    let anterior = null;
    for (const r of pps) {
      if (!passoDe(r) && (r.mestre || chavePP(r.etapa))) {
        const mk = r.marcas?.length ? r.marcas : chavePP(r.etapa) && /pulad|de novo/i.test(r.msg || "") ? [{ k: r.etapa, t: /pulad/i.test(r.msg) ? "pulado" : "denovo", render: /Render/i.test(r.msg || "") }] : [];
        for (const m of mk) { const ch = chavePP(m.k); if (ch) marcas.push({ ...m, ...ch, noite: noiteDe(r.inicio), em: r.em }); }
        continue;
      }
      const p = passoDe(r); if (!p) continue;
      let banco = p.banco;
      if (p.passo === "render") banco = anterior && Date.parse(r.inicio) - Date.parse(anterior.r.inicio) < 3 * 3600e3 ? anterior.banco : null;
      if (!banco || !BANCOS_PP.includes(banco)) continue;
      const x = { r, passo: p.passo, banco, noite: noiteDe(r.inicio) };
      passos.push(x);
      if (p.passo !== "render") anterior = x;
    }
    const primeiro = [...passos.map(x => x.noite), ...marcas.map(m => m.noite)].sort()[0] || null;
    for (const L of LINHAS_CAL.filter(l => l.pp)) {
      const celulas = lista.map(dia => {
        const ps = passos.filter(x => x.banco === L.banco && x.noite === dia), ms = marcas.filter(m => m.banco === L.banco && m.noite === dia);
        const itens = ps.map(x => itemDe(x.r, x.passo === "render" ? NOME_PASSO.render : `${NOME_PASSO[x.passo]} (${x.passo === "ida" ? `ARQ → ${L.banco === "99" ? "99" : L.banco.toUpperCase()}` : `${L.banco === "99" ? "99" : L.banco.toUpperCase()} → ARQ`})`, agora));
        const notas = ms.map(m => m.t === "pulado" ? `${m.tipo === "ida" ? "A ida" : "A volta"} foi pulada (feriado ou banco desligado na config)` : `${m.render ? "O ARQ → Render" : m.tipo === "ida" ? "A ida" : "A volta"} tentou de novo${m.n ? ` (${m.n}ª vez)` : ""}`);
        // a noite D começa na tarde de D−1: é nesse dia da semana que o banco tem (ou não) horário
        const vespera = new Date(maisDias(dia, -1) + "T12:00:00"), idx = (vespera.getDay() + 6) % 7;
        const temHorario = !!horarios[`ida_${L.banco}`]?.dias?.[idx];
        if (!ps.length) {
          const st = ms.some(m => m.t === "pulado") || !temHorario ? "nao" : dia > hoje ? "cedo" : !primeiro || dia < primeiro ? "antes" : "nada";
          return { dia, st, itens, notas };
        }
        // por passo: ok se algum terminou; "de novo" se antes houve erro, se tentou mais de 1 vez ou se a macro avisou
        const stDe = (tipo) => {
          const xs = ps.filter(x => x.passo === tipo); if (!xs.length) return null;
          const sts = xs.map(x => statusExecucao(x.r, agora)), iOk = sts.indexOf("ok");
          if (iOk >= 0) return sts.slice(0, iOk).some(s => s === "erro" || s === "incompleta") || xs.some(x => (x.r.tentativas || 1) > 1) || ms.some(m => m.t === "denovo" && (tipo === "render" ? m.render : m.tipo === tipo && !m.render)) ? "denovo" : "ok";
          return sts.includes("andamento") ? "andamento" : "erro";
        };
        const porTipo = ["ida", "volta", "render"].map(stDe).filter(Boolean);
        // a ida levou dinheiro e nenhuma volta rodou depois do prazo: a volta faltou
        const ida = ps.filter(x => x.passo === "ida" && x.r.status === "ok").at(-1);
        const mov = ida ? (f.dinheiro?.movs || []).find(m => m.ok && m.passo === "ida" && m.banco === L.banco && m.em === ida.r.fim) : null;
        if (mov?.ret > 0 && !ps.some(x => x.passo === "volta")) {
          const v = proximoHorario(Date.parse(ida.r.inicio), horarios[`volta_${L.banco}`]);
          if (!v || agora > v + PRAZO_PARADO_MIN * 60000) { porTipo.push("erro"); notas.push("A volta não rodou: o dinheiro ficou no banco"); }
          else { porTipo.push("andamento"); notas.push(`A volta roda às ${hmCurto(v)}`); }
        }
        const st = porTipo.sort((a, b) => (PIOR[b] || 0) - (PIOR[a] || 0))[0] || "ok";
        return { dia, st, itens, notas };
      });
      linhas.push({ id: L.id, nome: L.nome, pp: true, banco: L.banco, celulas });
    }
  }
  return { dias: lista, linhas };
}
/** O resumo de uma célula numa frase (para o toque no quadradinho). */
export const ROTULO_CAL = { ok: "Deu certo", denovo: "Deu certo depois de tentar de novo", erro: "Falhou", andamento: "Rodando", nada: "Não rodou", nao: "Não se aplica", aguardando: "Aguardando liberar", cedo: "Ainda não é a hora", antes: "Antes da 1ª execução" };

// ---------------------------------------------------------------- saldo, ganho, saques e dias perdidos
// A unidade da fonte é a de `FONTES[fonte].un` quando a coleta mais recente a traz (Slice e EarnApp: US$; ZBD e Earn
// Bitcoin: sats), senão a outra. Ganho do dia = diferença do saldo nessa unidade; saldo que cai = saque.
/** Coletas de uma fonte em ordem: [{dia, sats, usd, sequencia, em}]. */
export const serie = (f, fonte) => Object.entries(f.coletas[fonte] || {}).map(([dia, c]) => ({ dia, ...c })).sort((a, b) => a.dia.localeCompare(b.dia));
export function unidade(f, fonte) {
  if (FONTES[fonte]?.un === "brl") return "brl"; // o Bump: sempre em R$
  const u = [...serie(f, fonte)].reverse().find(c => Number.isFinite(c.sats) || Number.isFinite(c.usd));
  const pref = FONTES[fonte]?.un || "sats", outra = pref === "sats" ? "usd" : "sats";
  if (!u) return pref;
  return Number.isFinite(u[pref]) ? pref : Number.isFinite(u[outra]) ? outra : pref;
}
/** A fonte tem saldo (alguma coleta com sats ou US$)? Earn Bitcoin, por enquanto, só diz se deu certo. */
export const temSaldo = (f, fonte) => serie(f, fonte).some(c => Number.isFinite(c.sats) || Number.isFinite(c.usd) || Number.isFinite(c.brl));

/** Ganho de cada coleta em relação à anterior (na unidade da fonte). O saldo caiu = saque (pelo PayPal), nunca perda. */
export function movimentos(f, fonte) {
  const un = unidade(f, fonte), s = serie(f, fonte).filter(c => Number.isFinite(c[un])), out = [];
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i], d = un === "sats" ? b.sats - a.sats : r2(b[un] - a[un]);
    out.push({ dia: b.dia, de: a.dia, dias: Math.max(1, difDias(a.dia, b.dia)), un, saldo: b[un], ganho: d > 0 ? d : 0, saque: d < 0 ? -d : 0 });
  }
  return out;
}
/** Os saques que o saldo mostrou, com a situação (lançado como entrada em R$, ignorado ou esperando). */
export function saques(f, fonte) {
  return movimentos(f, fonte).filter(m => m.saque > 0).map(m => {
    const chave = `${fonte}|${m.dia}`;
    const lanc = Object.values(f.lanc).find(l => !l.apagado && l.saque?.chave === chave);
    return { ...m, chave, lanc: lanc || null, ignorado: !!f.ignorados[chave] };
  }).reverse();
}

/**
 * Dias perdidos da sequência (pedido do Alediov: no Slice, um dia perdido zera o bônus diário, que é ≈ dia da sequência
 * + 1 sat; em 17/10 e 21/10/2026 o bônus caiu de 36 para 2 sats/dia). Pela sequência de cada coleta: se ela não
 * cresceu o que os dias pedem, a sequência recomeçou no dia (b − seq + 1) e o dia anterior foi perdido. O custo
 * estimado de cada quebra = o bônus do dia perdido (s + 2) + (s + 1) por dia desde a volta até a quebra seguinte ou
 * hoje, em que s = a sequência antes da quebra. Também devolve o calendário dos últimos `n` dias.
 */
export function sequenciaDaFonte(f, fonte, hoje, n = 35) {
  const s = serie(f, fonte), quebras = [];
  const comSeq = s.filter(c => Number.isFinite(c.sequencia));
  for (let i = 1; i < comSeq.length; i++) {
    const a = comSeq[i - 1], b = comSeq[i], g = difDias(a.dia, b.dia);
    if (b.sequencia >= a.sequencia + g) continue;
    const volta = maisDias(b.dia, -(b.sequencia - 1));       // o 1º dia da sequência nova
    let perdido = maisDias(volta, -1);
    if (perdido <= a.dia) perdido = null;                     // sequência zerou entre duas coletas de dias seguidos: não dá para saber o dia
    const antes = perdido ? a.sequencia + difDias(a.dia, perdido) - 1 : a.sequencia;
    quebras.push({ dia: perdido || b.dia, perdido: !!perdido, volta, antes, porDia: antes + 1 });
  }
  quebras.forEach((q, i) => {
    const prox = quebras[i + 1], ate = prox ? maisDias(prox.dia, -1) : hoje;
    const dias = Math.max(0, difDias(q.volta, ate) + 1);
    q.custo = (q.perdido ? q.antes + 2 : 0) + q.porDia * dias;
    q.ate = ate; q.diasDepois = dias;
  });
  // calendário: ok (coleta do dia), perdido (bônus zerado), sem (sem registro da macro), antes (antes da 1ª coleta)
  const tem = new Set(s.map(c => c.dia)), perdidos = new Set(quebras.filter(q => q.perdido).map(q => q.dia)), primeira = s[0]?.dia;
  const dias = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = maisDias(hoje, -k);
    dias.push({ dia: d, st: perdidos.has(d) ? "perdido" : tem.has(d) ? "ok" : !primeira || d < primeira ? "antes" : d === hoje ? "hoje" : "sem" });
  }
  return { quebras: quebras.reverse(), dias, custoTotal: quebras.reduce((t, q) => t + q.custo, 0) };
}

/** Resumo de uma fonte de faucet: saldo, sequência, ganhos de 7 e 30 dias, média por dia e a previsão do saque. */
/**
 * A recompensa diária do Earn Bitcoin (pedido do Alediov, 27/10/2026): o saldo vem à mão (coleta `manual` com `sats` e,
 * opcional, `diaRecompensa`, o DAY das Daily Rewards); cada resgate da macro (execução `ok` num dia depois da última
 * atualização) avança 1 dia num ciclo de 7; com todos os logins, o dia 7 dá ~150 sats (os outros dão RP, pontos do app;
 * respostas do Alediov de 29/10/2026, antes o app supunha 375 a cada 28). Estimativa: não conta prêmios de jogos. null
 * sem atualização à mão.
 */
export function recompensaDiaria(f, fonte, hoje) {
  const ciclo = FONTES[fonte]?.ciclo; if (!ciclo) return null;
  const base = serie(f, fonte).filter(c => c.manual && Number.isFinite(c.sats)).at(-1);
  if (!base) return null;
  const resgates = [...new Set(Object.values(f.execucoes?.[fonte] || {}).filter(r => r.status === "ok" && r.dia > base.dia && r.dia <= hoje).map(r => r.dia))].sort();
  let dia = Number.isFinite(base.diaRecompensa) ? base.diaRecompensa : null, premios = 0;
  if (dia != null) for (const _ of resgates) { dia = (dia % ciclo.dias) + 1; if (dia === ciclo.dias) premios++; }
  const ultimo = resgates.at(-1) || base.dia;
  const prox = dia == null ? null : maisDias(ultimo, dia === ciclo.dias ? ciclo.dias : ciclo.dias - dia);
  return { dia, dias: ciclo.dias, premio: ciclo.premio, informado: base.sats, desde: base.dia, premios, resgates: resgates.length, saldo: base.sats + premios * ciclo.premio, proximoPremio: prox, ultimo };
}
/** Quando o saldo da recompensa diária chega ao mínimo: um prêmio a cada fim de ciclo (estimativa). */
export function previsaoPorCiclo(rd, minimo, hoje) {
  if (!rd || !(minimo > 0)) return null;
  const falta = Math.ceil(minimo - rd.saldo);
  if (falta <= 0) return { falta: 0, dias: 0, data: hoje, pronto: true, porCiclo: true };
  if (!rd.proximoPremio) return { falta, dias: null, data: null, porCiclo: true };
  const premios = Math.ceil(falta / rd.premio), data = maisDias(rd.proximoPremio, (premios - 1) * rd.dias);
  return { falta, premios, dias: Math.max(0, difDias(hoje, data)), data, porCiclo: true };
}

export function resumoFonte(f, fonte, hoje, cot = null) {
  const s = serie(f, fonte), un = unidade(f, fonte), ult = s.at(-1) || null, mov = movimentos(f, fonte);
  const somaDesde = (n) => { const v = mov.filter(m => difDias(m.dia, hoje) < n).reduce((t, m) => t + m.ganho, 0); return un === "sats" ? v : r2(v); };
  // média por dia: ganhos ÷ dias cobertos nos últimos 30 dias (lacunas sem coleta contam pelos dias do intervalo)
  const ult30 = mov.filter(m => difDias(m.dia, hoje) < 30);
  const dias30 = ult30.reduce((t, m) => t + m.dias, 0);
  const media = dias30 ? ult30.reduce((t, m) => t + m.ganho, 0) / dias30 : 0;
  // o mínimo de saque vem na unidade da fonte (`minUn`: US$ no Slice e no EarnApp, sats no ZBD); de US$ para sats (ou o
  // contrário), pela relação sats/US$ da última coleta que trouxe os dois
  const minVal = f.fontes?.[fonte]?.minimoSaque, minUn = FONTES[fonte]?.minUn || "usd";
  const comAmbos = [...s].reverse().find(c => c.sats > 0 && c.usd > 0);
  const btc = minUn === "brl" ? (cot || cotacao(f, hoje)).btc : null;
  const minimo = !(minVal > 0) ? null : minUn === un ? minVal
    : minUn === "brl" ? (btc && un === "sats" ? Math.ceil((minVal / btc) * 1e8) : null)
    : !comAmbos ? null : un === "sats" ? Math.ceil(minVal * comAmbos.sats / comAmbos.usd) : r2(minVal * comAmbos.usd / comAmbos.sats);
  const comSaldo = [...s].reverse().find(c => Number.isFinite(c[un])) || null;
  const saldo = comSaldo ? comSaldo[un] : null;
  const ultSeq = [...s].reverse().find(c => Number.isFinite(c.sequencia));
  let previsao = previsaoSaque(saldo, minimo, media, hoje, un);
  if (ult?.pronto === true) previsao = { ...(previsao || {}), falta: 0, dias: 0, data: hoje, pronto: true, peloSite: true };
  // recompensa diária (Earn Bitcoin): o saldo estimado (o informado + os prêmios de fim de ciclo desde então) e a previsão por ciclo
  const rd = recompensaDiaria(f, fonte, hoje);
  if (rd) return { un, ultima: ult, saldo: rd.saldo, estimado: rd.premios > 0, recompensa: rd, usdSite: null, sequencia: null, tempo: null, pronto: null,
    ganho7: somaDesde(7), ganho30: somaDesde(30), media, hoje: s.find(c => c.dia === hoje) || null, minimo, minUn, previsao: previsaoPorCiclo(rd, minimo, hoje), serie: s, mov, temSaldo: true };
  return { un, ultima: ult, saldo, usdSite: comSaldo?.usd ?? null, sequencia: ultSeq?.sequencia ?? null, tempo: [...s].reverse().find(c => c.tempo)?.tempo || null, pronto: ult?.pronto ?? null,
    ganho7: somaDesde(7), ganho30: somaDesde(30), media, hoje: s.find(c => c.dia === hoje) || null, minimo, minUn, previsao, serie: s, mov, temSaldo: !!comSaldo };
}
/** "Atualizar à mão" (Earn Bitcoin): grava a coleta do dia com o saldo em sats e, opcional, o dia da recompensa diária. */
export function atualizarAMao(f, fonte, dia, { sats, usd, diaRecompensa = null }, agora = new Date().toISOString()) {
  const co = (f.coletas[fonte] ||= {});
  // em US$ (a conta do EarnApp no PC) ou em sats (Earn Bitcoin, ZBD)
  const c = { ...(co[dia] || {}), ...(Number.isFinite(usd) ? { usd: r2(usd) } : { sats: Math.round(sats) }), manual: true, em: agora };
  if (Number.isFinite(diaRecompensa) && diaRecompensa >= 1 && diaRecompensa <= (FONTES[fonte]?.ciclo?.dias || 28)) c.diaRecompensa = Math.round(diaRecompensa); else delete c.diaRecompensa;
  co[dia] = c;
  return c;
}
/** A conta do EarnApp está em uso? A do PC só depois de ele ligar (`f.fontes.earnapppc.ligada`). */
export const contaLigada = (f, id) => !FONTES[id]?.opcional || !!f.fontes?.[id]?.ligada;
/** O EarnApp somado (02/11/2026): o saldo de cada conta (a última leitura), o "pronto para sacar" de cada uma (o saque é
 *  por conta, cada uma com o seu mínimo) e o total. */
export function earnappTotal(f, hoje, cot = null) {
  const contas = CONTAS_EARNAPP.filter(id => contaLigada(f, id)).map(id => {
    const rs = resumoFonte(f, id, hoje, cot), sd = FONTES[id].semMacro ? null : saude(f, id, hoje);
    return { id, nome: FONTES[id].curto || nomeFonte(id), saldo: rs.temSaldo ? rs.saldo : null, minimo: rs.minimo, pronto: !!rs.previsao?.pronto,
      falta: rs.previsao?.falta ?? null, previsao: rs.previsao, sd, ultima: rs.ultima, temSaldo: rs.temSaldo, manual: !!FONTES[id].manual };
  });
  const comSaldo = contas.filter(c => c.saldo != null);
  return { contas, total: comSaldo.length ? r2(comSaldo.reduce((t, c) => t + c.saldo, 0)) : null, n: comSaldo.length, prontas: contas.filter(c => c.pronto).length };
}
/** Quando o saldo chega ao mínimo de saque, pela média de ganho por dia. */
export function previsaoSaque(saldo, minimo, media, hoje, un = "usd") {
  if (!(minimo > 0) || saldo == null) return null;
  const falta = un === "sats" ? Math.ceil(minimo - saldo) : r2(minimo - saldo);
  if (falta <= 0) return { falta: 0, dias: 0, data: hoje, pronto: true };
  if (!(media > 0)) return { falta, dias: null, data: null };
  const dias = Math.ceil(falta / media);
  return { falta, dias, data: maisDias(hoje, dias) };
}
/** Ganho de faucets num mês (na unidade da fonte), "a receber" até o saque. */
export function ganhoNoMes(f, fonte, mes) { const v = movimentos(f, fonte).filter(m => mesDe(m.dia) === mes).reduce((t, m) => t + m.ganho, 0); return unidade(f, fonte) === "sats" ? v : r2(v); }

// ---------------------------------------------------------------- cotação (dólar e bitcoin em R$)
/** Cotação: o dólar (o manual dos ajustes, o de hoje, o último guardado ou estimado) e o bitcoin em R$ (o de hoje, o
 *  último ou, sem nenhum, estimado pelo US$ que o site do Slice mostra: sats ÷ US$ × dólar). */
export function cotacao(f, hoje) {
  const dias = Object.keys(f.cotacoes).sort(), ultU = [...dias].reverse().find(d => f.cotacoes[d].usd > 0), ultB = [...dias].reverse().find(d => f.cotacoes[d].btc > 0);
  const man = f.ajustes?.cotacaoManual;
  const c = man > 0 ? { usd: man, origem: "manual" } : ultU ? { usd: f.cotacoes[ultU].usd, origem: ultU === hoje ? "hoje" : "ultima", dia: ultU } : { usd: 5.4, origem: "estimada" };
  if (ultB) { c.btc = f.cotacoes[ultB].btc; c.origemBtc = ultB === hoje ? "hoje" : "ultima"; c.diaBtc = ultB; }
  else {
    const x = Object.values(f.coletas || {}).flatMap(co => Object.values(co)).filter(k => k.sats > 0 && k.usd > 0).sort((a, b) => (a.em < b.em ? 1 : -1))[0];
    if (x) { c.btc = Math.round((x.usd / x.sats) * 1e8 * c.usd); c.origemBtc = "estimada"; }
  }
  return c;
}
/** Valor de uma fonte em R$: sats pelo bitcoin, US$ pelo dólar. */
export function emReais(cot, valor, un) {
  if (!valor) return 0;
  if (un === "sats") return cot.btc ? r2((valor / 1e8) * cot.btc) : 0;
  if (un === "brl") return r2(valor);
  return r2(valor * cot.usd);
}
/** "8.734 sats" ou "US$ 6,95", conforme a unidade. */
export const naUnidade = (v, un, { sinal = false } = {}) => un === "brl" ? reais(v, { sinal }) : un === "sats" ? `${sinal && v > 0 ? "+" : ""}${Math.round(v).toLocaleString("pt-BR")} sats` : dolares(v, { sinal });

// ---------------------------------------------------------------- o mês
const vale = (fx, mes) => !fx.apagada && fx.ativa !== false && (!fx.desde || fx.desde <= mes) && (!fx.ate || fx.ate >= mes);
export const lancamentos = (f, mes = null) => Object.values(f.lanc).filter(l => !l.apagado && (!mes || mesDe(l.data) === mes)).sort((a, b) => b.data.localeCompare(a.data) || (b.em || "").localeCompare(a.em || ""));

/** As entradas fixas do mês: previstas, recebidas (pelo lançamento ligado) ou "não veio". */
export function fixasDoMes(f, mes, hoje) {
  return Object.values(f.fixas).filter(fx => vale(fx, mes)).sort((a, b) => (a.ordem || 99) - (b.ordem || 99)).map(fx => {
    const lanc = Object.values(f.lanc).find(l => !l.apagado && l.fixa === fx.id && (l.ref || mesDe(l.data)) === mes) || null;
    const pulou = !!f.pulos[`${mes}|${fx.id}`];
    const vence = fx.dia ? `${mes}-${doisDig(Math.min(fx.dia, diasNoMes(mes)))}` : `${mes}-${doisDig(diasNoMes(mes))}`;
    const atrasada = !lanc && !pulou && hoje > vence;
    const devida = !lanc && !pulou && hoje >= vence; // para o "Meu dia": chegou o dia e ainda não foi marcada
    return { ...fx, tipo: fx.tipo === "saida" ? "saida" : "entrada", lanc, pulou, vence, atrasada, devida, previsto: fx.valor || 0, semValor: !(fx.valor > 0), real: lanc ? lanc.valor : pulou ? 0 : null };
  });
}

/** Tudo o que a aba Mês mostra: renda, gastos por categoria com o limite, o que ainda dá para gastar e o que está a receber. */
export function resumoMes(f, mes, hoje) {
  const todas = fixasDoMes(f, mes, hoje), ls = lancamentos(f, mes);
  const fixas = todas.filter(x => x.tipo === "entrada"), fixasSai = todas.filter(x => x.tipo === "saida");
  const entradas = ls.filter(l => l.tipo === "entrada"), saidas = ls.filter(l => l.tipo === "saida");
  const avulsas = entradas.filter(l => !l.fixa);
  const somar = (l) => r2(l.reduce((t, x) => t + (+x.valor || 0), 0));
  const fixasPrev = r2(fixas.reduce((t, x) => t + (x.real ?? x.previsto), 0));
  const fixasRec = r2(fixas.reduce((t, x) => t + (x.lanc ? x.lanc.valor : 0), 0));
  const rendaPrevista = r2(fixasPrev + somar(avulsas));
  const recebido = r2(fixasRec + somar(avulsas));
  const gastos = somar(saidas);
  const pct = Math.max(0, Math.min(RESERVA_MAX, f.ajustes?.reservaPct ?? RESERVA_PADRAO));
  const guardar = Math.round(rendaPrevista * pct) / 100;
  // saídas fixas ainda não pagas (a assinatura…) já estão comprometidas
  const aPagarFixas = r2(fixasSai.filter(x => !x.lanc && !x.pulou).reduce((t, x) => t + x.previsto, 0));
  const podeGastar = r2(rendaPrevista - guardar - gastos - aPagarFixas);
  const porCategoria = categorias(f, "saida").map(c => {
    const gasto = somar(saidas.filter(l => l.cat === c.id));
    const lim = c.limite > 0 ? c.limite : null;
    return { ...c, gasto, limite: lim, resta: lim != null ? r2(lim - gasto) : null, p: lim ? gasto / lim : null, n: saidas.filter(l => l.cat === c.id).length };
  });
  const semCat = somar(saidas.filter(l => !f.categorias[l.cat] || f.categorias[l.cat].apagada));
  if (semCat) porCategoria.push({ id: "_sem", nome: "Sem categoria", icone: "🏷️", cor: 8, gasto: semCat, limite: null, resta: null, p: null });
  const limites = r2(porCategoria.reduce((t, c) => t + (c.limite || 0), 0));
  // faucets e check-ins: o ganho do mês ainda está na plataforma (a receber), em sats (ou US$) e em R$ pela cotação
  const cot = cotacao(f, hoje);
  const aReceber = [...FONTES_ATIVAS, ...CONTAS_EARNAPP.filter(x => x !== "earnapp"), ...FONTES_REAIS].map(fo => { const un = unidade(f, fo), v = ganhoNoMes(f, fo, mes); return { fonte: fo, un, valor: v, brl: emReais(cot, v, un) }; }).filter(x => x.valor > 0);
  return { mes, fixas, entradas, saidas, avulsas, rendaPrevista, recebido, gastos, guardar, reservaPct: pct, podeGastar, naMao: r2(recebido - gastos),
    porCategoria, limites, aReceber, cotacao: cot, pendentes: fixas.filter(x => x.devida), fixasSai, aPagarFixas, aPagar: fixasSai.filter(x => x.devida && !x.semValor) };
}

/** Alerta do orçamento ao lançar um gasto: "80" ao chegar a 80% do limite, "100" ao passar. */
export function alertaOrcamento(antes, depois, limite) {
  if (!(limite > 0)) return null;
  if (antes <= limite && depois > limite) return "100";
  if (antes < limite * 0.8 && depois >= limite * 0.8) return "80";
  return null;
}

// ---------------------------------------------------------------- almoço, passagens e a sugestão do orçamento
/** Dias de aula do mês (seg. a sex. com compromisso presencial na Agenda, `usa(dia)`); sem Agenda (`usa` nulo), 22. */
export function diasDeAula(mes, usa = null) {
  if (typeof usa !== "function") return DIAS_AULA_PADRAO;
  let n = 0;
  for (let k = 1; k <= diasNoMes(mes); k++) { const d = `${mes}-${doisDig(k)}`, s = new Date(d + "T12:00:00").getDay(); if (s >= 1 && s <= 5 && usa(d)) n++; }
  return n;
}
/** Quanto Comida e Transporte pedem num mês com `dias` de aula: almoço × dias; recargas inteiras para 2 passagens por dia. */
export function custoDoMes(f, dias) {
  const rc = recarga(f), pass = dias * PASSAGENS_POR_DIA, recargas = pass ? Math.ceil(pass / rc.passagens) : 0;
  return { dias, almoco: almoco(f), comida: r2(almoco(f) * dias), passagens: pass, recargas, transporte: r2(recargas * rc.valor), recarga: rc };
}

/** Sugestão do app para os limites (pedido do Alediov): da renda prevista do mês sai o que guardar; Comida (almoço ×
 *  dias de aula) e Transporte (recargas para 2 passagens por dia de aula) entram com o valor calculado; o resto é
 *  dividido pelos pesos das outras (Materiais 35, Cursos 25, Eventos 20, Outros 20; as criadas por ele, 10),
 *  arredondado a R$ 10 e puxado um pouco para o que ele costuma gastar nos 3 meses anteriores.
 *  `diasAula`: os dias de aula do mês pela Agenda (`diasDeAula`); sem ele, 22. */
export function sugerirOrcamento(f, mes, hoje, { diasAula = null } = {}) {
  const r = resumoMes(f, mes, hoje);
  const base = Math.max(0, r.rendaPrevista - r.guardar);
  const cats = categorias(f, "saida");
  const dias = Number.isFinite(diasAula) ? diasAula : DIAS_AULA_PADRAO;
  const custo = custoDoMes(f, dias), out = {};
  for (const c of cats) { const k = calculoDe(c.id); if (k === "almoco") out[c.id] = custo.comida; else if (k === "passagens") out[c.id] = custo.transporte; else if (k === "fixas") out[c.id] = r2(r.fixasSai.filter(x => x.cat === c.id).reduce((t, x) => t + x.previsto, 0)); }
  const fixo = r2(Object.values(out).reduce((a, b) => a + b, 0));
  const resto = Math.max(0, base - fixo);
  const outras = cats.filter(c => !calculoDe(c.id));
  const pesos = outras.map(c => pesoPadrao(c.id) ?? 10), total = pesos.reduce((a, b) => a + b, 0) || 1;
  // média dos 3 meses anteriores com gastos
  const hist = {};
  for (let k = 1; k <= 3; k++) { const m = somaMes(mes, -k); for (const l of lancamentos(f, m)) if (l.tipo === "saida") (hist[l.cat] ||= {})[m] = (hist[l.cat][m] || 0) + l.valor; }
  outras.forEach((c, i) => {
    let v = resto * pesos[i] / total;
    const meses = Object.values(hist[c.id] || {});
    if (meses.length) v = 0.7 * v + 0.3 * (meses.reduce((a, b) => a + b, 0) / meses.length);
    out[c.id] = Math.max(0, Math.round(v / 10) * 10);
  });
  // o arredondamento não pode passar do que sobra para as outras
  let soma = outras.reduce((a, c) => a + out[c.id], 0);
  for (const c of [...outras].reverse()) { if (soma <= resto) break; const tira = Math.min(out[c.id], Math.ceil((soma - resto) / 10) * 10); out[c.id] -= tira; soma -= tira; }
  return { limites: out, base: r2(base), renda: r.rendaPrevista, guardar: r.guardar, resto: r2(resto), custo, diasAula: dias, padrao: !Number.isFinite(diasAula) };
}

/** A última recarga do cartão de passagens (lançamento com `recarga`). */
export function ultimaRecarga(f) {
  return Object.values(f.lanc).filter(l => !l.apagado && l.recarga?.passagens > 0).sort((a, b) => b.data.localeCompare(a.data) || (b.em || "").localeCompare(a.em || ""))[0] || null;
}
/**
 * Estimativa das passagens que sobram no cartão (pedidos do Alediov, 27/10/2026). As passagens se SOMAM: na recarga, as
 * que sobravam + as da recarga. Conta dia a dia desde a correção à mão mais recente (`f.passagens` {restam, dia,
 * contaHoje, em}) ou, sem ela, desde as últimas recargas (até 12): em cada dia, primeiro o que aconteceu (a correção
 * troca o número; a recarga soma), depois −2 se o dia teve compromisso presencial (`usa(dia)`); o dia da correção só
 * desconta se ele disse que ainda ia usar as de hoje (`contaHoje`), e nunca fica abaixo de 0. Também diz até que dia
 * dá (`ate`: o último dia com compromisso coberto) e o 1º dia que fica sem (`faltaEm`), olhando até 120 dias. `antes`:
 * quantas havia logo antes da última recarga (null se ela foi a primeira). null sem recarga nem correção.
 */
export function passagensRestantes(f, hoje, usa) {
  const cor = Number.isFinite(f.passagens?.restam) ? f.passagens : null;
  const depois = (a, b) => a.dia > b.dia || (a.dia === b.dia && (a.em || "") >= (b.em || ""));
  let recs = Object.values(f.lanc).filter(l => !l.apagado && l.recarga?.passagens > 0).map(l => ({ tipo: "recarga", dia: l.data, em: l.em || "", qtd: l.recarga.passagens, lanc: l.id }));
  if (cor) recs = recs.filter(r => depois(r, cor));
  recs.sort((a, b) => a.dia.localeCompare(b.dia) || a.em.localeCompare(b.em));
  recs = recs.slice(-12);
  const evs = [...(cor ? [{ tipo: "correcao", dia: cor.dia, em: cor.em || "", qtd: cor.restam, contaDia: !!cor.contaHoje }] : []), ...recs];
  if (!evs.length) return null;
  const usou = typeof usa === "function" ? usa : () => false;
  let n = null, antes = null, usadas = 0, dias = 0, k = 0;
  const base = evs.at(-1);
  for (let d = evs[0].dia; d <= hoje && k < 800; d = maisDias(d, 1), k++) {
    let desconta = true;
    for (const e of evs.filter(x => x.dia === d)) {
      if (e.tipo === "correcao") { n = e.qtd; desconta = e.contaDia; }
      else { if (e === base) antes = n; n = Math.max(0, n ?? 0) + e.qtd; }
    }
    if (n != null && desconta && usou(d)) {
      n = Math.max(0, n - PASSAGENS_POR_DIA);
      if (d > base.dia || (d === base.dia && (base.tipo === "recarga" || base.contaDia))) { usadas += PASSAGENS_POR_DIA; dias++; }
    }
  }
  const restam = Math.max(0, n ?? 0);
  let r = restam, ate = null, faltaEm = null;
  for (let q = 1; q <= 120; q++) {
    const d = maisDias(hoje, q); if (!usou(d)) continue;
    if (r < PASSAGENS_POR_DIA) { faltaEm = d; break; }
    r -= PASSAGENS_POR_DIA; ate = d;
  }
  return { restam, base: { tipo: base.tipo, dia: base.dia, qtd: base.qtd, em: base.em, lanc: base.lanc || null }, antes, usadas, dias, ate, faltaEm, baixo: restam <= 4 };
}
/** Recarregar já? (Meu dia e o destaque da aba Mês): ≤ 4 passagens e algum dia de aula à frente que elas não cobrem. */
export const precisaRecarregar = (p) => !!p && p.baixo && !!p.faltaEm;

/** Entradas × saídas dos últimos `n` meses (para os gráficos), com as saídas por categoria. */
export function historico(f, mesFinal, n = 6, hoje = null) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const mes = somaMes(mesFinal, -k), ls = lancamentos(f, mes);
    const ent = r2(ls.filter(l => l.tipo === "entrada").reduce((t, l) => t + l.valor, 0));
    const sai = r2(ls.filter(l => l.tipo === "saida").reduce((t, l) => t + l.valor, 0));
    const porCat = {};
    for (const l of ls) if (l.tipo === "saida") porCat[l.cat] = r2((porCat[l.cat] || 0) + l.valor);
    out.push({ mes, entradas: ent, saidas: sai, porCat, saldo: r2(ent - sai), atual: hoje ? mes === mesDe(hoje) : false });
  }
  return out;
}

/** Descrições já usadas (para as previsões do teclado), das mais usadas para as menos. */
export function descricoesUsadas(f, cat = null) {
  const cont = {};
  for (const l of Object.values(f.lanc)) if (!l.apagado && l.desc && (!cat || l.cat === cat)) cont[l.desc] = (cont[l.desc] || 0) + 1;
  return Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([d]) => d);
}
