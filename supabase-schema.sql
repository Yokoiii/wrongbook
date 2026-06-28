create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "users can read own settings" on public.user_settings;
create policy "users can read own settings"
on public.user_settings for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own settings" on public.user_settings;
create policy "users can insert own settings"
on public.user_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own settings" on public.user_settings;
create policy "users can update own settings"
on public.user_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.questions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subject text not null,
  type text not null,
  title text not null default '',
  created_at_ms bigint not null,
  source_id text not null default '',
  source_name text not null default '',
  question_image_paths jsonb not null default '[]'::jsonb,
  answer_image_paths jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists questions_user_created_idx
on public.questions (user_id, created_at_ms);

alter table public.questions enable row level security;

drop policy if exists "users can read own questions" on public.questions;
create policy "users can read own questions"
on public.questions for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own questions" on public.questions;
create policy "users can insert own questions"
on public.questions for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own questions" on public.questions;
create policy "users can update own questions"
on public.questions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own questions" on public.questions;
create policy "users can delete own questions"
on public.questions for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users can read own question images" on storage.objects;
create policy "users can read own question images"
on storage.objects for select
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can upload own question images" on storage.objects;
create policy "users can upload own question images"
on storage.objects for insert
with check (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can update own question images" on storage.objects;
create policy "users can update own question images"
on storage.objects for update
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can delete own question images" on storage.objects;
create policy "users can delete own question images"
on storage.objects for delete
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
