-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- This goes over your browser's HTTPS connection to Supabase, not a raw DB
-- connection, so it works even if your network blocks the Postgres port.

create extension if not exists vector;

create table if not exists messages (
  id serial primary key,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists memories (
  id serial primary key,
  content text not null,
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

create or replace function add_memory(p_content text, p_embedding float8[])
returns void
language sql
as $$
  insert into memories (content, embedding) values (p_content, p_embedding::vector);
$$;

create or replace function match_memories(p_query_embedding float8[], p_match_count int default 5)
returns table (content text)
language sql
as $$
  select content from memories
  order by embedding <=> p_query_embedding::vector
  limit p_match_count;
$$;
