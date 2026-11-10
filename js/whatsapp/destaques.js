// Destaques do WhatsApp (pedido do Alediov, 04/11/2026, 20h53: "um modo de visualização de todas as mensagens destacadas
// e dizer quais enviar para você em alguma tarefa agendada e quais não; daí você atualiza a agenda"). Regras PURAS (sem
// DOM nem estado), para o teste no node (tools/teste_whatsapp.mjs) e para o whatsapp.js.
//
// Destaque = um aviso da triagem (grupo Sempre ou que passou na triagem; regras.js `triar`). Para cada um ele decide:
//   E().whatsapp.decisoes[id] = { d: "enviar" | "nao" | null, nota?, anexos?: [{ n, nome, tipo, tam, sub? }], em,
//                                 env? (quando a linha subiu), cancelar? (desfez depois de subir), cancelEnv? }
// (sincroniza: registros com `em`, a junção fica com o mais novo). Sem registro (ou d null) = "para decidir".
// O que sobe ao repositório PRIVADO, só do que ele marcou "Enviar ao Claude" (ver gerador/WHATSAPP.md):
//   progresso/whatsapp/enviados/AAAA-MM-DD.jsonl (o dia do ENVIO), uma linha JSON por evento:
//     { tipo: "mensagem", id, grupo, de, quando, texto, motivo, nota, anexos: [caminhos], enviadoEm }
//     { tipo: "cancelar", id, enviadoEm }            (decisão desfeita DEPOIS de subir)
//     { tipo: "resposta", pergunta, resposta, enviadoEm }   (resposta a uma pergunta da tarefa, agendaAvisos)
//   progresso/whatsapp/anexos/<id>/<arquivo>
// A tarefa vale a ÚLTIMA linha de cada id (uma nota nova sobe a mensagem de novo, inteira).

export const DIAS_DECISAO = 30;
export const MAX_ANEXOS = 5;
export const MAX_ANEXO_BYTES = 8 * 1024 * 1024; // 8 MB (foto já reduzida a 2200 px; PDF como está)
export const LADO_FOTO = 2200;
export const MAX_NOTA = 280;
export const FILTROS = { decidir: "Para decidir", enviadas: "Enviadas", nao: "Não", todas: "Todas" };
export const PASTA_ENVIADOS = "progresso/whatsapp/enviados";
export const PASTA_ANEXOS = "progresso/whatsapp/anexos";

/** "para decidir" | "enviar" (marcada, esperando subir) | "enviada" | "nao" | "nao-cancelando" (era enviada: o
 *  cancelamento ainda vai subir) */
export function situacao(rec) {
  if (!rec || !rec.d) return rec?.cancelar && !rec.cancelEnv ? "decidir-cancelando" : "decidir";
  if (rec.d === "enviar") return rec.env ? "enviada" : "enviar";
  return rec.cancelar && !rec.cancelEnv ? "nao-cancelando" : "nao";
}
export const paraDecidir = (rec) => !rec || !rec.d;
export const filtroDe = (rec) => (paraDecidir(rec) ? "decidir" : rec.d === "enviar" ? "enviadas" : "nao");

/** Os avisos de um filtro ("decidir", "enviadas", "nao", "todas"), do mais novo para o mais velho. */
export function filtrar(avisos, decisoes = {}, filtro = "decidir") {
  return avisos.filter(a => filtro === "todas" || filtroDe(decisoes[a.id]) === filtro).sort((a, b) => b.quando - a.quando);
}
export function contagens(avisos, decisoes = {}) {
  const c = { decidir: 0, enviadas: 0, nao: 0, todas: avisos.length };
  for (const a of avisos) c[filtroDe(decisoes[a.id])]++;
  return c;
}

