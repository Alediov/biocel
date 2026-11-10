// Receituário da Clínica Odontológica da UNIOESTE (Cód. OD-0003; modelo em extras/jogos/receituario-unioeste.json,
// pedido do Alediov, 04/11/2026). Desenha o formulário em HTML, em branco ou preenchido, na tinta azul do impresso, e
// guarda as contas e a conferência das linhas (puras, sem DOM: `node tools/teste_receituario.mjs`).
// Os jogos do Receituário (receita.js) usam este desenho; o PDF do simulado (tools/simulado/montar_pdf.py) imita o
// mesmo formulário em preto e branco.
//
// Dados de uma receita preenchida:
//   { documento?, para, paraExtra?, blocos: [{ uso, via, itens: [{ n, med, qtd, pos }] }], data, rodape? }
// Cada pedaço tocável tem um alvo: "doc", "para", "b<i>" (a linha do bloco), "b<i>i<j>m" (número e medicamento),
// "b<i>i<j>q" (quantidade), "b<i>i<j>p" (orientação), "data" e "rodape".

/** Espelho do JSON, para desenhar mesmo antes de o extra chegar (o JSON é a referência). */
export const PADRAO = {
  codigo: "OD-0003",
  cabecalho: { instituicao: ["unioeste", "Universidade Estadual do Oeste do Paraná", "Clínica Odontológica", "Rua Arquitetura, s/n - Jardim Universitário"], titulo: "Receituário" },
  corpo: { para: "Para:", data: "Data:" },
  rodape: {
    clinica: { titulo: "Clínica Odontológica", fone: "(45) 3220-3241", campos: ["Disciplina", "Professor", "Aluno(a)"], marcar: ["Graduação", "Pós-Graduação"] },
    ceo: { titulo: "Centro de Especialidades Odontológicas", fone: "(45) 3220-3170", campos: ["Especialidade", "Profissional"] },
    codigo: "Cód: OD-0003",
  },
  blocos: [{ id: "interno", uso: "Uso Interno", via: "Via Oral" }, { id: "externo", uso: "Uso Externo", via: "Bochecho" }],
};

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Põe o receituario.css (uma vez). Resolve quando carregou. */
export function garantirCss() {
  if (typeof document === "undefined") return Promise.resolve();
  const ja = document.querySelector('link[href="receituario.css"]');
  if (ja) return ja._pronto || Promise.resolve();
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "receituario.css";
  l._pronto = new Promise((ok) => { l.onload = ok; l.onerror = ok; setTimeout(ok, 1500); });
  document.head.append(l);
  return l._pronto;
}

// ---------------- desenho ----------------
/** Uma linha tocável (botão) ou não (div), com o alvo e as classes de estado (`marcas[alvo]`). */
function pedaco(alvo, classe, html, o) {
  const marca = o.marcas?.[alvo] || "", atual = o.atual === alvo ? " atual" : "";
  if (o.toque) return `<button type="button" class="ru-toque ${classe} ${marca}${atual}" data-alvo="${alvo}">${html}</button>`;
  return `<div class="${classe} ${marca}${atual}" data-alvo="${alvo}">${html}</div>`;
}

/**
 * HTML do receituário. `d` = dados da receita (ou nada: em branco). Opções: `modelo` (o JSON; sem ele, PADRAO),
 * `toque` (cada pedaço vira botão com data-alvo), `marcas` {alvo: classe}, `atual` (alvo em edição), `vazias`
 * (linhas de escrever no corpo em branco), `classe` extra.
 */
