/** Parser de PDF de checklist de ar-condicionado — funciona 100% no browser via unpdf (WebAssembly). */

export async function pdfToText(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text).replace(/\s+/g, " ").trim();
}

function parseScoreToken(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(",", ".");
  if (!s) return null;
  const dec = s.match(/(\d{1,3}\.\d{1,2})/);
  if (dec) { const n = parseFloat(dec[1]); if (!Number.isNaN(n) && n <= 100) return n; }
  const onlyDigits = s.replace(/\D/g, "");
  if (!onlyDigits) return null;
  const direct = parseInt(onlyDigits, 10);
  if (!Number.isNaN(direct) && direct <= 100) return direct;
  if (onlyDigits.endsWith("100")) return 100;
  for (let k = 3; k >= 1; k--) {
    if (onlyDigits.length >= k) {
      const v = parseInt(onlyDigits.slice(-k), 10);
      if (!Number.isNaN(v) && v <= 100) return v;
    }
  }
  return null;
}

function parseInconfToken(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (/^(\d)\1+$/.test(digits)) return parseInt(digits[0], 10);
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

function parseDateBR(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parsePctNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function matchBetween(text: string, start: RegExp, end: RegExp): string | null {
  const s = text.search(start);
  if (s < 0) return null;
  const after = text.slice(s);
  const startMatch = after.match(start);
  if (!startMatch) return null;
  const afterStart = after.slice(startMatch[0].length);
  const e = afterStart.search(end);
  if (e < 0) return null;
  return afterStart.slice(0, e).trim();
}

export interface ExtractedChecklist {
  checklist_id: string | null;
  nome_checklist: string | null;
  empresa_prestadora: string | null;
  autor: string | null;
  unidade: string | null;
  loja_numero: string | null;
  cidade_uf: string | null;
  endereco: string | null;
  data_visita: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao: string | null;
  resultado_parcial: number | null;
  resultado_final: number | null;
  nota_final: number | null;
  inconformidades: number;
  areas: { area: string; resultado: string | null; percentual: number | null }[];
  historico: { data_resultado: string; nota_checklist: number | null; inconformidades: number | null }[];
  itens: { area: string | null; pergunta: string; peso: number | null; resultado: string | null; status: string | null }[];
  camposNaoEncontrados: string[];
}

export function parseChecklistText(text: string): ExtractedChecklist {
  const T = String(text).replace(/\s+/g, " ").trim();

  const idMatch = T.match(/#\s*(\d{4,})/);
  const checklist_id = idMatch ? idMatch[1] : null;
  let nome_checklist: string | null = null;
  if (idMatch) { const before = T.slice(0, idMatch.index ?? 0).trim(); nome_checklist = before || null; }

  let nota_final: number | null = null;
  if (idMatch) {
    const after = T.slice((idMatch.index ?? 0) + idMatch[0].length).trim();
    const m = after.match(/^\s*(\d{1,3}(?:[.,]\d{1,2})?)/);
    if (m) nota_final = parseScoreToken(m[1]);
  }

  let data_visita: string | null = null, hora_inicio: string | null = null;
  let hora_fim: string | null = null, duracao: string | null = null;
  const per = T.match(/Per[ií]odo de aplica[cç][aã]o\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+[àa]\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s*\(([^)]+)\)/i);
  if (per) { data_visita = parseDateBR(per[1]); hora_inicio = per[2] + ":00"; hora_fim = per[4] + ":00"; duracao = per[5]; }
  if (!duracao) { const d = T.match(/Dura[cç][aã]o\s+(\d{1,2}:\d{2}:\d{2})/i); if (d) duracao = d[1]; }

  let autor: string | null = null;
  const aut = T.match(/\bAutor\s+(.+?)\s+Checklist\b/i);
  if (aut) autor = aut[1].trim();

  let unidade: string | null = null;
  const uni = T.match(/\bUnidade\s+(.+?)\s+Cidade\/UF\b/i);
  if (uni) unidade = uni[1].trim();

  let loja_numero: string | null = null;
  if (unidade) { const ln = unidade.match(/LOJA\s+(\d+)/i); if (ln) loja_numero = ln[1]; }

  let cidade_uf: string | null = null;
  const cu = T.match(/Cidade\/UF\s+(.+?)\s+Endere[çc]o\b/i);
  if (cu) cidade_uf = cu[1].trim();

  let endereco: string | null = null;
  const en = T.match(/Endere[çc]o\s+(.+?)\s+In[ií]cio da aplica[cç][aã]o\b/i);
  if (en) endereco = en[1].trim();

  let resultado_parcial: number | null = null, resultado_final: number | null = null;
  const rp = T.match(/RESULTADO PARCIAL\s+(\d{1,3}(?:[.,]\d+)?)/i);
  if (rp) resultado_parcial = parseScoreToken(rp[1]);
  const rf = T.match(/RESULTADO FINAL\s+(\d{1,3}(?:[.,]\d+)?)/i);
  if (rf) resultado_final = parseScoreToken(rf[1]);
  if (nota_final === null) nota_final = resultado_final ?? resultado_parcial;

  const areas: ExtractedChecklist["areas"] = [];
  const det = matchBetween(T, /Resultado detalhado\s+(?:Área|Area)\s+Resultado\s+Varia[cç][aã]o\*?/i, /\b(Subtotal|Total)\b/i);
  if (det) {
    const re = /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s\/\-&]+?)\s+(\d+)\s*\/\s*(\d+)\s*\((\d+(?:\.\d+)?)%\)\s*(-?\d+(?:\.\d+)?%)?/g;
    let m;
    while ((m = re.exec(det)) !== null) {
      areas.push({ area: m[1].trim(), resultado: `${m[2]}/${m[3]} (${m[4]}%)`, percentual: parsePctNumber(m[4]) });
    }
  }

  const historico: ExtractedChecklist["historico"] = [];
  const histBlock = T.match(/(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4})+)\s+([\d\s.,]+?)\s+Nota do checklist\s+Inconformidades/i);
  if (histBlock) {
    const dateTokens = histBlock[1].match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
    const numTokens = histBlock[2].trim().split(/\s+/).filter(Boolean);
    const N = dateTokens.length;
    if (numTokens.length >= 2 * N && N > 0) {
      const tail = numTokens.slice(-2 * N);
      for (let i = 0; i < N; i++) {
        const d = parseDateBR(dateTokens[i]);
        if (!d) continue;
        historico.push({ data_resultado: d, nota_checklist: parseScoreToken(tail[i]), inconformidades: parseInconfToken(tail[N + i]) });
      }
    }
  }

  const itens: ExtractedChecklist["itens"] = [];
  const itensStart = T.search(/\bItens\s+(?:Área|Area)\s+\d+\s*\|/i);
  if (itensStart >= 0) {
    let block = T.slice(itensStart);
    const endIdx = block.search(/\*\s*A varia[cç][aã]o[^.]*?\./i);
    if (endIdx > 0) block = block.slice(0, endIdx);
    const areaParts = block.split(/(?:^|\s)(?:Área|Area)\s+(\d+)\s*\|\s*/);
    for (let k = 1; k < areaParts.length; k += 2) {
      const areaContent = areaParts[k + 1] ?? "";
      const headerMatch = areaContent.match(/^([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s\/\-&]+?)\s+\d+\/\d+\s+/);
      const currentArea = headerMatch ? headerMatch[1].trim() : null;
      const itemBlock = headerMatch ? areaContent.slice(headerMatch[0].length) : areaContent;
      const itemRe = /(.+?)\(Peso\s+(\d+)\s*\|[^)]*\)\s+(\d+\s*\/\s*\d+)\s+(Atingiu|N[aã]o atingiu|Sim|N[aã]o|N\/A)\b/g;
      let m;
      while ((m = itemRe.exec(itemBlock)) !== null) {
        const pergunta = m[1].replace(/\s+/g, " ").trim();
        if (!pergunta) continue;
        itens.push({ area: currentArea, pergunta, peso: parseFloat(m[2]), resultado: m[3].replace(/\s+/g, ""), status: m[4] });
      }
    }
  }

  // Calcula inconformidades
  let inconformidades = 0;
  if (historico.length > 0) {
    const sorted = [...historico].sort((a, b) => b.data_resultado.localeCompare(a.data_resultado));
    inconformidades = sorted[0]?.inconformidades ?? 0;
  } else {
    inconformidades = itens.filter((i) => /n[aã]o atingiu|n[aã]o$/i.test(i.status ?? "")).length;
  }

  // Campos obrigatórios não encontrados
  const camposNaoEncontrados: string[] = [];
  if (!checklist_id) camposNaoEncontrados.push("checklist_id");
  if (!autor) camposNaoEncontrados.push("autor");
  if (!unidade) camposNaoEncontrados.push("unidade");
  if (!data_visita) camposNaoEncontrados.push("data_visita");
  if (nota_final === null) camposNaoEncontrados.push("nota_final");

  return {
    checklist_id, nome_checklist, empresa_prestadora: null,
    autor, unidade, loja_numero, cidade_uf, endereco,
    data_visita, hora_inicio, hora_fim, duracao,
    resultado_parcial, resultado_final, nota_final,
    inconformidades, areas, historico, itens, camposNaoEncontrados,
  };
}
