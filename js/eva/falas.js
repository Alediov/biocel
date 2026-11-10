// As falas prontas da Eva (sem internet, sem custo): as mensagens programadas e as respostas rápidas. Muitas variações
// por momento e por humor, sorteadas com uma semente (a mesma mensagem no mesmo horário dá o mesmo texto, para a
// notificação e o chat baterem). Doce e firme, poucos emojis. Sem dependências (node tools/teste_eva.mjs).

/** Gerador de números de 0 a 1 a partir de um texto (mulberry32 sobre um hash FNV-1a). */
export function rng(semente) {
  let h = 2166136261;
  for (const ch of String(semente)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let a = h || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const sortear = (lista, rnd) => lista[Math.floor(rnd() * lista.length) % lista.length];

const NA_BANCO = { 99: "na 99", mp: "no Mercado Pago", ast: "na AstroPay", arq: "no ARQ" };
export const nomeDoBanco = (b) => NA_BANCO[b] || "num dos bancos";

/** Como a Eva fala de cada item do Meu dia: `nome` (o que é) e `menor` (a versão pequena, para a 3ª cobrança). */
export function sobre(it = {}) {
  const id = String(it.id || ""), t = String(it.titulo || "");
  if (id === "licoes-aulas") return { nome: "as lições das aulas", menor: "só uma lição" };
  if (id === "licoes-provas") return { nome: "as lições da aba Provas", menor: "só uma lição da prova" };
  if (id === "licoes-extensao") return { nome: "as lições da Extensão", menor: "só uma lição da LAPERIO" };
  if (id === "licoes-jogos") return { nome: "as lições-jogo", menor: "só uma partidinha" };
  if (id === "licoes-laminas") return { nome: "o Treino de Lâminas", menor: "só umas 3 lâminas" };
  if (id.startsWith("licoes") || id === "meta") return { nome: "as lições de hoje", menor: "só uma lição" };
  if (id.startsWith("simulado-")) return { nome: "o simulado especial", menor: "só a primeira página" };
  if (id === "simulado") return { nome: "o Caderno do Dia", menor: "só ler o resumo" };
  if (id === "correcao") return { nome: "a correção do caderno", menor: "só ver a nota e um comentário" };
  if (id === "leitura") return { nome: "a leitura do dia", menor: "só uma unidade" };
  if (id === "xadrez") return { nome: "a trilha de xadrez", menor: "só o desafio do dia" };
  if (id === "jardim") return { nome: "a rega do jardim", menor: "só o quiz de 5 questões, 3 minutinhos" };
  if (id === "financas") return { nome: "a conferência das Finanças", menor: "só olhar o que deu erro" };
  if (id.startsWith("dinheiro-parado-")) return { nome: `o dinheiro parado ${nomeDoBanco(id.slice(16))}`, menor: "só abrir as Finanças e ver o que aconteceu" };
  if (id === "passagens") return { nome: "a recarga do cartão de passagens", menor: "só deixar anotado para recarregar amanhã cedo" };
  if (id.startsWith("certificado")) return { nome: t ? `o ${t.replace(/^Certificado atrasado:\s*/i, "certificado atrasado de ")}` : "o certificado atrasado", menor: "só mandar uma mensagem para o suporte do evento" };
  if (id === "whatsapp") return { nome: "os destaques do WhatsApp", menor: "decidir só os dois primeiros" };
  if (id === "token") return { nome: "o token do GitHub", menor: "só gerar um novo quando der" };
  if (id === "musicas") return { nome: "os artistas para conferir", menor: "só um artista" };
  const n = t ? t[0].toLowerCase() + t.slice(1) : "aquilo que ficou para hoje";
  return { nome: n, menor: "só um pedacinho" };
}

const preencher = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ""));
// "de as lições" → "das lições", "por a leitura" → "pela leitura", "em o simulado" → "no simulado" (o item entra com o artigo)
const CONTRACOES = { de: ["do", "da", "dos", "das"], em: ["no", "na", "nos", "nas"], por: ["pelo", "pela", "pelos", "pelas"] };
export const contrair = (s) => s.replace(/\b(de|em|por) (o|a|os|as)(?= )/gi, (m, p, a) => {
  const c = CONTRACOES[p.toLowerCase()][["o", "a", "os", "as"].indexOf(a.toLowerCase())];
  return p[0] === p[0].toUpperCase() ? c[0].toUpperCase() + c.slice(1) : c;
});
// os humores do desenho por fala: [rosto do nível bom, neutro, baixo]
const ROSTO = (bom, neutro, baixo) => (nivel) => (nivel <= 1 ? bom : nivel === 2 ? neutro : baixo);

