import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { MODELLER } from "@/lib/ai/modeller";
import { beregnPrisDkk } from "@/lib/ai/pris";
import { outputformat } from "@/lib/ai/prompt";
import {
  hentAlleSkabeloner,
  hentSkabelonTilRedigering,
} from "@/lib/skabeloner/admin";
import {
  hentMaterialeTilAdmin,
  MAKS_TEGN_SAMLET,
} from "@/lib/skabeloner/materiale";

import { Materialeliste } from "../Materialeliste";
import { Teksttypeformular } from "../Teksttypeformular";

/**
 * Redigering af én teksttype, og oprettelse af en ny.
 *
 * `/app/admin/teksttyper/ny` er den nye. Én side til begge dele, fordi
 * formularen er den samme; det eneste, der skifter, er om adressen kan
 * ændres, og om der er felter at kopiere fra.
 */

type Props = { params: Promise<{ slug: string }> };

/**
 * Hvad det aktive materiale koster ekstra pr. tekst, i øre, på den DYRESTE
 * model, vi kender prisen på. Et loft over, ikke et gennemsnit: det er den
 * regning, en bruger med den dyreste model får.
 *
 * Regnet som en SKRIVNING til cachen (1,25 gange normal pris), for det er
 * den dyreste af de tre muligheder. Rammer cachen, koster materialet en
 * tiendedel. Se systemBlokke() i lib/ai/anthropic.ts.
 */
function ekstraOere(tokens: number): number {
  const priser = Object.values(MODELLER)
    .flat()
    .map((m) => beregnPrisDkk(m.id, 0, 0, { skrevet: tokens }))
    .filter((p): p is number => p !== null);

  return priser.length ? Math.ceil(Math.max(...priser) * 100) : 0;
}

const NY = "ny";

const MATERIALE_TEKSTER = [
  "materiale",
  "materialeHjaelp",
  "materialeIngen",
  "materialeNyt",
  "materialeTitel",
  "materialeTitelPladsholder",
  "materialeSlags",
  "materialeVejledning",
  "materialeVejledningHjaelp",
  "materialeEksempel",
  "materialeEksempelHjaelp",
  "materialeIndhold",
  "materialeIndholdPladsholder",
  "materialeHentFil",
  "materialeFilType",
  "materialeFilLang",
  "materialeTegn",
  "materialeAktiv",
  "materialeSlaaetFra",
  "materialeTilfoej",
  "materialeGem",
  "materialeSlet",
  "materialeSletBekraeft",
  "gemmer",
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("admin");

  return { title: slug === NY ? t("nyTeksttype") : t("redigerTitel") };
}

export default async function RedigerTeksttype({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("admin");

  const erNy = slug === NY;
  const skabelon = erNy ? null : await hentSkabelonTilRedigering(slug);

  if (!erNy && !skabelon) notFound();

  // Materialet findes først, når teksttypen er gemt: det hænger på dens id.
  const materialer = skabelon ? await hentMaterialeTilAdmin(skabelon.id) : [];
  const aktivtTegn = materialer
    .filter((m) => m.active)
    .reduce((sum, m) => sum + m.content.length, 0);
  // Samme skøn som skoenTokens() i lib/ai/estimat.ts: 3,6 tegn pr. token.
  const aktiveTokens = Math.ceil(aktivtTegn / 3.6);

  // Kun til "start ud fra": felterne fra de teksttyper, der findes i forvejen.
  const kopikilder = erNy
    ? (await hentAlleSkabeloner()).map((s) => ({
        slug: s.slug,
        name: s.name,
        felter: s.input_fields,
      }))
    : [];

  const tekster = Object.fromEntries(
    [
      "navn",
      "navnPladsholder",
      "adresse",
      "adressePladsholder",
      "adresseHjaelp",
      "adresseLaast",
      "beskrivelse",
      "beskrivelsePladsholder",
      "beskrivelseHjaelp",
      "prompt",
      "promptHjaelp",
      "promptArv",
      "h1",
      "h1Hjaelp",
      "produktoversigt",
      "produktoversigtHjaelp",
      "fastFormat",
      "fastFormatHjaelp",
      "felter",
      "felterHjaelp",
      "tilfoejFelt",
      "startUdFra",
      "vaelg",
      "ingenFelter",
      "felt",
      "flytOp",
      "flytNed",
      "fjern",
      "spoergsmaal",
      "spoergsmaalPladsholder",
      "type",
      "typeTekst",
      "typeTekstomraade",
      "typeValg",
      "maxLaengde",
      "muligheder",
      "mulighederPladsholder",
      "mulighederHjaelp",
      "hjaelpetekst",
      "pladsholder",
      "paakraevet",
      "idefelt",
      "idefeltHjaelp",
      "faktafelt",
      "faktafeltHjaelp",
      "aktiv",
      "aktivHjaelp",
      "gem",
      "gemmer",
      "tilbageTilListen",
    ].map((noegle) => [noegle, t(noegle)]),
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {t("mono")}
        </p>
        <h1 className="text-2xl font-semibold text-gran">
          {erNy ? t("nyTeksttype") : skabelon!.name}
        </h1>
        <p className="text-sm leading-relaxed text-gran-let">
          {t("redigerForklaring")}
        </p>
      </div>

      <Teksttypeformular
        skabelon={
          skabelon && {
            slug: skabelon.slug,
            name: skabelon.name,
            description: skabelon.description,
            system_prompt: skabelon.system_prompt,
            uses_h1: skabelon.uses_h1,
            product_grid: skabelon.product_grid,
            input_fields: skabelon.input_fields,
            active: skabelon.active,
          }
        }
        kopikilder={kopikilder}
        formater={{ medH1: outputformat(true), udenH1: outputformat(false) }}
        tekster={tekster}
      />

      {skabelon && (
        <Materialeliste
          slug={skabelon.slug}
          materialer={materialer}
          status={t("materialeStatus", {
            tegn: aktivtTegn.toLocaleString("da-DK"),
            loft: MAKS_TEGN_SAMLET.toLocaleString("da-DK"),
            tokens: aktiveTokens.toLocaleString("da-DK"),
            oere: ekstraOere(aktiveTokens),
          })}
          tekster={Object.fromEntries(
            MATERIALE_TEKSTER.map((noegle) => [noegle, t(noegle)]),
          )}
        />
      )}
    </div>
  );
}
