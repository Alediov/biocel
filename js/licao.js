// Executa uma lição: fila de exercícios, verificação, feedback, XP e tela final.
import { COMPONENTES, rotuloTipo, textoComEnfase } from "./exercicios.js";
import { E, registrarResposta, concluirLicao, reportar, hojeISO } from "./estado.js";
import { tocar, vibrar } from "./sons.js";
import { moli, avatar } from "./personagens.js";
import { urlMidia } from "./dados.js";
import { modal, toast, confete, escapar } from "./ui.js";
import { multiplicadorAtual, verificarBauDoDia, verificarBauBonus, ABAS_BONUS } from "./economia.js";
import { htmlBauGanho } from "./bausUI.js";
import { multLicao } from "./bonus.js";
import { creditarEvento, eventoAtivo } from "./eventos.js";
import { icone } from "./icones.js";
import { musicaCamada } from "./musica.js";
import { contarNumero } from "./animacoes.js";
import { criarFerramentas } from "./ferramentasLicao.js";
import { abrirVisor } from "./visorZoom.js";

const ELOGIOS = ["Mandou bem!", "Isso!", "Perfeito!", "Excelente!", "Na mosca!", "Arrasou!", "Show!"];
const CONSOLO = ["Quase lá", "Não foi dessa vez", "Vamos revisar isso"];
const sorteia = (a) => a[Math.floor(Math.random() * a.length)];

/** Figura do exercício em tela cheia, com zoom (visorZoom.js). */
function ampliar(src) { abrirVisor(src, { clara: true }); }

function fonteTexto(f) {
  if (!f) return "";
  if (f.material) return `${f.material}${f.pagina ? `, ${/slides/i.test(f.material) ? "slide" : "p."} ${f.pagina}` : ""}`;
  // a letra do id da unidade diz o livro: c Malamed, n Neville, f Andrade, b Burket, l Lindhe
  const u = f.unidade || "", livro = { c: "Malamed", n: "Neville", f: "Andrade", b: "Burket", l: "Lindhe" }[u[0]] || "Malamed";
  const cap = u.match(/^[a-z](\d+)/)?.[1];
  // `aula`: a questão também usa a transcrição da aula daquele dia (gravação das aulas, gerador/INSTRUCOES.md)
  const aula = f.aula ? ` · aula de ${String(f.aula).slice(8, 10)}/${String(f.aula).slice(5, 7)}` : "";
  if (!u && f.aula) return `Aula de ${String(f.aula).slice(8, 10)}/${String(f.aula).slice(5, 7)}`;
  return `${livro}${cap ? `, cap. ${+cap}` : ""}${f.pagina ? `, p. ${f.pagina} do PDF` : ""}${aula}`;
}

/** licao: { id, titulo, exercicios, periodo?, treino?, prova? } → resolve com o resumo ou null se saiu.
 *  `prova` (modo prova, simulado da próxima prova do Treino; pedido do Alediov, 04/11/2026): { minutos, detalhe(lista) }:
 *  relógio regressivo no topo, cada questão respondida uma vez só (sem retorno nem explicação até o fim; dá para pular,
 *  ela vai para o fim da fila), e no fim a nota de 0 a 10, o tempo, `detalhe(lista)` (HTML, ex.: por unidade) e
 *  "Rever os erros". Resolve com { …resumo, prova: { respostas: [{ id, acertou, sem? }], seg, nota, esgotou }, rever }. */
