# NettoText

Dansk SaaS til generering og opdatering af webtekster. Se [CLAUDE.md](CLAUDE.md) for
projektets regler, datamodel, driftsmodel og designsystem — den er gældende for al kode.

**Live:** https://nettotext.vercel.app (`nettotext.com` kobles på ved lancering)
Hvert push til `main` udgives automatisk af Vercel.

## Kom i gang

```bash
npm install
npm run dev
```

Åbn derefter http://localhost:3000 — du bliver sendt videre til `/da`.

## Miljøvariabler

Kopiér `.env.example` til `.env.local` og udfyld værdierne. `.env.local` er
udelukket i `.gitignore` og må aldrig committes.

## Mapper

| Mappe | Indhold |
|---|---|
| `app/` | Siderne. `app/[locale]/` er marketing-siderne på `/da/` |
| `components/ui/` | shadcn/ui-komponenter (knapper, felter m.m.) |
| `i18n/` | Sprogopsætning for next-intl |
| `lib/` | Hjælpefunktioner og klienter (Supabase, AI-adapter) |
| `messages/` | Alle UI-tekster. `da.json` er den eneste sandhed — aldrig hardcodet tekst |
| `supabase/migrations/` | SQL-migrationer. Databasen ændres kun via filer her |
| `docs/` | Produktvision, teknisk oplæg, beslutningslog, status og de faste regler |
| `design/` | Visuel facit for landingssiden |

## Stak

Next.js (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · next-intl · Supabase · Vercel
