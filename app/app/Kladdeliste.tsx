"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { glemKladde } from "@/lib/skabeloner/kladde";

/**
 * Kladderne på dashboardet.
 *
 * Selve listen hentes på serveren; det her er kun knapperne. Sletning skal
 * være en klient-handling, fordi den også skal fjerne kopien i browserens
 * localStorage — ellers ville en slettet kladde dukke op igen, næste gang
 * /app/skriv blev åbnet.
 */

export type KladdeIListen = {
  id: string;
  navn: string;
  timer: number;
};

type Tekster = {
  tomme: string;
  udloeber: string;
  udloeberSnart: string;
  fortsaet: string;
  slet: string;
  sletter: string;
  sletFejl: string;
};

export function Kladdeliste({
  kladder,
  tekster,
}: {
  kladder: KladdeIListen[];
  tekster: Tekster;
}) {
  const router = useRouter();
  const [sletter, setSletter] = useState<string | null>(null);
  const [fejl, setFejl] = useState(false);

  async function slet(id: string) {
    setSletter(id);
    setFejl(false);

    try {
      const svar = await fetch("/api/draft", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!svar.ok) {
        setFejl(true);
        return;
      }

      glemKladde(id);
      // Listen kommer fra serveren, så siden skal hente den forfra.
      router.refresh();
    } catch {
      setFejl(true);
    } finally {
      setSletter(null);
    }
  }

  if (kladder.length === 0) {
    return <p className="text-sm leading-relaxed text-gran-let">{tekster.tomme}</p>;
  }

  return (
    <div className="space-y-3">
      {kladder.map((kladde) => (
        <div
          key={kladde.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-kant bg-bund px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-gran">{kladde.navn}</p>
            <p className="mt-1 font-mono text-xs text-gran-let">
              {kladde.timer < 1
                ? tekster.udloeberSnart
                : tekster.udloeber.replace("{timer}", String(kladde.timer))}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/app/skriv?kladde=${kladde.id}`}
              className="rounded-lg border border-kant bg-kort px-3 py-1.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
            >
              {tekster.fortsaet}
            </Link>

            <button
              type="button"
              onClick={() => slet(kladde.id)}
              disabled={sletter === kladde.id}
              className="rounded-lg px-3 py-1.5 text-sm text-gran-let underline outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-40"
            >
              {sletter === kladde.id ? tekster.sletter : tekster.slet}
            </button>
          </div>
        </div>
      ))}

      {fejl && (
        <p
          role="alert"
          className="rounded-lg border border-rav bg-bund px-4 py-3 text-sm leading-relaxed text-gran"
        >
          {tekster.sletFejl}
        </p>
      )}
    </div>
  );
}
