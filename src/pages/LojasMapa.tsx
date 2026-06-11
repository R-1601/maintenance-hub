import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { LOJAS_MAPA } from "@/lib/lojasMapa";
import { useChecklistData } from "@/modules/checklist/hooks/useChecklistData";
import { usePredialData } from "@/modules/predial/hooks/usePredialData";
import { fmtScore } from "@/shared/utils/format";
import { cn } from "@/lib/utils";
import { MapPin, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

// Dynamic import of Leaflet to avoid SSR issues
let L: typeof import("leaflet") | null = null;

function scoreColor(n: number | null) {
  if (n == null) return "#6b7280";
  if (n >= 95) return "#10b981";
  if (n >= 80) return "#f59e0b";
  return "#ef4444";
}

function createPharmacyIcon(color: string, lojaN: string) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Pin shape -->
  <path d="M20 2 C10.6 2 3 9.6 3 19 C3 31 20 50 20 50 C20 50 37 31 37 19 C37 9.6 29.4 2 20 2Z"
    fill="${color}" filter="url(#shadow)" stroke="white" stroke-width="1.5"/>
  <!-- Cross icon -->
  <rect x="14" y="11" width="12" height="4" rx="2" fill="white"/>
  <rect x="18" y="7" width="4" height="12" rx="2" fill="white"/>
  <!-- Store number -->
  <text x="20" y="34" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="white">${lojaN}</text>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface LojaInfo {
  numero: number;
  nome: string;
  endereco: string;
  lat: number | null;
  lng: number | null;
  mediaChecklist: number | null;
  totalOS: number;
  custoTotal: number;
}

export default function LojasMapa() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selected, setSelected] = useState<LojaInfo | null>(null);

  const checklistData = useChecklistData();
  const predialData = usePredialData();
  const allChecklists = checklistData.allChecklists ?? [];
  const checkLojas = checklistData.lojas ?? [];
  const allOS = predialData.allOS ?? [];
  const predLojas = predialData.lojas ?? [];

  // Build merged loja stats
  const lojaStats = new Map<number, { mediaChecklist: number | null; totalOS: number; custoTotal: number }>();
  LOJAS_MAPA.forEach((l) => {
    const checkLoja = checkLojas.find((c) => c.loja_numero === String(l.numero));
    const predLoja = predLojas.find((p) => p.codigo_loja === String(l.numero));

    const notas = checkLoja
      ? allChecklists.filter((c) => c.loja_id === checkLoja.id && c.nota_final != null).map((c) => c.nota_final!)
      : [];
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

    const osLoja = predLoja ? allOS.filter((o) => o.loja_id === predLoja.id) : [];
    const totalOS = osLoja.length;
    const custoTotal = osLoja.reduce((s, o) => s + (o.custo_total ?? 0), 0);

    lojaStats.set(l.numero, { mediaChecklist: media, totalOS, custoTotal });
  });

  useEffect(() => {
    import("leaflet").then((leaflet) => {
      L = leaflet.default ?? leaflet;
      setLeafletLoaded(true);
    });
    // Load leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !L) return;
    if (mapInstanceRef.current) return; // already init

    const map = L.map(mapRef.current, {
      center: [-23.52, -46.63],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add markers
    LOJAS_MAPA.forEach((loja) => {
      if (!loja.lat || !loja.lng || !L) return;
      const stats = lojaStats.get(loja.numero);
      const color = scoreColor(stats?.mediaChecklist ?? null);
      const iconUrl = createPharmacyIcon(color, String(loja.numero));
      const icon = L!.icon({ iconUrl, iconSize: [40, 52], iconAnchor: [20, 52], popupAnchor: [0, -54] });

      const mediaText = stats?.mediaChecklist != null
        ? `<span style="color:${color};font-weight:bold">${fmtScore(stats.mediaChecklist)}</span>`
        : '<span style="color:#6b7280">Sem dados</span>';

      const popup = `
        <div style="font-family:system-ui,sans-serif;min-width:200px">
          <div style="font-size:14px;font-weight:700;margin-bottom:4px">
            Loja ${loja.numero} · ${loja.nome}
          </div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:8px">${loja.endereco}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
            <div><div style="color:#6b7280;font-size:10px">Média AC</div>${mediaText}</div>
            <div><div style="color:#6b7280;font-size:10px">OS Predial</div><span style="font-weight:600">${stats?.totalOS ?? 0}</span></div>
          </div>
        </div>`;

      L!.marker([loja.lat, loja.lng], { icon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 260 });
    });

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  const withCoords = LOJAS_MAPA.filter((l) => l.lat && l.lng);
  const total = LOJAS_MAPA.length;
  const comDados = LOJAS_MAPA.filter((l) => {
    const s = lojaStats.get(l.numero);
    return s?.mediaChecklist != null;
  }).length;
  const criticas = LOJAS_MAPA.filter((l) => {
    const s = lojaStats.get(l.numero);
    return s?.mediaChecklist != null && s.mediaChecklist < 80;
  }).length;
  const ok = LOJAS_MAPA.filter((l) => {
    const s = lojaStats.get(l.numero);
    return s?.mediaChecklist != null && s.mediaChecklist >= 95;
  }).length;

  return (
    <div className="space-y-4 h-full flex flex-col">
      <PageHeader title="Mapa de Lojas" subtitle={`${withCoords.length} de ${total} lojas com localização geográfica`} />

      {/* Legenda + stats */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-semibold text-muted-foreground uppercase tracking-wide">Legenda (Média AC):</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" /> ≥ 95%</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400 inline-block" /> 80–94%</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> &lt; 80%</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-gray-400 inline-block" /> Sem dados</span>
        </div>
        <div className="ml-auto flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{ok} OK</span>
          <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" />{criticas} Críticas</span>
          <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-blue-500" />{comDados} com dados</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-400" />{total - withCoords.length} sem coord.</span>
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1 rounded-xl border overflow-hidden min-h-[500px] relative">
        {!leafletLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10 text-sm text-muted-foreground">
            Carregando mapa...
          </div>
        )}
        <div ref={mapRef} className="h-full w-full" style={{ minHeight: 500 }} />
      </div>

      {/* Lista de lojas sem coordenadas */}
      {LOJAS_MAPA.filter((l) => !l.lat || !l.lng).length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Lojas sem coordenadas ({LOJAS_MAPA.filter((l) => !l.lat || !l.lng).length})
          </p>
          <div className="flex flex-wrap gap-2">
            {LOJAS_MAPA.filter((l) => !l.lat || !l.lng).map((l) => (
              <span key={l.numero} className={cn("rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600")}>
                Loja {l.numero} · {l.nome}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
