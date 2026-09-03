# Status — hvad mangler i version 1

Sidst opdateret: **3. september 2026**, midt i trin 7.

Dokumentet holder byggeplanen i `teknisk-oplaeg-v1.md` op mod, hvad der
faktisk står i koden og databasen. Byggeplanen er en plan; det her er en
opgørelse.

**Sådan holdes det ærligt:** opdatér datoen øverst og streg det færdige, når
et trin lukkes. Bliver dokumentet ikke opdateret, er det værre end ingenting —
så beskriver det en fortid, nogen tror er nutid.

**De konkrete åbne punkter står ikke her, men i `beslutninger.md`** under
"Skal gøres før lancering". De to lister skal ikke vedligeholdes hvert sted.

---

## Færdigt

| Trin | Indhold | Status |
|---|---|---|
| 0 | Fundament, Supabase, Vercel, sprogstruktur | færdig |
| 1 | Login med magic link, RLS på `profiles` | færdig |
| 2 | Første generering, streaming, adapterlag, prøvekvote | færdig |
| 3 | Editor: blokke, meta-felter, omskrivning, eksport | færdig |
| 4 | Kladder: localStorage, `drafts` med 48 timers udløb, pg_cron | færdig |

---

## Trin 5 — Personalisering

**Færdig 02.09.2026.** Teksterne lyder nu som brugerens virksomhed, uden at
hun skriver det samme i hver eneste brief.

- `brand_profiles` og `instructions` med RLS (migration 0013).
- Brand-profil og gemte instruktioner som egne afsnit i `/app/indstillinger`.
- Begge dele ind i prompten som TYDELIGT AFGRÆNSEDE blokke, både ved
  generering og ved omskrivning af ét afsnit. CLAUDE.md regel 5 gælder
  uændret: de supplerer systemets regler og kan ikke omdefinere dem.
- Frit instruktionsfelt på brief-siden til det, der kun gælder én tekst.
  Følger kladden og gemmes ikke derudover.

Afprøvet ende til ende 02.09.2026: brand-profilen, den gemte instruktion og
det frie felt kunne alle tre genfindes i den skrevne tekst.

**Mangler stadig på siden:** profil-afsnittet (mailadresse, "slet min konto").
Sletningen står på lanceringstjeklisten.

---

## Din egen AI-nøgle (BYOK) — mangler i byggeplanen

**Det her trin står ikke i det tekniske oplæg.** Oplægget blev skrevet, før
hybridmodellen blev besluttet, og byggeplanen er aldrig blevet opdateret.
Manglen var reel og alvorlig: uden BYOK stoppede appen for enhver bruger
efter den femte tekst.

**Virker, pr. 02.09.2026.** Nøglen kan gemmes, afprøves og slettes,
genereringen bruger den, og der er en dansk guide til at oprette den. Hullet
efter den femte tekst er lukket. Tilbage står kun ChatGPT-vejen.

Færdigt:

- `ai_keys`-tabel med kryptering (migration 0012). Valget faldt på
  AES-256-GCM med `ENCRYPTION_KEY`; begrundelsen står i `beslutninger.md`.
- `POST /api/keys` — gem, validér, skift model og slet nøgle.
- AI-forbindelse i `/app/indstillinger`: vælg leverandør, indsæt nøgle,
  kurateret modelliste, "Test forbindelsen"-knap, slet nøgle.
  Afprøvet ende til ende med en rigtig nøgle 02.09.2026 — kryptering,
  lagring, dekryptering og kald til Anthropic. **Undtagen sletningen**, som
  ikke er kørt igennem på en rigtig nøgle endnu.
- **`vaelgNoegle` henter og bruger nøglen.** Dekryptering KUN server-side i
  genererings-øjeblikket; nøglen sendes aldrig til klienten igen, kun
  `key_hint`. Forbruget logges med `paid_by = 'user'`, og budgetloftet
  spørges ikke, når brugeren betaler selv. Rate limiten gælder begge veje.
  Afprøvet 02.09.2026 med tom prøvekvote og en rigtig nøgle, på både
  `/api/generate` og `/api/regenerate-section`.
