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
- [ ] **Sæt ejerkontoens prøvekvote tilbage.** Den står på 1.000.000 for at kunne teste frit under udviklingen. Beslut inden lancering, om ejerkontoen fortsat skal være speciel — og hvis ikke, sæt den til 5 som alle andre.
- [ ] **Efterse beløbene i opsætnings-guiden.** `messages/da.json` → `opsaetning.koster` siger, at en kort tekst koster under en krone, og at mindstebeløbet hos leverandøren er 5 dollars. Begge dele bestemmer leverandøren og kan ændre sig. Tjek dem, inden guiden vises for rigtige brugere.
- [ ] **Fjern eksempelteksten fra brief-felterne**, eller lav den om til en "Udfyld med eksempel"-knap. Felterne i `templates.input_fields` er forudfyldt med et malerfirma i Brønderslev. Det er praktisk under test, men rigtige brugere vil sende eksemplet af sted som deres egen brief uden at opdage det.
- [ ] **Sæt et forbrugsloft på platformens AI-nøgle hos Anthropic.** `DAILY_BUDGET_DKK` er bygget (30.08.2026), så leverandørens loft er ikke længere den eneste bremse — men det er stadig den sidste. Appens loft kan kun tælle det, appen selv sender af sted; en lækket nøgle kan det ikke stoppe.
- [ ] **Sæt `ADMIN_EMAIL`** i `.env.local` og hos Vercel, når adminsiden bygges. Adressen står bevidst ikke i repoet — se afsnittet om adminsiden i `docs/status.md`.
- [ ] **Sæt `ENCRYPTION_KEY` hos Vercel** (og i ethvert nyt miljø). Den krypterer brugernes egne AI-nøgler. Mangler den, kan ingen gemme eller bruge sin nøgle. **Skift den ALDRIG efter idriftsættelse** — så kan allerede gemte nøgler ikke læses igen, og alle brugere skal indtaste deres på ny. Står lokalt i `.env.local`.
- [ ] **Husk `DAILY_BUDGET_DKK` i ethvert NYT miljø.** Sat hos Vercel 30.08.2026. Budgetloftet fejler LUKKET, så mangler variablen, holder genereringen op med at virke. Gælder også et eventuelt preview- eller testmiljø senere.
- [ ] **Udvid forbuddet mod modsætningsfiguren?** Prompten forbyder "ikke X, men Y" og "det handler ikke kun om X, det handler om Y". Modellen skriver den i stedet delt over to sætninger: "... handler ikke om at gøre det pænt. Det handler om at holde fugten ude." Ejerens beslutning, om reglen skal udvides — det er en sprogvurdering, ikke en teknisk.
- [ ] **Slå OpenAI-priserne op**, før nogen må vælge ChatGPT. `lib/ai/modeller.ts` har prisfeltet tomt for de to OpenAI-modeller, fordi tallene ikke er slået op. Uden pris logges forbruget som 0 kr., og budgetloftet tæller for lavt.
- [ ] **Prøv ChatGPT-vejen af, før nogen får lov at vælge den.** `lib/ai/openai.ts` er skrevet, men aldrig kørt — platformens nøgle er en Anthropic-nøgle, så OpenAI-siden kan først testes, når der findes en OpenAI-nøgle at teste med. Lad ikke brugerne vælge ChatGPT i indstillinger, før mindst én tekst er skrevet den vej.
- [ ] **Tjek at lange tekster når at blive færdige.** `/api/generate` har `maxDuration = 60`. Vercels loft afhænger af abonnement. Timer "Langt — ca. 1.400 ord" ud i produktion, er der to knapper: hæv `maxDuration` (kræver det rigtige abonnement), eller sænk `effort` i `lib/ai/anthropic.ts`.
- [ ] **Byg "slet min konto"** (GDPR, CLAUDE.md regel 9). Alle brugerens rækker i alle tabeller, `ai_keys` inklusive. De fleste tabeller har `on delete cascade` mod `auth.users`, så meget er gjort — der mangler en knap, en rute og en bekræftelse.
- [ ] **Privatlivspolitik** på `/da/privatliv` (GDPR, jf. teknisk oplæg afsnit 5).
- [ ] **Opdatér brandnavnet** i `design/design-3-vaerksted.html` til NettoText.

---

## 2026-09-02 — Opsætnings-guiden

**Kun leverandører, der faktisk kan vælges, får en guide.**
Samme regel som i indstillinger: uden kendt pris kan modellen ikke vælges, og
så kan leverandøren det heller ikke. En guide til noget, man ikke kan bruge
bagefter, er en blindgyde, og guiden har ét formål: at få brugeren fra
ingenting til en nøgle, der virker. **Teksten til ChatGPT er skrevet og
ligger klar i `da.json`** — den viser sig af sig selv, den dag priserne
bliver slået op.

**Guiden ender i selve formularen, ikke i et link til indstillinger.**
Brugeren står med en nøgle i udklipsholderen, som kun vises én gang hos
leverandøren. Et ekstra klik dér er et sted, hun kan tabe den.

**Formularen flyttet til `components/ai-forbindelse/`.**
Den bruges nu to steder. `AiForbindelseSektion` henter selv sine data og har
med vilje hverken overskrift eller ramme — de to sider siger hver sit om,
hvorfor man står der, og skal kunne gøre det med deres egne ord.

**Dashboardet siger nu, hvem der betaler.**
Var kvoten brugt, stod der før kun "0 af 5 prøvetekster tilbage". Nu står
der enten, at hun skriver på sin egen nøgle — med de fire sidste tegn — eller
en knap til guiden. Ellers ville hun først opdage forskellen, når hun stod
midt i en tekst, der ikke blev skrevet.

**Beløbene i guiden er skøn og skal efterses.**
"En kort tekst koster typisk under en krone" og mindstebeløbet på 5 dollars
er rigtige i dag. Begge dele bestemmer leverandøren, ikke os. Sat på
tjeklisten.

---

## 2026-09-02 — BYOK: genereringen bruger nøglen

**`vaelgNoegle` er nu asynkron og tager bruger-id'et.**
Den skal slå brugerens nøgle op i databasen, og det kan ikke gøres synkront.
`brugerId` SKAL komme fra `auth.getUser()` på serveren — et id fra browseren
ville være det samme som at lade enhver bruge en andens nøgle.

