-- Migration 0009 — rate limit pr. bruger
--
-- CLAUDE.md regel 6, punkt (c): maks. 3 genereringskald i minuttet pr. bruger.
--
-- Punktet blev aktuelt, da det blev besluttet, at det ikke koster en
-- prøvetekst at få skrevet ét afsnit om. Prøvekvoten var indtil nu det, der
-- holdt den enkelte bruger i skak; er afsnit gratis, er den bremse væk, og
-- så kan én bruger tømme dagens budget ved at klikke løs. Budgetloftet ville
-- fange det til sidst — men først når pengene var brugt, og for alle andre
-- brugere på én gang.
--
-- Hvorfor en tabel og ikke bare et tal i hukommelsen: appen kører på Vercel,
-- hvor hvert kald kan ramme sin egen instans. Et tal i hukommelsen ville
-- tælle hver instans for sig og dermed tillade mange gange for meget.

create table public.rate_limit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.rate_limit is
  'Ét forsøg pr. række. Ryddes løbende af tag_plads_i_koeen.';

alter table public.rate_limit enable row level security;

-- Ingen policies overhovedet. Tabellen rører brugeren aldrig, hverken for at
-- læse eller skrive — kunne hun slette sine egne rækker, kunne hun nulstille
-- sin egen grænse. Kun serverkode med service_role kommer til.

create index rate_limit_bruger_tid_idx
  on public.rate_limit (user_id, created_at desc);

/*
  Tager plads i køen, hvis der er plads. Returnerer false, hvis brugeren har
  brugt sine forsøg inden for vinduet.

  Den rådgivende lås er det, der gør tællingen sand. Uden den kunne to
  samtidige kald begge nå at tælle "2 forsøg indtil videre" og begge få lov —
  samme slags fejl som ved prøvekvoten, hvor løsningen var at lade databasen
  afgøre sagen. Låsen gælder kun denne ene bruger og slippes, når kaldet er
  ovre.

  Gamle rækker ryddes ved samme lejlighed. Så bliver tabellen aldrig større,
  end det vindue den skal kunne huske, og der er ikke et natligt job at
  vedligeholde.
*/
create function public.tag_plads_i_koeen(
  bruger uuid,
  loft integer,
  vindue interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  antal integer;
begin
  perform pg_advisory_xact_lock(hashtext(bruger::text));

  delete from public.rate_limit
   where user_id = bruger
     and created_at < now() - vindue;

  select count(*) into antal
    from public.rate_limit
   where user_id = bruger
     and created_at > now() - vindue;

  if antal >= loft then
    return false;
  end if;

  insert into public.rate_limit (user_id) values (bruger);
  return true;
end;
$$;

comment on function public.tag_plads_i_koeen is
  'Registrerer ét forsøg. Returnerer false, hvis brugerens grænse er nået.';

-- Samme forbehold som ved kvotefunktionerne: security definer skriver hen
-- over Row Level Security. Kunne en indlogget bruger kalde funktionen
-- direkte gennem Supabases API, kunne hun bruge en fremmed brugers forsøg op.
revoke execute on function public.tag_plads_i_koeen(uuid, integer, interval) from public, anon, authenticated;
grant execute on function public.tag_plads_i_koeen(uuid, integer, interval) to service_role;
