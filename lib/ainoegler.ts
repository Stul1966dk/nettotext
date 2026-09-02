import "server-only";

import { byggAdapter } from "@/lib/ai";
import { AiFejl, type Leverandoer } from "@/lib/ai/typer";
import { dekrypter, krypter, noegleHint } from "@/lib/kryptering";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Brugerens egen AI-nøgle — CLAUDE.md regel 2.
 *
 * Nøglen krypteres, før den forlader denne fil, og dekrypteres kun to steder:
 * i genererings-øjeblikket og når brugeren trykker "Test forbindelsen".
 * Den sendes ALDRIG tilbage til klienten — kun `hint`, de sidste fire tegn.
 *
 * Læsning og skrivning af selve rækken går gennem brugerens egen forbindelse,
 * så Row Level Security afgør ejerskabet. Der er ét sted, der bruger
 * service_role — `hentNoegleTilBrug` — fordi kolonnen `encrypted_key` med
 * vilje ikke kan læses gennem en login-forbindelse. Dér verificeres
 * ejerskabet i hånden, jf. sikkerhedsreglernes punkt 6.
 */

/** Alt, brugeren nogensinde får at se om sin gemte nøgle. */
export type NoegleInfo = {
  leverandoer: Leverandoer;
  model: string;
  /** De sidste fire tegn. Aldrig mere end det. */
  hint: string;
  sidstValideret: string | null;
};

/**
 * Ser nøglen ud som en nøgle fra den leverandør, brugeren har valgt?
 *
 * Et billigt tjek, der fanger den almindeligste fejl: at have valgt Claude
 * og indsat sin ChatGPT-nøgle. Vi afviser ikke på formen alene — kun når vi
 * er sikre — men kan vi sige det med det samme, sparer vi brugeren for et
 * kald, der alligevel ville blive afvist.
 */
export function noegleMatcherLeverandoer(
  leverandoer: Leverandoer,
  apiNoegle: string,
): boolean {
  const anthropic = apiNoegle.startsWith("sk-ant-");
  return leverandoer === "anthropic" ? anthropic : !anthropic;
}

/**
 * Prøver nøglen af med det mindst mulige kald.
 *
 * Der findes ingen "tjek nøglen"-funktion hos leverandørerne — den eneste
 * ærlige måde at vide, om en nøgle virker, er at bruge den. Kaldet koster
 * en brøkdel af en øre og betales af brugerens egen konto, hvilket er
 * pointen: virker det ikke her, virker det heller ikke, når hun skriver.
 *
 * Kaster AiFejl med en årsag, ruten kan oversætte til dansk.
 */
export async function testNoegle(
  leverandoer: Leverandoer,
  model: string,
  apiNoegle: string,
): Promise<void> {
  const adapter = byggAdapter(leverandoer, apiNoegle);

  await adapter.generate({
    system: "Svar præcis med ordet: ok",
    bruger: "ok",
    model,
    maxTokens: 16,
  });
}

/** Brugerens gemte nøgle — uden selve nøglen. Null, hvis hun ingen har. */
export async function hentNoegleInfo(): Promise<NoegleInfo | null> {
  const supabase = await createClient();

  // Bemærk at encrypted_key ikke står her, og ikke KAN stå her: kolonnen er
  // taget fra `authenticated` i migration 0012. RLS giver kun brugerens
  // egen række, så der er ingen ejer-betingelse at glemme.
  const { data, error } = await supabase
    .from("ai_keys")
    .select("provider, model, key_hint, last_validated_at")
    .maybeSingle();

  if (error || !data) return null;

  return {
    leverandoer: data.provider as Leverandoer,
    model: data.model,
    hint: data.key_hint,
    sidstValideret: data.last_validated_at,
  };
}

/**
 * Gemmer nøglen krypteret. Erstatter den, brugeren måtte have i forvejen.
 *
 * `last_validated_at` sættes her, fordi ruten altid tester nøglen FØR den
 * gemmes. Vi gemmer aldrig en nøgle, vi ikke har set virke.
 */
export async function gemNoegle(
  brugerId: string,
  leverandoer: Leverandoer,
  model: string,
  apiNoegle: string,
): Promise<void> {
  const supabase = await createClient();

  // Ingen .select() bagefter: så beder PostgREST ikke om rækken retur, og
  // vi rammer ikke den kolonne, login-forbindelsen ikke må læse.
  const { error } = await supabase.from("ai_keys").upsert(
    {
      user_id: brugerId,
      provider: leverandoer,
      encrypted_key: krypter(apiNoegle.trim()),
      key_hint: noegleHint(apiNoegle),
      model,
      last_validated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Kunne ikke gemme nøglen: ${error.message}`);
  }
}

/** Skifter model uden at bede om nøglen igen. */
export async function opdaterModel(
  brugerId: string,
  model: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ai_keys")
    .update({ model })
    .eq("user_id", brugerId);

  if (error) {
    throw new Error(`Kunne ikke skifte model: ${error.message}`);
  }
}

/** Noterer, at nøglen virkede lige nu. Vises som "sidst afprøvet". */
export async function markerValideret(brugerId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ai_keys")
    .update({ last_validated_at: new Date().toISOString() })
    .eq("user_id", brugerId);

  if (error) {
    throw new Error(`Kunne ikke opdatere nøglen: ${error.message}`);
  }
}

export async function sletNoegle(brugerId: string): Promise<void> {
  const supabase = await createClient();

  // RLS' delete-policy slipper kun brugerens egen række igennem; betingelsen
  // her er en ekstra sele, ikke selve låsen.
  const { error } = await supabase
    .from("ai_keys")
    .delete()
    .eq("user_id", brugerId);

  if (error) {
    throw new Error(`Kunne ikke slette nøglen: ${error.message}`);
  }
}

/**
 * Henter og DEKRYPTERER nøglen. Det eneste sted, klarteksten findes.
 *
 * Kaldes af genereringen og af "Test forbindelsen" — aldrig af noget, der
 * sender svaret videre til browseren.
 *
 * Her bruges service_role, fordi `encrypted_key` ikke kan læses gennem en
 * login-forbindelse. Sikkerhedsreglernes punkt 6 gælder derfor: `brugerId`
 * SKAL komme fra auth.getUser() på serveren, aldrig fra noget browseren har
 * sendt. Filteret nedenfor er hele ejer-tjekket.
 */
export async function hentNoegleTilBrug(brugerId: string): Promise<{
  leverandoer: Leverandoer;
  model: string;
  apiNoegle: string;
} | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ai_keys")
    .select("provider, model, encrypted_key")
    .eq("user_id", brugerId)
    .maybeSingle();

  if (error || !data) return null;

  try {
    return {
      leverandoer: data.provider as Leverandoer,
      model: data.model,
      apiNoegle: dekrypter(data.encrypted_key),
    };
  } catch (fejl) {
    // Dekrypteringen fejler, hvis rækken er ændret, eller hvis ENCRYPTION_KEY
    // er en anden end dengang nøglen blev gemt. Begge dele er alvorlige og
    // hører til i loggen — brugeren skal blot bede om at indsætte nøglen igen.
    console.error("Kunne ikke dekryptere brugerens AI-nøgle:", fejl);
    throw new AiFejl("ugyldig_noegle", "Den gemte nøgle kunne ikke læses.");
  }
}
