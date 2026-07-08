import { Settings, Database, ExternalLink, Shield, Info, Users } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";

export default function Configuracoes() {
  const { email, nome, isAdmin, modulos } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Informações da plataforma e acesso rápido" />

      {/* Perfil do usuário atual */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Seu Perfil</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nome</p>
            <p className="font-medium">{nome}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">E-mail</p>
            <p className="font-medium">{email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Perfil</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isAdmin ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
            }`}>
              {isAdmin ? "⚙ Admin" : "Usuário"}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Módulos com acesso</p>
            <div className="flex gap-2">
              {modulos.includes("checklist") && (
                <span className="rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-medium">Ar-Condicionado</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conexão Supabase */}
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border bg-card p-5 md:max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Módulo: Ar-Condicionado</h3>
              <p className="text-xs text-muted-foreground">Checklist Insights</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Projeto</span>
              <span className="font-mono text-xs">wyeywfuxrhfyuvpenosk</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Status</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Conectado
              </span>
            </div>
          </div>
          <div className="mt-4">
            <a href="https://supabase.com/dashboard/project/wyeywfuxrhfyuvpenosk" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir no Supabase
            </a>
          </div>
        </div>

      </div>

      {/* Sobre */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Sobre o Maintenance Hub</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Plataforma de gestão dos <strong className="text-foreground">Checklists de Ar-Condicionado</strong> realizados nas lojas.
        </p>
        <p className="text-xs text-muted-foreground mt-3">Versão <strong className="text-foreground">1.0.0</strong></p>
      </div>

      {/* Segurança */}
      <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-amber-700" />
          <p className="text-sm font-medium text-amber-800">Segurança</p>
        </div>
        <p className="text-xs text-amber-700 mt-1">
          Esta plataforma utiliza exclusivamente chaves públicas (anon/publishable) do Supabase.
          Nenhuma service_role key é exposta no frontend. Os dados são protegidos pelas políticas RLS
          configuradas nos projetos originais.
        </p>
        {isAdmin && (
          <p className="text-xs text-amber-600 mt-2">
            Para gerenciar usuários e permissões, acesse o painel do Supabase → Authentication → Users.
          </p>
        )}
      </div>

      {/* Links rápidos */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Links Rápidos</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="https://supabase.com/dashboard/project/wyeywfuxrhfyuvpenosk/storage/buckets" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors">
            <ExternalLink className="h-3.5 w-3.5" /> Storage (PDF Checklists)
          </a>
          <a href="https://supabase.com/dashboard/project/wyeywfuxrhfyuvpenosk/auth/users" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors">
            <ExternalLink className="h-3.5 w-3.5" /> Gerenciar Usuários
          </a>
          <a href="https://supabase.com/dashboard/project/wyeywfuxrhfyuvpenosk/editor" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors">
            <ExternalLink className="h-3.5 w-3.5" /> SQL Editor (Checklist)
          </a>
        </div>
      </div>
    </div>
  );
}
