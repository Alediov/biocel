// Arquivos gerados no aparelho: ZIP (sem compressão), planilha .xlsx (com tipos, larguras e filtro) e CSV, sem bibliotecas.
const TABELA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const enc = new TextEncoder();

/** arquivos: [{ nome, dados: Uint8Array | string | Blob }] → Blob do .zip */
export async function zip(arquivos) {
  const partes = [], centrais = []; let pos = 0;
  const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const a of arquivos) {
    const dados = a.dados instanceof Blob ? new Uint8Array(await a.dados.arrayBuffer()) : typeof a.dados === "string" ? enc.encode(a.dados) : a.dados;
    const nome = enc.encode(a.nome), crc = crc32(dados);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true); loc.setUint16(10, hora, true); loc.setUint16(12, dia, true);
    loc.setUint32(14, crc, true); loc.setUint32(18, dados.length, true); loc.setUint32(22, dados.length, true); loc.setUint16(26, nome.length, true);
    partes.push(new Uint8Array(loc.buffer), nome, dados);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(12, hora, true); cen.setUint16(14, dia, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, dados.length, true); cen.setUint32(24, dados.length, true); cen.setUint16(28, nome.length, true);
    cen.setUint32(42, pos, true);
    centrais.push(new Uint8Array(cen.buffer), nome);
    pos += 30 + nome.length + dados.length;
  }
  const tamCentral = centrais.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  return new Blob([...partes, ...centrais, new Uint8Array(fim.buffer)], { type: "application/zip" });
}

