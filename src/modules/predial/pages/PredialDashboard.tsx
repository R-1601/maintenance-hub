import { useState } from "react";
import { Wrench, DollarSign, Store, AlertTriangle, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { usePredialData } from "../hooks/usePredialData";
import { fmtMoney, fmtNumber } from "@/shared/utils/format";
import { cn } from "@/lib/utils";

const COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#06b6d4", "#f43f5e", "#84cc16"];

export default function PredialDashboard() {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedPrestadora, setSelectedPrestadora] = useState("all");

  const data = usePredialData({ selectedMonth, selectedStore, selectedPrestadora });

  if (data.isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard — Manutenção Predial" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div>
        <PageHeader title="Dashboard — Manutenção Predial" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-700">Não foi possível carregar os dados deste módulo.</p>
          <p className="text-xs text-red-500 mt-1">Verifique permissões ou políticas do Supabase.</p>
        </div>
      </div>
    );
  }

  const { cards, topLojasCusto, evolucaoMensal, porCategoria, porPrestadora } = data;

  // Nomes dos filtros ativos para badges
  const mesAtivo   = data.mesesDisponiveis?.find((m) => m.value === selectedMonth)?.label;
  const lojaAtiva  = data.lojas?.find((l) => l.id === selectedStore)?.nome;
  const prestAtiva = data.prestadoras?.find((p) => p.id === selectedPrestadora)?.nome;
  const filtrosAtivos = [
    mesAtivo   && { key: "mes",   label: mesAtivo,   clear: () => setSelectedMonth("all") },
    lojaAtiva  && { key: "loja",  label: lojaAtiva,  clear: () => setSelectedStore("all") },
    prestAtiva && { key: "prest", label: prestAtiva, clear: () => setSelectedPrestadora("all") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const catTotal = porCategoria?.length ?? 0;
  const catShown = Math.min(catTotal, 8);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard — Manutenção Predial" subtitle="Ordens de serviço e custos" />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background",
            selectedMonth !== "all" && "border-primary ring-1 ring-primary font-medium")}>
          <option value="all">Todos os meses</option>
          {data.mesesDisponiveis?.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background",
            selectedStore !== "all" && "border-primary ring-1 ring-primary font-medium")}>
          <option value="all">Todas as lojas</option>
          {data.lojas?.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>

        <select value={selectedPrestadora} onChange={(e) => setSelectedPrestadora(e.target.value)}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background",
            selectedPrestadora !== "all" && "border-primary ring-1 ring-primary font-medium")}>
          <option value="all">Todas as prestadoras</option>
          {data.prestadoras?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>

        {/* Badges de filtros ativos */}
        {filtrosAtivos.map((f) => (
          <span key={f.key}
            className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary">
            {f.label}
            <button onClick={f.clear} className="ml-0.5 hover:text-red-500 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total OS"        value={fmtNumber(cards?.totalOS     ?? 0)} icon={Wrench}    iconColor="bg-amber-100 text-amber-600" />
        <StatCard title="Custo Total"     value={fmtMoney(cards?.totalCusto   ?? 0)} icon={DollarSign} iconColor="bg-orange-100 text-orange-600" />
        <StatCard title="Custo Médio"     value={fmtMoney(cards?.custoMedio   ?? 0)} icon={DollarSign} iconColor="bg-yellow-100 text-yellow-600" />
        <StatCard title="Lojas Atendidas" value={fmtNumber(cards?.lojasAtendidas ?? 0)} icon={Store}  iconColor="bg-blue-100 text-blue-600" />
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Top 10 Lojas por Custo</h3>
          {topLojasCusto?.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topLojasCusto} layout="vertical" margin={{ top: 0, right: 10, left: 70, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={68} />
                <Tooltip formatter={(v) => fmtMoney(v)} />
                <Bar dataKey="custo" name="Custo" fill={COLORS[0]} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Evolução Mensal dos Custos</h3>
          {evolucaoMensal?.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={evolucaoMensal} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtMoney(v)} />
                <Line type="monotone" dataKey="custo" name="Custo" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>}
        </div>
      </div>

      {/* Custo por Categoria e Prestadora */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Custo por Categoria</h3>
            {catTotal > catShown && (
              <span className="text-xs text-muted-foreground">
                {catShown} de {catTotal} categorias
              </span>
            )}
          </div>
          {porCategoria?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porCategoria?.slice(0, catShown)} layout="vertical" margin={{ top: 0, right: 10, left: 70, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={68} />
                <Tooltip formatter={(v) => fmtMoney(v)} />
                <Bar dataKey="custo" fill={COLORS[1]} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Custo por Prestadora</h3>
          {porPrestadora?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porPrestadora?.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 10, left: 70, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={68} />
                <Tooltip formatter={(v) => fmtMoney(v)} />
                <Bar dataKey="custo" fill={COLORS[2]} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>}
        </div>
      </div>
    </div>
  );
}
