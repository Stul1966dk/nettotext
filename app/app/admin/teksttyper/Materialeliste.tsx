"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import {
  gemMaterialeAction,
  sletMaterialeAction,
  type MaterialeSvar,
} from "./materialeActions";

/**
 * Materiale til en teksttype: vejledninger og eksempler.
 *
 * Står UNDER teksttypens egen formular og ikke inde i den. Formularer kan
 * ikke ligge inde i hinanden, og hvert stykke materiale gemmes for sig, så
 * et nyt dokument ikke først bliver til noget, når hele teksttypen gemmes.
 *
 * Filer læses i browseren og bliver til tekst i feltet, FØR noget sendes.
 * Det er kun teksten, der gemmes — se migration 0026.
 *
 * Felterne er styret af React-state, og formularerne sendes med `send`
 * herunder i stedet for `action={...}`. Med `action` nulstiller React
 * formularen efter hver indsendelse, og så viste felterne den oprindelige
 * værdi, mens den gemte var en anden: et flueben, der var slået fra og gemt,
 * stod som slået til — og blev slået til igen ved næste gemning. Fundet ved
 * afprøvningen 27.09.2026.
 */

/** Sender formularen uden Reacts automatiske nulstilling. Se ovenfor. */
function send(dispatch: (formData: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
}

type Tekster = Record<string, string>;

type Materiale = {
  id: string;
  kind: "vejledning" | "eksempel";
  title: string;
  content: string;
  active: boolean;
};

const feltKlasse =
  "w-full rounded-lg border border-kant bg-kort px-4 py-3 text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran";

const knapKlasse =
  "rounded-lg border border-kant bg-kort px-3 py-1.5 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-40";

const MAKS_TEGN = 20_000;

/** Filnavnet uden endelse, som forslag til en titel. */
function titelFraFil(navn: string): string {
  return navn.replace(/\.(txt|md)$/i, "").replace(/[-_]+/g, " ").trim();
}

function Svarlinje({ svar }: { svar: MaterialeSvar | null }) {
  if (!svar) return null;

  return (
    <p
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm leading-relaxed text-gran ${
        svar.ok ? "border-kant bg-kort" : "border-rav bg-kort"
      }`}
    >
      {svar.besked}
    </p>
  );
}

/** Én formular til både et nyt og et eksisterende stykke materiale. */
function Materialeformular({
  slug,
  materiale,
  tekster,
}: {
  slug: string;
  materiale: Materiale | null;
  tekster: Tekster;
}) {
  const erNyt = materiale === null;
  const praefiks = materiale?.id ?? "nyt";

  const [kind, setKind] = useState(materiale?.kind ?? "vejledning");
  const [title, setTitle] = useState(materiale?.title ?? "");
  const [content, setContent] = useState(materiale?.content ?? "");
  const [active, setActive] = useState(materiale?.active ?? true);
  const [filfejl, setFilfejl] = useState<string | null>(null);

  const [svar, submit, arbejder] = useActionState<MaterialeSvar | null, FormData>(
    async (forrige, formData) => {
      const resultat = await gemMaterialeAction(forrige, formData);

      // Et nyt stykke materiale er gemt: felterne tømmes, så det næste kan
      // lægges ind. Et eksisterende beholder det, der står — det ER det gemte.
      if (erNyt && resultat.ok) {
        setTitle("");
        setContent("");
        setKind("vejledning");
        setActive(true);
      }

      return resultat;
    },
    null,
  );

  async function laesFil(fil: File | undefined) {
    setFilfejl(null);
    if (!fil) return;

    if (!/\.(txt|md)$/i.test(fil.name)) {
      setFilfejl(tekster.materialeFilType);
      return;
    }

    const tekst = (await fil.text()).replace(/\r\n?/g, "\n");

    if (tekst.length > MAKS_TEGN) {
      setFilfejl(tekster.materialeFilLang);
      return;
    }

    setContent(tekst);
    if (!title) setTitle(titelFraFil(fil.name));
  }

  return (
    <form onSubmit={send(submit)} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={materiale?.id ?? ""} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <label
            htmlFor={`${praefiks}-title`}
            className="block text-sm font-medium text-gran"
          >
            {tekster.materialeTitel}
          </label>
          <input
            id={`${praefiks}-title`}
            name="title"
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tekster.materialeTitelPladsholder}
            className={feltKlasse}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={`${praefiks}-kind`}
            className="block text-sm font-medium text-gran"
          >
            {tekster.materialeSlags}
          </label>
          <select
            id={`${praefiks}-kind`}
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Materiale["kind"])}
            className={feltKlasse}
          >
            <option value="vejledning">{tekster.materialeVejledning}</option>
            <option value="eksempel">{tekster.materialeEksempel}</option>
          </select>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-gran-let">
        {kind === "vejledning"
          ? tekster.materialeVejledningHjaelp
          : tekster.materialeEksempelHjaelp}
      </p>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <label
            htmlFor={`${praefiks}-content`}
            className="block text-sm font-medium text-gran"
          >
            {tekster.materialeIndhold}
          </label>
          <label className={`${knapKlasse} cursor-pointer focus-within:ring-2 focus-within:ring-gran`}>
            {tekster.materialeHentFil}
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(e) => {
                void laesFil(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
        </div>
        <textarea
          id={`${praefiks}-content`}
          name="content"
          rows={erNyt ? 10 : 14}
          required
          maxLength={MAKS_TEGN}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={tekster.materialeIndholdPladsholder}
          className={`${feltKlasse} resize-y font-mono text-sm leading-relaxed`}
        />
        <p className="font-mono text-xs text-gran-let">
          {content.length.toLocaleString("da-DK")} / {MAKS_TEGN.toLocaleString("da-DK")}{" "}
          {tekster.materialeTegn}
        </p>
        {filfejl && (
          <p role="alert" className="rounded-lg border border-rav bg-kort px-4 py-3 text-sm text-gran">
            {filfejl}
          </p>
        )}
      </div>

      <label className="flex items-center gap-3 text-sm font-medium text-gran">
        <input
          type="checkbox"
          name="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 accent-gran"
        />
        {tekster.materialeAktiv}
      </label>

      <Svarlinje svar={svar} />

      <button
        type="submit"
        disabled={arbejder}
        className="rounded-lg bg-gran px-5 py-2.5 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund disabled:opacity-40"
      >
        {arbejder
          ? tekster.gemmer
          : erNyt
            ? tekster.materialeTilfoej
            : tekster.materialeGem}
      </button>
    </form>
  );
}

function Sletknap({
  slug,
  id,
  tekster,
}: {
  slug: string;
  id: string;
  tekster: Tekster;
}) {
  const [svar, submit, arbejder] = useActionState<MaterialeSvar | null, FormData>(
    sletMaterialeAction,
    null,
  );

  return (
    <form
      onSubmit={(e) => {
        if (!window.confirm(tekster.materialeSletBekraeft)) {
          e.preventDefault();
          return;
        }
        send(submit)(e);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={arbejder}
        className={`${knapKlasse} text-gran-let underline`}
      >
        {tekster.materialeSlet}
      </button>
      {svar && !svar.ok && <Svarlinje svar={svar} />}
    </form>
  );
}

export function Materialeliste({
  slug,
  materialer,
  status,
  tekster,
}: {
  slug: string;
  materialer: Materiale[];
  /** Beregnet på serveren ud fra det GEMTE, aktive materiale. */
  status: string;
  tekster: Tekster;
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-kant bg-kort p-6">
      <div className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-gran">
          {tekster.materiale}
        </h2>
        <p className="text-sm leading-relaxed text-gran-let">
          {tekster.materialeHjaelp}
        </p>
        <p className="rounded-lg border border-kant bg-bund px-4 py-3 font-mono text-xs text-gran">
          {status}
        </p>
      </div>

      {materialer.length === 0 && (
        <p className="text-sm text-gran-let">{tekster.materialeIngen}</p>
      )}

      <div className="space-y-3">
        {materialer.map((m) => (
          <details
            key={m.id}
            className="rounded-lg border border-kant bg-bund px-4 py-3"
          >
            <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran">
              <span className="font-medium">{m.title}</span>
              <span className="font-mono text-xs uppercase tracking-widest text-gran-let">
                {m.kind === "vejledning"
                  ? tekster.materialeVejledning
                  : tekster.materialeEksempel}
                {" · "}
                {m.content.length.toLocaleString("da-DK")} {tekster.materialeTegn}
                {!m.active && ` · ${tekster.materialeSlaaetFra}`}
              </span>
            </summary>

            <div className="mt-4 space-y-4">
              <Materialeformular slug={slug} materiale={m} tekster={tekster} />
              <Sletknap slug={slug} id={m.id} tekster={tekster} />
            </div>
          </details>
        ))}
      </div>

      <div className="space-y-4 border-t border-kant pt-6">
        <h3 className="text-sm font-medium text-gran">{tekster.materialeNyt}</h3>
        <Materialeformular slug={slug} materiale={null} tekster={tekster} />
      </div>
    </section>
  );
}
