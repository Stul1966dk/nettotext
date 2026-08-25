/**
 * Fælles sprog for AI-laget.
 *
 * Resten af appen kender kun disse typer — aldrig Anthropics eller OpenAIs
 * egne. Det er dét, der gør leverandøren til et frit valg for brugeren:
 * de to adaptere ser ens ud udefra, uanset hvor forskellige de er indeni.
 */

export const LEVERANDOERER = ["anthropic", "openai"] as const;
export type Leverandoer = (typeof LEVERANDOERER)[number];

/** Ét kald til en sprogmodel. */
export type Anmodning = {
  /** Systemskabelonen fra templates.system_prompt. Ligger fast. */
  system: string;
  /** Brugerens brief, pakket som afgrænset datablok. Se prompt.ts. */
  bruger: string;
  model: string;
  maxTokens: number;
};

/** Hvad kaldet kostede. Metadata — aldrig selve teksten. */
export type Forbrug = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type Resultat = Forbrug & { tekst: string };

/**
 * Streamens to slags hændelser. Forbruget kommer til sidst, fordi
 * leverandørerne først kender de endelige tal, når svaret er færdigt.
 */
export type StreamBid =
  | { slags: "tekst"; tekst: string }
  | ({ slags: "forbrug" } & Forbrug);

export interface AiAdapter {
  readonly leverandoer: Leverandoer;
  generate(anmodning: Anmodning): Promise<Resultat>;
  generateStream(anmodning: Anmodning): AsyncGenerator<StreamBid>;
  countTokensEstimate(tekst: string): number;
}

/**
 * Fejl, vi selv har forstået og kan forklare brugeren på dansk.
 *
 * `aarsag` afgør beskeden i UI'et; `message` er kun til serverloggen.
 * Rå fejltekster fra leverandøren når ALDRIG browseren — de kan indeholde
 * dele af nøglen eller af brugerens tekst.
 */
export type AiFejlAarsag =
  | "ugyldig_noegle"
  | "tom_saldo"
  | "rate_limit"
  | "for_lang"
  | "afvist"
  | "ukendt";

export class AiFejl extends Error {
  constructor(
    readonly aarsag: AiFejlAarsag,
    message: string,
  ) {
    super(message);
    this.name = "AiFejl";
  }
}
