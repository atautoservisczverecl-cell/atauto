-- A.T. Autoservis – databáze administrace (Supabase / Postgres)

create table if not exists admins (user_id uuid primary key references auth.users(id) on delete cascade, email text);
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  label text not null, href text not null, position int not null default 0,
  in_header boolean not null default true, in_mobile boolean not null default true
);

create table if not exists pages (
  slug text primary key,                     -- cesta bez lomítek, '' = úvod; např. 'oprava-automaticke-prevodovky'
  title text not null,                       -- název v administraci
  h1 text, lead text, body_md text,          -- vlastní stránky (custom=true) mají obsah zde
  custom boolean not null default false,
  seo_title text, seo_description text, og_image text, noindex boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  title text not null, summary text, icon text default 'wrench', href text,
  price_note text, bookable boolean not null default false, position int not null default 0, visible boolean not null default true
);

create table if not exists gallery_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null, alt text not null, category text not null default 'ostatni',
  width int, height int, position int not null default 0, created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  services text[] not null, date date not null, date_alt date, time_window text, wait text,
  brand text, model text, year text, engine text, km text, vin text,
  name text not null, phone text not null, email text, message text,
  status text not null default 'nova' check (status in ('nova','potvrzena','zamitnuta','hotovo')),
  confirmed_date date, admin_note text,
  created_at timestamptz not null default now()
);

create table if not exists blocked_days (day date primary key, reason text);

create table if not exists page_events (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(), path text not null, referrer text,
  event text not null default 'pageview' check (event in ('pageview','click_phone','click_email','cta_inquiry','cta_booking','generate_lead')),
  device text, visitor text                  -- visitor = denní anonymní hash (bez cookies)
);
create index if not exists page_events_ts on page_events (ts);

do $$ declare t text; begin
  foreach t in array array['admins','menu_items','pages','services','gallery_photos','bookings','blocked_days','page_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admin all" on %I', t);
    execute format('create policy "admin all" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- veřejnost: čtení obsahu, vkládání rezervací a měření
drop policy if exists "public read" on menu_items;     create policy "public read" on menu_items for select using (true);
drop policy if exists "public read" on pages;          create policy "public read" on pages for select using (true);
drop policy if exists "public read" on services;       create policy "public read" on services for select using (visible);
drop policy if exists "public read" on gallery_photos; create policy "public read" on gallery_photos for select using (true);
drop policy if exists "public read" on blocked_days;   create policy "public read" on blocked_days for select using (true);
drop policy if exists "public insert" on bookings;     create policy "public insert" on bookings for insert to anon, authenticated with check (status = 'nova');
drop policy if exists "public insert" on page_events;  create policy "public insert" on page_events for insert to anon, authenticated with check (true);

-- úložiště fotek
insert into storage.buckets (id, name, public) values ('realizace', 'realizace', true) on conflict (id) do nothing;
drop policy if exists "admin write realizace" on storage.objects;
create policy "admin write realizace" on storage.objects for all to authenticated
  using (bucket_id = 'realizace' and is_admin()) with check (bucket_id = 'realizace' and is_admin());

-- souhrn návštěvnosti pro administraci
create or replace function stats_daily(days int default 30)
returns table (day date, views bigint, visitors bigint, calls bigint, leads bigint)
language sql stable security definer set search_path = public as $$
  select d::date, 
    count(e.id) filter (where e.event = 'pageview'),
    count(distinct e.visitor) filter (where e.event = 'pageview'),
    count(e.id) filter (where e.event = 'click_phone'),
    count(e.id) filter (where e.event = 'generate_lead')
  from generate_series(current_date - (days - 1), current_date, '1 day') d
  left join page_events e on e.ts::date = d::date
  where is_admin()
  group by d order by d;
$$;
