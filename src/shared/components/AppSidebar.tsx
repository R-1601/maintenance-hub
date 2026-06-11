import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Wind, ClipboardList, Store, HardHat, Upload,
  Wrench, DollarSign, Package, Briefcase, Users, Settings, Hammer,
  ChevronDown, ChevronRight, Activity, Map, ClipboardCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth, type Modulo } from "@/hooks/useAuth";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  accentColor?: string;
  modulo?: Modulo;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { title: "Visão Geral", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Ar-Condicionado",
    accentColor: "text-sky-400",
    modulo: "checklist",
    items: [
      { title: "Dashboard", url: "/checklist", icon: Wind },
      { title: "Checklists / Ar-Condicionado", url: "/checklist/checklists", icon: ClipboardList },
      { title: "Lojas Avaliadas", url: "/checklist/lojas", icon: Store },
      { title: "Técnicos", url: "/checklist/tecnicos", icon: HardHat },
      { title: "Importações", url: "/checklist/importacoes", icon: Upload },
      { title: "Conferência", url: "/checklist/conferencia", icon: ClipboardCheck },
      { title: "Processamento", url: "/checklist/processamento", icon: Activity },
      { title: "Usuários", url: "/checklist/usuarios", icon: Users },
    ],
  },
  {
    label: "Manutenção Predial",
    accentColor: "text-amber-400",
    modulo: "predial",
    items: [
      { title: "Dashboard", url: "/predial", icon: Wrench },
      { title: "Checklists / Predial", url: "/predial/ordens-servico", icon: ClipboardList },
      { title: "Custos por Loja", url: "/predial/custos", icon: DollarSign },
      { title: "Materiais", url: "/predial/materiais", icon: Package },
      { title: "Prestadoras", url: "/predial/prestadoras", icon: Briefcase },
      { title: "Técnicos", url: "/predial/tecnicos", icon: HardHat },
      { title: "Importações", url: "/predial/importacoes", icon: Upload },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Mapa de Lojas", url: "/lojas", icon: Map },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

function SidebarNavGroup({
  label, accentColor, items, defaultOpen = true,
}: NavGroup & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { pathname } = useLocation();
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/"));

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
      >
        <span className={accentColor}>{label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <nav className="mt-0.5 space-y-0.5 px-2">
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const { modulos } = useAuth();

  const visibleGroups = groups.filter((g) => !g.modulo || modulos.includes(g.modulo));

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <Link to="/" className="flex h-14 items-center gap-2 px-3 border-b border-sidebar-border shrink-0 hover:bg-sidebar-accent/40 transition-colors">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Hammer className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">Maintenance Hub</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">Plataforma Integrada</div>
          </div>
        )}
      </Link>

      <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {collapsed ? (
          <CollapsedNav modulos={modulos} />
        ) : (
          visibleGroups.map((g) => <SidebarNavGroup key={g.label} {...g} />)
        )}
      </div>
    </aside>
  );
}

function CollapsedNav({ modulos }: { modulos: Modulo[] }) {
  const { pathname } = useLocation();
  const allItems = groups
    .filter((g) => !g.modulo || modulos.includes(g.modulo))
    .flatMap((g) => g.items);
  return (
    <nav className="flex flex-col items-center gap-1 px-1">
      {allItems.map((item) => {
        const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
        return (
          <Link
            key={item.url}
            to={item.url}
            title={item.title}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50",
            )}
          >
            <item.icon className="h-4 w-4" />
          </Link>
        );
      })}
    </nav>
  );
}
