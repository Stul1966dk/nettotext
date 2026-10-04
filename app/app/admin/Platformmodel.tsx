"use client";

import { useActionState } from "react";

import { gemPlatformModelAction, type ModelSvar } from "./actions";

/**
 * Valget af model på platformens nøgle.
 *
 * Radioknapper frem for en rullemenu: der er to modeller, og forskellen på
 * dem — sprog mod pris — skal kunne læses, før der vælges.
 */

type ModelValg = {
  id: string;
  navn: string;
  beskrivelse: string;
  /** Prisen som færdig tekst. Tom, hvis den ikke kendes. */
  pris: string;
};

export function Platformmodel({
  valgt,
  modeller,
  tekster,
}: {
  valgt: string;
  modeller: ModelValg[];
  tekster: {
    overskrift: string;
    forklaring: string;
    budget: string;
    gem: string;
    gemmer: string;
  };
}) {
  const [svar, submit, arbejder] = useActionState<ModelSvar | null, FormData>(
    gemPlatformModelAction,
    null,
  );

  return (
    <form
      action={submit}
      className="space-y-5 rounded-2xl border border-kant bg-kort p-6"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-medium text-gran">{tekster.overskrift}</h2>
        <p className="text-sm leading-relaxed text-gran-let">
          {tekster.forklaring}
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">{tekster.overskrift}</legend>

        {modeller.map((model) => (
          <label
            key={model.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-kant bg-bund px-4 py-3"
          >
            <input
              type="radio"
              name="model"
              value={model.id}
              // Ikke styret af state: formularen nulstilles af React efter
              // hver gemning, og siden hentes igen med det gemte valg.
              defaultChecked={model.id === valgt}
              className="mt-1 h-4 w-4 accent-gran"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-gran">
                {model.navn}
              </span>
              <span className="block text-sm leading-relaxed text-gran-let">
                {model.beskrivelse}
              </span>
              {model.pris && (
                <span className="block font-mono text-xs text-gran-let">
                  {model.pris}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <p className="text-sm leading-relaxed text-gran-let">{tekster.budget}</p>

      {svar && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm leading-relaxed text-gran ${
            svar.ok ? "border-kant bg-bund" : "border-rav bg-bund"
          }`}
        >
          {svar.besked}
        </p>
      )}

      <button
        type="submit"
        disabled={arbejder}
        className="rounded-lg bg-gran px-6 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-40"
      >
        {arbejder ? tekster.gemmer : tekster.gem}
      </button>
    </form>
  );
}
