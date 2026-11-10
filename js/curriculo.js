// Currículo: atividades do Lattes e a pontuação estimada nos editais
// (residência em CTBMF, residência em Reabilitação Oral e mestrado PPGO).
// Os editais chegam como pacote de configuração (config/editais.json).
import { icone } from "./icones.js";
import { E, salvar, hojeISO, ganhar, marcarVidaSuja } from "./estado.js";
import { tocar } from "./sons.js";
import { modal, toast, formulario, escapar, dataBR } from "./ui.js";
import { guardarArquivo, pegarArquivo, apagarArquivo, enviarCurriculoAgora } from "./dados.js";

const uid = () => Math.random().toString(36).slice(2, 10);
const tela = () => document.getElementById("tela");
let aoMudar = () => {};
export function definirAoMudarCurriculo(fn) { aoMudar = fn; }

export const TIPOS = {
  curso: { nome: "Curso complementar", icone: "🎓", xp: 10, porHora: 2, max: 80, moedas: 5 },
  palestra: { nome: "Palestra ou webinário", icone: "🎤", xp: 25, moedas: 5 },
  evento: { nome: "Evento (congresso, jornada, oficina)", icone: "🏛️", xp: 35, moedas: 8 },
  monitoria: { nome: "Monitoria", icone: "🧑‍🏫", xp: 100, moedas: 25 },
  projeto_pesquisa: { nome: "Projeto de pesquisa / IC", icone: "🔬", xp: 120, moedas: 30 },
  projeto_extensao: { nome: "Projeto de extensão", icone: "🤝", xp: 120, moedas: 30 },
  liga: { nome: "Liga acadêmica", icone: "🦷", xp: 80, moedas: 20 },
  estagio: { nome: "Estágio extracurricular", icone: "🏥", xp: 100, moedas: 25 },
  apresentacao: { nome: "Apresentação de trabalho", icone: "📊", xp: 150, moedas: 40, gemas: 3 },
  publicacao: { nome: "Publicação (artigo ou resumo)", icone: "📄", xp: 300, moedas: 80, gemas: 5 },
  premio: { nome: "Prêmio ou menção honrosa", icone: "🏆", xp: 200, moedas: 50, gemas: 3 },
  lingua: { nome: "Língua estrangeira", icone: "🌎", xp: 100, moedas: 25 },
  organizacao: { nome: "Organização de evento", icone: "🎪", xp: 60, moedas: 15 },
  outro: { nome: "Outro", icone: "✳️", xp: 20, moedas: 5 },
};

// ---------- seções do Lattes ----------
// Onde a atividade vai no Lattes: Eventos (participação em eventos, congressos…) ou Formação complementar
// (a maioria, cursos de curta duração). `at.secao` vale quando o Alediov escolheu; senão, sai do tipo.
export const SECOES = {
  eventos: { nome: "Eventos", lattes: "Participação em eventos, congressos, exposições e feiras", icone: "🏛️" },
  formacao: { nome: "Formação complementar", lattes: "Formação complementar (curso de curta duração)", icone: "🎓" },
  outras: { nome: "Outras seções do Lattes", lattes: "Atuação, projetos, prêmios, idiomas…", icone: "📁" },
};
const SECAO_DO_TIPO = { evento: "eventos", palestra: "eventos", curso: "formacao" };
export const secaoDe = (at) => (at && SECOES[at.secao] ? at.secao : SECAO_DO_TIPO[at?.tipo] || "outras");
const palavras = (at) => (Array.isArray(at.palavrasChave) ? at.palavrasChave : String(at.palavrasChave || "").split(/\s*;\s*/)).filter(Boolean);

/** Contagens do currículo: por seção (quantas e horas), horas por tipo e total. */
export function contagens() {
  const cur = C(), por = { eventos: { n: 0, h: 0 }, formacao: { n: 0, h: 0 }, outras: { n: 0, h: 0 } }, tipos = {};
  let total = 0;
  for (const at of cur.atividades) {
    const h = Number(at.horas) || 0, sc = secaoDe(at);
    por[sc].n++; por[sc].h += h; total += h;
    const t = tipos[at.tipo] ||= { n: 0, h: 0 }; t.n++; t.h += h;
  }
  return { por, tipos, total, n: cur.atividades.length, certificados: certs().length };
}

// Metas de longo (bem longo) prazo
export const METAS = [
  { id: "eventos1000", icone: "🏛️", nome: "1.000 eventos", meta: 1000, valor: (c) => c.por.eventos.n },
  { id: "cursos500", icone: "🎓", nome: "500 cursos de formação complementar", meta: 500, valor: (c) => c.por.formacao.n },
  { id: "horas10000", icone: "⏳", nome: "10.000 horas de atividades", meta: 10000, valor: (c) => c.total, horas: true },
  { id: "horasEv1000", icone: "🎟️", nome: "1.000 horas só de eventos", meta: 1000, valor: (c) => c.por.eventos.h, horas: true },
  { id: "certs1000", icone: "📎", nome: "1.000 certificados anexados", meta: 1000, valor: (c) => c.certificados },
  { id: "apres100", icone: "📊", nome: "100 trabalhos apresentados", meta: 100, valor: (c) => c.tipos.apresentacao?.n || 0 },
  { id: "pub50", icone: "📄", nome: "50 publicações", meta: 50, valor: (c) => c.tipos.publicacao?.n || 0 },
  { id: "premios20", icone: "🏆", nome: "20 prêmios", meta: 20, valor: (c) => c.tipos.premio?.n || 0 },
  { id: "ano365", icone: "📅", nome: "Um evento por dia: 365 num mesmo ano", meta: 365, valor: () => maxEventosNumAno() },
];
function maxEventosNumAno() {
  const m = {};
  for (const at of C().atividades) if (secaoDe(at) === "eventos" && at.data) m[at.data.slice(0, 4)] = (m[at.data.slice(0, 4)] || 0) + 1;
  return Math.max(0, ...Object.values(m));
}

