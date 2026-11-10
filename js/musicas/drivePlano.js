// Backup das músicas no Google Drive (pedido do Alediov, 02/11/2026): o que mandar desta vez. Puro (sem tela, sem
// plugin), para o teste no node (tools/musicas/teste_drive.mjs).
//
// O mapa (guardado só no aparelho, pelo plugin DriveMusicas) diz o que já está no Drive: { arquivos: { caminho:
// { id, t, m, em } } }, com o caminho relativo à pasta das músicas ("Anny/Lua.mp3", ".orbita/biblioteca.json"),
// o tamanho (t) e a data (m) do arquivo quando foi enviado. Desta vez vão:
//   - novo: o caminho não está no mapa;
//   - mudou: está, mas o tamanho ou a data mudaram (estrelas e tags gravadas no arquivo também contam): o mesmo id é
//     atualizado no Drive;
//   - mover: o arquivo só mudou de lugar ou de nome (o caminho velho sumiu e há um só arquivo novo com o mesmo tamanho
//     e a mesma extensão): no Drive, só troca o nome e a pasta, sem mandar de novo;
//   - apagar (só com "espelhar apagados", desligado por padrão): o que sumiu do celular sai do Drive. Nunca com a
//     biblioteca vazia (cartão fora do lugar) nem quando sumiria mais de 25% do que já foi (aviso "muitos").
// Os extras (a biblioteca.json da pasta .orbita: estrelas, playlists, tags) vão quando a data deles muda.

const ext = (c) => { const m = /\.[^./]+$/.exec(c || ""); return m ? m[0].toLowerCase() : ""; };

/**
 * @param {{ faixas: {id, caminho, tamanho, modificado}[], mapa?: { arquivos?: object }, extras?: {caminho, m, t?, uri?}[],
 *           opcoes?: { espelharApagados?: boolean } }} o
 * @returns {{ itens: object[], apagar: {caminho, id}[], bytes: number, avisos: string[] }}
 */
export function planoBackup({ faixas = [], mapa = {}, extras = [], opcoes = {} } = {}) {
  const arq = mapa?.arquivos || {};
  const itens = [], avisos = [], agora = new Map();
  for (const f of faixas) if (f?.caminho && !agora.has(f.caminho)) agora.set(f.caminho, f);
  const novos = [];
  for (const [c, f] of agora) {
    const t = f.tamanho || 0, m = f.modificado || 0, r = arq[c];
    if (!r?.id) { novos.push(f); continue; }
    if (r.t !== t || r.m !== m) itens.push({ tipo: "mudou", caminho: c, uri: f.id, t, m, id: r.id });
  }
  // o que estava no Drive e não está mais aqui (nem é um extra; nada de pasta com ponto, como a .orbita)
  const extrasC = new Set(extras.map(x => x.caminho));
  const sumidos = Object.keys(arq).filter(c => arq[c]?.id && !agora.has(c) && !extrasC.has(c) && !c.startsWith("."));
  // mudou de lugar ou de nome: o mesmo tamanho e a mesma extensão, um só de cada lado
  const chave = (c, t) => `${t}|${ext(c)}`;
  const porChaveSumido = new Map(), porChaveNovo = new Map();
  for (const c of sumidos) { const k = chave(c, arq[c].t || 0); porChaveSumido.set(k, [...(porChaveSumido.get(k) || []), c]); }
  for (const f of novos) { const k = chave(f.caminho, f.tamanho || 0); porChaveNovo.set(k, [...(porChaveNovo.get(k) || []), f]); }
  const movidos = new Set();
  for (const f of novos) {
    const k = chave(f.caminho, f.tamanho || 0), de = porChaveSumido.get(k), para = porChaveNovo.get(k);
    if ((f.tamanho || 0) > 0 && de?.length === 1 && para?.length === 1) {
      itens.push({ tipo: "mover", caminho: f.caminho, uri: f.id, t: f.tamanho || 0, m: f.modificado || 0, id: arq[de[0]].id, de: de[0] });
      movidos.add(de[0]);
    } else itens.push({ tipo: "novo", caminho: f.caminho, uri: f.id, t: f.tamanho || 0, m: f.modificado || 0 });
  }
  for (const x of extras) {
    if (!x?.caminho) continue;
    const r = arq[x.caminho], m = x.m || 0;
    if (!r?.id) itens.push({ tipo: "novo", caminho: x.caminho, ...(x.uri ? { uri: x.uri } : {}), t: x.t || 0, m, extra: true });
    else if (r.m !== m) itens.push({ tipo: "mudou", caminho: x.caminho, ...(x.uri ? { uri: x.uri } : {}), t: x.t || 0, m, id: r.id, extra: true });
  }
  // apagados (opção): nunca com a biblioteca vazia nem quando seriam muitos
  let apagar = [];
  const orfaos = sumidos.filter(c => !movidos.has(c));
  if (opcoes.espelharApagados && orfaos.length) {
    const noMapa = Object.keys(arq).length;
    if (!agora.size) avisos.push("vazia");
    else if (orfaos.length > Math.max(20, noMapa * 0.25)) avisos.push("muitos");
    else apagar = orfaos.map(c => ({ caminho: c, id: arq[c].id }));
  }
  // a biblioteca.json (pequena e importante) primeiro; depois, pela pasta
  itens.sort((a, b) => (b.extra ? 1 : 0) - (a.extra ? 1 : 0) || a.caminho.localeCompare(b.caminho));
  const bytes = itens.reduce((s, i) => s + (i.tipo === "mover" ? 0 : i.t || 0), 0);
  return { itens, apagar, bytes, avisos, orfaos: orfaos.length };
}

/** Quanto já está no Drive (pelo mapa) e quanto falta (pelo plano). */
export function resumoBackup(mapa = {}, plano = null) {
  const arq = Object.values(mapa?.arquivos || {}).filter(r => r?.id);
  return {
    noDrive: arq.length,
    bytesNoDrive: arq.reduce((s, r) => s + (r.t || 0), 0),
    faltam: plano ? plano.itens.length + plano.apagar.length : null,
    bytesFaltam: plano ? plano.bytes : null,
  };
}

/** "1,2 GB", "350 MB", "0 MB". */
export function tamanho(b) {
  if (!b) return "0 MB";
  if (b >= 1e9) return `${(b / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  return `${Math.max(1, Math.round(b / 1e6)).toLocaleString("pt-BR")} MB`;
}

// O que cabe no Drive (pergunta do Alediov, 04/11/2026: 1.209 músicas num Drive gratuito de 15 GB): o plano vai até o
// espaço livre menos uma folga de 300 MB; o que não cabe fica para quando houver espaço (e a tela avisa).
const FOLGA_DRIVE = 300 * 1048576;
export function cortarPeloEspaco(plano, cota) {
  if (!cota?.limite) return { plano, cortadas: 0, bytesFora: 0 };
  let livre = cota.limite - (cota.usado || 0) - FOLGA_DRIVE, usados = 0;
  const itens = [], fora = [];
  for (const it of plano.itens) {
    const b = it.tipo === "mover" ? 0 : it.t || 0;
    if (usados + b <= livre || it.extra) { itens.push(it); usados += b; } else fora.push(it);
  }
  return { plano: { ...plano, itens, bytes: usados }, cortadas: fora.length, bytesFora: fora.reduce((s, i) => s + (i.t || 0), 0) };
}
