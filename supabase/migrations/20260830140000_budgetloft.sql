-- Migration 0008 — usage_log og det globale budgetloft
--
-- CLAUDE.md regel 6 kræver, at alt der koster penge går gennem serveren med
-- tjek af (a) login, (b) kvote eller egen nøgle, (c) rate limit og (d) et
-- globalt dagligt budgetloft på platformens nøgle. Punkt (d) mangler, og
-- indtil nu har prøvekvoten på 5 tekster været den eneste bremse — en bremse,
-- der er sat ud af kraft på ejerkontoen, som står på 1.000.000.
--
-- Loftet skal vide, hvad der er brugt i dag. Derfor kommer usage_log med her,
-- selvom byggeplanen lægger den i trin 6: uden den er der ikke noget at måle
-- imod.
--
-- VIGTIGT om hvad der IKKE står i tabellen: kun metadata. Aldrig et ord af
-- brugerens brief eller af den færdige tekst. Se CLAUDE.md regel 9.

create table public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_slug text not null,
  provider text not null check (provider in ('anthropic', 'openai')),
  model text not null,
  paid_by text not null check (paid_by in ('platform', 'user')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Skøn i DANSKE KRONER, ikke dollars. Leverandørerne priser i dollars, men
  -- loftet er sat i kroner, og en omregning ét sted er nemmere at stole på
  -- end to enheder i samme tabel. Omregningen sker i lib/ai/pris.ts.
  -- Et skøn, ikke en faktura: den rigtige regning kommer fra leverandøren.
  estimated_cost numeric(10, 4) not null default 0 check (estimated_cost >= 0),
  -- Tommel op (1) eller ned (-1) fra feedback-widgetten i trin 6.
  feedback smallint check (feedback in (-1, 1)),
  feedback_comment text,
  created_at timestamptz not null default now()
);

comment on table public.usage_log is
  'Forbrugslog. Kun metadata og tal — aldrig tekstindhold eller persondata.';

alter table public.usage_log enable row level security;

-- Brugeren må se sit eget forbrug, så hun kan holde øje med, hvad hendes
-- egen nøgle koster.
create policy "Brugere kan læse eget forbrug"
  on public.usage_log
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Med vilje INGEN insert-, update- eller delete-policy. Kunne brugeren selv
-- skrive i loggen, kunne hun slette dagens forbrug og dermed nulstille
-- budgetloftet. Rækkerne skrives kun af serverkode med service_role.
-- Feedback i trin 6 skal derfor også gå gennem en API-rute, ikke direkte.

-- Loftet spørger om ét tal mange gange i træk: hvad har platformen brugt i
-- dag? Et delvist indeks holder det opslag billigt, uanset hvor stor loggen
-- bliver, og fylder kun for de rækker, spørgsmålet handler om.
create index usage_log_platform_dag_idx
  on public.usage_log (created_at)
  where paid_by = 'platform';

-- Dagen er en DANSK dag, ikke en UTC-dag. Ellers ville loftet nulstille sig
-- klokken 01 eller 02 om natten dansk tid, og en aftens forbrug ville blive
-- delt over to budgetter.
create function public.platform_forbrug_i_dag()
returns numeric
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(sum(estimated_cost), 0)
    from public.usage_log
   where paid_by = 'platform'
     and created_at >= date_trunc(
           'day', (now() at time zone 'Europe/Copenhagen')
         ) at time zone 'Europe/Copenhagen';
$$;

comment on function public.platform_forbrug_i_dag is
  'Sum i DKK af det, platformens nøgle har kostet i dag (dansk tid).';

-- Samme forbehold som ved kvotefunktionerne: security definer betyder, at
-- funktionen læser hen over Row Level Security. Den afslører kun ét samlet
-- tal og ingen personoplysninger, men den hører til serverkoden, ikke til
-- browseren, og holdes derfor uden for anon og authenticated.
revoke execute on function public.platform_forbrug_i_dag() from public, anon, authenticated;
grant execute on function public.platform_forbrug_i_dag() to service_role;
