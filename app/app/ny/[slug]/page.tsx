import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { hentSkabelon } from "@/lib/skabeloner/hent";
import { BriefFormular } from "./BriefFormular";

/**
 * Skærm 2: briefen.
 *
 * Formularen tegnes ud fra skabelonens input_fields — der står ingen felter
 * i denne fil. Tilføjes en teksttype i databasen, virker dens formular med
 * det samme.
 *
 * Teksttypen kommer nu fra adressen og ikke fra en konstant i koden. Det var
 * den eneste kodeændring, den anden teksttype krævede.
 */

type Props = {
  params: Promise<{ slug: string }>;
  /**
   * `genbrug=1` betyder, at brugeren kom hertil fra "Skriv en til" i
   * editoren. Så fyldes formularen ud med det, hun skrev sidst. Selve
   * værdierne hentes i browseren fra kladden — de har aldrig været på
   * serveren i den her forespørgsel.
   */
  searchParams: Promise<{ genbrug?: string }>;
};

/**
 * Fejlkategorierne fra /api/ideas. Ruten svarer med en kategori, aldrig med
 * en besked — beskederne står i sprogfilen, som alt andet i UI'et.
 */
const IDE_FEJLNOEGLER = [
  "ikke_logget_ind",
  "ugyldig_anmodning",
  "ugyldig_brief",
  "ukendt_skabelon",
  "ingen_ideer",
  "mangler_grundlag",
  "mangler_noegle",
  "budget_opbrugt",
  "for_mange_kald",
  "ugyldig_noegle",
  "tom_saldo",
  "rate_limit",
  "tomt_svar",
  "for_lang",
  "afvist",
  "serverfejl",
  "ukendt",
  "netvaerk",
] as const;

/** Skal svare til `aarsag`-værdierne fra /api/fakta. */
const FAKTA_FEJLNOEGLER = [
  "ikke_logget_ind",
  "ugyldig_anmodning",
  "for_lang_tekst",
  "ukendt_skabelon",
  "intet_faktafelt",
  "ingen_fakta",
  "mangler_noegle",
  "budget_opbrugt",
  "for_mange_kald",
  "ugyldig_noegle",
  "tom_saldo",
  "rate_limit",
  "tomt_svar",
  "for_lang",
  "afvist",
  "serverfejl",
  "ukendt",
  "netvaerk",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ny");
  return { title: t("titel") };
}

export default async function NyTekstSide({ params, searchParams }: Props) {
  const { slug } = await params;
  const { genbrug } = await searchParams;
  const t = await getTranslations("ny");
  const ideFejl = await getTranslations("ny.ideFejl");
  const faktaFejl = await getTranslations("ny.faktaFejl");
  const skabelon = await hentSkabelon(slug);

  if (!skabelon) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gran">{t("overskrift")}</h1>
        <p
          role="alert"
          className="rounded-lg border border-rav bg-kort px-4 py-3 text-sm text-gran"
        >
          {t("ingenSkabelon")}
        </p>
        <Link href="/app/ny" className="text-sm text-gran underline">
          {t("tilbageTilValg")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
        {skabelon.name}
      </p>

      <h1 className="mt-3 text-2xl font-semibold text-gran">
        {t("overskrift")}
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-gran-let">
        {t("forklaring")}
      </p>

      {/* Fortryder man valget af teksttype, skal man ikke tilbage forbi
          dashboardet for at rette det. */}
      <Link
        href="/app/ny"
        className="mt-4 inline-block text-sm text-gran-let underline outline-none focus-visible:ring-2 focus-visible:ring-gran"
      >
        {t("skiftType")}
      </Link>

      <BriefFormular
        genbrug={genbrug === "1"}
        skabelon={skabelon.slug}
        felter={skabelon.input_fields}
        tekster={{
          paakraevet: t("paakraevet"),
          valgfrit: t("valgfrit"),
          knap: t("knap"),
          manglerFelter: t("manglerFelter"),
          ansvar: t("ansvar"),
          genbrugt: t("genbrugt"),
          instruktion: t("instruktion"),
          instruktionHjaelp: t("instruktionHjaelp"),
          instruktionPladsholder: t("instruktionPladsholder"),
          stiltone: t("stiltone"),
          stiltoneHjaelp: t("stiltoneHjaelp"),
          stiltoneValg: {
            noegtern: t("stiltoneNoegtern"),
            imoedekommende: t("stiltoneImoedekommende"),
            saelgende: t("stiltoneSaelgende"),
          },
          ideKnap: t("ideKnap"),
          ideIgen: t("ideIgen"),
          ideHenter: t("ideHenter"),
          ideHjaelp: t("ideHjaelp"),
          ideOverskrift: t("ideOverskrift"),
          ideFejl: Object.fromEntries(
            IDE_FEJLNOEGLER.map((noegle) => [noegle, ideFejl(noegle)]),
          ),
          faktaLabel: t("faktaLabel"),
          faktaHjaelp: t("faktaHjaelp"),
          faktaPladsholder: t("faktaPladsholder"),
          faktaKnap: t("faktaKnap"),
          faktaHenter: t("faktaHenter"),
          faktaGratis: t("faktaGratis"),
          faktaLagt: t.raw("faktaLagt") as string,
          faktaKlippet: t.raw("faktaKlippet") as string,
          faktaFejl: Object.fromEntries(
            FAKTA_FEJLNOEGLER.map((noegle) => [noegle, faktaFejl(noegle)]),
          ),
        }}
      />
    </div>
  );
}
