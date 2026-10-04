"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { laesNdjson } from "@/lib/api/laesStream";
import { gemKladde, hentKladde, type Kladde } from "@/lib/skabeloner/kladde";
import { delIBlokke, type Blok } from "@/lib/tekst/blokke";
import { erFaqBlok } from "@/lib/tekst/faq";
import { tjekTal } from "@/lib/tekst/faktatjek";
import { fremskridtProcent, maalTegn } from "@/lib/tekst/fremskridt";
import { broedtekstOrd } from "@/lib/tekst/laengde";
import {
  delVedProduktoversigt,
  samlHtml,
  tilMarkdown,
  udenTitel,
} from "@/lib/tekst/markdown";

import { Blokkort, type BlokkortTekster } from "./Blokkort";
import { Faktatjek, type FaktatjekTekster } from "./Faktatjek";
import { Faq, type FaqTekster } from "./Faq";
import { Feedback, type FeedbackTekster } from "./Feedback";
import { Laengde, type LaengdeTekster } from "./Laengde";

type Tekster = BlokkortTekster &
  FaktatjekTekster &
  FaqTekster &
  LaengdeTekster &
  FeedbackTekster & {
  ingenBrief: string;
  nyTekst: string;
  skrivEnTil: string;
  planlaegger: string;
  skriver: string;
  skriverProcent: string;
  fremskridtForklaring: string;
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
  gennemskriver: string;
  gennemskrivFejl: string;
  gennemskrivKnap: string;
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
  blokHero: string;
  produktoversigtMarkering: string;
  kopierHero: string;
  kopierBeskrivelse: string;
  produktoversigtForklaring: string;
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

/**
 * Alt brugeren selv har skrevet, samlet ét sted.
 *
 * Faktatjekket holder tekstens tal op mod netop dét. Brand-profilen og de
 * gemte instruktioner er med, fordi de også er brugerens egne oplysninger —
 * står der "vi har kørt siden 1998" i profilen, er 1998 ikke et tal, modellen
 * har fundet på.
 *
 * Sprogprøven er IKKE med. Den er et eksempel på tonefald, ikke en kilde til
 * oplysninger, og modellen har udtrykkelig besked på ikke at bruge dens
 * indhold. Tællede vi dens tal med som kendte, ville et opdigtet tal kunne
 * slippe igennem, fordi det tilfældigvis også stod i en gammel tekst.
 */
function samlGrundlag(kladde: Kladde, personligt: string): string {
  return [...Object.values(kladde.brief), kladde.instruktion, personligt].join(
    "\n",
  );
}

export function Generering({
  tekster,
  startKladde,
  personligtGrundlag,
  medProduktoversigt,
  medAlmenViden,
  laengdemaal,
}: {
  tekster: Tekster;
  /** En kladde hentet fra serveren, når siden er åbnet fra dashboardet. */
  startKladde: Kladde | null;
  /**
   * Brand-profilen og de gemte instruktioner som ren tekst. Hentes på
   * serveren, hvor de i forvejen ligger, og bruges kun til faktatjekket.
   */
  personligtGrundlag: string;
  /** Teksttyper, der deles af en produktoversigt. Se migration 0027. */
  medProduktoversigt: string[];
  /** Teksttyper, der må bruge almen viden om emnet. Se migration 0029. */
  medAlmenViden: string[];
  /**
   * Mindste ordantal pr. teksttype og valgt længde. Kun teksttyper, koden
   * selv må udvide, står her. Se hentLaengdemaal().
   */
  laengdemaal: Record<string, Record<string, number>>;
}) {
  const [status, setStatus] = useState<Status>("starter");
  const [tekst, setTekst] = useState("");
  /** Hvor mange tegn teksten forventes at fylde. Null: så ingen procent. */
  const [maal, setMaal] = useState<number | null>(null);
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
  /** Det, tekstens tal holdes op mod. Se samlGrundlag ovenfor. */
  const [grundlag, setGrundlag] = useState("");
  /**
   * Teksttypen, kladden hører til. Ligger i state og ikke kun i kladdeRef,
   * fordi "Skriv en til" skal bruge den til sin adresse — og en ref må ikke
   * læses, mens siden tegnes.
   */
  const [skabelon, setSkabelon] = useState<string | null>(null);
  /**
   * Rækken i `usage_log`, teksten kostede. Kommer fra genereringen som en
   * kvittering, eller fra en kladde, der er åbnet igen. Uden den vises
   * feedback-widgetten ikke.
   */
  const [kvittering, setKvittering] = useState<string | null>(null);

  // Omskrivning af ét afsnit. Kun ét ad gangen: to samtidige ville skrive
  // oven i hinandens blokke, og brugeren ville ikke kunne se hvilket svar
  // der hørte til hvad.
  const [omskriverId, setOmskriverId] = useState<string | null>(null);
  const [omskrivTekst, setOmskrivTekst] = useState("");
  const [omskrivFejl, setOmskrivFejl] = useState<{
    id: string;
    besked: string;
  } | null>(null);

  // Længden. Målet er det, brugeren valgte i briefen; null, når teksttypen
  // ikke har et. Udvidelsen kører af sig selv lige efter genereringen og
  // højst to gange — se udvid() længere nede.
  const [mindsteOrd, setMindsteOrd] = useState<number | null>(null);
  const [udvider, setUdvider] = useState(false);
  const [udvidFejl, setUdvidFejl] = useState<string | null>(null);

  // Gennemskrivningen retter sproget i den færdige tekst. Kører af sig selv
  // lige efter genereringen og før udvidelsen — se gennemskriv() længere nede.
  const [gennemskriver, setGennemskriver] = useState(false);
  const [gennemskrivFejl, setGennemskrivFejl] = useState(false);

  // Afsnittet med ofte stillede spørgsmål. Skrives i sit eget kald, når
  // brugeren beder om det. Se Faq.tsx.
  const [faqHenter, setFaqHenter] = useState(false);
  const [faqFejl, setFaqFejl] = useState<string | null>(null);

  /** Hvilket afsnit venter på at få sin håndrettelse saneret på serveren? */
  const [gemmerBlok, setGemmerBlok] = useState<string | null>(null);

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
              stiltone: kladde.stiltone,
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

  // Udvidelsen og gennemskrivningen bliver sat i gang inde fra genereringen,
  // men er defineret længere nede, fordi de bruger laegBlokkePaaPlads.
  // Ref'en er broen.
  const efterGenereringRef = useRef<(() => void) | null>(null);

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
      // Bjælken bygger på brugerens eget valg af længde. Har teksttypen ikke
      // et laengde-felt, bliver det null, og bjælken viser ingen procent.
      setMaal(maalTegn(kladde.brief.laengde));
      setHtml("");
      setBlokke([]);
      setTitel("");
      setBeskrivelse("");
      setHarMeta(false);
      setKvittering(null);
      setFejl(null);
      setOmskrivFejl(null);
      setKopieret(null);
      setMarkeret(false);

      kladdeRef.current = kladde;
      setSkabelon(kladde.skabelon);
      setMindsteOrd(
        laengdemaal[kladde.skabelon]?.[kladde.brief.laengde ?? ""] ?? null,
      );
      setUdvidFejl(null);
      setGennemskrivFejl(false);
      setGrundlag(samlGrundlag(kladde, personligtGrundlag));

      let samlet = "";

      try {
        const svar = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skabelon: kladde.skabelon,
            brief: kladde.brief,
            instruktion: kladde.instruktion,
            stiltone: kladde.stiltone,
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

          if (hendelse.slags === "kvittering") {
            // Kommer EFTER teksten, fordi forbruget skrives til allersidst
            // på serveren. Den lægges i kladden med det samme, så teksten
            // også kan bedømmes efter et genindlæs.
            const id = hendelse.id as string;
            setKvittering(id);
            gem({ kvittering: id });
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

            // Blev teksten kortere end valgt, lægges der afsnit til med det
            // samme, og derefter rettes sproget. Kun her, lige efter en ny
            // tekst: en kladde, der åbnes igen, bliver ikke ændret af sig
            // selv.
            efterGenereringRef.current?.();
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
    [gem, laengdemaal, personligtGrundlag, tekster],
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
            stiltone: kladde.stiltone,
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
      setSkabelon(kladde.skabelon);
      setMindsteOrd(
        laengdemaal[kladde.skabelon]?.[kladde.brief.laengde ?? ""] ?? null,
      );
      setGrundlag(samlGrundlag(kladde, personligtGrundlag));
      setTekst(kladde.tekst);
      setHtml(kladde.html);
      setBlokke(kladde.blokke);
      setTitel(kladde.titel);
      setBeskrivelse(kladde.beskrivelse);
      setHarMeta(Boolean(kladde.titel || kladde.beskrivelse));
      setKvittering(kladde.kvittering ?? null);
      setStatus("faerdig");
      return;
    }

    await generer(kladde);
  }, [generer, laengdemaal, personligtGrundlag, startKladde]);

  useEffect(() => {
    if (igangsat.current) return;
    igangsat.current = true;

    void start();
  }, [start]);

  /**
   * Lægger en ny række blokke på plads — efter en rettelse eller en sletning.
   *
   * Teksten samles og deles op PÅ NY, ligesom efter en omskrivning. Så bliver
   * numrene rigtige igen, når et afsnit er forsvundet, og en blok kommer
   * aldrig til at indeholde noget andet, end dens navn siger.
   */
  const laegBlokkePaaPlads = useCallback(
    (opdaterede: Blok[]) => {
      const nyHtml = samlHtml(opdaterede);
      const nyeBlokke = delIBlokke(nyHtml);

      setHtml(nyHtml);
      setBlokke(nyeBlokke);
      gem({ html: nyHtml, blokke: nyeBlokke });
    },
    [gem],
  );

  /**
   * Lægger flere afsnit til, når brødteksten er kortere end valgt.
   *
   * Serveren tæller selv og bestemmer selv antallet; herfra sendes kun
   * teksten. De nye afsnit sættes ind FØR det sidste afsnit, som typisk er
   * artiklens afslutning — står de efter, slutter teksten to gange.
   *
   * Højst to runder. Rammer to kald ikke målet, er svaret ikke et tredje:
   * så viser kortet tallet, og brugeren kan selv trykke.
   */
  const udvid = useCallback(async () => {
    const kladde = kladdeRef.current;
    if (!kladde) return;

    const mindst = laengdemaal[kladde.skabelon]?.[kladde.brief.laengde ?? ""];
    if (!mindst || broedtekstOrd(kladde.blokke) >= mindst) return;

    setUdvider(true);
    setUdvidFejl(null);

    const visFejl = (aarsag: string) =>
      setUdvidFejl(tekster.fejl[aarsag] ?? tekster.fejl.ukendt);

    try {
      for (let runde = 1; runde <= 2; runde++) {
        const nu = kladdeRef.current?.blokke ?? [];
        if (broedtekstOrd(nu) >= mindst) break;

        const svar = await fetch("/api/udvid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skabelon: kladde.skabelon,
            brief: kladde.brief,
            blokke: nu,
            stiltone: kladde.stiltone,
          }),
        });

        const data = await svar.json().catch(() => null);

        if (!svar.ok || typeof data?.html !== "string") {
          visFejl(typeof data?.aarsag === "string" ? data.aarsag : "ukendt");
          break;
        }

        // Serveren mente ikke, der manglede noget. Så er der ikke mere at
        // hente ved at spørge igen.
        if (!data.html) break;

        // Blokkene læses igen HER: brugeren kan ikke rette imens, men
        // rækkefølgen skal bygge på det, der står i kladden nu.
        const efter = kladdeRef.current?.blokke ?? [];
        const artikel = efter.filter((blok) => !erFaqBlok(blok));
        const spoergsmaal = efter.filter(erFaqBlok);

        const sektioner = artikel.filter((b) => b.slags === "sektion");
        const sidste = sektioner.at(-1);
        // Har artiklen kun ét afsnit, er det ikke en afslutning, og de nye
        // lægges efter det.
        const foer =
          sektioner.length >= 2 && sidste
            ? artikel.findIndex((b) => b.id === sidste.id)
            : artikel.length;

        const nye: Blok = {
          id: "blok-udvid",
          slags: "sektion",
          overskrift: null,
          nummer: null,
          html: data.html as string,
        };

        laegBlokkePaaPlads([
          ...artikel.slice(0, foer),
          nye,
          ...artikel.slice(foer),
          ...spoergsmaal,
        ]);
      }
    } catch {
      visFejl("netvaerk");
    } finally {
      setUdvider(false);
    }
  }, [laegBlokkePaaPlads, laengdemaal, tekster]);

  /**
   * Retter sproget i den færdige tekst efter reglerne om almindeligt dansk.
   *
   * Serveren afviser selv et svar, der har ændret på opbygningen, længden
   * eller tallene. Så bliver teksten stående, som den er, og brugeren får
   * en knap til at prøve igen.
   *
   * Spørgsmålene skrives ikke igennem og lægges tilbage efter artiklen.
   * Meta-felterne skiftes kun ud, hvis brugeren ikke har rettet i dem,
   * mens kaldet var undervejs.
   */
  const gennemskriv = useCallback(async () => {
    const kladde = kladdeRef.current;
    if (!kladde || kladde.blokke.length === 0) return;

    setGennemskriver(true);
    setGennemskrivFejl(false);

    const sendtTitel = kladde.titel;
    const sendtBeskrivelse = kladde.beskrivelse;

    try {
      const svar = await fetch("/api/gennemskriv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skabelon: kladde.skabelon,
          brief: kladde.brief,
          blokke: kladde.blokke,
          titel: sendtTitel,
          beskrivelse: sendtBeskrivelse,
          stiltone: kladde.stiltone,
        }),
      });

      const data = await svar.json().catch(() => null);

      if (!svar.ok || typeof data?.html !== "string" || !data.html) {
        setGennemskrivFejl(true);
        return;
      }

      const spoergsmaal = (kladdeRef.current?.blokke ?? []).filter(erFaqBlok);
      laegBlokkePaaPlads([...delIBlokke(data.html), ...spoergsmaal]);

      if (
        typeof data.titel === "string" &&
        data.titel &&
        kladdeRef.current?.titel === sendtTitel
      ) {
        setTitel(data.titel);
        gem({ titel: data.titel });
      }

      if (
        typeof data.beskrivelse === "string" &&
        data.beskrivelse &&
        kladdeRef.current?.beskrivelse === sendtBeskrivelse
      ) {
        setBeskrivelse(data.beskrivelse);
        gem({ beskrivelse: data.beskrivelse });
      }
    } catch {
      setGennemskrivFejl(true);
    } finally {
      setGennemskriver(false);
    }
  }, [gem, laegBlokkePaaPlads]);

  // Rækkefølgen er med vilje: først sproget, så længden. Gennemskrivningen
  // sletter pynt og gør teksten lidt kortere (733 ord blev til 706 i testen
  // 04.10.2026), så længden skal måles bagefter. De afsnit, udvidelsen
  // lægger til, bliver ikke skrevet igennem, men er skrevet efter de samme
  // sprogregler.
  useEffect(() => {
    efterGenereringRef.current = () =>
      void (async () => {
        await gennemskriv();
        await udvid();
      })();
  }, [udvid, gennemskriv]);

  /**
   * Lægger "Ofte stillede spørgsmål" til sidst i teksten.
   *
   * Har teksten allerede afsnittet, bliver det skiftet ud og ikke lagt til en
   * gang til. Serveren får hele teksten med, så svarene kan holde sig fra
   * det, artiklen allerede siger.
   */
  const tilfoejFaq = useCallback(
    async (spoergsmaal: string) => {
      const kladde = kladdeRef.current;
      if (!kladde) return;

      setFaqHenter(true);
      setFaqFejl(null);

      const visFejl = (aarsag: string) =>
        setFaqFejl(tekster.fejl[aarsag] ?? tekster.fejl.ukendt);

      try {
        const svar = await fetch("/api/faq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skabelon: kladde.skabelon,
            brief: kladde.brief,
            blokke: kladde.blokke,
            spoergsmaal,
            stiltone: kladde.stiltone,
          }),
        });

        const data = await svar.json().catch(() => null);

        if (!svar.ok || typeof data?.html !== "string") {
          visFejl(typeof data?.aarsag === "string" ? data.aarsag : "ukendt");
          return;
        }

        // Blokkene læses HER og ikke før kaldet: brugeren kan have rettet i
        // et andet afsnit, mens spørgsmålene blev skrevet.
        const uden = (kladdeRef.current?.blokke ?? []).filter(
          (blok) => !erFaqBlok(blok),
        );

        laegBlokkePaaPlads([
          ...uden,
          {
            id: "blok-faq",
            slags: "sektion",
            overskrift: null,
            nummer: null,
            html: data.html as string,
          },
        ]);
      } catch {
        visFejl("netvaerk");
      } finally {
        setFaqHenter(false);
      }
    },
    [laegBlokkePaaPlads, tekster],
  );

  /**
   * Brugerens egen rettelse af ét afsnit.
   *
   * Koster ingen penge og kalder ingen AI — men den går alligevel gennem
   * serveren, fordi HTML'en skal saneres, før den vises og gemmes. Brugeren
   * har rettet i et contentEditable-felt, og dér kan der indsættes hvad som
   * helst fra udklipsholderen. Se app/api/blok/route.ts.
   */
  const retBlok = useCallback(
    async (blokId: string, raaHtml: string) => {
      const nuvaerende = kladdeRef.current?.blokke ?? [];
      const foer = nuvaerende.find((b) => b.id === blokId);

      // Blev der ikke rettet noget, er der ingen grund til en tur til
      // serveren. Det sker hver gang nogen åbner rettefeltet og fortryder.
      if (!foer || foer.html === raaHtml) return;

      setOmskrivFejl(null);
      setGemmerBlok(blokId);

      const visFejl = (aarsag: string) =>
        setOmskrivFejl({
          id: blokId,
          besked: tekster.fejl[aarsag] ?? tekster.fejl.ukendt,
        });

      try {
        const svar = await fetch("/api/blok", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: raaHtml }),
        });

        const data = await svar.json().catch(() => null);

        if (!svar.ok || typeof data?.html !== "string") {
          visFejl(typeof data?.aarsag === "string" ? data.aarsag : "ukendt");
          return;
        }

        laegBlokkePaaPlads(
          nuvaerende.map((blok) =>
            blok.id === blokId ? { ...blok, html: data.html as string } : blok,
          ),
        );
      } catch {
        visFejl("netvaerk");
      } finally {
        setGemmerBlok(null);
      }
    },
    [laegBlokkePaaPlads, tekster],
  );

  /**
   * Sletter ét afsnit. Ingen server, ingen penge — blokkene er allerede
   * saneret, og der fjernes kun noget.
   */
  const sletBlok = useCallback(
    (blokId: string) => {
      const tilbage = (kladdeRef.current?.blokke ?? []).filter(
        (blok) => blok.id !== blokId,
      );

      // Kortet viser ikke sletteknappen på det sidste afsnit, men tjekket
      // står også her: en tom tekst ville få siden til at se ud, som om
      // genereringen var gået i gang forfra.
      if (tilbage.length === 0) return;

      setOmskrivFejl(null);
      laegBlokkePaaPlads(tilbage);
    },
    [laegBlokkePaaPlads],
  );

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
      if (!navigator.clipboard)
        throw new Error("Ingen adgang til udklipsholder");

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
        body: JSON.stringify({
          blokke,
          titel,
          beskrivelse,
          produktoversigt: harProduktoversigt,
        }),
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

  /**
   * Faktatjekket. Regnes her og ikke i en effekt: det er en udregning på det,
   * der allerede står på skærmen, og den skal køre igen, hver gang teksten
   * eller meta-felterne ændrer sig — også efter at ét afsnit er skrevet om.
   *
   * Meta-titlen og meta-beskrivelsen er med. De ender på kundens side
   * ligesom teksten, og et opfundet tal i en meta-beskrivelse er lige så
   * galt som et opfundet tal i brødteksten.
   */
  const fund = useMemo(
    () =>
      status === "faerdig" && html
        ? tjekTal([html, titel, beskrivelse].join(" "), grundlag)
        : [],
    [beskrivelse, grundlag, html, status, titel],
  );

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
    if (blok.slags === "indledning") {
      return harProduktoversigt ? tekster.blokHero : tekster.blokIndledning;
    }

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

  // En kategoriside har butikkens produktoversigt mellem hero-teksten og
  // beskrivelsen. Så vises skellet, og de to dele kopieres hver for sig i
  // stedet for som ét stykke. Se delVedProduktoversigt().
  const harProduktoversigt =
    skabelon !== null && medProduktoversigt.includes(skabelon);
  const dele = delVedProduktoversigt(blokke);
  const foersteSektion = dele.beskrivelse[0]?.id ?? null;

  // Skønnet over, hvor langt vi er. Null betyder "vi ved det ikke" — så
  // viser bjælken bevægelse uden at påstå et tal. Se lib/tekst/fremskridt.ts.
  const procent = fremskridtProcent(tekst.length, maal);

  // Før det første ord er der intet at måle på. En smal bjælke, der venter,
  // er ærligere end en tom — der ER sat noget i gang.
  //
  // Bjælken går aldrig tilbage: de første tegn giver typisk 1 %, og en
  // bjælke, der skrumper, når teksten begynder, ser ud som om noget gik galt.
  const bredde = Math.max(4, status === "starter" ? 4 : (procent ?? 60));

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
        {status === "skriver" &&
          (procent === null
            ? tekster.skriver
            : tekster.skriverProcent.replace("{procent}", String(procent)))}
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

      {erFaerdig && blokke.length > 0 && (
        <Laengde
          ord={broedtekstOrd(blokke)}
          mindst={mindsteOrd}
          udvider={udvider}
          laast={
            omskriverId !== null ||
            gemmerBlok !== null ||
            faqHenter ||
            gennemskriver
          }
          fejl={udvidFejl}
          tekster={tekster}
          udvid={() => void udvid()}
        />
      )}

      {erFaerdig && gennemskriver && (
        <p
          role="status"
          className="rounded-lg border border-kant bg-kort px-4 py-3 text-sm leading-relaxed text-gran"
        >
          {tekster.gennemskriver}
        </p>
      )}

      {erFaerdig && gennemskrivFejl && !gennemskriver && (
        <div className="space-y-3 rounded-lg border border-rav bg-kort px-4 py-4">
          <p role="alert" className="text-sm leading-relaxed text-gran">
            {tekster.gennemskrivFejl}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => void gennemskriv()}
              disabled={
                omskriverId !== null ||
                gemmerBlok !== null ||
                faqHenter ||
                udvider
              }
              className="rounded-lg border border-gran px-4 py-2 text-sm font-medium text-gran outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-kort disabled:opacity-60"
            >
              {tekster.gennemskrivKnap}
            </button>

            <p className="text-sm text-gran-let">{tekster.udvidGratis}</p>
          </div>
        </div>
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
        Mens teksten bliver skrevet, vises den IKKE. Beslutningen er ejerens
        (07.09.2026): en halvskreven tekst, der ruller forbi, er ikke til at
        læse og ikke til at vurdere. I stedet en bjælke, der siger, hvor langt
        vi er.

        Teksten samles stadig undervejs og gemmes i kladden. Det er kun
        visningen, der venter, til teksten er hel og saneret på serveren.
      */}
      {!erFaerdig && !fejl && (
        <div className="space-y-3 rounded-2xl border border-kant bg-kort p-6">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            /* Før det første ord er der ingen procent at melde — og
               "0 %" ville være en påstand om, at der ikke sker noget.
               Skærmlæseren får den samme besked som skærmen. */
            aria-valuenow={
              status === "starter" ? undefined : (procent ?? undefined)
            }
            aria-valuetext={
              status === "starter"
                ? tekster.planlaegger
                : procent === null
                  ? tekster.skriver
                  : tekster.skriverProcent.replace("{procent}", String(procent))
            }
            className="h-2 w-full overflow-hidden rounded-full bg-bund"
          >
            <div
              className={`h-full rounded-full bg-rav transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                status === "starter"
                  ? "animate-pulse motion-reduce:animate-none"
                  : ""
              }`}
              style={{ width: `${bredde}%` }}
            />
          </div>

          <p className="text-sm leading-relaxed text-gran-let">
            {tekster.fremskridtForklaring}
          </p>
        </div>
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
                <Fragment key={blok.id}>
                {harProduktoversigt && blok.id === foersteSektion && (
                  <p className="rounded-lg border border-dashed border-kant px-4 py-6 text-center font-mono text-xs uppercase tracking-widest text-gran-let">
                    {tekster.produktoversigtMarkering}
                  </p>
                )}
                <Blokkort
                  blok={blok}
                  label={blokLabel(blok)}
                  tekster={tekster}
                  omskrives={omskriverId === blok.id}
                  streametTekst={omskriverId === blok.id ? omskrivTekst : ""}
                  fejl={omskrivFejl?.id === blok.id ? omskrivFejl.besked : null}
                  laast={
                    omskriverId !== null ||
                    gemmerBlok !== null ||
                    faqHenter ||
                    udvider ||
                    gennemskriver
                  }
                  kanSlettes={blokke.length > 1}
                  gemmer={gemmerBlok === blok.id}
                  skrivOm={(instruktion) => void skrivOm(blok.id, instruktion)}
                  ret={(html) => void retBlok(blok.id, html)}
                  slet={() => sletBlok(blok.id)}
                />
                </Fragment>
              ))}
            </div>
          ) : (
            // En kladde fra før blokkene fandtes. Vises som ét stykke.
            <article
              className="tekst rounded-2xl border border-kant bg-kort p-8"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          {/* Kun på teksttyper, der må bruge almen viden: spørgsmål, artiklen
              ikke allerede svarer på, kan ikke skrives ud fra briefen alene.
              Står FØR faktatjekket, så afsnittets tal bliver tjekket med. */}
          {blokke.length > 0 &&
            skabelon !== null &&
            medAlmenViden.includes(skabelon) && (
              <Faq
                findes={blokke.some(erFaqBlok)}
                henter={faqHenter}
                laast={
                  omskriverId !== null ||
                  gemmerBlok !== null ||
                  udvider ||
                  gennemskriver
                }
                fejl={faqFejl}
                tekster={tekster}
                tilfoej={(spoergsmaal) => void tilfoejFaq(spoergsmaal)}
              />
            )}

          {/* Tjekket står MELLEM teksten og kopiknapperne, og det er med
              vilje: det er det sidste, brugeren møder, inden hun tager
              teksten med sig. Står det nederst, er den allerede kopieret. */}
          <Faktatjek
            fund={fund}
            almenViden={skabelon !== null && medAlmenViden.includes(skabelon)}
            tekster={tekster}
          />

          {/* Widgetten står EFTER faktatjekket: først ser man teksten efter,
              så bedømmer man den. Uden kvittering findes den ikke — se
              noten i Feedback.tsx. */}
          {kvittering && (
            <Feedback kvittering={kvittering} tekster={tekster} />
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {harProduktoversigt ? (
                <>
                  <button
                    type="button"
                    onClick={() => kopier("hero", samlHtml(dele.hero))}
                    className="rounded-lg bg-gran px-4 py-2 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
                  >
                    {kopieret === "hero" ? tekster.kopieret : tekster.kopierHero}
                  </button>

                  {dele.beskrivelse.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        kopier("beskrivelse", samlHtml(dele.beskrivelse))
                      }
                      className="rounded-lg bg-gran px-4 py-2 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
                    >
                      {kopieret === "beskrivelse"
                        ? tekster.kopieret
                        : tekster.kopierBeskrivelse}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => kopier("html", html)}
                  className="rounded-lg bg-gran px-4 py-2 text-sm font-medium text-bund outline-none focus-visible:ring-2 focus-visible:ring-gran focus-visible:ring-offset-2 focus-visible:ring-offset-bund"
                >
                  {kopieret === "html" ? tekster.kopieret : tekster.kopier}
                </button>
              )}

              {harTitel && !harProduktoversigt && (
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

              {/* "Skriv en til" beholder opsætningen fra den her tekst —
                  målgruppe, længde, stiltone. "Skriv en ny tekst" begynder
                  forfra. De to ting er ikke det samme, og en webshop, der
                  skal have tredive varer beskrevet, bruger den første. */}
              {skabelon && (
                <Link
                  href={`/app/ny/${skabelon}?genbrug=1`}
                  className="text-sm text-gran underline"
                >
                  {tekster.skrivEnTil}
                </Link>
              )}

              <Link href="/app/ny" className="text-sm text-gran underline">
                {tekster.nyTekst}
              </Link>
            </div>

            {harProduktoversigt ? (
              <p className="text-xs leading-relaxed text-gran-let">
                {tekster.produktoversigtForklaring}
              </p>
            ) : (
              harTitel && (
                <p className="text-xs leading-relaxed text-gran-let">
                  {tekster.kopierForklaring}
                </p>
              )
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
