import { useParams } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store, Wind, Wrench, DollarSign, Package, Calendar, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { checklistSupabase } from "@/integrations/checklist/client";
import { predialSupabase } from "@/integrations/predial/client";
import { fmtMoney, fmtScore, fmtDateBR, fmtNumber, monthLabel, scoreLabel } from "@/shared/utils/format";
import { formatStoreName } from "@/shared/utils/storeUtils";
import { cn } from "@/lib/utils";

const TABS = ["Visão Geral", "Checklists", "Ordens de Serviço", "Custos", "Materiais"] as const;
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
      // Try by loja_numero first, then by unidade pattern
      const [lojaRes] = await Promise.all([
        isNumber
          ? checklistSupabase.from("lojas").select("id, unidade, loja_numero, cidade_uf, endereco").eq("loja_numero", id!).maybeSingle()
          : checklistSupabase.from("lojas").select("id, unidade, loja_numero, cidade_uf, endereco").eq("id", id!).maybeSingle(),
      ]);
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

  // Predial data for this store
  const { data: pdData } = useQuery({
    queryKey: ["loja-predial", id],
    enabled: !!id,
    queryFn: async () => {
      const lojaRes = isNumber
        ? await predialSupabase.from("lojas").select("id, nome, codigo_loja, cidade, estado, endereco").eq("codigo_loja", id!).maybeSingle()
        : await predialSupabase.from("lojas").select("id, nome, codigo_loja, cidade, estado, endereco").eq("id", id!).maybeSingle();
      const loja = lojaRes.data;
      if (!loja) return { loja: null, os: [], materiais: [] };
      const [osRes, matRes] = await Promise.all([
        predialSupabase
          .from("ordens_servico")
          .select("id, numero_os, status, custo_total, custo_mao_obra, custo_materiais, custo_pecas, data_abertura, data_conclusao, tipo_servico, prestadora_id, categoria_id")
          .eq("loja_id", loja.id)
          .order("data_abertura", { ascending: false }),
        predialSupabase.from("materiais").select("id, descricao, quantidade, valor_total, categoria, ordem_servico_id"),
      ]);
      const osIds = new Set((osRes.data ?? []).map((o: { id: string }) => o.id));
      const mats = (matRes.data ?? []).filter((m: { ordem_servico_id: string }) => osIds.has(m.ordem_servico_id));
      return { loja, os: osRes.data ?? [], materiais: mats };
    },
  });

  const clLoja = clData?.loja;
  const pdLoja = pdData?.loja;
  const checklists = clData?.checklists ?? [];
  const os = pdData?.os ?? [];
  const materiais = pdData?.materiais ?? [];

  const nomeLoja = clLoja ? formatStoreName(clLoja.unidade) : pdLoja?.nome ?? `Loja ${id}`;
  const notas = checklists.map((c) => c.nota_final).filter((n): n is number => n !== null);
  const avgNota = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const totalInc = checklists.reduce((s, c) => s + (c.inconformidades ?? 0), 0);
  const totalCusto = os.reduce((s, o) => s + Number(o.custo_total ?? 0), 0);
  const custoMedio = os.length ? totalCusto / os.length : 0;
  const totalMats = materiais.reduce((s, m) => s + Number(m.valor_total ?? 0), 0);

  // Evolução da nota
  const evolucaoNota = [...checklists]
    .filter((c) => c.data_visita && c.nota_final !== null)
    .sort((a, b) => (a.data_visita ?? "") < (b.data_visita ?? "") ? -1 : 1)
    .map((c) => ({ data: fmtDateBR(c.data_visita), nota: c.nota_final }));

  // Evolução custos por mês
  const custoMesMap = new Map<string, number>();
  for (const o of os) {
    if (!o.data_abertura) continue;
    const d = new Date(o.data_abertura);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    custoMesMap.set(key, (custoMesMap.get(key) ?? 0) + Number(o.custo_total ?? 0));
  }
  const evolucaoCusto = [...custoMesMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ mes: monthLabel(k), custo: v }));

  const isLoading = !clData && !pdData;

  if (isLoading) {
    return (
      <div>
        <PageHeader title={`Loja ${id}`} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!clLoja && !pdLoja) {
    return (
      <div>
        <PageHeader title={`Loja ${id}`} />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">Loja não encontrada</p>
          <p className="text-sm text-amber-600 mt-1">Nenhum registro encontrado para o identificador "{id}" nos dois sistemas.</p>
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
              {pdLoja?.cidade && <span>📍 {pdLoja.cidade}{pdLoja.estado ? `, ${pdLoja.estado}` : ""}</span>}
              {clLoja?.loja_numero && <span>Código: {clLoja.loja_numero}</span>}
              {pdLoja?.codigo_loja && <span>Código: {pdLoja.codigo_loja}</span>}
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
            <StatCard title="Total OS" value={fmtNumber(os.length)} icon={Wrench} iconColor="bg-amber-100 text-amber-600" />
            <StatCard title="Custo Total" value={fmtMoney(totalCusto)} icon={DollarSign} iconColor="bg-orange-100 text-orange-600" />
            <StatCard title="Custo Médio OS" value={fmtMoney(custoMedio)} icon={DollarSign} iconColor="bg-yellow-100 text-yellow-600" />
            <StatCard title="Total Materiais" value={fmtMoney(totalMats)} icon={Package} iconColor="bg-violet-100 text-violet-600" />
            <StatCard title="Última Visita" value={fmtDateBR(checklists[0]?.data_visita)} icon={Calendar} iconColor="bg-blue-100 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evolucaoNota.length > 1 && (
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold mb-4">Evolução da Nota</h3>
                <ResponsiveContainer width="100%" height={200}>
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
            {evolucaoCusto.length > 1 && (
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold mb-4">Evolução dos Custos</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={evolucaoCusto} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                    <Bar dataKey="custo" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
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

      {/* Tab: Ordens de Serviço */}
      {tab === "Ordens de Serviço" && (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Nº OS", "Status", "Tipo", "Custo Total", "Abertura", "Conclusão"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {os.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">{o.numero_os ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{o.status}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">{o.tipo_servico ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(o.custo_total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateBR(o.data_abertura)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateBR(o.data_conclusao)}</td>
                  </tr>
                ))}
                {!os.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sem ordens de serviço</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Custos */}
      {tab === "Custos" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Custo Total" value={fmtMoney(totalCusto)} icon={DollarSign} />
            <StatCard title="Mão de Obra" value={fmtMoney(os.reduce((s, o) => s + Number(o.custo_mao_obra ?? 0), 0))} icon={DollarSign} />
            <StatCard title="Materiais" value={fmtMoney(os.reduce((s, o) => s + Number(o.custo_materiais ?? 0), 0))} icon={DollarSign} />
            <StatCard title="Peças" value={fmtMoney(os.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0))} icon={DollarSign} />
          </div>
          {evolucaoCusto.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-4">Evolução Mensal dos Custos</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolucaoCusto} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Bar dataKey="custo" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Tab: Materiais */}
      {tab === "Materiais" && (
        <div className="rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Descrição", "Categoria", "Qtd", "Valor Total", "Nº OS"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materiais.map((m) => {
                  const osItem = (pdData?.os ?? []).find((o) => o.id === m.ordem_servico_id);
                  return (
                    <tr key={m.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3 max-w-[200px] truncate">{m.descricao}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.categoria ?? "—"}</td>
                      <td className="px-4 py-3 text-center">{m.quantidade ?? "—"}</td>
                      <td className="px-4 py-3 text-right">{fmtMoney(m.valor_total)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{osItem?.numero_os ?? "—"}</td>
                    </tr>
                  );
                })}
                {!materiais.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sem materiais registrados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
