// Alarmes na Agenda (pedido do Alediov, 26/10/2026): a seção "Alarmes" (próximo alarme, liga/desliga e os próximos 14
// dias, cada um com a hora e o motivo; tocar num dia muda só aquele dia) e a tela de ajustes (hora dos dias de aula,
// antecedência no fim de semana, som, a tela do alarme (imagens, "toca de novo"), as contas depois de desligar, teste,
// permissões do Android e como ele tem acordado).
// O cálculo e a ponte com o Android estão em alarmes.js.
import * as AL from "./alarmes.js";
import { DIAS_CURTOS, diaSemana } from "./agenda.js";
import { hojeISO } from "./estado.js";
import { modal, toast, formulario, escapar, dataBR } from "./ui.js";
import { icone } from "./icones.js";
import { tocar } from "./sons.js";
import { FUNDOS, urlFundo } from "./aparenciaComum.js";

const tela = () => document.getElementById("tela");
const DM = { weekday: "long", day: "2-digit", month: "2-digit" };
const nomeDia = (d) => { const s = dataBR(d, DM); return s[0].toUpperCase() + s.slice(1); };
const segs = (ms) => { const s = Math.round((ms || 0) / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, "0")} s` : ""}`; };

function chave(on, rotulo, aoMudar) {
  const b = document.createElement("button"); b.type = "button"; b.className = `chave ${on ? "on" : ""}`; b.setAttribute("aria-label", rotulo); b.setAttribute("aria-pressed", on ? "true" : "false");
  b.onclick = () => { const v = !b.classList.contains("on"); b.classList.toggle("on", v); b.setAttribute("aria-pressed", v ? "true" : "false"); aoMudar(v); };
  return b;
}
function linha(rotulo, sub, controle) {
  const l = document.createElement("div"); l.className = "linha-cfg al-linha";
  l.innerHTML = `<span class="al-rot"><b>${rotulo}</b>${sub ? `<small>${sub}</small>` : ""}</span>`;
  if (controle) l.append(controle);
  return l;
}
function seletor(opcoes, valor, aoMudar, rotulo) {
  const s = document.createElement("select"); s.className = "al-sel"; s.setAttribute("aria-label", rotulo);
  for (const [v, t] of opcoes) { const o = document.createElement("option"); o.value = String(v); o.textContent = t; s.append(o); }
  s.value = String(valor);
  s.onchange = () => aoMudar(s.value);
  return s;
}
async function pedirHora(titulo, valor, dica = "") {
  const f = await formulario({ titulo, campos: [{ id: "hora", rotulo: "Hora", tipo: "time", valor, dica }] });
  return f?.hora && /^\d\d:\d\d$/.test(f.hora) ? f.hora : null;
}

