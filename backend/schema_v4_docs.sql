-- Run in Supabase SQL Editor.

create table if not exists documents (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists doc_chunks (
  id serial primary key,
  document_id int references documents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on documents(user_id);
create index if not exists doc_chunks_user_id_idx on doc_chunks(user_id);
create index if not exists doc_chunks_document_id_idx on doc_chunks(document_id);

create or replace function add_doc_chunk(
  p_document_id int, p_user_id uuid, p_content text, p_embedding float8[]
)
returns void
language sql
as $$
  insert into doc_chunks (document_id, user_id, content, embedding)
  values (p_document_id, p_user_id, p_content, p_embedding::vector);
$$;

create or replace function match_doc_chunks(
  p_user_id uuid, p_query_embedding float8[], p_match_count int default 5
)
returns table (content text)
language sql
as $$
  select content from doc_chunks
  where user_id = p_user_id
  order by embedding <=> p_query_embedding::vector
  limit p_match_count;
$$;
