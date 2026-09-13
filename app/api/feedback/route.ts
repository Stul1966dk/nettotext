import { z } from "zod";

import { logFejl } from "@/lib/fejl";
import { createServiceClient } from "@/lib/supabase/server-service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/feedback — tommel op eller ned på en skrevet tekst.
 *
 * Svaret hører til PÅ rækken i `usage_log`, teksten kostede. Klienten kender
 * rækkens id, fordi genereringen sender det som en kvittering, når teksten er
 * leveret. Derfor skal ruten ikke gætte hvilken tekst der menes — et gæt på
 * "den nyeste" ville ramme forkert i det øjeblik, en gammel kladde blev
 * åbnet fra dashboardet og bedømt.
 *
 * HVORFOR service_role, OG HVAD DET KRÆVER: `usage_log` har med vilje ingen
 * update-policy. Kunne brugeren selv skrive i loggen, kunne hun slette dagens
 * forbrug og dermed nulstille budgetloftet — det står i migration 0008.
 * Feedback skal derfor ind ad denne vej. Og når `service_role` omgår RLS,
 * gælder sikkerhedsreglernes punkt 6: ejerskabet skal tjekkes i hånden.
 * Det sker i selve opdateringen, som kun rammer rækker med brugerens eget
 * `user_id`. Rammer den ingenting, er id'et enten opdigtet eller en anden
 * brugers, og svaret er det samme i begge tilfælde.
 *
 * Ingen kø-grænse: kaldet koster ingen penge og kalder ingen AI, og det kan
 * kun skrive i brugerens egne rækker. Gentagne kald skriver oven i det
 * samme svar. At lade den dele grænse med genereringen ville være værre —
 * så ville en tommel op koste en plads i køen til at skrive en tekst.
 */

export const maxDuration = 10;

const anmodningSkema = z.object({
  kvittering: z.string().uuid(),
  /** Tommel op (1) eller ned (-1). Samme værdier som kolonnen tillader. */
  svar: z.union([z.literal(1), z.literal(-1)]),
  /** Frivillig uddybning. Kort med vilje: det er en kommentar, ikke et brev. */
  kommentar: z.string().trim().max(1000).optional(),
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

  const { kvittering, svar, kommentar } = anmodning.data;

  try {
    const service = createServiceClient();

    const { data, error } = await service
      .from("usage_log")
      .update({
        feedback: svar,
        feedback_comment: kommentar || null,
      })
      // Ejer-tjekket. Begge betingelser skal stå her: uden `user_id` kunne
      // enhver indlogget bruger bedømme enhver andens tekst.
      .eq("id", kvittering)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      await logFejl("POST /api/feedback · gem svar", error.message, {
        bruger: user.id,
      });
      return Response.json({ aarsag: "serverfejl" }, { status: 500 });
    }

    // Ingen række ramt: id'et findes ikke, eller det er en anden brugers.
    // Samme svar i begge tilfælde — vi bekræfter ikke, at et id findes.
    if (!data || data.length === 0) {
      return Response.json({ aarsag: "ukendt_tekst" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (fejl) {
    await logFejl("POST /api/feedback", fejl, { bruger: user.id });
    return Response.json({ aarsag: "serverfejl" }, { status: 500 });
  }
}
