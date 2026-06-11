import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Search, Eye, AlertTriangle, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { useChecklistData } from "../hooks/useChecklistData";
import { checklistSupabase } from "@/integrations/checklist/client";
import { fmtScore, fmtDateBR, fmtNumber, scoreLabel } from "@/shared/utils/format";
import { formatStoreName } from "@/shared/utils/storeUtils";
import { exportToCsv } from "@/shared/utils/exportCsv";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function ChecklistList() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [search, setSearch] = useState("");
  const [somenteInconf, setSomenteInconf] = useState(false);
  const [notaMinima, setNotaMinima] = useState("");

  // Seleção para exclusão (admin)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const data = useChecklistData({ selectedMonth, selectedStore });
  const lojaById = data.lojaById;

  const rows = (data.checklists ?? []).filter((c) => {
    if (somenteInconf && !(c.inconformidades && c.inconformidades > 0)) return false;
    if (notaMinima && c.nota_final != null && c.nota_final < parseFloat(notaMinima)) return false;
    if (!search) return true;
    const loja = c.loja_id ? lojaById?.get(c.loja_id) : undefined;
    const nome = loja ? formatStoreName(loja.unidade) : "";
    return (
      nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.autor ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.checklist_id ?? "").includes(search)
    );
  });

  // Seleção
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Exclusão
  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    // Separa IDs por origem
    const stagingIds = rows.filter((r) => selected.has(r.id) && r._fromStaging).map((r) => r.id);
    const checklistIds = rows.filter((r) => selected.has(r.id) && !r._fromStaging).map((r) => r.id);

    let erros: string[] = [];

    // Deleta do staging (sempre funciona)
    if (stagingIds.length > 0) {
      const { error } = await checklistSupabase
        .from("checklist_import_staging")
        .delete()
        .in("id", stagingIds);
      if (error) erros.push(`Staging: ${error.message}`);
    }

    // Tenta deletar da tabela checklists
    if (checklistIds.length > 0) {
      const { error } = await checklistSupabase
        .from("checklists")
        .delete()
        .in("id", checklistIds);
      if (error) {
        const isRLS = error.code === "42501" || error.message.toLowerCase().includes("policy") || error.message.toLowerCase().includes("permission");
        if (isRLS) {
          erros.push(`${checklistIds.length} checklist(s) do sistema original não podem ser excluídos daqui — só pelo painel original (Lovable).`);
        } else {
          erros.push(error.message);
        }
      }
    }

    if (erros.length > 0) {
      setDeleteError(erros.join("\n"));
    } else {
      setSelected(new Set());
      setShowConfirm(false);
    }

    qc.invalidateQueries({ queryKey: ["checklist-data"] });
    setDeleting(false);
  }

  const handleExport = () => {
    exportToCsv("checklists", rows.map((c) => {
      const loja = c.loja_id ? lojaById?.get(c.loja_id) : undefined;
      return {
        ID: c.checklist_id ?? "—",
        Loja: loja ? formatStoreName(loja.unidade) : "—",
        Data: fmtDateBR(c.data_visita),
        Nota: c.nota_final ?? "—",
        Inconformidades: c.inconformidades ?? 0,
        Técnico: c.autor ?? "—",
        Empresa: c.empresa_prestadora ?? "—",
        Status: scoreLabel(c.nota_final),
      };
    }));
  };

  const colSpan = isAdmin ? 9 : 8;

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
                  {selected.size} checklist{selected.size > 1 ? "s" : ""} selecionado{selected.size > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Esta ação é <strong>irreversível</strong>. Os checklists e seus dados serão excluídos permanentemente.
            </p>
            {deleteError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 whitespace-pre-line">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowConfirm(false); setDeleteError(null); }}
                disabled={deleting}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Checklists" subtitle="Listagem de todos os checklists processados">
        <div className="flex items-center gap-2">
          {isAdmin && someSelected && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir {selected.size} selecionado{selected.size > 1 ? "s" : ""}
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

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja, técnico ou ID..."
            className="pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-60"
          />
        </div>

        <input
          type="number"
          value={notaMinima}
          onChange={(e) => setNotaMinima(e.target.value)}
          placeholder="Nota mínima"
          min={0} max={100}
          className="w-28 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todos os meses</option>
          {data.mesesDisponiveis?.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todas as lojas</option>
          {data.lojasDisponiveis?.map((l) => <option key={l.id} value={l.id}>{l.unidade?.replace(/PROMOFARMA\s*/i, "").trim()}</option>)}
        </select>

        <div
          onClick={() => setSomenteInconf((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors cursor-pointer select-none",
            somenteInconf
              ? "bg-red-50 border-red-300 text-red-700 font-medium"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Apenas com inconformidades
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{rows.length} registros</span>
          <div className="flex items-center gap-3">
            {isAdmin && someSelected && (
              <span className="text-xs text-red-600 font-medium">
                {selected.size} selecionado{selected.size > 1 ? "s" : ""}
              </span>
            )}
            {somenteInconf && (
              <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Somente com inconformidades
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {isAdmin && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 accent-red-600 cursor-pointer"
                      title="Selecionar todos"
                    />
                  </th>
                )}
                {["Data", "ID", "Loja", "Técnico", "Nota", "Inconform.", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.isLoading && (
                <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!data.isLoading && rows.map((c) => {
                const loja = c.loja_id ? lojaById?.get(c.loja_id) : undefined;
                const hasInconf = c.inconformidades && c.inconformidades > 0;
                const isChecked = selected.has(c.id);
                return (
                  <tr key={c.id} className={cn("border-b hover:bg-muted/20 transition-colors", isChecked && "bg-red-50/60")}>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(c.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-red-600 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDateBR(c.data_visita)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.checklist_id ?? "—"}</td>
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{loja ? formatStoreName(loja.unidade) : "—"}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate">{c.autor ?? "—"}</td>
                    <td className={cn("px-4 py-3 font-bold",
                      c.nota_final != null ? (c.nota_final >= 95 ? "text-emerald-600" : c.nota_final >= 80 ? "text-amber-600" : "text-red-600") : ""
                    )}>
                      {c.nota_final != null ? fmtScore(c.nota_final) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("font-semibold", hasInconf ? "text-red-600" : "text-emerald-600")}>
                        {fmtNumber(c.inconformidades ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        c.nota_final == null ? "bg-gray-100 text-gray-500" :
                        c.nota_final >= 95 ? "bg-emerald-100 text-emerald-700" :
                        c.nota_final >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      )}>
                        {scoreLabel(c.nota_final)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/checklist/checklists/${c.id}`)}
                        className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!data.isLoading && rows.length === 0 && (
                <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Nenhum checklist encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