**`byggAdapter` flyttet til `lib/ai/adapter.ts`.**
Ellers ville `lib/ai/index.ts` og `lib/ainoegler.ts` importere hinanden i
ring: index → ainoegler (hent nøglen) → index (byg adapteren). Ringen ville
måske virke, men den slags går i stykker på en ubehagelig måde.

**Budgetloftet gælder stadig kun platformens nøgle.**
Det stod allerede rigtigt i begge ruter (`valg.betaler === "platform"`), så
der var intet at ændre. Loftet findes for at beskytte VORES nøgle; betaler
brugeren selv, er forbruget hendes sag. **Rate limiten gælder derimod begge
veje** — den beskytter også leverandøren mod at få tredive kald i sekundet
fra os, og brugeren mod sit eget klik-løb.

**En gemt model, der er taget af listen, falder tilbage til standarden.**
`sikkerModel` var der i forvejen; nu bruges den også på brugerens eget valg.
Bedre at skrive teksten med standardmodellen end at fejle på et navn.

**Loglinjen siger nu, hvem der betalte.**
`betalt af user` eller `betalt af platform` i både `[generate]` og
`[omskriv]`. Uden det kan man ikke se forskel på de to veje i driften, og
det er præcis dét, man har brug for at kunne se, når noget undrer en.
Stadig kun tal og kategorier — aldrig noget af teksten.

**Kan den gemte nøgle ikke dekrypteres, er det ikke en serverfejl.**
Sker typisk kun, hvis `ENCRYPTION_KEY` er skiftet. Brugeren får nu beskeden
om, at nøglen blev afvist, og skal indsætte den igen — ikke "prøv igen om
lidt", som hun kunne blive ved med at gøre forgæves.

---

## 2026-09-02 — BYOK: API-rute og indstillingsside

**Nøglen testes, FØR den gemmes.**
Der findes ingen "tjek nøglen"-funktion hos leverandørerne; den eneste ærlige
måde at vide, om en nøgle virker, er at bruge den. Ruten sender derfor et
minimalt kald af sted og gemmer kun, hvis det lykkes.
**Hvad det koster os:** en brøkdel af en øre pr. gemning, betalt af brugerens
egen konto. Alternativet var at opdage fejlen, mens hun sad midt i en tekst.

**Rate limiten gælder også nøgletest.**
Et kald til leverandøren koster penge og kan misbruges til at gætte nøgler af
sted mod Anthropic fra vores server. Samme loft som generering: 3 i minuttet.
**Kendt bivirkning:** tester hun forbindelsen to gange og skriver en tekst
lige efter, kan hun ramme loftet. Beskeden siger, hvad hun skal gøre.

**OpenAI holdes ude af indstillinger — men ikke med et flag.**
Reglen er den samme for alle modeller: en model uden pris kan ikke vælges,
fordi forbruget så ville blive logget som 0 kroner, og budgetloftet ville
tælle for lavt. OpenAI-modellerne mangler priser, og derfor kan de ikke
vælges. Slås priserne op, åbner vejen af sig selv.
**Hvorfor det er bedre end et flag:** der er ikke noget, nogen skal huske at
fjerne, og der kan ikke opstå en tilstand, hvor en model kan vælges, men ikke
bogføres. Tjekket ligger BÅDE i UI'et og i ruten — det første er en
venlighed, det andet er sikkerheden.
**Bemærk:** dette dækker prisen, ikke afprøvningen. Punktet om at prøve
ChatGPT-vejen af står stadig på tjeklisten og skal lukkes særskilt.

**Modelskift kræver ikke nøglen igen.**
Egen handling i ruten, der hverken rører leverandøren eller koster en plads
i køen. Ellers ville et skifte fra Sonnet til Opus betyde, at brugeren skulle
finde sin nøgle frem.

**"Skift nøgle" er en ny indtastning, ikke en redigering.**
Vi kan ikke vise den gemte nøgle, og vil ikke — den findes kun krypteret og
som de fire sidste tegn. Et felt, der lod som om det viste nøglen, ville
være en løgn om, hvad vi opbevarer.

**Formularen står på STANDARDMODEL, ikke på den første i listen.**
Den stod først på Opus 5, fordi den er nævnt først i modellisten — og
modsagde dermed valget af Sonnet som standard (25.08.2026: hurtigere,
billigere, lige så god dansk). `standardValgbarModel` gør det ene sted til
det andet. Fanget under afprøvningen 02.09.2026.

**Nøgletest logges ikke i `usage_log`.**
Kaldet er på to tokens og siger intet om, hvad brugeren har skrevet. En linje
i forbrugsloggen pr. gemning ville gøre hendes eget forbrugsoverblik
sværere at læse, ikke lettere. Konsekvens: de få ører er usynlige i vores
egen opgørelse — de betales af brugerens konto, så det rammer ikke budgettet.

**Nøglen ryddes af browserens hukommelse, så snart den er sendt.**
Feltet tømmes ved svar. Den skal ikke ligge i en React-state resten af
besøget.

---

## 2026-09-02 — BYOK: kryptering og nøgletabel

**AES-256-GCM frem for Supabase Vault/pgsodium.**
CLAUDE.md regel 2 kræver, at valget lægges frem, første gang det bygges.
Sikkerhedsmæssigt er de to reelt ligeværdige her: begge holder nøglen
krypteret i databasen og dekrypterer kun server-side. Forskellen er, hvor
maskineriet ligger. AES-256-GCM er 40 linjer Node-kode, man kan læse og
forstå; Vault ville flytte krypteringen ind i SQL-funktioner og binde os
tættere til Supabase.
**Hvad det koster os:** `ENCRYPTION_KEY` skal findes i ethvert miljø, og den
må aldrig skiftes efter idriftsættelse. Sker det, kan ingen gemt nøgle læses
igen, og alle brugere skal indtaste deres på ny. Derfor står den nu også på
tjeklisten som noget, der skal sættes hos Vercel.

**GCM og ikke CBC.** GCM giver et autentificerings-tag, så en ændret krypteret
tekst bliver afvist i stedet for at blive dekrypteret til volapyk. Vi opdager
altså, hvis nogen har pillet ved rækken.

**Versionsnummer forrest i hver gemt værdi** — `v1.<iv>.<tag>.<tekst>`.
Skal algoritmen en dag skiftes, kan gamle rækker stadig læses, fordi de selv
siger, hvordan de blev lavet. Det koster fire tegn pr. række og sparer os for
at bede alle brugere om at indtaste nøglen igen.

