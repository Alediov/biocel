// Telas do Cofre (pedido do Alediov, 04/11/2026): fechado (senha mestra ou digital; criar na 1ª vez), a lista com busca
// e filtros, o item (campos com mostrar e copiar, o código de duas etapas que anda sozinho) e o editor (gerador de
// senha, força, campos extras). Os segredos só entram no DOM quando ele toca em "mostrar" (ou no editor).
import * as K from "./cofre.js";
import { forca, gerarSenha, gerarFrase, codigoOtp, lerOtp } from "./cripto.js";
import { Capacitor, registerPlugin } from "../../vendor/capacitor-core.js";

let raiz = null, opts = {}, tela = "lista", filtro = "todos", busca = "", atual = null, timers = [];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s) => raiz?.querySelector(s);
const TIPOS = {
  conta: { nome: "Conta", plural: "Contas", ic: "👤", desc: "login e senha de um site ou app" },
  chave: { nome: "Chave ou token", plural: "Chaves e tokens", ic: "🔑", desc: "token do GitHub, chave de API, PIN" },
  nota: { nome: "Nota segura", plural: "Notas", ic: "📝", desc: "códigos de recuperação, qualquer texto" },
};
const GRUPOS_SUGERIDOS = ["Contas secundárias", "Nuvens", "Faculdade", "Finanças", "Apps do Órbita", "Pessoal"];
const IC = {
  cadeado: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>`,
  aberto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 7.6-1.8"/></svg>`,
  olho: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>`,
  copiar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/></svg>`,
  engr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  voltar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  mais: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  dado: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/></svg>`,
  digital: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 7.5a7 7 0 0 1 11.6 3.2M5.2 12.5c0-1 .1-2 .5-2.9M18.6 14c0 2.6-.6 4.5-1.2 5.8M8.6 18.8c.8-1.8 1.1-3.7 1.1-6a2.3 2.3 0 0 1 4.6 0c0 1.2 0 2.4-.2 3.6M12 12.8c0 3.4-.7 6-1.9 8M15.6 12.4c0-2-1.6-3.7-3.6-3.7s-3.6 1.7-3.6 3.7c0 1.6-.3 3-.8 4.2"/></svg>`,
};

function toast(t, ms = 2600) {
  let el = $(".cf-toast"); if (!el) { el = document.createElement("div"); el.className = "cf-toast"; raiz.append(el); }
  el.textContent = t; el.classList.add("ve"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("ve"), ms);
}
function limparTimers() { timers.forEach(clearInterval); timers = []; }

/** Abre o Cofre na camada `el`. `o`: { aoTrocarArea, logo }. */
export async function abrirTelaCofre(el, o = {}) {
  raiz = el; opts = o; raiz.classList.add("cf");
  K.ouvirVisibilidade();
  window.removeEventListener("oq-cofre", aoMudar); window.addEventListener("oq-cofre", aoMudar);
  await desenhar();
}
/** Fechar a área fecha o cofre (a chave sai da memória). */
export function sairDoCofre() { limparTimers(); window.removeEventListener("oq-cofre", aoMudar); K.fechar(); raiz = null; }
function aoMudar() { if (raiz?.isConnected) { if (!K.aberto()) { tela = "lista"; atual = null; } desenhar(); } }

function topo(titulo, { voltar = false, direita = "" } = {}) {
  return `<header class="cf-topo">${voltar ? `<button class="cf-ic cf-voltar" aria-label="Voltar">${IC.voltar}</button>` : `<button class="cf-area" aria-label="Trocar de área">${opts.logo || ""}</button>`}
    <h1>${esc(titulo)}</h1><span class="cf-topo-dir">${direita}</span></header>`;
}
function ligarTopo() {
  $(".cf-area")?.addEventListener("click", () => opts.aoTrocarArea?.());
  $(".cf-voltar")?.addEventListener("click", () => { tela = tela === "editar" && atual?.id ? "item" : "lista"; if (tela === "lista") atual = null; desenhar(); });
}

async function desenhar() {
  if (!raiz?.isConnected) return;
  limparTimers();
  if (!K.aberto()) return telaFechado();
  if (tela === "item" && atual?.id && K.item(atual.id)) return telaItem(K.item(atual.id));
  if (tela === "editar") return telaEditar(atual);
  tela = "lista"; return telaLista();
}

