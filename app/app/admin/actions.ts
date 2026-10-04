"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { findModel, modelErValgbar, platformensLeverandoer } from "@/lib/ai";
import { hentAdmin } from "@/lib/admin";
import { gemPlatformModel } from "@/lib/platformmodel";

/**
 * Adminen vælger, hvilken model platformens nøgle skriver med.
 *
 * Samme to regler som i teksttypernes action:
 *
 *   1. ADMIN-TJEKKET GENTAGES HER. Layoutet beskytter siden, ikke
 *      handlingen: en server action kan kaldes direkte.
 *   2. INPUT VALIDERES, før noget skrives. Modellen skal stå på den
 *      kuraterede liste, høre til platformens leverandør og have en pris —
 *      ellers ville budgetloftet tælle forkert. Se modelErValgbar().
 */

export type ModelSvar = { ok: boolean; besked: string };

const skema = z.object({ model: z.string().min(1).max(64) });

export async function gemPlatformModelAction(
  _forrige: ModelSvar | null,
  formData: FormData,
): Promise<ModelSvar> {
  const admin = await hentAdmin();
  const t = await getTranslations("admin");

  if (!admin) return { ok: false, besked: t("modelFejlAdgang") };

  const resultat = skema.safeParse({ model: formData.get("model") });
  const leverandoer = platformensLeverandoer();

  if (
    !resultat.success ||
    !leverandoer ||
    !modelErValgbar(leverandoer, resultat.data.model)
  ) {
    return { ok: false, besked: t("modelFejl") };
  }

  if (!(await gemPlatformModel(resultat.data.model, admin.id))) {
    return { ok: false, besked: t("modelFejl") };
  }

  revalidatePath("/app/admin");

  return {
    ok: true,
    besked: t("modelGemt", {
      model: findModel(resultat.data.model)?.navn ?? resultat.data.model,
    }),
  };
}
