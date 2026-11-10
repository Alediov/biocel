// O resumo do dia que a Eva lê (para a conversa pela API e para as mensagens programadas). Pedido do Alediov
// (04/11/2026, docs/plano-eva.md): ela vê Estudos, Agenda, provas, Leitura, Xadrez, Meu dia, a CONTAGEM de avisos do
// WhatsApp e o "Para conferir" das Finanças. NUNCA: OdontoScan (Iniciação Científica), Cofre, valores das Finanças nem o
// texto do WhatsApp. `itemSeguro` e `montarContexto` são puros (node tools/teste_eva.mjs confere a privacidade);
// `coletar` lê o app (imports dinâmicos, para o arquivo carregar no node).
import { sobre, nomeDoBanco } from "./falas.js";

/** Tira valores em dinheiro de um texto (R$, US$, sats, BTC, "1.226,46"…). */
export function semValores(s) {
  return String(s ?? "")
    .replace(/(R\$|US\$|U\$|\$)\s*[-+]?\s*[\d.,]+(\s*(mil|mi|bi|k))?/gi, "[valor]")
    .replace(/[-+]?\d[\d.,]*\s*(sats?|satoshis?|btc|reais|d[oó]lares?|usd|brl)\b/gi, "[valor]")
    .replace(/\b\d{1,3}(\.\d{3})+(,\d{2})?\b|\b\d+,\d{2}\b/g, "[valor]");
}
const AREAS_FORA = new Set(["scan", "cofre"]);

/** O item do Meu dia como a Eva pode ver (ou null, se não pode): sem Scanner, sem Cofre, sem valores, sem o texto do
 *  WhatsApp (só a contagem, à parte). */
