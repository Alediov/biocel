// Minijogos educativos (bônus: não contam para ofensiva nem meta).
// Blitz 60s, Memória, Dose Máxima e Detetive. Recompensa com teto diário.
// Jogos juntados (pedido do Alediov, 04/11/2026): as duas Memórias Bilíngues e a de Conceitos viraram a "Memória"
// (o conteúdo se escolhe na abertura), os dois Detetives viraram o "Detetive" (Patologia, Estomatologia ou tudo) e as
// duas Doses Máximas viraram uma só (Malamed, Andrade ou os dois); o Termo do Dia saiu. Os ids antigos que ainda
// aparecem (lições-jogo guardadas, recordes) passam por `JOGO_ANTIGO`.
import { E, salvar, hojeISO, ganhar, contar, registrarResposta, concluirLicao, tamanhoDe, INICIO_TAMANHO } from "./estado.js";
import { bancoDeExercicios, extra } from "./dados.js";
import { embaralhar } from "./exercicios.js";
import { creditarEvento, eventoAtivo } from "./eventos.js";
import { moli } from "./personagens.js";
import { icone } from "./icones.js";
import { tocar, vibrar } from "./sons.js";
import { modal, toast, confete, escapar } from "./ui.js";
import { jogarDefesa } from "./jogos/defesa.js";
import { jogarMasmorra } from "./jogos/masmorra.js";
import { jogarReceita } from "./jogos/receita.js";
import { jogarMira } from "./jogos/mira.js";
import { jogarConsulta } from "./jogos/consulta.js";
import { jogarLaminas } from "./jogos/laminas.js";
import { jogarGaleria } from "./jogos/galeria.js";
import { jogarPerio } from "./jogos/perio.js";
import { jogarAnestesico } from "./jogos/anestesico.js";
import { jogarPratica, PROVA_PRATICA } from "./jogos/pratica.js";
import { jogarLesoes } from "./jogos/lesoes.js";
import { musicaCamada } from "./musica.js";
import { multiplicadorAtual, verificarBauDoDia, verificarBauBonus, ABAS_BONUS } from "./economia.js";
import { htmlBauGanho } from "./bausUI.js";
import { montarCalculadora, montarCaderno } from "./ferramentasLicao.js";

const TETO = { xp: 60, moedas: 30 };
/** Banco dos jogos: só questões das trilhas normais (sem as de seminários e outros eventos). */
export async function bancoJogos() {
  const b = await bancoDeExercicios();
  for (const [id, e] of b) if (e._evento || String(id).startsWith("ev-")) b.delete(id);
  return b;
}
const tela = () => document.getElementById("tela");
let aoMudar = () => {};
export function definirAoMudarJogos(fn) { aoMudar = fn; }

