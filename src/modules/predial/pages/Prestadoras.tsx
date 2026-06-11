import { useMemo } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { usePredialData } from "../hooks/usePredialData";
import { fmtMoney, fmtNumber } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";

export default function Prestadoras() {
  const data = usePredialData();

  const ranking = useMemo(() => {
    return (data.prestadoras ?? []).map((p) => {
      const osP = (data.allOS ?? []).filter((o) => o.prestadora_id === p.id);
      const custo = osP.reduce((s, o) => s + Number(o.custo_total ?? 0), 0);
      const concluidas = osP.filter((o) => o.status === "concluida").length;
      return { ...p, qtdOS: osP.length, custo, concluidas };
    }).sort((a, b) => b.custo - a.custo);
  }, [data.prestadoras, data.allOS]);

  const handleExport = () => {
    exportToCsv("prestadoras", ranking.map((p) => ({
      Nome: p.nome, "Total OS": p.qtdOS, "OS Concluídas": p.concluidas, "Custo Total": p.custo,
    })));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Prestadoras" subtitle="Desempenho por prestadora de serviço">
        <button onClick={handleExport} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </PageHeader>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["#", "Prestadora", "Total OS", "OS Concluídas", "Custo Total"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center">Carregando...</td></tr>}
              {!data.isLoading && ranking.map((p, i) => (
                <tr key={p.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.nome}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(p.qtdOS)}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(p.concluidas)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(p.custo)}</td>
                </tr>
              ))}
              {!data.isLoading && !ranking.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
