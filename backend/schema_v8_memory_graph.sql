-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Powers the Memory Galaxy view: returns each memory's embedding as a plain
-- float array (rather than the raw `vector` type) so PostgREST/the backend can
-- read it as normal JSON numbers instead of a stringified vector literal.

create or replace function get_memories_with_embeddings(p_user_id uuid)
returns table (id int, content text, created_at timestamptz, embedding float8[])
language sql
as $$
  -- pgvector's `vector` type only casts directly to real[] (float4), not float8[] -
  -- go through that first.
  select id, content, created_at, embedding::real[]::float8[]
  from memories
  where user_id = p_user_id
  order by created_at desc
  limit 400;
$$;
