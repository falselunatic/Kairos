-- Run in Supabase SQL Editor.

create table if not exists roast_battles (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'active',  -- active | finished
  round int not null default 1,
  user_score int not null default 0,
  kairos_score int not null default 0,
  winner text,  -- user | kairos | tie, set when finished
  created_at timestamptz not null default now()
);

create table if not exists roast_rounds (
  id serial primary key,
  battle_id int references roast_battles(id) on delete cascade,
  round int not null,
  kairos_line text not null,
  user_line text,
  kairos_score int,
  user_score int,
  created_at timestamptz not null default now()
);

create index if not exists roast_battles_user_id_idx on roast_battles(user_id);
create index if not exists roast_rounds_battle_id_idx on roast_rounds(battle_id);
