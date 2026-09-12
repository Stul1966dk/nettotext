import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { hentFejltal, hentSenesteFejl, VIST_GRAENSE } from "@/lib/fejloversigt";

/**
 * Fejlloggen.
 *
 * Layoutet over siden har allerede slået fast, at det er adminkontoen.
 * Først DEREFTER læses tabellen med service_role — rækkefølgen i
 * sikkerhedsreglernes punkt 6.
 *
 * Siden viser aldrig tekstindhold, for der står intet. Saneringen sker,
 * når fejlen skrives (lib/fejl.ts), ikke her.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("fejlTitel") };
}

function tidspunkt(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

export default async function FejlSide() {
  const t = await getTranslations("admin");
  const [fejl, tal] = await Promise.all([hentSenesteFejl(), hentFejltal()]);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("mono")}
        </p>
        <h1 className="text-2xl font-semibold text-gran">
          {t("fejlOverskrift")}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-gran-let">
          {t("fejlForklaring")}
        </p>
      </div>

      {tal && (
        <p className="font-mono text-sm text-gran-let">
          {t("fejlDoegn", { antal: tal.doegn })} · {t("fejlIalt", { antal: tal.ialt })}
        </p>
      )}

      {fejl.length === 0 ? (
        <p className="rounded-2xl border border-kant bg-kort p-6 text-sm leading-relaxed text-gran-let">
          {t("fejlIngen")}
        </p>
      ) : (
        <div className="space-y-3">
          {fejl.map((f) => (
            <article
              key={f.id}
              className="rounded-2xl border border-kant bg-kort p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-mono text-sm font-medium text-gran">
                  {f.sted}
                </p>
                <p className="font-mono text-xs text-gran-let">
                  {tidspunkt(f.created_at)}
                </p>
              </div>

              <p className="mt-2 text-sm leading-relaxed break-words text-gran">
                {f.besked}
              </p>

              <p className="mt-3 font-mono text-xs text-gran-let">
                {Object.entries(f.ekstra).map(([navn, vaerdi]) => (
                  <span key={navn} className="mr-3">
                    {navn}: {String(vaerdi)}
                  </span>
                ))}
                {f.user_id && (
                  <span title={f.user_id}>
                    {t("fejlBruger", { id: f.user_id.slice(0, 8) })}
                  </span>
                )}
              </p>

              {f.spor && (
                <details className="mt-3">
                  <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-gran-let outline-none focus-visible:ring-2 focus-visible:ring-gran">
                    {t("fejlSpor")}
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-kant bg-bund p-3 font-mono text-xs leading-relaxed text-gran-let">
                    {f.spor}
                  </pre>
                </details>
              )}
            </article>
          ))}

          {fejl.length === VIST_GRAENSE && (
            <p className="font-mono text-xs text-gran-let">
              {t("fejlAfkortet", { antal: VIST_GRAENSE })}
            </p>
          )}
        </div>
      )}

      <Link
        href="/app/admin"
        className="inline-block text-sm text-gran-let underline outline-none focus-visible:ring-2 focus-visible:ring-gran"
      >
        {t("tilbageAdmin")}
      </Link>
    </div>
  );
}
