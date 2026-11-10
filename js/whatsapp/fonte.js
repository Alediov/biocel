// Avisos do WhatsApp: de onde vêm as mensagens. No Android, o plugin "WhatsAvisos" (WhatsAvisosPlugin.java: o serviço
// que lê as notificações do WhatsApp guarda só as dos grupos escolhidos, sem telefone, 30 dias). No navegador (testes e
// notebook), uma fonte de mentira com a MESMA interface e as mesmas regras (regras.js `guardar`), guardada no
// localStorage `orbita.whats.falsa`; `injetar` faz o papel das notificações e `permitir` o do acesso às notificações.
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";
import { semThen } from "../semThen.js";
import * as R from "./regras.js";

export const nativo = () => !!Capacitor.isNativePlatform?.();
let plug = null;
/** O plugin (sempre pelo semThen: um plugin que sai de uma função async travava o await, ver semThen.js). */
export function fonte() {
  if (plug) return plug;
  plug = nativo() ? semThen(registerPlugin("WhatsAvisos")) : falsa;
  return plug;
}

// ---------------------------------------------------------------- a fonte de mentira
const CHAVE = "orbita.whats.falsa";
function lerF() {
  try { const d = JSON.parse(localStorage.getItem(CHAVE) || "null"); if (d && Array.isArray(d.msgs)) return d; } catch { /* */ }
  return { msgs: [], grupos: {}, cfg: { grupos: {}, prefixos: {} }, permitido: false, ultima: 0 };
}
function gravarF(d) { try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* cheio */ } }

const falsa = {
  falsa: true,
  async situacao() {
    const d = lerF();
    return { permitido: d.permitido, conectado: d.permitido ? Date.now() : 0, total: d.msgs.length, ultimaMensagem: d.ultima,
      grupos: Object.entries(d.grupos).map(([chave, g]) => ({ chave, nome: g.nome, ultima: g.ultima })) };
  },
  async abrirPermissao() { const d = lerF(); d.permitido = true; gravarF(d); },
  async abrirApp() {},
  // no navegador não há o WhatsApp: conta o pedido (o teste de fumaça confere) e diz que não abriu
  async abrirWhatsApp() { falsa.pedidosWhats = (falsa.pedidosWhats || 0) + 1; return { aberto: false }; },
  async mensagens({ desde = 0, limite = 2000 } = {}) {
    const d = lerF(); R.podar(d.msgs, d.cfg); gravarF(d);
    const l = d.msgs.filter(m => m.rec > desde).sort((a, b) => a.rec - b.rec), v = l.slice(0, limite);
    return { mensagens: v, ultimo: v.reduce((x, m) => Math.max(x, m.rec), desde), mais: l.length > limite };
  },
  async definirConfig(cfg) { const d = lerF(); d.cfg = { grupos: cfg.grupos || {}, prefixos: cfg.prefixos || {} }; R.podar(d.msgs, d.cfg); gravarF(d); },
  async limpar() { const d = lerF(); d.msgs = []; d.grupos = {}; d.ultima = 0; gravarF(d); },
};

/** Só no navegador: as "notificações" chegando ({grupo, de, texto, quando}); devolve as que foram guardadas. */
export function injetar(lista, agora = Date.now()) {
  const d = lerF(), entraram = R.guardar(d.msgs, lista, d.cfg, { agora, grupos: d.grupos });
  if (entraram.length) d.ultima = agora;
  gravarF(d);
  return entraram;
}
/** Só no navegador: começa do zero (o teste de fumaça). */
export function zerarFalsa() { try { localStorage.removeItem(CHAVE); } catch { /* */ } }
