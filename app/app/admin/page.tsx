import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LEVERANDOER_NAVN, platformensLeverandoer, valgbareModeller } from "@/lib/ai";
import { hentFejltal } from "@/lib/fejloversigt";
import { hentPlatformModel } from "@/lib/platformmodel";

import { Noegletal } from "./Noegletal";
import { Platformmodel } from "./Platformmodel";

/**
 * Adminsidens forside.
 *
 * Nøgletallene øverst, derefter teksttyperne og fejlloggen.
 *
 * Fejltallet står PÅ forsiden og ikke bag et klik. Vi har fravalgt Sentry
 * og får derfor ingen besked, når noget brænder; så skal tallet i det
 * mindste møde en, der alligevel kigger forbi.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("forsideTitel") };
}

export default async function AdminForside() {
  const t = await getTranslations("admin");
  const fejltal = await hentFejltal();

  // Layoutet har allerede slået fast, at det er adminen. Modellerne er dem,
  // der hører til platformens nøgle og har en pris — de eneste, der må vælges.
  const leverandoer = platformensLeverandoer();
  const modeller = leverandoer ? valgbareModeller(leverandoer) : [];
  const valgtModel = leverandoer ? await hentPlatformModel(leverandoer) : "";

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("mono")}
        </p>
        <h1 className="text-2xl font-semibold text-gran">{t("forside")}</h1>
      </div>

      <Noegletal />

      {leverandoer && modeller.length > 0 && (
        <Platformmodel
          valgt={valgtModel}
          modeller={modeller.map((m) => ({
            id: m.id,
            navn: m.navn,
            beskrivelse: m.beskrivelse,
            pris: m.pris
              ? t("modelPris", { ind: m.pris.ind, ud: m.pris.ud })
              : "",
          }))}
          tekster={{
            overskrift: t("modelOverskrift"),
            forklaring: t("modelForklaring", {
              leverandoer: LEVERANDOER_NAVN[leverandoer],
            }),
            budget: t("modelBudget"),
            gem: t("modelGem"),
            gemmer: t("gemmer"),
          }}
        />
      )}

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
        href="/app/admin/fejl"
        className="block rounded-2xl border border-kant bg-kort p-6 outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium text-gran">
            {t("fejlOverskrift")}
          </h2>
          <span
            className={`font-mono text-xs uppercase tracking-widest ${
              fejltal && fejltal.doegn > 0 ? "text-rav" : "text-gran-let"
            }`}
          >
            {fejltal
              ? t("fejlDoegn", { antal: fejltal.doegn })
              : t("fejlTalUkendt")}
          </span>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-gran-let">
          {t("fejlKortForklaring")}
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
