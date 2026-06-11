create table if not exists public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  profile_photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.account_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.app_accounts(id) on delete cascade,
  following_id uuid not null references public.app_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.app_accounts enable row level security;
alter table public.account_follows enable row level security;

drop policy if exists "App accounts are readable" on public.app_accounts;
create policy "App accounts are readable" on public.app_accounts for select using (true);
drop policy if exists "Anyone can create app accounts" on public.app_accounts;
create policy "Anyone can create app accounts" on public.app_accounts for insert with check (true);
drop policy if exists "Anyone can update app accounts" on public.app_accounts;
create policy "Anyone can update app accounts" on public.app_accounts for update using (true) with check (true);

drop policy if exists "Account follows are readable" on public.account_follows;
create policy "Account follows are readable" on public.account_follows for select using (true);
drop policy if exists "Anyone can follow accounts" on public.account_follows;
create policy "Anyone can follow accounts" on public.account_follows for insert with check (true);
drop policy if exists "Anyone can unfollow accounts" on public.account_follows;
create policy "Anyone can unfollow accounts" on public.account_follows for delete using (true);
