-- JARVIS AIO — per-subject resource links on Studyboy
--
-- RUN THIS BY HAND in Supabase → SQL Editor (Rade.XT project).
--
-- This one is a catch-up: the "Resources — <subject>" panel shipped on 21 Sep
-- without its table, so every link typed into it was silently thrown away —
-- the insert failed, the panel reloaded empty, and nothing said why. The panel
-- now hides itself until this table exists, so nothing can be lost that way
-- again; run this to switch it back on.
--
-- Same conventions as the other aio_ tables: user_id defaulted from auth.uid()
-- so inserts don't have to pass it, and RLS scoping every row to its owner.

create table if not exists public.aio_study_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject     text not null,
  label       text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);

-- The panel reads "every resource for one subject, oldest first".
create index if not exists aio_study_resources_user_subject_idx
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
