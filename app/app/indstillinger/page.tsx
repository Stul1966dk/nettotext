import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import {
  LEVERANDOER_KONSOL,
  LEVERANDOER_NAVN,
  leverandoerErKlar,
  standardValgbarModel,
  valgbareModeller,
} from "@/lib/ai/modeller";
import { LEVERANDOERER } from "@/lib/ai/typer";
import { hentNoegleInfo } from "@/lib/ainoegler";

import { AiForbindelse, type LeverandoerValg } from "./AiForbindelse";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("indstillinger");
  return { title: t("titel") };
}

/**
 * Indstillinger — i V1 kun AI-forbindelsen.
 *
 * Profil og brand-profil hører til trin 5 og får deres egne afsnit her.
 * Siden henter kun METADATA om nøglen: leverandør, model og de sidste fire
 * tegn. Selve nøglen kan ikke læses herfra, heller ikke hvis nogen prøvede —
 * kolonnen er taget fra login-forbindelsen i migration 0012.
 */
export default async function Indstillinger() {
  const t = await getTranslations("indstillinger");

  const noegle = await hentNoegleInfo();

  const leverandoerer: LeverandoerValg[] = LEVERANDOERER.map((id) => ({
    id,
    navn: LEVERANDOER_NAVN[id],
    klar: leverandoerErKlar(id),
    konsol: LEVERANDOER_KONSOL[id],
    standard: standardValgbarModel(id),
    modeller: valgbareModeller(id).map((m) => ({
      id: m.id,
      navn: m.navn,
      beskrivelse: m.beskrivelse,
    })),
  }));

  // Datoen formateres på serveren, så den ser ens ud uanset browser — og så
  // klienten ikke skal hydrere en dato, der lige er skiftet.
  const sidstAfproevet = noegle?.sidstValideret
    ? new Intl.DateTimeFormat("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(noegle.sidstValideret))
    : null;

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

      <section className="space-y-6 rounded-2xl border border-kant bg-kort p-8">
        <div className="space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
            {t("aiOverskrift")}
          </h2>
          <p className="text-sm leading-relaxed text-gran-let">
            {t("aiForklaring")}
          </p>
        </div>

        <AiForbindelse
          gemt={
            noegle
              ? {
                  leverandoer: noegle.leverandoer,
                  leverandoerNavn: LEVERANDOER_NAVN[noegle.leverandoer],
                  model: noegle.model,
                  hint: noegle.hint,
                  sidstAfproevet,
                }
              : null
          }
          leverandoerer={leverandoerer}
          tekster={{
            // t.raw: teksterne har pladsholdere, klienten fylder selv ud.
            leverandoerLabel: t("leverandoerLabel"),
            leverandoerIkkeKlar: t.raw("leverandoerIkkeKlar") as string,
            modelLabel: t("modelLabel"),
            noegleLabel: t("noegleLabel"),
            noeglePladsholder: t("noeglePladsholder"),
            noegleHjaelp: t.raw("noegleHjaelp") as string,
            noegleHjaelpKnap: t.raw("noegleHjaelpKnap") as string,
            noegleSikkerhed: t("noegleSikkerhed"),

            gem: t("gem"),
            gemmer: t("gemmer"),
            gemt: t("gemt"),

            gemtOverskrift: t("gemtOverskrift"),
            gemtHint: t.raw("gemtHint") as string,
            sidstAfproevet: t.raw("sidstAfproevet") as string,
            aldrigAfproevet: t("aldrigAfproevet"),

            test: t("test"),
            tester: t("tester"),
            testOk: t("testOk"),

            skiftModelGemt: t("skiftModelGemt"),
            skift: t("skift"),
            fortryd: t("fortryd"),

            slet: t("slet"),
            sletter: t("sletter"),
            sletSpoergsmaal: t("sletSpoergsmaal"),
            sletJa: t("sletJa"),
            slettet: t("slettet"),

            fejlUgyldigNoegle: t.raw("fejlUgyldigNoegle") as string,
            fejlTomSaldo: t.raw("fejlTomSaldo") as string,
            fejlForkertLeverandoer: t.raw("fejlForkertLeverandoer") as string,
            fejlRateLimit: t.raw("fejlRateLimit") as string,
            fejlForMangeForsoeg: t("fejlForMangeForsoeg"),
            fejlIngenNoegle: t("fejlIngenNoegle"),
            fejlLeverandoerIkkeKlar: t("fejlLeverandoerIkkeKlar"),
            fejlUkendt: t("fejlUkendt"),
          }}
        />
      </section>
    </div>
  );
}
