# Beslutningslog

Valg truffet undervejs, som ikke fremgår af CLAUDE.md eller de oprindelige
oplæg. Nyeste øverst. Én linje pr. beslutning: **hvad**, **hvorfor**, og hvad
det **koster os senere**, hvis noget.

Opdateres løbende — se "Arbejdsform" i CLAUDE.md.

---

## Skal gøres før lancering

Åbne punkter, der bevidst er sat på pause. Gennemgå listen, når vi nærmer os
trin 8.

- [ ] **Fjern `noindex`.** `app/layout.tsx` → slet linjen `robots: { index: false, follow: false }` i `metadata`. Uden det bliver siden aldrig fundet af Google.
- [ ] **Åbn for brugere.** Supabase → Authentication → Sign In / Providers → slå "Allow new users to sign up" til igen (eller tilføj godkendt-liste).
- [ ] **Egen SMTP + dansk login-mail.** Skal på plads INDEN de første testbrugere — ikke først ved lancering. Supabases indbyggede mailservice sender kun til adresser knyttet til vores egen Supabase-konto, og skabelonerne kan ikke redigeres uden egen SMTP. Sæt Resend op (gratis til 3.000 mails/md.), og skift derefter Magic Link-skabelonen til dansk med `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` — den form virker også, når mailen åbnes på en anden enhed end den, linket blev bestilt fra.
- [ ] **Kobl `nettotext.com` på** i Vercel → Settings → Domains — og skift derefter **Site URL** i Supabase → Authentication → URL Configuration til det nye domæne. Sker det ikke, peger login-mailens link stadig på `.vercel.app`.
- [ ] **Prøv ChatGPT-vejen af, før nogen får lov at vælge den.** `lib/ai/openai.ts` er skrevet, men aldrig kørt — platformens nøgle er en Anthropic-nøgle, så OpenAI-siden kan først testes, når der findes en OpenAI-nøgle at teste med. Lad ikke brugerne vælge ChatGPT i indstillinger, før mindst én tekst er skrevet den vej.
- [ ] **Tjek at lange tekster når at blive færdige.** `/api/generate` har `maxDuration = 60`. Vercels loft afhænger af abonnement. Timer "Langt — ca. 1.400 ord" ud i produktion, er der to knapper: hæv `maxDuration` (kræver det rigtige abonnement), eller sænk `effort` i `lib/ai/anthropic.ts`.
- [ ] **Privatlivspolitik** på `/da/privatliv` (GDPR, jf. teknisk oplæg afsnit 5).
- [ ] **Opdatér brandnavnet** i `design/design-3-vaerksted.html` til NettoText.

---

## 2026-08-25 — Trin 2: første generering

**Begge leverandører bygget fra dag ét — med hver sin officielle SDK.**
Brugerens valg: man skal frit kunne vælge Claude eller ChatGPT. Derfor ligger
der nu et adapterlag i `lib/ai/` med ét fælles interface og to
implementeringer (`anthropic.ts`, `openai.ts`). Resten af appen kender kun
vores egne typer fra `typer.ts` og aner ikke, hvem der svarer.
Fravalgt: et fælles "kompatibilitets"-bibliotek, der lader som om de to API'er
er ens. De ligner hinanden lige nok til, at det virker — indtil det ikke gør,
og så er fejlen svær at finde. Koster: to sæt fejloversættelser at
vedligeholde. Til gengæld er en tredje leverandør senere én ny fil.

**Teksterne bliver ikke ens hos de to.** Samme prompt giver forskelligt dansk.
Prompten skal derfor prøves af mod BEGGE, før brugerne må vælge frit — ellers
finpudser vi den til Claude og lader ChatGPT-brugerne få et dårligere produkt.
Se tjeklisten ovenfor.

**Modelnavne står kun ét sted: `lib/ai/modeller.ts`.**
Leverandørernes fulde kataloger rummer modeller, der ikke kan skrive et
blogindlæg, og navnene skifter ofte. En kort, kurateret liste er ærligere.
Bemærk: OpenAIs aktuelle modelnavne blev slået op på deres egen
dokumentation undervejs — de navne, en sprogmodel husker udenad, var
forældede. Gør det samme næste gang listen skal opdateres.

**Platformens leverandør udledes af nøglens præfiks.**
`PLATFORM_AI_KEY` er én variabel, og Anthropics nøgler begynder med `sk-ant-`.
Alternativet var endnu en miljøvariabel at sætte forkert. I dag er nøglen en
Anthropic-nøgle, så det er Claude, der skriver prøveteksterne.

**`effort: "medium"` frem for standard.** Hvor grundigt Claude tænker, før den
skriver. Standard er "high", som giver bedre struktur — men også flere
sekunders pause, før de første ord kommer, og genereringen skal nå at blive
færdig inden for `maxDuration`. Det er den vigtigste knap at dreje på, når
den danske kvalitet skal vurderes.

