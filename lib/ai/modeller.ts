import type { Leverandoer } from "./typer";

/**
 * Den kuraterede modelliste.
 *
 * Brugeren vælger leverandør og model i indstillinger — men kun blandt
 * modeller herfra. Leverandørernes fulde kataloger rummer billed-, lyd- og
 * specialmodeller, der ikke kan skrive et blogindlæg, og navnene skifter
 * ofte. En kort liste, vi selv har prøvet af, er ærligere end en lang.
 *
 * Filen er med vilje det eneste sted, modelnavne står. Skal listen opdateres,
 * er det her — og kun her.
 */

export type Model = {
  id: string;
  navn: string;
  /** Kort dansk forklaring, vist i indstillinger. */
  beskrivelse: string;
};

export const MODELLER: Record<Leverandoer, readonly Model[]> = {
  anthropic: [
    {
      id: "claude-opus-5",
      navn: "Claude Opus 5",
      beskrivelse: "Bedste sprog. Dyrere pr. tekst.",
    },
    {
      id: "claude-sonnet-5",
      navn: "Claude Sonnet 5",
      beskrivelse: "Hurtigere og billigere. Fint til korte tekster.",
    },
  ],
  openai: [
    {
      id: "gpt-5.6-sol",
      navn: "GPT-5.6 Sol",
      beskrivelse: "Bedste sprog. Dyrere pr. tekst.",
    },
    {
      id: "gpt-5.6-terra",
      navn: "GPT-5.6 Terra",
      beskrivelse: "Hurtigere og billigere. Fint til korte tekster.",
    },
  ],
};

/** Modellen vi bruger, når brugeren ikke selv har valgt. */
export const STANDARDMODEL: Record<Leverandoer, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-5.6-sol",
};

export function erKendtModel(leverandoer: Leverandoer, id: string): boolean {
  return MODELLER[leverandoer].some((m) => m.id === id);
}
