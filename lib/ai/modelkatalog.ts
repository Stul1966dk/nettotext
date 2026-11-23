import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

import { FRAVALGTE_MODELLER, MODELLER, modelErValgbar } from "./modeller";
import type { Leverandoer } from "./typer";

/**
 * Hvilke modeller findes hos leverandøren lige nu?
 *
 * Anthropic har en liste over sine modeller, som vi henter med platformens
 * nøgle og gemmer i et døgn. Listen siger kun, hvad der FINDES — ikke hvad
 * det koster. Prisen står i pristabellen i modeller.ts. En model på listen,
 * som ikke står i tabellen, kan vælges alligevel; budgetloftet regner så med
 * den højeste kendte pris (se beregnPrisDkk).
 *
 * Hos OpenAI henter vi ingenting: platformens nøgle er en Anthropic-nøgle,
 * og OpenAI-vejen er ikke åbnet endnu. Dér vises pristabellen, som den er.
 */

export type OversigtModel = {
  id: string;
  navn: string;
  beskrivelse: string;
  pris?: { ind: number; ud: number };
  /** Kan vælges. Falsk kun for OpenAI, hvor leverandøren er lukket. */
  klar: boolean;
  /** Falsk for modeller med `ikkeAnbefalet` og for nye, ukendte modeller. */
  anbefalet: boolean;
  /** Ny model fra Anthropics liste, som pristabellen ikke kender endnu. */
  ny: boolean;
};

const ET_DOEGN = 60 * 60 * 24;

/**
 * Henter Anthropics liste. KASTER ved fejl, med vilje: unstable_cache gemmer
 * ikke et kald, der fejler, så et kort nedbrud hos Anthropic bliver ikke
 * hængende som en tom liste i et døgn.
 */
const hentAnthropicListe = unstable_cache(
  async (): Promise<{ id: string; navn: string }[]> => {
    const noegle = process.env.PLATFORM_AI_KEY;
    if (!noegle?.startsWith("sk-ant-")) {
      throw new Error("Platformens nøgle er ikke en Anthropic-nøgle.");
    }

    const klient = new Anthropic({ apiKey: noegle, timeout: 10_000 });
    const liste: { id: string; navn: string }[] = [];

    // Anthropic sender de nyeste først. Den rækkefølge beholder vi.
    for await (const model of klient.models.list({ limit: 100 })) {
      if (model.id.startsWith("claude-")) {
        liste.push({ id: model.id, navn: model.display_name });
      }
    }

    return liste;
  },
  ["anthropic-modelliste"],
  { revalidate: ET_DOEGN },
);

/**
 * Oversigten, adminsiden og Indstillinger viser.
 *
 * - Modeller fra pristabellen, som Anthropic stadig har: kan vælges.
 * - Modeller hos Anthropic, som ikke står i pristabellen: kan også vælges,
 *   men er mærket som nye og ikke anbefalet, til prisen er lagt ind.
 * - Modeller i pristabellen, som Anthropic IKKE længere har: skjules. De er
 *   taget ud af drift, og et kald til dem ville fejle.
 *
 * Fejler hentningen, vises pristabellen, som den er. Valget af model må
 * aldrig afhænge af, at Anthropics liste svarer.
 */
export async function modelOversigt(
  leverandoer: Leverandoer,
): Promise<OversigtModel[]> {
  const kendte = MODELLER[leverandoer];

  const fraTabel = kendte.map((m) => ({
    id: m.id,
    navn: m.navn,
    beskrivelse: m.beskrivelse,
    pris: m.pris,
    klar: m.pris !== undefined,
    anbefalet: !m.ikkeAnbefalet,
    ny: false,
  }));

  if (leverandoer !== "anthropic") return fraTabel;

  let liste: { id: string; navn: string }[];
  try {
    liste = await hentAnthropicListe();
  } catch {
    return fraTabel;
  }

  // En tom liste er mere sandsynligt en fejl end et Anthropic uden modeller.
  if (liste.length === 0) return fraTabel;

  const hentede = new Set(liste.map((m) => m.id));

  // Pristabellens rækkefølge først — den er valgt med omtanke — og derefter
  // resten i Anthropics rækkefølge, nyeste først.
  const valgbare = fraTabel.filter((m) => hentede.has(m.id));

  // Ingen af vores modeller på listen? Så er listen forkert, ikke tabellen.
  if (valgbare.length === 0) return fraTabel;

  const kendteId = new Set(kendte.map((m) => m.id));
  const nye = liste
    .filter((m) => !kendteId.has(m.id) && !FRAVALGTE_MODELLER.has(m.id))
    .map((m) => ({
      id: m.id,
      navn: m.navn,
      beskrivelse: "",
      klar: true,
      anbefalet: false,
      ny: true,
    }));

  return [...valgbare, ...nye];
}

/**
 * Må modellen vælges? Tjekket på serveren, før et valg gemmes.
 *
 * Ja, hvis den står i pristabellen med en pris — eller hvis det er en
 * Anthropic-model, som står på Anthropics egen liste. Listen kommer fra
 * Anthropic, ikke fra browseren, så et modelnavn sendt uden om siden kan
 * ikke snige sig igennem.
 */
export async function kanVaelges(
  leverandoer: Leverandoer,
  id: string,
): Promise<boolean> {
  if (modelErValgbar(leverandoer, id)) return true;
  if (leverandoer !== "anthropic") return false;
  if (FRAVALGTE_MODELLER.has(id)) return false;

  try {
    return (await hentAnthropicListe()).some((m) => m.id === id);
  } catch {
    return false;
  }
}
