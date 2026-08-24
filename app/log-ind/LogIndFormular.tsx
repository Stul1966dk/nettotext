"use client";

import { useActionState } from "react";

import { sendMagiskLink, type LogIndSvar } from "./actions";

type Tekster = {
  label: string;
  pladsholder: string;
  knap: string;
  sender: string;
};

export function LogIndFormular({ tekster }: { tekster: Tekster }) {
  const [svar, handling, venter] = useActionState<LogIndSvar, FormData>(
    sendMagiskLink,
    undefined,
  );

  return (
    <form action={handling} className="mt-8 space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block font-mono text-xs uppercase tracking-widest text-gran-let"
        >
          {tekster.label}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder={tekster.pladsholder}
          aria-describedby={svar ? "log-ind-svar" : undefined}
          className="w-full rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
        />
      </div>

      <button
        type="submit"
        disabled={venter}
        className="w-full rounded-lg bg-gran px-4 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60"
      >
        {venter ? tekster.sender : tekster.knap}
      </button>

      {svar && (
        <p
          id="log-ind-svar"
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            svar.status === "sendt"
              ? "border-kant bg-bund text-gran"
              : "border-rav bg-bund text-gran"
          }`}
        >
          {svar.besked}
        </p>
      )}
    </form>
  );
}
