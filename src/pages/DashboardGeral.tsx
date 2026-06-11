import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Wind, Wrench, DollarSign, AlertTriangle, ClipboardList,
  TrendingUp, Package, Store, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";
import { checklistSupabase } from "@/integrations/checklist/client";
import { predialSupabase } from "@/integrations/predial/client";
import { fmtMoney, fmtScore, fmtDateBR, fmtNumber, monthLabel, scoreLabel } from "@/shared/utils/format";
import { formatStoreName, shortStoreName } from "@/shared/utils/storeUtils";
import { cn } from "@/lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

type StoreStatus = "OK" | "Atenção" | "Crítico" | "Sem dados";

function getStoreStatus(media: number | null, inc: number, custo: number): StoreStatus {
  if (media === null && custo === 0) return "Sem dados";
  if ((media !== null && media < 85) || inc >= 5) return "Crítico";
  if ((media !== null && media < 95) || inc > 0 || custo > 50000) return "Atenção";
  return "OK";
}

const statusBadge: Record<StoreStatus, string> = {
  OK: "bg-emerald-100 text-emerald-700",
  "Atenção": "bg-amber-100 text-amber-700",
  "Crítico": "bg-red-100 text-red-700",
  "Sem dados": "bg-gray-100 text-gray-500",
};

