// Ouvir no ônibus (pedido do Alediov, 25/10/2026): leitura em voz alta com um tocador fixo embaixo, que continua
// entre as telas. No celular usa o TextToSpeech do Android pelo plugin nativo "Voz" (a fila inteira vai de uma vez,
// então a fala segue com a tela apagada); no navegador, o speechSynthesis.
// Usado pela Leitura (a unidade, a partir do parágrafo na tela, emendando a próxima) e pela trilha ("Ouvir o dia").
// A voz (pedido do Alediov, 09/11/2026: "o áudio do Ouvir é péssimo"): ele escolhe o motor e a voz pt-BR (padrão: a de
// maior qualidade instalada, preferindo o "Serviços de fala do Google"), com "Ouvir exemplo" e o atalho para instalar
// a voz de alta qualidade, na folha `abrirAjustesVoz` (o botão de voz do tocador e Ajustes do Órbita → Toque e som).
// A escolha é deste aparelho (as vozes mudam de aparelho para aparelho): no Android, nas preferências do plugin
// (`orbita_voz`); no navegador, em localStorage `orbita.voz`.
import { E, salvar } from "./estado.js";
import { semThen } from "./semThen.js";
import { toast } from "./ui.js";
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";

const NATIVO = () => Capacitor.isNativePlatform?.();
const VELS = [0.9, 1, 1.15, 1.3, 1.5, 1.75];
let Voz = null, fila = null; // { titulo, trechos: [{ texto, rotulo, ref }], i, aoTrecho, aoFim, tocando }
let barra = null, ouvintes = [];

// O texto vira palavras (unidades, abreviações, sinais) e os trechos levam a pausa depois deles (vozTexto.js, 09/11/2026).
export { trechosDe, normalizarFala } from "./vozTexto.js";
import { trechosDe as _trechos, melhorVoz, PAUSA_PARAGRAFO } from "./vozTexto.js";

async function plugin() {
  if (Voz) return Voz;
  Voz = semThen(registerPlugin("Voz")); // sem o then, o await travava (semThen.js)
  ouvintes.push(await Voz.addListener("trecho", (e) => aoTrechoNativo(e.i)));
  ouvintes.push(await Voz.addListener("fim", () => aoFimNativo()));
  return Voz;
}
const vel = () => E().config.vozVel || 1;

/** Começa a ouvir. `trechos`: [{ texto, rotulo?, ref? }]; `aoTrecho(i, trecho)`; `aoFim()` pode devolver mais trechos. */
export async function ouvir({ titulo, trechos, inicio = 0, aoTrecho = null, aoFim = null }) {
  if (!trechos?.length) { toast("Nada para ler aqui."); return; }
  await parar(false);
  fila = { titulo, trechos, i: inicio, aoTrecho, aoFim, tocando: false };
  desenhar();
  await tocarDe(inicio);
}
async function tocarDe(i) {
  if (!fila) return;
  fila.i = Math.max(0, Math.min(fila.trechos.length - 1, i));
  fila.tocando = true;
  avisarTrecho(fila.i);
  if (NATIVO()) {
    try { await (await plugin()).falar({ textos: fila.trechos.map(t => t.texto), pausas: fila.trechos.map(t => t.pausa ?? PAUSA_PARAGRAFO), inicio: fila.i, velocidade: vel(), lingua: "pt-BR" }); }
    catch (e) { toast(e.message || "A voz do Android não respondeu.", 4000); fila.tocando = false; }
  } else falarWeb();
  desenhar();
}
let pausaWeb = 0;
function falarWeb() {
  const s = window.speechSynthesis;
  if (!s) { toast("Este navegador não lê em voz alta."); return; }
  s.cancel(); clearTimeout(pausaWeb);
  const t = fila.trechos[fila.i];
  const u = new SpeechSynthesisUtterance(t.texto);
  u.lang = "pt-BR"; u.rate = vel();
  const v = vozWeb(); if (v) try { u.voice = v; } catch { /* voz que o navegador não aceita: fica a padrão */ }
  u.onend = () => {
    if (!fila?.tocando) return;
    if (fila.i < fila.trechos.length - 1) pausaWeb = setTimeout(() => { if (!fila?.tocando) return; fila.i++; avisarTrecho(fila.i); falarWeb(); desenhar(); }, t.pausa ?? PAUSA_PARAGRAFO);
    else aoFimNativo();
  };
  s.speak(u);
}
function aoTrechoNativo(i) { if (!fila || i < 0) return; fila.i = i; avisarTrecho(i); desenhar(); }
async function aoFimNativo() {
  if (!fila) return;
  const mais = await fila.aoFim?.();
  if (mais?.trechos?.length) { const ini = fila.trechos.length; fila.trechos.push(...mais.trechos); if (mais.titulo) fila.titulo = mais.titulo; if (mais.aoTrecho) fila.aoTrecho = mais.aoTrecho; fila.aoFim = mais.aoFim ?? null; await tocarDe(ini); return; }
  fila.tocando = false; desenhar();
}
function avisarTrecho(i) { try { fila.aoTrecho?.(i, fila.trechos[i]); } catch (e) { console.warn(e); } }

