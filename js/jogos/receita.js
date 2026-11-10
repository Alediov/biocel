// Receituário (Andrade, cap. 9 e protocolos), no formulário da Clínica Odontológica da UNIOESTE (receituario.js;
// pedido do Alediov, 04/11/2026). Três modos:
// "Escreva a receita": um caso clínico; ele escolhe o documento, pega os medicamentos na prateleira e escreve cada
//   item no formulário (concentração e forma, bloco de uso, número, orientação com os números digitados e a
//   quantidade total); o app confere campo a campo, com a conta e o porquê.
// "Ache o erro": uma receita pronta no formulário com um erro (de conduta ou das convenções da clínica); toque no
//   pedaço errado.
// "Pediátrica" (antes o jogo Dose Pediátrica): a conta das gotas ou dos mL pelo peso e, depois, a receita escrita.
import { abrirCamada, terminar, semConteudo, calculadora } from "../jogos.js";
import { extra } from "../dados.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { modal, escapar } from "../ui.js";
import { DEMO } from "../edicao.js";
import { E } from "../estado.js";
import * as RU from "./receituario.js";

const fonteTxt = (f) => (f?.lei ? f.lei : f ? `Andrade, cap. ${+f.unidade.slice(1, 3)}, p. ${f.pagina} do PDF` : "");
let atual = false, R = null, MOD = RU.PADRAO;
const trocar = (t) => (atual ? (R.atual.substituir || []).reduce((s, [a, b]) => s.split(a).join(b), t) : t);
const nomeAluno = () => (DEMO ? E().avatar?.nome || "" : "Alediov");
const MODOS = { escrever: "Escreva a Receita", erro: "Ache o Erro", pediatrica: "Receita Pediátrica" };

/** Entrada do jogo. `modo`: "escrever" | "erro" | "pediatrica" (sem ele, pergunta). */
export async function jogarReceita(modo) {
  if (modo === "montar") modo = "escrever";
  if (!MODOS[modo]) modo = await modal({ titulo: "Receituário", texto: "No receituário da clínica da UNIOESTE. Como quer jogar?", botoes: [
    { texto: "Escreva a Receita", valor: "escrever" },
    { texto: "Ache o Erro", valor: "erro", classe: "secundario" },
    { texto: "Pediátrica (gotas e mL)", valor: "pediatrica", classe: "secundario" },
    { texto: "Cancelar", valor: null, classe: "secundario" }] });
  if (!modo) return;
  let versao = "livro";
  if (modo !== "pediatrica") {
    versao = await modal({ titulo: "Qual versão das normas?", texto: "O livro é de 2013. A versão atual acrescenta o que mudou na legislação desde então.", botoes: [
      { texto: "Pelo livro (2013)", valor: "livro" },
      { texto: "Legislação atual (2026)", valor: "atual", classe: "secundario" },
      { texto: "Cancelar", valor: null, classe: "secundario" }] });
    if (!versao) return;
  }
  const cam = abrirCamada(MODOS[modo]);
  cam.raiz.classList.add("ru-jogo");
  const [r, f, d] = await Promise.all([extra("jogo:receitas"), extra("jogo:receituario-unioeste"), modo === "pediatrica" ? extra("jogo:doses-andrade") : null, RU.garantirCss()]);
  R = r; MOD = f || RU.PADRAO;
  if (!R || (R.versao || 0) < 3 || (modo === "pediatrica" && !d?.criancas)) return semConteudo(cam, "Os dados do jogo ainda não chegaram. Sincronize com internet.");
  atual = versao === "atual" && !!R.atual;
  if (modo !== "pediatrica") cam.raiz.querySelector(".jogo-topo b").textContent += atual ? " · atual" : " · livro";
  if (modo === "escrever") escrever(cam);
  else if (modo === "erro") acheErro(cam);
  else pediatrica(cam, d.criancas);
}

