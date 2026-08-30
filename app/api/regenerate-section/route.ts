import { z } from "zod";

import { ManglerNoegle, vaelgNoegle, AiFejl } from "@/lib/ai";
import { byggOmskrivBesked, OMSKRIV_TILLAEG } from "@/lib/ai/prompt";
import { afvis, ndjsonLinje, NDJSON_HEADERS } from "@/lib/api/ndjson";
import { hentBudgetstatus, skrivForbrug } from "@/lib/budget";
import { harProeveKvote } from "@/lib/kvote";
import { tagPladsIKoeen } from "@/lib/ratelimit";
import { hentSkabelon } from "@/lib/skabeloner/hent";
import { briefSkema } from "@/lib/skabeloner/typer";
import { sanerHtml } from "@/lib/tekst/saner";
import { udtraekMeta } from "@/lib/tekst/meta";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/regenerate-section — skriver ét afsnit om.
 *
 * Samme tjek som /api/generate, med én forskel: det KOSTER IKKE en prøvetekst
 * at rette i en tekst, brugeren allerede har fået. Beslutningen er ejerens
 * (30.08.2026) og bygger på, at det er en del af at gøre teksten færdig.
 *
 * Prøvekvoten var indtil da også det, der holdt den enkelte bruger i skak.
 * Derfor er rate limit'en bygget samtidig — uden den kunne én bruger tømme
 * dagens budget ved at klikke løs på "Skriv om".
 *
 * Rækkefølgen:
 *   (a) logget ind
 *   (b) gyldig anmodning
 *   (c) rate limit pr. bruger
 *   (d) hvem betaler — kvoten LÆSES, den trækkes ikke
 *   (e) det globale budgetloft, hvis platformen betaler
 */

export const maxDuration = 60;

const blokSkema = z.object({
  id: z.string().min(1).max(32),
  slags: z.enum(["titel", "indledning", "sektion"]),
  overskrift: z.string().max(300).nullable(),
  nummer: z.number().int().nullable(),
  html: z.string().max(20_000),
});