export async function parar(fechar = true) {
  if (fila) fila.tocando = false;
  if (NATIVO()) { try { await (await plugin()).parar(); } catch { /* sem voz */ } }
  else { clearTimeout(pausaWeb); window.speechSynthesis?.cancel(); }
  if (fechar) { fila = null; barra?.remove(); barra = null; document.body.classList.remove("com-ouvinte"); }
}
export const ouvindo = () => !!fila;
export function trechoAtual() { return fila ? fila.trechos[fila.i] : null; }

// ---------------------------------------------------------------- tocador
const IC = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  pausa: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  ant: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor"/></svg>',
  prox: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  voz: '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  fone: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0116 0v3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="5" height="7" rx="2" fill="currentColor"/><rect x="16" y="14" width="5" height="7" rx="2" fill="currentColor"/></svg>',
};
export const ICONE_FONE = IC.fone;
function desenhar() {
  if (!fila) return;
  if (!barra) {
    barra = document.createElement("div"); barra.className = "ouvinte";
    barra.innerHTML = `<div class="ouv-prog"><i></i></div><span class="ouv-ico">${IC.fone}</span><div class="ouv-tx"><b></b><small></small></div>
      <button data-a="ant" aria-label="Trecho anterior">${IC.ant}</button><button data-a="tocar" class="ouv-play" aria-label="Tocar ou pausar"></button><button data-a="prox" aria-label="Próximo trecho">${IC.prox}</button>
      <button data-a="vel" class="ouv-vel"></button><button data-a="voz" class="ouv-voz" aria-label="Escolher a voz">${IC.voz}</button><button data-a="x" aria-label="Fechar">${IC.x}</button>`;
    document.body.append(barra);
    document.body.classList.add("com-ouvinte");
    barra.addEventListener("click", async (e) => {
      const a = e.target.closest("button")?.dataset.a; if (!a || !fila) return;
      if (a === "tocar") { if (fila.tocando) { await parar(false); desenhar(); } else tocarDe(fila.i); }
      if (a === "ant") tocarDe(fila.i - 1);
      if (a === "prox") tocarDe(fila.i + 1);
      if (a === "vel") { const c = E().config; c.vozVel = VELS[(VELS.indexOf(vel()) + 1) % VELS.length]; salvar(); if (fila.tocando) tocarDe(fila.i); else desenhar(); }
      if (a === "voz") abrirAjustesVoz();
      if (a === "x") parar(true);
    });
  }
  const t = fila.trechos[fila.i];
  barra.querySelector(".ouv-tx b").textContent = fila.titulo || "Ouvindo";
  barra.querySelector(".ouv-tx small").textContent = t?.rotulo || `${fila.i + 1} de ${fila.trechos.length}`;
  barra.querySelector(".ouv-play").innerHTML = fila.tocando ? IC.pausa : IC.play;
  barra.querySelector(".ouv-vel").textContent = `${String(vel()).replace(".", ",")}×`;
  barra.querySelector(".ouv-prog i").style.width = `${((fila.i + 1) / fila.trechos.length) * 100}%`;
}

