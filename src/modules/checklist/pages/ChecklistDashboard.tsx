import { useState } from "react";
import { Wind, ClipboardCheck, AlertTriangle, Store, TrendingUp, Calendar, Download, Trophy, ThumbsDown, MapPin, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { useChecklistData } from "../hooks/useChecklistData";
import { fmtScore, fmtDateBR, fmtNumber, scoreLabel } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { formatStoreName } from "@/shared/utils/storeUtils";
import { cn } from "@/lib/utils";

export default function ChecklistDashboard() {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");

  const data = useChecklistData({ selectedMonth, selectedStore, selectedTechnician });

  if (data.isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard — Ar-Condicionado" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div>
        <PageHeader title="Dashboard — Ar-Condicionado" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-700">Não foi possível carregar os dados deste módulo.</p>
          <p className="text-xs text-red-500 mt-1">Verifique permissões ou políticas do Supabase.</p>
        </div>
      </div>
    );
  }

  const { cards, mediaPorMes, topInconformidades, faixas, lojasRank, lojasPrecisaAtencao, resumoMensal, lojasSemVisita } = data;

  // Melhor e pior loja (ao menos 1 checklist)
  const lojasComNotas = (lojasRank ?? []).filter((l) => l.notas.length > 0);
  const melhorLoja = [...lojasComNotas].sort((a, b) => b.media - a.media)[0] ?? null;
  const piorLoja   = [...lojasComNotas].sort((a, b) => a.media - b.media)[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard — Ar-Condicionado" subtitle="Análise de checklists de climatização" />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            Mês
            <span title="Filtra todos os cards, gráficos e rankings pelo mês selecionado">
              <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
            </span>
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos os meses</option>
            {data.mesesDisponiveis?.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            Loja
            <span title="Filtra todos os dados para a loja selecionada. 'Lojas sem visita' mostra as não visitadas no período.">
              <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
            </span>
          </label>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todas as lojas</option>
            {data.lojasDisponiveis?.map((l) => (
              <option key={l.id} value={l.id}>{l.unidade?.replace(/PROMOFARMA\s*/i, "").trim()}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            Técnico / Prestador
            <span title="Filtra pelo técnico responsável pelas visitas. Afeta ranking de lojas e todos os cards.">
              <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
            </span>
          </label>
          <select
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Todos os técnicos</option>
            {data.tecnicosDisponiveis?.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {(selectedMonth !== "all" || selectedStore !== "all" || selectedTechnician !== "all") && (
          <button
            onClick={() => { setSelectedMonth("all"); setSelectedStore("all"); setSelectedTechnician("all"); }}
            className="mt-4 text-xs text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="Checklists" value={fmtNumber(cards?.total ?? 0)} icon={ClipboardCheck} iconColor="bg-sky-100 text-sky-600" />
        <StatCard
          title="Média Geral"
          value={cards?.media != null ? fmtScore(cards.media) : "—"}
          subtitle={cards?.media != null ? scoreLabel(cards.media) : ""}
          icon={TrendingUp}
          iconColor="bg-emerald-100 text-emerald-600"
        />
        <StatCard title="Inconformidades" value={fmtNumber(cards?.totalInc ?? 0)} icon={AlertTriangle} iconColor="bg-red-100 text-red-600" />
        <StatCard title="Lojas Avaliadas" value={fmtNumber(cards?.lojasAvaliadas ?? 0)} icon={Store} iconColor="bg-blue-100 text-blue-600" />
        <StatCard
          title="Última Visita"
          value={fmtDateBR(cards?.ultimaData)}
          subtitle={cards?.ultimaLojaNome ?? undefined}
          icon={Calendar}
          iconColor="bg-violet-100 text-violet-600"
        />
        <StatCard
          title="Técnico"
          value={cards?.ultimaTecnico ?? "—"}
          subtitle="Última visita"
          icon={Wind}
          iconColor="bg-indigo-100 text-indigo-600"
        />
      </div>

      {/* Melhor e Pior Loja */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Melhor Loja */}
        <div className="rounded-xl border bg-card p-5 flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Trophy className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Melhor Loja</p>
            {melhorLoja ? (
              <>
                <p className="mt-0.5 text-base font-bold leading-tight truncate">{melhorLoja.fullNome}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold text-emerald-700">
                    {fmtScore(melhorLoja.media)}
                  </span>
                  <span className="text-xs text-muted-foreground">{melhorLoja.count} checklist{melhorLoja.count !== 1 ? "s" : ""}</span>
                  <span className="text-xs text-muted-foreground">{melhorLoja.inc} inconform.</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Última visita: {fmtDateBR(melhorLoja.ultimaVisita)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Sem dados</p>
            )}
          </div>
        </div>

        {/* Pior Loja */}
        <div className="rounded-xl border bg-card p-5 flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <ThumbsDown className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pior Loja</p>
            {piorLoja && piorLoja.lid !== melhorLoja?.lid ? (
              <>
                <p className="mt-0.5 text-base font-bold leading-tight truncate">{piorLoja.fullNome}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-sm font-bold",
                    piorLoja.media >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {fmtScore(piorLoja.media)}
                  </span>
                  <span className="text-xs text-muted-foreground">{piorLoja.count} checklist{piorLoja.count !== 1 ? "s" : ""}</span>
                  <span className="text-xs text-red-600 font-medium">{piorLoja.inc} inconform.</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Última visita: {fmtDateBR(piorLoja.ultimaVisita)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Média das Notas por Mês</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mediaPorMes} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => v.toFixed(2)} />
              <Line type="monotone" dataKey="media" name="Média" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Distribuição por Faixa</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={faixas}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                dataKey="value"
                paddingAngle={2}
              >
                {faixas?.map((f, i) => <Cell key={i} fill={f.color} />)}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legenda com valores — sem sobreposição */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {faixas?.map((f) => {
              const total = faixas.reduce((s, x) => s + x.value, 0);
              const pct = total > 0 ? ((f.value / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={f.name} className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: f.color }} />
                  <span className="text-muted-foreground">{f.name}</span>
                  <span className="ml-auto font-semibold tabular-nums">{f.value}</span>
                  <span className="text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Top Lojas — Mais Inconformidades</h3>
        {topInconformidades && topInconformidades.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topInconformidades} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="loja" tick={{ fontSize: 11 }} width={78} />
              <Tooltip />
              <Bar dataKey="inc" name="Inconformidades" fill="#ef4444" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma inconformidade no período selecionado.</p>
        )}
      </div>

      {/* Lojas que precisam de atenção + Resumo mensal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lojas que precisam de atenção */}
        <div className="rounded-xl border bg-card flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Lojas que precisam de atenção
            </h3>
            <button
              onClick={() => exportToCsv("atencao", (lojasPrecisaAtencao ?? []).map((l) => ({
                Loja: l.fullNome, Média: fmtScore(l.media), Inconformidades: l.inc,
                Técnico: l.ultimaTecnico ?? "—", "Última Visita": fmtDateBR(l.ultimaVisita),
                Motivo: l.motivos.join("; "),
              })))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y max-h-[420px]">
            {(lojasPrecisaAtencao ?? []).length === 0 && (
              <p className="px-5 py-8 text-sm text-center text-muted-foreground">Nenhuma loja com atenção necessária.</p>
            )}
            {(lojasPrecisaAtencao ?? []).map((l) => (
              <div key={l.lid} className="px-5 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{l.fullNome}</p>
                    <p className="text-xs text-muted-foreground">Última visita: {fmtDateBR(l.ultimaVisita)}</p>
                    <p className="text-xs text-muted-foreground">Técnico: {l.ultimaTecnico ?? "—"}</p>
                    {l.motivos.length > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">Motivo: {l.motivos.join(" · ")}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-xs font-bold",
                      l.media >= 95 ? "bg-emerald-100 text-emerald-700" :
                      l.media >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    )}>
                      {scoreLabel(l.media)}
                    </span>
                    <p className={cn("text-sm font-bold mt-1", l.media >= 95 ? "text-emerald-600" : l.media >= 80 ? "text-amber-600" : "text-red-600")}>
                      Nota: {fmtScore(l.media)}
                    </p>
                    <p className="text-xs text-muted-foreground">Inconf.: {l.inc}</p>
                    {l.variacao !== null && (
                      <p className={cn("text-xs font-semibold mt-0.5", l.variacao >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {l.variacao >= 0 ? "+" : ""}{fmtScore(l.variacao)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo mensal */}
        <div className="rounded-xl border bg-card flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="text-sm font-semibold">Resumo mensal</h3>
            <button
              onClick={() => exportToCsv("resumo-mensal", (resumoMensal ?? []).map((r) => ({
                Mês: r.mes, Checklists: r.checklists, Lojas: r.lojas,
                Média: fmtScore(r.media), Inconformidades: r.inc,
              })))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Mês", "Checklists", "Lojas", "Média", "Inconf."].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(resumoMensal ?? []).map((r) => (
                  <tr key={r.mes} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium capitalize">{r.mes}</td>
                    <td className="px-4 py-2.5">{r.checklists}</td>
                    <td className="px-4 py-2.5">{r.lojas}</td>
                    <td className={cn("px-4 py-2.5 font-semibold",
                      r.media >= 95 ? "text-emerald-600" : r.media >= 80 ? "text-amber-600" : "text-red-600"
                    )}>
                      {fmtScore(r.media)}
                    </td>
                    <td className={cn("px-4 py-2.5", r.inc > 0 ? "text-red-600 font-semibold" : "text-emerald-600")}>
                      {r.inc}
                    </td>
                  </tr>
                ))}
                {(resumoMensal ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sem dados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lojas sem visita */}
      {(lojasSemVisita ?? []).length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-500" />
              Lojas Sem Visita
              {selectedMonth !== "all" && (
                <span className="text-xs font-normal text-muted-foreground ml-1">no mês selecionado</span>
              )}
            </h3>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5">
                {(lojasSemVisita ?? []).length} loja{(lojasSemVisita ?? []).length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => exportToCsv("lojas-sem-visita", (lojasSemVisita ?? []).map((l) => ({
                  Loja: formatStoreName(l.unidade),
                  "Nº Loja": l.loja_numero ?? "—",
                  "Cidade/UF": l.cidade_uf ?? "—",
                })))}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {(lojasSemVisita ?? []).map((l) => (
                <span
                  key={l.id}
                  title={l.cidade_uf ?? ""}
                  className="rounded-full border bg-amber-50 border-amber-200 px-3 py-1 text-xs text-amber-800 font-medium"
                >
                  {l.unidade?.replace(/PROMOFARMA\s*/i, "").trim()}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ranking por loja */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-sm font-semibold">Ranking de Lojas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Loja", "Checklists", "Média", "Inconform.", "Última Visita"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lojasRank?.sort((a, b) => b.media - a.media).map((l) => (
                <tr key={l.lid} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{l.fullNome}</td>
                  <td className="px-4 py-3 text-center">{l.count}</td>
                  <td className={cn(
                    "px-4 py-3 text-center font-semibold",
                    l.media >= 95 ? "text-emerald-600" : l.media >= 80 ? "text-amber-600" : "text-red-600",
                  )}>
                    {fmtScore(l.media)}
                  </td>
                  <td className="px-4 py-3 text-center">{l.inc}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDateBR(l.ultimaVisita)}</td>
                </tr>
              ))}
              {!lojasRank?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
