-- SIGNAL — Migration: Add favorites support to lessons
-- Run this if you already have the tables

alter table lessons add column if not exists is_favorite boolean not null default false;
