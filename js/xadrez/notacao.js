// Notação e explicações do Xadrez do Órbita (pedido do Alediov, 02/11/2026: "me incomoda a forma de explicar as
// aberturas, pois está muito direta, com muitas abreviações… Eu gostaria de ambas as notações, ou seja, uma linha
// mostrando a notação correta com Cxf3, por exemplo. E uma explicando com o nome da peça. Além de dizer a razão de cada
// movimento").
//
// - `sanPT`: a notação em português (R rei, D dama, T torre, B bispo, C cavalo; O-O e O-O-O ficam). TODA a interface do
//   Xadrez mostra os lances por ela; o chess.js continua recebendo o SAN em inglês.
// - `textoPT`: troca os lances em inglês que aparecem num texto ("4.Nf3", "Qc7") pelos em português (usado ao montar o
//   repertório; os textos novos já são escritos com as letras inglesas e passam por aqui).
// - `fraseLance`: a frase com o nome da peça ("As brancas capturam o peão em f3 com o cavalo.").
// - `porqueAutomatico`: o motivo de um lance comum (roque, recaptura, desenvolvimento, centro, lance de borda), usado
//   quando o lance não tem explicação escrita à mão.
// - `GLOSSARIO` + `marcarTermos`: na primeira vez que um termo (fianqueto, casa fraca, cravada…) aparece, o texto
//   ganha a explicação entre parênteses; depois, o termo fica sublinhado e o toque mostra a explicação.
// Sem DOM: o montar_repertorio.mjs (node) também usa este módulo.

const PT = { K: "R", Q: "D", R: "T", B: "B", N: "C" };
/** "Nxf3+" → "Cxf3+", "exd8=Q#" → "exd8=D#", "Kg1" → "Rg1". */
export function sanPT(san) {
  if (!san) return "";
  return String(san).replace(/^[KQRBN]/, (p) => PT[p]).replace(/=([QRBN])/, (_, p) => "=" + PT[p]);
}
/** Os lances em inglês dentro de um texto: "4...Nc6", "Qc7", "(Bb5+)". Só letras de peça seguidas de uma casa. */
export function textoPT(txt) {
  if (!txt) return txt;
  return String(txt)
    .replace(/(^|[^A-Za-zÀ-ÿ])([KQRN])([a-h]?[1-8]?x?[a-h][1-8])/g, (_, a, p, r) => a + PT[p] + r)
    .replace(/=([QRN])\b/g, (_, p) => "=" + PT[p]);
}
const NOME = { p: "peão", n: "cavalo", b: "bispo", r: "torre", q: "dama", k: "rei" };
const ART = { p: "o", n: "o", b: "o", r: "a", q: "a", k: "o" };
export const nomePeca = (p, comArtigo = true) => (comArtigo ? `${ART[p]} ${NOME[p]}` : NOME[p]);
const LADO = { w: "As brancas", b: "As pretas" };
/** O número do lance: "5." para as brancas, "5..." para as pretas (`ply` começa em 0). */
export const numeroLance = (ply) => `${Math.floor(ply / 2) + 1}${ply % 2 ? "..." : "."}`;
/** O lance com o número, em português: "5...Cc6". */
export const lanceNumerado = (san, ply) => `${numeroLance(ply)}${sanPT(san)}`;

/**
 * A frase do lance com o nome da peça. `mv` é o lance "verbose" do chess.js ({ color, piece, from, to, captured,
 * promotion, flags, san }).
 */
