"use client";

/**
 * Hvor lang brødteksten blev, holdt op mod det, brugeren valgte.
 *
 * Tallet vises altid. Modellen rammer ikke et ordantal af sig selv — se
 * lib/tekst/laengde.ts — så det ærlige er at vise, hvad teksten blev, frem
 * for at lade valgmuligheden i briefen stå som et løfte, ingen har tjekket.
 *
 * Er teksten kortere end valgt, lægger editoren selv afsnit til lige efter
 * genereringen. Knappen her er til de tilfælde, hvor det ikke lykkedes, eller
 * hvor brugeren har slettet afsnit og vil have længden tilbage.
 */

export type LaengdeTekster = {
  ordantal: string;
  ordantalMaal: string;
  udvider: string;
  udvidForKort: string;
  udvidKnap: string;
  udvidGratis: string;
};

const tal = (n: number) => n.toLocaleString("da-DK");

export function Laengde({
  ord,
  mindst,
  udvider,
  laast,
  fejl,
  tekster,
  udvid,
}: {
  ord: number;
  /** Null, når teksttypen ikke har et mål for den valgte længde. */
  mindst: number | null;
  udvider: boolean;
  /** Et afsnit er ved at blive skrevet om, gemt eller lagt til. */
  laast: boolean;
  fejl: string | null;
  tekster: LaengdeTekster;
  udvid: () => void;
}) {
  const forKort = mindst !== null && ord < mindst;

  return (
    <div className="space-y-3" aria-live="polite">
      <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
        {mindst === null
          ? tekster.ordantal.replace("{ord}", tal(ord))
          : tekster.ordantalMaal
              .replace("{ord}", tal(ord))
              .replace("{mindst}", tal(mindst))}
      </p>

      {udvider && (
        <p
          role="status"
          className="rounded-lg border border-kant bg-kort px-4 py-3 text-sm leading-relaxed text-gran"
        >
          {tekster.udvider}
        </p>
      )}

      {forKort && !udvider && (
        <div className="space-y-3 rounded-lg border border-rav bg-kort px-4 py-4">
          <p className="text-sm leading-relaxed text-gran">
            {tekster.udvidForKort.replace("{mindst}", tal(mindst))}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={udvid}
              disabled={laast}
              className="rounded-lg border border-gran px-4 py-2 text-sm font-medium text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60"
            >
              {tekster.udvidKnap}
            </button>

            <p className="text-sm text-gran-let">{tekster.udvidGratis}</p>
          </div>

          {fejl && (
            <p role="alert" className="text-sm leading-relaxed text-gran">
              {fejl}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
