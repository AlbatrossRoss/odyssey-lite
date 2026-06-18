create table if not exists public.app_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.app_posts(id) on delete cascade,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, account_id)
);

create index if not exists app_post_likes_post_idx on public.app_post_likes(post_id);
create index if not exists app_post_likes_account_idx on public.app_post_likes(account_id);

alter table public.app_post_likes enable row level security;

drop policy if exists "Post likes are readable" on public.app_post_likes;
create policy "Post likes are readable" on public.app_post_likes for select using (true);
drop policy if exists "Anyone can like posts" on public.app_post_likes;
create policy "Anyone can like posts" on public.app_post_likes for insert with check (true);
drop policy if exists "Anyone can unlike posts" on public.app_post_likes;
create policy "Anyone can unlike posts" on public.app_post_likes for delete using (true);

create table if not exists public.app_post_like_reads (
  id uuid primary key default gen_random_uuid(),
  like_id uuid not null references public.app_post_likes(id) on delete cascade,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (like_id, account_id)
);

create index if not exists app_post_like_reads_account_idx on public.app_post_like_reads(account_id);

alter table public.app_post_like_reads enable row level security;

drop policy if exists "Like reads are readable" on public.app_post_like_reads;
create policy "Like reads are readable" on public.app_post_like_reads for select using (true);
drop policy if exists "Anyone can mark like reads" on public.app_post_like_reads;
create policy "Anyone can mark like reads" on public.app_post_like_reads for insert with check (true);
