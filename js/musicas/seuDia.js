// "Seu dia" (pedido do Alediov, 25/10/2026): playlist fixa e virtual que muda todo dia (igual o dia inteiro), com
// 40 músicas: as boas que andam esquecidas, favoritas, as que chegaram agora, algumas para descobrir e as do momento.
// Pula as muito puladas e não põe o mesmo artista duas vezes seguidas. Com o clima de cada música (genero.js),
// de manhã puxa as animadas e à noite as calmas.
export const SEU_DIA = "seudia";
const DIA = 864e5;

function sementeDe(txt) { let h = 2166136261; for (const c of txt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const CLIMA_HORA = (h) => (h < 12 ? ["Animada", "Dançante"] : h < 18 ? ["Animada", "Romântica", "Dançante"] : ["Calma", "Melancólica", "Romântica"]);

/** As músicas do "Seu dia" (objetos de faixa), para a data dada (AAAA-MM-DD). */
export function seuDia(todas, data, { total = 40, hora = new Date().getHours() } = {}) {
  const r = rng(sementeDe(`seu-dia|${data}`)), agora = new Date(data + "T12:00").getTime();
  const boas = todas.filter(f => (f.puladas || 0) <= (f.tocadas || 0) + 2);
  const climas = CLIMA_HORA(hora);
  const peso = (f) => r() + ((Array.isArray(f.clima) ? f.clima : [f.clima]).some(c => c && climas.includes(c)) ? 0.35 : 0);
  const pegar = (lista, n, usadas) => lista.filter(f => !usadas.has(f.id)).map(f => [peso(f), f]).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
  const usadas = new Set(), out = [];
  const grupos = [
    [boas.filter(f => (f.nota || 0) >= 8 && (!f.ultimaVez || agora - f.ultimaVez > 14 * DIA)), 0.35],
    [boas.filter(f => f.fav), 0.2],
    [boas.filter(f => f.adicionadaEm && agora - f.adicionadaEm < 30 * DIA), 0.15],
    [boas.filter(f => !f.nota && (f.tocadas || 0) <= 1), 0.15],
    [boas.filter(f => f.ultimaVez && agora - f.ultimaVez < 7 * DIA && (f.nota || 0) >= 7), 0.15],
  ];
  for (const [lista, parte] of grupos) for (const f of pegar(lista, Math.round(total * parte), usadas)) { usadas.add(f.id); out.push(f); }
  // completa com o que tiver nota (ou qualquer uma) se algum grupo veio curto
  for (const f of pegar(boas.filter(f => (f.nota || 0) >= 6), total - out.length, usadas)) { usadas.add(f.id); out.push(f); }
  for (const f of pegar(boas, total - out.length, usadas)) { usadas.add(f.id); out.push(f); }
  // embaralha e afasta o mesmo artista
  const mix = out.map(f => [r(), f]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  for (let i = 1; i < mix.length; i++) {
    if ((mix[i].artista || "") !== (mix[i - 1].artista || "")) continue;
    const j = mix.findIndex((g, k) => k > i && g.artista !== mix[i - 1].artista && (!mix[k + 1] || mix[k + 1].artista !== mix[i].artista));
    if (j > 0) [mix[i], mix[j]] = [mix[j], mix[i]];
  }
  return mix.slice(0, total);
}
