import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { checklistSupabase } from "@/integrations/checklist/client";

const ADMIN_EMAILS = ["robert-fc@outlook.com"];

export type Modulo = "checklist";

type AccessRequest = {
  status: "aguardando_conferencia" | "aprovado" | "rejeitado" | null;
  modulos: Modulo[];
};

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);

  useEffect(() => {
    checklistSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const { data: sub } = checklistSupabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Verifica solicitação de acesso no staging
  useEffect(() => {
    if (!user) { setAccessRequest(null); return; }
    const email = user.email ?? "";
    if (ADMIN_EMAILS.includes(email)) { setAccessRequest(null); return; }

    checklistSupabase
      .from("checklist_import_staging")
      .select("status, extracted_data")
      .eq("mensagem", "solicitacao_acesso")
      .eq("arquivo_nome", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setAccessRequest(null); return; }
        const ex = (data.extracted_data ?? {}) as { modulos_aprovados?: Modulo[] };
        setAccessRequest({
          status: data.status as AccessRequest["status"],
          modulos: ex.modulos_aprovados ?? [],
        });
      });
  }, [user]);

  const signOut = () => checklistSupabase.auth.signOut();

  const email = user?.email ?? null;
  const isAdmin = !!email && ADMIN_EMAILS.includes(email);

  // Determina módulos e estado de pendência
  let modulos: Modulo[];
  let isPending = false;
  let isRejected = false;

  if (isAdmin) {
    modulos = ["checklist"];
  } else if (accessRequest?.status === "aprovado") {
    modulos = accessRequest.modulos.length > 0 ? accessRequest.modulos : ["checklist"];
  } else if (accessRequest?.status === "aguardando_conferencia") {
    modulos = [];
    isPending = true;
  } else if (accessRequest?.status === "rejeitado") {
    modulos = [];
    isRejected = true;
  } else {
    // Usuário antigo sem solicitação → acesso completo (compatibilidade)
    modulos = (user?.user_metadata?.modulos as Modulo[] | undefined) ?? ["checklist"];
  }

  const nome: string = user?.user_metadata?.nome ?? email?.split("@")[0] ?? "Usuário";
  const role: string = isAdmin ? "admin" : (user?.user_metadata?.role ?? "user");

  return {
    session,
    user,
    loading: session === undefined,
    isAuthenticated: !!session,
    signOut,
    email,
    nome,
    isAdmin,
    modulos,
    role,
    isPending,
    isRejected,
  };
}
