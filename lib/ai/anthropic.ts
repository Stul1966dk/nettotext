import Anthropic from "@anthropic-ai/sdk";

import { skoenTokens } from "./estimat";
import { AiFejl, type AiAdapter, type Anmodning, type Resultat, type StreamBid } from "./typer";

/**
 * Adapter for Anthropic (Claude).
 *
 * Alt Anthropic-specifikt bor her. Ser du Anthropic-typer uden for denne fil,
 * er noget sivet ud, som ikke burde.
 */
export function anthropicAdapter(apiNoegle: string): AiAdapter {
  const klient = new Anthropic({ apiKey: apiNoegle });

  /**
   * Fælles opsætning for begge kald.
   *
   * Vi undlader `thinking` med vilje: på Claude Opus 5 og Sonnet 5 betyder
   * det, at modellen selv afgør, hvor meget den skal tænke, før den skriver.
   * Det giver mærkbart bedre struktur i en artikel — mod en kort pause,
   * før teksten begynder at komme.
   *
   * `fallbacks: "default"` er en sikkerhedsline: nægter modellen at svare på
   * en anmodning, prøver Anthropic samme anmodning på en anden model i stedet
   * for bare at give op. Det sker næppe for en dansk blogtekst, men det koster
   * intet, når det ikke bruges.
   */
  function grundparametre(anmodning: Anmodning) {
    return {
      model: anmodning.model,
      max_tokens: anmodning.maxTokens,
      system: anmodning.system,
      messages: [{ role: "user" as const, content: anmodning.bruger }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
      // Hvor grundigt modellen tænker, før den skriver. "medium" er valgt af
      // hensyn til tiden: hele genereringen skal nå at blive færdig, inden
      // Vercel lukker forbindelsen. Vil du have bedre tekster og kan leve med
      // ventetiden, er "high" næste trin — det er den vigtigste knap at dreje
      // på, når den danske kvalitet skal vurderes.
      output_config: { effort: "medium" as const },
    };
  }

  return {
    leverandoer: "anthropic",

    countTokensEstimate: skoenTokens,

    async generate(anmodning): Promise<Resultat> {
      try {
        const svar = await klient.beta.messages.create(grundparametre(anmodning));

        if (svar.stop_reason === "refusal") {
          throw new AiFejl("afvist", "Modellen afviste anmodningen.");
        }

        const tekst = svar.content
          .filter((blok) => blok.type === "text")
          .map((blok) => blok.text)
          .join("");

        return {
          tekst,
          model: svar.model,
          inputTokens: svar.usage.input_tokens,
          outputTokens: svar.usage.output_tokens,
        };
      } catch (fejl) {
        throw oversaetFejl(fejl);
      }
    },

    async *generateStream(anmodning): AsyncGenerator<StreamBid> {
      const stream = klient.beta.messages.stream(grundparametre(anmodning));

      try {
        for await (const haendelse of stream) {
          if (
            haendelse.type === "content_block_delta" &&
            haendelse.delta.type === "text_delta"
          ) {
            yield { slags: "tekst", tekst: haendelse.delta.text };
          }
        }

        const endeligt = await stream.finalMessage();

        if (endeligt.stop_reason === "refusal") {
          throw new AiFejl("afvist", "Modellen afviste anmodningen.");
        }

        yield {
          slags: "forbrug",
          model: endeligt.model,
          inputTokens: endeligt.usage.input_tokens,
          outputTokens: endeligt.usage.output_tokens,
        };
      } catch (fejl) {
        throw oversaetFejl(fejl);
      }
    },
  };
}

/**
 * Oversætter Anthropics fejl til vores egne.
 *
 * Vi bruger SDK'ets fejlklasser frem for at læse fejlteksten — klasserne er
 * stabile, teksterne skifter. Undtagelsen er "for lidt saldo", som Anthropic
 * ikke har en egen klasse for; den ligger som en almindelig 400. Derfor det
 * ene tekst-tjek nedenfor, og kun dét.
 *
 * Fejlteksten sendes ALDRIG videre til browseren. Den kan indeholde dele af
 * anmodningen, og i værste fald af nøglen.
 */
function oversaetFejl(fejl: unknown): AiFejl {
  if (fejl instanceof AiFejl) return fejl;

  if (fejl instanceof Anthropic.AuthenticationError) {
    return new AiFejl("ugyldig_noegle", "Anthropic afviste nøglen.");
  }

  if (fejl instanceof Anthropic.RateLimitError) {
    return new AiFejl("rate_limit", "Anthropic bad os vente.");
  }

  if (fejl instanceof Anthropic.BadRequestError) {
    const tekst = fejl.message.toLowerCase();
    if (tekst.includes("credit balance") || tekst.includes("billing")) {
      return new AiFejl("tom_saldo", "Kontoen hos Anthropic har ikke saldo.");
    }
    if (tekst.includes("too long") || tekst.includes("max_tokens")) {
      return new AiFejl("for_lang", "Anmodningen var for lang.");
    }
    return new AiFejl("ukendt", `Anthropic afviste anmodningen (400).`);
  }

  if (fejl instanceof Anthropic.APIError) {
    return new AiFejl("ukendt", `Anthropic svarede ${fejl.status}.`);
  }

  return new AiFejl("ukendt", "Kaldet til Anthropic mislykkedes.");
}
