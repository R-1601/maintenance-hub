import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { predialSupabase } from "@/integrations/predial/client";
import { monthLabel } from "@/shared/utils/format";

export type PredialLoja = {
  id: string;
  nome: string;
  codigo_loja: string | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
};

export type OrdemServico = {
  id: string;
  numero_os: string | null;
  loja_id: string | null;
  prestadora_id: string | null;
  tecnico_responsavel_id: string | null;
  categoria_id: string | null;
  status: string;
  custo_total: number | null;
  custo_mao_obra: number | null;
  custo_materiais: number | null;
  custo_pecas: number | null;
  data_abertura: string | null;
  data_conclusao: string | null;
  tipo_servico: string | null;
  descricao_problema: string | null;
};

export type Prestadora = { id: string; nome: string };
export type Tecnico = { id: string; nome: string };
export type Categoria = { id: string; nome: string };
export type Material = {
  id: string; ordem_servico_id: string; descricao: string;
  quantidade: number | null; valor_unitario: number | null; valor_total: number | null; categoria: string | null;
};

export type PredialFilters = {
  selectedMonth?: string;
  selectedStore?: string;
  selectedPrestadora?: string;
};

export function usePredialData(filters: PredialFilters = {}) {
  const { selectedMonth = "all", selectedStore = "all", selectedPrestadora = "all" } = filters;

  const query = useQuery({
    queryKey: ["predial-data"],
    queryFn: async () => {
      const [osRes, lojaRes, prestRes, tecRes, catRes, matRes] = await Promise.all([
        predialSupabase
          .from("ordens_servico")
          .select("id, numero_os, loja_id, prestadora_id, tecnico_responsavel_id, categoria_id, status, custo_total, custo_mao_obra, custo_materiais, custo_pecas, data_abertura, data_conclusao, tipo_servico, descricao_problema")
          .order("data_abertura", { ascending: false }),
        predialSupabase.from("lojas").select("id, nome, codigo_loja, cidade, estado, endereco"),
        predialSupabase.from("prestadoras").select("id, nome"),
        predialSupabase.from("tecnicos").select("id, nome"),
        predialSupabase.from("categorias").select("id, nome"),
        predialSupabase.from("materiais").select("id, ordem_servico_id, descricao, quantidade, valor_unitario, valor_total, categoria"),
      ]);
      if (osRes.error) throw new Error(osRes.error.message);
      return {
        os: (osRes.data ?? []) as OrdemServico[],
        lojas: (lojaRes.data ?? []) as PredialLoja[],
        prestadoras: (prestRes.data ?? []) as Prestadora[],
        tecnicos: (tecRes.data ?? []) as Tecnico[],
        categorias: (catRes.data ?? []) as Categoria[],
        materiais: (matRes.data ?? []) as Material[],
      };
    },
    retry: 1,
  });

  const data = query.data;

  const result = useMemo(() => {
    const allOS = data?.os ?? [];
    const lojas = data?.lojas ?? [];
    const prestadoras = data?.prestadoras ?? [];
    const tecnicos = data?.tecnicos ?? [];
    const categorias = data?.categorias ?? [];
    const materiais = data?.materiais ?? [];

    const lojaById = new Map(lojas.map((l) => [l.id, l]));
    const prestById = new Map(prestadoras.map((p) => [p.id, p]));
    const catById = new Map(categorias.map((c) => [c.id, c]));
    const tecById = new Map(tecnicos.map((t) => [t.id, t]));

    // Meses disponíveis
    const mesesSet = new Set<string>();
    for (const o of allOS) {
      if (!o.data_abertura) continue;
      const d = new Date(o.data_abertura);
      if (!Number.isNaN(d.getTime())) {
        mesesSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    const mesesDisponiveis = [...mesesSet].sort().reverse().map((v) => ({ value: v, label: monthLabel(v) }));

    // Filtrar
    const os = allOS.filter((o) => {
      if (selectedStore !== "all" && o.loja_id !== selectedStore) return false;
      if (selectedPrestadora !== "all" && o.prestadora_id !== selectedPrestadora) return false;
      if (selectedMonth !== "all" && o.data_abertura) {
        const d = new Date(o.data_abertura);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key !== selectedMonth) return false;
      }
      return true;
    });

    const totalCusto = os.reduce((s, o) => s + Number(o.custo_total ?? 0), 0);
    const custoMedio = os.length ? totalCusto / os.length : 0;
    const lojasAtendidas = new Set(os.map((o) => o.loja_id).filter(Boolean)).size;

    // Top lojas por custo
    const byLoja = new Map<string, { nome: string; custo: number; qtd: number }>();
    for (const o of os) {
      if (!o.loja_id) continue;
      const l = lojaById.get(o.loja_id);
      const cur = byLoja.get(o.loja_id) ?? { nome: l?.nome ?? "—", custo: 0, qtd: 0 };
      cur.custo += Number(o.custo_total ?? 0);
      cur.qtd += 1;
      byLoja.set(o.loja_id, cur);
    }
    const topLojasCusto = [...byLoja.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 10);

    // Evolução mensal
    const evolucaoMap = new Map<string, { qtd: number; custo: number }>();
    for (const o of os) {
      if (!o.data_abertura) continue;
      const d = new Date(o.data_abertura);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = evolucaoMap.get(key) ?? { qtd: 0, custo: 0 };
      cur.qtd += 1;
      cur.custo += Number(o.custo_total ?? 0);
      evolucaoMap.set(key, cur);
    }
    const evolucaoMensal = [...evolucaoMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ mes: monthLabel(key), ...v }));

    // Por categoria
    const catMap = new Map<string, { nome: string; custo: number; qtd: number }>();
    for (const o of os) {
      if (!o.categoria_id) continue;
      const cat = catById.get(o.categoria_id);
      const cur = catMap.get(o.categoria_id) ?? { nome: cat?.nome ?? "—", custo: 0, qtd: 0 };
      cur.custo += Number(o.custo_total ?? 0);
      cur.qtd += 1;
      catMap.set(o.categoria_id, cur);
    }
    const porCategoria = [...catMap.values()].sort((a, b) => b.custo - a.custo);

    // Por prestadora
    const prestMap = new Map<string, { nome: string; custo: number; qtd: number }>();
    for (const o of os) {
      if (!o.prestadora_id) continue;
      const p = prestById.get(o.prestadora_id);
      const cur = prestMap.get(o.prestadora_id) ?? { nome: p?.nome ?? "—", custo: 0, qtd: 0 };
      cur.custo += Number(o.custo_total ?? 0);
      cur.qtd += 1;
      prestMap.set(o.prestadora_id, cur);
    }
    const porPrestadora = [...prestMap.values()].sort((a, b) => b.custo - a.custo);

    // Materiais filtrados
    const osIds = new Set(os.map((o) => o.id));
    const matsFiltrados = materiais.filter((m) => osIds.has(m.ordem_servico_id));
    const totalMateriais = matsFiltrados.reduce((s, m) => s + Number(m.valor_total ?? 0), 0);

    // Última OS
    const osComData = os.filter((o) => o.data_abertura).sort((a, b) => (b.data_abertura ?? "") > (a.data_abertura ?? "") ? 1 : -1);
    const ultimaOS = osComData[0];

    return {
      allOS, os, lojas, prestadoras, tecnicos, categorias, materiais: matsFiltrados,
      lojaById, prestById, catById, tecById,
      mesesDisponiveis,
      cards: {
        totalOS: os.length,
        totalCusto,
        custoMedio,
        lojasAtendidas,
        totalMateriais,
        ultimaOS: ultimaOS?.data_abertura ?? null,
        ultimaOSNumero: ultimaOS?.numero_os ?? null,
      },
      topLojasCusto, evolucaoMensal, porCategoria, porPrestadora,
    };
  }, [data, selectedMonth, selectedStore, selectedPrestadora]);

  return { ...result, isLoading: query.isLoading, error: query.error };
}
