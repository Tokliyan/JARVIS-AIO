-- Stable "Doc N" numbers for Studyboy documents, so you can say
-- "open doc 3" on the Kindle (or anywhere) and it always means the same doc,
-- even after an earlier one is deleted.
--
-- Optional: the Kindle command route works without this by numbering docs in
-- upload order. Run it to make the numbers permanent.
-- Run in Supabase -> SQL Editor. Safe to run twice.

alter table public.aio_studyboy_docs
  add column if not exists doc_number integer;

-- Number the docs you already have, oldest first.
with ranked as (
  select id, row_number() over (order by uploaded_at, id) as rn
  from public.aio_studyboy_docs
  where doc_number is null
)
update public.aio_studyboy_docs d
set doc_number = ranked.rn + coalesce((select max(doc_number) from public.aio_studyboy_docs), 0)
from ranked
where d.id = ranked.id;

-- Every new doc gets the next number automatically.
create sequence if not exists public.aio_studyboy_docs_number_seq;

select setval(
  'public.aio_studyboy_docs_number_seq',
  coalesce((select max(doc_number) from public.aio_studyboy_docs), 0) + 1,
  false
);

alter table public.aio_studyboy_docs
  alter column doc_number set default nextval('public.aio_studyboy_docs_number_seq');

create unique index if not exists aio_studyboy_docs_doc_number_idx
  on public.aio_studyboy_docs (doc_number);