// ---------------------------------------------------------------- as vozes (09/11/2026)
const CHAVE_WEB = "orbita.voz";
const lerWeb = () => { try { return JSON.parse(localStorage.getItem(CHAVE_WEB) || "{}") || {}; } catch { return {}; } };
const gravarWeb = (o) => { try { localStorage.setItem(CHAVE_WEB, JSON.stringify(o)); } catch { /* sem armazenamento */ } };
const doNavegador = (v) => ({ nome: v.name, lingua: v.lang, rede: !v.localService, padrao: !!v.default, motor: "navegador" });
/** As vozes do navegador (o Chrome as carrega depois: espera o voiceschanged por até 1,5 s). */
function vozesDoNavegador() {
  const s = window.speechSynthesis; if (!s) return Promise.resolve([]);
  const ja = s.getVoices(); if (ja.length) return Promise.resolve(ja);
  return new Promise((ok) => {
    const t = setTimeout(() => ok(s.getVoices()), 1500);
    s.addEventListener?.("voiceschanged", () => { clearTimeout(t); ok(s.getVoices()); }, { once: true });
  });
}
/** A voz do navegador escolhida (ou a melhor pt-BR). */
function vozWeb() {
  const todas = window.speechSynthesis?.getVoices() || [], esc = lerWeb().voz;
  const v = esc && todas.find(x => x.name === esc);
  if (v) return v;
  const m = melhorVoz(todas.map(doNavegador));
  return m ? todas.find(x => x.name === m.nome) : todas.find(x => /pt[-_]BR/i.test(x.lang)) || null;
}
/**
 * As vozes em português deste aparelho: { nativo, motores: [{ nome, rotulo }], motor, vozes: [{ nome, lingua, qualidade?,
 * latencia?, rede, instalada?, motor }], escolhida (nome ou ""), padrao (a melhor), google (o Serviços de fala do Google
 * está instalado?) }.
 */
