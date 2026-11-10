// Defesa do Sorriso: monstros descem pelas 5 faixas rumo aos cristais do reino.
// Você posiciona os companheiros da Coleção (o nível da carta conta); a energia vem
// do tempo, dos geradores e das perguntas relâmpago. Dois mapas (04/11/2026, pedido do Alediov: mais variedade):
// - Vale das Gosmas: gosmas, morcegos e golens; o chefe é o Rei Gosma, com um selo que só cai acertando o
//   diagnóstico de um caso do Detetive (de preferência do recorte da próxima prova) ou uma pergunta da prova.
// - Cripta das Aranhas: aranhas que pulam por cima do primeiro companheiro, fantasmas que atravessam as
//   unidades e somem de vez em quando (sumidos, os tiros passam por eles) e golens; a chefe é Aracna, a Rainha da
//   Cripta, que troca de faixa, solta aranhas e tem um selo duplo (duas perguntas da prova).
// As perguntas vêm de preferência do que cai na PRÓXIMA prova (`perguntasDaProva`, pelo recorte da Agenda).
import { abrirCamada, terminar, perguntaRapida, perguntasDaProva, faixaProva, escolhaJogo } from "../jogos.js";
import { CARTAS, colecao, equipada, arteCarta } from "../colecao.js";
import { CRIATURAS, imagem } from "../arte/fantasia.js";
import { extra } from "../dados.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { escapar } from "../ui.js";
import { musicaCamada } from "../musica.js";

const PAPEL = {
  moli: "atirador", ina: "atirador", caio: "atirador", dentina: "atirador", confete: "atirador",
  cani: "forte", yumi: "forte", esmalte: "forte", estrelinha: "forte",
  leitinho: "gerador", bia: "gerador", lia: "gerador", pirulito: "gerador", cora: "gerador",
  sisa: "escudo", implantina: "escudo", juninha: "escudo",
  premi: "gelo", nix: "gelo", fantasminha: "gelo",
  mel: "bomba", noelzinho: "bomba",
  aurora: "cura", festeira: "cura",
  escovinha: "atirador", pastinha: "atirador", castor: "atirador", narval: "atirador",
  morsa: "forte", mamute: "forte", sisorath: "forte", turbina: "forte", tubarao: "forte",
  fiona: "gerador", tati: "gerador", capivara: "gerador", polvo: "gerador", neve: "gerador",
  hipo: "escudo", golem: "escudo", espelhinho: "escudo", barao: "escudo",
  tubetinho: "gelo", carpule: "gelo", raul: "gelo",
  gosminha: "bomba", mutans: "bomba", siso: "bomba",
  unicornio: "cura", futuro: "cura",
};
const PAPEIS = {
  atirador: { nome: "Atirador", custo: 3, hp: 100, dano: 20, cad: 1.2, desc: "lança orbes mágicos" },
  forte: { nome: "Forte", custo: 5, hp: 120, dano: 48, cad: 1.6, desc: "golpe pesado" },
  gerador: { nome: "Gerador", custo: 2, hp: 80, gera: 7, desc: "+1 energia a cada 7 s" },
  escudo: { nome: "Escudo", custo: 4, hp: 420, desc: "segura a faixa" },
  gelo: { nome: "Gelo", custo: 4, hp: 90, dano: 10, cad: 1.4, lento: 2.2, desc: "congela os monstros" },
  bomba: { nome: "Bomba", custo: 6, hp: 1, dano: 260, desc: "explode em área" },
  cura: { nome: "Cura", custo: 7, hp: 1, desc: "restaura um cristal rachado" },
};
const INIMIGOS = {
  bacteria: { nome: "Gosma", hp: 60, vel: 20, dano: 22, cor: "#7FD6A0", escura: "#3E9E66", r: 0.28, pts: 10 },
  biofilme: { nome: "Golem", hp: 190, vel: 11, dano: 30, cor: "#B69CF7", escura: "#6B4FD8", r: 0.34, pts: 25 },
  carie: { nome: "Morcego", hp: 42, vel: 36, dano: 16, cor: "#C98A5B", escura: "#7A4B26", r: 0.24, pts: 12 },
  // Cripta
  aranha: { nome: "Aranha", hp: 48, vel: 30, dano: 18, cor: "#7C6CF0", escura: "#3B2F73", r: 0.26, pts: 14, salta: true },
  fantasma: { nome: "Fantasma", hp: 70, vel: 15, dano: 0, cor: "#D6D2F2", escura: "#8F88C9", r: 0.27, pts: 18, atravessa: true },
};
// Os mapas: as ondas (n = número de monstros, i = posição na fila) e a chefe.
const MAPAS = {
  vale: { nome: "Vale das Gosmas", chefe: "reiGosma", nomeChefe: "Rei Gosma", desc: "Gosmas, morcegos e golens. Chefe: o Rei Gosma e o selo do diagnóstico.",
    tipo: (onda, i) => (onda >= 3 && i % 4 === 3 ? "biofilme" : onda >= 2 && i % 3 === 2 ? "carie" : "bacteria") },
  cripta: { nome: "Cripta das Aranhas", chefe: "aranhaRainha", nomeChefe: "Aracna, a Rainha da Cripta", desc: "Aranhas que pulam, fantasmas que atravessam e golens. Chefe: Aracna, com selo duplo.",
    tipo: (onda, i) => (onda >= 3 && i % 5 === 4 ? "biofilme" : onda >= 2 && i % 3 === 1 ? "fantasma" : onda === 1 && i % 2 ? "bacteria" : "aranha") },
};
const COLS = 5, LINHAS = 9, ONDAS = 5;

