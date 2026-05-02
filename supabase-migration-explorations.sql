-- SIGNAL — Migration: Add explorations table for Ask Signal
-- Run this if you already have the other tables

create table if not exists explorations (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  content text,
  cross_rack boolean not null default false,
  is_favorite boolean not null default false,
  created_at timestamptz default now()
);

alter table explorations enable row level security;

create policy "Allow all on explorations" on explorations
  for all using (true) with check (true);
