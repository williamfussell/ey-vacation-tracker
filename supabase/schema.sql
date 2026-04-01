-- EY Vacation Tracker Schema
-- Run this in your Supabase SQL Editor

-- Teams table
create table if not exists teams (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Seed the four teams
insert into teams (name, sort_order) values
  ('PM & Design', 1),
  ('Backend', 2),
  ('Frontend', 3),
  ('DevOps', 4);

-- Members table
create table if not exists members (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz default now()
);

-- PTO entries
create table if not exists pto_entries (
  id uuid default gen_random_uuid() primary key,
  member_id uuid not null references members(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now(),
  constraint valid_date_range check (end_date >= start_date)
);

-- Edit log for safety / audit trail
create table if not exists edit_log (
  id uuid default gen_random_uuid() primary key,
  pto_entry_id uuid references pto_entries(id) on delete set null,
  member_name text not null,
  target_member_name text not null,
  action text not null check (action in ('create', 'delete')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_pto_entries_member on pto_entries(member_id);
create index if not exists idx_pto_entries_dates on pto_entries(start_date, end_date);
create index if not exists idx_members_team on members(team_id);
create index if not exists idx_edit_log_created on edit_log(created_at desc);

-- Enable realtime
alter publication supabase_realtime add table pto_entries;
alter publication supabase_realtime add table members;

-- Row level security (disabled since no auth)
alter table teams enable row level security;
alter table members enable row level security;
alter table pto_entries enable row level security;
alter table edit_log enable row level security;

-- Public access policies (no auth)
create policy "Public read teams" on teams for select using (true);
create policy "Public read members" on members for select using (true);
create policy "Public insert members" on members for insert with check (true);
create policy "Public delete members" on members for delete using (true);
create policy "Public read pto" on pto_entries for select using (true);
create policy "Public insert pto" on pto_entries for insert with check (true);
create policy "Public delete pto" on pto_entries for delete using (true);
create policy "Public read log" on edit_log for select using (true);
create policy "Public insert log" on edit_log for insert with check (true);
