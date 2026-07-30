-- Run in Supabase SQL Editor.

create table if not exists notes (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on notes(user_id);
