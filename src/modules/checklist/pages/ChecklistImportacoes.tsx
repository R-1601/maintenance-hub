import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  CopyMinus, RefreshCw, Eye, ChevronUp, AlertTriangle, LogIn, LogOut, ClipboardCheck,
} from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { LoginModal } from "@/shared/components/LoginModal";
import { checklistSupabase } from "@/integrations/checklist/client";
import { pdfToText, parseChecklistText, type ExtractedChecklist } from "@/lib/pdfParser";
import { computeFileHash } from "@/lib/arquivoHash";
import { buildImportKey } from "@/lib/checklistImportKey";
import { fmtScore, fmtDateBR, fmtNumber } from "@/shared/utils/format";
import { formatStoreName } from "@/shared/utils/storeUtils";
import { cn } from "@/lib/utils";

type ItemStatus = "aguardando" | "lendo" | "salvando" | "duplicado" | "erro" | "salvo";

interface Item {
  file: File;
  status: ItemStatus;
  msg?: string;
  parsed?: ExtractedChecklist;
  showDetail?: boolean;
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; Icon: React.ElementType }> = {
  aguardando: { label: "Aguardando", color: "bg-gray-100 text-gray-600", Icon: FileText },
  lendo: { label: "Lendo PDF...", color: "bg-blue-100 text-blue-700", Icon: Loader2 },
  salvando: { label: "Salvando...", color: "bg-amber-100 text-amber-700", Icon: Loader2 },
  duplicado: { label: "Duplicado ignorado", color: "bg-gray-100 text-gray-500", Icon: CopyMinus },
  erro: { label: "Erro", color: "bg-red-100 text-red-700", Icon: XCircle },
  salvo: { label: "Aguardando conferência", color: "bg-sky-100 text-sky-700", Icon: ClipboardCheck },
};

