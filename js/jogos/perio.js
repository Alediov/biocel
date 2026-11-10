// Estágio e Grau (pedido do Alediov, 04/11/2026, para a LAPERIO): classificação das doenças periodontais de 2017
// pelo Lindhe (7ª ed.). Cada caso traz a ficha e, nos fictícios, um periograma simplificado (sítios interproximais:
// profundidade de sondagem, margem gengival e sangramento) desenhado em SVG; ele acha o maior NIC e decide saúde ×
// gengivite × periodontite, o estágio, a extensão e o grau. Seis casos são os exemplos clínicos do cap. 16.
// Dados em extras/jogos/perio.json (tools/jogos/montar_perio.py). Estado em E().perio: partidas e casos[id].
import { abrirCamada, semConteudo } from "../jogos.js";
import { extra } from "../dados.js";
import { escapar } from "../ui.js";
import { E } from "../estado.js";
import { jogarCasos, escolherCasos, telaConsulta } from "./casoClinico.js";

const NOMES = { pic: "NIC", diag: "Diagnóstico", estagio: "Estágio", extensao: "Extensão", grau: "Grau", gengExt: "Extensão" };
const QUADS = [["Superior direito", [17, 16, 15, 14, 13, 12, 11], true], ["Superior esquerdo", [21, 22, 23, 24, 25, 26, 27], false],
  ["Inferior direito", [47, 46, 45, 44, 43, 42, 41], true], ["Inferior esquerdo", [31, 32, 33, 34, 35, 36, 37], false]];
const est = () => { const p = E().perio ??= {}; p.casos ??= {}; p.partidas ??= 0; return p; };

/** Periograma de um quadrante em SVG. distalPrimeiro: no lado direito do paciente (à esquerda de quem olha), a
 *  distal fica à esquerda de cada dente. */
function quadrante(nome, dentes, distalPrimeiro, mapa) {
  const L = 34, W = 22, x0 = L, H = 80;
  let s = `<svg class="pg-svg" viewBox="0 0 ${L + dentes.length * 2 * W + 2} ${H}" role="img" aria-label="${escapar(nome)}">`;
  s += `<text class="pg-rot" x="2" y="38">PS</text><text class="pg-rot" x="2" y="57">MG</text><text class="pg-rot" x="2" y="73">SS</text>`;
  dentes.forEach((d, k) => {
    const x = x0 + k * 2 * W, reg = mapa[d];
    s += `<rect class="pg-dente ${k % 2 ? "par" : ""}" x="${x}" y="2" width="${2 * W}" height="${H - 4}" rx="5"/>`;
    s += `<text class="pg-num" x="${x + W}" y="13">${d}</text>`;
    if (!reg || reg[1] == null) {
      s += `<text class="pg-ausente" x="${x + W}" y="55">✕</text>`;
      return;
    }
    const sitios = [[reg[1], reg[2], reg[3]], [reg[4], reg[5], reg[6]]]; // distal, mesial
    const ordem = distalPrimeiro ? sitios : [sitios[1], sitios[0]];
    ordem.forEach(([ps, mg, ss], j) => {
      const cx = x + W * j + W / 2;
      s += `<text class="pg-v ${ps >= 4 ? "fundo" : ""}" x="${cx}" y="38">${ps}</text>`;
      s += `<text class="pg-v pg-mg" x="${cx}" y="57">${mg > 0 ? "+" + mg : mg < 0 ? "−" + Math.abs(mg) : "0"}</text>`;
      if (ss) s += `<circle class="pg-ss" cx="${cx}" cy="70" r="3.6"/>`;
      else s += `<circle class="pg-sem" cx="${cx}" cy="70" r="2"/>`;
    });
    s += `<text class="pg-lado" x="${x + W / 2}" y="23">${distalPrimeiro ? "D" : "M"}</text><text class="pg-lado" x="${x + W * 1.5}" y="23">${distalPrimeiro ? "M" : "D"}</text>`;
  });
  return s + "</svg>";
}

export function periogramaHTML(linhas, legenda) {
  const mapa = Object.fromEntries(linhas.map(r => [r[0], r]));
  return `<div class="pg"><div class="pg-titulo">Periograma (sítios interproximais)</div>
    <div class="pg-grade">${QUADS.map(([n, ds, dp]) => `<figure class="pg-q"><figcaption>${n}</figcaption>${quadrante(n, ds, dp, mapa)}</figure>`).join("")}</div>
    <details class="pg-legenda"><summary>Como ler</summary><p>${escapar(legenda)}</p></details></div>`;
}

export async function jogarPerio(opts = {}) {
  const cam = abrirCamada("Estágio e Grau");
  const D = await extra("jogo:perio");
  if (!D?.casos?.length) return semConteudo(cam, "Os casos ainda não chegaram. Sincronize com internet.");
  const S = est();
  const jogar = (n, filtro) => jogarCasos(cam, {
    jogo: "perio", est: S, lista: escolherCasos(D.casos, S, n, filtro), rotulo: "Caso", nomes: NOMES,
    icone: (c) => (c.livro ? "📖" : "🪥"), faixa: (c) => (c.livro ? "Caso do livro" : "Periodontia"),
    extra: (c) => (c.periograma ? periogramaHTML(c.periograma, D.legenda) : ""),
  });
  if (cam.licao || opts.direto) return jogar(opts.quantas || 3);
  inicio();

  function inicio() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    const vistos = Object.keys(S.casos).length;
    cam.corpo.innerHTML = `<div class="lam">
      <div class="lam-cab"><div class="lam-cont gal"><b>${D.casos.length}</b><small>casos</small></div>
        <div><h2>Estágio e Grau</h2><small>Classificação de 2017 · ${escapar(D.livro)}${vistos ? ` · ${vistos} já vistos` : ""}</small></div></div>
      <div class="lam-modos">
        <button class="lam-modo" data-m="todos"><b>Classificar</b><small>5 pacientes: periograma, saúde ou doença, estágio, extensão e grau</small></button>
        <button class="lam-modo" data-m="livro"><b>Casos do livro</b><small>Os 6 exemplos clínicos do capítulo 16</small></button>
        <button class="lam-modo" data-m="tab"><b>Consultar as tabelas</b><small>Tabelas 15.3, 16.2 e 16.3, extensão e NIC</small></button>
      </div></div>`;
    cam.corpo.querySelectorAll(".lam-modo").forEach(b => (b.onclick = () => {
      const m = b.dataset.m;
      if (m === "tab") telaConsulta(cam, "Tabelas", D.tabelas, inicio);
      else if (m === "livro") jogar(6, (c) => c.livro);
      else jogar(5, (c) => !c.livro);
    }));
  }
}
