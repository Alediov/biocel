// App BioCel: login pelo Google, entrada na turma e o progresso na nuvem (Supabase).
// Sem configuração (nuvemConfig.js vazio), o app funciona só neste aparelho, como a Demo.
// O estado inteiro vai para a tabela `progresso` (com um resumo para o ranking); a junção entre
// aparelhos é a mesma do Órbita (juntar.js), com a última versão vista guardada em localStorage.
import { E, salvar, substituirEstado, definirAoSalvar, hojeISO, somaDias } from "./estado.js";
import { juntar, clonar, igual } from "./juntar.js";
import { URL_SUPABASE, CHAVE_SUPABASE } from "./nuvemConfig.js";

const K_BASE = "biocel.base", K_REV = "biocel.rev";
let sb = null, usuario = null, membro = null, enviando = null, timer = null;

const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem espaço */ } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// o que não vai para a nuvem (do aparelho)
const LOCAIS = ["config", "_mod"];
const semLocais = (e) => { const c = clonar(e); for (const k of LOCAIS) delete c[k]; return c; };

function carregarScript(src) {
  return new Promise((ok, erro) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => erro(new Error("não carregou " + src)); document.head.append(s); });
}

function css() {
  if (document.getElementById("bc-css")) return;
  const st = document.createElement("style"); st.id = "bc-css";
  st.textContent = `
.bc-tela{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:var(--fundo);color:var(--tinta);padding:24px max(16px,env(safe-area-inset-right,0px)) 24px max(16px,env(safe-area-inset-left,0px));overflow:auto}
.bc-cx{width:min(420px,100%);display:grid;gap:14px;text-align:center}
.bc-cx h1{margin:0;font-size:1.7rem}.bc-cx p{margin:0;color:var(--tinta-2,var(--tinta));line-height:1.45}
.bc-cx input{font:inherit;font-size:1.05rem;padding:13px 14px;border-radius:14px;border:2px solid color-mix(in srgb,var(--tinta) 22%,transparent);background:color-mix(in srgb,var(--tinta) 6%,var(--fundo));color:var(--tinta);text-align:center}
.bc-cx .botao{width:100%}.bc-erro{color:var(--errado-texto);font-weight:600;min-height:1.2em}
.bc-google{display:flex;align-items:center;justify-content:center;gap:10px}
.bc-rank{display:grid;gap:6px;margin:8px 0 0;padding:0;list-style:none;text-align:left;max-height:60vh;overflow:auto}
.bc-rank li{display:grid;grid-template-columns:2.2em 1fr auto;gap:8px;align-items:center;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--tinta) 7%,var(--fundo));color:var(--tinta);border:1px solid color-mix(in srgb,var(--tinta) 14%,transparent)}
.bc-rank li.eu{outline:2px solid var(--acento)}.bc-rank b{font-variant-numeric:tabular-nums}.bc-rank small{color:var(--tinta-2,var(--tinta))}
.bc-abas{display:flex;gap:6px;justify-content:center}.bc-abas button{font:inherit;padding:6px 12px;border-radius:999px;border:1px solid color-mix(in srgb,var(--tinta) 22%,transparent);background:transparent;color:var(--tinta);cursor:pointer}
.bc-aviso{position:fixed;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:61;padding:12px 14px;border-radius:14px;background:var(--errado-fundo);color:var(--errado-texto);border:1px solid var(--errado);font-size:.9rem}
.bc-sim{display:grid;gap:8px;margin:0;padding:0;list-style:none;text-align:left}
.bc-sim a{display:grid;gap:2px;padding:14px;border-radius:14px;text-decoration:none;background:color-mix(in srgb,var(--tinta) 7%,var(--fundo));color:var(--tinta);border:1px solid color-mix(in srgb,var(--tinta) 14%,transparent)}
.bc-sim a b::after{content:" ›";color:var(--acento)}.bc-sim small{color:var(--tinta-2,var(--tinta))}
.bc-rk{place-items:start center;background:var(--fundo-solido,var(--fundo))}
.bc-rk-cx{width:min(520px,100%);display:grid;gap:16px}
.bc-rk header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.bc-rk h1{margin:0;font-size:1.5rem}
.bc-rk header small{color:var(--tinta-2,var(--tinta));font-size:.85rem}
.bc-x{font:inherit;width:40px;height:40px;flex:none;border-radius:50%;border:1px solid color-mix(in srgb,var(--tinta) 18%,transparent);background:color-mix(in srgb,var(--tinta) 6%,var(--fundo-solido,var(--fundo)));color:var(--tinta);cursor:pointer}
.bc-seg{display:grid;grid-template-columns:repeat(3,1fr);padding:4px;border-radius:14px;background:color-mix(in srgb,var(--tinta) 8%,var(--fundo-solido,var(--fundo)))}
.bc-seg button{font:inherit;font-weight:600;font-size:.9rem;padding:9px 4px;border:0;border-radius:10px;background:transparent;color:var(--tinta-2,var(--tinta));cursor:pointer}
.bc-seg button.ativo{background:var(--acento);color:#fff;box-shadow:0 2px 8px color-mix(in srgb,var(--acento) 40%,transparent)}
.bc-av{width:var(--t);height:var(--t);flex:none;border-radius:50%;display:grid;place-items:center;background:var(--c);color:#fff;font-weight:800;font-size:calc(var(--t)*.38);letter-spacing:.02em;box-shadow:0 0 0 3px var(--fundo-solido,var(--fundo)),0 0 0 5px color-mix(in srgb,var(--c) 45%,transparent)}
.bc-podio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:8px;padding-top:6px}
.bc-pd{display:grid;justify-items:center;gap:4px;text-align:center;min-width:0}
.bc-pd-n{font-size:.95rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bc-pd-n i,.bc-nm i{font-style:normal;font-weight:500;color:var(--tinta-2,var(--tinta))}
.bc-pd-v{font-size:.85rem;font-weight:700;color:var(--tinta-2,var(--tinta));font-variant-numeric:tabular-nums}
.bc-pd-base{width:100%;border-radius:12px 12px 4px 4px;display:grid;place-items:start center;padding-top:8px;font-weight:900;font-size:1.4rem;color:#fff;margin-top:4px}
.bc-pd.p1 .bc-pd-base{height:96px;background:linear-gradient(#F2B33D,#D4920F)}.bc-pd.p2 .bc-pd-base{height:70px;background:linear-gradient(#B9C3D3,#8B97AB)}.bc-pd.p3 .bc-pd-base{height:52px;background:linear-gradient(#D69A63,#A8693A)}
.bc-pd.eu .bc-pd-base{outline:3px solid var(--acento);outline-offset:2px}
.bc-lst{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.bc-lst li{display:grid;grid-template-columns:2em auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:color-mix(in srgb,var(--tinta) 6%,var(--fundo-solido,var(--fundo)));border:1px solid color-mix(in srgb,var(--tinta) 12%,transparent)}
.bc-lst li.eu{border-color:var(--acento);background:color-mix(in srgb,var(--acento) 14%,var(--fundo-solido,var(--fundo)))}
.bc-pos{font-weight:800;text-align:center;color:var(--tinta-2,var(--tinta));font-variant-numeric:tabular-nums}
.bc-nm{display:grid;gap:3px;min-width:0}.bc-nm b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bc-nm small{font-size:.78rem;color:var(--tinta-2,var(--tinta))}
.bc-bar{display:block;height:5px;border-radius:9px;background:color-mix(in srgb,var(--tinta) 12%,transparent);overflow:hidden}.bc-bar i{display:block;height:100%;border-radius:9px;background:var(--acento)}
.bc-val{font-variant-numeric:tabular-nums;white-space:nowrap}
.bc-vazio{display:block!important;text-align:center;color:var(--tinta-2,var(--tinta))}.bc-rk-aviso{margin:0;text-align:center;color:var(--tinta-2,var(--tinta))}
.bc-abas button.ativo{background:var(--acento);border-color:var(--acento);color:#fff}`;
  document.head.append(st);
}

