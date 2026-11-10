// Galeria Clínica (pedido do Alediov, 25/10/2026): fotos clínicas do Neville para reconhecer a lesão, com as
// alternativas do mesmo grupo (as que se confundem), a pista clínica em português e a legenda do livro. Dados em
// extras/jogos/galeria.json (tools/galeria/montar_galeria.py). Modos: Identificar (10 fotos, as erradas e as menos
// vistas primeiro, com filtro por grupo) e Estudar (as lesões de cada grupo com as fotos e a pista).
// Estado em E().galeria: vistas (por foto), grupo (o filtro escolhido), partidas.
import { abrirCamada, terminar, semConteudo } from "../jogos.js";
import { extra, urlMidia } from "../dados.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { escapar, confete } from "../ui.js";
import { E, salvar, hojeISO } from "../estado.js";
import { abrirVisor } from "../visorZoom.js";

const est = () => { const g = E().galeria ??= {}; g.vistas ??= {}; g.partidas ??= 0; g.grupo ??= ""; return g; };

async function porImagem(img, caminho) {
  const u = await urlMidia(caminho);
  img.onerror = () => { img.onerror = null; img.src = `../${caminho}`; };
  img.src = u || `../${caminho}`;
}
const ampliar = (src) => abrirVisor(src);

export async function jogarGaleria(opts = {}) {
  const cam = abrirCamada("Galeria Clínica");
  const D = await extra("jogo:galeria");
  if (!D?.fotos?.length) return semConteudo(cam, "As fotos ainda não chegaram. Sincronize com internet.");
  const S = est();
  const lesao = Object.fromEntries(D.lesoes.map(l => [l.id, l]));
  if (cam.licao) return identificar(opts.quantas || 6);
  inicio();

  function inicio() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    const vistas = Object.values(S.vistas), certas = vistas.reduce((a, v) => a + v.c, 0), tot = vistas.reduce((a, v) => a + v.c + v.e, 0);
    cam.corpo.innerHTML = `<div class="lam">
      <div class="lam-cab"><div class="lam-cont gal"><b>${D.lesoes.length}</b><small>lesões</small></div>
        <div><h2>Galeria Clínica</h2><small>${D.fotos.length} fotos clínicas · ${escapar(D.livro)}${tot ? ` · ${Math.round((certas / tot) * 100)}% de acerto` : ""}</small></div></div>
      <div class="gal-grupos"><button data-g="" class="${S.grupo ? "" : "on"}">Todas</button>${Object.entries(D.grupos).filter(([g]) => D.lesoes.some(l => l.grupo === g)).map(([g, n]) => `<button data-g="${g}" class="${S.grupo === g ? "on" : ""}">${escapar(n)}</button>`).join("")}</div>
      <div class="lam-modos">
        <button class="lam-modo" data-m="id"><b>Identificar</b><small>10 fotos: qual é a lesão?</small></button>
        <button class="lam-modo" data-m="est"><b>Estudar</b><small>As lesões do grupo, com as fotos e a pista clínica</small></button>
      </div></div>`;
    cam.corpo.querySelectorAll(".gal-grupos button").forEach(b => (b.onclick = () => { S.grupo = b.dataset.g; salvar(); inicio(); }));
    cam.corpo.querySelectorAll(".lam-modo").forEach(b => (b.onclick = () => (b.dataset.m === "id" ? identificar(10) : estudar())));
  }

  // função declarada (e não const): a lição-jogo chama identificar() lá em cima, antes desta linha; com const, dava
  // "Cannot access 'doGrupo' before initialization" e a camada ficava preta (30/10/2026)
  function doGrupo() { return D.fotos.filter(f => !S.grupo || lesao[f.lesao].grupo === S.grupo); }
  function sortear(n) {
    const prio = (f) => { const v = S.vistas[f.id] || { c: 0, e: 0 }; return v.e * 2 - v.c - (v.c + v.e === 0 ? 1.2 : 0) + Math.random() * 1.8; };
    const pool = embaralhar(doGrupo()).sort((a, b) => prio(b) - prio(a));
    // no máximo uma foto por lesão na rodada
    const out = [], usadas = new Set();
    for (const f of pool) { if (out.length >= n) break; if (usadas.has(f.lesao)) continue; usadas.add(f.lesao); out.push(f); }
    return embaralhar(out);
  }
  function opcoes(f) {
    const L = lesao[f.lesao];
    const mesmo = embaralhar(D.lesoes.filter(l => l.grupo === L.grupo && l.id !== L.id));
    const outros = embaralhar(D.lesoes.filter(l => l.grupo !== L.grupo));
    return embaralhar([L, ...[...mesmo, ...outros].slice(0, 3)]);
  }

  function identificar(n) {
    const lista = sortear(n);
    let i = 0, pontos = 0, certos = 0;
    const res = [];
    const proxima = () => {
      if (i >= lista.length) return fim();
      const f = lista[i], L = lesao[f.lesao];
      cam.info.textContent = `${i + 1}/${lista.length}`;
      cam.corpo.scrollTop = 0;
      cam.corpo.innerHTML = `<div class="lam lam-q"><p class="lam-perg">Qual é a lesão?</p><div class="lam-vista gal-vista"><img alt=""><span class="lam-lupa">⤢</span></div><div class="opcoes lam-ops"></div><div class="gal-area"></div></div>`;
      const img = cam.corpo.querySelector(".gal-vista img"); porImagem(img, f.img);
      cam.corpo.querySelector(".gal-vista").onclick = () => ampliar(img.src);
      const box = cam.corpo.querySelector(".lam-ops"), area = cam.corpo.querySelector(".gal-area");
      for (const o of opcoes(f)) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = o.nome; b.dataset.id = o.id;
        b.onclick = () => {
          const ok = o.id === f.lesao;
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.dataset.id === f.lesao) x.classList.add("correta"); });
          if (!ok) { b.classList.add("incorreta"); vibrar?.(60); }
          tocar(ok ? "certo" : "errado");
          const v = S.vistas[f.id] ??= { c: 0, e: 0 }; v[ok ? "c" : "e"]++; v.ult = hojeISO(); salvar();
          if (ok) { pontos += 10; certos++; }
          res.push({ f, ok });
          area.innerHTML = `<div class="lam-fb ${ok ? "ok" : "erro"}"><b>${ok ? "Isso!" : `Era: ${escapar(L.nome)}`}</b>
            <p class="lam-pista">💡 ${escapar(L.pista)}</p>
            ${!ok ? `<p class="gal-errada">${escapar(o.nome)}: ${escapar(o.pista)}</p>` : ""}
            <small>No livro: ${escapar(f.legenda)} (Neville, fig. ${escapar(f.fonte.figura)}${f.fonte.pagina ? `, p. ${f.fonte.pagina} do PDF` : ""})</small></div>`;
          const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = i + 1 < lista.length ? "Próxima foto" : "Ver resultado";
          bt.onclick = () => { i++; proxima(); };
          area.append(bt); bt.scrollIntoView({ behavior: "smooth", block: "end" });
        };
        box.append(b);
      }
    };
    const fim = () => {
      S.partidas++; salvar();
      if (certos === lista.length) confete();
      terminar(cam, "galeria", pontos, { xp: Math.round(pontos / 5), moedas: Math.round(pontos / 10) },
        `<p class="sub">${certos} de ${lista.length} certas.</p><ul class="mira-resumo">${res.map(r => `<li><span>${escapar(lesao[r.f.lesao].nome)}</span><b>${r.ok ? `<i class="ok">✓</i>` : `<i class="erro">✗</i>`}</b></li>`).join("")}</ul>`, "pontos");
    };
    proxima();
  }

  function estudar() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    const grupos = Object.entries(D.grupos).filter(([g]) => !S.grupo || g === S.grupo);
    cam.corpo.innerHTML = `<div class="lam"><button class="lam-voltar">‹ Voltar</button><h2>Estudar</h2></div>`;
    const raiz = cam.corpo.firstChild;
    raiz.querySelector(".lam-voltar").onclick = inicio;
    for (const [g, nome] of grupos) {
      const ls = D.lesoes.filter(l => l.grupo === g); if (!ls.length) continue;
      raiz.insertAdjacentHTML("beforeend", `<h3>${escapar(nome)}</h3>`);
      for (const l of ls) {
        const d = document.createElement("details"); d.className = "lam-par gal-les";
        d.innerHTML = `<summary><b>${escapar(l.nome)}</b></summary><p>${escapar(l.pista)}</p><div class="lam-grade"></div>`;
        d.addEventListener("toggle", () => {
          const gr = d.querySelector(".lam-grade"); if (!d.open || gr.children.length) return;
          for (const f of D.fotos.filter(x => x.lesao === l.id)) {
            const fig = document.createElement("figure"); fig.className = "lam-mini";
            const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; porImagem(img, f.img); img.onclick = () => ampliar(img.src);
            fig.append(img); fig.insertAdjacentHTML("beforeend", `<figcaption>Fig. ${escapar(f.fonte.figura)}</figcaption>`); gr.append(fig);
          }
        });
        raiz.append(d);
      }
    }
  }
}
