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
   * intet, når det ikke bruges. Sættes kun på Opus-modellerne, se nedenfor.
   */
  function grundparametre(anmodning: Anmodning) {
    // Sikkerhedslinen `fallbacks` er dokumenteret til Opus-modellerne. Vi
    // sætter den kun dér, frem for at risikere at et kald bliver afvist,
    // fordi modellen ikke kender parameteren.
    const fallback = anmodning.model.startsWith("claude-opus-")
      ? {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }
      : {};

    return {
      model: anmodning.model,
      max_tokens: anmodning.maxTokens,
      system: systemBlokke(anmodning),
      messages: [{ role: "user" as const, content: anmodning.bruger }],
      ...fallback,
      // Hvor grundigt modellen tænker, før den skriver.
      //
      // Prøvede kortvarigt "low" for at komme under tidsloftet. Målingen
      // viste, at det var forgæves: planlægningen tager under 2 sekunder,
      // mens selve skrivningen tager over 50. `effort` er altså IKKE knappen
      // at dreje på, når det handler om tid — den koster kvalitet og giver
      // næsten intet igen.
      //
      // Flaskehalsen er, hvor hurtigt modellen kan producere ord (omkring 42
      // tokens i sekundet). Den løses med valg af model, med fast mode eller
      // med et højere maxDuration — ikke med effort. Målingen står i
      // serverloggen, se route.ts.
      //
      // Hævet fra "medium" til "high" 03.10.2026, og af en anden grund end
      // tid: på "medium" brugte modellen ét sekund på at planlægge og skrev
      // ca. 1.000 ord, når briefen bad om 1.400. På "high" planlægger den i
      // 15 til 17 sekunder og skriver ca. 1.150 ord i syv afsnit uden
      // opfundne tal. Prisen er ca. 70 % flere output-tokens og ca. 20
      // sekunder mere pr. tekst — derfor maxDuration = 120 i route.ts.
      output_config: { effort: "high" as const },
    };
  }

  /**
   * Prompt caching.
   *
   * Den faste del af systemprompten — skrivevejledningen, materialet og
   * outputformatet — er den samme for hver tekst af samme type og fylder
   * typisk 2.000 til 13.000 tokens. Med en cache-markør efter den gemmer
   * Anthropic den i fem minutter, og næste kald inden for de fem minutter
   * betaler en tiendedel for den del. Hvert kald forlænger de fem minutter.
   *
   * Prisen er, at det FØRSTE kald betaler 25 % ekstra for at skrive den.
   * Det tjener sig hjem, så snart ét kald mere rammer den: en omskrivning
   * af et afsnit, "Skriv en til med samme opsætning", eller en anden
   * bruger på platformens nøgle. Cachen deles kun inden for samme
   * API-nøgle, så en bruger med egen nøgle har sin egen.
   *
   * Under 512 tokens (Opus 5) eller 1.024 (Sonnet 5) cacher Anthropic ikke
   * og tager heller ikke ekstra betaling. Så sker der bare ingenting.
   */
  function systemBlokke(anmodning: Anmodning) {
    if (typeof anmodning.system === "string") return anmodning.system;

    return [
      {
        type: "text" as const,
        text: anmodning.system.fast,
        cache_control: { type: "ephemeral" as const },
      },
      { type: "text" as const, text: anmodning.system.variabel },
    ];
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
          cacheSkrevet: svar.usage.cache_creation_input_tokens ?? 0,
          cacheLaest: svar.usage.cache_read_input_tokens ?? 0,
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
          cacheSkrevet: endeligt.usage.cache_creation_input_tokens ?? 0,
          cacheLaest: endeligt.usage.cache_read_input_tokens ?? 0,
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
