create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id text primary key,
  display_name text not null,
  handle text not null unique,
  avatar_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  destination text not null,
  date_label text not null,
  cover_image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.experiences (
  id text primary key,
  slug text not null unique,
  user_id text not null references public.profiles(id) on delete cascade,
  trip_id text not null references public.trips(id) on delete cascade,
  name text not null,
  location text not null,
  region text not null,
  latitude double precision not null,
  longitude double precision not null,
  caption text not null,
  highlight text,
  image_url text not null,
  also_experienced_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.friend_posts (
  id text primary key,
  type text not null check (type in ('trip', 'experience')),
  user_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  destination text not null,
  date_label text not null,
  caption text not null,
  image_url text not null,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists public.boards (
  id text primary key,
  slug text not null unique,
  owner_id text references public.profiles(id) on delete set null,
  title text not null,
  subtitle text not null,
  cover_image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.boards(id) on delete cascade,
  experience_slug text not null references public.experiences(slug) on delete cascade,
  created_at timestamptz not null default now(),
  unique (board_id, experience_slug)
);

create table if not exists public.planned_trips (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  destination text not null,
  date_range text not null,
  joined_user_ids text[] not null default '{}',
  extra_count integer not null default 0,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.experiences enable row level security;
alter table public.friend_posts enable row level security;
alter table public.boards enable row level security;
alter table public.board_items enable row level security;
alter table public.planned_trips enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable" on public.profiles for select using (true);
drop policy if exists "Public trips are readable" on public.trips;
create policy "Public trips are readable" on public.trips for select using (true);
drop policy if exists "Public experiences are readable" on public.experiences;
create policy "Public experiences are readable" on public.experiences for select using (true);
drop policy if exists "Public friend posts are readable" on public.friend_posts;
create policy "Public friend posts are readable" on public.friend_posts for select using (true);
drop policy if exists "Public boards are readable" on public.boards;
create policy "Public boards are readable" on public.boards for select using (true);
drop policy if exists "Public board items are readable" on public.board_items;
create policy "Public board items are readable" on public.board_items for select using (true);
drop policy if exists "Public planned trips are readable" on public.planned_trips;
create policy "Public planned trips are readable" on public.planned_trips for select using (true);

drop policy if exists "Authenticated users can write profiles" on public.profiles;
create policy "Authenticated users can write profiles" on public.profiles for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can write trips" on public.trips;
create policy "Authenticated users can write trips" on public.trips for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can write experiences" on public.experiences;
create policy "Authenticated users can write experiences" on public.experiences for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can write friend posts" on public.friend_posts;
create policy "Authenticated users can write friend posts" on public.friend_posts for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can write boards" on public.boards;
create policy "Authenticated users can write boards" on public.boards for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can write board items" on public.board_items;
create policy "Authenticated users can write board items" on public.board_items for all to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can write planned trips" on public.planned_trips;
create policy "Authenticated users can write planned trips" on public.planned_trips for all to authenticated using (true) with check (true);

insert into public.profiles (id, display_name, handle, avatar_url) values
  ('maya', 'Allison', '@maya', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80'),
  ('leo', 'Jake', '@leosantos', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80'),
  ('nina', 'Sarah', '@nina', 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=160&q=80'),
  ('eli', 'Matt', '@elib', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80'),
  ('justin', 'Justin', '@justin', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80'),
  ('megan', 'Megan', '@megan', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80'),
  ('david', 'David', '@david', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=160&q=80')
on conflict (id) do update set
  display_name = excluded.display_name,
  handle = excluded.handle,
  avatar_url = excluded.avatar_url;

insert into public.trips (id, user_id, title, destination, date_label, cover_image_url) values
  ('maya-hawaii', 'maya', 'Soft light, big water', 'Hawaii', 'May 2025', 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=900&q=80'),
  ('leo-maui', 'leo', 'Maui road notes', 'Hawaii', 'April 2025', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'),
  ('nina-kona', 'nina', 'A week underwater', 'Hawaii', 'June 2025', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80')
on conflict (id) do update set
  user_id = excluded.user_id,
  title = excluded.title,
  destination = excluded.destination,
  date_label = excluded.date_label,
  cover_image_url = excluded.cover_image_url;

insert into public.experiences (
  id, slug, user_id, trip_id, name, location, region, latitude, longitude, caption, highlight, image_url, also_experienced_by
) values
  ('manta', 'manta-ray-night-dive', 'maya', 'maya-hawaii', 'Manta Ray Night Dive', 'Kailua-Kona, Big Island', 'Big Island', 19.639, -156.0456, 'This was the coolest thing we did in Hawaii. Unreal experience.', 'Worth planning the trip around', 'https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=900&q=70', array['maya', 'eli']),
  ('hana', 'road-to-hana', 'leo', 'leo-maui', 'Road to Hana', 'Hana Highway, Maui', 'Maui', 20.7984, -156.1677, 'The drive to Hana is as good as everyone says. So many waterfalls!', 'Slow travel day', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=70', array['maya']),
  ('haleakala', 'haleakala-sunrise', 'nina', 'maya-hawaii', 'Haleakalā Sunrise', 'Haleakalā National Park, Maui', 'Maui', 20.7097, -156.2533, 'Cold, quiet, and completely unreal. Bring coffee for the drive up.', 'Book ahead', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=70', array['leo', 'nina']),
  ('punaluu', 'punaluu-black-sand-beach', 'eli', 'maya-hawaii', 'Punaluʻu Black Sand Beach', 'Kaʻu, Big Island', 'Big Island', 19.1364, -155.5043, 'My favorite beach on the island. So peaceful in the morning.', 'Golden hour', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=70', array['nina']),
  ('wailea', 'wailea-beach', 'maya', 'maya-hawaii', 'Wailea Beach', 'Wailea, Maui', 'Maui', 20.6893, -156.4417, 'Local food stop right after the beach. Exactly what we needed.', 'Easy beach day', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=70', array['leo', 'eli'])
on conflict (id) do update set
  slug = excluded.slug,
  user_id = excluded.user_id,
  trip_id = excluded.trip_id,
  name = excluded.name,
  location = excluded.location,
  region = excluded.region,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  caption = excluded.caption,
  highlight = excluded.highlight,
  image_url = excluded.image_url,
  also_experienced_by = excluded.also_experienced_by;

insert into public.friend_posts (
  id, type, user_id, title, destination, date_label, caption, image_url, latitude, longitude, created_at
) values
  ('hawaii-2026-post', 'trip', 'maya', 'Hawaii 2026', 'Kona Coast, Hawaii', '2h ago', 'Saving every beach and dive note for the next warm-water escape.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=75', 19.639, -156.0456, now() - interval '2 hours'),
  ('phi-phi', 'experience', 'leo', 'Phi Phi Islands', 'Krabi, Thailand', '5h ago', 'Longtail boat, clear water, and a swim stop we almost skipped.', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=75', 7.7407, 98.7784, now() - interval '5 hours'),
  ('banff-road-trip', 'trip', 'nina', 'Banff Road Trip', 'Banff, Canada', '1d ago', 'Cold mornings, empty trails, and a lake that looked fake in every photo.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=75', 51.1784, -115.5708, now() - interval '1 day'),
  ('bali-evening', 'experience', 'maya', 'Bali East Coast', 'Uluwatu, Bali', '2d ago', 'Sunset dinner after the longest swim of the trip.', 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=900&q=75', -8.4095, 115.1889, now() - interval '2 days'),
  ('tokyo-evening', 'trip', 'nina', 'Three nights in Tokyo', 'Tokyo, Japan', '3d ago', 'Saved every tiny coffee shop and somehow still missed half the list.', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=900&q=75', 35.6895, 139.6917, now() - interval '3 days')
on conflict (id) do update set
  type = excluded.type,
  user_id = excluded.user_id,
  title = excluded.title,
  destination = excluded.destination,
  date_label = excluded.date_label,
  caption = excluded.caption,
  image_url = excluded.image_url,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  created_at = excluded.created_at;

insert into public.boards (id, slug, owner_id, title, subtitle, cover_image_url) values
  ('hawaii', 'hawaii-2026', 'maya', 'Hawaii 2026', 'Ocean days, sunrise hikes, and friend-tested gems', 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=1000&q=80'),
  ('japan', 'japan', 'maya', 'Japan', 'Neighborhood walks, ryokans, and late-night noodles', 'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1000&q=80'),
  ('dive', 'future-dive-trips', 'maya', 'Future Dive Trips', 'Warm water saves from people I trust', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=80')
on conflict (id) do update set
  slug = excluded.slug,
  owner_id = excluded.owner_id,
  title = excluded.title,
  subtitle = excluded.subtitle,
  cover_image_url = excluded.cover_image_url;

insert into public.board_items (board_id, experience_slug) values
  ('hawaii', 'manta-ray-night-dive'),
  ('hawaii', 'haleakala-sunrise'),
  ('hawaii', 'wailea-beach'),
  ('dive', 'manta-ray-night-dive')
on conflict (board_id, experience_slug) do nothing;

insert into public.planned_trips (
  id, user_id, destination, date_range, joined_user_ids, extra_count, latitude, longitude
) values
  ('justin-japan', 'justin', 'Japan', 'May 10 - May 24, 2026', array['maya', 'nina', 'eli'], 3, 36.2048, 138.2529),
  ('megan-italy', 'megan', 'Italy', 'Jun 3 - Jun 17, 2026', array['maya', 'nina', 'eli'], 2, 41.8719, 12.5674),
  ('david-patagonia', 'david', 'Patagonia', 'Aug 12 - Aug 27, 2026', array['maya', 'nina', 'eli'], 4, -50.9423, -73.0542)
on conflict (id) do update set
  user_id = excluded.user_id,
  destination = excluded.destination,
  date_range = excluded.date_range,
  joined_user_ids = excluded.joined_user_ids,
  extra_count = excluded.extra_count,
  latitude = excluded.latitude,
  longitude = excluded.longitude;
