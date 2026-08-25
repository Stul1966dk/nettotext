-- Migration 0003 — reservation af prøvekvote
--
-- Hvorfor en databasefunktion og ikke bare kode?
-- Kvoten skal tælles op ATOMISK. Læser serveren "trial_used = 4", beslutter
-- sig, og skriver "5", kan to samtidige forsøg begge nå at læse 4 og begge
-- få lov. Med update ... where trial_used < trial_quota afgør databasen
-- sagen, og kun den ene af dem rammer en række.

create function public.reserver_proeve_tekst(bruger uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  raekker integer;
begin
  update public.profiles
     set trial_used = trial_used + 1
   where id = bruger
     and trial_used < trial_quota;

  get diagnostics raekker = row_count;
  return raekker = 1;
end;
$$;

comment on function public.reserver_proeve_tekst is
  'Trækker én prøvetekst fra kvoten. Returnerer false, hvis kvoten er brugt.';

-- Betaler brugeren ikke selv, og gik kaldet i stykker, før der kom tekst ud,
-- giver vi prøveteksten tilbage. Det ville være dårlig stil at opkræve for
-- noget, der aldrig blev skrevet.
create function public.frigiv_proeve_tekst(bruger uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set trial_used = greatest(trial_used - 1, 0)
   where id = bruger;
end;
$$;

comment on function public.frigiv_proeve_tekst is
  'Lægger én prøvetekst tilbage i kvoten, når en generering slog fejl.';

-- VIGTIGT. security definer betyder, at funktionerne kører med ejerens
-- rettigheder og derfor må ændre profiles, selvom ingen update-policy findes.
-- Uden linjerne herunder kunne enhver indlogget bruger kalde dem direkte
-- gennem Supabases API — og enten nulstille sin egen kvote med
-- frigiv_proeve_tekst eller brænde en fremmed brugers kvote af.
-- De må derfor KUN kaldes af serverkode med service_role.
revoke execute on function public.reserver_proeve_tekst(uuid) from public, anon, authenticated;
revoke execute on function public.frigiv_proeve_tekst(uuid) from public, anon, authenticated;
grant execute on function public.reserver_proeve_tekst(uuid) to service_role;
grant execute on function public.frigiv_proeve_tekst(uuid) to service_role;
