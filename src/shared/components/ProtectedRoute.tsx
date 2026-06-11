import { Navigate, Outlet } from "react-router-dom";
import { Loader2, Clock, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated, loading, isPending, isRejected, signOut, nome, email } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mx-auto mb-4">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground mb-1">
            Olá, <strong>{nome}</strong>!
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Sua conta (<strong>{email}</strong>) foi criada com sucesso e está aguardando aprovação do administrador. Você receberá acesso assim que for aprovado.
          </p>
          <button
            onClick={signOut}
            className="text-sm text-primary hover:underline"
          >
            Sair e aguardar
          </button>
        </div>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Acesso não autorizado</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Sua solicitação de acesso foi recusada pelo administrador. Entre em contato para mais informações.
          </p>
          <button
            onClick={signOut}
            className="text-sm text-primary hover:underline"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
