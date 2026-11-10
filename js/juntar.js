// Junção de três versões do estado do app (base, deste aparelho e do outro), usada pela sincronia.js. Sem dependências,
// para dar para testar no node (tools/teste_juntar.mjs).
export const clonar = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
function estavel(x) {
  if (Array.isArray(x)) return `[${x.map(estavel).join(",")}]`;
  if (x && typeof x === "object") return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${estavel(x[k])}`).join(",")}}`;
  return JSON.stringify(x === undefined ? null : x);
}
export const igual = (a, b) => estavel(a) === estavel(b);
const ehObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const DATAS = ["quando", "em", "ultima", "atualizado"];
const dataDe = (o) => { for (const k of DATAS) if (typeof o?.[k] === "string") return o[k]; return null; };
const MAXIMO = /^(recorde|nivel|max|melhor|rec|acum)/i; // acum: produção de um vaso do jardim (o tempo regado, contado pelo relógio nos dois)
// Registros de nível + cópias (cartas da Coleção, plantas do Jardim): evoluir troca cópias por nível. Se os dois
// aparelhos evoluíram a mesma carta desde a base, somar o que cada um "gastou" de cópias tiraria as cópias duas vezes
// (cópias negativas). Nesses registros a conta é pelo total de cópias recebidas (cópias + as investidas no nível):
// os ganhos dos dois somam, o nível fica o maior e as cópias são o que sobra. `investido(id, nivel)` vem da colecao.js e
// da jardim.js (definirNiveis), para este arquivo continuar sem dependências.
const NIVEIS = [];
/** `re`: caminho do registro (ex.: /^colecao\.cartas\.([^.]+)$/); `investido(id, nivel)`: cópias gastas do nível 1 até ele. */
export function definirNiveis(re, investido) { if (!NIVEIS.some(n => String(n.re) === String(re))) NIVEIS.push({ re, investido }); }
const ehNC = (x) => ehObj(x) && Number.isInteger(x.nivel) && Number.isInteger(x.copias);
function regraNivel(caminho) { for (const n of NIVEIS) { const m = caminho.match(n.re); if (m) return (nv) => n.investido(m[1], nv) || 0; } return null; }
/** Lista de registros com `id` único e sem data própria? */
function comIds(l) {
  const vistos = new Set();
  for (const x of l) {
    if (!ehObj(x) || !(typeof x.id === "string" || typeof x.id === "number") || vistos.has(x.id) || dataDe(x)) return false;
    vistos.add(x.id);
  }
  return true;
}

