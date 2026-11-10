// Músicas do celular para o tablet pelo Wi-Fi de casa (pedido do Alediov, 29/10/2026: "as músicas dos artistas que eu
// já dei um check… também viessem para o meu tablet"; escolhas dele: Wi-Fi de casa, o tablet fica IGUAL ao celular
// nesses artistas (o que for apagado ou editado no celular também é no tablet), e vão os artistas com ✓ e os que "não
// se aplica", como a pasta das versões, "Alediov").
//
// Celular: "Enviar para o tablet" abre o servidor (TransferenciaPlugin.servir) com a lista desses artistas e um código
// de 6 dígitos na tela. Tablet: "Receber do celular" acha o celular na rede (NSD) ou pelo endereço digitado, pede a
// lista com o código, mostra o plano (baixar N, apagar M) e, confirmado, baixa para a mesma subpasta da pasta das
// músicas dele, apaga o que o celular não tem mais, lê a pasta de novo e pega as estrelas, o coração e as tags de
// dentro dos arquivos. cfg `recebidos` {caminho: {t, m}} (tamanho e data do arquivo no celular) diz o que já veio.
import { registerPlugin } from "../../vendor/capacitor-core.js";
import { nativo } from "./motor.js";
import * as B from "./biblioteca.js";
import * as BD from "./banco.js";
import { modal, toast, escapar } from "../ui.js";
import { planoDeRecebimento } from "./espelho.js";
export { planoDeRecebimento };

const T = nativo ? registerPlugin("Transferencia") : null;
export const disponivel = () => !!T;

// ---------------------------------------------------------------- o que vai (celular)
/** { manifesto, uris }: os arquivos dos artistas com ✓ e "não se aplica", e os registros de conferência deles. */
export async function montarEnvio(nomeAparelho = "celular") {
  try { await B.gravarPendentes(); } catch { /* grava depois */ }
  const sit = await B.situacoesArtistas(), conf = await B.conferidos();
  const incluir = new Set([...sit].filter(([, s]) => B.ESTADOS_ESPELHO.has(s.estado)).map(([k]) => k));
  // marcado mas sem nenhuma música agora (apagou todas no celular): vai também, para o tablet apagar as dele
  for (const [k, r] of Object.entries(conf)) if (r?.estado) incluir.add(k);
  const faixas = (await B.listaFaixas()).filter(f => incluir.has(B.normArtista(f.artista))).sort((a, b) => a.caminho.localeCompare(b.caminho));
  const conferidos = Object.fromEntries(Object.entries(conf).filter(([k, r]) => incluir.has(k) && r?.estado));
  const manifesto = { v: 1, de: nomeAparelho, em: Date.now(), artistas: [...incluir].sort(), conferidos,
    arquivos: faixas.map((f, i) => ({ i, c: f.caminho, t: f.tamanho || 0, m: f.modificado || 0 })) };
  return { manifesto, uris: faixas.map(f => f.id), bytes: faixas.reduce((s, f) => s + (f.tamanho || 0), 0), artistas: new Set(faixas.map(f => B.normArtista(f.artista))).size };
}

const mb = (b) => !b ? "0 MB" : b >= 1e9 ? `${(b / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`;
const plural = (n, um, varios) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
const caixa = () => document.querySelector("#modal .modal-caixa");

// ---------------------------------------------------------------- celular: enviar
export async function enviarParaTablet() {
  if (!T) { toast("Isso só funciona no app do Android."); return; }
  toast("Preparando a lista…");
  const env = await montarEnvio("Órbita no celular");
  if (!env.manifesto.arquivos.length && !env.manifesto.artistas.length) { await modal({ titulo: "Nada para mandar", texto: "Marque artistas como completos (✓) na aba Artistas: as músicas deles é que vão para o tablet.", botoes: [{ texto: "Ok", valor: true }] }); return; }
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  let r;
  try { r = await T.servir({ codigo, nome: "Órbita no celular", manifesto: JSON.stringify(env.manifesto), uris: env.uris }); }
  catch (e) { toast(e.message || "Não consegui abrir a conexão.", 5000); return; }
  const end = (r.ips || []).map(ip => `${ip}:${r.porta}`).join(" ou ") || "sem Wi-Fi?";
  const ouvinte = await T.addListener("envio", (e) => {
    const st = caixa()?.querySelector(".tr-estado"); if (!st) return;
    if (e.tipo === "conectado") st.textContent = "O tablet achou a lista. Confirme lá.";
    else if (e.tipo === "codigoErrado") st.textContent = "O tablet digitou o código errado.";
    else if (e.tipo === "enviando") st.textContent = `Enviadas: ${plural(e.enviados, "música", "músicas")} (${mb(e.bytes)})`;
  });
  await modal({ titulo: "", botoes: [{ texto: "Parar", valor: true }], html: `<div class="tr">
    <h2>Enviar para o tablet</h2>
    <p class="sub">${plural(env.manifesto.arquivos.length, "música", "músicas")} (${mb(env.bytes)}) de ${plural(env.manifesto.artistas.length, "artista", "artistas")} com ✓ e "não se aplica".</p>
    <p>No tablet, na mesma rede Wi-Fi: <b>Músicas → Ajustes → Receber do celular</b> e digite o código:</p>
    <p class="tr-codigo">${codigo.slice(0, 3)} ${codigo.slice(3)}</p>
    <p class="sub">Se o tablet não achar o celular sozinho, o endereço é <b>${escapar(end)}</b>.</p>
    <p class="tr-estado sub">Esperando o tablet…</p>
    <p class="sub">Deixe esta tela aberta até o tablet terminar.</p></div>` });
  try { await ouvinte.remove(); } catch { /* já saiu */ }
  await T.parar();
}

