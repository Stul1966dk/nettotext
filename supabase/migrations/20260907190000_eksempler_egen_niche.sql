-- Migration 0019 — eksempelteksterne flyttes til ejerens egen niche
--
-- Eksemplerne har indtil nu handlet om et malerfirma i Vendsyssel. De blev
-- skrevet, fordi der skulle stå NOGET konkret, og en malermester er en god
-- prøveklud for en dansk håndværkstekst.
--
-- Problemet er ikke, at eksemplet er dårligt. Problemet er, at ejeren skal
-- kunne VURDERE de tekster, appen skriver — og det kan man kun, hvis man
-- kender emnet godt nok til at se, hvornår en sætning er forkert. Derfor
-- flytter eksemplerne til det, ejeren selv laver: affiliate-sider om fitness
-- og hjemmetræning, og webtekster for mindre virksomheder.
--
-- Bemærk hvad der IKKE ændres: ingen systemprompter, ingen feltnavne, ingen
-- felttyper. Kun `pladsholder` (den grå tekst i et tomt felt) og `standard`
-- (den forudfyldte værdi). Feltnavnene er nøgler i gemte kladder, og en
-- ændring dér ville rive kladderne fra hinanden.
--
-- Den forudfyldte tekst står stadig på tjeklisten til at blive FJERNET før
-- lancering — en rigtig bruger sender ellers ejerens eksempel af sted som sin
-- egen brief uden at opdage det. Denne migration gør eksemplet brugbart
-- under udviklingen; den lukker ikke det punkt.
--
-- Undervejs rettes også en kopieringsfejl: landingssidens felt for nøgleord
-- foreslog "vandrestøvle dame, vandtæt, ruskind", som er produktteksten's
-- eksempel. Det har stået der, siden landingssiden blev lavet ved at kopiere
-- produkttekstens felter.

do $$
declare
  r record;
  ramt int;
