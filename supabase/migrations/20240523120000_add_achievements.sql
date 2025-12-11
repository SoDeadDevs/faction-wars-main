-- Achievements + badge catalog schema

create table if not exists public.badge_definitions (
  slug text primary key,
  name text not null,
  description text not null,
  requirement text not null,
  image text,
  created_at timestamptz not null default now()
);

comment on table public.badge_definitions is 'Catalog of every badge/achievement the client references.';

create table if not exists public.profile_badges (
  wallet text references public.profiles(wallet) on delete cascade,
  badge_slug text references public.badge_definitions(slug) on delete cascade,
  earned_at timestamptz not null default now(),
  context jsonb,
  primary key (wallet, badge_slug)
);

comment on table public.profile_badges is 'Join table tracking which wallets earned which badges.';

create index if not exists profile_badges_wallet_idx on public.profile_badges (wallet, earned_at desc);
create index if not exists profile_badges_badge_idx on public.profile_badges (badge_slug);

-- Keep profiles.badges + badges_count in sync for older UI bits
create or replace function public.refresh_profile_badge_cache() returns trigger as $$
declare
  target_wallet text;
begin
  target_wallet := coalesce(new.wallet, old.wallet);

  -- Update badge cache json + count on the parent profile
  update public.profiles
    set badges = coalesce(
          (
            select jsonb_agg(pb.badge_slug order by pb.earned_at desc)
            from public.profile_badges pb
            where pb.wallet = target_wallet
          ),
          '[]'::jsonb
        ),
        badges_count = (
          select count(*)
          from public.profile_badges pb
          where pb.wallet = target_wallet
        )
  where public.profiles.wallet = target_wallet;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists profile_badges_refresh_cache on public.profile_badges;
create trigger profile_badges_refresh_cache
  after insert or update or delete on public.profile_badges
  for each row execute function public.refresh_profile_badge_cache();

-- RLS policies (adjust auth logic to your environment)
alter table public.badge_definitions enable row level security;
alter table public.profile_badges enable row level security;

-- Let service role (used on the backend) manage both tables
create policy "Service role full access"
  on public.badge_definitions
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role full access"
  on public.profile_badges
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Optional read access so clients can fetch the public catalog
create policy "Public read badge catalog"
  on public.badge_definitions for select
  using (true);

-- Add more granular wallet-facing policies if end users should query their own badges directly.
