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

/**
 * En feedback-kommentar, som adminsiden viser den.
 *
 * BEMÆRK HVAD DER IKKE ER MED: `user_id`. Det er ikke fordi det ville være
 * umuligt at hente — som admin med `service_role` kan alt hentes. Det er en
 * beslutning: kommentaren skal bruges til at gøre teksterne bedre, og til
 * dét er det ligegyldigt, hvem der skrev den. Hentes den ikke, kan den heller
 * ikke komme til at stå på skærmen ved en fejl.
 */
export type Kommentar = {
  id: string;
  dato: string;
  skabelon: string;
  /** 1 = tommel op, -1 = tommel ned. Samme værdier som i widgetten. */
  svar: number;
  tekst: string;
};

/**
 * Hvor mange kommentarer forsiden viser. Lavt med vilje: bliver det til en
 * lang liste, holder man op med at læse den, og så er vi tilbage ved at
 * samle noget ind, ingen kigger på.
 */
export const KOMMENTAR_GRAENSE = 10;

/**
 * De nyeste feedback-kommentarer.
 *
 * Det ENESTE sted i NettoText, hvor tekst skrevet af en bruger kan læses af
 * andre end hende selv. Det er en bevidst undtagelse fra CLAUDE.md regel 9,
 * truffet 13.09.2026, og den hviler på to ting: kommentaren er skrevet
 * FRIVILLIGT til os, og vi gemte den alligevel — at gemme noget, man aldrig
 * læser, er sværere at forsvare end at bruge det til dét, det blev givet til.
 *
 * Privatlivspolitikken skal sige, at kommentarer læses. Punktet står på
 * tjeklisten i docs/beslutninger.md.
 */
export async function hentKommentarer(): Promise<Kommentar[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("usage_log")
    .select("id, created_at, template_slug, feedback, feedback_comment")
    .not("feedback_comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(KOMMENTAR_GRAENSE);

  if (error || !data) return [];

  return data.map((r) => ({
    id: String(r.id),
    dato: String(r.created_at),
    skabelon: String(r.template_slug ?? ""),
    svar: tal(r.feedback),
    tekst: String(r.feedback_comment ?? ""),
  }));
}