export function receituarioHTML(d = null, o = {}) {
  const M = o.modelo || PADRAO, cab = M.cabecalho || PADRAO.cabecalho, rod = M.rodape || PADRAO.rodape, corpo = M.corpo || PADRAO.corpo;
  const r = d?.rodape || {};
  const tinta = (t) => t ? `<span class="ru-tinta">${esc(t)}</span>` : "";
  const [sigla, ...inst] = cab.instituicao;
  let miolo = "";
  (d?.blocos || []).forEach((b, i) => {
    miolo += pedaco(`b${i}`, "ru-l ru-bloco", `<span class="ru-tinta">${esc(b.uso)}</span><i class="ru-traco"></i><span class="ru-tinta">${esc(b.via)}</span>`, o);
    (b.itens || []).forEach((it, j) => {
      const k = `b${i}i${j}`, rasc = it.rascunho ? " ru-rascunho" : "";
      miolo += `<div class="ru-item${rasc}${o.atual === k ? " atual" : ""}">`
        + `<div class="ru-l ru-linha-med">${pedaco(`${k}m`, "ru-med", `<span class="ru-tinta"><b class="ru-n">${esc(it.n ?? "?")}|</b> ${esc(it.med || "…")}</span>`, o)}${pedaco(`${k}q`, "ru-qtd", it.qtd ? tinta(it.qtd) : '<span class="ru-tinta ru-falta">?</span>', o)}</div>`
        + pedaco(`${k}p`, "ru-l ru-pos", `<span class="ru-tinta">${esc(it.pos || "…")}</span>`, o)
        + `</div>`;
    });
  });
  if (!d?.blocos?.length && o.vazias !== 0) miolo += `<div class="ru-vazio">${"<i></i>".repeat(o.vazias || 7)}</div>`;
  const marcado = (k) => (r.nivel || "graduacao") === k && (d || r.nivel) ? "☒" : "☐";
  const campo = (rot, v) => `<span class="ru-campo"><span>${esc(rot)}:</span>${tinta(v)}</span>`;
  const doc = d?.documento ? pedaco("doc", "ru-doc", `<span>${esc(d.documento)}</span>`, o) : "";
  return `<div class="ru-folha ${o.classe || ""}">${doc}<div class="receituario" role="group" aria-label="${esc(cab.titulo)} da UNIOESTE">
    <header class="ru-cab"><div class="ru-inst"><b class="ru-sigla">${esc(sigla)}</b>${inst.map((t, k) => `<span class="${k === 1 ? "ru-cl" : ""}">${esc(t)}</span>`).join("")}</div><div class="ru-tit">${esc(cab.titulo)}</div></header>
    <div class="ru-corpo">
      ${pedaco("para", "ru-l ru-para", `<span class="ru-rot">${esc(corpo.para)}</span> ${tinta(d?.para)}${d?.paraExtra ? ` <span class="ru-tinta ru-extra">· ${esc(d.paraExtra)}</span>` : ""}`, o)}
      ${miolo}
      ${pedaco("data", "ru-l ru-data", `<span class="ru-rot">${esc(corpo.data)}</span> ${tinta(d?.data)}`, o)}
    </div>
    <footer class="ru-rod">
      ${pedaco("rodape", "ru-caixa", `<b>${esc(rod.clinica.titulo)}</b><small>Fone ${esc(rod.clinica.fone)}</small>${campo(rod.clinica.campos[0], r.disciplina)}${campo(rod.clinica.campos[1], r.professor)}${campo(rod.clinica.campos[2], r.aluno)}<span class="ru-marcar"><span>${marcado("graduacao")} ${esc(rod.clinica.marcar[0])}</span><span>${marcado("pos")} ${esc(rod.clinica.marcar[1])}</span></span>`, { ...o, toque: false })}
      <div class="ru-caixa"><b>${esc(rod.ceo.titulo)}</b><small>Fone ${esc(rod.ceo.fone)}</small>${campo(rod.ceo.campos[0], r.especialidade)}${campo(rod.ceo.campos[1], r.profissional)}</div>
    </footer>
    <div class="ru-cod">${esc(rod.codigo)}</div>
  </div></div>`;
}

