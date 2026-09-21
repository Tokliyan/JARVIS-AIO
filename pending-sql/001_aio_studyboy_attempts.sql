-- JARVIS AIO — quiz / flashcard attempt tracking
--
-- RUN THIS BY HAND in Supabase → SQL Editor (Rade.XT project).
-- Until it's run, the app degrades quietly: nothing is recorded and the
-- "weak topics" widget on Studyboy stays hidden. Nothing breaks.
--
-- Matches the conventions the other aio_ tables use: a user_id defaulted from
-- auth.uid() so inserts don't have to pass it, and RLS scoping every row to its
-- owner. If the existing tables differ (e.g. no auth.users FK), match them
-- rather than this file.

create table if not exists public.aio_studyboy_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject     text,
  topic       text,
  mode        text not null check (mode in ('quiz', 'flashcards')),
  correct     boolean not null,
  created_at  timestamptz not null default now()
);

-- The widget reads "recent attempts for one subject", so index for exactly that.
create index if not exists aio_studyboy_attempts_user_subject_idx
  on public.aio_studyboy_attempts (user_id, subject, created_at desc);

alter table public.aio_studyboy_attempts enable row level security;

drop policy if exists "own attempts select" on public.aio_studyboy_attempts;
create policy "own attempts select" on public.aio_studyboy_attempts
  for select using (auth.uid() = user_id);

drop policy if exists "own attempts insert" on public.aio_studyboy_attempts;
create policy "own attempts insert" on public.aio_studyboy_attempts
  for insert with check (auth.uid() = user_id);

drop policy if exists "own attempts delete" on public.aio_studyboy_attempts;
create policy "own attempts delete" on public.aio_studyboy_attempts
  for delete using (auth.uid() = user_id);
