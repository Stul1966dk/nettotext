import "server-only";

import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Rate limit pr. bruger — CLAUDE.md regel 6, punkt (c).
 *
 * Grænsen gælder ALLE kald, der koster penge: både en hel tekst og ét afsnit.
 * Den beskytter to ting på én gang — dagens budget mod én bruger, der klikker
 * løs, og leverandøren mod at få tredive kald i sekundet fra os.
 *
 * Tællingen ligger i databasen og ikke i hukommelsen, fordi appen kører på
 * Vercel, hvor hvert kald kan ramme sin egen instans. Se migrationsfilen.
 *
 * Fejler LUKKET, som resten af regnskabet: kan vi ikke tælle, generer vi ikke.
 */

/** Maks. antal kald i vinduet. CLAUDE.md regel 6 siger 3 i minuttet. */
const LOFT = 3;
const VINDUE = "1 minute";

export async function tagPladsIKoeen(brugerId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("tag_plads_i_koeen", {
    bruger: brugerId,
    loft: LOFT,
    vindue: VINDUE,
  });

  if (error) {
    throw new Error(`Kunne ikke tjekke rate limit: ${error.message}`);
  }

  return data === true;
}