let ultimoErro = "";
function avisar(msg) {
  ultimoErro = msg; css();
  document.querySelector(".bc-aviso")?.remove();
  const a = document.createElement("div"); a.className = "bc-aviso"; a.setAttribute("role", "alert");
  a.textContent = msg + " (toque para fechar)"; a.onclick = () => a.remove();
  document.body.append(a); setTimeout(() => a.remove(), 15000);
}

function telaCheia(html) {
  css();
  document.querySelector(".bc-tela")?.remove();
  const t = document.createElement("div"); t.className = "bc-tela"; t.innerHTML = `<div class="bc-cx">${html}</div>`;
  document.body.append(t);
  return t;
}

const GOOGLE = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

function pedirLogin() {
  const t = telaCheia(`<h1>BioCel</h1><p>Lições curtas e a leitura dos capítulos da prova, com o seu progresso salvo em qualquer aparelho.</p>
    <button class="botao bc-google" id="bc-entrar">${GOOGLE}<span>Entrar com o Google</span></button>
    <p class="bc-erro" id="bc-erro"></p>
    <p style="font-size:.85rem">Só o seu apelido aparece para a turma. O e-mail fica só no login.</p>`);
  t.querySelector("#bc-entrar").onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    if (error) t.querySelector("#bc-erro").textContent = "Não deu para entrar: " + error.message;
  };
}

