import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Generering } from "./Generering";

/**
 * Skærm 3: teksten.
 *
 * Trin 3 gør den til den rigtige editor. Blokke og meta-felter er på plads;
 * regenerering af enkelte sektioner og eksport mangler stadig.
 */

/** Skal svare til `aarsag`-værdierne fra /api/generate og lib/ai/typer.ts. */
const FEJLNOEGLER = [
  "ikke_logget_ind",
  "ugyldig_anmodning",
  "ugyldig_brief",
  "ukendt_skabelon",
  "mangler_noegle",
  "ugyldig_noegle",
  "tom_saldo",
  "rate_limit",
  "for_lang",
  "afvist",
  "serverfejl",
  "ukendt",
  "netvaerk",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("skriv");
  return { title: t("titel") };
}

export default async function SkrivSide() {
  const t = await getTranslations("skriv");
  const fejl = await getTranslations("skriv.fejl");

  // Fejlbeskederne slås op på serveren og sendes med som almindelige strenge.
  // Så slipper klient-komponenten for at trække en sprog-provider med sig.
  const fejlbeskeder = Object.fromEntries(
    FEJLNOEGLER.map((noegle) => [noegle, fejl(noegle)]),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gran">{t("overskrift")}</h1>

      <div className="mt-8">
        <Generering
          tekster={{
            ingenBrief: t("ingenBrief"),
            nyTekst: t("nyTekst"),
            planlaegger: t("planlaegger"),
            skriver: t("skriver"),
            faerdig: t("faerdig"),
            visHtml: t("visHtml"),
            visTekst: t("visTekst"),
            kopier: t("kopier"),
            kopierFelt: t("kopierFelt"),
            kopieret: t("kopieret"),
            kopiMarkeret: t("kopiMarkeret"),
            proevIgen: t("proevIgen"),
            koster: t("koster"),
            metaOverskrift: t("metaOverskrift"),
            metaForklaring: t("metaForklaring"),
            metaTitel: t("metaTitel"),
            metaBeskrivelse: t("metaBeskrivelse"),
            // t.raw, ikke t: de to tekster indeholder pladsholdere i
            // krøllede parenteser, som klienten selv sætter tal ind i. Kaldes
            // de med t(), forsøger next-intl at udfylde dem her og fejler.
            metaTegn: t.raw("metaTegn") as string,
            metaForLang: t("metaForLang"),
            metaTom: t("metaTom"),
            blokTitel: t("blokTitel"),
            blokIndledning: t("blokIndledning"),
            blokSektion: t.raw("blokSektion") as string,
            fejl: fejlbeskeder,
          }}
        />
      </div>
    </div>
  );
}
