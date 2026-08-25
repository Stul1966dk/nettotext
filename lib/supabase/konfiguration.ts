// Bemærk: process.env.NEXT_PUBLIC_* skal stå ordret her. Next.js erstatter
// dem med selve værdien, når siden bygges — slår man dem op dynamisk
// (process.env[navn]), sker den erstatning ikke, og værdien bliver tom.
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Henter Supabase-opsætningen og fejler med en læsbar besked, hvis den
 * mangler. Uden dette bliver resultatet en bar "Internal Server Error",
 * der ikke røber hvad der er galt.
 *
 * Beskeden havner i serverloggen — aldrig i browseren.
 */
export function supabaseKonfiguration() {
  const mangler = [
    URL_ ? null : "NEXT_PUBLIC_SUPABASE_URL",
    ANON_KEY ? null : "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);

  if (mangler.length > 0) {
    throw new Error(
      `Supabase-opsætningen mangler: ${mangler.join(", ")}. ` +
        "Lokalt sættes de i .env.local. I produktion under " +
        "Vercel → Settings → Environment Variables — og husk at deploye " +
        "igen bagefter: NEXT_PUBLIC-variabler bages ind, når siden bygges.",
    );
  }

  return { url: URL_!, anonKey: ANON_KEY! };
}

/**
 * Service role-nøglen. Omgår ALLE RLS-regler, så den bruges kun, hvor
 * brugeren umuligt kan have rettighederne selv — konkret: at tælle
 * prøvekvoten op. Se migration 0001 for hvorfor profiles ikke har en
 * update-policy.
 *
 * Ingen NEXT_PUBLIC_-præfiks. Havner den i klientkode, kan enhver læse og
 * ændre alle brugeres data.
 */
export function supabaseServiceRoleNoegle(): string {
  const noegle = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!noegle) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY mangler. Lokalt sættes den i .env.local, " +
        "i produktion under Vercel → Settings → Environment Variables.",
    );
  }

  return noegle;
}