/** Junta três versões. `localNovo`: este aparelho mudou por último (desempate do que não dá para juntar). */
export function juntar(base, local, remoto, localNovo, caminho = "", temBase = base !== undefined) {
  const j = juntar1(base, local, remoto, localNovo, caminho, temBase);
  if (!caminho && temBase && ehObj(j)) desfazerReparosDuplos(base, local, remoto, j);
  return j;
}
function juntar1(base, local, remoto, localNovo, caminho, temBase) {
  if (base !== undefined && igual(base, local)) return clonar(remoto);
  if (base !== undefined && igual(base, remoto)) return clonar(local);
  // contador que os dois mudaram, mesmo que tenha dado o mesmo número (3 moedas aqui e 3 lá são 6)
  if (typeof base === "number" && typeof local === "number" && typeof remoto === "number" && !MAXIMO.test(caminho.split(".").pop())
    && [base, local, remoto].every(v => Number.isInteger(v) && Math.abs(v) < 1e9)) return somar(base, local, remoto);
  if (igual(local, remoto) && !(ehObj(local) && ehObj(base))) return clonar(local); // objetos iguais ainda podem ter contadores mudados nos dois
  if (local === undefined) return clonar(remoto);
  if (remoto === undefined) return clonar(local);
  const chave = caminho.split(".").pop();
  if (caminho === "baus.slots" && Array.isArray(local) && Array.isArray(remoto)) return juntarSlots(base, local, remoto, localNovo);
  if (caminho === "ofensiva" && ehObj(local) && ehObj(remoto)) return juntarOfensiva(local, remoto);
  if (ehObj(local) && ehObj(remoto)) {
    const inv = ehNC(local) && ehNC(remoto) ? regraNivel(caminho) : null;
    // registro com data (lição concluída, item da revisão espaçada…): fica o mais recente inteiro
    const dl = dataDe(local), dr = dataDe(remoto);
    if (dl && dr && !caminho.match(/^(config|leitura)$/)) return clonar(dl >= dr ? local : remoto);
    const out = {};
    for (const k of new Set([...Object.keys(remoto), ...Object.keys(local)])) {
      const b = ehObj(base) ? base[k] : undefined;
      if (!(k in local) && b !== undefined && igual(b, remoto[k])) continue; // apagado aqui
      if (!(k in remoto) && b !== undefined && igual(b, local[k])) continue; // apagado lá
      const v = juntar1(b, local[k], remoto[k], localNovo, caminho ? `${caminho}.${k}` : k, temBase);
      if (v !== undefined) out[k] = v;
    }
    if (inv) { // carta ou planta mudada nos dois aparelhos: pelo total de cópias recebidas (ver NIVEIS)
      const tot = (x) => x.copias + inv(x.nivel) + 1; // + 1: a cópia que desbloqueou
      const t = ehNC(base) ? tot(local) + tot(remoto) - tot(base) : temBase ? tot(local) + tot(remoto) : Math.max(tot(local), tot(remoto));
      out.nivel = Math.max(local.nivel, remoto.nivel);
      out.copias = Math.max(0, t - inv(out.nivel) - 1);
    }
    return out;
  }
  // listas de registros com `id` e sem data (eventos da Agenda e os dias deles, avaliações, atividades do Currículo…):
  // junta cada um pelo id, campo a campo, em vez de ficar com duas cópias do mesmo registro mudado nos dois aparelhos
  // (ex.: Fui no dia 1 no celular e no dia 2 no tablet). Registros com data (respostas, reportes…) seguem a regra de baixo.
  if (Array.isArray(local) && Array.isArray(remoto) && comIds(local) && comIds(remoto) && (local.length || remoto.length) && (base === undefined || (Array.isArray(base) && comIds(base)))) {
    const porId = (l) => new Map((Array.isArray(l) ? l : []).map(x => [x.id, x]));
    const mb = porId(base), ml = porId(local), mr = porId(remoto), out = [];
    for (const id of new Set([...mr.keys(), ...ml.keys()])) {
      const b = mb.get(id), l = ml.get(id), r = mr.get(id);
      if (l === undefined && b !== undefined && igual(b, r)) continue; // tirado aqui
      if (r === undefined && b !== undefined && igual(b, l)) continue; // tirado lá
      const v = juntar1(b, l, r, localNovo, `${caminho}[]`, temBase);
      if (v !== undefined) out.push(v);
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remoto)) {
    const naBase = new Set(Array.isArray(base) ? base.map(estavel) : []);
    const emL = new Set(local.map(estavel)), emR = new Set(remoto.map(estavel));
    const out = [], vistos = new Set();
    for (const x of [...remoto, ...local]) {
      const s = estavel(x);
      if (vistos.has(s)) continue; vistos.add(s);
      if (naBase.has(s) && (!emL.has(s) || !emR.has(s))) continue; // um dos lados tirou
      out.push(clonar(x));
    }
    if (out.every(x => dataDe(x))) out.sort((a, b) => (dataDe(a) < dataDe(b) ? -1 : dataDe(a) > dataDe(b) ? 1 : 0));
    return out;
  }
  if (typeof local === "number" && typeof remoto === "number") {
    if (MAXIMO.test(chave)) return Math.max(local, remoto);
    const contador = [local, remoto].every(v => Number.isInteger(v) && Math.abs(v) < 1e9);
    if (contador) {
      if (typeof base !== "number") return temBase ? local + remoto : Math.max(local, remoto); // criado nos dois desde a base: soma; sem base nenhuma, não dá para saber
      return somar(base, local, remoto); // o que cada aparelho ganhou (ou gastou) desde a base
    }
  }
  return clonar(localNovo ? local : remoto);
}
/** Slots de baú: lista por POSIÇÃO com vazios (null). Unir como lista qualquer juntava os vazios num só e somava os
 *  baús que cada aparelho pôs no mesmo slot livre (assim ele chegou a 5 slots em 06/11/2026). Aqui: cada baú pelo id
 *  (aberto num lado = sai; mudado nos dois = o mais adiantado), na posição deste aparelho, os do outro na posição dele ou
 *  no 1º slot livre; sem slot livre, vai para o fim (a economia.js deixa o baú a mais até ele ser aberto). */
function juntarSlots(base, local, remoto, localNovo) {
  const porId = (l) => { const m = new Map(); (Array.isArray(l) ? l : []).forEach((x, i) => { if (ehObj(x) && x.id != null) m.set(x.id, { x, i }); }); return m; };
  const mb = porId(base), ml = porId(local), mr = porId(remoto);
  const fica = (id) => !(mb.has(id) && (!ml.has(id) || !mr.has(id)));
  // o mesmo baú mudado nos dois: fica o lado que mudou; os dois, o mais adiantado (começou a abrir; fica pronto antes).
  // Campo a campo não serve: horários (obtidoEm, inicio, pronto) seriam somados como contadores.
  const valor = (id) => {
    const l = ml.get(id)?.x, r = mr.get(id)?.x, b = mb.get(id)?.x;
    if (!l || !r) return clonar(l || r);
    if (b && igual(b, l)) return clonar(r);
    if (b && igual(b, r)) return clonar(l);
    if (!!l.inicio !== !!r.inicio) return clonar(l.inicio ? l : r);
    if (l.pronto && r.pronto && l.pronto !== r.pronto) return clonar(l.pronto < r.pronto ? l : r);
    return clonar(localNovo ? l : r);
  };
  const out = new Array(Math.max(local.length, remoto.length)).fill(null), resto = [];
  for (const [id, { i }] of ml) if (fica(id)) { if (out[i] === null) out[i] = valor(id); else resto.push(id); }
  for (const [id, { i }] of mr) if (!ml.has(id) && fica(id)) { if (out[i] === null) out[i] = valor(id); else resto.push(id); }
  for (const id of resto) { const k = out.indexOf(null); if (k >= 0) out[k] = valor(id); else out.push(valor(id)); }
  return out;
}
/** Contador mudado nos dois aparelhos: soma o que cada um ganhou ou gastou desde a base. Um saldo que nunca foi negativo
 *  (moedas, gemas, cópias, poções…) não fica negativo: se os dois gastaram o mesmo dinheiro (base 10, cada um gastou 10),
 *  fica 0, e o que os dois compraram continua valendo. */
