// Nomes nas Músicas (pedidos do Alediov, 09/11/2026), puro e sem DOM (teste: node tools/musicas/teste_nomes.mjs):
// - `nomeEmUso`: o nome de uma tag ou de um grupo já existe? Igual (sem maiúsculas e acentos, ou com as duas partes
//   trocadas: "Blue Lock (ブルーロック)" = "ブルーロック (Blue Lock)") bloqueia; parecido em qualquer parte (antes ou
//   dentro dos parênteses, pela escrita e pelo som: ブルーロック ≈ Blue Lock, romaji.js) só avisa.
// - `ordenarTags`/`ordenarGrupos`: as ordens da aba Tags (nome, entre parênteses, leitura em romaji, músicas, recentes).
// - `conferirNome`: o nome do arquivo × o título ("Lua (1).mp3", "Lua - Cópia.mp3" → "Lua.mp3").
import { normTag } from "./tagsInternas.js";
import { normEscrita, parecenca, romaji } from "./romaji.js";

/** "ブルーロック (Blue Lock)" → { principal: "ブルーロック", sub: "Blue Lock" }. */
export function partesTag(nome) {
  const m = String(nome || "").match(/^(.+?)\s*[(（]([^()（）]+)[)）]\s*$/);
  return m ? { principal: m[1].trim(), sub: m[2].trim() } : { principal: String(nome || "").trim(), sub: "" };
}
const limpo = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Quanto um nome parece outro já usado: { vazio } | { igual: nome | null, parecidos: [{ nome, nota, parte }] }.
 *  `parte`: "nome" (o nome todo), "principal" ou "parenteses" (qual parte do NOVO bateu). `ignorar`: o próprio nome
 *  (ao renomear). Parecido a partir de `minimo` (0,7: mesmo esqueleto de 3+ consoantes, um dentro do outro…). */
export function nomeEmUso(nome, existentes, { ignorar = null, minimo = 0.7 } = {}) {
  const n = limpo(nome);
  if (!n) return { vazio: true, igual: null, parecidos: [] };
  const pn = partesTag(n), ign = ignorar ? normTag(ignorar) : null;
  const chaveTroca = (p) => `${normTag(p.principal)}|${normTag(p.sub)}`;
  let igual = null;
  const parecidos = [];
  for (const e of existentes || []) {
    const ex = limpo(e);
    if (!ex || (ign && normTag(ex) === ign)) continue;
    const pe = partesTag(ex);
    if (normTag(ex) === normTag(n) || (pn.sub && pe.sub && chaveTroca(pn) === `${normTag(pe.sub)}|${normTag(pe.principal)}`)) { igual ??= ex; continue; }
    let nota = 0, parte = "nome";
    const meu = [["nome", n], ["principal", pn.principal], ...(pn.sub ? [["parenteses", pn.sub]] : [])];
    const dele = [ex, pe.principal, ...(pe.sub ? [pe.sub] : [])];
    for (const [qual, a] of meu) for (const b of dele) {
      const v = normEscrita(a) && normEscrita(a) === normEscrita(b) ? 1 : parecenca(a, b);
      if (v > nota) { nota = v; parte = qual; }
    }
    if (nota >= minimo) parecidos.push({ nome: ex, nota, parte });
  }
  parecidos.sort((a, b) => b.nota - a.nota || a.nome.localeCompare(b.nome, "pt-BR"));
  return { vazio: false, igual, parecidos: parecidos.slice(0, 3) };
}

