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
- [ ] **Kobl `nettotext.com` på** i Vercel → Settings → Domains.
- [ ] **Privatlivspolitik** på `/da/privatliv` (GDPR, jf. teknisk oplæg afsnit 5).
- [ ] **Opdatér brandnavnet** i `design/design-3-vaerksted.html` til NettoText.

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
