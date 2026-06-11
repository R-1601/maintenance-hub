import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_PREDIAL_SUPABASE_URL as string;
const key = import.meta.env.VITE_PREDIAL_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) {
  console.warn("[predial] Supabase env vars not set. Check VITE_PREDIAL_SUPABASE_URL and VITE_PREDIAL_SUPABASE_PUBLISHABLE_KEY");
}

export const predialSupabase = createClient(url ?? "", key ?? "");
