// Mira da Agulha (Malamed, caps. 13 e 14). Para cada técnica, 6 etapas:
// 1) ponto de punção no desenho; 2) direção da seringa; 3) profundidade (agulha curta ou longa);
// 4) volume de anestésico (tubete de 1,8 mL); 5) nervos anestesiados; 6) uma pergunta da técnica.
// No fim de cada técnica, a área anestesiada aparece colorida no desenho.
import { abrirCamada, terminar, semConteudo } from "../jogos.js";
import { extra } from "../dados.js";
import { embaralhar } from "../exercicios.js";
import { tocar, vibrar } from "../sons.js";
import { modal, escapar, confete } from "../ui.js";
import { E, salvar } from "../estado.js";

const T = "#1B2340";
const r1 = (n) => Math.round(n * 10) / 10;
const num = (n) => r1(n).toLocaleString("pt-BR");
const pt = (p) => `${r1(p[0])} ${r1(p[1])}`;
const curvaQ = (a) => `M${pt(a[0])} Q${pt(a[1])} ${pt(a[2])}`;

// ================= desenho: maxila em vista oclusal (palato), incisivos em cima =================
// Dentes do lado direito do paciente (esquerda de quem olha), da linha média para trás:
// [tipo, mesiodistal mm, vestíbulo-lingual mm]. O lado esquerdo é o espelho.
const DENTES = [["ic", 8.5, 7], ["il", 6.5, 6], ["c", 7.5, 8], ["pm", 7, 9], ["pm", 6.5, 9], ["m", 10, 11], ["m", 9, 11], ["m", 8.5, 10]];
const K = 3.05; // px por mm
function curvaMaxila() {
  const P = (u) => [150 - 82 * (1 - Math.exp(-u / 38)), 34 + u];
  const tab = [{ u: 0, s: 0, p: P(0) }];
  for (let u = 0.5; u <= 280; u += 0.5) { const p = P(u), a = tab[tab.length - 1]; tab.push({ u, s: a.s + Math.hypot(p[0] - a.p[0], p[1] - a.p[1]), p }); }
  const em = (s) => { const i = tab.findIndex(x => x.s >= s); const a = tab[Math.max(0, i - 1)], b = tab[Math.max(1, i)]; const tx = b.p[0] - a.p[0], ty = b.p[1] - a.p[1], n = Math.hypot(tx, ty) || 1; return { p: b.p, t: [tx / n, ty / n], nb: [-ty / n, tx / n] }; };
  return em;
}
function formaOclusal(tipo, W, H) { // eixo x: mesiodistal; y+: vestibular
  if (tipo === "ic" || tipo === "il") return { d: `M${-W / 2} ${H * 0.3} C${-W / 2} ${H * 0.52} ${W / 2} ${H * 0.52} ${W / 2} ${H * 0.3} L${W * 0.28} ${-H * 0.4} Q0 ${-H * 0.62} ${-W * 0.28} ${-H * 0.4} Z`, f: `M${-W * 0.4} ${H * 0.28} Q0 ${H * 0.36} ${W * 0.4} ${H * 0.28} M${-W * 0.12} ${-H * 0.32} Q0 ${-H * 0.2} ${W * 0.12} ${-H * 0.32}` };
  if (tipo === "c") return { d: `M${-W / 2} ${H * 0.12} Q${-W * 0.34} ${H * 0.52} 0 ${H * 0.52} Q${W * 0.34} ${H * 0.52} ${W / 2} ${H * 0.12} Q${W * 0.26} ${-H * 0.5} 0 ${-H * 0.52} Q${-W * 0.26} ${-H * 0.5} ${-W / 2} ${H * 0.12} Z`, f: `M${-W * 0.38} ${H * 0.1} L0 ${H * 0.2} L${W * 0.38} ${H * 0.1} M0 ${H * 0.2} L0 ${-H * 0.32}` };
  if (tipo === "pm") return { d: `M${-W / 2} 0 C${-W / 2} ${-H * 0.62} ${W / 2} ${-H * 0.62} ${W / 2} 0 C${W / 2} ${H * 0.62} ${-W / 2} ${H * 0.62} ${-W / 2} 0 Z`, f: `M${-W * 0.32} ${H * 0.02} C${-W * 0.1} ${-H * 0.08} ${W * 0.1} ${-H * 0.08} ${W * 0.32} ${H * 0.02}` };
  return { d: `M${-W / 2} ${-H * 0.28} Q${-W / 2} ${-H / 2} ${-W * 0.22} ${-H / 2} L${W * 0.36} ${-H * 0.46} Q${W / 2} ${-H * 0.42} ${W / 2} ${-H * 0.14} L${W * 0.47} ${H * 0.34} Q${W * 0.42} ${H / 2} ${W * 0.18} ${H / 2} L${-W * 0.34} ${H * 0.46} Q${-W / 2} ${H * 0.42} ${-W / 2} ${H * 0.18} Z`,
    f: `M${-W * 0.3} ${-H * 0.02} L${W * 0.3} ${H * 0.04} M${-W * 0.02} 0 L${W * 0.04} ${H * 0.42} M${W * 0.08} ${H * 0.02} L${W * 0.24} ${-H * 0.4} M${-W * 0.2} ${-H * 0.02} L${-W * 0.3} ${-H * 0.38}` };
}
function montarMaxila() {
  const em = curvaMaxila();
  let s = 0;
  const dentes = DENTES.map(([tipo, md, bl], i) => {
    const W = md * K, H = bl * K, c = em(s + W / 2), ini = s; s += W;
    return { i, tipo, W, H, c: c.p, t: c.t, n: c.nb, ini, fim: s, ang: Math.atan2(c.t[1], c.t[0]) * 180 / Math.PI };
  });
  const fora = (d, x) => [d.c[0] + d.n[0] * (d.H / 2 + x), d.c[1] + d.n[1] * (d.H / 2 + x)];
  const dentro = (d, x) => [d.c[0] - d.n[0] * (d.H / 2 + x), d.c[1] - d.n[1] * (d.H / 2 + x)];
  const noLimite = (sv, x, dLarg) => { const c = em(sv); return [c.p[0] - c.nb[0] * (dLarg / 2 + x), c.p[1] - c.nb[1] * (dLarg / 2 + x)]; };
  const noLimiteFora = (sv, x, dLarg) => { const c = em(sv); return [c.p[0] + c.nb[0] * (dLarg / 2 + x), c.p[1] + c.nb[1] * (dLarg / 2 + x)]; };
  const ult = dentes[7];
  const papila = [150, dentes[0].c[1] + dentes[0].H / 2 + 12];
  const gAmsa = noLimite(dentes[3].fim, 3, 9 * K);
  const forame = noLimite(dentes[6].fim + 4, 9, 11 * K);
  const pontos = {
    inc: fora(dentes[1], 12), asa: fora(dentes[3], 12), asm: fora(dentes[4], 12), asp: fora(dentes[6], 11),
    tuber: noLimiteFora(dentes[6].fim + 2, 30, 11 * K),
    pm: noLimite(dentes[6].fim - 3, 9, 11 * K), papila: [papila[0] - 10, papila[1] + 3],
    amsa: [(gAmsa[0] + 150) / 2, gAmsa[1]], rafe: [150, dentes[5].c[1] + 4], palmole: [150, ult.c[1] + 40],
  };
  const internos = dentes.map(d => dentro(d, 2));
  const espelha = (p) => [300 - p[0], p[1]];
  const palato = [...internos, [150, ult.c[1] + 18], ...[...internos].reverse().map(espelha)];
  const regioes = {
    palPost: [...internos.slice(3), [150, ult.c[1] + 16], [150, internos[3][1]]],
    palMeio: [...internos.slice(0, 5), [150, internos[4][1]]],
    hemiPal: [[150, internos[0][1]], ...internos, [150, ult.c[1] + 16]],
  };
  // palato anterior (de canino a canino): monta à mão para ficar simétrico
  regioes.palAnt = [...internos.slice(0, 3), [internos[2][0] + 6, internos[2][1] + 16], [300 - internos[2][0] - 6, internos[2][1] + 16], ...internos.slice(0, 3).reverse().map(espelha)];
  const caminhoCentros = (lista) => lista.map((p, k) => `${k ? "L" : "M"}${pt(p)}`).join(" ");
  const centrosArco = [...[...dentes].reverse().map(d => d.c), ...dentes.map(d => espelha(d.c))];
  function desenhar(area = null) {
    const dentesSvg = (lado) => dentes.map(d => {
      const f = formaOclusal(d.tipo, d.W - 0.6, d.H);
      const destaque = lado === "d" && area?.dentes?.includes(d.i) ? "destaque" : lado === "d" && area?.parciais?.includes(d.i) ? "parcial" : "";
      return `<g class="dente-ocl ${destaque}" transform="translate(${pt(d.c)}) rotate(${r1(d.ang)})"><path d="${f.d}" class="coroa"/><path d="${f.f}" class="sulco"/></g>`;
    }).join("");
    const reg = area?.regiao && regioes[area.regiao] ? `<path d="M${regioes[area.regiao].map(pt).join(" L")} Z" class="area-anest"/>` : "";
    const vest = area?.regiao === "vestPost" ? `<circle cx="${r1(pontos.asp[0])}" cy="${r1(pontos.asp[1])}" r="26" class="area-anest"/>` : area?.regiao === "vestAnt" ? `<circle cx="${r1(pontos.inc[0])}" cy="${r1(pontos.inc[1])}" r="20" class="area-anest"/>` : "";
    const face = area?.regiao === "face" ? `<g class="selo-face"><rect x="8" y="232" width="180" height="22" rx="11"/><text x="98" y="247" text-anchor="middle">+ lábio superior, nariz e pálpebra inferior</text></g>` : "";
    return `<svg class="mira-svg mira-maxila" viewBox="0 0 300 280" role="img" aria-label="Maxila vista por baixo">
      <defs><linearGradient id="esmalte" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E7ECF4"/></linearGradient>
        <radialGradient id="mucosa-pal" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#F6C4CD"/><stop offset="1" stop-color="#E9A2B1"/></radialGradient></defs>
      <rect x="0" y="0" width="300" height="280" rx="18" class="fundo-mira"/>
      <path d="${caminhoCentros(centrosArco)}" fill="none" stroke="#F3C2CB" stroke-width="74" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${caminhoCentros(centrosArco)}" fill="none" stroke="#EA9FAE" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M${palato.map(pt).join(" L")} Z" fill="url(#mucosa-pal)"/>
      <path d="M${pt([internos[7][0] - 2, ult.c[1] + 12])} Q150 ${r1(ult.c[1] + 46)} ${pt([300 - internos[7][0] + 2, ult.c[1] + 12])} L${pt([300 - internos[7][0] + 6, 272])} L${pt([internos[7][0] - 6, 272])} Z" fill="#DE8E9F"/>
      <path d="M140 ${r1(ult.c[1] + 40)} q10 22 20 0" fill="#D07A8D"/>
      <path d="M150 ${r1(papila[1] + 8)} V${r1(ult.c[1] + 12)}" stroke="#D88A9B" stroke-width="2.2" stroke-dasharray="5 4"/>
      ${[0, 1, 2].map(k => { const y = papila[1] + 12 + k * 11; return `<path d="M${144 - k * 2} ${y} q-8 -5 -15 1 t-14 -1" stroke="#DB8D9E" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${156 + k * 2} ${y} q8 -5 15 1 t14 -1" stroke="#DB8D9E" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; }).join("")}
      <ellipse cx="150" cy="${r1(papila[1])}" rx="6" ry="8" fill="#F08FA3" stroke="#CC6F84" stroke-width="1.3"/>
      <ellipse cx="${r1(forame[0])}" cy="${r1(forame[1])}" rx="3.6" ry="2.6" fill="#A44E63"/><ellipse cx="${r1(300 - forame[0])}" cy="${r1(forame[1])}" rx="3.6" ry="2.6" fill="#A44E63"/>
      ${reg}${vest}
      <g>${dentesSvg("d")}</g><g transform="translate(300 0) scale(-1 1)">${dentesSvg("e")}</g>
      ${face}
      <g class="mira-rotulos">
        <text x="150" y="12" text-anchor="middle">sulco mucovestibular (fundo de vestíbulo)</text>
        <text x="${r1(150 + 10)}" y="${r1(papila[1] - 2)}">papila incisiva</text>
        <text x="156" y="${r1(dentes[5].c[1] + 22)}">rafe palatina</text>
        <text x="${r1(forame[0] + 8)}" y="${r1(forame[1] + 14)}">forame palatino maior</text>
        <text x="150" y="${r1(ult.c[1] + 60)}" text-anchor="middle">palato mole</text>
        <text x="10" y="274">direito do paciente</text>
      </g>
    </svg>`;
  }
  return { pontos, desenhar, viewBox: "0 0 300 280" };
}

// ================= desenho: boca aberta, de frente =================
const ALTURA = [10.5, 9, 10, 8, 7.5, 7, 6.5, 6];
function formaCoroa(tipo, w, h) { // y = 0 na gengiva, cresce para a ponta
  if (tipo === "ic" || tipo === "il") return `M${-w / 2} 0 L${-w * 0.47} ${h * 0.86} Q${-w * 0.44} ${h} ${-w * 0.3} ${h} L${w * 0.3} ${h} Q${w * 0.44} ${h} ${w * 0.47} ${h * 0.86} L${w / 2} 0 Z`;
  if (tipo === "c") return `M${-w / 2} 0 L${-w * 0.46} ${h * 0.6} Q${-w * 0.22} ${h * 0.86} 0 ${h} Q${w * 0.22} ${h * 0.86} ${w * 0.46} ${h * 0.6} L${w / 2} 0 Z`;
  if (tipo === "pm") return `M${-w / 2} 0 L${-w * 0.46} ${h * 0.68} Q0 ${h * 1.12} ${w * 0.46} ${h * 0.68} L${w / 2} 0 Z`;
  return `M${-w / 2} 0 L${-w * 0.48} ${h * 0.74} Q${-w * 0.26} ${h * 1.04} 0 ${h * 0.86} Q${w * 0.26} ${h * 1.04} ${w * 0.48} ${h * 0.74} L${w / 2} 0 Z`;
}
function montarBoca() {
  const R = 90, TOT = DENTES.reduce((a, d) => a + d[1], 0), PHI = 104 * Math.PI / 180;
  const arco = (sup) => { let acc = 0; return DENTES.map(([tipo, md], i) => {
    const phi = (acc + md / 2) / TOT * PHI; acc += md;
    const x = 150 - R * Math.sin(phi), y = sup ? 46 + 54 * (1 - Math.cos(phi)) : 262 - 54 * (1 - Math.cos(phi));
    const esc = 0.62 + 0.38 * Math.cos(phi), w = md * 2.9 * (0.42 + 0.58 * Math.cos(phi * 0.95)), h = ALTURA[i] * 2.35 * esc;
    const ang = (sup ? 1 : -1) * phi * 180 / Math.PI * 0.32; // gira acompanhando o arco
    return { i, tipo, x, y, w: Math.max(w, md * 1.15), h, ang, phi };
  }); };
  const sup = arco(true), inf = arco(false), us = sup[7], ui = inf[7];
  const rafe = [[us.x + 16, us.y + 4], [us.x + 25, (us.y + ui.y) / 2], [ui.x + 16, ui.y - 4]];
  const incisura = [[us.x - 18, us.y - 2], [us.x - 6, (us.y + ui.y) / 2], [ui.x - 18, ui.y + 2]];
  const planoInf = ui.y - ui.h - 2, planoSup = us.y + us.h + 2;
  const xNai = incisura[1][0] + 0.75 * (rafe[1][0] - incisura[1][0]);
  const pontos = {
    bnai: [xNai, planoInf - 20], bnai_baixo: [xNai + 2, planoInf + 6], bnai_ant: [incisura[1][0] - 3, planoInf - 22], bnai_med: [rafe[1][0] + 14, planoInf - 24],
    gg: [xNai + 3, planoSup + 6], va: [us.x - 10, us.y - 12], bucal: [ui.x - 15, ui.y + 10], mentual: [(inf[3].x + inf[4].x) / 2 - 10, (inf[3].y + inf[4].y) / 2 + 22],
  };
  const espelhaX = (x) => 300 - x;
  function desenhar(area = null) {
    const coroa = (d, cima, lado) => {
      const destaque = lado === "d" && !cima && area?.dentes?.includes(d.i) ? "destaque" : "";
      return `<g class="dente-lab ${destaque}" transform="translate(${r1(d.x)} ${r1(d.y)}) rotate(${r1(d.ang)}) ${cima ? "" : "scale(1 -1)"}"><path d="${formaCoroa(d.tipo, d.w, d.h)}" class="coroa"/><path d="M${r1(-d.w * 0.18)} ${r1(d.h * 0.18)} L${r1(-d.w * 0.12)} ${r1(d.h * 0.62)}" class="brilho"/></g>`;
    };
    const gengiva = (lista, cima) => `<path d="M${lista.map(d => `${r1(d.x)} ${r1(d.y)}`).join(" L")}" fill="none" stroke="#EE9DAE" stroke-width="${cima ? 20 : 20}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const meiaS = [...sup].reverse(), meiaI = [...inf].reverse();
    const todosS = [...meiaS, ...sup.map(d => ({ ...d, x: espelhaX(d.x) }))], todosI = [...meiaI, ...inf.map(d => ({ ...d, x: espelhaX(d.x) }))];
    const regiao = area?.regiao || "";
    const realce = [
      regiao.includes("lingua") ? `<path d="M150 182 C116 180 92 196 94 218 C96 238 124 246 150 246 Z" class="area-anest"/>` : "",
      regiao.includes("abio") ? `<path d="M150 272 C120 272 92 266 70 256 L66 280 C92 288 124 290 150 290 Z" class="area-anest"/>` : "",
      regiao.includes("ochecha") ? `<path d="M${r1(ui.x - 22)} ${r1(ui.y - 26)} C${r1(ui.x - 34)} ${r1(ui.y)} ${r1(ui.x - 30)} ${r1(ui.y + 30)} ${r1(ui.x - 6)} ${r1(ui.y + 36)} L${r1(ui.x + 8)} ${r1(ui.y + 6)} Z" class="area-anest"/>` : "",
    ].join("");
    return `<svg class="mira-svg mira-boca" viewBox="0 0 300 290" role="img" aria-label="Boca aberta vista de frente">
      <defs><linearGradient id="esmalte2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4E9F2"/></linearGradient>
        <radialGradient id="cavidade" cx=".5" cy=".48" r=".55"><stop offset="0" stop-color="#3A0F18"/><stop offset=".55" stop-color="#6B2232"/><stop offset="1" stop-color="#9C3B4E"/></radialGradient>
        <radialGradient id="lingua" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#F49AA8"/><stop offset="1" stop-color="#D96E81"/></radialGradient></defs>
      <rect x="0" y="0" width="300" height="290" rx="18" class="fundo-pele"/>
      <ellipse cx="150" cy="154" rx="146" ry="140" fill="#D9707F"/>
      <ellipse cx="150" cy="154" rx="136" ry="130" fill="url(#cavidade)"/>
      <path d="M${r1(us.x - 30)} ${r1(us.y - 26)} C${r1(us.x - 50)} ${r1(us.y + 40)} ${r1(ui.x - 50)} ${r1(ui.y - 30)} ${r1(ui.x - 32)} ${r1(ui.y + 30)} L4 ${r1(ui.y + 30)} L4 ${r1(us.y - 26)} Z" fill="#C25F71"/>
      <path d="M${r1(espelhaX(us.x - 30))} ${r1(us.y - 26)} C${r1(espelhaX(us.x - 50))} ${r1(us.y + 40)} ${r1(espelhaX(ui.x - 50))} ${r1(ui.y - 30)} ${r1(espelhaX(ui.x - 32))} ${r1(ui.y + 30)} L296 ${r1(ui.y + 30)} L296 ${r1(us.y - 26)} Z" fill="#C25F71"/>
      <path d="${curvaQ(incisura)}" fill="none" stroke="#E7A0AC" stroke-width="5" stroke-linecap="round"/>
      <path d="${curvaQ(incisura.map(p => [espelhaX(p[0]), p[1]]))}" fill="none" stroke="#E7A0AC" stroke-width="5" stroke-linecap="round"/>
      <path d="M118 120 Q150 92 182 120 Q178 158 150 162 Q122 158 118 120Z" fill="#2A0A12"/>
      <path d="M143 104 Q150 96 157 104 L155 126 Q150 134 145 126Z" fill="#E0788A"/>
      <path d="${curvaQ(rafe)}" fill="none" stroke="${T}" stroke-width="9" stroke-linecap="round" opacity=".25"/>
      <path d="${curvaQ(rafe)}" fill="none" stroke="#F4BCC6" stroke-width="5.5" stroke-linecap="round"/>
      <path d="${curvaQ(rafe.map(p => [espelhaX(p[0]), p[1]]))}" fill="none" stroke="#F4BCC6" stroke-width="5.5" stroke-linecap="round"/>
      <ellipse cx="150" cy="214" rx="72" ry="42" fill="url(#lingua)"/><path d="M150 180 V246" stroke="#C25A6E" stroke-width="2"/>
      ${realce}
      ${gengiva(todosS, true)}${gengiva(todosI, false)}
      <g>${sup.map(d => coroa(d, true, "d")).join("")}${inf.map(d => coroa(d, false, "d")).join("")}</g>
      <g transform="translate(300 0) scale(-1 1)">${sup.map(d => coroa(d, true, "e")).join("")}${inf.map(d => coroa(d, false, "e")).join("")}</g>
      <path d="M0 0 H300 V22 Q150 40 0 22Z" fill="#D9707F"/><path d="M0 22 Q150 40 300 22" stroke="#B5485C" stroke-width="2.5" fill="none"/>
      <path d="M0 290 H300 V272 Q150 254 0 272Z" fill="#D9707F"/><path d="M0 272 Q150 254 300 272" stroke="#B5485C" stroke-width="2.5" fill="none"/>
      <path d="M22 ${r1(planoInf)} H${r1(rafe[1][0] + 30)}" stroke="#FFE08A" stroke-width="1.5" stroke-dasharray="4 3" opacity=".9"/>
      <g class="mira-rotulos claro">
        <text x="${r1(rafe[1][0] + 10)}" y="${r1(rafe[1][1] - 10)}">rafe pterigo-</text><text x="${r1(rafe[1][0] + 10)}" y="${r1(rafe[1][1] - 2)}">mandibular</text>
        <text x="6" y="${r1(incisura[1][1] + 34)}">incisura</text><text x="6" y="${r1(incisura[1][1] + 42)}">coronoide</text>
        <text x="${r1(rafe[1][0] + 32)}" y="${r1(planoInf + 3)}">plano oclusal</text>
        <text x="150" y="222" text-anchor="middle">língua</text>
        <text x="10" y="286">direito do paciente</text>
      </g>
    </svg>`;
  }
  return { pontos, desenhar, viewBox: "0 0 300 290" };
}

