-- Migration 0001 — nettotext-skema og profiles
--
-- Denne database deles med andre projekter. Derfor får NettoText sit eget
-- skema, og migrationen rører intet, der findes i forvejen: hverken public,
-- auth.users eller andre projekters tabeller.
--
-- create schema uden "if not exists" med vilje: findes navnet allerede,
-- fejler hele scriptet og ruller tilbage, i stedet for at skrive i noget
-- eksisterende.

create schema nettotext;

comment on schema nettotext is 'NettoText (nettotext.com). Adskilt fra andre projekter i samme database.';

-- Et nyt skema er lukket som udgangspunkt. Rollerne skal have lov at kigge ind,
-- før de kan bruge tabellerne nedenfor.
grant usage on schema nettotext to anon, authenticated, service_role;

-- Én række pr. bruger. Udvider Supabases auth.users med de felter,
-- NettoText selv har brug for. Se datamodellen i CLAUDE.md.
create table nettotext.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free')),
  -- Engangs-prøvekvote betalt af PLATFORM_AI_KEY. Ikke månedlig.
  trial_quota integer not null default 5 check (trial_quota >= 0),
  trial_used integer not null default 0 check (trial_used >= 0),
  created_at timestamptz not null default now()
);

comment on table nettotext.profiles is
  'Brugerprofil med engangs-prøvekvote. Kvoten opdateres kun server-side.';

-- Row Level Security: når den er slået til, kan ingen læse eller skrive
-- noget som helst, før en policy udtrykkeligt tillader det.
alter table nettotext.profiles enable row level security;

-- Brugeren må se sin egen profil — og kun sin egen.
create policy "Brugere kan læse egen profil"
  on nettotext.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Med vilje INGEN insert-, update- eller delete-policy:
-- kunne brugeren opdatere sin egen række, kunne hun nulstille trial_used og
-- generere gratis tekster på platformens regning i det uendelige. Rækken
-- oprettes og kvoten ændres derfor kun af serverkode med service_role-nøglen,
-- som omgår RLS.
grant select on nettotext.profiles to authenticated;
grant all on nettotext.profiles to service_role;
