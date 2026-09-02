"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * AI-forbindelsen i indstillinger.
 *
 * Nøglen skrives her og forlader aldrig serveren igen. Efter en gemning
 * findes den kun som krypteret tekst i databasen og som de fire tegn i
 * `hint` — også for os. Derfor er der ikke noget felt, der kan vise den, og
 * derfor er "Skift nøgle" en ny indtastning, ikke en redigering.
 */

export type LeverandoerValg = {
  id: string;
  navn: string;
  /** Kan vælges? Nej, så længe vi ikke kender priserne. Se lib/ai/modeller.ts. */
  klar: boolean;
  konsol: string;
  /** Modellen, formularen står på fra start. Se standardValgbarModel. */
  standard: string;
  modeller: { id: string; navn: string; beskrivelse: string }[];
};

export type GemtNoegle = {
  leverandoer: string;
  leverandoerNavn: string;
  model: string;
  hint: string;
  /** Færdigformateret på serveren, så datoen ser ens ud for alle. */
  sidstAfproevet: string | null;
};

type Tekster = Record<string, string>;

/** Fylder {pladsholdere} ud. next-intl gør det samme på serveren. */
function fyld(skabelon: string, vaerdier: Record<string, string>): string {
  return Object.entries(vaerdier).reduce(
    (tekst, [navn, vaerdi]) => tekst.replaceAll(`{${navn}}`, vaerdi),
    skabelon,
  );
}

const feltKlasse =
  "w-full rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran";

const primaerKnap =
  "rounded-lg bg-gran px-5 py-2.5 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60";

const sekundaerKnap =
  "rounded-lg border border-kant px-5 py-2.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-60";

