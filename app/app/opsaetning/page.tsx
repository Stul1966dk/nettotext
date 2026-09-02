import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AiForbindelseSektion } from "@/components/ai-forbindelse/AiForbindelseSektion";
import {
  LEVERANDOER_KONSOL,
  LEVERANDOER_NAVN,
  leverandoerErKlar,
} from "@/lib/ai/modeller";
import { LEVERANDOERER, type Leverandoer } from "@/lib/ai/typer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("opsaetning");
  return { title: t("titel") };
}

type Trin = { overskrift: string; tekst: string };

/**
 * Opsætnings-guiden — trinvis vej til en nøgle hos leverandøren.
 *
 * Vises, når prøvekvoten er brugt, og fra indstillinger.
 *
 * **Kun leverandører, der faktisk kan vælges, får en guide.** Reglen er den
 * samme som i indstillinger: en model uden kendt pris kan ikke vælges, og
 * dermed kan leverandøren det heller ikke. En guide til en leverandør, man
 * ikke kan bruge bagefter, er en blindgyde — og guiden her har ét formål: at
 * få brugeren fra ingenting til en nøgle, der virker.
 *
 * Teksten til den anden leverandør er skrevet og ligger klar i `da.json`.
 * Den viser sig af sig selv, den dag priserne bliver slået op.
 */
export default async function Opsaetning() {
  const t = await getTranslations("opsaetning");

  const klare = LEVERANDOERER.filter(leverandoerErKlar);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gran">{t("overskrift")}</h1>
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("tid")}
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-kant bg-kort p-8">
        <p className="leading-relaxed text-gran">{t("forklaring")}</p>
        <p className="text-sm leading-relaxed text-gran-let">{t("koster")}</p>
      </section>

      {klare.map((leverandoer) => (
        <Guide key={leverandoer} leverandoer={leverandoer} />
      ))}

      <section className="space-y-6 rounded-2xl border border-kant bg-kort p-8">
        <div className="space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
            {t("indsaetOverskrift")}
          </h2>
          <p className="text-sm leading-relaxed text-gran-let">
            {t("indsaetForklaring")}
          </p>
        </div>

        <AiForbindelseSektion />
      </section>

      <Link
        href="/app"
        className="inline-block text-sm text-gran-let underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
      >
        {t("tilbage")}
      </Link>
    </div>
  );
}

/** Trinnene for én leverandør. */
async function Guide({ leverandoer }: { leverandoer: Leverandoer }) {
  const t = await getTranslations("opsaetning");

  const navn = LEVERANDOER_NAVN[leverandoer];
  const trin = t.raw(
    leverandoer === "anthropic" ? "anthropicTrin" : "openaiTrin",
  ) as Trin[];

  return (
    <section className="space-y-6 rounded-2xl border border-kant bg-kort p-8">
      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
          {navn}
        </h2>
        <p className="text-sm leading-relaxed text-gran-let">
          {t("forbehold")}
        </p>
      </div>

      <ol className="space-y-6">
        {trin.map((et, nummer) => (
          <li key={et.overskrift} className="flex gap-4">
            {/* Rav er husets sparsomme accent — trinnumre er netop dét,
                den er til. Aldrig store flader. */}
            <span
              aria-hidden
              className="mt-0.5 shrink-0 font-mono text-sm font-semibold text-rav"
            >
              {nummer + 1}
            </span>
            <div className="space-y-1">
              <h3 className="font-medium text-gran">{et.overskrift}</h3>
              <p className="text-sm leading-relaxed text-gran-let">
                {et.tekst}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <a
        href={LEVERANDOER_KONSOL[leverandoer]}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg border border-kant px-5 py-2.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
      >
        {t("aabnKonsol", { navn })}
      </a>
    </section>
  );
}
