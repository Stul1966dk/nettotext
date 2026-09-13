-- Migration 0022 — butiksoplysninger i brand-profilen
--
-- Problemet: produktteksten beder i feltet "Noget teksten skal vide" om
-- levering, returret og butikkens egne råd. De oplysninger er de samme for
-- hele webshoppen, men de skal skrives forfra ved hver eneste vare. Skal der
-- laves tekst til tredive varer, tastes det samme tredive gange.
--
-- Løsningen hører til i brand-profilen og ikke i de gemte instruktioner.
-- Instruktionerne er regler om SPROG ("skriv altid, at vi giver fast pris").
-- Levering og returret er OPLYSNINGER om butikken, og de to ting skal ikke
-- blandes sammen — hverken for brugeren, der skal forstå, hvor tingene hører
-- hjemme, eller i prompten, hvor de får hver deres rolle.
--
-- Bemærk konsekvensen for faktatjekket: tal, der står her, tæller som noget,
-- brugeren selv har oplyst. Skriver hun "30 dages returret" i profilen, får
-- hun ikke en advarsel, når teksten skriver 30. Det er meningen.

alter table public.brand_profiles add column shop_info text;

comment on column public.brand_profiles.shop_info is
  'Faste oplysninger om butikken: levering, returret, betaling, åbningstider. Oplysninger, ikke sprogregler — dem er instructions til.';

-- Hjælpeteksten under produktteksten skal ikke længere invitere til at skrive
-- det samme hver gang. Feltet bliver ved med at findes: der ER ting, der kun
-- gælder én vare ("gå en halv størrelse op, hvis du bruger uldsokker").
do $$
declare
  ramt int;
begin
  update public.templates t
     set input_fields = (
           select jsonb_agg(
                    case
                      when felt->>'navn' = 'detaljer'
                        then felt || jsonb_build_object(
                          'hjaelp',
                          'Det, der kun gælder DENNE vare — et godt råd om størrelsen, en note om tilbehøret. Levering, returret og andet, der gælder hele butikken, skriver du ét sted under Indstillinger, så det følger med i hver tekst af sig selv.'
                        )
                      else felt
                    end
                    order by nr
                  )
             from jsonb_array_elements(t.input_fields)
                    with ordinality as e(felt, nr)
         )
   where t.slug = 'produkttekst'
     and t.input_fields @> '[{"navn": "detaljer"}]'::jsonb;

  get diagnostics ramt = row_count;

  if ramt = 0 then
    raise exception
      'Migration 0022: feltet "detaljer" blev ikke fundet på teksttypen produkttekst. Er feltet omdøbt gennem adminsiden, skal hjælpeteksten rettes dér i stedet.';
  end if;
end $$;
