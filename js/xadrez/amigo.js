// Jogar contra um amigo no próprio tablet (pedido do Alediov, 26/10/2026), no xadrez clássico ou numa das variantes
// (variantes.js). Os dois jogam no mesmo aparelho: sorteio de cores, relógio, e três jeitos de segurar o tablet:
// "fixo" (o tabuleiro não gira), "girar" (vira para quem joga a cada lance) e "frente a frente" (o tablet deitado na
// mesa, um de cada lado: as peças, o relógio e os botões de quem fica em cima ficam virados para ele).
// Na Neblina, a cada lance uma cortina pede para passar o tablet (cada um só vê o que as suas peças enxergam).
import { E, salvar } from "../estado.js";
import { toast, escapar, confete } from "../ui.js";
import { tocar, vibrar } from "../sons.js";
import { criarTabuleiro, classesVisual } from "./tabuleiro.js";
import { sanPT } from "./notacao.js";
import { Partida, VARIANTES } from "./variantes.js";
import { materialDe, htmlMaterial, SEM_MATERIAL } from "./material.js";

export const RELOGIOS_AMIGO = [["", "Sem"], ["10+0", "10 min"], ["5+3", "5+3"], ["3+2", "3+2"], ["1+0", "1 min"]];
export const GIROS = [["fixo", "Fixo"], ["girar", "Girar a cada lance"], ["frente", "Frente a frente"]];
const NOME_COR = { w: "Brancas", b: "Pretas" };
/** Segundos depois de um lance na Neblina em que a cortina não abre (tempo de passar o tablet). */
export const ESPERA_CORTINA = 5;

export function cfgAmigo() {
  const x = E().xadrez;
  x.amigo ||= {};
  const a = x.amigo;
  for (const [k, v] of Object.entries({ variante: "classico", relogio: "", giro: "frente", sorteio: true, nomes: ["Você", "Amigo"], partidas: [] })) if (!(k in a)) a[k] = v;
  return a;
}

/** Sorteia (ou não) as cores e abre a partida. `ctx`: { camada(html, classe), I, aoSair() } */
export async function comecarAmigo(ctx, { revanche = null } = {}) {
  const a = cfgAmigo();
  // jogador 0 = quem está embaixo (segurando o tablet); jogador 1 = o amigo
  let corDo0 = revanche ? (revanche === "w" ? "b" : "w") : a.minhaCor || "w";
  if (!revanche && a.sorteio) corDo0 = await sorteio(ctx, a.nomes);
  jogarAmigo(ctx, { variante: a.variante, relogio: a.relogio, giro: a.giro, nomes: a.nomes, corDo0 });
}

function sorteio(ctx, nomes) {
  return new Promise(ok => {
    const cor = Math.random() < 0.5 ? "w" : "b";
    const ov = ctx.camada(`<div class="xz-sorteio"><div class="xz-moeda"><i class="xz-p wk"></i><i class="xz-p bk"></i></div>
      <h2>Sorteio das cores…</h2><p class="xz-dica-g"></p><button class="botao" hidden>Começar</button></div>`, `sorteio ${classesVisual()}`);
    const moeda = ov.querySelector(".xz-moeda"), h = ov.querySelector("h2"), p = ov.querySelector("p"), b = ov.querySelector(".botao");
    moeda.classList.add(cor === "w" ? "da-branca" : "da-preta");
    tocar("toque");
    setTimeout(() => {
      h.textContent = `${nomes[0]} joga de ${NOME_COR[cor]}`;
      p.textContent = `${nomes[1]} joga de ${NOME_COR[cor === "w" ? "b" : "w"]}. As brancas começam.`;
      b.hidden = false; tocar("certo");
    }, 1300);
    b.onclick = () => { ov.remove(); ok(cor); };
  });
}

