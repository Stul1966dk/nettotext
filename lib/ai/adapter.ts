import "server-only";

import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import type { AiAdapter, Leverandoer } from "./typer";

/**
 * Bygger den rigtige adapter til en leverandør og en nøgle.
 *
 * Står i sin egen fil og ikke i index.ts, fordi BÅDE nøglevalget og
 * lib/ainoegler.ts skal bruge den. Lå den i index.ts, ville de to filer
 * importere hinanden i ring: index → ainoegler (hent nøglen) → index
 * (byg adapteren). Ringen ville måske virke, men den slags går i stykker
 * på en ubehagelig måde, og altid på et dårligt tidspunkt.
 */
export function byggAdapter(
  leverandoer: Leverandoer,
  apiNoegle: string,
): AiAdapter {
  return leverandoer === "anthropic"
    ? anthropicAdapter(apiNoegle)
    : openaiAdapter(apiNoegle);
}
