-- Migration 0032 — blogindlæggets skrivevejledning begynder med "OPGAVE"
--
-- Vejledningen er rettet på adminsiden og begynder med "PGAVE": det første
-- bogstav er faldet ud. Det betyder intet for modellen, men det ser forkert
-- ud for den, der åbner feltet.
--
-- Betingelsen gør migrationen ufarlig at køre to gange, og den rører ikke
-- vejledningen, hvis fejlen er rettet i mellemtiden.
--
-- OVERHALET SAMME DAG: vejledningen begyndte allerede med "OPGAVE", da den
-- blev læst igen, og hele vejledningen blev derefter skiftet ud gennem
-- adminsiden. Migrationen gør derfor ingenting og behøver ikke blive kørt.

update public.templates
   set system_prompt = 'O' || system_prompt
 where slug = 'blogindlaeg'
   and system_prompt like 'PGAVE%';
