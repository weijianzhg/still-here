import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    url,
    publishableKey,
    configured: Boolean(url && publishableKey),
  };
}

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const { url, publishableKey, configured } = getSupabaseConfig();
  if (!configured || !url || !publishableKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }

  return browserClient;
}
