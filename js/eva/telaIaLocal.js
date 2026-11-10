// A parte dos ajustes da Eva sobre a IA local (pedido do Alediov, 09/11/2026; ialocal.js, docs/plano-eva-local.md):
// em "Responder com a IA", a escolha "No celular (offline)" ou "Claude (API)"; com a do celular, os dois modelos
// (baixar com andamento, continuar, pausar, apagar com 2 toques, usar este) e o "Testar" com a velocidade.
// Estilo em app/eva-local.css (prefixo evl-, posto por garantirCss).
import * as EV from "./eva.js";
import * as IL from "./ialocal.js";

export { ehLocal } from "./ialocal.js";
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const mb = (b) => `${Math.round((Number(b) || 0) / 1e6).toLocaleString("pt-BR")} MB`;

export function garantirCss() {
  if (typeof document === "undefined" || document.querySelector('link[href="eva-local.css"]')) return;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "eva-local.css"; document.head.append(l);
}

/** O aviso no alto da conversa quando a fonte é o celular e não dá para usar (ou "" se não é caso da IA local). */
export function avisoLocal(motivo) {
  if (motivo === "sem-modelo") return "A IA do celular está ligada, mas falta baixar o modelo.";
  if (motivo === "navegador" || motivo === "sem-motor") return "A IA do celular só funciona no app Android: por enquanto, respostas rápidas.";
  return "";
}

/** A seção "Onde a IA roda" + o lugar da parte do celular (preenchida por ligarFonte). */
export function htmlFonte(a) {
  garantirCss();
  const local = IL.ehLocal(a);
  return `<section class="eva-sec evl-fonte"><h3>Onde a IA roda</h3>
      <div class="eva-seg">
        <button type="button" data-fonte="local" class="${local ? "eva-on" : ""}">No celular (offline)</button>
        <button type="button" data-fonte="claude" class="${local ? "" : "eva-on"}">Claude (API)</button>
      </div>
      <p class="eva-nota">${local ? "Um modelo pequeno roda no próprio celular: sem internet, sem custo, e nada sai dele. É mais simples que o Claude." : "Pela API do Claude: responde melhor, precisa de internet e da chave, e tem custo."}</p></section>
    <div class="eva-so-local"${local ? "" : " hidden"}><section class="eva-sec evl-sec"><h3>Modelo no celular</h3><p class="eva-nota">Carregando…</p></section></div>`;
}

let ouvindo = null;
/** Liga a escolha da fonte e desenha a parte do celular. */
export function ligarFonte(f, { aoMudar } = {}) {
  f.querySelectorAll("[data-fonte]").forEach(b => (b.onclick = () => {
    const v = b.dataset.fonte;
    EV.definirAjuste("fonte", v);
    f.querySelectorAll("[data-fonte]").forEach(x => x.classList.toggle("eva-on", x === b));
    const nota = f.querySelector(".evl-fonte .eva-nota");
    if (nota) nota.textContent = v === "local" ? "Um modelo pequeno roda no próprio celular: sem internet, sem custo, e nada sai dele. É mais simples que o Claude." : "Pela API do Claude: responde melhor, precisa de internet e da chave, e tem custo.";
    f.querySelector(".eva-so-local").hidden = v !== "local";
    f.querySelector(".eva-so-claude").hidden = v === "local";
    if (v === "local") desenharLocal(f, aoMudar);
    aoMudar?.();
  }));
  if (IL.ehLocal(EV.ajustes())) desenharLocal(f, aoMudar);
}

