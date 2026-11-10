// Pausar a leitura do computador pelo celular (29/10/2026, pedido do Alediov: uma plaquinha no computador do laboratório
// com o telefone dele; se alguém precisar usar o computador fora do horário, ele pausa daqui). Dois arquivos pequenos no
// repositório, sem nada das fichas:
//   progresso/odontoscan/controle.json  {pausa, ate, em, por}  ← escrito aqui (ou pelo pausar.bat do computador)
//   progresso/odontoscan/leitor.json    {estado, atualizado, temp, lidas_hoje, na_fila, pausa_ate, motivo…} ← o leitor.py
// O leitor relê a pausa a cada minuto, entre uma ficha e outra, e tira o modelo da placa de vídeo enquanto pausado.
export const CAMINHO_CONTROLE = "progresso/odontoscan/controle.json";
export const CAMINHO_LEITOR = "progresso/odontoscan/leitor.json";
const REPO = "Alediov/odonto-quest";

const b64 = (s) => { const u = new TextEncoder().encode(s); let x = ""; for (const c of u) x += String.fromCharCode(c); return btoa(x); };
const de64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(String(s || "").replace(/\s/g, "")), c => c.charCodeAt(0)));

async function ler(g, caminho) {
  const r = await fetch(`https://api.github.com/repos/${g.repo || REPO}/contents/${caminho}`, { cache: "no-store", headers: { Authorization: `Bearer ${g.token}`, Accept: "application/vnd.github+json" } });
  if (r.status === 404) return { dados: null, sha: null };
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const j = await r.json();
  return { dados: JSON.parse(de64(j.content) || "null"), sha: j.sha };
}
async function gravar(g, caminho, obj, msg) {
  for (let t = 0; t < 3; t++) {
    const { sha } = await ler(g, caminho);
    const r = await fetch(`https://api.github.com/repos/${g.repo || REPO}/contents/${caminho}`, {
      method: "PUT", headers: { Authorization: `Bearer ${g.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, content: b64(JSON.stringify(obj, null, 1)), ...(sha ? { sha } : {}) }),
    });
    if (r.ok) return true;
    if (r.status !== 409 && r.status !== 422) throw new Error(`GitHub ${r.status}`);
  }
  throw new Error("o GitHub recusou (conflito)");
}

/** O que mostrar: { controle, leitor } (cada um pode ser null). */
export async function lerSituacao(g) {
  const [c, l] = await Promise.all([ler(g, CAMINHO_CONTROLE), ler(g, CAMINHO_LEITOR)]);
  return { controle: c.dados, leitor: l.dados };
}
/** Pausa por `horas` (0 = até retomar). */
export function pausar(g, horas) {
  const ate = horas ? new Date(Date.now() + horas * 3600e3).toISOString() : null;
  return gravar(g, CAMINHO_CONTROLE, { pausa: true, ate, em: new Date().toISOString(), por: "celular" }, "OdontoScan: pausa da leitura pelo celular");
}
export const retomar = (g) => gravar(g, CAMINHO_CONTROLE, { pausa: false, em: new Date().toISOString(), por: "celular" }, "OdontoScan: leitura retomada pelo celular");

/** A pausa pedida ainda vale? */
export function pausaAtiva(c, agora = Date.now()) {
  return !!(c?.pausa && (!c.ate || new Date(c.ate).getTime() > agora));
}

const hm = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = (iso) => { const d = new Date(iso), h = new Date(); return d.toDateString() === h.toDateString() ? "hoje" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
const ha = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };
const MOTIVO = { "fim do horário": "fora do horário", "fila vazia": "acabaram as fichas", "placa quente demais": "a placa de vídeo não esfriou", "pouco espaço no disco": "pouco espaço no disco", "falhas seguidas": "muitas fichas sem leitura", "Ollama parou": "o Ollama parou" };

// ---------- aviso quando a leitura para por um problema (29/10/2026, sugestão aceita pelo Alediov) ----------
const PROBLEMAS = { "Ollama parou": "o Ollama (o programa do modelo) parou de responder", "placa quente demais": "a placa de vídeo esquentou e não esfriou em 45 min (confira a ventilação)", "pouco espaço no disco": "acabou o espaço no disco", "falhas seguidas": "muitas fichas seguidas sem leitura (rode o testar.bat)" };
/** Um problema no leitor (null se está tudo bem): { chave, titulo, texto }. "Sem notícia": lendo ou pausado e sem
 *  notícia há mais de 90 min (o leitor avisa pelo menos a cada 10 min; uma queda de luz ou o computador travado). */
export function problemaDoLeitor({ leitor } = {}, agora = Date.now()) {
  if (!leitor?.atualizado) return null;
  const quando = new Date(leitor.atualizado).getTime(), idade = agora - quando;
  if (leitor.estado === "parado" && PROBLEMAS[leitor.motivo] && idade < 4 * 864e5)
    return { chave: `${leitor.atualizado}|${leitor.motivo}`, titulo: "A leitura das fichas parou", texto: `Parou ${dia(leitor.atualizado)} às ${hm(leitor.atualizado)}: ${PROBLEMAS[leitor.motivo]}.` };
  if ((leitor.estado === "lendo" || leitor.estado === "pausado") && idade > 90 * 60e3 && idade < 4 * 864e5)
    return { chave: `${leitor.atualizado}|sumiu`, titulo: "O computador do laboratório sumiu", texto: `Estava ${leitor.estado === "lendo" ? "lendo" : "pausado"} e não dá notícia desde ${dia(leitor.atualizado)} às ${hm(leitor.atualizado)} (queda de luz, computador travado ou sem internet).` };
  return null;
}

/** O texto da situação do computador. */
export function textoSituacao({ controle, leitor }) {
  const pausa = pausaAtiva(controle);
  if (!leitor) return { cls: "", txt: pausa ? `Pausa pedida${controle.ate ? ` até ${hm(controle.ate)}` : " até você retomar"}. O computador ainda não deu notícia (ele precisa do token do resumo, na aba IA).` : "O computador ainda não deu notícia. Ele avisa aqui quando ler com o token do resumo (aba IA do computador)." };
  const velho = Date.now() - new Date(leitor.atualizado) > 25 * 60000;
  const quando = `${dia(leitor.atualizado)} ${hm(leitor.atualizado)}`;
  if (leitor.estado === "pausado" && !velho) return { cls: "pausa", txt: `Pausado${leitor.pausa_ate ? ` até ${hm(leitor.pausa_ate)}` : ""}${leitor.pausa_por === "computador" ? " (pausado no computador)" : ""}. O computador está livre. Notícia ${ha(leitor.atualizado)}.` };
  if (leitor.estado === "lendo" && !velho) return { cls: "lendo", txt: `Lendo${leitor.lidas_hoje != null ? `: ${leitor.lidas_hoje} ${leitor.lidas_hoje === 1 ? "ficha" : "fichas"} neste dia de leitura` : ""}${leitor.temp != null ? ` · placa até ${leitor.temp} °C` : ""}.${pausa ? " A pausa chega em até 2 min." : ""} Notícia ${ha(leitor.atualizado)}.` };
  if (leitor.estado === "parado") return { cls: "", txt: `Parado desde ${quando}${leitor.motivo ? ` (${MOTIVO[leitor.motivo] || leitor.motivo})` : ""}.${pausa ? " A pausa já vale para quando ele voltar." : ""}` };
  return { cls: "velho", txt: `Sem notícia desde ${quando} (computador desligado, sem internet ou fora do horário).${pausa ? " A pausa vale quando ele voltar." : ""}` };
}

/** O cartão "Computador do laboratório" (celular), dentro de `el`. `g`: { token, repo } do app; `aviso(msg)`. */
export async function cartaoControle(el, g, aviso = () => {}) {
  if (!g?.token) { el.innerHTML = ""; return; }
  let s;
  try { s = await lerSituacao(g); } catch (e) { el.innerHTML = `<section class="os-cartao os-ctl"><h3>Computador do laboratório</h3><p class="os-sub">Não consegui ver a situação (${e.message}).</p></section>`; return; }
  const pausa = pausaAtiva(s.controle), t = textoSituacao(s), prob = problemaDoLeitor(s);
  el.innerHTML = `<section class="os-cartao os-ctl ${prob ? "problema" : t.cls}">
      <h3><i class="os-ctl-luz" aria-hidden="true"></i>Computador do laboratório</h3>
      ${prob ? `<p class="os-sub os-ctl-prob"><b>${prob.titulo}.</b> ${prob.texto} O que faltou fica para a próxima leitura; se o problema continuar, confira o computador.</p>` : ""}
      <p class="os-sub">${t.txt}</p>
      ${pausa ? `<p class="os-sub"><b>Pausa pedida${s.controle.ate ? ` até ${dia(s.controle.ate)} ${hm(s.controle.ate)}` : " até você retomar"}</b>${s.controle.por === "computador" ? " (no computador)" : ""}.</p>
        <div class="os-botoes"><button class="os-botao" data-ctl="retomar">Retomar a leitura</button></div>`
      : `<p class="os-sub">Alguém precisa usar o computador? Pause a leitura: ele solta a placa de vídeo em até 2 minutos.</p>
        <div class="os-botoes os-ctl-bot"><button class="os-botao sec" data-ctl="1">Pausar 1 h</button><button class="os-botao sec" data-ctl="3">Pausar 3 h</button><button class="os-botao sec" data-ctl="0">Até eu retomar</button></div>`}
    </section>`;
  el.querySelectorAll("[data-ctl]").forEach(b => (b.onclick = async () => {
    el.querySelectorAll("[data-ctl]").forEach(x => (x.disabled = true));
    try {
      if (b.dataset.ctl === "retomar") { await retomar(g); aviso("Leitura retomada: ela volta no horário dela."); }
      else { const h = +b.dataset.ctl; await pausar(g, h); aviso(h ? `Pausado por ${h} h.` : "Pausado até você retomar."); }
    } catch (e) { aviso(`Não deu: ${e.message}`); }
    cartaoControle(el, g, aviso);
  }));
}
