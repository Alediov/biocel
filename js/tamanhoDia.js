// Tamanho do dia (pedido do Alediov, 29/10/2026: "a carga horária está muito mal distribuída entre os subapps, eu não
// estou conseguindo fazer tudo… usar de base o tempo conforme a agenda, pois dias muito corridos fica realmente difícil
// de eu estudar o mesmo que nos dias que tenho mais tempo"). Escolhas dele: a Agenda decide e ele pode trocar ("Agenda +
// ajuste"); provas primeiro (Extensão, Xadrez, Leitura e jogos viram bônus); e o gerador faz menos lições nos dias
// corridos ("Gerar menos": tools/tamanho_do_dia.py lê E().diasPlano no estado sincronizado).
//
// Tempo livre = das 6h30 às 23h, menos o tempo fora de casa nos compromissos presenciais (do 1º menos 40 min ao último
// mais 40 min, porque os intervalos no campus quase não rendem), menos os eventos online, menos 3 h de rotina (comer,
// banho, descanso), mais 50 min de ônibus (ele estuda no ônibus). Menos de 5 h livres: corrido; menos de 10 h: normal;
// senão, livre. O orçamento de estudo é o do tamanho (estado.js TAMANHOS: 60, 105 e 165 min).
import { E, salvar, hojeISO, somaDias, tamanhoDe, TAMANHOS, INICIO_TAMANHO } from "./estado.js";
import { eventosDoDia, eventosOnlineDoDia, feriado } from "./agenda.js";

export { tamanhoDe, TAMANHOS };
const JANELA = ["06:30", "23:00"], ROTINA = 180, ONIBUS = 50, FOLGA = 40;
const NAO_FOI = ["falta", "nao_teve", "nao", "naoteve", "nao-teve"];
const min = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return a * 60 + (b || 0); };
const hora = (m) => { const h = Math.floor(m / 60), mm = m % 60; return mm ? `${h}h${String(mm).padStart(2, "0")}` : `${h}h`; };

/** O tempo livre de um dia pela Agenda: { livre (min), tam, motivo, de, ate }. */
export function livreDo(data) {
  const [j0, j1] = JANELA.map(min);
  let pres = [], online = [];
  try {
    pres = eventosDoDia(data).filter(ev => !NAO_FOI.includes(ev.presenca)).map(ev => [min(ev.inicio), min(ev.fim || ev.inicio)]);
    for (const s of eventosOnlineDoDia(data)) {
      if (NAO_FOI.includes(s.presenca) || !s.inicio) continue;
      const iv = [min(s.inicio), min(s.fim || s.inicio) || min(s.inicio) + 60];
      (s.modalidade === "presencial" ? pres : online).push(iv);
    }
  } catch (e) { console.warn("tamanho do dia: agenda", e); }
  let ocupado = 0, de = null, ate = null, p0 = null, p1 = null;
  const blocos = [];
  if (pres.length) {
    p0 = Math.min(...pres.map(p => p[0])); p1 = Math.max(...pres.map(p => p[1]));
    de = Math.max(j0, p0 - FOLGA); ate = Math.min(j1, p1 + FOLGA);
    blocos.push([de, ate]);
  }
  for (const [a, b] of online) blocos.push([Math.max(j0, a), Math.min(j1, b)]);
  blocos.sort((a, b) => a[0] - b[0]);
  let fim = -1;
  for (const [a, b] of blocos) { if (b <= a) continue; const ini = Math.max(a, fim); if (b > ini) ocupado += b - ini; fim = Math.max(fim, b); }
  const livre = Math.max(0, j1 - j0 - ocupado - ROTINA + (pres.length ? ONIBUS : 0));
  const tam = livre < 300 ? "corrido" : livre < 600 ? "normal" : "livre";
  const fer = (() => { try { return feriado(data); } catch { return null; } })();
  const motivo = fer && !pres.length ? `feriado: ${fer.nome}`
    : pres.length ? `compromissos das ${hora(p0)} às ${hora(p1)}${online.length ? " e evento online" : ""}`
    : online.length ? "evento online" : "sem compromissos";
  return { livre, tam, motivo };
}