const temConteudo = (r) => !!(r && (r.nota || r.anexos?.length || r.env || r.cancelar));
/** Decide (d: "enviar" | "nao") ou desfaz (d: null). Muda `decisoes` no lugar; devolve o registro (ou null). */
export function decidir(decisoes, id, d, em) {
  const r0 = decisoes[id] || null, r = { ...(r0 || {}), em };
  if (d === "enviar") {
    r.d = "enviar";
    // desfez e voltou atrás antes de o cancelamento subir: a linha que já está lá continua valendo
    if (r.cancelar && !r.cancelEnv) delete r.cancelar;
    else if (r.cancelEnv) { delete r.env; delete r.cancelar; delete r.cancelEnv; } // o cancelamento subiu: sobe de novo
  } else {
    r.d = d === "nao" ? "nao" : null;
    if (r.env && !r.cancelEnv) r.cancelar = true; // já subiu: sobe o cancelamento
  }
  if (!r.d && !temConteudo(r)) { delete decisoes[id]; return null; }
  return (decisoes[id] = r);
}
/** Muda a nota ou os anexos; se a mensagem já subiu (e continua "enviar"), sobe de novo inteira. */
export function editar(decisoes, id, campos, em) {
  const r = { ...(decisoes[id] || {}), ...campos, em };
  if (r.nota != null) r.nota = String(r.nota).trim().slice(0, MAX_NOTA);
  if (!r.nota) delete r.nota;
  if (!r.anexos?.length) delete r.anexos;
  if (r.d === "enviar" && r.env) delete r.env;
  if (!r.d && !temConteudo(r)) { delete decisoes[id]; return null; }
  return (decisoes[id] = r);
}

/** O que falta subir: as mensagens marcadas e ainda não enviadas (com o aviso guardado neste aparelho) e os cancelamentos. */
export function pendentes(avisos, decisoes = {}) {
  const porId = new Map(avisos.map(a => [a.id, a]));
  const mensagens = [], cancelar = [];
  for (const [id, r] of Object.entries(decisoes)) {
    if (r?.d === "enviar" && !r.env && porId.has(id)) mensagens.push({ aviso: porId.get(id), rec: r });
    else if (r?.cancelar && !r.cancelEnv) cancelar.push(id);
  }
  return { mensagens, cancelar };
}

/** Nome seguro para o repositório: sem acento, sem espaço, só [A-Za-z0-9._-], até 60 caracteres, com a extensão. */
export function nomeArquivo(nome, n = 1) {
  const s = String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const m = s.match(/\.([A-Za-z0-9]{1,5})$/), ext = m ? m[1].toLowerCase() : "bin";
  const base = (m ? s.slice(0, -m[0].length) : s).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 50) || "anexo";
  return `${String(n).padStart(2, "0")}-${base}.${ext}`;
}
export const caminhoAnexo = (id, an) => `${PASTA_ANEXOS}/${id}/${an.arq || nomeArquivo(an.nome, an.n)}`;

/** A linha de uma mensagem enviada. `quando`: a data com o fuso (whatsapp.js isoLocal). */
export function linhaMensagem(a, rec, quando, enviadoEm) {
  return { tipo: "mensagem", id: a.id, grupo: a.grupo, de: a.de, quando, texto: a.texto, motivo: a.motivo, nota: rec?.nota || "",
    anexos: (rec?.anexos || []).map(an => caminhoAnexo(a.id, an)), enviadoEm };
}
export const linhaCancelar = (id, enviadoEm) => ({ tipo: "cancelar", id, enviadoEm });
export const linhaResposta = (pergunta, resposta, enviadoEm) => ({ tipo: "resposta", pergunta, resposta, enviadoEm });

const chaveLinha = (o) => { const { enviadoEm, ...resto } = o; return JSON.stringify(resto); };
/** Acrescenta as linhas ao texto do arquivo, sem repetir uma igual (fora o `enviadoEm`). */
export function acrescentar(texto, linhas) {
  const velhas = String(texto || "").split("\n").filter(l => l.trim());
  const ja = new Set(velhas.map(l => { try { return chaveLinha(JSON.parse(l)); } catch { return l; } }));
  const novas = [];
  for (const o of linhas) { const k = chaveLinha(o); if (ja.has(k)) continue; ja.add(k); novas.push(JSON.stringify(o)); }
  return { texto: [...velhas, ...novas].join("\n") + "\n", novas: novas.length };
}

/** Tira as decisões velhas (mais de 30 dias) que não esperam nada subir. */
export function podar(decisoes, corteISO) {
  for (const [id, r] of Object.entries(decisoes)) {
    const esperando = (r?.d === "enviar" && !r.env) || (r?.cancelar && !r.cancelEnv);
    if (!esperando && (r?.em || "") < corteISO) delete decisoes[id];
  }
}