export async function vozesDisponiveis() {
  if (NATIVO()) {
    try {
      const r = await (await plugin()).vozes();
      const vozes = (r.vozes || []).filter(v => /^pt/i.test(v.lingua || ""));
      return { nativo: true, motores: r.motores || [], motor: r.motor || "", vozes, escolhida: r.voz || "", padrao: melhorVoz(vozes)?.nome || "", google: !!r.google };
    } catch (e) { return { nativo: true, motores: [], motor: "", vozes: [], escolhida: "", padrao: "", erro: e.message || "a voz do Android não respondeu" }; }
  }
  const vozes = (await vozesDoNavegador()).map(doNavegador).filter(v => /^pt/i.test(v.lingua));
  return { nativo: false, motores: [{ nome: "navegador", rotulo: "Navegador" }], motor: "navegador", vozes, escolhida: lerWeb().voz || "", padrao: melhorVoz(vozes)?.nome || "" };
}
/** Escolhe o motor e/ou a voz ("" = a melhor automaticamente). */
export async function definirVoz({ motor, voz } = {}) {
  if (NATIVO()) { await (await plugin()).definir({ ...(motor !== undefined ? { motor } : {}), ...(voz !== undefined ? { voz } : {}) }); return; }
  gravarWeb({ ...lerWeb(), ...(voz !== undefined ? { voz } : {}) });
}
export const TEXTO_EXEMPLO = "Olá! Esta é a voz que vai ler as suas unidades. Na técnica do alveolar inferior, use a agulha longa e deposite 1,5 mL; a dose máxima de lidocaína é 7 mg/kg, p. ex. num adulto de 70 kg.";
/** Lê um exemplo curto com a voz escolhida (pára o que estiver tocando). */
export async function ouvirExemplo(texto = TEXTO_EXEMPLO) {
  const tr = _trechos(texto);
  if (fila) { fila.tocando = false; desenhar(); }
  if (NATIVO()) { await (await plugin()).exemplo({ texto: tr.map(t => t.texto).join(" "), velocidade: vel() }); return; }
  const s = window.speechSynthesis; if (!s) { toast("Este navegador não lê em voz alta."); return; }
  s.cancel(); clearTimeout(pausaWeb);
  const u = new SpeechSynthesisUtterance(tr.map(t => t.texto).join(" ")); u.lang = "pt-BR"; u.rate = vel();
  const v = vozWeb(); if (v) try { u.voice = v; } catch { /* voz que o navegador não aceita: fica a padrão */ }
  s.speak(u);
}
/** Abre a instalação dos dados de voz do motor (ou as configurações de fala; ou a loja do "Serviços de fala do Google"). */
export async function instalarVozes(qual = "dados") {
  if (!NATIVO()) { toast("No celular: Configurações → Acessibilidade → Saída de texto para fala."); return false; }
  try { await (await plugin()).abrir({ qual }); return true; } catch (e) { toast(e.message || "Não deu para abrir as configurações de voz.", 4000); return false; }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nomeMotor = (m) => ({ "com.google.android.tts": "Serviços de fala do Google", "com.samsung.SMT": "Samsung TTS", navegador: "Navegador" })[m.nome] || m.rotulo || m.nome;
/** A folha "Voz do Ouvir": motor, vozes em português (com a qualidade), Ouvir exemplo e o aviso de instalar a voz boa. */
export async function abrirAjustesVoz() {
  const { rotuloQualidade } = await import("./vozTexto.js");
  const m = document.getElementById("modal"); if (!m) return;
  const desenharFolha = async () => {
    const d = await vozesDisponiveis();
    const ativa = d.escolhida || d.padrao;
    const linhas = d.vozes.map(v => {
      const det = [v.lingua, rotuloQualidade(v.qualidade) && `qualidade ${rotuloQualidade(v.qualidade)}`, v.rede ? "precisa de internet" : "sem internet", v.instalada === false ? "não baixada" : ""].filter(Boolean).join(" · ");
      return `<button type="button" class="voz-op${v.nome === ativa ? " on" : ""}" data-voz="${esc(v.nome)}"><b>${esc(v.nome)}${v.nome === d.padrao ? " <small>(a melhor)</small>" : ""}</b><small>${esc(det)}</small></button>`;
    }).join("");
    const motores = d.nativo && d.motores.length > 1 ? `<label class="voz-rot">Motor de voz</label><div class="voz-motores">${d.motores.map(x => `<button type="button" class="voz-motor${x.nome === d.motor ? " on" : ""}" data-motor="${esc(x.nome)}">${esc(nomeMotor(x))}</button>`).join("")}</div>` : d.nativo && d.motor ? `<p class="voz-nota">Motor: ${esc(nomeMotor({ nome: d.motor }))}</p>` : "";
    const aviso = d.nativo
      ? `<p class="voz-nota">${d.google ? "Para a voz mais natural, baixe a voz em português de alta qualidade do Google." : "A voz fica bem melhor com o app “Serviços de fala do Google” (Speech Services by Google), grátis na Play Store."} Depois, escolha a voz aqui.</p>
         <div class="voz-bts">${d.google ? "" : `<button type="button" class="botao secundario" data-abrir="loja">Instalar o Serviços de fala do Google</button>`}<button type="button" class="botao secundario" data-abrir="dados">Baixar vozes de alta qualidade</button><button type="button" class="botao secundario" data-abrir="ajustes">Configurações de voz do Android</button></div>`
      : `<p class="voz-nota">No navegador, as vozes são as do sistema. As “Google” e as “naturais” costumam soar melhor.</p>`;
    m.innerHTML = `<div class="modal-caixa voz-caixa"><h2>Voz do Ouvir</h2>
      ${d.erro ? `<p class="voz-nota">${esc(d.erro)}</p>` : ""}${motores}
      <label class="voz-rot">Vozes em português</label>
      <div class="voz-lista">${linhas || `<p class="voz-nota">Nenhuma voz em português neste aparelho.</p>`}</div>
      ${d.escolhida ? `<button type="button" class="voz-auto" data-voz="">Voltar à melhor automaticamente</button>` : ""}
      <button type="button" class="botao voz-exemplo">Ouvir exemplo</button>
      ${aviso}
      <button type="button" class="botao secundario voz-fechar">Fechar</button></div>`;
    m.hidden = false;
  };
  m.onclick = async (e) => {
    if (e.target === m) { m.hidden = true; return; }
    const b = e.target.closest("button"); if (!b) return;
    if (b.classList.contains("voz-fechar")) { m.hidden = true; return; }
    if (b.classList.contains("voz-exemplo")) { b.disabled = true; try { await ouvirExemplo(); } catch (er) { toast(er.message || "A voz não respondeu."); } b.disabled = false; return; }
    if (b.dataset.abrir) { instalarVozes(b.dataset.abrir); return; }
    if (b.dataset.motor !== undefined) { b.disabled = true; await definirVoz({ motor: b.dataset.motor, voz: "" }).catch(er => toast(er.message || "Não deu para trocar o motor.")); await desenharFolha(); return; }
    if (b.dataset.voz !== undefined) { await definirVoz({ voz: b.dataset.voz }).catch(er => toast(er.message || "Não deu para trocar a voz.")); await desenharFolha(); ouvirExemplo().catch(() => {}); }
  };
  await desenharFolha();
}
