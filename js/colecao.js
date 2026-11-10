// Coleção de companheiros (cartas no estilo Clash Royale): raridades, cópias,
// evolução com moedas ou gemas, uma carta equipada com bônus.
import { E, salvar } from "./estado.js";
import { dente } from "./arte/dentes.js";
import { humano, PADRAO } from "./arte/humano.js";
import { bicho } from "./arte/bichos.js";
import { definirNiveis } from "./juntar.js";

export const RARIDADES_CARTA = {
  comum: { nome: "Comum", plural: "Comuns", cor: "#5C8DD6", escura: "#3B66A8", mult: 1 },
  rara: { nome: "Rara", plural: "Raras", cor: "#F28A1E", escura: "#B85F06", mult: 1.4 },
  epica: { nome: "Épica", plural: "Épicas", cor: "#9B5CF6", escura: "#6732C8", mult: 2 },
  lendaria: { nome: "Lendária", plural: "Lendárias", cor: "#E0434A", escura: "#A3232A", mult: 3 },
};
export const NIVEL_MAX = 10;
const COPIAS = { comum: [2, 4, 8, 15, 25, 40, 60, 90, 130], rara: [2, 3, 6, 10, 16, 25, 35, 50, 70], epica: [1, 2, 3, 5, 8, 12, 16, 22, 30], lendaria: [1, 1, 2, 3, 4, 6, 8, 10, 12] };
const CUSTO = [50, 120, 250, 500, 900, 1500, 2400, 3600, 5000];
/** Cópias gastas para levar a carta do nível 1 ao `nivel`. */
export function copiasInvestidas(id, nivel) { const t = COPIAS[CARTAS[id]?.raridade] || COPIAS.comum; return t.slice(0, Math.max(0, nivel - 1)).reduce((a, b) => a + b, 0); }
/** Moedas gastas para levar a carta do nível 1 ao `nivel` (pelo preço em moedas). */
export function moedasInvestidas(id, nivel) { const m = RARIDADES_CARTA[CARTAS[id]?.raridade]?.mult || 1; return CUSTO.slice(0, Math.max(0, nivel - 1)).reduce((a, b) => a + Math.round(b * m), 0); }

export const BONUS = {
  xp: (v) => `+${v}% de XP em tudo`,
  moedas: (v) => `+${v}% de moedas nas lições`,
  xpManha: (v) => `+${v}% de XP nas lições da manhã`,
  xpTarde: (v) => `+${v}% de XP nas lições da tarde`,
  xpNoite: (v) => `+${v}% de XP nas lições da noite`,
  presenca: (v) => `+${v}% de XP nas presenças`,
  xpPerfeita: (v) => `+${v}% de XP em lições perfeitas`,
  bauTempo: (v) => `−${v}% no tempo de abertura dos baús`,
  pocaoDuracao: (v) => `+${v}% na duração das poções`,
  curriculo: (v) => `+${v}% de XP no currículo`,
  gemaChance: (v) => `${v}% de chance de 1 gema extra por lição`,
};

const H = (cfg, extras = []) => ({ tipo: "humano", cfg, extras });
const D = (forma, opts = {}) => ({ tipo: "dente", forma, opts });
const B = (forma) => ({ tipo: "bicho", forma });

