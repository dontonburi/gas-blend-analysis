-- C Line Gas Log — database schema
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists items (
  code        text primary key,
  family      text,
  description text,
  can_size_oz numeric,
  n2o_ratio_vol numeric check (n2o_ratio_vol is null or (n2o_ratio_vol > 0 and n2o_ratio_vol <= 1)),
  target_gas_g numeric,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists production_runs (
  id          bigint generated always as identity primary key,
  run_date    date not null,
  shift       smallint not null check (shift in (1,2,3)),
  item_code   text references items(code),
  cases       integer not null check (cases >= 0),
  cans_per_case integer not null default 12,
  notes       text,
  created_at  timestamptz default now()
);
create index if not exists production_runs_date on production_runs(run_date, shift);

create table if not exists gas_readings (
  ts          timestamptz primary key,
  n2o_scf     numeric not null,
  n2_scf      numeric not null,
  created_at  timestamptz default now()
);

create table if not exists gas_weight_checks (
  id          bigint generated always as identity primary key,
  check_date  date not null,
  gasser      smallint not null,
  check_time  text,
  initials    text,
  operator    text,
  can_size    text,
  head        smallint,
  before_g    numeric,
  after_g     numeric,
  weight_g    numeric,
  correction_g numeric,
  notes       text,
  created_at  timestamptz default now()
);
create index if not exists gwc_date on gas_weight_checks(check_date, gasser);

create table if not exists settings (
  key   text primary key,
  value numeric not null,
  label text
);
insert into settings(key,value,label) values
  ('n2o_lb_per_scf', 0.116,  'N2O density, lb per scf (60F / 14.7 psia)'),
  ('n2_lb_per_scf',  0.0739, 'N2 density, lb per scf (60F / 14.7 psia)'),
  ('default_n2o_ratio_vol', 0.85, 'Default N2O fraction by volume when item ratio is blank'),
  ('default_target_gas_g', 4.87, 'Default target gas per can (g) when item target is blank'),
  ('cans_per_case', 12, 'Cans per case')
on conflict (key) do nothing;

-- Row level security: only signed-in users can read/write.
alter table items enable row level security;
alter table production_runs enable row level security;
alter table gas_readings enable row level security;
alter table gas_weight_checks enable row level security;
alter table settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['items','production_runs','gas_readings','gas_weight_checks','settings'] loop
    execute format('drop policy if exists "auth all" on %I', t);
    execute format('create policy "auth all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
