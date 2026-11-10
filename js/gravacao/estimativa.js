// Estimativa do tempo da transcrição das aulas (pedido do Alediov, 05/11/2026: "acompanhar em mais detalhes, com
// estimativas… saber quanto tempo levará para terminar"). Puro, sem DOM (teste: node tools/teste_transcricao.mjs).
//
// A conta:
// - **Fator** = segundos de áudio por segundo de relógio. Vem das últimas partes transcritas NESTE aparelho com o
//   mesmo modelo e motor (Transcricao.anotarVelocidade no Java: abrir o áudio + o Whisper, partes de 20 s ou mais;
//   as 12 mais novas; soma do áudio ÷ soma do tempo). Sem elas: as do mesmo modelo noutra variante do motor, o
//   "Testar a velocidade" do mesmo modelo e, por fim, as aulas já transcritas (`transcricao.segundos`, só o Whisper).
// - **O que falta da aula atual** = (o que falta da parte + as partes seguintes) ÷ fator. Na parte em andamento, o
//   fator se mistura com o ritmo dela (áudio feito ÷ tempo desde que começou), pesando mais quanto mais dela já foi
//   (a partir de 10% e 15 s). Igual a TranscricaoService.restanteAula.
// - **A fila** segue a ordem do serviço (Aulas.proximaParaTranscrever: a mais recente primeiro; a que está rodando
//   antes de todas); cada aula soma o áudio das partes que faltam ÷ fator.
// - **Noite**: de madrugada a transcrição só começa da hora escolhida (padrão 22h) até as 7h, carregando, e para quando
//   tiram da tomada (de manhã, para levar o celular). O tempo que falta é distribuído pelas janelas (a de agora, se já
//   estiver nela, e as seguintes), com o fim às 7h como aproximação da hora de tirar da tomada: termina nesta noite ou
//   em N noites. "Transcrever agora" (fora da noite) e a da madrugada que passou das 7h ainda na tomada não têm
//   janela: terminam em agora + o que falta.

export const FIM_JANELA = 7; // a janela da noite vai até as 7h (Transcricao.naJanela)
const MIN = 60000, HORA = 60 * MIN;

/** A chave das amostras: o modelo e a variante do motor (Transcricao.chaveVelocidade). */
export const chaveVelocidade = (modelo, variante) => `${modelo || "turbo"}|${variante || ""}`;

const somar = (l) => (l || []).reduce((s, a) => [s[0] + (+a?.[0] || 0), s[1] + (+a?.[1] || 0), s[2] + 1], [0, 0, 0]);

/**
 * Fator de velocidade (áudio ÷ relógio) e de onde ele veio:
 * { fator, fonte: "medido" | "outra" | "teste" | "aulas" | null, amostras, audio (s) }.
 */
export function fatorDe({ velocidades = {}, modelo = "turbo", variante = "", teste = null, aulas = [] } = {}) {
  const [au, ga, n] = somar(velocidades[chaveVelocidade(modelo, variante)]);
  if (au > 0 && ga > 0) return { fator: au / ga, fonte: "medido", amostras: n, audio: au };
  // mesmo modelo, outra variante do motor (trocou o APK): melhor que nada
  let o = [0, 0, 0];
  for (const [k, l] of Object.entries(velocidades || {})) if (k.startsWith(`${modelo}|`)) { const x = somar(l); o = [o[0] + x[0], o[1] + x[1], o[2] + x[2]]; }
  if (o[0] > 0 && o[1] > 0) return { fator: o[0] / o[1], fonte: "outra", amostras: o[2], audio: o[0] };
  if (teste?.fator > 0 && (!teste.modelo || teste.modelo === modelo)) return { fator: +teste.fator, fonte: "teste", amostras: 1, audio: +teste.audio || 60 };
  // aulas já transcritas com esse modelo (o nome do arquivo: ggml-large-v3-turbo-q5_0, ggml-small-q5_1)
  let a = 0, g = 0, k = 0;
  for (const x of aulas || []) {
    const t = x?.transcricao || {};
    if (t.situacao !== "feita" || !(t.segundos > 0) || !(x.duracao > 0)) continue;
    if (t.modelo && !String(t.modelo).includes(modelo === "turbo" ? "turbo" : modelo)) continue;
    a += x.duracao / 1000; g += t.segundos; k++;
  }
  if (a > 0 && g > 0) return { fator: a / g, fonte: "aulas", amostras: k, audio: a };
  return { fator: 0, fonte: null, amostras: 0, audio: 0 };
}

/** Milissegundos de relógio que faltam para a aula que está rodando (`tr` = estado do serviço), ou null. */
export function restanteAula(tr, fator, agora = Date.now()) {
  if (!tr?.rodando || !(tr.partes > 0)) return null;
  const pct = Math.max(0, Math.min(1, +tr.parteProg || 0)), dur = +tr.durParte || 0;
  let f = +fator || 0;
  const gasto = agora - (+tr.iniParte || agora);
  if (tr.etapa === "transcrevendo" && pct >= 0.1 && gasto > 15000) {
    const vivo = (dur * pct) / gasto;
    f = f > 0 ? f * (1 - pct) + vivo * pct : vivo;
  }
  if (!(f > 0)) return null;
  // as partes depois desta: o que o serviço mandou ou, num estado antigo, total − feito − o resto da parte
  const depois = tr.depoisDaParte != null ? +tr.depoisDaParte : Math.max(0, (+tr.totalAula || 0) - (+tr.feitoAula || 0) - dur * (1 - pct));
  return Math.round((dur * (1 - pct) + depois) / f);
}

