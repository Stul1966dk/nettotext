import type { Blok } from "@/lib/tekst/blokke";

/**
 * Sprogtjek — finder de sætninger, der ser ud til at bryde reglerne om
 * almindeligt dansk (SPROGREGLER i lib/ai/prompt.ts).
 *
 * Bygget 04.10.2026. Den første gennemskrivning lod modellen skrive hele
 * teksten om for at rette 11 sætninger. Her finder koden selv mønstrene, og
 * det bruges til tre ting i /api/gennemskriv:
 *   1. Er der ingen fund, bliver modellen slet ikke kaldt.
 *   2. Modellen får de konkrete sætninger peget ud og retter kun dem.
 *   3. Koden sætter rettelserne ind, så resten af teksten ikke kan ændre sig.
 *
 * TJEKKET ER GROFT, OG DET ER MED VILJE. Det kender ikke dansk grammatik; det
 * kender ordstillinger. Det peger derfor en gang imellem på en sætning, der
 * er i orden, og modellen har lov at svare, at den er det. Det overser også
 * noget: billedsprog og talemåder kan ikke genkendes på formen, og pynt
 * kun i de to former, der står ved PYNT_EFTER_TAL længere nede.
 *
 * En enhed med fed, kursiv eller et link i sig bliver sprunget over. Den kan
 * ikke skiftes ud med ren tekst, uden at formateringen forsvinder.
 */

export type Enhedsslags =
  | "meta-titel"
  | "meta-beskrivelse"
  | "overskrift"
  | "saetning";

export type Sprogfund = {
  slags: Enhedsslags;
  /** Hvilken blok enheden står i. Null for de to meta-felter. */
  blok: number | null;
  /** Som den står i HTML'en. Det er den streng, der skiftes ud. */
  raa: string;
  /** Som ren tekst. Det er den, modellen ser. */
  tekst: string;
  /** Hvad tjekket mener er galt, skrevet så modellen kan bruge det. */
  regler: string[];
};

/** Flere fund end det er ikke en rettelse, men en ny tekst. */
const LOFT = 40;

