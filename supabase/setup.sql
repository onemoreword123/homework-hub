-- =====================================================================
-- Homework Hub · Supabase setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- ---------- Tables ----------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  level       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  full_name   text not null,
  role        text not null default 'student' check (role in ('teacher','student')),
  class_id    uuid references public.classes(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Which topics are open for which class
create table if not exists public.class_topics (
  class_id    uuid not null references public.classes(id) on delete cascade,
  topic_id    text not null,
  opened_at   timestamptz not null default now(),
  primary key (class_id, topic_id)
);

-- One row per student per topic
create table if not exists public.submissions (
  id                      uuid primary key default gen_random_uuid(),
  student_id              uuid not null references public.profiles(id) on delete cascade,
  topic_id                text not null,
  answers                 jsonb,
  score                   int,
  max_score               int,
  exercises_submitted_at  timestamptz,
  recording_path          text,
  recording_option        text,
  recording_submitted_at  timestamptz,
  teacher_comment         text,
  teacher_mark            text,
  reviewed_at             timestamptz,
  updated_at              timestamptz not null default now(),
  unique (student_id, topic_id)
);

-- ---------- Helper ----------
create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

create or replace function public.my_class()
returns uuid
language sql stable security definer set search_path = public
as $$
  select class_id from public.profiles where id = auth.uid();
$$;

-- ---------- Guard: students can't edit teacher fields or change submitted work ----------
create or replace function public.guard_submission()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  if public.is_teacher() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.teacher_comment := null;
    new.teacher_mark    := null;
    new.reviewed_at     := null;
    new.exercises_submitted_at := case when new.answers is not null then now() end;
    new.recording_submitted_at := case when new.recording_path is not null then now() end;
    return new;
  end if;

  -- UPDATE by a student
  new.student_id      := old.student_id;
  new.topic_id        := old.topic_id;
  new.teacher_comment := old.teacher_comment;
  new.teacher_mark    := old.teacher_mark;
  new.reviewed_at     := old.reviewed_at;

  if old.exercises_submitted_at is not null then
    new.answers := old.answers;
    new.score := old.score;
    new.max_score := old.max_score;
    new.exercises_submitted_at := old.exercises_submitted_at;
  elsif new.answers is not null then
    new.exercises_submitted_at := now();
  else
    new.exercises_submitted_at := null;
  end if;

  if old.reviewed_at is not null then
    -- recording is locked once the teacher has reviewed it
    new.recording_path := old.recording_path;
    new.recording_option := old.recording_option;
    new.recording_submitted_at := old.recording_submitted_at;
  elsif new.recording_path is distinct from old.recording_path and new.recording_path is not null then
    new.recording_submitted_at := now();
  else
    new.recording_submitted_at := old.recording_submitted_at;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_submission on public.submissions;
create trigger guard_submission
  before insert or update on public.submissions
  for each row execute function public.guard_submission();

-- ---------- Row-level security ----------
alter table public.classes      enable row level security;
alter table public.profiles     enable row level security;
alter table public.class_topics enable row level security;
alter table public.submissions  enable row level security;

-- classes
create policy "classes: read (signed in)" on public.classes
  for select to authenticated using (true);
create policy "classes: teacher writes" on public.classes
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- profiles
create policy "profiles: read own or teacher" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_teacher());
create policy "profiles: teacher updates" on public.profiles
  for update to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- class_topics
create policy "class_topics: read own class or teacher" on public.class_topics
  for select to authenticated using (public.is_teacher() or class_id = public.my_class());
create policy "class_topics: teacher writes" on public.class_topics
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- submissions
create policy "submissions: read own or teacher" on public.submissions
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "submissions: student inserts own, topic must be open" on public.submissions
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from public.class_topics ct
                where ct.class_id = public.my_class() and ct.topic_id = submissions.topic_id)
  );
create policy "submissions: student or teacher updates" on public.submissions
  for update to authenticated
  using (student_id = auth.uid() or public.is_teacher())
  with check (student_id = auth.uid() or public.is_teacher());
create policy "submissions: teacher deletes" on public.submissions
  for delete to authenticated using (public.is_teacher());

-- ---------- Storage for recordings (private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 15728640,
        array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/x-m4a','audio/m4a','audio/wav','audio/aac'])
on conflict (id) do nothing;

create policy "recordings: student uploads to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recordings: student replaces own" on storage.objects
  for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recordings: read own or teacher" on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));
create policy "recordings: delete own or teacher" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recordings' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));

-- ---------- Your classes ----------
insert into public.classes (name, level) values
  ('Oi09', 'A2'),
  ('Oe09', 'B1')
on conflict (name) do nothing;

-- =====================================================================
-- LAST STEP (run separately after creating your own login):
-- 1. Supabase → Authentication → Users → Add user → Create new user
--    (your email + a password, tick "Auto Confirm User").
-- 2. Then run this, with your email:
--
-- insert into public.profiles (id, username, full_name, role)
-- select id, 'teacher', 'Teacher', 'teacher' from auth.users
-- where email = 'YOUR-EMAIL@example.com';
-- =====================================================================

-- ---------- Access for the website (security is still enforced by the rules above) ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.classes, public.profiles, public.class_topics, public.submissions to authenticated;
grant all on public.classes, public.profiles, public.class_topics, public.submissions to service_role;
grant execute on function public.is_teacher(), public.my_class() to authenticated, service_role;
