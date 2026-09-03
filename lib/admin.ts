import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Hvem må ind på /app/admin.
 *
 * Adressen på adminkontoen står IKKE i repoet, men i miljøvariablen
 * `ADMIN_EMAIL`. Begrundelsen står i docs/status.md: en fil på et offentligt
 * GitHub-repo, der siger "det her er adminkontoen", fortæller også en fremmed,
 * hvilken konto der er værd at angribe.
 *
 * Tjekket sker server-side med `auth.getUser()`, aldrig ud fra noget browseren
 * har sendt (sikkerhedsreglernes punkt 4 og 5).
 *
 * Bemærk rækkefølgen, som resten af adminkoden skal følge: FIND UD AF, OM DET
 * ER ADMINEN, FØR du henter data med service_role. Modsat rækkefølge ville
 * betyde, at data blev hentet uden om RLS for en, der måske ikke måtte se dem
 * (sikkerhedsreglernes punkt 6).
 */

/**
 * Er DENNE mailadresse adminens?
 *
 * Findes ved siden af `hentAdmin`, fordi /app-layoutet allerede HAR slået
 * brugeren op og ikke skal gøre det en gang til, bare for at afgøre om et
 * link skal vises. Adressen skal komme fra `auth.getUser()`, aldrig fra
 * noget browseren har sendt.
 *
 * Brug den kun til at vise eller skjule. Skal adgang afgøres, er det
 * `hentAdmin()`, der gælder: den slår selv brugeren op og stoler ikke på,
 * at kalderen har gjort det rigtigt.
 */
export function erAdmin(email: string | undefined): boolean {
  const tilladt = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!tilladt) return false;

  return email?.trim().toLowerCase() === tilladt;
}

export async function hentAdmin(): Promise<{ id: string; email: string } | null> {
  const tilladt = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  // Ingen ADMIN_EMAIL sat: så findes der ingen admin. Fejler lukket, så et
  // miljø, hvor variablen er glemt, ikke giver adgang til den første den
  // bedste indloggede.
  if (!tilladt) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase();
  if (!user || !email || email !== tilladt) return null;

  return { id: user.id, email };
}
