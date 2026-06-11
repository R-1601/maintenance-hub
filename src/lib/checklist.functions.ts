/**
 * checklist.functions.ts
 * Funções centrais do fluxo de conferência de checklists.
 *
 * Fluxo:
 *  Upload PDF → staging (aguardando_conferencia)
 *    → Admin confirma  → status: confirmado  → cria registro em checklists (se RLS permitir)
 *    → Admin rejeita   → status: rejeitado   → apaga arquivo do Storage
 */

import { checklistSupabase } from "@/integrations/checklist/client";

// ─── Tipo do extracted_data do staging ────────────────────────────────────────
export type StagingExtracted = {
  checklist_id?: string | null;
  loja_id?: string | null;
  loja_numero?: string | null;
  unidade?: string | null;
  autor?: string | null;
  empresa_prestadora?: string | null;
  data_visita?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  duracao?: string | null;
  nota_final?: number | null;
  resultado_parcial?: number | null;
  resultado_final?: number | null;
  inconformidades?: number | null;
  nome_checklist?: string | null;
  cidade_uf?: string | null;
  endereco?: string | null;
  areas?: unknown[];
  itens?: unknown[];
  arquivo_path?: string | null;
  arquivo_nome?: string | null;
  arquivo_hash?: string | null;
  import_key?: string | null;
};

// ─── PDF — URL assinada temporária (1 hora) ───────────────────────────────────

/**
 * Gera uma URL assinada (1h) para visualizar o PDF original no bucket privado.
 */
export async function obterURLPDFAssinado(arquivoPath: string): Promise<string | null> {
  const { data, error } = await checklistSupabase.storage
    .from("checklists")
    .createSignedUrl(arquivoPath, 3600);
  if (error) {
    console.warn("[PDF] Não foi possível gerar URL assinada:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

// ─── Confirmar staging → checklist oficial ────────────────────────────────────

export type ConfirmResult = {
  ok: boolean;
  savedToChecklists: boolean;
  error?: string;
};

/**
 * Confirma um item do staging:
 * 1. Tenta inserir em `checklists` (pode ser bloqueado por RLS — não é erro fatal).
 * 2. Atualiza status do staging para "confirmado".
 */
export async function confirmStagingChecklist(
  stagingId: string,
  extracted: StagingExtracted,
): Promise<ConfirmResult> {
  // 1. Tentar salvar no banco oficial
  let savedToChecklists = false;
  const { error: errDirect } = await checklistSupabase.from("checklists").insert({
    checklist_id: extracted.checklist_id,
    loja_id: extracted.loja_id,
    autor: extracted.autor,
    empresa_prestadora: extracted.empresa_prestadora,
    data_visita: extracted.data_visita,
    nota_final: extracted.nota_final,
    inconformidades: extracted.inconformidades,
    arquivo_path: extracted.arquivo_path,
    arquivo_nome: extracted.arquivo_nome,
    status: "sucesso",
  });
  if (!errDirect) savedToChecklists = true;

  // 2. Atualizar status no staging para "confirmado"
  const { error: errUpdate } = await checklistSupabase
    .from("checklist_import_staging")
    .update({ status: "confirmado" })
    .eq("id", stagingId);

  if (errUpdate) {
    return { ok: false, savedToChecklists, error: errUpdate.message };
  }

  return { ok: true, savedToChecklists };
}

// ─── Rejeitar staging ─────────────────────────────────────────────────────────

export type RejectResult = {
  ok: boolean;
  fileDeleted: boolean;
  error?: string;
};

/**
 * Rejeita um item do staging:
 * 1. Remove o arquivo do Storage (se existir).
 * 2. Atualiza status do staging para "rejeitado".
 */
export async function rejectStagingChecklist(
  stagingId: string,
  arquivoPath: string | null | undefined,
): Promise<RejectResult> {
  // 1. Deletar arquivo do Storage
  let fileDeleted = false;
  if (arquivoPath) {
    const { error: errStorage } = await checklistSupabase.storage
      .from("checklists")
      .remove([arquivoPath]);
    if (!errStorage) fileDeleted = true;
    else console.warn("[Rejeitar] Não foi possível deletar arquivo:", errStorage.message);
  }

  // 2. Atualizar status no staging
  const { error: errUpdate } = await checklistSupabase
    .from("checklist_import_staging")
    .update({ status: "rejeitado" })
    .eq("id", stagingId);

  if (errUpdate) {
    return { ok: false, fileDeleted, error: errUpdate.message };
  }

  return { ok: true, fileDeleted };
}
