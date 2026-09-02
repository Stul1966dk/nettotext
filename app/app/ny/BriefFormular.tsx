"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { gemKladde, nyKladde } from "@/lib/skabeloner/kladde";
import type { Brief, InputFelt } from "@/lib/skabeloner/typer";

type Tekster = {
  paakraevet: string;
  valgfrit: string;
  knap: string;
  manglerFelter: string;
  instruktion: string;
  instruktionHjaelp: string;
  instruktionPladsholder: string;
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

    // Briefen rejser gennem browseren, ikke gennem databasen. Se kladde.ts.
    gemKladde(nyKladde(skabelon, brief, instruktion));
    router.push("/app/skriv");
  }

  return (
    <form onSubmit={haandterIndsend} className="mt-8 space-y-8" noValidate>
      {felter.map((felt) => (
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
              defaultValue={felt.standard}
              placeholder={felt.pladsholder}
              aria-describedby={felt.hjaelp ? `${felt.navn}-hjaelp` : undefined}
              className={`${feltKlasse} resize-y`}
            />
          )}

          {felt.type === "tekst" && (
            <input
              id={felt.navn}
              name={felt.navn}
              type="text"
              maxLength={felt.maxLaengde}
              defaultValue={felt.standard}
              placeholder={felt.pladsholder}
              aria-describedby={felt.hjaelp ? `${felt.navn}-hjaelp` : undefined}
              className={feltKlasse}
            />
          )}

          {felt.type === "valg" && (
            <select
              id={felt.navn}
              name={felt.navn}
              defaultValue={felt.standard ?? felt.valg?.[0]?.vaerdi}
              aria-describedby={felt.hjaelp ? `${felt.navn}-hjaelp` : undefined}
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
        </div>
      ))}

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
