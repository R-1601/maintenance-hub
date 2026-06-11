import { useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { useChecklistData } from "../hooks/useChecklistData";
import { fmtScore, fmtDateBR, fmtNumber, scoreLabel } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { cn } from "@/lib/utils";

export default function ChecklistLojas() {
  const [selectedMonth, setSelectedMonth]         = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");

  const data = useChecklistData({ selectedMonth, selectedTechnician });

  const handleExport = () => {
    exportToCsv("lojas-checklists", (data.lojasRank ?? []).sort((a, b) => b.media - a.media).map((l) => ({
      Loja: l.fullNome,
      Checklists: l.count,
      "Média Nota": l.media.toFixed(2),
      Status: scoreLabel(l.media),
      Inconformidades: l.inc,
      "Última Visita": fmtDateBR(l.ultimaVisita),
    })));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Lojas Avaliadas" subtitle="Desempenho por loja nos checklists de AC">
        <button onClick={handleExport} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </PageHeader>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todos os meses</option>
          {data.mesesDisponiveis?.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <select value={selectedTechnician} onChange={(e) => setSelectedTechnician(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todos os técnicos</option>
          {data.tecnicosDisponiveis?.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <span className="self-center text-xs text-muted-foreground">
          {data.lojasRank?.length ?? 0} lojas
        </span>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["#", "Loja", "Checklists", "Média Nota", "Status", "Inconform.", "Última Visita"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center">Carregando...</td></tr>
              )}
              {!data.isLoading && (data.lojasRank ?? []).sort((a, b) => b.media - a.media).map((l, i) => (
                <tr key={l.lid} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{l.fullNome}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(l.count)}</td>
                  <td className={cn("px-4 py-3 text-center font-bold",
                    l.media >= 95 ? "text-emerald-600" : l.media >= 80 ? "text-amber-600" : "text-red-600"
                  )}>
                    {fmtScore(l.media)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      l.media >= 95 ? "bg-emerald-100 text-emerald-700" :
                      l.media >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    )}>
                      {scoreLabel(l.media)}
                    </span>
                  </td>
                  <td className={cn("px-4 py-3 text-center font-semibold",
                    l.inc > 0 ? "text-red-600" : "text-emerald-600"
                  )}>
                    {l.inc}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDateBR(l.ultimaVisita)}</td>
                </tr>
              ))}
              {!data.isLoading && !data.lojasRank?.length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
