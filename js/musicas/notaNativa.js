// Estrelas e coração fora do app (pedido do Alediov, 26/10/2026): na notificação do tocador (e na tela de bloqueio,
// nos controles de mídia do Android e no Android Auto, que leem a mesma sessão) e no widget das Músicas.
// O TocadorService guarda o que mudou lá fora; aqui o app tira essas avaliações, aplica nas faixas (avaliar e
// favoritar, que já põem na fila de gravação dentro do arquivo) e conta ao serviço o que sabe de cada faixa (a nota
// e a favorita), para a notificação e o widget mostrarem sempre o certo: a biblioteca inteira ao começar e depois de
// cada leitura da pasta, e cada mudança feita no app na hora.
import { motor } from "./motor.js";
import { faixa, faixas, avaliar, favoritar, aoMudarBiblioteca } from "./biblioteca.js";

let iniciado = false, aplicando = null, deNovo = false, timerMapa = null;

/** Tira do serviço o que foi avaliado fora do app e aplica nas faixas. Devolve quantas mudanças fez. */
export async function aplicarAvaliacoesDeFora() {
  if (!motor.avaliacoesDeFora) return 0;
  // vários toques seguidos na notificação: o que chegar durante uma aplicação entra na próxima volta
  if (aplicando) { deNovo = true; return aplicando; }
  aplicando = (async () => {
    let itens = [];
    try { itens = await motor.avaliacoesDeFora(); } catch { return 0; }
    if (!itens.length) return 0;
    let n = 0;
    const mudadas = [];
    for (const a of itens.sort((x, y) => (x.em || 0) - (y.em || 0))) {
      const f = await faixa(a.id);
      if (!f) continue; // saiu da pasta (ou mudou de lugar) antes de o app abrir
      if (a.nota != null) {
        const nota = Math.max(0, Math.min(10, Math.round(+a.nota || 0)));
        if (nota !== (f.nota || 0)) { await avaliar(f.id, nota); n++; }
      }
      if (a.fav != null && !!a.fav !== !!f.fav) { await favoritar(f.id, !!a.fav); n++; }
      mudadas.push(f.id);
      // confirma ao serviço o estado final (mesmo sem mudança, quando ele já era o do app), só nos campos que vieram
      const campo = a.nota != null && a.fav != null ? undefined : a.nota != null ? "nota" : "fav";
      try { await motor.avaliacao(f.id, f.nota || 0, !!f.fav, campo); } catch { /* sem tocador */ }
    }
    // a tela Tocando e as listas podem ouvir isto para redesenhar as estrelas
    if (mudadas.length) document.dispatchEvent(new CustomEvent("orbita:notas-de-fora", { detail: { ids: mudadas, mudancas: n } }));
    return n;
  })();
  try { return await aplicando; } finally {
    aplicando = null;
    if (deNovo) { deNovo = false; setTimeout(() => aplicarAvaliacoesDeFora().catch(() => {}), 50); }
  }
}

/** O app mudou a nota ou o coração: o serviço fica sabendo (campo: "nota" ou "fav"). */
async function contar(id, campo) {
  const f = await faixa(id);
  if (!f) return;
  try { await motor.avaliacao(id, f.nota || 0, !!f.fav, campo); } catch (e) { console.warn("Músicas: nota para o tocador", e?.message); }
}

/** A biblioteca inteira (só as faixas com nota ou favoritas: id → nota + 100 se favorita). */
export async function enviarMapa() {
  if (!motor.avaliacoes) return 0;
  const mapa = {};
  for (const f of (await faixas()).values()) {
    const c = (f.nota || 0) + (f.fav ? 100 : 0);
    if (c > 0) mapa[f.id] = c;
  }
  await motor.avaliacoes(mapa);
  return Object.keys(mapa).length;
}
function agendarMapa(ms = 5000) {
  clearTimeout(timerMapa);
  // antes do mapa, aplica o que veio de fora (assim o mapa já sai com as notas dadas na notificação e no widget)
  timerMapa = setTimeout(() => aplicarAvaliacoesDeFora().then(enviarMapa).catch(e => console.warn("Músicas: notas para o tocador", e?.message)), ms);
}

/** Liga tudo uma vez (chamado pelo aplicarHistorico, ao abrir as Músicas). */
export function iniciarNotaNativa() {
  if (iniciado || !motor.avaliacoesDeFora) return;
  iniciado = true;
  aoMudarBiblioteca(o => {
    if (o.nota) contar(o.nota, "nota");
    if (o.fav) contar(o.fav, "fav");
    if (o.biblioteca) agendarMapa(); // leitura da pasta, duplicatas, faixas que mudaram de lugar
  });
  motor.aoNotasFora?.(() => aplicarAvaliacoesDeFora().catch(() => {}));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") aplicarAvaliacoesDeFora().catch(() => {}); });
  agendarMapa(1500);
}
