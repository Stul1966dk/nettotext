"use client";

import { useActionState, useRef } from "react";

import type { Instruktion } from "@/lib/personalisering";

import {
  sletInstruktionAction,
  tilfoejInstruktionAction,
  type Svar,
} from "./actions";

/**
 * Gemte instruktioner — de ønsker, der gælder på tværs af tekster.
 *
 * En liste og ikke ét stort felt, fordi det ER en liste: man samler dem op
 * én ad gangen, efterhånden som man opdager, hvad man vil have gjort
 * anderledes, og man vil kunne fjerne én uden at skrive de andre om.
 */

type Tekster = Record<string, string>;

export function Instruktioner({
  instruktioner,
  tekster,
}: {
  instruktioner: Instruktion[];
  tekster: Tekster;
}) {
  const formular = useRef<HTMLFormElement>(null);

  const [svar, submit, arbejder] = useActionState<Svar | null, FormData>(
    async (forrige, data) => {
      const resultat = await tilfoejInstruktionAction(forrige, data);
      // Feltet tømmes kun, når den faktisk blev gemt. Gik det galt, skal
      // brugeren ikke skrive den forfra.
      if (resultat.ok) formular.current?.reset();
      return resultat;
    },
    null,
  );

  return (
    <div className="space-y-6">
      {instruktioner.length === 0 ? (
        <p className="text-sm text-gran-let">{tekster.instrTomListe}</p>
      ) : (
        <ul className="space-y-2">
          {instruktioner.map((instruktion) => (
            <li
              key={instruktion.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-kant px-4 py-3"
            >
              <span className="text-sm leading-relaxed text-gran">
                {instruktion.indhold}
              </span>

              <form action={sletInstruktionAction} className="shrink-0">
                <input type="hidden" name="id" value={instruktion.id} />
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1 text-sm text-gran-let underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
                >
                  {tekster.instrSlet}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={formular} action={submit} className="space-y-2">
        <label
          htmlFor="instruktion"
          className="block text-sm font-medium text-gran"
        >
          {tekster.instrNy}
        </label>

        <div className="flex flex-wrap gap-3">
          <input
            id="instruktion"
            name="indhold"
            type="text"
            maxLength={500}
            placeholder={tekster.instrNyPladsholder}
            className="min-w-0 flex-1 rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
          />

          <button
            type="submit"
            disabled={arbejder}
            className="rounded-lg border border-kant px-5 py-2.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-60"
          >
            {arbejder ? tekster.instrTilfoejer : tekster.instrTilfoej}
          </button>
        </div>

        <p aria-live="polite" className="text-sm">
          {svar && (
            <span className={svar.ok ? "text-stempel" : "text-gran"}>
              {svar.besked}
            </span>
          )}
        </p>
      </form>
    </div>
  );
}
