// Treino de Lâminas (pedido do Alediov, 25/10/2026): para a prova prática de Patologia de 01/12/2026 (granuloma
// piogênico, hiperplasia fibrosa, papiloma, mucocele e adenoma pleomórfico). Fotomicrografias do Neville, com os
// critérios do livro em português (extras/jogos/laminas.json, montado por tools/laminas/montar_laminas.py).
// Modos: Identificar (qual é a lesão e qual achado da imagem confirma), Descrever (pensar a descrição e conferir com
// a do modelo) e Estudar (critérios, imagens, parecidas e as fotos das lâminas da aula, tiradas no microscópio).
// A imagem vem espelhada, girada e, no modo difícil, ampliada num ponto, para não decorar a foto do livro; no difícil
// entram também as parecidas (fibroma de células gigantes, granuloma periférico de células gigantes, verruga…).
// Estado em E().laminas: vistas (por lâmina), lesoes (acertos por lesão), dificil, fotos (ids no IndexedDB "arquivos").
import { abrirCamada, terminar, semConteudo } from "../jogos.js";
import { extra, urlMidia, guardarArquivo, pegarArquivo, apagarArquivo } from "../dados.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { escapar, confete, toast } from "../ui.js";
import { E, salvar, hojeISO } from "../estado.js";
import { laminasDaLesao, LD } from "../laminas/registro.js";
import { abrirVisor } from "../visorZoom.js";

const AUMENTO = { pequeno: "Pequeno aumento", "médio": "Médio aumento", grande: "Grande aumento", foto: "Foto da aula" };
const est = () => {
  const l = E().laminas ??= {};
  l.vistas ??= {}; l.lesoes ??= {}; l.fotos ??= {}; l.dificil ??= false; l.partidas ??= 0;
  return l;
};
const diasAte = (d) => Math.round((new Date(d + "T12:00") - new Date(hojeISO() + "T12:00")) / 864e5);

/** URL da imagem de uma lâmina (do livro, guardada no aparelho; ou uma foto da aula). */
const urlsFotos = new Map();
async function urlDe(l) {
  if (l.foto) {
    if (urlsFotos.has(l.foto)) return urlsFotos.get(l.foto);
    const b = await pegarArquivo(l.foto); if (!b) return null;
    const u = URL.createObjectURL(b); urlsFotos.set(l.foto, u); return u;
  }
  return urlMidia(l.img);
}
/** Põe a imagem num <img>; fora do celular, sem a imagem guardada, tenta o arquivo do repositório. */
async function porImagem(img, l) {
  const u = await urlDe(l);
  if (!l.foto) img.onerror = () => { img.onerror = null; img.src = `../${l.img}`; };
  img.src = u || `../${l.img}`;
}

/** As fotos das lâminas da aula viram lâminas do treino (sem os achados: só a identificação). */
async function fotosComoLaminas() {
  const out = [];
  for (const [lesao, lista] of Object.entries(est().fotos)) {
    for (const f of lista || []) if (await pegarArquivo(f.id)) out.push({ id: f.id, lesao, foto: f.id, aumento: "foto", legenda: "Foto sua, da lâmina da aula.", achados: [] });
  }
  return out;
}

