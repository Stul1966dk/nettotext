import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseKonfiguration } from "./konfiguration";

/**
 * Fornyer login-sessionen på hver forespørgsel, så brugeren ikke bliver
 * logget ud midt i arbejdet. Kaldes fra proxy.ts.
 *
 * Her træffes ALDRIG beslutninger om adgang — det sker i app/app/layout.tsx.
 * Next.js' dokumentation advarer eksplicit mod at bruge proxy-laget som
 * sikkerhedslag.
 */
export async function refreshSession(request: NextRequest) {
  const { url, anonKey } = supabaseKonfiguration();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
