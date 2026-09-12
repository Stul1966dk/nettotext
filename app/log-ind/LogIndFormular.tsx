"use client";

import { useActionState, useState } from "react";

import {
  bekraeftKode,
  sendLoginKode,
  type KodeSvar,
  type LogIndSvar,
} from "./actions";

type Tekster = {
  label: string;
  pladsholder: string;
  knap: string;
  sender: string;
  kodeLabel: string;
  kodePladsholder: string;
  kodeKnap: string;
  kodeTjekker: string;
  sendIgen: string;
  andenAdresse: string;
};

const knapKlasser =
  "w-full rounded-lg bg-gran px-4 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60";

const labelKlasser =
  "block font-mono text-xs uppercase tracking-widest text-gran-let";

const beskedKlasser = "rounded-lg border px-4 py-3 text-sm";

const linkKlasser =
  "rounded-lg text-sm text-gran-let underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-60";

/**
 * Login i to trin i SAMME fane: mailadresse ind, kode fra mailen ind.
 * Linket i mailen virker stadig — det er reserven, hvis mailen åbnes
 * på en anden enhed end den, koden blev bestilt fra.
 */
export function LogIndFormular({ tekster }: { tekster: Tekster }) {
  const [omgang, setOmgang] = useState(0);

  // Nøglen nulstiller begge formularer, når brugeren starter forfra
  // med en anden mailadresse.
  return (
    <Forloeb
      key={omgang}
      tekster={tekster}
      startForfra={() => setOmgang((n) => n + 1)}
    />
  );
}

function Forloeb({
  tekster,
  startForfra,
}: {
  tekster: Tekster;
  startForfra: () => void;
}) {
  const [email, setEmail] = useState("");
  const [svar, sendHandling, sender] = useActionState<LogIndSvar, FormData>(
    sendLoginKode,
    undefined,
  );
  const [kodeSvar, kodeHandling, tjekker] = useActionState<KodeSvar, FormData>(
    bekraeftKode,
    undefined,
  );

  if (svar?.status === "sendt") {
    return (
      <div className="mt-8 space-y-4">
        <p
          id="log-ind-svar"
          role="status"
          className={`${beskedKlasser} border-kant bg-bund text-gran`}
        >
          {svar.besked}
        </p>

        <form action={kodeHandling} className="space-y-4">
          <input type="hidden" name="email" value={email} />

          <div className="space-y-2">
            <label htmlFor="kode" className={labelKlasser}>
              {tekster.kodeLabel}
            </label>
            <input
              id="kode"
              name="kode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              placeholder={tekster.kodePladsholder}
              aria-describedby={kodeSvar ? "kode-svar" : undefined}
              className="w-full rounded-lg border border-kant bg-kort px-4 py-3 font-mono text-lg tracking-[0.4em] text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
            />
          </div>

          <button type="submit" disabled={tjekker} className={knapKlasser}>
            {tjekker ? tekster.kodeTjekker : tekster.kodeKnap}
          </button>

          {kodeSvar && (
            <p
              id="kode-svar"
              role="status"
              className={`${beskedKlasser} border-rav bg-bund text-gran`}
            >
              {kodeSvar.besked}
            </p>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <form action={sendHandling}>
            <input type="hidden" name="email" value={email} />
            <button type="submit" disabled={sender} className={linkKlasser}>
              {sender ? tekster.sender : tekster.sendIgen}
            </button>
          </form>

          <button type="button" onClick={startForfra} className={linkKlasser}>
            {tekster.andenAdresse}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={sendHandling} className="mt-8 space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className={labelKlasser}>
          {tekster.label}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tekster.pladsholder}
          aria-describedby={svar ? "log-ind-svar" : undefined}
          className="w-full rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
        />
      </div>

      <button type="submit" disabled={sender} className={knapKlasser}>
        {sender ? tekster.sender : tekster.knap}
      </button>

      {svar && (
        <p
          id="log-ind-svar"
          role="status"
          className={`${beskedKlasser} border-rav bg-bund text-gran`}
        >
          {svar.besked}
        </p>
      )}
    </form>
  );
}