// ---------- fechado ----------
let erros = 0, esperaAte = 0, tentouDigital = false;
async function telaFechado() {
  raiz.innerHTML = `${topo("Cofre")}<main class="cf-tela cf-fechado"><div class="cf-vazio">Abrindo…</div></main>`;
  ligarTopo();
  const s = await K.situacao();
  if (!raiz?.isConnected || K.aberto()) return;
  const criar = !s.local && !s.remoto;
  const corpo = $(".cf-fechado");
  corpo.innerHTML = criar ? `
    <div class="cf-selo">${IC.cadeado}</div>
    <h2>Criar o cofre</h2>
    <p class="cf-sub">Senhas, tokens, chaves de API e as contas secundárias, cifrados com uma <b>senha mestra</b> que só você sabe. Nos outros aparelhos, o cofre chega cifrado pela sincronização.</p>
    <label class="cf-campo">Senha mestra<span class="cf-linha"><input type="password" class="cf-s1" autocomplete="new-password" autocapitalize="off" spellcheck="false"><button class="cf-ic cf-ver" aria-label="Mostrar">${IC.olho}</button></span></label>
    <div class="cf-forca"><i></i><small></small></div>
    <label class="cf-campo">Repita a senha<input type="password" class="cf-s2" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label>
    <button class="cf-link cf-frase">${IC.dado}<span>Sugerir uma frase-senha (fácil de lembrar)</span></button>
    <label class="cf-aviso"><input type="checkbox" class="cf-entendi"><span>Entendi: a senha mestra não fica guardada em lugar nenhum. <b>Se eu esquecer, perco o que está no cofre.</b></span></label>
    <button class="cf-botao cf-criar" disabled>Criar o cofre</button>` : `
    <div class="cf-selo">${IC.cadeado}</div>
    <h2>Cofre fechado</h2>
    ${!s.local ? `<p class="cf-sub">O cofre já existe em outro aparelho: abra com a mesma senha mestra para trazê-lo para cá.</p>` : ""}
    <label class="cf-campo">Senha mestra<span class="cf-linha"><input type="password" class="cf-s1" autocomplete="current-password" autocapitalize="off" spellcheck="false" enterkeyhint="go"><button class="cf-ic cf-ver" aria-label="Mostrar">${IC.olho}</button></span></label>
    <p class="cf-erro" hidden></p>
    <button class="cf-botao cf-abrir">${IC.aberto}<span>Abrir</span></button>
    ${s.local && s.digital.guardado ? `<button class="cf-botao sec cf-dig">${IC.digital}<span>Usar a digital</span></button>` : ""}`;
  const s1 = $(".cf-s1");
  $(".cf-ver").onclick = () => { s1.type = s1.type === "password" ? "text" : "password"; };
  if (criar) {
    const s2 = $(".cf-s2"), bt = $(".cf-criar"), ent = $(".cf-entendi");
    const conferir = () => {
      const f = forca(s1.value), bar = $(".cf-forca");
      bar.dataset.nivel = f.nivel; bar.querySelector("small").textContent = s1.value ? `${f.rotulo}${f.nivel < 3 ? " · use uma frase de 4 palavras ou mais" : ""}` : "";
      bt.disabled = !(s1.value.length >= 10 && f.nivel >= 3 && s1.value === s2.value && ent.checked);
    };
    s1.oninput = s2.oninput = ent.onchange = conferir;
    $(".cf-frase").onclick = () => { const f = gerarFrase(5); s1.value = s2.value = f; s1.type = "text"; conferir(); toast("Anote esta frase num lugar seguro antes de criar.", 4000); };
    bt.onclick = async () => {
      bt.disabled = true; bt.textContent = "Criando…";
      try { await K.criar(s1.value); toast("Cofre criado"); } catch (e) { toast(`Não deu: ${e.message}`); conferir(); }
    };
    return;
  }
  const abrir = async () => {
    if (Date.now() < esperaAte) { mostrarErro(`Espere ${Math.ceil((esperaAte - Date.now()) / 1000)} s`); return; }
    const b = $(".cf-abrir"); b.disabled = true; b.querySelector("span").textContent = "Abrindo…";
    try { await K.abrirComSenha(s1.value); erros = 0; }
    catch (e) {
      b.disabled = false; b.querySelector("span").textContent = "Abrir";
      if (e.message === "senha") { erros++; if (erros >= 5) { esperaAte = Date.now() + 30000; erros = 0; } mostrarErro("Senha errada"); s1.select(); }
      else mostrarErro(e.message === "vazio" ? "Não achei o cofre (confira o token do GitHub nos Ajustes)" : `Não deu para abrir: ${e.message}`);
    }
  };
  $(".cf-abrir").onclick = abrir;
  s1.onkeydown = (e) => { if (e.key === "Enter") abrir(); };
  const dig = async () => {
    try { await K.abrirComDigital(); }
    catch (e) { if (e.message === "invalidada" || e.code === "invalidada") { mostrarErro("A digital precisa ser ligada de novo: abra com a senha"); $(".cf-dig")?.remove(); } else if (e.code !== "cancelado") mostrarErro("A digital não abriu: use a senha"); }
  };
  $(".cf-dig")?.addEventListener("click", dig);
  if ($(".cf-dig") && !tentouDigital) { tentouDigital = true; setTimeout(dig, 250); } // ao abrir a área, já pede a digital
}
function mostrarErro(t) { const p = $(".cf-erro"); if (!p) return toast(t); p.hidden = false; p.textContent = t; p.classList.remove("treme"); void p.offsetWidth; p.classList.add("treme"); }