**Kvoten håndhæves NU — ikke først i trin 6.**
Byggeplanen lægger kvote og rate limiting i trin 6, men CLAUDE.md regel 6
kalder det ufravigeligt, at alt der koster penge går gennem serveren med
tjek af kvote. At bygge `/api/generate` uden ville betyde ubegrænset forbrug
på platformens nøgle. Derfor er (a) logget ind og (b) prøvekvote på plads nu.
**Stadig ikke på plads: rate limit (maks. 3/min), det globale budgetloft
`DAILY_BUDGET_DKK` og `usage_log`.** Regel 6 er altså kun delvist opfyldt —
det er trin 6's opgave. Indtil da er kvoten på 5 pr. konto det eneste, der
begrænser forbruget, og vi ved ikke, hvad en prøvetekst koster.

**Reservationen ligger i en databasefunktion, ikke i koden.**
`reserver_proeve_tekst()` kører `update ... where trial_used < trial_quota`.
Læste serveren i stedet tallet, tænkte sig om og skrev tilbage, kunne to
samtidige forsøg begge nå at læse "4" og begge få lov. Funktionerne er
`security definer` og derfor udtrykkeligt frataget `anon` og `authenticated`
— ellers kunne enhver indlogget bruger kalde `frigiv_proeve_tekst` gennem
Supabases API og nulstille sin egen kvote.
Kvoten trækkes FØR kaldet og gives tilbage, hvis genereringen døde, før der
kom tekst ud.

**Sanering: teksten vises som tekst, ikke som HTML.**
CLAUDE.md regel 4 kræver, at AI-genereret HTML saneres server-side, før den
sendes til klienten. Det kan ikke lade sig gøre bid for bid, mens der
streames — man kan ikke sanere et halvt HTML-tag. Løsningen i trin 2: den rå
HTML vises som ren tekst i et `<pre>`-element, hvor React escaper den. Intet
bliver nogensinde tolket som HTML, så der er intet at sanere endnu.
Til trin 3, hvor teksten skal VISES som HTML: sanér server-side, når hver
blok er hel — ikke pr. bid. Skriv det ind, når editoren bygges.

**Briefen rejser gennem browseren, ikke gennem databasen.**
`sessionStorage`, se `lib/skabeloner/kladde.ts`. "Intet gemmes permanent" er
et løfte, og en brief, der aldrig rører serveren, kan ikke blive liggende.
Den færdige tekst lægges samme sted, mens den skrives, så en genindlæsning
af `/app/skriv` ikke koster en ny prøvetekst. Trin 4 lægger den rigtige
kladdefunktion oven på (localStorage + `drafts` med 48 timers udløb).

**Streamingprotokollen er NDJSON — én JSON-linje pr. hændelse.**
Fravalgt: Server-Sent Events, som kan det samme, men kræver mere opsætning på
begge sider. NDJSON giver os plads til at sende både tekstbidder og en
fejlbesked midt i strømmen — vigtigt, fordi statuskoden er sendt for længst,
når leverandøren fejler midtvejs.

**Brugerens brief pakkes i en afgrænset blok.**
`lib/ai/prompt.ts`. Markørerne står på egne linjer, og linjer i brugerens
tekst, der ligner en markør, fjernes. Systemprompten siger udtrykkeligt, at
blokken er data og ikke instruktioner. Det er ikke vandtæt — ingen
prompt-afgrænsning er det — men den nemme vej ind er lukket.

**Rå fejltekster fra leverandøren når aldrig browseren.**
Adapterne oversætter til en håndfuld kategorier (`ugyldig_noegle`,
`tom_saldo`, `rate_limit` …), og klienten slår den danske besked op i
`messages/da.json`. Leverandørens egen fejltekst kan indeholde dele af
anmodningen eller af nøglen og går derfor kun i serverloggen.