// vínculo sugerido de cada tipo em cada edital: [critério, opção]
const SUGESTOES = {
  palestra: { ctbmf: ["eventos", "outras"], ropd: ["eventos", "outras"] },
  evento: { ctbmf: ["eventos", "outras"], ropd: ["eventos", "outras"] },
  monitoria: { ctbmf: ["monitoria", "outras"], ropd: ["monitoria", "outras"], mestrado: ["monitoria", "sem"] },
  projeto_pesquisa: { ctbmf: ["projetos", "outras"], ropd: ["projetos", "outras"], mestrado: ["ic", "vol_sem"] },
  projeto_extensao: { ctbmf: ["projetos", "outras"], ropd: ["projetos", "outras"], mestrado: ["extensao", "un"] },
  liga: { ctbmf: ["projetos", "outras"], ropd: ["projetos", "outras"], mestrado: ["extensao", "un"] },
  estagio: { ctbmf: ["estagio", "ate100"], ropd: ["estagio", "faixa"] },
  apresentacao: { ctbmf: ["trabalhos", "outras"], ropd: ["trabalhos", "outras"], mestrado: ["apresentacoes", "un"] },
  publicacao: { ctbmf: ["artigos", "outras"], ropd: ["artigos", "outras"] },
  premio: { mestrado: ["premios", "un"] },
  lingua: { ctbmf: ["lingua", "intermediario"], ropd: ["lingua", "intermediario"] },
  organizacao: { mestrado: ["comissoes", "un"] },
};

export function C() {
  const est = E();
  if (!est.curriculo || !Array.isArray(est.curriculo.editais)) est.curriculo = { editais: [], atividades: [], certificados: [] };
  est.curriculo.certificados ??= [];
  // descarta os editais provisórios da primeira versão (sem opções)
  est.curriculo.editais = est.curriculo.editais.filter(e => e.criterios?.every(c => Array.isArray(c.opcoes)));
  return est.curriculo;
}

// ---------- pontuação ----------
export function pontosAtividade(at, edital) {
  const v = at.vinculos?.[edital.id];
  if (!v) return null;
  const cr = edital.criterios.find(c => c.id === v.criterio);
  const op = cr?.opcoes.find(o => o.id === v.opcao);
  if (!op) return null;
  let pts = 0;
  const h = Number(at.horas) || 0;
  if (op.calculo === "porHoras") pts = Math.floor(h / (op.horas || 100)) * op.pontos;
  else if (op.calculo === "faixas") pts = h > 0 ? op.faixas.find(([ate]) => ate == null || h <= ate)[1] : 0;
  else pts = op.pontos * Math.min(Number(at.quantidade ?? 1) || 0, op.maxUnidades || Infinity);
  return { cr, op, pts };
}
export function pontuacao(edital) {
  const cur = C();
  const porCr = Object.fromEntries(edital.criterios.map(c => [c.id, { cr: c, bruto: 0, ats: [] }]));
  for (const at of cur.atividades) {
    const r = pontosAtividade(at, edital);
    if (!r) continue;
    porCr[r.cr.id].bruto += r.pts; porCr[r.cr.id].ats.push({ at, ...r });
  }
  const linhas = Object.values(porCr).map(l => ({ ...l, pts: Math.min(l.bruto, l.cr.teto ?? Infinity) }));
  const soma = linhas.reduce((s, l) => s + l.pts, 0);
  return { linhas, total: Math.min(soma, edital.tetoGlobal ?? Infinity), maximo: edital.tetoGlobal };
}

function recompensa(at) {
  const t = TIPOS[at.tipo] || TIPOS.outro;
  const xp = t.porHora ? Math.min(t.max, t.xp + t.porHora * (Number(at.horas) || 0)) : t.xp;
  return { xp, moedas: t.moedas, gemas: t.gemas || 0 };
}
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("pt-BR");
const dataAt = (a) => !a.data ? "" : a.anoApenas ? a.data.slice(0, 4) : dataBR(a.data, { month: "short", year: "numeric" });

// ======================= TELA =======================
// Tela enxuta: placar dos editais, botão de anexar certificado e a lista de atividades com
// três marcadores (Drive, Lattes, Academus). A pontuação é conferida pela tarefa da madrugada,
// que lê os certificados enviados ao repositório e devolve o pacote config/certificados.json.
const CURTO = { ctbmf: "Residência CTBMF", ropd: "Reabilitação Oral", mestrado: "Mestrado PPGO" };
const MARCAS = [["drive", "Drive"], ["lattes", "Lattes"], ["academus", "Academus"]];
let filtro = "todos";

