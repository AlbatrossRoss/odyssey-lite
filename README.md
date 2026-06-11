# Odyssey Lite

Mobile-first web prototype for validating the Odyssey travel discovery loop:

Search destination -> see friend-sourced experiences on a real map -> open experience detail -> save experience to a board.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` and add your Mapbox public token:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase Setup

This prototype is prepared for Supabase, but still keeps static data as a fallback while the database is being wired into each screen.

1. Create a Supabase project.
2. Copy your `Project URL` and `anon public key` into `.env.local`.
3. Open Supabase SQL Editor.
4. Paste and run the SQL in `supabase/migrations/0001_initial_schema.sql`.

The migration creates:

- `profiles`
- `trips`
- `experiences`
- `friend_posts`
- `planned_trips`
- `boards`
- `board_items`

It also enables Row Level Security, allows public read access for prototype browsing, allows authenticated writes for later posting, and seeds the current Odyssey Lite mock data.

Run the prototype:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Prototype Routes

- `/` - Home map feed
- `/destination/hawaii` - Hawaii destination discovery map
- `/experience/manta-ray-night-dive` - Experience detail
- `/boards` - Boards overview
- `/boards/hawaii-2026` - Saved Hawaii board
