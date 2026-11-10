// Scanner no CELULAR (pedido do Alediov, 29/10/2026): a leitura e a conferência das fichas ficam só no computador do
// laboratório; aqui só os resultados, pelo resumo que o computador publica no repositório (só números agregados,
// resumo.js). Nada de ficha individual chega ao celular. Também apaga as fichas antigas que ainda estão no aparelho.
import { htmlBarraProjeto, ligarBarraProjeto } from "./barraProjeto.js";
import { ligarVisual } from "./visual.js";
import { cartaoControle } from "./controleLeitor.js";
import * as BD from "./banco.js";
import { CAMINHO_RESUMO, previsaoTermino, htmlPrevisao } from "./resumo.js";
import { svgMapa, caixaDasFormas, VISTAS } from "./mapa.js";
import { MAPAS } from "./mapas.js";
import { norm } from "./previsao.js";
import { piramide as pngPiramide, odontograma as pngOdontograma } from "./graficos.js";
import * as OF from "./oficial.js";
import { dialogo } from "./dialogo.js";
import { esc, fmt, pct, barras, tabelaConc, calendarioCalor, cartaoOficial, IC, LOGO } from "./telaScan.js";

let raiz, opts, R = null, vista = "bairros", perto = true;
const CHAVE_CACHE = "os.resumo";
const dec1 = (v, c = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const quando = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const dm = (d) => d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}` : "";
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function aviso(msg, ms = 3000) {
  const t = raiz.querySelector(".os-aviso"); if (!t) return;
  t.className = "os-aviso info"; t.innerHTML = `<i aria-hidden="true">i</i><span></span>`;
  t.querySelector("span").textContent = msg; t.style.setProperty("--vida", `${ms}ms`); t.hidden = false;
  t.classList.remove("vivo"); void t.offsetWidth; t.classList.add("vivo");
  clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), ms);
}

export function abrirResultados(alvo, o = {}) {
  raiz = alvo; opts = o;
  raiz.classList.add("os", "os-celular"); // "os-cel" é a caixinha dos dígitos (Números): com ele, a camada inteira saía deslocada (31/10/2026)
  raiz.innerHTML = `
    <header class="os-topo">
      <button class="os-area" aria-label="Trocar de área"><span class="os-logo">${LOGO}</span><span><b>Iniciação Científica</b><small>Trocar de Área ▾</small></span></button>
      <span class="os-topo-dir"><button class="os-busca os-atualizar" aria-label="Atualizar os resultados" title="Atualizar">${IC.importar}</button><span class="os-cadeado" title="Só números agregados: as fichas ficam no computador"><small>Resultados</small></span></span>
    </header>
    ${htmlBarraProjeto(o.projeto)}
    <main class="os-tela"></main>
    <div class="os-aviso" hidden></div>`;
  ligarVisual(raiz);
  raiz.querySelector(".os-area").onclick = () => o.aoTrocarArea?.();
  ligarBarraProjeto(raiz, o.aoProjetos);
  raiz.querySelector(".os-atualizar").onclick = () => carregar(true);
  try { R = JSON.parse(localStorage.getItem(CHAVE_CACHE) || "null"); } catch { R = null; }
  desenhar();
  carregar(false);
}

/** "Não se aplica" (05/11/2026): com a leitura do computador parada, as metas e o aviso dele saem do Meu dia. */
function pintarPausa() {
  const box = raiz.querySelector(".os-pausa-ic"), p = opts.pausa;
  if (!box || !p) { box?.remove(); return; }
  box.innerHTML = p.ligada
    ? `<h3>${IC.pc} Leitura parada: não se aplica</h3><p class="os-sub">As metas da IC e os avisos do computador não aparecem no Meu dia até você reativar.</p><div class="os-botoes"><button type="button" class="os-botao os-pausa-btn">Reativar</button></div>`
    : `<p class="os-sub">A leitura no computador vai parar por um tempo? Tire a IC do Meu dia até voltar.</p><div class="os-botoes"><button type="button" class="os-botao sec os-pausa-btn">Marcar como não se aplica</button></div>`;
  box.querySelector(".os-pausa-btn").onclick = () => {
    p.trocar(!p.ligada); p.ligada = !p.ligada; pintarPausa();
    aviso(p.ligada ? "A IC saiu do Meu dia até você reativar." : "A IC voltou ao Meu dia.");
  };
}

/** Baixa o resumo publicado pelo computador (com o token do app). */
async function carregar(manual) {
  const g = opts.github;
  if (!g?.token) { if (manual) aviso("Falta o token do GitHub do app (Ajustes do Órbita, a engrenagem da Home)."); return; }
  if (!navigator.onLine) { if (manual) aviso("Sem internet: mostrando o último resumo guardado."); return; }
  try {
    const r = await fetch(`https://api.github.com/repos/${g.repo || "Alediov/odonto-quest"}/contents/${CAMINHO_RESUMO}`, { cache: "no-store", headers: { Authorization: `Bearer ${g.token}`, Accept: "application/vnd.github.raw" } });
    if (r.status === 404) { if (manual) aviso("O computador ainda não publicou nenhum resumo."); if (!R) desenhar(); return; }
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const novo = await r.json();
    if (!novo || typeof novo !== "object" || !novo.gerado) throw new Error("resumo inválido");
    const mudou = !R || R.gerado !== novo.gerado;
    R = novo; try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(R)); } catch { /* sem espaço: segue sem guardar */ }
    if (mudou) desenhar();
    if (manual) aviso(mudou ? "Resultados atualizados." : "Nada novo desde a última vez.");
  } catch (e) { if (manual) aviso(`Não consegui baixar o resumo: ${e.message}`, 4500); }
}