**Én nøgle pr. bruger, ikke én pr. leverandør.**
Brugeren kan alligevel kun skrive med én ad gangen, og to gemte nøgler ville
kræve et ekstra valg af, hvilken der er den aktive — et valg, der skal vises,
forklares og huskes. Skifter hun leverandør, erstattes rækken.
**Hvad det koster os:** skifter hun frem og tilbage, skal nøglen findes frem
igen hver gang. Bliver det et reelt problem, er udvidelsen at fjerne
`unique`-betingelsen på `user_id` og tilføje et aktivt-flag.

**`model`-kolonne på `ai_keys` — en udvidelse af datamodellen.**
Datamodellen i CLAUDE.md nævner den ikke, og filen siger, at den kun udvides
efter aftale. Aftalt 02.09.2026: den valgte model hører til nøglen på samme
måde som leverandøren gør, og den skal gemmes et sted, når brugeren vælger
den i indstillinger.

**Den krypterede nøgle kan slet ikke læses gennem en login-forbindelse.**
`revoke select (encrypted_key) ... from authenticated, anon` tager kolonnen
fra igen, efter policyen har givet adgang til rækken. Indstillingssiden har
kun brug for leverandør, model og `key_hint`. Skal den krypterede tekst
hentes for at blive dekrypteret, sker det med `service_role` i server-kode —
og dér skal ejerskabet verificeres i hånden, jf. sikkerhedsreglernes punkt 6.
Værdien er ganske vist krypteret og ubrugelig uden `ENCRYPTION_KEY`; det
andet lag koster os én linje.

---

## 2026-08-30 — Trin 4: kladder

**To kopier, to forskellige opgaver.**
localStorage gemmer ved HVER ændring, koster ingenting og virker offline.
Serveren gemmer sjældnere, men overlever en ryddet browser og en anden
computer. Begge kopier bærer det SAMME id, som browseren laver med
`crypto.randomUUID()`, når briefen sendes af sted — ellers ville de to blive
til to kladder i stedet for én.

**sessionStorage blev til localStorage.** Den gamle forsvandt, når fanen blev
lukket. Det er billigt for os og dyrt for brugeren.

**Kun FÆRDIGE kladder sendes til serveren.**
Mens teksten streames, kaldes gemme-funktionen for hver bid — det ville blive
til hundredvis af kald om noget, der endnu ikke er værd at gemme. Og
gemningen venter to sekunder, efter brugeren er holdt op med at skrive, så et
tastetryk i meta-feltet ikke bliver til et databasekald.
**Kendt hul:** lukker hun fanen inden for de to sekunder, når serverkopien
ikke at blive skrevet. Kladden ligger stadig i browseren, så intet er tabt på
den maskine. Prisen for at lukke hullet ville være et kald pr. tastetryk, og
den er for høj.

**Udløbet ruller ved hver gemning.**
48 timer regnes fra SIDSTE rettelse, ikke fra den første. En kladde, man
arbejder på tredje dag, skal ikke forsvinde under hænderne på en. Regel 7
siger `now() + interval '48 hours'`, og det er præcis, hvad der sættes — bare
hver gang.

**RLS skjuler udløbne kladder i samme sekund, de udløber.**
Select-policyen har `expires_at > now()` med. Det er en sele ud over selerne:
oprydningsjobbet kører én gang i døgnet, og går det i stå, ville kladder
ellers kunne læses i dagevis efter, de var lovet slettet. **Løftet til
brugeren er 48 timer, og det løfte skal ikke afhænge af, at et natligt job
kørte.** Jobbet er dét, der gør sletningen ægte — forskellen på at overholde
regel 7 og at se ud som om.

**Ingen `service_role` i kladdekoden overhovedet.**
Alt går gennem brugerens egen forbindelse, så RLS afgør ejerskabet. Det er
sikkerhedsreglernes punkt 6 vendt om: i stedet for at omgå RLS og huske et
manuelt ejer-tjek, lader vi databasen sige nej. Der er ikke noget tjek, der
kan glemmes, fordi der ikke er noget tjek.
Sletning sker derfor uden ejer-betingelse i koden: et id, brugeren ikke ejer,
rammer ingenting.

**Den rå strøm fra modellen gemmes ikke på serveren.**
`tekst` er kun interessant, mens teksten bliver skrevet, og den fylder det
samme som den færdige tekst en gang til. Serverkopien indeholder briefen,
den sanerede HTML, blokkene og meta-felterne.

**Browserkopien udløber nu også — fundet ved afprøvning.**
Serverkopien blev usynlig i samme sekund, den udløb, og dashboardet viste
rigtigt "ingen kladder". Men åbnede man `/app/skriv` bagefter, stod teksten
der endnu: browserkopien levede evigt.
**Serveren holdt sit løfte, browseren gjorde ikke.** "Intet gemmes permanent"
er produktets kerneløfte, og det gælder også den kopi, der ligger på
brugerens egen maskine. localStorage-kladden bærer nu sit eget udløb, sat af
gemme-funktionen (ikke af den, der kalder den, så det ikke kan glemmes ét
sted), og en udløbet kopi bliver SLETTET ved næste opslag — ikke bare skjult.
Værd at bemærke: fejlen var kun synlig, fordi udløbet blev afprøvet med vilje.
Den ville ellers først være dukket op to døgn efter lancering.

**Sletning fjerner også kopien i browseren.**
Ellers ville en slettet kladde dukke op igen, næste gang `/app/skriv` blev
åbnet — og en app, der genopliver noget, man har slettet, er skræmmende.

**GDPR:** `drafts` har `on delete cascade` mod `auth.users` som de andre
tabeller, så "slet min konto" tager kladderne med. Det er det eneste sted i
hele appen, hvor tekstindhold overhovedet ligger.

---

## 2026-08-30 — Word-eksport, og trin 3 er færdig

**Ny afhængighed: `docx`.** Standardvalget ifølge det tekniske oplæg, afsnit 8,
og der er ikke fundet grund til at vælge om. Word-filen bygges server-side;
browseren kan ikke lave en .docx selv.

**Ruten har hverken kvote, budgetloft eller rate limit — og det er med vilje.**
Tjekkene i CLAUDE.md regel 6 gælder alt, der KOSTER PENGE. Her kaldes ingen AI:
filen bygges af tekst, brugeren allerede har fået og betalt for.
Login kræves stadig. Ikke fordi det koster noget, men fordi resten af appen er
lukket, og en åben rute ville være et hul, ingen havde besluttet.

