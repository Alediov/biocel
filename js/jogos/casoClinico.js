// Motor dos jogos de caso clínico em etapas (Estágio e Grau, Escolha o Anestésico; pedido do Alediov, 04/11/2026),
// no molde da Consulta Segura: a ficha do paciente no alto, a barra das etapas e uma escolha por vez, cada uma com a
// explicação do livro e a página. Os casos vêm prontos do JSON: { id, titulo, texto, sinais, etapas: [{ tipo,
// enunciado, opcoes, certa, aceitas?, explic, porQueNao?, fonte: [texto] }] }. `extra(c)` devolve um HTML que entra na
// ficha (o periograma) e `procedimento(c)` a linha do que foi planejado.
// Prova Prática (pratica.js, 04/11/2026): uma etapa pode ser de ESCOLHA MÚLTIPLA ({ multi: true, enunciado, grupos:
// [{ titulo, opcoes: [{ id, rot }] }], avaliar(sel) → { certo, html, marcas: { id: "correta"|"incorreta"|"faltou" },
// depois: [etapas] } }): as etapas de `depois` entram logo em seguida (o caso cresce). `e.rotulo` troca o nome da etapa
// na barra, `e.extraHtml` entra no retorno e `o.aoResponder(c, e, certo)` / `o.ligarRetorno(el, e)` avisam o jogo.
import { terminar } from "../jogos.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { escapar, confete } from "../ui.js";
import { icone } from "../icones.js";
import { salvar } from "../estado.js";

const num = (n) => (Math.round(n * 10) / 10).toLocaleString("pt-BR");

/** Sorteia `n` casos, primeiro os menos vistos (estado `est.casos[id].vezes`). */
export function escolherCasos(casos, est, n, filtro = () => true) {
  return embaralhar(casos.filter(filtro)).sort((a, b) => (est.casos[a.id]?.vezes || 0) - (est.casos[b.id]?.vezes || 0)).slice(0, n);
}

/**
 * Joga uma lista de casos e, no fim, chama `terminar` do jogos.js.
 * o: { jogo, est, lista, rotulo ("Caso"), nomes ({ tipo: "Nome da etapa" }), icone(c), faixa(c), extra(c), procedimento(c), ligar(el, c) }
 */
