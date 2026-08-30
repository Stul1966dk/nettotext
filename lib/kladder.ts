import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Kladden på serveren — CLAUDE.md regel 7.
 *
 * Det ENESTE tekstindhold, NettoText nogensinde gemmer, og det ligger der i
 * 48 timer. Færdige tekster gemmes aldrig; det, der ligger her, er noget,
 * brugeren ikke er færdig med, og som hun skal kunne finde igen i morgen.
 *
 * Bemærk at der IKKE bruges service_role nogen steder i filen. Alt går
 * gennem brugerens egen forbindelse, så Row Level Security afgør ejerskabet.
 * Det er den sikreste vej: der er ikke et manuelt ejer-tjek, der kan glemmes,
 * fordi databasen selv siger nej.
 */

/** 48 timer, regnet fra hver gemning. Se noten i migrationsfilen. */
const LEVETID_TIMER = 48;

const blokSkema = z.object({
  id: z.string().min(1).max(32),
  slags: z.enum(["titel", "indledning", "sektion"]),
  overskrift: z.string().max(300).nullable(),
  nummer: z.number().int().nullable(),
  html: z.string().max(20_000),
});

/**
 * Det, der gemmes. Bemærk hvad der IKKE er med: `tekst`, den rå strøm fra
 * modellen. Den er kun interessant, mens teksten bliver skrevet, og den
 * fylder det samme som den færdige tekst en gang til.
 */
export const indholdSkema = z.object({
  brief: z.record(z.string(), z.string().max(2000)),
  html: z.string().max(200_000),
  blokke: z.array(blokSkema).max(40),
  titel: z.string().max(300),
  beskrivelse: z.string().max(500),
  faerdig: z.boolean(),
});

export type KladdeIndhold = z.infer<typeof indholdSkema>;

export type GemtKladde = {
  id: string;
  skabelon: string;
  indhold: KladdeIndhold;
  udloeber: string;
  opdateret: string;
};

/**
 * Gemmer eller opdaterer én kladde.
 *
 * Udløbet sættes forfra ved hver gemning, så de 48 timer regnes fra sidste
 * rettelse. En kladde, man arbejder på tredje dag, skal ikke forsvinde under
 * hænderne på en.
 */
export async function gemKladdePaaServer(
  brugerId: string,
  id: string,
  skabelon: string,
  indhold: KladdeIndhold,
): Promise<void> {
  const supabase = await createClient();

  const udloeber = new Date(
    Date.now() + LEVETID_TIMER * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("drafts").upsert({
    id,
    user_id: brugerId,
    template_slug: skabelon,
    content: indhold,
    expires_at: udloeber,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Kunne ikke gemme kladden: ${error.message}`);
  }
}

export async function sletKladdePaaServer(id: string): Promise<void> {
  const supabase = await createClient();

  // Ingen ejer-betingelse her: RLS' delete-policy slipper kun brugerens egne
  // rækker igennem. Et id, hun ikke ejer, rammer ingenting.
  const { error } = await supabase.from("drafts").delete().eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke slette kladden: ${error.message}`);
  }
}

/** Brugerens kladder, nyeste først. Udløbne er allerede filtreret fra af RLS. */
export async function hentKladder(): Promise<GemtKladde[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("drafts")
    .select("id, template_slug, content, expires_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((raekke) => ({
    id: raekke.id,
    skabelon: raekke.template_slug,
    indhold: raekke.content as KladdeIndhold,
    udloeber: raekke.expires_at,
    opdateret: raekke.updated_at,
  }));
}

/** Én kladde. Null hvis den ikke findes, er udløbet, eller ikke er brugerens. */
export async function hentKladdeVedId(id: string): Promise<GemtKladde | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("drafts")
    .select("id, template_slug, content, expires_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    skabelon: data.template_slug,
    indhold: data.content as KladdeIndhold,
    udloeber: data.expires_at,
    opdateret: data.updated_at,
  };
}

/**
 * En læsbar overskrift på kladden.
 *
 * Titelblokken først, så meta-titlen, og ellers briefens emne. En kladde uden
 * navn er svær at kende fra en anden, og listen på dashboardet skal kunne
 * skimmes.
 */
export function kladdeNavn(kladde: GemtKladde, reserve: string): string {
  const fraTitel = kladde.indhold.blokke.find((b) => b.slags === "titel");

  return (
    fraTitel?.overskrift ||
    kladde.indhold.titel ||
    Object.values(kladde.indhold.brief)[0]?.slice(0, 80) ||
    reserve
  );
}

/** Timer til udløb, rundet ned. Bruges til "udløber om X timer". */
export function timerTilbage(udloeber: string): number {
  const millisekunder = new Date(udloeber).getTime() - Date.now();
  return Math.max(Math.floor(millisekunder / (60 * 60 * 1000)), 0);
}
