// Backup das músicas no Google Drive (pedido do Alediov, 02/11/2026; escolha dele: backup automático pelo app, para
// uma pasta do Drive privado da conta secundária). Passo a passo para criar o cliente no Google Cloud em
// docs/drive-musicas.md.
//
// - Conta: OAuth 2.0 para dispositivos (o app mostra um código; ele o digita em google.com/device em qualquer
//   aparelho), escopo drive.file (o app só vê o que ele mesmo criou). O ID do cliente, a chave secreta e o refresh token
//   ficam SÓ no aparelho, nos arquivos do plugin nativo (DriveMusicas.java: getNoBackupFilesDir): nada disso passa por
//   estado.js (que sincroniza com o GitHub) nem pela pasta .orbita.
// - O que vai: drivePlano.js compara a biblioteca (caminho, tamanho e data de cada arquivo) com o mapa do que já está
//   no Drive: novas, que mudaram (estrelas e tags gravadas no arquivo também), que só mudaram de lugar, e a
//   biblioteca.json da .orbita; os apagados no celular só saem do Drive com "espelhar apagados".
// - Quem envia: o DriveMusicasService (upload resumível em pedaços de 8 MB, primeiro plano, segue com a tela apagada).
//   Começa ao abrir as Músicas, se houver o que enviar e as condições valerem (Wi-Fi, carregador), e pelo "Fazer backup
//   agora"; Pausar segura até ele tocar em Continuar.
// - No navegador (notebook, teste de fumaça) o backup não roda: um motor de mentira mostra a tela.
import { registerPlugin } from "../../vendor/capacitor-core.js";
import { nativo } from "./motor.js";
import * as B from "./biblioteca.js";
import { planoBackup, tamanho, cortarPeloEspaco } from "./drivePlano.js";
import { modal, toast, escapar } from "../ui.js";
export { planoBackup };

const D = nativo ? registerPlugin("DriveMusicas") : motorFalso();
export const deMentira = !nativo;
const BIBLIOTECA = ".orbita/biblioteca.json";

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const quando = (ms) => new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export async function situacao() { try { return await D.situacao(); } catch { return null; } }
async function lerMapa() { try { return JSON.parse((await D.mapa()).texto || "{}"); } catch { return {}; } }

/** O plano de agora: a biblioteca × o mapa do Drive. */
export async function montarPlano(s = null) {
  s = s || await situacao();
  const faixas = await B.listaFaixas(), mapa = await lerMapa();
  const guardado = await B.guardadoNaPasta().catch(() => null);
  const extras = guardado ? [{ caminho: BIBLIOTECA, m: guardado }] : [];
  return planoBackup({ faixas, mapa, extras, opcoes: s?.opcoes || {} });
}

const podeAgora = (s) => {
  const op = s.opcoes || {};
  if (op.soWifi !== false ? !s.wifi : !s.rede) return op.soWifi !== false ? "Sem Wi-Fi agora." : "Sem internet agora.";
  if (op.soCarregando && !s.carregando) return "O celular não está carregando.";
  return "";
};

async function comecar(plano) {
  const p = await B.pasta();
  if (!p?.uri) throw new Error("Escolha primeiro a pasta das músicas.");
  const q = await D.cota().catch(() => null);
  const { plano: cabe, cortadas, bytesFora } = cortarPeloEspaco(plano, q);
  try { localStorage.setItem("mu.drive.naoCabe", JSON.stringify(cortadas ? { n: cortadas, bytes: bytesFora, em: Date.now() } : null)); } catch { /* sem armazenamento */ }
  if (!cabe.itens.length && !cabe.apagar.length) throw new Error(`O Drive está cheio: ${cortadas} músicas (${tamanho(bytesFora)}) não cabem.`);
  return D.iniciar({ plano: JSON.stringify({ itens: cabe.itens, apagar: cabe.apagar, bytes: cabe.bytes }), arvore: p.uri });
}

let ultimaTentativa = 0;
/** Ao abrir as Músicas (depois de ler a pasta): começa sozinho se estiver conectado, sem pausa e com o que enviar. */
export async function talvezAoAbrir() {
  if (!nativo || Date.now() - ultimaTentativa < 10 * 60 * 1000) return;
  ultimaTentativa = Date.now();
  const s = await situacao();
  if (!s?.conectado || s.pausado || s.servico?.rodando || podeAgora(s)) return;
  const plano = await montarPlano(s);
  if (plano.itens.length + plano.apagar.length) await comecar(plano).catch(() => {});
}

