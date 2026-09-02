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

/**
 * Leverandørernes navne, som brugeren kender dem.
 *
 * "Anthropic" og "OpenAI" er firmanavne; "Claude" og "ChatGPT" er dét, folk
 * har hørt om. Vi skriver begge dele, hvor der er plads.
 */
export const LEVERANDOER_NAVN: Record<Leverandoer, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT (OpenAI)",
};

/** Hvor brugeren selv laver sin nøgle. Opsætnings-wizarden uddyber. */
export const LEVERANDOER_KONSOL: Record<Leverandoer, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
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

/**
 * Må brugeren vælge den her model?
 *
 * Svaret er nej, så længe prisen mangler. Det er ikke en teknisk formalitet:
 * uden pris logges forbruget som 0 kroner, og budgetloftet tæller for lavt.
 * En model, vi ikke kan regne på, er en model, vi ikke har styr på.
 *
 * Det er samtidig dét, der holder OpenAI ude af indstillinger indtil videre —
 * ikke et flag, nogen skal huske at fjerne, men den samme regel som for alle
 * andre modeller. Slås priserne op i modellisten ovenfor, åbner vejen af sig
 * selv. Se tjeklisten i docs/beslutninger.md.
 */
export function modelErValgbar(leverandoer: Leverandoer, id: string): boolean {
  return MODELLER[leverandoer].some((m) => m.id === id && m.pris !== undefined);
}

/** Modellerne, brugeren faktisk kan vælge hos én leverandør. */
export function valgbareModeller(leverandoer: Leverandoer): readonly Model[] {
  return MODELLER[leverandoer].filter((m) => m.pris !== undefined);
}

/** Kan leverandøren vælges overhovedet? Nej, hvis ingen af modellerne kan. */
export function leverandoerErKlar(leverandoer: Leverandoer): boolean {
  return valgbareModeller(leverandoer).length > 0;
}

/**
 * Den model, indstillinger skal stå på, før brugeren rører ved noget.
 *
 * STANDARDMODEL, når den kan vælges — ellers den første, der kan. Uden det
 * ville formularen foreslå den dyreste model i listen, blot fordi den står
 * øverst, og modsige valget af Sonnet som standard.
 */
export function standardValgbarModel(leverandoer: Leverandoer): string {
  const valgbare = valgbareModeller(leverandoer);
  const standard = STANDARDMODEL[leverandoer];

  return valgbare.some((m) => m.id === standard)
    ? standard
    : (valgbare[0]?.id ?? "");
}

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
