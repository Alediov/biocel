// Áreas do Órbita (nomes desde 24/10/2026): Estudos (config.area "learn", tudo o que já existia), Scanner ("scan",
// as fichas da IC, antes OdontoScan), Músicas ("musicas"), Leitura ("leitura") e Xadrez ("xadrez"), as duas desde 25/10/2026,
// Finanças ("financas", desde 27/10/2026), Clima ("clima", desde 02/11/2026), Cofre ("cofre", desde 04/11/2026) e Mensagens ("eva", desde 04/11/2026; antes "Eva"). Scanner e Músicas abrem numa camada
// própria, com banco separado.
import { E, salvar, ganhar, hojeISO } from "./estado.js";
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";
import { reagendar, avisarAgora } from "./notificacoes.js";
import { atualizarWidgetScan, areaDoWidget } from "./widget.js";
import { abrirHome, fecharHome, homeAberta, contarUso } from "./home.js";
import { LOGO_CLIMA } from "./clima/icones.js";
import { LOGO_COFRE } from "./cofre/icone.js";
import { LOGO_MENSAGENS } from "./eva/icone.js";

// quantas fichas estão na fila da madrugada: as notificações avisam de manhã que há fichas lidas para trazer
// OdontoScan → OdontoLearn: cada ficha revisada rende 2 XP e 1 moeda, até 40 XP e 20 moedas por dia
function recompensar(n = 1) {
  const c = E().config, hoje = hojeISO();
  if (c.scanPremio?.dia !== hoje) c.scanPremio = { dia: hoje, xp: 0 };
  const xp = Math.min(2 * n, 40 - c.scanPremio.xp);
  if (xp <= 0) return;
  c.scanPremio.xp += xp;
  ganhar(xp, Math.ceil(xp / 2), "Scanner: fichas revisadas", "scan");
}
function avisarFila(n, r = null) {
  if (typeof n !== "number") return;
  const c = E().config;
  // quanto falta para a fila ter o que a madrugada lê (para o lembrete da noite)
  const falta = r && r.esperando > 0 ? Math.max(0, Math.min(r.esperando, (r.alvo || 0) - n)) : 0;
  if (c.scanNaFila === n && c.scanFaltaFila === falta && Date.now() - (c.scanFilaEm || 0) < 3600000) return;
  c.scanNaFila = n; c.scanFaltaFila = falta; c.scanFilaAlvo = r?.alvo || c.scanFilaAlvo || 0; c.scanFilaEm = Date.now(); salvar(); reagendar();
}

