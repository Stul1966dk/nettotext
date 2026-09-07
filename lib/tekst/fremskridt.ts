/**
 * Hvor langt genereringen er nået.
 *
 * Vi kan ikke spørge modellen, hvor langt den er. Det eneste, vi ved, er hvor
 * mange tegn der er kommet hjem indtil nu, og hvor lang teksten skal være.
 * Bjælken er derfor et SKØN — og det siger UI'et også højt, frem for at lade
 * som om vi tæller noget, vi ikke tæller.
 *
 * To ting holder skønnet ærligt:
 *
 * 1. Det bygger på brugerens eget valg af længde, ikke på tid. En bjælke, der
 *    bare kryber fremad efter uret, ville vise det samme, uanset om modellen
 *    skrev eller stod stille.
 * 2. Den når aldrig 100 % af sig selv. Fuld bjælke sættes først, når teksten
 *    ER hel. Ellers ville den stå og love, at noget var færdigt, mens
 *    brugeren sad og ventede.
 */

/**
 * Tegn pr. længde. Tallene svarer til de tre valg i skabelonernes
 * `laengde`-felt: cirka 400, 800 og 1.400 ord.
 *
 * Tallene er MÅLT, ikke regnet ud. To blogindlæg på "mellem" landede på
 * 4.300 og 3.750 tegn inklusive HTML-tags (07.09.2026), altså omkring fem
 * tegn pr. ord, og de to andre længder er skaleret derfra. Målet er sat en
 * anelse UNDER gennemsnittet med vilje: rammer bjælken loftet på 95 og
 * venter et øjeblik, er det en bedre oplevelse end en bjælke, der står på 60
 * og pludselig er færdig. To måltal er ikke mange — retter teksterne sig
 * efter noget andet med tiden, er det HER, tallene skal justeres.
 *
 * Koblingen til værdierne "kort", "mellem" og "langt" er en kobling mellem
 * kode og data, og den er bevidst: en teksttype, der bruger andre værdier,
 * får ikke en forkert bjælke, den får slet ingen procent. Se `maalTegn`.
 */
const TEGN_PR_LAENGDE: Record<string, number> = {
  kort: 2000,
  mellem: 4000,
  langt: 7000,
};

/**
 * Hvor mange tegn venter vi? Null, når vi ikke ved det.
 *
 * Null er ikke en fejl. Det er svaret for enhver teksttype uden et
 * `laengde`-felt — og for dem viser UI'et en bjælke uden procent frem for et
 * tal, der er gættet.
 */
export function maalTegn(laengde: string | undefined): number | null {
  if (!laengde) return null;
  return TEGN_PR_LAENGDE[laengde] ?? null;
}

/** Loftet, mens der stadig skrives. Fuld bjælke hører til en hel tekst. */
const LOFT = 95;

/**
 * Procenten, bjælken skal vise. Null, når vi ikke kender målet.
 *
 * Skriver modellen længere end forventet, bliver bjælken stående på 95 og
 * venter. Det er den rigtige opførsel: teksten er ikke færdig, og en bjælke,
 * der løber over sin egen ende, siger ikke andet, end at skønnet var skævt.
 */
export function fremskridtProcent(
  modtagetTegn: number,
  maal: number | null,
): number | null {
  if (!maal) return null;
  return Math.min(LOFT, Math.round((modtagetTegn / maal) * 100));
}
