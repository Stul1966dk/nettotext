-- Migration 0032 — blogindlæggets skrivevejledning begynder med "OPGAVE"
--
-- Vejledningen er rettet på adminsiden og begynder med "PGAVE": det første
-- bogstav er faldet ud. Det betyder intet for modellen, men det ser forkert
-- ud for den, der åbner feltet.
--
-- Rettelsen ligger her og ikke på adminsiden af samme grund som migration
-- 0030: formularen gemmer også brief-felterne, og dér dannes en
-- valgmuligheds værdi ud fra dens label. En gemning ville kunne give
-- længderne nye værdier.
--
-- Betingelsen gør migrationen ufarlig at køre to gange, og den rører ikke
-- vejledningen, hvis ejeren selv har rettet fejlen i mellemtiden.

update public.templates
   set system_prompt = 'O' || system_prompt
 where slug = 'blogindlaeg'
   and system_prompt like 'PGAVE%';