**Teksten sendes fra browseren, ikke hentet fra databasen.**
Det ser omvendt ud, men følger direkte af "intet gemmes permanent": serveren
HAR ikke en kopi at hente. Blokkene blev saneret, dengang de blev skrevet, og
saneres ikke igen — de bliver aldrig vist som HTML, kun læst som tekst, når
Word-afsnittene bygges.

**Ingen skrifttype sættes i filen.**
Designsystemet gælder appen, ikke brugerens dokumenter. Word bruger nu
modtagerens egen standard, og filen ser ud som alt andet, hun skriver. En
skrifttype, hun ikke har installeret, ville alligevel blive skiftet ud — bare
uden at hun opdagede det.

**Meta-felterne kommer med til sidst i filen, adskilt af en streg.**
De hører ikke til i teksten og skal i to felter i et CMS. Men de er en del af
det, hun har fået lavet, og en Word-fil uden dem ville betyde, at hun skulle
have appen åben ved siden af for at samle det hele.

**To små ting, der kostede mest tid, og som er værd at huske:**
Nummererede lister i Word kræver en opskrift på, HVORDAN der tælles
(`numbering.config`). Uden den står punkterne uden numre, og det opdages først,
når filen åbnes.
Og sættes både `bold: false` og `italics: true` på samme stykke tekst, skriver
`docx` en udtrykkelig "ikke fed" ud i filen. Det virker, men det fylder
dokumentet med støj. Sæt kun den egenskab, der faktisk gælder.

**Filnavnet afkortes ved sidste hele ord.**
Første udgave klippede hårdt ved 60 tegn og gav
"...inden-vinteren-melde.docx". Et filnavn, der slutter midt i et ord, ser ud
som om noget er gået galt — og filen ligger i brugerens mappe længe efter, hun
har glemt hvorfor.

**Dermed er trin 3 færdig:** blokke, meta-titel og -beskrivelse, omskrivning af
ét afsnit ad gangen, og eksport som HTML, HTML uden titel, Markdown og Word.
Næste trin er 4: kladder med localStorage-autosave, `drafts`-tabellen med 48
timers udløb og pg_cron-jobbet, der rydder op om natten.

---

## 2026-08-30 — Eksemplerne i prompten kunne lånes

**Tredje gang samme fejl på én dag.** Værd at skrive tydeligt ned, fordi den
kommer igen: **alt hvad en prompt viser frem, bliver efterlignet — også det,
den udtrykkeligt advarer imod.**

De tre tilfælde:
1. Lange tankestreger. Prompten forbød dem og var selv fuld af dem.
2. Meta-pladsholderne. "META-TITEL: titlen til søgeresultatet" med lille
   begyndelsesbogstav gav to felter med lille begyndelsesbogstav.
3. Denne: reglen mod "ikke X, men Y" brugte eksemplet "Det skyldes ikke
   bekvemmelighed, men fysik", og rettelsen hed "Det skyldes, at malingen ikke
   hærder, når det er koldt". Begge fra malerbranchen, altså samme branche som
   testbriefen. Modellen skrev så, i en rigtig tekst: "Det er ikke af
   bekvemmelighed, det er fordi malingen ikke hærder ordentligt."
   **"Bekvemmelighed" er ikke almindeligt dansk.** Ordet kom fra forbuddet.

**Rettelsen er todelt.** Eksemplerne er nu skabeloner med pladsholdere i
kantede parenteser, så der ikke er ord tilbage at låne. Og prompten siger
udtrykkeligt, at et eksempel viser en FORM og ikke et ordforråd, og at intet
ord fra et eksempel må genbruges. Listen over forbudte vendinger har fået
samme forbehold: den er en forbudsliste, ikke inspiration.

**Regel til den, der redigerer prompten herefter:** skriv aldrig et
eksempel med ord, der kunne passe ind i en rigtig tekst om emnet. Enten
pladsholdere, eller et emne der ligger så langt fra brugerens som muligt.

**Det virkede kun halvt, og resten er en anden fejl.**
Efter rettelsen er "bekvemmelighed" væk og modsætningsfiguren væk i sin
direkte form. Men modellen skrev i stedet: "Vedligeholdelse af trævinduer
handler ikke om at gøre det pænt. Det handler om at holde fugten ude."
Det er samme figur delt over to sætninger. Prompten forbyder "det handler
ikke kun om X, det handler om Y", og modellen har fundet den variant, forbuddet
ikke nævner.
**Det er ikke et lånt ordforråd, det er en for snæver regel** — altså en anden
fejl end den, der lige er rettet. Ejeren har set den og afgør, om reglen skal
udvides til også at dække figuren delt over to sætninger. Sat på tjeklisten.

---

## 2026-08-30 — Omskrivning af afsnit og eksport

**At skrive ét afsnit om koster IKKE en prøvetekst.**
Ejerens beslutning. Begrundelsen: brugeren har allerede betalt for teksten, og
at rette i den er en del af at gøre den færdig. Fem prøvetekster ville
forsvinde på den første artikel, hvis to rettelser kostede to af dem — og så
får den nye bruger aldrig set, hvad værktøjet kan.
**Konsekvensen skulle dækkes ind.** Prøvekvoten var indtil nu dét, der holdt
den ENKELTE bruger i skak. Er afsnit gratis, er den bremse væk, og så kan én
bruger tømme dagens budget ved at klikke løs. Derfor blev rate limit'en bygget
samtidig, og ikke i trin 6 som planlagt. Rækkefølgen var ikke til at vælge om:
den ene beslutning skabte behovet for den anden.

**Rate limit ligger i databasen, ikke i hukommelsen.**
Appen kører på Vercel, hvor hvert kald kan ramme sin egen instans. Et tal i
hukommelsen ville tælle hver instans for sig og dermed tillade mange gange for
meget — en af de fejl, der ser ud til at virke lokalt og ikke gør live.
Tællingen bruger en rådgivende lås pr. bruger. Uden den kunne to samtidige
kald begge nå at tælle "to forsøg indtil videre" og begge få lov. Samme slags
fejl som ved prøvekvoten, hvor svaret var at lade databasen afgøre sagen.
Gamle rækker ryddes ved hvert kald, så tabellen aldrig bliver større end det
vindue, den skal huske, og der ikke er et natligt job at vedligeholde.

**Rate limit'en står FØR kvoten i rækkefølgen.**
CLAUDE.md nummererer tjekkene (a) login, (b) kvote, (c) rate limit, (d) budget.
I koden kommer (c) før (b). Grunden er praktisk: reserveres prøveteksten
først, skal den gives tilbage igen, hver gang nogen bliver bedt om at vente et
minut. Bogstaverne er reglens, rækkefølgen er vores, og det står skrevet i
ruten, så den næste ikke tror, det er en fejl.

