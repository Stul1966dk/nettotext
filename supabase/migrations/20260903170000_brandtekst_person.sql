-- Migration 0016 — brandteksten må godt sige "jeg"
--
-- Migration 0015 skrev, at brandteksten skal stå i vi-form. Det er forkert.
-- Målgruppen er mindre erhvervsdrivende, og en stor del af dem er ÉN person.
-- En tekst, der siger "vi" om en enkeltmandsvirksomhed, lyder som en, der
-- gerne vil virke større, end hun er, og det er det stik modsatte af den
-- ærlighed, resten af prompten er bygget på.
--
-- Fundet under afprøvningen 03.09.2026 med en rigtig brand-profil: modellen
-- valgte selv "jeg", fordi både profilen og briefen var skrevet i jeg-form.
-- Den gjorde altså det rigtige ved at overhøre reglen. Det er ikke noget at
-- bygge videre på: næste gang kan den lige så godt følge den.
--
-- Kun ét afsnit ændres, og derfor bruges `replace` frem for at skrive hele
-- systemprompten om. En hel prompt kopieret ind igen for tre linjers skyld
-- gør det svært at se i historikken, hvad der faktisk blev ændret.
--
-- Rammer erstatningen ikke, fejler migrationen højlydt. En `replace`, der
-- ikke finder sin tekst, gør ingenting og siger ingenting, og det er den
-- værste slags migration: en, der ser ud til at være kørt.

update public.templates
set system_prompt = replace(
  system_prompt,
  $gammel$DU SKRIVER SOM VIRKSOMHEDEN
- Skriv i vi-form. Det er virksomheden, der taler, ikke en udenforstående, der beskriver den.
- Skriv aldrig virksomhedens navn i tredje person, som var det en anden.$gammel$,
  $ny$DU SKRIVER SOM VIRKSOMHEDEN
- Det er virksomheden, der taler, ikke en udenforstående, der beskriver den.
- Skriv i samme person som brugeren selv. Er virksomheden flere, er det "vi". Er den én person, er det "jeg". Se efter i briefen og i brand-profilen, hvad brugeren skriver om sig selv, og gør det samme. Kan du ikke afgøre det, så skriv "vi".
- Bland aldrig "vi" og "jeg" i den samme tekst.
- Skriv aldrig virksomhedens navn i tredje person, som var det en anden.$ny$
)
where slug = 'brandtekst';

do $$
begin
  if not exists (
    select 1 from public.templates
    where slug = 'brandtekst'
      and system_prompt like '%Bland aldrig "vi" og "jeg" i den samme tekst.%'
  ) then
    raise exception 'Migration 0016: erstatningen ramte ikke. Systemprompten for brandtekst er uændret.';
  end if;
end $$;
