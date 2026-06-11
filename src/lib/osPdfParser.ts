/** Parser de PDF de Ordem de Serviço — funciona 100% no browser via unpdf (WebAssembly). */

export interface ExtractedOS {
  numero_os: string | null;
  loja_nome: string | null;
  loja_codigo: string | null;
  prestadora_nome: string | null;
  tecnico_nome: string | null;
  categoria_nome: string | null;
  tipo_servico: string | null;
  descricao_problema: string | null;
  status: string | null;
  data_abertura: string | null;
  data_conclusao: string | null;
  custo_total: number | null;
  custo_mao_obra: number | null;
  custo_materiais: number | null;
  custo_pecas: number | null;
  materiais: { descricao: string; quantidade: number | null; valor_unitario: number | null; valor_total: number | null }[];
  camposNaoEncontrados: string[];
}

function parseDateBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = raw.trim().match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return raw.trim().slice(0, 10);
  return null;
}

function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const clean = raw.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return Number.isNaN(n) ? null : n;
}

function extract(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function normalizeStatus(raw: string | null): string {
  if (!raw) return "aberta";
  const r = raw.toLowerCase();
  if (r.includes("conclu") || r.includes("finaliz") || r.includes("encerr")) return "concluida";
  if (r.includes("execu") || r.includes("andamento") || r.includes("progress")) return "em_execucao";
  if (r.includes("atraso") || r.includes("atrasad")) return "em_atraso";
  if (r.includes("cancel")) return "cancelada";
  return "aberta";
}

export function parseOSText(text: string): ExtractedOS {
  const T = text.replace(/\s+/g, " ").trim();

  const numero_os = extract(T, [
    /(?:OS|Ordem\s+de\s+Servi[çc]o|N[uú]mero\s+OS)[:\s#]*(\d{3,})/i,
    /^(\d{4,})\s/,
    /\bOS[:\s]*([A-Z0-9\-]{4,})/i,
  ]);

  const loja_nome = extract(T, [
    /(?:Loja|Unidade|Local|Cliente)[:\s]+([^\n,;|]{5,50}?)(?:\s{2,}|\||;|Endere[çc]o|CNPJ|CPF)/i,
    /(?:Loja|Unidade)\s*[:\-]\s*(.+?)(?:\s{2,}|$)/i,
  ]);

  const loja_codigo = extract(T, [
    /(?:C[oó]digo\s+(?:da\s+)?Loja|Loja\s+N[º°o]?)[:\s]*(\d{2,5})/i,
    /LOJA\s+(\d{2,4})/i,
  ]);

  const prestadora_nome = extract(T, [
    /(?:Prestadora|Empresa|Fornecedor|Contratada)[:\s]+([^\n|;]{3,60}?)(?:\s{2,}|\||;|CNPJ|CPF)/i,
    /(?:Prestadora|Empresa)\s*[:\-]\s*(.+?)(?:\s{2,}|$)/i,
  ]);

  const tecnico_nome = extract(T, [
    /(?:T[eé]cnico|Respons[aá]vel|Executor|Executante)[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+){1,4})/i,
    /(?:T[eé]cnico|Respons[aá]vel)\s*[:\-]\s*(.+?)(?:\s{2,}|$)/i,
  ]);

  const categoria_nome = extract(T, [
    /(?:Categoria|Tipo\s+de\s+Manuten[cç][aã]o|[Áa]rea)[:\s]+([^\n|;]{3,50}?)(?:\s{2,}|\||;)/i,
  ]);

  const tipo_servico = extract(T, [
    /(?:Tipo\s+(?:de\s+)?Servi[cç]o|Servi[cç]o)[:\s]+([^\n|;]{3,80}?)(?:\s{2,}|\||;|Descri[cç][aã]o)/i,
  ]);

  const descricao_raw = extract(T, [
    /(?:Descri[cç][aã]o\s+(?:do\s+)?(?:Problema|Servi[cç]o|OS))[:\s]+(.{10,300}?)(?:\s{3,}|Solu[cç][aã]o|Observa[cç][aã]o|Material|Custo|Status)/i,
    /(?:Problema|Defeito)[:\s]+(.{10,200}?)(?:\s{3,}|Solu[cç][aã]o|Status)/i,
  ]);
  const descricao_problema = descricao_raw ? descricao_raw.replace(/\s+/g, " ").slice(0, 500) : null;

  const status_raw = extract(T, [
    /(?:Status|Situa[cç][aã]o)[:\s]+([A-ZÀ-Úa-zà-ú\s]{3,30}?)(?:\s{2,}|\||;|Data)/i,
  ]);
  const status = normalizeStatus(status_raw);

  const data_abertura = parseDateBR(extract(T, [
    /(?:Data\s+(?:de\s+)?Abertura|Aberto\s+em|Aberta\s+em|Data\s+OS)[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /(?:Data\s+(?:de\s+)?Abertura)[:\s]+(\d{4}-\d{2}-\d{2})/i,
  ]));

  const data_conclusao = parseDateBR(extract(T, [
    /(?:Data\s+(?:de\s+)?(?:Conclus[aã]o|Finaliza[cç][aã]o|Encerramento)|Conclu[ií]do\s+em)[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
  ]));

  const custo_total = parseMoney(extract(T, [
    /(?:Custo\s+Total|Valor\s+Total|Total\s+Geral)[:\s]+(R?\$?\s*[\d.,]+)/i,
    /(?:TOTAL)[:\s]+(R?\$?\s*[\d.,]+)/i,
  ]));

  const custo_mao_obra = parseMoney(extract(T, [
    /(?:M[aã]o\s+de\s+Obra|M\.O\.)[:\s]+(R?\$?\s*[\d.,]+)/i,
  ]));

  const custo_materiais = parseMoney(extract(T, [
    /(?:Custo\s+(?:de\s+)?Materiais?|Materiais?\s+Total)[:\s]+(R?\$?\s*[\d.,]+)/i,
  ]));

  const custo_pecas = parseMoney(extract(T, [
    /(?:Pe[cç]as?|Componentes?)[:\s]+(R?\$?\s*[\d.,]+)/i,
  ]));

  // Extrair lista de materiais
  const materiais: ExtractedOS["materiais"] = [];
  const matBlock = T.match(/(?:Materiais?\s+Utilizados?|Lista\s+de\s+Materiais?)[:\s]+(.+?)(?=\s{3,}(?:Custo|Total|Observa|$))/i);
  if (matBlock) {
    const matRe = /([A-ZÀ-Úa-zà-ú][^\d]{3,50}?)\s+(\d+(?:[.,]\d+)?)\s+(?:un|unid|pç|pc|m|kg|lt)?\s+(R?\$?\s*[\d.,]+)\s+(R?\$?\s*[\d.,]+)/gi;
    let m;
    while ((m = matRe.exec(matBlock[1])) !== null) {
      materiais.push({
        descricao: m[1].trim(),
        quantidade: parseFloat(m[2].replace(",", ".")),
        valor_unitario: parseMoney(m[3]),
        valor_total: parseMoney(m[4]),
      });
    }
  }

  const camposNaoEncontrados: string[] = [];
  if (!numero_os) camposNaoEncontrados.push("numero_os");
  if (!loja_nome && !loja_codigo) camposNaoEncontrados.push("loja");
  if (!data_abertura) camposNaoEncontrados.push("data_abertura");
  if (custo_total === null) camposNaoEncontrados.push("custo_total");

  return {
    numero_os, loja_nome, loja_codigo, prestadora_nome, tecnico_nome,
    categoria_nome, tipo_servico, descricao_problema, status,
    data_abertura, data_conclusao,
    custo_total, custo_mao_obra, custo_materiais, custo_pecas,
    materiais, camposNaoEncontrados,
  };
}
