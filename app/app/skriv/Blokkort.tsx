"use client";

import { useState } from "react";

import type { Blok } from "@/lib/tekst/blokke";

/**
 * Ét afsnit på skærmen, med muligheden for at få det skrevet om.
 *
 * Ligger som sin egen komponent, fordi hvert kort har sin egen lille tilstand
 * — er ønskefeltet foldet ud, og hvad står der i det. Den hører til ét kort
 * og skal ikke ligge i siden som fem parallelle felter.
 */

export type BlokkortTekster = {
  skrivOm: string;
  skrivOmForklaring: string;
  skrivOmPladsholder: string;
  skrivOmKnap: string;
  skrivOmGratis: string;
  omskriver: string;
  annuller: string;
};

export function Blokkort({
  blok,
  label,
  tekster,
  omskrives,
  streametTekst,
  fejl,
  laast,
  skrivOm,
}: {
  blok: Blok;
  label: string;
  tekster: BlokkortTekster;
  /** Er det DETTE afsnit, der bliver skrevet om lige nu? */
  omskrives: boolean;
  /** Den rå strøm, mens afsnittet bliver skrevet. Vises som tekst. */
  streametTekst: string;
  fejl: string | null;
  /** Sandt, mens et ANDET afsnit skrives om. Så venter det her på tur. */
  laast: boolean;
  skrivOm: (instruktion: string) => void;
}) {
  const [aaben, setAaben] = useState(false);
  const [instruktion, setInstruktion] = useState("");

  function send() {
    setAaben(false);
    skrivOm(instruktion);
    setInstruktion("");
  }

  return (
    <section
      aria-label={blok.overskrift ?? label}
      aria-busy={omskrives}
      className="space-y-3 rounded-2xl border border-kant bg-kort p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {label}
        </p>

        {omskrives ? (
          <p
            role="status"
            className="font-mono text-xs uppercase tracking-widest text-gran-let"
          >
            {tekster.omskriver}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setAaben((v) => !v)}
            disabled={laast}
            className="rounded-lg border border-kant px-3 py-1.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-40"
          >
            {aaben ? tekster.annuller : tekster.skrivOm}
          </button>
        )}
      </div>

      {/*
        Mens afsnittet bliver skrevet, vises strømmen som TEKST — React
        escaper den. Først når serveren har saneret det færdige afsnit,
        bliver det vist som HTML. Samme regel som ved en hel tekst.
      */}
      {omskrives ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gran-let">
          {streametTekst || " "}
        </pre>
      ) : (
        <div
          className="tekst"
          // Saneret server-side med sanitize-html. Se lib/tekst/saner.ts.
          dangerouslySetInnerHTML={{ __html: blok.html }}
        />
      )}

      {fejl && (
        <p
          role="alert"
          className="rounded-lg border border-rav bg-bund px-3 py-2 text-sm leading-relaxed text-gran"
        >
          {fejl}
        </p>
      )}

      {aaben && !omskrives && (
        <div className="space-y-3 border-t border-kant pt-4">
          <label
            htmlFor={`oenske-${blok.id}`}
            className="block text-sm leading-relaxed text-gran-let"
          >
            {tekster.skrivOmForklaring}
          </label>

          <textarea
            id={`oenske-${blok.id}`}
            rows={2}
            value={instruktion}
            maxLength={500}
            placeholder={tekster.skrivOmPladsholder}
            onChange={(e) => setInstruktion(e.target.value)}
            className="w-full resize-y rounded-lg border border-kant bg-bund px-3 py-2 text-sm leading-relaxed text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
          />

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={send}
              className="rounded-lg bg-gran px-4 py-2 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort"
            >
              {tekster.skrivOmKnap}
            </button>

            <span className="text-xs text-gran-let">
              {tekster.skrivOmGratis}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
