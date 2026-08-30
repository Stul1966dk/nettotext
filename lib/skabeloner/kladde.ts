import type { Blok } from "@/lib/tekst/blokke";

import type { Brief } from "./typer";

/**
 * Briefens vej fra /app/ny til /app/skriv.
 *
 * Den ligger i browserens sessionStorage — ikke i databasen. Det er ikke
 * dovenskab: "intet gemmes permanent" er et løfte, og en brief, der aldrig
 * rører serveren, kan ikke blive liggende. sessionStorage tømmes af sig selv,
 * når fanen lukkes.
 *
 * Den færdige tekst lægges samme sted, mens den skrives. Så koster en
 * genindlæsning af siden ikke en ny prøvetekst.
 *
 * Trin 4 lægger en rigtig kladdefunktion oven på det her: localStorage plus
 * drafts-tabellen med 48 timers udløb.
 */

const NOEGLE = "nettotext:kladde";

export type Kladde = {
  skabelon: string;
  brief: Brief;
  /** Den rå tekst, som den kom fra modellen. Vises kun som tekst. */
  tekst: string;
  /** Den sanerede HTML fra serveren. Kun DEN må vises som HTML. */
  html: string;
  /** Samme HTML, delt ved overskrifterne. Se lib/tekst/blokke.ts. */
  blokke: Blok[];
  /** Til Googles søgeresultat. Brugeren kan rette i dem. */
  titel: string;
  beskrivelse: string;
  faerdig: boolean;
};

export function gemKladde(kladde: Kladde): void {
  try {
    sessionStorage.setItem(NOEGLE, JSON.stringify(kladde));
  } catch {
    // Privat browsing eller fuldt lager. Teksten står stadig på skærmen —
    // den overlever bare ikke en genindlæsning. Ikke værd at afbryde for.
  }
}

export function hentKladde(): Kladde | null {
  try {
    const raa = sessionStorage.getItem(NOEGLE);
    if (!raa) return null;

    const kladde = JSON.parse(raa) as Kladde;
    if (!kladde?.skabelon || typeof kladde.brief !== "object") return null;

    // En kladde, der blev lagt her af en tidligere udgave af appen, mangler
    // de nye felter. Den skal ikke få siden til at gå ned.
    return {
      ...kladde,
      blokke: Array.isArray(kladde.blokke) ? kladde.blokke : [],
      titel: kladde.titel ?? "",
      beskrivelse: kladde.beskrivelse ?? "",
    };
  } catch {
    return null;
  }
}
