// Fotos do simulado impresso (pedido do Alediov, 09/11/2026: "ver as fotos que enviei, excluir, girar e mudar a
// ordem"). As fotos ficam no ramo `simulados-fotos`, em `respostas/<chave>/` (`01.jpg`, `02.jpg`… e `envio.json` com
// a lista `fotos`, que é a ORDEM que a correção segue, não a dos nomes). Antes da correção: ver, ampliar, girar 90°
// (só imagem: a foto é regravada girada), excluir e mudar a ordem; "Salvar" regrava as giradas, depois o envio.json
// com a ordem nova e só então apaga as excluídas (se o apagar falhar, sobra um arquivo fora da lista, que a correção
// ignora). Depois da correção a tarefa tira a pasta do ramo, então o app guarda uma cópia de cada foto que manda (e das
// que abre) neste aparelho (`arquivos` `simfoto:<chave>:<nome>`, as 40 chaves mais novas) e mostra só para ver.
import { E, salvar } from "./estado.js";
import { guardarArquivo, pegarArquivo, apagarArquivo, temToken } from "./dados.js";
import { toast, escapar } from "./ui.js";

export const RAMO = "simulados-fotos";
const MAX_CHAVES = 40, CHAVE_LOCAIS = "orbita.simulados.fotosLocais";
const S = () => (E().simulados ||= { enviados: {}, vistos: {} });

// ---------------------------------------------------------------- GitHub (ramo das fotos)
const cab = (raw) => ({
  Authorization: `Bearer ${E().config.token.trim()}`,
  Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});