/** "Fazer backup agora" e "Continuar": monta o plano de novo e começa. */
export async function fazerAgora() {
  const s = await situacao();
  if (!s?.conectado) { toast("Conecte a conta do Google Drive."); return false; }
  if (s.servico?.rodando) return true;
  const plano = await montarPlano(s);
  if (!plano.itens.length && !plano.apagar.length) { toast("Tudo já está no Drive."); return false; }
  const motivo = podeAgora(s);
  if (motivo) toast(`${motivo} O backup começa assim que der.`, 3500);
  try { await comecar(plano); return true; } catch (e) { toast(e.message || "Não consegui começar o backup.", 4000); return false; }
}

// ---------------------------------------------------------------- a tela (Ajustes das Músicas → Backup no Drive)
let ouvindo = false, raizAtual = null, aoMudarTela = null, codigoAberto = null;
function ouvir() {
  if (ouvindo) return;
  ouvindo = true;
  D.addListener("andamento", (e) => {
    const box = document.querySelector(".mu-drive");
    if (e?.refazer && !e.rodando) { ultimaTentativa = 0; fazerAgora(); } // a pasta do Drive sumiu: manda tudo de novo
    if (box?.isConnected) pintarAndamento(box, e);
    if (box?.isConnected && !e.rodando) aoMudarTela?.();
  });
  D.addListener("conexao", (e) => {
    codigoAberto = null;
    if (e.estado === "ok") toast("Conta do Drive conectada.");
    else toast(e.motivo || "Não deu para conectar.", 4500);
    aoMudarTela?.();
  });
}

function pintarAndamento(box, e) {
  const a = box.querySelector(".mu-dr-andamento");
  if (!a || !e?.rodando) return;
  a.hidden = false;
  const pct = e.total ? Math.round(Math.min(e.feitos, e.total) / e.total * 100) : 0;
  a.querySelector(".mu-dr-n").textContent = `${fmt(Math.min(e.feitos + 1, e.total))} de ${fmt(e.total)}`;
  a.querySelector(".mu-dr-fase").textContent = e.fase && e.fase !== "Enviando" ? e.fase : (e.atual || "");
  a.querySelector(".mu-dr-barra i").style.width = `${pct}%`;
}

function chave(rotulo, on, aoMudar) {
  const l = document.createElement("div"); l.className = "linha-cfg mu-dr-op";
  l.innerHTML = `<span></span>`; l.querySelector("span").textContent = rotulo;
  const b = document.createElement("button"); b.className = `chave ${on ? "on" : ""}`; b.setAttribute("aria-label", rotulo); b.setAttribute("aria-pressed", String(!!on));
  b.onclick = async () => { const v = !b.classList.contains("on"); b.classList.toggle("on", v); b.setAttribute("aria-pressed", String(v)); await aoMudar(v); };
  l.append(b);
  return l;
}

/**
 * Desenha a tela em `tela` (o cabeçalho com Voltar já está lá). `redesenhar` refaz a tela inteira (telaMusicas).
 */
