// Worker do editor das Músicas: codifica o áudio renderizado em MP3 (lamejs), sem travar a tela.
// Recebe { esquerda: Float32Array, direita: Float32Array, taxa, kbps } e devolve { progresso } e, no fim, { bytes }.
importScripts("../../vendor/lame.min.js");

onmessage = (e) => {
  try {
    const { esquerda, direita, taxa, kbps } = e.data;
    const enc = new lamejs.Mp3Encoder(2, taxa, kbps || 320);
    const N = esquerda.length, BLOCO = 1152 * 8;
    const l16 = new Int16Array(BLOCO), r16 = new Int16Array(BLOCO);
    const partes = [];
    let total = 0, ultimo = 0;
    const guardar = (b) => { if (b.length) { const u = new Uint8Array(b.length); u.set(new Uint8Array(b.buffer, b.byteOffset, b.length)); partes.push(u); total += u.length; } };
    for (let i = 0; i < N; i += BLOCO) {
      const n = Math.min(BLOCO, N - i);
      for (let k = 0; k < n; k++) {
        const a = Math.max(-1, Math.min(1, esquerda[i + k])), b = Math.max(-1, Math.min(1, direita[i + k]));
        l16[k] = a < 0 ? a * 32768 : a * 32767;
        r16[k] = b < 0 ? b * 32768 : b * 32767;
      }
      guardar(enc.encodeBuffer(l16.subarray(0, n), r16.subarray(0, n)));
      const p = i / N;
      if (p - ultimo > 0.02) { ultimo = p; postMessage({ progresso: p }); }
    }
    guardar(enc.flush());
    const bytes = new Uint8Array(total);
    let pos = 0;
    for (const u of partes) { bytes.set(u, pos); pos += u.length; }
    postMessage({ bytes }, [bytes.buffer]);
  } catch (err) {
    postMessage({ erro: String(err && err.message || err) });
  }
};
