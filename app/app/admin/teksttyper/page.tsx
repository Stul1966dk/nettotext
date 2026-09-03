import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { hentAlleSkabeloner } from "@/lib/skabeloner/admin";

/**
 * Listen over teksttyper.
 *
 * Layoutet ovenfor har allerede slået fast, at det er adminkontoen. Først
 * DEREFTER hentes data med service_role — rækkefølgen i
 * sikkerhedsreglernes punkt 6.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("teksttyperTitel") };
}

function datoTekst(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function TeksttyperSide() {
  const t = await getTranslations("admin");
  const skabeloner = await hentAlleSkabeloner();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("mono")}
        </p>
        <h1 className="text-2xl font-semibold text-gran">
          {t("teksttyperOverskrift")}
        </h1>
        <p className="text-sm leading-relaxed text-gran-let">
          {t("teksttyperForklaring")}
        </p>
      </div>

      <div className="space-y-4">
        {skabeloner.map((skabelon) => (
          <Link
            key={skabelon.slug}
            href={`/app/admin/teksttyper/${skabelon.slug}`}
            className="block rounded-2xl border border-kant bg-kort p-6 outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-medium text-gran">{skabelon.name}</h2>
              <span className="font-mono text-xs uppercase tracking-widest text-gran-let">
                {skabelon.active ? t("aktiv") : t("kladde")}
              </span>
            </div>

            {skabelon.description && (
              <p className="mt-2 text-sm leading-relaxed text-gran-let">
                {skabelon.description}
              </p>
            )}

            <p className="mt-3 font-mono text-xs text-gran-let">
              {t("felterAntal", { antal: skabelon.input_fields.length })} ·{" "}
              {t("aendret", { dato: datoTekst(skabelon.updated_at) })}
            </p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/app/admin/teksttyper/ny"
          className="inline-block rounded-lg bg-gran px-6 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
        >
          {t("nyTeksttype")}
        </Link>

        <Link
          href="/app"
          className="text-sm text-gran-let underline outline-none focus-visible:ring-2 focus-visible:ring-gran"
        >
          {t("tilbage")}
        </Link>
      </div>
    </div>
  );
}