- Opsætnings-guide på `/app/opsaetning`: fem trin til en nøgle hos
  leverandøren, med forbrugsloft som trin 3 og formularen som sidste trin.
  Vises fra dashboardet, når kvoten er brugt, fra indstillinger, og fra
  fejlbeskeden, når en tekst ikke kan skrives uden nøgle.

Mangler:

- ChatGPT-vejen skal afprøves, og OpenAI-priserne slås op. Begge står allerede
  på tjeklisten i `beslutninger.md`. Bemærk: manglende priser er dét, der
  holder OpenAI ude af indstillinger — se `lib/ai/modeller.ts`.

**BYOK blev bygget før trin 5, og det var den rigtige rækkefølge.**
Personalisering gør gode tekster bedre; nøglen var forskellen på, om nogen
overhovedet kunne bruge værktøjet efter den femte tekst.

---

## Trin 6 — Styring

Det meste er bygget før tid, fordi hvert punkt blev nødvendigt undervejs.
Begrundelserne står i `beslutninger.md`.

| Punkt | Status |
|---|---|
| Prøvekvote | færdig (trin 2) |
| Forbrugslog (`usage_log`) | færdig (30.08.2026) |
| Globalt dagligt budgetloft | færdig (30.08.2026) |
| Rate limit pr. bruger | færdig (30.08.2026) |
| Sentry | **mangler** |
| Feedback-widget | **mangler** |

Feedback er halvt forberedt: kolonnerne `feedback` og `feedback_comment` står
allerede i `usage_log`. Der mangler tommel op/ned i editoren og ruten
`POST /api/feedback`.

---

## Trin 7 — Resten af indholdet

**Påbegyndt 03.09.2026 med produktteksten.**

| Teksttype | Status |
|---|---|
| Blogindlæg | færdig (trin 2) |
| Produkttekst | færdig 03.09.2026 (migration 0014) |
| Brandtekst | færdig 03.09.2026 (migration 0015) |
| Landingsside | færdig 03.09.2026, oprettet gennem adminsiden |

Produktteksten kostede én kodeændring: `/app/ny` havde teksttypen skrevet ind
i koden og henter den nu fra adressen, så `/app/ny` er blevet et valg mellem
typer og `/app/ny/produkttekst` er briefen. Editoren, blokkene, omskrivningen
af ét afsnit og eksporten virkede uændret. Arkitekturen fra trin 2 holdt.

To ting adskiller produktteksten fra blogindlægget, begge med vilje: den
skriver ingen h1, fordi webshoppen selv sætter varens navn, og dens felter er
ikke forudfyldt med eksempeltekst. Begrundelserne står i `beslutninger.md`.

Afprøvet ende til ende 03.09.2026 med en rigtig brief: generering, blokke,
omskrivning af ét afsnit, kladden på serveren og eksport til Word. Teksten
holdt sig inden for briefens tal, skrev ingen h1 og fik sin faktaliste. To
sproglige smuttere i den skrevne tekst ("læsvogn", "grenar") er noteret som
noget at holde øje med, ikke som en fejl i koden.

Brandteksten kostede ingen kodeændring overhovedet, kun en migrationsfil.
Den bruger brand-profilen fra trin 5 som kilde til, hvem virksomheden er, og
har sin egen forbudsliste mod værdiord. Se `beslutninger.md`.

Afprøvet 03.09.2026 med en brief om et bogtrykkeri: alle årstal og antal i
teksten kunne genfindes i briefen, ingen værdiord slap igennem, og h1 og
"Kopiér uden titel" var på plads, som de skal være for denne teksttype.
**Ét tal blev fundet på:** modellen skrev "når 500 stk. allerede ligger
færdige" som et opdigtet eksempel, og briefen nævnte kun mindsteoplaget på 50.
Det er ikke en påstand om virksomheden, men det er et tal, reglen om belæg
siger nej til. Hold øje med, om det gentager sig, før prompten strammes.