export function jogarCasos(cam, o) {
  const placar = [];
  let i = 0;
  const proximo = () => (i >= o.lista.length ? fim() : jogarCaso(o.lista[i], (r) => { placar.push(r); i++; proximo(); }));

  function jogarCaso(c, aoAcabar) {
    const r = { c, etapas: [] };
    cam.info.textContent = `${o.rotulo || "Caso"} ${i + 1}/${o.lista.length}`;
    cam.corpo.scrollTop = 0;
    const proc = o.procedimento?.(c);
    cam.corpo.innerHTML = `<div class="consulta cc">
      <div class="prontuario cc-ficha">
        <div class="pr-faixa">${icone(o.icone?.(c) || "🩺", "ico3d")}<span>${escapar(o.faixa?.(c) || "")}</span><b>${o.rotulo || "Caso"} ${i + 1}</b></div>
        <h3>${escapar(c.titulo)}</h3>
        ${c.texto ? `<p>${escapar(c.texto)}</p>` : ""}
        ${c.paciente ? `<p>${escapar(c.paciente)}</p>` : ""}
        <div class="pr-sinais">${(c.sinais || []).map((s, k) => `<span style="--k:${k}">${escapar(s)}</span>`).join("")}</div>
        ${proc ? `<div class="pr-proc">${icone("🦷", "ico-inline")} <b>Planejado:</b> ${escapar(proc)}</div>` : ""}
        ${o.extra?.(c) || ""}
      </div>
      <div class="mira-etapas cc-etapas"></div>
      <div class="mira-acao"></div></div>`;
    o.ligar?.(cam.corpo, c);
    const acao = cam.corpo.querySelector(".mira-acao");
    const estados = [];
    const barra = () => {
      const b = cam.corpo.querySelector(".cc-etapas"), n = c.etapas.length;
      b.classList.toggle("cc-muitas", n > 5);
      b.style.gridTemplateColumns = n > 5 ? "" : `repeat(${n}, minmax(0, 1fr))`;
      b.innerHTML = c.etapas.map((e, k) => `<span data-k="${k}" class="${estados[k] || ""}"><i>${k + 1}</i>${escapar(e.rotulo || o.nomes?.[e.tipo] || e.tipo)}</span>`).join("");
    };
    barra();
    const marca = (k, res) => { estados[k] = res === true ? "ok" : res === false ? "erro" : "atual"; const s = cam.corpo.querySelector(`.cc-etapas [data-k="${k}"]`); if (s) s.className = estados[k]; };
    const seguir = (fn, txt = "Seguir") => { const b = document.createElement("button"); b.className = "botao"; b.textContent = txt; b.onclick = fn; acao.append(b); requestAnimationFrame(() => b.scrollIntoView({ block: "nearest", behavior: "smooth" })); return b; };

    const etapa = (k) => {
      if (k >= c.etapas.length) return nota();
      const e = c.etapas[k];
      marca(k);
      if (e.multi) return etapaMulti(k, e);
      const aceitas = new Set(e.aceitas || [e.certa]);
      acao.innerHTML = `<p class="enunciado">${escapar(e.enunciado)}</p><div class="opcoes"></div>`;
      const box = acao.querySelector(".opcoes");
      // a ordem das opções numéricas (NIC, estágio, grau, tubetes) fica; as de texto são embaralhadas
      const ordem = e.opcoes.map((t, idx) => ({ t, idx }));
      const fixa = ["pic", "diag", "estagio", "extensao", "grau", "gengExt", "tubetes"].includes(e.tipo);
      for (const { t, idx } of fixa ? ordem : embaralhar(ordem)) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = t; b.dataset.idx = idx;
        b.onclick = () => {
          const certo = aceitas.has(idx);
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (+x.dataset.idx === e.certa || (certo && +x.dataset.idx === idx)) x.classList.add("correta"); });
          if (!certo) { b.classList.add("incorreta"); vibrar(40); }
          tocar(certo ? "certo" : "errado");
          r.etapas.push(certo ? 1 : 0); marca(k, certo);
          o.aoResponder?.(c, e, certo);
          const porQue = !certo && e.porQueNao && idx !== e.certa ? e.porQueNao[idx - 1 < 0 ? 0 : idx - 1] : null;
          acao.insertAdjacentHTML("beforeend", `<div class="feedback-mini entra ${certo ? "certo" : "errado"}">
            <b>${certo ? "Isso!" : `Era: ${escapar(e.opcoes[e.certa])}`}</b>
            ${porQue ? `<p class="cc-porque">${escapar(t)}: ${escapar(porQue)}</p>` : ""}
            <p>${escapar(e.explic)}</p>
            <small class="cc-fonte">${(e.fonte || []).map(escapar).join(" · ")}</small>${e.extraHtml || ""}</div>`);
          o.ligarRetorno?.(acao.lastElementChild, e);
          seguir(() => etapa(k + 1), k + 1 < c.etapas.length ? "Seguir" : "Ver o resultado do caso");
        };
        box.append(b);
      }
    };

    // escolha de várias opções (as técnicas do caso): marca e confere; as etapas de `depois` entram em seguida
    const etapaMulti = (k, e) => {
      const sel = new Set();
      acao.innerHTML = `<p class="enunciado">${escapar(e.enunciado)}</p><div class="cc-multi">${e.grupos.map(g => `<div class="cc-grupo"><b>${escapar(g.titulo)}</b><div class="cc-chips">${g.opcoes.map(op => `<button class="cc-chip" data-id="${escapar(op.id)}">${escapar(op.rot)}</button>`).join("")}</div></div>`).join("")}</div>`;
      const ok = document.createElement("button"); ok.className = "botao cc-conferir"; ok.textContent = "Conferir"; ok.disabled = true;
      acao.append(ok);
      acao.querySelectorAll(".cc-chip").forEach(b => (b.onclick = () => {
        const id = b.dataset.id;
        if (sel.has(id)) sel.delete(id); else sel.add(id);
        b.classList.toggle("on", sel.has(id)); b.setAttribute("aria-pressed", sel.has(id));
        tocar("toque"); ok.disabled = !sel.size;
      }));
      ok.onclick = () => {
        const res = e.avaliar([...sel]);
        ok.remove();
        acao.querySelectorAll(".cc-chip").forEach(b => { b.disabled = true; const m = res.marcas?.[b.dataset.id]; if (m) b.classList.add(m); });
        tocar(res.certo ? "certo" : "errado"); if (!res.certo) vibrar(40);
        r.etapas.push(res.certo ? 1 : 0); marca(k, res.certo);
        o.aoResponder?.(c, e, res.certo);
        acao.insertAdjacentHTML("beforeend", `<div class="feedback-mini entra ${res.certo ? "certo" : "errado"}">${res.html}</div>`);
        o.ligarRetorno?.(acao.lastElementChild, e);
        if (res.depois?.length) { c.etapas.splice(k + 1, 0, ...res.depois); barra(); }
        seguir(() => etapa(k + 1), k + 1 < c.etapas.length ? "Seguir" : "Ver o resultado do caso");
      };
    };

    const nota = () => {
      const tot = r.etapas.reduce((a, b) => a + b, 0), max = c.etapas.length;
      const st = o.est.casos[c.id] ??= { vezes: 0, pontos: 0 };
      st.vezes++; st.pontos += tot; salvar();
      const est = Math.round((tot / max) * 3);
      acao.innerHTML = `<div class="mira-nota"><div class="estrelas">${[1, 2, 3].map(k => `<i class="${est >= k ? "on" : ""}">★</i>`).join("")}</div>
        <b>${tot} de ${max}</b><small>${escapar(c.resposta || "")}</small></div>`;
      if (tot === max) { confete(900); tocar("combo"); }
      seguir(() => aoAcabar(r), i + 1 < o.lista.length ? `Próximo ${(o.rotulo || "caso").toLowerCase()}` : "Ver resultado");
    };
    etapa(0);
  }

  function fim() {
    const total = placar.reduce((s, r) => s + r.etapas.reduce((a, b) => a + b, 0), 0), max = placar.reduce((s, r) => s + r.c.etapas.length, 0);
    o.est.partidas = (o.est.partidas || 0) + 1; salvar();
    const ic = (e) => (e ? `<i class="ok">✓</i>` : `<i class="erro">✗</i>`);
    const linhas = placar.map(r => `<li><span>${escapar(r.c.titulo)}<small>${escapar(r.c.resposta || "")}</small></span><b>${r.etapas.map(ic).join("")}</b></li>`).join("");
    terminar(cam, o.jogo, total, { xp: Math.round(total * 2), moedas: Math.round(total) },
      `<p class="sub">${num(total)} de ${max} etapas certas.</p><ul class="mira-resumo">${linhas}</ul>`, "pontos");
  }

  proximo();
}

/** Tela de consulta (tabelas ou definições do livro), com o botão de voltar. itens: [{ titulo, texto, fonte: [..] }] */
export function telaConsulta(cam, titulo, itens, voltar, aviso = "") {
  cam.info.textContent = "";
  cam.corpo.scrollTop = 0;
  cam.corpo.innerHTML = `<div class="lam cc-ref"><button class="lam-voltar">‹ Voltar</button><h2>${escapar(titulo)}</h2>
    ${aviso ? `<p class="cc-aviso">${escapar(aviso)}</p>` : ""}
    ${itens.map(t => `<details class="lam-par cc-ref-item"><summary><b>${escapar(t.titulo)}</b></summary><p>${escapar(t.texto)}</p><small class="cc-fonte">${(t.fonte || []).map(escapar).join(" · ")}</small></details>`).join("")}</div>`;
  cam.corpo.querySelector(".lam-voltar").onclick = voltar;
}
