-- Migration 0028 — det frie ønske kan slås til og fra pr. teksttype
--
-- Feltet "Noget særligt til lige denne tekst" stod i formularens kode og
-- dermed på ALLE teksttyper. Afprøvningen af blogindlægget 03.10.2026 viste,
-- at det dér er et spørgsmål for meget: blogindlægget har i forvejen feltet
-- "Noget teksten skal vide", og brugeren kan ikke se forskel på de to. Vores
-- eget eksempel i feltet — "nævn at vi har åbent på lørdage i november" —
-- var en oplysning, ikke et ønske.
--
-- `free_wish` er et flueben på adminsiden, ligesom `uses_h1` og
-- `product_grid`. Standarden er TIL, så de øvrige teksttyper er uændrede,
-- indtil de selv er afprøvet. Blogindlægget slås fra her.
--
-- KØR MIGRATIONEN, FØR KODEN ER I LUFTEN. `hentSkabelon` spørger efter
-- kolonnen, og findes den ikke, kan ingen brief-side åbnes.

alter table public.templates
  add column free_wish boolean not null default true;

comment on column public.templates.free_wish is
  'Vises feltet "Noget særligt til lige denne tekst" i briefen? Slås fra på teksttyper, der i forvejen har et frit felt, som dækker det samme.';

alter table public.template_versions
  add column free_wish boolean not null default true;

update public.templates set free_wish = false where slug = 'blogindlaeg';

-- Når det frie ønske er væk, skal "Noget teksten skal vide" sige, at det
-- også rummer det, ønsket før tog imod. Kun hjælpeteksten ændres.
do $$
declare
  ramt int;
begin
  update public.templates m
     set input_fields = (
           select jsonb_agg(
                    case
                      when f->>'navn' = 'detaljer'
                        then f || jsonb_build_object(
                          'hjaelp',
                          'Konkrete oplysninger om jer, og hvad teksten ellers skal tage hensyn til. Alt hvad du ikke skriver her, opfinder teksten ikke.'
                        )
                      else f
                    end
                    order by nr
                  )
             from jsonb_array_elements(m.input_fields)
                    with ordinality as e(f, nr)
         )
   where m.slug = 'blogindlaeg'
     and m.input_fields @> '[{"navn": "detaljer"}]'::jsonb;

  get diagnostics ramt = row_count;

  -- Samme vagt som i 0023. Er feltet omdøbt gennem adminsiden, skal
  -- hjælpeteksten rettes dér i stedet.
  if ramt = 0 then
    raise exception
      'Migration 0028: feltet "detaljer" blev ikke fundet på blogindlægget. Ret hjælpeteksten på adminsiden i stedet.';
  end if;
end $$;
