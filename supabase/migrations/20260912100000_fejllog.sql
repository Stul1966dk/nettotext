-- Migration 0020 — fejllog
--
-- Indtil nu er en fejl på serveren endt i `console.error` og dermed i
-- Vercels logs. De kan læses, men kun hvis man ved, at der ER sket noget,
-- og de forsvinder efter kort tid. I praksis betyder det, at en bruger kan
-- ramme den samme fejl hver dag i en uge, uden at nogen opdager det.
--
-- Valget stod mellem Sentry og en tabel. Ejeren valgte tabellen: ingen ny
-- tredjepart, ingen data ud af huset. Prisen er, at ingen bliver ringet op
-- når noget brænder — man skal selv kigge. Se docs/beslutninger.md.
--
-- HVAD DER ALDRIG MÅ LANDE HER: tekstindhold, briefer, mailadresser eller
-- noget, der ligner en API-nøgle. CLAUDE.md regel 9 gælder også vores egen
-- fejllog. Saneringen sker i lib/fejl.ts, FØR rækken skrives.

create table public.error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Hvor fejlen skete, som mennesker kender stedet: "POST /api/generate".
  sted text not null,

  -- Fejlens egen besked, afkortet. Aldrig brugerens tekst.
  besked text not null,

  -- Det tekniske spor (stack), afkortet. Findes ikke altid.
  spor text,

  -- Hvem det ramte. Kun id'et — aldrig mailadresse eller navn.
  -- `cascade`, fordi "slet min konto" skal kunne slette ALLE brugerens
  -- rækker i alle tabeller (CLAUDE.md regel 9). En fejl fra en slettet
  -- konto er ikke værd at beholde.
  user_id uuid references auth.users (id) on delete cascade,

  -- Små, ufarlige nøgletal: teksttype, leverandør, model, statuskode.
  -- Hvad der må stå her, håndhæves i lib/fejl.ts.
  ekstra jsonb not null default '{}'::jsonb
);

comment on table public.error_log is
  'Fejl fra serveren. Kun adminen læser den, med service_role. Aldrig tekstindhold. Ryddes efter 30 dage.';

alter table public.error_log enable row level security;

/*
  INGEN POLICIES. Det er med vilje, ikke en forglemmelse.

  Sikkerhedsreglernes punkt 1 siger: RLS på alle tabeller og eksplicitte
  policies. Her er den eksplicitte beslutning, at ingen almindelig bruger
  må røre tabellen — hverken læse eller skrive. Med RLS slået til og nul
  policies er svaret nej til alle, både `anon` og `authenticated`.

  Det er kun `service_role`, der kommer ind, og den bruges to steder:
  lib/fejl.ts skriver, og adminsiden læser EFTER at have slået fast, at
  det er adminen (sikkerhedsreglernes punkt 6: tjek adgang FØR du henter
  data uden om RLS).
*/

-- Adminsiden spørger altid om det samme: de nyeste fejl først.
create index error_log_tid_idx on public.error_log (created_at desc);

/*
  Oprydning efter 30 dage.

  En fejllog, der vokser i det uendelige, bliver aldrig læst, og den er
  et voksende sted for oplysninger at samle sig. Tredive dage er rigeligt
  til at opdage et mønster og for kort til at blive et arkiv.

  Kører 03:10 UTC — ti minutter efter kladde-oprydningen, så de to jobs
  ikke starter oven i hinanden. pg_cron er allerede slået til (migration
  0011); fejler linjerne herunder, er udvidelsen blevet slået fra igen.
*/
create extension if not exists pg_cron;

select cron.unschedule('slet-gamle-fejl')
 where exists (select 1 from cron.job where jobname = 'slet-gamle-fejl');

select cron.schedule(
  'slet-gamle-fejl',
  '10 3 * * *',
  $$ delete from public.error_log where created_at < now() - interval '30 days' $$
);
