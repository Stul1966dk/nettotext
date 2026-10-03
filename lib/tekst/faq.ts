import type { Blok } from "./blokke";

/**
 * Afsnittet med ofte stillede spørgsmål.
 *
 * Overskriften er fast, og det er den, afsnittet kendes på: editoren skal
 * kunne se, om teksten allerede har et, så "tilføj" bliver til "skriv om" i
 * stedet for at lægge et til oveni.
 *
 * Ingen `server-only`: både ruten og editoren bruger filen.
 */
export const FAQ_OVERSKRIFT = "Ofte stillede spørgsmål";

export function erFaqBlok(blok: Blok): boolean {
  return (
    blok.slags === "sektion" &&
    blok.overskrift?.trim().toLowerCase() === FAQ_OVERSKRIFT.toLowerCase()
  );
}
