import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_CHECKLIST_SUPABASE_URL as string;
const key = import.meta.env.VITE_CHECKLIST_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) {
  console.warn("[checklist] Supabase env vars not set. Check VITE_CHECKLIST_SUPABASE_URL and VITE_CHECKLIST_SUPABASE_PUBLISHABLE_KEY");
}

export const checklistSupabase = createClient(url ?? "", key ?? "");
