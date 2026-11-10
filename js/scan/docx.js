// Documento do Word (.docx) feito no aparelho, sem bibliotecas: parágrafos, títulos, tabelas e figuras (PNG).
// Formato perto da ABNT: A4, margens 3/2 cm, Arial 12, espaço 1,5, texto justificado, tabelas com linhas só em cima,
// embaixo e abaixo do cabeçalho, legendas acima das tabelas e das figuras.
import { zip } from "./arquivos.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const EMU_CM = 360000;

/** Trechos com negrito/itálico: "texto **negrito** e _itálico_". */
function runs(texto, base = "") {
  return String(texto ?? "").split(/(\*\*[^*]+\*\*|_[^_]+_)/).filter(Boolean).map(p => {
    let rpr = base, t = p;
    if (p.startsWith("**")) { rpr += "<w:b/>"; t = p.slice(2, -2); } else if (p.startsWith("_") && p.endsWith("_") && p.length > 2) { rpr += "<w:i/>"; t = p.slice(1, -1); }
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  }).join("");
}

export class Documento {
  constructor() { this.corpo = []; this.imagens = []; this.nTab = 0; this.nFig = 0; }
  titulo(t) { this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${runs(t)}</w:p>`); return this; }
  subtitulo(t) { this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr>${runs(t)}</w:p>`); return this; }
  secao(t, nivel = 1) { this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Heading${nivel}"/></w:pPr>${runs(t)}</w:p>`); return this; }
  paragrafo(t) { this.corpo.push(`<w:p>${runs(t)}</w:p>`); return this; }
  item(t) { this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Lista"/></w:pPr>${runs("• " + t)}</w:p>`); return this; }
  nota(t) { this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Fonte"/></w:pPr>${runs(t)}</w:p>`); return this; }
  /** Referência (ABNT: alinhada à esquerda, espaço simples, uma linha em branco entre elas). */
  referencia(t) { this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Referencia"/></w:pPr>${runs(t)}</w:p>`); return this; }
  quebra() { this.corpo.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`); return this; }

  /** Tabela: linhas[0] é o cabeçalho; `alinhar`: "e" ou "d" por coluna (padrão: 1ª à esquerda, as outras à direita). */
  tabela(titulo, linhas, { fonte = "", alinhar = null, larguras = null, destaque = [] } = {}) {
    this.nTab++;
    this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/></w:pPr>${runs(`**Tabela ${this.nTab}** – ${titulo}`)}</w:p>`);
    const nc = Math.max(...linhas.map(l => l.length)), total = 9071; // largura útil em twips (16 cm)
    const ws = larguras ? larguras.map(f => Math.round(f * total)) : [Math.round(total * 0.4), ...Array(nc - 1).fill(Math.round(total * 0.6 / Math.max(1, nc - 1)))];
    const al = (j) => (alinhar?.[j] || (j === 0 ? "e" : "d")) === "e" ? "left" : (alinhar?.[j] === "c" ? "center" : "right");
    const linha = (l, i) => `<w:tr>${i === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${Array.from({ length: nc }, (_, j) => {
      const v = l[j] ?? "", cab = i === 0, forte = cab || destaque.includes(i);
      const bordas = cab ? `<w:tcBorders><w:bottom w:val="single" w:sz="6" w:color="000000"/></w:tcBorders>` : "";
      return `<w:tc><w:tcPr><w:tcW w:w="${ws[j] || ws[ws.length - 1]}" w:type="dxa"/>${bordas}</w:tcPr><w:p><w:pPr><w:pStyle w:val="TabTexto"/><w:jc w:val="${cab && j > 0 ? "center" : al(j)}"/></w:pPr>${runs(String(v), forte ? "<w:b/>" : "")}</w:p></w:tc>`;
    }).join("")}</w:tr>`;
    this.corpo.push(`<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="center"/>
      <w:tblBorders><w:top w:val="single" w:sz="8" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:color="000000"/></w:tblBorders>
      <w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>
      <w:tblGrid>${ws.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${linhas.map(linha).join("")}</w:tbl>`);
    if (fonte) this.nota(fonte);
    return this;
  }

  /** Figura PNG (Uint8Array) com largura em cm; a altura segue a proporção (pxL × pxA). */
  figura(titulo, png, pxL, pxA, { largura = 15, fonte = "" } = {}) {
    this.nFig++;
    const id = `rIdImg${this.imagens.length + 1}`, nome = `imagem${this.imagens.length + 1}.png`;
    this.imagens.push({ id, nome, png, titulo, fonte, n: this.nFig });
    const cx = Math.round(largura * EMU_CM), cy = Math.round(cx * pxA / pxL), n = this.imagens.length;
    this.corpo.push(`<w:p><w:pPr><w:pStyle w:val="Legenda"/></w:pPr>${runs(`**Figura ${this.nFig}** – ${titulo}`)}</w:p>`);
    this.corpo.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Figura ${n}"/>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n}" name="${nome}"/><pic:cNvPicPr/></pic:nvPicPr>
      <pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
    if (fonte) this.nota(fonte);
    return this;
  }

  async gerar({ titulo = "Relatório", autor = "" } = {}) {
    const ns = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${this.corpo.join("")}
      <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      ${this.imagens.map(im => `<Relationship Id="${im.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.nome}"/>`).join("")}</Relationships>`;
    const agora = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    return zip([
      { nome: "[Content_Types].xml", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
      { nome: "_rels/.rels", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
      { nome: "docProps/core.xml", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(titulo)}</dc:title><dc:creator>${esc(autor)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created></cp:coreProperties>` },
      { nome: "word/document.xml", dados: doc },
      { nome: "word/styles.xml", dados: ESTILOS },
      { nome: "word/_rels/document.xml.rels", dados: rels },
      ...this.imagens.map(im => ({ nome: `word/media/${im.nome}`, dados: im.png })),
    ]).then(b => new Blob([b], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  }
}

const fonte = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>`;
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${fonte}<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:ind w:firstLine="709"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:ind w:firstLine="0"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:ind w:firstLine="0"/><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Lista"><w:name w:val="Lista OdontoScan"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="709" w:hanging="284" w:firstLine="0"/><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Legenda"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:before="240" w:after="60" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Referencia"><w:name w:val="Referência"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:before="0" w:after="240" w:line="240" w:lineRule="auto"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Fonte"><w:name w:val="Fonte da tabela"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:before="40" w:after="200" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TabTexto"><w:name w:val="Texto de tabela"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>
</w:styles>`;
