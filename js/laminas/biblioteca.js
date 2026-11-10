// Biblioteca das lâminas digitais ("Lâminas digitais", dentro do Treino de Lâminas): as .vmic da pasta escolhida neste
// aparelho (no Android, uma pasta do cartão SD; no notebook, uma pasta pelo navegador ou arquivos avulsos), cada uma
// com a miniatura do tecido, a etiqueta escrita à mão (recortada da foto da lâmina inteira), o nome e a lesão ligada.
// Celular e tablet escolhem cada um a sua pasta; o que sincroniza é o registro por UID (registro.js).
import { escapar, toast } from "../ui.js";
import { extra } from "../dados.js";
import * as F from "./fontes.js";
import * as R from "./registro.js";
import { abrirVisor, garantirCSS, nomeLesao } from "./visor.js";

const MB = (n) => `${Math.round(n / 1048576).toLocaleString("pt-BR")} MB`;
const urls = new Map(); // Blob → URL (as miniaturas guardadas)
const urlDe = (b) => { if (!b) return ""; if (!urls.has(b)) urls.set(b, URL.createObjectURL(b)); return urls.get(b); };
const resumos = new Map(); // chave → resumo (desta sessão)

/**
 * Desenha a biblioteca em `cam.corpo` (a camada do Treino de Lâminas). `voltar`: a tela anterior.
 * Devolve { atualizar, itens } (os testes usam).
 */
