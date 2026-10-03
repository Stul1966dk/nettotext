import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { laengdemaal } from "@/lib/tekst/laengde";
import {
  inputFeltSkema,
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
    .select(
      "slug, name, system_prompt, uses_h1, free_wish, general_knowledge, input_fields",
    )
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

/**
 * Adresserne på de teksttyper, der deles af en produktoversigt. Migration
 * 0027.
 *
 * Editoren kender kun teksttypens adresse — kladden kan komme fra
 * browserens localStorage, hvor serveren ikke ser den. Derfor sendes listen
 * med i stedet for ét flag, og editoren slår selv op.
 */
export async function hentSkabelonerMedProduktoversigt(): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("templates")
    .select("slug")
    .eq("product_grid", true);

  return (data ?? []).map((raekke) => raekke.slug);
}

/**
 * Længdemålene for de teksttyper, koden selv må udvide: teksttypens adresse
 * → valgmulighedens værdi → mindste ordantal.
 *
 * Kun teksttyper, der må bruge almen viden. En tekst, der kun må bygge på
 * briefen, kan ikke gøres længere uden at finde på noget.
 *
 * Editoren får målene med herfra, så den kan vise ordantallet og selv se, om
 * teksten skal udvides, uden et ekstra kald. Serveren regner dem ud igen i
 * /api/udvid og stoler ikke på tallet fra browseren.
 */
export async function hentLaengdemaal(): Promise<
  Record<string, Record<string, number>>
> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("templates")
    .select("slug, input_fields")
    .eq("general_knowledge", true);

  const maal: Record<string, Record<string, number>> = {};

  for (const raekke of data ?? []) {
    const felter = z.array(inputFeltSkema).safeParse(raekke.input_fields);
    if (felter.success) maal[raekke.slug] = laengdemaal(felter.data);
  }

  return maal;
}

/**
 * Adresserne på de teksttyper, der må bruge almen viden. Migration 0029.
 *
 * Som listen ovenfor, og af samme grund: editoren kender kun adressen, og
 * den skal vide, hvilken ansvarslinje der passer til teksten.
 */
export async function hentSkabelonerMedAlmenViden(): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("templates")
    .select("slug")
    .eq("general_knowledge", true);

  return (data ?? []).map((raekke) => raekke.slug);
}