/** Lê um .zip sem compressão (como os que este módulo gera) ou só os arquivos .json de um zip comum (store). */
export async function lerZip(blob) {
  const b = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(b.buffer), out = [];
  let i = 0;
  while (i + 30 < b.length && dv.getUint32(i, true) === 0x04034b50) {
    const metodo = dv.getUint16(i + 8, true), tam = dv.getUint32(i + 18, true), nl = dv.getUint16(i + 26, true), xl = dv.getUint16(i + 28, true);
    const nome = new TextDecoder().decode(b.subarray(i + 30, i + 30 + nl)), ini = i + 30 + nl + xl;
    if (metodo === 0) out.push({ nome, dados: b.subarray(ini, ini + tam) });
    else if (typeof DecompressionStream !== "undefined") {
      const ds = new Blob([b.subarray(ini, ini + tam)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      out.push({ nome, dados: new Uint8Array(await new Response(ds).arrayBuffer()) });
    }
    i = ini + tam;
  }
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (n) => { let s = ""; n++; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

// Tipos de coluna da planilha: "texto" (códigos também: ficam como texto, com zeros e pontos), "centro" (texto
// centralizado, como o X das marcações), "numero", "data" (dd/mm/aaaa) e "hora" (hh:mm). Data e hora viram valores
// de verdade do Excel, que ordenam e filtram certo.
const ESTILO = { cab: 1, texto: 2, numero: 3, data: 4, hora: 5, centro: 6, quebra: 7 };
/** "2026-04-30" ou "30/04/2026" → número de série do Excel (dias desde 30/12/1899). */
export function serialData(v) {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/) || String(v ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [a, me, d] = m[1].length === 4 ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
  const t = Date.UTC(a, me - 1, d);
  return new Date(t).getUTCDate() === d ? (t - Date.UTC(1899, 11, 30)) / 86400000 : null;
}
/** "07:10" → fração do dia. */
export function serialHora(v) {
  const m = String(v ?? "").match(/^(\d{1,2}):(\d{2})$/);
  return m && +m[1] < 24 && +m[2] < 60 ? (+m[1] * 60 + +m[2]) / 1440 : null;
}
/** Texto como aparece na célula (para medir a largura da coluna). */
function mostrado(v, tipo) {
  if (v == null) return "";
  if (tipo === "data" && serialData(v) != null) return "00/00/0000";
  return String(v);
}
function folhaXml(f) {
  const { linhas, tipos = [] } = f, ncol = Math.max(...linhas.map(L => L.length));
  // largura de cada coluna: o maior texto dela (cabeçalho em negrito conta um pouco mais), entre 6 e 60
  const largura = Array.from({ length: ncol }, (_, c) => {
    let m = 0;
    linhas.forEach((L, r) => {
      const t = mostrado(L[c], tipos[c]);
      const maior = Math.max(0, ...t.split("\n").map(x => x.length));
      // o cabeçalho quebra em até duas linhas: basta caber a palavra mais longa e metade do texto
      const cab = () => Math.max(...t.split(/\s+/).map(x => x.length), Math.ceil(t.length / 2)) * 1.12 + 2.5;
      m = Math.max(m, r === 0 && f.cabecalho !== false ? cab() : maior + 1.5);
    });
    return Math.min(f.larguraMax || 60, Math.max(6, Math.ceil(m + 1)));
  });
  const cols = `<cols>${largura.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  const celula = (v, r, c) => {
    const ref = `${col(c)}${r + 1}`, tipo = tipos[c] || "texto";
    if (r === 0 && f.cabecalho !== false) return `<c r="${ref}" s="${ESTILO.cab}" t="inlineStr"><is><t xml:space="preserve">${esc(v ?? "")}</t></is></c>`;
    const st0 = { data: ESTILO.data, hora: ESTILO.hora, numero: ESTILO.numero, centro: ESTILO.centro, quebra: ESTILO.quebra }[tipo] || ESTILO.texto;
    if (v == null || v === "") return f.cabecalho === false ? "" : `<c r="${ref}" s="${st0}"/>`; // vazia, mas com a linha de baixo
    if (tipo === "data") { const n = serialData(v); if (n != null) return `<c r="${ref}" s="${ESTILO.data}"><v>${n}</v></c>`; }
    if (tipo === "hora") { const n = serialHora(v); if (n != null) return `<c r="${ref}" s="${ESTILO.hora}"><v>${n}</v></c>`; }
    if (tipo === "numero" && v !== "" && isFinite(+v)) return `<c r="${ref}" s="${ESTILO.numero}"><v>${+v}</v></c>`;
    const st = tipo === "centro" ? ESTILO.centro : tipo === "quebra" ? ESTILO.quebra : ESTILO.texto;
    return `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const rows = linhas.map((L, r) => `<row r="${r + 1}"${r === 0 && f.cabecalho !== false ? ' ht="30" customHeight="1"' : ""}>${Array.from({ length: ncol }, (_, c) => celula(L[c], r, c)).join("")}</row>`).join("");
  const fim = `${col(ncol - 1)}${linhas.length}`;
  const vista = f.cabecalho !== false ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const filtro = f.filtro && linhas.length > 1 ? `<autoFilter ref="A1:${fim}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${fim}"/>${vista}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${filtro}</worksheet>`;
}
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><color rgb="FF12232E"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B7F6C"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD5E0E6"/></bottom><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="8">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
  `<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
  `<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
  `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** folhas: [{ nome, linhas: [[...cabeçalho], [...], ...], tipos?: ["texto"|"centro"|"numero"|"data"|"hora"|"quebra"], filtro?, cabecalho?, larguraMax? }] → Blob .xlsx */
export function xlsx(folhas) {
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${folhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  // o filtro do Excel precisa de um nome definido por folha (_xlnm._FilterDatabase)
  const nomes = folhas.map((f, i) => f.filtro && f.linhas.length > 1 ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(f.nome.slice(0, 31)).replace(/'/g, "''")}'!$A$1:$${col(Math.max(...f.linhas.map(L => L.length)) - 1)}$${f.linhas.length}</definedName>` : "").join("");
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${folhas.map((f, i) => `<sheet name="${esc(f.nome.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${nomes ? `<definedNames>${nomes}</definedNames>` : ""}</workbook>`;
  const wbr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${folhas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return zip([
    { nome: "[Content_Types].xml", dados: ct }, { nome: "_rels/.rels", dados: rels },
    { nome: "xl/workbook.xml", dados: wb }, { nome: "xl/_rels/workbook.xml.rels", dados: wbr }, { nome: "xl/styles.xml", dados: ESTILOS },
    ...folhas.map((f, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, dados: folhaXml(f) })),
  ]).then(b => new Blob([b], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

/**
 * CSV de uma folha. `sep` ";" (Excel em português: datas dd/mm/aaaa) ou "," (padrão para R, Python, SPSS:
 * datas aaaa-mm-dd). Vai com BOM UTF-8, para os acentos abrirem certos no Excel.
 */
export function csv(folha, sep = ";") {
  const { linhas, tipos = [] } = folha;
  const iso = sep !== ";";
  const valor = (v, c, r) => {
    if (v == null) return "";
    let t = String(v);
    if (r > 0 && tipos[c] === "data") { const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/) || t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) t = m[1].length === 4 ? (iso ? t : `${m[3]}/${m[2]}/${m[1]}`) : (iso ? `${m[3]}-${m[2]}-${m[1]}` : t); }
    return /[",;\n\r]/.test(t) || t !== t.trim() ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const texto = linhas.map((L, r) => L.map((v, c) => valor(v, c, r)).join(sep)).join("\r\n") + "\r\n";
  return new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" });
}

let salvadorNativo = null;
/** No app Android, o OdontoQuest registra aqui como salvar e compartilhar (plugins Filesystem e Share). */
export function definirSalvadorNativo(fn) { salvadorNativo = fn; }
/** Entrega um arquivo ao usuário: no navegador, baixa; no app, salva e abre o "Compartilhar". */
export async function baixar(blob, nome) {
  if (salvadorNativo) return salvadorNativo(blob, nome);
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
