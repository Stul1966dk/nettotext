"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { laesNdjson } from "@/lib/api/laesStream";
import { gemKladde, hentKladde, type Kladde } from "@/lib/skabeloner/kladde";
import { delIBlokke, type Blok } from "@/lib/tekst/blokke";
import { samlHtml, tilMarkdown, udenTitel } from "@/lib/tekst/markdown";

import { Blokkort, type BlokkortTekster } from "./Blokkort";

type Tekster = BlokkortTekster & {
  ingenBrief: string;
  nyTekst: string;
  planlaegger: string;
  skriver: string;
  faerdig: string;
  visHtml: string;
  visTekst: string;
  kopier: string;
  kopierFelt: string;
  kopierUdenTitel: string;
  kopierMarkdown: string;
  kopierForklaring: string;
  hentWord: string;
  henterWord: string;
  eksportFejl: string;
  kladdeGemmer: string;
  kladdeGemt: string;
  kladdeIkkeGemt: string;
  kopieret: string;
  kopiMarkeret: string;
  proevIgen: string;
  koster: string;
  saetNoegleOp: string;
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
 * trukket en tekst. Men er budgettet brugt, grænsen nået, eller er der slet
 * ingen nøgle at skrive med, bliver forsøget afvist, før der bruges penge.
 * Så er advarslen ikke bare overflødig, den er forkert — og en app, der
 * advarer om noget, der ikke sker, er sværere at stole på, næste gang den
 * advarer.
 */
const GRATIS_AT_PROEVE_IGEN = new Set([
  "budget_opbrugt",
  "mangler_noegle",
  "for_mange_kald",
]);

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

/**
 * Hvor længe vi venter, efter brugeren er holdt op med at skrive, før kladden
 * sendes til serveren. Kort nok til at hun ikke når at lukke fanen, langt nok
 * til at et tastetryk ikke bliver til et kald.
 */
const GEMMEPAUSE_MS = 2000;

type GemStatus = "ukendt" | "gemmer" | "gemt" | "mislykkedes";

export function Generering({
  tekster,
  startKladde,
}: {
  tekster: Tekster;
  /** En kladde hentet fra serveren, når siden er åbnet fra dashboardet. */
  startKladde: Kladde | null;
}) {
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
  const [henter, setHenter] = useState(false);
  const [eksportFejl, setEksportFejl] = useState(false);
  const [gemStatus, setGemStatus] = useState<GemStatus>("ukendt");

  // Omskrivning af ét afsnit. Kun ét ad gangen: to samtidige ville skrive
  // oven i hinandens blokke, og brugeren ville ikke kunne se hvilket svar
  // der hørte til hvad.
  const [omskriverId, setOmskriverId] = useState<string | null>(null);
  const [omskrivTekst, setOmskrivTekst] = useState("");
  const [omskrivFejl, setOmskrivFejl] = useState<{
    id: string;
    besked: string;
  } | null>(null);

  const kodeRef = useRef<HTMLPreElement>(null);

  // Kladden, som den ser ud lige nu. Ligger i en ref og ikke i state, fordi
  // den kun skal gemmes, ikke tegnes. Retter brugeren i meta-felterne efter
  // genereringen, er det den her, rettelsen lægges oven på.
  const kladdeRef = useRef<Kladde | null>(null);

  // Den ventende gemning til serveren. Hvert nyt tastetryk skubber den.
  const gemTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Sender kladden til serveren, når brugeren har holdt pause.
   *
   * Serveren får kun FÆRDIGE kladder. Mens teksten streames, kaldes gem() for
   * hver bid, og det ville blive til hundredvis af kald om noget, der endnu
   * ikke er værd at gemme. localStorage tager sig af den del.
   */
  const planlaegServerGemning = useCallback(() => {
    if (gemTimer.current) clearTimeout(gemTimer.current);

    gemTimer.current = setTimeout(async () => {
      const kladde = kladdeRef.current;
      if (!kladde) return;

      setGemStatus("gemmer");

      try {
        const svar = await fetch("/api/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: kladde.id,
            skabelon: kladde.skabelon,
            indhold: {
              brief: kladde.brief,
              instruktion: kladde.instruktion,
              html: kladde.html,
              blokke: kladde.blokke,
              titel: kladde.titel,
              beskrivelse: kladde.beskrivelse,
              faerdig: kladde.faerdig,
            },
          }),
        });

        setGemStatus(svar.ok ? "gemt" : "mislykkedes");
      } catch {
        // Kladden ligger stadig i browseren, så der er ikke noget tabt.
        setGemStatus("mislykkedes");
      }
    }, GEMMEPAUSE_MS);
  }, []);

  const gem = useCallback(
    (aendring: Partial<Kladde>) => {
      if (!kladdeRef.current) return;

      kladdeRef.current = { ...kladdeRef.current, ...aendring };
      gemKladde(kladdeRef.current);

      if (kladdeRef.current.faerdig) planlaegServerGemning();
    },
    [planlaegServerGemning],
  );

  // En ventende gemning skal ikke fyre af, efter siden er forladt.
  useEffect(() => {
    return () => {
      if (gemTimer.current) clearTimeout(gemTimer.current);
    };
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
      setOmskrivFejl(null);
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
            instruktion: kladde.instruktion,
          }),
        });

        // Fejl, serveren nåede at opdage, før den begyndte at skrive.
        if (!svar.ok || !svar.body) {
          const krop = await svar.json().catch(() => null);
          visFejl(krop?.aarsag ?? "ukendt");
          return;
        }

        await laesNdjson(svar.body, (hendelse) => {
          // Meta-felterne kommer et par sekunder inde i genereringen, længe
          // før teksten er færdig. De vises med det samme.
          if (hendelse.slags === "meta") {
            const nyTitel = hendelse.titel as string;
            const nyBeskrivelse = hendelse.beskrivelse as string;

            setTitel(nyTitel);
            setBeskrivelse(nyBeskrivelse);
            setHarMeta(true);
            gem({ titel: nyTitel, beskrivelse: nyBeskrivelse });
          }

          if (hendelse.slags === "tekst") {
            samlet += hendelse.tekst as string;
            setTekst(samlet);
            setStatus("skriver");
            gem({ tekst: samlet, html: "", blokke: [], faerdig: false });
          }

          if (hendelse.slags === "faerdig") {
            const nyHtml = hendelse.html as string;
            const nyeBlokke = hendelse.blokke as Blok[];

            setHtml(nyHtml);
            setBlokke(nyeBlokke);
            setStatus("faerdig");
            gem({
              tekst: samlet,
              html: nyHtml,
              blokke: nyeBlokke,
              faerdig: true,
            });
          }

          if (hendelse.slags === "fejl") {
            visFejl(hendelse.aarsag as string);
          }
        });
      } catch {
        // Forbindelsen røg. Har vi tekst, beholder vi den. Den er betalt for.
        visFejl("netvaerk");
      }
    },
    [gem, tekster],
  );

  /**
   * Skriver ét afsnit om.
   *
   * Alle blokkene sendes med, så modellen kan se sammenhængen og skrive
   * noget, der passer ind. Svaret er kun det ene afsnit.
   *
   * Bemærk hvad der sker, når afsnittet er kommet hjem: hele teksten samles
   * og deles op PÅ NY. Så bliver numrene rigtige igen, hvis modellen svarede
   * med to sektioner i stedet for én — frem for at en blok stille og roligt
   * kom til at indeholde noget andet, end dens navn siger.
   */
  const skrivOm = useCallback(
    async (blokId: string, instruktion: string) => {
      const kladde = kladdeRef.current;
      if (!kladde) return;

      const visFejl = (aarsag: string) => {
        setOmskrivFejl({
          id: blokId,
          besked: tekster.fejl[aarsag] ?? tekster.fejl.ukendt,
        });
        setOmskriverId(null);
      };

      setOmskriverId(blokId);
      setOmskrivTekst("");
      setOmskrivFejl(null);

      let samlet = "";

      try {
        const svar = await fetch("/api/regenerate-section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skabelon: kladde.skabelon,
            brief: kladde.brief,
            blokke: kladde.blokke,
            blokId,
            instruktion,
          }),
        });

        if (!svar.ok || !svar.body) {
          const krop = await svar.json().catch(() => null);
          visFejl(krop?.aarsag ?? "ukendt");
          return;
        }

        await laesNdjson(svar.body, (hendelse) => {
          if (hendelse.slags === "tekst") {
            samlet += hendelse.tekst as string;
            setOmskrivTekst(samlet);
          }

          if (hendelse.slags === "faerdig") {
            const opdaterede = (kladdeRef.current?.blokke ?? []).map((blok) =>
              blok.id === blokId
                ? { ...blok, html: hendelse.html as string }
                : blok,
            );

            const nyHtml = samlHtml(opdaterede);
            const nyeBlokke = delIBlokke(nyHtml);

            setHtml(nyHtml);
            setBlokke(nyeBlokke);
            gem({ html: nyHtml, blokke: nyeBlokke });
            setOmskriverId(null);
          }

          if (hendelse.slags === "fejl") {
            visFejl(hendelse.aarsag as string);
          }
        });
      } catch {
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
    // Kom vi hertil fra dashboardet, er kladden allerede hentet på serveren.
    // Den lægges i browseren med det samme, så de to kopier følges ad.
    if (startKladde) {
      gemKladde(startKladde);
    }

    const kladde = startKladde ?? hentKladde();

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
  }, [generer, startKladde]);

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

  /**
   * Henter teksten som Word-fil.
   *
   * Serveren sender filen tilbage i svaret; browseren får den ikke af sig
   * selv. Derfor det lille kunstgreb med et usynligt link: filen laves om til
   * en midlertidig adresse i browserens egen hukommelse, linket klikkes, og
   * adressen gives fri igen med det samme. Uden det sidste ville filen blive
   * liggende i hukommelsen, til fanen bliver lukket.
   */
  async function hentWord() {
    setHenter(true);
    setEksportFejl(false);

    try {
      const svar = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blokke, titel, beskrivelse }),
      });

      if (!svar.ok) {
        setEksportFejl(true);
        return;
      }

      const navn =
        svar.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "tekst.docx";

      const adresse = URL.createObjectURL(await svar.blob());

      const link = document.createElement("a");
      link.href = adresse;
      link.download = navn;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(adresse);
    } catch {
      setEksportFejl(true);
    } finally {
      setHenter(false);
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

  // Ikke alle teksttyper skriver en titel. Produktteksten gør det med vilje
  // ikke, fordi webshoppen selv sætter varens navn som sidens overskrift.
  // Uden en titel ville "Kopiér uden titel" gøre nøjagtig det samme som
  // "Kopiér HTML", og forklaringen under knapperne ville love noget, der
  // ikke passer. Så vises de ikke.
  const harTitel = blokke.some((blok) => blok.slags === "titel");

  const knapKlasser =
    "rounded-lg border border-kant px-4 py-2 text-sm text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran";

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

      {status === "faerdig" && gemStatus !== "ukendt" && (
        <p
          role="status"
          aria-live="polite"
          className={`text-xs leading-relaxed ${gemStatus === "mislykkedes" ? "text-rav" : "text-gran-let"}`}
        >
          {gemStatus === "gemmer" && tekster.kladdeGemmer}
          {gemStatus === "gemt" && tekster.kladdeGemt}
          {gemStatus === "mislykkedes" && tekster.kladdeIkkeGemt}
        </p>
      )}

      {fejl && (
        <div className="space-y-4 rounded-lg border border-rav bg-kort px-4 py-4">
          <p role="alert" className="text-sm leading-relaxed text-gran">
            {fejl.besked}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* Uden nøgle hjælper det ikke at prøve igen — så skal brugeren
                et andet sted hen. Guiden står før knappen, fordi den er dét,
                der faktisk bringer hende videre. */}
            {fejl.aarsag === "mangler_noegle" && (
              <Link href="/app/opsaetning" className={knapKlasser}>
                {tekster.saetNoegleOp}
              </Link>
            )}
            <button type="button" onClick={proevIgen} className={knapKlasser}>
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
                <Blokkort
                  key={blok.id}
                  blok={blok}
                  label={blokLabel(blok)}
                  tekster={tekster}
                  omskrives={omskriverId === blok.id}
                  streametTekst={omskriverId === blok.id ? omskrivTekst : ""}
                  fejl={omskrivFejl?.id === blok.id ? omskrivFejl.besked : null}
                  laast={omskriverId !== null}
                  skrivOm={(instruktion) => void skrivOm(blok.id, instruktion)}
                />
              ))}
            </div>
          ) : (
            // En kladde fra før blokkene fandtes. Vises som ét stykke.
            <article
              className="tekst rounded-2xl border border-kant bg-kort p-8"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => kopier("html", html)}
                className="rounded-lg bg-gran px-4 py-2 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
              >
                {kopieret === "html" ? tekster.kopieret : tekster.kopier}
              </button>

              {harTitel && (
                <button
                  type="button"
                  onClick={() =>
                    kopier("uden-titel", samlHtml(udenTitel(blokke)))
                  }
                  className={knapKlasser}
                >
                  {kopieret === "uden-titel"
                    ? tekster.kopieret
                    : tekster.kopierUdenTitel}
                </button>
              )}

              <button
                type="button"
                onClick={() => kopier("markdown", tilMarkdown(html))}
                className={knapKlasser}
              >
                {kopieret === "markdown"
                  ? tekster.kopieret
                  : tekster.kopierMarkdown}
              </button>

              <button
                type="button"
                onClick={hentWord}
                disabled={henter}
                className={`${knapKlasser} disabled:opacity-40`}
              >
                {henter ? tekster.henterWord : tekster.hentWord}
              </button>

              <button
                type="button"
                onClick={() => setVisKoder((v) => !v)}
                className={knapKlasser}
              >
                {visKoder ? tekster.visTekst : tekster.visHtml}
              </button>

              <Link href="/app/ny" className="text-sm text-gran underline">
                {tekster.nyTekst}
              </Link>
            </div>

            {harTitel && (
              <p className="text-xs leading-relaxed text-gran-let">
                {tekster.kopierForklaring}
              </p>
            )}

            {eksportFejl && (
              <p
                role="alert"
                className="rounded-lg border border-rav bg-kort px-4 py-3 text-sm leading-relaxed text-gran"
              >
                {tekster.eksportFejl}
              </p>
            )}
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
