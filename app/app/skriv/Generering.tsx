"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { gemKladde, hentKladde, type Kladde } from "@/lib/skabeloner/kladde";

type Tekster = {
  ingenBrief: string;
  nyTekst: string;
  planlaegger: string;
  skriver: string;
  faerdig: string;
  raaForklaring: string;
  kopier: string;
  kopieret: string;
  proevIgen: string;
  koster: string;
  fejl: Record<string, string>;
};

type Status = "starter" | "skriver" | "faerdig" | "fejl" | "ingen-brief";

export function Generering({ tekster }: { tekster: Tekster }) {
  const [status, setStatus] = useState<Status>("starter");
  const [tekst, setTekst] = useState("");
  const [fejl, setFejl] = useState<string | null>(null);
  const [kopieret, setKopieret] = useState(false);

  // React kalder effekter to gange i udvikling for at afsløre fejl. Uden den
  // her vagt ville hver generering koste to prøvetekster.
  const igangsat = useRef(false);

  const generer = useCallback(
    async (kladde: Kladde) => {
      const visFejl = (aarsag: string) => {
        setFejl(tekster.fejl[aarsag] ?? tekster.fejl.ukendt);
        setStatus("fejl");
      };

      setStatus("starter");
      setTekst("");
      setFejl(null);

      let samlet = "";

      try {
        const svar = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skabelon: kladde.skabelon,
            brief: kladde.brief,
          }),
        });

        // Fejl, serveren nåede at opdage, før den begyndte at skrive.
        if (!svar.ok || !svar.body) {
          const krop = await svar.json().catch(() => null);
          visFejl(krop?.aarsag ?? "ukendt");
          return;
        }

        // Svaret er NDJSON: én JSON-linje pr. hændelse. Vi læser bid for bid
        // og behandler kun de linjer, der er hele.
        const laeser = svar.body.getReader();
        const afkoder = new TextDecoder();
        let rest = "";

        while (true) {
          const { value, done } = await laeser.read();
          if (done) break;

          rest += afkoder.decode(value, { stream: true });
          const linjer = rest.split("\n");
          rest = linjer.pop() ?? "";

          for (const linje of linjer) {
            if (!linje.trim()) continue;

            const hendelse = JSON.parse(linje);

            if (hendelse.slags === "tekst") {
              samlet += hendelse.tekst;
              setTekst(samlet);
              setStatus("skriver");
              gemKladde({ ...kladde, tekst: samlet, faerdig: false });
            }

            if (hendelse.slags === "faerdig") {
              setStatus("faerdig");
              gemKladde({ ...kladde, tekst: samlet, faerdig: true });
            }

            if (hendelse.slags === "fejl") {
              visFejl(hendelse.aarsag);
              return;
            }
          }
        }
      } catch {
        // Forbindelsen røg. Har vi tekst, beholder vi den — den er betalt for.
        visFejl("netvaerk");
      }
    },
    [tekster],
  );

  /**
   * Opstarten. Ligger i sin egen funktion og ikke direkte i effekten, fordi
   * sessionStorage først findes, når siden er i browseren — den kan ikke
   * læses, mens siden bliver bygget på serveren.
   */
  const start = useCallback(async () => {
    const kladde = hentKladde();

    if (!kladde) {
      setStatus("ingen-brief");
      return;
    }

    // Er teksten allerede skrevet, viser vi den frem for at betale for den
    // igen. Det gør en genindlæsning af siden gratis.
    if (kladde.faerdig && kladde.tekst) {
      setTekst(kladde.tekst);
      setStatus("faerdig");
      return;
    }

    await generer(kladde);
  }, [generer]);

  useEffect(() => {
    if (igangsat.current) return;
    igangsat.current = true;

    void start();
  }, [start]);

  async function kopier() {
    await navigator.clipboard.writeText(tekst);
    setKopieret(true);
    setTimeout(() => setKopieret(false), 2000);
  }

  function proevIgen() {
    const kladde = hentKladde();
    if (kladde) void generer({ ...kladde, tekst: "", faerdig: false });
  }

  if (status === "ingen-brief") {
    return (
      <div className="space-y-6">
        <p className="rounded-lg border border-kant bg-kort px-4 py-3 text-sm leading-relaxed text-gran">
          {tekster.ingenBrief}
        </p>
        <Link href="/app/ny" className="text-sm text-gran underline">
          {tekster.nyTekst}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p
        role="status"
        aria-live="polite"
        className="font-mono text-xs uppercase tracking-widest text-gran-let"
      >
        {status === "starter" && tekster.planlaegger}
        {status === "skriver" && tekster.skriver}
        {status === "faerdig" && tekster.faerdig}
      </p>

      {fejl && (
        <div className="space-y-4 rounded-lg border border-rav bg-kort px-4 py-4">
          <p role="alert" className="text-sm leading-relaxed text-gran">
            {fejl}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={proevIgen}
              className="rounded-lg border border-kant px-4 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
            >
              {tekster.proevIgen}
            </button>
            <span className="text-xs text-gran-let">{tekster.koster}</span>
          </div>
        </div>
      )}

      {tekst && (
        <>
          {/*
            Teksten vises som ren tekst, ikke som HTML. React escaper strenge
            i JSX, så intet af det, modellen har skrevet, kan udføres i
            browseren. Først i trin 3, når teksten skal VISES som HTML,
            bliver den saneret server-side med sanitize-html.
          */}
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-kant bg-kort p-6 font-mono text-sm leading-relaxed text-gran">
            {tekst}
          </pre>

          {status === "faerdig" && (
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={kopier}
                className="rounded-lg border border-kant px-4 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
              >
                {kopieret ? tekster.kopieret : tekster.kopier}
              </button>
              <Link href="/app/ny" className="text-sm text-gran underline">
                {tekster.nyTekst}
              </Link>
            </div>
          )}

          <p className="border-t border-kant pt-6 text-xs leading-relaxed text-gran-let">
            {tekster.raaForklaring}
          </p>
        </>
      )}
    </div>
  );
}