// ---------- lista ----------
const vence = (it) => { if (!it.vence) return null; const d = Math.ceil((Date.parse(it.vence + "T23:59:59") - Date.now()) / 864e5); return isNaN(d) ? null : d; };
function subtitulo(it) {
  if (it.tipo === "conta") return it.usuario || it.url || "";
  if (it.tipo === "chave") return it.servico || "";
  return String(it.texto || "").split("\n")[0].slice(0, 60) ? "nota" : "";
}
function telaLista() {
  tentouDigital = false;
  const todos = K.itens(), q = busca.trim().toLowerCase();
  const passa = (it) => (filtro === "todos" || (filtro === "fav" ? it.fav : it.tipo === filtro)) &&
    (!q || [it.titulo, it.usuario, it.url, it.servico, it.grupo].some(v => String(v || "").toLowerCase().includes(q)));
  const lista = todos.filter(passa);
  const grupos = new Map();
  for (const it of lista) { const g = it.fav && filtro !== "fav" ? "★ Favoritos" : it.grupo || TIPOS[it.tipo]?.plural || "Outros"; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(it); }
  const ordem = [...grupos.keys()].sort((a, b) => (a.startsWith("★") ? -1 : b.startsWith("★") ? 1 : a.localeCompare(b, "pt-BR")));
  const sinc = K.situacaoSinc();
  raiz.innerHTML = `${topo("Cofre", { direita: `<button class="cf-ic cf-ajustes" aria-label="Ajustes do cofre">${IC.engr}</button><button class="cf-ic cf-trancar" aria-label="Fechar o cofre">${IC.cadeado}</button>` })}
    <main class="cf-tela">
      ${sinc?.erro === "outra senha" ? `<button class="cf-faixa cf-outra"><b>A senha mestra mudou em outro aparelho</b><span>Toque para digitar a nova e juntar os dois</span></button>` : ""}
      <input class="cf-busca" type="search" placeholder="Buscar no cofre" value="${esc(busca)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div class="cf-chips">${[["todos", "Todos"], ["conta", "Contas"], ["chave", "Chaves e tokens"], ["nota", "Notas"], ["fav", "★"]].map(([k, n]) => `<button data-f="${k}" class="${filtro === k ? "on" : ""}">${n}</button>`).join("")}</div>
      ${!todos.length ? `<div class="cf-vazio"><b>O cofre está vazio</b><span>Toque no + para guardar a primeira senha, token ou chave.</span></div>` :
        !lista.length ? `<div class="cf-vazio">Nada com essa busca.</div>` :
        ordem.map(g => `<section class="cf-grupo"><h3>${esc(g)}</h3><ul>${grupos.get(g).map(it => {
          const d = vence(it);
          return `<li><button class="cf-it" data-id="${esc(it.id)}"><span class="cf-it-ic">${TIPOS[it.tipo]?.ic || "•"}</span><span class="cf-it-t"><b>${esc(it.titulo || "Sem título")}</b><small>${esc(subtitulo(it))}</small></span>
            ${it.otp ? `<span class="cf-tag">2FA</span>` : ""}${d != null && d <= 30 ? `<span class="cf-tag ${d < 0 ? "ruim" : "alerta"}">${d < 0 ? "vencido" : d === 0 ? "vence hoje" : `vence em ${d} d`}</span>` : ""}</button></li>`;
        }).join("")}</ul></section>`).join("")}
      <p class="cf-rodape">${sinc ? (sinc.ok ? `Sincronizado (cifrado) ${new Date(sinc.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : sinc.erro === "sem token" ? "Só neste aparelho (sem o token do GitHub)" : `Não sincronizou: ${esc(sinc.erro)}`) : ""} · fecha sozinho em ${K.cfg().minutos} min sem uso</p>
    </main>
    <button class="cf-fab" aria-label="Guardar algo novo">${IC.mais}</button>`;
  ligarTopo();
  $(".cf-trancar").onclick = () => { K.fechar(); toast("Cofre fechado"); };
  $(".cf-ajustes").onclick = folhaAjustes;
  const b = $(".cf-busca"); b.oninput = () => { busca = b.value; const pos = b.selectionStart; telaLista(); const nb = $(".cf-busca"); nb.focus(); nb.setSelectionRange(pos, pos); };
  raiz.querySelectorAll(".cf-chips [data-f]").forEach(x => x.onclick = () => { filtro = x.dataset.f; telaLista(); });
  raiz.querySelectorAll(".cf-it").forEach(x => x.onclick = () => { atual = { id: x.dataset.id }; tela = "item"; desenhar(); });
  $(".cf-fab").onclick = escolherTipo;
  $(".cf-outra")?.addEventListener("click", outraSenha);
}
async function escolherTipo() {
  const t = await folha(`<h3>Guardar o quê?</h3><div class="cf-tipos">${Object.entries(TIPOS).map(([k, v]) => `<button data-v="${k}"><span>${v.ic}</span><b>${v.nome}</b><small>${v.desc}</small></button>`).join("")}</div>`);
  if (!t) return;
  atual = { tipo: t, campos: [] }; tela = "editar"; desenhar();
}

// ---------- item ----------
const ROTULOS = { usuario: "Usuário ou e-mail", senha: "Senha", url: "Site ou app", valor: "Valor", servico: "Onde usa", vence: "Vence em", texto: "Texto", notas: "Notas", grupo: "Grupo", otp: "Duas etapas (2FA)" };
const SECRETOS = new Set(["senha", "valor", "texto"]);
function linhaCampo(rot, valor, { secreto = false, link = false, chave } = {}) {
  if (valor == null || valor === "") return "";
  return `<li class="cf-campo-v" data-k="${esc(chave || rot)}"><small>${esc(rot)}</small>
    <span class="cf-val ${secreto ? "oculto" : ""}">${secreto ? "••••••••••" : link ? `<a href="${esc(/^https?:/i.test(valor) ? valor : `https://${valor}`)}" target="_blank" rel="noopener noreferrer">${esc(valor)}</a>` : esc(valor)}</span>
    <span class="cf-acoes">${secreto ? `<button class="cf-ic cf-mostrar" aria-label="Mostrar">${IC.olho}</button>` : ""}<button class="cf-ic cf-copiar" aria-label="Copiar">${IC.copiar}</button></span></li>`;
}
function telaItem(it) {
  const campos = [];
  if (it.tipo === "conta") campos.push(["usuario", it.usuario], ["senha", it.senha, true], ["url", it.url, false, true]);
  if (it.tipo === "chave") campos.push(["valor", it.valor, true], ["servico", it.servico]);
  if (it.tipo === "nota") campos.push(["texto", it.texto, true]);
  const d = vence(it);
  raiz.innerHTML = `${topo(it.titulo || "Sem título", { voltar: true, direita: `<button class="cf-ic cf-fav ${it.fav ? "on" : ""}" aria-label="Favorito">★</button>` })}
    <main class="cf-tela">
      <div class="cf-cab-item"><span class="cf-it-ic grande">${TIPOS[it.tipo]?.ic || "•"}</span><span><b>${esc(TIPOS[it.tipo]?.nome || "")}</b>${it.grupo ? `<small>${esc(it.grupo)}</small>` : ""}</span></div>
      <ul class="cf-campos">
        ${campos.map(([k, v, s, l]) => linhaCampo(ROTULOS[k], v, { secreto: !!s, link: !!l, chave: k })).join("")}
        ${it.otp ? `<li class="cf-campo-v cf-otp" data-k="otp"><small>Código de duas etapas</small><span class="cf-val cf-otp-cod">······</span><span class="cf-acoes"><i class="cf-otp-anel"></i><button class="cf-ic cf-copiar" aria-label="Copiar">${IC.copiar}</button></span></li>` : ""}
        ${(it.campos || []).map((c, i) => linhaCampo(c.nome || "Campo", c.valor, { secreto: !!c.secreto, chave: `extra-${i}` })).join("")}
        ${it.vence ? `<li class="cf-campo-v"><small>Vence em</small><span class="cf-val">${esc(new Date(it.vence + "T12:00").toLocaleDateString("pt-BR"))}${d != null ? ` <span class="cf-tag ${d < 0 ? "ruim" : d <= 30 ? "alerta" : ""}">${d < 0 ? "vencido" : d === 0 ? "hoje" : `em ${d} dias`}</span>` : ""}</span></li>` : ""}
        ${it.notas ? `<li class="cf-campo-v cf-notas"><small>Notas</small><span class="cf-val">${esc(it.notas).replace(/\n/g, "<br>")}</span></li>` : ""}
      </ul>
      <p class="cf-rodape">Guardado em ${new Date(it.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      <div class="cf-botoes"><button class="cf-botao cf-editar">Editar</button><button class="cf-botao sec ruim cf-apagar">Apagar</button></div>
    </main>`;
  ligarTopo();
  const valorDe = (k) => k.startsWith("extra-") ? it.campos[+k.slice(6)]?.valor : it[k];
  raiz.querySelectorAll(".cf-campo-v").forEach(li => {
    const k = li.dataset.k;
    li.querySelector(".cf-mostrar")?.addEventListener("click", () => {
      const v = li.querySelector(".cf-val"), mostrando = !v.classList.contains("oculto");
      if (mostrando) { v.textContent = "••••••••••"; v.classList.add("oculto"); } else { v.textContent = valorDe(k); v.classList.remove("oculto"); }
      K.usar();
    });
    li.querySelector(".cf-copiar")?.addEventListener("click", async () => {
      try {
        const v = k === "otp" ? (await codigoOtp(it.otp)).codigo : valorDe(k);
        await K.copiar(String(v ?? "")); toast(SECRETOS.has(k) || k === "otp" || k.startsWith("extra-") ? "Copiado (some da área de transferência em 45 s)" : "Copiado");
      } catch { toast("Não deu para copiar"); }
    });
  });
  $(".cf-fav").onclick = async () => { await K.salvarItem({ ...it, fav: !it.fav }); desenhar(); };
  $(".cf-editar").onclick = () => { atual = { ...it, campos: (it.campos || []).map(c => ({ ...c })) }; tela = "editar"; desenhar(); };
  $(".cf-apagar").onclick = async () => {
    if (!(await confirmar(`Apagar “${esc(it.titulo || "este item")}”?`, "Some deste aparelho e dos outros na próxima sincronização."))) return;
    await K.apagarItem(it.id); atual = null; tela = "lista"; toast("Apagado"); desenhar();
  };
  if (it.otp) {
    const pintar = async () => {
      try {
        const r = await codigoOtp(it.otp), el = $(".cf-otp-cod"); if (!el) return;
        el.textContent = `${r.codigo.slice(0, Math.ceil(r.codigo.length / 2))} ${r.codigo.slice(Math.ceil(r.codigo.length / 2))}`;
        $(".cf-otp-anel").style.setProperty("--p", `${(r.resta / r.periodo) * 100}%`);
      } catch { const el = $(".cf-otp-cod"); if (el) el.textContent = "segredo inválido"; }
    };
    pintar(); timers.push(setInterval(pintar, 1000));
  }
}

// ---------- editor ----------
const campoEd = (k, rot, v, { tipo = "text", secreto = false, gerar = false, area = false, lista = "" } = {}) => `
  <label class="cf-campo">${esc(rot)}<span class="cf-linha">${area ? `<textarea data-k="${k}" rows="4" autocapitalize="off" spellcheck="false" class="${secreto ? "cf-seg" : ""}">${esc(v || "")}</textarea>` :
    `<input data-k="${k}" type="${secreto ? "password" : tipo}" value="${esc(v || "")}" autocomplete="off" autocapitalize="off" spellcheck="false" ${lista ? `list="${lista}"` : ""}>`}
    ${secreto && !area ? `<button type="button" class="cf-ic cf-ver" aria-label="Mostrar">${IC.olho}</button>` : ""}${gerar ? `<button type="button" class="cf-ic cf-gerar" aria-label="Gerar">${IC.dado}</button>` : ""}</span></label>`;
function telaEditar(it) {
  const novo = !it.id, t = it.tipo || "conta";
  const gruposUsados = [...new Set([...GRUPOS_SUGERIDOS, ...K.itens().map(i => i.grupo).filter(Boolean)])];
  raiz.innerHTML = `${topo(novo ? `Nova: ${TIPOS[t].nome.toLowerCase()}` : "Editar", { voltar: true })}
    <main class="cf-tela cf-editor">
      ${campoEd("titulo", "Nome", it.titulo)}
      ${t === "conta" ? `${campoEd("usuario", "Usuário ou e-mail", it.usuario, { tipo: "email" })}${campoEd("senha", "Senha", it.senha, { secreto: true, gerar: true })}<div class="cf-forca"><i></i><small></small></div>${campoEd("url", "Site ou app", it.url, { tipo: "url" })}${campoEd("otp", "Duas etapas: a chave de configuração (opcional)", it.otp, { secreto: true })}` : ""}
      ${t === "chave" ? `${campoEd("valor", "Token ou chave", it.valor, { secreto: true, gerar: true })}${campoEd("servico", "Onde usa (ex.: Órbita, Actions, OddsPapi)", it.servico)}${campoEd("vence", "Vence em (opcional)", it.vence, { tipo: "date" })}` : ""}
      ${t === "nota" ? campoEd("texto", "Texto", it.texto, { area: true, secreto: true }) : ""}
      ${campoEd("grupo", "Grupo (opcional)", it.grupo, { lista: "cf-grupos" })}<datalist id="cf-grupos">${gruposUsados.map(g => `<option value="${esc(g)}">`).join("")}</datalist>
      <h4>Campos extras <small>PIN, código de recuperação, pergunta de segurança…</small></h4>
      <div class="cf-extras">${(it.campos || []).map((c, i) => linhaExtra(c, i)).join("")}</div>
      <button type="button" class="cf-link cf-mais-extra">${IC.mais}<span>Campo extra</span></button>
      ${campoEd("notas", "Notas", it.notas, { area: true })}
      <div class="cf-botoes"><button class="cf-botao cf-salvar">Guardar</button><button class="cf-botao sec cf-cancelar">Cancelar</button></div>
    </main>`;
  ligarTopo();
  const ed = $(".cf-editor");
  ed.querySelectorAll(".cf-ver").forEach(b => b.onclick = () => { const i = b.parentElement.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; });
  const sen = ed.querySelector('[data-k="senha"]');
  const pintarForca = () => { const bar = ed.querySelector(".cf-forca"); if (!bar || !sen) return; const f = forca(sen.value); bar.dataset.nivel = f.nivel; bar.querySelector("small").textContent = sen.value ? f.rotulo : ""; };
  if (sen) { sen.oninput = pintarForca; pintarForca(); }
  ed.querySelectorAll(".cf-gerar").forEach(b => b.onclick = async () => {
    const i = b.parentElement.querySelector("input");
    const qual = await folha(`<h3>Gerar</h3><div class="cf-tipos"><button data-v="forte"><span>🎲</span><b>Senha forte</b><small>20 caracteres com símbolos</small></button><button data-v="sem"><span>🔤</span><b>Sem símbolos</b><small>20 letras e números (sites chatos)</small></button><button data-v="frase"><span>💬</span><b>Frase-senha</b><small>palavras: fácil de digitar</small></button></div>`);
    if (!qual) return;
    i.value = qual === "frase" ? gerarFrase(5) : gerarSenha({ tamanho: 20, simbolos: qual === "forte" }); i.type = "text"; pintarForca();
  });
  const extras = ed.querySelector(".cf-extras");
  const ligarExtras = () => extras.querySelectorAll(".cf-extra").forEach(x => { x.querySelector(".cf-tirar").onclick = () => x.remove(); });
  ed.querySelector(".cf-mais-extra").onclick = () => { extras.insertAdjacentHTML("beforeend", linhaExtra({ nome: "", valor: "", secreto: true }, extras.children.length)); ligarExtras(); };
  ligarExtras();
  ed.querySelector(".cf-cancelar").onclick = () => { tela = novo ? "lista" : "item"; if (novo) atual = null; desenhar(); };
  ed.querySelector(".cf-salvar").onclick = async () => {
    const v = { ...it, tipo: t };
    ed.querySelectorAll(":scope > .cf-campo [data-k]").forEach(el => { v[el.dataset.k] = el.value.trim() === "" ? "" : (el.dataset.k === "texto" || el.dataset.k === "notas" ? el.value : el.value.trim()); });
    v.campos = [...extras.querySelectorAll(".cf-extra")].map(x => ({ nome: x.querySelector(".cf-x-nome").value.trim(), valor: x.querySelector(".cf-x-valor").value, secreto: x.querySelector(".cf-x-seg").checked })).filter(c => c.nome || c.valor);
    if (!v.titulo) { toast("Dê um nome (ex.: GitHub, Google da conta secundária)"); ed.querySelector('[data-k="titulo"]').focus(); return; }
    if (v.otp) { try { await codigoOtp(v.otp); v.otp = lerOtp(v.otp).segredo && v.otp; } catch { toast("A chave de duas etapas não parece válida (base32 ou otpauth://)"); return; } }
    for (const k of Object.keys(v)) if (v[k] === "") delete v[k];
    const salvo = await K.salvarItem(v);
    atual = { id: salvo.id }; tela = "item"; toast("Guardado no cofre"); desenhar();
  };
}
const linhaExtra = (c, i) => `<div class="cf-extra" style="--k:${i}"><input class="cf-x-nome" placeholder="Nome" value="${esc(c.nome)}" autocomplete="off" autocapitalize="off"><input class="cf-x-valor" placeholder="Valor" value="${esc(c.valor)}" type="${c.secreto ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false"><label class="cf-x-s"><input type="checkbox" class="cf-x-seg" ${c.secreto ? "checked" : ""}>secreto</label><button type="button" class="cf-ic cf-tirar" aria-label="Tirar">×</button></div>`;

// ---------- folhas e ajustes ----------
function folha(html) {
  return new Promise(ok => {
    const f = document.createElement("div"); f.className = "cf-folha-fundo";
    f.innerHTML = `<div class="cf-folha" role="dialog">${html}</div>`;
    raiz.append(f);
    const fim = (v) => { f.remove(); ok(v); };
    f.addEventListener("click", (e) => { if (e.target === f) fim(null); const b = e.target.closest("[data-v]"); if (b) fim(b.dataset.v); });
    f._fim = fim;
  });
}
const confirmar = async (titulo, texto) => (await folha(`<h3>${titulo}</h3><p class="cf-sub">${texto}</p><div class="cf-botoes"><button class="cf-botao ruim" data-v="sim">Apagar</button><button class="cf-botao sec" data-v="">Cancelar</button></div>`)) === "sim";
function pedirSenha(titulo, texto = "", rotulo = "Senha mestra") {
  return new Promise(ok => {
    const f = document.createElement("div"); f.className = "cf-folha-fundo";
    f.innerHTML = `<div class="cf-folha"><h3>${esc(titulo)}</h3>${texto ? `<p class="cf-sub">${texto}</p>` : ""}<label class="cf-campo">${esc(rotulo)}<input type="password" class="cf-ps" autocomplete="off" autocapitalize="off" spellcheck="false"></label><div class="cf-botoes"><button class="cf-botao cf-ok">Continuar</button><button class="cf-botao sec cf-nao">Cancelar</button></div></div>`;
    raiz.append(f);
    const i = f.querySelector(".cf-ps"); setTimeout(() => i.focus(), 50);
    const fim = (v) => { f.remove(); ok(v); };
    f.querySelector(".cf-ok").onclick = () => fim(i.value); f.querySelector(".cf-nao").onclick = () => fim(null);
    i.onkeydown = (e) => { if (e.key === "Enter") fim(i.value); };
    f.addEventListener("click", (e) => { if (e.target === f) fim(null); });
  });
}
async function outraSenha() {
  const s = await pedirSenha("A senha mestra mudou", "Em outro aparelho o cofre foi cifrado com uma senha nova. Digite a senha nova: os dois lados se juntam e este aparelho passa a usar ela.", "Senha mestra nova");
  if (!s) return;
  try { await K.abrirComOutraSenha(s); toast("Juntado com a senha nova"); } catch (e) { toast(e.message === "senha" ? "Senha errada" : `Não deu: ${e.message}`); }
  desenhar();
}
async function folhaAjustes() {
  const s = await K.situacao({ remoto: false }), c = K.cfg(), sinc = K.situacaoSinc();
  const f = document.createElement("div"); f.className = "cf-folha-fundo";
  f.innerHTML = `<div class="cf-folha cf-ajustes-f">
    <h3>Ajustes do cofre</h3>
    ${s.digital.disponivel ? `<label class="cf-opc"><span><b>Abrir com a digital</b><small>${s.digital.guardado ? "Ligada neste celular" : "Desligada"}</small></span><input type="checkbox" class="cf-o-dig" ${s.digital.guardado ? "checked" : ""}></label>` : Capacitor.isNativePlatform?.() ? `<p class="cf-sub">Este celular não tem digital forte cadastrada: o cofre abre só com a senha.</p>` : ""}
    <label class="cf-opc"><span><b>Fechar sozinho</b><small>sem uso por</small></span><select class="cf-o-min">${[1, 3, 5, 15].map(m => `<option value="${m}" ${m === c.minutos ? "selected" : ""}>${m} min</option>`).join("")}</select></label>
    <div class="cf-opc"><span><b>Sincronização</b><small>${sinc ? (sinc.ok ? `cifrado, ${new Date(sinc.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : esc(sinc.erro)) : "ainda não"}</small></span><button class="cf-botao sec cf-o-sinc">Agora</button></div>
    <button class="cf-link cf-o-trocar">Trocar a senha mestra</button>
    <button class="cf-link cf-o-exp">Salvar um backup cifrado (arquivo)</button>
    <label class="cf-link cf-o-imp">Juntar um backup<input type="file" accept=".orbitacofre,.json,application/json" hidden></label>
    <button class="cf-link ruim cf-o-apagar">Apagar o cofre deste aparelho</button>
    <div class="cf-botoes"><button class="cf-botao sec cf-o-fim">Fechar</button></div></div>`;
  raiz.append(f);
  const fim = () => { f.remove(); desenhar(); };
  f.addEventListener("click", (e) => { if (e.target === f) fim(); });
  f.querySelector(".cf-o-fim").onclick = fim;
  f.querySelector(".cf-o-min").onchange = (e) => { K.definirCfg({ minutos: +e.target.value }); K.usar(); };
  f.querySelector(".cf-o-dig")?.addEventListener("change", async (e) => {
    if (e.target.checked) {
      const sm = await pedirSenha("Ligar a digital", "Confirme a senha mestra; depois o celular pede a digital.");
      if (!sm) { e.target.checked = false; return; }
      try { await K.ligarDigital(sm); toast("Digital ligada"); } catch (er) { e.target.checked = false; toast(er.message === "senha" ? "Senha errada" : "A digital não foi ligada"); }
    } else { await K.desligarDigital(); toast("Digital desligada"); }
  });
  f.querySelector(".cf-o-sinc").onclick = async () => {
    try { const r = await K.sincronizar(); toast(r.semToken ? "Sem o token do GitHub (Ajustes do Órbita)" : r.outraSenha ? "A senha mudou em outro aparelho" : r.ok ? "Sincronizado" : "Não sincronizou"); if (r.outraSenha) { fim(); outraSenha(); } }
    catch (er) { toast(`Não sincronizou: ${er.message}`); }
  };
  f.querySelector(".cf-o-trocar").onclick = async () => {
    const a = await pedirSenha("Trocar a senha mestra", "Primeiro, a senha de agora.", "Senha de agora"); if (!a) return;
    const n1 = await pedirSenha("Senha nova", "Uma frase de 4 palavras ou mais. Nos outros aparelhos, o cofre vai pedir a senha nova uma vez.", "Senha nova"); if (!n1) return;
    if (forca(n1).nivel < 3 || n1.length < 10) return toast("Senha nova fraca: use uma frase de 4 palavras ou mais", 4000);
    const n2 = await pedirSenha("Repita a senha nova", "", "Senha nova de novo"); if (n2 !== n1) return toast("As duas não batem");
    try { await K.trocarSenha(a, n1); toast("Senha trocada. Ligue a digital de novo, se usava.", 4000); fim(); } catch (er) { toast(er.message === "senha" ? "A senha de agora está errada" : `Não deu: ${er.message}`); }
  };
  f.querySelector(".cf-o-exp").onclick = async () => {
    try {
      const txt = await K.envelopeParaBackup(), nome = `cofre-orbita-${new Date().toISOString().slice(0, 10)}.orbitacofre`;
      if (Capacitor.isNativePlatform?.()) {
        const Filesystem = registerPlugin("Filesystem"), Share = registerPlugin("Share");
        const { uri } = await Filesystem.writeFile({ path: `cofre/${nome}`, data: btoa(unescape(encodeURIComponent(txt))), directory: "CACHE", recursive: true });
        await Share.share({ title: nome, files: [uri], dialogTitle: "Guardar o backup do cofre" }).catch(() => {});
      } else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
      toast("Backup pronto: ele é cifrado com a senha mestra de hoje", 4000);
    } catch (er) { toast(`Não deu: ${er.message}`); }
  };
  f.querySelector(".cf-o-imp input").onchange = async (e) => {
    const arq = e.target.files?.[0]; if (!arq) return;
    const sm = await pedirSenha("Juntar o backup", "A senha mestra do dia em que o backup foi salvo.");
    if (!sm) return;
    try { const n = await K.importarBackup(await arq.text(), sm); toast(`${n} itens juntados`); fim(); } catch (er) { toast(er.message === "senha" ? "Senha errada para esse backup" : "Arquivo inválido"); }
  };
  f.querySelector(".cf-o-apagar").onclick = async () => {
    if (!(await confirmar("Apagar o cofre deste aparelho?", "O do repositório (cifrado) e o dos outros aparelhos ficam. Para abrir aqui de novo, use a senha mestra."))) return;
    await K.apagarDesteAparelho(); f.remove(); toast("Apagado deste aparelho"); desenhar();
  };
}
