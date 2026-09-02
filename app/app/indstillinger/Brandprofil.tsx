"use client";

import { useActionState } from "react";

import type { Brandprofil as BrandprofilData } from "@/lib/personalisering";

import { gemBrandprofilAction, type Svar } from "./actions";

/**
 * Brand-profilen — hvem skriver, og hvordan skal det lyde.
 *
 * Alt her sendes med i HVER generering og betales pr. token. Derfor står der
 * ved hvert felt, hvad det bruges til: et felt, man fylder ud uden at vide
 * hvorfor, bliver enten tomt eller alt for langt.
 */

type Tekster = Record<string, string>;

const feltKlasse =
  "w-full rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran";

export function Brandprofil({
  profil,
  tekster,
}: {
  profil: BrandprofilData;
  tekster: Tekster;
}) {
  const [svar, submit, arbejder] = useActionState<Svar | null, FormData>(
    gemBrandprofilAction,
    null,
  );

  return (
    <form action={submit} className="space-y-6">
      <Felt
        id="beskrivelse"
        label={tekster.brandBeskrivelse}
        hjaelp={tekster.brandBeskrivelseHjaelp}
      >
        <textarea
          id="beskrivelse"
          name="beskrivelse"
          rows={4}
          maxLength={2000}
          defaultValue={profil.beskrivelse}
          placeholder={tekster.brandBeskrivelsePladsholder}
          aria-describedby="beskrivelse-hjaelp"
          className={`${feltKlasse} resize-y`}
        />
      </Felt>

      <Felt id="tone" label={tekster.brandTone} hjaelp={tekster.brandToneHjaelp}>
        <input
          id="tone"
          name="tone"
          type="text"
          maxLength={500}
          defaultValue={profil.tone}
          placeholder={tekster.brandTonePladsholder}
          aria-describedby="tone-hjaelp"
          className={feltKlasse}
        />
      </Felt>

      <Felt
        id="forbudteOrd"
        label={tekster.brandForbudteOrd}
        hjaelp={tekster.brandForbudteOrdHjaelp}
      >
        <input
          id="forbudteOrd"
          name="forbudteOrd"
          type="text"
          maxLength={1000}
          defaultValue={profil.forbudteOrd.join(", ")}
          placeholder={tekster.brandForbudteOrdPladsholder}
          aria-describedby="forbudteOrd-hjaelp"
          className={feltKlasse}
        />
      </Felt>

      <Felt
        id="sprogproeve"
        label={tekster.brandSprogproeve}
        hjaelp={tekster.brandSprogproeveHjaelp}
      >
        <textarea
          id="sprogproeve"
          name="sprogproeve"
          rows={6}
          maxLength={4000}
          defaultValue={profil.sprogproeve}
          placeholder={tekster.brandSprogproevePladsholder}
          aria-describedby="sprogproeve-hjaelp"
          className={`${feltKlasse} resize-y`}
        />
      </Felt>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={arbejder}
          className="rounded-lg bg-gran px-5 py-2.5 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60"
        >
          {arbejder ? tekster.brandGemmer : tekster.brandGem}
        </button>

        <p aria-live="polite" className="text-sm">
          {svar && (
            <span className={svar.ok ? "text-stempel" : "text-gran"}>
              {svar.besked}
            </span>
          )}
        </p>
      </div>
    </form>
  );
}

function Felt({
  id,
  label,
  hjaelp,
  children,
}: {
  id: string;
  label: string;
  hjaelp: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gran">
        {label}
      </label>
      {children}
      <p id={`${id}-hjaelp`} className="text-sm leading-relaxed text-gran-let">
        {hjaelp}
      </p>
    </div>
  );
}
