// Editor das Músicas (24/10/2026): muda a velocidade (que leva o tom junto, como o "Sped Up") e põe reverberador,
// com os mesmos controles do Music Speed Changer que o Alediov usava (molhado, amplitude estereofônica, redução de
// alta frequência, tamanho do cômodo, pré-delay e corte de graves), ouve uma prévia e salva uma CÓPIA em MP3 320 kbps,
// com as tags e a capa da original. Tudo com Web Audio no próprio aparelho.

export const SPED_UP = { velocidade: 1.2, reverb: true, molhado: 0.15, largura: 1, amortecimento: 0.5, sala: 0.5, preDelay: 0, corteGraves: 150 };
export const SEM_EFEITO = { velocidade: 1, reverb: false, molhado: 0.15, largura: 1, amortecimento: 0.5, sala: 0.5, preDelay: 0, corteGraves: 150 };
const TAXA = 44100;

/** Decodifica os bytes do arquivo (MP3, FLAC, M4A, OGG, WAV) num AudioBuffer a 44,1 kHz. */
export async function decodificar(bytes) {
  const ctx = new OfflineAudioContext(2, 1, TAXA);
  const copia = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return ctx.decodeAudioData(copia);
}

/** Resposta ao impulso do reverberador: ruído estéreo com queda exponencial, ficando mais escuro com o amortecimento. */
export function respostaImpulso(ctx, p) {
  const dur = 0.35 + p.sala * 3.1;            // 50% → ~1,9 s
  const n = Math.max(1, Math.round(dur * ctx.sampleRate));
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let y = 0, semente = c ? 987654321 : 123456789;
    for (let i = 0; i < n; i++) {
      semente = (semente * 1664525 + 1013904223) >>> 0;
      const x = semente / 4294967296 * 2 - 1;
      const t = i / n;
      const a = Math.max(0.02, 1 - p.amortecimento * 0.97 * Math.sqrt(t)); // filtro que fecha com o tempo
      y += a * (x - y);
      d[i] = y * Math.exp(-6.9 * t);
    }
    // primeiras reflexões (cômodo)
    for (let k = 1; k <= 6; k++) {
      const j = Math.round((0.006 + k * 0.011 * (0.4 + p.sala)) * ctx.sampleRate * (c ? 1.07 : 1));
      if (j < n) d[j] += 0.5 / k;
    }
  }
  return ir;
}

/** Monta o efeito: fonte (com a velocidade) → seco + molhado (corte de graves → pré-delay → convolução → largura). */
function montar(ctx, buffer, p, destino) {
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  fonte.playbackRate.value = p.velocidade;
  const seco = ctx.createGain(); seco.gain.value = 1;
  fonte.connect(seco).connect(destino);
  const no = { fonte, seco };
  if (p.reverb) {
    const corte = ctx.createBiquadFilter(); corte.type = "highpass"; corte.frequency.value = p.corteGraves; corte.Q.value = 0.707;
    const atraso = ctx.createDelay(1); atraso.delayTime.value = p.preDelay / 1000;
    const conv = ctx.createConvolver(); conv.buffer = respostaImpulso(ctx, p);
    const sep = ctx.createChannelSplitter(2), jun = ctx.createChannelMerger(2);
    const w = p.largura, a = (1 + w) / 2, b = (1 - w) / 2;
    const ll = ctx.createGain(), lr = ctx.createGain(), rl = ctx.createGain(), rr = ctx.createGain();
    ll.gain.value = a; rr.gain.value = a; lr.gain.value = b; rl.gain.value = b;
    const molhado = ctx.createGain(); molhado.gain.value = p.molhado * 1.2;
    fonte.connect(corte).connect(atraso).connect(conv).connect(sep);
    sep.connect(ll, 0); sep.connect(lr, 0); sep.connect(rl, 1); sep.connect(rr, 1);
    ll.connect(jun, 0, 0); rl.connect(jun, 0, 0); lr.connect(jun, 0, 1); rr.connect(jun, 0, 1);
    jun.connect(molhado).connect(destino);
    Object.assign(no, { corte, atraso, conv, ll, lr, rl, rr, molhado });
  }
  return no;
}

/** Renderiza a música inteira com o efeito (mais rápido que tempo real). Devolve um AudioBuffer. */
export async function renderizar(buffer, p, aoProgresso = () => {}) {
  const cauda = p.reverb ? 0.35 + p.sala * 3.1 + p.preDelay / 1000 : 0;
  const dur = buffer.duration / p.velocidade + cauda;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * TAXA), TAXA);
  const { fonte } = montar(ctx, buffer, p, ctx.destination);
  fonte.start(0);
  // progresso: o contexto para a cada 5% e continua
  for (let k = 1; k < 20; k++) {
    const t = (dur * k) / 20;
    ctx.suspend(t).then(() => { aoProgresso(k / 20); ctx.resume(); }).catch(() => {});
  }
  const saida = await ctx.startRendering();
  // pico acima de 0 dB: abaixa tudo por igual (sem distorcer); e corta o silêncio do fim
  const L = saida.getChannelData(0), R = saida.getChannelData(1);
  let pico = 0, ultimo = 0;
  for (let i = 0; i < L.length; i++) {
    const m = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (m > pico) pico = m;
    if (m > 0.001) ultimo = i;
  }
  if (pico > 0.98) { const g = 0.98 / pico; for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; } }
  const fim = Math.min(L.length, ultimo + Math.round(0.2 * TAXA));
  return { esquerda: L.subarray(0, fim), direita: R.subarray(0, fim), taxa: TAXA, duracao: fim / TAXA };
}

