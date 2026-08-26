-- Non-destructive MarketingMind schema for an existing Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.mm_workspaces (id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,name text not null,category text,business jsonb not null default '{}'::jsonb,local_seo_checks jsonb not null default '[]'::jsonb,seo_audit jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.mm_leads (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.mm_workspaces(id) on delete cascade,name text not null,phone text,email text,source text,service text,status text not null default 'New',follow_up date,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.mm_appointments (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.mm_workspaces(id) on delete cascade,customer text not null,service text not null,staff text,starts_at timestamptz not null,value numeric(12,2) not null default 0,status text not null default 'Pending',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.mm_posts (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.mm_workspaces(id) on delete cascade,title text not null,copy text,channel text not null,content_kind text not null default 'Organic post',status text not null default 'Draft',publish_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.mm_usage_events (id bigint generated always as identity primary key,workspace_id uuid not null references public.mm_workspaces(id) on delete cascade,action text not null,provider text not null default 'local',credits numeric(12,4) not null default 0,estimated_cost_inr numeric(12,4) not null default 0,created_at timestamptz not null default now());
create table if not exists public.mm_forecast_points (id bigint generated always as identity primary key,workspace_id uuid not null references public.mm_workspaces(id) on delete cascade,period date not null,leads numeric(12,2) not null default 0,revenue numeric(14,2) not null default 0,visits numeric(14,2) not null default 0,unique(workspace_id,period));

create index if not exists mm_leads_workspace_idx on public.mm_leads(workspace_id);
create index if not exists mm_appointments_workspace_starts_idx on public.mm_appointments(workspace_id,starts_at);
create index if not exists mm_posts_workspace_publish_idx on public.mm_posts(workspace_id,publish_at);
create index if not exists mm_workspaces_owner_idx on public.mm_workspaces(owner_id);
create unique index if not exists mm_workspaces_owner_unique on public.mm_workspaces(owner_id);
create table if not exists public.mm_provider_connections (id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,provider text not null check(provider in ('meta','google_business')),encrypted_credentials text not null,account_summary jsonb not null default '[]'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,provider));
alter table public.mm_provider_connections drop constraint if exists mm_provider_connections_provider_check;
alter table public.mm_provider_connections add constraint mm_provider_connections_provider_check check(provider in ('meta','google_business'));
alter table public.mm_provider_connections enable row level security;
revoke all on table public.mm_provider_connections from anon, authenticated;
grant select, insert, update, delete on table public.mm_provider_connections to service_role;
create index if not exists mm_provider_connections_owner_idx on public.mm_provider_connections(owner_id);
create index if not exists mm_usage_workspace_idx on public.mm_usage_events(workspace_id);

alter table public.mm_workspaces enable row level security;
alter table public.mm_leads enable row level security;
alter table public.mm_appointments enable row level security;
alter table public.mm_posts enable row level security;
alter table public.mm_usage_events enable row level security;
alter table public.mm_forecast_points enable row level security;
create policy "mm owners manage workspaces" on public.mm_workspaces for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "mm owners manage leads" on public.mm_leads for all to authenticated using(exists(select 1 from public.mm_workspaces w where w.id=mm_leads.workspace_id and w.owner_id=(select auth.uid()))) with check(exists(select 1 from public.mm_workspaces w where w.id=mm_leads.workspace_id and w.owner_id=(select auth.uid())));
create policy "mm owners manage appointments" on public.mm_appointments for all to authenticated using(exists(select 1 from public.mm_workspaces w where w.id=mm_appointments.workspace_id and w.owner_id=(select auth.uid()))) with check(exists(select 1 from public.mm_workspaces w where w.id=mm_appointments.workspace_id and w.owner_id=(select auth.uid())));
create policy "mm owners manage posts" on public.mm_posts for all to authenticated using(exists(select 1 from public.mm_workspaces w where w.id=mm_posts.workspace_id and w.owner_id=(select auth.uid()))) with check(exists(select 1 from public.mm_workspaces w where w.id=mm_posts.workspace_id and w.owner_id=(select auth.uid())));
create policy "mm owners manage usage" on public.mm_usage_events for all to authenticated using(exists(select 1 from public.mm_workspaces w where w.id=mm_usage_events.workspace_id and w.owner_id=(select auth.uid()))) with check(exists(select 1 from public.mm_workspaces w where w.id=mm_usage_events.workspace_id and w.owner_id=(select auth.uid())));
create policy "mm owners manage forecasts" on public.mm_forecast_points for all to authenticated using(exists(select 1 from public.mm_workspaces w where w.id=mm_forecast_points.workspace_id and w.owner_id=(select auth.uid()))) with check(exists(select 1 from public.mm_workspaces w where w.id=mm_forecast_points.workspace_id and w.owner_id=(select auth.uid())));
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.mm_workspaces,public.mm_leads,public.mm_appointments,public.mm_posts,public.mm_usage_events,public.mm_forecast_points to authenticated;
grant usage,select on all sequences in schema public to authenticated;