export const CARTAS = {
  moli: { nome: "Moli", raridade: "comum", desc: "O molar animado que começou tudo.", arte: D("molar"), bonus: { tipo: "xp", base: 2, passo: 1 } },
  ina: { nome: "Ina", raridade: "comum", desc: "Incisiva central, sempre na linha de frente.", arte: D("incisivo", { acessorios: ["laco"], cilios: true }), bonus: { tipo: "moedas", base: 3, passo: 1.5 } },
  leitinho: { nome: "Leitinho", raridade: "comum", desc: "Dente de leite que acorda cedo para estudar.", arte: D("leite", { acessorios: ["babador", "chupeta"], cor: "#FFFDF4" }), bonus: { tipo: "xpManha", base: 4, passo: 2 } },
  caio: { nome: "Caio", raridade: "comum", desc: "Colega de turma que divide as dúvidas.", arte: H({ cabelo: "cacheado", corCabelo: "preto", pele: "p5", roupa: "scrub", corRoupa: "verde", fundo: "menta" }), bonus: { tipo: "xpNoite", base: 4, passo: 2 } },
  bia: { nome: "Bia", raridade: "comum", desc: "Monitora do CEO, nunca falta a um plantão.", arte: H({ cabelo: "rabo", corCabelo: "ruivo", pele: "p2", olhos: "cilios", corOlhos: "verde", boca: "sorrisao", roupa: "scrub", corRoupa: "verde", fundo: "areia" }), bonus: { tipo: "presenca", base: 10, passo: 4 } },
  cani: { nome: "Cani", raridade: "rara", desc: "O canino mais estiloso do arco.", arte: D("canino", { acessorios: ["escuros"] }), bonus: { tipo: "xp", base: 3, passo: 1.5 } },
  premi: { nome: "Premi", raridade: "rara", desc: "Pré-molar vaidosa e especialista em poções.", arte: D("premolar", { acessorios: ["brincos"], cilios: true }), bonus: { tipo: "pocaoDuracao", base: 10, passo: 4 } },
  lia: { nome: "Dra. Lia", raridade: "rara", desc: "Professora que transforma aula em história.", arte: H({ cabelo: "coque", corCabelo: "castanho", rosto: "oculos", olhos: "cilios", roupa: "jaleco", corRoupa: "vinho", fundo: "rosa" }, ["livro"]), bonus: { tipo: "xpTarde", base: 6, passo: 2.5 } },
  yumi: { nome: "Yumi", raridade: "rara", desc: "Caloura de franja que não aceita menos que 100%.", arte: H({ cabelo: "franja", corCabelo: "preto", pele: "p1", olhos: "grandes", corOlhos: "castanho", roupa: "scrub", corRoupa: "rosa", fundo: "lilas" }), bonus: { tipo: "xpPerfeita", base: 10, passo: 4 } },
  sisa: { nome: "Vó Sisa", raridade: "epica", desc: "A sábia dente do siso: chegou por último, sabe de tudo.", arte: D("molar", { acessorios: ["redondos", "coque_branco"], cilios: true, cor: "#FFF8EC" }), bonus: { tipo: "bauTempo", base: 8, passo: 2 } },
  mel: { nome: "Mel", raridade: "epica", desc: "Cirurgiã bucomaxilofacial, o seu futuro em pessoa.", arte: H({ cabelo: "trancas", corCabelo: "castanho", pele: "p4", chapeu: "touca", rosto: "lupas", roupa: "scrub", corRoupa: "azul", fundo: "azul" }, ["estetoscopio"]), bonus: { tipo: "curriculo", base: 15, passo: 5 } },
  nix: { nome: "Nix", raridade: "epica", desc: "Feiticeira das poções. Cada gota dura mais.", arte: H({ cabelo: "longo", corCabelo: "roxo", chapeu: "mago", roupa: "capa_maga", corRoupa: "preto", olhos: "cilios", corOlhos: "violeta", boca: "sorrisinho", fundo: "galaxia" }, ["brilhos"]), bonus: { tipo: "pocaoDuracao", base: 20, passo: 5 } },
  implantina: { nome: "Implantina", raridade: "epica", desc: "Implante de titânio: firme, brilhante e cara.", arte: D("implante", { acessorios: ["brincos"], cilios: true, cor: "#F7FBFF" }), bonus: { tipo: "moedas", base: 6, passo: 2 } },
  aurora: { nome: "Aurora", raridade: "lendaria", desc: "A Fada do Dente. Às vezes deixa uma gema debaixo do travesseiro.", arte: H({ cabelo: "longo_ondulado", corCabelo: "loiro", chapeu: "tiara", olhos: "grandes", corOlhos: "azul", roupa: "vestido", corRoupa: "lilas", fundo: "aurora" }, ["asas", "varinha", "brilhos"]), bonus: { tipo: "gemaChance", base: 4, passo: 1 } },
  // ----- exclusivas de eventos (só no baú do evento, que volta todo ano) -----
  pirulito: { nome: "Pirulito", raridade: "rara", evento: "criancas", desc: "Dente de leite que trocou a chupeta por um boné de hélice.", arte: D("leite", { chapeu: "helice", cor: "#FFFDF4" }), bonus: { tipo: "xpPerfeita", base: 8, passo: 3 } },
  dentina: { nome: "Dentina", raridade: "epica", evento: "dentista", desc: "Homenagem ao Dia do Cirurgião-Dentista, 25 de outubro.", arte: D("incisivo", { chapeu: "touca_dente", cilios: true }), bonus: { tipo: "xp", base: 4, passo: 1.5 } },
  fantasminha: { nome: "Fantasminha", raridade: "epica", evento: "halloween", desc: "Assombra quem esquece de passar o fio dental.", arte: D("premolar", { chapeu: "bruxa", cor: "#EEF0FF", brilho: "#C9C4F5" }), bonus: { tipo: "bauTempo", base: 8, passo: 2 } },
  festeira: { nome: "Festeira", raridade: "lendaria", evento: "aniversario", desc: "Só aparece no seu aniversário, 6 de novembro.", arte: H({ cabelo: "cacheado", corCabelo: "rosa", pele: "p3", chapeu: "festa", olhos: "grandes", corOlhos: "mel", boca: "sorrisao", roupa: "vestido", corRoupa: "dourado", fundo: "aurora" }, ["brilhos"]), bonus: { tipo: "gemaChance", base: 3, passo: 1 } },
  noelzinho: { nome: "Noelzinho", raridade: "epica", evento: "natal", desc: "Traz presente para quem estuda até o Natal.", arte: D("molar", { chapeu: "gorro" }), bonus: { tipo: "moedas", base: 6, passo: 2 } },
  estrelinha: { nome: "Estrelinha", raridade: "epica", evento: "ano_novo", desc: "Brinda o ano novo com metas de estudo.", arte: D("incisivo", { chapeu: "cartola", acessorios: ["brilho"], cor: "#FFF6D6", cilios: true }), bonus: { tipo: "xp", base: 4, passo: 1.5 } },
  confete: { nome: "Confete", raridade: "epica", evento: "carnaval", desc: "O canino mais animado da avenida.", arte: D("canino", { chapeu: "plumas", cilios: true }), bonus: { tipo: "xpTarde", base: 8, passo: 3 } },
  cora: { nome: "Cora", raridade: "epica", evento: "pascoa", desc: "Esconde ovos de chocolate e lembra de escovar depois.", arte: H({ cabelo: "longo_ondulado", corCabelo: "mel", pele: "p2", chapeu: "coelho", olhos: "cilios", corOlhos: "verde", boca: "sorriso", roupa: "vestido", corRoupa: "rosa", fundo: "rosa" }), bonus: { tipo: "xpManha", base: 8, passo: 3 } },
  juninha: { nome: "Juninha", raridade: "epica", evento: "junina", desc: "Quadrilha, pé de moleque e presença em todas as aulas.", arte: H({ cabelo: "trancas", corCabelo: "castanho", pele: "p4", chapeu: "palha", olhos: "felizes", boca: "sorrisao", roupa: "vestido", corRoupa: "vinho", fundo: "areia" }), bonus: { tipo: "presenca", base: 15, passo: 5 } },
  // ----- segunda leva: instrumentos, bichos dentuços, criaturas, micróbios e gente da clínica -----
  escovinha: { nome: "Escovinha", raridade: "comum", desc: "Escova macia, cerdas arredondadas, 2 minutos sem pressa.", arte: B("escovinha"), bonus: { tipo: "xpManha", base: 4, passo: 2 } },
  fiona: { nome: "Fiona", raridade: "comum", desc: "Fio dental que entra onde a escova não alcança.", arte: B("fiona"), bonus: { tipo: "xpNoite", base: 4, passo: 2 } },
  pastinha: { nome: "Pastinha", raridade: "comum", desc: "Creme dental com flúor: só um grão de ervilha basta.", arte: B("pastinha"), bonus: { tipo: "moedas", base: 3, passo: 1.5 } },
  espelhinho: { nome: "Espelhinho", raridade: "comum", desc: "Espelho clínico: afasta, ilumina e mostra o que ninguém vê.", arte: B("espelhinho"), bonus: { tipo: "xpPerfeita", base: 6, passo: 3 } },
  castor: { nome: "Castor Laranjinha", raridade: "comum", desc: "Tem ferro no esmalte, por isso os incisivos são laranja.", arte: B("castor"), bonus: { tipo: "xp", base: 2, passo: 1 } },
  hipo: { nome: "Hipo", raridade: "comum", desc: "Hipopótamo de bocão: os caninos crescem a vida toda.", arte: B("hipo"), bonus: { tipo: "presenca", base: 10, passo: 4 } },
  gosminha: { nome: "Gosminha", raridade: "comum", desc: "Uma gosma da Defesa do Sorriso que mudou de lado.", arte: B("gosminha"), bonus: { tipo: "xpTarde", base: 4, passo: 2 } },
  tati: { nome: "ASB Tati", raridade: "comum", desc: "Auxiliar de saúde bucal: o consultório só anda com ela.", arte: H({ cabelo: "rabo", corCabelo: "preto", pele: "p4", olhos: "felizes", boca: "sorrisao", chapeu: "touca", roupa: "scrub", corRoupa: "lilas", fundo: "lilas" }), bonus: { tipo: "presenca", base: 12, passo: 4 } },
  carpule: { nome: "Carpule", raridade: "rara", desc: "Seringa carpule com refluxo: aspira antes de injetar.", arte: B("carpule"), bonus: { tipo: "xpManha", base: 6, passo: 2.5 } },
  tubetinho: { nome: "Tubetinho", raridade: "rara", desc: "Tubete de 1,8 mL com tarja vermelha: lidocaína.", arte: B("tubetinho"), bonus: { tipo: "pocaoDuracao", base: 10, passo: 4 } },
  capivara: { nome: "Capivara", raridade: "rara", desc: "O maior roedor do mundo. Nada a abala, nem a prova.", arte: B("capivara"), bonus: { tipo: "bauTempo", base: 5, passo: 1.5 } },
  tubarao: { nome: "Tubarão Troca-Troca", raridade: "rara", desc: "Troca milhares de dentes na vida. Inveja de qualquer paciente.", arte: B("tubarao"), bonus: { tipo: "xp", base: 3, passo: 1.5 } },
  morsa: { nome: "Morsa", raridade: "rara", desc: "As presas de quase 1 metro são caninos superiores.", arte: B("morsa"), bonus: { tipo: "moedas", base: 5, passo: 2 } },
  mutans: { nome: "Mutans Redimido", raridade: "rara", desc: "Streptococcus mutans que largou o açúcar e virou do bem.", arte: B("mutans"), bonus: { tipo: "xpNoite", base: 6, passo: 2.5 } },
  raul: { nome: "Dr. Raul", raridade: "rara", desc: "Anestesista calmo: sabe a dose máxima de cabeça.", arte: H({ cabelo: "raspado", corCabelo: "castanho", pele: "p3", barba: "barba", rosto: "oculos", olhos: "serio", boca: "sorrisinho", roupa: "jaleco", corRoupa: "azul", fundo: "azul" }, ["estetoscopio"]), bonus: { tipo: "xpPerfeita", base: 10, passo: 4 } },
  siso: { nome: "Siso Rebelde", raridade: "rara", desc: "Terceiro molar semi-incluso que não quer sair por nada.", arte: D("molar", { acessorios: ["bandana", "curativo"], cor: "#FFFBF0" }), bonus: { tipo: "xpTarde", base: 6, passo: 2.5 } },
  turbina: { nome: "Turbina", raridade: "epica", desc: "Caneta de alta rotação: 400 mil rpm e spray de água.", arte: B("turbina"), bonus: { tipo: "xp", base: 4, passo: 1.5 } },
  narval: { nome: "Narval", raridade: "epica", desc: "O chifre é, na verdade, um dente canino em espiral.", arte: B("narval"), bonus: { tipo: "gemaChance", base: 2, passo: 0.5 } },
  golem: { nome: "Golem de Esmalte", raridade: "epica", desc: "Feito do tecido mais duro do corpo. Não quebra, só protege.", arte: B("golem"), bonus: { tipo: "bauTempo", base: 8, passo: 2 } },
  barao: { nome: "Barão Dourado", raridade: "epica", desc: "Coroa de ouro das antigas, cheio de pose e de moedas.", arte: D("molar", { acessorios: ["monoculo", "bigode", "brilho"], cor: "#F7D774", brilho: "#FFF3B0" }), bonus: { tipo: "moedas", base: 7, passo: 2 } },
  neve: { nome: "Prof.ª Neve", raridade: "epica", desc: "Patologista que reconhece uma lesão só de olhar a lâmina.", arte: H({ cabelo: "longo", corCabelo: "branco", pele: "p2", rosto: "redondos", olhos: "cilios", corOlhos: "azul", boca: "sorrisinho", roupa: "jaleco", corRoupa: "vinho", fundo: "lilas" }, ["livro"]), bonus: { tipo: "xpTarde", base: 9, passo: 3 } },
  polvo: { nome: "Polvo Higienista", raridade: "epica", desc: "Oito braços: escova, fio e enxaguante ao mesmo tempo.", arte: B("polvo"), bonus: { tipo: "curriculo", base: 15, passo: 5 } },
  sisorath: { nome: "Sisorath Filhote", raridade: "lendaria", desc: "O dragão da Masmorra do Siso, antes de crescer e virar chefe.", arte: B("sisorath"), bonus: { tipo: "xp", base: 5, passo: 2 } },
  unicornio: { nome: "Unicórnio do Flúor", raridade: "lendaria", desc: "O chifre é um cristal de fluorapatita. Deixa tudo mais resistente.", arte: B("unicornio"), bonus: { tipo: "bauTempo", base: 12, passo: 2 } },
  mamute: { nome: "Mamute", raridade: "lendaria", desc: "As presas de marfim são incisivos que nunca pararam de crescer.", arte: B("mamute"), bonus: { tipo: "moedas", base: 10, passo: 3 } },
  futuro: { nome: "Você do Futuro", raridade: "lendaria", desc: "Formado, residente e mestre: o seu avatar daqui a alguns anos.", arte: { tipo: "avatar" }, bonus: { tipo: "curriculo", base: 25, passo: 6 } },
  // ----- terceira leva (26/10/2026): Periodontia, Farmacologia, a pesquisa e bichos de dentes curiosos -----
  sondinha: { nome: "Sondinha", raridade: "comum", desc: "Sonda periodontal milimetrada: até 3 mm de sulco é gengiva feliz.", arte: B("sondinha"), bonus: { tipo: "xpTarde", base: 4, passo: 2 } },
  coelhinho: { nome: "Coelhinho", raridade: "comum", desc: "Os incisivos nunca param de crescer: roer é a lixa dele.", arte: B("coelho"), bonus: { tipo: "xpManha", base: 4, passo: 2 } },
  amoxi: { nome: "Amoxi", raridade: "comum", desc: "A cápsula mais receitada na odontologia, sempre no horário certo.", arte: B("amoxi"), bonus: { tipo: "moedas", base: 3, passo: 1.5 } },
  pacu: { nome: "Pacu Sorridente", raridade: "rara", desc: "Peixe dos rios do Pantanal com dentes que lembram os nossos: quebra sementes e castanhas.", arte: B("pacu"), bonus: { tipo: "moedas", base: 5, passo: 2 } },
  cureta: { nome: "Gracey", raridade: "rara", desc: "Cureta de Gracey: cada número tem a curva certa para um grupo de dentes.", arte: B("cureta"), bonus: { tipo: "xpPerfeita", base: 10, passo: 4 } },
  fichinha: { nome: "Fichinha", raridade: "rara", desc: "Ficha de atendimento que virou dado de pesquisa, sem nenhum nome de paciente.", arte: B("ficha"), bonus: { tipo: "curriculo", base: 12, passo: 4 } },
  duda: { nome: "Liguista Duda", raridade: "rara", desc: "Da liga de Periodontia: sonda na mão e o Lindhe na mochila.", arte: H({ cabelo: "rabo", corCabelo: "castanho", pele: "p3", olhos: "cilios", corOlhos: "mel", boca: "sorrisao", roupa: "scrub", corRoupa: "rosa", fundo: "rosa" }, ["sonda"]), bonus: { tipo: "presenca", base: 12, passo: 4 } },
  lesma: { nome: "Lesma da Rádula", raridade: "epica", desc: "A rádula é uma fita com milhares de dentículos, e se renova a vida toda.", arte: B("lesma"), bonus: { tipo: "xpNoite", base: 8, passo: 3 } },
  ourico: { nome: "Ouriço-do-mar", raridade: "epica", desc: "Cinco dentes que se afiam sozinhos, na Lanterna de Aristóteles.", arte: B("ourico"), bonus: { tipo: "bauTempo", base: 8, passo: 2 } },
  megalodonte: { nome: "Megalodonte", raridade: "lendaria", desc: "O tubarão pré-histórico de dentes do tamanho de uma mão.", arte: B("megalodonte"), bonus: { tipo: "xp", base: 6, passo: 2 } },
  ratotoupeira: { nome: "Rato-toupeira-pelado", raridade: "lendaria", desc: "Os incisivos ficam fora dos lábios: cava túneis de boca fechada.", arte: B("rato"), bonus: { tipo: "gemaChance", base: 4, passo: 1 } },
  // prêmio do nível 15 de colecionador (colecionador.js): não sai de baú nem das ofertas
  curador: { nome: "Curador", raridade: "lendaria", premio: "colecionador", desc: "Guarda cada carta e cada semente que você evoluiu, de monóculo e capa: nada se perde na coleção dele.", arte: D("molar", { acessorios: ["capa_real", "monoculo", "brilho"], cor: "#FFF8EC" }), bonus: { tipo: "moedas", base: 8, passo: 2 } },
  esmalte: { nome: "Rainha Esmalte", raridade: "lendaria", desc: "Soberana do arco dental, o tecido mais duro do corpo.", arte: D("incisivo", { acessorios: ["capa_real", "coroa_real", "brilho"], cilios: true, cor: "#FFFDF7" }), bonus: { tipo: "xp", base: 6, passo: 2 } },
};

