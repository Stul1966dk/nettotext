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
- [ ] **Afklar dobbelt H1 — halvvejs løst.** Meta-titlen er nu sit eget felt, og h1 er sin egen blok på skærmen, så de to ting ikke længere forveksles. Tilbage står selve kopieringen: "Kopiér HTML" tager stadig hele teksten med titlen. Laver brugerens CMS selv sidens overskrift, får siden to h1'er. Løses i eksport-delen af trin 3 med en "kopiér uden titel"-mulighed.
- [ ] **Sæt ejerkontoens prøvekvote tilbage.** Den står på 1.000.000 for at kunne teste frit under udviklingen. Beslut inden lancering, om ejerkontoen fortsat skal være speciel — og hvis ikke, sæt den til 5 som alle andre.
- [ ] **Fjern eksempelteksten fra brief-felterne**, eller lav den om til en "Udfyld med eksempel"-knap. Felterne i `templates.input_fields` er forudfyldt med et malerfirma i Brønderslev. Det er praktisk under test, men rigtige brugere vil sende eksemplet af sted som deres egen brief uden at opdage det.
- [ ] **Sæt et forbrugsloft på platformens AI-nøgle hos Anthropic.** Så længe `DAILY_BUDGET_DKK` ikke er bygget (trin 6), er leverandørens eget loft det eneste, der står mellem en fejl og en stor regning.
- [ ] **Prøv ChatGPT-vejen af, før nogen får lov at vælge den.** `lib/ai/openai.ts` er skrevet, men aldrig kørt — platformens nøgle er en Anthropic-nøgle, så OpenAI-siden kan først testes, når der findes en OpenAI-nøgle at teste med. Lad ikke brugerne vælge ChatGPT i indstillinger, før mindst én tekst er skrevet den vej.
- [ ] **Tjek at lange tekster når at blive færdige.** `/api/generate` har `maxDuration = 60`. Vercels loft afhænger af abonnement. Timer "Langt — ca. 1.400 ord" ud i produktion, er der to knapper: hæv `maxDuration` (kræver det rigtige abonnement), eller sænk `effort` i `lib/ai/anthropic.ts`.
- [ ] **Privatlivspolitik** på `/da/privatliv` (GDPR, jf. teknisk oplæg afsnit 5).
- [ ] **Opdatér brandnavnet** i `design/design-3-vaerksted.html` til NettoText.

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
er den normale pris ($3/$15 pr. million), ikke introprisen.

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
