import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;      // rota fixa, ex: "/checklist"
  back?: boolean;       // usa navigate(-1) — voltar histórico
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, backTo, back, children }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex items-center gap-3">
        {(back || backTo) && (
          <button
            onClick={handleBack}
            className="flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-muted transition-colors shrink-0"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
