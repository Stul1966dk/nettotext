import { z } from "zod";

import { ManglerNoegle, vaelgNoegle, AiFejl, billigsteModel } from "@/lib/ai";
import { byggIdeBesked, IDE_SYSTEM } from "@/lib/ai/prompt";
import { hentBudgetstatus, skrivForbrug } from "@/lib/budget";
import { logFejl } from "@/lib/fejl";
import { harProeveKvote } from "@/lib/kvote";
import { hentTilpasning, profilErTom } from "@/lib/personalisering";
import { tagPladsIKoeen } from "@/lib/ratelimit";
import { hentSkabelon } from "@/lib/skabeloner/hent";
import { delvisBriefSkema, findIdefelt } from "@/lib/skabeloner/typer";
import { udtraekIdeer } from "@/lib/tekst/ideer";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ideas — fem forslag til, hvad teksten kan handle om.
 *
 * Ruten koster penge og går derfor gennem de samme tjek som resten
 * (CLAUDE.md regel 6), med to forskelle fra /api/generate:
 *
 * 1. Det KOSTER IKKE en prøvetekst. Kvoten læses, den trækkes ikke — samme
 *    valg som ved omskrivning af ét afsnit. Et forslag er ikke en tekst, og
 *    en bruger, der brænder en af sine fem prøvetekster af på at kigge på en
 *    liste, prøver aldrig produktet.
 * 2. Der bruges den BILLIGSTE model hos leverandøren, ikke brugerens valgte.
 *    Fem linjer med emner har ikke brug for husets bedste sprog.
 *
 * Rate limit'en er til gengæld den samme og deles med genereringen: tre kald
 * i minuttet i alt. Uden det ville knappen her være vejen udenom.
 *
 * Svaret er almindelig JSON og ikke NDJSON. Der er ikke noget at streame —
 * fem linjer kommer på én gang, og en liste, der popper op halvt skrevet, er
 * sværere at læse, ikke lettere.
 */

// Kortere end genereringen. Kommer der ikke fem linjer på et halvt minut, er
// noget galt, og så skal brugeren have besked frem for at vente.
export const maxDuration = 30;

const anmodningSkema = z.object({
  skabelon: z.string().min(1).max(64),
  /** Briefen som den ser ud lige nu. Alt er valgfrit — se delvisBriefSkema. */
  brief: z.record(z.string(), z.string()),
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
    return Response.json({ aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  const skabelon = await hentSkabelon(anmodning.data.skabelon);
  if (!skabelon) {
    return Response.json({ aarsag: "ukendt_skabelon" }, { status: 404 });
  }

  // Har teksttypen slet ikke noget idéfelt, findes knappen ikke i formularen.
  // Så er et kald hertil enten en gammel fane eller nogen, der prøver sig
  // frem — og i begge tilfælde er der ikke noget at fylde forslagene ind i.
  if (!findIdefelt(skabelon.input_fields)) {
    return Response.json({ aarsag: "ingen_ideer" }, { status: 400 });
  }

  const brief = delvisBriefSkema(skabelon.input_fields).safeParse(
    anmodning.data.brief,
  );
  if (!brief.success) {
    return Response.json({ aarsag: "ugyldig_brief" }, { status: 400 });
  }

  // --- Er der overhovedet noget at foreslå ud fra? -------------------------
  // Står både briefen og brand-profilen tomme, ved modellen intet om
  // virksomheden, og fem forslag ville være fem gæt om branchen. Så er det
  // ærligere — og billigere — at sige det end at bruge penge på at gætte.
  const tilpasning = await hentTilpasning();
  const noget = Object.values(brief.data).some((v) => v.trim().length > 0);
  const kenderVirksomheden =
    tilpasning.brand !== null && !profilErTom(tilpasning.brand);

  if (!noget && !kenderVirksomheden) {
    return Response.json({ aarsag: "mangler_grundlag" }, { status: 400 });
  }

  // --- (c) Rate limit ------------------------------------------------------
  try {
    if (!(await tagPladsIKoeen(user.id))) {
      return Response.json({ aarsag: "for_mange_kald" }, { status: 429 });
    }
  } catch (fejl) {
    await logFejl("POST /api/ideas · rate limit", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (d) Hvem betaler? ---------------------------------------------------
  // Kvoten LÆSES. Har brugeren prøvetekster tilbage, betaler platformen for
  // forslagene, uden at nogen af dem bliver brugt.
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

    await logFejl("POST /api/ideas · nøglevalg", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (e) Det globale budgetloft ------------------------------------------
  if (valg.betaler === "platform") {
    try {
      const budget = await hentBudgetstatus();

      if (budget.tilbage <= 0) {
        console.warn(
          `[ideer] Dagens budget er brugt: ${budget.brugt} af ${budget.loft} kr.`,
        );
        return Response.json({ aarsag: "budget_opbrugt" }, { status: 503 });
      }
    } catch (fejl) {
      await logFejl("POST /api/ideas · budgettjek", fejl, { bruger: user.id });
      return Response.json({ aarsag: "serverfejl" }, { status: 500 });
    }
  }

  // Den billigste model hos DEN leverandør, nøglevalget landede på. Kender vi
  // ingen priser hos leverandøren, bruges den model, nøglevalget fandt — en
  // model uden pris er et problem for budgetloftet, ikke for forslagene.
  const model = billigsteModel(valg.adapter.leverandoer) ?? valg.model;

  const begyndt = Date.now();

  try {
    const svar = await valg.adapter.generate({
      system: IDE_SYSTEM,
      bruger: byggIdeBesked(
        skabelon.name,
        skabelon.input_fields,
        brief.data,
        tilpasning,
      ),
      model,
      // Fem korte linjer. Loftet er sat rundhåndet nok til, at den femte linje
      // aldrig bliver klippet over, og lavt nok til at en model, der begynder
      // at skrive en artikel i stedet, bliver stoppet.
      maxTokens: 1000,
    });

    console.log(
      `[ideer] ${svar.model} · betalt af ${valg.betaler} ` +
        `· ${Date.now() - begyndt} ms · ` +
        `${svar.inputTokens} ind / ${svar.outputTokens} ud`,
    );

    // Regnskabet føres, uanset hvad der kom tilbage. Tokens er brugt, også
    // hvis modellen svarede i et format, vi ikke kunne læse.
    try {
      await skrivForbrug({
        brugerId: user.id,
        skabelon: skabelon.slug,
        slags: "ideer",
        leverandoer: valg.adapter.leverandoer,
        model: svar.model,
        betaler: valg.betaler,
        inputTokens: svar.inputTokens,
        outputTokens: svar.outputTokens,
      });
    } catch (fejl) {
      await logFejl("POST /api/ideas · forbrugslog", fejl, { bruger: user.id });
    }

    const ideer = udtraekIdeer(svar.tekst);

    if (ideer.length === 0) {
      // Modellen svarede i et format, vi ikke kunne læse. Brugeren skal have
      // en besked, hun kan handle på — ikke en tom liste, der ligner en fejl
      // i hendes browser.
      console.warn("[ideer] Ingen linjer kunne læses ud af svaret.");
      return Response.json({ aarsag: "tomt_svar" }, { status: 502 });
    }

    return Response.json({ ideer });
  } catch (fejl) {
    // Loggen må se detaljerne; browseren får kun en kategori. Rå fejltekster
    // kan indeholde dele af nøglen eller af brugerens brief.
    await logFejl("POST /api/ideas · idéforslag", fejl, {
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