export default function DashboardGeral() {
  const { data: clData } = useQuery({
    queryKey: ["geral-checklist"],
    queryFn: async () => {
      const [cl, lojas] = await Promise.all([
        checklistSupabase
          .from("checklists")
          .select("id, loja_id, data_visita, nota_final, inconformidades, autor")
          .eq("status", "sucesso"),
        checklistSupabase.from("lojas").select("id, unidade, loja_numero"),
      ]);
      return { checklists: cl.data ?? [], lojas: lojas.data ?? [] };
    },
  });

  const { data: pdData } = useQuery({
    queryKey: ["geral-predial"],
    queryFn: async () => {
      const [os, lojas] = await Promise.all([
        predialSupabase
          .from("ordens_servico")
          .select("id, loja_id, status, custo_total, data_abertura"),
        predialSupabase.from("lojas").select("id, nome, codigo_loja"),
      ]);
      const mats = await predialSupabase.from("materiais").select("id, ordem_servico_id, valor_total");
      return {
        os: os.data ?? [],
        lojas: lojas.data ?? [],
        materiais: mats.data ?? [],
      };
    },
  });

  const stats = useMemo(() => {
    const checklists = clData?.checklists ?? [];
    const clLojas = clData?.lojas ?? [];
    const os = pdData?.os ?? [];
    const pdLojas = pdData?.lojas ?? [];
    const materiais = pdData?.materiais ?? [];

    const clLojaById = new Map(clLojas.map((l: { id: string; unidade: string; loja_numero: string | null }) => [l.id, l]));
    const pdLojaById = new Map(pdLojas.map((l: { id: string; nome: string; codigo_loja: string | null }) => [l.id, l]));

    const notas = checklists.map((c: { nota_final: number | null }) => c.nota_final).filter((n: number | null): n is number => n !== null);
    const totalInc = checklists.reduce((s: number, c: { inconformidades: number | null }) => s + (c.inconformidades ?? 0), 0);
    const avgNota = notas.length ? notas.reduce((a: number, b: number) => a + b, 0) / notas.length : null;
    const totalCusto = os.reduce((s: number, o: { custo_total: number | null }) => s + Number(o.custo_total ?? 0), 0);
    const totalMats = materiais.reduce((s: number, m: { valor_total: number | null }) => s + Number(m.valor_total ?? 0), 0);

    // Meses compartilhados
    const clPorMes = new Map<string, { notas: number[]; count: number }>();
    for (const c of checklists) {
      if (!c.data_visita) continue;
      const [y, m] = c.data_visita.split("-");
      const key = `${y}-${m}`;
      const cur = clPorMes.get(key) ?? { notas: [], count: 0 };
      if (c.nota_final !== null) cur.notas.push(c.nota_final);
      cur.count++;
      clPorMes.set(key, cur);
    }
    const pdPorMes = new Map<string, { custo: number; qtd: number }>();
    for (const o of os) {
      if (!o.data_abertura) continue;
      const d = new Date(o.data_abertura);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = pdPorMes.get(key) ?? { custo: 0, qtd: 0 };
      cur.custo += Number(o.custo_total ?? 0);
      cur.qtd++;
      pdPorMes.set(key, cur);
    }

    const todosOsMeses = new Set([...clPorMes.keys(), ...pdPorMes.keys()]);
    const graficoMensal = [...todosOsMeses]
      .sort()
      .slice(-12)
      .map((key) => {
        const cl = clPorMes.get(key);
        const pd = pdPorMes.get(key);
        const avg = cl?.notas.length ? cl.notas.reduce((a, b) => a + b, 0) / cl.notas.length : 0;
        return {
          mes: monthLabel(key),
          checklists: cl?.count ?? 0,
          ordens: pd?.qtd ?? 0,
          custoOS: pd?.custo ?? 0,
          mediaChecklist: +avg.toFixed(1),
        };
      });

    // Consolidado por loja (chave: número da loja ou nome)
    type LojaConsolidada = {
      nome: string;
      fullNome: string;
      checklists: number;
      mediaChecklist: number | null;
      inconformidades: number;
      totalOS: number;
      custoTotal: number;
      ultimaVisita: string | null;
      ultimaOS: string | null;
      status: StoreStatus;
    };

    const consolidado = new Map<string, LojaConsolidada>();

    for (const c of checklists) {
      if (!c.loja_id) continue;
      const l = clLojaById.get(c.loja_id);
      if (!l) continue;
      const key = shortStoreName(l.unidade);
      const cur = consolidado.get(key) ?? {
        nome: key, fullNome: formatStoreName(l.unidade),
        checklists: 0, mediaChecklist: null, inconformidades: 0,
        totalOS: 0, custoTotal: 0, ultimaVisita: null, ultimaOS: null, status: "Sem dados",
      };
      cur.checklists++;
      cur.inconformidades += c.inconformidades ?? 0;
      if (!cur.ultimaVisita || (c.data_visita ?? "") > cur.ultimaVisita) cur.ultimaVisita = c.data_visita;
      consolidado.set(key, cur);
    }

    // Recalcula médias de checklist
    const notasPorLoja = new Map<string, number[]>();
    for (const c of checklists) {
      if (!c.loja_id || c.nota_final === null) continue;
      const l = clLojaById.get(c.loja_id);
      if (!l) continue;
      const key = shortStoreName(l.unidade);
      const arr = notasPorLoja.get(key) ?? [];
      arr.push(c.nota_final);
      notasPorLoja.set(key, arr);
    }
    for (const [key, notas] of notasPorLoja) {
      const entry = consolidado.get(key);
      if (entry) entry.mediaChecklist = notas.reduce((a, b) => a + b, 0) / notas.length;
    }

    for (const o of os) {
      if (!o.loja_id) continue;
      const l = pdLojaById.get(o.loja_id);
      if (!l) continue;
      const key = shortStoreName(l.nome);
      const cur = consolidado.get(key) ?? {
        nome: key, fullNome: l.nome,
        checklists: 0, mediaChecklist: null, inconformidades: 0,
        totalOS: 0, custoTotal: 0, ultimaVisita: null, ultimaOS: null, status: "Sem dados",
      };
      cur.totalOS++;
      cur.custoTotal += Number(o.custo_total ?? 0);
      if (!cur.ultimaOS || (o.data_abertura ?? "") > cur.ultimaOS) cur.ultimaOS = o.data_abertura;
      consolidado.set(key, cur);
    }

    // Calcular status
    for (const [, entry] of consolidado) {
      entry.status = getStoreStatus(entry.mediaChecklist, entry.inconformidades, entry.custoTotal);
    }

    const lojasList = [...consolidado.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));

    const topCusto = [...lojasList].sort((a, b) => b.custoTotal - a.custoTotal).slice(0, 8);
    const topInc = [...lojasList].filter((l) => l.inconformidades > 0).sort((a, b) => b.inconformidades - a.inconformidades).slice(0, 8);

    return {
      totalChecklists: checklists.length,
      avgNota,
      totalInc,
      totalOS: os.length,
      totalCusto,
      custoMedio: os.length ? totalCusto / os.length : 0,
      totalMats,
      lojasImpactadas: consolidado.size,
      graficoMensal,
      lojasList,
      topCusto,
      topInc,
    };
  }, [clData, pdData]);

  const isLoading = !clData && !pdData;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard Geral" subtitle="Visão consolidada dos dois sistemas" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard Geral" subtitle="Visão consolidada — Ar-Condicionado + Manutenção Predial">
        <Link to="/checklist" className="text-xs text-primary hover:underline flex items-center gap-1">
          Ar-Condicionado <ArrowRight className="h-3 w-3" />
        </Link>
        <Link to="/predial" className="text-xs text-amber-600 hover:underline flex items-center gap-1">
          Manutenção Predial <ArrowRight className="h-3 w-3" />
        </Link>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <StatCard title="Lojas Impactadas" value={fmtNumber(stats.lojasImpactadas)} icon={Store} iconColor="bg-blue-100 text-blue-600" />
        <StatCard title="Total de Checklists" value={fmtNumber(stats.totalChecklists)} icon={Wind} iconColor="bg-sky-100 text-sky-600" />
        <StatCard title="Média Checklists" value={stats.avgNota != null ? fmtScore(stats.avgNota) : "—"} subtitle={stats.avgNota != null ? scoreLabel(stats.avgNota) : ""} icon={TrendingUp} iconColor="bg-emerald-100 text-emerald-600" />
        <StatCard title="Inconformidades" value={fmtNumber(stats.totalInc)} icon={AlertTriangle} iconColor="bg-red-100 text-red-600" />
        <StatCard title="Ordens de Serviço" value={fmtNumber(stats.totalOS)} icon={Wrench} iconColor="bg-amber-100 text-amber-600" />
        <StatCard title="Custo Total OS" value={fmtMoney(stats.totalCusto)} icon={DollarSign} iconColor="bg-orange-100 text-orange-600" />
        <StatCard title="Custo Médio OS" value={fmtMoney(stats.custoMedio)} icon={DollarSign} iconColor="bg-yellow-100 text-yellow-600" />
        <StatCard title="Total Materiais" value={fmtMoney(stats.totalMats)} icon={Package} iconColor="bg-violet-100 text-violet-600" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Checklists × Ordens de Serviço por Mês</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.graficoMensal} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="checklists" name="Checklists" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
              <Bar dataKey="ordens" name="Ordens de Serviço" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Evolução Mensal dos Custos</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.graficoMensal} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtMoney(v)} />
              <Line type="monotone" dataKey="custoOS" name="Custo OS" stroke={COLORS[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Top Lojas — Maior Custo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.topCusto} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={58} />
              <Tooltip formatter={(v) => fmtMoney(v)} />
              <Bar dataKey="custoTotal" name="Custo" fill={COLORS[2]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Top Lojas — Mais Inconformidades</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.topInc} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={58} />
              <Tooltip />
              <Bar dataKey="inconformidades" name="Inconformidades" fill={COLORS[3]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela consolidada por loja */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-sm font-semibold">Consolidado por Loja</h3>
          <span className="text-xs text-muted-foreground">{stats.lojasList.length} lojas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Loja", "Checklists", "Média", "Inconform.", "Total OS", "Custo Total", "Última Visita", "Última OS", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.lojasList.map((loja, i) => (
                <tr key={i} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium whitespace-nowrap max-w-[160px] truncate" title={loja.fullNome}>
                    {loja.nome}
                  </td>
                  <td className="px-4 py-3 text-center">{fmtNumber(loja.checklists)}</td>
                  <td className={cn("px-4 py-3 text-center font-medium", loja.mediaChecklist != null ? (loja.mediaChecklist >= 95 ? "text-emerald-600" : loja.mediaChecklist >= 80 ? "text-amber-600" : "text-red-600") : "")}>
                    {loja.mediaChecklist != null ? fmtScore(loja.mediaChecklist) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{loja.inconformidades}</td>
                  <td className="px-4 py-3 text-center">{fmtNumber(loja.totalOS)}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(loja.custoTotal)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDateBR(loja.ultimaVisita)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDateBR(loja.ultimaOS)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusBadge[loja.status])}>
                      {loja.status}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.lojasList.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Nenhum dado disponível</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