// sincronização entre aparelhos (juntar.js): a mesma evolução feita nos dois não tira as cópias duas vezes
definirNiveis(/^colecao\.cartas\.([^.]+)$/, copiasInvestidas);

export function arteCarta(id, { humor = "feliz", classe = "", semFundo = false, chapeu = null } = {}) {
  const c = CARTAS[id] || CARTAS.moli;
  if (c.arte.tipo === "dente") return dente(c.arte.forma, { ...c.arte.opts, humor, classe, nome: c.nome, ...(chapeu ? { chapeu } : {}) });
  if (c.arte.tipo === "bicho") return bicho(c.arte.forma, { humor, classe, nome: c.nome, chapeu });
  if (c.arte.tipo === "avatar") { // o avatar do Perfil, já formado: capelo, jaleco e lupas
    const cfg = { ...PADRAO, ...(E().avatar?.cfg || {}), roupa: "jaleco", corRoupa: "branco", rosto: "lupas", chapeu: chapeu || "capelo", fundo: "aurora" };
    return humano(cfg, { humor, classe, extras: ["estetoscopio", "brilhos"], semFundo });
  }
  return humano(chapeu ? { ...c.arte.cfg, chapeu } : c.arte.cfg, { humor, classe, extras: c.arte.extras, semFundo });
}