Samspillet med en udfyldt brand-profil er afprøvet 03.09.2026 med en bevidst
tynd brief: oplysninger, der KUN stod i profilen, kom med i teksten, og hvor
briefen sagde noget andet, vandt briefen. Sprogprøven blev ikke skrevet af.
Afprøvningen fandt én fejl i prompten, rettet i migration 0016: brandteksten
krævede vi-form, hvilket er forkert for en enkeltmandsvirksomhed.

**Meta-beskrivelsen lander ofte lige under målet.** Tre målinger: 133, 137 og
151 tegn, hvor prompten beder om 140 til 160. Ikke en fejl, men et mønster,
der kan rettes med en linje i prompterne, hvis det bliver ved.

**Stiltone (03.09.2026).** Brugeren vælger nu i briefen, hvordan teksten skal
lyde: nøgtern, imødekommende eller sælgende. Valget ligger i KODEN og ikke i
skabelonerne, fordi der kommer mange flere teksttyper: feltet tegnes af
formularen selv, og reglerne er et systemtillæg i `lib/ai/prompt.ts`. Hver ny
teksttype arver det uden en linje i sin migrationsfil. Se `beslutninger.md`,
også for det, afprøvningen viste om, hvor godt "sælgende" holder sig inden
for briefen.

Landingssiden blev den første teksttype uden en migrationsfil. Den er lavet
gennem adminsiden: felterne kopieret fra produktteksten og rettet til,
prompten skrevet i formularen, gemt som kladde, afprøvet, og først derefter
gjort synlig for brugerne. Stiltonen tog en del af beslutningen på forhånd:
siden skrives med "sælgende" valgt, så prompten kun skal tage sig af
strukturen.

**Dermed er alle fire teksttyper fra trin 7 færdige.** Tilbage i trinnet:
idégenerering og kildemateriale.

- **Den sidste teksttype:** landingssiden. Det er DATA, ikke kode
  — en migrationsfil med en systemprompt og nogle felter, ligesom de tre
  første. Det er derfor, formularen bygges dynamisk ud fra
  `templates.input_fields`.
- **Idégenerering:** `POST /api/ideas`. Forslag til emner, før briefen skrives.
- **Kildemateriale:** `POST /api/fetch-source`. Kræver SSRF-beskyttelsen fra
  CLAUDE.md regel 8: kun http/https, timeout 10 sek., maks. 2 MB, og private
  eller interne IP-adresser blokeret.

---

## Trin 8 — Lancering

- Marketing-forside på `/da/` efter `design/design-3-vaerksted.html`.
- Privatlivspolitik på `/da/privatliv`.
- **"Slet min konto"** — GDPR-kravet i CLAUDE.md regel 9. Alle brugerens
  rækker i alle tabeller, `ai_keys` inklusive. De fleste tabeller har
  `on delete cascade` mod `auth.users`, så meget af arbejdet er gjort; der
  mangler en knap, en rute og en bekræftelse.
- Venteliste eller invitationer til de første 20-50 brugere.
- **Hele tjeklisten i `beslutninger.md` gennemgås punkt for punkt.**

---

## Branchepakker — teksttyper pr. branche

Retningen er besluttet 30.08.2026: NettoText skal ikke kun kunne skrive
blogindlæg og produkttekster, men også de dokumenter, en given branche laver
igen og igen. Hvilke brancher og hvilke dokumenter er IKKE afgjort — det
afhænger af, hvem der viser sig at ville betale.

**Arkitekturen er allerede bygget til det.** Teksttyper er DATA, ikke kode: en
ny type er en migrationsfil med en systemprompt og nogle felter i
`templates.input_fields`, og formularen bygger sig selv. Det var netop
begrundelsen for at gøre det sådan fra trin 2.

**Omfanget er en anden sag.** Trin 7 taler om fire teksttyper. Bliver det til
en håndfuld brancher med fire typer hver, er det ikke et trin, men en fase for
sig — ikke fordi koden bliver svær, men fordi hver enkelt teksttype skal have
en systemprompt, der er god nok til at sende ud til nogen. Byg branche for
branche, ikke alle på én gang.

### Prøven, hver ny teksttype skal igennem

Uanset hvilke brancher der ender med at blive valgt, falder teksttyper i to
grupper, og forskellen afgør, hvad der skal på plads først. Spørg om den nye
type:

