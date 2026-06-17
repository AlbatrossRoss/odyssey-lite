alter table public.app_post_comments
add column if not exists reply_to_comment_id uuid references public.app_post_comments(id) on delete cascade;

create index if not exists app_post_comments_reply_to_idx on public.app_post_comments(reply_to_comment_id);