async function desenharLocal(f, aoMudar) {
  const el = f.querySelector(".eva-so-local .evl-sec");
  if (!el) return;
  const s = await IL.situacao();
  if (!el.isConnected) return;
  const a = EV.ajustes(), escolhido = IL.modeloDe(a);
  const pelo = (id) => (s.modelos || []).find(m => m.id === id) || {};
  let topo = "";
  if (s.motivo === "navegador") topo = `<p class="evl-sit evl-ruim">Só no app Android. Aqui no navegador, a Eva usa as falas prontas.</p>`;
  else if (s.motivo === "sem-motor") topo = `<p class="evl-sit evl-ruim">Este aplicativo ainda não tem o motor da IA local. Ele vem numa versão nova do app.</p>`;
  else if (s.memoria?.total) topo = `<p class="evl-sit">Memória do celular: ${mb(s.memoria.livre)} livres de ${mb(s.memoria.total)}${s.variante ? ` · motor ${s.variante.endsWith("_v82") ? "rápido (dotprod)" : "comum"}` : ""}</p>`;
  const cartao = (id) => {
    const m = IL.MODELOS[id], x = pelo(id), baixando = s.baixando === id;
    const pct = baixando && s.total ? Math.round((s.feito / s.total) * 100) : x.parcial && x.aprox ? Math.round((x.parcial / x.aprox) * 100) : 0;
    const estado = x.pronto ? `Baixado e conferido${x.sha ? ` · SHA-256 ${x.sha.slice(0, 8)}…${x.sha.slice(-4)}` : ""}` : baixando ? `Baixando… ${pct}%` : x.parcial ? `Pausado em ${pct}%` : "Não baixado";
    const botoes = s.disponivel === false ? "" : x.pronto
      ? `<button type="button" class="eva-bt eva-sec eva-ruim evl-apagar">Apagar</button>`
      : baixando ? `<button type="button" class="eva-bt eva-sec evl-pausar">Pausar</button>`
        : `<button type="button" class="eva-bt eva-sec evl-baixar">${x.parcial ? "Continuar" : `Baixar (${m.tamanho})`}</button>`;
    return `<div class="evl-mod${escolhido === id ? " evl-on" : ""}" data-id="${id}">
        <label class="evl-escolha"><input type="radio" name="evl-modelo" value="${id}" ${escolhido === id ? "checked" : ""}><span><b>${esc(m.nome)}</b> <small>${esc(m.tamanho)}${id === IL.PADRAO ? " · recomendada" : ""}</small><br><small>${esc(m.desc)}</small></span></label>
        <p class="evl-estado ${x.pronto ? "evl-ok" : ""}">${estado}</p>
        <div class="evl-barra"${baixando || (x.parcial && !x.pronto) ? "" : " hidden"}><i style="--p:${pct / 100}"></i></div>
        <div class="eva-linha">${botoes}</div>
      </div>`;
  };
  el.innerHTML = `<h3>Modelo no celular</h3>${topo}
    <div class="evl-modelos">${Object.keys(IL.MODELOS).map(cartao).join("")}</div>
    <button type="button" class="eva-bt eva-sec evl-testar" ${pelo(escolhido).pronto ? "" : "disabled"}>Testar</button>
    <p class="evl-teste-res" hidden></p>
    <p class="eva-nota">Quando ela demora demais ou responde algo sem sentido, a Eva usa as falas prontas no lugar. O Wi-Fi é melhor para baixar.</p>`;

  el.querySelectorAll('input[name="evl-modelo"]').forEach(r => (r.onchange = () => {
    EV.definirAjuste("modeloLocal", r.value);
    IL.liberar();
    desenharLocal(f, aoMudar); aoMudar?.();
  }));
  const andamento = (e) => {
    const card = f.querySelector(`.evl-mod[data-id="${e.id}"]`);
    if (!card?.isConnected) return;
    if (e.fase === "pronto" || e.fase === "erro") {
      desenharLocal(f, aoMudar).then(() => {
        if (e.fase === "erro") { const c2 = f.querySelector(`.evl-mod[data-id="${e.id}"] .evl-estado`); if (c2) { c2.textContent = e.erro || "Não deu para baixar"; c2.classList.add("evl-ruim"); } }
      });
      aoMudar?.();
      return;
    }
    const pct = e.total ? Math.round((e.feito / e.total) * 100) : 0;
    card.querySelector(".evl-estado").textContent = e.fase === "conferindo" ? `Conferindo o arquivo… ${pct}%` : `Baixando… ${pct}% (${mb(e.feito)} de ${mb(e.total)})`;
    const b = card.querySelector(".evl-barra"); b.hidden = false; b.querySelector("i").style.setProperty("--p", String(pct / 100));
  };
  if (s.baixando && !ouvindo) ouvindo = await IL.ouvirAndamento((e) => { andamento(e); if (e.fase === "pronto" || e.fase === "erro") { ouvindo?.(); ouvindo = null; } });
  el.querySelectorAll(".evl-baixar").forEach(b => (b.onclick = async () => {
    const id = b.closest(".evl-mod").dataset.id;
    b.disabled = true;
    try {
      ouvindo?.(); ouvindo = null;
      ouvindo = await IL.baixar(id, (e) => { andamento(e); if (e.fase === "pronto" || e.fase === "erro") { ouvindo?.(); ouvindo = null; } });
      await desenharLocal(f, aoMudar);
    } catch (e) { b.disabled = false; const st = b.closest(".evl-mod").querySelector(".evl-estado"); st.textContent = e.message || "Não deu para baixar"; st.classList.add("evl-ruim"); }
  }));
  el.querySelectorAll(".evl-pausar").forEach(b => (b.onclick = () => { b.disabled = true; IL.pausarDownload(); }));
  el.querySelectorAll(".evl-apagar").forEach(b => (b.onclick = async () => {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Toque de novo para apagar"; return; }
    await IL.apagar(b.closest(".evl-mod").dataset.id).catch(() => {});
    desenharLocal(f, aoMudar); aoMudar?.();
  }));
  const testar = el.querySelector(".evl-testar"), res = el.querySelector(".evl-teste-res");
  testar.onclick = async () => {
    testar.disabled = true; res.hidden = false; res.classList.remove("evl-ok", "evl-ruim"); res.textContent = "Pensando… (a 1ª vez demora mais: o modelo entra na memória)";
    try {
      const r = await IL.testar(EV.ajustes());
      res.textContent = `“${r.texto.slice(0, 120)}” · ${r.segundos.toFixed(1).replace(".", ",")} s${r.tokPorSeg ? ` · ${r.tokPorSeg.toFixed(1).replace(".", ",")} tokens/s` : ""}`;
      res.classList.add("evl-ok");
    } catch (e) { res.textContent = e.message || "Não funcionou"; res.classList.add("evl-ruim"); }
    testar.disabled = false;
  };
}
