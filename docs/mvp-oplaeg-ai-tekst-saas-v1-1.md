# MVP-oplæg v1.1: Dansk AI-tekstplatform (SaaS)

*Arbejdstitel: [sidensnavn] — domæne: `.com` (eller `.ai`), marketing-sider under `/da/`, appen bag login med sprog som brugerindstilling.*

**Ændringer siden v1.0:** Gratis-først-strategi med stram kvote, URL-/sprogstrategi afklaret, brugerdefinerede prompts i tre niveauer, skabelonarkitektur der forbereder branchepakker, server-kladder med TTL fra start, målgruppe og tech-stack fastlagt.

---

## 1. Vision og positionering

En dansk SaaS, hvor brugeren kan **generere nye webtekster** (blogindlæg, produkttekster, brandtekster m.fl.) og **opdatere eksisterende tekster** — med preview og eksplicit godkendelse, før noget forlader systemet.

**Målgruppe (fastlagt):** Mindre erhvervsdrivende, små iværksættere og andre uden adgang til en marketingafdeling. Det betyder: enkel UX frem for feature-dybde, én brand-profil pr. bruger i starten, kvotepris pr. måned, og multi-site/bureau-funktioner kan vente til V3.

**Differentiator:** Dansk sprogkvalitet. De internationale konkurrenter (RightBlogger, Article Forge, ArticleGenerator) skriver teknisk set dansk, men tonen og idiomatikken halter. En platform bygget *til* dansk — med danske skabeloner, dansk SEO-forståelse og dansk UI — har en reel niche, præcis som neuroflash har bygget sin position på tysk. På sigt forstærkes det af **branchepakker** (se afsnit 7), hvor ingen internationale spillere konkurrerer på dansk.

**Arkitekturprincip:** Platformen er *stateless* omkring selve indholdet. Artikler gemmes ikke permanent — brugeren downloader/kopierer resultatet med det samme. Aktive kladder gemmes midlertidigt med automatisk udløb (TTL, se afsnit 8). Det, der gemmes permanent, er småt: brugerprofil, brand-profil, gemte instruktioner og forbrugslog.

**Tech-stack (fastlagt):** Next.js + Supabase (Postgres, auth med magic link og Google-login, row level security) + Stripe (fra V2). Vercel eller lignende til hosting.

---

## 2. Go-to-market: Gratis først, betaling hurtigt efter

**Strategi:** V1 lanceres 100 % gratis for at samle erfaring med brugernes ønsker og adfærd, før prismodellen låses fast. Men "gratis" styres stramt, fordi hver generering koster penge i API-kald:

- **Stram gratis-kvote:** fx 5 genereringer pr. måned pr. bruger.
- **Invite-/venteliste i starten** (valgfrit, men anbefalet): du styrer volumen og kan tale personligt med de første 20–50 brugere.
- **Feedback indbygget:** en lille "Var teksten brugbar? 👍👎 + kommentar"-widget efter hver generering. Kombinér med 5–10 rigtige samtaler med tidlige brugere.
- **Betaling introduceres i V1.5/V2:** de gratisbrugere, der rammer kvoteloftet, er præcis dem, der fortæller dig, hvad der er værd at betale for. Prismodel: **kvote pr. måned** (fastlagt), fx Gratis (5/md.) → Basis → Pro.
- **Rate limiting og forbrugstracking fra dag ét** er ekstra kritisk i en gratis-model: hård daglig grænse pr. bruger + globalt budgetloft/kill-switch, så viral spredning eller misbrug ikke giver en uventet regning.

---

## 3. URL- og sprogstrategi

To forskellige behov, to forskellige løsninger:

- **Marketing-sider** (forside, landingssider, gratis værktøjer, blog): sprog i URL-stien — `sidensnavn.com/da/...`, senere `sidensnavn.com/en/...` — med hreflang-tags. Det er nødvendigt for, at Google kan indeksere hvert sprog separat; en ren sprogvælger uden separate URL'er er markant dårligere SEO.
- **Appen** (bag login): sproget er en brugerindstilling; URL'en er ligegyldig — fx `app.sidensnavn.com` eller `sidensnavn.com/app`.
- **I V1**, hvor kun dansk findes, kan `/da/`-stien evt. vente — men i18n-strukturen bygges under motorhjelmen fra dag ét (alle UI-tekster i sprogfiler, aldrig hardcodet), så stien og `/en/` kan tilføjes uden omrokering.

