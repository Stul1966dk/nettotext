import "server-only";

import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Fejllog. Skriver serverfejl til `error_log`, så adminen kan se dem
 * bagefter — i stedet for at de kun findes i Vercels logs, som ingen
 * kigger i, og som ruller væk af sig selv.
 *
 * Tre regler, som resten af filen findes for at holde:
 *
 * 1. DEN MÅ ALDRIG VÆLTE ET KALD. Kan der ikke skrives til databasen,
 *    tier den. En fejllog, der selv kaster en fejl, gør en dårlig dag
 *    til en nedbrudt dag.
 * 2. DEN SKRIVER ALDRIG TEKSTINDHOLD. CLAUDE.md regel 9 gælder også
 *    vores egen fejllog. Derfor pakkes kun beskeden og sporet ud af
 *    fejlen — aldrig hele fejlobjektet, som kan slæbe et helt svar fra
 *    AI-leverandøren med sig.
 * 3. DEN SANERER FØR DEN SKRIVER. En nøgle kan være havnet inde i en
 *    fejlbesked fra leverandøren. `saner()` fjerner alt, der ligner en,
 *    både fra beskeden, sporet og de ekstra felter.
 *
 * `console.error` kaldes ALTID først, så Vercels logs stadig har fejlen,
 * også hvis databasen er dét, der er galt.
 */

const BESKED_MAKS = 500;
const SPOR_MAKS = 4000;
const EKSTRA_FELTER_MAKS = 12;
const EKSTRA_TEKST_MAKS = 200;

/**
 * Mønstre, der ligner en hemmelighed. Rækkefølgen betyder noget: de
 * præcise først, de brede sidst.
 */
const HEMMELIGHEDER: RegExp[] = [
  // Anthropic-nøgler.
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  // OpenAI og andre med samme form.
  /sk-[A-Za-z0-9_-]{16,}/g,
  // JWT — Supabases anon- og service role-nøgler har den form.
  /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g,
  // Alt efter "Bearer" i en header, der er kommet med i en fejlbesked.
  /Bearer\s+\S+/g,
];

function saner(tekst: string): string {
  return HEMMELIGHEDER.reduce((t, m) => t.replace(m, "[fjernet]"), tekst);
}

function afkort(tekst: string, maks: number): string {
  return tekst.length <= maks ? tekst : `${tekst.slice(0, maks)}…`;
}

/**
 * Pak fejlen ud til besked og spor.
 *
 * Bemærk hvad der IKKE sker: fejlobjektet bliver aldrig kørt gennem
 * JSON.stringify. En fejl fra en AI-leverandør eller fra Supabase kan
 * have hele forespørgslen hængende på sig, og den indeholder brugerens
 * brief. Vi tager beskeden, og hvis der er en fejlkode, tager vi den med.
 */
function udpak(fejl: unknown): { besked: string; spor?: string } {
  if (fejl instanceof Error) {
    return { besked: fejl.message || fejl.name, spor: fejl.stack };
  }

  if (typeof fejl === "string") return { besked: fejl };

  if (fejl && typeof fejl === "object") {
    const o = fejl as { message?: unknown; code?: unknown; status?: unknown };
    if (typeof o.message === "string" && o.message) {
      const kode =
        typeof o.code === "string" || typeof o.code === "number"
          ? ` (kode ${o.code})`
          : typeof o.status === "number"
            ? ` (status ${o.status})`
            : "";
      return { besked: `${o.message}${kode}` };
    }
  }

  // Ukendt form. Så skriver vi hvad det VAR, ikke hvad der stod i det.
  return { besked: `Ukendt fejltype: ${Object.prototype.toString.call(fejl)}` };
}

/**
 * Ekstra oplysninger om fejlen. Små nøgletal, der gør en fejl til at
 * forstå: teksttype, leverandør, model, statuskode.
 *
 * ALDRIG tekstindhold, briefer, mailadresser eller nøgler. Lange strenge
 * kastes væk af `renseEkstra` netop fordi de lugter af indhold.
 */
type Ekstra = Record<string, string | number | boolean | null | undefined>;

function renseEkstra(ekstra: Ekstra): Record<string, string | number | boolean | null> {
  const ud: Record<string, string | number | boolean | null> = {};

  for (const [navn, vaerdi] of Object.entries(ekstra)) {
    if (Object.keys(ud).length >= EKSTRA_FELTER_MAKS) break;
    if (vaerdi === undefined) continue;

    if (typeof vaerdi === "string") {
      if (vaerdi.length > EKSTRA_TEKST_MAKS) continue;
      ud[navn] = saner(vaerdi);
      continue;
    }

    ud[navn] = vaerdi;
  }

  return ud;
}

type Muligheder = {
  /** Brugerens id. ALDRIG mailadresse eller navn. */
  bruger?: string | null;
  ekstra?: Ekstra;
};

/**
 * Skriv en fejl til loggen.
 *
 * `sted` er stedet, som et menneske kender det, og formen er fast:
 * ruten eller filen, en midterprik, og hvad der mislykkedes —
 * "POST /api/generate · budgettjek", "lib/budget · usage_log".
 *
 * Formen er ikke pynt. Det er den kolonne, adminsiden skimmes efter, og
 * første del er den, ens fejl kan samles på senere. Skriv derfor samme
 * sted på samme måde hver gang.
 *
 * Kast aldrig fra denne funktion. Kaldere gør ofte:
 *
 *   } catch (fejl) {
 *     await logFejl("POST /api/draft", fejl);
 *     return NextResponse.json(...);
 *   }
 */
export async function logFejl(
  sted: string,
  fejl: unknown,
  muligheder: Muligheder = {},
): Promise<void> {
  // Altid først, så fejlen findes i Vercels logs, uanset hvad der sker
  // herunder.
  console.error(`${sted}:`, fejl);

  try {
    const { besked, spor } = udpak(fejl);

    const supabase = createServiceClient();
    const { error } = await supabase.from("error_log").insert({
      sted: afkort(saner(sted), 120),
      besked: afkort(saner(besked), BESKED_MAKS),
      spor: spor ? afkort(saner(spor), SPOR_MAKS) : null,
      user_id: muligheder.bruger ?? null,
      ekstra: renseEkstra(muligheder.ekstra ?? {}),
    });

    // Kan der ikke skrives, er der ét sted tilbage at sige det: Vercels
    // logs. Og så er sagen lukket — vi prøver ikke igen og kaster ikke.
    if (error) {
      console.error("Fejlloggen kunne ikke skrive:", error.message);
    }
  } catch (indre) {
    console.error("Fejlloggen kunne ikke skrive:", indre);
  }
}
