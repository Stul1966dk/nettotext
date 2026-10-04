import { z } from "zod";

import { ManglerNoegle, vaelgNoegle, AiFejl } from "@/lib/ai";
import {
  byggGennemskrivBesked,
  byggSystemprompt,
  GENNEMSKRIV_TILLAEG,
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
import { delIBlokke, type Blok } from "@/lib/tekst/blokke";
import { erFaqBlok } from "@/lib/tekst/faq";
import { tjekTal } from "@/lib/tekst/faktatjek";
import { broedtekstOrd } from "@/lib/tekst/laengde";
import { samlHtml } from "@/lib/tekst/markdown";
import { udtraekMeta } from "@/lib/tekst/meta";
import { sanerHtml } from "@/lib/tekst/saner";

/**
 * POST /api/gennemskriv — retter sproget i en færdig tekst.
 *
 * Bygget 04.10.2026. Reglerne om almindeligt dansk (SPROGREGLER i
 * lib/ai/prompt.ts) bliver ikke overholdt fuldt ud, mens modellen skriver.
 * Her får den teksten igen med én opgave: ret de sætninger, der bryder
 * reglerne, og lad resten stå. Se docs/beslutninger.md.
 *
 * Editoren kalder ruten af sig selv lige efter genereringen og før en
 * eventuel udvidelse. Den gælder alle teksttyper.
 *
 * SERVEREN STOLER IKKE PÅ SVARET. En gennemskrivning må rette ordlyd, ikke
 * indhold. Før svaret sendes tilbage, tjekkes det, at opbygningen er den
 * samme, at teksten ikke er skrumpet, og at der ikke står tal, som hverken
 * den gamle tekst eller briefen har. Holder svaret ikke, afvises det, og
 * brugeren beholder den tekst, hun har.
 *
 * Samme tjek og samme beslutning om kvoten som /api/udvid og /api/faq: det
 * koster ikke en prøvetekst at gøre en tekst færdig, brugeren allerede har
 * fået.
 */

// Hele teksten skrives en gang til, så tiden er den samme som i /api/generate.
export const maxDuration = 120;

/** Så meget af den gamle længde skal være tilbage. Pynt, der slettes, fylder. */
const MINDSTE_ANDEL = 0.8;

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
  titel: z.string().max(300),
  beskrivelse: z.string().max(600),
  stiltone: stiltoneSkema,
});

/** Har den nye tekst samme opbygning som den gamle? */
function sammeOpbygning(foer: Blok[], efter: Blok[]): boolean {
  const antal = (blokke: Blok[], slags: Blok["slags"]) =>
    blokke.filter((blok) => blok.slags === slags).length;

  return (
    antal(foer, "titel") === antal(efter, "titel") &&
    antal(foer, "sektion") === antal(efter, "sektion")
  );
}

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

  const brief = briefSkema(skabelon.input_fields).safeParse(
    anmodning.data.brief,
  );
  if (!brief.success) {
    return Response.json({ aarsag: "ugyldig_brief" }, { status: 400 });
  }

  // Spørgsmålene er skrevet i deres eget kald og bliver ikke skrevet igennem.
  // Klienten lægger dem tilbage efter artiklen.
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
    await logFejl("POST /api/gennemskriv · rate limit", fejl, {
      bruger: user.id,
    });
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

    await logFejl("POST /api/gennemskriv · nøglevalg", fejl, {
      bruger: user.id,
    });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }

  // --- (e) Det globale budgetloft ------------------------------------------
  if (valg.betaler === "platform") {
    try {
      const budget = await hentBudgetstatus();

      if (budget.tilbage <= 0) {
        console.warn(
          `[gennemskriv] Dagens budget er brugt: ${budget.brugt} af ${budget.loft} kr.`,
        );
        return Response.json({ aarsag: "budget_opbrugt" }, { status: 503 });
      }
    } catch (fejl) {
      await logFejl("POST /api/gennemskriv · budgettjek", fejl, {
        bruger: user.id,
      });
      return Response.json({ aarsag: "serverfejl" }, { status: 500 });
    }
  }

  const [tilpasning, materialer] = await Promise.all([
    hentTilpasning(),
    hentAktivtMateriale(skabelon.slug),
  ]);

  const begyndt = Date.now();

  try {
    const svar = await valg.adapter.generate({
      // Den faste del er den samme som ved genereringen og rammer derfor
      // cachen. Tillægget står efter den.
      system: byggSystemprompt(
        skabelon,
        anmodning.data.stiltone,
        materialer,
        GENNEMSKRIV_TILLAEG,
      ),
      bruger: byggGennemskrivBesked(
        skabelon.input_fields,
        brief.data,
        artikel,
        anmodning.data.titel,
        anmodning.data.beskrivelse,
        tilpasning,
      ),
      model: valg.model,
      // Samme loft som en ny tekst: svaret er hele teksten en gang til.
      maxTokens: 16000,
    });

    // Regnskabet føres, uanset hvad der kom tilbage. Tokens er brugt.
    try {
      await skrivForbrug({
        brugerId: user.id,
        skabelon: skabelon.slug,
        // Arbejde på en tekst, brugeren allerede har. Samme slags som en
        // omskrivning og en udvidelse, så loggen ikke skal have en ny
        // kategori for det.
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
      await logFejl("POST /api/gennemskriv · forbrugslog", fejl, {
        bruger: user.id,
      });
    }

    // Meta-linjerne skilles fra, og resten saneres (CLAUDE.md regel 4).
    const udtraek = udtraekMeta(svar.tekst);
    const html = sanerHtml(udtraek.komplet ? udtraek.krop : svar.tekst);
    const nye = delIBlokke(html);

    // De tre tjek. Grundlaget for tallene er den gamle tekst og briefen:
    // et tal, der står et af de to steder, har gennemskrivningen ikke
    // fundet på.
    const ordFoer = broedtekstOrd(artikel);
    const ordEfter = broedtekstOrd(nye);
    const grundlag = [samlHtml(artikel), ...Object.values(brief.data)].join(
      "\n",
    );

    const afvist = !sammeOpbygning(artikel, nye)
      ? "opbygning"
      : ordEfter < ordFoer * MINDSTE_ANDEL
        ? "laengde"
        : tjekTal(html, grundlag).length > 0
          ? "nye tal"
          : null;

    // Kun tal og tidsforbrug, aldrig noget af teksten.
    console.log(
      `[gennemskriv] ${ordFoer} ord før / ${ordEfter} efter · ` +
        `${afvist ? `AFVIST (${afvist})` : "brugt"} · ` +
        `${svar.model} · betalt af ${valg.betaler} ` +
        `· ${Date.now() - begyndt} ms · ` +
        `${svar.inputTokens} ind / ${svar.outputTokens} ud ` +
        `· cache ${svar.cacheLaest ?? 0} læst / ${svar.cacheSkrevet ?? 0} skrevet`,
    );

    if (afvist) {
      return Response.json({ aarsag: "tomt_svar" }, { status: 502 });
    }

    return Response.json({
      html: samlHtml(nye),
      // Fulgte svaret ikke formatet, beholder klienten de meta-felter, den har.
      titel: udtraek.komplet ? udtraek.meta.titel : null,
      beskrivelse: udtraek.komplet ? udtraek.meta.beskrivelse : null,
    });
  } catch (fejl) {
    await logFejl("POST /api/gennemskriv · generering", fejl, {
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
