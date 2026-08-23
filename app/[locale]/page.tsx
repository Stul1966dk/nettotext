import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("titel"),
    description: t("beskrivelse"),
  };
}

export default async function Forside({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("forside");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-xl rounded-2xl border border-kant bg-kort p-10">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("navn")}
        </p>

        <h1 className="mt-4 text-3xl font-semibold leading-tight text-gran sm:text-4xl">
          {t("overskrift")}
        </h1>

        <p className="mt-5 text-base leading-relaxed text-gran-let">
          {t("loefte")}
        </p>

        <p className="mt-8 border-t border-kant pt-6 font-mono text-sm text-gran-let">
          {t("status")}
        </p>
      </div>
    </main>
  );
}
