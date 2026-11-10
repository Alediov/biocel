// Versão Demo: no lugar da trilha diária, trilhas por disciplina (Anestesiologia, Patologia,
// Farmacologia, Estomatologia), cada uma com etapas que abrem em sequência. As trilhas vêm
// embutidas no app como "dias" de chave `trilha-N-<disciplina>` (cada sessão é uma etapa).
import { E, salvar } from "./estado.js";
import { listarDias, carregarDia } from "./dados.js";
import { desenharDia } from "./telas.js";
import { desenharSlots } from "./bausUI.js";
import { icone } from "./icones.js";
import { faixaLiga } from "./liga.js";
import { faixaTemporada } from "./temporada.js";
import { bannerSazonal } from "./telaEventos.js";
import { regouHoje } from "./jardim.js";
import { moli } from "./personagens.js";
import { escapar } from "./ui.js";
import { tocar } from "./sons.js";

const feito = (id) => !!E().concluidas[id];
const tela = () => document.getElementById("tela");
let geracao = 0;

export async function telaTrilhas() {
  const t = tela(), gen = ++geracao;
  const chaves = (await listarDias()).filter(k => k.startsWith("trilha-"));
  const trilhas = [];
  for (const k of chaves) trilhas.push(await carregarDia(k));
  if (gen !== geracao) return;
  t.innerHTML = "";

  const zonaBaus = document.createElement("div"); t.append(zonaBaus); desenharSlots(zonaBaus);
  const atalhos = document.createElement("div"); atalhos.className = "atalhos-trilha";
  for (const [k, [aba, ic, rot]] of [["leitura", "📖", "Leitura"], ["treino", "🎯", "Treino"], ["jogos", "🎮", "Jogos"], ["ranking", "🏆", "Ranking"]].entries()) {
    const b = document.createElement("button"); b.style.setProperty("--k", k);
    b.className = `atalho ${aba === "jardim" && !regouHoje() ? "alerta" : ""}`; b.innerHTML = `${icone(ic, "ico3d")}<span>${rot}</span>`;
    b.onclick = () => window.dispatchEvent(["ranking", "leitura"].includes(aba) ? new Event("biocel-" + aba) : new CustomEvent("oq-ir", { detail: aba }));
    atalhos.append(b);
  }
  t.append(atalhos, faixaLiga(), faixaTemporada());
  bannerSazonal(t);

  if (!trilhas.length) {
    t.insertAdjacentHTML("beforeend", `<div class="vazio">${moli("neutro")}<h2>Nenhuma trilha encontrada</h2><p>Reinstale o app para recuperar as trilhas.</p></div>`);
    return;
  }

  let sel = E().config.trilhaDemo;
  if (!trilhas.some(x => x.data === sel)) sel = trilhas[0].data;
  const lista = document.createElement("div"); lista.className = "trilhas-demo";
  trilhas.forEach((tr, k) => {
    const ids = tr.sessoes.flatMap(s => s.licoes.map(l => l.id)), n = ids.filter(feito).length;
    const b = document.createElement("button");
    b.className = `trilha-demo ${tr.data === sel ? "on" : ""} ${n === ids.length ? "completa" : ""}`;
    b.style.setProperty("--cor", tr.cor || "var(--acento)"); b.style.setProperty("--k", k);
    b.innerHTML = `${icone(tr.icone || "📘", "ico3d")}<span class="td-txt"><b>${escapar(tr.nome)}</b><small>${n === ids.length ? "Concluída ✓" : `${n} de ${ids.length} lições`}</small></span><span class="td-barra"><i style="width:${Math.round((n / ids.length) * 100)}%"></i></span>`;
    b.onclick = () => { if (tr.data === sel) return; tocar("toque"); E().config.trilhaDemo = tr.data; salvar(); telaTrilhas(); };
    lista.append(b);
  });
  t.append(lista);

  const tr = trilhas.find(x => x.data === sel);
  t.insertAdjacentHTML("beforeend", `<p class="trilha-livro">${icone("📚", "ico-inline")} ${escapar(tr.livro || "")}</p>`);
  let anteriorOk = true, atualMarcado = false;
  tr.sessoes.forEach((s, k) => {
    const etapa = { data: `${tr.data}-e${k + 1}`, disciplina: tr.disciplina, tema: s.titulo, sessoes: [s] };
    atualMarcado = desenharDia(t, etapa, atualMarcado, { etapa: { n: k + 1, icone: s.icone || tr.icone }, bloqueado: !anteriorOk, refazer: telaTrilhas }) || atualMarcado;
    anteriorOk = s.licoes.every(l => feito(l.id));
  });
  if (anteriorOk) {
    const outra = trilhas.find(x => !x.sessoes.every(s => s.licoes.every(l => feito(l.id))));
    t.insertAdjacentHTML("beforeend", `<div class="vazio trilha-fim">${moli("uau")}<h2>Trilha concluída!</h2><p>${outra ? `Que tal seguir para ${escapar(outra.nome)}? As questões desta trilha continuam no Treino e nos jogos.` : "Você fechou todas as trilhas da Demo. As questões continuam no Treino e nos jogos."}</p></div>`);
  }
  const atual = t.querySelector(".no.atual");
  if (atual) atual.scrollIntoView({ block: "center" });
}