export function itemSeguro(it) {
  if (!it || typeof it !== "object") return null;
  const id = String(it.id || "");
  if (/^scan/.test(id) || AREAS_FORA.has(it.ir?.area) || /odontoscan|inicia[cç][aã]o cient|fichas?\b|cofre/i.test(`${it.titulo || ""} ${it.detalhe || ""}`)) return null;
  if (id === "whatsapp") return null; // vai só a contagem (dados.whats)
  if (id === "recados") return null; // os recados do Claude (recados.js) não vão para a API nem viram cobrança
  const base = { id, feito: it.feito, bonus: !!it.bonus, ir: it.ir, acao: it.acao };
  if (id === "financas") return { ...base, titulo: it.feito ? "Finanças conferidas hoje" : "Finanças: há coisas para conferir", detalhe: "" };
  if (id.startsWith("dinheiro-parado-")) return { ...base, titulo: `Dinheiro parado ${nomeDoBanco(id.slice(16))}`, detalhe: "" };
  if (id === "agenda-perguntas") return { ...base, titulo: "Uma pergunta do Claude sobre a Agenda (em Mensagens → Destaques)", detalhe: "" }; // o texto vem das mensagens dos grupos
  if (id === "passagens") return { ...base, titulo: "Recarregar o cartão de passagens", detalhe: "" };
  return { ...base, titulo: semValores(it.titulo || ""), detalhe: semValores(it.detalhe || "") };
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const hm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * O texto do contexto. d: { agora (ms), hoje, nome, humor: { nome }, tamanho: { nome, min }, itens (já seguros),
 * agenda: { hoje: [{ inicio, fim, nome, tipo }], amanha }, provas: [{ data, nome, titulo, dias }], ofensiva: { atual,
 * recorde, hoje }, whats (número), combinados: [{ titulo, hora }], motivos: [{ titulo, motivo }] }.
 */
export function montarContexto(d = {}) {
  const l = [], agora = d.agora || Date.now(), dt = new Date(agora);
  l.push(`Agora: ${DIAS[dt.getDay()]}, ${br(d.hoje || dt.toISOString().slice(0, 10))}, ${hm(agora)}.`);
  if (d.humor?.nome) l.push(`Seu humor (Eva) pelos últimos dias: ${d.humor.nome}.`);
  if (d.tamanho?.nome) l.push(`Tamanho do dia pela Agenda: ${d.tamanho.nome}${d.tamanho.min ? ` (~${d.tamanho.min} min de estudo)` : ""}.`);
  const itens = (d.itens || []).map(itemSeguro).filter(Boolean);
  const contaveis = itens.filter(i => i.feito !== null && !i.bonus);
  if (itens.length) {
    l.push(`Meu dia (${contaveis.filter(i => i.feito).length} de ${contaveis.length} feitos):`);
    for (const i of itens) l.push(`- [${i.feito === null ? "info" : i.feito ? "feito" : i.bonus ? "se der tempo" : "falta"}] (${i.id}) ${i.titulo}${i.detalhe ? ` — ${i.detalhe}` : ""}`);
  } else l.push("Meu dia: nada registrado ainda.");
  const ag = (lista) => lista.map(e => `${e.inicio || "?"}${e.fim ? `–${e.fim}` : ""} ${semValores(e.nome)}${e.tipo ? ` (${e.tipo})` : ""}`).join("; ");
  if (d.agenda?.hoje?.length) l.push(`Agenda de hoje: ${ag(d.agenda.hoje)}.`);
  else l.push("Agenda de hoje: sem compromissos.");
  if (d.agenda?.amanha?.length) l.push(`Agenda de amanhã: ${ag(d.agenda.amanha)}.`);
  if (d.provas?.length) l.push(`Provas e avaliações nos próximos 14 dias: ${d.provas.map(p => `${semValores(p.nome)}${p.titulo ? ` (${semValores(p.titulo)})` : ""} ${p.dias === 0 ? "hoje" : p.dias === 1 ? "amanhã" : `em ${p.dias} dias`} (${br(p.data)})`).join("; ")}.`);
  if (d.ofensiva) l.push(`Ofensiva de estudos: ${d.ofensiva.atual || 0} dias (recorde ${d.ofensiva.recorde || 0})${d.ofensiva.hoje ? ", já estudou hoje" : ", ainda não estudou hoje"}.`);
  if (d.whats) l.push(`WhatsApp: ${d.whats} destaque${d.whats > 1 ? "s" : ""} dos grupos para decidir se vão ao Claude (você não sabe o conteúdo).`);
  if (d.combinados?.length) l.push(`Combinados com você: ${d.combinados.map(c => `${semValores(c.titulo)} às ${c.hora}`).join("; ")}.`);
  if (d.motivos?.length) l.push(`Hoje não dá (com motivo): ${d.motivos.map(m => `${semValores(m.titulo)}: ${semValores(m.motivo)}`).join("; ")}.`);
  return l.join("\n");
}

/** Os itens pendentes que a Eva cobra (seguros, sem os informativos e o "se der tempo"), na ordem do Meu dia. */
export const pendentes = (itens) => (itens || []).map(itemSeguro).filter(i => i && i.feito === false && !i.bonus);
/** O jeito de falar de cada item (nome e versão menor), para as falas prontas. */
export const falaDoItem = (it) => sobre(it);

// ---------------------------------------------------------------- leitura do app
/** Lê o app e devolve { dados (para montarContexto), itens (crus do Meu dia + certificados atrasados) }. */
export async function coletar(agora = Date.now()) {
  const [ES, M, AG] = await Promise.all([import("../estado.js"), import("../meuDia.js"), import("../agenda.js")]);
  const e = ES.E(), hoje = ES.hojeISO(new Date(agora)), amanha = ES.somaDias(hoje, 1);
  let itens = [];
  try { itens = await M.itensDoDia(); } catch (err) { console.warn("Eva: Meu dia", err); }
  // certificados atrasados (agenda.js): também são cobrança dela
  try {
    for (const ev of AG.certificadosAtrasados()) itens.push({ id: `certificado-${ev.id}`, icone: "🎓", titulo: `Certificado atrasado: ${ev.nome}`, detalhe: "vale escrever ao suporte do evento", feito: false, ir: { area: "learn", tela: "agenda" } });
  } catch (err) { console.warn("Eva: certificados", err); }
  const daAgenda = (dia) => {
    const out = [];
    try {
      for (const ev of AG.eventosDoDia(dia)) out.push({ inicio: ev.inicio, fim: ev.fim, nome: ev.item.curto || ev.item.nome || "", tipo: ev.item.tipo === "P" ? "prática" : "aula", presencial: true, presenca: ev.presenca || null });
      for (const s of AG.eventosOnlineDoDia(dia)) out.push({ inicio: s.inicio || "", fim: s.fim || "", nome: s.nome, tipo: s.modalidade === "online" ? "evento online" : "evento", presencial: s.modalidade === "presencial", presenca: s.presenca || null });
    } catch (err) { console.warn("Eva: agenda", err); }
    return out.sort((a, b) => (a.inicio || "").localeCompare(b.inicio || ""));
  };
  const dif = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);
  const provas = (e.avaliacoes || []).filter(a => a.data && a.data >= hoje && a.data <= ES.somaDias(hoje, 14))
    .sort((a, b) => a.data.localeCompare(b.data)).map(a => ({ data: a.data, hora: a.hora || "", tipo: a.tipo || "", nome: a.disciplina || a.titulo || "", titulo: a.disciplina ? a.titulo || "" : "", dias: dif(hoje, a.data) }));
  let whats = 0;
  try { whats = (await import("../whatsapp/whatsapp.js")).paraDecidir().length; } catch { /* sem WhatsApp */ }
  let tamanho = null;
  try { const T = await import("../tamanhoDia.js"); if (T.ativo(hoje)) { const p = T.planoDe(hoje); tamanho = { nome: p.nome, min: p.min }; } } catch { /* sem tamanho */ }
  const nome = (e.avatar?.nome || "").trim().split(/\s+/)[0] || "Alediov";
  const dados = { agora, hoje, nome, itens, tamanho, provas, whats, agenda: { hoje: daAgenda(hoje), amanha: daAgenda(amanha) },
    ofensiva: { atual: e.ofensiva?.atual || 0, recorde: e.ofensiva?.recorde || 0, hoje: e.ofensiva?.ultimoDia === hoje } };
  return { dados, itens };
}
