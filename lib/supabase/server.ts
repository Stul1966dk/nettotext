import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseKonfiguration } from "./konfiguration";

/**
 * Supabase-klient til Server Components, Server Actions og API routes.
 * Læser og fornyer login-sessionen via cookies.
 *
 * Brug altid supabase.auth.getUser() til at afgøre, hvem brugeren er —
 * aldrig getSession(), som stoler på data sendt fra browseren.
 */
export async function createClient() {
  const { url, anonKey } = supabaseKonfiguration();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
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
  });
}