const anmodningSkema = z.object({
  skabelon: z.string().min(1).max(64),
  brief: z.record(z.string(), z.string()),
  blokke: z.array(blokSkema).min(1).max(40),
  blokId: z.string().min(1).max(32),
  // Brugerens frie ønske. Kort med vilje: et ønske til ét afsnit behøver
  // ikke være længere, og jo kortere feltet er, jo mindre er der at gemme
  // et forsøg på at overtage prompten i.
  instruktion: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  // --- (a) Logget ind? -----------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return afvis("ikke_logget_ind", 401);
  }

  // --- (b) Gyldig anmodning? -----------------------------------------------
  let raa: unknown;
  try {
    raa = await request.json();
  } catch {
    return afvis("ugyldig_anmodning", 400);
  }

  const anmodning = anmodningSkema.safeParse(raa);
  if (!anmodning.success) {
    return afvis("ugyldig_anmodning", 400);
  }

  const { blokke, blokId } = anmodning.data;
  const indeks = blokke.findIndex((b) => b.id === blokId);

  if (indeks === -1) {
    return afvis("ugyldig_anmodning", 400);
  }

  const skabelon = await hentSkabelon(anmodning.data.skabelon);
  if (!skabelon) {
    return afvis("ukendt_skabelon", 404);
  }

  const brief = briefSkema(skabelon.input_fields).safeParse(anmodning.data.brief);
  if (!brief.success) {
    return afvis("ugyldig_brief", 400);
  }

  // --- (c) Rate limit ------------------------------------------------------
  try {
    if (!(await tagPladsIKoeen(user.id))) {
      return afvis("for_mange_kald", 429);
    }
  } catch (fejl) {
    console.error("Rate limit-tjek mislykkedes:", fejl);
    return afvis("serverfejl", 500);
  }

  // --- (d) Hvem betaler? ---------------------------------------------------
  // Kvoten læses og trækkes ikke. Har brugeren prøvetekster tilbage, betaler
  // platformen for omskrivningen — uden at tælle den som en tekst.
  let valg;
  try {
    valg = vaelgNoegle(await harProeveKvote(user.id));
  } catch (fejl) {
    if (fejl instanceof ManglerNoegle) {
      return afvis("mangler_noegle", 402);
    }

    console.error("Nøglevalg mislykkedes:", fejl);
    return afvis("serverfejl", 500);
  }

  // --- (e) Det globale budgetloft ------------------------------------------
  if (valg.betaler === "platform") {
    try {
      const budget = await hentBudgetstatus();

      if (budget.tilbage <= 0) {
        console.warn(
          `[omskriv] Dagens budget er brugt: ${budget.brugt} af ${budget.loft} kr.`,
        );
        return afvis("budget_opbrugt", 503);
      }
    } catch (fejl) {
      console.error("Budgettjek mislykkedes:", fejl);
      return afvis("serverfejl", 500);
    }
  }

  const brugerbesked = byggOmskrivBesked(
    skabelon.input_fields,
    brief.data,
    blokke,
    indeks + 1,
    anmodning.data.instruktion ?? "",
  );

  // --- Selve omskrivningen -------------------------------------------------
  const stream = new ReadableStream({
    async start(controller) {
      let samlet = "";
      let sendtIndtil = 0;
      let begyndt = false;

      const begyndtTid = Date.now();
      let forbrug: {
        model: string;
        inputTokens: number;
        outputTokens: number;
      } | null = null;

      /**
       * Sender det, klienten endnu ikke har fået. Starten holdes tilbage,
       * indtil HTML'en begynder, så et "Her er afsnittet:" fra modellen ikke
       * når ud på skærmen. Samme greb som i /api/generate.
       */
      const skubTekst = () => {
        if (!begyndt) {
          const start = samlet.indexOf("<");
          if (start === -1) return;

          begyndt = true;
          sendtIndtil = start;
        }

        const rest = samlet.slice(sendtIndtil);
        if (!rest) return;

        sendtIndtil = samlet.length;
        controller.enqueue(ndjsonLinje({ slags: "tekst", tekst: rest }));
      };

      try {
        const bidder = valg.adapter.generateStream({
          // Systemprompten plus vores eget tillæg. Se OMSKRIV_TILLAEG:
          // det er systemets instruktion, ikke brugerens.
          system: `${skabelon.system_prompt}\n\n${OMSKRIV_TILLAEG}`,
          bruger: brugerbesked,
          model: valg.model,
          // Ét afsnit, ikke en hel artikel.
          maxTokens: 4000,
        });

        for await (const bid of bidder) {
          if (bid.slags === "tekst") {
            samlet += bid.tekst;
            skubTekst();
          }

          if (bid.slags === "forbrug") {
            forbrug = bid;
            console.log(
              `[omskriv] ${bid.model} · ${Date.now() - begyndtTid} ms · ` +
                `${bid.inputTokens} ind / ${bid.outputTokens} ud`,
            );
          }
        }

        // udtraekMeta bruges her til at smide alt væk før det første <.
        // Modellen har fået besked på ikke at skrive meta-linjer, men et
        // "Her er det omskrevne afsnit:" er stadig muligt.
        const udtraek = udtraekMeta(samlet);
        const html = sanerHtml(udtraek.komplet ? udtraek.krop : samlet);

        if (!html) {
          // Kom der intet brugbart ud, er det bedre at sige det end at
          // erstatte brugerens afsnit med ingenting.
          controller.enqueue(ndjsonLinje({ slags: "fejl", aarsag: "tomt_svar" }));
        } else {
          controller.enqueue(ndjsonLinje({ slags: "faerdig", html }));
        }
      } catch (fejl) {
        console.error("Omskrivning mislykkedes:", fejl);

        const aarsag = fejl instanceof AiFejl ? fejl.aarsag : "ukendt";
        controller.enqueue(ndjsonLinje({ slags: "fejl", aarsag }));
      } finally {
        if (forbrug) {
          try {
            await skrivForbrug({
              brugerId: user.id,
              skabelon: skabelon.slug,
              leverandoer: valg.adapter.leverandoer,
              model: forbrug.model,
              betaler: valg.betaler,
              inputTokens: forbrug.inputTokens,
              outputTokens: forbrug.outputTokens,
            });
          } catch (fejl) {
            console.error("Kunne ikke føre forbrug til protokols:", fejl);
          }
        }

        controller.close();
      }
    },
  });

  return new Response(stream, { headers: NDJSON_HEADERS });
}
