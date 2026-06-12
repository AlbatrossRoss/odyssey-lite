create table if not exists public.app_boards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  slug text not null,
  title text not null,
  subtitle text not null default '',
  cover_image_url text not null default '/hawaii-reference-map.png',
  created_at timestamptz not null default now(),
  unique (account_id, slug)
);

create table if not exists public.app_board_posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.app_boards(id) on delete cascade,
  post_id uuid not null references public.app_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (board_id, post_id)
);

alter table public.app_boards enable row level security;
alter table public.app_board_posts enable row level security;

drop policy if exists "App boards are readable" on public.app_boards;
create policy "App boards are readable" on public.app_boards for select using (true);
drop policy if exists "Anyone can create app boards" on public.app_boards;
create policy "Anyone can create app boards" on public.app_boards for insert with check (true);
drop policy if exists "Anyone can update app boards" on public.app_boards;
create policy "Anyone can update app boards" on public.app_boards for update using (true) with check (true);
drop policy if exists "Anyone can delete app boards" on public.app_boards;
create policy "Anyone can delete app boards" on public.app_boards for delete using (true);

drop policy if exists "App board posts are readable" on public.app_board_posts;
create policy "App board posts are readable" on public.app_board_posts for select using (true);
drop policy if exists "Anyone can create app board posts" on public.app_board_posts;
create policy "Anyone can create app board posts" on public.app_board_posts for insert with check (true);
drop policy if exists "Anyone can update app board posts" on public.app_board_posts;
create policy "Anyone can update app board posts" on public.app_board_posts for update using (true) with check (true);
drop policy if exists "Anyone can delete app board posts" on public.app_board_posts;
create policy "Anyone can delete app board posts" on public.app_board_posts for delete using (true);
