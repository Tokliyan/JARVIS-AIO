-- JARVIS AIO — log of command-bar notifications that have been processed
--
-- RUN THIS BY HAND in Supabase → SQL Editor (Rade.XT project).
-- Until it's run, the app degrades quietly: processing a notification still
-- saves the material, checklist items and study plan exactly as before, it just
-- isn't logged, and the Notifications tab on Studyboy stays empty.
--
-- Same conventions as the other aio_ tables: user_id defaulted from auth.uid()
-- so inserts don't have to pass it, and RLS scoping every row to its owner.

create table if not exists public.aio_notification_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  summary         text,
  subjects        text[] not null default '{}',
  captured_text   text,
  checklist_count integer not null default 0,
  plan_built      boolean not null default false,
  plan_steps      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists aio_notification_log_user_created_idx
  on public.aio_notification_log (user_id, created_at desc);

alter table public.aio_notification_log enable row level security;

drop policy if exists "own notification log select" on public.aio_notification_log;
create policy "own notification log select" on public.aio_notification_log
  for select using (auth.uid() = user_id);

drop policy if exists "own notification log insert" on public.aio_notification_log;
create policy "own notification log insert" on public.aio_notification_log
  for insert with check (auth.uid() = user_id);

drop policy if exists "own notification log delete" on public.aio_notification_log;
create policy "own notification log delete" on public.aio_notification_log
  for delete using (auth.uid() = user_id);
