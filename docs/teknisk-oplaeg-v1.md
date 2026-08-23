# Teknisk oplæg: V1 af den danske AI-tekstplatform

*Skrevet til en ikke-teknisk læser. Hvert afsnit forklarer først "hvad og hvorfor" i almindeligt sprog — derefter kommer detaljerne, som du kan give videre til dit AI-kodeværktøj, når du bygger.*

---

## 1. Det store billede: Sådan hænger delene sammen

Tænk på systemet som en restaurant:

| Rolle i restauranten | Teknologi | Hvad den gør |
|---|---|---|
| Selve restauranten (lokalet gæsterne ser) | **Next.js** (koden) | Hjemmesiden og appen — alt det, brugeren ser og klikker på |
| Opskriftsbogen i skuffen | **GitHub** | Her ligger al din kode gemt med fuld historik. Laver du en fejl, kan du altid rulle tilbage |
| Udlejeren, der holder lokalet åbent 24/7 | **Vercel** | Hosting. Hver gang du gemmer ny kode i GitHub, bygger og udgiver Vercel automatisk den nye version |
| Køkkenet og lageret | **Supabase** | Databasen (brugere, brand-profiler, kladder, forbrugslog) + login-systemet |
| Den eksterne stjernekok | **AI-API** (Anthropic Claude eller OpenAI) | Selve tekstgenereringen. Du sender en opgave, får en tekst tilbage og betaler pr. opgave |
| Kassen (fra V2) | **Stripe** | Abonnement og betaling |

**Flowet, når en bruger genererer en tekst:**

1. Brugeren udfylder briefen i browseren (Next.js-appen).
2. Browseren sender briefen til **din server** (en "API-route" i Next.js, som kører hos Vercel).
3. Serveren tjekker: Er brugeren logget ind? Har hun kvote tilbage? (Opslag i Supabase.)
4. Serveren bygger den fulde prompt (din systemskabelon + brand-profil + gemte instruktioner + brief) og sender den til AI-API'et.
5. Svaret **streames** tilbage — teksten dukker op ord for ord hos brugeren, ligesom i ChatGPT, så ventetiden føles kort.
6. Serveren sanerer HTML'en, logger forbruget (tokens/kroner) i Supabase og trækker 1 fra kvoten.
7. Brugeren redigerer, downloader — og kladden autosaves undervejs (localStorage + TTL-kladde i Supabase).

**Den vigtigste sikkerhedsregel i hele systemet:** AI-API-nøglen (dit "kreditkort" til AI-leverandøren) ligger KUN på serveren — aldrig i browserkoden. Alt, der koster penge, går gennem din server, hvor du kan kontrollere det.

---

## 2. Teknologivalg i detaljer

### Next.js (framework — det, appen bygges i)
- Brug **App Router** (den moderne standard) med **TypeScript** (fanger fejl, før de rammer brugerne — særligt værdifuldt ved vibe coding, hvor du ikke selv læser al koden linje for linje).
- **Tailwind CSS** til styling + et færdigt komponentbibliotek som **shadcn/ui** (pæne knapper, formularer, dialoger ud af boksen — sparer uger).
- i18n fra dag ét: alle UI-tekster i sprogfiler (fx `da.json`), aldrig hardcodet. Biblioteket **next-intl** er standardvalget og understøtter `/da/`-stier på marketing-siderne.

### Supabase (database + login)
- **Postgres-database** med de tabeller, der står i afsnit 3.
- **Supabase Auth:** magic link (login via mail-link, ingen adgangskode) + "Log ind med Google". Begge er indbyggede — du slår dem til i Supabase-dashboardet.
- **Row Level Security (RLS):** en regel i databasen, der siger "en bruger kan kun se og ændre sine egne rækker". Det er dit vigtigste sikkerhedslag og SKAL være slået til på alle tabeller. Bed eksplicit dit AI-værktøj om at skrive RLS-policies til hver tabel.
- **pg_cron:** Supabases indbyggede "vækkeur" — ét lille job, der hver nat sletter udløbne kladder (TTL).

### Vercel (hosting)
- Forbind Vercel til dit GitHub-repository én gang. Derefter: hver gang koden gemmes ("pushes") til GitHub, udgiver Vercel automatisk.
- **Preview-deploys:** hver ændring får sin egen midlertidige test-URL, så du kan se og godkende, før den rammer den rigtige side.
- **Miljøvariabler:** hemmeligheder (AI-nøgle, Supabase-nøgler) indtastes i Vercels dashboard — de ligger aldrig i koden/GitHub.

### AI-API
- Vælg én leverandør til at starte med — enten **Anthropic (Claude)** eller **OpenAI (GPT)** — men byg et tyndt "adapter-lag" i koden (én fil, der oversætter mellem din app og leverandørens API), så du senere kan skifte eller kombinere uden at ombygge. Test begge på dansk tekstkvalitet med dine egne skabeloner, før du låser valget — dansk idiomatik er hele din differentiator, så lad output afgøre det.
- Brug leverandørens officielle SDK og streaming. Dokumentation: https://docs.claude.com/en/api/overview (Anthropic) hhv. platform.openai.com/docs (OpenAI).
- Overvej en billig/hurtig model til idégenerering og en topmodel til selve teksten — det kan halvere omkostningen pr. genereret artikel.