function certs() { const c = C(); c.certificados ??= []; return c.certificados; }
/** Lista unificada: atividades (com ou sem certificado) e certificados ainda não conferidos. */
function itens() {
  const cur = C(), cs = certs();
  const lista = cur.atividades.map(at => ({ at, cert: cs.find(c => c.id === at.certId) || null }));
  for (const c of cs) if (!c.atividadeId && !cur.atividades.some(a => a.certId === c.id)) lista.push({ at: null, cert: c });
  const chave = (i) => i.at?.data || i.cert?.criadoEm?.slice(0, 10) || "";
  return lista.sort((x, y) => (!y.at - !x.at) || chave(y).localeCompare(chave(x)));
}
const marcado = (i, k) => !!(i.at ? i.at[k] : i.cert[k]);
function situacao(i) {
  if (i.cert && !i.cert.conferido) {
    if (i.cert.avaliacao?.invalido) return { cls: "erro", txt: i.cert.avaliacao.motivo || "Não foi possível conferir" };
    if (!i.cert.enviado) return { cls: "pendente", txt: i.cert.erro || "Esperando internet para enviar" };
    return { cls: "pendente", txt: "Aguardando conferência (à noite)" };
  }
  const at = i.at, cur = C();
  const pts = cur.editais.map(ed => [ed, pontosAtividade(at, ed)?.pts || 0]).filter(([, v]) => v > 0);
  return { cls: pts.length ? "pontua" : "", txt: pts.length ? pts.map(([ed, v]) => `${CURTO[ed.id] || ed.nome} ${fmt(v)}`).join(" · ") : "Não pontua nos editais" };
}

export function telaCurriculo() {
  const t = tela(), cur = C(), lista = itens();
  t.innerHTML = `<h1 class="titulo-tela">Currículo</h1><p class="sub">Anexe seus certificados. A pontuação nos editais é conferida à noite.</p>`;
  // placar dos editais
  if (!cur.editais.length) t.insertAdjacentHTML("beforeend", `<div class="aviso-edital">Os editais ainda não foram carregados. Sincronize o app com internet.</div>`);
  const placar = document.createElement("div"); placar.className = "placar-editais";
  for (const ed of cur.editais) {
    const p = pontuacao(ed);
    const b = document.createElement("button"); b.className = "mini-edital";
    b.innerHTML = `<small>${escapar(CURTO[ed.id] || ed.nome)}</small><b>${fmt(p.total)}</b><span>de ${fmt(p.maximo)}</span><i style="--p:${Math.min(100, p.total / p.maximo * 100)}%"></i>`;
    b.onclick = () => detalheEdital(ed);
    placar.append(b);
  }
  t.append(placar);
  // contagens e horas
  const ct = contagens(), hf = (h) => `${fmt(h)} h`;
  const resumo = document.createElement("button"); resumo.className = "resumo-cur";
  resumo.innerHTML = `${["eventos", "formacao"].map(k => `<span class="rc-item"><small>${icone(SECOES[k].icone, "ico-inline")} ${SECOES[k].nome}</small><b>${ct.por[k].n}</b><em>${hf(ct.por[k].h)}</em></span>`).join("")}
    <span class="rc-item"><small>${icone("⏳", "ico-inline")} Horas no total</small><b>${fmt(ct.total)}</b><em>${ct.n} atividades</em></span>`;
  resumo.onclick = () => detalheContagens();
  t.append(resumo);
  const m0 = METAS[0], prox = { m: m0, v: Math.min(m0.meta, m0.valor(ct)) }; // a meta dos 1.000 eventos fica à vista
  const bm = document.createElement("button"); bm.className = "metas-cur";
  bm.innerHTML = `${icone("🎯", "ico-inline")} <span>Metas absurdas: <b>${escapar(prox.m.nome)}</b> ${fmt(prox.v)}/${fmt(prox.m.meta)}</span><i style="--p:${Math.max(1, prox.v / prox.m.meta * 100)}%"></i>`;
  bm.onclick = () => detalheMetas();
  t.append(bm);
  // anexar
  const anexar = document.createElement("button"); anexar.className = "botao botao-anexar";
  anexar.innerHTML = `${icone("📎", "ico-inline")} Anexar certificado`;
  anexar.onclick = () => escolherArquivos(null);
  t.append(anexar);
  const pend = certs().filter(c => !c.conferido && !c.avaliacao?.invalido);
  if (pend.length) {
    const naoEnv = pend.filter(c => !c.enviado).length;
    t.insertAdjacentHTML("beforeend", `<p class="sub status-cert">${pend.length} aguardando conferência${naoEnv ? ` · ${naoEnv} ainda não enviado${naoEnv === 1 ? "" : "s"}` : ""}</p>`);
  }
  // filtros
  const conta = (k) => lista.filter(i => !marcado(i, k)).length;
  const fl = document.createElement("div"); fl.className = "filtros-cur";
  for (const [k, rot] of [["todos", `Todos ${lista.length}`], ...MARCAS.map(([m, r]) => [m, `Sem ${r} ${conta(m)}`])]) {
    const b = document.createElement("button"); b.className = `chip-filtro ${filtro === k ? "on" : ""}`; b.textContent = rot;
    b.onclick = () => { filtro = k; telaCurriculo(); };
    fl.append(b);
  }
  t.append(fl);
  // lista
  const caixa = document.createElement("div"); caixa.className = "lista-cur";
  const vis = lista.filter(i => filtro === "todos" || !marcado(i, filtro));
  if (!vis.length) caixa.innerHTML = `<p class="sub vazio-cur">${lista.length ? "Nada aqui: tudo marcado!" : "Nenhum certificado ainda. Toque em “Anexar certificado”."}</p>`;
  for (const i of vis) {
    const tipo = TIPOS[i.at?.tipo] || null, sit = situacao(i);
    const linha = document.createElement("div"); linha.className = "item-cur";
    linha.innerHTML = `<button class="item-cur-corpo"><span class="ico-tipo">${icone(tipo ? tipo.icone : "📄", "ico3d ico-medio")}</span>
      <span class="txt"><b>${escapar(i.at?.titulo || i.cert?.titulo || i.cert?.nome || "Certificado")}</b>
      <small>${i.at ? [SECOES[secaoDe(i.at)].nome, i.at.horas ? `${fmt(i.at.horas)} h` : "", i.at.data ? dataAt(i.at) : "", secaoDe(i.at) === "eventos" && i.at.cidade ? `📍 ${i.at.cidade}` : ""].filter(Boolean).map(escapar).join(" · ") : i.cert?.secao ? `${SECOES[i.cert.secao]?.nome || ""} · certificado anexado` : "Certificado anexado"}${i.cert ? ` ${icone("📎", "ico-inline")}` : ""}</small>
      <small class="sit ${sit.cls}">${escapar(sit.txt)}</small></span></button>
      <div class="marcas">${MARCAS.map(([k, r]) => `<button class="marca-cur ${marcado(i, k) ? "on" : ""}" data-k="${k}">${marcado(i, k) ? "✓ " : ""}${r}</button>`).join("")}</div>`;
    linha.insertAdjacentHTML("afterbegin", `<button class="lapis-cur" aria-label="Editar o nome">${icone("✏️", "ico-inline")}</button>`);
    linha.querySelector(".lapis-cur").onclick = () => renomear(i);
    linha.querySelector(".item-cur-corpo").onclick = () => detalheItem(i);
    linha.querySelectorAll(".marca-cur").forEach(b => (b.onclick = () => alternarMarca(i, b.dataset.k)));
    caixa.append(linha);
  }
  t.append(caixa);
  const manual = document.createElement("button"); manual.className = "link link-manual"; manual.textContent = "Adicionar atividade sem certificado";
  manual.onclick = () => editarAtividade(null);
  t.append(manual);
}

