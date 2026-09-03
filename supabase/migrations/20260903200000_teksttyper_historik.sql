-- Migration 0017 — teksttyper kan redigeres af ejeren, og hver udgave gemmes
--
-- Indtil nu blev en teksttype til ved, at nogen skrev en migrationsfil og
-- kørte den i Supabase. Det virker, men det betyder, at ejeren ikke kan lave
-- en teksttype uden mig. Det er dét, adminsiden retter.
--
-- PRISEN VED AT FLYTTE PROMPTERNE UD AF REPOET
-- I dag har hver ændring af en prompt en begrundelse i git. Migration 0004,
-- 0006, 0010 og 0016 er tilsammen en skreven historie om, HVORFOR reglerne
-- ser ud, som de gør: hvilken fejl i en rigtig tekst der fremtvang hver
-- enkelt. Redigeres prompten i en formular, forsvinder den historie, og en
-- teksttype, der pludselig skriver dårligere, er svær at spore tilbage.
--
-- `template_versions` er det billigste, der virker: FØR hver gemning lægges
-- den nuværende udgave herned med tidspunkt og hvem der gemte. Det er ikke
-- git, og det fanger ikke begrundelsen — men ingen ændring er sporløs, og
-- man kan komme tilbage til en udgave, der virkede.
--
-- INGEN NYE POLICIES PÅ `templates`
-- Skabeloner kan stadig kun læses af indloggede, og kun de aktive. Der
-- kommer ikke en insert- eller update-policy: skrivning sker gennem
-- serveren med service_role, EFTER at koden selv har slået fast, at det er
-- adminkontoen (sikkerhedsreglernes punkt 6). Adgangen skal ét sted hen,
-- ikke to.

-- Skabeloner har hidtil ikke haft tidsstempler. Uden dem kan listen i
-- adminsiden ikke vise, hvad der sidst blev rørt.
alter table public.templates
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  -- Selve indholdet, som det så ud FØR den gemning, der udløste rækken.
  slug text not null,
  name text not null,
  description text,
  system_prompt text not null,
  input_fields jsonb not null,
  active boolean not null,
  -- Hvem og hvornår. Ikke en fremmednøgle til auth.users: forsvinder kontoen,
  -- skal historikken ikke forsvinde med den.
  saved_by uuid,
  saved_by_email text,
  saved_at timestamptz not null default now()
);

comment on table public.template_versions is
  'Tidligere udgaver af en teksttype. Skrives før hver gemning fra adminsiden.';

create index template_versions_template_idx
  on public.template_versions (template_id, saved_at desc);

-- RLS med NUL policies: ingen almindelig bruger kan læse eller skrive her,
-- heller ikke adminkontoen gennem sin egen forbindelse. Historikken læses og
-- skrives udelukkende af serverkode med service_role, som først har
-- kontrolleret, at det er adminen. En tabel uden policies er lukket, og det
-- er med vilje: her ligger hele grundlaget for, hvad modellen gør.
alter table public.template_versions enable row level security;

-- Første udgave af hver nuværende teksttype, så historikken ikke starter tom.
-- Uden den ville den allerførste redigering i adminsiden se ud, som om der
-- aldrig havde stået noget andet.
insert into public.template_versions (
  template_id, slug, name, description, system_prompt, input_fields, active,
  saved_by_email, saved_at
)
select id, slug, name, description, system_prompt, input_fields, active,
       'migration 0017', now()
from public.templates;
