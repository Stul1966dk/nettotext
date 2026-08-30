import { z } from "zod";

import {
  gemKladdePaaServer,
  indholdSkema,
  sletKladdePaaServer,
} from "@/lib/kladder";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT og DELETE /api/draft — kladden på serveren.
 *
 * Ingen kvote, intet budgetloft, ingen rate limit. Der kaldes ingen AI, og
 * ruten koster derfor ingen penge; tjekkene i CLAUDE.md regel 6 gælder det,
 * der gør. Til gengæld skrives der i databasen, så størrelserne er låst fast
 * i skemaet — en kladde kan ikke bruges som lager for hvad som helst.
 *
 * Ejerskabet afgøres af Row Level Security, ikke af kode her. Se lib/kladder.ts.
 */

const gemSkema = z.object({
  id: z.uuid(),
  skabelon: z.string().min(1).max(64),
  indhold: indholdSkema,
});

const sletSkema = z.object({ id: z.uuid() });

function svar(aarsag: string, status: number) {
  return Response.json({ slags: "fejl", aarsag }, { status });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return svar("ikke_logget_ind", 401);

  let raa: unknown;
  try {
    raa = await request.json();
  } catch {
    return svar("ugyldig_anmodning", 400);
  }

  const anmodning = gemSkema.safeParse(raa);
  if (!anmodning.success) return svar("ugyldig_anmodning", 400);

  try {
    await gemKladdePaaServer(
      user.id,
      anmodning.data.id,
      anmodning.data.skabelon,
      anmodning.data.indhold,
    );
  } catch (fejl) {
    // Kladden står stadig i browserens localStorage, så brugeren mister
    // ingenting lige nu. Fejlen hører til i loggen, ikke på skærmen.
    console.error("Kunne ikke gemme kladde:", fejl);
    return svar("serverfejl", 500);
  }

  return Response.json({ slags: "gemt" });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return svar("ikke_logget_ind", 401);

  let raa: unknown;
  try {
    raa = await request.json();
  } catch {
    return svar("ugyldig_anmodning", 400);
  }

  const anmodning = sletSkema.safeParse(raa);
  if (!anmodning.success) return svar("ugyldig_anmodning", 400);

  try {
    await sletKladdePaaServer(anmodning.data.id);
  } catch (fejl) {
    console.error("Kunne ikke slette kladde:", fejl);
    return svar("serverfejl", 500);
  }

  return Response.json({ slags: "slettet" });
}
