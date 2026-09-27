/**
 * Fælles sprog for AI-laget.
 *
 * Resten af appen kender kun disse typer — aldrig Anthropics eller OpenAIs
 * egne. Det er dét, der gør leverandøren til et frit valg for brugeren:
 * de to adaptere ser ens ud udefra, uanset hvor forskellige de er indeni.
 */

export const LEVERANDOERER = ["anthropic", "openai"] as const;
export type Leverandoer = (typeof LEVERANDOERER)[number];

/**
 * En systemprompt i to dele: den, der er den samme fra kald til kald, og
 * den, der skifter.
 *
 * Den faste del kommer først og kan caches hos leverandøren — se
 * anthropic.ts. Rækkefølgen er ikke til forhandling: en cache er et match
 * på begyndelsen af prompten, og ét tegn, der skifter før eller inde i den
 * faste del, gør cachen værdiløs.
 */
export type SystemDele = { fast: string; variabel: string };

/** Ét kald til en sprogmodel. */
export type Anmodning = {
  /**
   * Systemprompten. Delt i to, når en del af den gentages fra kald til kald
   * og er værd at cache; ellers en almindelig tekst.
   */
  system: string | SystemDele;
  /** Brugerens brief, pakket som afgrænset datablok. Se prompt.ts. */
  bruger: string;
  model: string;
  maxTokens: number;
};

/** Hvad kaldet kostede. Metadata — aldrig selve teksten. */
export type Forbrug = {
  model: string;
  /**
   * Input til fuld pris. Hos Anthropic er det KUN den del, der ikke kom fra
   * cachen — de to cachetal herunder skal lægges oveni for at få hele
   * promptens størrelse.
   */
  inputTokens: number;
  outputTokens: number;
  /** Tokens skrevet til cachen. Koster 1,25 gange normal inputpris. */
  cacheSkrevet?: number;
  /** Tokens læst fra cachen. Koster 0,1 gange normal inputpris. */
  cacheLaest?: number;
};

/** Hele systemprompten som én tekst, til leverandører uden eksplicit cache. */
export function samletSystem(system: string | SystemDele): string {
  return typeof system === "string"
    ? system
    : `${system.fast}

${system.variabel}`;
}

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
