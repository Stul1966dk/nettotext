"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { gemKladde, hentKladde, type Kladde } from "@/lib/skabeloner/kladde";
import type { Blok } from "@/lib/tekst/blokke";

type Tekster = {
  ingenBrief: string;
  nyTekst: string;
  planlaegger: string;
  skriver: string;
  faerdig: string;
  visHtml: string;
  visTekst: string;
  kopier: string;
  kopierFelt: string;
  kopieret: string;
  kopiMarkeret: string;
  proevIgen: string;
  koster: string;
  metaOverskrift: string;
  metaForklaring: string;
  metaTitel: string;
  metaBeskrivelse: string;
  metaTegn: string;
  metaForLang: string;
  metaTom: string;
  blokTitel: string;
  blokIndledning: string;
  blokSektion: string;
  fejl: Record<string, string>;
};

type Status = "starter" | "skriver" | "faerdig" | "fejl" | "ingen-brief";

/** En fejl vi viser. Årsagen gemmes med, fordi ikke alle fejl er ens. */
type Fejl = { aarsag: string; besked: string };

/**
 * Fejl hvor et nyt forsøg umuligt kan koste en prøvetekst.
 *
 * Advarslen "hvert forsøg bruger én af dine prøvetekster" står under alle
 * fejl, og for de fleste er den rigtig: lykkes det næste forsøg, er der
 * trukket en tekst. Men når budgettet er brugt, eller der slet ikke er nogen
 * nøgle at skrive med, bliver forsøget afvist, før der bruges penge. Så er
 * advarslen ikke bare overflødig, den er forkert — og en app, der advarer om
 * noget, der ikke sker, er sværere at stole på næste gang den advarer.
 */
const GRATIS_AT_PROEVE_IGEN = new Set(["budget_opbrugt", "mangler_noegle"]);

/**
 * Længderne, Google typisk viser, før den klipper af. Det er ikke regler fra
 * Google, men det målte gennemsnit. Derfor en venlig bemærkning i UI'et og
 * ingen spærring: brugeren må gerne skrive længere, hvis hun vil.
 */
const TITEL_LOFT = 60;
const BESKRIVELSE_LOFT = 160;

/**
 * Ét meta-felt: label, tælling, indtastning og en kopiér-knap.
 *
 * Ligger som sin egen komponent og ikke som en funktion inde i Generering,
 * fordi feltet har brug for en ref til sig selv. Kan browseren ikke kopiere,
 * markerer vi indholdet i stedet, og det kræver fat i selve elementet.
 */
function MetaFelt({
  id,
  label,
  vaerdi,
  loft,
  flerlinjet,
  erKopieret,
  tekster,
  saet,
  kopier,
}: {
  id: "titel" | "beskrivelse";
  label: string;
  vaerdi: string;
  loft: number;
  flerlinjet: boolean;
  erKopieret: boolean;
  tekster: Tekster;
  saet: (v: string) => void;
  kopier: (
    id: string,
    vaerdi: string,
    felt: HTMLInputElement | HTMLTextAreaElement | null,
  ) => void;
}) {
  const feltRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const forLang = vaerdi.length > loft;

  const feltKlasser =
    "min-w-0 flex-1 rounded-lg border border-kant bg-bund px-3 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label
          htmlFor={`meta-${id}`}
          className="font-mono text-xs uppercase tracking-widest text-gran-let"
        >
          {label}
        </label>

        <span
          className={`font-mono text-xs ${forLang ? "text-rav" : "text-gran-let"}`}
        >
          {tekster.metaTegn
            .replace("{antal}", String(vaerdi.length))
            .replace("{loft}", String(loft))}
          {forLang ? ` · ${tekster.metaForLang}` : ""}
        </span>
      </div>

      <div className="flex items-start gap-2">
        {flerlinjet ? (
          <textarea
            id={`meta-${id}`}
            ref={(el) => {
              feltRef.current = el;
            }}
            rows={3}
            value={vaerdi}
            onChange={(e) => saet(e.target.value)}
            className={`${feltKlasser} resize-y leading-relaxed`}
          />
        ) : (
          <input
            id={`meta-${id}`}
            ref={(el) => {
              feltRef.current = el;
            }}
            type="text"
            value={vaerdi}
            onChange={(e) => saet(e.target.value)}
            className={feltKlasser}
          />
        )}

        <button
          type="button"
          onClick={() => kopier(id, vaerdi, feltRef.current)}
          className="rounded-lg border border-kant px-3 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
        >
          {erKopieret ? tekster.kopieret : tekster.kopierFelt}
        </button>
      </div>

      {!vaerdi && <p className="text-xs text-gran-let">{tekster.metaTom}</p>}
    </div>
  );
}

