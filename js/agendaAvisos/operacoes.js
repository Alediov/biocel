// Mudanças da Agenda vindas dos destaques do WhatsApp (pedido do Alediov, 04/11/2026: "a tarefa aplica direto e o app
// mostra O que mudou com Desfazer"). A tarefa da madrugada (gerador/WHATSAPP.md) escreve o pacote
// `config/agenda-avisos.json`; o app aplica cada operação UMA vez (agendaAvisos.js) e guarda o `antes` para o Desfazer.
// Aqui as regras PURAS, sobre objetos simples (sem DOM nem estado), para o teste no node (tools/teste_agenda_avisos.mjs):
//   ctx = { ag: { itens, excecoes, eventosOnline }, avs: [avaliações] }
// Tipos de operação (`tipo`), com o alvo e o `depois`:
//   avaliacao       alvo { avaliacao: "<id>" }                 depois { data?, hora?, titulo?, conteudo?, recorte?, local?, obs? }
//   nova-avaliacao  —                                          depois { id: "pkg-…", tipo, disciplina, titulo, data, hora?, conteudo?, recorte? }
//   aula            alvo { item: { nome, dia?, tipo? }, data }  depois { cancelada? | inicio?, fim? | movidaPara? | tema? | tipo? | aviso? }
//   item            alvo { item: { nome, dia?, tipo? } }        depois { inicio?, fim?, obs?, ate? }   (vale para todas as semanas)
//   datas           alvo { item: { nome } } (regra "datas")     depois { adicionar?: [datas], tirar?: [datas] }
//   evento          —                                          depois { id: "aviso-…", nome, modalidade, data, inicio, fim?, aviso?, local?, link? }
//   nota            —                                          (só o recado em "O que mudou"; a Agenda não muda)

export const TIPOS = {
  avaliacao: "Avaliação", "nova-avaliacao": "Avaliação nova", aula: "Aula de um dia", item: "Horário fixo",
  datas: "Datas", evento: "Evento", nota: "Recado",
};
export const CAMPOS = {
  avaliacao: ["data", "hora", "titulo", "conteudo", "recorte", "local", "obs"],
  aula: ["cancelada", "inicio", "fim", "movidaPara", "tema", "tipo", "aviso"],
  item: ["inicio", "fim", "obs", "ate"],
  evento: ["nome", "modalidade", "data", "inicio", "fim", "aviso", "local", "plataforma", "link", "obs"],
};
const clonar = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const DATA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^\d{2}:\d{2}$/;
export const diaSemana = (iso) => new Date(iso + "T12:00:00").getDay();

/** A aula pelo nome (exato, senão sem acento e sem maiúsculas, senão o nome curto), dia da semana e tipo. Só se for UMA. */
export function acharItem(itens = [], q = {}) {
  const filtro = (l) => l.filter(i => (q.dia == null || i.dia === q.dia) && (!q.tipo || i.tipo === q.tipo));
  for (const f of [(i) => i.nome === q.nome, (i) => sem(i.nome) === sem(q.nome), (i) => sem(i.curto) === sem(q.nome)]) {
    const l = filtro(itens.filter(f));
    if (l.length === 1) return l[0];
    if (l.length > 1) return null; // ambíguo: a operação precisa do dia ou do tipo
  }
  return null;
}
const pegar = (o, campos) => Object.fromEntries(campos.filter(k => k in (o || {})).map(k => [k, clonar(o[k])]));

