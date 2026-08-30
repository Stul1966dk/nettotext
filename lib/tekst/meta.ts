import "server-only";

import { normaliserTypografi } from "./typografi";

/**
 * Meta-titel og meta-beskrivelse ud af modellens svar.
 *
 * Det er dem, Google viser i søgeresultatet. De hører ikke til inde i
 * artiklen, og derfor beder systemprompten modellen om at skrive dem som to
 * almindelige tekstlinjer FØR HTML-fragmentet:
 *
 *     META-TITEL: Sådan maler du trævinduer inden vinteren
 *     META-BESKRIVELSE: Vinduesmaling kræver over 10 grader ...
 *     <h1>...
 *
 * Grænsen mellem de to dele er det første `<`. Alt før er meta, alt efter er
 * artiklen. Det er bevidst en dum regel: den kan ikke gå i stykker af, at
 * modellen sætter et ekstra linjeskift eller glemmer et kolon.
 *
 * Bemærk at `krop` altid er en nøjagtig slutning af det, der blev sendt ind.
 * Det udnytter /api/generate til at regne ud, hvor meget af strømmen klienten
 * allerede har fået. Trim derfor ikke i `krop`.
 */

export type Meta = {
  titel: string;
  beskrivelse: string;
};

export type Udtraek = {
  meta: Meta;
  /** Artiklen. Tom, indtil HTML'en er begyndt. */
  krop: string;
  /** Er grænsen mellem meta og artikel fundet? */
  komplet: boolean;
};

/**
 * Er der skrevet mere end så mange tegn, uden at HTML'en er begyndt, har
 * modellen ikke fulgt formatet. Så holder vi ikke teksten tilbage længere.
 */
export const META_LOFT = 600;

/** Højst så mange tegn gemmes. Et absurd langt felt er en fejl, ikke en titel. */
const FELT_LOFT = 300;

/**
 * Meta-felterne vises som tekst, aldrig som HTML — React escaper dem. Her
 * fjernes tags alligevel, så et `<strong>` fra modellen ikke ender som synlige
 * vinkelparenteser i Googles søgeresultat. Det er kosmetik, ikke sikkerhed;
 * sikkerheden ligger i sanitize-html på artiklen (CLAUDE.md regel 4).
 *
 * Typografien ryddes op her og ikke i sanerHtml, som kun ser artiklen. Ellers
 * ville en lang tankestreg i meta-titlen slippe udenom oprydningen — og en
 * meta-titel er netop dét, en fremmed læser først får øje på.
 */
function renTekst(raa: string): string {
  return normaliserTypografi(raa)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, FELT_LOFT);
}

function findLinje(hoved: string, navn: string): string {
  const traeffer = new RegExp(`${navn}\s*:\s*(.*)`, "i").exec(hoved);
  return traeffer ? renTekst(traeffer[1]) : "";
}

export function udtraekMeta(raa: string): Udtraek {
  const start = raa.indexOf("<");

  const hoved = start === -1 ? raa : raa.slice(0, start);

  return {
    meta: {
      titel: findLinje(hoved, "META-TITEL"),
      beskrivelse: findLinje(hoved, "META-BESKRIVELSE"),
    },
    krop: start === -1 ? "" : raa.slice(start),
    komplet: start !== -1,
  };
}
