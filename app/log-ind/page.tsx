import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { LogIndFormular } from "./LogIndFormular";

type Props = {
  searchParams: Promise<{ fejl?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("logInd");
  return { title: t("titel") };
}

export default async function LogIndSide({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  const { fejl } = await searchParams;
  const t = await getTranslations("logInd");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-2xl border border-kant bg-kort p-10">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          NettoText
        </p>

        <h1 className="mt-4 text-2xl font-semibold text-gran">
          {t("overskrift")}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-gran-let">
          {t("forklaring")}
        </p>

        {fejl === "link" && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-rav bg-bund px-4 py-3 text-sm text-gran"
          >
            {t("linkVirkedeIkke")}
          </p>
        )}

        <LogIndFormular
          tekster={{
            label: t("label"),
            pladsholder: t("pladsholder"),
            knap: t("knap"),
            sender: t("sender"),
          }}
        />

        <p className="mt-8 border-t border-kant pt-6 text-xs leading-relaxed text-gran-let">
          {t("lukketTest")}
        </p>
      </div>
    </main>
  );
}