export const LOGO_LEARN = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="leg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B9BFF"/><stop offset="1" stop-color="#2340C9"/></linearGradient><linearGradient id="leb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="lec"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#leg)"/><g clip-path="url(#lec)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="5.32" cy="29.58" r="1.9" fill="#FFE27A" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#leb)"/><path d="M24 16.6c-3.1-2.3-7.3-2.9-11.3-2.1v16.4c4-.8 8.2-.2 11.3 2.1 3.1-2.3 7.3-2.9 11.3-2.1V14.5c-4-.8-8.2-.2-11.3 2.1z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M24 16.6v16.4" stroke="#2F57DB" stroke-width="1.8" stroke-linecap="round"/><path d="M16 19.2c1.8-.2 3.6.1 5.3.8M16 22.6c1.8-.2 3.6.1 5.3.8M26.7 20c1.7-.7 3.5-1 5.3-.8" stroke="#9DB7FF" stroke-width="1.3" stroke-linecap="round"/><path d="M35.5 7.6l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#FFE27A"/></svg>`;
// Ícones das áreas (24/10/2026): mesma família do ícone do Órbita (quadrado com degradê e a órbita ao fundo).
export const LOGO_ORBITA = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="obg" cx="28%" cy="18%" r="100%"><stop offset="0" stop-color="#6A55F0"/><stop offset=".45" stop-color="#2D1F86"/><stop offset="1" stop-color="#0C0828"/></radialGradient></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#obg)"/><defs><radialGradient id="pl2" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".35" stop-color="#FFC76A"/><stop offset=".75" stop-color="#FF7A59"/><stop offset="1" stop-color="#D9436B"/></radialGradient><linearGradient id="anel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B9C7FF"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6C9FF"/></linearGradient><radialGradient id="sombra" cx="70%" cy="75%" r="70%"><stop offset=".55" stop-color="#7A1E4D" stop-opacity="0"/><stop offset="1" stop-color="#5A1240" stop-opacity=".55"/></radialGradient><clipPath id="frente"><rect x="-36" y="24" width="120" height="60" transform="rotate(-22 24 24)"/></clipPath></defs><ellipse cx="24" cy="24" rx="15.5" ry="4.9" fill="none" stroke="url(#anel)" stroke-width="1.7" transform="rotate(-22 24 24)"/><circle cx="24" cy="24" r="8" fill="url(#pl2)"/><circle cx="24" cy="24" r="8" fill="url(#sombra)"/><ellipse cx="21.44" cy="20.64" rx="2.40" ry="1.28" fill="#fff" opacity=".4" transform="rotate(-30 21.44 20.64)"/><g clip-path="url(#frente)"><ellipse cx="24" cy="24" rx="15.5" ry="4.9" fill="none" stroke="#1A1250" stroke-opacity=".35" stroke-width="4.1" transform="rotate(-22 24 24)"/><ellipse cx="24" cy="24" rx="15.5" ry="4.9" fill="none" stroke="url(#anel)" stroke-width="1.7" transform="rotate(-22 24 24)"/></g><circle cx="10.20" cy="27.34" r="2.59" fill="#0C0828" opacity=".45"/><circle cx="10.20" cy="27.34" r="1.9764705882352942" fill="#3D8BFF"/><circle cx="9.51" cy="26.65" r="0.69" fill="#fff" opacity=".55"/><circle cx="33.45" cy="16.65" r="2.31" fill="#0C0828" opacity=".45"/><circle cx="33.45" cy="16.65" r="1.6941176470588235" fill="#22C3A6"/><circle cx="32.86" cy="16.05" r="0.59" fill="#fff" opacity=".55"/><circle cx="24.58" cy="29.03" r="2.78" fill="#0C0828" opacity=".45"/><circle cx="24.58" cy="29.03" r="2.164705882352941" fill="#FF5FA2"/><circle cx="23.82" cy="28.27" r="0.76" fill="#fff" opacity=".55"/></svg>`;
export const LOGO_MUSICAS = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mug" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7AB8"/><stop offset="1" stop-color="#7C3AED"/></linearGradient><linearGradient id="mub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="muc"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#mug)"/><g clip-path="url(#muc)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="5.32" cy="29.58" r="1.9" fill="#FFD1E8" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#mub)"/><path d="M19.5 31V15.8l13-3.1v15" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 18.6l13-3.1" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><ellipse cx="16.4" cy="31.4" rx="4" ry="3.2" fill="#fff" transform="rotate(-18 16.4 31.4)"/><ellipse cx="29.4" cy="28" rx="4" ry="3.2" fill="#fff" transform="rotate(-18 29.4 28)"/></svg>`;
export const LOGO_SCAN = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="scg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34E0BD"/><stop offset="1" stop-color="#0B7C70"/></linearGradient><linearGradient id="scb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="scc"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#scg)"/><g clip-path="url(#scc)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="5.32" cy="29.58" r="1.9" fill="#FFF59A" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#scb)"/><rect x="15" y="11" width="18" height="25" rx="3.2" fill="#fff"/><path d="M19 17.5h10M19 21.5h7M19 29.5h8" stroke="#7FD9C6" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 25.3h29" stroke="#FFF59A" stroke-width="2.4" stroke-linecap="round"/><path d="M9.5 25.3h29" stroke="#FFF59A" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/><path d="M11 14v-3.5h3.5M37 14v-3.5h-3.5M11 33v3.5h3.5M37 33v3.5h-3.5" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const LOGO_LEITURA = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="leg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFC24B"/><stop offset="1" stop-color="#E2551B"/></linearGradient><linearGradient id="leb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="lec2"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#leg2)"/><g clip-path="url(#lec2)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="42.6" cy="17.2" r="1.9" fill="#FFE9B8" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#leb2)"/><path d="M24 17.2c-3.2-2.4-7.6-3-11.6-2.3v17c4-.7 8.4-.1 11.6 2.3 3.2-2.4 7.6-3 11.6-2.3v-17c-4-.7-8.4-.1-11.6 2.3z" fill="#fff"/><path d="M24 17.2v17" stroke="#E8762A" stroke-width="1.6" stroke-linecap="round"/><path d="M15.4 20.2c2-.2 4.2.2 5.9 1M15.4 23.6c2-.2 4.2.2 5.9 1M15.4 27c2-.2 4.2.2 5.9 1M26.7 21.2c1.7-.8 3.9-1.2 5.9-1M26.7 24.6c1.7-.8 3.9-1.2 5.9-1" stroke="#F0A24A" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>`;
export const LOGO_XADREZ = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="xzg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5FD1A0"/><stop offset="1" stop-color="#1E6B57"/></linearGradient><linearGradient id="xzb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="xzc"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#xzg)"/><g clip-path="url(#xzc)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="8" cy="33" r="1.9" fill="#D4FFE9" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#xzb)"/><g transform="translate(9.6 8.6) scale(.64)" stroke="#1E6B57" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#fff"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#1E6B57"/></g></svg>`;
export const LOGO_FINANCAS = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="fig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B8E35A"/><stop offset="1" stop-color="#2F8A3B"/></linearGradient><linearGradient id="fib" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="fic"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#fig)"/><g clip-path="url(#fic)"><ellipse cx="24" cy="25" rx="21" ry="6.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" transform="rotate(-22 24 25)"/><circle cx="42.4" cy="17.4" r="1.9" fill="#F4FFD6" opacity=".9"/></g><rect x="2" y="2" width="44" height="22" rx="13" fill="url(#fib)"/><circle cx="19.5" cy="14.6" r="5.6" fill="#FFD45E" stroke="#E2A21B" stroke-width="1.3"/><path d="M19.5 11.9v5.4M17.9 13.3c.3-.7 2.9-.8 3 .4.1 1.1-3 .9-3 2.1 0 1.1 2.7 1.2 3.1.3" fill="none" stroke="#B87A0A" stroke-width="1.1" stroke-linecap="round"/><rect x="10.5" y="17.5" width="27" height="18.5" rx="4.2" fill="#fff"/><path d="M10.5 21.6c0-2.3 1.9-4.1 4.2-4.1h18.6c2.3 0 4.2 1.8 4.2 4.1" fill="#E6F6CF"/><rect x="28.4" y="23.6" width="11.1" height="7.6" rx="3" fill="#DDF3B8" stroke="#2F8A3B" stroke-width="1.3"/><circle cx="32.2" cy="27.4" r="1.6" fill="#2F8A3B"/><path d="M15 31.5h7" stroke="#B8E35A" stroke-width="1.8" stroke-linecap="round"/></svg>`;

