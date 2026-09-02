import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AiForbindelseSektion } from "@/components/ai-forbindelse/AiForbindelseSektion";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("indstillinger");
  return { title: t("titel") };
}

/**
 * Indstillinger — i V1 kun AI-forbindelsen.
 *
 * Profil og brand-profil hører til trin 5 og får deres egne afsnit her.
 */
export default async function Indstillinger() {
  const t = await getTranslations("indstillinger");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gran">{t("overskrift")}</h1>
        <Link
          href="/app"
          className="inline-block text-sm text-gran-let underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
        >
          {t("tilbage")}
        </Link>
      </div>

      <section className="space-y-6 rounded-2xl border border-kant bg-kort p-8">
        <div className="space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
            {t("aiOverskrift")}
          </h2>
          <p className="text-sm leading-relaxed text-gran-let">
            {t("aiForklaring")}
          </p>
          <Link
            href="/app/opsaetning"
            className="inline-block text-sm text-gran underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
          >
            {t("tilGuide")}
          </Link>
        </div>

        <AiForbindelseSektion />
      </section>
    </div>
  );
}
