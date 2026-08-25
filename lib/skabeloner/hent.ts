import "server-only";

import { createClient } from "@/lib/supabase/server";
import { skabelonSkema, type Skabelon } from "./typer";

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
