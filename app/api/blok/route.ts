import { z } from "zod";

import { logFejl } from "@/lib/fejl";
import { sanerHtml } from "@/lib/tekst/saner";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/blok — saner et afsnit, brugeren selv har rettet i.
 *
 * Ruten koster ingen penge og kalder ingen AI. Den findes udelukkende for at
 * holde saneringsreglen: al HTML, der bliver vist med dangerouslySetInnerHTML,
 * skal renses server-side, og vi skriver aldrig vores egen sanering
 * (CLAUDE.md regel 4 og sikkerhedsreglernes punkt om dangerouslySetInnerHTML).
 *
 * Hvorfor det er nødvendigt, når teksten kommer fra brugeren selv: hun retter
 * i et contentEditable-felt, og dér kan man indsætte hvad som helst fra
 * udklipsholderen — et helt afsnit fra en anden hjemmeside, med det script,
 * der tilfældigvis fulgte med. Det ville blive gemt i kladden og vist som
 * HTML igen næste gang, hun åbnede den. At det kun rammer hende selv, gør
 * det ikke i orden.
 *
 * Login kræves. Ikke fordi der er noget at stjæle, men fordi en åben rute,
 * der tager imod vilkårlig HTML, ikke skal ligge og vente på nogen.
 */

export const maxDuration = 10;

/** Samme loft som en blok har i kladden. Se blokSkema i lib/kladder.ts. */
const HTML_MAX = 20_000;

const anmodningSkema = z.object({
  html: z.string().min(1).max(HTML_MAX),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ aarsag: "ikke_logget_ind" }, { status: 401 });
  }

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

  try {
    const html = sanerHtml(anmodning.data.html);

    // Stod der kun tags tilbage, er afsnittet tomt. Så skal brugeren vide
    // det frem for at se sit afsnit forsvinde uden en forklaring.
    if (!html) {
      return Response.json({ aarsag: "tomt_afsnit" }, { status: 422 });
    }

    return Response.json({ html });
  } catch (fejl) {
    await logFejl("POST /api/blok · sanering", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }
}