// ---------- a seção na Agenda ----------
/** A seção "Alarmes" da Agenda. `redesenhar`: desenha a Agenda de novo depois de uma mudança. */
export function secaoAlarmes(redesenhar) {
  const R = AL.R(), aqui = AL.tocaAqui(), dias = AL.proximosDias(), prox = dias.find(a => a.hora && !a.passou);
  const sec = document.createElement("div"); sec.className = "secao alarmes-sec";
  sec.innerHTML = `<h2>Alarmes</h2>`;
  const c = document.createElement("div"); c.className = `cartao al-cartao ${R.ligado && aqui ? "" : "apagado"}`;
  const titulo = !R.ligado ? "Alarmes desligados" : !aqui ? "Não toca neste aparelho" : "Próximo alarme";
  const hero = document.createElement("div"); hero.className = "al-hero";
  hero.innerHTML = `<span class="al-relogio">${icone("⏰", "ico3d")}</span>
    <div class="al-prox"><small>${titulo}</small><b>${prox ? AL.horaCurta(prox.hora) : "—"}</b>
    <span>${prox ? `${escapar(AL.quandoTexto(prox.data))} · ${escapar(prox.motivo)}` : R.ligado ? "nenhum nos próximos 14 dias" : "toque para ligar"}</span></div>`;
  hero.append(chave(R.ligado, "Alarmes ligados", (v) => { AL.ligar(v); toast(v ? "Alarmes ligados." : "Alarmes desligados: nenhum vai tocar."); redesenhar(); }));
  c.append(hero);
  if (R.ligado && !aqui) {
    const f = document.createElement("div"); f.className = "al-aviso";
    f.innerHTML = `<span>Os alarmes tocam em outro aparelho (este não toca, para não despertarem juntos).</span>`;
    const b = document.createElement("button"); b.className = "link-mini"; b.textContent = "Tocar aqui também";
    b.onclick = () => { AL.definirTocaAqui(true); redesenhar(); };
    f.append(b); c.append(f);
  }
  // os 14 dias
  const faixa = document.createElement("div"); faixa.className = "al-dias";
  const hoje = hojeISO();
  for (const a of dias) {
    const b = document.createElement("button");
    b.className = `al-dia ${a.hora ? "tem" : ""} ${a.manual ? "manual" : ""} ${a.sem ? "sem" : ""} ${a.passou ? "passou" : ""} ${a.confira && !a.manual ? "confira" : ""} ${a.data === hoje ? "hoje" : ""}`;
    b.innerHTML = `<small>${DIAS_CURTOS[diaSemana(a.data)]}</small><b>${Number(a.data.slice(8))}</b><i>${a.hora ? AL.horaCurta(a.hora) : a.sem ? "sem" : "—"}</i>`;
    b.setAttribute("aria-label", `${nomeDia(a.data)}: ${a.hora ? `alarme às ${AL.horaCurta(a.hora)}` : "sem alarme"}${a.motivo ? `, ${a.motivo}` : ""}`);
    b.onclick = () => opcoesDoDia(a, redesenhar);
    faixa.append(b);
  }
  c.append(faixa);
  requestAnimationFrame(() => faixa.querySelector(".tem:not(.passou)")?.scrollIntoView({ inline: "center", block: "nearest" }));
  // avisos do Android (permissões) e os botões
  const avisos = document.createElement("div"); avisos.className = "al-avisos";
  c.append(avisos);
  const bts = document.createElement("div"); bts.className = "al-botoes";
  const bAj = document.createElement("button"); bAj.className = "botao secundario mini"; bAj.innerHTML = `${icone("🧮", "ico-inline")} Som e contas`;
  bAj.onclick = () => telaAjustesAlarmes(redesenhar);
  const bT = document.createElement("button"); bT.className = "botao secundario mini"; bT.textContent = "Testar em 1 min";
  bT.onclick = testar;
  bts.append(bAj, bT); c.append(bts);
  sec.append(c);
  if (R.ligado && aqui) avisosPermissao(avisos);
  return sec;
}

async function avisosPermissao(box) {
  const s = await AL.lerSituacao();
  if (!s || !box.isConnected) return;
  const faltam = [];
  if (s.exato === false) faltam.push(["exato", "Os alarmes podem atrasar: falta a permissão de alarmes exatos."]);
  // a tela do alarme abre sozinha por um dos dois caminhos: tela cheia (que o Android 14+ volta a negar a cada
  // atualização do app) ou "Exibir sobre outros apps" (que fica). Com esta, não há o que avisar.
  if (s.telaCheia === false && s.sobreApps === false) faltam.push(["sobreApps", "Com a tela apagada, a tela do alarme pode não abrir sozinha (só a notificação). Permita \"Exibir sobre outros apps\": não se perde ao atualizar o app."]);
  if (s.notificacoes === false) faltam.push(["notificacoes", "As notificações estão desligadas: o alarme pode não mostrar a tela dele."]);
  for (const [qual, txt] of faltam) {
    const l = document.createElement("div"); l.className = "al-aviso perigo";
    l.innerHTML = `<span>${icone("⚠️", "ico-inline")} ${txt}</span>`;
    const b = document.createElement("button"); b.className = "botao mini"; b.textContent = "Permitir";
    b.onclick = () => (qual === "sobreApps" ? pedirSobreApps() : AL.abrirAjuste(qual));
    l.append(b); box.append(l);
  }
}

