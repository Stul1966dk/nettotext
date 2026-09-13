import { z } from "zod";

import { ManglerNoegle, vaelgNoegle, AiFejl, billigsteModel } from "@/lib/ai";
import { byggFaktaBesked, FAKTA_SYSTEM } from "@/lib/ai/prompt";
import { hentBudgetstatus, skrivForbrug } from "@/lib/budget";
import { logFejl } from "@/lib/fejl";
import { harProeveKvote } from "@/lib/kvote";
import { tagPladsIKoeen } from "@/lib/ratelimit";
import { hentSkabelon } from "@/lib/skabeloner/hent";
import { findFaktafelt } from "@/lib/skabeloner/typer";
import { udtraekFakta } from "@/lib/tekst/fakta";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/fakta — en indsat specifikation bliver til en liste med
 * oplysninger, brugeren kan bruge i sin brief.
 *
 * BEMÆRK HVAD RUTEN IKKE GØR: den henter ingenting. Der er ingen adresse i
 * anmodningen, og serveren går aldrig på nettet. Teksten er noget, brugeren
 * selv har kopieret og indsat. Det er dét, der holder funktionen fri af
 * ophavsretten og af robots.txt, betalingsmure og SSRF — se
 * docs/beslutninger.md 13.09.2026. Skulle nogen senere få den idé at lade
 * ruten tage imod en adresse, er det ikke en lille udvidelse: det er en
 * anden funktion med en anden juridisk vurdering bag.
 *
 * Kaldet koster penge og går derfor gennem de samme tjek som resten
 * (CLAUDE.md regel 6), med de samme to undtagelser som /api/ideas:
 *
 * 1. Det KOSTER IKKE en prøvetekst. Kvoten læses, den trækkes ikke. At rydde
 *    op i sin egen brief er ikke at skrive en tekst.
 * 2. Der bruges den BILLIGSTE model hos leverandøren. Opgaven er at finde tal
 *    i et stykke tekst, ikke at skrive godt dansk.
 *
 * Grænsen for kald i minuttet deles med genereringen: tre i alt.
 *
 * Svaret er almindelig JSON. Der er ikke noget at streame — listen er kort,
 * og en liste, der popper op halvt skrevet, er sværere at læse.
 */

// Samme loft som idéforslagene. Tager udtrækket længere end et halvt minut,
// er noget galt, og brugeren skal have besked frem for at vente.
export const maxDuration = 30;

/**
 * Hvor meget der må indsættes ad gangen.
 *
 * Et datablad eller en produktside fylder typisk et par tusinde tegn. Loftet
 * er sat, så en hel artikel ikke kan sendes af sted: det ville koste mere,
 * give en dårligere liste, og det ville flytte funktionen fra "træk tallene
 * ud af en specifikation" til "sammenfat en tekst, en anden har skrevet" —
 * og dét er en anden opgave, både fagligt og juridisk.
 */
const TEKST_MAX = 8000;

const anmodningSkema = z.object({
  skabelon: z.string().min(1).max(64),
  /** Feltet, listen skal ende i. Skal bære flaget `faktafelt`. */
  felt: z.string().min(1).max(64),
  tekst: z.string().min(1).max(TEKST_MAX),
});