const igualPlano = (a, b) => a && b && a.tam === b.tam && a.livre === b.livre && a.min === b.min;
/** Calcula os próximos 14 dias e guarda em E().diasPlano (só o que mudou; o gerador da madrugada lê daí). */
export function planejarDias() {
  const e = E(), hoje = hojeISO();
  const p = (e.diasPlano ||= {}), esc = (e.diasEscolha ||= {});
  let mudou = false;
  for (let i = 0; i < 14; i++) {
    const d = somaDias(hoje, i), l = livreDo(d), novo = { tam: l.tam, livre: l.livre, min: TAMANHOS[l.tam].min };
    if (!igualPlano(p[d], novo)) { p[d] = { ...novo, motivo: l.motivo, em: new Date().toISOString() }; mudou = true; }
  }
  const velho = somaDias(hoje, -7);
  for (const m of [p, esc]) for (const d of Object.keys(m)) if (d < velho) { delete m[d]; mudou = true; }
  if (mudou) salvar();
  return mudou;
}

/** O plano do dia: { tam, auto, escolhido, livre, min, motivo, nome }. */
export function planoDe(data = hojeISO()) {
  const e = E(), p = e.diasPlano?.[data] || null, l = p ? null : livreDo(data);
  const auto = p?.tam || l.tam, escolhido = e.diasEscolha?.[data]?.tam || null, tam = tamanhoDe(data);
  return { data, tam, auto, escolhido, livre: p ? p.livre : l.livre, motivo: p?.motivo || l?.motivo || "", min: TAMANHOS[tam].min, nome: TAMANHOS[tam].nome };
}
/** Ele escolheu o tamanho do dia (null: volta ao automático). */
export function escolher(data, tam) {
  const e = E(), esc = (e.diasEscolha ||= {});
  if (tam && TAMANHOS[tam]) esc[data] = { tam, em: new Date().toISOString() };
  else esc[data] = { tam: null, em: new Date().toISOString() }; // um registro (com data) para a junção entre aparelhos
  salvar();
  window.dispatchEvent(new Event("oq-topo"));
}
export const minutosTexto = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);
export const ativo = (data = hojeISO()) => data >= INICIO_TAMANHO;

/**
 * Divide os itens do Meu dia em essenciais e "se der tempo", pela ordem das provas primeiro, até o orçamento do dia.
 * Cada item pode ter `prio` (0 e 1: provas, sempre essenciais), `custo` (min) ou `partes` [{custo, feito}] (lições,
 * uma a uma: o que não couber vira um item à parte "se der tempo"). Itens sem `prio` ficam onde estão (essenciais, sem
 * custo). Devolve a lista com `bonus: true` nos de "se der tempo", essenciais primeiro.
 */
export function dividir(itens, data = hojeISO()) {
  if (!ativo(data)) return itens;
  const orc = planoDe(data).min, TOL = 5;
  let usado = 0;
  const ess = new Map(), bonus = new Map(); // índice original → item (as duas listas saem na ordem de antes)
  const ordem = itens.map((it, k) => ({ it, k })).sort((a, b) => (a.it.prio ?? -1) - (b.it.prio ?? -1) || a.k - b.k);
  for (const { it, k } of ordem) {
    if (it.prio == null) { ess.set(k, it); continue; }
    if (it.partes) {
      let n = 0;
      for (const p of it.partes) { if (it.prio <= 1 || usado + p.custo <= orc + TOL) { usado += p.custo; n++; } else break; }
      if (n === it.partes.length) ess.set(k, it);
      else if (!n) bonus.set(k, { ...it, bonus: true });
      else {
        const a = it.partes.slice(0, n), b = it.partes.slice(n), fa = a.filter(p => p.feito).length, fb = b.filter(p => p.feito).length;
        ess.set(k, { ...it, detalhe: `${fa} de ${a.length}`, feito: fa >= a.length, conta: [fa, a.length], partes: a });
        bonus.set(k, { ...it, id: `${it.id}-mais`, titulo: it.tituloMais || `Mais ${it.titulo.toLowerCase()}`, detalhe: `${fb} de ${b.length}`, feito: fb >= b.length, conta: [fb, b.length], partes: b, bonus: true });
      }
      continue;
    }
    const c = it.custo || 0;
    if (it.prio <= 1 || usado + c <= orc + TOL) { usado += c; ess.set(k, it); } else bonus.set(k, { ...it, bonus: true });
  }
  const em = (m) => [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  return [...em(ess), ...em(bonus)];
}