export async function abrirBiblioteca(cam, { voltar } = {}) {
  await garantirCSS();
  const D = await extra("jogo:laminas").catch(() => null);
  cam.info.textContent = "";
  cam.corpo.scrollTop = 0;
  cam.corpo.innerHTML = `<div class="lam ld">
    ${voltar ? `<button class="lam-voltar">‹ Voltar</button>` : ""}
    <h2>Lâminas digitais</h2>
    <p class="lam-nota">As lâminas escaneadas da aula (arquivos .vmic). Aproxime como no microscópio, marque o que achar e ligue cada uma à lesão. Os arquivos ficam neste aparelho (ou no seu Google Drive); o nome, a lesão e as marcações vão para o outro.</p>
    <div class="ld-pasta"></div>
    <div class="ld-baixar" hidden></div>
    <div class="ld-grade"></div>
  </div>`;
  if (voltar) cam.corpo.querySelector(".lam-voltar").onclick = voltar;
  const barra = cam.corpo.querySelector(".ld-pasta"), grade = cam.corpo.querySelector(".ld-grade"), caixaBaixar = cam.corpo.querySelector(".ld-baixar");
  const estado = { itens: [] };

  async function atualizar({ pedir = false } = {}) {
    grade.innerHTML = `<p class="lam-nota">Procurando as lâminas…</p>`;
    const r = await F.listar({ pedir });
    estado.itens = r.itens;
    desenharBarra(r);
    desenharGrade(r);
    desenharBaixar(r);
  }

  // as do Drive que não estão na pasta: baixar sozinho (padrão) ou pelo botão, com o andamento e Parar
  let parouDeOuvir = null, jaPediu = false;
  async function desenharBaixar(r) {
    if (!F.podeBaixar() || !r.pasta || !r.drive) { caixaBaixar.hidden = true; return; }
    const faltam = r.itens.filter(i => i.drive);
    const st = await F.estadoDownload();
    if (!faltam.length && !st.rodando) { caixaBaixar.hidden = true; return; }
    const GB = (n) => `${(n / 1073741824).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
    const pintar = (e) => {
      caixaBaixar.hidden = false;
      if (e?.rodando) {
        const pct = e.bytesTotal ? Math.round(e.bytesFeitos * 100 / e.bytesTotal) : 0;
        caixaBaixar.innerHTML = `<p class="ld-onde"><span>⬇️</span><b>${e.fase === "esperando" ? "Esperando o Wi-Fi" : `Baixando ${Math.min((e.feitos || 0) + (e.pulados || 0) + 1, e.total || 1)} de ${e.total}`}</b><small>${pct}%</small></p>
          <div class="ld-barra"><i style="width:${pct}%"></i></div>${e.atual ? `<p class="lam-nota">${escapar(e.atual)}</p>` : ""}
          <div class="ld-botoes"><button class="botao secundario" data-b="parar">Parar</button></div>`;
        caixaBaixar.querySelector('[data-b="parar"]').onclick = () => F.pararDownload();
        return;
      }
      const total = faltam.reduce((a, i) => a + (i.tamanho || 0), 0);
      caixaBaixar.innerHTML = `<p class="ld-onde"><span>⬇️</span><b>${faltam.length} lâmina${faltam.length === 1 ? "" : "s"} só no Drive</b><small>${GB(total)}</small></p>
        ${e?.erro ? `<p class="ld-erro">${escapar(/reconectar/.test(e.erro) ? "A permissão do Google Drive venceu: conecte de novo." : e.erro)}</p>` : ""}
        <div class="ld-botoes"><button class="botao" data-b="baixar">Baixar para a pasta</button></div>
        <label class="ld-auto"><input type="checkbox" ${F.baixarSozinho() ? "checked" : ""}> Baixar sozinho as novas (no Wi-Fi)</label>`;
      caixaBaixar.querySelector('[data-b="baixar"]').onclick = () => comecar(true);
      caixaBaixar.querySelector(".ld-auto input").onchange = (ev) => F.definirBaixarSozinho(ev.target.checked);
    };
    async function comecar(pedido) {
      try { pintar(await F.baixarParaPasta(faltam)); }
      catch (e) {
        if (e.message === "sem_escrita") {
          if (pedido) toast("Escolha a pasta das lâminas de novo (a mesma serve), para o app poder gravar nela.", 5000);
          caixaBaixar.insertAdjacentHTML("beforeend", `<p class="ld-erro">Para baixar, toque em “Trocar a pasta” e escolha a mesma pasta de novo: assim o app pode gravar nela.</p>`);
        } else if (pedido) toast(`Não deu para baixar: ${e.message}`, 4500);
      }
    }
    parouDeOuvir?.();
    parouDeOuvir = F.ouvirDownload((e) => {
      if (!caixaBaixar.isConnected) { parouDeOuvir?.(); return; }
      if (e.rodando) pintar(e);
      else { parouDeOuvir?.(); parouDeOuvir = null; if (e.feitos) toast(`${e.feitos} lâmina${e.feitos === 1 ? "" : "s"} na pasta.`); atualizar(); }
    });
    pintar(st);
    if (!st.rodando && F.baixarSozinho() && !jaPediu && !st.erro) { jaPediu = true; comecar(false); }
  }

  function desenharBarra(r) {
    const n = r.itens.length;
    const botoes = [];
    if (F.nativo || F.temPastaNoNavegador()) botoes.push(`<button class="botao ${r.pasta ? "secundario" : ""}" data-b="pasta">${r.pasta ? "Trocar a pasta" : "Escolher a pasta"}</button>`);
    if (r.pasta) botoes.push(`<button class="botao secundario" data-b="atualizar">Procurar de novo</button>`);
    if (!F.nativo) botoes.push(`<label class="botao secundario ld-arq">Abrir arquivos .vmic ou .vmici<input type="file" accept=".vmic,.vmici" multiple hidden></label>`);
    const comDrive = F.nativo || F._driveFalso.arquivos.size > 0;
    if (comDrive) botoes.push(r.drive ? `<button class="botao secundario" data-b="drive-sair">Desconectar o Drive</button>` : `<button class="botao secundario" data-b="drive">Conectar o Google Drive</button>`);
    const nPasta = r.itens.filter(i => !i.drive).length;
    barra.innerHTML = `${r.pasta ? `<p class="ld-onde"><span>📁</span><b>${escapar(r.pasta.nome || "Pasta")}</b><small>${nPasta} lâmina${nPasta === 1 ? "" : "s"}</small></p>` : ""}
      ${r.drive ? `<p class="ld-onde ld-drive"><span>☁️</span><b>Google Drive${r.drive.conta ? ` · ${escapar(r.drive.conta)}` : ""}</b><small>${r.drive.n} lâmina${r.drive.n === 1 ? "" : "s"}</small></p>` : ""}
      ${r.drive?.erro ? `<p class="ld-erro">${escapar(r.drive.erro)}</p>` : ""}
      ${r.erro ? `<p class="ld-erro">${escapar(r.erro)}</p>` : ""}
      ${r.precisaPermissao ? `<p class="lam-nota">O navegador precisa da sua permissão para ler a pasta de novo.</p>` : ""}
      <div class="ld-botoes">${r.precisaPermissao ? `<button class="botao" data-b="permitir">Permitir</button>` : ""}${botoes.join("")}</div>`;
    barra.querySelector('[data-b="pasta"]')?.addEventListener("click", async () => {
      try { await F.escolherPasta(); atualizar({ pedir: true }); }
      catch (e) { if (!/cancel|abort/i.test(String(e?.message || e?.name || e))) toast("Não deu para escolher a pasta."); }
    });
    barra.querySelector('[data-b="atualizar"]')?.addEventListener("click", () => atualizar({ pedir: true }));
    barra.querySelector('[data-b="drive"]')?.addEventListener("click", async () => {
      try { await F.driveConectar(); toast("Google Drive conectado."); atualizar(); }
      catch (e) { if (e.message !== "cancelado") toast(e.message, 5000); }
    });
    barra.querySelector('[data-b="drive-sair"]')?.addEventListener("click", async () => { await F.driveDesconectar(); atualizar(); });
    if (r.drive?.erro && /Conectar de novo/.test(r.drive.erro) && !barra.querySelector('[data-b="drive"]')) {
      const b = document.createElement("button"); b.className = "botao"; b.textContent = "Conectar de novo";
      b.onclick = async () => { try { await F.driveConectar(); atualizar(); } catch (e) { if (e.message !== "cancelado") toast(e.message, 5000); } };
      barra.querySelector(".ld-botoes").prepend(b);
    }
    barra.querySelector('[data-b="permitir"]')?.addEventListener("click", () => atualizar({ pedir: true }));
    const inp = barra.querySelector(".ld-arq input");
    if (inp) inp.onchange = () => { const novos = F.adicionarArquivos(inp.files); inp.value = ""; if (!novos.length) toast("Escolha arquivos .vmic."); atualizar(); };
  }

  function desenharGrade(r) {
    if (!r.itens.length) {
      grade.innerHTML = `<div class="ld-vazio">${r.drive ? `<p>Nenhuma lâmina (.vmic ou .vmici) no Google Drive desta conta.</p>` : r.pasta
        ? `<p>Nenhuma lâmina (.vmic ou .vmici) nesta pasta nem nas subpastas.</p>`
        : F.nativo
          ? `<p>Copie as lâminas (.vmic) para uma pasta do cartão SD, por exemplo <b>Lâminas</b>, e escolha a pasta aqui. Faça o mesmo no tablet.</p>`
          : `<p>Escolha a pasta das lâminas ou abra os arquivos .vmic.</p>`}</div>`;
      return;
    }
    // os já resumidos primeiro pelo nome; os outros entram enquanto são lidos
    grade.innerHTML = "";
    for (const it of r.itens) grade.append(cartao(it));
    ordenar();
    preencher(r.itens);
  }

  function cartao(it) {
    const b = document.createElement("button"); b.className = "ld-cartao carregando"; b.dataset.chave = it.chave;
    b.innerHTML = `<span class="ld-mini"><img class="ld-tecido" alt=""><img class="ld-etiqueta" alt=""></span><b>${escapar(F.tituloDe(it))}</b><small>${MB(it.tamanho)}</small>`;
    b.onclick = () => abrirItem(it, b);
    return b;
  }
  function pintar(b, it, res) {
    const d = R.dadosDe(res.uid) || {}, n = R.marcadoresDe(res.uid).length;
    b.classList.remove("carregando");
    b.dataset.uid = res.uid;
    b.querySelector("b").textContent = d.nome || F.tituloDe(it) || res.nome;
    b.querySelector("small").textContent = [d.lesao ? nomeLesao(D, d.lesao) : "", n ? `${n} marcaç${n === 1 ? "ão" : "ões"}` : ""].filter(Boolean).join(" · ") || "Sem lesão ligada";
    const t = b.querySelector(".ld-tecido"), e = b.querySelector(".ld-etiqueta");
    if (res.tecido) t.src = urlDe(res.tecido); else t.remove();
    if (res.etiqueta) e.src = urlDe(res.etiqueta); else e.remove();
  }
  function ordenar() {
    const cs = [...grade.querySelectorAll(".ld-cartao")];
    cs.sort((a, b) => a.querySelector("b").textContent.localeCompare(b.querySelector("b").textContent, "pt-BR", { numeric: true }));
    for (const c of cs) grade.append(c);
  }
  async function preencher(itens) {
    const fila = [...itens];
    const um = async () => {
      for (let it; (it = fila.shift());) {
        const b = grade.querySelector(`.ld-cartao[data-chave="${CSS.escape(it.chave)}"]`);
        if (!b) continue;
        try {
          const res = resumos.get(it.chave) || await F.resumo(it);
          resumos.set(it.chave, res);
          if (b.isConnected) { pintar(b, it, res); ordenar(); }
        } catch (e) {
          b.classList.remove("carregando"); b.classList.add("ruim");
          b.querySelector("small").textContent = String(e?.message || "Não abriu.");
        }
      }
    };
    await Promise.all([um(), um()]);
  }

  let abrindo = false;
  async function abrirItem(it, b) {
    if (abrindo || b?.classList.contains("ruim")) return;
    abrindo = true; b?.classList.add("abrindo");
    try {
      const s = await F.abrir(it);
      await abrirVisor(s, { item: it, aoFechar: () => { const res = resumos.get(it.chave); const c = grade.querySelector(`.ld-cartao[data-chave="${CSS.escape(it.chave)}"]`); if (res && c) { pintar(c, it, res); ordenar(); } } });
    } catch (e) {
      toast(String(e?.message || "Não deu para abrir a lâmina."));
    } finally { abrindo = false; b?.classList.remove("abrindo"); }
  }

  await atualizar();
  return { atualizar, get itens() { return estado.itens; }, abrirItem: (chave) => { const it = estado.itens.find(x => x.chave === chave); return it && abrirItem(it, grade.querySelector(`.ld-cartao[data-chave="${CSS.escape(chave)}"]`)); } };
}

/** Abre a lâmina digital de uma lesão (o botão da ficha da lesão no Estudar): procura neste aparelho a lâmina com o UID
 *  ligado; se não estiver aqui, abre a biblioteca. */
export async function abrirDaLesao(cam, lesao, { voltar } = {}) {
  const uids = new Set(R.laminasDaLesao(lesao));
  const { itens } = await F.listar();
  // primeiro pelos resumos guardados; depois lendo as que ainda não foram abertas neste aparelho
  for (const ler of [false, true]) {
    for (const it of itens) {
      const res = resumos.get(it.chave) || await F.pegar(`res:${it.chave}`) || (ler ? await F.resumo(it).catch(() => null) : null);
      if (res && uids.has(res.uid)) {
        try { return await abrirVisor(await F.abrir(it), { item: it }); } catch (e) { toast(String(e?.message || "Não deu para abrir a lâmina.")); return; }
      }
    }
  }
  toast("A lâmina desta lesão não está neste aparelho. Escolha a pasta das lâminas.");
  return abrirBiblioteca(cam, { voltar });
}
