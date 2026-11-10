// Consulta Segura (Burket's Oral Medicine): pacientes com doença sistêmica. Para cada um, a
// ficha (história, sinais e exames, procedimento) e três etapas: conduta, cuidados (marcar
// todos os certos) e uma pergunta. Dados em extras/jogos/consulta.json, com a página do PDF.
import { abrirCamada, terminar, semConteudo } from "../jogos.js";
import { extra } from "../dados.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { escapar, confete } from "../ui.js";
import { icone } from "../icones.js";
import { E, salvar } from "../estado.js";

const ICONE = { "Cardiovascular": "🫀", "Hemostasia": "🩸", "Renal": "🧪", "Endócrino": "🍬", "Oncologia": "🧬", "Respiratório": "🫁", "Hematologia": "🧫", "Gastro e fígado": "🩺" };
const num = (n) => (Math.round(n * 10) / 10).toLocaleString("pt-BR");
const fonte = (c) => `Burket, cap. ${+c.fonte.unidade.slice(1, 3)}, p. ${c.fonte.pagina} do PDF`;

export async function jogarConsulta(opts = {}) {
  const cam = abrirCamada("Consulta Segura");
  const D = await extra("jogo:consulta");
  if (!D?.casos?.length) return semConteudo(cam, "Os casos ainda não chegaram. Sincronize com internet.");
  const est = E().consulta ??= { partidas: 0, casos: {} };
  // prioriza os casos menos vistos
  const lista = embaralhar(D.casos).sort((a, b) => (est.casos[a.id]?.vezes || 0) - (est.casos[b.id]?.vezes || 0)).slice(0, opts.quantas || 5);
  const placar = [];
  let i = 0;

  function proximo() {
    if (i >= lista.length) return fim();
    jogarCaso(lista[i], (r) => { placar.push(r); i++; proximo(); });
  }

  function jogarCaso(c, aoAcabar) {
    const r = { c, etapas: [] };
    cam.info.textContent = `Paciente ${i + 1}/${lista.length}`;
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="consulta">
      <div class="prontuario">
        <div class="pr-faixa">${icone(ICONE[c.sistema] || "🩺", "ico3d")}<span>${escapar(c.sistema)}</span><b>Ficha ${i + 1}</b></div>
        <h3>${escapar(c.titulo)}</h3>
        <p>${escapar(c.paciente)}</p>
        <div class="pr-sinais">${c.sinais.map((s, k) => `<span style="--k:${k}">${escapar(s)}</span>`).join("")}</div>
        <div class="pr-proc">${icone("🦷", "ico-inline")} <b>Planejado:</b> ${escapar(c.procedimento)}</div>
        <svg class="pr-ecg" viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 18 H70 L80 18 L88 4 L96 28 L104 12 L110 18 H190 L200 18 L208 4 L216 28 L224 12 L230 18 H300"/></svg>
      </div>
      <div class="mira-etapas consulta-etapas">${["Conduta", "Cuidados", "Pergunta"].map((n, k) => `<span data-k="${k}"><i>${k + 1}</i>${n}</span>`).join("")}</div>
      <div class="mira-acao"></div></div>`;
    const acao = cam.corpo.querySelector(".mira-acao");
    const etapa = (k, res) => { const s = cam.corpo.querySelector(`.consulta-etapas [data-k="${k}"]`); s.className = res === true ? "ok" : res === "meio" ? "meio" : res === false ? "erro" : "atual"; };
    const seguir = (fn, txt = "Seguir") => { const b = document.createElement("button"); b.className = "botao"; b.textContent = txt; b.onclick = fn; acao.append(b); requestAnimationFrame(() => b.scrollIntoView({ block: "nearest", behavior: "smooth" })); return b; };
    const fb = (res, titulo, texto) => `<div class="feedback-mini entra ${res === true ? "certo" : res === "meio" ? "parcial" : "errado"}"><b>${titulo}</b><p>${texto}</p></div>`;
    const som = (res) => { if (res === true) tocar("certo"); else { tocar("errado"); vibrar(40); } };

    function escolha(k, enunciado, opcoes, certa, explic, depois, rotulos = ["Isso!", "Não é a melhor"]) {
      etapa(k);
      acao.innerHTML = `<p class="enunciado">${escapar(enunciado)}</p><div class="opcoes"></div>`;
      const box = acao.querySelector(".opcoes");
      for (const { t, idx } of embaralhar(opcoes.map((t, idx) => ({ t, idx })))) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = t;
        b.onclick = () => {
          const certo = idx === certa;
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === opcoes[certa]) x.classList.add("correta"); });
          if (!certo) b.classList.add("incorreta");
          som(certo); r.etapas.push(certo ? 1 : 0); etapa(k, certo);
          acao.insertAdjacentHTML("beforeend", fb(certo, certo ? rotulos[0] : `${rotulos[1]}: ${escapar(opcoes[certa])}`, explic));
          seguir(depois);
        };
        box.append(b);
      }
    }

    // 1) conduta
    const condutas = c.conduta.opcoes || D.condutas;
    escolha(0, `${c.procedimento} O que fazer hoje?`, condutas, c.conduta.certa, escapar(c.conduta.explic), cuidados);

    // 2) cuidados (marcar todos)
    function cuidados() {
      etapa(1);
      const K = c.cuidados, marcados = new Set();
      acao.innerHTML = `<p class="enunciado">Quais cuidados valem para este paciente?</p><p class="sub dica-mira">Marque todos os que achar certos.</p><div class="chips-nervos"></div>`;
      const box = acao.querySelector(".chips-nervos");
      embaralhar(K.opcoes.map((t, idx) => ({ t, idx }))).forEach(({ t, idx }, n) => {
        const b = document.createElement("button"); b.className = "chip-nervo chip-cuidado"; b.textContent = t; b.dataset.i = idx; b.style.setProperty("--k", n);
        b.onclick = () => { if (marcados.has(idx)) marcados.delete(idx); else marcados.add(idx); b.classList.toggle("on"); tocar("toque"); conf.disabled = !marcados.size; };
        box.append(b);
      });
      const conf = seguir(() => {
        conf.remove();
        const certos = new Set(K.certos);
        const errados = [...marcados].filter(x => !certos.has(x)), faltaram = [...certos].filter(x => !marcados.has(x));
        box.querySelectorAll(".chip-cuidado").forEach(b => {
          const x = +b.dataset.i; b.disabled = true;
          if (marcados.has(x)) b.classList.add(certos.has(x) ? "certo" : "errado");
          else if (certos.has(x)) b.classList.add("faltou");
        });
        const erros = errados.length + faltaram.length;
        const res = !erros ? true : erros <= 1 ? "meio" : false;
        som(res); r.etapas.push(res === true ? 1 : res === "meio" ? 0.5 : 0); etapa(1, res);
        const titulo = res === true ? "Todos certos!" : res === "meio" ? "Quase" : `${erros} escolhas a rever`;
        acao.insertAdjacentHTML("beforeend", fb(res, titulo, `${escapar(K.explic)}${faltaram.length ? `<br><small>Faltou: ${faltaram.map(x => escapar(K.opcoes[x])).join("; ")}.</small>` : ""}`));
        seguir(pergunta);
      }, "Confirmar");
      conf.disabled = true;
    }

    // 3) pergunta e nota do paciente
    function pergunta() {
      const q = c.pergunta;
      escolha(2, q.enunciado, q.opcoes, q.certa, `${escapar(q.explic)}<br><small>${escapar(fonte(c))}</small>`, () => aoAcabar(r), ["Certo!", "Era"]);
      // depois de responder, mostra a nota e troca o botão
      const box = acao.querySelector(".opcoes");
      box.addEventListener("click", () => setTimeout(() => {
        const tot = r.etapas.reduce((a, b) => a + b, 0);
        const st = est.casos[c.id] ??= { vezes: 0, pontos: 0 };
        st.vezes++; st.pontos += tot; salvar();
        const bt = acao.querySelector(":scope > .botao");
        bt.insertAdjacentHTML("beforebegin", `<div class="mira-nota"><div class="estrelas">${[1, 2, 3].map(k => `<i class="${tot >= k ? "on" : ""}">★</i>`).join("")}</div><b>${num(tot)} de 3</b><small>${tot >= 3 ? "Atendimento seguro!" : tot >= 2 ? "Bom, com um detalhe a rever." : "Vale reler o trecho no livro."}</small></div>`);
        bt.textContent = i + 1 < lista.length ? "Próximo paciente" : "Ver resultado";
        if (tot >= 3) { confete(900); tocar("combo"); }
      }, 0), { once: true });
    }
  }

  function fim() {
    const total = placar.reduce((s, r) => s + r.etapas.reduce((a, b) => a + b, 0), 0), max = placar.length * 3;
    est.partidas++; salvar();
    const ic = (e) => e === 1 ? `<i class="ok">✓</i>` : e ? `<i class="meio">½</i>` : `<i class="erro">✗</i>`;
    const linhas = placar.map(r => `<li><span>${escapar(r.c.titulo)}<small>${escapar(fonte(r.c))}</small></span><b>${r.etapas.map(ic).join("")}</b></li>`).join("");
    terminar(cam, "consulta", Math.round(total * 10) / 10, { xp: Math.round(total * 2.4), moedas: Math.round(total * 1.2) },
      `<p class="sub">${num(total)} de ${max} etapas (conduta, cuidados e pergunta).</p><ul class="mira-resumo">${linhas}</ul>`, "pontos");
  }

  proximo();
}
