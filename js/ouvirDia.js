// "Ouvir o dia" (pedido do Alediov, 25/10/2026: estudar ouvindo no ônibus): os resumos das sessões de hoje e, em
// seguida, as unidades do dia que já estão na Leitura (livros em português), tudo em voz alta pelo tocador de voz.js.
import { hojeISO } from "./estado.js";
import { carregarDia, baixarDoRepo } from "./dados.js";


const LIVROS = [{ prefixo: "c", pasta: "conteudo/anestesiologia/malamed", nome: "Malamed" }, { prefixo: "f", pasta: "conteudo/farmacologia/andrade", nome: "Andrade" }];

async function trechosDoDia() {
  const V = await import("./voz.js"), dia = await carregarDia(hojeISO());
  if (!dia) return { trechos: [], unidades: [] };
  const trechos = [];
  for (const s of dia.sessoes || []) for (const l of s.licoes || []) for (const ex of l.exercicios || []) {
    if (ex.tipo !== "resumo") continue;
    trechos.push(...V.trechosDe(`${ex.titulo || s.titulo || "Resumo"}.`, { rotulo: s.titulo || "Resumo" }));
    for (const f of ex.frases || []) trechos.push(...V.trechosDe(f, { rotulo: ex.titulo || s.titulo }));
  }
  const unidades = (dia.unidades || []).map(id => ({ id, livro: LIVROS.find(b => id.startsWith(b.prefixo) && /^\w\d\d-\d\d$/.test(id)) })).filter(x => x.livro);
  return { trechos, unidades };
}

export async function cartaoOuvirDia(P) {
  const { trechos, unidades } = await trechosDoDia();
  if (!trechos.length && !unidades.length) return;
  const b = document.createElement("button"); b.className = "ouvir-dia";
  const V = await import("./voz.js");
  b.innerHTML = `<span class="ouv-ico">${V.ICONE_FONE}</span><span><b>Ouvir o dia</b><small>${trechos.length ? "Os resumos de hoje" : ""}${trechos.length && unidades.length ? " e " : ""}${unidades.length ? `${unidades.length} unidade${unidades.length > 1 ? "s" : ""} do livro` : ""} · bom para o ônibus</small></span>`;
  b.onclick = async () => {
    const fila = [...unidades];
    const proxima = async () => {
      const u = fila.shift(); if (!u) return null;
      try {
        const r = await baixarDoRepo(`${u.livro.pasta}/leitura/${u.id}.json`); if (!r) return proxima();
        const d = await r.json(), L = await import("./leitura/telaLeitura.js");
        return { titulo: `${u.livro.nome} · ${d.titulo}`, trechos: [{ texto: `Agora, a unidade completa: ${d.titulo}.`, rotulo: d.titulo }, ...L.trechosDaUnidade(d)], aoFim: proxima };
      } catch { return proxima(); }
    };
    if (trechos.length) V.ouvir({ titulo: "Resumos de hoje", trechos, aoFim: proxima });
    else { const p = await proxima(); if (p) V.ouvir({ titulo: p.titulo, trechos: p.trechos, aoFim: p.aoFim }); }
  };
  P.append(b);
}
