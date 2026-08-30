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
  /**
   * Leverandørens pris i US-DOLLARS pr. million tokens, ind og ud.
   *
   * Står her, fordi prisen hører til modellen på samme måde som navnet, og
   * fordi et budgetloft skal kunne regne på den. Mangler feltet, kender vi
   * ikke prisen — så bliver forbruget logget med 0 kroner, og loftet tæller
   * ikke kaldet med. Det er derfor ikke nok at tilføje en model her; prisen
   * skal med, før den må vælges.
   *
   * Slå tallene op hos leverandøren, når listen opdateres. De ændrer sig.
   */
  pris?: { ind: number; ud: number };
};

export const MODELLER: Record<Leverandoer, readonly Model[]> = {
  anthropic: [
    {
      id: "claude-opus-5",
      navn: "Claude Opus 5",
      beskrivelse: "Bedste sprog. Dyrere pr. tekst.",
      pris: { ind: 5, ud: 25 },
    },
    {
      id: "claude-sonnet-5",
      navn: "Claude Sonnet 5",
      beskrivelse: "Hurtigere og billigere. Fint til korte tekster.",
      pris: { ind: 2, ud: 10 },
    },
  ],
  // Priserne mangler med vilje: de er ikke slået op hos OpenAI endnu, og et
  // gæt ville få budgetloftet til at tælle forkert. Platformens nøgle er en
  // Anthropic-nøgle, så ingen af de her modeller kan bruges, før BYOK bygges.
  // Slå priserne op i OpenAIs egen dokumentation, FØR brugerne må vælge dem.
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
 * Sonnet 5 er valgt frem for Opus 5 efter en sammenligning på samme brief
 * (25.08.2026): 24 % hurtigere, 43 % billigere, og dansken var lige så god.
 * Målingerne står i docs/beslutninger.md.
 *
 * Konsekvens værd at kende: fast mode findes kun på Opus-modellerne. Skal
 * en tekst nogensinde skrives hurtigere end Sonnet kan, er den vej lukket,
 * så længe Sonnet er standard.
 */
export const STANDARDMODEL: Record<Leverandoer, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.6-sol",
};

export function erKendtModel(leverandoer: Leverandoer, id: string): boolean {
  return MODELLER[leverandoer].some((m) => m.id === id);
}

/** Slår en model op på tværs af leverandører. Modelnavne er entydige. */
export function findModel(id: string): Model | undefined {
  for (const liste of Object.values(MODELLER)) {
    const fundet = liste.find((m) => m.id === id);
    if (fundet) return fundet;
  }

  return undefined;
}