// ---------------- partes comuns ----------------
const folha = (d, o = {}) => RU.receituarioHTML(d, { modelo: MOD, ...o });
const MED = () => Object.fromEntries((R.medicamentos || []).map((m) => [m.id, m]));
const APR = () => Object.fromEntries((R.medicamentos || []).flatMap((m) => m.apr.map((a) => [a.id, { ...a, med: m.id, classe: m.classe }])));
const ehAtb = (txt) => /2 vias, com idade/.test(txt || "");
/** O "Para:" do formulário: com idade e sexo na receita de antimicrobiano; peso na criança; CPF nos controlados (atual). */
function paraDe(c, doc, controlado) {
  const p = c.paciente, ex = [];
  if (ehAtb(doc)) ex.push(`${p.idade} anos`, p.sexo === "F" ? "feminino" : "masculino");
  if (p.peso) ex.push(`${p.peso} kg`);
  if (atual && controlado && doc) ex.push("CPF 000.000.000-00");
  return { para: p.nome, paraExtra: ex.join(" · ") || undefined };
}
const rodape = (c) => ({ disciplina: c?.clinica || "", professor: "", aluno: nomeAluno(), nivel: "graduacao" });
function feedback(certo, titulo, texto, fonte, html = "") {
  return `<div class="feedback-mini entra ${certo === true ? "certo" : certo === "meio" ? "parcial" : "errado"}"><b>${titulo}</b>${html}${texto ? `<p>${escapar(texto)}</p>` : ""}${fonte ? `<small>${escapar(fonte)}</small>` : ""}</div>`;
}
function botao(onde, txt, fn, classe = "botao") {
  const b = document.createElement("button"); b.className = classe; b.textContent = txt; b.onclick = fn;
  onde.append(b);
  requestAnimationFrame(() => b.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  return b;
}
function lembrete() {
  const itens = atual ? R.atual.lembrete : [
    "Receita comum: nome do paciente e endereço, uso interno ou externo, medicamento com concentração e quantidade, orientação por extenso, data e assinatura de próprio punho.",
    "Antimicrobiano: 2 vias, com idade e sexo, válida por 10 dias.",
    "Benzodiazepínico: receita comum + Notificação de Receita B (azul).",
    "Tramadol, codeína (até 100 mg por unidade) e coxibes: receita de controle especial em 2 vias."];
  const regras = (MOD.regras || []).map((r) => r.texto);
  return `<div class="cartao revisao-jogo"><b>${atual ? "O que vale hoje" : "Lembrete do Andrade"}</b><ul>${itens.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul><small class="sub">${escapar(atual ? R.atual.aviso : R.aviso)}</small></div>`
    + (regras.length ? `<div class="cartao revisao-jogo"><b>No receituário da clínica (${escapar(MOD.codigo || "OD-0003")})</b><ul>${regras.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul></div>` : "");
}
/** Lista dos campos conferidos (✓/✗, o certo e o porquê dos errados). */
const listaConferida = (C) => `<ul class="pos-check ru-check">${C.map((x) => `<li class="${x.ok ? "ok" : "erro"}"><i>${x.ok ? "✓" : "✗"}</i><span>${escapar(x.campo)}${x.ok ? "" : `: <b>${escapar(x.certo)}</b>${x.explic ? `<small>${escapar(x.explic)}</small>` : ""}`}</span></li>`).join("")}</ul>`;

// ---------------- editor de um item ----------------
/**
 * Monta o editor de um item em `box`: concentração e forma, bloco, número, orientação (números digitados) e
 * quantidade. `aoMudar(escrita)` a cada mudança (a prévia no formulário); `aoConfirmar(escrita)` no botão.
 * `fixo` = { apr, bloco, n } já decididos (não aparecem).
 */
function editorItem(box, { med, aprs, maxN, fixo = {}, titulo }, aoMudar, aoConfirmar) {
  const A = APR(), e = { apr: fixo.apr || (aprs.length === 1 ? aprs[0].id : null), bloco: fixo.bloco || null, n: fixo.n || null, dose: "", intervalo: "", dur: "", durUn: "dias", momento: null, ataque: null, seDor: false, espera24: false, maxDia: "", qtd: "", unica: false };
  const chips = (k, ops) => `<div class="pos-chips" data-k="${k}">${ops.map(([v, t]) => `<button type="button" class="chip-pos" data-v="${escapar(v)}">${escapar(t)}</button>`).join("")}</div>`;
  const num = (k, modo = "numeric", ph = "") => `<input class="ru-num" data-k="${k}" inputmode="${modo}" maxlength="4" autocomplete="off" placeholder="${ph}" aria-label="${k}">`;
  box.className = "posologia ru-ed";
  box.innerHTML = `
    <div class="ru-ed-tit">${titulo}</div>
    ${fixo.apr ? "" : `<div class="pos-campo"><small>Concentração e forma</small>${chips("apr", aprs.map((a) => [a.id, a.txt]))}</div>`}
    ${fixo.bloco ? "" : `<div class="pos-campo"><small>Bloco de uso</small>${chips("bloco", [["interno", "Uso Interno · Via Oral"], ["externo", "Uso Externo · Bochecho"]])}</div>`}
    ${fixo.n ? "" : `<div class="pos-campo"><small>Número no bloco</small>${chips("n", Array.from({ length: maxN }, (_, i) => [String(i + 1), `${i + 1}|`]))}</div>`}
    <div class="pos-campo ru-ori"><small>Orientação</small>
      <div class="ru-frase"><span class="ru-verbo">Tomar</span> ${num("dose", "decimal")} <span class="ru-un" data-u="dose"></span></div>
      <div class="pos-chips ru-tomada" data-k="tomada"><button type="button" class="chip-pos" data-v="cada">A cada … horas</button><button type="button" class="chip-pos" data-v="unica">Dose única</button></div>
      <div class="ru-frase ru-reg" hidden>a cada ${num("intervalo")} horas, durante ${num("dur")} <span class="pos-chips ru-durun" data-k="durUn"><button type="button" class="chip-pos on" data-v="dias">dias</button><button type="button" class="chip-pos" data-v="horas">horas</button></span></div>
      <div class="ru-uni" hidden><small>Quando</small>${chips("momento", (R.momentos || []).map((m) => [m, m]))}</div>
      <div class="pos-chips ru-extras">
        <button type="button" class="chip-pos" data-x="ataque" hidden>+ Dose de ataque</button>
        <button type="button" class="chip-pos" data-x="maxDia" hidden>+ Limite por dia</button>
        <button type="button" class="chip-pos" data-x="seDor" hidden>ou em caso de dor</button>
        <button type="button" class="chip-pos" data-x="espera24" hidden>Aguardar 24 h para iniciar os bochechos</button>
      </div>
      <div class="ru-frase ru-atq" hidden>Ataque: ${num("ataque")} <span class="ru-un" data-u="ataque"></span>${chips("atqMomento", (R.momentos || []).filter((m) => !/após/.test(m)).map((m) => [m, m]))}</div>
      <div class="ru-frase ru-max" hidden>no máximo ${num("maxDia")} <span class="ru-un" data-u="max"></span> por dia</div>
    </div>
    <div class="pos-campo"><small>Quantidade total (à direita do traço)</small><div class="ru-frase">${num("qtd")} <span class="ru-un" data-u="qtd"></span></div></div>`;
  const q = (s) => box.querySelector(s), qa = (s) => box.querySelectorAll(s);
  const conf = document.createElement("button"); conf.className = "botao"; conf.textContent = "Escrever no receituário"; conf.disabled = true;
  box.after(conf);
  const apr = () => (e.apr ? A[e.apr] : null);
  const pronto = () => e.apr && e.bloco && e.n && e.dose && (e.unica ? !!e.momento : e.intervalo && e.dur) && e.qtd && (!e.ataque || (e.ataque.dose && e.ataque.momento));
  const marcar = (k, v) => qa(`.pos-chips[data-k="${k}"] .chip-pos`).forEach((x) => x.classList.toggle("on", x.dataset.v === String(v)));
  function atualizar() {
    const a = apr(), classe = med.classe, boch = !!a?.bochecho;
    q(".ru-verbo").textContent = boch ? "Bochechar" : "Tomar";
    const un = (s, alt) => (a ? (a.frasco && alt ? RU.unidade("frasco", RU.lerNum(s)) : RU.unidade(a.un, RU.lerNum(s) || 2)) : "…");
    q('[data-u="dose"]').textContent = boch ? "mL por 1 minuto" : un(e.dose);
    q('[data-u="ataque"]').textContent = un(e.ataque?.dose);
    q('[data-u="max"]').textContent = un(e.maxDia);
    q('[data-u="qtd"]').textContent = a ? un(e.qtd, true) : "…";
    q(".ru-tomada").hidden = boch;
    if (boch && e.unica) e.unica = false;
    if (boch && !e.tomada) { e.tomada = "cada"; marcar("tomada", "cada"); }
    q(".ru-reg").hidden = !e.tomada || e.unica;
    q(".ru-uni").hidden = !e.unica;
    q('[data-x="ataque"]').hidden = classe !== "antibiotico" || e.unica || !e.tomada;
    q('[data-x="maxDia"]').hidden = boch || e.unica || !e.tomada || classe === "antibiotico";
    q('[data-x="seDor"]').hidden = !/analgesico|antiinflamatorio|opioide/.test(classe) || e.unica || !e.tomada;
    q('[data-x="espera24"]').hidden = !boch;
    q(".ru-atq").hidden = !e.ataque || e.unica;
    q(".ru-max").hidden = !q('[data-x="maxDia"]').classList.contains("on") || e.unica;
    conf.disabled = !pronto();
    aoMudar(escrita());
  }
  function escrita() {
    return { ...e, intervalo: e.unica ? "0" : e.intervalo, ataque: e.unica ? null : e.ataque, maxDia: e.unica ? "" : e.maxDia, seDor: e.unica ? false : e.seDor };
  }
  qa(".pos-chips[data-k]").forEach((g) => g.querySelectorAll(".chip-pos").forEach((b) => (b.onclick = () => {
    const k = g.dataset.k, v = b.dataset.v;
    tocar("toque");
    if (k === "tomada") { e.tomada = v; e.unica = v === "unica"; }
    else if (k === "atqMomento") { if (e.ataque) e.ataque.momento = v; }
    else e[k] = v;
    marcar(k, v); atualizar();
  })));
  marcar("durUn", "dias");
  qa("[data-x]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.x, on = !b.classList.contains("on");
    b.classList.toggle("on", on); tocar("toque");
    if (k === "ataque") e.ataque = on ? { dose: q('[data-k="ataque"]').value.trim(), momento: null } : null;
    else if (k === "maxDia") e.maxDia = on ? q('[data-k="maxDia"]').value.trim() : "";
    else e[k] = on;
    if (k === "ataque" && on) qa('[data-k="atqMomento"] .chip-pos').forEach((x) => x.classList.remove("on"));
    atualizar();
  }));
  qa("input.ru-num").forEach((inp) => (inp.oninput = () => {
    const k = inp.dataset.k, v = inp.value.replace(/[^\d,]/g, ""); if (v !== inp.value) inp.value = v;
    if (k === "ataque") { if (e.ataque) e.ataque.dose = v; }
    else e[k] = v;
    atualizar();
  }));
  if (e.apr) marcar("apr", e.apr);
  conf.onclick = () => { conf.remove(); box.querySelectorAll("button, input").forEach((x) => (x.disabled = true)); aoConfirmar(escrita()); };
  atualizar();
  return { conf };
}
/** O item como vai no formulário, a partir da escrita. */
function itemDe(e, A) {
  const a = A[e.apr];
  return { bloco: e.bloco, n: e.n || "?", med: a?.rot || "…", qtd: a ? RU.qtdTexto(a, e.qtd) : "", pos: a ? RU.frase(a, e) : "…" };
}