/** Data de hoje (ou de `d`) como no formulário: DD/MM/AA. */
export function dataCurta(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${p(d.getFullYear() % 100)}`;
}

// ---------------- contas e textos ----------------
const PLURAL = { "cápsula": "cápsulas", "comprimido": "comprimidos", "gota": "gotas", "mL": "mL", "frasco": "frascos", "dia": "dias", "hora": "horas" };
/** Unidade no singular ou no plural pelo número. */
export const unidade = (un, n) => (n === 1 || n === "1" ? un : PLURAL[un] || un + "s");
/** Número escrito por ele → valor (aceita vírgula). NaN se não for número. */
export function lerNum(s) {
  const t = String(s ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
/** Zero à esquerda nos números inteiros de um algarismo (01, 08, 07). */
export const comZero = (n) => (Number.isInteger(n) && n < 10 ? `0${n}` : String(n).replace(".", ","));
/** Escrito sem o zero à esquerda? (só inteiros de um algarismo; "7,5" não conta) */
export function semZero(s) {
  const t = String(s ?? "").trim();
  return /^\d$/.test(t);
}

/**
 * Orientação montada pelo que ele escreveu. `apr` = apresentação ({ un, bochecho }); `e` = escrita:
 * { dose, intervalo (0 = dose única), dur, durUn ("dias" | "horas"), momento, ataque ({ dose, momento } | null),
 *   seDor, espera24, maxDia } — os números como ele digitou (texto), para o zero à esquerda aparecer.
 */
export function frase(apr, e) {
  const v = (s) => (s == null || s === "" ? "__" : String(s).trim());
  const un = (s) => unidade(apr.un, lerNum(s));
  const dur = () => `durante ${v(e.dur)} ${e.durUn || "dias"}`;
  if (apr.bochecho) {
    return `Bochechar ${v(e.dose)} mL por 1 minuto, a cada ${v(e.intervalo)} horas, ${dur()}.`
      + (e.espera24 ? " Aguardar 24 horas após o procedimento cirúrgico para iniciar os bochechos." : "");
  }
  if (String(e.intervalo) === "0" || e.intervalo === "unica") return `Tomar ${v(e.dose)} ${un(e.dose)}, em dose única, ${(e.momento || "…").toLowerCase()}.`;
  const max = e.maxDia ? `, no máximo ${v(e.maxDia)} ${unidade(apr.un, lerNum(e.maxDia))} por dia` : "";
  const manut = `${v(e.dose)} ${un(e.dose)} a cada ${v(e.intervalo)} horas, ${dur()}${max}${e.seDor ? ", ou em caso de dor" : ""}.`;
  if (e.ataque) return `Tomar ${v(e.ataque.dose)} ${un(e.ataque.dose)} ${(e.ataque.momento || "…").toLowerCase()}. Depois, ${manut}`;
  return `Tomar ${manut}`;
}

/** Quantas tomadas a posologia dá (sem a dose de ataque), ou NaN. */
export function tomadas(e) {
  if (String(e.intervalo) === "0" || e.intervalo === "unica") return 1;
  const h = lerNum(e.intervalo), dur = lerNum(e.dur);
  if (!(h > 0) || !(dur > 0)) return NaN;
  if (e.durUn === "horas") return Math.floor(dur / h);
  let porDia = 24 / h;
  const max = lerNum(e.maxDia);
  if (max > 0) porDia = Math.min(porDia, max);
  return porDia * dur;
}

/** Total do tratamento em unidades (doses × tomadas + ataque), ou NaN. */
export function totalDe(e) {
  const dose = lerNum(e.dose), n = tomadas(e);
  if (!(dose > 0) || !(n > 0)) return NaN;
  return dose * n + (e.ataque ? lerNum(e.ataque.dose) || 0 : 0);
}

/** A conta escrita por extenso, para a explicação. */
export function contaTexto(apr, e) {
  const n = tomadas(e), dose = lerNum(e.dose), t = totalDe(e);
  if (!(t > 0)) return "";
  const u = (x) => `${comZero(x)} ${unidade(apr.un, x)}`;
  let base;
  if (String(e.intervalo) === "0") base = `dose única de ${u(dose)}`;
  else if (e.durUn === "horas") base = `${u(dose)} a cada ${comZero(lerNum(e.intervalo))} horas por ${lerNum(e.dur)} horas = ${n} tomadas`;
  else base = `${u(dose)} × ${n / lerNum(e.dur)} por dia × ${comZero(lerNum(e.dur))} dias`;
  const atq = e.ataque ? ` + ${u(lerNum(e.ataque.dose))} da dose de ataque` : "";
  return `${base}${atq} = ${u(t)}`;
}

/** Dose dentro do certo ("1" ou [mín, máx]). */
export const doseOk = (certa, v) => (Array.isArray(certa) ? v >= certa[0] - 1e-9 && v <= certa[1] + 1e-9 : Math.abs(v - certa) < 1e-9);
export const doseTxt = (certa, un) => (Array.isArray(certa) && certa[0] !== certa[1] ? `${comZero(certa[0])} a ${comZero(certa[1])} ${unidade(un, certa[1])}` : `${comZero([].concat(certa)[0])} ${unidade(un, [].concat(certa)[0])}`);

/**
 * Confere um item escrito, campo a campo. `rx` = o gabarito do caso; `apr` = a apresentação escolhida;
 * `aprCerta` = a do gabarito; `e` = escrita ({ apr, bloco, n, dose, intervalo, dur, durUn, momento, ataque,
 * seDor, espera24, maxDia, qtd }); `ctx` = { nEsperado, cirurgico, classe }.
 * Devolve [{ campo, ok, certo, explic }].
 */
export function conferirItem(rx, apr, aprCerta, e, ctx = {}) {
  const C = [];
  const add = (campo, ok, certo, explic = "") => C.push({ campo, ok: !!ok, certo, explic });
  const aprs = [].concat(rx.apr);
  add("Concentração e forma", aprs.includes(e.apr), aprCerta.rot || aprCerta.txt,
    aprs.includes(e.apr) ? "" : `O caso pede ${aprCerta.rot}${aprCerta.forma ? ` (${aprCerta.forma})` : ""}.`);
  const blocoCerto = rx.bloco === "externo" ? "Uso Externo · Bochecho" : "Uso Interno · Via Oral";
  add("Bloco de uso", e.bloco === rx.bloco, blocoCerto,
    rx.bloco === "externo" ? "Não é deglutido (bochecho, sublingual, tópico): Uso Externo." : "É deglutido (comprimido, cápsula, solução oral, suspensão): Uso Interno.");
  add("Numeração", String(e.n) === String(ctx.nEsperado), `${ctx.nEsperado}|`,
    `A numeração recomeça em cada bloco: este é o ${ctx.nEsperado}º do ${e.bloco === "externo" ? "Uso Externo" : "Uso Interno"}.`);
  const un = aprCerta.un;
  const dose = lerNum(e.dose);
  add("Dose", doseOk(rx.dose, dose), doseTxt(rx.dose, un));
  const unica = rx.intervalo === 0, ehUnica = String(e.intervalo) === "0";
  if (unica) {
    add("Dose única", ehUnica, "em dose única");
    add("Quando tomar", ehUnica && (rx.momento || []).includes(e.momento), (rx.momento || [])[0] || "");
  } else {
    add("Intervalo", !ehUnica && lerNum(e.intervalo) === rx.intervalo, `a cada ${comZero(rx.intervalo)} horas`);
    const d = rx.duracao || {};
    add("Duração", !ehUnica && lerNum(e.dur) === d.n && (e.durUn || "dias") === (d.un || "dias"), `${comZero(d.n)} ${d.un || "dias"}`);
  }
  if (rx.ataque !== undefined || ctx.classe === "antibiotico") {
    const a = rx.ataque, tem = !!e.ataque && !ehUnica;
    const ok = a ? tem && lerNum(e.ataque.dose) === a.dose && (a.momento || []).includes(e.ataque.momento) : !tem;
    add("Dose de ataque", ok, a ? `${comZero(a.dose)} ${unidade(un, a.dose)} ${(a.momento || [])[0] || ""}` : "sem dose de ataque");
  }
  if (rx.maxDia) add("Limite por dia", lerNum(e.maxDia) === rx.maxDia, `no máximo ${comZero(rx.maxDia)} por dia`);
  if (apr.bochecho && ctx.cirurgico) add("Esperar 24 h", !!e.espera24, "Aguardar 24 horas após o procedimento cirúrgico para iniciar os bochechos",
    "Depois de cirurgia, nada de bochechos nas primeiras 24 h (Andrade, p. 107 e 118); no modelo da clínica, isso vai na própria orientação.");
  // zeros à esquerda: em todos os números inteiros de um algarismo que ele escreveu
  const nums = [e.dose, ehUnica ? null : e.intervalo, ehUnica ? null : e.dur, e.qtd, e.ataque?.dose, e.maxDia].filter((s) => s != null && s !== "");
  const faltam = nums.filter(semZero);
  add("Zeros à esquerda", !faltam.length, faltam.length ? faltam.map((s) => `0${String(s).trim()}`).join(", ") : "ok",
    "No modelo da clínica, número de um algarismo leva zero à esquerda (01 cápsula, 08 horas, 07 dias, 01 frasco).");
  // quantidade: o total do que ele mesmo escreveu (a conta), ou 01 frasco
  const q = lerNum(e.qtd);
  if (aprCerta.frasco) {
    add("Quantidade", q === 1, "01 frasco", "Gotas, suspensão e bochecho vão em frasco: a quantidade é 01 frasco.");
  } else {
    const t = totalDe(e);
    add("Quantidade", t > 0 && q === t, t > 0 ? `${comZero(t)} ${unidade(un, t)}` : "o total da posologia",
      t > 0 ? `A quantidade é o total do tratamento: ${contaTexto(aprCerta, e)}.` : "Complete a posologia para dar a conta.");
  }
  return C;
}

/** A escrita certa de um item do gabarito (para o teste e para mostrar a resposta). */
export function escritaCerta(rx, apr) {
  const dose = Array.isArray(rx.dose) ? rx.dose[0] : rx.dose;
  const e = {
    apr: [].concat(rx.apr)[0], bloco: rx.bloco, dose: comZero(dose),
    intervalo: rx.intervalo === 0 ? "0" : comZero(rx.intervalo),
    dur: rx.duracao ? comZero(rx.duracao.n) : "", durUn: rx.duracao?.un || "dias",
    momento: (rx.momento || [])[0] || null,
    ataque: rx.ataque ? { dose: comZero(rx.ataque.dose), momento: rx.ataque.momento[0] } : null,
    maxDia: rx.maxDia ? comZero(rx.maxDia) : "", espera24: !!rx.espera24, seDor: !!rx.seDor,
  };
  e.qtd = apr.frasco ? "01" : comZero(totalDe(e));
  return e;
}

/** Texto da quantidade como vai no formulário. */
export function qtdTexto(apr, s) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return `${t} ${apr.frasco ? unidade("frasco", lerNum(t)) : unidade(apr.un, lerNum(t))}`;
}

/** Monta os blocos do formulário a partir dos itens escritos ({ bloco, n, med, qtd, pos }): Interno, depois Externo. */
export function blocosDe(itens, modelo = PADRAO) {
  const out = [];
  for (const b of modelo.blocos || PADRAO.blocos) {
    const its = itens.filter((x) => x.bloco === b.id);
    if (its.length) out.push({ uso: b.uso, via: b.via, itens: its });
  }
  return out;
}
