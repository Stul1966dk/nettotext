import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Generering } from "./Generering";

/**
 * Skærm 3: teksten.
 *
 * I trin 2 viser den kun den rå tekst, mens den bliver skrevet. Trin 3 gør
 * den til den rigtige editor: blokke, regenerering af enkelte sektioner,
 * meta-titel og eksport.
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
            kopieret: t("kopieret"),
            kopiMarkeret: t("kopiMarkeret"),
            proevIgen: t("proevIgen"),
            koster: t("koster"),
            fejl: fejlbeskeder,
          }}
        />
      </div>
    </div>
  );
}