**Systemprompten ophæves delvist ved omskrivning — som SYSTEM-instruktion.**
Skabelonens prompt kræver META-linjer og en hel artikel. Ved omskrivning skal
der hverken være meta eller mere end ét afsnit. Tillægget (`OMSKRIV_TILLAEG`)
lægges derfor efter systemprompten, ikke i brugerbeskeden: det er vores egen
instruktion og hører til på systemets side af skellet i CLAUDE.md regel 5.
Det siger udtrykkeligt HVILKE to punkter der ændrer sig. Ellers kunne "noget
af formatet er til forhandling" smitte af på resten.

**Brugerens ønske til afsnittet er den mest udsatte tekst i hele appen.**
Det er et frit felt, der bliver sendt direkte til modellen sammen med en
instruktion om at ændre noget. Det ligger derfor i sin egen afgrænsede blok
med sin egen markør, renses for linjer der ligner en markør, er begrænset til
500 tegn, og prompten siger udtrykkeligt, at ønsket handler om INDHOLD og ikke
kan ændre regler, sprog eller format.

**Efter en omskrivning deles hele teksten op på ny.**
Svaret erstatter blokkens HTML, hvorefter alt samles og køres gennem
`delIBlokke` igen. Hvis modellen svarede med to sektioner i stedet for én,
bliver de til to blokke med rigtige numre — frem for at én blok stille og
roligt kom til at indeholde noget andet, end dens navn siger.

**Kun ét afsnit ad gangen.** To samtidige omskrivninger ville skrive oven i
hinandens blokke, og brugeren ville ikke kunne se, hvilket svar der hørte til
hvad. De andre knapper er slået fra imens.

**Markdown-konverteringen er skrevet selv, og det er forsvarligt.**
CLAUDE.md regel 4 forbyder at skrive sin egen SANERING. Det her er ikke
sanering: konverteringen kører på HTML, der ALLEREDE er saneret server-side,
så tagsene er præcis dem fra hvidlisten og intet andet. Den beskytter ikke mod
noget og må derfor heller ikke være det eneste, der gør det. Filen siger det
selv, øverst.

**Dobbelt H1 er løst og taget af tjeklisten.**
"Kopiér uden titel" springer titelblokken over. Laver brugerens CMS selv
sidens overskrift, får siden nu kun én h1. Der står en linje under knapperne,
som forklarer hvornår man vælger hvad — det er ikke til at gætte.

---

## 2026-08-30 — Budgetloftet, trukket frem fra trin 6

**Bygget nu og ikke i trin 6, fordi genereringen er gået live.**
Byggeplanen lægger kvote, forbrugslog, rate limit og budgetloft samlet i trin
6. Prøvekvoten blev allerede trukket frem, da `/api/generate` blev bygget, med
samme begrundelse som her: CLAUDE.md regel 6 kalder det ufravigeligt, at alt
der koster penge går gennem serveren med tjek af budget. Og siden ejerkontoens
kvote står på 1.000.000, var der reelt ingen bremse tilbage.
**`usage_log` kom med af nødvendighed.** Et loft skal vide, hvad der er brugt
i dag, og der var ikke noget at måle imod. Tabellen er den fra datamodellen i
CLAUDE.md, feedback-felterne inklusive, så trin 6's feedback-widget har et sted
at skrive hen. Kun metadata og tal — aldrig et ord af briefen eller teksten.

**Loftet fejler LUKKET.**
Kan dagens forbrug ikke læses, eller mangler `DAILY_BUDGET_DKK`, genererer vi
ikke. Samme afvejning som i `lib/kvote.ts`: kan vi ikke føre regnskab, bruger
vi ikke penge.
**Vær opmærksom på prisen for den beslutning:** glemmes variablen hos Vercel,
holder genereringen op med at virke live, og brugeren får "der er noget galt i
vores opsætning". Det er stadig det rigtige valg — en åben pengekasse, ingen
opdager, er værre end en fejl, alle opdager. Sat på tjeklisten.

**Loftet er bagudskuende, og det kan overskrides.**
Prisen på et kald kendes først, når kaldet er færdigt, så tjekket spørger til
det, der ALLEREDE er brugt. Sættes ti genereringer i gang i samme sekund, kan
de alle sammen nå forbi et loft, der er ved at være nået. Overskridelsen er
højst nogle få tekster.
Fravalgt: at reservere et beløb på forhånd, som man ikke kender. Det ville
kræve et skøn over outputlængden, en reservation og en frigivelse bagefter —
tre nye steder at tage fejl for at fange nogle få kroner.

**Dagen er en dansk dag.**
`platform_forbrug_i_dag()` regner fra midnat i Europe/Copenhagen, ikke fra
midnat UTC. Ellers ville loftet nulstille sig klokken 01 eller 02 om natten
dansk tid, og en aftens forbrug ville blive delt over to budgetter.

**Priserne står i `lib/ai/modeller.ts`, hos modellen selv.**
Prisen hører til modellen på samme måde som navnet, og filen er i forvejen det
eneste sted, modelnavne står. Mangler prisen, returnerer `beregnPrisDkk` null
— ikke 0. **Forskellen er vigtig:** 0 betyder "det var gratis", null betyder
"vi ved det ikke". Ved null logges kaldet med 0 kr. OG der skrives en fejl i
serverloggen, for så tæller loftet for lavt. OpenAI-modellerne står uden pris
og må derfor ikke vælges endnu. Sat på tjeklisten.

**Kursen er en konstant på 7 kroner pr. dollar, sat bevidst for højt.**
Den rigtige kurs ligger lavere. Et loft skal hellere ramme lidt for tidligt end
for sent, og et rundt tal er nemmere at regne efter i hovedet, når man sidder
med loggen. Skal det være præcist en dag, hører det til et sted, der kan hente
en rigtig kurs — ikke i en konstant.

**Hvad loftet på 200 kr. faktisk svarer til:** cirka 1.100 mellemlange tekster
om dagen med Sonnet 5. Det er rigeligt til lukket test og formentlig for højt
sat til en åben lancering. Tallet er nemt at skrue på, nu hvor der findes en
log at træffe beslutningen ud fra.

