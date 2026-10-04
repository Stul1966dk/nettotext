import { z } from "zod";

import { ManglerNoegle, vaelgNoegle, AiFejl } from "@/lib/ai";
import {
  byggSprogretBesked,
  byggSystemprompt,
  SPROGRET_TILLAEG,
} from "@/lib/ai/prompt";
import { hentBudgetstatus, skrivForbrug } from "@/lib/budget";
import { logFejl } from "@/lib/fejl";
import { harProeveKvote } from "@/lib/kvote";
import { tagPladsIKoeen } from "@/lib/ratelimit";
import { hentSkabelon } from "@/lib/skabeloner/hent";
import { hentAktivtMateriale } from "@/lib/skabeloner/materiale";
import { stiltoneSkema } from "@/lib/skabeloner/stiltone";
import { briefSkema } from "@/lib/skabeloner/typer";
import { createClient } from "@/lib/supabase/server";
import { erFaqBlok } from "@/lib/tekst/faq";
import { tjekTal } from "@/lib/tekst/faktatjek";
import { samlHtml } from "@/lib/tekst/markdown";
import { sanerHtml } from "@/lib/tekst/saner";
import { findSprogfund, tilHtml, type Sprogfund } from "@/lib/tekst/sprogtjek";

/**
 * POST /api/gennemskriv — retter sproget i en færdig tekst.
 *
 * Bygget 04.10.2026. Reglerne om almindeligt dansk (SPROGREGLER i
 * lib/ai/prompt.ts) bliver ikke overholdt fuldt ud, mens modellen skriver.
 * Her bliver de sætninger, der bryder reglerne, rettet bagefter. Se
 * docs/beslutninger.md.
 *
 * KODEN FINDER, MODELLEN RETTER, KODEN SÆTTER IND.
 *   1. lib/tekst/sprogtjek.ts finder de sætninger og overskrifter, der ser
 *      ud til at bryde en regel. Er der ingen, svarer ruten uden at bruge
 *      penge og uden at tage en plads i køen.
 *   2. Modellen får listen og svarer med én linje pr. nummer: en ny sætning,
 *      OK eller SLET.
 *   3. Rettelserne sættes ind her. Resten af teksten kan ikke blive ændret,
 *      for modellen har aldrig skrevet den.
 *
 * Hver rettelse tjekkes for sig: den må ikke indeholde HTML, ikke være
 * meget længere end den gamle sætning og ikke indeholde tal, som hverken
 * teksten eller briefen har. En rettelse, der ikke holder, bliver sprunget
 * over, og den gamle sætning bliver stående.
 *
 * Editoren kalder ruten af sig selv lige efter genereringen og før en
 * eventuel udvidelse. Den gælder alle teksttyper.
 *
 * Samme tjek og samme beslutning om kvoten som /api/udvid og /api/faq: det
 * koster ikke en prøvetekst at gøre en tekst færdig, brugeren allerede har
 * fået.
 */

export const maxDuration = 60;

/** Grænserne fra outputformatet. Se outputformat() i lib/ai/prompt.ts. */
const TITEL_LOFT = 60;
const BESKRIVELSE_LOFT = 160;

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

/** Modellens svar: nummer i kantede parenteser, derefter teksten. */
const SVARLINJE = /^\s*\[(\d+)\]\s*(.+?)\s*$/;

/**
 * Må den nye tekst sættes ind i stedet for den gamle?
 *
 * `grundlag` er hele den gamle tekst og briefen. Et tal, der står et af de
 * to steder, har rettelsen ikke fundet på.
 */
