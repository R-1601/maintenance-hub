import { useState } from "react";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { usePredialData } from "../hooks/usePredialData";
import { fmtMoney, fmtNumber } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";

export default function CustosLoja() {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const data = usePredialData({ selectedMonth });

  const porLoja = [...(data.lojas ?? [])].map((l) => {
    const osLoja = (data.os ?? []).filter((o) => o.loja_id === l.id);
    const custo     = osLoja.reduce((s, o) => s + Number(o.custo_total    ?? 0), 0);
    const maoObra   = osLoja.reduce((s, o) => s + Number(o.custo_mao_obra ?? 0), 0);
    const materiais = osLoja.reduce((s, o) => s + Number(o.custo_materiais ?? 0), 0);
    const pecas     = osLoja.reduce((s, o) => s + Number(o.custo_pecas    ?? 0), 0);
    // "Outros" = diferença entre custo_total e a soma dos componentes conhecidos
    const outros    = Math.max(0, custo - maoObra - materiais - pecas);
    return { nome: l.nome, custo, maoObra, materiais, pecas, outros, qtdOS: osLoja.length };
  }).filter((l) => l.custo > 0).sort((a, b) => b.custo - a.custo);

  const handleExport = () => {
    exportToCsv("custos-por-loja", porLoja.map((l) => ({
      Loja: l.nome, "Qtd OS": l.qtdOS, "Mão de Obra": l.maoObra,
      Materiais: l.materiais, Peças: l.pecas, Outros: l.outros, "Custo Total": l.custo,
    })));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Custos por Loja" subtitle="Breakdown de custos de manutenção por loja">
        <button onClick={handleExport} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todos os meses</option>
          {data.mesesDisponiveis?.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Top Lojas por Custo Total</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={porLoja.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 10, left: 100, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={98} />
            <Tooltip formatter={(v) => fmtMoney(v)} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="maoObra"   name="Mão de Obra" stackId="a" fill="#3b82f6" />
            <Bar dataKey="materiais" name="Materiais"   stackId="a" fill="#10b981" />
            <Bar dataKey="pecas"     name="Peças"       stackId="a" fill="#f59e0b" />
            <Bar dataKey="outros"    name="Outros"      stackId="a" fill="#a855f7" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["#", "Loja", "Qtd OS", "Mão de Obra", "Materiais", "Peças", "Outros", "Custo Total"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center">Carregando...</td></tr>}
              {!data.isLoading && porLoja.map((l, i) => (
                <tr key={l.nome} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium max-w-[160px] truncate">{l.nome}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(l.qtdOS)}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(l.maoObra)}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(l.materiais)}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(l.pecas)}</td>
                  <td className="px-4 py-3 text-right text-violet-600">{l.outros > 0 ? fmtMoney(l.outros) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(l.custo)}</td>
                </tr>
              ))}
              {!data.isLoading && !porLoja.length && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sem dados de custo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
