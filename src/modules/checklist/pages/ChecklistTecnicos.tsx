import { useMemo } from "react";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { useChecklistData } from "../hooks/useChecklistData";
import { fmtScore, fmtNumber } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";

export default function ChecklistTecnicos() {
  const data = useChecklistData();

  const tecnicos = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; notas: number[]; inc: number }>();
    for (const c of data.allChecklists ?? []) {
      const nome = (c.autor ?? "").trim() || "Não identificado";
      const cur = map.get(nome) ?? { nome, count: 0, notas: [], inc: 0 };
      cur.count++;
      if (c.nota_final !== null) cur.notas.push(c.nota_final);
      cur.inc += c.inconformidades ?? 0;
      map.set(nome, cur);
    }
    return [...map.values()]
      .map((t) => ({
        ...t,
        media: t.notas.length ? t.notas.reduce((a, b) => a + b, 0) / t.notas.length : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data.allChecklists]);

  const handleExport = () => {
    exportToCsv("tecnicos-checklist", tecnicos.map((t) => ({
      Técnico: t.nome, Checklists: t.count,
      "Média Nota": t.media.toFixed(2), Inconformidades: t.inc,
    })));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Análise por Técnico" subtitle="Desempenho dos técnicos de climatização">
        <button onClick={handleExport} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </PageHeader>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Média por Técnico</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={tecnicos.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 10, left: 100, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={98} />
            <Tooltip formatter={(v: number) => v.toFixed(2)} />
            <Bar dataKey="media" name="Média" fill="#3b82f6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Técnico", "Checklists", "Média Nota", "Inconformidades"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tecnicos.map((t) => (
                <tr key={t.nome} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{t.nome}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(t.count)}</td>
                  <td className="px-4 py-3 text-center font-semibold">{fmtScore(t.media)}</td>
                  <td className="px-4 py-3 text-center">{t.inc}</td>
                </tr>
              ))}
              {!tecnicos.length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
