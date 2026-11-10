// Notificações locais (só no app Android). Reagenda tudo a cada abertura e a
// cada mudança na agenda: lembretes de estudo e lembretes de aula para 14 dias.
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";
import { E, hojeISO, somaDias } from "./estado.js";
import { A, textoLembrete, AVISO_ONLINE_MIN, situacaoCertificado, sessoesDe } from "./agenda.js";
import { RARIDADES, previsaoBaus } from "./economia.js";
import { proximosSazonais } from "./eventos.js";
import { avisosDeVespera } from "./alarmes.js";
import { saude as saudeFinancas, FONTES_SAUDE as FONTES_FIN, nomeFonte, financasConferidas } from "./financas/contas.js";

const nativo = Capacitor.isNativePlatform();
const LN = nativo ? registerPlugin("LocalNotifications") : null;

function emData(iso, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(iso + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}

/** Lista o que seria agendado (também usada para pré-visualizar no app). */
export function planoDeLembretes(dias = 14) {
  const out = [], cfg = A().lembretes, agora = new Date();
  if (!cfg.ativo) return out;
  for (let i = 0; i <= dias; i++) {
    const data = somaDias(hojeISO(), i);
    const v = textoLembrete(data, "vespera");
    const quandoV = emData(somaDias(data, -1), cfg.vespera);
    if (v && quandoV > agora) out.push({ id: 100 + i * 2, quando: quandoV, ...v });
    const m = textoLembrete(data, "manha");
    const quandoM = emData(data, cfg.manha);
    if (m && quandoM > agora) out.push({ id: 101 + i * 2, quando: quandoM, ...m });
  }
  return out;
}

let timer = null;
export function reagendar() { clearTimeout(timer); timer = setTimeout(reagendarAgora, 400); }

async function reagendarAgora() {
  if (!LN) return;
  try {
    const perm = await LN.checkPermissions();
    if (perm.display !== "granted") {
      const p2 = await LN.requestPermissions();
      if (p2.display !== "granted") return;
    }
    const pend = await LN.getPending();
    if (pend.notifications?.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    const lista = [];
    if (E().config.lembretes) {
      lista.push(
        { id: 1, title: "Hora da trilha da manhã ☀️", body: "Suas lições já estão no celular, mesmo sem internet.", schedule: { on: { hour: 6, minute: 40 }, allowWhileIdle: true } },
        { id: 3, title: "Patologia no almoço 🍱", body: "A sessão da tarde está liberada. Bora?", schedule: { on: { hour: 12, minute: 0 }, allowWhileIdle: true } },
        { id: 2, title: "Revisão da noite 🌙", body: "Fixe o conteúdo de hoje e mantenha a ofensiva.", schedule: { on: { hour: 18, minute: 50 }, allowWhileIdle: true } },
      );
    }
    for (const l of planoDeLembretes()) {
      lista.push({ id: l.id, title: l.titulo, body: l.corpo, largeBody: l.longo, summaryText: "Agenda", schedule: { at: l.quando, allowWhileIdle: true } });
    }
    // modo foco em andamento (foco.js): aviso no fim, para a tela apagada
    const fa = E().config.focoAtivo;
    if (fa && !fa.pausado && fa.fim > Date.now()) lista.push({ id: 960, title: "Foco concluído ⏱️", body: "Hora de uma pausa. Toque para ver o que fez.", schedule: { at: new Date(fa.fim), allowWhileIdle: true } });
    // eventos (Even3…): lembrete antes de começar (30 min, por padrão; 0 = sem lembrete)
    const eventosAg = A().eventosOnline || [];
    // um lembrete por dia do evento (eventos de vários dias, `sessoesDe`), com ids seguidos: não colidem entre os dias
    const eventosOn = eventosAg.flatMap(ev => sessoesDe(ev)).filter(s => s.data && s.inicio && (s.aviso ?? AVISO_ONLINE_MIN) > 0)
      .map(s => ({ s, quando: new Date(emData(s.data, s.inicio).getTime() - (s.aviso ?? AVISO_ONLINE_MIN) * 60000) }))
      .filter(x => x.quando > new Date() && x.quando - Date.now() < 30 * 86400000)
      .sort((a, b) => a.quando - b.quando).slice(0, 40);
    const antes = (min) => min >= 1440 ? "1 dia" : min >= 60 ? `${min / 60} h` : `${min} min`;
    eventosOn.forEach(({ s, quando }, k) => lista.push({ id: 3000 + k, title: `Em ${antes(s.aviso ?? AVISO_ONLINE_MIN)}: ${s.nome}${s.n > 1 ? ` (dia ${s.i + 1} de ${s.n})` : ""} 🎙️`, body: `Começa às ${s.inicio}${s.fim ? ` e vai até ${s.fim}` : ""} (${s.modalidade === "presencial" ? "presencial" : "online"}).`, summaryText: "Evento", schedule: { at: quando, allowWhileIdle: true } }));
    // certificado que não chegou (um só por evento, mesmo de vários dias): no fim do prazo (30 dias do último dia, ou 15 depois de falar com o suporte), às 9h; e de novo a cada 7 dias
    eventosAg.map(ev => ({ ev, s: situacaoCertificado(ev) })).filter(x => x.s && x.s.estado !== "recebido").map(({ ev, s }) => {
      const quando = emData(s.limite, "09:00");
      while (quando <= new Date()) quando.setDate(quando.getDate() + 7);
      return { ev, quando };
    }).filter(x => x.quando - Date.now() < 60 * 86400000).sort((a, b) => a.quando - b.quando).slice(0, 30)
      .forEach(({ ev, quando }, k) => lista.push({ id: 3100 + k, title: `Certificado ainda não chegou 🎓`, body: `${ev.nome}: ${ev.suporteEm ? "já faz 15 dias que você falou com o suporte" : sessoesDe(ev).length > 1 ? "já faz 30 dias do último dia do evento" : "já faz 30 dias do evento"}. Vale escrever para o suporte do evento. Se já recebeu, marque na Agenda.`, summaryText: "Evento", schedule: { at: quando, allowWhileIdle: true } }));
    // alarmes (alarmes.js): na véspera do HUOP ou do CEO no fim de semana, às 20h, conferir o horário (ids 1200+)
    try { for (const a of avisosDeVespera()) lista.push({ id: a.id, title: a.title, body: a.body, summaryText: "Alarme", extra: a.extra, schedule: { at: a.quando, allowWhileIdle: true } }); } catch (e) { console.warn("alarmes: véspera", e); }
    // gravação das aulas (gravacao/gravacao.js): "Gravar <disciplina>?" no começo das aulas, só se ele ligou (ids 4000+)
    try { const GR = await import("./gravacao/gravacao.js"), AG = await import("./agenda.js"); lista.push(...GR.lembretesGravacao(AG.eventosDoDia, somaDias)); } catch (e) { console.warn("gravação: avisos", e); }
    // baús: os que estão abrindo e, com a abertura automática, os da fila prevista (previsaoBaus em economia.js)
    try { previsaoBaus().slice(0, 4).forEach((b, k) => lista.push({ id: 900 + k, title: `${RARIDADES[b.raridade].nome} pronto! 🎁`, body: "Abra agora e veja o que veio dentro.", schedule: { at: new Date(b.pronto), allowWhileIdle: true } })); } catch (e) { console.warn("baús: avisos", e); }
    proximosSazonais().forEach((ev, k) => {
      const quando = emData(ev.ini, "09:00");
      if (quando > new Date() && quando - Date.now() < 15 * 86400000)
        lista.push({ id: 950 + k, title: `Começou: ${ev.nome}!`, body: `Até ${ev.fim.slice(8, 10)}/${ev.fim.slice(5, 7)}: chapéu e carta exclusivos na loja do evento.`, schedule: { at: quando, allowWhileIdle: true } });
    });
    // OdontoScan: fichas na fila da madrugada → de manhã, avisa que há fichas lidas para trazer e revisar
    const c = E().config;
    if (c.scanNaFila > 0 && Date.now() - (c.scanFilaEm || 0) < 3 * 86400000) {
      const quando = new Date(); quando.setHours(7, 15, 0, 0);
      if (quando <= new Date()) quando.setDate(quando.getDate() + 1);
      const n = c.scanNaFila;
      lista.push({ id: 970, title: "Leitura da madrugada pronta 🌙", body: `${n === 1 ? "Havia 1 ficha" : `Havia ${n} fichas`} na fila da madrugada. Abra a Iniciação Científica para trazer as que foram lidas e revisar.`, schedule: { at: quando, allowWhileIdle: true } });
    }
    // fila da madrugada incompleta (fichas prontas ainda no aparelho): lembrete às 21h para abrir o app uns minutos
    if (c.scanFaltaFila > 0 && Date.now() - (c.scanFilaEm || 0) < 86400000) {
      const quando = new Date(); quando.setHours(21, 0, 0, 0);
      if (quando > new Date()) lista.push({ id: 971, title: "Encha a fila da madrugada 📤", body: `Faltam ${c.scanFaltaFila} fichas prontas para a leitura desta noite (a fila tem ${c.scanNaFila} de ${c.scanFilaAlvo}). Deixe a Iniciação Científica aberta uns ${Math.max(1, Math.ceil(c.scanFaltaFila * 1.6 / 60))} min.`, schedule: { at: quando, allowWhileIdle: true } });
    }
    // Músicas: artistas cuja conferência (3 meses) venceu: lembrete aos domingos, 10h, nas próximas 8 semanas
    const vencem = (c.musicasVencem || []).filter(Number.isFinite);
    if (vencem.length) {
      const dom = new Date(); dom.setHours(10, 0, 0, 0); dom.setDate(dom.getDate() + ((7 - dom.getDay()) % 7));
      if (dom <= new Date()) dom.setDate(dom.getDate() + 7);
      for (let k = 0; k < 8; k++, dom.setDate(dom.getDate() + 7)) {
        const n = vencem.filter(t => t <= +dom).length;
        if (n) lista.push({ id: 985 + k, title: "Artistas para conferir 🎵", body: `${n === 1 ? "1 artista completou" : `${n} artistas completaram`} 3 meses desde a última conferência. Veja se ${n === 1 ? "lançou" : "lançaram"} algo novo.`, summaryText: "Músicas", extra: { area: "musicas:conferir" }, schedule: { at: new Date(dom), allowWhileIdle: true } });
      }
    }
    // Finanças (opcional, desligado por padrão): às 9h, se o app soube que alguma macro de check-in (Slice, EarnApp,
    // Earn Bitcoin, ZBD) não terminou hoje (id 976); quando a leitura da issue traz a execução ok, o reagendar tira o aviso
    const fin = E().financas;
    // (o EarnApp dos outros aparelhos também; e nada se ele já conferiu as Finanças hoje, "Conferi as Finanças")
    if (fin?.ajustes?.avisoSemColeta && fin.execucoes && !financasConferidas(fin, hojeISO())) {
      const hoje = hojeISO(), quando = new Date(); quando.setHours(9, 0, 0, 0);
      const ruins = FONTES_FIN.map(fo => [fo, saudeFinancas(fin, fo, hoje)]).filter(([, sd]) => sd.ativa && !["ok", "aguardando"].includes(sd.estado)); // "aguardando": o resgate ainda não liberou
      if (ruins.length && quando > new Date()) {
        const [fo, sd] = ruins[0], nomes = ruins.map(([x]) => nomeFonte(x));
        lista.push({ id: 976, title: ruins.length === 1 ? `${nomes[0]}: a macro não terminou hoje` : `Check-ins: ${ruins.length} macros não terminaram hoje`,
          body: ruins.length > 1 ? `${nomes.join(", ")}. Abra os apps para não perder as sequências.` : sd.deHoje[0]?.etapa ? `Parou na etapa ${sd.deHoje[0].etapa}. Abra o ${nomeFonte(fo)} para não perder a sequência.` : `Nenhum registro da execução de hoje. Abra o ${nomeFonte(fo)} para não perder a sequência.`,
          summaryText: "Finanças", extra: { area: "financas" }, schedule: { at: quando, allowWhileIdle: true } });
      }
    }
    // Clima (03/11/2026): chuva na ida ou na volta → às 6h do dia, com a previsão guardada mais recente (id 979;
    // clima/dados.js `planoChuva`); se a previsão mudar, o reagendar seguinte reescreve ou tira
    try {
      const CL = await import("./clima/dados.js"), pc = await CL.planoChuva();
      CL.anotarAgendamento(pc);
      if (pc.aviso && pc.quando > new Date()) lista.push({ id: 979, title: pc.aviso.titulo, body: pc.aviso.texto, summaryText: "Clima", extra: { area: "clima" }, schedule: { at: pc.quando, allowWhileIdle: true } });
    } catch (e) { console.warn("clima: chuva no caminho", e); }
    // Eva (eva/programadas.js, 04/11/2026): bom dia, depois das aulas, fechamento, 0 a 2 aleatórias, os combinados e as
    // cobranças, só neste aparelho se ele ligou e depois que a Eva começou (ids 5000–5040, `extra.area` "eva")
    try { lista.push(...await (await import("./eva/programadas.js")).notificacoes()); } catch (e) { console.warn("Eva: mensagens", e); }
    if (lista.length) await LN.schedule({ notifications: lista });
  } catch (e) { console.warn("notificações", e); }
}

export async function abrirAjusteAlarmeExato() {
  if (!LN?.changeExactNotificationSetting) return false;
  try { await LN.changeExactNotificationSetting(); return true; } catch (e) { return false; }
}
export const temNotificacoes = () => !!LN;
/** Notificação na hora (sem agendamento), por exemplo a de tradução nova na Leitura (id 975). */
export async function avisarAgora({ id, title, body, extra }) {
  if (!LN) return;
  try {
    if ((await LN.checkPermissions()).display !== "granted") return;
    await LN.schedule({ notifications: [{ id, title, body, ...(extra ? { extra } : {}) }] });
  } catch (e) { console.warn("notificações: aviso", e); }
}
