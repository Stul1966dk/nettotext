"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { logUd } from "./actions";

/**
 * Kontomenuen yderst til højre: hvem er logget ind, indstillinger og log ud.
 *
 * Mailadressen stod før direkte i menulinjen og blev taget ud 04.10.2026,
 * fordi den fyldte. Men så var der intet sted i appen, hvor brugeren kunne
 * se, hvilken konto hun var logget ind med — og det skal hun kunne, især når
 * hun har flere adresser. Her står den igen, ét klik væk.
 *
 * Bygget som en knap, der folder et panel ud, ikke som en `role="menu"`:
 * panelet rummer en oplysning, et link og en formular, og det er ikke en
 * menu i skærmlæserens forstand. Tab går igennem indholdet som på resten af
 * siden, Escape lukker og sender fokus tilbage til knappen, og et klik uden
 * for lukker også.
 */
export function Brugermenu({
  email,
  tekster,
}: {
  email: string;
  tekster: {
    aaben: string;
    loggetIndSom: string;
    indstillinger: string;
    logUd: string;
  };
}) {
  const [aaben, setAaben] = useState(false);
  const rod = useRef<HTMLDivElement>(null);
  const knap = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aaben) return;

    const vedKlik = (e: MouseEvent) => {
      if (!rod.current?.contains(e.target as Node)) setAaben(false);
    };

    const vedTast = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      setAaben(false);
      knap.current?.focus();
    };

    document.addEventListener("mousedown", vedKlik);
    document.addEventListener("keydown", vedTast);

    return () => {
      document.removeEventListener("mousedown", vedKlik);
      document.removeEventListener("keydown", vedTast);
    };
  }, [aaben]);

  return (
    <div ref={rod} className="relative">
      <button
        ref={knap}
        type="button"
        onClick={() => setAaben((nu) => !nu)}
        aria-expanded={aaben}
        aria-controls="brugermenu"
        aria-label={tekster.aaben}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-kant text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
      >
        <User aria-hidden="true" className="h-4 w-4" />
      </button>

      {aaben && (
        <div
          id="brugermenu"
          className="absolute right-0 top-full z-10 mt-2 w-64 space-y-4 rounded-2xl border border-kant bg-kort p-4 shadow-sm"
        >
          <div className="space-y-1">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gran-let">
              {tekster.loggetIndSom}
            </p>
            {/* break-all: en lang adresse skal brydes, ikke klippes af. Det
                er hele adressen, brugeren har brug for at se. */}
            <p className="break-all text-sm text-gran">{email}</p>
          </div>

          <div className="space-y-2 border-t border-kant pt-4">
            <Link
              href="/app/indstillinger"
              onClick={() => setAaben(false)}
              className="block rounded-lg px-2 py-1.5 text-sm text-gran underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
            >
              {tekster.indstillinger}
            </Link>

            <form action={logUd}>
              <button
                type="submit"
                className="w-full rounded-lg border border-kant px-3 py-1.5 text-left text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
              >
                {tekster.logUd}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
