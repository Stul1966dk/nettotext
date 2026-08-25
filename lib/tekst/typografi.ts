import "server-only";

/**
 * Typografisk oprydning i AI-genereret tekst.
 *
 * Systemprompten forbyder lange tankestreger, og det virker for det meste.
 * "For det meste" er ikke godt nok: den lange tankestreg er et af de
 * tydeligste tegn på maskinskrevet tekst, og en enkelt af dem i en ellers god
 * artikel er nok til at afsløre den.
 *
 * Derfor både en regel i prompten OG en mekanisk oprydning bagefter. Reglen
 * gør det sjældent; oprydningen gør det aldrig.
 *
 * Bemærk hvorfor det ikke er "at skrive sin egen sanering", som CLAUDE.md
 * regel 4 forbyder: dette handler om tegnsætning, ikke om sikkerhed. Selve
 * sikkerheden ligger stadig i sanitize-html, og den kører EFTER denne
 * funktion, så intet kan smutte ind bagefter.
 */

/** Lang tankestreg og vandret streg bliver til almindelig tankestreg. */
const ERSTATNINGER: ReadonlyArray<[RegExp, string]> = [
  [/—/g, "–"], // — bliver til –
  [/―/g, "–"], // ― bliver til –
];

export function normaliserTypografi(raa: string): string {
  return ERSTATNINGER.reduce(
    (tekst, [moenster, erstatning]) => tekst.replace(moenster, erstatning),
    raa,
  );
}
