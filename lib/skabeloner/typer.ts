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
  /**
   * Er det HER felt, idéforslagene skal fylde ud?
   *
   * Højst ét felt pr. teksttype. Flaget står i skabelonen og ikke i koden,
   * fordi feltet hedder noget forskelligt fra teksttype til teksttype:
   * blogindlægget har "emne", produktteksten "produkt", brandteksten
   * "virksomheden". En knap, der skulle gætte hvilket felt den fylder ud,
   * ville gætte forkert ved den første branchepakke.
   *
   * Uden flaget er der ingen knap. Det er det rigtige svar for de fleste
   * teksttyper: man behøver ikke forslag til, hvad ens eget produkt hedder.
   */
  idefelt: z.boolean().optional(),
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
 * En teksttype, som den ser ud på listen, hvor brugeren vælger.
 *
 * Bevidst uden `system_prompt` og `input_fields`: listen skal kun bruge navn
 * og beskrivelse, og en prompt på flere tusinde tegn pr. række har intet at
 * gøre i den forespørgsel.
 */
export const skabelonIListenSkema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  /** Kan mangle: en teksttype fra for migration 0014 har ingen beskrivelse. */
  description: z.string().nullable().default(null),
});

export type SkabelonIListen = z.infer<typeof skabelonIListenSkema>;

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

    // Et valgfrit felt må MANGLE, ikke bare være tomt. Formularen sender kun
    // felter med indhold, så et tomt valgfrit felt kommer slet ikke med.
    //
    // Fejlen blev fundet 02.09.2026 og var ældre end det: den var skjult, så
    // længe de valgfrie felter var forudfyldt med et eksempel, for så var de
    // aldrig tomme. Ryddede man dem, blev hele genereringen afvist med
    // "der var noget i briefen, vi ikke kunne bruge". Punktet om at fjerne
    // eksempelteksten står på tjeklisten — uden denne rettelse ville det
    // punkt have gjort appen ubrugelig for enhver, der lod et felt stå tomt.
    // `.default("")` frem for bare `.optional()`: så bliver et manglende
    // felt til en tom streng, og resten af koden slipper for at skelne
    // mellem "ikke udfyldt" og "findes ikke".
    form[felt.navn] = felt.paakraevet
      ? regel.pipe(z.string().min(1))
      : regel.optional().default("");
  }

  // .strict() — et felt, skabelonen ikke kender, er en fejl, ikke noget vi
  // stiltiende sender videre til modellen.
  return z.object(form).strict();
}

export type Brief = Record<string, string>;

/**
 * Feltet, idéforslagene fylder ud — eller null, hvis teksttypen ikke har et.
 *
 * Er der ved en fejl markeret flere, vinder det første. En knap pr. felt
 * ville være at bygge videre på en fejl i dataene frem for at rette den.
 */
export function findIdefelt(felter: InputFelt[]): InputFelt | null {
  // Et valgfelt kan ikke fyldes ud med et forslag — der er en rullemenu med
  // faste muligheder. Er flaget alligevel sat på et, springes det over frem
  // for at give brugeren en knap, der ikke gør noget.
  return felter.find((felt) => felt.idefelt && felt.type !== "valg") ?? null;
}

/**
 * Briefen, som den ser ud MIDT i udfyldningen.
 *
 * Idéforslagene bygger på det, brugeren har skrevet indtil videre, og på det
 * tidspunkt er de påkrævede felter typisk tomme — det er jo dét, hun mangler
 * hjælp til. Derfor et skema for sig: samme felter og samme længdegrænser
 * som `briefSkema`, men intet er påkrævet.
 *
 * `.strict()` gælder stadig. Et felt, skabelonen ikke kender, er en fejl —
 * også når briefen kun er halvt udfyldt.
 */
export function delvisBriefSkema(felter: InputFelt[]) {
  const form: Record<string, z.ZodType<string>> = {};

  for (const felt of felter) {
    form[felt.navn] = z
      .string()
      .max(felt.maxLaengde ?? 2000)
      .optional()
      .default("");
  }

  return z.object(form).strict();
}
