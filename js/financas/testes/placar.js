// Testes de mercado → Placar (pedido do Alediov, 03/11/2026; o novo começo da aba Testes): uma linha por forma no seu
// jeito padrão (ao vivo, desde o começo), do maior % ao mês para o menor, com a faixa, o semáforo, o risco e "medindo há
// N dias"; o copy trading entra com a carteira de carteiras em 3× · 1 min (o mesmo número de Como está indo); embaixo,
// CDI e poupança no mesmo formato. Tocar numa linha abre a forma.
import { escapar } from "../../ui.js";
import { icone } from "../../icones.js";
import * as K from "./calculo.js";
import { secao, q, pct, pctMes, NOME_SEMAFORO } from "./comum.js";
import { resumoCopia, seloRisco } from "./subabas.js";
import * as F from "./formas.js";

const CURTO_SEMAFORO = { ganhando: "ganhando do CDI", perdendo: "perdendo do CDI", cedo: "cedo para saber" };

/** As linhas do Placar (sem DOM): [{ forma, nome, versao, e, t, sem, risco, frente }], ordenadas. */
export function linhasDoPlacar(d, p) {
  const out = [];
  const rc = resumoCopia(d, "3x1");
  if (rc) out.push({ forma: "copia", nome: "Copy trading", versao: `${rc.cc.n} ${rc.cc.n === 1 ? "carteira" : "carteiras"} · ${K.nomeJeito("3x1")}`, e: rc.e, t: rc.cc, sem: rc.sem, risco: rc.risco, frente: rc.frente });
  for (const k of F.formasPresentes(p)) {
    const f = p.formas[k], v = F.versaoPadrao(f), r = v && F.resumoVersao(p, f, v);
    if (!r) { out.push({ forma: k, nome: F.nomeForma(p, k), versao: v?.nome || "", e: null, t: null, sem: "cedo", risco: v?.risco || "médio", frente: false }); continue; }
    out.push({ forma: k, nome: F.nomeForma(p, k), versao: v.nome, e: r.e, t: r.t, sem: r.sem, risco: r.risco, frente: r.frente });
  }
  return out.sort((a, b) => F.valorOrdem(b.e, b.t) - F.valorOrdem(a.e, a.t));
}

/** `ctx` = { d, p, abrirForma(k), rodape(el), carregandoPapel, erroPapel }. */
export function telaPlacar(el, ctx) {
  const { d, p } = ctx;
  const linhas = linhasDoPlacar(d, p);
  const s = secao(el, `Placar ${q("placar")}`, "cada forma no jeito padrão · ao vivo", "fi-ts-placar");
  if (!linhas.length) {
    s.insertAdjacentHTML("beforeend", `<p class="fi-dica">${ctx.carregandoPapel ? "Buscando os testes…" : ctx.erroPapel || "Sem dados dos testes ainda."}</p>`);
  }
  const ol = document.createElement("ol"); ol.className = "fi-ts-placar-lista";
  linhas.forEach((x, i) => {
    const li = document.createElement("li"); li.setAttribute("role", "button"); li.tabIndex = 0; li.dataset.forma = x.forma;
    li.className = `fi-ts-placar-l ${x.sem}`;
    const e = x.e, faixa = e && !e.cedo && e.faixaMes ? `faixa ${pctMes(e.faixaMes[0])} a ${pctMes(e.faixaMes[1])}` : null;
    const medindo = e ? `medindo há ${e.dias} ${e.dias === 1 ? "dia" : "dias"}` : "sem dias medidos";
    li.innerHTML = `<span class="pos">${i + 1}º</span>
      <span class="tx"><span class="cab">${icone(F.ICONE_FORMA[x.forma] || "🧪", "ico-inline")}<b>${escapar(x.nome)}</b><small>· ${escapar(x.versao)}</small></span>
        <strong class="${(e?.mes ?? e?.periodo ?? 0) > 0 ? "ts-sobe" : (e?.mes ?? e?.periodo ?? 0) < 0 ? "ts-desce" : ""}">${F.textoCurto(e, x.t)}</strong>
        <small>${[faixa, medindo].filter(Boolean).join(" · ")}</small>
        <span class="sinais"><i class="fi-ts-sem ${x.sem}" title="${escapar(NOME_SEMAFORO[x.sem])}"></i><em>${CURTO_SEMAFORO[x.sem]}</em>${seloRisco(x.risco)}</span></span>
      <svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const ir = () => ctx.abrirForma(x.forma);
    li.onclick = ir; li.onkeydown = (ev) => { if (ev.key === "Enter") ir(); };
    ol.append(li);
  });
  s.append(ol);
  // as réguas: CDI e poupança no mesmo formato
  const cdi = K.cdiTaxas(p ? F.refsDe(p) : d);
  s.insertAdjacentHTML("beforeend", `<ul class="fi-ts-placar-refs">
    <li><span>CDI ${q("cdi")}</span><b>${pct(cdi.mes, 2)} ao mês</b><small>${pct(cdi.ano, 1)} ao ano</small></li>
    <li><span>Poupança ${q("poupanca")}</span><b>${pct(K.POUPANCA_MES, 1)} ao mês</b><small>${pct(K.POUPANCA_ANO, 1)} ao ano</small></li></ul>
    <p class="fi-dica">O semáforo só sai de "cedo" com 14 dias ou mais e a faixa toda acima (ou abaixo) do CDI. ${q("faixa")} ${q("risco")}</p>`);
  if (ctx.carregandoPapel && !p) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">Buscando as outras formas…</p>`);
  else if (ctx.erroPapel && !p) s.insertAdjacentHTML("beforeend", `<p class="fi-dica">As outras formas: ${escapar(ctx.erroPapel)}</p>`);
  ctx.rodape(el);
}
