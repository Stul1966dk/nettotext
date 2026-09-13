-- Migration 0021 — indsæt specifikation, få en faktaliste
--
-- To ting, der hører til den samme funktion:
--
-- 1. `usage_log.slags` skal kunne rumme 'fakta'. Udtrækket koster penge og
--    skal derfor i forbrugsloggen som alt andet — men det er ikke en tekst,
--    og adminsidens tal for skrevne tekster skal ikke tælle det med.
--
-- 2. Produktteksten får markeret det felt, faktalisten fyldes ind i.
--    Samme begrundelse som ved `idefelt` i migration 0018: teksttyper er
--    data, og feltet hedder noget forskelligt fra type til type. Her hedder
--    det "fakta"; en kommende teksttype kan kalde det "resultater".
--
-- Om selve funktionen: brugeren indsætter en specifikation, hun selv har
-- kopieret, og et lille AI-kald gør den om til en liste med oplysninger.
-- Serveren henter ALDRIG noget fra nettet. Begrundelsen — juridisk og
-- produktmæssig — står i docs/beslutninger.md under 13.09.2026.

-- ---------------------------------------------------------------------------
-- 1. En fjerde slags kald i forbrugsloggen
-- ---------------------------------------------------------------------------

-- Betingelsen fra migration 0018 blev lagt ind uden navn, så Postgres har
-- selv fundet på et. Vi slår det op frem for at gætte: rammer vi forkert,
-- ville den gamle betingelse blive stående og afvise 'fakta' — og det ville
-- først vise sig den dag, nogen brugte knappen.
do $$
declare
  betingelse text;
begin
  select conname into betingelse
    from pg_constraint
   where conrelid = 'public.usage_log'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%slags%';

  if betingelse is null then
    raise exception
      'Migration 0021: fandt ingen check-betingelse på usage_log.slags. Er den fjernet i hånden?';
  end if;

  execute format(
    'alter table public.usage_log drop constraint %I', betingelse
  );
end $$;

alter table public.usage_log
  add constraint usage_log_slags_check
    check (slags in ('tekst', 'afsnit', 'ideer', 'fakta'));

comment on column public.usage_log.slags is
  'Hvad kaldet var: en hel tekst, ét omskrevet afsnit, fem idéforslag eller et faktaudtræk.';

-- ---------------------------------------------------------------------------
-- 2. Produktteksten: knappen hører til feltet "fakta"
-- ---------------------------------------------------------------------------

do $$
declare
  ramt int;
begin
  update public.templates t
     set input_fields = (
           select jsonb_agg(
                    case
                      when felt->>'navn' = 'fakta'
                        then felt || '{"faktafelt": true}'::jsonb
                      else felt
                    end
                    order by nr
                  )
             from jsonb_array_elements(t.input_fields)
                    with ordinality as e(felt, nr)
         )
   where t.slug = 'produkttekst'
     and t.input_fields @> '[{"navn": "fakta"}]'::jsonb;

  get diagnostics ramt = row_count;

  -- Samme vagt som i migration 0018: rammer opdateringen ingenting, skal det
  -- siges højt. Ellers ville knappen bare aldrig dukke op i briefen.
  if ramt = 0 then
    raise exception
      'Migration 0021: feltet "fakta" blev ikke fundet på teksttypen produkttekst. Er feltet omdøbt gennem adminsiden, skal flaget sættes dér i stedet.';
  end if;
end $$;
