import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { checklistSupabase } from "@/integrations/checklist/client";
import { fmtDateBR, fmtScore, fmtNumber, scoreLabel, fmtPercent } from "@/shared/utils/format";
import { formatStoreName } from "@/shared/utils/storeUtils";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
type ChecklistRow = {
  id: string;
  checklist_id: string | null;
  loja_id: string | null;
  data_visita: string | null;
  nota_final: number | null;
  inconformidades: number | null;
  autor: string | null;
  empresa_prestadora: string | null;
  status: string;
  nome_checklist: string | null;
  arquivo_nome: string | null;
  arquivo_path: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao: string | null;
  resultado_parcial: number | null;
  resultado_final: number | null;
};

type ChecklistLoja = {
  id: string;
  unidade: string;
  loja_numero: string | null;
  cidade_uf: string | null;
  endereco: string | null;
};

type AreaResultado = {
  area: string;
  resultado: number | null;
  percentual?: number | null;
  variacao?: number | null;
};

type ItemAvaliado = {
  area: string;
  pergunta: string;
  peso?: number | null;
  resultado?: string | null;
  status?: string | null;
  conforme?: boolean;
};

type HistoricoRow = {
  data: string;
  nota: number;
  inconformidades: number;
  id?: string;
};

type ExtractedData = {
  nome_checklist?: string;
  horario?: string;
  hora_inicio?: string;
  hora_fim?: string;
  duracao?: string;
  resultado_parcial?: number;
  areas?: AreaResultado[];
  itens?: ItemAvaliado[];
  historico?: HistoricoRow[];
  pdf_url?: string;
  arquivo_nome?: string;
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function ScoreBadge({ nota }: { nota: number | null | undefined }) {
  if (nota == null) return <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-500">—</span>;
  const label = scoreLabel(nota);
  return (
    <span className={cn(
      "rounded-full px-3 py-1 text-sm font-semibold",
      nota >= 95 ? "bg-emerald-100 text-emerald-700" :
      nota >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
    )}>
      {label} — {fmtScore(nota)}
    </span>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function BigNumber({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", color ?? "text-foreground")}>{value}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────
export default function ChecklistDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["checklist-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      // 1. Busca checklist principal — tenta checklists, fallback para staging
      let cl: ChecklistRow | null = null;
      let stagingExtracted: ExtractedData | null = null;

      type StagingExtracted = {
        loja_id?: string | null; data_visita?: string | null; nota_final?: number | null;
        inconformidades?: number | null; autor?: string | null; empresa_prestadora?: string | null;
        checklist_id?: string | null; resultado_parcial?: number | null; resultado_final?: number | null;
        nome_checklist?: string; horario?: string; hora_inicio?: string; hora_fim?: string; duracao?: string;
        areas?: AreaResultado[]; itens?: ItemAvaliado[]; historico?: HistoricoRow[];
        arquivo_path?: string;
      };

      const { data: clDirect, error: clErr } = await checklistSupabase
        .from("checklists")
        .select("id, checklist_id, loja_id, data_visita, nota_final, inconformidades, autor, empresa_prestadora, status, nome_checklist, arquivo_nome, arquivo_path, hora_inicio, hora_fim, duracao, resultado_parcial, resultado_final")
        .eq("id", id!)
        .maybeSingle();

      if (clDirect) {
        cl = clDirect as ChecklistRow;
      } else {
        // Não achou em checklists — busca no staging (importação via Maintenance Hub)
        const { data: stagingRow, error: stErr } = await checklistSupabase
          .from("checklist_import_staging")
          .select("id, checklist_id, extracted_data, arquivo_nome")
          .eq("id", id!)
          .maybeSingle();
        if (stErr || !stagingRow) throw new Error(clErr?.message ?? "Checklist não encontrado");

        const ex = (stagingRow.extracted_data ?? {}) as StagingExtracted;
        stagingExtracted = ex as ExtractedData; // já temos os dados — não precisa buscar de novo
        cl = {
          id: stagingRow.id,
          checklist_id: ex.checklist_id ?? stagingRow.checklist_id ?? null,
          loja_id: ex.loja_id ?? null,
          data_visita: ex.data_visita ?? null,
          nota_final: ex.nota_final ?? null,
          inconformidades: ex.inconformidades ?? null,
          autor: ex.autor ?? null,
          empresa_prestadora: ex.empresa_prestadora ?? null,
          status: "sucesso",
          nome_checklist: ex.nome_checklist ?? null,
          arquivo_nome: stagingRow.arquivo_nome ?? null,
          arquivo_path: (ex as ExtractedData & { arquivo_path?: string }).arquivo_path ?? null,
          hora_inicio: ex.hora_inicio ?? null,
          hora_fim: ex.hora_fim ?? null,
          duracao: ex.duracao ?? null,
          resultado_parcial: ex.resultado_parcial ?? null,
          resultado_final: ex.resultado_final ?? null,
        };
      }

      if (!cl) throw new Error("Checklist não encontrado");

      // 2. Busca loja
      let loja: ChecklistLoja | null = null;
      if (cl.loja_id) {
        const { data: l } = await checklistSupabase
          .from("lojas")
          .select("id, unidade, loja_numero, cidade_uf, endereco")
          .eq("id", cl.loja_id)
          .single();
        loja = l ?? null;
      }

      // 3. Busca staging — apenas se ainda não temos os dados (checklist veio da tabela principal)
      let extracted: ExtractedData | null = stagingExtracted;

      if (!extracted && cl.checklist_id) {
        const { data: staging } = await checklistSupabase
          .from("checklist_import_staging")
          .select("extracted_data")
          .eq("checklist_id", cl.checklist_id)
          .maybeSingle();
        extracted = (staging?.extracted_data as ExtractedData) ?? null;
      }

      // 4. Histórico da loja (outros checklists da mesma loja)
      let historico: HistoricoRow[] = [];
      if (cl.loja_id) {
        const { data: hist } = await checklistSupabase
          .from("checklists")
          .select("id, data_visita, nota_final, inconformidades")
          .eq("loja_id", cl.loja_id)
          .eq("status", "sucesso")
          .order("data_visita", { ascending: false })
          .limit(10);
        historico = (hist ?? []).map((h) => ({
          id: h.id,
          data: h.data_visita ?? "",
          nota: h.nota_final ?? 0,
          inconformidades: h.inconformidades ?? 0,
        }));
      }

      // Resolve URL do PDF — bucket privado "checklists", gera signed URL
      let pdfUrl: string | null = null;
      if (cl.arquivo_path) {
        const { data: signed } = await checklistSupabase.storage
          .from("checklists")
          .createSignedUrl(cl.arquivo_path, 3600);
        if (signed?.signedUrl) {
          pdfUrl = signed.signedUrl;
        } else {
          console.warn("[ChecklistDetalhe] Não foi possível gerar signed URL para:", cl.arquivo_path);
        }
      }

      // Mescla pdfUrl no extracted para usar no render
      if (pdfUrl) {
        extracted = { ...(extracted ?? {}), pdf_url: pdfUrl };
      }

      return { checklist: cl as ChecklistRow, loja, extracted, historico };
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <XCircle className="h-12 w-12 text-red-400" />
        <p className="text-muted-foreground">
          {error?.message?.includes("permission") || error?.message?.includes("RLS")
            ? "Não foi possível carregar os dados deste módulo. Verifique permissões ou políticas do Supabase."
            : (error?.message ?? "Checklist não encontrado.")}
        </p>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>
    );
  }

  const { checklist: c, loja, extracted, historico } = data;

  const nomeChecklist = c.nome_checklist ?? extracted?.nome_checklist ?? "Checklist de Manutenção";
  const areas: AreaResultado[] = extracted?.areas ?? [];
  const itens: ItemAvaliado[] = extracted?.itens ?? [];
  const isNC = (i: ItemAvaliado) =>
    i.conforme === false ||
    /n[aã]o\s*atingiu|n[aã]o$/i.test(i.status ?? "") ||
    i.status === "NC" || i.status === "Não Conforme";
  const itensNaoAtingidos = itens.filter(isNC);
  const pdfUrl = extracted?.pdf_url ?? null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 rounded-md p-1.5 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold leading-tight">{nomeChecklist}</h1>
            <ScoreBadge nota={c.nota_final} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {c.checklist_id && <span>#{c.checklist_id}</span>}
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                PDF original
                {c.arquivo_nome && (
                  <span className="text-muted-foreground font-normal ml-1">— {c.arquivo_nome}</span>
                )}
              </a>
            ) : (
              <span className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> PDF não disponível
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="rounded-xl border bg-card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
          <InfoField label="Loja" value={loja ? formatStoreName(loja.unidade) : "—"} />
          <InfoField label="Cidade/UF" value={loja?.cidade_uf} />
          <InfoField label="Endereço" value={loja?.endereco} />
          <InfoField label="Técnico" value={c.autor} />
          <InfoField label="Empresa Prestadora" value={c.empresa_prestadora} />
          <InfoField label="Data da Visita" value={fmtDateBR(c.data_visita)} />
          <InfoField
            label="Horário"
            value={
              c.hora_inicio
                ? (c.hora_fim ? `${c.hora_inicio} – ${c.hora_fim}` : c.hora_inicio)
                : extracted?.hora_inicio
                ? (extracted.hora_fim ? `${extracted.hora_inicio} – ${extracted.hora_fim}` : extracted.hora_inicio)
                : (extracted?.horario ?? null)
            }
          />
          <InfoField label="Duração" value={c.duracao ?? extracted?.duracao} />
        </div>
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-3 gap-4">
        <BigNumber
          label="Resultado Parcial"
          value={fmtScore(c.resultado_parcial ?? extracted?.resultado_parcial ?? c.nota_final)}
          color={c.nota_final != null ? (c.nota_final >= 95 ? "text-emerald-600" : c.nota_final >= 80 ? "text-amber-600" : "text-red-600") : undefined}
        />
        <BigNumber
          label="Resultado Final"
          value={fmtScore(c.resultado_final ?? c.nota_final)}
          color={c.nota_final != null ? (c.nota_final >= 95 ? "text-emerald-600" : c.nota_final >= 80 ? "text-amber-600" : "text-red-600") : undefined}
        />
        <BigNumber
          label="Inconformidades"
          value={fmtNumber(c.inconformidades ?? 0)}
          color={(c.inconformidades ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {/* Resultado por área */}
      {areas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Resultado por área</h2>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Área", "Resultado", "%", "Variação"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {areas.map((a, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{a.area}</td>
                    <td className={cn("px-4 py-2.5 font-semibold",
                      a.resultado != null ? (a.resultado >= 95 ? "text-emerald-600" : a.resultado >= 80 ? "text-amber-600" : "text-red-600") : ""
                    )}>
                      {a.resultado != null ? fmtScore(a.resultado) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.percentual != null ? fmtPercent(a.percentual) : "—"}</td>
                    <td className="px-4 py-2.5">
                      {a.variacao != null ? (
                        <span className={cn("font-medium", a.variacao >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {a.variacao >= 0 ? "+" : ""}{fmtScore(a.variacao)}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Últimos resultados */}
      {historico.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Últimos resultados — {loja ? formatStoreName(loja.unidade) : "loja"}</h2>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Data", "Nota", "Inconformidades"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map((h, i) => (
                  <tr
                    key={i}
                    className={cn("border-b hover:bg-muted/20 cursor-pointer transition-colors", h.id === id && "bg-primary/5")}
                    onClick={() => h.id && h.id !== id && navigate(`/checklist/checklists/${h.id}`)}
                  >
                    <td className="px-4 py-2.5">{fmtDateBR(h.data)}</td>
                    <td className={cn("px-4 py-2.5 font-semibold",
                      h.nota >= 95 ? "text-emerald-600" : h.nota >= 80 ? "text-amber-600" : "text-red-600"
                    )}>
                      {fmtScore(h.nota)}
                      {h.id === id && <span className="ml-2 text-xs font-normal text-primary">← atual</span>}
                    </td>
                    <td className={cn("px-4 py-2.5", h.inconformidades > 0 ? "text-red-600 font-semibold" : "text-emerald-600")}>
                      {h.inconformidades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Itens não atingidos */}
      {itensNaoAtingidos.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Itens não atingidos ({itensNaoAtingidos.length})
          </h2>
          <div className="space-y-2">
            {itensNaoAtingidos.map((item, i) => (
              <div key={i} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">{item.area}</p>
                <p className="mt-0.5 text-sm font-medium text-red-800">{item.pergunta}</p>
                {item.resultado && (
                  <p className="mt-1 text-xs text-red-600">Resultado: {item.resultado}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Todos os itens avaliados */}
      {itens.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Todos os itens avaliados ({itens.length})</h2>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Área", "Pergunta", "Peso", "Resultado", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => {
                  const isNC2 = isNC(item);
                  return (
                    <tr key={i} className={cn("border-b hover:bg-muted/20", isNC2 && "bg-red-50/50")}>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[140px] truncate">{item.area}</td>
                      <td className="px-4 py-2.5 max-w-[300px]">{item.pergunta}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{item.peso != null ? fmtNumber(item.peso, 1) : "—"}</td>
                      <td className="px-4 py-2.5">{item.resultado ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {isNC2 ? (
                          <span className="flex items-center gap-1 text-red-600 font-medium text-xs">
                            <XCircle className="h-3.5 w-3.5" /> NC
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" /> C
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sem dados de itens/áreas */}
      {areas.length === 0 && itens.length === 0 && (
        <div className="rounded-xl border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
          Dados detalhados de áreas e itens não disponíveis para este checklist.
          <br />
          <span className="text-xs mt-1 block">Os dados de itens são carregados a partir do PDF importado via staging.</span>
        </div>
      )}
    </div>
  );
}
