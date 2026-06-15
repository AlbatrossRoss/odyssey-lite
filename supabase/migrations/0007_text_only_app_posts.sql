alter table if exists public.app_posts
  alter column image_url drop not null;

alter table if exists public.app_posts
  add column if not exists tags text[] not null default '{}';
