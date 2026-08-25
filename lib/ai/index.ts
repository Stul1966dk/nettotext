import "server-only";

import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import { STANDARDMODEL, erKendtModel } from "./modeller";
import { AiFejl, type AiAdapter, type Leverandoer } from "./typer";

export * from "./typer";
export * from "./modeller";

/**
 * Nøglevalget — det sted, driftsmodellen faktisk håndhæves.
 *
 * Rækkefølgen er fastlagt i CLAUDE.md:
 *   1. Er der prøvekvote tilbage?      → platformens nøgle (vi betaler)
 *   2. Har brugeren sin egen nøgle?    → den (brugeren betaler)
 *   3. Ingen af delene                 → venlig afvisning med link til wizarden
 *
 * "server-only" øverst er ikke pynt: importerer nogen ved et uheld denne fil
 * fra en klient-komponent, fejler bygningen i stedet for at sende nøglen
 * ud i browseren.
 */

export type Betaler = "platform" | "user";

export type Noeglevalg = {
  adapter: AiAdapter;
  model: string;
  betaler: Betaler;
};

/** Fejl vi kan forklare brugeren — "du mangler en nøgle". */
export class ManglerNoegle extends Error {
  constructor() {
    super("Ingen prøvekvote tilbage og ingen egen AI-nøgle.");
    this.name = "ManglerNoegle";
  }
}

const PLATFORM_AI_KEY = process.env.PLATFORM_AI_KEY;

/**
 * Hvilken leverandør hører platformens nøgle til?
 *
 * Anthropics nøgler begynder med "sk-ant-"; OpenAIs gør ikke. Vi kunne kræve
 * en ekstra miljøvariabel, men så er der én mere at sætte forkert.
 */
function platformLeverandoer(noegle: string): Leverandoer {
  return noegle.startsWith("sk-ant-") ? "anthropic" : "openai";
}

export function byggAdapter(
  leverandoer: Leverandoer,
  apiNoegle: string,
): AiAdapter {
  return leverandoer === "anthropic"
    ? anthropicAdapter(apiNoegle)
    : openaiAdapter(apiNoegle);
}

/**
 * Vælger nøgle og adapter for én generering.
 *
 * `harProeveKvote` afgøres af kalderen, som allerede har reserveret kvoten —
 * denne funktion bruger penge, den holder ikke regnskab.
 */
export function vaelgNoegle(harProeveKvote: boolean): Noeglevalg {
  if (harProeveKvote) {
    if (!PLATFORM_AI_KEY) {
      // Opsætningsfejl hos os, ikke hos brugeren. Skal fejle højlydt i
      // serverloggen — jf. samme princip som lib/supabase/konfiguration.ts.
      throw new AiFejl(
        "ukendt",
        "PLATFORM_AI_KEY mangler. Sæt den i .env.local og hos Vercel.",
      );
    }

    const leverandoer = platformLeverandoer(PLATFORM_AI_KEY);

    return {
      adapter: byggAdapter(leverandoer, PLATFORM_AI_KEY),
      model: STANDARDMODEL[leverandoer],
      betaler: "platform",
    };
  }

  // Trin 6: her hentes og dekrypteres brugerens egen nøgle fra ai_keys,
  // og brugerens valgte model slås op. Indtil da findes tabellen ikke,
  // og alle uden prøvekvote tilbage lander samme sted.
  throw new ManglerNoegle();
}

/** Værn mod et modelnavn, der ikke står på vores kuraterede liste. */
export function sikkerModel(leverandoer: Leverandoer, oensket: string): string {
  return erKendtModel(leverandoer, oensket)
    ? oensket
    : STANDARDMODEL[leverandoer];
}