---

## 4. Læring fra konkurrenterne (hvad skal med over)

### ArticleGenerator.org
- **Simpelt input-flow:** keyword → teksttype → længde → (valgfrit) tone, målgruppe, sekundære keywords. Avancerede felter foldet sammen bag "Avancerede indstillinger", så simple brugere ikke skræmmes — vigtigt for netop din målgruppe.
- **Trinvis progress-visning** under generering ("Bygger SEO-venlige overskrifter…", "Skriver afsnit…"). Gør ventetiden på 30–60 sek. acceptabel. **Med i V1.**
- **Gratis værktøj uden login** som lead magnet.
- Mange teksttyper (42) — men de fleste er støj. Vælg 4–8 gennemarbejdede danske skabeloner frem for 40 tynde.

### Article Forge
- **Ét klik → ét færdigt resultat**-simplicitet som UX-benchmark.
- Direkte WordPress-publicering og API — bekræfter V3/V4-planen.
- Automatiske titler og metadata som del af output, ikke et separat trin.
- *Skal ikke med:* spintax, tier 2-indhold, PBN-fokus.

### RightBlogger (vigtigste konkurrent)
- **Brand voice / "MyTone"** — matcher din brand-/tone-profil 1:1. Kernefeature.
- **Site Agent:** vedligeholder eksisterende indhold automatisk (forældede titler, svage metabeskrivelser, interne links, døde links) med ét-kliks fortrydelse. Stærk inspiration til V3/V4.
- **Multi-site/bureau-model** med adskilte brand voices og forbrug pr. kunde — relevant fra V3.
- **CMS-integrationer** (WordPress, Shopify, Webflow, Ghost, Wix) + webhooks.
- **Kontekstnær "Ask AI"-hjælp** direkte i UI'et.

### Neuroflash
- **Gratis værktøj helt uden signup** på marketing-siden — effektiv top-of-funnel og SEO-aktiv.
- **Style-profiler/brand voices** pr. kunde.
- **Webresearch med kildeangivelse** — matcher din kildehenvisnings-feature.
- **3-trins UX:** indtast → generér → redigér.
- Lokal sprogstrategi (tysk) som forretningsmodel — direkte parallel til dansk.

---

## 5. Version 1 — MVP ("generér, godkend, download") — gratis

**Mål:** En bruger kan oprette sig, sætte en brand-profil op, generere en god dansk tekst og downloade den. Lancér på 6–10 uger.

### Kernen
1. **Landing page** (dansk) — i18n-struktur fra dag ét.
2. **Brugeroprettelse:** magic link + Google-login via Supabase Auth (ingen passwords). Gratis kvote, ingen betaling.
3. **Genererings-flow:**
   - Vælg teksttype: **blogindlæg, produkttekst, brandtekst/om os, landingsside** (4 typer i V1).
   - **Skabelonarkitektur (vigtigt, se afsnit 7):** hver teksttype defineres som en *skabelon med definerbare inputfelter* — ikke en hardcodet formular. I V1 ligner det bare et brief-felt med nogle metadata, men det gør senere branchepakker til "blot en ny skabelon".
   - Kort brief: emne/keyword, branche, målgruppe, formål, ønsket længde.
   - **Idégenerering:** AI foreslår 5–8 emner/vinkler ud fra briefen; brugeren vælger eller skriver sin egen.
   - **Kildemateriale (valgfrit):** 1–3 URL'er eller rå tekst; systemet henter og renser indholdet (readability-udtræk) som kontekst.
   - **Generér med trinvis progress-visning.**
4. **Preview og redigering:**
   - Output som **redigerbare blokke/sektioner** (H2-afsnit), ikke én HTML-klump.
   - **"Regenerér denne sektion"** pr. blok.
   - **Meta-titel og metabeskrivelse** genereres automatisk med.
   - Al AI-output **saneres server-side** (whitelist: h2, h3, p, ul, ol, li, strong, em, a) før visning.
