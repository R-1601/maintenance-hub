import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { checklistSupabase } from "@/integrations/checklist/client";
import { monthLabel } from "@/shared/utils/format";
import { formatStoreName, shortStoreName } from "@/shared/utils/storeUtils";

export type ChecklistLoja = {
  id: string;
  unidade: string;
  loja_numero: string | null;
  cidade_uf: string | null;
  endereco: string | null;
};

export type Checklist = {
  id: string;
  loja_id: string | null;
  data_visita: string | null;
  nota_final: number | null;
  inconformidades: number | null;
  autor: string | null;
  empresa_prestadora: string | null;
  checklist_id: string | null;
  status: string;
  _fromStaging?: boolean;
};

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export type ChecklistFilters = {
  selectedMonth?: string;
  selectedStore?: string;
  selectedTechnician?: string;
};

export function useChecklistData(filters: ChecklistFilters = {}) {
  const { selectedMonth = "all", selectedStore = "all", selectedTechnician = "all" } = filters;

  const query = useQuery({
    queryKey: ["checklist-data"],
    queryFn: async () => {
      const [clRes, lojaRes, stagingRes] = await Promise.all([
        checklistSupabase
          .from("checklists")
          .select("id, loja_id, data_visita, nota_final, inconformidades, autor, empresa_prestadora, checklist_id, status")
          .eq("status", "sucesso")
          .order("data_visita", { ascending: false }),
        checklistSupabase.from("lojas").select("id, unidade, loja_numero, cidade_uf, endereco"),
        // Lê também do staging — sucesso (Maintenance Hub) + confirmado (sistema original)
        checklistSupabase
          .from("checklist_import_staging")
          .select("id, checklist_id, extracted_data, mensagem, status")
          .in("status", ["sucesso", "confirmado", "aprovado"])
          .order("created_at", { ascending: false }),
      ]);
      if (clRes.error) throw new Error(clRes.error.message);

      // IDs já existentes em checklists para evitar duplicatas
      const existingIds = new Set((clRes.data ?? []).map((c) => c.checklist_id).filter(Boolean));

      // Mapeia staging para o tipo Checklist
      type StagingExtracted = {
        loja_id?: string | null;
        data_visita?: string | null;
        nota_final?: number | null;
        inconformidades?: number | null;
        autor?: string | null;
        empresa_prestadora?: string | null;
        checklist_id?: string | null;
      };
      const stagingChecklists: Checklist[] = (stagingRes.data ?? [])
        .filter((s) => {
          // Inclui: importados via Maintenance Hub OU confirmados/aprovados pelo sistema original
          const ex = s.extracted_data as StagingExtracted | null;
          const cid = ex?.checklist_id ?? s.checklist_id;
          const isHub = s.mensagem === "Importado via Maintenance Hub";
          const isConfirmado = s.status === "confirmado" || s.status === "aprovado";
          return (isHub || isConfirmado) && !existingIds.has(cid ?? "");
        })
        .map((s) => {
          const ex = (s.extracted_data ?? {}) as StagingExtracted;
          return {
            id: s.id,
            checklist_id: ex.checklist_id ?? s.checklist_id ?? null,
            loja_id: ex.loja_id ?? null,
            data_visita: ex.data_visita ?? null,
            nota_final: ex.nota_final ?? null,
            inconformidades: ex.inconformidades ?? null,
            autor: ex.autor ?? null,
            empresa_prestadora: ex.empresa_prestadora ?? null,
            status: "sucesso",
            _fromStaging: true,
          } as Checklist;
        });

      return {
        checklists: [...(clRes.data ?? []) as Checklist[], ...stagingChecklists],
        lojas: (lojaRes.data ?? []) as ChecklistLoja[],
      };
    },
    retry: 1,
  });

  const data = query.data;

  const result = useMemo(() => {
    const lojas = data?.lojas ?? [];
    const allChecklists = data?.checklists ?? [];
    const lojaById = new Map(lojas.map((l) => [l.id, l]));

    const mesesSet = new Set<string>();
    for (const c of allChecklists) {
      if (!c.data_visita) continue;
      const [y, m] = c.data_visita.split("-");
      if (y && m) mesesSet.add(`${y}-${m}`);
    }
    const mesesDisponiveis = [...mesesSet].sort().reverse().map((v) => ({ value: v, label: monthLabel(v) }));

    const tecnicosSet = new Set<string>();
    for (const c of allChecklists) {
      const a = (c.autor ?? "").trim();
      if (a) tecnicosSet.add(a);
    }
    const tecnicosDisponiveis = [...tecnicosSet].sort((a, b) => a.localeCompare(b, "pt-BR"));

    const lojasDisponiveis = [...lojas].sort((a, b) =>
      shortStoreName(a.unidade).localeCompare(shortStoreName(b.unidade), "pt-BR", { numeric: true }),
    );

    const checklists = allChecklists.filter((c) => {
      if (selectedStore !== "all" && c.loja_id !== selectedStore) return false;
      if (selectedTechnician !== "all" && (c.autor ?? "").trim() !== selectedTechnician) return false;
      if (selectedMonth !== "all") {
        if (!c.data_visita) return false;
        const [y, m] = c.data_visita.split("-");
        if (`${y}-${m}` !== selectedMonth) return false;
      }
      return true;
    });

    const notas = checklists.map((c) => c.nota_final).filter((n): n is number => n !== null);
    const totalInc = checklists.reduce((s, c) => s + (c.inconformidades ?? 0), 0);

    const byLoja = new Map<string, { lid: string; nome: string; fullNome: string; notas: number[]; inc: number; count: number; ultimaVisita: string | null }>();
    for (const c of checklists) {
      if (!c.loja_id) continue;
      const l = lojaById.get(c.loja_id);
      if (!l) continue;
      const cur = byLoja.get(c.loja_id) ?? {
        lid: c.loja_id,
        nome: shortStoreName(l.unidade),
        fullNome: formatStoreName(l.unidade),
        notas: [], inc: 0, count: 0, ultimaVisita: null,
      };
      if (c.nota_final !== null) cur.notas.push(c.nota_final);
      cur.inc += c.inconformidades ?? 0;
      cur.count += 1;
      if (!cur.ultimaVisita || (c.data_visita ?? "") > cur.ultimaVisita) cur.ultimaVisita = c.data_visita;
      byLoja.set(c.loja_id, cur);
    }
    const lojasRank = [...byLoja.values()].map((l) => ({ ...l, media: avg(l.notas) ?? 0 }));

    const comData = checklists.filter((c) => c.data_visita);
    const ultima = [...comData].sort((a, b) => ((a.data_visita ?? "") < (b.data_visita ?? "") ? 1 : -1))[0];
    const ultimaLoja = ultima?.loja_id ? lojaById.get(ultima.loja_id) : undefined;

    const mediaPorMesMap = new Map<string, number[]>();
    for (const c of checklists) {
      if (!c.data_visita) continue;
      const [y, m] = c.data_visita.split("-");
      const key = `${y}-${m}`;
      const arr = mediaPorMesMap.get(key) ?? [];
      if (c.nota_final !== null) arr.push(c.nota_final);
      mediaPorMesMap.set(key, arr);
    }
    const mediaPorMes = [...mediaPorMesMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, notas]) => ({ mes: monthLabel(key), media: avg(notas) ?? 0, count: notas.length }));

    const topInconformidades = [...lojasRank]
      .filter((l) => l.inc > 0)
      .sort((a, b) => b.inc - a.inc)
      .slice(0, 10)
      .map((l) => ({ loja: l.nome, inc: l.inc, media: l.media }));

    // Lojas que precisam de atenção: nota < 95 ou 5+ inconformidades
    const lojasPrecisaAtencao = lojasRank
      .filter((l) => l.media < 95 || l.inc >= 5)
      .sort((a, b) => {
        // prioriza mais inc, depois menor nota
        if (b.inc !== a.inc) return b.inc - a.inc;
        return a.media - b.media;
      })
      .map((l) => {
        // variação: compara últimas 2 visitas dessa loja
        const visitasLoja = allChecklists
          .filter((c) => c.loja_id === l.lid && c.nota_final !== null && c.data_visita)
          .sort((a, b) => (a.data_visita! > b.data_visita! ? -1 : 1));
        const variacao =
          visitasLoja.length >= 2
            ? (visitasLoja[0].nota_final! - visitasLoja[1].nota_final!)
            : null;
        const motivos: string[] = [];
        if (l.media < 95) motivos.push(`Nota abaixo de 95`);
        if (l.inc >= 5) motivos.push(`5 ou mais inconformidades`);
        if (variacao !== null && variacao <= -5) motivos.push(`Queda de ${Math.abs(variacao).toFixed(2)} pontos`);
        return { ...l, variacao, motivos, ultimaTecnico: visitasLoja[0]?.autor ?? null };
      });

    // Resumo mensal
    const resumoMensalMap = new Map<string, { checklists: number; lojas: Set<string>; inc: number; notas: number[] }>();
    for (const c of checklists) {
      if (!c.data_visita) continue;
      const [y, m] = c.data_visita.split("-");
      const key = `${y}-${m}`;
      const cur = resumoMensalMap.get(key) ?? { checklists: 0, lojas: new Set(), inc: 0, notas: [] };
      cur.checklists += 1;
      if (c.loja_id) cur.lojas.add(c.loja_id);
      cur.inc += c.inconformidades ?? 0;
      if (c.nota_final !== null) cur.notas.push(c.nota_final);
      resumoMensalMap.set(key, cur);
    }
    const resumoMensal = [...resumoMensalMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => ({
        mes: monthLabel(key),
        checklists: v.checklists,
        lojas: v.lojas.size,
        media: avg(v.notas) ?? 0,
        inc: v.inc,
      }));

    const faixasDef = [
      { name: "91–100", color: "#10b981", filter: (n: number) => n > 90 },
      { name: "71–90", color: "#f59e0b", filter: (n: number) => n > 70 && n <= 90 },
      { name: "51–70", color: "#f97316", filter: (n: number) => n > 50 && n <= 70 },
      { name: "0–50", color: "#ef4444", filter: (n: number) => n <= 50 },
    ];
    const faixas = faixasDef.map((f) => ({
      name: f.name, value: notas.filter(f.filter).length, color: f.color,
    }));

    // Lojas sem visita no período filtrado
    const lojasVisitadasIds = new Set(checklists.map((c) => c.loja_id).filter(Boolean));
    const lojasSemVisita = lojas
      .filter((l) => !lojasVisitadasIds.has(l.id))
      .sort((a, b) =>
        shortStoreName(a.unidade).localeCompare(shortStoreName(b.unidade), "pt-BR", { numeric: true }),
      );

    return {
      lojas, checklists, allChecklists,
      mesesDisponiveis, lojasDisponiveis, tecnicosDisponiveis,
      lojaById, lojasSemVisita,
      cards: {
        total: checklists.length,
        media: avg(notas),
        totalInc,
        lojasAvaliadas: new Set(checklists.map((c) => c.loja_id).filter(Boolean)).size,
        ultimaData: ultima?.data_visita ?? null,
        ultimaLojaNome: ultimaLoja ? formatStoreName(ultimaLoja.unidade) : null,
        ultimaTecnico: ultima?.autor ?? null,
      },
      mediaPorMes, topInconformidades, faixas, lojasRank, lojasPrecisaAtencao, resumoMensal,
    };
  }, [data, selectedMonth, selectedStore, selectedTechnician]);

  return { ...result, isLoading: query.isLoading, error: query.error };
}