let VISTAS = null;
const vistas = () => (VISTAS ??= { maxila: montarMaxila(), boca: montarBoca() });

// De onde vem a seringa (corpo), para desenhá-la no ponto escolhido.
function origemSeringa(t, P) {
  const p = P[t.ponto];
  const tab = {
    sup: [p[0] - 30, -10], asp: [30, 30], asm: [24, 20], asa: [40, 0], v2: [26, 40],
    pm: [270, p[1] - 40], amsa: [272, p[1] - 30], np: [215, 210], pasa: [205, 220],
    bnai: [262, 230], gg: [262, 210], va: [-10, p[1] + 2], bucal: [-6, p[1] + 34], mentual: [120, 300], incisivo: [120, 300],
  };
  return tab[t.id] || [p[0] - 60, p[1] - 60];
}

// ================= jogo =================
const fmtMl = (v) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: v * 100 % 10 ? 2 : 1, maximumFractionDigits: 2 })} mL`;
function fracaoTubete(v) {
  const f = v / 1.8, ops = [[1 / 8, "1/8"], [1 / 6, "1/6"], [1 / 4, "1/4"], [1 / 3, "1/3"], [1 / 2, "metade"], [2 / 3, "2/3"], [3 / 4, "3/4"], [1, "1 tubete"], [1.5, "1 tubete e meio"], [2, "2 tubetes"]];
  const [, nome] = ops.reduce((a, b) => (Math.abs(b[0] - f) < Math.abs(a[0] - f) ? b : a));
  return Math.abs(ops.find(o => o[1] === nome)[0] - f) < 0.04 ? `${nome}${nome.includes("tubete") || nome === "metade" ? "" : " do tubete"}` : `${Math.round(f * 100)}% do tubete`;
}

export async function jogarMira(opts = {}) {
  const escolha = opts.vista || await modal({ titulo: "Mira da Agulha", texto: "Ponto de punção, seringa, profundidade, volume, nervos e uma pergunta, técnica por técnica (Malamed, caps. 13 e 14).", botoes: [
    { texto: "Maxila (cap. 13)", valor: "maxila" }, { texto: "Mandíbula (cap. 14)", valor: "boca", classe: "secundario" },
    { texto: "Tudo misturado", valor: "tudo", classe: "secundario" }, { texto: "Cancelar", valor: null, classe: "secundario" }] });
  if (!escolha) return;
  const cam = abrirCamada("Mira da Agulha");
  const D = await extra("jogo:mira");
  if (!D) return semConteudo(cam, "Os dados do jogo ainda não chegaram. Sincronize com internet.");
  const lista = embaralhar(D.tecnicas.filter(t => escolha === "tudo" || t.vista === escolha)).slice(0, opts.quantas || 5);
  const placar = [];
  let i = 0;
  const mira = E().mira ??= { partidas: 0, tecnicas: {} };
  const ETAPAS = ["Ponto", "Seringa", "Profund.", "Volume", "Nervos", "Pergunta"];

  function proxima() {
    if (i >= lista.length) return fim();
    jogarTecnica(lista[i], (r) => { placar.push(r); i++; proxima(); });
  }

  function jogarTecnica(t, aoAcabar) {
    const V = vistas()[t.vista], r = { t, etapas: [] };
    cam.info.textContent = `${i + 1}/${lista.length}`;
    cam.corpo.innerHTML = `<div class="mira">
      <div class="mira-cab"><span class="mira-num">${i + 1}</span><div><b>${escapar(t.nome)}</b><small>${escapar(t.contexto)}</small></div></div>
      <div class="mira-palco">${V.desenhar()}<svg class="mira-camada" viewBox="${V.viewBox}"></svg></div>
      <div class="mira-etapas">${ETAPAS.map((n, k) => `<span data-k="${k}"><i>${k + 1}</i>${n}</span>`).join("")}</div>
      <div class="mira-acao"></div></div>`;
    const palco = cam.corpo.querySelector(".mira-palco"), camada = cam.corpo.querySelector(".mira-camada"), acao = cam.corpo.querySelector(".mira-acao");
    const etapa = (k, res) => { const s = cam.corpo.querySelector(`.mira-etapas [data-k="${k}"]`); s.className = res === true ? "ok" : res === "meio" ? "meio" : res === false ? "erro" : "atual"; };
    const P = V.pontos, pc = P[t.ponto];
    const seguir = (fn, txt = "Seguir") => { const b = document.createElement("button"); b.className = "botao"; b.textContent = txt; b.onclick = fn; acao.append(b); requestAnimationFrame(() => b.scrollIntoView({ block: "nearest", behavior: "smooth" })); return b; };
    const fb = (certo, titulo, texto) => `<div class="feedback-mini entra ${certo === true ? "certo" : certo === "meio" ? "parcial" : "errado"}"><b>${titulo}</b><p>${texto}</p></div>`;
    const som = (res) => { tocar(res === true ? "certo" : res === "meio" ? "parcial" : "errado"); if (res === false) vibrar(40); };
    const escolhaUnica = (k, enunciado, opcoes, certa, explic, depois, titulos = ["Isso!", "Não é assim"]) => {
      etapa(k);
      acao.innerHTML = `<p class="enunciado">${escapar(enunciado)}</p><div class="opcoes"></div>`;
      const box = acao.querySelector(".opcoes");
      for (const { tx, j } of embaralhar(opcoes.map((tx, j) => ({ tx, j })))) {
        const b = document.createElement("button"); b.className = "opcao"; b.textContent = tx;
        b.onclick = () => {
          const certo = j === certa;
          box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === opcoes[certa]) x.classList.add("correta"); });
          if (!certo) b.classList.add("incorreta");
          som(certo); r.etapas.push(certo ? 1 : 0); etapa(k, certo);
          box.insertAdjacentHTML("afterend", fb(certo, titulos[certo ? 0 : 1], explic));
          depois?.(certo);
        };
        box.append(b);
      }
    };

    // 1) ponto
    etapa(0);
    acao.innerHTML = `<p class="enunciado">Toque no ponto de punção.</p><p class="sub dica-mira">Os rótulos mostram os pontos de referência. Use os dentes para se localizar.</p>`;
    camada.innerHTML = Object.entries(P).map(([id, [x, y]]) => `<g class="alvo" data-id="${id}"><circle cx="${r1(x)}" cy="${r1(y)}" r="12" class="alvo-toque"/><circle cx="${r1(x)}" cy="${r1(y)}" r="5.5" class="alvo-ponto"/></g>`).join("");
    camada.querySelectorAll(".alvo").forEach(g => (g.onclick = () => {
      if (camada.classList.contains("feito")) return;
      camada.classList.add("feito");
      const id = g.dataset.id, certo = id === t.ponto;
      g.classList.add(certo ? "certo" : "errado");
      camada.querySelector(`.alvo[data-id="${t.ponto}"]`).classList.add("certo", "pulsa");
      som(certo); r.etapas.push(certo ? 1 : 0); etapa(0, certo);
      if (certo) palco.classList.add("acertou");
      const PD = D.pontos;
      acao.innerHTML = fb(certo, certo ? "Na mosca!" : "Não é aqui", certo ? escapar(PD[t.ponto].desc) : `Você tocou em: ${escapar(PD[id]?.desc || id)}<br><br>O certo: ${escapar(PD[t.ponto].desc)}`);
      seguir(direcao);
    }));

    // 2) seringa
    function direcao() {
      palco.classList.add("compacto");
      escolhaUnica(1, "Como posicionar a seringa e avançar a agulha?", t.direcao.opcoes, t.direcao.certa, escapar(t.direcao.explic), () => {
        const [sx, sy] = origemSeringa(t, P), ang = Math.atan2(pc[1] - sy, pc[0] - sx), cx = pc[0] - Math.cos(ang) * 26, cy = pc[1] - Math.sin(ang) * 26;
        const graus = ang * 180 / Math.PI, comp = Math.hypot(cx - sx, cy - sy);
        camada.insertAdjacentHTML("afterbegin", `<g class="seringa" transform="translate(${r1(sx)} ${r1(sy)}) rotate(${r1(graus)})">
          <rect x="${r1(comp - Math.min(comp, 70))}" y="-5.5" width="${r1(Math.min(comp, 70))}" height="11" rx="3" fill="#E9EEF6" stroke="${T}" stroke-width="1.6"/>
          <rect x="${r1(comp - Math.min(comp, 70) + 14)}" y="-3" width="${r1(Math.min(comp, 70) - 26)}" height="6" rx="2" fill="#BFE6FF"/>
          <rect x="${r1(comp - 6)}" y="-3.5" width="6" height="7" rx="1.5" fill="#2F6BFF" stroke="${T}" stroke-width="1"/>
          <line x1="${r1(comp)}" y1="0" x2="${r1(comp + 26)}" y2="0" stroke="#7F8AA3" stroke-width="1.8" class="agulha-anim"/></g>`);
        seguir(profundidade);
      });
    }

    // 3) profundidade
    function profundidade() {
      etapa(2);
      if (t.profTexto) {
        escolhaUnica(2, "Até onde avançar a agulha?", t.profTexto.opcoes, t.profTexto.certa, escapar(t.profTexto.explic), () => seguir(volume), ["Na medida!", "Não"]);
        return;
      }
      const p = t.prof, L = p.agulha, marcas = Array.from({ length: Math.floor(L / 5) + 1 }, (_, k) => k * 5);
      acao.innerHTML = `<p class="enunciado">Profundidade da penetração <small class="sub">(agulha ${L === 20 ? "curta, cerca de 20 mm" : "longa, cerca de 32 mm"})</small></p>
        <div class="ag-cena">
          <div class="ag-tecido"><span>mucosa</span><span>tecido mole</span></div>
          <div class="ag-alvo" hidden></div>
          <div class="ag-seringa"><i class="ag-embolo"></i><i class="ag-corpo"><b></b></i><i class="ag-canhao"></i><i class="ag-agulha"></i></div>
          <div class="ag-regua">${marcas.map(m => `<span style="left:${(m / L) * 100}%">${m}</span>`).join("")}</div>
        </div>
        <div class="ag-leitura"><b>0 mm</b><small>No tecido · ${L} mm visíveis</small></div>
        <input class="ag-slider" type="range" min="0" max="${L}" step="1" value="0" aria-label="Profundidade em mm">`;
      const sl = acao.querySelector(".ag-slider"), leit = acao.querySelector(".ag-leitura"), cena = acao.querySelector(".ag-cena");
      const mostrar = () => { const mm = +sl.value; leit.querySelector("b").textContent = `${mm} mm`; leit.querySelector("small").textContent = `no tecido · ${L - mm} mm visíveis`; cena.style.setProperty("--dentro", mm / L); };
      sl.oninput = () => { mostrar(); if (+sl.value % 5 === 0) { vibrar(6); tocar("toque"); } };
      mostrar();
      const b = seguir(() => {
        const mm = +sl.value; sl.disabled = true; b.remove();
        const certo = mm >= p.min && mm <= p.max, quase = !certo && mm >= p.min - 3 && mm <= p.max + 3, res = certo ? true : quase ? "meio" : false;
        const alvo = acao.querySelector(".ag-alvo"); alvo.hidden = false;
        alvo.style.left = `calc(30% + ${(p.min / L) * 70}%)`; alvo.style.width = `${Math.max(1.5, ((p.max - p.min) / L) * 70)}%`;
        cena.classList.add(certo ? "certo" : quase ? "quase" : "errado");
        som(res); r.etapas.push(certo ? 1 : quase ? 0.5 : 0); etapa(2, res);
        const motivo = mm < p.min ? p.raso : mm > p.max ? p.fundo : "";
        acao.insertAdjacentHTML("beforeend", fb(res, certo ? `${mm} mm: na medida!` : quase ? `${mm} mm: quase` : `${mm} mm: não`, `${motivo ? `${escapar(motivo)}<br><br>` : ""}${escapar(p.explic)}`));
        seguir(volume);
      }, "Avançar até aqui");
    }

    // 4) volume
    function volume() {
      etapa(3);
      const v = t.volume;
      acao.innerHTML = `<p class="enunciado">Quanto anestésico depositar?</p>
        <div class="vol-cena"><div class="mira-tub"><i class="tub-liq"></i><i class="tub-tampa"></i><i class="tub-borracha"></i><span>1,8 mL</span></div><div class="mira-tub t2"><i class="tub-liq"></i><i class="tub-tampa"></i><i class="tub-borracha"></i><span>2º tubete</span></div>
          <div class="vol-leitura"><b>0,6 mL</b><small></small></div></div>
        <div class="vol-botoes"><button class="botao secundario mini" data-d="-0.05">−</button><input class="ag-slider vol-slider" type="range" min="0.1" max="3.6" step="0.05" value="0.6" aria-label="Volume em mL"><button class="botao secundario mini" data-d="0.05">+</button></div>`;
      const sl = acao.querySelector(".vol-slider"), cena = acao.querySelector(".vol-cena");
      const mostrar = () => {
        const ml = Math.round(+sl.value * 100) / 100;
        cena.querySelector("b").textContent = fmtMl(ml); cena.querySelector("small").textContent = fracaoTubete(ml);
        const [a, b2] = cena.querySelectorAll(".mira-tub");
        a.style.setProperty("--nivel", Math.max(0, 1 - Math.min(ml, 1.8) / 1.8)); b2.style.setProperty("--nivel", Math.max(0, 1 - Math.max(0, ml - 1.8) / 1.8));
        b2.classList.toggle("usado", ml > 1.8);
      };
      sl.oninput = mostrar;
      acao.querySelectorAll("[data-d]").forEach(b => (b.onclick = () => { sl.value = Math.max(0.1, Math.min(3.6, +sl.value + +b.dataset.d)).toFixed(2); mostrar(); tocar("toque"); }));
      mostrar();
      const b = seguir(() => {
        const ml = Math.round(+sl.value * 100) / 100; sl.disabled = true; acao.querySelectorAll("[data-d]").forEach(x => (x.disabled = true)); b.remove();
        const certo = ml >= v.min - 0.001 && ml <= v.max + 0.001, quase = !certo && ml >= v.min - 0.2 && ml <= v.max + 0.2, res = certo ? true : quase ? "meio" : false;
        cena.classList.add(certo ? "certo" : quase ? "quase" : "errado");
        som(res); r.etapas.push(certo ? 1 : quase ? 0.5 : 0); etapa(3, res);
        acao.insertAdjacentHTML("beforeend", fb(res, certo ? `${fmtMl(ml)}: isso!` : quase ? `${fmtMl(ml)}: quase` : `${fmtMl(ml)}: não`, `${v.min === v.max ? "" : `O livro: de ${fmtMl(v.min)} a ${fmtMl(v.max)}. `}${escapar(v.explic)}`));
        seguir(nervos);
      }, "Depositar");
    }

    // 5) nervos
    function nervos() {
      etapa(4);
      const N = t.nervos, nome = (n) => D.nervosDesc?.[n] || n, marcados = new Set();
      acao.innerHTML = `<p class="enunciado">Quais nervos ficam anestesiados?</p><p class="sub dica-mira">Marque todos os que achar certos.</p><div class="chips-nervos"></div>`;
      const box = acao.querySelector(".chips-nervos");
      for (const n of N.opcoes) {
        const c = document.createElement("button"); c.className = "chip-nervo"; c.textContent = nome(n); c.dataset.n = n;
        c.onclick = () => { if (marcados.has(n)) marcados.delete(n); else marcados.add(n); c.classList.toggle("on"); tocar("toque"); conf.disabled = !marcados.size; };
        box.append(c);
      }
      const conf = seguir(() => {
        conf.remove();
        const certos = new Set(N.certos), opc = new Set(N.opcionais || []);
        const errados = [...marcados].filter(n => !certos.has(n) && !opc.has(n)), faltaram = [...certos].filter(n => !marcados.has(n));
        box.querySelectorAll(".chip-nervo").forEach(c => {
          const n = c.dataset.n; c.disabled = true;
          if (marcados.has(n)) c.classList.add(certos.has(n) || opc.has(n) ? "certo" : "errado");
          else if (certos.has(n)) c.classList.add("faltou");
        });
        const res = !errados.length && !faltaram.length ? true : errados.length + faltaram.length <= 1 || (!errados.length && faltaram.length < certos.size) ? "meio" : false;
        som(res); r.etapas.push(res === true ? 1 : res === "meio" ? 0.5 : 0); etapa(4, res);
        const txt = `${errados.length ? `Não entram: ${errados.map(nome).join(", ")}. ` : ""}${faltaram.length ? `Faltou: ${faltaram.map(nome).join(", ")}. ` : ""}Certos: ${N.certos.map(nome).join(", ")}${opc.size ? ` (e o ${[...opc].join(", ")} em cerca de 75% dos pacientes)` : ""}.`;
        acao.insertAdjacentHTML("beforeend", fb(res, res === true ? "Todos certos!" : res === "meio" ? "Quase" : "Não", escapar(txt)));
        seguir(pergunta);
      }, "Confirmar");
      conf.disabled = true;
    }

    // 6) pergunta e área anestesiada
    function pergunta() {
      const q = t.pergunta;
      escolhaUnica(5, q.enunciado, q.opcoes, q.certa, `${escapar(q.explic)}<br><small>Malamed, p. ${t.pagina} do PDF</small>`, () => {
        const st = mira.tecnicas[t.id] ??= { vezes: 0, pontos: 0 };
        const tot = r.etapas.reduce((a, b) => a + b, 0);
        st.vezes++; st.pontos += tot; salvar();
        // mostra a área anestesiada no desenho
        const novo = document.createElement("div"); novo.innerHTML = V.desenhar(t.area);
        palco.querySelector(".mira-svg").replaceWith(novo.firstElementChild);
        camada.innerHTML = ""; palco.classList.add("mostra-area");
        acao.insertAdjacentHTML("beforeend", `<div class="mira-nota"><div class="estrelas">${[1, 2, 3].map(k => `<i class="${tot >= k * 2 ? "on" : ""}">★</i>`).join("")}</div><b>${num(tot)} de 6</b><small>A área em amarelo, no desenho, é a anestesiada.</small></div>`);
        if (tot >= 5.5) { confete(1200); tocar("combo"); }
        cam.corpo.scrollTo?.({ top: 0, behavior: "smooth" });
        seguir(() => aoAcabar(r), i + 1 < lista.length ? "Próxima técnica" : "Ver resultado");
      }, ["Certo!", "Não"]);
    }
  }

  function fim() {
    const total = placar.reduce((s, r) => s + r.etapas.reduce((a, b) => a + b, 0), 0), max = placar.length * 6;
    mira.partidas++; salvar();
    const ic = (e) => e === 1 ? `<i class="ok">✓</i>` : e ? `<i class="meio">½</i>` : `<i class="erro">✗</i>`;
    const linhas = placar.map(r => `<li><span>${escapar(r.t.nome)}<small>Malamed, p. ${r.t.pagina}</small></span><b>${r.etapas.map(ic).join("")}</b></li>`).join("");
    terminar(cam, "mira", r1(total), { xp: Math.round(total * 1.6), moedas: Math.round(total * 0.8) },
      `<p class="sub">${num(total)} de ${max} etapas (ponto, seringa, profundidade, volume, nervos e pergunta).</p><ul class="mira-resumo">${linhas}</ul>`, "pontos");
  }
  proxima();
}
export const _vistas = () => vistas(); // para testes
