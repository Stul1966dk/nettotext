import { z } from "zod";

import { ManglerNoegle, vaelgNoegle, AiFejl } from "@/lib/ai";
import {
  byggSystemprompt,
  byggUdvidBesked,
  udvidTillaeg,
} from "@/lib/ai/prompt";
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
import {
  broedtekstOrd,
  laengdemaal,
  manglendeAfsnit,
} from "@/lib/tekst/laengde";
import { samlHtml } from "@/lib/tekst/markdown";
import { udtraekMeta } from "@/lib/tekst/meta";
import { sanerHtml } from "@/lib/tekst/saner";

/**
 * POST /api/udvid — lægger flere afsnit til en artikel, der blev kortere end
 * det, brugeren valgte.
 *
 * Bygget 03.10.2026. Ti test viste, at modellen ikke følger et ordantal i en
 * instruks: samme brief gav mellem 750 og 1.150 ord. Længden styres derfor
 * HER, af et tal koden selv regner ud: ordene tælles, målet læses af
 * valgmulighedens egen tekst, og modellen får bestilt et bestemt antal afsnit.
 * Se lib/tekst/laengde.ts og docs/beslutninger.md.
 *
 * SERVEREN REGNER SELV. Editoren kender også målet og ved, hvornår den skal
 * kalde, men antallet af afsnit kommer aldrig fra browseren. Er teksten lang
 * nok, svarer ruten uden at bruge penge og uden at tage en plads i køen.
 *
 * Samme tjek og samme beslutning om kvoten som /api/regenerate-section og
 * /api/faq: det koster ikke en prøvetekst at gøre en tekst færdig, brugeren
 * allerede har fået.
 *
 * KUN for teksttyper, der må bruge almen viden (migration 0029). En tekst,
 * der kun må bygge på briefen, kan ikke gøres længere uden at finde på noget.
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

  // Kun teksttyper, der må bruge almen viden, bliver udvidet. Et kald til en
  // anden er en gammel fane eller nogen, der prøver sig frem.
  if (!skabelon.general_knowledge) {
    return Response.json({ aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  const brief = briefSkema(skabelon.input_fields).safeParse(
    anmodning.data.brief,
  );
  if (!brief.success) {
    return Response.json({ aarsag: "ugyldig_brief" }, { status: 400 });
  }

  // Spørgsmålene hører ikke til brødteksten og skal hverken tælles med
  // eller skrives om.
  const artikel = anmodning.data.blokke.filter((blok) => !erFaqBlok(blok));
  if (artikel.length === 0) {
    return Response.json({ aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  // Målet og antallet regnes ud her. Har teksttypen intet mål for den valgte
  // længde, eller er teksten lang nok, er der ikke noget at gøre — og det
  // svares der, FØR der tages en plads i køen eller bruges en krone.
  const mindst = laengdemaal(skabelon.input_fields)[brief.data.laengde ?? ""];
  const ord = broedtekstOrd(artikel);
  const antal = mindst ? manglendeAfsnit(ord, mindst) : 0;

  if (antal === 0) {
    return Response.json({ html: "", antal: 0 });
  }

  // --- (c) Rate limit ------------------------------------------------------
  try {
    if (!(await tagPladsIKoeen(user.id))) {
      return Response.json({ aarsag: "for_mange_kald" }, { status: 429 });
    }
  } catch (fejl) {
    await logFejl("POST /api/udvid · rate limit", fejl, { bruger: user.id });
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

    await logFejl("POST /api/udvid · nøglevalg", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (e) Det globale budgetloft ------------------------------------------
  if (valg.betaler === "platform") {
    try {
      const budget = await hentBudgetstatus();

      if (budget.tilbage <= 0) {
        console.warn(
          `[udvid] Dagens budget er brugt: ${budget.brugt} af ${budget.loft} kr.`,
        );
        return Response.json({ aarsag: "budget_opbrugt" }, { status: 503 });
      }
    } catch (fejl) {
      await logFejl("POST /api/udvid · budgettjek", fejl, { bruger: user.id });
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
        udvidTillaeg(antal),
      ),
      bruger: byggUdvidBesked(
        skabelon.input_fields,
        brief.data,
        artikel,
        antal,
        tilpasning,
      ),
      model: valg.model,
      // Højst fire afsnit på 200 ord, plus den tid modellen bruger på at
      // planlægge.
      maxTokens: 6000,
    });

    console.log(
      `[udvid] ${ord} ord af ${mindst} · ${antal} afsnit bestilt · ` +
        `${svar.model} · betalt af ${valg.betaler} ` +
        `· ${Date.now() - begyndt} ms · ` +
        `${svar.inputTokens} ind / ${svar.outputTokens} ud ` +
        `· cache ${svar.cacheLaest ?? 0} læst / ${svar.cacheSkrevet ?? 0} skrevet`,
    );

    // Regnskabet føres, uanset hvad der kom tilbage. Tokens er brugt.
    try {
      await skrivForbrug({
        brugerId: user.id,
        skabelon: skabelon.slug,
        // Afsnit til en tekst, brugeren allerede har. Samme slags som en
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
      await logFejl("POST /api/udvid · forbrugslog", fejl, { bruger: user.id });
    }

    // Alt før det første < smides væk, og resten saneres (CLAUDE.md regel 4).
    const udtraek = udtraekMeta(svar.tekst);
    const html = sanerHtml(udtraek.komplet ? udtraek.krop : svar.tekst);

    // Svaret skal være afsnit og intet andet. En titel, en indledning eller
    // et afsnit med spørgsmål er ikke det, der blev bestilt, og de sorteres
    // fra frem for at flytte rundt på brugerens tekst.
    const nye = delIBlokke(html).filter(
      (blok) => blok.slags === "sektion" && !erFaqBlok(blok),
    );

    if (nye.length === 0) {
      return Response.json({ aarsag: "tomt_svar" }, { status: 502 });
    }

    return Response.json({ html: samlHtml(nye), antal: nye.length });
  } catch (fejl) {
    await logFejl("POST /api/udvid · generering", fejl, {
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