function enviarAoWidget() {
  if (!R?.metas || !opts.aoResumo) return;
  const m = R.metas, e = R.etapas || {};
  opts.aoResumo({ dia: m.dia, metaRev: m.rev.meta, feitasRev: m.rev.feitas, metaNum: m.num.meta, feitasNum: m.num.feitas, seq: m.seq, cumpriu: m.cumpriu, ativo: true,
    paraRevisar: e.lida || 0, naFila: (e.fila || 0) + (e.espera || 0), confirmar: e.confirmar || 0, revisadas: e.revisada || 0, total: R.total || 0, erro: e.erro || 0 });
}

const ETS = [["erro", "Não reconhecidas", "var(--os-erro)"], ["confirmar", "Números a conferir", "var(--os-aviso)"], ["espera", "Esperando a leitura", "#8A94A6"], ["fila", "Na fila do computador", "var(--os-azul)"], ["lida", "Para conferir", "#9B6BDF"], ["revisada", "Conferidas", "var(--os-ok)"]];
async function desenhar() {
  const t = raiz.querySelector(".os-tela");
  if (!R) {
    t.innerHTML = `<div class="os-cab"><h2>Resultados</h2></div>
      <div class="os-ctl-caixa"></div><section class="os-cartao os-pausa-ic"></section>
      <section class="os-cartao"><h3>${IC.pc} Tudo no computador</h3>
      <p class="os-sub">A leitura e a conferência das fichas agora são feitas só no computador do laboratório. Aqui aparecem os resultados (tabelas, gráficos, estatísticas e o andamento), quando o OdontoScan do computador publicar o primeiro resumo: na aba <b>Leitura</b> dele, cartão <b>Resumo para o celular</b>.</p></section>
      ${await cartaoLocal()}`;
    ligarLocal(t);
    cartaoControle(t.querySelector(".os-ctl-caixa"), opts.github, aviso).catch(() => {});
  pintarPausa();
    return;
  }
  enviarAoWidget();
  const e = R.etapas || {}, total = R.total || 0, conf = e.revisada || 0, h = hojeISO();
  const noites = R.leitura?.noites || [], maxN = Math.max(1, ...noites.map(x => x.lidas));
  const D = R.dias || { dias: [] }, maxD = Math.max(1, ...(D.processadas || []), ...(D.lidas || []), ...(D.revisadas || []));
  const soma = (a) => (a || []).reduce((x, y) => x + y, 0);
  const CLASSE = { "Excelente": "var(--os-ok)", "Bom": "var(--os-acento)", "Regular": "var(--os-aviso)", "Ruim": "var(--os-erro)", "Muito ruim": "var(--os-erro)" };
  const metas = R.metas?.dia === h ? R.metas : null;
  const segN = noites.filter(x => x.seg).slice(-5), seg = segN.length ? segN.reduce((a, x) => a + x.seg, 0) / segN.length : null;
  const sia = await OF.carregarSIA().catch(() => null);
  const pv = previsaoTermino({ noites, faltamLer: (e.confirmar || 0) + (e.espera || 0) + (e.fila || 0), revisadasPorDia: D.revisadas || [], faltamConferir: Math.max(0, total - conf - (e.erro || 0)) });
  t.innerHTML = `
    <div class="os-cab"><h2>Resultados</h2><span class="os-pilula">${fmt(total)} ${total === 1 ? "ficha" : "fichas"}</span></div>
    <p class="os-sub os-cel-quando">Resumo do computador de ${quando(R.gerado)}. Só números: as fichas ficam lá.</p>
    <div class="os-ctl-caixa"></div><section class="os-cartao os-pausa-ic"></section>
    <section class="os-cartao os-cel-prog">
      <div class="os-cel-anel" style="--p:${total ? conf / total : 0}"><b>${pct(conf, total)}%</b><small>conferidas</small></div>
      <div><h3>${IC.painel} Andamento</h3><p class="os-sub"><b>${fmt(conf)}</b> de ${fmt(total)} fichas conferidas no computador${metas ? ` · hoje: ${metas.rev.feitas}/${metas.rev.meta} conferidas e ${metas.num.feitas}/${metas.num.meta} números${metas.seq ? ` · 🔥 ${metas.seq}` : ""}` : ""}.</p></div>
      <div class="os-pilha" role="img" aria-label="Fichas por etapa">${ETS.map(([k, , cor], i) => e[k] ? `<i style="flex:${e[k]};background:${cor};--k:${i}"></i>` : "").join("") || `<i style="flex:1;background:var(--os-sup2)"></i>`}</div>
      <ul class="os-legenda">${ETS.map(([k, nome, cor]) => `<li><span style="background:${cor}"></span>${nome}<b>${fmt(e[k] || 0)}</b><small>${pct(e[k] || 0, total)}%</small></li>`).join("")}</ul>
    </section>
    <section class="os-cartao">
      <h3>${IC.lua} Leitura no computador</h3>
      <div class="os-agora-num"><div><b>${fmt(R.leitura?.naFila ?? 0)}</b><small>Na fila</small></div><div><b>${seg ? Math.round(seg) : "–"}</b><small>Segundos por ficha</small></div><div><b>${R.leitura?.modelo ? esc(R.leitura.modelo) : "–"}</b><small>Modelo</small></div></div>
      ${R.leitura?.agora ? `<p class="os-sub">Lendo agora: ${fmt(R.leitura.agora.lidas)} de ${fmt(R.leitura.agora.abertas)}${R.leitura.agora.pausa ? ` (em pausa: ${esc({ calor: "placa esfriando", descanso: "descanso", "fila vazia": "esperando fichas", "limite do dia": "limite do dia" }[R.leitura.agora.pausa] || R.leitura.agora.pausa)})` : ""}${R.leitura.agora.temp != null ? ` · placa a até ${R.leitura.agora.temp} °C` : ""}.</p>` : ""}
      ${(() => { const u = noites.at(-1); if (!u) return ""; const t = [u.temp != null ? `placa até ${u.temp} °C` : "", u.calor ? `${u.calor} ${u.calor === 1 ? "pausa" : "pausas"} pelo calor` : "", { "placa quente demais": "parou: a placa não esfriou", "pouco espaço no disco": "parou: pouco espaço no disco", "falhas seguidas": "parou: muitas fichas sem leitura", "Ollama parou": "parou: o Ollama não respondeu" }[u.motivo] || ""].filter(Boolean); return t.length ? `<p class="os-sub">Última leitura (${dm(u.data)}): ${t.join(" · ")}.</p>` : ""; })()}
      ${htmlPrevisao(pv)}
      ${noites.length ? `<div class="os-colunas" role="img" aria-label="Fichas lidas por noite">${noites.map(x => `<div class="${x.terminou ? "" : "parou"}" title="${dm(x.data)}: ${x.lidas}"><b class="os-col-v">${fmt(x.lidas)}</b><i style="height:${Math.max(4, (x.lidas / maxN) * 78)}%"></i><small>${dm(x.data)}</small></div>`).join("")}</div><p class="os-sub">Fichas lidas em cada noite${noites.some(x => !x.terminou) ? " (em laranja, noites interrompidas: computador desligado ou leitor fechado)" : ""}.</p>` : `<p class="os-sub">O leitor ainda não rodou.</p>`}
    </section>
    <section class="os-cartao">
      <h3>${IC.raio} Últimos 30 dias</h3>
      <div class="os-dias" role="img" aria-label="Processadas, lidas e conferidas por dia">${(D.dias || []).map((d, i) => `<div title="${dm(d)}: ${D.processadas[i]} processadas, ${D.lidas[i]} lidas, ${D.revisadas[i]} conferidas"><span><i class="d1" style="height:${(D.processadas[i] / maxD) * 100}%"></i><i class="d2" style="height:${(D.lidas[i] / maxD) * 100}%"></i><i class="d3" style="height:${(D.revisadas[i] / maxD) * 100}%"></i></span><small>${d.slice(8, 10)}</small></div>`).join("")}</div>
      <ul class="os-legenda linha"><li><span class="d1"></span>Processadas<b>${fmt(soma(D.processadas))}</b></li><li><span class="d2"></span>Lidas<b>${fmt(soma(D.lidas))}</b></li><li><span class="d3"></span>Conferidas<b>${fmt(soma(D.revisadas))}</b></li></ul>
    </section>
    ${R.concordancia ? `<section class="os-cartao os-conc"><h3>${IC.alvo} A IA × a sua conferência</h3>${tabelaConc(R.concordancia)}</section>` : ""}
    <section class="os-cartao">
      <h3>${IC.num} Qualidade</h3>
      <ul class="os-fatos">
        <li><b>${R.qualidade.comNumeros ? `${pct(R.qualidade.numerosAuto, R.qualidade.comNumeros)}%` : "–"}</b><span>dos números de identificação conferidos sozinhos${R.qualidade.numerosIA ? ` (${fmt(R.qualidade.numerosIA)} pela IA)` : ""}</span></li>
        <li><b>${fmt(e.confirmar || 0)}</b><span>fichas esperando a conferência dos números</span></li>
        <li><b>${fmt(R.qualidade.azul)} · ${fmt(R.qualidade.preta)}</b><span>fichas impressas em azul · em preto (fotocópia)</span></li>
        <li><b>${fmt(e.erro || 0)}</b><span>não reconhecidas (foto ruim)</span></li>
        <li><b>${fmt(R.qualidade.duvidas)}</b><span>leituras com alguma dúvida da IA</span></li>
        <li><b>${fmt(R.qualidade.avisos)}</b><span>conferidas com aviso de coerência (datas, idade, dentes)</span></li>
      </ul>
    </section>
    ${R.conferidas ? await cartoesPesquisa(R, CLASSE, sia) : `<section class="os-cartao"><h3>${IC.exp} A pesquisa</h3><p class="os-sub">As tabelas, os gráficos e as estatísticas aparecem quando houver fichas conferidas no computador.</p></section>`}
    ${await cartaoLocal()}`;
  ligarLocal(t);
  cartaoControle(t.querySelector(".os-ctl-caixa"), opts.github, aviso).catch(() => {});
  pintarPausa();
  if (R.conferidas) ligarPesquisa(t);
  t.querySelectorAll("[data-sia-cnes]").forEach(b => (b.onclick = () => { try { localStorage.setItem("os.siaCnes", b.dataset.siaCnes); } catch {} desenhar(); }));
}

