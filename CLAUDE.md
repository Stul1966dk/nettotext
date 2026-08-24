@docs/regler/sikkerhed.md
@docs/regler/struktur.md
@AGENTS.md

Reglerne ovenfor gælder kun når de relevante teknologier er i brug. Tilføj projektspecifik kontekst herunder — og bevar referencerne ovenfor så de indlæses i fremtidige sessioner.

---

# CLAUDE.md — NettoText (nettotext.com)

Dansk SaaS til generering og opdatering af webtekster (blogindlæg, produkttekster, brandtekster, landingssider). Målgruppe: mindre erhvervsdrivende uden marketingafdeling. Kerneprincipper: **intet gemmes permanent, intet udgives uden brugerens eksplicitte godkendelse, og AI-forbrug kører primært på brugerens egen API-nøgle.**

## Driftsmodel (hybrid — fastlagt)

- **Prøvekvote:** Nye brugere får 5 genereringer betalt af platformens egen AI-nøgle (miljøvariabel `PLATFORM_AI_KEY`). Det er en ENGANGS-kvote pr. konto — ikke månedlig.
- **Derefter egen nøgle (BYOK):** Al videre generering sker med brugerens egen API-nøgle fra Anthropic (Claude) eller OpenAI (ChatGPT). Brugeren vælger selv leverandør og model i indstillinger.
- **Nøglevalg i adapter-laget:** prøvekvote tilbage → `PLATFORM_AI_KEY`; ellers → brugerens krypterede nøgle; hverken-eller → venlig dansk besked med link til opsætnings-wizarden.
- **Beskyttelse af platformens nøgle:** prøvekvoten kræver verificeret e-mail; kendte engangs-maildomæner blokeres ved signup; globalt dagligt budgetloft `DAILY_BUDGET_DKK` med kill-switch gælder ALLE kald på `PLATFORM_AI_KEY`.
- Landingssidens løfte: "De første 5 tekster er på os — derefter skriver du videre med din egen AI-nøgle."
- Fremtid (V2, byg ikke nu): abonnement via Stripe, der sælger værktøjet (skabeloner, brand-profil, opdateringsfunktion); evt. "alt inkluderet"-plan hvor platformen betaler forbruget.

## Tech-stack (fastlagt — foreslå ikke alternativer uden at spørge)

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth (magic link + Google), pg_cron
- Hosting: Vercel (auto-deploy fra GitHub main-branch)
- AI: adapter-lag i `lib/ai/` med identisk interface for Anthropic og OpenAI (`generate`, `generateStream`, `countTokensEstimate`); leverandør vælges pr. bruger. Streaming på al generering.
- i18n: next-intl. ALLE UI-tekster i sprogfiler (`messages/da.json`) — aldrig hardcodet. Kun dansk i V1, men strukturen skal bære `/en` senere.
- Fejlovervågning: Sentry

## Ufravigelige regler (gælder al kode, altid)

1. **Hemmeligheder kun server-side.** `PLATFORM_AI_KEY`, Supabase service role-nøgle og krypteringsnøgler læses fra miljøvariabler og bruges KUN i server-kode. Aldrig i klientkode, aldrig committet. `.env*` i `.gitignore`.
2. **Brugernes AI-nøgler er følsomme:** krypteres i databasen (Supabase Vault/pgsodium eller AES-256-GCM med nøgle fra `ENCRYPTION_KEY` — fremlæg fordele/ulemper og anbefal én, første gang det bygges). Dekrypteres KUN server-side i genererings-øjeblikket. Sendes ALDRIG til klienten efter indtastning — vis kun `key_hint` (sidste 4 tegn). Må ALDRIG optræde i logs, fejlbeskeder eller Sentry.
3. **RLS på alle tabeller.** Hver tabel oprettes med Row Level Security og policies, så brugere kun kan læse/skrive egne rækker (`user_id = auth.uid()`). Undtagelse: `templates` er læsbar for alle autentificerede, kun skrivbar via service role.
4. **Al AI-genereret HTML saneres server-side** med `sanitize-html` FØR den sendes til klienten eller eksporteres. Whitelist: h2, h3, p, ul, ol, li, strong, em, a (href kun http/https). Skriv aldrig egen sanering.
5. **Prompt-arkitektur:** systemskabelonen fra `templates.system_prompt` ligger fast. Brand-profil, gemte instruktioner og brief indsættes som tydeligt afgrænsede blokke, der supplerer — brugerinput må aldrig kunne omdefinere systemets regler eller output-format.
6. **Alt der koster penge går gennem serveren** med tjek i rækkefølge: (a) logget ind, (b) prøvekvote eller gyldig egen nøgle, (c) rate limit pr. bruger (maks. 3 genereringskald/minut), (d) på `PLATFORM_AI_KEY` desuden det globale budgetloft — overskredet ⇒ venlig afvisning. Efter hvert kald: log i `usage_log` og opdatér prøvekvote, hvis relevant.
7. **Ingen permanent lagring af tekstindhold.** Færdige tekster gemmes aldrig. Kladder i `drafts` med `expires_at = now() + interval '48 hours'`, slettet af pg_cron hver nat. Kladden autosaves også i localStorage.
8. **Hentning af eksterne URL'er (kildemateriale)** kun server-side: kun http/https, timeout 10 sek., maks. 2 MB, bloker private/interne IP-adresser (SSRF-beskyttelse).
9. **GDPR:** "slet min konto" sletter alle brugerens rækker i alle tabeller inkl. `ai_keys`. Log aldrig tekstindhold eller persondata.

