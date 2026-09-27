import "server-only";

import { z } from "zod";

import { logFejl } from "@/lib/fejl";
import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Materiale til en teksttype: vejledninger og eksempler, der lægges ind i
 * systemprompten ved hver tekst af typen. Migration 0026.
 *
 * Tabellen har ingen policies og læses kun med service_role — begrundelsen
 * står i migrationen. For adminfunktionerne herunder gælder det samme som i
 * ./admin.ts: kalderen har ALLEREDE slået fast med `hentAdmin()`, at det er
 * adminkontoen. `hentAktivtMateriale` er undtagelsen: den kaldes af
 * genereringen for enhver indlogget bruger, og det er i orden, fordi
 * materialet kun går videre til AI-leverandøren og aldrig til browseren.
 */

export const MATERIALE_SLAGS = ["vejledning", "eksempel"] as const;
export type MaterialeSlags = (typeof MATERIALE_SLAGS)[number];

/** Et enkelt stykke materiale. Samme loft som i databasen. */
export const MAKS_TEGN_PR_STYKKE = 20_000;

/**
 * Loftet for alt AKTIVT materiale til én teksttype tilsammen.
 *
 * Materialet sendes med ved HVER tekst, og de fleste tekster betales af
 * brugerens egen nøgle. 40.000 tegn er omkring 11.000 tokens, og det koster
 * op til cirka 50 øre ekstra pr. tekst på den dyreste model, når materialet
 * skrives til Anthropics cache — og omkring 4 øre, når næste tekst inden for
 * fem minutter kan læse det derfra. Mere end det skal være et bevidst valg,
 * ikke noget, der sniger sig ind ét dokument ad gangen.
 */
export const MAKS_TEGN_SAMLET = 40_000;

export const materialeSkema = z.object({
  kind: z.enum(MATERIALE_SLAGS),
  title: z.string().trim().min(1).max(120),
  // Windows-linjeskift fra en indsat fil ryddes, så tegntallet passer med
  // det, der faktisk sendes.
  content: z
    .string()
    .transform((s) => s.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1).max(MAKS_TEGN_PR_STYKKE)),
  active: z.boolean(),
});

export type MaterialeInput = z.infer<typeof materialeSkema>;

export type Materiale = MaterialeInput & {
  id: string;
  updated_at: string;
};

/** Det, systemprompten skal bruge. */
export type AktivtMateriale = Pick<Materiale, "kind" | "title" | "content">;

/**
 * Det aktive materiale til en teksttype, til genereringen.
 *
 * Fejler opslaget, skrives teksten uden materiale frem for slet ikke — som
 * med brand-profilen i lib/personalisering.ts. Brugeren har ikke gjort
 * noget forkert og skal ikke betale for vores fejl med en afvist tekst.
 * Fejlen logges, så den kan ses på adminsiden.
 */
export async function hentAktivtMateriale(
  slug: string,
): Promise<AktivtMateriale[]> {
  try {
    const db = createServiceClient();

    const { data, error } = await db
      .from("template_materials")
      .select("kind, title, content, templates!inner(slug)")
      .eq("templates.slug", slug)
      .eq("active", true)
      .order("created_at");

    if (error) throw error;

    return (data ?? []).map(({ kind, title, content }) => ({
      kind: kind as MaterialeSlags,
      title,
      content,
    }));
  } catch (fejl) {
    await logFejl("materiale · hent til generering", fejl, {
      ekstra: { skabelon: slug },
    });
    return [];
  }
}

/** Alt materiale til en teksttype, også det inaktive. Kun til adminsiden. */
export async function hentMaterialeTilAdmin(
  templateId: string,
): Promise<Materiale[]> {
  const db = createServiceClient();

  const { data } = await db
    .from("template_materials")
    .select("id, kind, title, content, active, updated_at")
    .eq("template_id", templateId)
    .order("created_at");

  return (data ?? []).map((raekke) => ({
    ...raekke,
    kind: raekke.kind as MaterialeSlags,
  }));
}

/** Tegn i det aktive materiale, hvis `aendring` blev gemt. */
async function samletEfter(
  templateId: string,
  aendring: { id: string | null; content: string; active: boolean },
): Promise<number> {
  const alle = await hentMaterialeTilAdmin(templateId);

  const andre = alle
    .filter((m) => m.active && m.id !== aendring.id)
    .reduce((sum, m) => sum + m.content.length, 0);

  return andre + (aendring.active ? aendring.content.length : 0);
}

/**
 * Opretter (id = null) eller retter et stykke materiale.
 *
 * Loftet for det samlede materiale tjekkes her og ikke kun i formularen:
 * formularen er hjælp, serveren er kontrollen.
 */
export async function gemMateriale(
  templateId: string,
  id: string | null,
  materiale: MaterialeInput,
): Promise<{ ok: true } | { ok: false; grund: "loft" | "gem" }> {
  const samlet = await samletEfter(templateId, {
    id,
    content: materiale.content,
    active: materiale.active,
  });

  if (samlet > MAKS_TEGN_SAMLET) return { ok: false, grund: "loft" };

  const db = createServiceClient();

  const { error } = id
    ? await db
        .from("template_materials")
        .update({ ...materiale, updated_at: new Date().toISOString() })
        .eq("id", id)
        // Materialet skal høre til DEN teksttype, siden står på. Et id fra
        // en anden teksttype rammer ingenting.
        .eq("template_id", templateId)
    : await db
        .from("template_materials")
        .insert({ ...materiale, template_id: templateId });

  return error ? { ok: false, grund: "gem" } : { ok: true };
}

export async function sletMateriale(
  templateId: string,
  id: string,
): Promise<boolean> {
  const db = createServiceClient();

  const { error } = await db
    .from("template_materials")
    .delete()
    .eq("id", id)
    .eq("template_id", templateId);

  return !error;
}
