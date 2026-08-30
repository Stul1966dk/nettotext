-- Migration 0011 — kladder med udløb
--
-- CLAUDE.md regel 7: intet tekstindhold gemmes permanent. Færdige tekster
-- gemmes ALDRIG. Kladder må ligge i 48 timer og slettes derefter.
--
-- Indtil nu har teksten kun levet i browserens sessionStorage. Lukkede
-- brugeren fanen, var arbejdet væk. Det er billigt for os og dyrt for hende.

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_slug text not null,
  -- Briefen, teksten i blokke og meta-felterne. Se lib/kladder.ts for formen.
  content jsonb not null,
  -- Ruller ved hver gemning: 48 timer fra SIDSTE rettelse, ikke fra den
  -- første. En kladde, man arbejder på tredje dag, skal ikke forsvinde under
  -- hænderne på en.
  expires_at timestamptz not null default now() + interval '48 hours',
  updated_at timestamptz not null default now()
);

comment on table public.drafts is
  'Kladder med 48 timers udløb. Slettes af pg_cron. Se CLAUDE.md regel 7.';

alter table public.drafts enable row level security;

/*
  Fire policies, én pr. handling. Bemærk `expires_at > now()` i select:
  en udløbet kladde er USYNLIG i samme sekund, den udløber — også selvom
  rækken stadig ligger der.

  Det er med vilje en sele ud over selerne. Oprydningsjobbet kører én gang i
  døgnet, og går det i stå, ville kladder ellers kunne læses i dagevis efter,
  de var lovet slettet. Løftet til brugeren er 48 timer, og det løfte skal
  ikke afhænge af, at et natligt job kørte.
*/
create policy "Brugere kan læse egne kladder, der ikke er udløbet"
  on public.drafts
  for select
  to authenticated
  using ((select auth.uid()) = user_id and expires_at > now());

create policy "Brugere kan oprette egne kladder"
  on public.drafts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan opdatere egne kladder"
  on public.drafts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan slette egne kladder"
  on public.drafts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Dashboardet spørger altid om det samme: mine kladder, nyeste først.
create index drafts_bruger_tid_idx
  on public.drafts (user_id, updated_at desc);

-- Oprydningsjobbet spørger om noget andet: hvad er udløbet, uanset ejer.
create index drafts_udloeb_idx on public.drafts (expires_at);

/*
  Det natlige oprydningsjob.

  Kører 03:00 UTC, altså i den stille time. Sletter alt, hvis expires_at er
  passeret. Rækkerne er allerede usynlige for brugeren på det tidspunkt —
  jobbet er dét, der gør sletningen ægte, så teksten ikke bare er skjult, men
  faktisk væk. Det er forskellen på at overholde regel 7 og at se ud som om.

  pg_cron skal være slået til i Supabase, før linjerne herunder virker:
  Database → Extensions → søg efter pg_cron → slå til. Fejler create extension,
  er det dét, der mangler.
*/
create extension if not exists pg_cron;

-- Kør migrationen om, og jobbet skal ikke oprettes to gange.
select cron.unschedule('slet-udloebne-kladder')
 where exists (select 1 from cron.job where jobname = 'slet-udloebne-kladder');

select cron.schedule(
  'slet-udloebne-kladder',
  '0 3 * * *',
  $$ delete from public.drafts where expires_at < now() $$
);
