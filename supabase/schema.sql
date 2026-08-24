-- MarketingMind AI production starter schema for Supabase/Postgres.
-- Run in a new Supabase project's SQL editor. Authentication uses Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  business jsonb not null default '{}'::jsonb,
  local_seo_checks jsonb not null default '[]'::jsonb,
  seo_audit jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  phone text,
  source text,
  service text,
  status text not null default 'New' check (status in ('New','Follow-up','Booked','Lost')),
  follow_up date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer text not null,
  service text not null,
  staff text,
  starts_at timestamptz not null,
  value numeric(12,2) not null default 0 check (value >= 0),
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Completed','Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  copy text,
  channel text not null,
  status text not null default 'Draft' check (status in ('Draft','Ready','Scheduled')),
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action text not null,
  provider text not null default 'local',
  credits numeric(12,4) not null default 0,
  estimated_cost_inr numeric(12,4) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.forecast_points (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period date not null,
  leads numeric(12,2) not null default 0,
  revenue numeric(14,2) not null default 0,
  visits numeric(14,2) not null default 0,
  unique (workspace_id, period)
);

create index if not exists leads_workspace_idx on public.leads(workspace_id);
create index if not exists appointments_workspace_starts_idx on public.appointments(workspace_id, starts_at);
create index if not exists posts_workspace_publish_idx on public.posts(workspace_id, publish_at);
create index if not exists usage_workspace_created_idx on public.usage_events(workspace_id, created_at desc);
create index if not exists forecast_workspace_period_idx on public.forecast_points(workspace_id, period);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at before update on public.workspaces for each row execute function public.touch_updated_at();
drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at before update on public.leads for each row execute function public.touch_updated_at();
drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at before update on public.appointments for each row execute function public.touch_updated_at();
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at before update on public.posts for each row execute function public.touch_updated_at();

alter table public.workspaces enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.posts enable row level security;
alter table public.usage_events enable row level security;
alter table public.forecast_points enable row level security;

create or replace function public.owns_workspace(target uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.workspaces w where w.id = target and w.owner_id = auth.uid()) $$;

drop policy if exists "owners manage workspaces" on public.workspaces;
create policy "owners manage workspaces" on public.workspaces for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owners manage leads" on public.leads;
create policy "owners manage leads" on public.leads for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
drop policy if exists "owners manage appointments" on public.appointments;
create policy "owners manage appointments" on public.appointments for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
drop policy if exists "owners manage posts" on public.posts;
create policy "owners manage posts" on public.posts for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
drop policy if exists "owners manage usage" on public.usage_events;
create policy "owners manage usage" on public.usage_events for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
drop policy if exists "owners manage forecasts" on public.forecast_points;
create policy "owners manage forecasts" on public.forecast_points for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workspaces, public.leads, public.appointments, public.posts, public.usage_events, public.forecast_points to authenticated;
grant usage, select on all sequences in schema public to authenticated;

