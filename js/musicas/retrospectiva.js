// Retrospectiva do mês das Músicas (pedido do Alediov, 24/10/2026): tempo ouvido, música, artista e tag do mês,
// descoberta, dia e horário favoritos, sequência de dias e a comparação com o mês anterior. Usa as reproduções
// (loja "reproducoes": cada tocada e pulada). Também aparece na tela da Temporada do Estudos ("Trilha sonora").
import * as BD from "./banco.js";
import { versoesDoTitulo } from "./tagsInternas.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (mes) => { const [a, m] = mes.split("-").map(Number); return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} de ${a}`; };
const chaveMes = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const mesAtual = () => chaveMes(Date.now());

/** Meses com reproduções, do mais recente ao mais antigo. */
export async function mesesComDados() {
  const s = new Set((await BD.todasReproducoes()).filter(r => r.tipo === "tocada").map(r => chaveMes(r.em)));
  return [...s].sort().reverse();
}

const contar = (l, chave) => { const c = new Map(); for (const x of l) { const k = chave(x); if (k) c.set(k, (c.get(k) || 0) + 1); } return [...c].sort((a, b) => b[1] - a[1]); };

/** Tudo o que a retrospectiva mostra para o mês "AAAA-MM" (null se não ouviu nada). */
export async function resumoDoMes(mes) {
  const reps = await BD.todasReproducoes(), faixas = new Map((await BD.todasFaixas()).map(f => [f.id, f]));
  const [a, m] = mes.split("-").map(Number), ini = +new Date(a, m - 1, 1), fim = +new Date(a, m, 1);
  const doMes = reps.filter(r => r.em >= ini && r.em < fim);
  const toc = doMes.filter(r => r.tipo === "tocada"), pul = doMes.filter(r => r.tipo === "pulada");
  if (!toc.length) return null;
  const dur = (r) => r.dur || faixas.get(r.id)?.duracao || 0;
  const tempo = toc.reduce((s, r) => s + dur(r), 0);
  const ant = reps.filter(r => r.tipo === "tocada" && r.em >= +new Date(a, m - 2, 1) && r.em < ini);
  const tempoAnt = ant.reduce((s, r) => s + dur(r), 0);
  const musicas = contar(toc, r => (faixas.has(r.id) ? r.id : null)).map(([id, n]) => ({ faixa: faixas.get(id), n }));
  const artistas = contar(toc, r => faixas.get(r.id)?.artista || r.artista).map(([nome, n]) => ({ nome, n }));
  const tags = contar(toc.flatMap(r => (faixas.get(r.id)?.tags || []).map(t => ({ t }))), x => x.t).map(([nome, n]) => ({ nome, n }));
  const comVersao = toc.filter(r => versoesDoTitulo(faixas.get(r.id)?.titulo).includes("Sped Up")).length;
  const descobertas = musicas.filter(x => (x.faixa.adicionadaEm || 0) >= ini && (x.faixa.adicionadaEm || 0) < fim);
  // por dia, por hora e por dia da semana
  const porDia = new Map(); for (const r of toc) { const d = new Date(r.em).getDate(); porDia.set(d, (porDia.get(d) || 0) + dur(r)); }
  const [diaTop, msDiaTop] = [...porDia].sort((x, y) => y[1] - x[1])[0];
  const horas = Array(24).fill(0); for (const r of toc) horas[new Date(r.em).getHours()]++;
  const horaTop = horas.indexOf(Math.max(...horas));
  const semana = Array(7).fill(0); for (const r of toc) semana[new Date(r.em).getDay()]++;
  const dias = [...porDia.keys()].sort((x, y) => x - y);
  let seq = 0, atual = 0, ultimo = -9;
  for (const d of dias) { atual = d === ultimo + 1 ? atual + 1 : 1; ultimo = d; seq = Math.max(seq, atual); }
  return {
    mes, nome: nomeMes(mes), tempo, tempoAnt, reproducoes: toc.length, puladas: pul.length, distintas: musicas.length,
    musicas: musicas.slice(0, 5), artistas: artistas.slice(0, 3), tags: tags.slice(0, 3), spedUp: Math.round(100 * comVersao / toc.length),
    descoberta: descobertas[0] || null, diaTop: { dia: diaTop, ms: msDiaTop }, horaTop, semanaTop: semana.indexOf(Math.max(...semana)),
    diasOuvindo: porDia.size, sequencia: seq,
  };
}

export function horasTexto(ms) { const mm = Math.round(ms / 60000); return mm < 60 ? `${mm} min` : `${Math.floor(mm / 60)} h${mm % 60 ? ` ${mm % 60} min` : ""}`; }

/** "Neste dia" (pedido do Alediov, 25/10/2026): o que ele ouviu na mesma data em anos anteriores e, enquanto não
 * houver um ano de histórico, há 1 mês. Lista do mais recente ao mais antigo: [{ titulo, data, tempo, musicas }]. */
export async function nesteDia(hoje = new Date()) {
  const reps = (await BD.todasReproducoes()).filter(r => r.tipo === "tocada");
  if (!reps.length) return [];
  const faixas = new Map((await BD.todasFaixas()).map(f => [f.id, f]));
  const dur = (r) => r.dur || faixas.get(r.id)?.duracao || 0;
  const dia = (d) => { const ini = +new Date(d.getFullYear(), d.getMonth(), d.getDate()); return reps.filter(r => r.em >= ini && r.em < ini + 864e5); };
  const montar = (titulo, d, lista) => {
    const musicas = contar(lista, r => (faixas.has(r.id) ? r.id : null)).map(([id, n]) => ({ faixa: faixas.get(id), n }));
    if (!musicas.length) return null;
    return { titulo, data: d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }), tempo: lista.reduce((s, r) => s + dur(r), 0), musicas: musicas.slice(0, 8) };
  };
  const out = [];
  const maisAntiga = Math.min(...reps.map(r => r.em));
  for (let a = 1; a <= 15; a++) {
    const d = new Date(hoje.getFullYear() - a, hoje.getMonth(), hoje.getDate());
    if (+d + 864e5 < maisAntiga) break;
    const x = montar(a === 1 ? "Há 1 ano" : `Há ${a} anos`, d, dia(d)); if (x) out.push(x);
  }
  if (!out.length) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate());
    if (d.getDate() === hoje.getDate()) { const x = montar("Há 1 mês", d, dia(d)); if (x) out.push(x); }
  }
  return out;
}