export function Generering({ tekster }: { tekster: Tekster }) {
  const [status, setStatus] = useState<Status>("starter");
  const [tekst, setTekst] = useState("");
  const [html, setHtml] = useState("");
  const [blokke, setBlokke] = useState<Blok[]>([]);
  const [titel, setTitel] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [harMeta, setHarMeta] = useState(false);
  const [visKoder, setVisKoder] = useState(false);
  const [fejl, setFejl] = useState<Fejl | null>(null);
  const [kopieret, setKopieret] = useState<string | null>(null);
  const [markeret, setMarkeret] = useState(false);

  const kodeRef = useRef<HTMLPreElement>(null);

  // Kladden, som den ser ud lige nu. Ligger i en ref og ikke i state, fordi
  // den kun skal gemmes, ikke tegnes. Retter brugeren i meta-felterne efter
  // genereringen, er det den her, rettelsen lægges oven på.
  const kladdeRef = useRef<Kladde | null>(null);

  const gem = useCallback((aendring: Partial<Kladde>) => {
    if (!kladdeRef.current) return;

    kladdeRef.current = { ...kladdeRef.current, ...aendring };
    gemKladde(kladdeRef.current);
  }, []);

  // React kalder effekter to gange i udvikling for at afsløre fejl. Uden den
  // her vagt ville hver generering koste to prøvetekster.
  const igangsat = useRef(false);

  const generer = useCallback(
    async (kladde: Kladde) => {
      const visFejl = (aarsag: string) => {
        setFejl({
          aarsag,
          besked: tekster.fejl[aarsag] ?? tekster.fejl.ukendt,
        });
        setStatus("fejl");
      };

      setStatus("starter");
      setTekst("");
      setHtml("");
      setBlokke([]);
      setTitel("");
      setBeskrivelse("");
      setHarMeta(false);
      setFejl(null);
      setKopieret(null);
      setMarkeret(false);

      kladdeRef.current = kladde;

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

            // Meta-felterne kommer et par sekunder inde i genereringen, længe
            // før teksten er færdig. De vises med det samme.
            if (hendelse.slags === "meta") {
              setTitel(hendelse.titel);
              setBeskrivelse(hendelse.beskrivelse);
              setHarMeta(true);
              gem({ titel: hendelse.titel, beskrivelse: hendelse.beskrivelse });
            }

            if (hendelse.slags === "tekst") {
              samlet += hendelse.tekst;
              setTekst(samlet);
              setStatus("skriver");
              gem({ tekst: samlet, html: "", blokke: [], faerdig: false });
            }

            if (hendelse.slags === "faerdig") {
              setHtml(hendelse.html);
              setBlokke(hendelse.blokke);
              setStatus("faerdig");
              gem({
                tekst: samlet,
                html: hendelse.html,
                blokke: hendelse.blokke,
                faerdig: true,
              });
            }

            if (hendelse.slags === "fejl") {
              visFejl(hendelse.aarsag);
              return;
            }
          }
        }
      } catch {
        // Forbindelsen røg. Har vi tekst, beholder vi den. Den er betalt for.
        visFejl("netvaerk");
      }
    },
    [gem, tekster],
  );

  /**
   * Opstarten. Ligger i sin egen funktion og ikke direkte i effekten, fordi
   * sessionStorage først findes, når siden er i browseren. Den kan ikke
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
    if (kladde.faerdig && kladde.html) {
      kladdeRef.current = kladde;
      setTekst(kladde.tekst);
      setHtml(kladde.html);
      setBlokke(kladde.blokke);
      setTitel(kladde.titel);
      setBeskrivelse(kladde.beskrivelse);
      setHarMeta(Boolean(kladde.titel || kladde.beskrivelse));
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

  /**
   * Kopiér til udklipsholderen, med en vej udenom, når browseren siger nej.
   *
   * navigator.clipboard findes kun i det, browsere kalder en sikker kontekst.
   * localhost tæller med; den netværksadresse, udviklingsserveren også lytter
   * på (http://192.168.x.x:3000), gør ikke. Browseren kan desuden nægte, hvis
   * siden ikke har fokus.
   *
   * Kan vi ikke kopiere, markerer vi teksten i stedet, så brugeren selv kan
   * trykke Ctrl+C. Det virker altid, også uden udklipsholder-API.
   */
  async function kopier(
    id: string,
    vaerdi: string,
    felt?: HTMLInputElement | HTMLTextAreaElement | null,
  ) {
    try {
      if (!navigator.clipboard) throw new Error("Ingen adgang til udklipsholder");

      await navigator.clipboard.writeText(vaerdi);
      setMarkeret(false);
      setKopieret(id);
      setTimeout(() => setKopieret((v) => (v === id ? null : v)), 2000);
    } catch {
      setMarkeret(true);

      if (felt) {
        felt.focus();
        felt.select();
      } else {
        // Hele teksten: koden vises frem og markeres af effekten nedenfor.
        setVisKoder(true);
      }
    }
  }

  // Markér koden, når kopieringen slog fejl. Kører efter at <pre> er tegnet.
  useEffect(() => {
    if (!markeret || !visKoder || !kodeRef.current) return;

    const omraade = document.createRange();
    omraade.selectNodeContents(kodeRef.current);

    const markering = window.getSelection();
    markering?.removeAllRanges();
    markering?.addRange(omraade);

    kodeRef.current.scrollIntoView({ block: "nearest" });
  }, [markeret, visKoder]);

  function proevIgen() {
    const kladde = hentKladde();
    if (kladde) {
      void generer({
        ...kladde,
        tekst: "",
        html: "",
        blokke: [],
        titel: "",
        beskrivelse: "",
        faerdig: false,
      });
    }
  }

  function blokLabel(blok: Blok): string {
    if (blok.slags === "titel") return tekster.blokTitel;
    if (blok.slags === "indledning") return tekster.blokIndledning;

    return tekster.blokSektion.replace("{nummer}", String(blok.nummer ?? ""));
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

  const erFaerdig = status === "faerdig" && html;

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
            {fejl.besked}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={proevIgen}
              className="rounded-lg border border-kant px-4 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
            >
              {tekster.proevIgen}
            </button>
            {!GRATIS_AT_PROEVE_IGEN.has(fejl.aarsag) && (
              <span className="text-xs text-gran-let">{tekster.koster}</span>
            )}
          </div>
        </div>
      )}

      {harMeta && (
        <section className="space-y-5 rounded-2xl border border-kant bg-kort p-6">
          <div className="space-y-1">
            <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
              {tekster.metaOverskrift}
            </h2>
            <p className="text-sm leading-relaxed text-gran-let">
              {tekster.metaForklaring}
            </p>
          </div>

          <MetaFelt
            id="titel"
            label={tekster.metaTitel}
            vaerdi={titel}
            loft={TITEL_LOFT}
            flerlinjet={false}
            erKopieret={kopieret === "titel"}
            tekster={tekster}
            saet={(v) => {
              setTitel(v);
              gem({ titel: v });
            }}
            kopier={kopier}
          />

          <MetaFelt
            id="beskrivelse"
            label={tekster.metaBeskrivelse}
            vaerdi={beskrivelse}
            loft={BESKRIVELSE_LOFT}
            flerlinjet
            erKopieret={kopieret === "beskrivelse"}
            tekster={tekster}
            saet={(v) => {
              setBeskrivelse(v);
              gem({ beskrivelse: v });
            }}
            kopier={kopier}
          />
        </section>
      )}

      {/*
        Mens teksten bliver skrevet, vises den rå strøm som TEKST. React
        escaper den, så intet af det modellen skriver kan udføres. Først når
        teksten er hel og saneret på serveren, vises den som HTML.
      */}
      {!erFaerdig && tekst && (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-kant bg-kort p-6 font-mono text-sm leading-relaxed text-gran">
          {tekst}
        </pre>
      )}

      {erFaerdig && (
        <>
          {visKoder ? (
            <pre
              ref={kodeRef}
              className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-kant bg-kort p-6 font-mono text-sm leading-relaxed text-gran"
            >
              {html}
            </pre>
          ) : blokke.length > 0 ? (
            <div className="space-y-4">
              {blokke.map((blok) => (
                <section
                  key={blok.id}
                  aria-label={blok.overskrift ?? blokLabel(blok)}
                  className="space-y-3 rounded-2xl border border-kant bg-kort p-6"
                >
                  <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
                    {blokLabel(blok)}
                  </p>

                  <div
                    className="tekst"
                    // Saneret server-side med sanitize-html mod hvidlisten i
                    // CLAUDE.md regel 4, FØR teksten blev delt i blokke.
                    // Se lib/tekst/saner.ts og lib/tekst/blokke.ts.
                    dangerouslySetInnerHTML={{ __html: blok.html }}
                  />
                </section>
              ))}
            </div>
          ) : (
            // En kladde fra før blokkene fandtes. Vises som ét stykke.
            <article
              className="tekst rounded-2xl border border-kant bg-kort p-8"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => kopier("html", html)}
              className="rounded-lg bg-gran px-4 py-2 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
            >
              {kopieret === "html" ? tekster.kopieret : tekster.kopier}
            </button>

            <button
              type="button"
              onClick={() => setVisKoder((v) => !v)}
              className="rounded-lg border border-kant px-4 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
            >
              {visKoder ? tekster.visTekst : tekster.visHtml}
            </button>

            <Link href="/app/ny" className="text-sm text-gran underline">
              {tekster.nyTekst}
            </Link>
          </div>

          {markeret && (
            <p
              role="status"
              className="rounded-lg border border-rav bg-kort px-4 py-3 text-sm leading-relaxed text-gran"
            >
              {tekster.kopiMarkeret}
            </p>
          )}
        </>
      )}
    </div>
  );
}
