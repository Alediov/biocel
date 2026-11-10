// Painel de desempenho: números gerais, XP por dia, precisão por semana, por capítulo e por
// horário, domínio da revisão espaçada, conceitos para reforçar e calendário de 18 semanas.
// Gráficos em SVG simples, com a cor de destaque do app; tocar numa barra mostra o valor.
import { E, hojeISO, somaDias } from "./estado.js";
import { escapar, dataBR } from "./ui.js";
import { semanaDe } from "./liga.js";
import { revelarEmSequencia } from "./animacoes.js";

const CAPS = {
  c: ["", "Neurofisiologia", "Farmacologia dos anestésicos locais", "Farmacologia dos vasoconstritores", "Ação clínica de agentes específicos", "Seringa", "Agulha", "Tubete", "Arsenal adicional", "Preparação do arsenal", "Avaliação física e psicológica", "Técnica básica de injeção", "Considerações anatômicas", "Técnicas de anestesia maxilar", "Técnicas de anestesia mandibular", "Técnicas suplementares", "Anestesia nas especialidades", "Complicações locais", "Complicações sistêmicas", "Problemas no controle da dor", "Avanços recentes", "Tendências futuras", "Perguntas frequentes", "Considerações legais"],
  n: ["", "Defeitos do desenvolvimento", "Anomalias dentárias", "Doenças da polpa e periápice", "Doenças periodontais", "Infecções bacterianas", "Infecções fúngicas e protozoárias", "Infecções virais", "Injúrias físicas e químicas", "Alergias e doenças imunológicas", "Patologia epitelial", "Patologia das glândulas salivares", "Tumores de tecidos moles", "Distúrbios hematológicos", "Patologia óssea", "Cistos e tumores odontogênicos", "Doenças dermatológicas", "Manifestações de doenças sistêmicas", "Dor facial e doenças neuromusculares", "Odontologia forense"],
};
const LIVRO = { c: "Anestesiologia · Malamed", n: "Patologia · Neville" };
function grupoDe(id = "") {
  const m = id.match(/^([cn])(\d{2})-/);
  if (m) { const cap = +m[2]; return { chave: `${m[1]}${m[2]}`, livro: LIVRO[m[1]], nome: `Cap. ${cap}: ${CAPS[m[1]][cap] || ""}`, ordem: (m[1] === "c" ? 0 : 100) + cap }; }
  return { chave: "ev", livro: "Seminários e trabalhos", nome: "Questões dos eventos", ordem: 999 };
}
const pct = (a, n) => (n ? Math.round(a / n * 100) : null);
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function barras(dados, { altura = 120, max = null, rotulo = (d) => d.rot, valor = (d) => d.v, destaque = () => false, sufixo = "" } = {}) {
  const n = dados.length, W = 320, H = altura, base = H - 18, topo = 8, larg = W / n, m = max ?? Math.max(1, ...dados.map(valor));
  const grade = [0.5, 1].map(f => `<line x1="0" x2="${W}" y1="${base - (base - topo) * f}" y2="${base - (base - topo) * f}" class="grade"/>`).join("");
  const rects = dados.map((d, i) => {
    const v = valor(d); if (v == null) return `<rect x="${i * larg + larg * 0.18}" y="${base - 2}" width="${larg * 0.64}" height="2" class="vazio"/>`;
    const h = Math.max(v > 0 ? 3 : 0, (base - topo) * (v / m)), x = i * larg + larg * 0.18, w = larg * 0.64;
    return `<g class="barra ${destaque(d, i) ? "dest" : ""}" data-tip="${escapar(d.tip)}"><rect x="${i * larg}" y="0" width="${larg}" height="${H}" fill="transparent"/><path d="M${x} ${base} V${base - h + Math.min(4, h)} q0 -${Math.min(4, h)} ${Math.min(4, w / 2)} -${Math.min(4, h)} H${x + w - Math.min(4, w / 2)} q${Math.min(4, w / 2)} 0 ${Math.min(4, w / 2)} ${Math.min(4, h)} V${base} Z"/></g>`;
  }).join("");
  const rots = dados.map((d, i) => (rotulo(d, i) ? `<text x="${i * larg + larg / 2}" y="${H - 4}" text-anchor="middle">${escapar(rotulo(d, i))}</text>` : "")).join("");
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img">${grade}<text x="0" y="${topo - 1}" class="eixo">${Math.round(m)}${sufixo}</text>${rects}<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="base"/>${rots}</svg>`;
}

