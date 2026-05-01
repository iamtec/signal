-- SIGNAL — Migration: Add profile table
-- Run this if you already have the other tables

create table if not exists profile (
  id uuid primary key default gen_random_uuid(),
  notes text,
  signal_chains text,
  reflections text,
  reflections_updated_at timestamptz,
  updated_at timestamptz default now()
);

alter table profile enable row level security;

create policy "Allow all on profile" on profile
  for all using (true) with check (true);

-- Insert a single empty row
insert into profile (notes, signal_chains) values ('', '');