/** O áudio (ms) que falta numa aula da fila: as partes a partir da que estava em andamento. */
export function audioQueFalta(aula) {
  const ps = aula?.partes || [], t = aula?.transcricao || {};
  const desde = t.situacao === "andamento" ? Math.max(0, Math.min(ps.length, +t.parte || 0)) : 0;
  let r = 0;
  for (let k = desde; k < ps.length; k++) r += Math.max(0, +ps[k]?.dur || 0);
  return r;
}

const naFilaSit = (a) => !a?.gravando && (a?.partes || []).length && ["fila", "andamento"].includes(a?.transcricao?.situacao);

/**
 * As aulas na ordem em que serão transcritas: a que está rodando, depois as da fila da mais recente para a mais
 * antiga (Aulas.proximaParaTranscrever). Cada uma: { id, titulo, disciplina, data, totalMs, faltaMs (áudio), atual }.
 */
export function filaDe(aulas, tr) {
  const l = (aulas || []).filter(a => naFilaSit(a) || (tr?.rodando && a?.id === tr.id));
  l.sort((a, b) => (tr?.rodando ? (b.id === tr.id) - (a.id === tr.id) : 0) || (b.criado || 0) - (a.criado || 0));
  return l.map(a => {
    const atual = !!(tr?.rodando && a.id === tr.id);
    const total = +a.duracao || (a.partes || []).reduce((s, p) => s + (+p.dur || 0), 0);
    const falta = atual && tr.partes > 0 ? Math.max(0, total - (+tr.feitoAula || 0)) : audioQueFalta(a);
    return { id: a.id, titulo: a.titulo || "", disciplina: a.disciplina || "Aula", data: a.data || "", totalMs: total, faltaMs: falta, atual,
      partes: (a.partes || []).length, parte: atual ? +tr.parte || 0 : a.transcricao?.situacao === "andamento" ? +a.transcricao.parte || 0 : 0 };
  });
}

// ---------------------------------------------------------------- janelas da noite
/** A janela da noite que contém `t` ([ini, fim] em ms) ou null. `hora` = início (20 a 2; até as 7h). */
export function janelaEm(t, hora = 22) {
  const d = new Date(t), h = d.getHours();
  const em = (base, dias, hh) => { const x = new Date(base); x.setDate(x.getDate() + dias); x.setHours(hh, 0, 0, 0); return +x; };
  if (hora <= FIM_JANELA) return h >= hora && h < FIM_JANELA ? [em(d, 0, hora), em(d, 0, FIM_JANELA)] : null;
  if (h >= hora) return [em(d, 0, hora), em(d, 1, FIM_JANELA)];
  if (h < FIM_JANELA) return [em(d, -1, hora), em(d, 0, FIM_JANELA)];
  return null;
}
/** O começo da próxima janela depois de `t` (ou `t`, se já estiver numa). */
export function proximaJanela(t, hora = 22) {
  if (janelaEm(t, hora)) return t;
  const d = new Date(t), x = new Date(d);
  x.setHours(hora, 0, 0, 0);
  if (+x <= t) x.setDate(x.getDate() + 1);
  return +x;
}
/**
 * Distribui `restMs` de trabalho pelas janelas a partir de `agora` (a de agora, se já estiver nela).
 * Devolve { fimEm, noites, comeca } (noites = quantas janelas usa; 1 = só esta ou a próxima).
 */
export function planoNoites(restMs, agora = Date.now(), hora = 22) {
  let t = proximaJanela(agora, hora), rem = Math.max(0, restMs), noites = 0;
  const comeca = t;
  while (noites < 60) {
    const j = janelaEm(t, hora);
    if (!j) { t = proximaJanela(t + MIN, hora); continue; }
    noites++;
    const cabe = j[1] - t;
    if (rem <= cabe) return { fimEm: t + rem, noites, comeca };
    rem -= cabe;
    t = proximaJanela(j[1] + MIN, hora);
  }
  return { fimEm: t, noites, comeca };
}

// ---------------------------------------------------------------- tudo junto
/**
 * O quadro da transcrição: { fator, atual, fila: [{ …, restanteMs, fimEm }], totalMs (relógio), fimEm, modo, noite }.
 * `modo`: "agora" (rodando fora da noite: sem janela), "noite" (rodando de madrugada) ou "espera" (parado, esperando a
 * próxima noite; com `auto` desligado, null). `noite` = planoNoites quando a janela importa.
 */