// ---------------------------------------------------------------- tablet: receber
export async function receberDoCelular(aoTerminar = () => {}) {
  if (!T) { toast("Isso só funciona no app do Android."); return; }
  const p = await B.pasta();
  if (!p) { toast("Escolha primeiro a pasta das músicas deste aparelho (Ajustes → Escolher a pasta).", 5000); return; }
  // 1) acha o celular
  const m1 = modal({ titulo: "", botoes: [{ texto: "Cancelar", valor: null, classe: "secundario" }], html: `<div class="tr"><h2>Receber do celular</h2><p class="tr-estado">Procurando o celular na rede…</p><p class="sub">No celular, abra Músicas → Ajustes → Enviar para o tablet.</p></div>` });
  let achados = [];
  try { achados = (await T.procurar({ segundos: 5 })).achados || []; } catch { achados = []; }
  if (document.getElementById("modal").hidden) return; // cancelou
  const escolha = await escolherCelular(achados);
  void m1;
  if (!escolha) return;
  // 2) o código e a lista
  const cod = await pedirCodigo();
  if (!cod) return;
  let man;
  try { man = JSON.parse((await T.manifesto({ host: escolha.host, porta: escolha.porta, codigo: cod })).texto); }
  catch (e) { toast(/codigo/.test(e.message) ? "Código errado. Confira o que aparece no celular." : `Não consegui falar com o celular: ${e.message}`, 5000); return; }
  // 3) o plano
  try { await B.sincronizar(); } catch (e) { console.warn("receber: ler a pasta", e.message); }
  const recebidos = (await BD.lerCfg("recebidos")) || {};
  const plano = planoDeRecebimento(man, await B.listaFaixas(), recebidos);
  if (!plano.baixar.length && !plano.apagar.length) {
    await guardarRecebidos(recebidos, plano.iguais, []);
    await B.adotarConferidos(man.conferidos);
    await modal({ titulo: "Tudo igual", texto: `O tablet já tem as ${plano.iguais.length.toLocaleString("pt-BR")} músicas desses artistas, iguais às do celular.`, botoes: [{ texto: "Ok", valor: true }] });
    return;
  }
  const exemplos = plano.apagar.slice(0, 6).map(f => `<li>${escapar(f.titulo || f.caminho)} <small>${escapar(f.artista || "")}</small></li>`).join("");
  const ok = await modal({ titulo: "", botoes: [{ texto: "Começar", valor: true }, { texto: "Cancelar", valor: false, classe: "secundario" }], html: `<div class="tr">
    <h2>Deixar igual ao celular</h2>
    <p>${plural(man.artistas.length, "artista", "artistas")} com ✓ e "não se aplica".</p>
    <ul class="tr-plano"><li><b>Baixar:</b> ${plural(plano.baixar.length, "música", "músicas")} (${mb(plano.bytes)})</li>
      <li><b>Apagar deste tablet:</b> ${plano.apagar.length ? plural(plano.apagar.length, "música que o celular não tem mais", "músicas que o celular não tem mais") : "nada"}</li>
      <li><b>Iguais:</b> ${plano.iguais.length.toLocaleString("pt-BR")}</li></ul>
    ${plano.apagar.length ? `<details class="tr-apagar"><summary>Ver o que será apagado</summary><ul>${exemplos}${plano.apagar.length > 6 ? `<li>… e mais ${plano.apagar.length - 6}</li>` : ""}</ul></details>` : ""}
    <p class="sub">Os outros artistas do tablet não mudam. Deixe os dois aparelhos com a tela ligada até acabar.</p></div>` });
  if (!ok) return;
  // 4) baixar e apagar
  modal({ titulo: "", botoes: [{ texto: "Parar", valor: "parar", classe: "secundario" }], html: `<div class="tr"><h2>Recebendo…</h2><div class="tr-barra"><i></i></div><p class="tr-estado sub">Começando…</p></div>` })
    .then(v => { if (v === "parar") T.cancelar(); });
  const ouvinte = await T.addListener("recebendo", (e) => {
    const c = caixa(); if (!c) return;
    const f = c.querySelector(".tr-barra i"), st = c.querySelector(".tr-estado");
    if (f) f.style.width = `${Math.round((e.bytes / Math.max(1, plano.bytes)) * 100)}%`;
    if (st) st.textContent = `${(e.feitos + 1).toLocaleString("pt-BR")} de ${e.total.toLocaleString("pt-BR")} · ${mb(e.bytes)} de ${mb(plano.bytes)}\n${e.atual}`;
  });
  let r;
  try {
    r = await T.receber({ host: escolha.host, porta: escolha.porta, codigo: cod, uri: p.uri,
      itens: plano.baixar.map(a => ({ i: a.i, c: a.c, t: a.t })), apagar: plano.apagar.map(f => f.id) });
  } finally { try { await ouvinte.remove(); } catch { /* já saiu */ } }
  document.getElementById("modal").hidden = true;
  // 5) anota, lê a pasta e pega as estrelas de dentro dos arquivos
  const chegaram = new Set((r.ok || []).map(o => o.c));
  await guardarRecebidos(recebidos, [...plano.iguais, ...plano.baixar.filter(a => chegaram.has(a.c))], plano.apagar.map(f => f.caminho));
  toast("Lendo a pasta…");
  try { await B.sincronizar(); } catch (e) { console.warn("receber: ler a pasta", e.message); }
  try { await B.notasDosArquivos([...chegaram]); } catch (e) { console.warn("receber: estrelas", e.message); }
  try { await B.adotarConferidos(man.conferidos); } catch (e) { console.warn("receber: conferidos", e.message); }
  aoTerminar();
  const erros = r.erros || [];
  await modal({ titulo: r.cancelado ? "Parado no meio" : erros.length ? "Quase tudo" : "Pronto!",
    texto: `${plural(chegaram.size, "música recebida", "músicas recebidas")}${r.apagados ? `, ${plural(r.apagados, "apagada", "apagadas")}` : ""}.${erros.length ? ` ${plural(erros.length, "não veio", "não vieram")} (${escapar(erros[0].erro || "")}): toque em Receber de novo, que só vem o que falta.` : ""}`,
    botoes: [{ texto: "Ok", valor: true }] });
}

