import { z } from "zod";

import { modelErValgbar } from "@/lib/ai/modeller";
import { AiFejl, LEVERANDOERER } from "@/lib/ai/typer";
import {
  gemNoegle,
  hentNoegleTilBrug,
  markerValideret,
  noegleMatcherLeverandoer,
  opdaterModel,
  sletNoegle,
  testNoegle,
} from "@/lib/ainoegler";
import { tagPladsIKoeen } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";

/**
 * POST og DELETE /api/keys — brugerens egen AI-nøgle.
 *
 * Tre handlinger på POST:
 *   gem   — tester nøglen og gemmer den krypteret, hvis den virker
 *   test  — prøver den gemte nøgle af igen ("Test forbindelsen")
 *   model — skifter model uden at bede om nøglen igen
 *
 * Nøglen kommer ind gennem denne rute og forlader den ALDRIG igen. Svarene
 * herfra indeholder aldrig nøglen, aldrig dele af den, og aldrig
 * leverandørens rå fejltekst — den kan indeholde begge dele.
 */

const gemSkema = z.object({
  handling: z.literal("gem"),
  leverandoer: z.enum(LEVERANDOERER),
  model: z.string().min(1).max(64),
  // Længden er et værn mod at bruge feltet som lager, ikke en formkontrol.
  // Leverandørerne skifter nøgleformat oftere, end vi opdager det.
  noegle: z.string().trim().min(20).max(300).regex(/^\S+$/),
});

const testSkema = z.object({ handling: z.literal("test") });

const modelSkema = z.object({
  handling: z.literal("model"),
  model: z.string().min(1).max(64),
});

const anmodningSkema = z.discriminatedUnion("handling", [
  gemSkema,
  testSkema,
  modelSkema,
]);

function fejl(aarsag: string, status: number) {
  return Response.json({ slags: "fejl", aarsag }, { status });
}

/**
 * Oversætter en AiFejl til noget, klienten kan vise på dansk.
 *
 * `message` bruges ikke — kun `aarsag`. Se AiFejl i lib/ai/typer.ts.
 */
function fraLeverandoeren(f: AiFejl) {
  // Ugyldig nøgle og tom saldo er brugerens at rette; resten er ikke.
  const status = f.aarsag === "ugyldig_noegle" ? 400 : 502;
  return fejl(f.aarsag, status);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fejl("ikke_logget_ind", 401);

  let raa: unknown;
  try {
    raa = await request.json();
  } catch {
    return fejl("ugyldig_anmodning", 400);
  }

  const anmodning = anmodningSkema.safeParse(raa);
  if (!anmodning.success) return fejl("ugyldig_anmodning", 400);

  // Modelskiftet rører ingen leverandør og koster ingenting. Klaret først,
  // så det ikke bruger en plads i køen.
  if (anmodning.data.handling === "model") {
    const info = await hentNoegleTilBrug(user.id);
    if (!info) return fejl("ingen_noegle", 400);

    if (!modelErValgbar(info.leverandoer, anmodning.data.model)) {
      return fejl("ugyldig_anmodning", 400);
    }

    try {
      await opdaterModel(user.id, anmodning.data.model);
    } catch (f) {
      console.error("Kunne ikke skifte model:", f);
      return fejl("serverfejl", 500);
    }

    return Response.json({ slags: "opdateret" });
  }

  /*
    De to øvrige handlinger sender et rigtigt kald af sted til leverandøren
    og koster derfor penge — brugerens egne, men penge. Rate limiten fra
    CLAUDE.md regel 6 gælder også her: den beskytter både hendes konto mod
    et klik-løb og os mod at blive brugt til at gætte nøgler af sted mod
    Anthropic.
  */
  let pladsIKoeen: boolean;
  try {
    pladsIKoeen = await tagPladsIKoeen(user.id);
  } catch (f) {
    console.error("Kunne ikke tjekke rate limit:", f);
    return fejl("serverfejl", 500);
  }

  if (!pladsIKoeen) return fejl("for_mange_forsoeg", 429);

  if (anmodning.data.handling === "gem") {
    const { leverandoer, model, noegle } = anmodning.data;

    // Serverside-tjek af det samme, som UI'et allerede skjuler. En leverandør
    // uden priser kan ikke bogføres, og så må den ikke vælges — heller ikke
    // af en, der sender anmodningen uden om siden. Se lib/ai/modeller.ts.
    if (!modelErValgbar(leverandoer, model)) {
      return fejl("leverandoer_ikke_klar", 400);
    }

    if (!noegleMatcherLeverandoer(leverandoer, noegle)) {
      return fejl("forkert_leverandoer", 400);
    }

    try {
      // Rækkefølgen er med vilje: vi gemmer aldrig en nøgle, vi ikke har
      // set virke. Ellers ville fejlen først vise sig, når brugeren sad
      // midt i en tekst.
      await testNoegle(leverandoer, model, noegle);
      await gemNoegle(user.id, leverandoer, model, noegle);
    } catch (f) {
      if (f instanceof AiFejl) return fraLeverandoeren(f);
      console.error("Kunne ikke gemme AI-nøgle:", f);
      return fejl("serverfejl", 500);
    }

    return Response.json({ slags: "gemt" });
  }

  // handling === "test"
  try {
    const gemt = await hentNoegleTilBrug(user.id);
    if (!gemt) return fejl("ingen_noegle", 400);

    await testNoegle(gemt.leverandoer, gemt.model, gemt.apiNoegle);
    await markerValideret(user.id);
  } catch (f) {
    if (f instanceof AiFejl) return fraLeverandoeren(f);
    console.error("Kunne ikke teste AI-nøgle:", f);
    return fejl("serverfejl", 500);
  }

  return Response.json({ slags: "testet" });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fejl("ikke_logget_ind", 401);

  try {
    await sletNoegle(user.id);
  } catch (f) {
    console.error("Kunne ikke slette AI-nøgle:", f);
    return fejl("serverfejl", 500);
  }

  return Response.json({ slags: "slettet" });
}
