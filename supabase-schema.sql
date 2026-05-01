-- SIGNAL — Supabase schema
-- Run this in the Supabase SQL editor

-- Racks table
create table if not exists racks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  hp_capacity integer,
  created_at timestamptz default now()
);

-- Modules table
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manufacturer text not null,
  category text,
  personal_notes text,
  delta text,
  manual_digest text,
  manual_url text,
  hp integer,
  rack_id uuid references racks(id) on delete set null,
  is_controller boolean not null default false,
  created_at timestamptz default now()
);

-- Lessons table
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mode text not null,
  module_ids uuid[],
  style_ref text,
  goal text,
  content text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table racks enable row level security;
alter table modules enable row level security;
alter table lessons enable row level security;

-- Open policies (single user app)
create policy "Allow all on racks" on racks
  for all using (true) with check (true);

create policy "Allow all on modules" on modules
  for all using (true) with check (true);

create policy "Allow all on lessons" on lessons
  for all using (true) with check (true);
