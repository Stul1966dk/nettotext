/**
 * Groft skøn over antal tokens i en tekst.
 *
 * Et token er den bid, sprogmodeller regner i — cirka en stavelse. Det
 * præcise tal kender kun leverandøren, og det koster et ekstra kald at spørge.
 * Til vores formål (afvise en brief, der er åbenlyst for lang, før vi bruger
 * penge på den) er et skøn rigeligt.
 *
 * 3,6 tegn pr. token passer nogenlunde på dansk. Engelsk ligger nærmere 4;
 * dansk har længere ord og flere sammensætninger. Skønnet rammer med vilje
 * lidt for højt, så vi hellere afviser en tekst for tidligt end for sent.
 */
export function skoenTokens(tekst: string): number {
  return Math.ceil(tekst.length / 3.6);
}
