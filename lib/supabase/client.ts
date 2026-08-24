import { createBrowserClient } from "@supabase/ssr";

import { DB_SCHEMA } from "./schema";

/**
 * Supabase-klient til kode, der kører i browseren.
 * Bruger kun den offentlige anon-nøgle — RLS beskytter dataene.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // NettoText har sit eget skema i en delt database. Se migrationerne.
    { db: { schema: DB_SCHEMA } },
  );
}
