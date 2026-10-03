import { z } from "zod";

import { ManglerNoegle, vaelgNoegle, AiFejl } from "@/lib/ai";
import { byggFaqBesked, byggSystemprompt, FAQ_TILLAEG } from "@/lib/ai/prompt";
import { hentBudgetstatus, skrivForbrug } from "@/lib/budget";
import { logFejl } from "@/lib/fejl";
import { harProeveKvote } from "@/lib/kvote";
import { hentTilpasning } from "@/lib/personalisering";
import { tagPladsIKoeen } from "@/lib/ratelimit";
import { hentSkabelon } from "@/lib/skabeloner/hent";
import { hentAktivtMateriale } from "@/lib/skabeloner/materiale";
import { stiltoneSkema } from "@/lib/skabeloner/stiltone";
import { briefSkema } from "@/lib/skabeloner/typer";
import { createClient } from "@/lib/supabase/server";
import { delIBlokke } from "@/lib/tekst/blokke";
import { erFaqBlok } from "@/lib/tekst/faq";
import { udtraekMeta } from "@/lib/tekst/meta";
import { sanerHtml } from "@/lib/tekst/saner";

/**
 * POST /api/faq — skriver afsnittet "Ofte stillede spørgsmål" til en færdig
 * tekst.
 *
 * Bygget 03.10.2026 som en knap i editoren, fordi en FAQ skrevet i samme kald
 * som artiklen tog sine ord fra brødteksten. Se FAQ_TILLAEG i
 * lib/ai/prompt.ts og docs/beslutninger.md.
 *
 * Samme tjek og samme rækkefølge som /api/regenerate-section, og samme
 * beslutning om kvoten: det KOSTER IKKE en prøvetekst at gøre en tekst
 * færdig, brugeren allerede har fået. Rate limit'en holder den enkelte i
 * skak, budgetloftet holder platformens nøgle i skak.
 *
 * KUN for teksttyper, der må bruge almen viden (migration 0029). Et afsnit
 * med spørgsmål, artiklen ikke allerede svarer på, kan ikke skrives ud fra
 * briefen alene: enten ville det gentage artiklen, eller også ville det
 * finde på noget om brugerens vare.
 *
 * Svaret er almindelig JSON, ikke en strøm. Afsnittet er kort, og det lægges
 * først ind i teksten, når det er saneret og helt.
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
  /** Brugerens egne spørgsmål, ét pr. linje. Valgfrit. */
  spoergsmaal: z.string().max(1000).optional(),
  stiltone: stiltoneSkema,
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

  // Knappen findes kun på de teksttyper, der må bruge almen viden. Et kald
  // til en anden er en gammel fane eller nogen, der prøver sig frem.
  if (!skabelon.general_knowledge) {
    return Response.json({ aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  const brief = briefSkema(skabelon.input_fields).safeParse(
    anmodning.data.brief,
  );
  if (!brief.success) {
    return Response.json({ aarsag: "ugyldig_brief" }, { status: 400 });
  }

  // Har teksten allerede et afsnit med spørgsmål, skal det nye ikke skrives
  // uden om det gamle. Det tages ud her, så klienten ikke kan glemme det.
  const artikel = anmodning.data.blokke.filter((blok) => !erFaqBlok(blok));
  if (artikel.length === 0) {
    return Response.json({ aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  // --- (c) Rate limit ------------------------------------------------------
  try {
    if (!(await tagPladsIKoeen(user.id))) {
      return Response.json({ aarsag: "for_mange_kald" }, { status: 429 });
    }
  } catch (fejl) {
    await logFejl("POST /api/faq · rate limit", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (d) Hvem betaler? ---------------------------------------------------
  // Kvoten læses og trækkes ikke, som ved omskrivning af et afsnit.
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

    await logFejl("POST /api/faq · nøglevalg", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (e) Det globale budgetloft ------------------------------------------
  if (valg.betaler === "platform") {
    try {
      const budget = await hentBudgetstatus();

      if (budget.tilbage <= 0) {
        console.warn(
          `[faq] Dagens budget er brugt: ${budget.brugt} af ${budget.loft} kr.`,
        );
        return Response.json({ aarsag: "budget_opbrugt" }, { status: 503 });
      }
    } catch (fejl) {
      await logFejl("POST /api/faq · budgettjek", fejl, { bruger: user.id });
      return Response.json({ aarsag: "serverfejl" }, { status: 500 });
    }
  }

  // Samme personalisering og samme materiale som artiklen, så afsnittet
  // lyder som resten.
  const [tilpasning, materialer] = await Promise.all([
    hentTilpasning(),
    hentAktivtMateriale(skabelon.slug),
  ]);

  const begyndt = Date.now();

  try {
    const svar = await valg.adapter.generate({
      // Den faste del er den samme som ved genereringen af artiklen og
      // rammer derfor cachen. Tillægget står efter den.
      system: byggSystemprompt(
        skabelon,
        anmodning.data.stiltone,
        materialer,
        FAQ_TILLAEG,
      ),
      bruger: byggFaqBesked(
        skabelon.input_fields,
        brief.data,
        artikel,
        anmodning.data.spoergsmaal ?? "",
        tilpasning,
      ),
      model: valg.model,
      // Fem korte svar, plus den tid modellen bruger på at planlægge.
      maxTokens: 4000,
    });

    console.log(
      `[faq] ${svar.model} · betalt af ${valg.betaler} ` +
        `· ${Date.now() - begyndt} ms · ` +
        `${svar.inputTokens} ind / ${svar.outputTokens} ud ` +
        `· cache ${svar.cacheLaest ?? 0} læst / ${svar.cacheSkrevet ?? 0} skrevet`,
    );

    // Regnskabet føres, uanset hvad der kom tilbage. Tokens er brugt.
    try {
      await skrivForbrug({
        brugerId: user.id,
        skabelon: skabelon.slug,
        // Et afsnit til en tekst, brugeren allerede har. Samme slags som en
        // omskrivning, så loggen ikke skal have en ny kategori for det.
        slags: "afsnit",
        leverandoer: valg.adapter.leverandoer,
        model: svar.model,
        betaler: valg.betaler,
        inputTokens: svar.inputTokens,
        outputTokens: svar.outputTokens,
        cacheSkrevet: svar.cacheSkrevet,
        cacheLaest: svar.cacheLaest,
      });
    } catch (fejl) {
      await logFejl("POST /api/faq · forbrugslog", fejl, { bruger: user.id });
    }

    // Alt før det første < smides væk, og resten saneres (CLAUDE.md regel 4).
    const udtraek = udtraekMeta(svar.tekst);
    const html = sanerHtml(udtraek.komplet ? udtraek.krop : svar.tekst);

    // Svaret skal være ÉT afsnit, der begynder med sin h2. Kom der en titel,
    // en indledning eller to afsnit, er det ikke det, der blev bedt om, og
    // så lægges der hellere ingenting ind end noget, der flytter rundt på
    // brugerens tekst.
    const dele = delIBlokke(html);

    if (dele.length !== 1 || !erFaqBlok(dele[0])) {
      return Response.json({ aarsag: "tomt_svar" }, { status: 502 });
    }

    return Response.json({ html: dele[0].html });
  } catch (fejl) {
    await logFejl("POST /api/faq · generering", fejl, {
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
