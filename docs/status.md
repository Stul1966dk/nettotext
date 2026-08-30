# Status — hvad mangler i version 1

Sidst opdateret: **30. august 2026**, efter trin 4.

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

Teksterne skal lyde som brugerens virksomhed, uden at hun skriver det samme i
hver eneste brief.

- `brand_profiles`-tabel: firmabeskrivelse, tone, forbudte ord, sprogprøve.
  Én pr. bruger i V1.
- `instructions`-tabel: gemte instruktioner, der genbruges på tværs af tekster.
- `/app/indstillinger` — siden findes ikke endnu.
- Brand-profil og instruktioner ind i prompten som TYDELIGT AFGRÆNSEDE blokke.
  CLAUDE.md regel 5 gælder uændret: de supplerer systemets regler og kan ikke
  omdefinere dem. Samme behandling som briefen og som ønsket til et afsnit.
- Frit instruktionsfelt på brief-siden til det, der kun gælder én tekst.

---

## Din egen AI-nøgle (BYOK) — mangler i byggeplanen

**Det her trin står ikke i det tekniske oplæg.** Oplægget blev skrevet, før
hybridmodellen blev besluttet, og byggeplanen er aldrig blevet opdateret.
Manglen er reel og alvorlig: uden BYOK stopper appen for enhver bruger efter
den femte tekst. `vaelgNoegle` kaster `ManglerNoegle`, og der er ingen vej
videre i appen.

- `ai_keys`-tabel med kryptering. **Et valg, der endnu ikke er truffet:**
  AES-256-GCM med `ENCRYPTION_KEY`, eller Supabase Vault/pgsodium. CLAUDE.md
  regel 2 kræver, at fordele og ulemper lægges frem, og at der anbefales én,
  første gang det bygges.
- `POST /api/keys` — gem, validér og slet nøgle.
- AI-forbindelse i indstillinger: vælg leverandør, indsæt nøgle, kurateret
  modelliste, "Test forbindelsen"-knap, slet nøgle.
- Opsætnings-wizard på dansk: trinvis guide til at oprette en nøgle hos
  Anthropic hhv. OpenAI, med anbefaling om forbrugsloft hos leverandøren.
- `vaelgNoegle` skal hente og dekryptere brugerens nøgle. Dekryptering KUN
  server-side i genererings-øjeblikket; nøglen sendes aldrig til klienten
  igen, kun `key_hint`.
- ChatGPT-vejen skal afprøves, og OpenAI-priserne slås op. Begge står allerede
  på tjeklisten i `beslutninger.md`.

**Anbefalet rækkefølge: BYOK før trin 5.** Personalisering gør gode tekster
bedre; nøglen er forskellen på, om nogen overhovedet kan bruge værktøjet efter
den femte tekst.

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

- **De øvrige teksttyper:** produkttekst, brandtekst, landingsside. Det er
  DATA, ikke kode — en migrationsfil med en systemprompt og nogle felter,
  ligesom blogindlægget. Det er derfor, formularen bygges dynamisk ud fra
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

Retningen er besluttet 30.08.2026. NettoText skal ikke kun kunne skrive
blogindlæg og produkttekster, men også de dokumenter, en given branche laver
igen og igen.

**Arkitekturen er allerede bygget til det.** Teksttyper er DATA, ikke kode:
en ny type er en migrationsfil med en systemprompt og nogle felter i
`templates.input_fields`, og formularen bygger sig selv. Det var netop
begrundelsen for at gøre det sådan fra trin 2.

**Omfanget er dog en anden sag.** Trin 7 taler om fire teksttyper. Listen
herunder er ni brancher med fire typer hver. Det er ikke et trin, det er en
fase for sig, og den bør deles op og bygges branche for branche — ikke fordi
koden bliver svær, men fordi hver enkelt teksttype skal have en systemprompt,
der er god nok til at sende ud til nogen.

### To slags dokumenter, og forskellen er ikke til forhandling

Eksemplerne nedenfor deler sig i to grupper med vidt forskellige krav. Det er
værd at holde dem adskilt fra første dag, for de trækker produktet hver sin
vej.

**Gruppe A — tekster, der skal overbevise.** Samme slags produkt som i dag:
en tekst, brugeren læser igennem, retter i og godkender. Fejl koster omdømme,
ikke andet. Her passer den nuværende arkitektur, prompten og tonen.

- E-handel: produktbeskrivelser, returvejledninger
- Rejsebureauer og hoteller: rejsebeskrivelser, hotelpræsentationer
- Kursus- og uddannelsessteder: kursusbeskrivelser, modulbeskrivelser
- HR: jobopslag, velkomstmails
- PR: pressemeddelelser, pitch-mails, Q&A-ark til krisekommunikation
- Konsulenter: tilbudsskrivelser, projektforslag

