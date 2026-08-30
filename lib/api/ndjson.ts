import "server-only";

/**
 * Streamingprotokollen mellem serveren og /app/skriv.
 *
 * NDJSON: én JSON-linje pr. hændelse. Fravalgt blev Server-Sent Events, som
 * kan det samme, men kræver mere opsætning i begge ender. NDJSON giver plads
 * til at sende både tekstbidder og en fejlbesked midt i strømmen — vigtigt,
 * fordi statuskoden for længst er sendt, når leverandøren fejler midtvejs.
 *
 * Ligger her og ikke i den ene rute, fordi to ruter nu streamer, og de skal
 * være enige om formatet.
 */

const encoder = new TextEncoder();

export function ndjsonLinje(hendelse: object): Uint8Array {
  return encoder.encode(JSON.stringify(hendelse) + "\n");
}

/** Fejl FØR strømmen er åbnet — her kan vi stadig sætte en statuskode. */
export function afvis(aarsag: string, status: number): Response {
  return Response.json({ slags: "fejl", aarsag }, { status });
}

export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};
