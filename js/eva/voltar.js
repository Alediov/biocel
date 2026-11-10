// O voltar do Android dentro de Mensagens (04/11/2026): cada coisa que abre por cima (a conversa sobre a lista, o
// perfil da Eva) põe um estado no histórico do WebView; o botão voltar do Android (o Capacitor volta o histórico quando
// pode) dispara o popstate, que fecha o que estava por cima. Fechar pelo botão da tela volta o histórico junto.
// O estado guarda a profundidade (`orbitaMsg`): ao voltar, fecha tudo o que estiver acima dela.
const pilha = [];
window.addEventListener("popstate", () => {
  const d = history.state?.orbitaMsg || 0;
  while (pilha.length > d) { const f = pilha.pop(); try { f.fechar(); } catch (e) { console.warn("Mensagens: voltar", e); } }
});
/** Põe `fechar` na pilha; devolve a função que tira (e volta o histórico) quando a tela fecha por outro caminho. */
export function empilhar(fechar) {
  const it = { fechar };
  pilha.push(it);
  try { history.pushState({ ...(history.state || {}), orbitaMsg: pilha.length }, ""); } catch { /* sem histórico: só o botão da tela */ }
  return () => {
    const i = pilha.indexOf(it);
    if (i < 0) return;
    const n = pilha.length - i;
    pilha.splice(i);
    try { history.go(-n); } catch { /* */ }
  };
}
/** Ao sair de Mensagens: tira tudo e volta o histórico (o popstate que vem depois não acha nada para fechar). */
export function limparPilha() {
  const n = pilha.length;
  if (!n) return;
  pilha.length = 0;
  try { history.go(-n); } catch { /* */ }
}
export const naPilha = () => pilha.length;
