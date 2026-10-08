-- Apply after marketingmind_v2.sql. Each account can own several isolated client workspaces.
drop index if exists public.mm_workspaces_owner_unique;
alter table public.mm_workspaces add column if not exists snapshot jsonb;
alter table public.mm_workspaces enable row level security;

-- The existing owner policy uses auth.uid() for both reads and writes.
-- Keep credentials in mm_provider_connections owner-scoped until each provider
-- has a reviewed workspace-specific account selection and authorization flow.