function imagemSVG(svg) { const i = new Image(); i.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.includes("xmlns=") ? svg : svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/var\(--[a-z-]+\)/g, "#2F6BFF")); return i; }

function montarBaralho() {
  const cs = colecao().cartas, donos = Object.keys(cs).filter(id => PAPEL[id]);
  const melhor = {};
  for (const id of donos) { const p = PAPEL[id]; if (!melhor[p] || cs[id].nivel > cs[melhor[p]].nivel) melhor[p] = id; }
  const eq = equipada();
  if (PAPEL[eq]) melhor[PAPEL[eq]] = eq;
  return Object.entries(melhor).map(([papel, id]) => ({ id, papel, nivel: cs[id].nivel, ...PAPEIS[papel], img: imagemSVG(arteCarta(id, { classe: "" })) }))
    .sort((a, b) => a.custo - b.custo);
}

export async function jogarDefesa(mapaPedido = null) {
  const cam = abrirCamada("Defesa do Sorriso", { musica: "reino" });
  const [D, fp] = await Promise.all([extra("jogo:detetive"), perguntasDaProva()]);
  if (cam.saiu) return;
  const pool = fp.pool, todosCasos = D?.casos || [];
  // casos do Rei Gosma: os do recorte da próxima prova; com prova sem caso do Detetive, o selo vira uma pergunta da prova
  const casos = fp.recorte ? todosCasos.filter(c => fp.recorte.some(p => c.fonte?.unidade?.startsWith(p))) : todosCasos;
  let MAPA = MAPAS[mapaPedido] || MAPAS[escolhaJogo("defesa")] || MAPAS.vale;
  const baralho = montarBaralho();
  cam.corpo.innerHTML = `<div class="defesa">
    <div class="def-hud"><div class="def-energia"><div></div><b>5</b></div><span class="def-onda">Onda 1/${ONDAS}</span><span class="def-dentes"></span></div>
    <canvas class="def-canvas"></canvas>
    <div class="def-baralho"></div>
    <button class="botao def-pergunta">Pergunta relâmpago: +4 energia</button>
  </div>`;
  const cv = cam.corpo.querySelector("canvas"), ctx = cv.getContext("2d");
  const elEn = cam.corpo.querySelector(".def-energia div"), elEnN = cam.corpo.querySelector(".def-energia b"), elOnda = cam.corpo.querySelector(".def-onda"), elDentes = cam.corpo.querySelector(".def-dentes");
  const btP = cam.corpo.querySelector(".def-pergunta"), elBar = cam.corpo.querySelector(".def-baralho");
  // tamanho
  const W = cam.corpo.querySelector(".defesa").clientWidth - 4;
  const altDisp = window.innerHeight - 64 - 44 - 96 - 60 - 20;
  const cw = W / COLS, ch = Math.max(44, Math.min(70, altDisp / LINHAS));
  const H = ch * LINHAS, dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`; ctx.scale(dpr, dpr);

  const imgDente = imagem(CRIATURAS.cristal(0)), imgDenteTriste = imagem(CRIATURAS.cristal(1));
  const IMG = { bacteria: imagem(CRIATURAS.gosma()), biofilme: imagem(CRIATURAS.golem()), morcego0: imagem(CRIATURAS.morcego(0)), morcego1: imagem(CRIATURAS.morcego(1)),
    aranha0: imagem(CRIATURAS.aranha(0)), aranha1: imagem(CRIATURAS.aranha(1)), fantasma: imagem(CRIATURAS.fantasma()), reiGosma: imagem(CRIATURAS.reiGosma()), aranhaRainha: imagem(CRIATURAS.aranhaRainha()) };
  const S = {
    energia: 5, dentes: Array(COLS).fill(true), unidades: [], inimigos: [], tiros: [], efeitos: [],
    onda: 0, spawnFila: [], proxSpawn: 0, pausa: 3, sel: null, pontos: 0, mortes: 0, cdPergunta: 0, fim: false, t: 0,
    chefe: null, cdEscudo: 0,
  };
  const ocupada = (c, l) => S.unidades.some(u => u.c === c && u.l === l);

  // ---------- baralho ----------
  function desenharBaralho() {
    elBar.innerHTML = "";
    for (const b of baralho) {
      const el = document.createElement("button"); el.className = `def-carta ${S.sel === b ? "sel" : ""} ${S.energia < b.custo ? "caro" : ""}`;
      el.innerHTML = `<span class="def-custo">${b.custo}</span>${arteCarta(b.id)}<small>${b.nome}</small>`;
      el.onclick = () => { S.sel = S.sel === b ? null : b; tocar("toque"); desenharBaralho(); };
      elBar.append(el);
    }
  }
  desenharBaralho();
  cv.onclick = (e) => {
    if (S.fim || !S.sel) return;
    const r = cv.getBoundingClientRect(), c = Math.floor((e.clientX - r.left) / cw), l = Math.floor((e.clientY - r.top) / ch);
    if (c < 0 || c >= COLS || l < 2 || l >= LINHAS - 1) return;
    const b = S.sel;
    if (S.energia < b.custo) { vibrar(20); return; }
    if (b.papel === "cura") {
      const i = S.dentes.findIndex(d => !d);
      if (i < 0) return; // nada a curar
      S.dentes[i] = true; S.energia -= b.custo; tocar("combo"); S.efeitos.push({ tipo: "brilho", x: (i + 0.5) * cw, y: (LINHAS - 0.5) * ch, t: 0.8 });
      S.sel = null; desenharBaralho(); return;
    }
    if (ocupada(c, l)) return;
    S.energia -= b.custo; tocar("par");
    const mult = 1 + 0.08 * (b.nivel - 1);
    S.unidades.push({ ...b, c, l, hp: b.hp * mult, hpMax: b.hp * mult, dano: (b.dano || 0) * mult, cd: 0.3, gera: b.gera || 0, tg: b.gera || 0, vida: b.papel === "bomba" ? 0.9 : null });
    S.sel = null; desenharBaralho();
  };
  btP.onclick = async () => {
    if (S.cdPergunta > 0 || S.fim) return;
    cam.pausado = true;
    const ok = await perguntaRapida(cam, "Pergunta relâmpago: acerte para ganhar energia", pool);
    cam.pausado = false;
    if (ok) { S.energia = Math.min(12, S.energia + 4); S.efeitos.push({ tipo: "texto", txt: "+4 ⚡", x: W / 2, y: H / 2, t: 1 }); }
    S.cdPergunta = 12;
  };

  // ---------- ondas ----------
  function prepararOnda() {
    S.onda++;
    const n = 4 + S.onda * 2, fila = [];
    for (let i = 0; i < n; i++) fila.push(MAPA.tipo(S.onda, i));
    S.spawnFila = embaralhar(fila);
    if (S.onda === ONDAS) S.spawnFila.push("chefe");
    S.proxSpawn = 1;
    elOnda.textContent = `Onda ${S.onda}/${ONDAS}`;
    S.efeitos.push({ tipo: "texto", txt: S.onda === ONDAS ? "Última onda!" : `Onda ${S.onda}`, x: W / 2, y: H * 0.35, t: 1.6, grande: true });
  }
  function criar(tipo) {
    const c = Math.floor(Math.random() * COLS);
    if (tipo === "chefe") {
      if (MAPA.chefe === "aranhaRainha") {
        S.chefe = { tipo: "chefe", variante: "aranhaRainha", nome: MAPA.nomeChefe, c: 2, x: 2.5 * cw, y: -ch, hp: 1500, hpMax: 1500, vel: 8, dano: 50, r: 0.6, escudo: true, selos: 2, lento: 0, pts: 320, troca: 3.5, cria: 5, alvoC: 2 };
      } else {
        const caso = casos.length ? casos[Math.floor(Math.random() * casos.length)] : null;
        S.chefe = { tipo: "chefe", variante: "reiGosma", nome: caso?.diagnostico || (fp.prova ? "Pergunta da prova" : "Lesão misteriosa"), caso, c: 2, x: 2.5 * cw, y: -ch, hp: 1600, hpMax: 1600, vel: 7, dano: 60, r: 0.6, escudo: true, lento: 0, pts: 300 };
      }
      S.inimigos.push(S.chefe); musicaCamada("chefe");
      return;
    }
    const d = INIMIGOS[tipo], mult = 1 + 0.12 * (S.onda - 1);
    S.inimigos.push({ tipo, ...d, c, x: (c + 0.5) * cw, y: -ch * 0.4, hp: d.hp * mult, hpMax: d.hp * mult, lento: 0, fase: Math.random() * 6 });
  }
  async function quebrarEscudo() {
    const ch_ = S.chefe;
    if (!ch_ || !ch_.escudo || S.cdEscudo > 0 || S.fim || S.pedindoEscudo) return;
    S.pedindoEscudo = true; cam.pausado = true;
    const rainha = ch_.variante === "aranhaRainha";
    const ok = ch_.caso ? await perguntaChefe(ch_.caso) : await perguntaRapida(cam, rainha ? `Selo da Rainha (${3 - ch_.selos} de 2): acerte para rachar` : "Quebre o escudo do chefe", pool);
    cam.pausado = false; S.pedindoEscudo = false; ult = performance.now();
    if (ok && rainha && ch_.selos > 1) { ch_.selos--; ch_.hp -= 120; S.cdEscudo = 2.5; tocar("certo"); S.efeitos.push({ tipo: "texto", txt: "Um selo a menos!", x: ch_.x, y: ch_.y, t: 1.2 }); }
    else if (ok) { ch_.escudo = false; ch_.selos = 0; ch_.hp -= 300; tocar("combo"); vibrar(60); S.efeitos.push({ tipo: "texto", txt: "Selo quebrado!", x: ch_.x, y: ch_.y, t: 1.4, grande: true }); }
    else { S.cdEscudo = 8; ch_.vel *= 1.25; S.efeitos.push({ tipo: "texto", txt: rainha ? "Aracna acelerou!" : "O Rei Gosma acelerou!", x: ch_.x, y: ch_.y, t: 1.4 }); }
  }
  function perguntaChefe(caso) {
    return new Promise((ok) => {
      const ov = document.createElement("div"); ov.className = "pergunta-rapida";
      ov.innerHTML = `<div class="pr-caixa"><small>O chefe é uma lesão com escudo. Qual é o diagnóstico?</small><ol class="pistas">${caso.pistas.slice(0, 3).map(p => `<li>${escapar(p)}</li>`).join("")}</ol><div class="opcoes"></div><div class="pr-fb"></div></div>`;
      const box = ov.querySelector(".opcoes"), fb = ov.querySelector(".pr-fb");
      for (const op of embaralhar(caso.opcoes)) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = op;
        b.onclick = () => {
          const certo = op === caso.diagnostico;
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === caso.diagnostico) x.classList.add("correta"); });
          if (!certo) b.classList.add("incorreta");
          tocar(certo ? "certo" : "errado");
          fb.innerHTML = `<p class="${certo ? "ok" : "erro"}">${escapar(caso.explicacao)}</p>`;
          const nx = document.createElement("button"); nx.className = "botao"; nx.textContent = "Voltar à defesa";
          nx.onclick = () => { ov.remove(); ok(certo); };
          fb.append(nx);
        };
        box.append(b);
      }
      cam.raiz.append(ov);
    });
  }

  // ---------- simulação ----------
  function atualizar(dt) {
    S.t += dt;
    S.energia = Math.min(12, S.energia + dt / 3.5);
    S.cdPergunta = Math.max(0, S.cdPergunta - dt); S.cdEscudo = Math.max(0, S.cdEscudo - dt);
    if (S.chefe?.escudo && S.cdEscudo <= 0 && !S.pedindoEscudo && S.chefe.y > ch * 0.6) quebrarEscudo();
    // ondas
    if (!S.spawnFila.length && !S.inimigos.length) {
      if (S.onda >= ONDAS) return vencer();
      S.pausa -= dt; if (S.pausa <= 0) { prepararOnda(); S.pausa = 7; }
    } else if (S.spawnFila.length) {
      S.proxSpawn -= dt;
      if (S.proxSpawn <= 0) { criar(S.spawnFila.shift()); S.proxSpawn = Math.max(0.9, 2.6 - S.onda * 0.3); }
    }
    // unidades
    for (const u of S.unidades) {
      if (u.papel === "gerador") { u.tg -= dt; if (u.tg <= 0) { u.tg = u.gera; S.energia = Math.min(12, S.energia + 1); S.efeitos.push({ tipo: "texto", txt: "+1", x: (u.c + 0.5) * cw, y: u.l * ch, t: 0.8 }); } }
      if (u.papel === "bomba") {
        u.vida -= dt;
        if (u.vida <= 0) {
          const cx = (u.c + 0.5) * cw, cy = (u.l + 0.5) * ch;
          for (const e of S.inimigos) if (Math.abs(e.x - cx) < cw * 1.6 && Math.abs(e.y - cy) < ch * 1.8) ferir(e, e.escudo ? u.dano * 0.15 : u.dano);
          S.efeitos.push({ tipo: "explosao", x: cx, y: cy, t: 0.5 }); tocar("bau"); vibrar(50); u.hp = 0;
        }
        continue;
      }
      if (u.dano && ["atirador", "forte", "gelo"].includes(u.papel)) {
        u.cd -= dt;
        const alvo = S.inimigos.some(e => e.c === u.c && e.y < (u.l + 0.5) * ch && e.y > -ch * 0.5) || (S.chefe && Math.abs(S.chefe.x - (u.c + 0.5) * cw) < cw * 1.2 && S.chefe.y < (u.l + 0.5) * ch);
        if (alvo && u.cd <= 0) { u.cd = u.cad; S.tiros.push({ x: (u.c + 0.5) * cw, y: (u.l + 0.3) * ch, c: u.c, dano: u.dano, gelo: u.papel === "gelo" ? u.lento : 0, forte: u.papel === "forte" }); }
      }
    }
    // tiros
    for (const t of S.tiros) {
      t.y -= 260 * dt;
      for (const e of S.inimigos) {
        const mesmaFaixa = e.tipo === "chefe" ? Math.abs(e.x - t.x) < cw * 1.2 : e.c === t.c;
        if (mesmaFaixa && !e.sumido && Math.abs(e.y - t.y) < ch * (e.r + 0.15)) {
          ferir(e, e.escudo ? t.dano * 0.1 : t.dano); if (t.gelo) e.lento = t.gelo; t.y = -999; break;
        }
      }
    }
    S.tiros = S.tiros.filter(t => t.y > -ch);
    // inimigos
    const rainha = S.chefe?.variante === "aranhaRainha" ? S.chefe : null;
    if (rainha && rainha.y > 0) {
      // Aracna troca de faixa e solta aranhas nas faixas do lado
      rainha.troca -= dt; rainha.cria -= dt;
      if (rainha.troca <= 0) { rainha.troca = 3.2 + Math.random() * 1.6; rainha.alvoC = Math.max(1, Math.min(COLS - 2, rainha.alvoC + (Math.random() < 0.5 ? -1 : 1))); }
      const xa = (rainha.alvoC + 0.5) * cw; rainha.x += Math.sign(xa - rainha.x) * Math.min(Math.abs(xa - rainha.x), cw * 1.4 * dt); rainha.c = Math.round(rainha.x / cw - 0.5);
      if (rainha.cria <= 0 && S.inimigos.length < 14) {
        rainha.cria = rainha.escudo ? 6 : 4.5;
        for (const dc of [-1, 1]) { const c = rainha.c + dc; if (c < 0 || c >= COLS) continue; const d = INIMIGOS.aranha; S.inimigos.push({ tipo: "aranha", ...d, c, x: (c + 0.5) * cw, y: rainha.y, hp: d.hp, hpMax: d.hp, lento: 0, fase: Math.random() * 6 }); }
        S.efeitos.push({ tipo: "texto", txt: "Aranhas!", x: rainha.x, y: rainha.y + ch * 0.6, t: 0.9 });
      }
    }
    for (const e of S.inimigos) {
      const v = e.vel * (e.lento > 0 ? 0.5 : 1); e.lento = Math.max(0, e.lento - dt); e.fase = (e.fase || 0) + dt * 4;
      // fantasma: some por 1,2 s a cada 3,4 s (sumido, os tiros passam por ele)
      if (e.atravessa) e.sumido = (e.fase / 4) % 3.4 > 2.2;
      const linhaE = Math.floor((e.y + ch * 0.3) / ch);
      const bloqueio = !e.atravessa && S.unidades.find(u => u.hp > 0 && (e.tipo === "chefe" ? Math.abs((u.c + 0.5) * cw - e.x) < cw * 1.1 : u.c === e.c) && u.l === linhaE && u.papel !== "bomba");
      if (bloqueio && e.salta && !e.saltou) {
        // a aranha pula por cima do primeiro companheiro da faixa
        e.saltou = true; e.y = (bloqueio.l + 1) * ch + ch * 0.05; S.efeitos.push({ tipo: "texto", txt: "pulou!", x: e.x, y: e.y, t: 0.7 }); tocar("toque");
      } else if (bloqueio) { bloqueio.hp -= e.dano * dt; if (Math.random() < dt * 2) tocar("toque"); }
      else e.y += v * dt * (ch / 50);
      if (e.y > (LINHAS - 1) * ch) {
        e.hp = 0; e.chegou = true;
        if (e.tipo === "chefe") return perder(`${e.variante === "aranhaRainha" ? "Aracna" : "O Rei Gosma"} chegou aos cristais!`);
        let i = S.dentes[e.c] ? e.c : S.dentes.findIndex(d => d);
        if (i >= 0) { S.dentes[i] = false; tocar("errado"); vibrar([60, 40, 60]); S.efeitos.push({ tipo: "texto", txt: "Cristal rachado!", x: (i + 0.5) * cw, y: (LINHAS - 1.2) * ch, t: 1 }); }
        if (S.dentes.filter(d => !d).length >= 3) return perder("Três cristais rachados.");
      }
    }
    S.inimigos = S.inimigos.filter(e => e.hp > 0);
    if (S.chefe && S.chefe.hp <= 0) S.chefe = null;
    S.unidades = S.unidades.filter(u => u.hp > 0);
    for (const f of S.efeitos) f.t -= dt;
    S.efeitos = S.efeitos.filter(f => f.t > 0);
  }
  function ferir(e, d) {
    e.hp -= d;
    if (e.hp <= 0 && !e.morto) { e.morto = true; S.mortes++; S.pontos += e.pts; S.efeitos.push({ tipo: "pop", x: e.x, y: e.y, t: 0.35, cor: e.cor || "#E0434A" }); if (e.tipo === "chefe") { tocar("ofensiva"); S.efeitos.push({ tipo: "texto", txt: `${e.variante === "aranhaRainha" ? "Aracna" : "Rei Gosma"} derrotado${e.variante === "aranhaRainha" ? "a" : ""}!`, x: W / 2, y: H / 2, t: 2, grande: true }); } }
  }

  // ---------- desenho ----------
  function desenhar() {
    ctx.clearRect(0, 0, W, H);
    const escuro = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.tema !== "claro" || document.documentElement.dataset.tema === "escuro";
    // campo / faixas
    const cores = MAPA === MAPAS.cripta ? (escuro ? ["#221C38", "#1E1932"] : ["#E3DDF1", "#D8D0EC"]) : (escuro ? ["#1F3A2C", "#1B3326"] : ["#D6EFC9", "#E3F5D8"]);
    for (let c = 0; c < COLS; c++) { ctx.fillStyle = c % 2 ? cores[0] : cores[1]; ctx.fillRect(c * cw, 0, cw, H); }
    ctx.fillStyle = escuro ? "rgba(0,0,0,.25)" : MAPA === MAPAS.cripta ? "rgba(46,37,96,.14)" : "rgba(27,60,40,.12)"; ctx.fillRect(0, 0, W, ch * 2);
    ctx.fillStyle = escuro ? "#3B4466" : "#C9D3E3"; ctx.beginPath(); ctx.roundRect(0, (LINHAS - 1) * ch + ch * 0.35, W, ch * 0.65, [ch * 0.3, ch * 0.3, 0, 0]); ctx.fill();
    ctx.strokeStyle = escuro ? "rgba(255,255,255,.06)" : "rgba(27,35,64,.05)";
    for (let l = 2; l < LINHAS - 1; l++) for (let c = 0; c < COLS; c++) { ctx.strokeRect(c * cw + 3, l * ch + 3, cw - 6, ch - 6); }
    // seleção
    if (S.sel) { ctx.fillStyle = "rgba(47,107,255,.10)"; ctx.fillRect(0, 2 * ch, W, (LINHAS - 3) * ch); }
    // dentes (base)
    S.dentes.forEach((ok, c) => { const s = Math.min(cw, ch) * 0.95; ctx.drawImage(ok ? imgDente : imgDenteTriste, (c + 0.5) * cw - s / 2, (LINHAS - 1) * ch + (ch - s) / 2, s, s); if (!ok) { ctx.fillStyle = "#7A4B26"; ctx.beginPath(); ctx.arc((c + 0.5) * cw + s * 0.12, (LINHAS - 1) * ch + ch * 0.38, s * 0.1, 0, 7); ctx.fill(); } });
    // unidades
    for (const u of S.unidades) {
      const s = Math.min(cw, ch) * 0.92, x = (u.c + 0.5) * cw - s / 2, y = (u.l + 0.5) * ch - s / 2;
      if (u.papel === "bomba") { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 20); }
      ctx.drawImage(u.img, x, y, s, s); ctx.globalAlpha = 1;
      if (u.hp < u.hpMax && u.papel !== "bomba") barra(x + 4, y - 3, s - 8, u.hp / u.hpMax, "#39D98A");
    }
    // tiros
    for (const t of S.tiros) { ctx.fillStyle = t.gelo ? "#BFE6FF" : t.forte ? "#FFC24B" : "#4FD1E8"; ctx.strokeStyle = "#1B2340"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(t.x, t.y, t.forte ? 6 : 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
    // inimigos
    for (const e of S.inimigos) desenharInimigo(e);
    // efeitos
    for (const f of S.efeitos) {
      if (f.tipo === "texto") { ctx.globalAlpha = Math.min(1, f.t * 2); ctx.font = `800 ${f.grande ? 22 : 15}px Bricolage, sans-serif`; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.strokeText(f.txt, f.x, f.y - (1 - f.t) * 14); ctx.fillStyle = "#1B2340"; ctx.fillText(f.txt, f.x, f.y - (1 - f.t) * 14); ctx.globalAlpha = 1; }
      if (f.tipo === "explosao") { ctx.fillStyle = `rgba(255,194,75,${f.t * 1.6})`; ctx.beginPath(); ctx.arc(f.x, f.y, cw * 1.6 * (1 - f.t), 0, 7); ctx.fill(); }
      if (f.tipo === "pop") { ctx.strokeStyle = f.cor; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 26 * (1 - f.t * 2), 0, 7); ctx.stroke(); }
      if (f.tipo === "brilho") { ctx.fillStyle = `rgba(255,224,138,${f.t})`; ctx.beginPath(); ctx.arc(f.x, f.y, 34, 0, 7); ctx.fill(); }
    }
  }
  function barra(x, y, w, p, cor) { ctx.fillStyle = "rgba(27,35,64,.35)"; ctx.fillRect(x, y, w, 4); ctx.fillStyle = cor; ctx.fillRect(x, y, w * Math.max(0, p), 4); }
  function desenharInimigo(e) {
    const r = Math.min(cw, ch) * e.r, x = e.x, y = e.y + Math.sin(e.fase) * 2;
    const im = e.tipo === "chefe" ? IMG[e.variante] : e.tipo === "carie" ? (Math.sin(e.fase * 2.5) > 0 ? IMG.morcego0 : IMG.morcego1) : e.tipo === "aranha" ? (Math.sin(e.fase * 3) > 0 ? IMG.aranha0 : IMG.aranha1) : IMG[e.tipo];
    const sq = 1 + 0.07 * Math.sin(e.fase * 1.5), lado = r * (e.tipo === "chefe" ? (e.variante === "aranhaRainha" ? 3 : 2.6) : 3.1);
    ctx.save();
    if (e.sumido) ctx.globalAlpha = 0.22;
    if (e.lento > 0) ctx.filter = "hue-rotate(150deg) saturate(.6) brightness(1.15)";
    ctx.drawImage(im, x - lado / 2 * sq, y - lado / 2 / sq - lado * 0.06, lado * sq, lado / sq);
    ctx.restore();
    if (e.tipo === "chefe") {
      if (e.escudo) { ctx.strokeStyle = "rgba(167,139,250,.95)"; ctx.lineWidth = 5; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(x, y, r * 1.45, S.t, S.t + 7); ctx.stroke(); ctx.setLineDash([]); }
      ctx.font = "800 12px Bricolage, sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "#fff";
      const rot = e.variante === "aranhaRainha" ? `Aracna · ${e.escudo ? `selos: ${e.selos}` : "sem selo"}` : `Rei Gosma · selo: ${e.nome}`;
      ctx.strokeText(rot, x, y - r * 1.55); ctx.fillStyle = "#6732C8"; ctx.fillText(rot, x, y - r * 1.55);
      barra(x - r, y + r * 1.3, r * 2, e.hp / e.hpMax, "#E0434A");
      return;
    }
    if (e.hp < e.hpMax) barra(x - r, y + r + 3, r * 2, e.hp / e.hpMax, "#E0434A");
  }
  function olhos(x, y, r, bravo) {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1B2340"; ctx.lineWidth = 1.5;
    for (const dx of [-0.32, 0.32]) { ctx.beginPath(); ctx.arc(x + dx * r, y, r * 0.22, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#1B2340"; ctx.beginPath(); ctx.arc(x + dx * r, y + r * 0.05, r * 0.1, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; }
    ctx.strokeStyle = "#1B2340"; ctx.lineWidth = bravo ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(x - r * 0.55, y - r * (bravo ? 0.45 : 0.35)); ctx.lineTo(x - r * 0.15, y - r * 0.28); ctx.moveTo(x + r * 0.55, y - r * (bravo ? 0.45 : 0.35)); ctx.lineTo(x + r * 0.15, y - r * 0.28); ctx.stroke();
  }

  // ---------- HUD e laço ----------
  function hud() {
    elEn.style.width = `${S.energia / 12 * 100}%`; elEnN.textContent = Math.floor(S.energia);
    elDentes.textContent = `${S.dentes.filter(Boolean).length}/5 cristais`;
    btP.disabled = S.cdPergunta > 0; btP.textContent = S.cdPergunta > 0 ? `Nova pergunta em ${Math.ceil(S.cdPergunta)}s` : "Pergunta relâmpago: +4 energia";
    elBar.querySelectorAll(".def-carta").forEach((el, i) => el.classList.toggle("caro", S.energia < baralho[i].custo));
  }
  let ult = performance.now();
  function laco(agora) {
    if (cam.saiu || S.fim) return;
    const dt = Math.min(0.05, (agora - ult) / 1000); ult = agora;
    if (!cam.pausado) atualizar(dt);
    desenhar(); hud();
    requestAnimationFrame(laco);
  }
  function placar() { return S.pontos + S.dentes.filter(Boolean).length * 50 + (S.onda - 1) * 100; }
  function vencer() {
    if (S.fim) return; S.fim = true; tocar("fim");
    const p = placar() + 300;
    terminar(cam, "defesa", p, { xp: Math.min(30, Math.round(p / 40)), moedas: Math.min(15, Math.round(p / 80)) }, `<p class="sub">Reino salvo! ${S.mortes} monstros derrotados e ${S.dentes.filter(Boolean).length} cristais intactos.</p>`);
  }
  function perder(motivo) {
    if (S.fim) return; S.fim = true; tocar("errado");
    const p = placar();
    terminar(cam, "defesa", p, { xp: Math.min(20, Math.round(p / 50)), moedas: Math.min(10, Math.round(p / 100)) }, `<p class="sub">${escapar(motivo)} Você chegou à onda ${S.onda} com ${S.mortes} monstros derrotados.</p>`);
  }
  if (window.__testeAventuras) window.__defesa = { S, criar }; // teste de fumaça
  // instruções rápidas e a escolha do mapa
  cam.pausado = true;
  const intro = document.createElement("div"); intro.className = "pergunta-rapida";
  const ultMapa = escolhaJogo("defesa") || "vale";
  intro.innerHTML = `<div class="pr-caixa"><h2>Defesa do Sorriso</h2>${faixaProva(fp)}
    <div class="av-mapas">${Object.entries(MAPAS).map(([id, m]) => `<button class="av-mapa ${id === ultMapa ? "ultima" : ""}" data-mapa="${id}"><img alt="" src="${IMG[m.chefe].src}"><b>${m.nome}</b><small>${m.desc}</small></button>`).join("")}</div>
    <ul class="lista-intro">
    <li>Toque numa carta e depois numa casa para posicionar o companheiro. O nível da carta deixa ele mais forte.</li>
    <li>A energia sobe sozinha, com os geradores e com as <b>perguntas relâmpago</b> (+4).</li>
    <li>Os monstros descem pelas faixas. Se 3 cristais rachar, o reino cai. Aguente ${ONDAS} ondas.</li>
    <li>O chefe final tem um selo mágico: acerte as perguntas para quebrá-lo.</li></ul>
    <div class="def-legenda">${baralho.map(b => `<span>${b.nome} (${b.custo}): ${b.desc}</span>`).join("")}</div></div>`;
  intro.querySelectorAll(".av-mapa").forEach(bt => (bt.onclick = () => {
    MAPA = MAPAS[bt.dataset.mapa]; escolhaJogo("defesa", bt.dataset.mapa); tocar("toque");
    cam.raiz.dataset.mapa = bt.dataset.mapa;
    intro.remove(); cam.pausado = false; ult = performance.now();
  }));
  cam.raiz.append(intro);
  requestAnimationFrame(laco);
}
