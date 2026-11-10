// Testes de mercado: avisos no celular (DESLIGADOS por padrão; interruptor em Como funciona, `sel.avisos` em
// `orbita.testes.sel`). Ao abrir o app ou voltar a ele (areas.js `lerFinancas`), lê o resumo e, se ele é mais novo que o
// último avisado (`orbita.testes.avisado`), avisa liquidação na combinação escolhida e carteira que entrou ou saiu
// (id 978, `extra.area` "financas:testes" abre a aba). Nada no Meu dia.
import { avisarAgora } from "../../notificacoes.js";
import { carregar, podeBuscar } from "./dados.js";
import { sel, guardarSel, comboSel } from "./comum.js";
import * as K from "./calculo.js";

const CHAVE = "orbita.testes.avisado";
const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch { return null; } };
const gravar = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* */ } };

/** Liga ou desliga; ao ligar, o que já existe não vira aviso. */
export function ligarAvisos(ligar, d) {
  sel.avisos = !!ligar; guardarSel();
  if (ligar && d && !d.exemplo) gravar(K.marca(d));
}

/** O texto do aviso (ou null): exportado para o teste. */
export function textoAviso(nv, k) {
  if (!nv) return null;
  const partes = [];
  if (nv.liq.length) partes.push(nv.liq.length === 1 ? `liquidação na cópia de ${nv.liq[0].curto} (${nv.liq[0].moeda})` : `${nv.liq.length} liquidações nas cópias`);
  if (nv.entraram.length) partes.push(`entrou ${nv.entraram.map(c => c.curto).join(", ")}`);
  if (nv.sairam.length) partes.push(`saiu ${nv.sairam.map(e => e.curto).join(", ")}`);
  if (!partes.length) return null;
  const t = partes.join("; ");
  return `${t[0].toUpperCase()}${t.slice(1)} (${K.rotulo(k)}, saldo fictício).`;
}

export async function verificar() {
  if (!sel.avisos || !podeBuscar()) return;
  const d = await carregar();
  if (!d || d.exemplo) return;
  const base = ler();
  if (!base?.agora) { gravar(K.marca(d)); return; }
  if (d.agora <= base.agora) return;
  const k = comboSel(d), texto = textoAviso(K.novidades(d, base, k), k);
  gravar(K.marca(d));
  if (texto) await avisarAgora({ id: 978, title: "Testes de mercado 🧪", body: texto, extra: { area: "financas:testes" } });
}
