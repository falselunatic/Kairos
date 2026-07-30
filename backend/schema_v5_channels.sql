-- Run in Supabase SQL Editor.
-- Adds a "channel" to messages so the Kairos Code chat has its own history,
-- separate from the main companion chat, without needing a whole new table.

alter table messages add column if not exists channel text not null default 'chat';
create index if not exists messages_channel_idx on messages(channel);
