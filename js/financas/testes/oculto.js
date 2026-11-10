// Testes de mercado → o olho (pedido do Alediov, 09/11/2026: "um botão de olho… que OCULTA as informações que mostram de
// onde tiramos os dados", para tirar print só com os resultados). Com o olho fechado, a aba Testes inteira (todas as
// formas, a barra das partes e o que abre depois, como as explicações do "?") troca, no texto já desenhado:
//   - endereços 0x… (inteiros ou encurtados, "0x0404…0404") por "Carteira N" (copy trading), "Cofre A" (cofres) ou
//     "Contrato N" (pools, looping e o resto);
//   - os nomes dos cofres (o "Hyperliquidity Provider (HLP)", "HLP", os dos traders) pelo rótulo do endereço deles;
//   - os tokens dos memecoins ("5GTy…pump") por "Token N";
//   - corretoras, protocolos, casas de aposta e sites de dados (`FONTES`) por "fonte oculta".
// Os rótulos são estáveis: o número de cada endereço fica guardado no aparelho (`orbita.testes.rotulos`) na ordem em que
// apareceu (as carteiras pela data em que passaram a ser seguidas). Os links perdem o endereço. A troca é no próprio texto
// (abrir o olho redesenha a aba). A escolha fica em `orbita.testes.oculto`.
const CHAVE = "orbita.testes.oculto", CHAVE_R = "orbita.testes.rotulos", MAX_TOKENS = 600;
const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

let fechado = ler(CHAVE, false) === true;
export const estaOculto = () => fechado;
export function definirOculto(v) { fechado = !!v; gravar(CHAVE, fechado); }

/** De onde vêm os dados: corretoras, protocolos, redes, casas de aposta e sites (o mais longo antes). */
export const FONTES = ["Hyperliquidity Provider", "Hyperliquid", "Deribit", "Aave v3", "Aave", "Aerodrome Slipstream", "Aerodrome", "Slipstream", "AERO",
  "Uniswap v3", "Uniswap", "PumpSwap", "PumpPortal", "Jito", "IPFS",
  "pump.fun", "pumpfun", "Pinnacle", "Bet365", "Betano", "betano.bet.br", "betano", "bet365", "pinnacle", "Betfair", "Superbet", "Sportingbet", "Novibet", "OddsPapi", "ESPN", "football-data.co.uk", "football-data", "GeckoTerminal",
  "Polymarket", "Kalshi", "Manifold", "UMA", "DexScreener", "RugCheck", "Binance", "Bybit", "OKX", "Lido", "Morpho Blue", "Morpho", "Moonwell", "DefiLlama", "Chainlink", "Arbitrum", "Base", "CoinGecko", "Hypurrscan", "Hyperdash", "publicnode"];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE_FONTES = new RegExp(`(?<![\\p{L}\\p{N}])(?:${FONTES.map(escRe).join("|")})(?![\\p{L}\\p{N}])`, "gu");
