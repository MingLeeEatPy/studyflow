import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

export function supabaseHeaders(config: SupabaseConfig, accessToken?: string): HeadersInit {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${accessToken ?? config.anonKey}`,
    "Content-Type": "application/json",
  };
}

let client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = getSupabaseConfig();
  if (!config) { client = null; return client; }
  client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  return client;
}
