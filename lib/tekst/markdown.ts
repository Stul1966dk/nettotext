import type { Blok } from "./blokke";

/**
 * HTML til Markdown.
 *
 * Mange danske CMS'er og skriveværktøjer tager imod Markdown, og for dem er
 * ren HTML besværligt at få ind. Derfor to slags kopiering.
 *
 * Bemærk hvorfor det er forsvarligt at skrive konverteringen selv, når
 * CLAUDE.md regel 4 forbyder at skrive sin egen sanering: det her handler
 * ikke om sikkerhed. Input er ALLEREDE saneret server-side af sanitize-html,
 * så tagsene er præcis dem fra hvidlisten og intet andet. Konverteringen
 * læser ni kendte tags og laver dem om til tegn — den beskytter ikke mod
 * noget, og den må derfor heller ikke få lov at være det eneste, der gør det.
 *
 * Kør den ALDRIG på HTML, der ikke har været gennem sanerHtml.
 */

/** De fem entiteter, sanitize-html selv laver. Skal med tilbage som tegn. */
function afkod(tekst: string): string {
  return tekst
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Indholdet af ét element: fed, kursiv og links. Resten bliver ren tekst. */
function indhold(html: string): string {
  return afkod(
    html
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "_$2_")
      .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/gi, "[$2]($1)")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Ét stykke saneret HTML som Markdown.
 *
 * Listepunkter skal findes FØR listen pilles fra hinanden, og nummererede
 * lister skal tælle. Derfor gennemløbes elementerne ét ad gangen frem for at
 * lave alle erstatninger på én gang.
 */
export function tilMarkdown(html: string): string {
  const dele: string[] = [];
  const elementer = html.matchAll(
    /<(h1|h2|h3|p|ul|ol)>([\s\S]*?)<\/\1>/gi,
  );

  for (const element of elementer) {
    const tag = element[1].toLowerCase();
    const krop = element[2];

    if (tag === "h1") dele.push(`# ${indhold(krop)}`);
    else if (tag === "h2") dele.push(`## ${indhold(krop)}`);
    else if (tag === "h3") dele.push(`### ${indhold(krop)}`);
    else if (tag === "p") dele.push(indhold(krop));
    else {
      const punkter = [...krop.matchAll(/<li>([\s\S]*?)<\/li>/gi)];

      dele.push(
        punkter
          .map((p, i) =>
            tag === "ol" ? `${i + 1}. ${indhold(p[1])}` : `- ${indhold(p[1])}`,
          )
          .join("\n"),
      );
    }
  }

  return dele.filter(Boolean).join("\n\n");
}

/** Blokkene samlet til ét stykke HTML. Rækkefølgen er den, brugeren ser. */
export function samlHtml(blokke: Blok[]): string {
  return blokke.map((blok) => blok.html).join("\n");
}

/** Alt undtagen titlen. Se noten om dobbelt H1 i docs/beslutninger.md. */
export function udenTitel(blokke: Blok[]): Blok[] {
  return blokke.filter((blok) => blok.slags !== "titel");
}
