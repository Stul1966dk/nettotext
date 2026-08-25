import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseKonfiguration, supabaseServiceRoleNoegle } from "./konfiguration";

/**
 * Supabase-klient med service role. Omgår Row Level Security.
 *
 * Brug den kun, hvor der ikke er noget alternativ, og verificér ALTID selv,
 * at brugeren ejer det, der røres ved — RLS gør det ikke længere for dig
 * (sikkerhedsreglerne, punkt 6).
 *
 * Ingen session, ingen cookies: klienten skal ikke kunne komme til at handle
 * som en tilfældig indlogget bruger.
 */
export function createServiceClient() {
  const { url } = supabaseKonfiguration();

  return createSupabaseClient(url, supabaseServiceRoleNoegle(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
