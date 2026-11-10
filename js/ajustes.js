// Ajustes do Órbita (pedido do Alediov, 29/10/2026: "certas configurações que dizem respeito ao Órbita como um todo
// estão acontecendo ainda pelo subapp Estudos. Eu queria que essas configurações estivessem na home"). Uma camada própria
// (acima da Home, abaixo dos modais), aberta pela engrenagem da Home: aparência, ao abrir o app, toque e som,
// notificações, a conta do GitHub (repositório, token e a validade dele, sincronizar), backup e atualização do app.
// O que é só dos Estudos (música das lições, lembretes de estudo, meta, widget) continua no Perfil.
import { E, salvar, substituirEstado, hojeISO } from "./estado.js";
import { temToken, enviarBackup, baixarBackup } from "./dados.js";
import { escapar, modal, toast } from "./ui.js";
import { abrirAjusteAlarmeExato, temNotificacoes } from "./notificacoes.js";
import { reiniciarAudio } from "./sons.js";
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";

const nativo = !!Capacitor.isNativePlatform?.();
const Http = nativo ? registerPlugin("CapacitorHttp") : null;
const cfg = () => E().config;
const DIA = 864e5;

// ---------------------------------------------------------------- validade do token
// O GitHub manda a data no cabeçalho `github-authentication-token-expiration` de cada resposta da API (ausente num token
// sem validade). No navegador o cabeçalho não chega (CORS); no Android, o pedido vai pelo CapacitorHttp.
/** { data: "AAAA-MM-DD" | null (sem validade), conferido, erro? } em config.tokenValidade (fica neste aparelho). */
export const validadeToken = () => cfg().tokenValidade || null;
export function diasParaVencer(v = validadeToken()) {
  if (!v?.data) return null;
  return Math.round((new Date(v.data + "T12:00:00") - new Date(hojeISO() + "T12:00:00")) / DIA);
}
/** Confere no GitHub (uma vez por dia, ou já com `forcar`). Devolve a validade ou null (sem como saber aqui). */
export async function conferirValidade({ forcar = false } = {}) {
  const c = cfg(), v = c.tokenValidade;
  if (!Http || !temToken() || !navigator.onLine) return v || null;
  if (!forcar && v?.conferido === hojeISO() && v.token === assinatura(c.token)) return v;
  try {
    const r = await Http.request({ url: `https://api.github.com/repos/${c.repo}`, method: "GET", connectTimeout: 12000, readTimeout: 12000,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${c.token}`, "X-GitHub-Api-Version": "2022-11-28" } });
    if (r.status === 401) { c.tokenValidade = { data: null, conferido: hojeISO(), erro: "recusado", token: assinatura(c.token) }; salvar(); return c.tokenValidade; }
    const h = Object.fromEntries(Object.entries(r.headers || {}).map(([k, x]) => [k.toLowerCase(), String(x)]));
    const bruto = h["github-authentication-token-expiration"] || "";
    const m = bruto.match(/(\d{4}-\d{2}-\d{2})/);
    c.tokenValidade = { data: m ? m[1] : null, conferido: hojeISO(), token: assinatura(c.token) };
    salvar();
    return c.tokenValidade;
  } catch (e) { console.warn("validade do token", e); return v || null; }
}
// para saber se o token mudou sem guardar o token de novo: os 6 últimos caracteres
const assinatura = (t) => String(t || "").slice(-6);
/** Texto curto da validade (Ajustes e Meu dia). */
export function textoValidade(v = validadeToken()) {
  if (!temToken()) return "Sem token neste aparelho.";
  if (!Http) return "A validade só aparece no app do Android.";
  if (!v) return "Ainda não conferida.";
  if (v.erro === "recusado") return "O GitHub recusou este token: ele venceu ou foi apagado. Gere outro.";
  if (!v.data) return "Sem data de vencimento.";
  const d = diasParaVencer(v), quando = new Date(v.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return d < 0 ? `Venceu em ${quando}. Gere outro.` : `Vale até ${quando} (${d === 0 ? "vence hoje" : d === 1 ? "falta 1 dia" : `faltam ${d} dias`}).`;
}
/** Para o Meu dia: aviso quando faltam 30 dias ou menos (ou já venceu/foi recusado). */
export function avisoValidade() {
  const v = validadeToken(); if (!v || !temToken()) return null;
  const d = diasParaVencer(v);
  if (v.erro === "recusado" || (d !== null && d <= 30)) return { titulo: v.erro || d < 0 ? "O token do GitHub não vale mais" : `O token do GitHub vence em ${d} ${d === 1 ? "dia" : "dias"}`, texto: "Gere um novo nos Ajustes do Órbita" };
  return null;
}

// ---------------------------------------------------------------- a camada
let camada = null;
export function fecharAjustes() { camada?.remove(); camada = null; }
export async function abrirAjustes() {
  fecharAjustes();
  const c = cfg();
  camada = document.createElement("div"); camada.className = "camada-ajustes";
  camada.innerHTML = `<header class="aj-cab"><button class="aj-voltar" type="button" aria-label="Voltar">‹</button><h1>Ajustes do Órbita</h1></header>
    <div class="aj-corpo">
      <section class="secao"><h2>Aparência</h2><div class="cartao" id="aj-aparencia"></div></section>
      <section class="secao"><h2>Ao abrir</h2><div class="cartao" id="aj-abrir"></div></section>
      <section class="secao"><h2>Toque e som</h2><div class="cartao" id="aj-som"></div></section>
      ${temNotificacoes() ? `<section class="secao"><h2>Notificações</h2><div class="cartao" id="aj-notif"></div></section>` : ""}
      <section class="secao"><h2>Avisos do WhatsApp</h2><div class="cartao" id="aj-whats"></div></section>
      <section class="secao"><h2>Conta do GitHub</h2><div class="cartao" id="aj-github"></div></section>
      <section class="secao"><h2>Backup do progresso</h2><div class="cartao" id="aj-backup"></div></section>
      <section class="secao"><h2>App</h2><div class="cartao" id="aj-app"></div></section>
    </div>`;
  document.body.append(camada);
  camada.querySelector(".aj-voltar").onclick = fecharAjustes;
  const $ = (s) => camada.querySelector(s);
  const linha = (pai, rot, sub, el) => { const l = document.createElement("div"); l.className = "linha-cfg"; l.innerHTML = `<span>${rot}${sub ? `<small class="sub" style="display:block;font-size:12px">${sub}</small>` : ""}</span>`; l.append(el); pai.append(l); return l; };
  const chave = (pai, rot, k, sub, depois) => {
    const b = document.createElement("button"); b.className = `chave ${c[k] ? "on" : ""}`; b.setAttribute("aria-label", rot);
    b.onclick = () => { c[k] = !c[k]; salvar(); b.classList.toggle("on"); depois?.(c[k]); };
    linha(pai, rot, sub, b);
  };
  const botao = (pai, texto, fn, secundario = true) => { const b = document.createElement("button"); b.className = `botao ${secundario ? "secundario" : ""}`; b.textContent = texto; b.onclick = () => fn(b); pai.append(b); return b; };

  // aparência (aparencia.js)
  const ap = $("#aj-aparencia");
  const resumoAp = () => {
    const nomes = { auto: "Automático", claro: "Claro", escuro: "AMOLED" }, v = c.visual || {};
    return `Tema ${nomes[c.tema || "auto"]} · fundo ${v.fundo && v.fundo !== "liso" ? v.fundo[0].toUpperCase() + v.fundo.slice(1) : "liso"} · ${v.bolhas === false ? "sem" : "com"} bolhas`;
  };
  const bAp = document.createElement("button"); bAp.className = "botao secundario"; bAp.style.width = "auto"; bAp.textContent = "Mudar";
  const lAp = linha(ap, "Tema, fundo e bolhas", resumoAp(), bAp);
  bAp.onclick = async () => {
    const [A, T] = await Promise.all([import("./aparencia.js"), import("./telas.js")]);
    await A.abrirAparencia({ aoTema: T.aplicarTema });
    lAp.querySelector("small").textContent = resumoAp();
  };

  // ao abrir o app (home.js)
  const ab = document.createElement("label"); ab.className = "campo";
  ab.innerHTML = `Ao abrir o app<select><option value="home">A Home do Órbita, com todas as áreas</option><option value="ultima">A última área usada</option></select><span class="dica">Voltar ao app sem fechá-lo continua onde você estava; os widgets abrem direto a área deles.</span>`;
  const sa = ab.querySelector("select"); sa.value = c.abrirEm || "home";
  sa.onchange = () => { c.abrirEm = sa.value; salvar(); };
  $("#aj-abrir").append(ab);

  // toque e som
  const som = $("#aj-som");
  chave(som, "Efeitos sonoros", "som", "Os sons de acerto, erro, toque e baús, em todas as áreas.");
  chave(som, "Vibração", "vibrar", "Uma vibração curtinha nos botões e nas respostas.");
  chave(som, "Áudio com mais folga", "audioFolga", "Ligue se o som chiar ou estalar neste aparelho. Os efeitos podem atrasar um pouquinho.", () => reiniciarAudio());
  // a voz do "Ouvir" (voz.js, 09/11/2026): motor, voz pt-BR, exemplo e o atalho para baixar a voz de alta qualidade
  { const bV = document.createElement("button"); bV.className = "botao secundario aj-voz"; bV.textContent = "Escolher"; bV.onclick = () => import("./voz.js").then(V => V.abrirAjustesVoz());
    linha(som, "Voz do Ouvir", "A voz que lê as unidades e o “Ouvir o dia”. Vale só neste aparelho.", bV); }

  // notificações
  if (temNotificacoes()) {
    const n = $("#aj-notif");
    n.insertAdjacentHTML("beforeend", `<p class="sub" style="margin:0 0 10px">Para os lembretes e os alarmes tocarem na hora certa, o Android pede uma permissão à parte.</p>`);
    botao(n, "Permitir lembretes no horário exato", async () => { if (!(await abrirAjusteAlarmeExato())) toast("Este Android não precisa dessa permissão."); });
  }

  // Avisos do WhatsApp (whatsapp/telaWhats.js): o acesso às notificações, os grupos e o histórico
  const bWa = document.createElement("button"); bWa.className = "botao secundario"; bWa.style.width = "auto"; bWa.textContent = "Abrir";
  bWa.onclick = async () => (await import("./whatsapp/telaWhats.js")).abrirAjustesWhats();
  const lWa = linha($("#aj-whats"), "Grupos e acesso às notificações", "Os recados importantes dos grupos que você escolher viram destaques em Mensagens.", bWa);
  import("./whatsapp/fonte.js").then(F => F.fonte().situacao()).then(s => { const sm = lWa.querySelector("small"); if (sm && s) sm.textContent = s.permitido ? "Ligado: os recados importantes dos grupos escolhidos viram destaques em Mensagens." : "Desligado: falta o acesso às notificações."; }).catch(() => {});

  // conta do GitHub
  const gh = $("#aj-github");
  gh.innerHTML = `<p class="sub" id="aj-sinc" style="margin:0 0 10px"></p>
    <label class="campo">Repositório<input id="aj-repo" autocomplete="off" spellcheck="false"></label>
    <label class="campo">Token do GitHub<input id="aj-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"><span class="dica" id="aj-validade"></span></label>`;
  const ri = $("#aj-repo"), ti = $("#aj-token"), val = $("#aj-validade");
  ri.value = c.repo || ""; ti.value = c.token || "";
  const mostrarValidade = () => { val.textContent = textoValidade(); val.classList.toggle("aj-alerta", !!avisoValidade()); };
  mostrarValidade();
  ri.onchange = () => { c.repo = ri.value.trim(); salvar(); };
  ti.onchange = async () => {
    c.token = ti.value.trim(); delete c.tokenValidade; salvar(); toast("Token salvo neste aparelho.");
    mostrarValidade(); await conferirValidade({ forcar: true }); mostrarValidade();
    window.dispatchEvent(new Event("oq-topo"));
  };
  botao(gh, "Sincronizar", async (b) => (await import("./telas.js")).executarSync(b), false);
  if (Http) botao(gh, "Conferir a validade do token", async (b) => { b.disabled = true; await conferirValidade({ forcar: true }); mostrarValidade(); b.disabled = false; });
  const comoToken = document.createElement("details"); comoToken.className = "aj-como";
  comoToken.innerHTML = `<summary>Como gerar um token novo</summary><ol>
    <li>No GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li>
    <li>Em Expiration, escolha <b>No expiration</b> (ou a data que quiser).</li>
    <li>Em Repository access, só o repositório <b>${escapar(c.repo || "odonto-quest")}</b>; em Permissions, Contents e Issues com Read and write.</li>
    <li>Cole o token aqui, no celular e no tablet, e onde mais você usa o antigo (a variável <b>orbita_token</b> do MacroDroid e o "Resumo para o celular" do Scanner no computador do laboratório).</li>
    <li>Depois que tudo funcionar, apague o token antigo no GitHub.</li></ol>`;
  gh.append(comoToken);
  import("./sincronia.js").then(S => {
    const r = S.situacao(), h = r?.quando ? new Date(r.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
    const txt = { nada: "em dia", enviado: "enviado", recebido: `recebido${r?.de ? ` do ${r.de}` : ""}`, juntado: `juntado com o do ${r?.de || "outro aparelho"}`, esperando: "esperando a lição acabar", erro: `não deu (${r?.erro || ""})`, offline: "sem internet" }[r?.acao];
    $("#aj-sinc").textContent = temToken() ? `Progresso entre aparelhos: ${txt ? `${txt}${h ? ` às ${h}` : ""}` : "sincroniza ao abrir e depois de cada lição"}. No tablet, use o mesmo token.` : "Sem o token, o app só mostra as lições que vieram na instalação.";
  }).catch(() => {});
  // antena de ideias: as legendas que o celular baixa do YouTube (ideias/transcricoes.js, 09/11/2026)
  import("./ideias/transcricoes.js").then(T => {
    const t = T.textoSituacao(); if (!t || !camada) return;
    const p = document.createElement("p"); p.className = "sub aj-transcricoes"; p.style.cssText = "margin:10px 0 0;font-size:12px"; p.textContent = t;
    gh.append(p);
  }).catch(() => {});

  // backup
  const bk = $("#aj-backup");
  botao(bk, "Enviar backup do progresso", async () => { try { await enviarBackup(); toast("Backup enviado ao repositório."); } catch (e) { toast(e.message, 4000); } });
  botao(bk, "Restaurar backup", async () => {
    const ok = await modal({ titulo: "Restaurar o backup?", texto: "O progresso deste aparelho será substituído pelo último backup do repositório.", botoes: [{ texto: "Restaurar", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] });
    if (!ok) return;
    try { const b = await baixarBackup(); b.config.token = c.token; substituirEstado(b); toast("Progresso restaurado."); window.dispatchEvent(new Event("oq-topo")); fecharAjustes(); } catch (e) { toast(e.message, 4000); }
  });

  // app
  const app = $("#aj-app");
  botao(app, "Procurar atualização do app", () => import("./atualizacao.js").then(m => m.verificarAtualizacao({ manual: true })));
  if (nativo) registerPlugin("App").getInfo?.().then(i => app.insertAdjacentHTML("beforeend", `<p class="sub" style="margin:10px 0 0;text-align:center">Órbita ${escapar(i.version || "")}</p>`)).catch(() => {});
  if (Http && temToken()) conferirValidade().then(mostrarValidade);
}