const RAIOS = `<svg class="raios-fim" viewBox="-100 -100 200 200" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<path d="M0 0 L${(Math.cos((i * 30 - 6) * Math.PI / 180) * 100).toFixed(1)} ${(Math.sin((i * 30 - 6) * Math.PI / 180) * 100).toFixed(1)} L${(Math.cos((i * 30 + 6) * Math.PI / 180) * 100).toFixed(1)} ${(Math.sin((i * 30 + 6) * Math.PI / 180) * 100).toFixed(1)} Z"/>`).join("")}</svg>`;

export function iniciarLicao(licao) {
  return new Promise((resolver) => {
    const camada = document.getElementById("camada-licao");
    camada.innerHTML = `
      <div class="licao-topo">
        <button class="fechar" aria-label="Sair da lição"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <div class="prog-tub vazio" role="progressbar" aria-label="Progresso da lição" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="pt-vidro"><div class="pt-liq"><i></i><i></i><i></i></div><div class="pt-marcas"></div><div class="pt-reflexo"></div></div>
          <div class="pt-tampa"></div><span class="pt-faisca"></span>
        </div>
        <div class="combo" aria-live="polite"></div>
      </div>
      <div class="licao-corpo"></div>
      <div class="licao-rodape"></div>`;
    camada.hidden = false;
    musicaCamada("licao");
    const corpo = camada.querySelector(".licao-corpo");
    const rodape = camada.querySelector(".licao-rodape");
    const barra = camada.querySelector(".prog-tub");
    const comboEl = camada.querySelector(".combo");
    // calculadora, caderno, marca-texto e caneta em todos os exercícios (ferramentasLicao.js); o caderno é da sessão
    const NOMES_SESSAO = { manha: "manhã", tarde: "tarde", noite: "noite", extra: "sessão extra", treino: "treino", evento: "evento" };
    const per = licao.evento ? "evento" : licao.periodo || "licao";
    const ferr = criarFerramentas({ camada, corpo, rodape, depoisDe: camada.querySelector(".licao-topo"), chaveCaderno: `${licao.dia || hojeISO()}|${per}`, nomeSessao: NOMES_SESSAO[per] || "lição" });

    const total = licao.exercicios.length;
    const prova = licao.prova || null;
    const respostasProva = []; let acabou = false, relogio = 0, esgotou = false;
    const mult = multiplicadorAtual();
    if (mult > 1) camada.querySelector(".licao-topo").insertAdjacentHTML("beforeend", `<span class="badge-mult" title="Poção ativa">×${mult}</span>`);
    const fila = licao.exercicios.map(ex => ({ ex, tentativa: 1 }));
    let concluidos = 0, acertosPrimeira = 0, xp = 0, combo = 0, maiorCombo = 0;
    const inicio = Date.now();
    let atual = null, comp = null, tInicio = 0;

    // o tubete se enche a cada exercício concluído; acerto brilha, erro balança, sequência deixa o líquido dourado
    barra.style.setProperty("--n", Math.max(1, total));
    function progresso(efeito) {
      const p = Math.min(1, concluidos / total);
      barra.style.setProperty("--p", p.toFixed(4));
      barra.setAttribute("aria-valuenow", String(Math.round(p * 100)));
      barra.classList.toggle("vazio", p === 0);
      barra.classList.toggle("cheio", p >= 1);
      barra.classList.toggle("em-combo", combo >= 3);
      if (efeito) { barra.classList.remove("acerto", "erro", "parcial"); void barra.offsetWidth; barra.classList.add(efeito); }
    }

    camada.querySelector(".fechar").onclick = async () => {
      const v = await modal({ titulo: "Sair da lição?", texto: "O progresso desta lição será perdido.", botoes: [{ texto: "Continuar estudando", valor: false }, { texto: "Sair", classe: "secundario", valor: true }] });
      if (v) { fechar(); resolver(null); }
    };
    if (prova) { // relógio regressivo pelo horário (o tempo fora do app também conta, como numa prova de verdade)
      camada.querySelector(".fechar").onclick = async () => {
        const v = await modal({ titulo: "Sair do simulado?", texto: "As respostas deste simulado serão perdidas.", botoes: [{ texto: "Continuar o simulado", valor: false }, { texto: "Sair", classe: "secundario", valor: true }] });
        if (v) { fechar(); resolver(null); }
      };
      const fimEm = Date.now() + Math.max(0.05, prova.minutos || total) * 60000;
      const rel = document.createElement("div"); rel.className = "prova-relogio"; rel.setAttribute("aria-label", "Tempo restante");
      comboEl.replaceWith(rel);
      const tique = () => {
        const s = Math.max(0, Math.ceil((fimEm - Date.now()) / 1000));
        rel.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        rel.classList.toggle("pouco", s <= 60);
        if (s <= 0) { esgotou = true; terminar(); }
      };
      tique(); relogio = setInterval(tique, 1000);
    }
    function fechar() { clearInterval(relogio); ferr.destruir(); camada.hidden = true; camada.innerHTML = ""; camada.classList.remove("fl-marcando", "fl-desenhando"); musicaCamada(null); }

    async function proximo() {
      if (acabou) return;
      progresso();
      if (!fila.length) return terminar();
      atual = fila.shift();
      const { ex } = atual;
      corpo.innerHTML = ""; corpo.scrollTop = 0;
      const rot = document.createElement("div"); rot.className = "tipo-rotulo";
      rot.textContent = prova ? `Questão ${concluidos + 1} de ${total} · ${rotuloTipo(ex.tipo)}` : atual.tentativa > 1 ? "Erro anterior: tente de novo" : rotuloTipo(ex.tipo);
      corpo.append(rot);
      if (ex.personagem && ex.fala && atual.tentativa === 1) {
        const av = avatar(ex.personagem);
        if (av) { const f = document.createElement("div"); f.className = "fala"; f.innerHTML = `${av.svg}<div class="bolha"><b>${escapar(av.nome)}:</b> ${escapar(ex.fala)}</div>`; corpo.append(f); }
      }
      if (ex.contexto) { const c = document.createElement("div"); c.className = "contexto"; c.innerHTML = textoComEnfase(ex.contexto); corpo.append(c); }
      if (ex.imagem) {
        const img = document.createElement("img"); img.className = "figura"; img.alt = "Figura do livro";
        img.src = await urlMidia(ex.imagem); img.onerror = () => img.remove();
        if (acabou) return; // o tempo do simulado acabou enquanto a figura carregava
        img.onclick = () => ampliar(img.src);
        const dica = document.createElement("div"); dica.className = "dica-zoom"; dica.textContent = "Toque na figura para ampliar";
        corpo.append(img, dica);
      }
      const zona = document.createElement("div"); corpo.append(zona);
      rodape.className = "licao-rodape"; rodape.innerHTML = "";
      const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = prova ? "Responder" : "Verificar"; bt.disabled = true;
      tInicio = Date.now();
      comp = COMPONENTES[ex.tipo](ex, zona, { pronto: (v) => (bt.disabled = !v), concluir: (r) => avaliar(r) }, { mascote: moli("feliz") });
      if (comp.auto) { rodape.innerHTML = ""; }
      else { bt.onclick = () => avaliar(comp.verificar()); rodape.append(bt); }
      if (prova && fila.length) { // pular: a questão vai para o fim da fila
        const pular = document.createElement("button"); pular.className = "link prova-pular"; pular.textContent = "Pular por enquanto";
        pular.onclick = () => { tocar("toque"); fila.push(atual); proximo(); };
        rodape.prepend(pular);
      }
      ferr.exercicio(ex.id || `${licao.id}:${concluidos}:${fila.length}`);
    }

    function avaliar({ acertou, gabarito, detalhe, resumo, certos = 0, total: tot = 1 }) {
      const { ex, tentativa } = atual;
      if (resumo) { concluidos++; acertosPrimeira++; xp += 5; return proximo(); }
      if (prova) { // sem retorno: anota e segue (a revisão espaçada conta como a 1ª tentativa)
        if (acabou) return;
        registrarResposta(ex, licao.id, acertou, 1, Date.now() - tInicio);
        concluidos++; if (acertou) { acertosPrimeira++; xp += 10; }
        respostasProva.push({ id: ex.id, acertou: !!acertou });
        tocar("toque"); vibrar(10);
        return proximo();
      }
      registrarResposta(ex, licao.id, acertou, tentativa, Date.now() - tInicio);
      if (acertou) {
        concluidos++;
        if (tentativa === 1) { acertosPrimeira++; combo++; maiorCombo = Math.max(maiorCombo, combo); }
        let ganho = tentativa === 1 ? 10 : 5;
        if (combo >= 5 && tentativa === 1) ganho += 2;
        xp += ganho;
        tocar(combo > 0 && combo % 5 === 0 ? "combo" : "certo"); vibrar(15);
      } else {
        combo = 0;
        if (tentativa < 3) fila.push({ ex, tentativa: tentativa + 1 }); else concluidos++;
        tocar(certos > 0 ? "parcial" : "errado"); vibrar(certos > 0 ? 40 : [40, 40, 60]);
      }
      comboEl.innerHTML = combo >= 3 ? `${icone("🔥", "ico3d")}${combo}` : "";
      if (combo >= 3) { comboEl.classList.remove("pula"); void comboEl.offsetWidth; comboEl.classList.add("pula"); }
      progresso(acertou ? "acerto" : certos > 0 ? "parcial" : "erro");
      mostrarFeedback(ex, acertou, gabarito, detalhe, !acertou && certos > 0 && tot > 1 ? { certos, total: tot } : null);
    }

    function mostrarFeedback(ex, acertou, gabarito, detalhe, parcial = null) {
      const classe = acertou ? "certo" : parcial ? "parcial" : "errado";
      rodape.className = `feedback ${classe}`;
      const titulo = acertou ? sorteia(ELOGIOS) : parcial ? `Acerto parcial: ${parcial.certos} de ${parcial.total}` : sorteia(CONSOLO);
      let gab = "";
      if (!acertou && gabarito) gab = `<p class="gabarito">Resposta correta:<br>${escapar(gabarito).replace(/\n/g, "<br>")}</p>`;
      else if (!acertou && detalhe) gab = `<p class="gabarito">${escapar(detalhe)}</p>`;
      const humor = acertou ? (combo >= 3 ? "uau" : "feliz") : parcial ? "neutro" : "triste";
      rodape.innerHTML = `
        <div class="feedback-topo"><div class="reacao ${acertou ? "reage-certo" : parcial ? "" : "reage-errado"}">${moli(humor)}</div><h3>${acertou ? "✓ " : parcial ? "" : "✗ "}${titulo}</h3></div>${parcial ? `<p class="nota-parcial">Quase! Ela volta no fim da lição para você fechar.</p>` : ""}${gab}
        <p class="explic">${textoComEnfase(ex.explicacao || "")}</p>
        <div class="fonte"><span>${escapar(fonteTexto(ex.fonte))}</span><button class="reportar">Reportar questão</button></div>
        <button class="botao ${classe}">Continuar</button>`;
      rodape.querySelector(".reportar").onclick = async () => {
        const motivo = await modal({ titulo: "O que há de errado?", texto: "A tarefa da noite revisa a questão e corrige.", botoes: [
          { texto: "O gabarito está errado", valor: "gabarito", classe: "secundario" },
          { texto: "Enunciado confuso", valor: "confuso", classe: "secundario" },
          { texto: "Não está no livro", valor: "fora", classe: "secundario" },
          { texto: "Erro de digitação", valor: "digitacao", classe: "secundario" }] });
        if (motivo) { reportar(ex.id, motivo); toast("Questão reportada. Obrigado!"); }
      };
      rodape.querySelector(".botao").onclick = () => { tocar("toque"); proximo(); };
    }

    function terminar() {
      if (acabou) return;
      acabou = true; clearInterval(relogio);
      if (prova) return terminarProva();
      const perfeita = acertosPrimeira === total;
      xp += 10 + (perfeita ? 10 : 0);
      const mb = multLicao({ periodo: licao.periodo, perfeita });
      xp = Math.round(xp * mult * mb);
      const minutos = Math.max(1, Math.round((Date.now() - inicio) / 60000));
      const precisao = Math.round((acertosPrimeira / total) * 100);
      const estrelas = perfeita ? 3 : precisao >= 80 ? 2 : 1;
      const resumo = { xp, acertos: acertosPrimeira, total, perfeita, maiorCombo, minutos, periodo: licao.periodo || "" };
      const recompensa = licao.treino ? concluirLicao(`treino-${Date.now()}`, resumo) : concluirLicao(licao.id, resumo);
      const evAtivo = eventoAtivo(), moedaEv = licao.treino ? 0 : creditarEvento("licao", { perfeita });
      tocar("fim"); confete();
      ferr.fim();
      rodape.className = "licao-rodape"; rodape.innerHTML = "";
      camada.querySelector(".licao-topo").style.visibility = "hidden";
      corpo.innerHTML = `
        <div class="fim fim-licao">
          <div class="palco-fim">${RAIOS}${moli(perfeita ? "uau" : "feliz", { classe: "mascote-grande" })}</div>
          <div class="estrelas-fim">${[1, 2, 3].map(i => `<svg class="estrela-fim ${i <= estrelas ? "on" : ""}" style="--i:${i}" viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5-4.8-4.5 6.5-.8z"/></svg>`).join("")}</div>
          <h1 class="titulo-fim">${perfeita ? "Lição perfeita!" : "Lição concluída!"}</h1>
          <p>${escapar(licao.titulo)}</p>
          <div class="placar">
            <div class="p-xp">XP<b class="v-xp-fim">+0</b></div>
            <div class="p-ac">Precisão<b class="v-ac-fim">0%</b></div>
            <div class="p-t">Tempo<b>${minutos} min</b></div>
          </div>
          <p class="sub">+${recompensa.moedas} moedas${recompensa.bauMeta ? " (inclui o bônus da meta do dia)" : ""}${recompensa.gemaSorte ? ` e +1 ${icone("💎", "ico-inline")} de sorte` : ""}${mult > 1 ? `. XP multiplicado por ${mult} pela poção` : ""}${mb > 1 ? `. Bônus de companheiro e título: +${Math.round((mb - 1) * 100)}%` : ""}${moedaEv ? `. ${evAtivo.nome}: +${moedaEv} ${icone(evAtivo.moeda.icone, "ico-inline")} ${evAtivo.moeda.nome.toLowerCase()}` : ""}${maiorCombo >= 5 ? `. Maior sequência: ${maiorCombo}` : ""}.</p>
        </div>`;
      contarNumero(corpo.querySelector(".v-xp-fim"), xp, { prefixo: "+", ms: 900, atraso: 700 });
      contarNumero(corpo.querySelector(".v-ac-fim"), precisao, { sufixo: "%", ms: 900, atraso: 850 });
      for (let i = 1; i <= estrelas; i++) setTimeout(() => tocar("par"), 350 + i * 220);
      const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = "Continuar";
      rodape.append(bt);
      const bauDia = licao.treino ? null : verificarBauDoDia(licao.dia) || verificarBauBonus(licao.dia);
      bt.onclick = () => {
        if (bauDia) return telaBau();
        if (recompensa.novoDia) return telaOfensiva();
        fechar(); resolver(resumo);
      };
      function telaBau() {
        tocar("bau"); confete();
        corpo.innerHTML = htmlBauGanho(bauDia, licao.evento ? "Trilha do evento completa!" : bauDia.aba ? `Baú bônus: ${ABAS_BONUS[bauDia.aba]} completa!` : undefined);
        bt.onclick = () => { if (recompensa.novoDia) return telaOfensiva(); fechar(); resolver(resumo); };
      }
      function telaOfensiva() {
        tocar("ofensiva");
        const o = E().ofensiva;
        corpo.innerHTML = `<div class="fim">
          <svg class="chama" viewBox="0 0 24 24"><path fill="#FF7A1A" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-1-3 0-6 1-9.5z"/><path fill="#FFC24B" d="M12 11c.5 2 2.5 3 2.5 5a2.5 2.5 0 0 1-5 0c0-1.2.6-2 1.2-2.6.1 1 .6 1.5 1 1.5-.4-1.5 0-2.8.3-3.9z"/></svg>
          <div class="ofensiva-grande">${o.atual}</div>
          <h1 style="color:var(--fogo)">${o.atual === 1 ? "dia de ofensiva!" : "dias de ofensiva!"}</h1>
          <p class="sub">${o.atual % 7 === 0 ? "Você ganhou um congelamento de ofensiva." : "Volte amanhã para manter a chama acesa."}${o.gemasMarco ? ` E mais ${o.gemasMarco} ${icone("💎", "ico-inline")} pelo marco!` : ""}</p></div>`;
        bt.onclick = () => { fechar(); resolver(resumo); };
      }
    }

    function terminarProva() {
      ferr.fim();
      const seg = Math.max(1, Math.round((Date.now() - inicio) / 1000));
      const feitas = new Set(respostasProva.map(r => r.id));
      const lista = [...respostasProva, ...licao.exercicios.filter(ex => !feitas.has(ex.id)).map(ex => ({ id: ex.id, acertou: false, sem: true }))];
      const nota = Math.round((acertosPrimeira / Math.max(1, total)) * 100) / 10;
      const perfeita = acertosPrimeira === total;
      xp = Math.round((xp + 10 + (perfeita ? 10 : 0)) * mult * multLicao({ periodo: licao.periodo, perfeita }));
      const minutos = Math.max(1, Math.round(seg / 60));
      const base = { xp, acertos: acertosPrimeira, total, perfeita, maiorCombo: 0, minutos, periodo: licao.periodo || "" };
      const recompensa = concluirLicao(`treino-${Date.now()}`, base);
      const resumo = { ...base, prova: { respostas: lista, seg, nota, esgotou } };
      const erros = lista.filter(r => !r.acertou).length;
      tocar("fim"); if (nota >= 7) confete();
      rodape.className = "licao-rodape"; rodape.innerHTML = "";
      camada.querySelector(".licao-topo").style.visibility = "hidden";
      const cor = nota >= 7 ? "bom" : nota >= 5 ? "medio" : "fraco";
      const tempo = seg < 60 ? `${seg} s` : `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
      corpo.innerHTML = `
        <div class="fim fim-prova">
          <div class="prova-nota ${cor}"><b>${nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b><small>de 10</small></div>
          <h1 class="titulo-fim">${esgotou ? "Tempo esgotado" : "Simulado concluído"}</h1>
          <p>${escapar(licao.titulo)}</p>
          <div class="placar">
            <div class="p-ac">Acertos<b>${acertosPrimeira}/${total}</b></div>
            <div class="p-t">Tempo<b>${tempo}</b></div>
            <div class="p-xp">XP<b>+${xp}</b></div>
          </div>
          ${lista.some(r => r.sem) ? `<p class="sub">${lista.filter(r => r.sem).length} sem resposta (contam como erro).</p>` : ""}
          ${prova.detalhe ? prova.detalhe(lista) : ""}
          <p class="sub">+${recompensa.moedas} moedas${recompensa.gemaSorte ? ` e +1 ${icone("💎", "ico-inline")} de sorte` : ""}.</p>
        </div>`;
      const sair = (rever) => {
        if (recompensa.novoDia) return telaOfensiva(() => { fechar(); resolver({ ...resumo, rever }); });
        fechar(); resolver({ ...resumo, rever });
      };
      if (erros) {
        const bR = document.createElement("button"); bR.className = "botao secundario prova-rever"; bR.textContent = `Rever os erros (${erros})`;
        bR.onclick = () => sair(true); rodape.append(bR);
      }
      const bt = document.createElement("button"); bt.className = "botao"; bt.textContent = "Continuar";
      bt.onclick = () => sair(false); rodape.append(bt);
      function telaOfensiva(depois) {
        tocar("ofensiva"); rodape.innerHTML = "";
        corpo.innerHTML = `<div class="fim"><div class="ofensiva-grande">${E().ofensiva.atual}</div><h1 style="color:var(--fogo)">${E().ofensiva.atual === 1 ? "dia de ofensiva!" : "dias de ofensiva!"}</h1><p class="sub">Volte amanhã para manter a chama acesa.</p></div>`;
        const b = document.createElement("button"); b.className = "botao"; b.textContent = "Continuar"; b.onclick = depois; rodape.append(b);
      }
    }

    requestAnimationFrame(proximo);
  });
}