export async function jogarLaminas(opts = {}) {
  const cam = abrirCamada("Treino de Lâminas", { musica: "jogos" });
  const D = await extra("jogo:laminas");
  if (!D?.laminas?.length) return semConteudo(cam, "As lâminas ainda não chegaram. Sincronize com internet.");
  const S = est();
  const lesao = Object.fromEntries([...D.lesoes, ...D.parecidas].map(l => [l.id, l]));
  const alvos = new Set(D.lesoes.map(l => l.id));
  const ehAlvo = (l) => alvos.has(l.lesao);

  if (cam.licao) return identificar(opts.quantas || 6);
  if (opts.digitais) return digitais();
  inicio();

  // Lâminas digitais (.vmic, laminas/biblioteca.js): a biblioteca e o visor, carregados só quando abertos
  async function digitais() {
    const B = await import("../laminas/biblioteca.js");
    return B.abrirBiblioteca(cam, { voltar: inicio });
  }
  // Treino com as suas lâminas (laminas/quiz.js): campos sorteados das lâminas digitais ligadas a uma lesão; os acertos
  // das 5 lesões da prova também entram nas barras do início
  async function campos() {
    const Q = await import("../laminas/quiz.js");
    return Q.treinoComLaminas(cam, {
      D, voltar: inicio, abrirBiblioteca: digitais,
      anotarTreino: (id, certo) => { if (!alvos.has(id)) return; const s = S.lesoes[id] ??= { c: 0, e: 0 }; s[certo ? "c" : "e"]++; salvar(); },
      terminar: (pontos, html) => { S.partidas++; salvar(); terminar(cam, "laminas", pontos, { xp: Math.round(pontos / 5), moedas: Math.round(pontos / 10) }, html, "pontos"); },
    });
  }

  // ------------------------------------------------------------ início
  function inicio() {
    cam.info.textContent = "";
    const dd = diasAte(D.prova);
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam">
      <div class="lam-cab"><div class="lam-cont ${dd <= 7 ? "perto" : ""}"><b>${dd > 0 ? dd : dd === 0 ? "hoje" : "–"}</b><small>${dd > 1 ? "dias" : dd === 1 ? "dia" : ""}</small></div>
        <div><h2>${escapar(D.titulo)}</h2><small>${new Date(D.prova + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · ${escapar(D.livro)}</small></div></div>
      <div class="lam-dominio">${D.lesoes.map(l => { const s = S.lesoes[l.id] || { c: 0, e: 0 }, t = s.c + s.e, p = t ? s.c / t : 0;
        return `<div><span>${escapar(l.nome)}</span><i><u style="width:${Math.round(p * 100)}%"></u></i><small>${t ? `${Math.round(p * 100)}%` : "–"}</small></div>`; }).join("")}</div>
      <label class="lam-dificil"><input type="checkbox" ${S.dificil ? "checked" : ""}><span><b>Modo difícil</b><small>Imagem ampliada num ponto e as lesões parecidas no meio</small></span></label>
      <div class="lam-modos">
        <button class="lam-modo" data-m="id"><b>Identificar</b><small>Qual é a lesão e o achado que confirma</small></button>
        <button class="lam-modo" data-m="desc"><b>Descrever</b><small>Pense na descrição e confira com a do modelo</small></button>
        <button class="lam-modo" data-m="est"><b>Estudar</b><small>Critérios, imagens, parecidas e suas fotos da aula</small></button>
        <button class="lam-modo lam-modo-dig" data-m="campos"><b>🎯 Treino com as suas lâminas</b><small>Campos sorteados das lâminas digitais que você ligou a uma lesão</small></button>
        <button class="lam-modo lam-modo-dig" data-m="dig"><b>🔬 Lâminas digitais</b><small>As lâminas escaneadas (.vmic): aproxime como no microscópio e marque o que achar</small></button>
      </div></div>`;
    cam.corpo.querySelector(".lam-dificil input").onchange = (e) => { S.dificil = e.target.checked; salvar(); };
    cam.corpo.querySelectorAll(".lam-modo").forEach(b => (b.onclick = () => ({ id: () => identificar(8), desc: () => descrever(6), est: () => estudar(), dig: () => digitais(), campos: () => campos() })[b.dataset.m]()));
  }

  // ------------------------------------------------------------ escolha das lâminas
  async function sortear(n) {
    let pool = [...D.laminas.filter(ehAlvo), ...(await fotosComoLaminas())];
    if (S.dificil) pool.push(...D.laminas.filter(l => !ehAlvo(l)));
    const prio = (l) => { const v = S.vistas[l.id] || { c: 0, e: 0 }; return v.e * 2 - v.c - (v.c + v.e === 0 ? 1.5 : 0) + Math.random() * 1.6; };
    pool = embaralhar(pool).sort((a, b) => prio(b) - prio(a));
    // cada uma das cinco aparece pelo menos uma vez; o resto pela prioridade (sem repetir em seguida)
    const escolha = [];
    for (const id of embaralhar([...alvos])) { const l = pool.find(x => x.lesao === id && !escolha.includes(x)); if (l && escolha.length < n) escolha.push(l); }
    for (const l of pool) { if (escolha.length >= n) break; if (!escolha.includes(l)) escolha.push(l); }
    while (escolha.length < n && pool.length) escolha.push(pool[escolha.length % pool.length]);
    return embaralhar(escolha);
  }

  /** O bloco da imagem, com o aumento e a transformação sorteada; tocar amplia. */
  function vista(l) {
    const box = document.createElement("div"); box.className = "lam-vista";
    const img = document.createElement("img"); img.alt = ""; img.decoding = "async";
    const giro = Math.random() < 0.5 ? 180 : 0, esp = Math.random() < 0.5 ? -1 : 1;
    const zoom = S.dificil && l.aumento !== "grande" ? 1.25 + Math.random() * 0.45 : 1;
    // girar e espelhar SEMPRE pelo centro; a ampliação do modo difícil vai para um ponto sorteado por um translate.
    // Até 30/10/2026 tudo usava o ponto sorteado como eixo, e o espelho fora do centro jogava a foto para fora do
    // quadro (sobrava um canto da lâmina e o resto preto).
    const orienta = `rotate(${giro}deg) scaleX(${esp})`;
    const px = 15 + Math.random() * 70, py = 15 + Math.random() * 70, k = 1 - zoom;
    img.style.transformOrigin = "50% 50%";
    // no difícil, a foto preenche o quadro antes de ampliar (com "contain", a ampliação perto da borda mostrava a faixa preta)
    if (zoom !== 1) img.style.objectFit = "cover";
    img.style.transform = zoom === 1 ? orienta : `translate(${(k * (px - 50)).toFixed(1)}%, ${(k * (py - 50)).toFixed(1)}%) scale(${zoom.toFixed(2)}) ${orienta}`;
    porImagem(img, l);
    box.append(img);
    box.insertAdjacentHTML("beforeend", `<span class="lam-aum">${escapar(AUMENTO[l.aumento] || "")}</span><span class="lam-lupa">⤢</span>`);
    // no modo difícil o aumento é o exercício: amplia o mesmo recorte, sem zoom e sem mostrar a foto inteira
    box.onclick = () => (zoom !== 1
      ? abrirVisor(img.src, { travado: true, quadro: { razao: box.clientWidth / Math.max(1, box.clientHeight), transform: img.style.transform, cobrir: true } })
      : ampliar(img.src, orienta));
    return box;
  }

  function anotar(l, certo) {
    const v = S.vistas[l.id] ??= { c: 0, e: 0 }; v[certo ? "c" : "e"]++; v.ult = hojeISO();
    if (ehAlvo(l)) { const s = S.lesoes[l.lesao] ??= { c: 0, e: 0 }; s[certo ? "c" : "e"]++; }
    salvar();
  }

  // ------------------------------------------------------------ Identificar
  async function identificar(n) {
    const lista = await sortear(n);
    let i = 0, pontos = 0, acertosId = 0, acertosAch = 0, comAchado = 0;
    const resumo = [];
    const parecidas = D.parecidas;

    function opcoesPara(l) {
      const ops = D.lesoes.map(x => x.id);
      if (S.dificil) {
        const extras = new Set();
        if (!ehAlvo(l)) extras.add(l.lesao);
        for (const p of embaralhar(parecidas)) { if (extras.size >= 2) break; extras.add(p.id); }
        ops.push(...extras);
      }
      return embaralhar(ops);
    }

    function proxima() {
      if (i >= lista.length) return fim();
      const l = lista[i], L = lesao[l.lesao];
      cam.info.textContent = `${i + 1}/${lista.length}`;
      cam.corpo.scrollTop = 0;
      cam.corpo.innerHTML = `<div class="lam lam-q"><p class="lam-perg">Que lesão é esta?</p></div>`;
      const raiz = cam.corpo.firstChild;
      raiz.append(vista(l));
      const box = document.createElement("div"); box.className = "opcoes lam-ops"; raiz.append(box);
      const area = document.createElement("div"); raiz.append(area);
      for (const id of opcoesPara(l)) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = lesao[id].nome; b.dataset.id = id;
        b.onclick = () => {
          const certo = id === l.lesao;
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.dataset.id === l.lesao) x.classList.add("correta"); });
          if (!certo) b.classList.add("incorreta");
          tocar(certo ? "certo" : "errado"); if (!certo) vibrar?.(60);
          anotar(l, certo);
          if (certo) { pontos += 10; acertosId++; }
          const r = { l, id: certo, ach: null }; resumo.push(r);
          if (certo && l.achados?.length) return achado(l, raiz, area, r);
          retorno(l, area, certo);
        };
        box.append(b);
      }
    }

    // 2ª etapa: qual achado desta imagem confirma o diagnóstico
    function achado(l, raiz, area, r) {
      comAchado++;
      const certo = embaralhar(l.achados)[0];
      const outros = embaralhar(D.lesoes.filter(x => x.id !== l.lesao).flatMap(x => x.achados)).slice(0, 3);
      area.innerHTML = `<p class="lam-perg">Qual destes achados aparece nesta imagem?</p>`;
      const box = document.createElement("div"); box.className = "opcoes lam-ops"; area.append(box);
      const fb = document.createElement("div"); area.append(fb);
      for (const t of embaralhar([certo, ...outros])) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = t;
        b.onclick = () => {
          const ok = t === certo;
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === certo) x.classList.add("correta"); });
          if (!ok) b.classList.add("incorreta");
          tocar(ok ? "certo" : "errado");
          r.ach = ok; if (ok) { pontos += 5; acertosAch++; }
          retorno(l, fb, true, ok);
        };
        box.append(b);
      }
      area.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function retorno(l, area, certoId, certoAch = null) {
      const L = lesao[l.lesao], alvo = ehAlvo(l);
      const tit = certoId ? (certoAch === false ? "Lesão certa; o achado era outro" : "Isso!") : `Era: ${L.nome}`;
      area.insertAdjacentHTML("beforeend", `<div class="lam-fb ${certoId && certoAch !== false ? "ok" : "erro"}">
        <b>${escapar(tit)}</b>
        <p>${escapar(l.legenda || "")}</p>
        ${alvo ? `<p class="lam-pista">💡 ${escapar(L.pista)}</p>` : `<p class="lam-pista">Parece ${escapar(lesao[L.parece].nome.toLowerCase())}, mas: ${escapar(L.diferenca)}</p>`}
        ${l.achados?.length ? `<ul>${l.achados.map(a => `<li>${escapar(a)}</li>`).join("")}</ul>` : ""}
        ${l.fonte?.figura ? `<small>Neville, fig. ${escapar(l.fonte.figura)}${l.fonte.pagina ? `, p. ${l.fonte.pagina} do PDF` : ""}</small>` : ""}
      </div>`);
      const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = i + 1 < lista.length ? "Próxima lâmina" : "Ver resultado";
      bt.onclick = () => { i++; proxima(); };
      area.append(bt);
      bt.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    function fim() {
      S.partidas++; salvar();
      if (acertosId === lista.length) confete();
      const linhas = resumo.map(r => `<li><span>${escapar(lesao[r.l.lesao].nome)}<small>${escapar(AUMENTO[r.l.aumento] || "")}</small></span><b>${r.id ? `<i class="ok">✓</i>` : `<i class="erro">✗</i>`}${r.ach === null ? "" : r.ach ? `<i class="ok">✓</i>` : `<i class="erro">✗</i>`}</b></li>`).join("");
      terminar(cam, "laminas", pontos, { xp: Math.round(pontos / 5), moedas: Math.round(pontos / 10) },
        `<p class="sub">${acertosId} de ${lista.length} lesões${comAchado ? ` · ${acertosAch} de ${comAchado} achados` : ""}.</p><ul class="mira-resumo">${linhas}</ul>`, "pontos");
    }

    proxima();
  }

  // ------------------------------------------------------------ Descrever
  async function descrever(n) {
    const lista = (await sortear(n));
    let i = 0, pontos = 0;
    const notas = [];
    function proxima() {
      if (i >= lista.length) return fim();
      const l = lista[i], L = lesao[l.lesao], alvo = ehAlvo(l);
      cam.info.textContent = `${i + 1}/${lista.length}`;
      cam.corpo.scrollTop = 0;
      cam.corpo.innerHTML = `<div class="lam lam-q"><p class="lam-perg">Descreva o que vê e dê o diagnóstico. Fale em voz alta ou escreva num papel, como na prova.</p></div>`;
      const raiz = cam.corpo.firstChild;
      raiz.append(vista(l));
      const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = "Ver a resposta";
      raiz.append(bt);
      bt.onclick = () => {
        bt.remove();
        raiz.insertAdjacentHTML("beforeend", `<div class="lam-fb neutro"><b>${escapar(L.nome)}</b><p>${escapar(l.legenda || "")}</p>
          ${alvo ? `<p class="lam-desc">${escapar(L.descricao)}</p><ul>${L.criterios.map(c => `<li>${escapar(c)}</li>`).join("")}</ul>` : `<p class="lam-pista">Parece ${escapar(lesao[L.parece].nome.toLowerCase())}, mas: ${escapar(L.diferenca)}</p>`}</div>
          <p class="lam-perg">Como foi?</p><div class="lam-auto"><button data-v="0" class="botao secundario">Errei</button><button data-v="1" class="botao secundario">Quase</button><button data-v="2" class="botao">Acertei</button></div>`);
        raiz.querySelectorAll(".lam-auto button").forEach(b => (b.onclick = () => {
          const v = +b.dataset.v; anotar(l, v === 2); pontos += v * 5; notas.push({ l, v }); tocar(v === 2 ? "certo" : "toque"); i++; proxima();
        }));
        raiz.querySelector(".lam-fb").scrollIntoView({ behavior: "smooth", block: "start" });
      };
    }
    function fim() {
      S.partidas++; salvar();
      const ic = ["<i class=\"erro\">✗</i>", "<i class=\"meio\">½</i>", "<i class=\"ok\">✓</i>"];
      terminar(cam, "laminas", pontos, { xp: Math.round(pontos / 5), moedas: Math.round(pontos / 10) },
        `<ul class="mira-resumo">${notas.map(r => `<li><span>${escapar(lesao[r.l.lesao].nome)}</span><b>${ic[r.v]}</b></li>`).join("")}</ul>`, "pontos");
    }
    proxima();
  }

  // ------------------------------------------------------------ Estudar
  function estudar() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam"><button class="lam-voltar">‹ Voltar</button><h2>Estudar</h2>
      <div class="lam-lista">${D.lesoes.map(l => `<button class="lam-les" data-id="${l.id}"><b>${escapar(l.nome)}</b><small>${escapar(l.en)}</small></button>`).join("")}</div></div>`;
    cam.corpo.querySelector(".lam-voltar").onclick = inicio;
    cam.corpo.querySelectorAll(".lam-les").forEach(b => (b.onclick = () => ficha(b.dataset.id)));
  }

  async function ficha(id) {
    const L = lesao[id];
    const imgs = D.laminas.filter(l => l.lesao === id), par = D.parecidas.filter(p => p.parece === id);
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam"><button class="lam-voltar">‹ Lesões</button>
      <h2>${escapar(L.nome)}</h2><small class="lam-en">${escapar(L.en)} · Neville, unidade ${escapar(L.unidade)}</small>
      <p class="lam-pista">💡 ${escapar(L.pista)}</p>
      ${laminasDaLesao(id).length ? `<button class="botao lam-digital">🔬 Abrir a lâmina digital${laminasDaLesao(id).length > 1 ? ` (${laminasDaLesao(id).length})` : ""}</button>` : ""}
      <h3>Critérios</h3><ul class="lam-crit">${L.criterios.map(c => `<li>${escapar(c)}</li>`).join("")}</ul>
      <h3>Descrição modelo</h3><p class="lam-desc">${escapar(L.descricao)}</p>
      <h3>Imagens do livro</h3><div class="lam-grade" data-g="livro"></div>
      <h3>Suas fotos da aula</h3><p class="lam-nota">Fotografe a lâmina pelo microscópio (ou pela tela do laboratório): ela entra no treino. Ficam só neste aparelho.</p>
      <div class="lam-grade" data-g="fotos"></div>
      <label class="botao secundario lam-add">+ Foto da lâmina<input type="file" accept="image/*" hidden></label>
      ${par.length ? `<h3>Não confunda com</h3>${par.map(p => `<div class="lam-par"><b>${escapar(p.nome)}</b><p>${escapar(p.diferenca)}</p><div class="lam-grade" data-p="${p.id}"></div></div>`).join("")}` : ""}
    </div>`;
    cam.corpo.querySelector(".lam-voltar").onclick = estudar;
    const dig = cam.corpo.querySelector(".lam-digital");
    if (dig) dig.onclick = async () => { const B = await import("../laminas/biblioteca.js"); B.abrirDaLesao(cam, id, { voltar: () => ficha(id) }); };
    const mini = (l, onde, extraBtn) => {
      const f = document.createElement("figure"); f.className = "lam-mini";
      const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; porImagem(img, l);
      f.append(img);
      if (l.legenda && !l.foto) f.insertAdjacentHTML("beforeend", `<figcaption>${escapar(l.legenda)}</figcaption>`);
      img.onclick = () => ampliar(img.src);
      if (extraBtn) f.append(extraBtn);
      onde.append(f);
    };
    const gl = cam.corpo.querySelector('[data-g="livro"]'); imgs.forEach(l => mini(l, gl));
    for (const p of par) { const g = cam.corpo.querySelector(`[data-p="${p.id}"]`); D.laminas.filter(l => l.lesao === p.id).forEach(l => mini(l, g)); }
    const gf = cam.corpo.querySelector('[data-g="fotos"]');
    const desenharFotos = async () => {
      gf.innerHTML = "";
      for (const f of S.fotos[id] || []) {
        if (!(await pegarArquivo(f.id))) continue;
        const x = document.createElement("button"); x.className = "lam-tirar"; x.textContent = "×"; x.ariaLabel = "Apagar a foto";
        x.onclick = async (e) => { e.stopPropagation(); S.fotos[id] = S.fotos[id].filter(y => y.id !== f.id); salvar(); await apagarArquivo(f.id); desenharFotos(); };
        mini({ foto: f.id, lesao: id, aumento: "foto" }, gf, x);
      }
      if (!gf.children.length) gf.innerHTML = `<p class="lam-nota">Nenhuma ainda.</p>`;
    };
    desenharFotos();
    cam.corpo.querySelector(".lam-add input").onchange = async (e) => {
      const arq = e.target.files?.[0]; if (!arq) return;
      try {
        const blob = await reduzir(arq, 1600);
        const fid = `lamina:${id}:${Date.now()}`;
        await guardarArquivo(fid, blob);
        (S.fotos[id] ??= []).push({ id: fid, em: hojeISO() }); salvar();
        toast("Foto guardada: ela entra no treino."); desenharFotos();
      } catch (err) { toast(err.message || "Não deu para abrir a foto."); }
      e.target.value = "";
    };
  }
}

async function reduzir(arq, max) {
  const bmp = await createImageBitmap(arq);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, erro) => c.toBlob(b => (b ? ok(b) : erro(new Error("Não deu para reduzir a foto."))), "image/jpeg", 0.88));
}

/** Imagem em tela cheia com zoom (visorZoom.js), na orientação do exercício. */
const ampliar = (src, transform = "") => abrirVisor(src, { orienta: transform });

/** Cartão para a aba Provas da trilha (até o dia da prova). */
export async function cartaoLaminas(P) {
  const D = await extra("jogo:laminas").catch(() => null);
  if (!D || diasAte(D.prova) < 0) return;
  const S = est(), dd = diasAte(D.prova);
  const tot = D.lesoes.reduce((a, l) => { const s = S.lesoes[l.id]; return s ? { c: a.c + s.c, t: a.t + s.c + s.e } : a; }, { c: 0, t: 0 });
  const el = document.createElement("button"); el.className = "lam-cartao";
  el.innerHTML = `<span class="lam-c-ico">🔬</span><span class="lam-c-tx"><b>Treino de Lâminas</b><small>Prova prática ${dd === 0 ? "hoje" : dd === 1 ? "amanhã" : `em ${dd} dias`} · ${tot.t ? `${Math.round((tot.c / tot.t) * 100)}% de acerto` : "5 lesões"}</small></span><span class="lam-c-ir">›</span>`;
  el.onclick = () => jogarLaminas();
  P.append(el);
  // as lâminas digitais (quando já há alguma registrada neste aparelho ou no outro)
  const nd = Object.keys(LD()).length;
  if (nd) {
    const d = document.createElement("button"); d.className = "lam-cartao lam-cartao-dig";
    d.innerHTML = `<span class="lam-c-ico">🧫</span><span class="lam-c-tx"><b>Lâminas digitais</b><small>${nd} lâmina${nd === 1 ? "" : "s"} escaneada${nd === 1 ? "" : "s"} · aproxime e marque</small></span><span class="lam-c-ir">›</span>`;
    d.onclick = () => jogarLaminas({ digitais: true });
    P.append(d);
  }
}
