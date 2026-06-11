import { useState, useMemo } from "react";
import { Download, TrendingUp, X, ArrowUp, ArrowDown, Minus } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { useChecklistData } from "../hooks/useChecklistData";
import { fmtScore, fmtDateBR, fmtNumber, scoreLabel } from "@/shared/utils/format";
import { formatStoreName } from "@/shared/utils/storeUtils";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { cn } from "@/lib/utils";

/* ─── Tooltip customizado do gráfico ─────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const nota = payload[0].value;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className={cn("font-bold text-base",
        nota >= 95 ? "text-emerald-600" : nota >= 80 ? "text-amber-600" : "text-red-600"
      )}>
        {nota.toFixed(2)}
      </p>
    </div>
  );
}

/* ─── Modal histórico ─────────────────────────────────────────────── */
type HistoricoLoja = {
  lid: string;
  fullNome: string;
  media: number;
  count: number;
  inc: number;
};

function ModalHistorico({
  loja,
  allChecklists,
  onClose,
}: {
  loja: HistoricoLoja;
  allChecklists: { loja_id: string | null; data_visita: string | null; nota_final: number | null; inconformidades: number | null; autor: string | null }[];
  onClose: () => void;
}) {
  const visitas = useMemo(() => {
    return allChecklists
      .filter((c) => c.loja_id === loja.lid && c.data_visita && c.nota_final !== null)
      .sort((a, b) => (a.data_visita! < b.data_visita! ? -1 : 1))
      .map((c) => ({
        data: fmtDateBR(c.data_visita),
        dataRaw: c.data_visita!,
        nota: c.nota_final!,
        inc: c.inconformidades ?? 0,
        tecnico: c.autor ?? "—",
      }));
  }, [allChecklists, loja.lid]);

  // Variação entre a última e a penúltima visita
  const variacao = visitas.length >= 2
    ? visitas[visitas.length - 1].nota - visitas[visitas.length - 2].nota
    : null;

  const notaMin = visitas.length ? Math.min(...visitas.map((v) => v.nota)) : 0;
  const notaMax = visitas.length ? Math.max(...visitas.map((v) => v.nota)) : 100;
  const yDomain: [number, number] = [Math.max(0, Math.floor(notaMin - 5)), Math.min(100, Math.ceil(notaMax + 5))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Histórico de Evolução
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{loja.fullNome}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b bg-muted/20">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Visitas</p>
            <p className="text-2xl font-bold">{visitas.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Média Geral</p>
            <p className={cn("text-2xl font-bold",
              loja.media >= 95 ? "text-emerald-600" : loja.media >= 80 ? "text-amber-600" : "text-red-600"
            )}>
              {fmtScore(loja.media)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Última vs Anterior</p>
            {variacao === null ? (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            ) : (
              <p className={cn("text-2xl font-bold flex items-center justify-center gap-1",
                variacao > 0 ? "text-emerald-600" : variacao < 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {variacao > 0 ? <ArrowUp className="h-5 w-5" /> : variacao < 0 ? <ArrowDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                {Math.abs(variacao).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* Gráfico */}
        <div className="px-6 pt-4 pb-2">
          {visitas.length < 2 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
              Necessário pelo menos 2 visitas para exibir o gráfico
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={visitas} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis domain={yDomain} tick={{ fontSize: 11 }} width={36} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: "Meta 95", fill: "#10b981", fontSize: 10, position: "insideTopRight" }} />
                <Line
                  type="monotone"
                  dataKey="nota"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela de visitas */}
        <div className="px-6 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico de Visitas</p>
          <div className="rounded-lg border overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 z-10">
                <tr>
                  {["Data", "Nota", "Inconformidades", "Técnico"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...visitas].reverse().map((v, i) => (
                  <tr key={i} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{v.data}</td>
                    <td className={cn("px-3 py-2 font-bold",
                      v.nota >= 95 ? "text-emerald-600" : v.nota >= 80 ? "text-amber-600" : "text-red-600"
                    )}>
                      {v.nota.toFixed(2)}
                    </td>
                    <td className={cn("px-3 py-2", v.inc > 0 ? "text-red-600 font-semibold" : "text-emerald-600")}>
                      {v.inc}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{v.tecnico}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ────────────────────────────────────────────── */
export default function ChecklistLojas() {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const [lojaHistorico, setLojaHistorico] = useState<HistoricoLoja | null>(null);

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
      <PageHeader title="Ranking de Lojas" subtitle="Desempenho consolidado por loja — clique em uma loja para ver o histórico de evolução">
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
                {["#", "Loja", "Checklists", "Média Nota", "Status", "Inconform.", "Última Visita", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center">Carregando...</td></tr>
              )}
              {!data.isLoading && (data.lojasRank ?? []).sort((a, b) => b.media - a.media).map((l, i) => (
                <tr
                  key={l.lid}
                  className="border-b hover:bg-muted/20 cursor-pointer"
                  onClick={() => setLojaHistorico({ lid: l.lid, fullNome: l.fullNome, media: l.media, count: l.count, inc: l.inc })}
                >
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
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <TrendingUp className="h-3.5 w-3.5" /> Ver histórico
                    </span>
                  </td>
                </tr>
              ))}
              {!data.isLoading && !data.lojasRank?.length && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal histórico */}
      {lojaHistorico && (
        <ModalHistorico
          loja={lojaHistorico}
          allChecklists={data.allChecklists ?? []}
          onClose={() => setLojaHistorico(null)}
        />
      )}
    </div>
  );
}