async function cartoesPesquisa(R, CLASSE, sia) {
  const n = R.conferidas, url = (g) => URL.createObjectURL(new Blob([g.png], { type: "image/png" }));
  const pir = R.piramide ? url(await pngPiramide(R.piramide, { w: 1000 })) : null;
  const odo = R.dentes?.length ? url(await pngOdontograma(new Map(R.dentes), { w: 1200 })) : null;
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `
    ${R.pacientes ? `<section class="os-cartao"><h3>${IC.pessoas} Pacientes</h3><div class="os-agora-num os-quatro"><div><b>${fmt(R.pacientes.pacientes)}</b><small>Pacientes distintos</small></div><div><b>${fmt(R.pacientes.comRetorno)}</b><small>Com 2 ou mais atendimentos</small></div><div><b>${R.pacientes.media ? dec1(R.pacientes.media) : "–"}</b><small>Atendimentos por paciente</small></div><div><b>${R.pacientes.medianaDias != null ? Math.round(R.pacientes.medianaDias) : "–"}</b><small>Dias entre consultas (mediana)</small></div></div></section>` : ""}
    ${R.completude ? `<section class="os-cartao os-completude"><h3>${IC.num} Completude do preenchimento</h3>
      <p class="os-sub">Quanto de cada campo veio preenchido (escala de Romero e Cunha). Média: <b>${dec1(R.completude.global)}%</b>.</p>
      <ul class="os-comp">${R.completude.campos.map((c, k) => `<li style="--k:${k}"><span>${esc(c.nome)}</span><i style="--w:${c.pct}%;--cor:${CLASSE[c.classe] || "var(--os-acento)"}"></i><b>${dec1(c.pct, 0)}%</b><em style="--cor:${CLASSE[c.classe] || "var(--os-acento)"}">${c.classe}</em></li>`).join("")}</ul>
      ${R.completude.cpf?.n || R.completude.cns?.n ? `<p class="os-sub">Dígito verificador correto: CPF ${R.completude.cpf?.n ? `${dec1(R.completude.cpf.pct, 0)}%` : "–"} · CNS ${R.completude.cns?.n ? `${dec1(R.completude.cns.pct, 0)}%` : "–"}.</p>` : ""}</section>` : ""}
    ${R.indicadores?.length ? `<section class="os-cartao"><h3>${IC.alvo} Indicadores</h3>
      <ul class="os-fatos">${R.indicadores.map(i => `<li><b>${i.unidade === "%" ? `${dec1(i.valor)}%` : dec1(i.valor, i.unidade === "razão" ? 2 : 1)}</b><span>${esc(i.nome)} <small>(${fmt(i.num)} / ${fmt(i.den)})</small></span></li>`).join("")}</ul>
      ${R.cobertura ? `<p class="os-sub">Cobertura: metade dos atendimentos vem de até <b>${dec1(R.cobertura.raio50)} km</b> da clínica e 90% de até <b>${dec1(R.cobertura.raio90)} km</b>${R.cobertura.pic ? `; ${fmt(R.cobertura.pic)} da PIC ficam de fora` : ""}.</p>` : ""}</section>` : ""}
    <section class="os-cartao"><h3>${IC.cal} Atendimentos por dia</h3>${calendarioCalor(R.calendario || {})}</section>
    ${R.mapa ? `<section class="os-cartao os-mapa"><div class="os-cab"><h3>${IC.mapa} Mapa dos atendimentos</h3></div>
      <div class="os-mapa-vistas" role="tablist">${VISTAS.map(([k, nm]) => `<button data-vista="${k}" role="tab">${nm}</button>`).join("")}</div><div class="os-mapa-corpo"></div></section>` : ""}
    ${cartaoOficial([], sia, R.procMes || {})}
    ${R.padroes?.length ? `<section class="os-cartao os-alertas"><h3>${IC.alvo} Padrões estranhos</h3><ul class="os-alertas-l">${R.padroes.map(a => `<li class="${a.grav}"><b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span></li>`).join("")}</ul></section>` : ""}
    <section class="os-cartao">
      <h3>${IC.exp} A pesquisa</h3>
      <p class="os-sub">${fmt(n)} ${n === 1 ? "ficha conferida" : "fichas conferidas"}.</p>
      <h4>Atendimentos por mês</h4>${barras((R.meses || []).map(([m, v]) => [m.split("-").reverse().join("/"), v]), n)}
      <h4>Clínicas</h4>${barras(R.clinicas || [], n)}
      <h4>Procedimentos mais feitos</h4>${barras(R.procedimentos || [], 0, "var(--os-azul)")}
      <h4>Procedimentos por categoria (Tabela 1)</h4>${barras((R.categorias || []).map(g => [`${g.categoria}${g.financiamento ? ` (${g.financiamento})` : ""}${g.tabela1 ? "" : " · fora da Tabela 1"}`, g.n]), 0, "var(--os-azul)")}
      ${pir ? `<h4>Pirâmide etária</h4><img class="os-cel-fig" src="${pir}" alt="Pirâmide etária por sexo">` : ""}
      <h4>Faixa etária</h4>${barras(R.faixas || [], n, "#9B6BDF")}
      <h4>Sexo</h4>${barras(R.sexo || [], n, "#9B6BDF")}
      <h4>Cor</h4>${barras(R.cor || [], n, "#9B6BDF")}
      <h4>Tipo de atendimento</h4>${barras(R.tipo || [], n)}
      <h4>Dia da semana</h4>${barras((R.diaSemana || []).map((v, i) => [DIAS[i], v]), n)}
      <h4>Turno</h4>${barras(R.turnos || [], n)}${R.semHora ? `<p class="os-sub">${fmt(R.semHora)} sem horário.</p>` : ""}
      <h4>Município</h4>${barras(R.municipios || [], n, "var(--os-ok)")}
      <h4>Bairros de Cascavel</h4>${barras(R.bairros || [], 0, "var(--os-ok)")}
      ${odo ? `<h4>Procedimentos por dente</h4><img class="os-cel-fig" src="${odo}" alt="Odontograma com o número de procedimentos por dente">` : ""}
    </section>`;
}

