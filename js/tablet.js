// Tablet (pedido do Alediov, 25/10/2026): nos Estudos tudo é desenhado para a largura de um celular (560 px); num
// tablet, sobrava uma coluna estreita no meio com as peças pequenas. Aqui o app aumenta tudo na mesma proporção (CSS
// `zoom` nos contêineres dos Estudos: #app, lição, modais, painéis do topo, simulado, tocador de voz, foco), até 1,45×,
// pela largura e pela altura (no tablet deitado, a altura manda). As outras áreas já usam a largura toda e ficam como
// estão; os minijogos (canvas) também, para o toque continuar certo.
const LARGURA_BASE = 600, ALTURA_BASE = 660, MAXIMO = 1.45;
export function ajustarTablet() {
  const w = innerWidth, h = innerHeight;
  const z = w >= 700 ? Math.min(MAXIMO, Math.max(1, Math.min(w / LARGURA_BASE, h / ALTURA_BASE))) : 1;
  const r = document.documentElement;
  r.style.setProperty("--z", z.toFixed(3));
  r.classList.toggle("tablet", z > 1.02);
}
export function ligarTablet() {
  ajustarTablet();
  addEventListener("resize", ajustarTablet);
  screen.orientation?.addEventListener?.("change", () => setTimeout(ajustarTablet, 150));
}
