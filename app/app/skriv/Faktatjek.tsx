"use client";

import type { Fund } from "@/lib/tekst/faktatjek";

/**
 * Tallene i teksten, holdt op mod briefen — og linjen om, hvem der har
 * ansvaret for, at de passer.
 *
 * De to ting står sammen med vilje. Et tjek uden ansvarslinjen ville læses
 * som en godkendelse ("NettoText har set teksten efter"), og det har vi ikke.
 * Vi har talt cifre. Derfor står ansvarslinjen også dér, hvor der IKKE er
 * fund: det er netop dér, man kunne komme til at tro, teksten var kontrolleret.
 *
 * Kortet påstår aldrig, hvad det rigtige tal er. Se begrundelsen i
 * lib/tekst/faktatjek.ts og i docs/beslutninger.md.
 */

export type FaktatjekTekster = {
  faktaOverskrift: string;
  faktaIngenFund: string;
  faktaForklaring: string;
  faktaAnsvar: string;
};

export function Faktatjek({
  fund,
  tekster,
}: {
  fund: Fund[];
  tekster: FaktatjekTekster;
}) {
  const harFund = fund.length > 0;

  return (
    <section
      aria-live="polite"
      className={`space-y-4 rounded-2xl border bg-kort p-6 ${
        harFund ? "border-rav" : "border-kant"
      }`}
    >
      <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
        {tekster.faktaOverskrift}
      </h2>

      <p className="text-sm leading-relaxed text-gran-let">
        {harFund ? tekster.faktaForklaring : tekster.faktaIngenFund}
      </p>

      {harFund && (
        <ul className="space-y-3">
          {fund.map((f) => (
            <li
              key={f.tal}
              className="rounded-lg border border-kant bg-bund px-4 py-3"
            >
              <span className="font-mono text-sm font-semibold text-gran">
                {f.tal}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-gran-let">
                {f.sammenhaeng}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-gran-let">
        {tekster.faktaAnsvar}
      </p>
    </section>
  );
}
