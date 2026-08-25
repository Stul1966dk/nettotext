import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { hentSkabelon } from "@/lib/skabeloner/hent";
import { BriefFormular } from "./BriefFormular";

/**
 * Skærm 2: briefen.
 *
 * Formularen tegnes ud fra skabelonens input_fields — der står ingen felter
 * i denne fil. Tilføjes en teksttype i databasen, virker dens formular med
 * det samme.
 *
 * V1 har kun én teksttype, så den er valgt her. Trin 7 lægger et valg foran.
 */

const SKABELON = "blogindlaeg";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ny");
  return { title: t("titel") };
}

export default async function NyTekstSide() {
  const t = await getTranslations("ny");
  const skabelon = await hentSkabelon(SKABELON);

  if (!skabelon) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gran">{t("overskrift")}</h1>
        <p
          role="alert"
          className="rounded-lg border border-rav bg-kort px-4 py-3 text-sm text-gran"
        >
          {t("ingenSkabelon")}
        </p>
        <Link href="/app" className="text-sm text-gran underline">
          {t("tilbage")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
        {skabelon.name}
      </p>

      <h1 className="mt-3 text-2xl font-semibold text-gran">
        {t("overskrift")}
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-gran-let">
        {t("forklaring")}
      </p>

      <BriefFormular
        skabelon={skabelon.slug}
        felter={skabelon.input_fields}
        tekster={{
          paakraevet: t("paakraevet"),
          valgfrit: t("valgfrit"),
          knap: t("knap"),
          manglerFelter: t("manglerFelter"),
        }}
      />
    </div>
  );
}
