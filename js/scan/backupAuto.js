// Backup automático toda semana (29/10/2026, sugestão aceita pelo Alediov): no computador do laboratório, as fichas
// conferidas existem só no banco do navegador; uma vez por semana o OdontoScan.html grava sozinho o backup cifrado
// (o mesmo .oscb do "Fazer backup") numa pasta escolhida, como um pendrive, e guarda os 4 mais novos.
// A senha não fica guardada: a chave é derivada dela uma vez e guardada como CryptoKey que não sai do navegador.
// O navegador só deixa gravar na pasta depois de um toque seu na sessão: sem isso, o cartão "Chave e backup" mostra
// "Gravar o backup da semana" (um toque basta).
import * as BD from "./banco.js";
import { gerarBackup, chaveDeBackup } from "./backup.js";

export const DIAS = 7, GUARDAR = 4;
const PREFIXO = "odontoscan-semanal-";
const pode = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/** { ligado, nome, ultimo, dias (desde o último), devido, permissao: "granted" | "prompt" | "denied" | null } */
export async function situacao() {
  const c = await BD.lerCfg("backupAuto");
  if (!pode() || !c?.pasta || !c?.chave) return { ligado: false, possivel: pode() };
  let permissao = null;
  try { permissao = await c.pasta.queryPermission({ mode: "readwrite" }); } catch { /* */ }
  const dias = c.ultimo ? Math.floor((Date.now() - new Date(c.ultimo)) / 864e5) : null;
  return { ligado: true, possivel: true, nome: c.nome || c.pasta.name, ultimo: c.ultimo || null, dias, devido: dias === null || dias >= DIAS, permissao, erro: c.erro || null };
}

/** Liga: escolha a pasta (chame no toque do botão, antes de qualquer espera) e depois a senha. */
export async function escolherPasta() {
  const pasta = await window.showDirectoryPicker({ id: "odontoscan-backup", mode: "readwrite" });
  return pasta;
}
export async function ligar(pasta, senha) {
  const { chave, sal } = await chaveDeBackup(senha);
  await BD.gravarCfg("backupAuto", { pasta, nome: pasta.name, chave, sal, ligadoEm: new Date().toISOString(), ultimo: null });
  return fazerAgora({ pedir: true });
}
export async function desligar() { await BD.gravarCfg("backupAuto", null); }

/** Grava o backup agora (com `pedir`, pede a permissão da pasta: só dentro de um toque). Devolve { ok, fichas, nome } ou { ok: false, motivo }. */
export async function fazerAgora({ pedir = false } = {}) {
  const c = await BD.lerCfg("backupAuto");
  if (!c?.pasta || !c?.chave) return { ok: false, motivo: "desligado" };
  let p = "prompt";
  try { p = await c.pasta.queryPermission({ mode: "readwrite" }); if (p !== "granted" && pedir) p = await c.pasta.requestPermission({ mode: "readwrite" }); } catch { /* */ }
  if (p !== "granted") return { ok: false, motivo: "permissao" };
  try {
    const { blob, info } = await gerarBackup({ chave: c.chave, sal: c.sal });
    const nome = `${PREFIXO}${new Date().toISOString().slice(0, 10)}.oscb`;
    const arq = await c.pasta.getFileHandle(nome, { create: true });
    const w = await arq.createWritable(); await w.write(blob); await w.close();
    // os 4 mais novos ficam; os outros semanais saem (os backups feitos à mão nunca são apagados)
    const velhos = [];
    for await (const [n, h] of c.pasta.entries()) if (h.kind === "file" && n.startsWith(PREFIXO) && n.endsWith(".oscb")) velhos.push(n);
    velhos.sort().reverse();
    for (const n of velhos.slice(GUARDAR)) { try { await c.pasta.removeEntry(n); } catch { /* */ } }
    const agora = new Date().toISOString();
    await BD.gravarCfg("backupAuto", { ...c, ultimo: agora, erro: null });
    await BD.gravarCfg("ultimoBackup", agora);
    return { ok: true, fichas: info.fichas, nome, tamanho: blob.size };
  } catch (e) {
    await BD.gravarCfg("backupAuto", { ...c, erro: `${e.name === "NotFoundError" ? "a pasta não está mais lá (pendrive tirado?)" : e.message}` });
    return { ok: false, motivo: "erro", erro: e.message };
  }
}

let tentado = 0;
/** Ao abrir e de tempos em tempos: grava sozinho se passou de 7 dias e o navegador já deixou gravar na pasta. */
export async function talvezFazer() {
  if (!pode() || Date.now() - tentado < 3600e3) return null;
  tentado = Date.now();
  const s = await situacao();
  if (!s.ligado || !s.devido || s.permissao !== "granted") return null;
  return fazerAgora();
}