/** Lápis da lista: muda só o nome (da atividade e do certificado ligado a ela). */
async function renomear(i) {
  const atual = i.at?.titulo || i.cert?.titulo || i.cert?.nome || "";
  const campo = document.createElement("div");
  campo.innerHTML = `<div><h2 class="titulo-detalhe">Nome do certificado</h2><label class="campo"><input id="novo-nome" maxlength="160" autocomplete="off"></label></div>`;
  const ok = modal({ html: campo.innerHTML, botoes: [{ texto: "Salvar", valor: "ok" }, { texto: "Cancelar", valor: null, classe: "secundario" }] });
  const inp = document.getElementById("novo-nome");
  inp.value = atual;
  inp.onkeydown = (e) => { if (e.key === "Enter") document.querySelector("#modal .botao").click(); };
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
  const valor = await ok;
  const novo = inp.value.replace(/\s+/g, " ").trim();
  if (valor !== "ok" || !novo || novo === atual) return;
  if (i.at) i.at.titulo = novo;
  if (i.cert) { i.cert.titulo = novo; i.cert.nomeEditado = true; }
  marcarVidaSuja(); salvar(); aoMudar(); tocar("toque"); toast("Nome atualizado"); telaCurriculo();
}

function alternarMarca(i, k) {
  const alvo = i.at || i.cert, novo = !alvo[k];
  alvo[k] = novo;
  if (i.at && i.cert) i.cert[k] = novo;
  const chave = `${k}Premiado`;
  if (novo && !alvo[chave]) {
    alvo[chave] = true;
    const nome = MARCAS.find(m => m[0] === k)[1];
    const xp = ganhar(5, 1, `${nome}: ${alvo.titulo || alvo.nome}`, "curriculo");
    tocar("moeda"); toast(`+${xp} XP: marcado no ${nome}!`);
  } else tocar("toque");
  marcarVidaSuja(); salvar(); aoMudar(); telaCurriculo();
}

async function detalheEdital(ed) {
  const p = pontuacao(ed);
  const linhas = p.linhas.map(l => {
    const pct = l.cr.teto ? Math.min(100, l.pts / l.cr.teto * 100) : 0;
    return `<div class="criterio"><div class="linha"><span>${escapar(l.cr.nome)}</span><b>${fmt(l.pts)} / ${fmt(l.cr.teto)}</b></div><div class="barra"><div style="width:${pct}%"></div></div>
      ${l.ats.map(a => `<small class="sub" style="display:block">• ${escapar(a.at.titulo)}: ${fmt(a.pts)}</small>`).join("")}</div>`;
  }).join("");
  await modal({ titulo: "", html: `<div><h2 class="titulo-detalhe">${escapar(ed.nome)}</h2><p class="placar-detalhe"><b>${fmt(p.total)}</b> de ${fmt(p.maximo)} pontos</p></div><div class="detalhe-edital"><small class="sub">${escapar(ed.fonte || "")}</small>${linhas}${ed.nota ? `<div class="aviso-edital">${escapar(ed.nota)}</div>` : ""}<p class="sub" style="margin-top:10px">Estimativa a partir dos certificados conferidos. A pontuação oficial é a da banca.</p></div>`, botoes: [{ texto: "Fechar", valor: true }] });
}

