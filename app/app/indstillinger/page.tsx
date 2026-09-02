import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AiForbindelseSektion } from "@/components/ai-forbindelse/AiForbindelseSektion";
import { hentBrandprofil, hentInstruktioner } from "@/lib/personalisering";

import { Brandprofil } from "./Brandprofil";
import { Instruktioner } from "./Instruktioner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("indstillinger");
  return { title: t("titel") };
}

/**
 * Indstillinger — AI-forbindelsen og personaliseringen.
 *
 * Rækkefølgen er med vilje: forbindelsen først, fordi uden den skrives der
 * ingen tekster overhovedet. Brand-profil og instruktioner gør gode tekster
 * bedre, men de er ikke det, der får appen til at virke.
 */
export default async function Indstillinger() {
  const t = await getTranslations("indstillinger");

  // To opslag, ét besøg. RLS giver kun brugerens egne rækker.
  const [profil, instruktioner] = await Promise.all([
    hentBrandprofil(),
    hentInstruktioner(),
  ]);

  const brandTekster = Object.fromEntries(
    [
      "brandBeskrivelse",
      "brandBeskrivelseHjaelp",
      "brandBeskrivelsePladsholder",
      "brandTone",
      "brandToneHjaelp",
      "brandTonePladsholder",
      "brandForbudteOrd",
      "brandForbudteOrdHjaelp",
      "brandForbudteOrdPladsholder",
      "brandSprogproeve",
      "brandSprogproeveHjaelp",
      "brandSprogproevePladsholder",
      "brandGem",
      "brandGemmer",
    ].map((navn) => [navn, t(navn)]),
  );

  const instrTekster = Object.fromEntries(
    [
      "instrTomListe",
      "instrNy",
      "instrNyPladsholder",
      "instrTilfoej",
      "instrTilfoejer",
      "instrSlet",
    ].map((navn) => [navn, t(navn)]),
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gran">{t("overskrift")}</h1>
        <Link
          href="/app"
          className="inline-block text-sm text-gran-let underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
        >
          {t("tilbage")}
        </Link>
      </div>

      <Afsnit overskrift={t("aiOverskrift")} forklaring={t("aiForklaring")}>
        <Link
          href="/app/opsaetning"
          className="inline-block text-sm text-gran underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
        >
          {t("tilGuide")}
        </Link>

        <AiForbindelseSektion />
      </Afsnit>

      <Afsnit
        overskrift={t("brandOverskrift")}
        forklaring={t("brandForklaring")}
      >
        <Brandprofil profil={profil} tekster={brandTekster} />
      </Afsnit>

      <Afsnit
        overskrift={t("instrOverskrift")}
        forklaring={t("instrForklaring")}
      >
        <Instruktioner
          instruktioner={instruktioner}
          tekster={instrTekster}
        />
      </Afsnit>
    </div>
  );
}

function Afsnit({
  overskrift,
  forklaring,
  children,
}: {
  overskrift: string;
  forklaring: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-kant bg-kort p-8">
      <div className="space-y-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
          {overskrift}
        </h2>
        <p className="text-sm leading-relaxed text-gran-let">{forklaring}</p>
      </div>

      {children}
    </section>
  );
}