export async function telaDrive(tela, { redesenhar } = {}) {
  ouvir();
  aoMudarTela = redesenhar;
  const s = (await situacao()) || {};
  const box = document.createElement("div"); box.className = "mu-drive";
  tela.append(box);
  raizAtual = s.raiz || null;

  // ---- conta
  const conta = document.createElement("section"); conta.className = "mu-dr-cartao mu-dr-conta";
  box.append(conta);
  if (!s.temCliente) {
    conta.innerHTML = `<h3>Conta do Google</h3>
      <label class="campo">ID do cliente<input type="text" class="mu-dr-id" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="….apps.googleusercontent.com"></label>
      <label class="campo">Chave secreta<input type="password" class="mu-dr-seg" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <button class="botao mu-dr-salvar">Salvar</button>`;
    conta.querySelector(".mu-dr-salvar").onclick = async () => {
      const id = conta.querySelector(".mu-dr-id").value.trim(), seg = conta.querySelector(".mu-dr-seg").value.trim();
      if (!/\.apps\.googleusercontent\.com$/.test(id) || seg.length < 10) { toast("Confira o ID do cliente (termina em .apps.googleusercontent.com) e a chave secreta.", 4500); return; }
      try { await D.definirCliente({ clientId: id, clientSecret: seg }); redesenhar?.(); } catch (e) { toast(e.message, 4000); }
    };
    return;
  }
  if (!s.conectado) {
    const esperando = codigoAberto && s.esperandoConta !== false;
    conta.innerHTML = `<h3>Conta do Google</h3>${s.reconectar ? `<p class="mu-aviso mu-dr-reconectar"><b>Conecte a conta de novo</b></p>` : ""}
      ${esperando ? `<div class="mu-dr-codigo"><small>Em google.com/device, digite</small><b>${escapar(codigoAberto.codigo)}</b>
        <div class="mu-dr-bts"><button class="botao mu-dr-abrir">Abrir google.com/device</button><button class="botao secundario mu-dr-copiar">Copiar o código</button></div>
        <p class="mu-dr-esperando"><i class="mu-dr-ponto"></i>Esperando a autorização…</p><button class="link mu-dr-cancelar">Cancelar</button></div>`
        : `<button class="botao mu-dr-conectar">Conectar</button>`}
      <button class="link mu-dr-trocar">Trocar o ID do cliente</button>`;
    conta.querySelector(".mu-dr-conectar")?.addEventListener("click", async (ev) => {
      ev.currentTarget.disabled = true;
      try { codigoAberto = await D.conectar(); } catch (e) { toast(e.message || "Não consegui falar com o Google.", 4500); }
      redesenhar?.();
    });
    conta.querySelector(".mu-dr-abrir")?.addEventListener("click", () => abrirFora(codigoAberto.url || "https://www.google.com/device"));
    conta.querySelector(".mu-dr-copiar")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(codigoAberto.codigo); toast("Código copiado."); } catch { toast(codigoAberto.codigo); } });
    conta.querySelector(".mu-dr-cancelar")?.addEventListener("click", async () => { codigoAberto = null; await D.cancelarConexao(); redesenhar?.(); });
    conta.querySelector(".mu-dr-trocar").onclick = () => trocarCliente(redesenhar);
    return;
  }
  conta.innerHTML = `<div class="mu-dr-linha"><i class="mu-dr-ok">✓</i><span><b>Conectado</b><small>${s.conectadoEm ? `desde ${quando(s.conectadoEm)}` : ""}</small></span><button class="mu-icone mu-dr-menu" aria-label="Opções da conta"></button></div>
    <p class="mu-dr-cota" hidden></p>`;
  conta.querySelector(".mu-dr-menu").innerHTML = '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>';
  conta.querySelector(".mu-dr-menu").onclick = () => menuConta(redesenhar);
  D.cota().then(q => { const p = conta.querySelector(".mu-dr-cota"); if (p && q?.limite) { p.textContent = `Drive: ${tamanho(q.usado)} de ${tamanho(q.limite)}`; p.hidden = false; } }).catch(() => {});

  // ---- situação
  const est = document.createElement("section"); est.className = "mu-dr-cartao mu-dr-estado";
  box.append(est);
  const plano = s.servico?.rodando ? null : await montarPlano(s);
  const falta = plano ? plano.itens.length + plano.apagar.length : s.pendentes;
  est.innerHTML = `<div class="mu-dr-nums">
      <div><b>${fmt(s.noDrive)}</b><small>no Drive · ${tamanho(s.bytesNoDrive)}</small></div>
      <div class="${falta ? "falta" : ""}"><b>${fmt(falta || 0)}</b><small>${plano ? `faltam · ${tamanho(plano.bytes)}` : "faltam"}</small></div>
    </div>
    ${(() => { let nc = null; try { nc = JSON.parse(localStorage.getItem("mu.drive.naoCabe") || "null"); } catch { /* nada */ } return nc?.n ? `<p class="mu-aviso mu-dr-naocabe"><b>${fmt(nc.n)} não cabem no Drive</b><small>${tamanho(nc.bytes)} a mais que o espaço livre: ficam para quando houver espaço.</small></p>` : ""; })()}
    ${s.ultimo?.em ? `<p class="mu-dr-ultimo">Último backup: ${quando(s.ultimo.em)} · ${fmt(s.ultimo.enviados)} ${s.ultimo.enviados === 1 ? "enviada" : "enviadas"}${s.ultimo.erros ? ` · ${fmt(s.ultimo.erros)} com erro` : ""}</p>` : ""}
    <div class="mu-dr-andamento" ${s.servico?.rodando ? "" : "hidden"}><div class="mu-dr-andlinha"><b class="mu-dr-n"></b><small class="mu-dr-fase"></small></div><div class="mu-dr-barra"><i></i></div></div>
    ${s.servico?.erro || s.ultimo?.erro ? `<p class="mu-aviso mu-dr-erro"><small></small></p>` : ""}
    ${plano?.avisos?.includes("muitos") ? `<p class="mu-aviso mu-dr-muitos"><b>${fmt(plano.orfaos)} sumiram do celular</b><small>Nenhuma saiu do Drive.</small></p>` : ""}
    <div class="mu-dr-bts mu-dr-acoes"></div>`;
  const er = est.querySelector(".mu-dr-erro small"); if (er) er.textContent = s.servico?.erro || s.ultimo?.erro;
  if (s.servico?.rodando) pintarAndamento(est, s.servico);
  const acoes = est.querySelector(".mu-dr-acoes");
  const bt = (cls, tx, fn) => { const b = document.createElement("button"); b.className = `botao ${cls}`; b.textContent = tx; b.onclick = fn; acoes.append(b); return b; };
  if (s.servico?.rodando) bt("secundario mu-dr-pausar", "Pausar", async () => { await D.pausar(); toast("Pausado."); setTimeout(() => redesenhar?.(), 600); });
  else if (s.pausado && falta) bt("mu-dr-continuar", "Continuar", async () => { if (await fazerAgora()) setTimeout(() => redesenhar?.(), 500); });
  else bt("mu-dr-agora", "Fazer backup agora", async (ev) => { ev.currentTarget.disabled = true; if (await fazerAgora()) setTimeout(() => redesenhar?.(), 500); else ev.currentTarget.disabled = false; });
  if (s.raiz) bt("secundario mu-dr-pasta", "Abrir no Drive", () => abrirFora(`https://drive.google.com/drive/folders/${encodeURIComponent(s.raiz)}`));

  // ---- opções
  const op = document.createElement("section"); op.className = "mu-dr-cartao mu-dr-opcoes";
  const o = s.opcoes || {};
  const mudar = (k) => async (v) => { await D.definirOpcoes({ [k]: v }); if (k === "espelharApagados") redesenhar?.(); };
  op.append(chave("Só no Wi-Fi", o.soWifi !== false, mudar("soWifi")), chave("Só carregando", !!o.soCarregando, mudar("soCarregando")), chave("Espelhar apagados", !!o.espelharApagados, mudar("espelharApagados")));
  box.append(op);
}

