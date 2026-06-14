alter table if exists public.app_posts
  add column if not exists media_types text[] not null default '{}';

update public.app_posts
set media_types = array_fill('image'::text, array[cardinality(media_urls)])
where cardinality(media_urls) > 0
  and cardinality(media_types) = 0;

update public.app_posts
set media_types = array['image'::text]
where cardinality(media_types) = 0;
