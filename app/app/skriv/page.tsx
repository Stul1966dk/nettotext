import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Generering } from "./Generering";

/**
 * Skærm 3: teksten.
 *
 * Den rigtige editor: teksten i blokke, meta-felter til søgeresultatet,
 * omskrivning af ét afsnit ad gangen og kopiering i tre former.
 */

/** Skal svare til `aarsag`-værdierne fra /api/generate og lib/ai/typer.ts. */
const FEJLNOEGLER = [
  "ikke_logget_ind",
  "ugyldig_anmodning",
  "ugyldig_brief",
  "ukendt_skabelon",
  "mangler_noegle",
  "budget_opbrugt",
  "ugyldig_noegle",
  "tom_saldo",
  "rate_limit",
  "for_mange_kald",
  "tomt_svar",
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
            kopierUdenTitel: t("kopierUdenTitel"),
            kopierMarkdown: t("kopierMarkdown"),
            kopierForklaring: t("kopierForklaring"),
            hentWord: t("hentWord"),
            henterWord: t("henterWord"),
            eksportFejl: t("eksportFejl"),
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
            skrivOm: t("skrivOm"),
            skrivOmForklaring: t("skrivOmForklaring"),
            skrivOmPladsholder: t("skrivOmPladsholder"),
            skrivOmKnap: t("skrivOmKnap"),
            skrivOmGratis: t("skrivOmGratis"),
            omskriver: t("omskriver"),
            annuller: t("annuller"),
            fejl: fejlbeskeder,
          }}
        />
      </div>
    </div>
  );
}
