// Masmorra do Siso: ação com joystick, ataque e esquiva. Salas com goblins, golens e
// cogumelos que cospem esporos; fogueira onde se descansa respondendo questões; e o chefe,
// Sisorath, o Dragão do Siso, com investida, onda de choque e colunas de fogo. Quebrar a postura do chefe
// abre um golpe crítico, que só acerta se você responder certo.
// Segundo caminho (04/11/2026, pedido do Alediov: mais variedade): a Cripta do Lich, com esqueletos arqueiros que
// atiram ossos de longe, fantasmas que somem e reaparecem perto de você (sumidos, não levam nem dão dano) e aranhas que
// dão o bote; o chefe é Tártaron, o Lich do Tártaro: anel de magia com uma brecha, rajada de raios, teleporte e
// invocação de esqueletos. As perguntas (fogueira e golpe crítico) vêm de preferência da PRÓXIMA prova.
import { abrirCamada, terminar, perguntaRapida, perguntasDaProva, faixaProva, escolhaJogo } from "../jogos.js";
import { colecao, equipada, arteCompanheiro } from "../colecao.js";
import { CRIATURAS, imagem } from "../arte/fantasia.js";
import { tocar, vibrar } from "../sons.js";
import { escapar } from "../ui.js";
import { musicaCamada } from "../musica.js";
import { icone } from "../icones.js";

const ROTEIROS = {
  siso: { nome: "Covil de Sisorath", desc: "Goblins, golens e cogumelos. Chefe: Sisorath, o Dragão do Siso.", chefe: "dragao", salas: [
    { tipo: "sala", nome: "Corredor das Tochas", inimigos: ["carie", "carie", "carie"] },
    { tipo: "fogueira" },
    { tipo: "sala", nome: "Salão dos Goblins", inimigos: ["carie", "carie", "tartaro", "cuspidora"] },
    { tipo: "sala", nome: "Gruta dos Cogumelos", inimigos: ["cuspidora", "cuspidora", "carie", "carie", "tartaro"] },
    { tipo: "fogueira" },
    { tipo: "chefe", nome: "Covil de Sisorath" },
  ] },
  cripta: { nome: "Cripta do Lich", desc: "Esqueletos arqueiros, fantasmas e aranhas. Chefe: Tártaron, o Lich do Tártaro.", chefe: "lich", salas: [
    { tipo: "sala", nome: "Ossuário", inimigos: ["esqueleto", "carie", "carie", "esqueleto"] },
    { tipo: "fogueira" },
    { tipo: "sala", nome: "Corredor dos Lamentos", inimigos: ["fantasma", "fantasma", "esqueleto", "carie"] },
    { tipo: "sala", nome: "Ninho das Aranhas", inimigos: ["aranha", "aranha", "aranha", "fantasma", "tartaro"] },
    { tipo: "fogueira" },
    { tipo: "chefe", nome: "Trono do Lich" },
  ] },
};
const TIPOS = {
  carie: { hp: 40, vel: 72, r: 15, cor: "#C98A5B", escura: "#7A4B26", pts: 15 },
  tartaro: { hp: 110, vel: 42, r: 21, cor: "#E8D9A8", escura: "#9C8A55", pts: 25 },
  cuspidora: { hp: 50, vel: 55, r: 16, cor: "#7FD6A0", escura: "#3E9E66", pts: 20, atira: true },
  // Cripta
  esqueleto: { hp: 55, vel: 50, r: 16, cor: "#F4EFE1", escura: "#CFC6AE", pts: 22, arqueiro: true },
  fantasma: { hp: 45, vel: 62, r: 16, cor: "#D6D2F2", escura: "#8F88C9", pts: 22, fantasma: true },
  aranha: { hp: 36, vel: 54, r: 15, cor: "#7C6CF0", escura: "#3B2F73", pts: 18, salta: true },
};
const img = (svg) => { const i = new Image(); i.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.includes("xmlns=") ? svg : svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/var\(--[a-z-]+\)/g, "#2F6BFF")); return i; };

