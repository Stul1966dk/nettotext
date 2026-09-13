/**
 * Faktatjek — står tallene i den færdige tekst også i briefen?
 *
 * Sprogmodellen har fået besked på ikke at opfinde tal. Den gør det
 * alligevel en sjælden gang: afprøvningen af brandteksten 03.09.2026 gav
 * "når 500 stk. allerede ligger færdige", hvor briefen kun nævnte et
 * mindsteoplag på 50. Det er ikke en fejl i koden, og det kan ikke rettes
 * med en strammere prompt alene — derfor tæller vi efter bagefter.
 *
 * TJEKKET KIGGER INDAD, ALDRIG UDAD. Det slår ikke noget op og spørger ikke
 * nettet. Det siger kun én ting: "det her tal har du ikke selv skrevet."
 * Beslutningen er truffet bevidst (se docs/beslutninger.md): et tjek, der
 * påstod "det rigtige tal er 24 kg", ville fremsætte en påstand om varen i
 * NettoTexts navn og flytte ansvaret væk fra brugeren — stik imod det, hun
 * får at vide alle andre steder i appen. Her bevarer hun ansvaret, og vi
 * hjælper hende kun med at få øje på det, der er værd at se efter.
 *
 * Det kører i browseren. Der er intet at beskytte: alt hvad funktionen
 * sammenligner, står allerede på skærmen foran brugeren.
 */

export type Fund = {
  /** Tallet, som det står i teksten: "500", "1.299". */
  tal: string;
  /** Stykket omkring det, så brugeren kan se, hvad tallet handler om. */
  sammenhaeng: string;
};

/** Højst så mange fund. En liste, ingen orker at læse, bliver ikke læst. */
const LOFT = 8;

/** Tegn med på hver side af tallet i sammenhængen. */
const OMKRING = 50;

/** Tal med mere end så mange cifre er ikke et tal, nogen har skrevet. */
const CIFRE_MAX = 15;

/**
 * HTML bliver til ren tekst.
 *
 * Bevidst enkelt: der skal ikke saneres her. HTML'en ER allerede saneret på
 * serveren (CLAUDE.md regel 4), og resultatet herfra vises som tekst, aldrig
 * som HTML. Formålet er kun at få tags væk, så et tal inde i et attribut
 * ikke tælles med, og så sammenhængen er læselig.
 */
function tilTekst(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Alle tal i et stykke tekst. Tusindtalsseparator og decimalkomma er med,
 * så "1.299,50" er ét tal og ikke tre.
 */
const TAL = /\d+(?:[.,]\d+)*/g;

/**
 * Samme tal skrevet på to måder skal tælle som ét.
 *
 * "1.299" i briefen og "1299" i teksten er det samme beløb, og en advarsel om
 * det ville være støj. Dansk skriver tusinder med punktum og decimaler med
 * komma; begge dele bliver her til den samme nøgle.
 */
function normaliser(raa: string): string {
  const uden =
    /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raa) ? raa.replace(/\./g, "") : raa;

  // Decimalkomma til punktum, og efterfølgende nuller væk: 2,50 og 2,5 er
  // det samme tal, og 34,0 er 34.
  const punktum = uden.replace(",", ".");

  return punktum.includes(".")
    ? punktum.replace(/0+$/, "").replace(/\.$/, "")
    : punktum;
}

/**
 * Tal skrevet med bogstaver. Gælder KUN briefen, aldrig teksten.
 *
 * Grunden er en falsk alarm, der ellers ville komme hver gang: briefen siger
 * "To års garanti", teksten skriver "2 års garanti", og tjekket ville råbe op
 * om et tal, brugeren selv har oplyst. Listen oversætter kun den ene vej —
 * briefens ord bliver også til cifre, så begge skrivemåder er kendte.
 *
 * Den modsatte vej er der ingen grund til: skriver teksten "to", hvor briefen
 * skriver "2", er der intet ciffer at få øje på, og så er der intet at
 * advare om.
 */
