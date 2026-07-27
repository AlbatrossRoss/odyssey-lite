create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.app_accounts(id) on delete cascade,
  provider text not null check (provider in ('cloudflare_images', 'cloudflare_stream', 'supabase')),
  provider_asset_id text not null,
  kind text not null check (kind in ('image', 'video')),
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'failed')),
  delivery_url text,
  legacy_url text,
  original_filename text,
  mime_type text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds double precision check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_asset_id)
);

create table if not exists public.app_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.app_posts(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (post_id, position),
  unique (post_id, media_asset_id)
);

create index if not exists media_assets_owner_created_idx
  on public.media_assets (owner_account_id, created_at desc);
create index if not exists media_assets_status_idx
  on public.media_assets (status);
create index if not exists app_post_media_asset_idx
  on public.app_post_media (media_asset_id);

alter table public.media_assets enable row level security;
alter table public.app_post_media enable row level security;

drop policy if exists "Media assets are readable" on public.media_assets;
create policy "Media assets are readable"
on public.media_assets for select
using (true);

-- This matches the prototype's current account model. Replace it with auth.uid()
-- ownership checks when app_accounts is migrated to Supabase Auth.
drop policy if exists "Prototype accounts can create media assets" on public.media_assets;
create policy "Prototype accounts can create media assets"
on public.media_assets for insert
with check (
  exists (
    select 1
    from public.app_accounts
    where app_accounts.id = owner_account_id
  )
);

drop policy if exists "Prototype accounts can update media assets" on public.media_assets;
create policy "Prototype accounts can update media assets"
on public.media_assets for update
using (
  exists (
    select 1
    from public.app_accounts
    where app_accounts.id = owner_account_id
  )
)
with check (
  exists (
    select 1
    from public.app_accounts
    where app_accounts.id = owner_account_id
  )
);

drop policy if exists "Post media is readable" on public.app_post_media;
create policy "Post media is readable"
on public.app_post_media for select
using (true);

drop policy if exists "Prototype accounts can attach post media" on public.app_post_media;
create policy "Prototype accounts can attach post media"
on public.app_post_media for insert
with check (
  exists (
    select 1
    from public.app_posts
    join public.media_assets on media_assets.id = media_asset_id
    where app_posts.id = post_id
      and app_posts.account_id = media_assets.owner_account_id
  )
);