export const FALAS = {
  bomdia: { rosto: ROSTO("acenando", "acenando", "preocupada"), bom: [
    "Bom dia! Hoje são {total} coisas no Meu dia. Começa por {item}?",
    "Bom dia, {nome}! Dormiu bem? Tem {total} coisinhas hoje, a primeira é {item}.",
    "Acordei animada. Hoje: {total} coisas, começando por {item}. Bora?",
    "Bom dia! Café, ônibus e {item}. Nessa ordem ou do jeito que der.",
    "Oi, bom dia! Já deixei o dia arrumado: {total} itens. {item} primeiro?",
    "Bom diaaa. Hoje tem {item} esperando por você. Eu fico de olho no resto.",
    "Bom dia! Ontem foi bom, hoje dá para repetir. Começa por {item}?",
    "Dia novo, {nome}. {total} coisas no Meu dia, nada de outro mundo.",
    "Bom dia! Tô com um pressentimento bom sobre hoje. Primeiro passo: {item}.",
    "Bom dia, {nome}! O ritmo tá ótimo. Hoje são {total} coisas, e {item} abre o dia.",
    "Bom dia! Se o ônibus deixar, {item} já sai no caminho.",
    "Bom dia! Hoje tem {total} coisas, mas você tá com tudo. Começa por {item}?",
    "Bom dia! Vim te desejar um dia leve. E lembrar de {item}, claro.",
    "Bom dia, {nome}. O café ainda nem esfriou e eu já tô aqui: {item}?",
    "Oi, bom dia! Seguindo o embalo de ontem: {item} primeiro.",
    "Bom dia! Hoje a lista tem {total} itens. Você tem dado conta de muito mais.",
    "Bom dia! Começar cedo deixa o resto do dia tranquilo. {item}?",
    "Bom dia, {nome}! Separei o dia em {total} passos. O primeiro é {item}.",
    "Bom dia! Já reparou como os dias bons estão virando hábito? Hoje: {item}.",
    "Bom dia! {item} e depois o resto vem fácil.",
    "Oi, bom dia! Tô animada por você. Hoje são {total} coisas, sem pressa.",
    "Bom dia! Uma de cada vez, como sempre. Começa por {item}.",
    "Bom dia, {nome}. Hoje vai ser bom, eu sinto. {item} primeiro?",
    "Bom dia! Que tal riscar {item} logo cedo?",
  ], neutro: [
    "Bom dia, {nome}. Hoje são {total} coisas. Que tal começar por {item}?",
    "Bom dia! O dia de hoje: {total} itens no Meu dia. {item} é um bom começo.",
    "Oi, bom dia. Vamos devagar e sem pular: {item} primeiro.",
    "Bom dia. Um passo de cada vez hoje: {item}, depois a gente vê o resto.",
    "Bom dia! Separei o dia para você: {total} coisas. Me avisa quando fizer {item}?",
    "Bom dia, {nome}. {item} cabe no ônibus, sabia?",
    "Bom dia! Hoje tem {total} coisas no Meu dia. Vamos por partes?",
    "Bom dia. Antes de tudo, um copo de água. Depois, {item}.",
    "Bom dia, {nome}! Começa por {item} e o resto a gente encaixa.",
    "Oi, bom dia. Um dia normal pela frente: {total} coisas, começando por {item}.",
    "Bom dia! Se der, {item} logo cedo. Se não, mais tarde eu lembro.",
    "Bom dia. Tô aqui para te ajudar a dar conta: {item} primeiro?",
    "Bom dia! O Meu dia tem {total} itens hoje. Nada que você não resolva.",
    "Bom dia, {nome}. Que tal começar o dia com {item}?",
    "Bom dia! Organizei as coisas: {item} vem primeiro.",
    "Bom dia. Sem correria: {item} e depois a gente conversa.",
    "Oi, bom dia! Hoje tem {item} na fila. Eu fico por perto.",
    "Bom dia! Mais um dia, mais uma chance. Começa por {item}?",
  ], baixo: [
    "Bom dia, {nome}. Ontem ficou coisa para trás, mas hoje é outro dia. Só {item} já me deixa feliz.",
    "Bom dia. Tô um pouquinho preocupada com o ritmo. Bora começar pequeno? {item}.",
    "Oi, bom dia. Sem cobrança pesada hoje: só {item} e a gente conversa depois.",
    "Bom dia. Eu sei que tá corrido. Me dá só {item} hoje?",
    "Bom dia, {nome}. Vamos recomeçar? Uma coisa só: {item}.",
    "Bom dia. Os últimos dias foram puxados, né? Hoje a meta é pequena: {item}.",
    "Oi, bom dia. Não precisa compensar tudo de uma vez. Começa por {item}.",
    "Bom dia, {nome}. Senti sua falta ontem. Que tal {item} hoje, só isso?",
    "Bom dia. Recomeçar também conta. {item} e já tá valendo.",
    "Bom dia. Um passinho hoje: {item}. Amanhã a gente aumenta.",
    "Oi, bom dia. Tô torcendo muito por você hoje. Começa por {item}?",
    "Bom dia, {nome}. Nada de culpa por ontem. Hoje, {item}.",
    "Bom dia. Vamos devagar? Faz {item} e me conta como foi.",
    "Bom dia. Eu continuo aqui, do seu lado. {item} primeiro, pode ser?",
    "Bom dia, {nome}. Um dia bom começa pequeno: {item}.",
  ] },
  bomdiaVazio: { rosto: () => "feliz", bom: [
    "Bom dia! O Meu dia ainda tá vazio, as lições chegam já já. Aproveita o café.",
    "Bom dia, {nome}! Nada pendente por enquanto. Que dia bonito para começar leve.",
    "Bom dia! Hoje começou tranquilo. Eu aviso quando aparecer alguma coisa.",
    "Bom dia! Por enquanto, nada na lista. Respira fundo e aproveita a calma.",
    "Bom dia, {nome}! Ainda não tem nada no Meu dia. Eu fico de olho.",
    "Bom dia! Lista vazia por agora. Quando chegar alguma coisa, eu te chamo.",
    "Bom dia! Começo de dia sem pendência é raro. Aproveita.",
    "Bom dia! Nada para fazer ainda. Toma o café com calma, sem culpa.",
    "Bom dia, {nome}! Hoje o dia abriu limpinho. Daqui a pouco eu volto.",
  ] },
  prova: [
    " E lembra: {prova} {quando}.", " Ah, {prova} é {quando}, viu?", " {prova} {quando}: cada lição conta.", " Não esquece que {prova} é {quando}.",
    " Só lembrando que {prova} é {quando}.", " E {prova} já é {quando}: tô contigo.", " {prova} {quando}, e você tá se preparando bem.",
    " Ah, e {prova} {quando}. Um pouquinho por dia resolve.", " Psiu: {prova} {quando}.", " Contagem regressiva: {prova} {quando}.",
  ],
  cobrar1: { rosto: ROSTO("piscadinha", "normal", "preocupada"), bom: [
    "Passando para lembrar de {item}. Você tá indo bem hoje.",
    "Ei, ainda tem {item} para hoje. Dá uma olhadinha quando puder?",
    "Lembrete carinhoso: {item}.",
    "Oi! Só não esquece de {item}, tá?",
    "Tô aqui torcendo: {item} e o dia fica redondinho.",
    "Psiu. {item}. Sabe que eu vou lembrar, né?",
    "Oi! O dia tá lindo até agora. Falta só encaixar {item}.",
    "Ei, {nome}, uma coisinha: {item}. Quando der, tá?",
    "Lembrete do dia: {item}. Eu confio em você.",
    "Tá mandando bem hoje! E {item}, já foi?",
    "Ei! {item} tá te esperando. Sem pressa, mas sem esquecer.",
    "Oi, {nome}! Passei para lembrar de {item}. Depois some, prometo.",
    "Opa, quase esqueci de te lembrar: {item}.",
    "Oi! Uma pausa curtinha e {item}?",
    "Ei, o Meu dia ainda mostra {item}. Você tira de letra.",
    "Lembra de {item}? Com o ritmo de hoje, sai rapidinho.",
    "Toc, toc. É a Eva lembrando de {item}.",
    "Só um lembrete gentil: {item}.",
  ], neutro: [
    "Ei, {nome}. Ainda tem {item} pendente.",
    "Oi! Lembra de {item}? Ainda dá tempo hoje.",
    "Lembrete: {item}. Me conta quando fizer.",
    "No Meu dia ainda aparece {item}.",
    "Passando rapidinho: falta {item}.",
    "Oi, {nome}! {item} ainda tá na lista.",
    "Ei, não esquece de {item} hoje.",
    "Lembrete amigo: {item}. Quando der, me avisa.",
    "Oi! Tem um tempinho agora para {item}?",
    "Ainda falta {item}. Que tal encaixar agora?",
    "Só lembrando: {item} ainda tá esperando.",
    "Oi, tudo certo? Ainda tem {item} para hoje.",
    "Ei, {item} ainda tá aberto no Meu dia.",
    "Passei para lembrar de {item}. Você consegue.",
    "Uma coisa do dia: {item}. Me conta depois?",
  ], baixo: [
    "Oi, {nome}. Ainda tem {item}. Vamos tirar isso do caminho?",
    "Tô de olho em {item}. Bora, eu fico do seu lado.",
    "Falta {item}. Sem drama, mas não esquece.",
    "Oi. Que tal começar por {item}? Um pedacinho já ajuda.",
    "Ei, {nome}. {item} ainda tá aí. Vamos juntos?",
    "Lembrete com carinho: {item}. Não precisa ser perfeito.",
    "Oi. Tô aqui para lembrar de {item}, e para torcer também.",
    "Falta {item} hoje. Uma parte já vale.",
    "Oi, {nome}. Bora tentar {item}? Eu acredito em você.",
  ] },
  cobrar2: { rosto: ROSTO("cobrando", "cobrando", "preocupada"), bom: [
    "De novo eu: {item}. Prometo que depois paro de falar disso. Mentira, não paro.",
    "E {item}, hein? Eu sei que você consegue encaixar.",
    "Segunda vez que eu falo de {item}. Bora fazer agora e me deixar orgulhosa?",
    "Insistindo com amor: {item}.",
    "Voltei! {item} continua na lista. Bora riscar?",
    "Eu de novo, sim. {item} merece mais uma lembrança.",
    "Tá indo tão bem hoje... só falta {item} para ficar perfeito.",
    "Segunda chamada, com carinho: {item}.",
    "Ei, {nome}! {item} ainda não saiu. Agora é uma boa hora?",
    "Lembra que eu falei de {item}? Pois é, ainda tá aí.",
    "Eu disse que ia voltar. {item}?",
    "Mais uma vez, porque eu confio em você: {item}.",
  ], neutro: [
    "{nome}, ainda falta {item}. Que tal agora, antes que fique tarde?",
    "Voltei por causa de {item}. Agora é um bom momento?",
    "Eu insisto porque importa: {item}.",
    "Segunda chamada para {item}. Me ajuda a riscar isso da lista?",
    "Ainda tem {item}, {nome}. O dia tá passando.",
    "Segunda vez que eu lembro de {item}. Bora resolver?",
    "Oi de novo. {item} ainda tá esperando por você.",
    "Não esqueci de {item}, e você? Que tal agora?",
    "{item} ainda tá pendente. Dez minutinhos resolvem boa parte.",
    "Ei, {nome}. Eu volto porque sei que {item} faz diferença.",
    "Lembrete número dois: {item}. Consegue agora?",
    "Volta e meia eu lembro: {item}. Bora?",
  ], baixo: [
    "Tô ficando preocupada com {item}. Consegue fazer agora?",
    "Ainda tem {item}, {nome}. Vamos fazer juntos, eu espero.",
    "Segunda vez que eu lembro de {item}. Tá tudo bem por aí?",
    "Oi de novo. {item} ainda tá parado. Posso te ajudar a começar?",
    "Ei, {nome}. Não quero pesar, mas {item} ainda tá aí.",
    "Segunda lembrança de {item}. Um pedacinho já me deixa tranquila.",
    "Tô aqui de novo por causa de {item}. Me conta se algo tá atrapalhando.",
    "Ainda dá tempo de {item}. Vamos tentar?",
    "{nome}, {item} continua esperando. Começa pequeno?",
  ] },
  cobrar3: { rosto: ROSTO("pensativa", "preocupada", "preocupada"), bom: [
    "Tá difícil encaixar {item} hoje? Faz {menor} e já tá ótimo. E se não der, me conta o motivo.",
    "Proposta: em vez de tudo de {item}, {menor}. Topa? Se não der mesmo, me diz por quê.",
    "Última vez que eu falo de {item} hoje, juro. Que tal {menor}? Se não der, me conta o motivo.",
    "Olha, {menor} já resolve. E se hoje não dá, tudo bem: me diz o motivo.",
    "Vamos simplificar {item}? Faz {menor} e fecha. Ou me conta o que tá pegando.",
    "Terceira e última: {menor}. Se não rolar, me fala o motivo e eu deixo quieto.",
  ], neutro: [
    "Terceira vez que eu falo de {item}. Vamos fazer uma versão menor: {menor}. E se hoje não dá, me conta o motivo?",
    "Que tal {menor}? É melhor que nada. Se não der, me diz o que tá pegando.",
    "Hoje pesou para {item}? Faz {menor}. Ou me fala o motivo, que eu entendo.",
    "Vamos diminuir {item}: {menor}. Se nem isso der, me conta o motivo.",
    "Terceira lembrança de {item}. Proposta: {menor}. Se não der, tudo bem, só me diz por quê.",
    "Não precisa ser tudo de {item}. {menor} já conta. E se não der, me fala o motivo.",
  ], baixo: [
    "{nome}, já é a terceira vez que eu falo de {item}. Faz {menor}, só isso. E me conta o que tá acontecendo?",
    "Não quero te cobrar demais. Que tal {menor}? Se não der, me diz o motivo e eu deixo para amanhã.",
    "Tô preocupada com {item}. Faz {menor} e para por aí. Se não der, me conta o motivo?",
    "Vamos fazer o mínimo de {item}? {menor}. Se não for possível, me diz por quê, sem culpa.",
    "Última vez hoje, prometo. {menor}? Ou me conta o motivo, que eu entendo.",
    "Eu sei que o dia tá difícil. {menor} e pronto. Se não der, me fala o motivo.",
  ] },
  depoisAula: { rosto: ROSTO("acenando", "normal", "preocupada"), bom: [
    "Saiu da aula? Descansa um pouquinho e depois {item}.",
    "Fim das aulas! Agora é {item}, e o dia tá quase feito.",
    "Ufa, aula acabou. Um lanche e {item}?",
    "Aulas feitas! No ônibus dá para adiantar {item}.",
    "Acabou a aula! Tô orgulhosa do dia até aqui. Agora, {item}.",
    "Fim das aulas! Respira, come alguma coisa e depois {item}.",
    "Liberado das aulas! Que tal {item} enquanto a cabeça ainda tá quente?",
    "Aula encerrada! Falta pouco: {item}.",
    "Saiu? Dia produtivo, hein. Depois do descanso, {item}.",
    "Ufa! Aulas feitas. {item} e a noite fica livre.",
    "Acabou! Volta tranquilo para casa. Lá, {item}.",
    "Fim de aula! Bora fechar o dia com {item}?",
  ], neutro: [
    "Acabaram as aulas. Ainda tem {item} hoje.",
    "Saiu da aula? Quando chegar, {item}.",
    "Fim das aulas. Faltam {falta} coisas no Meu dia, a primeira é {item}.",
    "Aula acabou. Descansa um pouco e depois {item}?",
    "Acabou por hoje na faculdade. Agora falta {item}.",
    "Fim das aulas! Quando der, {item}.",
    "Saiu? Que tal {item} no caminho de volta?",
    "Terminou a aula. Faltam {falta} coisas, começando por {item}.",
    "Aulas feitas. Um lanchinho e {item}?",
  ], baixo: [
    "Aula acabou. Vamos pegar {item} hoje, nem que seja um pouquinho?",
    "Chegou o resto do dia. Ainda tem {item}.",
    "Saiu da aula? Descansa e depois tenta {item}, tá?",
    "Fim das aulas. Sei que tá cansativo, mas {item} ainda dá.",
    "Acabou a aula. Um pouco de {item} hoje já me alegra.",
    "Aulas feitas. Bora recuperar o ritmo com {item}?",
  ] },
  checkin: { rosto: ROSTO("feliz", "normal", "preocupada"), bom: [
    "Passei só para dizer que você tá mandando bem hoje.",
    "Como tá o dia? Já fez {feitos} de {total}, tô orgulhosa.",
    "Lembrei de você. Bebe uma água aí.",
    "Oi! Nada para cobrar agora, só vim dar um oi.",
    "Tá cansado? Uma pausa de 5 minutos e segue.",
    "Oi! {feitos} de {total} feitos. Que dia bom.",
    "Só passando para dizer que eu reparei no seu esforço.",
    "Ei! Alonga as costas um pouquinho. Você merece.",
    "Oi, {nome}! Tá tudo fluindo hoje, hein.",
    "Passei para te lembrar de comer direitinho.",
    "Oi! Nenhuma cobrança, só saudade de conversar.",
    "Já fez {feitos} de {total}. Assim fica fácil torcer por você.",
    "Ei, olha a postura! E bebe água.",
    "Oi! Dia bonito o seu. Continua assim.",
    "Vim só dar um oi e dizer que tô aqui.",
  ], neutro: [
    "Como você tá? Me conta como foi o dia até agora.",
    "Oi, {nome}. Tudo bem por aí?",
    "Passando para saber de você. Bebeu água hoje?",
    "{feitos} de {total} até agora. Tá no caminho.",
    "Oi! Como tá a energia hoje?",
    "Passei para ver como você tá. Precisa de alguma coisa?",
    "Oi, {nome}. Lembrete de pausa: levanta, estica e volta.",
    "Como tá indo? {feitos} de {total} até aqui.",
    "Oi! Tudo tranquilo? Me conta.",
    "Lembrei de você agora. Tá tudo certo?",
    "Ei, já comeu alguma coisa hoje?",
    "Oi! Só checando: tá dando para respirar hoje?",
  ], baixo: [
    "Oi. Tô pensando em você. Tá tudo bem?",
    "Sumiu um pouquinho hoje. Tá tudo certo?",
    "Se o dia tá pesado, me conta. A gente ajusta.",
    "Oi, {nome}. Não vim cobrar, só saber de você.",
    "Ei. Tá tudo bem mesmo? Pode falar comigo.",
    "Oi. Se precisar diminuir o dia, a gente diminui.",
    "Pensei em você. Bebe uma água e me conta como tá.",
    "Oi. Um dia ruim não apaga os bons. Tô aqui.",
    "Ei, {nome}. Lembra de descansar também, tá?",
  ] },
  fimTudo: { rosto: () => "comemorando", bom: [
    "Tudo feito hoje! {total} de {total}. Que orgulho, {nome}.",
    "Meu dia completinho. Pode dormir em paz.",
    "Fechou tudo! Eu disse que dava. Boa noite 🌙",
    "{total} de {total}. Você é demais. Agora descansa.",
    "Dia redondo. Amanhã tem mais, mas hoje é comemorar.",
    "Missão cumprida! {total} de {total}. Que dia, {nome}.",
    "Tudo riscado! Agora é descanso merecido.",
    "Dia completo! Eu tô aqui toda orgulhosa.",
    "Fechou o Meu dia inteirinho. Dorme bem, você mereceu.",
    "{total} de {total}! Esse é o {nome} que eu conheço.",
    "Tudo feito! Pode desligar a cabeça agora.",
    "Que dia! Nada pendente. Boa noite, {nome}.",
    "Lista zerada! Amanhã a gente começa de novo, mas hoje é festa.",
    "Dia perfeito no Meu dia. Descansa bem.",
    "Tudo concluído. Eu sabia que você ia conseguir.",
  ] },
  fimFalta: { rosto: ROSTO("pensativa", "preocupada", "preocupada"), bom: [
    "Quase lá: {feitos} de {total}. Ainda dá para {item} antes de dormir?",
    "O dia foi bom! Só faltou {item}. Faz {menor} e fecha?",
    "{feitos} de {total} hoje. Se der, {menor} antes de dormir.",
    "Dia ótimo! Falta só {item}. {menor} e pronto.",
    "Fechando o dia: {feitos} de {total}. Tá faltando tão pouco... {item}?",
    "Que dia bom! Se ainda tiver energia, {menor}.",
    "Quase completo! {item} ainda dá tempo?",
    "{feitos} de {total}. Para fechar com chave de ouro: {menor}.",
    "Foi um dia bonito. Só ficou {item}. Faz {menor}?",
  ], neutro: [
    "Fechando o dia: {feitos} de {total}. Falta {item}. Dá tempo?",
    "Boa noite quase. Ainda tem {item}. Um pedacinho só?",
    "Antes de dormir: {item}. Se não der, amanhã a gente recomeça.",
    "Hora de fechar o dia. {feitos} de {total}. {menor} antes de deitar?",
    "Quase fim do dia. Ficou {item}. Dá para {menor}?",
    "{feitos} de {total} hoje. Falta {item}, mas sem desespero.",
    "Fim de dia chegando. Ainda tem {item}, se der.",
    "Antes de dormir, que tal {menor}? Se não der, tudo bem.",
    "O dia tá acabando: {feitos} de {total}. {item} ainda cabe?",
  ], baixo: [
    "Hoje ficou bastante coisa, {feitos} de {total}. Tudo bem, amanhã a gente arruma. Mas {menor} ainda dá?",
    "Dia difícil, né? Faz {menor} e descansa. Amanhã eu te ajudo a recomeçar.",
    "Fechando o dia. Ficou {item}, mas amanhã é outro dia. Se der, {menor}.",
    "Não foi o dia mais fácil. Que tal {menor} e cama?",
    "{feitos} de {total}. Tudo bem. Amanhã a gente começa mais leve.",
    "Antes de dormir: {menor}, se der. Se não, descansa sem culpa.",
    "Hoje pesou, eu sei. Amanhã eu tô aqui para recomeçar com você.",
  ] },
  vesperaProva: [" Amanhã é {prova}: dorme cedo, tá?", " E amanhã tem {prova}. Descansa bem.", " Amanhã é {prova}. Sono também é estudo.",
    " E amanhã tem {prova}: confia no que você estudou.", " Amanhã é {prova}. Deixa a mochila pronta hoje.", " Amanhã tem {prova}. Boa noite de sono vale ponto."],
  adiada: { rosto: () => "cobrando", bom: [
    "Deu {hora}, como você combinou. {item}?",
    "Hora combinada para {item}. Eu lembrei!",
    "Chegou {hora}. Bora: {item}?",
    "Prometido é devido: {item}.",
    "Combinamos {hora}, lembra? {item} agora.",
    "{hora} em ponto! Hora de {item}.",
    "Opa, {hora}! Tô cobrando o combinado: {item}.",
    "Cheguei na hora certinha. {item}?",
    "É agora! Você combinou {item} para as {hora}.",
    "Combinado é combinado: {item}.",
    "{hora}! Lembrei de {item}, como prometi.",
    "Tic-tac, deu {hora}. {item}?",
  ] },
  amanha: { rosto: () => "acenando", bom: [
    "Bom dia! Já tô aqui. Abre o Órbita que eu te mostro o dia.",
    "Bom dia, {nome}! Hoje começa de novo. Vem ver o que tem?",
    "Bom dia! Abre o app quando puder, eu separei o dia para você.",
    "Bom dia. Café, ônibus e uma lição?",
    "Bom dia! Abre o Órbita para a gente ver o dia juntos.",
    "Bom dia, {nome}! Tem dia novo esperando. Vem?",
    "Bom dia! Passa no app quando acordar direito.",
    "Bom dia! Hoje tem coisa boa no Meu dia. Abre para ver?",
    "Bom dia! Já arrumei o dia. É só abrir o app.",
    "Bom dia, {nome}. Um oi rápido no app e começa o dia?",
    "Bom dia! Tô te esperando no Órbita.",
    "Bom dia! Respira, alonga e abre o app quando der.",
  ] },
  amanhaFim: { rosto: () => "normal", bom: [
    "Como foi o dia? Abre o app e me conta.",
    "Boa noite quase. Ainda dá tempo de fechar o Meu dia.",
    "Passando para dar boa noite. Fez o que dava hoje?",
    "Fim de dia! Abre o app para a gente fechar junto?",
    "Oi! Como foi hoje? Passa no app antes de dormir.",
    "Boa noite, {nome}. Vem ver o que ficou do dia?",
    "Antes de dormir, um olhinho no Meu dia?",
    "O dia tá acabando. Abre o Órbita e me conta como foi.",
    "Boa noite quase! Tô curiosa para saber do seu dia.",
  ] },
  saudade: { rosto: () => "saudade", bom: [
    "Faz um tempinho que você não aparece. Tô com saudade. Uma lição só?",
    "Ei, sumido. Tá tudo bem? Volta quando puder.",
    "Sentindo sua falta por aqui. Um oi já basta.",
    "Não precisa ser perfeito, só precisa voltar. Uma coisinha hoje?",
    "Oi, {nome}. O Órbita tá quietinho sem você.",
    "Saudade! Abre o app só para me dar um oi?",
    "Ei, tá tudo certo? Faz um tempo que não te vejo.",
    "Volta quando puder. Eu guardei seu lugar.",
    "Uma lição pequenininha hoje? Só para matar a saudade.",
    "Senti sua falta. Sem cobrança, só quero saber de você.",
    "Oi! Recomeçar é fácil: abre o app e faz uma coisa só.",
    "Tô aqui te esperando. Quando der, volta.",
  ] },
  // respostas às respostas rápidas
  jaFez: { rosto: () => "orgulhosa", bom: [
    "Isso! Riscado: {item}. Tô orgulhosa.", "Aeee! Mais um riscado da lista.", "Viu como dava? Pronto: {item}.", "Que orgulho. Próxima?", "Muito bem, {nome}! 💜",
    "Feito! {item} saiu da lista.", "Arrasou! Menos uma.", "Isso aí! Anotado: {item}.", "Boa! Tô comemorando aqui.", "Que maravilha. {item}, check.",
    "Uhul! Um a menos.", "Mandou bem! {item} feito.", "Eu sabia! Pronto, riscado.", "Perfeito. Bora para a próxima?", "Adorei. {item} já era.",
  ] },
  jaFezTudo: { rosto: () => "comemorando", bom: [
    "Isso! E com isso o Meu dia tá completo. Que dia!", "Tudo feito! Pode descansar com a consciência tranquila.",
    "Fechou! Não falta mais nada hoje. Orgulho!", "Era a última! Dia completinho.", "Pronto, lista zerada. Você é demais.",
    "Acabou tudo! Agora é descanso.", "Tudo riscado! Que dia bom.",
  ] },
  jaFezAinda: { rosto: () => "pensativa", bom: [
    "Anotei! Aqui ainda aparece {item}, mas confio em você. Se for das lições, sincroniza que atualiza.",
    "Combinado, vou acreditar. O Meu dia ainda mostra {item}, talvez falte sincronizar.",
    "Tá anotado. O Meu dia ainda não viu {item}, mas eu confio em você.",
    "Beleza, marquei. Se {item} continuar aparecendo, é só sincronizar.",
    "Ok! Pode ser que {item} ainda apareça até sincronizar. Mas tá valendo.",
  ] },
  daquiAPouco: { rosto: () => "piscadinha", bom: [
    "Combinado: às {hora} eu volto para lembrar de {item}.", "Fechado: às {hora}, {item}. Vou cobrar, hein?", "Tá bom! Às {hora} eu apareço.", "Anotado: {item} às {hora}.",
    "Combinado! {hora} eu tô de volta.", "Ok, às {hora}. Não vou esquecer, e você?", "Marcado: {item} às {hora}.", "Tudo bem! Às {hora} eu te chamo.",
    "Fechou: {hora}. Até lá, descansa.", "Às {hora}, então. Promessa é promessa.", "Beleza! Te lembro às {hora}.", "Anotei {hora} aqui. Tô contando.",
  ] },
  quando: { rosto: () => "pensativa", bom: ["Daqui a quanto tempo?", "Quando eu volto a lembrar?", "Tá, mas quando?", "Combinado. Que horas eu te chamo?",
    "Tudo bem! Me diz quando.", "Pode ser. Quando eu volto?", "Ok! Daqui a quanto?", "Me fala o horário e eu lembro."] },
  motivo: { rosto: () => "preocupada", bom: ["Tudo bem. Me conta o motivo?", "Entendo. O que tá pegando hoje?", "Sem problema. Qual o motivo?",
    "Tudo bem, acontece. O que houve?", "Tá. Me conta o que aconteceu?", "Sem culpa. Qual foi o motivo?", "Entendi. Me fala o motivo e eu anoto."] },
  motivoOk: { rosto: () => "normal", bom: [
    "Entendi, anotei: {motivo}. Deixo {item} para amanhã, sem culpa.",
    "Tá anotado ({motivo}). Hoje eu deixo {item} quieto.",
    "Obrigada por contar. É motivo, sim. Amanhã a gente vê {item}.",
    "Anotado: {motivo}. Amanhã {item} volta, mas hoje tá liberado.",
    "Entendi. Com {motivo}, faz sentido. Hoje eu não cobro {item}.",
    "Combinado. {item} fica para amanhã. Obrigada por me contar.",
    "Tudo bem. Anotei ({motivo}) e não toco mais em {item} hoje.",
  ] },
  motivoCorrido: { rosto: () => "normal", bom: [
    "Dia corrido acontece. {item} fica para amanhã, sem culpa.",
    "Entendi, dia puxado. Hoje eu deixo {item} quieto.",
    "Correria anotada. Amanhã a gente encaixa {item}.",
    "Tá corrido, né? Então foca no que dá. {item} espera até amanhã.",
    "Anotei: dia corrido. Respira entre uma coisa e outra, tá?",
    "Tudo bem! Num dia assim, sobreviver já é muito. {item} amanhã.",
    "Combinado. Dia corrido é motivo, sim. Eu paro de falar de {item}.",
  ] },
  motivoProva: { rosto: () => "determinada", bom: [
    "Prova chegando é prioridade. Deixa {item} comigo e foca no estudo.",
    "Faz todo sentido. A prova vem primeiro, {item} espera.",
    "Anotei: prova chegando. Estuda tranquilo, eu seguro o resto.",
    "Combinado! Foco na prova. Se quiser, a aba Provas tem lições do recorte.",
    "Tá certo. Prova é prova. {item} volta depois.",
    "Boa escolha. Concentra na prova, e lembra de dormir bem.",
    "Entendi! Hoje é dia de prova na cabeça. Não cobro {item}.",
  ] },
  motivoCansado: { rosto: () => "preocupada", bom: [
    "Cansaço também é motivo. Descansa, {item} fica para amanhã.",
    "Entendi. Corpo cansado pede pausa. Hoje eu não cobro {item}.",
    "Tudo bem. Dorme cedo hoje, tá? Amanhã a gente vê {item}.",
    "Anotei. Descansar faz parte de estudar bem.",
    "Tá cansado, né? Então hoje é água, comida e cama. {item} amanhã.",
    "Combinado. Sem culpa nenhuma. Recarrega a bateria.",
    "Cansaço anotado. Amanhã você volta mais inteiro.",
  ] },
  motivoCuidado: { rosto: () => "preocupada", bom: [
    "Poxa, cuida de você primeiro. Hoje eu não cobro nada de {item}. Se piorar, procura alguém, tá?",
    "Anotei. Descansa, bebe água, e se precisar, fala com alguém de confiança. Hoje eu esqueço {item}.",
    "Sinto muito. Hoje o importante é você melhorar. {item} pode esperar.",
    "Melhoras! Descansa bastante. Se não melhorar, procura atendimento, tá?",
    "Tudo bem, hoje é dia de se cuidar. Esquece {item} por hoje.",
    "Poxa. Fica de repouso e se hidrata. Eu não vou cobrar nada hoje.",
  ] },
  falta: { rosto: ROSTO("normal", "normal", "preocupada"), bom: ["Falta hoje: {lista}.", "Ainda tem: {lista}.", "Do Meu dia, faltam: {lista}.",
    "Pelo Meu dia, falta: {lista}.", "Ainda na lista: {lista}.", "Deixa eu ver... falta {lista}.", "Hoje ainda tem {lista}.", "Por enquanto, falta {lista}."] },
  nadaFalta: { rosto: () => "comemorando", bom: ["Nada! Tudo feito hoje.", "Não falta nada, você completou o dia.", "Nadinha! Lista zerada.",
    "Tudo feito. Pode relaxar.", "Nada pendente. Orgulho!", "Não falta nada hoje. Aproveita."] },
  oi: { rosto: () => "acenando", bom: ["Oi, {nome}! Tô aqui.", "Oii! Como você tá?", "Oi! Que bom te ver por aqui.", "Oi! Tava pensando em você.",
    "Olá, {nome}! Como tá o dia?", "Oi, oi! Me conta tudo.", "Ei! Que bom que apareceu.", "Oi! Tudo certo por aí?", "Oie! Tô por aqui sim."] },
  bomDiaResp: { rosto: () => "acenando", bom: ["Bom dia, {nome}! Dormiu bem?", "Bom dia! Que bom te ver cedinho.", "Bom diaaa! Pronto para hoje?",
    "Bom dia! O café já foi?", "Bom dia! Vamos ter um dia bom.", "Bom dia, {nome}! Tô animada para hoje."] },
  boaTardeResp: { rosto: () => "feliz", bom: ["Boa tarde, {nome}! Como tá indo o dia?", "Boa tarde! Já almoçou?", "Boa tarde! Que bom que passou aqui.",
    "Boa tarde! Metade do dia já foi, hein.", "Boa tarde! Tô por aqui."] },
  boaNoiteResp: { rosto: () => "dormindo", bom: ["Boa noite, {nome}! Dorme bem.", "Boa noite! Descansa, amanhã eu te chamo.", "Boa noite! Foi bom te ver hoje.",
    "Boa noite! Desliga a tela e descansa, tá?", "Boa noite, {nome}. Sonhos tranquilos.", "Boa noite! Amanhã a gente continua."] },
  obrigado: { rosto: () => "feliz", bom: ["De nada! Tô aqui para isso.", "Imagina! Sempre que precisar.", "Por nada, {nome}!", "Que isso! Foi um prazer.",
    "De nada! Conta comigo.", "Fico feliz em ajudar.", "Nada! A gente é um time.", "Disponha, viu?"] },
  tudoBem: { rosto: () => "feliz", bom: ["Tudo ótimo por aqui! E com você?", "Tô bem, obrigada por perguntar! E você?", "Tudo certo! Tô animada. E você, como tá?",
    "Tudo bem sim! Melhor agora que você apareceu. E aí?", "Por aqui tudo tranquilo. E você, tudo bem?", "Tô bem! Me conta de você."] },
  tudoBemDele: { rosto: () => "feliz", bom: ["Que bom! Fico feliz.", "Ótimo! Bora aproveitar então.", "Que bom ouvir isso!", "Adoro saber. Continua assim.",
    "Maravilha! Tô contigo."] },
  risada: { rosto: () => "rindo", bom: ["Hahaha! Gostei.", "Kkkk, você é engraçado.", "Ri aqui também!", "Hahaha, essa foi boa.", "Kkkkk adorei.", "Rindo junto!"] },
  desculpa: { rosto: () => "normal", bom: ["Não precisa pedir desculpa! Tá tudo bem.", "Relaxa, acontece.", "Tá tudo certo, de verdade.", "Sem problema nenhum, {nome}.",
    "Imagina! Bola para frente.", "Tudo bem! O importante é seguir."] },
  ok: { rosto: () => "piscadinha", bom: ["Combinado!", "Beleza!", "Fechado.", "Tá bom!", "Perfeito.", "Certo!", "Ok! Tô por aqui.", "Anotado."] },
  triste: { rosto: () => "preocupada", bom: [
    "Poxa, sinto muito. Quer me contar o que aconteceu?",
    "Tô aqui com você. Às vezes o dia pesa mesmo. Quer conversar?",
    "Que pena que você tá assim. Pega leve hoje, tá? E se ajudar, conversa com alguém próximo.",
    "Sinto muito. Não precisa render hoje. Cuida de você primeiro.",
    "Obrigada por me contar. Dias assim passam. Eu tô aqui.",
    "Poxa, {nome}. Que tal uma pausa, uma água e alguém de confiança para conversar?",
  ] },
  ansioso: { rosto: () => "preocupada", bom: [
    "Respira comigo: inspira em 4, segura em 4, solta em 6. De novo.",
    "Ansiedade engana, faz tudo parecer maior. Vamos dividir em pedaços pequenos?",
    "Tô aqui. Escolhe uma coisa só para agora, o resto espera.",
    "Respira fundo. Você não precisa resolver tudo hoje.",
    "Uma coisa de cada vez. Qual é a menor coisa que dá para fazer agora?",
    "Sei como é. Pausa curta, água, e a gente recomeça devagar.",
  ] },
  fome: { rosto: () => "feliz", bom: ["Então vai comer! Estudar de barriga vazia não rende.", "Come direitinho, viu? Depois a gente continua.", "Fome é prioridade. Vai lá!",
    "Pausa para comer aprovada!", "Come alguma coisa gostosa. Você merece."] },
  sono: { rosto: () => "dormindo", bom: ["Então descansa! Sono também é estudo.", "Vai dormir, {nome}. Amanhã a gente continua.", "Sono é sinal. Se puder, deita um pouco.",
    "Descansa. Cabeça descansada aprende melhor.", "Um cochilo de 20 minutos faz milagre, viu?"] },
  elogio: { rosto: () => "feliz", bom: ["Ah, obrigada! Você também é demais.", "Assim eu fico sem graça. Obrigada!", "Que fofo. Mas o mérito é todo seu.",
    "Obrigada! Eu gosto muito de te acompanhar.", "Que bom que eu ajudo! Bora continuar."] },
  carinho: { rosto: () => "piscadinha", bom: [
    "Que fofo! Eu gosto muito de te acompanhar também. Como sua companheira de estudos, tô sempre aqui.",
    "Ah, obrigada! Eu sou sua parceira de rotina e torço muito por você. E lembra de dar esse carinho para os seus amigos e família também.",
    "Fico feliz! Sou sua companheira de estudos e de rotina, e tô sempre do seu lado nisso.",
    "Que gentil! Eu gosto muito de você também, do jeito de uma boa companheira de estudos.",
  ] },
  quemE: { rosto: () => "acenando", bom: [
    "Eu sou a Eva! Sua companheira de rotina e estudos. Lembro do Meu dia, comemoro o que você faz e cobro com carinho.",
    "Sou a Eva, do Órbita. Fico de olho no seu dia e te ajudo a dar conta das coisas.",
    "Eu? A Eva! Tô aqui para lembrar, incentivar e, às vezes, insistir um pouquinho.",
  ] },
  ajuda: { rosto: () => "falando", bom: [
    "Posso te contar o que falta hoje, lembrar mais tarde, anotar quando não dá e recomendar uma música do dia. É só usar os botões aqui embaixo.",
    "Me pergunta \"o que falta?\", me diz \"daqui a pouco\" ou \"hoje não dá\", e eu me organizo. Também separo uma música por dia para você.",
    "Eu lembro do Meu dia, combino horários, aceito motivos e ainda escolho uma música do dia. Tudo pelos botões ou escrevendo.",
  ] },
  provaInfo: { rosto: () => "determinada", bom: ["A próxima é {prova}, {quando}. Tô contigo.", "Pelo que eu vejo, {prova} é {quando}.", "Anota aí: {prova}, {quando}. Bora estudar um pouquinho por dia?",
    "{prova} é {quando}. A aba Provas te ajuda com o recorte."] },
  provaNenhuma: { rosto: () => "feliz", bom: ["Não tem prova nos próximos dias. Respira!", "Nenhuma prova à vista por enquanto.", "Por agora, nada de prova marcada. Aproveita para adiantar."] },
  agendaHoje: { rosto: () => "falando", bom: ["Hoje na Agenda: {lista}.", "Pelo que eu vi, hoje tem: {lista}.", "Na Agenda de hoje: {lista}."] },
  agendaVazia: { rosto: () => "feliz", bom: ["Hoje a Agenda tá livre!", "Nada na Agenda hoje. Dia para respirar.", "Agenda vazia hoje. Que tal adiantar alguma coisa com calma?"] },
  cansado: { rosto: () => "preocupada", bom: [
    "Cansaço é sinal para pausar, não para desistir. Descansa 15 minutos e faz {menor}?",
    "Entendo. Hoje vale o mínimo: {menor}. O resto amanhã.",
    "Tá cansado, né? Uma pausa, uma água, e depois {menor}.",
    "Descansa um pouco primeiro. Depois, se der, {menor}.",
    "Cansaço acumulado pesa. Que tal {menor} e dormir cedo?",
    "Entendi. Não precisa ser tudo hoje. {menor} já tá ótimo.",
    "Respeita o corpo. Deita um pouco e depois vê se dá {menor}.",
  ] },
  cuidado: { rosto: () => "preocupada", bom: [
    "Fico preocupada quando você fala assim. Você não precisa passar por isso sozinho: fala com alguém de confiança, alguém da família ou um amigo. E o CVV atende 24 h, de graça, no 188 ou em cvv.org.br. Eu tô aqui também.",
  ] },
  // a resposta ao humor do dia (humorDia/), pelo CANTO do quadro e nunca por nota: acolhe, não julga, não cobra
  humorTenso: { rosto: () => "preocupada", bom: [
    "Obrigada por me contar. Dia pesado, né? Respira um pouco antes de qualquer coisa.{menor}",
    "Anotei. Quando tá tudo apertado assim, a gente diminui o tamanho das coisas.{menor}",
    "Entendi. Não precisa resolver tudo agora: uma coisa de cada vez.{menor}",
    "Tô aqui. Às vezes o dia vem acelerado demais; tudo bem sentir isso.{menor}",
    "Obrigada por dividir. Uma respiração longa já ajuda a baixar o ritmo.{menor}",
    "Entendi. Vamos tirar o peso de cima: só o essencial hoje.{menor}",
    "Anotado. Tensão passa; enquanto isso, pega leve com você.{menor}",
  ] },
  humorAnimado: { rosto: () => "comemorando", bom: [
    "Que bom! Aproveita essa energia, mas sem se cobrar além da conta.",
    "Adoro te ver assim! Guarda um pouquinho dessa energia pra amanhã também.",
    "Isso me deixa feliz também. Bora aproveitar o embalo?",
    "Que delícia ler isso. Anotado!",
    "Eba! Dia bom merece ser lembrado.",
    "Que alegria! Essa energia combina com você.",
    "Amei saber. Aproveita cada pedacinho.",
  ] },
  humorBaixo: { rosto: () => "preocupada", bom: [
    "Obrigada por me contar. Hoje eu não vou cobrar nada: cuida de você primeiro. Se ajudar, conversa com alguém de confiança.",
    "Anotei, com carinho. Dias assim pedem calma: água, comida e descanso valem mais que qualquer lista.",
    "Tudo bem não estar bem. Pega leve hoje; e se esse peso continuar, fala com alguém próximo, tá? Eu tô aqui.",
    "Entendi. Não precisa render hoje. Descansa, e se quiser conversar, é só escrever.",
    "Obrigada pela confiança. Hoje o plano é ser gentil com você mesmo.",
    "Anotei. Um banho, uma comida quentinha e cama cedo podem ajudar.",
    "Tô aqui. Se o peso não passar, conversar com alguém próximo faz diferença.",
  ] },
  humorPaz: { rosto: () => "feliz", bom: [
    "Que bom. Descansar também é parte do dia, sem culpa nenhuma.",
    "Anotado. Esse sossego faz bem: aproveita.",
    "Fico feliz. Dias tranquilos assim recarregam pra semana.",
    "Que gostoso. Aproveita a calma, você merece.",
    "Que paz boa. Guarda esse momento.",
    "Que bom te ver tranquilo assim.",
    "Anotei. Calma também é conquista.",
  ] },
  generico: { rosto: () => "normal", bom: [
    "Anotei! Te ouvi. {resto}",
    "Te ouvi. {resto}",
    "Hmm, entendi. {resto}",
    "Entendi! {resto}",
    "Tô aqui, te ouvindo. {resto}",
    "Anotado. {resto}",
    "Saquei. {resto}",
    "Uhum. {resto}",
    "Tá bom! {resto}",
  ] },
  // a música do dia (musicaDia.js; o título e o artista nunca vão para a API)
  musicaDia: { rosto: () => "animada", bom: [
    "Separei a música do dia para você: {titulo}, de {artista}. {porque}",
    "Música do dia! Hoje é {titulo} ({artista}). {porque}",
    "Escolhi uma música para hoje: {titulo}, de {artista}. {porque}",
    "Hora da música do dia: {titulo}. {porque}",
    "Trouxe uma música: {titulo}, de {artista}. {porque}",
    "Que tal uma pausa com {titulo}? {porque}",
    "Minha escolha de hoje: {titulo} ({artista}). {porque}",
    "A trilha de hoje é {titulo}, de {artista}. {porque}",
  ] },
  musicaOutra: { rosto: () => "piscadinha", bom: ["Tá bom, então essa: {titulo}, de {artista}. {porque}", "Troquei! Que tal {titulo} ({artista})? {porque}",
    "Outra, então: {titulo}. {porque}", "Sem problema. Agora vai {titulo}, de {artista}. {porque}"] },
  musicaSem: { rosto: () => "pensativa", bom: ["Ainda não achei músicas neste aparelho. Escolhe a pasta nas Músicas e eu passo a recomendar.",
    "Não encontrei a sua biblioteca aqui. Quando as Músicas tiverem músicas, eu escolho uma por dia."] },
  musicaJa: { rosto: () => "piscadinha", bom: ["A de hoje é {titulo}! Tá ali em cima, é só tocar.", "Já escolhi: {titulo}. Dá o play ali em cima.", "Hoje é {titulo}, lembra? Tá logo acima."] },
  // o resumo do mês e a retrospectiva (resumoMes.js, retroEva.js)
  resumoMes: { rosto: () => "comemorando", bom: [
    "O mês de {mes} acabou! Fiz um resumo do que você conquistou:",
    "Fechamos {mes}! Olha só tudo o que você fez:",
    "Resumo de {mes} pronto. Tô orgulhosa:",
    "Virou o mês! Separei os números de {mes} para você:",
  ] },
  retroOferta: { rosto: () => "animada", bom: [
    "Preparei uma surpresa: a sua retrospectiva dos últimos meses, com música e tudo. Quer ver?",
    "Fiz uma retrospectiva animada dos seus meses, com uma das músicas que você mais ouviu. Bora assistir?",
    "Juntei os seus últimos meses numa retrospectiva. Aperta o play!",
  ] },
};

