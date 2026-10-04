-- Migration 0031 — adminen vælger, hvilken model platformens nøgle skriver med
--
-- Standardmodellen stod indtil nu i koden (STANDARDMODEL i
-- lib/ai/modeller.ts) og var Sonnet 5, valgt 25.08.2026, fordi den var
-- hurtigere og billigere, og dansken var lige så god.
--
-- Gennemgangen af blogindlægget 03.10.2026 gav et andet billede på lange
-- tekster med almen viden: Opus 5 skrev 1.083 ord i første forsøg, hvor
-- Sonnet skrev 750 til 880 og skulle udvides, og Opus brugte ingen af de
-- vendinger, skrivevejledningen forbyder. Ejerens beslutning: de bedste
-- tekster, og den ekstra omkostning er accepteret.
--
-- Valget skal kunne ændres uden en udrulning, og derfor ligger det i
-- databasen og ikke i en miljøvariabel.
--
-- `app_settings` er en nøgle/værdi-tabel til indstillinger for HELE appen.
-- Den har Row Level Security slået til og INGEN policies: ingen bruger kan
-- hverken læse eller skrive i den. Kun service_role kommer ind, og koden,
-- der bruger den, tjekker først, at det er adminkontoen (lib/admin.ts).
--
-- Rækkefølgen ved udrulning er ligegyldig denne gang: findes tabellen ikke,
-- falder koden tilbage på STANDARDMODEL.

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.app_settings is
  'Indstillinger for hele appen, sat af adminen. Ingen policies: kun service_role.';

alter table public.app_settings enable row level security;

-- Ejerens valg 04.10.2026. Kan ændres på adminsidens forside.
insert into public.app_settings (key, value)
values ('platform_model', 'claude-opus-5');