export function AiForbindelse({
  gemt,
  leverandoerer,
  tekster,
}: {
  gemt: GemtNoegle | null;
  leverandoerer: LeverandoerValg[];
  tekster: Tekster;
}) {
  const router = useRouter();

  const foersteKlar = leverandoerer.find((l) => l.klar) ?? leverandoerer[0];

  const [valgt, setValgt] = useState(foersteKlar.id);
  const [model, setModel] = useState(foersteKlar.standard);
  const [noegle, setNoegle] = useState("");

  // Er formularen fremme? Den er det altid, når der ingen nøgle er gemt.
  const [skifter, setSkifter] = useState(false);
  const [bekraefterSlet, setBekraefterSlet] = useState(false);

  const [arbejder, setArbejder] = useState<string | null>(null);
  const [besked, setBesked] = useState<string | null>(null);
  const [fejl, setFejl] = useState<string | null>(null);

  const leverandoer = leverandoerer.find((l) => l.id === valgt) ?? foersteKlar;
  const visFormular = !gemt || skifter;

  function vaelgLeverandoer(id: string) {
    const ny = leverandoerer.find((l) => l.id === id);
    if (!ny || !ny.klar) return;

    setValgt(id);
    setModel(ny.standard);
    setFejl(null);
  }

  /**
   * Ét sted til alle kald mod /api/keys.
   *
   * Fejlbeskederne slås op på `aarsag` — ruten sender aldrig leverandørens
   * egen fejltekst, fordi den kan indeholde dele af nøglen.
   */
  async function kald(
    slags: string,
    krop: object | null,
    navnTilFejl: string,
  ): Promise<boolean> {
    setArbejder(slags);
    setBesked(null);
    setFejl(null);

    try {
      const svar = await fetch("/api/keys", {
        method: krop ? "POST" : "DELETE",
        headers: krop ? { "Content-Type": "application/json" } : undefined,
        body: krop ? JSON.stringify(krop) : undefined,
      });

      if (!svar.ok) {
        const data = await svar.json().catch(() => ({ aarsag: "ukendt" }));
        const tekstNoegle = `fejl${tilStortForbogstav(String(data.aarsag))}`;

        setFejl(
          fyld(tekster[tekstNoegle] ?? tekster.fejlUkendt, {
            navn: navnTilFejl,
          }),
        );
        return false;
      }

      return true;
    } catch {
      setFejl(tekster.fejlUkendt);
      return false;
    } finally {
      setArbejder(null);
    }
  }

  async function gemNoegle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ok = await kald(
      "gemmer",
      { handling: "gem", leverandoer: valgt, model, noegle: noegle.trim() },
      leverandoer.navn,
    );

    if (!ok) return;

    // Nøglen ryddes med det samme. Den skal ikke ligge i browserens
    // hukommelse længere end det tog at sende den.
    setNoegle("");
    setSkifter(false);
    setBesked(tekster.gemt);
    router.refresh();
  }

  async function test() {
    const ok = await kald(
      "tester",
      { handling: "test" },
      gemt?.leverandoerNavn ?? leverandoer.navn,
    );

    if (!ok) return;

    setBesked(tekster.testOk);
    router.refresh();
  }

  async function skiftModel(ny: string) {
    const ok = await kald(
      "model",
      { handling: "model", model: ny },
      gemt?.leverandoerNavn ?? leverandoer.navn,
    );

    if (!ok) return;

    setBesked(tekster.skiftModelGemt);
    router.refresh();
  }

  async function slet() {
    const ok = await kald("sletter", null, gemt?.leverandoerNavn ?? "");
    if (!ok) return;

    setBekraefterSlet(false);
    setBesked(tekster.slettet);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {gemt && (
        <div className="space-y-4 rounded-xl border border-kant p-5">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-widest text-gran-let">
              {tekster.gemtOverskrift}
            </p>
            <p className="text-gran">
              {fyld(tekster.gemtHint, {
                navn: gemt.leverandoerNavn,
                hint: gemt.hint,
              })}
            </p>
            <p className="text-sm text-gran-let">
              {gemt.sidstAfproevet
                ? fyld(tekster.sidstAfproevet, { dato: gemt.sidstAfproevet })
                : tekster.aldrigAfproevet}
            </p>
          </div>

          {/* Skjules, mens nøgleformularen er fremme. Ellers stod der to
              felter med overskriften "Model" på skærmen: dette, der ændrer
              den gemte model med det samme, og formularens, der hører til
              den nye nøgle. To ens mærkater med forskellig virkning. */}
          {!skifter && (
            <ModelValg
              id="gemt-model"
              label={tekster.modelLabel}
              modeller={
                leverandoerer.find((l) => l.id === gemt.leverandoer)
                  ?.modeller ?? []
              }
              vaerdi={gemt.model}
              deaktiveret={arbejder !== null}
              onVaelg={skiftModel}
            />
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={test}
              disabled={arbejder !== null}
              className={sekundaerKnap}
            >
              {arbejder === "tester" ? tekster.tester : tekster.test}
            </button>

            {!skifter && (
              <button
                type="button"
                onClick={() => {
                  setSkifter(true);
                  setBesked(null);
                  setFejl(null);
                }}
                disabled={arbejder !== null}
                className={sekundaerKnap}
              >
                {tekster.skift}
              </button>
            )}

            {bekraefterSlet ? (
              <>
                <button
                  type="button"
                  onClick={slet}
                  disabled={arbejder !== null}
                  className={sekundaerKnap}
                >
                  {arbejder === "sletter" ? tekster.sletter : tekster.sletJa}
                </button>
                <button
                  type="button"
                  onClick={() => setBekraefterSlet(false)}
                  disabled={arbejder !== null}
                  className={sekundaerKnap}
                >
                  {tekster.fortryd}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBekraefterSlet(true);
                  setBesked(null);
                  setFejl(null);
                }}
                disabled={arbejder !== null}
                className={sekundaerKnap}
              >
                {tekster.slet}
              </button>
            )}
          </div>

          {bekraefterSlet && (
            <p className="text-sm text-gran-let">{tekster.sletSpoergsmaal}</p>
          )}
        </div>
      )}

      {visFormular && (
        <form onSubmit={gemNoegle} className="space-y-6" noValidate>
          <fieldset className="space-y-2">
            <legend className="mb-2 block text-sm font-medium text-gran">
              {tekster.leverandoerLabel}
            </legend>

            {leverandoerer.map((l) => (
              <label
                key={l.id}
                className={`flex items-start gap-3 rounded-lg border border-kant p-3 ${
                  l.klar ? "cursor-pointer" : "opacity-60"
                }`}
              >
                <input
                  type="radio"
                  name="leverandoer"
                  value={l.id}
                  checked={valgt === l.id}
                  disabled={!l.klar}
                  onChange={() => vaelgLeverandoer(l.id)}
                  className="mt-1 accent-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
                />
                <span className="space-y-1">
                  <span className="block text-gran">{l.navn}</span>
                  {!l.klar && (
                    <span className="block text-sm text-gran-let">
                      {fyld(tekster.leverandoerIkkeKlar, { navn: l.navn })}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>

          <ModelValg
            id="ny-model"
            label={tekster.modelLabel}
            modeller={leverandoer.modeller}
            vaerdi={model}
            deaktiveret={arbejder !== null}
            onVaelg={setModel}
          />

          <div className="space-y-2">
            <label
              htmlFor="ai-noegle"
              className="block text-sm font-medium text-gran"
            >
              {tekster.noegleLabel}
            </label>

            <input
              id="ai-noegle"
              type="password"
              value={noegle}
              onChange={(e) => setNoegle(e.target.value)}
              placeholder={tekster.noeglePladsholder}
              autoComplete="off"
              spellCheck={false}
              className={`${feltKlasse} font-mono`}
            />

            <p className="text-sm leading-relaxed text-gran-let">
              {fyld(tekster.noegleHjaelp, { navn: leverandoer.navn })}
            </p>
            <p className="text-sm leading-relaxed text-gran-let">
              {tekster.noegleSikkerhed}
            </p>

            <a
              href={leverandoer.konsol}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-gran underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-gran"
            >
              {fyld(tekster.noegleHjaelpKnap, { navn: leverandoer.navn })}
            </a>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={arbejder !== null || noegle.trim().length === 0}
              className={primaerKnap}
            >
              {arbejder === "gemmer" ? tekster.gemmer : tekster.gem}
            </button>

            {gemt && (
              <button
                type="button"
                onClick={() => {
                  setSkifter(false);
                  setNoegle("");
                  setFejl(null);
                }}
                disabled={arbejder !== null}
                className={sekundaerKnap}
              >
                {tekster.fortryd}
              </button>
            )}
          </div>
        </form>
      )}

      {/* aria-live: skærmlæseren skal også få at vide, hvordan det gik. */}
      <p aria-live="polite" className="text-sm">
        {besked && <span className="text-stempel">{besked}</span>}
        {fejl && <span className="text-gran">{fejl}</span>}
      </p>
    </div>
  );
}

function ModelValg({
  id,
  label,
  modeller,
  vaerdi,
  deaktiveret,
  onVaelg,
}: {
  id: string;
  label: string;
  modeller: { id: string; navn: string; beskrivelse: string }[];
  vaerdi: string;
  deaktiveret: boolean;
  onVaelg: (id: string) => void;
}) {
  if (modeller.length === 0) return null;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gran">
        {label}
      </label>

      <select
        id={id}
        value={vaerdi}
        disabled={deaktiveret}
        onChange={(e) => onVaelg(e.target.value)}
        className={feltKlasse}
      >
        {modeller.map((m) => (
          <option key={m.id} value={m.id}>
            {m.navn} — {m.beskrivelse}
          </option>
        ))}
      </select>
    </div>
  );
}

/** "ugyldig_noegle" → "UgyldigNoegle", så årsagen kan slå en tekst op. */
function tilStortForbogstav(aarsag: string): string {
  return aarsag
    .split("_")
    .map((del) => del.charAt(0).toUpperCase() + del.slice(1))
    .join("");
}