/** Aplica a operação. Devolve { ok: true, antes } ou { ok: false, erro }. */
export function aplicar(ctx, op) {
  const d = op.depois || {}, al = op.alvo || {};
  switch (op.tipo) {
    case "avaliacao": {
      const av = ctx.avs.find(a => a.id === al.avaliacao);
      if (!av) return { ok: false, erro: `avaliação ${al.avaliacao} não encontrada` };
      const campos = CAMPOS.avaliacao.filter(k => k in d);
      const antes = Object.fromEntries(campos.map(k => [k, k in av ? clonar(av[k]) : null]));
      for (const k of campos) if (d[k] == null) delete av[k]; else av[k] = clonar(d[k]);
      return { ok: true, antes };
    }
    case "nova-avaliacao": {
      if (!d.id || !d.data) return { ok: false, erro: "avaliação nova sem id ou data" };
      if (ctx.avs.some(a => a.id === d.id)) return { ok: true, antes: { ja: true } };
      ctx.avs.push({ ...clonar(d), aviso: op.id });
      return { ok: true, antes: null };
    }
    case "aula": {
      if (!DATA.test(al.data || "")) return { ok: false, erro: "aula sem data" };
      // sem o dia da semana no alvo, o da data (Patologia teórica na segunda e prática na terça têm o mesmo nome)
      const it = acharItem(ctx.ag.itens, { dia: diaSemana(al.data), ...al.item }) || acharItem(ctx.ag.itens, al.item);
      if (!it) return { ok: false, erro: `aula "${al.item?.nome}" não encontrada (ou mais de uma)` };
      const chave = `${it.id}|${al.data}`, antes = clonar(ctx.ag.excecoes[chave]);
      ctx.ag.excecoes[chave] = { ...(ctx.ag.excecoes[chave] || {}), ...pegar(d, CAMPOS.aula) };
      return { ok: true, antes: { chave, exc: antes } };
    }
    case "item": {
      const it = acharItem(ctx.ag.itens, al.item);
      if (!it) return { ok: false, erro: `aula "${al.item?.nome}" não encontrada (ou mais de uma)` };
      const campos = CAMPOS.item.filter(k => k in d);
      const antes = { id: it.id, campos: Object.fromEntries(campos.map(k => [k, k in it ? clonar(it[k]) : null])) };
      for (const k of campos) if (d[k] == null) delete it[k]; else it[k] = clonar(d[k]);
      return { ok: true, antes };
    }
    case "datas": {
      const it = ctx.ag.itens.find(i => (i.nome === al.item?.nome || sem(i.nome) === sem(al.item?.nome)) && i.regra?.tipo === "datas");
      if (!it) return { ok: false, erro: `compromisso "${al.item?.nome}" (por datas) não encontrado` };
      const atual = new Set(it.regra.datas || []), adicionadas = [], tiradas = [];
      for (const x of d.adicionar || []) if (DATA.test(x) && !atual.has(x)) { atual.add(x); adicionadas.push(x); }
      for (const x of d.tirar || []) if (atual.has(x)) { atual.delete(x); tiradas.push(x); }
      it.regra.datas = [...atual].sort();
      return { ok: true, antes: { id: it.id, adicionadas, tiradas } };
    }
    case "evento": {
      if (!d.id || !DATA.test(d.data || "")) return { ok: false, erro: "evento sem id ou data" };
      const l = (ctx.ag.eventosOnline ||= []);
      if (l.some(e => e.id === d.id)) return { ok: true, antes: { ja: true } };
      l.push({ id: d.id, ...pegar(d, CAMPOS.evento), modalidade: d.modalidade || "presencial", aviso: d.aviso ?? 30, criadoEm: (op.em || d.data).slice(0, 10), avisoAgenda: op.id });
      return { ok: true, antes: null };
    }
    case "nota": return { ok: true, antes: null };
    default: return { ok: false, erro: `tipo desconhecido: ${op.tipo}` };
  }
}

