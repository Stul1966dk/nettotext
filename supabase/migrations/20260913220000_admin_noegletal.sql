-- Migration 0024 — nøgletal til adminsiden
--
-- Den anden halvdel af adminsiden, jf. docs/status.md. Alt herunder findes
-- allerede som metadata i `usage_log`, `profiles` og `drafts`. Der gemmes
-- IKKE noget nyt for at kunne vise siden, og der er intet tekstindhold i
-- nogen af funktionerne. CLAUDE.md regel 9 kender ingen undtagelse for
-- ejeren, og `usage_log` indeholder med vilje ingen tekst at vise.
--
-- Hvorfor det regnes i databasen og ikke i JavaScript: tallene er summer og
-- optællinger over en tabel, der vokser med hvert eneste kald. At hente
-- rækkerne hjem for at lægge dem sammen virker fint i dag og holder op med
-- at virke stille og roligt. Postgres lægger sammen i forvejen.
--
-- Begge funktioner er `security definer` og læser hen over Row Level
-- Security. De afslører kun summer og optællinger — ingen tekst, ingen
-- mailadresser, ingen bruger-id'er. De hører alligevel til i serverkoden og
-- holdes uden for `anon` og `authenticated`, og adgangen afgøres FØR de
-- kaldes, i app/app/admin/layout.tsx (sikkerhedsreglernes punkt 6).
--
-- Dansk tid hele vejen, som i `platform_forbrug_i_dag`: "i dag" skal betyde
-- det samme for ejeren som for brugerne.
--
-- `create or replace` og ikke `create`: filen indeholder to funktioner, og
-- fejler den anden, skal den første ikke spærre for at køre filen igen.

create or replace function public.admin_noegletal()
returns table (
  forbrug_i_dag_platform numeric,
  forbrug_i_dag_bruger numeric,
  forbrug_maaned_platform numeric,
  forbrug_maaned_bruger numeric,
  tekster_i_alt bigint,
  tekster_kroner numeric,
  tokens_ind bigint,
  tokens_ud bigint,
  proevetekster_givet bigint,
  brugere_i_alt bigint,
  brugere_ny_uge bigint,
  kladder bigint,
  feedback_op bigint,
  feedback_ned bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with graenser as (
    select
      date_trunc('day', (now() at time zone 'Europe/Copenhagen'))
        at time zone 'Europe/Copenhagen' as dag,
      date_trunc('month', (now() at time zone 'Europe/Copenhagen'))
        at time zone 'Europe/Copenhagen' as maaned,
      now() - interval '7 days' as uge
  )
  select
    -- Forbrug. Delt på hvem der betalte, så platformens egen omkostning kan
    -- skelnes fra det, brugerne selv betaler med deres egen nøgle.
    coalesce(sum(u.estimated_cost)
      filter (where u.paid_by = 'platform' and u.created_at >= g.dag), 0),
    coalesce(sum(u.estimated_cost)
      filter (where u.paid_by = 'user' and u.created_at >= g.dag), 0),
    coalesce(sum(u.estimated_cost)
      filter (where u.paid_by = 'platform' and u.created_at >= g.maaned), 0),
    coalesce(sum(u.estimated_cost)
      filter (where u.paid_by = 'user' and u.created_at >= g.maaned), 0),

    -- Tekster. KUN slags = 'tekst': omskrivninger, idéforslag og
    -- faktaudtræk er ikke tekster, og en tekst kan sagtens udløse fem
    -- omskrivninger. Bemærk at rækker fra FØR 07.09.2026 alle står som
    -- 'tekst', også de omskrivninger der ligger blandt dem — det kan ikke
    -- rettes bagud, og tallet er derfor lidt for højt for den periode.
    count(*) filter (where u.slags = 'tekst'),
    coalesce(sum(u.estimated_cost) filter (where u.slags = 'tekst'), 0),
    coalesce(sum(u.input_tokens) filter (where u.slags = 'tekst'), 0),
    coalesce(sum(u.output_tokens) filter (where u.slags = 'tekst'), 0),

    -- Prøvekvote: hvor mange gratis tekster der er givet væk i alt. Det er
    -- dét tal, der afgør, om de fem prøvetekster er sat rigtigt.
    (select coalesce(sum(p.trial_used), 0) from public.profiles p),

    (select count(*) from public.profiles p),
    (select count(*) from public.profiles p
      where p.created_at >= g.uge),

    -- Kladder lige nu. ANTAL, aldrig indhold. Udløbne tælles ikke med:
    -- de er væk for brugeren, også selvom pg_cron først rydder i nat.
    (select count(*) from public.drafts d where d.expires_at > now()),

    count(*) filter (where u.feedback = 1),
    count(*) filter (where u.feedback = -1)
  from graenser g
  left join public.usage_log u on true
  group by g.dag, g.maaned, g.uge;
$$;

comment on function public.admin_noegletal is
  'Summer og optællinger til adminsiden. Kun tal — aldrig tekstindhold eller persondata.';

revoke execute on function public.admin_noegletal() from public, anon, authenticated;
grant execute on function public.admin_noegletal() to service_role;

-- ---------------------------------------------------------------------------
-- Fordelingen: hvilke teksttyper bliver skrevet, og med hvilken model
-- ---------------------------------------------------------------------------
--
-- Egen funktion, fordi det er en LISTE og ikke et tal. At presse den ned i
-- den samme række ville betyde jsonb-byggeri i SQL og udpakning i
-- TypeScript — to steder at tage fejl for at spare ét opslag.

create or replace function public.admin_tekster_fordelt()
returns table (
  template_slug text,
  model text,
  antal bigint,
  kroner numeric
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.template_slug,
    u.model,
    count(*),
    coalesce(sum(u.estimated_cost), 0)
  from public.usage_log u
  where u.slags = 'tekst'
  group by u.template_slug, u.model
  order by count(*) desc, u.template_slug;
$$;

comment on function public.admin_tekster_fordelt is
  'Skrevne tekster fordelt på teksttype og model. Kun optællinger.';

revoke execute on function public.admin_tekster_fordelt() from public, anon, authenticated;
grant execute on function public.admin_tekster_fordelt() to service_role;
