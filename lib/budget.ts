import "server-only";

import { beregnPrisDkk } from "@/lib/ai/pris";
import type { Betaler, Leverandoer } from "@/lib/ai";
import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Det globale daglige budgetloft — CLAUDE.md regel 6, punkt (d).
 *
 * Loftet gælder ALLE kald på platformens nøgle, på tværs af alle brugere.
 * Prøvekvoten beskytter mod, at én bruger skriver for mange tekster; loftet
 * beskytter mod alt det andet: en fejl i koden, en konto med forhøjet kvote,
 * eller tyve brugere den samme eftermiddag.
 *
 * To ting, der er værd at vide om, hvordan det virker:
 *
 * 1. Loftet er BAGUDSKUENDE. Prisen på et kald kendes først, når kaldet er
 *    færdigt, så tjekket spørger til det, der allerede er brugt. Sættes ti
 *    genereringer i gang i samme sekund, kan de alle sammen nå at slippe
 *    forbi et loft, der er ved at være nået. Overskridelsen er højst nogle
 *    få tekster, og alternativet — at reservere et beløb på forhånd, man
 *    ikke kender — koster mere kompleksitet, end det er værd her.
 *
 * 2. Loftet fejler LUKKET. Kan vi ikke få fat i tallet, eller er
 *    DAILY_BUDGET_DKK ikke sat, genererer vi ikke. Det er den samme
 *    afvejning som i lib/kvote.ts: kan vi ikke føre regnskab, bruger vi
 *    ikke penge. Konsekvens værd at kende: glemmes variablen hos Vercel,
 *    virker genereringen ikke live. Det er med vilje — det modsatte ville
 *    være en åben pengekasse, ingen opdager.
 */

/** Hvad loftet er sat til. Kaster, hvis variablen mangler eller er vrøvl. */
function dagligtBudget(): number {
  const raa = process.env.DAILY_BUDGET_DKK;
  const tal = Number(raa);

  if (!raa || !Number.isFinite(tal) || tal <= 0) {
    throw new Error(
      "DAILY_BUDGET_DKK mangler eller er ikke et positivt tal. " +
        "Sæt den i .env.local og hos Vercel.",
    );
  }

  return tal;
}

export type Budgetstatus = {
  brugt: number;
  loft: number;
  tilbage: number;
};

/**
 * Hvor meget af dagens budget er brugt?
 *
 * Kaster ved fejl. Kalderen skal lade den fejl stoppe genereringen — ikke
 * fange den og fortsætte.
 */
export async function hentBudgetstatus(): Promise<Budgetstatus> {
  const loft = dagligtBudget();
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("platform_forbrug_i_dag");

  if (error) {
    throw new Error(`Kunne ikke læse dagens forbrug: ${error.message}`);
  }

  // Postgres' numeric kommer hjem som streng, når tallet kan blive større,
  // end et JavaScript-tal kan holde præcist. Number() klarer begge former.
  const brugt = Number(data ?? 0);

  return {
    brugt,
    loft,
    tilbage: Math.max(loft - brugt, 0),
  };
}

/**
 * Skriver ét kald i forbrugsloggen.
 *
 * Kun tal og metadata. Aldrig briefen, aldrig teksten (CLAUDE.md regel 9).
 *
 * Fejler den, skal genereringen IKKE fejle: brugeren har fået sin tekst, og
 * den er betalt. En manglende logpost betyder, at dagens forbrug tælles for
 * lavt, og det skal ses i serverloggen — ikke af brugeren.
 */
export async function skrivForbrug(post: {
  brugerId: string;
  skabelon: string;
  leverandoer: Leverandoer;
  model: string;
  betaler: Betaler;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const pris = beregnPrisDkk(post.model, post.inputTokens, post.outputTokens);

  if (pris === null) {
    // Modellen står uden pris i lib/ai/modeller.ts. Så tæller kaldet ikke med
    // i dagens forbrug, og loftet er tilsvarende for løst. Det skal larme.
    console.error(
      `[budget] Ingen pris kendt for modellen ${post.model}. ` +
        "Forbruget logges som 0 kr., og budgetloftet tæller for lavt. " +
        "Tilføj prisen i lib/ai/modeller.ts.",
    );
  }

  const supabase = createServiceClient();

  const { error } = await supabase.from("usage_log").insert({
    user_id: post.brugerId,
    template_slug: post.skabelon,
    provider: post.leverandoer,
    model: post.model,
    paid_by: post.betaler,
    input_tokens: post.inputTokens,
    output_tokens: post.outputTokens,
    estimated_cost: pris ?? 0,
  });

  if (error) {
    console.error("[budget] Kunne ikke skrive i usage_log:", error.message);
  }
}