// ---------------- Escreva a receita ----------------
function escrever(cam) {
  const casos = embaralhar(R.casos).slice(0, 3), M = MED(), A = APR();
  let ic = 0, acertos = 0, total = 0;
  const hoje = RU.dataCurta();
  let st;
  const novoCaso = () => { st = { c: casos[ic], fase: "doc", doc: null, itens: [], im: 0, rasc: null }; };
  function dadosFolha() {
    const c = st.c, itens = st.rasc ? [...st.itens, { ...st.rasc, rascunho: true }] : st.itens;
    return { documento: st.doc || undefined, ...paraDe(c, st.doc, c.doc.controlado), blocos: RU.blocosDe(itens, MOD), data: hoje, rodape: rodape(c) };
  }
  const redesenharFolha = () => { const f = cam.corpo.querySelector(".ru-folha"); if (f) f.outerHTML = folha(dadosFolha(), { vazias: 3 }); };
  function desenhar() {
    const c = st.c;
    cam.info.textContent = `Caso ${ic + 1}/${casos.length}`;
    cam.corpo.innerHTML = `<div class="receita-jogo ru-jogo-corpo">
      <div class="contexto"><b>${escapar(c.titulo)}</b><br>${escapar(c.contexto)}</div>
      ${folha(dadosFolha(), { vazias: 3 })}
      <div class="ru-painel"></div></div>`;
    const p = cam.corpo.querySelector(".ru-painel");
    if (st.fase === "doc") return faseDoc(p);
    if (st.fase === "prateleira") return prateleira(p);
    if (st.fase === "item") return faseItem(p);
  }
  function faseDoc(p) {
    const d = st.c.doc;
    p.innerHTML = `<div class="enunciado">${escapar(d.pergunta || "Qual documento usar?")}</div><div class="opcoes"></div><div class="rx-fb"></div>`;
    const box = p.querySelector(".opcoes"), fb = p.querySelector(".rx-fb");
    for (const { t, i } of embaralhar(d.opcoes.map((t, i) => ({ t, i })))) {
      const b = document.createElement("button"); b.className = "opcao"; b.textContent = t;
      b.onclick = () => {
        const certo = i === d.certa; total++;
        if (certo) { acertos++; tocar("certo"); } else { tocar("errado"); vibrar(40); }
        box.querySelectorAll("button").forEach((x) => { x.disabled = true; if (x.textContent === d.opcoes[d.certa]) x.classList.add("correta"); });
        if (!certo) b.classList.add("incorreta");
        fb.innerHTML = feedback(certo, certo ? "Isso!" : "Não é bem assim", atual ? d.explicAtual || trocar(d.explic) : d.explic, fonteTxt(st.c.fonte) + (atual && d.explicAtual ? " · legislação atual" : ""));
        botao(fb, "Agora, os medicamentos", () => { st.doc = d.opcoes[d.certa]; st.fase = "prateleira"; desenhar(); });
      };
      box.append(b);
    }
  }
  function prateleira(p) {
    const certos = new Set(st.c.rx.map((r) => r.med)), marcados = new Set();
    p.innerHTML = `<div class="enunciado">Escolha o${certos.size > 1 ? "s" : ""} medicamento${certos.size > 1 ? "s" : ""} na prateleira <small class="sub">(toque para separar; pode ser mais de um)</small></div><div class="prateleira"></div><div class="rx-fb"></div>`;
    const box = p.querySelector(".prateleira"), fb = p.querySelector(".rx-fb");
    for (const [cl, nome] of Object.entries(R.classes)) {
      const meds = R.medicamentos.filter((m) => m.classe === cl);
      if (!meds.length) continue;
      box.insertAdjacentHTML("beforeend", `<div class="prat-cl"><small>${escapar(nome)}</small><div class="prat-itens"></div></div>`);
      const g = box.lastElementChild.querySelector(".prat-itens");
      meds.forEach((m, k) => {
        const b = document.createElement("button"); b.className = `remedio remedio-${m.classe}`; b.dataset.id = m.id; b.style.setProperty("--i", k);
        b.innerHTML = `<i class="remedio-caixa"></i><span>${escapar(m.nome)}</span>`;
        b.onclick = () => { if (marcados.has(m.id)) marcados.delete(m.id); else marcados.add(m.id); b.classList.toggle("on"); tocar("toque"); conf.disabled = !marcados.size; };
        g.append(b);
      });
    }
    const conf = document.createElement("button"); conf.className = "botao"; conf.textContent = "Separar estes"; conf.disabled = true;
    conf.onclick = () => {
      conf.remove();
      const certo = marcados.size === certos.size && [...marcados].every((id) => certos.has(id));
      total++; if (certo) { acertos++; tocar("certo"); } else { tocar("errado"); vibrar(40); }
      box.querySelectorAll(".remedio").forEach((b) => { b.disabled = true; const id = b.dataset.id; if (certos.has(id)) b.classList.add(marcados.has(id) ? "certo" : "faltou"); else if (marcados.has(id)) b.classList.add("errado"); });
      const nomes = st.c.rx.map((r) => M[r.med].nome).join(" + ");
      fb.innerHTML = feedback(certo, certo ? "Isso!" : `O caso pede: ${nomes}`, certo ? "" : "Siga com os do caso.", "");
      botao(fb, "Escrever o 1º item", () => { st.fase = "item"; st.im = 0; desenhar(); });
    };
    box.after(conf);
  }
  function faseItem(p) {
    const c = st.c, rx = c.rx[st.im], med = M[rx.med], aprCerta = A[[].concat(rx.apr)[0]];
    p.innerHTML = `<div class="ru-ed"></div><div class="rx-fb"></div>`;
    const fb = p.querySelector(".rx-fb");
    editorItem(p.querySelector(".ru-ed"), { med, aprs: med.apr, maxN: c.rx.length, titulo: `Item ${st.im + 1} de ${c.rx.length}: <b>${escapar(med.nome)}</b>` },
      (e) => { st.rasc = itemDe(e, A); redesenharFolha(); },
      (e) => {
        const apr = A[e.apr], nEsperado = st.itens.filter((x) => x.bloco === e.bloco).length + 1;
        const C = RU.conferirItem(rx, apr, aprCerta, e, { nEsperado, cirurgico: !!c.cirurgico, classe: med.classe });
        const ok = C.filter((x) => x.ok).length; total += C.length; acertos += ok;
        const res = ok === C.length ? true : ok >= C.length * 0.6 ? "meio" : false;
        tocar(res === true ? "certo" : "errado"); if (res !== true) vibrar(40);
        // no formulário fica o certo (a receita termina como modelo); se ele acertou tudo, a escrita dele
        const certa = RU.escritaCerta(rx, aprCerta);
        const nCerto = String(st.itens.filter((x) => x.bloco === rx.bloco).length + 1);
        st.rasc = null;
        st.itens.push(res === true ? itemDe(e, A) : { ...itemDe({ ...certa, n: nCerto }, A) });
        redesenharFolha();
        fb.innerHTML = feedback(res, res === true ? "Item certo!" : `${ok} de ${C.length} certos`, rx.explic || "", fonteTxt(c.fonte), listaConferida(C));
        const ultimo = st.im + 1 >= c.rx.length;
        botao(fb, ultimo ? "Ver a receita pronta" : "Próximo item", () => { if (!ultimo) { st.im++; desenhar(); } else pronta(); });
      });
  }
  function pronta() {
    st.fase = "pronta"; desenhar();
    const p = cam.corpo.querySelector(".ru-painel");
    cam.corpo.querySelector(".receituario").classList.add("carimbo");
    p.innerHTML = `<p class="sub rx-pronta">Receita completa. ${escapar(fonteTxt(st.c.fonte))}.${st.c.duvida ? ` <small>(${escapar(st.c.duvida)})</small>` : ""}</p>`;
    tocar("par");
    botao(p, ic + 1 < casos.length ? "Próximo caso" : "Ver resultado", () => { ic++; if (ic < casos.length) { novoCaso(); desenhar(); } else fim(); });
    cam.corpo.scrollTop = 0;
  }
  function fim() {
    terminar(cam, "receita", acertos, { xp: Math.round(acertos * 0.6), moedas: Math.round(acertos * 0.3) },
      `<p class="sub">${acertos} de ${total} campos certos (documento, medicamentos e cada campo de cada item).</p>${lembrete()}`, "acertos");
  }
  novoCaso(); desenhar();
}

