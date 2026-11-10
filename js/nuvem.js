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
    if (mudouLocal) { substituirEstado({ ...clonar(novo), config: E().config }); window.dispatchEvent(new Event("oq-topo")); }
    return mudouLocal;
  })().finally(() => { enviando = null; });
  return enviando;
}

function agendar() { clearTimeout(timer); timer = setTimeout(() => sincronizar().catch(e => console.warn("nuvem:", e)), 10000); }

export async function abrirRanking() {
  if (!sb || !membro) { telaRanking([], ultimoErro || "O ranking aparece quando o app estiver ligado à turma."); return; }
  const { data, error } = await sb.from("ranking").select("apelido, xp, xp_semana, licoes, ofensiva").order("xp_semana", { ascending: false }).limit(200);
  telaRanking(error ? [] : data, error ? "Não deu para carregar o ranking agora." : "");
}

function telaRanking(lista, aviso) {
  let por = "xp_semana";
  const t = telaCheia(`<h1>Ranking da turma</h1><div class="bc-abas"><button data-por="xp_semana" class="ativo">Esta semana</button><button data-por="xp">Total</button><button data-por="ofensiva">Ofensiva</button></div>
    <ol class="bc-rank" id="bc-lista"></ol><p>${esc(aviso)}</p><button class="botao" id="bc-fechar">Fechar</button>`);
  const pintar = () => {
    const l = [...lista].sort((a, b) => (b[por] || 0) - (a[por] || 0));
    t.querySelector("#bc-lista").innerHTML = l.map((r, i) => `<li class="${membro && r.apelido === membro.apelido ? "eu" : ""}"><b>${i + 1}º</b><span>${esc(r.apelido)}<br><small>${r.licoes} ${r.licoes === 1 ? "lição" : "lições"} · 🔥 ${r.ofensiva}</small></span><b>${por === "ofensiva" ? r.ofensiva + " d" : (r[por] || 0) + " XP"}</b></li>`).join("") || "<li><span></span><span>Ninguém ainda.</span></li>";
  };
  t.querySelectorAll("[data-por]").forEach(b => b.onclick = () => { por = b.dataset.por; t.querySelectorAll("[data-por]").forEach(x => x.classList.toggle("ativo", x === b)); pintar(); });
  t.querySelector("#bc-fechar").onclick = () => t.remove();
  pintar();
}

export function situacao() { return { ligado: !!sb, usuario: usuario?.email || null, apelido: membro?.apelido || null }; }
export async function sair() { if (sb) await sb.auth.signOut(); try { localStorage.removeItem(K_BASE); } catch (e) {} location.reload(); }

async function iniciar() {
  window.addEventListener("biocel-ranking", () => abrirRanking());
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