function pedirTurma() {
  return new Promise((ok) => {
    const nome = (usuario.user_metadata?.full_name || "").split(" ")[0] || "";
    const t = telaCheia(`<h1>Entrar na turma</h1><p>Escolha um apelido (é ele que aparece no ranking) e digite o código que o monitor passou no grupo.</p>
      <input id="bc-apelido" maxlength="20" placeholder="Apelido" value="${esc(nome)}" autocomplete="nickname">
      <input id="bc-codigo" maxlength="12" placeholder="Código da turma" autocapitalize="characters" autocomplete="off">
      <button class="botao" id="bc-ok">Entrar</button><p class="bc-erro" id="bc-erro"></p>
      <button class="botao secundario" id="bc-sair">Usar outra conta</button>`);
    const erro = (m) => { t.querySelector("#bc-erro").textContent = m; };
    t.querySelector("#bc-sair").onclick = async () => { await sb.auth.signOut(); location.reload(); };
    t.querySelector("#bc-ok").onclick = async () => {
      const apelido = t.querySelector("#bc-apelido").value.trim(), codigo = t.querySelector("#bc-codigo").value.trim();
      if (apelido.length < 2) return erro("O apelido precisa de pelo menos 2 letras.");
      const { data, error } = await sb.rpc("entrar_na_turma", { p_codigo: codigo, p_apelido: apelido });
      if (error) return erro("Não deu certo: " + error.message);
      if (data === "codigo") return erro("Esse código não existe. Confira com o monitor.");
      if (data === "apelido") return erro("Alguém da turma já usa esse apelido.");
      t.remove(); ok();
    };
  });
}

function resumo(e) {
  const hoje = hojeISO(), d = new Date(hoje + "T12:00:00"), seg = somaDias(hoje, -((d.getDay() + 6) % 7));
  let xpSemana = 0; for (let k = 0; k < 7; k++) xpSemana += e.diario?.[somaDias(seg, k)]?.xp || 0;
  const resp = Object.values(e.respostas || {}).flat().filter(r => r.tentativa === 1);
  return { xp: e.xp || 0, xp_semana: xpSemana, semana: seg, licoes: Object.keys(e.concluidas || {}).length,
    ofensiva: e.ofensiva?.atual || 0, acerto: resp.length ? resp.filter(r => r.acertou).length / resp.length : null };
}

