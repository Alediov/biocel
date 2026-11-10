// Glossário ao toque (pedido do Alediov, 25/10/2026): no leitor, os termos técnicos da unidade ganham um sublinhado
// pontilhado (só a 1ª vez que aparecem na unidade) e um toque mostra um balão com a definição curta, o termo em inglês
// (nos livros traduzidos) e de onde vem. Fontes: conteudo/<disciplina>/definicoes.json (escritas a partir do livro;
// a tarefa da madrugada amplia), o glossário EN→PT da disciplina (só o termo em inglês) e, nas novels, o glossário sem
// spoiler (só os termos com `desde` até o capítulo aberto). Ligado/desligado em Aa ("Termos do glossário").
import { escapar } from "../ui.js";

export const FONTES = {
  malamed: { defs: "conteudo/anestesiologia/definicoes.json" },
  andrade: { defs: "conteudo/farmacologia/definicoes.json" },
  neville: { defs: "conteudo/patologia/definicoes.json", glos: "conteudo/patologia/glossario.json" },
  lindhe: { defs: "conteudo/periodontia/definicoes.json", glos: "conteudo/periodontia/glossario.json" },
  burket: { defs: "conteudo/estomatologia/definicoes.json", glos: "conteudo/estomatologia/glossario.json" },
};
// títulos de seção do glossário (viram cabeçalho, não termo) e palavras comuns demais para marcar
const COMUNS = new Set(["tratamento", "prognostico", "diagnostico", "caracteristicas clinicas", "caracteristicas radiograficas", "caracteristicas histopatologicas", "tratamento e prognostico", "diagnostico diferencial", "paciente", "pacientes", "dente", "dentes"]);

/** Mesma letra, sem acento e minúscula, com o MESMO tamanho do texto (para achar a posição no original). */
export function dobrar(s) {
  let o = "";
  for (const c of s) { const d = c.length === 1 ? c.normalize("NFD")[0].toLowerCase() : ""; o += d.length === 1 ? d : c; }
  return o;
}
const chave = (s) => dobrar(String(s).trim()).replace(/\s+/g, " ");

/**
 * Os termos de um livro: [{ t, formas, en, def, nota, tipo, un }]. `carregar(caminho)` devolve o JSON (ou null).
 * Nas novels, `ate` é o capítulo aberto: nada que apareça depois. `unidade`: o id da unidade aberta (para o `fora`).
 */
export async function termosDo(livro, carregar, { ate = 0, unidade = "" } = {}) {
  const out = new Map();
  const por = (t, x) => { const k = chave(t); if (k.length < 4 || COMUNS.has(k)) return; const v = out.get(k); if (!v) { out.set(k, { t, formas: [], ...x }); return; } for (const [c, y] of Object.entries(x)) if (y != null && y !== "" && !v[c]) v[c] = y; };
  if (livro.tipo === "novel" || livro.tipo === "historia") { // as Histórias do Claude têm o mesmo glossário sem spoiler
    const g = await carregar(`${livro.pasta}/glossario.json`).catch(() => null);
    for (const x of g?.termos || []) if ((x.desde || 0) <= ate && x.pt) por(x.pt, { en: x.en && x.en !== x.pt ? x.en : null, ko: x.ko || null, nota: x.nota || null, tipo: x.tipo || null });
    // a história que ensina (02/11/2026): os termos técnicos dos livros da faculdade também abrem a definição
    if (livro.ensina) for (const f of Object.values(FONTES)) {
      const d = await carregar(f.defs).catch(() => null);
      for (const x of d?.termos || []) { por(x.t, { en: x.en || null, def: x.def || null, un: x.un || null }); const v = out.get(chave(x.t)); if (v) v.formas.push(...(x.sin || [])); }
    }
  } else {
    const f = FONTES[livro.chave] || {};
    const d = f.defs ? await carregar(f.defs).catch(() => null) : null;
    for (const x of d?.termos || []) { if (unidade && (x.fora || []).some(p => unidade.startsWith(p))) continue; // `fora`: prefixos de unidades em que o termo tem outro sentido
      por(x.t, { en: x.en || null, def: x.def || null, un: x.un || null }); const v = out.get(chave(x.t)); if (v) v.formas.push(...(x.sin || [])); }
    if (livro.traducao && f.glos) {
      const g = await carregar(f.glos).catch(() => null);
      for (const [en, pt] of Object.entries(g || {})) {
        if (en.startsWith("_") || typeof pt !== "string") continue;
        // do glossário, só termos de verdade: com mais de uma palavra ou uma palavra longa
        if (pt.split(/\s+/).length < 2 && pt.length < 9) continue;
        const k = chave(pt);
        if (out.has(k)) { out.get(k).en ||= en; continue; }
        por(pt, { en });
      }
    }
  }
  for (const v of out.values()) v.formas = [...new Set([v.t, ...v.formas].map(s => String(s).trim()).filter(s => s.length >= 4))];
  return [...out.values()];
}

