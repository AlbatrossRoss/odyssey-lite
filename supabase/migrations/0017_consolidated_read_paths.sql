create index if not exists app_posts_location_created_idx
  on public.app_posts (latitude, longitude, created_at desc);
create index if not exists account_follows_following_follower_idx
  on public.account_follows (following_id, follower_id);
create index if not exists account_follows_follower_following_idx
  on public.account_follows (follower_id, following_id);
create index if not exists app_post_media_post_position_idx
  on public.app_post_media (post_id, position);
create index if not exists app_board_posts_board_created_idx
  on public.app_board_posts (board_id, created_at);

create or replace function public.get_recommendations(
  west double precision default null,
  south double precision default null,
  east double precision default null,
  north double precision default null,
  page_size integer default 40,
  page_offset integer default 0,
  profile_account_id uuid default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with selected_posts as (
    select p.*
    from public.app_posts p
    where (profile_account_id is null or p.account_id = profile_account_id)
      and (south is null or p.latitude >= south)
      and (north is null or p.latitude <= north)
      and (
        west is null
        or east is null
        or (west <= east and p.longitude between west and east)
        or (west > east and (p.longitude >= west or p.longitude <= east))
      )
    order by p.created_at desc
    limit least(greatest(page_size, 1), 80)
    offset greatest(page_offset, 0)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'accountId', p.account_id,
      'username', a.username,
      'profilePhotoUrl', a.profile_photo_url,
      'type', p.type,
      'title', p.title,
      'location', p.location,
      'caption', p.caption,
      'imageUrl', coalesce(media.urls ->> 0, mapped_image.delivery_url, p.image_url),
      'mediaUrls', coalesce(media.urls, mapped_media.urls, to_jsonb(coalesce(p.media_urls, '{}'::text[]))),
      'mediaTypes', coalesce(media.kinds, to_jsonb(coalesce(p.media_types, '{}'::text[]))),
      'tags', to_jsonb(coalesce(p.tags, '{}'::text[])),
      'coordinates', jsonb_build_array(p.longitude, p.latitude),
      'dateLabel', p.date_label,
      'visibility', p.visibility,
      'createdAt', p.created_at
    )
    order by p.created_at desc
  ), '[]'::jsonb)
  from selected_posts p
  join public.app_accounts a on a.id = p.account_id
  left join lateral (
    select
      jsonb_agg(ma.delivery_url order by pm.position) filter (where ma.delivery_url is not null) as urls,
      jsonb_agg(ma.kind order by pm.position) as kinds
    from public.app_post_media pm
    join public.media_assets ma on ma.id = pm.media_asset_id and ma.status = 'ready'
    where pm.post_id = p.id
  ) media on true
  left join lateral (
    select ma.delivery_url
    from public.media_assets ma
    where ma.status = 'ready' and ma.legacy_url = p.image_url
    limit 1
  ) mapped_image on true
  left join lateral (
    select jsonb_agg(coalesce(ma.delivery_url, legacy.url) order by legacy.ordinality) as urls
    from unnest(coalesce(p.media_urls, '{}'::text[])) with ordinality legacy(url, ordinality)
    left join public.media_assets ma on ma.status = 'ready' and ma.legacy_url = legacy.url
  ) mapped_media on true;
$$;

grant execute on function public.get_recommendations(double precision, double precision, double precision, double precision, integer, integer, uuid)
  to anon, authenticated;

create or replace function public.get_profile_bundle(
  profile_username text,
  viewer_account_id uuid default null,
  post_page_size integer default 24,
  post_page_offset integer default 0
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with target as (
    select *
    from public.app_accounts
    where username = lower(trim(leading '@' from profile_username))
    limit 1
  ),
  account_payload as (
    select jsonb_build_object(
      'id', a.id,
      'username', a.username,
      'password', a.password,
      'profilePhotoUrl', a.profile_photo_url,
      'currentCity', a.current_city,
      'currentCityCoordinates',
        case when a.current_city_longitude is not null and a.current_city_latitude is not null
          then jsonb_build_array(a.current_city_longitude, a.current_city_latitude)
          else null
        end,
      'createdAt', a.created_at,
      'stats', jsonb_build_object(
        'followers', (select count(*) from public.account_follows f where f.following_id = a.id),
        'following', (select count(*) from public.account_follows f where f.follower_id = a.id),
        'posts', (select count(*) from public.app_posts p where p.account_id = a.id)
      ),
      'isFollowedByViewer', exists(
        select 1 from public.account_follows f
        where f.follower_id = viewer_account_id and f.following_id = a.id
      )
    ) as value
    from target a
  ),
  posts_payload as (
    select case
      when (select id from target) is null then '[]'::jsonb
      else public.get_recommendations(
        page_size => post_page_size,
        page_offset => post_page_offset,
        profile_account_id => (select id from target)
      )
    end as value
  ),
  board_rows as (
    select
      b.*,
      coalesce(
        (select ma.delivery_url from public.media_assets ma where ma.status = 'ready' and ma.legacy_url = b.cover_image_url limit 1),
        b.cover_image_url
      ) as resolved_cover
    from public.app_boards b
    where b.account_id = (select id from target)
    order by b.created_at
  ),
  boards_payload as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'accountId', b.account_id,
        'slug', b.slug,
        'title', b.title,
        'subtitle', b.subtitle,
        'coverImageUrl', b.resolved_cover,
        'previewImageUrls', coalesce(previews.urls, '[]'::jsonb),
        'postIds', coalesce(previews.post_ids, '[]'::jsonb),
        'createdAt', b.created_at
      )
      order by b.created_at
    ), '[]'::jsonb) as value
    from board_rows b
    left join lateral (
      select
        jsonb_agg(bp.post_id order by bp.created_at) as post_ids,
        coalesce(
          jsonb_agg(
            coalesce(ma.delivery_url, p.image_url)
            order by bp.created_at
          ) filter (where p.image_url is not null),
          '[]'::jsonb
        ) as urls
      from public.app_board_posts bp
      join public.app_posts p on p.id = bp.post_id
      left join public.media_assets ma on ma.status = 'ready' and ma.legacy_url = p.image_url
      where bp.board_id = b.id
    ) previews on true
  )
  select jsonb_build_object(
    'account', (select value from account_payload),
    'posts', (select value from posts_payload),
    'boards', (select value from boards_payload)
  );
$$;

grant execute on function public.get_profile_bundle(text, uuid, integer, integer)
  to anon, authenticated;
