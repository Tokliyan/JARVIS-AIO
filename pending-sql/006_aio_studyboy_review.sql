-- JARVIS AIO — Studyboy review deck (spaced repetition), richer attempt
-- history, and editable notes
--
-- RUN THIS BY HAND in Supabase → SQL Editor (Rade.XT project).
-- Safe to run twice. Until it has run:
--   • the Review tab says it needs this file,
--   • renaming or editing a saved note says it needs this file,
--   • Smart Study and practice tests still work and still update topic accuracy,
--     but individual questions aren't kept in the history.
-- Nothing else breaks.

-- 1. The review deck -------------------------------------------------------

create table if not exists public.aio_studyboy_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject          text not null,
  topic            text,
  front            text not null,
  back             text not null,
  source           text not null default 'flashcards'
                   check (source in ('flashcards', 'smart_study', 'study_guide', 'manual')),
  ease             real not null default 2.5,
  interval_days    integer not null default 0,
  reps             integer not null default 0,
  lapses           integer not null default 0,
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now()
);

-- Older copies of this file didn't allow study-guide cards; bring them up to date.
alter table public.aio_studyboy_cards
  drop constraint if exists aio_studyboy_cards_source_check;
alter table public.aio_studyboy_cards
  add constraint aio_studyboy_cards_source_check
  check (source in ('flashcards', 'smart_study', 'study_guide', 'manual'));

-- One card per question per subject: adding the same flashcards twice is a no-op.
create unique index if not exists aio_studyboy_cards_unique_front
  on public.aio_studyboy_cards (user_id, subject, front);

-- The review queue reads "what is due, oldest first".
create index if not exists aio_studyboy_cards_due_idx
  on public.aio_studyboy_cards (user_id, due_at);

alter table public.aio_studyboy_cards enable row level security;

drop policy if exists "own cards select" on public.aio_studyboy_cards;
create policy "own cards select" on public.aio_studyboy_cards
  for select using (auth.uid() = user_id);

drop policy if exists "own cards insert" on public.aio_studyboy_cards;
create policy "own cards insert" on public.aio_studyboy_cards
  for insert with check (auth.uid() = user_id);

drop policy if exists "own cards update" on public.aio_studyboy_cards;
create policy "own cards update" on public.aio_studyboy_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cards delete" on public.aio_studyboy_cards;
create policy "own cards delete" on public.aio_studyboy_cards
  for delete using (auth.uid() = user_id);

-- 2. Richer attempts -------------------------------------------------------
-- Needs 001 (aio_studyboy_attempts). If 001 hasn't been run this block does
-- nothing, so the whole file can still be run safely.

do $$
begin
  if to_regclass('public.aio_studyboy_attempts') is not null then
    alter table public.aio_studyboy_attempts
      add column if not exists question    text,
      add column if not exists user_answer text,
      add column if not exists kind        text,
      add column if not exists hint_used   boolean not null default false;

    -- Smart Study and practice tests record under their own modes.
    alter table public.aio_studyboy_attempts
      drop constraint if exists aio_studyboy_attempts_mode_check;
    alter table public.aio_studyboy_attempts
      add constraint aio_studyboy_attempts_mode_check
      check (mode in ('quiz', 'flashcards', 'smart_study', 'practice_test'));
  else
    raise notice 'aio_studyboy_attempts not found: run 001_aio_studyboy_attempts.sql first, then run this file again.';
  end if;
end $$;

-- 3. Editable notes --------------------------------------------------------
-- The Notes tab lets you rename a saved note and fix its text. That needs an
-- update policy on aio_studyboy_docs scoped to the owner.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'aio_studyboy_docs' and column_name = 'user_id'
  ) then
    drop policy if exists "own docs update" on public.aio_studyboy_docs;
    create policy "own docs update" on public.aio_studyboy_docs
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  else
    raise notice 'aio_studyboy_docs has no user_id column: notes stay read-only.';
  end if;
end $$;
