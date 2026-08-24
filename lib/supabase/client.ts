import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-klient til kode, der kører i browseren.
 * Bruger kun den offentlige anon-nøgle — RLS beskytter dataene.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
