// Ícones 3D (Microsoft Fluent Emoji, licença MIT) no lugar dos emojis do sistema.
let mapa = {};
try { mapa = await (await fetch("icones/mapa.json")).json(); } catch (e) { /* sem ícones: usa o emoji */ }

const limpa = (e) => String(e || "").trim();

/** HTML de um ícone a partir do emoji. Sem correspondência, devolve o próprio emoji. */
export function icone(emoji, classe = "ico3d") {
  const e = limpa(emoji);
  const slug = mapa[e] || mapa[e.replace(/️/g, "")];
  return slug ? `<img class="${classe}" src="icones/${slug}.png" alt="${e}" draggable="false">` : `<span class="${classe} emoji">${e}</span>`;
}

/** Troca os emojis conhecidos dentro de um texto (já escapado) por ícones inline. */
export function iconesNoTexto(html) {
  return html.replace(/\p{Extended_Pictographic}️?/gu, (e) => {
    const slug = mapa[e] || mapa[e.replace(/️/g, "")];
    return slug ? `<img class="ico-inline" src="icones/${slug}.png" alt="${e}">` : e;
  });
}
