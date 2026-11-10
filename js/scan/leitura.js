// Leitura das cópias sem identificação. Dois pedidos separados por ficha, para nada se juntar:
// 1) a cópia da ficha (dados clínicos, sem identificação); 2) o recorte do endereço (só bairro, município e rua voltam).
// Os nomes do aluno e do professor não são lidos (22/10/2026): a completude desses campos vem da presença de escrita.
// Dois caminhos: pacote .zip para ler fora (por exemplo, numa conversa com o Claude) e importar o .json de volta,
// ou chamada direta à API da Anthropic com a chave do próprio usuário.

export const PROMPT_FICHA = `Você está lendo a cópia de uma ficha odontológica do SUS ("Controle de Tratamento", UNIOESTE Cascavel).
As áreas com dados pessoais foram recortadas antes do envio; o que aparece é só o que pode ser lido.
Responda SOMENTE com um JSON, sem texto antes ou depois, neste formato:
{
 "horario": "HH:MM" ou null,            // horário de chegada, escrito na linha da Clínica ou acima do quadro
 "cor": "B" | "P" | "A" | "V" | outra letra | null,   // letra da cor/raça, na linha da Clínica ou acima do quadro
 "clinica": texto como escrito ou null, // sigla ou nome da clínica (ex.: CIA, Prótese I) ou o nome do professor que atendeu (ex.: Maristela): isso é normal, não é dúvida
 "data": "AAAA-MM-DD" ou null,          // data do atendimento (campo Data)
 "urgencia": true|false, "primeira_consulta": true|false, "retorno": true|false,   // quadradinhos 01, 02 e 03 (marcado com X, / ou risco)
 "nascimento": "AAAA-MM-DD" ou null,    // DN, escrito na faixa vertical à esquerda: dia, mês e ano (ano com 2 dígitos: escolha o século que dá idade entre 0 e 110 na data do atendimento)
 "sexo": "M" | "F" | null,              // M( ) F( ) ao lado do DN
 "idade": número ou null,               // campo Idade
 "municipio": texto ou null,            // como escrito (ex.: "Cvel" = Cascavel, "Lapa - PR")
 "procedimentos": [ { "dente": "31" ou null, "codigo": "0301010153" } ],   // uma linha por procedimento, na ordem da ficha
 "duvidas": [ "campo: motivo" ]          // campos com leitura incerta
}
Regras: nos códigos, devolva só os dígitos escritos nas caixas (normalmente 10; se houver só 3, devolva os 3).
Ignore riscos e linhas onduladas usados para anular as linhas vazias. Não invente: na dúvida, use null e explique em "duvidas".`;

export const PROMPT_ENDERECO = `Este recorte mostra o campo "Endereço do paciente" de uma ficha. Responda SOMENTE com um JSON:
{ "bairro": texto ou null, "municipio": texto ou null, "rua": nome da rua SEM número ou null, "legivel": true|false }
Não escreva o número da casa nem complemento. Bairro como escrito, mesmo que seja um sub-bairro (jardim, loteamento, conjunto); se não estiver escrito, use null. Leia a rua com capricho (tipo e nome inteiro): o app decide o bairro sobretudo pela rua, na lista de ruas de Cascavel.`;

export function extrairJson(texto) {
  const t = String(texto).replace(/```(?:json)?/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("A resposta não trouxe JSON.");
  return JSON.parse(t.slice(a, b + 1).replace(/\/\/[^\n"]*$/gm, ""));
}

const paraBase64 = (blob) => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });

/** Um pedido à API (Messages) com uma imagem e um texto. */
export async function perguntarApi({ chave, modelo }, imagem, prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: modelo, max_tokens: 1200, messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: await paraBase64(imagem) } },
      { type: "text", text: prompt }] }] }),
  });
  if (!r.ok) throw new Error(`API: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return extrairJson(j.content?.map(c => c.text || "").join("") || "");
}

export const LEIA_ME = (n) => `PACOTE DE LEITURA DO ODONTOSCAN (${n} fichas)

Cada ficha tem duas imagens, ambas SEM dados de identificação do paciente:
  <código>-ficha.jpg     → responda com o JSON do PROMPT_FICHA
  <código>-endereco.jpg  → responda com o JSON do PROMPT_ENDERECO (só bairro, município e rua sem número)

O código é aleatório e só o aparelho que gerou o pacote sabe a que foto ele corresponde.
Devolva um único arquivo respostas.json neste formato e importe-o no Scanner:
{ "<código>": { "ficha": {...}, "endereco": {...} }, ... }

===== PROMPT_FICHA =====
${PROMPT_FICHA}

===== PROMPT_ENDERECO =====
${PROMPT_ENDERECO}

`;
