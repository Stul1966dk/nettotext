import { z } from "zod";

/**
 * Formen på en skabelons `input_fields`.
 *
 * Teksttyper er data: formularen på /app/ny bygges ud fra det, der står i
 * databasen. Skemaet her er kontrakten mellem migrationsfilen og formularen —
 * står der noget uventet i databasen, opdager vi det her og ikke som en
 * halvtom formular hos brugeren.
 *
 * Filen indeholder med vilje INTET server-kode, så både formularen (klient)
 * og API-ruten (server) kan bruge den.
 */

export const inputFeltSkema = z.object({
  navn: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["tekst", "tekstomraade", "valg"]),
  pladsholder: z.string().optional(),
  hjaelp: z.string().optional(),
  paakraevet: z.boolean(),
  maxLaengde: z.number().int().positive().optional(),
  /**
   * Forudfyldt værdi. Brugeren kan skrive hen over den.
   * Ligger i skabelonen og ikke i formularens kode, så en ny teksttype selv
   * bestemmer sit eget eksempel — ligesom den bestemmer sine felter.
   */
  standard: z.string().optional(),
  valg: z
    .array(z.object({ vaerdi: z.string().min(1), label: z.string().min(1) }))
    .optional(),
});

export type InputFelt = z.infer<typeof inputFeltSkema>;

export const skabelonSkema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  system_prompt: z.string().min(1),
  input_fields: z.array(inputFeltSkema).min(1),
});

export type Skabelon = z.infer<typeof skabelonSkema>;

/**
 * Bygger et Zod-skema for selve briefen ud fra skabelonens felter.
 *
 * Bruges i API-ruten, så et felt, der ikke findes i skabelonen — eller en
 * brief på 40.000 tegn — bliver afvist, før vi bruger penge på den.
 */
export function briefSkema(felter: InputFelt[]) {
  const form: Record<string, z.ZodType<string>> = {};

  for (const felt of felter) {
    let regel = z.string().max(felt.maxLaengde ?? 2000);

    if (felt.type === "valg" && felt.valg?.length) {
      const tilladte = felt.valg.map((v) => v.vaerdi);
      regel = z.string().refine((v) => tilladte.includes(v));
    }

    form[felt.navn] = felt.paakraevet ? regel.pipe(z.string().min(1)) : regel;
  }

  // .strict() — et felt, skabelonen ikke kender, er en fejl, ikke noget vi
  // stiltiende sender videre til modellen.
  return z.object(form).strict();
}

export type Brief = Record<string, string>;
