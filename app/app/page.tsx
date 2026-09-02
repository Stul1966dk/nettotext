import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LEVERANDOER_NAVN } from "@/lib/ai/modeller";
import { hentNoegleInfo } from "@/lib/ainoegler";
import { hentKladder, kladdeNavn, timerTilbage } from "@/lib/kladder";
import { createClient } from "@/lib/supabase/server";

import { Kladdeliste } from "./Kladdeliste";

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

  // Kun METADATA om nøglen — leverandør og de fire sidste tegn. Hentes for at
  // kunne sige det ærligt, når prøveteksterne er brugt: enten skriver hun på
  // sin egen regning nu, eller også mangler hun at sætte nøglen op.
  const noegle = tilbage === 0 ? await hentNoegleInfo() : null;

  // Udløbne kladder er allerede filtreret fra af RLS. Se migration 0011.
  const kladder = (await hentKladder()).map((kladde) => ({
    id: kladde.id,
    navn: kladdeNavn(kladde, t("kladdeUdenNavn")),
    timer: timerTilbage(kladde.udloeber),
  }));

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

            {/* Er kvoten brugt, er beskeden ovenfor ikke nok: brugeren skal
                enten vide, at hun nu betaler selv, eller hvor hun sætter
                nøglen op. Uden det ville hun først opdage det, når hun stod
                midt i en tekst, der ikke blev skrevet. */}
            {tilbage === 0 &&
              (noegle ? (
                <p className="mt-4 text-sm text-gran">
                  {t("egenNoegle", {
                    navn: LEVERANDOER_NAVN[noegle.leverandoer],
                    hint: noegle.hint,
                  })}
                </p>
              ) : (
                <Link
                  href="/app/opsaetning"
                  className="mt-4 inline-block rounded-lg border border-kant px-5 py-2.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
                >
                  {t("saetNoegleOp")}
                </Link>
              ))}
          </>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-kant bg-kort p-8">
        <div className="space-y-1">
          <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
            {t("kladderOverskrift")}
          </h2>
          <p className="text-sm leading-relaxed text-gran-let">
            {t("kladderForklaring")}
          </p>
        </div>

        <Kladdeliste
          kladder={kladder}
          tekster={{
            tomme: t("kladderTomme"),
            // t.raw: teksten har en pladsholder, klienten selv fylder ud.
            udloeber: t.raw("kladdeUdloeber") as string,
            udloeberSnart: t("kladdeUdloeberSnart"),
            fortsaet: t("kladdeFortsaet"),
            slet: t("kladdeSlet"),
            sletter: t("kladdeSletter"),
            sletFejl: t("kladdeSletFejl"),
          }}
        />
      </section>

      <Link
        href="/app/ny"
        className="inline-block rounded-lg bg-gran px-6 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
      >
        {t("nyTekst")}
      </Link>
    </div>
  );
}
