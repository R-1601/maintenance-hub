import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { checklistSupabase } from "@/integrations/checklist/client";
import { PageHeader } from "@/shared/components/PageHeader";
import { fmtDateBR } from "@/shared/utils/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Trash2, Loader2, Eye } from "lucide-react";

type ImportLog = {
  id: string;
  arquivo_nome: string | null;
  status: string;
  mensagem: string | null;
  campos_nao_encontrados: string[] | null;
  created_at: string | null;
};

const STATUS_STYLE: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  sucesso: { label: "Sucesso", color: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  aprovado: { label: "Aprovado", color: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  confirmado: { label: "Confirmado", color: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  aguardando_conferencia: { label: "Aguardando", color: "bg-sky-100 text-sky-700", Icon: Clock },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-700", Icon: XCircle },
  erro: { label: "Erro", color: "bg-red-100 text-red-700", Icon: XCircle },
  duplicado: { label: "Duplicado", color: "bg-gray-100 text-gray-500", Icon: AlertTriangle },
};

function statusCfg(status: string) {
  return STATUS_STYLE[status] ?? { label: status, color: "bg-gray-100 text-gray-600", Icon: Clock };
}

export default function ChecklistProcessamento() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deletingErros, setDeletingErros] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  // Apaga registros com erro para permitir reimportar
  async function handleLimparErros() {
    setDeletingErros(true);
    setDeleteMsg(null);
    try {
      const { error } = await checklistSupabase
        .from("checklist_import_staging")
        .delete()
        .eq("status", "erro");
      if (error) throw new Error(error.message);
      setDeleteMsg("Registros com erro removidos. Você pode reimportar os PDFs.");
      qc.invalidateQueries({ queryKey: ["checklist-importacoes"] });
    } catch (e) {
      setDeleteMsg(`Erro: ${e instanceof Error ? e.message : "não foi possível limpar"}`);
    } finally {
      setDeletingErros(false);
    }
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["checklist-importacoes"],
    queryFn: async () => {
      const { data, error } = await checklistSupabase
        .from("checklist_import_staging")
        .select("id, arquivo_nome, status, mensagem, campos_nao_encontrados, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ImportLog[];
    },
  });

  const sucesso = data?.filter((r) => r.status === "sucesso" || r.status === "aprovado").length ?? 0;
  const erros = data?.filter((r) => r.status === "erro").length ?? 0;
  const aguardando = data?.filter((r) => r.status === "aguardando_conferencia").length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Processamento de Importações" subtitle="Histórico de todos os PDFs enviados para o sistema">
        <div className="flex items-center gap-2">
          {erros > 0 && (
            <button
              onClick={handleLimparErros}
              disabled={deletingErros}
              className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {deletingErros ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Limpar {erros} erro{erros > 1 ? "s" : ""} (reimportar)
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </PageHeader>

      {deleteMsg && (
        <div className={cn(
          "rounded-lg border px-4 py-3 text-sm",
          deleteMsg.startsWith("Erro") ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
        )}>
          {deleteMsg}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{sucesso}</p>
          <p className="text-xs text-muted-foreground mt-1">Processados com sucesso</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{erros}</p>
          <p className="text-xs text-muted-foreground mt-1">Com erro</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-sky-600">{aguardando}</p>
          <p className="text-xs text-muted-foreground mt-1">Aguardando</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando histórico...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center gap-2 py-16 text-red-500 text-sm">
            <XCircle className="h-5 w-5" />
            Não foi possível carregar os dados deste módulo. Verifique permissões ou políticas do Supabase.
          </div>
        )}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Arquivo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Mensagem</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Campos não encontrados</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((row) => {
                  const cfg = statusCfg(row.status);
                  return (
                    <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {row.created_at ? fmtDateBR(row.created_at.slice(0, 10)) : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={row.arquivo_nome ?? ""}>
                        {row.arquivo_nome ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("flex items-center gap-1.5 w-fit rounded-full px-2.5 py-1 text-xs font-medium", cfg.color)}>
                          <cfg.Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-sm truncate" title={row.mensagem ?? ""}>
                        {row.mensagem ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-amber-600">
                        {row.campos_nao_encontrados?.length
                          ? row.campos_nao_encontrados.join(", ")
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/checklist/checklists/${row.id}`)}
                          className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {data?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum registro de importação encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
