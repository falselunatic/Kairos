-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Adds per-user scoping on top of schema.sql (auth.users is Supabase's built-in
-- users table, created automatically by Supabase Auth).

alter table messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table memories add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists messages_user_id_idx on messages(user_id);
create index if not exists memories_user_id_idx on memories(user_id);

create or replace function add_memory(p_user_id uuid, p_content text, p_embedding float8[])
returns void
language sql
as $$
  insert into memories (user_id, content, embedding) values (p_user_id, p_content, p_embedding::vector);
$$;

create or replace function match_memories(p_user_id uuid, p_query_embedding float8[], p_match_count int default 5)
returns table (id int, content text)
language sql
as $$
  select id, content from memories
  where user_id = p_user_id
  order by embedding <=> p_query_embedding::vector
  limit p_match_count;
$$;
