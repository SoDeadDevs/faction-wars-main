This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

### Profiles Table (Admin Feature)

To enable wallet profiles, add the following table to Supabase:

```sql
create table public.profiles (
  wallet text primary key,
  username text unique,
  avatar_url text,
  badges jsonb default '[]'::jsonb,
  badges_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional helper index for leaderboard sorting
create index profiles_badges_count_idx on public.profiles (badges_count desc);

-- Storage bucket for profile avatars (public read)
select storage.create_bucket('avatars', true);

-- Allow public read access (adjust policy as needed)
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
```

Grant RLS policies so connected wallets can select/upsert their own row, and admins (service role) can manage all rows. The UI expects `profiles.badges` to be an array of badge slugs (see `src/lib/badges.ts`).

### Achievement tables

Automatic awarding relies on two helper tables plus a trigger that keeps the legacy `profiles.badges` cache fresh. Apply `supabase/migrations/20240523120000_add_achievements.sql` (or copy the snippet below) to create the schema:

```sql
create table public.badge_definitions (
  slug text primary key,
  name text not null,
  description text not null,
  requirement text not null,
  image text,
  created_at timestamptz default now()
);

create table public.profile_badges (
  wallet text references public.profiles(wallet) on delete cascade,
  badge_slug text references public.badge_definitions(slug) on delete cascade,
  earned_at timestamptz default now(),
  context jsonb,
  primary key (wallet, badge_slug)
);

create or replace function public.refresh_profile_badge_cache() returns trigger as $$
declare
  target_wallet text;
begin
  target_wallet := coalesce(new.wallet, old.wallet);

  update public.profiles
    set badges = coalesce((
          select jsonb_agg(pb.badge_slug order by pb.earned_at desc)
          from public.profile_badges pb
          where pb.wallet = target_wallet
        ), '[]'::jsonb),
        badges_count = (
          select count(*) from public.profile_badges pb where pb.wallet = target_wallet
        )
  where public.profiles.wallet = target_wallet;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$ language plpgsql;

create trigger profile_badges_refresh_cache
  after insert or update or delete on public.profile_badges
  for each row execute function public.refresh_profile_badge_cache();
```

Seed `badge_definitions` with the same slugs that exist in `src/lib/badges.ts`, and insert rows into `profile_badges` whenever a user earns something new. The trigger keeps the cached arrays/counts in sync for the existing UI.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