let camada = null, camadaMu = null, camadaLe = null, camadaXz = null, camadaFi = null, camadaCl = null, camadaCf = null, camadaEv = null;
// cada cópia de um ícone na página ganha ids próprios: com ids repetidos, o degradê de uma cópia escondida (o modal
// fechado) some das outras
let nIcone = 0;
export function icone(svg) { const k = `i${++nIcone}`; return svg.replace(/id="([\w-]+)"/g, `id="$1${k}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1${k})`); }

async function salvadorNativo(blob, nome) {
  const Filesystem = registerPlugin("Filesystem"), Share = registerPlugin("Share");
  const b64 = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
  const { uri } = await Filesystem.writeFile({ path: `odontoscan/${nome}`, data: b64, directory: "CACHE", recursive: true });
  await Share.share({ title: nome, files: [uri], dialogTitle: "Salvar ou enviar" }).catch(() => {});
}

// Pasta de fotos pelo Android (plugin nativo "Pasta"): escolhe a pasta uma vez, lista e lê uma foto por vez
function pastaNativa() {
  const P = registerPlugin("Pasta");
  const blob = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: "image/jpeg" }); };
  return {
    escolher: () => P.escolher(),
    listar: (uri) => P.listar({ uri }),
    ler: async (uri) => blob((await P.ler({ uri })).dados),
    manterTela: (ligar) => P.manterTela({ ligar }).catch(() => {}),
  };
}

/** Iniciação Científica (antes Scanner; 31/10/2026). Pela Home abre a lista de projetos; com `direto` (notificação,
 *  widget, volta ao app), o projeto. Hoje o único projeto é o do OdontoScan ("sbc", scan/projetos.js). */
