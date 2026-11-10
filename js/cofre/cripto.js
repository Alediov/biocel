// Cofre do Órbita (pedido do Alediov, 04/11/2026: senhas, tokens, chaves de API e as contas secundárias das nuvens).
// Só Web Crypto, sem dependências e sem DOM (roda no node para os testes: tools/teste_cofre.mjs).
//   chave  = PBKDF2-SHA256(senha mestra, sal de 16 bytes, 600.000 voltas) → 256 bits
//   cofre  = AES-256-GCM(JSON dos itens, iv de 12 bytes novo a cada gravação, dados adicionais "orbita-cofre-v1")
// A senha mestra nunca é guardada; a chave fica só na memória enquanto o cofre está aberto (e, com a digital, embrulhada
// por uma chave do Keystore do Android que só abre com a digital: CofreDigitalPlugin.java). O envelope (sal, iv e o
// texto cifrado) é o que vai para o aparelho e, cifrado, para o repositório: sem a senha, ninguém lê.

const sutil = () => globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
export const ITER = 600000;
export const VERSAO = 1;
const AAD = enc.encode("orbita-cofre-v1");

export function b64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function deB64(s) { const b = atob(String(s || "")); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
export const aleatorio = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Os 32 bytes da chave, derivados da senha (para importar e, ao ligar a digital, para embrulhar no Keystore). */
export async function derivarBruta(senha, sal, iter = ITER) {
  const base = await sutil().importKey("raw", enc.encode(String(senha).normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await sutil().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, base, 256));
}
/** A chave AES-GCM (não exportável) a partir dos 32 bytes. */
export const importarChave = (bruta) => sutil().importKey("raw", bruta, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

/** Cifra os dados (objeto) num envelope { v, kdf, iv, dados }. `kdf` = { nome, iter, sal } do cofre. */
export async function cifrar(chave, kdf, obj) {
  const iv = aleatorio(12);
  const ct = await sutil().encrypt({ name: "AES-GCM", iv, additionalData: AAD }, chave, enc.encode(JSON.stringify(obj)));
  return { v: VERSAO, kdf, iv: b64(iv), dados: b64(new Uint8Array(ct)) };
}
/** Abre um envelope; senha errada (ou envelope adulterado) → Error("senha"). */
export async function decifrar(chave, env) {
  try {
    const pt = await sutil().decrypt({ name: "AES-GCM", iv: deB64(env.iv), additionalData: AAD }, chave, deB64(env.dados));
    return JSON.parse(dec.decode(pt));
  } catch { throw new Error("senha"); }
}
export const novoKdf = () => ({ nome: "PBKDF2-SHA256", iter: ITER, sal: b64(aleatorio(16)) });

// ---------- itens e junção entre aparelhos ----------
// dados = { itens: { <id>: { id, tipo: "conta" | "chave" | "nota", titulo, …, em } } }; apagado = { id, apagado: true, em }
// Cada item fica com a versão mais nova (em); os apagados ficam como marca por 180 dias, para o outro aparelho saber.
export const PRAZO_APAGADOS = 180 * 864e5;
export function juntar(a = {}, b = {}, agora = Date.now()) {
  const A = a.itens || {}, B = b.itens || {}, out = {};
  for (const id of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const x = A[id], y = B[id];
    const v = !x ? y : !y ? x : (Date.parse(y.em || 0) > Date.parse(x.em || 0) ? y : x);
    if (v.apagado && agora - Date.parse(v.em || 0) > PRAZO_APAGADOS) continue;
    out[id] = v;
  }
  return { ...a, ...b, itens: out };
}
/** Mesmo conteúdo (para não gravar à toa)? */
export const iguais = (a, b) => JSON.stringify(ordenar(a?.itens || {})) === JSON.stringify(ordenar(b?.itens || {}));
const ordenar = (o) => Object.keys(o).sort().map(k => [k, o[k]]);

// ---------- força da senha e gerador ----------
/** Uma estimativa simples (bits) e o rótulo. Frase de 4 palavras ou mais conta como forte. */
export function forca(s) {
  s = String(s || "");
  if (!s) return { bits: 0, nivel: 0, rotulo: "" };
  let n = 0;
  if (/[a-z]/.test(s)) n += 26; if (/[A-Z]/.test(s)) n += 26; if (/\d/.test(s)) n += 10; if (/[^A-Za-z0-9]/.test(s)) n += 32;
  let bits = s.length * Math.log2(Math.max(n, 2));
  const palavras = s.trim().split(/[\s\-_.]+/).filter(p => p.length >= 3).length;
  if (palavras >= 4) bits = Math.max(bits, palavras * 11);
  if (/^(.)\1+$/.test(s) || /^(123|abc|qwe|senha|password)/i.test(s)) bits = Math.min(bits, 20);
  const nivel = bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { bits: Math.round(bits), nivel, rotulo: ["", "fraca", "razoável", "boa", "forte"][nivel] };
}
const LETRAS = "abcdefghijkmnopqrstuvwxyz", MAIUSC = "ABCDEFGHJKLMNPQRSTUVWXYZ", NUMS = "23456789", SIMB = "!@#$%&*?-_=+";
/** Senha aleatória (sem letras que se confundem: l, I, O, 0, 1). */
export function gerarSenha({ tamanho = 20, simbolos = true } = {}) {
  const grupos = [LETRAS, MAIUSC, NUMS, ...(simbolos ? [SIMB] : [])], todos = grupos.join("");
  for (;;) {
    const r = aleatorio(tamanho), s = Array.from(r, x => todos[x % todos.length]).join("");
    if (grupos.every(g => [...s].some(c => g.includes(c)))) return s; // pelo menos um de cada tipo
  }
}
const PALAVRAS = ("abacate abelha abrigo acervo agulha alavanca alecrim alfaia algodao almofada amendoa ameixa ancora anzol aquarela arara areia arquivo arvore astro atlas aurora avental azulejo bacia bambu banco barco bigorna bisturi bolacha bolota bombom borboleta bosque botao brisa broca bussola cabana cacto cadeado caderno caju calango caneca canoa capim caracol carvalho castelo cavalo cebola cegonha cereja chaleira chave chuva cinema cipreste cobalto coelho cometa concha coruja cristal cupim degrau delta diamante dinamo dragao duna eclipse elefante engrenagem escada esmalte espiga estrela farol feijao ferradura figo floresta foguete fonte forno fuba gaivota galho garrafa gaveta geleia girassol goiaba granito grilo guarda harpa hortela ilha iman jabuti jangada janela jasmim joaninha lagoa lanterna lapis laranja lareira lenha limao lontra lua macaco madeira magnolia malha mandioca manga mapa marfim martelo melancia mel mexerica milho mochila moinho montanha morango mosaico navio neblina ninho novelo oceano oficina orquidea ostra ouro paleta panela papagaio pedra pena pepino peteca pimenta pinheiro planeta pomar ponte porto prisma pudim quartzo queijo quintal raposa regador relogio remo rio rocha romeira sabia salsa sapato seringa serra sino sol tambor tatu teclado telhado tesoura tigre tinta tomate torre trem trevo tucano urso uva vagalume vela veleiro vento violao vulcao xadrez zebra").split(" ");
/** Frase-senha (mais fácil de digitar e de lembrar, como a senha mestra): palavras e um número. */
export function gerarFrase(n = 5) {
  const r = aleatorio(n * 2), ws = [];
  for (let i = 0; i < n; i++) ws.push(PALAVRAS[((r[2 * i] << 8) | r[2 * i + 1]) % PALAVRAS.length]);
  return `${ws.join("-")}-${10 + (aleatorio(1)[0] % 90)}`;
}

// ---------- códigos de verificação em duas etapas (TOTP, RFC 6238) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function deBase32(s) {
  const t = String(s || "").toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, val = 0; const out = [];
  for (const c of t) { const i = B32.indexOf(c); if (i < 0) throw new Error("base32"); val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
/** Lê o segredo de um "otpauth://totp/…?secret=…" ou o segredo puro: { segredo, digitos, periodo, algoritmo }. */
export function lerOtp(txt) {
  const s = String(txt || "").trim();
  if (/^otpauth:/i.test(s)) {
    const u = new URL(s), p = u.searchParams;
    return { segredo: (p.get("secret") || "").replace(/\s/g, ""), digitos: +(p.get("digits") || 6), periodo: +(p.get("period") || 30), algoritmo: (p.get("algorithm") || "SHA1").toUpperCase() };
  }
  return { segredo: s.replace(/\s/g, ""), digitos: 6, periodo: 30, algoritmo: "SHA1" };
}
/** O código de agora (e quantos segundos faltam para trocar). */
export async function codigoOtp(txt, agora = Date.now()) {
  const o = lerOtp(txt), chave = deBase32(o.segredo);
  if (!chave.length) throw new Error("segredo vazio");
  const passo = Math.floor(agora / 1000 / o.periodo), msg = new Uint8Array(8);
  let x = passo; for (let i = 7; i >= 0; i--) { msg[i] = x & 255; x = Math.floor(x / 256); }
  const alg = { SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" }[o.algoritmo] || "SHA-1";
  const k = await sutil().importKey("raw", chave, { name: "HMAC", hash: alg }, false, ["sign"]);
  const h = new Uint8Array(await sutil().sign("HMAC", k, msg)), off = h[h.length - 1] & 15;
  const n = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return { codigo: String(n % 10 ** o.digitos).padStart(o.digitos, "0"), resta: o.periodo - Math.floor(agora / 1000) % o.periodo, periodo: o.periodo };
}