function ligarPesquisa(t) {
  const el = t.querySelector(".os-mapa"); if (!el || !R.mapa) return;
  const desenharMapa = () => {
    const m = R.mapa[vista] || { cont: [], fora: 0 }, cont = new Map(m.cont);
    const podeAproximar = vista === "parana" && !!caixaDasFormas(MAPAS.parana, cont);
    const top = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc((MAPAS[vista].itens.find(([nm]) => norm(nm) === k) || [k])[0])} (${fmt(v)})`);
    el.querySelector(".os-mapa-corpo").innerHTML = `${podeAproximar ? `<button class="os-link os-mapa-zoom">${perto ? "Ver o Paraná inteiro" : "Aproximar da região das fichas"}</button>` : ""}${svgMapa(vista, cont, perto && podeAproximar)}
      <p class="os-mapa-info">${top.length ? `Mais atendimentos: ${top.join(", ")}.` : "Nenhuma ficha com esse lugar ainda."} Toque numa área para ver o número.</p>
      ${m.fora ? `<p class="os-sub">${fmt(m.fora)} ${m.fora === 1 ? "ficha" : "fichas"} ${esc(m.foraTxt || "fora do mapa")}.</p>` : ""}`;
    el.querySelectorAll(".os-mapa-vistas button").forEach(b => b.classList.toggle("on", b.dataset.vista === vista));
    const z = el.querySelector(".os-mapa-zoom"); if (z) z.onclick = () => { perto = !perto; desenharMapa(); };
    const info = el.querySelector(".os-mapa-info");
    el.querySelectorAll(".os-mapa-svg path").forEach(p => (p.onclick = () => {
      el.querySelectorAll(".os-mapa-svg path.sel").forEach(x => x.classList.remove("sel"));
      p.classList.add("sel"); p.parentNode.append(p);
      info.innerHTML = `<b>${esc(p.dataset.nome)}</b>: ${fmt(p.dataset.v)} ${+p.dataset.v === 1 ? "atendimento" : "atendimentos"}`;
    }));
  };
  el.querySelectorAll(".os-mapa-vistas button").forEach(b => (b.onclick = () => { vista = b.dataset.vista; desenharMapa(); }));
  desenharMapa();
}

// ---------- as fichas antigas que ainda estão neste celular ----------
async function cartaoLocal() {
  const todas = await BD.todasComLixeira().catch(() => []);
  if (!todas.length) return "";
  const pc = R?.total || 0, ok = pc >= todas.filter(f => f.etapa !== "erro").length;
  return `<section class="os-cartao os-cel-local">
    <h3>${IC.lote} Fichas ainda neste celular</h3>
    <p class="os-sub">Este celular ainda guarda <b>${fmt(todas.length)}</b> ${todas.length === 1 ? "ficha" : "fichas"} da época em que a leitura era por aqui (com as cópias e os recortes). O computador tem ${fmt(pc)}. ${ok ? "Como o computador já tem todas, dá para apagar daqui." : "Espere o computador ter todas (importe as fotos e restaure o backup lá) antes de apagar."}</p>
    <div class="os-botoes"><button class="os-botao ${ok ? "" : "sec"}" data-acao="apagar-local">Apagar as fichas deste celular</button></div>
  </section>`;
}
function ligarLocal(t) {
  t.querySelector('[data-acao="apagar-local"]')?.addEventListener("click", async () => {
    const todas = await BD.todasComLixeira(), pc = R?.total || 0;
    const ok = await dialogo(raiz, {
      titulo: "Apagar as fichas deste celular?",
      html: `<p class="os-sub">Apaga deste celular as ${fmt(todas.length)} fichas, com as cópias, os recortes e a chave dos códigos. As do computador não mudam.</p>
        ${pc < todas.length ? `<p class="os-sub"><b>O último resumo do computador tem ${fmt(pc)} fichas, menos que as daqui.</b> Confira se o backup foi restaurado lá antes de apagar.</p>` : ""}`,
      botoes: [{ texto: "Apagar", valor: true }, { texto: "Cancelar", valor: null, classe: "sec" }],
    });
    if (!ok) return;
    await BD.apagarTudo();
    for (const k of ["concordancia", "pasta", "pastaHandle", "estadoFila", "chavePublicada", "chave", "chaveCriada"]) await BD.gravarCfg(k, null).catch(() => {});
    opts.aoApagar?.();
    aviso("Pronto: as fichas saíram deste celular.");
    desenhar();
  });
}

export const _teste = { definir: (r) => { R = r; return desenhar(); } };
