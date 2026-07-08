import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checklistSupabase } from "@/integrations/checklist/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/shared/components/PageHeader";
import { fmtDateBR } from "@/shared/utils/format";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, User, Wind, Info,
  CheckCircle2, Clock, XCircle, Loader2, RefreshCw,
} from "lucide-react";

type Modulo = "checklist";

type SolicitacaoRow = {
  id: string;
  arquivo_nome: string | null;   // email
  status: string;
  created_at: string | null;
  extracted_data: {
    user_id?: string;
    email?: string;
    nome?: string;
    requested_modulos?: Modulo[];
    modulos_aprovados?: Modulo[];
  } | null;
};

const MODULO_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  checklist: { label: "Ar-Condicionado", icon: Wind, color: "bg-sky-100 text-sky-700" },
};

export default function ChecklistUsuarios() {
  const { user, nome, email, isAdmin, modulos, role } = useAuth();
  const qc = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);

  const { data: solicitacoes, isLoading, refetch } = useQuery({
    queryKey: ["user-solicitacoes"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await checklistSupabase
        .from("checklist_import_staging")
        .select("id, arquivo_nome, status, created_at, extracted_data")
        .eq("mensagem", "solicitacao_acesso")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SolicitacaoRow[];
    },
  });

  async function handleAprovar(row: SolicitacaoRow, modulosAprovados: Modulo[]) {
    setActionId(row.id);
    // Remove solicitação pendente e insere aprovada
    await checklistSupabase.from("checklist_import_staging").delete().eq("id", row.id);
    await checklistSupabase.from("checklist_import_staging").insert({
      arquivo_nome: row.arquivo_nome,
      checklist_id: null,
      status: "aprovado",
      mensagem: "solicitacao_acesso",
      extracted_data: {
        ...(row.extracted_data ?? {}),
        modulos_aprovados: modulosAprovados,
      },
    });
    qc.invalidateQueries({ queryKey: ["user-solicitacoes"] });
    setActionId(null);
  }

  async function handleRejeitar(row: SolicitacaoRow) {
    setActionId(row.id);
    await checklistSupabase.from("checklist_import_staging").delete().eq("id", row.id);
    await checklistSupabase.from("checklist_import_staging").insert({
      arquivo_nome: row.arquivo_nome,
      checklist_id: null,
      status: "rejeitado",
      mensagem: "solicitacao_acesso",
      extracted_data: row.extracted_data,
    });
    qc.invalidateQueries({ queryKey: ["user-solicitacoes"] });
    setActionId(null);
  }

  async function handleRevogar(row: SolicitacaoRow) {
    setActionId(row.id);
    await checklistSupabase.from("checklist_import_staging").delete().eq("id", row.id);
    qc.invalidateQueries({ queryKey: ["user-solicitacoes"] });
    setActionId(null);
  }

  const pendentes  = (solicitacoes ?? []).filter((s) => s.status === "aguardando_conferencia");
  const aprovados  = (solicitacoes ?? []).filter((s) => s.status === "aprovado");
  const rejeitados = (solicitacoes ?? []).filter((s) => s.status === "rejeitado");

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Usuários" subtitle="Perfil e gerenciamento de acesso">
        {isAdmin && (
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        )}
      </PageHeader>

      {/* Perfil do usuário atual */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isAdmin ? <ShieldCheck className="h-7 w-7" /> : <User className="h-7 w-7" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold truncate">{nome}</h2>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isAdmin ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
              )}>
                {isAdmin ? "Administrador" : "Usuário"}
              </span>
              {user?.email_confirmed_at ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> E-mail confirmado
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <Clock className="h-3 w-3" /> Aguardando confirmação
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{email}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Módulos com acesso</p>
          <div className="flex flex-wrap gap-2">
            {modulos.map((m) => {
              const cfg = MODULO_LABELS[m];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <span key={m} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", cfg.color)}>
                  <Icon className="h-4 w-4" /> {cfg.label}
                </span>
              );
            })}
            {modulos.length === 0 && <span className="text-sm text-muted-foreground">Nenhum módulo habilitado</span>}
          </div>
        </div>
      </div>

      {/* Painel admin — solicitações */}
      {isAdmin && (
        <>
          {/* Pendentes */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold">Solicitações Pendentes</h2>
              {pendentes.length > 0 && (
                <span className="ml-auto rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5">
                  {pendentes.length}
                </span>
              )}
            </div>

            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

            {!isLoading && pendentes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
            )}

            {pendentes.map((row) => {
              const ex = row.extracted_data ?? {};
              const reqMods: Modulo[] = ex.requested_modulos ?? ["checklist"];
              const isActing = actionId === row.id;
              return (
                <div key={row.id} className="rounded-lg border bg-amber-50/50 border-amber-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{ex.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{ex.email ?? row.arquivo_nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Solicitado em {fmtDateBR(row.created_at?.slice(0, 10) ?? null)}</p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      <Clock className="h-3 w-3" /> Pendente
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Módulos solicitados:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {reqMods.map((m) => {
                        const cfg = MODULO_LABELS[m];
                        return cfg ? (
                          <span key={m} className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.color)}>
                            <cfg.icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleAprovar(row, reqMods)}
                      disabled={isActing}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleRejeitar(row)}
                      disabled={isActing}
                      className="flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aprovados */}
          {aprovados.length > 0 && (
            <div className="rounded-xl border bg-card p-6 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h2 className="font-semibold">Usuários Aprovados</h2>
                <span className="ml-auto text-xs text-muted-foreground">{aprovados.length} usuário(s)</span>
              </div>
              {aprovados.map((row) => {
                const ex = row.extracted_data ?? {};
                const mods: Modulo[] = ex.modulos_aprovados ?? [];
                const isActing = actionId === row.id;
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ex.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{ex.email ?? row.arquivo_nome}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {mods.map((m) => {
                        const cfg = MODULO_LABELS[m];
                        return cfg ? (
                          <span key={m} className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", cfg.color)}>
                            <cfg.icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        ) : null;
                      })}
                      <button
                        onClick={() => handleRevogar(row)}
                        disabled={isActing}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Revogar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rejeitados */}
          {rejeitados.length > 0 && (
            <div className="rounded-xl border bg-card p-6 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <h2 className="font-semibold">Usuários Rejeitados</h2>
                <span className="ml-auto text-xs text-muted-foreground">{rejeitados.length} usuário(s)</span>
              </div>
              {rejeitados.map((row) => {
                const ex = row.extracted_data ?? {};
                const isActing = actionId === row.id;
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/30 p-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ex.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{ex.email ?? row.arquivo_nome}</p>
                    </div>
                    <button
                      onClick={() => handleAprovar(row, ex.requested_modulos ?? ["checklist"])}
                      disabled={isActing}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Aprovar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 rounded-xl border bg-blue-50 border-blue-200 px-5 py-4 text-sm text-blue-700">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Novos usuários ficam bloqueados até serem aprovados. Você pode aprovar todos os módulos solicitados ou escolher apenas um. Usuários aprovados ficam ativos imediatamente ao recarregar o app.
            </p>
          </div>
        </>
      )}

      {!isAdmin && (
        <div className="flex items-start gap-2 rounded-xl border bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Para solicitar alteração nos módulos de acesso, entre em contato com o administrador da plataforma.</p>
        </div>
      )}
    </div>
  );
}