function tilTekst(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ren tekst gjort klar til at stå i HTML. Bruges, når en rettelse sættes ind. */
export function tilHtml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Ord, en sætning kan begynde med, uden at det er et udsagnsord. Efter dem
 * står grundleddet med det samme ("Hvis du ...", "Mens maskinen ..."), og det
 * er præcis den ordstilling, tjekket ellers ville tage for en betingelse.
 */
const IKKE_UDSAGNSORD = new Set([
  "Hvis", "Når", "Mens", "Fordi", "Selvom", "Skønt", "Medmindre", "Inden",
  "Indtil", "Siden", "Som", "Om", "Da", "At", "Hvor", "Hvad", "Hvordan",
  "Hvorfor", "Hvornår", "Hvem", "Hver", "Der", "Her", "For", "Før", "Under",
  "Over", "Efter", "Eller", "Ellers", "Flere", "Andre", "Større", "Mindre",
  "Uanset", "Hos", "Trods", "Langs", "Ifølge", "Dens", "Dets", "Deres",
  "Jeres", "Vores", "Hans", "Hendes", "Både", "Enten", "Hverken", "Alle",
  "Mange", "Nogle", "Selv",
]);

/** Bydeformer, der ender på r, og som derfor ligner nutid: "Tør dysen af". */
const BYDEFORM_PAA_R = new Set([
  "Kør", "Gør", "Rør", "Smør", "Hør", "Lær", "Bær", "Skær", "Tør", "Styr",
  "Fyr", "Spar",
]);

/**
 * "Brygger du på hele bønner, er malegraden ..." — regel 1.
 *
 * Dansk har udsagnsordet på andenpladsen. Står grundleddet som det andet ord,
 * og er det første ord ikke et bindeord, er det første ord et udsagnsord. Er
 * sætningen så ikke et spørgsmål, er den en betingelse.
 */
function erBetingelseMedUdsagnsordFoerst(saetning: string): boolean {
  if (/\?\s*$/.test(saetning) || !saetning.includes(", ")) return false;

  const ord = saetning.match(/^([A-ZÆØÅ][a-zæøå]+) ([A-Za-zÆØÅæøå'’-]+)/);
  if (!ord) return false;

  const [, foerste, andet] = ord;
  if (IKKE_UDSAGNSORD.has(foerste)) return false;

  // Et stedord som grundled er det sikre tilfælde: "Vil du", "Har man".
  if (/^(du|I|man|vi|han|hun)$/.test(andet)) return true;

  // Et navneord som grundled: "Løber kaffen", "Males kaffen". Her skal det
  // første ord ligne nutid eller passiv, og det må ikke være en bydeform.
  if (!/[rs]$/.test(foerste) || BYDEFORM_PAA_R.has(foerste)) return false;

  // Småord, der ender som et navneord i bestemt form: "Maskiner uden kværn".
  if (/^(uden|inden|igen|en|et|hen|ret)$/.test(andet)) return false;

  return /^(den|det|de)$/.test(andet) || /(en|et|ne)$/.test(andet);
}

/** "Det er filterholderen, der bærer resultatet" — regel 2. */
const UDPEGNING = [
  /\b[Dd]et er [^,.;:]{1,60}, (der|som)\b/,
  /\b(er|var) (det|dét) [^,.;:]{1,60}, (der|som|du|man|I|vi)\b/,
  /\b(er|var) (det|dét), (der|som|du|man)\b/,
  /\b(er|var) [^,.;:]{0,40}\b(den|det) [^,.;:]{1,40}, (du|man|I|vi)\b/,
];

/** "Det er værd at have med" — regel 5. */
const KOMMENTAR =
  /\bværd at (vide|have med|huske|bemærke|nævne|notere)\b|\bvigtigt at (huske|bemærke|nævne)\b|\b[Ss]om nævnt\b|\b[Ll]ad os\b|^(Herunder|Her|Nedenfor) (får|finder|kan) du\b/;

/**
 * "Du handler ikke med en nystartet producent, men med ..." Mønstret står
 * ikke blandt de seks regler, men er forbudt i hver teksttypes egen
 * skrivevejledning, og det er lige så let at genkende.
 */
const MODSAETNING =
  /\bikke\b[^.;:]{1,70}, men\b|, ikke (et|en|det|den|de|som|for)\b/;

/**
 * "Cirka 60 % af salget går til eksport, så maskinerne står i køkkener
 * langt uden for Italien" — regel 4.
 *
 * Pynt kan ikke genkendes i almindelighed, men to former kom igen og igen i
 * testene 04.10.2026: en oplysning med et tal efterfulgt af ", så ...", og
 * sætningen, der fortæller læseren, hvad en oplysning betyder for hende.
 * Den anden form var også dér, påstande uden belæg slap ind ("en stor
 * koncern bag sig, når det gælder reservedele og service").
 *
 * Begge former kan være i orden. "Tanken rummer 1,5 liter, så du skal fylde
 * den hver dag" er en oplysning. Modellen afgør det og må svare OK.
 */
const PYNT_EFTER_TAL = /(\d|\bprocent\b)[^.!?]*, så \S/;
const HVAD_DET_BETYDER =
  /\b[Ff]or dig (som \S+ )?betyder det\b|\b[Dd]et betyder( i praksis)?, at\b/;

/** Overskrift delt i emne og undertitel — regel 6. */
const DELT_OVERSKRIFT = /, (sådan|det|her|hvad|hvordan|derfor)\b| – | — /;

function reglerForSaetning(saetning: string): string[] {
  const regler: string[] = [];

  if (erBetingelseMedUdsagnsordFoerst(saetning)) {
    regler.push("regel 1, betingelse med udsagnsordet først");
  }
  if (UDPEGNING.some((moenster) => moenster.test(saetning))) {
    regler.push("regel 2, udpegning");
  }
  if (PYNT_EFTER_TAL.test(saetning)) {
    regler.push("regel 4, mulig pynt hængt på en oplysning efter \", så\"");
  }
  if (HVAD_DET_BETYDER.test(saetning)) {
    regler.push("regel 4, sætningen fortæller læseren, hvad en oplysning betyder");
  }
  if (KOMMENTAR.test(saetning)) {
    regler.push("regel 5, kommentar om teksten");
  }
  if (MODSAETNING.test(saetning)) {
    regler.push("forbudt sætningsmønster, modsætningen ikke X, men Y");
  }
  // Et kolon sidst i sætningen står foran en liste, og det er tilladt.
  if (/:(?!\s*$)/.test(saetning)) {
    regler.push("regel 6, kolon uden opremsning");
  }

  return regler;
}

function reglerForOverskrift(overskrift: string): string[] {
  const regler: string[] = [];

  if (overskrift.includes(":")) regler.push("regel 6, kolon i overskrift");
  if (DELT_OVERSKRIFT.test(overskrift)) {
    regler.push("regel 6, overskrift delt i emne og undertitel");
  }

  return regler;
}

/** Deler et stykke i sætninger. Skillet er punktum efterfulgt af stort bogstav. */
function delISaetninger(raa: string): string[] {
  return raa
    .split(/(?<=[.!?])\s+(?=[A-ZÆØÅ"„»])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ELEMENT = /<(h[1-3]|p|li)>([\s\S]*?)<\/\1>/g;

/**
 * Går teksten og de to meta-felter igennem og returnerer de enheder, der ser
 * ud til at bryde en regel.
 */
export function findSprogfund(
  blokke: Blok[],
  titel: string,
  beskrivelse: string,
): Sprogfund[] {
  const fund: Sprogfund[] = [];

  const metaTitel = reglerForOverskrift(titel);
  if (metaTitel.length > 0) {
    fund.push({
      slags: "meta-titel",
      blok: null,
      raa: titel,
      tekst: titel,
      regler: metaTitel,
    });
  }

  const metaBeskrivelse = [
    ...new Set(delISaetninger(beskrivelse).flatMap(reglerForSaetning)),
  ];
  if (metaBeskrivelse.length > 0) {
    fund.push({
      slags: "meta-beskrivelse",
      blok: null,
      raa: beskrivelse,
      tekst: beskrivelse,
      regler: metaBeskrivelse,
    });
  }

  blokke.forEach((blok, nr) => {
    for (const [, tag, indhold] of blok.html.matchAll(ELEMENT)) {
      const erOverskrift = tag.startsWith("h");
      const enheder = erOverskrift ? [indhold.trim()] : delISaetninger(indhold);

      for (const raa of enheder) {
        // Fed, kursiv og links kan ikke skiftes ud med ren tekst.
        if (!raa || raa.includes("<")) continue;

        const tekst = tilTekst(raa);
        const regler = erOverskrift
          ? reglerForOverskrift(tekst)
          : reglerForSaetning(tekst);

        if (regler.length > 0) {
          fund.push({
            slags: erOverskrift ? "overskrift" : "saetning",
            blok: nr,
            raa,
            tekst,
            regler,
          });
        }
      }
    }
  });

  return fund.slice(0, LOFT);
}