**Gruppe B — dokumenter med retsvirkning eller persondata.** Et andet produkt,
selvom det ligner. Her koster en fejl penge, retsstillinger eller en klage.

- Advokater: testamenter, ægtepagter, ansættelses- og lejekontrakter, stævninger
- Finans og forsikring: låneaftaler, policetekster, årsrapporter,
  skadesanmeldelser, kreditvurderinger
- Offentlig forvaltning: afgørelsesbreve, aktindsigtsbesvarelser,
  lokalplanforslag, partshøringer
- HR: afslag på ansøgninger, medarbejderhåndbøger
- Konsulenter: statusrapporter og evalueringsrapporter, hvis de indgår i
  afregning eller tilsyn

### Hvad gruppe B kræver, ud over en skabelon

Det her er ikke indvendinger mod idéen. Det er de beslutninger, der skal
træffes, FØR den første af dem sælges til nogen.

1. **Persondata i briefen.** Et afgørelsesbrev, en skadesanmeldelse eller et
   afslag på en ansøgning indeholder oplysninger om et navngivet menneske —
   og i nogle tilfælde helbredsoplysninger, altså følsomme data. I dag siger
   CLAUDE.md regel 9, at vi aldrig logger tekstindhold eller persondata, og
   det holder. Men briefen sendes videre til Anthropic eller OpenAI, og
   kladden ligger 48 timer i `drafts`. **Vi bliver databehandler for
   oplysninger, vi i dag har designet os fri af.** Det kræver som minimum en
   databehandleraftale med brugeren, en vurdering af underdatabehandlerne, og
   en stillingtagen til, om følsomme kategorier overhovedet må røre systemet.
2. **Ansvar for indholdet.** Et testamente har formkrav; er de ikke opfyldt,
   er det ugyldigt. En stævning skal opfylde retsplejelovens krav. Et
   afgørelsesbrev skal leve op til forvaltningslovens begrundelseskrav og
   partshøringsregler. En sprogmodel, der skriver dem "næsten rigtigt", er
   farligere end en, der ikke skriver dem. Der skal tages stilling til, hvad
   NettoText lover, og hvad brugeren selv står på mål for — og det skal stå i
   produktet, ikke kun i en betingelse.
3. **Kreditvurderinger er en sag for sig.** Automatiske afgørelser med
   retsvirkning for et menneske er reguleret særskilt (GDPR artikel 22). Det
   punkt bør enten skæres fra eller behandles som sit eget projekt.
4. **Prompten trækker den forkerte vej.** Systemprompten i dag kræver
   mundtligt dansk: "kunne du sige sætningen til en kunde henover et
   køkkenbord?" Et policetekst eller en partshøring skal det stik modsatte —
   fast formulering, genkendelige vendinger, ingen sproglig variation. De to
   slags tekster kan ikke dele systemprompt. Gruppe B har brug for sin egen.
5. **Den nuværende regel om belæg bliver vigtigere, ikke mindre.** Prompten
   forbyder allerede at opfinde tal, datoer og paragraffer. I gruppe B er dét
   forbud forskellen på et brugbart udkast og et falsk dokument.

### Anbefalet vej

Byg **gruppe A først**, branche for branche. Den kræver ingen nye
beslutninger — kun gode systemprompter og en migrationsfil pr. teksttype — og
den kan sælges til de samme mindre erhvervsdrivende, produktet allerede er
skrevet til.

**Gruppe B er et selvstændigt produktspor**, ikke en udvidelse af det
nuværende. Tag den, når de fem punkter ovenfor er afklaret, og tag én branche
ad gangen. Offentlig forvaltning og advokater er de to sværeste; e-handel og
HR-jobopslag er de nemmeste.

**Ingen af delene hører til i version 1.** V1 skal først kunne det, den lover
i dag, med de fire teksttyper fra trin 7.

---

## Mindre huller, der ikke hører til et bestemt trin

- **Redigér og slet en blok i hånden.** Det tekniske oplæg beskriver editoren
  som "pr. blok: redigér, Regenerér denne sektion, slet". Regenerering er
  bygget; manuel redigering og sletning er ikke. Det koster ingen AI-kald og
  er formentlig værd at have — nogle gange vil man bare rette ét ord.
- **Den lange tekstlængde (1.400 ord) er stadig ikke afprøvet i produktion.**
  Se noten om `maxDuration` på tjeklisten. Opdelt generering sektion for
  sektion er den foretrukne løsning, og blokkene fra trin 3 er fundamentet.
