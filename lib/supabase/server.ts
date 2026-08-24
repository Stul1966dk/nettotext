import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { DB_SCHEMA } from "./schema";

/**
 * Supabase-klient til Server Components, Server Actions og API routes.
 * Læser og fornyer login-sessionen via cookies.
 *
 * Brug altid supabase.auth.getUser() til at afgøre, hvem brugeren er —
 * aldrig getSession(), som stoler på data sendt fra browseren.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // NettoText har sit eget skema i en delt database. Se migrationerne.
      db: { schema: DB_SCHEMA },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Kaldt fra en Server Component, hvor cookies ikke må skrives.
            // Sessionen fornys i stedet af proxy.ts, så det er ufarligt.
          }
        },
      },
    },
  );
}