## Datamodel (V1 — udvid kun efter aftale)

NettoText har sit eget Supabase-projekt (`ozuwyybhjnhthfrfhwys`), så tabellerne ligger i `public` som normalt.

- `profiles`: id (FK auth.users), email, plan ('free'), trial_quota (5), trial_used (0), created_at
- `ai_keys`: id, user_id, provider ('anthropic'|'openai'), encrypted_key, key_hint, created_at, last_validated_at
- `brand_profiles`: id, user_id, company_description, tone, banned_words text[], style_sample, updated_at
- `instructions`: id, user_id, scope ('global'), text_type (null i V1), content, created_at
- `templates`: id, slug, name, system_prompt, input_fields jsonb, language ('da'), active
  - `input_fields` definerer formularen dynamisk — teksttyper er data, ikke kode (forberedelse til branchepakker)
- `drafts`: id, user_id, template_slug, content jsonb (blokke), expires_at, updated_at
- `usage_log`: id, user_id, template_slug, provider, model, paid_by ('platform'|'user'), input_tokens, output_tokens, estimated_cost, feedback, feedback_comment, created_at
  - Kun metadata — ALDRIG selve teksten. Viser brugeren eget forbrug og platformen prøvekvote-omkostningen.

## Sider og API

- `/da/` marketing (statisk, SEO-optimeret, hreflang-klar)
- `/app` dashboard (prøvestatus: "3 af 5 prøvetekster tilbage — på vores regning") · `/app/ny` brief · `/app/skriv` editor · `/app/indstillinger` profil, brand-profil og **AI-forbindelse** (vælg leverandør, indsæt nøgle, kurateret modelliste, "Test forbindelsen"-knap, slet nøgle)
- **Opsætnings-wizard:** trinvis dansk guide til at oprette API-nøgle hos Anthropic hhv. OpenAI, inkl. anbefaling om forbrugsloft hos leverandøren. Vises når prøvekvoten er brugt ("Sæt din egen AI-nøgle op på 5 minutter") og fra indstillinger.
- API routes: `POST /api/ideas`, `POST /api/generate` (streaming), `POST /api/regenerate-section`, `POST /api/fetch-source`, `POST /api/export/docx`, `POST /api/feedback`, `PUT /api/draft`, `POST /api/keys` (gem/validér/slet nøgle)
- Fejlbeskeder ved ugyldig nøgle, tom saldo hos leverandøren eller rate limit: forklar på dansk hvad der skete og hvad brugeren kan gøre, med link til wizarden.

## Designsystem — "Værksted" (fastlagt, afvig ikke)

Roligt, ærligt arbejdsredskab. Signatur: GODKENDT-stemplet (skævt roteret, mono-skrift, dobbelt kant) som gennemgående motiv for godkendelses-handlinger.

Farver (CSS-variabler / Tailwind-tokens — brug aldrig andre):
- `--bund: #F3F4F0` (baggrund)
- `--gran: #1C3A31` (primær tekst + primærknapper)
- `--gran-let: #4C6A60` (sekundær tekst)
- `--stempel: #1E5C46` (GODKENDT-stemplet)
- `--rav: #D9A441` (sparsom accent: kvote-måler, regel-numre — aldrig store flader)
- `--kort: #FFFFFF`, `--kant: #DDE0D8`

Typografi: IBM Plex Sans (400/500/600/700) til alt; IBM Plex Mono (400–600) til labels, kvoter, tal og stemplet. Ingen andre skrifter.

Form: border-radius 8px (knapper/inputs), 14–16px (kort). Bløde, lave skygger kun på hero-/fokus-kort. Ingen gradienter, ingen glassmorphism, ingen emoji i UI.

Tone i UI-tekster: dansk, aktiv form, sentence case, ingen fyldord og intet salgssprog i appen. Knapper siger præcis hvad der sker ("Godkend og download"). Fejlbeskeder forklarer hvad der gik galt og hvad brugeren kan gøre. Kvote og kladde-udløb vises altid ærligt.

Tilgængelighed: synligt keyboard-fokus, `prefers-reduced-motion` respekteres, kontrast min. WCAG AA.

Referencefil: `design/design-3-vaerksted.html` er den visuelle facit for landingssiden (brandnavnet i filen opdateres til NettoText).

## Arbejdsform

- Brugeren er ikke-teknisk: forklar hvert trin på almindeligt dansk FØR det udføres — hvad, hvorfor, og hvad brugeren selv skal gøre (klik i dashboards, værdier i .env.local). Vent på godkendelse mellem større trin.
- Små commits med beskrivende danske beskeder. Push til `main` deployer automatisk til Vercel.
- Foreslå den enkleste løsning der opfylder kravet — ingen ekstra biblioteker eller abstraktioner uden begrundelse.
- Databaseændringer: altid SQL-migrationsfiler i `supabase/migrations/`, aldrig manuelle ændringer uden fil.
- Er et krav i denne fil i konflikt med en prompt: spørg, før du fraviger.