begin
  for r in
    select *
      from (values
        -- --- Blogindlæg: forudfyldt, fordi det er den type, der prøves oftest
        (
          'blogindlaeg', 'emne',
          'F.eks.: Hvad man skal se efter, før man køber sit første sæt håndvægte til hjemmetræning',
          'Hvorfor et justerbart sæt håndvægte er en bedre start end et helt stativ, når man træner hjemme i en lejlighed, og hvad man skal se efter, før man køber.'
        ),
        (
          'blogindlaeg', 'maalgruppe',
          'F.eks.: begyndere, der træner hjemme i en lille lejlighed',
          'Begyndere, der vil træne hjemme i en lejlighed uden meget plads'
        ),
        (
          'blogindlaeg', 'noegleord',
          'F.eks.: hjemmetræning, håndvægte, lille plads',
          'hjemmetræning, justerbare håndvægte, træning i lejlighed'
        ),
        (
          'blogindlaeg', 'detaljer',
          'F.eks.: Jeg har selv trænet med det udstyr, jeg skriver om, og jeg tjener kommission, når nogen køber gennem et link på siden.',
          'Jeg driver en side om hjemmetræning og har selv trænet med det udstyr, jeg skriver om. Jeg tjener kommission, når nogen køber gennem et link på siden, og det står øverst i hver artikel. Et justerbart sæt dækker fra 2 til 24 kg pr. hånd og fylder omtrent som et par sko på gulvet, hvor et helt stativ kræver en hel væg. Jeg anbefaler ikke udstyr, jeg ikke selv har prøvet.'
        ),

        -- --- Produkttekst: et produkt fra samme niche som affiliate-siderne
        (
          'produkttekst', 'produkt',
          'F.eks.: Justerbart håndvægtsæt til hjemmetræning. Erstatter 15 par faste håndvægte og fylder som et par sko.',
          null
        ),
        (
          'produkttekst', 'maalgruppe',
          'F.eks.: begyndere, der træner hjemme i en lille lejlighed',
          null
        ),
        (
          'produkttekst', 'fakta',
          'F.eks.: 2 til 24 kg pr. hånd i spring på 2 kg. Fylder 45 x 20 cm på gulvet. Pris 2.499 kr. To års garanti. Leveres med gulvbakke.',
          null
        ),
        (
          'produkttekst', 'noegleord',
          'F.eks.: justerbare håndvægte, hjemmetræning, lille plads',
          null
        ),
        (
          'produkttekst', 'detaljer',
          'F.eks.: Fri fragt over 500 kr. 30 dages returret. Vi anbefaler et underlag, hvis vægtene skal stå på trægulv.',
          null
        ),

        -- --- Brandtekst: ejerens eget andet forretningsben
        (
          'brandtekst', 'formaal',
          'F.eks.: Om mig-siden på min hjemmeside',
          null
        ),
        (
          'brandtekst', 'virksomheden',
          'F.eks.: Jeg skriver tekster for mindre virksomheder, der gerne vil findes på Google og læses af deres kunder.',
          null
        ),
        (
          'brandtekst', 'kendsgerninger',
          'F.eks.: Mere end 10 års erfaring med webtekster. Enkeltmandsvirksomhed. Kunder i hele landet. Fast pris pr. tekst, aftalt på forhånd.',
          null
        ),
        (
          'brandtekst', 'saerpraeg',
          'F.eks.: Jeg skriver ikke tekster, der lover mere, end kunden kan holde, og der er altid et udkast til gennemsyn, før noget bliver sat online.',
          null
        ),
        (
          'brandtekst', 'noegleord',
          'F.eks.: tekstforfatter, SEO-tekster, webtekster',
          null
        ),

        -- --- Landingsside: en side, der sælger tekstarbejdet
        (
          'landingsside', 'hvad_skal_siden_saelge',
          'F.eks.: En pakke på fem SEO-tekster til en mindre virksomheds hjemmeside.',
          null
        ),
        (
          'landingsside', 'hvem_skal_siden_overbevise',
          'F.eks.: mindre virksomheder uden en marketingafdeling',
          null
        ),
        (
          'landingsside', 'hvad_faar_kunden',
          'F.eks.: Fem tekster på 600 til 800 ord. Et udkast til gennemsyn og én runde rettelser. Levering inden for to uger.',
          null
        ),
        (
          'landingsside', 'hvad_skal_laeseren_goere',
          'F.eks.: bestille en uforpligtende samtale gennem formularen',
          null
        ),
        (
          'landingsside', 'noegleord',
          'F.eks.: SEO-tekster, tekstforfatter til mindre virksomheder',
          null
        ),
        (
          'landingsside', 'hvad_kan_i_dokumentere_valgfri',
          'F.eks.: Mere end 10 års erfaring med webtekster. Fast pris aftalt på forhånd. Den første samtale er gratis.',
          null
        )
      ) as v(slug, felt, pladsholder, standard)
  loop
    update public.templates t
       set input_fields = (
             select jsonb_agg(
                      case
                        when felt->>'navn' = r.felt
                          then felt
                               || jsonb_build_object('pladsholder', r.pladsholder)
                               || case
                                    when r.standard is null then '{}'::jsonb
                                    else jsonb_build_object('standard', r.standard)
                                  end
                        else felt
                      end
                      order by nr
                    )
               from jsonb_array_elements(t.input_fields)
                      with ordinality as e(felt, nr)
           )
     where t.slug = r.slug
       and t.input_fields @> jsonb_build_array(jsonb_build_object('navn', r.felt));

    get diagnostics ramt = row_count;

    -- Rammer en linje ingenting, er feltet omdøbt eller slettet gennem
    -- adminsiden. Så skal migrationen fejle højlydt frem for at lade et
    -- gammelt eksempel blive stående, uden at nogen opdager det.
    if ramt = 0 then
      raise exception
        'Migration 0019: feltet "%" findes ikke på teksttypen "%".', r.felt, r.slug;
    end if;
  end loop;
end $$;
