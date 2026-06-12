create table if not exists public.app_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  type text not null check (type in ('trip', 'experience')),
  title text not null,
  location text not null,
  caption text not null,
  image_url text not null,
  latitude double precision not null,
  longitude double precision not null,
  date_label text not null,
  visibility text not null default 'Public',
  created_at timestamptz not null default now()
);

alter table public.app_posts enable row level security;

drop policy if exists "App posts are readable" on public.app_posts;
create policy "App posts are readable" on public.app_posts for select using (true);
drop policy if exists "Anyone can create app posts" on public.app_posts;
create policy "Anyone can create app posts" on public.app_posts for insert with check (true);
drop policy if exists "Anyone can update app posts" on public.app_posts;
create policy "Anyone can update app posts" on public.app_posts for update using (true) with check (true);
drop policy if exists "Anyone can delete app posts" on public.app_posts;
create policy "Anyone can delete app posts" on public.app_posts for delete using (true);
