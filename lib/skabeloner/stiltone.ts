import { z } from "zod";

/**
 * Stiltonen: hvordan teksten skal lyde.
 *
 * Tre faste valg, som gælder ALLE teksttyper — også dem, der ikke er skrevet
 * endnu. Derfor står de her og ikke i den enkelte skabelons `input_fields`:
 * en teksttype er data, men stiltonen er den samme beslutning hver gang, og
 * skulle hver ny migrationsfil gentage den, ville en rettelse skulle laves
 * lige så mange steder, som der er teksttyper.
 *
 * Selve reglerne, modellen får at vide, ligger i `lib/ai/prompt.ts`. Her står
 * kun værdierne, som både formularen og API-ruterne skal kende.
 *
 * Filen indeholder med vilje INTET server-kode, så både formularen (klient)
 * og ruterne (server) kan bruge den.
 */

export const STILTONER = ["noegtern", "imoedekommende", "saelgende"] as const;

export type Stiltone = (typeof STILTONER)[number];

/**
 * Den, brugeren får, hvis hun ikke vælger. Den midterste: en tekst, der taler
 * til læseren uden at sælge, passer til flest af de tekster, folk skriver.
 */
export const STANDARD_STILTONE: Stiltone = "imoedekommende";

/**
 * Bruges både på klienten og i API-ruterne. `catch` frem for en fejl: en
 * kladde fra før stiltonen fandtes, eller en værdi vi ikke kender, skal give
 * standarden og ikke afvise en tekst, brugeren har betalt for.
 */
export const stiltoneSkema = z
  .enum(STILTONER)
  .catch(STANDARD_STILTONE)
  .default(STANDARD_STILTONE);
