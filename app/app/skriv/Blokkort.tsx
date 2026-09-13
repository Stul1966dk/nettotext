"use client";

import { useRef, useState } from "react";

import type { Blok } from "@/lib/tekst/blokke";

/**
 * Ét afsnit på skærmen, med tre ting man kan gøre ved det: rette i det selv,
 * få det skrevet om, eller slette det.
 *
 * Ligger som sin egen komponent, fordi hvert kort har sin egen lille tilstand
 * — hvad er foldet ud, og hvad står der i feltet. Den hører til ét kort og
 * skal ikke ligge i siden som fem parallelle felter.
 *
 * De tre ting udelukker hinanden, og derfor er tilstanden ÉN værdi og ikke
 * tre flag. Tre flag kan stå i otte kombinationer, hvoraf de fem er noget
 * rod på skærmen.
 */

type Tilstand = "lukket" | "skriv-om" | "ret" | "slet";

export type BlokkortTekster = {
  skrivOm: string;
  skrivOmForklaring: string;
  skrivOmPladsholder: string;
  skrivOmKnap: string;
  skrivOmGratis: string;
  omskriver: string;
  annuller: string;
  ret: string;
  retForklaring: string;
  retGem: string;
  retGemmer: string;
  slet: string;
  sletSpoergsmaal: string;
  sletJa: string;
};

export function Blokkort({
  blok,
  label,
  tekster,
  omskrives,
  streametTekst,
  fejl,
  laast,
  kanSlettes,
  gemmer,
  skrivOm,
  ret,
  slet,
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
  /** Det sidste afsnit kan ikke slettes — så var der ingen tekst tilbage. */
  kanSlettes: boolean;
  /** Er en håndrettelse på vej til serveren for at blive saneret? */
  gemmer: boolean;
  skrivOm: (instruktion: string) => void;
  ret: (html: string) => void;
  slet: () => void;
}) {
  const [tilstand, setTilstand] = useState<Tilstand>("lukket");
  const [instruktion, setInstruktion] = useState("");

  /**
   * Det redigerbare felt. Vi holder fat i selve DOM-elementet, fordi det er
   * browseren og ikke React, der ejer indholdet, mens der rettes — React kan
   * ikke styre børnene i et contentEditable uden at flytte markøren rundt
   * under fingrene på den, der skriver.
   */
  const felt = useRef<HTMLDivElement>(null);

  const redigerer = tilstand === "ret";

  function send() {
    setTilstand("lukket");
    skrivOm(instruktion);
    setInstruktion("");
  }

  function gemRettelse() {
    const html = felt.current?.innerHTML ?? "";
    setTilstand("lukket");
    ret(html);
  }

  /** Fortryder en rettelse: browserens indhold sættes tilbage til kladdens. */
  function fortrydRettelse() {
    if (felt.current) felt.current.innerHTML = blok.html;
    setTilstand("lukket");
  }

  const knapKlasse =
    "rounded-lg border border-kant px-3 py-1.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-40";

  return (
    <section
      aria-label={blok.overskrift ?? label}
      aria-busy={omskrives || gemmer}
      className={`space-y-3 rounded-2xl border bg-kort p-6 ${
        redigerer ? "border-gran" : "border-kant"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
          {label}
        </p>

        {omskrives || gemmer ? (
          <p
            role="status"
            className="font-mono text-xs uppercase tracking-widest text-gran-let"
          >
            {gemmer ? tekster.retGemmer : tekster.omskriver}
          </p>
        ) : redigerer ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={gemRettelse}
              className="rounded-lg bg-gran px-3 py-1.5 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort"
            >
              {tekster.retGem}
            </button>
            <button
              type="button"
              onClick={fortrydRettelse}
              className={knapKlasse}
            >
              {tekster.annuller}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTilstand("ret")}
              disabled={laast}
              className={knapKlasse}
            >
              {tekster.ret}
            </button>

            <button
              type="button"
              onClick={() =>
                setTilstand((v) => (v === "skriv-om" ? "lukket" : "skriv-om"))
              }
              disabled={laast}
              className={knapKlasse}
            >
              {tilstand === "skriv-om" ? tekster.annuller : tekster.skrivOm}
            </button>

            {kanSlettes && (
              <button
                type="button"
                onClick={() =>
                  setTilstand((v) => (v === "slet" ? "lukket" : "slet"))
                }
                disabled={laast}
                className={knapKlasse}
              >
                {tilstand === "slet" ? tekster.annuller : tekster.slet}
              </button>
            )}
          </div>
        )}
      </div>

      {/*
        Mens afsnittet bliver skrevet om, vises strømmen som TEKST — React
        escaper den. Først når serveren har saneret det færdige afsnit,
        bliver det vist som HTML. Samme regel som ved en hel tekst.
      */}
      {omskrives ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gran-let">
          {streametTekst || " "}
        </pre>
      ) : (
        <div
          ref={felt}
          className={`tekst outline-none ${
            redigerer ? "rounded-lg bg-bund px-4 py-3" : ""
          }`}
          contentEditable={redigerer}
          suppressContentEditableWarning
          role={redigerer ? "textbox" : undefined}
          aria-multiline={redigerer ? true : undefined}
          aria-label={redigerer ? tekster.ret : undefined}
          // Saneret server-side med sanitize-html. Se lib/tekst/saner.ts.
          // Det gælder også en håndrettelse: den sendes gennem /api/blok,
          // FØR den havner her igen.
          dangerouslySetInnerHTML={{ __html: blok.html }}
        />
      )}

      {redigerer && (
        <p className="text-sm leading-relaxed text-gran-let">
          {tekster.retForklaring}
        </p>
      )}

      {fejl && (
        <p
          role="alert"
          className="rounded-lg border border-rav bg-bund px-3 py-2 text-sm leading-relaxed text-gran"
        >
          {fejl}
        </p>
      )}

      {tilstand === "slet" && !omskrives && (
        <div className="space-y-3 border-t border-kant pt-4">
          <p className="text-sm leading-relaxed text-gran">
            {tekster.sletSpoergsmaal}
          </p>

          <button
            type="button"
            onClick={() => {
              setTilstand("lukket");
              slet();
            }}
            className="rounded-lg border border-rav px-4 py-2 text-sm font-medium text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
          >
            {tekster.sletJa}
          </button>
        </div>
      )}

      {tilstand === "skriv-om" && !omskrives && (
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
