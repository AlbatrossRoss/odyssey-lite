create table if not exists public.app_post_comment_reads (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.app_post_comments(id) on delete cascade,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, account_id)
);

create index if not exists app_post_comment_reads_account_idx on public.app_post_comment_reads(account_id);

alter table public.app_post_comment_reads enable row level security;

drop policy if exists "Comment reads are readable" on public.app_post_comment_reads;
create policy "Comment reads are readable" on public.app_post_comment_reads for select using (true);
drop policy if exists "Anyone can mark comment reads" on public.app_post_comment_reads;
create policy "Anyone can mark comment reads" on public.app_post_comment_reads for insert with check (true);
