-- Migration 0013 — brand-profil og gemte instruktioner
--
-- Trin 5. Teksterne skal lyde som brugerens virksomhed, uden at hun skriver
-- det samme i hver eneste brief.
--
-- To tabeller, fordi det er to slags ting. Brand-profilen beskriver
-- VIRKSOMHEDEN og ændrer sig sjældent. Instruktionerne er ØNSKER til
-- skrivningen, og dem samler man på, én ad gangen, efterhånden som man
-- opdager, hvad man vil have gjort anderledes.
--
-- Begge dele havner i prompten som TYDELIGT AFGRÆNSEDE blokke, der
-- supplerer systemets regler — CLAUDE.md regel 5. De kan påvirke indhold,
-- tone og ordvalg. De kan ikke ændre reglerne eller outputformatet.

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),

  -- Én profil pr. bruger i V1. Skal en bruger senere have flere brands, er
  -- det unique-betingelsen her, der skal væk — og et valg i briefen, der
  -- skal til.
  user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Hvad laver virksomheden? Længderne er værn mod at bruge felterne som
  -- lager, ikke sproglige krav. De koster også penge: alt herfra sendes med
  -- i HVER generering.
  company_description text check (char_length(company_description) <= 2000),

  -- Hvordan skal det lyde? "Ligefrem og konkret. Ikke højtideligt."
  tone text check (char_length(tone) <= 500),

  -- Ord, hun ikke vil se. Et array og ikke en tekst, fordi det ER en liste —
  -- og fordi prompten skal kunne skrive dem ud ét for ét.
  banned_words text[] not null default '{}'
    check (array_length(banned_words, 1) is null or array_length(banned_words, 1) <= 50),

  -- Et stykke tekst, hun selv har skrevet, som modellen kan lyde som.
  -- Det stærkeste af de fire felter: et eksempel siger mere om tone end
  -- nogen beskrivelse af den.
  style_sample text check (char_length(style_sample) <= 4000),

  updated_at timestamptz not null default now()
);

comment on table public.brand_profiles is
  'Brugerens brand-profil. Indsættes i prompten som afgrænset blok, jf. CLAUDE.md regel 5.';

create table public.instructions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- 'global' er den eneste værdi i V1. Kolonnen står her allerede, fordi
  -- datamodellen i CLAUDE.md siger det, og fordi alternativet — at tilføje
  -- den senere — kræver en migration på en tabel med data i.
  scope text not null default 'global' check (scope in ('global')),

  -- Skal instruktionen kun gælde én teksttype? Null i V1 = den gælder alle.
  text_type text,

  -- Kort med vilje. En instruktion er en regel, ikke et afsnit. Skal der
  -- skrives mere, hører det til i brand-profilen.
  content text not null check (char_length(content) between 1 and 500),

  created_at timestamptz not null default now()
);

comment on table public.instructions is
  'Gemte instruktioner, der genbruges på tværs af tekster. Se CLAUDE.md regel 5.';

alter table public.brand_profiles enable row level security;
alter table public.instructions enable row level security;

/*
  Otte policies, fire pr. tabel — samme mønster som drafts og ai_keys.
  Brugeren kan kun røre sine egne rækker, og det er databasen, der siger nej.
  Ingen service_role nogen steder i personaliseringen: der er ikke noget
  ejer-tjek i koden, der kan glemmes, fordi der ikke er noget tjek.
*/
create policy "Brugere kan læse egen brand-profil"
  on public.brand_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Brugere kan oprette egen brand-profil"
  on public.brand_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan opdatere egen brand-profil"
  on public.brand_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan slette egen brand-profil"
  on public.brand_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Brugere kan læse egne instruktioner"
  on public.instructions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Brugere kan oprette egne instruktioner"
  on public.instructions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan opdatere egne instruktioner"
  on public.instructions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan slette egne instruktioner"
  on public.instructions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Genereringen spørger altid om det samme: mine instruktioner, ældste først,
-- så rækkefølgen i prompten er den, brugeren skrev dem i.
create index instructions_bruger_tid_idx
  on public.instructions (user_id, created_at);
