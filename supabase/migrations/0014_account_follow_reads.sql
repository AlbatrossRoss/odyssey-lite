create table if not exists public.account_follow_reads (
  id uuid primary key default gen_random_uuid(),
  follow_id uuid not null references public.account_follows(id) on delete cascade,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follow_id, account_id)
);

create index if not exists account_follow_reads_account_idx on public.account_follow_reads(account_id);

alter table public.account_follow_reads enable row level security;

drop policy if exists "Follow reads are readable" on public.account_follow_reads;
create policy "Follow reads are readable" on public.account_follow_reads for select using (true);
drop policy if exists "Anyone can mark follow reads" on public.account_follow_reads;
create policy "Anyone can mark follow reads" on public.account_follow_reads for insert with check (true);
