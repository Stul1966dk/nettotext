/**
 * Læser NDJSON-strømmen fra serveren, én hændelse ad gangen.
 *
 * Modstykket til lib/api/ndjson.ts, som skriver den. Ligger for sig, fordi to
 * ting nu streamer — en hel tekst og ét afsnit — og de skal læse ens.
 *
 * Ingen "server-only" her: den her side af protokollen hører hjemme i
 * browseren.
 */
export async function laesNdjson(
  krop: ReadableStream<Uint8Array>,
  paaHendelse: (hendelse: { slags: string; [n: string]: unknown }) => void,
): Promise<void> {
  const laeser = krop.getReader();
  const afkoder = new TextDecoder();

  // Én bid fra netværket er ikke det samme som én linje: den kan indeholde
  // flere linjer eller en halv. Resten gemmes, til den bliver hel.
  let rest = "";

  while (true) {
    const { value, done } = await laeser.read();
    if (done) break;

    rest += afkoder.decode(value, { stream: true });

    const linjer = rest.split("\n");
    rest = linjer.pop() ?? "";

    for (const linje of linjer) {
      if (!linje.trim()) continue;
      paaHendelse(JSON.parse(linje));
    }
  }
}
