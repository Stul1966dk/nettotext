"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { hentAdmin } from "@/lib/admin";
import { hentSkabelonTilRedigering } from "@/lib/skabeloner/admin";
import {
  gemMateriale,
  materialeSkema,
  sletMateriale,
} from "@/lib/skabeloner/materiale";

/**
 * Materiale til en teksttype: gem og slet.
 *
 * Samme to regler som i ./actions.ts: admin-tjekket gentages her, fordi en
 * server action kan kaldes uden om siden, og alt valideres med Zod, før
 * noget skrives.
 *
 * Teksttypen findes ud fra slug'en på SERVEREN. Browseren sender ikke et
 * template-id, den kunne have byttet om på.
 */

export type MaterialeSvar = { ok: boolean; besked: string };

const idSkema = z.string().uuid();

async function findTeksttype(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  return hentSkabelonTilRedigering(slug);
}

export async function gemMaterialeAction(
  _forrige: MaterialeSvar | null,
  formData: FormData,
): Promise<MaterialeSvar> {
  const t = await getTranslations("admin");

  if (!(await hentAdmin())) return { ok: false, besked: t("fejlAdgang") };

  const skabelon = await findTeksttype(formData);
  if (!skabelon) return { ok: false, besked: t("fejlUkendt") };

  const raaId = String(formData.get("id") ?? "");
  const id = raaId ? idSkema.safeParse(raaId) : null;
  if (id && !id.success) return { ok: false, besked: t("fejlUkendt") };

  const materiale = materialeSkema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    content: formData.get("content"),
    active: formData.get("active") === "on",
  });

  if (!materiale.success) {
    const felt = materiale.error.issues[0]?.path[0];
    return {
      ok: false,
      besked:
        felt === "title"
          ? t("materialeFejlTitel")
          : felt === "content"
            ? t("materialeFejlIndhold")
            : t("fejlUkendt"),
    };
  }

  const gemt = await gemMateriale(
    skabelon.id,
    id ? id.data : null,
    materiale.data,
  );

  if (!gemt.ok) {
    return {
      ok: false,
      besked: gemt.grund === "loft" ? t("materialeFejlLoft") : t("fejlGem"),
    };
  }

  revalidatePath(`/app/admin/teksttyper/${skabelon.slug}`);
  return { ok: true, besked: t("materialeGemt") };
}

export async function sletMaterialeAction(
  _forrige: MaterialeSvar | null,
  formData: FormData,
): Promise<MaterialeSvar> {
  const t = await getTranslations("admin");

  if (!(await hentAdmin())) return { ok: false, besked: t("fejlAdgang") };

  const skabelon = await findTeksttype(formData);
  const id = idSkema.safeParse(formData.get("id"));
  if (!skabelon || !id.success) return { ok: false, besked: t("fejlUkendt") };

  if (!(await sletMateriale(skabelon.id, id.data))) {
    return { ok: false, besked: t("fejlGem") };
  }

  revalidatePath(`/app/admin/teksttyper/${skabelon.slug}`);
  return { ok: true, besked: t("materialeSlettet") };
}
