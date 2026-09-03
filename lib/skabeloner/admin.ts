import "server-only";

import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server-service";
import { inputFeltSkema, type InputFelt } from "./typer";

/**
 * Teksttyper set fra adminsiden.
 *
 * Alt her bruger service_role og omgår dermed RLS. Det er nødvendigt af to
 * grunde: en admin skal kunne se de INAKTIVE teksttyper, som læse-policyen
 * skjuler, og ingen almindelig bruger må kunne skrive i `templates`.
 *
 * Sikkerhedsreglernes punkt 6 gælder derfor skarpt: hver eneste funktion i
 * filen forudsætter, at kalderen ALLEREDE har slået fast med `hentAdmin()`,
 * at det er adminkontoen. Rækkefølgen er altid: tjek admin, hent data
 * bagefter. Aldrig omvendt.
 */

/**
 * Feltnavne bliver til nøgler i briefen og til `name` i HTML-formularen.
 * Derfor: små bogstaver, tal og underscore, og aldrig to underscores forrest
 * — dem har formularen selv taget til stiltonen og det frie ønske.
 */
const feltNavnSkema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,30}$/)
  .refine((navn) => !navn.startsWith("__"));

const adminFeltSkema = inputFeltSkema
  .extend({ navn: feltNavnSkema })
  .refine(
    (felt) => felt.type !== "valg" || (felt.valg?.length ?? 0) >= 2,
    "Et valgfelt skal have mindst to muligheder.",
  );

export const adminSkabelonSkema = z.object({
  /** Adressen på brief-siden: /app/ny/<slug>. Kan ikke ændres bagefter. */
  slug: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,48}$/)
    .refine((slug) => !slug.endsWith("-")),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  /**
   * Nedre grænse med vilje: en systemprompt på to linjer er ikke en
   * teksttype, det er en tastefejl, og den ville skrive ubrugelige tekster
   * for brugerens penge.
   */
  system_prompt: z.string().trim().min(200).max(40_000),
  input_fields: z
    .array(adminFeltSkema)
    .min(1)
    .max(12)
    .refine(
      (felter) => new Set(felter.map((f) => f.navn)).size === felter.length,
      "To felter kan ikke hedde det samme.",
    ),
  active: z.boolean(),
});

export type AdminSkabelon = z.infer<typeof adminSkabelonSkema>;

export type SkabelonRaekke = AdminSkabelon & {
  id: string;
  updated_at: string;
};

/** Alle teksttyper, også de inaktive. Kun til adminsiden. */
export async function hentAlleSkabeloner(): Promise<SkabelonRaekke[]> {
  const db = createServiceClient();

  const { data } = await db
    .from("templates")
    .select(
      "id, slug, name, description, system_prompt, input_fields, active, updated_at",
    )
    .order("name");

  if (!data) return [];

  // Rækker, der ikke kan læses som en gyldig skabelon, springes over frem for
  // at vælte hele listen. De kan stadig ses i databasen, og en liste, der
  // mangler én, er bedre end en side, der ikke kan åbnes.
  return data.flatMap((raekke) => {
    const resultat = adminSkabelonSkema.safeParse(raekke);
    if (!resultat.success) return [];

    return [{ ...resultat.data, id: raekke.id, updated_at: raekke.updated_at }];
  });
}

export async function hentSkabelonTilRedigering(
  slug: string,
): Promise<SkabelonRaekke | null> {
  const db = createServiceClient();

  const { data } = await db
    .from("templates")
    .select(
      "id, slug, name, description, system_prompt, input_fields, active, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;

  const resultat = adminSkabelonSkema.safeParse(data);
  if (!resultat.success) return null;

  return { ...resultat.data, id: data.id, updated_at: data.updated_at };
}

/**
 * Gemmer en teksttype. Findes slug'en, opdateres rækken; ellers oprettes den.
 *
 * FØR en opdatering lægges den nuværende udgave i `template_versions`. Det
 * er hele grunden til, at tabellen findes: en prompt, der bliver ændret i en
 * formular, skal kunne findes frem igen. Fejler den skrivning, gemmes der
 * ikke — hellere en fejlbesked end en ændring, ingen kan spore.
 */
export async function gemSkabelon(
  skabelon: AdminSkabelon,
  admin: { id: string; email: string },
): Promise<{ ok: true } | { ok: false; grund: "historik" | "gem" }> {
  const db = createServiceClient();

  const { data: nuvaerende } = await db
    .from("templates")
    .select("id, slug, name, description, system_prompt, input_fields, active")
    .eq("slug", skabelon.slug)
    .maybeSingle();

  if (nuvaerende) {
    const { error: historikFejl } = await db.from("template_versions").insert({
      template_id: nuvaerende.id,
      slug: nuvaerende.slug,
      name: nuvaerende.name,
      description: nuvaerende.description,
      system_prompt: nuvaerende.system_prompt,
      input_fields: nuvaerende.input_fields,
      active: nuvaerende.active,
      saved_by: admin.id,
      saved_by_email: admin.email,
    });

    if (historikFejl) return { ok: false, grund: "historik" };

    const { error } = await db
      .from("templates")
      .update({
        name: skabelon.name,
        description: skabelon.description || null,
        system_prompt: skabelon.system_prompt,
        input_fields: skabelon.input_fields,
        active: skabelon.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nuvaerende.id);

    return error ? { ok: false, grund: "gem" } : { ok: true };
  }

  const { error } = await db.from("templates").insert({
    slug: skabelon.slug,
    name: skabelon.name,
    description: skabelon.description || null,
    system_prompt: skabelon.system_prompt,
    input_fields: skabelon.input_fields,
    active: skabelon.active,
  });

  return error ? { ok: false, grund: "gem" } : { ok: true };
}

/** Felterne fra en anden teksttype, som udgangspunkt for en ny. */
export async function hentFelterFra(slug: string): Promise<InputFelt[]> {
  const skabelon = await hentSkabelonTilRedigering(slug);
  return skabelon?.input_fields ?? [];
}
