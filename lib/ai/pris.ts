import { findModel } from "./modeller";

/**
 * Hvad kostede ét kald?
 *
 * Leverandørerne priser i dollars pr. million tokens. Budgetloftet er sat i
 * kroner. Omregningen sker her og kun her, så der aldrig ligger to enheder
 * i samme tabel.
 *
 * Det er et SKØN, ikke en faktura. Den rigtige regning kommer fra
 * leverandøren, og den kender rabatter, cache-priser og afrundinger, vi ikke
 * gør. Til det, tallet skal bruges til — at stoppe forbruget, før det løber
 * løbsk — er et skøn rigeligt, så længe det skønner for højt.
 */

/**
 * Kroner pr. dollar. Sat højt med vilje.
 *
 * Kursen svinger, og et loft skal hellere ramme lidt for tidligt end for
 * sent. Et rundt tal er samtidig nemmere at regne efter i hovedet, når man
 * sidder med loggen. Skal det være præcist en dag, hører det til et sted,
 * der kan hente en rigtig kurs — ikke i en konstant.
 */
const KRONER_PR_DOLLAR = 7;

const PR_MILLION = 1_000_000;

/**
 * Returnerer prisen i kroner, eller null hvis vi ikke kender modellens pris.
 *
 * null betyder "vi ved det ikke" og skal ikke forveksles med 0. Kalderen
 * afgør, hvad der så skal ske — men at lade som om et kald var gratis er
 * ikke svaret.
 */
export function beregnPrisDkk(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pris = findModel(modelId)?.pris;
  if (!pris) return null;

  const dollars =
    (inputTokens * pris.ind + outputTokens * pris.ud) / PR_MILLION;

  // Fire decimaler: samme præcision som kolonnen i usage_log. Et kort kald
  // koster omkring 15 øre, så øren skal med.
  return Math.round(dollars * KRONER_PR_DOLLAR * 10_000) / 10_000;
}
