"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { InputFelt } from "@/lib/skabeloner/typer";

import { gemSkabelonAction, type Svar } from "./actions";

/**
 * Redigering af én teksttype.
 *
 * Feltbyggeren er det, siden findes for. En teksttype er data, men den data
 * har hidtil kun kunnet skrives som SQL, og det er ikke noget, ejeren skal
 * lave. Her sættes felterne sammen ét ad gangen, og det tekniske navn, som
 * briefen bruger som nøgle, udledes af spørgsmålet, så ingen skal finde på
 * det selv.
 *
 * Felterne holdes i React-state og sendes som JSON i ét skjult felt. Zod på
 * serveren er den eneste rigtige kontrol; alt her er hjælp til at ramme
 * rigtigt, ikke en garanti.
 */

type Tekster = Record<string, string>;

type Kopikilde = { slug: string; name: string; felter: InputFelt[] };

type Raekke = { key: string; felt: InputFelt; nyt: boolean };

const feltKlasse =
  "w-full rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran";

const knapKlasse =
  "rounded-lg border border-kant bg-kort px-3 py-1.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-40";

/** Spørgsmålet bliver til et teknisk navn, brugeren aldrig skal skrive selv. */
function tilNavn(label: string): string {
  const grund = label
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9_]+/, "")
    .slice(0, 30);

  return grund || "felt";
}

function unikt(navn: string, brugte: string[]): string {
  if (!brugte.includes(navn)) return navn;

  for (let n = 2; n < 50; n++) {
    const forsoeg = `${navn}_${n}`.slice(0, 30);
    if (!brugte.includes(forsoeg)) return forsoeg;
  }

  return `${navn}_${Date.now() % 1000}`.slice(0, 30);
}

function nytFelt(): InputFelt {
  return {
    navn: "",
    label: "",
    type: "tekst",
    paakraevet: false,
    maxLaengde: 200,
  };
}