export default function ChecklistImportacoes() {
  const [items, setItems] = useState<Item[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pendingProcess, setPendingProcess] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    checklistSupabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    const { data: sub } = checklistSupabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function handleLoginSuccess() {
    setShowLogin(false);
    if (pendingProcess !== null) {
      const idx = pendingProcess;
      setPendingProcess(null);
      // reset status so it can retry
      update(idx, { status: "aguardando", msg: undefined });
      setTimeout(() => processOne(idx), 100);
    }
  }

  async function handleLogout() {
    await checklistSupabase.auth.signOut();
  }

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

    // 1. Ler e parsear PDF no browser
    update(idx, { status: "lendo" });
    let parsed: ExtractedChecklist;
    try {
      const buf = await it.file.arrayBuffer();
      const text = await pdfToText(buf);
      parsed = parseChecklistText(text);
    } catch (e) {
      update(idx, { status: "erro", msg: e instanceof Error ? e.message : "Falha ao ler o PDF" });
      return;
    }

    update(idx, { status: "salvando", parsed });

    // 2. Upload do PDF para o bucket "checklists" no Supabase Storage
    let arquivoPath: string | null = null;
    try {
      const mes = (parsed.data_visita ?? new Date().toISOString().slice(0, 7)).slice(0, 7);
      const storagePath = `${mes}/${it.file.name}`;
      const { error: upErr } = await checklistSupabase.storage
        .from("checklists")
        .upload(storagePath, it.file, { upsert: false, contentType: "application/pdf" });
      if (!upErr) {
        arquivoPath = storagePath;
      } else if (!upErr.message.includes("already exists") && !upErr.message.includes("Duplicate")) {
        console.warn("[Import] Não foi possível enviar PDF ao Storage:", upErr.message);
      } else {
        // Arquivo já existe — reutiliza o caminho
        arquivoPath = storagePath;
      }
    } catch (e) {
      console.warn("[Import] Erro no upload do PDF:", e);
    }

    // 3. Verificar duplicidade em 3 camadas
    // Camada 1: nome do arquivo / checklist_id
    const { data: dupByName } = await checklistSupabase
      .from("checklist_import_staging")
      .select("id")
      .or(`arquivo_nome.eq.${it.file.name}${parsed.checklist_id ? `,checklist_id.eq.${parsed.checklist_id}` : ""}`)
      .maybeSingle();
    if (dupByName) {
      update(idx, { status: "duplicado", msg: "Já existe um registro com este nome ou ID de checklist.", parsed });
      return;
    }

    // Camada 2: hash SHA-256 do conteúdo do arquivo
    const fileHash = await computeFileHash(it.file);
    const { data: dupByHash } = await checklistSupabase
      .from("checklist_import_staging")
      .select("id")
      .eq("extracted_data->>arquivo_hash" as string, fileHash)
      .maybeSingle();
    if (dupByHash) {
      update(idx, { status: "duplicado", msg: "Arquivo idêntico já foi importado (mesmo conteúdo, SHA-256).", parsed });
      // Apaga arquivo duplicado do storage para não acumular lixo
      if (arquivoPath) {
        await checklistSupabase.storage.from("checklists").remove([arquivoPath]);
      }
      return;
    }

    // Camada 3: chave composta loja + data + nota
    const importKey = buildImportKey(parsed.loja_numero, parsed.data_visita, parsed.nota_final);
    if (importKey) {
      const { data: dupByKey } = await checklistSupabase
        .from("checklist_import_staging")
        .select("id")
        .eq("extracted_data->>import_key" as string, importKey)
        .maybeSingle();
      if (dupByKey) {
        update(idx, { status: "duplicado", msg: "Checklist duplicado: mesma loja, data e nota já registrados.", parsed });
        if (arquivoPath) {
          await checklistSupabase.storage.from("checklists").remove([arquivoPath]);
        }
        return;
      }
    }

    // 3b. Buscar loja correspondente
    let loja_id: string | null = null;
    if (parsed.loja_numero) {
      const { data: loja } = await checklistSupabase
        .from("lojas")
        .select("id")
        .eq("loja_numero", parsed.loja_numero)
        .maybeSingle();
      loja_id = loja?.id ?? null;
    }
    if (!loja_id && parsed.unidade) {
      const { data: loja } = await checklistSupabase
        .from("lojas")
        .select("id")
        .ilike("unidade", `%${parsed.unidade.slice(0, 20)}%`)
        .maybeSingle();
      loja_id = loja?.id ?? null;
    }

    // 4. Salvar no staging como "aguardando_conferencia" para revisão do gestor
    //    (Fluxo: importação → conferência → confirmação/rejeição)
    const { error: errStaging } = await checklistSupabase.from("checklist_import_staging").insert({
      arquivo_nome: it.file.name,
      checklist_id: parsed.checklist_id,
      status: "aguardando_conferencia",
      extracted_data: {
        checklist_id: parsed.checklist_id,
        autor: parsed.autor,
        unidade: parsed.unidade,
        loja_numero: parsed.loja_numero,
        loja_id,
        cidade_uf: parsed.cidade_uf,
        endereco: parsed.endereco,
        empresa_prestadora: parsed.empresa_prestadora,
        data_visita: parsed.data_visita,
        hora_inicio: parsed.hora_inicio,
        hora_fim: parsed.hora_fim,
        duracao: parsed.duracao,
        nota_final: parsed.nota_final,
        resultado_parcial: parsed.resultado_parcial,
        resultado_final: parsed.resultado_final,
        inconformidades: parsed.inconformidades,
        nome_checklist: parsed.nome_checklist,
        areas: parsed.areas,
        itens: parsed.itens,
        arquivo_path: arquivoPath,
        arquivo_nome: it.file.name,
        arquivo_hash: fileHash,
        import_key: importKey,
      },
      campos_nao_encontrados: parsed.camposNaoEncontrados,
      mensagem: "Importado via Maintenance Hub",
    });

    if (errStaging) {
      const isAuth = errStaging.code === "42501" || errStaging.message.includes("permission") || errStaging.message.includes("policy") || errStaging.message.includes("JWT");
      if (isAuth) {
        update(idx, { status: "aguardando", msg: undefined, parsed });
        setPendingProcess(idx);
        setShowLogin(true);
        return;
      }
      update(idx, { status: "erro", msg: errStaging.message, parsed });
      return;
    }

    update(idx, {
      status: "salvo",
      parsed,
      msg: "Enviado para conferência. Acesse Conferência de Importações para aprovar.",
    });
    qc.invalidateQueries({ queryKey: ["checklist-importacoes"] });
    qc.invalidateQueries({ queryKey: ["checklist-conferencia"] });
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
      {showLogin && (
        <LoginModal
          client={checklistSupabase}
          sistema="Sistema de Checklist de AC"
          onSuccess={handleLoginSuccess}
          onClose={() => { setShowLogin(false); setPendingProcess(null); }}
        />
      )}

      <PageHeader title="Importar Checklists" subtitle="Arraste PDFs de checklist para extrair e salvar os dados automaticamente">
        {userEmail ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
              ✓ {userEmail}
            </span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        ) : (
          <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
            <LogIn className="h-4 w-4" /> Fazer Login
          </button>
        )}
      </PageHeader>

      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total" value={items.length} icon={FileText} iconColor="bg-blue-100 text-blue-600" />
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
          <p className="text-xs text-muted-foreground mt-1">Apenas arquivos PDF • Múltiplos arquivos permitidos</p>
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
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    <button onClick={() => processOne(idx)} className="shrink-0 rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
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
                    <PreviewTag label="Loja" value={formatStoreName(it.parsed.unidade)} />
                    <PreviewTag label="Data" value={fmtDateBR(it.parsed.data_visita)} />
                    <PreviewTag label="Nota" value={it.parsed.nota_final != null ? fmtScore(it.parsed.nota_final) : "—"}
                      color={it.parsed.nota_final != null ? (it.parsed.nota_final >= 95 ? "text-emerald-600 font-bold" : it.parsed.nota_final >= 80 ? "text-amber-600 font-bold" : "text-red-600 font-bold") : ""} />
                    <PreviewTag label="Inconform." value={fmtNumber(it.parsed.inconformidades)} />
                    {it.parsed.autor && <PreviewTag label="Técnico" value={it.parsed.autor} />}
                    {it.parsed.camposNaoEncontrados.length > 0 && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Campos ausentes: {it.parsed.camposNaoEncontrados.join(", ")}
                      </span>
                    )}
                  </div>
                )}

                {it.parsed && it.showDetail && <DetailPanel parsed={it.parsed} />}
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
      <span className={cn("font-medium", color)}>{value}</span>
    </div>
  );
}