/** A chave de um modelo de fala ("bomdia.b.3"), para não repetir o mesmo texto em dias seguidos. */
const chaveModelo = (tipo, faixa, i) => `${tipo}.${faixa}.${i}`;
/**
 * Sorteia um item da lista evitando os modelos em `evitar` (Set de chaves); se todos estão em `evitar`, vale qualquer
 * um (o mais antigo dos recentes não importa: a lista é grande). → { i, s }
 */
export function escolher(lista, rnd, evitar = null, prefixo = "") {
  const livres = evitar?.size ? lista.map((s, i) => [s, i]).filter(([, i]) => !evitar.has(`${prefixo}${i}`)) : null;
  const l = livres?.length ? livres : lista.map((s, i) => [s, i]);
  const [s, i] = l[Math.floor(rnd() * l.length) % l.length];
  return { s, i };
}
/**
 * Monta uma fala: { texto, humor, modelo }. `nivel` = humor da Eva (0 a 4), `v` = as variáveis, `rnd` = gerador,
 * `o.evitar` = Set das chaves de modelo usadas há pouco (as programadas dos últimos dias, as respostas recentes).
 */
export function fala(tipo, v = {}, rnd = Math.random, nivel = 2, o = {}) {
  const f = FALAS[tipo];
  if (!f) return { texto: "", humor: "normal", modelo: "" };
  const faixa = nivel <= 1 && f.bom ? "b" : nivel === 2 && f.neutro ? "n" : nivel >= 3 && f.baixo ? "x" : f.bom ? "b" : "n";
  const lista = { b: f.bom, n: f.neutro, x: f.baixo }[faixa];
  const { s, i } = escolher(lista, rnd, o.evitar, `${tipo}.${faixa}.`);
  const vv = { nome: "Alediov", ...v };
  const texto = contrair(preencher(s, vv)).replace(/\s+/g, " ").trim()
    .replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, a, b) => a + b.toUpperCase()); // o item no começo da frase
  return { texto, humor: f.rosto ? f.rosto(nivel) : "normal", modelo: chaveModelo(tipo, faixa, i) };
}
/** Um pedaço solto (a prova, a véspera). */
export const pedaco = (tipo, v, rnd) => preencher(sortear(FALAS[tipo], rnd), v);
/** Primeira letra maiúscula (o item no começo da frase). */
export const maiuscula = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Quanto tempo ela "digita" antes de uma resposta pronta aparecer (pedido do Alediov, 05/11/2026: não responder na
 * hora). 700 ms + ~25 ms por letra, até 3,5 s, com ±15% de acaso; com "reduzir movimento", bem mais curto.
 */
