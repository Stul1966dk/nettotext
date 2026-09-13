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
  findFaktafelt,
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
  ansvar: string;
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
  faktaLabel: string;
  faktaHjaelp: string;
  faktaPladsholder: string;
  faktaKnap: string;
  faktaHenter: string;
  faktaGratis: string;
  /** Kvittering med {antal}. */
  faktaLagt: string;
  /** Lagt til kvitteringen, når der ikke var plads til det hele. */
  faktaKlippet: string;
  faktaFejl: Record<string, string>;
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

  // De to felter, koden selv kan skrive i. Står flagene ikke i skabelonen,
  // findes knapperne slet ikke — se findIdefelt og findFaktafelt i
  // lib/skabeloner/typer.ts.
  const idefelt = findIdefelt(felter);
  const faktafelt = findFaktafelt(felter);

  // NETOP de felter er styret af React, fordi et forslag eller en faktaliste
  // skal kunne skrive i dem. Resten af formularen er uændret uindsvøbt HTML:
  // browseren holder værdierne, og de læses først, når der trykkes.
  const [vaerdier, setVaerdier] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [idefelt, faktafelt]
        .filter((felt): felt is InputFelt => felt !== null)
        .map((felt) => [felt.navn, felt.standard ?? ""]),
    ),
  );

  const [ideer, setIdeer] = useState<Ide[]>([]);
  const [henter, setHenter] = useState(false);
  const [ideFejl, setIdeFejl] = useState<string | null>(null);

  // Den indsatte specifikation. Den bliver ALDRIG gemt og følger ikke med
  // kladden: den er et arbejdsredskab på vej mod faktalisten, ikke noget
  // brugeren skal have liggende.
  const [indsat, setIndsat] = useState("");
  const [udtraekker, setUdtraekker] = useState(false);
  const [faktaFejl, setFaktaFejl] = useState<string | null>(null);
  const [faktaKvittering, setFaktaKvittering] = useState<string | null>(null);

  function saetVaerdi(navn: string, vaerdi: string) {
    setVaerdier((nu) => ({ ...nu, [navn]: vaerdi }));
  }

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
   * Den indsatte specifikation bliver til en liste med oplysninger.
   *
   * Bemærk hvad der IKKE sker: der sendes ingen adresse af sted, og serveren
   * henter ikke noget. Brugeren har selv kopieret teksten — det er dét, der
   * holder funktionen fri af ophavsretten. Se docs/beslutninger.md 13.09.2026.
   *
   * Listen LÆGGES TIL det, der allerede står i feltet, frem for at erstatte
   * det. Har hun selv skrevet tre linjer først, skal de ikke forsvinde, fordi
   * hun bagefter indsætter et datablad.
   */
  async function hentFakta() {
    if (!faktafelt) return;

    setUdtraekker(true);
    setFaktaFejl(null);
    setFaktaKvittering(null);

    try {
      const svar = await fetch("/api/fakta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skabelon,
          felt: faktafelt.navn,
          tekst: indsat,
        }),
      });

      const data = await svar.json().catch(() => null);

      if (!svar.ok || !Array.isArray(data?.fakta)) {
        // Som ved idéforslagene: ruten svarer med en kategori, aldrig med en
        // besked. Så kan en fejl fra serveren ikke komme til at stå på
        // skærmen med sine egne ord.
        const aarsag = typeof data?.aarsag === "string" ? data.aarsag : "ukendt";
        setFaktaFejl(tekster.faktaFejl[aarsag] ?? tekster.faktaFejl.ukendt);
        return;
      }

      const fakta = data.fakta as string[];
      const staaende = (vaerdier[faktafelt.navn] ?? "").trim();
      const samlet = [staaende, fakta.join("\n")].filter(Boolean).join("\n");

      // Feltets eget loft gælder også, når det er koden der skriver. Uden
      // det ville briefen blive afvist ved generering, med en fejl brugeren
      // ikke kunne se grunden til.
      const loft = faktafelt.maxLaengde ?? 2000;
      const klippet = samlet.length > loft;

      saetVaerdi(faktafelt.navn, klippet ? samlet.slice(0, loft) : samlet);
      setIndsat("");

      setFaktaKvittering(
        [
          tekster.faktaLagt.replace("{antal}", String(fakta.length)),
          klippet ? tekster.faktaKlippet.replace("{loft}", String(loft)) : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch {
      setFaktaFejl(tekster.faktaFejl.netvaerk ?? tekster.faktaFejl.ukendt);
    } finally {
      setUdtraekker(false);
    }
  }

  /**
   * Et valgt forslag skrives ind i feltet — det er ikke låst bagefter.
   * Emne og vinkel er to sætninger, og de kan begge to bruges, når feltet er
   * et tekstområde. Er feltet en enkelt linje, ryger vinklen ikke med: den
   * ville blive klippet af i visningen og gøre feltet ulæseligt.
   */
  function vaelgIde(ide: Ide) {
    if (!idefelt) return;

    saetVaerdi(
      idefelt.navn,
      idefelt.type === "tekstomraade" && ide.vinkel
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
        const erFaktafelt = faktafelt?.navn === felt.navn;

        // Felter, koden kan skrive i, styres af React. De andre passer
        // browseren selv.
        const styring =
          felt.navn in vaerdier
            ? {
                value: vaerdier[felt.navn],
                onChange: (
                  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                ) => saetVaerdi(felt.navn, e.target.value),
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

            {/* Indsæt-feltet står ved det felt, listen lander i. Samme
                begrundelse som ved idéforslagene: det er dér, man opdager,
                at man ikke gider taste en specifikation af i hånden. */}
            {erFaktafelt && (
              <div className="space-y-3 rounded-xl border border-kant bg-kort p-4">
                <label
                  htmlFor="__indsat"
                  className="block text-sm font-medium text-gran"
                >
                  {tekster.faktaLabel}
                </label>

                <p
                  id="__indsat-hjaelp"
                  className="text-sm leading-relaxed text-gran-let"
                >
                  {tekster.faktaHjaelp}
                </p>

                <textarea
                  id="__indsat"
                  rows={4}
                  maxLength={8000}
                  value={indsat}
                  onChange={(e) => setIndsat(e.target.value)}
                  placeholder={tekster.faktaPladsholder}
                  aria-describedby="__indsat-hjaelp"
                  className={`${feltKlasse} resize-y`}
                />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button
                    type="button"
                    onClick={hentFakta}
                    disabled={udtraekker || !indsat.trim()}
                    className="rounded-lg border border-gran px-4 py-2 text-sm font-medium text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60"
                  >
                    {udtraekker ? tekster.faktaHenter : tekster.faktaKnap}
                  </button>

                  <p className="text-sm text-gran-let">{tekster.faktaGratis}</p>
                </div>

                {faktaFejl && (
                  <p
                    role="alert"
                    className="rounded-lg border border-rav bg-bund px-4 py-3 text-sm text-gran"
                  >
                    {faktaFejl}
                  </p>
                )}

                {faktaKvittering && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="rounded-lg border border-kant bg-bund px-4 py-3 text-sm leading-relaxed text-gran"
                  >
                    {faktaKvittering}
                  </p>
                )}
              </div>
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

      <div className="space-y-3">
        <button
          type="submit"
          className="rounded-lg bg-gran px-6 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
        >
          {tekster.knap}
        </button>

        {/* Ansvaret siges HER, hvor briefen sendes af sted, og igen i
            editoren ved faktatjekket. To gange, fordi det er to forskellige
            øjeblikke: her lover vi at bruge tallene, som de står — dér skal
            teksten bruges til noget. */}
        <p className="max-w-prose text-xs leading-relaxed text-gran-let">
          {tekster.ansvar}
        </p>
      </div>
    </form>
  );
}
