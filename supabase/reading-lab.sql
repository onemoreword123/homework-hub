-- =====================================================================
-- Homework Hub · Reading labs (IELTS) — run once
-- Supabase → SQL Editor → New query → paste all of this → Run.
-- Safe to run more than once.
-- =====================================================================

-- Students' work in progress (saved automatically while they do a reading lab)
alter table public.submissions add column if not exists draft jsonb;

-- Private storage for reading-lab lesson files (article text stays off the public website)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lessons', 'lessons', false, 5242880, array['application/json'])
on conflict (id) do nothing;

drop policy if exists "lessons: read if open for my class, or teacher" on storage.objects;
create policy "lessons: read if open for my class, or teacher" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lessons' and (
      public.is_teacher()
      or exists (select 1 from public.class_topics ct
                 where ct.class_id = public.my_class()
                   and ct.topic_id = regexp_replace(storage.objects.name, '\.json$', ''))
    )
  );

drop policy if exists "lessons: teacher uploads" on storage.objects;
create policy "lessons: teacher uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'lessons' and public.is_teacher());

drop policy if exists "lessons: teacher replaces" on storage.objects;
create policy "lessons: teacher replaces" on storage.objects
  for update to authenticated using (bucket_id = 'lessons' and public.is_teacher());

drop policy if exists "lessons: teacher deletes" on storage.objects;
create policy "lessons: teacher deletes" on storage.objects
  for delete to authenticated using (bucket_id = 'lessons' and public.is_teacher());

-- The IELTS class (skip if you already made it in the dashboard)
insert into public.classes (name, level) values ('IELTS', 'IELTS')
on conflict (name) do nothing;
