import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, XCircle, Wrench, Package, DollarSign } from "lucide-react";
import { predialSupabase } from "@/integrations/predial/client";
import { fmtMoney, fmtDateBR, safeText } from "@/shared/utils/format";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────
type OS = {
  id: string; numero_os: string | null; loja_id: string | null;
  prestadora_id: string | null; tecnico_responsavel_id: string | null;
  categoria_id: string | null; status: string; custo_total: number | null;
  custo_mao_obra: number | null; custo_materiais: number | null;
  custo_pecas: number | null; data_abertura: string | null;
  data_conclusao: string | null; tipo_servico: string | null;
  descricao_problema: string | null; solucao_aplicada?: string | null;
  observacoes?: string | null;
};
type Loja      = { id: string; nome: string; codigo_loja: string | null; cidade: string | null; estado: string | null; endereco: string | null };
type Prestadora = { id: string; nome: string };
type Tecnico    = { id: string; nome: string };
type Categoria  = { id: string; nome: string };
type Material   = { id: string; descricao: string; quantidade: number | null; valor_unitario: number | null; valor_total: number | null; categoria: string | null };

// ─── Helpers ─────────────────────────────────────────────────
function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function CostCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────
export default function OrdemServicoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["os-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const [osRes, matRes] = await Promise.all([
        predialSupabase
          .from("ordens_servico")
          .select("id, numero_os, loja_id, prestadora_id, tecnico_responsavel_id, categoria_id, status, custo_total, custo_mao_obra, custo_materiais, custo_pecas, data_abertura, data_conclusao, tipo_servico, descricao_problema, solucao_aplicada, observacoes")
          .eq("id", id!)
          .single(),
        predialSupabase
          .from("materiais")
          .select("id, descricao, quantidade, valor_unitario, valor_total, categoria")
          .eq("ordem_servico_id", id!),
      ]);
      if (osRes.error) throw new Error(osRes.error.message);
      const os = osRes.data as OS;

      // Busca relacionamentos em paralelo
      const [lojaRes, prestRes, tecRes, catRes] = await Promise.all([
        os.loja_id       ? predialSupabase.from("lojas").select("id, nome, codigo_loja, cidade, estado, endereco").eq("id", os.loja_id).single() : Promise.resolve({ data: null }),
        os.prestadora_id ? predialSupabase.from("prestadoras").select("id, nome").eq("id", os.prestadora_id).single() : Promise.resolve({ data: null }),
        os.tecnico_responsavel_id ? predialSupabase.from("tecnicos").select("id, nome").eq("id", os.tecnico_responsavel_id).single() : Promise.resolve({ data: null }),
        os.categoria_id  ? predialSupabase.from("categorias").select("id, nome").eq("id", os.categoria_id).single() : Promise.resolve({ data: null }),
      ]);

      return {
        os,
        loja:      lojaRes.data as Loja | null,
        prestadora: prestRes.data as Prestadora | null,
        tecnico:   tecRes.data as Tecnico | null,
        categoria: catRes.data as Categoria | null,
        materiais: (matRes.data ?? []) as Material[],
      };
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
            ? "Não foi possível carregar os dados. Verifique permissões ou políticas do Supabase."
            : (error?.message ?? "Ordem de serviço não encontrada.")}
        </p>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      </div>
    );
  }

  const { os, loja, prestadora, tecnico, categoria, materiais } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="mt-1 rounded-md p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold leading-tight">
              OS {safeText(os.numero_os) || "—"}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loja ? `${loja.nome}${loja.cidade ? ` — ${loja.cidade}` : ""}` : "Loja não identificada"}
          </p>
        </div>
      </div>

      {/* Info grid */}
      <div className="rounded-xl border bg-card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <InfoField label="Loja"        value={loja?.nome} />
          <InfoField label="Código"      value={loja?.codigo_loja} />
          <InfoField label="Cidade/UF"   value={loja?.cidade && loja?.estado ? `${loja.cidade} / ${loja.estado}` : (loja?.cidade ?? loja?.estado)} />
          <InfoField label="Endereço"    value={loja?.endereco} />
          <InfoField label="Prestadora"  value={prestadora?.nome} />
          <InfoField label="Técnico"     value={tecnico?.nome} />
          <InfoField label="Categoria"   value={categoria?.nome} />
          <InfoField label="Tipo de Serviço" value={os.tipo_servico} />
          <InfoField label="Abertura"    value={fmtDateBR(os.data_abertura)} />
          <InfoField label="Conclusão"   value={fmtDateBR(os.data_conclusao)} />
        </div>
      </div>

      {/* Custos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <CostCard label="Custo Total"      value={fmtMoney(os.custo_total)}      icon={DollarSign} />
        <CostCard label="Mão de Obra"      value={fmtMoney(os.custo_mao_obra)}   icon={Wrench} />
        <CostCard label="Materiais"        value={fmtMoney(os.custo_materiais)}  icon={Package} />
        <CostCard label="Peças"            value={fmtMoney(os.custo_pecas)}      icon={Package} />
      </div>

      {/* Descrição do problema */}
      {os.descricao_problema && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Descrição do Problema</p>
          <p className="text-sm whitespace-pre-wrap">{os.descricao_problema}</p>
        </div>
      )}

      {/* Solução aplicada */}
      {(os as OS).solucao_aplicada && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Solução Aplicada</p>
          <p className="text-sm whitespace-pre-wrap">{(os as OS).solucao_aplicada}</p>
        </div>
      )}

      {/* Observações */}
      {(os as OS).observacoes && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Observações</p>
          <p className="text-sm whitespace-pre-wrap">{(os as OS).observacoes}</p>
        </div>
      )}

      {/* Materiais utilizados */}
      {materiais.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Materiais utilizados ({materiais.length})
          </h2>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Descrição", "Categoria", "Qtd.", "Valor Unit.", "Total"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materiais.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{m.descricao || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.categoria || "—"}</td>
                    <td className="px-4 py-2.5">{m.quantidade ?? "—"}</td>
                    <td className="px-4 py-2.5">{fmtMoney(m.valor_unitario)}</td>
                    <td className="px-4 py-2.5 font-semibold">{fmtMoney(m.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20">
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground text-right">Total materiais</td>
                  <td className="px-4 py-2.5 font-bold">
                    {fmtMoney(materiais.reduce((s, m) => s + (m.valor_total ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {materiais.length === 0 && (
        <div className="rounded-xl border bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhum material registrado para esta ordem de serviço.
        </div>
      )}
    </div>
  );
}
