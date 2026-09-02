"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import {
  brandprofilSkema,
  hentInstruktioner,
  instruktionSkema,
  INSTRUKTION_LOFT,
  gemBrandprofil,
  sletInstruktion,
  tilfoejInstruktion,
} from "@/lib/personalisering";
import { createClient } from "@/lib/supabase/server";

/**
 * Server actions til personaliseringen — trin 5.
 *
 * Server actions og ikke en API-rute: der kaldes ingen AI, der bruges ingen
 * penge, og formularerne skal bare gemme noget. En rute til hver ville være
 * tre gange så meget kode uden at gøre noget, formularen ikke gør.
 *
 * Sikkerhedsreglernes punkt 7 gælder uændret: alt input valideres med Zod,
 * før noget skrives. Og punkt 4: brugeren slås op med auth.getUser(), ikke
 * med noget, browseren har sendt.
 */

export type Svar = { ok: boolean; besked: string };

/** Fælles indgang: er der en bruger, og hvem er hun? */
async function kraevBruger() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Forbudte ord skrives som én linje adskilt af komma og gemmes som liste.
 *
 * Komma frem for ét ord pr. linje: folk skriver dem alligevel på en linje,
 * og et tekstfelt med usynlige regler er en fælde.
 */
function laesForbudteOrd(raa: string): string[] {
  const set = new Set(
    raa
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );

  return [...set].slice(0, 50);
}

export async function gemBrandprofilAction(
  _forrige: Svar | null,
  data: FormData,
): Promise<Svar> {
  const t = await getTranslations("indstillinger");

  const bruger = await kraevBruger();
  if (!bruger) return { ok: false, besked: t("fejlIkkeLoggetInd") };

  const profil = brandprofilSkema.safeParse({
    beskrivelse: String(data.get("beskrivelse") ?? ""),
    tone: String(data.get("tone") ?? ""),
    forbudteOrd: laesForbudteOrd(String(data.get("forbudteOrd") ?? "")),
    sprogproeve: String(data.get("sprogproeve") ?? ""),
  });

  if (!profil.success) {
    // Rammer kun, hvis nogen sender uden om formularen: felterne har selv
    // maxLength. Beskeden skal derfor være forståelig, ikke udførlig.
    return { ok: false, besked: t("brandForLangt") };
  }

  try {
    await gemBrandprofil(bruger.id, profil.data);
  } catch (fejl) {
    console.error("Kunne ikke gemme brand-profil:", fejl);
    return { ok: false, besked: t("fejlUkendt") };
  }

  revalidatePath("/app/indstillinger");
  return { ok: true, besked: t("brandGemt") };
}

export async function tilfoejInstruktionAction(
  _forrige: Svar | null,
  data: FormData,
): Promise<Svar> {
  const t = await getTranslations("indstillinger");

  const bruger = await kraevBruger();
  if (!bruger) return { ok: false, besked: t("fejlIkkeLoggetInd") };

  const indhold = instruktionSkema.safeParse(data.get("indhold"));
  if (!indhold.success) return { ok: false, besked: t("instrTom") };

  // Loftet håndhæves her og ikke i databasen: et antal er en produktregel,
  // ikke en integritetsregel, og den skal kunne ændres uden en migration.
  if ((await hentInstruktioner()).length >= INSTRUKTION_LOFT) {
    return { ok: false, besked: t("instrForMange", { loft: INSTRUKTION_LOFT }) };
  }

  try {
    await tilfoejInstruktion(bruger.id, indhold.data);
  } catch (fejl) {
    console.error("Kunne ikke gemme instruktion:", fejl);
    return { ok: false, besked: t("fejlUkendt") };
  }

  revalidatePath("/app/indstillinger");
  return { ok: true, besked: t("instrTilfoejet") };
}

export async function sletInstruktionAction(data: FormData): Promise<void> {
  const bruger = await kraevBruger();
  if (!bruger) return;

  const id = z.uuid().safeParse(data.get("id"));
  if (!id.success) return;

  try {
    // Ejerskabet afgøres af RLS. Et id, hun ikke ejer, rammer ingenting.
    await sletInstruktion(id.data);
  } catch (fejl) {
    console.error("Kunne ikke slette instruktion:", fejl);
  }

  revalidatePath("/app/indstillinger");
}