export async function abrirScan(op = {}) {
  fecharHome(); fecharMusicas(false); fecharLeitura(false); fecharXadrez(false); fecharFinancas(false); fecharClima(false); fecharCofre(false); fecharEva(false);
  E().config.area = "scan"; salvar();
  if (camada) return;
  if (!document.querySelector('link[href="scan.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "scan.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const [{ abrirOdontoScan }, { definirSalvadorNativo }] = await Promise.all([import("./scan/telaScan.js"), import("./scan/arquivos.js")]);
  if (Capacitor.isNativePlatform?.()) definirSalvadorNativo(salvadorNativo);
  const P = await import("./scan/projetos.js");
  // cada tela numa camada nova (o OdontoScan liga ouvintes e o visual na raiz; a Aparência pega a camada que entra)
  const novaCamada = () => {
    const velha = camada;
    camada = document.createElement("div"); camada.className = "camada-scan";
    document.body.append(camada);
    if (velha) velha.remove();
    return camada;
  };
  // no celular, só os resultados (29/10/2026: a leitura e a conferência das fichas são no computador do laboratório)
  const resultados = !!Capacitor.isNativePlatform?.();
  if (resultados) { const c = E().config; if (c.scanNaFila || c.scanFaltaFila) { c.scanNaFila = 0; c.scanFaltaFila = 0; salvar(); reagendar(); } }
  const lista = () => { E().config.icProjeto = ""; salvar(); P.telaProjetos(novaCamada(), { aoTrocarArea: escolherArea, aoAbrir: projeto }); };
  async function projeto(id = "sbc") {
    E().config.icProjeto = id; salvar();
    const pr = P.PROJETOS.find(x => x.id === id) || P.PROJETOS[0];
    const o = { resultados, aoTrocarArea: escolherArea, projeto: pr, aoProjetos: lista, github: { token: E().config.token || "", repo: E().config.repo || "" }, aoFila: (n, r) => avisarFila(n, r), recompensar, aoResumo: (r) => { atualizarWidgetScan(r); guardarResumoScan(r); }, pausa: pausaScan(), pasta: Capacitor.isNativePlatform?.() ? pastaNativa() : null };
    const alvo = novaCamada();
    if (resultados) (await import("./scan/painelCelular.js")).abrirResultados(alvo, o);
    else abrirOdontoScan(alvo, o);
  }
  if (op.direto) await projeto(E().config.icProjeto || "sbc"); else lista();
}

/** Iniciação Científica "não se aplica" (pedido do Alediov, 05/11/2026: a leitura do computador do laboratório está
 *  parada até ele ter o administrador de novo): sem as metas e o aviso do computador no Meu dia (o selo da Home vira o
 *  traço) e sem a notificação 977. Começa ligada nesta versão (`scanPausaMigrada`); ele desliga no cartão do topo dos
 *  Resultados. */
function pausaScan() {
  const c = E().config;
  return { ligada: !!c.scanPausado, trocar: (v) => { c.scanPausado = !!v; if (v) delete c.scanProblema; salvar(); } };
}
export function migrarPausaScan() {
  const c = E().config;
  if (c.scanPausaMigrada) return;
  c.scanPausaMigrada = 1; c.scanPausado = true; delete c.scanProblema; salvar();
}

export function fecharScan(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camada) return;
  const c = camada; camada = null;
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}

// o resumo das metas do Scanner, para o "Meu dia" (só deste aparelho: não sincroniza)
function guardarResumoScan(r) {
  if (!r) return;
  const c = E().config, novo = { dia: r.dia, metaRev: r.metaRev, feitasRev: r.feitasRev, metaNum: r.metaNum, feitasNum: r.feitasNum };
  if (JSON.stringify(c.scanResumo) === JSON.stringify(novo)) return;
  c.scanResumo = novo; salvar();
}

// Músicas: camada própria (telaMusicas.js, estilo em musicas.css)
export async function abrirMusicas() {
  fecharHome(); fecharScan(false); fecharLeitura(false); fecharXadrez(false); fecharFinancas(false); fecharClima(false); fecharCofre(false); fecharEva(false);
  E().config.area = "musicas"; salvar();
  if (camadaMu) return;
  if (!document.querySelector('link[href="musicas.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "musicas.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirTelaMusicas } = await import("./musicas/telaMusicas.js");
  camadaMu = document.createElement("div"); camadaMu.className = "camada-musicas";
  document.body.append(camadaMu);
  abrirTelaMusicas(camadaMu, { aoTrocarArea: escolherArea, logo: icone(LOGO_MUSICAS), aoVencimentos: guardarVencimentos });
}
// Músicas: quando vence a conferência de cada artista completo (3 meses), para o lembrete de domingo (notificacoes.js)
function guardarVencimentos(l) {
  const c = E().config, novo = (l || []).slice(0, 400);
  if (JSON.stringify(c.musicasVencem || []) === JSON.stringify(novo)) return;
  c.musicasVencem = novo; salvar(); reagendar();
}
async function tocarMusicasAoAbrir() { const T = await import("./musicas/telaMusicas.js"); T.tocarAoAbrir(); }
/** Abre a retrospectiva do mês das Músicas (da tela da Temporada). */
export async function abrirRetrospectivaMusicas(mes) {
  const T = await import("./musicas/telaMusicas.js");
  T.abrirRetrospectiva(mes);
  await abrirMusicas();
}
export function fecharMusicas(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camadaMu) return;
  const c = camadaMu; camadaMu = null;
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}
// Leitura: camada própria (leitura/telaLeitura.js, estilo em leitura.css)
export async function abrirLeitura() {
  fecharHome(); fecharScan(false); fecharMusicas(false); fecharXadrez(false); fecharFinancas(false); fecharClima(false); fecharCofre(false); fecharEva(false);
  E().config.area = "leitura"; salvar();
  if (camadaLe) return;
  if (!document.querySelector('link[href="leitura.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "leitura.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirTelaLeitura } = await import("./leitura/telaLeitura.js");
  camadaLe = document.createElement("div"); camadaLe.className = "camada-leitura";
  document.body.append(camadaLe);
  abrirTelaLeitura(camadaLe, { aoTrocarArea: escolherArea, logo: icone(LOGO_LEITURA) });
}
export function fecharLeitura(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camadaLe) return;
  const c = camadaLe; camadaLe = null;
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}
// Xadrez: camada própria (xadrez/telaXadrez.js, estilos em xadrez.css e xadrez-pecas.css)
export async function abrirXadrez() {
  fecharHome(); fecharScan(false); fecharMusicas(false); fecharLeitura(false); fecharFinancas(false); fecharClima(false); fecharCofre(false); fecharEva(false);
  E().config.area = "xadrez"; salvar();
  if (camadaXz) return;
  for (const css of ["xadrez.css", "xadrez-pecas.css", "vendor/pecas/pecas.css"]) if (!document.querySelector(`link[href="${css}"]`)) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = css; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirTelaXadrez } = await import("./xadrez/telaXadrez.js");
  camadaXz = document.createElement("div"); camadaXz.className = "camada-xadrez";
  document.body.append(camadaXz);
  abrirTelaXadrez(camadaXz, { aoTrocarArea: escolherArea, logo: icone(LOGO_XADREZ) });
}
export function fecharXadrez(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camadaXz) return;
  const c = camadaXz; camadaXz = null;
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}
// Finanças: camada própria (financas/telaFinancas.js, estilo em financas.css)
export async function abrirFinancas() {
  fecharHome(); fecharScan(false); fecharMusicas(false); fecharLeitura(false); fecharXadrez(false); fecharClima(false); fecharCofre(false); fecharEva(false);
  E().config.area = "financas"; salvar();
  if (camadaFi) return;
  if (!document.querySelector('link[href="financas.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "financas.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirTelaFinancas } = await import("./financas/telaFinancas.js");
  camadaFi = document.createElement("div"); camadaFi.className = "camada-financas";
  document.body.append(camadaFi);
  await abrirTelaFinancas(camadaFi, { aoTrocarArea: escolherArea, logo: icone(LOGO_FINANCAS) });
}
export function fecharFinancas(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camadaFi) return;
  const c = camadaFi; camadaFi = null;
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}
// Clima: camada própria (clima/telaClima.js, estilo em clima.css; pedido do Alediov em 02/11/2026)
export async function abrirClima() {
  fecharHome(); fecharScan(false); fecharMusicas(false); fecharLeitura(false); fecharXadrez(false); fecharFinancas(false); fecharCofre(false); fecharEva(false);
  E().config.area = "clima"; salvar();
  if (camadaCl) return;
  if (!document.querySelector('link[href="clima.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "clima.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirTelaClima } = await import("./clima/telaClima.js");
  camadaCl = document.createElement("div"); camadaCl.className = "camada-clima";
  document.body.append(camadaCl);
  await abrirTelaClima(camadaCl, { aoTrocarArea: escolherArea, logo: icone(LOGO_CLIMA) });
}
export function fecharClima(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camadaCl) return;
  const c = camadaCl; camadaCl = null;
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}
// Cofre: camada própria (cofre/telaCofre.js, estilo em cofre.css; pedido do Alediov em 04/11/2026). Sair da área fecha o
// cofre (a chave sai da memória).
export async function abrirCofre() {
  fecharHome(); fecharScan(false); fecharMusicas(false); fecharLeitura(false); fecharXadrez(false); fecharFinancas(false); fecharClima(false); fecharEva(false);
  E().config.area = "cofre"; salvar();
  if (camadaCf) return;
  if (!document.querySelector('link[href="cofre.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "cofre.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirTelaCofre } = await import("./cofre/telaCofre.js");
  camadaCf = document.createElement("div"); camadaCf.className = "camada-cofre";
  document.body.append(camadaCf);
  document.documentElement.classList.add("cf-cobre");
  await abrirTelaCofre(camadaCf, { aoTrocarArea: escolherArea, logo: icone(LOGO_COFRE) });
}
export function fecharCofre(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camadaCf) return;
  const c = camadaCf; camadaCf = null;
  document.documentElement.classList.remove("cf-cobre");
  import("./cofre/telaCofre.js").then(m => m.sairDoCofre()).catch(() => {});
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}
// Mensagens (antes "Eva"; o nome interno "eva" fica): camada própria (eva/telaMensagens.js, estilo em eva.css; pedidos do
// Alediov de 04/11/2026): a lista de conversas com a Eva (a companheira de rotina e estudos, eva/telaEva.js) e os grupos
// do WhatsApp (só leitura). `o.conversa`: "lista", "eva" ou "g:<chave do grupo>"; sem ela, a lista (ou fica onde está,
// se Mensagens já está aberta). Os botões da Eva levam aos itens do Meu dia (irParaItem).
export async function abrirEva(o = {}) {
  fecharHome(); fecharScan(false); fecharMusicas(false); fecharLeitura(false); fecharXadrez(false); fecharFinancas(false); fecharClima(false); fecharCofre(false);
  E().config.area = "eva"; salvar();
  if (camadaEv) { if (o.conversa) (await import("./eva/telaMensagens.js")).mostrar(o.conversa); return; }
  if (!document.querySelector('link[href="eva.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "eva.css"; document.head.append(l);
    await new Promise(ok => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  }
  const { abrirMensagens } = await import("./eva/telaMensagens.js");
  camadaEv = document.createElement("div"); camadaEv.className = "camada-eva";
  document.body.append(camadaEv);
  await abrirMensagens(camadaEv, { aoTrocarArea: escolherArea, logo: icone(LOGO_MENSAGENS), irParaItem: (ir) => irParaItem(ir), conversa: o.conversa });
}
export function fecharEva(voltar = true) {
  if (voltar) { E().config.area = "learn"; salvar(); }
  if (!camadaEv) return;
  const c = camadaEv; camadaEv = null;
  import("./eva/telaMensagens.js").then(m => m.sairDeMensagens(c)).catch(() => {});
  document.documentElement.classList.remove("eva-cobre");
  c.style.transition = "opacity .2s"; c.style.opacity = "0";
  setTimeout(() => c.remove(), 200);
}
// Clima: o tempo para a Home e os widgets ao abrir o app e ao voltar a ele (no máximo a cada 30 min)
async function climaNoFundo() {
  if (DEMO_AREAS) return;
  // o tempo de cada hora fica guardado para as estatísticas das Músicas (mesmo sem rede: o que estiver em cache)
  const arquivar = () => import("./musicas/tempoOuvindo.js").then(T => { T.ligarArquivo(); T.arquivarHoras(); }).catch(() => {});
  if (!navigator.onLine) return arquivar();
  try { const D = await import("./clima/dados.js"); await D.atualizarNoFundo(); } catch (e) { console.warn("Clima: fundo", e.message); }
  arquivar();
}
// Finanças: o registro das macros (issue do MacroDroid) ao voltar para o app, se a issue já está ligada (no máximo a cada 5 min)
async function lerFinancas() {
  if (!E().financas || !navigator.onLine) return;
  try { const P = await import("./financas/ponte.js"); await P.lerSeConectado(); await P.conferirParado(); } catch (e) { console.warn("Finanças: leitura", e.message); } // e o dinheiro parado fora do Render (id 980)
  // Testes de mercado: avisos de liquidação e de carteira que entra ou sai (desligados por padrão; id 978)
  try { if (/"avisos":true/.test(localStorage.getItem("orbita.testes.sel") || "")) await (await import("./financas/testes/avisos.js")).verificar(); } catch (e) { console.warn("Testes: avisos", e.message); }
}
const irPara = (a) => (contarUso(a), a === "scan" ? abrirScan() : a === "musicas" ? abrirMusicas() : a === "leitura" ? abrirLeitura() : a === "xadrez" ? abrirXadrez() : a === "financas" ? abrirFinancas() : a === "clima" ? abrirClima() : a === "cofre" ? abrirCofre() : a === "eva" ? abrirEva() : (fecharHome(), fecharScan(), fecharMusicas(), fecharLeitura(), fecharXadrez(), fecharFinancas(), fecharClima(), fecharCofre(), fecharEva()));

const DEMO_AREAS = false;
const IR_ALARMES = { area: "learn", tela: "agenda", rolar: ".alarmes-sec" };
/** Vai a um item do "Meu dia": a área e, nos Estudos, a tela e a aba da trilha. */
async function irParaItem(ir) {
  if (ir.acao === "foco") { (await import("./foco.js")).abrirFoco(); return; }
  if (ir.acao === "ajustes") { (await import("./ajustes.js")).abrirAjustes(); return; }
  if (ir.area === "scan") { await abrirScan({ direto: true }); return; } // itens do Meu dia vão direto ao projeto
  if (ir.area === "eva") { contarUso("eva"); await abrirEva({ conversa: ir.conversa || "lista" }); return; } // Mensagens: a lista ou uma conversa
  if (ir.area !== "learn") { await irPara(ir.area); return; }
  irPara("learn");
  if (ir.aba) { E().config.abaTrilha = ir.aba; salvar(); }
  window.dispatchEvent(new CustomEvent("oq-ir", { detail: ir.tela || "trilha" }));
  if (ir.rolar) setTimeout(() => document.querySelector(ir.rolar)?.scrollIntoView({ block: "center", behavior: "smooth" }), 900);
}
/** Gravação das aulas (gravacao/gravacao.js): a pílula e as notificações abrem "Aulas gravadas" nos Estudos. */
export const irParaAulas = () => irParaItem({ area: "learn", tela: "aulas" });
/** A Home do Órbita (home.js): o botão do topo dos Estudos e o "Trocar de Área" das outras áreas abrem a Home, com
 *  os 5 subapps e o "Meu dia" (antes era um seletor num modal). */
export function escolherArea(inicio = false) {
  if (camadaCf) import("./cofre/cofre.js").then(m => m.fechar()).catch(() => {}); // a Home por cima fecha o cofre
  // na abertura, nenhuma área está "aberta" (os Estudos só ficam por baixo)
  const atual = inicio === true ? null : camada ? "scan" : camadaMu ? "musicas" : camadaLe ? "leitura" : camadaXz ? "xadrez" : camadaFi ? "financas" : camadaCl ? "clima" : camadaCf ? "cofre" : camadaEv ? "eva" : "learn";
  return abrirHome({
    atual, irPara, irParaItem: (ir) => irParaItem(ir),
    // fechar a Home da abertura deixa nos Estudos (que estão por baixo)
    aoFechar: () => { if (!camada && !camadaMu && !camadaLe && !camadaXz && !camadaFi && !camadaCl && !camadaCf && !camadaEv && E().config.area !== "learn") { E().config.area = "learn"; salvar(); } },
    logos: { orbita: icone(LOGO_ORBITA), learn: icone(LOGO_LEARN), scan: icone(LOGO_SCAN), musicas: icone(LOGO_MUSICAS), leitura: icone(LOGO_LEITURA), xadrez: icone(LOGO_XADREZ), financas: icone(LOGO_FINANCAS), clima: icone(LOGO_CLIMA), cofre: icone(LOGO_COFRE), eva: icone(LOGO_MENSAGENS) },
  });
}
// A área pedida ao abrir (widget ou notificação das Músicas): o plugin a entrega uma vez só, então a Home da abertura
// (homeAoIniciar, chamada logo no começo do main.js) e o iniciarAreas leem a mesma resposta.
let pedidaInicial = null;
const areaInicial = () => (pedidaInicial ||= areaDoWidget());
let homeNaAbertura = false;
/** Abertura fria: mostra a Home (config.abrirEm "home", o padrão) se nenhum widget pediu uma área. */
export async function homeAoIniciar() {
  const pedida = await areaInicial();
  if (pedida === "meudia" || (!pedida && (E().config.abrirEm || "home") === "home")) { homeNaAbertura = true; escolherArea(true); }
}

/** Tocar na notificação dos artistas a conferir abre as Músicas nesse filtro. */
function ligarToqueNotificacoes() {
  if (!Capacitor.isNativePlatform?.()) return;
  try {
    registerPlugin("LocalNotifications").addListener("localNotificationActionPerformed", async (a) => {
      const ar = a?.notification?.extra?.area;
      if (ar === "leitura") { abrirLeitura(); return; }
      if (ar === "scan") { abrirScan({ direto: true }); return; } // o computador do laboratório parou (leitorDoScanner, id 977)
      if (ar === "financas:testes") { await abrirFinancas(); (await import("./financas/telaFinancas.js")).irPara({ aba: "testes" }); return; } // avisos dos Testes (id 978)
      if (ar === "financas") { abrirFinancas(); return; } // aviso das 9h da macro do Slice (notificacoes.js, id 976) e o dinheiro parado (id 980)
      if (ar === "clima") { abrirClima(); return; } // chuva na ida ou na volta (clima/dados.js, id 979)
      if (ar === "eva") { abrirEva({ conversa: "eva" }); return; } // mensagens programadas da Eva (eva/programadas.js, ids 5000–5040): a conversa dela em Mensagens
      if (ar === "agenda:alarmes") { fecharHome(); irParaItem(IR_ALARMES); return; } // aviso da véspera dos alarmes (alarmes.js)
      if (ar === "gravar") { fecharHome(); irPara("learn"); import("./gravacao/gravacao.js").then(m => m.aoTocarNotificacao(a)); return; } // "Gravar <aula>?"
      if (ar !== "musicas:conferir") return;
      await abrirMusicas();
      const T = await import("./musicas/telaMusicas.js"); T.abrirAConferir();
    });
  } catch (e) { console.warn("notificações: toque", e); }
}
// Scanner: o computador do laboratório parou por um problema (Ollama, calor, disco, falhas) ou sumiu (lendo e sem notícia
// há 90 min): aviso na hora e item no Meu dia (29/10/2026, sugestão aceita pelo Alediov). Lê o leitor.json do repositório
// (só o estado do leitor, nada das fichas) ao abrir e ao voltar para o app, no máximo a cada 30 min.
let ultimoLeitorScan = 0;
async function leitorDoScanner() {
  const c = E().config;
  if (c.scanPausado) { if (c.scanProblema) { delete c.scanProblema; salvar(); } return; }
  if (DEMO_AREAS || !Capacitor.isNativePlatform?.() || !c.token || !navigator.onLine || Date.now() - ultimoLeitorScan < 30 * 60e3) return;
  ultimoLeitorScan = Date.now();
  try {
    const C = await import("./scan/controleLeitor.js");
    const p = C.problemaDoLeitor(await C.lerSituacao({ token: c.token, repo: c.repo || "" }));
    if (!p) { if (c.scanProblema) { delete c.scanProblema; salvar(); } return; }
    if (c.scanProblema?.chave === p.chave) return;
    c.scanProblema = { ...p, em: new Date().toISOString() }; salvar();
    avisarAgora({ id: 977, title: p.titulo, body: p.texto, extra: { area: "scan" } });
  } catch (e) { console.warn("Scanner: situação do computador", e.message); }
}
let ultimaNovidade = 0;
async function novidadesLeitura() {
  if (DEMO_AREAS || Date.now() - ultimaNovidade < 3600000 || !navigator.onLine) return;
  ultimaNovidade = Date.now();
  try { const T = await import("./leitura/telaLeitura.js"); await T.verificarNovidades({ notificar: !camadaLe }); } catch (e) { console.warn("Leitura: novidades", e.message); }
}
export async function iniciarAreas() {
  ligarToqueNotificacoes();
  migrarPausaScan();
  const chip = document.getElementById("chip-area");
  if (chip) { chip.innerHTML = icone(LOGO_ORBITA); chip.setAttribute("aria-label", "Home do Órbita"); chip.onclick = escolherArea; }
  let pedida = await areaInicial(); // tocou num widget (Scanner ou ofensiva) ou na notificação das Músicas
  // o relógio da barra de status (próximo alarme do Órbita) abre a Agenda nos alarmes
  if (pedida === "agenda:alarmes") { pedida = "learn"; fecharHome(); setTimeout(() => irParaItem(IR_ALARMES), 400); }
  if (pedida === "gravacao") { pedida = "learn"; fecharHome(); setTimeout(irParaAulas, 400); } // notificação da gravação da aula
  if (pedida === "meudia") { pedida = "learn"; if (!homeAberta()) escolherArea(); } // widget "Meu dia": abre a Home com ele
  const tocar = pedida === "musicas:tocar"; // play do widget das Músicas com o tocador parado
  if (tocar) pedida = "musicas";
  if (pedida) E().config.area = ["scan", "musicas", "financas", "clima", "eva"].includes(pedida) ? pedida : "learn";
  // com a Home na abertura, os Estudos ficam por baixo e a área só abre quando ele escolher na Home
  if (homeNaAbertura && !pedida) setTimeout(enviarFichasEmSegundoPlano, 20000);
  else if (E().config.area === "scan") abrirScan({ direto: !!E().config.icProjeto || !!pedida });
  else if (E().config.area === "leitura") { abrirLeitura(); setTimeout(enviarFichasEmSegundoPlano, 20000); }
  else if (E().config.area === "xadrez") { abrirXadrez(); setTimeout(enviarFichasEmSegundoPlano, 20000); }
  else if (E().config.area === "musicas") { abrirMusicas().then(() => tocar && tocarMusicasAoAbrir()); setTimeout(enviarFichasEmSegundoPlano, 20000); }
  else if (E().config.area === "financas") { abrirFinancas(); setTimeout(enviarFichasEmSegundoPlano, 20000); }
  else if (E().config.area === "clima") { abrirClima(); setTimeout(enviarFichasEmSegundoPlano, 20000); }
  else if (E().config.area === "cofre") { abrirCofre(); setTimeout(enviarFichasEmSegundoPlano, 20000); }
  else if (E().config.area === "eva") { abrirEva(); setTimeout(enviarFichasEmSegundoPlano, 20000); }
  else setTimeout(enviarFichasEmSegundoPlano, 20000);
  // Cada envio leva ~1 s (o GitHub limita a ~80 por minuto) e o Android pausa o app quando ele sai da tela: a fila
  // enchia só até onde dava antes de fechar (em 21/10/2026 subiram 19 de 116). Enquanto o app está aberto, confere de
  // novo a cada 3 min e ao voltar para a tela, continuando de onde parou.
  setInterval(enviarFichasEmSegundoPlano, 180000);
  // Leitura: capítulos e unidades traduzidos de madrugada (aviso quando o índice cresce), 30 s depois de abrir e ao
  // voltar para o app, no máximo de hora em hora
  setTimeout(novidadesLeitura, 30000);
  setTimeout(leitorDoScanner, 40000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(leitorDoScanner, 10000); });
  setTimeout(lerFinancas, 12000);
  setTimeout(climaNoFundo, 15000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !camadaCl) setTimeout(climaNoFundo, 7000); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !camadaFi) setTimeout(lerFinancas, 6000); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(novidadesLeitura, 8000); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(enviarFichasEmSegundoPlano, 5000); });
  // com o app já aberto, o toque no widget só traz o app de volta: troca a área aqui
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    const a = await areaDoWidget();
    if (a === "scan" && !camada) abrirScan({ direto: true });
    else if (a === "musicas:tocar") { await abrirMusicas(); tocarMusicasAoAbrir(); }
    else if (a === "musicas" && !camadaMu) abrirMusicas();
    else if (a === "financas" && !camadaFi) abrirFinancas();
    else if (a === "clima" && !camadaCl) abrirClima();
    else if (a === "eva" && !camadaEv) abrirEva();
    else if (a === "learn") { fecharHome(); if (camada || camadaMu || camadaLe || camadaXz || camadaFi || camadaCl || camadaCf || camadaEv) { fecharScan(); fecharMusicas(); fecharLeitura(); fecharXadrez(); fecharFinancas(); fecharClima(); fecharCofre(); fecharEva(); } }
    else if (a === "meudia" && !homeAberta()) escolherArea();
    else if (a === "agenda:alarmes") { fecharHome(); irParaItem(IR_ALARMES); }
    else if (a === "gravacao") { fecharHome(); irParaAulas(); }
  });
}

// Ao abrir o app para estudar, as fichas que esperam no aparelho sobem para a fila cifrada, aos poucos
// (até o tamanho que a leitura da madrugada dá conta). Só roda se o OdontoScan já tem fichas e o envio
// automático está ligado.
async function enviarFichasEmSegundoPlano() {
  // desde 29/10/2026 o celular não manda mais fichas para leitura: tudo é lido e conferido no computador do laboratório
  if (Capacitor.isNativePlatform?.()) return;
  try {
    const c = E().config;
    if (!c.token || !navigator.onLine || document.visibilityState !== "visible") return;
    const BD = await import("./scan/banco.js");
    if ((await BD.lerCfg("autoEnviar")) === false || !(await BD.lerCfg("dispositivo"))) return;
    const N = await import("./scan/nuvem.js");
    N.definirGithub({ token: c.token, repo: c.repo || "" });
    const r = await N.completarFila();
    if (r) avisarFila(r.naFila, r);
    if (r?.enviadas) console.info(`OdontoScan: ${r.enviadas} fichas para a fila em segundo plano`);
  } catch (e) { console.warn("OdontoScan: envio em segundo plano", e.message); }
}
