import type { InputFelt } from "@/lib/skabeloner/typer";

import type { Blok } from "./blokke";
import { erFaqBlok } from "./faq";

/**
 * Hvor lang teksten skal være, og hvor lang den blev.
 *
 * Bygget 03.10.2026, efter ti test af blogindlægget viste, at modellen ikke
 * følger et ordantal i en instruks: samme brief gav mellem 750 og 1.150 ord,
 * uanset hvad skrivevejledningen sagde. Længden styres derfor af et tal, koden
 * selv tæller efter — og mangler der noget, bestiller den et bestemt antal
 * afsnit mere. Se /api/udvid og docs/beslutninger.md.
 *
 * Ingen `server-only`: ruten tæller, før den bruger penge, og editoren tæller
 * for at vise brugeren tallet.
 */

/** Feltet, der vælger længden. Samme kobling som i fremskridt.ts. */
const LAENGDEFELT = "laengde";

/** Et afsnit, koden bestiller, er 150 til 200 ord. Midten bruges til at regne. */
const ORD_PR_AFSNIT = 170;

/** Flere end det i ét kald, og afsnittene begynder at gentage hinanden. */
const MAKS_AFSNIT_PR_KALD = 4;

/** Ord i et stykke saneret HTML. Tags tæller ikke. */
export function taelOrd(html: string): number {
  const tekst = html.replace(/<[^>]*>/g, " ").trim();
  return tekst ? tekst.split(/\s+/).length : 0;
}

/**
 * Brødtekstens længde: alt undtagen titlen og "Ofte stillede spørgsmål".
 *
 * Det er ejerens definition (03.10.2026): det ordantal, valgmuligheden lover,
 * er brødteksten. Spørgsmålene kommer oveni.
 */
export function broedtekstOrd(blokke: Blok[]): number {
  return blokke
    .filter((blok) => blok.slags !== "titel" && !erFaqBlok(blok))
    .reduce((sum, blok) => sum + taelOrd(blok.html), 0);
}

/**
 * Det mindste ordantal, en valgmulighed lover — læst ud af dens egen tekst.
 *
 *   "Langt (1.000-1.200 ord)"  → 1000   (et interval: den nedre grænse)
 *   "Mellem (ca. 800 ord)"     → 720    (et cirkatal: 10 % under)
 *   "Kort"                     → null   (intet tal: intet mål)
 *
 * Tallet læses fra teksten og står ikke som sit eget felt, fordi der så kun
 * er ÉT sted at rette. Det brugeren får lovet, er det, koden holder: ændres
 * valgmuligheden på adminsiden, følger målet med af sig selv.
 */
export function mindsteOrdFraLabel(label: string): number | null {
  const tal = [...label.matchAll(/\d{1,3}(?:\.\d{3})+|\d+/g)].map((m) =>
    Number(m[0].replace(/\./g, "")),
  );

  if (tal.length === 0) return null;
  if (tal.length >= 2) return Math.min(tal[0], tal[1]);

  return Math.round(tal[0] * 0.9);
}

/** Målene for én teksttype: valgmulighedens værdi → mindste ordantal. */
export function laengdemaal(felter: InputFelt[]): Record<string, number> {
  const felt = felter.find(
    (f) => f.navn === LAENGDEFELT && f.type === "valg",
  );

  const maal: Record<string, number> = {};

  for (const valg of felt?.valg ?? []) {
    const mindst = mindsteOrdFraLabel(valg.label);
    if (mindst !== null) maal[valg.vaerdi] = mindst;
  }

  return maal;
}

/**
 * Hvor mange afsnit skal der bestilles for at nå målet? 0, når teksten er
 * lang nok.
 *
 * Der rundes OP: et afsnit for meget giver en tekst lidt over målet, et for
 * lidt giver endnu et kald.
 */
export function manglendeAfsnit(ord: number, mindst: number): number {
  if (ord >= mindst) return 0;

  return Math.min(
    MAKS_AFSNIT_PR_KALD,
    Math.max(1, Math.ceil((mindst - ord) / ORD_PR_AFSNIT)),
  );
}