**Kan et menneske komme galt af sted, hvis teksten er næsten rigtig?**
**Og står der personoplysninger i den?**

**Nej til begge — gruppe A.** Samme produkt som i dag: en tekst, brugeren
læser igennem, retter i og godkender. Fejl koster omdømme, ikke andet. Den
nuværende arkitektur, prompt og tone passer, og typen kan bygges med det
samme.

*Eksempler på formen:* en produktbeskrivelse til en webshop, et jobopslag, en
pressemeddelelse, en kursusbeskrivelse, en hotelpræsentation, en
tilbudsskrivelse.

**Ja til et af dem — gruppe B.** Et andet produkt, selvom det ligner. Her
koster en fejl penge, retsstillinger eller en klage.

*Eksempler på formen:* et testamente eller en kontrakt hos en advokat, et
afgørelsesbrev eller en partshøring i en kommune, en policetekst eller en
kreditvurdering i finans, et afslag på en jobansøgning.

### Hvad gruppe B kræver, ud over en skabelon

Det her er ikke indvendinger mod idéen. Det er de beslutninger, der skal
træffes, FØR den første tekst af den slags sælges til nogen.

1. **Persondata i briefen.** Et afgørelsesbrev, en skadesanmeldelse eller et
   afslag på en ansøgning handler om et navngivet menneske — og nogle gange
   om helbred, altså følsomme oplysninger. CLAUDE.md regel 9 siger, at vi
   aldrig logger tekstindhold eller persondata, og det holder. Men briefen
   sendes videre til Anthropic eller OpenAI, og kladden ligger 48 timer i
   `drafts`. **Vi bliver databehandler for oplysninger, produktet i dag er
   designet fri af.** Det kræver som minimum en databehandleraftale med
   brugeren, en vurdering af underdatabehandlerne, og en stillingtagen til,
   om følsomme kategorier overhovedet må røre systemet.
2. **Ansvar for indholdet.** Et testamente har formkrav; er de ikke opfyldt,
   er det ugyldigt. Et afgørelsesbrev skal leve op til forvaltningslovens
   krav om begrundelse og partshøring. En sprogmodel, der skriver dem næsten
   rigtigt, er farligere end en, der ikke skriver dem. Der skal tages stilling
   til, hvad NettoText lover, og hvad brugeren selv står på mål for — og det
   skal stå i produktet, ikke kun i en betingelse.
3. **Automatiske afgørelser er en sag for sig.** Skal en teksttype indgå i en
   afgørelse med retsvirkning for et menneske — en kreditvurdering er det
   tydeligste eksempel — er det reguleret særskilt (GDPR artikel 22). Sådan
   en type bør enten skæres fra eller behandles som sit eget projekt.
4. **Prompten trækker den forkerte vej.** Systemprompten kræver i dag
   mundtligt dansk: "kunne du sige sætningen til en kunde henover et
   køkkenbord?" Et formelt dokument skal det stik modsatte — fast formulering,
   genkendelige vendinger, ingen sproglig variation. De to slags tekster kan
   ikke dele systemprompt. Gruppe B har brug for sin egen.
5. **Reglen om belæg bliver vigtigere, ikke mindre.** Prompten forbyder
   allerede at opfinde tal, datoer og paragraffer. I gruppe B er dét forbud
   forskellen på et brugbart udkast og et falsk dokument.

### Anbefalet vej

Byg **gruppe A først**. Den kræver ingen nye beslutninger — kun gode
systemprompter og en migrationsfil pr. teksttype — og den sælges til samme
slags kunder, produktet allerede er skrevet til.

**Gruppe B er et selvstændigt produktspor**, ikke en udvidelse af det
nuværende. Tag den, når de fem punkter ovenfor er afklaret, og tag én branche
ad gangen.

**Ingen af delene hører til i version 1.** V1 skal først kunne det, den lover
i dag, med de fire teksttyper fra trin 7.

---

## Adminside

Besluttet 30.08.2026. Ejeren har brug for ét sted at se, hvordan det går —
uden at åbne Supabase og skrive SQL.

