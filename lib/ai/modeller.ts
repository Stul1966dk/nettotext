import type { Leverandoer } from "./typer";

/**
 * Pristabellen: de modeller, vi kender prisen på, og hvad vi ved om dem.
 *
 * HVILKE modeller der findes, hentes automatisk fra Anthropic én gang i
 * døgnet (se modelkatalog.ts). PRISEN kan ikke hentes — hverken Anthropic
 * eller OpenAI udgiver priser, et program kan læse — så den står her.
 *
 * Ingen model hos Anthropic er låst (ejerens beslutning 11.11.2026). En ny
 * model, der endnu ikke står her, kan vælges med det samme; indtil prisen er
 * lagt ind, regner budgetloftet med den HØJESTE pris i tabellen, så loftet
 * hellere rammer for tidligt end for sent. Se beregnPrisDkk().
 *
 * Modeller, vi ikke anbefaler, har `ikkeAnbefalet` og en beskrivelse, der
 * siger hvorfor. De kan stadig vælges.
 *
 * Priserne er slået op på platform.claude.com/docs/en/about-claude/pricing
 * 11.11.2026. Slå dem op igen, når der lægges en ny model ind.
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
   * fordi et budgetloft skal kunne regne på den. Mangler den, regner
   * beregnPrisDkk() med den højeste pris i tabellen.
   *
   * OpenAI-modellerne står med vilje uden pris: dét holder hele OpenAI-vejen
   * lukket, til den er afprøvet (se tjeklisten i docs/beslutninger.md). Det er
   * en lås på leverandøren, ikke på enkelte modeller.
   *
   * Slå tallene op hos leverandøren, når listen opdateres. De ændrer sig.
   */
  pris?: { ind: number; ud: number };
  /**
   * Højere pris over en vis promptlængde. Kun Haiku 5.5 har det i dag:
   * over 100.000 tokens ind koster hele kaldet mere. Se beregnPrisDkk().
   */
  langPris?: { overTokens: number; ind: number; ud: number };
  /**
   * Må kaldet bruge Anthropics sikkerhedsline `fallbacks: "default"`?
   * Den er kun dokumenteret til nogle modeller, og en model, der ikke kender
   * parameteren, afviser hele kaldet. Se grundparametre() i anthropic.ts.
   */
  fallback?: boolean;
  /**
   * Tager modellen imod `output_config.effort`? Haiku 4.5 og Sonnet 4.5 gør
   * ikke og afviser hele kaldet, hvis den er med. Mangler feltet, sendes
   * den. Se grundparametre() i anthropic.ts.
   */
  effort?: boolean;
  /** Vises som "Ikke anbefalet". Beskrivelsen siger hvorfor. */
  ikkeAnbefalet?: boolean;
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
    // --- Anbefalede ---
    {
      id: "claude-opus-5-5",
      navn: "Claude Opus 5.5",
      beskrivelse:
        "Nyeste Opus og billigere end Opus 5. Ikke sammenlignet på danske tekster endnu.",
      pris: { ind: 4, ud: 20 },
      fallback: true,
    },
    {
      id: "claude-opus-5",
      navn: "Claude Opus 5",
      beskrivelse: "Bedste sprog i vores afprøvning. Dyrere pr. tekst.",
      pris: { ind: 5, ud: 25 },
      fallback: true,
    },
    {
      id: "claude-sonnet-5-5",
      navn: "Claude Sonnet 5.5",
      beskrivelse:
        "Nyeste Sonnet, samme pris som Sonnet 5. Ikke sammenlignet på danske tekster endnu.",
      pris: { ind: 2, ud: 10 },
      fallback: true,
    },
    {
      id: "claude-sonnet-5",
      navn: "Claude Sonnet 5",
      beskrivelse: "Hurtigere og billigere. Fint til korte tekster.",
      pris: { ind: 2, ud: 10 },
    },
    {
      // Billigst af alle — og derfor den, idéforslag og udtræk af
      // oplysninger bruger, se billigsteModel().
      id: "claude-haiku-5-5",
      navn: "Claude Haiku 5.5",
      beskrivelse:
        "Hurtigst og langt billigst. Ikke afprøvet til hele tekster.",
      pris: { ind: 0.1, ud: 0.5 },
      langPris: { overTokens: 100_000, ind: 0.5, ud: 2.5 },
    },

    // --- Ikke anbefalede, men valgbare ---
    {
      id: "claude-fable-5-2",
      navn: "Claude Fable 5.2",
      beskrivelse:
        "Anthropics stærkeste model, men dobbelt så dyr som Opus 5.5 og langsom. Et langt blogindlæg kan nå tidsgrænsen på 120 sekunder, og så bliver teksten ikke færdig.",
      pris: { ind: 8, ud: 40 },
      fallback: true,
      ikkeAnbefalet: true,
    },
    {
      id: "claude-fable-5-1",
      navn: "Claude Fable 5.1",
      beskrivelse:
        "Afløst af Fable 5.2, som er billigere. Langsom, så lange tekster kan nå tidsgrænsen.",
      pris: { ind: 10, ud: 50 },
      fallback: true,
      ikkeAnbefalet: true,
    },
    {
      id: "claude-fable-5",
      navn: "Claude Fable 5",
      beskrivelse:
        "Afløst af Fable 5.2, som er billigere. Langsom, så lange tekster kan nå tidsgrænsen.",
      pris: { ind: 10, ud: 50 },
      ikkeAnbefalet: true,
    },
    ...["4.8", "4.7", "4.6"].map((v) => ({
      id: `claude-opus-${v.replace(".", "-")}`,
      navn: `Claude Opus ${v}`,
      beskrivelse:
        "Ældre Opus. Koster det samme som Opus 5 og mere end Opus 5.5.",
      pris: { ind: 5, ud: 25 },
      ikkeAnbefalet: true,
    })),
    {
      id: "claude-opus-4-5-20251101",
      navn: "Claude Opus 4.5",
      beskrivelse:
        "Ældre Opus. Koster det samme som Opus 5 og mere end Opus 5.5.",
      pris: { ind: 5, ud: 25 },
      ikkeAnbefalet: true,
    },
    {
      id: "claude-sonnet-4-6",
      navn: "Claude Sonnet 4.6",
      beskrivelse: "Ældre Sonnet. Dyrere end Sonnet 5 og Sonnet 5.5.",
      pris: { ind: 3, ud: 15 },
      ikkeAnbefalet: true,
    },
    {
      id: "claude-sonnet-4-5-20250929",
      navn: "Claude Sonnet 4.5",
      beskrivelse:
        "Ældre Sonnet. Dyrere end Sonnet 5 og Sonnet 5.5, og den tænker ikke, før den skriver.",
      pris: { ind: 3, ud: 15 },
      effort: false,
      ikkeAnbefalet: true,
    },
    {
      id: "claude-haiku-4-5-20251001",
      navn: "Claude Haiku 4.5",
      beskrivelse:
        "Ældre Haiku. Ti gange dyrere end Haiku 5.5, og den tænker ikke, før den skriver.",
      pris: { ind: 1, ud: 5 },
      effort: false,
      ikkeAnbefalet: true,
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

/**
 * Den billigste model, vi kender prisen på hos leverandøren.
 *
 * Bruges til idéforslagene. Fem linjer med emner har ikke brug for husets
 * bedste sprog, og det tekniske oplæg peger selv på det: en billig model til
 * idégenerering og en topmodel til selve teksten. Betaler brugeren med sin
 * egen nøgle, er det hendes penge, vi sparer — også hvis hun har valgt den
 * dyre model til teksterne.
 *
 * Rangeringen lægger ind- og udpris sammen. Det er ikke en nøjagtig
 * omkostning — den afhænger af, hvor meget der skrives — men det er nok til
 * at skelne to modeller fra hinanden i den samme liste.
 *
 * Returnerer null, hvis ingen model hos leverandøren har en pris. Så er der
 * ikke noget at spare på en oplyst måde, og kalderen bruger den model,
 * nøglevalget allerede har fundet.
 */
export function billigsteModel(leverandoer: Leverandoer): string | null {
  const medPris = valgbareModeller(leverandoer);
  if (medPris.length === 0) return null;

  return medPris.reduce((billigst, model) =>
    model.pris!.ind + model.pris!.ud < billigst.pris!.ind + billigst.pris!.ud
      ? model
      : billigst,
  ).id;
}

/** Slår en model op på tværs af leverandører. Modelnavne er entydige. */
export function findModel(id: string): Model | undefined {
  for (const liste of Object.values(MODELLER)) {
    const fundet = liste.find((m) => m.id === id);
    if (fundet) return fundet;
  }

  return undefined;
}