export function Teksttypeformular({
  skabelon,
  kopikilder,
  tekster,
}: {
  skabelon: {
    slug: string;
    name: string;
    description: string;
    system_prompt: string;
    input_fields: InputFelt[];
    active: boolean;
  } | null;
  kopikilder: Kopikilde[];
  tekster: Tekster;
}) {
  const erNy = skabelon === null;

  const [svar, submit, arbejder] = useActionState<Svar | null, FormData>(
    gemSkabelonAction,
    null,
  );

  const [raekker, setRaekker] = useState<Raekke[]>(() =>
    (skabelon?.input_fields ?? []).map((felt, i) => ({
      key: `f${i}`,
      felt,
      nyt: false,
    })),
  );

  function opdater(key: string, aendring: Partial<InputFelt>) {
    setRaekker((forrige) =>
      forrige.map((raekke) =>
        raekke.key === key
          ? { ...raekke, felt: { ...raekke.felt, ...aendring } }
          : raekke,
      ),
    );
  }

  /** Nye felter får deres tekniske navn af spørgsmålet. Gamle beholder deres:
      ændres navnet, mister kladder, der allerede er gemt, det felt. */
  function opdaterLabel(raekke: Raekke, label: string) {
    if (!raekke.nyt) {
      opdater(raekke.key, { label });
      return;
    }

    const brugte = raekker
      .filter((r) => r.key !== raekke.key)
      .map((r) => r.felt.navn);

    opdater(raekke.key, { label, navn: unikt(tilNavn(label), brugte) });
  }

  function tilfoej() {
    setRaekker((forrige) => [
      ...forrige,
      { key: `n${Date.now()}`, felt: nytFelt(), nyt: true },
    ]);
  }

  function fjern(key: string) {
    setRaekker((forrige) => forrige.filter((raekke) => raekke.key !== key));
  }

  function flyt(key: string, retning: -1 | 1) {
    setRaekker((forrige) => {
      const i = forrige.findIndex((raekke) => raekke.key === key);
      const j = i + retning;
      if (i < 0 || j < 0 || j >= forrige.length) return forrige;

      const kopi = [...forrige];
      [kopi[i], kopi[j]] = [kopi[j], kopi[i]];
      return kopi;
    });
  }

  function kopierFra(slug: string) {
    const kilde = kopikilder.find((k) => k.slug === slug);
    if (!kilde) return;

    // `nyt: true`, selvom felterne kommer fra en anden teksttype: de er nye
    // HER. Omdøber man et kopieret spørgsmål, skal det tekniske navn følge
    // med, så en landingsside ikke ender med et felt, der hedder "produkt".
    setRaekker(
      kilde.felter.map((felt, i) => ({ key: `k${i}`, felt, nyt: true })),
    );
  }

  return (
    <form action={submit} className="space-y-10">
      <input type="hidden" name="erNy" value={erNy ? "ja" : "nej"} />
      <input
        type="hidden"
        name="felter"
        value={JSON.stringify(raekker.map((raekke) => raekke.felt))}
      />

      {/* --- Navn og adresse --------------------------------------------- */}
      <section className="space-y-6 rounded-2xl border border-kant bg-kort p-6">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-gran">
            {tekster.navn}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={80}
            defaultValue={skabelon?.name}
            placeholder={tekster.navnPladsholder}
            className={feltKlasse}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="slug" className="block text-sm font-medium text-gran">
            {tekster.adresse}
          </label>
          {erNy ? (
            <input
              id="slug"
              name="slug"
              type="text"
              required
              maxLength={48}
              placeholder={tekster.adressePladsholder}
              className={`${feltKlasse} font-mono`}
            />
          ) : (
            <>
              <input type="hidden" name="slug" value={skabelon.slug} />
              <p className="rounded-lg border border-kant bg-bund px-4 py-3 font-mono text-sm text-gran-let">
                /app/ny/{skabelon.slug}
              </p>
            </>
          )}
          <p className="text-sm leading-relaxed text-gran-let">
            {erNy ? tekster.adresseHjaelp : tekster.adresseLaast}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gran"
          >
            {tekster.beskrivelse}
          </label>
          <input
            id="description"
            name="description"
            type="text"
            maxLength={300}
            defaultValue={skabelon?.description}
            placeholder={tekster.beskrivelsePladsholder}
            className={feltKlasse}
          />
          <p className="text-sm leading-relaxed text-gran-let">
            {tekster.beskrivelseHjaelp}
          </p>
        </div>
      </section>

      {/* --- Systemprompten ---------------------------------------------- */}
      <section className="space-y-3 rounded-2xl border border-kant bg-kort p-6">
        <label
          htmlFor="system_prompt"
          className="block text-sm font-medium text-gran"
        >
          {tekster.prompt}
        </label>
        <p className="text-sm leading-relaxed text-gran-let">
          {tekster.promptHjaelp}
        </p>
        <textarea
          id="system_prompt"
          name="system_prompt"
          rows={20}
          required
          maxLength={40000}
          defaultValue={skabelon?.system_prompt}
          className={`${feltKlasse} resize-y font-mono text-sm leading-relaxed`}
        />
        <p className="text-sm leading-relaxed text-gran-let">
          {tekster.promptArv}
        </p>
      </section>

      {/* --- Felterne i briefen ------------------------------------------ */}
      <section className="space-y-4 rounded-2xl border border-kant bg-kort p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
            {tekster.felter}
          </h2>
          <button type="button" onClick={tilfoej} className={knapKlasse}>
            {tekster.tilfoejFelt}
          </button>
        </div>

        <p className="text-sm leading-relaxed text-gran-let">
          {tekster.felterHjaelp}
        </p>

        {erNy && kopikilder.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-kant bg-bund px-4 py-3">
            <label htmlFor="kopier" className="text-sm text-gran">
              {tekster.startUdFra}
            </label>
            <select
              id="kopier"
              defaultValue=""
              onChange={(e) => kopierFra(e.target.value)}
              className="rounded-lg border border-kant bg-kort px-3 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
            >
              <option value="">{tekster.vaelg}</option>
              {kopikilder.map((kilde) => (
                <option key={kilde.slug} value={kilde.slug}>
                  {kilde.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {raekker.length === 0 && (
          <p className="rounded-lg border border-rav bg-bund px-4 py-3 text-sm text-gran">
            {tekster.ingenFelter}
          </p>
        )}

        <div className="space-y-4">
          {raekker.map((raekke, i) => (
            <div
              key={raekke.key}
              className="space-y-4 rounded-lg border border-kant bg-bund p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-widest text-gran-let">
                  {tekster.felt} {i + 1}
                  {raekke.felt.navn && ` · ${raekke.felt.navn}`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => flyt(raekke.key, -1)}
                    disabled={i === 0}
                    aria-label={tekster.flytOp}
                    className={knapKlasse}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => flyt(raekke.key, 1)}
                    disabled={i === raekker.length - 1}
                    aria-label={tekster.flytNed}
                    className={knapKlasse}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => fjern(raekke.key)}
                    className={`${knapKlasse} text-gran-let underline`}
                  >
                    {tekster.fjern}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${raekke.key}-label`}
                  className="block text-sm font-medium text-gran"
                >
                  {tekster.spoergsmaal}
                </label>
                <input
                  id={`${raekke.key}-label`}
                  type="text"
                  value={raekke.felt.label}
                  maxLength={120}
                  onChange={(e) => opdaterLabel(raekke, e.target.value)}
                  placeholder={tekster.spoergsmaalPladsholder}
                  className={feltKlasse}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor={`${raekke.key}-type`}
                    className="block text-sm font-medium text-gran"
                  >
                    {tekster.type}
                  </label>
                  <select
                    id={`${raekke.key}-type`}
                    value={raekke.felt.type}
                    onChange={(e) =>
                      opdater(raekke.key, {
                        type: e.target.value as InputFelt["type"],
                        valg:
                          e.target.value === "valg"
                            ? (raekke.felt.valg ?? [])
                            : undefined,
                      })
                    }
                    className={feltKlasse}
                  >
                    <option value="tekst">{tekster.typeTekst}</option>
                    <option value="tekstomraade">
                      {tekster.typeTekstomraade}
                    </option>
                    <option value="valg">{tekster.typeValg}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={`${raekke.key}-max`}
                    className="block text-sm font-medium text-gran"
                  >
                    {tekster.maxLaengde}
                  </label>
                  <input
                    id={`${raekke.key}-max`}
                    type="number"
                    min={20}
                    max={4000}
                    value={raekke.felt.maxLaengde ?? 200}
                    onChange={(e) =>
                      opdater(raekke.key, { maxLaengde: Number(e.target.value) })
                    }
                    className={feltKlasse}
                  />
                </div>
              </div>

              {raekke.felt.type === "valg" && (
                <div className="space-y-2">
                  <label
                    htmlFor={`${raekke.key}-valg`}
                    className="block text-sm font-medium text-gran"
                  >
                    {tekster.muligheder}
                  </label>
                  <textarea
                    id={`${raekke.key}-valg`}
                    rows={4}
                    value={(raekke.felt.valg ?? [])
                      .map((v) => v.label)
                      .join("\n")}
                    onChange={(e) =>
                      opdater(raekke.key, {
                        valg: e.target.value
                          .split("\n")
                          .map((linje) => linje.trim())
                          .filter(Boolean)
                          .map((label) => ({
                            vaerdi: tilNavn(label),
                            label,
                          })),
                      })
                    }
                    placeholder={tekster.mulighederPladsholder}
                    className={`${feltKlasse} resize-y`}
                  />
                  <p className="text-sm leading-relaxed text-gran-let">
                    {tekster.mulighederHjaelp}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor={`${raekke.key}-hjaelp`}
                  className="block text-sm font-medium text-gran"
                >
                  {tekster.hjaelpetekst}
                </label>
                <input
                  id={`${raekke.key}-hjaelp`}
                  type="text"
                  value={raekke.felt.hjaelp ?? ""}
                  maxLength={300}
                  onChange={(e) =>
                    opdater(raekke.key, { hjaelp: e.target.value })
                  }
                  className={feltKlasse}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${raekke.key}-pladsholder`}
                  className="block text-sm font-medium text-gran"
                >
                  {tekster.pladsholder}
                </label>
                <input
                  id={`${raekke.key}-pladsholder`}
                  type="text"
                  value={raekke.felt.pladsholder ?? ""}
                  maxLength={300}
                  onChange={(e) =>
                    opdater(raekke.key, { pladsholder: e.target.value })
                  }
                  className={feltKlasse}
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-gran">
                <input
                  type="checkbox"
                  checked={raekke.felt.paakraevet}
                  onChange={(e) =>
                    opdater(raekke.key, { paakraevet: e.target.checked })
                  }
                  className="h-4 w-4 accent-gran"
                />
                {tekster.paakraevet}
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* --- Synlighed og gemning ---------------------------------------- */}
      <section className="space-y-4 rounded-2xl border border-kant bg-kort p-6">
        <label className="flex items-center gap-3 text-sm text-gran">
          <input
            type="checkbox"
            name="active"
            defaultChecked={skabelon?.active ?? false}
            className="h-4 w-4 accent-gran"
          />
          {tekster.aktiv}
        </label>
        <p className="text-sm leading-relaxed text-gran-let">
          {tekster.aktivHjaelp}
        </p>
      </section>

      {svar && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm leading-relaxed text-gran ${
            svar.ok ? "border-kant bg-kort" : "border-rav bg-kort"
          }`}
        >
          {svar.besked}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={arbejder}
          className="rounded-lg bg-gran px-6 py-3 font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund disabled:opacity-40"
        >
          {arbejder ? tekster.gemmer : tekster.gem}
        </button>

        <Link
          href="/app/admin/teksttyper"
          className="text-sm text-gran-let underline outline-none focus-visible:ring-2 focus-visible:ring-gran"
        >
          {tekster.tilbageTilListen}
        </Link>
      </div>
    </form>
  );
}