export async function jogarMasmorra() {
  const cam = abrirCamada("Masmorra do Siso", { musica: "masmorra" });
  const fp = await perguntasDaProva();
  if (cam.saiu) return;
  const pool = fp.pool;
  let rota = ROTEIROS[escolhaJogo("masmorra")] ? escolhaJogo("masmorra") : "siso", ROTEIRO = ROTEIROS[rota].salas;
  const nivel = colecao().cartas[equipada()]?.nivel || 1, forca = 1 + 0.08 * (nivel - 1);
  cam.corpo.innerHTML = `<div class="masmorra"><canvas></canvas>
    <div class="mm-botoes"><button class="mm-bt mm-cura" aria-label="Frasco">${icone("🧪", "ico3d")}<small></small></button><button class="mm-bt mm-esquiva" aria-label="Esquivar">↻</button><button class="mm-bt mm-ataque" aria-label="Atacar">⚔</button></div></div>`;
  cam.corpo.classList.add("sem-pad");
  const box = cam.corpo.querySelector(".masmorra"), cv = box.querySelector("canvas"), ctx = cv.getContext("2d");
  const W = cam.corpo.clientWidth, H = Math.max(420, window.innerHeight - 70), dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`; ctx.scale(dpr, dpr);
  const PAREDE = 18, TOPO_HUD = 44;
  const spriteJog = img(arteCompanheiro({ humor: "feliz" })), spriteChefe = imagem(CRIATURAS.dragao());
  const IMG = { carie: imagem(CRIATURAS.goblin()), tartaro: imagem(CRIATURAS.golem()), cuspidora: imagem(CRIATURAS.cogumelo()),
    esqueleto: imagem(CRIATURAS.esqueleto()), fantasma: imagem(CRIATURAS.fantasma()), aranha0: imagem(CRIATURAS.aranha(0)), aranha1: imagem(CRIATURAS.aranha(1)), lich: imagem(CRIATURAS.lich()), dragao: spriteChefe };

  const J = { x: W / 2, y: H - 90, r: 20, hp: 6, hpMax: 6, est: 100, frascos: 2, dir: { x: 0, y: -1 }, ataque: 0, rolando: 0, invul: 0, bebendo: 0, semEst: 0, hit: 0 };
  const S = { etapa: -1, inimigos: [], tiros: [], efeitos: [], porta: false, chefe: null, mortes: 0, pontos: 0, fim: false, t: 0, salas: 0, danoChefe: 0 };
  const joy = { ativo: false, ox: 0, oy: 0, x: 0, y: 0, id: null };
  const teclas = {};

  // ---------- etapas ----------
  function proxima() {
    S.etapa++;
    const e = ROTEIRO[S.etapa];
    if (!e) return;
    if (e.tipo === "fogueira") return fogueira();
    J.x = W / 2; J.y = H - 90; S.tiros = []; S.porta = false;
    if (e.tipo === "sala") {
      S.inimigos = e.inimigos.map((t, i) => novoInimigo(t, 60 + (i * 97) % (W - 120), TOPO_HUD + 70 + (i % 2) * 70));
    } else {
      musicaCamada("chefe");
      S.chefe = ROTEIROS[rota].chefe === "lich"
        ? { tipo: "lich", nome: "Tártaron, o Lich do Tártaro", x: W / 2, y: TOPO_HUD + 100, r: 40, hp: 700, hpMax: 700, postura: 0, atordoado: 0, estado: "andar", t: 1.6, flash: 0, fase2: false, giro: 0, alfa: 1 }
        : { tipo: "dragao", nome: "Sisorath, o Dragão do Siso", x: W / 2, y: TOPO_HUD + 110, r: 46, hp: 750, hpMax: 750, postura: 0, atordoado: 0, estado: "andar", t: 1.5, alvo: null, flash: 0, fase2: false };
      S.inimigos = [];
      tocar("ofensiva");
    }
    aviso(e.nome || "", 1.8);
  }
  function novoInimigo(t, x, y) { return { tipo: t, ...TIPOS[t], hpMax: TIPOS[t].hp, x, y, cd: 1 + Math.random(), kb: { x: 0, y: 0 }, flash: 0, ciclo: Math.random() * 1.5, cdSalto: 1.5 + Math.random() }; }
  function aviso(txt, t = 1.4) { S.efeitos.push({ tipo: "titulo", txt, t, t0: t }); }
  async function fogueira() {
    cam.pausado = true;
    const ov = document.createElement("div"); ov.className = "pergunta-rapida fogueira";
    let respostas = 0;
    const desenhar = () => {
      ov.innerHTML = `<div class="pr-caixa"><div class="fogo">${icone("🔥", "ico3d")}</div><h2>Fogueira</h2><p>Descanse respondendo até 3 perguntas. Cada acerto devolve 2 corações e 1 poção de cura (máximo 3).</p><p class="sub">Vida ${J.hp}/${J.hpMax} · frascos ${J.frascos}/3 · respostas ${respostas}/3</p></div>`;
      const cx = ov.querySelector(".pr-caixa");
      if (respostas < 3) { const b = document.createElement("button"); b.className = "botao"; b.textContent = "Responder uma pergunta"; b.onclick = async () => { ov.hidden = true; const ok = await perguntaRapida(cam, "Fogueira: acerte para recuperar", pool); ov.hidden = false; respostas++; if (ok) { J.hp = Math.min(J.hpMax, J.hp + 2); J.frascos = Math.min(3, J.frascos + 1); tocar("moeda"); } desenhar(); }; cx.append(b); }
      const s = document.createElement("button"); s.className = "botao secundario"; s.textContent = "Seguir em frente"; s.onclick = () => { ov.remove(); cam.pausado = false; ultimo = performance.now(); proxima(); }; cx.append(s);
    };
    desenhar(); cam.raiz.append(ov);
  }

  // ---------- controles ----------
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener("pointerdown", (e) => { const p = pos(e); if (p.x < W * 0.6) { joy.ativo = true; joy.id = e.pointerId; joy.ox = p.x; joy.oy = p.y; joy.x = 0; joy.y = 0; cv.setPointerCapture(e.pointerId); } });
  cv.addEventListener("pointermove", (e) => { if (!joy.ativo || e.pointerId !== joy.id) return; const p = pos(e); let dx = p.x - joy.ox, dy = p.y - joy.oy; const d = Math.hypot(dx, dy), m = 46; if (d > m) { dx = dx / d * m; dy = dy / d * m; } joy.x = dx / m; joy.y = dy / m; });
  const soltar = (e) => { if (e.pointerId === joy.id) { joy.ativo = false; joy.x = joy.y = 0; } };
  cv.addEventListener("pointerup", soltar); cv.addEventListener("pointercancel", soltar);
  const btA = box.querySelector(".mm-ataque"), btE = box.querySelector(".mm-esquiva"), btC = box.querySelector(".mm-cura");
  btA.addEventListener("pointerdown", (e) => { e.preventDefault(); atacar(); });
  btE.addEventListener("pointerdown", (e) => { e.preventDefault(); esquivar(); });
  btC.addEventListener("pointerdown", (e) => { e.preventDefault(); beber(); });
  const kd = (e) => { if (!document.body.contains(cam.raiz)) return document.removeEventListener("keydown", kd); teclas[e.key.toLowerCase()] = true; if (e.key === "j") atacar(); if (e.key === "k") esquivar(); if (e.key === "l") beber(); };
  const ku = (e) => { teclas[e.key.toLowerCase()] = false; };
  document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);

  function atacar() { if (S.fim || cam.pausado || J.ataque > 0 || J.rolando > 0 || J.bebendo > 0 || J.est < 18) return; J.est -= 18; J.semEst = 0.6; J.ataque = 0.26; J.acertados = new Set(); tocar("toque"); }
  function esquivar() { if (S.fim || cam.pausado || J.rolando > 0 || J.bebendo > 0 || J.est < 26) return; J.est -= 26; J.semEst = 0.7; J.rolando = 0.34; J.invul = 0.38; const d = Math.hypot(joy.x, joy.y) > 0.2 ? { x: joy.x, y: joy.y } : J.dir; const n = Math.hypot(d.x, d.y) || 1; J.rolDir = { x: d.x / n, y: d.y / n }; tocar("par"); }
  function beber() { if (S.fim || cam.pausado || J.frascos <= 0 || J.bebendo > 0 || J.hp >= J.hpMax) return; J.frascos--; J.bebendo = 0.8; tocar("combo"); }

  // ---------- simulação ----------
  function ferirJogador(n, de) {
    if (J.invul > 0 || S.fim) return;
    J.hp -= n; J.invul = 0.9; J.hit = 0.25; J.bebendo = 0; vibrar(60); tocar("errado");
    if (de) { const dx = J.x - de.x, dy = J.y - de.y, d = Math.hypot(dx, dy) || 1; J.kb = { x: dx / d * 260, y: dy / d * 260 }; }
    if (J.hp <= 0) morrer();
  }
  function limitar(o) { o.x = Math.max(PAREDE + o.r, Math.min(W - PAREDE - o.r, o.x)); o.y = Math.max(TOPO_HUD + PAREDE + o.r, Math.min(H - PAREDE - o.r, o.y)); }
  function atualizar(dt) {
    S.t += dt;
    // jogador
    let mx = joy.x, my = joy.y;
    if (teclas.a || teclas.arrowleft) mx = -1; if (teclas.d || teclas.arrowright) mx = 1; if (teclas.w || teclas.arrowup) my = -1; if (teclas.s || teclas.arrowdown) my = 1;
    const m = Math.hypot(mx, my);
    if (m > 0.15) J.dir = { x: mx / m, y: my / m };
    if (J.rolando > 0) { J.rolando -= dt; J.x += J.rolDir.x * 420 * dt; J.y += J.rolDir.y * 420 * dt; }
    else { const v = J.bebendo > 0 ? 50 : J.ataque > 0 ? 70 : 155; J.x += mx * v * dt * (m > 1 ? 1 / m : 1); J.y += my * v * dt * (m > 1 ? 1 / m : 1); }
    if (J.kb) { J.x += J.kb.x * dt; J.y += J.kb.y * dt; J.kb.x *= 0.85; J.kb.y *= 0.85; if (Math.hypot(J.kb.x, J.kb.y) < 5) J.kb = null; }
    limitar(J);
    J.invul = Math.max(0, J.invul - dt); J.hit = Math.max(0, J.hit - dt); J.semEst -= dt;
    if (J.semEst <= 0) J.est = Math.min(100, J.est + 38 * dt);
    if (J.bebendo > 0) { J.bebendo -= dt; if (J.bebendo <= 0) { J.hp = Math.min(J.hpMax, J.hp + 3); S.efeitos.push({ tipo: "txt", txt: "+3 ♥", x: J.x, y: J.y - 30, t: 0.9 }); } }
    if (J.ataque > 0) {
      J.ataque -= dt;
      const alcance = 52, alvos = [...S.inimigos, ...(S.chefe ? [S.chefe] : [])];
      for (const e of alvos) {
        if (J.acertados.has(e) || e.sumido || (e.alfa ?? 1) < 0.5) continue;
        const dx = e.x - J.x, dy = e.y - J.y, d = Math.hypot(dx, dy);
        if (d < alcance + e.r && (d < J.r + e.r || (dx * J.dir.x + dy * J.dir.y) / (d || 1) > 0.15)) {
          J.acertados.add(e);
          const dano = 25 * forca;
          e.hp -= dano; e.flash = 0.12; tocar("certo");
          if (e === S.chefe) { S.danoChefe += dano; if (!e.atordoado) e.postura = Math.min(100, e.postura + 16); }
          else { e.kb = { x: dx / (d || 1) * 220, y: dy / (d || 1) * 220 }; }
        }
      }
    }
    // inimigos
    for (const e of S.inimigos) {
      const dx = J.x - e.x, dy = J.y - e.y, d = Math.hypot(dx, dy) || 1;
      let vx = dx / d, vy = dy / d, vel = e.vel;
      if (e.atira && d < 150) { vx = -vx; vy = -vy; }
      if (e.arqueiro) { if (d < 150) { vx = -vx; vy = -vy; } else if (d < 220) { const px = -vy, py = vx; vx = px * (e.lado ??= Math.random() < 0.5 ? 1 : -1); vy = py * e.lado; vel *= 0.6; } }
      if (e.fantasma) {
        // visível 2,2 s, sumido 1 s; ao voltar, aparece a uns 90 px de você
        const antes = e.sumido; e.ciclo += dt; e.sumido = e.ciclo % 3.2 > 2.2;
        if (antes && !e.sumido) { const a = Math.random() * 6.28; e.x = J.x + Math.cos(a) * 90; e.y = J.y + Math.sin(a) * 90; limitar(e); e.flash = 0.15; }
        if (e.sumido) vel = 0;
      }
      if (e.salta) {
        // o bote: mira 0,45 s e salta a 330 px/s por 0,35 s
        if (e.bote > 0) { e.bote -= dt; vx = e.bx; vy = e.by; vel = 330; }
        else if (e.mira > 0) { e.mira -= dt; vel = 0; if (e.mira <= 0) { e.bote = 0.35; e.bx = dx / d; e.by = dy / d; } }
        else { e.cdSalto -= dt; if (e.cdSalto <= 0 && d < 230) { e.cdSalto = 2.4 + Math.random(); e.mira = 0.45; } }
      }
      e.x += vx * vel * dt + (e.kb?.x || 0) * dt; e.y += vy * vel * dt + (e.kb?.y || 0) * dt;
      if (e.kb) { e.kb.x *= 0.82; e.kb.y *= 0.82; }
      limitar(e); e.flash = Math.max(0, (e.flash || 0) - dt);
      if (d < e.r + J.r - 4 && !e.sumido) ferirJogador(1, e);
      if (e.atira) { e.cd -= dt; if (e.cd <= 0) { e.cd = 2.2; S.tiros.push({ x: e.x, y: e.y, vx: dx / d * 150, vy: dy / d * 150, r: 7, t: 3 }); } }
      if (e.arqueiro) { e.cd -= dt; if (e.cd <= 0) { e.cd = 2.5; S.tiros.push({ x: e.x, y: e.y, vx: dx / d * 220, vy: dy / d * 220, r: 6, t: 3, osso: true }); } }
      if (e.hp <= 0 && !e.morto) { e.morto = true; S.mortes++; S.pontos += e.pts; S.efeitos.push({ tipo: "pop", x: e.x, y: e.y, t: 0.35, cor: e.cor }); }
    }
    S.inimigos = S.inimigos.filter(e => !e.morto);
    // separação: inimigos não se empilham nem entram no herói
    for (let i = 0; i < S.inimigos.length; i++) {
      const a = S.inimigos[i];
      for (let k = i + 1; k < S.inimigos.length; k++) {
        const b = S.inimigos[k], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
        if (d < min) { const p = (min - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
      }
      const dx = a.x - J.x, dy = a.y - J.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + J.r - 6;
      if (d < min) { a.x += dx / d * (min - d); a.y += dy / d * (min - d); }
    }
    // tiros e perigos
    for (const p of S.tiros) {
      p.t -= dt;
      if (p.tipo === "raiz") { p.espera -= dt; if (p.espera <= 0 && !p.feito) { p.feito = true; p.ativo = 0.35; vibrar(20); } if (p.ativo > 0) { p.ativo -= dt; if (Math.hypot(J.x - p.x, J.y - p.y) < p.r + J.r - 6) ferirJogador(1, p); } continue; }
      if (p.tipo === "onda") { p.raio += 190 * dt; const d = Math.hypot(J.x - p.x, J.y - p.y); if (Math.abs(d - p.raio) < 12) ferirJogador(1, p); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.hypot(J.x - p.x, J.y - p.y) < p.r + J.r - 4) { ferirJogador(1, p); p.t = 0; }
    }
    S.tiros = S.tiros.filter(p => p.t > 0);
    // chefe
    if (S.chefe) atualizarChefe(dt);
    // sala vencida
    const e = ROTEIRO[S.etapa];
    if (e?.tipo === "sala" && !S.inimigos.length && !S.porta) { S.porta = true; S.salas++; S.pontos += 100; tocar("moeda"); aviso("Sala limpa! Siga pela porta", 1.6); }
    if (S.porta && J.y < TOPO_HUD + PAREDE + J.r + 6 && Math.abs(J.x - W / 2) < 40) proxima();
    for (const f of S.efeitos) f.t -= dt;
    S.efeitos = S.efeitos.filter(f => f.t > 0);
  }
  function atualizarChefe(dt) {
    const c = S.chefe;
    c.flash = Math.max(0, c.flash - dt);
    if (c.hp <= 0) return vencer();
    if (c.tipo === "lich") return atualizarLich(c, dt);
    if (!c.fase2 && c.hp < c.hpMax / 2) { c.fase2 = true; aviso("Sisorath se enfureceu!", 1.4); for (let i = 0; i < 2; i++) S.inimigos.push({ tipo: "carie", ...TIPOS.carie, hpMax: 40, x: 60 + i * (W - 120), y: TOPO_HUD + 60, cd: 1, flash: 0 }); }
    if (c.atordoado > 0) { c.atordoado -= dt; if (c.atordoado <= 0) c.postura = 0; return; }
    if (c.postura >= 100 && !c.pedindo) { c.atordoado = 2.5; golpeCritico(); return; }
    const vel = c.fase2 ? 1.3 : 1;
    c.t -= dt * vel;
    const dx = J.x - c.x, dy = J.y - c.y, d = Math.hypot(dx, dy) || 1;
    if (c.estado === "andar") {
      c.x += dx / d * 38 * vel * dt; c.y += dy / d * 38 * vel * dt;
      if (c.t <= 0) { const r = Math.random(); c.estado = r < 0.4 ? "mira" : r < 0.7 ? "pisao" : "raizes"; c.t = c.estado === "mira" ? 0.75 : 0.6; c.alvo = { x: J.x, y: J.y }; }
    } else if (c.estado === "mira") {
      if (c.t <= 0) { c.estado = "investida"; c.t = 0.55; const n = Math.hypot(c.alvo.x - c.x, c.alvo.y - c.y) || 1; c.vx = (c.alvo.x - c.x) / n * 420; c.vy = (c.alvo.y - c.y) / n * 420; vibrar(30); }
    } else if (c.estado === "investida") {
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.t <= 0) { c.estado = "andar"; c.t = 1.3 + Math.random(); }
    } else if (c.estado === "pisao") {
      if (c.t <= 0) { S.tiros.push({ tipo: "onda", x: c.x, y: c.y, raio: c.r, t: 1.6 }); tocar("bau"); vibrar(40); c.estado = "andar"; c.t = 1.6; }
    } else if (c.estado === "raizes") {
      if (c.t <= 0) {
        for (let k = 0; k < (c.fase2 ? 5 : 3); k++) S.tiros.push({ tipo: "raiz", x: J.x + (Math.random() - 0.5) * 120, y: J.y + (Math.random() - 0.5) * 120, r: 24, espera: 0.8 + k * 0.12, t: 1.6 });
        c.estado = "andar"; c.t = 1.8;
      }
    }
    limitar(c);
    if (d < c.r + J.r - 8) ferirJogador(c.estado === "investida" ? 2 : 1, c);
  }
  // Tártaron, o Lich do Tártaro: mantém distância e alterna anel de magia (com uma brecha que gira), rajada de raios,
  // teleporte e invocação; na fase 2 (metade da vida) o anel fica mais cheio e a invocação traz um fantasma.
  function atualizarLich(c, dt) {
    if (!c.fase2 && c.hp < c.hpMax / 2) { c.fase2 = true; aviso("O Lich despertou a cripta!", 1.4); }
    if (c.atordoado > 0) { c.atordoado -= dt; c.alfa = 1; if (c.atordoado <= 0) c.postura = 0; return; }
    if (c.postura >= 100 && !c.pedindo) { c.atordoado = 2.5; golpeCritico(); return; }
    const vel = c.fase2 ? 1.25 : 1;
    c.t -= dt * vel; c.giro += dt;
    const dx = J.x - c.x, dy = J.y - c.y, d = Math.hypot(dx, dy) || 1;
    if (c.estado === "andar") {
      const sentido = d < 160 ? -1 : d > 240 ? 1 : 0;
      c.x += (dx / d * sentido * 46 + Math.cos(c.giro * 1.3) * 30) * vel * dt; c.y += (dy / d * sentido * 46 + Math.sin(c.giro) * 18) * vel * dt;
      if (c.t <= 0) { const r = Math.random(); c.estado = r < 0.32 ? "anel" : r < 0.6 ? "raio" : r < 0.8 ? "teleporte" : "invocar"; c.t = c.estado === "anel" ? 0.8 : c.estado === "teleporte" ? 0.5 : 0.7; c.rajada = 3; }
    } else if (c.estado === "anel") {
      if (c.t <= 0) {
        const n = c.fase2 ? 16 : 12, brecha = Math.random() * 6.28;
        for (let k = 0; k < n; k++) { const a = brecha + (k + 1.5) * (6.28 / (n + 3)); S.tiros.push({ x: c.x, y: c.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 7, t: 3.5, magia: true }); }
        tocar("bau"); vibrar(25); c.estado = "andar"; c.t = 1.5;
      }
    } else if (c.estado === "raio") {
      if (c.t <= 0) {
        S.tiros.push({ x: c.x, y: c.y, vx: dx / d * 260, vy: dy / d * 260, r: 6, t: 2.5, magia: true }); tocar("toque");
        c.rajada--; c.t = c.rajada > 0 ? 0.28 : 1.3; if (c.rajada <= 0) c.estado = "andar";
      }
    } else if (c.estado === "teleporte") {
      c.alfa = Math.max(0.15, c.t / 0.5);
      if (c.t <= 0) {
        for (let k = 0; k < 12; k++) { const x = PAREDE + c.r + Math.random() * (W - 2 * (PAREDE + c.r)), y = TOPO_HUD + PAREDE + c.r + Math.random() * (H - TOPO_HUD - 2 * (PAREDE + c.r)); if (Math.hypot(x - J.x, y - J.y) > 170) { c.x = x; c.y = y; break; } }
        c.alfa = 1; c.estado = "andar"; c.t = 1.2; S.efeitos.push({ tipo: "pop", x: c.x, y: c.y, t: 0.35, cor: "#7FF5C8" });
      }
    } else if (c.estado === "invocar") {
      if (c.t <= 0) {
        if (S.inimigos.length < 4) for (const t of c.fase2 ? ["esqueleto", "fantasma"] : ["esqueleto", "esqueleto"]) S.inimigos.push(novoInimigo(t, Math.max(60, Math.min(W - 60, c.x + (Math.random() - 0.5) * 160)), Math.max(TOPO_HUD + 60, c.y + 50)));
        aviso("Levantem-se!", 0.9); c.estado = "andar"; c.t = 1.6;
      }
    }
    limitar(c);
    if (d < c.r + J.r - 8 && c.alfa > 0.5) ferirJogador(1, c);
  }
  async function golpeCritico() {
    const c = S.chefe; c.pedindo = true; cam.pausado = true;
    aviso("Postura quebrada!", 1);
    const ok = await perguntaRapida(cam, "Golpe crítico: acerte para causar dano pesado", pool);
    cam.pausado = false; c.pedindo = false; ultimo = performance.now();
    if (ok) { const d = 200 * forca; c.hp -= d; S.danoChefe += d; c.flash = 0.3; tocar("combo"); vibrar([40, 30, 80]); S.efeitos.push({ tipo: "txt", txt: `Crítico! −${Math.round(d)}`, x: c.x, y: c.y - 60, t: 1.2 }); }
    else S.efeitos.push({ tipo: "txt", txt: `${c.nome.split(",")[0]} se recuperou`, x: c.x, y: c.y - 60, t: 1.2 });
    c.atordoado = 0.6; c.postura = 0;
  }

  // ---------- desenho ----------
  function desenhar() {
    // chão de pedra
    const cripta = rota === "cripta", piso = cripta ? ["#1C2A30", "#22333A", "#1F2F36"] : ["#231B3A", "#2C2348", "#281F42"];
    ctx.fillStyle = piso[0]; ctx.fillRect(0, 0, W, H);
    const ts = 40;
    for (let y = TOPO_HUD; y < H; y += ts) for (let x = 0; x < W; x += ts) { ctx.fillStyle = ((x / ts + y / ts) | 0) % 2 ? piso[1] : piso[2]; ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2); }
    // paredes
    ctx.fillStyle = "#15102A"; ctx.fillRect(0, TOPO_HUD, W, PAREDE); ctx.fillRect(0, H - PAREDE, W, PAREDE); ctx.fillRect(0, TOPO_HUD, PAREDE, H); ctx.fillRect(W - PAREDE, TOPO_HUD, PAREDE, H);
    // tochas
    for (const x of [PAREDE + 24, W - PAREDE - 24]) { const f = 0.8 + 0.2 * Math.sin(S.t * 13 + x); ctx.fillStyle = cripta ? `rgba(127,245,200,${0.16 * f})` : `rgba(255,170,60,${0.18 * f})`; ctx.beginPath(); ctx.arc(x, TOPO_HUD + 34, 46 * f, 0, 7); ctx.fill(); ctx.fillStyle = cripta ? "#7FF5C8" : "#FFC24B"; ctx.beginPath(); ctx.ellipse(x, TOPO_HUD + 30, 5, 9 * f, 0, 0, 7); ctx.fill(); }
    // porta
    if (S.porta) { ctx.fillStyle = `rgba(127,214,245,${0.6 + 0.3 * Math.sin(S.t * 5)})`; ctx.fillRect(W / 2 - 36, TOPO_HUD, 72, PAREDE + 6); ctx.fillStyle = "#fff"; ctx.font = "800 12px Bricolage, sans-serif"; ctx.textAlign = "center"; ctx.fillText("▲ siga", W / 2, TOPO_HUD + PAREDE + 22); }
    // perigos
    for (const p of S.tiros) {
      if (p.tipo === "raiz") { if (!p.feito) { ctx.strokeStyle = "rgba(224,67,74,.8)"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); ctx.setLineDash([]); } else if (p.ativo > 0) { const f = 1 + 0.15 * Math.sin(S.t * 30); ctx.fillStyle = "#FF7A1A"; ctx.strokeStyle = "#1B2340"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x - 16, p.y + 10); ctx.quadraticCurveTo(p.x - 14, p.y - 18 * f, p.x, p.y - 34 * f); ctx.quadraticCurveTo(p.x + 14, p.y - 18 * f, p.x + 16, p.y + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#FFC24B"; ctx.beginPath(); ctx.moveTo(p.x - 8, p.y + 8); ctx.quadraticCurveTo(p.x, p.y - 20 * f, p.x + 8, p.y + 8); ctx.closePath(); ctx.fill(); } continue; }
      if (p.tipo === "onda") { ctx.strokeStyle = `rgba(255,194,75,${Math.min(1, p.t)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(p.x, p.y, p.raio, 0, 7); ctx.stroke(); continue; }
      ctx.fillStyle = p.magia ? "#7FF5C8" : p.osso ? "#F4EFE1" : "#F7A8C8"; ctx.strokeStyle = "#1B2340"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, 2, 0, 7); ctx.fill();
    }
    // inimigos
    for (const e of S.inimigos) desenharInimigo(e);
    // chefe
    if (S.chefe) {
      const c = S.chefe, s = c.r * (c.tipo === "lich" ? 3.2 : 3);
      if (c.tipo === "lich" && c.estado === "anel") { ctx.strokeStyle = `rgba(127,245,200,${0.4 + 0.4 * Math.sin(S.t * 24)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 14 + 10 * (1 - c.t / 0.8), 0, 7); ctx.stroke(); }
      if (c.tipo === "lich" && c.estado === "invocar") { ctx.fillStyle = "rgba(127,245,200,.18)"; ctx.beginPath(); ctx.arc(c.x, c.y + 50, 60, 0, 7); ctx.fill(); }
      if (c.estado === "mira") { ctx.strokeStyle = "rgba(224,67,74,.7)"; ctx.lineWidth = 6; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.alvo.x, c.alvo.y); ctx.stroke(); ctx.setLineDash([]); }
      if (c.estado === "pisao") { ctx.fillStyle = "rgba(255,194,75,.25)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 20 * (1 - c.t / 0.6), 0, 7); ctx.fill(); }
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(c.x, c.y + c.r * 0.9, c.r, c.r * 0.3, 0, 0, 7); ctx.fill();
      ctx.save(); if (c.flash > 0) ctx.filter = "brightness(2.2)"; ctx.globalAlpha = c.atordoado > 0 ? 0.7 + 0.3 * Math.sin(S.t * 20) : (c.alfa ?? 1);
      ctx.drawImage(IMG[c.tipo], c.x - s / 2, c.y - s / 2 - 6 + (c.tipo === "lich" ? Math.sin(S.t * 2.4) * 4 : 0), s, s); ctx.restore();
      if (c.atordoado > 0) { ctx.fillStyle = "#FFE08A"; ctx.font = "800 18px Bricolage, sans-serif"; ctx.textAlign = "center"; ctx.fillText("✦ ✦ ✦", c.x, c.y - c.r - 18); }
    }
    // jogador
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(J.x, J.y + J.r * 0.9, J.r * 0.9, J.r * 0.3, 0, 0, 7); ctx.fill();
    if (J.ataque > 0) { const a = Math.atan2(J.dir.y, J.dir.x), p = 1 - J.ataque / 0.26; ctx.strokeStyle = `rgba(255,255,255,${0.9 - p * 0.6})`; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(J.x, J.y, 44, a - 1.1 + p * 0.4, a + 1.1 + p * 0.4); ctx.stroke(); ctx.lineCap = "butt"; }
    ctx.save();
    if (J.rolando > 0) ctx.globalAlpha = 0.55; else if (J.invul > 0 && Math.floor(S.t * 20) % 2) ctx.globalAlpha = 0.5;
    if (J.hit > 0) ctx.filter = "sepia(1) saturate(6) hue-rotate(-30deg)";
    const s = J.r * 2.6; ctx.drawImage(spriteJog, J.x - s / 2, J.y - s / 2 - 4, s, s); ctx.restore();
    if (J.bebendo > 0) { ctx.fillStyle = "#7FD6F5"; ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🧪", J.x + 20, J.y - 24); }
    // joystick
    if (joy.ativo) { ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(joy.ox + joy.x * 46, joy.oy + joy.y * 46, 20, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.font = "600 12px Bricolage, sans-serif"; ctx.textAlign = "left"; ctx.fillText("arraste aqui para andar", 24, H - 96); }
    // efeitos
    for (const f of S.efeitos) {
      if (f.tipo === "pop") { ctx.strokeStyle = f.cor; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 26 * (1 - f.t * 2), 0, 7); ctx.stroke(); }
      if (f.tipo === "txt") { ctx.fillStyle = "#FFE08A"; ctx.font = "800 15px Bricolage, sans-serif"; ctx.textAlign = "center"; ctx.fillText(f.txt, f.x, f.y - (1 - f.t) * 20); }
      if (f.tipo === "titulo") { ctx.globalAlpha = Math.min(1, f.t * 2, (f.t0 - f.t) * 3 + 0.2); ctx.fillStyle = "#fff"; ctx.font = "800 22px Bricolage, sans-serif"; ctx.textAlign = "center"; ctx.fillText(f.txt, W / 2, H * 0.42); ctx.globalAlpha = 1; }
    }
    // HUD
    ctx.fillStyle = "#15102A"; ctx.fillRect(0, 0, W, TOPO_HUD);
    ctx.font = "18px sans-serif"; ctx.textAlign = "left";
    for (let i = 0; i < J.hpMax; i++) { ctx.fillStyle = i < J.hp ? "#E0434A" : "#4A4266"; ctx.fillText("♥", 10 + i * 18, 22); }
    ctx.fillStyle = "#4A4266"; ctx.fillRect(10, 30, 110, 6); ctx.fillStyle = "#39D98A"; ctx.fillRect(10, 30, 110 * J.est / 100, 6);
    if (S.chefe) { const c = S.chefe, x0 = 136, w = W - x0 - 12; ctx.fillStyle = "#fff"; ctx.font = "800 12px Bricolage, sans-serif"; ctx.fillText(c.nome, x0, 14); ctx.fillStyle = "#4A4266"; ctx.fillRect(x0, 19, w, 8); ctx.fillStyle = "#E0434A"; ctx.fillRect(x0, 19, w * Math.max(0, c.hp / c.hpMax), 8); ctx.fillStyle = "#FFC24B"; ctx.fillRect(x0, 30, w * c.postura / 100, 4); }
    else { const e = ROTEIRO[S.etapa]; ctx.fillStyle = "#B7C9FF"; ctx.font = "700 12px Bricolage, sans-serif"; ctx.textAlign = "right"; ctx.fillText(`${e?.nome || ""} · ${S.inimigos.length} restantes`, W - 12, 26); }
    btC.querySelector("small").textContent = J.frascos;
  }
  function desenharInimigo(e) {
    const t = S.t * 5 + e.x, sq = 1 + 0.07 * Math.sin(t), lado = e.r * 2.8;
    if (e.mira > 0) { ctx.strokeStyle = "rgba(224,67,74,.75)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); if (e.flash > 0) ctx.filter = "brightness(2.4)"; if (e.sumido) ctx.globalAlpha = 0.18;
    const im = e.tipo === "aranha" ? (Math.sin(t * 1.6) > 0 ? IMG.aranha0 : IMG.aranha1) : IMG[e.tipo];
    ctx.drawImage(im, e.x - lado / 2 * sq, e.y - lado / 2 / sq - 4, lado * sq, lado / sq);
    ctx.restore();
    if (e.hp < e.hpMax) { ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(e.x - e.r, e.y - e.r - 12, e.r * 2, 4); ctx.fillStyle = "#E0434A"; ctx.fillRect(e.x - e.r, e.y - e.r - 12, e.r * 2 * Math.max(0, e.hp / e.hpMax), 4); }
  }

  // ---------- fim ----------
  function placar(ganhou) { return S.pontos + S.mortes * 0 + Math.round(S.danoChefe / 3) + (ganhou ? 400 + J.hp * 20 : 0); }
  function vencer() {
    if (S.fim) return; S.fim = true; tocar("ofensiva");
    const p = placar(true);
    terminar(cam, "masmorra", p, { xp: Math.min(35, Math.round(p / 30)), moedas: Math.min(18, Math.round(p / 60)) }, `<p class="sub">${escapar(S.chefe?.nome.split(",")[0] || "O chefe")} foi derrotado! ${S.mortes} inimigos derrotados, ${J.hp} corações sobrando.</p>`);
  }
  function morrer() {
    if (S.fim) return; S.fim = true;
    S.efeitos.push({ tipo: "titulo", txt: "VOCÊ DESMAIOU", t: 2, t0: 2 }); desenhar();
    setTimeout(() => {
      const p = placar(false);
      terminar(cam, "masmorra", p, { xp: Math.min(20, Math.round(p / 40)), moedas: Math.min(10, Math.round(p / 80)) }, `<p class="sub">Você caiu em ${escapar(ROTEIRO[S.etapa]?.nome || "na masmorra")}. ${S.salas} sala(s) limpas e ${S.mortes} inimigos derrotados. Na próxima, use a esquiva (↻) para atravessar os ataques.</p>`);
    }, 1400);
  }

  let ultimo = performance.now();
  function laco(agora) {
    if (cam.saiu || !document.body.contains(cam.raiz)) return;
    const dt = Math.min(0.04, (agora - ultimo) / 1000); ultimo = agora;
    if (!cam.pausado && !S.fim) atualizar(dt);
    if (!S.fim || S.efeitos.length) desenhar();
    if (!S.fim) requestAnimationFrame(laco);
  }
  // atalho de teste: "#chefe" na URL pula para o chefe do caminho escolhido; window.__testeAventuras expõe o estado
  if (location.hash === "#chefe" || window.__testeAventuras) window.__masmorra = { S, J, proxima };
  // introdução e a escolha do caminho
  cam.pausado = true;
  const intro = document.createElement("div"); intro.className = "pergunta-rapida";
  intro.innerHTML = `<div class="pr-caixa"><h2>Masmorra do Siso</h2>${faixaProva(fp)}
    <div class="av-mapas">${Object.entries(ROTEIROS).map(([id, r]) => `<button class="av-mapa ${id === rota ? "ultima" : ""}" data-rota="${id}"><img alt="" src="${IMG[r.chefe].src}"><b>${r.nome}</b><small>${r.desc}</small></button>`).join("")}</div>
    <ul class="lista-intro">
    <li><b>Arraste</b> na metade esquerda para andar.</li>
    <li><b>⚔</b> ataca na direção em que você anda. <b>↻</b> esquiva: você fica intocável durante o rolamento. Os dois gastam a barra verde.</li>
    <li><b>${icone("🧪", "ico-inline")}</b> poção de cura: recupera 3 corações, mas você fica lento enquanto bebe.</li>
    <li>Na <b>fogueira</b>, cada acerto devolve vida e frascos. No chefe, quebre a postura (barra amarela) para tentar um golpe crítico.</li>
    <li>Seu companheiro equipado é o herói; o nível da carta aumenta o dano.</li></ul></div>`;
  intro.querySelectorAll(".av-mapa").forEach(bt => (bt.onclick = () => {
    rota = bt.dataset.rota; ROTEIRO = ROTEIROS[rota].salas; escolhaJogo("masmorra", rota); tocar("toque");
    cam.raiz.dataset.rota = rota;
    if (location.hash === "#chefe") S.etapa = ROTEIRO.length - 2;
    intro.remove(); cam.pausado = false; ultimo = performance.now(); proxima();
  }));
  cam.raiz.append(intro);
  requestAnimationFrame(laco);
}
