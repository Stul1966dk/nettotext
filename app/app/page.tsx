import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("titel") };
}

export default async function Dashboard() {
  const supabase = await createClient();
  const t = await getTranslations("app");

  // RLS sørger for, at der kun kan hentes én række: brugerens egen.
  const { data: profil } = await supabase
    .from("profiles")
    .select("trial_quota, trial_used")
    .maybeSingle();

  const tilbage = profil
    ? Math.max(profil.trial_quota - profil.trial_used, 0)
    : null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gran">{t("overskrift")}</h1>

      <section className="rounded-2xl border border-kant bg-kort p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("kvoteLabel")}
        </p>

        {tilbage === null ? (
          <p className="mt-3 text-sm text-gran-let">{t("kvoteUkendt")}</p>
        ) : (
          <>
            <p className="mt-3 text-lg text-gran">
              {t("kvote", { tilbage, ialt: profil!.trial_quota })}
            </p>
            <p className="mt-2 text-sm text-gran-let">{t("kvoteForklaring")}</p>
          </>
        )}
      </section>

      <p className="text-sm text-gran-let">{t("naesteTrin")}</p>
    </div>
  );
}
