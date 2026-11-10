// O plano do celular → tablet (transferir.js), sem dependências, para testar no node (tools/musicas/teste_transferir.mjs).
const normPadrao = (s) => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
/**
 * minhas: as faixas deste aparelho [{ id, caminho, tamanho, artista }]; recebidos: cfg `recebidos`.
 * Baixa o que falta, o que mudou no celular desde a última vez (tamanho ou data) e, sem registro, o que tem tamanho
 * diferente; apaga as faixas dos artistas do manifesto cujo caminho o celular não tem mais.
 * Devolve { baixar: [{i, c, t, m}], iguais: [{c, t, m}], apagar: [faixa], bytes }.
 */
export function planoDeRecebimento(man, minhas, recebidos = {}, norm = normPadrao) {
  const porCaminho = new Map(minhas.map(f => [f.caminho, f]));
  const baixar = [], iguais = [];
  for (const a of man.arquivos || []) {
    const f = porCaminho.get(a.c), r = recebidos[a.c];
    if (!f) baixar.push(a);
    else if (r ? r.t !== a.t || r.m !== a.m : (f.tamanho || 0) !== a.t) baixar.push(a);
    else iguais.push({ c: a.c, t: a.t, m: a.m });
  }
  const artistas = new Set(man.artistas || []), caminhos = new Set((man.arquivos || []).map(a => a.c));
  const apagar = minhas.filter(f => artistas.has(norm(f.artista)) && !caminhos.has(f.caminho));
  return { baixar, iguais, apagar, bytes: baixar.reduce((s, a) => s + (a.t || 0), 0) };
}

