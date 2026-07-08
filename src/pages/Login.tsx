import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Hammer, Mail, CheckCircle2, User, Lock } from "lucide-react";
import { checklistSupabase } from "@/integrations/checklist/client";
import { useAuth } from "@/hooks/useAuth";
import type { Modulo } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Tab = "login" | "cadastro";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("login");

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <Hammer className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white">Maintenance Hub</h1>
          <p className="mt-1 text-sm text-slate-400">Plataforma Integrada de Manutenção</p>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/80 backdrop-blur-xl p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-700/50 p-1 mb-6 gap-1">
            {(["login", "cadastro"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-sm font-medium transition-all",
                  tab === t
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {t === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {tab === "login" ? <LoginForm /> : <CadastroForm onSuccess={() => setTab("login")} />}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Maintenance Hub v1.0 — Uso interno
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Login form
// ──────────────────────────────────────────────
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: err } = await checklistSupabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (err) {
      if (err.message.includes("Email not confirmed")) {
        setError("E-mail ainda não confirmado. Verifique sua caixa de entrada.");
      } else if (err.message.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos.");
      } else {
        setError(err.message);
      }
    }
  }

  async function handleResendEmail() {
    if (!email) { setError("Digite seu e-mail para reenviar a confirmação."); return; }
    setSubmitting(true);
    const { error: err } = await checklistSupabase.auth.resend({ type: "signup", email });
    setSubmitting(false);
    if (!err) setEmailSent(true);
    else setError(err.message);
  }

  if (emailSent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        <p className="font-medium text-white">E-mail de confirmação reenviado!</p>
        <p className="text-sm text-slate-400">Verifique sua caixa de entrada e clique no link para ativar sua conta.</p>
        <button onClick={() => setEmailSent(false)} className="mt-2 text-xs text-primary hover:underline">
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <InputField
        label="E-mail"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="seu@email.com"
        icon={<Mail className="h-4 w-4 text-slate-500" />}
        autoFocus
      />
      <PasswordField label="Senha" value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((v) => !v)} />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          {error.includes("confirmado") && (
            <button type="button" onClick={handleResendEmail} className="ml-2 underline hover:text-red-300 transition-colors">
              Reenviar e-mail
            </button>
          )}
        </div>
      )}

      <SubmitButton loading={submitting} label="Entrar" loadingLabel="Entrando..." />
    </form>
  );
}

// ──────────────────────────────────────────────
// Cadastro form
// ──────────────────────────────────────────────
function CadastroForm({ onSuccess }: { onSuccess: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const modulos: Modulo[] = ["checklist"];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) { setError("A senha deve ter no mínimo 6 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }

    setSubmitting(true);
    const { data: signUpData, error: err } = await checklistSupabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome, modulos: [], role: "user", status: "pending" },
      },
    });

    // Insere solicitação de acesso no staging para o admin aprovar
    if (!err && signUpData.user) {
      await checklistSupabase.from("checklist_import_staging").insert({
        arquivo_nome: email,
        checklist_id: null,
        status: "aguardando_conferencia",
        mensagem: "solicitacao_acesso",
        extracted_data: {
          user_id: signUpData.user.id,
          email,
          nome,
          requested_modulos: modulos,
        },
      });
    }

    setSubmitting(false);

    if (err) {
      if (err.message.includes("already registered")) {
        setError("Este e-mail já está cadastrado. Tente fazer login.");
      } else {
        setError(err.message);
      }
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        <p className="font-medium text-white">Conta criada com sucesso!</p>
        <p className="text-sm text-slate-400">
          Verifique sua caixa de entrada e clique no link de confirmação para ativar sua conta.
        </p>
        <button onClick={onSuccess} className="mt-2 text-xs text-primary hover:underline">
          Ir para o login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCadastro} className="space-y-4" autoComplete="off">
      <InputField
        label="Nome completo"
        type="text"
        value={nome}
        onChange={setNome}
        placeholder="Seu nome"
        icon={<User className="h-4 w-4 text-slate-500" />}
        required
        autoFocus
        autoComplete="off"
      />
      <InputField
        label="E-mail"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="seu@email.com"
        icon={<Mail className="h-4 w-4 text-slate-500" />}
        required
        autoComplete="off"
      />
      <PasswordField label="Senha" value={password} onChange={setPassword} show={showPw} onToggle={() => setShowPw((v) => !v)} autoComplete="new-password" />
      <PasswordField label="Confirmar senha" value={confirm} onChange={setConfirm} show={showPw} onToggle={() => setShowPw((v) => !v)} autoComplete="new-password" />



      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <SubmitButton loading={submitting} label="Criar conta" loadingLabel="Criando conta..." />
    </form>
  );
}

// ──────────────────────────────────────────────
// Shared sub-components
// ──────────────────────────────────────────────
function InputField({
  label, type, value, onChange, placeholder, icon, required, autoFocus, autoComplete,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: React.ReactNode; required?: boolean; autoFocus?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-slate-600 bg-slate-700/50 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors",
            icon ? "pl-10 pr-4" : "px-4"
          )}
        />
      </div>
    </div>
  );
}

function PasswordField({
  label, value, onChange, show, onToggle, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="w-full rounded-lg border border-slate-600 bg-slate-700/50 pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all",
        "hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {loadingLabel}</> : label}
    </button>
  );
}
