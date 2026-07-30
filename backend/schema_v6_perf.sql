-- Run in Supabase SQL Editor.
-- Composite index for the exact filter+order pattern list_messages() uses
-- (user_id + channel, ordered by created_at) - speeds up loading chat history.

create index if not exists messages_user_channel_created_idx
  on messages(user_id, channel, created_at);
