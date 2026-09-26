-- JARVIS AIO — per-subject study resource links
--
-- RUN THIS BY HAND in Supabase → SQL Editor (Rade.XT project).
--
-- Why this exists: the "Resources — <subject>" panel on Studyboy shipped in
-- 876f0ae (already on main) reading and writing `aio_study_resources`, but the
-- table was never created and no migration was ever written for it. The panel
-- fails silently — `load()` gets an error, `data` is null, so it renders
-- "No resource links for <subject> yet." and every Save quietly does nothing.
-- Until this is run, that panel looks like an empty list rather than a broken
-- one, which is why it went unnoticed.
--
-- Columns are taken straight from components/StudyResources.js: it inserts
-- { subject, label, url }, orders by created_at ascending, and deletes by id.
-- Same conventions as the other aio_ tables: user_id defaulted from auth.uid()
-- so inserts don't have to pass it, and RLS scoping every row to its owner.
-- If the existing tables differ (e.g. no auth.users FK), match them rather
-- than this file.

create table if not exists public.aio_study_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject     text not null,
  label       text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);

-- The panel reads "this subject's links, oldest first", so index for that.
create index if not exists aio_study_resources_user_subject_created_idx
  on public.aio_study_resources (user_id, subject, created_at);

alter table public.aio_study_resources enable row level security;

drop policy if exists "own study resources select" on public.aio_study_resources;
create policy "own study resources select" on public.aio_study_resources
  for select using (auth.uid() = user_id);

drop policy if exists "own study resources insert" on public.aio_study_resources;
create policy "own study resources insert" on public.aio_study_resources
  for insert with check (auth.uid() = user_id);

drop policy if exists "own study resources delete" on public.aio_study_resources;
create policy "own study resources delete" on public.aio_study_resources
  for delete using (auth.uid() = user_id);
