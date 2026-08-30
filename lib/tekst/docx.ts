import "server-only";

import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { Blok } from "./blokke";
import { samlHtml } from "./markdown";

/**
 * Den færdige tekst som Word-fil.
 *
 * Samme forbehold som ved Markdown-konverteringen: det her er IKKE sanering.
 * Input er allerede saneret server-side af sanitize-html, så tagsene er præcis
 * dem fra hvidlisten i CLAUDE.md regel 4. Konverteringen læser ni kendte tags
 * og laver dem om til Word-afsnit. Kør den aldrig på HTML, der ikke har været
 * gennem sanerHtml.
 *
 * Ingen skrifttype sættes med vilje. Word bruger så modtagerens egen standard,
 * og filen ser ud som alt andet, brugeren skriver. En skrifttype, hun ikke har
 * installeret, ville alligevel blive skiftet ud — bare uden at hun ved af det.
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

/** Fjerner resterende tags. Bruges på indhold, der allerede er delt op. */
function renTekst(html: string): string {
  return afkod(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ");
}

const INLINE = /<(strong|em)>([\s\S]*?)<\/\1>|<a href="([^"]*)">([\s\S]*?)<\/a>/gi;

/**
 * Ét afsnits indhold delt op i stykker: almindelig tekst, fed, kursiv, link.
 *
 * Ét niveau ad gangen. Står der fed inde i et link, bliver linket et link, og
 * det fede bliver almindelig tekst. Det er en bevidst forenkling — modellen
 * skriver sjældent indlejret formatering, og et Word-dokument med et link,
 * der ikke er fedt, er ikke noget problem.
 */
function tilStykker(html: string): (TextRun | ExternalHyperlink)[] {
  const stykker: (TextRun | ExternalHyperlink)[] = [];
  let sidst = 0;

  for (const traef of html.matchAll(INLINE)) {
    const foer = renTekst(html.slice(sidst, traef.index));
    if (foer) stykker.push(new TextRun(foer));

    if (traef[1]) {
      // Kun den egenskab, der faktisk gælder. Sættes den anden til false,
      // skriver docx det ud som en udtrykkelig "ikke kursiv" i filen — støj,
      // der gør dokumentet sværere at læse for den næste, der åbner det.
      const fed = traef[1].toLowerCase() === "strong";
      stykker.push(
        new TextRun({
          text: renTekst(traef[2]),
          ...(fed ? { bold: true } : { italics: true }),
        }),
      );
    } else {
      stykker.push(
        new ExternalHyperlink({
          link: traef[3],
          children: [
            new TextRun({
              text: renTekst(traef[4]),
              style: "Hyperlink",
            }),
          ],
        }),
      );
    }

    sidst = (traef.index ?? 0) + traef[0].length;
  }

  const rest = renTekst(html.slice(sidst));
  if (rest) stykker.push(new TextRun(rest));

  return stykker;
}

const NUMMERERET = "nummereret-liste";

/** Blokkenes HTML som en række Word-afsnit. */
function tilAfsnit(html: string): Paragraph[] {
  const afsnit: Paragraph[] = [];

  for (const element of html.matchAll(
    /<(h1|h2|h3|p|ul|ol)>([\s\S]*?)<\/\1>/gi,
  )) {
    const tag = element[1].toLowerCase();
    const krop = element[2];

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      afsnit.push(
        new Paragraph({
          children: tilStykker(krop),
          heading:
            tag === "h1"
              ? HeadingLevel.HEADING_1
              : tag === "h2"
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        }),
      );
      continue;
    }

    if (tag === "p") {
      afsnit.push(
        new Paragraph({
          children: tilStykker(krop),
          spacing: { after: 160 },
        }),
      );
      continue;
    }

    for (const punkt of krop.matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
      afsnit.push(
        new Paragraph({
          children: tilStykker(punkt[1]),
          spacing: { after: 60 },
          ...(tag === "ol"
            ? { numbering: { reference: NUMMERERET, level: 0 } }
            : { bullet: { level: 0 } }),
        }),
      );
    }
  }

  return afsnit;
}

/**
 * Meta-felterne til sidst, tydeligt adskilt fra artiklen.
 *
 * De hører ikke til i teksten — de skal i to felter i brugerens CMS. Men de
 * er en del af det, hun har fået lavet, og en Word-fil uden dem ville betyde,
 * at hun skulle have appen åben ved siden af for at samle det hele.
 */
function metaAfsnit(titel: string, beskrivelse: string): Paragraph[] {
  if (!titel && !beskrivelse) return [];

  const afsnit: Paragraph[] = [
    new Paragraph({
      text: "Til Googles søgeresultat",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 480, after: 120 },
      border: { top: { style: "single", size: 6, color: "DDE0D8" } },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Disse to linjer er ikke en del af teksten. " }),
        new TextRun({
          text: "De skal i felterne til sidetitel og metabeskrivelse.",
        }),
      ],
      spacing: { after: 160 },
    }),
  ];

  if (titel) {
    afsnit.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Meta-titel: ", bold: true }),
          new TextRun(titel),
        ],
        spacing: { after: 80 },
      }),
    );
  }

  if (beskrivelse) {
    afsnit.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Meta-beskrivelse: ", bold: true }),
          new TextRun(beskrivelse),
        ],
      }),
    );
  }

  return afsnit;
}

export async function byggDocx(
  blokke: Blok[],
  titel: string,
  beskrivelse: string,
): Promise<Buffer> {
  const dokument = new Document({
    // Nummererede lister kræver en opskrift på, hvordan de tælles. Uden den
    // ville punkterne stå uden numre.
    numbering: {
      config: [
        {
          reference: NUMMERERET,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: [
          ...tilAfsnit(samlHtml(blokke)),
          ...metaAfsnit(titel, beskrivelse),
        ],
      },
    ],
  });

  return Packer.toBuffer(dokument);
}

/**
 * Filnavnet, brugeren får foræret.
 *
 * Danske bogstaver og mellemrum skaber besvær på tværs af styresystemer og i
 * mailprogrammer, så navnet skrives om til noget, alt kan finde ud af.
 */
const NAVN_LOFT = 60;

/**
 * Afkorter ved sidste hele ord.
 *
 * Et filnavn, der slutter midt i et ord, ser ud som om noget er gået galt —
 * og filen ligger i brugerens mappe længe efter, hun har glemt hvorfor.
 * Er der ingen bindestreg at klippe ved, er hele navnet ét langt ord, og så
 * er en hård afkortning bedre end ingenting.
 */
function afkortVedOrd(navn: string): string {
  if (navn.length <= NAVN_LOFT) return navn;

  const klippet = navn.slice(0, NAVN_LOFT);
  const sidsteSkille = klippet.lastIndexOf("-");

  return sidsteSkille > 0 ? klippet.slice(0, sidsteSkille) : klippet;
}

export function filnavn(titel: string): string {
  const rent = afkortVedOrd(
    titel
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );

  return `${rent || "tekst"}.docx`;
}
