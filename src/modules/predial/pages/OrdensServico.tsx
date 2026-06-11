import { useState } from "react";
import { Download, Search, Trash2, AlertTriangle, ShieldCheck, Loader2, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/shared/components/PageHeader";
import { usePredialData } from "../hooks/usePredialData";
import { predialSupabase } from "@/integrations/predial/client";
import { fmtMoney, fmtDateBR, safeText } from "@/shared/utils/format";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function OrdensServico() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [search, setSearch] = useState("");

  // Seleção para exclusão (admin)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const data = usePredialData({ selectedMonth, selectedStore });

  const rows = (data.os ?? []).filter((o) => {
    if (!search) return true;
    const loja = o.loja_id ? data.lojaById?.get(o.loja_id) : undefined;
    return (o.numero_os ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (loja?.nome ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const ids = [...selected];
    try {
      const { error: matErr } = await predialSupabase.from("materiais").delete().in("ordem_servico_id", ids);
      if (matErr) throw new Error(matErr.message);
      const { error: osErr } = await predialSupabase.from("ordens_servico").delete().in("id", ids);
      if (osErr) throw new Error(osErr.message);
      setSelected(new Set());
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ["predial-data"] });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  }

  const handleExport = () => {
    exportToCsv("ordens-servico", rows.map((o) => {
      const loja  = o.loja_id       ? data.lojaById?.get(o.loja_id)       : undefined;
      const prest = o.prestadora_id ? data.prestById?.get(o.prestadora_id) : undefined;
      const cat   = o.categoria_id  ? data.catById?.get(o.categoria_id)   : undefined;
      return {
        "Nº OS": safeText(o.numero_os),
        Loja: loja?.nome ?? "—",
        Prestadora: prest?.nome ?? "—",
        Categoria: cat?.nome ?? "—",
        "Custo Total": o.custo_total ?? 0,
        "Data Abertura": fmtDateBR(o.data_abertura),
        "Data Conclusão": fmtDateBR(o.data_conclusao),
      };
    }));
  };

  const colSpan = isAdmin ? 8 : 7;

  return (
    <div className="space-y-6">
      {/* Modal de confirmação */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold">Confirmar exclusão</p>
                <p className="text-sm text-muted-foreground">
                  {selected.size} ordem{selected.size > 1 ? "s" : ""} de serviço selecionada{selected.size > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Esta ação é <strong>irreversível</strong>. Os materiais vinculados também serão excluídos.
            </p>
            {deleteError && (
              <p className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowConfirm(false); setDeleteError(null); }} disabled={deleting}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Ordens de Serviço" subtitle="Listagem de todas as ordens de serviço">
        <div className="flex items-center gap-2">
          {isAdmin && someSelected && (
            <button onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
              Excluir {selected.size} selecionada{selected.size > 1 ? "s" : ""}
            </button>
          )}
          {isAdmin && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
              <ShieldCheck className="h-3 w-3 text-purple-500" /> Admin
            </span>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </div>
      </PageHeader>

      {/* Filtros — sem status */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar Nº OS ou loja..."
            className="pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-56" />
        </div>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todos os meses</option>
          {data.mesesDisponiveis?.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todas as lojas</option>
          {data.lojas?.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{rows.length} ordens</span>
          {isAdmin && someSelected && (
            <span className="text-xs text-red-600 font-medium">{selected.size} selecionada{selected.size > 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {isAdmin && (
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 accent-red-600 cursor-pointer" title="Selecionar todos" />
                  </th>
                )}
                {["Nº OS", "Loja", "Prestadora", "Categoria", "Custo Total", "Abertura", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && (
                <tr><td colSpan={colSpan} className="px-4 py-8 text-center">Carregando...</td></tr>
              )}
              {!data.isLoading && rows.map((o) => {
                const loja  = o.loja_id       ? data.lojaById?.get(o.loja_id)       : undefined;
                const prest = o.prestadora_id ? data.prestById?.get(o.prestadora_id) : undefined;
                const cat   = o.categoria_id  ? data.catById?.get(o.categoria_id)   : undefined;
                const isChecked = selected.has(o.id);
                return (
                  <tr key={o.id} className={cn("border-b hover:bg-muted/20 transition-colors", isChecked && "bg-red-50/60")}>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleOne(o.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-red-600 cursor-pointer" />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs font-medium">{safeText(o.numero_os)}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate">{loja?.nome ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[130px] truncate">{prest?.nome ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[120px] truncate">{cat?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(o.custo_total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDateBR(o.data_abertura)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/predial/ordens-servico/${o.id}`)}
                        className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!data.isLoading && rows.length === 0 && (
                <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Nenhuma OS encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