// ---------------- Ache o erro ----------------
function acheErro(cam) {
  const base = R.erros.map((e) => ({ ...e, explic: trocar(e.explic) }));
  const itens = atual ? embaralhar([...embaralhar(R.atual.erros).slice(0, 2), ...embaralhar(base).slice(0, 4)]) : embaralhar(base).slice(0, 6);
  let i = 0, acertos = 0;
  function desenhar() {
    const e = itens[i];
    cam.info.textContent = `${i + 1}/${itens.length}`;
    cam.corpo.innerHTML = `<div class="receita-jogo ru-jogo-corpo">
      <div class="enunciado">Toque no pedaço da receita que está errado.</div>
      ${e.nota ? `<div class="contexto">${escapar(e.nota)}</div>` : ""}
      ${folha({ ...e, documento: `Documento: ${e.documento}`, rodape: rodape() }, { toque: true, vazias: 0 })}
      <div class="rx-fb"></div></div>`;
    const fb = cam.corpo.querySelector(".rx-fb"), botoes = [...cam.corpo.querySelectorAll(".ru-toque")];
    for (const b of botoes) b.onclick = () => {
      const certo = b.dataset.alvo === e.errada;
      if (certo) { acertos++; tocar("certo"); } else { tocar("errado"); vibrar(40); }
      botoes.forEach((x) => { x.disabled = true; if (x.dataset.alvo === e.errada) x.classList.add("errada-certa"); });
      if (!certo) b.classList.add("escolha-errada");
      fb.innerHTML = feedback(certo, certo ? "Achou!" : "O erro estava em outro pedaço", e.explic, fonteTxt(e.fonte));
      botao(fb, i + 1 < itens.length ? "Próxima" : "Ver resultado", () => { i++; i < itens.length ? desenhar() : fim(); });
    };
  }
  function fim() {
    terminar(cam, "receita", acertos * 2, { xp: acertos * 2, moedas: acertos }, `<p class="sub">${acertos} de ${itens.length} erros encontrados.</p>${lembrete()}`, "pontos");
  }
  desenhar();
}