**Advarslen om prøvetekster vises ikke, hvor den ikke passer.**
"Bemærk: hvert forsøg bruger én af dine prøvetekster" stod under alle
fejlbeskeder. Under budgetfejlen var den forkert: afvisningen sker FØR kaldet,
så et nyt forsøg koster ingenting. Samme gælder, når der slet ingen nøgle er
at skrive med. Fejlens årsag følger nu med til klienten, så de to tilfælde kan
kendes fra de andre.
Grunden til at det er værd at rette noget så småt: en app, der advarer om
noget, der ikke sker, er sværere at stole på næste gang den advarer. Og her
handler advarslen om penge.

**Rate limit pr. bruger mangler stadig** (punkt c i regel 6). Budgetloftet
fanger det samlede forbrug, men ikke én bruger, der klikker tredive gange på
et minut. Sat på tjeklisten.

---

## 2026-08-30 — Trin 3: blokke og meta-felter

**Meta-titel og meta-beskrivelse skrives som to tekstlinjer, ikke som JSON.**
Modellen svarer nu:

```
META-TITEL: Mal trævinduerne inden vinteren
META-BESKRIVELSE: Maling hærder ikke under 10 grader ...
<h1>Sådan holder du trævinduerne tætte</h1>
```

Det oplagte valg ville være et JSON-objekt med tre felter. Fravalgt, fordi
svaret streames: et JSON-objekt kan først læses, når det sidste tegn er
skrevet, mens to linjer i starten kan sendes videre efter et sekund. Brugeren
ser meta-felterne stå udfyldt, længe før teksten er færdig.
**Grænsen mellem meta og artikel er det første `<`.** Bevidst en dum regel:
den kan ikke gå i stykker af et manglende kolon, en ekstra tom linje eller en
model, der skriver "META-TITEL" med småt. Prompten forbyder til gengæld
udtrykkeligt tegnet `<` i del 1.

**Starten af strømmen holdes tilbage, til meta-linjerne er hele.**
Ellers ville brugeren se "META-TITEL:" blinke øverst i sin tekst og forsvinde
igen. Det koster omkring et sekund. Sikringen er et loft på 600 tegn: skriver
modellen så meget uden at begynde på HTML'en, har den ikke fulgt formatet, og
så vises det, den skrev, frem for ingenting.
Bemærk konsekvensen for kvoten: `harSendtTekst` tæller de tegn, KLIENTEN har
fået — ikke dem, modellen nåede at skrive. Går det galt i det første sekund,
er skærmen tom, og så gives prøveteksten tilbage, selvom kaldet kostede
penge. Det er med vilje den vej rundt.

**Teksten deles i blokke ved overskrifterne.**
h1 bliver titelblokken, alt før den første h2 bliver indledningen, og hver h2
starter en sektion. En h3 hører til den sektion, den står i. Blokkene er
fundamentet for at kunne regenerere ét afsnit uden at betale for resten, og
de er samtidig svaret på, hvorfor titlen ikke længere sidder klistret fast i
brødteksten.
**Rækkefølgen er ufravigelig: sanér FØRST, del bagefter.** Blokkenes HTML går
direkte i `dangerouslySetInnerHTML`, så en opdeling af usaneret HTML ville
være en bagvej udenom CLAUDE.md regel 4.

**Meta-felterne kan rettes af brugeren.**
De er indtastningsfelter, ikke visninger. Modellens forslag er et forslag.
Rettelserne gemmes i kladden i sessionStorage sammen med resten, så en
genindlæsning ikke koster en ny prøvetekst.
Tegntællerne (60 og 160) er vejledende, ikke en spærring. Det er målte tal
for, hvor Google typisk klipper af — ikke regler fra Google — og så skal de
heller ikke opføre sig som regler.

**Pladsholderne i prompten skal se ud som det, de skal blive til.**
Formatet stod første gang som "META-TITEL: titlen til søgeresultatet". Begge
felter kom retur med lille begyndelsesbogstav: "mal trævinduerne, før vinteren
tager fat". Modellen efterlignede pladsholderen, ikke reglen — samme lærdom
som med de lange tankestreger, bare et andet sted. **Alt hvad prompten viser
frem, bliver kopieret, også det man selv opfattede som en forklaring.**
Rettet til "Her står titlen til søgeresultatet" plus en udtrykkelig regel om
stort begyndelsesbogstav.
Bemærk at fejlen blev fundet, fordi teksten blev læst efter i browseren og
ikke bare på skærmen: to felter i træk med lille bogstav er ikke noget, en
model gør tilfældigt.

**Den mekaniske oprydning af tankestreger gælder nu også meta-felterne.**
`normaliserTypografi` kørte kun inde i `sanerHtml`, og `sanerHtml` ser kun
artiklen. En lang tankestreg i meta-titlen ville altså være sluppet forbi den
sikring, der findes netop for at fange det, prompten ikke fanger — og
meta-titlen er dét, en fremmed læser først får øje på. Oprydningen ligger nu
også i `lib/tekst/meta.ts`.

**`t.raw()` frem for `t()` til tekster med pladsholdere.**
Værd at kende: next-intl tolker krøllede parenteser i en sprogfil som ICU-
pladsholdere og fejler, hvis man henter teksten uden at udfylde dem. Tallene
i "{antal} af {loft} tegn" kendes først i browseren, og derfor hentes de to
tekster råt på serveren og udfyldes i klienten.

---

## 2026-08-25 — Sonnet 5 valgt, og tre rettelser i sproget

**Sonnet 5 beholdes.** Ejerens vurdering efter at have læst begge tekster:
sproget er lige så godt. Dermed sparer hver tekst 43 %, og længden "mellem"
kommer ned på 41 sekunder. `STANDARDMODEL.anthropic` er ikke længere "under
afprøvning".
Bemærk konsekvensen: **fast mode findes kun på Opus**, så den udvej er nu
lukket. Skal den lange tekstlængde beholdes, er opdelt generering i trin 3
vejen (se afsnittet nedenfor).

**Lange tankestreger forbudt, og fjernet fra prompten selv.**
Ejerens observation: den lange tankestreg (—) læses som maskinskrevet.
Det interessante var, hvor den kom fra: systemprompten var selv fuld af dem,
og valg-etiketterne ("Kort — ca. 400 ord") sendes med ind i brugerbeskeden.
En model efterligner det sprog, den får. Det havde derfor ikke hjulpet bare
at forbyde dem.
Nu er de fjernet fra prompt, etiketter og eksempeltekst. Kun ét sted står
tegnet tilbage: den regel, der navngiver det.
**Og så en mekanisk sikring oveni** (`lib/tekst/typografi.ts`): alle lange
tankestreger laves om til almindelige, efter modellen har svaret. Modeller er
notorisk dårlige til netop dén slags forbud, og en enkelt sluppen igennem er
nok til at afsløre teksten. Reglen gør det sjældent, oprydningen gør det
aldrig.
Rækkefølgen er vigtig: typografien ryddes op FØRST, saneringen kører SIDST,
så sanitize-html er det sidste, der rører teksten.

