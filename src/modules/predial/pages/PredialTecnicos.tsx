import { useMemo } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { usePredialData } from "../hooks/usePredialData";
import { fmtMoney, fmtNumber } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";

export default function PredialTecnicos() {
  const data = usePredialData();

  const ranking = useMemo(() => {
    return (data.tecnicos ?? []).map((t) => {
      const osT = (data.allOS ?? []).filter((o) => o.tecnico_responsavel_id === t.id);
      const custo = osT.reduce((s, o) => s + Number(o.custo_total ?? 0), 0);
      const concluidas = osT.filter((o) => o.status === "concluida").length;
      return { ...t, qtdOS: osT.length, custo, concluidas };
    }).sort((a, b) => b.qtdOS - a.qtdOS);
  }, [data.tecnicos, data.allOS]);

  const handleExport = () => {
    exportToCsv("tecnicos-predial", ranking.map((t) => ({
      Nome: t.nome, "Total OS": t.qtdOS, "OS Concluídas": t.concluidas, "Custo Total": t.custo,
    })));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Técnicos" subtitle="Desempenho dos técnicos de manutenção predial">
        <button onClick={handleExport} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </PageHeader>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["#", "Técnico", "Total OS", "OS Concluídas", "Custo Total"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center">Carregando...</td></tr>}
              {!data.isLoading && ranking.map((t, i) => (
                <tr key={t.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{t.nome}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(t.qtdOS)}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(t.concluidas)}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(t.custo)}</td>
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