function abrirFora(url) {
  if (nativo) D.abrir({ url }).catch(() => window.open(url, "_blank"));
  else window.open(url, "_blank", "noopener");
}

async function trocarCliente(redesenhar) {
  const v = await modal({ titulo: "Trocar o ID do cliente?", texto: "A conta sai e o ID e a chave são apagados deste celular. O que já está no Drive fica.", botoes: [{ texto: "Trocar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
  if (!v) return;
  codigoAberto = null;
  await D.desconectar({ cliente: true });
  redesenhar?.();
}

async function menuConta(redesenhar) {
  const v = await modal({ titulo: "Conta do Google Drive", botoes: [
    { texto: "Desconectar", valor: "sair", classe: "secundario" },
    { texto: "Trocar o ID do cliente", valor: "cliente", classe: "secundario" },
    { texto: "Fechar", valor: null, classe: "secundario" }] });
  if (v === "sair") {
    const ok = await modal({ titulo: "Desconectar do Drive?", texto: "O backup para. O que já está no Drive fica lá.", botoes: [{ texto: "Desconectar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }] });
    if (ok) { await D.desconectar({ esquecer: false }); toast("Desconectado."); redesenhar?.(); }
  } else if (v === "cliente") trocarCliente(redesenhar);
}

// ---------------------------------------------------------------- motor de mentira (navegador)
// Só para ver e testar a tela no notebook: nada sai do navegador; o "envio" anda sozinho e grava o mapa no
// localStorage (mu.driveFalso). Nenhuma credencial de verdade é usada.
function motorFalso() {
  const CH = "mu.driveFalso";
  const ouvintes = { andamento: new Set(), conexao: new Set() };
  const emitir = (ev, o) => ouvintes[ev]?.forEach(fn => { try { fn(o); } catch { /* nada */ } });
  let st;
  try { st = JSON.parse(localStorage.getItem(CH) || "null"); } catch { st = null; }
  st = st || { cli: false, con: false, opcoes: { soWifi: true, soCarregando: false, espelharApagados: false }, mapa: { arquivos: {} }, ultimo: null, pausado: false, raiz: "" };
  const guardar = () => { try { localStorage.setItem(CH, JSON.stringify(st)); } catch { /* sem armazenamento */ } };
  let serv = { rodando: false, feitos: 0, total: 0, fase: "", atual: "" }, plano = null, prox = 0, timer = null, esperando = false;
  const contar = () => { const a = Object.values(st.mapa.arquivos); return [a.length, a.reduce((s, r) => s + (r.t || 0), 0)]; };
  const passo = () => {
    if (!plano || prox >= plano.itens.length + plano.apagar.length) {
      clearInterval(timer); timer = null;
      st.ultimo = { em: Date.now(), enviados: plano?.itens.length || 0, bytes: plano?.bytes || 0, erros: 0 };
      plano = null; prox = 0; serv = { ...serv, rodando: false, fase: "", atual: "" }; guardar(); emitir("andamento", { ...serv });
      return;
    }
    if (prox < plano.itens.length) {
      const it = plano.itens[prox];
      if (it.tipo === "mover") delete st.mapa.arquivos[it.de];
      st.mapa.arquivos[it.caminho] = { id: it.id || `falso-${Math.random().toString(36).slice(2, 10)}`, t: it.t, m: it.m, em: Date.now() };
      serv.atual = it.caminho.split("/").pop();
    } else delete st.mapa.arquivos[plano.apagar[prox - plano.itens.length].caminho];
    prox++; serv.feitos = prox; guardar(); emitir("andamento", { ...serv });
  };
  return {
    addListener: (ev, fn) => { ouvintes[ev]?.add(fn); return Promise.resolve({ remove: () => ouvintes[ev]?.delete(fn) }); },
    situacao: async () => {
      const [n, b] = contar();
      return { temCliente: st.cli, cliente: st.cli ? "123456789012…" : "", conectado: st.con, conectadoEm: st.conEm || 0, reconectar: false, esperandoConta: esperando,
        opcoes: { ...st.opcoes }, servico: { ...serv }, pausado: st.pausado, pendentes: plano ? plano.itens.length + plano.apagar.length - prox : 0,
        ultimo: st.ultimo, raiz: st.raiz, noDrive: n, bytesNoDrive: b, wifi: true, rede: true, carregando: false };
    },
    mapa: async () => ({ texto: JSON.stringify(st.mapa) }),
    definirCliente: async ({ clientId, clientSecret }) => { st.cli = !!(clientId && clientSecret); if (!st.cli) st.con = false; guardar(); },
    conectar: async () => {
      if (!st.cli) throw new Error("Cole primeiro o ID do cliente e a chave secreta.");
      esperando = true;
      setTimeout(() => { if (!esperando) return; esperando = false; st.con = true; st.conEm = Date.now(); st.raiz = st.raiz || "pasta-de-mentira"; guardar(); emitir("conexao", { estado: "ok" }); }, 1200);
      return { codigo: "WXYZ-KJTM", url: "https://www.google.com/device", expira: Date.now() + 1800e3 };
    },
    cancelarConexao: async () => { esperando = false; },
    desconectar: async ({ esquecer, cliente } = {}) => { st.con = false; if (cliente || esquecer) st.cli = false; if (esquecer) st.mapa = { arquivos: {} }; guardar(); },
    definirOpcoes: async (o) => { Object.assign(st.opcoes, o); guardar(); return { ...st.opcoes }; },
    cota: async () => ({ usado: 4.2e9, limite: 15e9 }),
    iniciar: async ({ plano: txt }) => {
      if (!st.con) throw new Error("Conecte a conta do Google Drive.");
      if (serv.rodando) return { rodando: true };
      plano = JSON.parse(txt || "null") || plano; prox = 0; st.pausado = false;
      serv = { rodando: true, feitos: 0, total: plano.itens.length + plano.apagar.length, fase: "Enviando", atual: "" };
      clearInterval(timer); timer = setInterval(passo, 120); emitir("andamento", { ...serv });
    },
    pausar: async () => { st.pausado = true; clearInterval(timer); timer = null; serv = { ...serv, rodando: false }; guardar(); emitir("andamento", { ...serv }); },
    abrir: async ({ url }) => { window.open(url, "_blank", "noopener"); },
  };
}
