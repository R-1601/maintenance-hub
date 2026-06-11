/**
 * checklistImportKey.ts
 * Gera uma chave composta de importação para detectar checklists duplicados
 * mesmo quando enviados com nomes de arquivo diferentes.
 *
 * Chave: loja_numero + data_visita + nota_final
 * Essa combinação é praticamente única para cada visita real.
 */

/**
 * Constrói a chave de importação normalizada.
 * Retorna null se não tiver dados suficientes para gerar uma chave confiável.
 */
export function buildImportKey(
  loja_numero: string | null | undefined,
  data_visita: string | null | undefined,
  nota_final: number | null | undefined,
): string | null {
  const l = (loja_numero ?? "").trim();
  const d = (data_visita ?? "").slice(0, 10).trim(); // apenas YYYY-MM-DD
  if (!l || !d) return null; // sem loja ou data não gera chave confiável
  const n = nota_final != null ? nota_final.toFixed(2) : "sem-nota";
  return `${l}|${d}|${n}`;
}
