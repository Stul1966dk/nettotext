/**
 * Modellens linjer bliver til en liste med oplysninger.
 *
 * Samme holdning som ved idéforslagene i ideer.ts: vi renser frem for at
 * afvise. En sprogmodel er ikke en formular, og en liste, brugeren kan rette
 * i, er bedre end en fejlbesked, fordi der stod en bindestreg forrest.
 *
 * Filen indeholder ingen HTML og ingen sanering, og det er med vilje: en
 * oplysning er ren tekst, som React viser som tekst. Den ender i et
 * tekstfelt i briefen, aldrig i noget der bliver vist som HTML.
 */

/** Højst så mange linjer. Modellen er bedt om 25. */
const LOFT = 25;

/** En enkelt oplysning fylder ikke mere end det her. */
const LINJE_MAX = 200;

/** Modellens svar, når der ikke var noget at trække ud. */
const INTET = "INGEN";

/** Fjerner nummerering, punkttegn og anførselstegn i begyndelsen af en linje. */
function afpil(linje: string): string {
  return linje
    .replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, "")
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .trim();
}

/**
 * Linjerne fra modellen, rensede. Tom liste betyder "der var ingenting at
 * hente" — og det skal siges til brugeren, ikke skjules som en tom besked.
 */
export function udtraekFakta(svar: string): string[] {
  const linjer: string[] = [];

  for (const raa of svar.split("\n")) {
    const linje = afpil(raa);

    if (!linje) continue;

    // Modellen har fået besked på at svare INGEN, når teksten ikke indeholder
    // oplysninger. Står der andet på linjen, er det ikke svaret — så er det
    // en oplysning, der tilfældigvis begynder med ordet.
    if (linje.toUpperCase() === INTET) return [];

    // En linje, der fylder et helt afsnit, er ikke en oplysning. Så har
    // modellen skrevet en sætning af, og det er netop dét, den ikke må.
    if (linje.length > LINJE_MAX) continue;

    // En linje, der slutter med kolon, bærer ingen værdi. Det er enten
    // modellens indledning ("Her er oplysningerne:") eller en overskrift,
    // den har fundet på. Begge dele er støj i et felt, brugeren skal læse.
    if (linje.endsWith(":")) continue;

    linjer.push(linje);

    if (linjer.length === LOFT) break;
  }

  return linjer;
}
