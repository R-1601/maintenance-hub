import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen, LogOut, User, Sun, Moon } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, nome, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop */}
      <div className="hidden md:flex md:shrink-0">
        <AppSidebar collapsed={collapsed} />
      </div>

      {/* Sidebar — mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 md:hidden transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <AppSidebar collapsed={false} />
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
          {/* Mobile burger */}
          <button
            className="md:hidden rounded-md p-1.5 hover:bg-muted transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            className="hidden md:flex rounded-md p-1.5 hover:bg-muted transition-colors"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <div className="flex-1" />

          <span className="hidden sm:block text-xs text-muted-foreground">Maintenance Hub v1.0</span>

          {/* Toggle dark/light */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user && (
            <div className="flex items-center gap-2 ml-3 pl-3 border-l">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="hidden sm:block text-xs font-medium text-muted-foreground max-w-[140px] truncate">
                  {nome}
                </span>
              </div>
              <button
                onClick={signOut}
                title="Sair"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
