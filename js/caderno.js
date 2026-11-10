// Caderno clínico (pedido do Alediov, 25/10/2026): o que ele observou, auxiliou ou fez nas atividades práticas (CEO,
// HUOP, LAPERIO, Mestrado, clínicas), SEM dados de paciente: só o procedimento, o papel, o local, a data, o que
// aprendeu e a dúvida para estudar. Conta por procedimento e por papel, horas por local (pela Agenda) e monta um
// resumo para o currículo. As dúvidas abertas vão para o simulado impresso da madrugada (gerador/SIMULADO.md).
// Estado em E().caderno = { registros: [{ id, data, local, ocorrencia?, horas?, procs: [{ id, papel, n }], aprendi,
// duvida, duvidaOk? }] } (sincroniza entre aparelhos com o resto do progresso).
import { E, salvar, hojeISO, ganhar } from "./estado.js";
import { escapar, toast, modal, dataBR } from "./ui.js";

export const GRUPOS = [
  { id: "cir", nome: "Cirurgia", procs: [
    ["exo", "Exodontia simples"], ["exo-res", "Exodontia de resto radicular"], ["exo-3m", "Exodontia de 3º molar"], ["exo-3m-inc", "3º molar incluso ou semi-incluso"],
    ["exo-mult", "Exodontias múltiplas"], ["alveolo", "Alveoloplastia"], ["ulect", "Ulectomia/ulotomia"], ["frenec", "Frenectomia"],
    ["biopsia-inc", "Biópsia incisional"], ["biopsia-exc", "Biópsia excisional"], ["sutura", "Sutura"], ["remover-sut", "Remoção de sutura"],
    ["drenagem", "Drenagem de abscesso"], ["alveolite", "Tratamento de alveolite"], ["implante", "Implante"], ["enxerto", "Enxerto ósseo"],
  ] },
  { id: "anest", nome: "Anestesia", procs: [
    ["a-ai", "Alveolar inferior (direta)"], ["a-ai-ind", "Alveolar inferior (indireta)"], ["a-bucal", "Bucal"], ["a-mentual", "Mentual/incisivo"],
    ["a-gow", "Gow-Gates"], ["a-vazirani", "Vazirani-Akinosi"], ["a-asp", "Alveolar superior posterior"], ["a-asm", "Alveolar superior média"],
    ["a-asa", "Alveolar superior anterior"], ["a-infra", "Infraorbital"], ["a-naso", "Nasopalatino"], ["a-palat", "Palatino maior"],
    ["a-infil", "Infiltrativa (supraperiosteal)"], ["a-intralig", "Intraligamentar"],
  ] },
  { id: "perio", nome: "Periodontia", procs: [
    ["periograma", "Periograma (sondagem)"], ["rasp-supra", "Raspagem supragengival"], ["rar", "Raspagem e alisamento radicular"], ["profilaxia", "Profilaxia"],
    ["oho", "Orientação de higiene oral"], ["gengivec", "Gengivectomia"], ["retalho", "Cirurgia a retalho"], ["aumento-coroa", "Aumento de coroa clínica"],
    ["enxerto-gengival", "Enxerto gengival"], ["manut-perio", "Manutenção periodontal"],
  ] },
  { id: "diag", nome: "Diagnóstico", procs: [
    ["anamnese", "Anamnese"], ["exame", "Exame clínico extra e intraoral"], ["rx-peri", "Radiografia periapical"], ["rx-inter", "Radiografia interproximal"],
    ["rx-pano", "Interpretação de panorâmica"], ["tc", "Interpretação de tomografia"], ["pressao", "Aferição de pressão arterial"], ["glicemia", "Glicemia capilar"],
  ] },
  { id: "rest", nome: "Dentística e Endodontia", procs: [
    ["resina", "Restauração de resina"], ["civ", "Restauração de ionômero"], ["amalgama", "Restauração de amálgama"], ["selante", "Selante"],
    ["adequacao", "Adequação do meio"], ["pulpotomia", "Pulpotomia"], ["pulpectomia", "Pulpectomia"], ["endo", "Tratamento endodôntico"],
  ] },
  { id: "hosp", nome: "Hospitalar", procs: [
    ["leito", "Avaliação à beira do leito"], ["higiene-uti", "Higiene bucal em UTI"], ["laser", "Laserterapia (fotobiomodulação)"], ["mucosite", "Cuidado de mucosite oral"],
    ["interconsulta", "Interconsulta"], ["prontuario", "Registro em prontuário"],
  ] },
  { id: "outros", nome: "Outros", procs: [
    ["moldagem", "Moldagem"], ["protese", "Prótese (etapa)"], ["fluor", "Aplicação de flúor"], ["receita", "Receita/prescrição"], ["atestado", "Atestado/orientações pós-operatórias"],
    ["instrumentacao", "Instrumentação cirúrgica"], ["biosseg", "Montagem e biossegurança"],
  ] },
];
const NOME = Object.fromEntries(GRUPOS.flatMap(g => g.procs.map(([id, n]) => [id, n])));
const GRUPO_DE = Object.fromEntries(GRUPOS.flatMap(g => g.procs.map(([id]) => [id, g.id])));
export const PAPEIS = [["obs", "Observei"], ["aux", "Auxiliei"], ["fiz", "Fiz"]];
export const LOCAIS = ["CEO", "HUOP", "LAPERIO", "Mestrado", "Clínica da graduação", "Outro"];
const uid = () => Math.random().toString(36).slice(2, 10);

