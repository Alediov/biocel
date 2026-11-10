// Pacotes de configuração enviados pelo Claude pelo repositório (pasta config/):
// editais, importação do Lattes, ajustes da agenda e calendário acadêmico.
// Cada pacote tem id e versão; o app aplica uma vez cada versão nova.
import { E, salvar } from "./estado.js";
import { A, alterou, gerarRecorrentes } from "./agenda.js";
import { aplicarPacoteAvisos, reaplicarSobrePacote } from "./agendaAvisos/agendaAvisos.js";
import { aplicarPacoteDisciplinas } from "./disciplinas.js";
import { aplicarPacoteRecados } from "./eva/recados.js";
import { C, aplicarConferencias, aplicarComplementos } from "./curriculo.js";
import { ganharBau } from "./economia.js";

function aplicados() { return (E().pacotes ??= {}); }

const APLICAR = {
  editais(pkg) {
    const cur = C();
    cur.editais = pkg.editais.map(e => ({ ...e, definido: true }));
  },
  lattes(pkg) {
    const cur = C(), ids = new Set(cur.atividades.map(a => a.id));
    let novas = 0;
    for (const a of pkg.atividades) if (!ids.has(a.id)) { cur.atividades.push(a); novas++; }
    if (pkg.bau && novas) {
      ganharBau(pkg.bau, "boas-vindas do currículo");
      (E().mensagens ??= []).push({ titulo: "Currículo importado", texto: `${novas} atividades do seu Lattes foram importadas. ${pkg.mensagem || ""}` });
    }
  },
  certificados(pkg) {
    const n = aplicarConferencias(pkg.avaliacoes || []);
    aplicarComplementos(pkg.complementos || []);
    if (n) (E().mensagens ??= []).push({ titulo: "Certificados conferidos", texto: `${n} certificado${n === 1 ? "" : "s"} conferido${n === 1 ? "" : "s"}. Veja a pontuação no Currículo.` });
  },
  agenda(pkg) {
    const ag = A();
    for (const { nome, campos } of pkg.atualizarItens || []) {
      for (const it of ag.itens) if (it.nome === nome) Object.assign(it, campos);
    }
    ag.calendario = { semestre: pkg.semestre, semestres: pkg.semestres || (pkg.semestre ? [pkg.semestre] : []), feriados: pkg.feriados || [], marcos: pkg.marcos || [] };
    // exceções de um dia (aula cancelada, outro horário, tema da aula), achando a aula pelo nome, dia da semana e tipo
    for (const ex of pkg.excecoes || []) {
      const it = ag.itens.find(i => i.nome === ex.item.nome && (ex.item.dia == null || i.dia === ex.item.dia) && (!ex.item.tipo || i.tipo === ex.item.tipo));
      if (!it) continue;
      const { item, data, ...campos } = ex, chave = `${it.id}|${data}`;
      ag.excecoes[chave] = { ...(ag.excecoes[chave] || {}), ...campos };
    }
    // compromissos novos que vêm do pacote (id fixo `pkg-…`; ex.: a aula prática de Anestesio que passou de 11/11
    // para 16/11, depois da Oclusão): entram uma vez e são atualizados pelo id, sem mexer no que o app guarda dele
    for (const novo of pkg.novosItens || []) {
      const it = ag.itens.find(i => i.id === novo.id);
      if (it) Object.assign(it, novo, { regra: { ...it.regra, ...novo.regra, datas: [...new Set([...(it.regra?.datas || []), ...(novo.regra?.datas || [])])].sort() } });
      else ag.itens.push({ especial: false, obs: "", ...novo });
    }
    // datas avulsas de um item com regra "datas" (ex.: um dia de Mestrado no lugar do CEO)
    for (const { item, datas } of pkg.adicionarDatas || []) {
      const it = ag.itens.find(i => i.nome === item.nome && i.regra?.tipo === "datas");
      if (!it) continue;
      it.regra.datas = [...new Set([...(it.regra.datas || []), ...datas])].sort();
    }
    // avaliações do calendário: id fixo (pkg-…), não duplica e não apaga a nota já lançada
    if (pkg.avaliacoes?.length) {
      const lista = (E().avaliacoes ??= []);
      for (const av of pkg.avaliacoes) {
        const i = lista.findIndex(a => a.id === av.id);
        if (i >= 0) lista[i] = { ...lista[i], ...av, nota: lista[i].nota, notaMax: lista[i].notaMax };
        else lista.push({ ...av, criadaEm: new Date().toISOString().slice(0, 10) });
      }
    }
    // eventos que se repetem (agenda.js `gerarRecorrentes`): a regra entra ou é atualizada pelo id; o que o app guarda
    // (as datas apagadas e a pausa) fica
    if (pkg.recorrentes?.length) {
      const l = (ag.recorrentes ??= []);
      for (const r of pkg.recorrentes) {
        const i = l.findIndex(x => x.id === r.id);
        if (i < 0) { l.push({ ...r }); continue; }
        const { apagadas, pausada } = l[i];
        l[i] = { ...l[i], ...r, apagadas: [...new Set([...(apagadas || []), ...(r.apagadas || [])])].sort() };
        if (pausada) l[i].pausada = pausada;
      }
      gerarRecorrentes(ag);
    }
    // as mudanças vindas dos destaques do WhatsApp (pacote agenda-avisos) que este pacote regravou voltam por cima
    reaplicarSobrePacote();
    alterou();
  },
  // mudanças da Agenda pelos destaques do WhatsApp (agendaAvisos/, gerador/WHATSAPP.md): cada operação uma vez, com Desfazer
  "agenda-avisos"(pkg) { aplicarPacoteAvisos(pkg); },
  // disciplinas do ano (disciplinas.js): avaliações com peso, regras de aprovação, carga horária e professores
  disciplinas(pkg) { aplicarPacoteDisciplinas(pkg); },
  // recados do Claude e das tarefas para o Alediov (eva/recados.js, tools/recados.py): a Eva manda o checklist
  recados(pkg) { aplicarPacoteRecados(pkg); },
};

export function aplicarPacote(id, versao, pkg) {
  const ap = aplicados();
  if ((ap[id] || 0) >= versao || !APLICAR[id]) return false;
  try { APLICAR[id](pkg); ap[id] = versao; E().vidaSuja = true; salvar(); return true; }
  catch (e) { console.warn("pacote", id, e); return false; }
}

/** Aplica os pacotes que vieram embutidos no APK. */
export async function aplicarPacotesEmbutidos() {
  try {
    const r = await fetch("embutido/config/manifesto.json", { cache: "no-store" });
    if (!r.ok) return;
    const man = await r.json();
    for (const p of man.pacotes) {
      if ((aplicados()[p.id] || 0) >= p.versao) continue;
      const pkg = await (await fetch(`embutido/${p.arquivo}`)).json();
      aplicarPacote(p.id, p.versao, pkg);
    }
  } catch (e) { /* sem pacotes embutidos */ }
}

/** Mensagens do sistema ainda não mostradas (ex.: importação do Lattes). */
export function pegarMensagens() {
  const m = E().mensagens || [];
  E().mensagens = []; salvar();
  return m;
}
