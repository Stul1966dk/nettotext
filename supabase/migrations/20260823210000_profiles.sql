-- Migration 0001 — profiles
--
-- Én række pr. bruger. Udvider Supabases indbyggede auth.users-tabel med de
-- felter, NettoText selv har brug for. Se datamodellen i CLAUDE.md.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free')),
  -- Engangs-prøvekvote betalt af PLATFORM_AI_KEY. Ikke månedlig.
  trial_quota integer not null default 5 check (trial_quota >= 0),
  trial_used integer not null default 0 check (trial_used >= 0),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Brugerprofil med engangs-prøvekvote. Kvoten opdateres kun server-side.';

-- Row Level Security: når den er slået til, kan ingen læse eller skrive
-- noget som helst, før en policy udtrykkeligt tillader det.
alter table public.profiles enable row level security;

-- Brugeren må se sin egen profil — og kun sin egen.
create policy "Brugere kan læse egen profil"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Med vilje INGEN insert-, update- eller delete-policy:
-- kunne brugeren opdatere sin egen række, kunne hun nulstille trial_used og
-- generere gratis tekster på platformens regning i det uendelige. Kvoten
-- ændres derfor kun af serverkode med service_role-nøglen, som omgår RLS.

-- Opret automatisk en profil, når en ny bruger registrerer sig.
-- security definer = funktionen kører med ejerens rettigheder og må derfor
-- indsætte rækken, selvom ingen insert-policy findes.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