/** "Exibir sobre outros apps": explica uma vez (neste aparelho) e abre o ajuste do Android. */
async function pedirSobreApps() {
  let visto = false;
  try { visto = localStorage.getItem("orbita.alarmes.sobreAppsExplicado") === "1"; } catch { /* sem armazenamento */ }
  if (!visto) {
    const ok = await modal({
      titulo: "Exibir sobre outros apps",
      texto: "É o que deixa a tela do alarme (a imagem e o deslizar) abrir sozinha por cima de tudo, até com a tela apagada.\n\nA permissão de \"tela cheia\" faz o mesmo, mas o Android volta a negá-la a cada atualização do Órbita (por ele não vir da loja). Esta fica.\n\nNa tela que vai abrir, ligue o Órbita. Se a chave estiver cinza, em Apps → Órbita → ⋮, toque em \"Permitir configurações restritas\" e volte.",
      botoes: [{ texto: "Abrir o ajuste", valor: true }, { texto: "Agora não", valor: false, classe: "secundario" }],
    });
    if (!ok) return;
    try { localStorage.setItem("orbita.alarmes.sobreAppsExplicado", "1"); } catch { /* sem armazenamento */ }
  }
  await AL.abrirAjuste("sobreApps");
}

async function opcoesDoDia(a, redesenhar) {
  const R = AL.R();
  const botoes = [];
  if (a.hora) botoes.push({ texto: "Mudar a hora deste dia", valor: "hora" });
  else if (!a.sem) botoes.push({ texto: "Pôr um alarme neste dia", valor: "hora" });
  if (a.hora) botoes.push({ texto: "Sem alarme neste dia", valor: "sem", classe: "secundario" });
  if (a.manual || a.sem) botoes.push({ texto: "Voltar ao normal", valor: "normal", classe: "secundario" });
  if (a.itemId && !a.manual) botoes.push({ texto: `Nunca despertar para ${a.item}`, valor: "ignorar", classe: "secundario" });
  botoes.push({ texto: "Fechar", valor: null, classe: "secundario" });
  let texto = a.hora ? `Alarme às ${AL.horaCurta(a.hora)}${a.motivo ? ` · ${a.motivo}` : ""}${a.manual ? " (horário escolhido por você)" : ""}` : `Sem alarme · ${a.motivo || ""}`;
  if (a.hora && a.confira && !a.manual) texto += `\n${/HUOP/.test(a.item || "") ? "O horário do HUOP muda com o plantonista: confira e ajuste aqui." : "Fim de semana: confira o horário e ajuste aqui."}`;
  if (a.passou) texto += "\nEste já passou.";
  const v = await modal({ titulo: nomeDia(a.data), texto, botoes });
  if (v === "hora") {
    const h = await pedirHora(`Alarme de ${dataBR(a.data, { weekday: "short", day: "2-digit", month: "2-digit" })}`, a.hora || R.horaAula, "Vale só para este dia.");
    if (!h) return;
    AL.definirDia(a.data, { hora: h }); toast(`Alarme às ${AL.horaCurta(h)} só neste dia.`);
  } else if (v === "sem") { AL.definirDia(a.data, { sem: true }); toast("Sem alarme neste dia."); }
  else if (v === "normal") { AL.definirDia(a.data, null); toast("Voltou ao normal."); }
  else if (v === "ignorar") {
    AL.ignorarItem(a.itemId, true);
    toast(`${a.item} não desperta mais. Dá para desfazer nos ajustes.`, 3400);
  } else return;
  redesenhar();
}

