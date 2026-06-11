/** Extrai número da loja de qualquer formato de string. */
export function extractStoreNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  // "LOJA 75", "Loja 75", "loja75"
  const m = String(value).match(/LOJA\s*(\d+)/i);
  if (m) return m[1];
  // só número
  const n = String(value).match(/^\s*(\d+)\s*$/);
  if (n) return n[1];
  return null;
}

/** Retorna "Loja 75 - JARDIM SANTO ELIAS" a partir de diferentes formatos. */
export function formatStoreName(rawName: string | null | undefined): string {
  if (!rawName) return "Não identificado";
  const s = String(rawName);
  // Remove prefixo PROMOFARMA
  const clean = s.replace(/PROMOFARMA\s*/i, "").trim();
  // "LOJA 75 - JARDIM SANTO ELIAS" -> "Loja 75 - JARDIM SANTO ELIAS"
  const m = clean.match(/LOJA\s+(\d+)\s*[-–]?\s*(.*)/i);
  if (m) {
    const bairro = m[2]?.trim();
    return bairro ? `Loja ${m[1]} - ${bairro}` : `Loja ${m[1]}`;
  }
  return clean || rawName;
}

export function shortStoreName(rawName: string | null | undefined): string {
  if (!rawName) return "—";
  const num = extractStoreNumber(rawName);
  if (num) return `Loja ${num}`;
  return String(rawName).replace(/PROMOFARMA\s*/i, "").trim() || "—";
}
