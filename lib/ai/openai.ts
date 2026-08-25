import OpenAI from "openai";

import { skoenTokens } from "./estimat";
import { AiFejl, type AiAdapter, type Anmodning, type Resultat, type StreamBid } from "./typer";

/**
 * Adapter for OpenAI (ChatGPT).
 *
 * Samme udvendige form som anthropic.ts — indvendigt et andet API. OpenAI
 * kalder systemprompten `instructions` og brugerens tekst `input`, og deres
 * stream sender navngivne hændelser frem for indholdsblokke. Ingen af de
 * forskelle må slippe ud af denne fil.
 */
export function openaiAdapter(apiNoegle: string): AiAdapter {
  const klient = new OpenAI({ apiKey: apiNoegle });

  function grundparametre(anmodning: Anmodning) {
    return {
      model: anmodning.model,
      instructions: anmodning.system,
      input: anmodning.bruger,
      max_output_tokens: anmodning.maxTokens,
    };
  }

  return {
    leverandoer: "openai",

    countTokensEstimate: skoenTokens,

    async generate(anmodning): Promise<Resultat> {
      try {
        const svar = await klient.responses.create(grundparametre(anmodning));

        return {
          tekst: svar.output_text,
          model: svar.model,
          inputTokens: svar.usage?.input_tokens ?? 0,
          outputTokens: svar.usage?.output_tokens ?? 0,
        };
      } catch (fejl) {
        throw oversaetFejl(fejl);
      }
    },

    async *generateStream(anmodning): AsyncGenerator<StreamBid> {
      try {
        const stream = await klient.responses.create({
          ...grundparametre(anmodning),
          stream: true,
        });

        for await (const haendelse of stream) {
          if (haendelse.type === "response.output_text.delta") {
            yield { slags: "tekst", tekst: haendelse.delta };
          }

          if (haendelse.type === "response.completed") {
            yield {
              slags: "forbrug",
              model: haendelse.response.model,
              inputTokens: haendelse.response.usage?.input_tokens ?? 0,
              outputTokens: haendelse.response.usage?.output_tokens ?? 0,
            };
          }
        }
      } catch (fejl) {
        throw oversaetFejl(fejl);
      }
    },
  };
}

/**
 * Oversætter OpenAIs fejl til vores egne. Se noten i anthropic.ts —
 * samme princip: fejlklasser frem for fejltekster, og teksten når aldrig
 * browseren.
 */
function oversaetFejl(fejl: unknown): AiFejl {
  if (fejl instanceof AiFejl) return fejl;

  if (fejl instanceof OpenAI.AuthenticationError) {
    return new AiFejl("ugyldig_noegle", "OpenAI afviste nøglen.");
  }

  if (fejl instanceof OpenAI.RateLimitError) {
    // OpenAI bruger 429 til BÅDE "for mange kald" og "ingen penge på kontoen".
    // De skelnes på fejlkoden, ikke på statuskoden.
    if (fejl.code === "insufficient_quota") {
      return new AiFejl("tom_saldo", "Kontoen hos OpenAI har ikke saldo.");
    }
    return new AiFejl("rate_limit", "OpenAI bad os vente.");
  }

  if (fejl instanceof OpenAI.BadRequestError) {
    if (fejl.code === "context_length_exceeded") {
      return new AiFejl("for_lang", "Anmodningen var for lang.");
    }
    return new AiFejl("ukendt", "OpenAI afviste anmodningen (400).");
  }

  if (fejl instanceof OpenAI.APIError) {
    return new AiFejl("ukendt", `OpenAI svarede ${fejl.status}.`);
  }

  return new AiFejl("ukendt", "Kaldet til OpenAI mislykkedes.");
}