**Ny afhængighed: `server-only`.**
Ét lille bibliotek, der gør det til en byggefejl at importere serverkode fra
en klient-komponent. Det gør CLAUDE.md regel 1 ("hemmeligheder kun
server-side") til noget bygningen håndhæver, i stedet for noget vi skal huske.
Brugt i `lib/ai/index.ts`, `lib/kvote.ts` og `lib/supabase/server-service.ts`.

---

## 2026-08-24 — Trin 1: login

**Kun magic link — intet Google-login.**
Brugerens valg. Sparer et helt afsnit i Supabase-opsætningen (OAuth-klient,
hemmelighed, godkendte domæner) og en knap i UI'et. Google kan tilføjes
senere uden at røre resten af login-flowet.

**Adgangskontrollen ligger i `app/app/layout.tsx`, ikke i `proxy.ts`.**
Next.js' egen dokumentation advarer eksplicit mod at bruge proxy-laget som
sikkerhedslag. Proxy'en forbereder kun sessionen. Fordi tjekket ligger i
layoutet, er alle fremtidige sider under `/app` beskyttet automatisk.

**Samme svar uanset om kontoen findes.**
Et login-forsøg svarer altid "findes der en konto med den adresse, ligger
der nu et link i indbakken". Ellers kunne enhver bruge login-siden til at
afgøre, om en given mailadresse er kunde hos os. Koster: skriver du din mail
forkert, får du ingen advarsel — du venter bare forgæves.

**Låsen er `shouldCreateUser: false` plus dashboard-indstillingen.**
To lag, så en fejl i det ene ikke åbner døren. Brugere oprettes manuelt i
Supabase, indtil vi åbner.

**`/auth/callback` accepterer både `token_hash` og `code`.**
Det viste sig at være nødvendigt: Supabase låser mailskabelonerne, indtil
man har koblet sin egen SMTP på, så V1 kører på standardskabelonen, der
sender `code`. `token_hash` ligger klar til den dag, vi får egen SMTP og
kan skrive mailen på dansk. Konsekvens indtil da: login-mailen er engelsk,
og linket skal åbnes i samme browser, som bestilte det.

**Manglende miljøvariabler skal fejle højlydt, ikke stille.**
`lib/supabase/konfiguration.ts` kaster en navngiven fejl, hvis en Supabase-
variabel er tom. Baggrund: live gav bar "Internal Server Error" på alle ruter
der rører Supabase, mens den statiske forside virkede — årsagen var, at
`NEXT_PUBLIC_SUPABASE_URL` var tom hos Vercel, selvom den stod på listen.

Værd at huske næste gang noget kun fejler live:
- `NEXT_PUBLIC_`-variabler læses ved BYGNING og skrives ind i koden. Ændrer
  man dem, skal der deployes igen — Vercel gør det ikke af sig selv.
- En manglende variabel får ikke bygningen til at fejle af sig selv. Den
  producerer en side, der først går ned, når nogen bruger den.
- Fejlkontrollen flytter fejlen til bygningen, hvor den ses med det samme
  og aldrig når ud til en bruger. Beskeden går kun i byggeloggen.
- Test altid en rute, der rører databasen. En statisk forside kan svare 200,
  mens alt andet er brudt.

**Login ligger på `/log-ind` uden sprogpræfiks.**
Den hører til appen, ikke til marketing-siderne, og appen har sproget som
brugerindstilling. Teksterne ligger stadig i `messages/da.json` og hentes
server-side, så formularen kan være en klient-komponent uden at trække en
sprog-provider med sig.

---

## 2026-08-24 — Trin 0: fundament

**Eget Supabase-projekt i stedet for delt database.**
Først lagt op til at dele et eksisterende projekt med andre apps; det ville
betyde fælles `auth.users`, altså fælles brugerkonti på tværs af apps, og en
"slet min konto", der rammer bredt. Løst ved et selvstændigt projekt
(`ozuwyybhjnhthfrfhwys`, region `eu-west-1`). En mellemløsning med eget
`nettotext`-skema blev bygget og rullet tilbage igen — tabellerne ligger nu i
`public` som normalt.

**`profiles` har kun en læse-policy — ingen update.**
Kunne brugeren opdatere sin egen række, kunne hun sætte `trial_used` til 0 og
generere gratis tekster på platformens regning i det uendelige. Kvoten ændres
derfor udelukkende af serverkode med `service_role`. Koster: al kvote-logik
skal ligge i API-routes, aldrig i klienten. Det er også kravet i CLAUDE.md
regel 6.

**Profilen oprettes af en database-trigger ved signup.**
`handle_new_user()` på `auth.users`. Alternativet — at oprette rækken fra
serverkode ved første login — er mere kode og kan glippe.

**`noindex` på alle sider indtil lancering.**
Login beskytter kun `/app`; forsiden er offentlig af natur. Uden `noindex`
kan Google nå at indeksere en halvfærdig side. Se tjeklisten ovenfor.

**Adgang låses via Supabase i stedet for i kode.**
I trin 1 slås "Allow new users to sign up" fra, og brugere oprettes manuelt.
Ingen kode at vedligeholde, og det er samme invite-model som MVP-oplægget
anbefaler for de første 20–50 brugere.

**Ingen `src/`-mappe.**
`app/`, `lib/`, `messages/` ligger direkte i roden. Ét lag mindre at
navigere i for en ikke-teknisk ejer, og det matcher stierne i CLAUDE.md.

**shadcn/ui på Radix-basis, ikke Base UI.**
shadcn tilbyder nu begge. Radix er den etablerede, så langt de fleste
eksempler og svar på nettet passer til den.

**`proxy.ts` i stedet for `middleware.ts`.**
Next.js 16 har omdøbt filen; den gamle virker stadig, men advarer. Filen gør
det samme: sender `/` videre til `/da`.

**Sprogstruktur: `[locale]`-mappe med `/da`, appen uden sprogpræfiks.**
Marketing-sider får sprogkode i URL'en af SEO-hensyn; `/app` har sproget som
brugerindstilling. `lang="da"` står indtil videre fast i `app/layout.tsx` —
når `/en` tilføjes, flyttes `<html>` ned i `app/[locale]/layout.tsx`.

**`ENCRYPTION_KEY` genereret lokalt som 32 tilfældige bytes i base64.**
Passer til AES-256-GCM. Det endelige valg mellem AES-256-GCM og Supabase
Vault/pgsodium er ikke truffet — det tages, når `ai_keys` bygges, jf.
CLAUDE.md regel 2. Nøglen må aldrig skiftes efter idriftsættelse: så kan
gemte brugernøgler ikke læses igen.