function J() {
  const est = E();
  est.jogos ??= { dia: "", xp: 0, moedas: 0, recordes: {}, partidas: 0 };
  if (est.jogos.dia !== hojeISO()) Object.assign(est.jogos, { dia: hojeISO(), xp: 0, moedas: 0 });
  est.jogos.escolhas ??= {};
  // o recorde do antigo Detetive da Mucosa vale para o Detetive juntado (o maior dos dois; a chave antiga fica, sem uso)
  const r = est.jogos.recordes ??= {};
  if (r["detetive-mucosa"] != null && !(r.detetive >= r["detetive-mucosa"])) r.detetive = r["detetive-mucosa"];
  return est.jogos;
}
/** A escolha guardada de um jogo (conteúdo da Memória, mapa das Aventuras…); com `valor`, guarda. */
export function escolhaJogo(chave, valor) {
  const j = J();
  if (valor !== undefined) { j.escolhas[chave] = valor; salvar(); }
  return j.escolhas[chave];
}
const num = (n, casas = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const sorteia = (a) => a[Math.floor(Math.random() * a.length)];

// Categorias da tela de jogos: por matéria, os gerais (questões de todas as trilhas) e as aventuras.
const CATEGORIAS = [
  { id: "anestesio", nome: "Anestesiologia & Biossegurança", icone: "💉", cor: "#2F6BFF", sub: "Malamed, Manual de Anestesia Local" },
  { id: "pato", nome: "Patologia", icone: "🔬", cor: "#E8742A", sub: "Neville, Oral and Maxillofacial Pathology" },
  { id: "estomato", nome: "Estomatologia", icone: "🩺", cor: "#C2417A", sub: "Burket's Oral Medicine" },
  { id: "perio", nome: "Periodontia", icone: "🪥", cor: "#D9467A", sub: "Lindhe, Clinical Periodontology and Implant Dentistry" },
  { id: "semio", nome: "Semiologia", icone: "🔍", cor: "#0E8FA8", sub: "Lesões fundamentais (artigo do seminário e Burket)" },
  { id: "farmaco", nome: "Farmacologia", icone: "💊", cor: "#12A37A", sub: "Andrade, Terapêutica Medicamentosa" },
  { id: "gerais", nome: "Gerais", icone: "🧠", cor: "#8A4FE0", sub: "Questões de todas as trilhas" },
  { id: "aventuras", nome: "Aventuras", icone: "⚔️", cor: "#C2410C", sub: "Fantasia, chefes e muitas perguntas" },
];
// Nomes: cada palavra principal com maiúscula (preposições e artigos em minúscula) e sem o nome do
// autor; o livro aparece na linha "fonte" do cartão e no subtítulo da categoria.
const JOGOS = [
  { id: "mira", cat: "anestesio", nome: "Mira da Agulha", fonte: "Malamed · caps. 13 e 14", icone: "🎯", desc: "Ponto de punção, seringa, profundidade, volume e nervos anestesiados de cada técnica.", jogar: () => jogarMira() },
  { id: "anestesico", cat: "anestesio", nome: "Escolha o Anestésico", fonte: "Malamed · caps. 3, 4, 13 e 14", icone: "💉", desc: "Peso, ASA, procedimento e hemostasia: escolha a solução, a técnica e o máximo de tubetes.", jogar: () => jogarAnestesico() },
  { id: "pratica", cat: "anestesio", nome: "Prova Prática", fonte: "Malamed · Manual de Anestesia Local", icone: "🧑‍⚕️", desc: "O caso da prova prática: quais técnicas e, de cada uma, a agulha, o volume e a inserção. Com a ficha completa de cada técnica, na ordem do livro.", jogar: () => jogarPratica() },
  { id: "dose", cat: "anestesio", nome: "Dose Máxima", fonte: "Malamed e Andrade · anestésicos locais", icone: "🧮", desc: "Peso do paciente, anestésico e conta: dose máxima em mg e em tubetes. Um livro ou os dois misturados.", jogar: () => jogarDose() },
  { id: "detetive", cat: "pato", nome: "Detetive", fonte: "Neville e Burket · casos clínicos", icone: "🕵️", desc: "As pistas aparecem uma a uma. Quanto antes acertar o diagnóstico, mais pontos. Patologia, Estomatologia ou tudo.", jogar: () => jogarDetetive() },
  { id: "laminas", cat: "pato", nome: "Treino de Lâminas", fonte: "Neville · prova prática de 01/12", icone: "🔬", desc: "Granuloma piogênico, hiperplasia fibrosa, papiloma, mucocele e adenoma pleomórfico: identifique, ache o achado e descreva.", jogar: () => jogarLaminas() },
  { id: "galeria", cat: "estomato", nome: "Galeria Clínica", fonte: "Neville · fotos clínicas", icone: "📸", desc: "Fotos de 86 lesões da boca: reconheça cada uma entre as que se confundem, com a pista clínica.", jogar: () => jogarGaleria() },
  { id: "consulta", cat: "estomato", nome: "Consulta Segura", fonte: "Burket · caps. 8 e 13 a 22", icone: "🏥", desc: "Pacientes com doenças sistêmicas: decida se atende hoje, marque os cuidados e responda sobre o caso.", jogar: () => jogarConsulta() },
  { id: "perio", cat: "perio", nome: "Estágio e Grau", fonte: "Lindhe · caps. 15 e 16 (classificação de 2017)", icone: "📊", desc: "Periograma e ficha: saúde, gengivite ou periodontite, estágio, extensão e grau.", jogar: () => jogarPerio() },
  { id: "lesoes", cat: "semio", nome: "Lesões Fundamentais", fonte: "Artigo do seminário · Burket, cap. 3", icone: "🫧", desc: "Mácula, pápula, placa, nódulo, vesícula, bolha, pústula, erosão ou úlcera, pela descrição ou pela foto.", jogar: () => jogarLesoes() },
  { id: "receita", cat: "farmaco", nome: "Receituário", fonte: "Andrade · receituário da clínica da UNIOESTE", icone: "📋", desc: "Escreva a Receita no formulário da clínica, Ache o Erro numa receita pronta ou faça a Pediátrica (gotas e mL pelo peso).", jogar: () => jogarReceita() },
  { id: "blitz", cat: "gerais", nome: "Blitz de 60 Segundos", fonte: "Todas as trilhas", icone: "⏱️", desc: "Verdadeiro ou falso e múltipla escolha contra o relógio. Acertos seguidos multiplicam os pontos.", jogar: () => jogarBlitz() },
  { id: "memoria", cat: "gerais", nome: "Memória", fonte: "Neville, Burket ou as trilhas", icone: "🃏", desc: "Ache os pares: termos em inglês ↔ português da Patologia ou da Estomatologia, ou conceito ↔ definição das trilhas.", jogar: () => jogarMemoria() },
  { id: "defesa", cat: "aventuras", nome: "Defesa do Sorriso", fonte: "Próxima prova ou todas as trilhas", icone: "🛡️", desc: "Dois reinos: o Vale das Gosmas e a Cripta das Aranhas. Posicione seus companheiros da Coleção; perguntas certas rendem energia e quebram o selo dos chefes.", jogar: () => jogarDefesa() },
  { id: "masmorra", cat: "aventuras", nome: "Masmorra do Siso", fonte: "Próxima prova ou todas as trilhas", icone: "⚔️", desc: "Joystick, ataque e esquiva. Desça ao covil de Sisorath, o Dragão do Siso, ou à Cripta do Lich, com esqueletos e fantasmas; descanse na fogueira respondendo questões.", jogar: () => jogarMasmorra() },
];
JOGOS.splice(0, JOGOS.length, ...JOGOS.filter(j => ["blitz", "defesa", "masmorra"].includes(j.id)));
CATEGORIAS.splice(0, CATEGORIAS.length, ...CATEGORIAS.filter(c => ["gerais", "aventuras"].includes(c.id)));
// Ids antigos → [jogo juntado, conteúdo]: lições-jogo de dias já montados, o "Jogar de novo" e os recordes antigos.
const JOGO_ANTIGO = {
  "dose-malamed": ["dose", "malamed"], "dose-andrade": ["dose", "andrade"], "dose-criancas": ["receita", "pediatrica"],
  "detetive-mucosa": ["detetive", "estomato"],
  "memoria-glos": ["memoria", "glos"], "memoria-glos-burket": ["memoria", "glos-burket"], "memoria-pares": ["memoria", "pares"],
  termo: ["blitz"],
};
/** O jogo de hoje para um id (antigo ou novo) e o conteúdo escolhido: { jogo, modo }. */
export function jogoAtual(id, modo) {
  const [jogo, m] = JOGO_ANTIGO[id] || [id];
  return { jogo, modo: modo || m || null };
}
const NOMES = { dose: "Dose Máxima", memoria: "Memória", detetive: "Detetive", "detetive-mucosa": "Detetive", termo: "Termo do Dia", "dose-criancas": "Dose Pediátrica" };
export const nomeJogo = (id) => NOMES[id] || JOGOS.find(x => x.id === id)?.nome || id;
let ultimoJogar = null; // para o "Jogar de novo"

export function telaJogos() {
  const t = tela(), j = J();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Trilha";
  v.onclick = () => window.dispatchEvent(new CustomEvent("oq-ir", { detail: "trilha" }));
  t.append(v);
  const restXp = Math.max(0, TETO.xp - j.xp), restM = Math.max(0, TETO.moedas - j.moedas);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela" style="margin-top:4px">Jogos</h1>
    <div class="jogos-teto"><div><small>Bônus de hoje nos jogos</small><div class="nivel-barra"><div style="width:${(1 - restXp / TETO.xp) * 100}%"></div></div></div><b>${restXp} XP · ${restM} ${icone("🪙", "ico-inline")}</b></div>`);
  const chips = document.createElement("div"); chips.className = "chips-jogos";
  const filtro = CATEGORIAS.some(c => c.id === j.filtro) ? j.filtro : "todos";
  for (const [id, nome, ic] of [["todos", "Todos", "🎮"], ...CATEGORIAS.map(c => [c.id, c.nome, c.icone])]) {
    const b = document.createElement("button"); b.className = `chip-filtro ${id === filtro ? "on" : ""}`;
    b.innerHTML = `${icone(ic, "ico-inline")} ${nome}`;
    b.onclick = () => { tocar("toque"); j.filtro = id; salvar(); telaJogos(); };
    chips.append(b);
  }
  t.append(chips);
  let n = 0;
  for (const cat of CATEGORIAS) {
    if (filtro !== "todos" && filtro !== cat.id) continue;
    const sec = document.createElement("section"); sec.className = "cat-jogos"; sec.style.setProperty("--cor", cat.cor);
    const lista = JOGOS.filter(x => x.cat === cat.id);
    sec.innerHTML = `<div class="cat-cab">${icone(cat.icone, "ico3d ico-medio")}<div><h2>${cat.nome}</h2><small>${cat.sub} · ${lista.length} ${lista.length === 1 ? "jogo" : "jogos"}</small></div></div><div class="grade-jogos"></div>`;
    const g = sec.querySelector(".grade-jogos");
    for (const jg of lista) {
      const c = document.createElement("button"); c.className = "cartao-jogo2"; c.style.setProperty("--i", n++);
      const rec = j.recordes[jg.id];
      c.innerHTML = `<span class="cj-ico">${icone(jg.icone, "ico3d")}</span><span class="cj-txt"><b>${jg.nome}</b><em class="cj-fonte">${jg.fonte}</em><small>${jg.desc}</small>${rec != null ? `<em class="recorde">${icone("🏆", "ico-inline")} Recorde: ${rec}</em>` : ""}</span><span class="cj-jogar">Jogar</span>`;
      c.onclick = () => { tocar("toque"); ultimoJogar = jg.jogar; jg.jogar(); };
      g.append(c);
    }
    t.append(sec);
  }
}

// ---------------- jogo como lição da trilha ----------------
// Cada sessão (manhã, tarde, noite) ganha uma 5ª lição: um jogo ligado à matéria da sessão.
const INICIO_JOGOS_TRILHA = "2026-10-19";
const ROTACAO = {
  manha: [{ jogo: "mira", nome: "Mira da Agulha", icone: "🎯" }, { jogo: "dose", modo: "malamed", nome: "Dose Máxima", icone: "🧮" }],
  tarde: [{ jogo: "detetive", modo: "pato", nome: "Detetive", icone: "🕵️" }, { jogo: "memoria", modo: "glos", nome: "Memória", icone: "🃏" }],
  noite: [{ jogo: "blitz", nome: "Blitz de 60 Segundos", icone: "⏱️" }, { jogo: "memoria", modo: "pares", nome: "Memória", icone: "🧩" }, { jogo: "consulta", nome: "Consulta Segura", icone: "🏥" }, { jogo: "galeria", nome: "Galeria Clínica", icone: "📸" }],
  // sessão extra de Farmacologia (semana da prova): só o Receituário (a Dose Pediátrica foi para dentro dele)
  extra: [{ jogo: "receita", nome: "Receituário", icone: "📋" }],
};
// Prova Prática de Anestesio (pedido do Alediov, 04/11/2026): de 05/11 até a prova (18/11), 2 de cada 3 manhãs
const INICIO_PRATICA = "2026-11-05";
const PRATICA = { jogo: "pratica", nome: "Prova Prática", icone: "🧑‍⚕️" };
const diaDaPratica = (data) => data >= INICIO_PRATICA && data <= PROVA_PRATICA && Math.round((new Date(data + "T12:00") - new Date(INICIO_PRATICA + "T12:00")) / 864e5) % 3 !== 2;
// os jogos das provas práticas entram mesmo no dia corrido (como o Treino de Lâminas)
const DE_PROVA_PRATICA = new Set(["laminas", "pratica"]);
/** Acrescenta a lição-jogo ao fim de cada sessão do dia (a partir de 19/10/2026). Não mexe no dia guardado. */
export function comLicoesDeJogo(dia) {
  if (!dia?.sessoes || dia.data < INICIO_JOGOS_TRILHA) return dia;
  const n = +dia.data.slice(8, 10), temLaminas = dia.data <= "2026-12-01" && n % 2 === 0 && dia.sessoes.some(s => s.periodo === "tarde");
  const temPratica = diaDaPratica(dia.data) && dia.sessoes.some(s => s.periodo === "manha");
  return { ...dia, sessoes: dia.sessoes.map(s => {
    const per = s.periodo, rot = ROTACAO[per];
    if (!rot || s.licoes.some(l => l.jogo)) return s;
    // pode haver mais de uma sessão extra (ex.: Farmaco e METEP); os jogos do Receituário são só da Farmacologia
    if (per === "extra" && !/farmac/i.test(s.disciplina || "")) return s;
    // até a prova prática de Patologia (01/12/2026), o Treino de Lâminas entra em dia sim, dia não na tarde
    const g = per === "manha" && diaDaPratica(dia.data) ? PRATICA
      : per === "tarde" && dia.data <= "2026-12-01" && n % 2 === 0 ? { jogo: "laminas", nome: "Treino de Lâminas", icone: "🔬" } : per === "tarde" && dia.data <= "2026-12-01" ? rot[Math.floor(n / 2) % rot.length] : rot[n % rot.length];
    // tamanho do dia (tamanhoDia.js; pedido do Alediov, 29/10/2026: jogos viram bônus): no dia corrido, só o Treino de
    // Lâminas (é da prova prática); no normal, ele ou o da noite; no livre, os três
    if (dia.data >= INICIO_TAMANHO && !DE_PROVA_PRATICA.has(g.jogo)) {
      const tam = tamanhoDe(dia.data);
      if (tam === "corrido") return s;
      if (tam === "normal" && (per !== "noite" || temLaminas || temPratica)) return s;
    }
    return { ...s, licoes: [...s.licoes, { id: `${dia.data}-${per[0]}-jogo`, titulo: `Jogo: ${g.nome}`, icone: g.icone, jogo: g.jogo, ...(g.modo ? { modo: g.modo } : {}), exercicios: [] }] };
  }) };
}
let licaoPendente = null;
/** Abre o jogo da lição. Resolve com o resumo quando a lição é concluída, ou null se sair antes. */
export function jogarComoLicao(l, dia, periodo) {
  return new Promise((resolver) => {
    licaoPendente = { l, dia, periodo, resolver, resumo: null };
    // ids antigos (dias montados antes da junção) caem no jogo juntado com o mesmo conteúdo
    const { jogo, modo } = jogoAtual(l.jogo, l.modo), esc = J().escolhas;
    const iniciar = {
      mira: () => jogarMira({ vista: "tudo", quantas: 3 }),
      dose: () => jogarDose(modo || esc.dose || "malamed"),
      detetive: () => jogarDetetive(modo || esc.detetive || "pato"),
      memoria: () => jogarMemoria(modo || esc.memoria || "glos"),
      blitz: () => jogarBlitz(),
      consulta: () => jogarConsulta({ quantas: 3 }),
      laminas: () => jogarLaminas({ quantas: 6 }),
      galeria: () => jogarGaleria({ quantas: 6 }),
      receita: () => jogarReceita(modo || undefined),
      pratica: () => jogarPratica({ quantas: 2 }),
    }[jogo] || (() => jogarBlitz());
    iniciar();
  });
}
function concluirLicaoJogo(cam, pontos) {
  const L = cam.licao; if (!L || L.resumo) return null;
  const xp = Math.round(15 * multiplicadorAtual());
  L.resumo = { xp, acertos: 0, total: 0, perfeita: false, maiorCombo: 0, minutos: 0, periodo: L.periodo, jogo: L.l.jogo, pontos };
  const r = concluirLicao(L.l.id, L.resumo);
  return { ...r, xp, bau: verificarBauDoDia(L.dia) || verificarBauBonus(L.dia) };
}
function rodapeLicao(cam, rec) {
  const rod = document.createElement("div"); rod.className = "jogo-rodape";
  const b = document.createElement("button"); b.className = "botao"; b.textContent = "Continuar";
  const ofensiva = () => {
    const o = E().ofensiva; tocar("ofensiva");
    cam.corpo.innerHTML = `<div class="fim"><svg class="chama" viewBox="0 0 24 24"><path fill="#FF7A1A" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-1-3 0-6 1-9.5z"/><path fill="#FFC24B" d="M12 11c.5 2 2.5 3 2.5 5a2.5 2.5 0 0 1-5 0c0-1.2.6-2 1.2-2.6.1 1 .6 1.5 1 1.5-.4-1.5 0-2.8.3-3.9z"/></svg>
      <div class="ofensiva-grande">${o.atual}</div><h1 style="color:var(--fogo)">${o.atual === 1 ? "dia de ofensiva!" : "dias de ofensiva!"}</h1>
      <p class="sub">${o.atual % 7 === 0 ? "Você ganhou um congelamento de ofensiva." : "Volte amanhã para manter a chama acesa."}</p></div>`;
    cam.corpo.append(rod); b.onclick = () => cam.fechar();
  };
  b.onclick = () => {
    if (rec?.bau) { tocar("bau"); confete(); cam.corpo.innerHTML = htmlBauGanho(rec.bau, rec.bau.aba ? `Baú bônus: ${ABAS_BONUS[rec.bau.aba]} completa!` : undefined); cam.corpo.append(rod); b.onclick = () => (rec.novoDia ? ofensiva() : cam.fechar()); return; }
    if (rec?.novoDia) return ofensiva();
    cam.fechar();
  };
  rod.append(b);
  return rod;
}



// ---------------- camada do jogo ----------------
export function abrirCamada(titulo, { aoFechar = () => telaJogos(), musica = "jogos" } = {}) {
  document.activeElement?.blur?.();
  musicaCamada(musica);
  const c = document.createElement("div"); c.className = "jogo-camada";
  c.innerHTML = `<div class="jogo-topo"><button class="fechar" aria-label="Sair"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button><b>${escapar(titulo)}</b><span class="jogo-info"></span></div><div class="jogo-corpo"></div>`;
  document.body.append(c);
  const licao = licaoPendente; licaoPendente = null;
  if (licao) c.classList.add("modo-licao");
  const api = {
    raiz: c, corpo: c.querySelector(".jogo-corpo"), info: c.querySelector(".jogo-info"), saiu: false, licao,
    fechar() { api.saiu = true; c.remove(); musicaCamada(null); if (licao) licao.resolver(licao.resumo); else aoFechar(); aoMudar(); },
  };
  c.querySelector(".fechar").onclick = async () => {
    api.pausado = true;
    const ok = api.licao?.resumo ? true : await modal({ titulo: "Sair do jogo?", texto: api.licao ? "A lição só conta quando o jogo termina." : "A partida em andamento não vale pontos.", botoes: [{ texto: "Continuar jogando", valor: false }, { texto: "Sair", classe: "secundario", valor: true }] });
    api.pausado = false;
    if (ok) api.fechar();
  };
  return api;
}

/** Fim de partida: aplica o teto do dia, recorde, títulos e moeda do evento. */
export function terminar(cam, jogo, pontos, { xp, moedas }, resumoHtml = "", rotuloPontos = "pontos") {
  const j = J(), ev = eventoAtivo();
  const xpOk = Math.max(0, Math.min(xp, TETO.xp - j.xp)), mOk = Math.max(0, Math.min(moedas, TETO.moedas - j.moedas));
  j.xp += xpOk; j.moedas += mOk; j.partidas++;
  const recordeAntes = j.recordes[jogo];
  const novoRecorde = recordeAntes == null || pontos > recordeAntes;
  if (novoRecorde) j.recordes[jogo] = pontos;
  const xpReal = xpOk || mOk ? ganhar(xpOk, mOk, `Minijogo: ${nomeJogo(jogo)}`, "jogo") : 0;
  contar("jogos");
  const moedaEv = creditarEvento("jogo");
  salvar();
  tocar("fim"); if (novoRecorde && recordeAntes != null) confete();
  cam.info.textContent = "";
  cam.raiz.querySelector(".calc")?.remove(); cam.raiz.classList.remove("com-calc"); cam.corpo.scrollTop = 0;
  cam.corpo.innerHTML = `<div class="fim jogo-fim">${moli(pontos > 0 ? "uau" : "feliz", { classe: "mascote-grande" })}
    <h1>${novoRecorde && recordeAntes != null ? "Novo recorde!" : "Fim de jogo!"}</h1>
    <div class="placar"><div class="p-xp">${rotuloPontos}<b>${typeof pontos === "number" ? pontos.toLocaleString("pt-BR") : pontos}</b></div><div class="p-ac">XP<b>+${xpReal}</b></div><div class="p-t">Moedas<b>+${mOk}</b></div></div>
    <p class="sub">${xpOk < xp || mOk < moedas ? "Você bateu o teto de recompensas dos jogos de hoje, mas o treino continua valendo. " : ""}${recordeAntes != null && !novoRecorde ? `Recorde: ${recordeAntes}. ` : ""}${moedaEv ? `${escapar(ev.nome)}: +${moedaEv} ${icone(ev.moeda.icone, "ico-inline")}` : ""}</p>
    ${resumoHtml}</div>`;
  if (cam.licao) {
    const rec = concluirLicaoJogo(cam, pontos);
    cam.corpo.querySelector("h1").insertAdjacentHTML("beforebegin", `<div class="selo-licao">${icone("✅", "ico-inline")} Lição da trilha concluída</div>`);
    cam.corpo.querySelector(".placar").insertAdjacentHTML("afterend", `<p class="sub selo-licao-sub">Lição: +${rec?.xp ?? 0} XP e +${rec?.moedas ?? 0} moedas${rec?.bauMeta ? " (inclui o bônus da meta do dia)" : ""}.</p>`);
    cam.corpo.append(rodapeLicao(cam, rec));
    window.dispatchEvent(new Event("oq-titulos"));
    return;
  }
  const rod = document.createElement("div"); rod.className = "jogo-rodape";
  const b1 = document.createElement("button"); b1.className = "botao"; b1.textContent = "Jogar de novo";
  const denovo = ultimoJogar || JOGOS.find(x => x.id === jogoAtual(jogo).jogo)?.jogar;
  b1.onclick = () => { cam.raiz.remove(); denovo?.(); };
  const b2 = document.createElement("button"); b2.className = "botao secundario"; b2.textContent = "Sair";
  b2.onclick = () => cam.fechar();
  rod.append(b1, b2); cam.corpo.append(rod);
  window.dispatchEvent(new Event("oq-titulos"));
}

const ehRapida = (e) => (e.tipo === "vf" && e.afirmacao) || (e.tipo === "multipla" && e.opcoes?.length >= 2);

/**
 * As perguntas das Aventuras (pedido do Alediov, 04/11/2026): de preferência do que cai na PRÓXIMA prova, pelo
 * `recorte` das avaliações da Agenda (prefixos dos ids das questões, como no Raio X). Vale a prova mais próxima com
 * pelo menos `min` questões rápidas (V/F ou múltipla) já baixadas; sem nenhuma, todas as trilhas.
 * Devolve { pool, prova (a avaliação ou null), recorte, total }.
 */
export async function perguntasDaProva(min = 12) {
  const banco = await bancoJogos(), hoje = hojeISO();
  const todas = [...banco.entries()].filter(([, e]) => ehRapida(e));
  const provas = (E().avaliacoes || []).filter(a => a.recorte?.length && a.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  for (const av of provas) {
    const pool = todas.filter(([id]) => av.recorte.some(p => String(id).startsWith(p))).map(([, e]) => e);
    if (pool.length >= min) return { pool: embaralhar(pool), prova: av, recorte: av.recorte, total: pool.length };
  }
  return { pool: embaralhar(todas.map(([, e]) => e)), prova: null, recorte: null, total: todas.length };
}
/** Faixa "Perguntas da prova de …" para a introdução das Aventuras. */
export function faixaProva(fp) {
  if (!fp?.prova) return `<div class="jg-prova">${icone("📚", "ico-inline")}<span>Perguntas de <b>todas as trilhas</b>: nenhuma prova próxima com questões baixadas.</span></div>`;
  const a = fp.prova, dd = Math.round((new Date(a.data + "T12:00") - new Date(hojeISO() + "T12:00")) / 864e5);
  return `<div class="jg-prova">${icone("🎯", "ico-inline")}<span>Perguntas da próxima prova: <b>${escapar(a.disciplina || a.titulo || "")}</b> (${dd === 0 ? "hoje" : dd === 1 ? "amanhã" : `em ${dd} dias`}) · ${fp.total} questões</span></div>`;
}

/** Pergunta relâmpago (V/F ou múltipla do banco) por cima do jogo. Resolve true se acertou. Com `pool` (as da
 * próxima prova, `perguntasDaProva`), as perguntas saem dele em sequência, sem repetir até dar a volta. */
let poolRapido = null;
export async function perguntaRapida(cam, titulo = "Pergunta relâmpago", pool = null) {
  if (!pool && !poolRapido) poolRapido = [...(await bancoJogos()).values()].filter(ehRapida);
  const lista = pool?.length ? pool : poolRapido;
  if (!lista?.length) return true;
  let ex;
  if (pool?.length) { pool._i = ((pool._i ?? -1) + 1) % pool.length; ex = pool[pool._i]; } else ex = sorteia(lista);
  const t0 = Date.now();
  return new Promise((ok) => {
    const ov = document.createElement("div"); ov.className = "pergunta-rapida";
    ov.innerHTML = `<div class="pr-caixa"><small>${escapar(titulo)}</small><div class="enunciado"></div><div class="opcoes"></div><div class="pr-fb"></div></div>`;
    ov.querySelector(".enunciado").textContent = ex.tipo === "vf" ? ex.afirmacao : ex.enunciado;
    const box = ov.querySelector(".opcoes"), fb = ov.querySelector(".pr-fb");
    const ops = ex.tipo === "vf" ? [[true, "Verdadeiro"], [false, "Falso"]] : embaralhar(ex.opcoes.map((t, i) => [i, t]));
    for (const [v, txt] of ops) {
      const b = document.createElement("button"); b.className = "opcao"; b.textContent = txt;
      b.onclick = () => {
        const certo = v === ex.correta;
        registrarResposta(ex, "jogo-rapida", certo, 1, Date.now() - t0);
        box.querySelectorAll("button").forEach(x => { x.disabled = true; if ((ex.tipo === "vf" ? x.textContent === (ex.correta ? "Verdadeiro" : "Falso") : x.textContent === ex.opcoes[ex.correta])) x.classList.add("correta"); });
        if (!certo) b.classList.add("incorreta");
        tocar(certo ? "certo" : "errado");
        fb.innerHTML = `<p class="${certo ? "ok" : "erro"}">${certo ? "Isso!" : "Não foi."} ${escapar(ex.explicacao || "")}</p>`;
        const nx = document.createElement("button"); nx.className = "botao"; nx.textContent = "Voltar ao jogo";
        nx.onclick = () => { ov.remove(); ok(certo); };
        fb.append(nx);
      };
      box.append(b);
    }
    cam.raiz.append(ov);
  });
}

/**
 * Escolha do conteúdo de um jogo juntado (Memória, Detetive, Dose Máxima), dentro da camada já aberta. A última
 * escolha fica marcada e guardada em `jogos.escolhas[chave]`; o "Jogar de novo" repete o mesmo conteúdo.
 * opcoes: [{ id, nome, desc, icone }]; aoEscolher(id) segue o jogo na mesma camada.
 */
function escolherConteudo(cam, { chave, titulo, sub, cor = "#8A4FE0", icone: ic, opcoes, aoEscolher, deNovo }) {
  const ult = J().escolhas[chave];
  cam.info.textContent = ""; cam.corpo.scrollTop = 0;
  cam.corpo.innerHTML = `<div class="jg-escolha lam">
    <div class="lam-cab"><div class="lam-cont" style="background:${cor}">${icone(ic, "ico3d ico-medio")}</div><div><h2>${escapar(titulo)}</h2><small>${escapar(sub)}</small></div></div>
    <div class="lam-modos">${opcoes.map(o => `<button class="lam-modo ${o.id === ult ? "ultima" : ""}" data-m="${o.id}">${icone(o.icone, "ico3d")}<b>${escapar(o.nome)}${o.id === ult ? "<em>última</em>" : ""}</b><small>${escapar(o.desc)}</small></button>`).join("")}</div></div>`;
  cam.corpo.querySelectorAll(".lam-modo").forEach(b => (b.onclick = () => {
    const m = b.dataset.m; tocar("toque");
    J().escolhas[chave] = m; salvar();
    ultimoJogar = () => deNovo(m);
    aoEscolher(m);
  }));
}

export function semConteudo(cam, msg) {
  cam.corpo.innerHTML = `<div class="vazio">${moli("neutro")}<h2>Ainda não dá para jogar</h2><p>${msg}</p></div>`;
  if (cam.licao) {
    const b = document.createElement("button"); b.className = "botao"; b.textContent = "Concluir a lição mesmo assim";
    b.onclick = () => { const rec = concluirLicaoJogo(cam, 0); toast(`Lição concluída: +${rec?.xp ?? 0} XP`); b.replaceWith(rodapeLicao(cam, rec)); };
    cam.corpo.querySelector(".vazio").append(b);
  }
}

// ---------------- Blitz 60s ----------------
async function jogarBlitz() {
  const cam = abrirCamada("Blitz de 60 Segundos");
  const banco = await bancoJogos();
  const pool = embaralhar([...banco.values()].filter(e => (e.tipo === "vf" && e.afirmacao) || (e.tipo === "multipla" && e.opcoes?.length >= 2)));
  if (pool.length < 6) return semConteudo(cam, "O Blitz usa as questões de verdadeiro/falso e múltipla escolha que você já baixou. Faça algumas lições primeiro.");
  let pontos = 0, combo = 0, acertos = 0, total = 0, idx = 0, fim = Date.now() + 60000, acabou = false;
  const erros = [];
  cam.corpo.innerHTML = `<div class="blitz"><div class="blitz-tempo"><div></div></div><div class="blitz-placar"><b class="pts">0</b><span class="mult"></span></div><div class="blitz-q"></div></div>`;
  const barra = cam.corpo.querySelector(".blitz-tempo div"), elPts = cam.corpo.querySelector(".pts"), elMult = cam.corpo.querySelector(".mult"), q = cam.corpo.querySelector(".blitz-q");
  const mult = () => Math.min(4, 1 + Math.floor(combo / 3));
  function tick() {
    if (cam.saiu || acabou) return;
    const rest = fim - Date.now();
    barra.style.width = `${Math.max(0, rest / 600)}%`;
    barra.classList.toggle("pouco", rest < 10000);
    cam.info.textContent = `${Math.max(0, Math.ceil(rest / 1000))}s`;
    if (rest <= 0) return encerrar();
    requestAnimationFrame(tick);
  }
  function mostrar() {
    const ex = pool[idx++ % pool.length], t0 = Date.now();
    q.innerHTML = "";
    const enun = document.createElement("div"); enun.className = "enunciado"; enun.textContent = ex.tipo === "vf" ? ex.afirmacao : ex.enunciado;
    const box = document.createElement("div"); box.className = "opcoes blitz-opcoes";
    const ops = ex.tipo === "vf" ? [[true, "Verdadeiro"], [false, "Falso"]] : embaralhar(ex.opcoes.map((t, i) => [i, t]));
    for (const [v, txt] of ops) {
      const b = document.createElement("button"); b.className = "opcao"; b.textContent = txt;
      b.onclick = () => {
        if (acabou) return;
        const certo = v === ex.correta;
        total++;
        registrarResposta(ex, "jogo-blitz", certo, 1, Date.now() - t0);
        if (certo) { acertos++; combo++; pontos += 10 * mult(); tocar(combo % 3 === 0 ? "combo" : "certo"); b.classList.add("correta"); }
        else {
          combo = 0; fim -= 3000; tocar("errado"); vibrar(40); b.classList.add("incorreta");
          erros.push({ txt: ex.tipo === "vf" ? ex.afirmacao : ex.enunciado, certa: ex.tipo === "vf" ? (ex.correta ? "Verdadeiro" : "Falso") : ex.opcoes[ex.correta] });
          q.classList.remove("treme"); void q.offsetWidth; q.classList.add("treme");
        }
        elPts.textContent = pontos; elMult.textContent = mult() > 1 ? `×${mult()}` : "";
        box.querySelectorAll("button").forEach(x => (x.disabled = true));
        setTimeout(() => { if (!acabou && !cam.saiu) mostrar(); }, certo ? 260 : 650);
      };
      box.append(b);
    }
    q.append(enun, box);
  }
  function encerrar() {
    acabou = true;
    const lista = erros.slice(0, 8).map(e => `<li>${escapar(e.txt)}<br><b>${escapar(e.certa)}</b></li>`).join("");
    terminar(cam, "blitz", pontos, { xp: Math.min(25, Math.round(pontos / 10)), moedas: Math.min(12, Math.floor(pontos / 40)) },
      `<p class="sub">${acertos} de ${total} certas.</p>${lista ? `<div class="cartao revisao-jogo"><b>Para revisar</b><ul>${lista}</ul></div>` : ""}`);
  }
  mostrar(); tick();
}

// ---------------- Memória ----------------
// Um jogo só (04/11/2026) com três conteúdos: Patologia (glossário do Neville), Estomatologia (glossário do Burket) e
// os conceitos dos exercícios de ligar das trilhas. Sem `modo`, a camada abre na escolha.
const CONTEUDOS_MEMORIA = [
  { id: "glos", nome: "Patologia", desc: "Neville · inglês ↔ português", icone: "🔬" },
  { id: "glos-burket", nome: "Estomatologia", desc: "Burket · inglês ↔ português", icone: "🩺" },
  { id: "pares", nome: "Conceitos das trilhas", desc: "Conceito ↔ definição dos exercícios de ligar das lições", icone: "🧩" },
];
async function jogarMemoria(modo = null) {
  const cam = abrirCamada("Memória");
  const comecar = async (m) => {
    cam.corpo.innerHTML = `<p class="sub" style="text-align:center">Embaralhando as cartas…</p>`;
    const banco = await bancoJogos(), glos = m.startsWith("glos") ? await extra(m === "glos-burket" ? "jogo:glossario-estomato" : "jogo:glossario") : null;
    if (!cam.saiu) partidaMemoria(cam, m, banco, glos);
  };
  if (modo || cam.licao) return comecar(modo || J().escolhas.memoria || "glos");
  escolherConteudo(cam, { chave: "memoria", titulo: "Memória", sub: "Escolha o conteúdo dos pares", cor: "#8A4FE0", icone: "🃏", opcoes: CONTEUDOS_MEMORIA, aoEscolher: comecar, deNovo: (m) => jogarMemoria(m) });
}

function paresDoModo(modo, banco, glos) {
  let lista = [];
  if (modo === "pares") for (const e of banco.values()) if (e.tipo === "pares") for (const [a, b] of e.pares || []) lista.push([a, b]);
  if (modo.startsWith("glos") && glos) lista = Object.entries(glos).filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.toLowerCase() !== k.toLowerCase() && k.length <= 34 && v.length <= 40);
  const usados = new Set(), out = [];
  for (const [a, b] of embaralhar(lista)) {
    if (usados.has(a) || usados.has(b)) continue;
    usados.add(a); usados.add(b); out.push([a, b]);
    if (out.length === 6) break;
  }
  return out;
}

function partidaMemoria(cam, modo, banco, glos) {
  const pares = paresDoModo(modo, banco, glos);
  if (pares.length < 6) return semConteudo(cam, modo.startsWith("glos") ? "O glossário ainda não chegou. Sincronize com internet." : "Ainda há poucos exercícios de ligar pares baixados. Faça mais lições ou escolha o glossário da Patologia.");
  const cartas = embaralhar(pares.flatMap(([a, b], i) => [{ txt: a, par: i, lado: 0 }, { txt: b, par: i, lado: 1 }]));
  let abertas = [], achados = 0, jogadas = 0, travado = false;
  let inicio = Date.now();
  cam.corpo.innerHTML = `<p class="sub" style="text-align:center">Você tem 5 segundos para memorizar. Depois, vire duas cartas por vez e ache os pares.</p><div class="memoria"></div>`;
  const g = cam.corpo.querySelector(".memoria");
  cam.info.textContent = "0 jogadas";
  cartas.forEach((c) => {
    const b = document.createElement("button"); b.className = `mem-carta lado${c.lado}`; b.dataset.par = c.par;
    b.innerHTML = `<div class="mem-frente">${escapar(c.txt)}</div><div class="mem-verso">${icone("🌟", "ico3d")}</div>`;
    b.onclick = () => {
      if (travado || b.classList.contains("virada")) return;
      b.classList.add("virada"); tocar("toque"); abertas.push({ b, c });
      if (abertas.length < 2) return;
      jogadas++; cam.info.textContent = `${jogadas} jogada${jogadas > 1 ? "s" : ""}`;
      const [x, y] = abertas; abertas = [];
      if (x.c.par === y.c.par) {
        achados++; tocar("par"); x.b.classList.add("achada"); y.b.classList.add("achada");
        if (achados === pares.length) setTimeout(fim, 600);
      } else {
        travado = true; vibrar(20);
        setTimeout(() => { x.b.classList.remove("virada"); y.b.classList.remove("virada"); travado = false; }, 950);
      }
    };
    g.append(b);
  });
  // 5 segundos para memorizar, com todas as cartas viradas para cima
  travado = true;
  const todas = [...g.querySelectorAll(".mem-carta")];
  todas.forEach(b => b.classList.add("virada"));
  let falta = 5;
  cam.info.textContent = `Memorize: ${falta}s`;
  const rel = setInterval(() => {
    falta--;
    if (cam.saiu) return clearInterval(rel);
    if (falta > 0) { cam.info.textContent = `Memorize: ${falta}s`; return; }
    clearInterval(rel);
    todas.forEach(b => b.classList.remove("virada"));
    travado = false; inicio = Date.now(); cam.info.textContent = "0 jogadas"; tocar("toque");
  }, 1000);
  function fim() {
    const seg = Math.round((Date.now() - inicio) / 1000);
    const estrelas = jogadas <= 9 ? 3 : jogadas <= 13 ? 2 : 1;
    const pontos = Math.max(10, 300 - jogadas * 10 - seg);
    const lista = pares.map(([a, b]) => `<li>${escapar(a)} <b>↔ ${escapar(b)}</b></li>`).join("");
    terminar(cam, "memoria", pontos, { xp: [0, 8, 12, 16][estrelas], moedas: [0, 3, 5, 8][estrelas] },
      `<p class="estrelas">${"★".repeat(estrelas)}${"☆".repeat(3 - estrelas)}</p><p class="sub">${jogadas} jogadas em ${seg}s.</p><div class="cartao revisao-jogo"><b>Os pares</b><ul>${lista}</ul></div>`);
  }
}

// ---------------- Dose máxima ----------------
const fmtMg = (n) => `${num(Math.round(n), 0)} mg`;
const tub = (n) => num(Math.floor(n * 10 + 1e-9) / 10);
const fmtTub = (n) => `${tub(n)} tubetes`;
function dmr(f, kg) {
  if (f.mgKg == null) return { mg: f.maxMg, conta: `Sem dose por kg (FDA): teto de ${f.maxMg} mg` };
  const bruto = kg * f.mgKg;
  if (f.maxMg != null && bruto > f.maxMg) return { mg: f.maxMg, conta: `${kg} kg × ${num(f.mgKg)} mg/kg = ${num(bruto, 0)} mg, mas o teto é ${f.maxMg} mg` };
  return { mg: bruto, conta: `${kg} kg × ${num(f.mgKg)} mg/kg = ${num(bruto, 0)} mg` };
}
function opcoesNum(certo, distratores, fmt) {
  const vistos = new Set([fmt(certo)]), out = [fmt(certo)];
  for (const d of distratores) { if (!(d > 0) || out.length >= 4) continue; const s = fmt(d); if (!vistos.has(s)) { vistos.add(s); out.push(s); } }
  let k = 1.35;
  while (out.length < 4) { const s = fmt(certo * k); if (!vistos.has(s)) { vistos.add(s); out.push(s); } k += 0.27; }
  return { certa: fmt(certo), opcoes: embaralhar(out) };
}

// Crianças (Andrade): peso estimado, gotas por kg e volume de suspensão de amoxicilina.
const nn = (x) => num(x, Number.isInteger(x) ? 0 : 1);
const fmtKg = (n) => `${num(Math.round(n), 0)} kg`;
const fmtGotas = (n) => `${num(Math.floor(n), 0)} gotas`;
const fmtMl = (n) => `${nn(Math.round(n * 10) / 10)} mL`;
function perguntasCriancas(C) {
  const P = [], kgDe = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  { // peso pela idade
    const idade = kgDe(3, 10), kg = idade * 2 + 9;
    P.push({ caso: `Criança de ${idade} anos, biótipo normal. Não há balança no consultório.`, pergunta: "Qual é o peso aproximado?", ...opcoesNum(kg, [idade * 2, idade * 3 + 9, idade + 9], fmtKg),
      explic: `Peso ≈ (idade × 2) + 9 = (${idade} × 2) + 9 = ${kg} kg (Quadro 14.4).` });
  }
  for (const g of embaralhar(C.gotas).slice(0, 3)) { // gotas por kg
    const kg = kgDe(12, 34), n = Math.floor(kg * g.gotaKg);
    P.push({ caso: `Criança de ${kg} kg. ${g.nome}, ${g.gotaKg === 0.5 ? "½ gota" : "1 gota"} por kg, ${g.intervalo}.`, pergunta: "Quantas gotas por dose?", ...opcoesNum(n, [kg * (g.gotaKg === 1 ? 0.5 : 1), kg * 2, n + 5], fmtGotas),
      explic: `${kg} kg × ${g.gotaKg === 0.5 ? "½" : "1"} gota/kg = ${nn(kg * g.gotaKg)} → ${n} gotas.${g.obs ? " " + g.obs : ""}` });
    if (g.mgGota) {
      P.push({ caso: `Criança de ${kg} kg, ${n} gotas de ${g.curto}.`, pergunta: "Quantos mg há nessa dose?", ...opcoesNum(n * g.mgGota, [n * g.mgGota * 2, n * g.mgGota / 2, n * 10], fmtMg),
        explic: `${n} gotas × ${nn(g.mgGota)} mg por gota = ${num(n * g.mgGota, 0)} mg.${g.obs ? " " + g.obs : ""}` });
    }
  }
  const A = C.amoxicilina;
  for (let k = 0; k < 2; k++) { // ataque e manutenção em mL
    const kg = sorteia([15, 20, 25, 30]), susp = sorteia(A.suspensoes), mgMl = susp / 5;
    const ataque = k === 0, mgKg = ataque ? A.ataque[1] : A.manutencao[1], mg = kg * mgKg, ml = mg / mgMl;
    P.push({ caso: `Criança de ${kg} kg com infecção. Amoxicilina suspensão oral ${susp} mg/5 mL. ${ataque ? `Dose de ataque: ${mgKg} mg/kg, antes da anestesia.` : `Manutenção: ${mgKg} mg/kg ${A.intervalo}.`}`,
      pergunta: `Quantos mL ${ataque ? "na dose de ataque" : "em cada dose"}?`, ...opcoesNum(ml, [mg / susp, ml * 2, mg / (mgMl * 2)], fmtMl),
      explic: `${kg} kg × ${mgKg} mg/kg = ${mg} mg. A suspensão de ${susp} mg/5 mL tem ${nn(mgMl)} mg/mL: ${mg} ÷ ${nn(mgMl)} = ${nn(Math.round(ml * 10) / 10)} mL.` });
  }
  return P;
}

// Perguntas de dose máxima de um livro (Malamed: jogo:doses; Andrade: jogo:doses-andrade): `n` pacientes com a dose
// em mg e em tubetes e, com `dois`, o caso dos dois anestésicos (Quadro 4.3). Cada pergunta leva o `livro`.
function perguntasDose(D, livro, n = 4, dois = true) {
  const perguntas = [];
  for (let i = 0; i < n; i++) {
    const p = sorteia(D.pacientes), kg = p.kg[0] + Math.floor(Math.random() * (p.kg[1] - p.kg[0] + 1));
    const f = sorteia(D.farmacos.filter(x => kg >= 40 || x.id !== "bupi"));
    const d = dmr(f, kg), outro = sorteia(D.farmacos.filter(x => x.mgKg && x.mgKg !== f.mgKg)) || f;
    const caso = `${p.desc}, ${kg} kg. Anestésico: ${f.nome}.`;
    const o1 = opcoesNum(d.mg, [f.mgKg && f.maxMg != null && kg * f.mgKg > f.maxMg ? kg * f.mgKg : null, outro.mgKg ? kg * outro.mgKg : null, f.mgKg ? kg * f.mgKg / 2.2 : null], fmtMg);
    perguntas.push({ livro, caso, pergunta: "Qual é a dose máxima recomendada?", ...o1, explic: `${d.conta}.${f.nota ? " " + f.nota : ""}` });
    const nt = d.mg / f.mgTubete;
    const o2 = opcoesNum(nt, [d.mg / (f.mgTubete / 1.8), d.mg / (f.mgTubete * 2), d.mg / (f.mgTubete === 36 ? 72 : 36)], fmtTub);
    perguntas.push({ livro, caso, pergunta: `E quantos tubetes, no máximo? (${f.curto} = ${f.mgTubete} mg por tubete de 1,8 mL)`, ...o2, explic: `${fmtMg(d.mg)} ÷ ${f.mgTubete} mg = ${tub(nt)} tubetes (arredondando para baixo).` });
  }
  if (dois) { // caso com dois anestésicos (Quadro 4.3)
    const kg = 45 + Math.floor(Math.random() * 30);
    const A = sorteia(D.farmacos.filter(x => x.mgKg)), B = sorteia(D.farmacos.filter(x => x.mgKg && x.id.slice(0, 4) !== A.id.slice(0, 4)));
    const dA = dmr(A, kg).mg, dB = dmr(B, kg).mg, menor = Math.min(dA, dB), dados = 2, jaMg = dados * A.mgTubete;
    const resto = (menor - jaMg) / B.mgTubete;
    const o = opcoesNum(resto, [dB / B.mgTubete, (Math.max(dA, dB) - jaMg) / B.mgTubete, (menor - jaMg) / A.mgTubete], fmtTub);
    perguntas.push({ livro, caso: `Adulto saudável, ${kg} kg. Recebeu ${dados} tubetes de ${A.curto} (${jaMg} mg), mas a anestesia não pegou. O dentista vai trocar para ${B.curto}.`, pergunta: `Quantos tubetes de ${B.curto} ainda pode receber?`, ...o,
      explic: `As doses máximas são ${fmtMg(dA)} (${A.curto}) e ${fmtMg(dB)} (${B.curto}). Vale a MENOR, ${fmtMg(menor)}. Menos ${jaMg} mg já dados = ${fmtMg(menor - jaMg)} ÷ ${B.mgTubete} mg = ${tub(resto)} tubetes.` });
  }
  return perguntas;
}

// Dose Máxima juntada (04/11/2026): Malamed, Andrade ou os dois misturados; sem `modo`, a camada abre na escolha.
// `jogarDose("criancas")` continua sendo a Dose Pediátrica (gotas e suspensões do Andrade), que saiu da lista de jogos e
// é aberta de dentro do Receituário.
const CONTEUDOS_DOSE = [
  { id: "malamed", nome: "Malamed", desc: "Manual de Anestesia Local · cap. 4", icone: "💉" },
  { id: "andrade", nome: "Andrade", desc: "Terapêutica Medicamentosa · anestésicos locais", icone: "💊" },
  { id: "ambos", nome: "Os dois misturados", desc: "Casos dos dois livros na mesma partida", icone: "🔀" },
];
export async function jogarDose(modo = null) {
  const cam = abrirCamada(modo === "criancas" ? "Dose Pediátrica" : "Dose Máxima");
  if (!modo && !cam.licao) return escolherConteudo(cam, { chave: "dose", titulo: "Dose Máxima", sub: "Escolha o livro das tabelas", cor: "#2F6BFF", icone: "🧮", opcoes: CONTEUDOS_DOSE, aoEscolher: (m) => partidaDose(cam, m), deNovo: (m) => jogarDose(m) });
  partidaDose(cam, modo || J().escolhas.dose || "malamed");
}
async function partidaDose(cam, modo) {
  cam.corpo.innerHTML = `<p class="sub" style="text-align:center">Preparando os pacientes…</p>`;
  const livros = modo === "ambos" ? ["malamed", "andrade"] : modo === "criancas" ? ["andrade"] : [modo === "andrade" ? "andrade" : "malamed"];
  const dados = {};
  for (const l of livros) dados[l] = await extra(l === "malamed" ? "jogo:doses" : "jogo:doses-andrade");
  if (cam.saiu) return;
  if (livros.some(l => !dados[l])) return semConteudo(cam, "Os dados do jogo ainda não chegaram. Sincronize com internet.");
  const NOME = { malamed: "Malamed", andrade: "Andrade" };
  let perguntas;
  if (modo === "criancas") perguntas = perguntasCriancas(dados.andrade.criancas);
  else if (modo === "ambos") {
    // 2 pacientes de cada livro e o caso dos dois anestésicos de um deles, misturados
    const dois = sorteia(livros);
    perguntas = [...perguntasDose(dados.malamed, "malamed", 2, dois === "malamed"), ...perguntasDose(dados.andrade, "andrade", 2, dois === "andrade")];
    // embaralha por caso, mantendo juntas a pergunta da dose em mg e a dos tubetes do mesmo paciente
    const grupos = []; for (const q of perguntas) { const g = grupos.at(-1); if (g && g[0].caso === q.caso && g[0].livro === q.livro) g.push(q); else grupos.push([q]); }
    perguntas = embaralhar(grupos).flat();
  } else perguntas = perguntasDose(dados[livros[0]], livros[0]);
  let i = 0, acertos = 0;
  calculadora(cam, modo);
  function mostrar() {
    const p = perguntas[i];
    cam.info.textContent = `${i + 1}/${perguntas.length}`;
    cam.corpo.innerHTML = `<div class="dose"><div class="contexto">${modo === "ambos" ? `<b>${NOME[p.livro]}</b> · ` : ""}${escapar(p.caso)}</div><div class="enunciado">${escapar(p.pergunta)}</div><div class="opcoes"></div><div class="dose-feedback"></div></div>`;
    const box = cam.corpo.querySelector(".opcoes"), fb = cam.corpo.querySelector(".dose-feedback");
    for (const op of p.opcoes) {
      const b = document.createElement("button"); b.className = "opcao"; b.textContent = op;
      b.onclick = () => {
        const certo = op === p.certa;
        if (certo) { acertos++; tocar("certo"); } else { tocar("errado"); vibrar(40); }
        box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === p.certa) x.classList.add("correta"); });
        if (!certo) b.classList.add("incorreta");
        fb.innerHTML = `<div class="feedback-mini ${certo ? "certo" : "errado"}"><b>${certo ? "Isso!" : `Era ${escapar(p.certa)}`}</b><p>${escapar(p.explic)}</p></div>`;
        const nx = document.createElement("button"); nx.className = "botao"; nx.textContent = i + 1 < perguntas.length ? "Próxima" : "Ver resultado";
        nx.onclick = () => { i++; i < perguntas.length ? mostrar() : fim(); };
        fb.append(nx);
        requestAnimationFrame(() => nx.scrollIntoView({ block: "center", behavior: "smooth" }));
      };
      box.append(b);
    }
  }
  function fim() {
    const lembretes = livros.map(l => `<div class="cartao revisao-jogo"><b>Lembrete do ${NOME[l]}</b><ul>${dados[l].regras.map(r => `<li>${escapar(r)}</li>`).join("")}</ul><small class="sub">${escapar(dados[l].fonte.texto)}</small></div>`).join("");
    terminar(cam, "dose", acertos, { xp: acertos * 2, moedas: acertos }, lembretes, "acertos");
  }
  mostrar();
}

// ---------------- calculadora (Dose máxima) ----------------
// a mesma das lições (ferramentasLicao.js: um operador depois de outro troca o anterior), com a aba do caderno do
// jogo (some no dia seguinte); `titulo` dá a chave do caderno
export function calculadora(cam, titulo = "dose") {
  const c = document.createElement("div"); c.className = "calc";
  c.innerHTML = `<div class="calc-topo"><div class="calc-abas"><button type="button" class="calc-aba on" data-t="calc">Calculadora</button><button type="button" class="calc-aba" data-t="caderno">Caderno</button></div><button class="link calc-min">esconder</button></div><div class="calc-corpo"></div>`;
  const corpo = c.querySelector(".calc-corpo"), mem = {};
  const abrir = (t) => {
    c.querySelectorAll(".calc-aba").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    if (t === "calc") montarCalculadora(corpo, mem); else montarCaderno(corpo, `${hojeISO()}|jogo:${titulo}`, "Fica guardado neste jogo até o fim do dia.");
    if (c.classList.contains("mini")) { c.classList.remove("mini"); c.querySelector(".calc-min").textContent = "esconder"; }
  };
  c.querySelectorAll(".calc-aba").forEach(b => b.onclick = () => { tocar("toque"); abrir(b.dataset.t); });
  abrir("calc");
  c.querySelector(".calc-min").onclick = () => { c.classList.toggle("mini"); c.querySelector(".calc-min").textContent = c.classList.contains("mini") ? "mostrar" : "esconder"; };
  cam.raiz.append(c); cam.raiz.classList.add("com-calc");
}

// ---------------- Detetive ----------------
// Um jogo só (04/11/2026): os casos do Neville (Patologia) e do Burket (Estomatologia), com o filtro na abertura.
// Ids antigos: "detetive" era o do Neville e "detetive-mucosa" o do Burket (os dois caem aqui pelo `JOGO_ANTIGO`).
const LIVRO_DETETIVE = { pato: "neville", estomato: "burket" };
export async function jogarDetetive(filtro = null) {
  const cam = abrirCamada("Detetive");
  if (filtro === "neville") filtro = "pato"; else if (filtro === "burket") filtro = "estomato";
  const D = await extra("jogo:detetive");
  if (cam.saiu) return;
  const todos = D?.casos || [], doLivro = (f) => todos.filter(c => f === "tudo" || (c.livro || "neville") === LIVRO_DETETIVE[f]);
  if (!todos.length) return semConteudo(cam, "Os casos ainda não chegaram. Sincronize com internet.");
  if (filtro || cam.licao) return partidaDetetive(cam, doLivro(filtro || J().escolhas.detetive || "pato"));
  escolherConteudo(cam, { chave: "detetive", titulo: "Detetive", sub: "Escolha de onde vêm os casos", cor: "#E8742A", icone: "🕵️",
    opcoes: [
      { id: "pato", nome: "Patologia", desc: `Neville · ${doLivro("pato").length} casos de cistos, ossos e tecidos moles`, icone: "🔬" },
      { id: "estomato", nome: "Estomatologia", desc: `Burket · ${doLivro("estomato").length} casos de úlceras, bolhas, lesões brancas, vermelhas e pigmentadas`, icone: "🩺" },
      { id: "tudo", nome: "Tudo", desc: `Os ${todos.length} casos misturados`, icone: "🔀" },
    ],
    aoEscolher: (f) => partidaDetetive(cam, doLivro(f)), deNovo: (f) => jogarDetetive(f) });
}
function partidaDetetive(cam, lista) {
  if (!lista.length) return semConteudo(cam, "Ainda não há casos deste livro. Sincronize com internet.");
  const casos = embaralhar(lista).slice(0, 5);
  let i = 0, total = 0;
  function caso() {
    const c = casos[i];
    let pistas = 1, erros = 0, resolvido = false;
    cam.info.textContent = `Caso ${i + 1}/${casos.length}`;
    cam.corpo.innerHTML = `<div class="detetive"><div class="det-cab">${icone("🕵️", "ico3d ico-medio")}<b>Qual é o diagnóstico?</b><span class="det-pts"></span></div><ol class="pistas"></ol><button class="link mais-pista">Mais uma pista (−25)</button><div class="opcoes"></div><div class="dose-feedback"></div></div>`;
    const ol = cam.corpo.querySelector(".pistas"), mais = cam.corpo.querySelector(".mais-pista"), box = cam.corpo.querySelector(".opcoes"), fb = cam.corpo.querySelector(".dose-feedback"), pts = cam.corpo.querySelector(".det-pts");
    const valor = () => Math.max(10, 100 - 25 * (pistas - 1) - 15 * erros);
    function render() {
      ol.innerHTML = c.pistas.slice(0, pistas).map((p, k) => `<li class="${k === pistas - 1 ? "nova" : ""}">${escapar(p)}</li>`).join("");
      mais.hidden = resolvido || pistas >= c.pistas.length;
      pts.textContent = resolvido ? "" : `vale ${valor()}`;
    }
    mais.onclick = () => { pistas++; tocar("toque"); render(); };
    for (const op of embaralhar(c.opcoes)) {
      const b = document.createElement("button"); b.className = "opcao"; b.textContent = op;
      b.onclick = () => {
        if (op === c.diagnostico) {
          const ganho = valor(); total += ganho; resolvido = true; tocar("combo");
          b.classList.add("correta"); box.querySelectorAll("button").forEach(x => (x.disabled = true));
          fechar(true, ganho);
        } else {
          erros++; b.classList.add("incorreta"); b.disabled = true; tocar("errado"); vibrar(40);
          if (erros >= 2) { resolvido = true; box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === c.diagnostico) x.classList.add("correta"); }); fechar(false, 0); }
          else if (pistas < c.pistas.length) pistas++;
        }
        render();
      };
      box.append(b);
    }
    function fechar(certo, ganho) {
      pistas = c.pistas.length; render();
      fb.innerHTML = `<div class="feedback-mini ${certo ? "certo" : "errado"}"><b>${certo ? `Acertou! +${ganho}` : `Era ${escapar(c.diagnostico)}`}</b><p>${escapar(c.explicacao)}</p><small>${c.livro === "burket" ? "Burket" : "Neville"}, cap. ${+c.fonte.unidade.slice(1, 3)}, p. ${c.fonte.pagina} do PDF</small></div>`;
      const nx = document.createElement("button"); nx.className = "botao"; nx.textContent = i + 1 < casos.length ? "Próximo caso" : "Ver resultado";
      nx.onclick = () => { i++; i < casos.length ? caso() : terminar(cam, "detetive", total, { xp: Math.round(total / 20), moedas: Math.round(total / 50) }); };
      fb.append(nx);
    }
    render();
  }
  caso();
}
