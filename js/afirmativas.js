// Enunciados de concurso com afirmativas I, II, III… (pedido do Alediov, 05/11/2026): puro, sem DOM.

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
/** "… analise as afirmativas. I. … II. … III. … Está correto o que se afirma em:" → {intro, itens: [[n, texto]], pergunta}.
 *  Só com I e II em sequência (sem pular número); senão null e o enunciado fica como texto corrido. */
export function separarAfirmativas(txt) {
  const s = String(txt ?? "").replace(/\s+/g, " ").trim();
  const marcas = [];
  let de = 0;
  for (const n of ROMANOS) {
    // o número romano no começo, depois de pontuação/":" ou de uma quebra, seguido de "." ")" "–" ou "-"
    const re = new RegExp(`(^|[.:;?!)]\\s+|\\s)${n}\\s*[.)–-]\\s+(?=\\S)`, "g");
    re.lastIndex = de;
    const m = re.exec(s);
    if (!m) break;
    const ini = m.index + m[1].length;
    marcas.push({ n, ini, txt: m.index + m[0].length });
    de = m.index + m[0].length;
  }
  if (marcas.length < 2 || marcas[0].n !== "I") return null;
  const intro = s.slice(0, marcas[0].ini).trim();
  const itens = marcas.map((m, i) => [m.n, s.slice(m.txt, i + 1 < marcas.length ? marcas[i + 1].ini : s.length).trim()]);
  // a pergunta do fim ("Está correto o que se afirma em:", "Assinale a alternativa correta.") sai da última afirmativa
  let pergunta = "";
  const ult = itens[itens.length - 1];
  const p = ult[1].match(/^(.*?[.!?])\s+((?:Est[áa]|Est[ãa]o|É|S[ãa]o|Assinale|Marque|Quais|Pode-se|Indique|Considerando|Com base|Sobre as afirmativas|A\(s\) afirmativa)[^]*)$/);
  if (p) { ult[1] = p[1].trim(); pergunta = p[2].trim(); }
  if (itens.some(([, t]) => !t)) return null;
  return { intro, itens, pergunta };
}