export function C() { const e = E(); e.caderno ??= { registros: [] }; e.caderno.registros ??= []; return e.caderno; }
export const registrosDa = (ocorrencia) => C().registros.filter(r => r.ocorrencia === ocorrencia);
/** Local do caderno a partir de um item da Agenda (pelo nome curto). */
export function localDoItem(item) {
  const t = `${item?.curto || ""} ${item?.nome || ""}`;
  return LOCAIS.find(l => new RegExp(l, "i").test(t)) || (/cl[ií]nica/i.test(t) ? "Clínica da graduação" : "Outro");
}
/** É uma atividade prática da Agenda (as que valem caderno)? */
export const ehPratica = (item) => item?.tipo === "A" || /CEO|HUOP|LAPERIO|Mestrado|cl[ií]nica/i.test(`${item?.curto} ${item?.nome}`);
const horasDe = (ini, fim) => { const m = (s) => { const [h, mi] = (s || "0:0").split(":").map(Number); return h * 60 + mi; }; return Math.max(0, (m(fim) - m(ini)) / 60); };

/** Contagens: por procedimento e papel, por local (dias e horas), dúvidas abertas. */
export function contagens() {
  const R = C().registros, porProc = {}, porLocal = {}, dias = new Set(), ocorr = new Set();
  let fiz = 0, aux = 0, obs = 0;
  for (const r of R) {
    dias.add(r.data);
    const L = porLocal[r.local] ??= { dias: new Set(), horas: 0 };
    L.dias.add(r.data);
    // horas: uma vez por ocorrência da Agenda (ou o que ele escreveu)
    const chave = r.ocorrencia || r.id;
    if (!ocorr.has(chave)) { ocorr.add(chave); L.horas += Number(r.horas) || 0; }
    for (const p of r.procs || []) {
      const c = porProc[p.id] ??= { fiz: 0, aux: 0, obs: 0 };
      c[p.papel] += p.n || 1;
      if (p.papel === "fiz") fiz += p.n || 1; else if (p.papel === "aux") aux += p.n || 1; else obs += p.n || 1;
    }
  }
  const horas = Object.values(porLocal).reduce((s, l) => s + l.horas, 0);
  const duvidas = R.filter(r => r.duvida && !r.duvidaOk).sort((a, b) => b.data.localeCompare(a.data));
  return { porProc, porLocal, dias: dias.size, horas, fiz, aux, obs, duvidas, total: R.length };
}

