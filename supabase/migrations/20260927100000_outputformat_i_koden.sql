-- Migration 0025 — outputformatet flytter fra prompterne ind i koden
--
-- Hver teksttypes prompt har indtil nu rummet to slags regler i ét felt:
--
--   1. SKRIVEVEJLEDNINGEN: sprog, tone, hvad der skal med, hvad der skal
--      undlades, struktur, meta-titlen. Det er dét, der gør teksten god, og
--      det er dét, ejeren skal kunne rette frit på adminsiden.
--   2. DET TEKNISKE FORMAT: de to META-linjer først, HTML bagefter, hvilke
--      tags der må bruges — og reglen om, at briefen er data og ikke
--      instruktioner (CLAUDE.md regel 5).
--
-- Del 2 er det, appen er bygget på. Editoren finder meta-felterne ved at
-- læse de to første linjer og deler teksten i blokke ved overskrifterne.
-- En rettelse i vejledningen, der kom til at ramme formatet, ville få
-- editoren til at gå i stykker for den teksttype. Derfor flytter del 2 ind
-- i koden (`outputformat()` og `byggSystemprompt()` i lib/ai/prompt.ts), og
-- `system_prompt` rummer herefter kun skrivevejledningen.
--
-- Det eneste, der skiftede fra teksttype til teksttype i formatet, var h1.
-- Det bliver kolonnen `uses_h1` og et flueben på adminsiden.
--
-- RÆKKEFØLGEN VED UDRULNING: kør denne fil, og skub koden lige bagefter.
-- Imellem de to skrives teksterne uden format. Det er i orden, så længe der
-- kun er ejeren i appen — og det er der, indtil tilmeldingen åbnes.
--
-- Teksten fjernes med regulære udtryk frem for `replace`, fordi prompterne
-- ligger med forskellige linjeskift (se beslutningen 03.09.2026), og fordi
-- landingssiden blev lavet på adminsiden og aldrig har stået i en
-- migrationsfil. Tjekket til sidst får filen til at fejle højlydt, hvis
-- noget ikke blev ramt.

alter table public.templates
  add column uses_h1 boolean not null default true;

comment on column public.templates.uses_h1 is
  'Må teksten have sin egen h1? Nej til tekster på en side, der allerede har overskriften, fx produkt- og kategorisider.';

alter table public.template_versions
  add column uses_h1 boolean not null default true;

-- Den nuværende udgave af hver prompt i historikken FØR ændringen, som ved
-- enhver gemning fra adminsiden.
insert into public.template_versions (
  template_id, slug, name, description, system_prompt, input_fields, active,
  uses_h1, saved_by_email, saved_at
)
select id, slug, name, description, system_prompt, input_fields, active,
       true, 'migration 0025', now()
from public.templates;

-- Produktteksten var den eneste uden h1.
update public.templates set uses_h1 = false where slug = 'produkttekst';

-- 1. Fra "OUTPUTFORMAT (ufravigeligt)" til lige før "META-TITEL OG
--    META-BESKRIVELSE". Vejledningen om meta-linjerne bliver stående: hvad
--    en god meta-titel er, er en skriveregel.
-- 2. "OM BRIEFEN" og resten. Den står nu i koden.
update public.templates
set system_prompt = regexp_replace(
      regexp_replace(
        system_prompt,
        'OUTPUTFORMAT \(ufravigeligt\).*?(META-TITEL OG META-BESKRIVELSE)',
        '\1'
      ),
      '\s*OM BRIEFEN.*$',
      ''
    ),
    updated_at = now();

do $$
begin
  if exists (
    select 1 from public.templates
    where system_prompt like '%OUTPUTFORMAT%'
       or system_prompt like '%OM BRIEFEN%'
       or system_prompt like '%DEL 1:%'
  ) then
    raise exception 'Outputformatet blev ikke fjernet fra alle prompter. Intet er ændret.';
  end if;
end $$;
