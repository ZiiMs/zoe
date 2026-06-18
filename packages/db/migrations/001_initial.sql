create table if not exists build_snapshots (
  id text not null,
  league text not null,
  class_name text not null,
  ascendancy_name text,
  level integer not null,
  account_name text not null,
  character_name text not null,
  source text not null,
  captured_at timestamptz not null,
  source_metadata jsonb not null,
  payload jsonb not null,
  primary key (id, league)
);

create table if not exists build_summaries (
  id text not null,
  build_id text not null,
  build_league text not null,
  title text not null,
  primary_skill text,
  highlights jsonb not null,
  defensive_layers jsonb not null,
  generated_at timestamptz not null,
  source_snapshot jsonb not null,
  primary key (build_id, build_league, generated_at),
  foreign key (build_id, build_league) references build_snapshots(id, league) on delete cascade
);

create table if not exists heatmap_aggregates (
  league text not null,
  kind text not null,
  class_name text not null,
  generated_at timestamptz not null,
  payload jsonb not null,
  primary key (league, kind, class_name)
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
  source_kind text not null default 'passives',
  primary key (league, class_name, passive_id)
);

create index if not exists build_snapshots_league_class_idx
  on build_snapshots (league, class_name);
