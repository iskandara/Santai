-- SANTAI shop fields: room for price, fabric, fit, story, photos and shop details.
--
-- Run this once in the Supabase SQL Editor, then reload the editor (/#CMSedit).
-- It adds two columns that hold everything new as JSON, so adding a field later never needs more SQL:
--   santai_articles.extra  { price, fabric, fit, story, gallery: [photo urls] }
--   santai_global.shop     { whatsapp, shipping, returns }
-- The access rules from cms-security.sql already cover new columns: everyone can read, only the editor can write.
-- Safe to run again.

alter table public.santai_articles add column if not exists extra jsonb not null default '{}'::jsonb;
alter table public.santai_global   add column if not exists shop  jsonb not null default '{}'::jsonb;
