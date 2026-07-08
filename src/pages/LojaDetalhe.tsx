import { useParams } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store, Wind, Calendar, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { checklistSupabase } from "@/integrations/checklist/client";
import { fmtScore, fmtDateBR, fmtNumber, scoreLabel } from "@/shared/utils/format";
import { formatStoreName } from "@/shared/utils/storeUtils";
import { cn } from "@/lib/utils";

const TABS = ["Visão Geral", "Checklists"] as const;
type Tab = typeof TABS[number];

export default function LojaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Visão Geral");

  // Determine if ID looks like a store number (digits only)
  const isNumber = /^\d+$/.test(id ?? "");

  // Checklist data for this store
  const { data: clData } = useQuery({
    queryKey: ["loja-checklist", id],
    enabled: !!id,
    queryFn: async () => {
      const lojaRes = isNumber
        ? await checklistSupabase.from("lojas").select("id, unidade, loja_numero, cidade_uf, endereco").eq("loja_numero", id!).maybeSingle()
        : await checklistSupabase.from("lojas").select("id, unidade, loja_numero, cidade_uf, endereco").eq("id", id!).maybeSingle();
      const loja = lojaRes.data;
      if (!loja) return { loja: null, checklists: [] };
      const clRes = await checklistSupabase
        .from("checklists")
        .select("id, data_visita, nota_final, inconformidades, autor, empresa_prestadora")
        .eq("loja_id", loja.id)
        .eq("status", "sucesso")
        .order("data_visita", { ascending: false });
      return { loja, checklists: clRes.data ?? [] };
    },
  });

  const clLoja = clData?.loja;
  const checklists = clData?.checklists ?? [];

  const nomeLoja = clLoja ? formatStoreName(clLoja.unidade) : `Loja ${id}`;
  const notas = checklists.map((c) => c.nota_final).filter((n): n is number => n !== null);
  const avgNota = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const totalInc = checklists.reduce((s, c) => s + (c.inconformidades ?? 0), 0);

  // Evolução da nota
  const evolucaoNota = [...checklists]
    .filter((c) => c.data_visita && c.nota_final !== null)
    .sort((a, b) => (a.data_visita ?? "") < (b.data_visita ?? "") ? -1 : 1)
    .map((c) => ({ data: fmtDateBR(c.data_visita), nota: c.nota_final }));

  const isLoading = !clData;

  if (isLoading) {
    return (
      <div>
        <PageHeader title={`Loja ${id}`} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!clLoja) {
    return (
      <div>
        <PageHeader title={`Loja ${id}`} />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Loja não encontrada</p>
          <p className="text-sm text-amber-600 mt-1">Nenhum registro encontrado para o identificador "{id}".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{nomeLoja}</h1>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {clLoja?.cidade_uf && <span>📍 {clLoja.cidade_uf}</span>}
              {clLoja?.loja_numero && <span>Código: {clLoja.loja_numero}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Visão Geral */}
      {tab === "Visão Geral" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard title="Checklists" value={fmtNumber(checklists.length)} icon={Wind} iconColor="bg-sky-100 text-sky-600" />
            <StatCard title="Média Nota" value={avgNota != null ? fmtScore(avgNota) : "—"} subtitle={scoreLabel(avgNota)} icon={Wind} iconColor="bg-emerald-100 text-emerald-600" />
            <StatCard title="Inconformidades" value={fmtNumber(totalInc)} icon={AlertTriangle} iconColor="bg-red-100 text-red-600" />
            <StatCard title="Última Visita" value={fmtDateBR(checklists[0]?.data_visita)} icon={Calendar} iconColor="bg-blue-100 text-blue-600" />
          </div>

          {evolucaoNota.length > 1 && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Evolução da Nota</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolucaoNota} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="nota" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Tab: Checklists */}
      {tab === "Checklists" && (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Data", "Nota", "Status", "Inconform.", "Técnico", "Empresa"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checklists.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateBR(c.data_visita)}</td>
                    <td className={cn("px-4 py-3 font-semibold",
                      c.nota_final == null ? "" : c.nota_final >= 95 ? "text-emerald-600" : c.nota_final >= 80 ? "text-amber-600" : "text-red-600"
                    )}>{c.nota_final != null ? fmtScore(c.nota_final) : "—"}</td>
                    <td className="px-4 py-3 text-xs">{scoreLabel(c.nota_final)}</td>
                    <td className="px-4 py-3 text-center">{c.inconformidades ?? 0}</td>
                    <td className="px-4 py-3">{c.autor ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.empresa_prestadora ?? "—"}</td>
                  </tr>
                ))}
                {!checklists.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sem checklists registrados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