async function detalheItem(i) {
  const at = i.at, c = i.cert, cur = C(), tipo = TIPOS[at?.tipo];
  const pts = at ? cur.editais.map(ed => { const r = pontosAtividade(at, ed); return r?.pts ? `<li><b>${escapar(CURTO[ed.id] || ed.nome)}</b>: ${fmt(r.pts)} pt <small class="sub">(${escapar(r.cr.nome)})</small></li>` : ""; }).join("") : "";
  const info = at ? [tipo?.nome, at.instituicao, at.horas ? `${fmt(at.horas)} h` : "", at.data ? dataAt(at) : ""].filter(Boolean).join(" · ") : "";
  const sc = at ? secaoDe(at) : c?.secao || null, pc = at ? palavras(at) : [];
  const lattes = at ? `<div class="lattes-item"><p><b>No Lattes:</b> ${escapar(SECOES[sc].lattes)}</p>${sc === "eventos" ? `<p><b>Cidade:</b> ${at.cidade ? escapar(at.cidade) : "<span class=\"sub\">a conferência da noite preenche</span>"}</p>` : ""}${sc === "formacao" ? `<p><b>Palavras-chave:</b> ${pc.length ? escapar(pc.join("; ")) : "<span class=\"sub\">a conferência da noite preenche</span>"}</p>` : ""}</div>` : sc ? `<p class="sub">Marcado como ${escapar(SECOES[sc].nome)}.</p>` : "";
  const conf = c?.avaliacao ? `<div class="aviso-edital">${c.avaliacao.invalido ? `Não conferido: ${escapar(c.avaliacao.motivo || "")}` : `${escapar(c.avaliacao.resumo || "Conferido.")}${c.avaliacao.duvida ? `<br><b>Dúvida:</b> ${escapar(c.avaliacao.duvida)}` : ""}`}</div>` : c ? `<p class="sub">${escapar(situacao(i).txt)}.</p>` : "";
  const botoes = [];
  if (c) botoes.push({ texto: "Ver certificado", valor: "ver" });
  else if (at) botoes.push({ texto: "Anexar certificado", valor: "anexar" });
  if (at && sc === "formacao" && pc.length) botoes.push({ texto: "Copiar palavras-chave", valor: "copiar", classe: "secundario" });
  if (at) botoes.push({ texto: "Corrigir dados ou seção", valor: "editar", classe: "secundario" });
  botoes.push({ texto: "Excluir", valor: "excluir", classe: "secundario" }, { texto: "Fechar", valor: null, classe: "secundario" });
  const v = await modal({ titulo: "", html: `<div><h2 class="titulo-detalhe">${escapar(at?.titulo || c?.titulo || c?.nome || "Certificado")}</h2></div><div class="detalhe-item">${info ? `<p class="sub">${escapar(info)}</p>` : ""}${lattes}${pts ? `<ul class="pts-item">${pts}</ul>` : at ? `<p class="sub">Não pontua nos editais acompanhados.</p>` : ""}${conf}</div>`, botoes });
  if (v === "ver") return verArquivo(c);
  if (v === "copiar") { try { await navigator.clipboard.writeText(pc.join("; ")); toast("Palavras-chave copiadas"); } catch (e) { toast(pc.join("; "), 6000); } return; }
  if (v === "anexar") return escolherArquivos(at);
  if (v === "editar") return editarAtividade(at);
  if (v === "excluir") {
    const ok = await modal({ titulo: "Excluir?", texto: `${at?.titulo || c?.nome}. O arquivo enviado continua guardado no repositório.`, botoes: [{ texto: "Excluir", valor: true }, { texto: "Manter", valor: false, classe: "secundario" }] });
    if (!ok) return;
    if (at) cur.atividades = cur.atividades.filter(x => x.id !== at.id);
    if (c) { cur.certificados = certs().filter(x => x.id !== c.id); apagarArquivo(c.id); }
    marcarVidaSuja(); salvar(); aoMudar(); telaCurriculo();
  }
}

