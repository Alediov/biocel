// Avatar humano do perfil: estado, compra de partes e editor.
import { E, salvar } from "./estado.js";
import { humano, PADRAO, CATALOGO, NOMES_ITENS, PELES, CORES_CABELO, CORES_OLHOS, FUNDOS, ROUPAS_COR } from "./arte/humano.js";
import { tocar } from "./sons.js";
import { modal, toast, escapar } from "./ui.js";
import { svgGema } from "./bausUI.js";
import { SAZONAIS, proximosSazonais } from "./eventos.js";
import { dataBR } from "./ui.js";
const proximo = (ev) => { const p = proximosSazonais().find(x => x.id === ev.id); return p ? `${dataBR(p.ini)} a ${dataBR(p.fim)}` : ""; };

export function av() {
  const est = E();
  est.avatar ??= { cfg: { ...PADRAO }, comprados: [], nome: "" };
  return est.avatar;
}
export const arteAvatar = (opts = {}) => humano(av().cfg, opts);
const tem = (cat, id) => (CATALOGO[cat].itens[id]?.preco || 0) === 0 || av().comprados.includes(`${cat}:${id}`);

const AMOSTRAS = { pele: PELES, corCabelo: CORES_CABELO, corOlhos: CORES_OLHOS, fundo: FUNDOS, corRoupa: ROUPAS_COR };
const ROTULO_COR = { preto: "Preto", castanho: "Castanho", mel: "Mel", loiro: "Loiro", ruivo: "Ruivo", grisalho: "Grisalho", rosa: "Rosa", azul: "Azul", roxo: "Roxo", verde: "Verde", branco: "Branco", arcoiris: "Arco-íris", violeta: "Violeta", rubi: "Rubi", menta: "Menta", areia: "Areia", lilas: "Lilás", cinza: "Cinza", noite: "Noite", aurora: "Aurora", galaxia: "Galáxia", vinho: "Vinho", dourado: "Dourado" };

let categoria = "cabelo";
let aoMudar = () => {};

export function telaAvatar(voltar, mudou = () => {}) {
  aoMudar = mudou;
  const t = document.getElementById("tela"), a = av(), est = E();
  t.innerHTML = "";
  const v = document.createElement("button"); v.className = "voltar"; v.textContent = "‹ Voltar"; v.onclick = voltar;
  t.append(v);
  const topo = document.createElement("div"); topo.className = "avatar-editor-topo";
  topo.innerHTML = `<div class="avatar-grande">${arteAvatar()}</div><p class="sub">${est.moedas} moedas e ${est.gemas || 0} gemas</p>`;
  t.append(topo);
  const cats = document.createElement("div"); cats.className = "semana cat-avatar";
  for (const [k, c] of Object.entries(CATALOGO)) {
    const b = document.createElement("button"); b.className = `dia-chip largo ${k === categoria ? "sel" : ""}`; b.textContent = c.titulo;
    b.onclick = () => { categoria = k; telaAvatar(voltar, mudou); };
    cats.append(b);
  }
  t.append(cats);
  requestAnimationFrame(() => cats.querySelector(".sel")?.scrollIntoView({ inline: "center", block: "nearest" }));

  const grade = document.createElement("div"); grade.className = "grade-avatar";
  for (const [id, item] of Object.entries(CATALOGO[categoria].itens)) {
    const possui = tem(categoria, id), usando = a.cfg[categoria] === id;
    const b = document.createElement("button"); b.className = `peca ${usando ? "usando" : ""}`;
    const amostra = AMOSTRAS[categoria]
      ? `<span class="amostra" style="background:${String(AMOSTRAS[categoria][id]).startsWith("url") ? (id === "arcoiris" ? "linear-gradient(135deg,#F07BB0,#FFE08A,#7FD6F5,#A78BFA)" : id === "dourado" ? "linear-gradient(135deg,#FFE7A3,#E09A12)" : id === "aurora" ? "linear-gradient(135deg,#FFE1EC,#DCE8FF,#C9F2E3)" : "linear-gradient(135deg,#6B4FD8,#121535)") : AMOSTRAS[categoria][id]}"></span>`
      : humano({ ...a.cfg, [categoria]: id }, { classe: "mini" });
    const preco = possui ? (usando ? "Usando" : "Seu") : item.moeda === "evento" ? "Evento" : item.moeda === "gemas" ? `${item.preco} ${svgGema()}` : `${item.preco} moedas`;
    b.innerHTML = `${amostra}<small>${escapar(NOMES_ITENS[id] || ROTULO_COR[id] || "")}</small><span class="preco ${possui ? "" : "bloq"}">${preco}</span>`;
    b.onclick = () => escolher(categoria, id, item, voltar);
    grade.append(b);
  }
  t.append(grade);
}

async function escolher(cat, id, item, voltar) {
  const a = av(), est = E();
  if (!tem(cat, id) && item.moeda === "evento") {
    const ev = SAZONAIS.find(e => e.id === item.evento);
    return toast(`Exclusivo: sai na loja do evento ${ev?.nome || ""}${ev ? ` (${proximo(ev)})` : ""}.`, 3400);
  }
  if (!tem(cat, id)) {
    const gemas = item.moeda === "gemas";
    const saldo = gemas ? (est.gemas || 0) : est.moedas;
    if (saldo < item.preco) return toast(`Faltam ${gemas ? "gemas" : "moedas"}: custa ${item.preco}.`);
    const ok = await modal({ titulo: "Comprar?", html: `<div class="avatar-grande">${humano({ ...a.cfg, [cat]: id })}</div>`, texto: `${NOMES_ITENS[id] || ROTULO_COR[id] || ""} por ${item.preco} ${gemas ? "gemas" : "moedas"}.`, botoes: [{ texto: "Comprar e usar", valor: true }, { texto: "Agora não", classe: "secundario", valor: false }] });
    if (!ok) return;
    if ((gemas ? (est.gemas || 0) : est.moedas) < item.preco) return toast(`Faltam ${gemas ? "gemas" : "moedas"}: custa ${item.preco}.`); // o saldo pode ter mudado com a janela aberta
    if (gemas) est.gemas -= item.preco; else est.moedas -= item.preco;
    a.comprados.push(`${cat}:${id}`);
    tocar(gemas ? "combo" : "moeda");
  } else tocar("toque");
  a.cfg[cat] = id;
  salvar(); aoMudar();
  telaAvatar(voltar, aoMudar);
}

/** Converte os acessórios do Moli comprados na versão anterior em itens do avatar. */
export function migrarAcessoriosAntigos() {
  const est = E(), a = av();
  if (a.migrado) return;
  const mapa = { capelo: "chapeu:capelo", touca: "chapeu:touca", coroa: "chapeu:coroa", diamante: "chapeu:diamante", aureola: "chapeu:aureola", oculos: "rosto:oculos", lupas: "rosto:lupas", mascara: "rosto:mascara", aparelho: "boca:aparelho", capa: "roupa:capa_maga" };
  for (const id of est.loja?.comprados || []) {
    if (mapa[id] && !a.comprados.includes(mapa[id])) a.comprados.push(mapa[id]);
    if (id === "jaleco") est.moedas += 150;
    if (id === "ouro") est.gemas = (est.gemas || 0) + 60;
    if (id === "cristal") est.gemas = (est.gemas || 0) + 80;
  }
  a.migrado = true; salvar();
}
