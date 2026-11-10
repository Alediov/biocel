// Histórico de cada ficha (só no aparelho e no backup cifrado): o que aconteceu e quando, e o que foi corrigido na
// revisão (campo, antes e depois). Dos números de identificação fica só QUAIS campos mudaram e quantos dígitos,
// nunca os números; da data de nascimento, só que foi alterada.

const LIMITE = 60;
/** Acrescenta um acontecimento à ficha (não salva: quem chama salva). */
export function registrar(f, acao, extra = {}) {
  (f.historico ||= []).push({ em: new Date().toISOString(), acao, ...extra });
  if (f.historico.length > LIMITE) f.historico.splice(0, f.historico.length - LIMITE);
  return f;
}

export const NOMES_CAMPOS = { data: "Data", horario: "Horário", clinica: "Clínica", cor: "Cor", nascimento: "Nascimento", sexo: "Sexo", idadeEscrita: "Idade escrita",
  municipio: "Município", bairro: "Bairro", urgencia: "Urgência", primeira: "1ª consulta", retorno: "Retorno", procedimentos: "Procedimentos" };
const SEM_VALOR = new Set(["nascimento"]);
const cod = (c) => { const d = String(c || "").replace(/\D/g, ""); return d.length === 10 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6, 9)}-${d[9]}` : d; };
const texto = (k, v) => k === "procedimentos" ? (v || []).map(q => `${q.dente ? q.dente + " " : ""}${cod(q.codigo)}`).join("; ")
  : typeof v === "boolean" ? (v ? "sim" : "não") : String(v ?? "").trim();
/** Diferenças entre duas revisões: [{ campo, de, para }] (sem os valores da data de nascimento). */
export function diferencas(antes = {}, depois = {}) {
  const out = [];
  for (const k of Object.keys(NOMES_CAMPOS)) {
    const a = texto(k, antes[k]), b = texto(k, depois[k]);
    if (a.toLowerCase() === b.toLowerCase()) continue;
    out.push(SEM_VALOR.has(k) ? { campo: k } : { campo: k, de: a, para: b });
  }
  return out;
}
/** Quais números mudaram na confirmação e quantos dígitos (sem guardar os números). */
export function mudancasNumeros(sugestoes = {}, valores = {}) {
  const out = [];
  for (const [c, v] of Object.entries(valores)) {
    const a = String(sugestoes[c]?.texto || "").replace(/[^0-9I]/gi, ""), b = String(v || "").replace(/[^0-9I]/gi, "");
    if (a === b) continue;
    let d = Math.abs(a.length - b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
    out.push({ campo: c, digitos: d });
  }
  return out;
}
const NOMES_NUM = { prontuario: "prontuário", aluno: "RA", cpf: "CPF", cns: "CNS" };
/** Uma linha de texto para mostrar o acontecimento. */
export function descrever(h) {
  if (h.numeros?.length) return `${h.acao}: ${h.numeros.map(m => `${NOMES_NUM[m.campo] || m.campo} (${m.digitos} ${m.digitos === 1 ? "dígito" : "dígitos"})`).join(", ")}`;
  if (h.mudou?.length) return `${h.acao}: ${h.mudou.map(m => NOMES_CAMPOS[m.campo] || m.campo).join(", ")}`;
  return h.acao + (h.nota ? ` (${h.nota})` : "");
}
