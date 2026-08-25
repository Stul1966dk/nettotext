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

export async function frigivProeveTekst(brugerId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.rpc("frigiv_proeve_tekst", { bruger: brugerId });
}
