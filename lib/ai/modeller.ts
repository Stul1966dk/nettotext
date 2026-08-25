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

/**
 * Modellen vi bruger, når brugeren ikke selv har valgt.
 *
 * UNDER AFPRØVNING (25.08.2026): sat til Sonnet 5 i stedet for Opus 5.
 * Baggrund: Opus 5 skriver omkring 42 tokens i sekundet, hvilket gav 54
 * sekunder for en tekst på 800 ord — for tæt på tidsloftet, og håbløst for
 * den lange tekstlængde. Sonnet 5 skriver hurtigere og koster cirka det
 * halve. Spørgsmålet er, om dansken holder.
 *
 * Falder testen ud til Opus' fordel, sættes den tilbage, og hastigheden
 * løses i stedet med fast mode eller et højere maxDuration. Se
 * docs/beslutninger.md.
 */
export const STANDARDMODEL: Record<Leverandoer, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.6-sol",
};

export function erKendtModel(leverandoer: Leverandoer, id: string): boolean {
  return MODELLER[leverandoer].some((m) => m.id === id);
}
