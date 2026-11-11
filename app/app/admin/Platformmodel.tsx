"use client";

import { useActionState } from "react";

import { gemPlatformModelAction, type ModelSvar } from "./actions";

/**
 * Valget af model på platformens nøgle.
 *
 * Radioknapper frem for en rullemenu: forskellen på modellerne — sprog mod
 * pris — skal kunne læses, før der vælges.
 *
 * Alle modeller kan vælges (ejerens beslutning 11.11.2026). De anbefalede
 * står øverst; de øvrige står under "Ikke anbefalet" med grunden ved hver.
 */

type ModelValg = {
  id: string;
  navn: string;
  beskrivelse: string;
  /** Prisen som færdig tekst. Tom, hvis den ikke kendes. */
  pris: string;
  anbefalet: boolean;
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
    ikkeAnbefalet: string;
    ikkeAnbefaletForklaring: string;
    kilde: string;
    budget: string;
    gem: string;
    gemmer: string;
  };
}) {
  const [svar, submit, arbejder] = useActionState<ModelSvar | null, FormData>(
    gemPlatformModelAction,
    null,
  );

  const anbefalede = modeller.filter((m) => m.anbefalet);
  const fraraadede = modeller.filter((m) => !m.anbefalet);

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

        {anbefalede.map((model) => (
          <Valg key={model.id} model={model} valgt={valgt} />
        ))}

        {fraraadede.length > 0 && (
          <div className="space-y-3 pt-4">
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
                {tekster.ikkeAnbefalet}
              </p>
              <p className="text-sm leading-relaxed text-gran-let">
                {tekster.ikkeAnbefaletForklaring}
              </p>
            </div>

            {fraraadede.map((model) => (
              <Valg key={model.id} model={model} valgt={valgt} />
            ))}
          </div>
        )}
      </fieldset>

      <p className="text-sm leading-relaxed text-gran-let">
        {tekster.budget} {tekster.kilde}
      </p>

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

function Valg({ model, valgt }: { model: ModelValg; valgt: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-kant bg-bund px-4 py-3">
      <input
        type="radio"
        name="model"
        value={model.id}
        // Ikke styret af state: formularen nulstilles af React efter hver
        // gemning, og siden hentes igen med det gemte valg.
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
  );
}
