import { z } from "zod";

import { byggBrugerbesked } from "@/lib/ai/prompt";
import { ManglerNoegle, vaelgNoegle, AiFejl } from "@/lib/ai";
import { hentBudgetstatus, skrivForbrug } from "@/lib/budget";
import { frigivProeveTekst, reserverProeveTekst } from "@/lib/kvote";
import { hentSkabelon } from "@/lib/skabeloner/hent";
import { delIBlokke, type Blok } from "@/lib/tekst/blokke";
import { META_LOFT, udtraekMeta } from "@/lib/tekst/meta";
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
 *   (c) rate limit pr. bruger        → mangler stadig, trin 6
 *   (d) globalt dagligt budgetloft   → kun på platformens nøgle
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
 *
 * `meta` kommer først. Modellen skriver meta-titel og meta-beskrivelse som to
 * tekstlinjer før HTML'en, så de kan sendes af sted et par sekunder inde i
 * genereringen — længe før teksten er færdig.
 */
type Hendelse =
  | { slags: "meta"; titel: string; beskrivelse: string }
  | { slags: "tekst"; tekst: string }
  | {
      slags: "faerdig";
      html: string;
      blokke: Blok[];
      titel: string;
      beskrivelse: string;
    }
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

  // --- (c) Rate limit pr. bruger -------------------------------------------
  // Mangler stadig (maks. 3 genereringskald i minuttet, CLAUDE.md regel 6).
  // Budgetloftet nedenfor fanger det samlede forbrug, men ikke én bruger,
  // der klikker tredive gange på et minut.

  // --- (d) Det globale budgetloft ------------------------------------------
  // Gælder kun platformens nøgle. Betaler brugeren selv, er forbruget hendes
  // sag og hendes regning, og så skal vi ikke stå i vejen.
  if (valg.betaler === "platform") {
    try {
      const budget = await hentBudgetstatus();

      if (budget.tilbage <= 0) {
        // Kvoten blev reserveret ovenfor. Teksten bliver ikke skrevet, så
        // den skal tilbage.
        if (harKvote) await frigivProeveTekst(user.id);

        console.warn(
          `[generate] Dagens budget er brugt: ${budget.brugt} af ${budget.loft} kr. ` +
            "Alle kald på platformens nøgle afvises indtil i morgen.",
        );

        return afvis("budget_opbrugt", 503);
      }
    } catch (fejl) {
      if (harKvote) await frigivProeveTekst(user.id);

      // Kan vi ikke føre regnskab, bruger vi ikke penge. Samme afvejning som
      // i lib/kvote.ts.
      console.error("Budgettjek mislykkedes:", fejl);
      return afvis("serverfejl", 500);
    }
  }

  const brugerbesked = byggBrugerbesked(skabelon.input_fields, brief.data);

  // --- Selve genereringen --------------------------------------------------
  const stream = new ReadableStream({
    async start(controller) {
      let harSendtTekst = false;
      let samlet = "";

      // Meta-linjerne står FØR artiklen, så starten af svaret holdes tilbage,
      // indtil de er hele. Det koster typisk et sekund, og til gengæld ser
      // brugeren aldrig "META-TITEL:" stå og blinke øverst i sin tekst.
      let metaSendt = false;
      let sendtIndtil = 0;

      /** Sender det af `samlet`, klienten endnu ikke har fået. */
      const skubTekst = () => {
        const rest = samlet.slice(sendtIndtil);
        if (!rest) return;

        sendtIndtil = samlet.length;
        harSendtTekst = true;
        controller.enqueue(linje({ slags: "tekst", tekst: rest }));
      };

      const sendMeta = (titel: string, beskrivelse: string) => {
        metaSendt = true;
        controller.enqueue(linje({ slags: "meta", titel, beskrivelse }));
      };

      // Måling, ikke gætteri. Vi skal kunne se, om tiden går med at PLANLÆGGE
      // (før første ord) eller med at SKRIVE — det er to forskellige knapper.
      // Kun tal og tidsforbrug, aldrig noget af teksten.
      const begyndt = Date.now();
      let foersteOrd: number | null = null;

      // Gemmes her og skrives i usage_log til sidst — også hvis genereringen
      // gik i stykker undervejs. Tokens er brugt, uanset om teksten blev hel.
      let forbrug: { model: string; inputTokens: number; outputTokens: number } | null =
        null;

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
            samlet += bid.tekst;

            if (metaSendt) {
              skubTekst();
            } else {
              const udtraek = udtraekMeta(samlet);

              if (udtraek.komplet) {
                sendMeta(udtraek.meta.titel, udtraek.meta.beskrivelse);
                // `krop` er en nøjagtig slutning af `samlet`, så det her er
                // præcis dét, der står før artiklen.
                sendtIndtil = samlet.length - udtraek.krop.length;
                skubTekst();
              } else if (samlet.length > META_LOFT) {
                // Modellen fulgte ikke formatet. Så viser vi det, den skrev,
                // frem for at holde en hel tekst tilbage.
                sendMeta("", "");
                skubTekst();
              }
            }
          }

          if (bid.slags === "forbrug") {
            forbrug = bid;

            const ialt = Date.now() - begyndt;
            console.log(
              `[generate] ${bid.model} · planlægning ${foersteOrd ?? ialt} ms ` +
                `· skrivning ${ialt - (foersteOrd ?? ialt)} ms · i alt ${ialt} ms ` +
                `· ${bid.inputTokens} ind / ${bid.outputTokens} ud`,
            );
          }
        }

        // Nu er teksten hel. Meta-felterne skilles fra, resten saneres, og
        // først DEN version deles i blokke og vises som HTML i browseren.
        const udtraek = udtraekMeta(samlet);
        if (!metaSendt) {
          sendMeta(udtraek.meta.titel, udtraek.meta.beskrivelse);
          skubTekst();
        }

        const html = sanerHtml(udtraek.komplet ? udtraek.krop : samlet);

        controller.enqueue(
          linje({
            slags: "faerdig",
            html,
            blokke: delIBlokke(html),
            titel: udtraek.meta.titel,
            beskrivelse: udtraek.meta.beskrivelse,
          }),
        );
      } catch (fejl) {
        // Kom der aldrig tekst ud AF DØREN, har brugeren ikke fået noget for
        // sin prøvetekst. Så giver vi den tilbage. Bemærk at det tæller de
        // tegn, klienten har fået — ikke dem, modellen nåede at skrive. Går
        // det galt, mens meta-linjerne stadig holdes tilbage, er skærmen tom,
        // og så skal kvoten også være det.
        if (!harSendtTekst && valg.betaler === "platform") {
          await frigivProeveTekst(user.id);
        }

        // Loggen må se detaljerne. Browseren får kun en kategori: rå
        // fejltekster kan indeholde dele af nøglen eller af brugerens tekst.
        console.error("Generering mislykkedes:", fejl);

        const aarsag = fejl instanceof AiFejl ? fejl.aarsag : "ukendt";
        controller.enqueue(linje({ slags: "fejl", aarsag }));
      } finally {
        // Regnskabet føres til sidst og må aldrig vælte genereringen: teksten
        // er skrevet og betalt, uanset om vi fik skrevet det ned.
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

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
