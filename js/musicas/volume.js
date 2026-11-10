// Volume igualado (pedido do Alediov, 24/10/2026): mede o volume percebido de cada música (aproximação do LUFS,
// com blocos de 400 ms e as janelas de silêncio e de -10 LU, como na EBU R128, sem o filtro K) e o pico. O tocador
// usa o ganho (em dB, só para baixo: o ExoPlayer não passa do volume 1) para deixar as músicas altas no nível das
// outras. O arquivo não muda.
import { motor } from "./motor.js";

export const ALVO = -14; // LUFS aproximados

/** { loud, pico, ganho } de uma faixa. Decodifica a 22,05 kHz (menos memória) e mede canal a canal. */
export async function medir(f) {
  const bytes = await motor.lerArquivo(f.id);
  const ctx = new OfflineAudioContext(1, 1, 22050);
  const buf = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const taxa = buf.sampleRate, bloco = Math.round(taxa * 0.4), passo = Math.round(taxa * 0.1);
  const canais = [...Array(buf.numberOfChannels).keys()].map(c => buf.getChannelData(c));
  const n = canais[0].length;
  let pico = 0;
  // energia de cada passo de 100 ms (soma dos canais), para montar os blocos de 400 ms com 75% de sobreposição
  const passos = Math.floor(n / passo), energia = new Float64Array(passos);
  for (const d of canais) for (let k = 0; k < passos; k++) {
    let soma = 0; const ini = k * passo, fim = ini + passo;
    for (let i = ini; i < fim; i++) { const x = d[i]; soma += x * x; const a = x < 0 ? -x : x; if (a > pico) pico = a; }
    energia[k] += soma;
  }
  const blocos = [];
  for (let k = 0; k + 4 <= passos; k++) blocos.push((energia[k] + energia[k + 1] + energia[k + 2] + energia[k + 3]) / bloco);
  const lufs = (z) => -0.691 + 10 * Math.log10(z);
  const acima = blocos.filter(z => z > 0 && lufs(z) > -70);
  if (!acima.length) return { loud: -70, pico, ganho: 0 };
  const media1 = acima.reduce((a, b) => a + b, 0) / acima.length;
  const rel = acima.filter(z => lufs(z) > lufs(media1) - 10);
  const loud = lufs(rel.reduce((a, b) => a + b, 0) / rel.length);
  return { loud: Math.round(loud * 10) / 10, pico: Math.round(pico * 1000) / 1000, ganho: Math.min(0, Math.round((ALVO - loud) * 10) / 10) };
}