/** O diário do alarme no cartão: os últimos passos (agendado, disparou, serviço, som, tela, erros), com Copiar. */
async function mostrarDiario(c) {
  const l = await AL.diario();
  if (!c.isConnected) return;
  if (l == null) { c.innerHTML = `<p class="sub">${(await AL.nativo()) ? "Atualize o app para ver o que o alarme fez." : "O diário do alarme aparece no app do celular."}</p>`; return; }
  if (!l.length) { c.innerHTML = `<p class="sub">Nada ainda. Depois de um teste ou de um alarme, cada passo aparece aqui.</p>`; return; }
  const hora = (ms) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${d.toTimeString().slice(0, 8)}`; };
  const ruim = /recusou|barrou|Não consegui|Sem a permissão|desligadas|falhou|não tocaram|Nem o som|só notificação|não abriu/;
  const itens = l.slice(0, 25);
  c.innerHTML = `<ul class="al-diario-l">${itens.map(x => `<li class="${ruim.test(x.texto) ? "ruim" : ""}"><time>${hora(x.em)}</time><span>${escapar(x.texto)}</span></li>`).join("")}</ul>`;
  const b = document.createElement("button"); b.className = "botao mini secundario"; b.textContent = "Copiar";
  b.onclick = async () => {
    const st = await AL.lerSituacao();
    const txt = itens.slice().reverse().map(x => `${hora(x.em)}  ${x.texto}`).join("\n") + (st ? `\n\nPermissões: exato ${st.exato ? "sim" : "não"}, tela cheia ${st.telaCheia ? "sim" : "não"}, sobre outros apps ${st.sobreApps ? "sim" : st.sobreApps === false ? "não" : "?"}, notificações ${st.notificacoes ? "sim" : "não"}, sem restrição de bateria ${st.bateria ? "sim" : "não"}` : "");
    try { await navigator.clipboard.writeText(txt); toast("Copiado.", 1800); } catch { toast("Não consegui copiar.", 2200); }
  };
  c.append(b);
}

async function testar() {
  if (!(await AL.nativo())) {
    await modal({ titulo: "Teste do alarme", texto: "No navegador não há alarme. No celular, o teste toca daqui a 1 minuto (pode apagar a tela), com a música da playlist Alarme e uma das suas imagens: deslize para desligar e depois resolva as contas.", botoes: [{ texto: "Entendi", valor: true }] });
    return;
  }
  try {
    const r = await AL.testar(60);
    tocar("moeda");
    toast(r?.exato === false ? "Teste em 1 minuto (sem a permissão de alarme exato pode atrasar um pouco)." : "O alarme de teste toca em 1 minuto. Pode apagar a tela. Se não tocar, veja \"O que aconteceu\" em Som e contas.", 5200);
  } catch (e) { toast(`Não consegui agendar o teste: ${e?.message || e}`, 4200); }
}

// ---------- a tela de ajustes ----------
export async function telaAjustesAlarmes(voltar, manter = false) {
  const t = tela(), R = AL.R(), s = AL.som(), c = AL.contas();
  const redesenhar = () => telaAjustesAlarmes(voltar, true);
  const rolagem = t.scrollTop;
  t.innerHTML = "";
  if (!manter) t.scrollTop = 0;
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Agenda";
  v.onclick = () => { voltar(); requestAnimationFrame(() => document.querySelector(".alarmes-sec")?.scrollIntoView({ block: "start" })); };
  t.append(v);
  t.insertAdjacentHTML("beforeend", `<h1 class="titulo-tela" style="margin-top:4px">Alarmes</h1><p class="sub">Tocam nos dias de aula de manhã, às 5h nos dias de HUOP e, no fim de semana e no feriado, só com HUOP ou CEO. Sem soneca: deslize para desligar e depois resolva as contas, já sem som.</p>`);

  // quando
  const s1 = document.createElement("div"); s1.className = "secao";
  s1.innerHTML = `<h2>Quando toca</h2>`;
  const c1 = document.createElement("div"); c1.className = "cartao al-ajustes";
  c1.append(linha("Alarmes ligados", "", chave(R.ligado, "Alarmes ligados", (x) => { AL.ligar(x); })));
  c1.append(linha("Tocar neste aparelho", "Deixe ligado só no celular, para o tablet não despertar junto.", chave(AL.tocaAqui(), "Tocar neste aparelho", (x) => AL.definirTocaAqui(x))));
  const bH = document.createElement("button"); bH.type = "button"; bH.className = "al-hora"; bH.textContent = AL.horaCurta(R.horaAula);
  bH.onclick = async () => { const h = await pedirHora("Dias de aula", R.horaAula, "Segunda a sexta, com aula ou atividade que começa de manhã."); if (h) { AL.definirHoraAula(h); redesenhar(); } };
  c1.append(linha("Dias de aula (seg. a sex.)", "Com aula ou atividade de manhã. Só à tarde: sem alarme.", bH));
  const bHu = document.createElement("button"); bHu.type = "button"; bHu.className = "al-hora"; bHu.textContent = AL.horaCurta(AL.horaHuop());
  bHu.onclick = async () => { const h = await pedirHora("Dias de HUOP", AL.horaHuop(), "Qualquer dia com HUOP, na semana ou no fim de semana."); if (h) { AL.definirHoraHuop(h); redesenhar(); } };
  c1.append(linha("Dias de HUOP", "Qualquer dia com HUOP. Na véspera, às 20h, chega um aviso para conferir o horário do plantonista.", bHu));
  const ant = AL.antecedencia();
  c1.append(linha("CEO no fim de semana", "Quanto antes do início. Na véspera, às 20h, chega um aviso para conferir o horário.",
    seletor([30, 40, 50, 60, 70, 80, 90, 120].map(m => [m, `${m} min antes`]), [30, 40, 50, 60, 70, 80, 90, 120].includes(ant) ? ant : 50, (x) => AL.definirAntecedencia(Number(x)), "Antecedência")));
  const ign = AL.itensIgnorados();
  if (ign.length) {
    const l = document.createElement("div"); l.className = "al-ignorados";
    l.innerHTML = `<small>Nunca despertam:</small>`;
    for (const it of ign) {
      const b = document.createElement("button"); b.className = "al-chip"; b.innerHTML = `${escapar(it.curto || it.nome)} <span aria-hidden="true">×</span>`; b.setAttribute("aria-label", `Voltar a despertar para ${it.curto || it.nome}`);
      b.onclick = () => { AL.ignorarItem(it.id, false); redesenhar(); };
      l.append(b);
    }
    c1.append(l);
  }
  s1.append(c1); t.append(s1);

  // som
  const s2 = document.createElement("div"); s2.className = "secao";
  s2.innerHTML = `<h2>Som</h2>`;
  const c2 = document.createElement("div"); c2.className = "cartao al-ajustes";
  const subPl = document.createElement("small");
  c2.append(linha("Música", "", seletor([["playlist", "Playlist Alarme"], ["orbita", "Toque do Órbita"]], s.fonte, (x) => { AL.definirSom({ fonte: x }); redesenhar(); }, "Música do alarme")));
  if (s.fonte === "playlist") {
    const l = document.createElement("div"); l.className = "al-pl";
    l.append(subPl);
    const b = document.createElement("button"); b.className = "link-mini"; b.textContent = "Abrir a playlist";
    b.onclick = async () => { const ar = await import("./areas.js"); await ar.abrirMusicas(); try { (await import("./musicas/telaMusicas.js")).abrirPlaylist?.(AL.ALARME_PLAYLIST); } catch { /* sem a tela */ } };
    l.append(b); c2.append(l);
    AL.faixasDoAlarme().then(fs => { subPl.textContent = fs.length ? `${fs.length} ${fs.length === 1 ? "música" : "músicas"} na playlist Alarme. Sorteia uma por dia, sem repetir as últimas 5.` : "A playlist Alarme das Músicas está vazia: toca o toque do Órbita. No ⋯ de uma música, \"Adicionar a Alarme\"."; });
  }
  c2.append(linha("Volume crescente", "", seletor([[0, "Sem (volume cheio)"], [30, "Em 30 s"], [60, "Em 60 s"], [120, "Em 2 min"]], s.crescer, (x) => AL.definirSom({ crescer: Number(x) }), "Volume crescente")));
  c2.append(linha("Volume máximo", "Do volume de alarme do celular (se ele estiver muito baixo, o Órbita sobe até a metade enquanto toca).", seletor([50, 60, 70, 80, 90, 100].map(p => [p, `${p}%`]), s.volume, (x) => AL.definirSom({ volume: Number(x) }), "Volume máximo")));
  c2.append(linha("Vibrar", "", chave(s.vibrar !== false, "Vibrar", (x) => AL.definirSom({ vibrar: x }))));
  s2.append(c2); t.append(s2);

  // a tela do alarme (05/11/2026): imagens que podem aparecer e o "toca de novo"
  const sT = document.createElement("div"); sT.className = "secao al-tela-sec";
  sT.innerHTML = `<h2>Ao tocar</h2>`;
  const cT = document.createElement("div"); cT.className = "cartao al-ajustes";
  const tl = AL.tela();
  cT.insertAdjacentHTML("beforeend", `<p class="sub al-fluxo">A tela do alarme mostra uma destas imagens (sorteada, sem repetir a do dia anterior), a hora e o compromisso. <b>Deslize</b> para desligar o som; depois vêm as contas, sem som.</p>`);
  const grade = document.createElement("div"); grade.className = "al-fundos"; grade.setAttribute("role", "group"); grade.setAttribute("aria-label", "Imagens do alarme");
  for (const [id, nome] of AL.FUNDOS_ALARME) {
    const f = FUNDOS.find(x => x.id === id);
    const b = document.createElement("button"); b.type = "button";
    const on = tl.fundos.includes(id);
    b.className = `al-fundo ${on ? "on" : ""}`; b.dataset.fundo = id; b.setAttribute("aria-pressed", on ? "true" : "false");
    b.innerHTML = `<span class="al-fundo-img" style="background-image:url('${escapar(urlFundo(f, true))}')"></span><span class="al-fundo-nome">${escapar(nome)}</span><span class="al-fundo-ok" aria-hidden="true">✓</span>`;
    b.onclick = () => {
      const sim = !b.classList.contains("on");
      if (!AL.alternarFundo(id, sim)) { toast("Deixe pelo menos uma imagem.", 2200); return; }
      b.classList.toggle("on", sim); b.setAttribute("aria-pressed", sim ? "true" : "false");
    };
    grade.append(b);
  }
  cT.append(grade);
  cT.append(linha("Se eu não terminar as contas", "Depois de deslizar, se as contas não terminarem a tempo (ou você sair delas), o alarme toca de novo, mesmo com a tela apagada.",
    seletor(AL.OPCOES_REPIQUE.map(m => [m, m ? `Toca em ${m} min` : "Não toca"]), tl.repique, (x) => AL.definirTela({ repique: Number(x) }), "Tocar de novo")));
  sT.append(cT); t.append(sT);

  // contas
  const s3 = document.createElement("div"); s3.className = "secao";
  s3.innerHTML = `<h2>Contas depois de desligar</h2>`;
  const c3 = document.createElement("div"); c3.className = "cartao al-ajustes";
  const n = AL.nivelAtual(), nv = AL.NIVEIS[n];
  c3.insertAdjacentHTML("beforeend", `<div class="al-nivel"><span class="al-nivel-n">${n}</span><div><b>${escapar(nv.nome)}</b><small>Ex.: ${escapar(nv.ex)} · ${c.modo === "auto" ? "nível automático: sobe quando você resolve rápido e sem errar, desce quando demora ou erra muito" : "nível fixo"}</small></div></div>`);
  const nivs = [["auto", "Automática"], ...[1, 2, 3, 4, 5, 6, 7, 8].map(k => [`f${k}`, `Fixa: nível ${k}`])];
  c3.append(linha("Dificuldade", "", seletor(nivs, c.modo === "auto" ? "auto" : `f${c.fixo}`, (x) => { if (x === "auto") AL.definirContas({ modo: "auto" }); else AL.definirContas({ modo: "fixo", fixo: Number(x.slice(1)) }); redesenhar(); }, "Dificuldade")));
  c3.append(linha("Contas seguidas", "Já sem som. Errou, a conta troca e a contagem recomeça. Depois de 6 erros seguidos, as contas ficam bem fáceis: nunca fica preso.", seletor([2, 3, 4, 5].map(k => [k, `${k} contas`]), c.quantas, (x) => AL.definirContas({ quantas: Number(x) }), "Contas seguidas")));
  c3.insertAdjacentHTML("beforeend", `<p class="sub al-xp">${icone("⚡", "ico-inline")} Cada conta certa vale ${AL.XP_POR_CONTA} XP (uma vez por dia; no teste, não).</p>`);
  s3.append(c3); t.append(s3);

  // teste e permissões
  const s4 = document.createElement("div"); s4.className = "secao";
  s4.innerHTML = `<h2>Teste e permissões</h2>`;
  const c4 = document.createElement("div"); c4.className = "cartao al-ajustes";
  const bT = document.createElement("button"); bT.className = "botao"; bT.innerHTML = `${icone("⏰", "ico-inline")} Testar alarme em 1 minuto`;
  bT.onclick = testar;
  c4.append(bT);
  const perm = document.createElement("div"); perm.className = "al-perm";
  c4.append(perm);
  s4.append(c4); t.append(s4);
  AL.lerSituacao().then(st => {
    if (!perm.isConnected) return;
    if (!st) { perm.innerHTML = `<p class="sub">As permissões aparecem aqui no app do celular.</p>`; return; }
    // tela cheia OU sobre outros apps basta para a tela do alarme abrir sozinha; a de tela cheia volta a ser negada a
    // cada atualização do app (Android 14+, app de fora da loja), então a recomendada é "sobre outros apps"
    const abre = st.telaCheia || st.sobreApps;
    const itens = [["exato", "Alarmes exatos", "Para tocar na hora certa, mesmo com o celular em repouso.", st.exato],
      ["sobreApps", "Exibir sobre outros apps", "Recomendada: abre a tela do alarme por cima de tudo, até com a tela apagada, e não se perde ao atualizar o app.", st.sobreApps],
      ["telaCheia", "Tela cheia", st.sobreApps ? "Opcional: com \"Exibir sobre outros apps\" ligada, não faz falta (o Android volta a negá-la a cada atualização)." : "Faz a tela do alarme abrir com a tela apagada, mas o Android volta a negá-la a cada atualização do app.", st.telaCheia == null ? null : (st.telaCheia ? true : abre ? "opcional" : false)],
      ["notificacoes", "Notificações", "A notificação do alarme, a das contas e o aviso da véspera.", st.notificacoes],
      ["bateria", "Sem restrição de bateria", "Recomendado em alguns celulares (Xiaomi, Samsung, Motorola).", st.bateria]];
    for (const [qual, rot, sub, ok] of itens) {
      if (ok == null) continue;
      const b = document.createElement("button"); b.className = `botao mini ${ok ? "secundario" : ""}`; b.textContent = ok === true ? "Ver" : "Permitir";
      b.onclick = () => (qual === "sobreApps" && !ok ? pedirSobreApps() : AL.abrirAjuste(qual));
      const l = linha(`${ok === true ? icone("✅", "ico-inline") : ok ? icone("💡", "ico-inline") : icone("⚠️", "ico-inline")} ${rot}`, sub, b);
      l.dataset.perm = qual;
      perm.append(l);
    }
    if (st.proximo) perm.insertAdjacentHTML("beforeend", `<p class="sub al-agendados">${st.agendados || 0} ${st.agendados === 1 ? "alarme agendado" : "alarmes agendados"} no celular; o próximo aparece no relógio da barra de status.</p>`);
  });

  // diário do alarme: o que o celular fez nos últimos alarmes e testes (para saber o que deu errado)
  const sDi = document.createElement("div"); sDi.className = "secao";
  sDi.innerHTML = `<h2>O que aconteceu</h2>`;
  const cDi = document.createElement("div"); cDi.className = "cartao al-diario";
  cDi.innerHTML = `<p class="sub">Carregando…</p>`;
  sDi.append(cDi); t.append(sDi);
  mostrarDiario(cDi);

  // como tem acordado
  const st = AL.estatisticas(30);
  const s5 = document.createElement("div"); s5.className = "secao";
  s5.innerHTML = `<h2>Como você tem acordado</h2>`;
  const c5 = document.createElement("div"); c5.className = "cartao al-ajustes";
  if (!st.n) c5.innerHTML = `<p class="sub" style="margin:0">Aparece aqui depois dos primeiros alarmes: a hora em que deslizou, quanto tempo levou nas contas e o nível.</p>`;
  else {
    c5.innerHTML = `<div class="al-resumo"><div><b>${AL.horaCurta(st.horaMedia) || "—"}</b><small>desligou, em média</small></div><div><b>${segs(st.tempoMedio)}</b><small>nas contas</small></div><div><b>${st.acertos}</b><small>contas certas</small></div></div>`;
    const ul = document.createElement("ul"); ul.className = "al-hist";
    for (const r of st.lista.slice(0, 7)) ul.insertAdjacentHTML("beforeend", `<li><span>${escapar(dataBR(r.data, { weekday: "short", day: "2-digit", month: "2-digit" }))}</span><b>${AL.horaCurta(r.hora) || "—"}</b><small>${segs(r.ms)} · ${r.acertos} certa${r.acertos === 1 ? "" : "s"}${r.erros ? `, ${r.erros} errada${r.erros === 1 ? "" : "s"}` : ""} · nível ${r.nivel}${r.voltas ? ` · tocou de novo ${r.voltas}×` : ""}</small></li>`);
    c5.append(ul);
  }
  s5.append(c5); t.append(s5);
  if (manter) t.scrollTop = rolagem;
}
