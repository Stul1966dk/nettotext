-- Migration 0030 — blogindlæggets "Langt" lover det, appen leverer
--
-- Valgmuligheden hed "Langt (ca. 1.400 ord)". Otte test 03.10.2026 gav
-- mellem 800 og 1.150 ord, uanset hvad skrivevejledningen sagde om længde.
-- Ejerens beslutning: valgmuligheden skal hedde 1.000-1.200 ord, og tallet
-- gælder brødteksten. Afsnittet "Ofte stillede spørgsmål" kommer oveni.
--
-- Kun labelen ændres. Værdien "langt" er den samme, så kladder og "Skriv en
-- til" virker som før. Det er grunden til, at ændringen ligger her og ikke
-- er lavet på adminsiden: dér dannes værdien ud fra labelen, og en rettelse
-- ville give alle tre valgmuligheder nye værdier.

do $$
declare
  ramt boolean;
begin
  update public.templates m
     set input_fields = (
           select jsonb_agg(
                    case
                      when f->>'navn' = 'laengde' then
                        jsonb_set(
                          f,
                          '{valg}',
                          (
                            select jsonb_agg(
                                     case
                                       when v->>'vaerdi' = 'langt'
                                         then v || '{"label": "Langt (1.000-1.200 ord)"}'::jsonb
                                       else v
                                     end
                                     order by vnr
                                   )
                              from jsonb_array_elements(f->'valg')
                                     with ordinality as x(v, vnr)
                          )
                        )
                      else f
                    end
                    order by nr
                  )
             from jsonb_array_elements(m.input_fields)
                    with ordinality as e(f, nr)
         )
   where m.slug = 'blogindlaeg';

  select m.input_fields::text like '%Langt (1.000-1.200 ord)%'
    into ramt
    from public.templates m
   where m.slug = 'blogindlaeg';

  -- Samme slags vagt som i 0023 og 0028: en stiltiende nul-opdatering ville
  -- betyde, at briefen blev ved med at love 1.400 ord.
  if ramt is not true then
    raise exception
      'Migration 0030: valgmuligheden "langt" blev ikke fundet i feltet "laengde" på blogindlægget. Er den omdøbt gennem adminsiden, skal labelen rettes dér i stedet.';
  end if;
end $$;