**To navngivne sætningsmønstre forbudt.**
Ejerens eksempler var to forskellige fejl, og begge kan navngives:
1. Verbum lavet om til navneord, især i overskrifter: "Hvad venten reelt
   koster" i stedet for "Hvad er risikoen ved at vente?"
2. Modsætningsfiguren "ikke X, men Y": "Det skyldes ikke bekvemmelighed, men
   fysik" er skriftsprog, ingen siger højt.
Prompten har fået begge med konkrete før/efter-eksempler, plus den
overordnede regel: kunne du sige sætningen til en kunde henover et
køkkenbord uden at lyde som en brochure?

**H1 tilladt igen.**
Var udtrykkeligt forbudt ud fra den antagelse, at et CMS selv sætter sidens
overskrift. Det var teknisk rigtigt og i praksis forkert: brugeren sad med en
tekst uden titel. h1 er nu på hvidlisten, og prompten kræver præcis én som
første element.
**Den oprindelige bekymring er ikke forsvundet:** indsættes teksten i et CMS,
der selv laver sidens titel til h1, får siden to. Det er dårlig SEO, og det
strider mod de Google-regler, vi lige har skrevet ind. Løsningen hører til
trin 3, hvor meta-titlen bliver sit eget felt. Sat på tjeklisten.

---

## 2026-08-25 — Sonnet 5 mod Opus 5: tallene

Samme brief, samme prompt, samme dag.

```
Opus 5    planlægning 1.574 ms · skrivning 52.739 ms · i alt 54.313 ms · 2.819 ind / 2.198 ud
Sonnet 5  planlægning 1.794 ms · skrivning 39.555 ms · i alt 41.349 ms · 2.819 ind / 2.039 ud
```

| | Opus 5 | Sonnet 5 |
|---|---|---|
| Skrivehastighed | 42 tokens/sek. | 52 tokens/sek. |
| Tid, længden "mellem" | 54 sek. | 41 sek. |
| Pris pr. tekst | ca. $0,069 | ca. $0,039 |

Sonnet er 24 % hurtigere og 43 % billigere. Teksterne er næsten lige lange
(2.198 mod 2.039 tokens), så sammenligningen er fair.
Bemærk: Sonnet 5 kørte på introduktionspris indtil 31.08.2026. Tallet ovenfor
er den normale pris, ikke introprisen.

**RETTELSE (30.08.2026): priserne ovenfor er forkerte.** Sonnet 5 koster
$2/$10 pr. million tokens, ikke $3/$15 — $3/$15 er Sonnet 4.6's pris, som blev
forvekslet med Sonnet 5's. De rigtige tal: Opus 5 koster 0,48 kr. pr.
mellemlang tekst, Sonnet 5 koster 0,18 kr. Sonnet er altså ikke 43 % billigere,
men **62 %** billigere. Konklusionen bliver ikke svagere af rettelsen, kun
stærkere. Slå priser op, skriv dem ikke ned efter hukommelsen — de står nu i
`lib/ai/modeller.ts`, hvor koden selv regner på dem.

**Sonnet løser IKKE den lange tekstlængde.** 1.400 ord ≈ 3.600 tokens, hvilket
ved 52 tokens/sek. bliver omkring 72 sekunder — stadig over de 60. Håbet var
en fordobling af hastigheden; det blev en fjerdedel.
Og vær opmærksom: **fast mode findes kun på Opus-modellerne.** Vælges Sonnet,
er den udvej lukket.

**Sprogvurderingen er ejerens og er ikke truffet her.** Tallene afgør ikke
sagen — spørgsmålet er, om Sonnet stadig bruger de konkrete detaljer fra
briefen (sæson, rådskader i bundstykket, fast pris) eller falder tilbage på
almindeligheder. Det er dér, forskellen på en dyr og en billig model plejer
at vise sig.

**Fire veje for den lange tekstlængde, hvis den skal beholdes:**
1. **Opdelt generering (den foretrukne).** I trin 3 deles teksten alligevel i
   blokke med regenerering pr. sektion. Med den arkitektur kan en lang artikel
   skrives sektion for sektion: først en disposition, så hvert afsnit som sit
   eget kald. Hvert kald ligger langt under grænsen, brugeren ser teksten
   vokse, og det koster hverken abonnement eller højere tokenpris. Taler for
   at lade "langt" vente til trin 3 frem for at betale sig ud af det nu.
2. Vercel Pro (ca. $20/md.) — løser det formelt, men brugeren venter stadig
   72 sekunder på ét kald.
3. Opus 5 med fast mode — dobbelt tokenpris, ca. 35 sekunder, uændret sprog.
4. Fjern "langt" indtil videre. Ingen savner det, de ikke er blevet lovet.

---

## 2026-08-25 — Målingen: effort var den forkerte knap

**Tallene fra første måling:** planlægning 1.574 ms · skrivning 52.739 ms ·
i alt 54.313 ms · 2.819 tokens ind, 2.198 ud.

**`effort` sat tilbage til "medium".** Beslutningen om at sænke den til "low"
tidligere i dag byggede på en antagelse, målingen modbeviste: planlægningen
er under 2 sekunder, altså 3 % af tiden. `effort` købte os omkring 6 sekunder
og kostede tekstkvalitet. Dårlig handel.

**Den rigtige flaskehals er, hvor hurtigt modellen kan producere ord.**
Claude Opus 5 skriver omkring 42 tokens i sekundet, og det tal er stort set
fast. Regnestykket for teksttyperne:
- kort (400 ord ≈ 1.100 tokens) → ca. 26 sekunder
- mellem (800 ord ≈ 2.200 tokens) → ca. 53 sekunder
- lang (1.400 ord ≈ 3.800 tokens) → ca. 90 sekunder

Den lange tekstlængde kan altså ALDRIG nå i mål inden for 60 sekunder på
Opus 5. Det er ikke noget, kode kan fikse.

