// O álbum Estudos nas lições e jogos (config.musicaLicoes: "auto" = do álbum, se tiver músicas; "app" = a música
// do app; "silencio"), e a música do app quieta enquanto as suas músicas tocam no tocador das Músicas.
import { E } from "../estado.js";
import { definirMusicaPropria, reavaliarMusica } from "../musica.js";
import { motor } from "./motor.js";
import * as BD from "./banco.js";
import { ESTUDOS, aoMudarBiblioteca, faixaTocando, gravarPendentes, migrarNotasParaArquivos } from "./biblioteca.js";

let ids = [], minhasTocando = false, tocandoEstudos = false;
const volume = () => 0.85 * ((E().config.volMusica ?? 60) / 100);

async function lerAlbum() {
  try { ids = (await BD.todosAlbuns()).find(a => a.id === ESTUDOS)?.faixas || []; } catch { ids = []; }
}

function tocar() {
  if (tocandoEstudos) return;
  tocandoEstudos = true;
  motor.estudosTocar(ids, volume()).then(r => { if (r?.ocupado) tocandoEstudos = false; }).catch(e => { tocandoEstudos = false; console.warn("Estudos: música", e); });
}
function parar() {
  if (!tocandoEstudos) return;
  tocandoEstudos = false;
  motor.estudosParar().catch(() => {});
}

function decidir(contexto, ehCamada) {
  if (minhasTocando) { parar(); return true; } // as suas músicas estão tocando: a do app fica quieta
  const modo = E().config.musicaLicoes || "auto";
  if (ehCamada && modo === "silencio") { parar(); return true; }
  if (ehCamada && modo === "auto" && ids.length) { tocar(); return true; }
  parar();
  return false;
}

export async function iniciarMusicaPropria() {
  await lerAlbum();
  definirMusicaPropria({ decidir, parar, volume: () => { if (tocandoEstudos) motor.estudosVolume(volume()).catch(() => {}); } });
  let idAtual = null;
  motor.ouvir(e => {
    if (e?.id !== idAtual) { idAtual = e?.id || null; faixaTocando(idAtual); }
    const t = !!e?.tocando;
    if (t !== minhasTocando) { minhasTocando = t; reavaliarMusica(); }
  });
  aoMudarBiblioteca(o => { if (o.albuns || o.album === ESTUDOS) lerAlbum(); });
  try { const e = await motor.estado(); if (e?.tocando) { minhasTocando = true; reavaliarMusica(); } } catch {}
  setTimeout(() => migrarNotasParaArquivos().then(() => gravarPendentes()).catch(() => {}), 8000); // estrelas que ficaram para gravar nos arquivos
}
