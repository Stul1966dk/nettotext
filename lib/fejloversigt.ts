import "server-only";

import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Læsesiden af fejlloggen — kun til adminsiden.
 *
 * Skrivningen ligger i lib/fejl.ts og kaldes alle vegne fra. Den her fil
 * kaldes ét sted, og den bruger `service_role`, fordi `error_log` med vilje
 * ikke har en eneste policy: ingen almindelig bruger må røre den.
 *
 * DERFOR GÆLDER SIKKERHEDSREGLERNES PUNKT 6 HER: adgangen skal være afgjort,
 * FØR disse funktioner kaldes. Det sker i layoutet over siden
 * (app/app/admin/layout.tsx), som kalder `hentAdmin()` og viser notFound()
 * til alle andre. Kald aldrig herfra et sted, hvor det tjek ikke er sket.
 */

export type Fejlraekke = {
  id: string;
  created_at: string;
  sted: string;
  besked: string;
  spor: string | null;
  user_id: string | null;
  ekstra: Record<string, string | number | boolean | null>;
};

/** Hvor mange rækker siden viser. Resten ligger i tabellen indtil oprydningen. */
export const VIST_GRAENSE = 100;

export async function hentSenesteFejl(): Promise<Fejlraekke[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("error_log")
    .select("id, created_at, sted, besked, spor, user_id, ekstra")
    .order("created_at", { ascending: false })
    .limit(VIST_GRAENSE);

  // Kan fejlloggen ikke læses, er en tom liste det ærligste svar: siden
  // skal ikke selv vælte, og den skal ikke lade som om, der ingen fejl er.
  // Derfor svarer `hentFejltal` med null i samme situation, og siden siger
  // det højt.
  if (error || !data) return [];

  return data as Fejlraekke[];
}

export type Fejltal = {
  /** Fejl i det seneste døgn. */
  doegn: number;
  /** Alt, der ligger i tabellen lige nu — højst 30 dage gammelt. */
  ialt: number;
};

/**
 * Tallene til adminforsiden.
 *
 * "Det seneste døgn" og ikke "i dag": et døgn er det samme hele året og
 * kræver ingen stillingtagen til tidszoner og sommertid. Det er også det,
 * man i praksis vil vide — er der noget galt NU.
 *
 * Svarer null, hvis tabellen ikke kunne læses. Siden skal kunne sige
 * "det ved vi ikke" i stedet for at vise et nul, der ligner fred og ro.
 */
export async function hentFejltal(): Promise<Fejltal | null> {
  const supabase = createServiceClient();
  const etDoegnSiden = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [doegn, ialt] = await Promise.all([
    supabase
      .from("error_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", etDoegnSiden),
    supabase.from("error_log").select("id", { count: "exact", head: true }),
  ]);

  if (doegn.error || ialt.error) return null;

  return { doegn: doegn.count ?? 0, ialt: ialt.count ?? 0 };
}
