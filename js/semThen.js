// O plugin do Capacitor (registerPlugin) é um Proxy que transforma QUALQUER propriedade num método nativo, inclusive
// `then`. Por isso uma função async que devolve o plugin nunca termina: o JavaScript vê um "thenable", chama
// plugin.then(resolve, reject) como se fosse método do Android, o Android não conhece "then" e não responde, e o await
// fica parado para sempre. Foi o que fez o alarme nunca ser agendado (03/11/2026: "testei e nada aconteceu"; o
// diário ficava em "Carregando…"). Sempre que um plugin sair de uma função async, passe por aqui.
export const semThen = (p) => (p ? new Proxy(p, { get: (alvo, chave) => (chave === "then" ? undefined : alvo[chave]) }) : p);
