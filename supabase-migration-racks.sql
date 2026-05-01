-- SIGNAL — Migration: Add racks
-- Run this if you already have modules/lessons tables from the initial schema

create table if not exists racks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  hp_capacity integer,
  created_at timestamptz default now()
);

alter table racks enable row level security;

create policy "Allow all on racks" on racks
  for all using (true) with check (true);

alter table modules add column if not exists rack_id uuid references racks(id) on delete set null;
