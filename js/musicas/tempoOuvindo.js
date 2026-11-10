// O tempo lá fora na hora em que ele ouviu (pedido do Alediov, 04/11/2026: correlações das músicas com o clima).
// O histórico do tocador chega ao app horas depois (quando ele abre as Músicas) e a previsão em cache do subapp Clima
// só tem as horas a partir da meia-noite do dia em que foi buscada. Por isso um arquivo pequeno das horas já vistas,
// só neste aparelho (localStorage "orbita.musicas.tempoHoras", ~120 dias, uma linha por hora: [temperatura, chuva 0/1,
// código WMO]), preenchido sempre que o Clima busca ou o app abre (areas.js climaNoFundo) e quando o histórico chega.
// Sem rede, vale o que estiver em cache para aquela hora; sem nada, a reprodução fica sem o tempo.
import { guardado } from "../clima/dados.js";
import { chuvoso } from "../clima/tempo.js";

const CHAVE = "orbita.musicas.tempoHoras", DIAS = 120, LUGARES = ["faculdade", "huop", "casa", "unico"];
const chaveHora = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`; };
function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch { return {}; } }
function gravar(a) { try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch { /* cheio: fica sem */ } }

/** Copia as horas das previsões guardadas (até 2 h à frente) para o arquivo. A busca mais nova sobrescreve. */
export function arquivarHoras(agora = Date.now()) {
  const a = ler(), lim = chaveHora(agora + 2 * 3600e3), velho = chaveHora(agora - DIAS * 86400e3);
  let mudou = false;
  for (const q of LUGARES) {
    let c = null; try { c = guardado(q); } catch { /* sem o lugar */ }
    if (!c?.horas) continue;
    for (const x of c.horas) {
      const k = String(x.h || "").slice(0, 13);
      if (k.length !== 13 || k > lim || x.t == null) continue;
      const v = [Math.round(x.t * 10) / 10, chuvoso(x.cod) || (x.mm || 0) >= 0.2 ? 1 : 0, x.cod ?? null];
      if (JSON.stringify(a[k]) !== JSON.stringify(v)) { a[k] = v; mudou = true; }
    }
  }
  for (const k of Object.keys(a)) if (k < velho) { delete a[k]; mudou = true; }
  if (mudou) gravar(a);
  return Object.keys(a).length;
}

/** O tempo numa hora: { t, chuva, cod } ou null. `arquivo` (opcional): o objeto já lido (para listas longas). */
export function tempoNaHora(ms, arquivo = ler()) {
  const v = arquivo[chaveHora(ms)];
  return v ? { t: v[0], chuva: !!v[1], cod: v[2] } : null;
}
export const lerArquivo = ler;

let ligado = false;
/** Arquiva a cada previsão nova do Clima (uma vez por sessão). */
export function ligarArquivo() {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  window.addEventListener("oq-clima", () => setTimeout(() => arquivarHoras(), 200));
}
