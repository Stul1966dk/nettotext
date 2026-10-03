"use client";

import { useState } from "react";

/**
 * Knappen, der lægger "Ofte stillede spørgsmål" til sidst i teksten.
 *
 * Afsnittet skrives i sit eget kald, når brugeren beder om det — ikke af sig
 * selv sammen med artiklen. Begrundelsen står ved FAQ_TILLAEG i
 * lib/ai/prompt.ts.
 *
 * Kortet siger ligeud, at vi ikke har søgetal. Ejerens krav er spørgsmål,
 * der faktisk bliver søgt efter, og det kan appen ikke vide: den slår intet
 * op. Derfor feltet til brugerens egne spørgsmål. Hun har adgang til det, vi
 * ikke har — sin Search Console, Googles "Andre spurgte også" og sine kunder.
 */

export type FaqTekster = {
  faqOverskrift: string;
  faqForklaring: string;
  faqEgneLabel: string;
  faqEgneHjaelp: string;
  faqEgnePladsholder: string;
  faqKnap: string;
  faqIgen: string;
  faqHenter: string;
  faqGratis: string;
};

export function Faq({
  findes,
  henter,
  laast,
  fejl,
  tekster,
  tilfoej,
}: {
  /** Har teksten allerede afsnittet? Så skrives det om i stedet. */
  findes: boolean;
  henter: boolean;
  /** Et andet afsnit er ved at blive skrevet om eller gemt. */
  laast: boolean;
  fejl: string | null;
  tekster: FaqTekster;
  tilfoej: (spoergsmaal: string) => void;
}) {
  const [egne, setEgne] = useState("");

  return (
    <section className="space-y-4 rounded-2xl border border-kant bg-kort p-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
        {tekster.faqOverskrift}
      </h2>

      <p className="text-sm leading-relaxed text-gran-let">
        {tekster.faqForklaring}
      </p>

      <div className="space-y-2">
        <label
          htmlFor="faq-egne"
          className="block text-sm font-medium text-gran"
        >
          {tekster.faqEgneLabel}
        </label>

        <p
          id="faq-egne-hjaelp"
          className="text-sm leading-relaxed text-gran-let"
        >
          {tekster.faqEgneHjaelp}
        </p>

        <textarea
          id="faq-egne"
          rows={3}
          maxLength={1000}
          value={egne}
          onChange={(e) => setEgne(e.target.value)}
          placeholder={tekster.faqEgnePladsholder}
          aria-describedby="faq-egne-hjaelp"
          className="w-full resize-y rounded-lg border border-kant bg-bund px-4 py-3 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => tilfoej(egne)}
          disabled={henter || laast}
          className="rounded-lg border border-gran px-4 py-2 text-sm font-medium text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60"
        >
          {henter
            ? tekster.faqHenter
            : findes
              ? tekster.faqIgen
              : tekster.faqKnap}
        </button>

        <p className="text-sm text-gran-let">{tekster.faqGratis}</p>
      </div>

      <div aria-live="polite">
        {fejl && (
          <p
            role="alert"
            className="rounded-lg border border-rav bg-bund px-4 py-3 text-sm text-gran"
          >
            {fejl}
          </p>
        )}
      </div>
    </section>
  );
}