/** Lê a nuvem, junta com o aparelho e grava. Devolve true se o estado local mudou. */
async function sincronizar() {
  if (!sb || !membro) return false;
  if (enviando) return enviando;
  enviando = (async () => {
    const { data: linha, error } = await sb.from("progresso").select("estado, rev").eq("user_id", usuario.id).maybeSingle();
    if (error) throw error;
    const local = semLocais(E()), base = ler(K_BASE) ?? undefined;
    let novo = local, mudouLocal = false;
    if (linha?.estado) {
      const remoto = linha.estado;
      if (base === undefined && !Object.keys(E().concluidas || {}).length) novo = remoto;        // aparelho novo: fica com a nuvem
      else novo = juntar(base, local, remoto, true);
      mudouLocal = !igual(novo, local);
    }
    const rev = (linha?.rev || 0) + 1;
    const r = resumo(novo);
    const { error: e2 } = await sb.from("progresso").upsert({ user_id: usuario.id, estado: novo, rev, ...r, atualizado: new Date().toISOString() });
    if (e2) throw e2;
    gravar(K_BASE, novo); gravar(K_REV, rev);
    atualizarLiga().catch(() => {});
    if (mudouLocal) { substituirEstado({ ...clonar(novo), config: E().config }); window.dispatchEvent(new Event("oq-topo")); }
    return mudouLocal;
  })().finally(() => { enviando = null; });
  return enviando;
}

/** A turma desta semana para a liga (apelido e XP da semana), guardada para abrir sem rede. */
const K_LIGA = "biocel.turmaLiga";
try { const t = JSON.parse(localStorage.getItem(K_LIGA) || "null"); if (t) globalThis.__turmaLiga = t; } catch {}
async function atualizarLiga() {
  if (!sb || !membro) return;
  const { data, error } = await sb.from("ranking").select("apelido, xp_semana").limit(300);
  if (error || !data) return;
  const hoje = hojeISO(), d = new Date(hoje + "T12:00:00"), semana = somaDias(hoje, -((d.getDay() + 6) % 7));
  const t = { semana, em: Date.now(), lista: data.map(r => ({ apelido: r.apelido, xp_semana: r.xp_semana || 0, eu: r.apelido === membro.apelido })) };
  globalThis.__turmaLiga = t; gravar(K_LIGA, t);
}

function agendar() { clearTimeout(timer); timer = setTimeout(() => sincronizar().catch(e => console.warn("nuvem:", e)), 10000); }

/** Simulados para imprimir (PDF no próprio site, com o gabarito na última página). */
export async function abrirSimulados() {
  let lista = [];
  try { lista = await (await fetch("simulados/lista.json", { cache: "no-cache" })).json(); } catch { /* sem rede */ }
  const t = telaCheia(`<h1>Simulados para imprimir</h1><p>Imprima, faça à mão e sem consultar, marcando o tempo, como na prova. O gabarito está na última página de cada um.</p>
    <ul class="bc-sim">${lista.length ? lista.map(s => `<li><a href="simulados/${esc(s.arq)}" target="_blank" rel="noopener"><b>${esc(s.titulo)}</b><small>${esc(s.sub)} · cerca de ${s.tempo} min · PDF A4</small></a></li>`).join("")
      : "<li><small>Não deu para carregar a lista agora. Confira a internet e tente de novo.</small></li>"}</ul>
    <p style="font-size:.85rem">Dica: faça o 1 e o 2 durante a semana e deixe o 3 (revisão final) para a véspera da prova.</p>
    <button class="botao" data-fechar>Fechar</button>`);
  t.querySelector("[data-fechar]").onclick = () => t.remove();
}

