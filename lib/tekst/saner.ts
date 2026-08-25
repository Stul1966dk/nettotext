import "server-only";

import sanitizeHtml from "sanitize-html";

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
  allowedTags: ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a"],
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

export function sanerHtml(raa: string): string {
  return sanitizeHtml(fjernKodeblokke(raa), HVIDLISTE).trim();
}
