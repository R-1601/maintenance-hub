import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checklistSupabase } from "@/integrations/checklist/client";
import { PageHeader } from "@/shared/components/PageHeader";
import { cn } from "@/lib/utils";
import {
  confirmStagingChecklist,
  rejectStagingChecklist,
  obterURLPDFAssinado,
  type StagingExtracted,
} from "@/lib/checklist.functions";
import { fmtScore, fmtDateBR, fmtNumber } from "@/shared/utils/format";
import { formatStoreName } from "@/shared/utils/storeUtils";
import {
  CheckCircle2, XCircle, Eye, Loader2, RefreshCw,
  ClipboardCheck, AlertTriangle, FileText, ExternalLink,
  ChevronDown, ChevronRight,
} from "lucide-react";

type StagingRow = {
  id: string;
  arquivo_nome: string | null;
  status: string;
  created_at: string | null;
  campos_nao_encontrados: string[] | null;
  extracted_data: StagingExtracted | null;
};

const TAB_LABELS = {
  aguardando: "Aguardando",
  confirmado: "Confirmados",
  rejeitado: "Rejeitados",
} as const;

type Tab = keyof typeof TAB_LABELS;

export default function ChecklistConferencia() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("aguardando");
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [pdfLoading, setPdfLoading] = useState<Record<string, boolean>>({});
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["checklist-conferencia"],
    queryFn: async () => {
      const { data, error } = await checklistSupabase
        .from("checklist_import_staging")
        .select("id, arquivo_nome, status, created_at, campos_nao_encontrados, extracted_data")
        .eq("mensagem", "Importado via Maintenance Hub")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as StagingRow[];
    },
  });

  async function handleVerPDF(row: StagingRow) {
    const path = row.extracted_data?.arquivo_path;
    if (!path) return;
    if (pdfUrls[row.id]) {
      window.open(pdfUrls[row.id], "_blank");
      return;
    }
    setPdfLoading((p) => ({ ...p, [row.id]: true }));
    const url = await obterURLPDFAssinado(path);
    setPdfLoading((p) => ({ ...p, [row.id]: false }));
    if (url) {
      setPdfUrls((p) => ({ ...p, [row.id]: url }));
      window.open(url, "_blank");
    }
  }

  async function handleConfirmar(row: StagingRow) {
    if (!row.extracted_data) return;
    setActionId(row.id);
    setActionMsg(null);
    const result = await confirmStagingChecklist(row.id, row.extracted_data);
    if (result.ok) {
      const extra = result.savedToChecklists ? " (salvo na base oficial)" : " (salvo no staging)";
      setActionMsg({ id: row.id, msg: `Confirmado com sucesso${extra}.`, ok: true });
      qc.invalidateQueries({ queryKey: ["checklist-conferencia"] });
      qc.invalidateQueries({ queryKey: ["checklist-data"] });
    } else {
      setActionMsg({ id: row.id, msg: `Erro: ${result.error}`, ok: false });
    }
    setActionId(null);
  }

  async function handleRejeitar(row: StagingRow) {
    setActionId(row.id);
    setActionMsg(null);
    const path = row.extracted_data?.arquivo_path;
    const result = await rejectStagingChecklist(row.id, path);
    if (result.ok) {
      const extra = result.fileDeleted ? " Arquivo removido do storage." : "";
      setActionMsg({ id: row.id, msg: `Rejeitado.${extra}`, ok: true });
      qc.invalidateQueries({ queryKey: ["checklist-conferencia"] });
    } else {
      setActionMsg({ id: row.id, msg: `Erro: ${result.error}`, ok: false });
    }
    setActionId(null);
  }

  const aguardando = (data ?? []).filter((r) => r.status === "aguardando_conferencia");
  const confirmados = (data ?? []).filter((r) => r.status === "confirmado");
  const rejeitados = (data ?? []).filter((r) => r.status === "rejeitado");

  const tabData: Record<Tab, StagingRow[]> = {
    aguardando,
    confirmado: confirmados,
    rejeitado: rejeitados,
  };

  const counts: Record<Tab, number> = {
    aguardando: aguardando.length,
    confirmado: confirmados.length,
    rejeitado: rejeitados.length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conferência de Importações"
        subtitle="Revise cada PDF antes de confirmar na base oficial"
      >
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </PageHeader>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div
          onClick={() => setTab("aguardando")}
          className={cn(
            "cursor-pointer rounded-xl border p-4 text-center transition-colors",
            tab === "aguardando" ? "border-sky-400 bg-sky-50" : "bg-card hover:bg-muted/30",
          )}
        >
          <p className="text-2xl font-bold text-sky-600">{aguardando.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Aguardando revisão</p>
        </div>
        <div
          onClick={() => setTab("confirmado")}
          className={cn(
            "cursor-pointer rounded-xl border p-4 text-center transition-colors",
            tab === "confirmado" ? "border-emerald-400 bg-emerald-50" : "bg-card hover:bg-muted/30",
          )}
        >
          <p className="text-2xl font-bold text-emerald-600">{confirmados.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Confirmados</p>
        </div>
        <div
          onClick={() => setTab("rejeitado")}
          className={cn(
            "cursor-pointer rounded-xl border p-4 text-center transition-colors",
            tab === "rejeitado" ? "border-red-400 bg-red-50" : "bg-card hover:bg-muted/30",
          )}
        >
          <p className="text-2xl font-bold text-red-600">{rejeitados.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Rejeitados</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-all",
              tab === t
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABELS[t]}
            {counts[t] > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-bold leading-none",
                  t === "aguardando" ? "bg-sky-100 text-sky-700" :
                  t === "confirmado" ? "bg-emerald-100 text-emerald-700" :
                  "bg-red-100 text-red-700",
                )}
              >
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : tabData[tab].length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum item {TAB_LABELS[tab].toLowerCase()}.</p>
          {tab === "aguardando" && (
            <p className="text-xs mt-1">Importe PDFs na tela de Importações para eles aparecerem aqui.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tabData[tab].map((row) => {
            const ex = row.extracted_data ?? {};
            const isExpanded = expandedId === row.id;
            const isActing = actionId === row.id;
            const pdfPath = ex.arquivo_path;
            const nc = (ex.itens as Array<{ status?: string; pergunta?: string; area?: string }> | undefined)
              ?.filter((i) => /n[aã]o\s*atingiu|n[aã]o$/i.test(i.status ?? "")) ?? [];

            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-xl border bg-card transition-colors",
                  tab === "aguardando" && "border-sky-200 bg-sky-50/20",
                  tab === "confirmado" && "border-emerald-200 bg-emerald-50/10",
                  tab === "rejeitado" && "border-red-200 bg-red-50/10",
                )}
              >
                {/* Header da linha */}
                <div className="flex items-start gap-3 p-4">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {formatStoreName(ex.unidade) || row.arquivo_nome || "—"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Data: <strong className="text-foreground">{fmtDateBR(ex.data_visita ?? null)}</strong></span>
                      <span>Técnico: <strong className="text-foreground">{ex.autor || "—"}</strong></span>
                      <span>Empresa: <strong className="text-foreground">{ex.empresa_prestadora || "—"}</strong></span>
                      {ex.cidade_uf && <span>Local: <strong className="text-foreground">{ex.cidade_uf}</strong></span>}
                    </div>
                    {row.campos_nao_encontrados && row.campos_nao_encontrados.length > 0 && (
                      <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Campos ausentes: {row.campos_nao_encontrados.join(", ")}
                      </p>
                    )}
                    {actionMsg?.id === row.id && (
                      <p className={cn("mt-1.5 text-xs font-medium", actionMsg.ok ? "text-emerald-600" : "text-red-600")}>
                        {actionMsg.msg}
                      </p>
                    )}
                  </div>

                  {/* Nota */}
                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-1 text-sm font-bold",
                        ex.nota_final == null ? "bg-gray-100 text-gray-500" :
                        ex.nota_final >= 95 ? "bg-emerald-100 text-emerald-700" :
                        ex.nota_final >= 80 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700",
                      )}
                    >
                      {ex.nota_final != null ? fmtScore(ex.nota_final) : "—"}
                    </span>
                    {ex.inconformidades != null && (
                      <p className={cn("text-xs mt-1", ex.inconformidades > 0 ? "text-red-600 font-semibold" : "text-emerald-600")}>
                        {fmtNumber(ex.inconformidades)} inconf.
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
                  {/* Ver detalhes */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {isExpanded ? "Ocultar" : "Ver detalhes"}
                  </button>

                  {/* Abrir PDF */}
                  {pdfPath && (
                    <button
                      onClick={() => handleVerPDF(row)}
                      disabled={pdfLoading[row.id]}
                      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      {pdfLoading[row.id]
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ExternalLink className="h-3.5 w-3.5" />}
                      Abrir PDF
                    </button>
                  )}

                  {/* Botões de ação apenas para aguardando */}
                  {tab === "aguardando" && (
                    <>
                      <button
                        onClick={() => handleConfirmar(row)}
                        disabled={isActing}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors ml-auto"
                      >
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Confirmar
                      </button>
                      <button
                        onClick={() => handleRejeitar(row)}
                        disabled={isActing}
                        className="flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Rejeitar
                      </button>
                    </>
                  )}

                  {/* Re-aprovar rejeitados */}
                  {tab === "rejeitado" && (
                    <button
                      onClick={() => handleConfirmar(row)}
                      disabled={isActing}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors ml-auto"
                    >
                      {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Aprovar mesmo assim
                    </button>
                  )}
                </div>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4 text-sm">
                    {/* Grid de campos */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Field label="Loja nº" value={ex.loja_numero ?? "—"} />
                      <Field label="Cidade/UF" value={ex.cidade_uf ?? "—"} />
                      <Field label="Início" value={ex.hora_inicio ?? "—"} />
                      <Field label="Fim" value={ex.hora_fim ?? "—"} />
                      <Field label="Duração" value={ex.duracao ?? "—"} />
                      <Field label="ID Checklist" value={ex.checklist_id ?? "—"} />
                      <Field label="Resultado Parcial" value={ex.resultado_parcial != null ? fmtScore(ex.resultado_parcial) : "—"} />
                      <Field label="Resultado Final" value={ex.resultado_final != null ? fmtScore(ex.resultado_final) : "—"} />
                    </div>

                    {/* Áreas */}
                    {Array.isArray(ex.areas) && ex.areas.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resultado por Área</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(ex.areas as Array<{ area?: string; resultado?: string; percentual?: number }>).map((a, i) => (
                            <div key={i} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-xs">
                              <span className="font-medium truncate mr-2">{a.area ?? "—"}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {a.resultado && <span className="text-muted-foreground">{a.resultado}</span>}
                                {a.percentual != null && (
                                  <span className={cn(
                                    "font-bold",
                                    a.percentual >= 95 ? "text-emerald-600" :
                                    a.percentual >= 80 ? "text-amber-600" : "text-red-600",
                                  )}>
                                    {a.percentual}%
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inconformidades */}
                    {nc.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Inconformidades ({nc.length})
                        </p>
                        <div className="space-y-1.5">
                          {nc.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-xs">
                              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
                              <div>
                                {item.area && (
                                  <span className="font-medium text-red-700 mr-1">[{item.area}]</span>
                                )}
                                <span>{item.pergunta}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {nc.length === 0 && (!Array.isArray(ex.itens) || ex.itens.length === 0) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        Nenhum detalhe de itens disponível neste registro. Re-importe o PDF para ver as inconformidades.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Instrução */}
      <div className="rounded-xl border bg-blue-50 border-blue-200 px-5 py-4 text-sm text-blue-700 flex items-start gap-2">
        <ClipboardCheck className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          PDFs importados ficam aqui para revisão antes de entrar na base oficial. Clique em
          <strong> Confirmar</strong> para aceitar os dados e incluir no dashboard, ou em
          <strong> Rejeitar</strong> para descartar (o arquivo é removido do storage automaticamente).
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate text-sm" title={value}>{value || "—"}</p>
    </div>
  );
}
