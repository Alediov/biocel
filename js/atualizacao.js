// Atualizar o Órbita pelo próprio app (pedido do Alediov, 25/10/2026). Ao abrir (uma vez por dia) e pelo Perfil,
// procura a última versão nas Releases do GitHub; se for mais nova que a instalada, mostra o que mudou (as notas
// que o workflow monta com as mensagens dos commits) e, com um toque, baixa o APK e abre o instalador
// (plugin nativo "Atualizar"). Só no celular.
import { E, salvar, hojeISO } from "./estado.js";
import { modal, toast, escapar } from "./ui.js";
import { Capacitor, registerPlugin } from "../vendor/capacitor-core.js";

const num = (v) => String(v || "").replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
export const maisNova = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

async function versaoInstalada() {
  try { return (await registerPlugin("App").getInfo()).version; } catch { return null; }
}
async function ultimaRelease() {
  const c = E().config, h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (c.token?.trim()) h.Authorization = `Bearer ${c.token.trim()}`;
  const r = await fetch(`https://api.github.com/repos/${c.repo.trim()}/releases/latest`, { headers: h, cache: "no-store" });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  return r.json();
}
/** O que mudou: as linhas "- …" da seção "O que mudou" da release. */
export function notasDe(body = "") {
  const m = body.split(/O que mudou:?\s*\n/i)[1] || "";
  return m.split("\n").map(l => l.trim()).filter(l => l.startsWith("- ")).map(l => l.slice(2)).slice(0, 15);
}

export async function verificarAtualizacao({ manual = false } = {}) {
  if (!Capacitor.isNativePlatform?.()) { if (manual) toast("A atualização pelo app é só no celular."); return; }
  const c = E().config;
  if (!manual && c.atualizacaoVista === hojeISO()) return;
  if (!navigator.onLine) { if (manual) toast("Sem internet agora."); return; }
  let rel, inst;
  try { [rel, inst] = await Promise.all([ultimaRelease(), versaoInstalada()]); }
  catch (e) { if (manual) toast(`Não deu para procurar: ${e.message}`, 4000); return; }
  c.atualizacaoVista = hojeISO(); salvar();
  const nova = rel.tag_name?.replace(/^v/, "");
  if (!inst || !nova || !maisNova(nova, inst)) { if (manual) toast(`Você já está na versão mais nova (${inst || "?"}).`); return; }
  const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name) && !/demo/i.test(a.name));
  if (!apk) { if (manual) toast("A versão nova ainda não tem o APK."); return; }
  const notas = notasDe(rel.body);
  const ok = await modal({
    titulo: `Versão ${nova} disponível`,
    html: `<p class="sub">Você está na ${escapar(inst)}.</p>${notas.length ? `<ul class="notas-versao">${notas.map(n => `<li>${escapar(n)}</li>`).join("")}</ul>` : ""}`,
    botoes: [{ texto: "Atualizar agora", valor: true }, { texto: "Depois", classe: "secundario", valor: false }],
  });
  if (ok) await baixar(apk, nova);
}

async function baixar(apk, nova) {
  const A = registerPlugin("Atualizar");
  toast("Baixando a versão nova…", 60000);
  const ouvinte = await A.addListener("progresso", (p) => { if (p.total > 0) toast(`Baixando a versão nova… ${Math.round((p.feito / p.total) * 100)}%`, 60000); });
  try {
    const r = await A.baixarEInstalar({ url: apk.url, token: E().config.token?.trim() || "", nome: `Orbita-${nova}.apk` });
    toast("", 1);
    if (r?.permissao === false) {
      const ok = await modal({ titulo: "Falta uma permissão", texto: "Na tela que abriu, ligue \"Permitir desta fonte\" para o Órbita, volte aqui e toque em Instalar. Só é preciso uma vez.", botoes: [{ texto: "Instalar", valor: true }, { texto: "Agora não", classe: "secundario", valor: false }] });
      if (ok) await A.instalarBaixado().catch(e => toast(e.message, 4000));
    }
  } catch (e) { toast(`Não deu para baixar: ${e.message}`, 4500); }
  finally { ouvinte?.remove?.(); }
}
