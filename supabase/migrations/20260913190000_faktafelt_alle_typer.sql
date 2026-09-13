-- Migration 0023 — fakta-feltet markeres på alle fire teksttyper
--
-- Migration 0021 satte flaget `faktafelt` på produktteksten alene. Det var
-- for lidt, og manglen havde to virkninger, hvoraf den ene er alvorlig:
--
-- 1. "Indsæt en specifikation" fandtes kun på produktteksten. Men et
--    blogindlæg, der skal bygge på en undersøgelse, har præcis samme behov.
--
-- 2. ALVORLIGT: "Skriv en til med samme opsætning" rydder netop de to
--    felter, der er markeret — idéfeltet og faktafeltet. Uden flaget ville
--    den forrige teksts kendsgerninger blive stående i briefen til den
--    næste. Det er dén fejl, hele funktionen er bygget for at undgå:
--    et tal fra en anden vare, ingen fik øje på, som teksten så skriver som
--    en sandhed om denne.
--
-- Alle fire teksttyper HAR et fakta-felt. De hedder bare noget forskelligt,
-- og det er netop derfor, flaget er data og ikke kode:
--
--   blogindlaeg   detaljer                        "Noget teksten skal vide"
--   produkttekst  fakta                           "Fakta om varen"       (0021)
--   brandtekst    kendsgerninger                  "De konkrete kendsgerninger"
--   landingsside  hvad_kan_i_dokumentere_valgfri  "Hvad kan I dokumentere?"
--
-- Blogindlæggets felt siger ordret det samme som produktens: "Alt hvad du
-- ikke skriver her, opfinder teksten ikke." Det ER fakta-feltet.

do $$
declare
  par record;
  ramt int;
begin
  for par in
    select *
      from (values
        ('blogindlaeg', 'detaljer'),
        ('brandtekst', 'kendsgerninger'),
        ('landingsside', 'hvad_kan_i_dokumentere_valgfri')
      ) as t(slug, felt)
  loop
    update public.templates m
       set input_fields = (
             select jsonb_agg(
                      case
                        when f->>'navn' = par.felt
                          then f || '{"faktafelt": true}'::jsonb
                        else f
                      end
                      order by nr
                    )
               from jsonb_array_elements(m.input_fields)
                      with ordinality as e(f, nr)
           )
     where m.slug = par.slug
       and m.input_fields @> jsonb_build_array(
             jsonb_build_object('navn', par.felt)
           );

    get diagnostics ramt = row_count;

    -- Samme vagt som i 0018 og 0021: en stiltiende nul-opdatering ville
    -- betyde, at knappen aldrig dukkede op, og at "Skriv en til" blev ved
    -- med at slæbe den forrige teksts tal med sig.
    if ramt = 0 then
      raise exception
        'Migration 0023: feltet "%" blev ikke fundet på teksttypen %. Er det omdøbt gennem adminsiden, skal flaget sættes dér i stedet.',
        par.felt, par.slug;
    end if;
  end loop;
end $$;
