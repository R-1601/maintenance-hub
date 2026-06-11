import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  CopyMinus, RefreshCw, Eye, ChevronUp, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { predialSupabase } from "@/integrations/predial/client";
import { pdfToText } from "@/lib/pdfParser";
import { parseOSText, type ExtractedOS } from "@/lib/osPdfParser";
import { fmtMoney, fmtDateBR } from "@/shared/utils/format";
import { cn } from "@/lib/utils";

type ItemStatus = "aguardando" | "lendo" | "salvando" | "duplicado" | "erro" | "salvo";

interface Item {
  file: File;
  status: ItemStatus;
  msg?: string;
  parsed?: ExtractedOS;
  showDetail?: boolean;
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; Icon: React.ElementType }> = {
  aguardando: { label: "Aguardando", color: "bg-gray-100 text-gray-600", Icon: FileText },
  lendo: { label: "Lendo PDF...", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  salvando: { label: "Salvando...", color: "bg-amber-100 text-amber-700", Icon: Loader2 },
  duplicado: { label: "Duplicado ignorado", color: "bg-gray-100 text-gray-500", Icon: CopyMinus },
  erro: { label: "Erro", color: "bg-red-100 text-red-700", Icon: XCircle },
  salvo: { label: "Salvo com sucesso", color: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
};

const STATUS_LABEL: Record<string, string> = {
  concluida: "Concluída",
  em_execucao: "Em Execução",
  aberta: "Aberta",
  em_atraso: "Em Atraso",
  cancelada: "Cancelada",
};

export default function PredialImportacoes() {
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function onSelect(files: FileList | null) {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    setItems((prev) => [...prev, ...pdfs.map((f) => ({ file: f, status: "aguardando" as const }))]);
  }

  function update(idx: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((x, i) => i === idx ? { ...x, ...patch } : x));
  }

  async function processOne(idx: number) {
    const it = items[idx];
    if (it.status !== "aguardando") return;

    // 1. Ler e parsear PDF
    update(idx, { status: "lendo" });
    let parsed: ExtractedOS;
    try {
      const buf = await it.file.arrayBuffer();
      const text = await pdfToText(buf);
      parsed = parseOSText(text);
    } catch (e) {
      update(idx, { status: "erro", msg: e instanceof Error ? e.message : "Falha ao ler o PDF" });
      return;
    }

    update(idx, { status: "salvando", parsed });

    // 2. Verificar duplicidade pelo numero_os
    if (parsed.numero_os) {
      const { data: dup } = await predialSupabase
        .from("ordens_servico")
        .select("id")
        .eq("numero_os", parsed.numero_os)
        .maybeSingle();
      if (dup) {
        update(idx, { status: "duplicado", msg: `OS #${parsed.numero_os} já está registrada.`, parsed });
        return;
      }
    }

    // 3. Resolver IDs de FK (loja, prestadora, tecnico, categoria)
    let loja_id: string | null = null;
    if (parsed.loja_codigo) {
      const { data } = await predialSupabase.from("lojas").select("id").eq("codigo_loja", parsed.loja_codigo).maybeSingle();
      loja_id = data?.id ?? null;
    }
    if (!loja_id && parsed.loja_nome) {
      const { data } = await predialSupabase.from("lojas").select("id").ilike("nome", `%${parsed.loja_nome.slice(0, 20)}%`).maybeSingle();
      loja_id = data?.id ?? null;
    }

    let prestadora_id: string | null = null;
    if (parsed.prestadora_nome) {
      const { data } = await predialSupabase.from("prestadoras").select("id").ilike("nome", `%${parsed.prestadora_nome.slice(0, 20)}%`).maybeSingle();
      prestadora_id = data?.id ?? null;
    }

    let tecnico_responsavel_id: string | null = null;
    if (parsed.tecnico_nome) {
      const { data } = await predialSupabase.from("tecnicos").select("id").ilike("nome", `%${parsed.tecnico_nome.split(" ")[0]}%`).maybeSingle();
      tecnico_responsavel_id = data?.id ?? null;
    }

    let categoria_id: string | null = null;
    if (parsed.categoria_nome) {
      const { data } = await predialSupabase.from("categorias").select("id").ilike("nome", `%${parsed.categoria_nome.slice(0, 15)}%`).maybeSingle();
      categoria_id = data?.id ?? null;
    }

    // 4. Inserir OS
    const { data: novaOS, error } = await predialSupabase
      .from("ordens_servico")
      .insert({
        numero_os: parsed.numero_os,
        loja_id,
        prestadora_id,
        tecnico_responsavel_id,
        categoria_id,
        status: parsed.status ?? "aberta",
        tipo_servico: parsed.tipo_servico,
        descricao_problema: parsed.descricao_problema,
        data_abertura: parsed.data_abertura,
        data_conclusao: parsed.data_conclusao,
        custo_total: parsed.custo_total,
        custo_mao_obra: parsed.custo_mao_obra,
        custo_materiais: parsed.custo_materiais,
        custo_pecas: parsed.custo_pecas,
      })
      .select("id")
      .single();

    if (error) {
      const isRLS = error.code === "42501" || error.message.includes("permission") || error.message.includes("policy") || error.message.includes("JWT");
      const msg = isRLS
        ? "Sem permissão para salvar. Configure a política RLS no Supabase Predial para permitir inserções."
        : error.message;
      update(idx, { status: "erro", msg, parsed });
      return;
    }

    // 5. Inserir materiais vinculados
    if (novaOS && parsed.materiais.length > 0) {
      await predialSupabase.from("materiais").insert(
        parsed.materiais.map((m) => ({
          ordem_servico_id: novaOS.id,
          descricao: m.descricao,
          quantidade: m.quantidade,
          valor_unitario: m.valor_unitario,
          valor_total: m.valor_total,
        }))
      );
    }

    update(idx, { status: "salvo", parsed });
    qc.invalidateQueries({ queryKey: ["predial-data"] });
  }

  async function processAll() {
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "aguardando") await processOne(i);
    }
  }

  const pendentes = items.filter((x) => x.status === "aguardando").length;
  const sucesso = items.filter((x) => x.status === "salvo").length;
  const erros = items.filter((x) => x.status === "erro").length;
  const duplicados = items.filter((x) => x.status === "duplicado").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Importar Ordens de Serviço" subtitle="Arraste PDFs de OS para extrair e salvar os dados automaticamente" />

      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total" value={items.length} icon={FileText} iconColor="bg-amber-100 text-amber-600" />
          <StatCard title="Salvos" value={sucesso} icon={CheckCircle2} iconColor="bg-emerald-100 text-emerald-600" />
          <StatCard title="Com Erro" value={erros} icon={XCircle} iconColor="bg-red-100 text-red-600" />
          <StatCard title="Duplicados" value={duplicados} icon={CopyMinus} iconColor="bg-gray-100 text-gray-600" />
        </div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onSelect(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-10 text-center hover:bg-muted/50 transition-colors"
        >
          <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold">Clique ou arraste os PDFs aqui</p>
          <p className="text-xs text-muted-foreground mt-1">Apenas arquivos PDF de OS • Múltiplos arquivos permitidos</p>
          <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => onSelect(e.target.files)} />
        </div>

        {items.length > 0 && (
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setItems([])} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
              Limpar lista
            </button>
            <button
              onClick={processAll}
              disabled={pendentes === 0}
              className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Processar {pendentes > 0 ? `${pendentes} arquivo${pendentes > 1 ? "s" : ""}` : ""}
            </button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border bg-card divide-y">
          {items.map((it, idx) => {
            const cfg = STATUS_CONFIG[it.status];
            const isSpinning = it.status === "lendo" || it.status === "salvando";
            return (
              <div key={idx} className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.file.name}</p>
                    {it.msg && (
                      <p className={cn("text-xs mt-0.5", it.status === "erro" ? "text-red-500" : "text-muted-foreground")}>
                        {it.msg}
                      </p>
                    )}
                  </div>
                  <span className={cn("flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", cfg.color)}>
                    <cfg.Icon className={cn("h-3.5 w-3.5", isSpinning && "animate-spin")} />
                    {cfg.label}
                  </span>
                  {it.status === "aguardando" && (
                    <button onClick={() => processOne(idx)} className="shrink-0 rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors">
                      Processar
                    </button>
                  )}
                  {it.parsed && (
                    <button onClick={() => update(idx, { showDetail: !it.showDetail })} className="shrink-0 rounded-md border p-1.5 hover:bg-muted transition-colors">
                      {it.showDetail ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                {it.parsed && !it.showDetail && (
                  <div className="mt-2 ml-8 flex flex-wrap gap-3">
                    {it.parsed.numero_os && <PreviewTag label="OS" value={`#${it.parsed.numero_os}`} />}
                    {it.parsed.loja_nome && <PreviewTag label="Loja" value={it.parsed.loja_nome} />}
                    {it.parsed.loja_codigo && <PreviewTag label="Cód." value={it.parsed.loja_codigo} />}
                    <PreviewTag label="Abertura" value={fmtDateBR(it.parsed.data_abertura)} />
                    {it.parsed.status && (
                      <PreviewTag label="Status" value={STATUS_LABEL[it.parsed.status] ?? it.parsed.status}
                        color={it.parsed.status === "concluido" ? "text-emerald-600 font-bold" : it.parsed.status === "cancelado" ? "text-red-600" : "text-amber-600"} />
                    )}
                    {it.parsed.custo_total != null && (
                      <PreviewTag label="Custo Total" value={fmtMoney(it.parsed.custo_total)} color="font-bold" />
                    )}
                    {it.parsed.prestadora_nome && <PreviewTag label="Prestadora" value={it.parsed.prestadora_nome} />}
                    {it.parsed.camposNaoEncontrados.length > 0 && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Campos ausentes: {it.parsed.camposNaoEncontrados.join(", ")}
                      </span>
                    )}
                  </div>
                )}

                {it.parsed && it.showDetail && <OSDetailPanel parsed={it.parsed} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreviewTag({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-medium", color)}>{value || "—"}</span>
    </div>
  );
}

function OSDetailPanel({ parsed }: { parsed: ExtractedOS }) {
  const STATUS_LABEL: Record<string, string> = {
    concluida: "Concluída", em_execucao: "Em Execução",
    aberta: "Aberta", em_atraso: "Em Atraso", cancelada: "Cancelada",
  };
  return (
    <div className="mt-3 ml-8 rounded-lg border bg-muted/30 p-4 space-y-4 text-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Nº OS" value={parsed.numero_os ? `#${parsed.numero_os}` : "—"} />
        <Field label="Loja" value={parsed.loja_nome ?? "—"} />
        <Field label="Código Loja" value={parsed.loja_codigo ?? "—"} />
        <Field label="Prestadora" value={parsed.prestadora_nome ?? "—"} />
        <Field label="Técnico" value={parsed.tecnico_nome ?? "—"} />
        <Field label="Categoria" value={parsed.categoria_nome ?? "—"} />
        <Field label="Tipo de Serviço" value={parsed.tipo_servico ?? "—"} />
        <Field label="Status" value={parsed.status ? (STATUS_LABEL[parsed.status] ?? parsed.status) : "—"} />
        <Field label="Data Abertura" value={fmtDateBR(parsed.data_abertura)} />
        <Field label="Data Conclusão" value={fmtDateBR(parsed.data_conclusao)} />
      </div>

      {parsed.descricao_problema && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Descrição do Problema</p>
          <p className="rounded-md border bg-background px-3 py-2 text-xs leading-relaxed">{parsed.descricao_problema}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-background border">
        <CostField label="Custo Total" value={parsed.custo_total} highlight />
        <CostField label="Mão de Obra" value={parsed.custo_mao_obra} />
        <CostField label="Materiais" value={parsed.custo_materiais} />
        <CostField label="Peças" value={parsed.custo_pecas} />
      </div>

      {parsed.materiais.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Materiais Utilizados ({parsed.materiais.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Descrição", "Qtd", "Unit.", "Total"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.materiais.map((m, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2">{m.descricao}</td>
                    <td className="px-3 py-2">{m.quantidade ?? "—"}</td>
                    <td className="px-3 py-2">{m.valor_unitario != null ? fmtMoney(m.valor_unitario) : "—"}</td>
                    <td className="px-3 py-2 font-medium">{m.valor_total != null ? fmtMoney(m.valor_total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate" title={value}>{value || "—"}</p>
    </div>
  );
}

function CostField({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn(highlight ? "text-lg font-black text-amber-700" : "text-base font-bold")}>
        {value != null ? fmtMoney(value) : "—"}
      </p>
    </div>
  );
}
