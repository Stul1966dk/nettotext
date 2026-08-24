import { createBrowserClient } from "@supabase/ssr";

import { supabaseKonfiguration } from "./konfiguration";

/**
 * Supabase-klient til kode, der kører i browseren.
 * Bruger kun den offentlige anon-nøgle — RLS beskytter dataene.
 */
export function createClient() {
  const { url, anonKey } = supabaseKonfiguration();
  return createBrowserClient(url, anonKey);
}
