-- Migration 0018 — idéforslag
--
-- To ting, der hører til den samme funktion:
--
-- 1. `usage_log` får en kolonne, der siger HVAD kaldet var. Uden den ville
--    adminsidens tal for "skrevne tekster" tælle idéforslag med — og det har
--    faktisk været forkert siden omskrivningen blev bygget, hvor et omskrevet
--    afsnit blev logget med teksttypens slug ligesom en hel tekst.
--
-- 2. Blogindlægget får markeret det felt, forslagene fylder ud.
--    Teksttyper er data. Hvilket felt der kan tage imod et forslag, er derfor
--    også data — feltet hedder "emne" i blogindlægget, "produkt" i
--    produktteksten og "virksomheden" i brandteksten, og en knap i koden, der
--    skulle gætte navnet, ville gætte forkert ved den første branchepakke.

-- ---------------------------------------------------------------------------
-- 1. Hvad kostede kaldet penge på?
-- ---------------------------------------------------------------------------

alter table public.usage_log
  add column slags text not null default 'tekst'
    check (slags in ('tekst', 'afsnit', 'ideer'));

comment on column public.usage_log.slags is
  'Hvad kaldet var: en hel tekst, ét omskrevet afsnit eller fem idéforslag.';

-- Bemærk hvad standardværdien gør ved de rækker, der allerede står i loggen:
-- de bliver alle sammen til 'tekst', også de omskrivninger, der ligger blandt
-- dem. Det er ikke til at rette bagefter — der står ikke noget i rækkerne, der
-- afslører hvad de var. Tallene fra før i dag er derfor lidt for høje på
-- "tekster", og det skal man vide, når adminsidens tal bliver læst.

-- ---------------------------------------------------------------------------
-- 2. Feltet, idéforslagene fylder ud
-- ---------------------------------------------------------------------------
--
-- Kun blogindlægget får flaget. Det er dér, spørgsmålet "hvad skal jeg
-- egentlig skrive om?" opstår. Man har ikke brug for forslag til, hvad ens
-- eget produkt hedder, eller hvad ens egen virksomhed laver — så
-- produktteksten og brandteksten står med vilje uden knap.
--
-- Landingssiden er lavet gennem adminsiden og står ikke i nogen
-- migrationsfil. Skal den have forslag, sættes flaget samme sted: i
-- feltbyggeren på /app/admin/teksttyper.

do $$
declare
  ramt int;
begin
  update public.templates t
     set input_fields = (
           select jsonb_agg(
                    case
                      when felt->>'navn' = 'emne'
                        then felt || '{"idefelt": true}'::jsonb
                      else felt
                    end
                    order by nr
                  )
             from jsonb_array_elements(t.input_fields)
                    with ordinality as e(felt, nr)
         )
   where t.slug = 'blogindlaeg'
     and t.input_fields @> '[{"navn": "emne"}]'::jsonb;

  get diagnostics ramt = row_count;

  -- Rammer opdateringen ingenting, skal migrationen fejle højlydt. En
  -- stiltiende nul-opdatering ville betyde, at knappen aldrig dukkede op i
  -- briefen, uden at nogen fik at vide hvorfor. Samme begrundelse som ved
  -- replace-migrationerne på prompterne — se docs/beslutninger.md.
  if ramt = 0 then
    raise exception
      'Migration 0018: feltet "emne" blev ikke fundet på teksttypen blogindlaeg. Er feltet omdøbt gennem adminsiden, skal flaget sættes dér i stedet.';
  end if;
end $$;
