import { z } from "zod";

import { byggDocx, filnavn } from "@/lib/tekst/docx";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/export/docx — den færdige tekst som Word-fil.
 *
 * Bemærk hvad ruten IKKE har: ingen prøvekvote, intet budgetloft, ingen rate
 * limit. Tjekkene i CLAUDE.md regel 6 gælder alt, der koster penge, og her
 * kaldes ingen AI. Filen bygges af tekst, brugeren allerede har.
 *
 * Login kræves stadig. Ikke fordi det koster noget, men fordi resten af
 * appen er lukket, og en åben rute ville være et hul, ingen havde besluttet.
 *
 * Teksten kommer fra browseren og ikke fra databasen, og det er med vilje:
 * "intet gemmes permanent" betyder, at serveren ikke har en kopi at hente.
 * Blokkene er saneret, dengang de blev skrevet, og de skal ikke saneres igen
 * her — de bliver ikke vist som HTML nogen steder, kun læst som tekst.
 */

const blokSkema = z.object({
  id: z.string().min(1).max(32),
  slags: z.enum(["titel", "indledning", "sektion"]),
  overskrift: z.string().max(300).nullable(),
  nummer: z.number().int().nullable(),
  html: z.string().max(20_000),
});

const anmodningSkema = z.object({
  blokke: z.array(blokSkema).min(1).max(40),
  titel: z.string().max(300).optional(),
  beskrivelse: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ slags: "fejl", aarsag: "ikke_logget_ind" }, { status: 401 });
  }

  let raa: unknown;
  try {
    raa = await request.json();
  } catch {
    return Response.json({ slags: "fejl", aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  const anmodning = anmodningSkema.safeParse(raa);
  if (!anmodning.success) {
    return Response.json({ slags: "fejl", aarsag: "ugyldig_anmodning" }, { status: 400 });
  }

  const { blokke, titel = "", beskrivelse = "" } = anmodning.data;

  try {
    const fil = await byggDocx(blokke, titel, beskrivelse);

    // Filnavnet tages fra artiklens egen overskrift, ikke fra meta-titlen:
    // det er den, brugeren kender teksten på, når filen ligger i en mappe.
    const overskrift =
      blokke.find((b) => b.slags === "titel")?.overskrift ?? titel;

    return new Response(new Uint8Array(fil), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filnavn(overskrift)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (fejl) {
    console.error("Word-eksport mislykkedes:", fejl);
    return Response.json({ slags: "fejl", aarsag: "serverfejl" }, { status: 500 });
  }
}
