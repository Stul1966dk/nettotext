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

## Mindre huller, der ikke hører til et bestemt trin

- **Redigér og slet en blok i hånden.** Det tekniske oplæg beskriver editoren
  som "pr. blok: redigér, Regenerér denne sektion, slet". Regenerering er
  bygget; manuel redigering og sletning er ikke. Det koster ingen AI-kald og
  er formentlig værd at have — nogle gange vil man bare rette ét ord.
- **Den lange tekstlængde (1.400 ord) er stadig ikke afprøvet i produktion.**
  Se noten om `maxDuration` på tjeklisten. Opdelt generering sektion for
  sektion er den foretrukne løsning, og blokkene fra trin 3 er fundamentet.
