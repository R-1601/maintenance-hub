import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight truncate">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>}
          {trend && (
            <p className={cn("mt-1 text-xs font-medium", trendUp ? "text-emerald-600" : "text-red-500")}>
              {trendUp ? "▲" : "▼"} {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconColor ?? "bg-primary/10 text-primary")}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