### Værktøj til selve vibe-kodningen
- **Claude Code** (kommandolinje/desktop, dokumentation: https://docs.claude.com/en/docs/claude-code/overview) eller **Cursor** er de oplagte valg. Begge kan læse hele projektet, skrive kode på tværs af filer og committe til GitHub for dig.
- Læg en fil i projektets rod (fx `CLAUDE.md` eller `PROJECT.md`) med projektets regler: "Alle tabeller skal have RLS", "AI-nøgler kun server-side", "alle UI-tekster i sprogfiler", "al AI-HTML skal saneres". AI-værktøjet læser den automatisk og følger reglerne — det er din vigtigste kvalitetssikring som ikke-tekniker.

---

## 3. Datamodel (tabellerne i Supabase)

Kun 6 tabeller i V1. `auth.users` (selve login-tabellen) leverer Supabase automatisk.

**profiles** — én række pr. bruger (udvider login-brugeren)
- `id` (kobling til auth.users), `email`, `plan` (free), `quota_monthly` (fx 5), `quota_used`, `quota_reset_at`, `created_at`

**brand_profiles** — brand-/tone-profilen (1 pr. bruger i V1)
- `id`, `user_id`, `company_description`, `tone` (formel/uformel/legende…), `banned_words` (liste), `style_sample` (eksempeltekst), `updated_at`

**instructions** — gemte instruktioner ("husk dette")
- `id`, `user_id`, `scope` (global i V1; per_text_type i V2), `text_type` (tom i V1), `content`, `created_at`

**templates** — teksttype-skabelonerne (nøglen til branchepakker senere)
- `id`, `slug` (blog/produkt/brand/landingsside), `name`, `system_prompt`, `input_fields` (JSON: hvilke felter formularen viser — fx emne, målgruppe, længde), `language` (da), `active`
- *Pointen:* når du i V3 vil lave en ejendomsmægler-pakke, tilføjer du én række med andre `input_fields` (adresse, kvm, værelser…) og en anden `system_prompt` — ingen ny kode.

**drafts** — TTL-kladder
- `id`, `user_id`, `template_slug`, `content` (JSON med blokke), `expires_at` (nu + 48 t), `updated_at`
- pg_cron-job hver nat: `DELETE FROM drafts WHERE expires_at < now();`

**usage_log** — forbrug og feedback (kun metadata — aldrig selve teksten)
- `id`, `user_id`, `template_slug`, `model`, `input_tokens`, `output_tokens`, `estimated_cost`, `feedback` (👍/👎), `feedback_comment`, `created_at`

Alle tabeller: RLS slået til, policy = "kun egne rækker" (undtagen `templates`, som alle må læse, men kun du må skrive).

---

## 4. Appens sider og de 4 centrale skærmbilleder

**Struktur:**
- `/da/` — marketing-forside (og senere `/da/vaerktoejer/...` til gratis lead magnets)
- `/app` — bag login:
  - `/app` — **Skærm 1: Forside/dashboard.** "Ny tekst"-knap, kvote-status ("3 af 5 genereringer tilbage"), evt. aktiv kladde ("Fortsæt hvor du slap — udløber om 41 t").
  - `/app/ny` — **Skærm 2: Brief.** Vælg teksttype (4 kort) → formular bygget dynamisk ud fra skabelonens `input_fields` → valgfrit: kildemateriale (URL'er/rå tekst) og frit instruktionsfelt → "Foreslå vinkler"-knap (idégenerering) → vælg vinkel → "Generér".
  - `/app/skriv` — **Skærm 3: Editor (den vigtigste skærm).** Trinvis progress under generering → teksten lander som blokke (meta-titel/-beskrivelse øverst, derefter H2-sektioner) → pr. blok: redigér, "Regenerér denne sektion", slet → autosave-indikator → eksport: Kopiér HTML / Kopiér Markdown / Download .docx → feedback-widget (👍👎).
  - `/app/indstillinger` — **Skærm 4: Profil.** Brand-profil + gemte instruktioner + konto.

**API-routes (serverens "døre" — alt, der koster penge eller rører databasen):**
- `POST /api/ideas` — idégenerering (billig model)
- `POST /api/generate` — fuld generering (streaming; tjekker kvote → bygger prompt → kalder AI → sanerer → logger forbrug)
- `POST /api/regenerate-section` — én sektion
- `POST /api/fetch-source` — henter og renser en URL til kildemateriale (server-side, med timeout og størrelsesgrænse)
- `POST /api/export/docx` — bygger .docx-filen
- `POST /api/feedback`, `PUT /api/draft` — feedback og kladde-gem

---

## 5. Sikkerhed og styring — tjeklisten

1. **AI-nøgler kun server-side** (Vercel-miljøvariabler). Aldrig i browserkode, aldrig i GitHub.
2. **RLS på alle tabeller** — brugere kan kun se egne data.
3. **Sanering af AI-output server-side** før visning/eksport: whitelist af tags (h2, h3, p, ul, ol, li, strong, em, a) med et etableret bibliotek (fx `sanitize-html`) — skriv aldrig din egen sanering.
4. **Prompt-arkitektur:** systemskabelonen ligger fast; brugerens brand-profil, instruktioner og brief indsættes som afgrænsede, tydeligt markerede blokke, der *supplerer* — brugerinput kan aldrig omskrive systemets regler.
5. **Kildemateriale-hentning:** kun http/https, timeout, maks. størrelse, og bloker interne adresser (så ingen kan bede din server hente fra dit eget netværk — "SSRF-beskyttelse"; nævn ordet for dit AI-værktøj, det ved hvad det betyder).
6. **Rate limiting to lag:** pr. bruger (kvoten + maks. X kald/minut) og globalt budgetloft med kill-switch (én indstilling, der kan slukke al generering, hvis dagens forbrug overstiger fx 200 kr.).
7. **Fejlovervågning:** Sentry (gratis tier) — du får mail, når noget fejler hos en bruger.
8. **GDPR-basics:** privatlivspolitik, databehandleraftaler ligger klar hos både Supabase, Vercel og AI-leverandørerne (skal blot accepteres/downloades), og en "slet min konto"-funktion, der fjerner alle brugerens rækker. Jeres stateless design er her en kæmpe fordel — I opbevarer næsten ingen persondata.

---

## 6. Byggeplan — trin for trin (6–10 uger ved siden af andet arbejde)

Hvert trin afsluttes med noget, der virker og kan vises frem. Byg i denne rækkefølge:

**Trin 0 — Fundament (weekend 1):** Opret Next.js-projekt → push til GitHub → forbind Vercel (nu udgives automatisk) → forbind Supabase → skriv `CLAUDE.md`/`PROJECT.md` med projektreglerne fra afsnit 2. *Milepæl: en tom side er live på en rigtig URL.*

**Trin 1 — Login:** Supabase Auth med magic link + Google. `profiles`-tabel med RLS. *Milepæl: du kan logge ind og se en tom dashboard-side.*

**Trin 2 — Første generering (grimt men virkende):** `templates`-tabellen med én skabelon (blogindlæg), brief-formular, `/api/generate` med streaming, rå tekst på skærmen. *Milepæl: brief ind → dansk tekst ud.* Dette er projektets "aha-øjeblik" — brug tid her på at få prompten og den danske kvalitet rigtig.

**Trin 3 — Editor:** blokke, sektions-regenerering, sanering, meta-titel/-beskrivelse, eksport (kopiér HTML/Markdown; .docx kan vente til sidst i trinnet).

**Trin 4 — Kladder:** localStorage-autosave + `drafts`-tabel med TTL + pg_cron-jobbet.

**Trin 5 — Personalisering:** brand-profil, globale instruktioner, frit instruktionsfelt — ind i prompten.

**Trin 6 — Styring:** kvote, forbrugslog, rate limiting, budgetloft, Sentry, feedback-widget.

**Trin 7 — Resten af skabelonerne + idégenerering + kildemateriale.**

**Trin 8 — Marketing-forside på `/da/`, privatlivspolitik, venteliste/invites → lancering til de første 20–50 brugere.**

---

## 7. Hvad koster driften i V1?

- **Vercel, Supabase, GitHub, Sentry:** gratis tiers rækker fint til V1 (op til nogle tusinde brugere). Regn med 0 kr./md. i starten; opgradér Supabase (~25 USD/md.) og Vercel (~20 USD/md.), når trafikken kræver det.
- **AI-API:** den eneste reelle variable omkostning. Prisen afhænger af model og tekstlængde — typisk fra under 1 kr. til nogle få kroner pr. fuld artikel med en topmodel. Præcise tal får du fra din egen forbrugslog efter de første uger (netop derfor er `usage_log` med fra trin 6), og de tal bruger du til at sætte Basis-/Pro-priserne i V2.
- **Domæne:** ~100–150 kr./år.

Med 50 gratisbrugere à 5 genereringer/md. taler vi altså formentlig om et par hundrede kroner om måneden i AI-forbrug — og budgetloftet i afsnit 5 sikrer, at det aldrig løber løbsk.

---

## 8. Åbne tekniske valg (små, kan afgøres undervejs)

1. **AI-leverandør:** afgøres af en dansk-kvalitetstest med dine egne skabeloner (trin 2 er det naturlige tidspunkt).
2. **.docx-eksport:** biblioteket `docx` (npm) er standardvalget — lad AI-værktøjet vurdere, når trin 3 rammes.
3. **E-mails** (magic links sendes af Supabase automatisk, men velkomst-/kvote-mails senere): Resend er det enkle valg, når behovet opstår.
4. **Analytics:** Vercel Analytics eller Plausible (begge privatlivsvenlige, ingen cookie-banner nødvendigt).
