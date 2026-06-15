create table if not exists build_snapshots (
  id text primary key,
  league text not null,
  class_name text not null,
  ascendancy_name text,
  level integer not null,
  account_name text not null,
  character_name text not null,
  source text not null,
  captured_at timestamptz not null,
  payload jsonb not null
);

create table if not exists build_summaries (
  id text primary key,
  build_id text not null references build_snapshots(id) on delete cascade,
  title text not null,
  primary_skill text,
  highlights jsonb not null,
  defensive_layers jsonb not null,
  generated_at timestamptz not null
);

create table if not exists passive_heatmap_points (
  league text not null,
  class_name text,
  passive_id text not null,
  name text,
  x numeric,
  y numeric,
  weight numeric not null,
  generated_at timestamptz not null,
  primary key (league, class_name, passive_id)
);

create index if not exists build_snapshots_league_class_idx
  on build_snapshots (league, class_name);
