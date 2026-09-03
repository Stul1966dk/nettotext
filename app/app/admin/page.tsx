import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Adminsidens forside.
 *
 * Kun teksttyperne indtil videre. Tallene — forbrug, budget, brugere,
 * prøvekvote — er beskrevet i docs/status.md og hører til her, når de bygges.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("forsideTitel") };
}

export default async function AdminForside() {
  const t = await getTranslations("admin");

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("mono")}
        </p>
        <h1 className="text-2xl font-semibold text-gran">{t("forside")}</h1>
      </div>

      <Link
        href="/app/admin/teksttyper"
        className="block rounded-2xl border border-kant bg-kort p-6 outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
      >
        <h2 className="text-lg font-medium text-gran">
          {t("teksttyperOverskrift")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gran-let">
          {t("teksttyperForklaring")}
        </p>
      </Link>

      <Link
        href="/app"
        className="inline-block text-sm text-gran-let underline outline-none focus-visible:ring-2 focus-visible:ring-gran"
      >
        {t("tilbage")}
      </Link>
    </div>
  );
}
