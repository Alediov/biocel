// Motor das Músicas: no Android, o plugin nativo "Musicas" (tocador Media3 que segue com a tela apagada, tags e
// capas pelo sistema); fora dele (notebook, testes), um motor web com <audio> e o leitor de tags em JS.
// As duas versões têm a mesma interface.
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import { lerTagsArquivo } from "./tags.js";

export const nativo = !!Capacitor.isNativePlatform?.();
export const motor = nativo ? motorNativo() : motorWeb();

function motorNativo() {
  const M = registerPlugin("Musicas");
  const ouvintes = new Set();
  M.addListener("estado", (e) => ouvintes.forEach(fn => fn(e)));
  // nota e fav vão junto para a notificação e o widget mostrarem as estrelas e o coração (TocadorService.itemDe)
  const faixa = (f) => ({ id: f.id, titulo: f.titulo || "", artista: f.artista || "", album: f.album || "", ...(f.ganho != null ? { ganho: f.ganho } : {}), ...(f.nota ? { nota: f.nota } : {}), ...(f.fav ? { fav: true } : {}) });
  return {
    nativo: true,
    escolherPasta: () => M.escolherPasta(),
    listar: async (uri) => (await M.listar({ uri })).arquivos,
    lerTags: async (ids) => (await M.lerTags({ ids })).tags,
    // lado 0 = a capa original (os bytes do arquivo, sem reduzir nem recomprimir)
    capa: async (id, lado = 320) => { const r = await M.capa({ id, lado }); return r.dados ? `data:${r.mime || "image/jpeg"};base64,${r.dados}` : ""; },
    tocar: (faixas, indice = 0, o = {}) => M.tocar({ faixas: faixas.map(faixa), indice, posicao: o.posicao || 0, aleatorio: o.aleatorio, repetir: o.repetir }),
    enfileirar: (faixas, fim = false) => M.enfileirar({ faixas: faixas.map(faixa), fim }),
    comando: (acao, extra = {}) => M.comando({ acao, ...extra }),
    estado: () => M.estado(),
    fila: async () => (await M.fila()).ids,
    historico: async () => (await M.historico()).itens || [],
    // estrelas e coração dados na notificação ou no widget (notaNativa.js): o app tira, aplica e conta ao serviço
    avaliacoesDeFora: async () => (await M.avaliacoesDeFora()).itens || [],
    avaliacao: (id, nota, fav, campo) => M.avaliacao({ id, nota: nota || 0, fav: !!fav, ...(campo ? { campo } : {}) }),
    avaliacoes: (mapa) => M.avaliacoes({ mapa }),
    aoNotasFora: (fn) => { const h = M.addListener("notasFora", fn); return () => Promise.resolve(h).then(x => x?.remove?.()); },
    ouvir: (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    estudosTocar: (ids, volume) => M.estudosTocar({ ids, volume }),
    estudosParar: () => M.estudosParar(),
    estudosVolume: (volume) => M.estudosVolume({ volume }),
    // tocador: transição (ms), volume igualado e rádio; timer; trocar a música atual no mesmo ponto
    ajustesTocador: (o) => M.ajustesTocador(o),
    radioPool: (faixas) => M.radioPool({ faixas: faixas.map(faixa) }),
    // Android Auto: o resumo da biblioteca que o carro navega (texto JSON, gravado num arquivo do app)
    bibliotecaAuto: (dados) => M.bibliotecaAuto({ dados }),
    timer: (ms, fimDaMusica = false) => M.timer({ ms, fimDaMusica }),
    trocar: (f, ms) => M.comando({ acao: "trocar", faixa: faixa(f), ms: Math.max(0, Math.round(ms)) }),
    apagarArquivo: (id) => M.apagarArquivo({ id }),
    // .orbita/biblioteca.json na pasta das músicas (playlists e tags sobrevivem a apagar os dados do app)
    lerTexto: async (uri, pasta, nome) => (await M.lerTexto({ uri, pasta, nome })).texto ?? null,
    gravarTexto: (uri, pasta, nome, texto) => M.gravarTexto({ uri, pasta, nome, texto }),
    // estrelas e favorita dentro do arquivo
    lerNotas: async (itens) => (await M.lerNotas({ itens })).notas,
    // tags: "ORBITA_TAGS=…" ("" apaga); undefined não mexe nas tags internas do arquivo
    gravarNotas: (id, caminho, nota, fav, tags) => M.gravarNotas({ id, caminho, nota, fav, ...(tags !== undefined ? { tags } : {}) }),
    // editor de tags e pasta de entrada
    gravarTags: (id, caminho, campos, capa = undefined, mime = "image/jpeg") => M.gravarTags({ id, caminho, campos, ...(capa !== undefined ? { capa, mime } : {}) }),
    // de: a árvore de onde o arquivo vem (a pasta de entrada escolhida), se não for a das músicas
    moverArquivo: (uri, id, pasta, nome, de) => M.moverArquivo({ uri, id, pasta, nome, ...(de ? { de } : {}) }),
    criarPasta: (uri, nome) => M.criarPasta({ uri, nome }),
    // arquivos (editor)
    async lerArquivo(id, aoProgresso = () => {}) {
      const { tamanho } = await M.tamanhoArquivo({ id });
      const total = tamanho || 0, saida = new Uint8Array(total), PASSO = 2 << 20;
      let pos = 0;
      while (pos < total) {
        const r = await M.lerTrecho({ id, inicio: pos, tamanho: Math.min(PASSO, total - pos) });
        const b = deBase64(r.dados);
        if (!b.length) break;
        saida.set(b, pos); pos += b.length;
        aoProgresso(pos / total);
      }
      return saida.subarray(0, pos);
    },
    /** Os primeiros `n` bytes do arquivo (para ler a tag sem carregar a música inteira). */
    async lerInicio(id, n) { const r = await M.lerTrecho({ id, inicio: 0, tamanho: n }); return deBase64(r.dados); },
    async criarArquivo(uri, pasta, nome, mime, bytes, aoProgresso = () => {}) {
      const { id } = await M.criarArquivo({ uri, pasta, nome, mime });
      try {
        const PASSO = 1 << 20;
        for (let i = 0; i < bytes.length || i === 0; i += PASSO) {
          await M.escreverTrecho({ id, dados: paraBase64(bytes.subarray(i, i + PASSO)), anexar: i > 0 });
          aoProgresso(Math.min(1, (i + PASSO) / bytes.length));
          if (!bytes.length) break;
        }
      } catch (e) { await M.apagarArquivo({ id }).catch(() => {}); throw e; }
      return id;
    },
  };
}
function deBase64(b64) { const s = atob(b64 || ""), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function paraBase64(u) { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }

function motorWeb() {
  const arquivos = new Map(); // id → File (só nesta sessão: depois de recarregar, escolhe a pasta de novo)
  const capas = new Map();
  const ouvintes = new Set();
  const hist = [];
  // estrelas e coração "de fora" no navegador: só para testar o fluxo (_avaliarFora faz o papel da notificação)
  const fora = new Map(), notasApp = new Map(), ouvintesFora = new Set();
  const audio = new Audio(), estudo = new Audio();
  audio.preload = "auto"; estudo.loop = false;
  let fila = [], ordem = [], pos = 0, aleatorio = false, repetir = "nao", url = null, urlE = null;
  let filaE = [], iE = 0, volE = 0.5, rampa = null;
  const durs = new Map();
  // mesmas funções do serviço nativo: volume igualado, transição, timer e rádio
  let aj = { transicao: 0, igualar: true, radio: false }, pool = [], timerFim = 0, pararNoFim = false, tiq = null;
  const ganhoAtual = () => { const f = fila[ordem[pos]]; return aj.igualar && f?.ganho ? Math.min(1, Math.pow(10, f.ganho / 20)) : 1; };
  const tique = () => {
    clearTimeout(tiq);
    const agora = Date.now();
    if (timerFim && agora >= timerFim) { timerFim = 0; audio.pause(); audio.volume = ganhoAtual(); return; }
    let v = ganhoAtual();
    if (!audio.paused) {
      const p = audio.currentTime * 1000, d = (audio.duration || 0) * 1000;
      if (aj.transicao > 0 && d > 0) {
        const sai = Math.min(aj.transicao, d / 4), entra = Math.min(aj.transicao / 2, d / 8);
        if ((pos + 1 < ordem.length || repetir !== "nao") && d - p < sai) v *= Math.max(0.04, (d - p) / sai);
        if (p < entra) v *= Math.max(0.1, p / entra);
      }
      if (timerFim && timerFim - agora < 8000) v *= Math.max(0, (timerFim - agora) / 8000);
    }
    audio.volume = Math.max(0, Math.min(1, v));
    if (!audio.paused || timerFim) tiq = setTimeout(tique, 100);
  };
  audio.addEventListener("play", tique);
  const completarRadio = () => {
    if (!aj.radio || repetir !== "nao" || ordem.length - pos > 2 || !pool.length) return false;
    const na = new Set(fila.map(f => f.id)), novos = [];
    for (let k = 0; k < pool.length && novos.length < 5; k++) { const m = pool.shift(); pool.push(m); if (!na.has(m.id)) { novos.push(m); na.add(m.id); } }
    if (!novos.length) return false;
    const ini = fila.length; fila.push(...novos); ordem.push(...novos.map((_, k) => ini + k));
    return true;
  };
  const atual = () => fila[ordem[pos]];
  const estadoAgora = () => {
    const f = atual();
    return { ativo: !!f, id: f?.id || null, indice: ordem[pos] ?? 0, total: fila.length, tocando: !audio.paused && !!f, querTocar: !audio.paused, posicao: Math.round(audio.currentTime * 1000) || 0, duracao: Math.round((audio.duration || 0) * 1000), aleatorio, repetir, timerFim, pararNoFim };
  };
  const avisar = () => { const e = estadoAgora(); ouvintes.forEach(fn => fn(e)); midiaSessao(); };
  ["play", "pause", "loadedmetadata", "seeked"].forEach(ev => audio.addEventListener(ev, avisar));
  audio.addEventListener("loadedmetadata", () => { const f = atual(); if (f && audio.duration) durs.set(f.id, audio.duration * 1000); });
  // volume e saída (04/11/2026): no navegador só dá para saber o volume do <audio>; a saída é "navegador"
  const registrar = (id, tipo) => hist.push({ id, tipo, em: Date.now(), vol: Math.round(100 * (audio.volume ?? 1)) / 100, saida: "navegador" });
  const contarSaida = (pulou) => {
    const f = atual(); if (!f) return;
    const p = audio.currentTime * 1000, d = durs.get(f.id) || 0;
    if (p >= 240000 || (d && p >= d / 2)) registrar(f.id, "tocada");
    else if (pulou) registrar(f.id, "pulada");
  };
  const embaralhar = (n, primeiro) => { const l = [...Array(n).keys()].filter(i => i !== primeiro); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return primeiro == null ? l : [primeiro, ...l]; };
  async function carregar(tocar = true) {
    const f = atual(); if (!f) return;
    const arq = arquivos.get(f.id);
    if (!arq) { console.warn("Músicas: arquivo indisponível nesta sessão", f.id); return; }
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(arq);
    audio.src = url;
    if (tocar) await audio.play().catch(() => {});
    completarRadio();
    avisar();
  }
  audio.addEventListener("ended", () => {
    const f = atual(); if (f) registrar(f.id, "tocada");
    if (pararNoFim) { pararNoFim = false; avisar(); return; }
    if (repetir === "uma") { audio.currentTime = 0; audio.play(); return; }
    completarRadio();
    if (pos + 1 < ordem.length) { pos++; carregar(); }
    else if (repetir === "todas") { pos = 0; carregar(); }
    else avisar();
  });
  function midiaSessao() {
    const f = atual();
    if (!("mediaSession" in navigator) || !f) return;
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: f.titulo, artist: f.artista, album: f.album }); } catch {}
  }
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("nexttrack", () => api.comando("proxima"));
      navigator.mediaSession.setActionHandler("previoustrack", () => api.comando("anterior"));
    } catch {}
  }
  // ---- álbum Estudos ----
  const tocarE = async () => {
    const id = filaE[iE % filaE.length], arq = arquivos.get(id);
    if (!arq) return;
    if (urlE) URL.revokeObjectURL(urlE);
    urlE = URL.createObjectURL(arq); estudo.src = urlE;
    await estudo.play().catch(() => {});
  };
  estudo.addEventListener("ended", () => { iE++; tocarE(); });
  const fade = (alvo, ms, pausar) => {
    clearInterval(rampa);
    const ini = estudo.volume, t0 = performance.now();
    rampa = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      estudo.volume = Math.max(0, Math.min(1, ini + (alvo - ini) * k));
      if (k >= 1) { clearInterval(rampa); rampa = null; if (pausar) estudo.pause(); }
    }, 40);
  };

  const api = {
    nativo: false,
    // prefixo: "web" (a pasta das músicas) ou "webE" (a pasta de entrada), cada uma com os seus arquivos
    async escolherPasta(prefixo = "web") {
      const inp = document.createElement("input");
      inp.type = "file"; inp.multiple = true; inp.webkitdirectory = true; inp.style.display = "none";
      document.body.append(inp);
      const files = await new Promise((ok, erro) => { inp.onchange = () => ok([...inp.files]); inp.addEventListener("cancel", () => erro(new Error("cancelado"))); inp.click(); });
      inp.remove();
      if (!files.length) throw new Error("cancelado");
      for (const k of [...arquivos.keys()]) if (k.startsWith(prefixo + ":")) arquivos.delete(k);
      const raiz = (files[0].webkitRelativePath || files[0].name).split("/")[0];
      for (const f of files) {
        if (!/\.(mp3|flac|m4a|aac|ogg|oga|opus|wav|mp4)$/i.test(f.name)) continue;
        const caminho = (f.webkitRelativePath || f.name).split("/").slice(1).join("/") || f.name;
        arquivos.set(`${prefixo}:${caminho}`, f);
      }
      return { uri: prefixo, nome: raiz, grava: false };
    },
    async listar(uri = "web") {
      const meus = [...arquivos].filter(([id]) => id.startsWith(uri + ":"));
      if (!meus.length && uri === "web") throw new Error("escolha_de_novo");
      return meus.map(([id, f]) => ({ id, caminho: id.slice(uri.length + 1), tamanho: f.size, modificado: f.lastModified }));
    },
    async lerTags(ids) {
      const out = [];
      for (const id of ids) {
        const f = arquivos.get(id);
        if (!f) { out.push({ id, erro: "indisponível" }); continue; }
        const t = { ...(await lerTagsArquivo(f)), ...(f._tags || {}) };
        if (f._capa !== undefined) { t.capa = f._capa ? new Blob([Uint8Array.from(atob(f._capa), c => c.charCodeAt(0))], { type: "image/jpeg" }) : null; capas.delete(id); }
        if (t.capa) capas.set(id, t.capa);
        out.push({ id, titulo: t.titulo, artista: t.artista, album: t.album, albumArtista: t.albumArtista, genero: t.genero, ano: t.ano, faixa: t.faixa, duracao: t.duracao || 0, nota: t.nota, temCapa: !!t.capa, mime: f.type });
      }
      return out;
    },
    async capa(id, lado = 320) {
      let b = capas.get(id);
      if (!b) { const f = arquivos.get(id); if (!f) return ""; b = (await lerTagsArquivo(f)).capa; }
      if (!b) return "";
      if (lado <= 0) return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => ok(""); fr.readAsDataURL(b); });
      try {
        const img = await createImageBitmap(b);
        const e = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * e); c.height = Math.round(img.height * e);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", lado >= 500 ? 0.92 : 0.88);
      } catch { return ""; }
    },
    async tocar(faixas, indice = 0, o = {}) {
      contarSaida(false);
      api.estudosParar();
      fila = faixas.slice(); if (o.aleatorio != null) aleatorio = o.aleatorio; if (o.repetir) repetir = o.repetir;
      ordem = aleatorio ? embaralhar(fila.length, indice) : [...fila.keys()];
      pos = aleatorio ? 0 : indice;
      await carregar();
      if (o.posicao) audio.currentTime = o.posicao / 1000;
      return estadoAgora();
    },
    async enfileirar(faixas, fim = false) {
      if (!fila.length) return api.tocar(faixas, 0);
      // como no Media3: "a seguir" entra logo depois da atual na lista; o aleatório é feito pelo app
      const cur = ordem[pos], onde = fim ? fila.length : cur + 1;
      fila.splice(onde, 0, ...faixas);
      ordem = aleatorio ? [...ordem.map(i => (i >= onde ? i + faixas.length : i)), ...faixas.map((_, k) => onde + k)] : [...fila.keys()];
      if (!aleatorio) pos = cur;
      avisar(); return estadoAgora();
    },
    async comando(acao, x = {}) {
      if (acao === "pausar") audio.pause();
      else if (acao === "continuar") { api.estudosParar(); if (!audio.src) await carregar(); else await audio.play().catch(() => {}); }
      else if (acao === "proxima") { contarSaida(true); if (pos + 1 < ordem.length) pos++; else pos = 0; await carregar(); }
      else if (acao === "anterior") { if (audio.currentTime > 3) audio.currentTime = 0; else { contarSaida(true); pos = Math.max(0, pos - 1); await carregar(); } }
      else if (acao === "buscar") audio.currentTime = (x.ms || 0) / 1000;
      else if (acao === "irPara") { contarSaida(true); pos = Math.max(0, ordem.indexOf(x.indice)); await carregar(); }
      else if (acao === "aleatorio") { const cur = ordem[pos]; aleatorio = !!x.valor; ordem = aleatorio ? embaralhar(fila.length, cur) : [...fila.keys()]; pos = aleatorio ? 0 : cur; }
      else if (acao === "repetir") repetir = x.valor || "nao";
      else if (acao === "parar") { audio.pause(); audio.removeAttribute("src"); fila = []; ordem = []; pos = 0; }
      avisar(); return estadoAgora();
    },
    async estado() { return estadoAgora(); },
    async ajustesTocador(o) { aj = { ...aj, ...o }; tique(); },
    async radioPool(faixas) { pool = faixas.slice(); },
    async timer(ms, fim = false) { timerFim = ms > 0 ? Date.now() + ms : 0; pararNoFim = !!fim; tique(); return { timerFim, pararNoFim }; },
    async trocar(f, ms) {
      const i = ordem[pos]; if (i == null) return estadoAgora();
      fila[i] = f; await carregar(false); audio.currentTime = ms / 1000; await audio.play().catch(() => {}); avisar(); return estadoAgora();
    },
    async apagarArquivo(id) { arquivos.delete(id); },
    async lerTexto(uri, pasta, nome) { try { return localStorage.getItem(`orbita-pasta:${pasta}/${nome}`); } catch { return null; } },
    async gravarTexto(uri, pasta, nome, texto) { try { localStorage.setItem(`orbita-pasta:${pasta}/${nome}`, texto); } catch { /* */ } },
    async fila() { return ordem.map(i => fila[i]?.id).filter(Boolean); },
    async historico() { return hist.splice(0); },
    async avaliacoesDeFora() { const l = [...fora].map(([id, a]) => ({ id, ...a })); fora.clear(); return l; },
    async avaliacao(id, nota, fav, campo) { notasApp.set(id, (nota || 0) + (fav ? 100 : 0)); const a = fora.get(id); if (a) { if (!campo || campo === "nota") delete a.nota; if (!campo || campo === "fav") delete a.fav; if (a.nota == null && a.fav == null) fora.delete(id); } },
    async avaliacoes(mapa) { notasApp.clear(); for (const [id, c] of Object.entries(mapa || {})) notasApp.set(id, c); notasApp.set("_completo", 1); },
    aoNotasFora: (fn) => { ouvintesFora.add(fn); return () => ouvintesFora.delete(fn); },
    _avaliarFora(id, a) { fora.set(id, { ...(fora.get(id) || {}), ...a, em: Date.now() }); ouvintesFora.forEach(fn => fn({ rev: Date.now() })); },
    _notasApp: notasApp,
    ouvir: (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    async estudosTocar(ids, volume = 0.5) {
      if (!audio.paused) return { ocupado: true };
      volE = volume;
      filaE = ids.slice(); for (let i = filaE.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [filaE[i], filaE[j]] = [filaE[j], filaE[i]]; }
      iE = 0; estudo.volume = 0;
      await tocarE(); fade(volE, 1500, false);
      return {};
    },
    async estudosParar() { if (!estudo.paused) fade(0, 700, true); },
    async estudosVolume(v) { volE = v; if (!rampa) estudo.volume = v; },
    async lerArquivo(id) { const f = arquivos.get(id); if (!f) throw new Error("Escolha a pasta de novo."); return new Uint8Array(await f.arrayBuffer()); },
    async lerInicio(id, n) { const f = arquivos.get(id); if (!f) throw new Error("Escolha a pasta de novo."); return new Uint8Array(await f.slice(0, n).arrayBuffer()); },
    async criarArquivo(uri, pasta, nome, mime, bytes) {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = nome; document.body.append(a); a.click(); a.remove();
      const id = `web:${pasta ? pasta + "/" : ""}${nome}`;
      arquivos.set(id, new File([bytes], nome, { type: mime, lastModified: Date.now() }));
      return id;
    },
    // no navegador não dá para gravar dentro do arquivo: guarda na memória (para testar o fluxo)
    async gravarTags(id, caminho, campos, capa) { const f = arquivos.get(id); if (!f) throw new Error("Escolha a pasta de novo."); f._tags = { ...(f._tags || {}), ...campos }; if (campos.tagsInternas !== undefined) f._tagsInternas = campos.tagsInternas; if (capa !== undefined) f._capa = capa; return { tamanho: f.size, modificado: Date.now() }; },
    async moverArquivo(uri, id, pasta, nome) {
      const f = arquivos.get(id); if (!f) throw new Error("Escolha a pasta de novo.");
      let caminho = `${pasta ? pasta + "/" : ""}${nome}`, k = 2;
      while (arquivos.has(`web:${caminho}`) && `web:${caminho}` !== id) caminho = `${pasta ? pasta + "/" : ""}${nome.replace(/(\.[^.]+)$/, ` (${k++})$1`)}`;
      arquivos.delete(id); arquivos.set(`web:${caminho}`, f);
      return { id: `web:${caminho}`, caminho, tamanho: f.size, modificado: Date.now() };
    },
    async criarPasta(uri, nome) { return { id: `web:${nome}` }; },
    // estrelas, coração e tags internas "no arquivo": no navegador, só na memória desta sessão (para testar o fluxo)
    async lerNotas(itens) { return itens.map(({ id }) => { const f = arquivos.get(id); return { id, nota: f?._nota ?? -1, fav: !!f?._fav, tags: f?._tagsInternas || "", ...(f?._tags?.ano !== undefined ? { ano: f._tags.ano } : {}) }; }); },
    async gravarNotas(id, caminho, nota, fav, tags) { const f = arquivos.get(id); if (!f) throw new Error("Escolha a pasta de novo."); f._nota = nota || -1; f._fav = !!fav; if (tags !== undefined) f._tagsInternas = tags; return { tamanho: f.size, modificado: f.lastModified }; },
    _arquivos: arquivos, _audio: audio, _estudo: estudo, // para testes
  };
  return api;
}
