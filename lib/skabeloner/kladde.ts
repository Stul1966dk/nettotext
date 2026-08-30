import type { Blok } from "@/lib/tekst/blokke";

import type { Brief } from "./typer";

/**
 * Kladden i browseren.
 *
 * Den lå oprindeligt i sessionStorage og forsvandt, når fanen blev lukket.
 * Nu ligger den i localStorage og overlever, at browseren lukkes helt. Det
 * er den ene halvdel af trin 4; den anden er kopien på serveren, som gør, at
 * arbejdet også kan hentes frem på en anden computer.
 *
 * Rollefordelingen mellem de to:
 *   localStorage — gemmer ved HVER ændring, koster ingenting, virker offline.
 *   serveren     — gemmer sjældnere, overlever en ryddet browser, udløber
 *                  efter 48 timer (CLAUDE.md regel 7).
 *
 * Begge steder gemmer det SAMME id, så de to kopier ved, de er den samme
 * kladde og ikke to.
 */

const NOEGLE = "nettotext:kladde";

export type Kladde = {
  /** Fælles id for kopien i browseren og kopien på serveren. */
  id: string;
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

/** En ny, tom kladde med sit eget id. */
export function nyKladde(skabelon: string, brief: Brief): Kladde {
  return {
    id: crypto.randomUUID(),
    skabelon,
    brief,
    tekst: "",
    html: "",
    blokke: [],
    titel: "",
    beskrivelse: "",
    faerdig: false,
  };
}

export function gemKladde(kladde: Kladde): void {
  try {
    localStorage.setItem(NOEGLE, JSON.stringify(kladde));
  } catch {
    // Privat browsing eller fuldt lager. Teksten står stadig på skærmen —
    // den overlever bare ikke en genindlæsning. Ikke værd at afbryde for.
  }
}

export function hentKladde(): Kladde | null {
  try {
    const raa = localStorage.getItem(NOEGLE);
    if (!raa) return null;

    const kladde = JSON.parse(raa) as Kladde;
    if (!kladde?.skabelon || typeof kladde.brief !== "object") return null;

    // En kladde, der blev lagt her af en tidligere udgave af appen, mangler
    // de nye felter. Den skal ikke få siden til at gå ned.
    return {
      ...kladde,
      id: kladde.id ?? crypto.randomUUID(),
      blokke: Array.isArray(kladde.blokke) ? kladde.blokke : [],
      titel: kladde.titel ?? "",
      beskrivelse: kladde.beskrivelse ?? "",
    };
  } catch {
    return null;
  }
}

/** Fjerner kladden fra browseren. Bruges, når den er slettet på serveren. */
export function glemKladde(id: string): void {
  try {
    const nuvaerende = hentKladde();
    if (nuvaerende?.id === id) localStorage.removeItem(NOEGLE);
  } catch {
    // Se gemKladde.
  }
}
