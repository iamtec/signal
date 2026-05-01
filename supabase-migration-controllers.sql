-- SIGNAL — Migration: Add controllers support
-- Run this if you already have the tables

alter table modules add column if not exists is_controller boolean not null default false;