/** Codifica em MP3 num worker (lamejs). */
export function codificarMp3({ esquerda, direita, taxa }, kbps = 320, aoProgresso = () => {}) {
  return new Promise((ok, erro) => {
    const w = new Worker(new URL("./codificador.js", import.meta.url));
    w.onmessage = (e) => {
      if (e.data.progresso != null) aoProgresso(e.data.progresso);
      else if (e.data.erro) { w.terminate(); erro(new Error(e.data.erro)); }
      else if (e.data.bytes) { w.terminate(); ok(e.data.bytes); }
    };
    w.onerror = (e) => { w.terminate(); erro(new Error(e.message || "falha no codificador")); };
    const l = esquerda.slice(), r = direita.slice();
    w.postMessage({ esquerda: l, direita: r, taxa, kbps }, [l.buffer, r.buffer]);
  });
}

/** Tag ID3v2.3 (título, artista, álbum, artista do álbum, gênero, ano, comentário e capa), com folga para as estrelas. */
export function tagId3(meta, capa = null) {
  const frames = [];
  const u16 = (s) => { const b = new Uint8Array(2 + s.length * 2); b[0] = 0xff; b[1] = 0xfe; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[2 + i * 2] = c & 255; b[3 + i * 2] = c >> 8; } return b; };
  const frame = (id, corpo) => {
    const f = new Uint8Array(10 + corpo.length);
    for (let i = 0; i < 4; i++) f[i] = id.charCodeAt(i);
    const n = corpo.length; f[4] = n >>> 24; f[5] = (n >> 16) & 255; f[6] = (n >> 8) & 255; f[7] = n & 255;
    f.set(corpo, 10); return f;
  };
  const texto = (id, v) => { if (!v) return; const t = u16(String(v)); const c = new Uint8Array(1 + t.length); c[0] = 1; c.set(t, 1); frames.push(frame(id, c)); };
  texto("TIT2", meta.titulo); texto("TPE1", meta.artista); texto("TALB", meta.album); texto("TPE2", meta.albumArtista);
  texto("TCON", meta.genero); texto("TYER", meta.ano);
  if (meta.comentario) {
    // codificação UTF-16, idioma "por", descrição vazia (BOM + terminador) e o texto
    const t = u16(meta.comentario), c = new Uint8Array(8 + t.length);
    c.set([1, 0x70, 0x6f, 0x72, 0xff, 0xfe, 0, 0]); c.set(t, 8);
    frames.push(frame("COMM", c));
  }
  if (capa?.length) {
    const mime = capa[0] === 0x89 ? "image/png" : "image/jpeg";
    const c = new Uint8Array(1 + mime.length + 1 + 1 + 1 + capa.length);
    let j = 0; c[j++] = 0; for (const ch of mime) c[j++] = ch.charCodeAt(0); c[j++] = 0; c[j++] = 3; c[j++] = 0; c.set(capa, j);
    frames.push(frame("APIC", c));
  }
  const folga = 4096, corpo = frames.reduce((s, f) => s + f.length, 0) + folga;
  const tag = new Uint8Array(10 + corpo);
  tag.set([0x49, 0x44, 0x33, 3, 0, 0, (corpo >> 21) & 127, (corpo >> 14) & 127, (corpo >> 7) & 127, corpo & 127]);
  let pos = 10; for (const f of frames) { tag.set(f, pos); pos += f.length; }
  return tag;
}

/** Prévia ao vivo: toca o trecho com o efeito e acompanha as mudanças dos controles. */
export class Previa {
  constructor() { this.ctx = null; this.no = null; }
  tocar(buffer, p, inicioSeg = 0) {
    this.parar();
    this.ctx = new AudioContext({ sampleRate: TAXA });
    this.p = { ...p };
    this.no = montar(this.ctx, buffer, p, this.ctx.destination);
    this.no.fonte.start(0, Math.max(0, Math.min(buffer.duration - 1, inicioSeg)));
    this.no.fonte.onended = () => this.aoAcabar?.();
  }
  /** Mudanças que dá para fazer sem recomeçar; a estrutura (ligar o reverberador) pede recomeçar. */
  ajustar(p) {
    if (!this.no || !this.ctx) return false;
    const t = this.ctx.currentTime;
    this.no.fonte.playbackRate.setTargetAtTime(p.velocidade, t, 0.05);
    if (!!p.reverb !== !!this.p.reverb) return true;
    if (p.reverb) {
      this.no.molhado.gain.setTargetAtTime(p.molhado * 1.2, t, 0.05);
      this.no.corte.frequency.setTargetAtTime(p.corteGraves, t, 0.05);
      this.no.atraso.delayTime.setTargetAtTime(p.preDelay / 1000, t, 0.05);
      const a = (1 + p.largura) / 2, b = (1 - p.largura) / 2;
      this.no.ll.gain.value = a; this.no.rr.gain.value = a; this.no.lr.gain.value = b; this.no.rl.gain.value = b;
      if (p.sala !== this.p.sala || p.amortecimento !== this.p.amortecimento) this.no.conv.buffer = respostaImpulso(this.ctx, p);
    }
    this.p = { ...p };
    return false;
  }
  parar() {
    try { this.no?.fonte.stop(); } catch {}
    this.ctx?.close().catch(() => {});
    this.ctx = null; this.no = null;
  }
  get tocando() { return !!this.ctx; }
}
