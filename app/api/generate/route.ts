import { z } from "zod";

import { byggBrugerbesked } from "@/lib/ai/prompt";
import { ManglerNoegle, vaelgNoegle, AiFejl } from "@/lib/ai";
import { frigivProeveTekst, reserverProeveTekst } from "@/lib/kvote";
import { hentSkabelon } from "@/lib/skabeloner/hent";
import { sanerHtml } from "@/lib/tekst/saner";
import { briefSkema } from "@/lib/skabeloner/typer";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/generate — genererer én tekst og streamer den tilbage.
 *
 * Alt der koster penge går gennem denne rute. Rækkefølgen af tjek er den fra
 * CLAUDE.md regel 6:
 *   (a) er brugeren logget ind?
 *   (b) er der prøvekvote tilbage — eller en gyldig egen nøgle?
 *   (c) rate limit pr. bruger        → bygges i trin 6
 *   (d) globalt dagligt budgetloft   → bygges i trin 6
 *
 * Svaret er NDJSON: én JSON-linje pr. hændelse. Se protokollen nedenfor.
 */

// Genereringen tager tid — særligt for lange tekster. Bemærk at Vercel har
// sit eget loft afhængigt af abonnement; 60 sekunder virker på alle planer.
export const maxDuration = 60;

const anmodningSkema = z.object({
  skabelon: z.string().min(1).max(64),
  brief: z.record(z.string(), z.string()),
});

/**
 * Én linje i strømmen. Klienten oversætter `aarsag` til dansk.
 *
 * `faerdig` bærer den SANEREDE HTML. Under selve streamen sender vi rå
 * tekstbidder, som browseren viser som tekst — man kan ikke sanere et halvt
 * HTML-tag. Først når teksten er hel, kan den saneres, og først dén version
 * må vises som HTML. Se lib/tekst/saner.ts.
 */
type Hendelse =
  | { slags: "tekst"; tekst: string }
  | { slags: "faerdig"; html: string }
  | { slags: "fejl"; aarsag: string };

const encoder = new TextEncoder();

function linje(h: Hendelse): Uint8Array {
  return encoder.encode(JSON.stringify(h) + "\n");
}

/** Fejl FØR strømmen er åbnet — her kan vi stadig sætte en statuskode. */
function afvis(aarsag: string, status: number) {
  return Response.json({ slags: "fejl", aarsag }, { status });
}

export async function POST(request: Request) {
  // --- (a) Logget ind? -----------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return afvis("ikke_logget_ind", 401);
  }

  // --- Gyldig anmodning? ---------------------------------------------------
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

  const skabelon = await hentSkabelon(anmodning.data.skabelon);
  if (!skabelon) {
    return afvis("ukendt_skabelon", 404);
  }

  // Briefen valideres mod skabelonens egne felter — ikke mod et fast skema.
  const brief = briefSkema(skabelon.input_fields).safeParse(anmodning.data.brief);
  if (!brief.success) {
    return afvis("ugyldig_brief", 400);
  }

  // --- (b) Hvem betaler? ---------------------------------------------------
  // Reserveres FØR kaldet, så samtidige forsøg ikke kan dele den samme
  // sidste prøvetekst mellem sig.
  const harKvote = await reserverProeveTekst(user.id);

  let valg;
  try {
    valg = vaelgNoegle(harKvote);
  } catch (fejl) {
    if (harKvote) await frigivProeveTekst(user.id);

    if (fejl instanceof ManglerNoegle) {
      return afvis("mangler_noegle", 402);
    }

    console.error("Nøglevalg mislykkedes:", fejl);
    return afvis("serverfejl", 500);
  }

  const brugerbesked = byggBrugerbesked(skabelon.input_fields, brief.data);

  // --- Selve genereringen --------------------------------------------------
  const stream = new ReadableStream({
    async start(controller) {
      let harSendtTekst = false;
      let samlet = "";

      // Måling, ikke gætteri. Vi skal kunne se, om tiden går med at PLANLÆGGE
      // (før første ord) eller med at SKRIVE — det er to forskellige knapper.
      // Kun tal og tidsforbrug, aldrig noget af teksten.
      const begyndt = Date.now();
      let foersteOrd: number | null = null;

      try {
        const bidder = valg.adapter.generateStream({
          system: skabelon.system_prompt,
          bruger: brugerbesked,
          model: valg.model,
          maxTokens: 16000,
        });

        for await (const bid of bidder) {
          if (bid.slags === "tekst") {
            foersteOrd ??= Date.now() - begyndt;
            harSendtTekst = true;
            samlet += bid.tekst;
            controller.enqueue(linje({ slags: "tekst", tekst: bid.tekst }));
          }

          if (bid.slags === "forbrug") {
            const ialt = Date.now() - begyndt;
            console.log(
              `[generate] ${bid.model} · planlægning ${foersteOrd ?? ialt} ms ` +
                `· skrivning ${ialt - (foersteOrd ?? ialt)} ms · i alt ${ialt} ms ` +
                `· ${bid.inputTokens} ind / ${bid.outputTokens} ud`,
            );
          }
          // Trin 6: her skrives forbruget i usage_log. Indtil da står det kun
          // i serverloggen — og det er netop derfor, vi endnu ikke kender
          // prisen pr. prøvetekst historisk.
        }

        // Nu er teksten hel og kan saneres. Det er den eneste version, der
        // nogensinde bliver vist som HTML i browseren.
        controller.enqueue(linje({ slags: "faerdig", html: sanerHtml(samlet) }));
      } catch (fejl) {
        // Kom der aldrig tekst ud, har brugeren ikke fået noget for sin
        // prøvetekst. Så giver vi den tilbage.
        if (!harSendtTekst && valg.betaler === "platform") {
          await frigivProeveTekst(user.id);
        }

        // Loggen må se detaljerne. Browseren får kun en kategori: rå
        // fejltekster kan indeholde dele af nøglen eller af brugerens tekst.
        console.error("Generering mislykkedes:", fejl);

        const aarsag = fejl instanceof AiFejl ? fejl.aarsag : "ukendt";
        controller.enqueue(linje({ slags: "fejl", aarsag }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
