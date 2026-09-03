import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  hentAlleSkabeloner,
  hentSkabelonTilRedigering,
} from "@/lib/skabeloner/admin";

import { Teksttypeformular } from "../Teksttypeformular";

/**
 * Redigering af én teksttype, og oprettelse af en ny.
 *
 * `/app/admin/teksttyper/ny` er den nye. Én side til begge dele, fordi
 * formularen er den samme; det eneste, der skifter, er om adressen kan
 * ændres, og om der er felter at kopiere fra.
 */

type Props = { params: Promise<{ slug: string }> };

const NY = "ny";

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
            input_fields: skabelon.input_fields,
            active: skabelon.active,
          }
        }
        kopikilder={kopikilder}
        tekster={tekster}
      />
    </div>
  );
}
