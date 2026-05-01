-- SIGNAL — Migration: Add manual_digest for accurate lesson generation
-- Run this if you already have the tables

alter table modules add column if not exists manual_digest text;
