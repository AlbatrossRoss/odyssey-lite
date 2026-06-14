insert into storage.buckets (id, name, public)
values ('app-post-media', 'app-post-media', true)
on conflict (id) do update set public = excluded.public;

alter table if exists public.app_posts
add column if not exists media_urls text[] not null default '{}';

update public.app_posts
set media_urls = array[image_url]
where (media_urls is null or cardinality(media_urls) = 0)
  and image_url is not null;

drop policy if exists "App post media is readable" on storage.objects;
create policy "App post media is readable"
on storage.objects for select
using (bucket_id = 'app-post-media');

drop policy if exists "Anyone can upload app post media" on storage.objects;
create policy "Anyone can upload app post media"
on storage.objects for insert
with check (bucket_id = 'app-post-media');

drop policy if exists "Anyone can update app post media" on storage.objects;
create policy "Anyone can update app post media"
on storage.objects for update
using (bucket_id = 'app-post-media')
with check (bucket_id = 'app-post-media');

drop policy if exists "Anyone can delete app post media" on storage.objects;
create policy "Anyone can delete app post media"
on storage.objects for delete
using (bucket_id = 'app-post-media');
