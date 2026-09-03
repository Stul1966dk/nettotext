import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { hentSkabeloner } from "@/lib/skabeloner/hent";

/**
 * Skærm 1 af to: hvilken slags tekst?
 *
 * Siden havde ingen grund til at findes, så længe der kun var én teksttype.
 * Med produktteksten er der to, og listen hentes fra databasen af samme
 * grund som formularen gør det: teksttyper er data. En ny teksttype dukker
 * op her, når dens migrationsfil er kørt, uden at nogen retter i appen.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ny");
  return { title: t("vaelgTitel") };
}

export default async function VaelgTeksttype() {
  const t = await getTranslations("ny");
  const skabeloner = await hentSkabeloner();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-gran">
          {t("vaelgOverskrift")}
        </h1>
        <p className="text-sm leading-relaxed text-gran-let">
          {t("vaelgForklaring")}
        </p>
      </div>

      {skabeloner.length === 0 ? (
        <p
          role="alert"
          className="rounded-lg border border-rav bg-kort px-4 py-3 text-sm text-gran"
        >
          {t("ingenSkabelon")}
        </p>
      ) : (
        <div className="space-y-4">
          {skabeloner.map((skabelon) => (
            <Link
              key={skabelon.slug}
              href={`/app/ny/${skabelon.slug}`}
              className="block rounded-2xl border border-kant bg-kort p-6 outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
            >
              <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
                {t("teksttype")}
              </p>
              <h2 className="mt-3 text-lg font-medium text-gran">
                {skabelon.name}
              </h2>
              {skabelon.description && (
                <p className="mt-2 text-sm leading-relaxed text-gran-let">
                  {skabelon.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/app"
        className="inline-block text-sm text-gran-let underline outline-none focus-visible:ring-2 focus-visible:ring-gran"
      >
        {t("tilbage")}
      </Link>
    </div>
  );
}
