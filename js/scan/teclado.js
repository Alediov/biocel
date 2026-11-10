// Teclados próprios do OdontoScan e máscaras. O teclado só abre quando um campo [data-teclado] é tocado
// (dedo ou caneta); com mouse e teclado físico (notebook), o campo funciona como um campo comum.
// Números: <input data-teclado="cpf|cns|sigtap|num|data|hora" data-max="11" aria-label="Nome">
//   CPF 000.000.000-00, CNS 000 0000 0000 0000, SIGTAP 00.00.00.000-0, data DD/MM/AAAA, hora HH:MM.
// Dinheiro (Finanças): <input data-teclado="dinheiro">: como nos apps de banco, os dígitos entram pelos centavos
//   ("1", "12", "123" → 0,01, 0,12, 1,23) e o cursor fica sempre no fim.
// Texto: <input data-teclado="texto" data-prever="municipio" aria-label="Município">: QWERTY com ç e acentos
//   (´ ~ ^ antes da vogal), 123 para números e sinais, e as previsões em cima das teclas (ou numa lista
//   embaixo do campo, no notebook), vindas de configurar({ prever }).

const GRUPOS = {
  cpf: [[3, 3, 3, 2], ".", ".", "-"], cns: [[3, 4, 4, 4], " ", " ", " "], sigtap: [[2, 2, 2, 3, 1], ".", ".", ".", "-"],
  data: [[2, 2, 4], "/", "/"], hora: [[2, 2], ":"],
};
const MAXIMO = { cpf: 11, cns: 15, sigtap: 10, data: 8, hora: 4, dinheiro: 9 };
const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** Formata só dígitos conforme o tipo (vai formatando enquanto se digita). */
export function formatar(tipo, valor) {
  if (tipo === "texto") return String(valor ?? "");
  if (tipo === "prontuario") { let s = String(valor ?? "").toUpperCase().replace(/[^0-9I]/g, ""); const i = s.indexOf("I"); return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/I/g, ""); }
  const d = String(valor ?? "").replace(/\D/g, "");
  if (tipo === "dinheiro") { const c = d.replace(/^0+/, ""); if (!c) return ""; const p = c.padStart(3, "0"); return p.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + p.slice(-2); }
  const g = GRUPOS[tipo];
  if (!g || (tipo === "sigtap" && d.length <= 3)) return d; // 3 dígitos no SIGTAP = abreviação da ficha
  const [tam, ...seps] = g;
  let out = "", i = 0;
  tam.forEach((n, k) => { if (i >= d.length) return; if (k) out += seps[k - 1]; out += d.slice(i, i + n); i += n; });
  return out + d.slice(i);
}
/** "30/04/2026" → "2026-04-30" (null se incompleta ou inválida). */
export function dataIso(texto) {
  const d = String(texto || "").replace(/\D/g, "");
  if (d.length !== 8) return null;
  const [dd, mm, aa] = [+d.slice(0, 2), +d.slice(2, 4), +d.slice(4)];
  const dt = new Date(aa, mm - 1, dd);
  if (aa < 1900 || aa > 2100 || dt.getFullYear() !== aa || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return `${aa}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
/** "2026-04-30" → "30/04/2026". */
export const dataBr = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.split("-").reverse().join("/") : (iso || "");
/** "0710" ou "07:10" → "07:10" (null se inválida). */
export function horaValida(texto) {
  const d = String(texto || "").replace(/\D/g, "");
  if (d.length !== 4 || +d.slice(0, 2) > 23 || +d.slice(2) > 59) return null;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}
/** Situação do campo para o cabeçalho do teclado: { texto, classe }. */
function situacao(el) {
  const t = el.dataset.teclado, n = el.value.replace(/\D/g, "").length;
  if (t === "data" && n) {
    if (n < 8) return { texto: "dia, mês e ano", classe: "" };
    const iso = dataIso(el.value);
    return iso ? { texto: `${DIAS[new Date(iso + "T12:00").getDay()]} ${el.value}`, classe: "ok" } : { texto: "data inválida", classe: "erro" };
  }
  if (t === "hora" && n) return n < 4 ? { texto: "horas e minutos", classe: "" } : horaValida(el.value) ? { texto: "", classe: "" } : { texto: "hora inválida", classe: "erro" };
  const st = el.closest(".os-campo")?.querySelector(".os-estado");
  return { texto: st?.textContent || "", classe: st?.classList.contains("ok") ? "ok" : st?.classList.contains("erro") ? "erro" : "" };
}

const ehTexto = (el) => el?.dataset.teclado === "texto";
const maxDe = (el) => +el.dataset.max || MAXIMO[el.dataset.teclado] || 20;
// prontuário aceita também a letra I (prontuário da clínica Infantil), uma vez só
const comLetra = (el) => el?.dataset.teclado === "prontuario";
const ehDinheiro = (el) => el?.dataset.teclado === "dinheiro";
const limpar = (el, v) => {
  if (ehDinheiro(el)) return String(v).replace(/\D/g, "").replace(/^0+/, "");
  if (!comLetra(el)) return String(v).replace(/\D/g, "");
  let s = String(v).toUpperCase().replace(/[^0-9I]/g, "");
  const i = s.indexOf("I"); if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/I/g, "");
  return s;
};
const valido = (el, c) => comLetra(el) ? /[0-9I]/i.test(c) : /\d/.test(c);
const digitos = (el) => limpar(el, el.value);
const antesDoCursor = (el) => ehDinheiro(el) ? digitos(el).length : limpar(el, el.value.slice(0, el.selectionStart ?? el.value.length)).length;

/** Põe os dígitos no campo, formatados, com o cursor depois do dígito número `pos`. */
function colocar(el, ds, pos) {
  // hora e data: "7" vira "07" (7h), dia 4 a 9 vira "04".."09", mês 2 a 9 vira "02".."09"
  const t = el.dataset.teclado, zero = (i) => { ds = ds.slice(0, i) + "0" + ds.slice(i); if (pos > i) pos++; };
  if ((t === "hora" && ds[0] > "2") || (t === "data" && ds[0] > "3")) zero(0);
  if (t === "data" && ds.length >= 3 && ds[2] > "1") zero(2);
  ds = limpar(el, ds).slice(0, maxDe(el));
  pos = Math.max(0, Math.min(pos, ds.length));
  el.value = formatar(el.dataset.teclado, ds);
  let i = 0, n = 0;
  while (i < el.value.length && n < pos) { if (valido(el, el.value[i])) n++; i++; }
  if (t === "dinheiro") i = el.value.length;
  try { el.setSelectionRange(i, i); } catch { /* campo sem seleção */ }
}

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "apagar", "0", "proximo"];
const TECLAS_LETRA = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "I", "0", "apagar", "proximo"]; // prontuário: I de Infantil
const LETRAS = ["qwertyuiop", "asdfghjklç", "⇧zxcvbnm⌫"];
const SINAIS = ["1234567890", "-/.,'()ºª", "⇧&:;!?\"⌫"];
const ACENTOS = { "´": { a: "á", e: "é", i: "í", o: "ó", u: "ú" }, "~": { a: "ã", o: "õ", n: "ñ" }, "^": { a: "â", e: "ê", o: "ô" } };
const teclasNumericas = (lista) => lista.map(k => `<button tabindex="-1" data-k="${k}" class="${/\d/.test(k) ? "" : k === "I" ? "ot-letra" : "ot-" + k}" ${k === "I" ? 'aria-label="I de Infantil"' : ""}>${k === "apagar" ? ICONE_APAGAR : k === "proximo" ? "" : k}</button>`).join("");
const ICONE_APAGAR = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m16 9-5 6M11 9l5 6"/></svg>`;
const ICONE_SHIFT = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 4 4 12h4v7h8v-7h4z"/></svg>`;

/**
 * Liga o teclado e as máscaras aos campos [data-teclado] dentro de `area` (inclusive os que forem criados depois).
 * Chame uma vez por raiz. Devolve { configurar({ aoConcluir, rotuloConcluir, prever }), preparar(container), fechar }:
 * `aoConcluir` é chamado ao tocar "Confirmar" no último campo (sem ele, a tecla vira "OK" e só fecha);
 * `prever(campo)` devolve as previsões do campo de texto: [{ valor, nota }].
 * `sistema: true` mostra no teclado um botão para trocar, naquele campo, pelo teclado do celular (Músicas: para
 * escrever em japonês, emoji…); o campo fica com `data-sistema` e as previsões passam para a lista embaixo dele.
 */
export function ligarTeclado(raiz, area) {
  let aoConcluir = null, rotuloConcluir = "Confirmar", prever = null, sistema = false;
  raiz.querySelector(".os-teclado")?.remove();
  const tec = document.createElement("div");
  const linha = (ks) => [...ks].map(k => `<button tabindex="-1" data-k="${k}" class="${k === "⇧" ? "ot-shift" : k === "⌫" ? "ot-apagar" : ""}">${k === "⇧" ? ICONE_SHIFT : k === "⌫" ? ICONE_APAGAR : k}</button>`).join("");
  tec.className = "os-teclado"; tec.hidden = true; tec.setAttribute("role", "group"); tec.setAttribute("aria-label", "Teclado");
  tec.innerHTML = `<div class="ot-cab"><span class="ot-nome"></span><span class="ot-estado"></span><div class="ot-prev"></div><button class="ot-sistema" tabindex="-1" hidden aria-label="Usar o teclado do celular neste campo"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg></button><button class="ot-fechar" tabindex="-1" aria-label="Fechar teclado">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button></div>
    <div class="ot-teclas">${teclasNumericas(TECLAS)}</div>
    <div class="ot-texto">
      <div class="ot-l l1"></div><div class="ot-l l2"></div><div class="ot-l l3"></div>
      <div class="ot-l l4"><button tabindex="-1" data-k="modo" class="ot-modo">123</button><button tabindex="-1" data-k="´" class="ot-acento">´</button><button tabindex="-1" data-k="~" class="ot-acento">~</button><button tabindex="-1" data-k="^" class="ot-acento">^</button><button tabindex="-1" data-k=" " class="ot-espaco">espaço</button><button tabindex="-1" data-k="proximo" class="ot-proximo"></button></div>
    </div>`;
  raiz.append(tec);
  let sobrescrever = false; // tocando num dígito embaixo do recorte, os próximos números substituem em vez de inserir
  let atual = null, ultimoToque = false, segura = null, sinais = false, acento = null, shift = 0, ultimoShift = 0;
  const desenharLetras = () => {
    const rows = sinais ? SINAIS : LETRAS;
    ["l1", "l2", "l3"].forEach((c, i) => (tec.querySelector(`.ot-texto .${c}`).innerHTML = linha(rows[i])));
    tec.querySelector(".ot-modo").textContent = sinais ? "abc" : "123";
    atualizarCaixa();
  };
  const maiuscula = () => {
    if (shift === 2 || shift === 1) return true;
    if (shift === -1 || !atual) return false;
    const antes = atual.value.slice(0, atual.selectionStart ?? atual.value.length);
    return !antes || /[\s\-(/]$/.test(antes);
  };
  const atualizarCaixa = () => {
    const up = maiuscula();
    tec.querySelectorAll(".ot-texto .ot-l button[data-k]").forEach(b => {
      const k = b.dataset.k;
      if (k.length === 1 && /\p{L}/u.test(k)) b.textContent = up ? k.toUpperCase() : k;
    });
    const sh = tec.querySelector(".ot-shift");
    if (sh) { sh.classList.toggle("on", up && !sinais); sh.classList.toggle("trava", shift === 2); sh.hidden = sinais; }
    tec.querySelectorAll(".ot-acento").forEach(b => b.classList.toggle("on", b.dataset.k === acento));
  };
  const campos = () => [...area.querySelectorAll("input[data-teclado]")].filter(el => !el.disabled && el.offsetParent !== null);
  const ehUltimo = () => { const c = campos(); return c.indexOf(atual) === c.length - 1; };

  // previsões: em cima do teclado (toque) ou numa lista embaixo do campo (mouse)
  const previsoes = (el) => (el?.dataset.prever && prever ? prever(el) || [] : []).slice(0, 6);
  const chip = (p, i) => `<button tabindex="-1" class="ot-chip ${i === 0 ? "melhor" : ""}" data-v="${encodeURIComponent(p.valor)}">${esc(p.valor)}${p.nota ? `<small>${esc(p.nota)}</small>` : ""}</button>`;
  const atualizarPrev = () => {
    const box = tec.querySelector(".ot-prev");
    const ps = ehTexto(atual) ? previsoes(atual).filter(p => p.valor !== atual.value) : [];
    box.innerHTML = ps.map(chip).join("");
    tec.classList.toggle("com-prev", ps.length > 0);
  };
  let lista = null;
  const listaMouse = (el) => {
    lista?.remove(); lista = null;
    if (!el || !ehTexto(el) || !el.dataset.prever || document.activeElement !== el) return;
    const ps = previsoes(el).filter(p => p.valor !== el.value).slice(0, 4);
    if (!ps.length) return;
    lista = document.createElement("div"); lista.className = "os-prev-lista"; lista.innerHTML = ps.map(chip).join("");
    lista.onpointerdown = (e) => { const b = e.target.closest(".ot-chip"); if (!b) return; e.preventDefault(); escolher(el, decodeURIComponent(b.dataset.v), false); };
    el.insertAdjacentElement("afterend", lista);
  };
  const escolher = (el, valor, avancar) => {
    el.value = valor; acento = null; shift = 0;
    try { el.setSelectionRange(valor.length, valor.length); } catch { /* */ }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    if (avancar) tocar("proximo"); else { atualizarCab(); listaMouse(el); }
  };

  const atualizarCab = () => {
    if (!atual) return;
    const texto = ehTexto(atual);
    tec.classList.toggle("modo-texto", texto);
    tec.querySelector(".ot-nome").textContent = atual.getAttribute("aria-label") || "";
    const s = situacao(atual), alvo = tec.querySelector(".ot-estado");
    alvo.textContent = s.texto; alvo.className = `ot-estado ${s.classe}`;
    tec.querySelectorAll(".ot-proximo").forEach(prox => { prox.textContent = ehUltimo() ? (aoConcluir ? rotuloConcluir : "OK") : "Próximo"; prox.classList.toggle("fim", ehUltimo()); });
    if (texto) { atualizarCaixa(); atualizarPrev(); } else tec.classList.remove("com-prev");
  };
  const abrir = (el) => {
    if (atual && atual !== el) atual.classList.remove("ot-ativo");
    if (atual !== el) { acento = null; shift = 0; if (sinais) { sinais = false; desenharLetras(); } }
    atual = el; el.classList.add("ot-ativo");
    const letra = comLetra(el), grade = tec.querySelector(".ot-teclas");
    if (grade.classList.contains("com-letra") !== letra) { grade.innerHTML = teclasNumericas(letra ? TECLAS_LETRA : TECLAS); grade.classList.toggle("com-letra", letra); }
    clearTimeout(tec._some); tec.classList.remove("saindo");
    const novo = tec.hidden;
    tec.hidden = false; raiz.classList.add("com-teclado");
    raiz.classList.toggle("com-teclado-texto", ehTexto(el));
    if (novo) { tec.classList.remove("sobe"); void tec.offsetWidth; tec.classList.add("sobe"); }
    atualizarCab();
    requestAnimationFrame(() => (el.closest(".os-campo, .os-proc, label") || el).scrollIntoView({ block: "center", behavior: "smooth" }));
  };
  // ao fechar, o teclado fica invisível mas no lugar por um instante: assim o toque que o fechou
  // não "atravessa" e acerta o que estava embaixo (a barra de abas, por exemplo)
  const fechar = (atraso = 200) => {
    sobrescrever = false;
    if (tec.hidden || tec.classList.contains("saindo")) return;
    raiz.classList.remove("com-teclado", "com-teclado-texto");
    atual?.classList.remove("ot-ativo"); atual = null;
    tec.classList.add("saindo");
    tec._some = setTimeout(() => { tec.hidden = true; tec.classList.remove("saindo"); }, atraso);
  };
  const avisar = () => { atual.dispatchEvent(new Event("input", { bubbles: true })); atualizarCab(); };
  const tocarTexto = (k) => {
    const el = atual, v = el.value, a = el.selectionStart ?? v.length, b = el.selectionEnd ?? a;
    const por = (txt, ini, fim) => { el.value = v.slice(0, ini) + txt + v.slice(fim); const p = ini + txt.length; try { el.setSelectionRange(p, p); } catch { /* */ } };
    if (k === "⌫") { if (a !== b) por("", a, b); else if (a) por("", a - 1, a); else return pulsar(); acento = null; }
    else if (k === "limpar") por("", 0, v.length);
    else if (k === "⇧") {
      const agora = Date.now();
      if (agora - ultimoShift < 350) shift = 2; else shift = shift === 2 ? 0 : maiuscula() ? -1 : 1;
      ultimoShift = agora; return atualizarCaixa();
    } else if (k === "modo") { sinais = !sinais; desenharLetras(); return; }
    else if (ACENTOS[k]) { acento = acento === k ? null : k; return atualizarCaixa(); }
    else {
      let c = k;
      if (/\p{L}/u.test(c)) { if (acento && ACENTOS[acento][c]) c = ACENTOS[acento][c]; if (maiuscula()) c = c.toUpperCase(); }
      else if (acento && c !== " ") { /* acento sem vogal: escreve o próprio sinal */ }
      acento = null;
      if (el.maxLength > 0 && v.length - (b - a) >= el.maxLength) return pulsar();
      por(c, a, b);
      if (shift === 1 || shift === -1) shift = 0;
    }
    avisar();
  };
  const tocar = (k) => {
    if (!atual) return;
    if (k === "proximo") {
      const c = campos(), i = c.indexOf(atual);
      if (i >= 0 && i < c.length - 1) { const prox = c[i + 1]; prox.focus({ preventScroll: true }); if (ehTexto(prox)) { try { prox.setSelectionRange(prox.value.length, prox.value.length); } catch { /* */ } } else colocar(prox, digitos(prox), 99); abrir(prox); }
      else { fechar(450); aoConcluir?.(); }
      return;
    }
    if (ehTexto(atual)) return tocarTexto(k === "apagar" ? "⌫" : k);
    const ds = digitos(atual), pos = antesDoCursor(atual);
    if (/\d/.test(k) && sobrescrever && pos < ds.length && ds[pos] !== "I") { colocar(atual, ds.slice(0, pos) + k + ds.slice(pos + 1), pos + 1); avisar(); return; }
    if (/\d/.test(k) || k === "I") {
      if (ds.length >= maxDe(atual) || (k === "I" && ds.includes("I"))) return pulsar();
      colocar(atual, ds.slice(0, pos) + k + ds.slice(pos), pos + 1);
    }
    else if (k === "apagar") { if (!pos) return pulsar(); colocar(atual, ds.slice(0, pos - 1) + ds.slice(pos), pos - 1); }
    else if (k === "limpar") colocar(atual, "", 0);
    else return;
    avisar();
  };
  const pulsar = () => { atual?.classList.remove("ot-tremer"); void atual?.offsetWidth; atual?.classList.add("ot-tremer"); };

  // teclas: a ação vai no pointerdown (rápido como um teclado e sem tirar o foco do campo)
  tec.onpointerdown = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    e.preventDefault();
    if (tec.classList.contains("saindo")) return;
    if (b.classList.contains("ot-fechar")) return fechar(450);
    if (b.classList.contains("ot-sistema")) {
      const el = atual; if (!el) return;
      fechar(0); el.dataset.sistema = "1"; el.inputMode = "text";
      el.blur(); setTimeout(() => { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* */ } }, 40);
      return;
    }
    if (b.classList.contains("ot-chip")) { navigator.vibrate?.(6); return escolher(atual, decodeURIComponent(b.dataset.v), true); }
    const k = b.dataset.k;
    b.classList.add("apertada"); setTimeout(() => b.classList.remove("apertada"), 120);
    navigator.vibrate?.(6);
    tocar(k);
    if (k === "apagar" || k === "⌫") { clearTimeout(segura); segura = setTimeout(() => { tocar("limpar"); navigator.vibrate?.(20); }, 550); }
  };
  tec.onpointerup = tec.onpointercancel = tec.onpointerleave = () => clearTimeout(segura);
  tec.onclick = (e) => e.preventDefault();
  desenharLetras();

  // campos: o tipo do último toque decide se o teclado próprio aparece (dedo/caneta) ou não (mouse)
  area.addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.("input[data-teclado]"); if (!el) return;
    if (el.dataset.sistema) { ultimoToque = false; el.inputMode = "text"; return; }
    ultimoToque = e.pointerType !== "mouse";
    el.inputMode = ultimoToque ? "none" : ehTexto(el) ? "text" : "numeric";
  });
  area.addEventListener("click", (e) => {
    const el = e.target.closest?.("input[data-teclado]"); if (!el) return;
    sobrescrever = false;
    if (ultimoToque) { lista?.remove(); abrir(el); if (ehTexto(el)) atualizarCaixa(); } else { fechar(); listaMouse(el); }
  });
  area.addEventListener("input", (e) => {
    const el = e.target.closest?.("input[data-teclado]"); if (!el) return;
    if (e.isTrusted !== false && !ehTexto(el)) colocar(el, digitos(el), antesDoCursor(el)); // digitação no teclado físico
    if (el === atual) atualizarCab(); else if (ehTexto(el)) listaMouse(el);
  });
  area.addEventListener("focusin", (e) => {
    if (atual && e.target !== atual && !e.target.matches?.("input[data-teclado]")) fechar();
    if (!ultimoToque && ehTexto(e.target)) listaMouse(e.target);
  });
  area.addEventListener("focusout", () => setTimeout(() => { if (lista && !lista.previousElementSibling?.matches(":focus")) { lista.remove(); lista = null; } }, 120));
  area.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && lista && ehTexto(e.target)) { const b = lista.querySelector(".ot-chip"); if (b) { e.preventDefault(); escolher(e.target, decodeURIComponent(b.dataset.v), false); } }
  });
  const fora = (e) => { if (!tec.hidden && !tec.contains(e.target) && !e.target.closest?.("input[data-teclado], [data-mantem-teclado]")) fechar(); };
  document.addEventListener("pointerdown", fora, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { fechar(0); lista?.remove(); lista = null; } });

  return {
    fechar: () => fechar(0),
    /** Põe o cursor no dígito `i` do campo para trocá-lo (e os seguintes, um a um). `toque`: abre o teclado próprio. */
    sobrescrever(el, i, toque) {
      el.focus({ preventScroll: true });
      if (toque) { colocar(el, digitos(el), i); sobrescrever = true; abrir(el); }
      else { // mouse: seleciona o dígito; o que for digitado no teclado físico entra no lugar
        let c = 0, n = 0; while (c < el.value.length && n < i) { if (valido(el, el.value[c])) n++; c++; }
        while (c < el.value.length && !valido(el, el.value[c])) c++;
        try { el.setSelectionRange(c, Math.min(el.value.length, c + 1)); } catch { /* */ }
      }
      el.dispatchEvent(new Event("selecao", { bubbles: true }));
    },
    /** Quantos dígitos há antes do cursor (para a tela saber qual quadradinho está marcado). */
    posicao: (el) => antesDoCursor(el),
    configurar(o = {}) { aoConcluir = o.aoConcluir || null; rotuloConcluir = o.rotuloConcluir || "Confirmar"; prever = o.prever || null; sistema = !!o.sistema; tec.querySelector(".ot-sistema").hidden = !sistema; fechar(0); },
    /** Formata os valores iniciais e desliga o teclado do sistema em telas de toque. */
    preparar(container = area) {
      const toque = matchMedia("(pointer: coarse)").matches;
      container.querySelectorAll("input[data-teclado]").forEach(el => {
        if (!ehTexto(el)) el.value = formatar(el.dataset.teclado, digitos(el).slice(0, maxDe(el)));
        el.inputMode = toque && !el.dataset.sistema ? "none" : ehTexto(el) ? "text" : "numeric"; el.autocomplete = "off";
        if (ehTexto(el)) { el.autocapitalize = "words"; el.spellcheck = false; }
      });
    },
  };
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
