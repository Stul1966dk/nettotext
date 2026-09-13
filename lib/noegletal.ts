import "server-only";

import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Nøgletallene til adminsiden — trin 6.
 *
 * Alt herfra er summer og optællinger, regnet i databasen. Der er ikke et
 * ord tekstindhold i nogen af dem, og det er ikke en forglemmelse:
 * CLAUDE.md regel 9 kender ingen undtagelse for ejeren, og `usage_log`
 * indeholder med vilje ingen tekst at vise. Skal en fejl undersøges, hører
 * det til i fejlloggen — ikke i en funktion, der kan læse brugernes tekster.
 *
 * SIKKERHEDSREGLERNES PUNKT 6 GÆLDER HER, som i lib/fejloversigt.ts:
 * funktionerne bruger `service_role` og læser hen over Row Level Security.
 * Adgangen skal være afgjort FØR de kaldes. Det sker i layoutet over siden
 * (app/app/admin/layout.tsx), som kalder `hentAdmin()` og viser notFound()
 * til alle andre. Kald dem aldrig et sted, hvor det tjek ikke er sket.
 *
 * Begge funktioner svarer null ved fejl. Siden skal kunne sige "det ved vi
 * ikke" i stedet for at vise nuller, der ligner en stille dag.
 */

export type Noegletal = {
  forbrugIDagPlatform: number;
  forbrugIDagBruger: number;
  forbrugMaanedPlatform: number;
  forbrugMaanedBruger: number;
  teksterIAlt: number;
  teksterKroner: number;
  tokensInd: number;
  tokensUd: number;
  proevetekstGivet: number;
  brugereIAlt: number;
  brugereNyUge: number;
  kladder: number;
  feedbackOp: number;
  feedbackNed: number;
};

export type Fordeling = {
  skabelon: string;
  model: string;
  antal: number;
  kroner: number;
};

/**
 * Postgres sender `numeric` og `bigint` hjem som STRENGE, når tallet kan
 * blive større, end et JavaScript-tal kan holde præcist. Number() klarer
 * begge former, og uden den ville "12" + "3" blive til "123" et sted i en
 * udregning.
 */
function tal(vaerdi: unknown): number {
  const n = Number(vaerdi ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function hentNoegletal(): Promise<Noegletal | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("admin_noegletal");

  // Funktionen returnerer en tabel med præcis én række.
  const r = Array.isArray(data) ? data[0] : data;
  if (error || !r) return null;

  return {
    forbrugIDagPlatform: tal(r.forbrug_i_dag_platform),
    forbrugIDagBruger: tal(r.forbrug_i_dag_bruger),
    forbrugMaanedPlatform: tal(r.forbrug_maaned_platform),
    forbrugMaanedBruger: tal(r.forbrug_maaned_bruger),
    teksterIAlt: tal(r.tekster_i_alt),
    teksterKroner: tal(r.tekster_kroner),
    tokensInd: tal(r.tokens_ind),
    tokensUd: tal(r.tokens_ud),
    proevetekstGivet: tal(r.proevetekster_givet),
    brugereIAlt: tal(r.brugere_i_alt),
    brugereNyUge: tal(r.brugere_ny_uge),
    kladder: tal(r.kladder),
    feedbackOp: tal(r.feedback_op),
    feedbackNed: tal(r.feedback_ned),
  };
}

export async function hentFordeling(): Promise<Fordeling[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("admin_tekster_fordelt");

  if (error || !Array.isArray(data)) return [];

  return data.map((r) => ({
    skabelon: String(r.template_slug ?? ""),
    model: String(r.model ?? ""),
    antal: tal(r.antal),
    kroner: tal(r.kroner),
  }));
}
