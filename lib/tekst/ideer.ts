/**
 * Modellens fem linjer bliver til fem forslag.
 *
 * Formatet er "emne | vinkel", én idé pr. linje. Modellen har fået det som et
 * ufravigeligt krav, men en sprogmodel er ikke en formular: den kan finde på
 * at nummerere linjerne, sætte punkttegn foran eller skrive en indledning
 * ovenover. Derfor renser vi frem for at afvise. Et forslag, brugeren kan
 * læse, er bedre end en fejlbesked, fordi der stod "1." forrest.
 *
 * Filen indeholder ingen HTML og ingen sanering, og det er med vilje: et
 * forslag er ren tekst, som React viser som tekst. Skulle det nogensinde
 * blive vist som HTML, er det HER, saneringen skal ind — ikke i visningen.
 */

export type Ide = {
  /** Kort overskrift. Det, der ryger op i briefens felt. */
  emne: string;
  /** Én sætning om vinklen. Tom, hvis modellen ikke skrev nogen. */
  vinkel: string;
};

/** Højst så mange forslag. Modellen bliver bedt om fem. */
const LOFT = 5;

/** Længdegrænser, så en model, der løber løbsk, ikke fylder skærmen. */
const EMNE_MAX = 120;
const VINKEL_MAX = 300;

/** Fjerner nummerering, punkttegn og anførselstegn i begyndelsen af en linje. */
function afpil(linje: string): string {
  return linje
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .trim();
}

function klip(vaerdi: string, loft: number): string {
  return vaerdi.length > loft ? `${vaerdi.slice(0, loft).trimEnd()} …` : vaerdi;
}

export function udtraekIdeer(svar: string): Ide[] {
  const ideer: Ide[] = [];

  for (const raa of svar.split("\n")) {
    const linje = afpil(raa);

    // Linjer uden lodret streg er ikke forslag. Det er typisk modellens
    // indledning ("Her er fem forslag:") eller en tom linje mellem to idéer.
    if (!linje.includes("|")) continue;

    // Første streg deler. Skriver modellen flere, hører resten til vinklen.
    const skille = linje.indexOf("|");
    const emne = afpil(linje.slice(0, skille));
    const vinkel = afpil(linje.slice(skille + 1));

    if (!emne) continue;

    ideer.push({
      emne: klip(emne, EMNE_MAX),
      vinkel: klip(vinkel, VINKEL_MAX),
    });

    if (ideer.length === LOFT) break;
  }

  return ideer;
}