const hf = (h) => `${String(Math.round(h * 10) / 10).replace(".", ",")} h`;
export function resumoTexto() {
  const k = contagens(), hoje = dataBR(hojeISO(), { day: "2-digit", month: "2-digit", year: "numeric" });
  const linhas = [`Atividades práticas (até ${hoje}): ${k.dias} dia${k.dias === 1 ? "" : "s"}${k.horas ? `, ${hf(k.horas)}` : ""}.`];
  for (const [l, v] of Object.entries(k.porLocal)) linhas.push(`- ${l}: ${v.dias.size} dia${v.dias.size === 1 ? "" : "s"}${v.horas ? `, ${hf(v.horas)}` : ""}`);
  for (const [papel, rot] of [["fiz", "Realizados (sob supervisão)"], ["aux", "Auxiliados"], ["obs", "Observados"]]) {
    const it = Object.entries(k.porProc).filter(([, c]) => c[papel]).sort((a, b) => b[1][papel] - a[1][papel]).map(([id, c]) => `${NOME[id] || id} (${c[papel]})`);
    if (it.length) linhas.push(`${rot}: ${it.join("; ")}.`);
  }
  return linhas.join("\n");
}

// ---------------------------------------------------------------- telas
export function telaCaderno(voltar) {
  const t = document.getElementById("tela"), k = contagens();
  t.innerHTML = "";
  if (voltar) { const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Agenda"; v.onclick = voltar; t.append(v); }
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela">Caderno clínico</h1>
    <p class="sub cad-aviso">Só o procedimento, o papel e o que você aprendeu. Nada de nome, iniciais, idade ou outros dados do paciente.</p>
    <div class="cad-totais"><div><b>${k.dias}</b><small>dias</small></div><div><b>${k.horas ? hf(k.horas).replace(" h", "") : 0}</b><small>horas</small></div><div><b>${k.fiz}</b><small>fiz</small></div><div><b>${k.aux}</b><small>auxiliei</small></div><div><b>${k.obs}</b><small>observei</small></div></div>`);
  const novo = document.createElement("button"); novo.className = "botao"; novo.textContent = "+ Registrar atividade";
  novo.onclick = () => editarRegistro({ data: hojeISO(), local: "CEO", procs: [] }, () => telaCaderno(voltar));
  t.append(novo);
  if (k.duvidas.length) {
    const s = document.createElement("div"); s.className = "secao";
    s.innerHTML = `<h2>Dúvidas para estudar</h2><p class="sub">Entram no Caderno do Dia das próximas noites.</p><div class="cartao cad-duvidas"></div>`;
    const box = s.querySelector(".cad-duvidas");
    for (const r of k.duvidas.slice(0, 8)) {
      const l = document.createElement("label"); l.className = "cad-duv";
      l.innerHTML = `<input type="checkbox"><span>${escapar(r.duvida)}<small>${dataBR(r.data)} · ${escapar(r.local)}</small></span>`;
      l.querySelector("input").onchange = () => { r.duvidaOk = hojeISO(); salvar(); toast("Dúvida resolvida."); telaCaderno(voltar); };
      box.append(l);
    }
    t.append(s);
  }
  if (Object.keys(k.porProc).length) {
    const s = document.createElement("div"); s.className = "secao";
    s.innerHTML = `<h2>Procedimentos</h2><div class="cartao cad-tabela"><div class="cad-th"><span></span><b>Fiz</b><b>Aux.</b><b>Obs.</b></div>${GRUPOS.map(g => {
      const ls = g.procs.filter(([id]) => k.porProc[id]);
      return ls.length ? `<h4>${escapar(g.nome)}</h4>${ls.map(([id, n]) => { const c = k.porProc[id]; return `<div class="cad-tr"><span>${escapar(n)}</span><b>${c.fiz || ""}</b><b>${c.aux || ""}</b><b>${c.obs || ""}</b></div>`; }).join("")}` : "";
    }).join("")}</div>`;
    t.append(s);
  }
  if (Object.keys(k.porLocal).length) {
    const s = document.createElement("div"); s.className = "secao";
    s.innerHTML = `<h2>Por local</h2><div class="cartao">${Object.entries(k.porLocal).sort((a, b) => b[1].dias.size - a[1].dias.size).map(([l, v]) => `<div class="cad-local"><b>${escapar(l)}</b><span>${v.dias.size} dia${v.dias.size === 1 ? "" : "s"}${v.horas ? ` · ${hf(v.horas)}` : ""}</span></div>`).join("")}</div>`;
    const cp = document.createElement("button"); cp.className = "botao secundario"; cp.textContent = "Copiar resumo para o currículo";
    cp.onclick = async () => { try { await navigator.clipboard.writeText(resumoTexto()); toast("Resumo copiado."); } catch { await modal({ titulo: "Resumo", html: `<pre class="cad-pre">${escapar(resumoTexto())}</pre>` }); } };
    s.append(cp);
    t.append(s);
  }
  const R = [...C().registros].sort((a, b) => b.data.localeCompare(a.data) || (b.criado || 0) - (a.criado || 0));
  const s = document.createElement("div"); s.className = "secao";
  s.innerHTML = `<h2>Registros</h2>`;
  if (!R.length) s.insertAdjacentHTML("beforeend", `<p class="sub">Nenhum ainda. Depois de uma atividade prática, toque em "Fui" na Agenda e registre o que viu e fez.</p>`);
  for (const r of R.slice(0, 60)) {
    const b = document.createElement("button"); b.className = "cad-reg";
    b.innerHTML = `<span class="cad-reg-d"><b>${dataBR(r.data)}</b><small>${escapar(r.local)}</small></span><span class="cad-reg-t">${(r.procs || []).map(p => `<i class="cad-p ${p.papel}">${escapar(NOME[p.id] || p.id)}${p.n > 1 ? ` ×${p.n}` : ""}</i>`).join("") || "<i class='cad-p'>Sem procedimentos</i>"}${r.aprendi ? `<small>${escapar(r.aprendi)}</small>` : ""}</span>`;
    b.onclick = () => editarRegistro(r, () => telaCaderno(voltar));
    s.append(b);
  }
  t.append(s);
}

/** Formulário de um registro (novo ou existente), na própria tela. `base.ocorrencia` liga à Agenda. */
export function editarRegistro(base, aoFim) {
  const existe = C().registros.includes(base);
  const r = existe ? base : { id: uid(), criado: Date.now(), ...base };
  const procs = (r.procs || []).map(p => ({ ...p }));
  let grupo = "cir", busca = "";
  const t = document.getElementById("tela");
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Caderno"; v.onclick = aoFim; t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela">${existe ? "Registro" : "Registrar atividade"}</h1>
    <p class="sub cad-aviso">Sem nome, iniciais, idade ou qualquer dado do paciente.</p>
    <div class="cad-form">
      <label class="campo"><span>Data</span><input type="date" class="cad-data" value="${r.data}"></label>
      <div class="campo"><span>Local</span><div class="cad-chips cad-locais">${LOCAIS.map(l => `<button type="button" data-l="${escapar(l)}" class="${r.local === l ? "sel" : ""}">${escapar(l)}</button>`).join("")}</div></div>
      <label class="campo"><span>Horas (opcional)</span><input type="number" class="cad-horas" step="0.5" min="0" value="${r.horas ?? ""}"></label>
      <div class="campo"><span>O que você viu e fez</span><div class="cad-sel"></div></div>
      <input type="search" class="cad-busca" placeholder="Procurar procedimento ou técnica…">
      <div class="cad-chips cad-grupos">${GRUPOS.map(g => `<button type="button" data-g="${g.id}" class="${g.id === grupo ? "sel" : ""}">${escapar(g.nome)}</button>`).join("")}</div>
      <div class="cad-procs"></div>
      <label class="campo"><span>O que aprendi</span><textarea class="cad-aprendi" rows="3" placeholder="Ex.: a aspiração positiva no alveolar inferior pede reposicionar a agulha">${escapar(r.aprendi || "")}</textarea></label>
      <label class="campo"><span>Dúvida para estudar (vai para o Caderno do Dia)</span><textarea class="cad-duvida" rows="2" placeholder="Ex.: quando usar a Gow-Gates em vez da alveolar inferior?">${escapar(r.duvida || "")}</textarea></label>
    </div>`);
  const sel = t.querySelector(".cad-sel"), lista = t.querySelector(".cad-procs");
  function desenharSel() {
    sel.innerHTML = procs.length ? "" : `<p class="sub">Toque nos procedimentos abaixo para pôr aqui.</p>`;
    procs.forEach((p, i) => {
      const l = document.createElement("div"); l.className = "cad-linha";
      l.innerHTML = `<b>${escapar(NOME[p.id] || p.id)}</b><div class="cad-papel">${PAPEIS.map(([id, n]) => `<button type="button" data-p="${id}" class="${p.papel === id ? "sel" : ""}">${n}</button>`).join("")}</div>
        <div class="cad-n"><button type="button" data-d="-1">−</button><span>${p.n || 1}</span><button type="button" data-d="1">+</button></div>`;
      l.querySelectorAll("[data-p]").forEach(b => (b.onclick = () => { p.papel = b.dataset.p; desenharSel(); }));
      l.querySelectorAll("[data-d]").forEach(b => (b.onclick = () => { p.n = (p.n || 1) + +b.dataset.d; if (p.n < 1) procs.splice(i, 1); desenharSel(); desenharLista(); }));
      sel.append(l);
    });
  }
  function desenharLista() {
    const q = busca.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const itens = q ? GRUPOS.flatMap(g => g.procs).filter(([, n]) => n.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(q)) : GRUPOS.find(g => g.id === grupo).procs;
    lista.innerHTML = "";
    for (const [id, n] of itens) {
      const b = document.createElement("button"); b.type = "button"; b.className = `cad-proc ${procs.some(p => p.id === id) ? "tem" : ""}`; b.textContent = n;
      b.onclick = () => { const ja = procs.find(p => p.id === id); if (ja) ja.n = (ja.n || 1) + 1; else procs.push({ id, papel: ultimoPapel(), n: 1 }); desenharSel(); desenharLista(); };
      lista.append(b);
    }
    if (!itens.length) lista.innerHTML = `<p class="sub">Nada com esse nome.</p>`;
  }
  const ultimoPapel = () => procs.at(-1)?.papel || "obs";
  t.querySelectorAll(".cad-locais button").forEach(b => (b.onclick = () => { r.local = b.dataset.l; t.querySelectorAll(".cad-locais button").forEach(x => x.classList.toggle("sel", x === b)); }));
  t.querySelectorAll(".cad-grupos button").forEach(b => (b.onclick = () => { grupo = b.dataset.g; busca = ""; t.querySelector(".cad-busca").value = ""; t.querySelectorAll(".cad-grupos button").forEach(x => x.classList.toggle("sel", x === b)); desenharLista(); }));
  t.querySelector(".cad-busca").oninput = (e) => { busca = e.target.value.trim(); desenharLista(); };
  desenharSel(); desenharLista();
  const rod = document.createElement("div"); rod.className = "cad-rodape";
  const ok = document.createElement("button"); ok.className = "botao"; ok.textContent = "Salvar";
  ok.onclick = () => {
    const aprendi = t.querySelector(".cad-aprendi").value.trim(), duvida = t.querySelector(".cad-duvida").value.trim();
    if (!procs.length && !aprendi && !duvida) { toast("Ponha ao menos um procedimento ou uma anotação."); return; }
    if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{15}\b/.test(`${aprendi} ${duvida}`)) { toast("Parece um CPF ou CNS: tire os dados do paciente.", 4000); return; }
    const novoDia = !C().registros.some(x => x.data === t.querySelector(".cad-data").value);
    Object.assign(r, { data: t.querySelector(".cad-data").value || hojeISO(), procs, aprendi, duvida, horas: t.querySelector(".cad-horas").value === "" ? null : Number(t.querySelector(".cad-horas").value) });
    if (r.duvida !== base.duvida) delete r.duvidaOk;
    if (!existe) C().registros.push(r);
    if (!existe && novoDia) ganhar(8, 2, "Caderno clínico", "caderno");
    salvar(); toast("Registro salvo."); aoFim();
  };
  rod.append(ok);
  if (existe) {
    const ap = document.createElement("button"); ap.className = "botao secundario"; ap.textContent = "Apagar";
    ap.onclick = async () => { if (!(await modal({ titulo: "Apagar este registro?", botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", classe: "secundario", valor: false }] }))) return; C().registros = C().registros.filter(x => x !== r); salvar(); aoFim(); };
    rod.append(ap);
  }
  t.append(rod);
}