**Lærdom værd at tage med:** mål, før du drejer. Havde vi ikke lagt en
tidsmåling i `/api/generate`, ville vi have skruet videre ned på `effort` —
tabt kvalitet og aldrig løst problemet. Målingen står stadig i loggen og
koster ingenting.

**Tre veje forelagt ejeren; han valgte at afprøve Claude Sonnet 5 først.**
Sonnet 5 skriver hurtigere og koster cirka det halve ($3/$15 mod $5/$25 pr.
million tokens). Det er samtidig præcis den modelbeslutning, det tekniske
oplæg lagde i trin 2 ("afgøres af en dansk-kvalitetstest"). Fravalgt indtil
videre: fast mode på Opus 5 (2,5 gange hurtigere, dobbelt pris, research
preview) og et højere `maxDuration` (kræver Vercel Pro og gør ikke noget
hurtigere — brugeren venter bare lovligt).
`STANDARDMODEL.anthropic` står derfor på `claude-sonnet-5` mærket "under
afprøvning". Holder dansken ikke, sættes den tilbage, og så er fast mode
næste skridt.

**`fallbacks` sættes nu kun på Opus-modellerne.**
Sikkerhedslinen er dokumenteret til Opus- og Fable-modellerne, og det var
uvist, om Sonnet 5 ville acceptere parameteren. Begge modeller er afprøvet
med den kaldsform, appen bruger, og svarer som de skal.

---

## 2026-08-25 — Fri afprøvning

**Ejerkontoens prøvekvote sat til 1.000.000.**
Ejerens beslutning. Prompten skal finpudses over flere runder, og med fem
prøvetekster ville han stå fast — BYOK-vejen er ikke bygget endnu, så der er
ingen anden vej videre, når kvoten er brugt.
**Vær opmærksom på hvad det betyder:** kvoten var det ENESTE, der begrænsede
forbruget på platformens nøgle. Rate limit og `DAILY_BUDGET_DKK` hører til
trin 6 og findes ikke. For ejerkontoen er der nu ingen bremse i appen — kun
det loft, der måtte være sat hos Anthropic. Det er sat på tjeklisten.

**Kvoteændringen fik ikke sin egen migrationsfil.**
Det er en afvigelse fra "databaseændringer skal altid i en migrationsfil", og
begrundelsen er regel 9: en migrationsfil, der peger på én konto, skal
indeholde enten en mailadresse eller et bruger-id, og filen ligger på GitHub.
Persondata i et offentligt repo er en dårligere handel end en ændring, der
kun er dokumenteret her. Reglen gælder fortsat for skema og for indhold, der
er ens for alle — det er dét, den er til for.

**Eksempeltekst i brief-felterne — som data, ikke som kode.**
Nyt `standard`-felt i `templates.input_fields`, brugt som `defaultValue` i
formularen. Ejeren skal kunne teste uden at skrive en brief hver gang.
Eksemplet ligger i skabelonen, ikke i formularens kode, så en ny teksttype
selv bestemmer sit eget eksempel — på samme måde som den bestemmer sine
felter.
Eksemplet er bevidst konkret (et malerfirma i Brønderslev, med sæson,
prisform og hvor rådskaderne starter). En tynd brief ville kun vise, om
modellen kan finde på; en fyldig viser, om den holder sig til det, den fik.
Bemærk bagsiden: forudfyldte felter er godt til test og dårligt til rigtige
brugere, der vil sende eksemplet af sted som deres eget. Se tjeklisten.

---

## 2026-08-25 — Efter første rigtige tekst

Den første generering kørte igennem på 61 sekunder og afslørede tre ting.

**Sanering og formateret visning trukket frem fra trin 3.**
Trin 2 lagde op til "rå tekst på skærmen", og det var teknisk korrekt — men
ejeren kunne ikke vurdere dansk kvalitet, mens han læste `<h2>`-koder. Og at
vurdere kvaliteten ER hele pointen med trin 2. Så `/api/generate` sanerer nu
teksten server-side, når streamen er slut, og sender den færdige HTML som en
`faerdig`-hændelse. Kun DEN version vises som HTML.
Sådan forenes streaming og CLAUDE.md regel 4: man kan ikke sanere et halvt
HTML-tag, så under streamen vises den rå tekst SOM TEKST (React escaper den),
og først når teksten er hel, saneres den og vises som HTML. Skriv det videre
til trin 3, hvor teksten skal deles i blokke — dér skal hver blok saneres,
når den er hel, ikke pr. bid.
Hvidlisten er verificeret mod `<script>`, `onclick`, `img onerror`, `iframe`,
`javascript:`- og `data:`-links. Alle bliver fjernet; gyldigt indhold består.
Ny afhængighed: `sanitize-html` (påbudt af regel 4 — skriv aldrig egen).

**Prompten skærpet: floskler og Googles retningslinjer.**
Ejerens krav efter at have læst den første tekst. To nye afsnit i
systemprompten: en navngiven liste over forbudte danske AI-vendinger ("I en
verden hvor", "når det kommer til", "sidst men ikke mindst" …) plus forbudte
mønstre (indledning der gentager overskriften, retoriske spørgsmål,
tre-ting-remser), og et afsnit om Googles krav til indhold.
**Vigtigt for den, der redigerer prompten senere:** forkortelser som E-E-A-T
og "helpful content" ændrer ikke, hvad en sprogmodel skriver. Den kender
ordene, men de er for abstrakte til at styre output. Retningslinjerne er
derfor oversat til konkrete instruktioner — ikke "overhold E-E-A-T", men
"skriv aldrig 'eksperter anbefaler', hvis du ikke kan sige hvilke". Gør det
samme, når der skal tilføjes regler.

**`effort` sænket fra "medium" til "low" — og tiden bliver nu målt.**
61 sekunder for en tekst på 800 ord er mere end de 60, `maxDuration` giver os.
Lokalt håndhæves loftet ikke, så teksten nåede at blive færdig; på Vercel
ville den være klippet over midt i en sætning. Den lange tekstlængde ville
være håbløs.
`effort` er den tid, modellen bruger på at planlægge, FØR den skriver — den
del kan skæres, uden at selve skrivningen bliver dårligere pr. sætning.
Samtidig logger `/api/generate` nu, hvor tiden går: planlægning kontra
skrivning, plus tokens ind og ud. Kun tal — aldrig noget af teksten.
Er planlægningen stadig det dyre, hjælper det at sænke `effort` yderligere.
Er det selve skrivningen, er den eneste vej et højere `maxDuration`, og så er
det et spørgsmål om Vercel-abonnement — altså penge, ikke kode.

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