function col() {
  const est = E();
  est.colecao ??= { cartas: { moli: { nivel: 1, copias: 0 } }, equipada: "moli" };
  return est.colecao;
}
export function iniciarColecao() { col(); salvar(); }
export const colecao = () => col();
export const equipada = () => col().equipada || "moli";
export function equipar(id) { if (col().cartas[id]) { col().equipada = id; salvar(); window.dispatchEvent(new Event("oq-colecao")); } }
let chapeuEvento = null;
/** Durante um evento sazonal, o companheiro equipado usa o chapéu do evento. */
export function definirChapeuEvento(c) { chapeuEvento = c; }
export function arteCompanheiro(opts = {}) { return arteCarta(equipada(), { ...opts, chapeu: chapeuEvento }); }
export const nomeCompanheiro = () => CARTAS[equipada()].nome;

export function valorBonus(id, nivel) { const b = CARTAS[id].bonus; return Math.round((b.base + b.passo * (nivel - 1)) * 10) / 10; }
export function copiasParaEvoluir(id) {
  const c = col().cartas[id]; if (!c || c.nivel >= NIVEL_MAX) return null;
  return COPIAS[CARTAS[id].raridade][c.nivel - 1];
}
export function custoEvoluir(id) {
  const c = col().cartas[id]; if (!c || c.nivel >= NIVEL_MAX) return null;
  const moedas = Math.round(CUSTO[c.nivel - 1] * RARIDADES_CARTA[CARTAS[id].raridade].mult);
  return { moedas, gemas: Math.ceil(moedas / 50) };
}
export function podeEvoluir(id) { const c = col().cartas[id], n = copiasParaEvoluir(id); return !!c && n != null && c.copias >= n; }
export function evoluir(id, moeda) {
  const est = E(), c = col().cartas[id];
  if (!podeEvoluir(id)) return { erro: "Faltam cópias desta carta." };
  const custo = custoEvoluir(id);
  if (moeda === "gemas") { if ((est.gemas || 0) < custo.gemas) return { erro: "Gemas insuficientes." }; est.gemas -= custo.gemas; }
  else { if (est.moedas < custo.moedas) return { erro: "Moedas insuficientes." }; est.moedas -= custo.moedas; }
  c.copias -= copiasParaEvoluir(id); c.nivel++;
  salvar(); window.dispatchEvent(new Event("oq-colecao"));
  return { ok: true, nivel: c.nivel };
}

