-- Migration 0005 — eksempeltekst i brief-felterne
--
-- Hvert felt får et `standard`-felt, som formularen bruger som forudfyldt
-- værdi. Brugeren kan skrive hen over den.
--
-- Eksemplet ligger i skabelonen og ikke i formularens kode, så en ny
-- teksttype selv bestemmer sit eget eksempel — på samme måde som den
-- bestemmer sine felter. Teksttyper er data.
--
-- Eksemplet er bevidst konkret: et rigtigt firma, en rigtig geografi, rigtige
-- detaljer om håndværket. Det er dét, der gør det muligt at afprøve, om
-- modellen overholder reglerne om belæg og erfaring — en tynd brief ville
-- kun vise, om den kan finde på.

update public.templates
set input_fields = $fields$[
  {
    "navn": "emne",
    "label": "Hvad skal indlægget handle om?",
    "type": "tekstomraade",
    "pladsholder": "F.eks.: Hvorfor det kan betale sig at få malet vinduerne inden vinteren",
    "hjaelp": "Én til tre sætninger. Jo mere konkret, jo bedre bliver teksten.",
    "paakraevet": true,
    "maxLaengde": 500,
    "standard": "Hvorfor det kan betale sig at få malet trævinduerne inden vinteren — og hvad det ender med at koste, hvis man venter et par år."
  },
  {
    "navn": "maalgruppe",
    "label": "Hvem skriver du til?",
    "type": "tekst",
    "pladsholder": "F.eks.: husejere i Nordjylland med huse fra 60'erne",
    "hjaelp": "Teksten bliver skarpere, når den ved hvem der læser med.",
    "paakraevet": true,
    "maxLaengde": 200,
    "standard": "Husejere i Vendsyssel med trævinduer fra 1960'erne og 70'erne"
  },
  {
    "navn": "laengde",
    "label": "Hvor langt?",
    "type": "valg",
    "paakraevet": true,
    "standard": "mellem",
    "valg": [
      { "vaerdi": "kort", "label": "Kort — ca. 400 ord" },
      { "vaerdi": "mellem", "label": "Mellem — ca. 800 ord" },
      { "vaerdi": "langt", "label": "Langt — ca. 1.400 ord" }
    ]
  },
  {
    "navn": "noegleord",
    "label": "Ord der skal med (valgfrit)",
    "type": "tekst",
    "pladsholder": "F.eks.: vinduesmaling, træværk, vedligeholdelse",
    "hjaelp": "Adskil med komma. Bruges naturligt i teksten — ikke proppet ind.",
    "paakraevet": false,
    "maxLaengde": 200,
    "standard": "vinduesmaling, træværk, rådskader, vedligeholdelse"
  },
  {
    "navn": "detaljer",
    "label": "Noget teksten skal vide (valgfrit)",
    "type": "tekstomraade",
    "pladsholder": "F.eks.: Vi har 20 års erfaring og kører i hele Vendsyssel. Vi giver altid fast pris.",
    "hjaelp": "Konkrete oplysninger om jer. Alt hvad du ikke skriver her, opfinder teksten ikke.",
    "paakraevet": false,
    "maxLaengde": 1000,
    "standard": "Vi er et malerfirma i Brønderslev med 20 års erfaring og kører i hele Vendsyssel. Vi giver altid fast pris efter besigtigelse. Vi maler kun trævinduer i sæsonen fra marts til oktober, fordi malingen ikke hærder ordentligt under 10 grader. Vi ser næsten altid, at rådskaderne starter i bundstykket, hvor regnvandet bliver stående — og at det er billigere at male end at skifte, indtil træet begynder at give sig, når man trykker på det."
  }
]$fields$::jsonb
where slug = 'blogindlaeg';
