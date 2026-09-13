"use client";

import { useState } from "react";

/**
 * Tommel op eller ned på den færdige tekst — det sidste punkt i trin 6.
 *
 * Svaret hører til på rækken i `usage_log`, teksten kostede. Kvitteringen er
 * id'et på den række; uden den vises widgetten slet ikke, frem for at
 * spørge om noget, vi ikke kan gemme.
 *
 * Formen er valgt efter, hvad man faktisk svarer på: ét klik, og så er man
 * færdig. Kommentarfeltet kommer FØRST bagefter og er frivilligt. Står det
 * fremme fra start, ser widgetten ud som en formular, og så svarer ingen.
 *
 * Et svar kan ændres: klikker man den anden vej, skrives det nye oven i.
 * Det er den ærlige opførsel — man kan nå at trykke forkert, og alternativet
 * ville være en knap, der låser sig selv uden at sige det.
 */

export type FeedbackTekster = {
  spoergsmaal: string;
  op: string;
  ned: string;
  tak: string;
  kommentarLabel: string;
  kommentarPladsholder: string;
  kommentarKnap: string;
  kommentarSendt: string;
  sender: string;
  /**
   * Hedder ikke bare `fejl`: editorens egne tekster har allerede et `fejl`,
   * som er en HELE listen af fejlbeskeder slået op på årsag. To felter med
   * samme navn og forskellig form kan ikke leve i den samme type.
   */
  feedbackFejl: string;
};

type Status = "klar" | "sender" | "gemt" | "fejl";

export function Feedback({
  kvittering,
  tekster,
}: {
  kvittering: string;
  tekster: FeedbackTekster;
}) {
  const [svar, setSvar] = useState<1 | -1 | null>(null);
  const [status, setStatus] = useState<Status>("klar");
  const [kommentar, setKommentar] = useState("");
  const [kommentarSendt, setKommentarSendt] = useState(false);

  async function send(nytSvar: 1 | -1, medKommentar?: string) {
    setStatus("sender");

    try {
      const respons = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kvittering,
          svar: nytSvar,
          kommentar: medKommentar,
        }),
      });

      if (!respons.ok) {
        setStatus("fejl");
        return;
      }

      setSvar(nytSvar);
      setStatus("gemt");
      if (medKommentar) setKommentarSendt(true);
    } catch {
      setStatus("fejl");
    }
  }

  const knapKlasse =
    "rounded-lg border px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gran disabled:opacity-50";

  return (
    <section className="space-y-4 rounded-2xl border border-kant bg-kort p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gran-let">
          {tekster.spoergsmaal}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void send(1)}
            disabled={status === "sender"}
            aria-pressed={svar === 1}
            className={`${knapKlasse} ${
              svar === 1
                ? "border-stempel bg-stempel text-bund"
                : "border-kant text-gran"
            }`}
          >
            {tekster.op}
          </button>

          <button
            type="button"
            onClick={() => void send(-1)}
            disabled={status === "sender"}
            aria-pressed={svar === -1}
            className={`${knapKlasse} ${
              svar === -1 ? "border-rav text-gran" : "border-kant text-gran"
            }`}
          >
            {tekster.ned}
          </button>
        </div>

        <p role="status" aria-live="polite" className="text-sm text-gran-let">
          {status === "sender" && tekster.sender}
          {status === "gemt" && !kommentarSendt && tekster.tak}
          {status === "gemt" && kommentarSendt && tekster.kommentarSendt}
          {status === "fejl" && tekster.feedbackFejl}
        </p>
      </div>

      {/* Kommentarfeltet dukker først op, når der ER svaret. Se noten
          øverst: en widget, der åbner som en formular, bliver ikke udfyldt. */}
      {svar !== null && !kommentarSendt && (
        <div className="space-y-3 border-t border-kant pt-4">
          <label
            htmlFor="feedback-kommentar"
            className="block text-sm leading-relaxed text-gran-let"
          >
            {tekster.kommentarLabel}
          </label>

          <textarea
            id="feedback-kommentar"
            rows={2}
            maxLength={1000}
            value={kommentar}
            placeholder={tekster.kommentarPladsholder}
            onChange={(e) => setKommentar(e.target.value)}
            className="w-full resize-y rounded-lg border border-kant bg-bund px-3 py-2 text-sm leading-relaxed text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran"
          />

          <button
            type="button"
            onClick={() => void send(svar, kommentar.trim())}
            disabled={status === "sender" || !kommentar.trim()}
            className={`${knapKlasse} border-gran text-gran`}
          >
            {tekster.kommentarKnap}
          </button>
        </div>
      )}
    </section>
  );
}
