-- JARVIS AIO — Night Run reports
--
-- RUN THIS BY HAND in Supabase → SQL Editor (Rade.XT project).
-- Until it's run, the overnight jobs' reports are rejected with a clear
-- "run pending-sql/005" error and the Night run card on Daily Status says so.
--
-- One row per job per night: Rade.XT (GitHub Actions), the RuneHaven and
-- JARVIS build routines, and the morning check that summarises the rest.
-- Writes only ever come from the server (service key, behind
-- NIGHT_RUN_TOKEN), so there's deliberately no insert policy for users —
-- the logged-in app can read its own rows and nothing else.

create table if not exists public.aio_night_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  run_date    date not null,
  section     text not null check (section in ('rade', 'runehaven', 'jarvis', 'leadlens', 'morning')),
  status      text not null check (status in ('ok', 'warn', 'fail')),
  summary     text not null,
  needs_you   text[] not null default '{}',
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists aio_night_runs_user_date_idx
  on public.aio_night_runs (user_id, run_date desc, created_at);

alter table public.aio_night_runs enable row level security;

drop policy if exists "own night runs select" on public.aio_night_runs;
create policy "own night runs select" on public.aio_night_runs
  for select using (auth.uid() = user_id);
