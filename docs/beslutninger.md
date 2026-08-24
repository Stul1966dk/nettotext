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
- [ ] **Privatlivspolitik** på `/da/privatliv` (GDPR, jf. teknisk oplæg afsnit 5).
- [ ] **Opdatér brandnavnet** i `design/design-3-vaerksted.html` til NettoText.

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
