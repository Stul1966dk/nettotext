import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Her lander brugeren, når hun klikker på linket i login-mailen.
 * Linket veksles til en session, og hun sendes videre til dashboardet.
 *
 * To former understøttes: token_hash (den anbefalede, virker også hvis
 * mailen åbnes i en anden browser) og code (Supabases standardskabelon).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  const videre = request.nextUrl.clone();
  videre.search = "";

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      videre.pathname = "/app";
      return NextResponse.redirect(videre);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      videre.pathname = "/app";
      return NextResponse.redirect(videre);
    }
  }

  // Linket er brugt før, udløbet eller forkert. Vi siger hvad der skete,
  // men afslører aldrig den bagvedliggende fejl fra Supabase.
  videre.pathname = "/log-ind";
  videre.searchParams.set("fejl", "link");
  return NextResponse.redirect(videre);
}