async function guardarRecebidos(rec, novos, tirados) {
  for (const a of novos) rec[a.c] = { t: a.t, m: a.m };
  for (const c of tirados) delete rec[c];
  await BD.gravarCfg("recebidos", rec);
}

function escolherCelular(achados) {
  return new Promise((ok) => {
    const c = caixa(); if (!c) { ok(null); return; }
    c.querySelector(".tr").innerHTML = `<h2>Receber do celular</h2>
      ${achados.length ? `<p>Achei na rede:</p><div class="tr-lista">${achados.map((a, k) => `<button class="botao" data-k="${k}">${escapar(a.nome)} <small>${escapar(a.host)}</small></button>`).join("")}</div>` : `<p>Não achei o celular sozinho. Confira se os dois estão no mesmo Wi-Fi e se o celular está na tela "Enviar para o tablet".</p>`}
      <label class="campo">Ou digite o endereço que aparece no celular<input class="tr-end" inputmode="decimal" placeholder="192.168.0.10:47210" autocomplete="off"></label>
      <button class="botao secundario tr-usar">Usar este endereço</button>`;
    c.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => ok(achados[+b.dataset.k])));
    c.querySelector(".tr-usar").onclick = () => {
      const v = c.querySelector(".tr-end").value.trim().replace(/\s/g, ""), m = v.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?$/);
      if (!m) { toast("Digite como aparece no celular, por exemplo 192.168.0.10:47210"); return; }
      ok({ nome: "celular", host: m[1], porta: +(m[2] || 47210) });
    };
    const m = document.getElementById("modal");
    const obs = new MutationObserver(() => { if (m.hidden) { obs.disconnect(); ok(null); } });
    obs.observe(m, { attributes: true, attributeFilter: ["hidden"] });
  });
}

async function pedirCodigo() {
  pedirCodigo.ultimo = "";
  const r = await modal({ titulo: "", botoes: [{ texto: "Continuar", valor: "ok" }, { texto: "Cancelar", valor: null, classe: "secundario" }], html: `<div class="tr"><h2>O código do celular</h2><label class="campo">Os 6 números que aparecem na tela do celular<input class="tr-cod" inputmode="numeric" maxlength="7" autocomplete="off"></label></div>` });
  if (r !== "ok") return null;
  return pedirCodigo.ultimo.length === 6 ? pedirCodigo.ultimo : (toast("São 6 números."), null);
}
// o valor do campo fica guardado enquanto a pessoa digita (o modal some antes de a promessa resolver)
document.addEventListener("input", (e) => { if (e.target?.classList?.contains("tr-cod")) pedirCodigo.ultimo = e.target.value.replace(/\D/g, "").slice(0, 6); });