/** Desfaz com o `antes` guardado. Devolve { ok } ou { ok: false, erro } (ex.: a avaliação nova já tem nota). */
export function desfazer(ctx, op, antes) {
  const d = op.depois || {}, al = op.alvo || {};
  switch (op.tipo) {
    case "avaliacao": {
      const av = ctx.avs.find(a => a.id === al.avaliacao);
      if (!av) return { ok: false, erro: "a avaliação não está mais na Agenda" };
      for (const [k, v] of Object.entries(antes || {})) if (v == null) delete av[k]; else av[k] = clonar(v);
      return { ok: true };
    }
    case "nova-avaliacao": {
      if (antes?.ja) return { ok: true };
      const i = ctx.avs.findIndex(a => a.id === d.id);
      if (i < 0) return { ok: true };
      if (ctx.avs[i].nota != null) return { ok: false, erro: "essa avaliação já tem nota" };
      ctx.avs.splice(i, 1);
      return { ok: true };
    }
    case "aula": {
      if (!antes?.chave) return { ok: false, erro: "sem o estado de antes" };
      if (antes.exc == null) delete ctx.ag.excecoes[antes.chave]; else ctx.ag.excecoes[antes.chave] = clonar(antes.exc);
      return { ok: true };
    }
    case "item": {
      const it = ctx.ag.itens.find(i => i.id === antes?.id);
      if (!it) return { ok: false, erro: "a aula não está mais no horário" };
      for (const [k, v] of Object.entries(antes.campos || {})) if (v == null) delete it[k]; else it[k] = clonar(v);
      return { ok: true };
    }
    case "datas": {
      const it = ctx.ag.itens.find(i => i.id === antes?.id);
      if (!it) return { ok: false, erro: "o compromisso não está mais no horário" };
      const s = new Set(it.regra?.datas || []);
      for (const x of antes.adicionadas || []) s.delete(x);
      for (const x of antes.tiradas || []) s.add(x);
      it.regra.datas = [...s].sort();
      return { ok: true };
    }
    case "evento": {
      if (antes?.ja) return { ok: true };
      const l = ctx.ag.eventosOnline || [], e = l.find(x => x.id === d.id);
      if (!e) return { ok: true };
      if (e.presenca || (e.continuacoes || []).some(c => c.presenca)) return { ok: false, erro: "esse evento já tem presença marcada" };
      ctx.ag.eventosOnline = l.filter(x => x.id !== d.id);
      return { ok: true };
    }
    case "nota": return { ok: true };
    default: return { ok: false, erro: `tipo desconhecido: ${op.tipo}` };
  }
}

/** Depois de o pacote `agenda` ser aplicado de novo (pacotes.js): ele regrava as avaliações `pkg-…` e os campos das aulas
 *  pelo nome; as mudanças ativas destes tipos voltam por cima. Devolve se mudou algo. */
export function reaplicar(ctx, op) {
  const d = op.depois || {}, al = op.alvo || {};
  let alvo = null, campos = [];
  if (op.tipo === "avaliacao") { alvo = ctx.avs.find(a => a.id === al.avaliacao); campos = CAMPOS.avaliacao; }
  else if (op.tipo === "item") { alvo = acharItem(ctx.ag.itens, al.item); campos = CAMPOS.item; }
  if (!alvo) return false;
  let mudou = false;
  for (const k of campos.filter(c => c in d)) {
    if (JSON.stringify(alvo[k] ?? null) === JSON.stringify(d[k] ?? null)) continue;
    if (d[k] == null) delete alvo[k]; else alvo[k] = clonar(d[k]);
    mudou = true;
  }
  return mudou;
}

/** Erros de formato do pacote (o tools/agenda_avisos.py confere também os alvos). */
export function conferir(pkg) {
  const erros = [], ids = new Set();
  if (!Number.isInteger(pkg?.versao) || pkg.versao < 1) erros.push("versao inteira ≥ 1");
  for (const op of pkg?.operacoes || []) {
    if (!op.id || ids.has(op.id)) erros.push(`id vazio ou repetido: ${op.id}`);
    ids.add(op.id);
    if (!TIPOS[op.tipo]) erros.push(`${op.id}: tipo ${op.tipo}`);
    if (!op.resumo) erros.push(`${op.id}: sem resumo`);
    for (const k of ["data", "movidaPara"]) if (op.depois?.[k] && !DATA.test(op.depois[k])) erros.push(`${op.id}: ${k} inválida`);
    for (const k of ["hora", "inicio", "fim"]) if (op.depois?.[k] && !HORA.test(op.depois[k])) erros.push(`${op.id}: ${k} inválido`);
  }
  for (const p of pkg?.perguntas || []) { if (!p.id || ids.has(p.id)) erros.push(`pergunta: id vazio ou repetido: ${p.id}`); ids.add(p.id); if (!p.texto) erros.push(`${p.id}: sem texto`); }
  return erros;
}
