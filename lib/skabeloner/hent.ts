import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  skabelonIListenSkema,
  skabelonSkema,
  type Skabelon,
  type SkabelonIListen,
} from "./typer";

/**
 * Henter én aktiv skabelon. RLS tillader kun læsning af aktive skabeloner,
 * og kun for indloggede.
 *
 * Returnerer null, hvis skabelonen ikke findes — kalderen afgør, om det er
 * en 404 eller en fejlbesked.
 */
export async function hentSkabelon(slug: string): Promise<Skabelon | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("templates")
    .select("slug, name, system_prompt, input_fields")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;

  // Kaster, hvis databasen indeholder noget, formularen ikke kan tegne.
  // Bedre en tydelig fejl i loggen end en formular med et felt for lidt.
  return skabelonSkema.parse(data);
}

/**
 * Alle aktive teksttyper, til listen hvor brugeren vælger.
 *
 * RLS viser kun de aktive, og kun for indloggede. Sorteret på `name`, så
 * rækkefølgen er den samme hver gang og ikke afhænger af, hvornår en
 * teksttype tilfældigvis blev oprettet.
 *
 * En række, der ikke kan læses, springes over frem for at vælte siden.
 * Modsat `hentSkabelon` er der ingen bruger, der venter på præcis DEN
 * teksttype: bliver én udeladt, står de andre der stadig.
 */
export async function hentSkabeloner(): Promise<SkabelonIListen[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("templates")
    .select("slug, name, description")
    .order("name");

  if (!data) return [];

  return data.flatMap((raekke) => {
    const resultat = skabelonIListenSkema.safeParse(raekke);
    return resultat.success ? [resultat.data] : [];
  });
}
