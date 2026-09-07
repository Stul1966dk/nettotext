"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { gemKladde, nyKladde } from "@/lib/skabeloner/kladde";
import {
  STANDARD_STILTONE,
  STILTONER,
  stiltoneSkema,
} from "@/lib/skabeloner/stiltone";
import {
  findIdefelt,
  type Brief,
  type InputFelt,
} from "@/lib/skabeloner/typer";
import type { Ide } from "@/lib/tekst/ideer";

type Tekster = {
  paakraevet: string;
  valgfrit: string;
  knap: string;
  manglerFelter: string;
  instruktion: string;
  instruktionHjaelp: string;
  instruktionPladsholder: string;
  stiltone: string;
  stiltoneHjaelp: string;
  /** Én label pr. værdi i STILTONER. */
  stiltoneValg: Record<string, string>;
  ideKnap: string;
  ideIgen: string;
  ideHenter: string;
  ideHjaelp: string;
  ideOverskrift: string;
  /** Fejlbeskeder slået op på rutens `aarsag`. */
  ideFejl: Record<string, string>;
};

const feltKlasse =
  "w-full rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran";

export function BriefFormular({
  skabelon,
  felter,
  tekster,
}: {
  skabelon: string;
  felter: InputFelt[];
  tekster: Tekster;
}) {
  const router = useRouter();
  const [fejl, setFejl] = useState<string | null>(null);

  // Feltet, idéforslagene fylder ud. Står flaget ikke i skabelonen, findes
  // knappen slet ikke — se findIdefelt i lib/skabeloner/typer.ts.
  const idefelt = findIdefelt(felter);

  // Netop DET felt er styret af React, fordi et forslag skal kunne skrive i
  // det. Resten af formularen er uændret uindsvøbt HTML: browseren holder
  // værdierne, og de læses først, når der trykkes.
  const [ideVaerdi, setIdeVaerdi] = useState(idefelt?.standard ?? "");
  const [ideer, setIdeer] = useState<Ide[]>([]);
  const [henter, setHenter] = useState(false);
  const [ideFejl, setIdeFejl] = useState<string | null>(null);

  const formular = useRef<HTMLFormElement>(null);

  /** Briefen som den ser ud lige nu — kun skabelonens egne felter. */
  function delvisBrief(): Brief {
    const data = new FormData(formular.current ?? undefined);
    const brief: Brief = {};

    for (const felt of felter) {
      const vaerdi = String(data.get(felt.navn) ?? "").trim();
      if (vaerdi) brief[felt.navn] = vaerdi;
    }

    return brief;
  }

  async function hentIdeer() {
    setHenter(true);
    setIdeFejl(null);
    setIdeer([]);

    try {
      const svar = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skabelon, brief: delvisBrief() }),
      });

      const data = await svar.json().catch(() => null);

      if (!svar.ok || !Array.isArray(data?.ideer)) {
        // Ruten svarer med en kategori, ikke med en besked. Oversættelsen
        // ligger i sprogfilen, så en fejl fra serveren aldrig kan komme til
        // at stå på skærmen med sine egne ord.
        const aarsag =
          typeof data?.aarsag === "string" ? data.aarsag : "ukendt";
        setIdeFejl(tekster.ideFejl[aarsag] ?? tekster.ideFejl.ukendt);
        return;
      }

      setIdeer(data.ideer as Ide[]);
    } catch {
      setIdeFejl(tekster.ideFejl.netvaerk ?? tekster.ideFejl.ukendt);
    } finally {
      setHenter(false);
    }
  }

  /**
   * Et valgt forslag skrives ind i feltet — det er ikke låst bagefter.
   * Emne og vinkel er to sætninger, og de kan begge to bruges, når feltet er
   * et tekstområde. Er feltet en enkelt linje, ryger vinklen ikke med: den
   * ville blive klippet af i visningen og gøre feltet ulæseligt.
   */
  function vaelgIde(ide: Ide) {
    setIdeVaerdi(
      idefelt?.type === "tekstomraade" && ide.vinkel
        ? `${ide.emne}\n${ide.vinkel}`
        : ide.emne,
    );

    // Listen lukkes, når et forslag er valgt. Bliver den stående, er det
    // ikke til at se, hvad man endte med at vælge.
    setIdeer([]);
  }

  function haandterIndsend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const brief: Brief = {};

    for (const felt of felter) {
      const vaerdi = String(data.get(felt.navn) ?? "").trim();

      if (felt.paakraevet && !vaerdi) {
        setFejl(tekster.manglerFelter);
        return;
      }

      if (vaerdi) brief[felt.navn] = vaerdi;
    }

    // Det frie ønske står UDEN FOR briefen: briefens felter kommer fra
    // skabelonen og valideres mod den, og ønsket hører ikke til nogen
    // teksttype. Se briefSkema i lib/skabeloner/typer.ts.
    const instruktion = String(data.get("__instruktion") ?? "").trim();

    // Samme sted som ønsket, og af samme grund: stiltonen hører ikke til
    // nogen bestemt teksttype. Den gælder dem alle, også dem der kommer.
    const stiltone = stiltoneSkema.parse(data.get("__stiltone"));

    // Briefen rejser gennem browseren, ikke gennem databasen. Se kladde.ts.
    gemKladde(nyKladde(skabelon, brief, instruktion, stiltone));
    router.push("/app/skriv");
  }

  return (
    <form
      ref={formular}
      onSubmit={haandterIndsend}
      className="mt-8 space-y-8"
      noValidate
    >
      {felter.map((felt) => {
        const erIdefelt = idefelt?.navn === felt.navn;

        // Idéfeltet styres af React, så et forslag kan skrive i det. De
        // andre felter passer browseren selv.
        const styring = erIdefelt
          ? {
              value: ideVaerdi,
              onChange: (
                e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
              ) => setIdeVaerdi(e.target.value),
            }
          : { defaultValue: felt.standard };

        return (
          <div key={felt.navn} className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor={felt.navn}
                className="block text-sm font-medium text-gran"
              >
                {felt.label}
              </label>
              <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-widest text-gran-let">
                {felt.paakraevet ? tekster.paakraevet : tekster.valgfrit}
              </span>
            </div>

            {felt.type === "tekstomraade" && (
              <textarea
                id={felt.navn}
                name={felt.navn}
                rows={4}
                maxLength={felt.maxLaengde}
                {...styring}
                placeholder={felt.pladsholder}
                aria-describedby={
                  felt.hjaelp ? `${felt.navn}-hjaelp` : undefined
                }
                className={`${feltKlasse} resize-y`}
              />
            )}

            {felt.type === "tekst" && (
              <input
                id={felt.navn}
                name={felt.navn}
                type="text"
                maxLength={felt.maxLaengde}
                {...styring}
                placeholder={felt.pladsholder}
                aria-describedby={
                  felt.hjaelp ? `${felt.navn}-hjaelp` : undefined
                }
                className={feltKlasse}
              />
            )}

            {felt.type === "valg" && (
              <select
                id={felt.navn}
                name={felt.navn}
                defaultValue={felt.standard ?? felt.valg?.[0]?.vaerdi}
                aria-describedby={
                  felt.hjaelp ? `${felt.navn}-hjaelp` : undefined
                }
                className={feltKlasse}
              >
                {felt.valg?.map((valg) => (
                  <option key={valg.vaerdi} value={valg.vaerdi}>
                    {valg.label}
                  </option>
                ))}
              </select>
            )}

            {felt.hjaelp && (
              <p
                id={`${felt.navn}-hjaelp`}
                className="text-sm leading-relaxed text-gran-let"
              >
                {felt.hjaelp}
              </p>
            )}

            {/* Idéforslagene står ved det felt, de fylder ud — ikke øverst på
              siden. Det er dér, man opdager, at man ikke ved, hvad man skal
              skrive. */}
            {erIdefelt && (
              <div className="space-y-3 rounded-xl border border-kant bg-kort p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button
                    type="button"
                    onClick={hentIdeer}
                    disabled={henter}
                    className="rounded-lg border border-gran px-4 py-2 text-sm font-medium text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60"
                  >
                    {henter
                      ? tekster.ideHenter
                      : ideer.length > 0
                        ? tekster.ideIgen
                        : tekster.ideKnap}
                  </button>

                  <p className="text-sm leading-relaxed text-gran-let">
                    {tekster.ideHjaelp}
                  </p>
                </div>

                {ideFejl && (
                  <p
                    role="alert"
                    className="rounded-lg border border-rav bg-bund px-4 py-3 text-sm text-gran"
                  >
                    {ideFejl}
                  </p>
                )}

                <div aria-live="polite">
                  {ideer.length > 0 && (
                    <>
                      <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
                        {tekster.ideOverskrift}
                      </p>

                      <ul className="mt-3 space-y-2">
                        {ideer.map((ide, nr) => (
                          <li key={`${nr}-${ide.emne}`}>
                            <button
                              type="button"
                              onClick={() => vaelgIde(ide)}
                              className="block w-full rounded-lg border border-kant bg-bund px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort"
                            >
                              <span className="block font-medium text-gran">
                                {ide.emne}
                              </span>
                              {ide.vinkel && (
                                <span className="mt-1 block text-sm leading-relaxed text-gran-let">
                                  {ide.vinkel}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Stiltonen står uden for løkken, fordi den gælder ALLE teksttyper,
          også dem der ikke er skrevet endnu. Stod den i skabelonernes
          input_fields, skulle hver ny migrationsfil gentage den. */}
      <div className="space-y-2">
        <label
          htmlFor="__stiltone"
          className="block text-sm font-medium text-gran"
        >
          {tekster.stiltone}
        </label>

        <select
          id="__stiltone"
          name="__stiltone"
          defaultValue={STANDARD_STILTONE}
          aria-describedby="__stiltone-hjaelp"
          className={feltKlasse}
        >
          {STILTONER.map((vaerdi) => (
            <option key={vaerdi} value={vaerdi}>
              {tekster.stiltoneValg[vaerdi]}
            </option>
          ))}
        </select>

        <p
          id="__stiltone-hjaelp"
          className="text-sm leading-relaxed text-gran-let"
        >
          {tekster.stiltoneHjaelp}
        </p>
      </div>

      {/* Uden for løkken, fordi feltet ikke kommer fra skabelonen. Navnet
          har to underscores foran, så det aldrig kan kollidere med et felt,
          en teksttype selv har fundet på. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <label
            htmlFor="__instruktion"
            className="block text-sm font-medium text-gran"
          >
            {tekster.instruktion}
          </label>
          <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-widest text-gran-let">
            {tekster.valgfrit}
          </span>
        </div>

        <textarea
          id="__instruktion"
          name="__instruktion"
          rows={3}
          maxLength={1000}
          placeholder={tekster.instruktionPladsholder}
          aria-describedby="__instruktion-hjaelp"
          className={`${feltKlasse} resize-y`}
        />

        <p
          id="__instruktion-hjaelp"
          className="text-sm leading-relaxed text-gran-let"
        >
          {tekster.instruktionHjaelp}
        </p>
      </div>

      {fejl && (
        <p
          role="alert"
          className="rounded-lg border border-rav bg-bund px-4 py-3 text-sm text-gran"
        >
          {fejl}
        </p>
      )}

      <button
        type="submit"
        className="rounded-lg bg-gran px-6 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
      >
        {tekster.knap}
      </button>
    </form>
  );
}
