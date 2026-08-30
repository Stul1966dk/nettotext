import "server-only";

import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Prøvekvoten — de 5 tekster, platformen betaler.
 *
 * Reservationen sker FØR kaldet til AI-leverandøren, ikke efter. Ellers
 * kunne den samme bruger sætte ti genereringer i gang på én gang og få dem
 * alle sammen gratis, fordi ingen af dem var nået at tælle op endnu.
 */

export async function reserverProeveTekst(brugerId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("reserver_proeve_tekst", {
    bruger: brugerId,
  });

  if (error) {
    // Kan vi ikke føre regnskab, genererer vi ikke. Alternativet er at
    // give teksten væk uden at vide hvor mange gange.
    throw new Error(`Kunne ikke reservere prøvetekst: ${error.message}`);
  }

  return data === true;
}

/**
 * Er der prøvekvote tilbage? Uden at bruge af den.
 *
 * Bruges der, hvor vi kun skal VIDE, hvem der betaler — ikke trække fra.
 * At skrive ét afsnit om koster ikke en prøvetekst (beslutningen fra
 * 30.08.2026), men det skal stadig afgøres, om regningen går til platformen
 * eller til brugerens egen nøgle.
 */
export async function harProeveKvote(brugerId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("trial_used, trial_quota")
    .eq("id", brugerId)
    .single();

  if (error) {
    throw new Error(`Kunne ikke læse prøvekvoten: ${error.message}`);
  }

  return data.trial_used < data.trial_quota;
}

export async function frigivProeveTekst(brugerId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.rpc("frigiv_proeve_tekst", { bruger: brugerId });
}