async function verArquivo(c) {
  const blob = await pegarArquivo(c.id);
  if (!blob) return toast("O arquivo não está neste celular (foi anexado em outro aparelho ou apagado).");
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = url; a.download = c.nome; a.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Abre o seletor de arquivos (câmera, galeria ou PDF). `at`: atividade existente a que o certificado pertence. */
async function escolherArquivos(at) {
  let secao = at ? secaoDe(at) : null;
  if (!at) {
    secao = await modal({ titulo: "Que certificado é?", texto: "Onde ele vai no Lattes. A maioria é curso de curta duração (Formação complementar).",
      botoes: [{ texto: "🎓 Formação complementar (curso)", valor: "formacao" }, { texto: "🏛️ Evento (congresso, jornada, palestra)", valor: "eventos" },
        { texto: "Outro: a conferência decide", valor: "auto", classe: "secundario" }, { texto: "Cancelar", valor: null, classe: "secundario" }] });
    if (!secao) return;
    if (secao === "auto") secao = null;
  }
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*,application/pdf"; inp.multiple = !at;
  inp.onchange = async () => {
    const arqs = [...inp.files];
    if (!arqs.length) return;
    let ok = 0;
    for (const f of arqs) {
      if (f.size > 15 * 1024 * 1024) { toast(`${f.name} passa de 15 MB. Envie uma versão menor.`, 4000); continue; }
      const blob = f.type.startsWith("image/") ? await reduzirImagem(f) : f;
      const id = `${hojeISO().replace(/-/g, "")}-${uid()}`;
      const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
      await guardarArquivo(id, blob);
      certs().push({ id, nome: f.name, mime: blob.type, tamanho: blob.size, criadoEm: new Date().toISOString(), caminho: `progresso/certificados/${id}.${ext}`,
        enviado: false, conferido: false, atividadeId: at?.id || null, secao, drive: !!at?.drive, lattes: !!at?.lattes, academus: !!at?.academus });
      if (at) at.certId = id;
      ok++;
    }
    if (!ok) return;
    const xp = ganhar(8 * ok, 2 * ok, `Certificado${ok > 1 ? "s" : ""} anexado${ok > 1 ? "s" : ""}`, "curriculo");
    marcarVidaSuja(); salvar(); aoMudar(); tocar("moeda");
    toast(`${ok} certificado${ok > 1 ? "s" : ""} anexado${ok > 1 ? "s" : ""}. +${xp} XP`, 3000);
    telaCurriculo();
    try {
      const n = await enviarCurriculoAgora();
      if (n) toast(`Enviado${n > 1 ? "s" : ""} para conferência hoje à noite.`, 3000);
    } catch (e) { toast("Não deu para enviar agora. Vai na próxima sincronização.", 3500); }
    if (document.querySelector(".aba.ativa")?.dataset.aba === "curriculo") telaCurriculo();
  };
  inp.click();
}

/** Evento da Agenda com o certificado recebido → uma atividade só no Currículo (pedido do Alediov, 26/10/2026: eventos
 *  de vários dias têm um certificado só), com a carga horária somada dos dias a que foi; depois abre o anexar.
 *  `info`: { id, nome, data (1º dia a que foi), horas, dias }. Ligada pelo `eventoId`: tocar de novo não duplica. */
export const atividadeDoEvento = (id) => C().atividades.find(a => a.eventoId === id) || null;
export function levarEventoAoCurriculo(info) {
  const cur = C();
  let at = cur.atividades.find(a => a.eventoId === info.id), nova = false;
  if (!at) {
    const tipo = info.dias > 1 || info.horas >= 4 ? "evento" : "palestra", vinculos = {};
    for (const ed of cur.editais) { const s = SUGESTOES[tipo]?.[ed.id]; vinculos[ed.id] = s ? { criterio: s[0], opcao: s[1] } : null; }
    at = { id: uid(), eventoId: info.id, tipo, secao: "eventos", titulo: info.nome, instituicao: "", data: info.data, horas: info.horas || null, horasDaAgenda: info.horas || null,
      quantidade: 1, certificado: true, lattes: false, vinculos, obs: info.dias > 1 ? `${info.dias} dias, pela Agenda` : "", cidade: "" };
    cur.atividades.push(at); nova = true;
    const r = recompensa(at), xp = ganhar(r.xp, r.moedas, `Currículo: ${at.titulo}`, "curriculo");
    tocar("fim"); toast(`No Currículo${at.horas ? ` com ${fmt(at.horas)} h` : ""}: +${xp} XP e +${r.moedas} moedas. Agora anexe o arquivo.`, 3600);
  } else if (info.horas && at.horas === at.horasDaAgenda && at.horas !== info.horas) { at.horas = at.horasDaAgenda = info.horas; } // horas que ele não mexeu acompanham a Agenda
  marcarVidaSuja(); salvar(); aoMudar();
  window.dispatchEvent(new CustomEvent("oq-ir", { detail: "curriculo" }));
  if (!at.certId) escolherArquivos(at);
  else if (!nova) toast("Este evento já está no Currículo, com o certificado.");
  return at;
}

/** Fotos grandes viram JPEG de até 2200 px (certificado legível, envio leve). */
async function reduzirImagem(f) {
  if (f.size < 1.2 * 1024 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(ok => cv.toBlob(b => ok(b || f), "image/jpeg", 0.85));
  } catch (e) { return f; }
}

/** Aplica as conferências da tarefa da madrugada (pacote config/certificados.json). Devolve quantas são novas. */
export function aplicarConferencias(avaliacoes) {
  const cur = C(), cs = certs();
  let n = 0;
  for (const av of avaliacoes) {
    const c = cs.find(x => x.id === av.id);
    if (!c || c.conferido) continue;
    c.avaliacao = { resumo: av.resumo || "", duvida: av.duvida || "", invalido: !!av.invalido, motivo: av.motivo || "", em: hojeISO() };
    if (av.titulo && !c.nomeEditado) c.titulo = av.titulo;
    if (av.invalido) { n++; continue; }
    const dados = { ...(av.atividade || {}) };
    if (c.nomeEditado) dados.titulo = c.titulo; // o nome que o Alediov escolheu vale
    if (c.secao) dados.secao = c.secao;         // e a seção que ele marcou ao anexar também
    let at = cur.atividades.find(a => a.id === (c.atividadeId || av.atividadeExistente));
    if (at) {
      Object.assign(at, Object.fromEntries(Object.entries(dados).filter(([, v]) => v != null && v !== "")));
      at.certId = c.id; at.certificado = true;
    } else {
      at = { id: `cert-${c.id}`, tipo: "outro", titulo: c.titulo || c.nome, instituicao: "", data: "", horas: null, quantidade: 1, vinculos: {}, obs: "", ...dados,
        certId: c.id, certificado: true, drive: c.drive, lattes: c.lattes, academus: c.academus };
      cur.atividades.push(at);
      const r = recompensa(at);
      ganhar(r.xp, r.moedas, `Certificado conferido: ${at.titulo}`, "curriculo");
      if (r.gemas) E().gemas = (E().gemas || 0) + r.gemas;
    }
    c.atividadeId = at.id; c.conferido = true; n++;
  }
  if (n) { marcarVidaSuja(); salvar(); }
  return n;
}
/** Complementos da conferência para atividades já cadastradas: cidade (eventos) e palavras-chave (formação). */
export function aplicarComplementos(lista) {
  const cur = C();
  let n = 0;
  for (const x of lista || []) {
    const at = cur.atividades.find(a => a.id === x.atividadeId);
    if (!at) continue;
    if (x.cidade && !at.cidadeEditada && at.cidade !== x.cidade) { at.cidade = x.cidade; n++; }
    if (x.palavrasChave?.length && !at.palavrasEditadas && palavras(at).join(";") !== x.palavrasChave.join(";")) { at.palavrasChave = x.palavrasChave.slice(0, 6); n++; }
  }
  if (n) { marcarVidaSuja(); salvar(); }
  return n;
}

async function detalheContagens() {
  const ct = contagens(), hf = (h) => `${fmt(h)} h`;
  const secoes = Object.entries(SECOES).map(([k, s]) => `<li><span>${icone(s.icone, "ico-inline")} ${escapar(s.nome)}</span><b>${ct.por[k].n} · ${hf(ct.por[k].h)}</b></li>`).join("");
  const tipos = Object.entries(ct.tipos).sort((a, b) => b[1].h - a[1].h || b[1].n - a[1].n).map(([k, v]) => `<li><span>${icone(TIPOS[k]?.icone || "✳️", "ico-inline")} ${escapar(TIPOS[k]?.nome || k)}</span><b>${v.n} · ${hf(v.h)}</b></li>`).join("");
  await modal({ titulo: "", html: `<div><h2 class="titulo-detalhe">Seu currículo em números</h2><p class="placar-detalhe"><b>${fmt(ct.total)}</b> horas em ${ct.n} atividades</p></div>
    <div class="detalhe-edital"><h3 class="sub-cur">Por seção do Lattes</h3><ul class="lista-cont">${secoes}</ul><h3 class="sub-cur">Horas por categoria</h3><ul class="lista-cont">${tipos}</ul>
    <p class="sub" style="margin-top:10px">A seção sai do tipo (curso → Formação complementar; evento e palestra → Eventos), a não ser que você tenha escolhido outra.</p></div>`, botoes: [{ texto: "Fechar", valor: true }] });
}
async function detalheMetas() {
  const ct = contagens();
  const linhas = METAS.map(m => { const v = Math.min(m.meta, m.valor(ct)), p = v / m.meta * 100, falta = m.meta - v;
    return `<div class="criterio"><div class="linha"><span>${icone(m.icone, "ico-inline")} ${escapar(m.nome)}</span><b>${fmt(v)} / ${fmt(m.meta)}</b></div><div class="barra"><div style="width:${Math.max(p ? 1 : 0, p)}%"></div></div><small class="sub">${falta <= 0 ? "Meta batida! 🎉" : `${p < 1 ? p.toFixed(2).replace(".", ",") : Math.floor(p)}% · faltam ${fmt(falta)}${m.horas ? " h" : ""}`}</small></div>`; }).join("");
  await modal({ titulo: "", html: `<div><h2 class="titulo-detalhe">Metas absurdas</h2><p class="sub">Para acompanhar sem pressa. Uma por vez, um certificado de cada vez.</p></div><div class="detalhe-edital">${linhas}</div>`, botoes: [{ texto: "Fechar", valor: true }] });
}

async function editarAtividade(at) {
  const cur = C(), novo = !at;
  at ||= { tipo: "curso", titulo: "", instituicao: "", data: hojeISO(), horas: null, quantidade: 1, certificado: true, lattes: false, vinculos: {}, obs: "" };
  const campos = [
    { id: "tipo", rotulo: "Tipo", tipo: "select", valor: at.tipo, opcoes: Object.entries(TIPOS).map(([k, v]) => [k, `${v.icone} ${v.nome}`]) },
    { id: "secao", rotulo: "Seção do Lattes", tipo: "select", valor: secaoDe(at), opcoes: Object.entries(SECOES).map(([k, v]) => [k, `${v.icone} ${v.nome}`]) },
    { id: "titulo", rotulo: "Título", tipo: "text", valor: at.titulo },
    { id: "instituicao", rotulo: "Instituição / plataforma", tipo: "text", valor: at.instituicao },
    { id: "data", rotulo: "Data (conclusão ou início)", tipo: "date", valor: at.data },
    { id: "horas", rotulo: "Carga horária total (h)", tipo: "number", valor: at.horas ?? "" },
    { id: "cidade", rotulo: "Cidade do evento", tipo: "text", valor: at.cidade || "", placeholder: "ex.: Cascavel (PR); on-line: a cidade de quem promoveu", mostrarSe: v => v.secao === "eventos" },
    { id: "palavrasChave", rotulo: "Palavras-chave (até 6, separadas por ;)", tipo: "text", valor: palavras(at).join("; "), mostrarSe: v => v.secao === "formacao" },
    { id: "quantidade", rotulo: "Duração (semestres para IC e monitoria; anos para colaboração)", tipo: "number", valor: at.quantidade ?? 1,
      mostrarSe: v => ["monitoria", "projeto_pesquisa", "projeto_extensao", "liga", "estagio"].includes(v.tipo) },
    { id: "certificado", rotulo: "Tenho o certificado", tipo: "checkbox", valor: at.certificado },
    { id: "drive", rotulo: "Salvo no Drive", tipo: "checkbox", valor: !!at.drive },
    { id: "lattes", rotulo: "Já está no Lattes", tipo: "checkbox", valor: at.lattes },
    { id: "academus", rotulo: "Lançado no Academus", tipo: "checkbox", valor: !!at.academus },
  ];
  for (const ed of cur.editais) {
    const v = at.vinculos?.[ed.id];
    const sug = novo ? SUGESTOES[at.tipo]?.[ed.id] : null;
    const atual = v ? `${v.criterio}|${v.opcao}` : sug ? sug.join("|") : "";
    campos.push({ id: `v_${ed.id}`, rotulo: `Conta em: ${ed.nome}`, tipo: "select", valor: atual,
      opcoes: [["", "Não conta"], ...ed.criterios.flatMap(c => c.opcoes.map(o => [`${c.id}|${o.id}`, `${c.nome} › ${o.nome}`]))] });
  }
  campos.push({ id: "obs", rotulo: "Observações", tipo: "text", valor: at.obs });
  const f = await formulario({ titulo: novo ? "Nova atividade" : "Editar atividade", campos,
    botoes: novo ? [{ texto: "Adicionar", acao: "salvar" }] : [{ texto: "Salvar", acao: "salvar" }, { texto: "Excluir", acao: "excluir", classe: "secundario" }] });
  if (!f) return;
  if (f._acao === "excluir") {
    const ok = await modal({ titulo: "Excluir atividade?", texto: at.titulo, botoes: [{ texto: "Excluir", valor: true }, { texto: "Manter", classe: "secundario", valor: false }] });
    if (ok) { cur.atividades = cur.atividades.filter(x => x.id !== at.id); marcarVidaSuja(); }
    return telaCurriculo();
  }
  if (!f.titulo) return toast("Dê um título à atividade.");
  const vinculos = {};
  for (const ed of cur.editais) {
    let val = f[`v_${ed.id}`];
    // na criação, se o tipo mudou e o campo ficou na sugestão do tipo anterior, usa a sugestão do tipo novo
    if (novo && f.tipo !== at.tipo) { const s = SUGESTOES[f.tipo]?.[ed.id]; val = s ? s.join("|") : ""; }
    if (novo && f.tipo === "curso" && ed.id === "mestrado") val = (Number(f.horas) || 0) >= 60 ? "cursos|un" : val;
    vinculos[ed.id] = val ? { criterio: val.split("|")[0], opcao: val.split("|")[1] } : null;
  }
  // mudou a seção e o tipo ficou o da outra seção: acompanha (curso ↔ evento)
  let tipoNovo = f.tipo;
  if (f.secao === "eventos" && tipoNovo === "curso") tipoNovo = "evento";
  if (f.secao === "formacao" && ["evento", "palestra"].includes(tipoNovo)) tipoNovo = "curso";
  const pcs = String(f.palavrasChave || "").split(/\s*;\s*/).filter(Boolean).slice(0, 6);
  const extra = { secao: f.secao, cidade: f.cidade || at.cidade || "", palavrasChave: pcs.length ? pcs : palavras(at),
    cidadeEditada: at.cidadeEditada || (!!f.cidade && f.cidade !== (at.cidade || "")), palavrasEditadas: at.palavrasEditadas || (pcs.join(";") !== palavras(at).join(";") && pcs.length > 0) };
  const nova = { ...at, ...extra, tipo: tipoNovo, titulo: f.titulo, instituicao: f.instituicao, data: f.data, anoApenas: novo ? false : at.anoApenas,
    horas: f.horas, quantidade: f.quantidade ?? 1, certificado: f.certificado, drive: f.drive, lattes: f.lattes, academus: f.academus, vinculos, obs: f.obs };
  if (!novo && secaoDe(at) !== f.secao) toast(`Agora em ${SECOES[f.secao].nome}. Lembre de mudar também no Lattes.`, 3500);
  if (novo) {
    nova.id = uid(); cur.atividades.push(nova);
    const r = recompensa(nova), bonus = nova.lattes ? 10 : 0;
    const xp = ganhar(r.xp + bonus, r.moedas + (bonus ? 2 : 0), `Currículo: ${nova.titulo}`, "curriculo");
    if (r.gemas) E().gemas = (E().gemas || 0) + r.gemas;
    tocar("fim"); toast(`+${xp} XP, +${r.moedas + (bonus ? 2 : 0)} moedas${r.gemas ? ` e +${r.gemas} gemas` : ""} pelo currículo!`, 3200);
  } else {
    const i = cur.atividades.findIndex(x => x.id === at.id);
    if (!at.lattes && nova.lattes) { const xp = ganhar(10, 2, `Lançado no Lattes: ${nova.titulo}`, "curriculo"); tocar("moeda"); toast(`+${xp} XP: lançado no Lattes!`); }
    cur.atividades[i] = nova; marcarVidaSuja();
  }
  salvar(); aoMudar(); telaCurriculo();
}
