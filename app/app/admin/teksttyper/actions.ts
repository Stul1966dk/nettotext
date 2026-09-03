"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { hentAdmin } from "@/lib/admin";
import { adminSkabelonSkema, gemSkabelon } from "@/lib/skabeloner/admin";

/**
 * Gemning af en teksttype.
 *
 * Server action og ikke en API-rute, af samme grund som i indstillinger: der
 * kaldes ingen AI, og formularen skal bare gemme noget.
 *
 * Men her gælder to ting skarpere end noget andet sted i appen:
 *
 *   1. ADMIN-TJEKKET GENTAGES HER. Layoutet under /app/admin har allerede
 *      gjort det, men et layout beskytter en SIDE, ikke en handling. En
 *      server action kan kaldes direkte af enhver, der kender dens navn, og
 *      så er layoutet aldrig kørt.
 *   2. ALT VALIDERES MED ZOD, før noget skrives (sikkerhedsreglernes punkt
 *      7). Felterne kommer fra browseren som JSON, og et felt, databasen
 *      ikke kan tegne, ville ødelægge brief-siden for alle brugere.
 */

export type Svar = { ok: boolean; besked: string };

/** Første fejl oversat til noget, et menneske kan handle på. */
async function fejlbesked(sti: PropertyKey | undefined): Promise<string> {
  const t = await getTranslations("admin");

  switch (sti) {
    case "slug":
      return t("fejlAdresse");
    case "name":
      return t("fejlNavn");
    case "description":
      return t("fejlBeskrivelse");
    case "system_prompt":
      return t("fejlPrompt");
    case "input_fields":
      return t("fejlFelter");
    default:
      return t("fejlUkendt");
  }
}

export async function gemSkabelonAction(
  _forrige: Svar | null,
  formData: FormData,
): Promise<Svar> {
  const admin = await hentAdmin();
  const t = await getTranslations("admin");

  if (!admin) return { ok: false, besked: t("fejlAdgang") };

  let felter: unknown;
  try {
    felter = JSON.parse(String(formData.get("felter") ?? ""));
  } catch {
    return { ok: false, besked: t("fejlFelter") };
  }

  const erNy = formData.get("erNy") === "ja";

  const resultat = adminSkabelonSkema.safeParse({
    slug: String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase(),
    name: formData.get("name"),
    description: formData.get("description"),
    system_prompt: formData.get("system_prompt"),
    input_fields: felter,
    active: formData.get("active") === "on",
  });

  if (!resultat.success) {
    return { ok: false, besked: await fejlbesked(resultat.error.issues[0]?.path[0]) };
  }

  const gemt = await gemSkabelon(resultat.data, admin);

  if (!gemt.ok) {
    // Slog historikken fejl, blev der ikke gemt. Det er med vilje: en
    // ændring, ingen kan spore tilbage, er værre end en, der ikke skete.
    return {
      ok: false,
      besked: gemt.grund === "historik" ? t("fejlHistorik") : t("fejlGem"),
    };
  }

  // Listen over teksttyper, valgsiden og brief-siden viser alle noget, der
  // lige er ændret.
  revalidatePath("/app/admin/teksttyper");
  revalidatePath("/app/ny");
  revalidatePath(`/app/ny/${resultat.data.slug}`);

  // En nystartet teksttype skal videre til sin egen side, så adressen i
  // browseren passer til det, der nu findes.
  if (erNy) redirect(`/app/admin/teksttyper/${resultat.data.slug}`);

  return { ok: true, besked: t("gemt") };
}