export function telaDesempenho(voltar) {
  const t = document.getElementById("tela"), est = E(), hoje = hojeISO();
  const todas = Object.values(est.respostas || {}).flat();
  const primeira = todas.filter(r => r.tentativa === 1);
  const acertos = primeira.filter(r => r.acertou).length;
  const diasEstudo = Object.entries(est.diario || {}).filter(([, d]) => d.licoes?.length || d.xp > 0).length;
  const tempos = primeira.map(r => r.ms).filter(ms => ms > 800 && ms < 600000).sort((a, b) => a - b);
  const mediana = tempos.length ? Math.round(tempos[Math.floor(tempos.length / 2)] / 1000) : null;

  // XP por dia (28 dias)
  const xpDias = Array.from({ length: 28 }, (_, i) => {
    const d = somaDias(hoje, i - 27), di = est.diario?.[d];
    return { d, v: di?.xp || 0, tip: `${DIAS[new Date(d + "T12:00:00").getDay()]} ${dataBR(d)}: ${di?.xp || 0} XP, ${di?.licoes?.length || 0} lições` };
  });
  const xp7 = xpDias.slice(-7).reduce((a, b) => a + b.v, 0), xp7ant = xpDias.slice(-14, -7).reduce((a, b) => a + b.v, 0);

  // precisão por semana (8 semanas)
  const semAtual = semanaDe(hoje);
  const porSemana = {};
  for (const [data, lista] of Object.entries(est.respostas || {})) {
    const s = semanaDe(data), o = porSemana[s] ||= { a: 0, n: 0 };
    for (const r of lista) if (r.tentativa === 1) { o.n++; if (r.acertou) o.a++; }
  }
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const s = somaDias(semAtual, -7 * (7 - i)), o = porSemana[s] || { a: 0, n: 0 };
    return { s, v: pct(o.a, o.n), tip: `Semana de ${dataBR(s)}: ${o.n ? `${pct(o.a, o.n)}% de acerto em ${o.n} questões` : "sem questões"}` };
  });

  // por capítulo
  const grupos = {};
  for (const r of primeira) { const g = grupoDe(r.id), o = grupos[g.chave] ||= { ...g, a: 0, n: 0, ids: new Set() }; o.n++; if (r.acertou) o.a++; o.ids.add(r.id); }
  for (const o of Object.values(grupos)) { const ss = [...o.ids].map(id => est.srs?.[id]).filter(Boolean); o.firmes = ss.filter(s => s.caixa >= 3).length; o.total = ss.length; }
  const caps = Object.values(grupos).sort((a, b) => a.ordem - b.ordem);
  let livroAnt = "";
  const linhasCap = caps.map(o => {
    const cab = o.livro !== livroAnt ? `<li class="cab-livro">${escapar(o.livro)}</li>` : ""; livroAnt = o.livro;
    const p = pct(o.a, o.n);
    return `${cab}<li class="cap"><div class="cap-topo"><span>${escapar(o.nome)}</span><b>${p}%</b></div><div class="trilho-barra"><div style="width:${p}%"></div></div><small>${o.n} questões · ${o.firmes} de ${o.total} já firmes na revisão</small></li>`;
  }).join("");

  // domínio (Leitner)
  const srs = Object.values(est.srs || {});
  const faixas = [
    { nome: "Aprendendo", n: srs.filter(s => s.caixa <= 1).length, cls: "d1" },
    { nome: "Revisando", n: srs.filter(s => s.caixa === 2 || s.caixa === 3).length, cls: "d2" },
    { nome: "Firme", n: srs.filter(s => s.caixa === 4).length, cls: "d3" },
    { nome: "Dominado", n: srs.filter(s => s.caixa >= 5).length, cls: "d4" },
  ];
  const devidos = srs.filter(s => s.proxima <= hoje).length;

  // horário
  const per = { manha: { nome: "Manhã", a: 0, n: 0 }, tarde: { nome: "Tarde", a: 0, n: 0 }, noite: { nome: "Noite", a: 0, n: 0 } };
  for (const r of primeira) { const h = new Date(r.quando).getHours(), k = h < 12 ? "manha" : h < 18 ? "tarde" : "noite"; per[k].n++; if (r.acertou) per[k].a++; }

  // conceitos
  const conc = {};
  for (const r of primeira) { if (!r.conceito) continue; const c = conc[r.conceito] ||= { e: 0, n: 0 }; c.n++; if (!r.acertou) c.e++; }
  const nomeC = (c) => escapar(c.replace(/[._]/g, " "));
  const fracos = Object.entries(conc).filter(([, c]) => c.e > 0 && c.n >= 2).sort((a, b) => b[1].e / b[1].n - a[1].e / a[1].n || b[1].n - a[1].n).slice(0, 6);
  const fortes = Object.entries(conc).filter(([, c]) => c.e === 0 && c.n >= 2).sort((a, b) => b[1].n - a[1].n).slice(0, 6);

  // calendário (18 semanas, segunda a domingo)
  const ini = somaDias(semAtual, -7 * 17);
  let cal = "";
  for (let i = 0; i < 18 * 7; i++) {
    const d = somaDias(ini, Math.floor(i % 18) * 7 + Math.floor(i / 18));
    const di = est.diario?.[d], n = di?.licoes?.length || 0, fut = d > hoje;
    cal += `<span class="${fut ? "fut" : n >= 8 ? "n3" : n >= 4 ? "n2" : n || di?.xp ? "n1" : ""} ${d === hoje ? "hoje" : ""}" data-tip="${fut ? "" : `${dataBR(d)}: ${n} lições, ${di?.xp || 0} XP`}"></span>`;
  }

  t.innerHTML = "";
  if (voltar) { const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Perfil"; v.onclick = voltar; t.append(v); }
  const varia = xp7ant ? Math.round((xp7 - xp7ant) / xp7ant * 100) : null;
  t.insertAdjacentHTML("beforeend", `
    <h1 class="titulo-tela" style="margin-top:4px">Desempenho</h1>
    <div class="tiles-desemp">
      <div class="cartao"><b>${primeira.length}</b><span>questões respondidas</span></div>
      <div class="cartao"><b>${pct(acertos, primeira.length) ?? "—"}${primeira.length ? "%" : ""}</b><span>acerto na 1ª tentativa</span></div>
      <div class="cartao"><b>${diasEstudo}</b><span>dias de estudo</span></div>
      <div class="cartao"><b>${mediana != null ? `${mediana} s` : "—"}</b><span>por questão (mediana)</span></div>
    </div>
    <div class="secao"><h2>XP por dia</h2><div class="cartao graf">
      <p class="leg-graf"><b>${xp7} XP</b> nos últimos 7 dias${varia != null ? ` <span class="${varia >= 0 ? "sobe" : "desce"}">${varia >= 0 ? "▲" : "▼"} ${Math.abs(varia)}% sobre a semana anterior</span>` : ""}</p>
      ${xpDias.some(d => d.v) ? barras(xpDias, { rotulo: (d, i) => (i % 7 === 6 ? dataBR(d.d) : ""), destaque: (d) => d.d === hoje }) : `<p class="sub vazio-graf">O gráfico aparece quando você ganhar o primeiro XP.</p>`}
      <p class="tip-graf">${xpDias.some(d => d.v) ? "Toque numa barra para ver o dia." : ""}</p></div></div>
    <div class="secao"><h2>Acerto por semana</h2><div class="cartao graf">
      ${semanas.some(d => d.v != null) ? barras(semanas, { max: 100, sufixo: "%", rotulo: (d) => dataBR(d.s), destaque: (d) => d.s === semAtual }) : `<p class="sub vazio-graf">Aparece depois das primeiras questões.</p>`}
      <p class="tip-graf">Só a 1ª tentativa de cada questão conta.</p></div></div>
    <div class="secao"><h2>Revisão espaçada</h2><div class="cartao">
      ${srs.length ? `<div class="pilha-dominio">${faixas.filter(f => f.n).map(f => `<div class="${f.cls}" style="flex:${f.n}"></div>`).join("")}</div>
      <ul class="leg-dominio">${faixas.map(f => `<li><i class="${f.cls}"></i>${f.nome}<b>${f.n}</b></li>`).join("")}</ul>
      <p class="sub" style="margin:8px 0 0">${devidos ? `<b>${devidos}</b> questões para revisar hoje no Treino.` : "Nenhuma revisão pendente hoje."}</p>` : `<p class="sub" style="margin:0">Aparece depois das primeiras lições.</p>`}
    </div></div>
    <div class="secao"><h2>Por capítulo</h2><div class="cartao">${caps.length ? `<ul class="caps-desemp">${linhasCap}</ul>` : `<p class="sub" style="margin:0">Aparece depois das primeiras lições.</p>`}</div></div>
    <div class="secao"><h2>Por horário</h2><div class="tiles-desemp tres">${Object.values(per).map(p => `<div class="cartao"><b>${pct(p.a, p.n) ?? "—"}${p.n ? "%" : ""}</b><span>${p.nome} · ${p.n} questões</span></div>`).join("")}</div></div>
    <div class="secao"><h2>Conceitos</h2><div class="cartao conceitos-desemp">
      <h3>Para reforçar</h3>${fracos.length ? `<ul class="fracos">${fracos.map(([c, v]) => `<li><span>${nomeC(c)}</span><b>${v.e} de ${v.n} erradas</b></li>`).join("")}</ul>` : `<p class="sub">Nenhum conceito com erros repetidos.</p>`}
      <h3>Mais firmes</h3>${fortes.length ? `<ul class="fracos fortes">${fortes.map(([c, v]) => `<li><span>${nomeC(c)}</span><b>${v.n} de ${v.n} certas</b></li>`).join("")}</ul>` : `<p class="sub">Aparecem quando você acertar o mesmo conceito algumas vezes.</p>`}
    </div></div>
    <div class="secao"><h2>Últimas 18 semanas</h2><div class="cartao graf">
      <div class="cal-desemp-wrap"><div class="cal-dias">${["S", "T", "Q", "Q", "S", "S", "D"].map(x => `<span>${x}</span>`).join("")}</div><div class="cal-desemp">${cal}</div></div>
      <p class="tip-graf">Toque num dia para ver o que estudou.</p></div></div>
    <div style="height:24px"></div>`);
  revelarEmSequencia(t.querySelectorAll(".tiles-desemp .cartao, .secao"), { passo: 60 });
  // toque = mostra o valor
  t.querySelectorAll(".graf").forEach(g => g.addEventListener("click", (e) => {
    const alvo = e.target.closest("[data-tip]"); if (!alvo || !alvo.dataset.tip) return;
    g.querySelectorAll(".ativa").forEach(x => x.classList.remove("ativa")); alvo.classList.add("ativa");
    g.querySelector(".tip-graf").textContent = alvo.dataset.tip;
  }));
}