function DetailPanel({ parsed }: { parsed: ExtractedChecklist }) {
  return (
    <div className="mt-3 ml-8 rounded-lg border bg-muted/30 p-4 space-y-4 text-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="Loja" value={formatStoreName(parsed.unidade)} />
        <Field label="Nº da Loja" value={parsed.loja_numero ?? "—"} />
        <Field label="Cidade/UF" value={parsed.cidade_uf ?? "—"} />
        <Field label="Técnico" value={parsed.autor ?? "—"} />
        <Field label="Data da Visita" value={fmtDateBR(parsed.data_visita)} />
        <Field label="ID do Checklist" value={parsed.checklist_id ?? "—"} />
      </div>

      <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-background border">
        <ScoreField label="Resultado Parcial" value={parsed.resultado_parcial} />
        <ScoreField label="Resultado Final" value={parsed.resultado_final} />
        <ScoreField label="Nota Final" value={parsed.nota_final} highlight />
        <div>
          <p className="text-xs text-muted-foreground">Inconformidades</p>
          <p className={cn("text-xl font-bold", parsed.inconformidades > 0 ? "text-red-600" : "text-emerald-600")}>
            {parsed.inconformidades}
          </p>
        </div>
      </div>

      {parsed.areas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resultado por Área</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parsed.areas.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-xs">
                <span className="font-medium truncate mr-2">{a.area}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">{a.resultado}</span>
                  {a.percentual != null && (
                    <span className={cn("font-bold", a.percentual >= 95 ? "text-emerald-600" : a.percentual >= 80 ? "text-amber-600" : "text-red-600")}>
                      {a.percentual}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed.itens.filter((i) => /n[aã]o atingiu|n[aã]o$/i.test(i.status ?? "")).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Itens com Inconformidade ({parsed.itens.filter((i) => /n[aã]o atingiu|n[aã]o$/i.test(i.status ?? "")).length})
          </p>
          <div className="space-y-1">
            {parsed.itens.filter((i) => /n[aã]o atingiu|n[aã]o$/i.test(i.status ?? "")).map((item, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-xs">
                <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
                <div>
                  {item.area && <span className="font-medium text-red-700 mr-1">[{item.area}]</span>}
                  <span>{item.pergunta}</span>
                </div>
              </div>
            ))}
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

function ScoreField({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }) {
  const color = value == null ? "" : value >= 95 ? "text-emerald-600" : value >= 80 ? "text-amber-600" : "text-red-600";
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn(highlight ? "text-2xl font-black" : "text-lg font-bold", color)}>
        {value != null ? fmtScore(value) : "—"}
      </p>
    </div>
  );
}