/** O palpiteiro seguido na conta Seguir o BDM (apostas, 09/11/2026): o programa e o apresentador. */
export const PALPITEIRO = [["Bom Dia Mercado", "programa de palpites"], ["Theo Borges", "palpiteiro"], ["BDM", "palpiteiro"]];
const RE_PALP = new RegExp(`(?<![\\p{L}\\p{N}])(?:${PALPITEIRO.map(p => escRe(p[0])).join("|")})(?![\\p{L}\\p{N}])`, "gu");
const RE_0X = /0x[0-9a-fA-F]{2,}(?:\s?…\s?[0-9a-fA-F]{2,})?(?:…)?/g;
const RE_TOKEN = /(?<![\p{L}\p{N}])[1-9A-HJ-NP-Za-km-z]{3,6}…[1-9A-HJ-NP-Za-km-z]{3,6}(?![\p{L}\p{N}])/gu;
const TIPO = { carteira: ["c", "Carteira"], cofre: ["v", "Cofre"], contrato: ["k", "Contrato"], token: ["t", "Token"] };
const letra = (n) => { let s = ""; for (n -= 1; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s; return s; };

let rot = null;
const R = () => (rot ||= { c: {}, v: {}, k: {}, t: {}, n: { c: 0, v: 0, k: 0, t: 0 }, ...ler(CHAVE_R, {}) });
/** A chave de um endereço: os 4 primeiros e os 4 últimos dígitos (o inteiro e o encurtado caem na mesma). */
export const chaveEnd = (s) => {
  const h = String(s).toLowerCase().replace(/^0x/, "").split(/\s?…\s?/);
  return h.length > 1 ? `${h[0].slice(0, 4)}|${h.at(-1).slice(-4)}` : `${h[0].slice(0, 4)}|${h[0].length >= 12 ? h[0].slice(-4) : ""}`;
};
function rotulo(tipo, chave, criar = true) {
  const r = R(), [t, nome] = TIPO[tipo];
  r[t] ||= {}; r.n ||= {};
  let n = r[t][chave];
  if (n == null && tipo !== "token" && chave.endsWith("|")) { // encurtado sem o fim: o que começa igual
    const p = chave.slice(0, -1), achou = Object.keys(r[t]).find(k => k.startsWith(p));
    if (achou) n = r[t][achou];
  }
  if (n == null) {
    if (!criar) return null;
    n = r[t][chave] = (r.n[t] = (r.n[t] || 0) + 1);
    if (tipo === "token") { const ks = Object.keys(r.t); if (ks.length > MAX_TOKENS) for (const k of ks.slice(0, ks.length - MAX_TOKENS)) delete r.t[k]; }
    gravar(CHAVE_R, r);
  }
  return `${nome} ${tipo === "cofre" ? letra(n) : n}`;
}

/** Uma carteira da Solana dos memecoins ("AbCd…WxYz", 09/11/2026): com o olho fechado, "Carteira N" (estável); aberto,
 *  o próprio endereço encurtado. O texto já sai trocado (o encurtado de Solana viraria "Token N" na troca do texto). */
export const carteiraSol = (curto) => (fechado ? rotulo("carteira", `sol:${String(curto)}`) : String(curto));

let nomes = []; // [[nome do cofre, rótulo]], o mais longo antes
/** Antes de desenhar: as carteiras na ordem em que passaram a ser seguidas e os cofres (com os nomes) ganham rótulo. */
export function prepararRotulos(d, p) {
  if (!fechado) return;
  for (const c of [...(d?.carteiras || [])].sort((a, b) => (a.desde || 0) - (b.desde || 0) || String(a.endereco).localeCompare(String(b.endereco))))
    if (c?.endereco) rotulo("carteira", chaveEnd(c.endereco));
  const vistos = new Map();
  const andar = (o, prof = 0) => {
    if (!o || typeof o !== "object" || prof > 8) return;
    if (Array.isArray(o)) { for (const x of o) andar(x, prof + 1); return; }
    if (typeof o.endereco === "string" && /^0x/i.test(o.endereco) && typeof o.nome === "string" && o.nome.trim()) vistos.set(o.nome.trim(), o.endereco);
    for (const v of Object.values(o)) if (v && typeof v === "object") andar(v, prof + 1);
  };
  andar(p?.formas?.cofres);
  nomes = [];
  for (const [nome, end] of vistos) {
    const r = rotulo("cofre", chaveEnd(end));
    nomes.push([nome, r]);
    const sigla = nome.match(/\(([A-Z0-9]{2,8})\)\s*$/)?.[1]; // "Hyperliquidity Provider (HLP)" → também "HLP"
    if (sigla) nomes.push([sigla, r]);
  }
  nomes.sort((a, b) => b[0].length - a[0].length);
}

/** O texto com o que mostra a fonte trocado. `forma`: "copia" | "cofres" | outra (o tipo dos endereços soltos). */
export function ocultarTexto(s, forma) {
  if (!s || !/[\p{L}\p{N}]/u.test(s)) return s;
  let t = s;
  for (const [nome, r] of nomes) if (t.includes(nome)) t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escRe(nome)}(?![\\p{L}\\p{N}])`, "gu"), r);
  t = t.replace(RE_0X, (m) => {
    const k = chaveEnd(m.replace(/…$/, ""));
    return rotulo("carteira", k, false) || rotulo("cofre", k, false) || rotulo(forma === "copia" || forma === "previsao" ? "carteira" : forma === "cofres" ? "cofre" : "contrato", k);
  });
  t = t.replace(RE_TOKEN, (m) => (/^\d+…\d+$/.test(m) ? m : rotulo("token", m)));
  t = t.replace(RE_PALP, (m) => PALPITEIRO.find(p => p[0] === m)[1]);
  return t.replace(RE_FONTES, "fonte oculta");
}

const ATRIBUTOS = ["title", "aria-label", "alt", "placeholder"];
/** Troca no que já está desenhado em `el` (texto, atributos e os links). */
export function ocultarEm(el, forma) {
  if (!fechado || !el) return;
  const raizes = el.nodeType === 3 ? [el] : [el];
  for (const r of raizes) {
    if (r.nodeType === 3) { const v = ocultarTexto(r.nodeValue, forma); if (v !== r.nodeValue) r.nodeValue = v; continue; }
    if (r.nodeType !== 1) continue;
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const v = ocultarTexto(n.nodeValue, forma); if (v !== n.nodeValue) n.nodeValue = v; }
    for (const e of [r, ...r.querySelectorAll("*")]) {
      for (const a of ATRIBUTOS) if (e.hasAttribute?.(a)) { const v = e.getAttribute(a), nv = ocultarTexto(v, forma); if (nv !== v) e.setAttribute(a, nv); }
      if (e.tagName === "A" && e.hasAttribute("href") && !/^#/.test(e.getAttribute("href"))) e.removeAttribute("href");
    }
  }
}

/** Vigia `el`: o que entrar depois (explicação do "?", gráficos que redesenham, listas que abrem) também é trocado. */
export function vigiar(el, forma) {
  if (typeof MutationObserver !== "function") return;
  const mo = new MutationObserver((ms) => {
    if (!fechado) return;
    for (const m of ms) {
      if (m.type === "characterData") ocultarEm(m.target, forma());
      else if (m.type === "attributes") ocultarEm(m.target, forma());
      else for (const n of m.addedNodes) ocultarEm(n, forma());
    }
  });
  mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS, "href"] });
  return mo;
}

/** O botão do olho (aberto: mostra tudo; fechado: oculta as fontes). */
export function botaoOlho(aoTrocar) {
  const b = document.createElement("button");
  b.className = `fi-ts-olho${fechado ? " fechado" : ""}`;
  b.setAttribute("aria-pressed", String(fechado));
  b.setAttribute("aria-label", fechado ? "Mostrar de onde vêm os dados" : "Ocultar de onde vêm os dados (para print)");
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>${fechado ? '<path d="M4 4l16 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' : ""}</svg><span>${fechado ? "Fontes ocultas" : "Ocultar fontes"}</span>`;
  b.onclick = () => { definirOculto(!fechado); navigator.vibrate?.(6); aoTrocar(); };
  return b;
}