/** Marca nos parágrafos, itens e notas a 1ª ocorrência de cada termo. Devolve quantos marcou. */
export function marcarTermos(art, termos) {
  if (!termos.length) return 0;
  const porForma = new Map();
  for (const [i, t] of termos.entries()) for (const f of t.formas) { const k = chave(f); if (!porForma.has(k)) porForma.set(k, i); }
  const formas = [...porForma.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
  if (!formas.length) return 0;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${formas.join("|")})(?![\\p{L}\\p{N}])`, "gu");
  const usados = new Set();
  let n = 0;
  for (const bloco of art.querySelectorAll(":scope > p, :scope > .le-li > p, :scope > .le-nota")) {
    const w = document.createTreeWalker(bloco, NodeFilter.SHOW_TEXT, { acceptNode: (no) => (no.parentElement.closest("a, sup, sub, .le-termo") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nos = []; while (w.nextNode()) nos.push(w.currentNode);
    for (const no of nos) {
      const txt = no.nodeValue, dob = dobrar(txt), achados = [];
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(dob))) {
        const i = porForma.get(m[0].replace(/\s+/g, " "));
        if (i == null || usados.has(i)) continue;
        usados.add(i); achados.push([m.index, m[0].length, i]);
      }
      // de trás para frente, para as posições continuarem valendo
      for (const [ini, tam, i] of achados.reverse()) {
        const fim = no.splitText(ini);
        fim.splitText(tam);
        const s = document.createElement("span"); s.className = "le-termo"; s.dataset.t = i; s.textContent = fim.nodeValue;
        fim.replaceWith(s); n++;
      }
    }
  }
  return n;
}

let balao = null;
export function fecharBalao() { if (balao) { const b = balao; balao = null; b.classList.remove("aberto"); setTimeout(() => b.remove(), 160); } }

/** O balão com o termo, perto da palavra tocada. */
export function mostrarTermo(alvo, t, { traducao = false, livro = "" } = {}) {
  fecharBalao();
  const b = document.createElement("div"); b.className = "le-balao";
  const origem = t.def ? `${escapar(livro)}${t.un ? ` · unidade ${escapar(t.un)}` : ""}` : traducao && t.en ? "Termo original do livro" : "";
  b.innerHTML = `<b>${escapar(t.t)}</b>${t.ko ? ` <span lang="ko">${escapar(t.ko)}</span>` : ""}${t.en ? `<small class="le-balao-en">${escapar(t.en)}</small>` : ""}
    ${t.def ? `<p>${escapar(t.def)}</p>` : t.nota ? `<p>${escapar(t.nota)}</p>` : !t.en ? `<p class="le-dica">Sem definição ainda.</p>` : ""}
    ${origem ? `<em>${origem}</em>` : ""}<i class="le-balao-seta"></i>`;
  document.body.append(b);
  const r = alvo.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  const w = Math.min(340, W - 24);
  b.style.width = `${w}px`;
  const x = Math.max(12, Math.min(W - w - 12, r.left + r.width / 2 - w / 2));
  const h = b.offsetHeight;
  const embaixo = r.top < h + 90 || r.bottom + h + 20 < H * 0.92;
  b.style.left = `${x}px`;
  b.style.top = `${embaixo ? r.bottom + 10 : r.top - h - 10}px`;
  b.classList.toggle("embaixo", embaixo);
  b.style.setProperty("--seta", `${Math.max(16, Math.min(w - 16, r.left + r.width / 2 - x))}px`);
  balao = b;
  requestAnimationFrame(() => b.classList.add("aberto"));
  const fora = (e) => { if (!b.contains(e.target) && e.target !== alvo) { fecharBalao(); document.removeEventListener("pointerdown", fora, true); } };
  setTimeout(() => document.addEventListener("pointerdown", fora, true), 0);
}