**Påbegyndt 03.09.2026 med teksttyperne.** `/app/admin/teksttyper` kan
oprette og rette teksttyper: navn, beskrivelse, systemprompt og felterne i
briefen, med kladde-tilstand og historik over tidligere udgaver
(`template_versions`, migration 0017). Adgangen ligger i et layout under
`/app/admin` og kræver `ADMIN_EMAIL`. **Tallene nedenfor mangler stadig** —
det er den anden halvdel af siden.

**Adressen på adminkontoen står IKKE i repoet.** Den ligger i miljøvariablen
`ADMIN_EMAIL`, både i `.env.local` og hos Vercel. Begrundelsen er den samme
som da ejerkontoens prøvekvote blev ændret uden migrationsfil: en fil på et
offentligt GitHub-repo, der siger "det her er adminkontoen", fortæller også en
fremmed, hvilken konto der er værd at angribe. Skal der senere være mere end
én admin, er en `role`-kolonne på `profiles` den rigtige udvidelse — sat i
hånden i Supabase, ikke i en migrationsfil.

**Adgangen tjekkes server-side, aldrig i browseren.** Sikkerhedsreglernes
punkt 5. Tjekket hører hjemme i et layout under `/app/admin`, på samme måde
som `/app`-layoutet i dag afgør, om man er logget ind — så er hver fremtidig
underside beskyttet automatisk, uden at nogen skal huske det.

**Og der skal bruges `service_role` til at læse på tværs af brugere**, fordi
RLS ellers kun viser adminens egne rækker. Det udløser sikkerhedsreglernes
punkt 6: når `service_role` omgår RLS, skal adgangen verificeres manuelt i
koden. Rækkefølgen er derfor: tjek admin FØRST, hent data BAGEFTER.

### Hvad siden kan vise — og hvad den aldrig må

Alt herunder findes allerede som metadata i `usage_log` og `profiles`. Der
skal ikke gemmes noget nyt for at bygge siden.

- **Forbrug:** i dag, denne måned, i kroner. Delt op på `paid_by`, så
  platformens egen omkostning kan skelnes fra det, brugerne selv betaler.
- **Dagens budget:** hvor meget af `DAILY_BUDGET_DKK` der er brugt.
- **Brugere:** antal i alt og nye pr. uge, fra `profiles`.
- **Tekster:** antal skrevne, fordelt på teksttype og model.
- **Prøvekvote:** hvor mange gratis tekster der er givet væk i alt. Det er
  det tal, der afgør, om de fem prøvetekster er sat rigtigt.
- **Pris pr. tekst:** gennemsnit, tokens ind og ud. Grundlaget for
  V2-priserne, jf. det tekniske oplæg afsnit 7.
- **Feedback:** andel tommel op, når widgetten fra trin 6 er bygget.
- **Kladder:** hvor mange der ligger lige nu. Antal, aldrig indhold.

**Aldrig tekstindhold. Heller ikke som admin.** CLAUDE.md regel 9 kender ikke
en undtagelse for ejeren, og `usage_log` indeholder med vilje ingen tekst at
vise. Skal en fejl undersøges, hører det til i Sentry (trin 6) — ikke i en
funktion, der kan læse brugernes tekster.

**Ikke en spærring for lancering,** men den bør stå klar INDEN de første
20-50 brugere. Det er dér, tallene begynder at betyde noget, og dér man
opdager, om prøvekvoten eller budgetloftet er sat forkert.

---

## Mindre huller, der ikke hører til et bestemt trin

- **Redigér og slet en blok i hånden.** Det tekniske oplæg beskriver editoren
  som "pr. blok: redigér, Regenerér denne sektion, slet". Regenerering er
  bygget; manuel redigering og sletning er ikke. Det koster ingen AI-kald og
  er formentlig værd at have — nogle gange vil man bare rette ét ord.
- **Den lange tekstlængde (1.400 ord) er stadig ikke afprøvet i produktion.**
  Se noten om `maxDuration` på tjeklisten. Opdelt generering sektion for
  sektion er den foretrukne løsning, og blokkene fra trin 3 er fundamentet.