// ---------- ordem ----------
export const ORDENS_TAGS = [
  { id: "nome", rotulo: "Nome (A–Z)" },
  { id: "parenteses", rotulo: "Entre parênteses (A–Z)" },
  { id: "leitura", rotulo: "Leitura em romaji (A–Z)" },
  { id: "musicas", rotulo: "Mais músicas" },
  { id: "recentes", rotulo: "Mais recentes" },
];
export const ORDEM_PADRAO = "nome";
const col = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
/** A chave de texto de um nome em cada ordem alfabética. */
export function chaveOrdem(nome, modo) {
  const p = partesTag(nome);
  if (modo === "parenteses") return p.sub || p.principal;
  if (modo === "leitura") return romaji(p.principal) || p.principal;
  return p.principal;
}
const porTexto = (modo) => (a, b) => col.compare(chaveOrdem(a.nome, modo), chaveOrdem(b.nome, modo)) || col.compare(a.nome, b.nome);
/** Ordena tags { nome, n, pos } (pos: ordem em que foram criadas; -1 = desconhecida, a mais antiga). Devolve uma cópia. */
export function ordenarTags(lista, modo = ORDEM_PADRAO) {
  const l = [...(lista || [])];
  if (modo === "musicas") return l.sort((a, b) => (b.n || 0) - (a.n || 0) || porTexto("nome")(a, b));
  if (modo === "recentes") return l.sort((a, b) => (b.pos ?? -1) - (a.pos ?? -1) || porTexto("nome")(a, b));
  return l.sort(porTexto(ORDENS_TAGS.some(o => o.id === modo) ? modo : ORDEM_PADRAO));
}
/** Ordena os grupos { nome, fixa, pos, tags }: os fixos ficam no lugar (na ordem de sempre, no começo) e os dele
 *  seguem a ordem escolhida (Mais músicas = a soma das músicas das tags). */
export function ordenarGrupos(lista, modo = ORDEM_PADRAO) {
  const fixos = (lista || []).filter(c => c.fixa), dele = (lista || []).filter(c => !c.fixa);
  const soma = (c) => (c.tags || []).reduce((a, t) => a + (t.n || 0), 0);
  return [...fixos, ...ordenarTags(dele.map(c => ({ ...c, n: soma(c) })), modo).map(c => dele.find(x => x.nome === c.nome))];
}

// ---------- nome do arquivo ----------
/** O nome de arquivo de um título (o mesmo do salvarTags). */
export const nomeArquivo = (s) => (s || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Sem título";
// os sinais de cópia que o Android, o Windows e os navegadores põem: "Lua (1)", "Lua - Cópia", "Lua - Copy (2)",
// "Lua Cópia", "Lua (copy)" ("copy" solto não: "Carbon Copy" é título)
const SINAL_COPIA = /\s*(?:\((?:\d{1,2}|c[oó]pia|copy)\)|[-–—_]\s*(?:c[oó]pia|copy)(?:\s*\(?\d{1,2}\)?)?|\sc[oó]pia(?:\s*\(?\d{1,2}\)?)?)\s*$/i;
/** O nome sem os sinais de cópia do fim (vários seguidos também: "Lua (1) (2)"). */
export function semSinalDeCopia(base) {
  let b = String(base || ""), antes;
  do { antes = b; b = b.replace(SINAL_COPIA, ""); } while (b && b !== antes);
  return b.trim() || String(base || "");
}
export const temSinalDeCopia = (base) => semSinalDeCopia(base) !== String(base || "").trim();
/** Para comparar nomes de arquivo como o cartão SD (sem diferenciar maiúsculas; NFC). */
export const chaveArquivo = (s) => String(s || "").normalize("NFC").toLocaleLowerCase("pt-BR");
/** O nome do arquivo de `caminho` está certo para `titulo`? null, ou { nome, motivo } com motivo "copia" (só os sinais
 *  de cópia sobram), "maiusculas" (só maiúsculas e minúsculas) ou "titulo" (outro nome). A extensão fica como está. */
export function conferirNome(caminho, titulo) {
  const atual = String(caminho || "").split("/").pop();
  const ext = atual.match(/\.[^.]+$/)?.[0] || "", base = atual.slice(0, atual.length - ext.length);
  if (!titulo || !base) return null;
  const nome = nomeArquivo(titulo) + ext;
  if (atual.normalize("NFC") === nome.normalize("NFC")) return null;
  const semCopia = semSinalDeCopia(base) + ext;
  const motivo = semCopia.normalize("NFC") === nome.normalize("NFC") || (semCopia !== atual && chaveArquivo(semCopia) === chaveArquivo(nome)) ? "copia"
    : chaveArquivo(atual) === chaveArquivo(nome) ? "maiusculas" : "titulo";
  return { nome, motivo };
}
/** O título que um arquivo sem a tag de título sugere: sem o número da faixa no começo e sem os sinais de cópia. */
export const tituloDoArquivo = (nomeArq) => semSinalDeCopia(String(nomeArq || "").replace(/\.[^.\/]+$/, "").replace(/^\d{1,3}[\s._-]+/, ""));
