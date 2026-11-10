// Separa o texto colado de uma novel em capítulos (pedido do Alediov, 25/10/2026: ele cola os capítulos em inglês do
// site onde lê; a tarefa da madrugada traduz). Aceita um ou vários capítulos de uma vez: cada um começa numa linha
// "Chapter 12", "Chapter 12: Título", "Ch. 12 - Título", "Episode 12" ou "Capítulo 12". Sem nenhum título, vira um
// capítulo só, com o número `proximo`. Limpa linhas de navegação comuns ("Previous Chapter", "Next", "Table of Contents").
//
// O favorito "Copiar capítulo" (tools/novel/copiar-capitulo.js, 26/10/2026) produz "# Chapter 12: Título" (com "#")
// e os parágrafos separados por linha em branco, um capítulo atrás do outro. Quando o texto tem essas linhas com "#",
// SÓ elas abrem capítulo: uma frase do meio do texto que comece por "Chapter 3…" não parte o capítulo em dois.
const TITULO = /^\s*(?:#{1,3}\s*)?(?:chapter|ch\.?|episode|ep\.?|cap[ií]tulo)\s*(\d{1,4})\b\s*[:\-–—.]?\s*(.*)$/i;
const MARCADO = /^\s*#{1,3}\s*(?:chapter|cap[ií]tulo)\s*\d{1,4}\b/i;
const LIXO = /^\s*(?:previous(?: chapter)?|next(?: chapter)?|table of contents|index|←.*|.*→|report|comments?|share|support us.*|advertisement|translator:.*|editor:.*|tl(?:\/|\s)?(?:note|n)?:?.*)\s*$/i;

/** [{ n, titulo, texto }] na ordem em que vieram (sem repetir número: fica o último). */
export function separarCapitulos(bruto, proximo = 1) {
  const linhas = String(bruto || "").replace(/\r\n?/g, "\n").replace(/[\u00a0\u2009]/g, " ").replace(/\u200b/g, "").split("\n");
  const estrito = linhas.some(l => MARCADO.test(l));
  const caps = [];
  let atual = null;
  for (const linha of linhas) {
    const m = linha.match(TITULO);
    if (m && linha.trim().length < 140 && (!estrito || MARCADO.test(linha))) {
      atual = { n: +m[1], titulo: m[2].trim().replace(/^[:\-–—.\s]+/, ""), linhas: [] };
      caps.push(atual);
      continue;
    }
    if (LIXO.test(linha) && linha.trim().length < 60) continue;
    if (!atual) {
      if (!linha.trim()) continue;
      atual = { n: proximo, titulo: "", linhas: [] }; caps.push(atual);
    }
    atual.linhas.push(linha);
  }
  const porN = new Map();
  for (const c of caps) {
    const texto = c.linhas.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (texto.length < 200) continue; // título solto ou sobra de navegação
    porN.set(c.n, { n: c.n, titulo: c.titulo, texto });
  }
  return [...porN.values()];
}

/** O arquivo que vai para o repositório (`novels/<id>/en/0012.md`). */
export const nomeArquivo = (n) => `${String(n).padStart(4, "0")}.md`;
export const conteudoArquivo = (c) => `# Chapter ${c.n}${c.titulo ? `: ${c.titulo}` : ""}\n\n${c.texto}\n`;