function holder(enhed: Sprogfund, ny: string, grundlag: string): boolean {
  if (!ny || ny.includes("<")) return false;
  if (ny.length > enhed.tekst.length * 2 + 60) return false;
  if (enhed.slags === "meta-titel" && ny.length > TITEL_LOFT) return false;
  if (enhed.slags === "meta-beskrivelse" && ny.length > BESKRIVELSE_LOFT) {
    return false;
  }

  return tjekTal(tilHtml(ny), grundlag).length === 0;
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

  // Spørgsmålene er skrevet i deres eget kald og bliver ikke rettet her.
  // Klienten lægger dem tilbage efter artiklen.
  const artikel = anmodning.data.blokke.filter((blok) => !erFaqBlok(blok));
  if (artikel.length === 0) {
    return Response.json({ aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  // Koden leder selv. Er der ikke noget at rette, svares der, FØR der tages
  // en plads i køen eller bruges en krone.
  const fund = findSprogfund(
    artikel,
    anmodning.data.titel,
    anmodning.data.beskrivelse,
  );

  if (fund.length === 0) {
    return Response.json({
      html: "",
      titel: null,
      beskrivelse: null,
      fund: 0,
      rettet: 0,
    });
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

  const materialer = await hentAktivtMateriale(skabelon.slug);

  const begyndt = Date.now();

  try {
    const svar = await valg.adapter.generate({
      // Den faste del er den samme som ved genereringen og rammer derfor
      // cachen. Tillægget står efter den.
      system: byggSystemprompt(
        skabelon,
        anmodning.data.stiltone,
        materialer,
        SPROGRET_TILLAEG,
      ),
      bruger: byggSprogretBesked(artikel, fund),
      model: valg.model,
      // Højst 40 sætninger, plus den tid modellen bruger på at planlægge.
      maxTokens: 6000,
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

    const grundlag = [samlHtml(artikel), ...Object.values(brief.data)].join(
      "\n",
    );

    // Rettelserne sættes ind én for én. Blokkene kopieres, så anmodningens
    // egne ikke bliver ændret undervejs.
    const blokke = artikel.map((blok) => ({ ...blok }));
    let titel: string | null = null;
    let beskrivelse: string | null = null;
    let rettet = 0;
    let sprunget = 0;

    for (const linje of svar.tekst.split("\n")) {
      const fundet = linje.match(SVARLINJE);
      if (!fundet) continue;

      const enhed = fund[Number(fundet[1]) - 1];
      const ny = fundet[2];
      if (!enhed || ny === "OK") continue;

      if (enhed.slags === "meta-titel" || enhed.slags === "meta-beskrivelse") {
        if (ny === "SLET" || !holder(enhed, ny, grundlag)) {
          sprunget++;
          continue;
        }

        if (enhed.slags === "meta-titel") titel = ny;
        else beskrivelse = ny;
        rettet++;
        continue;
      }

      const blok = enhed.blok === null ? undefined : blokke[enhed.blok];
      const sted = blok ? blok.html.indexOf(enhed.raa) : -1;

      // Sætningen findes ikke længere, typisk fordi en tidligere rettelse i
      // samme afsnit har flyttet på den.
      if (!blok || sted === -1) {
        sprunget++;
        continue;
      }

      const foer = blok.html.slice(0, sted);
      const efter = blok.html.slice(sted + enhed.raa.length);

      if (ny === "SLET") {
        // Kun sætninger kan slettes. Mellemrummet efter sætningen går med,
        // og et afsnit, der bliver tomt, forsvinder.
        if (enhed.slags !== "saetning") {
          sprunget++;
          continue;
        }

        blok.html = (foer + efter.replace(/^\s+/, "")).replace(
          /<p>\s*<\/p>/g,
          "",
        );
        rettet++;
        continue;
      }

      if (!holder(enhed, ny, grundlag)) {
        sprunget++;
        continue;
      }

      blok.html = foer + tilHtml(ny) + efter;
      rettet++;
    }

    // Kun tal og tidsforbrug, aldrig noget af teksten.
    console.log(
      `[gennemskriv] ${fund.length} fund · ${rettet} rettet · ${sprunget} sprunget over ` +
        `· ${svar.model} · betalt af ${valg.betaler} ` +
        `· ${Date.now() - begyndt} ms · ` +
        `${svar.inputTokens} ind / ${svar.outputTokens} ud ` +
        `· cache ${svar.cacheLaest ?? 0} læst / ${svar.cacheSkrevet ?? 0} skrevet`,
    );

    return Response.json({
      // Saneres igen (CLAUDE.md regel 4): der er sat tekst fra modellen ind.
      html: rettet > 0 ? sanerHtml(samlHtml(blokke)) : "",
      titel,
      beskrivelse,
      fund: fund.length,
      rettet,
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