export function fraseLance(mv, { lado = true } = {}) {
  if (!mv) return "";
  const quem = lado ? LADO[mv.color] : "";
  const fl = mv.flags || "";
  let f;
  if (fl.includes("k")) f = `${quem ? quem + " fazem" : "Faz"} o roque pequeno: o rei vai para ${mv.color === "w" ? "g1" : "g8"} e a torre, para ${mv.color === "w" ? "f1" : "f8"}`;
  else if (fl.includes("q")) f = `${quem ? quem + " fazem" : "Faz"} o roque grande: o rei vai para ${mv.color === "w" ? "c1" : "c8"} e a torre, para ${mv.color === "w" ? "d1" : "d8"}`;
  else if (fl.includes("e")) f = `${quem ? quem + " capturam" : "Captura"} en passant: o peão de ${mv.from[0]} toma o peão que acabou de passar e vai para ${mv.to}`;
  else if (mv.captured) f = `${quem ? quem + " capturam" : "Captura"} ${nomePeca(mv.captured)} em ${mv.to} com ${mv.piece === "p" ? `o peão de ${mv.from[0]}` : nomePeca(mv.piece)}`;
  else if (mv.piece === "p" && fl.includes("b")) f = `${quem ? quem + " avançam" : "Avança"} o peão de ${mv.from[0]} duas casas, para ${mv.to}`;
  else f = `${quem ? quem + " levam" : "Leva"} ${nomePeca(mv.piece)} ${mv.piece === "p" ? `de ${mv.from[0]} ` : ""}para ${mv.to}`;
  if (mv.promotion) f += ` e o promovem a ${NOME[mv.promotion]}`;
  if (/#$/.test(mv.san || "")) f += ". Xeque-mate!";
  else if (/\+$/.test(mv.san || "")) f += ", dando xeque.";
  else f += ".";
  return f;
}

const CENTRO = ["d4", "e4", "d5", "e5"], CENTRO_AMPLO = ["c4", "c5", "f4", "f5"];
const CASA_INICIAL = { n: ["b1", "g1", "b8", "g8"], b: ["c1", "f1", "c8", "f8"] };
/**
 * O motivo de um lance comum, sem explicação escrita. `antes` é o lance anterior (verbose) para reconhecer recapturas.
 * Devolve "" quando não há nada simples e verdadeiro a dizer.
 */
export function porqueAutomatico(mv, antes = null) {
  if (!mv) return "";
  const fl = mv.flags || "";
  if (fl.includes("k") || fl.includes("q")) return "O roque tira o rei do centro, onde as colunas costumam se abrir, e põe a torre em jogo. É a regra de ouro da abertura: rocar cedo.";
  if (mv.captured && antes?.captured && antes.to === mv.to) return "Recaptura: devolve o equilíbrio do material (cada lado ganhou uma peça do mesmo valor ou parecido).";
  if (/\+$/.test(mv.san) && !mv.captured) return "Um xeque obriga o adversário a responder ao xeque antes de qualquer outra coisa: serve para ganhar tempo ou tirar o rei de casa.";
  if ((mv.piece === "n" || mv.piece === "b") && CASA_INICIAL[mv.piece].includes(mv.from)) return `Desenvolvimento: tira ${nomePeca(mv.piece)} da casa inicial e o põe para trabalhar, de olho no centro. Na abertura, cada lance deve trazer uma peça nova para o jogo.`;
  if (mv.piece === "p" && CENTRO.includes(mv.to) && !mv.captured) return "Peão no centro: ocupa as casas mais importantes do tabuleiro e abre caminho para as peças saírem.";
  if (mv.piece === "p" && CENTRO_AMPLO.includes(mv.to) && !mv.captured) return "Peão de flanco atacando o centro: disputa as casas centrais pelo lado, sem bloquear as próprias peças.";
  if (mv.piece === "p" && ["h3", "h6", "a3", "a6"].includes(mv.to)) {
    const alvo = { h3: "g4", h6: "g5", a3: "b4", a6: "b5" }[mv.to];
    return `Lance de borda com função: o peão controla ${alvo}, onde uma peça adversária gostaria de se instalar, e ainda dá uma "janela" ao rei no futuro.`;
  }
  if (mv.piece === "q" && (mv.from === "d1" || mv.from === "d8")) return "A dama sai, mas para uma casa segura, de onde não é perseguida pelas peças menores.";
  return "";
}

// Os termos que costumam aparecer nas explicações (pedido dele: "sem jargão sem explicação").
export const GLOSSARIO = {
  "fianqueto": "o bispo vai para a diagonal grande (g2 ou b2, g7 ou b7) depois de avançar o peão da frente uma casa",
  "roque": "o lance do rei e da torre juntos: o rei anda duas casas para o lado e a torre pula para o outro lado dele",
  "desenvolvimento": "tirar as peças (cavalos, bispos, dama e torres) das casas iniciais e pôr para trabalhar",
  "desenvolver": "tirar uma peça da casa inicial e pôr para trabalhar",
  "gambito": "entregar um peão (às vezes mais) no começo da partida para ganhar tempo, centro ou ataque",
  "cravada": "a peça atacada não pode sair do lugar porque deixaria uma peça mais valiosa (ou o rei) atrás dela exposta",
  "cravar": "atacar uma peça que, se sair, deixa uma peça mais valiosa (ou o rei) exposta atrás",
  "casa fraca": "uma casa que nenhum peão seu consegue mais defender: o adversário pode pôr uma peça lá sem ser expulso",
  "posto avançado": "uma casa no campo do adversário, protegida por um peão seu, onde nenhum peão dele pode expulsar a sua peça",
  "coluna aberta": "uma coluna sem peões: as torres e a dama correm por ela até o campo do adversário",
  "coluna semiaberta": "uma coluna onde só o adversário tem peão: a sua torre pressiona esse peão",
  "peão isolado": "um peão sem peões do mesmo lado nas colunas vizinhas: ninguém o defende com peão",
  "peões dobrados": "dois peões do mesmo lado na mesma coluna (um atrás do outro)",
  "peão passado": "um peão que não tem nenhum peão adversário na frente nem nas colunas vizinhas: o caminho até a promoção está livre",
  "par de bispos": "ter os dois bispos contra bispo e cavalo (ou dois cavalos): em posições abertas, vale um pouco mais",
  "bispo ruim": "o bispo que anda nas casas da mesma cor dos seus próprios peões centrais, que tapam o caminho dele",
  "bispo bom": "o bispo que anda nas casas de cor contrária à dos seus peões centrais, com as diagonais livres",
  "cadeia de peões": "peões em diagonal, um defendendo o outro (por exemplo d4 e e5): a base da cadeia é o ponto a atacar",
  "ruptura": "o lance de peão que ataca a cadeia de peões do adversário para abrir o jogo",
  "iniciativa": "ser quem faz as ameaças: o adversário passa a só responder",
  "ganhar tempo": "fazer um lance útil que obriga o adversário a gastar um lance respondendo",
  "perder tempo": "gastar um lance sem melhorar a posição (mexer a mesma peça de novo sem motivo, por exemplo)",
  "ataque descoberto": "uma peça sai da frente e outra, atrás dela, passa a atacar",
  "garfo": "uma peça atacando duas (ou mais) ao mesmo tempo",
  "espaço": "o território controlado atrás dos seus peões: com mais espaço, as suas peças se mexem com folga",
  "contrajogo": "as ameaças que o lado que está sendo atacado cria do outro lado do tabuleiro",
  "ataque das minorias": "avançar dois peões da ala da dama contra três do adversário para criar uma fraqueza nele",
  "estrutura de peões": "o desenho dos peões dos dois lados: ele decide os planos da partida",
  "diagonal grande": "a diagonal mais longa do tabuleiro (a1–h8 ou h1–a8), que passa pelo centro",
  "ala da dama": "as colunas a, b e c (o lado onde a dama começa)",
  "ala do rei": "as colunas f, g e h (o lado onde o rei começa e costuma rocar)",
  "en passant": "a captura especial do peão que avançou duas casas e passou ao lado de um peão adversário",
  "compensação": "o que se ganha (tempo, ataque, centro) em troca do material entregue",
  "tempo": "um lance: \"ganhar um tempo\" é fazer o adversário gastar um lance à toa",
  "peões pendentes": "dois peões vizinhos, lado a lado no centro (como c5 e d5), sem peões ao lado: fortes, mas alvos",
  "centro": "as casas d4, e4, d5 e e5 (e as vizinhas): quem manda nelas tem mais espaço e as peças mais ativas",
};
const TERMOS = Object.keys(GLOSSARIO).sort((a, b) => b.length - a.length);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tirarAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/**
 * Marca os termos do glossário num texto (já escapado para HTML). `vistos` é o conjunto dos termos que ele já viu
 * explicados: na primeira vez, o termo vem com a explicação entre parênteses (e entra em `vistos`); depois, só
 * sublinhado, com a explicação no toque (`data-termo`). Cada termo é marcado uma vez por texto.
 */
export function marcarTermos(html, vistos = new Set()) {
  if (!html) return html;
  const usados = new Set(), base = tirarAcento(html);
  const achados = [];
  for (const t of TERMOS) {
    if (t === "tempo" || t === "centro" || t === "desenvolver") continue; // comuns demais: só quando forem o assunto
    const tt = tirarAcento(t);
    let i = -1;
    for (;;) {
      i = base.indexOf(tt, i + 1);
      if (i < 0) break;
      const antes = base[i - 1], depois = base[i + tt.length];
      if ((antes && /[a-z0-9]/.test(antes)) || (depois && /[a-z0-9]/.test(depois) && !/^s$/.test(depois))) continue;
      if (achados.some(a => i < a.fim && i + tt.length > a.ini)) continue; // dentro de um termo maior
      if (usados.has(t)) break;
      // não marcar dentro de uma tag
      const abre = html.lastIndexOf("<", i), fecha = html.lastIndexOf(">", i);
      if (abre > fecha) continue;
      achados.push({ ini: i, fim: i + tt.length + (depois === "s" ? 1 : 0), t });
      usados.add(t);
      break;
    }
  }
  achados.sort((a, b) => b.ini - a.ini);
  let out = html;
  for (const a of achados) {
    const pal = out.slice(a.ini, a.fim), novo = !vistos.has(a.t);
    out = out.slice(0, a.ini) + `<span class="xz-termo" data-termo="${esc(a.t)}">${pal}</span>${novo ? ` <span class="xz-termo-exp">(${esc(a.t)}: ${esc(GLOSSARIO[a.t])})</span>` : ""}` + out.slice(a.fim);
    vistos.add(a.t);
  }
  return out;
}
