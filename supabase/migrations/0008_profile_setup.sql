alter table if exists public.app_accounts
  add column if not exists current_city text,
  add column if not exists current_city_longitude double precision,
  add column if not exists current_city_latitude double precision;