function somar(base, local, remoto) {
  const v = remoto + (local - base);
  return v < 0 && base >= 0 && local >= 0 && remoto >= 0 ? 0 : v;
}

// ---------------------------------------------------------------- reparos (E().reparos)
// Um reparo do saldo (estado.js/economia.js: devolver o que foi cobrado duas vezes, zerar o que ficou negativo) guarda
// { em, delta: { "moedas": 660, "colecao.cartas.moli.copias": 8, … } }. Se os dois aparelhos fizeram o mesmo reparo
// antes de sincronizar, a soma dos contadores devolveria duas vezes: aqui o que os dois devolveram no mesmo caminho
// volta a contar uma vez só (o menor dos dois).
function deltasNovos(base, lado) {
  const b = ehObj(base?.reparos) ? base.reparos : {}, out = {};
  for (const [id, r] of Object.entries(ehObj(lado?.reparos) ? lado.reparos : {})) {
    if (b[id] || !ehObj(r?.delta)) continue;
    for (const [p, v] of Object.entries(r.delta)) if (Number.isFinite(v)) out[p] = (out[p] || 0) + v;
  }
  return out;
}
function desfazerReparosDuplos(base, local, remoto, j) {
  const dl = deltasNovos(base, local), dr = deltasNovos(base, remoto);
  for (const p of Object.keys(dl)) {
    if (!(p in dr) || Math.sign(dl[p]) !== Math.sign(dr[p])) continue;
    const d = Math.sign(dl[p]) * Math.min(Math.abs(dl[p]), Math.abs(dr[p]));
    const partes = p.split("."), k = partes.pop();
    let o = j;
    for (const x of partes) o = ehObj(o) ? o[x] : undefined;
    if (ehObj(o) && typeof o[k] === "number") o[k] = Math.max(0, o[k] - d);
  }
}

// ---------------------------------------------------------------- qual base usar (sincronia.js)
/** A base da junção. Normalmente a última versão que este aparelho viu (`meta.base`). Mas se o envio anterior deste
 *  aparelho chegou ao GitHub e o app foi fechado antes de guardar a base nova (bug de 01/11/2026: o celular enviou a
 *  rev 429, o Android fechou o app, e na volta juntou a 429 dele mesmo com a base 428: tudo o que ele gastou entre as
 *  duas foi cobrado de novo), a base certa é o que ele enviou. `pendente` = { rev, estado } guardado ANTES de cada envio;
 *  `remoto` = o arquivo lido ({ rev, aparelho, historico: [{ rev, aparelho }] }). Devolve { base, rev } ou null. */
export function baseDaJuncao({ meta = {}, pendente = null, remoto = {}, aparelho = "" }) {
  if (pendente && pendente.rev > (meta.rev || 0)) {
    const chegou = (remoto.rev === pendente.rev && remoto.aparelho === aparelho)
      || (Array.isArray(remoto.historico) && remoto.historico.some(h => h.rev === pendente.rev && h.aparelho === aparelho));
    if (chegou) return { base: pendente.estado, rev: pendente.rev, recuperada: true };
  }
  // sem o pendente (versões antigas): o arquivo é o último envio deste mesmo aparelho, então é a base
  if (remoto.aparelho && remoto.aparelho === aparelho && (remoto.rev || 0) > (meta.rev || 0) && remoto.estado) return { base: remoto.estado, rev: remoto.rev, recuperada: true };
  return meta.base !== undefined ? { base: meta.base, rev: meta.rev } : null;
}

function juntarOfensiva(l, r) {
  const a = (l.ultimoDia || "") >= (r.ultimoDia || "") ? l : r;
  const uniao = (k) => [...new Set([...(l[k] || []), ...(r[k] || [])])].sort();
  const o = { ...clonar(a), recorde: Math.max(l.recorde || 0, r.recorde || 0) };
  for (const k of ["usados", "quebras", "reparados"]) if (l[k] || r[k]) o[k] = uniao(k);
  if ((l.ultimoDia || "") === (r.ultimoDia || "")) o.atual = Math.max(l.atual || 0, r.atual || 0);
  return o;
}

