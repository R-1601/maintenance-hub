export const safeText = (v: unknown, fallback = "Não identificado"): string => {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  if (!s || ["null", "undefined", "nan", "none"].includes(s.toLowerCase())) return fallback;
  return s;
};

export const fmtNumber = (v: unknown, digits = 0): string => {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(v));
};

export const fmtMoney = (v: unknown): string => {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
};

export const fmtDateBR = (v: unknown): string => {
  if (!v) return "—";
  const s = String(v);
  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  return s;
};

export const fmtScore = (v: unknown): string => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return Number(v).toFixed(2).replace(".", ",");
};

export const fmtPercent = (v: unknown): string => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toFixed(1).replace(".", ",")}%`;
};

export const scoreColor = (nota: number | null | undefined) => {
  if (nota == null) return "text-muted-foreground";
  if (nota >= 95) return "text-emerald-600";
  if (nota >= 80) return "text-amber-600";
  return "text-red-600";
};

export const scoreLabel = (nota: number | null | undefined): string => {
  if (nota == null) return "—";
  if (nota >= 95) return "Conforme";
  if (nota >= 80) return "Atenção";
  return "Crítico";
};

export const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MESES_PT[idx] ?? m}/${y?.slice(2)}`;
};
