import "server-only";

import sanitizeHtml from "sanitize-html";

import { normaliserTypografi } from "./typografi";

/**
 * Sanering af AI-genereret HTML. CLAUDE.md regel 4.
 *
 * Alt hvad en sprogmodel skriver, behandles som utroværdigt. Modellen har
 * læst brugerens brief, og briefen kan indeholde hvad som helst — også et
 * forsøg på at få et <script>-tag med ud i den færdige tekst.
 *
 * Hvidlisten er den fra CLAUDE.md og ikke en tøddel mere. Alt andet
 * fjernes: tags, attributter, style, klasser, billeder, iframes.
 *
 * Bemærk hvornår det sker: IKKE mens teksten streames — man kan ikke sanere
 * et halvt HTML-tag. Serveren samler hele teksten, sanerer den, og sender
 * først derefter den færdige HTML til browseren. Det er kun DEN version, der
 * bliver vist som HTML.
 */

const HVIDLISTE = {
  // h1 er artiklens titel. Var oprindeligt forbudt ud fra den antagelse, at
  // et CMS selv sætter sidens overskrift, men det efterlod brugeren med en
  // tekst uden titel. Se noten om dobbelt H1 i docs/beslutninger.md.
  allowedTags: ["h1", "h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a"],
  allowedAttributes: { a: ["href"] },
  // Ingen relative links, ingen javascript:, ingen data:.
  allowedSchemes: ["http", "https"],
  allowProtocolRelative: false,
  // Indholdet i et ulovligt tag beholdes som tekst; selve tagget ryger.
  disallowedTagsMode: "discard" as const,
};

/**
 * Modellen får besked på ikke at bruge kodeblokke, men gør det alligevel en
 * sjælden gang. Står hele teksten i en ```html-blok, ville saneringen ellers
 * returnere HTML'en som synlig tekst.
 */
function fjernKodeblokke(raa: string): string {
  return raa
    .replace(/^\s*```(?:html)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();
}

/**
 * Rækkefølgen er med vilje: typografien ryddes op FØRST, saneringen kører
 * SIDST. Så er sanitize-html det sidste, der rører teksten, og ingen
 * efterbehandling kan nå at putte noget ind igen bagefter.
 */
export function sanerHtml(raa: string): string {
  const ryddet = normaliserTypografi(fjernKodeblokke(raa));
  return sanitizeHtml(ryddet, HVIDLISTE).trim();
}
