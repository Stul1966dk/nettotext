-- Migration 0029 — almen viden kan slås til pr. teksttype
--
-- Reglen "ved du noget om emnet, som briefen ikke nævner, skal det stå
-- uskrevet" blev lavet til produkttekster, hvor et opfundet mål er en påstand
-- om en vare. Afprøvningen af blogindlægget 03.10.2026 viste, at den samme
-- regel gør et blogindlæg værdiløst: tre test gav 793, 950 og 1.150 ord af
-- 1.400 ønskede, og længden fulgte nøje, hvor meget brugeren selv havde
-- skrevet i briefen. Ejerens ord: "så kan man lige så godt selv skrive
-- blogindlægget".
--
-- `general_knowledge` er et flueben på adminsiden. Slået til må teksten bruge
-- modellens almene viden om emnet til at forklare og give råd. Tal, priser,
-- navngivne produkter og alt om afsenderen må stadig kun komme fra briefen —
-- de regler står i koden, se stiltoneTillaeg() i lib/ai/prompt.ts.
--
-- Standarden er FRA, så produkttekst, kategoritekst, brandtekst og
-- landingsside er uændrede. Blogindlægget slås til her.
--
-- Det rører ikke beslutningen om ingen online research: modellen slår intet
-- op, den bruger det, den ved i forvejen.
--
-- KØR MIGRATIONEN, FØR KODEN ER I LUFTEN. `hentSkabelon` spørger efter
-- kolonnen, og findes den ikke, kan ingen brief-side åbnes.

alter table public.templates
  add column general_knowledge boolean not null default false;

comment on column public.templates.general_knowledge is
  'Må teksten bruge modellens almene viden om emnet? Tal, priser, navngivne produkter og alt om afsenderen kommer stadig kun fra briefen.';

alter table public.template_versions
  add column general_knowledge boolean not null default false;

update public.templates set general_knowledge = true where slug = 'blogindlaeg';

-- Hjælpeteksten ved "Hvor langt?" sagde, at et langt indlæg kræver flere
-- oplysninger, og at teksten ikke fylder ud. Det passer ikke længere. Findes
-- den ikke, sker der ingenting — den blev lagt ind på adminsiden samme dag.
update public.templates m
   set input_fields = (
         select jsonb_agg(
                  case
                    when f->>'navn' = 'laengde' then f - 'hjaelp'
                    else f
                  end
                  order by nr
                )
           from jsonb_array_elements(m.input_fields)
                  with ordinality as e(f, nr)
       )
 where m.slug = 'blogindlaeg';
