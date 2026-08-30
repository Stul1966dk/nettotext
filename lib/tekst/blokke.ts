/**
 * Teksten delt i blokke.
 *
 * Indtil nu var en færdig tekst ét stykke HTML: enten godkendte man det hele,
 * eller også skrev man det hele om. Blokkene gør teksten til en række dele,
 * man kan forholde sig til hver for sig — og de er fundamentet for at kunne
 * regenerere én sektion uden at betale for resten.
 *
 * Delingen sker ved overskrifterne. En h1 starter titelblokken, en h2 starter
 * en sektion, og alt hvad der står før den første overskrift, er indledningen.
 * En h3 hører til den sektion, den står i.
 *
 * Bemærk hvad der IKKE er her: `import "server-only"`. Filen indeholder ingen
 * hemmeligheder og bruges begge steder — serveren deler teksten op, browseren
 * viser blokkene frem.
 *
 * Vigtigt om rækkefølgen: del ALTID op EFTER saneringen. Blokkenes HTML sendes
 * videre til `dangerouslySetInnerHTML`, og en opdeling af usaneret HTML ville
 * være en bagvej udenom CLAUDE.md regel 4.
 */

export type BlokSlags = "titel" | "indledning" | "sektion";

export type Blok = {
  /** Fast inden for én tekst. Bliver senere adressen på "skriv den her om". */
  id: string;
  slags: BlokSlags;
  /** Overskriftens rene tekst. Null for indledningen, som ingen har. */
  overskrift: string | null;
  /** Sektionens nummer, som brugeren ser det. Null for titel og indledning. */
  nummer: number | null;
  /** Saneret HTML. Hele blokken, overskriften inklusive. */
  html: string;
};

/** Deler ved starten af hver h1 og h2, uden at spise selve overskriften. */
const VED_OVERSKRIFT = /(?=<h1>|<h2>)/;

const OVERSKRIFT_INDHOLD = /^<h([123])>([\s\S]*?)<\/h\1>/;

/**
 * Overskriftens tekst uden tags. Bruges som læsbart navn på blokken, aldrig
 * som HTML. De fem entiteter er dem, sanitize-html selv laver.
 */
function renOverskrift(html: string): string | null {
  const traeffer = OVERSKRIFT_INDHOLD.exec(html);
  if (!traeffer) return null;

  return traeffer[2]
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Titlen og alt hvad der måtte følge efter den, før den første h2. */
const H1_ELEMENT = /^<h1>[\s\S]*?<\/h1>/;

export function delIBlokke(html: string): Blok[] {
  const stykker = html
    .split(VED_OVERSKRIFT)
    .map((stykke) => stykke.trim())
    .filter(Boolean);

  // Titlen og indledningen står i samme stykke, fordi der ikke er nogen
  // overskrift imellem dem. De skilles ad her, så titlen kan behandles for
  // sig — det er den, der bliver til én h1 for meget, hvis brugerens CMS
  // selv sætter sidens overskrift.
  const dele: Array<{ slags: BlokSlags; html: string }> = [];

  for (const stykke of stykker) {
    if (stykke.startsWith("<h2>")) {
      dele.push({ slags: "sektion", html: stykke });
      continue;
    }

    if (stykke.startsWith("<h1>")) {
      const titel = H1_ELEMENT.exec(stykke)?.[0] ?? stykke;
      dele.push({ slags: "titel", html: titel });

      const resten = stykke.slice(titel.length).trim();
      if (resten) dele.push({ slags: "indledning", html: resten });
      continue;
    }

    dele.push({ slags: "indledning", html: stykke });
  }

  let nummer = 0;

  return dele.map((del, i) => {
    if (del.slags === "sektion") nummer += 1;

    return {
      id: `blok-${i + 1}`,
      slags: del.slags,
      overskrift: renOverskrift(del.html),
      nummer: del.slags === "sektion" ? nummer : null,
      html: del.html,
    };
  });
}
