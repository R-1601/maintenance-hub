/**
 * checklistUtils.ts
 * Utilitários centralizados para o módulo de Checklist AC.
 * Re-exporta funções comuns e adiciona helpers específicos do domínio.
 */

// ─── Re-exports ────────────────────────────────────────────────────────────────
export { formatStoreName, shortStoreName } from "./storeUtils";
export { fmtScore, fmtDateBR, fmtNumber, fmtMoney, scoreLabel, scoreColor } from "./format";
export { exportToCsv } from "./exportCsv";

// ─── Helpers de nota ───────────────────────────────────────────────────────────

/** Retorna a classe CSS de cor com base na nota (tailwind). */
export function notaColorClass(nota: number | null | undefined): string {
  if (nota == null) return "text-muted-foreground";
  if (nota >= 95) return "text-emerald-600";
  if (nota >= 80) return "text-amber-600";
  return "text-red-600";
}

/** Retorna a classe CSS de badge com base na nota. */
export function notaBadgeClass(nota: number | null | undefined): string {
  if (nota == null) return "bg-gray-100 text-gray-500";
  if (nota >= 95) return "bg-emerald-100 text-emerald-700";
  if (nota >= 80) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

/** Rótulo de severidade para uma nota. */
export function notaLabel(nota: number | null | undefined): string {
  if (nota == null) return "Sem nota";
  if (nota >= 95) return "Excelente";
  if (nota >= 80) return "Bom";
  if (nota >= 60) return "Regular";
  return "Crítico";
}

// ─── Helper de loja ────────────────────────────────────────────────────────────

/** Normaliza nome de loja: remove prefixo "PROMOFARMA" e faz trim. */
export function normalizeLoja(unidade: string | null | undefined): string {
  if (!unidade) return "Não identificado";
  return unidade.replace(/PROMOFARMA\s*/i, "").trim() || "Não identificado";
}

// ─── Helper de técnico ─────────────────────────────────────────────────────────

/** Retorna nome do técnico ou "Não identificado". */
export function normalizeTecnico(autor: string | null | undefined): string {
  return (autor ?? "").trim() || "Não identificado";
}

// ─── Helper de status de importação ───────────────────────────────────────────

export type ImportStatus =
  | "aguardando_conferencia"
  | "confirmado"
  | "rejeitado"
  | "sucesso"
  | "aprovado"
  | "erro"
  | "duplicado";

export const IMPORT_STATUS_LABEL: Record<string, string> = {
  aguardando_conferencia: "Aguardando conferência",
  confirmado: "Confirmado",
  rejeitado: "Rejeitado",
  sucesso: "Processado",
  aprovado: "Aprovado",
  erro: "Erro",
  duplicado: "Duplicado",
};

export const IMPORT_STATUS_COLOR: Record<string, string> = {
  aguardando_conferencia: "bg-sky-100 text-sky-700",
  confirmado: "bg-emerald-100 text-emerald-700",
  sucesso: "bg-emerald-100 text-emerald-700",
  aprovado: "bg-emerald-100 text-emerald-700",
  rejeitado: "bg-red-100 text-red-700",
  erro: "bg-red-100 text-red-700",
  duplicado: "bg-gray-100 text-gray-500",
};
