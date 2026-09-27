-- Migration 0026 — materiale til hver teksttype
--
-- Ejeren vil kunne lægge vejledninger og eksempler ind til hver teksttype:
-- beskrivelser skrevet af anerkendte tekstforfattere af, hvordan en god
-- produkttekst eller kategoritekst skrives, og eksempler på tekster, der
-- rammer niveauet. Materialet lægges ind i systemprompten ved hver tekst af
-- den type, lige efter skrivevejledningen.
--
-- KUN TEKST, INGEN FILER
-- Materialet kommer ind som .txt, .md eller indsat tekst, og filen læses i
-- browseren. Det er teksten, der gemmes — ikke filen. Derfor ingen Storage-
-- bucket og ingen bucket-policies at holde styr på.
--
-- LUKKET TABEL, SOM TEMPLATE_VERSIONS
-- RLS er slået til med NUL policies. Materialet kan være ophavsretligt
-- beskyttet tekst, som ejeren må bruge internt, men ikke må udlevere. Havde
-- tabellen en læse-policy som `templates`, kunne enhver indlogget bruger
-- hente det hele direkte fra Supabase med den offentlige nøgle, uden om
-- appen. Nu læses det kun af serverkode med service_role: ved generering
-- (hvor det kun sendes til AI-leverandøren) og på adminsiden (efter
-- admin-tjekket).
--
-- LOFTERNE
-- Hvert stykke materiale højst 20.000 tegn. Loftet for det samlede,
-- aktive materiale pr. teksttype står i koden (lib/skabeloner/materiale.ts),
-- fordi det skal holdes op mod prisen, og prisen står i koden.

create table public.template_materials (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  kind text not null check (kind in ('vejledning', 'eksempel')),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 20000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.template_materials is
  'Vejledninger og eksempler til en teksttype. Lægges i systemprompten. Læses kun med service_role.';

create index template_materials_template_idx
  on public.template_materials (template_id, created_at);

alter table public.template_materials enable row level security;
