// Lesões Fundamentais (pedido do Alediov, 04/11/2026, para a prova de Semiologia de 05/11 e a maquete de Erosão):
// pela descrição clínica ou por uma foto da Galeria (Neville, só as que a legenda do livro chama pela lesão), qual é a
// lesão fundamental: mácula, placa, pápula, nódulo, vesícula, bolha, pústula, erosão ou úlcera. Definições do artigo do
// seminário (Lucio et al., 2026; limites de 3 mm) e do Burket, cap. 3. Dados em extras/jogos/lesoes.json
// (tools/jogos/montar_lesoes.py). Estado em E().lesoes: vistas[id] {c, e}, partidas.
import { abrirCamada, terminar, semConteudo } from "../jogos.js";
import { extra, urlMidia } from "../dados.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { escapar, confete } from "../ui.js";
import { E, salvar, hojeISO } from "../estado.js";
import { abrirVisor } from "../visorZoom.js";

const est = () => { const g = E().lesoes ??= {}; g.vistas ??= {}; g.partidas ??= 0; return g; };

async function porImagem(img, caminho) {
  const u = await urlMidia(caminho);
  img.onerror = () => { img.onerror = null; img.src = `../${caminho}`; };
  img.src = u || `../${caminho}`;
}

export async function jogarLesoes(opts = {}) {
  const cam = abrirCamada("Lesões Fundamentais");
  const D = await extra("jogo:lesoes");
  if (!D?.itens?.length) return semConteudo(cam, "As lesões ainda não chegaram. Sincronize com internet.");
  const S = est();
  const L = Object.fromEntries(D.lesoes.map(l => [l.id, l]));
  if (cam.licao || opts.direto) return identificar(opts.quantas || 6);
  inicio();

  function inicio() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    const v = Object.values(S.vistas), c = v.reduce((a, x) => a + x.c, 0), t = v.reduce((a, x) => a + x.c + x.e, 0);
    const ero = Object.entries(S.vistas).filter(([id]) => D.itens.find(x => x.id === id)?.certa === "erosao").reduce((a, [, x]) => [a[0] + x.c, a[1] + x.c + x.e], [0, 0]);
    cam.corpo.innerHTML = `<div class="lam">
      <div class="lam-cab"><div class="lam-cont gal"><b>${D.lesoes.length}</b><small>lesões</small></div>
        <div><h2>Lesões Fundamentais</h2><small>${D.itens.length} descrições e fotos${t ? ` · ${Math.round((c / t) * 100)}% de acerto` : ""}${ero[1] ? ` · erosão: ${ero[0]}/${ero[1]}` : ""}</small></div></div>
      <div class="lam-modos">
        <button class="lam-modo" data-m="id"><b>Identificar</b><small>10 descrições e fotos: qual é a lesão fundamental?</small></button>
        <button class="lam-modo" data-m="ero"><b>Erosão ou Úlcera?</b><small>Só as perdas de tecido, o tema da maquete</small></button>
        <button class="lam-modo" data-m="est"><b>Estudar</b><small>As definições, com a fonte</small></button>
      </div></div>`;
    cam.corpo.querySelectorAll(".lam-modo").forEach(b => (b.onclick = () => {
      if (b.dataset.m === "est") return estudar();
      identificar(10, b.dataset.m === "ero" ? (x) => L[x.certa].grupo === "perda" : null);
    }));
  }

  function sortear(n, filtro) {
    const prio = (x) => { const v = S.vistas[x.id] || { c: 0, e: 0 }; return v.e * 2 - v.c - (v.c + v.e === 0 ? 1.2 : 0) + Math.random() * 1.8; };
    const pool = embaralhar(D.itens.filter(x => !filtro || filtro(x))).sort((a, b) => prio(b) - prio(a));
    // no máximo 2 itens da mesma lesão, pelo menos uma erosão (o tema da maquete) e umas fotos no meio
    const out = [], porLesao = {};
    if (!filtro) { const e = pool.find(x => x.certa === "erosao"); if (e) { out.push(e); porLesao.erosao = 1; } }
    for (const x of pool) {
      if (out.length >= n) break;
      if (out.includes(x) || (porLesao[x.certa] || 0) >= (filtro ? 99 : 2)) continue;
      porLesao[x.certa] = (porLesao[x.certa] || 0) + 1; out.push(x);
    }
    return embaralhar(out);
  }
  function opcoes(x) {
    const certa = L[x.certa];
    const mesmo = embaralhar(D.lesoes.filter(l => l.grupo === certa.grupo && l.id !== certa.id));
    const outros = embaralhar(D.lesoes.filter(l => l.grupo !== certa.grupo));
    // erosão × úlcera sempre juntas; o resto completa até 4
    return embaralhar([certa, ...[...mesmo, ...outros].slice(0, 3)]);
  }

  function identificar(n, filtro) {
    const lista = sortear(n, filtro);
    let i = 0, certos = 0;
    const res = [];
    const proxima = () => {
      if (i >= lista.length) return fim();
      const x = lista[i];
      cam.info.textContent = `${i + 1}/${lista.length}`;
      cam.corpo.scrollTop = 0;
      cam.corpo.innerHTML = `<div class="lam lam-q lf">
        <p class="lam-perg">${x.tipo === "foto" ? "Qual lesão fundamental a legenda do livro dá a esta foto?" : "Qual é a lesão fundamental?"}</p>
        ${x.tipo === "foto" ? `<div class="lam-vista gal-vista lf-foto"><img alt=""></div>` : `<div class="lf-desc">${escapar(x.texto)}</div>`}
        <div class="opcoes lam-ops"></div><div class="gal-area"></div></div>`;
      if (x.tipo === "foto") { const im = cam.corpo.querySelector(".lf-foto img"); porImagem(im, x.img); cam.corpo.querySelector(".lf-foto").onclick = () => abrirVisor(im.src); }
      const box = cam.corpo.querySelector(".lam-ops"), area = cam.corpo.querySelector(".gal-area");
      for (const o of opcoes(x)) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = o.nome; b.dataset.id = o.id;
        b.onclick = () => {
          const ok = o.id === x.certa;
          box.querySelectorAll("button").forEach(y => { y.disabled = true; if (y.dataset.id === x.certa) y.classList.add("correta"); });
          if (!ok) { b.classList.add("incorreta"); vibrar(50); }
          tocar(ok ? "certo" : "errado");
          const v = S.vistas[x.id] ??= { c: 0, e: 0 }; v[ok ? "c" : "e"]++; v.ult = hojeISO(); salvar();
          if (ok) certos++;
          res.push({ x, ok });
          area.innerHTML = `<div class="lam-fb ${ok ? "ok" : "erro"}"><b>${ok ? "Isso!" : `Era: ${escapar(L[x.certa].nome)}`}</b>
            <p class="lam-pista">${escapar(x.explic)}</p>
            ${!ok ? `<p class="gal-errada">${escapar(o.nome)}: ${escapar(o.def)}</p>` : ""}
            ${x.tipo === "foto" ? `<p class="lf-leg">No livro: “${escapar(x.legenda)}” (${escapar(x.doenca)})</p>` : ""}
            <small>${x.fonte.map(escapar).join(" · ")}</small></div>`;
          const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = i + 1 < lista.length ? "Próxima" : "Ver resultado";
          bt.onclick = () => { i++; proxima(); };
          area.append(bt); bt.scrollIntoView({ behavior: "smooth", block: "end" });
        };
        box.append(b);
      }
    };
    const fim = () => {
      S.partidas++; salvar();
      if (certos === lista.length) confete();
      const pontos = certos * 10;
      terminar(cam, "lesoes", pontos, { xp: Math.round(pontos / 5), moedas: Math.round(pontos / 10) },
        `<p class="sub">${certos} de ${lista.length} certas.</p><ul class="mira-resumo">${res.map(r => `<li><span>${escapar(L[r.x.certa].nome)}<small>${escapar(r.x.tipo === "foto" ? r.x.doenca : r.x.texto)}</small></span><b>${r.ok ? `<i class="ok">✓</i>` : `<i class="erro">✗</i>`}</b></li>`).join("")}</ul>`, "pontos");
    };
    proxima();
  }

  function estudar() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam cc-ref"><button class="lam-voltar">‹ Voltar</button><h2>Estudar</h2><p class="cc-aviso">${escapar(D.aviso)}</p></div>`;
    const raiz = cam.corpo.firstChild;
    raiz.querySelector(".lam-voltar").onclick = inicio;
    for (const [g, nome] of Object.entries(D.grupos)) {
      raiz.insertAdjacentHTML("beforeend", `<h3>${escapar(nome)}</h3>`);
      for (const l of D.lesoes.filter(x => x.grupo === g)) {
        const d = document.createElement("details"); d.className = "lam-par cc-ref-item";
        const fotos = D.itens.filter(x => x.tipo === "foto" && x.certa === l.id);
        d.innerHTML = `<summary><b>${escapar(l.nome)}</b></summary><p>${escapar(l.def)}</p><small class="cc-fonte">${l.fonte.map(escapar).join(" · ")}</small><div class="lam-grade"></div>`;
        d.addEventListener("toggle", () => {
          const gr = d.querySelector(".lam-grade"); if (!d.open || gr.children.length) return;
          for (const f of fotos) {
            const fig = document.createElement("figure"); fig.className = "lam-mini";
            const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; porImagem(img, f.img);
            img.onclick = () => abrirVisor(img.src, { legenda: f.doenca }); fig.append(img); fig.insertAdjacentHTML("beforeend", `<figcaption>${escapar(f.doenca)}</figcaption>`); gr.append(fig);
          }
        });
        raiz.append(d);
      }
    }
  }
}
