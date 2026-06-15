create table if not exists public.app_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.app_posts(id) on delete cascade,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists app_post_comments_post_created_idx on public.app_post_comments(post_id, created_at desc);

alter table public.app_post_comments enable row level security;

drop policy if exists "Post comments are readable" on public.app_post_comments;
create policy "Post comments are readable" on public.app_post_comments for select using (true);
drop policy if exists "Anyone can create post comments" on public.app_post_comments;
create policy "Anyone can create post comments" on public.app_post_comments for insert with check (true);
