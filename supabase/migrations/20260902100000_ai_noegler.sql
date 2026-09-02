-- Migration 0012 — brugernes egne AI-nøgler (BYOK)
--
-- Driftsmodellen i CLAUDE.md: de første 5 tekster betaler platformen, og
-- derefter skriver brugeren videre med sin egen nøgle. Indtil nu har den
-- anden halvdel ikke eksisteret — vaelgNoegle kastede ManglerNoegle, og
-- appen stoppede efter den femte tekst. Det er dét, den her tabel åbner.
--
-- CLAUDE.md regel 2: nøglen krypteres i databasen og dekrypteres KUN
-- server-side i genererings-øjeblikket. Krypteringen sker i Node med
-- AES-256-GCM, se lib/kryptering.ts og begrundelsen i docs/beslutninger.md.
-- Databasen ser aldrig andet end den krypterede tekst.

create table public.ai_keys (
  id uuid primary key default gen_random_uuid(),

  -- Én nøgle pr. bruger. Skifter hun leverandør, erstattes rækken.
  -- Besluttet 02.09.2026: hun kan alligevel kun skrive med én ad gangen,
  -- og to nøgler ville kræve et ekstra valg af, hvilken der er den aktive.
  user_id uuid not null unique references auth.users (id) on delete cascade,

  provider text not null check (provider in ('anthropic', 'openai')),

  -- Formatet er v1.<iv>.<tag>.<krypteret tekst>, alle dele i base64.
  -- Versionsnummeret står forrest, så algoritmen kan skiftes en dag uden at
  -- bede alle brugere indtaste deres nøgle igen.
  encrypted_key text not null,

  -- De sidste fire tegn. Det ENESTE, brugeren får at se igen — nok til at
  -- genkende nøglen, for lidt til at bruge den.
  key_hint text not null,

  -- Den valgte model fra den kuraterede liste i lib/ai/modeller.ts.
  -- Står ikke i datamodellen i CLAUDE.md; tilføjet efter aftale 02.09.2026,
  -- fordi valget hører til nøglen på samme måde som leverandøren gør.
  model text not null,

  created_at timestamptz not null default now(),

  -- Sidste gang "Test forbindelsen" lykkedes. Bruges til at sige ærligt i
  -- indstillinger, hvornår vi sidst VED, at nøglen virkede.
  last_validated_at timestamptz
);

comment on table public.ai_keys is
  'Brugernes egne AI-nøgler, krypteret med AES-256-GCM. Se CLAUDE.md regel 2.';

comment on column public.ai_keys.encrypted_key is
  'Krypteret i Node, aldrig i databasen. Læses kun af server-kode.';

alter table public.ai_keys enable row level security;

/*
  Fire policies, én pr. handling — samme mønster som drafts i migration 0011.
  Brugeren kan kun røre sin egen række, og databasen er dén, der siger nej.
  Der er ikke noget ejer-tjek i koden, der kan glemmes, fordi tjekket ikke
  ligger i koden.
*/
create policy "Brugere kan læse egen nøglerække"
  on public.ai_keys
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Brugere kan gemme egen nøgle"
  on public.ai_keys
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan opdatere egen nøgle"
  on public.ai_keys
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Brugere kan slette egen nøgle"
  on public.ai_keys
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

/*
  En sele ud over selerne: selve den krypterede nøgle kan slet ikke LÆSES
  gennem en almindelig login-forbindelse — heller ikke af den, der ejer den.

  Policyen ovenfor giver adgang til rækken; den her linje tager kolonnen fra
  igen. Indstillingssiden har kun brug for leverandør, model og key_hint, og
  det er alt, den kan få. Skal den krypterede tekst hentes for at blive
  dekrypteret, sker det med service_role i server-kode — og dér skal
  ejerskabet verificeres i hånden, jf. sikkerhedsreglernes punkt 6.

  Værdien er ganske vist krypteret og derfor ubrugelig uden ENCRYPTION_KEY.
  Men to lag koster os én linje her, og den dag nøglen slipper ud et sted,
  er det den slags linjer, der afgør, om det gjorde en forskel.

  Skrivning er ikke rørt: insert og update har deres egne rettigheder i
  Postgres, så brugeren kan stadig gemme sin nøgle — bare ikke læse den.
*/
revoke select (encrypted_key) on public.ai_keys from authenticated, anon;
