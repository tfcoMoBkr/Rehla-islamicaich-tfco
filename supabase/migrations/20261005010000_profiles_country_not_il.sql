-- profiles.country refuses IL. The app's country list leaves it out (web/src/lib/account/countries.ts),
-- and this keeps any other way in from storing it.
--
-- Idempotent: safe to run again in the Supabase SQL editor.

-- A row saved before this rule would stop the constraint from being added; it loses the country only.
update public.profiles set country = null where country = 'IL';

alter table public.profiles drop constraint if exists profiles_country_not_il;
alter table public.profiles
  add constraint profiles_country_not_il check (country is distinct from 'IL');
