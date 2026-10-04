import "server-only";

import { modelErValgbar, STANDARDMODEL } from "@/lib/ai/modeller";
import type { Leverandoer } from "@/lib/ai/typer";
import { createServiceClient } from "@/lib/supabase/server-service";

/**
 * Modellen, platformens egen nøgle skriver med.
 *
 * Adminen vælger den på adminsidens forside (migration 0031). Den gælder
 * alt, platformen betaler for med prøvekvoten: teksten, omskrivninger,
 * udvidelser og ofte stillede spørgsmål. Brugere med egen nøgle vælger selv
 * under Indstillinger, og idéforslag og faktaudtræk bruger altid den
 * billigste model — se billigsteModel().
 *
 * `app_settings` har ingen policies, så der bruges service_role. Læsningen
 * her er ufarlig at lave for enhver indlogget: den giver et modelnavn, ikke
 * data om nogen. SKRIVNINGEN må kun ske, når kalderen har slået fast med
 * hentAdmin(), at det er adminkontoen (sikkerhedsreglernes punkt 6).
 */

const NOEGLE = "platform_model";

/**
 * Den valgte model — eller standarden, når valget ikke kan bruges.
 *
 * Fejler aldrig. Mangler tabellen, rækken eller forbindelsen, eller står der
 * en model, der er taget af listen eller hører til en anden leverandør end
 * platformens nøgle, skrives teksten med STANDARDMODEL. En indstilling, der
 * ikke kan læses, skal ikke koste brugeren en tekst.
 */
export async function hentPlatformModel(
  leverandoer: Leverandoer,
): Promise<string> {
  try {
    const db = createServiceClient();

    const { data } = await db
      .from("app_settings")
      .select("value")
      .eq("key", NOEGLE)
      .maybeSingle();

    const valgt = data?.value;

    if (typeof valgt === "string" && modelErValgbar(leverandoer, valgt)) {
      return valgt;
    }
  } catch {
    // Falder igennem til standarden.
  }

  return STANDARDMODEL[leverandoer];
}

/** Gemmer valget. Kalderen SKAL have tjekket admin først. */
export async function gemPlatformModel(
  model: string,
  adminId: string,
): Promise<boolean> {
  const db = createServiceClient();

  const { error } = await db.from("app_settings").upsert({
    key: NOEGLE,
    value: model,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  });

  return !error;
}
