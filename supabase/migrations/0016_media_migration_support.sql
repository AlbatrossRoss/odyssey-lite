create unique index if not exists media_assets_legacy_url_idx
  on public.media_assets (legacy_url)
  where legacy_url is not null;

create or replace function public.set_media_asset_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at
before update on public.media_assets
for each row execute function public.set_media_asset_updated_at();

drop policy if exists "Prototype accounts can attach post media" on public.app_post_media;
create policy "Prototype accounts can attach post media"
on public.app_post_media for insert
with check (
  exists (
    select 1
    from public.app_posts
    where app_posts.id = post_id
  )
);