const url = (cam, ref = true) => `https://api.github.com/repos/${E().config.repo.trim()}/contents/${cam}${ref ? `?ref=${RAMO}` : ""}`;
async function pedir(cam, raw) {
  const r = await fetch(url(cam), { headers: cab(raw), cache: "no-store" });
  if (r.status === 404) return null;
  if (r.status === 401 || r.status === 403) throw new Error("O GitHub recusou o acesso. Confira o token em Ajustes do Órbita.");
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  return r;
}
async function b64(blob) {
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
}
async function gravar(cam, blob, sha, msg) {
  const corpo = { message: msg, content: await b64(blob), branch: RAMO, ...(sha ? { sha } : {}) };
  const r = await fetch(url(cam, false), { method: "PUT", headers: { ...cab(), "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`Falha ao gravar ${cam} (${r.status})`);
}
async function apagar(cam, sha, msg) {
  const r = await fetch(url(cam, false), { method: "DELETE", headers: { ...cab(), "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, sha, branch: RAMO }) });
  if (!r.ok && r.status !== 404) throw new Error(`Falha ao apagar ${cam} (${r.status})`);
}

/** A pasta da chave no ramo: { envio, arquivos: {nome: sha}, shaEnvio } ou null (sem pasta: corrigida ou nunca enviada). */
export async function lerPasta(ch) {
  const r = await pedir(`respostas/${ch}`);
  if (!r) return null;
  const l = await r.json();
  if (!Array.isArray(l)) return null;
  const arquivos = Object.fromEntries(l.filter(x => x.type !== "dir").map(x => [x.name, x.sha]));
  let envio = null;
  if (arquivos["envio.json"]) envio = await (await pedir(`respostas/${ch}/envio.json`, true))?.json().catch(() => null);
  const fotos = (envio?.fotos || Object.keys(arquivos).filter(n => n !== "envio.json").sort()).filter(n => arquivos[n]);
  return { envio: envio || { chave: ch, fotos }, fotos, arquivos };
}

// ---------------------------------------------------------------- cópia neste aparelho
const idLocal = (ch, nome) => `simfoto:${ch}:${nome}`;
function locais() { try { return JSON.parse(localStorage.getItem(CHAVE_LOCAIS) || "{}"); } catch { return {}; } }
function gravarLocais(m) { try { localStorage.setItem(CHAVE_LOCAIS, JSON.stringify(m)); } catch { /* sem espaço */ } }
/** Guarda a foto neste aparelho (e esquece as das chaves mais velhas, além das 40 mais novas). */
export async function guardarLocal(ch, nome, blob) {
  await guardarArquivo(idLocal(ch, nome), blob);
  const m = locais();
  m[ch] = [...new Set([...(m[ch] || []), nome])];
  for (const velha of Object.keys(m).sort().slice(0, Math.max(0, Object.keys(m).length - MAX_CHAVES))) {
    for (const n of m[velha]) await apagarArquivo(idLocal(velha, n));
    delete m[velha];
  }
  gravarLocais(m);
}
async function esquecerLocal(ch, nome) {
  await apagarArquivo(idLocal(ch, nome));
  const m = locais();
  if (m[ch]) { m[ch] = m[ch].filter(n => n !== nome); gravarLocais(m); }
}
/** A foto: a cópia deste aparelho ou, sem ela, a do ramo (e guarda a cópia). */
async function foto(ch, nome, remoto) {
  const l = await pegarArquivo(idLocal(ch, nome));
  if (l) return l;
  if (!remoto) return null;
  const r = await pedir(`respostas/${ch}/${nome}`, true);
  if (!r) return null;
  const b = await r.blob();
  const tipo = /\.pdf$/i.test(nome) ? "application/pdf" : "image/jpeg";
  const blob = b.type === tipo ? b : new Blob([b], { type: tipo });
  await guardarLocal(ch, nome, blob).catch(() => {});
  return blob;
}
/** O próximo nome livre (o maior número + 1: depois de excluir, nunca reusa um nome que ainda pode existir). */
export function proximoNome(lista, ext) {
  const n = Math.max(0, ...lista.map(x => parseInt(x, 10)).filter(Number.isFinite));
  return `${String(n + 1).padStart(2, "0")}.${ext}`;
}

// ---------------------------------------------------------------- girar
async function girada(blob, graus) {
  const bmp = await createImageBitmap(blob);
  const deitado = graus % 180 !== 0;
  const c = document.createElement("canvas");
  c.width = deitado ? bmp.height : bmp.width; c.height = deitado ? bmp.width : bmp.height;
  const g = c.getContext("2d");
  g.translate(c.width / 2, c.height / 2); g.rotate((graus * Math.PI) / 180);
  g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.9));
}

/**
 * Salva as mudanças: `ordem` (os nomes na ordem nova, sem os excluídos), `giros` {nome: 90 | 180 | 270} e `apagar`.
 * Devolve a lista nova. Usa os sha da última leitura (`pasta`).
 */
export async function salvarFotos(ch, pasta, { ordem, giros = {}, apagar: fora = [] }) {
  for (const [nome, g] of Object.entries(giros)) {
    if (!(g % 360) || !ordem.includes(nome) || /\.pdf$/i.test(nome)) continue;
    const nova = await girada(await foto(ch, nome, true), g % 360);
    await gravar(`respostas/${ch}/${nome}`, nova, pasta.arquivos[nome], `Simulado ${ch}: ${nome} girada`);
    await guardarLocal(ch, nome, nova).catch(() => {});
  }
  const envio = { ...pasta.envio, chave: ch, fotos: ordem, editadoEm: new Date().toISOString() };
  await gravar(`respostas/${ch}/envio.json`, new Blob([JSON.stringify(envio, null, 1)], { type: "application/json" }), pasta.arquivos["envio.json"], `Simulado ${ch}: fotos reorganizadas`);
  for (const nome of fora) {
    if (pasta.arquivos[nome]) await apagar(`respostas/${ch}/${nome}`, pasta.arquivos[nome], `Simulado ${ch}: ${nome} excluída`);
    await esquecerLocal(ch, nome).catch(() => {});
  }
  const st = S(), ant = st.enviados[ch] || {};
  st.enviados[ch] = { ...ant, fotos: ordem.length, lista: ordem, quando: ant.quando || envio.quando };
  salvar();
  return ordem;
}

// ---------------------------------------------------------------- tela
const ICO = {
  esq: `<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  dir: `<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  girar: `<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lixo: `<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/**
 * Abre as fotos de um simulado. `editavel`: antes da correção (o chamador sabe); `titulo`; `aoMudar` depois de salvar;
 * `aoAdicionar(bt)`: o "Adicionar" (escolher mais fotos; devolve uma promessa).
 */
export async function abrirFotos(ch, { titulo = "Fotos", editavel = false, aoMudar, aoAdicionar } = {}) {
  const tela = document.createElement("div"); tela.className = "sim-tela sim-fotos";
  tela.innerHTML = `<header class="sim-t-cab"><button class="sim-fechar" aria-label="Fechar">✕</button><b>${escapar(titulo)}</b></header>
    <div class="sim-t-rol"><div class="sf-estado"><span class="sf-carregando">Carregando as fotos…</span></div><div class="sf-grade"></div></div>
    <div class="sf-barra" hidden><button class="botao secundario" data-a="desfazer">Desfazer</button><button class="botao" data-a="salvar">Salvar</button></div>`;
  document.body.append(tela);
  requestAnimationFrame(() => tela.classList.add("aberto"));
  const urls = new Map();
  let pasta = null, ordem = [], giros = {}, fora = [], remoto = false, pode = false;
  const fechar = () => { tela.classList.remove("aberto"); setTimeout(() => { tela.remove(); urls.forEach(u => URL.revokeObjectURL(u)); }, 250); };
  let avisou = false;
  tela.querySelector(".sim-fechar").onclick = () => {
    // com mudanças por salvar, o 1º toque avisa e o 2º sai sem salvar
    if (sujo() && !avisou) { avisou = true; toast("Mudanças não salvas: toque de novo no ✕ para sair sem salvar."); return; }
    fechar();
  };
  const sujo = () => fora.length > 0 || Object.values(giros).some(g => g % 360) || ordem.join() !== (pasta?.fotos || []).join();

  const carregar = async () => {
    pasta = null; remoto = false;
    if (temToken() && navigator.onLine) {
      try { pasta = await lerPasta(ch); remoto = !!pasta; } catch (e) { console.warn("fotos:", e.message); }
    }
    const st = S().enviados[ch];
    ordem = pasta ? [...pasta.fotos] : [...(st?.lista || locais()[ch] || [])];
    if (!pasta) pasta = { fotos: [...ordem], arquivos: {}, envio: {} };
    giros = {}; fora = [];
    pode = editavel && remoto;
    await pintar();
  };
  const pintar = async () => {
    const est = tela.querySelector(".sf-estado"), grade = tela.querySelector(".sf-grade");
    const n = ordem.length;
    let aviso = "";
    if (editavel && !remoto) aviso = temToken() && navigator.onLine ? "A correção já levou as fotos do GitHub: só para ver." : "Sem conexão com o GitHub: só para ver.";
    est.innerHTML = `<span class="sf-cont"><b>${n}</b> foto${n === 1 ? "" : "s"}</span>
      <span class="sf-sit ${pode ? "edita" : "ver"}">${pode ? "Antes da correção" : editavel ? "Só ver" : "Corrigido"}</span>
      ${pode && aoAdicionar ? `<button class="link" data-a="mais">+ Adicionar</button>` : ""}
      ${aviso ? `<small class="sf-aviso">${aviso}</small>` : ""}`;
    est.querySelector('[data-a="mais"]')?.addEventListener("click", async (ev) => {
      if (sujo()) { toast("Salve ou desfaça as mudanças antes de adicionar."); return; }
      await aoAdicionar(ev.currentTarget); await carregar(); aoMudar?.();
    });
    if (!n) { grade.innerHTML = `<p class="sim-vazio">${pode || remoto ? "Nenhuma foto." : "As fotos não estão neste aparelho."}</p>`; barra(); return; }
    grade.innerHTML = ordem.map((nome, i) => `<figure class="sf-foto" data-nome="${escapar(nome)}">
        <button class="sf-img" data-a="ver" aria-label="Ampliar a foto ${i + 1}"><span class="sf-n">${i + 1}</span><i class="sf-ph"></i></button>
        ${pode ? `<figcaption class="sf-ferr">
          <button data-a="esq" aria-label="Para antes" ${i === 0 ? "disabled" : ""}>${ICO.esq}</button>
          <button data-a="girar" aria-label="Girar" ${/\.pdf$/i.test(nome) ? "disabled" : ""}>${ICO.girar}</button>
          <button data-a="lixo" aria-label="Excluir">${ICO.lixo}</button>
          <button data-a="dir" aria-label="Para depois" ${i === n - 1 ? "disabled" : ""}>${ICO.dir}</button></figcaption>` : ""}</figure>`).join("");
    for (const fig of grade.querySelectorAll(".sf-foto")) {
      const nome = fig.dataset.nome, i = ordem.indexOf(nome);
      const caixa = fig.querySelector(".sf-ph");
      mostrar(caixa, nome);
      fig.querySelector('[data-a="ver"]').onclick = () => ampliar(i);
      if (!pode) continue;
      fig.querySelector('[data-a="esq"]').onclick = () => { [ordem[i - 1], ordem[i]] = [ordem[i], ordem[i - 1]]; pintar(); };
      fig.querySelector('[data-a="dir"]').onclick = () => { [ordem[i + 1], ordem[i]] = [ordem[i], ordem[i + 1]]; pintar(); };
      fig.querySelector('[data-a="girar"]').onclick = () => { giros[nome] = ((giros[nome] || 0) + 90) % 360; aplicarGiro(caixa, nome); barra(); };
      fig.querySelector('[data-a="lixo"]').onclick = () => { ordem = ordem.filter(x => x !== nome); fora.push(nome); pintar(); };
    }
    barra();
  };
  const aplicarGiro = (caixa, nome) => {
    const g = giros[nome] || 0;
    caixa.style.transform = g ? `rotate(${g}deg)${g % 180 ? " scale(.75)" : ""}` : "";
  };
  const mostrar = async (caixa, nome) => {
    try {
      if (!urls.has(nome)) {
        const b = await foto(ch, nome, remoto);
        if (!b) { caixa.classList.add("falta"); return; }
        urls.set(nome, URL.createObjectURL(b));
        urls.set(`${nome}#pdf`, b.type === "application/pdf" ? "1" : "");
      }
      if (urls.get(`${nome}#pdf`)) { caixa.classList.add("pdf"); caixa.textContent = "PDF"; return; }
      caixa.style.backgroundImage = `url("${urls.get(nome)}")`;
      aplicarGiro(caixa, nome);
    } catch (e) { caixa.classList.add("falta"); console.warn("foto:", e.message); }
  };
  const barra = () => { tela.querySelector(".sf-barra").hidden = !sujo(); };
  tela.querySelector('[data-a="desfazer"]').onclick = () => { ordem = [...pasta.fotos]; giros = {}; fora = []; pintar(); };
  tela.querySelector('[data-a="salvar"]').onclick = async (ev) => {
    const bt = ev.currentTarget, t = bt.textContent;
    if (!ordem.length) { toast("Deixe pelo menos uma foto (ou mande outras antes de excluir todas)."); return; }
    bt.disabled = true; bt.textContent = "Salvando…";
    try {
      await salvarFotos(ch, pasta, { ordem, giros, apagar: fora });
      for (const nome of Object.keys(giros)) { URL.revokeObjectURL(urls.get(nome) || ""); urls.delete(nome); }
      toast("Fotos salvas. A correção segue esta ordem.");
      await carregar(); aoMudar?.();
    } catch (e) { toast(e.message, 4500); } finally { bt.disabled = false; bt.textContent = t; }
  };

  // ampliar: a foto inteira, com a giro que está para salvar; ‹ › passam
  const ampliar = (i) => {
    const v = document.createElement("div"); v.className = "sf-visor";
    const pinta = () => {
      const nome = ordem[i], g = giros[nome] || 0, pdf = urls.get(`${nome}#pdf`);
      v.innerHTML = `<button class="sf-v-x" aria-label="Fechar">✕</button><span class="sf-v-n">${i + 1} de ${ordem.length}</span>
        ${pdf ? `<a class="botao" href="${urls.get(nome)}" target="_blank" rel="noopener">Abrir o PDF</a>` : `<img alt="Foto ${i + 1}" src="${urls.get(nome) || ""}" style="${g ? `transform:rotate(${g}deg)` : ""}" class="${g % 180 ? "deitada" : ""}">`}
        <button class="sf-v-esq" aria-label="Anterior" ${i === 0 ? "hidden" : ""}>${ICO.esq}</button><button class="sf-v-dir" aria-label="Próxima" ${i === ordem.length - 1 ? "hidden" : ""}>${ICO.dir}</button>`;
      v.querySelector(".sf-v-x").onclick = () => v.remove();
      v.querySelector(".sf-v-esq").onclick = (e) => { e.stopPropagation(); i--; pinta(); };
      v.querySelector(".sf-v-dir").onclick = (e) => { e.stopPropagation(); i++; pinta(); };
    };
    pinta();
    v.addEventListener("click", (e) => { if (e.target === v) v.remove(); });
    tela.append(v);
  };
  await carregar();
  return tela;
}

/** Para o enviar do simulado.js: a lista que vale (a do ramo, se outro aparelho mexeu) e o próximo nome. */
export async function listaAtual(ch) {
  try { const p = temToken() && navigator.onLine ? await lerPasta(ch) : null; if (p) return p.fotos; } catch { /* usa a guardada */ }
  return S().enviados[ch]?.lista || [];
}