export async function abrirRanking() {
  if (!sb || !membro) { telaRanking([], ultimoErro || "O ranking aparece quando o app estiver ligado à turma."); return; }
  const { data, error } = await sb.from("ranking").select("apelido, xp, xp_semana, licoes, ofensiva").order("xp_semana", { ascending: false }).limit(200);
  telaRanking(error ? [] : data, error ? "Não deu para carregar o ranking agora." : "");
}

const CORES_AV = ["#2F6BFF", "#E2557A", "#12A37A", "#E0A512", "#8B5CF6", "#E0434A", "#0EA5B7", "#C2502A"];
const corDe = (n) => CORES_AV[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES_AV.length];
const iniciais = (n) => n.trim().split(/\s+/).slice(0, 2).map(p => [...p][0] || "").join("").toUpperCase();
const avatarR = (n, tam) => `<span class="bc-av" style="--c:${corDe(n)};--t:${tam}px">${esc(iniciais(n))}</span>`;
const valorR = (r, por) => por === "ofensiva" ? `${r.ofensiva || 0} ${r.ofensiva === 1 ? "dia" : "dias"}` : `${(r[por] || 0).toLocaleString("pt-BR")} XP`;

function telaRanking(lista, aviso) {
  let por = "xp_semana";
  css();
  document.querySelector(".bc-tela")?.remove();
  const t = document.createElement("div"); t.className = "bc-tela bc-rk"; t.setAttribute("role", "dialog"); t.setAttribute("aria-label", "Ranking da turma");
  t.innerHTML = `<div class="bc-rk-cx">
    <header><div><h1>Ranking da turma</h1><small>${lista.length} ${lista.length === 1 ? "colega" : "colegas"} na turma</small></div><button class="bc-x" aria-label="Fechar">✕</button></header>
    <div class="bc-seg" role="tablist"><button data-por="xp_semana" class="ativo">Esta semana</button><button data-por="xp">Total</button><button data-por="ofensiva">Ofensiva</button></div>
    <div id="bc-podio"></div><ol class="bc-lst" id="bc-lista"></ol>${aviso ? `<p class="bc-rk-aviso">${esc(aviso)}</p>` : ""}</div>`;
  document.body.append(t);
  const fechar = () => t.remove();
  t.querySelector(".bc-x").onclick = fechar;
  const pintar = () => {
    const l = [...lista].sort((a, b) => (b[por] || 0) - (a[por] || 0) || a.apelido.localeCompare(b.apelido));
    const max = Math.max(1, ...l.map(r => r[por] || 0)), eu = (r) => membro && r.apelido === membro.apelido;
    const ordem = [1, 0, 2].filter(i => l[i]);
    t.querySelector("#bc-podio").innerHTML = l.length ? `<div class="bc-podio">${ordem.map(i => { const r = l[i];
      return `<div class="bc-pd p${i + 1} ${eu(r) ? "eu" : ""}">${avatarR(r.apelido, i === 0 ? 64 : 52)}<b class="bc-pd-n">${esc(r.apelido)}${eu(r) ? " <i>(você)</i>" : ""}</b><span class="bc-pd-v">${valorR(r, por)}</span><div class="bc-pd-base"><span>${i + 1}</span></div></div>`; }).join("")}</div>` : "";
    t.querySelector("#bc-lista").innerHTML = l.slice(3).map((r, k) => `<li class="${eu(r) ? "eu" : ""}"><span class="bc-pos">${k + 4}</span>${avatarR(r.apelido, 38)}
      <span class="bc-nm"><b>${esc(r.apelido)}${eu(r) ? " <i>(você)</i>" : ""}</b><small>${r.licoes || 0} ${r.licoes === 1 ? "lição" : "lições"} · 🔥 ${r.ofensiva || 0}</small><i class="bc-bar"><i style="width:${Math.round((r[por] || 0) / max * 100)}%"></i></i></span>
      <b class="bc-val">${valorR(r, por)}</b></li>`).join("") || (l.length > 3 ? "" : l.length ? "" : `<li class="bc-vazio">Ninguém da turma ainda.</li>`);
    const meu = l.findIndex(eu);
    t.querySelector("header small").textContent = `${l.length} ${l.length === 1 ? "colega" : "colegas"} na turma${meu >= 0 ? ` · você está em ${meu + 1}º` : ""}`;
  };
  t.querySelectorAll("[data-por]").forEach(b => b.onclick = () => { por = b.dataset.por; t.querySelectorAll("[data-por]").forEach(x => x.classList.toggle("ativo", x === b)); pintar(); });
  pintar();
}

