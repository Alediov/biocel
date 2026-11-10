// Escolha o Anestésico (pedido do Alediov, 04/11/2026, para a prova de Anestesiologia de 18/11): pacientes com peso,
// estado físico (ASA), procedimento, duração e necessidade de hemostasia; ele escolhe a solução (anestésico e
// vasoconstritor), a técnica dos caps. 13 e 14 e o máximo de tubetes da sessão, cada escolha com a explicação e a
// página do Malamed. Dados em extras/jogos/anestesico.json (tools/jogos/montar_anestesico.py; as doses são as de
// extras/jogos/doses.json). Estado em E().anestesico: partidas e casos[id].
import { abrirCamada, semConteudo } from "../jogos.js";
import { extra } from "../dados.js";
import { escapar } from "../ui.js";
import { E } from "../estado.js";
import { jogarCasos, escolherCasos, telaConsulta } from "./casoClinico.js";

const NOMES = { anestesico: "Solução", tecnica: "Técnica", tubetes: "Tubetes", conduta: "Conduta" };
const est = () => { const p = E().anestesico ??= {}; p.casos ??= {}; p.partidas ??= 0; return p; };

export async function jogarAnestesico(opts = {}) {
  const cam = abrirCamada("Escolha o Anestésico");
  const D = await extra("jogo:anestesico");
  if (!D?.casos?.length) return semConteudo(cam, "Os casos ainda não chegaram. Sincronize com internet.");
  const S = est();
  const jogar = (n) => jogarCasos(cam, {
    jogo: "anestesico", est: S, lista: escolherCasos(D.casos, S, n), rotulo: "Paciente", nomes: NOMES,
    icone: () => "💉", faixa: () => "Anestesiologia", procedimento: (c) => c.procedimento,
  });
  if (cam.licao || opts.direto) return jogar(opts.quantas || 3);
  inicio();

  function inicio() {
    cam.info.textContent = "";
    cam.corpo.scrollTop = 0;
    cam.corpo.innerHTML = `<div class="lam">
      <div class="lam-cab"><div class="lam-cont gal"><b>${D.casos.length}</b><small>pacientes</small></div>
        <div><h2>Escolha o Anestésico</h2><small>${escapar(D.livro)} · caps. 3, 4, 10, 13, 14 e 16</small></div></div>
      <div class="lam-modos">
        <button class="lam-modo" data-m="jogar"><b>Atender</b><small>5 pacientes: solução, técnica e quantos tubetes no máximo</small></button>
        <button class="lam-modo" data-m="ref"><b>Consultar o livro</b><small>Duração, doses máximas, epinefrina e contraindicações</small></button>
      </div></div>`;
    cam.corpo.querySelectorAll(".lam-modo").forEach(b => (b.onclick = () => (b.dataset.m === "ref" ? telaConsulta(cam, "Do Malamed", D.referencia, inicio) : jogar(5))));
  }
}
