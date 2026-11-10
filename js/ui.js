// Utilitários de interface: modal, aviso rápido e confete.

export function toast(msg, ms = 2600) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._timer); t._timer = setTimeout(() => (t.hidden = true), ms);
}

/** Abre um modal. `botoes`: [{ texto, classe, valor }]. Resolve com o valor do botão. */
export function modal({ titulo, texto = "", html = "", botoes = [{ texto: "Ok", valor: true }] }) {
  return new Promise((ok) => {
    const m = document.getElementById("modal");
    m.innerHTML = "";
    const caixa = document.createElement("div"); caixa.className = "modal-caixa";
    caixa.innerHTML = `${html}<h2></h2><p></p>`;
    caixa.querySelector(":scope > h2").textContent = titulo;
    caixa.querySelector(":scope > p").textContent = texto;
    if (!texto) caixa.querySelector(":scope > p").remove();
    if (!titulo) caixa.querySelector(":scope > h2").remove();
    for (const b of botoes) {
      const bt = document.createElement("button");
      bt.className = `botao ${b.classe || ""}`; bt.textContent = b.texto;
      bt.onclick = () => { m.hidden = true; ok(b.valor); };
      caixa.append(bt);
    }
    m.append(caixa); m.hidden = false;
    m.onclick = (e) => { if (e.target === m) { m.hidden = true; ok(null); } };
  });
}

export function confete(duracao = 2200) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.getElementById("confete"), c = cv.getContext("2d");
  const dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; c.scale(dpr, dpr);
  const cores = ["#2F6BFF", "#F2A922", "#1E9E5E", "#FF7A1A", "#FF8FA3", "#5B54D6"];
  const ps = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35,
    vx: (Math.random() - .5) * 11, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 4,
    a: Math.random() * 6, va: (Math.random() - .5) * .4, cor: cores[Math.floor(Math.random() * cores.length)], forma: Math.random() > .5,
  }));
  const ini = performance.now();
  (function quadro(t) {
    c.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.cor;
      if (p.forma) c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); else { c.beginPath(); c.arc(0, 0, p.r / 2.4, 0, 7); c.fill(); }
      c.restore();
    }
    if (t - ini < duracao) requestAnimationFrame(quadro); else c.clearRect(0, 0, innerWidth, innerHeight);
  })(ini);
}

export function escapar(s) { return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

/**
 * Formulário em modal. campos: [{ id, rotulo, tipo: text|time|date|number|select|checkbox|textarea, valor, opcoes: [[valor, texto]], dica, mostrarSe: (vals) => bool }]
 * Resolve com { ...valores, _acao } ou null se cancelado.
 */
export function formulario({ titulo, campos, botoes = [{ texto: "Salvar", acao: "salvar" }], cancelar = "Cancelar" }) {
  return new Promise((ok) => {
    const m = document.getElementById("modal");
    m.innerHTML = "";
    const caixa = document.createElement("form"); caixa.className = "modal-caixa form"; caixa.noValidate = true;
    const h = document.createElement("h2"); h.textContent = titulo; caixa.append(h);
    const els = {};
    for (const c of campos) {
      const lab = document.createElement("label"); lab.className = c.tipo === "checkbox" ? "linha-cfg" : "campo";
      let inp;
      if (c.tipo === "select") {
        inp = document.createElement("select");
        for (const [v, t] of c.opcoes) { const o = document.createElement("option"); o.value = v; o.textContent = t; inp.append(o); }
        inp.value = c.valor ?? c.opcoes[0]?.[0];
      } else if (c.tipo === "textarea") {
        inp = document.createElement("textarea"); inp.rows = 3; inp.value = c.valor ?? "";
      } else {
        inp = document.createElement("input"); inp.type = c.tipo || "text";
        if (c.tipo === "checkbox") inp.checked = !!c.valor; else inp.value = c.valor ?? "";
        if (c.tipo === "number") inp.step = c.passo || "any";
        if (c.placeholder) inp.placeholder = c.placeholder;
      }
      const span = document.createElement("span"); span.textContent = c.rotulo;
      if (c.tipo === "checkbox") { lab.append(span, inp); inp.className = "check"; } else lab.append(span, inp);
      if (c.dica) { const d = document.createElement("small"); d.className = "dica"; d.textContent = c.dica; lab.append(d); }
      els[c.id] = { lab, inp, c };
      caixa.append(lab);
    }
    const valores = () => Object.fromEntries(Object.entries(els).map(([id, { inp, c }]) => [id, c.tipo === "checkbox" ? inp.checked : c.tipo === "number" ? (inp.value === "" ? null : Number(inp.value)) : inp.value.trim()]));
    const atualizar = () => { const v = valores(); for (const { lab, c } of Object.values(els)) lab.hidden = c.mostrarSe ? !c.mostrarSe(v) : false; };
    caixa.addEventListener("input", atualizar); caixa.addEventListener("change", atualizar); atualizar();
    for (const b of botoes) {
      const bt = document.createElement("button"); bt.type = "button"; bt.className = `botao ${b.classe || ""}`; bt.textContent = b.texto;
      bt.onclick = () => { m.hidden = true; ok({ ...valores(), _acao: b.acao }); };
      caixa.append(bt);
    }
    const bc = document.createElement("button"); bc.type = "button"; bc.className = "link"; bc.style.marginTop = "8px"; bc.textContent = cancelar;
    bc.onclick = () => { m.hidden = true; ok(null); };
    caixa.append(bc);
    m.append(caixa); m.hidden = false;
    m.onclick = (e) => { if (e.target === m) { m.hidden = true; ok(null); } };
  });
}

export const dataBR = (iso, opc = { day: "2-digit", month: "2-digit" }) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", opc);