export async function POST(request: Request) {
  // --- (a) Logget ind? -----------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ aarsag: "ikke_logget_ind" }, { status: 401 });
  }

  // --- (b) Gyldig anmodning? -----------------------------------------------
  let raa: unknown;
  try {
    raa = await request.json();
  } catch {
    return Response.json({ aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  const anmodning = anmodningSkema.safeParse(raa);
  if (!anmodning.success) {
    // For meget indsat er den fejl, brugeren faktisk vil ramme. Den fortjener
    // sin egen besked, så hun ved, hvad hun skal gøre ved det.
    const indsat = (raa as { tekst?: unknown } | null)?.tekst;
    const forLang = typeof indsat === "string" && indsat.length > TEKST_MAX;

    return Response.json(
      { aarsag: forLang ? "for_lang_tekst" : "ugyldig_anmodning" },
      { status: 400 },
    );
  }

  const skabelon = await hentSkabelon(anmodning.data.skabelon);
  if (!skabelon) {
    return Response.json({ aarsag: "ukendt_skabelon" }, { status: 404 });
  }

  // Knappen findes kun ved et felt med flaget. Et kald til et andet felt er
  // enten en gammel fane eller nogen, der prøver sig frem — og i begge
  // tilfælde er der ikke noget sted at lægge listen.
  const faktafelt = findFaktafelt(skabelon.input_fields);

  if (!faktafelt || faktafelt.navn !== anmodning.data.felt) {
    return Response.json({ aarsag: "intet_faktafelt" }, { status: 400 });
  }

  // --- (c) Grænsen for kald i minuttet -------------------------------------
  try {
    if (!(await tagPladsIKoeen(user.id))) {
      return Response.json({ aarsag: "for_mange_kald" }, { status: 429 });
    }
  } catch (fejl) {
    await logFejl("POST /api/fakta · rate limit", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (d) Hvem betaler? ---------------------------------------------------
  // Kvoten LÆSES. Har brugeren prøvetekster tilbage, betaler platformen for
  // udtrækket, uden at nogen af dem bliver brugt.
  let valg;
  try {
    valg = await vaelgNoegle(user.id, await harProeveKvote(user.id));
  } catch (fejl) {
    if (fejl instanceof ManglerNoegle) {
      return Response.json({ aarsag: "mangler_noegle" }, { status: 402 });
    }

    if (fejl instanceof AiFejl) {
      return Response.json({ aarsag: fejl.aarsag }, { status: 400 });
    }

    await logFejl("POST /api/fakta · nøglevalg", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (e) Det globale budgetloft ------------------------------------------
  if (valg.betaler === "platform") {
    try {
      const budget = await hentBudgetstatus();

      if (budget.tilbage <= 0) {
        console.warn(
          `[fakta] Dagens budget er brugt: ${budget.brugt} af ${budget.loft} kr.`,
        );
        return Response.json({ aarsag: "budget_opbrugt" }, { status: 503 });
      }
    } catch (fejl) {
      await logFejl("POST /api/fakta · budgettjek", fejl, { bruger: user.id });
      return Response.json({ aarsag: "serverfejl" }, { status: 500 });
    }
  }

  const model = billigsteModel(valg.adapter.leverandoer) ?? valg.model;
  const begyndt = Date.now();

  try {
    const svar = await valg.adapter.generate({
      system: FAKTA_SYSTEM,
      bruger: byggFaktaBesked(faktafelt.label, anmodning.data.tekst),
      model,
      // 25 korte linjer. Rundhåndet nok til at den sidste ikke klippes over,
      // lavt nok til at stoppe en model, der begynder at skrive en tekst.
      maxTokens: 1500,
    });

    console.log(
      `[fakta] ${svar.model} · betalt af ${valg.betaler} ` +
        `· ${Date.now() - begyndt} ms · ` +
        `${svar.inputTokens} ind / ${svar.outputTokens} ud`,
    );

    // Regnskabet føres, uanset hvad der kom tilbage. Tokens er brugt, også
    // hvis modellen svarede i et format, vi ikke kunne læse.
    try {
      await skrivForbrug({
        brugerId: user.id,
        skabelon: skabelon.slug,
        slags: "fakta",
        leverandoer: valg.adapter.leverandoer,
        model: svar.model,
        betaler: valg.betaler,
        inputTokens: svar.inputTokens,
        outputTokens: svar.outputTokens,
      });
    } catch (fejl) {
      await logFejl("POST /api/fakta · forbrugslog", fejl, { bruger: user.id });
    }

    const fakta = udtraekFakta(svar.tekst);

    if (fakta.length === 0) {
      // Enten svarede modellen INGEN, eller også kunne vi ikke læse svaret.
      // Brugeren skal have at vide, at der ikke kom noget — ikke se et felt,
      // der stille og roligt blev ved med at være tomt.
      return Response.json({ aarsag: "ingen_fakta" }, { status: 422 });
    }

    return Response.json({ fakta });
  } catch (fejl) {
    // Loggen må se detaljerne; browseren får kun en kategori. Rå fejltekster
    // kan indeholde dele af nøglen eller af den indsatte tekst.
    await logFejl("POST /api/fakta · faktaudtræk", fejl, {
      bruger: user.id,
      ekstra: {
        skabelon: skabelon.slug,
        leverandoer: valg.adapter.leverandoer,
      },
    });

    const aarsag = fejl instanceof AiFejl ? fejl.aarsag : "ukendt";
    return Response.json({ aarsag }, { status: 502 });
  }
}