// ---------------- Pediátrica ----------------
// A conta (peso, gotas ou mL) e depois a receita escrita no formulário. Dados: doses-andrade.json → criancas
// (Andrade, cap. 14): dipirona ½ gota/kg a cada 4 h, paracetamol e ibuprofeno 50 mg/mL 1 gota/kg a cada 6 h, por até
// 24 h; amoxicilina suspensão, manutenção a cada 8 h por 3 dias com reavaliação.
const NOMES = [["Helena", "F"], ["Lucas", "M"], ["Sofia", "F"], ["Miguel", "M"], ["Alice", "F"], ["Davi", "M"], ["Laura", "F"], ["Théo", "M"], ["Manuela", "F"], ["Gael", "M"]];
const SOBRE = ["Costa", "Souza", "Lima", "Prado", "Rocha", "Alves", "Nunes", "Reis"];
const APR_GOTAS = { dipirona: ["dipirona", "dip-gotas", 4], paracetamol: ["paracetamol", "para-gotas", 6], ibuprofeno: ["ibuprofeno", "ibu-gotas50", 6] };
const sorteia = (a) => a[Math.floor(Math.random() * a.length)];
const nn = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
function opcoesNum(certo, distratores, fmt) {
  const vistos = new Set([fmt(certo)]), out = [fmt(certo)];
  for (const d of distratores) { if (!(d > 0) || out.length >= 4) continue; const s = fmt(d); if (!vistos.has(s)) { vistos.add(s); out.push(s); } }
  let k = 1.35;
  while (out.length < 4) { const s = fmt(certo * k); if (!vistos.has(s)) { vistos.add(s); out.push(s); } k += 0.27; }
  return { certa: fmt(certo), opcoes: embaralhar(out) };
}
function casosPediatricos(C) {
  const out = [], kgDe = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), docs = R.documentos;
  const gotas = embaralhar(C.gotas.filter((g) => APR_GOTAS[g.id])).slice(0, 2);
  for (const g of gotas) {
    const [nome, sexo] = sorteia(NOMES), sem = Math.random() < 0.5;
    // com balança, o peso é sorteado e a idade sai perto do peso esperado (idade × 2 + 9)
    let kg = sem ? 0 : kgDe(13, g.id === "ibuprofeno" ? 29 : 31), idade = sem ? kgDe(3, 10) : Math.max(2, Math.round((kg - 9) / 2) + kgDe(-1, 1));
    if (sem) kg = idade * 2 + 9;
    const [med, apr, h] = APR_GOTAS[g.id], bruto = kg * g.gotaKg, n = Math.floor(bruto);
    const passos = [];
    if (sem) passos.push({ pergunta: "Sem balança: qual é o peso aproximado?", ...opcoesNum(kg, [idade * 2, idade * 3 + 9, idade + 9], (x) => `${Math.round(x)} kg`),
      explic: `Peso ≈ (idade × 2) + 9 = (${idade} × 2) + 9 = ${kg} kg (Andrade, Quadro 14.4).` });
    passos.push({ pergunta: `Quantas gotas de ${g.curto} por dose?`, ...opcoesNum(n, [kg * (g.gotaKg === 1 ? 0.5 : 1), kg * 2, n + 5], (x) => `${Math.floor(x)} gotas`),
      explic: `${kg} kg × ${g.gotaKg === 0.5 ? "½" : "1"} gota/kg = ${nn(bruto)} → ${n} gotas${bruto % 1 ? " (arredondando para baixo; " + Math.ceil(bruto) + " também passa)" : ""}.${g.obs ? " " + g.obs : ""}` });
    out.push({ titulo: `Dor depois da exodontia · ${g.curto}`,
      paciente: { nome: `${nome} ${sorteia(SOBRE)} (menor)`, idade, sexo, peso: kg },
      contexto: `${nome}, ${idade} anos${sem ? ", sem balança no consultório (biótipo normal)" : `, ${kg} kg`}. Exodontia de um decíduo; a 1ª dose foi dada no consultório. Prescreva ${g.nome[0].toLowerCase() + g.nome.slice(1)}, ${g.gotaKg === 0.5 ? "½ gota" : "1 gota"} por kg ${g.intervalo}, pelas 24 h depois do procedimento.`,
      fonte: { unidade: "f14-02", pagina: g.id === "ibuprofeno" ? 159 : 156 }, passos,
      doc: { pergunta: "Qual documento usar?", opcoes: docs, certa: 0, explic: "Analgésico comum, nem antimicrobiano nem controlado: receita comum." },
      rx: [{ med, apr, bloco: "interno", dose: [n, Math.max(n, Math.ceil(bruto))], intervalo: h, duracao: { n: 24, un: "horas" },
        explic: `${g.nome}: ${n} gotas a cada ${h} horas por 24 horas; a quantidade é 01 frasco.` }] });
  }
  { // amoxicilina suspensão
    const A = C.amoxicilina, kg = sorteia([15, 20, 25, 30]), susp = sorteia(A.suspensoes), mgKg = A.manutencao[1], mg = kg * mgKg, ml = mg / (susp / 5);
    const [nome, sexo] = sorteia(NOMES), idade = Math.max(3, Math.round((kg - 9) / 2));
    out.push({ titulo: "Abscesso com disseminação · amoxicilina",
      paciente: { nome: `${nome} ${sorteia(SOBRE)} (menor)`, idade, sexo, peso: kg },
      contexto: `${nome}, ${idade} anos, ${kg} kg. Abscesso de origem endodôntica com sinais de disseminação; drenado hoje. Manutenção: amoxicilina suspensão oral ${susp} mg/5 mL, ${mgKg} mg/kg a cada 8 h, por 3 dias (com reavaliação antes de 72 h).`,
      fonte: { unidade: "f14-02", pagina: 159 },
      passos: [{ pergunta: "Quantos mL em cada dose?", ...opcoesNum(ml, [mg / susp, ml * 2, mg / (susp / 5 * 2)], (x) => `${nn(x)} mL`),
        explic: `${kg} kg × ${mgKg} mg/kg = ${mg} mg. A suspensão de ${susp} mg/5 mL tem ${nn(susp / 5)} mg/mL: ${mg} ÷ ${nn(susp / 5)} = ${nn(ml)} mL.` }],
      doc: { pergunta: "Qual documento usar?", opcoes: docs, certa: 1, explic: R.casos.find((c) => c.id === "amox-crianca")?.doc.explic || "Antimicrobiano: 2 vias, com idade e sexo." },
      rx: [{ med: "amoxicilina", apr: `amox-susp${susp}`, bloco: "interno", dose: ml, intervalo: 8, duracao: { n: 3, un: "dias" }, ataque: null,
        explic: `Para criança, suspensão com a concentração escrita (existem 125, 200, 250, 400 e 500 mg/5 mL). ${nn(ml)} mL a cada 8 horas por 3 dias; a quantidade é 01 frasco.` }] });
  }
  return out;
}
function pediatrica(cam, C) {
  const casos = casosPediatricos(C), M = MED(), A = APR();
  let ic = 0, ip = 0, acertos = 0, total = 0, doc = null, feito = null, fase = "conta";
  const hoje = RU.dataCurta();
  calculadora(cam, "pediatrica");
  function dados(rasc) {
    const c = casos[ic], itens = feito ? [feito] : rasc ? [{ ...rasc, rascunho: true }] : [];
    return { documento: doc || undefined, ...paraDe(c, doc, false), blocos: RU.blocosDe(itens, MOD), data: hoje, rodape: rodape({ clinica: "Odontopediatria" }) };
  }
  function desenhar() {
    const c = casos[ic];
    cam.info.textContent = `Caso ${ic + 1}/${casos.length}`;
    cam.corpo.innerHTML = `<div class="receita-jogo ru-jogo-corpo">
      <div class="contexto"><b>${escapar(c.titulo)}</b><br>${escapar(c.contexto)}</div>
      ${fase === "conta" ? "" : folha(dados(), { vazias: 3 })}
      <div class="ru-painel"></div></div>`;
    const p = cam.corpo.querySelector(".ru-painel");
    if (fase === "conta") return pergunta(p, c.passos[ip], () => { ip++; if (ip >= c.passos.length) fase = "doc"; desenhar(); }, "Próximo passo");
    if (fase === "doc") return pergunta(p, { pergunta: c.doc.pergunta, opcoes: c.doc.opcoes, certa: c.doc.opcoes[c.doc.certa], explic: c.doc.explic }, () => { doc = c.doc.opcoes[c.doc.certa]; fase = "item"; desenhar(); }, "Escrever a receita");
    const rx = c.rx[0], med = M[rx.med], aprCerta = A[rx.apr];
    // a conta já foi: a calculadora encolhe para o editor aparecer (o "mostrar" traz de volta)
    const calc = cam.raiz.querySelector(".calc");
    if (calc && !calc.classList.contains("mini")) { calc.classList.add("mini"); const b = calc.querySelector(".calc-min"); if (b) b.textContent = "mostrar"; }
    p.innerHTML = `<div class="ru-ed"></div><div class="rx-fb"></div>`;
    const fb = p.querySelector(".rx-fb");
    editorItem(p.querySelector(".ru-ed"), { med, aprs: med.apr, maxN: 1, fixo: { n: "1" }, titulo: `Escreva: <b>${escapar(med.nome)}</b>` },
      (e) => { const f = cam.corpo.querySelector(".ru-folha"); if (f) f.outerHTML = folha(dados(itemDe(e, A)), { vazias: 3 }); },
      (e) => {
        const Cf = RU.conferirItem(rx, A[e.apr], aprCerta, e, { nEsperado: 1, classe: med.classe });
        const ok = Cf.filter((x) => x.ok).length; total += Cf.length; acertos += ok;
        const res = ok === Cf.length ? true : ok >= Cf.length * 0.6 ? "meio" : false;
        tocar(res === true ? "certo" : "errado"); if (res !== true) vibrar(40);
        feito = res === true ? itemDe(e, A) : itemDe({ ...RU.escritaCerta(rx, aprCerta), n: "1" }, A);
        const f = cam.corpo.querySelector(".ru-folha"); if (f) f.outerHTML = folha(dados(), { vazias: 3 });
        cam.corpo.querySelector(".receituario")?.classList.add("carimbo");
        fb.innerHTML = feedback(res, res === true ? "Receita certa!" : `${ok} de ${Cf.length} certos`, rx.explic, fonteTxt(c.fonte), listaConferida(Cf));
        botao(fb, ic + 1 < casos.length ? "Próximo caso" : "Ver resultado", () => { ic++; ip = 0; doc = null; feito = null; fase = "conta"; ic < casos.length ? desenhar() : fim(); });
      });
  }
  function pergunta(p, pg, seguir, txtSeguir) {
    p.innerHTML = `<div class="enunciado">${escapar(pg.pergunta)}</div><div class="opcoes"></div><div class="rx-fb"></div>`;
    const box = p.querySelector(".opcoes"), fb = p.querySelector(".rx-fb");
    for (const op of embaralhar(pg.opcoes)) {
      const b = document.createElement("button"); b.className = "opcao"; b.textContent = op;
      b.onclick = () => {
        const certo = op === pg.certa; total++;
        if (certo) { acertos++; tocar("certo"); } else { tocar("errado"); vibrar(40); }
        box.querySelectorAll("button").forEach((x) => { x.disabled = true; if (x.textContent === pg.certa) x.classList.add("correta"); });
        if (!certo) b.classList.add("incorreta");
        fb.innerHTML = feedback(certo, certo ? "Isso!" : `Era ${pg.certa}`, pg.explic, "");
        botao(fb, txtSeguir, seguir);
      };
      box.append(b);
    }
  }
  function fim() {
    terminar(cam, "receita", acertos, { xp: Math.round(acertos * 0.6), moedas: Math.round(acertos * 0.3) },
      `<p class="sub">${acertos} de ${total} certos (contas, documento e cada campo da receita).</p><div class="cartao revisao-jogo"><b>Lembrete do Andrade</b><ul>${["Sem balança: peso ≈ idade × 2 + 9.", "Dipirona “gotas” (500 mg/mL): ½ gota/kg a cada 4 h; paracetamol (200 mg/mL) e ibuprofeno (50 mg/mL): 1 gota/kg a cada 6 h; por até 24 h.", "Amoxicilina em crianças: manutenção de 15 a 20 mg/kg a cada 8 h; mL = mg ÷ (mg da suspensão ÷ 5).", "Gotas e suspensões vão em frasco: quantidade 01 frasco."].map((t) => `<li>${escapar(t)}</li>`).join("")}</ul><small class="sub">${escapar(C.fonte?.texto || "")}</small></div>`, "acertos");
  }
  desenhar();
}
