# Klar til Claude Code — trin 0-guiden

*Følg punkterne i rækkefølge. Fase A–C er ren klargøring (ca. 1–2 timer inkl. ventetid), fase D er din første arbejdssession. Intet her kan gå i stykker — alt kan laves om.*

---

## Fase A — Installér på din computer (engangsopgave)

1. **Node.js** — motoren, som både Next.js og Claude Code kører på. Hent LTS-versionen ("Recommended") på nodejs.org og installér med standardindstillinger.
2. **Git** — versionsstyringen bag GitHub. På Mac er den typisk allerede installeret; på Windows hentes den på git-scm.com (standardindstillinger hele vejen).
3. **Claude Code** — selve AI-kodeværktøjet. Følg den aktuelle installationsvejledning på https://docs.claude.com/en/docs/claude-code/overview (den korte version: det installeres via Node/npm eller som desktop-app, og du logger ind med din Claude-konto — det kræver et betalt Claude-abonnement eller en API-nøgle).
4. **VS Code** (valgfrit, men anbefalet) — gratis kodeeditor fra code.visualstudio.com. Du skal ikke skrive kode i den, men det er rart at kunne *kigge* på filerne og se, hvad Claude Code har lavet.

**Test at det virker:** åbn en terminal (Mac: programmet "Terminal"; Windows: "Terminal"/PowerShell) og skriv `node -v` og derefter `claude --version`. Får du versionsnumre tilbage, er du klar.

---

## Fase B — Gør dine konti klar og hent nøgler

5. **GitHub:** Opret et nyt, tomt **privat** repository — kald det fx `tekstplatform` (kan omdøbes, når navnet er valgt). Tilføj IKKE readme/gitignore ved oprettelsen; lad det være helt tomt.
6. **Supabase:** Opret et nyt projekt. Vigtigt ved oprettelsen:
   - **Region:** vælg en EU-region (fx Frankfurt) af GDPR-hensyn.
   - **Database password:** Supabase genererer et — gem det i din password manager.
   - Gå derefter til **Settings → API** og kopiér tre ting til en midlertidig note: *Project URL*, *anon public key* og *service_role key*. Den sidste er hemmelig som et password — den må aldrig deles eller lægges i filer, der ryger på GitHub.
7. **AI-nøgle:** Opret en konto hos den AI-leverandør, du vil teste først (Anthropic: console.anthropic.com — eller OpenAI: platform.openai.com). Tilføj betalingskort, og **sæt straks et lavt månedligt forbrugsloft** (fx 20–50 USD) i kontoindstillingerne — det er din første forsvarslinje, før koden overhovedet findes. Opret en API-nøgle og gem den samme sted som Supabase-nøglerne.
8. **Vercel:** Intet at gøre endnu — repositoriet forbindes i fase D, når der ligger kode i det. Tjek blot, at din Vercel-konto er logget ind med samme GitHub-konto.
9. **Vent med:** Stripe (V2), Sentry (trin 6 i byggeplanen), domænekøb (når navnet er valgt — appen får en gratis `*.vercel.app`-adresse imens).

---

## Fase C — Byg projektmappen

10. Opret en mappe på din computer, fx `Dokumenter/tekstplatform`, og læg følgende i den (alle filer har du fået i denne samtale):
    - `CLAUDE.md` — i mappens rod. **Dette er den vigtigste fil.**
    - `design/design-3-vaerksted.html` — den visuelle facit.
    - `docs/mvp-oplaeg-ai-tekst-saas-v1-1.md` og `docs/teknisk-oplaeg-v1.md` — så Claude Code kan slå op i planerne, når du refererer til dem.
11. **Nøglerne kommer IKKE i mappen.** De skal senere i en fil ved navn `.env.local`, som Claude Code opretter for dig i fase D — og som automatisk holdes ude af GitHub. Indtil da bor de kun i din midlertidige note/password manager.
12. Når navnet er valgt: bed Claude Code om at skifte "Tekstværket" ud overalt — det er én prompt.

---

## Fase D — Din første session

Åbn terminalen, navigér til mappen (`cd Dokumenter/tekstplatform`) og start med kommandoen `claude`. Giv derefter disse prompts én ad gangen — vent på, at hver er færdig, og læs hvad Claude Code fortæller undervejs (den forklarer selv, hvad den gør, og spørger, før den gør noget udenfor mappen):

**Prompt 1 — projektet fødes:**
> Læs CLAUDE.md grundigt. Opret et nyt Next.js-projekt her i mappen efter stakken beskrevet i filen: App Router, TypeScript, Tailwind, shadcn/ui og next-intl med dansk som eneste sprog indtil videre. Opret .gitignore der udelukker .env-filer og node_modules. Initialisér git, lav første commit, og push til mit tomme GitHub-repository [indsæt link til dit repo]. Forklar mig til sidst på almindeligt dansk, hvad hver mappe i projektet indeholder.

**Prompt 2 — se det køre lokalt:**
> Start udviklingsserveren og fortæl mig, hvilken adresse jeg skal åbne i min browser for at se siden.
(Du åbner typisk `http://localhost:3000` — det er din private testudgave, som kun findes på din egen computer.)

**Prompt 3 — Supabase forbindes:**
> Opret en .env.local-fil med pladsholdere til Supabase (URL, anon key, service role key) og AI-nøglen, og vis mig præcis, hvilke linjer jeg selv skal udfylde. Sæt derefter Supabase-klienten op i projektet, og skriv den første SQL-migration: profiles-tabellen fra CLAUDE.md med Row Level Security og policies. Forklar mig, hvordan jeg kører migrationen mod mit Supabase-projekt.
(Herefter indsætter du selv nøglerne fra din note i `.env.local` — det er den ene tekniske handling, du altid gør selv.)

**Prompt 4 — live på nettet:**
Dette gøres i Vercels dashboard, ikke i Claude Code: klik **Add New → Project**, vælg dit GitHub-repository, og under *Environment Variables* indtaster du de samme nøgler som i `.env.local`. Klik Deploy. Fra nu af udgives hver eneste ændring, du (og Claude Code) pusher til GitHub, automatisk — og du har en rigtig URL at vise frem.

Herefter fortsætter du blot byggeplanen fra det tekniske oplæg med én prompt pr. trin: "Byg trin 1 fra docs/teknisk-oplaeg-v1.md (login med magic link og Google via Supabase Auth). Følg CLAUDE.md." — og så fremdeles.

---

## Fem vaner, der gør vibe coding trygt

- **Én ting ad gangen.** Små prompts = små, forståelige ændringer, der er lette at rulle tilbage.
- **Test i browseren efter hvert trin** på localhost, før du beder om det næste.
- **Bed altid om forklaring:** "…og forklar mig på dansk, hvad du ændrede, og hvorfor" må gerne stå i hver prompt.
- **Commit ofte.** Bed Claude Code committe efter hvert vellykket trin — så er der altid et punkt at vende tilbage til. Går noget i stykker: "rul tilbage til sidste commit" løser det.
- **Nøgler er dine.** Claude Code laver pladsholderne; du indsætter selv værdierne. Deler du aldrig service_role- og AI-nøgler andre steder end .env.local og Vercels dashboard, kan meget lidt gå rigtig galt.