/** No Perfil: a conta (apelido, e-mail) e Sair. */
export function contaNoPerfil(el) {
  if (!el) return;
  const d = document.createElement("div"); d.className = "bc-conta";
  if (!sb || !usuario) { d.innerHTML = `<p class="sub" style="margin:0">Sem login: o progresso fica só neste aparelho.</p>`; el.append(d); return; }
  d.innerHTML = `<div class="linha-cfg"><span>Apelido na turma<small class="sub" style="display:block;font-size:12px">${esc(membro?.apelido || "")}</small></span></div>
    <div class="linha-cfg"><span>Conta<small class="sub" style="display:block;font-size:12px">${esc(usuario.email || "")}</small></span></div>
    <button class="botao secundario" type="button">Sair desta conta</button>`;
  d.querySelector("button").onclick = () => sair();
  el.append(d);
}

export function situacao() { return { ligado: !!sb, usuario: usuario?.email || null, apelido: membro?.apelido || null }; }
export async function sair() {
  try { await sincronizar(); } catch (e) { /* sem internet: o que já subiu fica */ }
  if (sb) await sb.auth.signOut();
  // o progresso está na nuvem: o aparelho fica limpo para a próxima pessoa
  try { for (const k of [K_BASE, K_REV, "oq.estado.v1"]) localStorage.removeItem(k); } catch (e) {}
  location.reload();
}

async function iniciar() {
  window.addEventListener("biocel-ranking", () => abrirRanking());
  window.addEventListener("biocel-simulados", () => abrirSimulados());
  if (!URL_SUPABASE || !CHAVE_SUPABASE) return;          // sem nuvem: só no aparelho
  try { await carregarScript("vendor/supabase.js"); } catch (e) { avisar("Não carregou o login: " + e.message); return; }
  sb = window.supabase.createClient(URL_SUPABASE, CHAVE_SUPABASE, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { pedirLogin(); return; }
  usuario = session.user;
  let { data: m, error: e1 } = await sb.from("membros").select("apelido, turma").eq("user_id", usuario.id).maybeSingle();
  if (e1) { avisar("Não deu para ligar à turma: " + e1.message); return; }
  if (!m) {
    await pedirTurma();
    let e2; ({ data: m, error: e2 } = await sb.from("membros").select("apelido, turma").eq("user_id", usuario.id).maybeSingle());
    if (e2 || !m) { avisar("Não deu para ligar à turma: " + (e2?.message || "cadastro não encontrado")); return; }
  }
  membro = m;
  // a Leitura (caps. 18 e 19) vem do bucket privado "leitura": só para quem está na turma
  globalThis.__baixarLeitura = async (caminho) => {
    const { data, error } = await sb.storage.from("leitura").download(caminho);
    return error || !data ? null : new Response(data, { headers: { "Content-Type": caminho.endsWith(".json") ? "application/json" : "image/webp" } });
  };
  definirAoSalvar(agendar);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sincronizar().catch(() => {}); else agendar(); });
  try {
    const mudou = await sincronizar();
    if (mudou && !sessionStorage.getItem("biocel.recarregou")) { sessionStorage.setItem("biocel.recarregou", "1"); location.reload(); }
  } catch (e) { console.warn("nuvem:", e); avisar("O progresso não foi salvo na nuvem: " + (e.message || e)); }
}

iniciar().catch(e => console.warn("nuvem:", e));
