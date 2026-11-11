import { findModel, MODELLER } from "./modeller";

/** Står modellen i pristabellen med en pris? Ellers er prisen et skøn. */
export function kenderPris(modelId: string): boolean {
  return findModel(modelId)?.pris !== undefined;
}

/** Den højeste ind- og udpris i hele tabellen, hver for sig. */
function hoejestePris(): { ind: number; ud: number } | null {
  const priser = Object.values(MODELLER)
    .flat()
    .flatMap((m) => (m.pris ? [m.pris] : []));

  if (priser.length === 0) return null;

  return {
    ind: Math.max(...priser.map((p) => p.ind)),
    ud: Math.max(...priser.map((p) => p.ud)),
  };
}

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
/**
 * Prompt caching hos Anthropic: at skrive til cachen koster 1,25 gange
 * normal inputpris, at læse fra den 0,1 gange. Se systemBlokke() i
 * anthropic.ts.
 */
const CACHE_SKRIV = 1.25;
const CACHE_LAES = 0.1;

export function beregnPrisDkk(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cache: { skrevet?: number; laest?: number } = {},
): number | null {
  const model = findModel(modelId);

  // Ny model, vi ikke har prisen på endnu: regn med den dyreste, vi kender.
  // Så tæller budgetloftet hellere for meget end for lidt.
  const kendtPris = model?.pris ?? hoejestePris();
  if (!kendtPris) return null;

  // Hele promptens længde tæller med, cachen inklusive. Er den over
  // grænsen, betaler HELE kaldet den høje pris — ikke kun det overskydende.
  const promptLaengde =
    inputTokens + (cache.skrevet ?? 0) + (cache.laest ?? 0);
  const pris =
    model?.langPris && promptLaengde > model.langPris.overTokens
      ? model.langPris
      : kendtPris;

  const ind =
    inputTokens +
    (cache.skrevet ?? 0) * CACHE_SKRIV +
    (cache.laest ?? 0) * CACHE_LAES;

  const dollars = (ind * pris.ind + outputTokens * pris.ud) / PR_MILLION;

  // Fire decimaler: samme præcision som kolonnen i usage_log. Et kort kald
  // koster omkring 15 øre, så øren skal med.
  return Math.round(dollars * KRONER_PR_DOLLAR * 10_000) / 10_000;
}