/** Acrescenta cópias; a primeira cópia desbloqueia a carta no nível 1. */
export function darCopias(id, n) {
  const cs = col().cartas;
  let nova = false;
  if (!cs[id]) { cs[id] = { nivel: 1, copias: n - 1 }; nova = true; } else cs[id].copias += n;
  salvar();
  return nova;
}

const DROPS = {
  madeira: { comum: 3 },
  prata: { comum: 5, rara: () => (Math.random() < 0.5 ? 1 : 0) },
  ouro: { comum: 8, rara: 3, epica: () => (Math.random() < 0.15 ? 1 : 0) },
  epico: { comum: 12, rara: 6, epica: 2 },
  lendario: { comum: 15, rara: 8, epica: 3, lendaria: 1 },
};
/** Sorteia as cartas de um baú: devolve [{ id, qtd, nova }]. */
export function cartasDoBau(raridadeBau) {
  const out = [];
  for (const [rar, q] of Object.entries(DROPS[raridadeBau] || {})) {
    let n = typeof q === "function" ? q() : q;
    if (!n) continue;
    const pool = Object.keys(CARTAS).filter(k => CARTAS[k].raridade === rar && !CARTAS[k].evento && !CARTAS[k].premio);
    const tipos = Math.min(pool.length, n >= 6 ? 2 : 1);
    const escolhidas = [...pool].sort(() => Math.random() - 0.5).slice(0, tipos);
    escolhidas.forEach((id, i) => {
      const qtd = i === escolhidas.length - 1 ? n : Math.ceil(n * (0.4 + Math.random() * 0.3));
      n -= qtd;
      if (qtd > 0) out.push({ id, qtd, nova: darCopias(id, qtd) });
    });
  }
  return out;
}
