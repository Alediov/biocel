// Backup cifrado do OdontoScan: um arquivo .oscb, protegido por senha, com os DADOS das fichas (números já em
// código, leituras, revisões) e a chave dos códigos. Sem fotos e sem cópias (essas se refazem a partir da pasta das
// fotos, com "Refazer cópias que faltam"). O arquivo nunca vai para o GitHub: você guarda onde quiser.
// Formato: "OSCB1" + sal (16 bytes) + iv (12 bytes) + AES-256-GCM(zip com fichas.json, cfg.json, leia-me.txt),
// chave derivada da senha com PBKDF2-SHA256 (310 mil voltas).
import * as BD from "./banco.js";
import { zip, lerZip } from "./arquivos.js";
import { registrar } from "./historico.js";

const MAGICO = "OSCB1", VOLTAS = 310000;
const enc = new TextEncoder(), dec = new TextDecoder();
// o que vai da configuração: a chave dos códigos e preferências. Ficam de fora o token do GitHub, a chave da API,
// a pasta (é do aparelho) e a chave privada do aparelho (não sai do aparelho).
const LEVAR = ["chave", "chaveCriada", "estadoFila", "formato", "maximoNoite", "painelSoRevisadas", "autoEnviar", "meta", "metas", "sequencia", "concordancia"];

async function derivar(senha, sal) {
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: VOLTAS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** A chave do backup automático: derivada da senha UMA vez, guardada no banco como CryptoKey que não sai do navegador
 *  (a senha em si não fica guardada). Restaurar continua pedindo a senha (o sal vai no arquivo, como sempre). */
export async function chaveDeBackup(senha) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { chave: await derivar(senha, sal), sal };
}

/** Gera o arquivo do backup (Blob). `senha`: a senha, ou { chave, sal } de chaveDeBackup. */
export async function gerarBackup(senha) {
  const fichas = await BD.todasFichas(), cfg = {};
  for (const k of LEVAR) { const v = await BD.lerCfg(k); if (v !== undefined) cfg[k] = v; }
  const disp = await BD.lerCfg("dispositivo");
  const info = { criado: new Date().toISOString(), fichas: fichas.length, dispositivo: disp?.id || null, versao: 1 };
  const conteudo = await zip([
    { nome: "fichas.json", dados: JSON.stringify(fichas) },
    { nome: "cfg.json", dados: JSON.stringify(cfg) },
    { nome: "info.json", dados: JSON.stringify(info) },
    { nome: "leia-me.txt", dados: "Backup do Scanner do Órbita (dados das fichas da IC, com códigos no lugar de nome, CPF, CNS, prontuário e RA, e a chave dos códigos).\nRestaure pelo próprio Scanner: Lote → Chave e backup → Restaurar backup. Sem a senha, não há como abrir.\n" },
  ]);
  const pronta = typeof senha === "object" && senha?.chave;
  const sal = pronta ? senha.sal : crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, pronta ? senha.chave : await derivar(senha, sal), await conteudo.arrayBuffer());
  return { blob: new Blob([enc.encode(MAGICO), sal, iv, new Uint8Array(ct)], { type: "application/octet-stream" }), info };
}

/** Abre o arquivo do backup. Lança "senha" se a senha não confere. */
export async function lerBackup(arquivo, senha) {
  const b = new Uint8Array(await arquivo.arrayBuffer());
  if (dec.decode(b.subarray(0, 5)) !== MAGICO) throw new Error("Este arquivo não é um backup do Scanner.");
  const sal = b.subarray(5, 21), iv = b.subarray(21, 33);
  let claro;
  try { claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await derivar(senha, sal), b.subarray(33)); }
  catch { throw new Error("senha"); }
  const arqs = Object.fromEntries((await lerZip(new Blob([claro]))).filter(a => a.nome.endsWith(".json")).map(a => [a.nome, JSON.parse(dec.decode(a.dados))]));
  return { fichas: arqs["fichas.json"] || [], cfg: arqs["cfg.json"] || {}, info: arqs["info.json"] || {} };
}

const ORDEM = { erro: 0, confirmar: 1, pronta: 2, lida: 3, revisada: 4 };
const avanco = (f) => (ORDEM[f.etapa] ?? 0) * 10 + (f.leitura ? 5 : 0) + (f.enviada ? 1 : 0);

/**
 * Restaura: junta as fichas do backup com as do aparelho (fica a mais adiantada de cada uma).
 * `trocarChave`: usa a chave do backup (quando o aparelho não tem fichas, ou você escolheu substituir tudo).
 * Devolve { novas, atualizadas, iguais, semCopia }.
 */
export async function restaurar({ fichas, cfg, info }, { substituir = false } = {}) {
  if (substituir) await BD.apagarTudo();
  const aqui = new Map((await BD.todasFichas()).map(f => [f.id, f]));
  const disp = await BD.lerCfg("dispositivo");
  const outroAparelho = !disp || disp.id !== info.dispositivo;
  const temImg = await BD.chavesDeImagens();
  let novas = 0, atualizadas = 0, iguais = 0, semCopia = 0;
  const tirarDaFila = [];
  for (const f0 of fichas) {
    const f = { ...f0 };
    const atual = aqui.get(f.id);
    if (atual && avanco(atual) >= avanco(f)) { iguais++; continue; }
    // leitura recomeçada aqui (a revisão antiga virou gabarito): um backup de antes não traz a leitura antiga de volta
    if (atual?.gabarito && !f.gabarito) { iguais++; continue; }
    // as imagens que não existem neste aparelho saem da lista (se refazem pela pasta das fotos)
    const imgs = { ...(f.imgs || {}) };
    for (const nome of ["ficha", "endereco", "equipe"]) if (imgs[nome] && !temImg.has(`${f.id}|${nome}`)) delete imgs[nome];
    if (imgs.recortes) { imgs.recortes = imgs.recortes.filter(c => temImg.has(`${f.id}|recorte:${c}`)); if (!imgs.recortes.length) delete imgs.recortes; }
    f.imgs = imgs;
    if (f.etapa !== "erro" && !imgs.ficha) { f.semCopia = true; semCopia++; }
    // enviada por outro aparelho e ainda não lida: a resposta iria para a chave daquele aparelho; sobe de novo daqui
    if (outroAparelho && f.enviada && !f.leitura) { tirarDaFila.push(f.pacote); f.enviada = false; }
    registrar(f, "Restaurada do backup");
    await BD.salvarFicha(f);
    atual ? atualizadas++ : novas++;
  }
  if (cfg.chave && (substituir || !aqui.size || !(await BD.lerCfg("chave")))) for (const k of LEVAR) if (cfg[k] !== undefined) await BD.gravarCfg(k, cfg[k]);
  return { novas, atualizadas, iguais, semCopia, tirarDaFila };
}