5. **Download/eksport:** Kopiér som HTML, kopiér som Markdown, download som .docx.
6. **Kladde-sikkerhed (localStorage + TTL-kladde fra start):** se afsnit 8.
7. **Feedback-widget** efter hver generering (👍👎 + kommentar).

### Personalisering og brugerdefinerede prompts (tre niveauer)
- **Brand-/tone-profil (1 stk. i V1):** virksomhedsbeskrivelse, tone, forbudte ord, evt. eksempeltekst som stilreference. Sendes altid med.
- **Niveau 1 — Globale instruktioner** ("husk dette"): frie instruktioner, der gælder alle genereringer. **Med i V1** — billigt at bygge.
- **Niveau 2 — Instruktioner pr. teksttype** (fx "i produkttekster: nævn altid fri fragt over 499 kr."). **V2.**
- **Niveau 3 — Frit instruktionsfelt pr. generering.** **Med i V1.**
- **Sikkerhed:** brugerens instruktioner *supplerer* systemets skabeloner og kan aldrig erstatte dem (beskytter kvalitet og mod prompt injection). Instruktionsfelter saneres som alt andet input.

### Drift & styring (fra dag ét)
- **Forbrugstracking:** tokens + estimeret omkostning pr. kald og pr. tekst (kun metadata).
- **Rate limiting:** hård daglig/månedlig grænse pr. bruger + globalt budgetloft/kill-switch.
- Fejllogning/alerts (fx Sentry).

### Bevidst udeladt af V1
Opdatering af eksisterende tekster, betaling, CMS-integration, bulk, schema, interne links, multi-site, branchepakker.

---

## 6. Version 2 — "Opdatér eksisterende tekster" + betaling

1. **Analyse af eksisterende tekst:** URL eller rå tekst → AI scorer på **SEO, læsbarhed, tone** med konkrete forslag **pr. sektion**.
2. **Sektionsvis omskrivning:** original vs. forslag side om side, **acceptér/afvis pr. sektion**. Samlet resultat downloades.
3. **Betaling (Stripe):** kvote pr. måned — Gratis (5/md.) → Basis → Pro. Priserne kalibreres efter V1-data om faktisk API-omkostning pr. tekst.
4. **Instruktioner niveau 2** (pr. teksttype).
5. **Flere teksttyper:** FAQ-side, servicebeskrivelse, nyhedsbrev, kategoritekst.
6. **Schema/JSON-LD:** FAQ- og Product-schema med i eksporten.
7. **Gratis værktøj uden login** på marketing-siden som lead magnet og SEO-aktiv (fx "gratis AI produkttekst-generator på dansk").

---

## 7. Version 3 — Integration, skala og branchepakker

1. **WordPress-connector først** (dit eksisterende plugin lever videre som det er, og erfaringerne — på sigt måske selve pluginet — bliver fundamentet her): hent artikler ind, skriv tilbage som *kladde* i WordPress med eksplicit godkend-trin. Yoast-kompatible metafelter.
2. **Branchepakker (ny prioritet):** teksttyper for brancher, der skriver samme tekst igen og igen med strukturerede data som input:
   - **Ejendomsmægler:** formular (adresse, kvm, værelser, byggeår, stand, kvarter, energimærke) → boligannonce i mæglerens tone.
   - **Autoforhandler:** formular (mærke, model, årgang, km, udstyr, stand) → salgsannonce.
   - Senere: rejsebureauer, restauranter, jobopslag m.fl.
   - **Hvorfor stærkt:** markant højere outputkvalitet end fri generering, højere betalingsvillighed (arbejdsredskab, ikke blogværktøj), og dedikerede landingssider pr. branche ("AI-boligtekster til ejendomsmæglere") ranker på danske søgninger med minimal konkurrence.
   - **Arkitektonisk gratis:** fordi teksttyper fra V1 er skabeloner med definerbare inputfelter, er en branchepakke "blot" en ny skabelon + prompt + landingsside.
   - På sigt: integration til branchesystemer (Mindworking, Bilinfo o.l.).
