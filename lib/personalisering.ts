import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Brand-profil og gemte instruktioner — trin 5.
 *
 * Alt går gennem brugerens egen forbindelse, så Row Level Security afgør
 * ejerskabet. Ingen `service_role` nogen steder i filen: der er ikke noget
 * ejer-tjek, der kan glemmes, fordi der ikke er noget tjek.
 *
 * Indholdet herfra ender i prompten. Det er derfor både validering OG en
 * omkostning: alt, der står her, sendes med i HVER generering og betales pr.
 * token. Længderne nedenfor er sat med begge dele i tankerne.
 */

/** Højst så mange gemte instruktioner. En regelsamling, ikke et arkiv. */
export const INSTRUKTION_LOFT = 20;

export const brandprofilSkema = z.object({
  beskrivelse: z.string().trim().max(2000),
  tone: z.string().trim().max(500),
  // Skrives som én linje adskilt af komma i UI'et; gemmes som liste.
  forbudteOrd: z.array(z.string().trim().min(1).max(60)).max(50),
  sprogproeve: z.string().trim().max(4000),
});

export type Brandprofil = z.infer<typeof brandprofilSkema>;

export const instruktionSkema = z.string().trim().min(1).max(500);

export type Instruktion = { id: string; indhold: string };

/** Alt, der personaliserer én generering. */
export type Tilpasning = {
  brand: Brandprofil | null;
  instruktioner: string[];
};

const TOM: Brandprofil = {
  beskrivelse: "",
  tone: "",
  forbudteOrd: [],
  sprogproeve: "",
};

/** Er der overhovedet noget i profilen? En tom profil skal ikke i prompten. */
export function profilErTom(profil: Brandprofil): boolean {
  return (
    !profil.beskrivelse &&
    !profil.tone &&
    !profil.sprogproeve &&
    profil.forbudteOrd.length === 0
  );
}

export async function hentBrandprofil(): Promise<Brandprofil> {
  const supabase = await createClient();

  // RLS giver kun brugerens egen række, så der er ingen betingelse at glemme.
  const { data, error } = await supabase
    .from("brand_profiles")
    .select("company_description, tone, banned_words, style_sample")
    .maybeSingle();

  if (error || !data) return TOM;

  return {
    beskrivelse: data.company_description ?? "",
    tone: data.tone ?? "",
    forbudteOrd: data.banned_words ?? [],
    sprogproeve: data.style_sample ?? "",
  };
}

export async function gemBrandprofil(
  brugerId: string,
  profil: Brandprofil,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("brand_profiles").upsert(
    {
      user_id: brugerId,
      company_description: profil.beskrivelse || null,
      tone: profil.tone || null,
      banned_words: profil.forbudteOrd,
      style_sample: profil.sprogproeve || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Kunne ikke gemme brand-profilen: ${error.message}`);
  }
}

/** Ældste først, så rækkefølgen i prompten er den, brugeren skrev dem i. */
export async function hentInstruktioner(): Promise<Instruktion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instructions")
    .select("id, content")
    .order("created_at", { ascending: true })
    .limit(INSTRUKTION_LOFT);

  if (error || !data) return [];

  return data.map((r) => ({ id: r.id, indhold: r.content }));
}

export async function tilfoejInstruktion(
  brugerId: string,
  indhold: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("instructions").insert({
    user_id: brugerId,
    scope: "global",
    content: indhold,
  });

  if (error) {
    throw new Error(`Kunne ikke gemme instruktionen: ${error.message}`);
  }
}

export async function sletInstruktion(id: string): Promise<void> {
  const supabase = await createClient();

  // Ingen ejer-betingelse: RLS' delete-policy slipper kun brugerens egne
  // rækker igennem. Et id, hun ikke ejer, rammer ingenting.
  const { error } = await supabase.from("instructions").delete().eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke slette instruktionen: ${error.message}`);
  }
}

/**
 * Alt personaliseringen skal bruge til én generering, hentet på én gang.
 *
 * Kaldes fra genererings-ruterne. Fejler et af opslagene, skrives teksten
 * UDEN personalisering frem for slet ikke: en tekst i husets standardtone er
 * bedre end en fejlbesked, og brugeren kan se på resultatet, at noget
 * manglede. Fejlen hører til i serverloggen.
 */
export async function hentTilpasning(): Promise<Tilpasning> {
  try {
    const [brand, instruktioner] = await Promise.all([
      hentBrandprofil(),
      hentInstruktioner(),
    ]);

    return {
      brand: profilErTom(brand) ? null : brand,
      instruktioner: instruktioner.map((i) => i.indhold),
    };
  } catch (fejl) {
    console.error("Kunne ikke hente personalisering:", fejl);
    return { brand: null, instruktioner: [] };
  }
}
