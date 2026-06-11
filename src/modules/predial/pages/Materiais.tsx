import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { usePredialData } from "../hooks/usePredialData";
import { fmtMoney, fmtNumber, fmtDateBR, safeText, monthLabel } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { Package, DollarSign } from "lucide-react";

export default function Materiais() {
  const [search, setSearch] = useState("");
  const [selectedLoja, setSelectedLoja] = useState("all");
  const [selectedCat, setSelectedCat] = useState("all");
  const data = usePredialData();

  // Mapas de lookup
  const osById    = useMemo(() => new Map((data.os    ?? []).map((o) => [o.id, o])),           [data.os]);
  const prestById = useMemo(() => new Map((data.prestadoras ?? []).map((p) => [p.id, p])),     [data.prestadoras]);
  const tecById   = useMemo(() => new Map((data.tecnicos   ?? []).map((t) => [t.id, t])),      [data.tecnicos]);

  // Categorias únicas para filtro
  const categorias = useMemo(() => {
    const s = new Set<string>();
    (data.materiais ?? []).forEach((m) => { if (m.categoria) s.add(m.categoria); });
    return [...s].sort();
  }, [data.materiais]);

  // Filtragem
  const mats = useMemo(() => (data.materiais ?? []).filter((m) => {
    const os   = osById.get(m.ordem_servico_id);
    const loja = os?.loja_id ? data.lojaById?.get(os.loja_id) : undefined;
    if (selectedLoja !== "all" && os?.loja_id !== selectedLoja) return false;
    if (selectedCat  !== "all" && m.categoria !== selectedCat)  return false;
    if (!search) return true;
    return (
      m.descricao.toLowerCase().includes(search.toLowerCase()) ||
      (m.categoria ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (loja?.nome ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (os?.numero_os ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }), [data.materiais, osById, data.lojaById, selectedLoja, selectedCat, search]);

  // Totais
  const totalValor = mats.reduce((s, m) => s + Number(m.valor_total ?? 0), 0);
  const totalQtd   = mats.reduce((s, m) => s + Number(m.quantidade  ?? 0), 0);

  // ── Gráfico: Custo por Loja ──────────────────────────────────
  const custoPorLoja = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number }>();
    for (const m of mats) {
      const os   = osById.get(m.ordem_servico_id);
      const loja = os?.loja_id ? data.lojaById?.get(os.loja_id) : undefined;
      if (!loja) continue;
      const cur = map.get(loja.id) ?? { nome: loja.nome, valor: 0 };
      cur.valor += Number(m.valor_total ?? 0);
      map.set(loja.id, cur);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [mats, osById, data.lojaById]);

  // ── Gráfico: Evolução mensal do custo de materiais ──────────
  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mats) {
      const os = osById.get(m.ordem_servico_id);
      if (!os?.data_abertura) continue;
      const [y, mo] = os.data_abertura.split("-");
      const key = `${y}-${mo}`;
      map.set(key, (map.get(key) ?? 0) + Number(m.valor_total ?? 0));
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, valor]) => ({ mes: monthLabel(key), valor }));
  }, [mats, osById]);

  const handleExport = () => {
    exportToCsv("materiais", mats.map((m) => {
      const os    = osById.get(m.ordem_servico_id);
      const loja  = os?.loja_id        ? data.lojaById?.get(os.loja_id)       : undefined;
      const prest = os?.prestadora_id  ? prestById.get(os.prestadora_id)      : undefined;
      const tec   = os?.tecnico_responsavel_id ? tecById.get(os.tecnico_responsavel_id) : undefined;
      return {
        Material: m.descricao, Categoria: safeText(m.categoria),
        Qtd: m.quantidade ?? 0, "Valor Unit.": m.valor_unitario ?? 0,
        Total: m.valor_total ?? 0, Loja: loja?.nome ?? "—",
        OS: os?.numero_os ?? "—", Prestadora: prest?.nome ?? "—",
        Técnico: tec?.nome ?? "—", Data: fmtDateBR(os?.data_abertura ?? null),
      };
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Materiais" subtitle="Controle de materiais por ordem de serviço">
        <button onClick={handleExport} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Total de Itens"     value={fmtNumber(mats.length)} icon={Package}    iconColor="bg-blue-100 text-blue-600" />
        <StatCard title="Quantidade Total"   value={fmtNumber(totalQtd)}    icon={Package}    iconColor="bg-sky-100 text-sky-600" />
        <StatCard title="Valor Total"        value={fmtMoney(totalValor)}   icon={DollarSign} iconColor="bg-emerald-100 text-emerald-600" />
      </div>

      {/* Gráfico: Custo de Materiais por Loja */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Custo de Materiais por Loja</h3>
        {custoPorLoja.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, custoPorLoja.length * 28)}>
            <BarChart data={custoPorLoja} layout="vertical" margin={{ top: 0, right: 10, left: 110, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={108} />
              <Tooltip formatter={(v) => fmtMoney(v)} />
              <Bar dataKey="valor" name="Materiais" fill="#3b82f6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
        )}
      </div>

      {/* Evolução mensal */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Evolução mensal do custo de materiais</h3>
        {evolucaoMensal.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolucaoMensal} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtMoney(v)} />
              <Line type="monotone" dataKey="valor" name="Custo" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar material, OS ou loja..."
            className="pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-64" />
        </div>
        <select value={selectedLoja} onChange={(e) => setSelectedLoja(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todas as lojas</option>
          {(data.lojas ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-3 border-b">
          <span className="text-xs text-muted-foreground">{mats.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Material", "Categoria", "Qtd", "Unit.", "Total", "Loja", "OS", "Prestadora", "Técnico", "Data"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && <tr><td colSpan={10} className="px-4 py-8 text-center">Carregando...</td></tr>}
              {!data.isLoading && mats.slice(0, 500).map((m) => {
                const os    = osById.get(m.ordem_servico_id);
                const loja  = os?.loja_id               ? data.lojaById?.get(os.loja_id)                     : undefined;
                const prest = os?.prestadora_id          ? prestById.get(os.prestadora_id)                   : undefined;
                const tec   = os?.tecnico_responsavel_id ? tecById.get(os.tecnico_responsavel_id)             : undefined;
                return (
                  <tr key={m.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2.5 max-w-[180px] truncate font-medium">{m.descricao}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{safeText(m.categoria)}</td>
                    <td className="px-4 py-2.5 text-center">{m.quantidade ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">{fmtMoney(m.valor_unitario)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmtMoney(m.valor_total)}</td>
                    <td className="px-4 py-2.5 max-w-[130px] truncate">{loja?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{safeText(os?.numero_os)}</td>
                    <td className="px-4 py-2.5 max-w-[120px] truncate text-muted-foreground">{prest?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5 max-w-[120px] truncate text-muted-foreground">{tec?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDateBR(os?.data_abertura ?? null)}</td>
                  </tr>
                );
              })}
              {!data.isLoading && !mats.length && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Nenhum material encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {mats.length > 500 && <p className="px-4 py-2 text-xs text-muted-foreground border-t">Exibindo 500 de {mats.length} registros</p>}
      </div>
    </div>
  );
}