3. **Sundhedstjek / bulk-oversigt:** dashboard med score pr. side på tilsluttet site. Gemmer kun score + URL + dato (lille metadata-tabel) — teksterne hentes friskt fra CMS'et.
4. **Interne links-forslag** med eksplicit "indsæt"-trin.
5. **Kategorisering i bulk.**
6. **Multi-site:** flere sites pr. konto med egen brand-profil og adskilt forbrug — grundlag for en senere bureau-plan.
7. **Kontekstnær hjælp i UI'et.**

---

## 8. Kladder: localStorage + server-TTL (fra start)

**Problem:** Uden kladde-sikkerhed mister brugere arbejde ved refresh/nedbrud og churner. Med permanent lagring får du backup- og lagringskrav, du ikke ønsker. Løsningen er en mellemvej med to lag — begge med fra V1:

- **Lag 1 — localStorage (browser):** den aktive kladde autosaves lokalt hvert par sekunder. Nul serveromkostning, overlever refresh og lukket fane på samme enhed.
- **Lag 2 — server-kladde med TTL (Time To Live = automatisk udløb):** kladden gemmes også i en `drafts`-tabel i Supabase med et `expires_at`-tidsstempel (fx nu + 48 timer). Et lille planlagt job (Supabase `pg_cron`, én SQL-linje der kører hver nat) sletter alle udløbne rækker. Det giver:
  - kladden overlever skift af enhed/browser,
  - datamængden er selvbegrænsende — der ligger aldrig mere end ca. 48 timers aktive kladder på serveren, typisk få MB i alt,
  - intet backup-krav: kladder er pr. definition flygtige, og brugeren ved det ("Kladder gemmes i 48 timer").
- **UI:** en diskret "Kladde gemt — udløber om 47 t"-indikator + tydelig download-opfordring, når teksten er færdig.

---

## 9. Version 4 — Automatisering og internationalisering

1. **Engelsk version** (`/en/` på marketing, engelske skabeloner) — primært indhold, ikke arkitektur, fordi i18n var med fra V1.
2. **Shopify-connector** (produkttekster i bulk) + webhooks som generisk integration.
3. **API:** trig generering fra andre systemer, fx når et nyt produkt oprettes i en webshop.
4. **"Vedligeholdelses-agent"** (à la RightBloggers Site Agent): periodisk scanning af tilsluttede sites — forældede titler, svage metabeskrivelser, manglende interne links — med forslag i godkendelseskø og ét-kliks fortrydelse.
5. Evt. content-kalender/planlagt generering efter efterspørgsel.

---

## 10. Datamodel — hvad gemmes?

| Gemmes permanent | Gemmes midlertidigt (TTL) | Gemmes IKKE |
|---|---|---|
| Bruger (e-mail, plan, kvote) | Kladder (48 t, auto-slettes) | Færdige artikler/tekster |
| Brand-/tone-profil | | Hentet kildemateriale |
| Gemte instruktioner (niveau 1–2) | | AI-rå-output |
| Forbrugslog (metadata pr. kald) | | |
| Feedback (👍👎 + kommentar) | | |
| Site-forbindelser + sundhedsscore pr. URL (fra V3) | | |

Permanent datavolumen pr. bruger: få kilobytes. TTL-kladder: selvbegrænsende, få MB samlet. Backup-kravet er trivielt.

---

## 11. Beslutningslog

| Beslutning | Valg |
|---|---|
| Målgruppe V1 | Mindre erhvervsdrivende/iværksættere uden marketingafdeling |
| Go-to-market | Gratis V1 med stram kvote → betaling i V1.5/V2 |
| Prismodel | Kvote pr. måned |
| URL/sprog | `.com` + `/da/` på marketing (hreflang), sprogindstilling i appen |
| Kladder | localStorage + server-TTL (48 t) — begge fra V1 |
| Brugerdefinerede prompts | 3 niveauer; niveau 1 + 3 i V1, niveau 2 i V2 |
| Branchepakker | V3 — men skabelonarkitekturen forberedes i V1 |
| Tech-stack | Next.js + Supabase + Stripe |
| WP-plugin | Lever videre uændret; fundament for V3-connector |