export function jogarAmigo(ctx, { variante, relogio, giro, nomes, corDo0 }) {
  const v = VARIANTES.find(x => x.id === variante) || VARIANTES[0];
  let jogo = new Partida(variante);
  const neblina = variante === "neblina", girar = giro === "girar" || neblina, frente = giro === "frente" && !neblina;
  const embaixo = corDo0; // a cor de quem está embaixo
  const nomeDe = (c) => (c === corDo0 ? nomes[0] : nomes[1]);
  const rel = relogio ? relogio.split("+").map(Number) : null;
  const ov = ctx.camada(`<div class="xz-s-topo"><button class="xz-s-fechar" aria-label="Sair">${ctx.I.fechar}</button><span class="xz-p-tit">${escapar(v.icone + " " + v.nome)} · com amigo</span><button class="xz-s-info" aria-label="Regras">?</button></div>
    <div class="xz-jog cima"></div><div class="xz-s-tab"></div><div class="xz-jog baixo"></div>
    <div class="xz-lances"></div><div class="xz-s-nota"></div>
    <div class="xz-p-bts"><button data-a="voltar">${ctx.I.desfazer}<span>Voltar</span></button><button data-a="virar">${ctx.I.virar}<span>Virar</span></button><button data-a="empate"><b>½</b><span>Empate</span></button><button data-a="nova">${ctx.I.dica}<span>Nova</span></button></div>`, `partida amigo ${frente ? "frente" : ""}`);
  const tab = criarTabuleiro(ov.querySelector(".xz-s-tab"), { orientacao: embaixo, barraDepois: ov.querySelector(".xz-jog.baixo") });
  if (frente) tab.frenteAFrente(true);
  const nota = ov.querySelector(".xz-s-nota"), lancesEl = ov.querySelector(".xz-lances");
  const painel = { [embaixo]: ov.querySelector(".xz-jog.baixo"), [embaixo === "w" ? "b" : "w"]: ov.querySelector(".xz-jog.cima") };
  let fim = null, maoSel = null, cortina = false;
  const tempo = rel ? { w: rel[0] * 60000, b: rel[0] * 60000 } : null;
  let tickAnt = Date.now(), pausado = false;
  const fmt = (ms) => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return ms < 10000 ? `${Math.floor(ms / 1000)},${Math.floor((ms % 1000) / 100)}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  function paineis() {
    const xq = jogo.xequesQueFaltam();
    const mat = SEM_MATERIAL.has(variante) ? null : materialDe(jogo.fenTela());
    for (const c of ["w", "b"]) {
      const el = painel[c], mao = jogo.bolso(c);
      const ativo = !fim && jogo.vez === c;
      el.className = `xz-jog ${el.classList.contains("cima") ? "cima" : "baixo"} ${ativo ? "ativo" : ""} ${tempo && tempo[c] < 20000 ? "pouco" : ""}`;
      el.innerHTML = `<span class="xz-jog-cor ${c}"></span><span class="xz-jog-nome"><b>${escapar(nomeDe(c))}</b><small>${NOME_COR[c]}${xq ? ` · faltam ${xq[c]} xeque${xq[c] === 1 ? "" : "s"}` : ""}${variante === "pato" && jogo.fase === "pato" && jogo.vez === c ? " · ponha o pato 🦆" : ""}</small>${mat ? htmlMaterial(mat, c, classesVisual()) : ""}</span>
        ${variante === "crazyhouse" ? `<span class="xz-mao ${classesVisual()}">${Object.entries(mao).map(([l, n]) => `<button data-l="${l}" class="${maoSel === l && jogo.vez === c ? "on" : ""}" ${jogo.vez !== c ? "disabled" : ""}><i class="xz-p ${c}${l}"></i>${n > 1 ? `<small>${n}</small>` : ""}</button>`).join("") || "<em>mão vazia</em>"}</span>` : ""}
        ${tempo ? `<b class="xz-jog-rel">${fmt(tempo[c])}</b>` : ""}<button class="xz-jog-des" data-c="${c}" aria-label="Desistir">🏳️</button>`;
      el.querySelectorAll(".xz-mao button").forEach(b => (b.onclick = () => { maoSel = maoSel === b.dataset.l ? null : b.dataset.l; mostrar(); }));
      el.querySelector(".xz-jog-des").onclick = () => confirmar(`${nomeDe(c)} desiste?`, () => terminar({ vencedor: c === "w" ? "b" : "w", motivo: `${nomeDe(c)} desistiu` }));
    }
  }
  function mostrar() {
    const visao = neblina ? jogo.vez : null;
    if (girar && !fim) tab.virar(jogo.vez);
    tab.posicao(jogo.fenTela(visao), { ultimo: neblina ? null : jogo.ultimo(), xeque: jogo.xeque() });
    tab.extras(jogo.pato ? { [jogo.pato]: "pato" } : {});
    tab.neblina(neblina && !fim ? jogo.neblina(visao) : []);
    const m = {};
    if (variante === "reiDoMorro") for (const c of ["d4", "e4", "d5", "e5"]) m[c] = "morro";
    if (maoSel) for (const c of jogo.destinosSoltar(maoSel)) m[c] = "alvo";
    if (variante === "pato" && jogo.fase === "pato") for (const c of casasVazias()) m[c] = "alvo pato-alvo";
    tab.marcas(m);
    lancesEl.innerHTML = jogo.sans.map((s, i) => `${i % 2 === 0 ? `<i>${i / 2 + 1}.</i>` : ""}<span>${escapar(sanPT(s))}</span>`).join(" ");
    lancesEl.scrollLeft = lancesEl.scrollWidth;
    paineis();
  }
  const casasVazias = () => { const out = [], f = jogo.fenTela().split(" ")[0].split("/"); f.forEach((l, r) => { let c = 0; for (const ch of l) { if (/\d/.test(ch)) { for (let k = 0; k < +ch; k++) out.push("abcdefgh"[c + k] + (8 - r)); c += +ch; } else c++; } }); return out.filter(x => x !== jogo.pato); };

  function depoisDoLance(r) {
    if (r.explodiu?.length) { tab.explodir(r.explodiu); tocar("errado"); vibrar(80); }
    else tocar(r.capturou ? "certo" : "toque");
    if (tempo && rel[1] && jogo.fase !== "pato") tempo[jogo.vez === "w" ? "b" : "w"] += rel[1] * 1000;
    maoSel = null;
    const f = jogo.fim();
    if (f) { terminar(f); return; }
    if (neblina) { mostrarCortina(); return; }
    mostrar();
  }
  tab._f = {
    legais: (casa) => (fim || cortina ? [] : jogo.legais(casa)),
    podeMexer: () => !fim && !cortina && !(variante === "pato" && jogo.fase === "pato"),
    aoMover: (de, para, promo) => { const r = jogo.mover(de, para, promo); if (r) depoisDoLance(r); else mostrar(); },
    aoTocar: (casa) => {
      if (fim || cortina) return false;
      if (variante === "pato" && jogo.fase === "pato") {
        if (jogo.porPato(casa)) { tocar("toque"); const f = jogo.fim(); if (f) terminar(f); else mostrar(); }
        else tab.tremer();
        return true;
      }
      if (maoSel) {
        if (jogo.destinosSoltar(maoSel).includes(casa)) { const r = jogo.soltar(maoSel, casa); if (r) depoisDoLance(r); return true; }
        maoSel = null; mostrar(); return false;
      }
      return false;
    },
  };
  ov._tab = tab; // para o teste de fumaça (jogar um lance sem arrastar)
  function mostrarCortina() {
    cortina = true;
    const c = document.createElement("div"); c.className = "xz-cortina";
    // depois de um lance, ESPERA_CORTINA s em que o toque não abre (pedido do Alediov, 03/11/2026: dava para abrir sem
    // querer enquanto o tablet passava de mão); no começo da partida, não precisa
    let falta = jogo.sans.length ? ESPERA_CORTINA : 0;
    c.innerHTML = `<div><span class="xz-jog-cor ${jogo.vez}"></span><h2>Vez de ${escapar(nomeDe(jogo.vez))}</h2><p>${NOME_COR[jogo.vez]} · <span class="xz-cortina-msg"></span></p>${jogo.sans.length ? `<small>Último lance: ${jogo.vez === "w" ? "das pretas" : "das brancas"} (escondido)</small>` : ""}</div>`;
    const msg = c.querySelector(".xz-cortina-msg");
    const pintar = () => {
      msg.textContent = falta > 0 ? `passe o tablet… (${falta})` : "toque para ver o tabuleiro";
      c.classList.toggle("esperando", falta > 0);
    };
    pintar();
    const relogio = falta > 0 ? setInterval(() => { falta--; pintar(); if (falta <= 0) clearInterval(relogio); }, 1000) : null;
    ov.append(c);
    tab.posicao("8/8/8/8/8/8/8/8 w - - 0 1"); tab.neblina([]);
    c.onclick = () => { if (falta > 0) return; clearInterval(relogio); c.remove(); cortina = false; mostrar(); };
  }
  function confirmar(texto, sim) {
    nota.innerHTML = `<div class="xz-res"><b>${escapar(texto)}</b><div class="xz-confirma"><button class="botao secundario" data-r="0">Não</button><button class="botao" data-r="1">Sim</button></div></div>`;
    nota.querySelectorAll("[data-r]").forEach(b => (b.onclick = () => { nota.innerHTML = ""; if (b.dataset.r === "1") sim(); }));
  }
  function terminar(f) {
    fim = f; tab.bloquear(true);
    const a = cfgAmigo();
    a.partidas.push({ data: new Date().toISOString(), variante, vencedor: f.vencedor, brancas: nomeDe("w"), pretas: nomeDe("b"), lances: Math.ceil(jogo.sans.length / 2), motivo: f.motivo });
    a.partidas = a.partidas.slice(-200); salvar();
    mostrar();
    if (neblina) { tab.neblina([]); tab.posicao(jogo.fenTela(), { ultimo: jogo.ultimo() }); }
    const titulo = f.vencedor ? `${nomeDe(f.vencedor)} venceu!` : "Empate";
    tocar(f.vencedor ? "fim" : "toque"); if (f.vencedor) confete?.();
    nota.innerHTML = `<div class="xz-res ok ${frente ? "dois-lados" : ""}"><b>${escapar(titulo)}</b><p>${escapar(f.motivo)} · ${Math.ceil(jogo.sans.length / 2)} lances</p><div class="xz-confirma"><button class="botao secundario" data-r="nova">Outra variante</button><button class="botao" data-r="revanche">Revanche (troca as cores)</button></div></div>`;
    nota.querySelector('[data-r="revanche"]').onclick = () => { ov.remove(); comecarAmigo(ctx, { revanche: corDo0 }); };
    nota.querySelector('[data-r="nova"]').onclick = () => { ov.remove(); ctx.aoSair?.(); };
  }
  // relógio
  const tick = rel ? setInterval(() => {
    if (!ov.isConnected) { clearInterval(tick); return; }
    const agora = Date.now(), dt = agora - tickAnt; tickAnt = agora;
    if (fim || pausado || cortina || !jogo.sans.length) return; // o relógio começa no 1º lance
    const c = jogo.vez; tempo[c] -= dt;
    const b = painel[c].querySelector(".xz-jog-rel"); if (b) b.textContent = fmt(tempo[c]);
    painel[c].classList.toggle("pouco", tempo[c] < 20000);
    if (tempo[c] <= 0) { tempo[c] = 0; terminar({ vencedor: c === "w" ? "b" : "w", motivo: `O tempo de ${nomeDe(c)} acabou` }); }
  }, 100) : null;

  ov.querySelector(".xz-s-fechar").onclick = () => { if (tick) clearInterval(tick); ov.remove(); ctx.aoSair?.(); };
  ov.querySelector(".xz-s-info").onclick = () => { nota.innerHTML = `<div class="xz-res"><b>${escapar(v.icone + " " + v.nome)}</b><p>${escapar(v.regra)}</p><p class="xz-dica-g">Segure uma casa e arraste para desenhar uma seta; segure e solte para pintar a casa.</p></div>`; };
  ov.querySelector(".xz-p-bts").addEventListener("click", (e) => {
    const a = e.target.closest("button")?.dataset.a; if (!a) return;
    if (a === "virar") { tab.virar(); mostrar(); if (girar) toast("No modo girar, o tabuleiro vira sozinho para quem joga."); }
    if (a === "voltar" && !fim) { if (jogo.desfazer()) { maoSel = null; mostrar(); } }
    if (a === "empate" && !fim) confirmar("Os dois combinaram o empate?", () => terminar({ vencedor: null, motivo: "Empate combinado" }));
    if (a === "nova") confirmar("Abandonar esta partida e começar outra?", () => { if (tick) clearInterval(tick); ov.remove(); ctx.aoSair?.(); });
  });
  nota.innerHTML = `<p class="xz-nota-lance">${escapar(v.regra)}</p>`;
  if (neblina) mostrarCortina(); else mostrar();
}