const TAL_I_BOGSTAVER: Record<string, string> = {
  en: "1",
  én: "1",
  et: "1",
  ét: "1",
  to: "2",
  tre: "3",
  fire: "4",
  fem: "5",
  seks: "6",
  syv: "7",
  otte: "8",
  ni: "9",
  ti: "10",
  elleve: "11",
  tolv: "12",
  tretten: "13",
  fjorten: "14",
  femten: "15",
  seksten: "16",
  sytten: "17",
  atten: "18",
  nitten: "19",
  tyve: "20",
  tredive: "30",
  fyrre: "40",
  halvtreds: "50",
  tres: "60",
  halvfjerds: "70",
  firs: "80",
  halvfems: "90",
  hundrede: "100",
  tusind: "1000",
};

/** Tallene i briefen, som nøgler der kan slås op. */
function grundlagsTal(grundlag: string): Set<string> {
  const fundne = new Set<string>();

  for (const traef of grundlag.matchAll(TAL)) {
    fundne.add(normaliser(traef[0]));
  }

  for (const ord of grundlag.toLowerCase().split(/[^a-zæøå]+/)) {
    const ciffer = TAL_I_BOGSTAVER[ord];
    if (ciffer) fundne.add(ciffer);
  }

  return fundne;
}

/**
 * Et læseligt stykke omkring tallet, klippet ved nærmeste mellemrum.
 *
 * Der blev prøvet at klippe ved sætninger i stedet. Det virkede ikke: dansk
 * er fuld af forkortelser, der ender på punktum — "Str. 36", "1.299 kr.",
 * "50 stk." — og hver eneste af dem så ud som en sætning, der sluttede.
 * Stykket blev klippet midt i det, brugeren skulle bruge. Mellemrum er
 * dummere og rammer rigtigt hver gang.
 */
function sammenhaeng(tekst: string, start: number, laengde: number): string {
  const vindueFra = Math.max(0, start - OMKRING);
  const vindueTil = Math.min(tekst.length, start + laengde + OMKRING);

  const mellemrumFoer = tekst.indexOf(" ", vindueFra);
  const fra =
    vindueFra === 0 || mellemrumFoer === -1 || mellemrumFoer >= start
      ? vindueFra
      : mellemrumFoer + 1;

  const mellemrumEfter = tekst.lastIndexOf(" ", vindueTil);
  const til =
    vindueTil === tekst.length || mellemrumEfter <= start + laengde
      ? vindueTil
      : mellemrumEfter;

  return [
    fra > 0 ? "… " : "",
    tekst.slice(fra, til).trim(),
    til < tekst.length ? " …" : "",
  ].join("");
}

/**
 * Tal i teksten, der ikke findes i briefen.
 *
 * @param html  Den færdige, sanerede tekst. Meta-felterne må gerne hænges på.
 * @param grundlag Alt brugeren selv har skrevet: briefens felter og det frie
 *                 ønske. Rækkefølge og formatering er ligegyldig — der
 *                 kigges kun efter tal.
 *
 * Bemærk hvad der IKKE giver et fund: et tal, modellen skriver med bogstaver
 * ("to års garanti"), når briefen skriver det med cifre. Det er en fejl til
 * den rigtige side — vi råber ikke op om noget, der er i orden. Den anden vej
 * fanges: står der "500 stk." i teksten og ingenting i briefen, kommer det
 * med, også selvom det er et eksempel og ikke en påstand. Brugeren skal se
 * det og selv afgøre, om det kan stå.
 */
export function tjekTal(html: string, grundlag: string): Fund[] {
  const tekst = tilTekst(html);
  const kendte = grundlagsTal(grundlag);

  const fund: Fund[] = [];
  const set = new Set<string>();

  for (const traef of tekst.matchAll(TAL)) {
    const raa = traef[0];
    const noegle = normaliser(raa);

    if (raa.replace(/\D/g, "").length > CIFRE_MAX) continue;
    if (kendte.has(noegle) || set.has(noegle)) continue;

    set.add(noegle);
    fund.push({
      tal: raa,
      sammenhaeng: sammenhaeng(tekst, traef.index, raa.length),
    });

    if (fund.length === LOFT) break;
  }

  return fund;
}