export function estimar({ tr = {}, aulas = [], fator = 0, agora = Date.now(), hora = 22, auto = true } = {}) {
  const fila = filaDe(aulas, tr);
  const atual = fila.find(x => x.atual) || null;
  let t = 0;
  for (const x of fila) {
    const r = x.atual ? restanteAula(tr, fator, agora) : fator > 0 ? Math.round(x.faltaMs / fator) : null;
    x.restanteMs = r;
    if (r == null) { t = null; } else if (t != null) t += r;
    x.acumuladoMs = t;
  }
  const modo = tr?.rodando ? (tr.noite ? "noite" : "agora") : fila.length && auto ? "espera" : null;
  let noite = null, fimEm = null;
  // rodando de madrugada depois das 7h (ainda na tomada): o serviço segue até acabar a fila ou tirarem da tomada
  const corrido = modo === "agora" || (modo === "noite" && !janelaEm(agora, hora));
  if (t != null && fila.length) {
    if (corrido) fimEm = agora + t;
    else if (modo) { noite = planoNoites(t, agora, hora); fimEm = noite.fimEm; }
    // fim de cada aula na mesma linha do tempo
    for (const x of fila) x.fimEm = x.acumuladoMs == null ? null : corrido ? agora + x.acumuladoMs : modo ? planoNoites(x.acumuladoMs, agora, hora).fimEm : null;
  }
  const pctParte = tr?.rodando ? Math.max(0, Math.min(1, +tr.parteProg || 0)) : 0;
  return {
    fator, modo, fila, totalMs: fila.length ? t : 0, fimEm, noite,
    atual: atual && { ...atual, parte: +tr.parte || 0, partes: +tr.partes || atual.partes, pctParte, feitoMs: +tr.feitoAula || 0, etapa: tr.etapa || "" },
    audioFilaMs: fila.reduce((s, x) => s + x.faltaMs, 0),
  };
}

// ---------------------------------------------------------------- textos
/** "~25 min", "~1 h 10", "menos de 1 min" (como TranscricaoService.duracaoTexto). */
export function duracao(ms) { return duracaoCurta(ms); }
function duracaoCurta(ms) {
  const m = Math.round((ms || 0) / MIN);
  if (m < 1) return "menos de 1 min";
  if (m < 60) return `~${m} min`;
  return `~${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
}
/** Minutos de áudio: "12 min", "1 h 40". */
export function minutosAudio(ms) {
  const m = Math.round((ms || 0) / MIN);
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`;
}
/** "03h40" (arredondado a 5 min). */
export function horaTexto(ms) {
  const d = new Date(Math.round(ms / (5 * MIN)) * 5 * MIN);
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
/** "hoje", "amanhã", "sábado" ou "dia 12/11", em relação a `agora`. */
export function diaTexto(ms, agora = Date.now()) {
  const a = new Date(agora); a.setHours(0, 0, 0, 0);
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  const n = Math.round((+d - +a) / (24 * HORA));
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n > 1 && n < 7) return DIAS[d.getDay()];
  return `dia ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/**
 * A linha do fim: "Termina por volta das 03h40 (~1 h 25).", "Termina nesta noite, por volta das 03h40 (…)",
 * "Começa hoje às 22h e termina amanhã, por volta das 01h30 (…)" ou "Precisa de 3 noites: termina sábado, … ".
 */
export function textoFim(q, agora = Date.now()) {
  if (!q?.fila?.length) return "Nada esperando transcrição.";
  if (q.totalMs == null || !q.fimEm) return "Medindo a velocidade deste celular…";
  const quando = (ms) => { const dia = diaTexto(ms, agora); return `${dia === "hoje" ? "" : `${dia}, `}por volta das ${horaTexto(ms)}`; };
  const duracao = (ms) => duracaoCurta(ms).replace(/ /g, "\u00a0"); // "~1 h 57" sem quebrar a linha no meio
  if (q.modo === "agora" || (q.modo === "noite" && !q.noite)) return `Termina ${quando(q.fimEm)} (${duracao(q.totalMs)}).`;
  if (!q.noite) return `${duracao(q.totalMs)} de transcrição.`;
  const { noites, comeca } = q.noite;
  if (noites > 1) return `Precisa de ${noites} noites: termina ${quando(q.fimEm)} (${duracao(q.totalMs)} no total).`;
  if (comeca <= agora) return `Termina nesta noite, ${quando(q.fimEm)} (${duracao(q.totalMs)}).`;
  const h = new Date(comeca).getHours();
  return `Começa ${diaTexto(comeca, agora)} às ${h}h e termina ${quando(q.fimEm)} (${duracao(q.totalMs)}).`;
}
/** O texto da notificação do serviço: "Parte 3 de 6 · ~25 min restantes" (o Java monta igual). */
export function textoNotificacao(tr, fator, agora = Date.now()) {
  if (!tr?.rodando || !(tr.partes > 0)) return tr?.fase || "Preparando…";
  const r = restanteAula(tr, fator, agora);
  return `Parte ${(+tr.parte || 0) + 1} de ${tr.partes} · ${r != null ? `${duracao(r)} restantes` : "medindo a velocidade"}`;
}
/** "1,8× o tempo real" / "0,6× o tempo real". */
export const fatorTexto = (f) => `${String(Math.round(f * 10) / 10).replace(".", ",")}× o tempo real`;