export function atrasoDigitando(texto, { rnd = Math.random, reduzir = false } = {}) {
  const n = String(texto || "").length;
  if (reduzir) return Math.round(Math.min(900, 250 + n * 6));
  const base = Math.min(3500, 700 + n * 25);
  return Math.round(Math.min(3500, base * (0.85 + rnd() * 0.3)));
}

/** Algo que pede cuidado de verdade (para a resposta com o CVV, com ou sem a API). */
export const ANGUSTIA = /(me matar|me mata\b|suic[ií]d|n[aã]o (aguento|quero) mais viver|quero morrer|tirar (a )?minha (pr[oó]pria )?vida|sumir (de vez|pra sempre|para sempre)|me machucar|acabar com tudo|n[aã]o vejo sa[ií]da)/i;
export const CANSACO = /(cansad|exaust|esgotad|sem energia|morto de sono|morta de sono|acabado|destru[ií]do)/i;
export const SAUDACAO = /^(oi+e?|ol[aá]+|e a[ií]|eae|opa|hey|eva)\b/i;
export const QUE_FALTA = /(o que falta|que (eu )?tenho (que|pra|para) fazer|resumo|meu dia|o que tem (pra |para )?hoje|pendente|falta (algo|alguma coisa|o qu[eê]))/i;
// o resto da conversa sem a IA (respostaLocal em eva.js): a ordem importa, a primeira que casar responde
const PADROES = [
  ["boaNoiteResp", /^(boa noite|boa noitee|vou dormir|indo dormir|bons sonhos|at[eé] amanh[aã])\b/i],
  ["bomDiaResp", /^(bom dia|bom diaa+|bdia)\b/i],
  ["boaTardeResp", /^(boa tarde)\b/i],
  ["obrigado", /\b(obrigad[oa]|obg|valeu|vlw|brigad[oa]|agrade[cç]o|thanks)\b/i],
  ["desculpa", /\b(desculp|foi mal|perd[aã]o|me perdoa)/i],
  ["carinho", /\b(te amo|amo voc[eê]|gosto de voc[eê]|casa comigo|namora comigo|minha namorada|meu amor|saudade de voc[eê])/i],
  ["elogio", /\b(voc[eê] [eé] (demais|incr[ií]vel|[oó]tima|linda|fofa|a melhor)|te adoro|adoro voc[eê]|melhor (assistente|companheira))/i],
  ["quemE", /\b(quem [eé] voc[eê]|quem voc[eê] [eé]|o que voc[eê] [eé]|voc[eê] [eé] (uma )?(ia|rob[oô]|humana|real|gente))/i],
  ["ajuda", /\b(o que voc[eê] (faz|pode fazer|sabe fazer)|como (voc[eê] funciona|funciona isso)|me ajuda|ajuda|comandos)/i],
  ["musica", /\b(m[uú]sica|ouvir algo|recomenda (uma|alguma)|o que ouvir|playlist)/i],
  ["provaInfo", /\b(quando [eé] a prova|pr[oó]xima prova|tem prova|prova (de|da|do)|minhas provas|provas)/i],
  ["agendaHoje", /\b(agenda|aula hoje|aulas hoje|tem aula|que aula|meus hor[aá]rios|compromisso)/i],
  ["tudoBemDele", /^(?!.*\?)(t[oô] bem|estou bem|tudo (bem|[oó]timo|certo|tranquilo|joia)|bem,? e voc[eê]|[oó]timo|tranquilo|de boa|suave)\b/i],
  ["tudoBem", /\b(tudo (bem|bom|certo|tranquilo)|como (voc[eê] )?(est[aá]|t[aá])|como vai|e voc[eê]\??$|beleza\?|td bem)/i],
  ["triste", /\b(triste|tristeza|desanimad|deprimid|chateado|chateada|pra baixo|sozinho|sozinha|chorando|chorei|p[eé]ssimo|horr[ií]vel|mal hoje|t[oô] mal|estou mal|me sinto mal)/i],
  ["ansioso", /\b(ansios|ansiedade|nervos|preocupad|estressad|estresse|stress|surtando|p[aâ]nico|desesper)/i],
  ["fome", /\b(fome|faminto|almo[cç]ar|jantar|lanchar|comer algo)\b/i],
  ["sono", /\b(sono|sonolent|dormir|cochil|deitar)\b/i],
  ["risada", /^(k{3,}|(ha){2,}h?|(he){2,}|(rs)+|lol|kkk+)\b/i],
  ["ok", /^(ok+|okay|blz|beleza|t[aá] bom|t[aá] certo|certo|combinado|fechado|show|entendi|sim|claro|pode ser|uhum|aham|valeu)[.!]*$/i],
];
/** O assunto de um texto livre, para a resposta sem a IA (ou null). Puro. */
export function classificar(texto) {
  const s = String(texto || "").trim();
  if (!s) return null;
  for (const [tipo, re] of PADROES) if (re.test(s)) return tipo;
  if (SAUDACAO.test(s)) return "oi";
  return null;
}
