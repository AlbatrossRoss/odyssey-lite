create index if not exists app_posts_created_idx on public.app_posts(created_at desc);
create index if not exists app_posts_account_created_idx on public.app_posts(account_id, created_at desc);
create index if not exists app_posts_type_created_idx on public.app_posts(type, created_at desc);

create index if not exists app_boards_account_idx on public.app_boards(account_id);
create index if not exists app_board_posts_board_idx on public.app_board_posts(board_id);
create index if not exists app_board_posts_post_idx on public.app_board_posts(post_id);
